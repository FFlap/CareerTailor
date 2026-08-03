/**
 * Page-count enforcement: compile what was produced, count the pages, and trim
 * until it fits. Deterministic, and never by asking a model to shorten anything.
 */

type ResumeData = Record<string, any>;

/** How much material the profile actually holds, in printable units. */
export type ContentEstimate = {
  units: number;
  roles: number;
  bullets: number;
  projects: number;
  /** Two pages needs roughly this much to avoid ending in white space. */
  unitsForTwoPages: number;
  canFillTwoPages: boolean;
};

const UNITS_FOR_TWO_PAGES = 30;

export function estimateContent(profile: any): ContentEstimate {
  const experience = Array.isArray(profile?.experience) ? profile.experience : [];
  const projects = Array.isArray(profile?.projects) ? profile.projects : [];
  const education = Array.isArray(profile?.education) ? profile.education : [];
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];

  const countBullets = (items: any[]) =>
    items.reduce(
      (total, item) =>
        total + (Array.isArray(item?.bullets) ? item.bullets.length : 0),
      0,
    );

  const bullets = countBullets(experience) + countBullets(projects);
  // A heading costs about as much vertical space as a bullet, so both count as
  // one unit; skills and education are a line apiece.
  const units =
    experience.length +
    projects.length +
    bullets +
    education.length +
    skills.length +
    (profile?.summary ? 2 : 0);

  return {
    units,
    roles: experience.length,
    bullets,
    projects: projects.length,
    unitsForTwoPages: UNITS_FOR_TWO_PAGES,
    canFillTwoPages: units >= UNITS_FOR_TWO_PAGES,
  };
}

export function describeCapacity(estimate: ContentEstimate) {
  const parts = [
    `${estimate.roles} role${estimate.roles === 1 ? "" : "s"}`,
    `${estimate.bullets} bullet${estimate.bullets === 1 ? "" : "s"}`,
  ];
  if (estimate.projects) {
    parts.push(`${estimate.projects} project${estimate.projects === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

/**
 * One trim, chosen to lose the least. Returns null once there is nothing left
 * to remove without gutting the document.
 */
function trimOnce(resume: ResumeData): ResumeData | null {
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];

  const bulletsOf = (item: any) =>
    Array.isArray(item?.bullets) ? item.bullets : [];

  // 1. Trim the longest role down, keeping at least two bullets each.
  const roleIndex = experience.reduce(
    (best: number, role: any, index: number) =>
      bulletsOf(role).length > bulletsOf(experience[best]).length ? index : best,
    0,
  );
  if (experience.length && bulletsOf(experience[roleIndex]).length > 2) {
    const next = experience.map((role: any, index: number) =>
      index === roleIndex
        ? { ...role, bullets: bulletsOf(role).slice(0, -1) }
        : role,
    );
    return { ...resume, experience: next };
  }

  // 2. Then project bullets, keeping at least one each.
  const projectIndex = projects.reduce(
    (best: number, project: any, index: number) =>
      bulletsOf(project).length > bulletsOf(projects[best]).length ? index : best,
    0,
  );
  if (projects.length && bulletsOf(projects[projectIndex]).length > 1) {
    const next = projects.map((project: any, index: number) =>
      index === projectIndex
        ? { ...project, bullets: bulletsOf(project).slice(0, -1) }
        : project,
    );
    return { ...resume, projects: next };
  }

  // 3. Then whole projects, newest kept.
  if (projects.length > 1) {
    return { ...resume, projects: projects.slice(0, -1) };
  }

  // 4. Then the oldest role, never the only one.
  if (experience.length > 1) {
    return { ...resume, experience: experience.slice(0, -1) };
  }

  return null;
}

/** Reads the page count out of compiled PDF bytes. */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages = pdf.numPages;
  await pdf.destroy();
  return pages;
}

export type FitResult = {
  data: ResumeData;
  pages: number;
  /** How many trims were applied; 0 means it already fit. */
  trims: number;
  /** True when it still overflows after everything trimmable was trimmed. */
  overflows: boolean;
};

/** Measures, trims, repeats. `measure` is injected so the loop is testable. */
export async function fitResumeToPages({
  data,
  maxPages,
  measure,
  limit = 12,
}: {
  data: ResumeData;
  maxPages: number;
  measure: (data: ResumeData) => Promise<number>;
  limit?: number;
}): Promise<FitResult> {
  let current = data;
  let trims = 0;

  for (let attempt = 0; attempt <= limit; attempt += 1) {
    const pages = await measure(current);
    if (pages <= maxPages) {
      return { data: current, pages, trims, overflows: false };
    }
    const trimmed = trimOnce(current);
    if (!trimmed) {
      return { data: current, pages, trims, overflows: true };
    }
    current = trimmed;
    trims += 1;
  }

  const pages = await measure(current);
  return { data: current, pages, trims, overflows: pages > maxPages };
}
