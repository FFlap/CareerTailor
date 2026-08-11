import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    userId: v.string(),
    profile: v.object({
      personal: v.object({
        fullName: v.string(),
        email: v.string(),
        phone: v.string(),
        location: v.string(),
        links: v.array(
          v.object({
            label: v.string(),
            url: v.string(),
          }),
        ),
      }),
      summary: v.string(),
      education: v.array(
        v.object({
          degree: v.string(),
          major: v.string(),
          institution: v.string(),
          location: v.string(),
          startDate: v.string(),
          endDate: v.string(),
          bullets: v.optional(v.array(v.string())),
        }),
      ),
      experience: v.array(
        v.object({
          title: v.string(),
          company: v.string(),
          location: v.string(),
          startDate: v.string(),
          endDate: v.string(),
          bullets: v.array(v.string()),
        }),
      ),
      skills: v.array(
        v.object({
          category: v.string(),
          items: v.array(v.string()),
        }),
      ),
      projects: v.array(
        v.object({
          name: v.string(),
          technologies: v.array(v.string()),
          link: v.string(),
          bullets: v.array(v.string()),
        }),
      ),
      customSections: v.optional(
        v.array(
          v.object({
            id: v.string(),
            title: v.string(),
            layout: v.union(
              v.literal("entries"),
              v.literal("bullets"),
              v.literal("inline"),
            ),
            items: v.array(
              v.object({
                title: v.string(),
                subtitle: v.optional(v.string()),
                location: v.optional(v.string()),
                startDate: v.optional(v.string()),
                endDate: v.optional(v.string()),
                description: v.optional(v.string()),
                bullets: v.optional(v.array(v.string())),
              }),
            ),
          }),
        ),
      ),
      sectionOrder: v.optional(v.array(v.string())),
    }),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  jobs: defineTable({
    userId: v.string(),
    url: v.string(),
    jobId: v.string(),
    source: v.string(),
    title: v.string(),
    company: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("viewed"),
      v.literal("applied"),
      v.literal("interview"),
      v.literal("accepted"),
      v.literal("ghosted"),
    ),
    addedAt: v.optional(v.number()),
    lastSeenAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_url", ["userId", "url"]),

  documents: defineTable({
    userId: v.string(),
    // Absent for a general document, written from the profile alone.
    jobId: v.optional(v.id("jobs")),
    type: v.union(v.literal("resume"), v.literal("cover_letter")),
    templateId: v.string(),
    llmModel: v.string(),
    tone: v.string(),
    targetLength: v.string(),
    data: v.any(),
    typstSource: v.string(),
    sourceEditedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_type_createdAt", ["userId", "type", "createdAt"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_job_type", ["userId", "jobId", "type"]),

  // Live status for one generation, so the client can watch it rather than
  // guess from a timer. Short-lived: it exists for the length of the run.
  generationRuns: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("error"),
    ),
    step: v.string(),
    error: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_startedAt", ["userId", "startedAt"]),

  // A saved critique. `document` reviews hang off a generated document and open
  // in the editor; `upload` reviews keep their own PDF and open on their own.
  reviews: defineTable({
    userId: v.string(),
    documentId: v.optional(v.id("documents")),
    jobId: v.optional(v.id("jobs")),
    source: v.union(v.literal("document"), v.literal("upload")),
    label: v.string(),
    storageId: v.optional(v.id("_storage")),
    resumeText: v.string(),
    jobDescription: v.optional(v.string()),
    summary: v.string(),
    overall: v.number(),
    metrics: v.any(),
    comments: v.any(),
    llmModel: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_document", ["userId", "documentId"]),

  userSettings: defineTable({
    userId: v.string(),
    defaultResumeTemplateId: v.string(),
    defaultCoverTemplateId: v.string(),
    defaultModel: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  customTemplates: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.union(v.literal("resume"), v.literal("cover_letter")),
    source: v.string(),
    origin: v.optional(v.union(v.literal("typst"), v.literal("image"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_type", ["userId", "type"]),
});
