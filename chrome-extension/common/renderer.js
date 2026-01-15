import { getSettings } from "./storage.js";

let compilerPromise = null;

async function getTypstCompiler() {
  if (!compilerPromise) {
    compilerPromise = (async () => {
      const typstUrl = chrome.runtime.getURL("vendor/typst/typst-ts/dist/esm/index.mjs");
      const compilerUrl = chrome.runtime.getURL("vendor/typst/typst-ts/dist/esm/compiler.mjs");
      const typstModule = await import(typstUrl);
      const compilerModule = await import(compilerUrl);

      const compiler = typstModule.createTypstCompiler();
      await compiler.init({
        getWrapper: () => import(chrome.runtime.getURL("vendor/typst/compiler/pkg/typst_ts_web_compiler.mjs")),
        getModule: () => ({
          module_or_path: chrome.runtime.getURL("vendor/typst/compiler/pkg/typst_ts_web_compiler_bg.wasm")
        }),
        beforeBuild: [typstModule.loadFonts([], { assets: ["text"] })]
      });

      return {
        compiler,
        CompileFormatEnum: compilerModule.CompileFormatEnum
      };
    })();
  }
  return compilerPromise;
}

export async function renderDocument({ source, format }) {
  const settings = await getSettings();
  if (settings.renderer?.mode === "endpoint") {
    return renderViaEndpoint({ source, format, endpoint: settings.renderer.endpointUrl });
  }

  if (format !== "typst") {
    throw new Error("Only Typst rendering is supported in local WASM mode.");
  }

  const { compiler, CompileFormatEnum } = await getTypstCompiler();
  const sourceBytes = new TextEncoder().encode(source);
  compiler.mapShadow("/main.typ", sourceBytes);
  let result;
  try {
    result = await compiler.compile({
      mainFilePath: "/main.typ",
      root: "/",
      format: CompileFormatEnum.pdf
    });
  } finally {
    compiler.unmapShadow("/main.typ");
  }

  const bytes = result?.result || result;
  if (!bytes) {
    throw new Error("Typst compiler returned no PDF output.");
  }

  return new Blob([bytes], { type: "application/pdf" });
}

async function renderViaEndpoint({ source, format, endpoint }) {
  if (!endpoint) {
    throw new Error("Renderer endpoint is not configured.");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      format,
      source
    })
  });

  if (!response.ok) {
    throw new Error(`Renderer endpoint error (${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: "application/pdf" });
}

export function renderRawSource(source, format) {
  const type = format === "latex" ? "application/x-tex" : "application/x-typst";
  return new Blob([source], { type });
}
