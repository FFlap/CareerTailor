export const CUSTOM_TEMPLATE_PREFIX = 'custom:'

export function makeCustomTemplateId(id: string) {
  return `${CUSTOM_TEMPLATE_PREFIX}${id}`
}

export function isCustomTemplateId(id?: string | null): id is `custom:${string}` {
  return Boolean(id && id.startsWith(CUSTOM_TEMPLATE_PREFIX))
}

export function extractCustomTemplateId(id: string) {
  return id.startsWith(CUSTOM_TEMPLATE_PREFIX) ? id.slice(CUSTOM_TEMPLATE_PREFIX.length) : id
}

const SAMPLE_RESUME_PREAMBLE = `#let resume = (
  header: (
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    links: (
      (label: "LinkedIn", url: "https://linkedin.com/in/alex"),
      (label: "Portfolio", url: "https://alex.design"),
    ),
  ),
  summary: "Product designer with 6+ years of experience building user-first experiences.",
  skills: (
    (category: "Design", items: ("Figma", "Design Systems", "UX Research")),
    (category: "Product", items: ("Prototyping", "Usability Testing", "Strategy")),
  ),
  experience: (
    (
      title: "Senior Product Designer",
      company: "Northwind",
      location: "Remote",
      start: "2021",
      end: "Present",
      bullets: (
        "Led a redesign that improved activation by 18%.",
        "Built a component system used across 12 teams.",
      ),
    ),
    (
      title: "Product Designer",
      company: "Acme Co",
      location: "New York, NY",
      start: "2018",
      end: "2021",
      bullets: (
        "Collaborated with PMs and engineers to ship 20+ features.",
      ),
    ),
  ),
  projects: (
    (
      name: "Atlas",
      technologies: ("Figma", "Notion"),
      link: "https://atlas.example.com",
      bullets: ("Designed a multi-tenant dashboard for analytics."),
    ),
  ),
  education: (
    (
      degree: "B.S.",
      major: "Human-Computer Interaction",
      institution: "State University",
      location: "San Jose, CA",
      start: "2014",
      end: "2018",
    ),
  ),
)
`

const SAMPLE_COVER_PREAMBLE = `#let sender = (
  name: "Alex Rivera",
  email: "alex.rivera@example.com",
  phone: "(555) 123-4567",
  location: "San Francisco, CA",
  links: (
    (label: "LinkedIn", url: "https://linkedin.com/in/alex"),
  ),
)

#let cover_letter = (
  greeting: "Dear Hiring Manager,",
  body_paragraphs: (
    "I am excited to apply for the Senior Product Designer role at Northwind.",
    "My background blends user research with scalable design systems.",
  ),
  closing: "Sincerely,",
  signature_name: "Alex Rivera",
  recipient_name: "Hiring Manager",
  recipient_title: "Design Lead",
  company_name: "Northwind",
  job_title: "Senior Product Designer",
)
`

export function withSampleData(type: 'resume' | 'cover_letter', source: string) {
  const preamble = type === 'resume' ? SAMPLE_RESUME_PREAMBLE : SAMPLE_COVER_PREAMBLE
  return `${preamble}\n${source}`.trim()
}
