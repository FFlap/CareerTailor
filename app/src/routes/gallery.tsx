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
import { cn } from "@/lib/utils";

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

type Kind = "all" | "resume" | "cover_letter" | "review";

const KIND_LABELS: Record<Kind, string> = {
  all: "All",
  resume: "Résumés",
  cover_letter: "Letters",
  review: "Reviews",
};

type Entry = {
  key: string;
  kind: Exclude<Kind, "all">;
  title: string;
  meta: string;
  at: number;
  score?: number;
  to: "/editor/$documentId" | "/review/$reviewId";
  params: any;
  search?: { pane: "review" };
};

function GalleryContent() {
  // Paging means a longer window costs nothing to render.
  const documents = useQuery(api.documents.listMyRecentDocuments, {
    limit: 100,
  });
  const reviews = useQuery(api.reviews.listMyReviews, { limit: 100 });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  // A review of a document is not a row of its own; it is a score on that row.
  const scoreByDocument = useMemo(() => {
    const map = new Map<string, number>();
    for (const review of reviews ?? []) {
      if (!review.documentId) continue;
      const current = map.get(review.documentId);
      if (current === undefined) map.set(review.documentId, review.overall);
    }
    return map;
  }, [reviews]);

  const entries = useMemo<Entry[]>(() => {
    const fromDocuments: Entry[] = (documents ?? []).map((doc: any) => ({
      key: doc._id,
      kind: doc.type === "cover_letter" ? "cover_letter" : "resume",
      title: doc.job?.title || "Untitled document",
      meta: [
        doc.type === "cover_letter" ? "Cover letter" : "Résumé",
        doc.job?.company,
      ]
        .filter(Boolean)
        .join(" · "),
      at: doc.updatedAt ?? doc.createdAt,
      score: scoreByDocument.get(doc._id),
      to: "/editor/$documentId",
      params: { documentId: doc._id },
    }));

    const fromUploads: Entry[] = (reviews ?? [])
      .filter((review: any) => !review.documentId)
      .map((review: any) => ({
        key: review._id,
        kind: "review" as const,
        title: review.label,
        meta: `Review · ${review.commentCount} notes`,
        at: review.createdAt,
        score: review.overall,
        to: "/review/$reviewId" as const,
        params: { reviewId: review._id },
      }));

    return [...fromDocuments, ...fromUploads].sort((a, b) => b.at - a.at);
  }, [documents, reviews, scoreByDocument]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (kind === "review" && entry.kind !== "review" && entry.score === undefined) {
        return false;
      }
      if (kind !== "all" && kind !== "review" && entry.kind !== kind) return false;
      if (!search) return true;
      return `${entry.title} ${entry.meta}`.toLowerCase().includes(search);
    });
  }, [entries, kind, query]);

  const loading = documents === undefined || reviews === undefined;
  const paged = usePagination(filtered, { resetKey: `${kind}:${query.trim()}` });

  return (
    <SidebarLayout>
      <Page>
        <PageHeader
          title="Documents"
          description="Everything you have written and everything that has been read back, newest first."
          actions={
            <>
              <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-800">
                {(Object.keys(KIND_LABELS) as Kind[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setKind(option)}
                    aria-pressed={kind === option}
                    className={cn(
                      "rounded px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25",
                      kind === option
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                    )}
                  >
                    {KIND_LABELS[option]}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by job or company"
                aria-label="Filter documents"
                className="h-9 w-56 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
              />
            </>
          }
        />

        <Panel>
          {loading ? (
            <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={
                query
                  ? "No matches"
                  : kind === "review"
                    ? "Nothing reviewed yet"
                    : "No documents yet"
              }
              description={
                query
                  ? "Try a different job title or company."
                  : kind === "review"
                    ? "A review scores a résumé and lists what to fix. It is saved here."
                    : "Generate a résumé or cover letter and it lands here."
              }
              action={
                query ? undefined : (
                  <Link
                    to="/generate"
                    className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {kind === "review" ? "Review a résumé" : "Generate"}
                  </Link>
                )
              }
            />
          ) : (
            <>
              <ul>
                {paged.pageItems.map((entry: Entry) => (
                  <Row as="li" key={entry.key}>
                    <Link
                      to={entry.to}
                      params={entry.params}
                      search={entry.search ?? {}}
                      className="min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
                    >
                      <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                        {entry.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {entry.meta}
                      </span>
                    </Link>
                    {entry.score !== undefined && (
                      <span className="shrink-0 text-[13px] font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {entry.score}
                      </span>
                    )}
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {new Date(entry.at).toLocaleDateString(undefined, {
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
                noun={kind === "review" ? "review" : "document"}
                onPage={paged.setPage}
              />
            </>
          )}
        </Panel>
      </Page>
    </SidebarLayout>
  );
}
