import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'

import { api } from '@/lib/convex'
import type { Id } from '../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'
import SidebarLayout from '@/components/SidebarLayout'

type JobStatus = 'viewed' | 'applied' | 'interview' | 'accepted' | 'ghosted'

type JobStatusFilter = JobStatus | 'all'

const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'viewed', label: 'Viewed' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'ghosted', label: 'Ghosted' },
]

const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  viewed: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  interview: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  ghosted: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all')

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

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Job Applications</h1>
          <p className="text-sm text-slate-500">Search, filter, and manage every job you are tracking.</p>
        </header>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="material-icons-outlined text-sm text-slate-400">search</span>
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by role or company"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as JobStatusFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">All statuses</option>
              {JOB_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {filteredJobs.length} results
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Company & Role</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Added</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {jobs === undefined ? (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-500">Loading jobs...</td></tr>
                ) : filteredJobs.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-500">No matching jobs found.</td></tr>
                ) : (
                  filteredJobs.map((job: any) => {
                    const status = (job.status ?? 'viewed') as JobStatus
                    const addedAt = job.addedAt ?? job.createdAt ?? job.lastSeenAt
                    return (
                      <tr key={job._id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                              <span className="material-icons-outlined text-slate-400 text-sm">business</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{job.title}</p>
                              <p className="text-xs text-slate-500">{job.company}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            aria-label="Set job status"
                            value={status}
                            onChange={(event) =>
                              updateJobStatus(job._id, event.target.value as JobStatus)
                            }
                            className={cn(
                              'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40',
                              JOB_STATUS_STYLES[status],
                            )}
                          >
                            {JOB_STATUS_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {typeof addedAt === 'number' ? new Date(addedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
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
                            className="rounded px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                          >
                            Generate
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
