import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { hotScore } from "./lib/moderation";
import { remove as removeObject, getUrl as storageUrl } from "./storage/provider";
import { getAuthedUser } from "./users";

/** Nombre de retraits fondés au-delà duquel le compte est fermé. */
const STRIKES_BEFORE_BAN = 3;

/**
 * Vérifie le rôle et renvoie le modérateur.
 *
 * C'est **ici** que la sécurité se joue, pas dans l'app : masquer un écran
 * n'empêche personne d'appeler la mutation directement. Chaque fonction de ce
 * module commence par cet appel.
 */
async function requireModerator(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthedUser(ctx);
  if (!user) throw new Error("Non authentifié.");
  if (user.role !== "mod" && user.role !== "admin") {
    throw new Error("Accès réservé aux modérateurs.");
  }
  return user;
}

export type QueueItem = {
  id: Id<"resources">;
  title: string;
  description?: string;
  kind: Doc<"resources">["kind"];
  url?: string;
  sourceDomain?: string;
  category: Doc<"resources">["category"];
  tags: string[];
  posterUrl?: string;
  autoFlags: string[];
  reportCount: number;
  scanStatus?: Doc<"files">["scanStatus"];
  createdAt: number;
  authorUsername?: string;
};

/**
 * File d'attente, drapeaux d'abord.
 *
 * Le tri met en tête ce qui présente un risque — domaine bloqué, mot-clé de
 * piratage, signalements — plutôt que le plus ancien : un modérateur qui n'a
 * que dix minutes doit les passer sur les entrées qui comptent.
 */
export const pending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<QueueItem[]> => {
    await requireModerator(ctx);

    const resources = await ctx.db
      .query("resources")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(Math.min(limit ?? 50, 100));

    const items = await Promise.all(
      resources.map(async (resource) => {
        const reports = await ctx.db
          .query("reports")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .collect();

        let posterUrl = resource.thumbUrl;
        if (resource.posterFileId) {
          const poster = await ctx.db.get(resource.posterFileId);
          if (poster) {
            posterUrl = (await storageUrl(ctx, poster)) ?? posterUrl;
          }
        }

        const file = resource.fileId ? await ctx.db.get(resource.fileId) : null;
        const author = resource.submittedBy
          ? await ctx.db.get(resource.submittedBy)
          : null;

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
          autoFlags: resource.autoFlags,
          reportCount: reports.filter((r) => !r.resolvedAt).length,
          scanStatus: file?.scanStatus,
          createdAt: resource.createdAt,
          authorUsername: author?.username,
        };
      }),
    );

    return items.sort((a, b) => {
      const riskA = a.autoFlags.length + a.reportCount;
      const riskB = b.autoFlags.length + b.reportCount;
      if (riskA !== riskB) return riskB - riskA;
      return a.createdAt - b.createdAt;
    });
  },
});

/** Compteur pour l'en-tête. Une query séparée pour ne pas charger la file entière. */
export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (user?.role !== "mod" && user?.role !== "admin") return 0;

    const pendingItems = await ctx.db
      .query("resources")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .take(100);
    return pendingItems.length;
  },
});

