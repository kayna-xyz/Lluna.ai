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

  if (
    pathname.startsWith('/clinicside') &&
    !pathname.startsWith('/clinicside/auth') &&
    !user &&
    !clinicsideAuthBypassed()
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/clinicside/auth'
    loginUrl.search = ''
    const destination =
      pathname + (request.nextUrl.search || '')
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

  // Home (/) is the login entry: unauthenticated users always go to /login first.
  if (pathname === '/' && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const p = new URLSearchParams(request.nextUrl.searchParams)
    if (p.get('clinic') || p.get('clinicSlug')) {
      p.set('role', 'consumer')
      p.set('next', '/')
    }
    loginUrl.search = p.toString()
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/login' && user) {
    const { data: staffRow, error: staffErr } = await supabase
      .from('clinic_staff_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!staffErr && staffRow?.user_id) {
      const dashUrl = request.nextUrl.clone()
      dashUrl.pathname = '/clinicside/app'
      dashUrl.search = ''
      if (clinic) dashUrl.searchParams.set('clinic', clinic)
      return NextResponse.redirect(dashUrl)
    }

    const role = searchParams.get('role') || 'consumer'
    const next = searchParams.get('next')
    if (role === 'consumer' || next === '/') {
      const dest = request.nextUrl.clone()
      dest.pathname = '/'
      dest.search = ''
      if (clinic) dest.searchParams.set('clinic', clinic)
      return NextResponse.redirect(dest)
    }
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = '/clinicside/app'
    dashUrl.search = ''
    if (clinic) dashUrl.searchParams.set('clinic', clinic)
    return NextResponse.redirect(dashUrl)
  }

  return response
}

export const config = {
  matcher: ['/', '/clinicside/:path*', '/login'],
}
