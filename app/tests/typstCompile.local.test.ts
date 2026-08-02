import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  COVER_TEMPLATES,
  RESUME_TEMPLATES,
  buildCoverLetterTypstSource,
  buildCustomCoverLetterTypstSource,
  buildCustomResumeTypstSource,
  buildResumeTypstSource,
  type CoverTemplateId,
  type ResumeTemplateId,
} from "../convex/lib/templates";
import {
  BARE_PROFILE,
  BARE_RESUME,
  GENERATED_COVER_LETTER,
  GENERATED_RESUME,
  HOSTILE_COVER_LETTER,
  HOSTILE_JOB,
  HOSTILE_PROFILE,
  HOSTILE_RESUME,
  JOB,
  LONG_RESUME,
  MODEL_SHAPED_RESUME,
  PROFILE,
  SPARSE_PROFILE,
  SPARSE_RESUME,
} from "./fixtures";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(tmpdir(), "career-tailor-typst");

function hasTypstCli() {
  try {
    execFileSync("typst", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function normalizeTypstSource(source: string) {
  return source
    .replace(/"Source Sans Pro"/gi, '"New Computer Modern"')
    .replace(/"Source Sans 3"/gi, '"New Computer Modern"')
    .replace(/"Roboto"/gi, '"New Computer Modern"')
    .replace(/"Open Sans"/gi, '"New Computer Modern"');
}

async function readPdf(file: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(file)),
    useSystemFonts: false,
  }).promise;

  const pages: string[] = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const content = await (await pdf.getPage(page)).getTextContent();
    pages.push(
      content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" "),
    );
  }
  return { pageCount: pdf.numPages, text: pages.join("\n") };
}

function squash(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, "")
    .toLowerCase();
}

