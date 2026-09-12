import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import { api } from "@/lib/convex";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { JOBS_ARGS } from "@/lib/warmQueries";
import SidebarLayout from "@/components/SidebarLayout";
import {
  JOB_STAGES,
  JobList,
  JobListHeader,
  JobRow,
  jobStatusOf,
  type SelectableJobStatus,
  type JobStatus,
} from "@/components/JobList";
import { EmptyState, Page, PageHeader, Panel } from "@/components/ui/page";
import { Pagination, usePagination } from "@/components/ui/pagination";
import {
  ApplicationsSkeleton,
  JobListSkeleton,
} from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type JobStatusFilter = JobStatus | "all";

const NOTE_LIMIT = 2000;

export const Route = createFileRoute("/job-applications")({
  component: JobApplicationsPage,
});

function JobApplicationsPage() {
  return (
    <>
      <AuthLoading>
        <SidebarLayout>
          <ApplicationsSkeleton />
        </SidebarLayout>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">
              Access Denied
            </h1>
            <p className="mb-6 text-slate-600 dark:text-slate-400">
              You need to{" "}
              <Link to="/sign-in" className="text-primary hover:underline">
                sign in
              </Link>{" "}
              to view this page.
            </p>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <JobApplicationsContent />
      </Authenticated>
    </>
  );
}

/**
 * Filtering and the shape of the pipeline are the same gesture: the counts are
 * the distribution, and clicking one narrows to it.
 */
