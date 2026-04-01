import { NextResponse } from 'next/server'
import { getAuthSupabase } from '@/lib/supabase/server-auth'

/**
 * Upsert public.user_profiles after OAuth / email sign-in (name, avatar, last_sign_in_at).
 * Called from the browser after session cookies are set.
 */
export async function POST() {
  const supabase = await getAuthSupabase()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const meta = user.user_metadata as Record<string, string | undefined>
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null
  const now = new Date().toISOString()

  const { error } = await supabase.from('user_profiles').upsert(
    {
      user_id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      avatar_url: avatarUrl,
      last_sign_in_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
