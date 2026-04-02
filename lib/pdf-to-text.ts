/**
 * Extracts text content from a PDF buffer using pdfjs-dist.
 *
 * Pure JS/WASM — no system binaries (no Ghostscript, no poppler).
 * Works on Vercel Node.js runtime without extra system dependencies.
 *
 * Limitation: only works for text-based PDFs (Word exports, InDesign, etc.).
 * Scanned / image-only PDFs will return near-empty text — callers should
 * check `isLikelyScanned` and handle accordingly.
 */

import { createRequire } from 'module'

const MAX_PAGES = 5
const MIN_TEXT_CHARS = 80 // below this threshold → assume scanned/image-only

export interface PdfTextResult {
  text: string
  pageCount: number
  pagesProcessed: number
  isLikelyScanned: boolean
}

export async function extractTextFromPdf(buf: Buffer): Promise<PdfTextResult> {
  // Dynamic import keeps pdfjs-dist out of the client bundle and avoids
  // Next.js bundler issues. pdfjs-dist is listed in serverExternalPackages.
  const { getDocument, GlobalWorkerOptions } = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  ) as typeof import('pdfjs-dist')

  // pdfjs-dist v5 requires an explicit workerSrc — empty string no longer works.
  // Resolve the worker file path at runtime so it works in both local and Vercel environments.
  const req = createRequire(import.meta.url)
  GlobalWorkerOptions.workerSrc = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')

  const loadingTask = getDocument({
    data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
    disableFontFace: true,
    verbosity: 0,
  })

  const pdf = await loadingTask.promise
  const pageCount = pdf.numPages
  const pagesProcessed = Math.min(pageCount, MAX_PAGES)
  const textParts: string[] = []

  for (let i = 1; i <= pagesProcessed; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .filter((item): item is { str: string } => 'str' in item)
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) textParts.push(pageText)
  }

  const text = textParts.join('\n\n')

  return {
    text,
    pageCount,
    pagesProcessed,
    isLikelyScanned: text.length < MIN_TEXT_CHARS,
  }
}
