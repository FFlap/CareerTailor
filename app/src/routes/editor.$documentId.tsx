import { useAuth, UserButton } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from 'convex/react'
import { Download, FileCode, Loader2, Moon, Share2, Sun } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Id } from '../../convex/_generated/dataModel'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/convex'
import { OPENROUTER_FREE_MODELS } from '@/lib/openrouterModels'
import { extractTextFromPdfBytes } from '@/lib/extractText'
import { stripTypst } from '@/lib/typst/stripTypst'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/editor/$documentId')({
  component: EditorPage,
})

type ResumeData = {
  header: {
    name: string
    email: string
    phone: string
    location: string
    links: Array<{ label: string; url: string }>
  }
  summary: string
  skills: Array<{ category: string; items: string[] }>
  experience: Array<{
    title: string
    company: string
    location: string
    startDate: string
    endDate: string
    bullets: string[]
  }>
  projects: Array<{
    name: string
    technologies: string[]
    link: string
    bullets: string[]
  }>
  education: Array<{
    degree: string
    major: string
    institution: string
    location: string
    startDate: string
    endDate: string
  }>
}

type CoverLetterData = {
  greeting: string
  body_paragraphs: string[]
  closing: string
  signature_name: string
}

const EMPTY_RESUME: ResumeData = {
  header: { name: '', email: '', phone: '', location: '', links: [] },
  summary: '',
  skills: [],
  experience: [],
  projects: [],
  education: [],
}

const EMPTY_COVER: CoverLetterData = {
  greeting: '',
  body_paragraphs: [''],
  closing: '',
  signature_name: '',
}

function ensureString(value: unknown) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeResumeData(input: any): ResumeData {
  const raw = input?.resume ?? input ?? {}
  const header = raw.header ?? {}
  const links = Array.isArray(header.links)
    ? header.links
        .map((link: any) => ({
          label: ensureString(link?.label),
          url: ensureString(link?.url),
        }))
        .filter((link: any) => link.label || link.url)
    : []
  const skills = Array.isArray(raw.skills)
    ? raw.skills.map((skill: any) => ({
        category: ensureString(skill?.category),
        items: Array.isArray(skill?.items)
          ? skill.items.map(ensureString).filter(Boolean)
          : [],
      }))
    : []
  const experience = Array.isArray(raw.experience)
    ? raw.experience.map((exp: any) => ({
        title: ensureString(exp?.title),
        company: ensureString(exp?.company),
        location: ensureString(exp?.location),
        startDate: ensureString(exp?.startDate),
        endDate: ensureString(exp?.endDate),
        bullets: Array.isArray(exp?.bullets)
          ? exp.bullets.map(ensureString).filter(Boolean)
          : [],
      }))
    : []
  const projects = Array.isArray(raw.projects)
    ? raw.projects.map((proj: any) => ({
        name: ensureString(proj?.name),
        technologies: Array.isArray(proj?.technologies)
          ? proj.technologies.map(ensureString).filter(Boolean)
          : [],
        link: ensureString(proj?.link),
        bullets: Array.isArray(proj?.bullets)
          ? proj.bullets.map(ensureString).filter(Boolean)
          : [],
      }))
    : []
  const education = Array.isArray(raw.education)
    ? raw.education.map((edu: any) => ({
        degree: ensureString(edu?.degree),
        major: ensureString(edu?.major),
        institution: ensureString(edu?.institution),
        location: ensureString(edu?.location),
        startDate: ensureString(edu?.startDate),
        endDate: ensureString(edu?.endDate),
      }))
    : []

  return {
    header: {
      name: ensureString(header?.name),
      email: ensureString(header?.email),
      phone: ensureString(header?.phone),
      location: ensureString(header?.location),
      links,
    },
    summary: ensureString(raw.summary),
    skills,
    experience,
    projects,
    education,
  }
}

