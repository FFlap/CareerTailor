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

const AUTH_TOKEN_KEY = "convex_auth_token";
const CURRENT_JOB_KEY = "current_job";
const CONNECT_STATE_KEY = "connect_state";

export async function getAuthToken() {
  const result = await storageGet([AUTH_TOKEN_KEY]);
  return result?.[AUTH_TOKEN_KEY] || "";
}

export async function setAuthToken(token) {
  await storageSet({ [AUTH_TOKEN_KEY]: token || "" });
}

export async function clearAuthToken() {
  await storageSet({ [AUTH_TOKEN_KEY]: "" });
}

export async function getCurrentJob() {
  const result = await storageGet([CURRENT_JOB_KEY]);
  return result?.[CURRENT_JOB_KEY] || null;
}

export async function setCurrentJob(job) {
  await storageSet({ [CURRENT_JOB_KEY]: job || null });
}

export async function getConnectState() {
  const result = await storageGet([CONNECT_STATE_KEY]);
  return result?.[CONNECT_STATE_KEY] || "";
}

export async function setConnectState(state) {
  await storageSet({ [CONNECT_STATE_KEY]: state || "" });
}

export async function clearConnectState() {
  await storageSet({ [CONNECT_STATE_KEY]: "" });
}
