import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createPortal } from 'react-dom'
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useConvexAuth,
  useQuery,
} from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import SidebarLayout from '@/components/SidebarLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/convex'
import {
  extractCustomTemplateId,
  isCustomTemplateId,
  makeCustomTemplateId,
  withSampleData,
} from '@/lib/customTemplates'
import { renderTypstToCanvasInBrowser } from '@/lib/typst/renderClient'
import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_LABEL,
} from '@/lib/models'
import { useElapsedProgress } from '@/lib/useElapsedProgress'
import {
  COVER_TEMPLATES,
  RESUME_TEMPLATES,
  type CoverTemplateId,
  type ResumeTemplateId,
} from '@/lib/templates'

import basicResumeSource from '../../templates/basic-resume/main.typ?raw'
import simpleTechnicalResumeSource from '../../templates/simple-technical-resume/main.typ?raw'
import modernCvResumeSource from '../../templates/modern-cv/resume.typ?raw'
import neatCvResumeSource from '../../templates/neat-cv/cv.typ?raw'
import metronicResumeSource from '../../templates/metronic/main.typ?raw'
import impressiveImpressionSource from '../../templates/impressive-impression/cv.typ?raw'

import modernCvCoverSource from '../../templates/modern-cv/coverletter.typ?raw'
import modernCvCoverAltSource from '../../templates/modern-cv/coverletter2.typ?raw'
import neatCvLetterSource from '../../templates/neat-cv/letter.typ?raw'

export const Route = createFileRoute('/generate')({
  validateSearch: (search: Record<string, unknown>): GenerateSearch => {
    const parsed: GenerateSearch = {}
    if (typeof search.job === 'string') parsed.job = search.job
    if (typeof search.title === 'string') parsed.title = search.title
    if (typeof search.company === 'string') parsed.company = search.company
    if (typeof search.description === 'string') parsed.description = search.description
    if (typeof search.url === 'string') parsed.url = search.url
    if (typeof search.source === 'string') parsed.source = search.source
    if (typeof search.jobId === 'string') parsed.jobId = search.jobId
    if (typeof search.addedAt === 'number' && Number.isFinite(search.addedAt)) {
      parsed.addedAt = search.addedAt
    } else if (typeof search.addedAt === 'string') {
      const addedAt = Number(search.addedAt)
      if (Number.isFinite(addedAt)) parsed.addedAt = addedAt
    }
    return parsed
  },
  component: GeneratePage,
})

type GenerateSearch = {
  job?: string
  title?: string
  company?: string
  description?: string
  url?: string
  source?: string
  jobId?: string
  addedAt?: number
}

type JobDraft = {
  title: string
  company: string
  description: string
  url: string
  source: string
  jobId: string
  addedAt?: number
}

type ResumeTemplateSelection = ResumeTemplateId | `custom:${string}` | 'none'
type CoverTemplateSelection = CoverTemplateId | `custom:${string}` | 'none'

const RESUME_SOURCES: Record<ResumeTemplateId, string> = {
  basic_resume: basicResumeSource,
  simple_technical_resume: simpleTechnicalResumeSource,
  modern_cv: modernCvResumeSource,
  neat_cv: neatCvResumeSource,
  metronic: metronicResumeSource,
  impressive_impression: impressiveImpressionSource,
}

const COVER_SOURCES: Record<CoverTemplateId, string> = {
  modern_cv_cover: modernCvCoverSource,
  modern_cv_cover_alt: modernCvCoverAltSource,
  neat_cv_letter: neatCvLetterSource,
}

function decodeJobParam(raw: string): Partial<JobDraft> | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const candidates = [trimmed]
  try {
    candidates.push(decodeURIComponent(trimmed))
  } catch {
    // ignore
  }
  for (const candidate of candidates) {
    try {
      if (candidate.startsWith('{')) {
        return JSON.parse(candidate) as Partial<JobDraft>
      }
      const decoded = atob(candidate)
      if (decoded.startsWith('{')) {
        return JSON.parse(decoded) as Partial<JobDraft>
      }
    } catch {
      // ignore
    }
  }
  return null
}

