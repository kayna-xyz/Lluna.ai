import fs from 'node:fs/promises'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'

export const runtime = 'nodejs'

const LOCAL_ROOT = path.join(process.cwd(), '.data', 'treatment-assets')

const UUID_PREFIX_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function storagePathStartsWithClinicId(storagePath: string): boolean {
  const first = storagePath.split('/').filter(Boolean)[0] || ''
  return UUID_PREFIX_RE.test(first)
}

function safeLocalAssetPath(segments: string[]): string | null {
  if (!segments.length) return null
  const rel = path.join(...segments)
  if (rel.includes('..')) return null
  const full = path.join(LOCAL_ROOT, rel)
  if (!full.startsWith(LOCAL_ROOT)) return null
  return full
}

function parseTreatmentAssetPublicUrl(publicUrl: string):
  | { storage: 'supabase'; path: string }
  | { storage: 'local'; segments: string[] }
  | null {
  const trimmed = publicUrl.trim()
  if (!trimmed) return null
  try {
    const pathname = trimmed.startsWith('http')
      ? new URL(trimmed).pathname
      : trimmed.startsWith('/')
        ? trimmed.split('?')[0] ?? trimmed
        : new URL(trimmed, 'http://localhost').pathname

    const supabaseMarker = '/object/public/treatment-assets/'
    const si = pathname.indexOf(supabaseMarker)
    if (si !== -1) {
      const raw = pathname.slice(si + supabaseMarker.length).replace(/^\/+/, '')
      const storagePath = decodeURIComponent(raw)
      return storagePath ? { storage: 'supabase', path: storagePath } : null
    }

    const localPrefix = '/api/clinic-asset/'
    if (pathname.startsWith(localPrefix)) {
      const rest = pathname.slice(localPrefix.length)
      const segments = rest.split('/').filter(Boolean)
      return segments.length ? { storage: 'local', segments } : null
    }
  } catch {
    return null
  }
  return null
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const treatmentId = String(form?.get('treatmentId') || '').trim()
  const kind = String(form?.get('kind') || 'beforeAfter').trim()

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'file required' }, { status: 400 })
  }
  if (!treatmentId) {
    return Response.json({ error: 'treatmentId required' }, { status: 400 })
  }

  const fname = 'name' in file && typeof (file as File).name === 'string' ? (file as File).name : 'image'
  const ext = fname.includes('.') ? fname.slice(fname.lastIndexOf('.')) : '.bin'
  const safeExt = /^\.(jpe?g|png|webp|gif)$/i.test(ext) ? ext.toLowerCase() : '.bin'
  const objectName = `${Date.now()}_${kind}${safeExt}`

  const ab = await file.arrayBuffer()
  const buf = Buffer.from(ab)

  const supabase = getServiceSupabase()
  if (supabase) {
    const tenant = await resolveClinicForRequest(supabase, req)
    if (!tenant.ok) {
      return Response.json({ error: tenant.error }, { status: tenant.status })
    }
    const storagePath = `${tenant.clinic.id}/${treatmentId}/${objectName}`
    const { error } = await supabase.storage.from('treatment-assets').upload(storagePath, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) {
      console.error('treatment-asset upload', error)
      return Response.json({ error: error.message }, { status: 500 })
    }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/treatment-assets/${storagePath}`
    return Response.json({ path: storagePath, publicUrl: url, storage: 'supabase' })
  }

  const dir = path.join(process.cwd(), '.data', 'treatment-assets', '_local', treatmentId)
  await fs.mkdir(dir, { recursive: true })
  const diskPath = path.join(dir, objectName)
  await fs.writeFile(diskPath, buf)
  const publicUrl = `/api/clinic-asset/_local/${treatmentId}/${objectName}`
  return Response.json({ path: `_local/${treatmentId}/${objectName}`, publicUrl, storage: 'local' })
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { publicUrl?: string }
  const publicUrl = String(body.publicUrl || '').trim()
  if (!publicUrl) {
    return Response.json({ error: 'publicUrl required' }, { status: 400 })
  }

  const ref = parseTreatmentAssetPublicUrl(publicUrl)
  if (!ref) {
    return Response.json({ error: 'Unrecognized asset URL' }, { status: 400 })
  }

  if (ref.storage === 'supabase') {
    const supabase = getServiceSupabase()
    if (!supabase) {
      return Response.json({ error: 'Supabase not configured' }, { status: 503 })
    }
    const tenant = await resolveClinicForRequest(supabase, req, body as Record<string, unknown>)
    if (!tenant.ok) {
      return Response.json({ error: tenant.error }, { status: tenant.status })
    }
    if (storagePathStartsWithClinicId(ref.path)) {
      const prefix = ref.path.split('/').filter(Boolean)[0]
      if (prefix !== tenant.clinic.id) {
        return Response.json({ error: 'Not allowed to delete this asset' }, { status: 403 })
      }
    }
    const { error } = await supabase.storage.from('treatment-assets').remove([ref.path])
    if (error) {
      console.error('treatment-asset delete', error)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true })
  }

  const filePath = safeLocalAssetPath(ref.segments)
  if (!filePath) {
    return Response.json({ error: 'Invalid path' }, { status: 400 })
  }
  try {
    if (existsSync(filePath)) await fs.unlink(filePath)
  } catch (e) {
    console.error('treatment-asset local delete', e)
    return Response.json({ error: 'Failed to delete file' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
