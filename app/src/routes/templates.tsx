import { X } from 'lucide-react'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { AuthLoading, useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'

import {
  renderTypstToCanvasInBrowser,
} from '@/lib/typst/renderClient'
import { api } from '@/lib/convex'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Page, PageHeader, Panel, PanelHeader } from '@/components/ui/page'
import SidebarLayout from '@/components/SidebarLayout'
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
  // Signed-out visitors get the same frame; the nav simply shows fewer links.
  return (
    <SidebarLayout>
      <AuthLoading>
        <Page>
          <p className="text-sm text-slate-500">Loading…</p>
        </Page>
      </AuthLoading>
      <TemplatesContent />
    </SidebarLayout>
  )
}

function TemplatesContent() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const canQueryTemplates = isAuthenticated && !isLoading
  const customTemplates = useQuery(
    api.customTemplates.listMyTemplates,
    canQueryTemplates ? {} : 'skip',
  )
  const createTemplateFromSource = useMutation(
    api.customTemplates.createTemplateFromSource,
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
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateType, setNewTemplateType] = useState<'resume' | 'cover_letter'>('resume')
  const [newTypstSource, setNewTypstSource] = useState('')
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

  function resetCreateForm() {
    setNewTemplateName('')
    setNewTemplateType('resume')
    setNewTypstSource('')
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

  async function handleCreateTemplate() {
    if (!isAuthenticated) {
      setCreateStatus('Sign in to create templates.')
      return
    }
    if (!newTemplateName.trim()) {
      setCreateStatus('Template name is required.')
      return
    }

    if (!newTypstSource.trim()) {
      setCreateStatus('Paste or upload a Typst template.')
      return
    }

    setIsCreating(true)
    setCreateStatus('Saving template…')
    try {
      await createTemplateFromSource({
        name: newTemplateName.trim(),
        type: newTemplateType,
        source: newTypstSource,
      })
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
    <Page className="max-w-6xl">
      <PageHeader
        title="Templates"
        description="Pick one to see how it renders. Your own Typst templates sit alongside the built-in ones."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!isAuthenticated}
            className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {isAuthenticated ? "Add template" : "Sign in to add"}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TemplateColumn
          title="Resumes"
          status={resumeStatus}
          options={resumeOptions}
          selectedId={selectedResume}
          onSelect={(id) => setSelectedResume(id as ResumeSelection)}
          onDelete={(rawId, label) => handleDeleteTemplate(rawId, label, "resume")}
          previewRef={resumePreviewRef}
        />
        <TemplateColumn
          title="Cover letters"
          status={coverStatus}
          options={coverOptions}
          selectedId={selectedCover}
          onSelect={(id) => setSelectedCover(id as CoverSelection)}
          onDelete={(rawId, label) => handleDeleteTemplate(rawId, label, "cover_letter")}
          previewRef={coverPreviewRef}
        />
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-template-title"
            className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <div>
                <h2
                  id="create-template-title"
                  className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
                >
                  Add a template
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Paste or upload Typst source. It stays editable afterwards.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false)
                  resetCreateForm()
                }}
                aria-label="Close"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="template-name"
                    className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    Name
                  </label>
                  <input
                    id="template-name"
                    value={newTemplateName}
                    onChange={(event) => setNewTemplateName(event.target.value)}
                    placeholder="Minimalist resume"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="template-type"
                    className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    Type
                  </label>
                  <select
                    id="template-type"
                    value={newTemplateType}
                    onChange={(event) =>
                      setNewTemplateType(event.target.value as 'resume' | 'cover_letter')
                    }
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-900 outline-none focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="resume">Resume</option>
                    <option value="cover_letter">Cover letter</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="template-source"
                    className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    Typst source
                  </label>
                  <label className="cursor-pointer rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                    Upload a .typ file
                    <input
                      type="file"
                      accept=".typ,.txt"
                      className="sr-only"
                      onChange={(event) => handleTypstFile(event.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <textarea
                  id="template-source"
                  value={newTypstSource}
                  onChange={(event) => setNewTypstSource(event.target.value)}
                  placeholder="#set page(margin: 36pt)&#10;#resume.header.name"
                  spellCheck={false}
                  className="min-h-[12rem] w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs leading-relaxed text-slate-900 outline-none placeholder:text-slate-300 focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700"
                />
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Resumes read from <code>resume</code>; cover letters read from{' '}
                  <code>cover_letter</code> and <code>sender</code>. Local image
                  assets are not available to custom templates.
                </p>
              </div>

              {createStatus && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{createStatus}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false)
                  resetCreateForm()
                }}
                className="rounded-md px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={isCreating}
                className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {isCreating ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}

/** One column: the list of templates, then the rendered preview under it. */
function TemplateColumn({
  title,
  status,
  options,
  selectedId,
  onSelect,
  onDelete,
  previewRef,
}: {
  title: string
  status?: string
  options: any[]
  selectedId: string
  onSelect: (id: string) => void
  onDelete: (rawId: string, label: string) => void
  previewRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title={title} meta={status || undefined} />

      <ul className="flex flex-wrap gap-1.5 border-b border-slate-200 p-3 dark:border-slate-800">
        {options.map((template: any) => {
          const active = template.id === selectedId
          return (
            <li key={template.id} className="group/tpl relative">
              <button
                type="button"
                onClick={() => onSelect(template.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15',
                  active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100',
                )}
              >
                {template.label}
                {template.kind === 'custom' && (
                  <span className={cn('ml-1.5', active ? 'opacity-60' : 'text-slate-400')}>
                    custom
                  </span>
                )}
              </button>
              {template.kind === 'custom' && template.rawId && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(template.rawId, template.label)
                  }}
                  aria-label={`Delete ${template.label}`}
                  className="absolute -right-1 -top-1 rounded-full border border-slate-200 bg-white p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-slate-900 focus-visible:opacity-100 group-hover/tpl:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:text-slate-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <div className="bg-slate-50 p-4 dark:bg-slate-950">
        <div className="typst-preview min-h-[420px] w-full overflow-hidden">
          <div ref={previewRef} className="w-full" />
        </div>
      </div>
    </Panel>
  )
}
