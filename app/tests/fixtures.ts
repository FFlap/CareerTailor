export const PROFILE = {
  personal: {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+1 555 0110',
    location: 'London, UK',
    links: [
      { label: 'GitHub', url: 'https://github.com/adalovelace' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/adalovelace' },
    ],
  },
  summary:
    'Backend engineer with six years building high-throughput data services in Python and Go.',
  education: [
    {
      degree: 'BSc',
      major: 'Computer Science',
      institution: 'University of London',
      location: 'London, UK',
      startDate: 'Sep 2014',
      endDate: 'Jun 2018',
      bullets: ['First class honours'],
    },
  ],
  experience: [
    {
      title: 'Senior Backend Engineer',
      company: 'Northwind Data',
      location: 'London, UK',
      startDate: 'Mar 2021',
      endDate: 'Present',
      bullets: [
        'Rebuilt the ingestion pipeline in Go, cutting p99 latency from 1.8s to 240ms.',
        'Led a team of four engineers through a migration off a monolithic Postgres instance.',
        'Introduced contract testing that reduced production incidents by 35% year over year.',
      ],
    },
    {
      title: 'Backend Engineer',
      company: 'Cartography Labs',
      location: 'Bristol, UK',
      startDate: 'Jul 2018',
      endDate: 'Feb 2021',
      bullets: [
        'Built a geospatial tile service in Python serving 12M requests per day.',
        'Cut cloud spend by 22% by right-sizing worker pools and adding request coalescing.',
      ],
    },
  ],
  skills: [
    { category: 'Languages', items: ['Go', 'Python', 'TypeScript', 'SQL'] },
    { category: 'Infrastructure', items: ['Kubernetes', 'Terraform', 'AWS', 'Postgres'] },
    { category: 'Practices', items: ['Distributed systems', 'Observability', 'Mentoring'] },
  ],
  projects: [
    {
      name: 'Tessellate',
      technologies: ['Rust', 'WebAssembly'],
      link: 'https://github.com/adalovelace/tessellate',
      bullets: ['Open-source vector tile encoder used by three mapping startups.'],
    },
    {
      name: 'Quorum',
      technologies: ['Go', 'Raft'],
      link: 'https://github.com/adalovelace/quorum',
      bullets: ['Teaching implementation of the Raft consensus protocol.'],
    },
  ],
}

export const JOB = {
  url: 'https://jobs.example.com/postings/staff-platform-engineer',
  jobId: 'posting-4821',
  source: 'test',
  title: 'Staff Platform Engineer',
  company: 'Helios Robotics',
  description: [
    'Helios Robotics is hiring a Staff Platform Engineer to own our real-time telemetry platform.',
    '',
    'You will:',
    '- Design and operate low-latency streaming services handling millions of events per minute.',
    '- Lead reliability work across Kubernetes-based infrastructure.',
    '- Mentor engineers and set technical direction for the platform group.',
    '',
    'Requirements: strong Go or Rust, deep Kubernetes experience, distributed systems background,',
    'observability tooling (Prometheus, OpenTelemetry), and a track record of mentoring.',
  ].join('\n'),
}

export const WEAK_RESUME_TEXT = [
  'John Smith',
  'john.smith@example.com | 555-0100',
  '',
  'OBJECTIVE',
  'Looking for a job where I can use my skills and grow as a professional.',
  '',
  'EXPERIENCE',
  'Software Developer, Acme Corp (2020 - Present)',
  '- Responsible for various tasks related to software',
  '- Helped with the team on different projects',
  '- Assisted in fixing bugs',
  '',
  'Intern, Beta LLC (2019 - 2020)',
  '- Did some coding',
  '- Attended meetings',
  '',
  'SKILLS',
  'Java, hard worker, team player, Microsoft Word, communication',
  '',
  'EDUCATION',
  'State University, Computer Science',
].join('\n')

export const RESUME_TEXT_TO_PARSE = [
  'Ada Lovelace',
  'ada@example.com | +1 555 0110 | London, UK',
  'github.com/adalovelace | linkedin.com/in/adalovelace',
  '',
  'SUMMARY',
  'Backend engineer with six years building high-throughput data services.',
  '',
  'EXPERIENCE',
  'Senior Backend Engineer, Northwind Data, London, UK (Mar 2021 - Present)',
  '- Rebuilt the ingestion pipeline in Go, cutting p99 latency from 1.8s to 240ms.',
  '- Led a team of four engineers through a Postgres migration.',
  '',
  'Backend Engineer, Cartography Labs, Bristol, UK (Jul 2018 - Feb 2021)',
  '- Built a geospatial tile service in Python serving 12M requests per day.',
  '',
  'EDUCATION',
  'BSc Computer Science, University of London (Sep 2014 - Jun 2018)',
  '',
  'SKILLS',
  'Languages: Go, Python, TypeScript, SQL',
  'Infrastructure: Kubernetes, Terraform, AWS',
].join('\n')

export const COVER_LETTER_TEXT_TO_PARSE = [
  'Dear Hiring Manager,',
  '',
  'I am writing to apply for the Staff Platform Engineer role at Helios Robotics.',
  'My six years building low-latency data services map closely onto your telemetry platform.',
  '',
  'At Northwind Data I rebuilt an ingestion pipeline in Go and cut p99 latency from 1.8s to 240ms,',
  'while mentoring four engineers through the migration.',
  '',
  'Sincerely,',
  'Ada Lovelace',
].join('\n')

export const GENERATED_RESUME = {
  header: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+1 555 0110',
    location: 'London, UK',
    links: [
      { label: 'GitHub', url: 'https://github.com/adalovelace' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/adalovelace' },
    ],
  },
  summary: 'Backend engineer focused on low-latency streaming and platform reliability.',
  skills: PROFILE.skills,
  experience: PROFILE.experience,
  projects: PROFILE.projects,
  education: PROFILE.education,
}

export const GENERATED_COVER_LETTER = {
  greeting: 'Dear Hiring Manager,',
  body_paragraphs: [
    'I am applying for the Staff Platform Engineer role at Helios Robotics.',
    'At Northwind Data I rebuilt the ingestion pipeline in Go and cut p99 latency to 240ms.',
    'I would welcome the chance to bring that experience to your telemetry platform.',
  ],
  closing: 'Sincerely,',
  signature_name: 'Ada Lovelace',
}
