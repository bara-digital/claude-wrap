---
Status: accepted
---

# Binary and environment security model for config-driven execution

claude-wrap launches Claude Code against an arbitrary LLM backend, and the config file (which can be a local, walk-up-discovered `.claude-wrap.yaml` from a cloned repo — see ADR 0003) decides what binary gets spawned and with what environment. To defend against a malicious or compromised config, claude-wrap constrains `claude_bin` so it can only ever spawn an allowlisted binary — bare names must be on the allowlist, and path values must be absolute with an allowlisted basename and no blocked prefix — and prevents `extra_env` from overriding a denylist of protected environment variables. This keeps the blast radius small while still permitting legitimate overrides (model routing via `extra_env`, custom install paths via `claude_bin`).

## Consequences

**`claude_bin` guardrail (`validateBinName` in `src/config.ts`):**

- A bare command name (no `/`) must be on the allowlist: `claude`, `npx`, `node`, `bun`.
- A path-like value (containing `/`) must clear **all** of: (1) not start with a blocked prefix (`/tmp`, `/var/tmp`, `/dev`); (2) be absolute — relative paths like `./runme` or `../x` are rejected outright; (3) have a basename that is itself on the allowlist (`claude`/`npx`/`node`/`bun`).

Together these mean an absolute path can only ever resolve to an allowlisted binary (e.g. `/opt/homebrew/bin/claude` is fine; `/home/user/evilbinary` and `./runme` are rejected). This closes the cloned-repo attack in 0007's threat model — a walk-up `.claude-wrap.yaml` (see ADR 0003) cannot point `claude_bin` at an arbitrary or relative local executable.

**`extra_env` guardrail (`BLOCKED_ENV_VARS` in `src/env.ts`):**

The following environment variables cannot be overridden by config (matched case-insensitively):

- Execution hijack vectors: `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH`
- Identity / shell: `HOME`, `USER`, `LOGNAME`, `SHELL`, `PWD`, `EDITOR`, `VISUAL`
- Temporary / runtime path: `TMPDIR`
- XDG base directories: `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`

These lists are the guardrails. Do not loosen the allowlist or shrink the denylist without evaluating the resulting execution-hijack or privilege-escalation exposure.
