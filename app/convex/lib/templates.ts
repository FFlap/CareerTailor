import { Infer, v } from "convex/values";

export const resumeTemplateIdValidator = v.union(
  v.literal("basic_resume"),
  v.literal("simple_technical_resume"),
  v.literal("modern_cv"),
  v.literal("neat_cv"),
  v.literal("metronic"),
  v.literal("impressive_impression"),
);

export const coverTemplateIdValidator = v.union(
  v.literal("modern_cv_cover"),
  v.literal("modern_cv_cover_alt"),
  v.literal("neat_cv_letter"),
);

export type ResumeTemplateId = Infer<typeof resumeTemplateIdValidator>;
export type CoverTemplateId = Infer<typeof coverTemplateIdValidator>;

export const RESUME_TEMPLATES: Record<
  ResumeTemplateId,
  { id: ResumeTemplateId; label: string; entryPath: string; assets: string[] }
> = {
  basic_resume: {
    id: "basic_resume",
    label: "Basic Resume",
    entryPath: "templates/basic-resume/main.typ",
    assets: [],
  },
  simple_technical_resume: {
    id: "simple_technical_resume",
    label: "Simple Technical Resume",
    entryPath: "templates/simple-technical-resume/main.typ",
    assets: [],
  },
  modern_cv: {
    id: "modern_cv",
    label: "Modern CV",
    entryPath: "templates/modern-cv/resume.typ",
    assets: ["templates/modern-cv/profile.png"],
  },
  neat_cv: {
    id: "neat_cv",
    label: "Neat CV",
    entryPath: "templates/neat-cv/cv.typ",
    assets: [
      "templates/neat-cv/profile.png",
      "templates/neat-cv/publications.yml",
    ],
  },
  metronic: {
    id: "metronic",
    label: "Metronic Resume",
    entryPath: "templates/metronic/main.typ",
    assets: [],
  },
  impressive_impression: {
    id: "impressive_impression",
    label: "Impressive Impression CV",
    entryPath: "templates/impressive-impression/cv.typ",
    assets: [
      "templates/impressive-impression/utils.typ",
      "templates/impressive-impression/theme.typ",
      "templates/impressive-impression/assets/profile.png",
      "templates/impressive-impression/assets/signature.svg",
      "templates/impressive-impression/assets/flags/fr.svg",
      "templates/impressive-impression/assets/flags/gb.svg",
      "templates/impressive-impression/assets/flags/gr.svg",
    ],
  },
};

export const COVER_TEMPLATES: Record<
  CoverTemplateId,
  { id: CoverTemplateId; label: string; entryPath: string; assets: string[] }
> = {
  modern_cv_cover: {
    id: "modern_cv_cover",
    label: "Modern CV Cover",
    entryPath: "templates/modern-cv/coverletter.typ",
    assets: ["templates/modern-cv/profile.png"],
  },
  modern_cv_cover_alt: {
    id: "modern_cv_cover_alt",
    label: "Modern CV Cover Alt",
    entryPath: "templates/modern-cv/coverletter2.typ",
    assets: ["templates/modern-cv/profile.png"],
  },
  neat_cv_letter: {
    id: "neat_cv_letter",
    label: "Neat CV Letter",
    entryPath: "templates/neat-cv/letter.typ",
    assets: ["templates/neat-cv/profile.png"],
  },
};

const SUMMARY_TEMPLATES: string[] = [
  "neat_cv",
  "metronic",
  "impressive_impression",
];

export function templateShowsSummary(templateId: string | undefined) {
  if (!templateId) return false;
  if (templateId.startsWith("custom:")) return true;
  return SUMMARY_TEMPLATES.includes(templateId);
}

type TemplateLink = { label: string; url: string };

type SocialLink = {
  url: string;
  handle: string;
  display: string;
};

const EMPTY_SOCIAL: SocialLink = { url: "", handle: "", display: "" };

type Line = string | false | null | undefined;
function escapeTypst(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/@/g, "\\@")
    .replace(/~/g, "\\~")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>");
}

