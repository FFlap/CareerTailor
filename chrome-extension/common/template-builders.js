import { escapeTypst, formatDateRange, joinNonEmpty } from "./utils.js";

function typstString(value) {
  const safe = escapeTypst(value ?? "").replace(/\"/g, "\\\"");
  return `"${safe}"`;
}

function normalizeLinks(links = []) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (!link) return null;
      if (typeof link === "string") {
        return { label: "", url: link.trim() };
      }
      const label = link.label ? String(link.label).trim() : "";
      const url = link.url ? String(link.url).trim() : "";
      return { label, url };
    })
    .filter((link) => link && (link.label || link.url));
}

function getHeader(resume = {}, profile = {}) {
  const header = resume.header || {};
  const personal = profile.personal || {};
  return {
    name: header.name || personal.fullName || "",
    email: header.email || personal.email || "",
    phone: header.phone || personal.phone || "",
    location: header.location || personal.location || "",
    links: header.links && header.links.length ? header.links : personal.links || []
  };
}

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function linkMatches(link, needle) {
  const target = String(needle || "").toLowerCase();
  if (!target) return false;
  const haystack = `${link.label || ""} ${link.url || ""}`.toLowerCase();
  return haystack.includes(target);
}

function findLink(links, needle) {
  return links.find((link) => linkMatches(link, needle))?.url || "";
}

function firstNonSocialLink(links) {
  const blocked = ["github.com", "linkedin.com", "twitter.com", "x.com", "gitlab.com", "bitbucket.org"];
  const match = links.find((link) => {
    if (!link.url) return false;
    const lower = link.url.toLowerCase();
    return !blocked.some((host) => lower.includes(host));
  });
  return match?.url || "";
}

