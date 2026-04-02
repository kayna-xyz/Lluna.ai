import * as XLSX from 'xlsx'
import { parseMenuTextToDraft } from '@/lib/menu-file-parser'
import { getMenuVisionAnthropicModel } from '@/lib/anthropic-model'
import { extractTextFromPdf } from '@/lib/pdf-to-text'
import { generateText, Output } from 'ai'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

function bufToUtf8(buf: Buffer): string {
  return buf.toString('utf8').replace(/^\uFEFF/, '')
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'file field required' }, { status: 400 })
  }

  const name = 'name' in file && typeof (file as File).name === 'string' ? (file as File).name : 'upload'
  const lower = name.toLowerCase()
  const ab = await file.arrayBuffer()
  const buf = Buffer.from(ab)

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

  const menuSchema = z.object({
    extractedText: z
      .string()
      .describe('Pipe-delimited menu rows: Treatment Name | Category | $Price | Description (one row per line).'),
  })

  // Image path: send image bytes directly to gpt-4o-mini vision.
  const extractMenuFromImage = async (mimeType: string) => {
    const { output } = await generateText({
      model: getMenuVisionAnthropicModel(),
      system:
        'You extract a clinic menu from an uploaded document image. Output ONLY pipe-delimited rows, one per menu item. No commentary.',
      output: Output.object({ schema: menuSchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the entire menu. For each item, ensure the line contains: Treatment Name | Category | $Price | Description. Use $ and numbers when you see prices.',
            },
            {
              type: 'image',
              image: buf,
              mimeType: mimeType,
            },
          ],
        },
      ],
    })
    return output.extractedText
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
  if (lower.endsWith('.pdf')) {
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
      console.error('[menu/parse] PDF AI extraction failed:', e)
      return Response.json({ error: 'AI processing failed. Please try again or upload the menu as a CSV or image.' }, { status: 500 })
    }

    return Response.json({
      text: extractedText,
      format: 'pdf',
      draftMenu: parseMenuTextToDraft(extractedText),
    })
  }

  if (/\.(png|jpe?g|webp)$/i.test(lower)) {
    const extractedText = await extractMenuFromImage(
      lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg',
    )
    return Response.json({
      text: extractedText,
      format: 'image',
      draftMenu: parseMenuTextToDraft(extractedText),
    })
  }

  return Response.json({ error: 'Unsupported file type' }, { status: 415 })
}
