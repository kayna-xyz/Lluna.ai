import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

export type SupabaseMiddlewareClient =
  | { supabase: SupabaseClient; response: NextResponse }
  | { supabase: null; response: NextResponse }

/**
 * Creates a Supabase client that reads/writes auth tokens via request/response
 * cookies. Designed for use inside Next.js middleware only.
 *
 * If `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing,
 * returns `supabase: null` so local dev can run without Supabase (no session).
 */
export function createSupabaseMiddlewareClient(request: NextRequest): SupabaseMiddlewareClient {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    return { supabase: null, response }
  }

  const supabase = createServerClient(url, key, {
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
  })

  return { supabase, response }
}
