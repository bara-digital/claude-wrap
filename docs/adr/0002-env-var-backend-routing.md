---
Status: accepted
---

# Backends selected via Claude Code's own environment variables

A backend is chosen purely by setting Claude Code's own environment variables from a preset: `ANTHROPIC_MODEL` (from `preset.model`), `ANTHROPIC_BASE_URL` (from `preset.base_url`), `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` (credentials — see ADR 0005), plus `preset.extra_env` passthrough — all assembled in `resolveEnv` (`src/env.ts`). We decided this so `claude-wrap` reuses Claude Code's official, stable configuration surface instead of any private mechanism; this is exactly what makes the wrapper-not-fork approach (ADR 0001) work.

## Consequences

- **Do not "simplify" the conditional on `ANTHROPIC_BASE_URL`.** In `resolveEnv` (`src/env.ts:75-79`), `ANTHROPIC_BASE_URL` is set only when `preset.base_url` does *not* start with `https://api.anthropic.com`. When it does, the variable is deliberately left unset. Setting it to the default Anthropic URL changes how Claude Code resolves models, so an unqualified "always set `ANTHROPIC_BASE_URL` for every preset" change would break Anthropic model resolution. Keep the conditional (Anthropic-vs-non-Anthropic detection owned by ADR 0013).
- `preset.extra_env` is passed through verbatim (after variable expansion via `resolveVar` — see ADR 0008), allowing arbitrary additional Claude Code env knobs (e.g. `ANTHROPIC_DEFAULT_*_MODEL`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) without wrapper changes; protected host vars (`PATH`, `HOME`, `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH`, etc.) are blocked from override by `BLOCKED_ENV_VARS`, a case-insensitive denylist matched on the uppercased key (owned by ADR 0007).
- `resolveVar` (`src/env.ts:54-67`) throws when a `$VAR` / `${VAR}` reference is unset, and `resolveEnv` propagates that error — so a preset referencing a missing credential aborts backend routing with a hard error rather than silently routing.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are both honored (credential distinction owned by ADR 0005): gateways that use a Bearer token instead of `x-api-key` set `auth_token` and leave `api_key` unset, so Claude Code routes through the gateway.
- The wrapper's backend-routing capability is bounded by the same `ANTHROPIC_*` surface ADR 0001 depends on; any breaking change to that surface affects this routing directly.
