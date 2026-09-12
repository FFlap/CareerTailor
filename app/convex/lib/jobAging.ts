type AgingJob = { status: string; appliedAt?: number; updatedAt: number }

export function appliedAtForStatus(
  existing: AgingJob | null,
  status: string,
  now: number,
): number | undefined {
  if (status !== 'applied') return existing?.appliedAt
  return existing?.status === 'applied'
    ? existing.appliedAt ?? existing.updatedAt
    : now
}

// Clamp month-end dates (January 31 -> February 28/29), retaining UTC time.
export function oneMonthAfter(timestamp: number): number {
  const date = new Date(timestamp)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.getTime()
}

export function needsUpdate(job: AgingJob, now: number): boolean {
  return job.status === 'applied' && oneMonthAfter(job.appliedAt ?? job.updatedAt) <= now
}
