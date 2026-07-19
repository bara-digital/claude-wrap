import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { hasLocalConfig } from "./config";
import { isWindows, userConfigPath, userStatePath } from "./platform";
import { VERSION } from "./version";

export function showInfo(config: {
  default?: string;
  presets: Record<string, unknown>;
}): void {
  const configPath = userConfigPath();
  const localPath = hasLocalConfig();
  const statePath = userStatePath();
  const presetCount = Object.keys(config.presets).length;

  const claudeCheck = spawnSync("claude", ["--version"], {
    stdio: "pipe",
    timeout: 5000,
    shell: isWindows(),
  });
  const claudeVer = claudeCheck.status === 0
    ? claudeCheck.stdout.toString().trim().split("\n")[0]
    : "(not found)";

  const lines = [
    `  claude-wrap   v${VERSION}`,
    `  claude        ${claudeVer}`,
    `  config        ${configPath}${existsSync(configPath) ? "" : " (missing)"}`,
    `  project       ${localPath ?? "(none)"}`,
    `  presets       ${presetCount}`,
    `  default       ${config.default ?? "(none)"}`,
    `  stats path    ${statePath}`,
  ];

  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}
