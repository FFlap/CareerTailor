import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { PageSkeleton } from "@/components/PageThumbnail";
import {
  Shelf,
  ShelfLabel,
  Tile,
  type DocumentEntry,
} from "@/components/documents/tiles";
import SidebarLayout from "@/components/SidebarLayout";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { api } from "@/lib/convex";
import { renderPdfFirstPageToDataUrl } from "@/lib/thumbnails";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
  head: () => ({ meta: [{ title: "Documents · CareerTailor" }] }),
});

function DocumentsPage() {
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
        <DocumentsContent />
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

function DocumentsContent() {
  // Paging means a longer window costs nothing to render.
  const documents = useQuery(api.documents.listMyRecentDocuments, {
    limit: 100,
  });
  // An upload that was reviewed has no document behind it; it is its own tile.
  const reviews = useQuery(api.reviews.listMyReviews, { limit: 100 });
  // Starred work outlives the recent window, so it is fetched on its own.
  const favoriteDocuments = useQuery(api.documents.listMyFavoriteDocuments, {});
  const favoriteReviews = useQuery(api.reviews.listMyFavoriteReviews, {});

  const setDocumentFavorite = useMutation(api.documents.setMyDocumentFavorite);
  const setReviewFavorite = useMutation(api.reviews.setMyReviewFavorite);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  // The star answers before the round trip does.
  const [pendingStars, setPendingStars] = useState<Record<string, boolean>>({});

  const entries = useMemo<DocumentEntry[]>(() => {
    const fromDocuments: DocumentEntry[] = dedupe(favoriteDocuments, documents)
      .map((doc: any) => ({
        key: doc._id,
        kind: (doc.type === "cover_letter" ? "cover_letter" : "resume") as
          | "cover_letter"
          | "resume",
        title: doc.job?.title || "Untitled document",
        typeLabel: doc.type === "cover_letter" ? "Cover letter" : "Résumé",
        company: doc.job?.company || undefined,
        at: doc.updatedAt ?? doc.createdAt,
        favorite: doc.favorite === true,
        thumbKey: `doc:${doc._id}:${doc.updatedAt ?? doc.createdAt}`,
        thumbnail: async () => {
          const { renderTypstFirstPageToDataUrl } =
            await import("@/lib/typst/renderClient");
          return renderTypstFirstPageToDataUrl({
            source: doc.typstSource,
            documentType: doc.type,
            templateId: doc.templateId,
          });
        },
        to: "/editor/$documentId" as const,
        params: { documentId: doc._id },
      }));

    const fromUploads: DocumentEntry[] = dedupe(favoriteReviews, reviews)
      .filter((review: any) => !review.documentId)
      .map((review: any) => ({
        key: review._id,
        kind: "review" as const,
        title: review.label,
        typeLabel: "Review",
        at: review.createdAt,
        favorite: review.favorite === true,
        thumbKey: `review:${review._id}`,
        thumbnail: review.fileUrl
          ? () => renderPdfFirstPageToDataUrl(review.fileUrl)
          : null,
        to: "/review/$reviewId" as const,
        params: { reviewId: review._id },
      }));

    return [...fromDocuments, ...fromUploads].sort((a, b) => b.at - a.at);
  }, [documents, favoriteDocuments, favoriteReviews, reviews]);

  const isStarred = useCallback(
    (entry: DocumentEntry) => pendingStars[entry.key] ?? entry.favorite,
    [pendingStars],
  );

  const toggleStar = useCallback(
    async (entry: DocumentEntry) => {
      const next = !isStarred(entry);
      setPendingStars((current) => ({ ...current, [entry.key]: next }));
      try {
        if (entry.kind === "review") {
          await setReviewFavorite({
            reviewId: entry.params.reviewId,
            favorite: next,
          });
        } else {
          await setDocumentFavorite({
            documentId: entry.params.documentId,
            favorite: next,
          });
        }
      } finally {
        // The query has caught up by now, whether or not the write landed.
        setPendingStars((current) => {
          const rest = { ...current };
          delete rest[entry.key];
          return rest;
        });
      }
    },
    [isStarred, setDocumentFavorite, setReviewFavorite],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (kind !== "all" && entry.kind !== kind) return false;
      if (!search) return true;
      return `${entry.title} ${entry.typeLabel} ${entry.company ?? ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [entries, kind, query]);

  const starred = filtered.filter(isStarred);
  const rest = filtered.filter((entry) => !isStarred(entry));

  const loading =
    documents === undefined ||
    reviews === undefined ||
    favoriteDocuments === undefined ||
    favoriteReviews === undefined;
  const paged = usePagination(rest, {
    perPage: 24,
    resetKey: `${kind}:${query.trim()}`,
  });

  return (
    <SidebarLayout>
      <Page>
        <PageHeader
          title="Documents"
          description="Every page you have written or had read back, as it prints. Newest first."
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

        {loading ? (
          <LoadingShelf />
        ) : filtered.length === 0 ? (
          <EmptyState
            className="border-t border-slate-200 pt-16 dark:border-slate-800"
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
                  ? "Upload a résumé for review and it is kept here."
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
          <div className="space-y-12">
            {starred.length > 0 && (
              <section>
                <ShelfLabel
                  icon={
                    <Star
                      aria-hidden
                      className="h-3.5 w-3.5 fill-current text-slate-900 dark:text-slate-100"
                    />
                  }
                  label="Favorites"
                  count={starred.length}
                />
                <Shelf>
                  {starred.map((entry) => (
                    <Tile
                      key={entry.key}
                      entry={entry}
                      starred
                      onToggleStar={() => toggleStar(entry)}
                    />
                  ))}
                </Shelf>
              </section>
            )}

            <section>
              <ShelfLabel
                label="Recent"
                count={rest.length}
                hint={
                  starred.length === 0
                    ? "Star a page to keep it at the top"
                    : undefined
                }
              />
              {rest.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-500 dark:text-slate-400">
                  Everything here is a favorite.
                </p>
              ) : (
                <>
                  <Shelf>
                    {paged.pageItems.map((entry: DocumentEntry) => (
                      <Tile
                        key={entry.key}
                        entry={entry}
                        starred={false}
                        onToggleStar={() => toggleStar(entry)}
                      />
                    ))}
                  </Shelf>
                  <Pagination
                    className="mt-8 px-0"
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
            </section>
          </div>
        )}
      </Page>
    </SidebarLayout>
  );
}

/** Starred rows come first so they win the identity of a document they share. */
function dedupe(preferred: any[] | undefined, rest: any[] | undefined) {
  const byId = new Map<string, any>();
  for (const row of preferred ?? []) byId.set(row._id, row);
  for (const row of rest ?? []) if (!byId.has(row._id)) byId.set(row._id, row);
  return [...byId.values()];
}

function LoadingShelf() {
  return (
    <div>
      <ShelfLabel label="Recent" />
      <Shelf>
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index}>
            <div className="relative aspect-[17/22] overflow-hidden rounded-[3px] border border-slate-200 bg-white dark:border-slate-700">
              <PageSkeleton shape="resume" seed={`skeleton-${index}`} settled={false} />
            </div>
            <div className="mt-3 h-2.5 w-3/4 rounded-[1px] bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-2 w-1/2 rounded-[1px] bg-slate-100 dark:bg-slate-800" />
          </li>
        ))}
      </Shelf>
    </div>
  );
}
