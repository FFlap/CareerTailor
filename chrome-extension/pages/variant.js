import { downloadBlob, buildFilename } from "../common/downloads.js";
import { buildDocumentSources } from "../common/rendering.js";
import { renderDocument } from "../common/renderer-client.js";
import {
  COVER_TEMPLATES,
  DEFAULT_COVER_TEMPLATE_ID,
  DEFAULT_RESUME_TEMPLATE_ID,
  RESUME_TEMPLATES
} from "../common/constants.js";
import { getCurrentJob, getJobs, getProfile, getSettings, setJobs } from "../common/storage.js";

const jobDetailsEl = document.getElementById("jobDetails");
const variantListEl = document.getElementById("variantList");
const variantEditorEl = document.getElementById("variantEditor");

let job = null;
let variants = [];
let currentVariant = null;
let settings = null;
let profile = null;
const previewUrls = { resume: "", cover_letter: "" };

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickTemplate(templates, id, fallbackId) {
  return templates[id] || templates[fallbackId] || Object.values(templates)[0];
}

function resolveTemplateId(templates, id, fallbackId) {
  return templates[id] ? id : fallbackId;
}

function formatSkillsInput(skills) {
  if (Array.isArray(skills)) {
    if (skills.length && typeof skills[0] === "object") {
      return skills
        .map((group) => {
          const category = group?.category || "Skills";
          const items = Array.isArray(group?.items) ? group.items.join(", ") : "";
          return `${category}: ${items}`.trim();
        })
        .filter(Boolean)
        .join("\n");
    }
    return skills.join(", ");
  }
  if (typeof skills === "string") return skills;
  return "";
}

