import {
  COVER_TEMPLATES,
  DEFAULT_COVER_TEMPLATE_ID,
  DEFAULT_RESUME_TEMPLATE_ID,
  RESUME_TEMPLATES
} from "../common/constants.js";
import { downloadBlob, buildFilename } from "../common/downloads.js";
import { buildDocumentSources } from "../common/rendering.js";
import { renderDocument } from "../common/renderer-client.js";
import { getProfile, getSettings, setPreviewPayload } from "../common/storage.js";

const jobTitleInput = document.getElementById("jobTitle");
const jobCompanyInput = document.getElementById("jobCompany");
const jobDescriptionInput = document.getElementById("jobDescription");
const documentTypeSelect = document.getElementById("documentType");
const resumeTemplateSelect = document.getElementById("resumeTemplate");
const coverTemplateSelect = document.getElementById("coverTemplate");
const toneSelect = document.getElementById("tone");
const targetLengthSelect = document.getElementById("targetLength");
const generateBtn = document.getElementById("generateBtn");
const statusText = document.getElementById("statusText");
const downloadCard = document.getElementById("downloadCard");
const downloadResumePdf = document.getElementById("downloadResumePdf");
const downloadCoverPdf = document.getElementById("downloadCoverPdf");
const downloadResumeSource = document.getElementById("downloadResumeSource");
const downloadCoverSource = document.getElementById("downloadCoverSource");
const previewResumeBtn = document.getElementById("previewResumeBtn");
const openVariantBtn = document.getElementById("openVariant");
const jobSourceBadge = document.getElementById("jobSource");

let currentVariant = null;
let currentJob = null;
let isGenerating = false;

function applyJob(job, { clearStatus = false } = {}) {
  currentJob = job;
  jobTitleInput.value = job.title || "";
  jobCompanyInput.value = job.company || "";
  jobDescriptionInput.value = job.description || "";
  jobSourceBadge.textContent = `Detected: ${job.source || "job"}`;
  if (clearStatus && !isGenerating) {
    setStatus("");
  }
}

function clearJobInputs() {
  currentJob = null;
  jobTitleInput.value = "";
  jobCompanyInput.value = "";
  jobDescriptionInput.value = "";
}

function isSupportedJobSite(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return (
      host.includes("linkedin.com") ||
      host.includes("indeed.com") ||
      host.includes("glassdoor.com")
    );
  } catch (error) {
    return false;
  }
}

function extractJobIdFromUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("linkedin.com")) {
      const match = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
      if (match) return match[1];
      return parsed.searchParams.get("currentJobId") || "";
    }
    if (parsed.hostname.includes("indeed.com")) {
      return parsed.searchParams.get("jk") || parsed.searchParams.get("vjk") || "";
    }
    if (parsed.hostname.includes("glassdoor.com")) {
      return parsed.searchParams.get("jl") || parsed.searchParams.get("jobListingId") || "";
    }
  } catch (error) {
    return "";
  }
  return "";
}

async function isActiveTabJob(job) {
  if (!chrome.tabs?.query || !job) return false;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return false;
  if (job.jobId) {
    return job.jobId === extractJobIdFromUrl(tab.url);
  }
  if (job.url) {
    return tab.url === job.url;
  }
  return false;
}

function showRefreshNotice(tabUrl) {
  clearJobInputs();
  if (isSupportedJobSite(tabUrl)) {
    jobSourceBadge.textContent = "Refresh page to detect job";
    setStatus("Refresh the page to enable job detection.");
  } else {
    jobSourceBadge.textContent = "Manual entry";
    setStatus("Open a supported job page to auto-detect.");
  }
}

async function requestActiveTabJob() {
  if (!chrome.tabs?.query) return { job: null, tab: null };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { job: null, tab };
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_NOW" });
    if (response?.ok && response.job) {
      applyJob(response.job, { clearStatus: true });
      return { job: response.job, tab };
    }
  } catch (error) {
    return { job: null, tab };
  }
  return { job: null, tab };
}

function populateTemplateSelect(select, templates) {
  select.innerHTML = "";
  Object.values(templates).forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.label;
    select.appendChild(option);
  });
}

function pickTemplate(templates, id, fallbackId) {
  return templates[id] || templates[fallbackId] || Object.values(templates)[0];
}

function setStatus(text) {
  statusText.textContent = text;
}

function updatePreviewButton() {
  previewResumeBtn.disabled = !currentVariant?.resume;
}

function getJobData() {
  return {
    title: jobTitleInput.value.trim(),
    company: jobCompanyInput.value.trim(),
    description: jobDescriptionInput.value.trim(),
    url: currentJob?.url || "",
    source: currentJob?.source || "manual",
    jobId: currentJob?.jobId || ""
  };
}

