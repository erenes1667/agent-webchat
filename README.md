# 🤖 Agent Webchat

A fully-featured, custom webchat UI for AI agents running on [OpenClaw](https://openclaw.ai). One command, fully interactive setup, zero config files to edit manually.

Built for people who want their AI agent to feel like *someone*, not something.

<p align="center">
  <img src="https://img.shields.io/badge/OpenClaw-compatible-purple?style=flat-square" />
  <img src="https://img.shields.io/badge/setup-one%20command-green?style=flat-square" />
  <img src="https://img.shields.io/badge/dependencies-Node.js%20only-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-gray?style=flat-square" />
</p>

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/erenes1667/agent-webchat/main/install.sh | bash
```

That's it. The script walks you through everything interactively.

**Or clone and run:**

```bash
git clone https://github.com/erenes1667/agent-webchat.git
cd agent-webchat
./setup.sh
```

---

## What You Get

### 🎨 Custom Webchat UI
A single-file, zero-dependency webchat interface with:

- **Animated pixel mascot** - 32x16 LED-style face with 5 mood states, petting mechanics, sentiment reactions, and a hidden tsundere easter egg
- **Multi-session management** - Main session + side chats + background agent sessions, all in a clean sidebar
- **Real-time streaming** - Watch your agent think and respond character by character
- **Collapsible blocks** - Thinking (yellow), tool calls (purple), and results (green) collapse into clean summaries
- **Message queue** - Send multiple messages while the agent is still processing
- **AI-powered polish** - Rewrite your messages with one click (uses Groq, free tier)
- **File uploads** - Drag & drop images, docs, zip files directly into chat
- **Archive system** - Archive, restore, and bulk-manage chat sessions
- **Fullscreen composer** - ⌘E for a distraction-free writing mode
- **Dark theme** - Beautiful purple-accented dark UI, fully customizable accent color
- **Keyboard shortcuts** - ⌘1-9 for sessions, Enter to send, ⌘E for composer

### 🧠 Agent Personality System
A complete framework for giving your AI agent a persistent identity:

- **SOUL.md** - Core personality, communication style, boundaries
- **IDENTITY.md** - Name, emoji, vibe, visual identity
- **MEMORY.md** - Long-term curated memory that persists across sessions
- **Daily notes** - Raw session logs in `memory/YYYY-MM-DD.md`
- **Project memory** - Dedicated docs for ongoing work in `memory/projects/`
- **Heartbeat system** - Periodic proactive checks (email, calendar, etc.)

### 👥 Agent Team Architecture
A multi-agent hierarchy for complex work:

- **Main Agent** - Your primary AI personality, the one you talk to
- **Overseer** - Coordinator that breaks down tasks and delegates to specialists
- **Specialists** - Researcher, Builder, Ops agents that handle specific domains
- Each agent has its own `ROLE.md`, scratchpad, and working directory

### 📋 Mission Control (Optional)
A task tracking system for agent coordination:

- Convex-powered real-time backend
- Task lifecycle: inbox → assigned → in_progress → review → done
- Agent @mentions and message threads
- CLI integration for agents to create/update tasks programmatically

---

## Prerequisites

- **Node.js** 18+ ([install](https://nodejs.org))
- **OpenClaw** gateway running ([install](https://openclaw.ai))

That's it. No Python, no Docker, no build tools.

---

## Interactive Setup

The installer asks you 7 questions:

| Question | Example | Default |
|----------|---------|---------|
| Agent name | Atlas, Nova, Echo | - |
| Agent emoji | 🦊, 🤖, 🐭 | - |
| Personality vibe | Sharp & casual, Warm & helpful, etc. | - |
| Accent color | #60a5fa, #c084fc | #c084fc |
| Gateway port | 18789 | 18789 |
| Gateway token | (from your OpenClaw config) | - |
| Install directory | ./my-agent | ./agent-webchat |

Then it generates **16 files** in ~2 seconds:

```
your-agent/
├── webchat/
│   ├── index.html              # Full webchat UI (2300+ lines)
│   └── upload-server.js        # File upload handler
├── agents/
│   ├── TEAM.md                 # Agent team registry
│   └── overseer/
│       ├── ROLE.md             # Overseer role definition
│       └── SCRATCHPAD.md       # Working notes
├── memory/
│   ├── projects/               # Project-specific docs
│   └── heartbeat-state.json    # Heartbeat tracking
├── SOUL.md                     # Agent personality
├── IDENTITY.md                 # Agent identity (your choices)
├── AGENTS.md                   # Operating instructions
├── USER.md                     # User profile (you fill this in)
├── MEMORY.md                   # Long-term memory
├── HEARTBEAT.md                # Heartbeat config
├── start.sh                    # Start all services
└── stop.sh                     # Stop all services
```

---

## Usage

### Start

```bash
cd your-agent
./start.sh
```

Opens webchat at `http://localhost:8001` and upload server at `http://localhost:8002`.

### Stop

```bash
./stop.sh
```

### Day-to-day

- Open `http://localhost:8001` in your browser
- Chat with your agent in the main session
- Create side chats with the **+ New Chat** button
- Background agent sessions appear automatically in the sidebar
- Pet the pixel face when you're bored (try petting for 3+ seconds...)

---

## Customization

### Change personality
Edit `SOUL.md`. This is the core of who your agent is. Make it yours.

### Change appearance
Edit `webchat/index.html` and modify the CSS variables at the top:

```css
:root {
  --accent: #c084fc;        /* Main accent color */
  --accent-bright: #d8b4fe; /* Lighter variant */
  --accent-dim: #7c3aed;    /* Darker variant */
  --bg-primary: #08080c;    /* Background */
}
```

### Enable Polish feature
Get a free API key from [Groq](https://console.groq.com) and add it to the `GROQ_KEY` variable in `index.html`.

### Add team members
Create new folders in `agents/` with a `ROLE.md` defining the agent's specialty, then register them in `agents/TEAM.md`.

### Configure heartbeats
Add periodic check tasks to `HEARTBEAT.md`:

```markdown
- Check email for urgent messages
- Review calendar for upcoming events
- Check project status
```

---

## Architecture

```
Browser (localhost:8001)
    │
    │ WebSocket (protocol v3)
    │
    ▼
OpenClaw Gateway (localhost:18789)
    │
    ├── Main Agent Session
    │   ├── SOUL.md (personality)
    │   ├── MEMORY.md (long-term)
    │   └── memory/ (daily notes)
    │
    ├── Subagent Sessions (spawned on demand)
    │   ├── Overseer (coordination)
    │   ├── Researcher (web search, analysis)
    │   └── Builder (code, files, deployment)
    │
    └── Upload Server (localhost:8002)
        └── File handling for chat attachments
```

---

## WebSocket Protocol

The webchat communicates with OpenClaw using Protocol v3:

```json
// Connect (authenticate)
{
  "type": "req",
  "id": "uuid",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": { "id": "webchat-ui", "displayName": "Agent Name", "version": "2.0.0" },
    "auth": { "token": "your-token" }
  }
}

// Send message
{
  "type": "req",
  "id": "uuid",
  "method": "chat.send",
  "params": { "text": "Hello!", "sessionKey": "agent:main:main" }
}

// Receive streaming response
{
  "type": "event",
  "event": "chat",
  "payload": { "state": "delta", "message": {...}, "sessionKey": "agent:main:main" }
}
```

---

## FAQ

**Q: Do I need OpenClaw installed?**
Yes. The webchat is a frontend for OpenClaw's gateway. Install it from [openclaw.ai](https://openclaw.ai).

**Q: Can I use this with other AI backends?**
Not directly. It speaks OpenClaw's WebSocket protocol. You'd need to adapt the connection layer.

**Q: Is my data sent anywhere?**
No. Everything runs locally. The webchat connects to your local OpenClaw gateway. The only external call is to Groq for the optional polish feature.

**Q: Can I host this publicly?**
You could, but the gateway token would need to be secured. It's designed for local use.

**Q: How do I update my agent's memory?**
Edit `MEMORY.md` directly, or let your agent do it (it's configured to maintain its own memory files).

---

## Detailed Guide

For a deep technical breakdown of every component (2500 lines of documentation), see [GUIDE.md](./GUIDE.md).

---

## Credits

Built for the [OpenClaw](https://openclaw.ai) ecosystem. Uses [Groq](https://groq.com) for the optional polish feature.

## License

MIT
