import { generateText, Output } from 'ai'
import { getLlunaAnthropicModel } from '@/lib/anthropic-model'
import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'
import { resolveClinicMenu } from '@/lib/menu-store'
import { buildFallbackRecommendationFromMenu, menuToMaps } from '@/lib/recommend-menu'
import type { ClinicMenuTreatment } from '@/lib/clinic-menu'
import { buildRecommendationSchemas, type RecommendationOutput } from '@/lib/recommend-schema'

const CONSULTANT_LEAD_PROFILE_DIRECTIVE =
  'Lead profile must be score-based: consumption capability, referral capability (with local context), and return probability.'

const consultantBriefSchema = z.object({
  consultantProfileSummary: z
    .string()
    .describe(
      'Internal CRM score note in English. Exactly 3 lines with X/5 ratings: consumption capability, referral capability (with Local Yes/No/Unknown), and return probability.',
    ),
})

function buildSurveyContext(input: {
  goals: string
  budgetNum: number
  experience: string | null
  recovery: string | null
  clinicHistory: string | null
  age: string | null
  occupation: string | null
  recentTreatments: string[]
  photo: boolean
  name?: string
  email?: string
  phone?: string
  referral?: string
  isNYC: boolean | null
}) {
  const experienceLabel =
    input.experience === 'first'
      ? 'First-timer'
      : input.experience === 'few'
        ? 'Some prior treatments'
        : input.experience === 'regular'
          ? 'Regular aesthetic client'
          : 'Unknown'

  return `Patient survey (structured):
- Goals: ${input.goals || '(none)'}
- Budget (visit): $${input.budgetNum}
- Experience: ${experienceLabel}
- Recovery preference: ${input.recovery === 'lunchtime' ? 'Minimal / lunchtime' : input.recovery === 'transformative' ? 'Accepts more downtime' : 'Not specified'}
- Clinic history (returning vs new): ${input.clinicHistory || 'Not specified'}
- Age: ${input.age || 'Not specified'}
- Occupation: ${input.occupation || 'Not specified'}
- Based in NYC (self-reported): ${input.isNYC === true ? 'Yes' : input.isNYC === false ? 'No' : 'Not specified'}
- Name on file: ${input.name || 'Not provided yet'}
- Email: ${input.email || 'Not provided'}
- Phone: ${input.phone || 'Not provided'}
- Referral field (friend phone for clinic outreach, if any): ${input.referral || 'None'}
- Recent treatments mentioned in text: ${input.recentTreatments.length ? input.recentTreatments.join(', ') : 'None'}
- Photo provided: ${input.photo ? 'Yes' : 'No'}`
}

function normalizeRecommendation(rec: RecommendationOutput, menuById: Map<string, ClinicMenuTreatment>) {
  const normalized = {
    ...rec,
    plans: rec.plans.map((plan) => ({
      ...plan,
      treatments: plan.treatments.map((t) => {
        const menu = menuById.get(t.treatmentId)
        if (!menu) throw new Error(`Unknown treatmentId: ${t.treatmentId}`)
        return { ...t, treatmentName: menu.name }
      }),
    })),
  }
  for (const plan of normalized.plans) {
    const roles = plan.treatments.map((t) => t.role)
    if (roles[0] !== 'direct' || roles[1] !== 'synergy' || roles[2] !== 'revenue') {
      throw new Error(`Invalid treatment role order for plan ${plan.name}`)
    }
  }
  return normalized
}

