import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useAction, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '@/lib/convex'
import { cn } from '@/lib/utils'
import SidebarLayout from '@/components/SidebarLayout'
import { extractTextFromPdf } from '@/lib/extractText'
import type { Id } from '../../convex/_generated/dataModel'

type RoastSeverity = 'mild' | 'spicy'

type RoastComment = {
  id: number
  quote: string
  comment: string
  severity: RoastSeverity
}

type RoastMetrics = {
  ats: { score: number; note: string }
  readability: { score: number; note: string }
  xyz: { score: number; note: string }
  keywords: { score: number | null; note: string }
}

type RoastResult = {
  summary: string
  metrics: RoastMetrics
  comments: RoastComment[]
}

type HighlightSegment = {
  text: string
  commentId?: number
}

type PageTextMap = {
  text: string
  spans: HTMLSpanElement[]
  positions: { start: number; end: number }[]
  normalizedText: string
  normalizedMap: number[]
  compactText: string
  compactMap: number[]
}

export const Route = createFileRoute('/roast')({
  component: RoastPage,
})

function RoastPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Access Denied</h1>
            <p className="mb-6 text-slate-600 dark:text-slate-400">
              You need to <Link to="/sign-in" className="text-primary hover:underline">sign in</Link> to view this page.
            </p>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <RoastContent />
      </Authenticated>
    </>
  )
}

