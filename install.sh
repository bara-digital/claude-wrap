#!/usr/bin/env bash
set -euo pipefail

REPO="bara-digital/claude-wrap"
VERSION="${CLAUDE_WRAP_VERSION:-latest}"
INSTALL_DIR="${CLAUDE_WRAP_INSTALL_DIR:-/usr/local/bin}"

# Determine platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64|amd64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

case "$OS" in
  darwin)  PLATFORM="darwin" ;;
  linux)   PLATFORM="linux" ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

BINARY="claude-wrap-${PLATFORM}-${ARCH}"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading claude-wrap ${VERSION} (${PLATFORM}/${ARCH})..."

if [ "$VERSION" = "latest" ]; then
  DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY}"
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY}"
fi

if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "${TMP_DIR}/claude-wrap"
elif command -v wget &>/dev/null; then
  wget -q "$DOWNLOAD_URL" -O "${TMP_DIR}/claude-wrap"
else
  echo "Neither curl nor wget found. Install one and try again."
  exit 1
fi

chmod +x "${TMP_DIR}/claude-wrap"

if [ -w "$INSTALL_DIR" ]; then
  mv "${TMP_DIR}/claude-wrap" "${INSTALL_DIR}/claude-wrap"
else
  sudo mv "${TMP_DIR}/claude-wrap" "${INSTALL_DIR}/claude-wrap"
fi

echo "Installed claude-wrap to ${INSTALL_DIR}/claude-wrap"
echo ""
echo "Quick start:"
echo "  claude-wrap --init"
echo "  claude-wrap"
