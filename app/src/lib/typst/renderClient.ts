import { COVER_TEMPLATES, RESUME_TEMPLATES } from '../../../convex/lib/templates'

import modernCvProfilePngUrl from '../../../templates/modern-cv/profile.png?url'
import neatCvProfilePngUrl from '../../../templates/neat-cv/profile.png?url'
import neatCvPublicationsYml from '../../../templates/neat-cv/publications.yml?raw'
import impressiveUtilsTyp from '../../../templates/impressive-impression/utils.typ?raw'
import impressiveThemeTyp from '../../../templates/impressive-impression/theme.typ?raw'
import impressiveProfilePngUrl from '../../../templates/impressive-impression/assets/profile.png?url'
import impressiveSignatureSvg from '../../../templates/impressive-impression/assets/signature.svg?raw'
import impressiveFlagFrSvg from '../../../templates/impressive-impression/assets/flags/fr.svg?raw'
import impressiveFlagGbSvg from '../../../templates/impressive-impression/assets/flags/gb.svg?raw'
import impressiveFlagGrSvg from '../../../templates/impressive-impression/assets/flags/gr.svg?raw'

type RenderInput = {
  source: string
  documentType: 'resume' | 'cover_letter'
  templateId: string
}

type TemplateMeta = { entryPath: string; assets: string[] }

type TypstCompilerBundle = {
  compiler: any
  accessModel: any
  CompileFormatEnum: any
}

type TypstRendererBundle = {
  renderer: any
}

const ASSET_URLS: Record<string, string> = {
  'templates/modern-cv/profile.png': modernCvProfilePngUrl,
  'templates/neat-cv/profile.png': neatCvProfilePngUrl,
  'templates/impressive-impression/assets/profile.png': impressiveProfilePngUrl,
}

const ASSET_TEXTS: Record<string, string> = {
  'templates/neat-cv/publications.yml': neatCvPublicationsYml,
  'templates/impressive-impression/utils.typ': impressiveUtilsTyp,
  'templates/impressive-impression/theme.typ': impressiveThemeTyp,
  'templates/impressive-impression/assets/signature.svg': impressiveSignatureSvg,
  'templates/impressive-impression/assets/flags/fr.svg': impressiveFlagFrSvg,
  'templates/impressive-impression/assets/flags/gb.svg': impressiveFlagGbSvg,
  'templates/impressive-impression/assets/flags/gr.svg': impressiveFlagGrSvg,
}

const GOOGLE_FONT_URLS = [
  'https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/SourceSans3-Italic%5Bwght%5D.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OpenSans-Italic%5Bwdth%2Cwght%5D.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto-Italic%5Bwdth%2Cwght%5D.ttf',
]

const assetBytesCache = new Map<string, Promise<Uint8Array>>()

async function getAssetBytes(assetRel: string): Promise<Uint8Array> {
  const cached = assetBytesCache.get(assetRel)
  if (cached) return cached

  const promise = (async () => {
    if (assetRel in ASSET_TEXTS) {
      return new TextEncoder().encode(normalizeTypstSource(ASSET_TEXTS[assetRel]!))
    }
    if (assetRel in ASSET_URLS) {
      const res = await fetch(ASSET_URLS[assetRel]!)
      if (!res.ok) {
        throw new Error(`Failed to load template asset: ${assetRel}`)
      }
      return new Uint8Array(await res.arrayBuffer())
    }
    throw new Error(`Missing embedded template asset: ${assetRel}`)
  })()

  assetBytesCache.set(assetRel, promise)
  return promise
}

function getTemplateMeta(input: RenderInput): TemplateMeta {
  if (input.templateId.startsWith('custom:')) {
    return { entryPath: 'templates/custom/main.typ', assets: [] }
  }
  if (input.documentType === 'resume') {
    const tmpl = (RESUME_TEMPLATES as Record<string, TemplateMeta>)[input.templateId]
    if (!tmpl) throw new Error('Unknown templateId.')
    return tmpl
  }
  const tmpl = (COVER_TEMPLATES as Record<string, TemplateMeta>)[input.templateId]
  if (!tmpl) throw new Error('Unknown templateId.')
  return tmpl
}

