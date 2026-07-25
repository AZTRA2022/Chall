import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import {
  createUploadTarget,
  getBlob,
  maxFileBytes,
  remove,
  type UploadTarget,
} from "./storage/provider";
import { ensureUser } from "./users";

/**
 * Envoi de fichiers.
 *
 * Le flux est délibérément coupé en trois : l'app obtient une destination
 * d'envoi, téléverse directement vers le stockage, puis appelle `finalize` —
 * qui calcule l'empreinte et déclenche l'analyse **côté serveur**. Le client
 * n'est jamais la source de vérité sur le contenu qu'il envoie.
 *
 * Aucun appel direct au stockage ici : tout passe par `storage/provider.ts`.
 */

/** Types acceptés. Les exécutables passent par un lien vers la source officielle. */
const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const ALLOWED_MIME_EXACT = ["application/pdf"];

const BLOCKED_EXTENSIONS = [
  ".apk",
  ".exe",
  ".dmg",
  ".msi",
  ".ipa",
  ".bat",
  ".cmd",
  ".sh",
  ".jar",
  ".app",
];

function isAllowedMime(mimeType: string): boolean {
  return (
    ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) ||
    ALLOWED_MIME_EXACT.includes(mimeType)
  );
}

function hasBlockedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Destination d'envoi à usage unique, chez le fournisseur actif.
 *
 * L'app doit respecter la méthode HTTP renvoyée : Convex attend un POST et
 * répond avec l'identifiant, R2 une URL signée en PUT dont la clé est connue
 * d'avance.
 */
export const createUpload = mutation({
  args: {},
  handler: async (ctx): Promise<UploadTarget> => {
    await ensureUser(ctx);
    return createUploadTarget(ctx);
  },
});

/**
 * Enregistre le fichier envoyé, puis lance l'analyse.
 *
 * Renvoie l'identifiant du document `files`, à passer ensuite à
 * `resources.submitMedia`.
 */
export const finalizeUpload = action({
  args: {
    provider: v.union(v.literal("convex"), v.literal("r2")),
    storageId: v.optional(v.id("_storage")),
    storageKey: v.optional(v.string()),
    filename: v.string(),
    mimeType: v.string(),
    /** Déclaration d'auteur, article 5 des conditions. Obligatoire. */
    ownsRights: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ fileId: Id<"files"> }> => {
    const ref = {
      storageProvider: args.provider,
      storageId: args.storageId,
      storageKey: args.storageKey,
    };

    if (!args.storageId && !args.storageKey) {
      throw new Error("Référence de stockage manquante.");
    }
    if (!args.ownsRights) {
      throw new Error(
        "La déclaration d'auteur est obligatoire pour envoyer un fichier.",
      );
    }
    if (!isAllowedMime(args.mimeType) || hasBlockedExtension(args.filename)) {
      await remove(ctx, ref);
      throw new Error(
        "Ce type de fichier n'est pas accepté. Partagez plutôt un lien vers la source officielle.",
      );
    }

    const blob = await getBlob(ctx, ref);
    if (!blob) throw new Error("Fichier introuvable dans le stockage.");

    const limit = maxFileBytes();
    if (blob.size > limit) {
      await remove(ctx, ref);
      throw new Error(
        `Fichier trop volumineux (${Math.round(limit / 1024 / 1024)} Mo maximum).`,
      );
    }

    // Empreinte calculée ici, sur les octets réellement stockés : c'est elle
    // qui rend un retrait durable via `blockedHashes`.
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer(),
    );
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const blocked = await ctx.runQuery(internal.files.isHashBlocked, { sha256 });
    if (blocked) {
      await remove(ctx, ref);
      throw new Error(
        "Ce fichier a déjà fait l'objet d'un retrait et ne peut pas être republié.",
      );
    }

    const fileId: Id<"files"> = await ctx.runMutation(internal.files.record, {
      provider: args.provider,
      storageId: args.storageId,
      storageKey: args.storageKey,
      filename: args.filename,
      mimeType: args.mimeType,
      sizeBytes: blob.size,
      sha256,
    });

    await ctx.runAction(internal.files.scan, { fileId });
    return { fileId };
  },
});

export const isHashBlocked = internalQuery({
  args: { sha256: v.string() },
  handler: async (ctx, { sha256 }) => {
    const hit = await ctx.db
      .query("blockedHashes")
      .withIndex("by_sha256", (q) => q.eq("sha256", sha256))
      .unique();
    return hit !== null;
  },
});

export const record = internalMutation({
  args: {
    provider: v.union(v.literal("convex"), v.literal("r2")),
    storageId: v.optional(v.id("_storage")),
    storageKey: v.optional(v.string()),
    filename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    sha256: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx);
    const now = Date.now();
    return ctx.db.insert("files", {
      storageProvider: args.provider,
      storageId: args.storageId,
      storageKey: args.storageKey,
      filename: args.filename,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      sha256: args.sha256,
      scanStatus: "pending",
      authorDeclaredAt: now,
      uploadedBy: user._id,
      createdAt: now,
    });
  },
});

export const setScanResult = internalMutation({
  args: {
    fileId: v.id("files"),
    scanStatus: v.union(
      v.literal("clean"),
      v.literal("infected"),
      v.literal("error"),
    ),
    scanEngine: v.string(),
  },
  handler: async (ctx, { fileId, scanStatus, scanEngine }) => {
    await ctx.db.patch(fileId, {
      scanStatus,
      scanEngine,
      scanAt: Date.now(),
    });

    // Un fichier infecté ne reste pas en ligne le temps d'une revue humaine.
    if (scanStatus === "infected") {
      const file = await ctx.db.get(fileId);
      if (file) await remove(ctx, file);
    }
  },
});

export const getFile = internalQuery({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => ctx.db.get(fileId),
});

/**
 * Analyse antivirus.
 *
 * Appelle le service ClamAV désigné par `CLAMAV_SCAN_URL`. Tant que la variable
 * n'est pas définie, le fichier reste en `pending` : il n'est **jamais**
 * marqué propre par défaut, donc jamais téléchargeable. C'est le comportement
 * voulu — un service d'analyse absent doit bloquer, pas ouvrir.
 */
export const scan = internalAction({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const endpoint = process.env.CLAMAV_SCAN_URL;
    if (!endpoint) {
      console.warn(
        "[scan] CLAMAV_SCAN_URL non défini : le fichier reste en attente d'analyse.",
      );
      return;
    }

    const file = await ctx.runQuery(internal.files.getFile, { fileId });
    if (!file) return;

    try {
      const blob = await getBlob(ctx, file);
      if (!blob) return;

      const token = process.env.CLAMAV_SCAN_TOKEN;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: await blob.arrayBuffer(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = (await response.json()) as { infected: boolean };
      await ctx.runMutation(internal.files.setScanResult, {
        fileId,
        scanStatus: result.infected ? "infected" : "clean",
        scanEngine: "clamav",
      });
    } catch (error) {
      console.error("[scan] échec de l'analyse", error);
      await ctx.runMutation(internal.files.setScanResult, {
        fileId,
        scanStatus: "error",
        scanEngine: "clamav",
      });
    }
  },
});
