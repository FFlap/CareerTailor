import { useUser } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PipelineSankey } from "@/components/PipelineSankey";
import SidebarLayout from "@/components/SidebarLayout";
import {
  BarList,
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
import type { ReactNode } from "react";

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

/** Dark mode gets its own steps; the light ramp vanishes on a dark surface. */
const SANKEY_LIGHT = ["#334155", "#64748b", "#94a3b8", "#cbd5e1"];
const SANKEY_DARK = ["#e2e8f0", "#94a3b8", "#64748b", "#475569"];
/** Mid-tone rose reads on both surfaces, so the loss needs no theme swap. */
const GHOSTED_BAND = "#fb7185";

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

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/** Board names are proper nouns; a bare hostname is already how it is written. */
const SOURCE_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  ziprecruiter: "ZipRecruiter",
  monster: "Monster",
  dice: "Dice",
  wellfound: "Wellfound",
  simplyhired: "SimplyHired",
  seek: "SEEK",
  extension: "Extension",
  manual: "Added by hand",
};

/** Four strengths of ink; a busy day should read as darker, not as a new hue. */
const HEAT_STEPS = [0, 0.28, 0.5, 0.75, 1] as const;

function heatStep(total: number) {
  if (total <= 0) return HEAT_STEPS[0];
  return HEAT_STEPS[Math.min(total, HEAT_STEPS.length - 1)];
}

function sourceLabel(key: string) {
  const known = SOURCE_LABEL[key.toLowerCase()];
  if (known) return known;
  return key.includes(".") ? key : titleCase(key);
}

function templateLabel(key: string) {
  if (key.startsWith("custom:")) return "Custom template";
  return titleCase(key.replace(/_/g, " ")).replace(/\bCv\b/g, "CV");
}

/** Measures the panel so the Sankey can be drawn at its real width. */
function useElementWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  const ref = useCallback((element: T | null) => setNode(element), []);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = () =>
      setWidth(Math.max(0, Math.round(node.getBoundingClientRect().width) - 32));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, width };
}

/** The Sankey paints with real colours, so it has to know which theme is on. */
function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function demoCalendar() {
  const day = 24 * 60 * 60 * 1000;
  const today = Math.floor(Date.now() / day);
  const days = Array.from({ length: 105 }, (_, index) => {
    const ts = (today - 104 + index) * day;
    const weekday = new Date(ts).getUTCDay();
    const rested = weekday === 0 || weekday === 6;
    const seed = (index * 7919) % 11;
    const total = rested || seed > 7 ? 0 : seed % 5;
    return { ts, jobs: Math.ceil(total / 2), documents: Math.floor(total / 2) };
  });

  // An unbroken tail, so the demo streak is never accidentally zero.
  for (let index = days.length - 6; index < days.length; index += 1) {
    days[index] = { ...days[index], jobs: Math.max(1, days[index].jobs) };
  }

  return {
    calendar: days,
    streak: {
      current: 6,
      best: 14,
      activeDays: days.filter((d) => d.jobs + d.documents > 0).length,
      totalDays: days.length,
    },
  };
}

