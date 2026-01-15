import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'

const MAX_TYPST_SOURCE_LENGTH = 400_000

export const getMyDocument = query({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const doc = await ctx.db.get(args.documentId)
    if (!doc || doc.userId !== userId) {
      return null
    }
    return doc
  },
})

export const listMyRecentResumes = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const limit = args.limit ?? 3
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user_type_createdAt', (q) =>
        q.eq('userId', userId).eq('type', 'resume'),
      )
      .order('desc')
      .take(limit)
    return docs
  },
})

export const listMyRecentDocuments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const limit = args.limit ?? 6
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit)

    const jobs = await Promise.all(docs.map((doc) => ctx.db.get(doc.jobId)))
    return docs.map((doc, idx) => {
      const job = jobs[idx]
      return {
        ...doc,
        job: job && job.userId === userId ? job : null,
      }
    })
  },
})

export const updateMyTypstSource = mutation({
  args: { documentId: v.id('documents'), typstSource: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    if (args.typstSource.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error('Typst source too large.')
    }
    const doc = await ctx.db.get(args.documentId)
    if (!doc || doc.userId !== userId) {
      throw new Error('Not found.')
    }
    const now = Date.now()
    await ctx.db.patch(args.documentId, { typstSource: args.typstSource, updatedAt: now })
    return { ok: true }
  },
})

export const createGeneratedDocument = mutation({
  args: {
    jobId: v.id('jobs'),
    type: v.union(v.literal('resume'), v.literal('cover_letter')),
    templateId: v.string(),
    llmModel: v.string(),
    tone: v.string(),
    targetLength: v.string(),
    data: v.any(),
    typstSource: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    if (args.typstSource.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error('Typst source too large.')
    }
    const job = await ctx.db.get(args.jobId)
    if (!job || job.userId !== userId) {
      throw new Error('Job not found.')
    }
    const now = Date.now()
    return await ctx.db.insert('documents', {
      userId,
      jobId: args.jobId,
      type: args.type,
      templateId: args.templateId,
      llmModel: args.llmModel,
      tone: args.tone,
      targetLength: args.targetLength,
      data: args.data,
      typstSource: args.typstSource,
      createdAt: now,
      updatedAt: now,
    })
  },
})
