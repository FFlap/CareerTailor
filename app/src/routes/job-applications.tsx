import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import { api } from "@/lib/convex";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import SidebarLayout from "@/components/SidebarLayout";
import {
  JOB_STAGES,
  JobList,
  JobListHeader,
  JobListSkeleton,
  JobRow,
  jobStatusOf,
  type JobStatus,
} from "@/components/JobList";
import { EmptyState, Page, PageHeader, Panel } from "@/components/ui/page";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type JobStatusFilter = JobStatus | "all";

export const Route = createFileRoute("/job-applications")({
  component: JobApplicationsPage,
});

function JobApplicationsPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading...
          </p>
        </div>
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

function JobApplicationsContent() {
  const jobs = useQuery(api.jobs.listMyJobs, { limit: 100 });
  const setJobStatus = useMutation(api.jobs.setJobStatus);
  const upsertJob = useMutation(api.jobs.upsertMyJob);
  const canUseDom = typeof document !== "undefined";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
      return title.includes(search) || company.includes(search);
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

  async function updateJobStatus(jobId: string, status: JobStatus) {
    await setJobStatus({ jobId: jobId as Id<"jobs">, status });
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
                placeholder="Role or company"
                aria-label="Search jobs by role or company"
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
                      ? "Search covers role and company names."
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
                <JobListHeader />
                <ul>
                  {paged.pageItems.map((job: any) => (
                    <JobRow
                      key={job._id}
                      job={job}
                      onStatusChange={updateJobStatus}
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

      {isCreateOpen &&
        canUseDom &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 px-4 py-8"
            onClick={closeCreateModal}
          >
            <div
              className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="manual-job-title"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
                <div>
                  <h2
                    id="manual-job-title"
                    className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
                  >
                    Add a job
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    For roles the extension did not catch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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
                        setDraft((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
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
                  <Label htmlFor="manual-job-description-input">
                    Description
                  </Label>
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
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
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
                  {isSaving ? "Saving..." : "Save job"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </SidebarLayout>
  );
}
