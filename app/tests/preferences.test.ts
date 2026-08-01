import { describe, expect, it } from 'vitest'

import {
  TARGET_LENGTH_IDS,
  TONE_IDS,
  coverLetterPreferenceInstructions,
  enforceCoverLetterLength,
  enforceResumeLength,
  getLengthSpec,
  getToneLabel,
  normalizeTargetLength,
  normalizeTone,
  resumePreferenceInstructions,
} from '../convex/lib/preferences'
import { GENERATED_COVER_LETTER, GENERATED_RESUME } from './fixtures'

function bigResume(roles: number, bulletsPerRole: number, projects: number) {
  return {
    ...GENERATED_RESUME,
    experience: Array.from({ length: roles }, (_, i) => ({
      title: `Role ${i}`,
      company: `Company ${i}`,
      location: 'Remote',
      startDate: 'Jan 2020',
      endDate: 'Present',
      bullets: Array.from({ length: bulletsPerRole }, (_, b) => `Bullet ${i}-${b}`),
    })),
    projects: Array.from({ length: projects }, (_, i) => ({
      name: `Project ${i}`,
      technologies: ['Go'],
      link: '',
      bullets: ['a', 'b', 'c', 'd', 'e', 'f'],
    })),
  }
}

describe('tone normalization', () => {
  it('accepts every tone the generate UI offers', () => {
    for (const tone of TONE_IDS) {
      expect(normalizeTone(tone)).toBe(tone)
    }
  })

  it('is forgiving about casing and separators', () => {
    expect(normalizeTone('Professional')).toBe('professional')
    expect(normalizeTone('  WARM  ')).toBe('warm')
  })

  it('falls back to professional for unknown or missing tones', () => {
    expect(normalizeTone('sassy')).toBe('professional')
    expect(normalizeTone('')).toBe('professional')
    expect(normalizeTone(undefined)).toBe('professional')
    expect(normalizeTone(null)).toBe('professional')
  })
})

describe('target length normalization', () => {
  it('accepts every length the generate UI offers', () => {
    for (const length of TARGET_LENGTH_IDS) {
      expect(normalizeTargetLength(length)).toBe(length)
    }
  })

  it('interprets loose two-page phrasings', () => {
    expect(normalizeTargetLength('2 pages')).toBe('2_pages')
    expect(normalizeTargetLength('two pages')).toBe('2_pages')
  })

  it('defaults to one page', () => {
    expect(normalizeTargetLength('novel')).toBe('1_page')
    expect(normalizeTargetLength(undefined)).toBe('1_page')
  })
})

describe('resume tone instructions', () => {
  it('produces materially different guidance per tone', () => {
    const rendered = TONE_IDS.map((tone) =>
      resumePreferenceInstructions({ tone, targetLength: '1_page' }).join('\n'),
    )
    expect(new Set(rendered).size).toBe(TONE_IDS.length)
  })

  it('names the selected tone and length', () => {
    const lines = resumePreferenceInstructions({
      tone: 'confident',
      targetLength: '2_pages',
    })
    expect(lines.join('\n')).toContain('Confident')
    expect(lines.join('\n')).toContain('Two pages')
  })

  it('always forbids changing facts to match a tone', () => {
    for (const tone of TONE_IDS) {
      const lines = resumePreferenceInstructions({ tone, targetLength: '1_page' })
      expect(lines.join('\n')).toMatch(/WORDING ONLY/)
    }
  })

  it('carries the tone label through getToneLabel', () => {
    expect(getToneLabel('warm')).toBe('Warm')
    expect(getToneLabel('nonsense')).toBe('Professional')
  })
})