async function init() {
  populateTemplateSelect(resumeTemplateSelect, RESUME_TEMPLATES);
  populateTemplateSelect(coverTemplateSelect, COVER_TEMPLATES);

  const settings = await getSettings();
  resumeTemplateSelect.value = RESUME_TEMPLATES[settings.resumeTemplate]
    ? settings.resumeTemplate
    : DEFAULT_RESUME_TEMPLATE_ID;
  coverTemplateSelect.value = COVER_TEMPLATES[settings.coverTemplate]
    ? settings.coverTemplate
    : DEFAULT_COVER_TEMPLATE_ID;
  toneSelect.value = settings.tone;
  targetLengthSelect.value = settings.targetLength;

  const profile = await getProfile();
  if (!profile?.personal?.fullName) {
    setStatus("Complete onboarding to generate documents.");
  }

  const { job: activeJob, tab } = await requestActiveTabJob();
  if (!activeJob) {
    showRefreshNotice(tab?.url || "");
  }

  openVariantBtn.addEventListener("click", () => {
    const url = currentJob?.url ? `?jobUrl=${encodeURIComponent(currentJob.url)}` : "";
    chrome.tabs.create({ url: chrome.runtime.getURL(`pages/variant.html${url}`) });
  });

  generateBtn.addEventListener("click", async () => {
    setStatus("Generating..." );
    generateBtn.disabled = true;
    isGenerating = true;
    const job = getJobData();

    await chrome.runtime.sendMessage({ type: "JOB_SCRAPED", job });

    try {
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_DOCS",
        job,
        documentType: documentTypeSelect.value,
        resumeTemplate: resumeTemplateSelect.value,
        coverTemplate: coverTemplateSelect.value,
        preferences: {
          tone: toneSelect.value,
          target_length: targetLengthSelect.value
        },
        jobUrl: job.url
      });

      if (!response.ok) {
        throw new Error(response.error || "Generation failed.");
      }

      currentVariant = response.variant;
      currentJob = response.job;
      downloadCard.classList.add("active");
      updatePreviewButton();
      setStatus("Ready to download.");
    } catch (error) {
      setStatus(error.message || "Generation failed.");
    } finally {
      generateBtn.disabled = false;
      isGenerating = false;
    }
  });

  /* Dropdown Logic */
  const downloadTrigger = document.getElementById("downloadTrigger");
  const downloadMenu = document.getElementById("downloadMenu");

  downloadTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    downloadMenu.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!downloadMenu.contains(e.target) && e.target !== downloadTrigger) {
      downloadMenu.classList.add("hidden");
    }
  });

  downloadResumePdf.addEventListener("click", () => {
    handleDownload("resume", "pdf");
    downloadMenu.classList.add("hidden");
  });
  downloadCoverPdf.addEventListener("click", () => {
    handleDownload("cover_letter", "pdf");
    downloadMenu.classList.add("hidden");
  });
  downloadResumeSource.addEventListener("click", () => {
    handleDownload("resume", "source");
    downloadMenu.classList.add("hidden");
  });
  downloadCoverSource.addEventListener("click", () => {
    handleDownload("cover_letter", "source");
    downloadMenu.classList.add("hidden");
  });

  previewResumeBtn.addEventListener("click", async () => {
    if (!currentVariant?.resume) {
      setStatus("Generate a resume first.");
      return;
    }
    const job = getJobData();
    await setPreviewPayload({
      type: "resume",
      resume: currentVariant.resume,
      cover_letter: currentVariant.cover_letter || null,
      templates: currentVariant.templates || {
        resume: resumeTemplateSelect.value,
        cover: coverTemplateSelect.value
      },
      job,
      timestamp: Date.now()
    });
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/preview.html?type=resume") });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "JOB_SCRAPED" || !message.job) return;
    const active = document.activeElement;
    const isEditing = active === jobTitleInput || active === jobCompanyInput || active === jobDescriptionInput;
    if (isEditing) return;
    isActiveTabJob(message.job).then((matches) => {
      if (!matches) return;
      if (currentJob?.url && message.job.url && currentJob.url !== message.job.url) {
        applyJob(message.job, { clearStatus: true });
        return;
      }
      const hasChange =
        message.job.title !== currentJob?.title ||
        message.job.company !== currentJob?.company ||
        message.job.description !== currentJob?.description;
      if (hasChange) {
        applyJob(message.job, { clearStatus: true });
      }
    });
  });

  updatePreviewButton();
}

async function handleDownload(docType, format) {
  if (!currentVariant) {
    setStatus("Generate a document first.");
    return;
  }
  const job = getJobData();
  const filenameHint = `${job.title || "job"}-${job.company || "company"}`;
  setStatus("Preparing download...");
  try {
    const template = docType === "resume"
      ? pickTemplate(RESUME_TEMPLATES, resumeTemplateSelect.value, DEFAULT_RESUME_TEMPLATE_ID)
      : pickTemplate(COVER_TEMPLATES, coverTemplateSelect.value, DEFAULT_COVER_TEMPLATE_ID);
    const data = docType === "resume" ? currentVariant.resume : currentVariant.cover_letter;
    const profile = await getProfile();
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

    setStatus("Download started.");
  } catch (error) {
    setStatus(error.message || "Download failed.");
  }
}

init();
