import type { ClinicMenu, ClinicMenuTreatment } from '@/lib/clinic-menu'

export function slugId(name: string, i: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return s || `treatment_${i}`
}

/** Best-effort draft menu from pasted text or pipe-separated rows (from Excel export).
 *  Grounding rule: only fields explicitly present in the source text are populated.
 *  Missing fields are left empty/null rather than filled with defaults. */
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
    let category = ''        // empty when not explicitly in source
    let description = ''
    const units: 'session' | 'unit' | 'syringe' = 'session'
    let pricing: Record<string, unknown> = {}  // empty when price not in source

    if (parts.length >= 2) {
      name = parts[0] || line
      category = parts[1] || ''  // do not invent 'General' — leave blank

      // Expected (from AI/excel extraction):
      // 0: Treatment Name | 1: Category | 2: $Price | 3+: Description
      const priceCandidate = parts.length >= 3 ? parts[2] : ''
      // Only extract price if field actually contains a number — never scan the
      // whole line as a fallback (that can pick up unrelated numbers).
      if (priceCandidate && /\d/.test(priceCandidate)) {
        const priceMatch = priceCandidate.match(/\$?\s*(\d+(?:\.\d+)?)/)
        if (priceMatch) pricing = { single: Number(priceMatch[1]) }
      }

      const hasStructuredPrice = parts.length >= 4 && priceCandidate && /\d/.test(priceCandidate)
      if (hasStructuredPrice) {
        // Description is only what appears after the price column — never fall
        // back to name (that would invent a description equal to the name).
        description = parts.slice(3).join(' ').trim()
      } else {
        description = parts.slice(2).join(' ').trim()
      }
    } else {
      name = line.slice(0, 120)
      // For single-part lines we don't have a dedicated description column —
      // the line IS the name. Setting description = line would duplicate it;
      // leave it empty so we don't claim the name is also a description.
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
      pricing,
    })
  }

  // If parsing produced no treatments, return an empty menu rather than
  // substituting a hardcoded demo menu — that would be fabricated data.
  return { clinicName, treatments }
}
