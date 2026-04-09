import { after } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { getAuthSupabase } from '@/lib/supabase/server-auth'
import type { StoredReportData } from '@/lib/report-payload'
import { resolveClinicForRequest } from '@/lib/tenant'
import { enrichReportAsync, generateFastEnrichment, generateCategoryRecsDirectly } from '@/lib/report-enrichment'


function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** Collect all treatmentIds already present in Essential/Optimal/Premium plans. */
function extractPlanTreatmentIds(reportData: StoredReportData): Set<string> {
  const ids = new Set<string>()
  const rec = asRec((reportData as unknown as Record<string, unknown>).recommendation)
  const plans = Array.isArray(rec.plans) ? (rec.plans as Record<string, unknown>[]) : []
  for (const plan of plans) {
    const treatments = Array.isArray(plan.treatments) ? (plan.treatments as Record<string, unknown>[]) : []
    for (const t of treatments) {
      const id = String(t.treatmentId || '').trim()
      if (id) ids.add(id)
    }
  }
  return ids
}

export const maxDuration = 60

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
  const userInput = (reportData.userInput ?? {}) as Record<string, unknown>
  const recommendation = (reportData.recommendation ?? {}) as Record<string, unknown>
  const planTreatmentIds = extractPlanTreatmentIds(reportData)

  const ui = reportData.userInput
  const clientName = ui?.name ?? body.name ?? 'Unknown'
  const phone = ui?.phone ?? body.phone ?? null
  const email = ui?.email ?? body.email ?? null

  // ── 1. Write base report to DB + run fast AI enrichment in parallel ──────────
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

  const nowIso = new Date().toISOString()
  let pendingReportId: string | null = null

  const { data: inserted, error: insertErr } = await supabase
    .from('pending_reports')
    .insert({ ...pendingPayload, created_at: nowIso, updated_at: nowIso })
    .select('id')
    .single()
  if (insertErr) {
    console.error('pending_reports insert error:', insertErr)
    return Response.json({ error: insertErr.message }, { status: 500 })
  }
  pendingReportId = inserted?.id ?? null

  // ── 2. Write base report to clients ──────────────────────────────────────────
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

  // ── 3. Fire all enrichment in background (category recs run first in enrichReportAsync) ──
  // enrichReportAsync: step 2 = category recs, step 3 = consultant brief, step 5 = sales
  if (pendingReportId) {
    after(() => enrichReportAsync(pendingReportId!, clinicId, userInput, planTreatmentIds))
  }

  console.log(`[new-report] response sent — enrichment queued in after() for reportId:${pendingReportId}`)

  return Response.json({
    ok: true,
    sessionId,
    clinicId,
  })
}
