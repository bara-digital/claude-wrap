# claude-wrap

A CLI launcher that runs the unmodified Claude Code binary against any LLM backend by injecting `ANTHROPIC_*` environment variables from named presets.

## Language

**Preset**:
A named, reusable backend configuration (model, base URL, credentials, extra env) that claude-wrap resolves into environment variables before launching Claude Code.
_Avoid_: profile, config entry

**Backend**:
The LLM endpoint a preset points at — Anthropic itself, or any service exposing the Anthropic Messages API (directly or via a translation proxy).
_Avoid_: provider, vendor, model host

**Anthropic-compatible endpoint**:
A `base_url` that speaks the Anthropic Messages API natively (e.g. DeepSeek's endpoint) or through a proxy (OpenRouter, LiteLLM). Non-Anthropic endpoints receive `ANTHROPIC_BASE_URL`; the canonical Anthropic endpoint deliberately does not. Anthropic vs non-Anthropic is decided by the single `base_url` prefix predicate (see ADR 0013).
_Avoid_: compatible API, shim

**Bare mode**:
Launching Claude Code with `--bare` so it skips OAuth/keychain auth and reads credentials from `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`. Auto-injected for non-Anthropic backends.
_Avoid_: headless, no-auth

**Global config**:
The user-wide preset file at `$XDG_CONFIG_HOME/claude-wrap/presets.yaml`.
_Avoid_: user config, main config

**Local config**:
A project-scoped `.claude-wrap.yaml` discovered by walking up from the current directory. Overrides the global config per-preset.
_Avoid_: project config file, override file

**Login mode** (`login: true`):
A preset flag selecting Anthropic OAuth/subscription auth. It forces OAuth by suppressing `--bare` injection, so Claude Code uses its keychain/OAuth flow instead of env-var credentials (see ADR 0006).
_Avoid_: oauth mode, subscription mode

## Credentials

**api_key**:
A preset credential mapped to `ANTHROPIC_API_KEY`, sent as the `x-api-key` header. Mutually exclusive with `auth_token`.
_Avoid_: key, token, secret (when ambiguous)

**auth_token**:
A preset credential mapped to `ANTHROPIC_AUTH_TOKEN`, sent as `Authorization: Bearer`. Used by gateways that authenticate with Bearer tokens.
_Avoid_: bearer key, access token

**$VAR reference**:
A `$NAME` / `${NAME}` placeholder in a preset value, resolved at launch from the shell environment and the nearest walk-up `.env` file (a single file, not merged across the tree — see ADR 0008). An unresolved reference is a hard error.
_Avoid_: variable, interpolation, template
