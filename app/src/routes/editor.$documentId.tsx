import { useAuth, UserButton } from '@clerk/tanstack-start'
import { createFileRoute } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { ArrowLeft, ArrowRight, Download, Moon, Share2, Sun, FileCode } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Id } from '../../convex/_generated/dataModel'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/convex'

export const Route = createFileRoute('/editor/$documentId')({
  component: EditorPage,
})

function EditorPage() {
  return (
    <main className="min-h-screen bg-white font-sans text-slate-900 dark:bg-[#0b0b0a] dark:text-slate-100">
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
  const { isSignedIn } = useAuth()
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!doc || hasInitialized.current) return
    setSource(doc.typstSource || '')
    hasInitialized.current = true
  }, [doc])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  async function save() {
    if (!doc?._id) return
    setStatus('Saving…')
    try {
      await updateTypstSource({ documentId: doc._id, typstSource: source })
      setStatus('Saved.')
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
      setStatus('Ready.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Render failed.')
    }
  }, [doc])

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
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 bg-white dark:bg-[#0b0b0a] dark:border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
              R
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {doc?.title || 'Untitled Resume'}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
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
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-medium">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
          <Button size="sm" className="gap-2 h-8 bg-slate-900 text-xs font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          {isSignedIn && <UserButton afterSignOutUrl="/" />}
        </div>
      </header>

      {!doc ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Editor Pane */}
          <section className="relative flex w-1/2 flex-col border-r border-slate-100 bg-white dark:bg-[#0b0b0a] dark:border-white/5">
           {/* Editor Toolbar */}
            <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-900/5 dark:bg-black/40 dark:ring-white/10 backdrop-blur-sm">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400">
                    <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400">
                    <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <div className="mx-1 h-3 w-px bg-slate-200 dark:bg-white/10" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => render(source)}
                  className="h-7 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:text-slate-400"
                >
                  Render
                </Button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-12 shrink-0 flex-col items-end border-r border-dashed border-slate-100 bg-white py-24 text-right pr-3 font-mono text-[11px] text-slate-300 dark:border-white/5 dark:bg-transparent dark:text-slate-700 hidden sm:flex">
                     {/* Line numbers placeholder - implementing real dynamic line numbers requires more state management */}
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div key={i} className="leading-7">{i + 1}</div>
                    ))}
                </div>
                <Textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-full min-h-0 flex-1 resize-none border-0 bg-transparent px-8 py-24 font-mono text-[13px] leading-7 text-slate-700 shadow-none focus-visible:ring-0 dark:text-slate-300"
                spellCheck={false}
                />
            </div>

            {/* Editor Footer */}
            <div className="flex h-10 items-center justify-between border-t border-slate-100 px-4 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:border-white/5">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                        Engine: Typst 0.11
                    </span>
                    <span>Ln 24, Col 12</span>
                </div>
                <div>{wordCount} Words</div>
            </div>
          </section>

          {/* Preview Pane */}
          <section className="flex w-1/2 flex-col bg-[#f0f0f2] dark:bg-[#111110]">
            <div className="flex-1 overflow-auto p-12 flex flex-col items-center">
              <div className="relative w-full max-w-[595px] min-h-[842px]">
                <div ref={previewRef} className="typst-preview w-full" />
                {!hasPreview && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-white text-sm text-slate-300">
                    <div className="flex flex-col items-center gap-2">
                      <FileCode className="h-8 w-8 opacity-20" />
                      <span>Preview</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

             {/* Preview Footer */}
             <div className="flex h-10 shrink-0 items-center justify-between border-t border-black/5 px-6 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:border-white/5">
                <div>UTF-8</div>
                <div>{doc?.templateId?.replace(/-/g, ' ') || 'Custom'}</div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
