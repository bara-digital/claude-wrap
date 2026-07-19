import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordLaunch } from "../stats";

let tmpDir: string;
let origState: string | undefined;
let origLocal: string | undefined;

beforeEach(() => {
  origState = process.env.XDG_STATE_HOME;
  origLocal = process.env.LOCALAPPDATA;
  tmpDir = mkdtempSync(join(tmpdir(), "cw-stats-"));
  // Point both the Unix and Windows state dirs at tmpDir so userStatePath()
  // resolves to <tmpDir>/claude-wrap/stats.json on every platform.
  process.env.XDG_STATE_HOME = tmpDir;
  process.env.LOCALAPPDATA = tmpDir;
});

afterEach(() => {
  if (origState === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = origState;
  if (origLocal === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = origLocal;
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
