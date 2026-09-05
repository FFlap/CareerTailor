import { useUser } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { Logo } from "@/components/Logo";
import { ResumeDropZone } from "@/components/ResumeDropZone";
import {
  mergeParsedResume,
  profileToResume,
  resumeToProfile,
  type ResumeData,
} from "@/components/editor/model";
import { CountUp, Reveal, Rule, TypesetText, useStepTransition } from "./motion";
import { TypesetPage } from "./TypesetPage";
import {
  QUESTIONS,
  closingLine,
  suggestedLength,
  suggestedTemplates,
  type Answers,
} from "./questions";
import { api } from "@/lib/convex";
import { extractTextFromResume } from "@/lib/extractText";
import { DEFAULT_MODEL } from "@/lib/models";
import { isAcceptedMimeType, type ResumeUploadState } from "@/lib/resumeUpload";
import { RESUME_TEMPLATES } from "@/lib/templates";
import { TEMPLATE_PREVIEWS } from "@/lib/templatePreviews";
import { cn } from "@/lib/utils";
import { NO_ARGS } from "@/lib/warmQueries";

const WELCOME = 0;
const FIRST_QUESTION = 1;
const TEMPLATE_STEP = FIRST_QUESTION + QUESTIONS.length;
const RESUME_STEP = TEMPLATE_STEP + 1;
const FINALE = RESUME_STEP + 1;

const COUNTED_STEPS = FINALE - FIRST_QUESTION + 1;


const AUTO_ADVANCE_MS = 420;

