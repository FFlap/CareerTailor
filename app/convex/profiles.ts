import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'

export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    return await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
  },
})

export const upsertMyProfile = mutation({
  args: {
    profile: v.object({
      personal: v.object({
        fullName: v.string(),
        email: v.string(),
        phone: v.string(),
        location: v.string(),
        links: v.array(v.object({ label: v.string(), url: v.string() })),
      }),
      summary: v.string(),
      education: v.array(
        v.object({
          degree: v.string(),
          major: v.string(),
          institution: v.string(),
          location: v.string(),
          startDate: v.string(),
          endDate: v.string(),
          bullets: v.optional(v.array(v.string())),
        }),
      ),
      experience: v.array(
        v.object({
          title: v.string(),
          company: v.string(),
          location: v.string(),
          startDate: v.string(),
          endDate: v.string(),
          bullets: v.array(v.string()),
        }),
      ),
      skills: v.array(
        v.object({
          category: v.string(),
          items: v.array(v.string()),
        }),
      ),
      projects: v.array(
        v.object({
          name: v.string(),
          technologies: v.array(v.string()),
          link: v.string(),
          bullets: v.array(v.string()),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { profile: args.profile, updatedAt: now })
      return existing._id
    }
    return await ctx.db.insert('profiles', {
      userId,
      profile: args.profile,
      updatedAt: now,
    })
  },
})

