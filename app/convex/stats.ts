import { query } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'
import { jobSource } from './lib/jobSource'
import { bestRun, currentRun, dayIndexOf } from './lib/streak'

type JobStatus = 'viewed' | 'applied' | 'interview' | 'accepted' | 'ghosted'

type TrendBucket = {
  label: string
  added: number
}

type DocumentTrendBucket = {
  label: string
  resumes: number
  coverLetters: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const MAX_WEEKS = 26
const MIN_WEEKS = 4
const HEATMAP_WEEKS = 15

type DayTally = { jobs: number; documents: number }

function tally(days: Map<number, DayTally>, index: number, key: keyof DayTally) {
  const day = days.get(index) ?? { jobs: 0, documents: 0 }
  day[key] += 1
  days.set(index, day)
}


function clampWeeks(input: number | undefined) {
  const raw = input ?? 12
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, Math.floor(raw)))
}

function buildJobBucket(label: string): TrendBucket {
  return { label, added: 0 }
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

function toTopEntries(map: Map<string, number>, limit = 4) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

export const getMyStatistics = query({
  args: {
    weeks: v.optional(v.number()),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const weeks = clampWeeks(args.weeks)
    // Date#getTimezoneOffset counts minutes behind UTC, so local time subtracts it.
    const offsetMs = (args.tzOffsetMinutes ?? 0) * 60_000
    const activeDays = new Map<number, DayTally>()
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

    let jobsThisWeek = 0
    let jobsPrevWeek = 0
    const weekStart = now - WEEK_MS
    const prevWeekStart = now - 2 * WEEK_MS
    const sourceCounts = new Map<string, number>()
    const companies = new Set<string>()

    for (const job of jobs) {
      const status = (job.status ?? 'viewed') as JobStatus
      jobCounts[status] += 1

      const company = job.company.trim()
      if (company) companies.add(company.toLowerCase())

      const source = jobSource(job.url, job.source)
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)

      const addedAt = job.addedAt ?? job.createdAt ?? job.updatedAt
      tally(activeDays, dayIndexOf(addedAt, offsetMs), 'jobs')

      if (addedAt >= weekStart) {
        jobsThisWeek += 1
      } else if (addedAt >= prevWeekStart) {
        jobsPrevWeek += 1
      }

      if (addedAt >= startAt) {
        const index = Math.floor((addedAt - startAt) / WEEK_MS)
        if (jobTrend[index]) jobTrend[index].added += 1
      }

    }

    const docCounts = {
      total: documents.length,
      resumes: 0,
      coverLetters: 0,
    }

    const templateCounts = new Map<string, number>()
    const toneCounts = new Map<string, number>()
    const tailoredJobIds = new Set<string>()
    let docsThisWeek = 0
    let docsPrevWeek = 0

    for (const doc of documents) {
      if (doc.type === 'resume') {
        docCounts.resumes += 1
      } else {
        docCounts.coverLetters += 1
      }

      if (doc.jobId) tailoredJobIds.add(doc.jobId)

      tally(activeDays, dayIndexOf(doc.createdAt, offsetMs), 'documents')

      if (doc.createdAt >= weekStart) {
        docsThisWeek += 1
      } else if (doc.createdAt >= prevWeekStart) {
        docsPrevWeek += 1
      }

      templateCounts.set(doc.templateId, (templateCounts.get(doc.templateId) ?? 0) + 1)
      toneCounts.set(doc.tone, (toneCounts.get(doc.tone) ?? 0) + 1)

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

    // Only jobs actually sent: a viewed or ghosted one needs no document.
    let untailored = 0
    for (const job of jobs) {
      const status = (job.status ?? 'viewed') as JobStatus
      if (status === 'viewed' || status === 'ghosted') continue
      if (!tailoredJobIds.has(job._id)) untailored += 1
    }

    const todayIndex = dayIndexOf(now, offsetMs)
    const sortedDays = Array.from(activeDays.keys()).sort((a, b) => a - b)

    // The grid always ends on today, so the last column is the week in progress.
    const heatmapDays = HEATMAP_WEEKS * 7
    const firstIndex = todayIndex - heatmapDays + 1
    const calendar = []
    for (let index = firstIndex; index <= todayIndex; index += 1) {
      const day = activeDays.get(index)
      calendar.push({
        ts: index * DAY_MS,
        jobs: day?.jobs ?? 0,
        documents: day?.documents ?? 0,
      })
    }

    const streak = {
      current: currentRun(new Set(sortedDays), todayIndex),
      best: bestRun(sortedDays),
      activeDays: sortedDays.filter((index) => index >= firstIndex).length,
      totalDays: heatmapDays,
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
      docCounts,
      documentTrend,
      docTop: {
        templates: toTopEntries(templateCounts, 4),
        tones: toTopEntries(toneCounts, 4),
      },
      companies: companies.size,
      untailored,
      calendar,
      streak,
      // Uncapped: a truncated list reads as lost jobs.
      sources: toTopEntries(sourceCounts, sourceCounts.size),
      thisWeek: {
        jobs: jobsThisWeek,
        prevJobs: jobsPrevWeek,
        documents: docsThisWeek,
        prevDocuments: docsPrevWeek,
      },
    }
  },
})
