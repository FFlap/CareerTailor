import { Plus, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { moveItem, removeAt, replaceAt } from "./model";
import { useDragReorder } from "./useDragReorder";
import { cn } from "@/lib/utils";

const lineBoxClass = "shrink-0 border-y border-transparent py-1 text-[13px]";

export function BulletList({
  value,
  onChange,
  listId,
  owner,
  placeholder = "One achievement, one line",
  addLabel = "Add bullet",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  listId: string;
  owner: string;
  placeholder?: string;
  addLabel?: string;
}) {
  const drag = useDragReorder({
    listId,
    onMove: (from, to) => onChange(moveItem(value, from, to)),
  });

  const focusBullet = (index: number, atEnd = false) => {
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLTextAreaElement>(
        `[data-bullet="${listId}:${index}"]`,
      );
      if (!field) return;
      field.focus();
      const caret = atEnd ? field.value.length : 0;
      field.setSelectionRange(caret, caret);
    });
  };

  const addAt = (index: number) => {
    const next = [...value];
    next.splice(index, 0, "");
    onChange(next);
    focusBullet(index);
  };

  return (
    <div className="space-y-1">
      {value.map((bullet, index) => (
        <div
          key={index}
          {...drag.dropProps(index)}
          className={cn(
            "group/bullet relative flex items-start gap-1.5",
            drag.dropEdge(index) === "top" &&
              "before:absolute before:inset-x-0 before:-top-0.5 before:h-px before:bg-slate-900 dark:before:bg-slate-100",
            drag.dropEdge(index) === "bottom" &&
              "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-slate-900 dark:after:bg-slate-100",
            drag.dragging === index && "opacity-40",
          )}
        >
          <button
            type="button"
            {...drag.dragProps(
              index,
              `bullet ${index + 1} for ${owner}`,
              value.length,
            )}
            className={cn(
              lineBoxClass,
              "cursor-grab rounded px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 active:cursor-grabbing dark:focus-visible:ring-slate-100/25",
            )}
          >
            <span className="flex h-[1.625em] items-center">
              <span
                aria-hidden
                className="block h-1.5 w-1.5 rounded-full bg-slate-400 transition-colors group-hover/bullet:bg-slate-900 motion-reduce:transition-none dark:bg-slate-600 dark:group-hover/bullet:bg-slate-100"
              />
            </span>
          </button>

          <BulletField
            id={`${listId}:${index}`}
            value={bullet}
            label={`Bullet ${index + 1} for ${owner}`}
            placeholder={index === 0 ? placeholder : ""}
            onChange={(next) => onChange(replaceAt(value, index, next))}
            onEnter={() => addAt(index + 1)}
            onBackspaceEmpty={() => {
              if (value.length === 1) return;
              onChange(removeAt(value, index));
              if (index > 0) focusBullet(index - 1, true);
            }}
          />

          <button
            type="button"
            onClick={() => onChange(removeAt(value, index))}
            aria-label={`Remove bullet ${index + 1} for ${owner}`}
            className={cn(
              lineBoxClass,
              "rounded px-1 text-slate-300 opacity-0 outline-none transition-opacity hover:text-slate-900 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-slate-900/15 group-hover/bullet:opacity-100 motion-reduce:transition-none dark:text-slate-600 dark:hover:text-slate-100 dark:focus-visible:ring-slate-100/25",
            )}
          >
            <span className="flex h-[1.625em] items-center">
              <X className="h-3 w-3" />
            </span>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => addAt(value.length)}
        className="flex items-center gap-1.5 pl-0.5 pt-0.5 text-[11px] text-slate-400 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:text-slate-500 dark:hover:text-slate-100"
      >
        <Plus className="h-3 w-3" />
        {value.length ? addLabel : `${addLabel} — Enter starts the next one`}
      </button>
    </div>
  );
}

function BulletField({
  id,
  value,
  label,
  placeholder,
  onChange,
  onEnter,
  onBackspaceEmpty,
}: {
  id: string;
  value: string;
  label: string;
  placeholder: string;
  onChange: (next: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      data-bullet={id}
      rows={1}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value.replace(/\n/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
        }
        if (
          event.key === "Backspace" &&
          !value &&
          event.currentTarget.selectionStart === 0
        ) {
          event.preventDefault();
          onBackspaceEmpty();
        }
      }}
      className="min-h-[1.75rem] flex-1 resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-slate-900 outline-none transition-colors placeholder:text-slate-300 hover:border-slate-200 focus:border-slate-400 dark:text-slate-100 dark:placeholder:text-slate-700 dark:hover:border-slate-800 dark:focus:border-slate-600"
    />
  );
}
