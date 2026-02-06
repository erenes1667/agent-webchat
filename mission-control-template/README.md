# Mission Control - Agent Coordination System

A real-time task tracking and agent communication backend powered by [Convex](https://convex.dev).

## What This Does

Mission Control is the shared brain for your agent team:

- **Task Board**: Create, assign, and track tasks through a lifecycle (inbox → assigned → in_progress → review → done)
- **Squad Chat**: A shared communication channel between all agents (like their own Slack)
- **Broadcast System**: High-priority messages that notify every agent
- **Event Bus**: Automatic notifications when tasks change status
- **Agent Briefings**: A single query that gives any agent their full context on wake-up
- **QA Triggers**: Nagger/QA agents get auto-notified when tasks move to review/done

## Architecture

```
Task Created ──→ Overseer gets notified (triage)
                 Squad Chat gets broadcast
                 Activity log updated

Task Status Change ──→ Overseer gets update
                       Assignees get notified
                       If review/done → QA agent notified
                       Squad Chat gets broadcast

Agent Wakes Up ──→ Reads briefing (notifications + chat + tasks)
                   Processes work
                   Posts to squad chat
                   Clears notifications
```

## Setup

1. Create a free [Convex](https://convex.dev) account
2. `npx convex init` in this directory
3. `npx convex dev --once` to deploy the functions
4. Use the CLI wrapper `mc.sh` (at the project root) to interact

## Schema

- **agents** - Agent registry (name, role, status, level)
- **tasks** - Task tracking (title, status, assignees, priority, deliverables)
- **messages** - Task comments with @mention support
- **squadChat** - Shared communication channel (the "agent Slack")
- **notifications** - Per-agent notification queue (auto-cleared after reading)
- **activities** - Full audit log of everything that happens
- **documents** - Deliverables and research docs

## Key Functions

### Task Events (the event bus)
```bash
# Auto-notify agents when task is created
npx convex run taskEvents:onTaskCreated '{"taskId":"..."}'

# Auto-notify on status change (Overseer, Nagger, assignees)
npx convex run taskEvents:onStatusChange '{"taskId":"...","oldStatus":"inbox","newStatus":"in_progress"}'

# Get full briefing for an agent (notifications + chat + tasks)
npx convex run taskEvents:getAgentBriefing '{"agentId":"..."}'

# Clear notifications after reading
npx convex run taskEvents:clearNotifications '{"agentId":"..."}'
```

### Squad Chat
```bash
# Post to shared channel
npx convex run squadChat:create '{"fromAgentId":"...","content":"Update: finished the analysis"}'

# @mention support - use @agentname or @all
npx convex run squadChat:create '{"fromAgentId":"...","content":"@Forge can you review this PR?"}'

# Read recent messages
npx convex run squadChat:list '{"limit":20}'
```

### Broadcasts
```bash
# High-priority message to ALL agents
npx convex run broadcast:send '{"fromAgentId":"...","message":"Critical: API is down"}'
```

## Cost Efficiency

The system is designed to be cheap:

- **Overseer checks**: Runs every 30 min via cron, uses Sonnet (cheap model). Only processes if there are new notifications.
- **Nagger QA**: Runs every hour, Sonnet. Only fires when tasks move to review/done.
- **Specialists**: Never idle. Only spawned by Overseer when needed.
- **Briefings**: Single query, no extra API calls. Just context injection.
- **Squad Chat**: Async messages stored in DB. Agents read when they wake up, not in real-time.

Typical cost: ~$0.01-0.05 per monitoring cycle (Sonnet reads a small briefing, decides if action needed).
