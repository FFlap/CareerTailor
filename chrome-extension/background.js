import { APP_BASE_URL, CONVEX_URL } from "./common/config.js";
import { convexMutation } from "./common/convex-http.js";
import { clearAuthToken, getAuthToken, getCurrentJob, setCurrentJob } from "./common/storage.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: `${APP_BASE_URL}/onboarding?from=extension` });
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
    getAuthToken()
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
  const token = await getAuthToken();
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
