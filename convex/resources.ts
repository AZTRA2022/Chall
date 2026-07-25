import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { autoFlags, hotScore } from "./lib/moderation";
import { blockedUserIds } from "./social";
import { normalizeUrl } from "./lib/url";
import { getUrl as storageUrl } from "./storage/provider";
import { categoryValidator } from "./schema";
import { ensureUser, getAuthedUser } from "./users";

const MAX_SUBMISSIONS_PER_DAY = 10;
const MAX_TAGS = 5;

/** Forme envoyée à l'app. Ne contient jamais les champs de modération internes. */
export type PublicResource = {
  id: Id<"resources">;
  title: string;
  description?: string;
  kind: Doc<"resources">["kind"];
  url?: string;
  sourceDomain?: string;
  category: Doc<"resources">["category"];
  tags: string[];
  posterUrl?: string;
  voteCount: number;
  status: Doc<"resources">["status"];
  createdAt: number;
  author?: { username: string; displayName?: string; avatarUrl?: string };
  hasVoted: boolean;
};

async function toPublic(
  ctx: QueryCtx,
  resource: Doc<"resources">,
  viewerId: Id<"users"> | null,
): Promise<PublicResource> {
  const author = resource.submittedBy
    ? await ctx.db.get(resource.submittedBy)
    : null;

  const vote = viewerId
    ? await ctx.db
        .query("votes")
        .withIndex("by_resource_user", (q) =>
          q.eq("resourceId", resource._id).eq("userId", viewerId),
        )
        .unique()
    : null;

  // La couverture envoyée par l'auteur prime sur celle récupérée à l'unfurl.
  let posterUrl = resource.thumbUrl;
  if (resource.posterFileId) {
    const poster = await ctx.db.get(resource.posterFileId);
    if (poster) {
      posterUrl = (await storageUrl(ctx, poster)) ?? posterUrl;
    }
  }

  return {
    id: resource._id,
    title: resource.title,
    description: resource.description,
    kind: resource.kind,
    url: resource.url,
    sourceDomain: resource.sourceDomain,
    category: resource.category,
    tags: resource.tags,
    posterUrl,
    voteCount: resource.voteCount,
    status: resource.status,
    createdAt: resource.createdAt,
    author: author
      ? {
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
        }
      : undefined,
    hasVoted: vote !== null,
  };
}

/** Nettoie les tags saisis : minuscules, sans `#`, dédoublonnés, plafonnés. */
function normalizeTags(tags: string[]): string[] {
  const cleaned = tags
    .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
    .filter((t) => t.length > 0 && t.length <= 24);
  return Array.from(new Set(cleaned)).slice(0, MAX_TAGS);
}

/**
 * Vérifie qu'une couverture appartient bien à l'appelant et qu'elle est une
 * image. Sans ce contrôle, un client pourrait afficher le fichier d'un autre
 * compte, ou une vidéo, en couverture de sa propre publication.
 */
async function verifiedPoster(
  ctx: MutationCtx,
  posterFileId: Id<"files"> | undefined,
  userId: Id<"users">,
): Promise<Id<"files"> | undefined> {
  if (!posterFileId) return undefined;
  const poster = await ctx.db.get(posterFileId);
  if (!poster) throw new Error("Image de couverture introuvable.");
  if (poster.uploadedBy !== userId) {
    throw new Error("Cette image ne vous appartient pas.");
  }
  if (!poster.mimeType.startsWith("image/")) {
    throw new Error("La couverture doit être une image.");
  }
  return poster._id;
}

async function assertUnderDailyLimit(ctx: MutationCtx, userId: Id<"users">) {
  const since = Date.now() - 86_400_000;
  const recent = await ctx.db
    .query("resources")
    .withIndex("by_author", (q) => q.eq("submittedBy", userId))
    .filter((q) => q.gt(q.field("createdAt"), since))
    .collect();

  if (recent.length >= MAX_SUBMISSIONS_PER_DAY) {
    throw new Error(
      `Limite de ${MAX_SUBMISSIONS_PER_DAY} publications par jour atteinte.`,
    );
  }
}

export const submitLink = mutation({
  args: {
    url: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    category: categoryValidator,
    tags: v.optional(v.array(v.string())),
    posterFileId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx);
    await assertUnderDailyLimit(ctx, user._id);

    const normalized = normalizeUrl(args.url);
    if (!normalized) {
      throw new Error("Ce lien n'est pas une adresse web valide.");
    }

    const title = args.title.trim();
    if (title.length === 0) throw new Error("Le titre est obligatoire.");

    // Doublon : on ne crée rien, on renvoie l'existant. Le geste de l'auteur
    // devient un vote côté app plutôt qu'une erreur.
    const existing = await ctx.db
      .query("resources")
      .withIndex("by_canonical_url", (q) =>
        q.eq("canonicalUrl", normalized.canonical),
      )
      .first();
    if (existing) {
      return { id: existing._id, duplicate: true as const };
    }

    const flags = await autoFlags(ctx, {
      title,
      description: args.description,
      domain: normalized.domain,
    });

    const id = await ctx.db.insert("resources", {
      title,
      description: args.description?.trim() || undefined,
      kind: "link",
      url: normalized.canonical,
      canonicalUrl: normalized.canonical,
      sourceDomain: normalized.domain,
      category: args.category,
      tags: normalizeTags(args.tags ?? []),
      posterFileId: await verifiedPoster(ctx, args.posterFileId, user._id),
      origin: "user",
      submittedBy: user._id,
      status: "pending",
      autoFlags: flags,
      voteCount: 0,
      saveCount: 0,
      hotScore: 0,
      createdAt: Date.now(),
    });

    return { id, duplicate: false as const };
  },
});

