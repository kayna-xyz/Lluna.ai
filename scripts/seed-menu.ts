/**
 * 将内置 CLINIC_MENU 写入 Supabase `clinic_menu_store`（按租户 `clinic_id`）。
 * 需 .env.local 中 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY。
 * 用法: pnpm seed-menu
 *       CLINIC_SLUG=my-spa pnpm seed-menu
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CLINIC_MENU } from '../lib/clinic-menu'

function loadEnvLocal() {
  const p = resolve(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

async function main() {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const slug = (process.env.CLINIC_SLUG || 'default').trim() || 'default'

  if (!url || !key) {
    console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（见 .env.local）')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: clinic, error: cErr } = await supabase
    .from('clinics')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (cErr || !clinic?.id) {
    console.error('未找到 clinics.slug =', slug, '请先执行迁移 007（含 default 诊所）。', cErr?.message || '')
    process.exit(1)
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('clinic_menu_store').upsert(
    { clinic_id: clinic.id as string, menu_json: CLINIC_MENU, is_active: true, updated_at: now },
    { onConflict: 'clinic_id' },
  )

  if (error) {
    console.error('clinic_menu_store upsert 失败:', error.message)
    process.exit(1)
  }

  console.log('已写入 clinic_menu_store，slug:', slug, '诊所名:', CLINIC_MENU.clinicName)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
