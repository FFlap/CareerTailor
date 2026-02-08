const blockedDomainEl = document.getElementById("blockedDomain");
const quotaProgressEl = document.getElementById("quotaProgress");
const blockedReasonEl = document.getElementById("blockedReason");
const blockedStatusEl = document.getElementById("blockedStatus");
const checkAgainBtn = document.getElementById("checkAgainBtn");
const openSettingsBtn = document.getElementById("openSettingsBtn");

function setStatus(text) {
  if (blockedStatusEl) blockedStatusEl.textContent = text || "";
}

function parseParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    targetUrl: params.get("target") || "",
    blockedDomain: params.get("domain") || "",
    applied: Number(params.get("applied") || 0),
    required: Number(params.get("required") || 0),
    reason: params.get("reason") || "quota_not_met"
  };
}

function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function renderInitialState(state) {
  if (blockedDomainEl) {
    blockedDomainEl.textContent = state.blockedDomain || "This website";
  }
  if (quotaProgressEl) {
    quotaProgressEl.textContent = `${state.applied} / ${state.required}`;
  }
  if (blockedReasonEl) {
    blockedReasonEl.textContent =
      state.reason === "quota_not_met"
        ? "Complete more applications to unlock this site."
        : "This site is blocked by your current extension settings.";
  }
}

async function checkAccess(state) {
  if (!state.targetUrl || !isHttpUrl(state.targetUrl)) {
    setStatus("Invalid target URL.");
    return;
  }

  setStatus("Checking quota...");
  const response = await chrome.runtime.sendMessage({
    type: "CHECK_TARGET_ACCESS",
    targetUrl: state.targetUrl
  });

  if (!response?.ok) {
    setStatus(response?.error || "Could not refresh access status.");
    return;
  }

  if (response.allowed) {
    setStatus("Quota met. Opening website...");
    window.location.replace(state.targetUrl);
    return;
  }

  if (quotaProgressEl) {
    quotaProgressEl.textContent = `${response.appliedOrBeyondCount || 0} / ${
      response.requiredAppliedCount || 0
    }`;
  }
  setStatus("Still blocked. Apply to more jobs today and try again.");
}

async function openExtensionSettingsPage() {
  const response = await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_TAB" });
  if (!response?.ok) {
    setStatus(response?.error || "Failed to open extension settings.");
  }
}

function init() {
  const state = parseParams();
  renderInitialState(state);

  checkAgainBtn?.addEventListener("click", () => {
    void checkAccess(state);
  });

  openSettingsBtn?.addEventListener("click", () => {
    void openExtensionSettingsPage();
  });
}

init();
