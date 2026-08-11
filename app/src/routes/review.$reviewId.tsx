import { UserButton, useAuth } from "@clerk/tanstack-react-start";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { ArrowLeft, Download, FileText, Loader2, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Id } from "../../convex/_generated/dataModel";

import { Meta } from "@/components/editor/primitives";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import {
  formatReviewDate,
  scoreVerdict,
  type ReviewComment,
} from "@/components/review/model";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/convex";
import {
  applyHighlights,
  buildTextHighlights,
  renderPdfWithTextLayer,
  scrollToComment,
  type PdfPages,
} from "@/lib/pdfHighlight";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/review/$reviewId")({
  component: ReviewRoute,
});

function ReviewRoute() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Sign in to read your reviews.
          </p>
        </div>
      </Unauthenticated>

      <Authenticated>
        <ReviewContent />
      </Authenticated>
    </main>
  );
}

function ReviewContent() {
  const { reviewId } = Route.useParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const review = useQuery(api.reviews.getMyReview, {
    reviewId: reviewId as Id<"reviews">,
  });
  const deleteReview = useMutation(api.reviews.deleteMyReview);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<PdfPages>(new Map());

  const comments: ReviewComment[] = useMemo(
    () => (Array.isArray(review?.comments) ? review.comments : []),
    [review],
  );
  const quotes = useMemo(
    () => comments.map((comment) => ({ id: comment.id, quote: comment.quote })),
    [comments],
  );

  const textSegments = useMemo(
    () => buildTextHighlights(review?.resumeText ?? "", quotes),
    [review?.resumeText, quotes],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // The stored PDF is what was reviewed, so the marks land on the real page.
  useEffect(() => {
    const fileUrl = review?.fileUrl;
    const container = pdfContainerRef.current;
    if (!fileUrl || !container) return;

    let cancelled = false;
    setIsRendering(true);
    setPdfError(null);

    (async () => {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("The saved PDF could not be loaded.");
      const data = await response.arrayBuffer();
      if (cancelled) return;
      pagesRef.current = await renderPdfWithTextLayer({
        data,
        container,
        isCancelled: () => cancelled,
      });
      if (cancelled) return;
      applyHighlights(pagesRef.current, quotes, null);
    })()
      .catch((error) => {
        if (cancelled) return;
        setPdfError(
          error instanceof Error ? error.message : "The PDF could not be shown.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [review?.fileUrl, quotes]);

  useEffect(() => {
    if (!review?.fileUrl) return;
    applyHighlights(pagesRef.current, quotes, activeId);
  }, [activeId, quotes, review?.fileUrl]);

  const handleSelect = useCallback((comment: ReviewComment) => {
    setActiveId(comment.id);
    if (!scrollToComment(pagesRef.current, comment.id)) {
      document
        .querySelector(`[data-text-comment="${comment.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!review) return;
    setIsDeleting(true);
    try {
      await deleteReview({ reviewId: review._id });
      navigate({ to: "/gallery" });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteReview, navigate, review]);

  if (review === undefined) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (review === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-900 dark:text-slate-100">
          This review is gone.
        </p>
        <Link
          to="/gallery"
          className="text-[13px] text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Back to documents
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4 sm:px-6">
          <Link
            to="/gallery"
            className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-400 dark:hover:text-slate-100 md:flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Documents
          </Link>

          <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-800 md:block" />

          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
              {review.label}
            </h1>
            <Meta className="hidden shrink-0 sm:inline">
              Review · {formatReviewDate(review.createdAt)}
            </Meta>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="flex items-baseline gap-1.5 pr-1">
              <Meta>{scoreVerdict(review.overall)}</Meta>
              <span className="text-[13px] font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {review.overall}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-8 px-2.5 text-xs font-normal text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
            {review.fileUrl && (
              <Button
                asChild
                size="sm"
                className="h-8 gap-1.5 bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <a href={review.fileUrl} download={review.label}>
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </a>
              </Button>
            )}
            {isSignedIn && <UserButton afterSignOutUrl="/" />}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-px bg-slate-200 dark:bg-slate-800">
        <section className="flex min-h-0 w-full flex-col bg-white lg:w-[46%] lg:min-w-[26rem] dark:bg-slate-950">
          <div className="flex h-[41px] shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
            <Meta>Review</Meta>
            <Meta>
              {review.jobDescription ? "Against a posting" : "No posting"}
            </Meta>
          </div>

          <ReviewPanel
            summary={review.summary}
            metrics={review.metrics}
            comments={comments}
            activeId={activeId}
            onActivate={setActiveId}
            onSelect={handleSelect}
            selectLabel="Show"
          />
        </section>

        <section className="hidden min-h-0 flex-1 flex-col bg-slate-100 lg:flex dark:bg-slate-900">
          <div className="flex h-[41px] shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
            <Meta>{review.fileUrl ? "The file you uploaded" : "Extracted text"}</Meta>
            {isRendering && <Meta>Rendering</Meta>}
          </div>

          {pdfError && (
            <p className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {pdfError} The extracted text is below.
            </p>
          )}

          <div className="custom-scrollbar flex min-h-0 flex-1 flex-col items-center gap-4 overflow-auto p-6 lg:p-10">
            {review.fileUrl && !pdfError ? (
              <>
                <div ref={pdfContainerRef} className="flex flex-col gap-4" />
                {isRendering && (
                  <div className="flex flex-col items-center gap-2 py-16">
                    <Loader2
                      aria-hidden
                      className="h-4 w-4 animate-spin text-slate-300 dark:text-slate-700"
                    />
                    <Meta>Opening the PDF</Meta>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full max-w-[70ch] whitespace-pre-wrap border border-slate-200 bg-white p-8 text-[13px] leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {review.resumeText ? (
                  textSegments.map((segment, index) =>
                    segment.commentId ? (
                      <mark
                        key={index}
                        data-text-comment={segment.commentId}
                        onMouseEnter={() => setActiveId(segment.commentId ?? null)}
                        onMouseLeave={() => setActiveId(null)}
                        className={cn(
                          "rounded-[1px] bg-slate-900/[0.14] text-slate-900 transition-colors dark:bg-slate-100/20 dark:text-slate-50",
                          activeId === segment.commentId &&
                            "bg-slate-900/[0.26] dark:bg-slate-100/[0.35]",
                        )}
                      >
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    ),
                  )
                ) : (
                  <span className="flex flex-col items-center gap-2 py-8 text-slate-400">
                    <FileText aria-hidden className="h-5 w-5" />
                    No text was stored with this review.
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
