import { Infer, v } from 'convex/values'

export type AiProvider = 'gemini' | 'openrouter'

export type AiModel = {
  id: string
  label: string
  provider: AiProvider
  vision: boolean
}

export const GEMINI_MODELS = [
  {
    id: 'gemma-4-31b-it',
    label: 'Gemma 4 31B IT (Google)',
    provider: 'gemini',
    vision: true,
  },
] as const satisfies readonly AiModel[]

export const OPENROUTER_MODELS = [
  {
    id: 'arcee-ai/trinity-large-preview:free',
    label: 'Arcee Trinity Large Preview (free)',
    provider: 'openrouter',
    vision: false,
  },
] as const satisfies readonly AiModel[]

export const AI_MODELS: readonly AiModel[] = [...GEMINI_MODELS, ...OPENROUTER_MODELS]

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id
export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_MODELS[0].id

export const DEFAULT_MODEL: string = DEFAULT_GEMINI_MODEL
export const DEFAULT_MODEL_LABEL: string = GEMINI_MODELS[0].label

export const IMAGE_MODEL: string = DEFAULT_GEMINI_MODEL

export const modelIdValidator = v.union(
  v.literal('gemma-4-31b-it'),
  v.literal('arcee-ai/trinity-large-preview:free'),
)

export type ModelId = Infer<typeof modelIdValidator>

export function isModelId(value: string): value is ModelId {
  return AI_MODELS.some((model) => model.id === value)
}

export function getModel(modelId: string): AiModel | undefined {
  return AI_MODELS.find((model) => model.id === modelId)
}

export function providerForModel(modelId: string): AiProvider {
  const model = getModel(modelId)
  if (model) return model.provider
  // Unknown ids that look like `vendor/model` are OpenRouter-style slugs.
  return modelId.includes('/') ? 'openrouter' : 'gemini'
}

export function normalizeModelId(value: string | undefined | null): ModelId {
  return value && isModelId(value) ? value : (DEFAULT_MODEL as ModelId)
}
