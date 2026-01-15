import { getProfile, setProfile } from "../common/storage.js";
import { extractResumeText } from "../common/resume-import.js";
import { setupProfileForm } from "./profile-form.js";

const steps = Array.from(document.querySelectorAll(".step"));
const stepper = document.getElementById("stepper");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");
const apiKeyInput = document.getElementById("apiKey");
const validateKeyBtn = document.getElementById("validateKey");
const apiStatus = document.getElementById("apiStatus");
const resumeFileInput = document.getElementById("resumeFile");
const parseResumeBtn = document.getElementById("parseResume");
const resumeStatus = document.getElementById("resumeStatus");

const { form, loadProfile, collectProfile, setStatus } = setupProfileForm();
let currentStep = 0;

function renderStepper() {
  stepper.innerHTML = "";
  const labels = ["Personal", "Education", "Experience", "Skills", "Projects", "Resume", "API Key"];
  labels.forEach((label, index) => {
    const pill = document.createElement("div");
    pill.className = "step-pill";
    if (index === currentStep) pill.classList.add("active");
    pill.textContent = `${index + 1}. ${label}`;
    stepper.appendChild(pill);
  });
}

function updateSteps() {
  steps.forEach((step, index) => {
    step.classList.toggle("active", index === currentStep);
  });
  backBtn.disabled = currentStep === 0;
  nextBtn.style.display = currentStep === steps.length - 1 ? "none" : "inline-flex";
  finishBtn.style.display = currentStep === steps.length - 1 ? "inline-flex" : "none";
  renderStepper();
}

async function init() {
  const profile = await getProfile();
  loadProfile(profile);
  updateSteps();

  backBtn.addEventListener("click", () => {
    currentStep = Math.max(0, currentStep - 1);
    updateSteps();
  });

  nextBtn.addEventListener("click", () => {
    currentStep = Math.min(steps.length - 1, currentStep + 1);
    updateSteps();
  });

  parseResumeBtn.addEventListener("click", async () => {
    const file = resumeFileInput.files?.[0];
    if (!file) {
      resumeStatus.textContent = "Choose a resume file first.";
      return;
    }

    resumeStatus.textContent = "Extracting text...";
    try {
      const text = await extractResumeText(file);
      if (!text || text.length < 40) {
        resumeStatus.textContent = "Resume text was too short to parse.";
        return;
      }

      const keyStatus = await chrome.runtime.sendMessage({ type: "GET_API_KEY_STATUS" });
      if (!keyStatus?.ok || !keyStatus.hasKey) {
        resumeStatus.textContent = "Add your Gemini API key first (next step).";
        currentStep = steps.length - 1;
        updateSteps();
        return;
      }

      resumeStatus.textContent = "Asking Gemini to fill your profile...";
      const response = await chrome.runtime.sendMessage({
        type: "IMPORT_RESUME",
        resumeText: text,
        fileName: file.name
      });

      if (!response.ok) {
        resumeStatus.textContent = response.error || "Auto-fill failed.";
        return;
      }

      loadProfile(response.profile);
      resumeStatus.textContent = "Profile auto-filled. Review each step.";
    } catch (error) {
      resumeStatus.textContent = error.message || "Resume parsing failed.";
    }
  });

  validateKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      apiStatus.textContent = "Enter a key to validate.";
      return;
    }
    apiStatus.textContent = "Validating...";
    const response = await chrome.runtime.sendMessage({
      type: "VALIDATE_API_KEY",
      apiKey: key
    });
    apiStatus.textContent = response.ok ? "Key valid." : response.error || "Validation failed.";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const updated = collectProfile();
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      setStatus("Add your Gemini API key to finish onboarding.");
      return;
    }
    const keyResponse = await chrome.runtime.sendMessage({
      type: "SET_API_KEY",
      apiKey
    });
    if (!keyResponse.ok) {
      setStatus(keyResponse.error || "Failed to save API key.");
      return;
    }
    await setProfile(updated);
    setStatus("Onboarding complete. You can now generate resumes.");
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/profile.html") });
  });
}

init();
