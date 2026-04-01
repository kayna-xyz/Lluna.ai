import { NextRequest, NextResponse } from 'next/server'
import { getAuthSupabase } from '@/lib/supabase/server-auth'

/**
 * GET /api/auth/google?clinic=<slug>&role=consumer
 *
 * Immediately initiates Google OAuth — skips the /login landing page.
 * Used by clinic QR codes so scanning goes straight to Google sign-in.
 *
 * If the user is already authenticated, redirects them straight to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const clinic = searchParams.get('clinic') || 'default'
  const role = searchParams.get('role') || 'consumer'

  const supabase = await getAuthSupabase()

  // Already signed in — skip OAuth and go straight to the consumer app.
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const dest = new URL('/app', origin)
    if (clinic) dest.searchParams.set('clinic', clinic)
    return NextResponse.redirect(dest)
  }

  const callbackUrl = new URL(`${origin}/auth/callback`)
  callbackUrl.searchParams.set('clinic', clinic)
  callbackUrl.searchParams.set('role', role)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    // Fallback: show the login page so the user can try manually.
    const fallback = new URL('/login', origin)
    fallback.searchParams.set('clinic', clinic)
    fallback.searchParams.set('role', role)
    return NextResponse.redirect(fallback)
  }

  return NextResponse.redirect(data.url)
}
