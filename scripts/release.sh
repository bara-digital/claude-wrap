#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.4.0"
  echo ""
  echo "Steps:"
  echo "  1. Bumps version in src/version.ts and package.json"
  echo "  2. Typechecks, tests, and builds"
  echo "  3. Creates a PR branch and pushes it"
  echo "  4. Creates a GitHub PR"
  echo ""
  echo "After the PR is merged:"
  echo "  git checkout master && git pull"
  echo "  git tag v<VERSION> && git push origin v<VERSION>"
  exit 1
fi

VERSION="${VERSION#v}"

echo "Preparing v${VERSION}..."

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working directory is not clean."
  exit 1
fi

echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "Error: version must be semver (e.g. 0.4.0)"
  exit 1
}

BRANCH="release/v${VERSION}"
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "Branch $BRANCH already exists. Delete or use a different version."
  exit 1
fi

git checkout -b "$BRANCH"

echo "  → Updating src/version.ts"
sed -i '' "s/VERSION = \".*\"/VERSION = \"${VERSION}\"/" src/version.ts

echo "  → Updating package.json"
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json

echo "  → Typechecking..."
bun run typecheck

echo "  → Running tests..."
bun test

echo "  → Building..."
bun run build

VERSION_CHECK=$(./dist/claude-wrap --version)
if [ "$VERSION_CHECK" != "$VERSION" ]; then
  echo "Error: binary reports '${VERSION_CHECK}', expected '${VERSION}'"
  exit 1
fi
echo "  → Binary v${VERSION_CHECK} ✓"

echo "  → Committing..."
git add src/version.ts package.json
git commit -m "chore: bump to v${VERSION}"

echo "  → Pushing branch..."
git push origin "$BRANCH"

echo "  → Creating PR..."
PR_URL=$(gh pr create \
  --title "Release v${VERSION}" \
  --body "Bump version to v${VERSION}. After merge, tag to release:

\`\`\`bash
git checkout master && git pull
git tag v${VERSION} && git push origin v${VERSION}
\`\`\`" \
  --base master 2>&1)

echo ""
echo "  PR created: $PR_URL"
echo ""
echo "After merge, run:"
echo "  git checkout master && git pull"
echo "  git tag v${VERSION} && git push origin v${VERSION}"
echo ""
echo "  Release: https://github.com/bara-digital/claude-wrap/releases/tag/v${VERSION}"
