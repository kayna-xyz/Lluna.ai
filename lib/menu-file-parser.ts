import type { ClinicMenu, ClinicMenuTreatment, PricingTable, PricingTableRow } from '@/lib/clinic-menu'
import { parsePricingFromText, extractAllPrices, groupPricingLines } from '@/lib/menu-price-extractor'

/**
 * Classify a pricing column header into a tier:
 *   entry    — first-timer / new-client / intro prices
 *   standard — non-member / regular / walk-in prices
 *   package  — package / bundle / series / multi-session prices
 *   other    — anything that doesn't match the above
 */
export function classifyPricingColumn(col: string): 'entry' | 'standard' | 'package' | 'other' {
  if (/first.?tim|new.?client|new.?patient|introduct|welcome\s+price|trial\s+price/i.test(col)) return 'entry'
  if (/non.?member|non\s+member|regular|standard|walk.?in|retail\s+price|single\s+session/i.test(col)) return 'standard'
  if (/package|bundle|series|\bpack\b|\d+\s*(session|treatment|visit|syringe|unit)/i.test(col)) return 'package'
  return 'other'
}

/**
 * Remove package columns from a pricing_table when at least one entry or standard
 * column exists. Hard rule: entry/standard pricing always takes precedence.
 * If no entry/standard column is found, the table is returned unchanged.
 */
function filterPackageColumns(table: PricingTable): PricingTable {
  const classified = table.columns.map((c) => ({ col: c, tier: classifyPricingColumn(c) }))
  const hasEntryOrStandard = classified.some((c) => c.tier === 'entry' || c.tier === 'standard')
  if (!hasEntryOrStandard) return table

  const keepCols = classified.filter((c) => c.tier !== 'package').map((c) => c.col)
  if (keepCols.length === table.columns.length) return table // nothing to remove

  console.log(
    `[menu-parse] filtering package columns: removed [${classified
      .filter((c) => c.tier === 'package')
      .map((c) => c.col)
      .join(', ')}], keeping [${keepCols.join(', ')}]`,
  )

  return {
    columns: keepCols,
    rows: table.rows.map((row) => {
      const values: Record<string, number | null> = {}
      for (const col of keepCols) values[col] = row.values[col] ?? null
      return { label: row.label, values }
    }),
  }
}

export function slugId(name: string, i: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return s || `treatment_${i}`
}

/**
 * Parse the flat AI output format: { treatments: [{ name, category, price, unit, areas }] }
 *
 * - Simple treatment (price set, areas null/empty) → pricing_model: 'simple'
 * - Body-area treatment (areas array present) → pricing_model: 'table' with one row per area
 *   and a single "Price" column, then filterPackageColumns is applied as usual.
 */
function parseFlatTreatmentItems(items: unknown[], clinicName: string): ClinicMenu {
  const treatments: ClinicMenuTreatment[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!name) continue

    const category = typeof obj.category === 'string' ? obj.category.trim() : ''
    const unit = typeof obj.unit === 'string' ? obj.unit.toLowerCase().trim() : null

    // --- Body-area variant treatment ---
    const rawAreas = Array.isArray(obj.areas) ? obj.areas : null
    if (rawAreas && rawAreas.length > 0) {
      const rows: PricingTableRow[] = []
      for (const area of rawAreas) {
        if (!area || typeof area !== 'object') continue
        const a = area as Record<string, unknown>
        const aName = typeof a.name === 'string' ? a.name.trim() : ''
        const aPrice = typeof a.price === 'number' && Number.isFinite(a.price) && a.price > 0 ? a.price : null
        if (!aName || aPrice === null) continue
        rows.push({ label: aName, values: { Price: aPrice } })
      }
      if (rows.length === 0) {
        console.log(`[menu-parse] "${name}" skipped — areas present but no valid rows`)
        continue
      }
      console.log(`[menu-parse] "${name}" areas=${rows.map((r) => r.label).join(', ')} → pricing_model=table`)
      treatments.push({
        id: slugId(name, i),
        name,
        category,
        description: '',
        units: 'session',
        pricing_model: 'table',
        pricing_table: { columns: ['Price'], rows },
      })
      continue
    }

    // --- Simple single-price treatment ---
    const price = typeof obj.price === 'number' && Number.isFinite(obj.price) && obj.price > 0 ? obj.price : null
    if (price === null) {
      console.log(`[menu-parse] "${name}" skipped — no valid price`)
      continue
    }

    let pricing: Record<string, unknown>
    let units: string

    if (unit === 'unit' || unit === 'units') {
      pricing = { perUnit: price }
      units = 'unit'
    } else if (unit === 'syringe' || unit === 'syringes') {
      pricing = { perSyringe: price }
      units = 'syringe'
    } else {
      pricing = { single: price }
      units = 'session'
    }

    console.log(`[menu-parse] "${name}" price=$${price} unit=${unit ?? 'session'} → pricing_model=simple`)
    treatments.push({
      id: slugId(name, i),
      name,
      category,
      description: '',
      units,
      pricing_model: 'simple',
      pricing,
    })
  }

  return { clinicName, treatments }
}

