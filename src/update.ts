import { writeFileSync, chmodSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERSION } from "./version";

function getPlatform(): string {
  const os = process.platform; // "darwin" | "linux"
  const arch = process.arch;   // "arm64" | "x64"
  return `${os}-${arch}`;
}

function getCurrentBinaryPath(): string {
  // process.execPath in Bun compiled binary gives the binary path
  return process.execPath;
}

function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/^v/, "").split(".").map(Number);
  const bParts = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (bParts[i] || 0) - (aParts[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface ReleaseInfo {
  tag: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/bara-digital/claude-wrap/releases/latest",
      {
        headers: { "User-Agent": "claude-wrap" },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tag_name: string;
      assets: Array<{ name: string; browser_download_url: string }>;
    };
    return { tag: data.tag_name, assets: data.assets };
  } catch {
    return null;
  }
}

export async function runUpdate(): Promise<void> {
  const platform = getPlatform();
  const binaryName = `claude-wrap-${platform}`;

  process.stdout.write(`  Current: v${VERSION}\n`);

  const release = await fetchLatestRelease();
  if (!release) {
    process.stderr.write("  Failed to fetch latest release info.\n");
    process.exit(1);
  }

  process.stdout.write(`  Latest:  ${release.tag}\n`);

  if (compareVersions(VERSION, release.tag) <= 0) {
    process.stdout.write("  Already up to date.\n");
    process.exit(0);
  }

  const asset = release.assets.find((a) => a.name === binaryName);
  if (!asset) {
    process.stderr.write(`  No binary found for ${platform} in ${release.tag}\n`);
    process.exit(1);
  }

  process.stdout.write(`  Downloading ${binaryName}... `);

  let response: Response;
  try {
    response = await fetch(asset.browser_download_url, {
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    process.stdout.write("failed.\n");
    process.stderr.write("  Download timed out.\n");
    process.exit(1);
  }

  if (!response.ok) {
    process.stdout.write("failed.\n");
    process.stderr.write(`  HTTP ${response.status}\n`);
    process.exit(1);
  }

  const tmpDir = tmpdir();
  const tmpPath = join(tmpDir, `claude-wrap-${release.tag}`);
  const buf = Buffer.from(await response.arrayBuffer());
  writeFileSync(tmpPath, buf);
  chmodSync(tmpPath, 0o755);
  process.stdout.write("done.\n");

  // Verify the new binary
  process.stdout.write("  Verifying... ");
  const { spawnSync } = require("node:child_process");
  const check = spawnSync(tmpPath, ["--version"], { stdio: "pipe", timeout: 5000 });
  if (check.status !== 0) {
    process.stdout.write("failed.\n");
    rmSync(tmpPath);
    process.exit(1);
  }
  process.stdout.write(`${check.stdout.toString().trim()}\n`);

  // Replace current binary
  const currentPath = getCurrentBinaryPath();
  process.stdout.write(`  Replacing ${currentPath}... `);
  try {
    renameSync(tmpPath, currentPath);
  } catch {
    // Permission denied — try sudo mv via temp location
    process.stdout.write("permission denied.\n");
    process.stdout.write(`  Run: sudo mv "${tmpPath}" "${currentPath}"\n`);
    rmSync(tmpPath, { force: true });
    process.exit(1);
  }
  process.stdout.write("done.\n");
  process.stdout.write(`  Updated to ${release.tag}\n`);
  process.exit(0);
}