function normalizeCoverLetterData(input: any): CoverLetterData {
  const raw = input?.cover_letter ?? input ?? {}
  const body = Array.isArray(raw.body_paragraphs)
    ? raw.body_paragraphs.map(ensureString).filter(Boolean)
    : []
  return {
    greeting: ensureString(raw.greeting),
    body_paragraphs: body.length ? body : [''],
    closing: ensureString(raw.closing),
    signature_name: ensureString(raw.signature_name),
  }
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

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
  const updateDocumentData = useMutation(api.documents.updateMyDocumentData)
  const parseResumeText = useAction(api.resumeParsing.parseResumeText)
  const parseCoverLetterText = useAction(api.resumeParsing.parseCoverLetterText)

  const [source, setSource] = useState('')
  const [status, setStatus] = useState<string>('')
  const [hasPreview, setHasPreview] = useState(false)
  const hasInitialized = useRef(false)
  const hasAutoRendered = useRef(false)
  const [isDark, setIsDark] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [activeTab, setActiveTab] = useState<'structured' | 'source'>('structured')
  const [structuredData, setStructuredData] = useState<ResumeData | CoverLetterData | null>(null)
  const [structuredStatus, setStructuredStatus] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isApplyingStructured, setIsApplyingStructured] = useState(false)
  const [structuredDirty, setStructuredDirty] = useState(false)
  const [sourceEdited, setSourceEdited] = useState(false)
  const { isSignedIn } = useAuth()
  const previewRef = useRef<HTMLDivElement | null>(null)
  const statusTimeout = useRef<number | null>(null)
  const autoApplyTimeout = useRef<number | null>(null)
  const structuredJsonRef = useRef<string>('')
  const lastDocIdRef = useRef<string | null>(null)
  const defaultModel = OPENROUTER_FREE_MODELS[0]?.id ?? 'xiaomi/mimo-v2-flash:free'

  useEffect(() => {
    if (!doc || hasInitialized.current) return
    setSource(doc.typstSource || '')
    hasInitialized.current = true
  }, [doc])

  useEffect(() => {
    if (!doc) return
    const normalized =
      doc.type === 'resume'
        ? normalizeResumeData(doc.data)
        : normalizeCoverLetterData(doc.data)
    const normalizedJson = JSON.stringify(normalized)
    const docChanged = doc._id !== lastDocIdRef.current
    if (docChanged || !structuredData) {
      setStructuredData(normalized)
      setStructuredDirty(false)
      setSourceEdited(false)
      structuredJsonRef.current = normalizedJson
      lastDocIdRef.current = doc._id
      return
    }
    if (normalizedJson === structuredJsonRef.current) return
    if (structuredDirty || isParsing || isApplyingStructured) return
    if (activeTab === 'structured') return
    setStructuredData(normalized)
    setStructuredDirty(false)
    setSourceEdited(false)
  }, [doc?._id, doc?.type, doc?.data])

  useEffect(() => {
    structuredJsonRef.current = JSON.stringify(structuredData ?? null)
  }, [structuredData])

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
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current)
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

  const markStructuredDirty = () => {
    setStructuredDirty(true)
  }

  const updateResumeHeader = (field: keyof ResumeData['header'], value: string) => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      return {
        ...resume,
        header: {
          ...resume.header,
          [field]: value,
        },
      }
    })
    markStructuredDirty()
  }

  const updateResumeSummary = (value: string) => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      return { ...resume, summary: value }
    })
    markStructuredDirty()
  }

  const updateResumeSectionItem = (
    section: 'skills' | 'experience' | 'projects' | 'education',
    index: number,
    field: string,
    value: string | string[],
  ) => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      const list = [...(resume[section] as any[])]
      if (!list[index]) return prev
      list[index] = { ...list[index], [field]: value }
      return { ...resume, [section]: list }
    })
    markStructuredDirty()
  }

  const updateResumeLinks = (index: number, field: 'label' | 'url', value: string) => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      const links = [...resume.header.links]
      links[index] = { ...links[index], [field]: value }
      return { ...resume, header: { ...resume.header, links } }
    })
    markStructuredDirty()
  }

  const addResumeLink = () => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      return {
        ...resume,
        header: {
          ...resume.header,
          links: [...resume.header.links, { label: '', url: '' }],
        },
      }
    })
    markStructuredDirty()
  }

  const removeResumeLink = (index: number) => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      const links = resume.header.links.filter((_, idx) => idx !== index)
      return { ...resume, header: { ...resume.header, links } }
    })
    markStructuredDirty()
  }

  const addResumeSectionItem = (section: 'skills' | 'experience' | 'projects' | 'education') => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      const list = [...(resume[section] as any[])]
      if (section === 'skills') {
        list.push({ category: '', items: [] })
      } else if (section === 'experience') {
        list.push({ title: '', company: '', location: '', startDate: '', endDate: '', bullets: [] })
      } else if (section === 'projects') {
        list.push({ name: '', technologies: [], link: '', bullets: [] })
      } else {
        list.push({ degree: '', major: '', institution: '', location: '', startDate: '', endDate: '' })
      }
      return { ...resume, [section]: list }
    })
    markStructuredDirty()
  }

  const removeResumeSectionItem = (section: 'skills' | 'experience' | 'projects' | 'education', index: number) => {
    if (!doc || doc.type !== 'resume') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'resume') return prev
      const resume = prev as ResumeData
      const list = (resume[section] as any[]).filter((_, idx) => idx !== index)
      return { ...resume, [section]: list }
    })
    markStructuredDirty()
  }

  const updateCoverLetterField = (field: keyof CoverLetterData, value: string | string[]) => {
    if (!doc || doc.type !== 'cover_letter') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'cover_letter') return prev
      const cover = prev as CoverLetterData
      return { ...cover, [field]: value }
    })
    markStructuredDirty()
  }

  const addCoverParagraph = () => {
    if (!doc || doc.type !== 'cover_letter') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'cover_letter') return prev
      const cover = prev as CoverLetterData
      return { ...cover, body_paragraphs: [...cover.body_paragraphs, ''] }
    })
    markStructuredDirty()
  }

  const removeCoverParagraph = (index: number) => {
    if (!doc || doc.type !== 'cover_letter') return
    setStructuredData((prev) => {
      if (!prev || doc.type !== 'cover_letter') return prev
      const cover = prev as CoverLetterData
      const paragraphs = cover.body_paragraphs.filter((_, idx) => idx !== index)
      return { ...cover, body_paragraphs: paragraphs.length ? paragraphs : [''] }
    })
    markStructuredDirty()
  }

  const handleExtractStructured = useCallback(async () => {
    if (!doc) return
    setStructuredStatus('')
    setIsParsing(true)
    try {
      let text = ''
      try {
        const { renderTypstToPdfBytesInBrowser } = await import('@/lib/typst/renderClient')
        const pdfBytes = await renderTypstToPdfBytesInBrowser({
          source: source || doc.typstSource || '',
          documentType: doc.type,
          templateId: doc.templateId,
        })
        text = await extractTextFromPdfBytes(pdfBytes)
      } catch {
        text = stripTypst(source || doc.typstSource || '')
      }
      if (!text || text.trim().length < 20) {
        const fallback = stripTypst(source || doc.typstSource || '')
        text = fallback
      }
      if (!text || !text.trim()) {
        setStructuredStatus('No text available to extract.')
        return
      }
      if (doc.type === 'resume') {
        const parsed = await parseResumeText({ resumeText: text, model: defaultModel })
        const normalized = normalizeResumeData((parsed as any)?.resume ?? parsed)
        setStructuredData(normalized)
      } else {
        const parsed = await parseCoverLetterText({ coverLetterText: text, model: defaultModel })
        const normalized = normalizeCoverLetterData((parsed as any)?.cover_letter ?? parsed)
        setStructuredData(normalized)
      }
      setStructuredDirty(false)
      setSourceEdited(false)
      setStructuredStatus('Extracted from source. Review and apply changes.')
    } catch (error) {
      setStructuredStatus(error instanceof Error ? error.message : 'Extraction failed.')
    } finally {
      setIsParsing(false)
    }
  }, [doc, parseResumeText, parseCoverLetterText, source, defaultModel])

  const applyStructuredChanges = useCallback(async (auto = false) => {
    if (!doc || !structuredData) return
    setIsApplyingStructured(true)
    setStructuredStatus('')
    try {
      const result = await updateDocumentData({
        documentId: doc._id,
        data: structuredData,
      })
      if (result?.typstSource) {
        setSource(result.typstSource)
        setHasPreview(false)
        await render(result.typstSource)
      }
      setStructuredDirty(false)
      setSourceEdited(false)
      if (!auto) {
        pushStatus('Structured updates applied.')
      }
    } catch (error) {
      setStructuredStatus(error instanceof Error ? error.message : 'Failed to apply updates.')
    } finally {
      setIsApplyingStructured(false)
    }
  }, [doc, structuredData, updateDocumentData, render, pushStatus])

  useEffect(() => {
    if (!doc || !structuredData) return
    if (!structuredDirty) return
    if (sourceEdited) return
    if (activeTab !== 'structured') return
    if (isParsing || isApplyingStructured) return

    if (autoApplyTimeout.current) {
      window.clearTimeout(autoApplyTimeout.current)
    }
    autoApplyTimeout.current = window.setTimeout(() => {
      void applyStructuredChanges(true)
    }, 700)

    return () => {
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current)
      }
    }
  }, [
    structuredDirty,
    structuredData,
    sourceEdited,
    activeTab,
    isParsing,
    isApplyingStructured,
    doc,
    applyStructuredChanges,
  ])

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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('structured')}
                    className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition',
                      activeTab === 'structured'
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                    )}
                  >
                    Structured
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('source')}
                    className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition',
                      activeTab === 'source'
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                    )}
                  >
                    Source
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeTab === 'structured' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExtractStructured}
                        disabled={isParsing}
                        className="h-8 px-3 text-[10px] font-semibold uppercase tracking-wider"
                      >
                        {isParsing ? 'Extracting…' : 'Extract with AI'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={applyStructuredChanges}
                        disabled={isApplyingStructured || !structuredData}
                        className="h-8 px-3 text-[10px] font-semibold uppercase tracking-wider"
                      >
                        {isApplyingStructured ? 'Applying…' : 'Apply changes'}
                      </Button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {activeTab === 'source' ? (
                <div className="flex flex-1 overflow-hidden">
                  <div className="hidden w-12 shrink-0 flex-col items-end border-r border-dashed border-slate-200 bg-slate-50 py-6 pr-3 text-right font-mono text-[11px] text-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-600 sm:flex">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div key={i} className="leading-7">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                <Textarea
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value)
                    setSourceEdited(true)
                  }}
                  onKeyDown={handleKeyDown}
                  className="h-full min-h-0 flex-1 resize-none border-0 bg-transparent px-6 py-6 font-mono text-[13px] leading-7 text-slate-700 shadow-none focus-visible:ring-0 dark:text-slate-200"
                  spellCheck={false}
                />
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  {(sourceEdited || structuredStatus) && (
                    <div className="mb-4 space-y-3">
                      {sourceEdited && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">Source edited directly</p>
                              <p className="mt-1 text-[11px] opacity-80">
                                Structured data may be out of sync. Auto‑sync is paused.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleExtractStructured}
                                disabled={isParsing}
                              >
                                Sync from source
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => applyStructuredChanges(false)}
                                disabled={isApplyingStructured}
                              >
                                Overwrite source
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {structuredStatus && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                          {structuredStatus}
                        </div>
                      )}
                    </div>
                  )}
                  {doc?.type === 'resume' ? (
                    (() => {
                      const resume = (structuredData ?? EMPTY_RESUME) as ResumeData
                      return (
                        <div className="space-y-6">
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Header</h3>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="resume-name">Name</Label>
                                <Input
                                  id="resume-name"
                                  value={resume.header.name}
                                  onChange={(event) => updateResumeHeader('name', event.target.value)}
                                  placeholder="Full name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="resume-email">Email</Label>
                                <Input
                                  id="resume-email"
                                  value={resume.header.email}
                                  onChange={(event) => updateResumeHeader('email', event.target.value)}
                                  placeholder="email@domain.com"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="resume-phone">Phone</Label>
                                <Input
                                  id="resume-phone"
                                  value={resume.header.phone}
                                  onChange={(event) => updateResumeHeader('phone', event.target.value)}
                                  placeholder="(555) 123-4567"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="resume-location">Location</Label>
                                <Input
                                  id="resume-location"
                                  value={resume.header.location}
                                  onChange={(event) => updateResumeHeader('location', event.target.value)}
                                  placeholder="City, State"
                                />
                              </div>
                            </div>

                            <div className="mt-5 space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Links</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={addResumeLink}
                                >
                                  Add link
                                </Button>
                              </div>
                              {resume.header.links.length === 0 ? (
                                <p className="text-xs text-slate-500">No links yet.</p>
                              ) : (
                                resume.header.links.map((link, index) => (
                                  <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                                    <Input
                                      value={link.label}
                                      onChange={(event) =>
                                        updateResumeLinks(index, 'label', event.target.value)
                                      }
                                      placeholder="Label (LinkedIn)"
                                    />
                                    <Input
                                      value={link.url}
                                      onChange={(event) =>
                                        updateResumeLinks(index, 'url', event.target.value)
                                      }
                                      placeholder="https://..."
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeResumeLink(index)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Summary</h3>
                            <Textarea
                              value={resume.summary}
                              onChange={(event) => updateResumeSummary(event.target.value)}
                              className="mt-3 min-h-[110px]"
                              placeholder="Summarize your impact in 2-3 sentences."
                            />
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Skills</h3>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => addResumeSectionItem('skills')}
                              >
                                Add skill group
                              </Button>
                            </div>
                            <div className="mt-4 space-y-4">
                              {resume.skills.length === 0 ? (
                                <p className="text-xs text-slate-500">No skill groups yet.</p>
                              ) : (
                                resume.skills.map((skill, index) => (
                                  <div key={index} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                      <Label>Category</Label>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeResumeSectionItem('skills', index)}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                    <Input
                                      value={skill.category}
                                      onChange={(event) =>
                                        updateResumeSectionItem('skills', index, 'category', event.target.value)
                                      }
                                      className="mt-2"
                                      placeholder="Programming Languages"
                                    />
                                    <Label className="mt-3 block">Items</Label>
                                    <Input
                                      value={skill.items.join(', ')}
                                      onChange={(event) =>
                                        updateResumeSectionItem(
                                          'skills',
                                          index,
                                          'items',
                                          event.target.value
                                            .split(',')
                                            .map((item) => item.trim())
                                            .filter(Boolean),
                                        )
                                      }
                                      className="mt-2"
                                      placeholder="JavaScript, TypeScript, Python"
                                    />
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Experience</h3>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => addResumeSectionItem('experience')}
                              >
                                Add experience
                              </Button>
                            </div>
                            <div className="mt-4 space-y-4">
                              {resume.experience.length === 0 ? (
                                <p className="text-xs text-slate-500">No experience entries yet.</p>
                              ) : (
                                resume.experience.map((exp, index) => (
                                  <div key={index} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Role</h4>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeResumeSectionItem('experience', index)}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                          value={exp.title}
                                          onChange={(event) =>
                                            updateResumeSectionItem('experience', index, 'title', event.target.value)
                                          }
                                          placeholder="Senior Engineer"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Company</Label>
                                        <Input
                                          value={exp.company}
                                          onChange={(event) =>
                                            updateResumeSectionItem('experience', index, 'company', event.target.value)
                                          }
                                          placeholder="Company"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Location</Label>
                                        <Input
                                          value={exp.location}
                                          onChange={(event) =>
                                            updateResumeSectionItem('experience', index, 'location', event.target.value)
                                          }
                                          placeholder="City, State"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Dates</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                          <Input
                                            value={exp.startDate}
                                            onChange={(event) =>
                                              updateResumeSectionItem('experience', index, 'startDate', event.target.value)
                                            }
                                            placeholder="Jan 2022"
                                          />
                                          <Input
                                            value={exp.endDate}
                                            onChange={(event) =>
                                              updateResumeSectionItem('experience', index, 'endDate', event.target.value)
                                            }
                                            placeholder="Present"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      <Label>Bullets</Label>
                                      <Textarea
                                        value={(exp.bullets || []).join('\n')}
                                        onChange={(event) =>
                                          updateResumeSectionItem('experience', index, 'bullets', splitLines(event.target.value))
                                        }
                                        rows={4}
                                        placeholder="One achievement per line"
                                      />
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Projects</h3>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => addResumeSectionItem('projects')}
                              >
                                Add project
                              </Button>
                            </div>
                            <div className="mt-4 space-y-4">
                              {resume.projects.length === 0 ? (
                                <p className="text-xs text-slate-500">No projects yet.</p>
                              ) : (
                                resume.projects.map((project, index) => (
                                  <div key={index} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project</h4>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeResumeSectionItem('projects', index)}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input
                                          value={project.name}
                                          onChange={(event) =>
                                            updateResumeSectionItem('projects', index, 'name', event.target.value)
                                          }
                                          placeholder="Project name"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Link</Label>
                                        <Input
                                          value={project.link}
                                          onChange={(event) =>
                                            updateResumeSectionItem('projects', index, 'link', event.target.value)
                                          }
                                          placeholder="https://..."
                                        />
                                      </div>
                                      <div className="space-y-2 sm:col-span-2">
                                        <Label>Technologies</Label>
                                        <Input
                                          value={project.technologies.join(', ')}
                                          onChange={(event) =>
                                            updateResumeSectionItem(
                                              'projects',
                                              index,
                                              'technologies',
                                              event.target.value
                                                .split(',')
                                                .map((item) => item.trim())
                                                .filter(Boolean),
                                            )
                                          }
                                          placeholder="React, Node.js"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      <Label>Bullets</Label>
                                      <Textarea
                                        value={(project.bullets || []).join('\n')}
                                        onChange={(event) =>
                                          updateResumeSectionItem('projects', index, 'bullets', splitLines(event.target.value))
                                        }
                                        rows={4}
                                        placeholder="One achievement per line"
                                      />
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Education</h3>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => addResumeSectionItem('education')}
                              >
                                Add education
                              </Button>
                            </div>
                            <div className="mt-4 space-y-4">
                              {resume.education.length === 0 ? (
                                <p className="text-xs text-slate-500">No education entries yet.</p>
                              ) : (
                                resume.education.map((edu, index) => (
                                  <div key={index} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Education</h4>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeResumeSectionItem('education', index)}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Degree</Label>
                                        <Input
                                          value={edu.degree}
                                          onChange={(event) =>
                                            updateResumeSectionItem('education', index, 'degree', event.target.value)
                                          }
                                          placeholder="B.S."
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Major</Label>
                                        <Input
                                          value={edu.major}
                                          onChange={(event) =>
                                            updateResumeSectionItem('education', index, 'major', event.target.value)
                                          }
                                          placeholder="Computer Science"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Institution</Label>
                                        <Input
                                          value={edu.institution}
                                          onChange={(event) =>
                                            updateResumeSectionItem('education', index, 'institution', event.target.value)
                                          }
                                          placeholder="University"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Location</Label>
                                        <Input
                                          value={edu.location}
                                          onChange={(event) =>
                                            updateResumeSectionItem('education', index, 'location', event.target.value)
                                          }
                                          placeholder="City, State"
                                        />
                                      </div>
                                      <div className="space-y-2 sm:col-span-2">
                                        <Label>Dates</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                          <Input
                                            value={edu.startDate}
                                            onChange={(event) =>
                                              updateResumeSectionItem('education', index, 'startDate', event.target.value)
                                            }
                                            placeholder="Aug 2019"
                                          />
                                          <Input
                                            value={edu.endDate}
                                            onChange={(event) =>
                                              updateResumeSectionItem('education', index, 'endDate', event.target.value)
                                            }
                                            placeholder="May 2023"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    (() => {
                      const cover = (structuredData ?? EMPTY_COVER) as CoverLetterData
                      return (
                        <div className="space-y-6">
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Greeting</h3>
                            <Input
                              value={cover.greeting}
                              onChange={(event) => updateCoverLetterField('greeting', event.target.value)}
                              className="mt-3"
                              placeholder="Dear Hiring Manager,"
                            />
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Body paragraphs</h3>
                              <Button type="button" variant="ghost" size="sm" onClick={addCoverParagraph}>
                                Add paragraph
                              </Button>
                            </div>
                            <div className="mt-4 space-y-3">
                              {cover.body_paragraphs.map((paragraph, index) => (
                                <div key={index} className="space-y-2">
                                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <span>Paragraph {index + 1}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeCoverParagraph(index)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={paragraph}
                                    onChange={(event) => {
                                      const next = [...cover.body_paragraphs]
                                      next[index] = event.target.value
                                      updateCoverLetterField('body_paragraphs', next)
                                    }}
                                    rows={4}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Closing</h3>
                            <Input
                              value={cover.closing}
                              onChange={(event) => updateCoverLetterField('closing', event.target.value)}
                              className="mt-3"
                              placeholder="Sincerely,"
                            />
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Signature name</h3>
                            <Input
                              value={cover.signature_name}
                              onChange={(event) => updateCoverLetterField('signature_name', event.target.value)}
                              className="mt-3"
                              placeholder="Your name"
                            />
                          </div>
                        </div>
                      )
                    })()
                  )}
                </div>
              )}

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
