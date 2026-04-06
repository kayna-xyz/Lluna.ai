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

function inferRecoveryPeriod(name: string): string {
  for (const [pattern, value] of RECOVERY_RULES) {
    if (pattern.test(name)) return value
  }
  return ''
}

/** True when all three metadata fields are already populated — skip AI re-enrichment. */
function metadataComplete(t: ClinicMenuTreatment): boolean {
  return !!(t.recovery_period?.trim() && t.effect_duration?.trim() && t.tags?.length)
}

type MetadataEntry = {
  id: string
  recovery_period: string
  effect_duration: string
  tags: string[]
}

/**
 * Single batched AI call to generate recovery_period, effect_duration, and tags
 * for a list of treatments. Returns a map of id → metadata.
 * On failure returns an empty map — callers must fall back to rule inference.
 */
async function generateTreatmentMetadataBatch(
  treatments: ClinicMenuTreatment[],
): Promise<Map<string, MetadataEntry>> {
  if (!treatments.length) return new Map()

  const treatmentLines = treatments
    .map((t) => {
      const desc = t.description?.trim() ? ` | description: ${t.description.trim()}` : ''
      return `- id: ${t.id} | name: ${t.name}${t.category ? ` | category: ${t.category}` : ''}${desc}`
    })
    .join('\n')

  const prompt =
    `Generate metadata for these medical aesthetic treatments.\n\n` +
    `Treatments:\n${treatmentLines}\n\n` +
    `Return a JSON array only — no markdown, no commentary:\n` +
    `[\n` +
    `  {\n` +
    `    "id": "<id>",\n` +
    `    "recovery_period": "<e.g. 0 days | 2–3 days | 1–2 weeks>",\n` +
    `    "effect_duration": "<e.g. 3–4 months | 12–18 months | 1–3 years>",\n` +
    `    "tags": ["<tag1>", "<tag2>", "<tag3>"]\n` +
    `  }\n` +
    `]`

  try {
    const { text } = await generateText({
      model: getLlunaAnthropicModel(),
      system:
        'You are a medical aesthetic expert generating structured metadata for clinic treatments. ' +
        'Rules: ' +
        '(1) recovery_period: how long downtime/redness lasts after the procedure (e.g. "0 days", "2–3 days", "1–2 weeks"). ' +
        '(2) effect_duration: how long the treatment results last (e.g. "3–4 months", "6–12 months", "1–3 years"). ' +
        '(3) tags: 2–4 short descriptive strings (e.g. "Anti-aging", "Skin Tightening", "No Downtime", "Quick Procedure"). ' +
        '(4) Only use information derivable from the treatment name, category, and description — do not invent. ' +
        '(5) Output valid JSON array only — no markdown fences, no commentary.',
      messages: [{ role: 'user', content: prompt }],
    })

    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (!Array.isArray(parsed)) return new Map()

    const entries = (parsed as Record<string, unknown>[])
      .filter((e) => typeof e.id === 'string')
      .map((e): MetadataEntry => ({
        id: String(e.id),
        recovery_period: typeof e.recovery_period === 'string' ? e.recovery_period.trim() : '',
        effect_duration: typeof e.effect_duration === 'string' ? e.effect_duration.trim() : '',
        tags: Array.isArray(e.tags)
          ? (e.tags as unknown[]).map(String).filter(Boolean)
          : [],
      }))

    return new Map(entries.map((e) => [e.id, e]))
  } catch (e) {
    console.warn('[menu-enrichment] AI metadata generation failed:', e instanceof Error ? e.message : e)
    return new Map()
  }
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
  if (!toEnrich.length) return await enrichMenuMetadata(menu)

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
    return await enrichMenuMetadata(menu)
  }

  if (!entries.length) return await enrichMenuMetadata(menu)

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
 * Enrich every treatment with recovery_period, effect_duration, and tags.
 * Idempotent: treatments that already have all three fields are skipped (no AI re-call).
 * Strategy per treatment: AI result → rule inference → safe default ("Varies" / []).
 */
export async function enrichMenuMetadata(menu: ClinicMenu): Promise<ClinicMenu> {
  const needsEnrichment = menu.treatments.filter((t) => !metadataComplete(t))

  // Batch AI call only for treatments missing metadata
  const aiResults = await generateTreatmentMetadataBatch(needsEnrichment)

  return {
    ...menu,
    treatments: menu.treatments.map((t) => {
      if (metadataComplete(t)) return t // already fully enriched — skip

      const ai = aiResults.get(t.id)

      const recovery_period =
        (ai?.recovery_period || inferRecoveryPeriod(t.name)) || 'Varies'
      const effect_duration =
        (ai?.effect_duration || inferEffectDuration(t.name)) || 'Varies'
      const tags =
        (ai?.tags?.length ? ai.tags : inferTags(t.name).length ? inferTags(t.name) : [])

      return { ...t, recovery_period, effect_duration, tags }
    }),
  }
}
