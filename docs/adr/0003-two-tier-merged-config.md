---
Status: accepted
---

# Two-tier merged config: global presets plus walk-up local override

claude-wrap loads configuration from two locations and merges them: a GLOBAL user config at `$XDG_CONFIG_HOME/claude-wrap/presets.yaml` (falling back to `~/.config/claude-wrap/presets.yaml` when `XDG_CONFIG_HOME` is unset; see ADR 0012 for XDG path conventions), and a LOCAL project config `.claude-wrap.yaml` discovered by walking up the directory tree from the current working directory (see ADR 0007 for the security implications of a walk-up local config — a `.claude-wrap.yaml` from a cloned repo can specify `claude_bin` / `extra_env`). When both define a preset with the same name, the LOCAL preset wins entirely — a per-preset replacement (`{ ...global.presets, ...local.presets }`), not a deep field-level merge. The `default` and `claude_bin` keys likewise fall back local-then-global. An explicit `--config` path bypasses local discovery entirely.

## Consequences

- The local `.claude-wrap.yaml` should be gitignored, since it typically carries secrets (`api_key`, `auth_token`) that pin a project to a specific backend.
- Whole-preset replacement means you cannot override just one field of a global preset locally; redefining a named preset locally replaces it wholesale, so the local copy must be complete and self-contained.
