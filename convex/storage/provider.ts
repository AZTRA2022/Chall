import { R2 } from "@convex-dev/r2";

import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";

/**
 * Couche unique d'accès au stockage.
 *
 * Aucun autre fichier ne doit appeler `ctx.storage.*` ni le client R2
 * directement. C'est ce qui permet de changer de fournisseur sans toucher aux
 * appelants — et c'est aussi ce qui manquait quand les appels se sont
 * disséminés dans cinq modules.
 */

const r2 = new R2(components.r2);

/** Désignation d'un objet stocké, indépendante du fournisseur. */
export type StorageRef = Pick<
  Doc<"files">,
  "storageProvider" | "storageId" | "storageKey"
>;

/**
 * Fournisseur utilisé pour les **nouveaux** envois.
 *
 * Déduit de la présence des variables d'environnement plutôt que d'un drapeau
 * séparé : un drapeau à `r2` sans identifiants produirait des envois qui
 * échouent, alors qu'ici l'absence de configuration retombe simplement sur
 * Convex. Les objets déjà stockés gardent leur fournisseur d'origine.
 */
export function activeProvider(): "convex" | "r2" {
  const configured =
    process.env.R2_BUCKET &&
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY;
  return configured ? "r2" : "convex";
}

/**
 * Taille maximale par fichier, selon le fournisseur.
 *
 * 25 Mo sur Convex n'est pas un choix de produit mais la contrainte du tier
 * gratuit : 1 Go de sortie par mois, qu'un seul fichier de 25 Mo téléchargé
 * 40 fois suffit à consommer. R2 ne facture pas la sortie, d'où les 100 Mo.
 */
export function maxFileBytes(): number {
  return activeProvider() === "r2" ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
}

export type UploadTarget = {
  provider: "convex" | "r2";
  uploadUrl: string;
  /** Méthode HTTP attendue : Convex veut un POST, R2 une URL signée en PUT. */
  method: "POST" | "PUT";
  /** Clé R2 connue à l'avance. Absente côté Convex, qui la renvoie après coup. */
  key?: string;
  /** Plafond applicable, pour que l'app refuse avant l'envoi plutôt qu'après. */
  maxBytes: number;
};

/** Prépare une destination d'envoi chez le fournisseur actif. */
export async function createUploadTarget(
  ctx: MutationCtx,
): Promise<UploadTarget> {
  if (activeProvider() === "r2") {
    const { key, url } = await r2.generateUploadUrl();
    return {
      provider: "r2",
      uploadUrl: url,
      method: "PUT",
      key,
      maxBytes: maxFileBytes(),
    };
  }
  return {
    provider: "convex",
    uploadUrl: await ctx.storage.generateUploadUrl(),
    method: "POST",
    maxBytes: maxFileBytes(),
  };
}

/**
 * URL de lecture. Signée et temporaire côté R2, d'où le `null` possible si
 * l'objet a disparu entre-temps.
 */
export async function getUrl(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  ref: StorageRef,
): Promise<string | null> {
  if (ref.storageProvider === "r2") {
    if (!ref.storageKey) return null;
    try {
      return await r2.getUrl(ref.storageKey);
    } catch {
      return null;
    }
  }
  if (!ref.storageId) return null;
  return ctx.storage.getUrl(ref.storageId);
}

/**
 * Contenu binaire, pour l'analyse antivirus et le calcul d'empreinte.
 *
 * Côté R2 il n'existe pas de lecture directe : on passe par l'URL signée. Le
 * détour est invisible pour l'appelant, ce qui est précisément le but de cette
 * couche.
 */
export async function getBlob(
  ctx: ActionCtx,
  ref: StorageRef,
): Promise<Blob | null> {
  if (ref.storageProvider === "r2") {
    const url = await getUrl(ctx, ref);
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.blob();
  }
  if (!ref.storageId) return null;
  return ctx.storage.get(ref.storageId);
}

/** Suppression définitive. Silencieuse si l'objet n'existe déjà plus. */
export async function remove(
  ctx: MutationCtx | ActionCtx,
  ref: StorageRef,
): Promise<void> {
  try {
    if (ref.storageProvider === "r2") {
      if (ref.storageKey) await r2.deleteObject(ctx, ref.storageKey);
      return;
    }
    if (ref.storageId) await ctx.storage.delete(ref.storageId);
  } catch (error) {
    // Un objet déjà supprimé ne doit pas faire échouer un retrait ou une
    // suppression de compte : le reste du nettoyage compte davantage.
    console.warn("[storage] suppression impossible", error);
  }
}

/** Construit une référence à partir du résultat d'un envoi. */
export function refFrom(input: {
  provider: "convex" | "r2";
  storageId?: Id<"_storage">;
  storageKey?: string;
}): StorageRef {
  return {
    storageProvider: input.provider,
    storageId: input.storageId,
    storageKey: input.storageKey,
  };
}
