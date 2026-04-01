import { saveMenuToDatabase, resolveClinicMenu, isValidMenu } from '@/lib/menu-store'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    const { menu, source } = await resolveClinicMenu('')
    return Response.json({ menu, source, configured: false })
  }
  const resolved = await resolveClinicForRequest(supabase, req)
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status })
  }
  const { menu, source } = await resolveClinicMenu(resolved.clinic.id)
  return Response.json({ menu, source, clinicId: resolved.clinic.id, clinicSlug: resolved.clinic.slug })
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const menu = body.menu
  if (!menu || !isValidMenu(menu)) {
    return Response.json({ error: 'menu with clinicName and treatments[] required' }, { status: 400 })
  }
  const resolved = await resolveClinicForRequest(supabase, req, body)
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status })
  }
  const res = await saveMenuToDatabase(menu, resolved.clinic.id)
  if (!res.ok) {
    return Response.json({ error: res.error }, { status: 500 })
  }
  return Response.json({ ok: true })
}

