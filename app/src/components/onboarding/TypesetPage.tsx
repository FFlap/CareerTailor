import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";



type Line = { width: string; heading?: boolean };

const LINES: Line[] = [
  { width: "42%", heading: true },
  { width: "64%" },
  { width: "28%", heading: true },
  { width: "92%" },
  { width: "86%" },
  { width: "74%" },
  { width: "24%", heading: true },
  { width: "88%" },
  { width: "68%" },
  { width: "80%" },
  { width: "45%" },
];

export function TypesetPage({
  
  progress = 1,
  delay = 0,
  className,
}: {
  progress?: number;
  delay?: number;
  className?: string;
}) {
  const set = Math.round(LINES.length * Math.max(0, Math.min(1, progress)));

  return (
    <div
      aria-hidden
      className={cn(
        "ob-page-in aspect-[1/1.294] w-full rounded-[3px] border border-slate-200 bg-white p-[8%] resume-shadow dark:border-slate-800",
        className,
      )}
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    >
      <div className="flex h-full flex-col gap-[3.2%]">
        {LINES.map((line, index) => {
          const isSet = index < set;
          const isCurrent = index === set - 1;
          return (
            <div key={index} className="flex items-center gap-1.5">
              <div
                key={isSet ? "set" : "blank"}
                className={cn(
                  "ob-typeset rounded-[1px] transition-opacity duration-300",
                  line.heading
                    ? "h-[2.2%] min-h-[3px] bg-slate-900 dark:bg-slate-300"
                    : "h-[1.4%] min-h-[2px] bg-slate-300 dark:bg-slate-700",
                  isSet ? "opacity-100" : "opacity-0",
                )}
                style={
                  {
                    width: line.width,
                    "--i": index,
                    "--delay": `${delay + 220}ms`,
                  } as CSSProperties
                }
              />
              {isCurrent && progress < 1 && (
                <span className="ob-caret h-[1.6%] min-h-[6px] w-px bg-slate-900 dark:bg-slate-300" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
