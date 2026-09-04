import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";


const EXIT_MS = 200;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}


export function useStepTransition(initial: number) {
  const [shown, setShown] = useState(initial);
  const [leaveDirection, setLeaveDirection] = useState<1 | -1>(1);
  const [enterDirection, setEnterDirection] = useState<1 | -1>(1);
  const [leaving, setLeaving] = useState(false);
  const shownRef = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const land = useCallback((next: number, direction: 1 | -1) => {
    shownRef.current = next;
    setShown(next);
    setEnterDirection(direction);
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next === shownRef.current || timer.current) return;
      const direction: 1 | -1 = next > shownRef.current ? 1 : -1;
      setLeaveDirection(direction);

      if (prefersReducedMotion()) {
        land(next, direction);
        return;
      }

      setLeaving(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        land(next, direction);
        setLeaving(false);
      }, EXIT_MS);
    },
    [land],
  );

  const stepClass = leaving
    ? leaveDirection === 1
      ? "ob-leave"
      : "ob-leave-back"
    : enterDirection === 1
      ? "ob-rise"
      : "ob-rise-back";

  return { shown, direction: enterDirection, leaving, stepClass, go };
}


export function Reveal({
  index = 0,
  delay = 0,
  direction = 1,
  className,
  as: As = "div",
  children,
}: {
  index?: number;
  
  delay?: number;
  direction?: 1 | -1;
  className?: string;
  as?: "div" | "p" | "h1" | "h2" | "li" | "span";
  children: ReactNode;
}) {
  return (
    <As
      className={cn(direction === 1 ? "ob-rise" : "ob-rise-back", className)}
      style={{ "--i": index, "--delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </As>
  );
}


export function TypesetText({
  text,
  delay = 0,
  className,
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {text.split("").map((character, index) => (
        <span
          key={`${character}-${index}`}
          aria-hidden
          className="ob-letter"
          style={{ "--i": index, "--delay": `${delay}ms` } as CSSProperties}
        >
          
          {character === " " ? " " : character}
        </span>
      ))}
    </span>
  );
}


export function CountUp({
  to,
  durationMs = 700,
}: {
  to: number;
  durationMs?: number;
}) {
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (prefersReducedMotion() || to === 0) {
      setValue(to);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setValue(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, durationMs]);

  return <>{value}</>;
}


export function Rule({
  delay = 0,
  className,
}: {
  delay?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("ob-rule h-px bg-slate-200 dark:bg-slate-800", className)}
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    />
  );
}
