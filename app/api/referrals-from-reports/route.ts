import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** referral field = friend's phone (referred). name = referrer (person who filled survey). */
export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({
      referrals: [],
      topReferrers: [],
      configured: false,
    })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const pRes = await supabase
    .from('pending_reports')
    .select('id, session_id, report_data, created_at')
    .eq('clinic_id', tenant.clinic.id)
    .order('created_at', { ascending: false })

  if (pRes.error) {
    console.error(pRes.error)
    return Response.json(
      { error: pRes.error.message },
      { status: 500 },
    )
  }

  type Row = {
    id: string
    session_id: string
    report_data: unknown
    created_at: string
    source: 'client' | 'pending'
  }

  const rows = (pRes.data ?? []).map((r) => ({
    ...(r as Row),
    source: 'pending' as const,
  }))

  const referrals: {
    id: string
    referredPhone: string
    dateISO: string
    referrerName: string
    source: string
  }[] = []

  const referrerCounts = new Map<string, number>()

  for (const row of rows) {
    const rd = asRecord(row.report_data)
    const ui = asRecord(rd.userInput)
    const referred = String(ui.referral || '').trim()
    const referrerName = String(ui.name || '').trim()
    if (!referred || !referrerName) continue

    const dateISO = row.created_at
    referrals.push({
      id: `${row.source}-${row.id}`,
      referredPhone: referred,
      dateISO,
      referrerName,
      source: row.source,
    })
    referrerCounts.set(referrerName, (referrerCounts.get(referrerName) ?? 0) + 1)
  }

  const topReferrers = [...referrerCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  referrals.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime())

  return Response.json({ referrals, topReferrers, configured: true })
}
