/**
 * The fonts a document is compiled against, and the rewriting that decides
 * which ones it can reach. Shared by the browser renderer and the build step
 * that pre-renders the template gallery, so the two cannot drift apart.
 *
 * Fonts are downloaded before the compiler can start, so the set is kept to
 * what the templates actually resolve to. Every family the sources name is
 * rewritten to New Computer Modern below; Libertinus is Typst's own default,
 * which anything unrecognised falls back to; DejaVu Sans Mono carries `raw`
 * blocks. Loading Typst's full asset set instead costs 10.7 MB, most of it
 * maths faces and CJK that a resume never reaches.
 */

const TYPST_FONT_BASE =
  "https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/";

export const CORE_FONT_URLS = [
  "NewCM10-Regular.otf",
  "NewCM10-Bold.otf",
  "NewCM10-Italic.otf",
  "NewCM10-BoldItalic.otf",
  "LibertinusSerif-Regular.otf",
  "LibertinusSerif-Bold.otf",
  "LibertinusSerif-Italic.otf",
  "LibertinusSerif-BoldItalic.otf",
  "DejaVuSansMono.ttf",
  "DejaVuSansMono-Bold.ttf",
].map((file) => TYPST_FONT_BASE + file);

/** Fetched only for a document that actually contains CJK. */
export const CJK_FONT_URLS = [
  "https://cdn.jsdelivr.net/gh/typst/typst-dev-assets@v0.13.1/files/fonts/NotoSerifCJKsc-Regular.otf",
];

export const CJK_RANGE =
  /[\u1100-\u11ff\u2e80-\u9fff\ua960-\ua97f\uac00-\ud7ff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/;

export function normalizeTypstSource(source: string) {
  return source
    .replace(/"Source Sans Pro"/gi, '"New Computer Modern"')
    .replace(/"Source Sans 3"/gi, '"New Computer Modern"')
    .replace(/"Roboto"/gi, '"New Computer Modern"')
    .replace(/"Open Sans"/gi, '"New Computer Modern"');
}
