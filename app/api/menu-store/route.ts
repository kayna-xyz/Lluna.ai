import { loadMenuFromDatabase, saveMenuToDatabase } from '@/lib/menu-store'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

export async function GET(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ menu: null, configured: false })
  }
  const resolved = await resolveClinicForRequest(supabase, req)
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status })
  }
  const menu = await loadMenuFromDatabase(resolved.clinic.id)
  if (!menu) {
    return Response.json({ menu: null, configured: true })
  }
  return Response.json({ menu, configured: true })
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const menu = body.menu
  if (!menu || typeof menu !== 'object') {
    return Response.json({ error: 'menu object required' }, { status: 400 })
  }
  const resolved = await resolveClinicForRequest(supabase, req, body)
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status })
  }
  const res = await saveMenuToDatabase(menu as import('@/lib/clinic-menu').ClinicMenu, resolved.clinic.id)
  if (!res.ok) {
    return Response.json(
      { error: res.error },
      { status: res.error === 'Supabase not configured' ? 503 : 500 },
    )
  }
  return Response.json({ ok: true })
}
