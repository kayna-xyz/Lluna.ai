import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ clients: [], configured: false })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  const { data, error } = await supabase
    .from('pending_reports')
    .select('id, session_id, client_name, phone, email, report_data, report_summary, created_at')
    .eq('clinic_id', tenant.clinic.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('clients list', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  let rows = data ?? []
  if (q) {
    rows = rows.filter((row) => {
      const rd = asRecord(row.report_data)
      const ui = asRecord(rd.userInput)
      const name = String((row as Record<string, unknown>).client_name || ui.name || '').toLowerCase()
      const phone = String(row.phone || ui.phone || '').toLowerCase()
      const goals = String(ui.goals || '').toLowerCase()
      return name.includes(q) || phone.includes(q) || goals.includes(q)
    })
  }

  const normalized = rows.map((row) => ({
    ...row,
    name: (row as Record<string, unknown>).client_name || asRecord(asRecord(row.report_data).userInput).name || 'Unknown',
  }))

  return Response.json({ clients: normalized, configured: true })
}
