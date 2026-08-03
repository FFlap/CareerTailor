import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PipelineSankey } from "@/components/PipelineSankey";
import SidebarLayout from "@/components/SidebarLayout";
import {
  EmptyState,
  Page,
  PageHeader,
  Panel,
  PanelHeader,
  Stat,
} from "@/components/ui/page";
import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
});

/** Model ids stay verbatim; human-facing keys get a light touch. */
function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/** Dark mode gets its own steps; the light ramp vanishes on a dark surface. */
const SANKEY_LIGHT = ["#334155", "#64748b", "#94a3b8", "#cbd5e1"];
const SANKEY_DARK = ["#e2e8f0", "#94a3b8", "#64748b", "#475569"];

/** Measures the panel so the SVG can be drawn at its real width. */
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

function percent(value: number) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

/** Dev-only sample so the page can be designed and reviewed without an account. */
const DEMO_STATS = {
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
    label: `W${i + 1}`,
    added: [2, 3, 3, 4, 4, 5, 4, 4, 4, 4, 3, 3][i],
  })),
  documentTrend: Array.from({ length: 12 }, (_, i) => ({
    resumes: [1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 1][i],
    coverLetters: [0, 1, 0, 1, 1, 2, 1, 1, 0, 1, 2, 1][i],
  })),
  staleJobs: 2,
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
};

function StatisticsPage() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
  }, []);

  if (demo) return <StatisticsBody stats={DEMO_STATS as any} />;

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
              title="Sign in to see your statistics"
              description="Your pipeline is private to your account."
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
        <StatisticsContent />
      </Authenticated>
    </>
  );
}

function StatisticsContent() {
  const stats = useQuery(api.stats.getMyStatistics, { weeks: 12 });
  return <StatisticsBody stats={stats as any} />;
}

