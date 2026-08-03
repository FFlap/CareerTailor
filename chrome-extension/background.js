import { APP_BASE_URL, CONVEX_URL } from "./common/config.js";
import { convexMutation, convexQuery } from "./common/convex-http.js";
import {
  clearAuthToken,
  getAuthToken,
  getBlockerSettings,
  getCurrentJob,
  setConnectState,
  setBlockerSettings,
  setCurrentJob
} from "./common/storage.js";

const BLOCKED_PAGE_PATH = "pages/blocked.html";
const BLOCKED_PAGE_URL = chrome.runtime.getURL(BLOCKED_PAGE_PATH);
const PROGRESS_CACHE_TTL_MS = 30_000;
const AUTO_RECONNECT_TIMEOUT_MS = 8_000;
const AUTO_RECONNECT_COOLDOWN_MS = 60_000;

let progressCache = {
  token: "",
  expiresAt: 0,
  value: null
};

let reconnectPromise = null;
let lastReconnectAttemptAt = 0;

function generateConnectState() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTab(url, active = false) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active }, (tab) => {
      const message = chrome.runtime.lastError?.message;
      if (message || !tab?.id) {
        reject(new Error(message || "Failed to open reconnect tab."));
        return;
      }
      resolve(tab.id);
    });
  });
}

function closeTab(tabId) {
  if (!Number.isInteger(tabId)) return;
  chrome.tabs.remove(tabId, () => {
    void chrome.runtime.lastError;
  });
}

async function waitForAuthToken(timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const token = await getAuthToken();
    if (token) return token;
    await sleep(250);
  }
  return "";
}

async function attemptAutoReconnect() {
  if (reconnectPromise) return reconnectPromise;
  if (Date.now() - lastReconnectAttemptAt < AUTO_RECONNECT_COOLDOWN_MS) {
    return "";
  }
  lastReconnectAttemptAt = Date.now();

  reconnectPromise = (async () => {
    let reconnectTabId = null;
    try {
      const redirectUri = chrome.runtime.getURL("pages/auth-callback.html");
      const state = generateConnectState();
      await setConnectState(state);
      const url = `${APP_BASE_URL}/extension/connect?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&auto=1`;
      reconnectTabId = await createTab(url, false);
      const token = await waitForAuthToken(AUTO_RECONNECT_TIMEOUT_MS);
      return token || "";
    } catch {
      return "";
    } finally {
      if (reconnectTabId !== null) {
        closeTab(reconnectTabId);
      }
      reconnectPromise = null;
    }
  })();

  return reconnectPromise;
}

