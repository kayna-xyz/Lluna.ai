import { type NextRequest, NextResponse } from 'next/server'

/**
 * Legacy entry point — forwards to /join which handles OAuth initiation correctly.
 */
export async function GET(request: NextRequest) {
  const dest = new URL('/join', request.nextUrl.origin)
  const clinic = request.nextUrl.searchParams.get('clinic')
  if (clinic) dest.searchParams.set('clinic', clinic)
  return NextResponse.redirect(dest)
}
