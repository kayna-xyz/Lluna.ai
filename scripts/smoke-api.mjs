#!/usr/bin/env node
/**
 * 对本地（或已部署）Next 服务做只读冒烟：/api/clients、/api/menu、/api/pending-reports
 * 用法：先 pnpm dev，再 pnpm smoke
 * 覆盖地址：BASE_URL=https://xxx pnpm smoke
 */
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal()

const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')

async function get(path) {
  const url = `${base}${path}`
  const res = await fetch(url)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { url, ok: res.ok, status: res.status, json, text: text.slice(0, 200) }
}

let failed = false

async function check(name, path, validate) {
  const r = await get(path)
  if (!r.ok) {
    console.error(`FAIL ${name} ${r.status} ${r.url}\n${r.text}`)
    failed = true
    return
  }
  if (validate && !validate(r.json)) {
    console.error(`FAIL ${name} 响应结构异常`, r.json)
    failed = true
    return
  }
  console.log(`OK   ${name} (${r.status})`)
}

console.log(`Smoke: ${base}\n`)

const clinicQ = '?clinic=default'
await check('/api/clients', `/api/clients${clinicQ}`, (j) => j && typeof j.configured === 'boolean')
await check('/api/menu', `/api/menu${clinicQ}`, (j) => j && j.menu && typeof j.menu === 'object')
await check('/api/pending-reports', `/api/pending-reports${clinicQ}`, (j) => j && Array.isArray(j.items))

console.log('')
if (failed) {
  console.error('部分检查失败。请确认已 pnpm dev 且 Supabase 变量正确。\n')
  console.error('端到端写库需手动：用户端走完问卷后看 pending_reports 是否有新行。\n')
  process.exit(1)
}

console.log('只读接口正常。写库路径请按 docs/SUPABASE_HANDOFF.md 手动验收。\n')
process.exit(0)
