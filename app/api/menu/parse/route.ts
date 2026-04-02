import * as XLSX from 'xlsx'
import { parseMenuTextToDraft } from '@/lib/menu-file-parser'
import { getMenuVisionAnthropicModel } from '@/lib/anthropic-model'
import { extractTextFromPdf } from '@/lib/pdf-to-text'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function bufToUtf8(buf: Buffer): string {
  return buf.toString('utf8').replace(/^\uFEFF/, '')
}

function getFileName(file: File): string {
  return typeof file.name === 'string' && file.name.trim() ? file.name : 'upload'
}

function isPdfUpload(file: File, lowerName: string): boolean {
  return lowerName.endsWith('.pdf') || file.type === 'application/pdf'
}

function isImageUpload(file: File, lowerName: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(lowerName) || SUPPORTED_IMAGE_TYPES.has(file.type)
}

async function readUploadedFile(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'file field required' }, { status: 400 })
  }

  if (file.size <= 0) {
    return Response.json({ error: 'Uploaded file is empty' }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `File too large. Max upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
      { status: 413 },
    )
  }

  const name = getFileName(file)
  const lower = name.toLowerCase()
  const buf = await readUploadedFile(file)

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
  if (isPdfUpload(file, lower)) {
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

  if (isImageUpload(file, lower)) {
    let extractedText: string
    try {
      extractedText = await extractMenuFromImage(
        file.type === 'image/png' || lower.endsWith('.png')
          ? 'image/png'
          : file.type === 'image/webp' || lower.endsWith('.webp')
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
