import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { disciplineValidator } from "./disciplines";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    avatarUrl: v.optional(v.string()),
    dataCollectionConsent: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]),

  sessions: defineTable({
    userId: v.id("users"),
    discipline: disciplineValidator,
    repCount: v.number(),
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_discipline", ["userId", "discipline"])
    .index("by_discipline", ["discipline"]),

  personalRecords: defineTable({
    userId: v.id("users"),
    discipline: disciplineValidator,
    bestRepCount: v.number(),
    sessionId: v.id("sessions"),
    achievedAt: v.number(),
  })
    .index("by_user_discipline", ["userId", "discipline"])
    .index("by_discipline_count", ["discipline", "bestRepCount"]),

  movementCaptures: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    discipline: disciplineValidator,
    landmarksStorageId: v.id("_storage"),
    frameCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),
});