function escapeTypstVerbatim(value: unknown) {
  return escapeTypst(value)
    .replace(/-/g, "\\-")
    .replace(/\./g, "\\.")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

function typstString(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = raw
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
  return `"${safe}"`;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function joinNonEmpty(parts: Array<unknown>, separator = " | ") {
  return parts
    .map((part) => text(part))
    .filter(Boolean)
    .join(separator);
}

function lines(parts: Line[]) {
  return parts
    .filter(
      (part): part is string =>
        part !== false && part !== null && part !== undefined,
    )
    .join("\n");
}

function when(condition: unknown, ...parts: Line[]): Line[] {
  return condition ? parts : [];
}

function typstTuple(items: Array<unknown> = []) {
  const safe = (items || [])
    .map((item) => text(item))
    .filter(Boolean)
    .map((item) => typstString(item));
  if (!safe.length) return "()";
  if (safe.length === 1) return `(${safe[0]},)`;
  return `(${safe.join(", ")})`;
}

function typstExprTuple(items: string[] = []) {
  if (!items.length) return "()";
  if (items.length === 1) return `(${items[0]},)`;
  return `(${items.join(", ")})`;
}

function typstArgs(items: Array<unknown> = []) {
  return (items || [])
    .map((item) => text(item))
    .filter(Boolean)
    .map((item) => typstString(item))
    .join(", ");
}

function typstDict(entries: Record<string, string>) {
  const parts = Object.entries(entries)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}: ${value}`);
  if (!parts.length) return "()";
  return `(${parts.join(", ")})`;
}

function optionalArg(name: string, value: unknown, pad = "  "): Line {
  const trimmed = text(value);
  return trimmed ? `${pad}${name}: ${typstString(trimmed)},` : false;
}

function indent(block: string, pad: string) {
  return block
    .split("\n")
    .map((line) => (line ? `${pad}${line}` : line))
    .join("\n");
}

function withScheme(url: unknown) {
  const trimmed = text(url);
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function withoutScheme(url: unknown) {
  return text(url)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

function normalizeLinks(links: unknown): TemplateLink[] {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (!link) return null;
      if (typeof link === "string") return { label: "", url: text(link) };
      return { label: text((link as any).label), url: text((link as any).url) };
    })
    .filter((link): link is TemplateLink => Boolean(link && link.url));
}

function handleFrom(url: string, host: string, skipSegments: string[] = []) {
  const cleaned = withoutScheme(url);
  if (!cleaned.toLowerCase().startsWith(host)) return "";
  const path = cleaned.slice(host.length).split(/[?#]/)[0];
  const segments = path.split("/").filter(Boolean);
  if (segments.length && skipSegments.includes(segments[0].toLowerCase())) {
    segments.shift();
  }
  return segments[0] || "";
}

const SOCIAL_HOSTS = [
  "github.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "gitlab.com",
  "bitbucket.org",
  "mastodon.social",
];

function pickSocial(
  links: TemplateLink[],
  host: string,
  skipSegments: string[],
  labelWords: string[],
): SocialLink {
  for (const link of links) {
    if (withoutScheme(link.url).toLowerCase().startsWith(host)) {
      const url = withScheme(link.url);
      return {
        url,
        handle: handleFrom(link.url, host, skipSegments),
        display: withoutScheme(url),
      };
    }
    const label = link.label.toLowerCase();
    const bare = link.url;
    if (
      labelWords.some((word) => label.includes(word)) &&
      bare &&
      !bare.includes("/") &&
      !bare.includes(".")
    ) {
      const prefix = skipSegments[0] ? `${skipSegments[0]}/` : "";
      const url = `https://${host}/${prefix}${bare}`;
      return { url, handle: bare, display: withoutScheme(url) };
    }
  }
  return EMPTY_SOCIAL;
}

function githubLink(links: TemplateLink[]) {
  return pickSocial(links, "github.com", [], ["github"]);
}

function linkedinLink(links: TemplateLink[]) {
  return pickSocial(
    links,
    "linkedin.com",
    ["in", "pub", "profile"],
    ["linkedin"],
  );
}

function websiteLink(links: TemplateLink[]): SocialLink {
  const match = links.find((link) => {
    const cleaned = withoutScheme(link.url).toLowerCase();
    return cleaned && !SOCIAL_HOSTS.some((host) => cleaned.startsWith(host));
  });
  if (!match) return EMPTY_SOCIAL;
  const url = withScheme(match.url);
  return { url, handle: "", display: withoutScheme(url) };
}

type Header = {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: TemplateLink[];
};

function getHeader(resume: any = {}, profile: any = {}): Header {
  const header = resume?.header || {};
  const personal = profile?.personal || {};
  const links = normalizeLinks(
    Array.isArray(header.links) && header.links.length
      ? header.links
      : personal.links,
  );
  return {
    name: text(header.name) || text(personal.fullName),
    email: text(header.email) || text(personal.email),
    phone: text(header.phone) || text(personal.phone),
    location: text(header.location) || text(personal.location),
    links,
  };
}

