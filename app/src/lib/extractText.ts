import { isAcceptedMimeType } from './resumeUpload'

function toReadablePdfError(err: unknown): Error {
  const name = (err as { name?: string })?.name
  const message = err instanceof Error ? err.message : String(err)

  if (name === 'PasswordException') {
    return new Error(
      'This PDF is password protected. Remove the password and upload it again.',
    )
  }
  if (name === 'InvalidPDFException') {
    return new Error('This file is not a readable PDF — it may be corrupt or incomplete.')
  }
  return new Error(`Could not read this PDF: ${message}`)
}

// pdf.js emits glyph runs, not lines. Items stay in content-stream order, so
// multi-column pages still interleave.
function itemsToText(items: Array<Record<string, unknown>>): string {
  let text = ''
  let prevBottom: number | null = null
  let prevRight: number | null = null

  for (const item of items) {
    // Marked-content items carry no glyphs.
    if (typeof item.str !== 'string') continue

    const str = item.str as string
    const transform = item.transform as number[] | undefined
    const width = typeof item.width === 'number' ? item.width : 0
    const height = typeof item.height === 'number' ? item.height : 0
    const left = transform?.[4] ?? 0
    const bottom = transform?.[5] ?? 0

    if (prevBottom !== null) {
      const lineBreak = Math.abs(bottom - prevBottom) > Math.max(height, 1) * 0.5
      if (lineBreak) {
        if (!text.endsWith('\n')) text += '\n'
      } else if (prevRight !== null && left - prevRight > Math.max(height, 1) * 0.25) {
        if (!text.endsWith(' ') && !text.endsWith('\n')) text += ' '
      }
    }

    text += str
    if (item.hasEOL === true && !text.endsWith('\n')) text += '\n'

    prevBottom = bottom
    prevRight = left + width
  }

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function readPdfText(source: {
  data: Uint8Array | ArrayBuffer
}): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const PdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')

  // Configure PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker.default

  let pdf
  try {
    pdf = await pdfjsLib.getDocument(source).promise
  } catch (err) {
    throw toReadablePdfError(err)
  }

  try {
    const pageTexts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      // Must match the text layer in roast.tsx, or highlight quotes stop matching.
      const textContent = await page.getTextContent({ disableNormalization: true })
      pageTexts.push(itemsToText(textContent.items as Array<Record<string, unknown>>))
    }
    return pageTexts.join('\n\n')
  } catch (err) {
    throw toReadablePdfError(err)
  } finally {
    await pdf.destroy()
  }
}

// pdfjs-dist is imported dynamically to avoid SSR issues.
export async function extractTextFromPdf(file: File): Promise<string> {
  // getDocument transfers the buffer to the worker, so pass a copy.
  const arrayBuffer = await file.arrayBuffer()
  return readPdfText({ data: new Uint8Array(arrayBuffer) })
}

export async function extractTextFromPdfBytes(
  data: Uint8Array | ArrayBuffer,
): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return readPdfText({ data: bytes.slice() })
}

// mammoth is imported dynamically to avoid SSR issues.
export async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

export async function extractTextFromResume(file: File): Promise<string> {
  if (!isAcceptedMimeType(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`)
  }

  if (file.type === 'application/pdf') {
    return extractTextFromPdf(file)
  }

  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(file)
  }

  throw new Error(`Unsupported file type: ${file.type}`)
}
