// Accepted MIME types with type safety
export const ACCEPTED_RESUME_MIME_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
} as const

export type AcceptedResumeMimeType = keyof typeof ACCEPTED_RESUME_MIME_TYPES

export const ACCEPTED_MIME_TYPE_LIST = Object.keys(ACCEPTED_RESUME_MIME_TYPES) as AcceptedResumeMimeType[]

export function isAcceptedMimeType(mimeType: string): mimeType is AcceptedResumeMimeType {
  return mimeType in ACCEPTED_RESUME_MIME_TYPES
}

// Upload state type
export type ResumeUploadState =
  | { status: 'idle' }
  | { status: 'extracting'; fileName: string }
  | { status: 'parsing'; fileName: string }
  | { status: 'success'; fileName: string }
  | { status: 'error'; fileName: string; error: string }
