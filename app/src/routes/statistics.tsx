import { createFileRoute, Link } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '@/lib/convex'
import SidebarLayout from '@/components/SidebarLayout'
import { PipelineSankey } from '@/components/PipelineSankey'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/statistics')({
  component: StatisticsPage,
})

const STATUS_COLORS = {
  viewed: '#94a3b8',
  applied: '#3b82f6',
  interview: '#f59e0b',
  accepted: '#10b981',
  ghosted: '#f43f5e',
}

const CHART_GRID_STROKE = '#e2e8f0'

function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const ref = useCallback((element: T | null) => {
    setNode(element)
  }, [])

  useEffect(() => {
    const el = node
    if (!el) return

    function updateFromElement(element: HTMLElement) {
      const rect = element.getBoundingClientRect()
      const width = Math.max(0, Math.round(rect.width))
      const height = Math.max(0, Math.round(rect.height))
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }

    updateFromElement(el)

    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement
        updateFromElement(target)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [node])

  return { ref, size }
}

const DEMO_STATS = {
  jobCounts: { total: 42, viewed: 18, applied: 12, interview: 6, accepted: 3, ghosted: 3 },
  jobRates: {
    appliedRate: (12 + 6 + 3 + 3) / 42,
    interviewRate: (6 + 3) / (12 + 6 + 3 + 3),
    acceptanceRate: 3 / (6 + 3),
    ghostRate: 3 / (12 + 6 + 3 + 3),
  },
  jobTrend: [
    { label: 'W1', viewed: 1, applied: 1, interview: 0, accepted: 0, ghosted: 0, added: 2 },
    { label: 'W2', viewed: 2, applied: 1, interview: 0, accepted: 0, ghosted: 0, added: 3 },
    { label: 'W3', viewed: 1, applied: 2, interview: 0, accepted: 0, ghosted: 0, added: 3 },
    { label: 'W4', viewed: 2, applied: 1, interview: 1, accepted: 0, ghosted: 0, added: 4 },
    { label: 'W5', viewed: 1, applied: 2, interview: 1, accepted: 0, ghosted: 0, added: 4 },
    { label: 'W6', viewed: 2, applied: 1, interview: 1, accepted: 0, ghosted: 1, added: 5 },
    { label: 'W7', viewed: 1, applied: 1, interview: 1, accepted: 1, ghosted: 0, added: 4 },
    { label: 'W8', viewed: 2, applied: 1, interview: 0, accepted: 1, ghosted: 0, added: 4 },
    { label: 'W9', viewed: 2, applied: 1, interview: 1, accepted: 0, ghosted: 0, added: 4 },
    { label: 'W10', viewed: 2, applied: 0, interview: 1, accepted: 0, ghosted: 1, added: 4 },
    { label: 'W11', viewed: 1, applied: 1, interview: 0, accepted: 1, ghosted: 0, added: 3 },
    { label: 'W12', viewed: 1, applied: 1, interview: 0, accepted: 0, ghosted: 1, added: 3 },
  ],
  staleJobs: 2,
  docCounts: { total: 28, resumes: 16, coverLetters: 12 },
  documentTrend: [
    { label: 'W1', resumes: 1, coverLetters: 0 },
    { label: 'W2', resumes: 1, coverLetters: 1 },
    { label: 'W3', resumes: 2, coverLetters: 0 },
    { label: 'W4', resumes: 1, coverLetters: 1 },
    { label: 'W5', resumes: 2, coverLetters: 1 },
    { label: 'W6', resumes: 1, coverLetters: 2 },
    { label: 'W7', resumes: 2, coverLetters: 1 },
    { label: 'W8', resumes: 1, coverLetters: 1 },
    { label: 'W9', resumes: 2, coverLetters: 0 },
    { label: 'W10', resumes: 1, coverLetters: 1 },
    { label: 'W11', resumes: 1, coverLetters: 2 },
    { label: 'W12', resumes: 1, coverLetters: 1 },
  ],
  docTop: {
    templates: [
      { key: 'basic_resume', count: 9 },
      { key: 'modern_cv', count: 6 },
      { key: 'modern_cv_cover', count: 5 },
      { key: 'custom:example', count: 4 },
    ],
    tones: [
      { key: 'Confident', count: 10 },
      { key: 'Direct', count: 8 },
      { key: 'Friendly', count: 6 },
      { key: 'Formal', count: 4 },
    ],
    models: [
      { key: 'gpt-4.1', count: 12 },
      { key: 'claude-3.7', count: 9 },
      { key: 'gpt-4o-mini', count: 7 },
    ],
  },
}

function StatisticsPage() {
  const [demoEnabled, setDemoEnabled] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const params = new URLSearchParams(window.location.search)
    setDemoEnabled(params.get('demo') === '1')
  }, [])

  if (demoEnabled) {
    return <StatisticsBody stats={DEMO_STATS as any} isLoading={false} />
  }

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Access Denied</h1>
            <p className="mb-6 text-slate-600 dark:text-slate-400">
              You need to{' '}
              <Link to="/sign-in" className="text-primary hover:underline">
                sign in
              </Link>{' '}
              to view this page.
            </p>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <StatisticsContent />
      </Authenticated>
    </>
  )
}

