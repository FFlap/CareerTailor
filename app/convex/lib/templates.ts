import { Infer, v } from 'convex/values'

export const resumeTemplateIdValidator = v.union(
  v.literal('basic_resume'),
  v.literal('simple_technical_resume'),
  v.literal('modern_cv'),
  v.literal('neat_cv'),
  v.literal('metronic'),
  v.literal('impressive_impression'),
)

export const coverTemplateIdValidator = v.union(
  v.literal('modern_cv_cover'),
  v.literal('modern_cv_cover_alt'),
  v.literal('neat_cv_letter'),
)

export type ResumeTemplateId = Infer<typeof resumeTemplateIdValidator>
export type CoverTemplateId = Infer<typeof coverTemplateIdValidator>

export const RESUME_TEMPLATES: Record<
  ResumeTemplateId,
  { id: ResumeTemplateId; label: string; entryPath: string; assets: string[] }
> = {
  basic_resume: {
    id: 'basic_resume',
    label: 'Basic Resume',
    entryPath: 'templates/basic-resume/main.typ',
    assets: [],
  },
  simple_technical_resume: {
    id: 'simple_technical_resume',
    label: 'Simple Technical Resume',
    entryPath: 'templates/simple-technical-resume/main.typ',
    assets: [],
  },
  modern_cv: {
    id: 'modern_cv',
    label: 'Modern CV',
    entryPath: 'templates/modern-cv/resume.typ',
    assets: ['templates/modern-cv/profile.png'],
  },
  neat_cv: {
    id: 'neat_cv',
    label: 'Neat CV',
    entryPath: 'templates/neat-cv/cv.typ',
    assets: [
      'templates/neat-cv/profile.png',
      'templates/neat-cv/publications.yml',
    ],
  },
  metronic: {
    id: 'metronic',
    label: 'Metronic Resume',
    entryPath: 'templates/metronic/main.typ',
    assets: [],
  },
  impressive_impression: {
    id: 'impressive_impression',
    label: 'Impressive Impression CV',
    entryPath: 'templates/impressive-impression/cv.typ',
    assets: [
      'templates/impressive-impression/utils.typ',
      'templates/impressive-impression/theme.typ',
      'templates/impressive-impression/assets/profile.png',
      'templates/impressive-impression/assets/signature.svg',
      'templates/impressive-impression/assets/flags/fr.svg',
      'templates/impressive-impression/assets/flags/gb.svg',
      'templates/impressive-impression/assets/flags/gr.svg',
    ],
  },
}

export const COVER_TEMPLATES: Record<
  CoverTemplateId,
  { id: CoverTemplateId; label: string; entryPath: string; assets: string[] }
> = {
  modern_cv_cover: {
    id: 'modern_cv_cover',
    label: 'Modern CV Cover',
    entryPath: 'templates/modern-cv/coverletter.typ',
    assets: ['templates/modern-cv/profile.png'],
  },
  modern_cv_cover_alt: {
    id: 'modern_cv_cover_alt',
    label: 'Modern CV Cover Alt',
    entryPath: 'templates/modern-cv/coverletter2.typ',
    assets: ['templates/modern-cv/profile.png'],
  },
  neat_cv_letter: {
    id: 'neat_cv_letter',
    label: 'Neat CV Letter',
    entryPath: 'templates/neat-cv/letter.typ',
    assets: ['templates/neat-cv/profile.png'],
  },
}

type TemplateLink = { label: string; url: string }

function escapeTypst(text: unknown) {
  if (text === null || text === undefined) return ''
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/#/g, '\\#')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/@/g, '\\@')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
}

function formatDateRange(start: string, end: string) {
  if (!start && !end) return ''
  if (start && !end) return `${start} - Present`
  if (!start && end) return end
  return `${start} - ${end}`
}

function joinNonEmpty(parts: Array<string | null | undefined>, separator = ' | ') {
  return parts.filter(Boolean).join(separator)
}

