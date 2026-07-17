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
│  anthropic
│  deepseek
│  groq
│  openai
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
# Generate your config (anthropic with login by default)
claude-wrap --init

# Add a preset interactively
claude-wrap --add

# Launch Claude Code with the interactive picker
claude-wrap

# Pin a default and skip the picker
claude-wrap --set-default deepseek
claude-wrap                           # uses deepseek automatically

# Drive the session from a browser (see Web UI below)
claude-wrap --web -p deepseek
```

## Config

`claude-wrap` reads config from two locations (merged together):

1. **Global:** `~/.config/claude-wrap/presets.yaml` (respects `$XDG_CONFIG_HOME`)
2. **Local:** `.claude-wrap.yaml` — walked up from CWD (project-specific overrides)

When the same preset name exists in both, the local config wins entirely.

### Schema

```yaml
default: anthropic

# claude_bin: /opt/homebrew/bin/claude

presets:
  <name>:
    description: "Optional description"
    model: <model-id>             # REQUIRED → ANTHROPIC_MODEL
    base_url: <api-endpoint>      # REQUIRED → ANTHROPIC_BASE_URL
    api_key: $MY_API_KEY          # optional → ANTHROPIC_API_KEY (x-api-key)
    auth_token: $MY_TOKEN         # optional → ANTHROPIC_AUTH_TOKEN (Bearer)
    login: true                   # optional — Anthropic OAuth mode
    bare: false                   # optional — disable auto-bare injection
    extra_env:                    # optional — additional env vars
      CUSTOM_VAR: value
```

- `model` and `base_url` are **required**
- `api_key` populates `ANTHROPIC_API_KEY` only (sent as the `x-api-key` header)
- `auth_token` populates `ANTHROPIC_AUTH_TOKEN` only (sent as `Authorization: Bearer`)
- Set exactly one of them — Claude Code warns when both env vars are present. Gateways
  that authenticate via `Authorization: Bearer` should use `auth_token`:
  ```yaml
  presets:
    morph:
      model: my-model
      base_url: https://api.morphllm.com/v1
      auth_token: $MORPH_API_KEY   # ANTHROPIC_API_KEY stays unset
  ```
- `$VAR` references expand from shell env and walk-up `.env` files
- Missing `$VAR` references cause a hard error
- Dangerous env vars (`PATH`, `LD_PRELOAD`, `HOME`, etc.) are blocked in `extra_env`

## CLI flags

| Flag | Effect |
|------|--------|
| `--preset <name>`, `-p` | Skip picker, use named preset |
| `--config <path>`, `-c` | Explicit config file |
| `--init` | Generate template config |
| `--init --force` | Overwrite existing config |
| `--init --local` | Create project-level `.claude-wrap.yaml` |
| `--local` | Target local config (`--config-edit --local`, etc.) |
| `--list`, `-l` | List all presets |
| `--add` | Interactive preset wizard |
| `--remove <name>` | Delete a preset |
| `--edit <name>` | Open config at preset location in `$EDITOR` |
| `--set-default <name>` | Set default preset |
| `--config-edit` | Open config in `$EDITOR` |
| `--doctor` | Validate all presets (reachability, auth, vars) |
| `--update` | Self-update binary from GitHub Releases |
| `--export` | Print resolved env vars as shell `export` statements |
| `--completion <shell>` | Print shell completions (`zsh`, `bash`, `fish`) |
| `--which` | Print which preset would be selected (no launch) |
| `--session [id]` | Resume a previous Claude Code session |
| `--stats` | Show per-preset launch statistics |
| `--info` | Print environment diagnostics |
| `--pick` | Force interactive picker |
| `--dry-run` | Print resolved env vars + command (no launch) |
| `--no-bare` | Skip auto-bare injection |
| `--web` | Serve the session over a web UI (tmux + ttyd) |
| `--web-port <n>` | Web UI port (default `7681`) |
| `--web-host <addr>` | Web UI bind address (default `0.0.0.0`) |
| `--web-auth <user:pass>` | HTTP basic auth for the web UI |
| `--web-tls-cert <path>` | TLS certificate for HTTPS web UI |
| `--web-tls-key <path>` | TLS private key for HTTPS web UI |
| `--web-font-size <n>` | Terminal font size (larger reads better on phones) |
| `--web-no-auth` | Disable auth (insecure — warns loudly) |
| `--version`, `-v` | Show version |
| `--help`, `-h` | Show help |

All other arguments are forwarded to `claude`:

```bash
claude-wrap -p deepseek -- --add-dir /path/to/code
```

> **Auto-bare:** `--bare` is auto-injected for non-Anthropic backends. Use `--no-bare` or set `bare: false` to disable.

## Managing presets

### Add interactively

```bash
$ claude-wrap --add

