#!/usr/bin/env bash
set -euo pipefail

# Check all non-merge commit messages in this branch for conventional format.
# Types: feat, fix, refactor, chore, docs, test, ci, perf, style, revert

BASE="${GITHUB_BASE_REF:-master}"
FAILED=0

git log "origin/${BASE}..HEAD" --no-merges --pretty="%s" | while IFS= read -r msg; do
  if echo "$msg" | grep -qE '^Revert "'; then
    continue
  fi
  if ! echo "$msg" | grep -qE '^(feat|fix|refactor|chore|docs|test|ci|perf|style|revert)(\([a-zA-Z0-9_-]+\))?: .+'; then
    echo "❌ $msg"
    FAILED=1
  fi
done

exit $FAILED
