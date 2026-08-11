import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Meta } from "@/components/editor/primitives";
import { sectionsOpen, useDisclosure } from "@/components/editor/useDisclosure";
import { cn } from "@/lib/utils";

import {
  METRIC_KEYS,
  METRIC_LABELS,
  countMajor,
  groupComments,
  scoreVerdict,
  type ReviewArea,
  type ReviewComment,
  type ReviewGroup,
  type ReviewMetrics,
} from "./model";

/**
 * The review, read top to bottom: where it stands, what the rubric says, then
 * the notes grouped the way the document is — section, then the entry inside it.
 * Owns no chrome, so the editor pane and the saved view can both hold it.
 */
export function ReviewPanel({
  summary,
  metrics,
  comments,
  activeId,
  onActivate,
  onSelect,
  selectLabel,
}: {
  summary: string;
  metrics: ReviewMetrics;
  comments: ReviewComment[];
  activeId: number | null;
  onActivate: (id: number | null) => void;
  /** Given when a note can take you somewhere — a field, or the page. */
  onSelect?: (comment: ReviewComment) => void;
  selectLabel?: string;
}) {
  const [majorOnly, setMajorOnly] = useState(false);
  const majorCount = countMajor(comments);
  // Sections open, entries closed — the same rhythm as the fields pane.
  const disclosure = useDisclosure(sectionsOpen);

  const shown = useMemo(
    () =>
      majorOnly
        ? comments.filter((comment) => comment.severity === "major")
        : comments,
    [comments, majorOnly],
  );

  const groups = useMemo(() => groupComments(shown), [shown]);

  const keys = useMemo(() => {
    const all: string[] = [];
    groups.forEach((group, groupIndex) => {
      all.push(`sec-${group.section}`);
      group.areas.forEach((_, areaIndex) =>
        all.push(`sec-${group.section}:${groupIndex}${areaIndex}`),
      );
    });
    return all;
  }, [groups]);

  const allOpen = keys.length > 0 && keys.every(disclosure.isOpen);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <p className="border-b border-slate-200 px-4 py-4 text-[13px] leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-200">
        {summary}
      </p>

      <div className="border-b border-slate-200 dark:border-slate-800">
        {METRIC_KEYS.map((key) => (
          <ScoreRow
            key={key}
            label={METRIC_LABELS[key]}
            score={metrics?.[key]?.score ?? null}
            note={metrics?.[key]?.note ?? ""}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <Meta>
          {comments.length} {comments.length === 1 ? "note" : "notes"}
          {majorCount > 0 && ` · ${majorCount} major`}
        </Meta>
        <div className="flex items-center gap-1">
          {majorCount > 0 && majorCount < comments.length && (
            <button
              type="button"
              onClick={() => setMajorOnly((value) => !value)}
              aria-pressed={majorOnly}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25",
                majorOnly
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-100",
              )}
            >
              Major only
            </button>
          )}
          {keys.length > 0 && (
            <button
              type="button"
              onClick={() => disclosure.setAll(keys, !allOpen)}
              className="rounded px-1.5 py-0.5 text-[11px] text-slate-400 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-500 dark:hover:text-slate-100 dark:focus-visible:ring-slate-100/25"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
          Nothing flagged here.
        </p>
      ) : (
        groups.map((group, groupIndex) => (
          <SectionBlock
            key={group.section}
            group={group}
            open={disclosure.isOpen(`sec-${group.section}`)}
            onToggle={() => disclosure.toggle(`sec-${group.section}`)}
            isAreaOpen={(areaIndex) =>
              disclosure.isOpen(`sec-${group.section}:${groupIndex}${areaIndex}`)
            }
            onToggleArea={(areaIndex) =>
              disclosure.toggle(`sec-${group.section}:${groupIndex}${areaIndex}`)
            }
            activeId={activeId}
            onActivate={onActivate}
            onSelect={onSelect}
            selectLabel={selectLabel}
          />
        ))
      )}

      <div className="h-12" />
    </div>
  );
}

