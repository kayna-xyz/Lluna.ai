import { after } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { getAuthSupabase } from '@/lib/supabase/server-auth'
import type { StoredReportData } from '@/lib/report-payload'
import { resolveClinicForRequest } from '@/lib/tenant'
import { enrichReportAsync, generateFastEnrichment } from '@/lib/report-enrichment'

/** True if this row is still an open questionnaire (not yet advanced by consultant flow). */
function pendingReportStillOpen(row: { status?: unknown; status_text?: unknown }): boolean {
  const s = String(row.status ?? '').trim()
  const st = String(row.status_text ?? '').trim()
  const effective = s || st
  if (!effective) return true
  if (effective === 'pending' || effective === 'new') return true
  return false
}

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

  // ── 3. Fast enrichment: patientSummaryStructured + additionalRecommendations ──
  // Hard 9s timeout so a slow AI call never causes a Vercel function timeout.
  const FAST_TIMEOUT_MS = 6000
  const fastFallback = { patientSummaryStructured: null, additionalRecommendations: [] as Array<{ name: string; price: number; reason: string }> }
  const fast = await Promise.race([
    generateFastEnrichment(clinicId, userInput, planTreatmentIds),
    new Promise<typeof fastFallback>((resolve) => setTimeout(() => resolve(fastFallback), FAST_TIMEOUT_MS)),
  ]).catch((e) => {
    console.error('[new-report] fast enrichment failed:', e instanceof Error ? e.message : e)
    return fastFallback
  })

  // Write fast results to DB so consultant sees them immediately
  if (pendingReportId && (fast.patientSummaryStructured || fast.additionalRecommendations.length)) {
    const rd = asRec(reportData)
    const rec = asRec(rd.recommendation)
    const fastRec: Record<string, unknown> = {
      ...rec,
      ...(fast.patientSummaryStructured ? { patientSummaryStructured: fast.patientSummaryStructured } : {}),
      ...(fast.additionalRecommendations.length ? { additionalRecommendations: fast.additionalRecommendations } : {}),
    }
    const fastRd = { ...rd, recommendation: fastRec }
    void supabase.from('pending_reports').update({ report_data: fastRd }).eq('id', pendingReportId)
    void supabase.from('clients').update({ report_data: fastRd })
      .eq('clinic_id', clinicId).eq('session_id', sessionId)
  }

  // ── 4. Fire background enrichment for consultantBrief + salesMethodology ─────
  if (pendingReportId) {
    after(() => enrichReportAsync(pendingReportId!, clinicId, userInput, planTreatmentIds))
  }

  return Response.json({
    ok: true,
    sessionId,
    clinicId,
    additionalRecommendations: fast.additionalRecommendations,
    patientSummaryStructured: fast.patientSummaryStructured,
  })
}
