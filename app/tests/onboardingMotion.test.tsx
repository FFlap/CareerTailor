import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStepTransition } from "../src/components/onboarding/motion";

let reducedMotion = false;

beforeEach(() => {
  reducedMotion = false;
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: query.includes("reduce") ? reducedMotion : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  );
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

let control: ReturnType<typeof useStepTransition>;

function Harness({ initial = 0 }: { initial?: number }) {
  control = useStepTransition(initial);
  return (
    <div data-testid="step" className={control.stepClass}>
      {control.shown}
    </div>
  );
}

const step = () => screen.getByTestId("step");


const settle = () => act(() => void vi.advanceTimersByTime(250));

describe("step transition", () => {
  it("holds the outgoing step until its exit has played", () => {
    render(<Harness />);
    expect(step().textContent).toBe("0");

    act(() => control.go(1));
    expect(step().textContent).toBe("0");
    expect(step().className).toContain("ob-leave");

    settle();

    expect(step().textContent).toBe("1");
    expect(step().className).toContain("ob-rise");
  });

  it("reverses the motion when going back", () => {
    render(<Harness initial={2} />);

    act(() => control.go(1));
    expect(step().className).toContain("ob-leave-back");

    settle();

    expect(step().textContent).toBe("1");
    expect(step().className).toContain("ob-rise-back");
  });

  it("keeps the outgoing step's direction while it is leaving", () => {
    render(<Harness initial={2} />);
    act(() => control.go(3));
    settle();
    expect(control.direction).toBe(1);
    act(() => control.go(2));
    expect(control.direction).toBe(1);

    settle();
    expect(control.direction).toBe(-1);
  });

  it("ignores a second move while one is still playing", () => {
    render(<Harness />);

    act(() => control.go(1));
    act(() => control.go(5));

    settle();

    expect(step().textContent).toBe("1");
  });

  it("ignores a move to the step already showing", () => {
    render(<Harness initial={3} />);

    act(() => control.go(3));

    expect(step().className).not.toContain("ob-leave");
    expect(step().textContent).toBe("3");
  });

  it("swaps without an exit when motion is reduced", () => {
    reducedMotion = true;
    render(<Harness />);

    act(() => control.go(2));

    expect(step().textContent).toBe("2");
    expect(step().className).not.toContain("ob-leave");
  });
});
