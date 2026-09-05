import { cn } from "@/lib/utils";

// Sampled from the wordmark logo: the tie runs light to dark top to bottom.
const SEGMENTS = [
  { fill: "#7C73F4", d: "M1.58 0 L23 0 L14.77 11.8 L8.54 11.8 Z" },
  { fill: "#756CF0", d: "M10.44 14.3 L16.77 14.3 L18.04 17.93 L3.16 25.95 L6.86 15.6 Z" },
  { fill: "#5849D1", d: "M18.67 20.2 L20.99 29.64 L0.11 40.61 L3.16 28.17 Z" },
  { fill: "#472E9F", d: "M21.52 31.6 L23.73 41.34 L12.35 51.68 L9.92 51.68 L1.16 43.2 Z" },
];

/** The tie alone. Decorative by default — label the link when it stands without the wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-0.85 -0.95 25.5 53.6"
      className={cn("h-[18px] w-auto shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      {/* Stroking each segment in its own fill rounds the corners without hand-cut arcs. */}
      <g strokeWidth="0.9" strokeLinejoin="round">
        {SEGMENTS.map((segment) => (
          <path
            key={segment.d}
            d={segment.d}
            fill={segment.fill}
            stroke={segment.fill}
          />
        ))}
      </g>
    </svg>
  );
}

const SIZES = {
  sm: { gap: "gap-2", mark: "h-[18px]", text: "text-sm font-semibold" },
  lg: { gap: "gap-2.5", mark: "h-7", text: "text-lg font-bold" },
} as const;

export function Logo({
  size = "lg",
  className,
  markClassName,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  markClassName?: string;
}) {
  const scale = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", scale.gap, className)}>
      <LogoMark className={cn(scale.mark, markClassName)} />
      <span className={cn("font-display tracking-tight", scale.text)}>
        CareerTailor
      </span>
    </span>
  );
}
