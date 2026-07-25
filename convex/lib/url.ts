/**
 * Normalisation d'URL, cœur de l'anti-doublon.
 *
 * Deux personnes qui partagent la même ressource ne collent presque jamais la
 * même chaîne : l'une arrive avec des paramètres de campagne, l'autre en http,
 * une troisième avec un slash final. Sans normalisation, le catalogue se
 * remplit de triplons et les votes se dispersent entre eux.
 */

/** Paramètres purement analytiques, retirés systématiquement. */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "igshid",
  "si",
];

export type NormalizedUrl = {
  canonical: string;
  domain: string;
};

/**
 * Renvoie `null` si l'entrée n'est pas une URL http(s) exploitable.
 *
 * Les autres schémas sont refusés volontairement : `javascript:` et `data:`
 * n'ont rien à faire dans un catalogue de liens, et laisser passer `ftp:`
 * ouvrirait des ressources que l'app ne sait pas ouvrir.
 */
export function normalizeUrl(input: string): NormalizedUrl | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Sans schéma, on suppose https plutôt que de rejeter : coller « github.com/x »
  // est le geste le plus naturel du monde.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.hostname.length === 0 || !parsed.hostname.includes(".")) {
    return null;
  }

  // http → https : la quasi-totalité des sites redirigent, et garder les deux
  // formes créerait deux entrées pour une même ressource.
  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  parsed.hash = "";

  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param);
  }
  // Ordre stable : `?a=1&b=2` et `?b=2&a=1` désignent la même page.
  parsed.searchParams.sort();

  // Slash final retiré, sauf sur la racine où il fait partie de l'URL.
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return { canonical: parsed.toString(), domain: parsed.hostname };
}