/** Number first, then the bar it earned, then why. */
function ScoreRow({
  label,
  score,
  note,
}: {
  label: string;
  score: number | null;
  note: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-slate-600 dark:text-slate-300">
          {label}
        </span>
        {score === null ? (
          <Meta>Not scored</Meta>
        ) : (
          <span className="flex items-baseline gap-2">
            <Meta>{scoreVerdict(score)}</Meta>
            <span className="text-[13px] font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {score}
            </span>
          </span>
        )}
      </div>
      {score !== null && (
        <div
          className="mt-2 h-px w-full bg-slate-200 dark:bg-slate-800"
          role="presentation"
        >
          <div
            className="h-px bg-slate-900 transition-[width] duration-700 ease-out motion-reduce:transition-none dark:bg-slate-100"
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      {note && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {note}
        </p>
      )}
    </div>
  );
}

/** A résumé section: Experience, Projects, and so on. */
function SectionBlock({
  group,
  open,
  onToggle,
  isAreaOpen,
  onToggleArea,
  activeId,
  onActivate,
  onSelect,
  selectLabel,
}: {
  group: ReviewGroup;
  open: boolean;
  onToggle: () => void;
  isAreaOpen: (index: number) => boolean;
  onToggleArea: (index: number) => void;
  activeId: number | null;
  onActivate: (id: number | null) => void;
  onSelect?: (comment: ReviewComment) => void;
  selectLabel?: string;
}) {
  const bodyId = `review-section-${group.section}`;

  return (
    <section className="border-b border-slate-200/80 last:border-b-0 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ease-out motion-reduce:transition-none dark:text-slate-500",
            open && "rotate-90",
          )}
        />
        <span className="shrink-0 text-[13px] font-medium tracking-tight text-slate-900 dark:text-slate-100">
          {group.label}
        </span>
        <Meta>{group.total}</Meta>
        {group.major > 0 && (
          <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            {group.major} major
          </span>
        )}
      </button>

      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-2 pl-6 pr-1">
            {group.areas.map((area, index) => (
              <AreaBlock
                key={area.key}
                area={area}
                index={index + 1}
                open={isAreaOpen(index)}
                onToggle={() => onToggleArea(index)}
                activeId={activeId}
                onActivate={onActivate}
                onSelect={onSelect}
                selectLabel={selectLabel}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** One entry inside a section: a role, a project, a degree. */
function AreaBlock({
  area,
  index,
  open,
  onToggle,
  activeId,
  onActivate,
  onSelect,
  selectLabel,
}: {
  area: ReviewArea;
  index: number;
  open: boolean;
  onToggle: () => void;
  activeId: number | null;
  onActivate: (id: number | null) => void;
  onSelect?: (comment: ReviewComment) => void;
  selectLabel?: string;
}) {
  const bodyId = `review-area-${area.key.replace(/\W+/g, "-")}`;

  return (
    <div className="border-t border-dashed border-slate-200 first:border-t-0 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-2 py-2.5 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "h-3 w-3 shrink-0 text-slate-300 transition-transform duration-200 ease-out motion-reduce:transition-none dark:text-slate-600",
            open && "rotate-90",
          )}
        />
        <span className="shrink-0 text-[11px] tabular-nums text-slate-300 dark:text-slate-600">
          {String(index).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700 dark:text-slate-200">
          {area.label}
        </span>
        <Meta>{area.notes.length}</Meta>
      </button>

      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ul className="pb-2 pl-5 pr-1">
            {area.notes.map((note) => (
              <Note
                key={note.id}
                comment={note}
                active={activeId === note.id}
                onActivate={onActivate}
                onSelect={onSelect}
                selectLabel={selectLabel}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** The note itself. Severity is marked here, where the problem is. */
function Note({
  comment,
  active,
  onActivate,
  onSelect,
  selectLabel,
}: {
  comment: ReviewComment;
  active: boolean;
  onActivate: (id: number | null) => void;
  onSelect?: (comment: ReviewComment) => void;
  selectLabel?: string;
}) {
  const major = comment.severity === "major";

  return (
    <li
      onMouseEnter={() => onActivate(comment.id)}
      onMouseLeave={() => onActivate(null)}
      className={cn(
        "-mx-1 rounded px-1 py-2 transition-colors",
        active && "bg-slate-50 dark:bg-slate-900/60",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-[10px] uppercase tracking-[0.08em]",
            major
              ? "font-medium text-slate-900 dark:text-slate-100"
              : "text-slate-400 dark:text-slate-500",
          )}
        >
          {major ? "Major" : "Minor"}
        </span>
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(comment)}
            onFocus={() => onActivate(comment.id)}
            onBlur={() => onActivate(null)}
            className="ml-auto shrink-0 text-[11px] text-slate-400 underline decoration-slate-200 underline-offset-4 outline-none transition-colors hover:text-slate-900 hover:decoration-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-500 dark:decoration-slate-700 dark:hover:text-slate-100 dark:focus-visible:ring-slate-100/25"
          >
            {selectLabel ?? "Go to"}
          </button>
        )}
      </div>

      {comment.quote && (
        <p className="mt-1 text-xs italic leading-relaxed text-slate-400 dark:text-slate-500">
          “{comment.quote}”
        </p>
      )}

      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
        {comment.comment}
      </p>

      {comment.fix && (
        <p className="mt-2 rounded bg-slate-50 px-2.5 py-2 text-[13px] leading-relaxed text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <span className="mr-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
            Fix
          </span>
          {comment.fix}
        </p>
      )}
    </li>
  );
}
