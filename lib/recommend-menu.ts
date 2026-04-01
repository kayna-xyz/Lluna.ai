import type { ClinicMenu, ClinicMenuTreatment } from '@/lib/clinic-menu'

export function menuToMaps(menu: ClinicMenu) {
  const menuById = new Map(menu.treatments.map((t) => [t.id, t]))
  const nameSet = new Set(menu.treatments.map((t) => t.name))
  return { menuById, nameSet }
}

/** Pull first numeric price from nested pricing object (menu JSON varies by clinic). */
export function firstNumericPrice(pricing: Record<string, unknown> | undefined): number {
  if (!pricing || typeof pricing !== 'object') return 299
  for (const v of Object.values(pricing)) {
    if (typeof v === 'number' && !Number.isNaN(v) && v > 0) return v
    if (v && typeof v === 'object') {
      const n = firstNumericPrice(v as Record<string, unknown>)
      if (n > 0 && n !== 299) return n
    }
  }
  return 299
}

export function treatmentFallbackRow(
  t: ClinicMenuTreatment,
  role: 'direct' | 'synergy' | 'revenue',
): {
  treatmentId: string
  treatmentName: string
  role: 'direct' | 'synergy' | 'revenue'
  reason: string
  units: number | null
  syringes: number | null
  sessions: number | null
  fillerType: string | null
  cost: number
} {
  const cost = firstNumericPrice(t.pricing as Record<string, unknown> | undefined)
  let units: number | null = null
  let syringes: number | null = null
  let sessions: number | null = null
  if (t.units === 'unit') units = 60
  else if (t.units === 'syringe') syringes = 1
  else sessions = 1
  return {
    treatmentId: t.id,
    treatmentName: t.name,
    role,
    reason: `Selected from your clinic menu (${role}). Confirm details in person.`,
    units,
    syringes,
    sessions,
    fillerType: null,
    cost,
  }
}

type PlanRow = ReturnType<typeof treatmentFallbackRow>

function planFromTriple(
  name: string,
  tagline: string,
  triple: [ClinicMenuTreatment, ClinicMenuTreatment, ClinicMenuTreatment],
  why: string,
  synergy: string,
): {
  name: string
  tagline: string
  treatments: PlanRow[]
  totalCost: number
  savings: number
  whyThisPlan: string
  synergyNote: string
} {
  const treatments: PlanRow[] = [
    treatmentFallbackRow(triple[0], 'direct'),
    treatmentFallbackRow(triple[1], 'synergy'),
    treatmentFallbackRow(triple[2], 'revenue'),
  ]
  const totalCost = treatments.reduce((s, x) => s + x.cost, 0)
  return {
    name,
    tagline,
    treatments,
    totalCost,
    savings: 0,
    whyThisPlan: why,
    synergyNote: synergy,
  }
}

/**
 * When AI fails, build three plans from the resolved clinic menu (no hardcoded treatment ids).
 */
export function buildFallbackRecommendationFromMenu(
  menu: ClinicMenu,
  input: {
    budgetNum: number
    goals: string
    experience: string | undefined
    consultantProfileSummary: string
  },
): {
  summary: string
  consultantProfileSummary: string
  plans: ReturnType<typeof planFromTriple>[]
  skip: string
  holdOffNote: string
  safetyNote: string
} {
  const { treatments } = menu
  const n = treatments.length
  if (n < 3) {
    throw new Error('Clinic menu must include at least 3 treatments')
  }

  const g = input.goals || ''
  const fallbackSummary = g
    ? `Based on what you shared about "${g.slice(0, 120)}${g.length > 120 ? '…' : ''}" and your around-$${input.budgetNum} budget, we sketched a conservative path: address your main concern first, add something that helps results last, then an optional glow step if you want.${input.experience === 'first' ? ' Since this may be your first visit, we are keeping the plan approachable.' : ''} Skip rushing multiple aggressive services the same week—your provider will tailor timing.`
    : 'Your plan is ready. Ask your consultant to walk you through it.'

  const essentialT = [treatments[0], treatments[1], treatments[2]] as [
    ClinicMenuTreatment,
    ClinicMenuTreatment,
    ClinicMenuTreatment,
  ]
  const optimalT =
    n >= 6
      ? ([treatments[2], treatments[3], treatments[4]] as [
          ClinicMenuTreatment,
          ClinicMenuTreatment,
          ClinicMenuTreatment,
        ])
      : n >= 4
        ? ([treatments[1], treatments[2], treatments[3]] as [
            ClinicMenuTreatment,
            ClinicMenuTreatment,
            ClinicMenuTreatment,
          ])
        : essentialT
  const premiumT = [
    treatments[Math.max(0, n - 3)],
    treatments[Math.max(0, n - 2)],
    treatments[Math.max(0, n - 1)],
  ] as [ClinicMenuTreatment, ClinicMenuTreatment, ClinicMenuTreatment]

  return {
    summary: fallbackSummary,
    consultantProfileSummary: input.consultantProfileSummary,
    plans: [
      planFromTriple(
        'Essential',
        'Direct fix + glow add-ons',
        essentialT,
        'Covers a common first path when AI generation fails—confirm in clinic.',
        'Neurotoxin plus skin-quality support when appropriate.',
      ),
      planFromTriple(
        'Optimal',
        'Balanced upgrade',
        optimalT,
        'Adds surface renewal on top of core injectable + booster logic.',
        'Sequence and candidacy must be confirmed in person.',
      ),
      planFromTriple(
        'Premium',
        'Higher-intensity option',
        premiumT,
        'Shows a higher-investment anchor; validate medical fit in clinic.',
        'Energy and injectable timing must follow your provider’s protocol.',
      ),
    ],
    skip: 'Defer aggressive stacking until reviewed in person.',
    holdOffNote: 'Confirm order/timing with your provider.',
    safetyNote: 'Educational only—not medical advice.',
  }
}