function parseSkillsInput(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const hasGrouped = lines.some((line) => line.includes(":"));
  if (!hasGrouped) {
    return text
      .split(/,|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return lines.map((line) => {
    const [category, rest] = line.split(":");
    const items = rest
      ? rest.split(/,|\n/).map((item) => item.trim()).filter(Boolean)
      : [];
    return {
      category: category.trim() || "Skills",
      items
    };
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000 || timestamp || Date.now());
  return date.toLocaleString();
}

function renderJobDetails() {
  if (!job) {
    jobDetailsEl.innerHTML = "<p class='small'>No job found.</p>";
    return;
  }
  jobDetailsEl.innerHTML = `
    <h2>${escapeHtml(job.title || "Untitled Job")}</h2>
    <p><strong>${escapeHtml(job.company || "")}</strong></p>
    <p class="small">${escapeHtml(job.url || "")}</p>
    <details>
      <summary>Job description</summary>
      <p class="small">${escapeHtml(job.description || "").replace(/\n/g, "<br/>")}</p>
    </details>
  `;
}

function renderVariantList() {
  variantListEl.innerHTML = "<h2>Variants</h2>";
  if (!variants.length) {
    variantListEl.innerHTML += "<p class='small'>No variants yet. Generate from the popup.</p>";
    return;
  }
  variants.forEach((variant) => {
    const item = document.createElement("div");
    item.className = "variant-item";
    if (currentVariant?.id === variant.id) item.classList.add("active");
    item.innerHTML = `
      <strong>${formatDate(variant.timestamp)}</strong>
      <div class="small">Resume: ${variant.resume ? "Yes" : "No"}</div>
      <div class="small">Cover: ${variant.cover_letter ? "Yes" : "No"}</div>
    `;
    item.addEventListener("click", () => {
      currentVariant = JSON.parse(JSON.stringify(variant));
      renderVariantList();
      renderEditor();
    });
    variantListEl.appendChild(item);
  });
}

function buildTemplateCards(templates, selectedId, type) {
  return Object.values(templates).map((template) => {
    const activeClass = template.id === selectedId ? " active" : "";
    return `
      <button class="template-card${activeClass}" data-template-type="${type}" data-template-id="${template.id}">
        <span>${escapeHtml(template.label)}</span>
      </button>
    `;
  }).join("");
}

function updatePreviewFrame(docType, url) {
  const frame = variantEditorEl.querySelector(`#${docType}PreviewFrame`);
  const placeholder = variantEditorEl.querySelector(`#${docType}PreviewPlaceholder`);
  if (!frame) return;
  frame.src = url || "about:blank";
  if (placeholder) {
    placeholder.hidden = Boolean(url);
  }
}

async function renderPreview(docType) {
  if (!currentVariant) return;
  const statusEl = variantEditorEl.querySelector(`#${docType}PreviewStatus`);
  const data = docType === "resume" ? currentVariant.resume : currentVariant.cover_letter;
  if (!data) {
    if (statusEl) statusEl.textContent = "No data.";
    updatePreviewFrame(docType, "");
    return;
  }

  if (statusEl) statusEl.textContent = "Rendering...";
  try {
    const template = docType === "resume"
      ? pickTemplate(RESUME_TEMPLATES, currentVariant.templates?.resume || settings.resumeTemplate, DEFAULT_RESUME_TEMPLATE_ID)
      : pickTemplate(COVER_TEMPLATES, currentVariant.templates?.cover || settings.coverTemplate, DEFAULT_COVER_TEMPLATE_ID);
    const sources = await buildDocumentSources({ documentType: docType, template, data, profile, job });
    const pdfBlob = await renderDocument({
      source: sources.renderSource,
      format: sources.renderFormat,
      assets: sources.assets,
      mainPath: sources.mainPath
    });
    const url = URL.createObjectURL(pdfBlob);
    if (previewUrls[docType]) {
      URL.revokeObjectURL(previewUrls[docType]);
    }
    previewUrls[docType] = url;
    updatePreviewFrame(docType, url);
    if (statusEl) statusEl.textContent = "Ready.";
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || "Preview failed.";
  }
}

async function renderPreviews() {
  if (!currentVariant) return;
  applyEdits();
  await Promise.all([
    renderPreview("resume"),
    renderPreview("cover_letter")
  ]);
}

function renderEditor() {
  if (!currentVariant) {
    variantEditorEl.innerHTML = "<p class='small'>Select a variant to edit.</p>";
    return;
  }

  const resume = currentVariant.resume || {};
  const cover = currentVariant.cover_letter || {};

  const experienceBlocks = (resume.experience || []).map((role, idx) => {
    const bullets = Array.isArray(role.bullets) ? role.bullets.join("\n") : "";
    return `
      <div class="list-item">
        <strong>${escapeHtml(role.title || "Role")} @ ${escapeHtml(role.company || "")}</strong>
        <textarea data-exp="${idx}" rows="3">${escapeHtml(bullets)}</textarea>
      </div>
    `;
  }).join("");

  const projectBlocks = (resume.projects || []).map((project, idx) => {
    const bullets = Array.isArray(project.bullets) ? project.bullets.join("\n") : "";
    const technologies = Array.isArray(project.technologies) ? project.technologies.join(", ") : "";
    return `
      <div class="list-item">
        <label>Project name</label>
        <input data-proj-name="${idx}" type="text" value="${escapeHtml(project.name || "")}" />
        <label>Technologies</label>
        <input data-proj-tech="${idx}" type="text" value="${escapeHtml(technologies)}" />
        <label>Impact bullets</label>
        <textarea data-proj="${idx}" rows="3">${escapeHtml(bullets)}</textarea>
      </div>
    `;
  }).join("");

  const resumeTemplateId = resolveTemplateId(
    RESUME_TEMPLATES,
    currentVariant.templates?.resume || settings.resumeTemplate,
    DEFAULT_RESUME_TEMPLATE_ID
  );
  const coverTemplateId = resolveTemplateId(
    COVER_TEMPLATES,
    currentVariant.templates?.cover || settings.coverTemplate,
    DEFAULT_COVER_TEMPLATE_ID
  );
  currentVariant.templates = currentVariant.templates || {};
  currentVariant.templates.resume = resumeTemplateId;
  currentVariant.templates.cover = coverTemplateId;

  variantEditorEl.innerHTML = `
    <h2>Edit Variant</h2>
    <div class="editor-section">
      <label>Summary</label>
      <textarea id="summary" rows="3">${escapeHtml(resume.summary || "")}</textarea>
    </div>
    <div class="editor-section">
      <label>Skills (comma or line separated)</label>
      <textarea id="skills" rows="3">${escapeHtml(formatSkillsInput(resume.skills))}</textarea>
    </div>
    <div class="editor-section">
      <h3>Experience Bullets</h3>
      <div class="inline-grid">${experienceBlocks || "<p class='small'>No experience entries.</p>"}</div>
    </div>
    <div class="editor-section">
      <h3>Project Bullets</h3>
      <div class="inline-grid">${projectBlocks || "<p class='small'>No projects entries.</p>"}</div>
    </div>
    <div class="editor-section">
      <h3>Cover Letter</h3>
      <label>Greeting</label>
      <input id="coverGreeting" type="text" value="${escapeHtml(cover.greeting || "")}" />
      <label>Body paragraphs (blank line separates)</label>
      <textarea id="coverBody" rows="6">${escapeHtml(Array.isArray(cover.body_paragraphs) ? cover.body_paragraphs.join("\n\n") : "")}</textarea>
      <label>Closing</label>
      <input id="coverClosing" type="text" value="${escapeHtml(cover.closing || "")}" />
      <label>Signature name</label>
      <input id="coverSignature" type="text" value="${escapeHtml(cover.signature_name || "")}" />
    </div>
    <div class="editor-section">
      <label>Ask Gemini to modify</label>
      <textarea id="geminiInstruction" rows="3" placeholder="e.g. tighten bullets to 2 lines, add metrics"></textarea>
      <button class="secondary" id="regenerateBtn">Regenerate Variant</button>
    </div>
    <div class="editor-section">
      <h3>Templates</h3>
      <p class="small">Click a template to refresh the preview below.</p>
      <div class="template-group">
        <h4>Resume Templates</h4>
        <div class="template-grid">${buildTemplateCards(RESUME_TEMPLATES, resumeTemplateId, "resume")}</div>
      </div>
      <div class="template-group">
        <h4>Cover Letter Templates</h4>
        <div class="template-grid">${buildTemplateCards(COVER_TEMPLATES, coverTemplateId, "cover")}</div>
      </div>
      <div class="template-actions">
        <button class="secondary" id="refreshPreviews">Render Previews</button>
      </div>
    </div>
    <div class="preview-grid">
      <div class="preview-card">
        <div class="preview-header">
          <strong>Resume Preview</strong>
          <span class="small" id="resumePreviewStatus"></span>
        </div>
        <div class="preview-shell">
          <div class="preview-placeholder" id="resumePreviewPlaceholder">No resume data yet.</div>
          <iframe id="resumePreviewFrame" class="preview-frame" title="Resume preview"></iframe>
        </div>
      </div>
      <div class="preview-card">
        <div class="preview-header">
          <strong>Cover Letter Preview</strong>
          <span class="small" id="cover_letterPreviewStatus"></span>
        </div>
        <div class="preview-shell">
          <div class="preview-placeholder" id="cover_letterPreviewPlaceholder">No cover letter data yet.</div>
          <iframe id="cover_letterPreviewFrame" class="preview-frame" title="Cover letter preview"></iframe>
        </div>
      </div>
    </div>
    <div class="toolbar">
      <button class="primary" id="saveVariant">Save Variant</button>
      <button class="secondary" id="downloadResumePdf">Download Resume PDF</button>
      <button class="secondary" id="downloadCoverPdf">Download Cover PDF</button>
      <button class="ghost" id="downloadResumeSource">Download Resume Source</button>
      <button class="ghost" id="downloadCoverSource">Download Cover Source</button>
      <span class="small" id="editorStatus"></span>
    </div>
  `;

  variantEditorEl.querySelector("#saveVariant").addEventListener("click", saveVariant);
  variantEditorEl.querySelector("#downloadResumePdf").addEventListener("click", () => download("resume", "pdf"));
  variantEditorEl.querySelector("#downloadCoverPdf").addEventListener("click", () => download("cover_letter", "pdf"));
  variantEditorEl.querySelector("#downloadResumeSource").addEventListener("click", () => download("resume", "source"));
  variantEditorEl.querySelector("#downloadCoverSource").addEventListener("click", () => download("cover_letter", "source"));
  variantEditorEl.querySelector("#regenerateBtn").addEventListener("click", regenerateVariant);
  variantEditorEl.querySelector("#refreshPreviews").addEventListener("click", renderPreviews);

  variantEditorEl.querySelectorAll(".template-card").forEach((card) => {
    card.addEventListener("click", () => {
      applyEdits();
      const type = card.dataset.templateType;
      const id = card.dataset.templateId;
      currentVariant.templates = currentVariant.templates || {};
      if (type === "resume") {
        currentVariant.templates.resume = id;
      } else {
        currentVariant.templates.cover = id;
      }
      renderEditor();
    });
  });

  if (previewUrls.resume) {
    updatePreviewFrame("resume", previewUrls.resume);
  }
  if (previewUrls.cover_letter) {
    updatePreviewFrame("cover_letter", previewUrls.cover_letter);
  }

  renderPreviews();
}

function applyEdits() {
  if (!currentVariant) return;
  const summary = variantEditorEl.querySelector("#summary").value.trim();
  const skills = parseSkillsInput(variantEditorEl.querySelector("#skills").value);

  currentVariant.resume = currentVariant.resume || {};
  currentVariant.resume.summary = summary;
  currentVariant.resume.skills = skills;

  variantEditorEl.querySelectorAll("textarea[data-exp]").forEach((area) => {
    const idx = Number(area.dataset.exp);
    const bullets = area.value.split(/\n+/).map((b) => b.trim()).filter(Boolean);
    if (currentVariant.resume.experience?.[idx]) {
      currentVariant.resume.experience[idx].bullets = bullets;
    }
  });

  variantEditorEl.querySelectorAll("textarea[data-proj]").forEach((area) => {
    const idx = Number(area.dataset.proj);
    const bullets = area.value.split(/\n+/).map((b) => b.trim()).filter(Boolean);
    if (currentVariant.resume.projects?.[idx]) {
      currentVariant.resume.projects[idx].bullets = bullets;
    }
  });

  variantEditorEl.querySelectorAll("input[data-proj-name]").forEach((input) => {
    const idx = Number(input.dataset.projName);
    if (currentVariant.resume.projects?.[idx]) {
      currentVariant.resume.projects[idx].name = input.value.trim();
    }
  });

  variantEditorEl.querySelectorAll("input[data-proj-tech]").forEach((input) => {
    const idx = Number(input.dataset.projTech);
    if (currentVariant.resume.projects?.[idx]) {
      currentVariant.resume.projects[idx].technologies = input.value
        .split(/,|\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  });

  if (Array.isArray(currentVariant.resume.projects)) {
    currentVariant.resume.projects.forEach((project) => {
      if (project && Object.prototype.hasOwnProperty.call(project, "description")) {
        delete project.description;
      }
    });
  }

  currentVariant.cover_letter = currentVariant.cover_letter || {};
  currentVariant.cover_letter.greeting = variantEditorEl.querySelector("#coverGreeting").value.trim();
  currentVariant.cover_letter.body_paragraphs = variantEditorEl.querySelector("#coverBody").value
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  currentVariant.cover_letter.closing = variantEditorEl.querySelector("#coverClosing").value.trim();
  currentVariant.cover_letter.signature_name = variantEditorEl.querySelector("#coverSignature").value.trim();
}

async function saveVariant() {
  applyEdits();
  const editorStatus = variantEditorEl.querySelector("#editorStatus");
  const jobs = await getJobs();
  const existing = jobs[job.url];
  if (!existing) return;
  existing.variants = [currentVariant, ...(existing.variants || []).filter((v) => v.id !== currentVariant.id)];
  jobs[job.url] = existing;
  await setJobs(jobs);
  editorStatus.textContent = "Saved.";
}

async function regenerateVariant() {
  applyEdits();
  const editorStatus = variantEditorEl.querySelector("#editorStatus");
  const instructions = variantEditorEl.querySelector("#geminiInstruction").value.trim();
  if (!instructions) {
    editorStatus.textContent = "Add instructions first.";
    return;
  }
  editorStatus.textContent = "Regenerating...";
  const response = await chrome.runtime.sendMessage({
    type: "REGENERATE_VARIANT",
    job,
    variant: currentVariant,
    instructions
  });
  if (!response.ok) {
    editorStatus.textContent = response.error || "Regeneration failed.";
    return;
  }
  currentVariant = response.variant;
  variants = [currentVariant, ...variants.filter((v) => v.id !== currentVariant.id)];
  editorStatus.textContent = "Variant updated.";
  renderVariantList();
  renderEditor();
}

async function download(docType, format) {
  applyEdits();
  const editorStatus = variantEditorEl.querySelector("#editorStatus");
  const filenameHint = `${job.title || "job"}-${job.company || "company"}`;
  try {
    const template = docType === "resume"
      ? pickTemplate(RESUME_TEMPLATES, currentVariant.templates?.resume || settings.resumeTemplate, DEFAULT_RESUME_TEMPLATE_ID)
      : pickTemplate(COVER_TEMPLATES, currentVariant.templates?.cover || settings.coverTemplate, DEFAULT_COVER_TEMPLATE_ID);
    const data = docType === "resume" ? currentVariant.resume : currentVariant.cover_letter;
    const sources = await buildDocumentSources({ documentType: docType, template, data, profile, job });

    if (format === "pdf") {
      const pdfBlob = await renderDocument({
        source: sources.renderSource,
        format: sources.renderFormat,
        assets: sources.assets,
        mainPath: sources.mainPath
      });
      const fileName = buildFilename({ filenameHint, documentType: docType, extension: "pdf" });
      await downloadBlob(pdfBlob, fileName);
    } else {
      const fileName = buildFilename({ filenameHint, documentType: docType, extension: sources.rawExtension });
      const type = sources.rawExtension === "tex" ? "application/x-tex" : "application/x-typst";
      await downloadBlob(new Blob([sources.rawSource], { type }), fileName);
    }

    editorStatus.textContent = "Download started.";
  } catch (error) {
    editorStatus.textContent = error.message || "Download failed.";
  }
}

async function init() {
  settings = await getSettings();
  profile = await getProfile();
  const jobUrl = new URLSearchParams(window.location.search).get("jobUrl");
  const jobs = await getJobs();
  if (jobUrl && jobs[jobUrl]) {
    job = jobs[jobUrl];
  } else {
    job = await getCurrentJob();
  }

  if (!job?.url || !jobs[job.url]) {
    variants = [];
  } else {
    variants = jobs[job.url]?.variants || [];
  }

  renderJobDetails();
  renderVariantList();
  renderEditor();
}

init();

window.addEventListener("beforeunload", () => {
  Object.values(previewUrls).forEach((url) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  });
});
