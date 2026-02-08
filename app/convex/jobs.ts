import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'

const MAX_JOB_TEXT = {
  title: 200,
  company: 200,
  description: 50_000,
  source: 40,
  jobId: 200,
} as const

export const upsertMyJob = mutation({
  args: {
    url: v.string(),
    jobId: v.optional(v.string()),
    source: v.optional(v.string()),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    description: v.optional(v.string()),
    addedAt: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal('viewed'),
        v.literal('applied'),
        v.literal('interview'),
        v.literal('accepted'),
        v.literal('ghosted'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const url = args.url.trim()
    if (!url) {
      throw new Error('Job url is required.')
    }
    let normalizedUrl: string
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Job url must start with http:// or https://.')
      }
      normalizedUrl = parsed.toString()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Invalid job url.')
    }

    const existing = await ctx.db
      .query('jobs')
      .withIndex('by_user_url', (q) => q.eq('userId', userId).eq('url', normalizedUrl))
      .unique()

    const safeAddedAt =
      typeof args.addedAt === 'number' && Number.isFinite(args.addedAt)
        ? Math.min(Math.max(args.addedAt, 0), now)
        : undefined

    const inputStatus = args.status ?? 'viewed'
    const resolvedStatus =
      existing && inputStatus === 'viewed' && existing.status !== 'viewed'
        ? existing.status
        : inputStatus

    const payload = {
      title: (args.title?.trim() ?? '').slice(0, MAX_JOB_TEXT.title),
      company: (args.company?.trim() ?? '').slice(0, MAX_JOB_TEXT.company),
      description: (args.description?.trim() ?? '').slice(0, MAX_JOB_TEXT.description),
      jobId: (args.jobId?.trim() ?? '').slice(0, MAX_JOB_TEXT.jobId),
      source: (args.source?.trim() ?? 'extension').slice(0, MAX_JOB_TEXT.source),
      status: resolvedStatus,
      lastSeenAt: now,
      updatedAt: now,
    } as const

    if (existing) {
      const addedAt = existing.addedAt ?? safeAddedAt ?? existing.createdAt ?? now
      await ctx.db.patch(existing._id, {
        ...payload,
        ...(existing.addedAt ? {} : { addedAt }),
      })
      return existing._id
    }

    return await ctx.db.insert('jobs', {
      userId,
      url: normalizedUrl,
      ...payload,
      addedAt: safeAddedAt ?? now,
      createdAt: now,
    })
  },
})

export const listMyJobs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const limit = args.limit ?? 50
    const results = await ctx.db
      .query('jobs')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit)
    return results
  },
})

export const getMyAppliedProgress = query({
  args: {
    sinceMs: v.optional(v.number()),
    untilMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const sinceMs =
      typeof args.sinceMs === 'number' && Number.isFinite(args.sinceMs)
        ? Math.max(args.sinceMs, 0)
        : 0
    const untilMs =
      typeof args.untilMs === 'number' && Number.isFinite(args.untilMs)
        ? Math.max(args.untilMs, sinceMs)
        : now

    const jobsInWindow = await ctx.db
      .query('jobs')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.gte(q.field('updatedAt'), sinceMs),
          q.lt(q.field('updatedAt'), untilMs),
        ),
      )
      .collect()

    let appliedOrBeyondCount = 0
    for (const job of jobsInWindow) {
      if (
        job.status === 'applied' ||
        job.status === 'interview' ||
        job.status === 'accepted' ||
        job.status === 'ghosted'
      ) {
        appliedOrBeyondCount += 1
      }
    }

    return {
      appliedOrBeyondCount,
      totalTrackedJobs: jobsInWindow.length,
    }
  },
})

export const getMyJobByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const url = args.url.trim()
    if (!url) return null
    let normalizedUrl: string
    try {
      const parsed = new URL(url)
      normalizedUrl = parsed.toString()
    } catch {
      return null
    }
    return await ctx.db
      .query('jobs')
      .withIndex('by_user_url', (q) =>
        q.eq('userId', userId).eq('url', normalizedUrl),
      )
      .unique()
  },
})

export const setJobStatus = mutation({
  args: {
    jobId: v.id('jobs'),
    status: v.union(
      v.literal('viewed'),
      v.literal('applied'),
      v.literal('interview'),
      v.literal('accepted'),
      v.literal('ghosted'),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const job = await ctx.db.get(args.jobId)
    if (!job || job.userId !== userId) {
      throw new Error('Not found.')
    }
    const now = Date.now()
    await ctx.db.patch(args.jobId, { status: args.status, updatedAt: now })
    return { ok: true }
  },
})
