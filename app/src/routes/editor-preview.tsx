import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  EmptyHint,
  FieldRow,
  ItemBlock,
  Meta,
  PaneTab,
  Section,
} from "@/components/editor/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor-preview")({
  component: Harness,
});

const inputClass =
  "h-8 rounded-md border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-none transition-colors placeholder:text-slate-300 focus-visible:border-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700 dark:focus-visible:border-slate-600";

function Harness() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    contact: true,
    links: true,
    summary: true,
    skills: false,
    experience: true,
    projects: false,
    education: false,
  });
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4 sm:px-6">
          <span className="text-xs text-slate-500">Documents</span>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-sm font-medium tracking-tight">
              Staff Platform Engineer · Helios Robotics
            </h1>
            <Meta className="hidden sm:inline">Resume · Basic Resume</Meta>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 pr-1">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              <Meta>Synced</Meta>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs font-normal text-slate-500"
            >
              Share
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-px bg-slate-200 dark:bg-slate-800">
        <section className="flex min-h-0 w-full flex-col bg-white lg:w-[46%] lg:min-w-[26rem] dark:bg-slate-950">
          <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-3 dark:border-slate-800">
            <PaneTab active onClick={() => {}}>
              Fields
            </PaneTab>
            <PaneTab active={false} onClick={() => {}}>
              Typst
            </PaneTab>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] font-normal text-slate-400"
              >
                Collapse all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] font-normal text-slate-400"
              >
                Rebuild
              </Button>
            </div>
          </div>

          <div className="@container/fields min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
            <Section
              title="Contact"
              open={open.contact}
              onToggle={() => toggle("contact")}
            >
              <FieldRow label="Name" htmlFor="h-name">
                <Input
                  id="h-name"
                  defaultValue="Ada Lovelace"
                  className={inputClass}
                />
              </FieldRow>
              <FieldRow label="Email" htmlFor="h-email">
                <Input
                  id="h-email"
                  defaultValue="ada@example.com"
                  className={inputClass}
                />
              </FieldRow>
              <FieldRow label="Phone" htmlFor="h-phone">
                <Input
                  id="h-phone"
                  placeholder="Optional"
                  className={inputClass}
                />
              </FieldRow>
              <FieldRow label="Location" htmlFor="h-loc">
                <Input
                  id="h-loc"
                  defaultValue="London, UK"
                  className={inputClass}
                />
              </FieldRow>
            </Section>

            <Section
              title="Links"
              count={2}
              open={open.links}
              onToggle={() => toggle("links")}
              onAdd={() => {}}
              addLabel="Add link"
            >
              {[
                { label: "GitHub", url: "github.com/adalovelace" },
                { label: "LinkedIn", url: "linkedin.com/in/adalovelace" },
              ].map((l, i) => (
                <ItemBlock
                  key={i}
                  index={i}
                  title={l.label}
                  onRemove={() => {}}
                  removeLabel="Remove link"
                >
                  <FieldRow label="Label">
                    <Input defaultValue={l.label} className={inputClass} />
                  </FieldRow>
                  <FieldRow label="URL">
                    <Input defaultValue={l.url} className={inputClass} />
                  </FieldRow>
                </ItemBlock>
              ))}
            </Section>

            <Section
              title="Summary"
              open={open.summary}
              onToggle={() => toggle("summary")}
            >
              <Textarea
                defaultValue="Backend engineer focused on low-latency streaming and platform reliability."
                rows={3}
                className={cn(inputClass, "min-h-[4.5rem] leading-relaxed")}
              />
              <p className="pt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Basic Resume has no summary section, so this stays out of the
                PDF. It is kept with the document for other templates.
              </p>
            </Section>

            <Section
              title="Skills"
              count={3}
              open={open.skills}
              onToggle={() => toggle("skills")}
              onAdd={() => {}}
              addLabel="Add skill group"
            >
              <ItemBlock
                index={0}
                title="Languages"
                onRemove={() => {}}
                removeLabel="Remove"
              >
                <FieldRow label="Category">
                  <Input defaultValue="Languages" className={inputClass} />
                </FieldRow>
              </ItemBlock>
            </Section>

            <Section
              title="Experience"
              count={2}
              open={open.experience}
              onToggle={() => toggle("experience")}
              onAdd={() => {}}
              addLabel="Add role"
            >
              <ItemBlock
                index={0}
                title="Senior Backend Engineer · Northwind Data"
                onRemove={() => {}}
                removeLabel="Remove role"
              >
                <FieldRow label="Title">
                  <Input
                    defaultValue="Senior Backend Engineer"
                    className={inputClass}
                  />
                </FieldRow>
                <FieldRow label="Company">
                  <Input defaultValue="Northwind Data" className={inputClass} />
                </FieldRow>
                <FieldRow label="Dates">
                  <div className="grid grid-cols-2 gap-2">
                    <Input defaultValue="Mar 2021" className={inputClass} />
                    <Input defaultValue="Present" className={inputClass} />
                  </div>
                </FieldRow>
                <FieldRow label="Bullets" align="start">
                  <Textarea
                    defaultValue={
                      "Rebuilt the ingestion pipeline in Go, cutting p99 from 1.8s to 240ms.\nLed four engineers through a Postgres migration."
                    }
                    rows={3}
                    className={cn(inputClass, "min-h-[4.5rem] leading-relaxed")}
                  />
                </FieldRow>
              </ItemBlock>
            </Section>

            <Section
              title="Projects"
              count={0}
              open={open.projects}
              onToggle={() => toggle("projects")}
              onAdd={() => {}}
              addLabel="Add project"
            >
              <EmptyHint onAdd={() => {}} addLabel="Add a project">
                Side work, open source, anything with a link.
              </EmptyHint>
            </Section>

            <Section
              title="Education"
              count={1}
              open={open.education}
              onToggle={() => toggle("education")}
              onAdd={() => {}}
              addLabel="Add education"
            />

            <div className="h-16" />
          </div>

          <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-200 px-4 dark:border-slate-800">
            <Meta>Fields drive the source</Meta>
            <Meta>214 words</Meta>
          </div>
        </section>

        <section className="hidden min-h-0 flex-1 flex-col bg-slate-100 lg:flex dark:bg-slate-900">
          <div className="flex h-[41px] shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
            <Meta>Preview</Meta>
            <Meta>Basic Resume</Meta>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-auto p-6 lg:p-10">
            <div className="relative w-full max-w-[595px]">
              <div className="flex aspect-[1/1.414] w-full flex-col items-center justify-center gap-2 border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-950">
                <Meta>Rendering</Meta>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