let compilerPromise: Promise<TypstCompilerBundle> | null = null
let compilerMutex: Promise<void> = Promise.resolve()
let rendererPromise: Promise<TypstRendererBundle> | null = null
let rendererMutex: Promise<void> = Promise.resolve()

async function getTypstCompilerBundle(): Promise<TypstCompilerBundle> {
  if (!compilerPromise) {
    compilerPromise = (async () => {
      if (typeof window === 'undefined') {
        throw new Error('Typst client renderer can only run in the browser.')
      }

      const typstModule = await import('@myriaddreamin/typst.ts')
      const compilerModule = await import('@myriaddreamin/typst.ts/compiler')
      const optionsInit = await import('@myriaddreamin/typst.ts/options.init')
      const { MemoryAccessModel } = await import('@myriaddreamin/typst.ts/fs/memory')
      const { FetchPackageRegistry } = await import('@myriaddreamin/typst.ts/fs/package')

      const compiler = typstModule.createTypstCompiler()
      const accessModel = new MemoryAccessModel()
      const packageRegistry = new FetchPackageRegistry(accessModel)
      const wasmUrl = (await import('@myriaddreamin/typst-ts-web-compiler/wasm?url'))
        .default as string

      await compiler.init({
        getWrapper: () => import('@myriaddreamin/typst-ts-web-compiler'),
        getModule: () => wasmUrl,
        beforeBuild: [
          optionsInit.loadFonts(GOOGLE_FONT_URLS, { assets: ['text', 'cjk'] }),
          optionsInit.withAccessModel(accessModel),
          optionsInit.withPackageRegistry(packageRegistry),
        ],
      })

      return {
        compiler,
        accessModel,
        CompileFormatEnum: compilerModule.CompileFormatEnum,
      }
    })()
  }
  return compilerPromise
}

async function getTypstRendererBundle(): Promise<TypstRendererBundle> {
  if (!rendererPromise) {
    rendererPromise = (async () => {
      if (typeof window === 'undefined') {
        throw new Error('Typst renderer can only run in the browser.')
      }

      const typstModule = await import('@myriaddreamin/typst.ts')
      const wasmUrl = (await import('@myriaddreamin/typst-ts-renderer/wasm?url'))
        .default as string

      const renderer = typstModule.createTypstRenderer()
      await renderer.init({
        getWrapper: () => import('@myriaddreamin/typst-ts-renderer'),
        getModule: () => wasmUrl,
      })

      return { renderer }
    })()
  }
  return rendererPromise
}

async function withCompilerLock<T>(task: () => Promise<T>) {
  const previous = compilerMutex
  let release: () => void
  compilerMutex = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await task()
  } finally {
    release!()
  }
}

async function withRendererLock<T>(task: () => Promise<T>) {
  const previous = rendererMutex
  let release: () => void
  rendererMutex = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await task()
  } finally {
    release!()
  }
}

