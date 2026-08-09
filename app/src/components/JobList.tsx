import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { sourceLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import { jobSource } from "../../convex/lib/jobSource";

/**
 * One tracked-job list, shared by the dashboard panel and the Applications
 * page. Columns are labelled, so a date is never a bare number floating in a
 * row; stage is a named control rather than a form widget; the action is
 * always present and only gains contrast on hover.
 */

export type JobStatus =
  | "viewed"
  | "applied"
  | "interview"
  | "accepted"
  | "ghosted";

export type JobStage = {
  value: JobStatus;
  label: string;
  dot: string;
  /** Ghosted leaves the pipeline rather than advancing it. */
  exit?: boolean;
};

/** Pipeline order first, then the exit. Single source of truth for both screens. */
export const JOB_STAGES: JobStage[] = [
  { value: "viewed", label: "Viewed", dot: "bg-slate-300 dark:bg-slate-600" },
  { value: "applied", label: "Applied", dot: "bg-slate-500" },
  { value: "interview", label: "Interview", dot: "bg-amber-500" },
  { value: "accepted", label: "Offer", dot: "bg-emerald-500" },
  { value: "ghosted", label: "Ghosted", dot: "bg-rose-400", exit: true },
];

const STAGE_BY_VALUE = Object.fromEntries(
  JOB_STAGES.map((stage) => [stage.value, stage]),
) as Record<JobStatus, JobStage>;

export function jobStatusOf(job: { status?: string }): JobStatus {
  const status = job.status as JobStatus | undefined;
  return status && status in STAGE_BY_VALUE ? status : "viewed";
}

/**
 * Same track widths for the header and every row, so the columns line up. A
 * wide list earns a Source column rather than leaving the gap as air.
 */
const COLUMNS =
  "grid grid-cols-1 gap-y-2.5 @xl/list:grid-cols-[minmax(0,1fr)_4rem_7.75rem_5.75rem] @xl/list:gap-x-4 @xl/list:gap-y-0 @3xl/list:grid-cols-[minmax(0,1fr)_7rem_4rem_7.75rem_5.75rem]";

/** How long you have been sitting on it reads better than the calendar day. */
function formatAge(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const days = Math.floor((Date.now() - value) / 86_400_000);
  if (days <= 0) return "today";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function formatExactDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Declares the container the rows measure themselves against. */
export function JobList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("@container/list", className)}>{children}</div>;
}

export function JobListHeader() {
  return (
    <div
      className={cn(
        COLUMNS,
        "hidden border-b border-slate-200 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400 @xl/list:grid dark:border-slate-800 dark:text-slate-500",
      )}
    >
      <span>Role</span>
      <span className="hidden @3xl/list:block">Source</span>
      <span>Added</span>
      <span>Stage</span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

export function JobRow({
  job,
  onStatusChange,
}: {
  job: any;
  onStatusChange: (jobId: string, status: JobStatus) => void;
}) {
  const status = jobStatusOf(job);
  const addedAt = job.addedAt ?? job.createdAt ?? job.lastSeenAt;
  const documentCount: number = job.documentCount ?? 0;

  return (
    <li className="group/row border-b border-slate-100 last:border-b-0 dark:border-slate-800/70">
      <div className={cn(COLUMNS, "items-center px-4 py-3")}>
        <div className="min-w-0">
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer noopener"
              title={job.title}
              className="block truncate rounded-sm text-[13px] font-medium text-slate-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-100"
            >
              {job.title}
            </a>
          ) : (
            <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
              {job.title}
            </span>
          )}
          {/* Narrow has no columns to hang the date on, so it joins the meta. */}
          <div className="mt-0.5 flex items-baseline gap-1 text-xs">
            <span className="truncate text-slate-500 dark:text-slate-400">
              {job.company}
            </span>
            {documentCount > 0 && (
              <span className="shrink-0 text-slate-400 dark:text-slate-500">
                · {documentCount}{" "}
                {documentCount === 1 ? "document" : "documents"}
              </span>
            )}
            <span
              title={`Added ${formatExactDate(addedAt)}`}
              className="shrink-0 tabular-nums text-slate-400 @xl/list:hidden dark:text-slate-500"
            >
              · {formatAge(addedAt)}
            </span>
          </div>
        </div>

        {/* Derived the same way the dashboard's Job sites breakdown is, so the
            two never disagree about where a job came from. */}
        <span className="hidden truncate text-xs text-slate-500 @3xl/list:col-start-2 @3xl/list:row-start-1 @3xl/list:block dark:text-slate-400">
          {sourceLabel(jobSource(job.url ?? "", job.source ?? ""))}
        </span>

        <span
          title={`Added ${formatExactDate(addedAt)}`}
          className="hidden text-xs tabular-nums text-slate-500 @xl/list:col-start-2 @xl/list:row-start-1 @xl/list:block @3xl/list:col-start-3 dark:text-slate-400"
        >
          {formatAge(addedAt)}
        </span>

        {/* One group of controls on narrow; dissolves into columns once there
            are columns to dissolve into. */}
        <div className="flex items-center gap-2 @xl/list:contents">
          <StageMenu
            className="@xl/list:col-start-3 @xl/list:row-start-1 @3xl/list:col-start-4"
            status={status}
            jobTitle={job.title}
            onChange={(next) => onStatusChange(job._id, next)}
          />

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
            title={`Write a document for ${job.title}`}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs transition-colors @xl/list:h-7 @xl/list:px-2",
              // Touch has no hover to reveal an outline, so narrow keeps one.
              "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200",
              "@xl/list:border-transparent @xl/list:text-slate-500 @xl/list:group-hover/row:border-slate-200 @xl/list:group-hover/row:text-slate-900 dark:@xl/list:text-slate-400 dark:@xl/list:group-hover/row:border-slate-700 dark:@xl/list:group-hover/row:text-slate-100",
              "hover:!border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:hover:!border-slate-600 dark:hover:bg-slate-800",
              "@xl/list:col-start-4 @xl/list:row-start-1 @xl/list:justify-self-end @3xl/list:col-start-5",
            )}
          >
            Generate
          </Link>
        </div>
      </div>
    </li>
  );
}

