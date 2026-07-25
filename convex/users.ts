import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  createUploadTarget,
  getUrl as storageUrl,
  remove as removeObject,
} from "./storage/provider";

export async function getAuthedUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/**
 * Renvoie le document de l'utilisateur connecté, en le créant s'il n'existe
 * pas encore.
 *
 * Le document est normalement créé par le webhook `user.created` de Clerk, mais
 * ce webhook est asynchrone : juste après une inscription, le client peut être
 * authentifié avant que Convex ait reçu l'événement. Sans ce filet, l'écriture
 * de l'acceptation des CGU échouerait précisément au moment où elle compte.
 */
export async function ensureUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (existing) return existing;

  const username = await uniqueUsername(ctx, identity.email?.split("@")[0] ?? "");
  const id = await ctx.db.insert("users", {
    clerkId: identity.subject,
    username,
    email: identity.email,
    dataCollectionConsent: false,
    createdAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("User creation failed");
  return created;
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

/**
 * Efface toutes les données rattachées à un utilisateur.
 *
 * Point unique de suppression : toute nouvelle table portant un `userId` doit
 * être ajoutée ici, sinon la donnée survit à un droit à l'effacement. Un token
 * de notification est un identifiant d'appareil, donc une donnée personnelle —
 * le laisser derrière n'est pas une négligence anodine.
 */
async function purgeUser(ctx: MutationCtx, userId: Id<"users">) {
  const tokens = await ctx.db
    .query("pushTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const token of tokens) {
    await ctx.db.delete(token._id);
  }

  // Les votes disparaissent, et les compteurs des ressources votées sont
  // décrémentés : laisser le compteur en l'état afficherait des votes qui
  // n'existent plus.
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const vote of votes) {
    const resource = await ctx.db.get(vote.resourceId);
    if (resource) {
      await ctx.db.patch(vote.resourceId, {
        voteCount: Math.max(0, resource.voteCount - 1),
      });
    }
    await ctx.db.delete(vote._id);
  }

  // Publications : celles qui sont en ligne restent, dissociées du compte —
  // c'est ce que promet la politique de confidentialité, et retirer un contenu
  // que d'autres ont sauvegardé serait une punition collective. Celles qui
  // n'ont jamais été publiées partent avec leurs fichiers.
  const resources = await ctx.db
    .query("resources")
    .withIndex("by_author", (q) => q.eq("submittedBy", userId))
    .collect();

  for (const resource of resources) {
    if (resource.status === "approved") {
      await ctx.db.patch(resource._id, { submittedBy: undefined });
      continue;
    }
    for (const fileId of [resource.fileId, resource.posterFileId]) {
      if (!fileId) continue;
      const file = await ctx.db.get(fileId);
      if (file) {
        await removeObject(ctx, file);
        await ctx.db.delete(file._id);
      }
    }
    await ctx.db.delete(resource._id);
  }

  // Fichiers restants : ceux rattachés à une publication conservée. Ils
  // survivent, mais plus leur lien avec le compte.
  const files = await ctx.db
    .query("files")
    .withIndex("by_user", (q) => q.eq("uploadedBy", userId))
    .collect();
  for (const file of files) {
    await ctx.db.patch(file._id, { uploadedBy: undefined });
  }

  await ctx.db.delete(userId);
}

export const deleteFromClerk = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (existing) await purgeUser(ctx, existing._id);
  },
});

/**
 * Efface les données de l'utilisateur connecté.
 *
 * Appelée par l'app juste avant `user.delete()` côté Clerk. Le webhook
 * `user.deleted` fait le même travail et sert de filet : passer par les deux
 * garantit l'effacement même si le webhook est mal configuré ou échoue.
 */
export const deleteOwnAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await purgeUser(ctx, user._id);
  },
});

/**
 * Enregistre l'acceptation des documents contractuels et la déclaration d'âge.
 * Appelée au moment de l'inscription, avant l'entrée dans l'app.
 */
