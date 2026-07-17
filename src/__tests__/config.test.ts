import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig, resolveClaudeBin, type Config } from "../config";

let tmpDir: string;
let origDir: string;

beforeEach(() => {
  origDir = process.cwd();
  tmpDir = mkdtempSync(join(tmpdir(), "claude-wrap-test-"));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origDir);
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeGlobalYaml(content: string): string {
  const dir = join(tmpDir, ".config", "claude-wrap");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "presets.yaml");
  writeFileSync(path, content, "utf8");
  return path;
}

function writeLocalYaml(content: string): string {
  const path = join(tmpDir, ".claude-wrap.yaml");
  writeFileSync(path, content, "utf8");
  return path;
}

describe("loadConfig", () => {
  it("loads a simple config with one preset", () => {
    const globalPath = writeGlobalYaml(`
presets:
  anthropic:
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
`);
    // Override XDG_CONFIG_HOME to point at our temp config
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    expect(config.presets.anthropic).toBeDefined();
    expect(config.presets.anthropic.model).toBe("claude-sonnet-4-20250514");
    expect(config.presets.anthropic.base_url).toBe("https://api.anthropic.com/v1");
  });

  it("allows optional model field", () => {
    const globalPath = writeGlobalYaml(`
presets:
  good:
    base_url: https://example.com
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    expect(config.presets.good).toBeDefined();
    expect(config.presets.good.model).toBeUndefined();
  });

  it("validates required fields — missing base_url", () => {
    const globalPath = writeGlobalYaml(`
presets:
  bad:
    model: gpt-4o
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    expect(() => loadConfig()).toThrow("missing required field 'base_url'");
  });

  it("merges global and local configs — local wins on same key", () => {
    writeGlobalYaml(`
default: anthropic
presets:
  anthropic:
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
  openai:
    model: gpt-4o
    base_url: https://openrouter.ai/api/v1
`);
    writeLocalYaml(`
default: openai
presets:
  openai:
    model: gpt-4-turbo
    base_url: https://openrouter.ai/api/v1
    api_key: sk-local
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();

    // Local default wins
    expect(config.default).toBe("openai");

    // Both presets are available (global anthropic + local openai)
    expect(config.presets.anthropic).toBeDefined();
    expect(config.presets.openai).toBeDefined();

    // Local openai preset wins completely (not field-level merge)
    expect(config.presets.openai.model).toBe("gpt-4-turbo");
    expect(config.presets.openai.api_key).toBe("sk-local");
  });

  it("local config adds new presets to global ones", () => {
    writeGlobalYaml(`
presets:
  anthropic:
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
`);
    writeLocalYaml(`
presets:
  groq:
    model: llama-3.3-70b
    base_url: https://api.groq.com/openai/v1
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    expect(Object.keys(config.presets)).toContain("anthropic");
    expect(Object.keys(config.presets)).toContain("groq");
  });

  it("walks up directories to find .claude-wrap.yaml", () => {
    writeGlobalYaml(`
presets:
  anthropic:
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
`);
    const subdir = join(tmpDir, "sub", "deep");
    mkdirSync(subdir, { recursive: true });
    process.chdir(subdir);

    // Write local config in tmpDir (parent of sub/deep)
    writeLocalYaml(`
presets:
  local-only:
    model: local-model
    base_url: http://localhost:4000
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    expect(config.presets["local-only"]).toBeDefined();
    expect(config.presets["local-only"].model).toBe("local-model");
  });

  it("loads from explicit path instead of XDG", () => {
    const explicitPath = join(tmpDir, "custom.yaml");
    writeFileSync(
      explicitPath,
      `
presets:
  custom:
    model: custom-model
    base_url: https://custom.example.com
`,
      "utf8",
    );

    const config = loadConfig(explicitPath);
    expect(config.presets.custom).toBeDefined();
    expect(config.presets.custom.model).toBe("custom-model");
  });

  it("throws for empty YAML", () => {
    const path = writeGlobalYaml("");
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    expect(() => loadConfig()).toThrow();
  });

  it("throws for config missing 'presets' key", () => {
    writeGlobalYaml("default: foo\n");
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    expect(() => loadConfig()).toThrow("missing required key 'presets'");
  });

  it("validates extra_env fields are strings", () => {
    writeGlobalYaml(`
presets:
  bad:
    model: gpt-4o
    base_url: https://example.com
    extra_env:
      FOO: bar
      BAD: 123
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    expect(() => loadConfig()).toThrow("must be a string");
  });

  it("handles optional fields — description, api_key, extra_env", () => {
    writeGlobalYaml(`
presets:
  full:
    model: gpt-4o
    base_url: https://example.com
    description: "Full featured preset"
    api_key: sk-secret
    extra_env:
      OTEL_ENABLED: "true"
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    const preset = config.presets.full;
    expect(preset.description).toBe("Full featured preset");
    expect(preset.api_key).toBe("sk-secret");
    expect(preset.extra_env).toEqual({ OTEL_ENABLED: "true" });
  });

  it("handles claude_bin as string", () => {
    writeGlobalYaml(`
claude_bin: /opt/homebrew/bin/claude
presets:
  a:
    model: gpt-4o
    base_url: https://example.com
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    expect(config.claude_bin).toBe("/opt/homebrew/bin/claude");
  });

  it("handles claude_bin as array", () => {
    writeGlobalYaml(`
claude_bin:
  - npx
  - "@anthropic-ai/claude-code"
presets:
  a:
    model: gpt-4o
    base_url: https://example.com
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    expect(Array.isArray(config.claude_bin)).toBe(true);
    expect((config.claude_bin as string[]).join(" ")).toBe("npx @anthropic-ai/claude-code");
  });

  it("parses an optional web: block", () => {
    writeGlobalYaml(`
web:
  host: 127.0.0.1
  port: 9000
  auth: user:pass
presets:
  a:
    model: gpt-4o
    base_url: https://example.com
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    expect(config.web).toEqual({
      host: "127.0.0.1",
      port: 9000,
      auth: "user:pass",
    });
  });

  it("rejects a non-numeric web.port", () => {
    writeGlobalYaml(`
web:
  port: not-a-number
presets:
  a:
    model: gpt-4o
    base_url: https://example.com
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    expect(() => loadConfig()).toThrow("web.port");
  });

  it("merges local web: block over global", () => {
    writeGlobalYaml(`
web:
  host: 127.0.0.1
  port: 9000
presets:
  a:
    model: gpt-4o
    base_url: https://example.com
`);
    writeLocalYaml(`
web:
  port: 8080
presets:
  a:
    model: gpt-4o
    base_url: https://example.com
`);
    process.env.XDG_CONFIG_HOME = join(tmpDir, ".config");
    const config = loadConfig();
    // local.web overrides global.web wholesale (same rule as default/claude_bin)
    expect(config.web).toEqual({ port: 8080 });
  });
});

describe("resolveClaudeBin", () => {
  it("defaults to 'claude' when unset", () => {
    expect(resolveClaudeBin(undefined)).toEqual(["claude"]);
  });

  it("allows bare allowlisted commands", () => {
    expect(resolveClaudeBin("claude")).toEqual(["claude"]);
    expect(resolveClaudeBin("npx")).toEqual(["npx"]);
  });

  it("rejects bare commands not on the allowlist", () => {
    expect(() => resolveClaudeBin("evil")).toThrow("not an allowed binary");
  });

  it("allows absolute paths whose basename is allowlisted", () => {
    expect(resolveClaudeBin("/opt/homebrew/bin/claude")).toEqual([
      "/opt/homebrew/bin/claude",
    ]);
    expect(resolveClaudeBin("/usr/local/bin/node")).toEqual([
      "/usr/local/bin/node",
    ]);
  });

  it("rejects absolute paths whose basename is NOT allowlisted", () => {
    expect(() => resolveClaudeBin("/home/user/evilbinary")).toThrow(
      "must be one of",
    );
  });

  it("rejects relative paths (cloned-repo executable attack)", () => {
    expect(() => resolveClaudeBin("./runme")).toThrow("relative paths");
    expect(() => resolveClaudeBin("../x/claude")).toThrow("relative paths");
  });

  it("rejects paths under blocked prefixes", () => {
    expect(() => resolveClaudeBin("/tmp/claude")).toThrow("is not allowed");
    expect(() => resolveClaudeBin("/dev/claude")).toThrow("is not allowed");
  });

  it("validates only the command, not its arguments", () => {
    expect(resolveClaudeBin(["npx", "@anthropic-ai/claude-code"])).toEqual([
      "npx",
      "@anthropic-ai/claude-code",
    ]);
  });
});
