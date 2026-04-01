import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_CLINIC_SLUG = 'default'

export type ResolvedClinic = { id: string; slug: string; name: string }

function pickClinicRef(req: Request, body?: Record<string, unknown>): { id?: string; slug?: string } {
  const hid = req.headers.get('x-clinic-id')?.trim()
  const hslug = req.headers.get('x-clinic-slug')?.trim()
  if (hid) return { id: hid }
  if (hslug) return { slug: hslug }
  try {
    const u = new URL(req.url)
    const qId = u.searchParams.get('clinicId')?.trim()
    const qSlug =
      u.searchParams.get('clinic')?.trim() ||
      u.searchParams.get('clinicSlug')?.trim()
    if (qId) return { id: qId }
    if (qSlug) return { slug: qSlug }
  } catch {
    /* ignore */
  }
  if (body) {
    const bid = typeof body.clinicId === 'string' ? body.clinicId.trim() : ''
    const bslug = typeof body.clinicSlug === 'string' ? body.clinicSlug.trim() : ''
    if (bid) return { id: bid }
    if (bslug) return { slug: bslug }
  }
  return {}
}

/**
 * Resolve tenant from headers (?X-Clinic-Id / X-Clinic-Slug), URL (?clinicId / clinic / clinicSlug), or JSON body.
 * Falls back to slug `default` when nothing matches (backward compatible).
 */
export async function resolveClinicForRequest(
  supabase: SupabaseClient,
  req: Request,
  jsonBody?: Record<string, unknown>,
): Promise<{ ok: true; clinic: ResolvedClinic } | { ok: false; status: number; error: string }> {
  const ref = pickClinicRef(req, jsonBody)
  const slugFallback = ref.id ? null : ref.slug || DEFAULT_CLINIC_SLUG

  if (ref.id) {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, slug, name')
      .eq('id', ref.id)
      .maybeSingle()
    if (error) {
      return { ok: false, status: 500, error: error.message }
    }
    if (!data?.id) {
      return { ok: false, status: 400, error: 'Unknown clinicId' }
    }
    return {
      ok: true,
      clinic: { id: data.id as string, slug: data.slug as string, name: data.name as string },
    }
  }

  const { data, error } = await supabase
    .from('clinics')
    .select('id, slug, name')
    .eq('slug', slugFallback || DEFAULT_CLINIC_SLUG)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }
  if (!data?.id) {
    return { ok: false, status: 500, error: 'Default clinic missing; run migration 007' }
  }
  return {
    ok: true,
    clinic: { id: data.id as string, slug: data.slug as string, name: data.name as string },
  }
}
