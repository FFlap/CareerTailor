import { createFileRoute, Link } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/convex";
import { NO_ARGS } from "@/lib/warmQueries";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <>
      <AuthLoading>
        <Placeholder />
      </AuthLoading>

      <Unauthenticated>
        <div className="grid min-h-screen place-items-center px-5 text-center">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Create an account first
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Setup writes to your profile, so it needs somewhere to write to.
            </p>
            <Link
              to="/sign-up"
              className="mt-5 inline-block rounded-md bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              Create account
            </Link>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <Resume />
      </Authenticated>
    </>
  );
}

function Resume() {
  const onboarding = useQuery(api.onboarding.myOnboarding, NO_ARGS);
  if (onboarding === undefined) return <Placeholder />;

  return (
    <OnboardingFlow
      initialStep={onboarding.status === "in_progress" ? onboarding.step : 0}
      initialAnswers={onboarding.answers ?? {}}
    />
  );
}

function Placeholder() {
  return (
    <div className="flex min-h-screen flex-col bg-white px-5 py-10 sm:px-8 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-px w-full max-w-sm" />
        <div className="grid gap-2 pt-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
