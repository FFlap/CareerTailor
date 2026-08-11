/**
 * Renders a stored résumé as the labelled text a review reads. Every field that
 * exists must appear here: anything omitted reads to the model as a field the
 * candidate left blank, and it will say so.
 */

function dateRange(start: unknown, end: unknown) {
  const from = typeof start === 'string' ? start.trim() : ''
  const to = typeof end === 'string' ? end.trim() : ''
  if (!from && !to) return ''
  if (from && to) return `${from} to ${to}`
  return from || to
}

function joinMeta(values: Array<unknown>) {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' | ')
}

function bulletLines(bullets: unknown): string[] {
  if (!Array.isArray(bullets)) return []
  return bullets
    .map((bullet) => String(bullet).trim())
    .filter(Boolean)
    .map((bullet) => `- ${bullet}`)
}

export function resumeDataToText(data: any): string {
  if (!data || typeof data !== 'object') return ''
  const out: string[] = []

  const personal = data.personal ?? data.header ?? {}
  const contact = joinMeta([
    personal.fullName ?? personal.name,
    personal.email,
    personal.phone,
    personal.location,
  ])
  const links = Array.isArray(personal.links)
    ? personal.links
        .map((link: any) => joinMeta([link?.label, link?.url]))
        .filter(Boolean)
    : []
  if (contact || links.length) {
    out.push('## CONTACT')
    if (contact) out.push(contact)
    links.forEach((link: string) => out.push(link))
    out.push('')
  }

  if (typeof data.summary === 'string' && data.summary.trim()) {
    out.push('## SUMMARY', data.summary.trim(), '')
  }

  if (Array.isArray(data.experience) && data.experience.length) {
    out.push('## EXPERIENCE')
    data.experience.forEach((entry: any) => {
      out.push(
        joinMeta([
          entry.title,
          entry.company,
          entry.location,
          dateRange(entry.startDate, entry.endDate),
        ]),
      )
      out.push(...bulletLines(entry.bullets))
      out.push('')
    })
  }

  // Projects carry no dates in this product; the schema has no field for one.
  if (Array.isArray(data.projects) && data.projects.length) {
    out.push('## PROJECTS')
    data.projects.forEach((project: any) => {
      const technologies = Array.isArray(project.technologies)
        ? project.technologies.filter(Boolean).join(', ')
        : ''
      out.push(joinMeta([project.name, technologies, project.link]))
      out.push(...bulletLines(project.bullets))
      out.push('')
    })
  }

  if (Array.isArray(data.education) && data.education.length) {
    out.push('## EDUCATION')
    data.education.forEach((entry: any) => {
      out.push(
        joinMeta([
          entry.degree,
          entry.major,
          entry.institution,
          entry.location,
          dateRange(entry.startDate, entry.endDate),
        ]),
      )
      out.push(...bulletLines(entry.bullets))
      out.push('')
    })
  }

  if (Array.isArray(data.skills) && data.skills.length) {
    out.push('## SKILLS')
    data.skills.forEach((group: any) => {
      const items = Array.isArray(group.items)
        ? group.items.filter(Boolean).join(', ')
        : ''
      const line = [group.category, items].filter(Boolean).join(': ')
      if (line) out.push(line)
    })
    out.push('')
  }

  if (Array.isArray(data.customSections) && data.customSections.length) {
    data.customSections.forEach((section: any) => {
      out.push(`## ${String(section.title ?? 'SECTION').toUpperCase()}`)
      if (!Array.isArray(section.items)) return
      section.items.forEach((item: any) => {
        out.push(
          joinMeta([
            item.title,
            item.subtitle,
            item.location,
            dateRange(item.startDate, item.endDate),
          ]),
        )
        if (item.description) out.push(String(item.description).trim())
        out.push(...bulletLines(item.bullets))
      })
      out.push('')
    })
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