/**
 * Primary parser — handles JSON output from the AI (both image and PDF/text prompts).
 * Supports two AI output shapes:
 *   1. New flat format:  { treatments: [{ name, category, price, unit }] }
 *   2. Legacy array:     [{ name, pricing_model, pricing | pricing_table, ... }]
 * Falls back to parseMenuTextToDraft if the input is not valid JSON.
 *
 * Grounding rule: only fields explicitly present in the source are populated.
 * Missing fields are left empty/null rather than filled with defaults.
 */
export function parseMenuJsonToDraft(jsonText: string, clinicName = 'My Clinic'): ClinicMenu {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText.trim())
  } catch {
    // Not valid JSON — fall back to pipe-delimited parser
    console.log('[menu-parse] AI output is not JSON, falling back to pipe-delimited parser')
    return parseMenuTextToDraft(jsonText, clinicName)
  }

  // New flat format: { treatments: [...] }
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Array.isArray((parsed as Record<string, unknown>).treatments)
  ) {
    console.log('[menu-parse] detected flat { treatments: [...] } format')
    return parseFlatTreatmentItems((parsed as Record<string, unknown>).treatments as unknown[], clinicName)
  }

  // Legacy array format: [{ name, pricing_model, ... }]
  let items: unknown[]
  if (Array.isArray(parsed)) {
    items = parsed
  } else {
    console.log('[menu-parse] unexpected JSON shape, falling back to pipe-delimited parser')
    return parseMenuTextToDraft(jsonText, clinicName)
  }

  const treatments: ClinicMenuTreatment[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!name) continue

    const aiPricingModel = obj.pricing_model === 'table' ? 'table' : 'simple'
    let treatment: ClinicMenuTreatment

    if (aiPricingModel === 'table' && obj.pricing_table && typeof obj.pricing_table === 'object') {
      // AI correctly identified a table — parse the structured data
      const pt = obj.pricing_table as Record<string, unknown>
      const columns = Array.isArray(pt.columns)
        ? pt.columns.filter((c): c is string => typeof c === 'string')
        : []
      const rows: PricingTableRow[] = []

      if (Array.isArray(pt.rows)) {
        for (const r of pt.rows) {
          if (!r || typeof r !== 'object') continue
          const row = r as Record<string, unknown>
          const label = typeof row.label === 'string' ? row.label.trim() : ''
          if (!label) continue
          const values: Record<string, number | null> = {}
          if (row.values && typeof row.values === 'object') {
            const vObj = row.values as Record<string, unknown>
            for (const col of columns) {
              const v = vObj[col]
              values[col] = typeof v === 'number' && Number.isFinite(v) ? v : null
            }
          } else {
            for (const col of columns) values[col] = null
          }
          rows.push({ label, values })
        }
      }

      const rawTable: PricingTable = { columns, rows }
      const filteredTable = filterPackageColumns(rawTable)
      treatment = {
        id: slugId(name, i),
        name,
        category: typeof obj.category === 'string' ? obj.category.trim() : '',
        description: typeof obj.description === 'string' ? obj.description.trim() : '',
        units: 'session',
        pricing_model: 'table',
        pricing_table: filteredTable,
      }
    } else {
      // AI said "simple" — but check if the pricing data itself contains multiple prices
      let rawPricing: Record<string, unknown> = {}
      if (obj.pricing && typeof obj.pricing === 'object' && !Array.isArray(obj.pricing)) {
        rawPricing = obj.pricing as Record<string, unknown>
      }

      // Re-scan the pricing object's string values for inline multi-prices.
      // This catches cases where the AI put "$1000/Vial $1680/2 vials" into pricing.single.
      const pricingStringValues = Object.values(rawPricing)
        .filter((v): v is string => typeof v === 'string')
        .join(' ')
      // Also scan the description in case prices leaked there.
      const descStr = typeof obj.description === 'string' ? obj.description : ''
      const scanTarget = [pricingStringValues, descStr].filter(Boolean).join(' ')
      const allPricesInStrings = extractAllPrices(scanTarget)

      // Check if rawPricing already has proper numeric values
      const numericPricingValues = Object.values(rawPricing).filter(
        (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
      )

      let finalPricing: { pricing_model: 'simple' | 'table'; pricing?: Record<string, unknown>; pricing_table?: PricingTable }

      if (numericPricingValues.length >= 2) {
        // AI already put multiple numeric values in the pricing object → keep as-is (simple with multiple keys)
        // but re-classify as table using parsePricingFromText on a reconstructed string
        const reconstructed = Object.entries(rawPricing)
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => `$${v}/${k}`)
          .join(' ')
        finalPricing = parsePricingFromText(reconstructed, name)
      } else if (allPricesInStrings.length >= 2) {
        // Embedded multi-price strings found — reclassify
        finalPricing = parsePricingFromText(scanTarget, name)
      } else if (numericPricingValues.length === 1) {
        // Normal single-price simple
        finalPricing = { pricing_model: 'simple', pricing: rawPricing }
        console.log(`[menu-parse] "${name}" detected_prices=[$${numericPricingValues[0]}] pricing_model=simple`)
      } else if (allPricesInStrings.length === 1) {
        finalPricing = parsePricingFromText(scanTarget, name)
      } else {
        finalPricing = { pricing_model: 'simple', pricing: rawPricing }
        console.log(`[menu-parse] "${name}" detected_prices=[] pricing_model=simple (no prices)`)
      }

      treatment = {
        id: slugId(name, i),
        name,
        category: typeof obj.category === 'string' ? obj.category.trim() : '',
        description: typeof obj.description === 'string' ? obj.description.trim() : '',
        units: 'session',
        pricing_model: finalPricing.pricing_model,
        pricing: finalPricing.pricing,
        pricing_table: finalPricing.pricing_table,
      }
    }

    console.log(`[menu-parse] "${name}" → final pricing_model=${treatment.pricing_model}`)
    treatments.push(treatment)
  }

  return { clinicName, treatments }
}

