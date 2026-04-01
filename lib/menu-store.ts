import type { ClinicMenu } from '@/lib/clinic-menu'
import { CLINIC_MENU } from '@/lib/clinic-menu'
import { getServiceSupabase } from '@/lib/supabase/admin'
import fs from 'fs/promises'
import path from 'path'

const LOCAL_MENU_PATH = path.join(process.cwd(), '.data', 'clinic-menu.json')

export function isValidMenu(m: unknown): m is ClinicMenu {
  if (!m || typeof m !== 'object') return false
  const o = m as Record<string, unknown>
  return typeof o.clinicName === 'string' && Array.isArray(o.treatments)
}

async function readMenuFromLocalFile(): Promise<ClinicMenu | null> {
  try {
    const raw = await fs.readFile(LOCAL_MENU_PATH, 'utf8')
    const j = JSON.parse(raw) as unknown
    if (isValidMenu(j)) return j
  } catch {
    // missing file or invalid JSON
  }
  return null
}

async function writeMenuToLocalFile(menu: ClinicMenu): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await fs.mkdir(path.dirname(LOCAL_MENU_PATH), { recursive: true })
    await fs.writeFile(LOCAL_MENU_PATH, JSON.stringify(menu, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Local menu write failed' }
  }
}

/** Resolved menu for API: DB first, then `.data/clinic-menu.json`, then code default. */
export async function resolveClinicMenu(clinicId: string): Promise<{
  menu: ClinicMenu
  source: 'database' | 'local_file' | 'default'
}> {
  const supabase = getServiceSupabase()
  if (supabase) {
    const { data, error } = await supabase
      .from('clinic_menu_store')
      .select('menu_json')
      .eq('clinic_id', clinicId)
      .maybeSingle()
    if (!error && data?.menu_json && isValidMenu(data.menu_json)) {
      return { menu: data.menu_json as ClinicMenu, source: 'database' }
    }
  }
  const local = await readMenuFromLocalFile()
  if (local) return { menu: local, source: 'local_file' }
  return { menu: CLINIC_MENU, source: 'default' }
}

/** Custom menu if any (DB or local file). Null = use baked-in default only. */
export async function loadMenuFromDatabase(clinicId: string): Promise<ClinicMenu | null> {
  const { menu, source } = await resolveClinicMenu(clinicId)
  if (source === 'default') return null
  return menu
}

export async function saveMenuToDatabase(
  menu: ClinicMenu,
  clinicId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidMenu(menu)) {
    return { ok: false, error: 'Invalid menu shape' }
  }
  const supabase = getServiceSupabase()
  if (supabase) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('clinic_menu_store').upsert(
      { clinic_id: clinicId, menu_json: menu, updated_at: now },
      { onConflict: 'clinic_id' },
    )
    if (!error) return { ok: true }
    console.warn('[menu-store] Supabase upsert failed, using local file:', error.message)
  }
  return writeMenuToLocalFile(menu)
}
