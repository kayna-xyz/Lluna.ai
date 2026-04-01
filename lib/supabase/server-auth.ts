import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Read-only Supabase client for Server Components.
 * setAll is intentionally empty — never writes cookies, so it is safe to call
 * during page rendering where Next.js forbids cookie mutation.
 * Uses getSession() (local JWT decode, no network round-trip, no refresh).
 * For full server-side user verification use getAuthSupabase() in Route Handlers.
 */
export async function getReadOnlySessionSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // intentionally empty — Server Components cannot write cookies
        },
      },
    },
  )
}

/**
 * Server-side Supabase client with cookie-based Auth session.
 * Use in Route Handlers and Server Actions only (can write cookies).
 */
export async function getAuthSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )
}
