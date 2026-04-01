#!/usr/bin/env node
import { loadEnvLocal } from './load-env-local.mjs'

loadEnvLocal()

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const recommended = ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'ANTHROPIC_API_KEY']

let ok = true
console.log('Lluna — 环境变量检查 (.env.local)\n')

for (const k of required) {
  const v = process.env[k]
  const present = v && String(v).trim() && !String(v).includes('YOUR_')
  if (!present) {
    console.error(`  缺少或无效: ${k}`)
    ok = false
  } else {
    console.log(`  OK ${k}`)
  }
}

for (const k of recommended) {
  const v = process.env[k]
  const present = v && String(v).trim() && !String(v).includes('your_')
  if (!present) {
    console.warn(`  建议配置: ${k}（未设置则部分能力降级）`)
  } else {
    console.log(`  OK ${k}`)
  }
}

if (!ok) {
  console.error('\n请复制 .env.example 为 .env.local 并填入 Supabase 密钥。\n')
  process.exit(1)
}
console.log('\n核心变量已就绪。\n')
process.exit(0)