function splitName(fullName: string) {
  const parts = text(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function startDateOf(item: any) {
  return text(item?.startDate ?? item?.start_date);
}

function endDateOf(item: any) {
  return text(item?.endDate ?? item?.end_date);
}

function dateRange(
  item: any,
  { openEnded = false }: { openEnded?: boolean } = {},
) {
  const start = startDateOf(item);
  const end = endDateOf(item);
  if (start && end) return `${start} - ${end}`;
  if (start) return openEnded ? `${start} - Present` : start;
  return end;
}

function bulletsOf(item: any) {
  return Array.isArray(item?.bullets)
    ? item.bullets.map((bullet: any) => text(bullet)).filter(Boolean)
    : [];
}

function formatBullets(item: any) {
  return bulletsOf(item)
    .map((bullet: string) => `- ${escapeTypst(bullet)}`)
    .join("\n");
}

function normalizeSkillGroups(
  skills: unknown,
): Array<{ category: string; items: string[] }> {
  if (typeof skills === "string") {
    const items = skills
      .split(/,|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? [{ category: "Skills", items }] : [];
  }
  if (!Array.isArray(skills) || !skills.length) return [];
  if (typeof skills[0] === "string") {
    const items = skills.map((item: any) => text(item)).filter(Boolean);
    return items.length ? [{ category: "Skills", items }] : [];
  }
  return skills
    .map((group: any) => ({
      category: text(group?.category) || text(group?.name) || "Skills",
      items: Array.isArray(group?.items)
        ? group.items.map((item: any) => text(item)).filter(Boolean)
        : [],
    }))
    .filter((group) => group.items.length);
}

function flatSkills(skills: unknown) {
  return normalizeSkillGroups(skills).flatMap((group) => group.items);
}

function skillLines(skills: unknown) {
  return normalizeSkillGroups(skills)
    .map(
      (group) =>
        `- *${escapeTypst(group.category)}:* ${group.items.map(escapeTypst).join(", ")}`,
    )
    .join("\n");
}

function sectionsOf(resume: any = {}) {
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    experience: list(resume?.experience).filter(
      (role: any) =>
        text(role?.title) || text(role?.company) || bulletsOf(role).length,
    ),
    education: list(resume?.education).filter(
      (item: any) =>
        text(item?.institution) || text(item?.degree) || text(item?.major),
    ),
    projects: list(resume?.projects).filter(
      (project: any) => text(project?.name) || bulletsOf(project).length,
    ),
  };
}

function degreeOf(item: any) {
  return joinNonEmpty([item?.degree, item?.major], ", ");
}

function locationOf(item: any) {
  return text(item?.location) || text(item?.country);
}

function technologiesOf(project: any) {
  return Array.isArray(project?.technologies)
    ? project.technologies.map((item: any) => text(item)).filter(Boolean)
    : [];
}

function buildPositions(resume: any = {}) {
  const titles = (Array.isArray(resume?.experience) ? resume.experience : [])
    .map((role: any) => text(role?.title))
    .filter(Boolean);
  return Array.from(new Set<string>(titles)).slice(0, 3);
}

function buildBasicResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile);
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const { experience, education, projects } = sectionsOf(resume);

  const educationBlocks = education
    .map((item: any) =>
      lines([
        "#edu(",
        optionalArg("institution", item.institution),
        optionalArg("location", locationOf(item)),
        optionalArg("dates", dateRange(item)),
        optionalArg("degree", degreeOf(item)),
        ")",
        formatBullets(item) || false,
      ]),
    )
    .join("\n\n");

  const experienceBlocks = experience
    .map((role: any) =>
      lines([
        "#work(",
        optionalArg("title", role.title),
        optionalArg("company", role.company),
        optionalArg("location", locationOf(role)),
        optionalArg("dates", dateRange(role, { openEnded: true })),
        ")",
        formatBullets(role) || false,
      ]),
    )
    .join("\n\n");

  const projectBlocks = projects
    .map((project: any) =>
      lines([
        "#project(",
        optionalArg("name", project.name),
        optionalArg("role", project.role),
        optionalArg("dates", dateRange(project)),
        optionalArg("url", withoutScheme(project.link)),
        ")",
        formatBullets(project) || false,
      ]),
    )
    .join("\n\n");

  const skills = skillLines(resume?.skills);

  return lines([
    '#import "@preview/basic-resume:0.2.9": *',
    "",
    "#show: resume.with(",
    `  author: ${typstString(header.name)},`,
    optionalArg("location", header.location),
    optionalArg("email", header.email),
    optionalArg("phone", header.phone),
    optionalArg("github", github.display),
    optionalArg("linkedin", linkedin.display),
    optionalArg("personal-site", website.display),
    '  accent-color: "#26428b",',
    '  font: "New Computer Modern",',
    '  paper: "us-letter"',
    ")",
    "",
    ...when(educationBlocks, "== Education", educationBlocks, ""),
    ...when(experienceBlocks, "== Work Experience", experienceBlocks, ""),
    ...when(projectBlocks, "== Projects", projectBlocks, ""),
    ...when(skills, "== Skills", skills),
  ]);
}

const SIMPLE_TECHNICAL_ENTRY = [
  "#let entry-heading(title, subtitle, right-top, right-bottom, body) = {",
  "  grid(",
  "    columns: (1fr, 1fr),",
  "    align(left)[*#title* \\ #subtitle],",
  "    align(right)[*#right-top* \\ #emph(right-bottom)],",
  "  )",
  "  v(-0.2em)",
  "  if body != [] {",
  "    v(-0.4em)",
  "    set par(leading: 0.6em)",
  "    set list(indent: 0.5em)",
  "    body",
  "  }",
  "}",
].join("\n");

function buildSimpleTechnicalResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile);
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const { experience, education, projects } = sectionsOf(resume);

  const educationBlocks = education
    .map((item: any) =>
      lines([
        "#entry-heading(",
        `  ${typstString(item.institution)},`,
        `  ${typstString(degreeOf(item))},`,
        `  ${typstString(locationOf(item))},`,
        `  ${typstString(dateRange(item))},`,
        ")[",
        formatBullets(item) || false,
        "]",
      ]),
    )
    .join("\n\n");

  const experienceBlocks = experience
    .map((role: any) =>
      lines([
        "#entry-heading(",
        `  ${typstString(role.title)},`,
        `  ${typstString(role.company)},`,
        `  ${typstString(dateRange(role, { openEnded: true }))},`,
        `  ${typstString(locationOf(role))},`,
        ")[",
        formatBullets(role) || false,
        "]",
      ]),
    )
    .join("\n\n");

  const projectBlocks = projects
    .map((project: any) => {
      const stack = joinNonEmpty(
        [
          technologiesOf(project).join(", "),
          withoutScheme(project.link),
          dateRange(project),
        ],
        " | ",
      );
      const url = withScheme(project.link);
      return lines([
        "#project-heading(",
        `  ${typstString(project.name)},`,
        optionalArg("stack", stack),
        optionalArg("project-url", url),
        ")[",
        formatBullets(project) || false,
        "]",
      ]);
    })
    .join("\n\n");

  const skills = skillLines(resume?.skills);

  return lines([
    '#import "@preview/simple-technical-resume:0.1.1": *',
    "",
    SIMPLE_TECHNICAL_ENTRY,
    "",
    "#show: resume.with(",
    "  top-margin: 0.45in,",
    "  personal-info-font-size: 9.2pt,",
    "  author-position: center,",
    "  personal-info-position: center,",
    `  author-name: ${typstString(header.name)},`,
    optionalArg("phone", header.phone),
    optionalArg("location", header.location),
    optionalArg("email", header.email),
    optionalArg("website", website.display),
    optionalArg("linkedin-user-id", linkedin.handle),
    optionalArg("github-username", github.handle),
    ")",
    "",
    ...when(
      educationBlocks,
      '#custom-title("Education")[',
      educationBlocks,
      "]",
      "",
    ),
    ...when(
      experienceBlocks,
      '#custom-title("Experience")[',
      experienceBlocks,
      "]",
      "",
    ),
    ...when(
      projectBlocks,
      '#custom-title("Projects")[',
      projectBlocks,
      "]",
      "",
    ),
    ...when(skills, '#custom-title("Skills")[', "#skills()[", skills, "]", "]"),
  ]);
}

function buildModernCvResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile);
  const { first, last } = splitName(header.name);
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const { experience, education, projects } = sectionsOf(resume);

  const entry = (args: Line[], body: string) =>
    lines([
      "#resume-entry(",
      ...args,
      ")",
      ...when(body, "#resume-item[", body, "]"),
    ]);

  const experienceBlocks = experience
    .map((role: any) =>
      entry(
        [
          optionalArg("title", role.title),
          optionalArg("location", locationOf(role)),
          optionalArg("date", dateRange(role, { openEnded: true })),
          optionalArg("description", role.company),
        ],
        formatBullets(role),
      ),
    )
    .join("\n\n");

  const projectBlocks = projects
    .map((project: any) => {
      const url = withScheme(project.link);
      return entry(
        [
          optionalArg("title", project.name),
          url
            ? `  location: link(${typstString(url)})[${escapeTypstVerbatim(withoutScheme(url))}],`
            : false,
          optionalArg("date", dateRange(project)),
          optionalArg("description", technologiesOf(project).join(", ")),
        ],
        formatBullets(project),
      );
    })
    .join("\n\n");

  const educationBlocks = education
    .map((item: any) =>
      entry(
        [
          optionalArg("title", item.institution),
          optionalArg("location", locationOf(item)),
          optionalArg("date", dateRange(item)),
          optionalArg("description", degreeOf(item)),
        ],
        formatBullets(item),
      ),
    )
    .join("\n\n");

  const skills = normalizeSkillGroups(resume?.skills)
    .map(
      (group) =>
        `#resume-skill-item(${typstString(group.category)}, ${typstTuple(group.items)})`,
    )
    .join("\n");

  return lines([
    '#import "@preview/modern-cv:0.9.0": *',
    "",
    "#set text(ligatures: false)",
    "",
    "#show: resume.with(",
    "  author: (",
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    optionalArg("email", header.email, "    "),
    optionalArg("homepage", website.url, "    "),
    optionalArg("phone", header.phone, "    "),
    optionalArg("github", github.handle, "    "),
    optionalArg("linkedin", linkedin.handle, "    "),
    optionalArg("address", header.location, "    "),
    `    positions: ${typstTuple(buildPositions(resume))},`,
    "  ),",
    `  keywords: ${typstTuple(flatSkills(resume?.skills).slice(0, 4))},`,
    `  description: ${typstString(joinNonEmpty([header.name, "resume"], " "))},`,
    "  profile-picture: none,",
    "  date: datetime.today().display(),",
    '  language: "en",',
    '  font: "New Computer Modern",',
    '  header-font: "New Computer Modern"',
    ")",
    "",
    ...when(
      experienceBlocks,
      "= Professional Experience",
      experienceBlocks,
      "",
    ),
    ...when(projectBlocks, "= Projects", projectBlocks, ""),
    ...when(skills, "= Skills", skills, ""),
    ...when(educationBlocks, "= Education", educationBlocks),
  ]);
}

function neatAuthorDict(
  header: Header,
  positions: string[],
  includeSocials: boolean,
) {
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const { first, last } = splitName(header.name);
  return lines([
    "  author: (",
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    optionalArg("email", header.email, "    "),
    header.location ? `    address: [${escapeTypst(header.location)}],` : false,
    optionalArg("phone", header.phone, "    "),
    `    position: ${typstTuple(positions)},`,
    includeSocials && optionalArg("website", website.url, "    "),
    includeSocials && optionalArg("linkedin", linkedin.handle, "    "),
    includeSocials && optionalArg("github", github.handle, "    "),
    "  ),",
  ]);
}

function buildNeatCvResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile);
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const hasSocials = Boolean(github.handle || linkedin.handle || website.url);
  const hasContact = Boolean(header.email || header.phone || header.location);
  const summary = text(resume?.summary);
  const { experience, education, projects } = sectionsOf(resume);

  const entry = (args: Line[], body: string) =>
    lines(["#entry(", ...args, ")[", body || false, "]"]);

  const experienceBlocks = experience
    .map((role: any) =>
      entry(
        [
          optionalArg("title", role.title),
          optionalArg("date", dateRange(role, { openEnded: true })),
          optionalArg("institution", role.company),
          optionalArg("location", locationOf(role)),
        ],
        formatBullets(role),
      ),
    )
    .join("\n\n");

  const educationBlocks = education
    .map((item: any) =>
      entry(
        [
          optionalArg("title", degreeOf(item) || item.institution),
          optionalArg("date", dateRange(item)),
          optionalArg("institution", degreeOf(item) ? item.institution : ""),
          optionalArg("location", locationOf(item)),
        ],
        formatBullets(item),
      ),
    )
    .join("\n\n");

  const projectBlocks = projects
    .map((project: any) => {
      const url = withScheme(project.link);
      return entry(
        [
          optionalArg("title", project.name),
          optionalArg("date", dateRange(project)),
          optionalArg("institution", technologiesOf(project).join(", ")),
          url
            ? `  location: link(${typstString(url)})[${escapeTypstVerbatim(withoutScheme(url))}],`
            : false,
        ],
        formatBullets(project),
      );
    })
    .join("\n\n");

  const skillItems = flatSkills(resume?.skills);

  return lines([
    '#import "@preview/neat-cv:0.6.0": (',
    "  contact-info, cv, entry, item-pills, side, social-links",
    ")",
    "",
    '#set text(lang: "en")',
    "#set text(ligatures: false)",
    "",
    "#show: cv.with(",
    neatAuthorDict(header, buildPositions(resume), hasSocials),
    "  profile-picture: none,",
    '  accent-color: rgb("#4682b4"),',
    '  header-color: rgb("#35414d"),',
    '  heading-font: "New Computer Modern",',
    '  body-font: "New Computer Modern"',
    ")",
    "",
    "#side[",
    ...when(summary, "  = About me", `  ${escapeTypst(summary)}`, ""),
    ...when(hasContact, "  = Contact", "  #contact-info()", ""),
    ...when(hasSocials, "  = Links", "  #social-links()", ""),
    ...when(
      skillItems.length,
      "  = Skills",
      `  #item-pills(${typstTuple(skillItems)})`,
    ),
    "]",
    "",
    ...when(
      experienceBlocks,
      "= Professional Experience",
      experienceBlocks,
      "",
    ),
    ...when(projectBlocks, "= Projects", projectBlocks, ""),
    ...when(educationBlocks, "= Education", educationBlocks),
  ]);
}

function buildMetronicResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile);
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const summary = text(resume?.summary);
  const role = buildPositions(resume)[0] || "";
  const skills = flatSkills(resume?.skills);
  const { experience, education, projects } = sectionsOf(resume);

  const educationBlocks = education
    .map((item: any) => {
      const dates = dateRange(item);
      const institution = joinNonEmpty(
        [item.institution, dates && `(${dates})`],
        " ",
      );
      return lines([
        degreeOf(item) ? `${escapeTypst(degreeOf(item))}\\` : false,
        institution ? escapeTypst(institution) : false,
      ]);
    })
    .filter(Boolean)
    .join("\n\n");

  const experienceBlocks = experience
    .map((item: any) => {
      const subtitle = joinNonEmpty(
        [item.company, dateRange(item, { openEnded: true })],
        " - ",
      );
      return lines([
        `=== ${escapeTypst(item.title)}`,
        ...when(subtitle, escapeTypst(subtitle)),
        "",
        ...when(formatBullets(item), formatBullets(item)),
      ]);
    })
    .join("\n\n");

  const projectBlocks = projects
    .map((project: any) => {
      const subtitle = joinNonEmpty(
        [
          escapeTypst(technologiesOf(project).join(", ")),
          escapeTypstVerbatim(withoutScheme(project.link)),
        ],
        " - ",
      );
      return lines([
        `=== ${escapeTypst(project.name)}`,
        ...when(subtitle, subtitle),
        "",
        ...when(formatBullets(project), formatBullets(project)),
      ]);
    })
    .join("\n\n");

  const contactArgs = [
    optionalArg("phone", header.phone, "      "),
    optionalArg("email", header.email, "      "),
    optionalArg("linkedin", linkedin.handle, "      "),
    optionalArg("github", github.handle, "      "),
    optionalArg("location", header.location, "      "),
    optionalArg("website", website.display, "      "),
  ].filter(Boolean) as string[];

  return lines([
    '#import "@preview/metronic:1.1.0": *',
    "",
    "#theme(",
    '  accent-color: rgb("61B7AE"),',
    '  background-color: rgb("F2F0EF")',
    ")",
    "",
    "#set text(ligatures: false)",
    "",
    "#show: resume-page.with(",
    "  sidebar: [",
    `    = ${escapeTypst(header.name)}`,
    "",
    ...when(role, `    #medium(${typstString(role)})`, "", "    #v(5pt)", ""),
    ...when(summary, `    ${escapeTypst(summary)}`, "", "    #v(5pt)", ""),
    ...when(contactArgs.length, "    #contact(", ...contactArgs, "    )", ""),
    ...when(
      educationBlocks,
      '    #section(icon: "university", "Education")[',
      "      #small()[",
      indent(educationBlocks, "        "),
      "      ]",
      "    ]",
      "",
    ),
    ...when(
      skills.length,
      '    #section(icon: "check-double", "Skills")[',
      `      #tags(${typstArgs(skills)})`,
      "    ]",
    ),
    "  ]",
    ")",
    "",
    ...when(
      experienceBlocks,
      '#section(icon: "briefcase", "Professional Experience")[',
      indent(experienceBlocks, "  "),
      "]",
      "",
    ),
    ...when(
      projectBlocks,
      '#section(icon: "lightbulb", "Projects")[',
      indent(projectBlocks, "  "),
      "]",
    ),
  ]);
}

