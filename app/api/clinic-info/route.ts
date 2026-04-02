import { getServiceSupabase } from '@/lib/supabase/admin'
import { normalizeMdTeam } from '@/lib/clinic-public-page'
import { isHttpOrRelativeAssetUrl, uploadClinicBrandingDataUrl } from '@/lib/clinic-branding-upload'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function rowToInfoPayload(row: Record<string, unknown>) {
  const mdStored = normalizeMdTeam(row.public_md_team)
  return {
    clinicName: String(row.info_clinic_name ?? '').trim(),
    clinicPhone: String(row.info_phone ?? '').trim(),
    clinicEmail: String(row.info_email ?? '').trim(),
    clinicWorkTime: String(row.info_work_time ?? '').trim(),
    googleReviewLink: String(row.info_google_review_link ?? '').trim(),
    logoDataUrl: String(row.logo_url ?? '').trim(),
    mdTeam: mdStored.map((m) => ({
      id: m.id,
      name: m.name,
      about: m.about,
      experience: m.experience,
      photoDataUrl: m.photo_url,
    })),
  }
}

function settingsRowHasInfo(row: Record<string, unknown>): boolean {
  if (String(row.info_clinic_name || '').trim()) return true
  if (String(row.info_phone || '').trim()) return true
  if (String(row.info_email || '').trim()) return true
  if (String(row.info_work_time || '').trim()) return true
  if (String(row.info_google_review_link || '').trim()) return true
  if (String(row.logo_url || '').trim()) return true
  return normalizeMdTeam(row.public_md_team).length > 0
}

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ info: null, configured: false })
  }

  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }

  const { data: row, error } = await supabase
    .from('clinic_settings')
    .select(
      'info_clinic_name, info_phone, info_email, info_work_time, info_google_review_link, logo_url, public_md_team, clinic_info_revision',
    )
    .eq('clinic_id', tenant.clinic.id)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const r = row ? asRec(row) : {}
  const revision = Number(r.clinic_info_revision ?? 0)
  if (revision > 0 || settingsRowHasInfo(r)) {
    return Response.json({ info: rowToInfoPayload(r), configured: true, source: 'clinic_settings' as const })
  }

  const { data: ev, error: evErr } = await supabase
    .from('consultant_events')
    .select('payload')
    .eq('event_type', 'clinic_info_updated')
    .eq('clinic_id', tenant.clinic.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (evErr) {
    return Response.json({ error: evErr.message }, { status: 500 })
  }

  return Response.json({
    info: ev?.payload ? asRec(ev.payload as object) : null,
    configured: true,
    source: (ev?.payload ? 'consultant_events' : null) as 'consultant_events' | null,
  })
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

  const clinicName = String(body.clinicName ?? '').trim()
  const clinicPhone = String(body.clinicPhone ?? '').trim()
  const clinicEmail = String(body.clinicEmail ?? '').trim()
  const clinicWorkTime = String(body.clinicWorkTime ?? '').trim()
  const googleReviewLink = String(body.googleReviewLink ?? '').trim()

  let logoUrl = String(body.logoDataUrl ?? body.logoUrl ?? '').trim()
  if (logoUrl.startsWith('data:')) {
    const uploaded = await uploadClinicBrandingDataUrl(supabase, tenant.clinic.id, 'logo', logoUrl)
    if (!uploaded) {
      return Response.json({ error: 'Logo image upload failed' }, { status: 400 })
    }
    logoUrl = uploaded
  } else if (logoUrl && !isHttpOrRelativeAssetUrl(logoUrl)) {
    logoUrl = ''
  }

  const rawTeam = Array.isArray(body.mdTeam) ? body.mdTeam : []
  const publicMdTeam: Array<{
    id: string
    name: string
    about: string
    experience: string
    photo_url: string
  }> = []

  for (let i = 0; i < rawTeam.length; i++) {
    const tr = asRec(rawTeam[i])
    const id = String(tr.id || '').trim() || `md_${i}`
    let photo = String(tr.photoDataUrl ?? tr.photoUrl ?? '').trim()
    if (photo.startsWith('data:')) {
      const uploaded = await uploadClinicBrandingDataUrl(supabase, tenant.clinic.id, `md/${id}`, photo)
      if (!uploaded) {
        return Response.json({ error: `MD photo upload failed (${id})` }, { status: 400 })
      }
      photo = uploaded
    } else if (photo && !isHttpOrRelativeAssetUrl(photo)) {
      photo = ''
    }
    publicMdTeam.push({
      id,
      name: String(tr.name || '').trim(),
      about: String(tr.about || '').trim(),
      experience: String(tr.experience || '').trim(),
      photo_url: photo,
    })
  }

  const now = new Date().toISOString()
  const { data: prevRow } = await supabase
    .from('clinic_settings')
    .select('clinic_info_revision')
    .eq('clinic_id', tenant.clinic.id)
    .maybeSingle()
  const prevRev = Number((prevRow as { clinic_info_revision?: number } | null)?.clinic_info_revision ?? 0)

  const { error: upErr } = await supabase
    .from('clinic_settings')
    .update({
      info_clinic_name: clinicName || null,
      info_phone: clinicPhone || null,
      info_email: clinicEmail || null,
      info_work_time: clinicWorkTime || null,
      info_google_review_link: googleReviewLink || null,
      logo_url: logoUrl || null,
      public_md_team: publicMdTeam,
      clinic_info_revision: prevRev + 1,
      updated_at: now,
    })
    .eq('clinic_id', tenant.clinic.id)

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
