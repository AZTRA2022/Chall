import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type ActionCtx,
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

export const setScanAnalysisId = internalMutation({
  args: { fileId: v.id("files"), analysisId: v.string() },
  handler: async (ctx, { fileId, analysisId }) => {
    await ctx.db.patch(fileId, { scanAnalysisId: analysisId });
  },
});

export const getFile = internalQuery({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => ctx.db.get(fileId),
});

const VT_API_BASE = "https://www.virustotal.com/api/v3";
/** Limite VirusTotal pour l'envoi direct ; au-delà il faut une upload_url dédiée. */
const VT_DIRECT_UPLOAD_LIMIT = 32 * 1024 * 1024;
/**
 * Délai entre deux vérifications et nombre d'essais.
 *
 * Un fichier neuf part en file d'attente d'analyse côté VirusTotal (tier
 * gratuit) : en pratique, largement plus de 30s avant un résultat — mesuré à
 * plus de 7 minutes encore `queued` lors du test EICAR. Attendre en bloquant
 * une action gaspillerait du temps de calcul pour rien ; on revérifie donc
 * via le scheduler, pas dans une boucle synchrone.
 */
const VT_POLL_DELAY_MS = 60_000;
const VT_MAX_POLL_ATTEMPTS = 15;

async function vtUploadUrl(apiKey: string): Promise<string> {
  const response = await fetch(`${VT_API_BASE}/files/upload_url`, {
    headers: { "x-apikey": apiKey },
  });
  if (!response.ok) throw new Error(`VT upload_url HTTP ${response.status}`);
  const { data } = (await response.json()) as { data: string };
  return data;
}

/**
 * Corps multipart construit à la main : `FormData` n'est pas fiable dans le
 * runtime d'action par défaut de Convex, alors qu'un `Uint8Array` en corps de
 * `fetch` l'est déjà (cf. l'ancien envoi ClamAV ci-dessous).
 */
function buildMultipart(
  fieldName: string,
  filename: string,
  bytes: Uint8Array,
): { body: Uint8Array; contentType: string } {
  const boundary = `convexVt${Date.now()}${Math.random().toString(16).slice(2)}`;
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function vtSubmit(
  apiKey: string,
  blob: Blob,
  filename: string,
): Promise<string> {
  const endpoint =
    blob.size > VT_DIRECT_UPLOAD_LIMIT
      ? await vtUploadUrl(apiKey)
      : `${VT_API_BASE}/files`;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { body, contentType } = buildMultipart("file", filename, bytes);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "x-apikey": apiKey, "content-type": contentType },
    // Cast requis : les typings TS 5.9 attendent `Uint8Array<ArrayBuffer>`
    // pour `BodyInit`, alors que `Uint8Array` est générique sur
    // `ArrayBufferLike` par défaut — mismatch de typing, pas d'exécution.
    body: body as BodyInit,
  });
  if (!response.ok) throw new Error(`VT submit HTTP ${response.status}`);
  const { data } = (await response.json()) as { data: { id: string } };
  return data.id;
}

type VtVerdict = { malicious: boolean };

