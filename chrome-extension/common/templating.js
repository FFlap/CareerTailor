import { escapeLatex, escapeTypst, formatDateRange, joinNonEmpty } from "./utils.js";

function normalizeLinks(links = []) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (!link) return "";
      if (typeof link === "string") return link.trim();
      const label = link.label ? String(link.label).trim() : "";
      const url = link.url ? String(link.url).trim() : "";
      if (label && url) return `${label}: ${url}`;
      return url || label;
    })
    .filter(Boolean);
}

function formatSkillsTypst(skills = []) {
  if (!skills.length) return "";
  if (typeof skills[0] === "string") {
    return skills.map((skill) => `- ${escapeTypst(skill)}`).join("\n");
  }
  return skills
    .map((group) => {
      const title = escapeTypst(group.category || "Skills");
      const items = Array.isArray(group.items) ? group.items.map(escapeTypst).join(", ") : "";
      return `- *${title}:* ${items}`.trim();
    })
    .join("\n");
}

function formatExperienceTypst(experience = []) {
  return experience
    .map((role) => {
      const title = escapeTypst(role.title || "");
      const company = escapeTypst(role.company || "");
      const location = escapeTypst(role.location || "");
      const dates = escapeTypst(formatDateRange(role.start_date || role.startDate, role.end_date || role.endDate));
      const header = joinNonEmpty([
        title && `*${title}*`,
        company,
        location
      ], " | ");
      const bullets = Array.isArray(role.bullets)
        ? role.bullets.map((bullet) => `- ${escapeTypst(bullet)}`).join("\n")
        : "";
      return [header, dates, bullets].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function formatProjectsTypst(projects = []) {
  return projects
    .map((project) => {
      const name = escapeTypst(project.name || "");
      const tech = Array.isArray(project.technologies)
        ? project.technologies.map(escapeTypst).join(", ")
        : "";
      const link = escapeTypst(project.link || "");
      const header = joinNonEmpty([
        name && `*${name}*`,
        tech,
        link
      ]);
      const bullets = Array.isArray(project.bullets)
        ? project.bullets.map((bullet) => `- ${escapeTypst(bullet)}`).join("\n")
        : "";
      return [header, bullets].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function formatEducationTypst(education = []) {
  return education
    .map((item) => {
      const degree = escapeTypst(item.degree || "");
      const major = escapeTypst(item.major || "");
      const institution = escapeTypst(item.institution || "");
      const location = escapeTypst(item.location || item.country || "");
      const dates = escapeTypst(formatDateRange(item.start_date || item.startDate, item.end_date || item.endDate));
      const header = joinNonEmpty([
        degree && `*${degree}*`,
        major,
        institution,
        location
      ]);
      return [header, dates].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function fillTemplate(template, data) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return data[key] ?? "";
  });
}

export function renderResumeTemplate(templateText, resumeData) {
  const header = resumeData.header || {};
  const contactLine = joinNonEmpty([
    header.email,
    header.phone,
    header.location,
    ...(normalizeLinks(header.links))
  ], " | ");

  const data = {
    name: escapeTypst(header.name || ""),
    contact_line: escapeTypst(contactLine),
    summary: escapeTypst(resumeData.summary || ""),
    skills: formatSkillsTypst(resumeData.skills || []),
    experience: formatExperienceTypst(resumeData.experience || []),
    projects: formatProjectsTypst(resumeData.projects || []),
    education: formatEducationTypst(resumeData.education || [])
  };

  return fillTemplate(templateText, data);
}

export function renderCoverLetterTypst(templateText, coverData) {
  const body = Array.isArray(coverData.body_paragraphs)
    ? coverData.body_paragraphs.map((p) => escapeTypst(p)).join("\n\n")
    : "";
  const data = {
    greeting: escapeTypst(coverData.greeting || ""),
    body_paragraphs: body,
    closing: escapeTypst(coverData.closing || ""),
    signature_name: escapeTypst(coverData.signature_name || "")
  };
  return fillTemplate(templateText, data);
}

export function renderCoverLetterLatex(templateText, coverData) {
  const body = Array.isArray(coverData.body_paragraphs)
    ? coverData.body_paragraphs.map((p) => escapeLatex(p)).join("\n\n")
    : "";
  const data = {
    greeting: escapeLatex(coverData.greeting || ""),
    body_paragraphs: body,
    closing: escapeLatex(coverData.closing || ""),
    signature_name: escapeLatex(coverData.signature_name || "")
  };
  return fillTemplate(templateText, data);
}
