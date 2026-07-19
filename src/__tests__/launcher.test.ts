import { describe, it, expect } from "bun:test";
import { dryRun, buildClaudeInvocation } from "../launcher";
import type { Config } from "../config";

const config: Config = { presets: {} };

describe("buildClaudeInvocation", () => {
  it("resolves the default claude binary", () => {
    const inv = buildClaudeInvocation(config, [], true);
    expect(inv.cmd).toBe("claude");
  });

  it("auto-injects --bare for non-Anthropic backends", () => {
    const inv = buildClaudeInvocation(config, [], false);
    expect(inv.finalArgs).toContain("--bare");
  });

  it("does not inject --bare for Anthropic", () => {
    const inv = buildClaudeInvocation(config, [], true);
    expect(inv.finalArgs).not.toContain("--bare");
  });

  it("does not double-inject --bare if already present", () => {
    const inv = buildClaudeInvocation(config, ["--bare"], false);
    expect(inv.finalArgs.filter((a) => a === "--bare").length).toBe(1);
  });
});

describe("dryRun", () => {
  it("emits a bash-safe export for the env vars", () => {
    const out = dryRun("anthropic", { ANTHROPIC_API_KEY: "sk-123" }, config, [], true);
    expect(out).toContain("# claude-wrap --dry-run");
    expect(out).toContain("# Preset: anthropic");
    expect(out).toContain("claude");
    expect(out).toContain("export ANTHROPIC_API_KEY='sk-123'");
  });

  it("does not leak the key into the command line", () => {
    const out = dryRun("p", { ANTHROPIC_API_KEY: "secret-value" }, config, [], true);
    const cmdLine = out.split("\n").find((l) => l.startsWith("# Command:")) ?? "";
    expect(cmdLine).not.toContain("secret-value");
  });
});
