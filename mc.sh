#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# mc.sh - Mission Control CLI wrapper
# Usage: mc <command> [args...]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

MC_DIR="${MC_DIR:-$HOME/.openclaw/workspace/mission-control}"

run() {
  cd "$MC_DIR" && npx convex run "$@" 2>/dev/null
}

case "${1:-help}" in
  # ─── Tasks ──────────────────────────────────────────────
  task:create)
    run tasks:create "{\"title\":\"$2\",\"description\":\"${3:-}\",\"priority\":\"${4:-medium}\"}"
    ;;
  task:status)
    run tasks:changeStatus "{\"id\":\"$2\",\"status\":\"$3\"}"
    # Fire event
    run taskEvents:onStatusChange "{\"taskId\":\"$2\",\"oldStatus\":\"unknown\",\"newStatus\":\"$3\"}"
    ;;
  task:assign)
    run tasks:assign "{\"id\":\"$2\",\"assigneeIds\":[\"$3\"]}"
    ;;
  task:list)
    run tasks:list "${2:+{\"status\":\"$2\"}}" 
    ;;
  task:list:all)
    run tasks:list '{}'
    ;;

  # ─── Squad Chat (Broadcast Channel) ────────────────────
  chat:send)
    run squadChat:create "{\"fromAgentId\":\"$2\",\"content\":\"$3\"}"
    ;;
  chat:list)
    run squadChat:list "{\"limit\":${2:-20}}"
    ;;

  # ─── Broadcast (High Priority to All) ──────────────────
  broadcast)
    run broadcast:send "{\"fromAgentId\":\"$2\",\"message\":\"$3\"}"
    ;;

  # ─── Notifications ─────────────────────────────────────
  notif:list)
    run notifications:listUndelivered "{\"agentId\":\"$2\"}"
    ;;
  notif:clear)
    run taskEvents:clearNotifications "{\"agentId\":\"$2\"}"
    ;;

  # ─── Agent Briefing (Wake-Up Context) ──────────────────
  briefing)
    run taskEvents:getAgentBriefing "{\"agentId\":\"$2\"}"
    ;;

  # ─── Agents ────────────────────────────────────────────
  agents)
    run agents:list '{}'
    ;;
  agent:heartbeat)
    run agents:updateHeartbeat "{\"id\":\"$2\"}"
    ;;

  # ─── Activity Feed ─────────────────────────────────────
  activity)
    run activities:list "{\"limit\":${2:-20}}"
    ;;

  help|*)
    cat << 'HELP'
Mission Control CLI

Tasks:
  mc task:create "title" "description" [priority]
  mc task:status <taskId> <status>
  mc task:assign <taskId> <agentId>
  mc task:list [status]
  mc task:list:all

Squad Chat:
  mc chat:send <agentId> "message"
  mc chat:list [limit]

Broadcast:
  mc broadcast <agentId> "message"

Notifications:
  mc notif:list <agentId>
  mc notif:clear <agentId>

Briefing:
  mc briefing <agentId>

Agents:
  mc agents
  mc agent:heartbeat <agentId>

Activity:
  mc activity [limit]
HELP
    ;;
esac
