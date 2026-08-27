import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  rounded = "sm",
}: {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "full" | "none";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative isolate overflow-hidden bg-slate-100 dark:bg-slate-800",
        {
          none: "",
          sm: "rounded-sm",
          md: "rounded-md",
          lg: "rounded-lg",
          full: "rounded-full",
        }[rounded],
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        "dark:before:via-slate-700/70",
        "motion-reduce:animate-pulse motion-reduce:before:hidden",
        className,
      )}
    />
  );
}

const LINE_WIDTHS = ["w-full", "w-11/12", "w-10/12", "w-9/12", "w-7/12"];

export function SkeletonLines({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-2.5",
            index === lines - 1
              ? LINE_WIDTHS[LINE_WIDTHS.length - 1]
              : LINE_WIDTHS[index % (LINE_WIDTHS.length - 1)],
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
