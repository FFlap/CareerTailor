import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";
import { NO_ARGS } from "@/lib/warmQueries";

type Stop = {
  
  id: string;
  title: string;
  body: string;
};

const FORM_STOPS: Stop[] = [
  {
    id: "tour-posting",
    title: "Start with the posting",
    body: "Paste the job description here. It is the only thing that decides what gets emphasised — leave it empty and you get a general document from your profile instead.",
  },
  {
    id: "tour-templates",
    title: "Then the look",
    body: "Your résumé template is already set from setup — preview another before you commit, or clear it. A cover letter is opt-in: pick one here and it is written alongside.",
  },
  {
    id: "tour-voice",
    title: "Voice and length",
    body: "Length is enforced after writing: the résumé is compiled, the pages are counted, and it is trimmed if it runs over.",
  },
  {
    id: "tour-generate",
    title: "That's it — generate",
    body: "Roughly a minute. You land in the editor with fields on the left and the typeset PDF on the right, where every line is yours to change.",
  },
  {
    id: "tour-mode",
    title: "And the other half: Review",
    body: "Writing is one job; judging is the other. Switch to Review to score a résumé you already have — yours or a PDF you upload — against the rubric a recruiter reads with. Add the posting and it checks the keywords too.",
  },
];


const EMPTY_PROFILE_STOPS: Stop[] = [
  {
    id: "tour-profile-empty",
    title: "Your profile comes first",
    body: "Every document is written from your profile, so there is nothing to tailor until it has your name and history in it. Fill it in and this page turns into the form — we will pick the walkthrough up from there.",
  },
];


const PAD = 8;

const CARD_W = 352;
const CARD_H = 230;

const NARROW = 640;

const MOBILE_BAR = 68;

export function GenerateTour({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const onboarding = useQuery(api.onboarding.myOnboarding, NO_ARGS);
  const markTourDone = useMutation(api.onboarding.markTourDone);

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [variant, setVariant] = useState<"form" | "empty" | null>(null);
  const owed =
    onboarding?.status === "completed" || onboarding?.status === "skipped";
  const running =
    (active || owed) &&
    !dismissed &&
    onboarding !== undefined &&
    !onboarding.tourDone;

  const stops = variant === "empty" ? EMPTY_PROFILE_STOPS : FORM_STOPS;
  const stop = stops[Math.min(index, stops.length - 1)];

  const measure = useCallback(() => {
    if (!running) return;
    const onForm = document.getElementById("tour-posting") !== null;
    const onEmpty = document.getElementById("tour-profile-empty") !== null;
    setVariant(onForm ? "form" : onEmpty ? "empty" : null);

    const element = document.getElementById(stop.id);
    setRect(element ? element.getBoundingClientRect() : null);
  }, [running, stop.id]);
  useLayoutEffect(() => {
    if (!running) return;
    const element = document.getElementById(stop.id);
    const box = element?.getBoundingClientRect();
    const tall = (box?.height ?? 0) > window.innerHeight / 2;

    if (element && box && tall && window.innerWidth < NARROW) {
      window.scrollTo({
        top: window.scrollY + box.top - MOBILE_BAR,
        behavior: "smooth",
      });
    } else {
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    measure();
    const settle = setTimeout(measure, 420);
    return () => clearTimeout(settle);
  }, [measure, running, stop.id]);

  useEffect(() => {
    if (!running) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    const poll = setInterval(measure, 400);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      clearInterval(poll);
    };
  }, [measure, running]);

  const close = useCallback(() => {
    setDismissed(true);
    if (variant !== "empty") void markTourDone({}).catch(() => {});
    navigate({ to: "/generate", search: {}, replace: true });
  }, [markTourDone, navigate, variant]);

  const step = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= stops.length) {
        close();
        return;
      }
      setIndex(next);
    },
    [close, stops.length],
  );

  useEffect(() => {
    if (!running) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(index + 1);
      if (event.key === "ArrowLeft") step(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, index, running, step]);
  if (!running || !rect || typeof document === "undefined") return null;

  const top = Math.max(PAD, rect.top - PAD);
  const left = Math.max(PAD, rect.left - PAD);
  const width = Math.min(rect.width + PAD * 2, window.innerWidth - left - PAD);
  const height = Math.min(
    rect.height + PAD * 2,
    window.innerHeight - top - PAD,
  );
  const cardWidth = Math.min(CARD_W, window.innerWidth - 32);
  const clampLeft = (value: number) =>
    Math.max(PAD, Math.min(value, window.innerWidth - cardWidth - PAD));

  const roomBelow = window.innerHeight - (top + height);
  const roomRight = window.innerWidth - (left + width);

  let placement: Record<string, number>;
  if (window.innerWidth < NARROW && height > window.innerHeight / 2) {
    placement = { bottom: PAD, left: PAD };
  } else if (roomBelow > CARD_H) {
    placement = { top: top + height + 12, left: clampLeft(left) };
  } else if (top > CARD_H) {
    placement = { bottom: window.innerHeight - top + 12, left: clampLeft(left) };
  } else if (roomRight > cardWidth + 24) {
    placement = { top: Math.max(PAD, top), left: left + width + 12 };
  } else {
    placement = { top: Math.max(PAD, top), left: Math.max(PAD, left - cardWidth - 12) };
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={stop.title}>
      
      <div
        aria-hidden
        className="ob-spotlight pointer-events-none absolute rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] ring-1 ring-white/70 dark:ring-slate-100/30"
        style={{ top, left, width, height }}
      />

      
      <button
        type="button"
        aria-label="Close the walkthrough"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default outline-none"
      />

      <div
        className={cn(
          "ob-rise absolute w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900",
        )}
        style={placement}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            {String(Math.min(index + 1, stops.length)).padStart(2, "0")} /{" "}
            {String(stops.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close the walkthrough"
            className="-m-1 rounded p-1 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h2 className="mt-1 font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {stop.title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
          {stop.body}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => step(index - 1)}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:pointer-events-none disabled:opacity-0 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Back
          </button>
          <button
            type="button"
            onClick={() => step(index + 1)}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white outline-none transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-900/25 motion-reduce:transition-none dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {index >= stops.length - 1 ? "Got it" : "Next"}
            {index < stops.length - 1 && <ArrowRight className="h-3 w-3" aria-hidden />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
