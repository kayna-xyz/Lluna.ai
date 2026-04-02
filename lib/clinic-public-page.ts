/** Stored in `clinic_settings` (tagline, public_activities, public_testimonials). */
export type PublicMenuActivity = {
  title: string
  description: string
  badge?: string | null
  type?: string
}

export type PublicMenuTestimonial = {
  name: string
  role: string
  testimonial: string
}

export function normalizeActivities(raw: unknown): PublicMenuActivity[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      if (!x || typeof x !== 'object') return null
      const o = x as Record<string, unknown>
      const title = String(o.title || '').trim()
      const description = String(o.description || '').trim()
      if (!title && !description) return null
      return {
        title: title || 'Activity',
        description: description || '—',
        badge: o.badge != null ? String(o.badge) : null,
        type: o.type != null ? String(o.type) : undefined,
      }
    })
    .filter(Boolean) as PublicMenuActivity[]
}

export function normalizeTestimonials(raw: unknown): PublicMenuTestimonial[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      if (!x || typeof x !== 'object') return null
      const o = x as Record<string, unknown>
      const name = String(o.name || '').trim()
      const testimonial = String(o.testimonial || '').trim()
      if (!name && !testimonial) return null
      return {
        name: name || '—',
        role: String(o.role || '').trim() || '—',
        testimonial: testimonial || '—',
      }
    })
    .filter(Boolean) as PublicMenuTestimonial[]
}

/** Stored in `clinic_settings.public_md_team` (photo_url = Storage public URL). */
export type PublicMdTeamMember = {
  id: string
  name: string
  about: string
  experience: string
  photo_url: string
}

export function normalizeMdTeam(raw: unknown): PublicMdTeamMember[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x, idx) => {
      if (!x || typeof x !== 'object') return null
      const o = x as Record<string, unknown>
      const id = String(o.id || '').trim() || `md_${idx}`
      const name = String(o.name || '').trim()
      const about = String(o.about || '').trim()
      const experience = String(o.experience || '').trim()
      const photo_url = String(o.photo_url || o.photoUrl || '').trim()
      if (!name && !about && !experience && !photo_url) return null
      return { id, name, about, experience, photo_url }
    })
    .filter(Boolean) as PublicMdTeamMember[]
}
