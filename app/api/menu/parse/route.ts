import * as XLSX from 'xlsx'
import { parseMenuTextToDraft } from '@/lib/menu-file-parser'
import { getMenuVisionAnthropicModel } from '@/lib/anthropic-model'
import { extractTextFromPdf } from '@/lib/pdf-to-text'
import { getServiceSupabase } from '@/lib/supabase/admin'
import { resolveClinicForRequest } from '@/lib/tenant'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FETCH_BYTES = 50 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function bufToUtf8(buf: Buffer): string {
  return buf.toString('utf8').replace(/^\uFEFF/, '')
}

function getFileNameFromUrl(fileUrl: string): string {
  try {
    const pathname = new URL(fileUrl).pathname
    const last = pathname.split('/').filter(Boolean).pop()
    return last ? decodeURIComponent(last) : 'upload'
  } catch {
    return 'upload'
  }
}

function isPdfUpload(contentType: string, lowerName: string): boolean {
  return lowerName.endsWith('.pdf') || contentType === 'application/pdf'
}

function isImageUpload(contentType: string, lowerName: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(lowerName) || SUPPORTED_IMAGE_TYPES.has(contentType)
}

function isAllowedRemoteUrl(fileUrl: string): boolean {
  try {
    const url = new URL(fileUrl)
    return url.protocol === 'https:' || url.hostname === 'localhost'
  } catch {
    return false
  }
}

function parseMenusStoragePath(fileUrl: string): string | null {
  try {
    const pathname = new URL(fileUrl).pathname
    const marker = '/storage/v1/object/public/menus/'
    const index = pathname.indexOf(marker)
    if (index === -1) return null
    const raw = pathname.slice(index + marker.length).replace(/^\/+/, '')
    return raw ? decodeURIComponent(raw) : null
  } catch {
    return null
  }
}

async function fetchRemoteFile(fileUrl: string): Promise<{ buf: Buffer; contentType: string; contentLength: number | null }> {
  const response = await fetch(fileUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0]?.trim().toLowerCase() || ''
  const contentLengthHeader = response.headers.get('content-length')
  const contentLength =
    contentLengthHeader && /^\d+$/.test(contentLengthHeader) ? Number(contentLengthHeader) : null

  if (contentLength != null && contentLength > MAX_FETCH_BYTES) {
    throw new Error(`File too large. Max upload size is ${Math.floor(MAX_FETCH_BYTES / (1024 * 1024))}MB.`)
  }

  const buf = Buffer.from(await response.arrayBuffer())
  if (!buf.byteLength) {
    throw new Error('Uploaded file is empty')
  }
  if (buf.byteLength > MAX_FETCH_BYTES) {
    throw new Error(`File too large. Max upload size is ${Math.floor(MAX_FETCH_BYTES / (1024 * 1024))}MB.`)
  }

  return { buf, contentType, contentLength }
}

