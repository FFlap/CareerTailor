import { execFileSync } from 'node:child_process'

let cached: string | null | undefined

/** Reads GEMINI_API_KEY from env or `npx convex env get`; null if unavailable. */
export function getGeminiKey(): string | null {
  if (cached !== undefined) return cached

  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  if (fromEnv) {
    cached = fromEnv
    return cached
  }

  try {
    const out = execFileSync('npx', ['convex', 'env', 'get', 'GEMINI_API_KEY'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
    })
    const key = out.trim().split('\n').pop()?.trim()
    cached = key && !key.startsWith('✖') ? key : null
  } catch {
    cached = null
  }
  return cached
}

export const LIVE = Boolean(getGeminiKey())
