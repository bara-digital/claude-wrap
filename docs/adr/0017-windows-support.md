---
Status: accepted
---

# Windows support (cross-platform parity)

claude-wrap runs as a Bun/TypeScript CLI with no native Unix-only dependencies in
its core launch path, but several pieces hard-coded Unix assumptions:

- Config / state paths used XDG only (`~/.config`, `~/.local/state`) — neither exists on Windows.
- Binary discovery used `which` and spawned `claude --version` with no shell, so the
  Windows `claude.cmd` / `claude.ps1` shim was never resolved.
- The `claude_bin` guard (`resolveClaudeBin`) was Unix-only: it split on `/`, blocked
  `/tmp`/`/dev`, and the allowlist rejected Windows basenames like `claude.cmd` — so a
  legitimate Windows `claude_bin` was wrongly rejected while a malicious temp `.exe` was
  not blocked.
- `--web` shells out to tmux + ttyd, which don't run on native Windows.
- The release build emitted `dist/claude-wrap` (no `.exe`) and `--update` assumed darwin/linux.

## Decision

Make `claude-wrap` a first-class Windows citizen for **terminal launch**, ship an
official `.exe` + wire up `--update`, gracefully disable `--web` on native Windows
(suggesting WSL), and keep full test/CI/docs parity.

A single new module `src/platform.ts` owns every platform branch (`userConfigPath`,
`userStatePath`, `commandExists`, `isBlockedBinPath`, `stripCmdExt`, `exportEnvLines`,
`defaultEditor`, `isWsl`). Every helper takes an optional `platform` argument defaulting
to `process.platform` so the Windows path is unit-testable on a macOS/Linux dev machine.

Specifics:

- **Paths:** `xdgConfigPath()` becomes `userConfigPath()` (the old name stays as a
  back-compat alias). On Windows it resolves `%APPDATA%/claude-wrap/presets.yaml` and
  `%LOCALAPPDATA%/claude-wrap/stats.json`; on Unix it keeps the XDG behavior from ADR 0012.
- **Binary discovery:** `commandExists()` uses `where` on Windows and `which` on Unix (and
  `existsSync` for absolute paths). `execClaude` / `doctor` / `info` spawn with
  `shell: isWindows()` so `claude.cmd` / `.ps1` resolve.
- **`claude_bin` guard (extends ADR 0007):** uses `path.win32`/`path.posix` semantics
  (not host OS) so Windows paths are judged correctly; blocks Windows temp locations
  (`%TEMP%` prefix + any `\Temp\` directory); strips a Windows command extension
  (`.cmd`/`.exe`/`.ps1`) before the allowlist check so `claude.cmd` is accepted like `claude`.
- **`--web`:** disabled on native Windows with a clear "run under WSL" message. WSL is
  detected (`/proc/version` contains `microsoft`) and *allowed*, since tmux/ttyd exist there.
- **Release:** `scripts/build.ts` (Bun.build API) emits `dist/claude-wrap.exe` on Windows;
  `release.yml` gains a `windows-latest` matrix entry; `--update` fetches/installs the
  `.exe` (`binaryName()` adds `.exe`); `install.ps1` mirrors `install.sh`.
- **`dryRun`:** emits `set "K=V"` on Windows, `export K='V'` on Unix.

## Consequences

- `claude-wrap` launches Claude Code on Windows (terminal) exactly as on macOS/Linux.
- Config/state live in the right Windows shell folders; XDG behavior is unchanged on Unix.
- The `claude_bin` attack surface is now correctly guarded on Windows too.
- `--web` is unavailable on native Windows (tmux/ttyd limitation) but works under WSL.
- CI exercises Windows (`ci.yml` + a `windows-latest` release artifact).

## Supersedes / relates

- Generalizes the file-location half of **ADR 0012** (XDG) to a cross-platform model.
- Extends the binary guard of **ADR 0007** to be Windows-aware.
- Reuses the launch spine of **ADR 0001/0006** and the release pipeline of **ADR 0009**.
