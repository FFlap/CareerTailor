import { callGemini, callGeminiText, safeJsonParse } from "./common/gemini.js";
import { COVER_TEMPLATES, GEMINI_MODEL, RESUME_TEMPLATES } from "./common/constants.js";
import {
  ensureDefaults,
  getApiKey,
  getCurrentJob,
  getJobs,
  getProfile,
  getSettings,
  setApiKey,
  setCurrentJob,
  setJobs
} from "./common/storage.js";
import { nowTimestamp } from "./common/utils.js";

ensureDefaults();

chrome.runtime.onInstalled.addListener(async () => {
  const profile = await getProfile();
  const isEmpty = !profile?.personal?.fullName;
  if (isEmpty) {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/onboarding.html") });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "JOB_SCRAPED") {
    handleJobScraped(message, sender).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "GET_CURRENT_JOB") {
    getCurrentJob().then((job) => sendResponse({ ok: true, job }));
    return true;
  }
  if (message?.type === "GENERATE_DOCS") {
    handleGenerateDocs(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
  if (message?.type === "REGENERATE_VARIANT") {
    handleRegenerateVariant(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
  if (message?.type === "VALIDATE_API_KEY") {
    handleValidateApiKey(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
  if (message?.type === "IMPORT_RESUME") {
    handleImportResume(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
  if (message?.type === "SET_API_KEY") {
    handleSetApiKey(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
  if (message?.type === "GET_API_KEY_STATUS") {
    getApiKey()
      .then((key) => sendResponse({ ok: true, hasKey: Boolean(key) }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

async function handleJobScraped(message, sender) {
  const url = message.job?.url || sender?.tab?.url || "";
  const job = {
    ...message.job,
    url
  };
  await setCurrentJob(job);

  if (!url) return;
  const jobs = await getJobs();
  const existing = jobs[url] || {};
  jobs[url] = {
    ...existing,
    title: job.title || existing.title || "",
    company: job.company || existing.company || "",
    description: job.description || existing.description || "",
    jobId: job.jobId || existing.jobId || "",
    url,
    variants: existing.variants || []
  };
  await setJobs(jobs);
}

async function handleGenerateDocs(message) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key. Set it in Settings.");
  }

  const profile = message.profile || (await getProfile());
  const job = message.job || (await getCurrentJob()) || {};
  const settings = await getSettings();
  const documentType = message.documentType || "both";
  const resumeTemplate = message.resumeTemplate || settings.resumeTemplate;
  const coverTemplate = message.coverTemplate || settings.coverTemplate;
  const preferences = message.preferences || {
    tone: settings.tone,
    target_length: settings.targetLength
  };

  const resumeTemplateText = (documentType === "resume" || documentType === "both")
    ? await loadTemplateText(RESUME_TEMPLATES, resumeTemplate)
    : "";
  const coverTemplateText = (documentType === "cover_letter" || documentType === "both")
    ? await loadTemplateText(COVER_TEMPLATES, coverTemplate)
    : "";

  const generated = {};
  if (documentType === "resume" || documentType === "both") {
    const resumePrompt = buildPrompt({
      profile,
      job,
      documentType: "resume",
      templateStyle: resumeTemplate,
      preferences,
      templateText: resumeTemplateText
    });
    const response = await callGemini({ apiKey, prompt: resumePrompt });
    generated.resume = response.resume || response;
  }
  if (documentType === "cover_letter" || documentType === "both") {
    const coverPrompt = buildPrompt({
      profile,
      job,
      documentType: "cover_letter",
      templateStyle: coverTemplate,
      preferences,
      templateText: coverTemplateText
    });
    const response = await callGemini({ apiKey, prompt: coverPrompt });
    generated.cover_letter = response.cover_letter || response;
  }

  const variant = {
    id: `var_${Date.now()}`,
    timestamp: nowTimestamp(),
    resume: generated.resume || null,
    cover_letter: generated.cover_letter || null,
    templates: {
      resume: resumeTemplate,
      cover: coverTemplate
    }
  };

  const jobUrl = job.url || message.jobUrl || "";
  if (jobUrl) {
    const jobs = await getJobs();
    const existing = jobs[jobUrl] || {
      title: job.title || "",
      company: job.company || "",
      description: job.description || "",
      url: jobUrl,
      variants: []
    };
    existing.variants = [variant, ...(existing.variants || [])];
    jobs[jobUrl] = existing;
    await setJobs(jobs);
  }

  return { ok: true, variant, job };
}

function buildPrompt({ profile, job, documentType, templateStyle, preferences, templateText }) {
  const base = {
    user_profile: profile,
    job: {
      title: job.title || "",
      company: job.company || "",
      description: job.description || ""
    },
    document_type: documentType,
    template_style: templateStyle,
    preferences: {
      tone: preferences.tone || "professional",
      target_length: preferences.target_length || "1_page"
    }
  };

  const outputFormat = documentType === "resume"
    ? JSON.stringify({
      resume: {
        header: {
          name: "",
          email: "",
          phone: "",
          location: "",
          links: []
        },
        summary: "",
        skills: [],
        experience: [],
        projects: [
          {
            name: "",
            technologies: [],
            link: "",
            bullets: []
          }
        ],
        education: []
      }
    })
    : `{"cover_letter": {"greeting": "", "body_paragraphs": [], "closing": "", "signature_name": ""}}`;

  const resumeInstructions = documentType === "resume"
    ? [
      "Follow the selected template style exactly. Do not add new sections or extra fields beyond the schema.",
      "Use only the most relevant profile information and tailor wording to keywords from the job description.",
      "Bullets should follow an XYZ impact pattern (accomplished X as measured by Y by doing Z), without repeating the exact template sentence.",
      "Keep section order implied by the template; avoid invented headers, awards, certifications, or publications.",
      "If the template does not include a summary/about-me/intro section, leave summary as an empty string."
    ]
    : [];

  return [
    "You are an expert ATS resume and cover letter writer.",
    "Return only valid JSON with no extra commentary.",
    "Tailor content to the job description, use quantified impact, and avoid fabrication.",
    "Use standard headings and keep it ATS-friendly.",
    ...resumeInstructions,
    `Model: ${GEMINI_MODEL}`,
    `Input: ${JSON.stringify(base)}`,
    `Template (formatting reference only; do not describe it or output it):\n---TEMPLATE START---\n${templateText || ""}\n---TEMPLATE END---`,
    `Output format: ${outputFormat}`
  ].join("\n");
}

async function loadTemplateText(templates, templateId) {
  const template = templates?.[templateId];
  if (!template?.path) return "";
  try {
    const response = await fetch(chrome.runtime.getURL(template.path));
    if (!response.ok) return "";
    return await response.text();
  } catch (error) {
    return "";
  }
}

async function handleRegenerateVariant(message) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key.");
  }

  const { job, variant, instructions } = message;
  const prompt = [
    "You are refining an existing resume/cover letter JSON.",
    "Return only valid JSON and keep the same schema.",
    `Instructions: ${instructions}`,
    `Existing data: ${JSON.stringify({ resume: variant.resume, cover_letter: variant.cover_letter })}`,
    `Job context: ${JSON.stringify(job || {})}`
  ].join("\n");

  const response = await callGemini({ apiKey, prompt });

  const updatedVariant = {
    ...variant,
    resume: response.resume || variant.resume,
    cover_letter: response.cover_letter || variant.cover_letter,
    timestamp: nowTimestamp()
  };

  if (job?.url) {
    const jobs = await getJobs();
    const existing = jobs[job.url];
    if (existing) {
      existing.variants = [updatedVariant, ...(existing.variants || []).filter((v) => v.id !== variant.id)];
      jobs[job.url] = existing;
      await setJobs(jobs);
    }
  }

  return { ok: true, variant: updatedVariant };
}

async function handleValidateApiKey(message) {
  const { apiKey } = message;
  if (!apiKey) {
    throw new Error("API key is required.");
  }
  const prompt = "Return JSON with {\"status\":\"ok\"}.";
  await callGemini({ apiKey, prompt });
  return { ok: true };
}

async function handleImportResume(message) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key. Add it in onboarding.");
  }
  const resumeText = String(message.resumeText || "").trim();
  if (resumeText.length < 40) {
    throw new Error("Resume text is too short to parse.");
  }
  const clippedText = resumeText.slice(0, 20000);
  const schemaJson = JSON.stringify(
    {
      profile: {
        personal: {
          fullName: "",
          email: "",
          phone: "",
          location: "",
          links: [{ label: "", url: "" }]
        },
        summary: "",
        education: [
          {
            degree: "",
            major: "",
            institution: "",
            location: "",
            startDate: "",
            endDate: ""
          }
        ],
        experience: [
          {
            title: "",
            company: "",
            location: "",
            startDate: "",
            endDate: "",
            bullets: [""]
          }
        ],
        skills: [
          {
            category: "",
            items: [""]
          }
        ],
        projects: [
          {
            name: "",
            technologies: [""],
            link: "",
            bullets: [""]
          }
        ]
      }
    },
    null,
    0
  );

  const limitsText = [
    "Limits:",
    "- max 4 experience entries",
    "- max 3 bullets per experience",
    "- max 2 education entries",
    "- max 3 projects",
    "- max 3 bullets per project",
    "- max 3 skill categories",
    "- max 8 skills per category",
    "- max 5 links",
    "- summary max 3 sentences"
  ].join("\n");

  const prompt = [
    "Extract a structured resume profile from the provided resume text.",
    "Return ONLY a single JSON object that parses with JSON.parse.",
    "No markdown, no code fences, no comments, no trailing text.",
    "Use the exact schema below with these exact keys only.",
    "If a field is missing, use an empty string or empty array.",
    "Do not fabricate dates, companies, or metrics.",
    "Output must be valid JSON (double quotes, no trailing commas).",
    limitsText,
    "Schema:",
    schemaJson,
    `Resume text (truncated): ${clippedText}`
  ].join("\n");

  const importConfig = { temperature: 0.2, maxOutputTokens: 4096 };
  const rawText = await callGeminiText({ apiKey, prompt, generationConfig: importConfig });
  let response;
  try {
    response = safeJsonParse(rawText);
  } catch (error) {
    const repairPrompt = [
      "Fix the following content into valid JSON that matches the schema exactly.",
      "Return ONLY JSON. No markdown, no explanations.",
      "If content is missing, return empty strings/arrays for those fields.",
      limitsText,
      "Schema:",
      schemaJson,
      `Content to fix (truncated): ${rawText.slice(0, 12000)}`
    ].join("\n");

    const repairedText = await callGeminiText({
      apiKey,
      prompt: repairPrompt,
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
    });
    response = safeJsonParse(repairedText);
  }

  const profile = normalizeProfile(response.profile || response);
  return { ok: true, profile };
}

async function handleSetApiKey(message) {
  const { apiKey } = message;
  await setApiKey(apiKey || "");
  return { ok: true };
}

function normalizeProfile(profile) {
  const normalizedLinks = normalizeLinks(profile?.personal?.links);
  const normalizedSkills = normalizeSkills(profile?.skills);
  const normalizedExperience = normalizeExperience(profile?.experience);
  const normalizedEducation = normalizeEducation(profile?.education);
  const normalizedProjects = normalizeProjects(profile?.projects);

  const normalized = {
    personal: {
      fullName: profile?.personal?.fullName || "",
      email: profile?.personal?.email || "",
      phone: profile?.personal?.phone || "",
      location: profile?.personal?.location || "",
      links: normalizedLinks
    },
    summary: profile?.summary || "",
    education: normalizedEducation,
    experience: normalizedExperience,
    skills: normalizedSkills,
    projects: normalizedProjects
  };
  return normalized;
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (!link) return null;
      if (typeof link === "string") {
        return { label: "", url: link };
      }
      return { label: link.label || "", url: link.url || "" };
    })
    .filter(Boolean);
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return [];
  if (skills.length && typeof skills[0] === "string") {
    return [
      {
        category: "Skills",
        items: skills.filter(Boolean)
      }
    ];
  }
  return skills.map((group) => ({
    category: group.category || "",
    items: Array.isArray(group.items) ? group.items : []
  }));
}

function normalizeExperience(experience) {
  if (!Array.isArray(experience)) return [];
  return experience.map((role) => ({
    title: role.title || "",
    company: role.company || "",
    location: role.location || "",
    startDate: role.startDate || role.start_date || "",
    endDate: role.endDate || role.end_date || "",
    bullets: Array.isArray(role.bullets) ? role.bullets : []
  }));
}

function normalizeEducation(education) {
  if (!Array.isArray(education)) return [];
  return education.map((entry) => ({
    degree: entry.degree || "",
    major: entry.major || "",
    institution: entry.institution || "",
    location: entry.location || entry.country || "",
    startDate: entry.startDate || entry.start_date || "",
    endDate: entry.endDate || entry.end_date || ""
  }));
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects)) return [];
  return projects.map((project) => ({
    name: project.name || "",
    technologies: Array.isArray(project.technologies) ? project.technologies : [],
    link: project.link || "",
    bullets: Array.isArray(project.bullets) ? project.bullets : []
  }));
}