/** Dev-only sample so the page can be designed and reviewed without an account. */
const DEMO = {
  stats: {
    jobCounts: {
      total: 42,
      viewed: 18,
      applied: 12,
      interview: 6,
      accepted: 3,
      ghosted: 3,
    },
    jobRates: {
      appliedRate: 24 / 42,
      interviewRate: 9 / 24,
      acceptanceRate: 3 / 9,
      ghostRate: 3 / 24,
    },
    jobTrend: Array.from({ length: 12 }, (_, i) => ({
      label: `Jun ${i + 1}`,
      added: [2, 3, 3, 4, 4, 5, 4, 4, 4, 4, 3, 3][i],
    })),
    documentTrend: Array.from({ length: 12 }, (_, i) => ({
      resumes: [1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 1][i],
      coverLetters: [0, 1, 0, 1, 1, 2, 1, 1, 0, 1, 2, 1][i],
    })),
    docCounts: { total: 28, resumes: 16, coverLetters: 12 },
    docTop: {
      templates: [
        { key: "basic_resume", count: 9 },
        { key: "modern_cv", count: 6 },
        { key: "modern_cv_cover", count: 5 },
        { key: "custom:example", count: 4 },
      ],
      tones: [
        { key: "Confident", count: 10 },
        { key: "Direct", count: 8 },
        { key: "Friendly", count: 6 },
      ],
    },
    companies: 31,
    untailored: 4,
    sources: [
      { key: "linkedin", count: 19 },
      { key: "indeed", count: 11 },
      { key: "greenhouse", count: 6 },
      { key: "careers.stripe.com", count: 4 },
      { key: "manual", count: 2 },
    ],
    thisWeek: { jobs: 5, prevJobs: 3, documents: 4, prevDocuments: 6 },
    ...demoCalendar(),
  },
  jobs: [
    ["Staff Frontend Engineer", "Figma", "interview"],
    ["Design Engineer", "Linear", "applied"],
    ["Senior Product Engineer", "Vercel", "applied"],
    ["Frontend Platform Engineer", "Stripe", "accepted"],
    ["UI Engineer", "Notion", "viewed"],
    ["Web Engineer", "Cloudflare", "ghosted"],
    ["Product Engineer", "Retool", "viewed"],
    ["Frontend Engineer", "Ramp", "applied"],
  ].map(([title, company, status], i) => ({
    _id: `job-${i}`,
    title,
    company,
    status,
    url: "https://example.com",
    addedAt: Date.now() - i * 86_400_000,
  })),
  documents: [
    ["Staff Frontend Engineer", "Figma", "resume"],
    ["Design Engineer", "Linear", "cover_letter"],
    ["Senior Product Engineer", "Vercel", "resume"],
    ["Frontend Platform Engineer", "Stripe", "cover_letter"],
    ["UI Engineer", "Notion", "resume"],
    ["Frontend Engineer", "Ramp", "resume"],
  ].map(([title, company, type], i) => ({
    _id: `doc-${i}`,
    type,
    job: { title, company },
    updatedAt: Date.now() - i * 43_200_000,
  })),
};

function DashboardPage() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
  }, []);

  if (demo) {
    return (
      <DashboardBody
        stats={DEMO.stats}
        jobs={DEMO.jobs}
        documents={DEMO.documents}
      />
    );
  }

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
  // Read once: the server buckets days by this, so it must be stable per render.
  const [tzOffsetMinutes] = useState(() => new Date().getTimezoneOffset());
  const stats = useQuery(api.stats.getMyStatistics, {
    weeks: 12,
    tzOffsetMinutes,
  });
  const jobs = useQuery(api.jobs.listMyJobs, { limit: 50 });
  const documents = useQuery(api.documents.listMyRecentDocuments, { limit: 6 });
  const setJobStatus = useMutation(api.jobs.setJobStatus);

  return (
    <DashboardBody
      stats={stats as any}
      jobs={jobs as any}
      documents={documents as any}
      onStatusChange={(jobId, status) =>
        setJobStatus({ jobId: jobId as Id<"jobs">, status })
      }
    />
  );
}

