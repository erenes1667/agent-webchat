#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Agent Webchat - Update Script
#  Updates system files without touching your customizations
#  Usage: ./update.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

REPO="erenes1667/agent-webchat"
BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

echo ""
echo -e "${BOLD}🔄 Agent Webchat Updater${RESET}"
echo ""

# ─── Detect install directory ─────────────────────────────────
# Search: current dir, common locations, then ask
if [[ -f "./webchat/index.html" ]]; then
  INSTALL_DIR="."
elif [[ -f "./agent-webchat/webchat/index.html" ]]; then
  INSTALL_DIR="./agent-webchat"
else
  # Search common locations
  FOUND=""
  for candidate in "$HOME/agent-webchat" "$HOME/Desktop/agent-webchat" "$HOME/.openclaw/workspace"; do
    if [[ -f "${candidate}/webchat/index.html" ]]; then
      FOUND="$candidate"
      break
    fi
  done
  # Also search one level deep in current dir
  if [[ -z "$FOUND" ]]; then
    for d in ./*/; do
      if [[ -f "${d}webchat/index.html" ]]; then
        FOUND="${d%/}"
        break
      fi
    done
  fi

  if [[ -n "$FOUND" ]]; then
    echo -e "  Found installation at: ${CYAN}${FOUND}${RESET}"
    echo -ne "  ${BOLD}Use this?${RESET} [Y/n]: "
    read -r CONFIRM
    if [[ "${CONFIRM:-y}" =~ ^[Yy]?$ ]]; then
      INSTALL_DIR="$FOUND"
    else
      echo -ne "  ${BOLD}Enter your install directory:${RESET} "
      read -r INSTALL_DIR
    fi
  else
    echo -e "${YELLOW}⚠ Can't auto-detect your installation.${RESET}"
    echo -ne "  ${BOLD}Enter your install directory${RESET} (where SOUL.md is): "
    read -r INSTALL_DIR
  fi

  if [[ ! -f "${INSTALL_DIR}/webchat/index.html" ]]; then
    echo -e "${RED}✗ No webchat found at ${INSTALL_DIR}/webchat/index.html${RESET}"
    exit 1
  fi
fi

INSTALL_DIR=$(cd "$INSTALL_DIR" && pwd)
echo -e "  Found installation at: ${CYAN}${INSTALL_DIR}${RESET}"

# ─── Backup user files ──────────────────────────────────────
BACKUP_DIR="${INSTALL_DIR}/.backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "\n${BOLD}📦 Backing up your customizations...${RESET}"

# These are YOUR files - never overwritten
USER_FILES=(
  "SOUL.md"
  "IDENTITY.md"
  "USER.md"
  "MEMORY.md"
  "HEARTBEAT.md"
  "agents/TEAM.md"
  "agents/overseer/ROLE.md"
  "agents/overseer/SCRATCHPAD.md"
)

for f in "${USER_FILES[@]}"; do
  if [[ -f "${INSTALL_DIR}/${f}" ]]; then
    mkdir -p "${BACKUP_DIR}/$(dirname "$f")"
    cp "${INSTALL_DIR}/${f}" "${BACKUP_DIR}/${f}"
  fi
done

# Also backup the current webchat config (token, gateway URL)
if [[ -f "${INSTALL_DIR}/webchat/index.html" ]]; then
  # Extract current config
  CURRENT_TOKEN=$(grep -o "token: '[^']*'" "${INSTALL_DIR}/webchat/index.html" | head -1 | sed "s/token: '//;s/'//")
  CURRENT_GW=$(grep -o "gatewayUrl: '[^']*'" "${INSTALL_DIR}/webchat/index.html" | head -1 | sed "s/gatewayUrl: '//;s/'//")
  CURRENT_EMOJI=$(grep -o "AGENT_EMOJI = '[^']*'" "${INSTALL_DIR}/webchat/index.html" | head -1 | sed "s/AGENT_EMOJI = '//;s/'//")
  CURRENT_NAME=$(grep -o "<title>[^<]*</title>" "${INSTALL_DIR}/webchat/index.html" | head -1 | sed "s/<title>//;s/<\/title>//")
  CURRENT_ACCENT=$(grep -o "\-\-accent: [^;]*;" "${INSTALL_DIR}/webchat/index.html" | head -1 | sed "s/--accent: //;s/;//")
  
  echo -e "  ${GREEN}✓${RESET} Saved config: ${DIM}${CURRENT_NAME} ${CURRENT_EMOJI} (${CURRENT_ACCENT})${RESET}"
fi

cp "${INSTALL_DIR}/webchat/index.html" "${BACKUP_DIR}/index.html.bak" 2>/dev/null || true
echo -e "  ${GREEN}✓${RESET} Backup saved to ${DIM}${BACKUP_DIR}${RESET}"

# ─── Download latest system files ────────────────────────────
echo -e "\n${BOLD}⬇️  Downloading latest version...${RESET}"

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Download the setup script (contains the latest webchat HTML)
curl -fsSL "${RAW}/setup.sh" -o "${TMPDIR}/setup.sh" 2>/dev/null
echo -e "  ${GREEN}✓${RESET} Downloaded setup.sh"

# Download MC templates
for f in schema.ts taskEvents.ts tasks.ts agents.ts messages.ts squadChat.ts broadcast.ts notifications.ts activities.ts documents.ts; do
  curl -fsSL "${RAW}/mission-control-template/${f}" -o "${TMPDIR}/${f}" 2>/dev/null && \
    echo -e "  ${GREEN}✓${RESET} ${f}" || \
    echo -e "  ${YELLOW}⚠${RESET} ${f} (skipped)"
done

# Download mc.sh
curl -fsSL "${RAW}/mc.sh" -o "${TMPDIR}/mc.sh" 2>/dev/null && \
  echo -e "  ${GREEN}✓${RESET} mc.sh" || true

# Download GUIDE.md
curl -fsSL "${RAW}/GUIDE.md" -o "${TMPDIR}/GUIDE.md" 2>/dev/null && \
  echo -e "  ${GREEN}✓${RESET} GUIDE.md" || true

# ─── Extract and update webchat HTML ─────────────────────────
echo -e "\n${BOLD}🔧 Updating system files...${RESET}"

# The tricky part: we need to regenerate the webchat HTML from setup.sh
# but preserve the user's customizations (token, name, emoji, color)

# Extract the HTML from setup.sh (between HTMLEOF markers)
if grep -q "HTMLEOF" "${TMPDIR}/setup.sh"; then
  # Extract HTML template
  sed -n '/^cat > .*index\.html.*HTMLEOF/,/^HTMLEOF$/p' "${TMPDIR}/setup.sh" | \
    tail -n +2 | sed "$d" > "${TMPDIR}/index.html.template"
  
  if [[ -s "${TMPDIR}/index.html.template" ]]; then
    # Portable sed -i (macOS vs Linux)
    ised() { sed -i '' "$@" 2>/dev/null || sed -i "$@" 2>/dev/null || true; }

    # Apply user's customizations to the new template
    # These match the __PLACEHOLDER__ format used in setup.sh
    if [[ -n "${CURRENT_NAME:-}" ]]; then
      ised "s|__AGENT_NAME__|${CURRENT_NAME}|g" "${TMPDIR}/index.html.template"
      CURRENT_NAME_LOWER=$(echo "$CURRENT_NAME" | tr '[:upper:]' '[:lower:]')
      ised "s|__AGENT_NAME_LOWER__|${CURRENT_NAME_LOWER}|g" "${TMPDIR}/index.html.template"
      ised "s|<title>[^<]*</title>|<title>${CURRENT_NAME}</title>|" "${TMPDIR}/index.html.template"
    fi

    if [[ -n "${CURRENT_TOKEN:-}" ]]; then
      ised "s|token: '[^']*'|token: '${CURRENT_TOKEN}'|" "${TMPDIR}/index.html.template"
    fi
    
    if [[ -n "${CURRENT_GW:-}" ]]; then
      ised "s|gatewayUrl: '[^']*'|gatewayUrl: '${CURRENT_GW}'|" "${TMPDIR}/index.html.template"
    fi
    
    if [[ -n "${CURRENT_EMOJI:-}" ]]; then
      ised "s|__AGENT_EMOJI__|${CURRENT_EMOJI}|g" "${TMPDIR}/index.html.template"
      ised "s|AGENT_EMOJI = '[^']*'|AGENT_EMOJI = '${CURRENT_EMOJI}'|" "${TMPDIR}/index.html.template"
    fi

    if [[ -n "${CURRENT_ACCENT:-}" ]]; then
      ised "s|--accent: [^;]*;|--accent: ${CURRENT_ACCENT};|" "${TMPDIR}/index.html.template"
      # Derive bright/dim/glow from accent (hex color math)
      # Simple approach: just replace the first occurrence of each
      ACCENT_BRIGHT=$(echo "${CURRENT_ACCENT}" | sed 's/#//' | awk '{printf "#%02x%02x%02x", int("0x"substr($0,1,2))*1.2>255?255:int("0x"substr($0,1,2))*1.2, int("0x"substr($0,3,2))*1.2>255?255:int("0x"substr($0,3,2))*1.2, int("0x"substr($0,5,2))*1.2>255?255:int("0x"substr($0,5,2))*1.2}' 2>/dev/null || echo "${CURRENT_ACCENT}")
      ised "s|--accent-bright: [^;]*;|--accent-bright: ${ACCENT_BRIGHT};|" "${TMPDIR}/index.html.template"
    fi

    cp "${TMPDIR}/index.html.template" "${INSTALL_DIR}/webchat/index.html"
    echo -e "  ${GREEN}✓${RESET} webchat/index.html updated (your config preserved)"
  else
    echo -e "  ${YELLOW}⚠${RESET} Couldn't extract HTML from setup.sh, keeping current version"
  fi
else
  echo -e "  ${YELLOW}⚠${RESET} No HTML template found in setup.sh, keeping current version"
fi

# Update upload server (safe to overwrite)
if grep -q "upload" "${TMPDIR}/setup.sh"; then
  sed -n '/^cat > .*upload-server\.js.*UPLOAD_EOF/,/^UPLOAD_EOF$/p' "${TMPDIR}/setup.sh" | \
    tail -n +2 | sed "$d" > "${TMPDIR}/upload-server.js"
  if [[ -s "${TMPDIR}/upload-server.js" ]]; then
    cp "${TMPDIR}/upload-server.js" "${INSTALL_DIR}/webchat/upload-server.js"
    echo -e "  ${GREEN}✓${RESET} webchat/upload-server.js updated"
  fi
fi

# Update Mission Control templates (if MC directory exists)
if [[ -d "${INSTALL_DIR}/mission-control/convex" ]]; then
  for f in taskEvents.ts squadChat.ts broadcast.ts notifications.ts activities.ts; do
    if [[ -f "${TMPDIR}/${f}" ]]; then
      cp "${TMPDIR}/${f}" "${INSTALL_DIR}/mission-control/convex/${f}"
      echo -e "  ${GREEN}✓${RESET} mission-control/convex/${f}"
    fi
  done
  echo -e "  ${DIM}  Note: Run 'npx convex dev --once' in mission-control/ to deploy${RESET}"
elif [[ -d "${INSTALL_DIR}/mission-control-template" ]]; then
  # Just update the templates
  mkdir -p "${INSTALL_DIR}/mission-control-template"
  for f in "${TMPDIR}"/*.ts; do
    [[ -f "$f" ]] && cp "$f" "${INSTALL_DIR}/mission-control-template/"
  done
  echo -e "  ${GREEN}✓${RESET} mission-control-template/ updated"
fi

# Update mc.sh
if [[ -f "${TMPDIR}/mc.sh" ]]; then
  cp "${TMPDIR}/mc.sh" "${INSTALL_DIR}/mc.sh"
  chmod +x "${INSTALL_DIR}/mc.sh"
  echo -e "  ${GREEN}✓${RESET} mc.sh updated"
fi

# Update AGENTS.md (system instructions, safe to update)
if grep -q "AGENTS_STATIC\|AGENTS.md" "${TMPDIR}/setup.sh"; then
  sed -n '/^cat > .*AGENTS\.md.*AGENTS_STATIC/,/^AGENTS_STATIC$/p' "${TMPDIR}/setup.sh" | \
    tail -n +2 | sed "$d" > "${TMPDIR}/AGENTS.md.new"
  if [[ -s "${TMPDIR}/AGENTS.md.new" ]]; then
    cp "${TMPDIR}/AGENTS.md.new" "${INSTALL_DIR}/AGENTS.md"
    echo -e "  ${GREEN}✓${RESET} AGENTS.md updated (system instructions)"
  fi
fi

# Update start.sh and stop.sh
for script in start.sh stop.sh; do
  MARKER=$(echo "$script" | tr '.' '_' | tr '[:lower:]' '[:upper:]')_EOF
  if grep -q "${MARKER}\|${script}" "${TMPDIR}/setup.sh"; then
    sed -n "/^cat > .*${script}.*EOF/,/^.*EOF$/p" "${TMPDIR}/setup.sh" | \
      tail -n +2 | sed "$d" > "${TMPDIR}/${script}.new" 2>/dev/null
    if [[ -s "${TMPDIR}/${script}.new" ]]; then
      cp "${TMPDIR}/${script}.new" "${INSTALL_DIR}/${script}"
      chmod +x "${INSTALL_DIR}/${script}"
      echo -e "  ${GREEN}✓${RESET} ${script}"
    fi
  fi
done

# ─── Preserve user files ─────────────────────────────────────
echo -e "\n${BOLD}🔒 Verifying your files are untouched...${RESET}"
SAFE=true
for f in "${USER_FILES[@]}"; do
  if [[ -f "${INSTALL_DIR}/${f}" ]]; then
    if diff -q "${INSTALL_DIR}/${f}" "${BACKUP_DIR}/${f}" &>/dev/null; then
      echo -e "  ${GREEN}✓${RESET} ${f} ${DIM}(unchanged)${RESET}"
    else
      echo -e "  ${YELLOW}⚠${RESET} ${f} was modified! Restoring from backup..."
      cp "${BACKUP_DIR}/${f}" "${INSTALL_DIR}/${f}"
      SAFE=false
    fi
  fi
done

if $SAFE; then
  echo -e "  ${DIM}All your customizations are safe.${RESET}"
fi

# ─── Summary ─────────────────────────────────────────────────
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}  ✓ Update complete!${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}Updated:${RESET} webchat UI, upload server, MC functions, scripts"
echo -e "  ${BOLD}Preserved:${RESET} SOUL.md, IDENTITY.md, USER.md, MEMORY.md, config"
echo -e "  ${BOLD}Backup:${RESET} ${DIM}${BACKUP_DIR}${RESET}"
echo ""
echo -e "  ${DIM}Restart your services to apply:${RESET}"
echo -e "  ${CYAN}./stop.sh && ./start.sh${RESET}"
echo ""
