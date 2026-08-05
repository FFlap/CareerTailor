import { Plus } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";

import {
  EmptyHint,
  FieldRow,
  ItemBlock,
  Meta,
  Section,
  Select,
  TokenInput,
  controlClass,
  type DragHandleProps,
  type DropRowProps,
} from "./primitives";
import {
  BUILT_IN_SECTIONS,
  LAYOUT_HINTS,
  LAYOUT_LABELS,
  LINK_PLATFORMS,
  SECTION_LABELS,
  SECTION_PRESETS,
  customKey,
  emptyCustomItem,
  handleOf,
  linkFor,
  moveItem,
  newSectionId,
  nextUnusedPlatform,
  platformOf,
  removeAt,
  replaceAt,
  sectionOrderOf,
  type CustomItem,
  type CustomLayout,
  type CustomSection,
  type ResumeData,
} from "./model";
import {
  resolveSectionOrder,
  type TemplateSections,
} from "../../../convex/lib/templates";
import { useDragReorder } from "./useDragReorder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SectionDrag = {
  handle: DragHandleProps;
  row: DropRowProps;
  edge: "top" | "bottom" | null;
  dragging: boolean;
};

export type Disclosure = {
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
  set: (key: string, open: boolean) => void;
};

const textareaClass = cn(controlClass, "h-auto py-1.5 leading-relaxed");

const toLines = (value: string) => value.split("\n");

function preview(parts: Array<string | undefined>, extra: number) {
  const head = parts.filter(Boolean).join(" · ");
  if (!head) return extra > 0 ? `${extra} more` : "";
  return extra > 0 ? `${head} +${extra} more` : head;
}

function listPreview(items: string[]) {
  const named = items.filter(Boolean);
  if (!named.length) return "";
  return preview([named[0]], named.length - 1);
}

