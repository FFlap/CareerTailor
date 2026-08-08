import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared page chrome: hairline rules, one ink ramp, no nested cards, no shadows
 * standing in for hierarchy. Spacing groups; weight emphasises.
 */

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 py-8 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** Title, one line of orientation, and the actions that belong to the page. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 pb-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-[65ch] text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A bordered surface. Never nest one inside another. */
export function Panel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** For in-page jump links, e.g. the profile form's section nav. */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {meta && (
          <span className="truncate text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
            {meta}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/** The bar sits behind the text, so a row stays one line. */
export function BarList({
  entries,
  format = (key: string) => key,
  className,
  rowClassName,
}: {
  entries: Array<{ key: string; count: number; hint?: ReactNode }>;
  format?: (key: string) => string;
  className?: string;
  /** Taller rows when the list has to hold its own beside a chart. */
  rowClassName?: string;
}) {
  const max = Math.max(...entries.map((entry) => entry.count), 1);

  return (
    <ul className={cn("p-2", className)}>
      {entries.map((entry) => (
        <li key={entry.key} className="relative">
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-[3px] bg-slate-100 transition-[width] duration-500 ease-out motion-reduce:transition-none dark:bg-slate-800/70"
            style={{ width: `${(entry.count / max) * 100}%` }}
          />
          <div
            className={cn(
              "relative flex items-center justify-between gap-3 px-2 py-1.5",
              rowClassName,
            )}
          >
            <span className="truncate text-[13px] text-slate-700 dark:text-slate-200">
              {format(entry.key)}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {entry.hint && (
                <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {entry.hint}
                </span>
              )}
              <span className="text-[13px] tabular-nums text-slate-500 dark:text-slate-400">
                {entry.count}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Teaches what the screen is for rather than announcing that it is empty. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-12 text-center", className)}>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-[46ch] text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Status word carried by weight and a dot, not by a coloured pill. */
export function StatusDot({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "positive" | "warning" | "critical";
  children: ReactNode;
}) {
  const dot = {
    neutral: "bg-slate-300 dark:bg-slate-600",
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-rose-500",
  }[tone];

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
}

/** Rows in a list share one hairline rhythm and reveal actions on hover. */
export function Row({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  return (
    <As
      className={cn(
        "group/row flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800/70",
        className,
      )}
    >
      {children}
    </As>
  );
}
