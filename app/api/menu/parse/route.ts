import * as XLSX from 'xlsx'
import { parseMenuTextToDraft } from '@/lib/menu-file-parser'
import { getMenuVisionAnthropicModel } from '@/lib/anthropic-model'
import { generateText, Output } from 'ai'
import { z } from 'zod'

export const runtime = 'nodejs'

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

  const extractMenuWithAI = async (mimeType: string) => {
    const extractedSchema = z.object({
      extractedText: z
        .string()
        .describe('Pipe-delimited menu rows: Treatment Name | Category | $Price | Description (one row per line).'),
    })

    const { output } = await generateText({
      model: getMenuVisionAnthropicModel(),
      system:
        'You extract a clinic menu from an uploaded document image/PDF. Output ONLY pipe-delimited rows, one per menu item. No commentary.',
      output: Output.object({ schema: extractedSchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Extract the entire menu. For each item, ensure the line contains: Treatment Name | Category | $Price | Description. Use $ and numbers when you see prices.',
            },
            {
              type: 'file',
              data: buf,
              mediaType: mimeType,
              filename: name,
            },
          ],
        },
      ],
    })

    return output.extractedText
  }

  if (lower.endsWith('.pdf')) {
    const extractedText = await extractMenuWithAI('application/pdf')
    return Response.json({
      text: extractedText,
      format: 'pdf',
      draftMenu: parseMenuTextToDraft(extractedText),
    })
  }

  if (/\.(png|jpe?g|webp)$/i.test(lower)) {
    const extractedText = await extractMenuWithAI(
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
