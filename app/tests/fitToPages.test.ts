import { describe, expect, it } from "vitest";

import {
  describeCapacity,
  estimateContent,
  fitResumeToPages,
} from "../src/lib/fitToPages";
import { LONG_RESUME, PROFILE, SPARSE_PROFILE } from "./fixtures";

/** Stands in for compiling: more material means more pages. */
function measurer(unitsPerPage: number) {
  return async (data: any) => {
    const entries = [...(data.experience ?? []), ...(data.projects ?? [])];
    const units = entries.reduce(
      (total: number, item: any) => total + 1 + (item?.bullets?.length ?? 0),
      0,
    );
    return Math.max(1, Math.ceil(units / unitsPerPage));
  };
}

describe("content estimate", () => {
  it("knows a full profile can fill two pages", () => {
    expect(estimateContent(LONG_RESUME).canFillTwoPages).toBe(true);
  });

  it("knows a thin profile cannot", () => {
    const estimate = estimateContent(SPARSE_PROFILE);
    expect(estimate.canFillTwoPages).toBe(false);
    expect(estimate.roles).toBe(1);
  });

  it("counts a normal profile as one page of material", () => {
    const estimate = estimateContent(PROFILE);
    expect(estimate.roles).toBe(2);
    expect(estimate.bullets).toBe(7);
    expect(estimate.canFillTwoPages).toBe(false);
  });

  it("describes what the profile holds in the user's terms", () => {
    expect(describeCapacity(estimateContent(PROFILE))).toBe(
      "2 roles, 7 bullets, 2 projects",
    );
    expect(describeCapacity(estimateContent(SPARSE_PROFILE))).toBe(
      "1 role, 1 bullet",
    );
  });
});

describe("fitting a resume to a page count", () => {
  it("leaves a document that already fits completely alone", async () => {
    const data = {
      experience: [{ title: "A", bullets: ["one", "two"] }],
      projects: [],
    };
    const result = await fitResumeToPages({
      data,
      maxPages: 1,
      measure: measurer(20),
    });
    expect(result.trims).toBe(0);
    expect(result.overflows).toBe(false);
    expect(result.data).toEqual(data);
  });

  it("trims a long resume down until it fits", async () => {
    const result = await fitResumeToPages({
      data: JSON.parse(JSON.stringify(LONG_RESUME)),
      maxPages: 1,
      measure: measurer(14),
      limit: 40,
    });
    expect(result.pages).toBe(1);
    expect(result.overflows).toBe(false);
    expect(result.trims).toBeGreaterThan(0);
  });

  it("sheds bullets before it sheds a whole role", async () => {
    const data = {
      experience: [
        { title: "Recent", bullets: ["a", "b", "c", "d", "e"] },
        { title: "Older", bullets: ["a", "b"] },
      ],
      projects: [],
    };
    const result = await fitResumeToPages({
      data,
      maxPages: 1,
      measure: measurer(8),
    });
    expect(result.data.experience).toHaveLength(2);
    expect(result.data.experience[0].bullets.length).toBeLessThan(5);
  });

  it("keeps one role and never empties the document", async () => {
    const data = {
      experience: [{ title: "Only role", bullets: ["a", "b"] }],
      projects: [{ name: "Only project", bullets: ["x"] }],
    };
    // A page that fits almost nothing forces every trim the code will make.
    const result = await fitResumeToPages({
      data,
      maxPages: 1,
      measure: async () => 3,
      limit: 20,
    });
    expect(result.overflows).toBe(true);
    expect(result.data.experience).toHaveLength(1);
    expect(result.data.experience[0].bullets).toHaveLength(2);
    expect(result.data.projects).toHaveLength(1);
  });

  it("is deterministic — the same input trims to the same output", async () => {
    const data = JSON.parse(JSON.stringify(LONG_RESUME));
    const runs = await Promise.all(
      [0, 1].map(() =>
        fitResumeToPages({
          data,
          maxPages: 1,
          measure: measurer(14),
          limit: 40,
        }),
      ),
    );
    expect(JSON.stringify(runs[0].data)).toBe(JSON.stringify(runs[1].data));
    expect(runs[0].trims).toBe(runs[1].trims);
  });
});
