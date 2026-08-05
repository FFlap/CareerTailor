export type ResumeLink = { label: string; url: string };

export type SkillGroup = { category: string; items: string[] };

export type ExperienceEntry = {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
};

export type ProjectEntry = {
  name: string;
  technologies: string[];
  link: string;
  bullets: string[];
};

export type EducationEntry = {
  degree: string;
  major: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
};

export type CustomLayout = "entries" | "bullets" | "inline";

export type CustomItem = {
  title: string;
  subtitle: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  bullets: string[];
};

export type CustomSection = {
  id: string;
  title: string;
  layout: CustomLayout;
  items: CustomItem[];
};

export type ResumeData = {
  header: {
    name: string;
    email: string;
    phone: string;
    location: string;
    links: ResumeLink[];
  };
  summary: string;
  skills: SkillGroup[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  customSections: CustomSection[];
  sectionOrder: string[];
};

export type CoverLetterData = {
  greeting: string;
  body_paragraphs: string[];
  closing: string;
  signature_name: string;
};

export const BUILT_IN_SECTIONS = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
] as const;

export type BuiltInSection = (typeof BUILT_IN_SECTIONS)[number];

export const SECTION_LABELS: Record<BuiltInSection, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
};

export const EMPTY_RESUME: ResumeData = {
  header: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
  customSections: [],
  sectionOrder: [...BUILT_IN_SECTIONS],
};

export const EMPTY_COVER: CoverLetterData = {
  greeting: "",
  body_paragraphs: [""],
  closing: "",
  signature_name: "",
};

export function ensureString(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(ensureString) : [];
}

export function newSectionId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `s${random}`;
}

export function customKey(id: string) {
  return `custom:${id}`;
}

/**
 * Every section key, in the user's order. Used for bookkeeping — what the editor
 * shows comes from `resolveSectionOrder`, which defers to the template.
 */
export function sectionOrderOf(resume: ResumeData) {
  const available = [
    ...BUILT_IN_SECTIONS,
    ...resume.customSections.map((section) => customKey(section.id)),
  ];
  const taken = new Set<string>();
  const ordered: string[] = [];
  for (const key of [...resume.sectionOrder, ...available]) {
    if (!available.includes(key) || taken.has(key)) continue;
    taken.add(key);
    ordered.push(key);
  }
  return ordered;
}

export function normalizeResumeData(input: any): ResumeData {
  const raw = input?.resume ?? input ?? {};
  const header = raw.header ?? {};

  const links: ResumeLink[] = Array.isArray(header.links)
    ? header.links.map((link: any) => ({
        label: ensureString(link?.label),
        url: ensureString(link?.url),
      }))
    : [];

  const skills: SkillGroup[] = Array.isArray(raw.skills)
    ? raw.skills.map((skill: any) => ({
        category: ensureString(skill?.category),
        items: stringList(skill?.items),
      }))
    : [];

  const experience: ExperienceEntry[] = Array.isArray(raw.experience)
    ? raw.experience.map((exp: any) => ({
        title: ensureString(exp?.title),
        company: ensureString(exp?.company),
        location: ensureString(exp?.location),
        startDate: ensureString(exp?.startDate),
        endDate: ensureString(exp?.endDate),
        bullets: stringList(exp?.bullets),
      }))
    : [];

  const projects: ProjectEntry[] = Array.isArray(raw.projects)
    ? raw.projects.map((proj: any) => ({
        name: ensureString(proj?.name),
        technologies: stringList(proj?.technologies),
        link: ensureString(proj?.link),
        bullets: stringList(proj?.bullets),
      }))
    : [];

  const education: EducationEntry[] = Array.isArray(raw.education)
    ? raw.education.map((edu: any) => ({
        degree: ensureString(edu?.degree),
        major: ensureString(edu?.major),
        institution: ensureString(edu?.institution),
        location: ensureString(edu?.location),
        startDate: ensureString(edu?.startDate),
        endDate: ensureString(edu?.endDate),
      }))
    : [];

  const customSections: CustomSection[] = Array.isArray(raw.customSections)
    ? raw.customSections.map((section: any, index: number) => ({
        id: ensureString(section?.id) || `section-${index + 1}`,
        title: ensureString(section?.title),
        layout:
          section?.layout === "bullets" || section?.layout === "inline"
            ? section.layout
            : "entries",
        items: Array.isArray(section?.items)
          ? section.items.map((item: any) => ({
              title: ensureString(item?.title),
              subtitle: ensureString(item?.subtitle),
              location: ensureString(item?.location),
              startDate: ensureString(item?.startDate),
              endDate: ensureString(item?.endDate),
              description: ensureString(item?.description),
              bullets: stringList(item?.bullets),
            }))
          : [],
      }))
    : [];

  const resume: ResumeData = {
    header: {
      name: ensureString(header?.name),
      email: ensureString(header?.email),
      phone: ensureString(header?.phone),
      location: ensureString(header?.location),
      links,
    },
    summary: ensureString(raw.summary),
    skills,
    experience,
    projects,
    education,
    customSections,
    sectionOrder: Array.isArray(raw.sectionOrder)
      ? raw.sectionOrder.map(ensureString)
      : [],
  };

  return resume;
}

