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

  // Simple pricing: quantity multipliers first, then base price
  const p = menu.pricing as Record<string, unknown> | undefined
  if (p) {
    if (typeof p.perUnit === 'number' && p.perUnit > 0 && t.units && t.units > 0) return p.perUnit * t.units
    if (typeof p.perSyringe === 'number' && p.perSyringe > 0 && t.syringes && t.syringes > 0) return p.perSyringe * t.syringes
    if (typeof p.perSession === 'number' && p.perSession > 0 && t.sessions && t.sessions > 0) return p.perSession * t.sessions
  }

  // Fall through: single / nested single (skips packages) via firstNumericPriceForTreatment
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

export type FixedMetadata = {
  recovery_period_days: number
  effect_duration_months: number
}

/**
 * Authoritative numeric metadata for well-known treatment types.
 * These values always override AI inference — they are clinical protocol defaults.
 * Order matters: more specific patterns must come before broader ones.
 */
export const FIXED_METADATA_RULES: { pattern: RegExp; recovery_period_days: number; effect_duration_months: number }[] = [
  // Neuromodulators
  { pattern: /\b(botox|dysport|xeomin|toxin|neuromodulator|neurotoxin)\b/i,           recovery_period_days: 14, effect_duration_months: 4 },
  // Long-lasting fillers (check before generic filler)
  { pattern: /\b(sculptra)\b/i,                                                         recovery_period_days: 3,  effect_duration_months: 24 },
  { pattern: /\b(radiesse)\b/i,                                                         recovery_period_days: 3,  effect_duration_months: 12 },
  { pattern: /\b(voluma|cheek filler)\b/i,                                              recovery_period_days: 3,  effect_duration_months: 18 },
  // HA fillers
  { pattern: /\b(filler|juvederm|restylane|syringe|ha filler|lip filler)\b/i,          recovery_period_days: 3,  effect_duration_months: 12 },
  // Energy-based tightening
  { pattern: /\b(morpheus|rf microneedling|radiofrequency microneedling|inmode)\b/i,   recovery_period_days: 7,  effect_duration_months: 12 },
  { pattern: /\b(thermage)\b/i,                                                         recovery_period_days: 7,  effect_duration_months: 18 },
  { pattern: /\b(ultraformer|hifu|7d facelift)\b/i,                                    recovery_period_days: 7,  effect_duration_months: 18 },
  { pattern: /\b(fotona 4d|4d facelift|fotona 6d|6d)\b/i,                             recovery_period_days: 7,  effect_duration_months: 18 },
  { pattern: /\b(fotona|smootheye|liplase)\b/i,                                         recovery_period_days: 7,  effect_duration_months: 12 },
  { pattern: /\b(thread lift|instalift|nova threads|onda)\b/i,                          recovery_period_days: 7,  effect_duration_months: 12 },
  // Resurfacing
  { pattern: /\b(co2|fractional resurfacing)\b/i,                                       recovery_period_days: 14, effect_duration_months: 24 },
  { pattern: /\b(vi peel|vipeel|chemical peel|medical peel)\b/i,                       recovery_period_days: 10, effect_duration_months: 2 },
  // Laser
  { pattern: /\b(ipl|stellar|lumenis|broadband|photofacial)\b/i,                       recovery_period_days: 7,  effect_duration_months: 6 },
  { pattern: /\b(pico|picosecond)\b/i,                                                  recovery_period_days: 5,  effect_duration_months: 6 },
  // Facials / no downtime
  { pattern: /\b(hydrafacial|hydra facial)\b/i,                                         recovery_period_days: 0,  effect_duration_months: 1 },
  { pattern: /\b(skin booster|cocktail|booster)\b/i,                                    recovery_period_days: 2,  effect_duration_months: 6 },
  // Body
  { pattern: /\b(accent|body contouring|minifx|bodyfx)\b/i,                            recovery_period_days: 0,  effect_duration_months: 6 },
  // Generic laser (broad — keep last)
  { pattern: /\b(laser)\b/i,                                                             recovery_period_days: 7,  effect_duration_months: 6 },
  { pattern: /\b(facial)\b/i,                                                            recovery_period_days: 0,  effect_duration_months: 1 },
]

/**
 * Return authoritative numeric metadata for a treatment, or null if no rule matches.
 * Fixed rules always take priority over AI inference.
 */
export function inferFixedMetadata(name: string, _category?: string, _description?: string): FixedMetadata | null {
  for (const rule of FIXED_METADATA_RULES) {
    if (rule.pattern.test(name)) {
      return { recovery_period_days: rule.recovery_period_days, effect_duration_months: rule.effect_duration_months }
    }
  }
  return null
}

/** Deterministic tags by treatment type. */
export const TAG_RULES: [RegExp, string[]][] = [
  [/\b(botox|toxin|neuromodulator|neurotoxin|dysport|xeomin)\b/i, ['Anti-aging', 'Wrinkle Smoothing', 'Quick Procedure']],
  [/\b(filler|juvederm|restylane|voluma|syringe|ha filler|lip filler)\b/i, ['Volume Restore', 'Anti-aging', 'Contouring']],
  [/\b(morpheus|rf microneedling|radiofrequency microneedling)\b/i, ['Skin Tightening', 'Collagen Boost', 'Anti-aging']],
  [/\b(thermage)\b/i, ['Skin Tightening', 'Lifting', 'Anti-aging']],
  [/\b(ultraformer|hifu|7d facelift)\b/i, ['Skin Tightening', 'Lifting', 'Non-surgical Facelift']],
  [/\b(fotona 4d|4d facelift)\b/i, ['Skin Tightening', 'Lifting', 'Anti-aging']],
  [/\b(fotona 6d|6d)\b/i, ['Full Face Rejuvenation', 'Lifting', 'Anti-aging']],
  [/\b(smootheye|smooth eye)\b/i, ['Eye Rejuvenation', 'Anti-aging']],
  [/\b(liplase|lip lase)\b/i, ['Lip Rejuvenation', 'Anti-aging']],
  [/\b(fotona)\b/i, ['Skin Tightening', 'Anti-aging']],
  [/\b(co2|fractional resurfacing|ablative)\b/i, ['Resurfacing', 'Skin Tightening', 'Anti-aging']],
  [/\b(ipl|stellar|lumenis|broadband|photofacial)\b/i, ['Pigmentation', 'Redness Reduction', 'Anti-aging']],
  [/\b(pico|picosecond)\b/i, ['Pigmentation', 'Brightening', 'Spot Removal']],
  [/\b(hydrafacial|hydra facial)\b/i, ['Deep Cleanse', 'Hydration', 'Glow']],
  [/\b(chemical peel|vi peel|medical peel)\b/i, ['Resurfacing', 'Pigmentation', 'Anti-aging']],
  [/\b(skin booster|cocktail|booster)\b/i, ['Hydration', 'Glow', 'Skin Rejuvenation']],
  [/\b(accent|body contouring|minifx|bodyfx)\b/i, ['Body Contouring', 'Fat Reduction', 'Skin Tightening']],
  [/\b(laser)\b/i, ['Laser Treatment', 'Anti-aging']],
  [/\b(facial)\b/i, ['Facial', 'Glow']],
]

/** Infer treatment tags from treatment name. Returns empty array if no rule matches. */
export function inferTags(name: string): string[] {
  for (const [pattern, tags] of TAG_RULES) {
    if (pattern.test(name)) return tags
  }
  return []
}

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