function RoastContent() {
  const documents = useQuery(api.documents.listMyRecentDocuments, { limit: 50 })
  const [sourceMode, setSourceMode] = useState<'upload' | 'generated'>('upload')
  const [previewMode, setPreviewMode] = useState<'pdf' | 'text'>('pdf')
  const [selectedDocId, setSelectedDocId] = useState<string>('')
  const selectedDoc = useQuery(
    api.documents.getMyDocument,
    selectedDocId ? { documentId: selectedDocId as Id<'documents'> } : 'skip',
  )
  const roast = useAction(api.roast.roastResume)

  const [resumeText, setResumeText] = useState('')
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<RoastResult | null>(null)
  const [isRoasting, setIsRoasting] = useState(false)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [commentsHeight, setCommentsHeight] = useState<number | null>(null)
  const [pdfRenderVersion, setPdfRenderVersion] = useState(0)
  const previewCardRef = useRef<HTMLDivElement | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement | null>(null)
  const pageTextMapRef = useRef<Map<number, PageTextMap>>(new Map())

  const resumeDocs = useMemo(() => {
    return (documents ?? []).filter((doc: any) => doc.type === 'resume')
  }, [documents])

  const highlightedSegments = useMemo(() => {
    if (!result || !resumeText) return [{ text: resumeText }]
    return buildHighlights(resumeText, result.comments ?? [])
  }, [resumeText, result])

  function handleModeChange(mode: 'upload' | 'generated') {
    setSourceMode(mode)
    setStatus('')
    setError('')
    setResult(null)
    if (mode === 'generated') {
      setPdfData(null)
      setPreviewMode('text')
    }
  }

  function loadResumeFromDocument(doc: any) {
    if (!doc) return
    const text = resumeDataToText(doc.data) || stripTypst(doc.typstSource || '')
    setResumeText(text)
    setPdfData(null)
    setPreviewMode('text')
    setStatus(text ? 'Loaded from generated resume.' : 'Could not extract resume text.')
  }

  async function handleFileUpload(file: File | null) {
    if (!file) return
    setStatus('')
    setError('')
    setResult(null)

    if (file.type !== 'application/pdf') {
      setError('Only PDF uploads are supported for roasting.')
      return
    }

    try {
      setStatus('Extracting text from PDF…')
      setPreviewMode('pdf')
      setPdfData(await file.arrayBuffer())
      const text = await extractTextFromPdf(file)
      setResumeText(text)
      setStatus('Resume loaded. Ready to roast.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract PDF text.')
      setStatus('')
    }
  }

  useEffect(() => {
    let cancelled = false
    async function renderPdf() {
      if (!pdfData) return
      if (previewMode !== 'pdf') return
      if (!pdfContainerRef.current) return
      const container = pdfContainerRef.current
      container.innerHTML = ''
      pageTextMapRef.current.clear()
      const pdfjsLib = await import('pdfjs-dist')
      const PdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      const viewer = await import('pdfjs-dist/web/pdf_viewer')
      const TextLayerBuilder = viewer.TextLayerBuilder
      pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker.default

      // Clone the data to prevent the original ArrayBuffer from being detached
      const data = pdfData.slice(0)
      const pdf = await pdfjsLib.getDocument({ data }).promise
      for (let i = 1; i <= pdf.numPages; i += 1) {
        if (cancelled) return
        const page = await pdf.getPage(i)
        const baseViewport = page.getViewport({ scale: 1 })
        const containerWidth = container.clientWidth ? container.clientWidth - 16 : baseViewport.width
        const scale = Math.min(2, containerWidth / baseViewport.width)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) continue
        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        canvas.className = 'block'

        const wrapper = document.createElement('div')
        wrapper.className = 'space-y-2'
        const label = document.createElement('div')
        label.className = 'text-xs font-semibold uppercase tracking-wider text-slate-500'
        label.textContent = `Page ${i}`
        wrapper.appendChild(label)

        const pageWrapper = document.createElement('div')
        pageWrapper.className = 'roast-pdf-page relative rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700'
        pageWrapper.style.width = `${viewport.width}px`
        pageWrapper.style.height = `${viewport.height}px`
        pageWrapper.appendChild(canvas)
        wrapper.appendChild(pageWrapper)
        container.appendChild(wrapper)

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
        await page.render({ canvasContext: context, viewport, transform }).promise

        if (typeof TextLayerBuilder !== 'function') {
          throw new Error('PDF text layer is unavailable in this build of pdfjs-dist.')
        }

        const textMapping = {
          textDivs: [] as HTMLSpanElement[],
          textContentItemsStr: [] as string[],
        }

        const highlighter = {
          setTextMapping(divs: HTMLSpanElement[], strs: string[]) {
            textMapping.textDivs = divs
            textMapping.textContentItemsStr = strs
          },
          enable() {},
          disable() {},
        }

        const textLayerBuilder = new TextLayerBuilder({
          pdfPage: page,
          highlighter,
          onAppend: (layer: HTMLDivElement) => {
            layer.classList.add('roast-text-layer')
            layer.style.width = `${viewport.width}px`
            layer.style.height = `${viewport.height}px`
            pageWrapper.appendChild(layer)
          },
        })

        await textLayerBuilder.render({ viewport })

        const spans = textMapping.textDivs.length
          ? textMapping.textDivs
          : (Array.from(pageWrapper.querySelectorAll('.textLayer span')) as HTMLSpanElement[])
        const itemStrings = textMapping.textContentItemsStr.length
          ? textMapping.textContentItemsStr
          : spans.map((span) => span.textContent ?? '')
        const pageText = itemStrings.join(' ')
        const positions: { start: number; end: number }[] = []
        let cursor = 0
        itemStrings.forEach((value, idx) => {
          const start = cursor
          const end = start + value.length
          positions.push({ start, end })
          cursor = end
          if (idx < itemStrings.length - 1) cursor += 1
        })

        const normalized = normalizeWithMap(pageText, 'whitespace')
        const compact = normalizeWithMap(pageText, 'compact')
        const usableSpans = spans.slice(0, positions.length)
        pageTextMapRef.current.set(i, {
          text: pageText,
          spans: usableSpans,
          positions: positions.slice(0, usableSpans.length),
          normalizedText: normalized.text,
          normalizedMap: normalized.map,
          compactText: compact.text,
          compactMap: compact.map,
        })
      }
      if (!cancelled) {
        setPdfRenderVersion((version) => version + 1)
      }
    }
    void renderPdf()
    return () => {
      cancelled = true
    }
  }, [pdfData, previewMode])

  useEffect(() => {
    if (previewMode !== 'text') return
    const container = pdfContainerRef.current
    if (container) {
      container.innerHTML = ''
    }
    pageTextMapRef.current.clear()
  }, [previewMode])

  useEffect(() => {
    if (!previewCardRef.current || typeof ResizeObserver === 'undefined') return
    const element = previewCardRef.current
    const updateHeight = () => {
      const height = element.getBoundingClientRect().height
      if (height) setCommentsHeight(height)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [previewMode, pdfData, resumeText, result])

  useEffect(() => {
    if (!pdfData) return
    const handleSelection = () => {
      if (previewMode !== 'pdf') return
      const container = pdfContainerRef.current
      if (!container) return
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return
      if (!selection.toString().trim()) return
      const anchorNode = selection.anchorNode
      const focusNode = selection.focusNode
      if (
        (anchorNode && container.contains(anchorNode)) ||
        (focusNode && container.contains(focusNode))
      ) {
        setPreviewMode('text')
      }
    }
    document.addEventListener('selectionchange', handleSelection)
    return () => {
      document.removeEventListener('selectionchange', handleSelection)
    }
  }, [previewMode, pdfData])

  useEffect(() => {
    if (!result?.comments?.length) return
    const pages = pageTextMapRef.current
    pages.forEach((page) => {
      page.spans.forEach((span) => {
        span.classList.remove('roast-highlight', 'roast-highlight-active')
        span.removeAttribute('data-comment-id')
      })
    })

    const matches: Array<{ page: number; start: number; end: number; commentId: number }> = []

    result.comments.forEach((comment, index) => {
      const commentId = comment.id ?? index + 1
      const quote = comment.quote?.trim()
      if (!quote) return

      for (const [pageNumber, page] of pages.entries()) {
        const pageMatches = findMatchesInPage(page, quote)
        if (pageMatches.length) {
          pageMatches.forEach((match) => {
            matches.push({
              page: pageNumber,
              start: match.start,
              end: match.end,
              commentId,
            })
          })
          break
        }
      }
    })

    matches.forEach((match) => {
      const page = pages.get(match.page)
      if (!page) return
      page.spans.forEach((span, idx) => {
        const pos = page.positions[idx]
        if (!pos) return
        const overlaps = pos.start < match.end && pos.end > match.start
        if (!overlaps) return
        span.classList.add('roast-highlight')
        span.dataset.commentId = String(match.commentId)
        if (hoveredId === match.commentId) {
          span.classList.add('roast-highlight-active')
        }
      })
    })
  }, [result, hoveredId, pdfData, pdfRenderVersion])

  async function handleRoast() {
    setError('')
    setStatus('')
    if (!resumeText.trim()) {
      setError('Upload a PDF or select a generated resume first.')
      return
    }
    try {
      setIsRoasting(true)
      const response = await roast({
        resumeText,
        jobDescription: jobDescription.trim() || undefined,
      })
      setResult(response as RoastResult)
      setStatus('Roast complete. Brace yourself.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roast resume.')
    } finally {
      setIsRoasting(false)
    }
  }

  const metrics = result?.metrics

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Resume Roast</h1>
            <p className="text-sm text-slate-500">Upload a resume or select a generated one. Optional job description boosts keyword checks.</p>
          </div>
          <button
            type="button"
            onClick={handleRoast}
            disabled={isRoasting}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRoasting ? 'Roasting…' : 'Roast My Resume'}
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Resume Source</h2>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleModeChange('upload')}
                  className={cn(
                    'rounded-full px-3 py-1 font-semibold',
                    sourceMode === 'upload'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
                  )}
                >
                  Upload PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('generated')}
                  className={cn(
                    'rounded-full px-3 py-1 font-semibold',
                    sourceMode === 'generated'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
                  )}
                >
                  Use Generated
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {sourceMode === 'upload' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">PDF Upload Only</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => handleFileUpload(event.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-300 dark:file:bg-slate-700 dark:file:text-slate-200"
                  />
                  <p className="text-xs text-slate-500">Only PDF files are supported for roasting.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Generated Resume</label>
                  <select
                    value={selectedDocId}
                    onChange={(event) => setSelectedDocId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="">Select a resume…</option>
                    {resumeDocs.map((doc: any) => (
                      <option key={doc._id} value={doc._id}>
                        {(doc.job?.title || 'Untitled Resume') + (doc.job?.company ? ` · ${doc.job.company}` : '')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => loadResumeFromDocument(selectedDoc)}
                    disabled={!selectedDoc}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Load selected resume
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Job Description (Optional)</label>
                <textarea
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Paste the job description for keyword/fit checks..."
                />
              </div>

              {status ? <p className="text-xs text-emerald-600">{status}</p> : null}
              {error ? <p className="text-xs text-rose-500">{error}</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-semibold">Roast Metrics</h2>
            <p className="mt-1 text-xs text-slate-500">ATS, readability, XYZ impact, and keyword coverage.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {renderMetricCard('ATS Format', metrics?.ats)}
              {renderMetricCard('Readability', metrics?.readability)}
              {renderMetricCard('XYZ Format', metrics?.xyz)}
              {renderMetricCard('Keyword Match', metrics?.keywords)}
            </div>

            {result?.summary ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</p>
                <p className="mt-2">{result.summary}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div
            ref={previewCardRef}
            className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resume Preview</h3>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const selection = window.getSelection()
                    if (selection && !selection.isCollapsed) {
                      selection.removeAllRanges()
                    }
                    setPreviewMode('pdf')
                  }}
                  disabled={!pdfData}
                  className={cn(
                    'rounded-full px-3 py-1 font-semibold transition-colors',
                    previewMode === 'pdf'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
                    !pdfData && 'opacity-50',
                  )}
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('text')}
                  className={cn(
                    'rounded-full px-3 py-1 font-semibold transition-colors',
                    previewMode === 'text'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
                  )}
                >
                  Text
                </button>
              </div>
            </div>
            <div className="p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              <div className={cn(previewMode === 'text' ? 'block' : 'hidden')}>
                {resumeText ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-inner dark:border-slate-700 dark:bg-slate-900">
                    <div className="max-h-[520px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {highlightedSegments.map((segment, index) => {
                        if (!segment.commentId) return <span key={index}>{segment.text}</span>
                        const isActive = hoveredId === segment.commentId
                        return (
                          <mark
                            key={index}
                            onMouseEnter={() => setHoveredId(segment.commentId || null)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={cn(
                              'rounded-sm bg-amber-200/70 px-1 py-0.5 text-slate-900',
                              isActive && 'ring-2 ring-amber-400',
                            )}
                          >
                            {segment.text}
                            <sup className="ml-1 text-[10px] font-semibold text-slate-600">{segment.commentId}</sup>
                          </mark>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Upload a PDF or select a resume to see highlighted feedback.</p>
                )}
              </div>

              <div className={cn(previewMode === 'pdf' ? 'block' : 'hidden')}>
                {pdfData ? (
                  <div ref={pdfContainerRef} className="space-y-6" />
                ) : (
                  <p className="text-slate-400">Upload a PDF to render a preview.</p>
                )}
              </div>
            </div>
          </div>

          <div
            className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
            style={commentsHeight ? { height: `${commentsHeight}px` } : undefined}
          >
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Comments</h3>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {result?.comments?.length ? (
                result.comments.map((comment, index) => {
                  const id = comment.id ?? index + 1
                  const isActive = hoveredId === id
                  return (
                    <div
                      key={id}
                      onMouseEnter={() => setHoveredId(id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                        isActive && 'ring-2 ring-amber-400',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Comment {id}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                            comment.severity === 'spicy'
                              ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                          )}
                        >
                          {comment.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-xs italic text-slate-500">“{comment.quote}”</p>
                      <p className="mt-2 text-sm">{comment.comment}</p>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-slate-400">Run a roast to get comments.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}

function buildHighlights(text: string, comments: RoastComment[]): HighlightSegment[] {
  if (!text) return []
  let segments: HighlightSegment[] = [{ text }]

  comments.forEach((comment, index) => {
    const id = comment.id ?? index + 1
    const quote = comment.quote
    if (!quote) return

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i]
      if (segment.commentId) continue
      const idx = segment.text.indexOf(quote)
      if (idx === -1) continue

      const before = segment.text.slice(0, idx)
      const match = segment.text.slice(idx, idx + quote.length)
      const after = segment.text.slice(idx + quote.length)

      const next: HighlightSegment[] = []
      if (before) next.push({ text: before })
      next.push({ text: match, commentId: id })
      if (after) next.push({ text: after })

      segments = [...segments.slice(0, i), ...next, ...segments.slice(i + 1)]
      break
    }
  })

  return segments
}

function normalizeForSearch(input: string) {
  if (!input) return ''
  const { text } = normalizeWithMap(input, 'whitespace')
  return text
}

function normalizeForSearchCompact(input: string) {
  if (!input) return ''
  const { text } = normalizeWithMap(input, 'compact')
  return text
}

function findMatchesInPage(
  page: PageTextMap,
  quote: string,
): Array<{ start: number; end: number }> {
  const results: Array<{ start: number; end: number }> = []
  if (!quote) return results

  const direct = findAllIndices(page.text, quote)
  if (direct.length) {
    direct.forEach((start) => results.push({ start, end: start + quote.length }))
    return results
  }

  const lowerQuote = quote.toLowerCase()
  const lowerText = page.text.toLowerCase()
  const lowerMatches = findAllIndices(lowerText, lowerQuote)
  if (lowerMatches.length) {
    lowerMatches.forEach((start) => results.push({ start, end: start + quote.length }))
    return results
  }

  const normalizedQuote = normalizeForSearch(quote)
  if (!normalizedQuote) return results

  const normalizedMatches = findAllIndices(page.normalizedText, normalizedQuote)
  normalizedMatches.forEach((normalizedIndex) => {
    const rawStart = page.normalizedMap[normalizedIndex]
    const rawEnd = page.normalizedMap[normalizedIndex + normalizedQuote.length - 1]
    if (typeof rawStart === 'number' && typeof rawEnd === 'number') {
      results.push({ start: rawStart, end: rawEnd + 1 })
    }
  })

  if (results.length) return results

  const compactQuote = normalizeForSearchCompact(quote)
  if (!compactQuote) return results

  const compactMatches = findAllIndices(page.compactText, compactQuote)
  compactMatches.forEach((compactIndex) => {
    const rawStart = page.compactMap[compactIndex]
    const rawEnd = page.compactMap[compactIndex + compactQuote.length - 1]
    if (typeof rawStart === 'number' && typeof rawEnd === 'number') {
      results.push({ start: rawStart, end: rawEnd + 1 })
    }
  })

  return results
}

function findAllIndices(haystack: string, needle: string) {
  const indices: number[] = []
  if (!haystack || !needle) return indices
  let startIndex = 0
  while (startIndex < haystack.length) {
    const index = haystack.indexOf(needle, startIndex)
    if (index === -1) break
    indices.push(index)
    startIndex = index + Math.max(1, needle.length)
  }
  return indices
}

function normalizeWithMap(input: string, mode: 'whitespace' | 'compact') {
  let normalized = ''
  const map: number[] = []
  let lastWasSpace = false
  const separators = /[|•·‖¦–—\-]+/
  for (let i = 0; i < input.length; i += 1) {
    let ch = input[i]
    if (ch === '“' || ch === '”') ch = '"'
    if (ch === '‘' || ch === '’') ch = "'"
    const isSpace = /\s/.test(ch)
    const isSeparator = separators.test(ch)
    if (mode === 'compact') {
      const isAlphaNum = /[a-z0-9]/i.test(ch)
      if (!isAlphaNum) continue
      normalized += ch.toLowerCase()
      map.push(i)
      lastWasSpace = false
      continue
    }

    if (isSpace || isSeparator) {
      if (normalized.length === 0 || lastWasSpace) continue
      normalized += ' '
      map.push(i)
      lastWasSpace = true
      continue
    }
    normalized += ch.toLowerCase()
    map.push(i)
    lastWasSpace = false
  }
  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1)
    map.pop()
  }
  return { text: normalized, map }
}

function stripTypst(source: string) {
  return source
    .replace(/#\w+\([^\)]*\)/g, ' ')
    .replace(/[{}#\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resumeDataToText(data: any): string {
  if (!data || typeof data !== 'object') return ''
  const parts: string[] = []

  if (data.personal?.fullName) parts.push(String(data.personal.fullName))
  if (data.personal?.email) parts.push(String(data.personal.email))
  if (data.personal?.phone) parts.push(String(data.personal.phone))
  if (data.personal?.location) parts.push(String(data.personal.location))
  if (data.summary) parts.push(String(data.summary))

  if (Array.isArray(data.experience)) {
    data.experience.forEach((exp: any) => {
      if (exp.title || exp.company) {
        parts.push(`${exp.title || ''} ${exp.company || ''}`.trim())
      }
      if (Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet: string) => parts.push(String(bullet)))
      }
    })
  }

  if (Array.isArray(data.education)) {
    data.education.forEach((edu: any) => {
      const line = [edu.degree, edu.major, edu.institution].filter(Boolean).join(' · ')
      if (line) parts.push(line)
      if (Array.isArray(edu.bullets)) {
        edu.bullets.forEach((bullet: string) => parts.push(String(bullet)))
      }
    })
  }

  if (Array.isArray(data.projects)) {
    data.projects.forEach((project: any) => {
      if (project.name) parts.push(String(project.name))
      if (Array.isArray(project.bullets)) {
        project.bullets.forEach((bullet: string) => parts.push(String(bullet)))
      }
    })
  }

  if (Array.isArray(data.skills)) {
    data.skills.forEach((skill: any) => {
      if (skill.category) parts.push(String(skill.category))
      if (Array.isArray(skill.items)) {
        parts.push(skill.items.join(', '))
      }
    })
  }

  return parts.join('\n')
}

function renderMetricCard(label: string, metric?: { score: number | null; note: string }) {
  const score = typeof metric?.score === 'number' ? Math.max(0, Math.min(100, metric.score)) : null
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {score === null ? 'N/A' : `${score}%`}
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{metric?.note || 'No notes yet.'}</p>
    </div>
  )
}
