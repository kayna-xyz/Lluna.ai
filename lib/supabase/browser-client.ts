'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _browser: SupabaseClient | null | undefined

/**
 * Browser Supabase with cookie-based session (matches middleware + server auth).
 * Use instead of plain createClient so Next.js middleware sees the logged-in user.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (_browser !== undefined) return _browser
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    _browser = null
    return null
  }
  _browser = createBrowserClient(url, key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  })
  return _browser
}