async function getValidAuthToken({ tryReconnect = false } = {}) {
  let token = await getAuthToken();
  if (token || !tryReconnect) {
    return token || "";
  }
  token = await attemptAutoReconnect();
  return token || "";
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: `${APP_BASE_URL}/profile?from=extension` });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const targetUrl = typeof changeInfo.url === "string" ? changeInfo.url : tab?.url;
  if (!targetUrl) return;
  void enforceBlockingForTab(tabId, targetUrl);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "JOB_SCRAPED") {
    handleJobScraped(message.job, sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_CURRENT_JOB") {
    getCurrentJob()
      .then((job) => sendResponse({ ok: true, job }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_AUTH_STATUS") {
    getValidAuthToken({ tryReconnect: true })
      .then((token) => sendResponse({ ok: true, connected: Boolean(token) }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "SYNC_JOB" && message.job) {
    syncJobToConvex(message.job)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_BLOCKER_SETTINGS") {
    getBlockerSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "SAVE_BLOCKER_SETTINGS") {
    setBlockerSettings(message.settings || {})
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_BLOCKER_PROGRESS") {
    getBlockerProgress(Boolean(message.force))
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CHECK_TARGET_ACCESS" && message.targetUrl) {
    evaluateTargetAccess(message.targetUrl, { forceProgressRefresh: true })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OPEN_SETTINGS_TAB") {
    chrome.tabs.create({ url: `${chrome.runtime.getURL("popup/popup.html")}#settings` }, () => {
      const message = chrome.runtime.lastError?.message;
      if (message) {
        sendResponse({
          ok: false,
          error: message || "Failed to open settings page."
        });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});

async function handleJobScraped(job, sender) {
  const url = job?.url || sender?.tab?.url || "";
  const existing = await getCurrentJob().catch(() => null);
  const existingAddedAt =
    existing?.url === url &&
    typeof existing?.addedAt === "number" &&
    Number.isFinite(existing.addedAt)
      ? existing.addedAt
      : undefined;
  const jobAddedAt =
    typeof job?.addedAt === "number" && Number.isFinite(job.addedAt)
      ? job.addedAt
      : undefined;
  const merged = {
    ...(job || {}),
    url,
    addedAt: existingAddedAt ?? jobAddedAt ?? Date.now()
  };
  await setCurrentJob(merged);
  await syncJobToConvex(merged).catch(() => {});
}

async function syncJobToConvex(job) {
  const token = await getValidAuthToken({ tryReconnect: true });
  if (!token) {
    throw new Error("Not connected. Connect your account first.");
  }

  const url = String(job?.url || "").trim();
  if (!url) {
    throw new Error("Job URL missing.");
  }

  return await convexMutation({
    convexUrl: CONVEX_URL,
    authToken: token,
    path: "jobs:upsertMyJob",
    args: {
      url,
      jobId: String(job?.jobId || ""),
      source: String(job?.source || "extension"),
      title: String(job?.title || ""),
      company: String(job?.company || ""),
      description: String(job?.description || ""),
      addedAt:
        typeof job?.addedAt === "number" && Number.isFinite(job.addedAt)
          ? job.addedAt
          : Date.now()
    }
  }).catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error || "");
    if (message.includes("Unauthenticated")) {
      await clearAuthToken();
      throw new Error("Session expired. Please reconnect your account.");
    }
    throw error;
  });
}

function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isExtensionUrl(url) {
  return String(url || "").startsWith(chrome.runtime.getURL(""));
}

function getHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

function findMatchedDomain(hostname, blockedDomains) {
  if (!hostname || !Array.isArray(blockedDomains)) return "";
  for (const rawDomain of blockedDomains) {
    const domain = String(rawDomain || "").trim().toLowerCase();
    if (!domain) continue;
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return domain;
    }
  }
  return "";
}

function getLocalDayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    sinceMs: start.getTime(),
    untilMs: end.getTime()
  };
}

async function fetchAppliedProgress({ force = false } = {}) {
  const token = await getValidAuthToken({ tryReconnect: true });
  if (!token) {
    progressCache = { token: "", expiresAt: 0, value: null };
    return {
      connected: false,
      appliedOrBeyondCount: 0,
      totalTrackedJobs: 0
    };
  }

  const now = Date.now();
  if (
    !force &&
    progressCache.value &&
    progressCache.token === token &&
    progressCache.expiresAt > now
  ) {
    return progressCache.value;
  }

  try {
    const dayRange = getLocalDayRange();
    const result = await convexQuery({
      convexUrl: CONVEX_URL,
      authToken: token,
      path: "jobs:getMyAppliedProgress",
      args: dayRange
    });

    const value = {
      connected: true,
      appliedOrBeyondCount: Number(result?.appliedOrBeyondCount || 0),
      totalTrackedJobs: Number(result?.totalTrackedJobs || 0)
    };
    progressCache = {
      token,
      value,
      expiresAt: now + PROGRESS_CACHE_TTL_MS
    };
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (message.includes("Unauthenticated")) {
      await clearAuthToken();
      progressCache = { token: "", expiresAt: 0, value: null };
      return {
        connected: false,
        appliedOrBeyondCount: 0,
        totalTrackedJobs: 0,
        error: "Session expired. Please reconnect your account."
      };
    }
    return {
      connected: true,
      appliedOrBeyondCount: 0,
      totalTrackedJobs: 0,
      error: message || "Failed to check quota progress."
    };
  }
}

async function getBlockerProgress(force = false) {
  const [settings, progress] = await Promise.all([
    getBlockerSettings(),
    fetchAppliedProgress({ force })
  ]);

  const requiredAppliedCount = Number(settings.requiredAppliedCount || 0);
  const appliedOrBeyondCount = Number(progress.appliedOrBeyondCount || 0);
  const quotaMet = requiredAppliedCount <= 0 || appliedOrBeyondCount >= requiredAppliedCount;

  return {
    connected: Boolean(progress.connected),
    appliedOrBeyondCount,
    totalTrackedJobs: Number(progress.totalTrackedJobs || 0),
    requiredAppliedCount,
    quotaMet,
    error: progress.error || ""
  };
}

async function evaluateTargetAccess(targetUrl, options = {}) {
  const url = String(targetUrl || "");
  if (!isHttpUrl(url) || isExtensionUrl(url)) {
    return { allowed: true, reason: "unsupported_url" };
  }

  const settings = await getBlockerSettings();
  if (!settings.enabled) {
    return { allowed: true, reason: "disabled" };
  }

  const requiredAppliedCount = Number(settings.requiredAppliedCount || 0);
  if (requiredAppliedCount <= 0) {
    return { allowed: true, reason: "quota_disabled" };
  }

  const hostname = getHost(url);
  const matchedDomain = findMatchedDomain(hostname, settings.blockedDomains);
  if (!matchedDomain) {
    return { allowed: true, reason: "not_blocked_domain" };
  }

  const progress = await fetchAppliedProgress({
    force: Boolean(options.forceProgressRefresh)
  });

  // Fail-open policy: if disconnected or quota lookup fails, do not block.
  if (!progress.connected || progress.error) {
    return {
      allowed: true,
      reason: progress.connected ? "progress_unavailable" : "not_connected",
      matchedDomain
    };
  }

  const appliedOrBeyondCount = Number(progress.appliedOrBeyondCount || 0);
  const quotaMet = appliedOrBeyondCount >= requiredAppliedCount;
  if (quotaMet) {
    return {
      allowed: true,
      reason: "quota_met",
      matchedDomain,
      appliedOrBeyondCount,
      requiredAppliedCount
    };
  }

  return {
    allowed: false,
    reason: "quota_not_met",
    matchedDomain,
    appliedOrBeyondCount,
    requiredAppliedCount
  };
}

function buildBlockedPageUrl({
  targetUrl,
  matchedDomain,
  appliedOrBeyondCount,
  requiredAppliedCount,
  reason
}) {
  const params = new URLSearchParams();
  params.set("target", targetUrl);
  params.set("domain", matchedDomain || "");
  params.set("applied", String(appliedOrBeyondCount || 0));
  params.set("required", String(requiredAppliedCount || 0));
  params.set("reason", reason || "quota_not_met");
  return `${BLOCKED_PAGE_URL}?${params.toString()}`;
}

async function enforceBlockingForTab(tabId, targetUrl) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  if (!targetUrl || !isHttpUrl(targetUrl)) return;
  if (targetUrl.startsWith(BLOCKED_PAGE_URL) || isExtensionUrl(targetUrl)) return;

  const access = await evaluateTargetAccess(targetUrl, { forceProgressRefresh: false });
  if (access.allowed) return;

  const blockedUrl = buildBlockedPageUrl({
    targetUrl,
    matchedDomain: access.matchedDomain,
    appliedOrBeyondCount: access.appliedOrBeyondCount,
    requiredAppliedCount: access.requiredAppliedCount,
    reason: access.reason
  });
  chrome.tabs.update(tabId, { url: blockedUrl }, () => {
    // Ignore update failures for tabs that close during redirect.
    void chrome.runtime.lastError;
  });
}
