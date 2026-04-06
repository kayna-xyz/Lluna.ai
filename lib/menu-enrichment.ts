import { generateText } from 'ai'
import { getLlunaAnthropicModel } from '@/lib/anthropic-model'
import type { ClinicMenu, ClinicMenuTreatment } from '@/lib/clinic-menu'
import { inferFixedMetadata, inferTags } from '@/lib/treatment-price-resolver'

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

/**
 * Parse a raw unknown value into a non-negative integer, or null.
 * Handles: actual numbers, numeric strings, text like "14 days" or "3-6".
 */
function parseNumericField(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) return Math.round(val)
  if (typeof val === 'string') {
    const match = val.match(/\d+/)
    if (match) {
      const n = parseInt(match[0], 10)
      return n >= 0 ? n : null
    }
  }
  return null
}

type NormalizedMetadata = {
  recovery_period_days: number | null
  effect_duration_months: number | null
  tags: string[]
}

/** Validate and normalize raw AI output into typed metadata. */
function normalizeMetadata(raw: Record<string, unknown>): NormalizedMetadata {
  return {
    recovery_period_days: parseNumericField(raw.recovery_period_days),
    effect_duration_months: parseNumericField(raw.effect_duration_months),
    tags: Array.isArray(raw.tags)
      ? (raw.tags as unknown[]).map(String).filter(Boolean)
      : [],
  }
}

/**
 * True when all three metadata fields are present and valid.
 * Numeric fields must not be undefined (null is an acceptable "known unknown").
 */
function metadataComplete(t: ClinicMenuTreatment): boolean {
  return (
    t.recovery_period_days !== undefined &&
    t.effect_duration_months !== undefined &&
    Array.isArray(t.tags)
  )
}

type MetadataEntry = NormalizedMetadata & { id: string }

/**
 * Single batched AI call for treatments missing metadata.
 * AI must return strict numeric JSON — normalizeMetadata() handles any text/coercion.
 * Returns an empty map on failure so callers always fall back to fixed rules.
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
    `Generate numeric metadata for these medical aesthetic treatments.\n\n` +
    `Treatments:\n${treatmentLines}\n\n` +
    `Return a JSON array only — no markdown, no commentary:\n` +
    `[\n` +
    `  {\n` +
    `    "id": "<id>",\n` +
    `    "recovery_period_days": <integer, e.g. 0 | 3 | 7 | 14>,\n` +
    `    "effect_duration_months": <integer, e.g. 1 | 4 | 12 | 24>,\n` +
    `    "tags": ["<tag1>", "<tag2>", "<tag3>"]\n` +
    `  }\n` +
    `]`

  try {
    const { text } = await generateText({
      model: getLlunaAnthropicModel(),
      system:
        'You are a medical aesthetic expert generating structured numeric metadata for clinic treatments. ' +
        'Rules: ' +
        '(1) recovery_period_days: integer — how many days of downtime/redness after the procedure. 0 = no downtime. ' +
        '(2) effect_duration_months: integer — how many months the treatment results typically last. ' +
        '(3) tags: 2–4 short descriptive strings (e.g. "Anti-aging", "Skin Tightening", "No Downtime"). ' +
        '(4) Both numeric fields MUST be integers, not strings or ranges. ' +
        '(5) Only use information derivable from the treatment name, category, and description. ' +
        '(6) Output valid JSON array only — no markdown fences, no commentary.',
      messages: [{ role: 'user', content: prompt }],
    })

    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (!Array.isArray(parsed)) return new Map()

    const entries = (parsed as Record<string, unknown>[])
      .filter((e) => typeof e.id === 'string')
      .map((e): MetadataEntry => ({ id: String(e.id), ...normalizeMetadata(e) }))

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
 * On AI failure, falls through to enrichMenuMetadata (graceful degradation).
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
      if (t.description?.trim()) return t
      const generated = descById.get(t.id)
      return generated ? { ...t, description: generated } : t
    }),
  }
  return await enrichMenuMetadata(withDescriptions)
}

/**
 * Enrich every treatment with recovery_period_days, effect_duration_months, and tags.
 *
 * Priority per field:
 *   1. Fixed rules (inferFixedMetadata) — always override AI for well-known treatments
 *   2. AI result (generateTreatmentMetadataBatch) — for unknown treatments only
 *   3. Safe default: null / []
 *
 * Idempotent: treatments where all three fields are already defined are skipped.
 */
export async function enrichMenuMetadata(menu: ClinicMenu): Promise<ClinicMenu> {
  // Only send treatments that still need enrichment to the AI
  const needsEnrichment = menu.treatments.filter((t) => !metadataComplete(t))
  // Treatments already matched by a fixed rule don't need an AI call either
  const needsAI = needsEnrichment.filter((t) => !inferFixedMetadata(t.name))
  const aiResults = await generateTreatmentMetadataBatch(needsAI)

  return {
    ...menu,
    treatments: menu.treatments.map((t) => {
      if (metadataComplete(t)) return t

      // Priority 1: fixed rules — always authoritative for well-known treatments
      const fixed = inferFixedMetadata(t.name, t.category, t.description)

      // Priority 2: AI result (only for treatments not covered by fixed rules)
      const ai = fixed ? null : aiResults.get(t.id) ?? null

      const recovery_period_days = fixed?.recovery_period_days ?? ai?.recovery_period_days ?? null
      const effect_duration_months = fixed?.effect_duration_months ?? ai?.effect_duration_months ?? null
      const tags = (ai?.tags?.length ? ai.tags : null) ?? inferTags(t.name)

      return { ...t, recovery_period_days, effect_duration_months, tags }
    }),
  }
}
