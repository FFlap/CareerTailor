import { action, mutation, query } from './_generated/server'
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'
import { callChatModel, extractJsonCandidate, safeJsonParse } from './lib/llm'
import { DEFAULT_MODEL, modelIdValidator } from './lib/models'
import { resumeDataToText } from './lib/reviewText'

const MIN_COMMENTS = 10
const REPAIR_TOKENS = 1500
const MAX_RESUME_TEXT = 60_000

const METRIC_KEYS = ['ats', 'readability', 'impact', 'keywords'] as const
const SECTIONS = [
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'formatting',
  'other',
] as const

type Metric = { score: number | null; note: string }
type ReviewComment = {
  id: number
  quote: string
  comment: string
  fix: string
  severity: 'minor' | 'major'
  section: string
  /** The entry the note is about, e.g. "Business Analyst · StackDX". */
  area: string
}
type ReviewResult = {
  summary: string
  metrics: Record<(typeof METRIC_KEYS)[number], Metric>
  comments: ReviewComment[]
}

const reviewInputRef = makeFunctionReference<'query'>('reviews:reviewInputForDocument')
const saveReviewRef = makeFunctionReference<'mutation'>('reviews:saveReview')

/** Everything a document review needs, resolved server-side in one hop. */
export const reviewInputForDocument = query({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const doc = await ctx.db.get(args.documentId)
    if (!doc || doc.userId !== userId) return null

    const job = doc.jobId ? await ctx.db.get(doc.jobId) : null
    const safeJob = job && job.userId === userId ? job : null

    return {
      type: doc.type,
      resumeText: doc.type === 'resume' ? resumeDataToText(doc.data) : '',
      jobDescription: safeJob?.description ?? '',
      label: safeJob?.title
        ? [safeJob.title, safeJob.company].filter(Boolean).join(' · ')
        : 'Résumé',
    }
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const saveReview = mutation({
  args: {
    documentId: v.optional(v.id('documents')),
    source: v.union(v.literal('document'), v.literal('upload')),
    label: v.string(),
    storageId: v.optional(v.id('_storage')),
    resumeText: v.string(),
    jobDescription: v.optional(v.string()),
    summary: v.string(),
    overall: v.number(),
    metrics: v.any(),
    comments: v.any(),
    llmModel: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)

    let jobId: any = undefined
    if (args.documentId) {
      const doc = await ctx.db.get(args.documentId)
      if (!doc || doc.userId !== userId) {
        throw new Error('Document not found.')
      }
      jobId = doc.jobId
    }

    return await ctx.db.insert('reviews', {
      userId,
      documentId: args.documentId,
      jobId,
      source: args.source,
      label: args.label,
      storageId: args.storageId,
      resumeText: args.resumeText,
      jobDescription: args.jobDescription,
      summary: args.summary,
      overall: args.overall,
      metrics: args.metrics,
      comments: args.comments,
      llmModel: args.llmModel,
      createdAt: Date.now(),
    })
  },
})

export const getMyReview = query({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review || review.userId !== userId) return null

    const fileUrl = review.storageId
      ? await ctx.storage.getUrl(review.storageId)
      : null
    const job = review.jobId ? await ctx.db.get(review.jobId) : null

    return {
      ...review,
      fileUrl,
      job: job && job.userId === userId ? job : null,
    }
  },
})

/** The review the editor shows for a document: the newest one written for it. */
export const latestForDocument = query({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_user_document', (q) =>
        q.eq('userId', userId).eq('documentId', args.documentId),
      )
      .collect()
    if (reviews.length === 0) return null
    return reviews.reduce((newest, review) =>
      review.createdAt > newest.createdAt ? review : newest,
    )
  },
})

export const listMyReviews = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(args.limit ?? 100)

    const jobs = await Promise.all(
      reviews.map((review) => (review.jobId ? ctx.db.get(review.jobId) : null)),
    )

    // The list only needs the scores; the comments can stay on the record.
    return reviews.map((review, index) => {
      const job = jobs[index]
      const { comments, resumeText, ...rest } = review
      return {
        ...rest,
        commentCount: Array.isArray(comments) ? comments.length : 0,
        job: job && job.userId === userId ? job : null,
      }
    })
  },
})

export const deleteMyReview = mutation({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review || review.userId !== userId) {
      throw new Error('Not found.')
    }
    if (review.storageId) {
      await ctx.storage.delete(review.storageId)
    }
    await ctx.db.delete(args.reviewId)
    return { ok: true }
  },
})

