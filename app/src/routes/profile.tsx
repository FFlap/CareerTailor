import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { templateSections } from "../../convex/lib/templates";

import { ResumeDropZone } from "@/components/ResumeDropZone";
import SidebarLayout from "@/components/SidebarLayout";
import { Meta } from "@/components/editor/primitives";
import { ResumeFields } from "@/components/editor/ResumeFields";
import {
  sectionsOpen,
  useDisclosure,
} from "@/components/editor/useDisclosure";
import {
  EMPTY_RESUME,
  profileToResume,
  resumeDisclosureKeys,
  resumeToProfile,
  type ResumeData,
} from "@/components/editor/model";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { api } from "@/lib/convex";
import { extractTextFromResume } from "@/lib/extractText";
import { DEFAULT_MODEL } from "@/lib/models";
import { isAcceptedMimeType, type ResumeUploadState } from "@/lib/resumeUpload";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <SidebarLayout>
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
        <AuthLoading>
          <div className="flex justify-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading profile…
            </p>
          </div>
        </AuthLoading>

        <Unauthenticated>
          <EmptyState
            title="Create an account to build your profile"
            description="Your profile is the source every generated document draws from."
            action={
              <Link
                to="/sign-up"
                className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              >
                Create account
              </Link>
            }
          />
        </Unauthenticated>

        <Authenticated>
          <ProfileContent />
        </Authenticated>
      </div>
    </SidebarLayout>
  );
}

/** Fills blanks from the parsed resume; never overwrites what is already there. */
function mergeParsedResume(existing: ResumeData, parsed: any): ResumeData {
  const incoming = profileToResume(parsed);
  const pick = <T,>(next: T[], current: T[]) =>
    next.length ? next : current;

  return {
    header: {
      name: incoming.header.name || existing.header.name,
      email: incoming.header.email || existing.header.email,
      phone: incoming.header.phone || existing.header.phone,
      location: incoming.header.location || existing.header.location,
      links: pick(incoming.header.links, existing.header.links),
    },
    summary: incoming.summary || existing.summary,
    skills: pick(incoming.skills, existing.skills),
    experience: pick(incoming.experience, existing.experience),
    projects: pick(incoming.projects, existing.projects),
    education: pick(incoming.education, existing.education),
    customSections: pick(incoming.customSections, existing.customSections),
    sectionOrder: existing.sectionOrder,
  };
}

function ProfileContent() {
  const profileDoc = useQuery(api.profiles.myProfile, {});
  const upsert = useMutation(api.profiles.upsertMyProfile);
  const parseResume = useAction(api.resumeParsing.parseResumeText);

  const [profile, setProfile] = useState<ResumeData>(EMPTY_RESUME);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [uploadState, setUploadState] = useState<ResumeUploadState>({
    status: "idle",
  });

  const initialized = useRef(false);
  const disclosure = useDisclosure(sectionsOpen);
  const sections = useMemo(() => templateSections(undefined), []);

  const disclosureKeys = useMemo(
    () => resumeDisclosureKeys(profile),
    [profile],
  );
  const allExpanded =
    disclosureKeys.length > 0 && disclosureKeys.every(disclosure.isOpen);

  useEffect(() => {
    if (profileDoc === undefined || initialized.current) return;
    setProfile(profileToResume((profileDoc as any)?.profile));
    initialized.current = true;
  }, [profileDoc]);

  const change = (next: ResumeData) => {
    setProfile(next);
    setDirty(true);
    setStatus("");
  };

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      await upsert({ profile: resumeToProfile(profile) as any });
      setDirty(false);
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    if (!isAcceptedMimeType(file.type)) {
      setUploadState({
        status: "error",
        fileName: file.name,
        error: "Please upload a PDF or DOCX file",
      });
      return;
    }

    try {
      setUploadState({ status: "extracting", fileName: file.name });
      const text = await extractTextFromResume(file);

      setUploadState({ status: "parsing", fileName: file.name });
      const parsed = await parseResume({
        resumeText: text,
        model: DEFAULT_MODEL,
      });

      setProfile((prev) => mergeParsedResume(prev, parsed));
      setDirty(true);
      setUploadState({ status: "success", fileName: file.name });
    } catch (error) {
      setUploadState({
        status: "error",
        fileName: file.name,
        error:
          error instanceof Error ? error.message : "Failed to parse resume",
      });
    }
  }

  if (profileDoc === undefined) return null;

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Everything generated here is written from this page. Upload a résumé to fill it in, or type it out."
      />

      <ResumeDropZone state={uploadState} onFile={(file) => void handleFile(file)} />

      <section className="mt-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <Meta>Sections</Meta>
          <button
            type="button"
            onClick={() => disclosure.setAll(disclosureKeys, !allExpanded)}
            className="ml-auto rounded px-2 py-1 text-[11px] text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 motion-reduce:transition-none dark:hover:bg-slate-900 dark:hover:text-slate-100"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className="@container/fields px-4 sm:px-5">
          <ResumeFields
            value={profile}
            onChange={change}
            disclosure={disclosure}
            sections={sections}
          />
        </div>
      </section>

      <div className="sticky bottom-6 z-10 mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <span className="flex items-center gap-2" role="status" aria-live="polite">
          <span
            aria-hidden
            className={cn(
              "h-1 w-1 rounded-full",
              saving
                ? "bg-amber-500"
                : dirty
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            )}
          />
          <Meta>
            {saving
              ? "Saving…"
              : status || (dirty ? "Unsaved changes" : "Saved")}
          </Meta>
        </span>

        <Button
          onClick={save}
          disabled={saving || !dirty}
          size="sm"
          className="h-8 bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
