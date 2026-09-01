/**
 * Pre-renders the built-in template gallery.
 *
 * A gallery preview is the same page every time: fixed sample data, fixed
 * template, no user input. Compiling it in the browser costs a 28 MB
 * WebAssembly compiler and a font download before anything appears, which is
 * the slow first paint on /templates. Compiling it here instead turns each one
 * into a static SVG the page can show immediately.
 *
 * This is an explicit maintenance command, not part of the normal build. The
 * generated SVGs are committed and imported like ordinary assets, so local and
 * deployment builds stay deterministic and do not require network access.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FetchPackageRegistry } from "@myriaddreamin/typst.ts/fs/package";

import { COVER_TEMPLATES, RESUME_TEMPLATES } from "../convex/lib/templates";
import { CORE_FONT_URLS, normalizeTypstSource } from "../src/lib/typst/fontSet";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appRoot, "src", "generated", "template-previews");

type Meta = { entryPath: string; assets: string[] };

/**
 * The stock registry pulls packages over a synchronous XMLHttpRequest, which
 * Node has no answer to. A child process does the fetch instead, so the
 * compiler still gets its bytes without blocking on an event loop it is
 * already inside. Transitive imports resolve the same way, one call each.
 */
class NodePackageRegistry extends FetchPackageRegistry {
  pullPackageData(spec: { name: string; version: string; namespace: string }) {
    const url = this.resolvePath(spec);
    const fetchInChild = `
      const res = await fetch(${JSON.stringify("URL")}.replace("URL", process.argv[1]));
      if (!res.ok) process.exit(1);
      process.stdout.write(Buffer.from(await res.arrayBuffer()));
    `;
    try {
      return new Uint8Array(
        execFileSync(
          process.execPath,
          ["--input-type=module", "-e", fetchInChild, url],
          { maxBuffer: 1 << 28 },
        ),
      );
    } catch {
      return undefined;
    }
  }
}

/** The gallery previews the template file itself, sample data and all. */
const GALLERY: Record<string, Meta> = {
  ...(RESUME_TEMPLATES as Record<string, Meta>),
  ...(COVER_TEMPLATES as Record<string, Meta>),
};

function readTemplate(rel: string) {
  return readFileSync(join(appRoot, rel));
}

async function renderAll() {
  const { createTypstCompiler, createTypstRenderer } =
    await import("@myriaddreamin/typst.ts");
  const optionsInit = await import("@myriaddreamin/typst.ts/options.init");
  const { MemoryAccessModel } = await import("@myriaddreamin/typst.ts/fs/memory");

  const wasmOf = (pkg: string, file: string) =>
    new Uint8Array(
      readFileSync(join(appRoot, "node_modules/@myriaddreamin", pkg, "pkg", file)),
    );

  const accessModel = new MemoryAccessModel();
  const compiler = createTypstCompiler();
  await compiler.init({
    getWrapper: () => import("@myriaddreamin/typst-ts-web-compiler"),
    getModule: () =>
      wasmOf("typst-ts-web-compiler", "typst_ts_web_compiler_bg.wasm") as any,
    beforeBuild: [
      optionsInit.loadFonts(CORE_FONT_URLS, { assets: false }),
      optionsInit.withAccessModel(accessModel),
      optionsInit.withPackageRegistry(new NodePackageRegistry(accessModel)),
    ],
  });

  const renderer = createTypstRenderer();
  await renderer.init({
    getWrapper: () => import("@myriaddreamin/typst-ts-renderer"),
    getModule: () =>
      wasmOf("typst-ts-renderer", "typst_ts_renderer_bg.wasm") as any,
  });

  const root = "/@memory";
  mkdirSync(outDir, { recursive: true });

  for (const [id, meta] of Object.entries(GALLERY)) {
    accessModel.insertFile(
      `${root}/${meta.entryPath}`,
      new TextEncoder().encode(
        normalizeTypstSource(readTemplate(meta.entryPath).toString("utf8")),
      ),
      new Date(),
    );
    for (const asset of meta.assets) {
      const raw = readTemplate(asset);
      const bytes = /\.(typ|yml|yaml|svg)$/.test(asset)
        ? new TextEncoder().encode(normalizeTypstSource(raw.toString("utf8")))
        : new Uint8Array(raw);
      accessModel.insertFile(`${root}/${asset}`, bytes, new Date());
    }

    const result: any = await compiler.compile({
      root,
      mainFilePath: `${root}/${meta.entryPath}`,
      format: 0,
      diagnostics: "full",
    } as any);

    const errors = (result?.diagnostics ?? []).filter(
      (d: any) => String(d?.severity ?? "").toLowerCase() !== "warning",
    );
    if (errors.length) {
      throw new Error(
        `Could not pre-render ${id}: ${errors.map((d: any) => d.message).join("; ")}`,
      );
    }

    const svg = await renderer.renderSvg({
      artifactContent: result?.result ?? result,
      format: "vector",
      data_selection: { body: true, defs: true, css: true, js: false },
    });
    writeFileSync(join(outDir, `${id}.svg`), stripTextLayer(svg));
  }
}

/**
 * An `<img>` renders SVG in secure static mode: no scripts, and no XHTML inside
 * `foreignObject`. The renderer's selectable-text layer is both, and a browser
 * that meets it reports the image as having no size at all. The gallery is a
 * chooser, so the glyphs are the whole point and the text layer is dropped.
 */
function stripTextLayer(svg: string) {
  return svg
    .replace(/\r\n?/g, "\n")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "");
}

export async function generateTemplatePreviews() {
  const startedAt = performance.now();
  await renderAll();
  const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Generated ${Object.keys(GALLERY).length} template previews in ${elapsed}s.`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  generateTemplatePreviews().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
