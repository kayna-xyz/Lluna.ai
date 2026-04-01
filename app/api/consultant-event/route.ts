import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

export async function POST(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const tenant = await resolveClinicForRequest(supabase, req, body)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const event_type = typeof body.event_type === 'string' ? body.event_type : 'generic'
  const target_screen =
    typeof body.target_screen === 'string' ? body.target_screen : 'report'
  const payload =
    body.payload && typeof body.payload === 'object' ? body.payload : {}

  const { error } = await supabase.from('consultant_events').insert({
    clinic_id: tenant.clinic.id,
    event_type,
    target_screen,
    payload,
  })

  if (error) {
    console.error('consultant-event', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
