import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Windows a list for rendering only. Filtering and searching still run over the
 * whole set, so counts and empty states stay honest about what is really there.
 */
export function usePagination<T>(
  items: T[],
  { perPage = 10, resetKey }: { perPage?: number; resetKey?: unknown } = {},
) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  // Narrowing the list must never strand you on a page that no longer exists.
  const current = Math.min(page, pageCount);

  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => {
    if (page !== current) setPage(current);
  }, [page, current]);

  const start = (current - 1) * perPage;

  return {
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice(start, start + perPage),
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, items.length),
    total: items.length,
  };
}

type Slot = number | "gap";

/** First, last, and a window around the current page; the rest collapses. */
function slots(page: number, pageCount: number): Slot[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const out: Slot[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) out.push("gap");
  for (let n = from; n <= to; n += 1) out.push(n);
  if (to < pageCount - 1) out.push("gap");
  out.push(pageCount);
  return out;
}

export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  /** Singular; pluralised with a trailing s. */
  noun: string;
  onPage: (page: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(page);

  // Paging from a footer leaves the new rows above the fold; bring them back.
  useEffect(() => {
    if (previous.current === page) return;
    previous.current = page;
    const panel = ref.current?.closest("section");
    if (!panel) return;
    if (panel.getBoundingClientRect().top >= 0) return;
    panel.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [page]);

  if (pageCount <= 1) return null;

  return (
    <div
      ref={ref}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-200 px-4 py-2.5 dark:border-slate-800"
    >
      <p className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
        {from}–{to} of {total} {total === 1 ? noun : `${noun}s`}
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-0.5">
        <Step
          direction="previous"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        />
        {slots(page, pageCount).map((slot, index) =>
          slot === "gap" ? (
            <span
              key={`gap-${index}`}
              aria-hidden
              className="px-1 text-[11px] text-slate-400 dark:text-slate-600"
            >
              …
            </span>
          ) : (
            <button
              key={slot}
              type="button"
              onClick={() => onPage(slot)}
              aria-label={`Page ${slot}`}
              aria-current={slot === page ? "page" : undefined}
              className={cn(
                "h-7 min-w-[1.75rem] rounded-md px-1.5 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
                slot === page
                  ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-50"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
              )}
            >
              {slot}
            </button>
          ),
        )}
        <Step
          direction="next"
          disabled={page === pageCount}
          onClick={() => onPage(page + 1)}
        />
      </nav>
    </div>
  );
}

function Step({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "previous" ? "Previous page" : "Next page"}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:pointer-events-none disabled:text-slate-300 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100 dark:disabled:text-slate-700"
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}
