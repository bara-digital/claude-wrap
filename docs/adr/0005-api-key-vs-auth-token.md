---
Status: accepted
---

# Two distinct credential fields: `api_key` and `auth_token`

A preset exposes two separate credential fields — `api_key` (→ `ANTHROPIC_API_KEY`, sent as the `x-api-key` header) and `auth_token` (→ `ANTHROPIC_AUTH_TOKEN`, sent as `Authorization: Bearer`). They are kept distinct rather than collapsed into a single generic "key" field, and a preset is expected to set exactly one of them. This makes the auth scheme unambiguous: a Bearer-only gateway (e.g. Morph) sets `auth_token` and leaves `ANTHROPIC_API_KEY` unset, so Claude Code never falls back to Anthropic auth.

## Consequences

- Set exactly one of `api_key` / `auth_token` per preset.
- Setting both triggers Claude Code's dual-credential warning (README documents that Claude Code warns when both env vars are present).
- A Bearer-only gateway leaves `ANTHROPIC_API_KEY` unset intentionally (see `env.ts` — each field maps to its own env var, independently).
- Both `api_key` and `auth_token` values are passed through `resolveVar` (`env.ts:86` and `env.ts:91`), so they support `$VAR` / `${VAR}` expansion from shell env and walk-up `.env`. A missing referenced variable throws a hard error (see ADR 0008 for the resolution mechanism).
