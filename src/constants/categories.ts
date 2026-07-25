/**
 * Catégories de ressources. L'ordre est celui d'affichage dans les filtres.
 *
 * Les identifiants sont figés : ils sont stockés en base sur chaque ressource,
 * donc les renommer casserait les documents existants. Seuls les libellés
 * peuvent changer.
 */
export const CATEGORIES = [
  { id: "formation", label: "Formations" },
  { id: "logiciel", label: "Logiciels" },
  { id: "app", label: "Apps" },
  { id: "mod", label: "Mods" },
  { id: "video", label: "Vidéos" },
  { id: "lien", label: "Liens" },
  { id: "photo", label: "Photos" },
  { id: "autre", label: "Autres" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_LABELS: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<CategoryId, string>;

/** Tris du feed. `hot` pondère les votes par l'ancienneté (voir `hotScore`). */
export const FEED_SORTS = [
  { id: "hot", label: "Populaire" },
  { id: "new", label: "Nouveau" },
  { id: "top", label: "Top" },
] as const;

export type FeedSort = (typeof FEED_SORTS)[number]["id"];
