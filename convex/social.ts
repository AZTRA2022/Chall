import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { categoryValidator } from "./schema";
import { getUrl as storageUrl } from "./storage/provider";
import { ensureUser, getAuthedUser } from "./users";

/** Nombre de signalements distincts qui remettent une ressource en file. */
const REPORTS_BEFORE_HIDE = 3;

async function resolvePosterUrl(ctx: QueryCtx, resource: Doc<"resources">) {
  if (!resource.posterFileId) return resource.thumbUrl;
  const poster = await ctx.db.get(resource.posterFileId);
  if (!poster) return resource.thumbUrl;
  return (await storageUrl(ctx, poster)) ?? resource.thumbUrl;
}

/* -------------------------------------------------------------------------- */
/* Sauvegardes                                                                 */
/* -------------------------------------------------------------------------- */

export const toggleSave = mutation({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, { resourceId }) => {
    const user = await ensureUser(ctx);
    const resource = await ctx.db.get(resourceId);
    if (!resource) throw new Error("Ressource introuvable.");

    const existing = await ctx.db
      .query("saves")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", user._id).eq("resourceId", resourceId),
      )
      .unique();

    const saveCount = Math.max(0, resource.saveCount + (existing ? -1 : 1));
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("saves", {
        userId: user._id,
        resourceId,
        createdAt: Date.now(),
      });
    }
    await ctx.db.patch(resourceId, { saveCount });

    return { saved: !existing };
  },
});

export const mySaves = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    const saves = await ctx.db
      .query("saves")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    const items = await Promise.all(
      saves.map(async (save) => {
        const resource = await ctx.db.get(save.resourceId);
        // Une ressource retirée après sauvegarde disparaît de la bibliothèque
        // plutôt que d'y laisser une carte vide.
        if (!resource || resource.status !== "approved") return null;
        return {
          id: resource._id,
          title: resource.title,
          kind: resource.kind,
          category: resource.category,
          sourceDomain: resource.sourceDomain,
          posterUrl: await resolvePosterUrl(ctx, resource),
          voteCount: resource.voteCount,
          status: resource.status,
        };
      }),
    );

    return items.filter((item) => item !== null);
  },
});

export const isSaved = query({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, { resourceId }) => {
    const user = await getAuthedUser(ctx);
    if (!user) return false;
    const save = await ctx.db
      .query("saves")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", user._id).eq("resourceId", resourceId),
      )
      .unique();
    return save !== null;
  },
});

/* -------------------------------------------------------------------------- */
/* Abonnements                                                                 */
/* -------------------------------------------------------------------------- */

export const toggleSubscription = mutation({
  args: {
    kind: v.union(v.literal("category"), v.literal("tag")),
    value: v.string(),
  },
  handler: async (ctx, { kind, value }) => {
    const user = await ensureUser(ctx);
    const normalized = value.trim().toLowerCase().replace(/^#/, "");
    if (normalized.length === 0) throw new Error("Valeur vide.");

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", user._id).eq("kind", kind).eq("value", normalized),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { subscribed: false };
    }

    await ctx.db.insert("subscriptions", {
      userId: user._id,
      kind,
      value: normalized,
      createdAt: Date.now(),
    });
    return { subscribed: true };
  },
});

export const mySubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return subscriptions.map((s) => ({
      id: s._id,
      kind: s.kind,
      value: s.value,
    }));
  },
});

/* -------------------------------------------------------------------------- */
/* Signalements                                                                */
/* -------------------------------------------------------------------------- */

export const report = mutation({
  args: {
    resourceId: v.id("resources"),
    reason: v.union(
      v.literal("pirate"),
      v.literal("mort"),
      v.literal("hors-sujet"),
      v.literal("trompeur"),
      v.literal("dangereux"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { resourceId, reason, note }) => {
    const user = await ensureUser(ctx);
    const resource = await ctx.db.get(resourceId);
    if (!resource) throw new Error("Ressource introuvable.");

    const already = await ctx.db
      .query("reports")
      .withIndex("by_resource_user", (q) =>
        q.eq("resourceId", resourceId).eq("userId", user._id),
      )
      .unique();
    if (already) return { alreadyReported: true, hidden: false };

    await ctx.db.insert("reports", {
      resourceId,
      userId: user._id,
      reason,
      note: note?.trim() || undefined,
      createdAt: Date.now(),
    });

    // Masquage automatique : la réactivité ne doit pas dépendre de la présence
    // d'un modérateur. Trois signalements distincts sortent la ressource du
    // feed et la remettent en file.
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
      .collect();
    const open = reports.filter((r) => !r.resolvedAt).length;

    if (open >= REPORTS_BEFORE_HIDE && resource.status === "approved") {
      await ctx.db.patch(resourceId, {
        status: "pending",
        moderationReason: "Masquée automatiquement après signalements.",
      });
      return { alreadyReported: false, hidden: true };
    }

    return { alreadyReported: false, hidden: false };
  },
});

/* -------------------------------------------------------------------------- */
/* Blocages                                                                    */
/* -------------------------------------------------------------------------- */

export const toggleBlock = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await ensureUser(ctx);
    const target = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!target) throw new Error("Compte introuvable.");
    if (target._id === user._id) {
      throw new Error("Vous ne pouvez pas vous bloquer vous-même.");
    }

    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) =>
        q.eq("userId", user._id).eq("blockedUserId", target._id),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { blocked: false };
    }

    await ctx.db.insert("blocks", {
      userId: user._id,
      blockedUserId: target._id,
      createdAt: Date.now(),
    });
    return { blocked: true };
  },
});

export const myBlocks = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const items = await Promise.all(
      blocks.map(async (block) => {
        const target = await ctx.db.get(block.blockedUserId);
        if (!target) return null;
        return {
          id: block._id,
          username: target.username,
          displayName: target.displayName,
          avatarUrl: target.avatarUrl,
        };
      }),
    );
    return items.filter((item) => item !== null);
  },
});

/** Identifiants bloqués par l'appelant, pour filtrer le feed. */
export async function blockedUserIds(
  ctx: QueryCtx,
  userId: Id<"users"> | null,
): Promise<Set<string>> {
  if (!userId) return new Set();
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return new Set(blocks.map((b) => b.blockedUserId));
}

/** Abonnements possibles depuis une fiche : sa catégorie et ses tags. */
export const subscriptionState = query({
  args: { category: categoryValidator, tags: v.array(v.string()) },
  handler: async (ctx, { category, tags }) => {
    const user = await getAuthedUser(ctx);
    if (!user) return { category: false, tags: {} as Record<string, boolean> };

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const set = new Set(subscriptions.map((s) => `${s.kind}:${s.value}`));
    return {
      category: set.has(`category:${category}`),
      tags: Object.fromEntries(
        tags.map((tag) => [tag, set.has(`tag:${tag}`)]),
      ) as Record<string, boolean>,
    };
  },
});
