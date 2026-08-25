import { describe, expect, it } from 'vitest'

import { getThumbnail } from '@/lib/thumbnails'

/**
 * Node has no IndexedDB, so these cover the layer that matters most for the
 * gallery: a page is compiled once, and concurrent tiles never compile at once.
 */
describe('getThumbnail', () => {
  it('renders a key once and serves the rest from memory', async () => {
    let calls = 0
    const produce = async () => {
      calls += 1
      return `data:image/webp;base64,${calls}`
    }

    const first = await getThumbnail('once', produce)
    const second = await getThumbnail('once', produce)

    expect(calls).toBe(1)
    expect(second).toBe(first)
  })

  it('collapses simultaneous requests for the same key', async () => {
    let calls = 0
    const produce = async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      return 'data:image/webp;base64,shared'
    }

    const results = await Promise.all([
      getThumbnail('shared', produce),
      getThumbnail('shared', produce),
      getThumbnail('shared', produce),
    ])

    expect(calls).toBe(1)
    expect(new Set(results).size).toBe(1)
  })

  it('runs one render at a time', async () => {
    let active = 0
    let peak = 0
    const produce = async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return 'data:image/webp;base64,queued'
    }

    await Promise.all(
      ['a', 'b', 'c', 'd'].map((key) => getThumbnail(`queue-${key}`, produce)),
    )

    expect(peak).toBe(1)
  })

  it('keeps a failure from stalling the queue', async () => {
    const failed = getThumbnail('broken', async () => {
      throw new Error('compile failed')
    })
    await expect(failed).rejects.toThrow('compile failed')

    await expect(
      getThumbnail('after-broken', async () => 'data:image/webp;base64,ok'),
    ).resolves.toBe('data:image/webp;base64,ok')
  })
})