export async function POST(req: Request) {
  const body = await req.json()
  const {
    goals,
    budget,
    recovery,
    recentTreatments,
    photo,
    experience,
    clinicHistory,
    age,
    occupation,
    name,
    email,
    phone,
    referral,
    isNYC,
  } = body

  const supabase = getServiceSupabase()
  let menu: Awaited<ReturnType<typeof resolveClinicMenu>>['menu']

  if (!supabase) {
    const resolved = await resolveClinicMenu('')
    menu = resolved.menu
  } else {
    const resolved = await resolveClinicForRequest(supabase, req, body)
    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: resolved.status })
    }
    const { menu: m } = await resolveClinicMenu(resolved.clinic.id)
    menu = m
  }

  if (menu.treatments.length < 3) {
    return Response.json(
      {
        error: 'Clinic menu must include at least 3 treatments for AI recommendations.',
      },
      { status: 400 },
    )
  }

  const { menuById } = menuToMaps(menu)
  const { recommendationSchema } = buildRecommendationSchemas(menuById)

  const menuText = menu.treatments
    .map(
      (t) =>
        `- id: ${t.id}\n  name: ${t.name}\n  category: ${t.category}\n  description: ${t.description}\n  pricing: ${JSON.stringify(t.pricing)}`,
    )
    .join('\n')

  const budgetNum = Number(budget) || 500
  const rt: string[] = Array.isArray(recentTreatments) ? recentTreatments : []

  const surveyBlock = buildSurveyContext({
    goals: goals || '',
    budgetNum,
    experience: experience ?? null,
    recovery: recovery ?? null,
    clinicHistory: clinicHistory ?? null,
    age: age ?? null,
    occupation: occupation ?? null,
    recentTreatments: rt,
    photo: !!photo,
    name: name ?? '',
    email: email ?? '',
    phone: phone ?? '',
    referral: referral ?? '',
    isNYC: isNYC === true ? true : isNYC === false ? false : null,
  })

  const consultantSystem = `You are an internal CRM analyst for a medspa. Write ONLY consultantProfileSummary.

${CONSULTANT_LEAD_PROFILE_DIRECTIVE}

Rules:
- English only, plain text only, no markdown.
- Exactly 3 lines, each starts with the exact label:
  1) Consumption capability:
  2) Long-term possibility:
  3) Referral capability (Local: Yes/No/Unknown):
- Each line must contain an integer score X/5 and a tier in parentheses using exact words: Tier: Premium / Tier: Mid / Tier: Budget.
- Line 1 reason basis: budget + occupation + treatment experience.
- Line 2 reason basis: new/returning status + recovery preference + goals clarity.
- Line 3 reason basis: local/NYC status + referral field + social network signal.
- Keep each line concise (18-35 words).
- If data is missing, state it briefly, do not invent.`

  const patientSystem = `You are a deeply knowledgeable aesthetic medicine advisor — warm, direct, and on the patient's side. You MUST only recommend items from the UPLOADED CLINIC MENU below (exact ids/names/pricing from menu JSON).

STRICT GROUNDING:
1) Only menu treatments; never invent names or brands.
2) Use menu pricing for cost estimates; keep units/syringes/sessions clinically plausible.
3) Botox-type: prefer realistic unit ranges; if goals/photo don't support injectables, say so briefly in summary only (not in consultant-style third person — you are writing TO the patient in summary).
4) If confidence is low, say "more information needed in consultation" in the summary — do not guess wildly.
5) At most 3 treatments per plan as specified in schema.

THERAPEUTIC STYLE:
- No superlatives like "best" or "guaranteed"; use hedged clinical language.
- summary = patient-facing only (~70–80 words). Do NOT paste internal CRM notes into summary.
- skip / holdOffNote / safetyNote: each ONE short phrase (no multi-paragraph warnings).

OVERVIEW (summary):
Reference their goals (their words), budget, experience, 3-layer logic briefly. Sound like a brilliant friend. Forbidden phrases: "structured plans", "strict ordering".

MENU:
${menuText}

PLAN COST TARGETS (flex ±15%):
- Essential ≈ ${Math.round(budgetNum * 1.6)}, Optimal ≈ ${Math.round(budgetNum * 1.8)}, Premium ≈ ${Math.round(budgetNum * 2)}.`

  const patientUser = `${surveyBlock}

Return JSON only matching the schema: summary + 3 plans (Essential, Optimal, Premium) with exactly 3 treatments each (direct → synergy → revenue), plus skip, holdOffNote, safetyNote.`

  let consultantProfileSummary = ''

  try {
    const { output: brief } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: consultantBriefSchema }),
      system: consultantSystem,
      messages: [{ role: 'user', content: surveyBlock }],
    })
    consultantProfileSummary = brief.consultantProfileSummary
  } catch (e) {
    console.error('Consultant brief error:', e)
    consultantProfileSummary =
      '[Automated placeholder] Lead profile unavailable (AI error). Raw signals: ' +
      `budget $${budgetNum}; experience ${experience || 'n/a'}; goals excerpt: "${(goals || '').slice(0, 120)}".`
  }

  try {
    const { output } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: recommendationSchema }),
      system: patientSystem,
      messages: [{ role: 'user', content: patientUser }],
    })
    const normalized = normalizeRecommendation(output, menuById)
    return Response.json({
      recommendation: { ...normalized, consultantProfileSummary },
    })
  } catch (error) {
    console.error('AI recommendation error:', error)

    try {
      const fallback = buildFallbackRecommendationFromMenu(menu, {
        budgetNum,
        goals: goals || '',
        experience: experience as string | undefined,
        consultantProfileSummary,
      })
      return Response.json({ recommendation: fallback })
    } catch (e) {
      console.error('Fallback recommendation error:', e)
      return Response.json({ error: 'Failed to generate recommendation' }, { status: 500 })
    }
  }
}
