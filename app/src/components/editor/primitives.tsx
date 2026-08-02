import { ChevronRight, Plus, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PaneTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={cn(
        "relative -mb-px border-b px-2.5 py-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:focus-visible:ring-slate-100/25",
        active
          ? "border-slate-900 font-medium text-slate-900 dark:border-slate-100 dark:text-slate-100"
          : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
      )}
    >
      {children}
    </button>
  );
}

export function Meta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  count,
  open,
  onToggle,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addLabel?: string;
  children?: ReactNode;
}) {
  const sectionId = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section className="border-b border-slate-200/80 last:border-b-0 dark:border-slate-800">
      <div className="group/section flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={sectionId}
          className="flex flex-1 items-center gap-2.5 py-3 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ease-out motion-reduce:transition-none dark:text-slate-500",
              open && "rotate-90",
            )}
          />
          <span className="text-[13px] font-medium tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </span>
          {typeof count === "number" && count > 0 && <Meta>{count}</Meta>}
        </button>

        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 px-1 text-slate-400 opacity-0 outline-none transition-opacity hover:text-slate-900 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-slate-900/15 group-hover/section:opacity-100 motion-reduce:transition-none dark:hover:text-slate-100 dark:focus-visible:ring-slate-100/25"
            aria-label={addLabel}
            title={addLabel}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div
        id={sectionId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-5 pl-6 pr-1">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function FieldRow({
  label,
  htmlFor,
  children,
  align = "center",
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className="grid gap-1 py-1.5 @lg/fields:grid-cols-[7.5rem_minmax(0,1fr)] @lg/fields:gap-3">
      <label
        htmlFor={htmlFor}
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500",
          align === "center" ? "@lg/fields:self-center" : "@lg/fields:pt-2",
        )}
      >
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ItemBlock({
  index,
  title,
  onRemove,
  removeLabel,
  children,
}: {
  index: number;
  title: string;
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="group/item border-t border-dashed border-slate-200 pt-3 first:border-t-0 first:pt-1 dark:border-slate-800">
      <div className="flex items-baseline gap-2 pb-1">
        <Meta className="tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </Meta>
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="ml-auto shrink-0 text-slate-300 opacity-0 outline-none transition-opacity hover:text-slate-900 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-slate-900/15 group-hover/item:opacity-100 motion-reduce:transition-none dark:text-slate-600 dark:hover:text-slate-100 dark:focus-visible:ring-slate-100/25"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function EmptyHint({
  children,
  onAdd,
  addLabel,
}: {
  children: ReactNode;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <p className="py-1 text-xs text-slate-400 dark:text-slate-500">
      {children}{" "}
      <button
        type="button"
        onClick={onAdd}
        className="text-slate-900 underline decoration-slate-300 underline-offset-4 outline-none hover:decoration-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-100 dark:decoration-slate-600 dark:hover:decoration-slate-100"
      >
        {addLabel}
      </button>
    </p>
  );
}