export function normalizeCoverLetterData(input: any): CoverLetterData {
  const raw = input?.cover_letter ?? input ?? {};
  const body = Array.isArray(raw.body_paragraphs)
    ? raw.body_paragraphs.map(ensureString)
    : [];
  return {
    greeting: ensureString(raw.greeting),
    body_paragraphs: body.length ? body : [""],
    closing: ensureString(raw.closing),
    signature_name: ensureString(raw.signature_name),
  };
}

/** Every disclosure key in a resume, so "Expand all" can reach the items too. */
export function resumeDisclosureKeys(resume: ResumeData) {
  const keys = ["contact", "links"];
  keys.push(...resume.header.links.map((_, index) => `links:${index}`));
  for (const key of sectionOrderOf(resume)) {
    keys.push(key);
    if (key === "summary") continue;
    if (key.startsWith("custom:")) {
      const section = resume.customSections.find(
        (candidate) => customKey(candidate.id) === key,
      );
      if (section?.layout === "entries") {
        keys.push(...section.items.map((_, index) => `${key}:${index}`));
      }
      continue;
    }
    const list =
      resume[key as "skills" | "experience" | "projects" | "education"];
    keys.push(...list.map((_, index) => `${key}:${index}`));
  }
  return keys;
}

export function coverDisclosureKeys(cover: CoverLetterData) {
  return [
    "greeting",
    "body",
    ...cover.body_paragraphs.map((_, index) => `body:${index}`),
    "signoff",
  ];
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

export function replaceAt<T>(list: T[], index: number, value: T): T[] {
  const next = [...list];
  next[index] = value;
  return next;
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, idx) => idx !== index);
}

/**
 * Links the templates know how to typeset. `prefix` is the part of the URL the
 * user should never have to type; what they type is the handle after it.
 */
export type LinkPlatform = {
  id: string;
  label: string;
  prefix: string;
  placeholder: string;
};

export const LINK_PLATFORMS: LinkPlatform[] = [
  {
    id: "github",
    label: "GitHub",
    prefix: "github.com/",
    placeholder: "username",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    prefix: "linkedin.com/in/",
    placeholder: "username",
  },
  { id: "x", label: "X", prefix: "x.com/", placeholder: "handle" },
  {
    id: "gitlab",
    label: "GitLab",
    prefix: "gitlab.com/",
    placeholder: "username",
  },
  {
    id: "bitbucket",
    label: "Bitbucket",
    prefix: "bitbucket.org/",
    placeholder: "username",
  },
  {
    id: "mastodon",
    label: "Mastodon",
    prefix: "mastodon.social/@",
    placeholder: "handle",
  },
  {
    id: "stackoverflow",
    label: "Stack Overflow",
    prefix: "stackoverflow.com/users/",
    placeholder: "1234567/you",
  },
  {
    id: "scholar",
    label: "Google Scholar",
    prefix: "scholar.google.com/citations?user=",
    placeholder: "profile id",
  },
  { id: "orcid", label: "ORCID", prefix: "orcid.org/", placeholder: "0000-…" },
  {
    id: "kaggle",
    label: "Kaggle",
    prefix: "kaggle.com/",
    placeholder: "username",
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    prefix: "huggingface.co/",
    placeholder: "username",
  },
  {
    id: "medium",
    label: "Medium",
    prefix: "medium.com/@",
    placeholder: "username",
  },
  { id: "devto", label: "Dev.to", prefix: "dev.to/", placeholder: "username" },
  {
    id: "dribbble",
    label: "Dribbble",
    prefix: "dribbble.com/",
    placeholder: "username",
  },
  {
    id: "behance",
    label: "Behance",
    prefix: "behance.net/",
    placeholder: "username",
  },
  {
    id: "youtube",
    label: "YouTube",
    prefix: "youtube.com/@",
    placeholder: "channel",
  },
  {
    id: "website",
    label: "Personal site",
    prefix: "",
    placeholder: "you.dev",
  },
  { id: "other", label: "Other", prefix: "", placeholder: "example.com/you" },
];

