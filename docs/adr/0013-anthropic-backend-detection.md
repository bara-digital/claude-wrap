---
Status: accepted
---

# Single canonical predicate for Anthropic backend detection

claude-wrap classifies a backend as "Anthropic" vs "non-Anthropic" using one canonical predicate: `base_url.startsWith("https://api.anthropic.com")`. This single boolean drives two behaviors: whether `ANTHROPIC_BASE_URL` is emitted (env.ts:77 — skipped for Anthropic so Claude Code's default model resolution is preserved; see ADR 0002) and whether `--bare` is auto-injected (index.ts:552 computes `isAnthropic` and passes it to the launcher; see ADR 0006). One predicate keeps a single source of truth for "is this the real Anthropic endpoint?", avoiding a per-preset `isAnthropic` flag that users could set inconsistently with `base_url`. The check is a simple, dependency-free string prefix.

This ADR is the owner of the detection rule; ADR 0002, ADR 0006, and the glossary reference it.

## Consequences

- The rule is currently duplicated in two places — index.ts:552 and env.ts:77 — which risks drift if one is changed without the other. A future refactor could centralize it behind a shared helper.
- The exact-prefix match means any Anthropic endpoint not under `https://api.anthropic.com` (e.g. a regional or gateway host) would be treated as non-Anthropic, causing `ANTHROPIC_BASE_URL` to be set and `--bare` to be injected for it.
