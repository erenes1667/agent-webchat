import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════
// Task Events - Auto-notify agents when tasks change
// This is the "event bus" that makes the broadcast system work
// ═══════════════════════════════════════════════════════════════

// Called automatically when task status changes
// Notifies: assignees, Overseer (always), Nagger (on done/review)
export const onStatusChange = mutation({
  args: {
    taskId: v.id("tasks"),
    oldStatus: v.string(),
    newStatus: v.string(),
    changedBy: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    const now = Date.now();
    const allAgents = await ctx.db.query("agents").collect();
    
    // Find Overseer and Nagger by role/name (flexible matching)
    const overseer = allAgents.find(a => 
      a.role.toLowerCase().includes("overseer") || 
      a.role.toLowerCase().includes("coordinator")
    );
    const nagger = allAgents.find(a => 
      a.role.toLowerCase().includes("qa") || 
      a.name.toLowerCase().includes("nagger")
    );
    
    const changedByAgent = args.changedBy ? await ctx.db.get(args.changedBy) : null;
    const changedByName = changedByAgent?.name ?? "System";

    // 1. Always notify Overseer of any status change
    if (overseer && overseer._id !== args.changedBy) {
      await ctx.db.insert("notifications", {
        mentionedAgentId: overseer._id,
        fromAgentId: args.changedBy,
        taskId: args.taskId,
        content: `📋 Task "${task.title}" moved ${args.oldStatus} → ${args.newStatus} by ${changedByName}`,
        delivered: false,
        priority: "normal",
        createdAt: now,
      });
    }

    // 2. Notify Nagger on review/done (QA trigger)
    if (nagger && (args.newStatus === "review" || args.newStatus === "done")) {
      await ctx.db.insert("notifications", {
        mentionedAgentId: nagger._id,
        fromAgentId: args.changedBy,
        taskId: args.taskId,
        content: `🔍 QA needed: "${task.title}" is now ${args.newStatus}. Review the deliverables.`,
        delivered: false,
        priority: "high",
        createdAt: now,
      });
    }

    // 3. Notify all assignees (except the one who changed it)
    for (const assigneeId of task.assigneeIds) {
      if (assigneeId !== args.changedBy) {
        await ctx.db.insert("notifications", {
          mentionedAgentId: assigneeId,
          fromAgentId: args.changedBy,
          taskId: args.taskId,
          content: `📋 Task "${task.title}" you're assigned to moved to ${args.newStatus}`,
          delivered: false,
          priority: args.newStatus === "blocked" ? "high" : "normal",
          createdAt: now,
        });
      }
    }

    // 4. Broadcast to squad chat
    await ctx.db.insert("squadChat", {
      fromAgentId: args.changedBy ?? (overseer?._id ?? task.assigneeIds[0]),
      content: `📋 [TASK UPDATE] "${task.title}" → ${args.newStatus} (by ${changedByName})`,
      createdAt: now,
    });

    // 5. Log activity
    await ctx.db.insert("activities", {
      type: "status_change",
      agentId: args.changedBy,
      taskId: args.taskId,
      message: `Task "${task.title}" moved ${args.oldStatus} → ${args.newStatus} by ${changedByName}`,
      createdAt: now,
    });
  },
});

// Called when a new task is created
// Notifies Overseer to triage
export const onTaskCreated = mutation({
  args: {
    taskId: v.id("tasks"),
    createdBy: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    const now = Date.now();
    const allAgents = await ctx.db.query("agents").collect();
    const overseer = allAgents.find(a => 
      a.role.toLowerCase().includes("overseer") || 
      a.role.toLowerCase().includes("coordinator")
    );

    const createdByAgent = args.createdBy ? await ctx.db.get(args.createdBy) : null;
    const createdByName = createdByAgent?.name ?? "Human";

    // Notify Overseer of new task to triage
    if (overseer) {
      await ctx.db.insert("notifications", {
        mentionedAgentId: overseer._id,
        fromAgentId: args.createdBy,
        taskId: args.taskId,
        content: `🆕 New task to triage: "${task.title}" (${task.priority ?? "no priority"}) by ${createdByName}`,
        delivered: false,
        priority: task.priority === "urgent" ? "high" : "normal",
        createdAt: now,
      });
    }

    // Broadcast
    await ctx.db.insert("squadChat", {
      fromAgentId: args.createdBy ?? (overseer?._id ?? allAgents[0]._id),
      content: `🆕 [NEW TASK] "${task.title}" - ${task.priority ?? "normal"} priority (by ${createdByName})`,
      createdAt: now,
    });
  },
});

// Get a full briefing for an agent waking up
// Returns: undelivered notifications + recent squad chat + active tasks
export const getAgentBriefing = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    // 1. Undelivered notifications for this agent
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_agent_delivered", (q) =>
        q.eq("mentionedAgentId", args.agentId).eq("delivered", false)
      )
      .collect();

    // 2. Recent squad chat (last 20 messages)
    const recentChat = await ctx.db
      .query("squadChat")
      .withIndex("by_createdAt")
      .order("desc")
      .take(20);

    // 3. Active tasks (not done)
    const allTasks = await ctx.db.query("tasks").collect();
    const activeTasks = allTasks.filter(t => t.status !== "done");

    // 4. Tasks assigned to this agent
    const myTasks = allTasks.filter(t => t.assigneeIds.includes(args.agentId));

    // 5. Recent activity (last 10)
    const recentActivity = await ctx.db
      .query("activities")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);

    // 6. Get agent names for context
    const agents = await ctx.db.query("agents").collect();
    const agentNames: Record<string, string> = {};
    for (const a of agents) {
      agentNames[a._id] = a.name;
    }

    return {
      notifications,
      recentChat: recentChat.reverse(), // chronological order
      activeTasks,
      myTasks,
      recentActivity,
      agentNames,
    };
  },
});

// Mark all notifications as delivered for an agent (call after briefing is read)
export const clearNotifications = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_agent_delivered", (q) =>
        q.eq("mentionedAgentId", args.agentId).eq("delivered", false)
      )
      .collect();

    for (const n of notifications) {
      await ctx.db.patch(n._id, { delivered: true });
    }

    return { cleared: notifications.length };
  },
});
