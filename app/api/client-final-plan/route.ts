import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

/** Read-only: consultant final plan for the user's session (stored on `clients.report_data`). */
export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ finalPlan: null, configured: false })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = (searchParams.get('session_id') || '').trim()
  if (!sessionId) {
    return Response.json({ error: 'session_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clients')
    .select('report_data')
    .eq('clinic_id', tenant.clinic.id)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) {
    console.error('client-final-plan', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const rd = data?.report_data && typeof data.report_data === 'object' ? (data.report_data as Record<string, unknown>) : {}
  const raw = rd.consultantFinalPlan
  if (!raw || typeof raw !== 'object') {
    return Response.json({ finalPlan: null, configured: true })
  }

  const fp = raw as Record<string, unknown>
  const finalPlan = {
    final_plan_text: typeof fp.final_plan_text === 'string' ? fp.final_plan_text : '',
    total_price: Number(fp.total_price),
    therapies: Array.isArray(fp.therapies) ? fp.therapies : [],
    submitted_at: typeof fp.submitted_at === 'string' ? fp.submitted_at : '',
  }

  const hasContent =
    finalPlan.final_plan_text.trim() !== '' ||
    (Array.isArray(finalPlan.therapies) && finalPlan.therapies.length > 0) ||
    Number.isFinite(finalPlan.total_price)

  if (!hasContent) {
    return Response.json({ finalPlan: null, configured: true })
  }

  return Response.json({ finalPlan, configured: true })
}
