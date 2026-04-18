import { mutation, query } from './_generated/server'

import { requireUserId } from './lib/auth'
import {
  DEFAULT_OPENROUTER_MODEL,
  isOpenRouterModelId,
  openRouterModelIdValidator,
} from './lib/openrouterModels'
import { coverTemplateIdValidator, resumeTemplateIdValidator } from './lib/templates'

const DEFAULTS = {
  defaultResumeTemplateId: 'basic_resume',
  defaultCoverTemplateId: 'modern_cv_cover',
  defaultModel: DEFAULT_OPENROUTER_MODEL,
} as const

export const mySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (!settings) {
      return { ...DEFAULTS, exists: false }
    }
    return {
      defaultResumeTemplateId: settings.defaultResumeTemplateId,
      defaultCoverTemplateId: settings.defaultCoverTemplateId,
      defaultModel: isOpenRouterModelId(settings.defaultModel)
        ? settings.defaultModel
        : DEFAULT_OPENROUTER_MODEL,
      exists: true,
    }
  },
})

export const upsertMySettings = mutation({
  args: {
    defaultResumeTemplateId: resumeTemplateIdValidator,
    defaultCoverTemplateId: coverTemplateIdValidator,
    defaultModel: openRouterModelIdValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const existing = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        defaultResumeTemplateId: args.defaultResumeTemplateId,
        defaultCoverTemplateId: args.defaultCoverTemplateId,
        defaultModel: args.defaultModel,
        updatedAt: now,
      })
      return { ok: true }
    }
    await ctx.db.insert('userSettings', {
      userId,
      defaultResumeTemplateId: args.defaultResumeTemplateId,
      defaultCoverTemplateId: args.defaultCoverTemplateId,
      defaultModel: args.defaultModel,
      updatedAt: now,
    })
    return { ok: true }
  },
})
