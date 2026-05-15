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

# Edit it — add your API keys and provider presets
vim ~/.config/claude-wrap/presets.yaml

# Launch Claude Code with the interactive picker
claude-wrap

# Or skip the picker and go straight to a preset
claude-wrap -p deepseek -- --bare
```

> **Important:** Non-Anthropic providers require a proxy or compatible endpoint. See [Example presets](#example-presets) below.

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
| `--list`, `-l` | List all presets (no launch) |
| `--pick` | Force picker even when `default` is set |
| `--dry-run` | Print resolved env vars and command, don't launch |
| `--version`, `-v` | Show version |
| `--help`, `-h` | Show help |

All other arguments are forwarded to `claude`. Example:

```bash
claude-wrap -p deepseek -- --bare --add-dir /path/to/code
```

## Example presets

### Anthropic (direct)

```yaml
presets:
  anthropic:
    description: "Claude Sonnet via Anthropic API"
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
    api_key: $ANTHROPIC_API_KEY
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
      CLAUDE_CODE_SIMPLE: "1"
```

Then launch with `--bare` to skip Anthropic's OAuth:

```bash
claude-wrap -p deepseek -- --bare
```

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
- For non-Anthropic providers, `--bare` flag is needed to skip OAuth authentication

## FAQ

### Why do I need `--bare` with non-Anthropic providers?

Claude Code authenticates via OAuth tokens stored in your system keychain. `--bare` tells it to skip OAuth and use `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` env vars instead. Without it, Claude Code shows a login prompt even with env vars set.

### Do I need a proxy for non-Anthropic models?

Yes. Claude Code speaks Anthropic's Messages API format. Your backend must accept Anthropic-format requests. DeepSeek provides an [Anthropic-compatible endpoint](https://github.com/deepseek-ai/awesome-deepseek-agent/blob/main/docs/claude_code.md). For OpenAI, Groq, Ollama, etc., use [OpenRouter](https://openrouter.ai) or [LiteLLM](https://github.com/BerriAI/litellm) as a translation proxy.

### Where are my API keys stored?

Keys are in your preset YAML file at `~/.config/claude-wrap/presets.yaml`. Use `$VAR` references to avoid storing keys in plaintext:

```yaml
api_key: $OPENROUTER_API_KEY  # loaded from shell env or .env
```

The local config `.claude-wrap.yaml` is gitignored by default — never commit it.

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

MIT © Dedi Suhanda
