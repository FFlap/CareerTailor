import { describe, expect, it } from "vitest";

import {
  COVER_TEMPLATES,
  RESUME_TEMPLATES,
  buildCoverLetterTypstSource,
  buildCustomCoverLetterTypstSource,
  buildCustomResumeTypstSource,
  buildResumeTypstSource,
  templatePrintsSection,
  templateSections,
  type CoverTemplateId,
  type ResumeTemplateId,
} from "../convex/lib/templates";
import {
  BARE_PROFILE,
  BARE_RESUME,
  GENERATED_COVER_LETTER,
  GENERATED_RESUME,
  JOB,
  PROFILE,
  SPARSE_PROFILE,
  SPARSE_RESUME,
} from "./fixtures";

const resumeTemplateIds = Object.keys(RESUME_TEMPLATES) as ResumeTemplateId[];
const coverTemplateIds = Object.keys(COVER_TEMPLATES) as CoverTemplateId[];

const EMPTY_RESUME = {};
const EMPTY_COVER = {};

describe("resume templates", () => {
  it("covers every template the picker offers", () => {
    expect(resumeTemplateIds.length).toBeGreaterThanOrEqual(6);
  });

  it.each(resumeTemplateIds)("renders Typst for %s", (templateId) => {
    const source = buildResumeTypstSource({
      templateId,
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });

    expect(typeof source).toBe("string");
    expect(source.trim().length).toBeGreaterThan(100);
    expect(source).toContain("Ada");
    expect(source).toContain("Lovelace");
    expect(source).toContain("Northwind Data");
  });

  it.each(resumeTemplateIds)("escapes user content for %s", (templateId) => {
    const hostile = {
      ...GENERATED_RESUME,
      summary: 'Cut costs by 50% #panic $math$ "quoted" \\slash\\',
    };
    const source = buildResumeTypstSource({
      templateId,
      resume: hostile,
      profile: PROFILE,
    });

    expect(source).not.toContain("50% #panic");
    expect(source.length).toBeGreaterThan(100);
  });

  it.each(resumeTemplateIds)(
    "survives an empty model payload for %s",
    (templateId) => {
      expect(() =>
        buildResumeTypstSource({
          templateId,
          resume: EMPTY_RESUME,
          profile: PROFILE,
        }),
      ).not.toThrow();
    },
  );

  it.each(resumeTemplateIds)(
    "survives a null resume and null profile for %s",
    (templateId) => {
      expect(() =>
        buildResumeTypstSource({ templateId, resume: null, profile: null }),
      ).not.toThrow();
    },
  );

  it("produces distinct output per template", () => {
    const rendered = resumeTemplateIds.map((templateId) =>
      buildResumeTypstSource({
        templateId,
        resume: GENERATED_RESUME,
        profile: PROFILE,
      }),
    );
    expect(new Set(rendered).size).toBe(resumeTemplateIds.length);
  });

  it("rejects an unknown template id", () => {
    expect(() =>
      buildResumeTypstSource({
        templateId: "not_a_template" as ResumeTemplateId,
        resume: GENERATED_RESUME,
        profile: PROFILE,
      }),
    ).toThrow();
  });
});

describe("resume templates with missing profile data", () => {
  const sparse = (templateId: ResumeTemplateId) =>
    buildResumeTypstSource({
      templateId,
      resume: SPARSE_RESUME,
      profile: SPARSE_PROFILE,
    });

  it.each(resumeTemplateIds)(
    "leaves out sections the profile has nothing for in %s",
    (templateId) => {
      const source = sparse(templateId).toLowerCase();
      expect(source).not.toContain("linkedin");
      expect(source).not.toContain("github");
      expect(source).not.toContain("= education");
      expect(source).not.toContain("= projects");
      expect(source).not.toContain('"education"');
      expect(source).not.toContain('"projects"');
    },
  );

  it.each(resumeTemplateIds)(
    "never emits an empty link for %s",
    (templateId) => {
      const source = sparse(templateId);
      expect(source).not.toMatch(/"https:\/\/"/);
      expect(source).not.toMatch(/:\s*""\s*,/);
      expect(source).not.toContain('mailto:"');
    },
  );

  it.each(resumeTemplateIds)(
    "never emits a dangling date range for %s",
    (templateId) => {
      const source = sparse(templateId);
      expect(source).not.toMatch(/"\s*-\s*"/);
      expect(source).not.toMatch(/"\s*-\s*Present"/);
    },
  );

  it.each(resumeTemplateIds)(
    "survives a name-only profile for %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: BARE_RESUME,
        profile: BARE_PROFILE,
      });
      expect(source).toContain("Sam");
      expect(source).toContain("Doe");
      expect(source.toLowerCase()).not.toContain("undefined");
      expect(source).not.toContain('"none"');
    },
  );

  it.each(resumeTemplateIds)("keeps profile photos out of %s", (templateId) => {
    const source = buildResumeTypstSource({
      templateId,
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });
    expect(source).not.toContain("profile.png");
  });
});

