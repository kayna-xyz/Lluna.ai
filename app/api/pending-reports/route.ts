import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function relTime(iso: string) {
  const t = new Date(iso).getTime()
  const d = Date.now() - t
  if (d < 60_000) return 'Just now'
  if (d < 3600_000) return `${Math.floor(d / 60_000)} min ago`
  if (d < 86400_000) return `${Math.floor(d / 3600_000)} h ago`
  return new Date(iso).toLocaleDateString()
}

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ items: [], configured: false })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const { data, error } = await supabase
    .from('pending_reports')
    .select('*')
    .eq('clinic_id', tenant.clinic.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('pending_reports', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const items = (data ?? []).map((row) => {
    const rd = asRecord(row.report_data)
    const ui = asRecord(rd.userInput)
    const rowRec = row as Record<string, unknown>
    const name = String(ui.name || rowRec.client_name || 'Unknown')
    const statusValue =
      rowRec.status ?? rowRec.status_text ?? null

    const isNew =
      statusValue === 'pending' || statusValue === 'new' || statusValue === null || statusValue === ''

    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      clientName: name,
      message: 'Completed questionnaire',
      time: relTime(row.created_at as string),
      isNew,
      reportType: 'questionnaire' as const,
      reportData: row.report_data,
      reportSummary: rowRec.report_summary as string | null,
    }
  })

  return Response.json({ items, configured: true })
}

export async function PATCH(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) return Response.json({ error: 'Not configured' }, { status: 503 })

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) return Response.json({ error: tenant.error }, { status: tenant.status })

  let id: string
  try {
    const body = await req.json()
    id = typeof body.id === 'string' ? body.id.trim() : ''
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('pending_reports')
    .update({ status: 'read', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', tenant.clinic.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
