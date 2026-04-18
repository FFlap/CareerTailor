import { Infer, v } from 'convex/values'

export const DEFAULT_OPENROUTER_MODEL = 'arcee-ai/trinity-large-preview:free'

export const openRouterModelIdValidator = v.literal(DEFAULT_OPENROUTER_MODEL)

export type OpenRouterModelId = Infer<typeof openRouterModelIdValidator>

export const OPENROUTER_FREE_MODEL_IDS: OpenRouterModelId[] = [
  DEFAULT_OPENROUTER_MODEL,
]

export function isOpenRouterModelId(value: string): value is OpenRouterModelId {
  return value === DEFAULT_OPENROUTER_MODEL
}
