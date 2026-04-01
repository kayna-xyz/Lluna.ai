const STORAGE_KEY = 'lluna_advisor_clinic_slug'

/** Persist tenant slug after staff login / bootstrap (overrides `default`). */
export function setAdvisorClinicSlug(slug: string): void {
  if (typeof window === 'undefined') return
  try {
    const s = slug.trim()
    if (!s) return
    localStorage.setItem(STORAGE_KEY, s)
  } catch {
    /* ignore */
  }
}

/** Resolve advisor-side tenant slug: `?clinic=` on first load, then localStorage (default `default`). */
export function getAdvisorClinicSlug(): string {
  if (typeof window === 'undefined') return 'default'
  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('clinic')?.trim() || params.get('clinicSlug')?.trim()
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl)
      return fromUrl
    }
    return localStorage.getItem(STORAGE_KEY) || 'default'
  } catch {
    return 'default'
  }
}

export function clinicHeaders(): Headers {
  const h = new Headers()
  h.set('X-Clinic-Slug', getAdvisorClinicSlug())
  return h
}

/** Same-origin fetch with tenant header for all clinicside → `/api/*` calls. */
export function clinicFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (!headers.has('X-Clinic-Slug')) {
    headers.set('X-Clinic-Slug', getAdvisorClinicSlug())
  }
  return fetch(input, { ...init, headers })
}
