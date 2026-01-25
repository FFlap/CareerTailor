import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'

import { api } from '@/lib/convex'
import { cn } from '@/lib/utils'
import SidebarLayout from '@/components/SidebarLayout'

export const Route = createFileRoute('/gallery')({
  component: GalleryPage,
})

function GalleryPage() {
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
        <GalleryContent />
      </Authenticated>
    </>
  )
}

function GalleryContent() {
  const documents = useQuery(api.documents.listMyRecentDocuments, { limit: 24 })
  const [query, setQuery] = useState('')

  const filteredDocuments = useMemo(() => {
    if (!documents) return []
    const search = query.trim().toLowerCase()
    if (!search) return documents
    return documents.filter((doc: any) => {
      const title = (doc.job?.title ?? '').toLowerCase()
      const company = (doc.job?.company ?? '').toLowerCase()
      return title.includes(search) || company.includes(search)
    })
  }, [documents, query])

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Document Gallery</h1>
            <p className="text-sm text-slate-500">Filter generated resumes and cover letters by job or company.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full md:w-72">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-icons-outlined text-sm text-slate-400">search</span>
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by job or company"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {filteredDocuments.length} docs
            </span>
          </div>
        </header>

        {documents === undefined ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            Loading documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            No documents found for this filter.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((doc: any) => (
              <div key={doc._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-start justify-between">
                  <div
                    className={cn(
                      'rounded-lg p-2',
                      doc.type === 'cover_letter'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
                    )}
                  >
                    <span className="material-icons-outlined">
                      {doc.type === 'cover_letter' ? 'mail' : 'contact_page'}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                      doc.type === 'cover_letter'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400',
                    )}
                  >
                    {doc.type === 'cover_letter' ? 'Cover Letter' : 'Resume'}
                  </span>
                </div>
                <h3 className="mb-1 truncate font-semibold text-slate-900 dark:text-white">
                  {doc.job?.title || 'Untitled Document'}
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  {doc.job?.company || 'Unknown company'}
                </p>
                <p className="mb-4 text-xs text-slate-500">
                  Modified {new Date(doc.createdAt).toLocaleDateString()}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-200 dark:border-slate-800"></div>
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
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
