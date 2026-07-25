import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

/**
 * Sélection et envoi de médias.
 *
 * Le fichier part directement de l'appareil vers le stockage, sans transiter
 * par une mutation : les mutations Convex ne reçoivent pas de binaire, et faire
 * remonter 25 Mo en base64 serait à la fois lent et coûteux.
 */

export type PickedMedia = {
  uri: string;
  filename: string;
  mimeType: string;
  kind: "image" | "video" | "file";
  /** Taille en octets quand le système la fournit — absente sur certains Android. */
  sizeBytes?: number;
};

/**
 * Plafond de repli, utilisé seulement pour l'affichage avant qu'une
 * destination d'envoi ait été demandée. La valeur qui fait foi est celle
 * renvoyée par le serveur dans `UploadTarget.maxBytes` — la coder en dur des
 * deux côtés les ferait diverger à la première bascule de fournisseur.
 */
export const FALLBACK_MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Déduit un type MIME utilisable même quand le sélecteur n'en fournit pas —
 * c'est fréquent sur Android quand l'utilisateur navigue dans le système de
 * fichiers plutôt que dans la galerie.
 */
function inferMimeType(
  asset: ImagePicker.ImagePickerAsset,
  filename: string,
): string {
  if (asset.mimeType) return asset.mimeType;
  const extension = filename.split(".").pop()?.toLowerCase();
  const byExtension: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  };
  if (extension && byExtension[extension]) return byExtension[extension];
  return asset.type === "video" ? "video/mp4" : "image/jpeg";
}

/**
 * Ouvre la galerie. Renvoie `null` si l'utilisateur annule ou refuse l'accès —
 * un refus n'est pas une erreur, il ne doit pas remonter en exception.
 */
export async function pickMedia(
  options: { imagesOnly?: boolean } = {},
): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: options.imagesOnly ? ["images"] : ["images", "videos"],
    quality: 0.9,
    allowsMultipleSelection: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const filename = asset.fileName ?? asset.uri.split("/").pop() ?? "fichier";
  const kind = asset.type === "video" ? "video" : "image";

  return {
    uri: asset.uri,
    filename,
    mimeType: inferMimeType(asset, filename),
    kind,
    sizeBytes: asset.fileSize ?? undefined,
  };
}

/** Destination renvoyée par le serveur, telle quelle. */
export type UploadTarget = {
  provider: "convex" | "r2";
  uploadUrl: string;
  method: "POST" | "PUT";
  key?: string;
  maxBytes: number;
};

/** Référence à passer à `finalizeUpload` une fois l'envoi terminé. */
export type StorageRef = {
  provider: "convex" | "r2";
  storageId?: string;
  storageKey?: string;
};

/**
 * Envoie le média vers la destination fournie par le serveur.
 *
 * Les deux fournisseurs ne se pilotent pas pareil : Convex attend un POST et
 * répond avec l'identifiant créé, R2 une URL signée en PUT dont la clé est
 * connue d'avance et qui ne renvoie aucun corps. Le serveur décide, le client
 * se contente de suivre `method` — c'est ce qui permettra de rebasculer sans
 * publier une nouvelle version de l'app.
 *
 * `fetch(uri).blob()` fonctionne sur les URI locales en React Native et évite
 * d'ajouter `expo-file-system` pour lire le fichier.
 */
export async function uploadMedia(
  media: PickedMedia,
  target: UploadTarget,
): Promise<StorageRef> {
  const fileResponse = await fetch(media.uri);
  const blob = await fileResponse.blob();

  // Contrôle local en premier : inutile de faire monter 40 Mo pour se les
  // faire refuser à l'arrivée. Le serveur revérifie de toute façon.
  if (blob.size > target.maxBytes) {
    throw new Error(
      `Fichier trop volumineux (${Math.round(target.maxBytes / 1024 / 1024)} Mo maximum).`,
    );
  }

  const uploadResponse = await fetch(target.uploadUrl, {
    method: target.method,
    headers: { "content-type": media.mimeType },
    body: blob,
  });
  if (!uploadResponse.ok) {
    throw new Error("L'envoi du fichier a échoué. Réessayez.");
  }

  if (target.provider === "r2") {
    return { provider: "r2", storageKey: target.key };
  }

  const { storageId } = (await uploadResponse.json()) as { storageId: string };
  return { provider: "convex", storageId };
}

/**
 * Types acceptés pour un document. Alignés sur la liste du serveur — les
 * exécutables passent par un lien vers la source officielle.
 */
const DOCUMENT_TYPES = ["application/pdf"];

/**
 * Ouvre le sélecteur de fichiers du système.
 *
 * Restreint aux types que le serveur accepte : mieux vaut ne pas proposer un
 * fichier qui sera refusé après l'envoi.
 */
export async function pickDocument(): Promise<PickedMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: DOCUMENT_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    filename: asset.name,
    mimeType: asset.mimeType ?? "application/pdf",
    kind: "file",
    sizeBytes: asset.size ?? undefined,
  };
}
