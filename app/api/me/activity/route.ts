import { getAuthSupabase } from '@/lib/supabase/server-auth'
import { extractTherapyLabelsFromReportData } from '@/lib/extract-report-therapies'
import type { MeActivitySession, MeActivityVisit } from '@/lib/me-activity-types'

function pickClinic(embed: unknown): { name?: string; slug?: string } | null {
  if (!embed) return null
  if (Array.isArray(embed)) return (embed[0] as { name?: string; slug?: string }) || null
  return embed as { name?: string; slug?: string }
}

/**
 * GET: footprint (`user_clinic_visits`) + plans (`clients.report_data` consultant final plan) from Supabase.
 */
export async function GET(req: Request) {
  const supabase = await getAuthSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const focusSlug = searchParams.get('focus_clinic')?.trim() || null

  const { data: visitRows, error: vErr } = await supabase
    .from('user_clinic_visits')
    .select('first_visited_at, last_visited_at, visit_count, entry_via_qr, clinics(name, slug)')
    .eq('user_id', user.id)
    .order('last_visited_at', { ascending: false })

  if (vErr) {
    return Response.json({ error: vErr.message }, { status: 500 })
  }

  const { data: clientRows, error: cErr } = await supabase
    .from('clients')
    .select('updated_at, report_data, total_price, clinics(name, slug)')
    .eq('auth_user_id', user.id)
    .order('updated_at', { ascending: false })

  if (cErr) {
    return Response.json({ error: cErr.message }, { status: 500 })
  }

  const visits: MeActivityVisit[] = (visitRows ?? [])
    .map((row) => {
      const c = pickClinic(row.clinics)
      return {
        clinic_name: String(c?.name ?? '—'),
        clinic_slug: String(c?.slug ?? ''),
        first_visited_at: String(row.first_visited_at ?? ''),
        last_visited_at: String(row.last_visited_at ?? ''),
        visit_count: Number(row.visit_count ?? 1),
        entry_via_qr: Boolean(row.entry_via_qr),
      }
    })
    .filter((v) => !focusSlug || v.clinic_slug === focusSlug)

  const sessionsRaw = clientRows ?? []
  const sessions: MeActivitySession[] = sessionsRaw
    .map((row) => {
      const c = pickClinic(row.clinics)
      const slug = String(c?.slug ?? '')
      if (focusSlug && slug !== focusSlug) return null
      // Only surface records where the consultant has submitted a final plan
      const rd = row.report_data && typeof row.report_data === 'object'
        ? (row.report_data as Record<string, unknown>)
        : {}
      const hasSubmission = rd.consultantFinalPlan != null || (row.total_price != null && row.total_price !== '')
      if (!hasSubmission) return null
      return {
        clinic_name: String(c?.name ?? '—'),
        clinic_slug: slug,
        updated_at: String(row.updated_at ?? ''),
        treatments: extractTherapyLabelsFromReportData(row.report_data),
        total_price:
          row.total_price != null && row.total_price !== ''
            ? Number(row.total_price)
            : null,
      }
    })
    .filter((x): x is MeActivitySession => x != null)

  return Response.json({ visits, sessions })
}