describe('cover letter tone instructions', () => {
  it('produces materially different guidance per tone', () => {
    const rendered = TONE_IDS.map((tone) =>
      coverLetterPreferenceInstructions({ tone, targetLength: '1_page' }).join('\n'),
    )
    expect(new Set(rendered).size).toBe(TONE_IDS.length)
  })

  it('pins the paragraph count to the selected length', () => {
    const onePage = coverLetterPreferenceInstructions({
      tone: 'professional',
      targetLength: '1_page',
    }).join('\n')
    const twoPages = coverLetterPreferenceInstructions({
      tone: 'professional',
      targetLength: '2_pages',
    }).join('\n')

    expect(onePage).toContain('exactly 3 entries')
    expect(twoPages).toContain('exactly 4 entries')
  })
})

describe('enforceResumeLength', () => {
  it('trims an over-long resume to the one-page budget', () => {
    const spec = getLengthSpec('1_page')
    const trimmed = enforceResumeLength(bigResume(9, 9, 9), '1_page')

    expect(trimmed.experience).toHaveLength(spec.maxExperienceEntries)
    for (const role of trimmed.experience) {
      expect(role.bullets.length).toBeLessThanOrEqual(spec.maxBulletsPerRole)
    }
    expect(trimmed.projects).toHaveLength(spec.maxProjects)
    for (const project of trimmed.projects) {
      expect(project.bullets.length).toBeLessThanOrEqual(spec.maxBulletsPerProject)
    }
  })

  it('allows more content at two pages than at one', () => {
    const one = enforceResumeLength(bigResume(9, 9, 9), '1_page')
    const two = enforceResumeLength(bigResume(9, 9, 9), '2_pages')

    expect(two.experience.length).toBeGreaterThan(one.experience.length)
    expect(two.experience[0].bullets.length).toBeGreaterThan(
      one.experience[0].bullets.length,
    )
  })

  it('leaves a resume that already fits untouched', () => {
    const small = {
      ...GENERATED_RESUME,
      experience: GENERATED_RESUME.experience.slice(0, 1),
      projects: GENERATED_RESUME.projects.slice(0, 1),
    }
    const trimmed = enforceResumeLength(small, '1_page')
    expect(trimmed.experience).toHaveLength(1)
    expect(trimmed.experience[0].bullets).toEqual(small.experience[0].bullets)
  })

  it('preserves header, summary, skills and education', () => {
    const trimmed = enforceResumeLength(bigResume(9, 9, 9), '1_page')
    expect(trimmed.header).toEqual(GENERATED_RESUME.header)
    expect(trimmed.summary).toBe(GENERATED_RESUME.summary)
    expect(trimmed.skills).toEqual(GENERATED_RESUME.skills)
    expect(trimmed.education).toEqual(GENERATED_RESUME.education)
  })

  it('tolerates malformed input', () => {
    expect(enforceResumeLength(null, '1_page')).toBeNull()
    expect(enforceResumeLength({ experience: 'nope' }, '1_page')).toEqual({
      experience: 'nope',
    })
  })
})

describe('enforceCoverLetterLength', () => {
  it('trims to the paragraph budget and drops blanks', () => {
    const letter = {
      ...GENERATED_COVER_LETTER,
      body_paragraphs: ['a', '', '   ', 'b', 'c', 'd', 'e'],
    }
    expect(enforceCoverLetterLength(letter, '1_page').body_paragraphs).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(enforceCoverLetterLength(letter, '2_pages').body_paragraphs).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('keeps greeting, closing and signature intact', () => {
    const trimmed = enforceCoverLetterLength(GENERATED_COVER_LETTER, '1_page')
    expect(trimmed.greeting).toBe(GENERATED_COVER_LETTER.greeting)
    expect(trimmed.closing).toBe(GENERATED_COVER_LETTER.closing)
    expect(trimmed.signature_name).toBe(GENERATED_COVER_LETTER.signature_name)
  })

  it('tolerates malformed input', () => {
    expect(enforceCoverLetterLength(null, '1_page')).toBeNull()
    expect(enforceCoverLetterLength({ greeting: 'hi' }, '1_page')).toEqual({
      greeting: 'hi',
    })
  })
})
