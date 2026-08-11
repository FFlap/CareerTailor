import { describe, expect, it } from "vitest";

import {
  buildPageMap,
  buildTextHighlights,
  compact,
  compactWithMap,
} from "@/lib/pdfHighlight";

/**
 * A PDF hands back text run by run, and a run can be a single glyph. These
 * fixtures are invented; they only imitate that splitting behaviour.
 */
function fakeSpans(count: number) {
  return Array.from({ length: count }, () => ({
    classList: { add() {}, remove() {} },
    dataset: {} as Record<string, string>,
  })) as unknown as HTMLSpanElement[];
}

/** Which runs a quote should light up, by index. */
function matchedRuns(runs: string[], quote: string) {
  const page = buildPageMap(fakeSpans(runs.length), runs);
  const needle = compact(quote);
  const at = page.compact.indexOf(needle);
  if (at === -1 || needle.length < 8) return [];
  const end = at + needle.length;
  return page.spanRanges
    .map((range, index) => ({ range, index }))
    .filter(({ range }) => range.start < end && range.end > at)
    .map(({ index }) => index);
}

describe("compact", () => {
  it("keeps only letters and digits, lowercased", () => {
    expect(compact("Widget-Pipeline (v2)")).toBe("widgetpipelinev2");
    expect(compact("  \n\t ")).toBe("");
  });

  it("erases the separators a PDF invents", () => {
    expect(compact("Alpha | Beta")).toBe(compact("Alpha|Beta"));
    expect(compact("through-\nput")).toBe(compact("throughput"));
    expect(compact("“quoted”")).toBe(compact("quoted"));
  });
});

describe("compactWithMap", () => {
  it("points every kept character back at the original", () => {
    const source = "A-B c9";
    const { compact: text, map } = compactWithMap(source);
    expect(text).toBe("abc9");
    expect(map.map((index) => source[index]).join("")).toBe("ABc9");
  });
});

describe("buildPageMap", () => {
  // The defect: a word arriving as two runs left the first one unhighlighted.
  it("lights up both runs when a word is split mid-way", () => {
    const runs = ["Reduced ", "b", "uild time by 40 percent"];
    expect(matchedRuns(runs, "Reduced build time")).toEqual([0, 1, 2]);
  });

  it("lights up a run holding a single leading glyph", () => {
    const runs = ["Owned checkout, ", "T", "elemetry, ", "R", "ollouts"];
    expect(matchedRuns(runs, "Telemetry, Rollouts")).toEqual([1, 2, 3, 4]);
  });

  it("matches across a line break between runs", () => {
    const runs = ["Shipped the widget\n", "pipeline end to end"];
    expect(matchedRuns(runs, "widget pipeline end")).toEqual([0, 1]);
  });

  it("matches when the quote punctuates differently to the page", () => {
    const runs = ["Cut latency (p99) by half"];
    expect(matchedRuns(runs, "Cut latency p99 by half")).toEqual([0]);
  });

  it("leaves runs outside the quote alone", () => {
    const runs = ["Alpha section text", "Beta section text", "Gamma section"];
    expect(matchedRuns(runs, "Beta section text")).toEqual([1]);
  });

  it("gives a punctuation-only run a zero-width range so it is never swept up", () => {
    const page = buildPageMap(fakeSpans(3), ["Alpha", " — ", "Beta"]);
    expect(page.spanRanges[1]).toEqual({ start: 5, end: 5 });
    expect(page.compact).toBe("alphabeta");
  });

  it("ignores a quote too short to be unambiguous", () => {
    expect(matchedRuns(["Delivered 10 of 100 items"], "10")).toEqual([]);
  });
});

describe("buildTextHighlights", () => {
  const text = "Owned the widget pipeline.\nCut latency (p99) by half.";

  it("marks the original text even when the quote punctuates differently", () => {
    const segments = buildTextHighlights(text, [
      { id: 1, quote: "Cut latency p99 by half" },
    ]);
    const marked = segments.filter((segment) => segment.commentId === 1);
    expect(marked).toHaveLength(1);
    expect(marked[0].text).toBe("Cut latency (p99) by half");
  });

  it("rebuilds the original text exactly, whatever it marked", () => {
    const segments = buildTextHighlights(text, [
      { id: 1, quote: "Owned the widget pipeline" },
      { id: 2, quote: "Cut latency p99 by half" },
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments.filter((s) => s.commentId).length).toBe(2);
  });

  it("keeps the text whole when nothing matches", () => {
    expect(buildTextHighlights(text, [{ id: 1, quote: "nothing like this" }])).toEqual([
      { text },
    ]);
  });

  it("drops an overlapping second quote rather than corrupting the text", () => {
    const segments = buildTextHighlights(text, [
      { id: 1, quote: "Owned the widget pipeline" },
      { id: 2, quote: "the widget pipeline. Cut latency" },
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
  });

  it("handles empty input", () => {
    expect(buildTextHighlights("", [{ id: 1, quote: "anything at all" }])).toEqual([]);
  });
});
