import { getServiceSupabase } from '@/lib/supabase/admin'
import { getAuthSupabase } from '@/lib/supabase/server-auth'
import type { StoredReportData } from '@/lib/report-payload'
import { resolveClinicForRequest } from '@/lib/tenant'
import { POST as generateConsultantBrief } from '@/app/api/consultant-brief/route'
import { POST as generateSalesMethodology } from '@/app/api/sales-methodology/route'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** True if this row is still an open questionnaire (not yet advanced by consultant flow). */
function pendingReportStillOpen(row: { status?: unknown; status_text?: unknown }): boolean {
  const s = String(row.status ?? '').trim()
  const st = String(row.status_text ?? '').trim()
  const effective = s || st
  if (!effective) return true
  if (effective === 'pending' || effective === 'new') return true
  return false
}

async function callInternalPost<T = Record<string, unknown>>(
  handler: (req: Request) => Promise<Response>,
  payload: Record<string, unknown>,
): Promise<T | null> {
  try {
    const req = new Request('http://internal.local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const res = await handler(req)
    if (!res.ok) return null
    return (await res.json().catch(() => null)) as T | null
  } catch {
    return null
  }
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
  const recommendation = ((reportData.recommendation ?? {}) as Record<string, unknown>)
  let generatedBriefObj = asRec(recommendation.consultantBrief)
  let generatedBrief =
    typeof body.reportSummary === 'string'
      ? body.reportSummary
      : String(recommendation.consultantProfileSummary || '')
  let generatedMethod = asRec(recommendation.salesMethodology)
  let generatedSales: { type: string; text: string }[] = Array.isArray(recommendation.salesSentences)
    ? (recommendation.salesSentences as { type?: unknown; text?: unknown }[])
        .map((x) => ({ type: String(x.type || ''), text: String(x.text || '') }))
        .filter((x) => x.type && x.text)
        .slice(0, 3)
    : []

  // Generate and persist consultant brief + sales methodology at report-receive time.
  const briefResult = await callInternalPost<{ consultantProfileSummary?: unknown; consultantBrief?: unknown }>(
    generateConsultantBrief,
    {
      sessionId,
      clinicId,
      reportData: reportData as unknown as Record<string, unknown>,
    },
  )
  if (briefResult?.consultantBrief && typeof briefResult.consultantBrief === 'object') {
    generatedBriefObj = briefResult.consultantBrief as Record<string, unknown>
  }
  if (typeof briefResult?.consultantProfileSummary === 'string' && briefResult.consultantProfileSummary.trim()) {
    generatedBrief = briefResult.consultantProfileSummary.trim()
  }
  const salesResult = await callInternalPost<{ salesSentences?: unknown; salesMethodology?: unknown }>(
    generateSalesMethodology,
    {
      sessionId,
      clinicId,
      reportData: reportData as unknown as Record<string, unknown>,
    },
  )
  if (salesResult?.salesMethodology && typeof salesResult.salesMethodology === 'object') {
    generatedMethod = salesResult.salesMethodology as Record<string, unknown>
  }
  if (Array.isArray(salesResult?.salesSentences)) {
    generatedSales = (salesResult.salesSentences as { type?: unknown; text?: unknown }[])
      .map((x) => ({ type: String(x.type || ''), text: String(x.text || '') }))
      .filter((x) => x.type && x.text)
      .slice(0, 3)
  }

  const enrichedReportData: StoredReportData = {
    ...reportData,
    recommendation: {
      ...recommendation,
      consultantProfileSummary: generatedBrief,
      consultantBrief: generatedBriefObj,
      salesMethodology: generatedMethod,
      salesSentences: generatedSales,
    },
  }
  const reportSummary = generatedBrief

  const ui = reportData.userInput
  const clientName = ui?.name ?? body.name ?? 'Unknown'
  const phone = ui?.phone ?? body.phone ?? null
  const email = ui?.email ?? body.email ?? null

  // ── Write to pending_reports ──
  // Same session + still-open questionnaire → UPDATE (duplicate submit / re-sync).
  // Otherwise INSERT (e.g. new visit after consultant marked final_plan_submitted).
  const pendingPayload = {
    clinic_id: clinicId,
    session_id: sessionId,
    client_name: clientName,
    phone,
    email,
    report_summary: reportSummary,
    report_data: enrichedReportData as unknown as Record<string, unknown>,
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

  if (latestPending?.id && pendingReportStillOpen(latestPending)) {
    const { error: pendingUpdateError } = await supabase
      .from('pending_reports')
      .update({
        ...pendingPayload,
        updated_at: nowIso,
      })
      .eq('id', latestPending.id as string)
    if (pendingUpdateError) {
      console.error('pending_reports update error:', pendingUpdateError)
      return Response.json({ error: pendingUpdateError.message }, { status: 500 })
    }
  } else {
    const { error: pendingInsertError } = await supabase.from('pending_reports').insert({
      ...pendingPayload,
      updated_at: nowIso,
    })
    if (pendingInsertError) {
      console.error('pending_reports insert error:', pendingInsertError)
      return Response.json({ error: pendingInsertError.message }, { status: 500 })
    }
  }

  // ── Write to clients ──
  // Schema: session_id, name (NOT NULL), phone, email, report_data
  const clientPayload = {
    clinic_id: clinicId,
    session_id: sessionId,
    name: clientName,
    phone,
    email,
    report_data: enrichedReportData as unknown as Record<string, unknown>,
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
    if (error) {
      console.error('clients update error:', error)
    }
  } else {
    const { error } = await supabase.from('clients').insert(clientPayload)
    if (error) {
      console.error('clients insert error:', error)
    }
  }

  return Response.json({ ok: true, sessionId, clinicId })
}
