---
Status: accepted
---

# Auto-inject `--bare` for non-Anthropic backends

For non-Anthropic backends, claude-wrap automatically injects the `--bare` flag into the Claude Code invocation (unless already present, or disabled via `--no-bare` / preset `bare: false`). `--bare` makes Claude Code skip its normal OAuth/keychain auth flow and instead rely on the `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` env vars (see ADR 0005), which is what third-party backends require. Anthropic backends are excluded purely because `isAnthropic` is true — the canonical `base_url` detection predicate owned by ADR 0013 (computed as `isAnthropic` in `src/index.ts`). With `--bare` skipped, Claude Code falls back to its normal OAuth/keychain flow, so Anthropic OAuth/subscription auth happens automatically for those backends; no explicit login step in claude-wrap is required.

Note: the `login: true` preset flag (declared in `src/config.ts`) forces Anthropic OAuth mode by suppressing `--bare` injection — `skipBare` is true whenever `flags.noBare || preset.bare === false || preset.login === true` (`src/index.ts`). With `--bare` suppressed, Claude Code uses its normal keychain/OAuth flow instead of env-var auth. For Anthropic backends this is already the default (they are excluded from injection anyway), so `login` mainly matters when a preset points at a non-Anthropic `base_url` but should still authenticate interactively.

## Consequences

- Escape hatches are `--no-bare` and preset `bare: false` to suppress injection.
- Injection is skipped when `--bare` is already present in the resolved command args (whether from the `claude_bin` config or forwarded user args). The check is `!finalArgs.includes("--bare")` where `finalArgs = claudeCmd.slice(1).concat(args)`.
- Always injecting `--bare` would break Anthropic's OAuth/subscription login; requiring users to pass it manually is an easy footgun. Automating the common case (with an opt-out) makes non-Anthropic launches just work.
