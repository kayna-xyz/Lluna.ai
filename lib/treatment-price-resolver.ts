import type { ClinicMenuTreatment } from '@/lib/clinic-menu'
import { firstNumericPriceForTreatment } from '@/lib/recommend-menu'

/**
 * Deterministic price resolver. Reads structured menu pricing — never invents values.
 *
 * Simple pricing priority:
 *   perUnit × units → perSyringe × syringes → perSession → single → nested single (no packages)
 *
 * Table pricing priority (via firstNumericPriceForTreatment):
 *   firstTimer column → nonMember column → first non-package column
 *
 * Returns null if no price can be determined.
 */
export function resolveTreatmentCost(
  t: { treatmentId: string; units?: number | null; syringes?: number | null; sessions?: number | null },
  menuById: Map<string, ClinicMenuTreatment>,
): number | null {
  const menu = menuById.get(t.treatmentId)
  if (!menu) return null

  // Table pricing: delegate entirely to firstNumericPriceForTreatment (which applies column priority)
  if (menu.pricing_model === 'table' && menu.pricing_table) {
    const base = firstNumericPriceForTreatment(menu)
    return base > 0 ? base : null
  }

  // Simple pricing: apply quantity multipliers first, then base price
  const p = menu.pricing as Record<string, unknown> | undefined
  if (p) {
    if (typeof p.perUnit === 'number' && p.perUnit > 0 && t.units && t.units > 0) return p.perUnit * t.units
    if (typeof p.perSyringe === 'number' && p.perSyringe > 0 && t.syringes && t.syringes > 0) return p.perSyringe * t.syringes
    if (typeof p.perSession === 'number' && p.perSession > 0 && t.sessions && t.sessions > 0) return p.perSession * t.sessions
  }

  // Fall through to base price extraction (handles single + nested, skips packages)
  const base = firstNumericPriceForTreatment(menu)
  return base > 0 ? base : null
}

/**
 * Deterministic recovery (downtime) values by treatment type.
 * Source of truth: clinic protocol defaults.
 */
export const RECOVERY_RULES: [RegExp, string][] = [
  [/\b(filler|juvederm|restylane|voluma|syringe|ha filler)\b/i, '2–3 days'],
  [/\b(botox|toxin|neuromodulator|neurotoxin|dysport|xeomin)\b/i, '2 weeks'],
  [/\b(morpheus|rf microneedling|radiofrequency|co2|fractional|ultraformer|hifu|thermage)\b/i, '1–2 weeks'],
  [/\b(ipl|pico laser|picosecond|laser|fotona|energy|light)\b/i, '1–2 weeks'],
  [/\b(hydrafacial|facial|skin booster|cocktail microneedling|booster)\b/i, '0 days'],
]

/**
 * Aliases mapping name fragments → canonical treatment IDs in the default menu.
 * Used when the AI returns a name variant or abbreviated name.
 */
export const TREATMENT_NAME_ALIASES: [RegExp, string][] = [
  [/\b(botox|toxin|neuromodulator|dysport|xeomin)\b/i, 'toxin_botox'],
  [/\b(filler|juvederm ultra|restylane|ultra xc|lip filler)\b/i, 'filler_juvederm_ultra_xc_restylane'],
  [/\b(voluma|juvederm voluma|cheek filler|voluma xc)\b/i, 'juvederm_voluma_xc'],
  [/\b(hydrafacial|hydra facial|syndeo)\b/i, 'hydrafacial_syndeo'],
  [/\b(morpheus|rf microneedling|radiofrequency microneedling)\b/i, 'mophreus8_rf_microneedling'],
  [/\b(ipl|stellar m22|lumenis|photofacial)\b/i, 'ipl_stellar_m22_by_lumenis'],
  [/\b(pico laser|picosecond)\b/i, 'pico_laser'],
  [/\b(co2|co2 fractional|fractional resurfacing)\b/i, 'co2_fractional_resurfacing'],
  [/\b(ultraformer|7d facelift|hifu)\b/i, 'ultraformer_7d_facelift'],
  [/\b(fotona 4d|4d facelift)\b/i, 'fotona_4d_facelift'],
  [/\b(smootheye|smooth eye)\b/i, 'fotona_smoothEye'],
  [/\b(liplase|lip lase)\b/i, 'fotona_lipLase'],
  [/\b(fotona 6d|6d rejuvenation|full face rejuvenation)\b/i, 'fotona_6d_full_face_rejuvenation'],
  [/\b(cocktail|skin booster microneedling|booster microneedling)\b/i, 'cocktail_skin_booster_microneedling'],
  [/\b(accent|body contouring|alma accent)\b/i, 'alma_accent_body_contouring'],
  [/\b(chemical peel|vi peel|medical peel)\b/i, 'medical_grade_chemical_peel'],
]

/**
 * Resolve a treatment name variant to its canonical menu ID.
 * Checks: exact ID → exact name → alias table.
 * Returns null if no match found.
 */
export function resolveTreatmentIdByName(
  name: string,
  menuById: Map<string, ClinicMenuTreatment>,
): string | null {
  if (menuById.has(name)) return name
  const lower = name.toLowerCase()
  for (const [id, t] of menuById.entries()) {
    if (t.name.toLowerCase() === lower) return id
  }
  for (const [pattern, id] of TREATMENT_NAME_ALIASES) {
    if (pattern.test(name) && menuById.has(id)) return id
  }
  return null
}
