import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
    currentTaskId: v.optional(v.id("tasks")),
    sessionKey: v.string(),
    level: v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead")),
    avatar: v.optional(v.string()),
    lastHeartbeat: v.optional(v.number()),
    group: v.optional(v.string()),
  })
    .index("by_sessionKey", ["sessionKey"])
    .index("by_status", ["status"])
    .index("by_group", ["group"]),

  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    ),
    assigneeIds: v.array(v.id("agents")),
    createdBy: v.optional(v.id("agents")),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))
    ),
    deliverableIds: v.optional(v.array(v.id("documents"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  messages: defineTable({
    taskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    content: v.string(),
    mentions: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_taskId", ["taskId", "createdAt"]),

  activities: defineTable({
    type: v.union(
      v.literal("task_created"),
      v.literal("task_updated"),
      v.literal("message_sent"),
      v.literal("document_created"),
      v.literal("agent_heartbeat"),
      v.literal("status_change")
    ),
    agentId: v.optional(v.id("agents")),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"]),

  documents: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_type", ["type"]),

  notifications: defineTable({
    mentionedAgentId: v.id("agents"),
    fromAgentId: v.optional(v.id("agents")),
    taskId: v.optional(v.id("tasks")),
    content: v.string(),
    delivered: v.boolean(),
    priority: v.optional(v.union(v.literal("normal"), v.literal("high"))),
    createdAt: v.number(),
  })
    .index("by_agent_delivered", ["mentionedAgentId", "delivered"])
    .index("by_createdAt", ["createdAt"]),

  squadChat: defineTable({
    fromAgentId: v.id("agents"),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"]),
});