◇  Preset name:  openai
◇  Model:        gpt-4o
◇  Base URL:     https://openrouter.ai/api/v1
◇  API key:      $OPENROUTER_API_KEY
  Preset 'openai' added
```

### Remove a preset

```bash
$ claude-wrap --remove groq
  Preset 'groq' removed.
```

### Edit a specific preset

```bash
$ claude-wrap --edit deepseek   # vim jumps to the preset line
```

### Set the default

```bash
$ claude-wrap --set-default deepseek
  Default preset set to 'deepseek'
```

### Project-level config

```bash
$ claude-wrap --init --local         # create .claude-wrap.yaml in CWD
$ claude-wrap --config-edit --local  # edit it
$ claude-wrap --list                 # shows [local] badge on project presets
```

### Diagnose

```bash
$ claude-wrap --doctor               # validate all presets
$ claude-wrap --dry-run -p deepseek  # print resolved env vars
$ claude-wrap --info                 # show environment overview
$ claude-wrap --stats                # per-preset launch counts
```

### Resume sessions

```bash
$ claude-wrap --session              # continue last session
$ claude-wrap --session abc123       # resume session abc123
```

### Use in scripts

```bash
$ claude-wrap --which                # prints resolved preset name
$ eval $(claude-wrap --export -p deepseek)  # export env vars to shell
```

### Shell completions

```bash
claude-wrap --completion zsh > ~/.zsh/completions/_claude-wrap
claude-wrap --completion bash > ~/.bash_completion.d/claude-wrap
claude-wrap --completion fish > ~/.config/fish/completions/claude-wrap.fish
```

### Keep updated

```bash
$ claude-wrap --update
  Current: v0.2.0
  Latest:  v0.3.0
  Downloading claude-wrap-darwin-arm64... done.
  Updated to v0.3.0
```

## Example presets

### Anthropic (subscription / OAuth)

```yaml
presets:
  anthropic:
    description: "Claude Sonnet via Anthropic subscription"
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
    login: true
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
```

### Custom endpoint with native Anthropic API

```yaml
presets:
  custom:
    description: "Custom proxy that speaks Anthropic natively"
    model: custom-model
    base_url: https://my-proxy.example.com
    api_key: $MY_KEY
    bare: false       # skip auto-bare — this endpoint handles auth natively
```

### Third-party gateway (Bearer token, no Anthropic key)

Some gateways (e.g. Morph) expect a Bearer token and want `ANTHROPIC_API_KEY` left unset so
Claude Code doesn't fall back to Anthropic auth. Use `auth_token` on its own:

```yaml
presets:
  morph:
    description: "Custom model via third-party gateway"
    model: my-model
    base_url: https://api.morphllm.com/v1
    auth_token: $MORPH_API_KEY
    # ANTHROPIC_API_KEY is intentionally unset
```

## Web UI (browser access)

`claude-wrap --web` runs Claude Code inside a persistent **tmux** session and serves it
over the web with **ttyd** — a single-binary web-terminal server. Open the printed URL in
any browser to get the full Claude Code TUI; closing the tab and reopening re-attaches to the
same live session.

```bash
claude-wrap --web -p deepseek          # serve the deepseek preset on :7681
claude-wrap --web                        # serves the default preset
claude-wrap --web --dry-run             # print the composed ttyd command, don't launch
```

On launch it prints the URL and an **auto-generated `claude:<password>`** credential (basic
auth). To use your own credentials, pass `--web-auth user:pass` or set them in config (see
below). TLS is supported with `--web-tls-cert` / `--web-tls-key`.

### Requirements

`--web` requires `tmux` and `ttyd` on `PATH`. If either is missing, `claude-wrap` prints
install instructions and exits:

```bash
# macOS
brew install tmux ttyd
# Linux (Debian/Ubuntu)
sudo apt-get install -y tmux
# ttyd isn't in most distro repos — grab a release:
#   https://github.com/tsl0922/ttyd/releases
```

### Configuration

Settings live under an optional top-level `web:` block; CLI flags override them.

```yaml
web:
  host: 0.0.0.0        # bind address (default all interfaces)
  port: 7681           # port
  auth: $WEB_AUTH      # "user:pass" — $VAR references are expanded
  tls_cert: /path/cert.pem
  tls_key: /path/key.pem
  font_size: 18        # terminal font size (larger reads better on phones)
