export const PROFILE = {
  personal: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+1 555 0110",
    location: "London, UK",
    links: [
      { label: "GitHub", url: "https://github.com/adalovelace" },
      { label: "LinkedIn", url: "https://linkedin.com/in/adalovelace" },
    ],
  },
  summary:
    "Backend engineer with six years building high-throughput data services in Python and Go.",
  education: [
    {
      degree: "BSc",
      major: "Computer Science",
      institution: "University of London",
      location: "London, UK",
      startDate: "Sep 2014",
      endDate: "Jun 2018",
      bullets: ["First class honours"],
    },
  ],
  experience: [
    {
      title: "Senior Backend Engineer",
      company: "Northwind Data",
      location: "London, UK",
      startDate: "Mar 2021",
      endDate: "Present",
      bullets: [
        "Rebuilt the ingestion pipeline in Go, cutting p99 latency from 1.8s to 240ms.",
        "Led a team of four engineers through a migration off a monolithic Postgres instance.",
        "Introduced contract testing that reduced production incidents by 35% year over year.",
      ],
    },
    {
      title: "Backend Engineer",
      company: "Cartography Labs",
      location: "Bristol, UK",
      startDate: "Jul 2018",
      endDate: "Feb 2021",
      bullets: [
        "Built a geospatial tile service in Python serving 12M requests per day.",
        "Cut cloud spend by 22% by right-sizing worker pools and adding request coalescing.",
      ],
    },
  ],
  skills: [
    { category: "Languages", items: ["Go", "Python", "TypeScript", "SQL"] },
    {
      category: "Infrastructure",
      items: ["Kubernetes", "Terraform", "AWS", "Postgres"],
    },
    {
      category: "Practices",
      items: ["Distributed systems", "Observability", "Mentoring"],
    },
  ],
  projects: [
    {
      name: "Tessellate",
      technologies: ["Rust", "WebAssembly"],
      link: "https://github.com/adalovelace/tessellate",
      bullets: [
        "Open-source vector tile encoder used by three mapping startups.",
      ],
    },
    {
      name: "Quorum",
      technologies: ["Go", "Raft"],
      link: "https://github.com/adalovelace/quorum",
      bullets: ["Teaching implementation of the Raft consensus protocol."],
    },
  ],
};

export const JOB = {
  url: "https://jobs.example.com/postings/staff-platform-engineer",
  jobId: "posting-4821",
  source: "test",
  title: "Staff Platform Engineer",
  company: "Helios Robotics",
  description: [
    "Helios Robotics is hiring a Staff Platform Engineer to own our real-time telemetry platform.",
    "",
    "You will:",
    "- Design and operate low-latency streaming services handling millions of events per minute.",
    "- Lead reliability work across Kubernetes-based infrastructure.",
    "- Mentor engineers and set technical direction for the platform group.",
    "",
    "Requirements: strong Go or Rust, deep Kubernetes experience, distributed systems background,",
    "observability tooling (Prometheus, OpenTelemetry), and a track record of mentoring.",
  ].join("\n"),
};

export const WEAK_RESUME_TEXT = [
  "John Smith",
  "john.smith@example.com | 555-0100",
  "",
  "OBJECTIVE",
  "Looking for a job where I can use my skills and grow as a professional.",
  "",
  "EXPERIENCE",
  "Software Developer, Acme Corp (2020 - Present)",
  "- Responsible for various tasks related to software",
  "- Helped with the team on different projects",
  "- Assisted in fixing bugs",
  "",
  "Intern, Beta LLC (2019 - 2020)",
  "- Did some coding",
  "- Attended meetings",
  "",
  "SKILLS",
  "Java, hard worker, team player, Microsoft Word, communication",
  "",
  "EDUCATION",
  "State University, Computer Science",
].join("\n");

export const RESUME_TEXT_TO_PARSE = [
  "Ada Lovelace",
  "ada@example.com | +1 555 0110 | London, UK",
  "github.com/adalovelace | linkedin.com/in/adalovelace",
  "",
  "SUMMARY",
  "Backend engineer with six years building high-throughput data services.",
  "",
  "EXPERIENCE",
  "Senior Backend Engineer, Northwind Data, London, UK (Mar 2021 - Present)",
  "- Rebuilt the ingestion pipeline in Go, cutting p99 latency from 1.8s to 240ms.",
  "- Led a team of four engineers through a Postgres migration.",
  "",
  "Backend Engineer, Cartography Labs, Bristol, UK (Jul 2018 - Feb 2021)",
  "- Built a geospatial tile service in Python serving 12M requests per day.",
  "",
  "EDUCATION",
  "BSc Computer Science, University of London (Sep 2014 - Jun 2018)",
  "",
  "SKILLS",
  "Languages: Go, Python, TypeScript, SQL",
  "Infrastructure: Kubernetes, Terraform, AWS",
].join("\n");

