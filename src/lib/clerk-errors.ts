import { isClerkAPIResponseError } from "@clerk/expo";

/**
 * Traduit une erreur Clerk en message affichable.
 *
 * Deux raisons de ne jamais afficher `error.message` brut — la seconde vient de
 * la documentation de Clerk elle-même, qui précise que `message` s'adresse aux
 * développeurs et que le code est la seule donnée stable :
 *
 * 1. Énumération de comptes. « An account with this email already exists »
 *    permet à un tiers de vérifier si une adresse est inscrite chez nous. Les
 *    messages ci-dessous restent muets sur l'existence d'un compte.
 * 2. Les messages de Clerk sont en anglais et techniques.
 *
 * Un code non listé retombe sur un message générique : mieux vaut être vague
 * que fuiter.
 */
const MESSAGES: Record<string, string> = {
  form_password_incorrect: "Identifiants incorrects.",
  form_identifier_not_found: "Identifiants incorrects.",
  form_password_pwned:
    "Ce mot de passe apparaît dans une fuite de données connue. Choisissez-en un autre.",
  form_password_length_too_short: "Le mot de passe est trop court.",
  form_password_validation_failed: "Ce mot de passe ne convient pas.",
  form_identifier_exists:
    "Si un compte existe pour cette adresse, vous recevrez un e-mail.",
  form_param_format_invalid: "Le format saisi n'est pas valide.",
  form_param_nil: "Ce champ est obligatoire.",
  form_code_incorrect: "Code incorrect ou expiré.",
  verification_expired: "Ce code a expiré. Demandez-en un nouveau.",
  verification_failed: "Vérification impossible. Demandez un nouveau code.",
  too_many_requests: "Trop de tentatives. Réessayez dans quelques minutes.",
  captcha_invalid: "Vérification anti-robot échouée. Réessayez.",
  captcha_unavailable: "Vérification anti-robot indisponible. Réessayez.",
  session_exists: "Vous êtes déjà connecté.",
};

const FALLBACK = "Une erreur est survenue. Réessayez.";

/** Vrai pour une instance de `ClerkError`, qui porte un `code` stable. */
function hasClerkCode(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "clerkError" in error &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

/**
 * Accepte aussi bien une erreur levée qu'un objet `error` renvoyé dans le
 * résultat d'un appel Clerk.
 */
export function clerkErrorMessage(error: unknown): string {
  if (hasClerkCode(error)) return MESSAGES[error.code] ?? FALLBACK;
  if (isClerkAPIResponseError(error)) {
    const code = error.errors[0]?.code;
    return (code && MESSAGES[code]) || FALLBACK;
  }
  return FALLBACK;
}