export function OnboardingFlow({
  initialStep,
  initialAnswers,
}: {
  initialStep: number;
  initialAnswers: Answers;
}) {
  const navigate = useNavigate();
  const { user } = useUser();

  const settings = useQuery(api.settings.mySettings, NO_ARGS);
  const profileDoc = useQuery(api.profiles.myProfile, NO_ARGS);
  const saveProgress = useMutation(api.onboarding.saveProgress);
  const finish = useMutation(api.onboarding.finish);
  const upsertSettings = useMutation(api.settings.upsertMySettings);
  const upsertProfile = useMutation(api.profiles.upsertMyProfile);
  const parseResume = useAction(api.resumeParsing.parseResumeText);

  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [upload, setUpload] = useState<ResumeUploadState>({ status: "idle" });
  const [parsed, setParsed] = useState<ResumeData | null>(null);
  const [leaving, setLeaving] = useState(false);

  const { shown, direction, stepClass, go } = useStepTransition(
    Math.min(Math.max(initialStep, WELCOME), FINALE),
  );
  const autoAdvance = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (autoAdvance.current) clearTimeout(autoAdvance.current);
    },
    [],
  );

  const suggested = useMemo(() => suggestedTemplates(answers), [answers]);
  const chosenTemplate = templateId ?? suggested.resume;

  const existingProfile = useMemo(
    () => profileToResume((profileDoc as any)?.profile),
    [profileDoc],
  );
  const profileHasHistory = existingProfile.header.name.length > 0;

  const step = (next: number) => {
    if (next < WELCOME || next > FINALE) return;
    go(next);
    void saveProgress({ step: next, answers }).catch(() => {})
  };

  const choose = (key: keyof Answers, id: string) => {
    if (autoAdvance.current) return;
    const next = { ...answers, [key]: id };
    setAnswers(next);
    autoAdvance.current = setTimeout(() => {
      autoAdvance.current = null;
      go(shown + 1);
      void saveProgress({ step: shown + 1, answers: next }).catch(() => {});
    }, AUTO_ADVANCE_MS);
  };

  
  const commitTemplates = useCallback(async () => {
    try {
      await upsertSettings({
        defaultResumeTemplateId: chosenTemplate as any,
        defaultCoverTemplateId: suggested.cover,
        defaultModel: (settings?.defaultModel ?? DEFAULT_MODEL) as any,
      });
    } catch {
    }
  }, [chosenTemplate, settings?.defaultModel, suggested.cover, upsertSettings]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!isAcceptedMimeType(file.type)) {
      setUpload({
        status: "error",
        fileName: file.name,
        error: "Please upload a PDF or DOCX file",
      });
      return;
    }

    try {
      setUpload({ status: "extracting", fileName: file.name });
      const text = await extractTextFromResume(file);

      setUpload({ status: "parsing", fileName: file.name });
      const result = await parseResume({
        resumeText: text,
        model: DEFAULT_MODEL,
      });

      const merged = mergeParsedResume(existingProfile, result);
      await upsertProfile({ profile: resumeToProfile(merged) as any });
      setParsed(merged);
      setUpload({ status: "success", fileName: file.name });
    } catch (error) {
      setUpload({
        status: "error",
        fileName: file.name,
        error:
          error instanceof Error ? error.message : "Failed to read that résumé",
      });
    }
  }

  
  async function leave(status: "completed" | "skipped") {
    setLeaving(true);
    try {
      await finish({ answers, status });
    } catch {
    }
    if (status === "completed") {
      navigate({ to: "/generate", search: { tour: "1" } });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  const busy = upload.status === "extracting" || upload.status === "parsing";
  const question =
    shown >= FIRST_QUESTION && shown < TEMPLATE_STEP
      ? QUESTIONS[shown - FIRST_QUESTION]
      : null;

  const advance = useCallback(() => {
    if (shown === TEMPLATE_STEP) void commitTemplates();
    if (shown < FINALE) {
      go(shown + 1);
      void saveProgress({ step: shown + 1, answers }).catch(() => {});
    }
  }, [answers, commitTemplates, go, saveProgress, shown]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      if (event.key === "Escape") {
        event.preventDefault();
        void leave("skipped");
        return;
      }
      if (event.key === "Backspace" || event.key === "ArrowLeft") {
        if (shown > WELCOME) {
          event.preventDefault();
          step(shown - 1);
        }
        return;
      }
      if (question) {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < question.choices.length) {
          event.preventDefault();
          choose(question.key, question.choices[index].id);
          return;
        }
      }
      if (event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault();
        if (shown === FINALE) void leave("completed");
        else advance();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-[100dvh] min-h-screen flex-col bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex h-14 shrink-0 items-center justify-between px-5 sm:px-8">
        <Logo />
        <button
          type="button"
          onClick={() => void leave("skipped")}
          className="rounded-md px-2.5 py-1.5 text-[13px] text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:hover:bg-slate-900 dark:hover:text-slate-100"
        >
          Skip setup
        </button>
      </header>

      {shown > WELCOME && (
        <Progress current={shown - FIRST_QUESTION + 1} total={COUNTED_STEPS} />
      )}

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8">
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-center">
          <div key={shown} className={cn("w-full", stepClass)}>
          {shown === WELCOME && (
            <Welcome
              name={user?.firstName ?? ""}
              onStart={() => step(FIRST_QUESTION)}
              onSkip={() => void leave("skipped")}
            />
          )}

          {question && (
            <QuestionStep
              index={shown - FIRST_QUESTION}
              question={question}
              answer={answers[question.key]}
              direction={direction}
              onChoose={(id) => choose(question.key, id)}
            />
          )}

          {shown === TEMPLATE_STEP && (
            <TemplateStep
              direction={direction}
              selected={chosenTemplate}
              suggested={suggested.resume}
              onSelect={setTemplateId}
            />
          )}

          {shown === RESUME_STEP && (
            <ResumeStep
              direction={direction}
              state={upload}
              parsed={parsed}
              alreadyHasHistory={profileHasHistory && !parsed}
              onFile={(file) => void handleFile(file)}
            />
          )}

          {shown === FINALE && (
            <Finale
              direction={direction}
              answers={answers}
              hasProfile={profileHasHistory || parsed !== null}
            />
          )}
          </div>
        </div>
      </main>

      <footer
        className={cn(
          "shrink-0 border-t border-slate-200 px-4 py-3 sm:px-8 sm:py-4 dark:border-slate-800",
          shown === WELCOME && "hidden",
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => step(shown - 1)}
            disabled={shown === WELCOME}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:pointer-events-none disabled:opacity-0 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back
          </button>

          <span className="hidden text-[11px] text-slate-400 sm:block dark:text-slate-500">
            {question
              ? "Press 1–4 to answer, or Esc to skip setup"
              : "Press Enter to continue, or Esc to skip setup"}
          </span>

          {shown === FINALE ? (
            <button
              type="button"
              onClick={() => void leave("completed")}
              disabled={leaving}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-900/25 disabled:opacity-50 motion-reduce:transition-none dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {leaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Show me how to generate
              {!leaving && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
            </button>
          ) : (
            <button
              type="button"
              onClick={advance}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-900/25 disabled:opacity-40 motion-reduce:transition-none dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {shown === RESUME_STEP &&
              upload.status !== "success" &&
              !profileHasHistory
                ? "I'll type it in later"
                : "Continue"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}


function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 sm:px-8">
      <div className="flex flex-1 items-center gap-1.5">
        {Array.from({ length: total }, (_, index) => {
          const done = index < current - 1;
          const active = index === current - 1;
          return (
            <span
              key={index}
              className="relative h-px flex-1 overflow-hidden bg-slate-200 dark:bg-slate-800"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 bg-slate-900 transition-[width] duration-500 ease-out motion-reduce:transition-none dark:bg-slate-100",
                  done || active ? "w-full" : "w-0",
                )}
              />
            </span>
          );
        })}
      </div>
      <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        {String(current).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}

function StepHead({
  eyebrow,
  title,
  note,
  direction,
}: {
  eyebrow: string;
  title: string;
  note: string;
  direction: 1 | -1;
}) {
  return (
    <div className="mb-8">
      <Reveal
        as="p"
        index={0}
        direction={direction}
        className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500"
      >
        {eyebrow}
      </Reveal>
      <Reveal
        as="h1"
        index={1}
        direction={direction}
        className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl"
      >
        {title}
      </Reveal>
      <Rule delay={220} className="mt-4 max-w-md" />
      <Reveal
        as="p"
        index={3}
        direction={direction}
        className="mt-3 max-w-[56ch] text-sm text-slate-500 dark:text-slate-400"
      >
        {note}
      </Reveal>
    </div>
  );
}

function Welcome({
  name,
  onStart,
  onSkip,
}: {
  name: string;
  onStart: () => void;
  onSkip: () => void;
}) {
  const greeting = name ? `Hello, ${name}.` : "Welcome in.";

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <Reveal
          as="p"
          index={0}
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500"
        >
          Your account is ready
        </Reveal>

        <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
          <TypesetText text={greeting} delay={180} />
        </h1>

        <Rule delay={700} className="mt-6 max-w-sm" />

        <Reveal
          as="p"
          index={0}
          delay={760}
          className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-slate-600 dark:text-slate-400"
        >
          Four short questions and one upload, and you will have a profile, a
          template, and a résumé worth sending. Two minutes, and you can skip
          any of it.
        </Reveal>

        <ul className="mt-7 max-w-md">
          {[
            ["One profile", "Your facts, entered once and reused everywhere."],
            ["A posting", "What the tailoring reads to decide the emphasis."],
            ["A typeset PDF", "Compiled with Typst, edited field by field."],
          ].map(([title, body], index) => (
            <Reveal
              as="li"
              key={title}
              index={index}
              delay={900}
              className="flex flex-col gap-1 border-t border-slate-200 py-3 first:border-t-0 first:pt-0 sm:flex-row sm:gap-4 dark:border-slate-800"
            >
              <span className="shrink-0 text-[13px] font-medium sm:w-24">
                {title}
              </span>
              <span className="text-[13px] text-slate-500 dark:text-slate-400">
                {body}
              </span>
            </Reveal>
          ))}
        </ul>

        <Reveal index={0} delay={1180} className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-900/25 motion-reduce:transition-none dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Set me up
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md px-3 py-2.5 text-[13px] text-slate-500 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-slate-100"
          >
            I'll find my own way
          </button>
        </Reveal>
      </div>

      <div className="relative mx-auto hidden w-full max-w-[19rem] lg:block">
        <div
          aria-hidden
          className="ob-pulse absolute -inset-8 rounded-full bg-slate-100 blur-2xl dark:bg-slate-900"
        />
        <TypesetPage progress={0.55} delay={420} className="relative" />
      </div>
    </div>
  );
}

function QuestionStep({
  index,
  question,
  answer,
  direction,
  onChoose,
}: {
  index: number;
  question: (typeof QUESTIONS)[number];
  answer: string | undefined;
  direction: 1 | -1;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <StepHead
        eyebrow={question.eyebrow}
        title={question.title}
        note={question.note}
        direction={direction}
      />

      <ul className="grid gap-2 sm:grid-cols-2">
        {question.choices.map((choice, choiceIndex) => (
          <Reveal
            as="li"
            key={choice.id}
            index={choiceIndex + 4}
            direction={direction}
          >
            <ChoiceCard
              number={choiceIndex + 1}
              label={choice.label}
              hint={choice.hint}
              selected={answer === choice.id}
              onSelect={() => onChoose(choice.id)}
            />
          </Reveal>
        ))}
      </ul>

      <p className="sr-only" aria-live="polite">
        Question {index + 1} of {QUESTIONS.length}
      </p>
    </div>
  );
}


function ChoiceCard({
  number,
  label,
  hint,
  selected,
  onSelect,
}: {
  number: number;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group/choice flex h-full w-full items-start gap-3 rounded-lg border p-4 text-left outline-none",
        "transition-[border-color,background-color,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none",
        "hover:-translate-y-px",
        selected
          ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-900"
          : "border-slate-200 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] tabular-nums transition-colors duration-200 motion-reduce:transition-none",
          selected
            ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
            : "border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500",
        )}
      >
        {selected ? (
          <svg
            className="ob-check h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          number
        )}
      </span>

      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </span>
    </button>
  );
}

function TemplateStep({
  direction,
  selected,
  suggested,
  onSelect,
}: {
  direction: 1 | -1;
  selected: string;
  suggested: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <StepHead
        eyebrow="The look"
        title="Start on this one?"
        note="Picked from your answers, and saved as your default. Every document can use a different one."
        direction={direction}
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {RESUME_TEMPLATES.map((template, index) => {
          const isSelected = selected === template.id;
          return (
            <Reveal
              as="li"
              key={template.id}
              index={index + 4}
              direction={direction}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(template.id)}
                className={cn(
                  "group/template block w-full text-left outline-none",
                  "transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5 motion-reduce:transition-none",
                )}
              >
                <span
                  className={cn(
                    "block overflow-hidden rounded-md border bg-white transition-colors duration-200 motion-reduce:transition-none dark:bg-slate-900",
                    isSelected
                      ? "border-slate-900 dark:border-slate-100"
                      : "border-slate-200 group-hover/template:border-slate-400 dark:border-slate-800 dark:group-hover/template:border-slate-600",
                  )}
                >
                  <img
                    src={TEMPLATE_PREVIEWS[template.id]}
                    alt=""
                    loading="lazy"
                    className="aspect-[1/1.294] w-full object-cover object-top"
                  />
                </span>
                <span className="mt-2 flex items-center gap-1.5">
                  {isSelected && (
                    <Check
                      className="h-3 w-3 shrink-0 text-slate-900 dark:text-slate-100"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "truncate text-[12px]",
                      isSelected
                        ? "font-medium text-slate-900 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                  >
                    {template.label}
                  </span>
                </span>
                {template.id === suggested && (
                  <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
                    Suggested for you
                  </span>
                )}
              </button>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}

function ResumeStep({
  direction,
  state,
  parsed,
  alreadyHasHistory,
  onFile,
}: {
  direction: 1 | -1;
  state: ResumeUploadState;
  parsed: ResumeData | null;
  alreadyHasHistory: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <StepHead
        eyebrow="Your history"
        title="Bring in a résumé you already have"
        note="It is read once to fill your profile, and saved straight away. Nothing is generated from it yet."
        direction={direction}
      />

      <Reveal index={4} direction={direction}>
        <ResumeDropZone state={state} onFile={onFile} />
      </Reveal>

      {parsed ? (
        <ParsedTally resume={parsed} />
      ) : alreadyHasHistory ? (
        <Reveal
          index={5}
          direction={direction}
          className="mt-4 border-t border-slate-200 pt-4 text-[13px] text-slate-500 dark:border-slate-800 dark:text-slate-400"
        >
          Your profile already has details in it, so this step is optional —
          uploading fills in the blanks without overwriting what is there.
        </Reveal>
      ) : (
        <Reveal
          index={5}
          direction={direction}
          className="mt-4 border-t border-slate-200 pt-4 text-[13px] text-slate-500 dark:border-slate-800 dark:text-slate-400"
        >
          No file handy? Continue, and type it into your profile whenever you
          like — nothing here is locked in.
        </Reveal>
      )}
    </div>
  );
}


function ParsedTally({ resume }: { resume: ResumeData }) {
  const tally = [
    { label: "roles", value: resume.experience.length },
    {
      label: "bullet points",
      value: resume.experience.reduce(
        (total, entry) => total + entry.bullets.length,
        0,
      ),
    },
    {
      label: "skills",
      value: resume.skills.reduce((total, group) => total + group.items.length, 0),
    },
    { label: "projects", value: resume.projects.length },
    { label: "schools", value: resume.education.length },
  ].filter((entry) => entry.value > 0);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Read and saved to your profile
      </div>
      <Rule delay={120} className="mt-3" />
      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
        {tally.map((entry, index) => (
          <div
            key={entry.label}
            className="ob-count"
            style={{ "--i": index } as CSSProperties}
          >
            <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {entry.label}
            </dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">
              <CountUp to={entry.value} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-[60ch] text-[13px] text-slate-500 dark:text-slate-400">
        Anything the parser misread is yours to fix on the profile page — it is
        a starting point, not a verdict.
      </p>
    </div>
  );
}

const BEATS = [
  {
    title: "Give it the posting",
    body: "Paste a job description on the Generate page, or let the browser extension keep one as you read it.",
  },
  {
    title: "It writes from your profile",
    body: "Your facts, reordered and reworded for that role. It never invents an employer, a skill, or a date.",
  },
  {
    title: "You edit the page itself",
    body: "Fields on the left, the typeset PDF on the right. Change a line, watch it recompile, export it.",
  },
  {
    title: "Or have one marked instead",
    body: "The Review tab scores a résumé you already have against the rubric a recruiter reads with, and keeps the notes next to the document.",
  },
];

function Finale({
  direction,
  answers,
  hasProfile,
}: {
  direction: 1 | -1;
  answers: Answers;
  hasProfile: boolean;
}) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setBeat((current) => (current + 1) % BEATS.length),
      3200,
    );
    return () => clearInterval(timer);
  }, []);

  const length = suggestedLength(answers) === "2_pages" ? "two pages" : "one page";

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <StepHead
          eyebrow="That's the setup"
          title="Here is how generating works"
          note={closingLine(answers)}
          direction={direction}
        />

        <ul>
          {BEATS.map((item, index) => {
            const active = index === beat;
            return (
              <Reveal
                as="li"
                key={item.title}
                index={index + 4}
                direction={direction}
                className="border-t border-slate-200 first:border-t-0 dark:border-slate-800"
              >
                <button
                  type="button"
                  onClick={() => setBeat(index)}
                  className="flex w-full gap-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
                >
                  <span
                    className={cn(
                      "text-[13px] tabular-nums transition-colors duration-300 motion-reduce:transition-none",
                      active
                        ? "font-medium text-slate-900 dark:text-slate-100"
                        : "text-slate-400 dark:text-slate-600",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-[13px] font-medium transition-colors duration-300 motion-reduce:transition-none",
                        active
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      {item.title}
                    </span>
                    
                    <span
                      className={cn(
                        "mt-1 block max-w-[52ch] text-[13px] leading-relaxed transition-colors duration-300 motion-reduce:transition-none",
                        active
                          ? "text-slate-600 dark:text-slate-400"
                          : "text-slate-400 dark:text-slate-600",
                      )}
                    >
                      {item.body}
                    </span>
                  </span>
                </button>
              </Reveal>
            );
          })}
        </ul>

        <Reveal
          as="p"
          index={8}
          direction={direction}
          className="mt-6 text-[13px] text-slate-500 dark:text-slate-400"
        >
          {hasProfile
            ? `Your profile is in, your template is set, and we will aim for ${length}.`
            : `Your template is set and we will aim for ${length}. Add your history on the profile page and the first document can be written.`}
        </Reveal>
      </div>

      <div className="relative mx-auto hidden w-full max-w-[19rem] lg:block">
        
        <TypesetPage progress={(beat + 1) / BEATS.length} className="relative" />
      </div>
    </div>
  );
}
