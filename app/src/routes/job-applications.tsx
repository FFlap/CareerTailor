import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { api } from '@/lib/convex'
import type { Id } from '../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'
import SidebarLayout from '@/components/SidebarLayout'
import { EmptyState, Page, PageHeader, Panel, Row } from '@/components/ui/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type JobStatus = 'viewed' | 'applied' | 'interview' | 'accepted' | 'ghosted'

type JobStatusFilter = JobStatus | 'all'

const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'viewed', label: 'Viewed' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'ghosted', label: 'Ghosted' },
]

/** Status reads as a dot beside the row, not as a coloured pill. */
const STATUS_DOT: Record<JobStatus, string> = {
  viewed: 'bg-slate-300 dark:bg-slate-600',
  applied: 'bg-slate-500',
  interview: 'bg-amber-500',
  accepted: 'bg-emerald-500',
  ghosted: 'bg-rose-400',
}

export const Route = createFileRoute('/job-applications')({
  component: JobApplicationsPage,
})

function JobApplicationsPage() {
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
        <JobApplicationsContent />
      </Authenticated>
    </>
  )
}

function JobApplicationsContent() {
  const jobs = useQuery(api.jobs.listMyJobs, { limit: 100 })
  const setJobStatus = useMutation(api.jobs.setJobStatus)
  const upsertJob = useMutation(api.jobs.upsertMyJob)
  const canUseDom = typeof document !== 'undefined'
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    title: '',
    company: '',
    url: '',
    description: '',
  })

  const filteredJobs = useMemo(() => {
    if (!jobs) return []
    const search = query.trim().toLowerCase()
    return jobs.filter((job: any) => {
      const status = (job.status ?? 'viewed') as JobStatus
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      if (!search) return matchesStatus
      const title = (job.title ?? '').toLowerCase()
      const company = (job.company ?? '').toLowerCase()
      return matchesStatus && (title.includes(search) || company.includes(search))
    })
  }, [jobs, query, statusFilter])

  async function updateJobStatus(jobId: Id<'jobs'>, status: JobStatus) {
    await setJobStatus({ jobId, status })
  }

  function openCreateModal() {
    setDraft({ title: '', company: '', url: '', description: '' })
    setFormError(null)
    setIsCreateOpen(true)
  }

  function closeCreateModal() {
    if (isSaving) return
    setIsCreateOpen(false)
  }

  async function submitManualJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const title = draft.title.trim()
    const company = draft.company.trim()
    const url = draft.url.trim()
    const description = draft.description.trim()

    if (!title || !company || !url) {
      setFormError('Title, company, and job URL are required.')
      return
    }

    try {
      setIsSaving(true)
      await upsertJob({
        title,
        company,
        url,
        description,
        source: 'manual',
      })
      setIsCreateOpen(false)
      setDraft({ title: '', company: '', url: '', description: '' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save job.')
    } finally {
      setIsSaving(false)
    }
  }

  const canSubmit = Boolean(draft.title.trim() && draft.company.trim() && draft.url.trim())

  return (
    <SidebarLayout>
      <Page>
        <PageHeader
          title="Applications"
          description="Every job you are tracking, and where each one stands."
          actions={
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Add job
            </button>
          }
        />

        <Panel>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by role or company"
              aria-label="Filter jobs"
              className="h-8 w-full max-w-xs rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as JobStatusFilter)
              }
              aria-label="Filter by status"
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-600 outline-none focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            >
              <option value="all">All statuses</option>
              {JOB_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
              {filteredJobs.length} of {jobs?.length ?? 0}
            </span>
          </div>

          {jobs === undefined ? (
            <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              title={jobs.length === 0 ? "No jobs tracked" : "No matches"}
              description={
                jobs.length === 0
                  ? "The extension adds jobs as you browse. You can also add one by hand."
                  : "Try a different search or status."
              }
              action={
                jobs.length === 0 ? (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Add job
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul>
              {filteredJobs.map((job: any) => {
                const status = (job.status ?? "viewed") as JobStatus
                const addedAt = job.addedAt ?? job.createdAt ?? job.lastSeenAt
                return (
                  <Row as="li" key={job._id}>
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        STATUS_DOT[status],
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      {job.url ? (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block truncate text-[13px] font-medium text-slate-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-100"
                        >
                          {job.title}
                        </a>
                      ) : (
                        <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                          {job.title}
                        </span>
                      )}
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {job.company}
                      </span>
                    </div>

                    <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:block dark:text-slate-500">
                      {typeof addedAt === "number"
                        ? new Date(addedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </span>

                    <select
                      aria-label={`Status for ${job.title}`}
                      value={status}
                      onChange={(event) =>
                        updateJobStatus(job._id, event.target.value as JobStatus)
                      }
                      className="h-7 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-600 outline-none focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                    >
                      {JOB_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <Link
                      to="/generate"
                      search={{
                        title: job.title,
                        company: job.company,
                        description: job.description,
                        url: job.url,
                        source: job.source,
                        jobId: job.jobId,
                        addedAt,
                      }}
                      className="shrink-0 rounded px-2 py-1 text-xs text-slate-500 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 group-hover/row:opacity-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                      Generate
                    </Link>
                  </Row>
                )
              })}
            </ul>
          )}
        </Panel>
      </Page>

      {isCreateOpen && canUseDom &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 px-4 py-8"
            onClick={closeCreateModal}
          >
            <div
              className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="manual-job-title"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
                <div>
                  <h2 id="manual-job-title" className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    Add a job
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">For roles the extension did not catch.</p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form id="manual-job-form" onSubmit={submitManualJob} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manual-job-title-input">Title</Label>
                    <Input
                      id="manual-job-title-input"
                      value={draft.title}
                      onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Senior Product Designer"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-job-company-input">Company</Label>
                    <Input
                      id="manual-job-company-input"
                      value={draft.company}
                      onChange={(event) => setDraft((prev) => ({ ...prev, company: event.target.value }))}
                      placeholder="Arcade Labs"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-job-url-input">Job URL</Label>
                  <Input
                    id="manual-job-url-input"
                    type="url"
                    value={draft.url}
                    onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))}
                    placeholder="https://company.com/careers/123"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-job-description-input">Description</Label>
                  <Textarea
                    id="manual-job-description-input"
                    value={draft.description}
                    onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Paste the most relevant responsibilities and requirements."
                    rows={6}
                  />
                </div>
                {formError && (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                    {formError}
                  </p>
                )}
              </form>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
                <Button type="button" variant="ghost" onClick={closeCreateModal} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" form="manual-job-form" disabled={isSaving || !canSubmit}>
                  {isSaving ? 'Saving...' : 'Save job'}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </SidebarLayout>
  )
}
