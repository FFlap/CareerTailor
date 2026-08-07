import { describe, expect, it } from 'vitest'

import {
  hasProjectContent,
  mergeGeneratedProjectsWithProfile,
  normalizeForComparison,
  normalizeGeneratedResume,
  profileHasCompany,
  removeUnsupportedTargetCompanyExperience,
} from '../convex/lib/resumeNormalize'
import { GENERATED_RESUME, JOB, PROFILE } from './fixtures'

describe('normalizeForComparison', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(normalizeForComparison('Helios Robotics, Inc.')).toBe('helios robotics inc')
    expect(normalizeForComparison('  NORTHWIND   DATA ')).toBe('northwind data')
  })

  it('handles nullish values', () => {
    expect(normalizeForComparison(null)).toBe('')
    expect(normalizeForComparison(undefined)).toBe('')
  })
})

describe('profileHasCompany', () => {
  it('recognises an employer the candidate actually worked at', () => {
    expect(profileHasCompany(PROFILE, 'Northwind Data')).toBe(true)
    expect(profileHasCompany(PROFILE, 'northwind data')).toBe(true)
  })

  it('rejects an employer the candidate never worked at', () => {
    expect(profileHasCompany(PROFILE, 'Helios Robotics')).toBe(false)
  })
})

describe('removeUnsupportedTargetCompanyExperience', () => {
  it('drops hallucinated experience at the company being applied to', () => {
    const hallucinated = {
      ...GENERATED_RESUME,
      experience: [
        {
          title: 'Staff Platform Engineer',
          company: 'Helios Robotics',
          location: 'Remote',
          startDate: 'Jan 2024',
          endDate: 'Present',
          bullets: ['Owned the telemetry platform.'],
        },
        ...GENERATED_RESUME.experience,
      ],
    }

    const cleaned = removeUnsupportedTargetCompanyExperience(
      hallucinated,
      PROFILE,
      JOB,
    )
    expect(cleaned.experience.map((r: any) => r.company)).not.toContain(
      'Helios Robotics',
    )
    expect(cleaned.experience).toHaveLength(PROFILE.experience.length)
  })

  it('keeps real experience at the target company (internal move)', () => {
    const internalJob = { ...JOB, company: 'Northwind Data' }
    const cleaned = removeUnsupportedTargetCompanyExperience(
      GENERATED_RESUME,
      PROFILE,
      internalJob,
    )
    expect(cleaned.experience.map((r: any) => r.company)).toContain('Northwind Data')
  })

  it('is a no-op when the job has no company', () => {
    const cleaned = removeUnsupportedTargetCompanyExperience(
      GENERATED_RESUME,
      PROFILE,
      { ...JOB, company: '' },
    )
    expect(cleaned).toEqual(GENERATED_RESUME)
  })
})

describe('mergeGeneratedProjectsWithProfile', () => {
  it('restores projects the model dropped', () => {
    const withoutProjects = { ...GENERATED_RESUME, projects: [] }
    const merged = mergeGeneratedProjectsWithProfile(withoutProjects, PROFILE)
    expect(merged.projects.map((p: any) => p.name)).toEqual(['Tessellate', 'Quorum'])
  })

  it('keeps the model tailored bullets when it kept the project', () => {
    const tailored = {
      ...GENERATED_RESUME,
      projects: [
        {
          name: 'Tessellate',
          technologies: ['Rust'],
          link: '',
          bullets: ['Tailored bullet for the telemetry role.'],
        },
      ],
    }
    const merged = mergeGeneratedProjectsWithProfile(tailored, PROFILE)
    const tessellate = merged.projects.find((p: any) => p.name === 'Tessellate')

    expect(tessellate.bullets).toEqual(['Tailored bullet for the telemetry role.'])
    // The profile's link is authoritative — the model must not blank it.
    expect(tessellate.link).toBe('https://github.com/adalovelace/tessellate')
    // The project the model dropped comes back.
    expect(merged.projects.map((p: any) => p.name)).toContain('Quorum')
  })

  it('drops invented projects that are not in the profile', () => {
    const invented = {
      ...GENERATED_RESUME,
      projects: [
        { name: 'Helios Telemetry Rewrite', technologies: [], link: '', bullets: ['x'] },
      ],
    }
    const merged = mergeGeneratedProjectsWithProfile(invented, PROFILE)
    expect(merged.projects.map((p: any) => p.name)).toEqual(['Tessellate', 'Quorum'])
  })

  it('leaves the resume alone when the profile has no projects', () => {
    const merged = mergeGeneratedProjectsWithProfile(GENERATED_RESUME, {
      ...PROFILE,
      projects: [],
    })
    expect(merged.projects).toEqual(GENERATED_RESUME.projects)
  })
})

describe('hasProjectContent', () => {
  it('rejects fully blank project rows from onboarding', () => {
    expect(hasProjectContent({ name: '', technologies: [], link: '', bullets: [] })).toBe(
      false,
    )
    expect(hasProjectContent({ name: 'Quorum' })).toBe(true)
  })
})

describe('normalizeGeneratedResume', () => {
  it('applies company scrubbing, project merging and the length budget together', () => {
    const messy = {
      ...GENERATED_RESUME,
      experience: [
        {
          title: 'Staff Platform Engineer',
          company: 'Helios Robotics',
          location: 'Remote',
          startDate: 'Jan 2024',
          endDate: 'Present',
          bullets: Array.from({ length: 9 }, (_, i) => `bullet ${i}`),
        },
        ...GENERATED_RESUME.experience,
      ],
      projects: [],
    }

    const result = normalizeGeneratedResume(messy, PROFILE, JOB, {
      tone: 'professional',
      targetLength: '1_page',
    })

    expect(result.experience.map((r: any) => r.company)).not.toContain(
      'Helios Robotics',
    )
    expect(result.projects.map((p: any) => p.name)).toEqual(['Tessellate', 'Quorum'])
    expect(result.experience.length).toBeLessThanOrEqual(4)
  })

  it('skips the length budget when no preferences are supplied', () => {
    const result = normalizeGeneratedResume(GENERATED_RESUME, PROFILE, JOB)
    expect(result.experience).toHaveLength(GENERATED_RESUME.experience.length)
  })
})

describe('profile sections', () => {
  const PROFILE_WITH_SECTIONS = {
    ...PROFILE,
    customSections: [
      {
        id: 'certs',
        title: 'Certifications',
        layout: 'entries',
        items: [{ title: 'CKA' }],
      },
    ],
    sectionOrder: ['experience', 'custom:certs', 'skills'],
  }

  it('carries the profile custom sections into a generated resume', () => {
    const result = normalizeGeneratedResume(
      GENERATED_RESUME,
      PROFILE_WITH_SECTIONS,
      JOB,
    )
    expect(result.customSections).toHaveLength(1)
    expect(result.customSections[0].title).toBe('Certifications')
    expect(result.sectionOrder).toEqual(['experience', 'custom:certs', 'skills'])
  })

  it('leaves a resume alone when the profile has none', () => {
    const result = normalizeGeneratedResume(GENERATED_RESUME, PROFILE, JOB)
    expect(result.customSections).toBeUndefined()
    expect(result.sectionOrder).toBeUndefined()
  })

  it('does not overwrite sections the model already produced', () => {
    const result = normalizeGeneratedResume(
      {
        ...GENERATED_RESUME,
        customSections: [
          { id: 'awards', title: 'Awards', layout: 'bullets', items: [{ title: 'A' }] },
        ],
      },
      PROFILE_WITH_SECTIONS,
      JOB,
    )
    expect(result.customSections[0].title).toBe('Awards')
  })
})
