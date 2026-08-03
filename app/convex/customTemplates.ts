import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'

const MAX_TYPST_SOURCE_LENGTH = 400_000

const templateTypeValidator = v.union(
  v.literal('resume'),
  v.literal('cover_letter'),
)

export const listMyTemplates = query({
  args: { type: v.optional(templateTypeValidator) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const type = args.type
    if (type) {
      return await ctx.db
        .query('customTemplates')
        .withIndex('by_user_type', (q) =>
          q.eq('userId', userId).eq('type', type),
        )
        .order('desc')
        .collect()
    }
    return await ctx.db
      .query('customTemplates')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
  },
})

export const getMyTemplate = query({
  args: { templateId: v.id('customTemplates') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const template = await ctx.db.get(args.templateId)
    if (!template || template.userId !== userId) {
      return null
    }
    return template
  },
})

export const createTemplateFromSource = mutation({
  args: {
    name: v.string(),
    type: templateTypeValidator,
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const name = args.name.trim()
    if (!name) {
      throw new Error('Template name is required.')
    }
    if (args.source.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error('Typst source too large.')
    }
    const now = Date.now()
    return await ctx.db.insert('customTemplates', {
      userId,
      name,
      type: args.type,
      source: args.source,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const deleteTemplate = mutation({
  args: { templateId: v.id('customTemplates') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const template = await ctx.db.get(args.templateId)
    if (!template || template.userId !== userId) {
      throw new Error('Template not found.')
    }
    await ctx.db.delete(args.templateId)
    return { ok: true }
  },
})
