export type Preferences = {
  tone: string
  targetLength: string
}

export const TONE_IDS = ['professional', 'direct', 'confident', 'warm'] as const
export const TARGET_LENGTH_IDS = ['1_page', '2_pages'] as const

export type ToneId = (typeof TONE_IDS)[number]
export type TargetLengthId = (typeof TARGET_LENGTH_IDS)[number]

type ToneSpec = {
  label: string
  resume: string
  cover: string
}

const TONES: Record<ToneId, ToneSpec> = {
  professional: {
    label: 'Professional',
    resume:
      'Neutral, polished, industry-standard resume voice. Measured verbs (led, delivered, implemented). No slang, no hype adjectives, no first-person pronouns.',
    cover:
      'Formal but human. Full sentences, courteous framing, no exclamation marks, no casual contractions beyond natural business writing.',
  },
  direct: {
    label: 'Direct',
    resume:
      'Terse and high-density. Short bullets that lead with the action and the number. Strip hedging words ("helped", "assisted with", "responsible for") and filler adjectives entirely.',
    cover:
      'Short paragraphs, plain words, no throat-clearing. Open with the point, state the evidence, close with a clear ask. No flowery language.',
  },
  confident: {
    label: 'Confident',
    resume:
      'Assertive ownership language. Lead with strong verbs (owned, drove, architected, scaled) and foreground scope and outcomes. Assertive, never boastful, and never beyond what the profile supports.',
    cover:
      'Self-assured and forward-leaning. State fit plainly and back every claim with a concrete result from the profile. No hedging or apologetic phrasing.',
  },
  warm: {
    label: 'Warm',
    resume:
      'Approachable and human while staying professional. Highlight collaboration, mentorship, and cross-team impact alongside technical results. Keep bullets concrete, not sentimental.',
    cover:
      'Friendly and personable. Show genuine interest in the team and mission, use natural conversational rhythm, and stay specific rather than gushing.',
  },
}

type LengthSpec = {
  label: string
  resumeGuidance: string
  coverGuidance: string
  maxExperienceEntries: number
  maxBulletsPerRole: number
  maxProjects: number
  maxBulletsPerProject: number
  summarySentences: number
  coverParagraphs: number
}

const LENGTHS: Record<TargetLengthId, LengthSpec> = {
  '1_page': {
    label: 'One page',
    resumeGuidance:
      'The resume must fit on ONE page. Keep at most 4 experience entries with at most 4 bullets each, at most 3 projects with at most 3 bullets each, and a summary of at most 2 sentences. Each bullet stays under roughly 200 characters. Drop the least relevant items rather than shortening everything into vagueness.',
    coverGuidance:
      'Keep the cover letter to 3 body paragraphs that fit comfortably on one page.',
    maxExperienceEntries: 4,
    maxBulletsPerRole: 4,
    maxProjects: 3,
    maxBulletsPerProject: 3,
    summarySentences: 2,
    coverParagraphs: 3,
  },
  '2_pages': {
    label: 'Two pages',
    resumeGuidance:
      'The resume may run up to TWO pages. Use up to 6 experience entries with up to 6 bullets each, up to 5 projects with up to 4 bullets each, and a summary of at most 4 sentences. Add depth and supporting detail rather than padding with filler.',
    coverGuidance:
      'The cover letter may run up to 4 body paragraphs with additional supporting detail.',
    maxExperienceEntries: 6,
    maxBulletsPerRole: 6,
    maxProjects: 5,
    maxBulletsPerProject: 4,
    summarySentences: 4,
    coverParagraphs: 4,
  },
}

export function normalizeTone(tone: string | undefined | null): ToneId {
  const raw = String(tone ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (TONE_IDS as readonly string[]).includes(raw) ? (raw as ToneId) : 'professional'
}

export function normalizeTargetLength(
  targetLength: string | undefined | null,
): TargetLengthId {
  const raw = String(targetLength ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if ((TARGET_LENGTH_IDS as readonly string[]).includes(raw)) return raw as TargetLengthId
  if (raw.startsWith('2') || raw.includes('two')) return '2_pages'
  return '1_page'
}

export function getLengthSpec(targetLength: string | undefined | null): LengthSpec {
  return LENGTHS[normalizeTargetLength(targetLength)]
}

export function getToneLabel(tone: string | undefined | null): string {
  return TONES[normalizeTone(tone)].label
}

export function resumePreferenceInstructions(preferences: Preferences): string[] {
  const tone = TONES[normalizeTone(preferences.tone)]
  const length = getLengthSpec(preferences.targetLength)
  return [
    `Writing tone: ${tone.label}. ${tone.resume}`,
    `Target length: ${length.label}. ${length.resumeGuidance}`,
    'Tone controls WORDING ONLY. Never add, remove, exaggerate, or invent facts, employers, dates, metrics, or skills to match a tone.',
  ]
}

export function coverLetterPreferenceInstructions(preferences: Preferences): string[] {
  const tone = TONES[normalizeTone(preferences.tone)]
  const length = getLengthSpec(preferences.targetLength)
  return [
    `Writing tone: ${tone.label}. ${tone.cover}`,
    `Target length: ${length.label}. ${length.coverGuidance} Produce exactly ${length.coverParagraphs} entries in body_paragraphs.`,
    'Tone controls WORDING ONLY. Never invent achievements, employers, or metrics that are absent from user_profile.',
  ]
}

export function enforceResumeLength(resume: any, targetLength: string | undefined | null) {
  if (!resume || typeof resume !== 'object') return resume
  const spec = getLengthSpec(targetLength)

  const experience = Array.isArray(resume.experience)
    ? resume.experience.slice(0, spec.maxExperienceEntries).map((role: any) => ({
        ...role,
        bullets: Array.isArray(role?.bullets)
          ? role.bullets.slice(0, spec.maxBulletsPerRole)
          : [],
      }))
    : resume.experience

  const projects = Array.isArray(resume.projects)
    ? resume.projects.slice(0, spec.maxProjects).map((project: any) => ({
        ...project,
        bullets: Array.isArray(project?.bullets)
          ? project.bullets.slice(0, spec.maxBulletsPerProject)
          : [],
      }))
    : resume.projects

  return { ...resume, experience, projects }
}

export function enforceCoverLetterLength(
  coverLetter: any,
  targetLength: string | undefined | null,
) {
  if (!coverLetter || typeof coverLetter !== 'object') return coverLetter
  const spec = getLengthSpec(targetLength)
  if (!Array.isArray(coverLetter.body_paragraphs)) return coverLetter
  return {
    ...coverLetter,
    body_paragraphs: coverLetter.body_paragraphs
      .filter((paragraph: unknown) => String(paragraph ?? '').trim().length > 0)
      .slice(0, spec.coverParagraphs),
  }
}
