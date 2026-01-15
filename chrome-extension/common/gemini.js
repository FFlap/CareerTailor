import { GEMINI_MODEL } from "./constants.js";
import { logGeminiUsage } from "./stats.js";

const defaultGenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.6,
  maxOutputTokens: 4096
};

export async function callGemini({ apiKey, prompt, generationConfig }) {
  const { text } = await callGeminiApi({ apiKey, prompt, generationConfig });
  return safeJsonParse(text);
}

export async function callGeminiText({ apiKey, prompt, generationConfig }) {
  const { text } = await callGeminiApi({ apiKey, prompt, generationConfig });
  return text;
}

async function callGeminiApi({ apiKey, prompt, generationConfig }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          ...defaultGenerationConfig,
          ...(generationConfig || {})
        }
      })
    });
  } catch (error) {
    await logGeminiUsage({
      success: false,
      rateLimited: false,
      errorMessage: error?.message || "Network error"
    });
    throw error;
  }

  const rateLimited = response.status === 429;
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  const usage = payload?.usageMetadata || {};
  await logGeminiUsage({
    success: response.ok,
    rateLimited,
    promptTokens: usage.promptTokenCount || 0,
    candidateTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0,
    errorMessage: response.ok ? "" : payload?.error?.message || response.statusText
  });

  if (!response.ok) {
    const errorMessage = payload?.error?.message || `Gemini API error (${response.status})`;
    throw new Error(errorMessage);
  }

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part?.text || "").join("");
  if (!text) {
    throw new Error("Gemini returned empty response.");
  }

  return { text, payload };
}

export function safeJsonParse(rawText) {
  if (typeof rawText !== "string") {
    throw new Error("Gemini response was not valid JSON.");
  }
  const normalized = rawText.replace(/^\uFEFF/, "").trim();
  const direct = tryParse(normalized);
  if (direct !== null) return direct;

  const unfenced = stripCodeFences(normalized);
  if (unfenced !== normalized) {
    const parsed = tryParse(unfenced);
    if (parsed !== null) return parsed;
  }

  const extracted = extractFirstJson(unfenced);
  if (extracted) {
    const parsed = tryParse(extracted);
    if (parsed !== null) return parsed;
  }

  console.warn("Gemini returned non-JSON output:", normalized.slice(0, 400));
  throw new Error("Gemini response was not valid JSON.");
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stripCodeFences(text) {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : text;
}

function extractFirstJson(text) {
  let start = -1;
  const stack = [];
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === "\\") {
        escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (stack.length === 0) {
        start = i;
      }
      stack.push(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (!stack.length) continue;
      const last = stack[stack.length - 1];
      if ((ch === "}" && last === "{") || (ch === "]" && last === "[")) {
        stack.pop();
        if (stack.length === 0 && start !== -1) {
          return text.slice(start, i + 1);
        }
      }
    }
  }
  return "";
}
