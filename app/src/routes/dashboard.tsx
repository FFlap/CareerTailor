import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { useUser } from '@clerk/tanstack-react-start'

import { api } from '@/lib/convex'
import type { Id } from '../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'
import SidebarLayout from '@/components/SidebarLayout'

type JobStatus = 'viewed' | 'applied' | 'interview' | 'accepted' | 'ghosted'

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

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
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
        <DashboardContent />
      </Authenticated>
    </>
  )
}

function DashboardContent() {
  const { user } = useUser()
  const jobs = useQuery(api.jobs.listMyJobs, { limit: 50 })
  const documents = useQuery(api.documents.listMyRecentDocuments, { limit: 6 })
  const setJobStatus = useMutation(api.jobs.setJobStatus)

  async function updateJobStatus(jobId: Id<'jobs'>, status: JobStatus) {
    await setJobStatus({ jobId, status })
  }

  // Calculate stats
  const appliedCount = jobs?.filter(job => (job.status ?? 'viewed') !== 'viewed').length || 0
  const activeTracked = jobs?.length || 0

  return (
    <SidebarLayout>
      <div className="space-y-10 min-w-0">
        {/* Header Section */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">Good morning, {user?.firstName}</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Here's what's happening with your job applications today.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/onboarding" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
              <span className="material-icons-outlined text-sm">edit</span>
              Edit Profile
            </Link>
            <Link to="/generate" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              <span className="material-icons-outlined text-sm">add</span>
              New Document
            </Link>
          </div>
        </div>

        {/* Recent Documents Section */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="material-icons-outlined text-primary">history</span>
              Recent Documents
            </h2>
            <Link to="/gallery" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          
          <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-4">
            {documents === undefined ? (
               <div className="p-4 text-slate-500">Loading documents...</div>
            ) : documents.length === 0 ? (
               <div className="p-4 text-slate-500">No documents yet. Create one!</div>
            ) : (
                documents.map((doc: any) => (
                    <div key={doc._id} className="flex-none w-72 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                      <div className="mb-4 flex items-start justify-between">
                        <div className={cn("rounded-lg p-2", 
                            doc.type === 'cover_letter' 
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                        )}>
                          <span className="material-icons-outlined">
                            {doc.type === 'cover_letter' ? 'mail' : 'contact_page'}
                          </span>
                        </div>
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                             doc.type === 'cover_letter' 
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
                        )}>
                          {doc.type === 'cover_letter' ? 'Cover Letter' : 'Resume'}
                        </span>
                      </div>
                      <h3 className="mb-1 truncate font-semibold text-slate-900 dark:text-white">
                          {doc.job?.title || 'Untitled Document'}
                      </h3>
                      <p className="mb-4 text-xs text-slate-500">
                          Modified {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                           {/* Placeholder removed */}
                        </div>
                        <Link 
                            to="/editor/$documentId" 
                            params={{ documentId: doc._id }}
                            className="text-sm font-semibold text-primary hover:underline"
                        >
                            Open
                        </Link>
                      </div>
                    </div>
                ))
            )}
          </div>
        </section>

        {/* Main Grid: Job Applications & Sidebar */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Job Applications Table */}
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                        <span className="material-icons-outlined text-primary">work_outline</span>
                        Job Applications
                    </h2>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Company & Role</th>
                                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {jobs === undefined ? (
                                    <tr><td colSpan={4} className="p-6 text-center text-slate-500">Loading jobs...</td></tr>
                                ) : jobs.length === 0 ? (
                                    <tr><td colSpan={4} className="p-6 text-center text-slate-500">No jobs tracked yet.</td></tr>
                                ) : (
                                    jobs.slice(0, 10).map((job: any) => {
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

            {/* Sidebar Stats */}
            <aside className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                        <span className="material-icons-outlined text-primary">insights</span>
                        Profile Insights
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium">Profile Strength</span>
                                <span className="text-xs font-bold text-emerald-500">84%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                                <div className="h-2 rounded-full bg-emerald-500" style={{width: "84%"}}></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                                <p className="text-[10px] uppercase font-bold tracking-tight text-slate-500">Views</p>
                                <p className="mt-1 text-xl font-bold">1,204</p>
                                <p className="mt-1 text-[10px] text-emerald-500">↑ 12% vs last mo</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                                <p className="text-[10px] uppercase font-bold tracking-tight text-slate-500">Applies</p>
                                <p className="mt-1 text-xl font-bold">{appliedCount}</p>
                                <p className="mt-1 text-[10px] text-primary">{activeTracked} active tracked</p>
                            </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                            <p className="mb-3 text-sm font-semibold">Suggested Improvements</p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-2">
                                    <span className="material-icons-outlined text-lg text-primary">check_circle_outline</span>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Add 3 more skills to your 'Frontend' resume.</p>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="material-icons-outlined text-lg text-primary">check_circle_outline</span>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Update your LinkedIn profile link in settings.</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-xl bg-primary p-6 text-white">
                    <div className="relative z-10">
                        <h3 className="mb-1 font-bold">Get more interviews</h3>
                        <p className="mb-4 text-xs text-indigo-100">Unlock 50+ premium templates and AI-powered cover letter generation.</p>
                        <button className="w-full rounded-lg bg-white py-2 text-sm font-bold text-primary transition-colors hover:bg-slate-50">Upgrade to Pro</button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 opacity-20">
                        <span className="material-icons-outlined text-9xl">auto_awesome</span>
                    </div>
                </div>
            </aside>
        </div>

        {/* Mobile Nav */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <button className="p-2 text-primary"><span className="material-icons-outlined">dashboard</span></button>
            <button className="p-2 text-slate-400"><span className="material-icons-outlined">search</span></button>
            <button className="p-2 text-slate-400"><span className="material-icons-outlined">add_box</span></button>
            <button className="p-2 text-slate-400"><span className="material-icons-outlined">history</span></button>
            <button className="p-2 text-slate-400"><span className="material-icons-outlined">person</span></button>
        </div>

      </div>
    </SidebarLayout>
  )
}
