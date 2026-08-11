import type { ResumeData } from "@/components/editor/model";
import { customKey } from "@/components/editor/model";

export type ReviewSeverity = "minor" | "major";

export type ReviewComment = {
  id: number;
  quote: string;
  comment: string;
  fix: string;
  severity: ReviewSeverity;
  section: string;
  /** The entry this note is about, e.g. "Business Analyst · StackDX". */
  area?: string;
};

/** Résumé order, so the notes read down the page the way the document does. */
export const SECTION_ORDER = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "formatting",
  "other",
] as const;

export const REVIEW_SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  formatting: "Formatting",
  other: "Other",
};

export type ReviewArea = {
  key: string;
  label: string;
  notes: ReviewComment[];
  major: number;
};

export type ReviewGroup = {
  section: string;
  label: string;
  areas: ReviewArea[];
  total: number;
  major: number;
};

/**
 * Groups notes the way the editor is shaped: section, then the entry inside it.
 * Notes with no named entry collect under one "Overall" area for that section.
 */
export function groupComments(comments: ReviewComment[]): ReviewGroup[] {
  const bySection = new Map<string, Map<string, ReviewComment[]>>();

  for (const comment of comments) {
    const section = REVIEW_SECTION_LABELS[comment.section] ? comment.section : "other";
    const area = (comment.area ?? "").trim();
    if (!bySection.has(section)) bySection.set(section, new Map());
    const areas = bySection.get(section)!;
    if (!areas.has(area)) areas.set(area, []);
    areas.get(area)!.push(comment);
  }

  const ordered = [...bySection.keys()].sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a as (typeof SECTION_ORDER)[number]);
    const bi = SECTION_ORDER.indexOf(b as (typeof SECTION_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return ordered.map((section) => {
    const areaMap = bySection.get(section)!;
    const areas: ReviewArea[] = [...areaMap.entries()]
      // The section-wide notes belong last, after the specific entries.
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0))
      .map(([area, notes]) => ({
        key: `${section}|${area}`,
        label: area || "Overall",
        notes,
        major: countMajor(notes),
      }));

    const total = areas.reduce((sum, area) => sum + area.notes.length, 0);
    return {
      section,
      label: REVIEW_SECTION_LABELS[section] ?? "Other",
      areas,
      total,
      major: areas.reduce((sum, area) => sum + area.major, 0),
    };
  });
}

export type ReviewMetric = { score: number | null; note: string };

export type ReviewMetrics = Record<MetricKey, ReviewMetric>;

export type SavedReview = {
  _id: string;
  documentId?: string;
  source: "document" | "upload";
  label: string;
  summary: string;
  overall: number;
  metrics: ReviewMetrics;
  comments: ReviewComment[];
  jobDescription?: string;
  createdAt: number;
  fileUrl?: string | null;
};

export const METRIC_KEYS = [
  "ats",
  "readability",
  "impact",
  "keywords",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  ats: "ATS format",
  readability: "Readability",
  impact: "Impact",
  keywords: "Keyword match",
};

/** A word for the score, so the number is not the only thing carrying meaning. */
export function scoreVerdict(score: number) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Solid";
  if (score >= 50) return "Uneven";
  return "Weak";
}

export function countMajor(comments: ReviewComment[]) {
  return comments.filter((comment) => comment.severity === "major").length;
}

export function formatReviewDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date(timestamp).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

export type QuoteLocation = {
  /** Section anchor in the fields pane, e.g. `section-experience`. */
  domId: string;
  /** Disclosure keys to open before scrolling, outermost first. */
  keys: string[];
};

function includesQuote(haystack: string, quote: string) {
  if (!haystack || !quote) return false;
  const a = haystack.toLowerCase().replace(/\s+/g, " ").trim();
  const b = quote.toLowerCase().replace(/\s+/g, " ").trim();
  if (!b) return false;
  return a.includes(b) || b.includes(a);
}

const ENTRY_SECTIONS = ["experience", "projects", "education"] as const;

/**
 * Finds where a quoted line lives in the résumé so a comment can open the field
 * that produced it. Falls back to the section the model named.
 */
export function locateQuote(
  resume: ResumeData | null,
  comment: ReviewComment,
): QuoteLocation | null {
  if (!resume) return null;
  const quote = comment.quote?.trim();

  if (quote) {
    if (includesQuote(resume.summary, quote)) {
      return { domId: "section-summary", keys: ["summary"] };
    }

    for (const section of ENTRY_SECTIONS) {
      const entries = resume[section] as Array<Record<string, any>>;
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const haystack = [
          entry.title,
          entry.company,
          entry.name,
          entry.degree,
          entry.major,
          entry.institution,
          ...(Array.isArray(entry.bullets) ? entry.bullets : []),
        ]
          .filter(Boolean)
          .map(String);
        if (haystack.some((value) => includesQuote(value, quote))) {
          return {
            domId: `section-${section}`,
            keys: [section, `${section}:${index}`],
          };
        }
      }
    }

    for (let index = 0; index < resume.skills.length; index += 1) {
      const group = resume.skills[index];
      const haystack = [group.category, ...group.items].filter(Boolean);
      if (haystack.some((value) => includesQuote(value, quote))) {
        return { domId: "section-skills", keys: ["skills", `skills:${index}`] };
      }
    }

    for (const section of resume.customSections) {
      const key = customKey(section.id);
      const haystack = section.items.flatMap((item) => [
        item.title,
        item.subtitle,
        item.description,
        ...item.bullets,
      ]);
      if (haystack.some((value) => includesQuote(value, quote))) {
        return { domId: `section-${key}`, keys: [key] };
      }
    }

    const header = resume.header;
    const contact = [header.name, header.email, header.phone, header.location];
    if (contact.some((value) => includesQuote(value, quote))) {
      return { domId: "section-contact", keys: ["contact"] };
    }
  }

  const named = comment.section;
  if (named === "summary") return { domId: "section-summary", keys: ["summary"] };
  if ((ENTRY_SECTIONS as readonly string[]).includes(named)) {
    return { domId: `section-${named}`, keys: [named] };
  }
  if (named === "skills") return { domId: "section-skills", keys: ["skills"] };
  return null;
}
