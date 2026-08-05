import { describe, expect, it } from "vitest";

import {
  AI_MODELS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  isModelId,
  normalizeModelId,
  providerForModel,
} from "../convex/lib/models";
import {
  AI_MODELS as CLIENT_MODELS,
  DEFAULT_MODEL as CLIENT_DEFAULT_MODEL,
} from "../src/lib/models";
import { safeJsonParse } from "../convex/lib/json";

describe("model registry", () => {
  it("defaults to gemma-4-31b-it on Gemini", () => {
    expect(DEFAULT_MODEL).toBe("gemma-4-31b-it");
    expect(DEFAULT_GEMINI_MODEL).toBe("gemma-4-31b-it");
    expect(providerForModel(DEFAULT_MODEL)).toBe("gemini");
  });

  it("keeps OpenRouter wired up as a supported provider", () => {
    expect(DEFAULT_OPENROUTER_MODEL).toBe(
      "arcee-ai/trinity-large-preview:free",
    );
    expect(providerForModel(DEFAULT_OPENROUTER_MODEL)).toBe("openrouter");
    expect(isModelId(DEFAULT_OPENROUTER_MODEL)).toBe(true);
  });

  it("routes unknown vendor/model slugs to OpenRouter and bare ids to Gemini", () => {
    expect(providerForModel("meta-llama/llama-4:free")).toBe("openrouter");
    expect(providerForModel("gemini-3.5-flash")).toBe("gemini");
  });

  it("normalizes stale stored model ids back to the default", () => {
    expect(normalizeModelId("some-retired-model")).toBe(DEFAULT_MODEL);
    expect(normalizeModelId(undefined)).toBe(DEFAULT_MODEL);
    expect(normalizeModelId(null)).toBe(DEFAULT_MODEL);
    // A still-supported id is preserved rather than reset.
    expect(normalizeModelId(DEFAULT_OPENROUTER_MODEL)).toBe(
      DEFAULT_OPENROUTER_MODEL,
    );
  });

  it("stays in sync with the client-side registry", () => {
    expect(CLIENT_DEFAULT_MODEL).toBe(DEFAULT_MODEL);
    expect(CLIENT_MODELS.map((m) => m.id)).toEqual(AI_MODELS.map((m) => m.id));
  });
});

describe("safeJsonParse", () => {
  it("parses plain JSON", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    expect(safeJsonParse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("ignores prose around the object", () => {
    expect(safeJsonParse('Here you go:\n{"a":1}\nHope that helps!')).toEqual({
      a: 1,
    });
  });

  it("repairs smart quotes, trailing commas and raw newlines in strings", () => {
    expect(safeJsonParse('{“a”: 1, "b": 2,}')).toEqual({ a: 1, b: 2 });
    expect(safeJsonParse('{"a": "line one\nline two"}')).toEqual({
      a: "line one\nline two",
    });
  });

  it("throws a descriptive error on unrecoverable output", () => {
    expect(() => safeJsonParse("not json at all")).toThrow(/not valid JSON/i);
  });
});
