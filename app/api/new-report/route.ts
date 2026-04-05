import { after } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { getAuthSupabase } from '@/lib/supabase/server-auth'
import type { StoredReportData } from '@/lib/report-payload'
import { resolveClinicForRequest } from '@/lib/tenant'
import { enrichReportAsync } from '@/lib/report-enrichment'

/** True if this row is still an open questionnaire (not yet advanced by consultant flow). */
function pendingReportStillOpen(row: { status?: unknown; status_text?: unknown }): boolean {
  const s = String(row.status ?? '').trim()
  const st = String(row.status_text ?? '').trim()
  const effective = s || st
  if (!effective) return true
  if (effective === 'pending' || effective === 'new') return true
  return false
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json(
      { error: 'Supabase not configured (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 503 },
    )
  }

  const authSb = await getAuthSupabase()
  const {
    data: { user: authUser },
  } = await authSb.auth.getUser()
  const authUserId = authUser?.id ?? null

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 })
  }

  const tenant = await resolveClinicForRequest(supabase, req, body)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }
  const clinicId = tenant.clinic.id

  const reportData = (body.reportData ?? {}) as StoredReportData

  const ui = reportData.userInput
  const clientName = ui?.name ?? body.name ?? 'Unknown'
  const phone = ui?.phone ?? body.phone ?? null
  const email = ui?.email ?? body.email ?? null

  // ── Write base report to pending_reports ──────────────────────────────────
  // No AI calls here — enrichment runs in the background after response.
  const pendingPayload = {
    clinic_id: clinicId,
    session_id: sessionId,
    client_name: clientName,
    phone,
    email,
    report_summary: null,
    report_data: reportData as unknown as Record<string, unknown>,
    status: 'pending',
  }

  const { data: latestPending } = await supabase
    .from('pending_reports')
    .select('id, status, status_text')
    .eq('clinic_id', clinicId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  let pendingReportId: string | null = null

  if (latestPending?.id && pendingReportStillOpen(latestPending)) {
    const { error: pendingUpdateError } = await supabase
      .from('pending_reports')
      .update({ ...pendingPayload, updated_at: nowIso })
      .eq('id', latestPending.id as string)
    if (pendingUpdateError) {
      console.error('pending_reports update error:', pendingUpdateError)
      return Response.json({ error: pendingUpdateError.message }, { status: 500 })
    }
    pendingReportId = latestPending.id as string
  } else {
    const { data: inserted, error: pendingInsertError } = await supabase
      .from('pending_reports')
      .insert({ ...pendingPayload, updated_at: nowIso })
      .select('id')
      .single()
    if (pendingInsertError) {
      console.error('pending_reports insert error:', pendingInsertError)
      return Response.json({ error: pendingInsertError.message }, { status: 500 })
    }
    pendingReportId = inserted?.id ?? null
  }

  // ── Write base report to clients ──────────────────────────────────────────
  const clientPayload = {
    clinic_id: clinicId,
    session_id: sessionId,
    name: clientName,
    phone,
    email,
    report_data: reportData as unknown as Record<string, unknown>,
    ...(authUserId ? { auth_user_id: authUserId } : {}),
  }

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existingClient) {
    const { error } = await supabase
      .from('clients')
      .update(clientPayload)
      .eq('clinic_id', clinicId)
      .eq('session_id', sessionId)
    if (error) console.error('clients update error:', error)
  } else {
    const { error } = await supabase.from('clients').insert(clientPayload)
    if (error) console.error('clients insert error:', error)
  }

  // ── Fire background enrichment (non-blocking) ─────────────────────────────
  if (pendingReportId) {
    const userInput = (reportData.userInput ?? {}) as Record<string, unknown>
    after(() => enrichReportAsync(pendingReportId!, clinicId, userInput))
  }

  return Response.json({ ok: true, sessionId, clinicId })
}
