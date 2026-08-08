import { describe, expect, it } from 'vitest'

import { bestRun, currentRun, dayIndexOf } from '../convex/lib/streak'

const DAY_MS = 24 * 60 * 60 * 1000
// Positive, as getTimezoneOffset() reports it for UTC-7.
const UTC_MINUS_7 = 7 * 60 * 60 * 1000

describe('dayIndexOf', () => {
  it('keeps a late evening local to its own day', () => {
    const evening = Date.UTC(2026, 7, 8, 3, 0) // Aug 7, 20:00 local
    const morning = Date.UTC(2026, 7, 7, 16, 0) // Aug 7, 09:00 local
    expect(dayIndexOf(evening, UTC_MINUS_7)).toBe(dayIndexOf(morning, UTC_MINUS_7))
  })

  it('separates days across the local midnight', () => {
    const beforeMidnight = Date.UTC(2026, 7, 8, 6, 59) // Aug 7, 23:59 local
    const afterMidnight = Date.UTC(2026, 7, 8, 7, 1) // Aug 8, 00:01 local
    expect(
      dayIndexOf(afterMidnight, UTC_MINUS_7) - dayIndexOf(beforeMidnight, UTC_MINUS_7),
    ).toBe(1)
  })

  it('round-trips an index back to the local calendar day', () => {
    const ts = Date.UTC(2026, 7, 8, 3, 0) // Aug 7, 20:00 local
    const day = new Date(dayIndexOf(ts, UTC_MINUS_7) * DAY_MS)
    expect(day.getUTCFullYear()).toBe(2026)
    expect(day.getUTCMonth()).toBe(7)
    expect(day.getUTCDate()).toBe(7)
  })
})

describe('bestRun', () => {
  it('is zero with no active days', () => {
    expect(bestRun([])).toBe(0)
  })

  it('finds the longest consecutive run, not the last one', () => {
    expect(bestRun([1, 2, 3, 4, 9, 10, 20])).toBe(4)
  })

  it('counts a lone day as a run of one', () => {
    expect(bestRun([5])).toBe(1)
    expect(bestRun([1, 5, 9])).toBe(1)
  })
})

describe('currentRun', () => {
  it('counts back from today', () => {
    expect(currentRun(new Set([98, 99, 100]), 100)).toBe(3)
  })

  it('survives a day that has not been worked yet', () => {
    expect(currentRun(new Set([97, 98, 99]), 100)).toBe(3)
  })

  it('breaks once a whole day is missed', () => {
    expect(currentRun(new Set([96, 97, 98]), 100)).toBe(0)
  })

  it('is zero with no history', () => {
    expect(currentRun(new Set(), 100)).toBe(0)
  })

  it('ignores days after today', () => {
    expect(currentRun(new Set([100, 101, 102]), 100)).toBe(1)
  })
})
