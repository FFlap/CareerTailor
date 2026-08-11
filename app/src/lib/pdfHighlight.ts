/**
 * Renders a PDF with a selectable text layer and marks the lines a review
 * quoted. Matching happens in "compact" space — letters and digits only — so
 * that how the PDF chose to split its text runs, break its lines, or hyphenate
 * cannot move a match off the glyphs it belongs to.
 */

/** Not global: `test` on a /g regex carries lastIndex between calls. */
const ALNUM = /[a-z0-9]/i;

/** Short quotes match too much ("10" inside "100"), so they are left alone. */
const MIN_MATCH_CHARS = 8;

export type PageTextMap = {
  spans: HTMLSpanElement[];
  /** The page reduced to lowercase letters and digits, spans concatenated. */
  compact: string;
  /** Where each span lands in `compact`. Empty spans get a zero-width range. */
  spanRanges: { start: number; end: number }[];
};

export type PdfPages = Map<number, PageTextMap>;

export async function renderPdfWithTextLayer({
  data,
  container,
  maxScale = 2,
  isCancelled,
}: {
  data: ArrayBuffer;
  container: HTMLElement;
  maxScale?: number;
  isCancelled?: () => boolean;
}): Promise<PdfPages> {
  const pages: PdfPages = new Map();

  const pdfjsLib = await import("pdfjs-dist");
  const PdfWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  const viewer = await import("pdfjs-dist/web/pdf_viewer");
  const TextLayerBuilder = viewer.TextLayerBuilder;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker.default;

  if (typeof TextLayerBuilder !== "function") {
    throw new Error("PDF text layer is unavailable in this build of pdfjs-dist.");
  }

  container.innerHTML = "";

  // getDocument transfers the buffer to the worker, so hand it a copy.
  const pdf = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (isCancelled?.()) return pages;

    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const available = container.clientWidth
      ? container.clientWidth
      : baseViewport.width;
    const scale = Math.min(maxScale, available / baseViewport.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const pageWrapper = document.createElement("div");
    pageWrapper.className = "review-pdf-page";
    pageWrapper.style.width = `${viewport.width}px`;
    pageWrapper.style.height = `${viewport.height}px`;
    // pdf.js positions and sizes every text span with calc(var(--scale-factor)
    // * n). Leave it unset and those calcs are invalid, so the boxes do not sit
    // over their glyphs — which reads as a highlight that misses the words.
    pageWrapper.style.setProperty("--scale-factor", String(scale));
    pageWrapper.style.setProperty("--total-scale-factor", String(scale));
    pageWrapper.appendChild(canvas);
    container.appendChild(pageWrapper);

    const transform =
      outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
    await page.render({ canvas, canvasContext: context, viewport, transform })
      .promise;

    const textMapping = {
      textDivs: [] as HTMLSpanElement[],
      textContentItemsStr: [] as string[],
    };

    const textLayerBuilder = new TextLayerBuilder({
      pdfPage: page,
      highlighter: {
        setTextMapping(divs: HTMLSpanElement[], strs: string[]) {
          textMapping.textDivs = divs;
          textMapping.textContentItemsStr = strs;
        },
        enable() {},
        disable() {},
      },
      onAppend: (layer: HTMLDivElement) => {
        layer.classList.add("review-text-layer");
        layer.style.width = `${viewport.width}px`;
        layer.style.height = `${viewport.height}px`;
        pageWrapper.appendChild(layer);
      },
    });

    await textLayerBuilder.render({ viewport });

    const spans = textMapping.textDivs.length
      ? textMapping.textDivs
      : (Array.from(
          pageWrapper.querySelectorAll(".textLayer span"),
        ) as HTMLSpanElement[]);

    // Each span's text is read off the span itself rather than from pdf.js's
    // parallel item array. The two are only parallel by convention, and if they
    // ever drift, every highlight lands on the wrong glyphs. This cannot drift.
    pages.set(
      pageNumber,
      buildPageMap(
        spans,
        spans.map((span) => span.textContent ?? ""),
      ),
    );
  }

  return pages;
}