function impressiveBlock({
  title,
  supplement,
  body,
  start,
  end,
}: {
  title: string;
  supplement: string;
  body: string;
  start: string;
  end: string;
}) {
  const hasTimeline = Boolean(start || end);
  return lines([
    hasTimeline
      ? "#make-main-content-block-with-timeline("
      : "#make-main-content-block(",
    hasTimeline ? `  ([${escapeTypst(end)}], [${escapeTypst(start)}]),` : false,
    `  ${typstString(title)},`,
    "  [",
    body ? indent(body, "    ") : false,
    "  ],",
    supplement ? `  supplement: [${supplement}],` : false,
    ")",
  ]);
}

function buildImpressiveImpressionResumeSource(resume: any, profile: any) {
  const header = getHeader(resume, profile);
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const summary = text(resume?.summary);
  const { experience, education, projects } = sectionsOf(resume);

  const experienceBlocks = experience
    .map((role: any) =>
      impressiveBlock({
        title: text(role.title),
        supplement: joinNonEmpty(
          [escapeTypst(role.company), escapeTypst(locationOf(role))],
          " · ",
        ),
        body: formatBullets(role),
        start: startDateOf(role),
        end: endDateOf(role) || (startDateOf(role) ? "Present" : ""),
      }),
    )
    .join("\n\n");

  const projectBlocks = projects
    .map((project: any) =>
      impressiveBlock({
        title: text(project.name),
        supplement: joinNonEmpty(
          [
            escapeTypst(technologiesOf(project).join(", ")),
            escapeTypstVerbatim(withoutScheme(project.link)),
          ],
          " · ",
        ),
        body: formatBullets(project),
        start: startDateOf(project),
        end: endDateOf(project),
      }),
    )
    .join("\n\n");

  const educationBlocks = education
    .map((item: any) =>
      impressiveBlock({
        title: degreeOf(item) || text(item.institution),
        supplement: degreeOf(item)
          ? joinNonEmpty(
              [escapeTypst(item.institution), escapeTypst(locationOf(item))],
              " · ",
            )
          : escapeTypst(locationOf(item)),
        body: formatBullets(item),
        start: startDateOf(item),
        end: endDateOf(item),
      }),
    )
    .join("\n\n");

  const skillPills = flatSkills(resume?.skills)
    .slice(0, 14)
    .map((skill) => `    #pill(${typstString(skill)})`)
    .join("\n");

  const contactEntries = [
    header.location
      ? `iconer-stack("map-marker-alt"), [${escapeTypst(header.location)}]`
      : "",
    header.phone
      ? `iconer-stack("phone"), [#link(${typstString(`tel:${header.phone}`)})[${escapeTypstVerbatim(header.phone)}]]`
      : "",
    header.email
      ? `iconer-stack("at"), [#link(${typstString(`mailto:${header.email}`)})[${escapeTypstVerbatim(header.email)}]]`
      : "",
    website.url
      ? `iconer-stack("globe"), [#link(${typstString(website.url)})[${escapeTypstVerbatim(website.display)}]]`
      : "",
  ].filter(Boolean);

  const socialEntries = [
    linkedin.url
      ? `iconer("linkedin"), [#link(${typstString(linkedin.url)})[${escapeTypstVerbatim(linkedin.handle || linkedin.display)}]]`
      : "",
    github.url
      ? `iconer("github"), [#link(${typstString(github.url)})[${escapeTypstVerbatim(github.handle || github.display)}]]`
      : "",
  ].filter(Boolean);

  return lines([
    '#import "@preview/impressive-impression:0.1.0": (',
    "  cv,",
    "  make-pill,",
    "  make-aside-persona,",
    "  make-aside-grid,",
    "  make-main-content-block,",
    "  make-main-content-block-with-timeline,",
    "  theme-helper,",
    ")",
    "",
    '#import "utils.typ": fa-icon-factory, fa-icon-factory-stack',
    '#import "theme.typ": theme',
    "",
    "#set text(ligatures: false)",
    "",
    `#let name = ${typstString(header.name)}`,
    summary
      ? `#let short-description = [${escapeTypst(summary)}]`
      : "#let short-description = none",
    "",
    "#let th = theme-helper(theme)",
    "#let iconer-stack = fa-icon-factory-stack(theme)",
    "#let iconer = fa-icon-factory(theme)",
    "#let pill = body => make-pill(body, theme)",
    "",
    "#let make-main-content-block = make-main-content-block.with(theme: theme)",
    "#let make-main-content-block-with-timeline = make-main-content-block-with-timeline.with(theme: theme)",
    "",
    "#let main-content = [",
    ...when(
      experienceBlocks,
      "  == Experience",
      indent(experienceBlocks, "  "),
      "",
    ),
    ...when(projectBlocks, "  == Projects", indent(projectBlocks, "  "), ""),
    ...when(educationBlocks, "  == Education", indent(educationBlocks, "  ")),
    "]",
    "",
    "#let aside-content = [",
    "  #make-aside-persona(",
    "    name,",
    "    short-description: short-description,",
    "    theme: theme,",
    "  )",
    ...when(
      contactEntries.length,
      "  #make-aside-grid(",
      "    theme: theme,",
      `    ${contactEntries.join(",\n    ")},`,
      "  )",
    ),
    ...when(
      socialEntries.length,
      "  == Links",
      "  #make-aside-grid(",
      "    theme: theme,",
      `    ${socialEntries.join(",\n    ")},`,
      "  )",
    ),
    ...when(
      skillPills,
      "  == Skills",
      "  #block(above: 0.8em)[",
      skillPills,
      "  ]",
    ),
    "]",
    "",
    "#cv(",
    "  theme: theme,",
    '  paper: "us-letter",',
    "  pages-content: (",
    '    ("left": aside-content, "main": main-content),',
    "  )",
    ")",
  ]);
}