async function build(name: string, entryPath: string, source: string) {
  const root = join(outRoot, name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  cpSync(join(appRoot, "templates"), join(root, "templates"), {
    recursive: true,
  });

  const mainFile = join(root, entryPath);
  const pdfFile = join(root, "out.pdf");
  mkdirSync(dirname(mainFile), { recursive: true });
  writeFileSync(mainFile, normalizeTypstSource(source));

  try {
    execFileSync("typst", ["compile", "--root", root, mainFile, pdfFile], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error: any) {
    return {
      ok: false,
      bytes: 0,
      pageCount: 0,
      text: "",
      report: `${error.stdout ?? ""}\n${error.stderr ?? ""}\n--- source ---\n${source}`,
    };
  }

  const { pageCount, text } = await readPdf(pdfFile);
  return {
    ok: true,
    bytes: statSync(pdfFile).size,
    pageCount,
    text,
    report: text,
  };
}

const FORBIDDEN = [
  {
    pattern: /\\[@_#~*<>[\]$-]/,
    why: "escape backslash printed on the page",
    squashed: true,
  },
  {
    pattern: /https:\/\/(?![\w-])/i,
    why: "link with no target after the scheme",
    squashed: true,
  },
  { pattern: /mailto:/i, why: "mailto: shown as text", squashed: true },
  { pattern: /(^|[^a-z])tel:/i, why: "tel: shown as text", squashed: true },
  {
    pattern: /\(\s*"[^"]*"\s*,\s*\)/,
    why: "Typst array literal rendered as content",
  },
  {
    pattern: /\(\s*"[^"]*"\s*,\s*"/,
    why: "Typst array literal rendered as content",
  },
  { pattern: /\bundefined\b/i, why: "undefined value" },
  { pattern: /\[object Object\]/i, why: "object stringified into the page" },
  { pattern: /\bpanicked\b/i, why: "injected Typst code ran" },
];

function expectNoArtifacts(text: string) {
  const squashed = text.replace(/\s+/g, "");
  for (const { pattern, why, squashed: useSquashed } of FORBIDDEN) {
    const target = useSquashed ? squashed : text;
    expect(pattern.test(target), `${why}: ${target.match(pattern)?.[0]}`).toBe(
      false,
    );
  }
}

function expectContains(text: string, facts: string[]) {
  const squashed = squash(text);
  for (const fact of facts) {
    expect(
      squashed.includes(squash(fact)),
      `missing from the PDF: ${fact}`,
    ).toBe(true);
  }
}

const CUSTOM_RESUME_TEMPLATE = `
#set page(paper: "us-letter", margin: 36pt)
#set text(font: "New Computer Modern", size: 10pt)

= #resume.header.name
#resume.header.email #h(6pt) #resume.header.phone #h(6pt) #resume.header.location

#for entry in resume.header.links [ #entry.label #entry.url \\ ]

#resume.summary

#for group in resume.skills [
  *#group.category:* #group.items.join(", ") \\
]

#for role in resume.experience [
  == #role.title
  #role.company #h(6pt) #role.location #h(6pt) #role.dates (#role.start – #role.end)
  #for bullet in role.bullets [ - #bullet ]
]

#for project in resume.projects [
  == #project.name
  #project.technologies.join(", ") #h(6pt) #project.link #h(6pt) #project.dates
  #for bullet in project.bullets [ - #bullet ]
]

#for item in resume.education [
  == #item.degree #item.major
  #item.institution #h(6pt) #item.location #h(6pt) #item.dates
]
`;

const CUSTOM_COVER_TEMPLATE = `
#set page(paper: "us-letter", margin: 42pt)
#set text(font: "New Computer Modern", size: 11pt)

= #sender.name
#sender.email #h(6pt) #sender.phone #h(6pt) #sender.location
#for entry in sender.links [ #entry.label #entry.url \\ ]

#cover_letter.company_name #h(6pt) #cover_letter.job_title
#cover_letter.recipient_name #cover_letter.recipient_title

#cover_letter.greeting

#for paragraph in cover_letter.body_paragraphs [ #paragraph #parbreak() ]

#cover_letter.closing \\
#cover_letter.signature_name
`;

const CUSTOM_ENTRY_PATH = "templates/custom/main.typ";

const SINGLE_PAGE_TEMPLATES: ResumeTemplateId[] = [
  "metronic",
  "impressive_impression",
];

type ResumeCase = {
  name: string;
  resume: unknown;
  profile: unknown;
  expected?: string[];
  minPages?: number;
  flowingExpected?: string[];
};

const RESUME_CASES: ResumeCase[] = [
  {
    name: "full",
    resume: GENERATED_RESUME,
    profile: PROFILE,
    expected: [
      "Ada Lovelace",
      "ada@example.com",
      "adalovelace",
      "Northwind Data",
      "Cartography Labs",
      "University of London",
      "Tessellate",
      "Quorum",
      "Kubernetes",
      "TypeScript",
    ],
  },
  {
    name: "sparse",
    resume: SPARSE_RESUME,
    profile: SPARSE_PROFILE,
    expected: ["Jordan Reyes", "jordan@example.com", "Helpdesk Co", "Excel"],
  },
  {
    name: "bare",
    resume: BARE_RESUME,
    profile: BARE_PROFILE,
    expected: ["Sam Doe"],
  },
  {
    name: "hostile",
    resume: HOSTILE_RESUME,
    profile: HOSTILE_PROFILE,
    expected: ['#panic("pwned")', "ada~love.dev", "my--repo", "C#", "C++"],
  },
  {
    name: "model-shaped",
    resume: MODEL_SHAPED_RESUME,
    profile: BARE_PROFILE,
    expected: [
      "Sam Rivera",
      "Metrics Inc",
      "Airflow",
      "State University",
      "Jan 2020",
    ],
  },
  {
    name: "long",
    resume: LONG_RESUME,
    profile: PROFILE,
    expected: ["Company 1"],
    minPages: 2,
    flowingExpected: ["Company 8", "Project 5", "University 3"],
  },
  {
    name: "empty-payload",
    resume: {},
    profile: PROFILE,
    expected: ["Ada Lovelace", "ada@example.com"],
  },
  { name: "null-payload", resume: null, profile: null },
];

type CoverCase = {
  name: string;
  cover: unknown;
  profile: unknown;
  job: unknown;
  expected?: string[];
};

const COVER_CASES: CoverCase[] = [
  {
    name: "full",
    cover: GENERATED_COVER_LETTER,
    profile: PROFILE,
    job: JOB,
    expected: [
      "Ada Lovelace",
      "Helios Robotics",
      "I am applying for the Staff Platform Engineer role",
      "I would welcome the chance",
    ],
  },
  {
    name: "sparse",
    cover: {
      greeting: "",
      body_paragraphs: [],
      closing: "",
      signature_name: "",
    },
    profile: SPARSE_PROFILE,
    job: { url: "", title: "", company: "", description: "" },
    expected: ["Jordan Reyes"],
  },
  {
    name: "bare",
    cover: {},
    profile: BARE_PROFILE,
    job: null,
    expected: ["Sam Doe"],
  },
  {
    name: "hostile",
    cover: HOSTILE_COVER_LETTER,
    profile: HOSTILE_PROFILE,
    job: HOSTILE_JOB,
    expected: ['#panic("pwned")'],
  },
  {
    name: "long",
    cover: {
      ...GENERATED_COVER_LETTER,
      body_paragraphs: Array.from(
        { length: 12 },
        (_, i) =>
          `Paragraph ${i + 1}. ${"Relevant experience and impact. ".repeat(12)}`,
      ),
    },
    profile: PROFILE,
    job: JOB,
    expected: ["Paragraph 1.", "Paragraph 12."],
  },
  { name: "null-payload", cover: null, profile: null, job: null },
];

describe.skipIf(!hasTypstCli())("every template compiles", () => {
  const resumeTemplateIds = Object.keys(RESUME_TEMPLATES) as ResumeTemplateId[];
  const coverTemplateIds = Object.keys(COVER_TEMPLATES) as CoverTemplateId[];

  describe.each(resumeTemplateIds)("resume / %s", (templateId) => {
    const isSinglePage = SINGLE_PAGE_TEMPLATES.includes(templateId);

    it.each(RESUME_CASES)(
      "$name profile",
      async ({
        name,
        resume,
        profile,
        expected,
        minPages,
        flowingExpected,
      }) => {
        const source = buildResumeTypstSource({ templateId, resume, profile });
        const result = await build(
          `${templateId}-${name}`,
          RESUME_TEMPLATES[templateId].entryPath,
          source,
        );

        expect(result.ok, result.report).toBe(true);
        expect(result.bytes).toBeGreaterThan(1000);
        expectNoArtifacts(result.text);
        expectContains(result.text, expected ?? []);

        if (!isSinglePage) {
          expect(result.pageCount).toBeGreaterThanOrEqual(minPages ?? 1);
          expectContains(result.text, flowingExpected ?? []);
        }
      },
    );
  });

  describe.each(coverTemplateIds)("cover letter / %s", (templateId) => {
    it.each(COVER_CASES)(
      "$name profile",
      async ({ name, cover, profile, job, expected }) => {
        const source = buildCoverLetterTypstSource({
          templateId,
          coverLetter: cover,
          profile,
          job,
        });
        const result = await build(
          `${templateId}-${name}`,
          COVER_TEMPLATES[templateId].entryPath,
          source,
        );

        expect(result.ok, result.report).toBe(true);
        expect(result.bytes).toBeGreaterThan(1000);
        expectNoArtifacts(result.text);
        expectContains(result.text, expected ?? []);
      },
    );
  });

  describe("custom template", () => {
    it.each(RESUME_CASES)(
      "resume / $name profile",
      async ({ name, resume, profile, expected }) => {
        const source = buildCustomResumeTypstSource({
          templateSource: CUSTOM_RESUME_TEMPLATE,
          resume,
          profile,
        });
        const result = await build(
          `custom-resume-${name}`,
          CUSTOM_ENTRY_PATH,
          source,
        );

        expect(result.ok, result.report).toBe(true);
        expectNoArtifacts(result.text);
        expectContains(result.text, expected ?? []);
      },
    );

    it.each(COVER_CASES)(
      "cover letter / $name profile",
      async ({ name, cover, profile, job, expected }) => {
        const source = buildCustomCoverLetterTypstSource({
          templateSource: CUSTOM_COVER_TEMPLATE,
          coverLetter: cover,
          profile,
          job,
        });
        const result = await build(
          `custom-cover-${name}`,
          CUSTOM_ENTRY_PATH,
          source,
        );

        expect(result.ok, result.report).toBe(true);
        expectNoArtifacts(result.text);
        expectContains(result.text, expected ?? []);
      },
    );
  });
});
