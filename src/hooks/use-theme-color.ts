/**
 * Lit un token de couleur du thème.
 *
 * L'app est en thème sombre uniquement, donc il n'y a qu'un seul jeu de valeurs.
 * `override.dark` laisse un composant forcer une couleur précise sans
 * court-circuiter le reste du système.
 */

import { Colors } from "@/constants/theme";

export function useThemeColor(
  override: { dark?: string },
  colorName: keyof typeof Colors,
) {
  return override.dark ?? Colors[colorName];
}