function StatisticsBody({ stats }: { stats: any | undefined }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { ref: flowRef, width: flowWidth } = useElementWidth<HTMLDivElement>();

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const jobCounts = stats?.jobCounts ?? {
    total: 0,
    viewed: 0,
    applied: 0,
    interview: 0,
    accepted: 0,
    ghosted: 0,
  };
  const rates = stats?.jobRates ?? {
    appliedRate: 0,
    interviewRate: 0,
    acceptanceRate: 0,
    ghostRate: 0,
  };
  const docCounts = stats?.docCounts ?? {
    total: 0,
    resumes: 0,
    coverLetters: 0,
  };

  const applied =
    jobCounts.applied +
    jobCounts.interview +
    jobCounts.accepted +
    jobCounts.ghosted;
  const interviewed = jobCounts.interview + jobCounts.accepted;

  const trend = (stats?.jobTrend ?? []).map((bucket: any, index: number) => ({
    label: bucket.label,
    added: bucket.added,
    documents:
      (stats?.documentTrend?.[index]?.resumes ?? 0) +
      (stats?.documentTrend?.[index]?.coverLetters ?? 0),
  }));
  const hasTrend = trend.some(
    (bucket: any) => bucket.added > 0 || bucket.documents > 0,
  );

  // Statuses are exclusive, so the bands show how the tracked set divides
  // rather than movement recorded over time.
  const ramp = isDark ? SANKEY_DARK : SANKEY_LIGHT;
  const flowNodes = [
    { id: "tracked", name: "Tracked", color: ramp[0] },
    { id: "viewed", name: "Not applied", color: ramp[2] },
    { id: "applied", name: "Applied", color: ramp[1] },
    { id: "open", name: "Awaiting reply", color: ramp[2] },
    { id: "interview", name: "Interviewed", color: ramp[1] },
    { id: "ghosted", name: "Ghosted", color: ramp[3] },
    { id: "talking", name: "In process", color: ramp[2] },
    { id: "accepted", name: "Offer", color: ramp[0] },
  ];
  const flowLinks = [
    { source: "tracked", target: "viewed", value: jobCounts.viewed },
    { source: "tracked", target: "applied", value: applied },
    { source: "applied", target: "open", value: jobCounts.applied },
    { source: "applied", target: "interview", value: interviewed },
    { source: "applied", target: "ghosted", value: jobCounts.ghosted },
    { source: "interview", target: "talking", value: jobCounts.interview },
    { source: "interview", target: "accepted", value: jobCounts.accepted },
  ].filter((link) => Number.isFinite(link.value) && link.value > 0);
  const flowColumns = [
    ["tracked"],
    ["viewed", "applied"],
    ["open", "interview", "ghosted"],
    ["talking", "accepted"],
  ];

  const hasAnything = jobCounts.total > 0 || docCounts.total > 0;

  return (
    <SidebarLayout>
      <Page>
        <PageHeader
          title="Statistics"
          description="Where your applications stand, and what you have been producing, over the last twelve weeks."
          actions={
            <Link
              to="/job-applications"
              className="rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Applications
            </Link>
          }
        />

        {!hasAnything ? (
          <Panel>
            <EmptyState
              title="Nothing to measure yet"
              description="Track a job from the extension or generate a document, and this page fills in."
              action={
                <Link
                  to="/generate"
                  className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                >
                  Generate a document
                </Link>
              }
            />
          </Panel>
        ) : (
          <div className="space-y-4">
            {/* Headline figures: the four numbers worth knowing, with the
                conversion they imply sitting underneath. */}
            <Panel className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
              <Stat
                label="Jobs tracked"
                value={jobCounts.total}
                hint={
                  stats?.staleJobs
                    ? `${stats.staleJobs} untouched for 14 days`
                    : undefined
                }
              />
              <Stat
                label="Applied"
                value={applied}
                hint={`${percent(rates.appliedRate)} of tracked`}
              />
              <Stat
                label="Interviews"
                value={interviewed}
                hint={`${percent(rates.interviewRate)} of applications`}
              />
              <Stat
                label="Offers"
                value={jobCounts.accepted}
                hint={`${percent(rates.acceptanceRate)} of interviews`}
              />
            </Panel>

            <Panel>
              <PanelHeader
                title="Pipeline"
                meta={`Where ${jobCounts.total} tracked ${jobCounts.total === 1 ? "job" : "jobs"} stand now`}
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
                  <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                    Track a few jobs to see the split.
                  </p>
                )}

                {jobCounts.ghosted > 0 && (
                  <p className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {jobCounts.ghosted} ghosted — {percent(rates.ghostRate)} of
                    applications
                  </p>
                )}
              </div>
            </Panel>

            <div className="grid gap-4">
              <Panel>
                <PanelHeader title="Activity" meta="Per week" />
                <div className="p-5 pt-4">
                  {!hasTrend ? (
                    <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      No activity in this window yet.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 pb-3">
                        <LegendKey label="Jobs added" />
                        <LegendKey label="Documents" dashed />
                      </div>
                      <div className="h-[180px] w-full">
                        {mounted && (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={trend}
                              margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
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
                                cursor={{
                                  stroke: "#94a3b8",
                                  strokeDasharray: "3 3",
                                }}
                                contentStyle={{
                                  borderRadius: 8,
                                  border: "1px solid hsl(var(--border))",
                                  background: "hsl(var(--popover))",
                                  color: "hsl(var(--popover-foreground))",
                                  fontSize: 12,
                                  boxShadow: "none",
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="added"
                                name="Jobs added"
                                stroke="hsl(var(--foreground))"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="documents"
                                name="Documents"
                                stroke="hsl(var(--muted-foreground))"
                                strokeWidth={2}
                                strokeDasharray="4 3"
                                dot={false}
                                activeDot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <RankedPanel
                title="Templates"
                entries={stats?.docTop?.templates ?? []}
                format={(key: string) =>
                  key.startsWith("custom:")
                    ? "Custom template"
                    : titleCase(key.replace(/_/g, " "))
                }
              />
              <RankedPanel title="Tones" entries={stats?.docTop?.tones ?? []} />
            </div>

            <Panel className="flex flex-wrap items-center gap-x-10 gap-y-5 p-5">
              <Stat label="Documents made" value={docCounts.total} />
              <Stat label="Resumes" value={docCounts.resumes} />
              <Stat label="Cover letters" value={docCounts.coverLetters} />
            </Panel>
          </div>
        )}
      </Page>
    </SidebarLayout>
  );
}

function LegendKey({ label, dashed }: { label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span
        aria-hidden
        className={cn(
          "h-0 w-4 border-t-2",
          dashed
            ? "border-dashed border-slate-400"
            : "border-solid border-slate-900 dark:border-slate-100",
        )}
      />
      {label}
    </span>
  );
}

/** A short ranked list. Bars sit behind the text so the row stays one line. */
function RankedPanel({
  title,
  entries,
  format = (key: string) => key,
}: {
  title: string;
  entries: Array<{ key: string; count: number }>;
  format?: (key: string) => string;
}) {
  const max = Math.max(...entries.map((entry) => entry.count), 1);

  return (
    <Panel>
      <PanelHeader title={title} />
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Nothing generated yet.
        </p>
      ) : (
        <ul className="p-2">
          {entries.map((entry) => (
            <li key={entry.key} className="relative">
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-[3px] bg-slate-100 dark:bg-slate-800/70"
                style={{ width: `${(entry.count / max) * 100}%` }}
              />
              <div className="relative flex items-center justify-between gap-3 px-2 py-1.5">
                <span className="truncate text-[13px] text-slate-700 dark:text-slate-200">
                  {format(entry.key)}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-slate-500 dark:text-slate-400">
                  {entry.count}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
