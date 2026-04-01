import { generateText, Output } from 'ai'
import { getLlunaAnthropicModel } from '@/lib/anthropic-model'
import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

const salesSchema = z.object({
  salesMethodology: z.object({
    comboSynergy: z.string().describe('How to explain combo synergy in one practical consultant sentence.'),
    treatmentEffectiveness: z
      .string()
      .describe('How to explain realistic treatment effectiveness and expected outcome trajectory.'),
    campaignAndReferral: z
      .string()
      .describe('How to connect current campaign and referral discount into the sales conversation.'),
  }),
})

function fallbackSales(ui: Record<string, unknown>) {
  const goal = String(ui.goals || 'your main skin goal')
  const budget = Number(ui.budget) || 0
  return {
    salesMethodology: {
      comboSynergy:
        `For ${goal}, position the plan as a sequence: direct treatment for the core issue, synergy treatment to stabilize and extend the result, then optional add-on only if value is clear.`,
      treatmentEffectiveness:
        `Frame effectiveness with realistic milestones: early visible change, then cumulative improvement over sessions, while staying aligned to the target budget around $${budget || 'N/A'}.`,
      campaignAndReferral:
        'Tie urgency to active campaign timing and mention referral discount as a practical benefit for trusted local contacts after visible progress.',
    },
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const reportData = asRec(body.reportData as Record<string, unknown>)
  const ui = asRec(reportData.userInput)
  if (!Object.keys(ui).length) {
    return Response.json({ error: 'reportData.userInput required' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  let referBonusUsd: number | null = null
  let currentCampaign = 'No active campaign data available'
  if (supabase) {
    const tenant = await resolveClinicForRequest(supabase, req, body)
    if (tenant.ok) {
      const { data: settings } = await supabase
        .from('clinic_settings')
        .select('refer_bonus_usd')
        .eq('clinic_id', tenant.clinic.id)
        .maybeSingle()
      if (settings?.refer_bonus_usd != null) {
        referBonusUsd = Number(settings.refer_bonus_usd) || 0
      }

      const { data: latestCampaign } = await supabase
        .from('consultant_events')
        .select('payload')
        .eq('event_type', 'campaign_applied')
        .eq('clinic_id', tenant.clinic.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const payload = (latestCampaign?.payload && typeof latestCampaign.payload === 'object'
        ? (latestCampaign.payload as Record<string, unknown>)
        : null)
      if (payload) {
        const title = String(payload.title || '').trim()
        const context = String(payload.context || '').trim()
        const start = String(payload.startDate || '').trim()
        const end = String(payload.endDate || '').trim()
        const parts = [title, context, start && end ? `${start} to ${end}` : ''].filter(Boolean)
        if (parts.length) currentCampaign = parts.join(' | ')
      }
    }
  }

  const prompt = `Create sales methodology content for consultant use, based only on this lead data.
Lead data:
- Name: ${String(ui.name || '—')}
- Age: ${String(ui.age || '—')}
- Occupation: ${String(ui.occupation || '—')}
- Goals: ${String(ui.goals || '—')}
- Budget: ${String(ui.budget ?? '—')}
- Experience: ${String(ui.experience || '—')}
- Recovery preference: ${String(ui.recovery || '—')}
- Customer status: ${String(ui.clinicHistory || '—')}
- Local/NYC: ${String(ui.isNYC ?? '—')}
- Referral contact: ${String(ui.referral || '—')}
- Current campaign: ${currentCampaign}
- Referral discount (USD): ${referBonusUsd == null ? 'not configured' : `$${referBonusUsd}`}

Constraints:
- English only, each field 20-45 words.
- Practical and natural for an in-person consultant conversation.
- No markdown, no emojis, no fake claims, no guarantees.
- Must be centered on exactly these three sections:
  1) comboSynergy,
  2) treatmentEffectiveness,
  3) campaignAndReferral.
- campaignAndReferral must explicitly mention both current campaign and referral discount context (or clearly state missing config if unavailable).`

  try {
    const { output } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: salesSchema }),
      system:
        'You are a medspa CRM sales coach. Return only salesMethodology with exactly three fields.',
      messages: [{ role: 'user', content: prompt }],
    })
    const method = output.salesMethodology
    return Response.json({
      salesMethodology: method,
      salesSentences: [
        { type: 'Combo synergy', text: method.comboSynergy },
        { type: 'Treatment effectiveness', text: method.treatmentEffectiveness },
        { type: 'Campaign + referral discount', text: method.campaignAndReferral },
      ],
    })
  } catch (e) {
    console.error('sales-methodology generate error:', e)
    const fb = fallbackSales(ui)
    return Response.json({
      salesMethodology: fb.salesMethodology,
      salesSentences: [
        { type: 'Combo synergy', text: fb.salesMethodology.comboSynergy },
        { type: 'Treatment effectiveness', text: fb.salesMethodology.treatmentEffectiveness },
        { type: 'Campaign + referral discount', text: fb.salesMethodology.campaignAndReferral },
      ],
    })
  }
}

