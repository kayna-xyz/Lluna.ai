import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

/** Fallback when Realtime is down: poll for google_review event for this session (last 24h). */
export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ pending: false, configured: false })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = (searchParams.get('session_id') || '').trim()
  if (!sessionId) {
    return Response.json({ pending: false, error: 'session_id required' }, { status: 400 })
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  const { data, error } = await supabase
    .from('consultant_events')
    .select('id')
    .eq('clinic_id', tenant.clinic.id)
    .eq('target_screen', 'google_review')
    .gte('created_at', since)
    .contains('payload', { session_id: sessionId })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('google-review-pending', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    pending: (data?.length ?? 0) > 0,
    configured: true,
  })
}
