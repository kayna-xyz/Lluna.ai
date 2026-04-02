import fs from 'node:fs/promises'
import path from 'node:path'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'
import { publicUrlForClinicBrandingPath } from '@/lib/clinic-branding-upload'

export const runtime = 'nodejs'

const LOCAL_ROOT = path.join(process.cwd(), '.data', 'clinic-branding')

function safeSlug(s: string): string {
  const t = s.trim()
  return t.replace(/[^a-zA-Z0-9_.-]/g, '') || 'default'
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const kind = String(form?.get('kind') || 'logo').trim()
  const mdMemberId = String(form?.get('mdMemberId') || '').trim()

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'file required' }, { status: 400 })
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
    const mdSafe = mdMemberId.replace(/[^a-zA-Z0-9_-]/g, '') || 'member'
    const folder = kind === 'md' ? `md/${mdSafe}` : 'logo'
    const storagePath = `${tenant.clinic.id}/${folder}/${objectName}`
    const { error } = await supabase.storage.from('clinic-branding').upload(storagePath, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) {
      console.error('clinic-branding-asset upload', error)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({
      path: storagePath,
      publicUrl: publicUrlForClinicBrandingPath(storagePath),
      storage: 'supabase',
    })
  }

  const url = new URL(req.url)
  const slug = safeSlug(
    req.headers.get('x-clinic-slug')?.trim() ||
      url.searchParams.get('clinic')?.trim() ||
      'default',
  )
  const mdSafe = mdMemberId.replace(/[^a-zA-Z0-9_-]/g, '') || 'member'
  const relDir = kind === 'md' ? path.join(slug, 'md', mdSafe) : path.join(slug, 'logo')
  await fs.mkdir(path.join(LOCAL_ROOT, relDir), { recursive: true })
  const diskPath = path.join(LOCAL_ROOT, relDir, objectName)
  await fs.writeFile(diskPath, buf)
  const urlPath = relDir.split(path.sep).join('/')
  const publicUrl = `/api/clinic-branding-file/${urlPath}/${objectName}`
  return Response.json({ path: `${urlPath}/${objectName}`, publicUrl, storage: 'local' })
}