function StageTab({
  label,
  count,
  dot,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
        active
          ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-50"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
      )}
    >
      {dot && (
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      )}
      {label}
      <span
        className={cn(
          "tabular-nums text-[11px]",
          active
            ? "text-slate-500 dark:text-slate-400"
            : "text-slate-400 dark:text-slate-600",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Both dialogs here are the same object: a hairline panel, a title that says
 * what it is, and the actions sitting on a footer rule. Escape and the backdrop
 * both close it, so nothing traps you mid-edit.
 */
function Modal({
  title,
  subtitle,
  width,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  width: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900",
          width,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function JobApplicationsContent() {
  const jobs = useQuery(api.jobs.listMyJobs, JOBS_ARGS);
  const setJobStatus = useMutation(api.jobs.setJobStatus);
  const setJobNotes = useMutation(api.jobs.setJobNotes);
  const upsertJob = useMutation(api.jobs.upsertMyJob);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [noteJob, setNoteJob] = useState<any | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    company: "",
    url: "",
    description: "",
  });

  // Search narrows first, so the stage counts describe what the search found.
  const searched = useMemo(() => {
    if (!jobs) return [];
    const search = query.trim().toLowerCase();
    if (!search) return jobs;
    return jobs.filter((job: any) => {
      const title = (job.title ?? "").toLowerCase();
      const company = (job.company ?? "").toLowerCase();
      const notes = (job.notes ?? "").toLowerCase();
      return (
        title.includes(search) ||
        company.includes(search) ||
        notes.includes(search)
      );
    });
  }, [jobs, query]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: searched.length };
    for (const stage of JOB_STAGES) counts[stage.value] = 0;
    for (const job of searched) counts[jobStatusOf(job)] += 1;
    return counts;
  }, [searched]);

  const filteredJobs = useMemo(
    () =>
      statusFilter === "all"
        ? searched
        : searched.filter((job: any) => jobStatusOf(job) === statusFilter),
    [searched, statusFilter],
  );

  const paged = usePagination(filteredJobs, {
    resetKey: `${statusFilter}:${query.trim()}`,
  });

  async function updateJobStatus(jobId: string, status: SelectableJobStatus) {
    await setJobStatus({ jobId: jobId as Id<"jobs">, status });
  }

  function openNoteEditor(job: any) {
    setNoteJob(job);
    setNoteDraft(job.notes ?? "");
    setNoteError(null);
  }

  function closeNoteEditor() {
    if (isNoteSaving) return;
    setNoteJob(null);
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteJob) return;
    setNoteError(null);
    try {
      setIsNoteSaving(true);
      await setJobNotes({
        jobId: noteJob._id as Id<"jobs">,
        notes: noteDraft,
      });
      setNoteJob(null);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Failed to save note.");
    } finally {
      setIsNoteSaving(false);
    }
  }

  function openCreateModal() {
    setDraft({ title: "", company: "", url: "", description: "" });
    setFormError(null);
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    if (isSaving) return;
    setIsCreateOpen(false);
  }

  async function submitManualJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const title = draft.title.trim();
    const company = draft.company.trim();
    const url = draft.url.trim();
    const description = draft.description.trim();

    if (!title || !company || !url) {
      setFormError("Title, company, and job URL are required.");
      return;
    }

    try {
      setIsSaving(true);
      await upsertJob({
        title,
        company,
        url,
        description,
        source: "manual",
      });
      setIsCreateOpen(false);
      setDraft({ title: "", company: "", url: "", description: "" });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save job.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const canSubmit = Boolean(
    draft.title.trim() && draft.company.trim() && draft.url.trim(),
  );

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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <div
              role="group"
              aria-label="Filter by stage"
              className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5"
            >
              <StageTab
                label="All"
                count={stageCounts.all}
                active={statusFilter === "all"}
                onSelect={() => setStatusFilter("all")}
              />
              {JOB_STAGES.map((stage) => (
                <StageTab
                  key={stage.value}
                  label={stage.label}
                  dot={stage.dot}
                  count={stageCounts[stage.value]}
                  active={statusFilter === stage.value}
                  onSelect={() => setStatusFilter(stage.value)}
                />
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Role, company, or notes"
                aria-label="Search jobs by role, company, or notes"
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-7 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <JobList>
            {jobs === undefined ? (
              <JobListSkeleton rows={6} />
            ) : filteredJobs.length === 0 ? (
              <EmptyState
                title={
                  jobs.length === 0
                    ? "No jobs tracked yet"
                    : query.trim()
                      ? `Nothing matches “${query.trim()}”`
                      : "Nothing at this stage"
                }
                description={
                  jobs.length === 0
                    ? "The browser extension adds jobs as you browse. You can also add one by hand."
                    : query.trim()
                      ? "Search covers role, company, and notes."
                      : statusFilter === "needs_update"
                        ? "Applied jobs move here automatically after one month without a stage change."
                        : "Move a job here from its stage menu, or look at another stage."
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
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setStatusFilter("all");
                      }}
                      className="rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Show all {jobs.length}
                    </button>
                  )
                }
              />
            ) : (
              <>
                <JobListHeader showNotes />
                <ul>
                  {paged.pageItems.map((job: any) => (
                    <JobRow
                      key={job._id}
                      job={job}
                      onStatusChange={updateJobStatus}
                      onNotesClick={openNoteEditor}
                    />
                  ))}
                </ul>
                <Pagination
                  page={paged.page}
                  pageCount={paged.pageCount}
                  from={paged.from}
                  to={paged.to}
                  total={paged.total}
                  noun="job"
                  onPage={paged.setPage}
                />
              </>
            )}
          </JobList>
        </Panel>
      </Page>

      {noteJob && (
        <Modal
          title={noteJob.notes ? "Edit note" : "Add a note"}
          subtitle={`${noteJob.title} · ${noteJob.company || "Company not listed"}`}
          width="max-w-lg"
          onClose={closeNoteEditor}
          footer={
            <>
              {noteJob.notes && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNoteDraft("")}
                  disabled={isNoteSaving || !noteDraft}
                  className="mr-auto text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                >
                  Clear
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={closeNoteEditor}
                disabled={isNoteSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="job-note-form"
                disabled={isNoteSaving}
              >
                {isNoteSaving ? "Saving…" : "Save note"}
              </Button>
            </>
          }
        >
          <form id="job-note-form" onSubmit={saveNote} className="p-5">
            <Label htmlFor="job-note-input" className="sr-only">
              Note
            </Label>
            <Textarea
              id="job-note-input"
              autoFocus
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Interview details, contact names, next steps, or anything worth remembering…"
              maxLength={NOTE_LIMIT}
              rows={8}
              className="resize-none leading-relaxed"
            />
            {/* A counter at 0 of 2,000 is noise; near the ceiling it is news. */}
            {noteDraft.length > NOTE_LIMIT * 0.8 && (
              <p className="mt-2 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                {(NOTE_LIMIT - noteDraft.length).toLocaleString()} characters
                left
              </p>
            )}
            {noteError && (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                {noteError}
              </p>
            )}
          </form>
        </Modal>
      )}

      {isCreateOpen && (
        <Modal
          title="Add a job"
          subtitle="For roles the extension did not catch."
          width="max-w-xl"
          onClose={closeCreateModal}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={closeCreateModal}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="manual-job-form"
                disabled={isSaving || !canSubmit}
              >
                {isSaving ? "Saving…" : "Save job"}
              </Button>
            </>
          }
        >
          <form
            id="manual-job-form"
            onSubmit={submitManualJob}
            className="space-y-4 p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-job-title-input">Title</Label>
                <Input
                  id="manual-job-title-input"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Senior Product Designer"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-job-company-input">Company</Label>
                <Input
                  id="manual-job-company-input"
                  value={draft.company}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      company: event.target.value,
                    }))
                  }
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
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, url: event.target.value }))
                }
                placeholder="https://company.com/careers/123"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-job-description-input">Description</Label>
              <Textarea
                id="manual-job-description-input"
                value={draft.description}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
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
        </Modal>
      )}

    </SidebarLayout>
  );
}
