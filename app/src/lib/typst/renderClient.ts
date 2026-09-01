import {
  COVER_TEMPLATES,
  RESUME_TEMPLATES,
} from "../../../convex/lib/templates";

import {
  CJK_FONT_URLS,
  CJK_RANGE,
  CORE_FONT_URLS,
  normalizeTypstSource,
} from "./fontSet";

import modernCvProfilePngUrl from "../../../templates/modern-cv/profile.png?url";
import neatCvProfilePngUrl from "../../../templates/neat-cv/profile.png?url";
import neatCvPublicationsYml from "../../../templates/neat-cv/publications.yml?raw";
import impressiveUtilsTyp from "../../../templates/impressive-impression/utils.typ?raw";
import impressiveThemeTyp from "../../../templates/impressive-impression/theme.typ?raw";
import impressiveProfilePngUrl from "../../../templates/impressive-impression/assets/profile.png?url";
import impressiveSignatureSvg from "../../../templates/impressive-impression/assets/signature.svg?raw";
import impressiveFlagFrSvg from "../../../templates/impressive-impression/assets/flags/fr.svg?raw";
import impressiveFlagGbSvg from "../../../templates/impressive-impression/assets/flags/gb.svg?raw";
import impressiveFlagGrSvg from "../../../templates/impressive-impression/assets/flags/gr.svg?raw";

type RenderInput = {
  source: string;
  documentType: "resume" | "cover_letter";
  templateId: string;
};

type TemplateMeta = { entryPath: string; assets: string[] };

type TypstCompilerBundle = {
  compiler: any;
  accessModel: any;
  CompileFormatEnum: any;
};

type TypstRendererBundle = {
  renderer: any;
};

const ASSET_URLS: Record<string, string> = {
  "templates/modern-cv/profile.png": modernCvProfilePngUrl,
  "templates/neat-cv/profile.png": neatCvProfilePngUrl,
  "templates/impressive-impression/assets/profile.png": impressiveProfilePngUrl,
};

const ASSET_TEXTS: Record<string, string> = {
  "templates/neat-cv/publications.yml": neatCvPublicationsYml,
  "templates/impressive-impression/utils.typ": impressiveUtilsTyp,
  "templates/impressive-impression/theme.typ": impressiveThemeTyp,
  "templates/impressive-impression/assets/signature.svg":
    impressiveSignatureSvg,
  "templates/impressive-impression/assets/flags/fr.svg": impressiveFlagFrSvg,
  "templates/impressive-impression/assets/flags/gb.svg": impressiveFlagGbSvg,
  "templates/impressive-impression/assets/flags/gr.svg": impressiveFlagGrSvg,
};

const assetBytesCache = new Map<string, Promise<Uint8Array>>();

