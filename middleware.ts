import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware'

function clinicsideAuthBypassed(): boolean {
  return process.env.CLINICSIDE_AUTH_BYPASS !== 'false'
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, searchParams } = request.nextUrl
  const clinic = searchParams.get('clinic') || searchParams.get('clinicSlug') || ''

  // --- Clinicside auth ---
  if (
    pathname.startsWith('/clinicside') &&
    !pathname.startsWith('/clinicside/auth') &&
    !user &&
    !clinicsideAuthBypassed()
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/clinicside/auth'
    loginUrl.search = ''
    const destination = pathname + (request.nextUrl.search || '')
    loginUrl.searchParams.set('next', destination)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith('/clinicside/auth') && user) {
    const nextParam = searchParams.get('next')
    if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
      try {
        const dest = new URL(nextParam, request.nextUrl.origin)
        if (dest.origin === request.nextUrl.origin) {
          return NextResponse.redirect(dest.toString())
        }
      } catch {
        /* ignore */
      }
    }
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = '/clinicside/app'
    dashUrl.search = ''
    if (clinic) dashUrl.searchParams.set('clinic', clinic)
    return NextResponse.redirect(dashUrl)
  }

  // --- Consumer auth ---

  // /join: already authenticated → skip OAuth, go straight to /app.
  if (pathname === '/join' && user) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = '/app'
    appUrl.search = ''
    if (clinic) appUrl.searchParams.set('clinic', clinic)
    return NextResponse.redirect(appUrl)
  }

  // /app requires auth.
  if (pathname === '/app' && !user) {
    // QR scan: clinic param present → auto-trigger Google OAuth via /join.
    if (clinic) {
      const joinUrl = request.nextUrl.clone()
      joinUrl.pathname = '/join'
      joinUrl.search = ''
      joinUrl.searchParams.set('clinic', clinic)
      return NextResponse.redirect(joinUrl)
    }
    // No clinic context → show the login page.
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    loginUrl.search = ''
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/', '/app', '/join', '/clinicside/:path*'],
}
