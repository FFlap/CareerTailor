import { action } from './_generated/server'
import { v } from 'convex/values'
import { requireUserId } from './lib/auth'
import { callChatModel, safeJsonParse } from './lib/llm'
import { DEFAULT_MODEL, modelIdValidator } from './lib/models'

export const parseResumeText = action({
  args: {
    resumeText: v.string(),
    model: v.optional(modelIdValidator),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx)

    const prompt = `You are an expert resume parser.
Extract structured data from this resume text and return ONLY valid JSON.

Output schema: {
  personal: { fullName, email, phone, location, links: [{label, url}] },
  summary: string,
  experience: [{ title, company, location, startDate, endDate, bullets: [] }],
  education: [{ degree, major, institution, location, startDate, endDate }],
  skills: [{ category, items: [] }],
  projects: [{ name, technologies: [], link, bullets: [] }]
}

Important parsing rules:
- For links, infer common labels like "LinkedIn", "GitHub", "Portfolio" from URLs
- If no summary section exists, leave it as empty string
- For dates, use formats like "Jan 2023" or "Present"
- Extract bullet points as achievement statements
- Group skills by category (e.g., "Programming Languages", "Frameworks", "Tools")
- All array fields should be arrays even if empty
- All string fields should be strings even if empty

Resume text:
${args.resumeText}`

    const raw = await callChatModel({
      model: args.model ?? DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 4096,
    })

    return safeJsonParse(raw)
  },
})

export const parseCoverLetterText = action({
  args: {
    coverLetterText: v.string(),
    model: v.optional(modelIdValidator),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx)

    const prompt = `You are an expert cover letter parser.
Extract structured data from this cover letter text and return ONLY valid JSON.

Output schema: {
  cover_letter: {
    greeting: string,
    body_paragraphs: [string],
    closing: string,
    signature_name: string
  }
}

Important parsing rules:
- Keep paragraph order intact
- Use an array for body_paragraphs even if only one paragraph
- All string fields should be strings even if empty

Cover letter text:
${args.coverLetterText}`

    const raw = await callChatModel({
      model: args.model ?? DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 2048,
    })

    return safeJsonParse(raw)
  },
})
