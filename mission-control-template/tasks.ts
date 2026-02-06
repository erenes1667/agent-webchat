import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("inbox"),
        v.literal("assigned"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done"),
        v.literal("blocked")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("tasks").collect();
  },
});

export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))
    ),
    createdBy: v.optional(v.id("agents")),
    assigneeIds: v.optional(v.array(v.id("agents"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.assigneeIds && args.assigneeIds.length > 0 ? "assigned" : "inbox",
      assigneeIds: args.assigneeIds ?? [],
      createdBy: args.createdBy,
      priority: args.priority,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    let agentName = "Someone";
    if (args.createdBy) {
      const agent = await ctx.db.get(args.createdBy);
      if (agent) agentName = agent.name;
    }

    await ctx.db.insert("activities", {
      type: "task_created",
      agentId: args.createdBy,
      taskId: id,
      message: `${agentName} created task: ${args.title}`,
      createdAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activities", {
      type: "task_updated",
      taskId: id,
      message: `Task updated: ${task.title}`,
      createdAt: Date.now(),
    });
  },
});

export const assign = mutation({
  args: {
    id: v.id("tasks"),
    assigneeIds: v.array(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    const newStatus = args.assigneeIds.length > 0
      ? (task.status === "inbox" ? "assigned" : task.status)
      : task.status;

    await ctx.db.patch(args.id, {
      assigneeIds: args.assigneeIds,
      status: newStatus,
      updatedAt: Date.now(),
    });

    // Get assignee names for activity log
    const names: string[] = [];
    for (const agentId of args.assigneeIds) {
      const agent = await ctx.db.get(agentId);
      if (agent) names.push(agent.name);
    }

    await ctx.db.insert("activities", {
      type: "task_updated",
      taskId: args.id,
      message: `Task "${task.title}" assigned to ${names.join(", ") || "nobody"}`,
      createdAt: Date.now(),
    });
  },
});

export const linkDeliverable = mutation({
  args: {
    taskId: v.id("tasks"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const currentDeliverables = task.deliverableIds ?? [];
    if (!currentDeliverables.includes(args.documentId)) {
      await ctx.db.patch(args.taskId, {
        deliverableIds: [...currentDeliverables, args.documentId],
        updatedAt: Date.now(),
      });

      const document = await ctx.db.get(args.documentId);
      await ctx.db.insert("activities", {
        type: "document_created",
        taskId: args.taskId,
        message: `Deliverable linked: ${document?.title || "Document"}`,
        createdAt: Date.now(),
      });
    }
  },
});

export const unlinkDeliverable = mutation({
  args: {
    taskId: v.id("tasks"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const currentDeliverables = task.deliverableIds ?? [];
    await ctx.db.patch(args.taskId, {
      deliverableIds: currentDeliverables.filter(id => id !== args.documentId),
      updatedAt: Date.now(),
    });

    const document = await ctx.db.get(args.documentId);
    await ctx.db.insert("activities", {
      type: "task_updated",
      taskId: args.taskId,
      message: `Deliverable unlinked: ${document?.title || "Document"}`,
      createdAt: Date.now(),
    });
  },
});

export const createFromChat = mutation({
  args: {
    squadChatId: v.id("squadChat"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))
    ),
    createdBy: v.id("agents"),
    assigneeIds: v.optional(v.array(v.id("agents"))),
  },
  handler: async (ctx, args) => {
    const chatMessage = await ctx.db.get(args.squadChatId);
    if (!chatMessage) throw new Error("Squad chat message not found");

    const now = Date.now();
    
    // Create the task with reference to the chat message
    const description = args.description || `Task created from squad chat insight: "${chatMessage.content}"`;
    
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: description,
      status: args.assigneeIds && args.assigneeIds.length > 0 ? "assigned" : "inbox",
      assigneeIds: args.assigneeIds ?? [],
      createdBy: args.createdBy,
      priority: args.priority,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    const creatorAgent = await ctx.db.get(args.createdBy);
    const creatorName = creatorAgent?.name ?? "Unknown";
    const originalAgent = await ctx.db.get(chatMessage.fromAgentId);
    const originalName = originalAgent?.name ?? "Unknown";

    await ctx.db.insert("activities", {
      type: "task_created",
      agentId: args.createdBy,
      taskId: taskId,
      message: `${creatorName} created task "${args.title}" from ${originalName}'s squad chat insight`,
      createdAt: now,
    });

    // Create a comment on the task linking back to the original insight
    await ctx.db.insert("messages", {
      taskId: taskId,
      fromAgentId: args.createdBy,
      content: `💡 Task created from squad chat insight by ${originalName}: "${chatMessage.content}"`,
      createdAt: now,
    });

    return taskId;
  },
});

export const changeStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    // If moving to "done", require at least one deliverable
    if (args.status === "done") {
      if (!task.deliverableIds || task.deliverableIds.length === 0) {
        throw new Error("Cannot mark task as done without deliverables. Please attach at least one document.");
      }
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activities", {
      type: "task_updated",
      taskId: args.id,
      message: `Task "${task.title}" moved to ${args.status}`,
      createdAt: Date.now(),
    });
  },
});