function DashboardBody({
  stats,
  jobs,
  documents,
  onStatusChange,
}: {
  stats: any | undefined;
  jobs: any[] | undefined;
  documents: any[] | undefined;
  onStatusChange?: (jobId: string, status: JobStatus) => void;
}) {
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const isDark = useIsDark();
  const { ref: flowRef, width: flowWidth } = useElementWidth<HTMLDivElement>();

  useEffect(() => setMounted(true), []);

  const counts = stats?.jobCounts ?? {
    total: 0,
    viewed: 0,
    applied: 0,
    interview: 0,
    accepted: 0,
    ghosted: 0,
  };
  const docCounts = stats?.docCounts ?? {
    total: 0,
    resumes: 0,
    coverLetters: 0,
  };
  const week = stats?.thisWeek ?? { jobs: 0, documents: 0 };
  const sources: { key: string; count: number }[] = stats?.sources ?? [];
  const calendar: { ts: number; jobs: number; documents: number }[] =
    stats?.calendar ?? [];
  const streak = stats?.streak ?? {
    current: 0,
    best: 0,
    activeDays: 0,
    totalDays: 0,
  };

  const applied =
    counts.applied + counts.interview + counts.accepted + counts.ghosted;
  const interviewed = counts.interview + counts.accepted;

  // Statuses are exclusive, so the bands divide the set rather than track movement.
  const ramp = isDark ? SANKEY_DARK : SANKEY_LIGHT;
  const flowNodes = [
    { id: "tracked", name: "Tracked", color: ramp[0] },
    { id: "viewed", name: "Not applied", color: ramp[2] },
    { id: "applied", name: "Applied", color: ramp[1] },
    { id: "open", name: "Awaiting reply", color: ramp[2] },
    { id: "interview", name: "Interviewed", color: ramp[1] },
    { id: "ghosted", name: "Ghosted", color: GHOSTED_BAND },
    { id: "talking", name: "In process", color: ramp[2] },
    { id: "accepted", name: "Offer", color: ramp[0] },
  ];
  const flowLinks = [
    { source: "tracked", target: "viewed", value: counts.viewed },
    { source: "tracked", target: "applied", value: applied },
    { source: "applied", target: "open", value: counts.applied },
    { source: "applied", target: "interview", value: interviewed },
    { source: "applied", target: "ghosted", value: counts.ghosted },
    { source: "interview", target: "talking", value: counts.interview },
    { source: "interview", target: "accepted", value: counts.accepted },
  ].filter((link) => Number.isFinite(link.value) && link.value > 0);
  const flowColumns = [
    ["tracked"],
    ["viewed", "applied"],
    ["open", "interview", "ghosted"],
    ["talking", "accepted"],
  ];

  const trend = (stats?.jobTrend ?? []).map((bucket: any, index: number) => ({
    label: bucket.label,
    jobs: bucket.added,
    documents:
      (stats?.documentTrend?.[index]?.resumes ?? 0) +
      (stats?.documentTrend?.[index]?.coverLetters ?? 0),
  }));
  const hasTrend = trend.some(
    (bucket: any) => bucket.jobs > 0 || bucket.documents > 0,
  );

  const loading = stats === undefined;
  const templates = stats?.docTop?.templates ?? [];
  const tones = stats?.docTop?.tones ?? [];

  return (
    <SidebarLayout>
      <Page>
        <PageHeader
          title={user?.firstName ? `Hello, ${user.firstName}` : "Your desk"}
          description={
            loading
              ? undefined
              : counts.total === 0 && docCounts.total === 0
                ? "Nothing tracked yet — add a job from the extension, or start one by hand."
                : `This week: ${week.jobs} ${week.jobs === 1 ? "job" : "jobs"} tracked, ${week.documents} ${week.documents === 1 ? "document" : "documents"} written.`
          }
          actions={
            <>
              <Link
                to="/job-applications"
                className="rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Applications
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
          {/* Hairlines come from the grid gap, which survives any wrap. */}
          <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-slate-200 sm:grid-cols-4 dark:bg-slate-800">
            <Cell
              label="Applied"
              value={applied}
              hint={`of ${counts.total} tracked`}
            />
            <Cell
              label="Interviewed"
              value={interviewed}
              hint={`of ${applied} ${applied === 1 ? "application" : "applications"}`}
            />
            <Cell
              label="Offered"
              value={counts.accepted}
              hint={`of ${interviewed} ${interviewed === 1 ? "interview" : "interviews"}`}
            />
            <Cell
              label="Ghosted"
              value={counts.ghosted}
              hint={`of ${applied} ${applied === 1 ? "application" : "applications"}`}
              tone={counts.ghosted > 0 ? "loss" : undefined}
            />
          </Panel>

          <Panel>
            <PanelHeader
              title="Pipeline"
              meta={
                counts.total > 0
                  ? `${counts.total} ${counts.total === 1 ? "job" : "jobs"} · ${stats.companies} ${stats.companies === 1 ? "company" : "companies"}`
                  : undefined
              }
            />
            <div ref={flowRef} className="p-4">
              {mounted && flowWidth > 0 && flowLinks.length > 0 ? (
                <PipelineSankey
                  width={flowWidth}
                  height={300}
                  nodes={flowNodes}
                  links={flowLinks}
                  nodeColumns={flowColumns}
                />
              ) : (
                <p className="py-24 text-center text-sm text-slate-400 dark:text-slate-500">
                  Track a few jobs to see where they stand.
                </p>
              )}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="min-w-0 lg:col-span-2">
              <PanelHeader
                title="Activity"
                meta={
                  <span className="hidden sm:inline">Per week</span>
                }
                actions={
                  <div className="flex items-center gap-4">
                    <Swatch opacity={0.75}>Jobs tracked</Swatch>
                    <Swatch opacity={0.22}>Documents written</Swatch>
                  </div>
                }
              />
              <div className="px-4 pb-4 pt-4">
                <div className="h-[212px] w-full text-slate-900 dark:text-slate-100">
                  {mounted && !hasTrend && (
                    <p className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                      No activity in the last twelve weeks.
                    </p>
                  )}
                  {mounted && hasTrend && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={trend}
                        margin={{ top: 4, right: 4, bottom: 0, left: -26 }}
                        barCategoryGap="26%"
                        barGap={2}
                      >
                        <CartesianGrid
                          vertical={false}
                          stroke="currentColor"
                          className="text-slate-200 dark:text-slate-800"
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "currentColor" }}
                          className="text-slate-400"
                          interval="preserveStartEnd"
                          minTickGap={16}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                          tick={{ fontSize: 11, fill: "currentColor" }}
                          className="text-slate-400"
                        />
                        <Tooltip
                          cursor={{ fill: "currentColor", opacity: 0.05 }}
                          content={<WeekTooltip />}
                        />
                        <Bar
                          dataKey="jobs"
                          name="Jobs tracked"
                          fill="currentColor"
                          fillOpacity={0.75}
                          radius={[2, 2, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="documents"
                          name="Documents written"
                          fill="currentColor"
                          fillOpacity={0.22}
                          radius={[2, 2, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </Panel>

            <Panel className="min-w-0">
              <PanelHeader title="Streak" meta="Last 15 weeks" />
              <div className="flex items-baseline gap-7 px-4 pt-3.5">
                <Figure
                  value={streak.current}
                  label={streak.current === 1 ? "day running" : "days running"}
                />
                <Figure value={streak.best} label="best run" muted />
              </div>
              <div className="px-4 pb-4 pt-3.5">
                <Heatmap days={calendar} />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                <span className="tabular-nums">
                  {streak.activeDays} of {streak.totalDays} days worked
                </span>
                <span className="flex items-center gap-1 text-slate-900 dark:text-slate-100">
                  <span className="mr-0.5 text-slate-400 dark:text-slate-500">
                    Less
                  </span>
                  {HEAT_STEPS.map((step, index) => (
                    <span
                      key={index}
                      aria-hidden
                      className={cn(
                        "h-2.5 w-2.5 rounded-[2px]",
                        step === 0
                          ? "bg-slate-100 dark:bg-slate-800"
                          : "bg-current",
                      )}
                      style={step === 0 ? undefined : { opacity: step }}
                    />
                  ))}
                  <span className="ml-0.5 text-slate-400 dark:text-slate-500">
                    More
                  </span>
                </span>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="min-w-0 lg:col-span-2">
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
                  className="py-10"
                  title="No jobs tracked"
                  description="The browser extension adds jobs as you browse. You can also paste one into Generate."
                />
              ) : (
                <ul>
                  {jobs.slice(0, 8).map((job: any) => {
                    const status = (job.status ?? "viewed") as JobStatus;
                    const addedAt =
                      job.addedAt ?? job.createdAt ?? job.lastSeenAt;
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
                            onStatusChange?.(
                              job._id,
                              event.target.value as JobStatus,
                            )
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

            <Panel className="min-w-0">
              <PanelHeader
                title="Recent documents"
                actions={
                  <Link
                    to="/gallery"
                    className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    All
                  </Link>
                }
              />
              {documents === undefined ? (
                <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
              ) : documents.length === 0 ? (
                <EmptyState
                  className="py-10"
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
                        {formatDate(doc.updatedAt ?? doc.createdAt)}
                      </span>
                    </Row>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* One panel divided by hairlines, not three chasing each other. */}
          <Panel className="overflow-hidden">
            <PanelHeader title="Breakdown" meta="All time" />
            <div className="grid gap-px bg-slate-200 sm:grid-cols-3 dark:bg-slate-800">
              <div className="bg-white py-3 dark:bg-slate-900">
                <Caption>
                  Job sites
                  {sources.length > 0 && (
                    <span className="ml-1.5 tabular-nums">{sources.length}</span>
                  )}
                </Caption>
                {sources.length === 0 ? (
                  <Nothing>No jobs tracked yet.</Nothing>
                ) : (
                  // Scrolls, so a long tail of career pages cannot stretch the row.
                  <div className="custom-scrollbar max-h-[11rem] overflow-y-auto">
                    <BarList entries={sources} format={sourceLabel} />
                  </div>
                )}
              </div>
              <div className="bg-white py-3 dark:bg-slate-900">
                <Caption>Templates</Caption>
                {templates.length === 0 ? (
                  <Nothing />
                ) : (
                  <BarList entries={templates} format={templateLabel} />
                )}
              </div>
              <div className="bg-white py-3 dark:bg-slate-900">
                <Caption>Tones</Caption>
                {tones.length === 0 ? <Nothing /> : <BarList entries={tones} />}
              </div>
            </div>
            {!loading && stats?.untailored > 0 && (
              <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {stats.untailored}{" "}
                {stats.untailored === 1
                  ? "application went"
                  : "applications went"}{" "}
                out without a tailored document.
              </p>
            )}
          </Panel>
        </div>
      </Page>
    </SidebarLayout>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "loss";
}) {
  return (
    <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
      <div
        className={cn(
          "text-[26px] font-semibold leading-none tabular-nums tracking-tight",
          tone === "loss"
            ? "text-rose-600 dark:text-rose-400"
            : "text-slate-900 dark:text-slate-50",
        )}
      >
        {value}
      </div>
      <div className="mt-2 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </div>
      {hint && (
        <div className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {hint}
        </div>
      )}
    </div>
  );
}

/** Names a group inside a panel without pretending to be a second header. */
function Caption({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-4 text-[11px] font-medium text-slate-400 dark:text-slate-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

function Nothing({ children }: { children?: ReactNode }) {
  return (
    <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500">
      {children ?? "Nothing generated yet."}
    </p>
  );
}

function Swatch({
  children,
  opacity = 1,
}: {
  children: ReactNode;
  opacity?: number;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-[2px] bg-current text-slate-900 dark:text-slate-100"
        style={{ opacity }}
      />
      {children}
    </span>
  );
}

/** Like Cell, but sized for figures read as a pair rather than a rail. */
function Figure({
  value,
  label,
  muted,
}: {
  value: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "text-[26px] font-semibold leading-none tabular-nums tracking-tight",
          muted
            ? "text-slate-400 dark:text-slate-500"
            : "text-slate-900 dark:text-slate-50",
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}

/** A day is worked if a job was tracked or a document written on it. */
function Heatmap({
  days,
}: {
  days: { ts: number; jobs: number; documents: number }[];
}) {
  if (days.length === 0) return null;

  // The first column has to start on a Sunday for the rows to mean weekdays.
  const lead = new Date(days[0].ts).getUTCDay();

  return (
    <div className="flex gap-1.5 text-slate-900 dark:text-slate-100">
      <div className="grid grid-rows-7 gap-[3px] text-[9px] leading-none text-slate-400 dark:text-slate-500">
        {["", "M", "", "W", "", "F", ""].map((day, index) => (
          <span key={index} className="flex items-center">
            {day}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]">
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} aria-hidden />
        ))}
        {days.map((day) => {
          const total = day.jobs + day.documents;
          const step = heatStep(total);
          const date = new Date(day.ts);
          return (
            <span
              key={day.ts}
              title={`${date.toLocaleDateString(undefined, {
                timeZone: "UTC",
                month: "short",
                day: "numeric",
              })} — ${describeDay(day.jobs, day.documents)}`}
              className={cn(
                "aspect-square rounded-[2px]",
                step === 0 ? "bg-slate-100 dark:bg-slate-800" : "bg-current",
              )}
              style={step === 0 ? undefined : { opacity: step }}
            />
          );
        })}
      </div>
    </div>
  );
}

function describeDay(jobs: number, documents: number) {
  const parts = [];
  if (jobs) parts.push(`${jobs} ${jobs === 1 ? "job" : "jobs"}`);
  if (documents)
    parts.push(`${documents} ${documents === 1 ? "document" : "documents"}`);
  return parts.length ? parts.join(", ") : "nothing";
}

/** The default tooltip is a card; this one keeps the page's hairline grammar. */
function WeekTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-1.5 font-medium text-slate-900 dark:text-slate-100">
        Week of {label}
      </div>
      <ul className="space-y-0.5">
        {payload.map((entry: any) => (
          <li
            key={entry.dataKey}
            className="flex items-center justify-between gap-6 text-slate-500 dark:text-slate-400"
          >
            <span>{entry.name}</span>
            <span className="tabular-nums text-slate-900 dark:text-slate-100">
              {entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
