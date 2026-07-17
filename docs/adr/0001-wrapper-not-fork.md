---
Status: accepted
---

# Wrapper, not fork

`claude-wrap` is a thin wrapper that resolves a preset's config into `ANTHROPIC_*` environment variables (see `src/env.ts`) and spawns the stock, unmodified `claude` binary via `child_process` with stdio inherited (`execClaude` in `src/launcher.ts`) — it does NOT fork, patch, or redistribute Claude Code.

The env-var emission is conditional: `ANTHROPIC_BASE_URL` is skipped for Anthropic-default endpoints (`env.ts:77`, deliberate — setting it changes how Claude Code resolves models), and `ANTHROPIC_MODEL`/`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` are emitted only when the preset actually provides them. Beyond env resolution, the wrapper also injects the `--bare` CLI flag for non-Anthropic backends (`launcher.ts:18`) and supports `extra_env` / `$VAR` interpolation, guarded by a protected-variable blocklist (`env.ts:97`).

Rationale:

- **Upgrade durability** (dominant driver) — a fork would have to chase every Claude Code release, whereas env-var wrapping survives upgrades untouched.
- **Official env hooks** — Claude Code already honors `ANTHROPIC_BASE_URL`/`ANTHROPIC_MODEL`/`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`, so no patching is needed.
- **Legal/trust** — redistributing a patched closed-source binary raises licensing and trust concerns.
- **Zero user lock-in** — users keep their own `claude` install, auth, and update cadence, so `claude-wrap` removes cleanly.

## Considered Options

- **Fork/patch the `claude` binary** — rejected: would require continuously rebasing against every Claude Code release (high maintenance, fragile), and redistributing a modified closed-source binary creates licensing and trust problems.
- **settings.json mutator that rewrites Claude Code's config in place** — rejected: mutates the user's persistent configuration (brittle across schema changes, hard to reverse cleanly, and risks polluting the user's own setup and auth).
- **HTTP proxy that rewrites requests** — rejected: adds a always-on network intermediary that must parse and translate Claude Code's wire protocol, which is more complex and less durable than the built-in env surface, and introduces latency and a single point of failure.

## Consequences

- `claude-wrap` cannot add features that Claude Code's `ANTHROPIC_*` env surface does not expose; its capability ceiling is bounded by what Claude Code chooses to honor via environment variables.
- `claude-wrap` depends on Anthropic keeping those environment variables (`ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`) stable and documented; a breaking change there would affect the wrapper.
- The wrapper is inert without a separately installed `claude` binary on `PATH` (enforced via `which` in `execClaude`), so it remains a pure launcher rather than a substitute for Claude Code.
