import { beforeAll, describe, expect, it } from 'vitest'

import { callGeminiChat } from '../convex/lib/gemini'
import { safeJsonParse } from '../convex/lib/json'
import { DEFAULT_MODEL } from '../convex/lib/models'
import {
  TONE_IDS,
  coverLetterPreferenceInstructions,
  enforceCoverLetterLength,
  getLengthSpec,
  resumePreferenceInstructions,
} from '../convex/lib/preferences'
import { normalizeGeneratedResume } from '../convex/lib/resumeNormalize'
import {
  COVER_TEMPLATES,
  RESUME_TEMPLATES,
  buildCoverLetterTypstSource,
  buildResumeTypstSource,
  type CoverTemplateId,
  type ResumeTemplateId,
} from '../convex/lib/templates'
import { JOB, PROFILE, RESUME_TEXT_TO_PARSE, WEAK_RESUME_TEXT } from './fixtures'
import { LIVE, getGeminiKey } from './liveKey'

const describeLive = LIVE ? describe : describe.skip

let apiKey: string

beforeAll(() => {
  apiKey = getGeminiKey() ?? ''
})

const RESUME_SCHEMA = {
  resume: {
    header: { name: '', email: '', phone: '', location: '', links: [{ label: '', url: '' }] },
    summary: '',
    skills: [{ category: '', items: [''] }],
    experience: [
      { title: '', company: '', location: '', startDate: '', endDate: '', bullets: [''] },
    ],
    projects: [{ name: '', technologies: [''], link: '', bullets: [''] }],
    education: [
      { degree: '', major: '', institution: '', location: '', startDate: '', endDate: '' },
    ],
  },
}

const COVER_SCHEMA = {
  cover_letter: { greeting: '', body_paragraphs: [''], closing: '', signature_name: '' },
}

function baseInput(preferences: { tone: string; targetLength: string }) {
  return {
    user_profile: PROFILE,
    job: {
      title: JOB.title,
      company: JOB.company,
      description: JOB.description,
      url: JOB.url,
    },
    preferences,
  }
}

function resumePrompt(preferences: { tone: string; targetLength: string }) {
  return [
    'You are an expert ATS resume writer.',
    'Return ONLY valid JSON (no markdown, no code fences).',
    'Use double quotes for all strings and keys.',
    'Avoid fabrication. Prefer quantified impact when the profile includes metrics.',
    "Treat user_profile as the ONLY source of the candidate's factual experience, education, skills, projects, contact details, dates, employers, and achievements.",
    'Treat job as the TARGET ROLE only. Use the job title, company, and description to tailor wording, keywords, ordering, summary, and emphasis.',
    'Never add the target company or target job title as past or current experience unless user_profile already contains that employer and role.',
    'Always include projects from user_profile.projects in the projects array when they exist.',
    ...resumePreferenceInstructions(preferences),
    `Output schema: ${JSON.stringify(RESUME_SCHEMA)}`,
    `Input: ${JSON.stringify(baseInput(preferences))}`,
  ].join('\n')
}

function coverPrompt(preferences: { tone: string; targetLength: string }) {
  return [
    'You are an expert cover letter writer.',
    'Return ONLY valid JSON (no markdown, no code fences).',
    'Avoid fabrication. Keep it concise and role-specific.',
    ...coverLetterPreferenceInstructions(preferences),
    `Output schema: ${JSON.stringify(COVER_SCHEMA)}`,
    `Input: ${JSON.stringify(baseInput(preferences))}`,
  ].join('\n')
}

async function generateResume(preferences: { tone: string; targetLength: string }) {
  const raw = await callGeminiChat({
    apiKey,
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: resumePrompt(preferences) }],
    temperature: 0.3,
    maxTokens: 4096,
  })
  const parsed = safeJsonParse(raw) as any
  return normalizeGeneratedResume(parsed?.resume ?? parsed, PROFILE, JOB, preferences)
}

