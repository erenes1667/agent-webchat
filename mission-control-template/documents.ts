import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("documents").collect();
  },
});

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("note")
    ),
    taskId: v.optional(v.id("tasks")),
    createdBy: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("documents", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    let agentName = "Someone";
    if (args.createdBy) {
      const agent = await ctx.db.get(args.createdBy);
      if (agent) agentName = agent.name;
    }

    await ctx.db.insert("activities", {
      type: "document_created",
      agentId: args.createdBy,
      taskId: args.taskId,
      message: `${agentName} created document: ${args.title}`,
      createdAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});