/**
 * The stage a job sits at, always readable as a word. It only looks like a
 * control once you reach for it, which keeps a hundred rows quiet.
 */
export function StageMenu({
  status,
  jobTitle,
  onChange,
  className,
}: {
  status: JobStatus;
  jobTitle?: string;
  onChange: (status: JobStatus) => void;
  className?: string;
}) {
  const stage = STAGE_BY_VALUE[status];
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = Math.max(
      JOB_STAGES.findIndex((item) => item.value === status),
      0,
    );
    itemRefs.current[index]?.focus();
  }, [open, status]);

  // A row near the bottom of the window would open its menu off-screen.
  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 240);
    }
    setOpen((value) => !value);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    const step =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const current = itemRefs.current.findIndex(
      (node) => node === document.activeElement,
    );
    const next = (current + step + JOB_STAGES.length) % JOB_STAGES.length;
    itemRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef} className={cn("relative @xl/list:-ml-2", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          jobTitle ? `Stage for ${jobTitle}: ${stage.label}` : stage.label
        }
        className={cn(
          "inline-flex h-8 w-full items-center gap-2 rounded-md border px-2.5 text-xs text-slate-700 transition-colors @xl/list:h-7 @xl/list:px-2 dark:text-slate-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
          open
            ? "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
            : // Touch has no hover to reveal an outline, so narrow keeps one.
              "border-slate-200 @xl/list:border-transparent @xl/list:group-hover/row:border-slate-200 hover:!border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:@xl/list:border-transparent dark:@xl/list:group-hover/row:border-slate-700 dark:hover:!border-slate-600 dark:hover:bg-slate-800",
        )}
      >
        <Dot className={stage.dot} />
        <span className="truncate">{stage.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "ml-auto h-3 w-3 shrink-0 text-slate-400 transition-transform dark:text-slate-500",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Move to stage"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute z-30 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-[0_10px_30px_-16px_rgba(15,23,42,0.5)] dark:border-slate-700 dark:bg-slate-900",
            "animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none",
            // Narrow sits the control at the left edge, wide at the right.
            "left-0 @xl/list:left-auto @xl/list:right-0",
            dropUp
              ? "bottom-full mb-1 origin-bottom-left @xl/list:origin-bottom-right"
              : "top-full mt-1 origin-top-left @xl/list:origin-top-right",
          )}
        >
          <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Move to
          </p>
          {JOB_STAGES.map((item, index) => (
            // role="none" keeps the wrapper out of the menu's ARIA structure.
            <div key={item.value} role="none">
              {item.exit && (
                <div
                  role="separator"
                  className="my-1 h-px bg-slate-100 dark:bg-slate-800"
                />
              )}
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={item.value === status}
                onClick={() => {
                  if (item.value !== status) onChange(item.value);
                  close();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors",
                  "hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800",
                  item.value === status
                    ? "font-medium text-slate-900 dark:text-slate-50"
                    : "text-slate-600 dark:text-slate-300",
                )}
              >
                <Dot className={item.dot} />
                {item.label}
                {item.value === status && (
                  <Check
                    aria-hidden
                    className="ml-auto h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                  />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", className)}
    />
  );
}

/** Hairline rows while the query lands, so the panel does not jump on arrival. */
export function JobListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-busy role="status" aria-label="Loading tracked jobs">
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className="flex animate-pulse items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 motion-reduce:animate-none dark:border-slate-800/70"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div
              className="h-3 rounded-sm bg-slate-100 dark:bg-slate-800"
              style={{ width: `${58 - index * 6}%` }}
            />
            <div className="h-2.5 w-24 rounded-sm bg-slate-100/70 dark:bg-slate-800/60" />
          </div>
          <div className="h-3 w-8 rounded-sm bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-16 rounded-sm bg-slate-100 dark:bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}
