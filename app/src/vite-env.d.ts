/// <reference types="vite/client" />

declare module '*?inline' {
  const dataUrl: string
  export default dataUrl
}

// pdfjs-dist ships the viewer without types; only the text layer is used here.
declare module 'pdfjs-dist/web/pdf_viewer' {
  export const TextLayerBuilder: new (options: {
    pdfPage: unknown
    highlighter?: unknown
    onAppend?: (layer: HTMLDivElement) => void
  }) => { render(options: { viewport: unknown }): Promise<void> }
}

