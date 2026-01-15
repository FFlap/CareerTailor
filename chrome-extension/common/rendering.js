import { renderCoverLetterLatex, renderCoverLetterTypst, renderResumeTemplate } from "./templating.js";
import { buildCoverSource, buildResumeSource } from "./template-builders.js";

async function loadAssets(paths = []) {
  if (!Array.isArray(paths) || !paths.length) return [];
  const entries = await Promise.all(paths.map(async (path) => {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return { path: `/${path}`, content: buffer };
  }));
  return entries.filter(Boolean);
}

export async function buildDocumentSources({ documentType, template, data, profile, job }) {
  if (!template) {
    throw new Error("Template not found.");
  }
  const templateText = template.path
    ? await fetch(chrome.runtime.getURL(template.path)).then((r) => r.text())
    : "";
  let rawSource = "";

  if (documentType === "resume") {
    rawSource = buildResumeSource({
      template,
      resume: data,
      profile,
      fallbackTemplateText: renderResumeTemplate(templateText, data)
    });
  } else if (template.format === "latex") {
    rawSource = renderCoverLetterLatex(templateText, data);
  } else {
    rawSource = buildCoverSource({
      template,
      cover: data,
      profile,
      job,
      fallbackTemplateText: renderCoverLetterTypst(templateText, data)
    });
  }

  let renderSource = rawSource;
  let renderFormat = template.format;
  let mainPath = template.path ? `/${template.path}` : "/main.typ";

  if (template.format === "latex") {
    const renderTemplateText = template.renderPath
      ? await fetch(chrome.runtime.getURL(template.renderPath)).then((r) => r.text())
      : templateText;
    renderSource = renderCoverLetterTypst(renderTemplateText, data);
    renderFormat = "typst";
    mainPath = "/main.typ";
  }

  const assets = renderFormat === "typst" ? await loadAssets(template.assets || []) : [];

  return {
    rawSource,
    rawExtension: template.format === "latex" ? "tex" : "typ",
    renderSource,
    renderFormat: renderFormat === "latex" ? "typst" : renderFormat,
    mainPath,
    assets
  };
}
