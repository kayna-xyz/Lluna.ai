import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId') ?? ''
  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }
  const clinicId = tenant.clinic.id

  const { data: row } = await supabase
    .from('pending_reports')
    .select('report_data')
    .eq('clinic_id', clinicId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) {
    return Response.json({ enriched: false })
  }

  const rd = asRec(row.report_data)
  const rec = asRec(rd.recommendation)
  const enrichedAt = typeof rec.enriched_at === 'string' ? rec.enriched_at : null

  if (!enrichedAt) {
    return Response.json({ enriched: false })
  }

  return Response.json({
    enriched: true,
    enriched_at: enrichedAt,
    additionalRecommendations: Array.isArray(rec.additionalRecommendations)
      ? rec.additionalRecommendations
      : [],
    beforeYouStepOut: Array.isArray(rec.beforeYouStepOut) ? rec.beforeYouStepOut : [],
    salesMethodologyNew: rec.salesMethodologyNew ?? null,
    patientSummaryStructured: rec.patientSummaryStructured ?? null,
  })
}
