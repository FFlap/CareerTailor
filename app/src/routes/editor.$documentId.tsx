import { useAuth, UserButton } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileCode,
  Loader2,
  Moon,
  Share2,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Id } from "../../convex/_generated/dataModel";

import { templateSections } from "../../convex/lib/templates";

import { CoverLetterFields } from "@/components/editor/CoverLetterFields";
import {
  EMPTY_COVER,
  EMPTY_RESUME,
  coverDisclosureKeys,
  normalizeCoverLetterData,
  normalizeResumeData,
  resumeDisclosureKeys,
  type CoverLetterData,
  type ResumeData,
} from "@/components/editor/model";
import { Meta, PaneTab } from "@/components/editor/primitives";
import { ResumeFields } from "@/components/editor/ResumeFields";
import { useDisclosure } from "@/components/editor/useDisclosure";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import {
  formatReviewDate,
  locateQuote,
  type ReviewComment,
} from "@/components/review/model";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/convex";
import type { PdfPages } from "@/lib/pdfHighlight";
import { cn } from "@/lib/utils";

type PaneKey = "fields" | "source" | "review";

export const Route = createFileRoute("/editor/$documentId")({
  validateSearch: (search: Record<string, unknown>): { pane?: PaneKey } =>
    search.pane === "review" || search.pane === "source"
      ? { pane: search.pane }
      : {},
  component: EditorPage,
});

function EditorPage() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Sign in to edit documents.
          </p>
        </div>
      </Unauthenticated>

      <Authenticated>
        <EditorContent />
      </Authenticated>
    </main>
  );
}

