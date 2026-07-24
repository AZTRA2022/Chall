import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

/** Expo accepte 100 messages par requête d'envoi, 1000 ids par requête de receipts. */
const SEND_CHUNK = 100;
const RECEIPT_CHUNK = 300;

/** Les receipts ne sont disponibles qu'une fois la notif traitée par APNs/FCM. */
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  sound?: string; // iOS : nom de fichier (ex "notif_1.wav") ou "default"
  channelId?: string; // Android : canal (porte le son custom)
  data?: Record<string, unknown>;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoReceipt = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

type ExpoSendResponse = {
  data?: ExpoTicket[];
  errors?: { code?: string; message?: string }[];
};

type ExpoReceiptsResponse = {
  data?: Record<string, ExpoReceipt>;
  errors?: { code?: string; message?: string }[];
};

export type PushResult = {
  /** Tickets acceptés par Expo. Ce n'est PAS une preuve de livraison. */
  accepted: number;
  /** Messages refusés (token invalide, credentials manquantes, HTTP en erreur…). */
  failed: number;
  /** Messages d'erreur dédupliqués, pour le debug. */
  errors: string[];
};

/** Tokens push d'un user. */
export const getUserPushTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const docs = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return docs.map((d) => d.token);
  },
});

/** Retire des tokens morts (DeviceNotRegistered). */
export const dropTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, { tokens }) => {
    for (const token of tokens) {
      const doc = await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (doc) await ctx.db.delete(doc._id);
    }
  },
});

/**
 * Migration one-shot : recopie `users.pushTokens` (déprécié) dans la table
 * `pushTokens`. Idempotent — les devices se réenregistrent seuls ensuite.
 */
export const migrateLegacyPushTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const now = Date.now();
    let migrated = 0;

    for (const user of users) {
      for (const token of user.pushTokens ?? []) {
        const existing = await ctx.db
          .query("pushTokens")
          .withIndex("by_token", (q) => q.eq("token", token))
          .unique();
        if (existing) continue;
        await ctx.db.insert("pushTokens", {
          userId: user._id,
          token,
          createdAt: now,
          lastSeenAt: now,
        });
        migrated += 1;
      }
    }

    return { migrated };
  },
});

function describeErrors(errors?: { code?: string; message?: string }[]): string | null {
  if (!errors || errors.length === 0) return null;
  return errors.map((e) => [e.code, e.message].filter(Boolean).join(": ")).join(" | ");
}

/**
 * Envoie les messages par lots et retourne UN ticket par message, dans le même
 * ordre. Un lot qui échoue produit des tickets `error` synthétiques : l'appelant
 * peut donc toujours faire correspondre `tickets[i]` à `messages[i]`.
 */
async function pushBatch(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = [];

  for (let i = 0; i < messages.length; i += SEND_CHUNK) {
    const chunk = messages.slice(i, i + SEND_CHUNK);
    let failure: string | null = null;
    let data: ExpoTicket[] | undefined;

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const raw = await res.text();
      let json: ExpoSendResponse | null = null;
      try {
        json = raw ? (JSON.parse(raw) as ExpoSendResponse) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        failure =
          describeErrors(json?.errors) ?? `HTTP ${res.status} ${raw.slice(0, 300)}`;
      } else if (!json?.data) {
        failure = describeErrors(json?.errors) ?? `Réponse Expo sans "data": ${raw.slice(0, 300)}`;
      } else if (json.data.length !== chunk.length) {
        // Sans correspondance 1:1 on ne peut plus savoir quel ticket va avec
        // quel token — on invalide le lot au lieu de supprimer les mauvais tokens.
        failure = `Expo a renvoyé ${json.data.length} tickets pour ${chunk.length} messages`;
      } else {
        data = json.data;
      }
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }

    if (data) {
      tickets.push(...data);
    } else {
      const message = failure ?? "Erreur inconnue";
      tickets.push(...chunk.map(() => ({ status: "error" as const, message })));
    }
  }

  return tickets;
}

