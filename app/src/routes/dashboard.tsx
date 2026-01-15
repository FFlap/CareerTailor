import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react'

import type { Id } from '../../convex/_generated/dataModel'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/convex'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AuthLoading>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </AuthLoading>

      <Unauthenticated>
        <p>
          You need to <Link to="/sign-in">sign in</Link>.
        </p>
      </Unauthenticated>

      <Authenticated>
        <DashboardContent />
      </Authenticated>
    </main>
  )
}

function DashboardContent() {
  const jobs = useQuery(api.jobs.listMyJobs, { limit: 50 })
  const documents = useQuery(api.documents.listMyRecentDocuments, { limit: 6 })
  const setJobStatus = useMutation(api.jobs.setJobStatus)

  async function markApplied(jobId: Id<'jobs'>) {
    await setJobStatus({ jobId, status: 'applied' })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/onboarding">Edit Profile</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {documents === undefined ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : documents.length ? (
              documents.map((doc: any) => (
                <div key={doc._id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                          {doc.type === 'cover_letter' ? 'Cover Letter' : 'Resume'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="truncate font-medium">
                        {doc.job?.title || 'Untitled role'}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {doc.job?.company || 'Unknown company'}
                      </div>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link to="/editor/$documentId" params={{ documentId: doc._id }}>
                        Open
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No documents yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {jobs === undefined ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : jobs.length ? (
              jobs.slice(0, 25).map((job: any) => (
                <div key={job._id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {job.title || 'Untitled role'}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {job.company || 'Unknown company'} • {job.status}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {job.status !== 'applied' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => markApplied(job._id)}
                        >
                          Mark applied
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="secondary">
                        <Link
                          to="/generate"
                          search={{
                            title: job.title,
                            company: job.company,
                            description: job.description,
                            url: job.url,
                            source: job.source,
                            jobId: job.jobId,
                          }}
                        >
                          Generate
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {job.url ? (
                    <a
                      className="mt-2 block truncate text-xs text-muted-foreground underline"
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {job.url}
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No jobs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
