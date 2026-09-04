import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Authenticated, useQuery } from "convex/react";
import { useEffect } from "react";

import { api } from "@/lib/convex";
import { NO_ARGS } from "@/lib/warmQueries";


const GUARDED = [
  "/dashboard",
  "/generate",
  "/documents",
  "/job-applications",
  "/profile",
];

export function OnboardingGate() {
  return (
    <Authenticated>
      <Redirector />
    </Authenticated>
  );
}

function Redirector() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onboarding = useQuery(api.onboarding.myOnboarding, NO_ARGS);

  const guarded = GUARDED.some((prefix) => pathname.startsWith(prefix));
  const needsSetup = onboarding?.status === "not_started";

  useEffect(() => {
    if (!guarded || !needsSetup) return;
    navigate({ to: "/onboarding", replace: true });
  }, [guarded, navigate, needsSetup]);

  return null;
}
