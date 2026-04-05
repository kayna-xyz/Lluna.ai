import { generateText, Output } from 'ai'
import { getLlunaAnthropicModel } from '@/lib/anthropic-model'
import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'
import { resolveClinicMenu } from '@/lib/menu-store'

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
  salesMethodologyNew: z.object({
    patient_insight: z
      .array(z.string())
      .describe('2-3 sharp insights about this specific patient: their motivation, budget signal, or visit pattern. Each item max 20 words.'),
    sales_angles: z
      .array(z.string())
      .describe('2-3 concrete talking points the consultant should use in this conversation. Action-oriented, personalized. Each item max 25 words.'),
  }),
  additionalRecommendations: z
    .array(
      z.object({
        name: z.string().describe('Exact treatment name from the menu'),
        price: z.number().describe('Suggested price in USD, must match or be close to menu price'),
        reason: z.string().describe('Why this treatment fits this patient. Max 20 words.'),
      }),
    )
    .min(1)
    .max(3)
    .describe('1-3 high-value add-on or upsell treatments from the menu that fit this patient profile and goals.'),
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
    salesMethodologyNew: {
      patient_insight: ['Budget and goals suggest moderate-to-high spending willingness.', 'Profile indicates openness to multi-step treatment plans.'],
      sales_angles: ['Anchor on visible results within first two sessions.', 'Bundle savings as a natural upgrade, not an upsell.'],
    },
    additionalRecommendations: [],
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
  let publicActivities = ''
  let menuContext = ''
  let clinicIdForMenu = typeof body.clinicId === 'string' ? body.clinicId.trim() : ''

  if (supabase) {
    const tenant = await resolveClinicForRequest(supabase, req, body)
    if (tenant.ok) {
      if (!clinicIdForMenu) clinicIdForMenu = tenant.clinic.id

      const { data: settings } = await supabase
        .from('clinic_settings')
        .select('refer_bonus_usd, public_activities')
        .eq('clinic_id', tenant.clinic.id)
        .maybeSingle()
      if (settings?.refer_bonus_usd != null) {
        referBonusUsd = Number(settings.refer_bonus_usd) || 0
      }
      if (settings?.public_activities && typeof settings.public_activities === 'string') {
        publicActivities = settings.public_activities.trim()
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

  // Fetch menu for grounding additionalRecommendations
  if (clinicIdForMenu) {
    try {
      const { menu } = await resolveClinicMenu(clinicIdForMenu)
      const lines = menu.treatments
        .slice(0, 30)
        .map((t) => `- ${t.name}: $${t.price}${t.description ? ` (${t.description})` : ''}`)
      menuContext = lines.join('\n')
    } catch {
      menuContext = ''
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
${publicActivities ? `- Clinic activities/promotions: ${publicActivities}` : ''}

${menuContext ? `Available treatments (for additionalRecommendations, pick only from this list):\n${menuContext}` : ''}

Constraints:
- English only.
- salesMethodology: each field 20-45 words. Practical for in-person consultant conversation.
- salesMethodologyNew.patient_insight: 2-3 items, each max 20 words, specific to this patient.
- salesMethodologyNew.sales_angles: 2-3 items, each max 25 words, actionable and personalized.
- additionalRecommendations: 1-3 items from the menu above that complement the patient's goals and budget headroom.
- No markdown, no emojis, no fake claims, no guarantees.`

  try {
    const { output } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: salesSchema }),
      system:
        'You are a medspa CRM sales coach. Return salesMethodology, salesMethodologyNew, and additionalRecommendations. ' +
        'salesMethodologyNew must be sharp, patient-specific observations and talking points. ' +
        'additionalRecommendations must be grounded in the provided menu — use exact treatment names and realistic prices.',
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
      salesMethodologyNew: output.salesMethodologyNew,
      additionalRecommendations: output.additionalRecommendations,
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
      salesMethodologyNew: fb.salesMethodologyNew,
      additionalRecommendations: fb.additionalRecommendations,
    })
  }
}
