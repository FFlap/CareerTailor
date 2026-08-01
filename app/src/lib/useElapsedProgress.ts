import { useEffect, useRef, useState } from 'react'

/** Elapsed seconds + staged labels (schedule-based, not real progress). */
export type GenerationStage = { label: string; afterSeconds: number }

export const RESUME_STAGES: GenerationStage[] = [
  { label: 'Reading the job description…', afterSeconds: 0 },
  { label: 'Matching your experience to the role…', afterSeconds: 8 },
  { label: 'Writing and tailoring your bullets…', afterSeconds: 20 },
  { label: 'Laying out the document…', afterSeconds: 45 },
  { label: 'Almost there — finishing up…', afterSeconds: 75 },
]

export function useElapsedProgress(active: boolean, stages = RESUME_STAGES) {
  const [seconds, setSeconds] = useState(0)
  const startedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      startedAt.current = null
      setSeconds(0)
      return
    }
    startedAt.current = Date.now()
    setSeconds(0)
    const timer = setInterval(() => {
      if (startedAt.current === null) return
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [active])

  const stage = [...stages].reverse().find((s) => seconds >= s.afterSeconds) ?? stages[0]

  return { seconds, label: stage.label, elapsedLabel: formatElapsed(seconds) }
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
}