export const reviewResume = action({
  args: {
    documentId: v.optional(v.id('documents')),
    resumeText: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    label: v.optional(v.string()),
    jobDescription: v.optional(v.string()),
    model: v.optional(modelIdValidator),
  },
  handler: async (ctx, args): Promise<{ reviewId: string; overall: number }> => {
    await requireUserId(ctx)

    const model = args.model ?? DEFAULT_MODEL

    // A document review reads the stored résumé, not whatever the client sent.
    let resumeText = (args.resumeText ?? '').trim()
    let label = (args.label ?? '').trim()
    let jobDescription = (args.jobDescription ?? '').trim()

    if (args.documentId) {
      const input: any = await ctx.runQuery(reviewInputRef, {
        documentId: args.documentId,
      })
      if (!input) throw new Error('Document not found.')
      if (input.type !== 'resume') {
        throw new Error('Only résumés can be reviewed.')
      }
      resumeText = input.resumeText
      // The posting the document was written for is the one to score against.
      if (!jobDescription) jobDescription = input.jobDescription ?? ''
      if (!label) label = input.label
    }

    if (!resumeText) {
      throw new Error(
        'There is no readable text to review. Upload a text PDF, or generate a résumé first.',
      )
    }
    if (resumeText.length > MAX_RESUME_TEXT) {
      resumeText = resumeText.slice(0, MAX_RESUME_TEXT)
    }

    const result = await runReview({ model, resumeText, jobDescription })
    const overall = overallScore(result.metrics)

    const reviewId = await ctx.runMutation(saveReviewRef, {
      documentId: args.documentId,
      source: args.documentId ? 'document' : 'upload',
      label: label || 'Uploaded résumé',
      storageId: args.storageId,
      resumeText,
      jobDescription: jobDescription || undefined,
      summary: result.summary,
      overall,
      metrics: result.metrics,
      comments: result.comments,
      llmModel: model,
    })

    return { reviewId: reviewId as string, overall }
  },
})

/** One number for the list rows. Keywords only counts when a posting was given. */
function overallScore(metrics: ReviewResult['metrics']): number {
  const scores = METRIC_KEYS.map((key) => metrics[key]?.score).filter(
    (score): score is number => typeof score === 'number',
  )
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

async function runReview({
  model,
  resumeText,
  jobDescription,
}: {
  model: string
  resumeText: string
  jobDescription: string
}): Promise<ReviewResult> {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const systemPrompt = [
    'You are a senior technical recruiter reviewing a résumé.',
    'Be direct and specific. Say what is weak and why, in plain professional language.',
    'No jokes, no insults, no praise that is not earned. Judge the writing, never the person.',
    'Every comment names one problem and gives the concrete rewrite or addition that fixes it.',
    'Scores are rubric-based and must reflect the actual content, not the tone of the notes.',
    'Scores are integers between 0 and 100. Reserve above 90 and below 20 for clear cases.',
    'Ignore character-level formatting artefacts — pipes, bullet glyphs, separators, line art.',
    'Every comment quotes text that appears verbatim in the résumé, 120 characters or fewer.',
    'Return ONLY valid JSON matching the schema. No markdown, no code fences, no commentary.',
    '',
    'The résumé is given as labelled sections. Every field the candidate filled in is shown.',
    'NEVER report a field as missing unless it is genuinely absent from the text you were given.',
    'Entry headings read "Title | Company | Location | Start to End". If dates are on that line,',
    'the dates exist — do not ask for them.',
    'Projects have no date field in this product. Never ask for project dates, timelines, or recency.',
    jobDescription
      ? 'Score keywords against the job description provided.'
      : 'No job description was given: set metrics.keywords.score to null and say so in its note.',
  ].join('\n')

  const userPrompt = [
    'Return JSON exactly matching this schema:',
    '{',
    '  "summary": string,',
    '  "metrics": {',
    '    "ats": {"score": number, "note": string},',
    '    "readability": {"score": number, "note": string},',
    '    "impact": {"score": number, "note": string},',
    '    "keywords": {"score": number|null, "note": string}',
    '  },',
    '  "comments": [',
    '    {"id": number, "quote": string, "section": string, "area": string,',
    '     "severity": "minor"|"major", "comment": string, "fix": string}',
    '  ]',
    '}',
    '',
    'Field rules:',
    '- summary: two or three sentences on where this résumé stands and what to fix first.',
    '- metrics.ats: whether a parser can read the structure, dates, and contact block.',
    '- metrics.readability: scanning speed, bullet length, jargon, consistency of voice.',
    '- metrics.impact: whether bullets state action, scope, and measured result.',
    `- comments[].section: one of ${SECTIONS.join(', ')}.`,
    '- comments[].area: the exact entry the note is about, copied from that entry\'s heading —',
    '  "Business Analyst · StackDX" for a role, "BlockBuddy (HackTheChange)" for a project,',
    '  "Bachelor of Science · University of Alberta" for a degree. Use the same wording for every',
    '  note about the same entry so they group together. Leave it "" only when the note is about',
    '  the section as a whole rather than one entry.',
    '- comments[].severity: "major" costs interviews, "minor" is polish.',
    '- comments[].comment: the problem, one or two sentences.',
    '- comments[].fix: the replacement line or the exact change to make.',
    `- Write at least ${MIN_COMMENTS} comments, more if the résumé warrants it. Never repeat a quote.`,
    `- Today is ${currentDate}; judge dates and gaps against it.`,
    '',
    'What to look for, in priority order:',
    '1. Bullets with no measured result. Rewrite them in Google\'s XYZ form:',
    '   "Accomplished [X] as measured by [Y] by doing [Z]."',
    '   The fix must contain a specific metric — throughput, latency, users, revenue, time saved,',
    '   error rate, team size, data volume. If the résumé gives no number, name the metric the',
    '   candidate should measure and mark it, e.g. "cut build time from 9 min to [X] min".',
    '2. Weak or passive openers: "responsible for", "helped with", "worked on", "assisted",',
    '   "participated in". Replace with a strong past-tense verb naming what they owned.',
    '3. Duties written instead of achievements — what the job was, rather than what changed.',
    '4. Scope left implicit: no size, volume, users, or team named alongside the work.',
    '5. Repeated verbs across bullets, and bullets longer than two lines.',
    '6. Voice: no first-person pronouns; past tense for past roles, present for the current one.',
    '7. Skills claimed in the skills list but never evidenced anywhere in experience or projects.',
    '8. Buzzwords with nothing behind them, and unexplained internal acronyms.',
    '9. Summary that describes ambitions rather than what the candidate has already done.',
    '',
    'Résumé:',
    resumeText,
    '',
    jobDescription ? 'Job description:' : 'Job description: (none)',
    jobDescription || 'N/A',
  ].join('\n')

  const raw = await callChatModel({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    maxTokens: null,
  })

  const parsed = await parseWithRepair(raw, model)
  return normalizeResult(parsed, Boolean(jobDescription))
}

async function parseWithRepair(raw: string, model: string): Promise<any> {
  const candidate = extractJsonCandidate(raw)
  try {
    return safeJsonParse(candidate)
  } catch {
    const repaired = await callChatModel({
      model,
      messages: [
        { role: 'system', content: 'You fix invalid JSON.' },
        {
          role: 'user',
          content: [
            'Fix this JSON and return ONLY valid JSON.',
            'No commentary, no markdown, no code fences.',
            'Close every array and object, and keep the original values.',
            '',
            `JSON:\n${candidate}`,
          ].join('\n'),
        },
      ],
      temperature: 0,
      maxTokens: REPAIR_TOKENS,
    })
    try {
      return safeJsonParse(extractJsonCandidate(repaired))
    } catch {
      throw new Error(
        `The review from ${model} could not be read. Try again, or pick a different model.`,
      )
    }
  }
}

function clampScore(value: unknown): number | null {
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score)) return null
  return Math.round(Math.max(0, Math.min(100, score)))
}

