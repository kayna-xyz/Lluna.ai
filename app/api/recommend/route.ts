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
        return { ...t, treatmentName: menu.name, description: menu.description || '' }
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

  // Goal-based menu filtering — only affects what the AI sees, not schema validation
  const goalsLower = (goals || '').toLowerCase()
  const FACE_SIGNALS = ['slim', 'face', 'lift', 'contour', 'jaw', 'nose', 'wrinkle', 'volume', 'filler', 'botox', 'skin', 'glow', 'pore', 'acne', 'anti-aging', 'forehead', 'cheek', 'chin', 'eye', 'neck', 'sculpt']
  const BODY_SIGNALS = ['leg', 'arm', 'stomach', 'back', 'body', 'hair removal', 'bikini', 'underarm', 'chest hair', 'laser hair']
  const BODY_CATEGORY_EXCLUDE = ['hair removal', 'body', 'laser hair removal']
  const hasFaceSignal = FACE_SIGNALS.some((kw) => goalsLower.includes(kw))
  const hasBodySignal = BODY_SIGNALS.some((kw) => goalsLower.includes(kw))
  const filteredTreatments = hasFaceSignal && !hasBodySignal
    ? menu.treatments.filter((t) => !BODY_CATEGORY_EXCLUDE.some((ex) => t.category.toLowerCase().includes(ex)))
    : menu.treatments

  const menuText = filteredTreatments
    .map((t) => {
      const base = `- id: ${t.id}\n  name: ${t.name}\n  category: ${t.category}\n  description: ${t.description}`
      if (t.pricing_model === 'table' && t.pricing_table) {
        const pt = t.pricing_table
        const nums: number[] = []
        const tableLines = pt.rows.map((r) => {
          const vals = pt.columns.map((c) => {
            const v = r.values[c]
            if (v != null) nums.push(v)
            return v != null ? `${c}: $${v}` : `${c}: n/a`
          }).join(', ')
          return `    ${r.label}: ${vals}`
        }).join('\n')
        const rangeNote = nums.length > 0
          ? ` (range $${Math.min(...nums)} – $${Math.max(...nums)})`
          : ''
        return `${base}\n  pricing_model: table${rangeNote}\n  pricing_table:\n${tableLines}`
      }
      return `${base}\n  pricing: ${JSON.stringify(t.pricing ?? {})}`
    })
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

  const patientSystem = `You are an aesthetic medicine advisor writing to the patient. You MUST only recommend treatments from the CLINIC MENU listed below. Use only the exact ids, names, and pricing from that menu — nothing else.

TREATMENT REASON FORMAT — MANDATORY for every treatment:
- reason field must be exactly 2 lines separated by \\n.
- Line 1: one direct sentence explaining the clinical effect for THIS patient's specific goal. No filler ("based on your goals", "given that", "as a complement"). No reference to other treatments in the plan.
- Line 2: exactly "Duration: X | Downtime: X | Repeat: X" with a concise real value per tag.
- Do NOT duplicate sentences across treatments within the same plan.
- Do NOT include companion-treatment or synergy notes in reason.


STRICT GROUNDING — MANDATORY:
1) Only recommend treatments whose id and name appear verbatim in the MENU below. Never invent names, brand names, or treatments not in the menu.
2) Use only the pricing values shown in the MENU. Do not invent prices.
3) Do not mention any brand, product, or treatment name in any output field (reason, whyThisPlan, synergyNote, summary) that does not appear explicitly in the MENU.
4) If the menu does not contain a treatment that would be clinically ideal, pick the closest available option from the menu and note the limitation in whyThisPlan. Do not invent a substitute.
5) If menu data for a treatment is sparse (missing description, price, or category), reflect that sparseness — do not fill in details. Prefer honest incompleteness over fabricated detail.
6) If confidence is low, write "more information needed in consultation" — do not guess.

TREATMENT SELECTION LOGIC — apply in this order for each plan:
1. DIRECT (role: 'direct'): The treatment from the MENU that most directly addresses the patient's stated concern.
2. SYNERGY (role: 'synergy'): A treatment from the MENU that enhances or prolongs the effect of the first. Must be justified by what the menu offers — not a generic upsell.
3. REVENUE (role: 'revenue'): One lower-cost treatment from the MENU that adds value without significantly raising total cost.

Do NOT recommend treatments the patient has done in the last 3 months unless they explicitly ask for a repeat.

THERAPEUTIC STYLE:
- No superlatives like "best" or "guaranteed"; use hedged clinical language.
- summary = patient-facing only (~70–80 words). Do NOT paste internal CRM notes into summary.
- skip / holdOffNote / safetyNote: each ONE short phrase (no multi-paragraph warnings).

OVERVIEW (summary) — ~70-80 words, warm second-person:
1. Directly tell the patient WHY the recommended combination from this menu works for their specific goal.
2. Reference their exact words/goal from the form.
3. End with one line inviting them to discuss with their consultant to finalize timing and dosage.
4. Use only treatment names that appear in the MENU below.
Forbidden: "structured plans", "strict ordering", "conservative path", "3-layer", "direct → synergy". Never describe the recommendation process — only describe the outcome for the patient.

MENU:
${menuText}

GROUNDING VERIFICATION — MANDATORY before outputting:
1. Every treatmentId and treatmentName MUST exactly match an entry in the MENU above. Copy them verbatim — no paraphrasing, no invented names, no brand substitutions.
2. Every cost value MUST be derived from the pricing field in the MENU. For per-unit pricing (e.g. perUnit: 14), multiply by a clinically plausible unit count. For single-session pricing, use the exact number.
3. Do NOT recommend any treatment not in the MENU above, even if clinically ideal.
4. The three plans MUST have meaningfully different totalCost values: Essential < Optimal < Premium. Same price across plans is an error.
5. Verify: does the sum of treatment costs equal totalCost? If not, correct it.

PLAN COST TARGETS — MANDATORY:
- Essential: total cost MUST be between $${Math.round(budgetNum * 1.35)} and $${Math.round(budgetNum * 1.65)}
- Optimal: total cost MUST be between $${Math.round(budgetNum * 1.8)} and $${Math.round(budgetNum * 2.2)}
- Premium: total cost MUST be between $${Math.round(budgetNum * 2.2)} and $${Math.round(budgetNum * 2.8)}

If menu options are limited and targets cannot be met, pick the closest available and explain in whyThisPlan.`

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

  const essentialRange = { min: budgetNum * 1.35, max: budgetNum * 1.65 }
  const optimalRange  = { min: budgetNum * 1.8,  max: budgetNum * 2.2  }
  const premiumRange  = { min: budgetNum * 2.2,  max: budgetNum * 2.8  }

  function plansAreCollapsed(plans: RecommendationOutput['plans']): boolean {
    if (plans.length < 3) return false
    const costs = plans.map((p) => p.totalCost)
    const maxCost = Math.max(...costs)
    const minCost = Math.min(...costs)
    return maxCost === 0 || (maxCost - minCost) / maxCost < 0.2
  }

  console.log("=== RECOMMEND DEBUG ===")
  console.log("BUDGET:", budgetNum)
  console.log("GOAL:", body.goals || body.demand || body.concern)
  console.log("MENU AFTER FILTER:", filteredTreatments?.map(t => t.name) ?? menu.treatments.map(t => t.name))

  try {
    const { output } = await generateText({
      model: getLlunaAnthropicModel(),
      output: Output.object({ schema: recommendationSchema }),
      system: patientSystem,
      messages: [{ role: 'user', content: patientUser }],
    })
    console.log("AI PLANS:", JSON.stringify(output.plans.map(p => ({ name: p.name, total: p.totalCost }))))
    console.log("=== END DEBUG ===")
    let normalized = normalizeRecommendation(output, menuById)

    if (plansAreCollapsed(normalized.plans)) {
      const retryUserMsg = `${patientUser}

IMPORTANT: Your previous response had all 3 plans at similar price points. Essential MUST be ~$${Math.round(budgetNum * 1.5)}, Optimal MUST be ~$${Math.round(budgetNum * 2)}, Premium MUST be ~$${Math.round(budgetNum * 2.5)}. Please regenerate with correct price tiers.`

      try {
        const { output: retryOutput } = await generateText({
          model: getLlunaAnthropicModel(),
          output: Output.object({ schema: recommendationSchema }),
          system: patientSystem,
          messages: [{ role: 'user', content: retryUserMsg }],
        })
        const retryNormalized = normalizeRecommendation(retryOutput, menuById)
        if (plansAreCollapsed(retryNormalized.plans)) {
          retryNormalized.summary += ' Note: limited menu options near your budget — consultant will adjust in session.'
        }
        normalized = retryNormalized
      } catch {
        // retry failed — keep original, append note
        normalized.summary += ' Note: limited menu options near your budget — consultant will adjust in session.'
      }
    }

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
