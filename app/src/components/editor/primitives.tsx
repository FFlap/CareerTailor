import { ChevronDown, ChevronRight, GripVertical, Plus, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const controlClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-none outline-none transition-colors placeholder:text-slate-300 focus-visible:border-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700 dark:focus-visible:border-slate-600";

const iconButtonClass =
  "flex shrink-0 items-center justify-center rounded text-slate-300 outline-none transition-colors hover:text-slate-900 focus-visible:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:text-slate-600 dark:hover:text-slate-100 dark:focus-visible:text-slate-100 dark:focus-visible:ring-slate-100/25";

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
        "text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type DragHandleProps = {
  "data-drag-handle": string;
  draggable: true;
  "aria-label": string;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: (event: React.DragEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
};

export type DropRowProps = {
  "data-drag-row": boolean;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
};

function Grip({
  handle,
  size = "md",
}: {
  handle: DragHandleProps;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      {...handle}
      className={cn(
        iconButtonClass,
        "cursor-grab self-stretch px-0.5 active:cursor-grabbing",
        size === "sm" ? "-ml-3" : "-ml-1",
      )}
    >
      <GripVertical
        aria-hidden
        className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}
      />
    </button>
  );
}

function dropRuleClass(edge: "top" | "bottom" | null) {
  if (!edge) return "";
  return edge === "top"
    ? "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-slate-900 dark:before:bg-slate-100"
    : "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-slate-900 dark:after:bg-slate-100";
}

export function Section({
  title,
  domId,
  count,
  preview,
  open,
  onToggle,
  onAdd,
  addLabel,
  onRemove,
  removeLabel,
  handle,
  row,
  edge = null,
  dragging = false,
  children,
}: {
  title: string;
  domId?: string;
  count?: number;
  preview?: string;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
  handle?: DragHandleProps;
  row?: DropRowProps;
  edge?: "top" | "bottom" | null;
  dragging?: boolean;
  children?: ReactNode;
}) {
  const sectionId = `section-${domId ?? title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section
      {...row}
      className={cn(
        "relative border-b border-slate-200/80 last:border-b-0 dark:border-slate-800",
        dropRuleClass(edge),
        dragging && "opacity-40",
      )}
    >
      <div className="group/section flex items-stretch gap-0.5">
        {handle ? (
          <Grip handle={handle} />
        ) : (
          <span aria-hidden className="-ml-1 w-[1.125rem] shrink-0" />
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={sectionId}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ease-out motion-reduce:transition-none dark:text-slate-500",
              open && "rotate-90",
            )}
          />
          <span className="shrink-0 text-[13px] font-medium tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </span>
          {typeof count === "number" && count > 0 && <Meta>{count}</Meta>}
          {!open && preview && (
            <span className="truncate text-xs text-slate-400 dark:text-slate-600">
              {preview}
            </span>
          )}
        </button>

        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className={cn(
              iconButtonClass,
              "px-1 opacity-0 focus-visible:opacity-100 group-hover/section:opacity-100",
            )}
            aria-label={addLabel}
            title={addLabel}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              iconButtonClass,
              "px-1 opacity-0 focus-visible:opacity-100 group-hover/section:opacity-100",
            )}
            aria-label={removeLabel}
            title={removeLabel}
          >
            <X className="h-3.5 w-3.5" />
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
          "text-[11px] font-medium text-slate-500 dark:text-slate-400",
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
  preview,
  open,
  onToggle,
  onRemove,
  removeLabel,
  handle,
  row,
  edge = null,
  dragging = false,
  children,
}: {
  index: number;
  title: string;
  preview?: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
  handle?: DragHandleProps;
  row?: DropRowProps;
  edge?: "top" | "bottom" | null;
  dragging?: boolean;
  children: ReactNode;
}) {
  const itemId = `item-${index}-${title.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <div
      {...row}
      className={cn(
        "group/item relative border-t border-dashed border-slate-200 first:border-t-0 dark:border-slate-800",
        dropRuleClass(edge),
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-stretch gap-0.5">
        {handle && <Grip handle={handle} size="sm" />}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={itemId}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:focus-visible:ring-slate-100/25"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "h-3 w-3 shrink-0 text-slate-300 transition-transform duration-200 ease-out motion-reduce:transition-none dark:text-slate-600",
              open && "rotate-90",
            )}
          />
          <Meta className="tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </Meta>
          <span
            className={cn(
              "truncate text-xs",
              title
                ? "text-slate-700 dark:text-slate-300"
                : "text-slate-400 dark:text-slate-600",
            )}
          >
            {title || "Untitled"}
          </span>
          {!open && preview && (
            <span className="truncate text-xs text-slate-400 dark:text-slate-600">
              {preview}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className={cn(
            iconButtonClass,
            "px-1 opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100",
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        id={itemId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-3 pl-5">{children}</div>
        </div>
      </div>
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

export function TokenInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const seen = new Set(value.map((item) => item.toLowerCase()));
    const additions = parts.filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (additions.length) onChange([...value, ...additions]);
  };

  return (
    <div
      className={cn(
        controlClass,
        "flex h-auto min-h-8 flex-wrap items-center gap-1 py-1 pl-1.5 pr-1",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="flex items-center gap-1 rounded bg-slate-100 py-0.5 pl-1.5 pr-0.5 text-[12px] text-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {item}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(value.filter((_, idx) => idx !== index));
            }}
            aria-label={`Remove ${item}`}
            className={cn(iconButtonClass, "h-3.5 w-3.5")}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        value={draft}
        placeholder={value.length ? "" : placeholder}
        onChange={(event) => {
          const next = event.target.value;
          if (next.includes(",")) {
            const parts = next.split(",");
            commit(parts.slice(0, -1).join(","));
            setDraft(parts[parts.length - 1].trimStart());
            return;
          }
          setDraft(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || (event.key === "Tab" && draft.trim())) {
            event.preventDefault();
            commit(draft);
            setDraft("");
          }
          if (event.key === "Backspace" && !draft && value.length) {
            event.preventDefault();
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          commit(draft);
          setDraft("");
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (!/[,\n]/.test(text)) return;
          event.preventDefault();
          commit(text.replace(/\n/g, ","));
        }}
        className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-700"
      />
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(controlClass, "cursor-pointer appearance-none pr-7")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      />
    </div>
  );
}
