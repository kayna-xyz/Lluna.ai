import { setAdvisorClinicSlug } from '@/app/clinicside/lib/clinic-api'

/** Creates & binds a dedicated clinic for clinic_staff on first login; idempotent. Sets localStorage slug. */
export async function ensureStaffClinicSlug(): Promise<
  { ok: true; slug: string } | { ok: false; error: string }
> {
  try {
    const res = await fetch('/api/clinic/bootstrap-staff-clinic', {
      method: 'POST',
      credentials: 'same-origin',
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; slug?: string }
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'Request failed',
      }
    }
    const slug = data.slug
    if (typeof slug !== 'string' || !slug.trim()) {
      return { ok: false, error: 'Invalid response' }
    }
    setAdvisorClinicSlug(slug)
    return { ok: true, slug: slug.trim() }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}
