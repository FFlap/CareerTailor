import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GEMINI_MAX_OUTPUT_TOKENS,
  buildGeminiRequestBody,
  callGeminiChat,
  extractGeminiText,
  geminiEmptyResponseReason,
  resolveMaxOutputTokens,
} from '../convex/lib/gemini'
import { parseDataUrl } from '../convex/lib/chat'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textPart(text: string) {
  return { text }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildGeminiRequestBody', () => {
  it('hoists system messages into systemInstruction', () => {
    const body = buildGeminiRequestBody({
      messages: [
        { role: 'system', content: 'You are terse.' },
        { role: 'system', content: 'You output JSON.' },
        { role: 'user', content: 'Hello' },
      ],
    })

    expect(body.systemInstruction).toEqual({
      parts: [{ text: 'You are terse.\nYou output JSON.' }],
    })
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'Hello' }] }])
  })

  it('maps assistant to the model role', () => {
    const body = buildGeminiRequestBody({
      messages: [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' },
      ],
    })

    expect(body.contents.map((c) => c.role)).toEqual(['user', 'model', 'user'])
  })

  it('merges consecutive same-role turns, which Gemini requires', () => {
    const body = buildGeminiRequestBody({
      messages: [
        { role: 'user', content: 'A' },
        { role: 'user', content: 'B' },
      ],
    })

    expect(body.contents).toHaveLength(1)
    expect(body.contents[0].parts).toEqual([{ text: 'A' }, { text: 'B' }])
  })

  it('converts image data URLs into inlineData parts', () => {
    const body = buildGeminiRequestBody({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this layout' },
            { type: 'image_url', image_url: { url: TINY_PNG } },
          ],
        },
      ],
    })

    const parts = body.contents[0].parts
    expect(parts[0]).toEqual({ text: 'Describe this layout' })
    expect(parts[1]).toEqual({
      inlineData: { mimeType: 'image/png', data: TINY_PNG.split(',')[1] },
    })
  })

  it('rejects remote image URLs with a clear message', () => {
    expect(() =>
      buildGeminiRequestBody({
        messages: [
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'https://x.test/a.png' } }],
          },
        ],
      }),
    ).toThrow(/base64 data URLs/i)
  })

  it('requests JSON output by default and plain text when asked', () => {
    const json = buildGeminiRequestBody({ messages: [{ role: 'user', content: 'x' }] })
    expect(json.generationConfig.responseMimeType).toBe('application/json')

    const plain = buildGeminiRequestBody({
      messages: [{ role: 'user', content: 'x' }],
      json: false,
    })
    expect(plain.generationConfig.responseMimeType).toBeUndefined()
  })

  it('throws when there is no user or assistant content', () => {
    expect(() =>
      buildGeminiRequestBody({ messages: [{ role: 'system', content: 'only system' }] }),
    ).toThrow(/at least one user message/i)
  })
})

describe('resolveMaxOutputTokens', () => {
  it('leaves headroom above the requested budget for reasoning tokens', () => {
    // gemma-4-31b-it always reasons first and those tokens count against the
    // same budget, so the cap has to exceed what the caller wants to read.
    expect(resolveMaxOutputTokens(4096)).toBeGreaterThan(4096)
    expect(resolveMaxOutputTokens(2048)).toBeGreaterThan(2048)
  })

  it('uses the model ceiling when no budget is given', () => {
    expect(resolveMaxOutputTokens(null)).toBe(GEMINI_MAX_OUTPUT_TOKENS)
    expect(resolveMaxOutputTokens(undefined)).toBe(GEMINI_MAX_OUTPUT_TOKENS)
  })

  it('never exceeds the model ceiling', () => {
    expect(resolveMaxOutputTokens(999_999)).toBe(GEMINI_MAX_OUTPUT_TOKENS)
  })
})

describe('extractGeminiText', () => {
  it('drops reasoning parts and keeps the answer', () => {
    const text = extractGeminiText({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Let me think about this...', thought: true },
              { text: '{"score":' },
              { text: '82}' },
            ],
          },
        },
      ],
    })

    expect(text).toBe('{"score":82}')
  })

  it('returns empty string when the model only produced reasoning', () => {
    const text = extractGeminiText({
      candidates: [
        { content: { parts: [{ text: 'thinking', thought: true }] }, finishReason: 'MAX_TOKENS' },
      ],
    })
    expect(text).toBe('')
  })
})

describe('geminiEmptyResponseReason', () => {
  it('explains a truncated reasoning run', () => {
    expect(
      geminiEmptyResponseReason({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
    ).toMatch(/output token limit/i)
  })

  it('surfaces prompt blocks', () => {
    expect(geminiEmptyResponseReason({ promptFeedback: { blockReason: 'SAFETY' } })).toMatch(
      /blocked the prompt \(SAFETY\)/,
    )
  })
})

describe('callGeminiChat', () => {
  it('posts to the model endpoint with the API key header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ candidates: [{ content: { parts: [textPart('{"ok":true}')] } }] }),
      )

    const result = await callGeminiChat({
      apiKey: 'test-key',
      model: 'gemma-4-31b-it',
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(result).toBe('{"ok":true}')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/models/gemma-4-31b-it:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key')
  })

  it('retries once with the full token ceiling when reasoning consumed the budget', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [
            {
              content: { parts: [{ text: 'thinking...', thought: true }] },
              finishReason: 'MAX_TOKENS',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [textPart('{"ok":1}')] } }] }),
      )

    const result = await callGeminiChat({
      apiKey: 'k',
      model: 'gemma-4-31b-it',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 512,
    })

    expect(result).toBe('{"ok":1}')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(secondBody.generationConfig.maxOutputTokens).toBe(GEMINI_MAX_OUTPUT_TOKENS)
  })

  it('retries transient 503s', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('overloaded', { status: 503 }))
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [textPart('done')] } }] }),
      )

    await expect(
      callGeminiChat({
        apiKey: 'k',
        model: 'gemma-4-31b-it',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).resolves.toBe('done')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 400 and surfaces the API message', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"error":{"message":"bad model"}}', { status: 400 }))

    await expect(
      callGeminiChat({
        apiKey: 'k',
        model: 'gemma-4-31b-it',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow(/Gemini error \(400\).*bad model/s)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to plain text when the model rejects responseMimeType', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('{"error":{"message":"responseMimeType is unsupported"}}', {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [textPart('plain')] } }] }),
      )

    await expect(
      callGeminiChat({
        apiKey: 'k',
        model: 'gemma-4-31b-it',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).resolves.toBe('plain')

    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(secondBody.generationConfig.responseMimeType).toBeUndefined()
  })
})

describe('parseDataUrl', () => {
  it('splits mime type and payload', () => {
    expect(parseDataUrl('data:image/jpeg;base64,AAAA')).toEqual({
      mimeType: 'image/jpeg',
      data: 'AAAA',
    })
  })

  it('rejects non-base64 and remote URLs', () => {
    expect(parseDataUrl('https://example.com/a.png')).toBeNull()
    expect(parseDataUrl('data:image/png,notbase64')).toBeNull()
  })
})
