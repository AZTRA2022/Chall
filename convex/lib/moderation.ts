import type { QueryCtx } from "../_generated/server";

/**
 * Filtre déterministe, exécuté avant toute analyse.
 *
 * C'est la seule couche non contournable : une expression régulière ne négocie
 * pas avec un titre qui prétend être légitime, là où un classifieur peut se
 * faire retourner par le texte qu'il analyse.
 */

/** Mots-clés du piratage, insensibles à la casse et aux accents usuels. */
const SUSPICIOUS_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /\bcracks?\b/i, flag: "mot-cle-crack" },
  { pattern: /\bkeygens?\b/i, flag: "mot-cle-keygen" },
  { pattern: /\bnulled\b/i, flag: "mot-cle-nulled" },
  { pattern: /\bserials?\b/i, flag: "mot-cle-serial" },
  { pattern: /\bactivat(eur|or)s?\b/i, flag: "mot-cle-activateur" },
  { pattern: /\bwarez\b/i, flag: "mot-cle-warez" },
  { pattern: /\btorrents?\b/i, flag: "mot-cle-torrent" },
  { pattern: /\b(premium|licence|license)\s+gratuit/i, flag: "mot-cle-premium-gratuit" },
  { pattern: /\bfull\s+version\b/i, flag: "mot-cle-full-version" },
  { pattern: /\bpirat(e|ee|é|ée)\b/i, flag: "mot-cle-pirate" },
];

/**
 * Relève les motifs suspects. Ne décide rien : les drapeaux remontent l'entrée
 * en tête de file de modération, ils ne rejettent pas à eux seuls.
 */
export async function autoFlags(
  ctx: QueryCtx,
  input: { title: string; description?: string; domain?: string },
): Promise<string[]> {
  const flags: string[] = [];

  if (input.domain) {
    const blocked = await ctx.db
      .query("blockedDomains")
      .withIndex("by_domain", (q) => q.eq("domain", input.domain!))
      .unique();
    if (blocked) flags.push("domaine-bloque");
  }

  const haystack = `${input.title} ${input.description ?? ""}`;
  for (const { pattern, flag } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(haystack)) flags.push(flag);
  }

  return flags;
}

/**
 * Score de tri du feed : les votes divisés par l'ancienneté.
 *
 * L'exposant 1.5 est celui de Hacker News — assez fort pour qu'une ressource
 * populaire cède la place en une journée, assez doux pour qu'un contenu
 * excellent tienne plus longtemps qu'un contenu moyen.
 */
export function hotScore(voteCount: number, createdAt: number): number {
  const ageHours = (Date.now() - createdAt) / 3_600_000;
  return voteCount / Math.pow(ageHours + 2, 1.5);
}
