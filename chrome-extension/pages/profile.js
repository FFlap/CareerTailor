import { getProfile, setProfile } from "../common/storage.js";
import { extractResumeText } from "../common/resume-import.js";
import { setupProfileForm } from "./profile-form.js";

const { form, loadProfile, collectProfile, setStatus } = setupProfileForm();
const resumeFileInput = document.getElementById("resumeFile");
const parseResumeBtn = document.getElementById("parseResume");
const resumeStatus = document.getElementById("resumeStatus");
const resumeExtracted = document.getElementById("resumeExtracted");
const resumeExtractedMeta = document.getElementById("resumeExtractedMeta");
const extractPreview = document.getElementById("extractPreview");
const copyExtractedBtn = document.getElementById("copyExtracted");

async function init() {
  const profile = await getProfile();
  loadProfile(profile);

  copyExtractedBtn?.addEventListener("click", async () => {
    if (!resumeExtracted?.value) return;
    try {
      await navigator.clipboard.writeText(resumeExtracted.value);
      if (resumeExtractedMeta) {
        resumeExtractedMeta.textContent = `Copied ${resumeExtracted.value.length} chars.`;
      }
    } catch (error) {
      if (resumeExtractedMeta) {
        resumeExtractedMeta.textContent = "Copy failed.";
      }
    }
  });

  parseResumeBtn?.addEventListener("click", async () => {
    const file = resumeFileInput?.files?.[0];
    if (!file) {
      if (resumeStatus) resumeStatus.textContent = "Choose a resume file first.";
      return;
    }

    if (resumeStatus) resumeStatus.textContent = "Extracting text...";
    parseResumeBtn.disabled = true;
    try {
      const text = await extractResumeText(file);
      if (resumeExtracted) {
        resumeExtracted.value = text;
      }
      if (resumeExtractedMeta) {
        resumeExtractedMeta.textContent = text ? `${text.length} characters extracted.` : "No text extracted.";
      }
      if (extractPreview && text) {
        extractPreview.open = true;
      }
      if (!text || text.length < 40) {
        if (resumeStatus) resumeStatus.textContent = "Resume text was too short to parse.";
        return;
      }

      const keyStatus = await chrome.runtime.sendMessage({ type: "GET_API_KEY_STATUS" });
      if (!keyStatus?.ok || !keyStatus.hasKey) {
        if (resumeStatus) resumeStatus.textContent = "Add your Gemini API key in Settings first.";
        return;
      }

      if (resumeStatus) resumeStatus.textContent = "Asking Gemini to fill your profile...";
      const response = await chrome.runtime.sendMessage({
        type: "IMPORT_RESUME",
        resumeText: text,
        fileName: file.name
      });

      if (!response.ok) {
        if (resumeStatus) resumeStatus.textContent = response.error || "Auto-fill failed.";
        return;
      }

      loadProfile(response.profile);
      if (resumeStatus) resumeStatus.textContent = "Profile auto-filled. Review and save.";
    } catch (error) {
      if (resumeStatus) resumeStatus.textContent = error.message || "Resume parsing failed.";
    } finally {
      parseResumeBtn.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const updated = collectProfile();
    await setProfile(updated);
    setStatus("Profile saved.");
  });
}

init();