async function generateCoverLetter(preferences: { tone: string; targetLength: string }) {
  const raw = await callGeminiChat({
    apiKey,
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: coverPrompt(preferences) }],
    temperature: 0.4,
    maxTokens: 2048,
  })
  const parsed = safeJsonParse(raw) as any
  return enforceCoverLetterLength(
    parsed?.cover_letter ?? parsed,
    preferences.targetLength,
  )
}

function expectValidResume(resume: any) {
  expect(resume).toBeTruthy()
  expect(typeof resume.summary).toBe('string')
  expect(Array.isArray(resume.experience)).toBe(true)
  expect(resume.experience.length).toBeGreaterThan(0)
  expect(Array.isArray(resume.skills)).toBe(true)
  expect(Array.isArray(resume.projects)).toBe(true)
  expect(Array.isArray(resume.education)).toBe(true)

  for (const role of resume.experience) {
    expect(typeof role.title).toBe('string')
    expect(typeof role.company).toBe('string')
    expect(Array.isArray(role.bullets)).toBe(true)
  }
}

describeLive('gemini connectivity', () => {
  it('returns JSON from gemma-4-31b-it', async () => {
    const raw = await callGeminiChat({
      apiKey,
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You return JSON only.' },
        { role: 'user', content: 'Return exactly {"ok": true} and nothing else.' },
      ],
      temperature: 0,
      maxTokens: 256,
    })
    expect(safeJsonParse(raw)).toMatchObject({ ok: true })
  })
})

describeLive('resume generation', () => {
  let resume: any

  beforeAll(async () => {
    resume = await generateResume({ tone: 'professional', targetLength: '1_page' })
  }, 180_000)

  it('returns a well-formed resume object', () => {
    expectValidResume(resume)
  })

  it('keeps the candidate grounded in their own profile', () => {
    const companies = resume.experience.map((r: any) => String(r.company).toLowerCase())
    expect(companies.some((c: string) => c.includes('northwind'))).toBe(true)
    expect(companies.some((c: string) => c.includes('helios'))).toBe(false)
  })

  it('preserves the profile projects', () => {
    const names = resume.projects.map((p: any) => String(p.name))
    expect(names).toContain('Tessellate')
    expect(names).toContain('Quorum')
  })

  it('tailors toward the target role', () => {
    const text = JSON.stringify(resume).toLowerCase()
    const signals = ['go', 'kubernetes', 'latency', 'mentor', 'distributed']
    expect(signals.filter((s) => text.includes(s)).length).toBeGreaterThanOrEqual(2)
  })

  it('respects the one-page budget', () => {
    const spec = getLengthSpec('1_page')
    expect(resume.experience.length).toBeLessThanOrEqual(spec.maxExperienceEntries)
    for (const role of resume.experience) {
      expect(role.bullets.length).toBeLessThanOrEqual(spec.maxBulletsPerRole)
    }
  })

  it('renders into every resume template', () => {
    for (const templateId of Object.keys(RESUME_TEMPLATES) as ResumeTemplateId[]) {
      const source = buildResumeTypstSource({ templateId, resume, profile: PROFILE })
      expect(source.length).toBeGreaterThan(200)
      expect(source).toContain('Lovelace')
    }
  })
})

describeLive('cover letter generation', () => {
  let coverLetter: any

  beforeAll(async () => {
    coverLetter = await generateCoverLetter({
      tone: 'professional',
      targetLength: '1_page',
    })
  }, 180_000)

  it('returns a well-formed cover letter', () => {
    expect(typeof coverLetter.greeting).toBe('string')
    expect(Array.isArray(coverLetter.body_paragraphs)).toBe(true)
    expect(coverLetter.body_paragraphs.length).toBeGreaterThan(0)
    expect(coverLetter.body_paragraphs.length).toBeLessThanOrEqual(3)
    expect(typeof coverLetter.closing).toBe('string')
    expect(String(coverLetter.signature_name)).toContain('Ada')
  })

  it('mentions the target company', () => {
    expect(JSON.stringify(coverLetter)).toMatch(/helios/i)
  })

  it('renders into every cover letter template', () => {
    for (const templateId of Object.keys(COVER_TEMPLATES) as CoverTemplateId[]) {
      const source = buildCoverLetterTypstSource({
        templateId,
        coverLetter,
        profile: PROFILE,
        job: JOB,
      })
      expect(source.length).toBeGreaterThan(200)
    }
  })
})

