import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'
import { POST as generateConsultantBrief } from '@/app/api/consultant-brief/route'
import { POST as generateSalesMethodology } from '@/app/api/sales-methodology/route'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
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
    return Response.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const tenant = await resolveClinicForRequest(supabase, req, body)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }
  const clinicId = tenant.clinic.id

  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 1000)

  const { data, error } = await supabase
    .from('pending_reports')
    .select('id, session_id, report_data, report_summary')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let scanned = 0
  let updated = 0
  let skipped = 0
  const failed: string[] = []

  for (const row of data ?? []) {
    scanned += 1
    const rowRec = row as Record<string, unknown>
    const reportData = asRec(rowRec.report_data)
    const ui = asRec(reportData.userInput)
    if (!Object.keys(ui).length) {
      skipped += 1
      continue
    }
    const rec = asRec(reportData.recommendation)
    const existingBriefObj = asRec(rec.consultantBrief)
    const existingBrief = String(rec.consultantProfileSummary || rowRec.report_summary || '').trim()
    const existingMethod = asRec(rec.salesMethodology)
    const existingSales = Array.isArray(rec.salesSentences)
      ? (rec.salesSentences as { type?: unknown; text?: unknown }[])
          .map((x) => ({ type: String(x.type || ''), text: String(x.text || '') }))
          .filter((x) => x.type && x.text)
      : []

    if (existingBrief && Object.keys(existingBriefObj).length > 0 && Object.keys(existingMethod).length > 0) {
      skipped += 1
      continue
    }

    const sessionId = String(rowRec.session_id || '').trim()
    let briefObj = existingBriefObj
    let brief = existingBrief
    let method = existingMethod
    let sales = existingSales.slice(0, 3)

    if (!brief || Object.keys(briefObj).length === 0) {
      const briefResult = await callInternalPost<{ consultantProfileSummary?: unknown; consultantBrief?: unknown }>(
        generateConsultantBrief,
        { sessionId, clinicId, reportData },
      )
      if (briefResult?.consultantBrief && typeof briefResult.consultantBrief === 'object') {
        briefObj = briefResult.consultantBrief as Record<string, unknown>
      }
      if (typeof briefResult?.consultantProfileSummary === 'string' && briefResult.consultantProfileSummary.trim()) {
        brief = briefResult.consultantProfileSummary.trim()
      }
    }

    if (Object.keys(method).length === 0 || sales.length < 3) {
      const salesResult = await callInternalPost<{ salesSentences?: unknown; salesMethodology?: unknown }>(
        generateSalesMethodology,
        { sessionId, clinicId, reportData },
      )
      if (salesResult?.salesMethodology && typeof salesResult.salesMethodology === 'object') {
        method = salesResult.salesMethodology as Record<string, unknown>
      }
      if (Array.isArray(salesResult?.salesSentences)) {
        sales = (salesResult.salesSentences as { type?: unknown; text?: unknown }[])
          .map((x) => ({ type: String(x.type || ''), text: String(x.text || '') }))
          .filter((x) => x.type && x.text)
          .slice(0, 3)
      }
    }

    const enrichedReportData = {
      ...reportData,
      recommendation: {
        ...rec,
        ...(Object.keys(briefObj).length ? { consultantBrief: briefObj } : {}),
        ...(brief ? { consultantProfileSummary: brief } : {}),
        ...(Object.keys(method).length ? { salesMethodology: method } : {}),
        ...(sales.length ? { salesSentences: sales } : {}),
      },
    }

    const { error: updateError } = await supabase
      .from('pending_reports')
      .update({
        report_summary: brief || null,
        report_data: enrichedReportData,
      })
      .eq('id', String(rowRec.id || ''))
      .eq('clinic_id', clinicId)

    if (updateError) {
      failed.push(String(rowRec.id || 'unknown'))
      continue
    }

    updated += 1
  }

  return Response.json({
    ok: true,
    scanned,
    updated,
    skipped,
    failedCount: failed.length,
    failedIds: failed.slice(0, 30),
  })
}

