import { v } from "convex/values";

import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";

export async function getAuthedUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

async function uniqueUsername(
  ctx: { db: QueryCtx["db"] },
  base: string,
): Promise<string> {
  const cleaned = base.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "user";
  let candidate = cleaned;
  let suffix = 0;
  while (
    await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .unique()
  ) {
    suffix += 1;
    candidate = `${cleaned}${suffix}`;
  }
  return candidate;
}

export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email, avatarUrl }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { avatarUrl });
      return existing._id;
    }

    const username = await uniqueUsername(ctx, email.split("@")[0]);
    return ctx.db.insert("users", {
      clerkId,
      username,
      avatarUrl,
      dataCollectionConsent: false,
      createdAt: Date.now(),
    });
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const getCurrentAppUser = query({
  args: {},
  handler: async (ctx) => getAuthedUser(ctx),
});

export const setDataCollectionConsent = mutation({
  args: { consent: v.boolean() },
  handler: async (ctx, { consent }) => {
    const user = await getAuthedUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await ctx.db.patch(user._id, { dataCollectionConsent: consent });
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) throw new Error("Not authenticated");
    return ctx.storage.generateUploadUrl();
  },
});

export const updateAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await getAuthedUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const avatarUrl = await ctx.storage.getUrl(storageId);
    if (!avatarUrl) throw new Error("Upload failed");
    await ctx.db.patch(user._id, { avatarUrl });
  },
});
