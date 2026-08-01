import { describe, expect, it } from 'vitest'

import {
  COVER_TEMPLATES,
  RESUME_TEMPLATES,
  buildCoverLetterTypstSource,
  buildCustomCoverLetterTypstSource,
  buildCustomResumeTypstSource,
  buildResumeTypstSource,
  type CoverTemplateId,
  type ResumeTemplateId,
} from '../convex/lib/templates'
import { GENERATED_COVER_LETTER, GENERATED_RESUME, JOB, PROFILE } from './fixtures'

const resumeTemplateIds = Object.keys(RESUME_TEMPLATES) as ResumeTemplateId[]
const coverTemplateIds = Object.keys(COVER_TEMPLATES) as CoverTemplateId[]

const EMPTY_RESUME = {}
const EMPTY_COVER = {}

describe('resume templates', () => {
  it('covers every template the picker offers', () => {
    expect(resumeTemplateIds.length).toBeGreaterThanOrEqual(6)
  })

  it.each(resumeTemplateIds)('renders Typst for %s', (templateId) => {
    const source = buildResumeTypstSource({
      templateId,
      resume: GENERATED_RESUME,
      profile: PROFILE,
    })

    expect(typeof source).toBe('string')
    expect(source.trim().length).toBeGreaterThan(100)
    expect(source).toContain('Ada')
    expect(source).toContain('Lovelace')
    expect(source).toContain('Northwind Data')
  })

  it.each(resumeTemplateIds)('escapes user content for %s', (templateId) => {
    const hostile = {
      ...GENERATED_RESUME,
      summary: 'Cut costs by 50% #panic $math$ "quoted" \\slash\\',
    }
    const source = buildResumeTypstSource({
      templateId,
      resume: hostile,
      profile: PROFILE,
    })

    expect(source).not.toContain('50% #panic')
    expect(source.length).toBeGreaterThan(100)
  })

  it.each(resumeTemplateIds)('survives an empty model payload for %s', (templateId) => {
    expect(() =>
      buildResumeTypstSource({
        templateId,
        resume: EMPTY_RESUME,
        profile: PROFILE,
      }),
    ).not.toThrow()
  })

  it.each(resumeTemplateIds)(
    'survives a null resume and null profile for %s',
    (templateId) => {
      expect(() =>
        buildResumeTypstSource({ templateId, resume: null, profile: null }),
      ).not.toThrow()
    },
  )

  it('produces distinct output per template', () => {
    const rendered = resumeTemplateIds.map((templateId) =>
      buildResumeTypstSource({
        templateId,
        resume: GENERATED_RESUME,
        profile: PROFILE,
      }),
    )
    expect(new Set(rendered).size).toBe(resumeTemplateIds.length)
  })

  it('rejects an unknown template id', () => {
    expect(() =>
      buildResumeTypstSource({
        templateId: 'not_a_template' as ResumeTemplateId,
        resume: GENERATED_RESUME,
        profile: PROFILE,
      }),
    ).toThrow()
  })
})

describe('cover letter templates', () => {
  it('covers every cover template the picker offers', () => {
    expect(coverTemplateIds.length).toBeGreaterThanOrEqual(3)
  })

  it.each(coverTemplateIds)('renders Typst for %s', (templateId) => {
    const source = buildCoverLetterTypstSource({
      templateId,
      coverLetter: GENERATED_COVER_LETTER,
      profile: PROFILE,
      job: JOB,
    })

    expect(typeof source).toBe('string')
    expect(source.trim().length).toBeGreaterThan(100)
    expect(source).toContain('Helios Robotics')
  })

  it.each(coverTemplateIds)(
    'includes every body paragraph for %s',
    (templateId) => {
      const source = buildCoverLetterTypstSource({
        templateId,
        coverLetter: GENERATED_COVER_LETTER,
        profile: PROFILE,
        job: JOB,
      })
      for (const paragraph of GENERATED_COVER_LETTER.body_paragraphs) {
        expect(source).toContain(paragraph.split(' ').slice(0, 4).join(' '))
      }
    },
  )

  it.each(coverTemplateIds)('survives an empty model payload for %s', (templateId) => {
    expect(() =>
      buildCoverLetterTypstSource({
        templateId,
        coverLetter: EMPTY_COVER,
        profile: PROFILE,
        job: JOB,
      }),
    ).not.toThrow()
  })

  it.each(coverTemplateIds)('survives a missing job for %s', (templateId) => {
    expect(() =>
      buildCoverLetterTypstSource({
        templateId,
        coverLetter: GENERATED_COVER_LETTER,
        profile: PROFILE,
        job: null,
      }),
    ).not.toThrow()
  })

  it('produces distinct output per template', () => {
    const rendered = coverTemplateIds.map((templateId) =>
      buildCoverLetterTypstSource({
        templateId,
        coverLetter: GENERATED_COVER_LETTER,
        profile: PROFILE,
        job: JOB,
      }),
    )
    expect(new Set(rendered).size).toBe(coverTemplateIds.length)
  })
})

describe('custom (user-uploaded) templates', () => {
  const CUSTOM_RESUME_SOURCE = [
    '#set page(margin: 36pt)',
    '#text(size: 20pt)[#resume.header.name]',
    '#resume.summary',
  ].join('\n')

  const CUSTOM_COVER_SOURCE = [
    '#set page(margin: 42pt)',
    '#text(size: 18pt)[#sender.name]',
    '#cover_letter.greeting',
  ].join('\n')

  it('injects resume data ahead of the custom source', () => {
    const source = buildCustomResumeTypstSource({
      templateSource: CUSTOM_RESUME_SOURCE,
      resume: GENERATED_RESUME,
      profile: PROFILE,
    })

    expect(source).toContain('Ada')
    expect(source).toContain('Lovelace')
    expect(source).toContain('#resume.header.name')
    expect(source.indexOf('resume')).toBeLessThan(source.lastIndexOf('#set page'))
  })

  it('injects cover letter data ahead of the custom source', () => {
    const source = buildCustomCoverLetterTypstSource({
      templateSource: CUSTOM_COVER_SOURCE,
      coverLetter: GENERATED_COVER_LETTER,
      profile: PROFILE,
      job: JOB,
    })

    expect(source).toContain('Ada')
    expect(source).toContain('Lovelace')
    expect(source).toContain('#cover_letter.greeting')
  })

  it('survives empty payloads', () => {
    expect(() =>
      buildCustomResumeTypstSource({
        templateSource: CUSTOM_RESUME_SOURCE,
        resume: EMPTY_RESUME,
        profile: PROFILE,
      }),
    ).not.toThrow()

    expect(() =>
      buildCustomCoverLetterTypstSource({
        templateSource: CUSTOM_COVER_SOURCE,
        coverLetter: EMPTY_COVER,
        profile: PROFILE,
        job: JOB,
      }),
    ).not.toThrow()
  })
})