```

### Security

> ⚠️ **The web terminal is a full shell running Claude Code.** Treat it like SSH.

- By default it binds **all interfaces (`0.0.0.0`)** with an **auto-generated password**.
  That password protects the page, but over plain HTTP it travels in cleartext — fine on
  `localhost`, risky on a shared LAN.
- For remote access, prefer **one of**:
  - **TLS** via `--web-tls-cert`/`--web-tls-key` (or a reverse proxy like Caddy/nginx), **or**
  - an **SSH tunnel**: `ssh -L 7681:localhost:7681 host` then browse `http://localhost:7681`, **or**
  - bind to `127.0.0.1` (`--web-host 127.0.0.1`) and expose via a VPN.
- Never use `--web-no-auth` on an exposed interface.
- Credentials reach Claude Code via the **environment**, never argv — `ps` won't show your
  keys.

### Mobile

The page is responsive and works on phones, but Claude Code is a **keyboard-driven TUI** and
mobile soft keyboards often lack `Esc`, `Ctrl`, arrow keys, and `Tab`. Reading output and
typing prompts is fine; driving menus/approvals is fiddly. To make it usable:

- **Bump the font** for readability: `claude-wrap --web --web-font-size 18` (or set
  `web.font_size` in config).
- **Pair a Bluetooth keyboard** — this is the single biggest improvement; it turns the
  browser tab into a normal terminal.
- **Use a keyboard app that exposes terminal keys** (e.g. Hacker's Keyboard on Android).
- **Prefer SSH + tmux for heavy use.** Because the session runs on a dedicated tmux socket,
  a mobile SSH app (Blink, Termius) can attach to the *same* session directly:
  ```bash
  ssh user@host
  tmux -L claude-wrap-<preset> attach -t main
  ```
  This gives a purpose-built mobile terminal with soft-keys for `Esc`/`Ctrl`/arrows.

## Requirements

- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code`
- **A supported backend** — Anthropic, DeepSeek, OpenRouter, LiteLLM, or any endpoint speaking the Anthropic Messages API

## FAQ

### What is `--bare` and do I need it?

`--bare` tells Claude Code to skip OAuth/keychain auth and use API key env vars. `claude-wrap` injects it automatically for non-Anthropic backends. You never need to pass it manually.

### Do I need a proxy for non-Anthropic models?

DeepSeek provides a native [Anthropic-compatible endpoint](https://github.com/deepseek-ai/awesome-deepseek-agent/blob/main/docs/claude_code.md). For OpenAI, Groq, Ollama, etc., use [OpenRouter](https://openrouter.ai) or [LiteLLM](https://github.com/BerriAI/litellm) as a translation proxy.

### Where are my API keys stored?

Keys live in `~/.config/claude-wrap/presets.yaml`. Use `$VAR` references to avoid plaintext:

```yaml
api_key: $OPENROUTER_API_KEY  # loaded from shell env or .env
```

`.claude-wrap.yaml` is gitignored by default — never commit it.

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

PRs welcome. Run `bun run typecheck && bun test` before pushing. Commit messages follow [conventional commits](https://www.conventionalcommits.org/). See the [PR template](.github/pull_request_template.md) for the checklist.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module-by-module control/data flow, [docs/DEEP-SCAN.md](docs/DEEP-SCAN.md) for bugs/risks/coverage gaps, and [docs/adr](docs/adr) for the decision records behind each design choice.

## License

MIT © Bara Digital
