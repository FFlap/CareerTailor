export type ChatTextPart = { type: 'text'; text: string }
export type ChatImagePart = { type: 'image_url'; image_url: { url: string } }
export type ChatContentPart = ChatTextPart | ChatImagePart

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<ChatContentPart>
}

export type ChatRequest = {
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number | null
}

export function isRetriableStatus(status: number) {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  )
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,(.*)$/is.exec(url.trim())
  if (!match) return null
  const mimeType = match[1].trim()
  const data = match[2].trim()
  if (!mimeType || !data) return null
  return { mimeType, data }
}

export function toContentParts(content: ChatMessage['content']): ChatContentPart[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return content
}