describe("contact details", () => {
  const withLinks = (links: Array<{ label: string; url: string }>) =>
    buildResumeTypstSource({
      templateId: "modern_cv",
      resume: {
        ...GENERATED_RESUME,
        header: { ...GENERATED_RESUME.header, links },
      },
      profile: { ...PROFILE, personal: { ...PROFILE.personal, links } },
    });

  it("escapes strings for string literals, not for markup", () => {
    const source = buildResumeTypstSource({
      templateId: "basic_resume",
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });
    expect(source).toContain('"ada@example.com"');
    expect(source).not.toContain("\\@");
  });

  it.each(resumeTemplateIds)(
    "keeps URL punctuation intact in %s",
    (templateId) => {
      const link = "https://ada~love.dev/my--page";
      const source = buildResumeTypstSource({
        templateId,
        resume: {
          ...GENERATED_RESUME,
          header: {
            ...GENERATED_RESUME.header,
            links: [{ label: "Site", url: link }],
          },
          projects: [
            { name: "Tess", technologies: [], link, bullets: ["Shipped it."] },
          ],
        },
        profile: PROFILE,
      });
      const rendered = source.match(/ada.{0,2}love\.dev\/my.{0,4}page/g) ?? [];
      for (const match of rendered) {
        expect(match.replace(/\\/g, "")).toBe("ada~love.dev/my--page");
      }
      expect(source).toContain("love");
    },
  );

  it("reads the LinkedIn username past the /in/ segment", () => {
    const source = withLinks([
      { label: "LinkedIn", url: "https://linkedin.com/in/adalovelace" },
    ]);
    expect(source).toContain('linkedin: "adalovelace"');
    expect(source).not.toContain('linkedin: "in"');
  });

  it("accepts a bare handle when the label names the network", () => {
    const source = withLinks([{ label: "GitHub", url: "adalovelace" }]);
    expect(source).toContain('github: "adalovelace"');
  });

  it("treats a non-social link as the personal site", () => {
    const source = withLinks([{ label: "Site", url: "ada.dev" }]);
    expect(source).toContain('homepage: "https://ada.dev"');
  });

  it("omits contact keys the profile has no value for", () => {
    const source = withLinks([]);
    expect(source).not.toContain("github:");
    expect(source).not.toContain("linkedin:");
    expect(source).not.toContain("homepage:");
    expect(source).toContain("email:");
  });
});

