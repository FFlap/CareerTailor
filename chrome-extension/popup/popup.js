import { APP_BASE_URL } from "../common/config.js";
import { setConnectState } from "../common/storage.js";

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsStatus = document.getElementById("settingsStatus");
const authStatusEl = document.getElementById("authStatus");
const connectBtn = document.getElementById("connectBtn");
const blockerEnabledInput = document.getElementById("blockerEnabled");
const blockerConfigFields = document.getElementById("blockerConfigFields");
const requiredAppliedCountInput = document.getElementById("requiredAppliedCount");
const blockedDomainsInput = document.getElementById("blockedDomains");
const quotaProgressText = document.getElementById("quotaProgressText");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const jobCard = document.getElementById("jobCard");

const jobTitleInput = document.getElementById("jobTitle");
const jobCompanyInput = document.getElementById("jobCompany");
const jobUrlInput = document.getElementById("jobUrl");
const jobDescriptionInput = document.getElementById("jobDescription");
const jobSourceBadge = document.getElementById("jobSource");
const jobTitleDisplay = document.getElementById("jobTitleDisplay");
const jobCompanyDisplay = document.getElementById("jobCompanyDisplay");
const jobUrlDisplay = document.getElementById("jobUrlDisplay");
const manualEntry = document.getElementById("manualEntry");

const refreshJobBtn = document.getElementById("refreshJob");
const syncBtn = document.getElementById("syncBtn");
const generateInAppBtn = document.getElementById("generateInAppBtn");
const statusText = document.getElementById("statusText");

let currentJob = null;
let isConnected = false;
let isSettingsOpen = false;

function setStatus(text) {
  if (statusText) statusText.textContent = text || "";
}

function setSettingsStatus(text) {
  if (settingsStatus) settingsStatus.textContent = text || "";
}

function setSummaryText(el, value, fallback) {
  if (!el) return;
  const trimmed = (value || "").trim();
  el.textContent = trimmed || fallback;
  el.classList.toggle("is-empty", !trimmed);
  if (el === jobUrlDisplay) {
    el.title = trimmed || "";
  }
}

function updateSummary() {
  setSummaryText(jobTitleDisplay, jobTitleInput?.value, "Add job title");
  setSummaryText(jobCompanyDisplay, jobCompanyInput?.value, "Add company");
  setSummaryText(jobUrlDisplay, jobUrlInput?.value, "Add job URL");
}

function revealManualEntry() {
  if (manualEntry && !manualEntry.open) {
    manualEntry.open = true;
  }
}

function generateConnectState() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function applyJob(job) {
  const existingAddedAt =
    typeof currentJob?.addedAt === "number" && Number.isFinite(currentJob.addedAt)
      ? currentJob.addedAt
      : undefined;
  const incomingAddedAt =
    typeof job?.addedAt === "number" && Number.isFinite(job.addedAt)
      ? job.addedAt
      : undefined;
  currentJob = { ...(job || {}), addedAt: incomingAddedAt ?? existingAddedAt ?? Date.now() };

  if (jobTitleInput) jobTitleInput.value = job?.title || "";
  if (jobCompanyInput) jobCompanyInput.value = job?.company || "";
  if (jobUrlInput) jobUrlInput.value = job?.url || "";
  if (jobDescriptionInput) jobDescriptionInput.value = job?.description || "";

  const sourceLabel =
    job?.source && job.source !== "extension" ? `Detected: ${job.source}` : "Manual entry";
  if (jobSourceBadge) jobSourceBadge.textContent = sourceLabel;
  updateSummary();
}

function getJobData() {
  const addedAt =
    typeof currentJob?.addedAt === "number" && Number.isFinite(currentJob.addedAt)
      ? currentJob.addedAt
      : Date.now();
  return {
    title: jobTitleInput?.value?.trim() || "",
    company: jobCompanyInput?.value?.trim() || "",
    url: jobUrlInput?.value?.trim() || currentJob?.url || "",
    description: jobDescriptionInput?.value?.trim() || "",
    source: currentJob?.source || "extension",
    jobId: currentJob?.jobId || "",
    addedAt
  };
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
  } catch {
    return false;
  }
}

