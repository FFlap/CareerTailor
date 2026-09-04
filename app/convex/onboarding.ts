import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'

const answersValidator = v.object({
  goal: v.optional(v.string()),
  stage: v.optional(v.string()),
  field: v.optional(v.string()),
})

async function rowFor(ctx: any, userId: string) {
  return await ctx.db
    .query('onboarding')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .unique()
}

export const myOnboarding = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const row = await rowFor(ctx, userId)
    if (row) {
      return {
        status: row.status,
        step: row.step,
        answers: row.answers,
        tourDone: row.tourDone === true,
      }
    }

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()

    return {
      status: profile ? ('completed' as const) : ('not_started' as const),
      step: 0,
      answers: {},
      tourDone: profile !== null,
    }
  },
})

export const saveProgress = mutation({
  args: { step: v.number(), answers: answersValidator },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const row = await rowFor(ctx, userId)
    if (row) {
      if (row.status !== 'in_progress') return { ok: true }
      await ctx.db.patch(row._id, { step: args.step, answers: args.answers })
      return { ok: true }
    }
    await ctx.db.insert('onboarding', {
      userId,
      status: 'in_progress',
      step: args.step,
      answers: args.answers,
      startedAt: Date.now(),
    })
    return { ok: true }
  },
})

export const finish = mutation({
  args: {
    answers: answersValidator,
    status: v.union(v.literal('completed'), v.literal('skipped')),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const row = await rowFor(ctx, userId)
    if (row) {
      await ctx.db.patch(row._id, {
        status: args.status,
        answers: args.answers,
        completedAt: now,
      })
      return { ok: true }
    }
    await ctx.db.insert('onboarding', {
      userId,
      status: args.status,
      step: 0,
      answers: args.answers,
      tourDone: false,
      startedAt: now,
      completedAt: now,
    })
    return { ok: true }
  },
})

export const markTourDone = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const row = await rowFor(ctx, userId)
    if (row) {
      await ctx.db.patch(row._id, { tourDone: true })
      return { ok: true }
    }
    await ctx.db.insert('onboarding', {
      userId,
      status: 'completed',
      step: 0,
      answers: {},
      tourDone: true,
      startedAt: Date.now(),
      completedAt: Date.now(),
    })
    return { ok: true }
  },
})
