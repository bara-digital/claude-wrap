import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function statsPath(): string {
  const xdg = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  return join(xdg, "claude-wrap", "stats.json");
}

function loadStats(): Record<string, number> {
  const path = statsPath();
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStats(stats: Record<string, number>): void {
  const path = statsPath();
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(stats, null, 2) + "\n", "utf8");
  chmodSync(path, 0o600);
}

export function recordLaunch(presetName: string): void {
  const stats = loadStats();
  stats[presetName] = (stats[presetName] || 0) + 1;
  saveStats(stats);
}

export function showStats(): void {
  const stats = loadStats();
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    process.stdout.write("No launches recorded yet.\n");
    process.exit(0);
  }

  const maxLen = Math.max(...entries.map(([k]) => k.length));
  for (const [name, count] of entries) {
    const label = name.padEnd(maxLen + 2);
    const bar = "█".repeat(Math.min(count, 30));
    process.stdout.write(`  ${label}${count.toString().padStart(4)}  ${bar}\n`);
  }
  process.exit(0);
}
