/**
 * Cross-platform helpers.
 *
 * Every OS-specific branch in claude-wrap funnels through this module so the
 * rest of the code stays platform-agnostic. Each helper accepts an optional
 * `platform` argument (defaulting to `process.platform`) so the Windows path
 * can be unit-tested on a macOS/Linux dev machine.
 */
import { homedir, tmpdir, platform as osPlatform } from "node:os";
import { join, dirname, isAbsolute as pathIsAbsolute, basename as pathBasename } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export type Platform = "darwin" | "linux" | "win32";

/** Narrow the broad Node platform string to the three we support. */
export function platformOf(p: string = osPlatform()): Platform {
  if (p === "win32") return "win32";
  if (p === "darwin") return "darwin";
  return "linux";
}

export function isWindows(p: string = osPlatform()): boolean {
  return platformOf(p) === "win32";
}

// ── Config / state directories ─────────────────────────────────────────────

/** `%APPDATA%` on Windows, `$XDG_CONFIG_HOME` or `~/.config` on Unix. */
export function userConfigDir(p: string = osPlatform()): string {
  if (isWindows(p)) {
    return process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  }
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

/** Full path to `presets.yaml` in the user config dir. */
export function userConfigPath(p: string = osPlatform()): string {
  return join(userConfigDir(p), "claude-wrap", "presets.yaml");
}

/** `%LOCALAPPDATA%` on Windows, `$XDG_STATE_HOME` or `~/.local/state` on Unix. */
export function userStateDir(p: string = osPlatform()): string {
  if (isWindows(p)) {
    return process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  }
  return process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
}

/** Full path to the launch-stats JSON in the user state dir. */
export function userStatePath(p: string = osPlatform()): string {
  return join(userStateDir(p), "claude-wrap", "stats.json");
}

// ── Binary discovery / validation ──────────────────────────────────────────

/**
 * PATH lookup that works on both platforms: an absolute path is checked with
 * `existsSync`; a bare command name uses `where` (Windows) or `which` (Unix).
 */
export function commandExists(cmd: string, p: string = osPlatform()): boolean {
  if (pathIsAbsolute(cmd)) return existsSync(cmd);
  if (isWindows(p)) {
    return spawnSync("where", [cmd], { stdio: "pipe" }).status === 0;
  }
  return spawnSync("which", [cmd], { stdio: "pipe" }).status === 0;
}

const WIN_CMD_EXTS = [".cmd", ".bat", ".exe", ".ps1"];

/** Strip a Windows command extension so `claude.cmd` matches the `claude` allowlist. */
export function stripCmdExt(base: string, p: string = osPlatform()): string {
  if (!isWindows(p)) return base;
  const lower = base.toLowerCase();
  for (const ext of WIN_CMD_EXTS) {
    if (lower.endsWith(ext)) return base.slice(0, -ext.length);
  }
  return base;
}

/**
 * Prefixes / location patterns that a `claude_bin` must never point into.
 * On Windows this is the user temp dir plus any `\Temp\` path (a cloned repo
 * could ship an executable there); on Unix the usual scratch dirs.
 */
export function isBlockedBinPath(cmd: string, p: string = osPlatform()): boolean {
  if (isWindows(p)) {
    const tmp = tmpdir().toLowerCase();
    if (tmp && cmd.toLowerCase().startsWith(tmp)) return true;
    if (/[\\/]temp[\\/]/i.test(cmd)) return true;
    return false;
  }
  for (const prefix of ["/tmp", "/var/tmp", "/dev", "/proc", "/sys"]) {
    if (cmd.startsWith(prefix)) return true;
  }
  return false;
}

// ── Shell / editor ─────────────────────────────────────────────────────────

/** `set "K=V"` on Windows, `export K='V'` (bash-quoted) elsewhere. */
export function exportEnvLines(
  env: Record<string, string>,
  p: string = osPlatform(),
): string[] {
  if (isWindows(p)) {
    return Object.entries(env).map(([k, v]) => `set "${k}=${v}"`);
  }
  return Object.entries(env).map(([k, v]) => {
    const safeKey = k.replace(/'/g, "'\\''");
    const safeVal = v.replace(/'/g, "'\\''");
    return `export ${safeKey}='${safeVal}'`;
  });
}

/** `notepad` on Windows, `vim` elsewhere (honors $EDITOR/$VISUAL first in callers). */
export function defaultEditor(p: string = osPlatform()): string {
  return isWindows(p) ? "notepad" : "vim";
}

/**
 * Best-effort WSL detection. Only meaningful under Linux — used to allow
 * `--web` (tmux/ttyd are present in WSL) when claude-wrap runs there.
 */
export function isWsl(): boolean {
  if (osPlatform() !== "linux") return false;
  try {
    const ver = readFileSync("/proc/version", "utf8").toLowerCase();
    return ver.includes("microsoft") || ver.includes("wsl");
  } catch {
    return false;
  }
}
