import { describe, expect, it } from "vitest";

import {
  QUESTIONS,
  closingLine,
  suggestedLength,
  suggestedTemplates,
} from "../src/components/onboarding/questions";
import { RESUME_TEMPLATES, COVER_TEMPLATES } from "../src/lib/templates";

describe("onboarding questions", () => {
  it("asks every question exactly once, with a unique key", () => {
    const keys = QUESTIONS.map((question) => question.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps every question answerable from the number row", () => {
    for (const question of QUESTIONS) {
      expect(question.choices.length).toBeGreaterThan(1);
      expect(question.choices.length).toBeLessThanOrEqual(9);
    }
  });

  it("gives each choice within a question a distinct id", () => {
    for (const question of QUESTIONS) {
      const ids = question.choices.map((choice) => choice.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("suggested templates", () => {
  it("suggests a real template for every answer the form can produce", () => {
    const field = QUESTIONS.find((question) => question.key === "field");
    const resumeIds = RESUME_TEMPLATES.map((template) => template.id);
    const coverIds = COVER_TEMPLATES.map((template) => template.id);

    for (const choice of field!.choices) {
      const suggestion = suggestedTemplates({ field: choice.id });
      expect(resumeIds).toContain(suggestion.resume);
      expect(coverIds).toContain(suggestion.cover);
    }
  });

  it("falls back to a real template when the question was skipped", () => {
    const suggestion = suggestedTemplates({});
    expect(RESUME_TEMPLATES.map((template) => template.id)).toContain(
      suggestion.resume,
    );

    const unknown = suggestedTemplates({ field: "underwater-basket-weaving" });
    expect(unknown).toEqual(suggestion);
  });
});

describe("suggested length", () => {
  it("only offers two pages once there is a career to fill them", () => {
    expect(suggestedLength({ stage: "student" })).toBe("1_page");
    expect(suggestedLength({ stage: "early" })).toBe("1_page");
    expect(suggestedLength({ stage: "mid" })).toBe("2_pages");
    expect(suggestedLength({ stage: "senior" })).toBe("2_pages");
  });

  it("defaults to one page when the question was skipped", () => {
    expect(suggestedLength({})).toBe("1_page");
  });
});

describe("closing line", () => {
  it("has something to say for every goal, and for none", () => {
    const goal = QUESTIONS.find((question) => question.key === "goal");
    for (const choice of goal!.choices) {
      expect(closingLine({ goal: choice.id }).length).toBeGreaterThan(0);
    }
    expect(closingLine({}).length).toBeGreaterThan(0);
  });
});