async function getAssetBytes(assetRel: string): Promise<Uint8Array> {
  const cached = assetBytesCache.get(assetRel);
  if (cached) return cached;

  const promise = (async () => {
    if (assetRel in ASSET_TEXTS) {
      return new TextEncoder().encode(
        normalizeTypstSource(ASSET_TEXTS[assetRel]!),
      );
    }
    if (assetRel in ASSET_URLS) {
      const res = await fetch(ASSET_URLS[assetRel]!);
      if (!res.ok) {
        throw new Error(`Failed to load template asset: ${assetRel}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    }
    throw new Error(`Missing embedded template asset: ${assetRel}`);
  })();

  assetBytesCache.set(assetRel, promise);
  return promise;
}

function getTemplateMeta(input: RenderInput): TemplateMeta {
  if (input.templateId.startsWith("custom:")) {
    return { entryPath: "templates/custom/main.typ", assets: [] };
  }
  if (input.documentType === "resume") {
    const tmpl = (RESUME_TEMPLATES as Record<string, TemplateMeta>)[
      input.templateId
    ];
    if (!tmpl) throw new Error("Unknown templateId.");
    return tmpl;
  }
  const tmpl = (COVER_TEMPLATES as Record<string, TemplateMeta>)[
    input.templateId
  ];
  if (!tmpl) throw new Error("Unknown templateId.");
  return tmpl;
}

let compilerPromise: Promise<TypstCompilerBundle> | null = null;
let compilerCarriesCjk = false;
let compilerMutex: Promise<void> = Promise.resolve();
let rendererPromise: Promise<TypstRendererBundle> | null = null;
let rendererMutex: Promise<void> = Promise.resolve();

async function getTypstCompilerBundle(
  needsCjk = false,
): Promise<TypstCompilerBundle> {
  // A CJK document arriving at a compiler built without those faces is the one
  // case worth paying for the second build; from then on it carries them.
  if (needsCjk && !compilerCarriesCjk) compilerPromise = null;

  if (!compilerPromise) {
    compilerCarriesCjk = needsCjk;
    const fontUrls = needsCjk
      ? [...CORE_FONT_URLS, ...CJK_FONT_URLS]
      : CORE_FONT_URLS;
    const pending = (async () => {
      if (typeof window === "undefined") {
        throw new Error("Typst client renderer can only run in the browser.");
      }

      const typstModule = await import("@myriaddreamin/typst.ts");
      const compilerModule = await import("@myriaddreamin/typst.ts/compiler");
      const optionsInit = await import("@myriaddreamin/typst.ts/options.init");
      const { MemoryAccessModel } =
        await import("@myriaddreamin/typst.ts/fs/memory");
      const { FetchPackageRegistry } =
        await import("@myriaddreamin/typst.ts/fs/package");

      const compiler = typstModule.createTypstCompiler();
      const accessModel = new MemoryAccessModel();
      const packageRegistry = new FetchPackageRegistry(accessModel);
      const wasmUrl = (
        await import("@myriaddreamin/typst-ts-web-compiler/wasm?url")
      ).default as string;

      await compiler.init({
        getWrapper: () => import("@myriaddreamin/typst-ts-web-compiler"),
        getModule: () => wasmUrl,
        beforeBuild: [
          optionsInit.loadFonts(fontUrls, { assets: false }),
          optionsInit.withAccessModel(accessModel),
          optionsInit.withPackageRegistry(packageRegistry),
        ],
      });

      return {
        compiler,
        accessModel,
        CompileFormatEnum: compilerModule.CompileFormatEnum,
      };
    })();
    compilerPromise = pending;
    void pending.catch(() => {
      if (compilerPromise === pending) {
        compilerPromise = null;
        compilerCarriesCjk = false;
      }
    });
  }
  return compilerPromise;
}

async function getTypstRendererBundle(): Promise<TypstRendererBundle> {
  if (!rendererPromise) {
    const pending = (async () => {
      if (typeof window === "undefined") {
        throw new Error("Typst renderer can only run in the browser.");
      }

      const typstModule = await import("@myriaddreamin/typst.ts");
      const wasmUrl = (
        await import("@myriaddreamin/typst-ts-renderer/wasm?url")
      ).default as string;

      const renderer = typstModule.createTypstRenderer();
      await renderer.init({
        getWrapper: () => import("@myriaddreamin/typst-ts-renderer"),
        getModule: () => wasmUrl,
      });

      return { renderer };
    })();
    rendererPromise = pending;
    void pending.catch(() => {
      if (rendererPromise === pending) rendererPromise = null;
    });
  }
  return rendererPromise;
}

async function withCompilerLock<T>(task: () => Promise<T>) {
  const previous = compilerMutex;
  let release: () => void;
  compilerMutex = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    release!();
  }
}

async function withRendererLock<T>(task: () => Promise<T>) {
  const previous = rendererMutex;
  let release: () => void;
  rendererMutex = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    release!();
  }
}

async function compileTypst(
  input: RenderInput,
  format: "pdf" | "vector",
): Promise<Uint8Array> {
  if (!input.source?.trim()) {
    throw new Error("Missing Typst source.");
  }

  const template = getTemplateMeta(input);
  const root = "/@memory";
  const mainFilePath = `${root}/${template.entryPath}`;
  const source = normalizeTypstSource(input.source);

  return await withCompilerLock(async () => {
    const { compiler, accessModel, CompileFormatEnum } =
      await getTypstCompilerBundle(CJK_RANGE.test(source));
    const compileFormat =
      format === "pdf" ? CompileFormatEnum.pdf : CompileFormatEnum.vector;

    accessModel.insertFile(
      mainFilePath,
      new TextEncoder().encode(source),
      new Date(),
    );
    for (const assetRel of template.assets || []) {
      const assetPath = `${root}/${assetRel}`;
      const bytes = await getAssetBytes(assetRel);
      accessModel.insertFile(assetPath, bytes, new Date());
    }

    const result = await compiler.compile({
      root,
      mainFilePath,
      format: compileFormat,
      diagnostics: "full",
    });

    const diagnostics: any[] | undefined = result?.diagnostics;
    const errors = diagnostics?.filter((diagnostic) => {
      const severity = String(
        diagnostic?.severity || diagnostic?.level || diagnostic?.kind || "",
      ).toLowerCase();
      return severity !== "warning" && severity !== "warn";
    });
    if (errors?.length) {
      const message = errors
        .map((d) => d?.message || d?.text || JSON.stringify(d))
        .filter(Boolean)
        .join("; ");
      throw new Error(`Typst compilation error: ${message}`);
    }

    return toUint8Array(result?.result ?? result, format);
  });
}

export async function renderTypstToPdfBytesInBrowser(
  input: RenderInput,
): Promise<Uint8Array> {
  return await compileTypst(input, "pdf");
}

export async function renderTypstToVectorArtifactInBrowser(
  input: RenderInput,
): Promise<Uint8Array> {
  return await compileTypst(input, "vector");
}

/** A4 is 595pt wide. The sample rate only has to be right to within a page. */
const NOMINAL_PAGE_WIDTH_PT = 595;

/**
 * How many device pixels to rasterise per typographic point. The renderer's
 * default of 3 draws an A4 page at 1785px however small it is shown, which on
 * a phone is around three times what the screen can use. Matching the device's
 * own pixels is as sharp as a raster gets; the floor of 1.5 keeps a little
 * supersampling for the screens that do not have pixels to spare.
 */
function samplingFor(container: HTMLElement) {
  const cssWidth = container.offsetWidth || NOMINAL_PAGE_WIDTH_PT;
  const dpr = Math.max(window.devicePixelRatio || 1, 1.5);
  const needed = (cssWidth / NOMINAL_PAGE_WIDTH_PT) * dpr;
  return Math.min(3, Math.max(1.5, Math.round(needed * 4) / 4));
}

export async function renderTypstToCanvasInBrowser(
  input: RenderInput & {
    container: HTMLElement;
    backgroundColor?: string;
    pixelPerPt?: number;
  },
): Promise<void> {
  if (!input.container) {
    throw new Error("Missing preview container.");
  }

  // The renderer's WASM is a separate download from the compiler's, so it is
  // fetched while the source compiles rather than after.
  const rendererBundle = getTypstRendererBundle();
  rendererBundle.catch(() => {});

  const artifact = await renderTypstToVectorArtifactInBrowser(input);
  const pixelPerPt = input.pixelPerPt ?? samplingFor(input.container);

  await withRendererLock(async () => {
    const { renderer } = await rendererBundle;
    await renderer.renderToCanvas({
      container: input.container,
      format: "vector",
      artifactContent: artifact,
      backgroundColor: input.backgroundColor ?? "#ffffff",
      pixelPerPt,
    });
  });

  input.container.dataset.pixelPerPt = String(pixelPerPt);
}

/**
 * The renderer scales each page from the container's width at the moment it
 * renders, and never looks again. A pane that was hidden then (width 0), or a
 * window that has since been resized, leaves pages at the wrong scale. The
 * canvases are rasterised independently of the container, so this is CSS to
 * put right, not another compile.
 */
export function relayoutTypstPreview(container: HTMLElement | null) {
  if (!container) return;
  const width = container.offsetWidth;
  if (!width) return;
  const pixelPerPt = Number(container.dataset.pixelPerPt) || 1;

  container.querySelectorAll<HTMLElement>(".typst-page").forEach((page) => {
    const canvas = page.querySelector("canvas");
    const canvasDiv = canvas?.parentElement;
    if (!canvas || !canvasDiv) return;

    const scale = width / canvas.width;
    page.style.width = `${width}px`;
    page.style.height = `${canvas.height * scale}px`;
    canvasDiv.style.transformOrigin = "0px 0px";
    canvasDiv.style.transform = `scale(${scale})`;

    const semantics = page.querySelector<HTMLElement>(".typst-html-semantics");
    if (!semantics) return;
    const textScale = scale * pixelPerPt;
    semantics.style.width = `${width}px`;
    semantics.style.height = `${canvas.height * scale}px`;
    semantics.style.setProperty("--data-text-width", `${textScale}px`);
    semantics.style.setProperty("--data-text-height", `${textScale}px`);
  });
}

/** Keeps `container`'s pages laid out as its width changes, or first appears. */
export function watchTypstPreview(container: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  let lastWidth = container.offsetWidth;
  const observer = new ResizeObserver(() => {
    const width = container.offsetWidth;
    if (width === lastWidth) return;
    lastWidth = width;
    relayoutTypstPreview(container);
  });
  observer.observe(container);
  return () => observer.disconnect();
}

/**
 * The first page alone, as an image. The renderer only sizes canvases when it
 * lays out a whole document, so the document is rendered into an offscreen host
 * and everything after page one is discarded.
 */
export async function renderTypstFirstPageToDataUrl(
  input: RenderInput & { pixelPerPt?: number },
): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error("Thumbnails can only be rendered in the browser.");
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:640px;pointer-events:none;";
  document.body.appendChild(host);

  try {
    await renderTypstToCanvasInBrowser({
      source: input.source,
      documentType: input.documentType,
      templateId: input.templateId,
      container: host,
      pixelPerPt: input.pixelPerPt ?? 1,
    });
    const canvas = host.querySelector("canvas");
    if (!canvas) throw new Error("Typst produced no page.");
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    host.remove();
  }
}

function toUint8Array(bytes: unknown, format: "pdf" | "vector") {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  throw new Error(
    `Typst compiler returned no ${format === "pdf" ? "PDF" : "vector"} output.`,
  );
}