describeLive('tone changes', () => {
  const results: Record<string, any> = {}

  beforeAll(async () => {
    for (const tone of TONE_IDS) {
      results[tone] = await generateResume({ tone, targetLength: '1_page' })
    }
  }, 600_000)

  it.each(TONE_IDS)('produces a valid resume in the %s tone', (tone) => {
    expectValidResume(results[tone])
  })

  it.each(TONE_IDS)('keeps facts stable across the %s tone', (tone) => {
    const companies = results[tone].experience.map((r: any) =>
      String(r.company).toLowerCase(),
    )
    expect(companies.some((c: string) => c.includes('northwind'))).toBe(true)
    expect(companies.some((c: string) => c.includes('helios'))).toBe(false)
  })

  it('actually changes the wording between tones', () => {
    const summaries = TONE_IDS.map((tone) => String(results[tone].summary))
    expect(new Set(summaries).size).toBeGreaterThan(1)
  })

  it('renders every tone into the default template', () => {
    for (const tone of TONE_IDS) {
      const source = buildResumeTypstSource({
        templateId: 'basic_resume',
        resume: results[tone],
        profile: PROFILE,
      })
      expect(source.length).toBeGreaterThan(200)
    }
  })
})

describeLive('length changes', () => {
  it('produces a longer draft at two pages than at one', async () => {
    const onePage = await generateResume({ tone: 'professional', targetLength: '1_page' })
    const twoPages = await generateResume({ tone: 'professional', targetLength: '2_pages' })

    expectValidResume(onePage)
    expectValidResume(twoPages)

    const spec = getLengthSpec('2_pages')
    expect(twoPages.experience.length).toBeLessThanOrEqual(spec.maxExperienceEntries)

    const bulletCount = (r: any) =>
      r.experience.reduce((n: number, role: any) => n + role.bullets.length, 0)
    expect(bulletCount(twoPages)).toBeGreaterThanOrEqual(bulletCount(onePage))
  }, 300_000)

  it('honours the cover letter paragraph budget at both lengths', async () => {
    const onePage = await generateCoverLetter({
      tone: 'professional',
      targetLength: '1_page',
    })
    const twoPages = await generateCoverLetter({
      tone: 'professional',
      targetLength: '2_pages',
    })

    expect(onePage.body_paragraphs.length).toBeLessThanOrEqual(3)
    expect(twoPages.body_paragraphs.length).toBeLessThanOrEqual(4)
  }, 300_000)
})

