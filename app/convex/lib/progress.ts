/**
 * Reads a half-written résumé JSON and says which section the model is on.
 * The model emits the schema keys in order, so the last key that has appeared
 * is the one currently being written.
 */

export const RESUME_STEPS = [
  'header',
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
] as const

export type ResumeStep = (typeof RESUME_STEPS)[number]

export const STEP_LABELS: Record<string, string> = {
  profile: 'Reading your profile',
  header: 'Writing your contact details',
  summary: 'Writing the summary',
  skills: 'Choosing which skills to lead with',
  experience: 'Writing your experience',
  projects: 'Writing your projects',
  education: 'Writing your education',
  fitting: 'Fitting it to the page',
  cover: 'Writing the cover letter',
  done: 'Done',
}

export function stepLabel(step: string | undefined | null): string {
  if (!step) return 'Starting'
  return STEP_LABELS[step] ?? 'Working'
}

const KEY_PATTERN = /"(header|summary|skills|experience|projects|education)"\s*:/g

/**
 * The furthest-along section present in the text so far, or null before the
 * model opens one. Ranked by position in the schema, not by where it appears in
 * the text: a nested "summary" inside a project must not walk the status back.
 */
export function detectResumeStep(partial: string): ResumeStep | null {
  if (!partial) return null

  let best: ResumeStep | null = null
  let bestRank = -1

  KEY_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = KEY_PATTERN.exec(partial)) !== null) {
    const key = match[1] as ResumeStep
    const rank = RESUME_STEPS.indexOf(key)
    if (rank > bestRank) {
      bestRank = rank
      best = key
    }
  }

  return best
}

/** Rough completion for the progress bar: how far through the schema we are. */
export function stepProgress(step: string | undefined | null): number {
  if (!step) return 0
  if (step === 'done') return 1
  if (step === 'profile') return 0.02
  const index = (RESUME_STEPS as readonly string[]).indexOf(step)
  if (index !== -1) {
    // The résumé write is the bulk of the wait, so it owns most of the bar.
    return 0.05 + ((index + 1) / RESUME_STEPS.length) * 0.75
  }
  if (step === 'fitting') return 0.85
  if (step === 'cover') return 0.92
  return 0.5
}