function StatisticsContent() {
  const stats = useQuery(api.stats.getMyStatistics, { weeks: 12 })

  return <StatisticsBody stats={stats as any} isLoading={stats === undefined} />
}

function StatisticsBody({ stats, isLoading }: { stats: any | undefined; isLoading: boolean }) {
  const [isMounted, setIsMounted] = useState(false)
  const { ref: sankeyContainerRef, size: sankeySize } = useElementSize<HTMLDivElement>()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const jobCounts = stats?.jobCounts ?? {
    total: 0,
    viewed: 0,
    applied: 0,
    interview: 0,
    accepted: 0,
    ghosted: 0,
  }

  const appliedOrBeyond =
    jobCounts.applied + jobCounts.interview + jobCounts.accepted + jobCounts.ghosted
  const interviewOrBeyond = jobCounts.interview + jobCounts.accepted
  // NOTE: Job statuses are mutually exclusive; this Sankey is a conceptual funnel:
  // Tracked -> Applied (all non-viewed) -> Interview (interview + accepted), with leaks to Ghosted.
  const appliedPending = jobCounts.applied
  const interviewPending = jobCounts.interview

  const pipelineNodes = [
    { id: 'tracked', name: 'Tracked', color: '#14b8a6' },
    { id: 'viewed', name: 'Viewed', color: '#06b6d4' },
    { id: 'applied', name: 'Applied', color: '#3b82f6' },
    { id: 'still_applied', name: 'Still Applied', color: '#a855f7' },
    { id: 'interview', name: 'Interview', color: '#f59e0b' },
    { id: 'in_interview', name: 'In Interview', color: '#ec4899' },
    { id: 'accepted', name: 'Accepted', color: '#10b981' },
    { id: 'ghosted', name: 'Ghosted', color: '#f43f5e' },
  ]

  const pipelineLinks = [
    { source: 'tracked', target: 'viewed', value: jobCounts.viewed },
    { source: 'tracked', target: 'applied', value: appliedOrBeyond },
    { source: 'applied', target: 'still_applied', value: appliedPending },
    { source: 'applied', target: 'interview', value: interviewOrBeyond },
    { source: 'applied', target: 'ghosted', value: jobCounts.ghosted },
    { source: 'interview', target: 'in_interview', value: interviewPending },
    { source: 'interview', target: 'accepted', value: jobCounts.accepted },
  ].filter((link) => Number.isFinite(link.value) && link.value > 0)

  const pipelineColumns = [
    ['tracked'],
    ['viewed', 'applied'],
    ['still_applied', 'interview', 'ghosted'],
    ['in_interview', 'accepted'],
  ]

  const statusCards = [
    {
      label: 'Views',
      value: jobCounts.viewed,
      description: 'New listings tracked',
      color: 'from-slate-100 via-slate-50 to-white',
      icon: 'visibility',
    },
    {
      label: 'Applies',
      value: jobCounts.applied,
      description: 'Submitted applications',
      color: 'from-blue-100 via-blue-50 to-white',
      icon: 'send',
    },
    {
      label: 'Interviews',
      value: jobCounts.interview,
      description: 'Active conversations',
      color: 'from-amber-100 via-amber-50 to-white',
      icon: 'forum',
    },
    {
      label: 'Accepted',
      value: jobCounts.accepted,
      description: 'Offer wins',
      color: 'from-emerald-100 via-emerald-50 to-white',
      icon: 'check_circle',
    },
    {
      label: 'Ghosted',
      value: jobCounts.ghosted,
      description: 'No response yet',
      color: 'from-rose-100 via-rose-50 to-white',
      icon: 'visibility_off',
    },
  ]

  const distributionData = [
    { name: 'Viewed', value: jobCounts.viewed, color: STATUS_COLORS.viewed },
    { name: 'Applied', value: jobCounts.applied, color: STATUS_COLORS.applied },
    { name: 'Interview', value: jobCounts.interview, color: STATUS_COLORS.interview },
    { name: 'Accepted', value: jobCounts.accepted, color: STATUS_COLORS.accepted },
    { name: 'Ghosted', value: jobCounts.ghosted, color: STATUS_COLORS.ghosted },
  ].filter((entry) => entry.value > 0)

  const insightCards = [
    {
      label: 'Apply Rate',
      value: stats ? `${Math.round(stats.jobRates.appliedRate * 100)}%` : '--',
      detail: 'Applied from tracked jobs',
      icon: 'north_east',
    },
    {
      label: 'Interview Rate',
      value: stats ? `${Math.round(stats.jobRates.interviewRate * 100)}%` : '--',
      detail: 'Interviews per application',
      icon: 'mic',
    },
    {
      label: 'Acceptance Rate',
      value: stats ? `${Math.round(stats.jobRates.acceptanceRate * 100)}%` : '--',
      detail: 'Offers per interview',
      icon: 'verified',
    },
    {
      label: 'Ghost Rate',
      value: stats ? `${Math.round(stats.jobRates.ghostRate * 100)}%` : '--',
      detail: 'Ghosted per application',
      icon: 'cloud_off',
    },
  ]

  const documentCards = [
    {
      label: 'Documents',
      value: stats?.docCounts.total ?? 0,
      detail: 'Total generated',
      icon: 'folder_open',
    },
    {
      label: 'Resumes',
      value: stats?.docCounts.resumes ?? 0,
      detail: 'Tailored resumes',
      icon: 'description',
    },
    {
      label: 'Cover Letters',
      value: stats?.docCounts.coverLetters ?? 0,
      detail: 'Sent introductions',
      icon: 'mail',
    },
    {
      label: 'Stale Apps',
      value: stats?.staleJobs ?? 0,
      detail: '14+ days without updates',
      icon: 'schedule',
    },
  ]

  return (
    <SidebarLayout>
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Statistics</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A visual snapshot of your job search momentum over the last 12 weeks.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span className="material-icons-outlined text-sm">calendar_today</span>
            Last 12 weeks
          </div>
        </header>

        <Card className="border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/60 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Pipeline Flow</CardTitle>
                <CardDescription>Track how listings move through your funnel.</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="material-icons-outlined text-sm text-primary">safety_check</span>
                {jobCounts.total} tracked roles
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!isMounted || isLoading ? (
              <div className="flex h-72 items-center justify-center text-sm text-slate-500">Loading chart...</div>
            ) : jobCounts.total === 0 || pipelineLinks.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
                <span className="material-icons-outlined text-3xl text-slate-300">insights</span>
                Track more activity to unlock the pipeline flow.
              </div>
            ) : (
              <div ref={sankeyContainerRef} className="h-80">
                {sankeySize.width > 0 && sankeySize.height > 0 ? (
                  <PipelineSankey
                    width={sankeySize.width}
                    height={sankeySize.height}
                    nodes={pipelineNodes}
                    links={pipelineLinks}
                    nodeColumns={pipelineColumns}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Measuring chart...</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {statusCards.map((card) => (
            <div
              key={card.label}
              className={cn(
                'relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800',
              )}
            >
              <div
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-20 opacity-60',
                  `bg-gradient-to-br ${card.color}`,
                )}
              />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                    {stats ? card.value : '--'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{card.description}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm dark:bg-slate-900">
                  <span className="material-icons-outlined text-lg">{card.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Weekly Activity</CardTitle>
              <CardDescription>Applications added and their current status.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {!isMounted || stats === undefined ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading activity...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.jobTrend} barGap={4} margin={{ left: 4, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="viewed" stackId="a" fill={STATUS_COLORS.viewed} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="applied" stackId="a" fill={STATUS_COLORS.applied} />
                    <Bar dataKey="interview" stackId="a" fill={STATUS_COLORS.interview} />
                    <Bar dataKey="accepted" stackId="a" fill={STATUS_COLORS.accepted} />
                    <Bar dataKey="ghosted" stackId="a" fill={STATUS_COLORS.ghosted} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Mix</CardTitle>
              <CardDescription>Where your current pipeline stands.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {!isMounted || stats === undefined ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading breakdown...
                </div>
              ) : distributionData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Documents & Momentum (condensed, no stretched/empty cards) */}
        <section className="grid auto-rows-min items-start gap-6 lg:grid-cols-3">
          <Card className="self-start lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Document Output</CardTitle>
                  <CardDescription>Resumes and cover letters delivered each week.</CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-400" />
                    Resumes
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Cover letters
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-56">
              {!isMounted || stats === undefined ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading documents...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.documentTrend} margin={{ left: 4, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="resumes" stroke="#6366f1" strokeWidth={2} fill="#c7d2fe" />
                    <Area type="monotone" dataKey="coverLetters" stroke="#0ea5e9" strokeWidth={2} fill="#bae6fd" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="self-start bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-white">Focus Metrics</CardTitle>
              <CardDescription className="text-slate-200">Quick pulse checks for momentum.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {insightCards.map((card) => (
                <div key={card.label} className="rounded-lg bg-white/10 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
                        {card.label}
                      </p>
                      <p className="text-lg font-semibold text-white">{card.value}</p>
                      <p className="text-[11px] text-slate-300">{card.detail}</p>
                    </div>
                    <span className="material-icons-outlined mt-0.5 text-lg text-slate-100">{card.icon}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle>Document Mix</CardTitle>
              <CardDescription>What you generated recently.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {documentCards.map((card) => (
                <div key={card.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-slate-400">{card.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{card.label}</p>
                      <p className="text-xs text-slate-500">{card.detail}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{stats ? card.value : '--'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle>Top Templates</CardTitle>
              <CardDescription>Most used designs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats?.docTop.templates ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No template activity yet.</p>
              ) : (
                (stats?.docTop.templates ?? []).slice(0, 4).map((item, index) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">{item.key}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-500">{item.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle>Top Tones</CardTitle>
              <CardDescription>Most common styles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats?.docTop.tones ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No tone data yet.</p>
              ) : (
                (stats?.docTop.tones ?? []).slice(0, 4).map((item, index) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">{item.key}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-500">{item.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </SidebarLayout>
  )
}
