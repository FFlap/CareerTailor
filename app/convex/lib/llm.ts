import { ChatMessage } from './chat'
import { callGeminiChat } from './gemini'
import { callOpenRouterChat } from './openrouter'
import { AiProvider, DEFAULT_MODEL, providerForModel } from './models'
import { streamGeminiChat, streamOpenRouterChat } from './stream'

export type { ChatMessage } from './chat'
export { safeJsonParse, extractJsonCandidate } from './json'

const ENV_KEY_BY_PROVIDER: Record<AiProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

export function requireApiKey(provider: AiProvider): string {
  const envVar = ENV_KEY_BY_PROVIDER[provider]
  const key = process.env[envVar]
  if (!key) {
    throw new Error(
      `Missing ${envVar} server env var. Set it with: npx convex env set ${envVar} <key>`,
    )
  }
  return key
}

export async function callChatModel({
  model = DEFAULT_MODEL,
  messages,
  temperature = 0.3,
  maxTokens,
  apiKey,
}: {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number | null
  apiKey?: string
}): Promise<string> {
  const provider = providerForModel(model)
  const key = apiKey ?? requireApiKey(provider)

  if (provider === 'gemini') {
    return await callGeminiChat({ apiKey: key, model, messages, temperature, maxTokens })
  }
  return await callOpenRouterChat({ apiKey: key, model, messages, temperature, maxTokens })
}

/**
 * Same answer as `callChatModel`, but reports the text as it arrives so the UI
 * can say what is being written. A stream that fails falls back to the blocking
 * call: progress reporting must never cost anyone their document.
 */
export async function callChatModelStreaming({
  model = DEFAULT_MODEL,
  messages,
  temperature = 0.3,
  maxTokens,
  apiKey,
  onProgress,
}: {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number | null
  apiKey?: string
  onProgress?: (accumulated: string) => void | Promise<void>
}): Promise<string> {
  const provider = providerForModel(model)
  const key = apiKey ?? requireApiKey(provider)
  const request = { apiKey: key, model, messages, temperature, maxTokens, onProgress }

  try {
    return provider === 'gemini'
      ? await streamGeminiChat(request)
      : await streamOpenRouterChat(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // A blocked prompt or a bad key will fail the same way twice; do not retry.
    if (/\b(4\d\d)\b/.test(message) && !/429/.test(message)) throw error
    return await callChatModel({ model, messages, temperature, maxTokens, apiKey: key })
  }
}
