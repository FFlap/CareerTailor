// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResumeDropZone } from "../src/components/ResumeDropZone";

afterEach(cleanup);

const pdf = () =>
  new File(["%PDF-1.4"], "resume.pdf", { type: "application/pdf" });

const zone = () => screen.getByRole("button");

const drop = (file: File) => {
  const dataTransfer = { files: [file], dropEffect: "", types: ["Files"] };
  fireEvent.dragEnter(zone(), { dataTransfer });
  fireEvent.dragOver(zone(), { dataTransfer });
  fireEvent.drop(zone(), { dataTransfer });
};

describe("resume drop zone", () => {
  it("takes a file dropped anywhere on it", () => {
    const onFile = vi.fn();
    render(<ResumeDropZone state={{ status: "idle" }} onFile={onFile} />);

    const file = pdf();
    drop(file);

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("says it is a target while a file is over it", () => {
    render(<ResumeDropZone state={{ status: "idle" }} onFile={vi.fn()} />);
    expect(zone().textContent).toContain("Start from an existing");

    fireEvent.dragEnter(zone(), { dataTransfer: { files: [], types: ["Files"] } });
    expect(zone().textContent).toContain("Drop it here");

    fireEvent.dragLeave(zone(), { relatedTarget: document.body });
    expect(zone().textContent).toContain("Start from an existing");
  });

  it("opens the picker when the box is clicked", () => {
    render(<ResumeDropZone state={{ status: "idle" }} onFile={vi.fn()} />);
    const input = screen.getByLabelText("Upload a résumé");
    const click = vi.spyOn(input, "click");

    fireEvent.click(zone());

    expect(click).toHaveBeenCalled();
  });

  it("takes a file from the picker", () => {
    const onFile = vi.fn();
    render(<ResumeDropZone state={{ status: "idle" }} onFile={onFile} />);

    const file = pdf();
    fireEvent.change(screen.getByLabelText("Upload a résumé"), {
      target: { files: [file] },
    });

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("ignores a drop while it is still reading the last one", () => {
    const onFile = vi.fn();
    render(
      <ResumeDropZone
        state={{ status: "parsing", fileName: "old.pdf" }}
        onFile={onFile}
      />,
    );

    drop(pdf());

    expect(onFile).not.toHaveBeenCalled();
  });

  it("reports where it has got to", () => {
    const { rerender } = render(
      <ResumeDropZone
        state={{ status: "parsing", fileName: "resume.pdf" }}
        onFile={vi.fn()}
      />,
    );
    expect(zone().textContent).toContain("Reading it with AI");

    rerender(
      <ResumeDropZone
        state={{ status: "error", fileName: "resume.png", error: "Wrong type" }}
        onFile={vi.fn()}
      />,
    );
    expect(zone().textContent).toContain("Wrong type");
  });
});
