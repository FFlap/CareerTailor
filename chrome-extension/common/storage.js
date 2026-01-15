import { DEFAULT_STORAGE } from "./schema.js";

export function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

export function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

export async function ensureDefaults() {
  const current = await storageGet(Object.keys(DEFAULT_STORAGE));
  const updates = {};
  for (const [key, value] of Object.entries(DEFAULT_STORAGE)) {
    if (current[key] === undefined) {
      updates[key] = value;
    }
  }
  if (Object.keys(updates).length) {
    await storageSet(updates);
  }
  return { ...DEFAULT_STORAGE, ...current, ...updates };
}

export async function getProfile() {
  const { profile } = await storageGet(["profile"]);
  return profile || DEFAULT_STORAGE.profile;
}

export async function setProfile(profile) {
  await storageSet({ profile });
}

export async function getSettings() {
  const { settings } = await storageGet(["settings"]);
  return settings || DEFAULT_STORAGE.settings;
}

export async function setSettings(settings) {
  await storageSet({ settings });
}

export async function getJobs() {
  const { jobs } = await storageGet(["jobs"]);
  return jobs || DEFAULT_STORAGE.jobs;
}

export async function setJobs(jobs) {
  await storageSet({ jobs });
}

export async function getApiKey() {
  const { api } = await storageGet(["api"]);
  return api?.geminiKey || "";
}

export async function setApiKey(key) {
  await storageSet({ api: { geminiKey: key } });
}

export async function getUsageStats() {
  const { usage_stats } = await storageGet(["usage_stats"]);
  return usage_stats || DEFAULT_STORAGE.usage_stats;
}

export async function setUsageStats(usage_stats) {
  await storageSet({ usage_stats });
}

export async function getCurrentJob() {
  const { current_job } = await storageGet(["current_job"]);
  return current_job || null;
}

export async function setCurrentJob(current_job) {
  await storageSet({ current_job });
}

export async function getPreviewPayload() {
  const { preview_payload } = await storageGet(["preview_payload"]);
  return preview_payload || null;
}

export async function setPreviewPayload(preview_payload) {
  await storageSet({ preview_payload });
}
