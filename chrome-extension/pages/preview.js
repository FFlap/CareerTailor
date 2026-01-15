import { COVER_TEMPLATES, DEFAULT_COVER_TEMPLATE_ID, DEFAULT_RESUME_TEMPLATE_ID, RESUME_TEMPLATES } from "../common/constants.js";
import { downloadBlob, buildFilename } from "../common/downloads.js";
import { buildDocumentSources } from "../common/rendering.js";
import { renderDocument } from "../common/renderer-client.js";
import { getPreviewPayload, getProfile, getSettings } from "../common/storage.js";

const previewTitle = document.getElementById("previewTitle");
const previewMeta = document.getElementById("previewMeta");
const previewStatus = document.getElementById("previewStatus");
const previewFrame = document.getElementById("previewFrame");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const refreshBtn = document.getElementById("refreshPreview");
const downloadBtn = document.getElementById("downloadPreview");

let currentPayload = null;
let currentBlob = null;
let currentUrl = "";

function pickTemplate(templates, id, fallbackId) {
  return templates[id] || templates[fallbackId] || Object.values(templates)[0];
}

function resolveDocType() {
  const param = new URLSearchParams(window.location.search).get("type");
  if (param === "cover_letter" || param === "resume") return param;
  return currentPayload?.type === "cover_letter" ? "cover_letter" : "resume";
}

function updatePreview(blob) {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
  }
  currentBlob = blob;
  currentUrl = URL.createObjectURL(blob);
  previewFrame.src = currentUrl;
  previewPlaceholder.hidden = true;
  downloadBtn.disabled = false;
}

function setStatus(message) {
  previewStatus.textContent = message;
}

function showPlaceholder(message) {
  previewPlaceholder.textContent = message;
  previewPlaceholder.hidden = false;
  previewFrame.src = "about:blank";
  downloadBtn.disabled = true;
}

async function renderPreview() {
  setStatus("Rendering...");
  const payload = await getPreviewPayload();
  currentPayload = payload;

  if (!payload) {
    setStatus("No preview data found. Generate a resume in the popup first.");
    showPlaceholder("No preview data found.");
    return;
  }

  const profile = await getProfile();
  const settings = await getSettings();
  const type = resolveDocType();
  const data = type === "resume" ? payload.resume : payload.cover_letter;

  if (!data) {
    setStatus("No document data available.");
    showPlaceholder("No document data available.");
    return;
  }

  const template = type === "resume"
    ? pickTemplate(RESUME_TEMPLATES, payload.templates?.resume || settings.resumeTemplate, DEFAULT_RESUME_TEMPLATE_ID)
    : pickTemplate(COVER_TEMPLATES, payload.templates?.cover || settings.coverTemplate, DEFAULT_COVER_TEMPLATE_ID);

  const job = payload.job || {};
  previewTitle.textContent = type === "resume" ? "Resume Preview" : "Cover Letter Preview";
  previewMeta.textContent = [job.title, job.company, template?.label].filter(Boolean).join(" • ");

  try {
    const sources = await buildDocumentSources({
      documentType: type,
      template,
      data,
      profile,
      job
    });

    const pdfBlob = await renderDocument({
      source: sources.renderSource,
      format: sources.renderFormat,
      assets: sources.assets,
      mainPath: sources.mainPath
    });
    updatePreview(pdfBlob);
    setStatus("Ready.");
  } catch (error) {
    setStatus(error.message || "Preview failed.");
    showPlaceholder("Preview failed. Try regenerating.");
  }
}

refreshBtn.addEventListener("click", renderPreview);

downloadBtn.addEventListener("click", async () => {
  if (!currentBlob || !currentPayload) return;
  const type = resolveDocType();
  const job = currentPayload.job || {};
  const filenameHint = `${job.title || "job"}-${job.company || "company"}`;
  const fileName = buildFilename({
    filenameHint,
    documentType: type === "resume" ? "resume" : "cover_letter",
    extension: "pdf"
  });
  await downloadBlob(currentBlob, fileName);
});

renderPreview();

window.addEventListener("beforeunload", () => {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
  }
});
