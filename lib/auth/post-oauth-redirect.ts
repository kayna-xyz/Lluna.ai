/**
 * Where to send the user after OAuth session is established (Google, etc.).
 * Mirrors previous `app/auth/callback/route.ts` redirect rules.
 */
export function getPostOAuthRedirectPath(searchParams: URLSearchParams): string {
  const clinic =
    searchParams.get('clinic')?.trim() ||
    searchParams.get('clinicSlug')?.trim() ||
    ''
  // Default: Google on /login is consumer → user app (/). Clinic staff uses /clinicside/auth (email).
  const role = searchParams.get('role')?.trim() || 'consumer'
  const next = searchParams.get('next')

  if (next && next.startsWith('/') && !next.startsWith('//')) {
    const dest = new URL(next, 'http://localhost')
    if (clinic) dest.searchParams.set('clinic', clinic)
    return dest.pathname + dest.search
  }

  if (role === 'consumer' || next === '/app') {
    const dest = new URL('/app', 'http://localhost')
    if (clinic) dest.searchParams.set('clinic', clinic)
    return dest.pathname + dest.search
  }

  const dest = new URL('/clinicside/app', 'http://localhost')
  if (clinic) dest.searchParams.set('clinic', clinic)
  return dest.pathname + dest.search
}
