import { useUser } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";

import SidebarLayout from "@/components/SidebarLayout";
import {
  EmptyState,
  Page,
  PageHeader,
  Panel,
  PanelHeader,
  Row,
} from "@/components/ui/page";
import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";

import type { Id } from "../../convex/_generated/dataModel";

type JobStatus = "viewed" | "applied" | "interview" | "accepted" | "ghosted";

const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "viewed", label: "Viewed" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "accepted", label: "Accepted" },
  { value: "ghosted", label: "Ghosted" },
];

/** Status is carried by a dot, so the row stays quiet until you read it. */
const STATUS_DOT: Record<JobStatus, string> = {
  viewed: "bg-slate-300 dark:bg-slate-600",
  applied: "bg-slate-500",
  interview: "bg-amber-500",
  accepted: "bg-emerald-500",
  ghosted: "bg-rose-400",
};

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function formatDate(value: unknown) {
  if (typeof value !== "number") return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function DashboardPage() {
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
              title="Sign in to see your work"
              description="Documents and tracked jobs live with your account."
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
        <DashboardContent />
      </Authenticated>
    </>
  );
}

function DashboardContent() {
  const { user } = useUser();
  const jobs = useQuery(api.jobs.listMyJobs, { limit: 50 });
  const documents = useQuery(api.documents.listMyRecentDocuments, { limit: 6 });
  const setJobStatus = useMutation(api.jobs.setJobStatus);

  const openJobs = (jobs ?? []).filter(
    (job: any) => (job.status ?? "viewed") !== "ghosted",
  ).length;

  return (
    <SidebarLayout>
      <Page>
        <PageHeader
          title={user?.firstName ? `Hello, ${user.firstName}` : "Your desk"}
          description={
            jobs === undefined
              ? undefined
              : jobs.length === 0
                ? "Nothing tracked yet — add a job from the extension, or start one by hand."
                : `${openJobs} job${openJobs === 1 ? "" : "s"} still open.`
          }
          actions={
            <>
              <Link
                to="/profile"
                className="rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Profile
              </Link>
              <Link
                to="/generate"
                className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                New document
              </Link>
            </>
          }
        />

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Recent documents"
              actions={
                <Link
                  to="/gallery"
                  className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  All documents
                </Link>
              }
            />
            {documents === undefined ? (
              <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
            ) : documents.length === 0 ? (
              <EmptyState
                title="No documents yet"
                description="Generate a resume or cover letter for a job you are chasing."
                action={
                  <Link
                    to="/generate"
                    className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Generate
                  </Link>
                }
              />
            ) : (
              <ul>
                {documents.map((doc: any) => (
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
                          doc.type === "cover_letter" ? "Cover letter" : "Resume",
                          doc.job?.company,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {formatDate(doc.updatedAt ?? doc.createdAt)}
                    </span>
                  </Row>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Tracked jobs"
              meta={jobs?.length ? `${jobs.length}` : undefined}
              actions={
                <Link
                  to="/job-applications"
                  className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  All jobs
                </Link>
              }
            />
            {jobs === undefined ? (
              <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
            ) : jobs.length === 0 ? (
              <EmptyState
                title="No jobs tracked"
                description="The browser extension adds jobs as you browse. You can also paste one into Generate."
              />
            ) : (
              <ul>
                {jobs.slice(0, 8).map((job: any) => {
                  const status = (job.status ?? "viewed") as JobStatus;
                  const addedAt = job.addedAt ?? job.createdAt ?? job.lastSeenAt;
                  return (
                    <Row as="li" key={job._id}>
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          STATUS_DOT[status],
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        {job.url ? (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="block truncate text-[13px] font-medium text-slate-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-100"
                          >
                            {job.title}
                          </a>
                        ) : (
                          <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                            {job.title}
                          </span>
                        )}
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                          {job.company}
                        </span>
                      </div>

                      <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:block dark:text-slate-500">
                        {formatDate(addedAt)}
                      </span>

                      <select
                        aria-label={`Status for ${job.title}`}
                        value={status}
                        onChange={(event) =>
                          setJobStatus({
                            jobId: job._id as Id<"jobs">,
                            status: event.target.value as JobStatus,
                          })
                        }
                        className="h-7 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-600 outline-none focus-visible:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {JOB_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

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
                        className="shrink-0 rounded px-2 py-1 text-xs text-slate-500 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 group-hover/row:opacity-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      >
                        Generate
                      </Link>
                    </Row>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </Page>
    </SidebarLayout>
  );
}
