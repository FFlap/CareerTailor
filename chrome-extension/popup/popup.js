import { APP_BASE_URL } from "../common/config.js";
import { setConnectState } from "../common/storage.js";

const authStatusEl = document.getElementById("authStatus");
const connectBtn = document.getElementById("connectBtn");
const openWebAppLink = document.getElementById("openWebApp");

const jobTitleInput = document.getElementById("jobTitle");
const jobCompanyInput = document.getElementById("jobCompany");
const jobUrlInput = document.getElementById("jobUrl");
const jobDescriptionInput = document.getElementById("jobDescription");
const jobSourceBadge = document.getElementById("jobSource");

const refreshJobBtn = document.getElementById("refreshJob");
const syncBtn = document.getElementById("syncBtn");
const generateInAppBtn = document.getElementById("generateInAppBtn");
const statusText = document.getElementById("statusText");

let currentJob = null;
let isConnected = false;

function setStatus(text) {
  statusText.textContent = text || "";
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
  jobTitleInput.value = job?.title || "";
  jobCompanyInput.value = job?.company || "";
  jobUrlInput.value = job?.url || "";
  jobDescriptionInput.value = job?.description || "";
  jobSourceBadge.textContent = `Detected: ${job?.source || "job"}`;
}

function getJobData() {
  const addedAt =
    typeof currentJob?.addedAt === "number" && Number.isFinite(currentJob.addedAt)
      ? currentJob.addedAt
      : Date.now();
  return {
    title: jobTitleInput.value.trim(),
    company: jobCompanyInput.value.trim(),
    url: jobUrlInput.value.trim() || currentJob?.url || "",
    description: jobDescriptionInput.value.trim(),
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
  authStatusEl.textContent = isConnected ? "Connected" : "Not connected";
  connectBtn.textContent = isConnected ? "Reconnect" : "Connect";
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

async function init() {
  if (openWebAppLink) {
    openWebAppLink.href = APP_BASE_URL;
  }

  await refreshAuthStatus();

  connectBtn.addEventListener("click", () => {
    void openConnectFlow();
  });

  refreshJobBtn.addEventListener("click", async () => {
    setStatus("Refreshing…");
    const { job, tab } = await requestActiveTabJob();
    if (!job) {
      const tabUrl = tab?.url || "";
      jobSourceBadge.textContent = isSupportedJobSite(tabUrl)
        ? "Refresh page to detect job"
        : "Manual entry";
      setStatus("No job detected. Paste details manually or open a supported job page.");
    }
  });

  syncBtn.addEventListener("click", async () => {
    setStatus("Syncing…");
    try {
      await refreshAuthStatus();
      if (!isConnected) {
        setStatus("Connect your account first.");
        await openConnectFlow();
        return;
      }
      const job = getJobData();
      await syncJob(job);
      setStatus("Synced.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed.");
    }
  });

  generateInAppBtn.addEventListener("click", async () => {
    setStatus("Opening web app…");
    try {
      await refreshAuthStatus();
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
      setStatus(error instanceof Error ? error.message : "Failed to open web app.");
    }
  });

  const stored = await chrome.runtime.sendMessage({ type: "GET_CURRENT_JOB" });
  if (stored?.ok && stored.job) {
    applyJob(stored.job);
  }

  const { job, tab } = await requestActiveTabJob();
  if (!job) {
    const tabUrl = tab?.url || "";
    jobSourceBadge.textContent = isSupportedJobSite(tabUrl)
      ? "Refresh page to detect job"
      : "Manual entry";
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "JOB_SCRAPED" || !message.job) return;
    applyJob(message.job);
  });
}

init();