describeLive('scoring (review)', () => {
  let result: any

  beforeAll(async () => {
    const systemPrompt = [
      'You are a senior technical recruiter reviewing a résumé.',
      'Scoring must be objective and rubric-based.',
      'Scores must be between 0 and 100 (inclusive).',
      'Return ONLY valid JSON with the schema provided.',
      'Every comment must include an exact quote that appears verbatim in the resume text.',
      'If no job description is provided, set keywords.score to null and explain in keywords.note.',
    ].join('\n')

    const userPrompt = [
      'Return JSON exactly matching this schema:',
      '{"summary": string, "metrics": {"ats": {"score": number, "note": string},',
      '"readability": {"score": number, "note": string},',
      '"impact": {"score": number, "note": string},',
      '"keywords": {"score": number|null, "note": string}},',
      '"comments": [{"id": number, "quote": string, "section": string,',
      '"severity": "minor"|"major", "comment": string, "fix": string}]}',
      '',
      'Provide at least 6 comments.',
      '',
      'Resume:',
      WEAK_RESUME_TEXT,
      '',
      'Job description: (none)',
      'N/A',
    ].join('\n')

    const raw = await callGeminiChat({
      apiKey,
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: null,
    })
    result = safeJsonParse(raw)
  }, 300_000)

  it('returns all four metrics', () => {
    for (const metric of ['ats', 'readability', 'impact', 'keywords']) {
      expect(result.metrics[metric]).toBeTruthy()
      expect(typeof result.metrics[metric].note).toBe('string')
    }
  })

  it('keeps scores inside 0-100', () => {
    for (const metric of ['ats', 'readability', 'impact']) {
      const score = result.metrics[metric].score
      expect(typeof score).toBe('number')
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('nulls the keyword score when there is no job description', () => {
    expect(result.metrics.keywords.score ?? null).toBeNull()
  })

  it('returns actionable comments', () => {
    expect(Array.isArray(result.comments)).toBe(true)
    expect(result.comments.length).toBeGreaterThanOrEqual(4)
    for (const comment of result.comments) {
      expect(typeof comment.comment).toBe('string')
      expect(comment.comment.length).toBeGreaterThan(10)
      expect(['minor', 'major']).toContain(comment.severity)
      expect(typeof comment.fix).toBe('string')
    }
  })

  it('scores a weak resume below a perfect score', () => {
    expect(result.metrics.ats.score).toBeLessThan(90)
  })
})

describeLive('resume parsing', () => {
  it('extracts structured data from pasted resume text', async () => {
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

All array fields should be arrays even if empty.

Resume text:
${RESUME_TEXT_TO_PARSE}`

    const raw = await callGeminiChat({
      apiKey,
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 4096,
    })
    const parsed = safeJsonParse(raw) as any

    expect(String(parsed.personal.fullName)).toContain('Ada')
    expect(parsed.personal.email).toBe('ada@example.com')
    expect(Array.isArray(parsed.experience)).toBe(true)
    expect(parsed.experience.length).toBeGreaterThanOrEqual(2)
    expect(
      parsed.experience.some((r: any) => String(r.company).toLowerCase().includes('northwind')),
    ).toBe(true)
    expect(Array.isArray(parsed.skills)).toBe(true)
    expect(Array.isArray(parsed.education)).toBe(true)
  }, 180_000)
})

describeLive('tailoring an existing resume to a new job', () => {
  it('re-emphasises without inventing employers', async () => {
    const prompt = [
      'You are an expert ATS resume writer.',
      'Return ONLY valid JSON (no markdown, no code fences).',
      'Rewrite the existing_resume to target the job below.',
      'Do NOT invent employers, dates, degrees or metrics that are absent from existing_resume.',
      'You may reorder, reword, and re-emphasise.',
      `Output schema: ${JSON.stringify(RESUME_SCHEMA)}`,
      `Input: ${JSON.stringify({
        existing_resume: PROFILE,
        job: { title: JOB.title, company: JOB.company, description: JOB.description },
      })}`,
    ].join('\n')

    const raw = await callGeminiChat({
      apiKey,
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
    })
    const parsed = safeJsonParse(raw) as any
    const tailored = normalizeGeneratedResume(parsed?.resume ?? parsed, PROFILE, JOB, {
      tone: 'professional',
      targetLength: '1_page',
    })

    expectValidResume(tailored)

    const allowed = new Set(
      PROFILE.experience.map((r) => r.company.toLowerCase().replace(/[^a-z0-9]/g, '')),
    )
    for (const role of tailored.experience) {
      const key = String(role.company).toLowerCase().replace(/[^a-z0-9]/g, '')
      expect(allowed.has(key)).toBe(true)
    }
  }, 300_000)
})