/**
 * Publie un média déjà envoyé au stockage.
 *
 * Le fichier doit exister, appartenir à l'appelant, et ne pas être en cours ni
 * en échec d'analyse antivirus — sinon rien n'est créé.
 */
export const submitMedia = mutation({
  args: {
    fileId: v.id("files"),
    title: v.string(),
    description: v.optional(v.string()),
    category: categoryValidator,
    tags: v.optional(v.array(v.string())),
    posterFileId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx);
    await assertUnderDailyLimit(ctx, user._id);

    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("Fichier introuvable.");
    if (file.uploadedBy !== user._id) {
      throw new Error("Ce fichier ne vous appartient pas.");
    }
    if (file.scanStatus === "infected") {
      throw new Error("Ce fichier a été refusé par l'analyse antivirus.");
    }

    const title = args.title.trim();
    if (title.length === 0) throw new Error("Le titre est obligatoire.");

    const flags = await autoFlags(ctx, {
      title,
      description: args.description,
    });
    // L'analyse n'est pas terminée : la ressource reste en file, et le drapeau
    // dit au modérateur pourquoi il ne doit pas encore l'approuver.
    if (file.scanStatus !== "clean") flags.push("analyse-incomplete");

    const kind = file.mimeType.startsWith("image/")
      ? ("image" as const)
      : file.mimeType.startsWith("video/")
        ? ("video" as const)
        : ("file" as const);

    const id = await ctx.db.insert("resources", {
      title,
      description: args.description?.trim() || undefined,
      kind,
      fileId: file._id,
      category: args.category,
      tags: normalizeTags(args.tags ?? []),
      posterFileId: await verifiedPoster(ctx, args.posterFileId, user._id),
      origin: "user",
      submittedBy: user._id,
      status: "pending",
      autoFlags: flags,
      voteCount: 0,
      saveCount: 0,
      hotScore: 0,
      createdAt: Date.now(),
    });

    return { id, duplicate: false as const };
  },
});

/** Feed public. Ne renvoie que les ressources approuvées, quel que soit le tri. */
export const feed = query({
  args: {
    sort: v.union(v.literal("hot"), v.literal("new"), v.literal("top")),
    category: v.optional(categoryValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sort, category, limit }) => {
    const viewer = await getAuthedUser(ctx);
    const take = Math.min(limit ?? 30, 60);

    const index =
      sort === "new"
        ? "by_status_created"
        : sort === "top"
          ? "by_status_votes"
          : "by_status_hot";

    let resources = await ctx.db
      .query("resources")
      .withIndex(index, (q) => q.eq("status", "approved"))
      .order("desc")
      .take(take * 3);

    const blocked = await blockedUserIds(ctx, viewer?._id ?? null);
    resources = resources.filter(
      (r) => !r.submittedBy || !blocked.has(r.submittedBy),
    );
    if (category) resources = resources.filter((r) => r.category === category);
    resources = resources.slice(0, take);

    return Promise.all(
      resources.map((r) => toPublic(ctx, r, viewer?._id ?? null)),
    );
  },
});

/** Fiche d'une ressource. Une ressource non publiée n'est visible que de son auteur. */
export const byId = query({
  args: { id: v.id("resources") },
  handler: async (ctx, { id }) => {
    const resource = await ctx.db.get(id);
    if (!resource) return null;

    const viewer = await getAuthedUser(ctx);
    const isAuthor = viewer !== null && resource.submittedBy === viewer._id;
    const isModerator = viewer?.role === "mod" || viewer?.role === "admin";

    if (resource.status !== "approved" && !isAuthor && !isModerator) {
      return null;
    }

    const base = await toPublic(ctx, resource, viewer?._id ?? null);

    // Forme unique quelle que soit la branche : trois objets différents
    // forceraient l'app à distinguer des cas qui ne l'intéressent pas.
    let fileUrl: string | undefined;
    let scanStatus: Doc<"files">["scanStatus"] | undefined;

    if (resource.fileId) {
      const file = await ctx.db.get(resource.fileId);
      scanStatus = file?.scanStatus;
      // L'URL de téléchargement n'est produite que si l'analyse est passée.
      if (file && file.scanStatus === "clean") {
        fileUrl = (await storageUrl(ctx, file)) ?? undefined;
      }
    }

    return { ...base, fileUrl, scanStatus };
  },
});

/** Publications de l'utilisateur connecté, tous statuts confondus. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    const resources = await ctx.db
      .query("resources")
      .withIndex("by_author", (q) => q.eq("submittedBy", user._id))
      .order("desc")
      .take(50);

    return Promise.all(resources.map((r) => toPublic(ctx, r, user._id)));
  },
});

/** Bascule le vote de l'utilisateur sur une ressource. */
export const toggleVote = mutation({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, { resourceId }) => {
    const user = await ensureUser(ctx);
    const resource = await ctx.db.get(resourceId);
    if (!resource) throw new Error("Ressource introuvable.");
    if (resource.status !== "approved") {
      throw new Error("Cette ressource n'est pas encore publiée.");
    }

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_resource_user", (q) =>
        q.eq("resourceId", resourceId).eq("userId", user._id),
      )
      .unique();

    // Le compteur est dénormalisé et mis à jour dans la même mutation que le
    // document de vote : les deux ne peuvent pas diverger.
    const voteCount = resource.voteCount + (existing ? -1 : 1);
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("votes", {
        resourceId,
        userId: user._id,
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(resourceId, {
      voteCount,
      hotScore: hotScore(voteCount, resource.createdAt),
    });

    return { voted: !existing, voteCount };
  },
});
