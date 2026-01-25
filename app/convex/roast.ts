import { action } from './_generated/server'
import { v } from 'convex/values'

import { requireUserId } from './lib/auth'
import { callOpenRouterChat, safeJsonParse } from './lib/openrouter'

const DEFAULT_MODEL = 'xiaomi/mimo-v2-flash:free'
const MIN_COMMENTS = 12
const OUTPUT_TOKENS: number | null = null
const REPAIR_TOKENS = 1200

type RoastResult = {
  comments?: Array<{ id?: number }>
  [key: string]: unknown
}

export const roastResume = action({
  args: {
    resumeText: v.string(),
    jobDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx)

    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (!openRouterKey) {
      throw new Error('Missing OPENROUTER_API_KEY server env var.')
    }

    const resumeText = args.resumeText.trim()
    if (!resumeText) {
      throw new Error('Resume text is required.')
    }

    const jobDescription = (args.jobDescription ?? '').trim()

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const systemPrompt = [
      'You are a brutally honest, unhinged resume reviewer.',
      'Go hard and do not hold back. Use savage, cutting, darkly funny language.',
      'Keep it focused on the resume content only. Do NOT insult the person.',
      'No slurs, hate, threats, sexual content, or violence.',
      'Roast the resume, but keep feedback actionable and specific.',
      'Scoring must be objective and rubric-based, not influenced by the roast tone.',
      'Scores must be between 0 and 100 (inclusive). Avoid extreme scores unless clearly justified.',
      'Do not worry about character-specific formatting (pipes, bullets, separators, line art). Focus on meaning.',
      'Return ONLY valid JSON with the schema provided.',
      'Every comment must include an exact quote that appears verbatim in the resume text.',
      'Quotes should be short (<= 120 characters).',
      'If no job description is provided, set keywords.score to null and explain in keywords.note.',
    ].join('\n')

    const userPrompt = [
      'Return JSON exactly matching this schema:',
      '{',
      '  "summary": string,',
      '  "metrics": {',
      '    "ats": {"score": number, "note": string},',
      '    "readability": {"score": number, "note": string},',
      '    "xyz": {"score": number, "note": string},',
      '    "keywords": {"score": number|null, "note": string}',
      '  },',
      '  "comments": [',
      '    {"id": number, "quote": string, "comment": string, "severity": "mild"|"spicy"}',
      '  ]',
      '}',
      '',
      'Tone requirements:',
      '- Be as unhinged as possible without violating the safety rules.',
      '- Prefer "spicy" severity for most comments.',
      '- Every comment must include a concrete fix or improvement.',
      '- Provide as many comments as necessary. Minimum 12 comments; add more if you spot more issues.',
      '- Keep the numeric scores fair and reasonable for the actual content; do not lowball just to roast.',
      `- Current date: ${currentDate}.`,
      '',
      'Resume:',
      resumeText,
      '',
      jobDescription ? 'Job description:' : 'Job description: (none)',
      jobDescription || 'N/A',
    ].join('\n')

    function extractJsonCandidate(text: string) {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end === -1 || end <= start) return text
      return text.slice(start, end + 1)
    }

    function fallbackResult(): RoastResult {
      return {
        summary: 'Roast response could not be parsed. Try again for full feedback.',
        metrics: {
          ats: { score: 50, note: 'Unable to score reliably due to parse error.' },
          readability: { score: 50, note: 'Unable to score reliably due to parse error.' },
          xyz: { score: 50, note: 'Unable to score reliably due to parse error.' },
          keywords: {
            score: jobDescription ? 50 : null,
            note: jobDescription ? 'Unable to score reliably due to parse error.' : 'No job description provided.',
          },
        },
        comments: [],
      }
    }

    async function parseJsonWithRepair(raw: string, maxTokens: number): Promise<RoastResult> {
      const candidate = extractJsonCandidate(raw)
      try {
        return safeJsonParse(candidate) as RoastResult
      } catch {
        const fixPrompt = [
          'Fix the JSON string and return ONLY valid JSON.',
          'Do not add commentary, markdown, or code fences.',
          'Ensure arrays/objects are properly closed and commas are correct.',
          'Preserve the original structure and values as much as possible.',
        ].join('\n')
        const repaired = await callOpenRouterChat({
          apiKey: openRouterKey!,
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: 'You fix invalid JSON.' },
            { role: 'user', content: `${fixPrompt}\n\nJSON:\n${candidate}` },
          ],
          temperature: 0,
          maxTokens,
        })
        try {
          return safeJsonParse(repaired) as RoastResult
        } catch {
          const secondRepair = await callOpenRouterChat({
            apiKey: openRouterKey!,
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: 'You fix invalid JSON.' },
              {
                role: 'user',
                content: [
                  fixPrompt,
                  'Return valid JSON only. No extra text.',
                  '',
                  `JSON:\n${extractJsonCandidate(repaired)}`,
                ].join('\n'),
              },
            ],
            temperature: 0,
            maxTokens,
          })
          try {
            return safeJsonParse(secondRepair) as RoastResult
          } catch {
            return fallbackResult()
          }
        }
      }
    }

    async function generateRoast(systemContent: string, userContent: string) {
      try {
        const raw = await callOpenRouterChat({
          apiKey: openRouterKey!,
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
          temperature: 0.7,
          maxTokens: OUTPUT_TOKENS,
        })

        return await parseJsonWithRepair(raw, REPAIR_TOKENS)
      } catch {
        return fallbackResult()
      }
    }

    const initialResult = (await generateRoast(systemPrompt, userPrompt)) as RoastResult
    const initialComments = Array.isArray(initialResult.comments) ? initialResult.comments : []
    if (initialComments.length >= MIN_COMMENTS) {
      return initialResult
    }

    const maxExistingId = initialComments.reduce((max: number, comment: any) => {
      const id = typeof comment?.id === 'number' ? comment.id : 0
      return Math.max(max, id)
    }, 0)

    const expansionPrompt = [
      'You returned too few comments.',
      `Current count: ${initialComments.length}. Minimum required: ${MIN_COMMENTS}.`,
      'Add more UNIQUE comments to reach the minimum.',
      'Do not repeat quotes that were already used.',
      `Start new ids after ${maxExistingId}.`,
      'Return the FULL JSON with the same schema.',
      '',
      'Existing comments (do not repeat):',
      JSON.stringify(initialComments, null, 2),
      '',
      'Resume:',
      resumeText,
      '',
      jobDescription ? 'Job description:' : 'Job description: (none)',
      jobDescription || 'N/A',
    ].join('\n')

    const expandedResult = (await generateRoast(systemPrompt, expansionPrompt)) as RoastResult
    const expandedComments = Array.isArray(expandedResult.comments) ? expandedResult.comments : []

    if (expandedComments.length >= MIN_COMMENTS) {
      return expandedResult
    }

    return initialResult
  },
})
