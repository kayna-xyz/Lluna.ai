/**
 * Shared price extraction utility for menu parsing.
 *
 * Handles all real-world inline price formats:
 *   "$800/Syringe $1200/2 Syringes"
 *   "$1000/Vial $1680/2 vials"
 *   "$12/Unit $500/50 Units $850/100 Units"
 *   "Starting From $180"
 *   "$800" (simple)
 *
 * Zero-hallucination: only values explicitly present in the source string are extracted.
 * Never invents labels, quantities, or prices.
 */

import type { PricingTable } from '@/lib/clinic-menu'

export type ExtractedPrice = {
  value: number
  rawLabel: string   // verbatim label from source, e.g. "2 Syringes"
  column: string     // normalized column header, e.g. "2 Syringes"
}

/** Dollar-amount regex: matches $800, $1200, $1,200, $1,200.50 */
const DOLLAR_RE = /\$(\d[\d,]*(?:\.\d+)?)/g

/**
 * Scan text for all explicit $-price occurrences.
 * For each, grab the "/" label that immediately follows (if any),
 * stopping at the next "$" or end-of-string.
 *
 * Returns prices in source order. Never drops or invents values.
 */
export function extractAllPrices(text: string): ExtractedPrice[] {
  const positions: Array<{ index: number; value: number }> = []
  let m: RegExpExecArray | null
  DOLLAR_RE.lastIndex = 0
  while ((m = DOLLAR_RE.exec(text)) !== null) {
    positions.push({ index: m.index, value: parseFloat(m[1].replace(/,/g, '')) })
  }

  return positions.map(({ index, value }, i) => {
    const nextIndex = i < positions.length - 1 ? positions[i + 1].index : text.length
    const segment = text.slice(index, nextIndex)                     // "$800/Syringe  "
    const afterDollar = segment.replace(/^\$[\d,]+/, '').trimStart() // "/Syringe  "
    const labelMatch = afterDollar.match(/^\/\s*(.+?)[\s,]*$/)
    const rawLabel = labelMatch ? labelMatch[1].trim() : ''
    return { value, rawLabel, column: normalizeColumnLabel(rawLabel, i) }
  })
}

/**
 * Normalize raw label into a clean column header.
 * Examples:
 *   ""          → "Option 1" / "Option 2" (positional fallback)
 *   "Syringe"   → "1 Syringe"
 *   "Vial"      → "1 Vial"
 *   "Unit"      → "Per Unit"
 *   "2 Syringes"→ "2 Syringes"  (already has quantity, keep as-is)
 *   "50 Units"  → "50 Units"
 */
function normalizeColumnLabel(raw: string, position: number): string {
  if (!raw) return `Option ${position + 1}`
  const lower = raw.toLowerCase().trim()
  // Already has a leading number → keep as-is
  if (/^\d/.test(raw)) return raw.trim()
  // Bare singular unit words → prepend "1 " or "Per"
  if (lower === 'unit') return 'Per Unit'
  if (lower === 'syringe') return '1 Syringe'
  if (lower === 'vial') return '1 Vial'
  if (lower === 'bottle') return '1 Bottle'
  if (lower === 'session') return '1 Session'
  if (lower === 'treatment') return '1 Treatment'
  return raw.trim()
}

/** True if text signals a "starting from" type price, not a full price list. */
export function isStartingFromText(text: string): boolean {
  return /starting\s+from|from\s+\$|as\s+low\s+as/i.test(text)
}

export type ParsedPricing =
  | { pricing_model: 'simple'; pricing: Record<string, unknown> }
  | { pricing_model: 'table'; pricing_table: PricingTable }

/**
 * Given any text fragment that may contain prices, build the correct
 * pricing structure. This is the single entry point for all callers.
 *
 * Decision logic:
 *   "Starting From $X"          → simple { starting_from: X }
 *   1 price found               → simple { single: X }
 *   2+ prices found             → table with 1 default row
 *   no prices                   → simple {} (no data — never invents)
 *
 * Logs detected prices and chosen model for every call.
 */
export function parsePricingFromText(text: string, treatmentName = ''): ParsedPricing {
  const prices = extractAllPrices(text)
  const tag = treatmentName ? `"${treatmentName}"` : '(unknown)'

  console.log(`[price-extractor] ${tag} detected_prices=[${prices.map(p => `$${p.value}${p.rawLabel ? '/' + p.rawLabel : ''}`).join(', ')}]`)

  if (prices.length === 0) {
    console.log(`[price-extractor] ${tag} pricing_model=simple (no prices found)`)
    return { pricing_model: 'simple', pricing: {} }
  }

  // "Starting From" → simple special type, even if only one price
  if (isStartingFromText(text) && prices.length === 1) {
    console.log(`[price-extractor] ${tag} pricing_model=simple (starting_from)`)
    return { pricing_model: 'simple', pricing: { starting_from: prices[0].value } }
  }

  if (prices.length === 1) {
    console.log(`[price-extractor] ${tag} pricing_model=simple`)
    return { pricing_model: 'simple', pricing: { single: prices[0].value } }
  }

  // 2+ prices → table
  const columns = prices.map(p => p.column)
  const values: Record<string, number | null> = {}
  for (const p of prices) values[p.column] = p.value

  const pricingTable: PricingTable = {
    columns,
    rows: [{ label: 'default', values }],
  }

  console.log(`[price-extractor] ${tag} pricing_model=table columns=[${columns.join(', ')}]`)
  return { pricing_model: 'table', pricing_table: pricingTable }
}

/**
 * Merge two PricingTables that share the same column headers.
 * Used when a treatment has multiple named rows in pipe-delimited format.
 * Returns null if columns are incompatible (caller should keep originals separate).
 */
export function mergePricingTables(a: PricingTable, b: PricingTable, bRowLabel: string): PricingTable | null {
  if (a.columns.join('|') !== b.columns.join('|')) return null
  return {
    columns: a.columns,
    rows: [
      ...a.rows,
      { label: bRowLabel, values: b.rows[0]?.values ?? {} },
    ],
  }
}
