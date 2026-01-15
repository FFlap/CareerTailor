import { renderDocument } from "../common/renderer-client.js";

const runTestBtn = document.getElementById("runTest");
const downloadBtn = document.getElementById("downloadPdf");
const statusEl = document.getElementById("status");
const previewFrame = document.getElementById("previewFrame");
const previewShell = document.getElementById("previewShell");
const previewPlaceholder = document.getElementById("previewPlaceholder");
let currentBlobUrl = "";

function updatePreview(blob) {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
  }
  currentBlobUrl = URL.createObjectURL(blob);
  previewFrame.src = currentBlobUrl;
  previewShell.classList.add("has-preview");
  previewPlaceholder.hidden = true;
  downloadBtn.disabled = false;
}

downloadBtn.addEventListener("click", async () => {
  if (!currentBlobUrl) return;
  await chrome.downloads.download({
    url: currentBlobUrl,
    filename: "AI-Resume/jakesResume-test.pdf",
    saveAs: true
  });
});

runTestBtn.addEventListener("click", async () => {
  statusEl.textContent = "Rendering...";
  runTestBtn.disabled = true;
  try {
    const source = await fetch(chrome.runtime.getURL("jakesResume.typst")).then((r) => r.text());
    const pdfBlob = await renderDocument({ source, format: "typst" });
    updatePreview(pdfBlob);
    statusEl.textContent = "Preview ready.";
  } catch (error) {
    statusEl.textContent = error.message || "Render failed.";
    downloadBtn.disabled = !currentBlobUrl;
  } finally {
    runTestBtn.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
  }
});
