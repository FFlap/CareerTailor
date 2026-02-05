import { query } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'

type JobStatus = 'viewed' | 'applied' | 'interview' | 'accepted' | 'ghosted'

type TrendBucket = {
  label: string
  viewed: number
  applied: number
  interview: number
  accepted: number
  ghosted: number
  added: number
}

type DocumentTrendBucket = {
  label: string
  resumes: number
  coverLetters: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const STALE_DAYS = 14
const MAX_WEEKS = 26
const MIN_WEEKS = 4

function clampWeeks(input: number | undefined) {
  const raw = input ?? 12
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, Math.floor(raw)))
}

function buildJobBucket(label: string): TrendBucket {
  return {
    label,
    viewed: 0,
    applied: 0,
    interview: 0,
    accepted: 0,
    ghosted: 0,
    added: 0,
  }
}

function buildDocumentBucket(label: string): DocumentTrendBucket {
  return {
    label,
    resumes: 0,
    coverLetters: 0,
  }
}

function bucketLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function incrementStatus(bucket: TrendBucket, status: JobStatus) {
  bucket[status] += 1
}

function toTopEntries(map: Map<string, number>, limit = 4) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

export const getMyStatistics = query({
  args: {
    weeks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const weeks = clampWeeks(args.weeks)
    const startAt = now - (weeks - 1) * WEEK_MS
    const jobTrend: TrendBucket[] = []
    const documentTrend: DocumentTrendBucket[] = []

    for (let i = 0; i < weeks; i += 1) {
      const bucketStart = startAt + i * WEEK_MS
      const label = bucketLabel(bucketStart)
      jobTrend.push(buildJobBucket(label))
      documentTrend.push(buildDocumentBucket(label))
    }

    const jobs = await ctx.db
      .query('jobs')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', userId))
      .collect()

    const documents = await ctx.db
      .query('documents')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .collect()

    const jobCounts = {
      total: jobs.length,
      viewed: 0,
      applied: 0,
      interview: 0,
      accepted: 0,
      ghosted: 0,
    }

    let staleJobs = 0
    const staleThreshold = now - STALE_DAYS * 24 * 60 * 60 * 1000

    for (const job of jobs) {
      const status = (job.status ?? 'viewed') as JobStatus
      jobCounts[status] += 1

      const addedAt = job.addedAt ?? job.createdAt ?? job.updatedAt
      if (addedAt >= startAt) {
        const index = Math.floor((addedAt - startAt) / WEEK_MS)
        if (jobTrend[index]) {
          jobTrend[index].added += 1
          incrementStatus(jobTrend[index], status)
        }
      }

      if ((status === 'applied' || status === 'interview') && job.updatedAt < staleThreshold) {
        staleJobs += 1
      }
    }

    const docCounts = {
      total: documents.length,
      resumes: 0,
      coverLetters: 0,
    }

    const templateCounts = new Map<string, number>()
    const toneCounts = new Map<string, number>()
    const modelCounts = new Map<string, number>()

    for (const doc of documents) {
      if (doc.type === 'resume') {
        docCounts.resumes += 1
      } else {
        docCounts.coverLetters += 1
      }

      templateCounts.set(doc.templateId, (templateCounts.get(doc.templateId) ?? 0) + 1)
      toneCounts.set(doc.tone, (toneCounts.get(doc.tone) ?? 0) + 1)
      modelCounts.set(doc.llmModel, (modelCounts.get(doc.llmModel) ?? 0) + 1)

      const createdAt = doc.createdAt
      if (createdAt >= startAt) {
        const index = Math.floor((createdAt - startAt) / WEEK_MS)
        if (documentTrend[index]) {
          if (doc.type === 'resume') {
            documentTrend[index].resumes += 1
          } else {
            documentTrend[index].coverLetters += 1
          }
        }
      }
    }

    const appliedOrBeyond =
      jobCounts.applied + jobCounts.interview + jobCounts.accepted + jobCounts.ghosted
    const interviewStage = jobCounts.interview + jobCounts.accepted

    const jobRates = {
      appliedRate: jobCounts.total ? appliedOrBeyond / jobCounts.total : 0,
      interviewRate: appliedOrBeyond ? interviewStage / appliedOrBeyond : 0,
      acceptanceRate: interviewStage ? jobCounts.accepted / interviewStage : 0,
      ghostRate: appliedOrBeyond ? jobCounts.ghosted / appliedOrBeyond : 0,
    }

    return {
      jobCounts,
      jobRates,
      jobTrend,
      staleJobs,
      docCounts,
      documentTrend,
      docTop: {
        templates: toTopEntries(templateCounts, 4),
        tones: toTopEntries(toneCounts, 4),
        models: toTopEntries(modelCounts, 4),
      },
    }
  },
})
