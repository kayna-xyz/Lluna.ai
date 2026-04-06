import { generateText } from 'ai'
import { getLlunaAnthropicModel } from '@/lib/anthropic-model'
import type { ClinicMenu, ClinicMenuTreatment } from '@/lib/clinic-menu'
import { RECOVERY_RULES, inferEffectDuration, inferTags } from '@/lib/treatment-price-resolver'

/** Summarise pricing for the prompt (no invention — only what the treatment provides). */
function pricingSnippet(t: ClinicMenuTreatment): string {
  if (t.pricing_model === 'table' && t.pricing_table) {
    const nums: number[] = []
    for (const row of t.pricing_table.rows) {
      for (const v of Object.values(row.values)) {
        if (v != null) nums.push(v)
      }
    }
    if (nums.length) return `$${Math.min(...nums)}–$${Math.max(...nums)}`
  }
  if (t.pricing) {
    const p = t.pricing as Record<string, unknown>
    const v = p.single ?? p.perUnit ?? p.perSyringe ?? p.perSession
    if (v != null) return `$${v}`
  }
  return ''
}

type DescriptionEntry = { id: string; description: string }

/**
 * Enrich treatments that have an empty description with a single batch AI call.
 * Returns a copy of the menu with descriptions filled in.
 * Never overwrites a non-empty description.
 * On AI failure, returns the original menu unchanged (graceful degradation).
 */
export async function enrichMenuDescriptions(menu: ClinicMenu): Promise<ClinicMenu> {
  const toEnrich = menu.treatments.filter((t) => !t.description?.trim())
  if (!toEnrich.length) return enrichMenuMetadata(menu)

  const treatmentLines = toEnrich
    .map((t) => {
      const price = pricingSnippet(t)
      return `- id: ${t.id} | name: ${t.name}${t.category ? ` | category: ${t.category}` : ''}${price ? ` | price: ${price}` : ''}`
    })
    .join('\n')

  const prompt = `Generate one-sentence descriptions for these aesthetic treatments.\n\nTreatments:\n${treatmentLines}\n\nReturn a JSON array only — no markdown, no commentary:\n[\n  { "id": "<id>", "description": "<description>" },\n  ...\n]`

  let entries: DescriptionEntry[] = []
  try {
    const { text } = await generateText({
      model: getLlunaAnthropicModel(),
      system:
        'You write concise clinical descriptions for medical aesthetic treatments. ' +
        'Rules: ' +
        '(1) One sentence, 10–20 words. ' +
        '(2) State the direct effect, key body area, approximate recovery/downtime, and results timeline. ' +
        '(3) End with the 2 best companion treatments by name. ' +
        '(4) No "This treatment", no "Based on", no "It is designed to", no explanatory language. ' +
        '(5) Start directly with the outcome, e.g. "Reduces submental fat..." or "Smooths forehead lines...". ' +
        '(6) Only use information derivable from the treatment name and category — do not invent. ' +
        '(7) Output valid JSON array only.',
      messages: [{ role: 'user', content: prompt }],
    })

    // Strip potential markdown fences before parsing
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (Array.isArray(parsed)) {
      entries = (parsed as Record<string, unknown>[])
        .filter((e) => typeof e.id === 'string' && typeof e.description === 'string' && e.description.trim())
        .map((e) => ({ id: String(e.id), description: String(e.description).trim() }))
    }
  } catch (e) {
    console.warn('[menu-enrichment] AI description generation failed, skipping:', e instanceof Error ? e.message : e)
    return enrichMenuMetadata(menu)
  }

  if (!entries.length) return enrichMenuMetadata(menu)

  const descById = new Map(entries.map((e) => [e.id, e.description]))
  const withDescriptions: ClinicMenu = {
    ...menu,
    treatments: menu.treatments.map((t) => {
      if (t.description?.trim()) return t // never overwrite existing
      const generated = descById.get(t.id)
      return generated ? { ...t, description: generated } : t
    }),
  }
  return enrichMenuMetadata(withDescriptions)
}

/**
 * Deterministically enrich every treatment with recovery_period, effect_duration, and tags.
 * Always overwrites these fields so they stay in sync with the rules.
 * Pure/synchronous — no AI call required.
 */
export function enrichMenuMetadata(menu: ClinicMenu): ClinicMenu {
  return {
    ...menu,
    treatments: menu.treatments.map((t) => {
      const recovery_period = inferRecoveryPeriod(t.name)
      const effect_duration = inferEffectDuration(t.name)
      const tags = inferTags(t.name)
      return {
        ...t,
        ...(recovery_period ? { recovery_period } : {}),
        ...(effect_duration ? { effect_duration } : {}),
        ...(tags.length ? { tags } : {}),
      }
    }),
  }
}

function inferRecoveryPeriod(name: string): string {
  for (const [pattern, value] of RECOVERY_RULES) {
    if (pattern.test(name)) return value
  }
  return ''
}
