import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ info: null, configured: false })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const { data, error } = await supabase
    .from('consultant_events')
    .select('payload')
    .eq('event_type', 'clinic_info_updated')
    .eq('clinic_id', tenant.clinic.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    info: data?.payload ? asRec(data.payload) : null,
    configured: true,
  })
}

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

  const payload = { ...asRec(body) }
  delete payload.clinicId
  delete payload.clinicSlug

  const { error } = await supabase.from('consultant_events').insert({
    clinic_id: tenant.clinic.id,
    event_type: 'clinic_info_updated',
    target_screen: 'activities',
    payload,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}