function coverParagraphs(cover: any): string[] {
  return (Array.isArray(cover?.body_paragraphs) ? cover.body_paragraphs : [])
    .map((paragraph: any) => text(paragraph))
    .filter(Boolean);
}

function addresseeFrom(cover: any) {
  const stripped = text(cover?.greeting)
    .replace(/^\s*(dear|hello|hi)\b\s*/i, "")
    .replace(/[,:\s]+$/g, "");
  return stripped || "Hiring Manager";
}

function buildModernCvCoverSource(
  cover: any,
  profile: any,
  job: any,
  templateId: CoverTemplateId,
) {
  const header = getHeader({}, profile);
  const signature = text(cover?.signature_name) || header.name;
  const { first, last } = splitName(header.name || signature);
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const paragraphs = coverParagraphs(cover);
  const company = text(job?.company);
  const jobTitle = text(job?.title);
  const addressee = addresseeFrom(cover);
  const isAlt = templateId === "modern_cv_cover_alt";

  const bodyBlocks = paragraphs
    .map((paragraph) => `#coverletter-content[${escapeTypst(paragraph)}]`)
    .join("\n\n");

  return lines([
    '#import "@preview/modern-cv:0.9.0": *',
    "",
    "#set text(ligatures: false)",
    "",
    "#show: coverletter.with(",
    "  author: (",
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    optionalArg("email", header.email, "    "),
    optionalArg("homepage", website.url, "    "),
    optionalArg("phone", header.phone, "    "),
    optionalArg("github", github.handle, "    "),
    optionalArg("linkedin", linkedin.handle, "    "),
    optionalArg("address", header.location, "    "),
    `    positions: ${typstTuple(buildPositions({ experience: profile?.experience }))},`,
    "  ),",
    "  profile-picture: none,",
    '  language: "en",',
    `  show-footer: ${isAlt ? "false" : "true"},`,
    `  use-smallcaps: ${isAlt ? "false" : "true"},`,
    ...when(isAlt, "  show-address-icon: true,", "  closing: [],"),
    '  font: "New Computer Modern",',
    '  header-font: "New Computer Modern"',
    ")",
    "",
    "#hiring-entity-info(",
    "  entity-info: (",
    `    target: ${typstString(addressee)},`,
    `    name: ${typstString(company)},`,
    '    street-address: "",',
    '    city: ""',
    "  ),",
    ")",
    "",
    jobTitle
      ? `#letter-heading(job-position: ${typstString(jobTitle)}, addressee: ${typstString(addressee)})`
      : `#pad(top: 1em, bottom: 1em)[#text(weight: "light")[Dear ${escapeTypst(addressee)},]]`,
    "",
    ...when(bodyBlocks, bodyBlocks),
  ]);
}

function buildNeatCvCoverSource(cover: any, profile: any, job: any) {
  const header = getHeader({}, profile);
  const signature = text(cover?.signature_name) || header.name;
  const paragraphs = coverParagraphs(cover);
  const greeting = text(cover?.greeting) || `Dear ${addresseeFrom(cover)},`;
  const closing = text(cover?.closing) || "Sincerely,";
  const github = githubLink(header.links);
  const linkedin = linkedinLink(header.links);
  const website = websiteLink(header.links);
  const hasSocials = Boolean(github.handle || linkedin.handle || website.url);

  const recipient = [
    text(job?.company),
    text(job?.title) && `Re: ${text(job?.title)}`,
  ]
    .filter(Boolean)
    .map((line) => escapeTypst(line))
    .join("\\\n");

  return lines([
    '#import "@preview/neat-cv:0.6.0": letter',
    "",
    '#set text(lang: "en")',
    "#set text(ligatures: false)",
    "",
    "#show: letter.with(",
    neatAuthorDict(
      header,
      buildPositions({ experience: profile?.experience }),
      hasSocials,
    ),
    "  profile-picture: none,",
    '  accent-color: rgb("#4682b4"),',
    '  header-text-color: rgb("#3b4f60"),',
    '  heading-font: "New Computer Modern",',
    '  body-font: "New Computer Modern",',
    recipient ? `  recipient: [${recipient}],` : false,
    ")",
    "",
    escapeTypst(greeting),
    "",
    ...when(
      paragraphs.length,
      paragraphs.map((paragraph) => escapeTypst(paragraph)).join("\n\n"),
      "",
    ),
    escapeTypst(closing),
    "",
    `#align(right)[ ${escapeTypst(signature)} ]`,
  ]);
}

export function buildResumeTypstSource({
  templateId,
  resume,
  profile,
}: {
  templateId: ResumeTemplateId;
  resume: any;
  profile: any;
}) {
  const safeResume = resume || {};
  const safeProfile = profile || {};
  switch (templateId) {
    case "basic_resume":
      return buildBasicResumeSource(safeResume, safeProfile);
    case "simple_technical_resume":
      return buildSimpleTechnicalResumeSource(safeResume, safeProfile);
    case "modern_cv":
      return buildModernCvResumeSource(safeResume, safeProfile);
    case "neat_cv":
      return buildNeatCvResumeSource(safeResume, safeProfile);
    case "metronic":
      return buildMetronicResumeSource(safeResume, safeProfile);
    case "impressive_impression":
      return buildImpressiveImpressionResumeSource(safeResume, safeProfile);
    default:
      templateId satisfies never;
      throw new Error("Template not implemented.");
  }
}

