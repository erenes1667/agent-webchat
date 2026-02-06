import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    fromAgentId: v.id("agents"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const fromAgent = await ctx.db.get(args.fromAgentId);
    const fromName = fromAgent?.name ?? "Unknown";

    // 1. Create activity entry
    await ctx.db.insert("activities", {
      type: "status_change",
      agentId: args.fromAgentId,
      message: `📢 ${fromName} broadcast: ${args.message}`,
      createdAt: now,
    });

    // 2. Create notification for EVERY agent (including sender for consistency)
    const allAgents = await ctx.db.query("agents").collect();
    for (const agent of allAgents) {
      await ctx.db.insert("notifications", {
        mentionedAgentId: agent._id,
        fromAgentId: args.fromAgentId,
        content: `📢 Broadcast from ${fromName}: ${args.message}`,
        delivered: false,
        priority: "high", // Broadcasts are high priority
        createdAt: now,
      });
    }

    // 3. Create squad chat message from sender
    await ctx.db.insert("squadChat", {
      fromAgentId: args.fromAgentId,
      content: `📢 BROADCAST: ${args.message}`,
      createdAt: now,
    });

    return { success: true, notifiedAgents: allAgents.length };
  },
});