function typstString(value: unknown) {
  const safe = escapeTypst(value ?? '').replace(/"/g, '\\"')
  return `"${safe}"`
}

function typstOptionalString(value: unknown) {
  const trimmed = String(value ?? '').trim()
  return trimmed ? typstString(trimmed) : 'none'
}

function normalizeLinks(links: unknown) {
  if (!Array.isArray(links)) return []
  return links
    .map((link) => {
      if (!link) return null
      if (typeof link === 'string') {
        return { label: '', url: link.trim() }
      }
      const label = (link as any).label ? String((link as any).label).trim() : ''
      const url = (link as any).url ? String((link as any).url).trim() : ''
      return { label, url }
    })
    .filter((link): link is TemplateLink => Boolean(link && link.url))
}

function getHeader(resume: any = {}, profile: any = {}) {
  const header = resume.header || {}
  const personal = profile.personal || {}
  return {
    name: header.name || personal.fullName || '',
    email: header.email || personal.email || '',
    phone: header.phone || personal.phone || '',
    location: header.location || personal.location || '',
    links: header.links && header.links.length ? header.links : personal.links || [],
  }
}

function splitName(fullName: string) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first: '', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function linkMatches(link: TemplateLink, needle: string) {
  const target = String(needle || '').toLowerCase()
  if (!target) return false
  const haystack = `${link.label || ''} ${link.url || ''}`.toLowerCase()
  return haystack.includes(target)
}

function findLink(links: TemplateLink[], needle: string) {
  return links.find((link) => linkMatches(link, needle))?.url || ''
}

function firstNonSocialLink(links: TemplateLink[]) {
  const blocked = [
    'github.com',
    'linkedin.com',
    'twitter.com',
    'x.com',
    'gitlab.com',
    'bitbucket.org',
  ]
  const match = links.find((link) => {
    if (!link.url) return false
    const lower = link.url.toLowerCase()
    return !blocked.some((host) => lower.includes(host))
  })
  return match?.url || ''
}

function extractUsername(url: string, host: string) {
  if (!url) return ''
  const cleaned = String(url)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
  if (!cleaned.startsWith(host)) return ''
  const path = cleaned.slice(host.length).replace(/^\//, '')
  return path.split(/[/?#]/)[0] || ''
}

function formatBullets(bullets: unknown) {
  if (!Array.isArray(bullets)) return ''
  return bullets
    .map((bullet) => bullet && `- ${escapeTypst(bullet)}`)
    .filter(Boolean)
    .join('\n')
}

function normalizeSkillGroups(skills: unknown) {
  if (typeof skills === 'string') {
    return [
      {
        category: 'Skills',
        items: skills
          .split(/,|\n/)
          .map((item) => item.trim())
          .filter(Boolean),
      },
    ]
  }
  if (!Array.isArray(skills) || !skills.length) return []
  if (typeof skills[0] === 'string') {
    return [{ category: 'Skills', items: skills }]
  }
  return skills.map((group: any) => ({
    category: group.category || group.name || 'Skills',
    items: Array.isArray(group.items) ? group.items : [],
  }))
}

function typstTuple(items: Array<string | null | undefined> = []) {
  const safe = items.map((item) => (item ? typstString(item) : '')).filter(Boolean)
  if (!safe.length) return '()'
  if (safe.length === 1) return `(${safe[0]},)`
  return `(${safe.join(', ')})`
}

function typstExprTuple(items: string[] = []) {
  if (!items.length) return '()'
  if (items.length === 1) return `(${items[0]},)`
  return `(${items.join(', ')})`
}

function typstDict(entries: Record<string, string>) {
  const parts = Object.entries(entries)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}: ${value}`)
  if (!parts.length) return '()'
  return `(${parts.join(', ')})`
}

function formatDateRangeText(start: string, end: string) {
  return formatDateRange(start || '', end || '')
}

function parseDateParts(value: string) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate() || 1,
  }
}

function buildTypstDateExpr(value: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return '""'
  if (/present/i.test(trimmed)) return '"Present"'
  const parts = parseDateParts(trimmed)
  if (!parts) return typstString(trimmed)
  return `datetime(year: ${parts.year}, month: ${parts.month}, day: ${parts.day})`
}

function buildPositions(resume: any = {}) {
  return (resume.experience || [])
    .map((role: any) => role.title)
    .filter(Boolean)
    .slice(0, 3)
}

function buildKeywords(skills: any = []) {
  const flat = Array.isArray(skills)
    ? skills.flatMap((item: any) =>
        typeof item === 'string' ? [item] : item.items || [],
      )
    : []
  return flat.filter(Boolean).slice(0, 4)
}

function buildBasicResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile)
  const links = normalizeLinks(header.links)
  const github = findLink(links, 'github')
  const linkedin = findLink(links, 'linkedin')
  const website = firstNonSocialLink(links)
  const education = (resume.education || [])
    .map((item: any) => {
      const degree = joinNonEmpty([item.degree, item.major], ', ')
      const entry = [
        '#edu(',
        `  institution: ${typstString(item.institution || '')},`,
        `  location: ${typstString(item.location || item.country || '')},`,
        `  dates: dates-helper(start-date: ${typstString(item.start_date || item.startDate || '')}, end-date: ${typstString(item.end_date || item.endDate || '')}),`,
        `  degree: ${typstString(degree)}`,
        ')',
      ].join('\n')
      return entry
    })
    .join('\n\n')

  const experience = (resume.experience || [])
    .map((role: any) => {
      const bullets = formatBullets(role.bullets)
      return [
        '#work(',
        `  title: ${typstString(role.title || '')},`,
        `  location: ${typstString(role.location || '')},`,
        `  company: ${typstString(role.company || '')},`,
        `  dates: dates-helper(start-date: ${typstString(role.start_date || role.startDate || '')}, end-date: ${typstString(role.end_date || role.endDate || '')})`,
        ')',
        bullets,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const projects = (resume.projects || [])
    .map((project: any) => {
      const bullets = formatBullets(project.bullets)
      return [
        '#project(',
        `  name: ${typstString(project.name || '')},`,
        `  role: ${typstString(project.role || '')},`,
        `  dates: dates-helper(start-date: ${typstString(project.start_date || project.startDate || '')}, end-date: ${typstString(project.end_date || project.endDate || '')}),`,
        project.link ? `  url: ${typstString(project.link)},` : '',
        ')',
        bullets,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const skillGroups = normalizeSkillGroups(resume.skills)
  const skills = skillGroups
    .map((group: any) => {
      const items = Array.isArray(group.items)
        ? group.items.map((item: any) => escapeTypst(item)).join(', ')
        : ''
      return `- *${escapeTypst(group.category)}:* ${items}`.trim()
    })
    .filter(Boolean)
    .join('\n')

  return [
    '#import "@preview/basic-resume:0.2.9": *',
    '',
    `#let name = ${typstString(header.name)}`,
    `#let location = ${typstOptionalString(header.location)}`,
    `#let email = ${typstOptionalString(header.email)}`,
    `#let github = ${typstOptionalString(github)}`,
    `#let linkedin = ${typstOptionalString(linkedin)}`,
    `#let phone = ${typstOptionalString(header.phone)}`,
    `#let personal-site = ${typstOptionalString(website)}`,
    '',
    '#show: resume.with(',
    '  author: name,',
    '  location: location,',
    '  email: email,',
    '  github: github,',
    '  linkedin: linkedin,',
    '  phone: phone,',
    '  personal-site: personal-site,',
    '  accent-color: "#26428b"',
    ')',
    '',
    education ? '== Education' : '',
    education,
    '',
    experience ? '== Work Experience' : '',
    experience,
    '',
    projects ? '== Projects' : '',
    projects,
    '',
    skills ? '== Skills' : '',
    skills,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function buildSimpleTechnicalResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile)
  const links = normalizeLinks(header.links)
  const githubUser =
    extractUsername(findLink(links, 'github.com'), 'github.com') ||
    findLink(links, 'github')
  const linkedinUser =
    extractUsername(findLink(links, 'linkedin.com'), 'linkedin.com') ||
    findLink(links, 'linkedin')
  const website = firstNonSocialLink(links)

  const education = (resume.education || [])
    .map((item: any) => {
      return [
        '#education-heading(',
        `  ${typstString(item.institution || '')}, ${typstString(item.location || item.country || '')},`,
        `  ${typstString(item.degree || '')}, ${typstString(item.major || '')},`,
        `  ${buildTypstDateExpr(item.start_date || item.startDate)},`,
        `  ${buildTypstDateExpr(item.end_date || item.endDate)}`,
        ')[',
        formatBullets(item.bullets),
        ']',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const experience = (resume.experience || [])
    .map((role: any) => {
      return [
        '#work-heading(',
        `  ${typstString(role.title || '')},`,
        `  ${typstString(role.company || '')},`,
        `  ${typstString(role.location || '')},`,
        `  ${buildTypstDateExpr(role.start_date || role.startDate)},`,
        `  ${buildTypstDateExpr(role.end_date || role.endDate || 'Present')}`,
        ')[',
        formatBullets(role.bullets),
        ']',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const projects = (resume.projects || [])
    .map((project: any) => {
      return [
        '#project-heading(',
        `  ${typstString(project.name || '')}`,
        ')[',
        formatBullets(project.bullets),
        ']',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const skillGroups = normalizeSkillGroups(resume.skills)
  const skills = skillGroups
    .map((group: any) => {
      const items = Array.isArray(group.items)
        ? group.items.map((item: any) => escapeTypst(item)).join(', ')
        : ''
      return `- *${escapeTypst(group.category)}:* ${items}`.trim()
    })
    .filter(Boolean)
    .join('\n')

  return [
    '#import "@preview/simple-technical-resume:0.1.1": *',
    '',
    `#let name = ${typstString(header.name)}`,
    `#let phone = ${typstOptionalString(header.phone)}`,
    `#let email = ${typstOptionalString(header.email)}`,
    `#let github = ${typstOptionalString(githubUser)}`,
    `#let linkedin = ${typstOptionalString(linkedinUser)}`,
    `#let personal-site = ${typstOptionalString(website)}`,
    '',
    '#show: resume.with(',
    '  top-margin: 0.45in,',
    '  personal-info-font-size: 9.2pt,',
    '  author-position: center,',
    '  personal-info-position: center,',
    '  author-name: name,',
    '  phone: phone,',
    '  email: email,',
    '  website: personal-site,',
    '  linkedin-user-id: linkedin,',
    '  github-username: github',
    ')',
    '',
    education ? '#custom-title("Education")[' : '',
    education,
    education ? ']' : '',
    '',
    experience ? '#custom-title("Experience")[' : '',
    experience,
    experience ? ']' : '',
    '',
    projects ? '#custom-title("Projects")[' : '',
    projects,
    projects ? ']' : '',
    '',
    skills ? '#custom-title("Skills")[' : '',
    skills ? '#skills()[' : '',
    skills,
    skills ? ']' : '',
    skills ? ']' : '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function buildModernCvResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile)
  const links = normalizeLinks(header.links)
  const { first, last } = splitName(header.name)
  const githubUser = extractUsername(findLink(links, 'github.com'), 'github.com')
  const linkedinUser = extractUsername(
    findLink(links, 'linkedin.com'),
    'linkedin.com',
  )
  const website = firstNonSocialLink(links) || findLink(links, 'http')
  const positions = buildPositions(resume)
  const keywords = buildKeywords(resume.skills)

  const experience = (resume.experience || [])
    .map((role: any) => {
      return [
        '#resume-entry(',
        `  title: ${typstString(role.title || '')},`,
        `  location: ${typstString(role.location || '')},`,
        `  date: ${typstString(formatDateRangeText(role.start_date || role.startDate, role.end_date || role.endDate))},`,
        `  description: ${typstString(role.company || '')}`,
        ')',
        '#resume-item[',
        formatBullets(role.bullets),
        ']',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const projects = (resume.projects || [])
    .map((project: any) => {
      const projectLink = project.link ? `[${escapeTypst(project.link)}]` : ''
      return [
        '#resume-entry(',
        `  title: ${typstString(project.name || '')},`,
        `  location: ${projectLink || typstString('')},`,
        `  date: ${typstString(formatDateRangeText(project.start_date || project.startDate, project.end_date || project.endDate))},`,
        `  description: ${typstString(joinNonEmpty(project.technologies || [], ', '))}`,
        ')',
        '#resume-item[',
        formatBullets(project.bullets),
        ']',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const education = (resume.education || [])
    .map((item: any) => {
      const degree = joinNonEmpty([item.degree, item.major], ', ')
      return [
        '#resume-entry(',
        `  title: ${typstString(item.institution || '')},`,
        `  location: ${typstString(item.location || item.country || '')},`,
        `  date: ${typstString(formatDateRangeText(item.start_date || item.startDate, item.end_date || item.endDate))},`,
        `  description: ${typstString(degree)}`,
        ')',
      ].join('\n')
    })
    .join('\n\n')

  const skillGroups = normalizeSkillGroups(resume.skills)
  const skills = skillGroups
    .map(
      (group: any) =>
        `#resume-skill-item(${typstString(group.category)}, ${typstTuple(group.items || [])})`,
    )
    .join('\n')

  return [
    '#import "@preview/modern-cv:0.9.0": *',
    '',
    '#show: resume.with(',
    '  author: (',
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    header.email ? `    email: ${typstString(header.email)},` : '',
    website ? `    homepage: ${typstString(website)},` : '',
    header.phone ? `    phone: ${typstString(header.phone)},` : '',
    githubUser ? `    github: ${typstString(githubUser)},` : '',
    linkedinUser ? `    linkedin: ${typstString(linkedinUser)},` : '',
    header.location ? `    address: ${typstString(header.location)},` : '',
    `    positions: ${typstTuple(positions)}`,
    '  ),',
    `  keywords: ${typstTuple(keywords)},`,
    `  description: ${typstString(`${header.name || ''} resume`)},`,
    '  profile-picture: image("profile.png"),',
    '  date: datetime.today().display(),',
    '  language: "en",',
    '  font: "New Computer Modern",',
    '  header-font: "New Computer Modern"',
    ')',
    '',
    experience ? '= Professional Experience' : '',
    experience,
    '',
    projects ? '= Projects' : '',
    projects,
    '',
    skills ? '= Skills' : '',
    skills,
    '',
    education ? '= Education' : '',
    education,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function buildNeatCvResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile)
  const links = normalizeLinks(header.links)
  const { first, last } = splitName(header.name)
  const website = firstNonSocialLink(links) || findLink(links, 'http')
  const linkedinUser = extractUsername(
    findLink(links, 'linkedin.com'),
    'linkedin.com',
  )
  const githubUser = extractUsername(findLink(links, 'github.com'), 'github.com')
  const positions = buildPositions(resume)
  const experience = (resume.experience || [])
    .map((role: any) => {
      return [
        '#entry(',
        `  title: ${typstString(role.title || '')},`,
        `  date: ${typstString(formatDateRangeText(role.start_date || role.startDate, role.end_date || role.endDate))},`,
        `  institution: ${typstString(role.company || '')},`,
        `  location: ${typstString(role.location || '')}`,
        ')[',
        formatBullets(role.bullets),
        ']',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const education = (resume.education || [])
    .map((item: any) => {
      const degree = joinNonEmpty([item.degree, item.major], ', ')
      return [
        '#entry(',
        `  title: ${typstString(degree)},`,
        `  date: ${typstString(formatDateRangeText(item.start_date || item.startDate, item.end_date || item.endDate))},`,
        `  institution: ${typstString(item.institution || '')},`,
        `  location: ${typstString(item.location || item.country || '')}`,
        ')[',
        ']',
      ].join('\n')
    })
    .join('\n\n')

  const skillGroups = normalizeSkillGroups(resume.skills)
  const skills = skillGroups.length
    ? `#item-pills(${typstTuple(
        skillGroups.flatMap((group: any) => group.items || []),
      )})`
    : ''

  return [
    '#import "@preview/neat-cv:0.6.0": (',
    '  contact-info, cv, email-link, entry, item-pills, item-with-level,',
    '  publications, side, social-links',
    ')',
    '',
    '#set text(lang: "en")',
    '',
    '#show: cv.with(',
    '  author: (',
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    `    email: ${typstOptionalString(header.email)},`,
    `    address: [${escapeTypst(header.location)}],`,
    `    phone: ${typstOptionalString(header.phone)},`,
    `    position: ${typstTuple(positions)},`,
    `    website: ${typstOptionalString(website)},`,
    `    linkedin: ${typstOptionalString(linkedinUser)},`,
    `    github: ${typstOptionalString(githubUser)}`,
    '  ),',
    '  profile-picture: image("profile.png"),',
    '  accent-color: rgb("#4682b4"),',
    '  header-color: rgb("#35414d"),',
    '  heading-font: "New Computer Modern",',
    '  body-font: "New Computer Modern"',
    ')',
    '',
    '#side[',
    resume.summary ? '= About me' : '',
    resume.summary ? escapeTypst(resume.summary) : '',
    '= Contact',
    '#contact-info()',
    skills ? '= Skills' : '',
    skills,
    ']',
    '',
    experience ? '= Professional Experience' : '',
    experience,
    '',
    education ? '= Education' : '',
    education,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function buildMetronicResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile)
  const links = normalizeLinks(header.links)
  const website = firstNonSocialLink(links) || findLink(links, 'http')
  const linkedinUser = extractUsername(
    findLink(links, 'linkedin.com'),
    'linkedin.com',
  )
  const summary = resume.summary ? escapeTypst(resume.summary) : ''
  const education = (resume.education || [])
    .map((item: any) => {
      const degree = joinNonEmpty([item.degree, item.major], ', ')
      return `${escapeTypst(degree)}\\\n${escapeTypst(
        item.institution || '',
      )} (${escapeTypst(
        formatDateRangeText(item.start_date || item.startDate, item.end_date || item.endDate),
      )})`
    })
    .join('\n\n')

  const skills = normalizeSkillGroups(resume.skills)
    .flatMap((group: any) => group.items || [])
    .filter(Boolean)

  const experience = (resume.experience || [])
    .map((role: any) => {
      const headerLine = `${escapeTypst(role.title || '')}\\\n${escapeTypst(
        role.company || '',
      )} - ${escapeTypst(
        formatDateRangeText(role.start_date || role.startDate, role.end_date || role.endDate),
      )}`
      const bullets = formatBullets(role.bullets)
      const tags = skills.length
        ? `#tags(${typstTuple(skills.slice(0, 8))})`
        : ''
      return [`=== ${headerLine}`, bullets, tags].filter(Boolean).join('\n\n')
    })
    .join('\n\n')

  return [
    '#import "@preview/metronic:1.1.0": *',
    '',
    '#theme(',
    '  accent-color: rgb("61B7AE"),',
    '  background-color: rgb("F2F0EF")',
    ')',
    '',
    '#show: resume-page.with(',
    '  sidebar: [',
    `    = ${escapeTypst(header.name)}`,
    '',
    summary ? `    ${summary}` : '',
    '',
    '    #contact(',
    header.phone ? `      phone: ${typstString(header.phone)},` : '',
    linkedinUser ? `      linkedin: ${typstString(linkedinUser)},` : '',
    header.email ? `      email: ${typstString(header.email)},` : '',
    header.location ? `      location: ${typstString(header.location)},` : '',
    website ? `      website: ${typstString(website)}` : '',
    '    )',
    '',
    education ? '    #section(icon: "university", "Education")[' : '',
    education ? `      #small()[${education}]` : '',
    education ? '    ]' : '',
    '',
    skills.length ? '    #section(icon: "check-double", "Skills")[' : '',
    skills.length ? `      #tags(${typstTuple(skills)})` : '',
    skills.length ? '    ]' : '',
    '  ]',
    ')',
    '',
    experience ? '#section(icon: "briefcase", "Professional Experience")[' : '',
    experience,
    experience ? ']' : '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function buildImpressiveImpressionResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile)
  const links = normalizeLinks(header.links)
  const website = firstNonSocialLink(links) || findLink(links, 'http')
  const summary = resume.summary ? escapeTypst(resume.summary) : ''

  const experienceBlocks = (resume.experience || [])
    .map((role: any) => {
      const timeline = `([${escapeTypst(
        role.end_date || role.endDate || 'Present',
      )}], [${escapeTypst(role.start_date || role.startDate || '')}])`
      const supplement = role.company
        ? `supplement: [${escapeTypst(role.company)}],`
        : ''
      const bullets = formatBullets(role.bullets) || '-'
      return [
        '#make-main-content-block-with-timeline(',
        `  ${timeline},`,
        `  ${typstString(role.title || '')},`,
        supplement,
        '  [',
        `    ${bullets.replace(/\n/g, '\n    ')}`,
        '  ]',
        ')',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const educationBlocks = (resume.education || [])
    .map((item: any) => {
      const timeline = `([${escapeTypst(
        item.end_date || item.endDate || '',
      )}], [${escapeTypst(item.start_date || item.startDate || '')}])`
      const degree = joinNonEmpty([item.degree, item.major], ', ')
      return [
        '#make-main-content-block-with-timeline(',
        `  ${timeline},`,
        `  ${typstString(degree)},`,
        item.institution ? `  supplement: [${escapeTypst(item.institution)}],` : '',
        '  [',
        `    ${escapeTypst(item.location || item.country || '')}`,
        '  ]',
        ')',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const projectBlocks = (resume.projects || [])
    .map((project: any) => {
      const timeline = `([${escapeTypst(
        project.end_date || project.endDate || '',
      )}], [${escapeTypst(project.start_date || project.startDate || '')}])`
      const supplement = project.link
        ? `supplement: [${escapeTypst(project.link)}],`
        : ''
      const bullets = formatBullets(project.bullets) || '-'
      return [
        '#make-main-content-block-with-timeline(',
        `  ${timeline},`,
        `  ${typstString(project.name || '')},`,
        supplement,
        '  [',
        `    ${bullets.replace(/\n/g, '\n    ')}`,
        '  ]',
        ')',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const skillItems = normalizeSkillGroups(resume.skills)
    .flatMap((group: any) => group.items || [])
    .filter(Boolean)
    .slice(0, 12)
    .map((skill: any) => `#make-pill(${typstString(skill)})`)
    .join('\n  ')

  const contactEntries = [
    header.location
      ? `iconer-stack("map-marker-alt"), [${escapeTypst(header.location)}]`
      : '',
    header.phone ? `iconer-stack("phone"), [${escapeTypst(header.phone)}]` : '',
    header.email ? `iconer-stack("at"), [${escapeTypst(header.email)}]` : '',
    website ? `iconer-stack("globe"), [${escapeTypst(website)}]` : '',
  ].filter(Boolean)

  return [
    '#import "@preview/impressive-impression:0.1.0": (',
    '  cv,',
    '  crop-image,',
    '  colorize-svg-string,',
    '  dot-ratings,',
    '  make-pill,',
    '  make-aside-persona,',
    '  make-aside-grid,',
    '  make-main-content-block,',
    '  make-main-content-block-with-timeline,',
    '  theme-helper,',
    ')',
    '',
    '#import "utils.typ": flag, fa-icon-factory, fa-icon-factory-stack',
    '#import "theme.typ": theme',
    '',
    '#import "@preview/fontawesome:0.5.0": fa-icon, fa-stack',
    '#import "@preview/nth:1.0.1": nth',
    '',
    `#let name = ${typstString(header.name)}`,
    '#let pronouns = ""',
    '#let profile-image = image("assets/profile.png")',
    `#let short-description = [${summary || escapeTypst('Dedicated professional resume')}]`,
    '',
    '#let th = theme-helper(theme)',
    '',
    '#let iconer-stack = fa-icon-factory-stack(theme)',
    '#let iconer = fa-icon-factory(theme)',
    '#let dot-ratings = dot-ratings.with(',
    '  size: 6.5pt,',
    '  spacing: 3.5pt,',
    '  color-active: th("primary-accent-color"),',
    '  color-inactive: th("faint-text-color").transparentize(65%),',
    ')',
    '',
    '#let make-main-content-block = make-main-content-block.with(theme: theme)',
    '#let make-main-content-block-with-timeline = make-main-content-block-with-timeline.with(theme: theme)',
    '',
    '#let main-content-1 = [',
    summary ? '  == Introduction' : '',
    summary ? `  #block([${summary}])` : '',
    experienceBlocks ? '  == Experience' : '',
    experienceBlocks,
    projectBlocks ? '  == Projects' : '',
    projectBlocks,
    educationBlocks ? '  == Education' : '',
    educationBlocks,
    ']',
    '',
    '#let aside-content-1 = [',
    '  #make-aside-persona(',
    '    name,',
    '    pronouns: pronouns,',
    '    short-description: short-description,',
    '    image: profile-image,',
    '    theme: theme,',
    '  )',
    contactEntries.length ? '  #make-aside-grid(' : '',
    contactEntries.length ? '    theme: theme,' : '',
    contactEntries.length ? `    ${contactEntries.join(',\n    ')}` : '',
    contactEntries.length ? '  )' : '',
    skillItems ? '  == Skills' : '',
    skillItems ? `  ${skillItems}` : '',
    ']',
    '',
    '#cv(',
    '  theme: theme,',
    '  paper: "us-letter",',
    '  pages-content: (',
    '    ("left": aside-content-1, "main": main-content-1)',
    '  )',
    ')',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function buildModernCvCoverSource(cover: any, profile: any, job: any, templateId: string) {
  const header = getHeader({ header: { name: cover.signature_name || '' } }, profile)
  const links = normalizeLinks(header.links)
  const { first, last } = splitName(header.name || cover.signature_name || '')
  const githubUser = extractUsername(findLink(links, 'github.com'), 'github.com')
  const linkedinUser = extractUsername(
    findLink(links, 'linkedin.com'),
    'linkedin.com',
  )
  const website = firstNonSocialLink(links) || findLink(links, 'http')
  const positionList = buildPositions({ experience: profile.experience || [] })
  const bodyParagraphs = Array.isArray(cover.body_paragraphs) ? cover.body_paragraphs : []

  const bodyBlocks = bodyParagraphs
    .map((paragraph: any) => ['#coverletter-content[', escapeTypst(paragraph), ']'].join('\n'))
    .join('\n\n')
  const closingLine = escapeTypst(cover.closing || 'Sincerely,')
  const signatureLine = escapeTypst(cover.signature_name || header.name)
  const closingBlock = ['#coverletter-content[', closingLine, '', signatureLine, ']'].join('\n')
  const addressee =
    String(cover.greeting || 'Hiring Manager')
      .replace(/^\s*dear\s+/i, '')
      .replace(/[,\s]+$/g, '') || 'Hiring Manager'

  return [
    '#import "@preview/modern-cv:0.9.0": *',
    '',
    '#show: coverletter.with(',
    '  author: (',
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    header.email ? `    email: ${typstString(header.email)},` : '',
    website ? `    homepage: ${typstString(website)},` : '',
    header.phone ? `    phone: ${typstString(header.phone)},` : '',
    githubUser ? `    github: ${typstString(githubUser)},` : '',
    linkedinUser ? `    linkedin: ${typstString(linkedinUser)},` : '',
    header.location ? `    address: ${typstString(header.location)},` : '',
    `    positions: ${typstTuple(positionList)}`,
    '  ),',
    templateId === 'modern_cv_cover_alt'
      ? '  profile-picture: none,'
      : '  profile-picture: image("profile.png"),',
    '  language: "en",',
    '  show-footer: false,',
    '  font: "New Computer Modern",',
    '  header-font: "New Computer Modern"',
    ')',
    '',
    '#hiring-entity-info(',
    '  entity-info: (',
    `    target: ${typstString('Hiring Manager')},`,
    `    name: ${typstString(job?.company || '')},`,
    `    street-address: ${typstString(' ')},`,
    `    city: ${typstString(' ')}`,
    '  ),',
    ')',
    '',
    `#letter-heading(job-position: ${typstString(job?.title || '')}, addressee: ${typstString(addressee)})`,
    '',
    bodyBlocks,
    '',
    closingBlock,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildNeatCvCoverSource(cover: any, profile: any, job: any) {
  const header = getHeader({ header: { name: cover.signature_name || '' } }, profile)
  const { first, last } = splitName(header.name || cover.signature_name || '')
  const bodyParagraphs = Array.isArray(cover.body_paragraphs) ? cover.body_paragraphs : []
  const body = bodyParagraphs.map((p: any) => escapeTypst(p)).join('\n\n')

  const recipientLines = [job?.company || '', job?.title ? `Role: ${job.title}` : '', header.location || '']
    .filter(Boolean)
    .map((line) => escapeTypst(line))
    .join('\\\n')

  return [
    '#import "@preview/neat-cv:0.6.0": letter',
    '',
    '#set text(lang: "en")',
    '',
    '#show: letter.with(',
    '  author: (',
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    `    email: ${typstOptionalString(header.email)},`,
    `    address: [${escapeTypst(header.location)}],`,
    `    phone: ${typstOptionalString(header.phone)},`,
    `    position: ${typstTuple(buildPositions({ experience: profile.experience || [] }))}`,
    '  ),',
    '  profile-picture: image("profile.png"),',
    '  accent-color: rgb("#4682b4"),',
    '  header-text-color: rgb("#3b4f60"),',
    '  heading-font: "New Computer Modern",',
    '  body-font: "New Computer Modern",',
    recipientLines ? `  recipient: [${recipientLines}],` : '',
    ')',
    '',
    cover.greeting ? `${escapeTypst(cover.greeting)}` : 'Dear Hiring Manager,',
    '',
    body,
    '',
    cover.closing ? escapeTypst(cover.closing) : 'Sincerely,',
    '',
    `#align(right)[ ${escapeTypst(cover.signature_name || header.name || '')} ]`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildResumeTypstSource({
  templateId,
  resume,
  profile,
}: {
  templateId: ResumeTemplateId
  resume: any
  profile: any
}) {
  const safeResume = resume || {}
  const safeProfile = profile || {}
  switch (templateId) {
    case 'basic_resume':
      return buildBasicResumeSource(safeResume, safeProfile)
    case 'simple_technical_resume':
      return buildSimpleTechnicalResumeSource(safeResume, safeProfile)
    case 'modern_cv':
      return buildModernCvResumeSource(safeResume, safeProfile)
    case 'neat_cv':
      return buildNeatCvResumeSource(safeResume, safeProfile)
    case 'metronic':
      return buildMetronicResumeSource(safeResume, safeProfile)
    case 'impressive_impression':
      return buildImpressiveImpressionResumeSource(safeResume, safeProfile)
    default:
      ;(templateId satisfies never)
      throw new Error('Template not implemented.')
  }
}

export function buildCoverLetterTypstSource({
  templateId,
  coverLetter,
  profile,
  job,
}: {
  templateId: CoverTemplateId
  coverLetter: any
  profile: any
  job: any
}) {
  const safeCover = coverLetter || {}
  const safeProfile = profile || {}
  if (templateId === 'modern_cv_cover' || templateId === 'modern_cv_cover_alt') {
    return buildModernCvCoverSource(safeCover, safeProfile, job, templateId)
  }
  if (templateId === 'neat_cv_letter') {
    return buildNeatCvCoverSource(safeCover, safeProfile, job)
  }
  ;(templateId satisfies never)
  throw new Error('Template not implemented.')
}

function buildResumeDataPreamble(resume: any, profile: any) {
  const safeResume = resume || {}
  const safeProfile = profile || {}
  const header = getHeader(safeResume, safeProfile)
  const links = normalizeLinks(header.links)
  const linkTuple = typstExprTuple(
    links.map((link) =>
      typstDict({
        label: typstString(link.label || ''),
        url: typstString(link.url || ''),
      }),
    ),
  )

  const skills = normalizeSkillGroups(safeResume.skills ?? safeProfile.skills)
  const skillsTuple = typstExprTuple(
    skills.map((group) =>
      typstDict({
        category: typstString(group.category || ''),
        items: typstTuple(group.items || []),
      }),
    ),
  )

  const experience = Array.isArray(safeResume.experience)
    ? safeResume.experience
    : Array.isArray(safeProfile.experience)
      ? safeProfile.experience
      : []
  const experienceTuple = typstExprTuple(
    experience.map((item: any) =>
      typstDict({
        title: typstString(item?.title || ''),
        company: typstString(item?.company || ''),
        location: typstString(item?.location || ''),
        start: typstString(item?.startDate || ''),
        end: typstString(item?.endDate || ''),
        bullets: typstTuple(item?.bullets || []),
      }),
    ),
  )

  const projects = Array.isArray(safeResume.projects)
    ? safeResume.projects
    : Array.isArray(safeProfile.projects)
      ? safeProfile.projects
      : []
  const projectsTuple = typstExprTuple(
    projects.map((project: any) =>
      typstDict({
        name: typstString(project?.name || ''),
        technologies: typstTuple(project?.technologies || []),
        link: typstString(project?.link || ''),
        bullets: typstTuple(project?.bullets || []),
      }),
    ),
  )

  const education = Array.isArray(safeResume.education)
    ? safeResume.education
    : Array.isArray(safeProfile.education)
      ? safeProfile.education
      : []
  const educationTuple = typstExprTuple(
    education.map((item: any) =>
      typstDict({
        degree: typstString(item?.degree || ''),
        major: typstString(item?.major || ''),
        institution: typstString(item?.institution || ''),
        location: typstString(item?.location || ''),
        start: typstString(item?.startDate || ''),
        end: typstString(item?.endDate || ''),
      }),
    ),
  )

  const summary = safeResume.summary || safeProfile.summary || ''

  const headerDict = typstDict({
    name: typstString(header.name || ''),
    email: typstString(header.email || ''),
    phone: typstString(header.phone || ''),
    location: typstString(header.location || ''),
    links: linkTuple,
  })

  return [
    '#let resume = (',
    `  header: ${headerDict},`,
    `  summary: ${typstString(summary)},`,
    `  skills: ${skillsTuple},`,
    `  experience: ${experienceTuple},`,
    `  projects: ${projectsTuple},`,
    `  education: ${educationTuple},`,
    ')',
    '',
  ].join('\n')
}

function buildCoverLetterDataPreamble(coverLetter: any, profile: any, job: any) {
  const safeCover = coverLetter || {}
  const header = getHeader({}, profile || {})
  const links = normalizeLinks(header.links)
  const linkTuple = typstExprTuple(
    links.map((link) =>
      typstDict({
        label: typstString(link.label || ''),
        url: typstString(link.url || ''),
      }),
    ),
  )

  const senderDict = typstDict({
    name: typstString(header.name || ''),
    email: typstString(header.email || ''),
    phone: typstString(header.phone || ''),
    location: typstString(header.location || ''),
    links: linkTuple,
  })

  const coverDict = typstDict({
    greeting: typstString(safeCover.greeting || 'Dear Hiring Manager,'),
    body_paragraphs: typstTuple(
      Array.isArray(safeCover.body_paragraphs) ? safeCover.body_paragraphs : [],
    ),
    closing: typstString(safeCover.closing || 'Sincerely,'),
    signature_name: typstString(safeCover.signature_name || header.name || ''),
    recipient_name: typstString(safeCover.recipient_name || ''),
    recipient_title: typstString(safeCover.recipient_title || ''),
    company_name: typstString(job?.company || ''),
    job_title: typstString(job?.title || ''),
  })

  return [
    `#let sender = ${senderDict}`,
    `#let cover_letter = ${coverDict}`,
    '',
  ].join('\n')
}

export function buildCustomResumeTypstSource({
  templateSource,
  resume,
  profile,
}: {
  templateSource: string
  resume: any
  profile: any
}) {
  const preamble = buildResumeDataPreamble(resume, profile)
  return `${preamble}\\n${templateSource}`.trim()
}

export function buildCustomCoverLetterTypstSource({
  templateSource,
  coverLetter,
  profile,
  job,
}: {
  templateSource: string
  coverLetter: any
  profile: any
  job: any
}) {
  const preamble = buildCoverLetterDataPreamble(coverLetter, profile, job)
  return `${preamble}\\n${templateSource}`.trim()
}