async function compileTypst(input: RenderInput, format: 'pdf' | 'vector'): Promise<Uint8Array> {
  if (!input.source?.trim()) {
    throw new Error('Missing Typst source.')
  }

  const template = getTemplateMeta(input)
  const root = '/@memory'
  const mainFilePath = `${root}/${template.entryPath}`
  const source = normalizeTypstSource(input.source)

  return await withCompilerLock(async () => {
    const { compiler, accessModel, CompileFormatEnum } = await getTypstCompilerBundle()
    const compileFormat =
      format === 'pdf' ? CompileFormatEnum.pdf : CompileFormatEnum.vector

    accessModel.insertFile(mainFilePath, new TextEncoder().encode(source), new Date())
    for (const assetRel of template.assets || []) {
      const assetPath = `${root}/${assetRel}`
      const bytes = await getAssetBytes(assetRel)
      accessModel.insertFile(assetPath, bytes, new Date())
    }

    const result = await compiler.compile({
      root,
      mainFilePath,
      format: compileFormat,
      diagnostics: 'full',
    })

    const diagnostics: any[] | undefined = result?.diagnostics
    const errors = diagnostics?.filter((diagnostic) => {
      const severity = String(
        diagnostic?.severity || diagnostic?.level || diagnostic?.kind || ''
      ).toLowerCase()
      return severity !== 'warning' && severity !== 'warn'
    })
    if (errors?.length) {
      const message = errors
        .map((d) => d?.message || d?.text || JSON.stringify(d))
        .filter(Boolean)
        .join('; ')
      throw new Error(`Typst compilation error: ${message}`)
    }

    return toUint8Array(result?.result ?? result, format)
  })
}

export async function renderTypstToPdfBytesInBrowser(input: RenderInput): Promise<Uint8Array> {
  return await compileTypst(input, 'pdf')
}

export async function renderTypstToVectorArtifactInBrowser(
  input: RenderInput
): Promise<Uint8Array> {
  return await compileTypst(input, 'vector')
}

export async function renderTypstToCanvasInBrowser(
  input: RenderInput & {
    container: HTMLElement
    backgroundColor?: string
    pixelPerPt?: number
  }
): Promise<void> {
  if (!input.container) {
    throw new Error('Missing preview container.')
  }

  const artifact = await renderTypstToVectorArtifactInBrowser(input)
  await withRendererLock(async () => {
    const { renderer } = await getTypstRendererBundle()
    await renderer.renderToCanvas({
      container: input.container,
      format: 'vector',
      artifactContent: artifact,
      backgroundColor: input.backgroundColor ?? '#ffffff',
      pixelPerPt: input.pixelPerPt,
    })
  })
}

function normalizeTypstSource(source: string) {
  let updated = normalizeFontFamilies(source)
  updated = normalizeEmptyLinks(updated)
  updated = normalizeTupleFields(updated, ['positions', 'keywords', 'position'])
  updated = normalizeFunctionTuple(updated, 'tags')
  updated = normalizeFunctionTuple(updated, 'item-pills')
  return updated
}

function normalizeFontFamilies(source: string) {
  return source
    .replace(/"Source Sans Pro"/gi, '"New Computer Modern"')
    .replace(/"Source Sans 3"/gi, '"New Computer Modern"')
    .replace(/"Roboto"/gi, '"New Computer Modern"')
    .replace(/"Open Sans"/gi, '"New Computer Modern"')
}

function normalizeEmptyLinks(source: string) {
  return source.replace(/#link\(\s*""\s*\)\s*\[([^\]]*)\]/g, '$1')
}

function normalizeTupleFields(source: string, fields: string[]) {
  let updated = source
  for (const field of fields) {
    const pattern = new RegExp(`(${field}\\s*:\\s*\\()([^\\)]+?)\\)`, 'g')
    updated = updated.replace(pattern, (match, prefix, inner: string) => {
      if (inner.includes(',')) return match
      return `${prefix}${inner},)`
    })
  }
  return updated
}

function normalizeFunctionTuple(source: string, fnName: string) {
  const pattern = new RegExp(`#${fnName}\\(([^\\)]*)\\)`, 'g')
  return source.replace(pattern, (match, inner: string) => {
    const trimmed = inner.trim()
    if (!trimmed) return match
    if (trimmed.startsWith('(')) return match
    if (trimmed.includes(',')) {
      return `#${fnName}((${trimmed}))`
    }
    return `#${fnName}((${trimmed},))`
  })
}

function toUint8Array(bytes: unknown, format: 'pdf' | 'vector') {
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  throw new Error(
    `Typst compiler returned no ${format === 'pdf' ? 'PDF' : 'vector'} output.`
  )
}
