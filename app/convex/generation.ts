import { action } from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";

import { requireUserId } from "./lib/auth";
import { callChatModel, safeJsonParse } from "./lib/llm";
import { DEFAULT_MODEL, modelIdValidator } from "./lib/models";
import {
  coverLetterPreferenceInstructions,
  enforceCoverLetterLength,
  resumePreferenceInstructions,
} from "./lib/preferences";
import { normalizeGeneratedResume } from "./lib/resumeNormalize";
import {
  buildCoverLetterTypstSource,
  buildResumeTypstSource,
  buildCustomCoverLetterTypstSource,
  buildCustomResumeTypstSource,
  coverTemplateIdValidator,
  resumeTemplateIdValidator,
} from "./lib/templates";

const jobInput = v.object({
  url: v.string(),
  jobId: v.optional(v.string()),
  source: v.optional(v.string()),
  title: v.optional(v.string()),
  company: v.optional(v.string()),
  description: v.optional(v.string()),
  addedAt: v.optional(v.number()),
});

const preferencesInput = v.object({
  tone: v.string(),
  targetLength: v.string(),
});

const myProfileRef = makeFunctionReference<"query">("profiles:myProfile");
const upsertMyJobRef = makeFunctionReference<"mutation">("jobs:upsertMyJob");
const createGeneratedDocumentRef = makeFunctionReference<"mutation">(
  "documents:createGeneratedDocument",
);
const getMyTemplateRef = makeFunctionReference<"query">(
  "customTemplates:getMyTemplate",
);