export async function POST(req: Request) {
  try {
    return await handlePOST(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[menu/parse] UNHANDLED ERROR:', msg, stack)
    return Response.json({ error: `Internal server error: ${msg}` }, { status: 500 })
  }
}

async function handlePOST(req: Request) {
  const contentTypeHeader = req.headers.get('content-type') || ''
  const isMultipart = contentTypeHeader.includes('multipart/form-data')

  let buf: Buffer
  let contentType: string
  let name: string
  let bodyForTenant: Record<string, unknown> = {}

  if (isMultipart) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (e) {
      return Response.json({ error: 'Failed to read upload' }, { status: 400 })
    }
    const fileField = formData.get('file')
    if (!fileField || !(fileField instanceof File)) {
      return Response.json({ error: 'file field required' }, { status: 400 })
    }
    if (fileField.size > MAX_FETCH_BYTES) {
      return Response.json({ error: `File too large. Max upload size is ${Math.floor(MAX_FETCH_BYTES / (1024 * 1024))}MB.` }, { status: 413 })
    }
    buf = Buffer.from(await fileField.arrayBuffer())
    contentType = fileField.type || ''
    name = fileField.name || 'upload'
    const clinicId = formData.get('clinicId')
    const clinicSlug = formData.get('clinicSlug')
    if (clinicId) bodyForTenant.clinicId = clinicId
    if (clinicSlug) bodyForTenant.clinicSlug = clinicSlug
  } else {
    const body = (await req.json().catch(() => null)) as { fileUrl?: unknown; clinicId?: unknown; clinicSlug?: unknown } | null
    const fileUrl = typeof body?.fileUrl === 'string' ? body.fileUrl.trim() : ''
    if (!fileUrl) {
      return Response.json({ error: 'fileUrl required' }, { status: 400 })
    }
    if (!isAllowedRemoteUrl(fileUrl)) {
      return Response.json({ error: 'Invalid fileUrl' }, { status: 400 })
    }
    bodyForTenant = (body || {}) as Record<string, unknown>
    let remoteFile
    try {
      remoteFile = await fetchRemoteFile(fileUrl)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const status = msg.includes('File too large') ? 413 : 400
      return Response.json({ error: msg }, { status })
    }
    buf = remoteFile.buf
    contentType = remoteFile.contentType
    name = getFileNameFromUrl(fileUrl)
  }

  const supabase = getServiceSupabase()
  if (supabase) {
    const tenant = await resolveClinicForRequest(supabase, req, bodyForTenant)
    if (!tenant.ok) {
      return Response.json({ error: tenant.error }, { status: tenant.status })
    }
  }

  const lower = name.toLowerCase()

  // CSV: treat as spreadsheet for more reliable parsing (Excel exports often include quotes/commas).
  if (lower.endsWith('.csv')) {
    try {
      const wb = XLSX.read(buf, { type: 'buffer' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const lines = rows
        .map((r) =>
          Object.values(r)
            .map((v) => String(v).trim())
            .filter(Boolean)
            .join(' | '),
        )
        .filter(Boolean)
      const text = lines.join('\n')
      return Response.json({
        text,
        rowCount: rows.length,
        format: 'csv',
        draftMenu: parseMenuTextToDraft(text),
      })
    } catch (e) {
      // Fallback to raw text parsing.
      const text = bufToUtf8(buf)
      return Response.json({
        text,
        format: 'text',
        draftMenu: parseMenuTextToDraft(text),
      })
    }
  }

  // Plain text / pipe-separated lines
  if (lower.endsWith('.txt')) {
    const text = bufToUtf8(buf)
    return Response.json({
      text,
      format: 'text',
      draftMenu: parseMenuTextToDraft(text),
    })
  }

  if (lower.endsWith('.json')) {
    try {
      const j = JSON.parse(bufToUtf8(buf)) as Record<string, unknown>
      const draft =
        j &&
        typeof j === 'object' &&
        typeof j.clinicName === 'string' &&
        Array.isArray(j.treatments)
          ? j
          : null
      return Response.json({
        json: j,
        format: 'json',
        ...(draft ? { draftMenu: draft } : {}),
      })
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    try {
      const wb = XLSX.read(buf, { type: 'buffer' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const lines = rows
        .map((r) =>
          Object.values(r)
            .map((v) => String(v).trim())
            .filter(Boolean)
            .join(' | '),
        )
        .filter(Boolean)
      const text = lines.join('\n')
      return Response.json({
        text,
        rowCount: rows.length,
        format: 'xlsx',
        draftMenu: parseMenuTextToDraft(text),
      })
    } catch (e) {
      console.error(e)
      return Response.json({ error: 'Failed to read spreadsheet' }, { status: 400 })
    }
  }

  // Image path: send image bytes directly to gpt-4o-mini vision.
  // Uses plain text output (not Output.object) — Azure API 2024-07-18 does not support
  // response_format:json_schema. Plain pipe-delimited text is sufficient for parseMenuTextToDraft.
  const extractMenuFromImage = async (mimeType: string) => {
    const { text } = await generateText({
      model: getMenuVisionAnthropicModel(),
      system:
        'You extract a clinic menu from an uploaded document image. Output ONLY pipe-delimited rows, one per menu item, one per line: Treatment Name | Category | $Price | Description. No JSON. No commentary.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the entire menu. For each item output: Treatment Name | Category | $Price | Description. Use $ and numbers when you see prices.',
            },
            {
              type: 'image',
              image: buf,
              mediaType: mimeType,
            },
          ],
        },
      ],
    })
    return text.trim()
  }

  // Text path: used for PDFs after text extraction. No vision needed.
  // Deliberately avoids Output.object — Azure OpenAI API version 2024-07-18 does not
  // support response_format:json_schema (requires 2024-08-01-preview or later).
  // Plain text output works reliably across all API versions and is sufficient
  // because parseMenuTextToDraft already handles pipe-delimited text.
  const extractMenuFromText = async (pdfText: string) => {
    const { text } = await generateText({
      model: getMenuVisionAnthropicModel(),
      system:
        'You extract a clinic menu from raw text. Output ONLY pipe-delimited rows, one per menu item: Treatment Name | Category | $Price | Description. No JSON. No commentary. Each row on its own line.',
      messages: [
        {
          role: 'user',
          content: `Extract the menu from this text:\n\n${pdfText}`,
        },
      ],
    })
    return text.trim()
  }

  // PDF: extract text with pdfjs-dist (pure JS, no system binaries, Vercel-compatible).
  // Works for text-based PDFs (Word, InDesign exports). For scanned/image-only PDFs,
  // ask the user to upload a PNG/JPG screenshot instead.
  if (isPdfUpload(contentType, lower)) {
    let pdfResult
    try {
      pdfResult = await extractTextFromPdf(buf)
    } catch (e) {
      console.error('[menu/parse] PDF text extraction failed:', e)
      return Response.json({ error: 'Could not read the PDF. The file may be corrupted or password-protected.' }, { status: 400 })
    }

    if (pdfResult.isLikelyScanned) {
      return Response.json(
        {
          error:
            'This PDF appears to be a scanned image and cannot be parsed as text. Please take a screenshot of the menu and upload it as a PNG or JPG instead.',
        },
        { status: 415 },
      )
    }

    let extractedText: string
    try {
      extractedText = await extractMenuFromText(pdfResult.text)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[menu/parse] PDF AI extraction failed:', msg)
      return Response.json({ error: `AI processing failed: ${msg}` }, { status: 500 })
    }

    return Response.json({
      text: extractedText,
      format: 'pdf',
      draftMenu: parseMenuTextToDraft(extractedText),
    })
  }

  if (isImageUpload(contentType, lower)) {
    let extractedText: string
    try {
      extractedText = await extractMenuFromImage(
        contentType === 'image/png' || lower.endsWith('.png')
          ? 'image/png'
          : contentType === 'image/webp' || lower.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg',
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[menu/parse] image AI extraction failed:', msg)
      return Response.json({ error: `AI processing failed: ${msg}` }, { status: 500 })
    }
    return Response.json({
      text: extractedText,
      format: 'image',
      draftMenu: parseMenuTextToDraft(extractedText),
    })
  }

  return Response.json({ error: 'Unsupported file type' }, { status: 415 })
}