describe("template specific quirks", () => {
  it("calls metronic tags variadically", () => {
    const source = buildResumeTypstSource({
      templateId: "metronic",
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });
    expect(source).toMatch(/#tags\("Go", /);
    expect(source).not.toMatch(/#tags\(\(/);
  });

  it("passes a theme to impressive-impression pills and an array of pages", () => {
    const source = buildResumeTypstSource({
      templateId: "impressive_impression",
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });
    expect(source).toContain("#let pill = body => make-pill(body, theme)");
    expect(source).toMatch(/\("left": aside-content, "main": main-content\),/);
  });

  it("keeps every skill group in the neat-cv pill list", () => {
    const source = buildResumeTypstSource({
      templateId: "neat_cv",
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });
    for (const skill of PROFILE.skills.flatMap((group) => group.items)) {
      expect(source).toContain(`"${skill}"`);
    }
  });
});

describe("cover letter templates", () => {
  it("covers every cover template the picker offers", () => {
    expect(coverTemplateIds.length).toBeGreaterThanOrEqual(3);
  });

  it.each(coverTemplateIds)("renders Typst for %s", (templateId) => {
    const source = buildCoverLetterTypstSource({
      templateId,
      coverLetter: GENERATED_COVER_LETTER,
      profile: PROFILE,
      job: JOB,
    });

    expect(typeof source).toBe("string");
    expect(source.trim().length).toBeGreaterThan(100);
    expect(source).toContain("Helios Robotics");
  });

  it.each(coverTemplateIds)(
    "includes every body paragraph for %s",
    (templateId) => {
      const source = buildCoverLetterTypstSource({
        templateId,
        coverLetter: GENERATED_COVER_LETTER,
        profile: PROFILE,
        job: JOB,
      });
      for (const paragraph of GENERATED_COVER_LETTER.body_paragraphs) {
        expect(source).toContain(paragraph.split(" ").slice(0, 4).join(" "));
      }
    },
  );

  it.each(coverTemplateIds)(
    "survives an empty model payload for %s",
    (templateId) => {
      expect(() =>
        buildCoverLetterTypstSource({
          templateId,
          coverLetter: EMPTY_COVER,
          profile: PROFILE,
          job: JOB,
        }),
      ).not.toThrow();
    },
  );

  it.each(coverTemplateIds)("survives a missing job for %s", (templateId) => {
    expect(() =>
      buildCoverLetterTypstSource({
        templateId,
        coverLetter: GENERATED_COVER_LETTER,
        profile: PROFILE,
        job: null,
      }),
    ).not.toThrow();
  });

  it("produces distinct output per template", () => {
    const rendered = coverTemplateIds.map((templateId) =>
      buildCoverLetterTypstSource({
        templateId,
        coverLetter: GENERATED_COVER_LETTER,
        profile: PROFILE,
        job: JOB,
      }),
    );
    expect(new Set(rendered).size).toBe(coverTemplateIds.length);
  });
});

describe("custom (user-uploaded) templates", () => {
  const CUSTOM_RESUME_SOURCE = [
    "#set page(margin: 36pt)",
    "#text(size: 20pt)[#resume.header.name]",
    "#resume.summary",
  ].join("\n");

  const CUSTOM_COVER_SOURCE = [
    "#set page(margin: 42pt)",
    "#text(size: 18pt)[#sender.name]",
    "#cover_letter.greeting",
  ].join("\n");

  it("injects resume data ahead of the custom source", () => {
    const source = buildCustomResumeTypstSource({
      templateSource: CUSTOM_RESUME_SOURCE,
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });

    expect(source).toContain("Ada");
    expect(source).toContain("Lovelace");
    expect(source).toContain("#resume.header.name");
    expect(source.indexOf("resume")).toBeLessThan(
      source.lastIndexOf("#set page"),
    );
  });

  it("separates the injected data from the template with a real newline", () => {
    const source = buildCustomResumeTypstSource({
      templateSource: CUSTOM_RESUME_SOURCE,
      resume: GENERATED_RESUME,
      profile: PROFILE,
    });
    expect(source.split("\n")).toContain("#set page(margin: 36pt)");
  });

  it("injects cover letter data ahead of the custom source", () => {
    const source = buildCustomCoverLetterTypstSource({
      templateSource: CUSTOM_COVER_SOURCE,
      coverLetter: GENERATED_COVER_LETTER,
      profile: PROFILE,
      job: JOB,
    });

    expect(source).toContain("Ada");
    expect(source).toContain("Lovelace");
    expect(source).toContain("#cover_letter.greeting");
  });

  it("survives empty payloads", () => {
    expect(() =>
      buildCustomResumeTypstSource({
        templateSource: CUSTOM_RESUME_SOURCE,
        resume: EMPTY_RESUME,
        profile: PROFILE,
      }),
    ).not.toThrow();

    expect(() =>
      buildCustomCoverLetterTypstSource({
        templateSource: CUSTOM_COVER_SOURCE,
        coverLetter: EMPTY_COVER,
        profile: PROFILE,
        job: JOB,
      }),
    ).not.toThrow();
  });
});

describe("custom sections", () => {
  const RESUME_WITH_CUSTOM = {
    ...GENERATED_RESUME,
    customSections: [
      {
        id: "certs",
        title: "Certifications",
        layout: "entries",
        items: [
          {
            title: "AWS Solutions Architect",
            subtitle: "Amazon Web Services",
            location: "Remote",
            startDate: "2023",
            endDate: "2026",
            description: "Professional level.",
            bullets: ["Passed on the first attempt"],
          },
        ],
      },
      {
        id: "languages",
        title: "Languages",
        layout: "inline",
        items: [{ title: "English" }, { title: "Greek" }],
      },
      {
        id: "awards",
        title: "Awards",
        layout: "bullets",
        items: [{ title: "Hackathon winner, 2024" }],
      },
    ],
  };

  it.each(resumeTemplateIds)("renders every layout in %s", (templateId) => {
    const source = buildResumeTypstSource({
      templateId,
      resume: RESUME_WITH_CUSTOM,
      profile: PROFILE,
    });

    expect(source).toContain("Certifications");
    expect(source).toContain("AWS Solutions Architect");
    expect(source).toContain("Languages");
    expect(source).toContain("English · Greek");
    expect(source).toContain("Awards");
    expect(source).toContain("- Hackathon winner, 2024");
  });

  it.each(resumeTemplateIds)(
    "leaves out untitled and empty custom sections in %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: {
          ...GENERATED_RESUME,
          customSections: [
            { id: "a", title: "", layout: "entries", items: [{ title: "x" }] },
            { id: "b", title: "Empty", layout: "entries", items: [] },
            { id: "c", title: "Blank", layout: "entries", items: [{}] },
          ],
        },
        profile: PROFILE,
      });

      expect(source).not.toContain("Empty");
      expect(source).not.toContain("Blank");
    },
  );

  it.each(resumeTemplateIds)(
    "escapes custom section content in %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: {
          ...GENERATED_RESUME,
          customSections: [
            {
              id: "hostile",
              title: "Awards",
              layout: "bullets",
              items: [{ title: "Cut costs 50% #panic" }],
            },
          ],
        },
        profile: PROFILE,
      });
      expect(source).not.toContain("50% #panic");
    },
  );

  it.each(resumeTemplateIds)(
    "survives malformed custom section data in %s",
    (templateId) => {
      expect(() =>
        buildResumeTypstSource({
          templateId,
          resume: { ...GENERATED_RESUME, customSections: "nope" },
          profile: PROFILE,
        }),
      ).not.toThrow();

      expect(() =>
        buildResumeTypstSource({
          templateId,
          resume: {
            ...GENERATED_RESUME,
            customSections: [null, { items: null }, { title: 4, items: [1] }],
          },
          profile: PROFILE,
        }),
      ).not.toThrow();
    },
  );

  it("exposes custom sections to custom templates", () => {
    const source = buildCustomResumeTypstSource({
      templateSource: "#resume.custom_sections",
      resume: RESUME_WITH_CUSTOM,
      profile: PROFILE,
    });
    expect(source).toContain("custom_sections:");
    expect(source).toContain('title: "Certifications"');
    expect(source).toContain('layout: "inline"');
    expect(source).toContain("section_order:");
  });
});

