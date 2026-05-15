# claude-wrap

[![CI](https://github.com/bara-digital/claude-wrap/actions/workflows/ci.yml/badge.svg)](https://github.com/bara-digital/claude-wrap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/bara-digital/claude-wrap?label=version)](https://github.com/bara-digital/claude-wrap/releases)

Launch [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with any LLM backend.
Pick from multiple providers via presets — no modification to the Claude Code binary.

```
$ claude-wrap
┌  claude-wrap — select provider
│
◇  Choose a model backend:
│  deepseek
│  groq
│  openai
│  ollama
```

## Install

**macOS & Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/bara-digital/claude-wrap/master/install.sh | bash
```

**Manual download** — grab the binary from [Releases](https://github.com/bara-digital/claude-wrap/releases).

**From source** (requires [Bun](https://bun.sh)):

```bash
git clone https://github.com/bara-digital/claude-wrap.git
cd claude-wrap
bun install
bun run build
cp dist/claude-wrap ~/.local/bin/claude-wrap
```

## Quick start

```bash
# Generate your config file
claude-wrap --init

# Add a preset interactively (no YAML editing required)
claude-wrap --add

# Or edit the config directly
claude-wrap --config-edit

# Validate everything is working
claude-wrap --doctor

# Launch Claude Code with the interactive picker
claude-wrap

# Set a default and skip the picker
claude-wrap --set-default deepseek
claude-wrap                           # uses deepseek automatically
```

## Config

`claude-wrap` reads config from two locations (merged together):

1. **Global:** `~/.config/claude-wrap/presets.yaml` (respects `$XDG_CONFIG_HOME`)
2. **Local:** `.claude-wrap.yaml` — walked up from CWD (project-specific overrides)

When the same preset name exists in both, the local config wins entirely.

### Schema

```yaml
# Optional: skip the picker by setting a default preset
default: anthropic

# Optional: override path to the claude binary
# claude_bin: /opt/homebrew/bin/claude
# claude_bin:
#   - npx
#   - "@anthropic-ai/claude-code"

presets:
  <name>:
    description: "Optional description shown in --list"
    model: <model-id>             # REQUIRED → ANTHROPIC_MODEL
    base_url: <api-endpoint>      # REQUIRED → ANTHROPIC_BASE_URL
    api_key: $MY_API_KEY          # optional → ANTHROPIC_API_KEY + ANTHROPIC_AUTH_TOKEN
    login: true                   # optional → run claude login before launch
    extra_env:                    # optional — additional env vars passed to claude
      CUSTOM_VAR: value
      ANOTHER: $EXPANDED_VAR
```

- `model` and `base_url` are **required** for every preset
- `api_key` — optional. When set, populates both `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`
- `$VAR` references are expanded from your shell environment and any `.env` file found by walking up from CWD
- Missing `$VAR` references cause a hard error (fail fast)
- `extra_env` values also support `$VAR` expansion

## CLI flags

| Flag | Effect |
|------|--------|
| `--preset <name>`, `-p` | Skip picker, use named preset |
| `--config <path>`, `-c` | Explicit config file (overrides XDG cascade) |
| `--init` | Generate template config |
| `--init --force` | Overwrite existing config |
| `--add` | Interactive wizard to add a new preset |
| `--set-default <name>` | Set the default preset from CLI |
| `--config-edit` | Open the presets file in `$EDITOR` |
| `--doctor` | Validate all presets — reachability, auth, `$VAR` resolution |
| `--update` | Self-update the binary from GitHub Releases |
| `--list`, `-l` | List all presets (no launch) |
| `--pick` | Force picker even when `default` is set |
| `--dry-run` | Print resolved env vars and command, don't launch |
| `--completion <shell>` | Print shell completion script (`zsh`, `bash`, `fish`) |
| `--version`, `-v` | Show version |
| `--help`, `-h` | Show help |

All other arguments are forwarded to `claude`. Example:

```bash
claude-wrap -p deepseek -- --add-dir /path/to/code
```

> **Auto-bare:** `claude-wrap` automatically injects `--bare` when using non-Anthropic backends (anything not `api.anthropic.com`). No need to pass it manually.

## Managing presets

### Add a preset interactively

```bash
$ claude-wrap --add

◇  Preset name:  openai
◇  Model:        gpt-4o
◇  Base URL:     https://openrouter.ai/api/v1
◇  API key:      $OPENROUTER_API_KEY
◇  Description:  GPT-4o via OpenRouter
◇  Add extra env vars?  No

  Preset 'openai' added to ~/.config/claude-wrap/presets.yaml
```

### Set the default preset

```bash
$ claude-wrap --set-default deepseek
  Default preset set to 'deepseek'

$ claude-wrap        # skips picker, uses deepseek
```

### Validate all presets

```bash
$ claude-wrap --doctor

claude-wrap doctor

  deepseek
    model:   deepseek-v4-pro[1m]
    base:    https://api.deepseek.com/anthropic
    vars:    ✓ all resolved
    auth:    ✓ (sk-7f4e2...)
    reach:   ✓ HTTP 200
  groq
    model:   llama-3.3-70b
    base:    http://localhost:4000
    vars:    ✓ all resolved
    reach:   ✗ connection refused

---
  claude:   ✓ 2.1.142 (Claude Code)
```

### Self-update

```bash
$ claude-wrap --update
  Current: v0.1.0
  Latest:  v0.2.0
  Downloading claude-wrap-darwin-arm64... done.
  Updated to v0.2.0
```

### Shell completions

```bash
# zsh
claude-wrap --completion zsh > ~/.zsh/completions/_claude-wrap

# bash
claude-wrap --completion bash > ~/.bash_completion.d/claude-wrap

# fish
claude-wrap --completion fish > ~/.config/fish/completions/claude-wrap.fish
```

## Example presets

### Anthropic (subscription / OAuth)

```yaml
presets:
  anthropic:
    description: "Claude Sonnet via Anthropic subscription"
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
    login: true           # runs claude login before launch
```

### DeepSeek

```yaml
presets:
  deepseek:
    description: "DeepSeek V4 via Anthropic-compatible API"
    model: deepseek-v4-pro[1m]
    base_url: https://api.deepseek.com/anthropic
    api_key: $DEEPSEEK_API_KEY
    extra_env:
      ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro[1m]"
      ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro[1m]"
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]"
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
```

> `claude-wrap` auto-injects `--bare` for non-Anthropic backends. No need to pass it manually.

### OpenAI via OpenRouter

```yaml
presets:
  openai:
    description: "GPT-4o via OpenRouter"
    model: openai/gpt-4o
    base_url: https://openrouter.ai/api/v1
    api_key: $OPENROUTER_API_KEY
```

### Groq via LiteLLM (local proxy)

```yaml
presets:
  groq:
    description: "Llama 3.3 via Groq + LiteLLM"
    model: groq/llama-3.3-70b-versatile
    base_url: http://localhost:4000/v1
    api_key: $GROQ_API_KEY
```

### Ollama (local)

```yaml
presets:
  ollama:
    description: "Local Ollama models via LiteLLM"
    model: ollama/llama3
    base_url: http://localhost:4000/v1
    # no api_key needed
```

## Requirements

- **Claude Code CLI** — install via `npm install -g @anthropic-ai/claude-code` or [direct download](https://docs.anthropic.com/en/docs/claude-code)
- **A supported backend** — Anthropic, DeepSeek, OpenRouter, LiteLLM, or any endpoint that speaks the Anthropic Messages API

## FAQ

### What is `--bare` and do I need it?

`--bare` tells Claude Code to skip OAuth/keychain authentication and use `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` env vars instead. **`claude-wrap` injects it automatically** for any preset whose `base_url` isn't `https://api.anthropic.com`. You never need to pass it manually.

### Do I need a proxy for non-Anthropic models?

It depends. Claude Code speaks Anthropic's Messages API format. DeepSeek provides a native [Anthropic-compatible endpoint](https://github.com/deepseek-ai/awesome-deepseek-agent/blob/main/docs/claude_code.md). For OpenAI, Groq, Ollama, etc., use [OpenRouter](https://openrouter.ai) or [LiteLLM](https://github.com/BerriAI/litellm) as a translation proxy.

### Where are my API keys stored?

Keys are in your preset YAML file at `~/.config/claude-wrap/presets.yaml`. Use `$VAR` references to avoid storing keys in plaintext:

```yaml
api_key: $OPENROUTER_API_KEY  # loaded from shell env or .env
```

The local config `.claude-wrap.yaml` is gitignored by default — never commit it.

### How do I debug my preset configuration?

```bash
claude-wrap --dry-run -p <name>   # print resolved env vars
claude-wrap --doctor              # validate all presets
```

### How do I use this with the VSCode extension?

Configure `~/.claude/settings.json` directly — see [DeepSeek's guide](https://github.com/deepseek-ai/awesome-deepseek-agent/blob/main/docs/claude_code.md). `claude-wrap` is designed for the CLI workflow.

## Contributing

```bash
git clone https://github.com/bara-digital/claude-wrap.git
cd claude-wrap
bun install
bun run dev       # run locally
bun test          # run tests
bun run build     # compile binary
```

PRs welcome. Please run `bun run typecheck && bun test` before pushing.

## License

MIT © Bara Digital
