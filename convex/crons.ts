import { cronJobs } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { hotScore } from "./lib/moderation";

/**
 * `hotScore` est stocké pour permettre un index et donc un feed paginé sans
 * parcourir la table. Le revers est qu'il vieillit : sans recalcul, une
 * ressource d'hier resterait indéfiniment devant celle d'aujourd'hui.
 *
 * Le recalcul se fait par lots, du plus haut score vers le bas : ce sont les
 * ressources en tête de feed dont la fraîcheur compte, et les scores proches de
 * zéro ne changeront pas l'ordre.
 */
export const refreshHotScores = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize }) => {
    const resources = await ctx.db
      .query("resources")
      .withIndex("by_status_hot", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(batchSize ?? 200);

    for (const resource of resources) {
      const next = hotScore(resource.voteCount, resource.createdAt);
      if (next !== resource.hotScore) {
        await ctx.db.patch(resource._id, { hotScore: next });
      }
    }
  },
});

/**
 * Relance les analyses restées en attente ou en échec.
 *
 * Sans ce rattrapage, un fichier envoyé pendant une indisponibilité du service
 * d'analyse resterait bloqué indéfiniment : jamais propre, donc jamais
 * téléchargeable, et son auteur sans explication.
 */
export const rescanStalledFiles = internalAction({
  args: {},
  handler: async (ctx) => {
    const stalled = await ctx.runQuery(internal.crons.listStalledFiles, {});
    for (const fileId of stalled) {
      await ctx.runAction(internal.files.scan, { fileId });
    }
  },
});

export const listStalledFiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 10 * 60_000;
    const pendingFiles = await ctx.db
      .query("files")
      .withIndex("by_scan_status", (q) => q.eq("scanStatus", "pending"))
      .take(50);
    const erroredFiles = await ctx.db
      .query("files")
      .withIndex("by_scan_status", (q) => q.eq("scanStatus", "error"))
      .take(50);

    // Un fichier tout juste envoyé est peut-être encore en cours d'analyse :
    // le relancer immédiatement doublerait le travail pour rien.
    return [...pendingFiles, ...erroredFiles]
      .filter((f) => f.createdAt < cutoff)
      .map((f) => f._id);
  },
});

const crons = cronJobs();

crons.hourly(
  "recalcul des scores du feed",
  { minuteUTC: 0 },
  internal.crons.refreshHotScores,
  {},
);

// Identifiant sans accent : Convex n'accepte que de l'ASCII ici.
crons.interval(
  "relance des analyses antivirus bloquees",
  { minutes: 15 },
  internal.crons.rescanStalledFiles,
  {},
);

export default crons;