export function applyHighlights(
  pages: PdfPages,
  quotes: Array<{ id: number; quote: string }>,
  activeId: number | null,
) {
  pages.forEach((page) => {
    page.spans.forEach((span) => {
      span.classList.remove("review-highlight", "review-highlight-active");
      delete span.dataset.commentId;
    });
  });

  quotes.forEach(({ id, quote }) => {
    const needle = compact(quote ?? "");
    if (needle.length < MIN_MATCH_CHARS) return;

    for (const page of pages.values()) {
      const matches = findAllIndices(page.compact, needle);
      if (!matches.length) continue;

      matches.forEach((start) => {
        const end = start + needle.length;
        page.spans.forEach((span, index) => {
          const range = page.spanRanges[index];
          if (!range || range.start >= end || range.end <= start) return;
          span.classList.add("review-highlight");
          span.dataset.commentId = String(id);
          if (activeId === id) span.classList.add("review-highlight-active");
        });
      });
      break;
    }
  });
}

/** Scrolls the first span carrying a comment into view. */
export function scrollToComment(pages: PdfPages, id: number) {
  for (const page of pages.values()) {
    const span = page.spans.find((candidate) => candidate.dataset.commentId === String(id));
    if (span) {
      span.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
  }
  return false;
}

/**
 * The same matching for the plain-text view, which has no spans to colour: the
 * quote is found in compact space and mapped back to a slice of the original.
 */
export function buildTextHighlights(
  text: string,
  quotes: Array<{ id: number; quote: string }>,
): Array<{ text: string; commentId?: number }> {
  if (!text) return [];

  const { compact: haystack, map } = compactWithMap(text);
  const spans: Array<{ start: number; end: number; id: number }> = [];

  quotes.forEach(({ id, quote }) => {
    const needle = compact(quote ?? "");
    if (needle.length < MIN_MATCH_CHARS) return;
    const at = haystack.indexOf(needle);
    if (at === -1) return;
    const start = map[at];
    const end = map[at + needle.length - 1];
    if (typeof start !== "number" || typeof end !== "number") return;
    spans.push({ start, end: end + 1, id });
  });

  if (!spans.length) return [{ text }];

  // Earliest first, and no overlaps, so the slices tile the original text.
  spans.sort((a, b) => a.start - b.start);
  const segments: Array<{ text: string; commentId?: number }> = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start) });
    }
    segments.push({ text: text.slice(span.start, span.end), commentId: span.id });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  return segments;
}

/**
 * Letters and digits only, lowercased. A PDF splits a word into as many text
 * runs as it likes — "FMEA" often arrives as "F" then "MEA" — and breaks lines
 * wherever it wants. Stripping everything else means none of that can shift a
 * match, because the separators those splits introduce no longer exist.
 */
export function compact(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    if (ALNUM.test(input[i])) out += input[i].toLowerCase();
  }
  return out;
}

/** Compacted text plus, for each kept character, its index in the original. */
export function compactWithMap(input: string): {
  compact: string;
  map: number[];
} {
  let out = "";
  const map: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    if (ALNUM.test(input[i])) {
      out += input[i].toLowerCase();
      map.push(i);
    }
  }
  return { compact: out, map };
}

/**
 * Lays the page's text runs end to end in compact space and records where each
 * span lands. A run of only punctuation contributes nothing and gets a
 * zero-width range, so a match either side of it never sweeps it up.
 */
export function buildPageMap(
  spans: HTMLSpanElement[],
  itemStrings: string[],
): PageTextMap {
  let text = "";
  const spanRanges: { start: number; end: number }[] = [];

  itemStrings.forEach((value) => {
    const piece = compact(value);
    spanRanges.push({ start: text.length, end: text.length + piece.length });
    text += piece;
  });

  return { spans, compact: text, spanRanges };
}

function findAllIndices(haystack: string, needle: string) {
  const indices: number[] = [];
  if (!haystack || !needle) return indices;
  let from = 0;
  while (from < haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    indices.push(index);
    from = index + needle.length;
  }
  return indices;
}
