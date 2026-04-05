/**
 * Background enrichment worker.
 * Runs AFTER the base report has been written to DB.
 * Each AI call is independently guarded — a failure in one never blocks the others.
 * Never throws.
 */

import { generateText, Output } from 'ai'
import { getLlunaAnthropicModel } from '@/lib/anthropic-model'
import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicMenu } from '@/lib/menu-store'
import type { ClinicMenuTreatment } from '@/lib/clinic-menu'

// ─── Schemas (mirrors consultant-brief + sales-methodology routes) ─────────────

const briefSectionSchema = z.object({
  score: z.number().int().min(1).max(5),
  tier: z.enum(['Premium', 'Mid', 'Budget']),
  reason: z.string(),
})

const briefSchema = z.object({
  consultantBrief: z.object({
    consumptionCapability: briefSectionSchema,
    longTermPossibility: briefSectionSchema.extend({ isReturning: z.enum(['returning', 'new', 'unknown']) }),
    referralAbility: briefSectionSchema.extend({ isLocal: z.enum(['yes', 'no', 'unknown']) }),
  }),
  patientSummaryStructured: z.object({
    spending_power: z.enum(['low', 'medium', 'high']),
    is_local: z.boolean(),
    is_returning: z.boolean(),
    has_prior_treatments: z.boolean(),
    summary: z.string().describe(
      'Max 50 words. Direct conclusions only. No "given your goal", no process explanation. ' +
      'Style: "Moderate spending power. Returning local client. Likely open to bundled upgrades."',
    ),
  }),
})

// ─── Minimal fast-path schemas ─────────────────────────────────────────────────

const patientSummaryOnlySchema = z.object({
  patientSummaryStructured: briefSchema.shape.patientSummaryStructured,
})

const additionalRecsReasonSchema = z.object({
  additionalRecommendations: z
    .array(z.object({
      name: z.string(),
      price: z.number(),
      description: z.string().describe('One direct sentence on clinical effect. No filler.'),
      duration: z.string().describe('How long results last, e.g. "3–6 months". REQUIRED — never empty.'),
      downtime: z.string().describe('Recovery time, e.g. "None", "1–2 days". REQUIRED — never empty.'),
    }))
    .min(1)
    .max(3),
})

const additionalRecsOnlySchema = z.object({
  additionalRecommendations: additionalRecsReasonSchema.shape.additionalRecommendations,
})

const beforeYouStepOutItemSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string().describe('One sentence on benefit. No filler.'),
})

const beforeYouStepOutSchema = z.object({
  beforeYouStepOut: z.array(beforeYouStepOutItemSchema).min(1).max(2),
})

const salesSchema = z.object({
  salesMethodology: z.object({
    comboSynergy: z.string(),
    treatmentEffectiveness: z.string(),
    campaignAndReferral: z.string(),
  }),
  salesMethodologyNew: z.object({
    patient_insight: z.array(z.string()).describe('2-3 sharp insights about this patient.'),
    sales_angles: z.array(z.string()).describe('2-3 actionable talking points for the consultant.'),
  }),
  additionalRecommendations: additionalRecsReasonSchema.shape.additionalRecommendations,
})

// ─── Helpers ───────────────────────────────────────────────────────────────────

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function toSummaryText(brief: z.infer<typeof briefSchema>['consultantBrief']): string {
  const localLabel =
    brief.referralAbility.isLocal === 'yes' ? 'Yes' :
    brief.referralAbility.isLocal === 'no' ? 'No' : 'Unknown'
  return [
    `Consumption capability: ${brief.consumptionCapability.score}/5 (Tier: ${brief.consumptionCapability.tier}) - ${brief.consumptionCapability.reason}`,
    `Long-term possibility (${brief.longTermPossibility.isReturning}): ${brief.longTermPossibility.score}/5 (Tier: ${brief.longTermPossibility.tier}) - ${brief.longTermPossibility.reason}`,
    `Referral ability (Local: ${localLabel}): ${brief.referralAbility.score}/5 (Tier: ${brief.referralAbility.tier}) - ${brief.referralAbility.reason}`,
  ].join('\n')
}

