import * as XLSX from 'xlsx'
import { parseMenuTextToDraft, parseMenuJsonToDraft } from '@/lib/menu-file-parser'
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
        `You extract a clinic treatment menu from an uploaded image. Output a JSON array of treatment objects only. No markdown, no code fences, no commentary — raw JSON array only.

STRICT GROUNDING RULES:
- Extract ONLY text explicitly visible in the image.
- Do NOT infer, guess, or add anything not present in the source.
- Do NOT flatten table-structured pricing into a single price.
- Do NOT duplicate a treatment just to represent different row variants.
- If a field is not visible, use "" (string fields) or omit (pricing fields).
- If a table cell is missing or unreadable, use null for that cell value.

Each object in the array must have:
  "name": string — treatment name verbatim from image (required)
  "category": string — verbatim from image, or "" if not shown
  "description": string — verbatim from image, or "" if not shown
  "pricing_model": "simple" | "table"

For SIMPLE pricing (one price or one price per unit/syringe):
  "pricing": { "single": number } or { "perUnit": number } or { "perSyringe": number }

For TABLE pricing (treatment has multiple ROWS such as areas/zones AND multiple COLUMNS such as pricing tiers):
  "pricing_table": {
    "columns": ["Col A", "Col B", ...],
    "rows": [
      { "label": "Row label", "values": { "Col A": number_or_null, "Col B": number_or_null } }
    ]
  }

Use pricing_model "table" when the menu shows a grid: rows = areas/zones/durations, columns = pricing tiers.
Use pricing_model "simple" when a treatment has only one price point.
Never invent column headers, row labels, or price values not visible in the image.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract every treatment from this menu image. Preserve table structure exactly. Output only the JSON array.',
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
  // support response_format:json_schema. We request JSON as plain text and parse it ourselves.
  const extractMenuFromText = async (pdfText: string) => {
    const { text } = await generateText({
      model: getMenuVisionAnthropicModel(),
      system:
        `You extract a clinic treatment menu from raw text. Output a JSON array of treatment objects only. No markdown, no code fences, no commentary — raw JSON array only.

STRICT GROUNDING RULES:
- Extract ONLY text explicitly present in the source.
- Do NOT infer, guess, or add anything not present.
- Do NOT flatten table-structured pricing into a single price.
- Do NOT duplicate a treatment just to represent different row variants.
- If a field is missing, use "" (string fields) or omit (pricing fields).
- If a table cell value is missing, use null for that cell.

Each object must have:
  "name": string (required, verbatim from source)
  "category": string (verbatim, or "")
  "description": string (verbatim, or "")
  "pricing_model": "simple" | "table"

For SIMPLE pricing: "pricing": { "single": number } or { "perUnit": number } etc.
For TABLE pricing (rows = areas/zones, columns = pricing tiers):
  "pricing_table": {
    "columns": ["Col A", "Col B"],
    "rows": [{ "label": "Row label", "values": { "Col A": number_or_null, "Col B": number_or_null } }]
  }

Use "table" when the source shows a grid of prices across multiple rows and columns.
Use "simple" when a treatment has a single price. Never invent values.`,
      messages: [
        {
          role: 'user',
          content: `Extract every treatment from this menu text. Preserve table structure exactly when pricing is shown as a grid. Output only the JSON array.\n\n${pdfText}`,
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
      draftMenu: parseMenuJsonToDraft(extractedText),
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
      draftMenu: parseMenuJsonToDraft(extractedText),
    })
  }

  return Response.json({ error: 'Unsupported file type' }, { status: 415 })
}