const SECTION_MARKERS: Record<ResumeTemplateId, Record<string, string>> = {
  basic_resume: {
    education: "== Education",
    experience: "== Work Experience",
    projects: "== Projects",
    skills: "== Skills",
  },
  simple_technical_resume: {
    education: '#custom-title("Education")',
    experience: '#custom-title("Experience")',
    projects: '#custom-title("Projects")',
    skills: '#custom-title("Skills")',
  },
  modern_cv: {
    experience: "= Professional Experience",
    projects: "= Projects",
    skills: "= Skills",
    education: "= Education",
  },
  neat_cv: {
    experience: "= Professional Experience",
    projects: "= Projects",
    education: "= Education",
  },
  metronic: {
    experience: '"Professional Experience"',
    projects: '"Projects"',
  },
  impressive_impression: {
    experience: "== Experience",
    projects: "== Projects",
    education: "== Education",
  },
};

describe("section order", () => {
  const positionsOf = (source: string, markers: string[]) =>
    markers.map((marker) => source.indexOf(marker));

  it.each(resumeTemplateIds)(
    "keeps the template order by default in %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: GENERATED_RESUME,
        profile: PROFILE,
      });
      const [projects, experience] = positionsOf(source, [
        SECTION_MARKERS[templateId].projects,
        SECTION_MARKERS[templateId].experience,
      ]);
      expect(experience).toBeGreaterThan(-1);
      expect(projects).toBeGreaterThan(experience);
    },
  );

  it.each(resumeTemplateIds)(
    "moves projects above experience in %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: {
          ...GENERATED_RESUME,
          sectionOrder: ["projects", "experience", "education", "skills"],
        },
        profile: PROFILE,
      });
      const [projects, experience] = positionsOf(source, [
        SECTION_MARKERS[templateId].projects,
        SECTION_MARKERS[templateId].experience,
      ]);
      expect(projects).toBeGreaterThan(-1);
      expect(projects).toBeLessThan(experience);
    },
  );

  it.each(resumeTemplateIds)(
    "places a custom section where the order puts it in %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: {
          ...GENERATED_RESUME,
          customSections: [
            {
              id: "certs",
              title: "Certifications",
              layout: "bullets",
              items: [{ title: "AWS Solutions Architect" }],
            },
          ],
          sectionOrder: ["custom:certs", "experience", "projects", "education"],
        },
        profile: PROFILE,
      });
      expect(source.indexOf("Certifications")).toBeLessThan(
        source.indexOf(SECTION_MARKERS[templateId].experience),
      );
    },
  );

  it.each(resumeTemplateIds)(
    "ignores unknown keys in a stored order for %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: {
          ...GENERATED_RESUME,
          sectionOrder: ["custom:gone", "nonsense", "projects"],
        },
        profile: PROFILE,
      });
      expect(source).toContain(SECTION_MARKERS[templateId].experience);
      expect(source).not.toContain("nonsense");
    },
  );
});

