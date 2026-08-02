import { useAuth, UserButton } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileCode,
  Loader2,
  Moon,
  Share2,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Id } from "../../convex/_generated/dataModel";

import { templateShowsSummary } from "../../convex/lib/templates";

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
import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor/$documentId")({
  component: EditorPage,
});

type ResumeData = {
  header: {
    name: string;
    email: string;
    phone: string;
    location: string;
    links: Array<{ label: string; url: string }>;
  };
  summary: string;
  skills: Array<{ category: string; items: string[] }>;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    technologies: string[];
    link: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    major: string;
    institution: string;
    location: string;
    startDate: string;
    endDate: string;
  }>;
};

type CoverLetterData = {
  greeting: string;
  body_paragraphs: string[];
  closing: string;
  signature_name: string;
};

const EMPTY_RESUME: ResumeData = {
  header: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
};

const EMPTY_COVER: CoverLetterData = {
  greeting: "",
  body_paragraphs: [""],
  closing: "",
  signature_name: "",
};

function ensureString(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeResumeData(input: any): ResumeData {
  const raw = input?.resume ?? input ?? {};
  const header = raw.header ?? {};
  const links = Array.isArray(header.links)
    ? header.links
        .map((link: any) => ({
          label: ensureString(link?.label),
          url: ensureString(link?.url),
        }))
        .filter((link: any) => link.label || link.url)
    : [];
  const skills = Array.isArray(raw.skills)
    ? raw.skills.map((skill: any) => ({
        category: ensureString(skill?.category),
        items: Array.isArray(skill?.items)
          ? skill.items.map(ensureString).filter(Boolean)
          : [],
      }))
    : [];
  const experience = Array.isArray(raw.experience)
    ? raw.experience.map((exp: any) => ({
        title: ensureString(exp?.title),
        company: ensureString(exp?.company),
        location: ensureString(exp?.location),
        startDate: ensureString(exp?.startDate),
        endDate: ensureString(exp?.endDate),
        bullets: Array.isArray(exp?.bullets)
          ? exp.bullets.map(ensureString).filter(Boolean)
          : [],
      }))
    : [];
  const projects = Array.isArray(raw.projects)
    ? raw.projects.map((proj: any) => ({
        name: ensureString(proj?.name),
        technologies: Array.isArray(proj?.technologies)
          ? proj.technologies.map(ensureString).filter(Boolean)
          : [],
        link: ensureString(proj?.link),
        bullets: Array.isArray(proj?.bullets)
          ? proj.bullets.map(ensureString).filter(Boolean)
          : [],
      }))
    : [];
  const education = Array.isArray(raw.education)
    ? raw.education.map((edu: any) => ({
        degree: ensureString(edu?.degree),
        major: ensureString(edu?.major),
        institution: ensureString(edu?.institution),
        location: ensureString(edu?.location),
        startDate: ensureString(edu?.startDate),
        endDate: ensureString(edu?.endDate),
      }))
    : [];

  return {
    header: {
      name: ensureString(header?.name),
      email: ensureString(header?.email),
      phone: ensureString(header?.phone),
      location: ensureString(header?.location),
      links,
    },
    summary: ensureString(raw.summary),
    skills,
    experience,
    projects,
    education,
  };
}

function normalizeCoverLetterData(input: any): CoverLetterData {
  const raw = input?.cover_letter ?? input ?? {};
  const body = Array.isArray(raw.body_paragraphs)
    ? raw.body_paragraphs.map(ensureString).filter(Boolean)
    : [];
  return {
    greeting: ensureString(raw.greeting),
    body_paragraphs: body.length ? body : [""],
    closing: ensureString(raw.closing),
    signature_name: ensureString(raw.signature_name),
  };
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const inputClass =
  "h-8 rounded-md border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-none transition-colors placeholder:text-slate-300 focus-visible:border-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700 dark:focus-visible:border-slate-600";

const RESUME_SECTION_KEYS = [
  "contact",
  "links",
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
] as const;

const COVER_SECTION_KEYS = ["greeting", "body", "signoff"] as const;

function EditorPage() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Sign in to edit documents.
          </p>
        </div>
      </Unauthenticated>

      <Authenticated>
        <EditorContent />
      </Authenticated>
    </main>
  );
}

