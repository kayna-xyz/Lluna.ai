import { getServiceSupabase } from '@/lib/supabase/admin'
import { normalizeActivities, normalizeTestimonials } from '@/lib/clinic-public-page'
import { resolveClinicForRequest } from '@/lib/tenant'

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({
      referBonusUsd: 20,
      tagline: null,
      publicActivities: [],
      publicTestimonials: [],
      configured: false,
    })
  }
  const tenant = await resolveClinicForRequest(supabase, req)
  if (!tenant.ok) {
    return Response.json({ error: tenant.error }, { status: tenant.status })
  }
  const { data, error } = await supabase
    .from('clinic_settings')
    .select('refer_bonus_usd, tagline, public_activities, public_testimonials')
    .eq('clinic_id', tenant.clinic.id)
    .maybeSingle()
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  const row = data ? asRec(data) : {}
  return Response.json({
    referBonusUsd: Number(row.refer_bonus_usd ?? 20),
    tagline: row.tagline != null && String(row.tagline).trim() ? String(row.tagline).trim() : null,
    publicActivities: normalizeActivities(row.public_activities),
    publicTestimonials: normalizeTestimonials(row.public_testimonials),
    configured: true,
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

  const { data: existing, error: fetchErr } = await supabase
    .from('clinic_settings')
    .select('refer_bonus_usd, tagline, public_activities, public_testimonials')
    .eq('clinic_id', tenant.clinic.id)
    .maybeSingle()
  if (fetchErr) {
    return Response.json({ error: fetchErr.message }, { status: 500 })
  }
  const ex = existing ? asRec(existing) : {}

  const referIn = body.referBonusUsd
  const referBonusUsd =
    referIn !== undefined && referIn !== null && String(referIn).trim() !== ''
      ? Number(referIn)
      : Number(ex.refer_bonus_usd ?? 20)
  if (!Number.isFinite(referBonusUsd) || referBonusUsd < 0) {
    return Response.json({ error: 'referBonusUsd must be a non-negative number' }, { status: 400 })
  }

  let tagline: string | null =
    ex.tagline != null && String(ex.tagline).trim() ? String(ex.tagline).trim() : null
  if (body.tagline !== undefined) {
    const t = String(body.tagline ?? '').trim()
    tagline = t.length ? t : null
  }

  let publicActivities = normalizeActivities(ex.public_activities)
  if (body.publicActivities !== undefined) {
    publicActivities = normalizeActivities(body.publicActivities)
  }

  let publicTestimonials = normalizeTestimonials(ex.public_testimonials)
  if (body.publicTestimonials !== undefined) {
    publicTestimonials = normalizeTestimonials(body.publicTestimonials)
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('clinic_settings').upsert(
    {
      clinic_id: tenant.clinic.id,
      refer_bonus_usd: referBonusUsd,
      tagline,
      public_activities: publicActivities,
      public_testimonials: publicTestimonials,
      updated_at: now,
    },
    { onConflict: 'clinic_id' },
  )
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({
    ok: true,
    referBonusUsd,
    tagline,
    publicActivities,
    publicTestimonials,
  })
}
