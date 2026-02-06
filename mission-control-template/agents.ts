import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySessionKey = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
    sessionKey: v.string(),
    level: v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead")),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("agents", {
      ...args,
      lastHeartbeat: Date.now(),
    });
    return id;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
    currentTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) throw new Error("Agent not found");

    await ctx.db.patch(args.id, {
      status: args.status,
      currentTaskId: args.currentTaskId,
    });

    await ctx.db.insert("activities", {
      type: "status_change",
      agentId: args.id,
      message: `${agent.name} is now ${args.status}`,
      createdAt: Date.now(),
    });
  },
});

export const updateHeartbeat = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastHeartbeat: Date.now(),
    });
  },
});
