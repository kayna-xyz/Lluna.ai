/**
 * Customer-facing landing URL with `?clinic=` bound to a specific tenant.
 *
 * The QR code leads to `/login?clinic=<slug>` so the user authenticates first
 * and the clinic binding is carried through the OAuth flow into the consumer app.
 *
 * Set `NEXT_PUBLIC_APP_URL` to the public origin (e.g. `https://app.example.com`) when the
 * advisor dashboard is served from a different host than the consumer app.
 */
export function getConsumerLandingUrl(clinicSlug: string): string {
  const slug = (clinicSlug || 'default').trim() || 'default'
  const publicBase =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
      : ''
  if (publicBase) {
    const u = new URL(publicBase.includes('://') ? publicBase : `https://${publicBase}`)
    u.pathname = '/login'
    u.hash = ''
    u.search = ''
    u.searchParams.set('clinic', slug)
    u.searchParams.set('role', 'consumer')
    return u.href
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const u = new URL(window.location.origin)
    u.pathname = '/login'
    u.hash = ''
    u.search = ''
    u.searchParams.set('clinic', slug)
    u.searchParams.set('role', 'consumer')
    return u.href
  }
  return `/login?clinic=${encodeURIComponent(slug)}&role=consumer`
}