export function ResumeFields({
  value,
  onChange,
  disclosure,
  sections,
}: {
  value: ResumeData;
  onChange: (next: ResumeData) => void;
  disclosure: Disclosure;
  sections: TemplateSections;
}) {
  const [addingSection, setAddingSection] = useState(false);
  const order = sectionOrderOf(value);

  const customKeys = value.customSections.map((section) =>
    customKey(section.id),
  );
  const orderable = new Set<string>([...sections.ordered, ...customKeys]);
  const visibleOrder = resolveSectionOrder(value, sections.ordered, [
    ...sections.ordered,
    ...customKeys,
  ]);

  const withMainFlow = (mainFlow: string[]) => {
    let next = 0;
    const merged = order.map((key) =>
      orderable.has(key) ? mainFlow[next++] : key,
    );
    return [...merged, ...mainFlow.slice(next)];
  };

  const update = (patch: Partial<ResumeData>) =>
    onChange({ ...value, ...patch });

  const updateHeader = (patch: Partial<ResumeData["header"]>) =>
    update({ header: { ...value.header, ...patch } });

  const openWith = (sectionKey: string, index: number) => {
    disclosure.set(sectionKey, true);
    disclosure.set(`${sectionKey}:${index}`, true);
  };

  const sectionDrag = useDragReorder({
    listId: "sections",
    onMove: (from, to) =>
      update({ sectionOrder: withMainFlow(moveItem(visibleOrder, from, to)) }),
  });

  const contactSection = (
    <Section
      key="contact"
      domId="contact"
      title="Contact"
      preview={preview([value.header.name, value.header.email], 0)}
      open={disclosure.isOpen("contact")}
      onToggle={() => disclosure.toggle("contact")}
    >
      <FieldRow label="Name" htmlFor="f-name">
        <Input
          id="f-name"
          value={value.header.name}
          onChange={(e) => updateHeader({ name: e.target.value })}
          placeholder="Full name"
          className={controlClass}
        />
      </FieldRow>
      <FieldRow label="Email" htmlFor="f-email">
        <Input
          id="f-email"
          type="email"
          value={value.header.email}
          onChange={(e) => updateHeader({ email: e.target.value })}
          placeholder="you@domain.com"
          className={controlClass}
        />
      </FieldRow>
      <FieldRow label="Phone" htmlFor="f-phone">
        <Input
          id="f-phone"
          value={value.header.phone}
          onChange={(e) => updateHeader({ phone: e.target.value })}
          placeholder="Optional"
          className={controlClass}
        />
      </FieldRow>
      <FieldRow label="Location" htmlFor="f-location">
        <Input
          id="f-location"
          value={value.header.location}
          onChange={(e) => updateHeader({ location: e.target.value })}
          placeholder="City, Region"
          className={controlClass}
        />
      </FieldRow>
    </Section>
  );

  const links = value.header.links;

  const addLink = () => {
    const platform = nextUnusedPlatform(links);
    updateHeader({ links: [...links, { label: platform.label, url: "" }] });
    openWith("links", links.length);
  };

  const linkDrag = useDragReorder({
    listId: "links",
    onMove: (from, to) => updateHeader({ links: moveItem(links, from, to) }),
  });

  const linksSection = (
    <Section
      key="links"
      domId="links"
      title="Links"
      count={links.length}
      preview={listPreview(links.map((link) => platformOf(link).label))}
      open={disclosure.isOpen("links")}
      onToggle={() => disclosure.toggle("links")}
      onAdd={addLink}
      addLabel="Add link"
    >
      {links.length === 0 ? (
        <EmptyHint onAdd={addLink} addLabel="Add one">
          Pick a platform and type the handle — templates lay out the rest.
        </EmptyHint>
      ) : (
        links.map((link, index) => {
          const platform = platformOf(link);
          const handle = handleOf(link, platform);
          const custom = platform.id === "other";
          return (
            <ItemBlock
              key={index}
              index={index}
              title={platform.label}
              preview={handle}
              open={disclosure.isOpen(`links:${index}`)}
              onToggle={() => disclosure.toggle(`links:${index}`)}
              onRemove={() => updateHeader({ links: removeAt(links, index) })}
              removeLabel={`Remove ${platform.label} link`}
              handle={linkDrag.dragProps(index, platform.label, links.length)}
              row={linkDrag.dropProps(index)}
              edge={linkDrag.dropEdge(index)}
              dragging={linkDrag.dragging === index}
            >
              <FieldRow label="Platform">
                <Select
                  ariaLabel={`Platform for link ${index + 1}`}
                  value={platform.id}
                  onChange={(next) => {
                    const nextPlatform =
                      LINK_PLATFORMS.find((item) => item.id === next) ??
                      platform;
                    updateHeader({
                      links: replaceAt(
                        links,
                        index,
                        linkFor(nextPlatform, handle),
                      ),
                    });
                  }}
                  options={LINK_PLATFORMS.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                />
              </FieldRow>

              {custom && (
                <FieldRow label="Label">
                  <Input
                    value={link.label}
                    onChange={(e) =>
                      updateHeader({
                        links: replaceAt(links, index, {
                          ...link,
                          label: e.target.value,
                        }),
                      })
                    }
                    placeholder="Portfolio"
                    className={controlClass}
                  />
                </FieldRow>
              )}

              <FieldRow label={platform.prefix ? "Handle" : "URL"}>
                <div
                  className={cn(
                    controlClass,
                    "flex items-center gap-0 overflow-hidden px-0 focus-within:border-slate-400 dark:focus-within:border-slate-600",
                  )}
                >
                  {platform.prefix && (
                    <span className="shrink-0 py-1 pl-2.5 text-[13px] text-slate-400 dark:text-slate-600">
                      {platform.prefix}
                    </span>
                  )}
                  <input
                    value={handle}
                    onChange={(e) =>
                      updateHeader({
                        links: replaceAt(
                          links,
                          index,
                          custom
                            ? {
                                label: link.label,
                                url: e.target.value,
                              }
                            : linkFor(platform, e.target.value),
                        ),
                      })
                    }
                    placeholder={platform.placeholder}
                    aria-label={`${platform.label} ${platform.prefix ? "handle" : "URL"}`}
                    className={cn(
                      "min-w-0 flex-1 bg-transparent py-1 text-[13px] text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-700",
                      platform.prefix ? "pl-0 pr-2.5" : "px-2.5",
                    )}
                  />
                </div>
              </FieldRow>
            </ItemBlock>
          );
        })
      )}
    </Section>
  );

  const summarySection = (drag?: SectionDrag) => (
    <Section
      {...drag}
      key="summary"
      domId="summary"
      title="Summary"
      preview={value.summary}
      open={disclosure.isOpen("summary")}
      onToggle={() => disclosure.toggle("summary")}
    >
      <Textarea
        value={value.summary}
        onChange={(e) => update({ summary: e.target.value })}
        placeholder="Two or three sentences on the impact you have had."
        rows={3}
        aria-label="Summary"
        className={cn(textareaClass, "min-h-[4.5rem]")}
      />
    </Section>
  );

  const skills = value.skills;
  const addSkillGroup = () => {
    update({ skills: [...skills, { category: "", items: [] }] });
    openWith("skills", skills.length);
  };
  const skillDrag = useDragReorder({
    listId: "skills",
    onMove: (from, to) => update({ skills: moveItem(skills, from, to) }),
  });

  const skillsSection = (drag?: SectionDrag) => (
    <Section
      {...drag}
      key="skills"
      domId="skills"
      title="Skills"
      count={skills.length}
      preview={listPreview(skills.map((group) => group.category))}
      open={disclosure.isOpen("skills")}
      onToggle={() => disclosure.toggle("skills")}
      onAdd={addSkillGroup}
      addLabel="Add skill group"
    >
      {skills.length === 0 ? (
        <EmptyHint onAdd={addSkillGroup} addLabel="Add a group">
          Group skills by kind — languages, infrastructure, practices.
        </EmptyHint>
      ) : (
        skills.map((group, index) => (
          <ItemBlock
            key={index}
            index={index}
            title={group.category || "Untitled group"}
            preview={`${group.items.length} skill${group.items.length === 1 ? "" : "s"}`}
            open={disclosure.isOpen(`skills:${index}`)}
            onToggle={() => disclosure.toggle(`skills:${index}`)}
            onRemove={() => update({ skills: removeAt(skills, index) })}
            removeLabel="Remove skill group"
            handle={skillDrag.dragProps(
              index,
              group.category || "skill group",
              skills.length,
            )}
            row={skillDrag.dropProps(index)}
            edge={skillDrag.dropEdge(index)}
            dragging={skillDrag.dragging === index}
          >
            <FieldRow label="Category">
              <Input
                value={group.category}
                onChange={(e) =>
                  update({
                    skills: replaceAt(skills, index, {
                      ...group,
                      category: e.target.value,
                    }),
                  })
                }
                placeholder="Languages"
                className={controlClass}
              />
            </FieldRow>
            <FieldRow label="Skills" align="start">
              <TokenInput
                ariaLabel={`Skills in ${group.category || "group"}`}
                value={group.items}
                onChange={(items) =>
                  update({
                    skills: replaceAt(skills, index, { ...group, items }),
                  })
                }
                placeholder="Go, Python, SQL"
              />
              {group.items.length === 0 && (
                <p className="pt-1 text-[11px] text-slate-400 dark:text-slate-600">
                  Comma or Enter adds one. Backspace removes the last.
                </p>
              )}
            </FieldRow>
          </ItemBlock>
        ))
      )}
    </Section>
  );

  const experience = value.experience;
  const addRole = () => {
    update({
      experience: [
        ...experience,
        {
          title: "",
          company: "",
          location: "",
          startDate: "",
          endDate: "",
          bullets: [],
        },
      ],
    });
    openWith("experience", experience.length);
  };
  const experienceDrag = useDragReorder({
    listId: "experience",
    onMove: (from, to) =>
      update({ experience: moveItem(experience, from, to) }),
  });

  const experienceSection = (drag?: SectionDrag) => (
    <Section
      {...drag}
      key="experience"
      domId="experience"
      title="Experience"
      count={experience.length}
      preview={listPreview(
        experience.map((role) =>
          [role.title, role.company].filter(Boolean).join(" · "),
        ),
      )}
      open={disclosure.isOpen("experience")}
      onToggle={() => disclosure.toggle("experience")}
      onAdd={addRole}
      addLabel="Add role"
    >
      {experience.length === 0 ? (
        <EmptyHint onAdd={addRole} addLabel="Add a role">
          One entry per role, newest first.
        </EmptyHint>
      ) : (
        experience.map((role, index) => {
          const patch = (fields: Partial<typeof role>) =>
            update({
              experience: replaceAt(experience, index, { ...role, ...fields }),
            });
          return (
            <ItemBlock
              key={index}
              index={index}
              title={role.title || "New role"}
              preview={preview(
                [
                  role.company,
                  [role.startDate, role.endDate].filter(Boolean).join(" – "),
                ],
                0,
              )}
              open={disclosure.isOpen(`experience:${index}`)}
              onToggle={() => disclosure.toggle(`experience:${index}`)}
              onRemove={() =>
                update({ experience: removeAt(experience, index) })
              }
              removeLabel="Remove role"
              handle={experienceDrag.dragProps(
                index,
                role.title || "role",
                experience.length,
              )}
              row={experienceDrag.dropProps(index)}
              edge={experienceDrag.dropEdge(index)}
              dragging={experienceDrag.dragging === index}
            >
              <FieldRow label="Title">
                <Input
                  value={role.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Senior Engineer"
                  className={controlClass}
                />
              </FieldRow>
              <FieldRow label="Company">
                <Input
                  value={role.company}
                  onChange={(e) => patch({ company: e.target.value })}
                  className={controlClass}
                />
              </FieldRow>
              <FieldRow label="Location">
                <Input
                  value={role.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="Optional"
                  className={controlClass}
                />
              </FieldRow>
              <DateRow
                start={role.startDate}
                end={role.endDate}
                onChange={(dates) => patch(dates)}
                endPlaceholder="Present"
              />
              <FieldRow label="Bullets" align="start">
                <Textarea
                  value={role.bullets.join("\n")}
                  onChange={(e) => patch({ bullets: toLines(e.target.value) })}
                  rows={3}
                  aria-label={`Bullets for ${role.title || "role"}`}
                  placeholder="One achievement per line"
                  className={cn(textareaClass, "min-h-[4.5rem]")}
                />
              </FieldRow>
            </ItemBlock>
          );
        })
      )}
    </Section>
  );

  const projects = value.projects;
  const addProject = () => {
    update({
      projects: [
        ...projects,
        { name: "", technologies: [], link: "", bullets: [] },
      ],
    });
    openWith("projects", projects.length);
  };
  const projectDrag = useDragReorder({
    listId: "projects",
    onMove: (from, to) => update({ projects: moveItem(projects, from, to) }),
  });

  const projectsSection = (drag?: SectionDrag) => (
    <Section
      {...drag}
      key="projects"
      domId="projects"
      title="Projects"
      count={projects.length}
      preview={listPreview(projects.map((project) => project.name))}
      open={disclosure.isOpen("projects")}
      onToggle={() => disclosure.toggle("projects")}
      onAdd={addProject}
      addLabel="Add project"
    >
      {projects.length === 0 ? (
        <EmptyHint onAdd={addProject} addLabel="Add a project">
          Side work, open source, anything with a link.
        </EmptyHint>
      ) : (
        projects.map((project, index) => {
          const patch = (fields: Partial<typeof project>) =>
            update({
              projects: replaceAt(projects, index, { ...project, ...fields }),
            });
          return (
            <ItemBlock
              key={index}
              index={index}
              title={project.name || "New project"}
              preview={listPreview(project.technologies)}
              open={disclosure.isOpen(`projects:${index}`)}
              onToggle={() => disclosure.toggle(`projects:${index}`)}
              onRemove={() => update({ projects: removeAt(projects, index) })}
              removeLabel="Remove project"
              handle={projectDrag.dragProps(
                index,
                project.name || "project",
                projects.length,
              )}
              row={projectDrag.dropProps(index)}
              edge={projectDrag.dropEdge(index)}
              dragging={projectDrag.dragging === index}
            >
              <FieldRow label="Name">
                <Input
                  value={project.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  className={controlClass}
                />
              </FieldRow>
              <FieldRow label="Link">
                <Input
                  value={project.link}
                  onChange={(e) => patch({ link: e.target.value })}
                  placeholder="github.com/you/thing"
                  className={controlClass}
                />
              </FieldRow>
              <FieldRow label="Stack" align="start">
                <TokenInput
                  ariaLabel={`Technologies for ${project.name || "project"}`}
                  value={project.technologies}
                  onChange={(technologies) => patch({ technologies })}
                  placeholder="Rust, WebAssembly"
                />
              </FieldRow>
              <FieldRow label="Bullets" align="start">
                <Textarea
                  value={project.bullets.join("\n")}
                  onChange={(e) => patch({ bullets: toLines(e.target.value) })}
                  rows={2}
                  aria-label={`Bullets for ${project.name || "project"}`}
                  placeholder="One line per point"
                  className={cn(textareaClass, "min-h-[3rem]")}
                />
              </FieldRow>
            </ItemBlock>
          );
        })
      )}
    </Section>
  );

  const education = value.education;
  const addEducation = () => {
    update({
      education: [
        ...education,
        {
          degree: "",
          major: "",
          institution: "",
          location: "",
          startDate: "",
          endDate: "",
        },
      ],
    });
    openWith("education", education.length);
  };
  const educationDrag = useDragReorder({
    listId: "education",
    onMove: (from, to) => update({ education: moveItem(education, from, to) }),
  });

  const educationSection = (drag?: SectionDrag) => (
    <Section
      {...drag}
      key="education"
      domId="education"
      title="Education"
      count={education.length}
      preview={listPreview(
        education.map((item) =>
          [item.degree, item.institution].filter(Boolean).join(" · "),
        ),
      )}
      open={disclosure.isOpen("education")}
      onToggle={() => disclosure.toggle("education")}
      onAdd={addEducation}
      addLabel="Add education"
    >
      {education.length === 0 ? (
        <EmptyHint onAdd={addEducation} addLabel="Add an entry">
          Degrees, certifications, anything schooling-shaped.
        </EmptyHint>
      ) : (
        education.map((item, index) => {
          const patch = (fields: Partial<typeof item>) =>
            update({
              education: replaceAt(education, index, { ...item, ...fields }),
            });
          return (
            <ItemBlock
              key={index}
              index={index}
              title={item.degree || item.institution || "New entry"}
              preview={preview([item.major, item.institution], 0)}
              open={disclosure.isOpen(`education:${index}`)}
              onToggle={() => disclosure.toggle(`education:${index}`)}
              onRemove={() => update({ education: removeAt(education, index) })}
              removeLabel="Remove education entry"
              handle={educationDrag.dragProps(
                index,
                item.degree || "entry",
                education.length,
              )}
              row={educationDrag.dropProps(index)}
              edge={educationDrag.dropEdge(index)}
              dragging={educationDrag.dragging === index}
            >
              <FieldRow label="Degree">
                <Input
                  value={item.degree}
                  onChange={(e) => patch({ degree: e.target.value })}
                  placeholder="BSc"
                  className={controlClass}
                />
              </FieldRow>
              <FieldRow label="Major">
                <Input
                  value={item.major}
                  onChange={(e) => patch({ major: e.target.value })}
                  placeholder="Computer Science"
                  className={controlClass}
                />
              </FieldRow>
              <FieldRow label="School">
                <Input
                  value={item.institution}
                  onChange={(e) => patch({ institution: e.target.value })}
                  className={controlClass}
                />
              </FieldRow>
              <FieldRow label="Location">
                <Input
                  value={item.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="Optional"
                  className={controlClass}
                />
              </FieldRow>
              <DateRow
                start={item.startDate}
                end={item.endDate}
                onChange={(dates) => patch(dates)}
                endPlaceholder="May 2023"
              />
            </ItemBlock>
          );
        })
      )}
    </Section>
  );

  const customSections = value.customSections;

  const patchCustom = (index: number, patch: Partial<CustomSection>) =>
    update({
      customSections: replaceAt(customSections, index, {
        ...customSections[index],
        ...patch,
      }),
    });

  const removeCustom = (index: number) => {
    const section = customSections[index];
    update({
      customSections: removeAt(customSections, index),
      sectionOrder: order.filter((key) => key !== customKey(section.id)),
    });
  };

  const addCustomSection = (title: string, layout: CustomLayout) => {
    const section: CustomSection = {
      id: newSectionId(),
      title,
      layout,
      items: layout === "entries" ? [emptyCustomItem()] : [],
    };
    update({
      customSections: [...customSections, section],
      sectionOrder: withMainFlow([...visibleOrder, customKey(section.id)]),
    });
    setAddingSection(false);
    disclosure.set(customKey(section.id), true);
    if (layout === "entries") {
      disclosure.set(`${customKey(section.id)}:0`, true);
    }
  };

  const addCustomItem = (index: number) => {
    const section = customSections[index];
    patchCustom(index, { items: [...section.items, emptyCustomItem()] });
    openWith(customKey(section.id), section.items.length);
  };

  const renderCustomSection = (section: CustomSection, index: number) => {
    const key = customKey(section.id);
    const items = section.items;

    const setItems = (next: CustomItem[]) =>
      patchCustom(index, { items: next });
    const titles = items.map((item) => item.title);

    return (
      <>
        <FieldRow label="Section title">
          <Input
            value={section.title}
            onChange={(e) => patchCustom(index, { title: e.target.value })}
            placeholder="Certifications"
            className={controlClass}
          />
        </FieldRow>

        <FieldRow label="Layout">
          <Select
            ariaLabel={`Layout for ${section.title || "section"}`}
            value={section.layout}
            onChange={(layout) =>
              patchCustom(index, { layout: layout as CustomLayout })
            }
            options={(Object.keys(LAYOUT_LABELS) as CustomLayout[]).map(
              (layout) => ({ value: layout, label: LAYOUT_LABELS[layout] }),
            )}
          />
          <p className="pt-1 text-[11px] text-slate-400 dark:text-slate-600">
            {LAYOUT_HINTS[section.layout]}
          </p>
        </FieldRow>

        {section.layout === "inline" && (
          <FieldRow label="Items" align="start">
            <TokenInput
              ariaLabel={`Items in ${section.title || "section"}`}
              value={titles.filter(Boolean)}
              onChange={(next) =>
                setItems(next.map((title) => ({ ...emptyCustomItem(), title })))
              }
              placeholder="English, French"
            />
          </FieldRow>
        )}

        {section.layout === "bullets" && (
          <FieldRow label="Items" align="start">
            <Textarea
              value={titles.join("\n")}
              onChange={(e) =>
                setItems(
                  toLines(e.target.value).map((title) => ({
                    ...emptyCustomItem(),
                    title,
                  })),
                )
              }
              rows={3}
              aria-label={`Items in ${section.title || "section"}`}
              placeholder="One per line"
              className={cn(textareaClass, "min-h-[4.5rem]")}
            />
          </FieldRow>
        )}

        {section.layout === "entries" &&
          (items.length === 0 ? (
            <EmptyHint
              onAdd={() => addCustomItem(index)}
              addLabel="Add an entry"
            >
              Entries carry a heading, dates and bullets.
            </EmptyHint>
          ) : (
            <CustomEntries
              sectionKey={key}
              sectionTitle={section.title}
              items={items}
              onChange={setItems}
              disclosure={disclosure}
            />
          ))}
      </>
    );
  };

  const bodySections: Record<string, (drag?: SectionDrag) => ReactElement> = {
    summary: summarySection,
    skills: skillsSection,
    experience: experienceSection,
    projects: projectsSection,
    education: educationSection,
  };

  const sectionMeta = (key: string) => {
    if (!key.startsWith("custom:")) {
      const builtIn = key as (typeof BUILT_IN_SECTIONS)[number];
      return { label: SECTION_LABELS[builtIn] ?? key };
    }
    const section = customSections.find(
      (candidate) => customKey(candidate.id) === key,
    );
    return { label: section?.title || "Untitled section" };
  };

  const fixedKeys = sections.fixed.filter((key) => bodySections[key]);
  const grouped = fixedKeys.length > 0;

  return (
    <>
      {contactSection}
      {linksSection}

      {grouped && <GroupLabel>Sidebar</GroupLabel>}
      {fixedKeys.map((key) => bodySections[key]())}
      {grouped && <GroupLabel>Main column</GroupLabel>}

      {visibleOrder.map((key, index) => {
        const handle = sectionDrag.dragProps(
          index,
          sectionMeta(key).label,
          visibleOrder.length,
        );
        const row = sectionDrag.dropProps(index);
        const edge = sectionDrag.dropEdge(index);
        const dragging = sectionDrag.dragging === index;

        if (!key.startsWith("custom:")) {
          const render = bodySections[key];
          if (!render) return null;
          return render({ handle, row, edge, dragging });
        }

        const customIndex = customSections.findIndex(
          (section) => customKey(section.id) === key,
        );
        if (customIndex < 0) return null;
        const section = customSections[customIndex];
        const isEntries = section.layout === "entries";

        return (
          <Section
            key={key}
            domId={key}
            title={section.title || "Untitled section"}
            count={isEntries ? section.items.length : undefined}
            preview={listPreview(section.items.map((item) => item.title))}
            open={disclosure.isOpen(key)}
            onToggle={() => disclosure.toggle(key)}
            onAdd={isEntries ? () => addCustomItem(customIndex) : undefined}
            addLabel="Add entry"
            onRemove={() => removeCustom(customIndex)}
            removeLabel={`Remove ${section.title || "section"}`}
            handle={handle}
            row={row}
            edge={edge}
            dragging={dragging}
          >
            {renderCustomSection(section, customIndex)}
          </Section>
        );
      })}

      <div className="border-t border-slate-200/80 py-3 dark:border-slate-800">
        {addingSection ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Meta>New section</Meta>
              <button
                type="button"
                onClick={() => setAddingSection(false)}
                className="text-[11px] text-slate-400 underline decoration-slate-200 underline-offset-4 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:hover:text-slate-100"
              >
                Cancel
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_PRESETS.map((presetSection) => (
                <button
                  key={presetSection.id}
                  type="button"
                  onClick={() =>
                    addCustomSection(presetSection.title, presetSection.layout)
                  }
                  title={presetSection.hint}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 outline-none transition-colors hover:border-slate-400 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
                >
                  {presetSection.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addCustomSection("", "entries")}
                className="rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none transition-colors hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-400"
              >
                Blank section
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSection(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:text-slate-500 dark:hover:text-slate-100"
          >
            <Plus className="h-3.5 w-3.5" />
            New section
          </button>
        )}
      </div>
    </>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-1 pt-4">
      <Meta>{children}</Meta>
      <span
        aria-hidden
        className="h-px flex-1 bg-slate-200/70 dark:bg-slate-800/80"
      />
    </div>
  );
}

function DateRow({
  start,
  end,
  onChange,
  endPlaceholder,
}: {
  start: string;
  end: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
  endPlaceholder: string;
}) {
  return (
    <FieldRow label="Dates">
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={start}
          onChange={(e) =>
            onChange({ startDate: e.target.value, endDate: end })
          }
          placeholder="Jan 2022"
          aria-label="Start date"
          className={controlClass}
        />
        <Input
          value={end}
          onChange={(e) =>
            onChange({ startDate: start, endDate: e.target.value })
          }
          placeholder={endPlaceholder}
          aria-label="End date"
          className={controlClass}
        />
      </div>
    </FieldRow>
  );
}

function CustomEntries({
  sectionKey,
  sectionTitle,
  items,
  onChange,
  disclosure,
}: {
  sectionKey: string;
  sectionTitle: string;
  items: CustomItem[];
  onChange: (next: CustomItem[]) => void;
  disclosure: Disclosure;
}) {
  const drag = useDragReorder({
    listId: sectionKey,
    onMove: (from, to) => onChange(moveItem(items, from, to)),
  });

  return (
    <>
      {items.map((item, index) => {
        const patch = (fields: Partial<CustomItem>) =>
          onChange(replaceAt(items, index, { ...item, ...fields }));
        return (
          <ItemBlock
            key={index}
            index={index}
            title={item.title || "New entry"}
            preview={preview(
              [
                item.subtitle,
                [item.startDate, item.endDate].filter(Boolean).join(" – "),
              ],
              0,
            )}
            open={disclosure.isOpen(`${sectionKey}:${index}`)}
            onToggle={() => disclosure.toggle(`${sectionKey}:${index}`)}
            onRemove={() => onChange(removeAt(items, index))}
            removeLabel="Remove entry"
            handle={drag.dragProps(index, item.title || "entry", items.length)}
            row={drag.dropProps(index)}
            edge={drag.dropEdge(index)}
            dragging={drag.dragging === index}
          >
            <FieldRow label="Title">
              <Input
                value={item.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Certified Kubernetes Administrator"
                className={controlClass}
              />
            </FieldRow>
            <FieldRow label="Subtitle">
              <Input
                value={item.subtitle}
                onChange={(e) => patch({ subtitle: e.target.value })}
                placeholder="Issuer, publisher, organisation"
                className={controlClass}
              />
            </FieldRow>
            <FieldRow label="Location">
              <Input
                value={item.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="Optional"
                className={controlClass}
              />
            </FieldRow>
            <DateRow
              start={item.startDate}
              end={item.endDate}
              onChange={(dates) => patch(dates)}
              endPlaceholder="Optional"
            />
            <FieldRow label="Description" align="start">
              <Textarea
                value={item.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={2}
                aria-label={`Description for ${item.title || "entry"}`}
                placeholder="Optional line under the heading"
                className={cn(textareaClass, "min-h-[3rem]")}
              />
            </FieldRow>
            <FieldRow label="Bullets" align="start">
              <Textarea
                value={item.bullets.join("\n")}
                onChange={(e) => patch({ bullets: toLines(e.target.value) })}
                rows={2}
                aria-label={`Bullets for ${item.title || "entry"}`}
                placeholder="One line per point"
                className={cn(textareaClass, "min-h-[3rem]")}
              />
            </FieldRow>
          </ItemBlock>
        );
      })}
      <p className="pt-1 text-[11px] text-slate-400 dark:text-slate-600">
        Empty fields stay out of {sectionTitle || "this section"} in the PDF.
      </p>
    </>
  );
}