export const approve = mutation({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, { resourceId }) => {
    const moderator = await requireModerator(ctx);
    const resource = await ctx.db.get(resourceId);
    if (!resource) throw new Error("Ressource introuvable.");

    // Un fichier dont l'analyse n'est pas passée ne peut pas être publié, même
    // par un modérateur : l'antivirus n'est pas une opinion à contredire.
    if (resource.fileId) {
      const file = await ctx.db.get(resource.fileId);
      if (!file || file.scanStatus !== "clean") {
        throw new Error(
          "L'analyse antivirus de ce fichier n'est pas terminée ou a échoué.",
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(resourceId, {
      status: "approved",
      approvedAt: now,
      reviewedBy: moderator._id,
      moderationReason: undefined,
      hotScore: hotScore(resource.voteCount, resource.createdAt),
    });

    await resolveReports(ctx, resourceId);
  },
});

export const reject = mutation({
  args: { resourceId: v.id("resources"), reason: v.string() },
  handler: async (ctx, { resourceId, reason }) => {
    const moderator = await requireModerator(ctx);
    const resource = await ctx.db.get(resourceId);
    if (!resource) throw new Error("Ressource introuvable.");
    if (reason.trim().length === 0) {
      throw new Error("Un motif est obligatoire : l'auteur en est informé.");
    }

    await ctx.db.patch(resourceId, {
      status: "rejected",
      reviewedBy: moderator._id,
      moderationReason: reason.trim(),
    });

    await resolveReports(ctx, resourceId);
  },
});

/**
 * Retrait sur notification d'un ayant droit.
 *
 * Trois effets indissociables : la ressource sort, l'empreinte du fichier est
 * blacklistée pour qu'il ne revienne pas au prochain envoi, et l'auteur prend
 * un avertissement. Sans le troisième, la politique de résiliation des
 * récidivistes n'aurait rien sur quoi compter — et c'est une condition du safe
 * harbor, pas une option.
 */
export const takedown = mutation({
  args: {
    resourceId: v.id("resources"),
    claimant: v.string(),
    note: v.string(),
  },
  handler: async (ctx, { resourceId, claimant, note }) => {
    const moderator = await requireModerator(ctx);
    const resource = await ctx.db.get(resourceId);
    if (!resource) throw new Error("Ressource introuvable.");

    const now = Date.now();
    let sha256: string | undefined;

    for (const fileId of [resource.fileId, resource.posterFileId]) {
      if (!fileId) continue;
      const file = await ctx.db.get(fileId);
      if (!file) continue;
      if (file.sha256) {
        sha256 = file.sha256;
        const alreadyBlocked = await ctx.db
          .query("blockedHashes")
          .withIndex("by_sha256", (q) => q.eq("sha256", file.sha256!))
          .unique();
        if (!alreadyBlocked) {
          await ctx.db.insert("blockedHashes", {
            sha256: file.sha256,
            reason: `Retrait : ${claimant}`,
            blockedAt: now,
          });
        }
      }
      await removeObject(ctx, file);
      await ctx.db.delete(file._id);
    }

    await ctx.db.patch(resourceId, {
      status: "rejected",
      reviewedBy: moderator._id,
      moderationReason: `Retrait sur notification : ${claimant}`,
      fileId: undefined,
      posterFileId: undefined,
    });

    await ctx.db.insert("takedowns", {
      resourceId,
      sha256,
      claimant,
      note,
      receivedAt: now,
      actedAt: now,
      actedBy: moderator._id,
    });

    if (resource.submittedBy) {
      const author = await ctx.db.get(resource.submittedBy);
      if (author) {
        const strikes = (author.strikes ?? 0) + 1;
        await ctx.db.patch(author._id, { strikes });

        // Trois retraits fondés : toutes les publications de l'auteur sortent.
        // Le compte Clerk se ferme depuis le tableau de bord — l'app ne
        // supprime pas un compte sans passer par le fournisseur d'identité.
        if (strikes >= STRIKES_BEFORE_BAN) {
          const theirs = await ctx.db
            .query("resources")
            .withIndex("by_author", (q) => q.eq("submittedBy", author._id))
            .collect();
          for (const item of theirs) {
            if (item.status === "approved") {
              await ctx.db.patch(item._id, {
                status: "rejected",
                moderationReason: "Compte fermé pour récidive.",
              });
            }
          }
        }
      }
    }

    await resolveReports(ctx, resourceId);
  },
});

async function resolveReports(ctx: MutationCtx, resourceId: Id<"resources">) {
  const reports = await ctx.db
    .query("reports")
    .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
    .collect();
  const now = Date.now();
  for (const report of reports) {
    if (!report.resolvedAt) await ctx.db.patch(report._id, { resolvedAt: now });
  }
}
