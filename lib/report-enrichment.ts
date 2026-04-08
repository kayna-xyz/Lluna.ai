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

// ─── Schemas ──────────────────────────────────────────────────────────────────

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
      'Max 50 words. Direct conclusions only. No "given your goal", no process explanation.',
    ),
  }),
})

const patientSummaryOnlySchema = z.object({
  patientSummaryStructured: briefSchema.shape.patientSummaryStructured,
})

// ─── Category recommendation schema (replaces additionalRecommendations + beforeYouStepOut) ──

const categoryTreatmentSchema = z.object({
  treatmentId: z.string(),
  treatmentName: z.string(),
  description: z.string().describe('One direct sentence on clinical effect. No filler.'),
  cost: z.number(),
  duration: z.string().describe('How long results last, e.g. "3–6 months". REQUIRED.'),
  downtime: z.string().describe('Recovery time, e.g. "None", "1–2 days". REQUIRED.'),
  units: z.number().nullable().optional(),
  syringes: z.number().nullable().optional(),
  sessions: z.number().nullable().optional(),
  fillerType: z.string().nullable().optional(),
})

const categoryRecsSchema = z.object({
  categoryRecommendations: z
    .array(z.object({
      name: z.string().describe('Category label e.g. "Filler", "Neurotoxin (Botox)", "Energy-based", "Skin Booster"'),
      treatments: z.array(categoryTreatmentSchema).min(2).max(3),
    }))
    .min(1)
    .max(5),
  zeroCostAddOns: z
    .array(z.object({
      treatmentId: z.string(),
      treatmentName: z.string(),
      description: z.string(),
      cost: z.number(),
    }))
    .min(0)
    .max(3),
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

function buildMenuContext(treatments: ClinicMenuTreatment[], excludedIds: Set<string>): string {
  return treatments
    .slice(0, 40)
    .filter((t) => !excludedIds.has(t.id))
    .map((t) => {
      const price = priceSummary(t)
      return `- id:${t.id} | ${t.name} | category:${t.category}${price ? ` | ${price}` : ''}${t.description ? ` | ${t.description.slice(0, 80)}` : ''}`
    })
    .join('\n')
}

// ─── Exported types ────────────────────────────────────────────────────────────

export type CategoryTreatment = {
  treatmentId: string
  treatmentName: string
  description: string
  cost: number
  duration: string
  downtime: string
  units?: number | null
  syringes?: number | null
  sessions?: number | null
  fillerType?: string | null
}

export type CategoryRecommendation = {
  name: string
  treatments: CategoryTreatment[]
}

export type ZeroCostAddOn = {
  treatmentId: string
  treatmentName: string
  description: string
  cost: number
}

export type EnrichmentFields = {
  consultantBrief?: unknown
  consultantProfileSummary?: string
  patientSummaryStructured?: unknown
  salesMethodology?: unknown
  salesSentences?: unknown[]
  salesMethodologyNew?: unknown
  categoryRecommendations?: CategoryRecommendation[]
  zeroCostAddOns?: ZeroCostAddOn[]
  enriched_at?: string
}

// ─── Fast enrichment (runs synchronously in /api/new-report) ──────────────────

export async function generateFastEnrichment(
  clinicId: string,
  userInput: Record<string, unknown>,
  recommendation: Record<string, unknown>,
): Promise<{
  patientSummaryStructured: z.infer<typeof briefSchema>['patientSummaryStructured'] | null
  categoryRecommendations: CategoryRecommendation[]
  zeroCostAddOns: ZeroCostAddOn[]
}> {
  const briefPrompt = buildBriefPrompt(userInput)

  const menuPromise = resolveClinicMenu(clinicId).catch(() => ({ menu: { treatments: [] as ClinicMenuTreatment[] } }))

  // ── Patient summary (unchanged) ────────────────────────────────────────────
  const patientSummaryPromise = generateText({
    model: getLlunaAnthropicModel(),
    output: Output.object({ schema: patientSummaryOnlySchema }),
    system:
      'Return patientSummaryStructured only.\n' +
      '- spending_power: low (<$500 budget), medium ($500-$1200), high (>$1200).\n' +
      '- is_local: true if isNYC === true.\n' +
      '- is_returning: true if clinicHistory === "returning".\n' +
      '- has_prior_treatments: true if experience is "few" or "regular".\n' +
      '- summary: max 50 words. Direct conclusions only.',
    messages: [{ role: 'user', content: briefPrompt }],
  }).then((r) => r.output.patientSummaryStructured).catch(() => null)

  // ── Category recommendations — inferred from existing combo plans ─────────
  const categoryRecsPromise = menuPromise.then(({ menu }) => {
    // Extract unique treatment names from plans for category inference
    const plans = Array.isArray(recommendation.plans)
      ? (recommendation.plans as Record<string, unknown>[])
      : []
    const comboNames: string[] = []
    for (const plan of plans) {
      const treatments = Array.isArray(plan.treatments)
        ? (plan.treatments as Record<string, unknown>[])
        : []
      for (const t of treatments) {
        const name = String(t.treatmentName || '').trim()
        if (name && !comboNames.includes(name)) comboNames.push(name)
      }
    }

    const menuCtx = buildMenuContext(menu.treatments, new Set())
    if (!menuCtx) return { categoryRecommendations: [] as CategoryRecommendation[], zeroCostAddOns: [] as ZeroCostAddOn[] }

    const comboText = comboNames.length > 0 ? comboNames.join(', ') : '(no combo data)'

    const prompt = `Internal combo treatments (use ONLY to infer categories — do NOT show to consultant):
${comboText}

Patient goals: ${String(userInput.goals || '—')}
Patient budget: $${String(userInput.budget ?? '—')}

CLINIC MENU (select STRICTLY from this list — copy id and name verbatim):
${menuCtx}

Return categoryRecommendations and zeroCostAddOns.`

    return generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: categoryRecsSchema }),
      system:
        'You are an aesthetic medicine specialist selecting treatment options for consultant review.\n\n' +
        'RULES — CRITICAL:\n' +
        '1. Every treatmentId and treatmentName MUST exactly match an entry in the clinic menu. Copy verbatim — no paraphrasing.\n' +
        '2. Cost MUST come from menu pricing. No invented prices. Use 0 if price is unavailable.\n' +
        '3. Infer 2–4 treatment CATEGORIES from the internal combo (e.g. "Filler", "Neurotoxin (Botox)", "Energy-based", "Skin Booster").\n' +
        '4. For each category, select 2–3 treatments from the menu that fit this patient\'s goals and budget.\n' +
        '5. zeroCostAddOns: 1–2 simple, easy-to-mention treatments (hydrafacial, cleansing facial, skin consultation add-on). Must be from menu.\n' +
        '6. duration and downtime: concise and non-empty (e.g. "3–6 months", "None", "1–2 days").',
      messages: [{ role: 'user', content: prompt }],
    }).then((r) => r.output).catch(() => ({ categoryRecommendations: [] as CategoryRecommendation[], zeroCostAddOns: [] as ZeroCostAddOn[] }))
  })

  const [patientSummaryStructured, categoryRecs] = await Promise.all([
    patientSummaryPromise,
    categoryRecsPromise,
  ])

  return {
    patientSummaryStructured: patientSummaryStructured ?? null,
    categoryRecommendations: categoryRecs.categoryRecommendations ?? [],
    zeroCostAddOns: categoryRecs.zeroCostAddOns ?? [],
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
        '- summary: max 50 words. Direct conclusions only.',
      messages: [{ role: 'user', content: briefPrompt }],
    })
    enrichmentFields.consultantBrief = output.consultantBrief
    enrichmentFields.patientSummaryStructured = output.patientSummaryStructured
    enrichmentFields.consultantProfileSummary = toSummaryText(output.consultantBrief)
  } catch (e) {
    console.error('[enrichment] consultant-brief failed:', e instanceof Error ? e.message : e)
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

Constraints:
- English only. salesMethodology each field 20-45 words. salesMethodologyNew items max 20-25 words each.
- No markdown, no emojis, no fake claims.`

  try {
    const { output } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: salesSchema }),
      system:
        'You are a medspa CRM sales coach. Return salesMethodology and salesMethodologyNew. ' +
        'salesMethodologyNew must be sharp and patient-specific.',
      messages: [{ role: 'user', content: salesPrompt }],
    })
    enrichmentFields.salesMethodology = output.salesMethodology
    enrichmentFields.salesMethodologyNew = output.salesMethodologyNew
    enrichmentFields.salesSentences = [
      { type: 'Combo synergy', text: output.salesMethodology.comboSynergy },
      { type: 'Treatment effectiveness', text: output.salesMethodology.treatmentEffectiveness },
      { type: 'Campaign + referral discount', text: output.salesMethodology.campaignAndReferral },
    ]
  } catch (e) {
    console.error('[enrichment] sales-methodology failed:', e instanceof Error ? e.message : e)
  }

  // ── 4. Write enrichment to DB ──────────────────────────────────────────────
  if (!enrichmentFields.consultantBrief && !enrichmentFields.salesMethodology) {
    console.warn('[enrichment] both AI calls failed for report', pendingReportId)
    return
  }

  enrichmentFields.enriched_at = new Date().toISOString()

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
