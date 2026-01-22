export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >
}

function stripJsonFences(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

function normalizeJsonCandidate(text: string) {
  const stripped = stripJsonFences(text)
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  const candidate = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped
  return repairJsonSyntax(candidate)
}

function repairJsonSyntax(text: string) {
  let normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString && (ch === '\n' || ch === '\r')) {
      out += '\\n'
      continue
    }
    out += ch
  }

  normalized = out.replace(/,\s*([}\]])/g, '$1')
  return normalized
}

export function safeJsonParse(text: string): unknown {
  const normalized = normalizeJsonCandidate(text)
  try {
    return JSON.parse(normalized)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Model response was not valid JSON. ${message}`)
  }
}

export async function callOpenRouterChat({
  apiKey,
  model,
  messages,
  temperature = 0.3,
  maxTokens = 4096,
}: {
  apiKey: string
  model: string
  messages: OpenRouterChatMessage[]
  temperature?: number
  maxTokens?: number
}) {
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'ResumeGen',
  }

  const baseBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  }

  async function attempt(body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      throw new Error(`OpenRouter error (${response.status}): ${text.slice(0, 400)}`)
    }
    const payload = JSON.parse(text) as any
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenRouter returned empty response.')
    }
    return content
  }

  try {
    return await attempt({
      ...baseBody,
      response_format: { type: 'json_object' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('response_format')) {
      return await attempt(baseBody)
    }
    throw error
  }
}
