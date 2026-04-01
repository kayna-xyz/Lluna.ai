export const LUME_CLINIC_SLUG_KEY = 'lume_clinic_slug'

/** Session flag: user opened the app with `?clinic=` / `?clinicSlug=` (e.g. QR). Enables Clinic menu + Report flows. */
export const LUME_CONSUMER_VIA_CLINIC_LINK_KEY = 'lume_consumer_via_clinic_link'

/**
 * Sync per-tab session flag from the current URL.
 * - If URL contains `clinic` or `clinicSlug`, set flag → full consumer UI (menu + report).
 * - Otherwise clear flag → My-only (direct entry without scan).
 */
export function syncConsumerClinicLinkSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('clinic')?.trim() || params.get('clinicSlug')?.trim()
    if (fromUrl) {
      sessionStorage.setItem(LUME_CONSUMER_VIA_CLINIC_LINK_KEY, '1')
      return true
    }
    sessionStorage.removeItem(LUME_CONSUMER_VIA_CLINIC_LINK_KEY)
    return false
  } catch {
    return false
  }
}

export function consumerHasClinicLinkSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(LUME_CONSUMER_VIA_CLINIC_LINK_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Apply `?clinic=` / `?clinicSlug=` from the URL; persist slug.
 * If the slug changed vs previous storage, start a new anonymous session (avoid cross-tenant session reuse).
 */
export function syncConsumerClinicFromLocation(): string {
  if (typeof window === 'undefined') return 'default'
  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('clinic')?.trim() || params.get('clinicSlug')?.trim()
    const prevStored = localStorage.getItem(LUME_CLINIC_SLUG_KEY)
    if (fromUrl) {
      if (prevStored && prevStored !== fromUrl) {
        localStorage.setItem('lume_session_id', crypto.randomUUID())
      }
      localStorage.setItem(LUME_CLINIC_SLUG_KEY, fromUrl)
      return fromUrl
    }
    return prevStored || 'default'
  } catch {
    return 'default'
  }
}

export function getConsumerClinicSlug(): string {
  if (typeof window === 'undefined') return 'default'
  try {
    return localStorage.getItem(LUME_CLINIC_SLUG_KEY) || 'default'
  } catch {
    return 'default'
  }
}
