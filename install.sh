#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Agent Webchat - Remote Installer
#  Usage: curl -fsSL https://raw.githubusercontent.com/erenes1667/agent-webchat/main/install.sh | bash
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

REPO="erenes1667/agent-webchat"
BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}🤖 Agent Webchat Installer${RESET}"
echo -e "${DIM}Downloading setup script...${RESET}"
echo ""

# Check dependencies
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js is required but not installed.${RESET}"
  echo -e "${DIM}  Install: https://nodejs.org${RESET}"
  exit 1
fi

if ! command -v bash &>/dev/null; then
  echo -e "${RED}✗ Bash is required.${RESET}"
  exit 1
fi

# Create temp dir and download
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

curl -fsSL "${RAW}/setup.sh" -o "${TMPDIR}/setup.sh"
chmod +x "${TMPDIR}/setup.sh"

echo -e "${GREEN}✓${RESET} Downloaded setup script"
echo ""

# Run the interactive setup
exec bash "${TMPDIR}/setup.sh"
