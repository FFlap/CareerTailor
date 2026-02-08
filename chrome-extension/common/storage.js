import { APP_BASE_URL, CONVEX_URL } from "./config.js";

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
const BLOCKER_SETTINGS_KEY = "site_blocker_settings";

const DEFAULT_BLOCKER_SETTINGS = Object.freeze({
  enabled: false,
  requiredAppliedCount: 5,
  blockedDomains: [],
  matchMode: "domain_subdomains",
  failurePolicy: "open"
});

function getScopedAuthTokenKey() {
  return `${AUTH_TOKEN_KEY}:${APP_BASE_URL}|${CONVEX_URL}`;
}

async function findFallbackScopedToken() {
  const all = await storageGet(null);
  if (!all || typeof all !== "object") return "";

  const prefix = `${AUTH_TOKEN_KEY}:`;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(prefix)) continue;
    if (!key.endsWith(`|${CONVEX_URL}`)) continue;
    if (typeof value !== "string" || !value) continue;
    if (isJwtExpired(value)) continue;
    return value;
  }
  return "";
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isJwtExpired(token) {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + 30;
}

export async function getAuthToken() {
  const scopedKey = getScopedAuthTokenKey();
  const result = await storageGet([scopedKey, AUTH_TOKEN_KEY]);
  const scoped = result?.[scopedKey] || "";
  const legacy = result?.[AUTH_TOKEN_KEY] || "";
  let token = scoped || legacy || "";
  if (!token) {
    token = await findFallbackScopedToken();
  }
  if (!token) return "";
  if (isJwtExpired(token)) {
    await storageSet({ [scopedKey]: "" });
    if (legacy) await storageSet({ [AUTH_TOKEN_KEY]: "" });
    return "";
  }
  if (!scoped && token) {
    await storageSet({ [scopedKey]: token });
    if (legacy && legacy !== token) {
      await storageSet({ [AUTH_TOKEN_KEY]: "" });
    }
  }
  return token;
}

export async function setAuthToken(token) {
  const scopedKey = getScopedAuthTokenKey();
  await storageSet({ [scopedKey]: token || "" });
}

export async function clearAuthToken() {
  const scopedKey = getScopedAuthTokenKey();
  await storageSet({ [scopedKey]: "" });
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

function normalizeDomainEntry(raw) {
  const input = String(raw || "").trim().toLowerCase();
  if (!input) return "";

  const withoutWildcard = input.replace(/^\*\./, "");
  const prefixed =
    withoutWildcard.includes("://") || withoutWildcard.startsWith("chrome-extension://")
      ? withoutWildcard
      : `https://${withoutWildcard}`;

  try {
    const parsed = new URL(prefixed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    let host = parsed.hostname.trim().toLowerCase().replace(/\.$/, "");
    if (!host) return "";
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    if (!host || host.includes("..")) return "";
    if (!/^[a-z0-9.-]+$/.test(host)) return "";
    return host;
  } catch {
    return "";
  }
}

function sanitizeBlockerSettings(input) {
  const requiredRaw = Number(input?.requiredAppliedCount);
  const requiredAppliedCount =
    Number.isFinite(requiredRaw) && requiredRaw >= 0 ? Math.floor(requiredRaw) : 5;

  const blockedDomains = Array.isArray(input?.blockedDomains)
    ? Array.from(
        new Set(
          input.blockedDomains
            .map((item) => normalizeDomainEntry(item))
            .filter(Boolean)
        )
      )
    : [];

  return {
    enabled: Boolean(input?.enabled),
    requiredAppliedCount,
    blockedDomains,
    matchMode: "domain_subdomains",
    failurePolicy: "open"
  };
}

export function getDefaultBlockerSettings() {
  return {
    ...DEFAULT_BLOCKER_SETTINGS,
    blockedDomains: []
  };
}

export async function getBlockerSettings() {
  const result = await storageGet([BLOCKER_SETTINGS_KEY]);
  const saved = result?.[BLOCKER_SETTINGS_KEY];
  if (!saved || typeof saved !== "object") {
    return getDefaultBlockerSettings();
  }
  return sanitizeBlockerSettings(saved);
}

export async function setBlockerSettings(settings) {
  const sanitized = sanitizeBlockerSettings(settings);
  await storageSet({ [BLOCKER_SETTINGS_KEY]: sanitized });
  return sanitized;
}
