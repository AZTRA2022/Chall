import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    avatarUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    dataCollectionConsent: v.boolean(),
    /** @deprecated remplacé par la table `pushTokens`. Gardé pour les docs existants. */
    pushTokens: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]),

  // Un doc par device. Indexé par token pour qu'un device qui change de compte
  // soit réattribué au lieu d'être présent chez deux users à la fois.
  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),
});
