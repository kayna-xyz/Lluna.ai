import type { ClinicMenu, ClinicMenuTreatment, PricingTable, PricingTableRow } from '@/lib/clinic-menu'

export function slugId(name: string, i: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return s || `treatment_${i}`
}

/**
 * Primary parser — handles JSON output from the AI (both image and PDF/text prompts).
 * Falls back to parseMenuTextToDraft if the input is not valid JSON.
 *
 * Grounding rule: only fields explicitly present in the source are populated.
 * Missing fields are left empty/null rather than filled with defaults.
 */
export function parseMenuJsonToDraft(jsonText: string, clinicName = 'My Clinic'): ClinicMenu {
  let items: unknown[]
  try {
    const raw = jsonText.trim()
    const parsed = JSON.parse(raw)
    items = Array.isArray(parsed) ? parsed : []
  } catch {
    // Not valid JSON — fall back to pipe-delimited parser
    console.log('[menu-parse] AI output is not JSON, falling back to pipe-delimited parser')
    return parseMenuTextToDraft(jsonText, clinicName)
  }

  const treatments: ClinicMenuTreatment[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!name) continue

    const pricingModel = obj.pricing_model === 'table' ? 'table' : 'simple'

    let treatment: ClinicMenuTreatment

    if (pricingModel === 'table' && obj.pricing_table && typeof obj.pricing_table === 'object') {
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

      const pricingTable: PricingTable = { columns, rows }
      treatment = {
        id: slugId(name, i),
        name,
        category: typeof obj.category === 'string' ? obj.category.trim() : '',
        description: typeof obj.description === 'string' ? obj.description.trim() : '',
        units: 'session',
        pricing_model: 'table',
        pricing_table: pricingTable,
      }
    } else {
      // Simple pricing
      let pricing: Record<string, unknown> = {}
      if (obj.pricing && typeof obj.pricing === 'object' && !Array.isArray(obj.pricing)) {
        pricing = obj.pricing as Record<string, unknown>
      }
      treatment = {
        id: slugId(name, i),
        name,
        category: typeof obj.category === 'string' ? obj.category.trim() : '',
        description: typeof obj.description === 'string' ? obj.description.trim() : '',
        units: 'session',
        pricing_model: 'simple',
        pricing,
      }
    }

    console.log(`[menu-parse] "${name}" → pricing_model=${treatment.pricing_model}`)
    treatments.push(treatment)
  }

  return { clinicName, treatments }
}

/**
 * Fallback pipe-delimited parser — used when AI returns non-JSON text.
 * Grounding rule: only fields explicitly present in the source text are populated.
 */
export function parseMenuTextToDraft(text: string, clinicName = 'My Clinic'): ClinicMenu {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const treatments: ClinicMenuTreatment[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split('|').map((p) => p.trim())
    let name = ''
    let category = ''
    let description = ''
    const units: 'session' | 'unit' | 'syringe' = 'session'
    let pricing: Record<string, unknown> = {}

    if (parts.length >= 2) {
      name = parts[0] || line
      category = parts[1] || ''

      const priceCandidate = parts.length >= 3 ? parts[2] : ''
      if (priceCandidate && /\d/.test(priceCandidate)) {
        const priceMatch = priceCandidate.match(/\$?\s*(\d+(?:\.\d+)?)/)
        if (priceMatch) pricing = { single: Number(priceMatch[1]) }
      }

      const hasStructuredPrice = parts.length >= 4 && priceCandidate && /\d/.test(priceCandidate)
      description = hasStructuredPrice
        ? parts.slice(3).join(' ').trim()
        : parts.slice(2).join(' ').trim()
    } else {
      name = line.slice(0, 120)
      description = ''
      const m = line.match(/\$?\s*(\d+(?:\.\d+)?)/)
      if (m) pricing = { single: Number(m[1]) }
    }

    if (!name) continue
    treatments.push({
      id: slugId(name, i),
      name,
      category,
      description,
      units,
      pricing_model: 'simple',
      pricing,
    })
  }

  return { clinicName, treatments }
}
