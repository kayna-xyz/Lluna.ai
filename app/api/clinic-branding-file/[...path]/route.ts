import fs from 'node:fs/promises'
import path from 'node:path'
import { existsSync } from 'node:fs'

export const runtime = 'nodejs'

const ROOT = path.join(process.cwd(), '.data', 'clinic-branding')

function safeJoin(segments: string[]): string | null {
  if (!segments.length) return null
  const rel = path.join(...segments)
  if (rel.includes('..')) return null
  const full = path.join(ROOT, rel)
  if (!full.startsWith(ROOT)) return null
  return full
}

export async function GET(
  _req: Request,
  segmentData: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await segmentData.params
  const filePath = safeJoin(segments)
  if (!filePath || !existsSync(filePath)) {
    return new Response('Not found', { status: 404 })
  }

  const buf = await fs.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const type =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'application/octet-stream'

  return new Response(buf, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
