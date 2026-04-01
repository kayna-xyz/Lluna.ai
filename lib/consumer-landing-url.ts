/**
 * Customer-facing landing URL with `?clinic=` bound to a specific tenant.
 *
 * The QR code leads to `/join?clinic=<slug>` which immediately
 * initiates Google OAuth — skipping the /login landing page entirely.
 * After OAuth the user lands on /auth/callback with the clinic param preserved.
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
    u.pathname = '/join'
    u.hash = ''
    u.search = ''
    u.searchParams.set('clinic', slug)
    u.searchParams.set('role', 'consumer')
    return u.href
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const u = new URL(window.location.origin)
    u.pathname = '/join'
    u.hash = ''
    u.search = ''
    u.searchParams.set('clinic', slug)
    u.searchParams.set('role', 'consumer')
    return u.href
  }
  return `/join?clinic=${encodeURIComponent(slug)}&role=consumer`
}
