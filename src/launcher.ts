import { spawnSync, spawn } from "node:child_process";
import type { Config } from "./config";
import { resolveClaudeBin } from "./config";

export function execClaude(
  config: Config,
  presetName: string,
  envVars: Record<string, string>,
  args: string[],
  noBare?: boolean,
): void {
  const claudeCmd = resolveClaudeBin(config.claude_bin);
  const cmd = claudeCmd[0];
  const finalArgs = claudeCmd.slice(1).concat(args);

  // Auto-inject --bare for non-Anthropic backends (unless overridden)
  const baseUrl = envVars.ANTHROPIC_BASE_URL ?? "";
  const isAnthropic = baseUrl.startsWith("https://api.anthropic.com");
  if (!isAnthropic && !noBare && !finalArgs.includes("--bare")) {
    finalArgs.unshift("--bare");
  }

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

  // Drain leftover input, then keep stdin PAUSED so Bun doesn't
  // compete with claude for keystrokes on fd 0
  process.stdin.resume();
  let chunk: string | null;
  while ((chunk = process.stdin.read() as string | null) !== null) {
    // discard
  }
  process.stdin.pause();

  const child = spawn(cmd, finalArgs, {
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
  noBare?: boolean,
): string {
  const claudeCmd = resolveClaudeBin(config.claude_bin);
  const finalArgs = claudeCmd.slice(1).concat(args);

  const baseUrl = envVars.ANTHROPIC_BASE_URL ?? "";
  const isAnthropic = baseUrl.startsWith("https://api.anthropic.com");
  if (!isAnthropic && !noBare && !finalArgs.includes("--bare")) {
    finalArgs.unshift("--bare");
  }

  const lines: string[] = [
    `# claude-wrap --dry-run`,
    `# Preset: ${presetName}`,
    `# Command: ${claudeCmd[0]} ${finalArgs.join(" ")}`,
    "",
  ];

  for (const [key, value] of Object.entries(envVars)) {
    lines.push(`export ${key}='${value}'`);
  }

  return lines.join("\n");
}
