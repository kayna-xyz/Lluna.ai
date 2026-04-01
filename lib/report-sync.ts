import { getConsumerClinicSlug } from './consumer-clinic'
import { buildNewReportBody, withClinicOnReportBody, type NewReportBodyExtras } from './report-payload'

export type SyncReportSlice = Parameters<typeof buildNewReportBody>[1]

export async function syncReportToBackend(
  sessionId: string,
  slice: SyncReportSlice,
  clinic?: NewReportBodyExtras,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const sid = sessionId.trim()
  if (!sid) return { ok: false, error: 'missing session' }
  const base = buildNewReportBody(sid, slice)
  const extras: NewReportBodyExtras = {
    ...(clinic?.clinicId ? { clinicId: clinic.clinicId } : {}),
    ...(clinic?.clinicSlug ? { clinicSlug: clinic.clinicSlug } : {}),
  }
  if (!extras.clinicId && !extras.clinicSlug) {
    extras.clinicSlug = getConsumerClinicSlug()
  }
  const body = withClinicOnReportBody(base, extras)
  const res = await fetch('/api/new-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data: { error?: string } = {}
  try {
    data = (await res.json()) as { error?: string }
  } catch {
    // ignore
  }
  if (!res.ok) return { ok: false, status: res.status, error: data.error || res.statusText }
  return { ok: true }
}