type TemplateOption = { id: string; label: string; kind?: 'custom' | 'builtin' }

type TemplatePickerModalProps = {
  open: boolean
  title: string
  accent: 'indigo' | 'emerald'
  templates: TemplateOption[]
  selectedId: string
  onClose: () => void
  onConfirm: (id: string) => void
  sources: Record<string, string>
  documentType: 'resume' | 'cover_letter'
  allowNone?: boolean
  noneLabel?: string
}

function TemplatePickerModal({
  open,
  title,
  accent,
  templates,
  selectedId,
  onClose,
  onConfirm,
  sources,
  documentType,
  allowNone = false,
  noneLabel = 'None',
}: TemplatePickerModalProps) {
  const canUseDom = typeof document !== 'undefined'
  const [draftId, setDraftId] = useState<string>(selectedId)
  const [status, setStatus] = useState<string>('')
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setDraftId(selectedId)
    setStatus('')
  }, [open, selectedId])

  useEffect(() => {
    if (!open) return
    const container = previewRef.current
    if (!container) return
    container.innerHTML = ''

    if (allowNone && draftId === 'none') {
      setStatus('Select a template to preview.')
      return
    }

    const source = sources[draftId]
    if (!source) {
      setStatus('Preview source unavailable.')
      return
    }

    let cancelled = false
    setStatus('Rendering preview…')

    renderTypstToCanvasInBrowser({
      source,
      documentType,
      templateId: draftId,
      container,
      backgroundColor: accent === 'indigo' ? '#f8fafc' : '#f0fdf4',
    })
      .then(() => {
        if (!cancelled) setStatus('')
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Preview failed.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, draftId, allowNone, documentType, sources, accent])

  if (!open || !canUseDom) return null

  const accentClasses =
    accent === 'indigo'
      ? {
          ring: 'focus:ring-indigo-400/60',
          active: 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10',
          badge: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200',
        }
      : {
          ring: 'focus:ring-emerald-400/60',
          active: 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10',
          badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200',
        }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-md">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accentClasses.badge}`}>
              {documentType === 'resume' ? 'Resume' : 'Cover Letter'}
            </span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <span className="material-icons-outlined text-lg">close</span>
          </button>
        </div>

        <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Choose a template to preview before applying it.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {allowNone && (
                <button
                  type="button"
                  onClick={() => setDraftId('none')}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 ${accentClasses.ring} ${
                    draftId === 'none'
                      ? accentClasses.active
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{noneLabel}</div>
                  <div className="mt-1 text-xs text-slate-500">Do not generate this document</div>
                </button>
              )}
              {templates.map((template) => {
                const active = template.id === draftId
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setDraftId(template.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 ${accentClasses.ring} ${
                      active
                        ? accentClasses.active
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {template.label}
                      </div>
                      {template.kind === 'custom' && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {documentType === 'resume' ? 'Resume template' : 'Cover letter template'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Preview</h4>
              {status && <span className="text-xs text-slate-500">{status}</span>}
            </div>
            <div className="typst-preview h-[550px] w-full overflow-y-auto rounded-xl bg-white shadow-inner scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:bg-slate-950 dark:scrollbar-thumb-slate-700">
              <div ref={previewRef} className="w-full" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {draftId === 'none' ? 'No template selected.' : 'Ready to use this template?'}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm(draftId)
                onClose()
              }}
            >
              Use Template
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function GeneratePage() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <main className="min-h-screen bg-slate-50 py-12 dark:bg-slate-900">
          <div className="mx-auto max-w-md px-4 text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sign in required</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              You need to <Link to="/sign-in" className="font-medium text-primary hover:underline">sign in</Link> to generate documents.
            </p>
          </div>
        </main>
      </Unauthenticated>

      <Authenticated>
        <SidebarLayout>
          <GenerateContent />
        </SidebarLayout>
      </Authenticated>
    </>
  )
}

function GenerateContent() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { isAuthenticated, isLoading } = useConvexAuth()

  const profileDoc = useQuery(api.profiles.myProfile, {})
  const settings = useQuery(api.settings.mySettings, {})
  const canQueryTemplates = isAuthenticated && !isLoading
  const customTemplates = useQuery(
    api.customTemplates.listMyTemplates,
    canQueryTemplates ? {} : undefined,
  )
  const generate = useAction(api.generation.generateDocuments)

  const profile = (profileDoc as any)?.profile

  const importedJob = useMemo(() => {
    const parsed = search.job ? decodeJobParam(search.job) : null
    return {
      title: parsed?.title ?? search.title ?? '',
      company: parsed?.company ?? search.company ?? '',
      description: parsed?.description ?? search.description ?? '',
      url: parsed?.url ?? search.url ?? '',
      source: parsed?.source ?? search.source ?? 'extension',
      jobId: parsed?.jobId ?? search.jobId ?? '',
      addedAt: parsed?.addedAt ?? search.addedAt,
    } satisfies JobDraft
  }, [search])

  const [job, setJob] = useState<JobDraft>(importedJob)
  const existingJob = useQuery(api.jobs.getMyJobByUrl, { url: job.url })

  useEffect(() => {
    setJob(importedJob)
  }, [importedJob])

  useEffect(() => {
    if (!existingJob) return
    setJob((current) => ({
      ...current,
      title: current.title || existingJob.title || '',
      company: current.company || existingJob.company || '',
      description: current.description || existingJob.description || '',
      jobId: current.jobId || existingJob.jobId || '',
      source: current.source || existingJob.source || 'extension',
      addedAt:
        current.addedAt ?? existingJob.addedAt ?? existingJob.createdAt ?? existingJob.lastSeenAt,
    }))
  }, [existingJob])

  const [resumeTemplateId, setResumeTemplateId] = useState<ResumeTemplateSelection>('none')
  const [coverTemplateId, setCoverTemplateId] = useState<CoverTemplateSelection>('none')
  const [resumePickerOpen, setResumePickerOpen] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [tone, setTone] = useState<string>('professional')
  const [targetLength, setTargetLength] = useState<string>('1_page')
  const [status, setStatus] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const progress = useElapsedProgress(isGenerating)

  const customResumeTemplates = useMemo(
    () => (customTemplates ?? []).filter((template: any) => template.type === 'resume'),
    [customTemplates],
  )
  const customCoverTemplates = useMemo(
    () =>
      (customTemplates ?? []).filter((template: any) => template.type === 'cover_letter'),
    [customTemplates],
  )

  const resumeOptions: TemplateOption[] = useMemo(
    () => [
      ...RESUME_TEMPLATES.map((template) => ({
        id: template.id,
        label: template.label,
        kind: 'builtin' as const,
      })),
      ...customResumeTemplates.map((template: any) => ({
        id: makeCustomTemplateId(template._id),
        label: template.name,
        kind: 'custom' as const,
      })),
    ],
    [customResumeTemplates],
  )

  const coverOptions: TemplateOption[] = useMemo(
    () => [
      ...COVER_TEMPLATES.map((template) => ({
        id: template.id,
        label: template.label,
        kind: 'builtin' as const,
      })),
      ...customCoverTemplates.map((template: any) => ({
        id: makeCustomTemplateId(template._id),
        label: template.name,
        kind: 'custom' as const,
      })),
    ],
    [customCoverTemplates],
  )

  const resumeSources = useMemo(() => {
    const sources: Record<string, string> = { ...RESUME_SOURCES }
    customResumeTemplates.forEach((template: any) => {
      sources[makeCustomTemplateId(template._id)] = withSampleData(
        'resume',
        template.source,
      )
    })
    return sources
  }, [customResumeTemplates])

  const coverSources = useMemo(() => {
    const sources: Record<string, string> = { ...COVER_SOURCES }
    customCoverTemplates.forEach((template: any) => {
      sources[makeCustomTemplateId(template._id)] = withSampleData(
        'cover_letter',
        template.source,
      )
    })
    return sources
  }, [customCoverTemplates])

  const resumeLabel =
    resumeTemplateId === 'none'
      ? 'None selected'
      : isCustomTemplateId(resumeTemplateId)
        ? customResumeTemplates.find(
            (template: any) =>
              makeCustomTemplateId(template._id) === resumeTemplateId,
          )?.name || 'Custom template'
        : RESUME_TEMPLATES.find((t) => t.id === resumeTemplateId)?.label ||
          'Select a resume'
  const coverLabel =
    coverTemplateId === 'none'
      ? 'None selected'
      : isCustomTemplateId(coverTemplateId)
        ? customCoverTemplates.find(
            (template: any) =>
              makeCustomTemplateId(template._id) === coverTemplateId,
          )?.name || 'Custom template'
        : COVER_TEMPLATES.find((t) => t.id === coverTemplateId)?.label ||
          'Select a cover letter'

  async function onGenerate() {
    if (!job.url.trim()) {
      setStatus('Job URL is required.')
      return
    }
    if (!profile?.personal?.fullName) {
      setStatus('Complete onboarding first.')
      return
    }

    const hasResume = resumeTemplateId !== 'none'
    const hasCover = coverTemplateId !== 'none'
    if (!hasResume && !hasCover) {
      setStatus('Pick a resume or cover letter template to generate.')
      return
    }

    const resumeIsCustom = isCustomTemplateId(resumeTemplateId)
    const coverIsCustom = isCustomTemplateId(coverTemplateId)
    const customResumeTemplateId = resumeIsCustom
      ? extractCustomTemplateId(resumeTemplateId)
      : undefined
    const customCoverTemplateId = coverIsCustom
      ? extractCustomTemplateId(coverTemplateId)
      : undefined

    const documentType = hasResume && hasCover ? 'both' : hasResume ? 'resume' : 'cover_letter'
    const resumeTemplateForRequest: ResumeTemplateId =
      resumeIsCustom
        ? ((settings?.defaultResumeTemplateId as ResumeTemplateId) || 'basic_resume')
        : resumeTemplateId === 'none'
        ? (settings?.defaultResumeTemplateId as ResumeTemplateId) || 'basic_resume'
        : resumeTemplateId
    const coverTemplateForRequest: CoverTemplateId =
      coverIsCustom
        ? ((settings?.defaultCoverTemplateId as CoverTemplateId) || 'modern_cv_cover')
        : coverTemplateId === 'none'
        ? (settings?.defaultCoverTemplateId as CoverTemplateId) || 'modern_cv_cover'
        : coverTemplateId

    setIsGenerating(true)
    setStatus('')
    try {
      const result = await generate({
        job,
        documentType,
        resumeTemplateId: resumeTemplateForRequest,
        coverTemplateId: coverTemplateForRequest,
        customResumeTemplateId,
        customCoverTemplateId,
        model: DEFAULT_MODEL,
        preferences: { tone, targetLength },
      })
      const nextId = result.resumeId || result.coverId
      if (!nextId) {
        throw new Error('No document was generated.')
      }
      setStatus('Done.')
      navigate({
        to: '/editor/$documentId',
        params: { documentId: nextId },
      })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (

    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Generate Documents</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Create tailored resumes and cover letters for your job applications.
        </p>
      </div>

      {profileDoc === undefined ? (
        <div className="flex justify-center py-12">
           <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile...</p>
        </div>
      ) : !profile?.personal?.fullName ? (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
               <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30">
                 <span className="material-icons-outlined text-lg">error</span>
               </div>
               <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Complete Onboarding</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              You need to complete your profile before you can generate documents.
            </p>
            <Button asChild>
              <Link to="/onboarding">Go to Onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2 text-left">
          {/* Left Column: Job Details */}
          <div className="space-y-6">
             <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                 <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                    <span className="material-icons-outlined text-lg">work</span>
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Job Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job Title</Label>
                  <Input
                    id="jobTitle"
                    value={job.title}
                    onChange={(e) => setJob((j) => ({ ...j, title: e.target.value }))}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobCompany" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</Label>
                  <Input
                    id="jobCompany"
                    value={job.company}
                    onChange={(e) => setJob((j) => ({ ...j, company: e.target.value }))}
                    placeholder="e.g. Acme Corp"
                     className="bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobUrl" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job URL</Label>
                  <Input
                    id="jobUrl"
                    value={job.url}
                    onChange={(e) => setJob((j) => ({ ...j, url: e.target.value }))}
                    placeholder="https://..."
                     className="bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobDescription" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job Description</Label>
                  <Textarea
                    id="jobDescription"
                    value={job.description}
                    onChange={(e) => setJob((j) => ({ ...j, description: e.target.value }))}
                    className="min-h-[200px] bg-white dark:bg-slate-950"
                    placeholder="Paste the job description here..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Configuration */}
          <div className="space-y-6">
            <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                 <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30">
                    <span className="material-icons-outlined text-lg">description</span>
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Templates</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label htmlFor="resumeTemplate" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resume Template</Label>
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{resumeLabel}</p>
                        <p className="text-xs text-slate-500">Click to preview and pick a resume template.</p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200">
                        Resume
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => setResumePickerOpen(true)}>
                        Choose Template
                      </Button>
                      {resumeTemplateId !== 'none' && (
                        <Button type="button" variant="ghost" onClick={() => setResumeTemplateId('none')}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverTemplate" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cover Letter Template</Label>
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{coverLabel}</p>
                        <p className="text-xs text-slate-500">Click to preview and pick a cover letter.</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
                        Cover Letter
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => setCoverPickerOpen(true)}>
                        Choose Template
                      </Button>
                      {coverTemplateId !== 'none' && (
                        <Button type="button" variant="ghost" onClick={() => setCoverTemplateId('none')}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                    <span className="material-icons-outlined text-lg">tune</span>
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Settings</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Model</Label>
                  <p className="flex h-10 w-full items-center rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    {DEFAULT_MODEL_LABEL}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tone" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tone</Label>
                    <select
                      id="tone"
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                    >
                      <option value="professional">Professional</option>
                      <option value="direct">Direct</option>
                      <option value="confident">Confident</option>
                      <option value="warm">Warm</option>
                    </select>
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="targetLength" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Length</Label>
                    <select
                      id="targetLength"
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950"
                      value={targetLength}
                      onChange={(e) => setTargetLength(e.target.value)}
                    >
                      <option value="1_page">1 Page</option>
                      <option value="2_pages">2 Pages</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <TemplatePickerModal
        open={resumePickerOpen}
        title="Choose a resume template"
        accent="indigo"
        templates={resumeOptions}
        selectedId={resumeTemplateId}
        onClose={() => setResumePickerOpen(false)}
        onConfirm={(id) => setResumeTemplateId(id as ResumeTemplateSelection)}
        sources={resumeSources}
        documentType="resume"
        allowNone
        noneLabel="No resume"
      />

      <TemplatePickerModal
        open={coverPickerOpen}
        title="Choose a cover letter template"
        accent="emerald"
        templates={coverOptions}
        selectedId={coverTemplateId}
        onClose={() => setCoverPickerOpen(false)}
        onConfirm={(id) => setCoverTemplateId(id as CoverTemplateSelection)}
        sources={coverSources}
        documentType="cover_letter"
        allowNone
        noneLabel="No cover letter"
      />

      {/* Action Bar */}
      {profile?.personal?.fullName && (
        <div className="sticky bottom-4 z-10 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
                {isGenerating ? (
                  <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                    <span className="material-icons-outlined animate-spin text-base">sync</span>
                    {progress.label}
                    <span className="tabular-nums text-slate-400">{progress.elapsedLabel}</span>
                  </span>
                ) : status ? (
                  <span className={`font-medium ${
                    status.includes('failed') || status.includes('required') ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {status}
                  </span>
                ) : null}
              </div>
              <Button
              size="lg"
              onClick={onGenerate}
              disabled={isGenerating || (resumeTemplateId === 'none' && coverTemplateId === 'none')}
              className="min-w-[140px] shadow-md shadow-primary/20"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin material-icons-outlined mr-2 text-lg">sync</span>
                  Generating...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined mr-2 text-lg">auto_awesome</span>
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
