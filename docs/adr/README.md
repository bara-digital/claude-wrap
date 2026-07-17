# Architecture Decision Records

This directory records the architectural decisions behind `claude-wrap` — a CLI that launches the unmodified Claude Code binary against any LLM backend by injecting `ANTHROPIC_*` environment variables from named presets.

Each ADR captures **one decision, why it was made, and the alternatives rejected**. They are numbered sequentially and, once accepted, are not edited to reflect new decisions — a later ADR supersedes an earlier one instead. Domain vocabulary lives in [`../../CONTEXT.md`](../../CONTEXT.md).

## Index

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-wrapper-not-fork.md) | Wrapper, not a fork — inject env vars, spawn the stock `claude` binary | accepted |
| [0002](0002-env-var-backend-routing.md) | Backends selected via Claude Code's own `ANTHROPIC_*` environment variables | accepted |
| [0003](0003-two-tier-merged-config.md) | Two-tier merged config — global XDG + walk-up local, local wins per-preset | accepted |
| [0004](0004-yaml-config-format.md) | Preset config uses YAML | accepted |
| [0005](0005-api-key-vs-auth-token.md) | Separate `api_key` (x-api-key) vs `auth_token` (Bearer) credential fields | accepted |
| [0006](0006-auto-bare-injection.md) | Auto-inject `--bare` for non-Anthropic backends | accepted |
| [0007](0007-binary-and-env-security-model.md) | Binary guard (allowlist for bare names OR blocked-prefix check for paths) + protected-env denylist | accepted |
| [0008](0008-var-resolution-and-dotenv.md) | `$VAR` resolution from shell env + nearest `.env`; missing var = hard error | accepted |
| [0009](0009-bun-single-binary-distribution.md) | Bun single-binary distribution + GitHub-Releases self-update | accepted |
| [0010](0010-hand-rolled-runtime-validation.md) | Hand-rolled runtime config validation (no schema library) | accepted |
| [0011](0011-local-only-launch-stats.md) | Local-only launch statistics (no remote telemetry) | accepted |
| [0012](0012-xdg-base-directory-compliance.md) | XDG Base Directory compliance for config & state | accepted |
| [0013](0013-anthropic-backend-detection.md) | Single canonical `base_url` predicate for Anthropic detection | accepted |
| [0014](0014-cli-arg-forwarding-boundary.md) | CLI argument forwarding boundary (wrapper flags vs passthrough) | accepted |

## How they relate

- **Foundation:** 0001 (wrapper not fork) is the root; 0002 (env-var routing) and 0013 (Anthropic detection) are the mechanism that makes it work.
- **Config & resolution:** 0003 (two-tier config), 0004 (YAML), 0008 (`$VAR`/`.env`), 0010 (hand-rolled validation).
- **Auth:** 0005 (credential fields) and 0006 (auto-`--bare`); 0006 branches on 0013's detection rule (Anthropic backends are excluded from `--bare` injection).
- **Security:** 0007 (binary + env guardrails) defends the attack surface introduced by 0003's walk-up local config; 0012 (XDG) protects file locations.
- **Distribution & ops:** 0009 (Bun binary + self-update), 0011 (local-only stats).
- **CLI surface:** 0014 (arg-forwarding boundary).
