import { action } from './_generated/server'
import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'

import { requireUserId } from './lib/auth'
import { callOpenRouterChat, safeJsonParse } from './lib/openrouter'
import { openRouterModelIdValidator } from './lib/openrouterModels'
import {
  buildCoverLetterTypstSource,
  buildResumeTypstSource,
  buildCustomCoverLetterTypstSource,
  buildCustomResumeTypstSource,
  coverTemplateIdValidator,
  resumeTemplateIdValidator,
} from './lib/templates'

const jobInput = v.object({
  url: v.string(),
  jobId: v.optional(v.string()),
  source: v.optional(v.string()),
  title: v.optional(v.string()),
  company: v.optional(v.string()),
  description: v.optional(v.string()),
})

const preferencesInput = v.object({
  tone: v.string(),
  targetLength: v.string(),
})

const myProfileRef = makeFunctionReference<'query'>('profiles:myProfile')
const upsertMyJobRef = makeFunctionReference<'mutation'>('jobs:upsertMyJob')
const createGeneratedDocumentRef = makeFunctionReference<'mutation'>(
  'documents:createGeneratedDocument',
)
const getMyTemplateRef = makeFunctionReference<'query'>('customTemplates:getMyTemplate')

export const generateDocuments = action({
  args: {
    job: jobInput,
    documentType: v.union(
      v.literal('resume'),
      v.literal('cover_letter'),
      v.literal('both'),
    ),
    resumeTemplateId: resumeTemplateIdValidator,
    coverTemplateId: coverTemplateIdValidator,
    customResumeTemplateId: v.optional(v.id('customTemplates')),
    customCoverTemplateId: v.optional(v.id('customTemplates')),
    model: openRouterModelIdValidator,
    preferences: preferencesInput,
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx)

    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (!openRouterKey) {
      throw new Error('Missing OPENROUTER_API_KEY server env var.')
    }

    const profileDoc = await ctx.runQuery(myProfileRef, {})
    const profile = (profileDoc as any)?.profile
    if (!profile?.personal?.fullName) {
      throw new Error('Complete onboarding before generating documents.')
    }

    const jobId = await ctx.runMutation(upsertMyJobRef, {
      url: args.job.url,
      jobId: args.job.jobId ?? '',
      source: args.job.source ?? 'extension',
      title: args.job.title ?? '',
      company: args.job.company ?? '',
      description: args.job.description ?? '',
      status: 'viewed',
    })

    const baseInput = {
      user_profile: profile,
      job: {
        title: args.job.title ?? '',
        company: args.job.company ?? '',
        description: args.job.description ?? '',
        url: args.job.url,
      },
      preferences: args.preferences,
    }

    const documents: { resumeId?: string; coverId?: string } = {}

    async function parseJsonWithRepair(raw: string, maxTokens: number) {
      try {
        return safeJsonParse(raw)
      } catch (error) {
        const fixPrompt = [
          'Fix the JSON string and return ONLY valid JSON.',
          'Do not add commentary, markdown, or code fences.',
          'Preserve the original structure and values as much as possible.',
        ].join('\n')
        const repaired = await callOpenRouterChat({
          apiKey: openRouterKey!,
          model: args.model,
          messages: [
            { role: 'system', content: 'You fix invalid JSON.' },
            { role: 'user', content: `${fixPrompt}\n\nJSON:\n${raw}` },
          ],
          temperature: 0,
          maxTokens,
        })
        return safeJsonParse(repaired)
      }
    }

    if (args.documentType === 'resume' || args.documentType === 'both') {
      let customResumeSource: string | null = null
      if (args.customResumeTemplateId) {
        const customTemplate = await ctx.runQuery(getMyTemplateRef, {
          templateId: args.customResumeTemplateId,
        })
        if (!customTemplate || customTemplate.type !== 'resume') {
          throw new Error('Custom resume template not found.')
        }
        customResumeSource = customTemplate.source
      }

      const prompt = [
        'You are an expert ATS resume writer.',
        'Return ONLY valid JSON (no markdown, no code fences).',
        'Use double quotes for all strings and keys.',
        'Do not include trailing commas.',
        'Replace line breaks in strings with \\n.',
        'Avoid fabrication. Prefer quantified impact when the profile includes metrics.',
        `Output schema: ${JSON.stringify(
          {
            resume: {
              header: {
                name: '',
                email: '',
                phone: '',
                location: '',
                links: [{ label: '', url: '' }],
              },
              summary: '',
              skills: [{ category: '', items: [''] }],
              experience: [
                {
                  title: '',
                  company: '',
                  location: '',
                  startDate: '',
                  endDate: '',
                  bullets: [''],
                },
              ],
              projects: [
                {
                  name: '',
                  technologies: [''],
                  link: '',
                  bullets: [''],
                },
              ],
              education: [
                {
                  degree: '',
                  major: '',
                  institution: '',
                  location: '',
                  startDate: '',
                  endDate: '',
                },
              ],
            },
          },
          null,
          0,
        )}`,
        `Input: ${JSON.stringify(baseInput)}`,
      ].join('\n')

      const raw = await callOpenRouterChat({
        apiKey: openRouterKey,
        model: args.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 4096,
      })
      const parsed = (await parseJsonWithRepair(raw, 4096)) as any
      const resume = parsed?.resume ?? parsed

      const typstSource = customResumeSource
        ? buildCustomResumeTypstSource({
            templateSource: customResumeSource,
            resume,
            profile,
          })
        : buildResumeTypstSource({
            templateId: args.resumeTemplateId,
            resume,
            profile,
          })

      const resumeDocId = await ctx.runMutation(createGeneratedDocumentRef, {
        jobId,
        type: 'resume',
        templateId: customResumeSource
          ? `custom:${args.customResumeTemplateId}`
          : args.resumeTemplateId,
        llmModel: args.model,
        tone: args.preferences.tone,
        targetLength: args.preferences.targetLength,
        data: resume,
        typstSource,
      })

      documents.resumeId = resumeDocId as any
    }

    if (args.documentType === 'cover_letter' || args.documentType === 'both') {
      let customCoverSource: string | null = null
      if (args.customCoverTemplateId) {
        const customTemplate = await ctx.runQuery(getMyTemplateRef, {
          templateId: args.customCoverTemplateId,
        })
        if (!customTemplate || customTemplate.type !== 'cover_letter') {
          throw new Error('Custom cover letter template not found.')
        }
        customCoverSource = customTemplate.source
      }

      const prompt = [
        'You are an expert cover letter writer.',
        'Return ONLY valid JSON (no markdown, no code fences).',
        'Use double quotes for all strings and keys.',
        'Do not include trailing commas.',
        'Replace line breaks in strings with \\n.',
        'Avoid fabrication. Keep it concise and role-specific.',
        `Output schema: ${JSON.stringify(
          {
            cover_letter: {
              greeting: '',
              body_paragraphs: [''],
              closing: '',
              signature_name: '',
            },
          },
          null,
          0,
        )}`,
        `Input: ${JSON.stringify(baseInput)}`,
      ].join('\n')

      const raw = await callOpenRouterChat({
        apiKey: openRouterKey,
        model: args.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 2048,
      })
      const parsed = (await parseJsonWithRepair(raw, 2048)) as any
      const coverLetter = parsed?.cover_letter ?? parsed

      const typstSource = customCoverSource
        ? buildCustomCoverLetterTypstSource({
            templateSource: customCoverSource,
            coverLetter,
            profile,
            job: args.job,
          })
        : buildCoverLetterTypstSource({
            templateId: args.coverTemplateId,
            coverLetter,
            profile,
            job: args.job,
          })

      const coverDocId = await ctx.runMutation(createGeneratedDocumentRef, {
        jobId,
        type: 'cover_letter',
        templateId: customCoverSource
          ? `custom:${args.customCoverTemplateId}`
          : args.coverTemplateId,
        llmModel: args.model,
        tone: args.preferences.tone,
        targetLength: args.preferences.targetLength,
        data: coverLetter,
        typstSource,
      })
      documents.coverId = coverDocId as any
    }

    return { jobId, ...documents }
  },
})