export const acceptLegalTerms = mutation({
  args: {
    termsVersion: v.string(),
    privacyVersion: v.string(),
  },
  handler: async (ctx, { termsVersion, privacyVersion }) => {
    const user = await ensureUser(ctx);
    const now = Date.now();
    await ctx.db.patch(user._id, {
      termsAcceptedAt: now,
      termsVersion,
      privacyVersion,
      ageConfirmedAt: now,
    });
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

/**
 * Enregistre le token push du device courant pour l'utilisateur connecté.
 * Un token n'appartient qu'à un seul user : si le device était rattaché à un
 * autre compte (deux comptes sur le même téléphone), il est réattribué.
 */
export const savePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    // `ensureUser` et non `getAuthedUser` : l'enregistrement du token part dès
    // l'authentification, éventuellement avant l'arrivée du webhook Clerk.
    const user = await ensureUser(ctx);

    const now = Date.now();
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { userId: user._id, lastSeenAt: now });
      return;
    }

    await ctx.db.insert("pushTokens", {
      userId: user._id,
      token,
      createdAt: now,
      lastSeenAt: now,
    });
  },
});

/** À appeler AVANT `signOut()` : après, la mutation n'est plus authentifiée. */
export const removePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getAuthedUser(ctx);
    if (!user) return;
    const doc = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (doc && doc.userId === user._id) await ctx.db.delete(doc._id);
  },
});

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

/**
 * Met à jour le profil.
 *
 * `username` sert d'identifiant public et reste unique ; `displayName` est
 * libre. Séparer les deux évite d'avoir à réserver les caractères accentués et
 * les espaces dans une clé d'unicité.
 */
export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, { username, displayName, bio }) => {
    const user = await ensureUser(ctx);
    const patch: Partial<Doc<"users">> = {};

    if (username !== undefined) {
      const candidate = username.trim().toLowerCase();
      if (!USERNAME_PATTERN.test(candidate)) {
        throw new Error(
          "Le nom d'utilisateur doit faire 3 à 24 caractères, en minuscules, chiffres ou tirets bas.",
        );
      }
      if (candidate !== user.username) {
        const taken = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", candidate))
          .unique();
        if (taken) throw new Error("Ce nom d'utilisateur est déjà pris.");
        patch.username = candidate;
      }
    }

    if (displayName !== undefined) {
      const trimmed = displayName.trim();
      if (trimmed.length > 40) {
        throw new Error("Le nom affiché ne peut pas dépasser 40 caractères.");
      }
      patch.displayName = trimmed.length > 0 ? trimmed : undefined;
    }

    if (bio !== undefined) {
      const trimmed = bio.trim();
      if (trimmed.length > 280) {
        throw new Error("La bio ne peut pas dépasser 280 caractères.");
      }
      patch.bio = trimmed.length > 0 ? trimmed : undefined;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(user._id, patch);
  },
});

/** Profil public, consultable sans être l'intéressé. */
export const publicProfile = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!user) return null;

    // Ni e-mail, ni clerkId, ni rôle : un profil public n'expose que ce qui
    // est destiné à être vu.
    return {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  },
});

/** Destination d'envoi pour la photo de profil, chez le fournisseur actif. */
export const createAvatarUpload = mutation({
  args: {},
  handler: async (ctx) => {
    await ensureUser(ctx);
    return createUploadTarget(ctx);
  },
});

export const updateAvatar = mutation({
  args: {
    provider: v.union(v.literal("convex"), v.literal("r2")),
    storageId: v.optional(v.id("_storage")),
    storageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx);
    const avatarUrl = await storageUrl(ctx, {
      storageProvider: args.provider,
      storageId: args.storageId,
      storageKey: args.storageKey,
    });
    if (!avatarUrl) throw new Error("Envoi de la photo échoué.");
    await ctx.db.patch(user._id, { avatarUrl });
  },
});
