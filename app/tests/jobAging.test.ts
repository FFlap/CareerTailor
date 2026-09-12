import { afterEach, describe, expect, it, vi } from 'vitest'
import { appliedAtForStatus, needsUpdate, oneMonthAfter } from '../convex/lib/jobAging'
import { markStaleApplications } from '../convex/jobs'

const ms = (date: string) => Date.parse(date)
afterEach(() => vi.restoreAllMocks())

describe('application aging', () => {
  it.each([
    ['2026-01-31T12:30:00Z', '2026-02-28T12:30:00Z'],
    ['2028-01-31T12:30:00Z', '2028-02-29T12:30:00Z'],
    ['2026-12-15T12:30:00Z', '2027-01-15T12:30:00Z'],
  ])('adds a calendar month to %s', (start, end) => {
    expect(oneMonthAfter(ms(start))).toBe(ms(end))
  })

  it('expires exactly at the anniversary and ignores other stages', () => {
    const job = { status: 'applied', appliedAt: ms('2026-08-12T10:00:00Z'), updatedAt: ms('2026-09-10T10:00:00Z') }
    const due = ms('2026-09-12T10:00:00Z')
    expect(needsUpdate(job, due - 1)).toBe(false)
    expect(needsUpdate(job, due)).toBe(true)
    for (const status of ['viewed', 'interview', 'accepted', 'ghosted', 'rejected', 'needs_update']) {
      expect(needsUpdate({ ...job, status }, due)).toBe(false)
    }
  })

  it('preserves the timer on revisits, supports legacy jobs, and resets on returning to Applied', () => {
    const existing = { status: 'applied', updatedAt: 100, appliedAt: 50 }
    expect(appliedAtForStatus(existing, 'applied', 200)).toBe(50)
    expect(appliedAtForStatus({ status: 'applied', updatedAt: 100 }, 'applied', 200)).toBe(100)
    expect(appliedAtForStatus({ ...existing, status: 'needs_update' }, 'applied', 200)).toBe(200)
    expect(appliedAtForStatus(null, 'applied', 200)).toBe(200)
    expect(needsUpdate({ status: 'applied', updatedAt: ms('2026-08-12') }, ms('2026-09-12'))).toBe(true)
  })

  it('patches only stale applications and schedules the next batch', async () => {
    const now = ms('2026-09-12')
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const patch = vi.fn()
    const runAfter = vi.fn()
    const paginate = vi.fn().mockResolvedValue({
      page: [
        { _id: 'old', status: 'applied', updatedAt: ms('2026-07-01') },
        { _id: 'new', status: 'applied', appliedAt: ms('2026-09-01'), updatedAt: now },
      ],
      isDone: false,
      continueCursor: 'next-page',
    })
    const ctx = {
      db: { query: () => ({ withIndex: () => ({ paginate }) }), patch },
      scheduler: { runAfter },
    }
    const handler = (markStaleApplications as unknown as {
      _handler: (ctx: unknown, args: { cursor?: string }) => Promise<null>
    })._handler
    await handler(ctx, {})
    expect(paginate).toHaveBeenCalledWith({ cursor: null, numItems: 100 })
    expect(patch).toHaveBeenCalledExactlyOnceWith('old', {
      status: 'needs_update', appliedAt: ms('2026-07-01'), updatedAt: now,
    })
    expect(runAfter).toHaveBeenCalledWith(0, expect.anything(), { cursor: 'next-page' })
    paginate.mockResolvedValue({ page: [], isDone: true })
    runAfter.mockClear()
    await handler(ctx, { cursor: 'next-page' })
    expect(runAfter).not.toHaveBeenCalled()
  })
})