export const generateDocuments = action({
  args: {
    job: v.optional(jobInput),
    documentType: v.union(
      v.literal("resume"),
      v.literal("cover_letter"),
      v.literal("both"),
    ),
    resumeTemplateId: resumeTemplateIdValidator,
    coverTemplateId: coverTemplateIdValidator,
    customResumeTemplateId: v.optional(v.id("customTemplates")),
    customCoverTemplateId: v.optional(v.id("customTemplates")),
    model: v.optional(modelIdValidator),
    preferences: preferencesInput,
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx);

    const model = args.model ?? DEFAULT_MODEL;

    const profileDoc = await ctx.runQuery(myProfileRef, {});
    const profile = (profileDoc as any)?.profile;
    if (!profile?.personal?.fullName) {
      throw new Error("Complete onboarding before generating documents.");
    }

    // No url means no posting to track and nothing to tailor towards.
    const hasJob = Boolean(args.job?.url?.trim());
    const jobId = hasJob
      ? await ctx.runMutation(upsertMyJobRef, {
          url: args.job!.url,
          jobId: args.job!.jobId ?? "",
          source: args.job!.source ?? "extension",
          title: args.job!.title ?? "",
          company: args.job!.company ?? "",
          description: args.job!.description ?? "",
          addedAt: args.job!.addedAt,
        })
      : undefined;

    const baseInput = {
      user_profile: profile,
      job: hasJob
        ? {
            title: args.job!.title ?? "",
            company: args.job!.company ?? "",
            description: args.job!.description ?? "",
            url: args.job!.url,
          }
        : null,
      preferences: args.preferences,
    };

    const targetingInstruction = hasJob
      ? "Tailor the document to the target job description."
      : "There is no target job. Write a general document that presents the profile at its strongest, ordered by impact rather than by any particular role.";

    const documents: { resumeId?: string; coverId?: string } = {};

    function parseModelJson(raw: string, label: string) {
      try {
        return safeJsonParse(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `The ${label} response from ${model} could not be read. Try generating again, or pick a different model. (${message})`,
        );
      }
    }

    if (args.documentType === "resume" || args.documentType === "both") {
      let customResumeSource: string | null = null;
      if (args.customResumeTemplateId) {
        const customTemplate = await ctx.runQuery(getMyTemplateRef, {
          templateId: args.customResumeTemplateId,
        });
        if (!customTemplate || customTemplate.type !== "resume") {
          throw new Error("Custom resume template not found.");
        }
        customResumeSource = customTemplate.source;
      }

      const prompt = [
        "You are an expert ATS resume writer.",
        "Return ONLY valid JSON (no markdown, no code fences).",
        "Use double quotes for all strings and keys.",
        "Do not include trailing commas.",
        "Replace line breaks in strings with \\n.",
        "Avoid fabrication. Prefer quantified impact when the profile includes metrics.",
        "Treat user_profile as the ONLY source of the candidate's factual experience, education, skills, projects, contact details, dates, employers, and achievements.",
        "Treat job as the TARGET ROLE only. Use the job title, company, and description to tailor wording, keywords, ordering, summary, and emphasis.",
        targetingInstruction,
        "Never copy responsibilities, qualifications, technologies, employers, projects, or achievements from the job description into the resume unless they are clearly supported by user_profile.",
        "Never add the target company or target job title as past or current experience unless user_profile already contains that employer and role.",
        "Always include projects from user_profile.projects in the projects array when they exist. You may tailor their bullets and ordering for relevance, but do not drop them.",
        "Do not invent projects from the job description. Every project must come from user_profile.projects.",
        "If the job description mentions requirements missing from user_profile, do not invent them. Emphasize adjacent supported skills instead.",
        ...resumePreferenceInstructions(args.preferences),
        `Output schema: ${JSON.stringify(
          {
            resume: {
              header: {
                name: "",
                email: "",
                phone: "",
                location: "",
                links: [{ label: "", url: "" }],
              },
              summary: "",
              skills: [{ category: "", items: [""] }],
              experience: [
                {
                  title: "",
                  company: "",
                  location: "",
                  startDate: "",
                  endDate: "",
                  bullets: [""],
                },
              ],
              projects: [
                {
                  name: "",
                  technologies: [""],
                  link: "",
                  bullets: [""],
                },
              ],
              education: [
                {
                  degree: "",
                  major: "",
                  institution: "",
                  location: "",
                  startDate: "",
                  endDate: "",
                },
              ],
            },
          },
          null,
          0,
        )}`,
        `Input: ${JSON.stringify(baseInput)}`,
      ].join("\n");

      const raw = await callChatModel({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        maxTokens: 4096,
      });
      const parsed = parseModelJson(raw, "resume") as any;
      const resume = normalizeGeneratedResume(
        parsed?.resume ?? parsed,
        profile,
        args.job,
        args.preferences,
      );

      const typstSource = customResumeSource
        ? buildCustomResumeTypstSource({
            templateSource: customResumeSource,
            resume,
            profile,
          })
        : buildResumeTypstSource({
            templateId: args.resumeTemplateId,
            resume,
            profile,
          });

      const resumeDocId = await ctx.runMutation(createGeneratedDocumentRef, {
        jobId,
        type: "resume",
        templateId: customResumeSource
          ? `custom:${args.customResumeTemplateId}`
          : args.resumeTemplateId,
        llmModel: model,
        tone: args.preferences.tone,
        targetLength: args.preferences.targetLength,
        data: resume,
        typstSource,
      });

      documents.resumeId = resumeDocId as any;
    }

    if (args.documentType === "cover_letter" || args.documentType === "both") {
      let customCoverSource: string | null = null;
      if (args.customCoverTemplateId) {
        const customTemplate = await ctx.runQuery(getMyTemplateRef, {
          templateId: args.customCoverTemplateId,
        });
        if (!customTemplate || customTemplate.type !== "cover_letter") {
          throw new Error("Custom cover letter template not found.");
        }
        customCoverSource = customTemplate.source;
      }

      const prompt = [
        "You are an expert cover letter writer.",
        "Return ONLY valid JSON (no markdown, no code fences).",
        "Use double quotes for all strings and keys.",
        "Do not include trailing commas.",
        "Replace line breaks in strings with \\n.",
        "Avoid fabrication. Keep it concise and role-specific.",
        targetingInstruction,
        ...coverLetterPreferenceInstructions(args.preferences),
        `Output schema: ${JSON.stringify(
          {
            cover_letter: {
              greeting: "",
              body_paragraphs: [""],
              closing: "",
              signature_name: "",
            },
          },
          null,
          0,
        )}`,
        `Input: ${JSON.stringify(baseInput)}`,
      ].join("\n");

      const raw = await callChatModel({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        maxTokens: 2048,
      });
      const parsed = parseModelJson(raw, "cover letter") as any;
      const coverLetter = enforceCoverLetterLength(
        parsed?.cover_letter ?? parsed,
        args.preferences.targetLength,
      );

      const typstSource = customCoverSource
        ? buildCustomCoverLetterTypstSource({
            templateSource: customCoverSource,
            coverLetter,
            profile,
            job: hasJob ? args.job : null,
          })
        : buildCoverLetterTypstSource({
            templateId: args.coverTemplateId,
            coverLetter,
            profile,
            job: hasJob ? args.job : null,
          });

      const coverDocId = await ctx.runMutation(createGeneratedDocumentRef, {
        jobId,
        type: "cover_letter",
        templateId: customCoverSource
          ? `custom:${args.customCoverTemplateId}`
          : args.coverTemplateId,
        llmModel: model,
        tone: args.preferences.tone,
        targetLength: args.preferences.targetLength,
        data: coverLetter,
        typstSource,
      });
      documents.coverId = coverDocId as any;
    }

    return { jobId, ...documents };
  },
});
