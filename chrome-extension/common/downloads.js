import { slugify } from "./utils.js";

export function buildFilename({ filenameHint, documentType, extension }) {
  const safeHint = slugify(filenameHint || documentType);
  const suffix = documentType === "cover_letter" ? "cover-letter" : "resume";
  return `AI-Resume/${safeHint}-${suffix}.${extension}`;
}

export async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename,
    saveAs: true
  });
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
