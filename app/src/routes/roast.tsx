import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useAction, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '@/lib/convex'
import { cn } from '@/lib/utils'
import SidebarLayout from '@/components/SidebarLayout'
import { EmptyState, Page, PageHeader, Panel, PanelHeader } from '@/components/ui/page'
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
        <SidebarLayout>
          <Page>
            <p className="text-sm text-slate-500">Loading…</p>
          </Page>
        </SidebarLayout>
      </AuthLoading>

      <Unauthenticated>
        <SidebarLayout>
          <Page>
            <EmptyState
              title="Sign in to roast a resume"
              description="Uploads and feedback stay with your account."
              action={
                <Link
                  to="/sign-in"
                  className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                >
                  Sign in
                </Link>
              }
            />
          </Page>
        </SidebarLayout>
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
  const [fileName, setFileName] = useState('')
  const [pdfRenderVersion, setPdfRenderVersion] = useState(0)
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

    setFileName(file.name)

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

  const hasResume = Boolean(resumeText || pdfData)

  return (
    <SidebarLayout>
      <Page className="max-w-6xl">
        <PageHeader
          title="Roast"
          description="An honest read of a resume: how it parses, how it reads, and the lines that are not pulling their weight."
          actions={
            result ? (
              <button
                type="button"
                onClick={handleRoast}
                disabled={isRoasting || !hasResume}
                className="rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                {isRoasting ? "Roasting…" : "Roast again"}
              </button>
            ) : null
          }
        />

        {/* Setup folds into the sidebar once there is a result to read. */}
        <div
          className={cn(
            "grid gap-4",
            result ? "lg:grid-cols-[1fr_20rem]" : "mx-auto max-w-2xl",
          )}
        >
          <div className={cn("space-y-4", result && "lg:order-2")}>
            {!result && (
              <Panel>
                <PanelHeader
                  title="Resume"
                  actions={
                    <div className="flex items-center gap-1">
                      <Choice
                        active={sourceMode === "upload"}
                        onClick={() => handleModeChange("upload")}
                      >
                        Upload
                      </Choice>
                      <Choice
                        active={sourceMode === "generated"}
                        onClick={() => handleModeChange("generated")}
                      >
                        Generated
                      </Choice>
                    </div>
                  }
                />
                <div className="space-y-4 p-4">
                  {sourceMode === "upload" ? (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 px-4 py-8 text-center transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900">
                      <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
                        Choose a PDF
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {fileName || "PDF is the only format that keeps layout"}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        onChange={(event) =>
                          handleFileUpload(event.target.files?.[0] || null)
                        }
                      />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={selectedDocId}
                        onChange={(event) => setSelectedDocId(event.target.value)}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 outline-none focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      >
                        <option value="">Select a resume…</option>
                        {resumeDocs.map((doc: any) => (
                          <option key={doc._id} value={doc._id}>
                            {(doc.job?.title || "Untitled resume") +
                              (doc.job?.company ? ` · ${doc.job.company}` : "")}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => loadResumeFromDocument(selectedDoc)}
                        disabled={!selectedDoc}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        Load resume
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="roast-jd"
                      className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                    >
                      Job description — optional, enables the keyword check
                    </label>
                    <textarea
                      id="roast-jd"
                      value={jobDescription}
                      onChange={(event) => setJobDescription(event.target.value)}
                      placeholder="Paste the posting."
                      className="min-h-[7rem] w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[13px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-300 focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRoast}
                    disabled={isRoasting || !hasResume}
                    className="w-full rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {isRoasting ? "Roasting…" : "Roast this resume"}
                  </button>

                  {status && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {status}
                    </p>
                  )}
                  {error && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      {error}
                    </p>
                  )}
                </div>
              </Panel>
            )}

            {result && (
              <>
                <Panel>
                  <PanelHeader title="Scores" />
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <MetricRow label="ATS format" metric={metrics?.ats} />
                    <MetricRow label="Readability" metric={metrics?.readability} />
                    <MetricRow label="XYZ impact" metric={metrics?.xyz} />
                    <MetricRow label="Keyword match" metric={metrics?.keywords} />
                  </div>
                </Panel>

                <Panel>
                  <PanelHeader
                    title="Comments"
                    meta={
                      result.comments?.length
                        ? `${result.comments.length}`
                        : undefined
                    }
                  />
                  <ul className="max-h-[32rem] overflow-y-auto">
                    {result.comments?.length ? (
                      result.comments.map((comment, index) => {
                        const id = comment.id ?? index + 1
                        const isActive = hoveredId === id
                        return (
                          <li
                            key={id}
                            onMouseEnter={() => setHoveredId(id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={cn(
                              "border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 dark:border-slate-800",
                              isActive && "bg-amber-50 dark:bg-amber-950/30",
                            )}
                          >
                            <div className="flex items-center gap-2 pb-1.5">
                              <span className="text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                                {id}
                              </span>
                              <span
                                aria-hidden
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  comment.severity === "spicy"
                                    ? "bg-rose-500"
                                    : "bg-amber-500",
                                )}
                              />
                              <span className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                                {comment.severity}
                              </span>
                            </div>
                            <p className="text-xs italic text-slate-400 dark:text-slate-500">
                              “{comment.quote}”
                            </p>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                              {comment.comment}
                            </p>
                          </li>
                        )
                      })
                    ) : (
                      <li className="px-4 py-6 text-center text-xs text-slate-400">
                        Nothing flagged.
                      </li>
                    )}
                  </ul>
                </Panel>
              </>
            )}
          </div>

          {result && (
            <div className="space-y-4 lg:order-1">
              <Panel>
                <div className="px-4 py-3.5">
                  <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                    {result.summary}
                  </p>
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <PanelHeader
                  title="The resume"
                  actions={
                    <div className="flex items-center gap-1">
                      <Choice
                        active={previewMode === "pdf"}
                        disabled={!pdfData}
                        onClick={() => {
                          const selection = window.getSelection()
                          if (selection && !selection.isCollapsed) {
                            selection.removeAllRanges()
                          }
                          setPreviewMode("pdf")
                        }}
                      >
                        Page
                      </Choice>
                      <Choice
                        active={previewMode === "text"}
                        onClick={() => setPreviewMode("text")}
                      >
                        Text
                      </Choice>
                    </div>
                  }
                />

                <div className="p-4">
                  <div className={cn(previewMode === "text" ? "block" : "hidden")}>
                    {resumeText ? (
                      <div className="max-h-[36rem] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {highlightedSegments.map((segment, index) => {
                          if (!segment.commentId)
                            return <span key={index}>{segment.text}</span>
                          const isActive = hoveredId === segment.commentId
                          return (
                            <mark
                              key={index}
                              onMouseEnter={() =>
                                setHoveredId(segment.commentId || null)
                              }
                              onMouseLeave={() => setHoveredId(null)}
                              className={cn(
                                "rounded-[2px] bg-amber-100 px-0.5 text-slate-900 transition-colors dark:bg-amber-500/25 dark:text-amber-50",
                                isActive && "bg-amber-200 dark:bg-amber-500/45",
                              )}
                            >
                              {segment.text}
                              <sup className="ml-0.5 text-[10px] font-medium text-slate-500">
                                {segment.commentId}
                              </sup>
                            </mark>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-slate-400">
                        No text extracted.
                      </p>
                    )}
                  </div>

                  <div className={cn(previewMode === "pdf" ? "block" : "hidden")}>
                    {pdfData ? (
                      <div ref={pdfContainerRef} className="space-y-4" />
                    ) : (
                      <p className="py-8 text-center text-sm text-slate-400">
                        This resume came from your documents, so there is no PDF to
                        show — read it as text.
                      </p>
                    )}
                  </div>
                </div>
              </Panel>
            </div>
          )}
        </div>
      </Page>
    </SidebarLayout>
  )
}

/** A two-or-three-way switch. Reads as one control, not as buttons. */
function Choice({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded px-2 py-1 text-xs transition-colors disabled:opacity-40",
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
      )}
    >
      {children}
    </button>
  )
}

/** Score as a row: number first, the bar underneath it, the note after. */
function MetricRow({
  label,
  metric,
}: {
  label: string
  metric?: { score: number | null; note: string }
}) {
  const score =
    typeof metric?.score === "number"
      ? Math.max(0, Math.min(100, metric.score))
      : null

  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-slate-600 dark:text-slate-300">
          {label}
        </span>
        <span className="text-[13px] font-medium tabular-nums text-slate-900 dark:text-slate-100">
          {score === null ? "Not scored" : `${score}`}
        </span>
      </div>
      {score !== null && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-900 transition-[width] duration-500 ease-out motion-reduce:transition-none dark:bg-slate-100"
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      {metric?.note && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {metric.note}
        </p>
      )}
    </div>
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

