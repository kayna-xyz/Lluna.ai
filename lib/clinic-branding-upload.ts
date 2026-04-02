import type { SupabaseClient } from '@supabase/supabase-js'

const DATA_URL_RE = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/is

function extFromMime(mime: string): string {
  if (/jpeg/i.test(mime)) return '.jpg'
  if (/png/i.test(mime)) return '.png'
  if (/webp/i.test(mime)) return '.webp'
  if (/gif/i.test(mime)) return '.gif'
  return '.bin'
}

export function isHttpOrRelativeAssetUrl(s: string): boolean {
  const t = s.trim()
  return /^https?:\/\//i.test(t) || t.startsWith('/api/')
}

/**
 * Upload a data-URL image to `clinic-branding` bucket. Returns public URL or null.
 */
export async function uploadClinicBrandingDataUrl(
  supabase: SupabaseClient,
  clinicId: string,
  folder: string,
  dataUrl: string,
): Promise<string | null> {
  const m = DATA_URL_RE.exec(dataUrl.trim())
  if (!m) return null
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 9 * 1024 * 1024) return null
  const ext = extFromMime(m[1])
  const objectName = `${Date.now()}${ext}`
  const storagePath = `${clinicId}/${folder.replace(/^\/+|\/+$/g, '')}/${objectName}`
  const { error } = await supabase.storage.from('clinic-branding').upload(storagePath, buf, {
    contentType: m[1].split(';')[0]!.toLowerCase(),
    upsert: false,
  })
  if (error) {
    console.error('[clinic-branding] upload', error)
    return null
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return `${base}/storage/v1/object/public/clinic-branding/${storagePath}`
}

export function publicUrlForClinicBrandingPath(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return `${base}/storage/v1/object/public/clinic-branding/${storagePath}`
}
