🚀 claude-wrap — Claude Code with any LLM backend

Tired of Claude Code locking you into one provider? claude-wrap lets you pick any model backend via presets. DeepSeek, OpenAI, Groq, Ollama — one launcher, zero modifications to Claude Code.

✨ What it does:
  • Interactive picker — choose your backend at launch
  • YAML presets — define providers once, switch anytime
  • Auto-bare mode — no more manual -- --bare for third-party APIs
  • $VAR expansion — keep API keys out of config files
  • Project-local overrides — per-repo model pinning
  • XDG-aware — fits into your dotfiles workflow

🧰 Built-in management:
  $ claude-wrap --add              # interactive preset wizard
  $ claude-wrap --set-default groq # pin your default
  $ claude-wrap --doctor           # validate all presets
  $ claude-wrap --update           # self-update from GitHub
  $ claude-wrap --config-edit      # open config in $EDITOR
  $ claude-wrap --completion zsh   # tab-complete presets

⚡ Install:
  curl -fsSL https://raw.githubusercontent.com/bara-digital/claude-wrap/master/install.sh | bash

🔗 https://github.com/bara-digital/claude-wrap

Built with Bun + TypeScript. MIT licensed.
PRs welcome — add your provider preset and help others.
