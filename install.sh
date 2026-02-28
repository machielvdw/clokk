#!/bin/sh
set -eu

# ── Helpers ──────────────────────────────────────────────────────────

BOLD=""
GREEN=""
RED=""
RESET=""

if [ -t 1 ]; then
  BOLD="\033[1m"
  GREEN="\033[0;32m"
  RED="\033[0;31m"
  RESET="\033[0m"
fi

info() { printf "${BOLD}>${RESET} %s\n" "$*"; }
success() { printf "${GREEN}>${RESET} %s\n" "$*"; }
error() { printf "${RED}error:${RESET} %s\n" "$*" >&2; exit 1; }

# ── Prerequisites ────────────────────────────────────────────────────

command -v curl >/dev/null 2>&1 || error "curl is required but not found"

# ── Detect platform ──────────────────────────────────────────────────

OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)      error "Unsupported OS: $OS" ;;
esac

case "$ARCH" in
  x86_64)  arch="x64" ;;
  aarch64) arch="arm64" ;;
  arm64)   arch="arm64" ;;
  *)       error "Unsupported architecture: $ARCH" ;;
esac

ARTIFACT="clokk-${os}-${arch}"

# ── Install ──────────────────────────────────────────────────────────

INSTALL_DIR="${CLOKK_INSTALL:-$HOME/.clokk/bin}"
BINARY="$INSTALL_DIR/clokk"
URL="https://github.com/machielvdw/clokk/releases/latest/download/$ARTIFACT"
TMPFILE="${TMPDIR:-/tmp}/clokk-download-$$"

info "Downloading clokk for ${os}-${arch}..."

if ! curl -fsSL "$URL" -o "$TMPFILE" 2>/dev/null; then
  rm -f "$TMPFILE"
  error "Download failed. Check https://github.com/machielvdw/clokk/releases for available binaries."
fi

mkdir -p "$INSTALL_DIR"
mv "$TMPFILE" "$BINARY"
chmod 755 "$BINARY"

success "Installed clokk to $BINARY"

# ── Add to PATH ──────────────────────────────────────────────────────

add_to_path() {
  SHELL_NAME=$(basename "${SHELL:-/bin/sh}")
  EXPORT_LINE="export PATH=\"$INSTALL_DIR:\$PATH\""

  case "$SHELL_NAME" in
    zsh)
      PROFILE="$HOME/.zshrc"
      ;;
    bash)
      if [ -f "$HOME/.bashrc" ]; then
        PROFILE="$HOME/.bashrc"
      else
        PROFILE="$HOME/.bash_profile"
      fi
      ;;
    fish)
      PROFILE="$HOME/.config/fish/config.fish"
      EXPORT_LINE="fish_add_path $INSTALL_DIR"
      ;;
    *)
      PROFILE=""
      ;;
  esac

  # Already on PATH — nothing to do
  case ":${PATH}:" in
    *":$INSTALL_DIR:"*) return 0 ;;
  esac

  if [ -n "$PROFILE" ]; then
    # Don't duplicate if already in the config file
    if [ -f "$PROFILE" ] && grep -qF "$INSTALL_DIR" "$PROFILE" 2>/dev/null; then
      return 0
    fi
    printf "\n# clokk\n%s\n" "$EXPORT_LINE" >> "$PROFILE"
    info "Added $INSTALL_DIR to PATH in $PROFILE"
    info "Restart your terminal or run \"source $PROFILE\" to use clokk."
  else
    info "Add $INSTALL_DIR to your PATH to use clokk from anywhere."
  fi
}

add_to_path

# ── Done ─────────────────────────────────────────────────────────────

printf "\n"
success "clokk is ready! Run \"clokk --help\" to get started."
info "Using an AI agent? Run \"clokk usage\" for integration docs."
