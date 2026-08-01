import { ChatMessage } from './chat'
import { callGeminiChat } from './gemini'
import { callOpenRouterChat } from './openrouter'
import { AiProvider, DEFAULT_MODEL, providerForModel } from './models'

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
