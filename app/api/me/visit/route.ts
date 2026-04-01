import { getAuthSupabase } from '@/lib/supabase/server-auth'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

/**
 * Record or update a logged-in user's visit to a clinic (QR scan or direct).
 */
export async function POST(req: Request) {
  const auth = await getAuthSupabase()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    clinicSlug?: string
    viaQr?: boolean
  }
  const slug = typeof body.clinicSlug === 'string' ? body.clinicSlug.trim() : ''
  if (!slug) {
    return Response.json({ error: 'clinicSlug required' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ error: 'Server misconfigured' }, { status: 503 })
  }

  const tenant = await resolveClinicForRequest(
    supabase,
    new Request('http://internal.local/', {
      headers: { 'X-Clinic-Slug': slug },
    }),
  )
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const clinicId = tenant.clinic.id
  const viaQr = Boolean(body.viaQr)

  const { data: existing } = await supabase
    .from('user_clinic_visits')
    .select('id, visit_count, entry_via_qr')
    .eq('user_id', user.id)
    .eq('clinic_id', clinicId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existing?.id) {
    const { error } = await supabase
      .from('user_clinic_visits')
      .update({
        last_visited_at: now,
        visit_count: (Number(existing.visit_count) || 1) + 1,
        entry_via_qr: existing.entry_via_qr || viaQr,
      })
      .eq('id', existing.id)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await supabase.from('user_clinic_visits').insert({
      user_id: user.id,
      clinic_id: clinicId,
      first_visited_at: now,
      last_visited_at: now,
      visit_count: 1,
      entry_via_qr: viaQr,
    })
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}
