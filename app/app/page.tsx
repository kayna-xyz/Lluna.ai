import { redirect } from 'next/navigation'
import { getReadOnlySessionSupabase } from '@/lib/supabase/server-auth'
import LlunaApp from '../consumer-home'
import { MyPageScreen } from '@/components/consumer/my-page-screen'

export const dynamic = 'force-dynamic'

function clinicFromSearchParams(sp: Record<string, string | string[] | undefined>): string {
  const c = sp.clinic
  const cs = sp.clinicSlug
  const v = (Array.isArray(c) ? c[0] : c) || (Array.isArray(cs) ? cs[0] : cs)
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Consumer app shell — "Your footprint" page at /app.
 * Unauthenticated users are redirected to / (login page).
 * Direct logins (no clinic param) show the My page.
 * QR clinic links show the full consumer app.
 */
export default async function AppPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = props.searchParams ? await props.searchParams : {}
  const clinic = clinicFromSearchParams(sp)

  const supabase = await getReadOnlySessionSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const q = new URLSearchParams()
    if (clinic) {
      q.set('clinic', clinic)
      q.set('role', 'consumer')
      q.set('next', '/app')
    }
    redirect(q.toString() ? `/?${q.toString()}` : '/')
  }

  if (!clinic) {
    return (
      <main style={{ minHeight: '100vh', background: '#F5F2EE' }}>
        <MyPageScreen />
      </main>
    )
  }

  return <LlunaApp initialViaClinicLink={true} />
}
