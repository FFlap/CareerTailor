// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildResumeTypstSource,
  templateSections,
} from "../convex/lib/templates";
import {
  normalizeResumeData,
  resumeDisclosureKeys,
  type ResumeData,
} from "../src/components/editor/model";
import { ResumeFields } from "../src/components/editor/ResumeFields";
import {
  sectionsOpen,
  useDisclosure,
} from "../src/components/editor/useDisclosure";
import { GENERATED_RESUME } from "./fixtures";

afterEach(cleanup);

function Harness({
  initial,
  templateId = "custom:everything",
  defaultOpen,
}: {
  initial?: unknown;
  templateId?: string;
  defaultOpen?: (key: string) => boolean;
}) {
  const [data, setData] = useState<ResumeData>(() =>
    normalizeResumeData(initial ?? {}),
  );
  const disclosure = useDisclosure(defaultOpen);
  return (
    <>
      <ResumeFields
        value={data}
        onChange={setData}
        disclosure={disclosure}
        sections={templateSections(templateId)}
      />
      <pre data-testid="data">{JSON.stringify(data)}</pre>
    </>
  );
}

const currentData = (): ResumeData =>
  JSON.parse(screen.getByTestId("data").textContent || "{}");

const sectionToggle = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}`) });

const openSection = (name: string) => {
  const toggle = sectionToggle(name);
  if (toggle.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
  return toggle;
};

describe("editor fields", () => {
  it("starts every section collapsed", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    for (const name of [
      "Contact",
      "Links",
      "Summary",
      "Skills",
      "Experience",
      "Projects",
      "Education",
    ]) {
      expect(sectionToggle(name).getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("can start with the sections open and the entries closed", () => {
    render(<Harness initial={GENERATED_RESUME} defaultOpen={sectionsOpen} />);

    expect(sectionToggle("Experience").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(sectionToggle("Contact").getAttribute("aria-expanded")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /01\s*Senior Backend Engineer/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("opens fresh every time, whatever was collapsed before", () => {
    const view = render(
      <Harness initial={GENERATED_RESUME} defaultOpen={sectionsOpen} />,
    );
    fireEvent.click(sectionToggle("Experience"));
    expect(sectionToggle("Experience").getAttribute("aria-expanded")).toBe(
      "false",
    );
    view.unmount();

    render(<Harness initial={GENERATED_RESUME} defaultOpen={sectionsOpen} />);
    expect(sectionToggle("Experience").getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("collapses an open-by-default section on click", () => {
    render(<Harness initial={GENERATED_RESUME} defaultOpen={sectionsOpen} />);
    const toggle = sectionToggle("Experience");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("says what is inside a section before it is opened", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    expect(sectionToggle("Experience").textContent).toContain(
      "Senior Backend Engineer · Northwind Data",
    );
  });

  it("keeps entries collapsed until they are opened", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openSection("Experience");
    const entry = screen.getByRole("button", {
      name: /01\s*Senior Backend Engineer/,
    });
    expect(entry.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(entry);
    expect(entry.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("skills", () => {
  const openFirstGroup = () => {
    openSection("Skills");
    fireEvent.click(screen.getByRole("button", { name: /01\s*Languages/ }));
  };

  it("takes a comma as the end of a skill", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openFirstGroup();
    const input = screen.getByLabelText("Skills in Languages");

    fireEvent.change(input, { target: { value: "Rust," } });
    expect(currentData().skills[0].items).toContain("Rust");
    expect((input as HTMLInputElement).value).toBe("");

    fireEvent.change(input, { target: { value: "Elixir" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(currentData().skills[0].items).toContain("Elixir");
  });

  it("splits a pasted comma separated list", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openFirstGroup();
    const input = screen.getByLabelText("Skills in Languages");
    fireEvent.change(input, { target: { value: "Zig, Nim, OCaml" } });
    fireEvent.blur(input);

    const items = currentData().skills[0].items;
    expect(items).toEqual(expect.arrayContaining(["Zig", "Nim", "OCaml"]));
  });

  it("does not add the same skill twice", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openFirstGroup();
    const input = screen.getByLabelText("Skills in Languages");
    fireEvent.change(input, { target: { value: "go," } });

    const items = currentData().skills[0].items;
    expect(items.filter((item) => item.toLowerCase() === "go")).toHaveLength(1);
  });

  it("removes the last skill on backspace in an empty field", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openFirstGroup();
    const input = screen.getByLabelText("Skills in Languages");
    const before = currentData().skills[0].items;

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(currentData().skills[0].items).toEqual(before.slice(0, -1));
  });
});

describe("links", () => {
  it("survives the round trip that used to delete it on creation", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openSection("Links");
    fireEvent.click(screen.getByLabelText("Add link"));

    const created = currentData();
    expect(created.header.links).toHaveLength(3);
    // The server normalises what it stores and hands it back.
    expect(normalizeResumeData(created).header.links).toHaveLength(3);
  });

  it("builds the URL from the platform and the handle", () => {
    render(<Harness initial={{}} />);
    openSection("Links");
    fireEvent.click(screen.getByLabelText("Add link"));
    fireEvent.click(screen.getByRole("button", { name: /01\s*GitHub/ }));

    fireEvent.change(screen.getByLabelText("GitHub handle"), {
      target: { value: "adalovelace" },
    });

    expect(currentData().header.links[0]).toEqual({
      label: "GitHub",
      url: "github.com/adalovelace",
    });
  });

  it("carries the handle across a change of platform", () => {
    render(<Harness initial={{}} />);
    openSection("Links");
    fireEvent.click(screen.getByLabelText("Add link"));
    fireEvent.click(screen.getByRole("button", { name: /01\s*GitHub/ }));
    fireEvent.change(screen.getByLabelText("GitHub handle"), {
      target: { value: "adalovelace" },
    });
    fireEvent.change(screen.getByLabelText("Platform for link 1"), {
      target: { value: "linkedin" },
    });

    expect(currentData().header.links[0]).toEqual({
      label: "LinkedIn",
      url: "linkedin.com/in/adalovelace",
    });
  });

  it("offers a platform the resume is not already using", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openSection("Links");
    fireEvent.click(screen.getByLabelText("Add link"));

    const labels = currentData().header.links.map((link) => link.label);
    expect(labels).toEqual(["GitHub", "LinkedIn", "Personal site"]);
  });
});

describe("bullets", () => {
  const openFirstRole = () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openSection("Experience");
    fireEvent.click(
      screen.getByRole("button", { name: /01\s*Senior Backend Engineer/ }),
    );
  };

  const bullet = (index: number) =>
    screen.getByLabelText(`Bullet ${index} for Senior Backend Engineer`);

  it("gives every bullet its own field", () => {
    openFirstRole();
    expect(currentData().experience[0].bullets).toHaveLength(3);
    expect(bullet(1)).toBeTruthy();
    expect(bullet(3)).toBeTruthy();
  });

  it("edits one bullet without touching the others", () => {
    openFirstRole();
    const before = currentData().experience[0].bullets;

    fireEvent.change(bullet(2), { target: { value: "Rewrote it" } });

    const after = currentData().experience[0].bullets;
    expect(after[1]).toBe("Rewrote it");
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
  });

  it("adds a bullet with the button", () => {
    openFirstRole();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Add bullet/ })[0],
    );
    expect(currentData().experience[0].bullets).toHaveLength(4);
    expect(currentData().experience[0].bullets.at(-1)).toBe("");
  });

  it("starts the next bullet on Enter, right after this one", () => {
    openFirstRole();
    fireEvent.keyDown(bullet(1), { key: "Enter" });

    const bullets = currentData().experience[0].bullets;
    expect(bullets).toHaveLength(4);
    expect(bullets[1]).toBe("");
  });

  it("never puts a line break inside a bullet", () => {
    openFirstRole();
    fireEvent.change(bullet(1), { target: { value: "One\ntwo" } });
    expect(currentData().experience[0].bullets[0]).toBe("One two");
  });

  it("removes an empty bullet on backspace", () => {
    openFirstRole();
    fireEvent.change(bullet(3), { target: { value: "" } });
    fireEvent.keyDown(bullet(3), { key: "Backspace" });

    expect(currentData().experience[0].bullets).toHaveLength(2);
  });

  it("keeps the last bullet when backspacing it away", () => {
    openFirstRole();
    fireEvent.change(bullet(3), { target: { value: "" } });
    fireEvent.keyDown(bullet(3), { key: "Backspace" });
    fireEvent.change(bullet(2), { target: { value: "" } });
    fireEvent.keyDown(bullet(2), { key: "Backspace" });
    fireEvent.change(bullet(1), { target: { value: "" } });
    fireEvent.keyDown(bullet(1), { key: "Backspace" });

    expect(currentData().experience[0].bullets).toEqual([""]);
  });

  it("removes a bullet with its own delete", () => {
    openFirstRole();
    fireEvent.click(
      screen.getByLabelText("Remove bullet 1 for Senior Backend Engineer"),
    );
    expect(currentData().experience[0].bullets).toHaveLength(2);
  });

  it("reorders bullets with the keyboard", () => {
    openFirstRole();
    const [first, second] = currentData().experience[0].bullets;

    fireEvent.keyDown(
      screen.getByLabelText(/^Reorder bullet 1 for Senior Backend Engineer\./),
      {
        key: "ArrowDown",
      },
    );

    expect(currentData().experience[0].bullets.slice(0, 2)).toEqual([
      second,
      first,
    ]);
  });
});

describe("custom sections", () => {
  const addSection = (name: string) => {
    fireEvent.click(screen.getByRole("button", { name: "New section" }));
    fireEvent.click(screen.getByRole("button", { name }));
  };

  it("adds a preset section, open and ready to type in", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    addSection("Certifications");

    const data = currentData();
    expect(data.customSections).toHaveLength(1);
    expect(data.customSections[0].title).toBe("Certifications");
    expect(data.sectionOrder.at(-1)).toBe(
      `custom:${data.customSections[0].id}`,
    );
    expect(sectionToggle("Certifications").getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("names a blank section whatever the user types", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    addSection("Blank section");

    fireEvent.change(screen.getByPlaceholderText("Certifications"), {
      target: { value: "Patents" },
    });
    expect(currentData().customSections[0].title).toBe("Patents");
    expect(sectionToggle("Patents")).toBeTruthy();
  });

  it("edits an entry and reaches the PDF", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    addSection("Certifications");

    fireEvent.change(screen.getByPlaceholderText(/Certified Kubernetes/), {
      target: { value: "AWS Solutions Architect" },
    });
    fireEvent.change(screen.getByPlaceholderText("Issuer, publisher, organisation"), {
      target: { value: "Amazon Web Services" },
    });

    const source = buildResumeTypstSource({
      templateId: "basic_resume",
      resume: currentData(),
      profile: {},
    });
    expect(source).toContain("== Certifications");
    expect(source).toContain("AWS Solutions Architect");
    expect(source).toContain("Amazon Web Services");
  });

  it("switches an inline section to a comma separated list", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    addSection("Languages");

    const input = screen.getByLabelText("Items in Languages");
    fireEvent.change(input, { target: { value: "English, French," } });

    expect(currentData().customSections[0].items.map((item) => item.title)).toEqual(
      ["English", "French"],
    );
  });

  it("removes a section and its place in the order", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    addSection("Awards");
    const id = currentData().customSections[0].id;

    fireEvent.click(screen.getByLabelText("Remove Awards"));

    const data = currentData();
    expect(data.customSections).toHaveLength(0);
    expect(data.sectionOrder).not.toContain(`custom:${id}`);
  });
});

describe("reordering", () => {
  it("moves a section with the keyboard", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    expect(currentData().sectionOrder).toEqual([]);

    fireEvent.keyDown(screen.getByLabelText(/^Reorder Summary\./), {
      key: "ArrowDown",
    });

    expect(currentData().sectionOrder.slice(0, 2)).toEqual([
      "skills",
      "summary",
    ]);
  });

  it("moves a section by dragging it onto another", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    const handle = screen.getByLabelText(/^Reorder Education\./);
    const target = screen.getByLabelText(/^Reorder Skills\./).closest("section")!;

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: () => {},
      getData: () => "",
      setDragImage: () => {},
    };
    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(currentData().sectionOrder).toEqual([
      "summary",
      "education",
      "skills",
      "experience",
      "projects",
    ]);
  });

  it("moves an entry inside a section", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    openSection("Experience");

    fireEvent.keyDown(screen.getByLabelText(/^Reorder Backend Engineer\./), {
      key: "ArrowUp",
    });

    expect(currentData().experience.map((role) => role.title)).toEqual([
      "Backend Engineer",
      "Senior Backend Engineer",
    ]);
  });

  it("keeps a reordered section in the rendered document", () => {
    render(<Harness initial={GENERATED_RESUME} />);
    fireEvent.keyDown(screen.getByLabelText(/^Reorder Projects\./), {
      key: "ArrowUp",
    });

    const source = buildResumeTypstSource({
      templateId: "basic_resume",
      resume: currentData(),
      profile: {},
    });
    expect(source.indexOf("== Projects")).toBeLessThan(
      source.indexOf("== Work Experience"),
    );
  });
});

describe("expand all", () => {
  it("reaches entries and custom sections as well as sections", () => {
    const resume = normalizeResumeData({
      ...GENERATED_RESUME,
      customSections: [
        {
          id: "certs",
          title: "Certifications",
          layout: "entries",
          items: [{ title: "CKA" }, { title: "CKAD" }],
        },
        {
          id: "langs",
          title: "Languages",
          layout: "inline",
          items: [{ title: "English" }],
        },
      ],
    });

    const keys = resumeDisclosureKeys(resume);

    expect(keys).toContain("experience");
    expect(keys).toContain("experience:1");
    expect(keys).toContain("links:0");
    expect(keys).toContain("custom:certs");
    expect(keys).toContain("custom:certs:1");
    // An inline section has no entries to open.
    expect(keys).toContain("custom:langs");
    expect(keys).not.toContain("custom:langs:0");
    expect(keys).not.toContain("summary:0");
  });
});

describe("mirroring the template", () => {
  /** The sections on screen, top to bottom. */
  const shownSections = () =>
    Array.from(document.querySelectorAll('[id^="section-"]'))
      .map((element) => element.id.replace("section-", ""))
      .filter((id) => id !== "contact" && id !== "links");

  const BASIC_MARKERS: Record<string, string> = {
    education: "== Education",
    experience: "== Work Experience",
    projects: "== Projects",
    skills: "== Skills",
  };

  const printedOrder = (data: ResumeData, markers = BASIC_MARKERS) => {
    const source = buildResumeTypstSource({
      templateId: "basic_resume",
      resume: data,
      profile: {},
    });
    return Object.keys(markers)
      .map((key) => ({ key, at: source.indexOf(markers[key]) }))
      .filter((entry) => entry.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((entry) => entry.key);
  };

  it("hides a section the template does not print", () => {
    render(<Harness initial={GENERATED_RESUME} templateId="basic_resume" />);
    expect(shownSections()).not.toContain("summary");
    expect(screen.queryByLabelText("Summary")).toBeNull();
  });

  it("lists sections in the order the PDF prints them", () => {
    render(<Harness initial={GENERATED_RESUME} templateId="basic_resume" />);
    expect(shownSections()).toEqual([
      "education",
      "experience",
      "projects",
      "skills",
    ]);
    expect(printedOrder(currentData())).toEqual(shownSections());
  });

  it("still matches the PDF after a drag", () => {
    render(<Harness initial={GENERATED_RESUME} templateId="basic_resume" />);
    fireEvent.keyDown(screen.getByLabelText(/^Reorder Skills\./), {
      key: "ArrowUp",
    });

    expect(shownSections()).toEqual([
      "education",
      "experience",
      "skills",
      "projects",
    ]);
    expect(printedOrder(currentData())).toEqual(shownSections());
  });

  it("leaves a hidden section its place for other templates", () => {
    render(<Harness initial={GENERATED_RESUME} templateId="basic_resume" />);
    fireEvent.keyDown(screen.getByLabelText(/^Reorder Skills\./), {
      key: "ArrowUp",
    });
    expect(currentData().sectionOrder).toContain("summary");
  });

  it("does not reshuffle the PDF when a custom section is added", () => {
    render(<Harness initial={GENERATED_RESUME} templateId="basic_resume" />);
    const before = printedOrder(currentData());

    fireEvent.click(screen.getByRole("button", { name: "New section" }));
    fireEvent.click(screen.getByRole("button", { name: "Awards" }));

    expect(printedOrder(currentData())).toEqual(before);
    expect(shownSections().at(-1)).toMatch(/^custom:/);
  });

  it("splits a sidebar template into the two places it prints", () => {
    render(<Harness initial={GENERATED_RESUME} templateId="neat_cv" />);

    expect(screen.getByText("Sidebar")).toBeTruthy();
    expect(screen.getByText("Main column")).toBeTruthy();
    expect(shownSections()).toEqual([
      "summary",
      "skills",
      "experience",
      "projects",
      "education",
    ]);
    // The template owns the sidebar, so those two cannot be dragged.
    expect(screen.queryByLabelText(/^Reorder Summary\./)).toBeNull();
    expect(screen.queryByLabelText(/^Reorder Skills\./)).toBeNull();
    expect(screen.getByLabelText(/^Reorder Experience\./)).toBeTruthy();
  });

  it("puts a custom section in the main column of a sidebar template", () => {
    render(<Harness initial={GENERATED_RESUME} templateId="neat_cv" />);
    fireEvent.click(screen.getByRole("button", { name: "New section" }));
    fireEvent.click(screen.getByRole("button", { name: "Awards" }));

    expect(shownSections().at(-1)).toMatch(/^custom:/);
    expect(screen.getByLabelText(/^Reorder Awards\./)).toBeTruthy();
  });
});
