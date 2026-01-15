import { Infer, v } from 'convex/values'

export const openRouterModelIdValidator = v.union(
  v.literal('xiaomi/mimo-v2-flash:free'),
  v.literal('z-ai/glm-4.5-air:free'),
  v.literal('deepseek/deepseek-r1-0528:free'),
)

export type OpenRouterModelId = Infer<typeof openRouterModelIdValidator>

export const OPENROUTER_FREE_MODEL_IDS: OpenRouterModelId[] = [
  'xiaomi/mimo-v2-flash:free',
  'z-ai/glm-4.5-air:free',
  'deepseek/deepseek-r1-0528:free',
]