export const COVER_LETTER_TEXT_TO_PARSE = [
  "Dear Hiring Manager,",
  "",
  "I am writing to apply for the Staff Platform Engineer role at Helios Robotics.",
  "My six years building low-latency data services map closely onto your telemetry platform.",
  "",
  "At Northwind Data I rebuilt an ingestion pipeline in Go and cut p99 latency from 1.8s to 240ms,",
  "while mentoring four engineers through the migration.",
  "",
  "Sincerely,",
  "Ada Lovelace",
].join("\n");

export const GENERATED_RESUME = {
  header: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+1 555 0110",
    location: "London, UK",
    links: [
      { label: "GitHub", url: "https://github.com/adalovelace" },
      { label: "LinkedIn", url: "https://linkedin.com/in/adalovelace" },
    ],
  },
  summary:
    "Backend engineer focused on low-latency streaming and platform reliability.",
  skills: PROFILE.skills,
  experience: PROFILE.experience,
  projects: PROFILE.projects,
  education: PROFILE.education,
};

export const SPARSE_PROFILE = {
  personal: {
    fullName: "Jordan Reyes",
    email: "jordan@example.com",
    phone: "",
    location: "",
    links: [],
  },
  summary: "",
  education: [],
  experience: [
    {
      title: "Support Associate",
      company: "Helpdesk Co",
      location: "",
      startDate: "",
      endDate: "",
      bullets: ["Answered 40+ tickets a day."],
    },
  ],
  skills: [{ category: "Skills", items: ["Excel"] }],
  projects: [],
};

export const SPARSE_RESUME = {
  header: {
    name: SPARSE_PROFILE.personal.fullName,
    email: SPARSE_PROFILE.personal.email,
    phone: "",
    location: "",
    links: [],
  },
  summary: "",
  skills: SPARSE_PROFILE.skills,
  experience: SPARSE_PROFILE.experience,
  projects: [],
  education: [],
};

export const BARE_PROFILE = {
  personal: {
    fullName: "Sam Doe",
    email: "",
    phone: "",
    location: "",
    links: [],
  },
  summary: "",
  education: [],
  experience: [],
  skills: [],
  projects: [],
};

export const BARE_RESUME = {
  header: { name: "Sam Doe", email: "", phone: "", location: "", links: [] },
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
};

const HOSTILE_TEXT =
  'Cut cost 50% #panic("pwned") $x^2$ [bracket] *bold* _under_ <label> @ref ~nbsp a--b "quoted" it\'s back\\slash 数字 — ok';

export const HOSTILE_PROFILE = {
  personal: {
    fullName: "Ada #panic() <Lovelace>",
    email: "ada+resume_test@example.com",
    phone: "+1 (555) 011-0110 x#42",
    location: "London~UK [remote]",
    links: [
      { label: "GitHub #1", url: "https://github.com/ada_love/my--repo" },
      { label: "Site", url: "https://ada~love.dev/my_page?q=a&b=c#frag" },
      { label: "", url: "notaurl" },
    ],
  },
  summary: HOSTILE_TEXT,
  education: [
    {
      degree: "B.S. #1",
      major: 'C_S & "Math"',
      institution: "Uni*versity <of> London",
      location: "London~UK",
      startDate: "Sep 2014",
      endDate: "Jun 2018",
      bullets: [HOSTILE_TEXT],
    },
  ],
  experience: [
    {
      title: "Engineer_II <Backend>",
      company: "North*wind #Data",
      location: "London~UK",
      startDate: "Mar 2021",
      endDate: "Present",
      bullets: [HOSTILE_TEXT, "Reduced p99 by 85% (1.8s -> 240ms)."],
    },
  ],
  skills: [
    { category: "Lang_uages #1", items: ["C++", "C#", "F*", "Go~lang"] },
  ],
  projects: [
    {
      name: "Tess*ellate #2",
      technologies: ["Rust", "Web_Assembly"],
      link: "https://github.com/ada_love/my--repo",
      bullets: [HOSTILE_TEXT],
    },
  ],
};

