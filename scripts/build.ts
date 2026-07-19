/**
 * Cross-platform compile step. Runs the proven CLI form
 *   bun build ./src/index.ts --compile --outfile dist/claude-wrap
 * but chooses a `.exe` output on Windows so the release artifact has the
 * expected extension (see .github/workflows/release.yml).
 */
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isWindows } from "../src/platform";

const outfile = isWindows() ? "dist/claude-wrap.exe" : "dist/claude-wrap";
mkdirSync("dist", { recursive: true });

const res = spawnSync(
  "bun",
  ["build", "./src/index.ts", "--compile", "--outfile", outfile],
  { stdio: "inherit" },
);

if (res.status !== 0) process.exit(res.status ?? 1);
console.log(`Built ${outfile}`);
