const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Days are the reader's, not UTC's. Index space is shifted too, so
 * `index * DAY_MS` reads back as the local day through the UTC getters.
 */
export function dayIndexOf(timestamp: number, offsetMs: number) {
  return Math.floor((timestamp - offsetMs) / DAY_MS)
}

/** Longest run of consecutive active days. Expects ascending, unique indexes. */
export function bestRun(indexes: number[]) {
  let best = 0
  let run = 0
  let previous: number | null = null

  for (const index of indexes) {
    run = previous !== null && index === previous + 1 ? run + 1 : 1
    if (run > best) best = run
    previous = index
  }

  return best
}

/** Falls back to yesterday, so a streak breaks only after a full day is missed. */
export function currentRun(active: Set<number>, today: number) {
  let cursor = active.has(today) ? today : today - 1
  let run = 0

  while (active.has(cursor)) {
    run += 1
    cursor -= 1
  }

  return run
}
