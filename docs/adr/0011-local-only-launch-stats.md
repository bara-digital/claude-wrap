---
Status: accepted
---

# Local-only launch statistics

Launch statistics (per-preset counts) are stored ONLY locally, in a plain JSON file at `$XDG_STATE_HOME/claude-wrap/stats.json` (see ADR 0012 for the location convention) written with `0600` permissions, and nothing is ever transmitted off the machine — there is no remote telemetry or analytics endpoint. This is a deliberate privacy-first choice: users can see their own usage via `--stats` without any data leaving their machine, so there are no network calls on launch and no consent/opt-out machinery. Two distinct guarantees apply: the code never transmits the file (no network I/O in `stats.ts` — it imports only `node:fs`/`node:path`/`node:os`) and it restricts access to the owner with `0600` perms (`stats.ts:28`). It does **not** guarantee the stored content is non-PII — preset names are arbitrary user-defined keys (`stats.ts:33`) and could themselves contain PII — so the guarantee is *no off-machine / transmitted PII risk*, not zero PII content.

## Consequences

- Stats are per-machine only and are lost if the state directory is cleared.
- There is intentionally no aggregate or usage visibility for maintainers.
