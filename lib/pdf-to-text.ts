/**
 * Extracts text content from a PDF buffer using unpdf (pdfjs-dist wrapper).
 * Works in Node.js without worker thread issues.
 */

const MAX_PAGES = 10
const MIN_TEXT_CHARS = 80

export interface PdfTextResult {
  text: string
  pageCount: number
  pagesProcessed: number
  isLikelyScanned: boolean
}

export async function extractTextFromPdf(buf: Buffer): Promise<PdfTextResult> {
  const { getDocumentProxy, extractText } = await import('unpdf')

  const pdf = await getDocumentProxy(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))
  const pageCount = pdf.numPages
  const pagesProcessed = Math.min(pageCount, MAX_PAGES)

  const { text } = await extractText(pdf, { mergePages: true })

  // extractText with mergePages returns a single string; truncate if huge
  const trimmed = (text || '').trim()

  return {
    text: trimmed,
    pageCount,
    pagesProcessed,
    isLikelyScanned: trimmed.length < MIN_TEXT_CHARS,
  }
}
