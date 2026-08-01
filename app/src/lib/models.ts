export const AI_MODELS = [
  {
    id: 'gemma-4-31b-it',
    label: 'Gemma 4 31B IT (Google)',
    provider: 'gemini',
  },
  {
    id: 'arcee-ai/trinity-large-preview:free',
    label: 'Arcee Trinity Large Preview (free)',
    provider: 'openrouter',
  },
] as const

export type ModelId = (typeof AI_MODELS)[number]['id']

export const DEFAULT_MODEL: ModelId = AI_MODELS[0].id
export const DEFAULT_MODEL_LABEL: string = AI_MODELS[0].label
