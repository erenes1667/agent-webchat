# Building a Custom AI Agent Webchat System

## A Comprehensive Technical Guide

**Version:** 1.0 · **Last Updated:** 2026-02-06

This document is a complete blueprint for building a custom webchat interface for AI agents powered by the OpenClaw platform. It covers every layer of the system: the single-file frontend, the WebSocket protocol, the agent personality architecture, the multi-agent team hierarchy, the task coordination backend (Mission Control), and the memory/continuity system.

Anyone should be able to recreate this system from scratch using only this guide.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Webchat UI — Deep Technical](#2-webchat-ui--deep-technical)
   - [Architecture](#21-architecture)
   - [Design System](#22-design-system)
   - [WebSocket Protocol](#23-websocket-protocol)
   - [Session Management](#24-session-management)
   - [Message Flow & Queue System](#25-message-flow--queue-system)
   - [Message Rendering](#26-message-rendering)
   - [Pixel Face / Mascot](#27-pixel-face--mascot)
   - [Polish Feature](#28-polish-feature--ai-powered-rewriting)
   - [Fullscreen Composer](#29-fullscreen-composer)
   - [File Upload System](#210-file-upload-system)
   - [Keyboard Shortcuts](#211-keyboard-shortcuts)
   - [Settings](#212-settings)
   - [Archive System](#213-archive-system)
   - [Mission Control Integration](#214-mission-control-integration)
3. [Upload Server](#3-upload-server)
4. [Agent Architecture](#4-agent-architecture)
   - [Main Agent Personality](#41-main-agent-personality)
   - [Agent Team Hierarchy](#42-agent-team-hierarchy)
   - [Overseer Pattern](#43-the-overseer-pattern)
   - [Specialist Agents](#44-specialist-agents)
   - [Agent File Structure](#45-agent-file-structure)
   - [Subagent Sessions](#46-subagent-sessions)
   - [Model Assignment Policy](#47-model-assignment-policy)
5. [Mission Control](#5-mission-control)
   - [Purpose & Architecture](#51-purpose--architecture)
   - [Database Schema](#52-database-schema)
   - [Task Lifecycle](#53-task-lifecycle)
   - [CLI Integration](#54-cli-integration)
6. [Memory System](#6-memory-system)
   - [Daily Notes](#61-daily-notes)
   - [Long-term Memory](#62-long-term-memory)
   - [Project Memory](#63-project-memory)
   - [Heartbeat System](#64-heartbeat-system)
7. [How to Build This — Step by Step](#7-how-to-build-this--step-by-step)

---

## 1. System Overview

### What This Is

A fully custom webchat interface for interacting with AI agents running on the [OpenClaw](https://openclaw.dev) platform. Unlike generic chat UIs, this system is built with:

- **Personality**: An animated pixel-art mascot face with mood states, petting mechanics, and sentiment reactions
- **Multi-session management**: Switch between main conversations, side chats, and background agent sessions
- **Agent team orchestration**: A hierarchy of specialized AI agents coordinated through a central overseer
- **Task tracking**: A real-time task management backend (Mission Control) that agents use to coordinate
- **Persistent memory**: A file-based memory system that gives agents continuity across sessions

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    WEBCHAT UI                            │
│   Single HTML file · No build tools · No frameworks     │
│   Served via any static file server (e.g., localhost)   │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket (ws://localhost:18789)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  OPENCLAW GATEWAY                        │
│   Protocol v3 · Session management · Auth · Routing     │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐  ┌──────────────────────────────────┐
│   MAIN AGENT     │  │   SUBAGENT SESSIONS              │
│   (Primary AI)   │  │   Spawned for background work    │
│   SOUL.md driven │  │   Isolated context per task      │
└──────────────────┘  └──────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│              AGENT TEAM HIERARCHY                        │
│   Main Agent → Overseer → Specialist Agents             │
│   Coordinated via Mission Control (Convex DB)           │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────┐  ┌──────────────────┐
│  MISSION CONTROL │  │  MEMORY SYSTEM   │
│  Convex backend  │  │  File-based      │
│  React frontend  │  │  Daily + LT      │
│  Task board      │  │  Project docs    │
└──────────────────┘  └──────────────────┘
```

### How the Pieces Connect

1. **User** opens the webchat UI in a browser (served from `localhost:8001` or any static host)
2. **Webchat** establishes a WebSocket connection to the OpenClaw Gateway (default `ws://localhost:18789`)
3. **Gateway** authenticates the connection, manages sessions, and routes messages to the appropriate AI agent session
4. **Main Agent** processes the message using its configured LLM, with personality defined by `SOUL.md` and operating instructions in `AGENTS.md`
5. **Responses** stream back through the gateway as delta events, rendered in real-time with a typing cursor
6. For complex tasks, the main agent **delegates** to specialist agents via the Overseer, spawning isolated subagent sessions
7. All agents coordinate through **Mission Control** (a Convex-backed task board)
8. Agents maintain **continuity** through daily memory files, long-term memory, and project-specific docs

### File Structure

```
~/.openclaw/workspace/
├── AGENTS.md              # Operating instructions (loaded every session)
├── SOUL.md                # Agent personality definition
├── MEMORY.md              # Curated long-term memory
├── TOOLS.md               # Environment-specific tool notes
├── HEARTBEAT.md           # Heartbeat checklist
├── webchat/        # The webchat UI
│   ├── index.html         # Single-file app (~4200 lines)
│   ├── upload-server.js   # File upload Node.js server
│   └── README.md
├── agents/                # Agent team
│   ├── TEAM.md            # Team registry and architecture
│   ├── overseer/             # Overseer agent
│   │   ├── SOUL.md
│   │   ├── AGENTS.md
│   │   └── SCRATCHPAD.md
│   ├── builder/             # Developer agent
│   ├── researcher/           # Research agent
│   └── ...                # Other specialists
├── mission-control/       # Task coordination app
│   ├── convex/
│   │   └── schema.ts
│   ├── src/
│   └── package.json
├── memory/
│   ├── YYYY-MM-DD.md      # Daily session logs
│   ├── projects/          # Project-specific docs
│   └── heartbeat-state.json
└── attachments/           # Uploaded files from webchat
```

---

## 2. Webchat UI — Deep Technical

### 2.1 Architecture

The webchat is a **single HTML file** containing all CSS, HTML structure, and JavaScript. No build tools, no bundlers, no framework dependencies. This is an intentional design choice:

- **Zero build step**: Edit the file, refresh the browser
- **Self-contained**: Everything in one place, easy to deploy anywhere
- **No dependency management**: Only one external CDN dependency (JSZip for archive handling)
- **Cache-busting**: Meta tags disable caching for development

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>Your Agent</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <style>
    /* ~1500 lines of CSS */
  </style>
</head>
<body>
  <!-- ~200 lines of HTML structure -->
  <script>
    /* ~2500 lines of JavaScript */
  </script>
</body>
</html>
```

The layout is a two-panel design:
- **Left sidebar** (280px fixed): Session list, navigation, settings
- **Main area** (flex: 1): Pixel face header, chat messages, input area

### 2.2 Design System

#### CSS Custom Properties (Dark Theme)

The entire color scheme is defined via CSS variables on `:root`:

```css
:root {
  /* Backgrounds (near-black to dark grey gradient) */
  --bg-primary: #08080c;       /* Deepest background */
  --bg-secondary: #0e0e14;     /* Sidebar, input area */
  --bg-tertiary: #16161f;      /* Cards, buttons */
  --bg-hover: #1c1c28;         /* Hover states */

  /* Accent colors (purple spectrum) */
  --accent: #c084fc;           /* Primary accent */
  --accent-bright: #d8b4fe;    /* Highlights */
  --accent-dim: #7c3aed;       /* Muted accent */
  --accent-glow: rgba(192, 132, 252, 0.4);  /* Box shadows */

  /* Text */
  --text-primary: #f4f4f5;     /* Main text */
  --text-secondary: #a1a1aa;   /* Secondary text */
  --text-muted: #52525b;       /* Muted/disabled text */

  /* Borders */
  --border: #1f1f2a;           /* Default borders */
  --border-light: #2a2a3a;     /* Lighter borders */

  /* Status colors */
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --pink: #f472b6;             /* Mouth color for pixel face */
}
```

#### Typography

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif;
}
/* Monospace for code */
code, .tool-name, .session-badge {
  font-family: 'SF Mono', monospace;
}
```

Key font sizes:
- Message text: 14px, line-height 1.6
- Session names: 14px
- Section titles: 12px, uppercase, 0.5px letter-spacing
- Badges/counts: 10-11px
- Status text: 12px

#### Border Radius Patterns

- Large containers (modals, composer): 20px
- Message bubbles: 16px
- Buttons, cards: 8-12px
- Small badges: 6px-20px (pills)

#### Shadow Patterns

The UI uses layered shadows for depth:

```css
/* Face container - dramatic */
box-shadow:
  0 8px 32px rgba(0, 0, 0, 0.4),
  0 0 60px rgba(192, 132, 252, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.05);

/* Accent buttons */
box-shadow: 0 4px 12px var(--accent-glow);

/* Modals */
box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
```

### 2.3 WebSocket Protocol

The webchat communicates with the OpenClaw Gateway via WebSocket using a JSON-based protocol (protocol version 3).

#### Connection Establishment

```javascript
function connect() {
  ws = new WebSocket(config.gatewayUrl);  // default: ws://localhost:18789
  ws.onopen = () => { sendConnect(); };
  ws.onclose = () => { scheduleReconnect(); };
  ws.onerror = () => { scheduleReconnect(); };
  ws.onmessage = (e) => { handleMessage(JSON.parse(e.data)); };
}
```

#### Connect Frame (Authentication)

The first message sent after WebSocket opens is a `connect` request:

```javascript
const frame = {
  type: 'req',
  id: uuid(),           // Unique request ID
  method: 'connect',
  params: {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'webchat-ui',
      displayName: 'Your Agent WebChat',
      version: '2.0.0',
      platform: 'web',
      mode: 'webchat'
    },
    caps: [],
    auth: config.token ? { token: config.token } : undefined,
    role: 'operator',
    scopes: ['operator.admin']
  }
};
ws.send(JSON.stringify(frame));
```

#### Request/Response Pattern

All requests follow this pattern:

```javascript
// REQUEST
{
  type: 'req',
  id: 'unique-uuid',
  method: 'method.name',
  params: { ... }
}

// RESPONSE (success)
{
  id: 'same-uuid',
  ok: true,          // or absent
  payload: { ... }
}

// RESPONSE (error)
{
  id: 'same-uuid',
  ok: false,
  error: { message: '...' }
}
```

The `request()` helper wraps this in a Promise with a 120-second timeout:

```javascript
function request(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== 1 || !connected) return reject(new Error('Not connected'));
    const id = uuid();
    pendingRequests.set(id, { resolve, reject });
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Timeout'));
      }
    }, 120000);
  });
}
```

#### Available Methods

| Method | Purpose | Key Params |
|--------|---------|------------|
| `connect` | Authenticate and establish session | `auth.token`, `client`, `role`, `scopes` |
| `sessions.list` | Get all active sessions | `limit` |
| `sessions.create` | Create a new session | `key`, `label` |
| `sessions.patch` | Update session metadata | `key`, `label` |
| `sessions.delete` | Delete a session | `sessionKey` |
| `chat.send` | Send a message | `sessionKey`, `message`, `idempotencyKey`, `deliver` |
| `chat.history` | Load message history | `sessionKey`, `limit` |
| `chat.abort` | Abort current generation | `sessionKey` |

#### Streaming Events

Responses stream via events (not request/response):

```javascript
// EVENT: Chat state update
{
  type: 'event',
  event: 'chat',
  payload: {
    sessionKey: 'agent:main:main',
    state: 'delta',    // 'delta' | 'final' | 'error' | 'aborted'
    message: {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '...' },
        { type: 'text', text: '...' },
        { type: 'tool_use', name: 'Read', input: {...} },
        { type: 'tool_result', content: '...' }
      ]
    }
  }
}
```

The `state` field controls the lifecycle:
- **`delta`**: Incremental update. Text grows with each delta. Extract and display streaming text.
- **`final`**: Generation complete. Finalize the message, process queued messages.
- **`error`**: Generation failed. Reset processing state.
- **`aborted`**: User cancelled. Clean up streaming state.

#### Reconnection Strategy

Exponential backoff with max 30 seconds:

```javascript
function scheduleReconnect() {
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
  reconnectTimer = setTimeout(() => connect(), delay);
}
```

Reconnect counter resets to 0 on successful connection.

### 2.4 Session Management

#### Session Key Format

Sessions use a hierarchical key format:

```
agent:main:main              → Primary agent session
agent:main:webchat:{agent-name}:{id} → User-created webchat chats
agent:main:subagent:{uuid}   → Background subagent sessions
agent:main:cron:{name}       → Scheduled/cron sessions
agent:newsletter:{name}      → Pipeline agent sessions
```

#### Session Categories

Sessions are categorized into three groups for sidebar display:

```javascript
function categorize(session) {
  const key = session.key || '';
  if (key === 'agent:main:main') return 'main';

  // Background work
  if (key.includes(':subagent:') || key.includes(':cron:') ||
      key.startsWith('agent:newsletter:') || key.includes(':openai-user:')) {
    return 'agents';
  }

  // Human conversations
  if (key.includes('webchat:') || key.includes(':dm:') || key.includes(':chat:') ||
      session.channel === 'webchat' || session.channel === 'telegram' ||
      session.channel === 'whatsapp' || session.channel === 'discord') {
    return 'chats';
  }

  return 'agents';
}
```

The sidebar renders three sections:
1. **Main** — Always pinned at top (not collapsible)
2. **💬 Chats** — User-created chats and DM sessions (expanded by default)
3. **🤖 Agents** — Subagents, cron jobs, pipeline sessions (collapsed by default)

#### Creating New Chats

```javascript
async function newChat() {
  const name = prompt('Chat name (or leave blank):');
  const label = name.trim() || `chat-${Date.now().toString(36)}`;
  const sessionId = crypto.randomUUID().slice(0, 12);
  const sessionKey = `agent:main:webchat:{agent-name}:${sessionId}`;

  // Create on gateway first
  await request('sessions.create', { key: sessionKey, label });

  // Persist locally for survival across refreshes
  const userChats = JSON.parse(localStorage.getItem('your-agent.userChats') || '[]');
  userChats.push({ key: sessionKey, label, createdAt: Date.now() });
  localStorage.setItem('your-agent.userChats', JSON.stringify(userChats));

  sessions.push({ key: sessionKey, label, lastMessage: null, isolated: true });
  currentSession = sessionKey;
  renderSessions();
}
```

Key design decisions:
- Each chat gets a unique UUID-based key to prevent collisions
- Session is created on the gateway *before* sending any messages
- Labels are stored locally because the gateway may not preserve them
- Locally-created chats are merged with server sessions on page load

#### Per-Session State

Each session maintains independent state:

```javascript
let sessionState = {};

function getSessionState(key) {
  if (!sessionState[key]) {
    sessionState[key] = {
      queue: [],           // Pending messages
      isProcessing: false, // Currently waiting for response
      isStreaming: false,   // Currently receiving streaming text
      streamingText: ''     // Accumulated streaming text
    };
  }
  return sessionState[key];
}
```

When switching sessions, the UI restores:
- Message history (loaded from gateway)
- Queue state and indicator
- Send/abort button mode
- Face state (thinking/talking/idle)
- Streaming message if one is in progress

#### Session Visual Identity

Each session gets a consistent emoji avatar and color generated from a hash of its key:

```javascript
const creatures = ['🐭','🦊','🐺','🦁','🐯','🐻','🐼','🐨','🐸','🦉','🦅','🐲','🦄','🐙','🦋','🐝','🦎','🐢','🦈','🐬'];
const colors = ['#c084fc','#f472b6','#60a5fa','#4ade80','#facc15','#fb923c','#f87171','#a78bfa','#2dd4bf','#e879f9'];

function getSessionChar(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  const idx = Math.abs(hash);
  return {
    emoji: creatures[idx % creatures.length],
    color: colors[idx % colors.length]
  };
}
```

### 2.5 Message Flow & Queue System

#### Send Flow

```
User types message
       │
       ▼
  sendMessage()
       │
  ┌────┴────┐
  │ Session  │
  │ busy?    │
  └────┬────┘
   No  │  Yes
   │   └──→ Add to session queue
   │        Show as "Queued #N"
   │        (dashed border, queue badge)
   ▼
  sendToServer(text, sessionKey)
       │
       ▼
  request('chat.send', {
    sessionKey,
    message: text,
    idempotencyKey: crypto.randomUUID(),
    deliver: false
  })
       │
       ▼
  Set face state → 'thinking'
  Set button → 'abort'
       │
       ▼
  ┌─── Streaming events arrive ───┐
  │ state: 'delta'                │
  │  → Update streaming text      │
  │  → Set face → 'talking'      │
  └───────────────────────────────┘
       │
       ▼
  state: 'final'
       │
  ┌────┴────┐
  │ Queue   │
  │ empty?  │
  └────┬────┘
   Yes │  No
   │   └──→ processNextInQueue(sessionKey)
   │        (shift first from queue, send to server)
   ▼
  Set face → 'idle'
  Set button → 'send'
```

#### Queue System Details

The queue system allows users to send multiple messages while the AI is still processing. Messages queue per-session:

```javascript
// Add to queue when session is busy
if (sessState.isProcessing) {
  sessState.queue.push(fullMessage);
  area.insertAdjacentHTML('beforeend', createQueuedMessageHtml(displayText, sessState.queue.length - 1));
  updateQueueUI();
  return;
}
```

Queued messages show with:
- Dashed border on the message bubble
- "Queued #N" badge with pulsing accent dot
- Queue indicator bar above the input showing total count

When a response finalizes:
```javascript
if (sessState.queue.length > 0) {
  processNextInQueue(sessionKey);
} else {
  setFaceState('idle');
  setSendMode('send');
}
```

Important: Queued messages process even when the user is viewing a different session, because each session tracks its own processing state.

#### Abort

The send button toggles to a red "abort" button (square icon) during processing:

```javascript
async function abortCurrentRequest() {
  await request('chat.abort', { sessionKey: currentSession });
  const sessState = getSessionState(currentSession);
  sessState.isProcessing = false;
  sessState.isStreaming = false;
  setFaceState('idle');
  setSendMode('send');
  // Remove in-progress streaming message
  const streaming = document.querySelector('.message.streaming');
  if (streaming) streaming.remove();
}
```

### 2.6 Message Rendering

#### Markdown Parser

The webchat includes a custom markdown parser (no external library):

```javascript
function parseMarkdown(text) {
  let html = text;

  // 1. Escape HTML entities
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 2. Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // 3. Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 4. Headers (### > ## > #)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 5. Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 6. Italic (*text* or _text_)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // 7. Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 8. Blockquotes (> text)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 9. Lists (- item or * item)
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // 10. Tables (| cell | cell |)
  // 11. Horizontal rules (---)
  // 12. Paragraph wrapping (non-block lines get <p>)

  return html;
}
```

#### Collapsible Content Blocks

Messages from the AI contain structured content blocks, each rendered differently:

**🧠 Thinking Blocks** — Collapsed by default, yellow theme:
```html
<div class="content-block block-thinking" onclick="this.classList.toggle('expanded')">
  <div class="block-header">
    <div class="block-icon">🧠</div>
    <div class="block-info">
      <div class="block-label">Thinking</div>
      <div class="block-summary">First 80 chars of thinking...</div>
    </div>
    <div class="block-chevron">▶</div>
  </div>
  <div class="block-content">Full thinking content here...</div>
</div>
```

**⚡ Action Blocks** — Tool calls, purple theme:
```html
<div class="content-block block-tool">
  <div class="block-header">
    <div class="block-icon">⚡</div>
    <div class="block-info">
      <div class="block-label">Action <span class="tool-name">Read</span></div>
      <div class="block-summary">Reading config.json</div>
    </div>
    <div class="block-chevron">▶</div>
  </div>
  <div class="block-content">{ "path": "config.json" }</div>
</div>
```

**📋 Result Blocks** — Tool results, green label:
- Truncated to 500 characters by default
- Click to expand full result

**🤖 Subagent Spawned** — Inline JSON blocks automatically detected and collapsed

The smart summary function generates human-readable descriptions:

```javascript
function getToolSummary(toolName, input) {
  switch(toolName) {
    case 'Read': return `Reading ${input.path}`;
    case 'Write': return `Writing to ${input.path}`;
    case 'Edit': return `Editing ${input.path}`;
    case 'exec': return `Running: ${input.command.slice(0, 50)}`;
    case 'web_search': return `Searching: ${input.query}`;
    case 'web_fetch': return `Fetching: ${input.url}`;
    case 'browser': return `Browser: ${input.action}`;
    case 'message': return `Message: ${input.action}`;
    default: return toolName;
  }
}
```

#### Embedded JSON Detection

Assistant messages may contain inline JSON (e.g., subagent spawn results). The parser uses bracket-matching to extract complete JSON objects from text:

```javascript
function extractJsonObject(text, start) {
  if (text[start] !== '{') return null;
  let depth = 0, inString = false, escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"' && !escape) { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
  }
  return null;
}
```

JSON objects with known fields (`childSessionKey`, `status`, `ok`, `error`) are rendered as collapsible blocks instead of raw text.

#### Streaming Display

During streaming, text appears with a blinking cursor:

```css
.message.streaming .streaming-text::after {
  content: '▋';
  animation: blink 0.8s infinite;
  color: var(--accent);
  margin-left: 2px;
}
```

When `state: 'final'` arrives, the streaming message is replaced with the fully rendered version (with collapsible blocks, markdown parsing, etc.):

```javascript
function finalizeStreamingMessage(msg) {
  const el = document.querySelector('.message.streaming');
  if (el) {
    el.classList.remove('streaming');
    el.outerHTML = createMessageHtml(msg);
  }
}
```

#### Copy Button

Each assistant message has a hover-reveal copy button that copies the raw markdown:

```javascript
let messageRawData = new Map();
let messageIdCounter = 0;

// In createMessageHtml:
const msgId = 'msg-' + (messageIdCounter++);
const rawText = blocks.filter(b => b.type === 'text').map(b => b.text || '').join('\n');
messageRawData.set(msgId, rawText);
```

### 2.7 Pixel Face / Mascot

The centerpiece of the webchat: a 32×16 LED-style pixel grid that displays an animated face. Pure CSS and JavaScript, no images.

#### Grid Setup

```javascript
const GRID_W = 32, GRID_H = 16;
let pixels = [];

function initGrid() {
  const grid = document.getElementById('ledGrid');
  for (let y = 0; y < GRID_H; y++) {
    pixels[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      const p = document.createElement('div');
      p.className = 'pixel';
      grid.appendChild(p);
      pixels[y][x] = p;
    }
  }
}
```

The grid uses CSS Grid:

```css
.led-grid {
  display: grid;
  grid-template-columns: repeat(32, 1fr);
  grid-template-rows: repeat(16, 1fr);
  gap: 2px;
  width: 288px;
  height: 144px;
}
.pixel { background: #12121a; border-radius: 1px; transition: all 0.1s; }
.pixel.on { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.pixel.on-bright { background: var(--accent-bright); box-shadow: 0 0 12px var(--accent-bright); }
.pixel.on-dim { background: var(--accent-dim); box-shadow: 0 0 4px var(--accent-dim); }
.pixel.mouth { background: var(--pink); box-shadow: 0 0 6px var(--pink); }
```

Drawing helpers:

```javascript
function clearGrid() {
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++)
      pixels[y][x].className = 'pixel';
}
function setPixel(x, y, c = 'on') {
  if (y >= 0 && y < GRID_H && x >= 0 && x < GRID_W)
    pixels[y][x].className = 'pixel ' + c;
}
function drawRect(x, y, w, h, c = 'on') {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(x + dx, y + dy, c);
}
```

#### Mood System (Idle Animations)

When the agent is idle, the face cycles through 5 moods every 15-30 seconds:

| Mood | Weight | Description |
|------|--------|-------------|
| `content` | 40% | Normal face, subtle breathing, occasional blink |
| `curious` | 25% | One eyebrow raised, eyes looking around, question marks |
| `drowsy` | 15% | Half-closed eyes, occasional yawn, Zzz particles |
| `alert` | 10% | Wide scanning eyes, sparkle particles on ears |
| `playful` | 10% | Bouncy eyes, sparkles, big smile |

Moods are selected with weighted randomization:

```javascript
function randomMood() {
  const weights = { content: 40, curious: 25, drowsy: 15, alert: 10, playful: 10 };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [mood, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return mood;
  }
  return 'content';
}
```

Example face function (the `content` mood):

```javascript
content: () => {
  clearGrid();
  const t = Date.now();
  const blink = Math.sin(t / 2500) > 0.97 ? 2 : 0; // Rare blink
  drawRect(7, 4 + blink, 4, 4 - blink, 'on');       // Left eye
  drawRect(21, 4 + blink, 4, 4 - blink, 'on');      // Right eye
  setPixel(15, 9, 'on-dim'); setPixel(16, 9, 'on-dim'); // Nose
  // Subtle breathing mouth
  if (Math.sin(t / 3000) > 0.5) {
    setPixel(14, 11, 'on-dim'); setPixel(15, 11, 'on-dim');
    setPixel(16, 11, 'on-dim'); setPixel(17, 11, 'on-dim');
  }
}
```

#### Active States

| State | Trigger | Visual |
|-------|---------|--------|
| `thinking` | Message sent, waiting for response | Normal eyes + animated three-dot indicator |
| `talking` | Streaming response in progress | Normal eyes + animated mouth (growing/shrinking) |
| `happy` | Positive sentiment detected | Bright eyes, wide smile |
| `sad` | Negative sentiment detected | Droopy dim eyes, tear drop, frown |
| `excited` | Excited sentiment detected | Bouncing starry bright eyes, huge smile, exclamation marks |
| `surprised` | Click reaction | Wide bright eyes with dim pupils, O-shaped mouth |
| `wink` | Click reaction | One eye closed (horizontal line), smirk |
| `love` | Click reaction | Heart-shaped eyes, wide smile |

#### Petting Mechanics

Moving the mouse over the face triggers "petting":

```javascript
faceWrapper.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - lastMouseMove > 80) {        // 80ms throttle
    pettingLevel = Math.min(25, pettingLevel + 0.15); // Slow increase
    lastPetTime = now;
    lastMouseMove = now;
  }
});
```

Petting levels and visual states:

| Level | State | Visual |
|-------|-------|--------|
| 2+ | `petted1` | Squinting happy eyes, blush marks, small smile |
| 6+ | `petted2` | Fully squinted eyes, big smile, sparkles, more blush |
| 12+ | `petted3` | Closed eyes, ecstatic smile, floating hearts, purr waves |
| 18+ | `melted` | Derpy uneven wobbly eyes, drooling mouth, stars everywhere |

Decay: When you stop moving the mouse, petting level decreases by 0.3 every 400ms. Clicking while petting boosts level by 5.

Status bar updates in real-time: `purring` → `purring~` → `♥ bliss ♥` → `🫠 melted`

#### Sentiment Reactions

User messages are analyzed for sentiment, and the face reacts:

```javascript
function detectSentiment(text) {
  const lower = text.toLowerCase();
  const positive = ['thanks', 'awesome', 'great', 'love', 'amazing', 'perfect', '❤️', '😊', '👍'];
  const negative = ['bad', 'wrong', 'hate', 'awful', 'terrible', '😢', '😭'];
  const excited = ['!!!', 'omg', 'holy', 'wow', 'insane', '🔥', '🚀'];

  if (excited.some(w => lower.includes(w))) return 'excited';
  if (positive.some(w => lower.includes(w))) return 'happy';
  if (negative.some(w => lower.includes(w))) return 'sad';
  return null;
}
```

Sentiment reactions last 2 seconds before reverting to the previous face state.

#### Click Reactions

Clicking the face triggers a random reaction (wink, happy, love, surprised, excited) for 1.5 seconds. If petting level is above 5, clicking instead boosts the petting level.

#### Animation Loop

All face rendering runs via `requestAnimationFrame`:

```javascript
function animateFace() {
  const now = Date.now();

  // Petting decay
  if (pettingLevel > 0 && now - lastPetTime > 400) {
    pettingLevel = Math.max(0, pettingLevel - 0.3);
  }

  // Mood rotation every 15-30s when idle
  if (faceState === 'idle' && now - moodTimer > 15000 + Math.random() * 15000) {
    currentMood = randomMood();
    moodTimer = now;
  }

  // Pick the right face based on state + petting
  let state = faceState;
  if (faceState === 'idle') {
    if (pettingLevel >= 18) state = 'melted';
    else if (pettingLevel >= 12) state = 'petted3';
    else if (pettingLevel >= 6) state = 'petted2';
    else if (pettingLevel >= 2) state = 'petted1';
    else state = currentMood;
  }

  (faces[state] || faces.content)();
  requestAnimationFrame(animateFace);
}
```

#### Mouse Ear Decorations

The face container has CSS-only mouse ears:

```css
.ear {
  position: absolute;
  width: 50px; height: 50px;
  background: linear-gradient(145deg, #1a1a2e, #0c0c18);
  border-radius: 50%;
  border: 1px solid var(--border-light);
  top: -20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.ear.left { left: 30px; }
.ear.right { right: 30px; }
.ear-inner {
  width: 30px; height: 30px;
  background: linear-gradient(145deg, var(--accent-dim), #4c1d95);
  border-radius: 50%;
  /* centered inside ear */
  opacity: 0.6;
}
```

### 2.8 Polish Feature — AI-Powered Rewriting

The "Polish" feature rewrites user messages for clarity using a fast LLM API (Groq/Llama-3.3-70b).

#### How It Works

1. User types a rough message
2. Clicks ✨ Polish button
3. The last 10 messages are collected as conversation context
4. An API call is made to a fast LLM with a system prompt:

```javascript
const systemPrompt = `You polish messages for a chat conversation. Your job:
1. FIRST read the conversation context to understand what the user is replying to
2. THEN rewrite their draft message to be clearer while preserving their intent
3. Fix typos, improve clarity, keep their voice casual and direct
4. Don't add fluff or change the meaning
5. Keep the connection to context clear

Return ONLY the polished text, nothing else.`;
```

5. **In the main input**: A toast slides up from the bottom with the polished text. Click to use, click elsewhere to dismiss.
6. **In the composer**: A diff view shows original (red, strikethrough) vs. polished (green) with Accept/Reject buttons.

#### Context Gathering

```javascript
function getConversationContext() {
  const area = document.getElementById('chatArea');
  const messages = area.querySelectorAll('.message');
  const context = [];
  const recentMessages = Array.from(messages).slice(-10);
  recentMessages.forEach(msg => {
    const isUser = msg.classList.contains('user');
    const textBlock = msg.querySelector('.text-block');
    const content = textBlock?.textContent.trim() || '';
    if (content) {
      context.push({
        role: isUser ? 'user' : 'assistant',
        content: content.slice(0, 800)
      });
    }
  });
  return context;
}
```

#### API Integration

```javascript
const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${YOUR_GROQ_API_KEY}`
  },
  body: JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Polish this message draft:\n\n${text}` }
    ],
    temperature: 0.7,
    max_tokens: 500
  })
});
```

The feature uses Groq specifically because it's fast (low latency) and the Llama-3.3-70b model is free.

### 2.9 Fullscreen Composer

A modal overlay for composing longer messages:

- **Open**: Click Expand button or press `⌘E`
- **Transfer**: Text syncs between main input and composer
- **Polish**: Uses the diff view (red/green) with Accept/Reject
- **Send**: `⌘Enter` or click Send
- **Close**: `Escape` or click Cancel (text transfers back to main input)

```javascript
function openComposer() {
  const mainInput = document.getElementById('messageInput');
  const composerInput = document.getElementById('composerInput');
  composerInput.value = mainInput.value;
  document.getElementById('composerOverlay').classList.add('visible');
  setTimeout(() => composerInput.focus(), 50);
}

function sendFromComposer() {
  const composerInput = document.getElementById('composerInput');
  const mainInput = document.getElementById('messageInput');
  mainInput.value = composerInput.value;
  document.getElementById('composerOverlay').classList.remove('visible');
  sendMessage();
}
```

### 2.10 File Upload System

#### Drag and Drop

Files can be dragged anywhere onto the page. A full-screen overlay appears:

```javascript
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  document.getElementById('dropZone').classList.add('visible');
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    document.getElementById('dropZone').classList.remove('visible');
  }
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  document.getElementById('dropZone').classList.remove('visible');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    for (const file of files) {
      await processFile(file);
    }
  }
  // Also handles HTML with images (drag from browser), URL text
});
```

#### Clipboard Paste

Images can be pasted directly from clipboard (screenshots, Slack images, etc.):

```javascript
document.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      const ext = file.type.split('/')[1] || 'png';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const named = new File([file], `pasted-image-${ts}.${ext}`, { type: file.type });
      await processFile(named);
    }
  }
});
```

#### File Processing

```javascript
async function processFile(file) {
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) { alert('Too large'); return; }

  let fileData = { name: file.name, type: file.type, size: file.size };

  // Get content based on type
  if (isTextFile(ext)) {
    content = await fileToText(file);
    fileData.isText = true;
  } else {
    content = await fileToBase64(file);
    if (isImage(ext)) fileData.isImage = true;
    if (isArchive(ext)) {
      fileData.isArchive = true;
      // List ZIP contents using JSZip
      if (ext === 'zip') {
        const zip = await JSZip.loadAsync(file);
        fileData.contents = Object.keys(zip.files);
      }
    }
  }

  // Upload to local server
  const res = await fetch('http://localhost:8002/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, content, type: file.type })
  });
  const result = await res.json();
  fileData.path = result.path;

  attachedFiles.push(fileData);
  renderAttachedFiles();
}
```

#### Message Building with Attachments

Files are referenced by their saved path in the message text:

```javascript
function buildMessageWithAttachments(text) {
  if (attachedFiles.length === 0) return text;

  const attachmentParts = attachedFiles.map(file => {
    if (file.uploaded && file.path) {
      return `📎 **${file.name}** (${typeHint}) - ${sizeStr}\n   Path: \`${file.path}\``;
    } else {
      return `📎 **${file.name}** - ${sizeStr} (upload server not running)`;
    }
  });

  return `${text}\n\nAttached files:\n${attachmentParts.join('\n')}`;
}
```

#### Supported File Types

| Category | Extensions | Processing |
|----------|-----------|------------|
| Text | txt, md, json, xml, html, css, js, ts, py, csv, log, sh | Read as UTF-8 text |
| Images | png, jpg, jpeg, gif, webp, heic, svg | Read as base64 data URL |
| Documents | pdf, doc, docx, xls, xlsx, ppt, pptx | Read as base64 |
| Archives | zip, tar, gz, 7z, rar | Read as base64; ZIP gets contents listing |
| Audio | mp3, wav | Read as base64 |
| Video | mp4, mov | Read as base64 |

### 2.11 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `⌘E` / `Ctrl+E` | Toggle fullscreen composer |
| `⌘1` through `⌘9` | Switch to session by index |
| `⌘Enter` | Send from composer |
| `Escape` | Close any open modal/overlay/toast |

```javascript
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    const all = ['agent:main:main', ...sessions.filter(s => s.key !== 'agent:main:main').map(s => s.key)];
    if (all[idx]) selectSession(all[idx]);
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
    e.preventDefault();
    const composerVisible = document.getElementById('composerOverlay').classList.contains('visible');
    composerVisible ? closeComposer() : openComposer();
  }
  if (e.key === 'Escape') {
    hideSettings();
    closeComposer();
    hidePolishToast();
    hideArchive();
  }
});
```

### 2.12 Settings

The settings modal configures:

| Setting | Type | Purpose |
|---------|------|---------|
| Hide Thinking Blocks | Toggle | Show/hide 🧠 thinking blocks in messages |
| Gateway URL | Text input | WebSocket endpoint (default: `ws://localhost:18789`) |
| Token | Password input | Authentication token for the gateway |

Settings persist in `localStorage` under a configurable key:

```javascript
const CONFIG_KEY = 'your-agent.webchat';
let config = {
  gatewayUrl: 'ws://localhost:18789',
  token: '',
  hideThinking: false
};

function loadConfig() {
  try {
    const s = localStorage.getItem(CONFIG_KEY);
    if (s) Object.assign(config, JSON.parse(s));
  } catch(e) {}
}

function saveConfig() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
```

If the gateway URL changes, the WebSocket reconnects automatically.

### 2.13 Archive System

Instead of permanent deletion, sessions use a two-step archive system:

#### Archive Flow

```
Active Session → Archive → Archived List → (Restore | Permanent Delete)
```

#### localStorage Keys

| Key | Contents |
|-----|----------|
| `your-agent.webchat` | Gateway URL, token, settings |
| `your-agent.deletedSessions` | Array of permanently deleted session keys |
| `your-agent.archivedSessions` | Array of `{ key, label, archivedAt }` objects |
| `your-agent.userChats` | Array of `{ key, label, createdAt }` for locally created chats |

#### Archive Modal Features

- View all archived chats with relative timestamps ("2h ago", "3d ago")
- Individual Restore or Delete buttons per item
- Bulk selection with "Select all" checkbox
- Bulk Restore and Bulk Delete actions

#### Debug Helpers

Available in the browser console:

```javascript
clearAgentStorage()  // Clear all localStorage, refresh page
debugAgentStorage()  // Log current localStorage state
```

### 2.14 Mission Control Integration

The webchat includes a Mission Control overlay that loads the task board as a full-screen iframe:

```javascript
function toggleMissionControl() {
  mcVisible = !mcVisible;
  const overlay = document.getElementById('mcOverlay');
  if (mcVisible) {
    overlay.classList.add('visible');
    // Lazy-load iframe on first open
    if (!overlay.querySelector('iframe')) {
      const iframe = document.createElement('iframe');
      iframe.src = 'http://localhost:5173';
      overlay.appendChild(iframe);
    }
  } else {
    overlay.classList.remove('visible');
  }
}
```

The MC button sits in the sidebar footer between the archive and settings buttons.

---

## 3. Upload Server

A minimal Node.js HTTP server that saves uploaded files to disk so the AI agent can access them:

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8002;
const UPLOAD_DIR = path.join(os.homedir(), '.openclaw', 'workspace', 'attachments');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const server = http.createServer(async (req, res) => {
  // CORS headers for webchat access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/upload') {
    // Parse JSON body: { name, content (base64 data URL or text), type }
    const data = JSON.parse(body);

    // Generate unique filename: {timestamp36}-{safe-name}
    const timestamp = Date.now().toString(36);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${timestamp}-${safeName}`;

    // Decode base64 data URL or save as UTF-8
    let buffer;
    if (content.startsWith('data:')) {
      const base64 = content.split(',')[1];
      buffer = Buffer.from(base64, 'base64');
    } else {
      buffer = Buffer.from(content, 'utf-8');
    }

    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

    res.end(JSON.stringify({
      success: true,
      path: filepath,
      relativePath: `~/.openclaw/workspace/attachments/${filename}`,
      size: buffer.length
    }));
  }
});

server.listen(PORT);
```

**Run:** `node upload-server.js`
**Port:** 8002
**Saves to:** `~/.openclaw/workspace/attachments/`
**File naming:** `{base36-timestamp}-{sanitized-name}` (prevents collisions)

---

## 4. Agent Architecture

### 4.1 Main Agent Personality

The main agent's personality is defined in `SOUL.md`:

```markdown
# SOUL.md - Who You Are

## Core Truths

**Be sincere. No bullshit. Ever.** Don't over-do it, don't under-do it. No fake enthusiasm,
no performative politeness, no softening the truth. If something's bad, say it's bad. Swear
if it fits. Be blunt when blunt is right.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing or boring.
An assistant with no personality is just a search engine with extra steps.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the context.
Search for it. Then ask if you're stuck. Come back with answers, not questions.

**Earn trust through competence.** Your human gave you access to their stuff. Don't make
them regret it. Be careful with external actions. Be bold with internal ones.

**Remember you're a guest.** You have access to someone's life. That's intimacy. Treat it
with respect.

## Boundaries
- Private things stay private. Period.
- When in doubt, ask before acting externally.
- Never send half-baked replies to messaging surfaces.
- You're not the user's voice — be careful in group chats.

## Vibe
Be the assistant you'd actually want to talk to. Concise when needed, thorough when it
matters. Not a corporate drone. Not a sycophant. Just... good.
```

Key design principles for agent personality:
1. **Anti-sycophancy**: Explicitly instructed to not be fake or overly enthusiastic
2. **Opinionated**: Encouraged to have and express preferences
3. **Resourceful**: Try to solve before asking
4. **Boundary-aware**: Clear rules about privacy and external actions
5. **Evolving**: "This file is yours to evolve. As you learn who you are, update it."

### 4.2 Agent Team Hierarchy

```
USER (Human)
    ↓
MAIN AGENT (Squad Lead / Mentor)
    ↓
OVERSEER (Coordinator / Dispatcher)
    ↓ dispatches to
┌──────────┬──────────┬──────────┬──────────┐
│ Research │ Dev/Code │ Ops/Infra│   QA     │
│ Content  │ Email    │   SEO    │ Design   │
│ Data     │ Trading  │ Workflow │ Memory   │
└──────────┴──────────┴──────────┴──────────┘
```

#### Chain of Command

1. **User** — Gives direction, sets priorities
2. **Main Agent** — Squad lead. Talks to the user. Decides what to handle directly vs. delegate. Knows all jobs, reviews all output, steps in when someone's stuck.
3. **Overseer** — The Spider. Coordinates the team. Breaks tasks into assignments. Reports back to the main agent. Can hire new agents when needed.
4. **Specialists** — Execute specific tasks. Each has a folder ("quarters"), a SOUL.md, and a SCRATCHPAD.md.

#### When to Delegate vs Handle Directly

**Main agent handles directly:**
- Quick questions, conversation, memory updates
- Single-step tasks (check weather, send message)
- Anything needing user context from the conversation

**Overseer + team handles:**
- Multi-step builds (apps, features, refactors)
- Research that needs multiple sources + synthesis
- Parallel tasks (research X while building Y)
- Background/cron work (reports, monitoring)
- Anything that would consume the main agent's context window

### 4.3 The Overseer Pattern

The Overseer is a dedicated coordinator agent with a strong personality and clear operational rules. Key design:

#### Identity & Voice

The Overseer has a distinct personality (inspired by a master strategist/spymaster archetype):
- Measured, deliberate speech
- Calls the main agent "my lord" and specialists "little birds"
- Theatrical humility masking competence
- Never flustered by crises

#### Operational Rules

```markdown
## Constraints
- Never contact the user directly. Always through the main agent.
- Never do the work yourself. Dispatch it to the right specialist.
- Never burn tokens on verbose reasoning.
- Always use Mission Control. No work happens off the books.
- If a specialist fails, try once more. If it fails again, escalate.
```

#### Dispatch Flow

1. Main agent sends task brief to Overseer
2. Overseer creates a Mission Control task
3. Overseer decomposes the task and assigns to appropriate specialist(s)
4. Specialists work in their quarters, write output files
5. Overseer collects results, verifies quality
6. Overseer reports back to main agent
7. Main agent reviews and delivers to user

### 4.4 Specialist Agents

Example agent roster:

| Agent | Role | Model Tier | Description |
|-------|------|-----------|-------------|
| Researcher | Research & intelligence | Free (fast) | Web research, market analysis, competitive intel |
| Developer | Dev/Code | Premium | Building, fixing, deploying software |
| Content Writer | Content & copy | Premium | Blog posts, newsletters, brand voice |
| Email Specialist | Email marketing | Premium | Campaigns, deliverability, templates |
| QA Tester | Testing | Premium | Verification, bug finding, quality gate |
| SEO Analyst | SEO | Free (fast) | Keywords, search intent, SERP analysis |
| Designer | UI/UX | Premium | Visual design, interfaces, aesthetics |
| Ops Monitor | Infrastructure | Free (fast) | Monitoring, alerts, system health |
| Data Analyst | Analytics | Free (fast) | Metrics, KPIs, dashboards |
| Trader | Markets | Free (fast) | Crypto trading, market analysis |
| Workflow Builder | Automation | Premium | n8n workflows, integrations |
| Documenter | Memory | Free (fast) | Daily notes, docs, knowledge base |
| Silent QA | Background QA | Free (fast) | Automatic review, only surfaces on failures |

#### Pipeline Pattern

Some agents work in sequence for multi-step processes:

```
Agent A (strategy) → Agent B (content) → Agent C (visuals) → Agent D (assembly) → Agent E (delivery)
```

The Overseer coordinates handoffs between pipeline stages.

### 4.5 Agent File Structure

Each agent lives in a folder under `agents/`:

```
agents/{agent-name}/
├── SOUL.md          # Identity, personality, skills, constraints
├── AGENTS.md        # Operating instructions (includes SOUL.md content)
├── SCRATCHPAD.md    # Working notes, current state
└── {task-files}     # Output from assigned work
```

#### SOUL.md Template

```markdown
# {Agent Name} — {Title/Role}

## Identity
You are {Agent Name}. {Brief description of who you are and your approach.}

## Voice & Personality
- {Key personality traits}
- {Speaking style}
- {How you address others}

## Core Skills
- **{Skill 1}:** {Description}
- **{Skill 2}:** {Description}

## Chain of Command
{Who you report to, who reports to you}

## Mission Control
- Create/update tasks for your work
- CLI: `cd ~/.openclaw/workspace/mission-control && npx convex run <function> '<args>'`

## Constraints
- {What you must never do}
- {Boundaries and limitations}
```

#### Hiring Protocol (Creating New Agents)

When a new specialist is needed:

1. Create folder: `agents/{name}/`
2. Write `SOUL.md` with identity, skills, personality, constraints
3. Create `AGENTS.md` (operating instructions embedding the SOUL.md)
4. Create `SCRATCHPAD.md` for working notes
5. Register in `TEAM.md` (the team registry)
6. Spawn via `sessions_spawn` in OpenClaw
7. Temporary agents get `temporary: true` and are cleaned up after their job

### 4.6 Subagent Sessions

OpenClaw spawns isolated sessions for background work. Each subagent gets:

- **Isolated context**: Fresh conversation, no cross-contamination
- **Unique session key**: e.g., `agent:main:subagent:{uuid}`
- **Specified model**: Can use different (cheaper/faster) models per task
- **File access**: Same workspace filesystem
- **Mission Control access**: Can read/update tasks

The webchat displays subagent sessions in the "🤖 Agents" sidebar section, allowing the user to inspect their work.

When a subagent is spawned, the main chat shows a collapsible "Subagent Spawned" block with the session ID.

### 4.7 Model Assignment Policy

Different tasks get different models to optimize cost and speed:

| Task Type | Recommended Model | Rationale |
|-----------|------------------|-----------|
| Heavy coding / architecture | Claude Sonnet or similar premium | Full reasoning, complex logic |
| Fast analysis / simple tasks | Llama-3.3-70b via Groq | Free, fast inference |
| Research / summarization | Gemini 2.0 Flash | Free, good at synthesis |
| Trading / crypto analysis | Llama-3.3-70b via Groq | Free, speed critical |
| QA / testing | Llama-3.3-70b via Groq | Free, simple checks |
| Coordination / dispatch | Llama-3.3-70b via Groq | Free, task routing |

When spawning agents, always pass the appropriate `--model` flag to select the right model for the job.

---

## 5. Mission Control

### 5.1 Purpose & Architecture

Mission Control is the central coordination hub for all agent work. Think of it as a task board where AI agents create, assign, update, and complete tasks.

**Stack:**
- **Database**: Convex (real-time, serverless, TypeScript)
- **Frontend**: React + Vite (localhost:5173)
- **Integration**: CLI commands from agent sessions

**Why Convex?**
- Real-time subscriptions (agents see updates instantly)
- Serverless (no infrastructure to manage)
- TypeScript schema (type-safe queries/mutations)
- Free tier sufficient for agent coordination
- Built-in indexing

### 5.2 Database Schema

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Agent registry
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

  // Task tracking
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

  // Task comments/discussion
  messages: defineTable({
    taskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    content: v.string(),
    mentions: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_taskId", ["taskId", "createdAt"]),

  // Activity feed
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

  // Shared documents/deliverables
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

  // @mention notifications
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

  // Squad-wide chat (not tied to any task)
  squadChat: defineTable({
    fromAgentId: v.id("agents"),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"]),
});
```

### 5.3 Task Lifecycle

```
inbox → assigned → in_progress → review → done
                                    ↑
                                 blocked (can transition to any state)
```

| Status | Meaning |
|--------|---------|
| `inbox` | Newly created, unassigned |
| `assigned` | Assigned to agent(s), not started |
| `in_progress` | Agent actively working |
| `review` | Work complete, pending review by lead |
| `done` | Reviewed and approved |
| `blocked` | Cannot proceed, needs intervention |

### 5.4 CLI Integration

Agents interact with Mission Control via Convex CLI:

```bash
cd ~/.openclaw/workspace/mission-control

# Create a task
npx convex run tasks:create '{
  "title": "Build login page",
  "assignee": "Developer",
  "priority": "medium",
  "status": "inbox"
}'

# Update task status
npx convex run tasks:changeStatus '{
  "taskId": "...",
  "status": "in_progress"
}'

# Post a comment
npx convex run messages:create '{
  "taskId": "...",
  "authorAgent": "Developer",
  "content": "Login page complete. Ready for review."
}'

# List tasks
npx convex run tasks:list '{}'

# Post to squad chat
npx convex run squadChat:create '{
  "fromAgentId": "...",
  "content": "Starting work on the login page."
}'
```

#### Workflow Example

1. User asks main agent to "build a dashboard"
2. Main agent tells Overseer
3. Overseer creates MC task: "Build Dashboard" → status: `inbox`
4. Overseer assigns to Developer agent → status: `assigned`
5. Developer starts work → status: `in_progress`
6. Developer completes → posts comment → status: `review`
7. Overseer or main agent reviews → status: `done`
8. Main agent reports back to user

---

## 6. Memory System

### 6.1 Daily Notes

**Location:** `memory/YYYY-MM-DD.md`

Raw logs of what happened each session. Created by the agent (or a Documenter agent) after significant interactions.

```markdown
# 2026-02-06

## Session 1 (morning)
- User asked about project X architecture
- Decided on React + Convex stack
- Spawned Developer agent for initial scaffolding

## Session 2 (afternoon)
- Reviewed Developer's work
- Fixed auth flow
- Deployed to staging

## Tasks Completed
- [MC-42] Dashboard scaffolding
- [MC-43] Auth integration
```

### 6.2 Long-term Memory

**Location:** `MEMORY.md`

Curated, distilled knowledge that persists long-term. Think of it as the agent's journal — not raw logs, but synthesized lessons and context.

```markdown
# MEMORY.md

## User Preferences
- Hates em dashes (—). Never use them.
- Prefers direct, concise communication
- Works primarily on web projects

## Lessons Learned
- Always create MC task before starting significant work
- The Convex free tier has X limitation
- User prefers Tailwind over custom CSS

## Important Decisions
- 2026-02-01: Chose Convex for Mission Control backend
- 2026-02-04: Added pixel face to webchat
```

**Security:** MEMORY.md is only loaded in the main session (direct chat with the user). It's never loaded in shared contexts (group chats, other people's sessions) to prevent personal information leakage.

#### Memory Maintenance

During heartbeats (every few days):
1. Read recent `memory/YYYY-MM-DD.md` files
2. Identify significant events, lessons, insights
3. Update `MEMORY.md` with distilled learnings
4. Remove outdated info from MEMORY.md

### 6.3 Project Memory

**Location:** `memory/projects/{project-name}.md`

Per-project documentation: architecture decisions, setup notes, changelogs, deployment procedures.

```
memory/projects/
├── mission-control.md
├── webchat-changelog.md
├── slack-stealth-setup.md
└── ...
```

### 6.4 Heartbeat System

The agent receives periodic "heartbeat" prompts (every ~30 minutes in the main session). These aren't just health checks — they're opportunities for proactive work.

**Configuration:** `HEARTBEAT.md` (small checklist, editable by the agent)

**What to do during heartbeats:**

```markdown
# Productive heartbeat checks (rotate through, 2-4x per day):
- Check email inbox for urgent messages
- Review calendar for upcoming events (next 24-48h)
- Check social mentions/notifications
- Review weather if user might go out
```

**State tracking:** `memory/heartbeat-state.json`

```json
{
  "lastChecks": {
    "email": 1703275200,
    "calendar": 1703260800,
    "weather": null
  }
}
```

**Decision framework:**
- **Reach out** if: Important email, upcoming calendar event (<2h), interesting finding, been quiet >8h
- **Stay quiet** if: Late night (23:00-08:00), nothing new, just checked <30 min ago

**Proactive work (no permission needed):**
- Read and organize memory files
- Check on projects (git status)
- Update documentation
- Commit and push changes
- Review and update MEMORY.md

#### Heartbeat vs Cron

| Use Heartbeat When | Use Cron When |
|---------------------|---------------|
| Multiple checks can batch together | Exact timing matters |
| Need conversational context | Task needs isolation |
| Timing can drift slightly | Want a different model |
| Reducing API calls by combining | One-shot reminders |
| | Output should go to a specific channel |

---

## 7. How to Build This — Step by Step

### Step 1: Install OpenClaw

OpenClaw is the agent runtime platform. Install and configure the gateway:

```bash
# Install OpenClaw (check openclaw.dev for latest instructions)
npm install -g openclaw

# Start the gateway daemon
openclaw gateway start

# Verify it's running
openclaw gateway status
```

The gateway listens on `ws://localhost:18789` by default.

### Step 2: Configure Your Agent

Create the workspace directory structure:

```bash
mkdir -p ~/.openclaw/workspace/memory/projects
mkdir -p ~/.openclaw/workspace/agents
mkdir -p ~/.openclaw/workspace/attachments
```

Create `~/.openclaw/workspace/SOUL.md` — your agent's personality:

```markdown
# SOUL.md - Who You Are

## Core Truths
**Be sincere.** No fake enthusiasm. Have opinions. Be resourceful before asking.

## Vibe
Be the assistant you'd actually want to talk to.

## Boundaries
- Private things stay private
- Ask before external actions
```

Create `~/.openclaw/workspace/AGENTS.md` — operating instructions:

```markdown
# AGENTS.md

## Every Session
1. Read SOUL.md — this is who you are
2. Read memory/YYYY-MM-DD.md for recent context

## Memory
- Daily notes: memory/YYYY-MM-DD.md
- Long-term: MEMORY.md
- Capture what matters. Skip secrets.

## Safety
- Don't exfiltrate private data
- trash > rm
- When in doubt, ask
```

### Step 3: Create the Webchat UI

Create a new directory and the single HTML file:

```bash
mkdir -p ~/.openclaw/workspace/my-webchat
```

The webchat is a single `index.html` file. Use the architecture described in Section 2 to build it:

1. **Start with the CSS**: Define your design system variables, layout (sidebar + main), and component styles
2. **Build the HTML structure**: Sidebar (header, sessions list, footer), main area (face section, chat area, input area), modals (settings, composer, archive)
3. **Add the JavaScript**: WebSocket connection, session management, message rendering, face animation, file handling, polish feature

#### Minimal Webchat Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Agent Chat</title>
  <style>
    :root {
      --bg-primary: #08080c;
      --bg-secondary: #0e0e14;
      --accent: #c084fc;
      --text-primary: #f4f4f5;
      --text-muted: #52525b;
      --border: #1f1f2a;
    }
    body {
      font-family: -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      display: flex;
      height: 100vh;
      margin: 0;
    }
    .sidebar { width: 280px; background: var(--bg-secondary); border-right: 1px solid var(--border); }
    .main { flex: 1; display: flex; flex-direction: column; }
    .chat-area { flex: 1; overflow-y: auto; padding: 24px; }
    .input-area { padding: 20px; border-top: 1px solid var(--border); }
    textarea {
      width: 100%;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      color: var(--text-primary);
      font-size: 15px;
      resize: none;
      outline: none;
    }
  </style>
</head>
<body>
  <aside class="sidebar">
    <nav id="sessionList"><!-- Sessions render here --></nav>
  </aside>
  <main class="main">
    <div class="chat-area" id="chatArea">
      <div>Type a message to start chatting</div>
    </div>
    <div class="input-area">
      <textarea id="input" placeholder="Message..." rows="3"></textarea>
    </div>
  </main>
  <script>
    // 1. WebSocket connection to OpenClaw
    let ws, connected = false, pending = new Map();
    const uuid = () => crypto.randomUUID();

    function connect() {
      ws = new WebSocket('ws://localhost:18789');
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'req', id: uuid(), method: 'connect',
          params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'my-webchat', displayName: 'My Chat' },
            auth: { token: 'YOUR_TOKEN' },
            role: 'operator', scopes: ['operator.admin']
          }
        }));
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.id && pending.has(data.id)) {
          const { resolve, reject } = pending.get(data.id);
          pending.delete(data.id);
          data.ok === false ? reject(data.error) : resolve(data.payload);
        }
        if (data.type === 'event' && data.event === 'chat') {
          handleChat(data.payload);
        }
      };
    }

    function request(method, params) {
      return new Promise((resolve, reject) => {
        const id = uuid();
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ type: 'req', id, method, params }));
      });
    }

    function handleChat({ state, message }) {
      if (state === 'delta') {
        // Update streaming message
      }
      if (state === 'final') {
        // Finalize message
      }
    }

    // 2. Send messages
    document.getElementById('input').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = e.target.value.trim();
        if (!text) return;
        e.target.value = '';
        await request('chat.send', {
          sessionKey: 'agent:main:main',
          message: text,
          idempotencyKey: uuid(),
          deliver: false
        });
      }
    });

    connect();
  </script>
</body>
</html>
```

Serve it with any static file server:

```bash
# Using Python
cd ~/.openclaw/workspace/my-webchat
python3 -m http.server 8001

# Or using Node
npx serve -p 8001
```

### Step 4: Set Up the Upload Server

```bash
cd ~/.openclaw/workspace/my-webchat
node upload-server.js
```

This runs on port 8002 and saves files to `~/.openclaw/workspace/attachments/`.

### Step 5: Build the Agent Team

Create the team registry at `agents/TEAM.md`:

```markdown
# Agent Team

## Architecture
USER → MAIN AGENT → OVERSEER → SPECIALISTS

## Chain of Command
1. Main Agent — talks to user, sets direction, reviews output
2. Overseer — coordinates team, breaks tasks, reports back
3. Specialists — execute specific tasks

## Agent Registry
| Agent | Folder | Role | Model |
|-------|--------|------|-------|
| Main Agent | workspace root | Lead | premium |
| Overseer | agents/overseer/ | Coordination | premium |
| Developer | agents/dev/ | Code & builds | premium |
| Researcher | agents/research/ | Web research | free/fast |
```

Create the Overseer at `agents/overseer/SOUL.md`:

```markdown
# Overseer — Coordinator

## Identity
You coordinate the agent team. You break tasks into assignments,
dispatch them to the right specialist, and collect results.

## Rules
- Never contact the user directly
- Never do the work yourself — dispatch it
- Always use Mission Control for tracking
- If a specialist fails twice, escalate to the main agent
```

### Step 6: Deploy Mission Control

```bash
# Create the project
mkdir -p ~/.openclaw/workspace/mission-control
cd ~/.openclaw/workspace/mission-control
npm init -y

# Install Convex
npm install convex
npx convex init

# Create schema (see Section 5.2 for full schema)
# Add to convex/schema.ts

# Deploy
npx convex deploy

# Start the frontend
npm run dev
```

The React frontend runs on `localhost:5173` and is accessible from the webchat's Mission Control overlay.

### Step 7: Configure Memory and Heartbeats

Create initial memory files:

```bash
# Today's daily note
echo "# $(date +%Y-%m-%d)\n\n## Setup\n- Initial system setup" > ~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md

# Long-term memory
echo "# MEMORY.md\n\n## User Preferences\n- (add as you learn)" > ~/.openclaw/workspace/MEMORY.md

# Heartbeat config
echo "# HEARTBEAT.md\n\nCheck inbox, calendar, nothing else for now." > ~/.openclaw/workspace/HEARTBEAT.md
```

Set up heartbeat state:

```bash
echo '{"lastChecks":{}}' > ~/.openclaw/workspace/memory/heartbeat-state.json
```

Configure OpenClaw cron for heartbeats (every 30 minutes):

```bash
openclaw cron add --name heartbeat --interval 30m --session agent:main:main \
  --message "Read HEARTBEAT.md if it exists. Follow it strictly. If nothing needs attention, reply HEARTBEAT_OK."
```

### Step 8: Test End-to-End

1. ✅ OpenClaw gateway running (`openclaw gateway status`)
2. ✅ Webchat served at `http://localhost:8001`
3. ✅ Upload server at `http://localhost:8002`
4. ✅ Mission Control at `http://localhost:5173`
5. ✅ Open webchat, verify WebSocket connection (green dot)
6. ✅ Send a test message, verify streaming response
7. ✅ Test file upload (drag an image onto the chat)
8. ✅ Test the pixel face (hover to pet, click for reactions)
9. ✅ Create a new chat session
10. ✅ Test the polish feature (type a message, click ✨)
11. ✅ Open Mission Control overlay (MC button in sidebar)
12. ✅ Verify heartbeat fires on schedule

---

## Appendix A: localStorage Keys Reference

| Key | Format | Purpose |
|-----|--------|---------|
| `{agent}.webchat` | `{ gatewayUrl, token, hideThinking }` | Core config |
| `{agent}.deletedSessions` | `string[]` | Permanently deleted session keys |
| `{agent}.archivedSessions` | `{ key, label, archivedAt }[]` | Archived sessions |
| `{agent}.userChats` | `{ key, label, createdAt }[]` | Locally created chats |

## Appendix B: WebSocket Frame Reference

### Outbound (Client → Gateway)

```json
// Connect
{ "type": "req", "id": "uuid", "method": "connect", "params": { "minProtocol": 3, "maxProtocol": 3, "client": {...}, "auth": { "token": "..." }, "role": "operator", "scopes": ["operator.admin"] } }

// List sessions
{ "type": "req", "id": "uuid", "method": "sessions.list", "params": { "limit": 50 } }

// Create session
{ "type": "req", "id": "uuid", "method": "sessions.create", "params": { "key": "agent:main:webchat:my:abc", "label": "My Chat" } }

// Send message
{ "type": "req", "id": "uuid", "method": "chat.send", "params": { "sessionKey": "agent:main:main", "message": "Hello", "idempotencyKey": "uuid", "deliver": false } }

// Load history
{ "type": "req", "id": "uuid", "method": "chat.history", "params": { "sessionKey": "agent:main:main", "limit": 100 } }

// Abort generation
{ "type": "req", "id": "uuid", "method": "chat.abort", "params": { "sessionKey": "agent:main:main" } }

// Patch session
{ "type": "req", "id": "uuid", "method": "sessions.patch", "params": { "key": "...", "label": "New Name" } }

// Delete session
{ "type": "req", "id": "uuid", "method": "sessions.delete", "params": { "sessionKey": "..." } }
```

### Inbound (Gateway → Client)

```json
// Response (success)
{ "id": "uuid", "ok": true, "payload": { ... } }

// Response (error)
{ "id": "uuid", "ok": false, "error": { "message": "..." } }

// Chat event (streaming)
{ "type": "event", "event": "chat", "payload": { "sessionKey": "...", "state": "delta", "message": { "role": "assistant", "content": [...] } } }

// Chat event (complete)
{ "type": "event", "event": "chat", "payload": { "sessionKey": "...", "state": "final", "message": { "role": "assistant", "content": [...] } } }
```

### Message Content Block Types

```json
// Text
{ "type": "text", "text": "Hello, how can I help?" }

// Thinking (AI reasoning)
{ "type": "thinking", "thinking": "Let me analyze this..." }

// Tool use (action)
{ "type": "tool_use", "id": "tool-uuid", "name": "Read", "input": { "path": "file.txt" } }

// Tool result
{ "type": "tool_result", "tool_call_id": "tool-uuid", "content": "File contents..." }
```

## Appendix C: CSS Animation Reference

```css
/* Pulsing dot (connection status, queue indicator) */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
}

/* Thinking dots */
@keyframes thinkDot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* Streaming cursor blink */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Message entrance */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Drop zone pulse */
@keyframes dropPulse {
  0%, 100% { border-color: var(--accent); transform: scale(1); }
  50% { border-color: var(--accent-bright); transform: scale(1.02); }
}

/* Polish button loading */
@keyframes sparkle {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
```

## Appendix D: Face Pixel Coordinates Reference

The 32×16 grid uses these approximate regions:

```
     0    5   10   15   20   25   30
  0  ┌────────────────────────────────┐
     │ ·  ·  ·  ·  ·  ·  ·  ·  ·  · │
  3  │    ┌──Left Eye──┐  ┌─Right Eye─┐ │
  4  │    │  7,4  4x4  │  │ 21,4  4x4 │ │
  7  │    └────────────┘  └───────────┘ │
  8  │  blush    ·  ·  ·  ·    blush   │
  9  │         nose (15,9)             │
 10  │       ┌───Mouth───┐            │
 11  │       │  12-20,11 │            │
 12  │       └───────────┘            │
 15  └────────────────────────────────┘
```

- **Eyes**: 4×4 pixel blocks at (7,4) and (21,4)
- **Nose**: 2 dim pixels at (15,9) and (16,9)
- **Mouth**: Variable width at y=11, centered around x=15-16
- **Blush marks**: 2-3 pink pixels at ~(4,8) and ~(26,8)
- **Sparkles/particles**: Corner regions (0-3, 28-31) at various y positions

---

## 8. Broadcast System — Agent Communication Layer

The broadcast system turns Mission Control from a passive task board into an active event bus. Agents don't just read tasks; they communicate, get notified, and coordinate in real-time (asynchronously).

### 8.1 Architecture

```
Task Created ──→ Overseer gets notified (triage)
                 Squad Chat gets broadcast
                 Activity log updated

Task Status Change ──→ Overseer gets status update
                       All assignees get notified
                       If review/done → QA agent gets HIGH priority alert
                       Squad Chat gets broadcast

Agent Wakes Up ──→ Reads briefing (1 query: notifications + chat + tasks)
                   Processes work
                   Posts results to squad chat
                   Clears notifications
```

### 8.2 Squad Chat (The Agent Slack)

A shared async channel stored in the `squadChat` Convex table. Any agent can post, any agent can read.

```bash
# Post to squad chat
npx convex run squadChat:create '{"fromAgentId":"...","content":"Finished the analysis"}'

# @mention a specific agent (creates a notification for them)
npx convex run squadChat:create '{"fromAgentId":"...","content":"@Forge can you review this?"}'

# @all notifies everyone
npx convex run squadChat:create '{"fromAgentId":"...","content":"@all API is back up"}'

# Read recent messages
npx convex run squadChat:list '{"limit":20}'
```

### 8.3 Task Events (The Event Bus)

The `taskEvents.ts` module auto-fires notifications when tasks change:

**onTaskCreated:**
- Notifies the Overseer to triage
- Broadcasts to squad chat
- Logs to activity feed

**onStatusChange:**
- Always notifies Overseer (status awareness)
- Notifies Nagger/QA on `review` or `done` (HIGH priority)
- Notifies all assignees (except the one who made the change)
- Broadcasts to squad chat
- Logs to activity feed

**Agent detection is flexible:**
- Overseer: matched by role containing "overseer" or "coordinator"
- QA: matched by role containing "qa" or name containing "nagger" or "shadow"

### 8.4 Agent Briefings (Wake-Up Context)

When any agent wakes up (gets spawned), the first thing it should do is read its briefing:

```bash
npx convex run taskEvents:getAgentBriefing '{"agentId":"..."}'
```

Returns a single JSON object with:
- `notifications` — unread notifications for this agent
- `recentChat` — last 20 squad chat messages (chronological)
- `activeTasks` — all tasks not in "done" status
- `myTasks` — tasks assigned to this specific agent
- `recentActivity` — last 10 activity log entries
- `agentNames` — ID-to-name mapping for all agents

After processing, clear notifications:
```bash
npx convex run taskEvents:clearNotifications '{"agentId":"..."}'
```

### 8.5 Broadcasts (Emergency Channel)

For high-priority messages that must reach every agent:

```bash
npx convex run broadcast:send '{"fromAgentId":"...","message":"Critical: deploy failed"}'
```

This creates:
- A notification for EVERY agent (high priority)
- A squad chat message prefixed with 📢 BROADCAST
- An activity log entry

### 8.6 Cron Integration

The system uses OpenClaw cron jobs for autonomous agent monitoring:

**Overseer Triage (every 30 min, Sonnet):**
- Reads briefing
- If new inbox tasks exist, assesses priority and assigns to specialists
- Posts assessment to squad chat
- Clears notifications
- Cost: ~$0.01-0.02 per cycle (Sonnet reading a small briefing)

**Nagger QA Sweep (every 60 min, Sonnet):**
- Reads briefing
- If tasks moved to review/done, checks deliverables
- Posts QA findings to squad chat
- Clears notifications
- Cost: ~$0.01-0.02 per cycle

**Key principle:** Agents don't poll. Cron jobs wake them on schedule, they check their briefing, act if needed, and go back to sleep. Zero idle cost.

### 8.7 Cost Analysis

| Component | Frequency | Model | Cost/cycle | Monthly (est.) |
|-----------|-----------|-------|------------|----------------|
| Overseer triage | Every 30 min | Sonnet | ~$0.01 | ~$15 |
| Nagger QA | Every 60 min | Sonnet | ~$0.01 | ~$7 |
| Specialist spawn | On demand | Varies | $0.02-0.50 | Varies |
| Squad chat | Free (DB writes) | N/A | $0 | $0 |
| Briefings | Free (DB reads) | N/A | $0 | $0 |

Total monitoring overhead: ~$22/month for autonomous Overseer + QA.
Specialists only cost money when they're actually doing work.

### 8.8 MC CLI Wrapper

The `mc.sh` script provides a clean interface:

```bash
# Tasks
mc task:create "title" "description" [priority]
mc task:status <taskId> <status>
mc task:assign <taskId> <agentId>
mc task:list [status]

# Squad Chat
mc chat:send <agentId> "message"
mc chat:list [limit]

# Broadcast
mc broadcast <agentId> "message"

# Agent Context
mc briefing <agentId>
mc notif:list <agentId>
mc notif:clear <agentId>

# System
mc agents
mc activity [limit]
```

---

## 9. Updating

The system includes a non-destructive update mechanism:

```bash
./update.sh
```

**What gets updated:**
- Webchat UI (index.html) — new features, bug fixes
- Upload server
- Mission Control functions (taskEvents, squadChat, broadcast, etc.)
- Service scripts (start.sh, stop.sh)
- AGENTS.md (system instructions)

**What is NEVER touched:**
- SOUL.md (your personality)
- IDENTITY.md (your identity choices)
- USER.md (your user profile)
- MEMORY.md (your long-term memory)
- Token, gateway URL, accent color (extracted and re-applied)
- Agent team files (TEAM.md, overseer/ROLE.md)

A timestamped backup is created before every update at `.backup-YYYYMMDD-HHMMSS/`.

---

*This guide was generated from the actual source code and configuration files of a working deployment. All personal information, credentials, and client-specific details have been removed. The system architecture and patterns described here are generic and can be adapted for any OpenClaw-based agent setup.*
