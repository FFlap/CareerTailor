import {
  COVER_TEMPLATES,
  DEFAULT_COVER_TEMPLATE_ID,
  DEFAULT_RESUME_TEMPLATE_ID,
  RESUME_TEMPLATES
} from "../common/constants.js";
import { getSettings, setSettings } from "../common/storage.js";

const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKey");
const validateKeyBtn = document.getElementById("validateKey");
const keyStatus = document.getElementById("keyStatus");

const resumeTemplateSelect = document.getElementById("resumeTemplate");
const coverTemplateSelect = document.getElementById("coverTemplate");
const toneSelect = document.getElementById("tone");
const targetLengthSelect = document.getElementById("targetLength");
const rendererModeSelect = document.getElementById("rendererMode");
const rendererEndpointInput = document.getElementById("rendererEndpoint");
const saveSettingsBtn = document.getElementById("saveSettings");
const settingsStatus = document.getElementById("settingsStatus");

function populateSelect(select, templates) {
  select.innerHTML = "";
  Object.values(templates).forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.label;
    select.appendChild(option);
  });
}

async function init() {
  const keyStatusResponse = await chrome.runtime.sendMessage({ type: "GET_API_KEY_STATUS" });
  if (keyStatusResponse?.ok && keyStatusResponse.hasKey) {
    apiKeyInput.placeholder = "Key saved in storage";
  }

  const settings = await getSettings();
  populateSelect(resumeTemplateSelect, RESUME_TEMPLATES);
  populateSelect(coverTemplateSelect, COVER_TEMPLATES);
  resumeTemplateSelect.value = RESUME_TEMPLATES[settings.resumeTemplate]
    ? settings.resumeTemplate
    : DEFAULT_RESUME_TEMPLATE_ID;
  coverTemplateSelect.value = COVER_TEMPLATES[settings.coverTemplate]
    ? settings.coverTemplate
    : DEFAULT_COVER_TEMPLATE_ID;
  toneSelect.value = settings.tone;
  targetLengthSelect.value = settings.targetLength;
  rendererModeSelect.value = settings.renderer?.mode || "wasm";
  rendererEndpointInput.value = settings.renderer?.endpointUrl || "";

  saveKeyBtn.addEventListener("click", async () => {
    const response = await chrome.runtime.sendMessage({
      type: "SET_API_KEY",
      apiKey: apiKeyInput.value.trim()
    });
    keyStatus.textContent = response.ok ? "Saved." : response.error || "Save failed.";
  });

  validateKeyBtn.addEventListener("click", async () => {
    keyStatus.textContent = "Validating...";
    const response = await chrome.runtime.sendMessage({
      type: "VALIDATE_API_KEY",
      apiKey: apiKeyInput.value.trim()
    });
    keyStatus.textContent = response.ok ? "Key valid." : response.error || "Validation failed.";
  });

  saveSettingsBtn.addEventListener("click", async () => {
    await setSettings({
      resumeTemplate: resumeTemplateSelect.value,
      coverTemplate: coverTemplateSelect.value,
      tone: toneSelect.value,
      targetLength: targetLengthSelect.value,
      renderer: {
        mode: rendererModeSelect.value,
        endpointUrl: rendererEndpointInput.value.trim()
      }
    });
    settingsStatus.textContent = "Settings saved.";
  });
}

init();
