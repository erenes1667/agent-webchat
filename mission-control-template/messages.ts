import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const getCountsByTasks = query({
  args: { taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    
    for (const taskId of args.taskIds) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect();
      counts[taskId] = messages.length;
    }
    
    return counts;
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Parse @mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(args.content)) !== null) {
      mentions.push(`@${match[1]}`);
    }

    const now = Date.now();
    const id = await ctx.db.insert("messages", {
      taskId: args.taskId,
      fromAgentId: args.fromAgentId,
      content: args.content,
      mentions: mentions.length > 0 ? mentions : undefined,
      createdAt: now,
    });

    const fromAgent = await ctx.db.get(args.fromAgentId);
    const fromName = fromAgent?.name ?? "Unknown";

    // Create notifications for @mentioned agents
    if (mentions.length > 0) {
      const allAgents = await ctx.db.query("agents").collect();
      
      for (const mention of mentions) {
        const mentionName = mention.slice(1); // Remove @
        
        if (mentionName === "all") {
          // Notify all agents except the sender
          for (const agent of allAgents) {
            if (agent._id !== args.fromAgentId) {
              await ctx.db.insert("notifications", {
                mentionedAgentId: agent._id,
                fromAgentId: args.fromAgentId,
                taskId: args.taskId,
                content: `${fromName} mentioned @all: ${args.content.substring(0, 100)}`,
                delivered: false,
                priority: "normal",
                createdAt: now,
              });
            }
          }
        } else {
          // Find agent by name (case-insensitive)
          const mentionedAgent = allAgents.find(
            (a) => a.name.toLowerCase() === mentionName.toLowerCase()
          );
          if (mentionedAgent && mentionedAgent._id !== args.fromAgentId) {
            // Lead agents get high-priority notifications
            const isHighPriority = allAgents.some(a => 
              a.name.toLowerCase() === mentionName.toLowerCase() && a.level === "lead"
            );
            
            await ctx.db.insert("notifications", {
              mentionedAgentId: mentionedAgent._id,
              fromAgentId: args.fromAgentId,
              taskId: args.taskId,
              content: `${fromName} mentioned you: ${args.content.substring(0, 100)}`,
              delivered: false,
              priority: isHighPriority ? "high" : "normal",
              createdAt: now,
            });
          }
        }
      }
    }

    // Log activity
    await ctx.db.insert("activities", {
      type: "message_sent",
      agentId: args.fromAgentId,
      taskId: args.taskId,
      message: `${fromName} commented on a task`,
      createdAt: now,
    });

    return id;
  },
});
