import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Minimal .env.local parser (KEY=value, no export prefix).
 * @param {string} [cwd]
 */
export function loadEnvLocal(cwd = process.cwd()) {
  const p = resolve(cwd, '.env.local')
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
