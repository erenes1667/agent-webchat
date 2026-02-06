import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("squadChat")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

export const create = mutation({
  args: {
    fromAgentId: v.id("agents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("squadChat", {
      fromAgentId: args.fromAgentId,
      content: args.content,
      createdAt: now,
    });

    const fromAgent = await ctx.db.get(args.fromAgentId);
    const fromName = fromAgent?.name ?? "Unknown";

    // Parse @mentions and create notifications
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(args.content)) !== null) {
      mentions.push(match[1].toLowerCase());
    }

    if (mentions.length > 0) {
      const allAgents = await ctx.db.query("agents").collect();

      for (const mentionName of mentions) {
        if (mentionName === "all" || mentionName === "everyone") {
          // Notify ALL agents except the sender
          for (const agent of allAgents) {
            if (agent._id !== args.fromAgentId) {
              await ctx.db.insert("notifications", {
                mentionedAgentId: agent._id,
                fromAgentId: args.fromAgentId,
                content: `${fromName} in squad chat: ${args.content.substring(0, 200)}`,
                delivered: false,
                priority: "high",
                createdAt: now,
              });
            }
          }
        } else {
          // Find specific agent
          const mentionedAgent = allAgents.find(
            (a) => a.name.toLowerCase() === mentionName ||
                   a.sessionKey.split(":")[1]?.toLowerCase() === mentionName
          );
          if (mentionedAgent && mentionedAgent._id !== args.fromAgentId) {
            await ctx.db.insert("notifications", {
              mentionedAgentId: mentionedAgent._id,
              fromAgentId: args.fromAgentId,
              content: `${fromName} mentioned you in squad chat: ${args.content.substring(0, 200)}`,
              delivered: false,
              priority: "normal",
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
      message: `${fromName} posted in squad chat`,
      createdAt: now,
    });

    return id;
  },
});