async function requestActiveTabJob() {
  if (!chrome.tabs?.query) return { job: null, tab: null };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { job: null, tab };
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_NOW" });
    if (response?.ok && response.job) {
      applyJob(response.job);
      setStatus("");
      return { job: response.job, tab };
    }
  } catch {
    // ignore
  }
  return { job: null, tab };
}

async function refreshAuthStatus() {
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" });
  isConnected = Boolean(response?.ok && response.connected);
  if (authStatusEl) {
    authStatusEl.textContent = isConnected ? "Connected" : "Not connected";
  }
  if (connectBtn) {
    connectBtn.textContent = isConnected ? "Reconnect" : "Connect";
  }
}

async function openConnectFlow() {
  const redirectUri = chrome.runtime.getURL("pages/auth-callback.html");
  const state = generateConnectState();
  await setConnectState(state);
  const url = `${APP_BASE_URL}/extension/connect?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  chrome.tabs.create({ url });
}

async function syncJob(job) {
  if (!job?.url) {
    throw new Error("Job URL is required.");
  }
  const response = await chrome.runtime.sendMessage({ type: "SYNC_JOB", job });
  if (!response?.ok) {
    throw new Error(response?.error || "Sync failed.");
  }
  return response.result;
}

function parseBlockedDomainsText(text) {
  return String(text || "")
    .split(/\n|,/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function setBlockerFieldsVisibility(enabled) {
  if (!blockerConfigFields) return;
  blockerConfigFields.classList.toggle("is-hidden", !enabled);
}

function renderBlockerSettings(settings) {
  const enabled = Boolean(settings?.enabled);
  if (blockerEnabledInput) blockerEnabledInput.checked = enabled;
  setBlockerFieldsVisibility(enabled);
  if (requiredAppliedCountInput) {
    const required = Number(settings?.requiredAppliedCount);
    requiredAppliedCountInput.value = String(
      Number.isFinite(required) && required >= 0 ? Math.floor(required) : 5
    );
  }
  if (blockedDomainsInput) {
    blockedDomainsInput.value = Array.isArray(settings?.blockedDomains)
      ? settings.blockedDomains.join("\n")
      : "";
  }
}

function getBlockerSettingsDraft() {
  const requiredRaw = Number(requiredAppliedCountInput?.value);
  return {
    enabled: Boolean(blockerEnabledInput?.checked),
    requiredAppliedCount:
      Number.isFinite(requiredRaw) && requiredRaw >= 0 ? Math.floor(requiredRaw) : 5,
    blockedDomains: parseBlockedDomainsText(blockedDomainsInput?.value || ""),
    matchMode: "domain_subdomains",
    failurePolicy: "open"
  };
}

function setSettingsPanelOpen(open) {
  isSettingsOpen = Boolean(open);
  if (settingsPanel) {
    settingsPanel.classList.toggle("is-hidden", !isSettingsOpen);
  }
  if (jobCard) {
    jobCard.classList.toggle("is-hidden", isSettingsOpen);
  }
  if (settingsBtn) {
    settingsBtn.setAttribute("aria-expanded", isSettingsOpen ? "true" : "false");
  }

  if (isSettingsOpen) {
    if (window.location.hash !== "#settings") {
      window.location.hash = "settings";
    }
  } else if (window.location.hash === "#settings") {
    try {
      history.replaceState(null, "", window.location.pathname);
    } catch {
      // ignore
    }
  }
}

async function loadBlockerSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_BLOCKER_SETTINGS" });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to load blocker settings.");
  }
  renderBlockerSettings(response.settings);
}

async function refreshBlockerProgress(force = false) {
  const response = await chrome.runtime.sendMessage({ type: "GET_BLOCKER_PROGRESS", force });
  if (!response?.ok) {
    if (quotaProgressText) quotaProgressText.textContent = "Applied today: unavailable.";
    return;
  }

  const applied = Number(response.appliedOrBeyondCount || 0);
  const required = Number(response.requiredAppliedCount || 0);
  const quotaMet = Boolean(response.quotaMet);
  const disconnectedHint = response.connected
    ? ""
    : " Connect account to sync; blocking fails open while disconnected.";
  const metHint = quotaMet ? " Quota met." : "";
  const errorHint = response.error ? ` ${response.error}` : "";
  if (quotaProgressText) {
    quotaProgressText.textContent = `Applied today: ${applied} / ${required}.${metHint}${disconnectedHint}${errorHint}`;
  }
}

async function saveBlockerSettings() {
  setSettingsStatus("Saving settings...");
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_BLOCKER_SETTINGS",
    settings: getBlockerSettingsDraft()
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save blocker settings.");
  }
  renderBlockerSettings(response.settings);
  setSettingsStatus("Settings saved.");
  await refreshBlockerProgress(true);
}

async function init() {
  await refreshAuthStatus();

  setSettingsPanelOpen(window.location.hash === "#settings");

  settingsBtn?.addEventListener("click", () => {
    setSettingsPanelOpen(!isSettingsOpen);
  });

  connectBtn?.addEventListener("click", () => {
    void openConnectFlow();
  });

  saveSettingsBtn?.addEventListener("click", async () => {
    try {
      await saveBlockerSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings.";
      setSettingsStatus(message);
    }
  });

  blockerEnabledInput?.addEventListener("change", () => {
    setBlockerFieldsVisibility(Boolean(blockerEnabledInput.checked));
  });

  await loadBlockerSettings().catch((error) => {
    setSettingsStatus(error instanceof Error ? error.message : "Failed to load settings.");
  });
  await refreshBlockerProgress(true);

  refreshJobBtn?.addEventListener("click", async () => {
    setStatus("Refreshing...");
    const { job, tab } = await requestActiveTabJob();
    if (!job) {
      const tabUrl = tab?.url || "";
      if (jobSourceBadge) {
        jobSourceBadge.textContent = isSupportedJobSite(tabUrl)
          ? "Refresh page to detect job"
          : "Manual entry";
      }
      setStatus("No job detected. Paste details manually or open a supported job page.");
      updateSummary();
    }
  });

  syncBtn?.addEventListener("click", async () => {
    setStatus("Syncing...");
    try {
      await refreshAuthStatus();
      await refreshBlockerProgress(false);
      if (!isConnected) {
        setStatus("Connect your account first.");
        await openConnectFlow();
        return;
      }
      const job = getJobData();
      await syncJob(job);
      setStatus("Synced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed.";
      setStatus(message);
      if (message.toLowerCase().includes("job url")) {
        revealManualEntry();
        jobUrlInput?.focus();
      }
    }
  });

  generateInAppBtn?.addEventListener("click", async () => {
    setStatus("Opening web app...");
    try {
      await refreshAuthStatus();
      await refreshBlockerProgress(false);
      if (!isConnected) {
        setStatus("Connect your account first.");
        await openConnectFlow();
        return;
      }
      const job = getJobData();
      await syncJob(job);
      const url = `${APP_BASE_URL}/generate?url=${encodeURIComponent(job.url)}&title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}&addedAt=${encodeURIComponent(String(job.addedAt))}`;
      chrome.tabs.create({ url });
      setStatus("Opened.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open web app.";
      setStatus(message);
      if (message.toLowerCase().includes("job url")) {
        revealManualEntry();
        jobUrlInput?.focus();
      }
    }
  });

  const manualInputs = [jobTitleInput, jobCompanyInput, jobUrlInput, jobDescriptionInput];
  manualInputs.forEach((input) => {
    input?.addEventListener("input", () => {
      updateSummary();
      if ((!currentJob?.source || currentJob.source === "extension") && jobSourceBadge) {
        jobSourceBadge.textContent = "Manual entry";
      }
    });
  });

  const stored = await chrome.runtime.sendMessage({ type: "GET_CURRENT_JOB" });
  if (stored?.ok && stored.job) {
    applyJob(stored.job);
  }

  const { job, tab } = await requestActiveTabJob();
  if (!job && jobSourceBadge) {
    const tabUrl = tab?.url || "";
    jobSourceBadge.textContent = isSupportedJobSite(tabUrl)
      ? "Refresh page to detect job"
      : "Manual entry";
  }

  updateSummary();

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "JOB_SCRAPED" || !message.job) return;
    applyJob(message.job);
  });
}

init();
