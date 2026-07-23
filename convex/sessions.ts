import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { disciplineValidator } from "./disciplines";
import { getAuthedUser } from "./users";

export const create = mutation({
  args: {
    discipline: disciplineValidator,
    repCount: v.number(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, { discipline, repCount, durationMs }) => {
    const user = await getAuthedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const sessionId = await ctx.db.insert("sessions", {
      userId: user._id,
      discipline,
      repCount,
      durationMs,
      createdAt: Date.now(),
    });

    const existingRecord = await ctx.db
      .query("personalRecords")
      .withIndex("by_user_discipline", (q) =>
        q.eq("userId", user._id).eq("discipline", discipline),
      )
      .unique();

    if (!existingRecord) {
      await ctx.db.insert("personalRecords", {
        userId: user._id,
        discipline,
        bestRepCount: repCount,
        sessionId,
        achievedAt: Date.now(),
      });
    } else if (repCount > existingRecord.bestRepCount) {
      await ctx.db.patch(existingRecord._id, {
        bestRepCount: repCount,
        sessionId,
        achievedAt: Date.now(),
      });
    }

    return sessionId;
  },
});

export const myHistory = query({
  args: { discipline: v.optional(disciplineValidator) },
  handler: async (ctx, { discipline }) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    if (discipline) {
      return ctx.db
        .query("sessions")
        .withIndex("by_user_discipline", (q) =>
          q.eq("userId", user._id).eq("discipline", discipline),
        )
        .order("desc")
        .collect();
    }

    return ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});
