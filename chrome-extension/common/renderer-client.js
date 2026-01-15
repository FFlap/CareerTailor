import { getSettings } from "./storage.js";

let sandboxFrame = null;
let sandboxReady = null;
const pending = new Map();
let requestCounter = 0;

function ensureSandboxFrame() {
  if (sandboxFrame && sandboxFrame.isConnected) {
    return sandboxReady;
  }

  sandboxFrame = document.createElement("iframe");
  sandboxFrame.src = chrome.runtime.getURL("pages/renderer-sandbox.html");
  sandboxFrame.style.display = "none";
  sandboxFrame.setAttribute("aria-hidden", "true");
  document.body.appendChild(sandboxFrame);

  sandboxReady = new Promise((resolve) => {
    sandboxFrame.addEventListener("load", () => resolve(), { once: true });
  });

  window.addEventListener("message", handleSandboxMessage);
  return sandboxReady;
}

function handleSandboxMessage(event) {
  if (!sandboxFrame || event.source !== sandboxFrame.contentWindow) return;
  const data = event.data;
  if (!data || data.type !== "RENDER_RESULT") return;

  const entry = pending.get(data.id);
  if (!entry) return;
  pending.delete(data.id);

  if (data.ok) {
    entry.resolve(data.buffer);
  } else {
    entry.reject(new Error(data.error || "Rendering failed"));
  }
}

async function renderViaSandbox({ source, mainPath, assets }) {
  await ensureSandboxFrame();
  const id = `render_${Date.now()}_${requestCounter++}`;
  const frameWindow = sandboxFrame.contentWindow;

  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });

  frameWindow.postMessage(
    {
      type: "RENDER_TYPST",
      id,
      source,
      mainPath,
      assets
    },
    "*"
  );

  return promise;
}

async function renderViaEndpoint({ source, format, endpoint, assets, mainPath }) {
  if (!endpoint) {
    throw new Error("Renderer endpoint is not configured.");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      format,
      source,
      assets,
      mainPath
    })
  });

  if (!response.ok) {
    throw new Error(`Renderer endpoint error (${response.status}).`);
  }
  return response.arrayBuffer();
}

export async function renderDocument({ source, format, assets, mainPath }) {
  const settings = await getSettings();
  if (settings.renderer?.mode === "endpoint") {
    const buffer = await renderViaEndpoint({
      source,
      format,
      endpoint: settings.renderer.endpointUrl,
      assets,
      mainPath
    });
    return new Blob([buffer], { type: "application/pdf" });
  }

  if (format !== "typst") {
    throw new Error("Only Typst rendering is supported in local mode.");
  }

  const buffer = await renderViaSandbox({ source, mainPath, assets });
  return new Blob([buffer], { type: "application/pdf" });
}
