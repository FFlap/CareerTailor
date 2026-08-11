import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  RESUME_STEPS,
  detectResumeStep,
  stepLabel,
  stepProgress,
} from '../convex/lib/progress'
import { streamGeminiChat, streamOpenRouterChat } from '../convex/lib/stream'

afterEach(() => {
  vi.restoreAllMocks()
})

/** An SSE response body, delivered in several network-sized pieces. */
function sseResponse(payloads: string[], chunkSize = 12) {
  const body = payloads.map((line) => `data: ${line}\n\n`).join('')
  const bytes = new TextEncoder().encode(body)
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let at = 0; at < bytes.length; at += chunkSize) {
          controller.enqueue(bytes.slice(at, at + chunkSize))
        }
        controller.close()
      },
    }),
    { status: 200 },
  )
}

const geminiChunk = (text: string) =>
  JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })

const openRouterChunk = (text: string) =>
  JSON.stringify({ choices: [{ delta: { content: text } }] })

describe('detectResumeStep', () => {
  it('has nothing to report before the model opens a section', () => {
    expect(detectResumeStep('')).toBeNull()
    expect(detectResumeStep('{"resume": {')).toBeNull()
  })

  it('names the section currently being written', () => {
    expect(detectResumeStep('{"resume":{"header":{"name":"A"')).toBe('header')
    expect(
      detectResumeStep('{"resume":{"header":{},"summary":"Engineer with'),
    ).toBe('summary')
  })

  it('advances as later sections open', () => {
    const partial =
      '{"resume":{"header":{},"summary":"x","skills":[],"experience":[{"title":"Dev"'
    expect(detectResumeStep(partial)).toBe('experience')
  })

  // A key nested inside a later section must not walk the status backwards.
  it('does not regress when an earlier key reappears inside a later section', () => {
    const partial =
      '{"resume":{"summary":"x","experience":[{"title":"A"}],"projects":[{"name":"P","summary":"q"'
    expect(detectResumeStep(partial)).toBe('projects')
  })

  it('never regresses as the response grows', () => {
    const full =
      '{"resume":{"header":{},"summary":"s","skills":[],"experience":[{"title":"T","summary":"x"}],"projects":[{"name":"P","summary":"y"}],"education":[]}}'
    let highest = -1
    for (let at = 1; at <= full.length; at += 7) {
      const step = detectResumeStep(full.slice(0, at))
      if (!step) continue
      const rank = RESUME_STEPS.indexOf(step)
      expect(rank).toBeGreaterThanOrEqual(highest)
      highest = rank
    }
    expect(highest).toBe(RESUME_STEPS.length - 1)
  })

  it('walks the whole schema in order', () => {
    let text = '{"resume":{'
    const seen: string[] = []
    for (const step of RESUME_STEPS) {
      text += `"${step}": "x",`
      seen.push(detectResumeStep(text) as string)
    }
    expect(seen).toEqual([...RESUME_STEPS])
  })
})

describe('stepProgress and stepLabel', () => {
  it('never goes backwards across the run', () => {
    const order = ['profile', ...RESUME_STEPS, 'fitting', 'cover', 'done']
    const values = order.map(stepProgress)
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
    expect(values[values.length - 1]).toBe(1)
  })

  it('stays inside 0 and 1', () => {
    for (const step of ['profile', 'experience', 'cover', 'done', 'nonsense']) {
      expect(stepProgress(step)).toBeGreaterThanOrEqual(0)
      expect(stepProgress(step)).toBeLessThanOrEqual(1)
    }
    expect(stepProgress(null)).toBe(0)
  })

  it('gives every real step a human label', () => {
    for (const step of ['profile', ...RESUME_STEPS, 'fitting', 'cover', 'done']) {
      expect(stepLabel(step)).not.toBe('Working')
      expect(stepLabel(step).length).toBeGreaterThan(3)
    }
    expect(stepLabel(undefined)).toBe('Starting')
  })
})

describe('streaming transports', () => {
  it('reassembles Gemini text split across network chunks', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([
        geminiChunk('{"resume":{"summary":'),
        geminiChunk('"Engineer",'),
        geminiChunk('"experience":[]}}'),
      ]),
    )

    const text = await streamGeminiChat({
      apiKey: 'k',
      model: 'gemma-4-31b-it',
      messages: [{ role: 'user', content: 'go' }],
    })
    expect(text).toBe('{"resume":{"summary":"Engineer","experience":[]}}')
    expect(JSON.parse(text).resume.summary).toBe('Engineer')
  })

  it('reports progress that only ever grows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([
        geminiChunk('{"resume":{"summary":"' + 'a'.repeat(300) + '",'),
        geminiChunk('"experience":[' + 'b'.repeat(300) + ']}}'),
      ]),
    )

    const seen: string[] = []
    await streamGeminiChat({
      apiKey: 'k',
      model: 'gemma-4-31b-it',
      messages: [{ role: 'user', content: 'go' }],
      onProgress: (accumulated) => {
        seen.push(accumulated)
      },
    })

    expect(seen.length).toBeGreaterThan(1)
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i].length).toBeGreaterThanOrEqual(seen[i - 1].length)
      expect(seen[i].startsWith(seen[i - 1])).toBe(true)
    }
    expect(detectResumeStep(seen[seen.length - 1])).toBe('experience')
  })

  it('reassembles OpenRouter deltas and ignores the terminator', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([
        openRouterChunk('{"resume":'),
        openRouterChunk('{"summary":"S"}}'),
        '[DONE]',
      ]),
    )

    const text = await streamOpenRouterChat({
      apiKey: 'k',
      model: 'arcee-ai/trinity-large-preview:free',
      messages: [{ role: 'user', content: 'go' }],
    })
    expect(text).toBe('{"resume":{"summary":"S"}}')
  })

  it('skips malformed event payloads rather than failing the run', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([geminiChunk('{"a":1}'), 'not-json', geminiChunk('...done')]),
    )

    const text = await streamGeminiChat({
      apiKey: 'k',
      model: 'gemma-4-31b-it',
      messages: [{ role: 'user', content: 'go' }],
    })
    expect(text).toBe('{"a":1}...done')
  })

  it('raises the provider status when the stream is refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', { status: 503 }),
    )

    await expect(
      streamGeminiChat({
        apiKey: 'k',
        model: 'gemma-4-31b-it',
        messages: [{ role: 'user', content: 'go' }],
      }),
    ).rejects.toThrow(/503/)
  })

  it('refuses an empty stream instead of returning nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([]))

    await expect(
      streamGeminiChat({
        apiKey: 'k',
        model: 'gemma-4-31b-it',
        messages: [{ role: 'user', content: 'go' }],
      }),
    ).rejects.toThrow(/empty stream/i)
  })
})
