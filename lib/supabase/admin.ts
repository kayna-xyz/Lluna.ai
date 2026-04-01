import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null | undefined

/** Server-only Supabase client with service role (bypasses RLS). */
export function getServiceSupabase(): SupabaseClient | null {
  if (_admin !== undefined) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    _admin = null
    return null
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}
