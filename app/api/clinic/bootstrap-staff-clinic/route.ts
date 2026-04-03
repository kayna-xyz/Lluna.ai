import { getAuthSupabase } from '@/lib/supabase/server-auth'
import { getServiceSupabase } from '@/lib/supabase/admin'
import type { ClinicMenu } from '@/lib/clinic-menu'

function makeUniqueSlug(): string {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `cl-${part}`
}

function deriveClinicName(params: {
  metadataClinicName: string | null
  email: string | null
}): string {
  const named = params.metadataClinicName?.trim()
  if (named && named.length > 0) {
    return named.length > 120 ? `${named.slice(0, 117)}…` : named
  }
  const local = params.email?.split('@')[0]?.trim()
  if (local) return `${local}'s clinic`
  return 'My clinic'
}

/**
 * Idempotent: creates a dedicated `clinics` row + settings + empty menu, binds `clinic_staff_profiles`,
 * or returns existing binding. Staff-only (must have `clinic_staff_profiles`).
 */
export async function POST() {
  const auth = await getAuthSupabase()
  const {
    data: { user },
    error: authErr,
  } = await auth.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = getServiceSupabase()
  if (!svc) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { data: profile, error: pErr } = await svc
    .from('clinic_staff_profiles')
    .select('clinic_id, address')
    .eq('user_id', user.id)
    .maybeSingle()

  if (pErr) {
    return Response.json({ error: pErr.message }, { status: 500 })
  }
  if (!profile) {
    return Response.json({ error: 'Not a clinic staff account' }, { status: 403 })
  }

  if (profile.clinic_id) {
    const { data: clinic, error: cErr } = await svc
      .from('clinics')
      .select('id, slug, name')
      .eq('id', profile.clinic_id as string)
      .maybeSingle()
    if (cErr) {
      return Response.json({ error: cErr.message }, { status: 500 })
    }
    if (!clinic?.id) {
      return Response.json({ error: 'Clinic record missing' }, { status: 500 })
    }
    return Response.json({
      slug: clinic.slug as string,
      name: clinic.name as string,
      clinicId: clinic.id as string,
      alreadyBound: true,
    })
  }

  const meta = user.user_metadata as Record<string, unknown>
  const fromMeta =
    typeof meta.clinic_name === 'string' ? meta.clinic_name : typeof meta.clinicName === 'string' ? meta.clinicName : null

  const displayName = deriveClinicName({
    metadataClinicName: fromMeta,
    email: user.email ?? null,
  })

  const now = new Date().toISOString()
  let lastSlugError: string | null = null

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = makeUniqueSlug()

    const { data: inserted, error: insErr } = await svc
      .from('clinics')
      .insert({ slug, name: displayName })
      .select('id, slug, name')
      .single()

    if (insErr) {
      if (insErr.code === '23505' || /duplicate|unique/i.test(insErr.message)) {
        lastSlugError = insErr.message
        continue
      }
      return Response.json({ error: insErr.message }, { status: 500 })
    }

    if (!inserted?.id) {
      return Response.json({ error: 'Clinic insert failed' }, { status: 500 })
    }

    const clinicId = inserted.id as string

    const emptyMenu: ClinicMenu = {
      clinicName: displayName,
      treatments: [],
    }

    const { error: setErr } = await svc.from('clinic_settings').insert({
      clinic_id: clinicId,
      refer_bonus_usd: 20,
      tagline: null,
      public_activities: [],
      public_testimonials: [],
      updated_at: now,
    })
    if (setErr) {
      await svc.from('clinics').delete().eq('id', clinicId)
      return Response.json({ error: setErr.message }, { status: 500 })
    }

    const { error: menuErr } = await svc.from('clinic_menu_store').insert({
      clinic_id: clinicId,
      menu_json: emptyMenu,
      is_active: true,
      updated_at: now,
    })
    if (menuErr) {
      await svc.from('clinic_settings').delete().eq('clinic_id', clinicId)
      await svc.from('clinics').delete().eq('id', clinicId)
      return Response.json({ error: menuErr.message }, { status: 500 })
    }

    const { data: updated, error: uErr } = await svc
      .from('clinic_staff_profiles')
      .update({ clinic_id: clinicId, updated_at: now })
      .eq('user_id', user.id)
      .is('clinic_id', null)
      .select('user_id')
      .maybeSingle()

    if (uErr) {
      await svc.from('clinic_menu_store').delete().eq('clinic_id', clinicId)
      await svc.from('clinic_settings').delete().eq('clinic_id', clinicId)
      await svc.from('clinics').delete().eq('id', clinicId)
      return Response.json({ error: uErr.message }, { status: 500 })
    }

    if (!updated) {
      const { data: existing } = await svc
        .from('clinic_staff_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle()
      const existingId = existing?.clinic_id as string | undefined
      if (existingId && existingId !== clinicId) {
        await svc.from('clinic_menu_store').delete().eq('clinic_id', clinicId)
        await svc.from('clinic_settings').delete().eq('clinic_id', clinicId)
        await svc.from('clinics').delete().eq('id', clinicId)
        const { data: c2 } = await svc
          .from('clinics')
          .select('id, slug, name')
          .eq('id', existingId)
          .maybeSingle()
        if (c2) {
          return Response.json({
            slug: c2.slug as string,
            name: c2.name as string,
            clinicId: c2.id as string,
            alreadyBound: true,
          })
        }
      }
      return Response.json({ error: 'Could not bind clinic to profile' }, { status: 409 })
    }

    return Response.json({
      slug: inserted.slug as string,
      name: inserted.name as string,
      clinicId,
      alreadyBound: false,
    })
  }

  return Response.json(
    { error: lastSlugError || 'Could not allocate unique clinic slug' },
    { status: 500 },
  )
}