function extractUsername(url, host) {
  if (!url) return "";
  const cleaned = String(url)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  if (!cleaned.startsWith(host)) return "";
  const path = cleaned.slice(host.length).replace(/^\//, "");
  return path.split(/[/?#]/)[0] || "";
}

function formatBullets(bullets = []) {
  if (!Array.isArray(bullets)) return "";
  return bullets
    .map((bullet) => bullet && `- ${escapeTypst(bullet)}`)
    .filter(Boolean)
    .join("\n");
}

function normalizeSkillGroups(skills = []) {
  if (typeof skills === "string") {
    return [{
      category: "Skills",
      items: skills.split(/,|\n/).map((item) => item.trim()).filter(Boolean)
    }];
  }
  if (!Array.isArray(skills) || !skills.length) return [];
  if (typeof skills[0] === "string") {
    return [{ category: "Skills", items: skills }];
  }
  return skills.map((group) => ({
    category: group.category || group.name || "Skills",
    items: Array.isArray(group.items) ? group.items : []
  }));
}

function typstTuple(items = []) {
  const safe = items
    .map((item) => (item ? typstString(item) : ""))
    .filter(Boolean);
  return `(${safe.join(", ")})`;
}

function formatDateRangeText(start, end) {
  return formatDateRange(start || "", end || "");
}

function parseDateParts(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate() || 1
  };
}

function buildTypstDateExpr(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return '""';
  if (/present/i.test(trimmed)) return '"Present"';
  const parts = parseDateParts(trimmed);
  if (!parts) return typstString(trimmed);
  return `datetime(year: ${parts.year}, month: ${parts.month}, day: ${parts.day})`;
}

function buildPositions(resume = {}) {
  return (resume.experience || [])
    .map((role) => role.title)
    .filter(Boolean)
    .slice(0, 3);
}

function buildKeywords(skills = []) {
  const flat = Array.isArray(skills)
    ? skills.flatMap((item) => (typeof item === "string" ? [item] : item.items || []))
    : [];
  return flat.filter(Boolean).slice(0, 4);
}

function buildBasicResumeSource(resume, profile) {
  const header = getHeader(resume, profile);
  const links = normalizeLinks(header.links);
  const github = findLink(links, "github");
  const linkedin = findLink(links, "linkedin");
  const website = firstNonSocialLink(links);
  const education = (resume.education || []).map((item) => {
    const degree = joinNonEmpty([item.degree, item.major], ", ");
    const entry = [
      "#edu(",
      `  institution: ${typstString(item.institution || "")},`,
      `  location: ${typstString(item.location || item.country || "")},`,
      `  dates: dates-helper(start-date: ${typstString(item.start_date || item.startDate || "")}, end-date: ${typstString(item.end_date || item.endDate || "")}),`,
      `  degree: ${typstString(degree)}`,
      ")"
    ].join("\n");
    return entry;
  }).join("\n\n");

  const experience = (resume.experience || []).map((role) => {
    const bullets = formatBullets(role.bullets);
    return [
      "#work(",
      `  title: ${typstString(role.title || "")},`,
      `  location: ${typstString(role.location || "")},`,
      `  company: ${typstString(role.company || "")},`,
      `  dates: dates-helper(start-date: ${typstString(role.start_date || role.startDate || "")}, end-date: ${typstString(role.end_date || role.endDate || "")})`,
      ")",
      bullets
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const projects = (resume.projects || []).map((project) => {
    const bullets = formatBullets(project.bullets);
    return [
      "#project(",
      `  name: ${typstString(project.name || "")},`,
      `  role: ${typstString(project.role || "")},`,
      `  dates: dates-helper(start-date: ${typstString(project.start_date || project.startDate || "")}, end-date: ${typstString(project.end_date || project.endDate || "")}),`,
      `  url: ${typstString(project.link || "")}`,
      ")",
      bullets
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const skillGroups = normalizeSkillGroups(resume.skills);
  const skills = skillGroups
    .map((group) => {
      const items = Array.isArray(group.items) ? group.items.map((item) => escapeTypst(item)).join(", ") : "";
      return `- *${escapeTypst(group.category)}:* ${items}`.trim();
    })
    .filter(Boolean)
    .join("\n");

  return [
    "#import \"@preview/basic-resume:0.2.9\": *",
    "",
    `#let name = ${typstString(header.name)}`,
    `#let location = ${typstString(header.location)}`,
    `#let email = ${typstString(header.email)}`,
    `#let github = ${typstString(github)}`,
    `#let linkedin = ${typstString(linkedin)}`,
    `#let phone = ${typstString(header.phone)}`,
    `#let personal-site = ${typstString(website)}`,
    "",
    "#show: resume.with(",
    "  author: name,",
    "  location: location,",
    "  email: email,",
    "  github: github,",
    "  linkedin: linkedin,",
    "  phone: phone,",
    "  personal-site: personal-site,",
    "  accent-color: \"#26428b\"",
    ")",
    "",
    education ? "== Education" : "",
    education,
    "",
    experience ? "== Work Experience" : "",
    experience,
    "",
    projects ? "== Projects" : "",
    projects,
    "",
    skills ? "== Skills" : "",
    skills
  ].filter((line) => line !== "").join("\n");
}

function buildSimpleTechnicalResumeSource(resume, profile) {
  const header = getHeader(resume, profile);
  const links = normalizeLinks(header.links);
  const githubUser = extractUsername(findLink(links, "github.com"), "github.com") || findLink(links, "github");
  const linkedinUser = extractUsername(findLink(links, "linkedin.com"), "linkedin.com") || findLink(links, "linkedin");
  const website = firstNonSocialLink(links);
  const education = (resume.education || []).map((item) => {
    return [
      "#education-heading(",
      `  ${typstString(item.institution || "")}, ${typstString(item.location || item.country || "")},`,
      `  ${typstString(item.degree || "")}, ${typstString(item.major || "")},`,
      `  ${buildTypstDateExpr(item.start_date || item.startDate)},`,
      `  ${buildTypstDateExpr(item.end_date || item.endDate)}`,
      ")[",
      formatBullets(item.bullets),
      "]"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const experience = (resume.experience || []).map((role) => {
    return [
      "#work-heading(",
      `  ${typstString(role.title || "")},`,
      `  ${typstString(role.company || "")},`,
      `  ${typstString(role.location || "")},`,
      `  ${buildTypstDateExpr(role.start_date || role.startDate)},`,
      `  ${buildTypstDateExpr(role.end_date || role.endDate || "Present")}`,
      ")[",
      formatBullets(role.bullets),
      "]"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const projects = (resume.projects || []).map((project) => {
    return [
      "#project-heading(",
      `  ${typstString(project.name || "")}`,
      ")[",
      formatBullets(project.bullets),
      "]"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const skillGroups = normalizeSkillGroups(resume.skills);
  const skills = skillGroups
    .map((group) => {
      const items = Array.isArray(group.items) ? group.items.map((item) => escapeTypst(item)).join(", ") : "";
      return `- *${escapeTypst(group.category)}:* ${items}`.trim();
    })
    .filter(Boolean)
    .join("\n");

  return [
    "#import \"@preview/simple-technical-resume:0.1.1\": *",
    "",
    `#let name = ${typstString(header.name)}`,
    `#let phone = ${typstString(header.phone)}`,
    `#let email = ${typstString(header.email)}`,
    `#let github = ${typstString(githubUser)}`,
    `#let linkedin = ${typstString(linkedinUser)}`,
    `#let personal-site = ${typstString(website)}`,
    "",
    "#show: resume.with(",
    "  top-margin: 0.45in,",
    "  personal-info-font-size: 9.2pt,",
    "  author-position: center,",
    "  personal-info-position: center,",
    "  author-name: name,",
    "  phone: phone,",
    "  email: email,",
    "  website: personal-site,",
    "  linkedin-user-id: linkedin,",
    "  github-username: github",
    ")",
    "",
    education ? "#custom-title(\"Education\")[" : "",
    education,
    education ? "]" : "",
    "",
    experience ? "#custom-title(\"Experience\")[" : "",
    experience,
    experience ? "]" : "",
    "",
    projects ? "#custom-title(\"Projects\")[" : "",
    projects,
    projects ? "]" : "",
    "",
    skills ? "#custom-title(\"Skills\")[" : "",
    skills ? "#skills()[" : "",
    skills,
    skills ? "]" : "",
    skills ? "]" : ""
  ].filter((line) => line !== "").join("\n");
}

function buildModernCvResumeSource(resume, profile) {
  const header = getHeader(resume, profile);
  const links = normalizeLinks(header.links);
  const { first, last } = splitName(header.name);
  const githubUser = extractUsername(findLink(links, "github.com"), "github.com");
  const linkedinUser = extractUsername(findLink(links, "linkedin.com"), "linkedin.com");
  const website = firstNonSocialLink(links) || findLink(links, "http");
  const positions = buildPositions(resume);
  const keywords = buildKeywords(resume.skills);
  const experience = (resume.experience || []).map((role) => {
    return [
      "#resume-entry(",
      `  title: ${typstString(role.title || "")},`,
      `  location: ${typstString(role.location || "")},`,
      `  date: ${typstString(formatDateRangeText(role.start_date || role.startDate, role.end_date || role.endDate))},`,
      `  description: ${typstString(role.company || "")}`,
      ")",
      "#resume-item[",
      formatBullets(role.bullets),
      "]"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const projects = (resume.projects || []).map((project) => {
    const projectLink = project.link ? `[${escapeTypst(project.link)}]` : "";
    return [
      "#resume-entry(",
      `  title: ${typstString(project.name || "")},`,
      `  location: ${projectLink || typstString("")},`,
      `  date: ${typstString(formatDateRangeText(project.start_date || project.startDate, project.end_date || project.endDate))},`,
      `  description: ${typstString(joinNonEmpty(project.technologies || [], ", "))}`,
      ")",
      "#resume-item[",
      formatBullets(project.bullets),
      "]"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const education = (resume.education || []).map((item) => {
    const degree = joinNonEmpty([item.degree, item.major], ", ");
    return [
      "#resume-entry(",
      `  title: ${typstString(item.institution || "")},`,
      `  location: ${typstString(item.location || item.country || "")},`,
      `  date: ${typstString(formatDateRangeText(item.start_date || item.startDate, item.end_date || item.endDate))},`,
      `  description: ${typstString(degree)}`,
      ")"
    ].join("\n");
  }).join("\n\n");

  const skillGroups = normalizeSkillGroups(resume.skills);
  const skills = skillGroups
    .map((group) => `#resume-skill-item(${typstString(group.category)}, ${typstTuple(group.items || [])})`)
    .join("\n");

  return [
    "#import \"@preview/modern-cv:0.9.0\": *",
    "",
    "#show: resume.with(",
    "  author: (",
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    `    email: ${typstString(header.email)},`,
    `    homepage: ${typstString(website)},`,
    `    phone: ${typstString(header.phone)},`,
    `    github: ${typstString(githubUser)},`,
    `    linkedin: ${typstString(linkedinUser)},`,
    `    address: ${typstString(header.location)},`,
    `    positions: ${typstTuple(positions)}`,
    "  ),",
    `  keywords: ${typstTuple(keywords)},`,
    `  description: ${typstString(`${header.name || ""} resume`)},`,
    "  profile-picture: image(\"profile.png\"),",
    "  date: datetime.today().display(),",
    "  language: \"en\"",
    ")",
    "",
    experience ? "= Professional Experience" : "",
    experience,
    "",
    projects ? "= Projects" : "",
    projects,
    "",
    skills ? "= Skills" : "",
    skills,
    "",
    education ? "= Education" : "",
    education
  ].filter((line) => line !== "").join("\n");
}

function buildNeatCvResumeSource(resume, profile) {
  const header = getHeader(resume, profile);
  const links = normalizeLinks(header.links);
  const { first, last } = splitName(header.name);
  const website = firstNonSocialLink(links) || findLink(links, "http");
  const linkedinUser = extractUsername(findLink(links, "linkedin.com"), "linkedin.com");
  const githubUser = extractUsername(findLink(links, "github.com"), "github.com");
  const positions = buildPositions(resume);
  const experience = (resume.experience || []).map((role) => {
    return [
      "#entry(",
      `  title: ${typstString(role.title || "")},`,
      `  date: ${typstString(formatDateRangeText(role.start_date || role.startDate, role.end_date || role.endDate))},`,
      `  institution: ${typstString(role.company || "")},`,
      `  location: ${typstString(role.location || "")}`,
      ")[",
      formatBullets(role.bullets),
      "]"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const education = (resume.education || []).map((item) => {
    const degree = joinNonEmpty([item.degree, item.major], ", ");
    return [
      "#entry(",
      `  title: ${typstString(degree)},`,
      `  date: ${typstString(formatDateRangeText(item.start_date || item.startDate, item.end_date || item.endDate))},`,
      `  institution: ${typstString(item.institution || "")},`,
      `  location: ${typstString(item.location || item.country || "")}`,
      ")[",
      "]"
    ].join("\n");
  }).join("\n\n");

  const skillGroups = normalizeSkillGroups(resume.skills);
  const skills = skillGroups.length
    ? `#item-pills(${typstTuple(skillGroups.flatMap((group) => group.items || []))})`
    : "";

  return [
    "#import \"@preview/neat-cv:0.6.0\": (", 
    "  contact-info, cv, email-link, entry, item-pills, item-with-level,", 
    "  publications, side, social-links", 
    ")",
    "",
    "#set text(lang: \"en\")",
    "",
    "#show: cv.with(",
    "  author: (",
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    `    email: ${typstString(header.email)},`,
    `    address: [${escapeTypst(header.location)}],`,
    `    phone: ${typstString(header.phone)},`,
    `    position: ${typstTuple(positions)},`,
    `    website: ${typstString(website)},`,
    `    linkedin: ${typstString(linkedinUser)},`,
    `    github: ${typstString(githubUser)}`,
    "  ),",
    "  profile-picture: image(\"profile.png\"),",
    "  accent-color: rgb(\"#4682b4\"),",
    "  header-color: rgb(\"#35414d\")",
    ")",
    "",
    "#side[",
    resume.summary ? "= About me" : "",
    resume.summary ? escapeTypst(resume.summary) : "",
    "= Contact",
    "#contact-info()",
    skills ? "= Skills" : "",
    skills,
    "]",
    "",
    experience ? "= Professional Experience" : "",
    experience,
    "",
    education ? "= Education" : "",
    education
  ].filter((line) => line !== "").join("\n");
}

function buildMetronicResumeSource(resume, profile) {
  const header = getHeader(resume, profile);
  const links = normalizeLinks(header.links);
  const website = firstNonSocialLink(links) || findLink(links, "http");
  const linkedinUser = extractUsername(findLink(links, "linkedin.com"), "linkedin.com");
  const summary = resume.summary ? escapeTypst(resume.summary) : "";
  const education = (resume.education || []).map((item) => {
    const degree = joinNonEmpty([item.degree, item.major], ", ");
    return `${escapeTypst(degree)}\\
${escapeTypst(item.institution || "")} (${escapeTypst(formatDateRangeText(item.start_date || item.startDate, item.end_date || item.endDate))})`;
  }).join("\n\n");

  const skills = normalizeSkillGroups(resume.skills)
    .flatMap((group) => group.items || [])
    .filter(Boolean);

  const experience = (resume.experience || []).map((role) => {
    const headerLine = `${escapeTypst(role.title || "")}\\\n${escapeTypst(role.company || "")} - ${escapeTypst(formatDateRangeText(role.start_date || role.startDate, role.end_date || role.endDate))}`;
    const bullets = formatBullets(role.bullets);
    const tags = skills.length ? `#tags(${skills.slice(0, 8).map((skill) => typstString(skill)).join(", ")})` : "";
    return [
      `=== ${headerLine}`,
      bullets,
      tags
    ].filter(Boolean).join("\n\n");
  }).join("\n\n");

  return [
    "#import \"@preview/metronic:1.1.0\": *",
    "",
    "#theme(",
    "  accent-color: rgb(\"61B7AE\"),",
    "  background-color: rgb(\"F2F0EF\")",
    ")",
    "",
    "#show: resume-page.with(",
    "  sidebar: [",
    `    = ${escapeTypst(header.name)}`,
    "",
    summary ? `    ${summary}` : "",
    "",
    "    #contact(",
    `      phone: ${typstString(header.phone)},`,
    `      linkedin: ${typstString(linkedinUser)},`,
    `      email: ${typstString(header.email)},`,
    `      location: ${typstString(header.location)},`,
    `      website: ${typstString(website)}`,
    "    )",
    "",
    education ? "    #section(icon: \"university\", \"Education\")[" : "",
    education ? `      #small()[${education}]` : "",
    education ? "    ]" : "",
    "",
    skills.length ? "    #section(icon: \"check-double\", \"Skills\")[" : "",
    skills.length ? `      #tags(${skills.map((skill) => typstString(skill)).join(", ")})` : "",
    skills.length ? "    ]" : "",
    "  ]",
    ")",
    "",
    experience ? "#section(icon: \"briefcase\", \"Professional Experience\")[" : "",
    experience,
    experience ? "]" : ""
  ].filter((line) => line !== "").join("\n");
}

function buildImpressiveImpressionResumeSource(resume, profile) {
  const header = getHeader(resume, profile);
  const links = normalizeLinks(header.links);
  const website = firstNonSocialLink(links) || findLink(links, "http");
  const summary = resume.summary ? escapeTypst(resume.summary) : "";
  const positions = buildPositions(resume);

  const experienceBlocks = (resume.experience || []).map((role) => {
    const timeline = `([${escapeTypst(role.end_date || role.endDate || "Present")}], [${escapeTypst(role.start_date || role.startDate || "")}])`;
    const supplement = role.company ? `supplement: [${escapeTypst(role.company)}],` : "";
    const bullets = formatBullets(role.bullets) || "-";
    return [
      "#make-main-content-block-with-timeline(",
      `  ${timeline},`,
      `  ${typstString(role.title || "")},`,
      supplement,
      "  [",
      `    ${bullets.replace(/\n/g, "\n    ")}`,
      "  ]",
      ")"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const educationBlocks = (resume.education || []).map((item) => {
    const timeline = `([${escapeTypst(item.end_date || item.endDate || "")}], [${escapeTypst(item.start_date || item.startDate || "")}])`;
    const degree = joinNonEmpty([item.degree, item.major], ", ");
    return [
      "#make-main-content-block-with-timeline(",
      `  ${timeline},`,
      `  ${typstString(degree)},`,
      item.institution ? `  supplement: [${escapeTypst(item.institution)}],` : "",
      "  [",
      `    ${escapeTypst(item.location || item.country || "")}`,
      "  ]",
      ")"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const projectBlocks = (resume.projects || []).map((project) => {
    const timeline = `([${escapeTypst(project.end_date || project.endDate || "")}], [${escapeTypst(project.start_date || project.startDate || "")}])`;
    const supplement = project.link ? `supplement: [${escapeTypst(project.link)}],` : "";
    const bullets = formatBullets(project.bullets) || "-";
    return [
      "#make-main-content-block-with-timeline(",
      `  ${timeline},`,
      `  ${typstString(project.name || "")},`,
      supplement,
      "  [",
      `    ${bullets.replace(/\n/g, "\n    ")}`,
      "  ]",
      ")"
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const skillItems = normalizeSkillGroups(resume.skills)
    .flatMap((group) => group.items || [])
    .filter(Boolean)
    .slice(0, 12)
    .map((skill) => `#make-pill(${typstString(skill)})`)
    .join("\n  ");

  const contactEntries = [
    header.location ? `iconer-stack(\"map-marker-alt\"), [${escapeTypst(header.location)}]` : "",
    header.phone ? `iconer-stack(\"phone\"), [${escapeTypst(header.phone)}]` : "",
    header.email ? `iconer-stack(\"at\"), [${escapeTypst(header.email)}]` : "",
    website ? `iconer-stack(\"globe\"), [${escapeTypst(website)}]` : ""
  ].filter(Boolean);

  return [
    "#import \"@preview/impressive-impression:0.1.0\": (",
    "  cv,",
    "  crop-image,",
    "  colorize-svg-string,",
    "  dot-ratings,",
    "  make-pill,",
    "  make-aside-persona,",
    "  make-aside-grid,",
    "  make-main-content-block,",
    "  make-main-content-block-with-timeline,",
    "  theme-helper,",
    ")",
    "",
    "#import \"utils.typ\": flag, fa-icon-factory, fa-icon-factory-stack",
    "#import \"theme.typ\": theme",
    "",
    "#import \"@preview/fontawesome:0.5.0\": fa-icon, fa-stack",
    "#import \"@preview/nth:1.0.1\": nth",
    "",
    `#let name = ${typstString(header.name)}`,
    "#let pronouns = \"\"",
    "#let profile-image = image(\"assets/profile.png\")",
    `#let short-description = [${summary || escapeTypst("Dedicated professional resume")}]`,
    "",
    "#let th = theme-helper(theme)",
    "",
    "#let iconer-stack = fa-icon-factory-stack(theme)",
    "#let iconer = fa-icon-factory(theme)",
    "#let dot-ratings = dot-ratings.with(",
    "  size: 6.5pt,",
    "  spacing: 3.5pt,",
    "  color-active: th(\"primary-accent-color\"),",
    "  color-inactive: th(\"faint-text-color\").transparentize(65%),",
    ")",
    "",
    "#let make-main-content-block = make-main-content-block.with(theme: theme)",
    "#let make-main-content-block-with-timeline = make-main-content-block-with-timeline.with(theme: theme)",
    "",
    "#let main-content-1 = [",
    summary ? "  == Introduction" : "",
    summary ? `  #block([${summary}])` : "",
    experienceBlocks ? "  == Experience" : "",
    experienceBlocks,
    projectBlocks ? "  == Projects" : "",
    projectBlocks,
    educationBlocks ? "  == Education" : "",
    educationBlocks,
    "]",
    "",
    "#let aside-content-1 = [",
    "  #make-aside-persona(",
    "    name,",
    "    pronouns: pronouns,",
    "    short-description: short-description,",
    "    image: profile-image,",
    "    theme: theme,",
    "  )",
    contactEntries.length ? "  #make-aside-grid(" : "",
    contactEntries.length ? "    theme: theme," : "",
    contactEntries.length ? `    ${contactEntries.join(",\n    ")}` : "",
    contactEntries.length ? "  )" : "",
    skillItems ? "  == Skills" : "",
    skillItems ? `  ${skillItems}` : "",
    "]",
    "",
    "#cv(",
    "  theme: theme,",
    "  paper: \"us-letter\",",
    "  pages-content: (",
    "    (\"left\": aside-content-1, \"main\": main-content-1)",
    "  )",
    ")"
  ].filter((line) => line !== "").join("\n");
}

export function buildResumeSource({ template, resume, profile, fallbackTemplateText }) {
  if (!template) return "";
  const safeResume = resume || {};
  const safeProfile = profile || {};
  switch (template.id) {
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
      return fallbackTemplateText || "";
  }
}

function buildModernCvCoverSource(cover, profile, job, templateId) {
  const header = getHeader({ header: { name: cover.signature_name || "" } }, profile);
  const links = normalizeLinks(header.links);
  const { first, last } = splitName(header.name || cover.signature_name || "");
  const githubUser = extractUsername(findLink(links, "github.com"), "github.com");
  const linkedinUser = extractUsername(findLink(links, "linkedin.com"), "linkedin.com");
  const website = firstNonSocialLink(links) || findLink(links, "http");
  const positionList = buildPositions({ experience: profile.experience || [] });
  const bodyParagraphs = Array.isArray(cover.body_paragraphs) ? cover.body_paragraphs : [];

  const bodyBlocks = bodyParagraphs.map((paragraph) => [
    "#coverletter-content[",
    escapeTypst(paragraph),
    "]"
  ].join("\n")).join("\n\n");
  const closingLine = escapeTypst(cover.closing || "Sincerely,");
  const signatureLine = escapeTypst(cover.signature_name || header.name);
  const closingBlock = [
    "#coverletter-content[",
    closingLine,
    "",
    signatureLine,
    "]"
  ].join("\n");
  const addressee = String(cover.greeting || "Hiring Manager")
    .replace(/^\s*dear\s+/i, "")
    .replace(/[,\s]+$/g, "") || "Hiring Manager";

  return [
    "#import \"@preview/modern-cv:0.9.0\": *",
    "",
    "#show: coverletter.with(",
    "  author: (",
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    `    email: ${typstString(header.email)},`,
    `    homepage: ${typstString(website)},`,
    `    phone: ${typstString(header.phone)},`,
    `    github: ${typstString(githubUser)},`,
    `    linkedin: ${typstString(linkedinUser)},`,
    `    address: ${typstString(header.location)},`,
    `    positions: ${typstTuple(positionList)}`,
    "  ),",
    templateId === "modern_cv_cover_alt" ? "  profile-picture: none," : "  profile-picture: image(\"profile.png\"),",
    "  language: \"en\",",
    "  show-footer: false",
    ")",
    "",
    "#hiring-entity-info(",
    "  entity-info: (",
    `    target: ${typstString("Hiring Manager")},`,
    `    name: ${typstString(job?.company || "")},`,
    `    street-address: ${typstString(" ")},`,
    `    city: ${typstString(" ")}`,
    "  ),",
    ")",
    "",
    `#letter-heading(job-position: ${typstString(job?.title || "")}, addressee: ${typstString(addressee)})`,
    "",
    bodyBlocks,
    "",
    closingBlock
  ].filter(Boolean).join("\n");
}

function buildNeatCvCoverSource(cover, profile, job) {
  const header = getHeader({ header: { name: cover.signature_name || "" } }, profile);
  const { first, last } = splitName(header.name || cover.signature_name || "");
  const bodyParagraphs = Array.isArray(cover.body_paragraphs) ? cover.body_paragraphs : [];
  const body = bodyParagraphs.map((p) => escapeTypst(p)).join("\n\n");

  const recipientLines = [
    job?.company || "",
    job?.title ? `Role: ${job.title}` : "",
    header.location || ""
  ].filter(Boolean).map((line) => escapeTypst(line)).join("\\\n");

  return [
    "#import \"@preview/neat-cv:0.6.0\": letter",
    "",
    "#set text(lang: \"en\")",
    "",
    "#show: letter.with(",
    "  author: (",
    `    firstname: ${typstString(first)},`,
    `    lastname: ${typstString(last)},`,
    `    email: ${typstString(header.email)},`,
    `    address: [${escapeTypst(header.location)}],`,
    `    phone: ${typstString(header.phone)},`,
    `    position: ${typstTuple(buildPositions({ experience: profile.experience || [] }))}`,
    "  ),",
    "  profile-picture: image(\"profile.png\"),",
    "  accent-color: rgb(\"#4682b4\"),",
    "  header-text-color: rgb(\"#3b4f60\"),",
    recipientLines ? `  recipient: [${recipientLines}],` : "",
    ")",
    "",
    cover.greeting ? `${escapeTypst(cover.greeting)}` : "Dear Hiring Manager,",
    "",
    body,
    "",
    cover.closing ? escapeTypst(cover.closing) : "Sincerely,",
    "",
    `#align(right)[ ${escapeTypst(cover.signature_name || header.name || "")} ]`
  ].filter(Boolean).join("\n");
}

export function buildCoverSource({ template, cover, profile, job, fallbackTemplateText }) {
  if (!template) return "";
  const safeCover = cover || {};
  const safeProfile = profile || {};
  if (template.id === "modern_cv_cover" || template.id === "modern_cv_cover_alt") {
    return buildModernCvCoverSource(safeCover, safeProfile, job, template.id);
  }
  if (template.id === "neat_cv_letter") {
    return buildNeatCvCoverSource(safeCover, safeProfile, job);
  }
  return fallbackTemplateText || "";
}
