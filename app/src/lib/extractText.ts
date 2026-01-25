import { isAcceptedMimeType } from './resumeUpload'

/**
 * Extract text content from a PDF file
 * Dynamically imports pdfjs-dist to avoid SSR issues
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const PdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')

  // Configure PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker.default

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const textParts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    textParts.push(pageText)
  }

  return textParts.join('\n\n')
}

/**
 * Extract text content from a PDF byte array
 */
export async function extractTextFromPdfBytes(
  data: Uint8Array | ArrayBuffer,
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const PdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')

  pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker.default

  const pdf = await pdfjsLib.getDocument({ data }).promise
  const textParts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    textParts.push(pageText)
  }

  return textParts.join('\n\n')
}

/**
 * Extract text content from a DOCX file
 * Dynamically imports mammoth to avoid SSR issues
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/**
 * Main extraction function that routes by MIME type
 */
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
