import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get the current authenticated user
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return {
      id: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
    };
  },
});

// Example of a protected mutation
export const updateProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    // Your update logic here
    return { success: true };
  },
});
