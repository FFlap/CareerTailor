export const OPENROUTER_FREE_MODELS = [
  {
    id: 'arcee-ai/trinity-large-preview:free',
    label: 'Arcee Trinity Large Preview (free)',
  },
] as const

export type OpenRouterModelId = (typeof OPENROUTER_FREE_MODELS)[number]['id']

export const DEFAULT_OPENROUTER_MODEL: OpenRouterModelId = OPENROUTER_FREE_MODELS[0].id
export const DEFAULT_OPENROUTER_MODEL_LABEL = OPENROUTER_FREE_MODELS[0].label