/**
 * Envoie une push à TOUS les devices d'un user.
 * Interne : appelé depuis une mutation serveur (ex: quelqu'un lance un défi)
 * via `ctx.scheduler.runAfter(0, internal.push.sendToUser, {...})`.
 */
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.optional(v.string()),
    sound: v.optional(v.string()),
    channelId: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (
    ctx,
    { userId, title, body, sound, channelId, data },
  ): Promise<PushResult> => {
    const tokens: string[] = await ctx.runQuery(internal.push.getUserPushTokens, {
      userId,
    });
    if (tokens.length === 0) {
      return { accepted: 0, failed: 0, errors: ["Aucun token push pour ce user"] };
    }

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      title,
      body,
      sound: sound ?? "default",
      channelId: channelId ?? "default",
      data,
    }));

    const tickets = await pushBatch(messages);

    const dead: string[] = [];
    const errors = new Set<string>();
    const pending: { ticketId: string; token: string }[] = [];
    let accepted = 0;

    tickets.forEach((ticket, idx) => {
      const token = tokens[idx];
      if (ticket.status === "ok") {
        accepted += 1;
        if (ticket.id) pending.push({ ticketId: ticket.id, token });
        return;
      }
      if (ticket.details?.error === "DeviceNotRegistered") dead.push(token);
      errors.add(ticket.message ?? ticket.details?.error ?? "Erreur Expo inconnue");
    });

    if (dead.length > 0) {
      await ctx.runMutation(internal.push.dropTokens, { tokens: dead });
    }

    // Les erreurs de livraison (dont la majorité des DeviceNotRegistered)
    // n'apparaissent que dans les receipts, plus tard.
    if (pending.length > 0) {
      await ctx.scheduler.runAfter(RECEIPT_DELAY_MS, internal.push.checkReceipts, {
        entries: pending,
      });
    }

    const failed = tickets.length - accepted;
    if (failed > 0) {
      console.error(
        `[push] ${failed}/${tickets.length} message(s) refusé(s) pour ${userId}: ${[...errors].join(" | ")}`,
      );
    }

    return { accepted, failed, errors: [...errors] };
  },
});

/**
 * Relit les receipts d'un envoi et supprime les tokens dont l'appareil a
 * désinstallé l'app. Planifié par `sendToUser`.
 */
export const checkReceipts = internalAction({
  args: {
    entries: v.array(v.object({ ticketId: v.string(), token: v.string() })),
  },
  handler: async (ctx, { entries }) => {
    const tokenByTicket = new Map(entries.map((e) => [e.ticketId, e.token]));
    const dead: string[] = [];

    for (let i = 0; i < entries.length; i += RECEIPT_CHUNK) {
      const ids = entries.slice(i, i + RECEIPT_CHUNK).map((e) => e.ticketId);

      try {
        const res = await fetch(EXPO_RECEIPTS_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });

        const raw = await res.text();
        if (!res.ok) {
          console.error(`[push] receipts HTTP ${res.status}: ${raw.slice(0, 300)}`);
          continue;
        }

        const json = JSON.parse(raw) as ExpoReceiptsResponse;
        const described = describeErrors(json.errors);
        if (described) console.error(`[push] receipts: ${described}`);

        for (const [ticketId, receipt] of Object.entries(json.data ?? {})) {
          if (receipt.status === "ok") continue;
          const token = tokenByTicket.get(ticketId);
          if (receipt.details?.error === "DeviceNotRegistered" && token) {
            dead.push(token);
          } else {
            console.error(
              `[push] receipt ${ticketId} en erreur: ${receipt.details?.error ?? ""} ${receipt.message ?? ""}`,
            );
          }
        }
      } catch (e) {
        console.error(`[push] receipts: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (dead.length > 0) {
      await ctx.runMutation(internal.push.dropTokens, { tokens: dead });
    }
  },
});

/**
 * Test : envoie une push à soi-même (user connecté).
 * Throw si Expo refuse le message, pour que l'échec soit visible côté client.
 */
export const testPushToSelf = action({
  args: {
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    sound: v.optional(v.string()),
    channelId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PushResult> => {
    const user = await ctx.runQuery(api.users.getCurrentAppUser, {});
    if (!user) throw new Error("Not authenticated");

    const res: PushResult = await ctx.runAction(internal.push.sendToUser, {
      userId: user._id,
      title: args.title ?? "Chall",
      body: args.body ?? "Test push ✅",
      sound: args.sound ?? "default",
      channelId: args.channelId ?? "default",
    });

    if (res.accepted === 0) {
      throw new Error(
        `Aucune push envoyée (${res.failed} échec(s)) : ${res.errors.join(" | ")}`,
      );
    }

    return res;
  },
});
