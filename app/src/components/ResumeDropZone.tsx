import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import type { ResumeUploadState } from "@/lib/resumeUpload";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function ResumeDropZone({
  state,
  onFile,
}: {
  state: ResumeUploadState;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const busy = state.status === "extracting" || state.status === "parsing";

  const take = (file: File | undefined) => {
    if (!file || busy) return;
    onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={(event) => take(event.target.files?.[0])}
        className="sr-only"
        aria-label="Upload a résumé"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          take(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:focus-visible:ring-slate-100/25",
          dragging
            ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-900"
            : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600",
          busy && "cursor-wait",
        )}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          {busy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
          {dragging ? "Drop it here" : "Start from an existing résumé"}
        </span>
        <span className="mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">
          Drop a PDF or DOCX anywhere in this box, or click to choose one. It is
          read once to fill in the fields below; you can change anything
          afterwards.
        </span>

        {state.status !== "idle" && (
          <span
            className={cn(
              "mt-3 text-xs",
              state.status === "error"
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-500 dark:text-slate-400",
            )}
          >
            {state.status === "extracting" && "Extracting text…"}
            {state.status === "parsing" && "Reading it with AI…"}
            {state.status === "success" && `Filled in from ${state.fileName}.`}
            {state.status === "error" && state.error}
          </span>
        )}
      </button>
    </>
  );
}
