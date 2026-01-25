import { useAuth, UserButton } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { Download, FileCode, Loader2, Moon, Share2, Sun } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Id } from '../../convex/_generated/dataModel'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/convex'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/editor/$documentId')({
  component: EditorPage,
})

function EditorPage() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Sign in to edit documents.</p>
        </div>
      </Unauthenticated>

      <Authenticated>
        <EditorContent />
      </Authenticated>
    </main>
  )
}

function EditorContent() {
  const { documentId } = Route.useParams()
  const doc = useQuery(api.documents.getMyDocument, {
    documentId: documentId as Id<'documents'>,
  })
  const updateTypstSource = useMutation(api.documents.updateMyTypstSource)

  const [source, setSource] = useState('')
  const [status, setStatus] = useState<string>('')
  const [hasPreview, setHasPreview] = useState(false)
  const hasInitialized = useRef(false)
  const hasAutoRendered = useRef(false)
  const [isDark, setIsDark] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const { isSignedIn } = useAuth()
  const previewRef = useRef<HTMLDivElement | null>(null)
  const statusTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (!doc || hasInitialized.current) return
    setSource(doc.typstSource || '')
    hasInitialized.current = true
  }, [doc])

  useEffect(() => {
    if (typeof document === 'undefined') return
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => {
    return () => {
      if (statusTimeout.current) {
        window.clearTimeout(statusTimeout.current)
      }
    }
  }, [])

  const pushStatus = useCallback((message: string, autoClear = true) => {
    setStatus(message)
    if (statusTimeout.current) {
      window.clearTimeout(statusTimeout.current)
    }
    if (autoClear) {
      statusTimeout.current = window.setTimeout(() => setStatus(''), 2400)
    }
  }, [])

  async function save() {
    if (!doc?._id) return
    setStatus('Saving…')
    try {
      await updateTypstSource({ documentId: doc._id, typstSource: source })
      pushStatus('Saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed.')
    }
  }

  const render = useCallback(async (sourceToRender: string) => {
    if (!doc) return
    const container = previewRef.current
    if (!container) {
      setStatus('Preview not ready.')
      return
    }
    setStatus('Rendering…')
    try {
      const { renderTypstToCanvasInBrowser } = await import(
        '@/lib/typst/renderClient'
      )
      await renderTypstToCanvasInBrowser({
        source: sourceToRender,
        documentType: doc.type,
        templateId: doc.templateId,
        container,
      })
      setHasPreview(true)
      pushStatus('Ready.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Render failed.')
    }
  }, [doc, pushStatus])

  // Auto-render when document first loads
  useEffect(() => {
    if (!doc || !source || hasAutoRendered.current) return
    if (hasInitialized.current) {
      hasAutoRendered.current = true
      render(source)
    }
  }, [doc, source, render])

  const wordCount = useMemo(() => {
    const trimmed = source.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).filter(Boolean).length
  }, [source])

  const templateLabel = useMemo(() => {
    if (!doc?.templateId) return 'Custom'
    return doc.templateId.startsWith('custom:')
      ? 'Custom Template'
      : doc.templateId.replace(/-/g, ' ')
  }, [doc?.templateId])

  const docTypeLabel = useMemo(() => {
    if (!doc?.type) return 'Document'
    return doc.type === 'cover_letter' ? 'Cover Letter' : 'Resume'
  }, [doc?.type])

  const docTypeAccent = useMemo(() => {
    if (doc?.type === 'cover_letter') {
      return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
    }
    return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
  }, [doc?.type])

  const statusTone = useMemo(() => {
    if (!status) return 'bg-emerald-500'
    const lowered = status.toLowerCase()
    if (lowered.includes('fail') || lowered.includes('error')) return 'bg-rose-500'
    if (
      lowered.includes('saving') ||
      lowered.includes('render') ||
      lowered.includes('export') ||
      lowered.includes('share') ||
      lowered.includes('copy')
    ) {
      return 'bg-amber-500'
    }
    return 'bg-emerald-500'
  }, [status])

  const handleShare = useCallback(async () => {
    if (!doc) return
    if (typeof window === 'undefined') return
    const shareUrl = window.location.href
    const shareTitle = doc?.title || docTypeLabel
    setIsSharing(true)
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url: shareUrl })
        pushStatus('Share ready.')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        pushStatus('Link copied.')
        return
      }
      window.prompt('Copy this link:', shareUrl)
      pushStatus('Link ready to copy.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setStatus(error instanceof Error ? error.message : 'Share failed.')
    } finally {
      setIsSharing(false)
    }
  }, [doc, docTypeLabel, pushStatus])

  const handleExportPdf = useCallback(async () => {
    if (!doc) return
    if (typeof document === 'undefined') return
    setIsExporting(true)
    setStatus('Exporting PDF…')
    try {
      const { renderTypstToPdfBytesInBrowser } = await import(
        '@/lib/typst/renderClient'
      )
      const pdfBytes = await renderTypstToPdfBytesInBrowser({
        source,
        documentType: doc.type,
        templateId: doc.templateId,
      })
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const baseName = (doc?.title || docTypeLabel).replace(/[^a-z0-9]+/gi, '-')
      const fileName = `${baseName || 'document'}.pdf`
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      pushStatus('PDF downloaded.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }, [doc, docTypeLabel, pushStatus, source])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      save()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      render(source)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="hidden items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-primary md:flex"
            >
              <span className="material-icons-outlined text-sm">arrow_back</span>
              Dashboard
            </Link>
            <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 md:block" />
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg p-2', docTypeAccent)}>
                <span className="material-icons-outlined text-sm">
                  {doc?.type === 'cover_letter' ? 'mail' : 'description'}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {doc?.title || `${docTypeLabel}`}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span className={cn('rounded-full px-2 py-0.5', docTypeAccent)}>
                    {docTypeLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={cn('h-1.5 w-1.5 rounded-full', statusTone)} />
                    {status || 'Synced'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              disabled={!doc || isSharing}
              className="gap-2"
            >
              {isSharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              Share
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={!doc || isExporting}
              className="gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export PDF
            </Button>
            {isSignedIn && <UserButton afterSignOutUrl="/" />}
          </div>
        </div>
      </header>

      {!doc ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 pb-4 pt-4 sm:px-6 lg:px-8">
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
            {/* Editor Pane */}
            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                <span>Editor</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={save}
                    className="h-8 px-3 text-[10px] font-semibold uppercase tracking-wider"
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => render(source)}
                    className="h-8 px-3 text-[10px] font-semibold uppercase tracking-wider"
                  >
                    Render
                  </Button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                <div className="hidden w-12 shrink-0 flex-col items-end border-r border-dashed border-slate-200 bg-slate-50 py-6 pr-3 text-right font-mono text-[11px] text-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-600 sm:flex">
                  {/* Line numbers placeholder - implementing real dynamic line numbers requires more state management */}
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="leading-7">
                      {i + 1}
                    </div>
                  ))}
                </div>
                <Textarea
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-full min-h-0 flex-1 resize-none border-0 bg-transparent px-6 py-6 font-mono text-[13px] leading-7 text-slate-700 shadow-none focus-visible:ring-0 dark:text-slate-200"
                  spellCheck={false}
                />
              </div>

              {/* Editor Footer */}
              <div className="flex h-10 items-center justify-between border-t border-slate-100 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    Engine: Typst 0.11
                  </span>
                  <span>Ln 24, Col 12</span>
                </div>
                <div>{wordCount} Words</div>
              </div>
            </section>

            {/* Preview Pane */}
            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                <span>Preview</span>
                <span className={cn('rounded-full px-2 py-0.5', docTypeAccent)}>
                  {templateLabel}
                </span>
              </div>
              <div className="custom-scrollbar flex-1 overflow-auto p-8 sm:p-10 flex flex-col items-center">
                <div className="relative w-full max-w-[595px] min-h-[842px]">
                  <div ref={previewRef} className="typst-preview w-full" />
                  {!hasPreview && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-sm border border-dashed border-slate-200 bg-white text-sm text-slate-300 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex flex-col items-center gap-2">
                        <FileCode className="h-8 w-8 opacity-20" />
                        <span>Preview</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Footer */}
              <div className="flex h-10 shrink-0 items-center justify-between border-t border-slate-200 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700">
                <div>UTF-8</div>
                <div className="capitalize">{templateLabel}</div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