export function buildCoverLetterTypstSource({
  templateId,
  coverLetter,
  profile,
  job,
}: {
  templateId: CoverTemplateId;
  coverLetter: any;
  profile: any;
  job: any;
}) {
  const safeCover = coverLetter || {};
  const safeProfile = profile || {};
  if (
    templateId === "modern_cv_cover" ||
    templateId === "modern_cv_cover_alt"
  ) {
    return buildModernCvCoverSource(safeCover, safeProfile, job, templateId);
  }
  if (templateId === "neat_cv_letter") {
    return buildNeatCvCoverSource(safeCover, safeProfile, job);
  }
  templateId satisfies never;
  throw new Error("Template not implemented.");
}

function buildResumeDataPreamble(resume: any, profile: any) {
  const safeResume = resume || {};
  const safeProfile = profile || {};
  const header = getHeader(safeResume, safeProfile);
  const linkTuple = typstExprTuple(
    header.links.map((link) =>
      typstDict({
        label: typstString(link.label),
        url: typstString(withScheme(link.url)),
      }),
    ),
  );

  const skillsTuple = typstExprTuple(
    normalizeSkillGroups(safeResume.skills ?? safeProfile.skills).map((group) =>
      typstDict({
        category: typstString(group.category),
        items: typstTuple(group.items),
      }),
    ),
  );

  const pick = (key: string) =>
    Array.isArray(safeResume[key])
      ? safeResume[key]
      : Array.isArray(safeProfile[key])
        ? safeProfile[key]
        : [];

  const experienceTuple = typstExprTuple(
    pick("experience").map((item: any) =>
      typstDict({
        title: typstString(item?.title),
        company: typstString(item?.company),
        location: typstString(locationOf(item)),
        start: typstString(startDateOf(item)),
        end: typstString(endDateOf(item)),
        dates: typstString(dateRange(item, { openEnded: true })),
        bullets: typstTuple(bulletsOf(item)),
      }),
    ),
  );

  const projectsTuple = typstExprTuple(
    pick("projects").map((project: any) =>
      typstDict({
        name: typstString(project?.name),
        technologies: typstTuple(technologiesOf(project)),
        link: typstString(withScheme(project?.link)),
        dates: typstString(dateRange(project)),
        bullets: typstTuple(bulletsOf(project)),
      }),
    ),
  );

  const educationTuple = typstExprTuple(
    pick("education").map((item: any) =>
      typstDict({
        degree: typstString(item?.degree),
        major: typstString(item?.major),
        institution: typstString(item?.institution),
        location: typstString(locationOf(item)),
        start: typstString(startDateOf(item)),
        end: typstString(endDateOf(item)),
        dates: typstString(dateRange(item)),
      }),
    ),
  );

  const headerDict = typstDict({
    name: typstString(header.name),
    email: typstString(header.email),
    phone: typstString(header.phone),
    location: typstString(header.location),
    links: linkTuple,
  });

  return [
    "#let resume = (",
    `  header: ${headerDict},`,
    `  summary: ${typstString(text(safeResume.summary) || text(safeProfile.summary))},`,
    `  skills: ${skillsTuple},`,
    `  experience: ${experienceTuple},`,
    `  projects: ${projectsTuple},`,
    `  education: ${educationTuple},`,
    ")",
    "",
  ].join("\n");
}

function buildCoverLetterDataPreamble(
  coverLetter: any,
  profile: any,
  job: any,
) {
  const safeCover = coverLetter || {};
  const header = getHeader({}, profile || {});
  const linkTuple = typstExprTuple(
    header.links.map((link) =>
      typstDict({
        label: typstString(link.label),
        url: typstString(withScheme(link.url)),
      }),
    ),
  );

  const senderDict = typstDict({
    name: typstString(header.name),
    email: typstString(header.email),
    phone: typstString(header.phone),
    location: typstString(header.location),
    links: linkTuple,
  });

  const coverDict = typstDict({
    greeting: typstString(text(safeCover.greeting) || "Dear Hiring Manager,"),
    body_paragraphs: typstTuple(coverParagraphs(safeCover)),
    closing: typstString(text(safeCover.closing) || "Sincerely,"),
    signature_name: typstString(text(safeCover.signature_name) || header.name),
    recipient_name: typstString(safeCover.recipient_name),
    recipient_title: typstString(safeCover.recipient_title),
    company_name: typstString(job?.company),
    job_title: typstString(job?.title),
  });

  return [
    `#let sender = ${senderDict}`,
    `#let cover_letter = ${coverDict}`,
    "",
  ].join("\n");
}

export function buildCustomResumeTypstSource({
  templateSource,
  resume,
  profile,
}: {
  templateSource: string;
  resume: any;
  profile: any;
}) {
  const preamble = buildResumeDataPreamble(resume, profile);
  return `${preamble}\n${templateSource}`.trim();
}

export function buildCustomCoverLetterTypstSource({
  templateSource,
  coverLetter,
  profile,
  job,
}: {
  templateSource: string;
  coverLetter: any;
  profile: any;
  job: any;
}) {
  const preamble = buildCoverLetterDataPreamble(coverLetter, profile, job);
  return `${preamble}\n${templateSource}`.trim();
}