function EditorContent() {
  const { documentId } = Route.useParams();
  const doc = useQuery(api.documents.getMyDocument, {
    documentId: documentId as Id<"documents">,
  });
  const updateTypstSource = useMutation(api.documents.updateMyTypstSource);
  const updateDocumentData = useMutation(api.documents.updateMyDocumentData);

  const [source, setSource] = useState("");
  const [status, setStatus] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const hasAutoRendered = useRef(false);
  const [isDark, setIsDark] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "source">("fields");
  const [structuredData, setStructuredData] = useState<
    ResumeData | CoverLetterData | null
  >(null);
  const [structuredDirty, setStructuredDirty] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const { isSignedIn } = useAuth();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const statusTimeout = useRef<number | null>(null);
  const autoApplyTimeout = useRef<number | null>(null);
  const structuredJsonRef = useRef<string>("");
  const sourceRef = useRef<string>("");
  const lastDocIdRef = useRef<string | null>(null);

  const sourceOverridden = Boolean(doc?.sourceEditedAt);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const sectionsKey = `editor:sections:${documentId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(sectionsKey);
      if (stored) setOpenSections(JSON.parse(stored));
    } catch {}
  }, [sectionsKey]);

  const toggleSection = useCallback(
    (key: string, fallbackOpen: boolean) => {
      setOpenSections((prev) => {
        const next = { ...prev, [key]: !(prev[key] ?? fallbackOpen) };
        try {
          window.localStorage.setItem(sectionsKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [sectionsKey],
  );

  const isSectionOpen = useCallback(
    (key: string, fallbackOpen: boolean) => openSections[key] ?? fallbackOpen,
    [openSections],
  );

  const sectionDefaults = useMemo(() => {
    if (doc?.type === "cover_letter") {
      return { greeting: true, body: true, signoff: true } as Record<
        string,
        boolean
      >;
    }
    const resume = (structuredData ?? EMPTY_RESUME) as ResumeData;
    return {
      contact: true,
      links: resume.header.links.length > 0,
      summary: Boolean(resume.summary),
      skills: resume.skills.length > 0,
      experience: resume.experience.length > 0,
      projects: resume.projects.length > 0,
      education: resume.education.length > 0,
    } as Record<string, boolean>;
  }, [doc?.type, structuredData]);

  const sectionKeys = useMemo(
    () =>
      doc?.type === "cover_letter"
        ? [...COVER_SECTION_KEYS]
        : [...RESUME_SECTION_KEYS],
    [doc?.type],
  );

  const allExpanded = sectionKeys.every((key) =>
    isSectionOpen(key, sectionDefaults[key] ?? false),
  );

  const setAllSections = useCallback(
    (open: boolean) => {
      setOpenSections((prev) => {
        const next = { ...prev };
        for (const key of sectionKeys) next[key] = open;
        try {
          window.localStorage.setItem(sectionsKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [sectionKeys, sectionsKey],
  );

  const showsSummary = templateShowsSummary(doc?.templateId);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    structuredJsonRef.current = JSON.stringify(structuredData ?? null);
  }, [structuredData]);

  useEffect(() => {
    if (!doc) return;
    const normalized =
      doc.type === "resume"
        ? normalizeResumeData(doc.data)
        : normalizeCoverLetterData(doc.data);

    if (doc._id !== lastDocIdRef.current) {
      lastDocIdRef.current = doc._id;
      setSource(doc.typstSource || "");
      setSourceDirty(false);
      setStructuredData(normalized);
      setStructuredDirty(false);
      setRenderError(null);
      setSaveError(null);
      return;
    }

    if (!sourceDirty && (doc.typstSource || "") !== sourceRef.current) {
      setSource(doc.typstSource || "");
    }
    if (!structuredDirty && !isApplying) {
      const normalizedJson = JSON.stringify(normalized);
      if (normalizedJson !== structuredJsonRef.current) {
        setStructuredData(normalized);
      }
    }
  }, [doc, sourceDirty, structuredDirty, isApplying]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    return () => {
      if (statusTimeout.current) {
        window.clearTimeout(statusTimeout.current);
      }
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current);
      }
    };
  }, []);

  const pushStatus = useCallback((message: string, autoClear = true) => {
    setStatus(message);
    if (statusTimeout.current) {
      window.clearTimeout(statusTimeout.current);
    }
    if (autoClear) {
      statusTimeout.current = window.setTimeout(() => setStatus(""), 2400);
    }
  }, []);

  const render = useCallback(
    async (sourceToRender: string) => {
      if (!doc) return false;
      const container = previewRef.current;
      if (!container) {
        setStatus("Preview not ready.");
        return false;
      }
      setStatus("Rendering…");
      try {
        const { renderTypstToCanvasInBrowser } =
          await import("@/lib/typst/renderClient");
        await renderTypstToCanvasInBrowser({
          source: sourceToRender,
          documentType: doc.type,
          templateId: doc.templateId,
          container,
        });
        setHasPreview(true);
        setRenderError(null);
        pushStatus("Ready.");
        return true;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Typst failed to compile this source.";
        setRenderError(message);
        setStatus("Compile error.");
        return false;
      }
    },
    [doc, pushStatus],
  );

  const saveSource = useCallback(async () => {
    if (!doc?._id) return false;
    setIsSavingSource(true);
    setSaveError(null);
    setStatus("Saving…");
    try {
      await updateTypstSource({ documentId: doc._id, typstSource: source });
      setSourceDirty(false);
      pushStatus("Source saved.");
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed.");
      setStatus("Save failed.");
      return false;
    } finally {
      setIsSavingSource(false);
    }
  }, [doc, pushStatus, source, updateTypstSource]);

  const applyFields = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!doc || !structuredData) return false;
      setIsApplying(true);
      setSaveError(null);
      try {
        const result = await updateDocumentData({
          documentId: doc._id,
          data: structuredData,
        });
        setStructuredDirty(false);
        if (result?.typstSource) {
          setSource(result.typstSource);
          setSourceDirty(false);
          await render(result.typstSource);
        }
        if (!silent) pushStatus("Source rebuilt from fields.");
        return true;
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Could not rebuild the document.",
        );
        return false;
      } finally {
        setIsApplying(false);
      }
    },
    [doc, pushStatus, render, structuredData, updateDocumentData],
  );

  useEffect(() => {
    if (!doc || !source || hasAutoRendered.current) return;
    hasAutoRendered.current = true;
    void render(source);
  }, [doc, source, render]);

  const wordCount = useMemo(() => {
    const trimmed = source.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [source]);

  const templateLabel = useMemo(() => {
    if (!doc?.templateId) return "Custom";
    return doc.templateId.startsWith("custom:")
      ? "Custom Template"
      : doc.templateId.replace(/-/g, " ");
  }, [doc?.templateId]);

  const docTypeLabel = useMemo(() => {
    if (!doc?.type) return "Document";
    return doc.type === "cover_letter" ? "Cover Letter" : "Resume";
  }, [doc?.type]);

  const idleStatus = useMemo(() => {
    if (renderError) return "Compile error";
    if (sourceDirty) return "Unsaved source";
    if (structuredDirty)
      return sourceOverridden ? "Fields not applied" : "Applying…";
    if (sourceOverridden) return "Custom source";
    return "Synced";
  }, [renderError, sourceDirty, sourceOverridden, structuredDirty]);

  const statusTone = useMemo(() => {
    if (renderError) return "bg-rose-500";
    if (!status) {
      return sourceDirty || structuredDirty || sourceOverridden
        ? "bg-amber-500"
        : "bg-emerald-500";
    }
    const lowered = status.toLowerCase();
    if (lowered.includes("fail") || lowered.includes("error"))
      return "bg-rose-500";
    if (
      lowered.includes("saving") ||
      lowered.includes("render") ||
      lowered.includes("export") ||
      lowered.includes("share") ||
      lowered.includes("copy")
    ) {
      return "bg-amber-500";
    }
    return "bg-emerald-500";
  }, [renderError, sourceDirty, sourceOverridden, status, structuredDirty]);

  const handleShare = useCallback(async () => {
    if (!doc) return;
    if (typeof window === "undefined") return;
    const shareUrl = window.location.href;
    const shareTitle = doc?.title || docTypeLabel;
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url: shareUrl });
        pushStatus("Share ready.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        pushStatus("Link copied.");
        return;
      }
      window.prompt("Copy this link:", shareUrl);
      pushStatus("Link ready to copy.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setStatus(error instanceof Error ? error.message : "Share failed.");
    } finally {
      setIsSharing(false);
    }
  }, [doc, docTypeLabel, pushStatus]);

  const handleExportPdf = useCallback(async () => {
    if (!doc) return;
    if (typeof document === "undefined") return;
    setIsExporting(true);
    setStatus("Exporting PDF…");
    try {
      const { renderTypstToPdfBytesInBrowser } =
        await import("@/lib/typst/renderClient");
      const pdfBytes = await renderTypstToPdfBytesInBrowser({
        source,
        documentType: doc.type,
        templateId: doc.templateId,
      });
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const baseName = (doc?.title || docTypeLabel).replace(
        /[^a-z0-9]+/gi,
        "-",
      );
      const fileName = `${baseName || "document"}.pdf`;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      pushStatus("PDF downloaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }, [doc, docTypeLabel, pushStatus, source]);

  const markStructuredDirty = () => {
    setStructuredDirty(true);
  };

  const updateResumeHeader = (
    field: keyof ResumeData["header"],
    value: string,
  ) => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      return {
        ...resume,
        header: {
          ...resume.header,
          [field]: value,
        },
      };
    });
    markStructuredDirty();
  };

  const updateResumeSummary = (value: string) => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      return { ...resume, summary: value };
    });
    markStructuredDirty();
  };

  const updateResumeSectionItem = (
    section: "skills" | "experience" | "projects" | "education",
    index: number,
    field: string,
    value: string | string[],
  ) => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      const list = [...(resume[section] as any[])];
      if (!list[index]) return prev;
      list[index] = { ...list[index], [field]: value };
      return { ...resume, [section]: list };
    });
    markStructuredDirty();
  };

  const updateResumeLinks = (
    index: number,
    field: "label" | "url",
    value: string,
  ) => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      const links = [...resume.header.links];
      links[index] = { ...links[index], [field]: value };
      return { ...resume, header: { ...resume.header, links } };
    });
    markStructuredDirty();
  };

  const addResumeLink = () => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      return {
        ...resume,
        header: {
          ...resume.header,
          links: [...resume.header.links, { label: "", url: "" }],
        },
      };
    });
    markStructuredDirty();
  };

  const removeResumeLink = (index: number) => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      const links = resume.header.links.filter((_, idx) => idx !== index);
      return { ...resume, header: { ...resume.header, links } };
    });
    markStructuredDirty();
  };

  const addResumeSectionItem = (
    section: "skills" | "experience" | "projects" | "education",
  ) => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      const list = [...(resume[section] as any[])];
      if (section === "skills") {
        list.push({ category: "", items: [] });
      } else if (section === "experience") {
        list.push({
          title: "",
          company: "",
          location: "",
          startDate: "",
          endDate: "",
          bullets: [],
        });
      } else if (section === "projects") {
        list.push({ name: "", technologies: [], link: "", bullets: [] });
      } else {
        list.push({
          degree: "",
          major: "",
          institution: "",
          location: "",
          startDate: "",
          endDate: "",
        });
      }
      return { ...resume, [section]: list };
    });
    markStructuredDirty();
  };

  const removeResumeSectionItem = (
    section: "skills" | "experience" | "projects" | "education",
    index: number,
  ) => {
    if (!doc || doc.type !== "resume") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "resume") return prev;
      const resume = prev as ResumeData;
      const list = (resume[section] as any[]).filter((_, idx) => idx !== index);
      return { ...resume, [section]: list };
    });
    markStructuredDirty();
  };

  const updateCoverLetterField = (
    field: keyof CoverLetterData,
    value: string | string[],
  ) => {
    if (!doc || doc.type !== "cover_letter") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "cover_letter") return prev;
      const cover = prev as CoverLetterData;
      return { ...cover, [field]: value };
    });
    markStructuredDirty();
  };

  const addCoverParagraph = () => {
    if (!doc || doc.type !== "cover_letter") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "cover_letter") return prev;
      const cover = prev as CoverLetterData;
      return { ...cover, body_paragraphs: [...cover.body_paragraphs, ""] };
    });
    markStructuredDirty();
  };

  const removeCoverParagraph = (index: number) => {
    if (!doc || doc.type !== "cover_letter") return;
    setStructuredData((prev) => {
      if (!prev || doc.type !== "cover_letter") return prev;
      const cover = prev as CoverLetterData;
      const paragraphs = cover.body_paragraphs.filter(
        (_, idx) => idx !== index,
      );
      return {
        ...cover,
        body_paragraphs: paragraphs.length ? paragraphs : [""],
      };
    });
    markStructuredDirty();
  };

  useEffect(() => {
    if (!doc || !structuredData) return;
    if (!structuredDirty) return;
    if (sourceOverridden || sourceDirty) return;
    if (activeTab !== "fields") return;
    if (isApplying) return;

    if (autoApplyTimeout.current) {
      window.clearTimeout(autoApplyTimeout.current);
    }
    autoApplyTimeout.current = window.setTimeout(() => {
      void applyFields({ silent: true });
    }, 700);

    return () => {
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current);
      }
    };
  }, [
    activeTab,
    applyFields,
    doc,
    isApplying,
    sourceDirty,
    sourceOverridden,
    structuredData,
    structuredDirty,
  ]);

  const switchTab = useCallback(
    async (next: "fields" | "source") => {
      if (next === activeTab) return;
      if (autoApplyTimeout.current) {
        window.clearTimeout(autoApplyTimeout.current);
        autoApplyTimeout.current = null;
      }

      if (next === "source") {
        if (structuredDirty && !sourceOverridden && !sourceDirty) {
          await applyFields({ silent: true });
        }
      } else if (sourceDirty) {
        const saved = await saveSource();
        if (saved) await render(sourceRef.current);
      }

      setActiveTab(next);
    },
    [
      activeTab,
      applyFields,
      render,
      saveSource,
      sourceDirty,
      sourceOverridden,
      structuredDirty,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      void saveSource();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void render(source);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4 sm:px-6">
          <Link
            to="/dashboard"
            className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-400 dark:hover:text-slate-100 md:flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Documents
          </Link>

          <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-800 md:block" />

          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
              {doc?.title || docTypeLabel}
            </h1>
            <Meta className="hidden shrink-0 sm:inline">
              {docTypeLabel} · {templateLabel}
            </Meta>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="flex items-center gap-1.5 pr-1"
              role="status"
              aria-live="polite"
            >
              <span
                className={cn("h-1 w-1 rounded-full", statusTone)}
                aria-hidden
              />
              <Meta>{status || idleStatus}</Meta>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              aria-label={
                isDark ? "Switch to light theme" : "Switch to dark theme"
              }
              className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              disabled={!doc || isSharing}
              className="h-8 gap-1.5 px-2.5 text-xs font-normal text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              {isSharing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              Share
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={!doc || isExporting}
              className="h-8 gap-1.5 bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
            </Button>
            {isSignedIn && <UserButton afterSignOutUrl="/" />}
          </div>
        </div>
      </header>

      {!doc ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-px bg-slate-200 dark:bg-slate-800">
          <section className="flex min-h-0 w-full flex-col bg-white lg:w-[46%] lg:min-w-[26rem] dark:bg-slate-950">
            <div
              role="tablist"
              className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-3 dark:border-slate-800"
            >
              <PaneTab
                active={activeTab === "fields"}
                onClick={() => void switchTab("fields")}
              >
                Fields
              </PaneTab>
              <PaneTab
                active={activeTab === "source"}
                onClick={() => void switchTab("source")}
              >
                Typst
              </PaneTab>

              <div className="ml-auto flex items-center gap-1">
                {activeTab === "fields" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllSections(!allExpanded)}
                      className="h-7 px-2 text-[11px] font-normal text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                    >
                      {allExpanded ? "Collapse all" : "Expand all"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void applyFields()}
                      disabled={isApplying || !structuredData}
                      className={cn(
                        "h-7 px-2 text-[11px] font-normal",
                        structuredDirty
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-400 dark:text-slate-500",
                        "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                      )}
                    >
                      {isApplying
                        ? "Rebuilding…"
                        : structuredDirty
                          ? "Apply now"
                          : "Rebuild"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void saveSource()}
                      disabled={isSavingSource || !sourceDirty}
                      className="h-7 px-2 text-[11px] font-normal text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                    >
                      {isSavingSource
                        ? "Saving…"
                        : sourceDirty
                          ? "Save"
                          : "Saved"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void render(source)}
                      className="h-7 px-2 text-[11px] font-normal text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-900"
                    >
                      Render
                    </Button>
                  </>
                )}
              </div>
            </div>

            {sourceOverridden && (
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                <Meta className="text-slate-500 dark:text-slate-400">
                  Hand-edited
                </Meta>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The Typst below is yours. Fields no longer drive it.
                </p>
                <button
                  type="button"
                  onClick={() => void applyFields()}
                  disabled={isApplying}
                  className="text-xs text-slate-900 underline decoration-slate-300 underline-offset-4 outline-none hover:decoration-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50 dark:text-slate-100 dark:decoration-slate-600 dark:hover:decoration-slate-100"
                >
                  Rebuild from fields
                </button>
              </div>
            )}

            {saveError && (
              <p className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {saveError}
              </p>
            )}

            {activeTab === "source" ? (
              <div className="flex min-h-0 flex-1">
                <div
                  aria-hidden
                  className="hidden shrink-0 select-none overflow-hidden border-r border-slate-100 py-4 pl-4 pr-2 text-right font-mono text-[11px] leading-6 text-slate-300 dark:border-slate-900 dark:text-slate-700 sm:block"
                >
                  {source.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <Textarea
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setSourceDirty(true);
                  }}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  aria-label="Typst source"
                  className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-4 font-mono text-[12.5px] leading-6 text-slate-700 shadow-none focus-visible:ring-0 dark:text-slate-300"
                />
              </div>
            ) : (
              <div className="@container/fields min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5">
                {doc.type === "resume"
                  ? (() => {
                      const resume = (structuredData ??
                        EMPTY_RESUME) as ResumeData;

                      return (
                        <>
                          <Section
                            title="Contact"
                            open={isSectionOpen("contact", true)}
                            onToggle={() => toggleSection("contact", true)}
                          >
                            <FieldRow label="Name" htmlFor="f-name">
                              <Input
                                id="f-name"
                                value={resume.header.name}
                                onChange={(e) =>
                                  updateResumeHeader("name", e.target.value)
                                }
                                placeholder="Full name"
                                className={inputClass}
                              />
                            </FieldRow>
                            <FieldRow label="Email" htmlFor="f-email">
                              <Input
                                id="f-email"
                                type="email"
                                value={resume.header.email}
                                onChange={(e) =>
                                  updateResumeHeader("email", e.target.value)
                                }
                                placeholder="you@domain.com"
                                className={inputClass}
                              />
                            </FieldRow>
                            <FieldRow label="Phone" htmlFor="f-phone">
                              <Input
                                id="f-phone"
                                value={resume.header.phone}
                                onChange={(e) =>
                                  updateResumeHeader("phone", e.target.value)
                                }
                                placeholder="Optional"
                                className={inputClass}
                              />
                            </FieldRow>
                            <FieldRow label="Location" htmlFor="f-location">
                              <Input
                                id="f-location"
                                value={resume.header.location}
                                onChange={(e) =>
                                  updateResumeHeader("location", e.target.value)
                                }
                                placeholder="City, Region"
                                className={inputClass}
                              />
                            </FieldRow>
                          </Section>

                          <Section
                            title="Links"
                            count={resume.header.links.length}
                            open={isSectionOpen(
                              "links",
                              resume.header.links.length > 0,
                            )}
                            onToggle={() =>
                              toggleSection(
                                "links",
                                resume.header.links.length > 0,
                              )
                            }
                            onAdd={addResumeLink}
                            addLabel="Add link"
                          >
                            {resume.header.links.length === 0 ? (
                              <EmptyHint
                                onAdd={addResumeLink}
                                addLabel="Add one"
                              >
                                Templates pick out GitHub, LinkedIn and a
                                personal site.
                              </EmptyHint>
                            ) : (
                              resume.header.links.map((link, index) => (
                                <ItemBlock
                                  key={index}
                                  index={index}
                                  title={link.label || link.url || "Link"}
                                  onRemove={() => removeResumeLink(index)}
                                  removeLabel="Remove link"
                                >
                                  <FieldRow label="Label">
                                    <Input
                                      value={link.label}
                                      onChange={(e) =>
                                        updateResumeLinks(
                                          index,
                                          "label",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="LinkedIn"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="URL">
                                    <Input
                                      value={link.url}
                                      onChange={(e) =>
                                        updateResumeLinks(
                                          index,
                                          "url",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="linkedin.com/in/you"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                </ItemBlock>
                              ))
                            )}
                          </Section>

                          <Section
                            title="Summary"
                            open={isSectionOpen(
                              "summary",
                              Boolean(resume.summary),
                            )}
                            onToggle={() =>
                              toggleSection("summary", Boolean(resume.summary))
                            }
                          >
                            <Textarea
                              value={resume.summary}
                              onChange={(e) =>
                                updateResumeSummary(e.target.value)
                              }
                              placeholder="Two or three sentences on the impact you have had."
                              rows={3}
                              className={cn(
                                inputClass,
                                "min-h-[4.5rem] leading-relaxed",
                              )}
                            />
                            {!showsSummary && (
                              <p className="pt-1.5 text-xs text-slate-400 dark:text-slate-500">
                                {templateLabel} has no summary section, so this
                                stays out of the PDF. It is kept with the
                                document for other templates.
                              </p>
                            )}
                          </Section>

                          <Section
                            title="Skills"
                            count={resume.skills.length}
                            open={isSectionOpen(
                              "skills",
                              resume.skills.length > 0,
                            )}
                            onToggle={() =>
                              toggleSection("skills", resume.skills.length > 0)
                            }
                            onAdd={() => addResumeSectionItem("skills")}
                            addLabel="Add skill group"
                          >
                            {resume.skills.length === 0 ? (
                              <EmptyHint
                                onAdd={() => addResumeSectionItem("skills")}
                                addLabel="Add a group"
                              >
                                Group skills by kind — languages,
                                infrastructure, practices.
                              </EmptyHint>
                            ) : (
                              resume.skills.map((skill, index) => (
                                <ItemBlock
                                  key={index}
                                  index={index}
                                  title={skill.category || "Untitled group"}
                                  onRemove={() =>
                                    removeResumeSectionItem("skills", index)
                                  }
                                  removeLabel="Remove skill group"
                                >
                                  <FieldRow label="Category">
                                    <Input
                                      value={skill.category}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "skills",
                                          index,
                                          "category",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Languages"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Items">
                                    <Input
                                      value={skill.items.join(", ")}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "skills",
                                          index,
                                          "items",
                                          splitList(e.target.value),
                                        )
                                      }
                                      placeholder="Go, Python, SQL"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                </ItemBlock>
                              ))
                            )}
                          </Section>

                          <Section
                            title="Experience"
                            count={resume.experience.length}
                            open={isSectionOpen(
                              "experience",
                              resume.experience.length > 0,
                            )}
                            onToggle={() =>
                              toggleSection(
                                "experience",
                                resume.experience.length > 0,
                              )
                            }
                            onAdd={() => addResumeSectionItem("experience")}
                            addLabel="Add role"
                          >
                            {resume.experience.length === 0 ? (
                              <EmptyHint
                                onAdd={() => addResumeSectionItem("experience")}
                                addLabel="Add a role"
                              >
                                One entry per role, newest first.
                              </EmptyHint>
                            ) : (
                              resume.experience.map((exp, index) => (
                                <ItemBlock
                                  key={index}
                                  index={index}
                                  title={
                                    [exp.title, exp.company]
                                      .filter(Boolean)
                                      .join(" · ") || "New role"
                                  }
                                  onRemove={() =>
                                    removeResumeSectionItem("experience", index)
                                  }
                                  removeLabel="Remove role"
                                >
                                  <FieldRow label="Title">
                                    <Input
                                      value={exp.title}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "experience",
                                          index,
                                          "title",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Senior Engineer"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Company">
                                    <Input
                                      value={exp.company}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "experience",
                                          index,
                                          "company",
                                          e.target.value,
                                        )
                                      }
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Location">
                                    <Input
                                      value={exp.location}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "experience",
                                          index,
                                          "location",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Optional"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Dates">
                                    <div className="grid grid-cols-2 gap-2">
                                      <Input
                                        value={exp.startDate}
                                        onChange={(e) =>
                                          updateResumeSectionItem(
                                            "experience",
                                            index,
                                            "startDate",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Jan 2022"
                                        className={inputClass}
                                      />
                                      <Input
                                        value={exp.endDate}
                                        onChange={(e) =>
                                          updateResumeSectionItem(
                                            "experience",
                                            index,
                                            "endDate",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Present"
                                        className={inputClass}
                                      />
                                    </div>
                                  </FieldRow>
                                  <FieldRow label="Bullets" align="start">
                                    <Textarea
                                      value={(exp.bullets || []).join("\n")}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "experience",
                                          index,
                                          "bullets",
                                          splitLines(e.target.value),
                                        )
                                      }
                                      rows={3}
                                      placeholder="One achievement per line"
                                      className={cn(
                                        inputClass,
                                        "min-h-[4.5rem] leading-relaxed",
                                      )}
                                    />
                                  </FieldRow>
                                </ItemBlock>
                              ))
                            )}
                          </Section>

                          <Section
                            title="Projects"
                            count={resume.projects.length}
                            open={isSectionOpen(
                              "projects",
                              resume.projects.length > 0,
                            )}
                            onToggle={() =>
                              toggleSection(
                                "projects",
                                resume.projects.length > 0,
                              )
                            }
                            onAdd={() => addResumeSectionItem("projects")}
                            addLabel="Add project"
                          >
                            {resume.projects.length === 0 ? (
                              <EmptyHint
                                onAdd={() => addResumeSectionItem("projects")}
                                addLabel="Add a project"
                              >
                                Side work, open source, anything with a link.
                              </EmptyHint>
                            ) : (
                              resume.projects.map((project, index) => (
                                <ItemBlock
                                  key={index}
                                  index={index}
                                  title={project.name || "New project"}
                                  onRemove={() =>
                                    removeResumeSectionItem("projects", index)
                                  }
                                  removeLabel="Remove project"
                                >
                                  <FieldRow label="Name">
                                    <Input
                                      value={project.name}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "projects",
                                          index,
                                          "name",
                                          e.target.value,
                                        )
                                      }
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Link">
                                    <Input
                                      value={project.link}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "projects",
                                          index,
                                          "link",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="github.com/you/thing"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Stack">
                                    <Input
                                      value={project.technologies.join(", ")}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "projects",
                                          index,
                                          "technologies",
                                          splitList(e.target.value),
                                        )
                                      }
                                      placeholder="Rust, WebAssembly"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Bullets" align="start">
                                    <Textarea
                                      value={(project.bullets || []).join("\n")}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "projects",
                                          index,
                                          "bullets",
                                          splitLines(e.target.value),
                                        )
                                      }
                                      rows={2}
                                      placeholder="One line per point"
                                      className={cn(
                                        inputClass,
                                        "min-h-[3rem] leading-relaxed",
                                      )}
                                    />
                                  </FieldRow>
                                </ItemBlock>
                              ))
                            )}
                          </Section>

                          <Section
                            title="Education"
                            count={resume.education.length}
                            open={isSectionOpen(
                              "education",
                              resume.education.length > 0,
                            )}
                            onToggle={() =>
                              toggleSection(
                                "education",
                                resume.education.length > 0,
                              )
                            }
                            onAdd={() => addResumeSectionItem("education")}
                            addLabel="Add education"
                          >
                            {resume.education.length === 0 ? (
                              <EmptyHint
                                onAdd={() => addResumeSectionItem("education")}
                                addLabel="Add an entry"
                              >
                                Degrees, certifications, anything
                                schooling-shaped.
                              </EmptyHint>
                            ) : (
                              resume.education.map((edu, index) => (
                                <ItemBlock
                                  key={index}
                                  index={index}
                                  title={
                                    [edu.degree, edu.institution]
                                      .filter(Boolean)
                                      .join(" · ") || "New entry"
                                  }
                                  onRemove={() =>
                                    removeResumeSectionItem("education", index)
                                  }
                                  removeLabel="Remove education entry"
                                >
                                  <FieldRow label="Degree">
                                    <Input
                                      value={edu.degree}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "education",
                                          index,
                                          "degree",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="BSc"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Major">
                                    <Input
                                      value={edu.major}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "education",
                                          index,
                                          "major",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Computer Science"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="School">
                                    <Input
                                      value={edu.institution}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "education",
                                          index,
                                          "institution",
                                          e.target.value,
                                        )
                                      }
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Location">
                                    <Input
                                      value={edu.location}
                                      onChange={(e) =>
                                        updateResumeSectionItem(
                                          "education",
                                          index,
                                          "location",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Optional"
                                      className={inputClass}
                                    />
                                  </FieldRow>
                                  <FieldRow label="Dates">
                                    <div className="grid grid-cols-2 gap-2">
                                      <Input
                                        value={edu.startDate}
                                        onChange={(e) =>
                                          updateResumeSectionItem(
                                            "education",
                                            index,
                                            "startDate",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Aug 2019"
                                        className={inputClass}
                                      />
                                      <Input
                                        value={edu.endDate}
                                        onChange={(e) =>
                                          updateResumeSectionItem(
                                            "education",
                                            index,
                                            "endDate",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="May 2023"
                                        className={inputClass}
                                      />
                                    </div>
                                  </FieldRow>
                                </ItemBlock>
                              ))
                            )}
                          </Section>
                        </>
                      );
                    })()
                  : (() => {
                      const cover = (structuredData ??
                        EMPTY_COVER) as CoverLetterData;
                      return (
                        <>
                          <Section
                            title="Greeting"
                            open={isSectionOpen("greeting", true)}
                            onToggle={() => toggleSection("greeting", true)}
                          >
                            <Input
                              value={cover.greeting}
                              onChange={(e) =>
                                updateCoverLetterField(
                                  "greeting",
                                  e.target.value,
                                )
                              }
                              placeholder="Dear Hiring Manager,"
                              className={inputClass}
                              aria-label="Greeting"
                            />
                          </Section>

                          <Section
                            title="Body"
                            count={cover.body_paragraphs.length}
                            open={isSectionOpen("body", true)}
                            onToggle={() => toggleSection("body", true)}
                            onAdd={addCoverParagraph}
                            addLabel="Add paragraph"
                          >
                            {cover.body_paragraphs.map((paragraph, index) => (
                              <ItemBlock
                                key={index}
                                index={index}
                                title={`${paragraph.trim().split(/\s+/).filter(Boolean).length} words`}
                                onRemove={() => removeCoverParagraph(index)}
                                removeLabel="Remove paragraph"
                              >
                                <Textarea
                                  value={paragraph}
                                  onChange={(e) => {
                                    const next = [...cover.body_paragraphs];
                                    next[index] = e.target.value;
                                    updateCoverLetterField(
                                      "body_paragraphs",
                                      next,
                                    );
                                  }}
                                  rows={4}
                                  aria-label={`Paragraph ${index + 1}`}
                                  className={cn(
                                    inputClass,
                                    "min-h-[5.5rem] leading-relaxed",
                                  )}
                                />
                              </ItemBlock>
                            ))}
                          </Section>

                          <Section
                            title="Sign-off"
                            open={isSectionOpen("signoff", true)}
                            onToggle={() => toggleSection("signoff", true)}
                          >
                            <FieldRow label="Closing" htmlFor="f-closing">
                              <Input
                                id="f-closing"
                                value={cover.closing}
                                onChange={(e) =>
                                  updateCoverLetterField(
                                    "closing",
                                    e.target.value,
                                  )
                                }
                                placeholder="Sincerely,"
                                className={inputClass}
                              />
                            </FieldRow>
                            <FieldRow label="Name" htmlFor="f-signature">
                              <Input
                                id="f-signature"
                                value={cover.signature_name}
                                onChange={(e) =>
                                  updateCoverLetterField(
                                    "signature_name",
                                    e.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </FieldRow>
                          </Section>
                        </>
                      );
                    })()}

                <div className="h-16" />
              </div>
            )}

            <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-200 px-4 dark:border-slate-800">
              <Meta>
                {activeTab === "source"
                  ? `${source.split("\n").length} lines`
                  : structuredDirty
                    ? "Unapplied edits"
                    : sourceOverridden
                      ? "Fields detached"
                      : "Fields drive the source"}
              </Meta>
              <Meta>{wordCount} words</Meta>
            </div>
          </section>

          <section className="hidden min-h-0 flex-1 flex-col bg-slate-100 lg:flex dark:bg-slate-900">
            <div className="flex h-[41px] shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <Meta>Preview</Meta>
              <Meta>{templateLabel}</Meta>
            </div>

            {renderError && (
              <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    aria-hidden
                    className="mt-px h-3.5 w-3.5 shrink-0 text-rose-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-rose-800 dark:text-rose-200">
                      This source did not compile. The preview below is the last
                      version that did.
                    </p>
                    <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-rose-700/90 dark:text-rose-300/90">
                      {renderError}
                    </pre>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {activeTab !== "source" && (
                        <button
                          type="button"
                          onClick={() => void switchTab("source")}
                          className="text-xs text-rose-800 underline decoration-rose-300 underline-offset-4 outline-none hover:decoration-rose-800 focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:text-rose-200 dark:decoration-rose-700"
                        >
                          Open source
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void render(source)}
                        className="text-xs text-rose-800 underline decoration-rose-300 underline-offset-4 outline-none hover:decoration-rose-800 focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:text-rose-200 dark:decoration-rose-700"
                      >
                        Try again
                      </button>
                      {sourceOverridden && (
                        <button
                          type="button"
                          onClick={() => void applyFields()}
                          disabled={isApplying}
                          className="text-xs text-rose-800 underline decoration-rose-300 underline-offset-4 outline-none hover:decoration-rose-800 focus-visible:ring-2 focus-visible:ring-rose-500/30 disabled:opacity-50 dark:text-rose-200 dark:decoration-rose-700"
                        >
                          Rebuild from fields
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="custom-scrollbar flex min-h-0 flex-1 flex-col items-center overflow-auto p-6 lg:p-10">
              <div className="relative w-full max-w-[595px]">
                <div
                  ref={previewRef}
                  className="typst-preview w-full shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.25)]"
                />
                {!hasPreview && (
                  <div className="flex aspect-[1/1.414] w-full flex-col items-center justify-center gap-2 border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <FileCode
                      aria-hidden
                      className="h-5 w-5 text-slate-300 dark:text-slate-700"
                    />
                    <Meta>Rendering</Meta>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
