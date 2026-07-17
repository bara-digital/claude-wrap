---
Status: accepted
---

# Web UI via tmux + ttyd

`claude-wrap --web` runs the resolved Claude Code session inside a persistent **tmux**
session and serves it over HTTP/WebSocket with **ttyd** — a small single-binary web-terminal
server. Opening the printed URL gives the full Claude Code TUI in a browser; closing the tab
and reopening re-attaches to the same live session. This delivers browser-based remote access
to an authenticated Claude Code session with two external dependencies and no UI code of our
own.

## Consequences

- **Dedicated tmux socket per preset** — `ttyd` launches `tmux -L claude-wrap-<preset>
  new-session -A -s main <claude …>`. The `-L` socket spins up a *fresh* tmux server that
  inherits `ttyd`'s environment, so the resolved `ANTHROPIC_*` credentials reach `claude` via
  the environment (never argv — no `ps` leakage). It also isolates the web session from the
  user's normal tmux. `-A` (attach-or-create) makes later browser connections re-attach to
  the same running session, giving persistence across reconnects.
- **ttyd options** (see `buildTtydArgs` in `src/web.ts`): `-W` makes the terminal writable
  (ttyd is read-only by default); `-p <port>`; `-c <user:pass>` enables HTTP basic auth;
  `-C/-K` enable TLS; `-t fontSize=<n>` passes an xterm.js client option (used to enlarge the
  font for mobile readability); binding is restricted with `-i <host>` only when the user sets
  a non-default host. The default `0.0.0.0` relies on ttyd's own default bind.
- **Auth posture** (per user decision): by default `--web` binds **all interfaces** and
  **auto-generates a `claude:<random>` basic-auth credential** printed at launch. `--web-no-auth`
  disables auth but prints a loud warning; `--web-auth user:pass` (or a `web.auth` config
  value, which may be a `$VAR` reference) uses explicit credentials. `web.host`/`web.port`/
  `web.tls_cert`/`web.tls_key` in `presets.yaml` set defaults; CLI flags override them.
- **Dependency handling**: `--web` requires `tmux` and `ttyd` on `PATH`. If either is
  missing, `runWeb` (in `src/web.ts`) prints an OS-specific install hint via
  `dependencyInstallHint` and exits 1 — claude-wrap never attempts to auto-install.
- **Cleanup**: on `SIGINT`/`SIGTERM` or `ttyd` exit, `runWeb` runs `tmux -L
  claude-wrap-<preset> kill-server` so the dedicated server (and the claude session it holds)
  does not linger.
- **Single bare-injection rule**: the claude argv is built by the shared
  `buildClaudeInvocation` helper (extracted from `src/launcher.ts`), so web launches apply the
  same `--bare` auto-injection as normal launches (see ADR 0006).

## Rejected Alternatives

- **Custom web server (ws + node-pty)**: full control but we'd own a terminal emulation,
  PTY handling, and WebSocket protocol — far more code and attack surface than wrapping ttyd.
- **gotty / wetty**: gotty is effectively unmaintained; wetty targets a specific (node) shell.
  ttyd is actively maintained, single-binary, supports auth + TLS, and works with any command.
- **SSH-only (no web server)**: the safest, but the user explicitly wants a browser UI, not an
  SSH client. We instead *recommend* SSH-tunneling ttyd for safe remote access in the docs.
- **Bundling ttyd inside the claude-wrap binary**: keeps the single-binary story but adds a
  vendored blob, platform-specific extraction, and update complexity for little gain.
