import type { SpendingTier } from './data'

/**
 * Stated **per-visit** budget (e.g. questionnaire) → spending tier.
 * Keep in sync everywhere the dashboard shows Premium / Mid / Budget (and VIP → Premium badge).
 */
export function tierFromPerVisitBudget(b: number): SpendingTier {
  if (b >= 2000) return 'VIP'
  if (b >= 1000) return 'Premium'
  if (b >= 500) return 'Mid'
  return 'Budget'
}

/** Labels for Dynamic Pricing "By budget" — same thresholds as `tierFromPerVisitBudget`. */
export const PER_VISIT_PRICING_ROWS = [
  {
    key: 'premium',
    label: 'Premium',
    /** Applies to all clients with per-visit budget ≥ $1,000 (includes VIP at ≥ $2,000). */
    rangeShort: '≥ $1,000 / visit',
  },
  {
    key: 'mid',
    label: 'Mid',
    rangeShort: '$500 – $999 / visit',
  },
  {
    key: 'budget',
    label: 'Budget',
    rangeShort: '< $500 / visit',
  },
] as const
