import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { ReactNode } from "react";

import { PageSkeleton, PageThumbnail } from "@/components/PageThumbnail";
import { cn } from "@/lib/utils";

/** One document as it prints, plus what the caption has to say about it. */
export type DocumentEntry = {
  key: string;
  kind: "resume" | "cover_letter" | "review";
  title: string;
  typeLabel: string;
  company?: string;
  at: number;
  favorite: boolean;
  /** Changes when the document does, so an edit retires its own thumbnail. */
  thumbKey: string;
  /** Absent when an upload has no stored file to draw from. */
  thumbnail: (() => Promise<string>) | null;
  to: "/editor/$documentId" | "/review/$reviewId";
  params: any;
};

/** Label, count, and a rule running out to the margin. */
export function ShelfLabel({
  label,
  count,
  hint,
  icon,
}: {
  label: string;
  count?: number;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {icon}
      <h2 className="text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
        {label}
      </h2>
      {count !== undefined && (
        <span className="text-[11px] font-medium tabular-nums tracking-wide text-slate-400 dark:text-slate-500">
          {count}
        </span>
      )}
      <span aria-hidden className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      {hint && (
        <span className="hidden text-[11px] text-slate-400 sm:block dark:text-slate-500">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Pages sit on the page itself — no panel, no card behind a card. */
export function Shelf({ children }: { children: ReactNode }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(184px,1fr))]">
      {children}
    </ul>
  );
}

export function Tile({
  entry,
  starred,
  onToggleStar,
}: {
  entry: DocumentEntry;
  starred: boolean;
  onToggleStar: () => void;
}) {
  return (
    <li className="group/tile relative">
      <div className="relative aspect-[17/22] overflow-hidden rounded-[3px] border border-slate-200 bg-white transition duration-200 ease-out group-focus-within/tile:border-slate-400 group-hover/tile:-translate-y-1 group-hover/tile:border-slate-400 motion-reduce:transition-none motion-reduce:group-hover/tile:translate-y-0 dark:border-slate-700 dark:group-hover/tile:border-slate-500">
        {entry.thumbnail ? (
          <PageThumbnail
            cacheKey={entry.thumbKey}
            produce={entry.thumbnail}
            shape={entry.kind}
          />
        ) : (
          <PageSkeleton shape={entry.kind} seed={entry.key} settled={false} />
        )}
      </div>

      <button
        type="button"
        onClick={onToggleStar}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${entry.title}` : `Star ${entry.title}`}
        className={cn(
          "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 transition-opacity hover:text-slate-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900",
          starred
            ? "text-slate-900 opacity-100"
            : "text-slate-400 opacity-100 sm:opacity-0 sm:group-hover/tile:opacity-100 sm:group-focus-within/tile:opacity-100",
        )}
      >
        <Star aria-hidden className={cn("h-3.5 w-3.5", starred && "fill-current")} />
      </button>

      <div className="mt-3 min-w-0">
        <Link
          to={entry.to}
          params={entry.params}
          className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 underline-offset-4 decoration-slate-300 outline-none after:absolute after:inset-0 after:rounded-sm group-hover/tile:underline group-focus-within/tile:underline dark:text-slate-100"
        >
          {entry.title}
        </Link>
        <p className="mt-1 truncate text-[11px] uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
          {entry.typeLabel}
          {entry.company && (
            <span className="normal-case tracking-normal text-slate-500 dark:text-slate-400">
              {" · "}
              {entry.company}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
          {new Date(entry.at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </li>
  );
}
