import { ChatRequest, isRetriableStatus, sleep } from './chat'

export async function callOpenRouterChat({
  apiKey,
  model,
  messages,
  temperature = 0.3,
  maxTokens,
}: ChatRequest) {
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'CareerTailor',
  }

  const baseBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
  }
  if (typeof maxTokens === 'number') {
    baseBody.max_tokens = maxTokens
  }

  async function attempt(body: Record<string, unknown>, attemptIndex: number): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      if (isRetriableStatus(response.status) && attemptIndex < 2) {
        await sleep(400 * Math.pow(2, attemptIndex))
        return attempt(body, attemptIndex + 1)
      }
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
    return await attempt(
      {
        ...baseBody,
        response_format: { type: 'json_object' },
      },
      0,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('response_format')) {
      return await attempt(baseBody, 0)
    }
    throw error
  }
}
