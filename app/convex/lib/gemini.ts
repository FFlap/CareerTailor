import {
  ChatMessage,
  ChatRequest,
  isRetriableStatus,
  parseDataUrl,
  sleep,
  toContentParts,
} from './chat'

export const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models'

// Reasoning tokens count against maxOutputTokens and cannot be disabled.
export const GEMINI_MAX_OUTPUT_TOKENS = 32768
const THINKING_HEADROOM_TOKENS = 2048

export function resolveMaxOutputTokens(maxTokens?: number | null) {
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    return GEMINI_MAX_OUTPUT_TOKENS
  }
  const withHeadroom = Math.ceil(maxTokens * 2) + THINKING_HEADROOM_TOKENS
  return Math.min(GEMINI_MAX_OUTPUT_TOKENS, Math.max(1024, withHeadroom))
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

export type GeminiRequestBody = {
  contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }>
  systemInstruction?: { parts: Array<{ text: string }> }
  generationConfig: {
    temperature: number
    maxOutputTokens: number
    responseMimeType?: string
  }
}

/** Maps OpenAI-shaped messages to Gemini generateContent (alternating roles). */
export function buildGeminiRequestBody({
  messages,
  temperature = 0.3,
  maxTokens,
  json = true,
}: {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number | null
  json?: boolean
}): GeminiRequestBody {
  const systemTexts: string[] = []
  const contents: GeminiRequestBody['contents'] = []

  for (const message of messages) {
    const parts = toContentParts(message.content)

    if (message.role === 'system') {
      for (const part of parts) {
        if (part.type !== 'text') {
          throw new Error('System messages must be plain text.')
        }
        if (part.text.trim()) systemTexts.push(part.text)
      }
      continue
    }

    const geminiParts: GeminiPart[] = []
    for (const part of parts) {
      if (part.type === 'text') {
        if (part.text.length) geminiParts.push({ text: part.text })
        continue
      }
      const inline = parseDataUrl(part.image_url.url)
      if (!inline) {
        throw new Error(
          'Gemini requires images to be base64 data URLs (data:<mime>;base64,...).',
        )
      }
      geminiParts.push({ inlineData: inline })
    }

    if (!geminiParts.length) continue

    const role = message.role === 'assistant' ? 'model' : 'user'
    const previous = contents[contents.length - 1]
    if (previous && previous.role === role) {
      previous.parts.push(...geminiParts)
    } else {
      contents.push({ role, parts: geminiParts })
    }
  }

  if (!contents.length) {
    throw new Error('Gemini request requires at least one user message.')
  }

  const body: GeminiRequestBody = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: resolveMaxOutputTokens(maxTokens),
    },
  }
  if (systemTexts.length) {
    body.systemInstruction = { parts: [{ text: systemTexts.join('\n') }] }
  }
  if (json) {
    body.generationConfig.responseMimeType = 'application/json'
  }
  return body
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
}

/** Visible answer only — drops `thought: true` reasoning parts. */
export function extractGeminiText(payload: GeminiResponse): string {
  const candidate = payload?.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  return parts
    .filter((part) => part?.thought !== true && typeof part?.text === 'string')
    .map((part) => part.text as string)
    .join('')
    .trim()
}

export function geminiEmptyResponseReason(payload: GeminiResponse): string {
  const blockReason = payload?.promptFeedback?.blockReason
  if (blockReason) return `Gemini blocked the prompt (${blockReason}).`
  const finishReason = payload?.candidates?.[0]?.finishReason
  if (finishReason === 'MAX_TOKENS') {
    return 'Gemini hit the output token limit while reasoning and returned no answer.'
  }
  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
    return `Gemini stopped for safety reasons (${finishReason}).`
  }
  return finishReason
    ? `Gemini returned an empty response (finishReason: ${finishReason}).`
    : 'Gemini returned an empty response.'
}

export async function callGeminiChat({
  apiKey,
  model,
  messages,
  temperature = 0.3,
  maxTokens,
}: ChatRequest) {
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`

  async function attempt(
    body: GeminiRequestBody,
    attemptIndex: number,
    allowBudgetRetry: boolean,
  ): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })
    const text = await response.text().catch(() => '')

    if (!response.ok) {
      if (isRetriableStatus(response.status) && attemptIndex < 2) {
        await sleep(400 * Math.pow(2, attemptIndex))
        return attempt(body, attemptIndex + 1, allowBudgetRetry)
      }
      throw new Error(`Gemini error (${response.status}): ${text.slice(0, 400)}`)
    }

    let payload: GeminiResponse
    try {
      payload = JSON.parse(text) as GeminiResponse
    } catch {
      throw new Error(`Gemini returned a non-JSON response: ${text.slice(0, 200)}`)
    }

    const content = extractGeminiText(payload)
    if (content) return content

    const truncated = payload?.candidates?.[0]?.finishReason === 'MAX_TOKENS'
    if (
      truncated &&
      allowBudgetRetry &&
      body.generationConfig.maxOutputTokens < GEMINI_MAX_OUTPUT_TOKENS
    ) {
      return attempt(
        {
          ...body,
          generationConfig: {
            ...body.generationConfig,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          },
        },
        0,
        false,
      )
    }

    throw new Error(geminiEmptyResponseReason(payload))
  }

  const body = buildGeminiRequestBody({ messages, temperature, maxTokens, json: true })

  try {
    return await attempt(body, 0, true)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('responsemimetype')) {
      const plainBody = buildGeminiRequestBody({
        messages,
        temperature,
        maxTokens,
        json: false,
      })
      return await attempt(plainBody, 0, true)
    }
    throw error
  }
}
