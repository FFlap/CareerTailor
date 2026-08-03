import { Link, createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const STEPS = [
  {
    title: "Keep the job",
    body: "The browser extension saves a posting as you read it, or you paste one in. The description is what the tailoring works from.",
  },
  {
    title: "Generate the document",
    body: "A model writes the résumé or cover letter from your profile and the posting — your facts, reordered and reworded for the role.",
  },
  {
    title: "Edit and export",
    body: "Fields on the left, the typeset page on the right. Change a line, watch it re-render, export the PDF.",
  },
];

const POINTS = [
  {
    title: "Typeset, not templated HTML",
    body: "Documents are compiled with Typst, so the output is a real typeset PDF — the same file whether it renders in your browser or on the server.",
  },
  {
    title: "Your profile is the only source of facts",
    body: "The posting steers emphasis and wording. It never adds an employer, a skill, or a date you did not enter.",
  },
  {
    title: "No model touches it after generation",
    body: "Once the document exists, editing is deterministic: fields rebuild the source, and a compile error is shown to you rather than quietly rewritten.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-8">
          <span className="font-display text-sm font-semibold tracking-tight">
            CareerTailor
          </span>
          <div className="flex items-center gap-2">
            <Link
              to="/templates"
              className="rounded-md px-2.5 py-1.5 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              Templates
            </Link>
            <Authenticated>
              <Link
                to="/dashboard"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Dashboard
              </Link>
            </Authenticated>
            <AuthLoading>
              <Link
                to="/sign-up"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Get started
              </Link>
            </AuthLoading>
            <Unauthenticated>
              <Link
                to="/sign-in"
                className="rounded-md px-2.5 py-1.5 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Get started
              </Link>
            </Unauthenticated>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
          <h1 className="max-w-[18ch] font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            A résumé per job, without writing it from scratch each time.
          </h1>
          <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            Keep one profile. Point it at a posting. You get a typeset résumé and
            cover letter tailored to that role, in an editor where every field is
            yours to change.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Authenticated>
              <Link
                to="/generate"
                className="rounded-md bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Generate a document
              </Link>
            </Authenticated>
            <AuthLoading>
              <Link
                to="/sign-up"
                className="rounded-md bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Get started
              </Link>
            </AuthLoading>
            <Unauthenticated>
              <Link
                to="/sign-up"
                className="rounded-md bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Get started
              </Link>
            </Unauthenticated>
            <Link
              to="/templates"
              className="rounded-md border border-slate-200 px-4 py-2.5 text-[13px] text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              See the templates
            </Link>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto grid max-w-5xl px-5 sm:grid-cols-3 sm:px-8">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="border-slate-200 py-8 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0 dark:border-slate-800"
              >
                <span className="text-[13px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-2 text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
                  {step.title}
                </h2>
                <p className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-3">
            {POINTS.map((point) => (
              <div key={point.title}>
                <h2 className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {point.title}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {point.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-slate-400 sm:px-8 dark:text-slate-500">
          <span>CareerTailor</span>
          <Link
            to="/templates"
            className="transition-colors hover:text-slate-900 dark:hover:text-slate-100"
          >
            Templates
          </Link>
        </div>
      </footer>
    </div>
  );
}
