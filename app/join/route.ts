import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * GET /join?clinic=<slug>
 *
 * Clinic QR code entry point. Immediately fires Google OAuth — no page rendered,
 * no button to click. After Google redirects back to /auth/callback, the clinic
 * context is preserved in the callback URL and the user lands on /app?clinic=<slug>.
 *
 * Cookie handling mirrors the middleware pattern so PKCE verifier cookies are
 * properly attached to the redirect response (plain NextResponse.redirect would
 * create a new response object and drop the cookies, breaking the PKCE exchange).
 *
 * If the user is already signed in they are sent straight to /app?clinic=<slug>.
 */
export async function GET(request: NextRequest) {
  console.log('[/join] hit', request.nextUrl.toString())

  const { searchParams, origin } = request.nextUrl
  const clinic = (searchParams.get('clinic') || 'default').trim()

  // Build a response we can attach cookies to, then swap it for the redirect.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Already signed in — skip OAuth entirely.
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[/join] user already signed in:', !!user)
  if (user) {
    const dest = new URL('/app', origin)
    dest.searchParams.set('clinic', clinic)
    return NextResponse.redirect(dest)
  }

  // Build the callback URL that Google will redirect back to.
  const callbackUrl = new URL(`${origin}/auth/callback`)
  callbackUrl.searchParams.set('clinic', clinic)
  callbackUrl.searchParams.set('role', 'consumer')

  console.log('[/join] calling signInWithOAuth, callbackUrl:', callbackUrl.toString())
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  })
  console.log('[/join] signInWithOAuth result — url:', data?.url ?? null, 'error:', error?.message ?? null)

  if (error || !data.url) {
    console.error('[/join] OAuth init failed, falling back to login page. error:', error)
    const fallback = new URL('/', origin)
    fallback.searchParams.set('clinic', clinic)
    fallback.searchParams.set('role', 'consumer')
    return NextResponse.redirect(fallback)
  }

  // Redirect to Google, copying PKCE and any other cookies onto the response.
  const redirectResponse = NextResponse.redirect(data.url)
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
  }
  return redirectResponse
}
