import type { ClinicMenu, ClinicMenuTreatment } from '@/lib/clinic-menu'
import { CLINIC_MENU } from '@/lib/clinic-menu'

export function slugId(name: string, i: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return s || `treatment_${i}`
}

/** Best-effort draft menu from pasted text or pipe-separated rows (from Excel export). */
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
    let category = 'General'
    let description = ''
    const units: 'session' | 'unit' | 'syringe' = 'session'
    let pricing: Record<string, unknown> = { note: 'Set in admin' }

    if (parts.length >= 2) {
      name = parts[0] || line
      category = parts[1] || 'General'

      // Expected (from AI/excel extraction):
      // 0: Treatment Name | 1: Category | 2: $Price | 3+: Description
      // But we accept best-effort variants.
      const priceCandidate = parts.length >= 3 ? parts[2] : ''
      const priceMatch = (priceCandidate || line).match(/\$?\s*(\d+(?:\.\d+)?)/)
      if (priceMatch) pricing = { single: Number(priceMatch[1]) }

      const hasStructuredPrice = parts.length >= 4 && priceCandidate && /\d/.test(priceCandidate)
      if (hasStructuredPrice) {
        description = parts.slice(3).join(' ').trim() || name
      } else {
        // Fallback: everything after category is treated as description (might include price).
        description = parts.slice(2).join(' ').trim() || name
      }
    } else {
      name = line.slice(0, 120)
      description = line
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

  if (treatments.length === 0) {
    return {
      clinicName: CLINIC_MENU.clinicName,
      treatments: CLINIC_MENU.treatments.map((t) => ({ ...t })),
    }
  }

  return { clinicName, treatments }
}
