---
Status: accepted
---

# Var resolution and dotenv

Credential and config values may contain `$VAR` or `${VAR}` references that are resolved at launch from a combined environment of a single nearest `.env` file plus the shell environment, with the real shell environment taking precedence over `.env`. An unresolved reference is a hard error that throws, never a silent empty string.

## Consequences

- Shell environment overrides `.env` values (combined env is `{ ...dotEnv, ...process.env }`), so an exported shell variable wins over a value in a local `.env`.
- Exactly one `.env` is loaded: `walkUpEnv` walks up from the launch directory (`process.cwd()`) and returns the **first** `.env` it finds, then stops — it does not merge multiple walk-up `.env` files. `loadDotEnv` parses only that single nearest file (`{}` if none is found). The combined env is therefore `{ <nearest .env>, ...process.env }`, with shell env winning. This ADR owns the `.env` walk-up convention (`walkUpEnv`, `src/env.ts`); it mirrors — but is a separate mechanism from — the local-config walk-up used to find `.claude-wrap.yaml` (ADR 0003).
- A typo'd `$VAR` aborts the launch with a clear error rather than sending an empty credential that would surface as a confusing downstream auth failure.
- A second throw path exists beyond the unset-var case: the `BLOCKED_ENV_VARS` guard in `resolveEnv` throws an error of the form `Cannot override protected environment variable: <key>` for any `extra_env` key matching the denylist. Matching is exact (case-insensitive), not prefix-based — e.g. `LD_DEBUG` is *not* blocked. The canonical denylist and its contents are owned by ADR 0007 (see ADR 0007).
