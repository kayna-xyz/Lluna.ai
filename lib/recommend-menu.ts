import type { ClinicMenu, ClinicMenuTreatment } from '@/lib/clinic-menu'


export function menuToMaps(menu: ClinicMenu) {
  const menuById = new Map(menu.treatments.map((t) => [t.id, t]))
  const nameSet = new Set(menu.treatments.map((t) => t.name))
  return { menuById, nameSet }
}

/** Pull first numeric price from nested simple pricing object.
 *  Returns 0 when no price is present — never invents a default price. */
export function firstNumericPrice(pricing: Record<string, unknown> | undefined): number {
  if (!pricing || typeof pricing !== 'object') return 0
  for (const v of Object.values(pricing)) {
    if (typeof v === 'number' && !Number.isNaN(v) && v > 0) return v
    if (v && typeof v === 'object') {
      const n = firstNumericPrice(v as Record<string, unknown>)
      if (n > 0) return n
    }
  }
  return 0
}

/** Returns the lowest explicitly-stored price for a treatment — used by fallback cost calc.
 *  For table items: minimum non-null cell value.
 *  For simple items: delegates to firstNumericPrice.
 *  Returns 0 when no price is present — never invents a value. */
export function firstNumericPriceForTreatment(t: ClinicMenuTreatment): number {
  if (t.pricing_model === 'table' && t.pricing_table) {
    let min = Infinity
    for (const row of t.pricing_table.rows)
      for (const v of Object.values(row.values))
        if (v != null && v > 0 && v < min) min = v
    return min === Infinity ? 0 : min
  }
  return firstNumericPrice(t.pricing as Record<string, unknown> | undefined)
}

/**
 * Returns a display price string for any treatment:
 * - simple / legacy: "$X/unit" style label from firstNumericPrice
 * - table: "$MIN – $MAX" from all cells, or "$X" if min===max, or null if no data
 *
 * Returns null when no price data is present (caller should show "Pricing varies").
 * Never invents or infers values.
 */
export function getPriceRangeForTreatment(t: ClinicMenuTreatment): string | null {
  if (t.pricing_model === 'table' && t.pricing_table) {
    const nums: number[] = []
    for (const row of t.pricing_table.rows)
      for (const v of Object.values(row.values))
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) nums.push(v)
    if (nums.length === 0) return null
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
    return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
  }
  // Simple / legacy
  const p = t.pricing as Record<string, unknown> | undefined
  if (!p) return null
  if (typeof p.perUnit === 'number' && p.perUnit > 0) return `$${Math.round(p.perUnit as number)}/unit`
  if (typeof p.perSyringe === 'number' && p.perSyringe > 0) return `$${Math.round(p.perSyringe as number)}/syringe`
  if (typeof p.single === 'number' && p.single > 0) return `$${Math.round(p.single as number)}`
  const first = firstNumericPrice(p)
  return first > 0 ? `$${Math.round(first)}` : null
}

export function treatmentFallbackRow(
  t: ClinicMenuTreatment,
  role: 'direct' | 'synergy' | 'revenue',
): {
  treatmentId: string
  treatmentName: string
  role: 'direct' | 'synergy' | 'revenue'
  description: string
  duration: string
  downtime: string
  units: number | null
  syringes: number | null
  sessions: number | null
  fillerType: string | null
  cost: number
} {
  const cost = firstNumericPriceForTreatment(t)
  // Do not invent dosage quantities — leave null when not in menu data.
  // The unit type tells us what the pricing unit is, but not how many are needed.
  const units: number | null = null
  const syringes: number | null = null
  const sessions: number | null = null
  return {
    treatmentId: t.id,
    treatmentName: t.name,
    role,
    description: `Listed in your clinic menu. Dosage and suitability to be confirmed in consultation.`,
    duration: "",
    downtime: "",
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
 * Grounding: uses only names and prices from menu data. Does not invent clinical logic.
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
    ? `Based on your goal ("${g.slice(0, 120)}${g.length > 120 ? '…' : ''}") and a budget around $${input.budgetNum}, these plans are drawn from the treatments in this clinic's menu. AI generation was unavailable — your consultant will review and personalise the selection in your session.`
    : 'These plans are drawn from the treatments in this clinic\'s menu. Ask your consultant to walk you through them.'

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
        'Starting point from clinic menu',
        essentialT,
        'Selected from the first available treatments in your clinic menu. Confirm suitability in consultation.',
        'Your consultant will assess whether these treatments work well together for your specific goals.',
      ),
      planFromTriple(
        'Optimal',
        'Mid-range option from clinic menu',
        optimalT,
        'Selected from the mid-range treatments in your clinic menu. Confirm suitability in consultation.',
        'Your consultant will assess whether these treatments work well together for your specific goals.',
      ),
      planFromTriple(
        'Premium',
        'Higher-investment option from clinic menu',
        premiumT,
        'Selected from the higher-priced treatments in your clinic menu. Confirm suitability in consultation.',
        'Your consultant will assess whether these treatments work well together for your specific goals.',
      ),
    ],
    skip: 'Confirm which treatments to defer with your consultant.',
    holdOffNote: 'Timing and sequencing to be confirmed in person.',
    safetyNote: 'Educational only — not medical advice.',
  }
}
