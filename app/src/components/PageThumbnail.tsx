import { useEffect, useRef, useState } from "react";

import { getThumbnail } from "@/lib/thumbnails";
import { cn } from "@/lib/utils";

/**
 * The first page of a document, drawn at tile size. Compiling is deferred
 * until the tile is nearly on screen, and until then the page is standing in
 * for itself: ruled lines in the shape the document type actually takes.
 */
export function PageThumbnail({
  cacheKey,
  produce,
  shape,
  className,
}: {
  cacheKey: string;
  produce: () => Promise<string>;
  shape: "resume" | "cover_letter" | "review";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const produceRef = useRef(produce);
  produceRef.current = produce;

  const [near, setNear] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // The first screenful is measured rather than observed, so its pages start
    // compiling on mount instead of one frame later.
    const rect = element.getBoundingClientRect();
    const lead = 600;
    if (rect.bottom > -lead && rect.top < window.innerHeight + lead) {
      setNear(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      // A screenful of lead time, so scrolling lands on finished pages.
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    setFailed(false);
    getThumbnail(cacheKey, () => produceRef.current())
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, near]);

  return (
    <div ref={ref} className={cn("relative h-full w-full bg-white", className)}>
      <PageSkeleton
        shape={shape}
        seed={cacheKey}
        settled={Boolean(src) || failed}
      />
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full animate-in fade-in object-cover object-top duration-500 motion-reduce:animate-none"
        />
      )}
      {failed && (
        <span className="absolute inset-x-0 bottom-0 bg-white/90 px-2 py-1 text-center text-[10px] text-slate-400">
          Preview unavailable
        </span>
      )}
    </div>
  );
}

/** A page reduced to its rhythm: rules where the type would be. */
export function PageSkeleton({
  shape,
  seed,
  settled,
}: {
  shape: "resume" | "cover_letter" | "review";
  seed: string;
  settled: boolean;
}) {
  const lines = placeholderLines(shape, seed);

  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 flex flex-col gap-[3.5%] px-[12%] py-[11%] transition-opacity duration-500",
        settled ? "opacity-0" : "opacity-100 motion-safe:animate-pulse",
      )}
    >
      {lines.map((line, index) => (
        <span
          key={index}
          style={{ width: `${line.width}%` }}
          className={cn(
            "block shrink-0 rounded-[1px] bg-slate-200/90",
            line.rule ? "h-[1.6%]" : "h-[1%]",
            line.gapBefore && "mt-[4%]",
          )}
        />
      ))}
    </div>
  );
}

type PlaceholderLine = { width: number; rule?: boolean; gapBefore?: boolean };

function placeholderLines(
  shape: "resume" | "cover_letter" | "review",
  seed: string,
): PlaceholderLine[] {
  // Deterministic, so a tile keeps the same shape between visits.
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  const jitter = (step: number, spread: number, base: number) => {
    hash = (hash * 1103515245 + 12345 + step) % 2147483648;
    return base + ((hash >> 8) % spread);
  };

  if (shape === "cover_letter") {
    const lines: PlaceholderLine[] = [
      { width: 42, rule: true },
      { width: 28 },
    ];
    for (let block = 0; block < 3; block += 1) {
      for (let line = 0; line < 4; line += 1) {
        lines.push({
          width: line === 3 ? jitter(line + block, 30, 40) : jitter(line, 12, 84),
          gapBefore: line === 0,
        });
      }
    }
    return lines;
  }

  const lines: PlaceholderLine[] = [
    { width: 54, rule: true },
    { width: 36 },
  ];
  for (let section = 0; section < 3; section += 1) {
    lines.push({ width: 30, rule: true, gapBefore: true });
    const rows = shape === "review" ? 4 : 3;
    for (let row = 0; row < rows; row += 1) {
      lines.push({ width: jitter(section * 10 + row, 26, 62) });
    }
  }
  return lines;
}