function priceSummary(t: ClinicMenuTreatment): string {
  if (t.pricing_model === 'table' && t.pricing_table) {
    const nums: number[] = []
    for (const row of t.pricing_table.rows)
      for (const v of Object.values(row.values))
        if (v != null) nums.push(v)
    if (nums.length) return `$${Math.min(...nums)}–$${Math.max(...nums)}`
  }
  if (t.pricing) {
    const p = t.pricing as Record<string, unknown>
    const v = p.single ?? p.perUnit ?? p.perSyringe ?? p.perSession
    if (v != null) return `$${v}`
  }
  return ''
}

function buildBriefPrompt(userInput: Record<string, unknown>): string {
  return `Generate the consultant brief using only provided data.
User info:
- Name: ${String(userInput.name || '—')}
- Age: ${String(userInput.age || '—')}
- Occupation: ${String(userInput.occupation || '—')}
- Goals: ${String(userInput.goals || '—')}
- Budget: ${String(userInput.budget ?? '—')}
- Experience: ${String(userInput.experience || '—')}
- Recovery preference: ${String(userInput.recovery || '—')}
- Customer status: ${String(userInput.clinicHistory || '—')}
- Local/NYC: ${String(userInput.isNYC ?? '—')}
- Referral: ${String(userInput.referral || '—')}`
}

function buildMenuContext(
  treatments: ClinicMenuTreatment[],
  excludedIds: Set<string>,
): string {
  return treatments
    .slice(0, 30)
    .filter((t) => !excludedIds.has(t.id))
    .map((t) => {
      const price = priceSummary(t)
      return `- ${t.name} (id:${t.id})${price ? `: ${price}` : ''}${t.description ? ` (${t.description})` : ''}`
    })
    .join('\n')
}

// ─── Exported types for frontend polling ──────────────────────────────────────

export type EnrichmentFields = {
  consultantBrief?: unknown
  consultantProfileSummary?: string
  patientSummaryStructured?: unknown
  salesMethodology?: unknown
  salesSentences?: unknown[]
  salesMethodologyNew?: unknown
  additionalRecommendations?: Array<{ name: string; price: number; description: string; duration: string; downtime: string }>
  beforeYouStepOut?: Array<{ name: string; price: number; description: string }>
  enriched_at?: string
}

// ─── Fast enrichment (runs synchronously in /api/new-report) ──────────────────

export async function generateFastEnrichment(
  clinicId: string,
  userInput: Record<string, unknown>,
  excludedTreatmentIds: Set<string>,
): Promise<{
  patientSummaryStructured: z.infer<typeof briefSchema>['patientSummaryStructured'] | null
  additionalRecommendations: Array<{ name: string; price: number; description: string; duration: string; downtime: string }>
  beforeYouStepOut: Array<{ name: string; price: number; description: string }>
}> {
  const briefPrompt = buildBriefPrompt(userInput)

  // Fetch menu in parallel with patient summary generation
  const menuPromise = resolveClinicMenu(clinicId).catch(() => ({ menu: { treatments: [] as ClinicMenuTreatment[] } }))

  const patientSummaryPromise = generateText({
    model: getLlunaAnthropicModel(),
    output: Output.object({ schema: patientSummaryOnlySchema }),
    system:
      'Return patientSummaryStructured only.\n' +
      '- spending_power: low (<$500 budget), medium ($500-$1200), high (>$1200).\n' +
      '- is_local: true if isNYC === true.\n' +
      '- is_returning: true if clinicHistory === "returning".\n' +
      '- has_prior_treatments: true if experience is "few" or "regular".\n' +
      '- summary: max 50 words. Direct conclusions only. No "given your goal", no explanatory language.',
    messages: [{ role: 'user', content: briefPrompt }],
  }).then((r) => r.output.patientSummaryStructured).catch(() => null)

  const additionalRecsPromise = menuPromise.then(({ menu }) => {
    const menuCtx = buildMenuContext(menu.treatments, excludedTreatmentIds)
    if (!menuCtx) return [] as Array<{ name: string; price: number; description: string; duration: string; downtime: string }>
    const userPrompt = `Patient data:
- Goals: ${String(userInput.goals || '—')}
- Budget: ${String(userInput.budget ?? '—')}
- Experience: ${String(userInput.experience || '—')}
- Recovery preference: ${String(userInput.recovery || '—')}

Available treatments (pick only from this list — do NOT recommend treatments already in their Essential/Optimal/Premium plans):
${menuCtx}

Return 2-3 additional treatment recommendations from the list above that complement their goals and budget. Pick items not already in their core plan.`
    return generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: additionalRecsOnlySchema }),
      system:
        'You are a medspa sales advisor. Return additionalRecommendations only. ' +
        'Use exact treatment names and prices from the provided list. No markdown, no emojis. ' +
        'Every item MUST include non-empty description, duration, and downtime fields.',
      messages: [{ role: 'user', content: userPrompt }],
    }).then((r) => r.output.additionalRecommendations).catch(() => [] as Array<{ name: string; price: number; description: string; duration: string; downtime: string }>)
  })

  const beforeYouStepOutPromise = menuPromise.then(({ menu }) => {
    const skincareCtx = buildMenuContext(menu.treatments, excludedTreatmentIds)
    if (!skincareCtx) return [] as Array<{ name: string; price: number; description: string }>
    const userPrompt = `Available clinic treatments:\n${skincareCtx}\n\nPatient goals: ${String(userInput.goals || '—')}`
    return generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: beforeYouStepOutSchema }),
      system:
        'You are a medspa retail advisor. Return beforeYouStepOut — exactly 2 skincare or cleansing add-ons from the menu above. ' +
        'RULES: Only pick items related to skincare, cleansing, facials, peels, or skin boosters. ' +
        'Price MUST be between $30 and $200 per session. ' +
        'Use exact names and prices from the provided list. No markdown, no emojis. ' +
        'If fewer than 2 suitable items exist in the menu, return what is available (minimum 1).',
      messages: [{ role: 'user', content: userPrompt }],
    }).then((r) => r.output.beforeYouStepOut).catch(() => [] as Array<{ name: string; price: number; description: string }>)
  })

  const [patientSummaryStructured, additionalRecommendations, beforeYouStepOut] = await Promise.all([
    patientSummaryPromise,
    additionalRecsPromise,
    beforeYouStepOutPromise,
  ])

  return {
    patientSummaryStructured: patientSummaryStructured ?? null,
    additionalRecommendations: additionalRecommendations ?? [],
    beforeYouStepOut: beforeYouStepOut ?? [],
  }
}