function EditorContent() {
  const { documentId } = Route.useParams();
  const { pane } = Route.useSearch();
  const doc = useQuery(api.documents.getMyDocument, {
    documentId: documentId as Id<"documents">,
  });
  const updateTypstSource = useMutation(api.documents.updateMyTypstSource);
  const updateDocumentData = useMutation(api.documents.updateMyDocumentData);
  const runReview = useAction(api.reviews.reviewResume);
  const review = useQuery(
    api.reviews.latestForDocument,
    doc?.type === "resume"
      ? { documentId: documentId as Id<"documents"> }
      : "skip",
  );

  const [source, setSource] = useState("");
  const [status, setStatus] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const hasAutoRendered = useRef(false);
  const [isDark, setIsDark] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<PaneKey>("fields");
  const [activeComment, setActiveComment] = useState<number | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isMarkingUp, setIsMarkingUp] = useState(false);
  const [markupError, setMarkupError] = useState<string | null>(null);
  const reviewPdfRef = useRef<HTMLDivElement | null>(null);
  const reviewPagesRef = useRef<PdfPages>(new Map());
  const [structuredData, setStructuredData] = useState<
    ResumeData | CoverLetterData | null
  >(null);
  const [structuredDirty, setStructuredDirty] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const { isSignedIn } = useAuth();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const statusTimeout = useRef<number | null>(null);
  const autoApplyTimeout = useRef<number | null>(null);
  const structuredJsonRef = useRef<string>("");
  const sourceRef = useRef<string>("");
  const lastDocIdRef = useRef<string | null>(null);

  const sourceOverridden = Boolean(doc?.sourceEditedAt);

  const disclosure = useDisclosure();

  const disclosureKeys = useMemo(() => {
    if (!structuredData) return [];
    return doc?.type === "cover_letter"
      ? coverDisclosureKeys(structuredData as CoverLetterData)
      : resumeDisclosureKeys(structuredData as ResumeData);
  }, [doc?.type, structuredData]);

  const allExpanded =
    disclosureKeys.length > 0 && disclosureKeys.every(disclosure.isOpen);

  const sections = useMemo(
    () => templateSections(doc?.templateId),
    [doc?.templateId],
  );

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    structuredJsonRef.current = JSON.stringify(structuredData ?? null);
  }, [structuredData]);

  useEffect(() => {
    if (!doc) return;
    const normalized =
      doc.type === "resume"
        ? normalizeResumeData(doc.data)
        : normalizeCoverLetterData(doc.data);

    if (doc._id !== lastDocIdRef.current) {
      lastDocIdRef.current = doc._id;
      setSource(doc.typstSource || "");
      setSourceDirty(false);
      setStructuredData(normalized);
      setStructuredDirty(false);
      setRenderError(null);
      setSaveError(null);
      return;
    }

    if (!sourceDirty && (doc.typstSource || "") !== sourceRef.current) {
      setSource(doc.typstSource || "");
    }
    if (!structuredDirty && !isApplying) {
      const normalizedJson = JSON.stringify(normalized);
      if (normalizedJson !== structuredJsonRef.current) {
        setStructuredData(normalized);
      }
    }
  }, [doc, sourceDirty, structuredDirty, isApplying]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    return () => {
      if (statusTimeout.current) {
        window.clearTimeout(statusTimeout.current);
      }
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current);
      }
    };
  }, []);

  const pushStatus = useCallback((message: string, autoClear = true) => {
    setStatus(message);
    if (statusTimeout.current) {
      window.clearTimeout(statusTimeout.current);
    }
    if (autoClear) {
      statusTimeout.current = window.setTimeout(() => setStatus(""), 2400);
    }
  }, []);

  const render = useCallback(
    async (sourceToRender: string) => {
      if (!doc) return false;
      const container = previewRef.current;
      if (!container) {
        setStatus("Preview not ready.");
        return false;
      }
      setStatus("Rendering…");
      try {
        const { renderTypstToCanvasInBrowser } =
          await import("@/lib/typst/renderClient");
        await renderTypstToCanvasInBrowser({
          source: sourceToRender,
          documentType: doc.type,
          templateId: doc.templateId,
          container,
        });
        setHasPreview(true);
        setRenderError(null);
        pushStatus("Ready.");
        return true;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Typst failed to compile this source.";
        setRenderError(message);
        setStatus("Compile error.");
        return false;
      }
    },
    [doc, pushStatus],
  );

  const saveSource = useCallback(async () => {
    if (!doc?._id) return false;
    setIsSavingSource(true);
    setSaveError(null);
    setStatus("Saving…");
    try {
      await updateTypstSource({ documentId: doc._id, typstSource: source });
      setSourceDirty(false);
      pushStatus("Source saved.");
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed.");
      setStatus("Save failed.");
      return false;
    } finally {
      setIsSavingSource(false);
    }
  }, [doc, pushStatus, source, updateTypstSource]);

  const applyFields = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!doc || !structuredData) return false;
      setIsApplying(true);
      setSaveError(null);
      try {
        const result = await updateDocumentData({
          documentId: doc._id,
          data: structuredData,
        });
        setStructuredDirty(false);
        if (result?.typstSource) {
          setSource(result.typstSource);
          setSourceDirty(false);
          await render(result.typstSource);
        }
        if (!silent) pushStatus("Source rebuilt from fields.");
        return true;
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Could not rebuild the document.",
        );
        return false;
      } finally {
        setIsApplying(false);
      }
    },
    [doc, pushStatus, render, structuredData, updateDocumentData],
  );

  useEffect(() => {
    if (!doc || !source || hasAutoRendered.current) return;
    hasAutoRendered.current = true;
    void render(source);
  }, [doc, source, render]);

  // Arriving from Generate with a review already written should open on it.
  useEffect(() => {
    if (!pane || !doc) return;
    if (pane === "review" && doc.type !== "resume") return;
    setActiveTab(pane);
  }, [doc, pane]);

  const reviewComments: ReviewComment[] = useMemo(
    () => (Array.isArray(review?.comments) ? review.comments : []),
    [review],
  );

  const reviewQuotes = useMemo(
    () => reviewComments.map((comment) => ({ id: comment.id, quote: comment.quote })),
    [reviewComments],
  );

  const markedUpVisible = activeTab === "review" && Boolean(review) && !markupError;

  /**
   * The canvas preview carries no text, so a note has nothing to point at. On
   * the review pane the document is compiled to a PDF instead, which brings a
   * text layer the notes can mark.
   */
  useEffect(() => {
    if (activeTab !== "review" || !review || !doc || !source) return;
    const container = reviewPdfRef.current;
    if (!container) return;

    let cancelled = false;
    setIsMarkingUp(true);
    setMarkupError(null);

    (async () => {
      const { renderTypstToPdfBytesInBrowser } =
        await import("@/lib/typst/renderClient");
      const { renderPdfWithTextLayer, applyHighlights } =
        await import("@/lib/pdfHighlight");
      const bytes = await renderTypstToPdfBytesInBrowser({
        source,
        documentType: doc.type,
        templateId: doc.templateId,
      });
      if (cancelled) return;
      reviewPagesRef.current = await renderPdfWithTextLayer({
        data: bytes.slice().buffer,
        container,
        isCancelled: () => cancelled,
      });
      if (cancelled) return;
      applyHighlights(reviewPagesRef.current, reviewQuotes, null);
    })()
      .catch((error) => {
        if (cancelled) return;
        setMarkupError(
          error instanceof Error ? error.message : "The marked-up page failed.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsMarkingUp(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, doc, review, source, reviewQuotes]);

  useEffect(() => {
    if (activeTab !== "review" || !reviewPagesRef.current.size) return;
    void import("@/lib/pdfHighlight").then(({ applyHighlights }) =>
      applyHighlights(reviewPagesRef.current, reviewQuotes, activeComment),
    );
  }, [activeComment, activeTab, reviewQuotes]);

  const startReview = useCallback(async () => {
    if (!doc) return;
    setReviewError(null);
    setIsReviewing(true);
    try {
      // Review what is on screen, not the last thing that happened to be saved.
      if (structuredDirty && !sourceOverridden) {
        await applyFields({ silent: true });
      }
      await runReview({ documentId: doc._id });
      pushStatus("Review ready.");
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "The review failed.",
      );
    } finally {
      setIsReviewing(false);
    }
  }, [
    applyFields,
    doc,
    pushStatus,
    runReview,
    sourceOverridden,
    structuredDirty,
  ]);

  /** Shows the quoted line on the page, without leaving the review. */
  const showOnPage = useCallback((comment: ReviewComment) => {
    setActiveComment(comment.id);
    void import("@/lib/pdfHighlight").then(({ scrollToComment }) =>
      scrollToComment(reviewPagesRef.current, comment.id),
    );
  }, []);

  /** Opens the field a note is about and marks it, so the fix is one scroll away. */
  const jumpToComment = useCallback(
    (comment: ReviewComment) => {
      showOnPage(comment);
      const target = locateQuote(structuredData as ResumeData | null, comment);
      if (!target) return;
      setActiveTab("fields");
      target.keys.forEach((key) => disclosure.set(key, true));
      window.setTimeout(() => {
        const node = document.getElementById(target.domId)?.parentElement;
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (!node) return;
        node.classList.add("field-flash");
        window.setTimeout(() => node.classList.remove("field-flash"), 1200);
      }, 120);
    },
    [disclosure, showOnPage, structuredData],
  );

  const wordCount = useMemo(() => {
    const trimmed = source.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [source]);

  const templateLabel = useMemo(() => {
    if (!doc?.templateId) return "Custom";
    return doc.templateId.startsWith("custom:")
      ? "Custom Template"
      : doc.templateId.replace(/-/g, " ");
  }, [doc?.templateId]);

  const docTypeLabel = useMemo(() => {
    if (!doc?.type) return "Document";
    return doc.type === "cover_letter" ? "Cover Letter" : "Resume";
  }, [doc?.type]);

  /** The posting names the document; without one, its kind has to do. */
  const docTitle = useMemo(() => {
    const job = doc?.job;
    if (!job) return docTypeLabel;
    return [job.title, job.company].filter(Boolean).join(" · ") || docTypeLabel;
  }, [doc?.job, docTypeLabel]);

  const idleStatus = useMemo(() => {
    if (renderError) return "Compile error";
    if (sourceDirty) return "Unsaved source";
    if (structuredDirty)
      return sourceOverridden ? "Fields not applied" : "Applying…";
    if (sourceOverridden) return "Custom source";
    return "Synced";
  }, [renderError, sourceDirty, sourceOverridden, structuredDirty]);

  const statusTone = useMemo(() => {
    if (renderError) return "bg-rose-500";
    if (!status) {
      return sourceDirty || structuredDirty || sourceOverridden
        ? "bg-amber-500"
        : "bg-emerald-500";
    }
    const lowered = status.toLowerCase();
    if (lowered.includes("fail") || lowered.includes("error"))
      return "bg-rose-500";
    if (
      lowered.includes("saving") ||
      lowered.includes("render") ||
      lowered.includes("export") ||
      lowered.includes("share") ||
      lowered.includes("copy")
    ) {
      return "bg-amber-500";
    }
    return "bg-emerald-500";
  }, [renderError, sourceDirty, sourceOverridden, status, structuredDirty]);

  const handleShare = useCallback(async () => {
    if (!doc) return;
    if (typeof window === "undefined") return;
    const shareUrl = window.location.href;
    const shareTitle = docTitle;
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url: shareUrl });
        pushStatus("Share ready.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        pushStatus("Link copied.");
        return;
      }
      window.prompt("Copy this link:", shareUrl);
      pushStatus("Link ready to copy.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setStatus(error instanceof Error ? error.message : "Share failed.");
    } finally {
      setIsSharing(false);
    }
  }, [doc, docTitle, pushStatus]);

  const handleExportPdf = useCallback(async () => {
    if (!doc) return;
    if (typeof document === "undefined") return;
    setIsExporting(true);
    setStatus("Exporting PDF…");
    try {
      const { renderTypstToPdfBytesInBrowser } =
        await import("@/lib/typst/renderClient");
      const pdfBytes = await renderTypstToPdfBytesInBrowser({
        source,
        documentType: doc.type,
        templateId: doc.templateId,
      });
      // Copied into its own buffer: a view over a shared one is not a BlobPart.
      const blob = new Blob([pdfBytes.slice().buffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      // The kind is always in the name, so a résumé and its letter never collide.
      const baseName = [docTitle === docTypeLabel ? "" : docTitle, docTypeLabel]
        .filter(Boolean)
        .join(" ")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");
      const fileName = `${baseName || "document"}.pdf`;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      pushStatus("PDF downloaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }, [doc, docTitle, docTypeLabel, pushStatus, source]);

  const handleFieldsChange = useCallback(
    (next: ResumeData | CoverLetterData) => {
      setStructuredData(next);
      setStructuredDirty(true);
    },
    [],
  );

  useEffect(() => {
    if (!doc || !structuredData) return;
    if (!structuredDirty) return;
    if (sourceOverridden || sourceDirty) return;
    if (activeTab !== "fields") return;
    if (isApplying) return;

    if (autoApplyTimeout.current) {
      window.clearTimeout(autoApplyTimeout.current);
    }
    autoApplyTimeout.current = window.setTimeout(() => {
      void applyFields({ silent: true });
    }, 700);

    return () => {
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current);
      }
    };
  }, [
    activeTab,
    applyFields,
    doc,
    isApplying,
    sourceDirty,
    sourceOverridden,
    structuredData,
    structuredDirty,
  ]);

  const switchTab = useCallback(
    async (next: PaneKey) => {
      if (next === activeTab) return;
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current);
        autoApplyTimeout.current = null;
      }

      if (next === "source") {
        if (structuredDirty && !sourceOverridden && !sourceDirty) {
          await applyFields({ silent: true });
        }
      } else if (sourceDirty) {
        const saved = await saveSource();
        if (saved) await render(sourceRef.current);
      }

      setActiveTab(next);
    },
    [
      activeTab,
      applyFields,
      render,
      saveSource,
      sourceDirty,
      sourceOverridden,
      structuredDirty,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      void saveSource();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void render(source);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4 sm:px-6">
          <Link
            to="/dashboard"
            className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-400 dark:hover:text-slate-100 md:flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Documents
          </Link>

          <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-800 md:block" />

          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
              {docTitle}
            </h1>
            <Meta className="hidden shrink-0 sm:inline">
              {docTypeLabel} · {templateLabel}
            </Meta>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="flex items-center gap-1.5 pr-1"
              role="status"
              aria-live="polite"
            >
              <span
                className={cn("h-1 w-1 rounded-full", statusTone)}
                aria-hidden
              />
              <Meta>{status || idleStatus}</Meta>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              aria-label={
                isDark ? "Switch to light theme" : "Switch to dark theme"
              }
              className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              disabled={!doc || isSharing}
              className="h-8 gap-1.5 px-2.5 text-xs font-normal text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              {isSharing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              Share
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={!doc || isExporting}
              className="h-8 gap-1.5 bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
            </Button>
            {isSignedIn && <UserButton afterSignOutUrl="/" />}
          </div>
        </div>
      </header>

      {!doc ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-px bg-slate-200 dark:bg-slate-800">
          <section className="flex min-h-0 w-full flex-col bg-white lg:w-[46%] lg:min-w-[26rem] dark:bg-slate-950">
            <div
              role="tablist"
              className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-3 dark:border-slate-800"
            >
              <PaneTab
                active={activeTab === "fields"}
                onClick={() => void switchTab("fields")}
              >
                Fields
              </PaneTab>
              <PaneTab
                active={activeTab === "source"}
                onClick={() => void switchTab("source")}
              >
                Typst
              </PaneTab>
              {doc.type === "resume" && (
                <PaneTab
                  active={activeTab === "review"}
                  onClick={() => void switchTab("review")}
                >
                  <span className="flex items-baseline gap-1.5">
                    Review
                    {review && (
                      <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        {review.overall}
                      </span>
                    )}
                  </span>
                </PaneTab>
              )}

              <div className="ml-auto flex items-center gap-1">
                {activeTab === "review" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void startReview()}
                    disabled={isReviewing}
                    className="h-7 px-2 text-[11px] font-normal text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                  >
                    {isReviewing
                      ? "Reading…"
                      : review
                        ? "Review again"
                        : "Review"}
                  </Button>
                ) : activeTab === "fields" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        disclosure.setAll(disclosureKeys, !allExpanded)
                      }
                      className="h-7 px-2 text-[11px] font-normal text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                    >
                      {allExpanded ? "Collapse all" : "Expand all"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void applyFields()}
                      disabled={isApplying || !structuredData}
                      className={cn(
                        "h-7 px-2 text-[11px] font-normal",
                        structuredDirty
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-400 dark:text-slate-500",
                        "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                      )}
                    >
                      {isApplying
                        ? "Rebuilding…"
                        : structuredDirty
                          ? "Apply now"
                          : "Rebuild"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void saveSource()}
                      disabled={isSavingSource || !sourceDirty}
                      className="h-7 px-2 text-[11px] font-normal text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                    >
                      {isSavingSource
                        ? "Saving…"
                        : sourceDirty
                          ? "Save"
                          : "Saved"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void render(source)}
                      className="h-7 px-2 text-[11px] font-normal text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-900"
                    >
                      Render
                    </Button>
                  </>
                )}
              </div>
            </div>

            {sourceOverridden && (
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                <Meta className="text-slate-500 dark:text-slate-400">
                  Hand-edited
                </Meta>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The Typst below is yours. Fields no longer drive it.
                </p>
                <button
                  type="button"
                  onClick={() => void applyFields()}
                  disabled={isApplying}
                  className="text-xs text-slate-900 underline decoration-slate-300 underline-offset-4 outline-none hover:decoration-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50 dark:text-slate-100 dark:decoration-slate-600 dark:hover:decoration-slate-100"
                >
                  Rebuild from fields
                </button>
              </div>
            )}

            {saveError && (
              <p className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {saveError}
              </p>
            )}

            {activeTab === "source" ? (
              <div className="flex min-h-0 flex-1">
                <div
                  aria-hidden
                  className="hidden shrink-0 select-none overflow-hidden border-r border-slate-100 py-4 pl-4 pr-2 text-right font-mono text-[11px] leading-6 text-slate-300 dark:border-slate-900 dark:text-slate-700 sm:block"
                >
                  {source.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <Textarea
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setSourceDirty(true);
                  }}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  aria-label="Typst source"
                  className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-4 font-mono text-[12.5px] leading-6 text-slate-700 shadow-none focus-visible:ring-0 dark:text-slate-300"
                />
              </div>
            ) : activeTab === "review" ? (
              review === undefined ? (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <Meta>Loading</Meta>
                </div>
              ) : review === null ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                  <div className="max-w-[42ch] space-y-1.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Nobody has read this yet
                    </p>
                    <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                      A review scores this résumé on parsing, readability, and
                      impact, then names every line that is not earning its
                      place. It is saved here and in your documents.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void startReview()}
                    disabled={isReviewing}
                    className="h-8 bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {isReviewing && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    {isReviewing ? "Reading it" : "Review this résumé"}
                  </Button>
                  {reviewError && (
                    <p className="max-w-[42ch] text-xs text-rose-600 dark:text-rose-400">
                      {reviewError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {(reviewError || markupError) && (
                    <p className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                      {reviewError ??
                        `${markupError} The notes below still apply.`}
                    </p>
                  )}
                  <ReviewPanel
                    summary={review.summary}
                    metrics={review.metrics}
                    comments={reviewComments}
                    activeId={activeComment}
                    onActivate={setActiveComment}
                    onSelect={jumpToComment}
                    selectLabel="Fix"
                  />
                </>
              )
            ) : (
              <div className="@container/fields min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5">
                {doc.type === "resume" ? (
                  <ResumeFields
                    value={(structuredData ?? EMPTY_RESUME) as ResumeData}
                    onChange={handleFieldsChange}
                    disclosure={disclosure}
                    sections={sections}
                  />
                ) : (
                  <CoverLetterFields
                    value={(structuredData ?? EMPTY_COVER) as CoverLetterData}
                    onChange={handleFieldsChange}
                    disclosure={disclosure}
                  />
                )}

                <div className="h-16" />
              </div>
            )}

            <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-200 px-4 dark:border-slate-800">
              <Meta>
                {activeTab === "source"
                  ? `${source.split("\n").length} lines`
                  : activeTab === "review"
                    ? review
                      ? `Read ${formatReviewDate(review.createdAt)}`
                      : "Not reviewed"
                    : structuredDirty
                      ? "Unapplied edits"
                      : sourceOverridden
                        ? "Fields detached"
                        : "Fields drive the source"}
              </Meta>
              <Meta>
                {activeTab === "review" && review
                  ? `${reviewComments.length} notes`
                  : `${wordCount} words`}
              </Meta>
            </div>
          </section>

          <section className="hidden min-h-0 flex-1 flex-col bg-slate-100 lg:flex dark:bg-slate-900">
            <div className="flex h-[41px] shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <Meta>Preview</Meta>
              <Meta>{templateLabel}</Meta>
            </div>

            {renderError && (
              <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    aria-hidden
                    className="mt-px h-3.5 w-3.5 shrink-0 text-rose-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-rose-800 dark:text-rose-200">
                      This source did not compile. The preview below is the last
                      version that did.
                    </p>
                    <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-rose-700/90 dark:text-rose-300/90">
                      {renderError}
                    </pre>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {activeTab !== "source" && (
                        <button
                          type="button"
                          onClick={() => void switchTab("source")}
                          className="text-xs text-rose-800 underline decoration-rose-300 underline-offset-4 outline-none hover:decoration-rose-800 focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:text-rose-200 dark:decoration-rose-700"
                        >
                          Open source
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void render(source)}
                        className="text-xs text-rose-800 underline decoration-rose-300 underline-offset-4 outline-none hover:decoration-rose-800 focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:text-rose-200 dark:decoration-rose-700"
                      >
                        Try again
                      </button>
                      {sourceOverridden && (
                        <button
                          type="button"
                          onClick={() => void applyFields()}
                          disabled={isApplying}
                          className="text-xs text-rose-800 underline decoration-rose-300 underline-offset-4 outline-none hover:decoration-rose-800 focus-visible:ring-2 focus-visible:ring-rose-500/30 disabled:opacity-50 dark:text-rose-200 dark:decoration-rose-700"
                        >
                          Rebuild from fields
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="custom-scrollbar flex min-h-0 flex-1 flex-col items-center overflow-auto p-6 lg:p-10">
              {/* The marked-up page replaces the plain preview on the review
                  pane. Both stay mounted so neither has to re-render on a tab
                  change. */}
              <div
                className={cn(
                  "w-full max-w-[595px] flex-col items-center gap-4",
                  markedUpVisible ? "flex" : "hidden",
                )}
              >
                <div ref={reviewPdfRef} className="flex flex-col gap-4" />
                {isMarkingUp && (
                  <div className="flex flex-col items-center gap-2 py-16">
                    <Loader2
                      aria-hidden
                      className="h-4 w-4 animate-spin text-slate-300 dark:text-slate-700"
                    />
                    <Meta>Marking up the page</Meta>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "relative w-full max-w-[595px]",
                  markedUpVisible && "hidden",
                )}
              >
                <div
                  ref={previewRef}
                  className="typst-preview w-full shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.25)]"
                />
                {!hasPreview && (
                  <div className="flex aspect-[1/1.414] w-full flex-col items-center justify-center gap-2 border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <FileCode
                      aria-hidden
                      className="h-5 w-5 text-slate-300 dark:text-slate-700"
                    />
                    <Meta>Rendering</Meta>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