/** The model is asked for this shape; the UI is not written to hope for it. */
function normalizeResult(parsed: any, hasJobDescription: boolean): ReviewResult {
  const rawMetrics = parsed?.metrics ?? {}
  const metrics = {} as ReviewResult['metrics']

  for (const key of METRIC_KEYS) {
    const metric = rawMetrics[key] ?? {}
    const scorable = key !== 'keywords' || hasJobDescription
    metrics[key] = {
      score: scorable ? clampScore(metric.score) : null,
      note:
        typeof metric.note === 'string' && metric.note.trim()
          ? metric.note.trim()
          : scorable
            ? 'No note returned for this score.'
            : 'Not scored — no job description was provided.',
    }
  }

  const seen = new Set<string>()
  const comments: ReviewComment[] = (
    Array.isArray(parsed?.comments) ? parsed.comments : []
  )
    .map((comment: any, index: number) => {
      const quote = typeof comment?.quote === 'string' ? comment.quote.trim() : ''
      const body = typeof comment?.comment === 'string' ? comment.comment.trim() : ''
      if (!body) return null
      const section = String(comment?.section ?? 'other').toLowerCase()
      return {
        id: typeof comment?.id === 'number' ? comment.id : index + 1,
        quote,
        comment: body,
        fix: typeof comment?.fix === 'string' ? comment.fix.trim() : '',
        severity: comment?.severity === 'minor' ? 'minor' : 'major',
        section: (SECTIONS as readonly string[]).includes(section) ? section : 'other',
        area: typeof comment?.area === 'string' ? comment.area.trim() : '',
      } satisfies ReviewComment
    })
    .filter((comment: ReviewComment | null): comment is ReviewComment => {
      if (!comment) return false
      const key = `${comment.quote}::${comment.comment}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((comment: ReviewComment, index: number) => ({ ...comment, id: index + 1 }))

  const summary =
    typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'No overall summary was returned for this review.'

  return { summary, metrics, comments }
}
