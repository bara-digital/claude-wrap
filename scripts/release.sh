#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.4.0"
  echo ""
  echo "This bumps versions and commits. Push a PR to master."
  echo "The release workflow auto-tags and publishes on merge."
  exit 1
fi

# Strip leading 'v' if present
VERSION="${VERSION#v}"

echo "Preparing v${VERSION} for PR..."

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working directory is not clean. Commit or stash changes first."
  exit 1
fi

echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "Error: version must be semver (e.g. 0.4.0)"
  exit 1
}

BRANCH="release/v${VERSION}"
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "Branch $BRANCH already exists. Delete it first or use a different version."
  exit 1
fi

# Create branch
git checkout -b "$BRANCH"

# Update version files
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

# Verify binary
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

echo ""
echo "  Ready for PR ✓"
echo "  Branch: $BRANCH"
echo ""
echo "Next:"
echo "  git push origin $BRANCH"
echo "  gh pr create --title \"Release v${VERSION}\" --body \"Bump version to v${VERSION}\" --base master"
echo ""
echo "After merge, the release workflow auto-tags and publishes:"
echo "  https://github.com/bara-digital/claude-wrap/releases/tag/v${VERSION}"