export const HOSTILE_RESUME = {
  header: {
    name: HOSTILE_PROFILE.personal.fullName,
    email: HOSTILE_PROFILE.personal.email,
    phone: HOSTILE_PROFILE.personal.phone,
    location: HOSTILE_PROFILE.personal.location,
    links: HOSTILE_PROFILE.personal.links,
  },
  summary: HOSTILE_TEXT,
  skills: HOSTILE_PROFILE.skills,
  experience: HOSTILE_PROFILE.experience,
  projects: HOSTILE_PROFILE.projects,
  education: HOSTILE_PROFILE.education,
};

export const MODEL_SHAPED_RESUME = {
  header: {
    name: "Sam Rivera",
    email: "sam@example.com",
    links: ["github.com/samrivera", "linkedin.com/in/samrivera"],
  },
  summary: "Data engineer.",
  skills: "Python, SQL, Airflow",
  experience: [
    {
      title: "Data Engineer",
      company: "Metrics Inc",
      start_date: "Jan 2020",
      end_date: "Dec 2023",
      bullets: ["Built pipelines."],
    },
    { title: "Analyst", company: "Numbers Ltd", start_date: "2018" },
  ],
  projects: [{ name: "Warehouse", link: "example.com/warehouse" }],
  education: [
    {
      degree: "BSc",
      major: "Statistics",
      institution: "State University",
      country: "USA",
      start_date: "Sep 2014",
      end_date: "Jun 2018",
    },
  ],
};

export const LONG_RESUME = {
  header: GENERATED_RESUME.header,
  summary: "Platform engineer. ".repeat(20),
  skills: Array.from({ length: 6 }, (_, groupIndex) => ({
    category: `Skill group ${groupIndex + 1}`,
    items: Array.from(
      { length: 12 },
      (_, i) => `Skill ${groupIndex + 1}.${i + 1}`,
    ),
  })),
  experience: Array.from({ length: 8 }, (_, i) => ({
    title: `Senior Engineer ${i + 1}`,
    company: `Company ${i + 1}`,
    location: "London, UK",
    startDate: `Jan ${2010 + i}`,
    endDate: `Dec ${2011 + i}`,
    bullets: Array.from(
      { length: 5 },
      (_, b) =>
        `Delivered outcome ${b + 1} with measurable impact across several teams and services.`,
    ),
  })),
  projects: Array.from({ length: 5 }, (_, i) => ({
    name: `Project ${i + 1}`,
    technologies: ["Go", "Rust"],
    link: `https://github.com/adalovelace/project-${i + 1}`,
    bullets: [
      "Long-lived open source project with a paragraph of description.",
    ],
  })),
  education: Array.from({ length: 3 }, (_, i) => ({
    degree: "MSc",
    major: `Field ${i + 1}`,
    institution: `University ${i + 1}`,
    location: "London, UK",
    startDate: `Sep ${2005 + i}`,
    endDate: `Jun ${2007 + i}`,
  })),
};

export const HOSTILE_COVER_LETTER = {
  greeting: "Dear #panic() <Hiring Manager>,",
  body_paragraphs: [
    HOSTILE_TEXT,
    "Second paragraph with a link: ada~love.dev/my_page.",
  ],
  closing: "Best regards*,",
  signature_name: "Ada #panic() <Lovelace>",
};

export const HOSTILE_JOB = {
  url: "https://jobs.example.com/x?y=1&z=2#frag",
  jobId: "posting~4821",
  source: "test",
  title: "Staff Engineer <Platform> #1",
  company: "Helios*Robotics [EU]",
  description: HOSTILE_TEXT,
};

export const GENERATED_COVER_LETTER = {
  greeting: "Dear Hiring Manager,",
  body_paragraphs: [
    "I am applying for the Staff Platform Engineer role at Helios Robotics.",
    "At Northwind Data I rebuilt the ingestion pipeline in Go and cut p99 latency to 240ms.",
    "I would welcome the chance to bring that experience to your telemetry platform.",
  ],
  closing: "Sincerely,",
  signature_name: "Ada Lovelace",
};