// ─── Main background worker ────────────────────────────────────────────────────

export async function enrichReportAsync(
  pendingReportId: string,
  clinicId: string,
  userInput: Record<string, unknown>,
  excludedTreatmentIds: Set<string> = new Set(),
): Promise<void> {
  const supabase = getServiceSupabase()
  if (!supabase) {
    console.warn('[enrichment] Supabase not available, skipping')
    return
  }

  const enrichmentFields: EnrichmentFields = {}
  const briefPrompt = buildBriefPrompt(userInput)

  // ── 1. Consultant Brief + Patient Summary ──────────────────────────────────
  try {
    const { output } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: briefSchema }),
      system:
        'You write consultant-facing CRM scoring notes and concise patient summaries.\n' +
        'Return consultantBrief AND patientSummaryStructured.\n' +
        'consultantBrief rules:\n' +
        '- consumptionCapability: score/tier/reason based on budget + occupation + treatment experience.\n' +
        '- longTermPossibility: score/tier/reason + isReturning based on new/returning status and repeat likelihood.\n' +
        '- referralAbility: score/tier/reason + isLocal based on local/NYC and referral signals.\n' +
        '- score must be integer 1-5. tier must be Premium, Mid, or Budget. reason concise and practical.\n' +
        'patientSummaryStructured rules:\n' +
        '- spending_power: low (<$500 budget), medium ($500-$1200), high (>$1200).\n' +
        '- is_local: true if isNYC === true.\n' +
        '- is_returning: true if clinicHistory === "returning".\n' +
        '- has_prior_treatments: true if experience is "few" or "regular".\n' +
        '- summary: max 50 words. Direct conclusions only. No "given your goal", no explanatory language.',
      messages: [{ role: 'user', content: briefPrompt }],
    })
    enrichmentFields.consultantBrief = output.consultantBrief
    enrichmentFields.patientSummaryStructured = output.patientSummaryStructured
    enrichmentFields.consultantProfileSummary = toSummaryText(output.consultantBrief)
  } catch (e) {
    console.error('[enrichment] consultant-brief failed:', e instanceof Error ? e.message : e)
    // Continue — sales methodology may still succeed
  }

  // ── 2. Fetch context for sales methodology ─────────────────────────────────
  let referBonusUsd: number | null = null
  let currentCampaign = 'No active campaign data available'
  let publicActivities = ''
  let menuContext = ''

  try {
    const { data: settings } = await supabase
      .from('clinic_settings')
      .select('refer_bonus_usd, public_activities')
      .eq('clinic_id', clinicId)
      .maybeSingle()
    if (settings?.refer_bonus_usd != null) referBonusUsd = Number(settings.refer_bonus_usd) || 0
    if (typeof settings?.public_activities === 'string') publicActivities = settings.public_activities.trim()

    const { data: latestCampaign } = await supabase
      .from('consultant_events')
      .select('payload')
      .eq('event_type', 'campaign_applied')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const cp = latestCampaign?.payload && typeof latestCampaign.payload === 'object'
      ? (latestCampaign.payload as Record<string, unknown>)
      : null
    if (cp) {
      const parts = [
        String(cp.title || '').trim(),
        String(cp.context || '').trim(),
        String(cp.startDate || '').trim() && String(cp.endDate || '').trim()
          ? `${cp.startDate} to ${cp.endDate}` : '',
      ].filter(Boolean)
      if (parts.length) currentCampaign = parts.join(' | ')
    }

    const { menu } = await resolveClinicMenu(clinicId)
    menuContext = buildMenuContext(menu.treatments, excludedTreatmentIds)
  } catch (e) {
    console.warn('[enrichment] context fetch partial failure:', e instanceof Error ? e.message : e)
  }

  // ── 3. Sales Methodology ───────────────────────────────────────────────────
  const salesPrompt = `Create sales methodology content for consultant use, based only on this lead data.
Lead data:
- Name: ${String(userInput.name || '—')}
- Age: ${String(userInput.age || '—')}
- Occupation: ${String(userInput.occupation || '—')}
- Goals: ${String(userInput.goals || '—')}
- Budget: ${String(userInput.budget ?? '—')}
- Experience: ${String(userInput.experience || '—')}
- Recovery preference: ${String(userInput.recovery || '—')}
- Customer status: ${String(userInput.clinicHistory || '—')}
- Local/NYC: ${String(userInput.isNYC ?? '—')}
- Referral contact: ${String(userInput.referral || '—')}
- Current campaign: ${currentCampaign}
- Referral discount (USD): ${referBonusUsd == null ? 'not configured' : `$${referBonusUsd}`}
${publicActivities ? `- Clinic activities/promotions: ${publicActivities}` : ''}

${menuContext ? `Available treatments (pick additionalRecommendations only from this list — exclude treatments already in their Essential/Optimal/Premium plans):\n${menuContext}` : ''}

Constraints:
- English only. salesMethodology each field 20-45 words. salesMethodologyNew items max 20-25 words each.
- No markdown, no emojis, no fake claims.`

  try {
    const { output } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: salesSchema }),
      system:
        'You are a medspa CRM sales coach. Return salesMethodology, salesMethodologyNew, and additionalRecommendations. ' +
        'salesMethodologyNew must be sharp and patient-specific. ' +
        'additionalRecommendations must use exact treatment names and prices from the provided menu. ' +
        'Every additionalRecommendations item MUST include non-empty description, duration, and downtime fields.',
      messages: [{ role: 'user', content: salesPrompt }],
    })
    enrichmentFields.salesMethodology = output.salesMethodology
    enrichmentFields.salesMethodologyNew = output.salesMethodologyNew
    enrichmentFields.additionalRecommendations = output.additionalRecommendations
    enrichmentFields.salesSentences = [
      { type: 'Combo synergy', text: output.salesMethodology.comboSynergy },
      { type: 'Treatment effectiveness', text: output.salesMethodology.treatmentEffectiveness },
      { type: 'Campaign + referral discount', text: output.salesMethodology.campaignAndReferral },
    ]
  } catch (e) {
    console.error('[enrichment] sales-methodology failed:', e instanceof Error ? e.message : e)
    // Continue — still write whatever brief data we got
  }

  // ── 4. Before You Step Out ────────────────────────────────────────────────
  try {
    const { menu } = await resolveClinicMenu(clinicId).catch(() => ({ menu: { treatments: [] as ClinicMenuTreatment[] } }))
    const skincareCtx = buildMenuContext(menu.treatments, excludedTreatmentIds)
    if (skincareCtx) {
      const { output } = await generateText({
        model: getLlunaAnthropicModel(),
        output: Output.object({ schema: beforeYouStepOutSchema }),
        system:
          'You are a medspa retail advisor. Return beforeYouStepOut — exactly 2 skincare or cleansing add-ons from the menu above. ' +
          'RULES: Only pick items related to skincare, cleansing, facials, peels, or skin boosters. ' +
          'Price MUST be between $30 and $200 per session. ' +
          'Use exact names and prices from the provided list. No markdown, no emojis. ' +
          'If fewer than 2 suitable items exist in the menu, return what is available (minimum 1).',
        messages: [{ role: 'user', content: `Available clinic treatments:\n${skincareCtx}` }],
      })
      enrichmentFields.beforeYouStepOut = output.beforeYouStepOut
    }
  } catch (e) {
    console.error('[enrichment] before-you-step-out failed:', e instanceof Error ? e.message : e)
  }

  // ── 5. Write enrichment to DB ──────────────────────────────────────────────
  // Nothing generated at all — no point writing
  if (!enrichmentFields.consultantBrief && !enrichmentFields.salesMethodology) {
    console.warn('[enrichment] both AI calls failed for report', pendingReportId)
    return
  }

  enrichmentFields.enriched_at = new Date().toISOString()

  // Fetch current row to merge (don't clobber non-enrichment fields)
  const { data: row } = await supabase
    .from('pending_reports')
    .select('report_data, session_id')
    .eq('id', pendingReportId)
    .maybeSingle()

  if (!row) {
    console.error('[enrichment] pending report not found:', pendingReportId)
    return
  }

  const rd = asRec(row.report_data)
  const rec = asRec(rd.recommendation)

  const mergedRec: Record<string, unknown> = {
    ...rec,
    ...(enrichmentFields.consultantBrief ? {
      consultantBrief: enrichmentFields.consultantBrief,
      consultantProfileSummary: enrichmentFields.consultantProfileSummary,
    } : {}),
    ...(enrichmentFields.patientSummaryStructured ? { patientSummaryStructured: enrichmentFields.patientSummaryStructured } : {}),
    ...(enrichmentFields.salesMethodology ? {
      salesMethodology: enrichmentFields.salesMethodology,
      salesSentences: enrichmentFields.salesSentences,
    } : {}),
    ...(enrichmentFields.salesMethodologyNew ? { salesMethodologyNew: enrichmentFields.salesMethodologyNew } : {}),
    // Only write additionalRecommendations if the fast path didn't already populate them
    ...(enrichmentFields.additionalRecommendations?.length &&
        !(Array.isArray(rec.additionalRecommendations) && (rec.additionalRecommendations as unknown[]).length > 0)
      ? { additionalRecommendations: enrichmentFields.additionalRecommendations } : {}),
    ...(enrichmentFields.beforeYouStepOut?.length ? { beforeYouStepOut: enrichmentFields.beforeYouStepOut } : {}),
    enriched_at: enrichmentFields.enriched_at,
  }

  const mergedRd: Record<string, unknown> = { ...rd, recommendation: mergedRec }

  const updatePayload: Record<string, unknown> = {
    report_data: mergedRd,
    updated_at: enrichmentFields.enriched_at,
  }
  if (enrichmentFields.consultantProfileSummary) {
    updatePayload.report_summary = enrichmentFields.consultantProfileSummary
  }

  const { error: pendingErr } = await supabase
    .from('pending_reports')
    .update(updatePayload)
    .eq('id', pendingReportId)
  if (pendingErr) console.error('[enrichment] pending_reports update error:', pendingErr.message)

  // Mirror to clients table
  const sessionId = typeof row.session_id === 'string' ? row.session_id : ''
  if (sessionId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('report_data')
      .eq('session_id', sessionId)
      .eq('clinic_id', clinicId)
      .maybeSingle()
    if (clientRow) {
      const clientRd = asRec(clientRow.report_data)
      const clientRec = asRec(clientRd.recommendation)
      const { error: clientErr } = await supabase
        .from('clients')
        .update({ report_data: { ...clientRd, recommendation: { ...clientRec, ...mergedRec } } })
        .eq('session_id', sessionId)
        .eq('clinic_id', clinicId)
      if (clientErr) console.warn('[enrichment] clients update error:', clientErr.message)
    }
  }
}
