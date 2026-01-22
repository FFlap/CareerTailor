import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { AuthLoading, useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'

import {
  renderTypstToCanvasInBrowser,
} from '@/lib/typst/renderClient'
import { api } from '@/lib/convex'
import { Button } from '@/components/ui/button'
import { makeCustomTemplateId, withSampleData } from '@/lib/customTemplates'
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

export const Route = createFileRoute('/templates')({
  component: TemplatesPage,
})

type ResumeSelection = ResumeTemplateId | `custom:${string}`
type CoverSelection = CoverTemplateId | `custom:${string}`

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

function TemplatesPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AuthLoading>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </AuthLoading>
      <TemplatesContent />
    </main>
  )
}

function TemplatesContent() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const customTemplates = useQuery(
    api.customTemplates.listMyTemplates,
    isAuthenticated && !isLoading ? {} : 'skip',
  )
  const createTemplateFromSource = useMutation(
    api.customTemplates.createTemplateFromSource,
  )
  const createTemplateFromImage = useAction(
    api.customTemplates.createTemplateFromImage,
  )
  const deleteTemplate = useMutation(api.customTemplates.deleteTemplate)

  const [selectedResume, setSelectedResume] = useState<ResumeSelection>(
    RESUME_TEMPLATES[0].id,
  )
  const [selectedCover, setSelectedCover] = useState<CoverSelection>(
    COVER_TEMPLATES[0].id,
  )
  const [resumeStatus, setResumeStatus] = useState<string>('')
  const [coverStatus, setCoverStatus] = useState<string>('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'typst' | 'image'>('typst')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateType, setNewTemplateType] = useState<'resume' | 'cover_letter'>('resume')
  const [newTypstSource, setNewTypstSource] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [createStatus, setCreateStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const resumePreviewRef = useRef<HTMLDivElement | null>(null)
  const coverPreviewRef = useRef<HTMLDivElement | null>(null)

  const customResumeTemplates = useMemo(
    () => (customTemplates ?? []).filter((template: any) => template.type === 'resume'),
    [customTemplates],
  )
  const customCoverTemplates = useMemo(
    () =>
      (customTemplates ?? []).filter((template: any) => template.type === 'cover_letter'),
    [customTemplates],
  )

  const resumeOptions = useMemo(
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
        rawId: template._id as string,
      })),
    ],
    [customResumeTemplates],
  )
  const coverOptions = useMemo(
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
        rawId: template._id as string,
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

  useEffect(() => {
    let cancelled = false
    const container = resumePreviewRef.current
    if (!container) return
    container.innerHTML = ''
    const source = resumeSources[selectedResume]
    if (!source) {
      setResumeStatus('Template unavailable.')
      return
    }
    setResumeStatus('Rendering preview…')

    renderTypstToCanvasInBrowser({
      source,
      documentType: 'resume',
      templateId: selectedResume,
      container,
      backgroundColor: '#f8fafc',
    })
      .then(() => {
        if (!cancelled) setResumeStatus('')
      })
      .catch((error) => {
        if (!cancelled) {
          setResumeStatus(error instanceof Error ? error.message : 'Preview failed.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedResume, resumeSources])

  useEffect(() => {
    let cancelled = false
    const container = coverPreviewRef.current
    if (!container) return
    container.innerHTML = ''
    const source = coverSources[selectedCover]
    if (!source) {
      setCoverStatus('Template unavailable.')
      return
    }
    setCoverStatus('Rendering preview…')

    renderTypstToCanvasInBrowser({
      source,
      documentType: 'cover_letter',
      templateId: selectedCover,
      container,
      backgroundColor: '#f0fdf4',
    })
      .then(() => {
        if (!cancelled) setCoverStatus('')
      })
      .catch((error) => {
        if (!cancelled) {
          setCoverStatus(error instanceof Error ? error.message : 'Preview failed.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedCover, coverSources])

  // Prevent rendering while auth is loading to avoid race condition
  if (isLoading) {
    return null
  }

  function resetCreateForm() {
    setNewTemplateName('')
    setNewTemplateType('resume')
    setNewTypstSource('')
    setImageDataUrl(null)
    setCreateMode('typst')
    setCreateStatus('')
  }

  function handleTypstFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setNewTypstSource(text)
    }
    reader.readAsText(file)
  }

  function handleImageFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      setImageDataUrl(url || null)
    }
    reader.readAsDataURL(file)
  }

  function handlePasteImage(event: ClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          event.preventDefault()
          handleImageFile(file)
        }
        break
      }
    }
  }

  async function handleCreateTemplate() {
    if (!isAuthenticated) {
      setCreateStatus('Sign in to create templates.')
      return
    }
    if (!newTemplateName.trim()) {
      setCreateStatus('Template name is required.')
      return
    }

    setIsCreating(true)
    setCreateStatus('Saving template…')
    try {
      if (createMode === 'typst') {
        if (!newTypstSource.trim()) {
          setCreateStatus('Paste or upload a Typst template.')
          return
        }
        await createTemplateFromSource({
          name: newTemplateName.trim(),
          type: newTemplateType,
          source: newTypstSource,
          origin: 'typst',
        })
      } else {
        if (!imageDataUrl) {
          setCreateStatus('Paste or upload an image.')
          return
        }
        await createTemplateFromImage({
          name: newTemplateName.trim(),
          type: newTemplateType,
          imageDataUrl,
        })
      }
      setCreateStatus('Template saved.')
      resetCreateForm()
      setCreateOpen(false)
    } catch (error) {
      setCreateStatus(error instanceof Error ? error.message : 'Failed to save template.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteTemplate(
    templateId: string,
    name: string,
    type: 'resume' | 'cover_letter',
  ) {
    if (!confirm(`Delete \"${name}\"? This cannot be undone.`)) return
    try {
      await deleteTemplate({ templateId: templateId as any })
      const customId = makeCustomTemplateId(templateId)
      if (type === 'resume' && selectedResume === customId) {
        setSelectedResume(RESUME_TEMPLATES[0].id)
      }
      if (type === 'cover_letter' && selectedCover === customId) {
        setSelectedCover(COVER_TEMPLATES[0].id)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              Templates Gallery
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Browse resume + cover letter templates</h1>
            <p className="max-w-2xl text-base text-slate-600 dark:text-slate-400">
              Click a template to preview how it renders. Resume templates sit on the left, cover letters on
              the right.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!isAuthenticated}
            className="self-start"
          >
            {isAuthenticated ? 'Add Template' : 'Sign in to add templates'}
          </Button>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-6 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm dark:border-indigo-900/40 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Resume templates</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Pick a resume layout to preview.</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                Resume
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {resumeOptions.map((template: any) => {
                const active = template.id === selectedResume
                return (
                  <div key={template.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedResume(template.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400/60 ${
                        active
                          ? 'border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-500/50 dark:bg-indigo-500/10'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950'
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
                      <div className="mt-1 text-xs text-slate-500">Resume template</div>
                    </button>
                    {template.kind === 'custom' && template.rawId && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeleteTemplate(template.rawId, template.label, 'resume')
                        }}
                        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-white/80 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900"
                        aria-label="Delete template"
                      >
                        <span className="material-icons-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-200">Preview</h3>
                {resumeStatus && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">{resumeStatus}</span>
                )}
              </div>
              <div className="typst-preview min-h-[520px] w-full overflow-hidden rounded-xl bg-slate-50 shadow-inner dark:bg-slate-950">
                <div ref={resumePreviewRef} className="w-full" />
              </div>
            </div>
          </section>

          <section className="space-y-6 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cover letter templates</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Preview a cover letter format.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                Cover Letter
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {coverOptions.map((template: any) => {
                const active = template.id === selectedCover
                return (
                  <div key={template.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedCover(template.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/60 ${
                        active
                          ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-500/50 dark:bg-emerald-500/10'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950'
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
                      <div className="mt-1 text-xs text-slate-500">Cover letter template</div>
                    </button>
                    {template.kind === 'custom' && template.rawId && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeleteTemplate(template.rawId, template.label, 'cover_letter')
                        }}
                        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-white/80 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900"
                        aria-label="Delete template"
                      >
                        <span className="material-icons-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">Preview</h3>
                {coverStatus && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">{coverStatus}</span>
                )}
              </div>
              <div className="typst-preview min-h-[520px] w-full overflow-hidden rounded-xl bg-emerald-50 shadow-inner dark:bg-slate-950">
                <div ref={coverPreviewRef} className="w-full" />
              </div>
            </div>
          </section>
        </div>

        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Create a template</h3>
                  <p className="text-xs text-slate-500">Upload Typst or generate from an image.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false)
                    resetCreateForm()
                  }}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <span className="material-icons-outlined text-lg">close</span>
                </button>
              </div>

              <div className="grid gap-6 p-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Template name</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                      value={newTemplateName}
                      onChange={(event) => setNewTemplateName(event.target.value)}
                      placeholder="e.g. Minimalist Resume"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Template type</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                      value={newTemplateType}
                      onChange={(event) =>
                        setNewTemplateType(event.target.value as 'resume' | 'cover_letter')
                      }
                    >
                      <option value="resume">Resume</option>
                      <option value="cover_letter">Cover Letter</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Source</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateMode('typst')}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                          createMode === 'typst'
                            ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                        }`}
                      >
                        Typst file
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateMode('image')}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                          createMode === 'image'
                            ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                        }`}
                      >
                        Paste image
                      </button>
                    </div>
                  </div>

                  {createMode === 'typst' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Upload a .typ file</span>
                        <label className="cursor-pointer text-indigo-600 hover:underline">
                          Browse
                          <input
                            type="file"
                            accept=".typ,.txt"
                            className="hidden"
                            onChange={(event) => handleTypstFile(event.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                      <textarea
                        className="min-h-[180px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-950"
                        value={newTypstSource}
                        onChange={(event) => setNewTypstSource(event.target.value)}
                        placeholder="Paste your Typst template here..."
                      />
                      <p className="text-[11px] text-slate-500">
                        Tip: Custom templates can reference the `resume` or `cover_letter` data objects.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div
                        className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                        onPaste={handlePasteImage}
                        tabIndex={0}
                      >
                        {imageDataUrl ? (
                          <img
                            src={imageDataUrl}
                            alt="Template preview"
                            className="max-h-[200px] rounded-lg object-contain"
                          />
                        ) : (
                          <>
                            <span className="material-icons-outlined text-3xl text-slate-400">
                              add_photo_alternate
                            </span>
                            <p className="mt-2">Paste an image or upload a screenshot.</p>
                          </>
                        )}
                      </div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Upload image
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleImageFile(event.target.files?.[0] || null)}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
                      />
                      <p className="text-[11px] text-slate-500">
                        The model will generate a Typst layout from the image.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">How custom templates work</h4>
                  <ul className="space-y-2 text-xs leading-relaxed">
                    <li>Use `resume` data for resumes and `cover_letter` + `sender` for cover letters.</li>
                    <li>Templates should avoid local image assets for now.</li>
                    <li>Generated templates are editable in the Typst editor after creation.</li>
                  </ul>
                  {createStatus && (
                    <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {createStatus}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => {
                      setCreateOpen(false)
                      resetCreateForm()
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTemplate} disabled={isCreating}>
                      {isCreating ? 'Saving…' : 'Save Template'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
