import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listUndelivered = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_agent_delivered", (q) =>
        q.eq("mentionedAgentId", args.agentId).eq("delivered", false)
      )
      .collect();
  },
});

export const markDelivered = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { delivered: true });
  },
});

export const create = mutation({
  args: {
    mentionedAgentId: v.id("agents"),
    fromAgentId: v.optional(v.id("agents")),
    taskId: v.optional(v.id("tasks")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      ...args,
      delivered: false,
      createdAt: Date.now(),
    });
  },
});
