import { spawnSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { Config, Preset } from "./config";
import { resolveClaudeBin } from "./config";

function walkUpEnv(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, ".env");
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // not found
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseDotEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadDotEnv(): Record<string, string> {
  const path = walkUpEnv(process.cwd());
  if (!path) return {};
  try {
    const raw = readFileSync(path, "utf8");
    return parseDotEnv(raw);
  } catch {
    return {};
  }
}

function resolveVar(
  value: string,
  env: Record<string, string>,
): string {
  return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name1, name2) => {
    const name = name1 ?? name2;
    const found = env[name];
    if (found !== undefined) return found;
    throw new Error(`Environment variable '${name}' is not set`);
  });
}

export function resolveEnv(
  preset: Preset,
): Record<string, string> {
  const dotEnv = loadDotEnv();
  const combinedEnv = { ...dotEnv, ...(process.env as Record<string, string>) };

  const result: Record<string, string> = {
    ANTHROPIC_MODEL: preset.model,
    ANTHROPIC_BASE_URL: preset.base_url,
  };

  if (preset.api_key) {
    const key = resolveVar(preset.api_key, combinedEnv);
    result.ANTHROPIC_API_KEY = key;
    result.ANTHROPIC_AUTH_TOKEN = key;
  }

  if (preset.extra_env) {
    for (const [key, value] of Object.entries(preset.extra_env)) {
      result[key] = resolveVar(value, combinedEnv);
    }
  }

  return result;
}

export function execClaude(
  config: Config,
  presetName: string,
  envVars: Record<string, string>,
  args: string[],
): void {
  const claudeCmd = resolveClaudeBin(config.claude_bin);
  const cmd = claudeCmd[0];
  const cmdArgs = claudeCmd.slice(1).concat(args);

  // Verify the binary exists before we detach
  const check = spawnSync("which", [cmd], { stdio: "pipe" });
  if (check.status !== 0) {
    process.stderr.write(`claude-wrap: '${cmd}' not found on PATH\n`);
    process.exit(1);
  }

  // Clack sets raw mode on stdin — reset it so claude gets a clean terminal
  try {
    process.stdin.setRawMode(false);
  } catch {
    // stdin may not be a TTY
  }
  process.stdin.resume();

  // Drain any leftover input (e.g. buffered Enter from picker)
  process.stdin.pause();
  let chunk: string | null;
  while ((chunk = process.stdin.read() as string | null) !== null) {
    // discard
  }
  process.stdin.resume();

  const child = spawn(cmd, cmdArgs, {
    env: { ...process.env, ...envVars },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(128 + (signal === "SIGINT" ? 2 : 1));
    }
    process.exit(code ?? 1);
  });
}

export function dryRun(
  presetName: string,
  envVars: Record<string, string>,
  config: Config,
  args: string[],
): string {
  const claudeCmd = resolveClaudeBin(config.claude_bin);
  const lines: string[] = [
    `# claude-wrap --dry-run`,
    `# Preset: ${presetName}`,
    `# Command: ${claudeCmd.join(" ")} ${args.join(" ")}`,
    "",
  ];

  for (const [key, value] of Object.entries(envVars)) {
    lines.push(`export ${key}='${value}'`);
  }

  return lines.join("\n");
}
