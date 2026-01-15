export function escapeTypst(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/#/g, "\\#")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/@/g, "\\@")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>");
}

export function escapeLatex(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function formatDateRange(start, end) {
  if (!start && !end) return "";
  if (start && !end) return `${start} - Present`;
  if (!start && end) return end;
  return `${start} - ${end}`;
}

export function joinNonEmpty(parts, separator = " | ") {
  return parts.filter(Boolean).join(separator);
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}

export function nowTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getWeekKey(date = new Date()) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
