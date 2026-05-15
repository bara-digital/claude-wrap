#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.4.0"
  exit 1
fi

# Strip leading 'v' if present
VERSION="${VERSION#v}"

echo "Releasing v${VERSION}..."

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working directory is not clean. Commit or stash changes first."
  exit 1
fi

# Update version files
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "Error: version must be semver (e.g. 0.4.0)"
  exit 1
}

echo "  → Updating src/version.ts"
sed -i '' "s/VERSION = \".*\"/VERSION = \"${VERSION}\"/" src/version.ts

echo "  → Updating package.json"
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json

# Typecheck
echo "  → Typechecking..."
bun run typecheck

# Test
echo "  → Running tests..."
bun test

# Build
echo "  → Building..."
bun run build

# Install locally to verify
echo "  → Verifying binary..."
VERSION_CHECK=$(./dist/claude-wrap --version)
if [ "$VERSION_CHECK" != "$VERSION" ]; then
  echo "Error: built binary reports version '${VERSION_CHECK}', expected '${VERSION}'"
  exit 1
fi
echo "  → Binary reports v${VERSION_CHECK} ✓"

# Commit
echo "  → Committing..."
git add src/version.ts package.json
git commit -m "chore: bump to v${VERSION}"

# Tag
echo "  → Tagging v${VERSION}..."
git tag "v${VERSION}"

# Push
echo "  → Pushing..."
git push origin master
git push origin "v${VERSION}"

echo ""
echo "  Released v${VERSION} ✓"
echo "  https://github.com/bara-digital/claude-wrap/releases/tag/v${VERSION}"
