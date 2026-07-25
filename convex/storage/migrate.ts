import { R2 } from "@convex-dev/r2";
import { v } from "convex/values";

import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";

/**
 * Recopie progressive des fichiers Convex vers R2.
 *
 * Migration par lots plutôt qu'en une passe : une action a un temps
 * d'exécution borné, et une bascule massive qui échoue au milieu laisserait la
 * base dans un état à moitié migré sans savoir où reprendre. Ici chaque fichier
 * est indépendant — l'interruption ne coûte que le lot en cours.
 *
 * À lancer depuis le tableau de bord Convex une fois les variables R2_*
 * définies :
 *
 *     npx convex run storage/migrate:run '{"batchSize": 20}'
 *
 * Relancer autant de fois que nécessaire ; la fonction renvoie le nombre de
 * fichiers restants.
 */

const r2 = new R2(components.r2);

export const listConvexFiles = internalQuery({
  args: { batchSize: v.number() },
  handler: async (ctx, { batchSize }) => {
    const files = await ctx.db.query("files").take(500);
    return files
      .filter((f) => f.storageProvider === "convex" && f.storageId)
      .slice(0, batchSize)
      .map((f) => ({ id: f._id, storageId: f.storageId!, mimeType: f.mimeType }));
  },
});

export const countRemaining = internalQuery({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("files").take(1000);
    return files.filter((f) => f.storageProvider === "convex").length;
  },
});

export const markMigrated = internalMutation({
  args: { fileId: v.id("files"), storageKey: v.string() },
  handler: async (ctx, { fileId, storageKey }) => {
    const file = await ctx.db.get(fileId);
    if (!file) return;

    await ctx.db.patch(fileId, {
      storageProvider: "r2",
      storageKey,
      storageId: undefined,
    });

    // L'objet Convex n'est supprimé qu'après le basculement du document : dans
    // l'ordre inverse, une panne entre les deux laisserait une ligne qui pointe
    // vers un fichier disparu.
    if (file.storageId) await ctx.storage.delete(file.storageId);
  },
});

export const run = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize }): Promise<{ migrated: number; remaining: number }> => {
    const files: { id: Id<"files">; storageId: Id<"_storage">; mimeType: string }[] =
      await ctx.runQuery(internal.storage.migrate.listConvexFiles, {
        batchSize: batchSize ?? 20,
      });

    let migrated = 0;
    for (const file of files) {
      try {
        const blob = await ctx.storage.get(file.storageId);
        if (!blob) {
          console.warn(`[migration] objet introuvable pour ${file.id}`);
          continue;
        }
        const key = await r2.store(ctx, blob, { type: file.mimeType });
        await ctx.runMutation(internal.storage.migrate.markMigrated, {
          fileId: file.id,
          storageKey: key,
        });
        migrated += 1;
      } catch (error) {
        // Un fichier qui échoue ne bloque pas les autres : il restera en
        // `convex` et sera repris au prochain passage.
        console.error(`[migration] échec sur ${file.id}`, error);
      }
    }

    const remaining: number = await ctx.runQuery(
      internal.storage.migrate.countRemaining,
      {},
    );
    return { migrated, remaining };
  },
});
