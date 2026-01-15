import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useAction, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/convex'
import {
  OPENROUTER_FREE_MODELS,
  type OpenRouterModelId,
} from '@/lib/openrouterModels'
import {
  COVER_TEMPLATES,
  RESUME_TEMPLATES,
  type CoverTemplateId,
  type ResumeTemplateId,
} from '@/lib/templates'

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
}

type JobDraft = {
  title: string
  company: string
  description: string
  url: string
  source: string
  jobId: string
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

function GeneratePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AuthLoading>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </AuthLoading>

      <Unauthenticated>
        <p>
          You need to <Link to="/sign-in">sign in</Link> to generate documents.
        </p>
      </Unauthenticated>

      <Authenticated>
        <GenerateContent />
      </Authenticated>
    </main>
  )
}

function GenerateContent() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  const profileDoc = useQuery(api.profiles.myProfile, {})
  const settings = useQuery(api.settings.mySettings, {})
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
    }))
  }, [existingJob])

  const defaultsApplied = useRef(false)
  type ResumeTemplateSelection = ResumeTemplateId | 'none'
  type CoverTemplateSelection = CoverTemplateId | 'none'

  const [resumeTemplateId, setResumeTemplateId] = useState<ResumeTemplateSelection>('none')
  const [coverTemplateId, setCoverTemplateId] = useState<CoverTemplateSelection>('none')
  const [model, setModel] = useState<OpenRouterModelId>(OPENROUTER_FREE_MODELS[0].id)
  const [tone, setTone] = useState<string>('professional')
  const [targetLength, setTargetLength] = useState<string>('1_page')
  const [status, setStatus] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!settings || defaultsApplied.current) return
    const savedModel = settings.defaultModel as string
    const isValidModel = OPENROUTER_FREE_MODELS.some((m) => m.id === savedModel)
    setModel(
      isValidModel ? (savedModel as OpenRouterModelId) : OPENROUTER_FREE_MODELS[0].id,
    )
    defaultsApplied.current = true
  }, [settings])

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

    const documentType = hasResume && hasCover ? 'both' : hasResume ? 'resume' : 'cover_letter'
    const resumeTemplateForRequest: ResumeTemplateId =
      resumeTemplateId === 'none'
        ? (settings?.defaultResumeTemplateId as ResumeTemplateId) || 'basic_resume'
        : resumeTemplateId
    const coverTemplateForRequest: CoverTemplateId =
      coverTemplateId === 'none'
        ? (settings?.defaultCoverTemplateId as CoverTemplateId) || 'modern_cv_cover'
        : coverTemplateId

    setIsGenerating(true)
    setStatus('Generating…')
    try {
      const result = await generate({
        job,
        documentType,
        resumeTemplateId: resumeTemplateForRequest,
        coverTemplateId: coverTemplateForRequest,
        model,
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
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Generate</h1>
      {profileDoc === undefined ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : !profile?.personal?.fullName ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Complete Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Add your resume details before generating.</p>
            <Button asChild>
              <Link to="/onboarding">Go to onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="jobTitle">Title</Label>
                <Input
                  id="jobTitle"
                  value={job.title}
                  onChange={(e) =>
                    setJob((j) => ({ ...j, title: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobCompany">Company</Label>
                <Input
                  id="jobCompany"
                  value={job.company}
                  onChange={(e) =>
                    setJob((j) => ({ ...j, company: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobUrl">URL</Label>
                <Input
                  id="jobUrl"
                  value={job.url}
                  onChange={(e) =>
                    setJob((j) => ({ ...j, url: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobDescription">Description</Label>
                <Textarea
                  id="jobDescription"
                  value={job.description}
                  onChange={(e) =>
                    setJob((j) => ({ ...j, description: e.target.value }))
                  }
                  className="min-h-[180px]"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="resumeTemplate">Resume Template</Label>
                  <select
                    id="resumeTemplate"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={resumeTemplateId}
                    onChange={(e) =>
                      setResumeTemplateId(e.target.value as ResumeTemplateSelection)
                    }
                  >
                    <option value="none">None</option>
                    {RESUME_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="coverTemplate">Cover Letter Template</Label>
                  <select
                    id="coverTemplate"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={coverTemplateId}
                    onChange={(e) =>
                      setCoverTemplateId(e.target.value as CoverTemplateSelection)
                    }
                  >
                    <option value="none">None</option>
                    {COVER_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model & Style</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="model">Model (OpenRouter)</Label>
                  <select
                    id="model"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={model}
                    onChange={(e) => setModel(e.target.value as OpenRouterModelId)}
                  >
                    {OPENROUTER_FREE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tone">Tone</Label>
                  <select
                    id="tone"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    <option value="professional">Professional</option>
                    <option value="direct">Direct</option>
                    <option value="confident">Confident</option>
                    <option value="warm">Warm</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="targetLength">Target Length</Label>
                  <select
                    id="targetLength"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={targetLength}
                    onChange={(e) => setTargetLength(e.target.value)}
                  >
                    <option value="1_page">1 page</option>
                    <option value="2_pages">2 pages</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating || (resumeTemplateId === 'none' && coverTemplateId === 'none')}
              >
                {isGenerating ? 'Generating…' : 'Generate'}
              </Button>
              <span className="text-sm text-muted-foreground">{status}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
