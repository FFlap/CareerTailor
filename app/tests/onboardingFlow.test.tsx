import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFunctionName } from "convex/server";

import { api } from "../src/lib/convex";

const navigate = vi.fn();
const mutations = new Map<string, ReturnType<typeof vi.fn>>();

const mutation = (reference: unknown) =>
  mutations.get(getFunctionName(reference as never));

vi.mock("@clerk/tanstack-react-start", () => ({
  useUser: () => ({ user: { firstName: "Ada" } }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("convex/react", async () => {
  const { getFunctionName: nameOf } = await import("convex/server");
  return {
    useQuery: (reference: unknown) => {
      const name = nameOf(reference as never);
      if (name === "settings:mySettings") {
        return { defaultModel: "gemma-4-31b-it", exists: false };
      }
      if (name === "profiles:myProfile") return null;
      return undefined;
    },
    useMutation: (reference: unknown) => {
      const name = nameOf(reference as never);
      if (!mutations.has(name)) {
        mutations.set(name, vi.fn().mockResolvedValue({ ok: true }));
      }
      return mutations.get(name)!;
    },
    useAction: () => vi.fn(),
  };
});

const { OnboardingFlow } = await import(
  "../src/components/onboarding/OnboardingFlow"
);

beforeEach(() => {
  navigate.mockClear();
  mutations.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});


const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(800);
    await Promise.resolve();
  });
};

const start = (initialStep = 0) =>
  render(<OnboardingFlow initialStep={initialStep} initialAnswers={{}} />);

describe("onboarding flow", () => {
  it("greets the account by name and offers a way past it", () => {
    start();
    expect(document.body.textContent).toContain("Hello, Ada.");
    expect(screen.getByText("Set me up")).toBeTruthy();
  });

  it("walks from the welcome into the first question", async () => {
    start();
    fireEvent.click(screen.getByText("Set me up"));
    await settle();

    expect(screen.getByText("What are you working on?")).toBeTruthy();
    expect(screen.getByText("A full job hunt")).toBeTruthy();
  });

  it("answers a question from the number row and moves on by itself", async () => {
    start(1);
    expect(screen.getByText("What are you working on?")).toBeTruthy();

    fireEvent.keyDown(window, { key: "2" });
    await settle();

    expect(screen.getByText("How far into your career are you?")).toBeTruthy();
  });

  it("goes back to the previous question with the Back button", async () => {
    start(2);
    expect(screen.getByText("How far into your career are you?")).toBeTruthy();

    fireEvent.click(screen.getByText("Back"));
    await settle();

    expect(screen.getByText("What are you working on?")).toBeTruthy();
  });

  it("records the answer that was chosen", async () => {
    start(1);
    fireEvent.click(screen.getByText("Refreshing an old résumé"));
    await settle();

    const saveProgress = mutation(api.onboarding.saveProgress);
    expect(saveProgress).toHaveBeenCalledWith(
      expect.objectContaining({ answers: { goal: "refresh" } }),
    );
  });

  it("saves the chosen template as the account default on the way out", async () => {
    start(4);
    expect(screen.getByText("Start on this one?")).toBeTruthy();

    fireEvent.click(screen.getByText("Neat CV"));
    fireEvent.click(screen.getByText("Continue"));
    await settle();

    expect(mutation(api.settings.upsertMySettings)).toHaveBeenCalledWith(
      expect.objectContaining({ defaultResumeTemplateId: "neat_cv" }),
    );
  });

  it("ends on the walkthrough of how generating works", async () => {
    start(6);
    expect(screen.getByText("Here is how generating works")).toBeTruthy();

    fireEvent.click(screen.getByText("Show me how to generate"));
    await settle();

    expect(mutation(api.onboarding.finish)).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
    expect(navigate).toHaveBeenCalledWith({
      to: "/generate",
      search: { tour: "1" },
    });
  });

  it("leaves for the dashboard when setup is skipped", async () => {
    start(2);
    fireEvent.click(screen.getByText("Skip setup"));
    await settle();

    expect(mutation(api.onboarding.finish)).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped" }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("skips out on Escape from anywhere in the flow", async () => {
    start(3);
    fireEvent.keyDown(window, { key: "Escape" });
    await settle();

    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
});
