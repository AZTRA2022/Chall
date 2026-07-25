/**
 * Couleurs et polices consommées par les composants qui n'utilisent pas
 * NativeWind (barre d'onglets flottante, `themed-*`, icônes de navigation).
 *
 * Thème sombre uniquement — voir `src/constants/palette.ts`. Les mêmes tokens
 * existent en HSL dans `src/global.css` et en sémantique dans `src/lib/theme.ts`.
 */

import { PALETTE } from "./palette";

export const Colors = {
  text: PALETTE.white,
  background: PALETTE.black,
  tint: PALETTE.red,
  icon: PALETTE.ash,
  tabIconDefault: PALETTE.ash,
  tabIconSelected: PALETTE.red,
  foreground: PALETTE.white,
  mutedForeground: PALETTE.ash,
  border: PALETTE.line,
  primary: PALETTE.red,
  /** Rouge lisible en texte et en icône sur le fond de l'app. */
  primaryInk: PALETTE.redLight,
  primaryForeground: PALETTE.pure,
  // Barre d'onglets flottante
  tabBar: PALETTE.surface,
  tabChip: "#FF3B30",
  tabChipForeground: PALETTE.red,
};

/**
 * Rôles typographiques. Chaque rôle a un travail précis ; un texte qui ne rentre
 * dans aucun des trois est probablement mal placé.
 *
 * - `display` — Bebas Neue, condensé, toujours en capitales. Titres d'écran et
 *   grands nombres. Large et rare, jamais en petit corps.
 * - `body` — Inter. Texte courant, titres de ressources, libellés de boutons.
 * - `meta` — JetBrains Mono en capitales très espacées. Réservé aux métadonnées
 *   réelles : catégorie, domaine source, taille de fichier, compteurs, statut.
 *   Jamais décoratif — s'il n'y a pas de donnée, il n'y a pas de `meta`.
 */
export const Fonts = {
  display: "BebasNeue_400Regular",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  meta: "JetBrainsMono_400Regular",
  metaBold: "JetBrainsMono_700Bold",
} as const;

/**
 * Interlettrage des libellés `meta`, en points. React Native attend une valeur
 * absolue, pas un `em` — ce chiffre correspond à ~0.16em à 11px.
 */
export const META_TRACKING = 1.8;
