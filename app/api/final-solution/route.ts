import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function mergeReportData(
  prev: Record<string, unknown> | null,
  plan: Record<string, unknown>,
): Record<string, unknown> {
  const base = prev && typeof prev === 'object' ? { ...prev } : {}
  return { ...base, consultantFinalPlan: plan }
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : ''
  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 })
  }

  const tenant = await resolveClinicForRequest(supabase, req, body)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }
  const clinicId = tenant.clinic.id

  const total_price = Number(body.total_price)
  if (!Number.isFinite(total_price)) {
    return Response.json({ error: 'total_price must be a number' }, { status: 400 })
  }

  const consultantFinalPlan = {
    final_plan_text: typeof body.final_plan_text === 'string' ? body.final_plan_text : '',
    total_price,
    therapies: Array.isArray(body.therapies) ? body.therapies : [],
    submitted_at: new Date().toISOString(),
  }

  const now = new Date().toISOString()

  const { data: clientRow, error: fetchErr } = await supabase
    .from('clients')
    .select('report_data')
    .eq('clinic_id', clinicId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (fetchErr) {
    console.error('final-solution fetch client', fetchErr)
    return Response.json({ error: fetchErr.message }, { status: 500 })
  }

  const prevRd =
    clientRow?.report_data && typeof clientRow.report_data === 'object'
      ? (clientRow.report_data as Record<string, unknown>)
      : {}

  const report_data = mergeReportData(prevRd, consultantFinalPlan)

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existingClient) {
    const { error: u1 } = await supabase
      .from('clients')
      .update({
        report_data,
        total_price,
      })
      .eq('clinic_id', clinicId)
      .eq('session_id', sessionId)
    if (u1) {
      console.error('final-solution update clients', u1)
      return Response.json({ error: u1.message }, { status: 500 })
    }
  } else {
    const { error: ins } = await supabase.from('clients').insert({
      clinic_id: clinicId,
      session_id: sessionId,
      report_data,
      total_price,
    })
    if (ins) {
      console.error('final-solution insert clients', ins)
      return Response.json({ error: ins.message }, { status: 500 })
    }
  }

  let targetPendingId = reportId
  let pend: { report_data?: unknown } | null = null

  if (targetPendingId) {
    const { data: byId } = await supabase
      .from('pending_reports')
      .select('id, report_data')
      .eq('id', targetPendingId)
      .eq('clinic_id', clinicId)
      .maybeSingle()
    if (byId) {
      pend = { report_data: byId.report_data }
    } else {
      targetPendingId = ''
    }
  }

  if (!targetPendingId) {
    const { data: latestBySession } = await supabase
      .from('pending_reports')
      .select('id, report_data')
      .eq('clinic_id', clinicId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestBySession?.id) {
      targetPendingId = String(latestBySession.id)
      pend = { report_data: latestBySession.report_data }
    }
  }

  const pendPrev =
    pend?.report_data && typeof pend.report_data === 'object'
      ? (pend.report_data as Record<string, unknown>)
      : prevRd

  const mergedPending = mergeReportData(pendPrev, consultantFinalPlan)

  const desiredStatus = 'final_plan_submitted'

  const updatePendingStatus = async (statusKey: 'status' | 'status_text') => {
    if (!targetPendingId) {
      return { message: 'target pending report not found' } as unknown as { message: string }
    }
    const { error: u } = await supabase
      .from('pending_reports')
      .update({
        report_data: mergedPending,
        [statusKey]: desiredStatus,
      })
      .eq('id', targetPendingId)
    return u ?? null
  }

  // Try `status` first, then fall back to `status_text`.
  let pendingErr = await updatePendingStatus('status')
  if (pendingErr) pendingErr = await updatePendingStatus('status_text')
  if (pendingErr) console.error('final-solution update pending', pendingErr)

  const { error: evErr } = await supabase.from('consultant_events').insert({
    clinic_id: clinicId,
    event_type: 'final_plan_submitted',
    target_screen: 'google_review',
    payload: { session_id: sessionId },
  })
  if (evErr) {
    console.error('final-solution consultant_events', evErr)
  }

  return Response.json({ ok: true, report_data })
}
