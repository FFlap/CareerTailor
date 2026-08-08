import { describe, expect, it } from 'vitest'

import { jobSource } from '../convex/lib/jobSource'

describe('jobSource', () => {
  it('reads the board off the link, not the stored source', () => {
    expect(
      jobSource('https://www.linkedin.com/jobs/view/4012345678/', 'extension'),
    ).toBe('linkedin')
    expect(
      jobSource('https://www.indeed.com/viewjob?jk=abc123', 'extension'),
    ).toBe('indeed')
  })

  it('folds regional domains into one bucket', () => {
    expect(jobSource('https://uk.indeed.com/viewjob?jk=1', '')).toBe('indeed')
    expect(jobSource('https://ca.indeed.com/viewjob?jk=1', '')).toBe('indeed')
    expect(jobSource('https://www.linkedin.com/jobs/view/1', '')).toBe('linkedin')
    expect(jobSource('https://uk.linkedin.com/jobs/view/1', '')).toBe('linkedin')
  })

  it('recognises the applicant tracking systems behind company listings', () => {
    expect(jobSource('https://boards.greenhouse.io/acme/jobs/1', '')).toBe(
      'greenhouse',
    )
    expect(jobSource('https://jobs.lever.co/acme/abc', '')).toBe('lever')
    expect(jobSource('https://jobs.ashbyhq.com/acme/abc', '')).toBe('ashby')
    expect(jobSource('https://acme.wd1.myworkdayjobs.com/en-US/careers', '')).toBe(
      'workday',
    )
  })

  it('keeps an unrecognised career page as its own host', () => {
    expect(jobSource('https://careers.stripe.com/jobs/1', 'extension')).toBe(
      'careers.stripe.com',
    )
    expect(jobSource('https://www.example.org/jobs/1', '')).toBe('example.org')
  })

  it('falls back to the stored source when there is no usable link', () => {
    expect(jobSource('', 'extension')).toBe('extension')
    expect(jobSource('not a url', 'LinkedIn')).toBe('linkedin')
    expect(jobSource('', '')).toBe('manual')
  })
})
