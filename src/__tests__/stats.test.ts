import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordLaunch } from "../stats";

let tmpDir: string;
let origState: string | undefined;

beforeEach(() => {
  origState = process.env.XDG_STATE_HOME;
  tmpDir = mkdtempSync(join(tmpdir(), "cw-stats-"));
  process.env.XDG_STATE_HOME = tmpDir;
});

afterEach(() => {
  if (origState === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = origState;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("recordLaunch", () => {
  it("increments per-preset counts and persists to XDG_STATE_HOME", () => {
    recordLaunch("openai");
    recordLaunch("openai");
    recordLaunch("deepseek");

    const path = join(tmpDir, "claude-wrap", "stats.json");
    expect(existsSync(path)).toBe(true);

    const stats = JSON.parse(readFileSync(path, "utf8"));
    expect(stats.openai).toBe(2);
    expect(stats.deepseek).toBe(1);
  });

  it("is idempotent per call (no double count across invocations)", () => {
    recordLaunch("anthropic");
    recordLaunch("anthropic");
    recordLaunch("anthropic");

    const path = join(tmpDir, "claude-wrap", "stats.json");
    const stats = JSON.parse(readFileSync(path, "utf8"));
    expect(stats.anthropic).toBe(3);
  });
});
