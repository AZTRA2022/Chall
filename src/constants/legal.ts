/**
 * Identité juridique et versions des documents contractuels.
 *
 * ⚠️ Les quatre constantes de `LEGAL_ENTITY` doivent être renseignées avant
 * toute soumission aux stores : elles apparaissent telles quelles dans les CGU
 * et dans la politique de confidentialité, et l'absence d'un éditeur
 * identifiable est un motif de rejet comme un manquement au RGPD.
 */
export const LEGAL_ENTITY = {
  /** Nom de la personne physique ou morale qui édite l'app. */
  name: "À RENSEIGNER",
  /** Adresse postale de l'éditeur. */
  address: "À RENSEIGNER",
  /** Pays d'établissement — détermine le droit applicable. */
  country: "À RENSEIGNER",
  /** Adresse de contact général, publiée dans l'app et sur la fiche du store. */
  contactEmail: "contact@example.com",
  /** Adresse dédiée aux demandes de retrait. Doit être relevée. */
  abuseEmail: "abuse@example.com",
} as const;

/**
 * Versions des documents. Incrémenter la date quand le texte change de façon
 * substantielle : l'app compare la version acceptée par l'utilisateur à
 * celle-ci et redemande son accord si elles diffèrent.
 */
export const TERMS_VERSION = "2026-07-25";
export const PRIVACY_VERSION = "2026-07-25";

/**
 * Âge minimum pour créer un compte.
 *
 * 16 ans est le plafond prévu par l'article 8 du RGPD. Certains pays
 * descendent à 13, mais retenir le plafond évite d'avoir à détecter le pays de
 * l'utilisateur et à maintenir une table par juridiction.
 */
export const MINIMUM_AGE = 16;
