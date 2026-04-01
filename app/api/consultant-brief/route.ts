import { generateText, Output } from 'ai'
import { getLumeAnthropicModel } from '@/lib/anthropic-model'
import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

const briefSectionSchema = z.object({
  score: z.number().int().min(1).max(5),
  tier: z.enum(['Premium', 'Mid', 'Budget']),
  reason: z.string(),
})

const briefSchema = z.object({
  consultantBrief: z.object({
    consumptionCapability: briefSectionSchema,
    longTermPossibility: briefSectionSchema.extend({
      isReturning: z.enum(['returning', 'new', 'unknown']),
    }),
    referralAbility: briefSectionSchema.extend({
      isLocal: z.enum(['yes', 'no', 'unknown']),
    }),
  }),
})

function fallbackBrief(ui: Record<string, unknown>) {
  const budget = Number(ui.budget) || 0
  const isLocal = ui.isNYC === true ? 'yes' : ui.isNYC === false ? 'no' : 'unknown'
  const consumptionScore = budget >= 1600 ? 5 : budget >= 1000 ? 4 : budget >= 600 ? 3 : budget >= 300 ? 2 : 1
  const consumptionTier = consumptionScore >= 4 ? 'Premium' : consumptionScore === 3 ? 'Mid' : 'Budget'
  const referralScore = isLocal === 'yes' ? 4 : isLocal === 'no' ? 2 : 3
  const referralTier = referralScore >= 4 ? 'Premium' : referralScore === 3 ? 'Mid' : 'Budget'
  const status = ui.clinicHistory === 'returning' ? 'returning' : ui.clinicHistory === 'new' ? 'new' : 'unknown'
  const returnScore = status === 'returning' ? 4 : status === 'new' ? 3 : 2
  return {
    consultantBrief: {
      consumptionCapability: {
        score: consumptionScore,
        tier: consumptionTier as 'Premium' | 'Mid' | 'Budget',
        reason: `Budget signal ${budget ? `$${budget}` : 'missing'} with current profile context.`,
      },
      longTermPossibility: {
        score: returnScore,
        tier: returnScore >= 4 ? 'Premium' : returnScore === 3 ? 'Mid' : 'Budget',
        reason: `Customer status is ${status}; follow-up potential estimated from available signals.`,
        isReturning: status as 'returning' | 'new' | 'unknown',
      },
      referralAbility: {
        score: referralScore,
        tier: referralTier as 'Premium' | 'Mid' | 'Budget',
        reason: `Local signal is ${isLocal}; referral-network evidence is limited.`,
        isLocal: isLocal as 'yes' | 'no' | 'unknown',
      },
    },
  }
}

function toSummaryText(brief: z.infer<typeof briefSchema>['consultantBrief']) {
  const localLabel =
    brief.referralAbility.isLocal === 'yes'
      ? 'Yes'
      : brief.referralAbility.isLocal === 'no'
        ? 'No'
        : 'Unknown'
  return [
    `Consumption capability: ${brief.consumptionCapability.score}/5 (Tier: ${brief.consumptionCapability.tier}) - ${brief.consumptionCapability.reason}`,
    `Long-term possibility (${brief.longTermPossibility.isReturning}): ${brief.longTermPossibility.score}/5 (Tier: ${brief.longTermPossibility.tier}) - ${brief.longTermPossibility.reason}`,
    `Referral ability (Local: ${localLabel}): ${brief.referralAbility.score}/5 (Tier: ${brief.referralAbility.tier}) - ${brief.referralAbility.reason}`,
  ].join('\n')
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const reportData = asRec(body.reportData as Record<string, unknown>)
  const ui = asRec(reportData.userInput)

  if (!Object.keys(ui).length) {
    return Response.json({ error: 'reportData.userInput required' }, { status: 400 })
  }

  const prompt = `Generate the consultant brief using only provided data.
User info:
- Name: ${String(ui.name || '—')}
- Age: ${String(ui.age || '—')}
- Occupation: ${String(ui.occupation || '—')}
- Goals: ${String(ui.goals || '—')}
- Budget: ${String(ui.budget ?? '—')}
- Experience: ${String(ui.experience || '—')}
- Recovery preference: ${String(ui.recovery || '—')}
- Customer status: ${String(ui.clinicHistory || '—')}
- Local/NYC: ${String(ui.isNYC ?? '—')}
- Referral: ${String(ui.referral || '—')}
- Contact email: ${String(ui.email || '—')}
- Contact phone: ${String(ui.phone || '—')}`

  let consultantBrief: z.infer<typeof briefSchema>['consultantBrief']
  let consultantProfileSummary = ''
  try {
    const { output } = await generateText({
      model: getLumeAnthropicModel(),
      output: Output.object({ schema: briefSchema }),
      system:
        'You write consultant-facing CRM scoring notes.\n' +
        'Return only consultantBrief object.\n' +
        'Rules:\n' +
        '- consumptionCapability: score/tier/reason based on budget + occupation + treatment experience.\n' +
        '- longTermPossibility: score/tier/reason + isReturning based on new/returning status and repeat likelihood.\n' +
        '- referralAbility: score/tier/reason + isLocal based on local/NYC and referral signals.\n' +
        '- score must be integer 1-5.\n' +
        '- tier must be Premium, Mid, or Budget.\n' +
        '- reason should be concise and practical.',
      messages: [{ role: 'user', content: prompt }],
    })
    consultantBrief = output.consultantBrief
    consultantProfileSummary = toSummaryText(consultantBrief)
  } catch (e) {
    console.error('consultant-brief generate error:', e)
    const fb = fallbackBrief(ui)
    consultantBrief = fb.consultantBrief
    consultantProfileSummary = toSummaryText(consultantBrief)
  }

  if (sessionId) {
    const supabase = getServiceSupabase()
    if (supabase) {
      const tenant = await resolveClinicForRequest(supabase, req, body)
      if (tenant.ok) {
        const { data: latestPending } = await supabase
          .from('pending_reports')
          .select('id, report_data')
          .eq('clinic_id', tenant.clinic.id)
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestPending?.id) {
          const rd = asRec(latestPending.report_data)
          const rec = asRec(rd.recommendation)
          const mergedReportData = {
            ...rd,
            recommendation: {
              ...rec,
              consultantProfileSummary,
              consultantBrief,
            },
          }
          const { error } = await supabase
            .from('pending_reports')
            .update({
              report_summary: consultantProfileSummary,
              report_data: mergedReportData as unknown as Record<string, unknown>,
            })
            .eq('id', latestPending.id as string)
          if (error) console.error('consultant-brief pending update error:', error)
        }
      }
    }
  }

  return Response.json({ consultantProfileSummary, consultantBrief })
}

