import { redirect } from 'next/navigation'
import { getReadOnlySessionSupabase } from '@/lib/supabase/server-auth'
import LumeApp from './consumer-home'

export const dynamic = 'force-dynamic'

function clinicFromSearchParams(sp: Record<string, string | string[] | undefined>): string {
  const c = sp.clinic
  const cs = sp.clinicSlug
  const v = (Array.isArray(c) ? c[0] : c) || (Array.isArray(cs) ? cs[0] : cs)
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Consumer app shell.
 * Uses a read-only Supabase client (no cookie writes) to check for an existing
 * session. Unauthenticated users are redirected to /login.
 * Middleware provides the same guard at the edge; this is the in-process fallback.
 */
export default async function HomePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = props.searchParams ? await props.searchParams : {}
  const initialViaClinicLink = !!clinicFromSearchParams(sp)

  const supabase = await getReadOnlySessionSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const clinic = clinicFromSearchParams(sp)
    const q = new URLSearchParams()
    if (clinic) {
      q.set('clinic', clinic)
      q.set('role', 'consumer')
      q.set('next', '/')
    }
    redirect(q.toString() ? `/login?${q.toString()}` : '/login')
  }

  return <LumeApp initialViaClinicLink={initialViaClinicLink} />
}
