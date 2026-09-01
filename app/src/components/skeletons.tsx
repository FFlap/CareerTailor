import type { ReactNode } from "react";

import { Page, Panel } from "@/components/ui/page";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SHELF_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(184px,1fr))]";

const JOB_TITLE_WIDTHS = [
  "w-7/12",
  "w-5/12",
  "w-8/12",
  "w-6/12",
  "w-4/12",
  "w-9/12",
];

export function JobListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-busy role="status" aria-label="Loading tracked jobs">
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800/70"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton
              className={cn(
                "h-3",
                JOB_TITLE_WIDTHS[index % JOB_TITLE_WIDTHS.length],
              )}
            />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-7 w-24" rounded="md" />
          <Skeleton className="h-7 w-20" rounded="md" />
        </li>
      ))}
    </ul>
  );
}

function HeaderSkeleton({
  titleWidth = "w-40",
  actions = 2,
}: {
  titleWidth?: string;
  actions?: number;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0 space-y-2.5">
        <Skeleton className={cn("h-7", titleWidth)} rounded="md" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          {Array.from({ length: actions }, (_, index) => (
            <Skeleton key={index} className="h-9 w-28" rounded="md" />
          ))}
        </div>
      )}
    </header>
  );
}

function PanelHeaderSkeleton({ width = "w-24" }: { width?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <Skeleton className={cn("h-3", width)} />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonRegion label="Loading your dashboard">
      <Page>
        <HeaderSkeleton titleWidth="w-52" />

        <div className="space-y-4">
          <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-slate-200 sm:grid-cols-4 dark:bg-slate-800">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="bg-white px-4 py-3.5 dark:bg-slate-900">
                <Skeleton className="h-6 w-12" rounded="md" />
                <Skeleton className="mt-2.5 h-2.5 w-20" />
                <Skeleton className="mt-1.5 h-2 w-24" />
              </div>
            ))}
          </Panel>

          <Panel>
            <PanelHeaderSkeleton width="w-20" />
            <div className="p-4">
              <Skeleton className="h-[300px] w-full" rounded="md" />
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="min-w-0 lg:col-span-2">
              <PanelHeaderSkeleton width="w-16" />
              <div className="px-4 pb-4 pt-4">
                <div className="h-[212px]">
                  <ActivityChartFallback />
                </div>
              </div>
            </Panel>

            <Panel className="min-w-0">
              <PanelHeaderSkeleton width="w-14" />
              <div className="flex items-baseline gap-7 px-4 pt-3.5">
                <div>
                  <Skeleton className="h-6 w-10" rounded="md" />
                  <Skeleton className="mt-2 h-2.5 w-20" />
                </div>
                <div>
                  <Skeleton className="h-6 w-10" rounded="md" />
                  <Skeleton className="mt-2 h-2.5 w-14" />
                </div>
              </div>
              <div className="px-4 pb-4 pt-3.5">
                <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
                  {Array.from({ length: 105 }, (_, index) => (
                    <Skeleton
                      key={index}
                      className="aspect-square"
                      rounded="none"
                    />
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 px-4 py-2.5 dark:border-slate-800">
                <Skeleton className="h-2.5 w-32" />
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="min-w-0 lg:col-span-2">
              <PanelHeaderSkeleton width="w-24" />
              <JobListSkeleton rows={5} />
            </Panel>

            <Panel className="min-w-0">
              <PanelHeaderSkeleton width="w-32" />
              <ul>
                {Array.from({ length: 6 }, (_, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800/70"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                    <Skeleton className="h-2.5 w-10" />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel className="overflow-hidden">
            <PanelHeaderSkeleton width="w-24" />
            <div className="grid gap-px bg-slate-200 sm:grid-cols-3 dark:bg-slate-800">
              {Array.from({ length: 3 }, (_, column) => (
                <div key={column} className="bg-white py-3 dark:bg-slate-900">
                  <Skeleton className="mx-4 h-2.5 w-20" />
                  <ul className="space-y-1.5 p-2 pt-3">
                    {["w-11/12", "w-8/12", "w-5/12"].map((width) => (
                      <li key={width} className="px-2">
                        <Skeleton className={cn("h-5", width)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Page>
    </SkeletonRegion>
  );
}

export function ActivityChartFallback() {
  return (
    <div className="flex h-full items-end gap-2">
      {BAR_HEIGHTS.map((height, index) => (
        <Skeleton key={index} className={cn("flex-1", height)} rounded="none" />
      ))}
    </div>
  );
}

const BAR_HEIGHTS = [
  "h-[35%]",
  "h-[55%]",
  "h-[42%]",
  "h-[70%]",
  "h-[48%]",
  "h-[85%]",
  "h-[60%]",
  "h-[38%]",
  "h-[72%]",
  "h-[50%]",
  "h-[64%]",
  "h-[45%]",
];

export function ApplicationsSkeleton() {
  return (
    <SkeletonRegion label="Loading your applications">
      <Page>
        <HeaderSkeleton titleWidth="w-44" actions={1} />

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {STAGE_TAB_WIDTHS.map((width, index) => (
                <Skeleton
                  key={index}
                  className={cn("h-6", width)}
                  rounded="md"
                />
              ))}
            </div>
            <Skeleton className="h-8 w-full sm:w-56" rounded="md" />
          </div>
          <JobListSkeleton rows={10} />
        </Panel>
      </Page>
    </SkeletonRegion>
  );
}

const STAGE_TAB_WIDTHS = ["w-14", "w-20", "w-20", "w-24", "w-16", "w-20"];

export function DocumentsSkeleton() {
  return (
    <SkeletonRegion label="Loading your documents">
      <Page>
        <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
          <div className="min-w-0 space-y-2.5">
            <Skeleton className="h-7 w-44" rounded="md" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-9 w-56" rounded="md" />
            <Skeleton className="h-9 w-56" rounded="md" />
          </div>
        </header>

        <DocumentTilesSkeleton />
      </Page>
    </SkeletonRegion>
  );
}

export function DocumentTilesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-6" />
      </div>
      <ul className={SHELF_GRID}>
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <Skeleton
              className="aspect-[17/22] w-full border border-slate-200 dark:border-slate-700"
              rounded="none"
            />
            <Skeleton className="mt-3 h-2.5 w-3/4" />
            <Skeleton className="mt-2 h-2 w-1/2" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonRegion label="Loading your profile">
      <HeaderSkeleton titleWidth="w-28" actions={0} />

      <Skeleton className="h-28 w-full" rounded="lg" />

      <section className="mt-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="ml-auto h-2.5 w-20" />
        </div>

        <div className="divide-y divide-slate-100 px-4 sm:px-5 dark:divide-slate-900">
          {PROFILE_SECTIONS.map((section, index) => (
            <div key={index} className="py-4">
              <div className="flex items-center justify-between">
                <Skeleton className={cn("h-3", section.titleWidth)} />
                <Skeleton className="h-3 w-3" rounded="full" />
              </div>
              {section.fields > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: section.fields }, (_, index) => (
                    <div key={index} className="space-y-1.5">
                      <Skeleton className="h-2 w-20" />
                      <Skeleton className="h-9 w-full" rounded="md" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-6 z-10 mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/90">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-8 w-28" rounded="md" />
      </div>
    </SkeletonRegion>
  );
}

const PROFILE_SECTIONS = [
  { titleWidth: "w-20", fields: 4 },
  { titleWidth: "w-24", fields: 0 },
  { titleWidth: "w-16", fields: 0 },
  { titleWidth: "w-28", fields: 2 },
  { titleWidth: "w-20", fields: 0 },
  { titleWidth: "w-24", fields: 0 },
];

export function TemplatesSkeleton() {
  return (
    <SkeletonRegion label="Loading templates">
      <Page>
        <HeaderSkeleton titleWidth="w-36" actions={1} />

        <div className="grid gap-4 lg:grid-cols-2">
          {["w-20", "w-28"].map((width) => (
            <Panel key={width} className="overflow-hidden">
              <PanelHeaderSkeleton width={width} />
              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 p-3 dark:border-slate-800">
                {TEMPLATE_CHIP_WIDTHS.map((chip, index) => (
                  <Skeleton key={index} className={cn("h-7", chip)} rounded="md" />
                ))}
              </div>
              <div className="bg-slate-50 p-4 dark:bg-slate-950">
                <Skeleton
                  className="mx-auto min-h-[420px] w-full max-w-[26rem] aspect-[1/1.414]"
                  rounded="none"
                />
              </div>
            </Panel>
          ))}
        </div>
      </Page>
    </SkeletonRegion>
  );
}

const TEMPLATE_CHIP_WIDTHS = ["w-20", "w-32", "w-24", "w-20", "w-28", "w-24"];

export function GenerateSkeleton() {
  return (
    <SkeletonRegion label="Loading the generator">
      <Page>
        <HeaderSkeleton titleWidth="w-32" actions={1} />
        <GenerateFormSkeleton />
      </Page>
    </SkeletonRegion>
  );
}

export function GenerateFormSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <Panel>
          <PanelHeaderSkeleton width="w-24" />
          <div className="space-y-4 p-4">
            <Skeleton className="h-2.5 w-full" />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-9 w-full" rounded="md" />
              </div>
            ))}
            <div className="space-y-2">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-[180px] w-full" rounded="md" />
            </div>
          </div>
        </Panel>
      </div>

      <div className="min-w-0 space-y-4">
        <Panel>
          <PanelHeaderSkeleton width="w-20" />
          <div className="space-y-4 p-4">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-2 w-28" />
                <Skeleton className="h-24 w-full" rounded="md" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeaderSkeleton width="w-28" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-9 w-full" rounded="md" />
              </div>
            ))}
          </div>
        </Panel>

        <Skeleton className="h-10 w-full" rounded="md" />
      </div>
    </div>
  );
}

function WorkbenchSkeleton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <SkeletonRegion
      label={label}
      className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900"
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-7 w-7" rounded="md" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2 w-32" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-8" rounded="md" />
          <Skeleton className="h-8 w-24" rounded="md" />
          <Skeleton className="h-7 w-7" rounded="full" />
        </div>
      </header>

      {children}
    </SkeletonRegion>
  );
}

export function EditorPanesSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-px bg-slate-200 lg:min-h-0 lg:flex-row dark:bg-slate-800">
      <section className="flex w-full flex-col bg-white lg:min-h-0 lg:w-[46%] lg:min-w-[26rem] dark:bg-slate-950">
        <div className="flex shrink-0 items-center gap-4 border-b border-slate-200 px-3 py-3.5 dark:border-slate-800">
          {["w-12", "w-14", "w-14"].map((width, index) => (
            <Skeleton key={index} className={cn("h-3", width)} />
          ))}
        </div>
        <div className="space-y-4 p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-9 w-full" rounded="md" />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 p-6 lg:min-h-0 lg:flex-1 dark:bg-slate-900">
        <Skeleton
          className="mx-auto aspect-[1/1.414] w-full max-w-[38rem]"
          rounded="none"
        />
      </section>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <WorkbenchSkeleton label="Loading the document">
      <EditorPanesSkeleton />
    </WorkbenchSkeleton>
  );
}

export function ReviewPanesSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-px bg-slate-200 dark:bg-slate-800">
      <section className="min-h-0 flex-1 bg-slate-50 p-6 dark:bg-slate-900">
        <Skeleton
          className="mx-auto aspect-[1/1.414] w-full max-w-[38rem]"
          rounded="none"
        />
      </section>

      <section className="hidden min-h-0 w-full flex-col bg-white lg:flex lg:w-[38%] lg:min-w-[22rem] dark:bg-slate-950">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <Skeleton className="h-9 w-16" rounded="md" />
          <Skeleton className="mt-2.5 h-2.5 w-40" />
        </div>
        <div className="space-y-4 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800"
            >
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-4/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <WorkbenchSkeleton label="Loading the review">
      <ReviewPanesSkeleton />
    </WorkbenchSkeleton>
  );
}