/** Résultat déjà connu de VT pour ce hash — instantané, pas de file d'attente. */
async function vtLookupHash(
  apiKey: string,
  sha256: string,
): Promise<VtVerdict | null> {
  const response = await fetch(`${VT_API_BASE}/files/${sha256}`, {
    headers: { "x-apikey": apiKey },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`VT files HTTP ${response.status}`);

  const { data } = (await response.json()) as {
    data: { attributes: { last_analysis_stats: Record<string, number> } };
  };
  const stats = data.attributes.last_analysis_stats;
  return { malicious: (stats.malicious ?? 0) + (stats.suspicious ?? 0) > 0 };
}

/** `null` tant que l'analyse est encore en file d'attente. */
async function vtCheckAnalysis(
  apiKey: string,
  analysisId: string,
): Promise<VtVerdict | null> {
  const response = await fetch(`${VT_API_BASE}/analyses/${analysisId}`, {
    headers: { "x-apikey": apiKey },
  });
  if (!response.ok) throw new Error(`VT analyses HTTP ${response.status}`);
  const { data } = (await response.json()) as {
    data: {
      attributes: {
        status: string;
        stats: { malicious: number; suspicious: number };
      };
    };
  };

  if (data.attributes.status !== "completed") return null;
  const { malicious, suspicious } = data.attributes.stats;
  return { malicious: malicious > 0 || suspicious > 0 };
}

async function applyVerdict(
  ctx: ActionCtx,
  fileId: Id<"files">,
  verdict: VtVerdict,
) {
  await ctx.runMutation(internal.files.setScanResult, {
    fileId,
    scanStatus: verdict.malicious ? "infected" : "clean",
    scanEngine: "virustotal",
  });
}

/**
 * Analyse antivirus via VirusTotal (multi-moteurs, cloud, aucune infra à nous).
 *
 * Tant que `VIRUSTOTAL_API_KEY` n'est pas définie, le fichier reste en
 * `pending` : il n'est **jamais** marqué propre par défaut, donc jamais
 * téléchargeable. C'est le comportement voulu — un service d'analyse absent
 * doit bloquer, pas ouvrir.
 *
 * Un hash déjà vu par VT répond tout de suite (`vtLookupHash`). Un fichier
 * neuf part en analyse fraîche, dont le résultat n'arrive jamais dans le
 * temps d'exécution d'une action (cf. `VT_POLL_DELAY_MS`) — on soumet puis on
 * repasse par le scheduler (`pollScan`) plutôt que d'attendre en bloquant.
 */
export const scan = internalAction({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      console.warn(
        "[scan] VIRUSTOTAL_API_KEY non défini : le fichier reste en attente d'analyse.",
      );
      return;
    }

    const file = await ctx.runQuery(internal.files.getFile, { fileId });
    if (!file) return;

    try {
      if (file.sha256) {
        const known = await vtLookupHash(apiKey, file.sha256);
        if (known) {
          await applyVerdict(ctx, fileId, known);
          return;
        }
      }

      const blob = await getBlob(ctx, file);
      if (!blob) return;

      const analysisId = await vtSubmit(apiKey, blob, file.filename);
      await ctx.runMutation(internal.files.setScanAnalysisId, {
        fileId,
        analysisId,
      });
      await ctx.scheduler.runAfter(VT_POLL_DELAY_MS, internal.files.pollScan, {
        fileId,
        analysisId,
        attempt: 1,
      });
    } catch (error) {
      console.error("[scan] échec de l'analyse", error);
      await ctx.runMutation(internal.files.setScanResult, {
        fileId,
        scanStatus: "error",
        scanEngine: "virustotal",
      });
    }
  },
});

export const pollScan = internalAction({
  args: {
    fileId: v.id("files"),
    analysisId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, { fileId, analysisId, attempt }) => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) return;

    try {
      const verdict = await vtCheckAnalysis(apiKey, analysisId);
      if (verdict) {
        await applyVerdict(ctx, fileId, verdict);
        return;
      }

      if (attempt >= VT_MAX_POLL_ATTEMPTS) {
        console.warn(
          `[scan] analyse VirusTotal jamais terminée après ${attempt} essais (fichier ${fileId}).`,
        );
        await ctx.runMutation(internal.files.setScanResult, {
          fileId,
          scanStatus: "error",
          scanEngine: "virustotal",
        });
        return;
      }

      await ctx.scheduler.runAfter(VT_POLL_DELAY_MS, internal.files.pollScan, {
        fileId,
        analysisId,
        attempt: attempt + 1,
      });
    } catch (error) {
      console.error("[scan] échec du suivi d'analyse", error);
      await ctx.runMutation(internal.files.setScanResult, {
        fileId,
        scanStatus: "error",
        scanEngine: "virustotal",
      });
    }
  },
});
