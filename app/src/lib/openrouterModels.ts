export const OPENROUTER_FREE_MODELS = [
  {
    id: 'xiaomi/mimo-v2-flash:free',
    label: 'Xiaomi MiMo v2 Flash (free)',
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    label: 'GLM-4.5 Air (free)',
  },
  {
    id: 'deepseek/deepseek-r1-0528:free',
    label: 'DeepSeek R1 (free)',
  },
] as const

export type OpenRouterModelId = (typeof OPENROUTER_FREE_MODELS)[number]['id']
