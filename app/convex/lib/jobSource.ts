/** Matched on hostname, so regional domains land in one bucket. */
const JOB_BOARDS: [RegExp, string][] = [
  [/(^|\.)linkedin\./, 'linkedin'],
  [/(^|\.)indeed\./, 'indeed'],
  [/(^|\.)glassdoor\./, 'glassdoor'],
  [/(^|\.)greenhouse\.io$/, 'greenhouse'],
  [/(^|\.)lever\.co$/, 'lever'],
  [/(^|\.)ashbyhq\.com$/, 'ashby'],
  [/(^|\.)myworkdayjobs\.com$/, 'workday'],
  [/(^|\.)smartrecruiters\./, 'smartrecruiters'],
  [/(^|\.)workable\./, 'workable'],
  [/(^|\.)ziprecruiter\./, 'ziprecruiter'],
  [/(^|\.)monster\./, 'monster'],
  [/(^|\.)dice\.com$/, 'dice'],
  [/(^|\.)wellfound\.com$/, 'wellfound'],
  [/(^|\.)angel\.co$/, 'wellfound'],
  [/(^|\.)simplyhired\./, 'simplyhired'],
  [/(^|\.)seek\./, 'seek'],
]

/**
 * `source` records how a job arrived, not where from, so the link wins and it
 * is only the fallback. Unknown hosts stay verbatim rather than becoming "other".
 */
export function jobSource(url: string, source: string) {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    host = ''
  }

  if (host) {
    for (const [pattern, name] of JOB_BOARDS) {
      if (pattern.test(host)) return name
    }
    return host
  }

  return source.trim().toLowerCase() || 'manual'
}
