import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { useMemo, useState } from "react";

import SidebarLayout from "@/components/SidebarLayout";
import { EmptyState, Page, PageHeader, Panel, Row } from "@/components/ui/page";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { api } from "@/lib/convex";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <>
      <AuthLoading>
        <SidebarLayout>
          <Page>
            <p className="text-sm text-slate-500">Loading…</p>
          </Page>
        </SidebarLayout>
      </AuthLoading>

      <Unauthenticated>
        <SidebarLayout>
          <Page>
            <EmptyState
              title="Sign in to see your documents"
              action={
                <Link
                  to="/sign-in"
                  className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                >
                  Sign in
                </Link>
              }
            />
          </Page>
        </SidebarLayout>
      </Unauthenticated>

      <Authenticated>
        <GalleryContent />
      </Authenticated>
    </>
  );
}

function GalleryContent() {
  // Paging means a longer window costs nothing to render.
  const documents = useQuery(api.documents.listMyRecentDocuments, {
    limit: 100,
  });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!documents) return [];
    const search = query.trim().toLowerCase();
    if (!search) return documents;
    return documents.filter((doc: any) =>
      [doc.job?.title, doc.job?.company]
        .filter(Boolean)
        .some((field: string) => field.toLowerCase().includes(search)),
    );
  }, [documents, query]);

  const paged = usePagination(filtered, { resetKey: query.trim() });

  return (
    <SidebarLayout>
      <Page>
        <PageHeader
          title="Documents"
          description="Everything you have generated, newest first."
          actions={
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by job or company"
              aria-label="Filter documents"
              className="h-9 w-56 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
          }
        />

        <Panel>
          {documents === undefined ? (
            <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={query ? "No matches" : "No documents yet"}
              description={
                query
                  ? "Try a different job title or company."
                  : "Generate a resume or cover letter and it lands here."
              }
              action={
                query ? undefined : (
                  <Link
                    to="/generate"
                    className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Generate
                  </Link>
                )
              }
            />
          ) : (
            <>
              <ul>
                {paged.pageItems.map((doc: any) => (
                  <Row as="li" key={doc._id}>
                    <Link
                      to="/editor/$documentId"
                      params={{ documentId: doc._id }}
                      className="min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
                    >
                      <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                        {doc.job?.title || "Untitled document"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {[
                          doc.type === "cover_letter"
                            ? "Cover letter"
                            : "Resume",
                          doc.job?.company,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {new Date(
                        doc.updatedAt ?? doc.createdAt,
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </Row>
                ))}
              </ul>
              <Pagination
                page={paged.page}
                pageCount={paged.pageCount}
                from={paged.from}
                to={paged.to}
                total={paged.total}
                noun="document"
                onPage={paged.setPage}
              />
            </>
          )}
        </Panel>
      </Page>
    </SidebarLayout>
  );
}
