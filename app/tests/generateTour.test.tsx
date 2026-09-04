import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../src/lib/convex";

const navigate = vi.fn();
const mutations = new Map<string, ReturnType<typeof vi.fn>>();
let tourDone = false;
let status = "completed";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("convex/react", async () => {
  const { getFunctionName: nameOf } = await import("convex/server");
  return {
    useQuery: () => ({ status, tourDone }),
    useMutation: (reference: unknown) => {
      const name = nameOf(reference as never);
      if (!mutations.has(name)) {
        mutations.set(name, vi.fn().mockResolvedValue({ ok: true }));
      }
      return mutations.get(name)!;
    },
  };
});

const { GenerateTour } = await import(
  "../src/components/onboarding/GenerateTour"
);


function anchors(ids: string[]) {
  for (const id of ids) {
    const element = document.createElement("div");
    element.id = id;
    document.body.append(element);
  }
}

beforeEach(() => {
  tourDone = false;
  status = "completed";
  navigate.mockClear();
  mutations.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const ALL = [
  "tour-posting",
  "tour-templates",
  "tour-voice",
  "tour-generate",
  "tour-mode",
];
const markedDone = () =>
  mutations.get(getFunctionName(api.onboarding.markTourDone));

describe("generate walkthrough", () => {
  it("runs when onboarding hands over with the parameter", () => {
    anchors(ALL);
    render(<GenerateTour active />);
    expect(screen.getByText("Start with the posting")).toBeTruthy();
  });

  it("re-arms itself for an account that was owed it but never saw it", () => {
    anchors(ALL);
    render(<GenerateTour active={false} />);
    expect(screen.getByText("Start with the posting")).toBeTruthy();
  });

  it("leaves alone an account that never went through setup", () => {
    status = "not_started";
    anchors(ALL);
    render(<GenerateTour active={false} />);
    expect(screen.queryByText("Start with the posting")).toBeNull();
  });

  it("waits rather than pointing at nothing when nothing is up yet", () => {
    render(<GenerateTour active />);
    expect(screen.queryByText("Start with the posting")).toBeNull();
  });

  it("does not run a second time for an account that has seen it", () => {
    tourDone = true;
    anchors(ALL);
    render(<GenerateTour active />);
    expect(screen.queryByText("Start with the posting")).toBeNull();
  });

  it("points at the profile instead when there is no form to walk through", () => {
    anchors(["tour-profile-empty"]);
    render(<GenerateTour active />);

    expect(screen.getByText("Your profile comes first")).toBeTruthy();
    expect(screen.getByText(/01 \/\s*01/)).toBeTruthy();
    expect(screen.getByText("Got it")).toBeTruthy();
  });

  it("does not spend the walkthrough on the empty-profile detour", () => {
    anchors(["tour-profile-empty"]);
    render(<GenerateTour active />);

    act(() => void fireEvent.click(screen.getByText("Got it")));
    expect(markedDone()).not.toHaveBeenCalled();
    expect(screen.queryByText("Your profile comes first")).toBeNull();
  });

  it("walks the stops in order and counts them", () => {
    anchors(ALL);
    render(<GenerateTour active />);

    expect(screen.getByText("Start with the posting")).toBeTruthy();
    expect(screen.getByText(/01 \/\s*05/)).toBeTruthy();

    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Then the look")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Voice and length")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Then the look")).toBeTruthy();
  });

  it("ends on the review half of the page, not just the writing half", () => {
    anchors(ALL);
    render(<GenerateTour active />);

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("And the other half: Review")).toBeTruthy();
    expect(screen.getByText("Got it")).toBeTruthy();
  });

  it("records that it ran and clears the parameter that started it", () => {
    anchors(ALL);
    render(<GenerateTour active />);

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText("Next"));
    act(() => void fireEvent.click(screen.getByText("Got it")));

    expect(markedDone()).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: "/generate",
      search: {},
      replace: true,
    });
    expect(screen.queryByText("That's it — generate")).toBeNull();
  });

  it("can be left at any point with Escape", () => {
    anchors(ALL);
    render(<GenerateTour active />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(markedDone()).toHaveBeenCalled();
    expect(screen.queryByText("Start with the posting")).toBeNull();
  });
});