describe("what a template prints", () => {
  const SENTINELS: Record<string, string> = {
    summary: "SummarySentinel",
    skills: "SkillSentinel",
    experience: "ExperienceSentinel",
    projects: "ProjectSentinel",
    education: "EducationSentinel",
  };

  const MARKED_RESUME = {
    ...GENERATED_RESUME,
    summary: "SummarySentinel writes backend services.",
    skills: [{ category: "Languages", items: ["SkillSentinel"] }],
    experience: [
      {
        title: "Engineer",
        company: "SkillSentinel".replace("Skill", "Experience"),
        location: "London, UK",
        startDate: "Mar 2021",
        endDate: "Present",
        bullets: ["Did the work"],
      },
    ],
    projects: [
      {
        name: "ProjectSentinel",
        technologies: ["Rust"],
        link: "",
        bullets: ["Shipped it"],
      },
    ],
    education: [
      {
        degree: "BSc",
        major: "Computer Science",
        institution: "EducationSentinel",
        location: "London, UK",
        startDate: "Sep 2014",
        endDate: "Jun 2018",
      },
    ],
  };

  it.each(resumeTemplateIds)(
    "prints exactly the sections it claims to for %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: MARKED_RESUME,
        profile: {},
      });

      for (const [key, sentinel] of Object.entries(SENTINELS)) {
        expect(
          source.includes(sentinel),
          `${templateId} ${key}: expected printed=${templatePrintsSection(templateId, key)}`,
        ).toBe(templatePrintsSection(templateId, key));
      }
    },
  );

  it.each(resumeTemplateIds)(
    "prints its main flow in the order the editor lists for %s",
    (templateId) => {
      const source = buildResumeTypstSource({
        templateId,
        resume: MARKED_RESUME,
        profile: {},
      });

      const positions = templateSections(templateId).ordered.map((key) =>
        source.indexOf(SECTION_MARKERS[templateId][key]),
      );
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    },
  );

  it("hands a custom template every section", () => {
    expect(templateSections("custom:abc123").ordered).toEqual([
      "summary",
      "skills",
      "experience",
      "projects",
      "education",
    ]);
    expect(templatePrintsSection("custom:abc123", "summary")).toBe(true);
  });

  it("prints any custom section, whatever the template", () => {
    for (const templateId of resumeTemplateIds) {
      expect(templatePrintsSection(templateId, "custom:anything")).toBe(true);
    }
  });
});