/**
 * Fallback pipe-delimited parser — used when AI returns non-JSON text,
 * or for spreadsheet formats (CSV, XLSX) which bypass AI entirely.
 *
 * Price extraction now uses the shared extractor so multi-price inline strings
 * are correctly classified as table pricing rather than dropped.
 *
 * Grounding rule: only fields explicitly present in the source text are populated.
 */
export function parseMenuTextToDraft(text: string, clinicName = 'My Clinic'): ClinicMenu {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  // Group pricing lines that appear on their own line under a treatment name.
  const lines = groupPricingLines(rawLines)

  const treatments: ClinicMenuTreatment[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split('|').map((p) => p.trim())
    let name = ''
    let category = ''
    let description = ''

    if (parts.length >= 2) {
      name = parts[0] || line
      category = parts[1] || ''

      // Everything from part[2] onward may contain prices and/or description text.
      // Scan the full remaining text so no price is dropped.
      const remainingText = parts.slice(2).join(' ').trim()

      // Separate price-bearing portion from description.
      // Heuristic: if part[2] looks like a price token, use it as the price field;
      // otherwise treat all remaining text as one blob for price extraction.
      const priceCandidate = parts.length >= 3 ? parts[2] : remainingText
      const descCandidate = parts.length >= 4 ? parts.slice(3).join(' ').trim() : ''

      const scanText = priceCandidate || remainingText
      const parsed = parsePricingFromText(scanText, name)

      description = descCandidate || (parsed.pricing_model === 'simple' ? remainingText.replace(/\$[\d,./a-zA-Z\s]+/g, '').trim() : '')

      const treatment: ClinicMenuTreatment = {
        id: slugId(name, i),
        name,
        category,
        description,
        units: 'session',
        pricing_model: parsed.pricing_model,
        pricing: parsed.pricing,
        pricing_table: parsed.pricing_table,
      }
      treatments.push(treatment)
    } else {
      // Single-part line — no pipe separators.
      // The whole line is the name; run price extraction over it too.
      name = line.slice(0, 120)

      // Strip the name from consideration when scanning for prices
      // to avoid treating numbers in the name as prices.
      // Use extractAllPrices to find explicit $-amounts only.
      const pricesInLine = extractAllPrices(line)
      let parsed: ReturnType<typeof parsePricingFromText>

      if (pricesInLine.length === 0) {
        parsed = { pricing_model: 'simple', pricing: {} }
        console.log(`[price-extractor] "${name}" detected_prices=[] pricing_model=simple (no prices)`)
      } else {
        parsed = parsePricingFromText(line, name)
        // Trim price tokens from name if they slipped in
        name = name.replace(/\$[\d,./a-zA-Z\s]+/g, '').trim() || line.slice(0, 60).trim()
      }

      if (!name) continue
      treatments.push({
        id: slugId(name, i),
        name,
        category,
        description: '',
        units: 'session',
        pricing_model: parsed.pricing_model,
        pricing: parsed.pricing,
        pricing_table: parsed.pricing_table,
      })
    }
  }

  return { clinicName, treatments }
}
