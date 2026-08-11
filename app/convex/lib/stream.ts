import { buildGeminiRequestBody, extractGeminiText, GEMINI_API_BASE } from './gemini'
import type { ChatRequest } from './chat'

/**
 * Server-sent-event streaming for the two providers. Both emit `data: {json}`
 * lines; only the shape of the payload differs. The caller gets the text so far
 * on every chunk so it can report which section is being written.
 */

export type StreamRequest = ChatRequest & {
  onProgress?: (accumulated: string) => void | Promise<void>
}

async function* sseLines(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The model returned no stream body.')
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (payload && payload !== '[DONE]') yield payload
      }
      newline = buffer.indexOf('\n')
    }
  }
}

/**
 * Chunks arrive far faster than a database wants writes, so the caller is only
 * notified when the accumulated text has grown by a meaningful amount.
 */
const NOTIFY_EVERY_CHARS = 220

export async function streamGeminiChat({
  apiKey,
  model,
  messages,
  temperature = 0.3,
  maxTokens,
  onProgress,
}: StreamRequest): Promise<string> {
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
  const body = buildGeminiRequestBody({ messages, temperature, maxTokens, json: true })

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Gemini stream error (${response.status}): ${text.slice(0, 300)}`)
  }

  let accumulated = ''
  let lastNotified = 0

  for await (const payload of sseLines(response)) {
    let parsed: any
    try {
      parsed = JSON.parse(payload)
    } catch {
      continue
    }
    accumulated += extractGeminiText(parsed)
    if (onProgress && accumulated.length - lastNotified >= NOTIFY_EVERY_CHARS) {
      lastNotified = accumulated.length
      await onProgress(accumulated)
    }
  }

  if (onProgress && accumulated) await onProgress(accumulated)
  if (!accumulated.trim()) throw new Error('Gemini returned an empty stream.')
  return accumulated.trim()
}

export async function streamOpenRouterChat({
  apiKey,
  model,
  messages,
  temperature = 0.3,
  maxTokens,
  onProgress,
}: StreamRequest): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream: true,
    response_format: { type: 'json_object' },
  }
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'CareerTailor',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`OpenRouter stream error (${response.status}): ${text.slice(0, 300)}`)
  }

  let accumulated = ''
  let lastNotified = 0

  for await (const payload of sseLines(response)) {
    let parsed: any
    try {
      parsed = JSON.parse(payload)
    } catch {
      continue
    }
    const delta = parsed?.choices?.[0]?.delta?.content
    if (typeof delta === 'string') accumulated += delta
    if (onProgress && accumulated.length - lastNotified >= NOTIFY_EVERY_CHARS) {
      lastNotified = accumulated.length
      await onProgress(accumulated)
    }
  }

  if (onProgress && accumulated) await onProgress(accumulated)
  if (!accumulated.trim()) throw new Error('OpenRouter returned an empty stream.')
  return accumulated.trim()
}
