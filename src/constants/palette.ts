/**
 * Source unique des couleurs de l'app.
 *
 * L'app est en thème sombre uniquement : la direction visuelle repose sur un
 * seul rouge posé sur une échelle de noirs, et ce rouge n'a pas la même
 * présence sur un fond clair. Il n'existe donc pas de variante claire, ni ici
 * ni ailleurs.
 *
 * Les variables CSS de `src/global.css` sont les mêmes valeurs en HSL et
 * doivent rester alignées manuellement (le CSS ne peut pas importer ce module).
 */

/** Valeurs brutes. Ne pas utiliser directement dans un composant. */
export const PALETTE = {
  // Neutres
  black: "#0A0A0A", // fond de l'app
  surface: "#141414", // cartes, feuilles, barre d'onglets
  elevated: "#1E1E1E", // vignettes, champs, états pressés
  line: "#262626", // filets et bordures
  ash: "#8C8C8C", // texte secondaire
  white: "#FAFAFA", // texte principal
  pure: "#FFFFFF", // texte sur aplat rouge

  // Rouge — la seule teinte de l'app
  red: "#FF3B30", // aplats : bouton principal, badge
  redDeep: "#CA271C", // actions irréversibles (supprimer, bannir)
  redLight: "#FF7A71", // texte et icônes rouges (contraste 7,8:1 sur le fond)
} as const;

/**
 * Rayon de base. 6px : assez pour ne pas être brutaliste, assez serré pour
 * garder le registre technique de la direction visuelle.
 */
export const RADIUS = 6;