export function bareUrl(url: string) {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
}

/** Which platform a stored link belongs to, by URL first and label second. */
export function platformOf(link: ResumeLink): LinkPlatform {
  const cleaned = bareUrl(link.url).toLowerCase();
  if (cleaned) {
    const byUrl = LINK_PLATFORMS.filter((platform) => platform.prefix)
      .filter((platform) => cleaned.startsWith(platform.prefix.toLowerCase()))
      .sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (byUrl) return byUrl;
  }
  const label = link.label.trim().toLowerCase();
  const byLabel = LINK_PLATFORMS.find(
    (platform) => platform.label.toLowerCase() === label,
  );
  if (byLabel) return byLabel;
  // Nothing recognisable: the user is naming this one themselves.
  return LINK_PLATFORMS.find((platform) => platform.id === "other")!;
}

export function handleOf(link: ResumeLink, platform: LinkPlatform) {
  const cleaned = bareUrl(link.url);
  if (!platform.prefix) return cleaned;
  return cleaned.toLowerCase().startsWith(platform.prefix.toLowerCase())
    ? cleaned.slice(platform.prefix.length)
    : cleaned;
}

export function linkFor(platform: LinkPlatform, handle: string): ResumeLink {
  const trimmed = handle.trim();
  const label = platform.id === "other" ? "" : platform.label;
  if (!trimmed) return { label, url: "" };
  if (!platform.prefix) return { label, url: bareUrl(trimmed) };
  return { label, url: `${platform.prefix}${bareUrl(trimmed)}` };
}

/** A new link starts on the first platform the resume is not already using. */
export function nextUnusedPlatform(links: ResumeLink[]): LinkPlatform {
  const used = new Set(links.map((link) => platformOf(link).id));
  const preferred = ["github", "linkedin", "website", "x"];
  for (const id of preferred) {
    if (!used.has(id)) return LINK_PLATFORMS.find((p) => p.id === id)!;
  }
  return (
    LINK_PLATFORMS.find(
      (platform) => platform.id !== "other" && !used.has(platform.id),
    ) ?? LINK_PLATFORMS[LINK_PLATFORMS.length - 1]
  );
}

export type SectionPreset = {
  id: string;
  title: string;
  layout: CustomLayout;
  hint: string;
};

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: "certifications",
    title: "Certifications",
    layout: "entries",
    hint: "Name, issuer, dates",
  },
  {
    id: "awards",
    title: "Awards",
    layout: "entries",
    hint: "Name, awarding body, dates",
  },
  {
    id: "publications",
    title: "Publications",
    layout: "entries",
    hint: "Title, venue, dates",
  },
  {
    id: "volunteering",
    title: "Volunteering",
    layout: "entries",
    hint: "Role, organisation, dates",
  },
  {
    id: "speaking",
    title: "Speaking",
    layout: "bullets",
    hint: "One talk per line",
  },
  {
    id: "courses",
    title: "Courses",
    layout: "bullets",
    hint: "One course per line",
  },
  {
    id: "languages",
    title: "Languages",
    layout: "inline",
    hint: "Comma separated, one line",
  },
  {
    id: "interests",
    title: "Interests",
    layout: "inline",
    hint: "Comma separated, one line",
  },
];

export const LAYOUT_LABELS: Record<CustomLayout, string> = {
  entries: "Entries",
  bullets: "Bullet list",
  inline: "Inline list",
};

export const LAYOUT_HINTS: Record<CustomLayout, string> = {
  entries: "Each item gets a heading, dates and bullets — like Experience.",
  bullets: "Each item is one bullet.",
  inline: "Items run together on one line, separated by ·.",
};

export function emptyCustomItem(): CustomItem {
  return {
    title: "",
    subtitle: "",
    location: "",
    startDate: "",
    endDate: "",
    description: "",
    bullets: [],
  };
}
