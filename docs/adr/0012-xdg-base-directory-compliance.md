---
Status: accepted
---

# XDG Base Directory compliance for file locations

claude-wrap follows the XDG Base Directory specification for where it stores its own files: the GLOBAL user config lives under `$XDG_CONFIG_HOME/claude-wrap/` (falling back to `~/.config`) and regenerable state (launch stats) lives under `$XDG_STATE_HOME/claude-wrap/` (falling back to `~/.local/state`). Config and state are deliberately separated by category.

Note: the GLOBAL user config is XDG-compliant, but claude-wrap also loads a LOCAL `.claude-wrap.yaml` discovered via an upward directory walk from the current working directory (`config.ts:29-31`, `175`) and merges it over the global config per-preset (same-named presets are replaced wholesale — **not** a deep field-level merge; see ADR 0003). This local file lives outside the XDG hierarchy by design — it is project-local, not user-global — and is therefore intentionally not covered by this ADR's XDG scope.

## Consequences

- User config: `$XDG_CONFIG_HOME/claude-wrap/presets.yaml` (fallback `~/.config/claude-wrap/presets.yaml`).
- Regenerable state: `$XDG_STATE_HOME/claude-wrap/stats.json` (fallback `~/.local/state/claude-wrap/stats.json`).
- The `XDG_*` variables are protected in the `extra_env` denylist (`src/env.ts`), so a preset cannot redirect claude-wrap's own file locations.
