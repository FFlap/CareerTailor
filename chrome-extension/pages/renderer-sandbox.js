import {
  createTypstCompiler,
  loadFonts,
  MemoryAccessModel,
  FetchPackageRegistry,
  initOptions
} from "../vendor/typst/typst-ts/dist/esm/index.mjs";
import { CompileFormatEnum } from "../vendor/typst/typst-ts/dist/esm/compiler.mjs";

let compilerPromise = null;

async function getCompiler() {
  if (!compilerPromise) {
    compilerPromise = (async () => {
      const accessModel = new MemoryAccessModel();
      const packageRegistry = new FetchPackageRegistry(accessModel);
      const compiler = createTypstCompiler();
      await compiler.init({
        getWrapper: () => import("../vendor/typst/compiler/pkg/typst_ts_web_compiler.mjs"),
        getModule: () => ({
          module_or_path: new URL(
            "../vendor/typst/compiler/pkg/typst_ts_web_compiler_bg.wasm",
            import.meta.url
          ).toString()
        }),
        beforeBuild: [
          initOptions.withAccessModel(accessModel),
          initOptions.withPackageRegistry(packageRegistry),
          loadFonts([], { assets: ["text"] })
        ]
      });
      return compiler;
    })();
  }
  return compilerPromise;
}

function toArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes;
  if (bytes?.buffer) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  return null;
}

function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  const buffer = toArrayBuffer(bytes);
  return buffer ? new Uint8Array(buffer) : null;
}

function formatDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return "";
  }
  const lines = diagnostics.slice(0, 3).map((diag) => {
    const severity = String(diag?.severity || "error").toUpperCase();
    const location = [diag?.path, diag?.range].filter(Boolean).join(":");
    const message = String(diag?.message || "Unknown Typst error.");
    return [severity, location, message].filter(Boolean).join(" ");
  });
  if (diagnostics.length > 3) {
    lines.push(`...and ${diagnostics.length - 3} more.`);
  }
  return lines.join("\n");
}

self.addEventListener("message", async (event) => {
  const payload = event.data;
  if (!payload || payload.type !== "RENDER_TYPST") return;

  const { id, source, mainPath, assets } = payload;
  const entryPath = mainPath || "/main.typ";
  try {
    const compiler = await getCompiler();
    const sourceBytes = new TextEncoder().encode(source);
    const mappedPaths = [];
    compiler.mapShadow(entryPath, sourceBytes);
    mappedPaths.push(entryPath);
    if (Array.isArray(assets)) {
      assets.forEach((asset) => {
        if (!asset?.path || !asset?.content) return;
        const bytes = toUint8Array(asset.content);
        if (!bytes) return;
        compiler.mapShadow(asset.path, bytes);
        mappedPaths.push(asset.path);
      });
    }
    let result;
    try {
      result = await compiler.compile({
        mainFilePath: entryPath,
        root: "/",
        format: CompileFormatEnum.pdf,
        diagnostics: "full"
      });
    } finally {
      mappedPaths.forEach((path) => compiler.unmapShadow(path));
    }

    const buffer = toArrayBuffer(result?.result || result);
    if (!buffer) {
      const diagnosticMessage = formatDiagnostics(result?.diagnostics);
      throw new Error(diagnosticMessage || "Typst compiler returned no PDF output.");
    }

    event.source?.postMessage(
      {
        type: "RENDER_RESULT",
        id,
        ok: true,
        buffer
      },
      "*",
      [buffer]
    );
  } catch (error) {
    event.source?.postMessage(
      {
        type: "RENDER_RESULT",
        id,
        ok: false,
        error: error.message || "Rendering failed"
      },
      "*"
    );
  }
});

if (self.parent && self.parent !== self) {
  self.parent.postMessage({ type: "SANDBOX_READY" }, "*");
}
