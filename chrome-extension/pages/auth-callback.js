import { clearConnectState, getConnectState, setAuthToken } from "../common/storage.js";

const statusEl = document.getElementById("status");

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function getParamsFromLocation() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  return {
    token: params.get("token") || "",
    state: params.get("state") || ""
  };
}

async function main() {
  const { token, state } = getParamsFromLocation();
  if (!token) {
    setStatus("Missing token. Go back and try connecting again.");
    return;
  }
  const expectedState = await getConnectState();
  if (!state || !expectedState || state !== expectedState) {
    await clearConnectState();
    setStatus("Invalid connect state. Reconnect from the extension popup.");
    return;
  }
  await setAuthToken(token);
  await clearConnectState();
  try {
    history.replaceState(null, "", window.location.pathname);
  } catch {
    // ignore
  }
  setStatus("Connected! You can close this tab.");
  setTimeout(() => window.close(), 500);
}

main().catch((error) => {
  setStatus(error?.message || "Failed to save token.");
});
