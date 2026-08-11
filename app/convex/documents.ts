import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUserId } from "./lib/auth";
import {
  buildCoverLetterTypstSource,
  buildCustomCoverLetterTypstSource,
  buildCustomResumeTypstSource,
  buildResumeTypstSource,
} from "./lib/templates";

const MAX_TYPST_SOURCE_LENGTH = 400_000;

export const getMyDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) {
      return null;
    }
    // The job is what names a document; nothing on the row itself does.
    const job = doc.jobId ? await ctx.db.get(doc.jobId) : null;
    return { ...doc, job: job && job.userId === userId ? job : null };
  },
});

export const listMyRecentResumes = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = args.limit ?? 3;
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_user_type_createdAt", (q) =>
        q.eq("userId", userId).eq("type", "resume"),
      )
      .order("desc")
      .take(limit);
    return docs;
  },
});

export const listMyRecentDocuments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = args.limit ?? 6;
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    const jobs = await Promise.all(
      docs.map((doc) => (doc.jobId ? ctx.db.get(doc.jobId) : null)),
    );
    return docs.map((doc, idx) => {
      const job = jobs[idx];
      return {
        ...doc,
        job: job && job.userId === userId ? job : null,
      };
    });
  },
});

export const updateMyTypstSource = mutation({
  args: { documentId: v.id("documents"), typstSource: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.typstSource.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error("Typst source too large.");
    }
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Not found.");
    }
    const now = Date.now();
    const sourceEditedAt =
      args.typstSource === doc.typstSource ? doc.sourceEditedAt : now;
    await ctx.db.patch(args.documentId, {
      typstSource: args.typstSource,
      sourceEditedAt,
      updatedAt: now,
    });
    return { ok: true, sourceEditedAt };
  },
});

export const updateMyDocumentData = mutation({
  args: {
    documentId: v.id("documents"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) {
      throw new Error("Not found.");
    }

    const profileDoc = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const profile = profileDoc?.profile ?? {};

    const rawTemplateId =
      doc.templateId ||
      (doc.type === "resume" ? "basic_resume" : "modern_cv_cover");
    const isCustom = rawTemplateId.startsWith("custom:");
    let templateSource: string | null = null;
    let resolvedTemplateId = rawTemplateId;

    if (isCustom) {
      const customId = rawTemplateId.slice(
        "custom:".length,
      ) as Id<"customTemplates">;
      const customTemplate = await ctx.db.get(customId);
      if (!customTemplate || customTemplate.userId !== userId) {
        throw new Error("Custom template not found.");
      }
      templateSource = customTemplate.source;
    }

    const job =
      doc.type === "cover_letter" && doc.jobId
        ? await ctx.db.get(doc.jobId)
        : null;
    const safeJob = job && job.userId === userId ? job : null;

    let typstSource = doc.typstSource;
    if (doc.type === "resume") {
      const resume = args.data;
      typstSource = templateSource
        ? buildCustomResumeTypstSource({
            templateSource,
            resume,
            profile,
          })
        : buildResumeTypstSource({
            templateId: resolvedTemplateId as any,
            resume,
            profile,
          });
    } else {
      const coverLetter = args.data;
      typstSource = templateSource
        ? buildCustomCoverLetterTypstSource({
            templateSource,
            coverLetter,
            profile,
            job: safeJob,
          })
        : buildCoverLetterTypstSource({
            templateId: resolvedTemplateId as any,
            coverLetter,
            profile,
            job: safeJob,
          });
    }

    if (typstSource.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error("Typst source too large.");
    }

    const now = Date.now();
    await ctx.db.patch(args.documentId, {
      data: args.data,
      typstSource,
      sourceEditedAt: undefined,
      updatedAt: now,
    });
    return { typstSource };
  },
});

export const createGeneratedDocument = mutation({
  args: {
    jobId: v.optional(v.id("jobs")),
    type: v.union(v.literal("resume"), v.literal("cover_letter")),
    templateId: v.string(),
    llmModel: v.string(),
    tone: v.string(),
    targetLength: v.string(),
    data: v.any(),
    typstSource: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.typstSource.length > MAX_TYPST_SOURCE_LENGTH) {
      throw new Error("Typst source too large.");
    }
    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job || job.userId !== userId) {
        throw new Error("Job not found.");
      }
    }
    const now = Date.now();
    return await ctx.db.insert("documents", {
      userId,
      jobId: args.jobId,
      type: args.type,
      templateId: args.templateId,
      llmModel: args.llmModel,
      tone: args.tone,
      targetLength: args.targetLength,
      data: args.data,
      typstSource: args.typstSource,
      createdAt: now,
      updatedAt: now,
    });
  },
});
