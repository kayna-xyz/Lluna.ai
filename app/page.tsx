import LumeApp from './consumer-home'

export const dynamic = 'force-dynamic'

function clinicFromSearchParams(sp: Record<string, string | string[] | undefined>): string {
  const c = sp.clinic
  const cs = sp.clinicSlug
  const v = (Array.isArray(c) ? c[0] : c) || (Array.isArray(cs) ? cs[0] : cs)
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Consumer app shell. Auth is enforced by middleware — unauthenticated requests
 * to / are redirected to /login before this component ever renders.
 */
export default async function HomePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = props.searchParams ? await props.searchParams : {}
  const initialViaClinicLink = !!clinicFromSearchParams(sp)

  return <LumeApp initialViaClinicLink={initialViaClinicLink} />
}
