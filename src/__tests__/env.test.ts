import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveEnv } from "../env";
import type { Preset } from "../config";

let tmpDir: string;
let origDir: string;
let origEnv: Record<string, string | undefined>;

beforeEach(() => {
  origDir = process.cwd();
  origEnv = { ...process.env };
  tmpDir = mkdtempSync(join(tmpdir(), "claude-wrap-test-"));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origDir);
  // Restore original env
  for (const key of Object.keys(process.env)) {
    if (!(key in origEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(origEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveEnv", () => {
  it("resolves basic preset without api_key or extra_env", () => {
    const preset: Preset = {
      model: "claude-sonnet-4-20250514",
      base_url: "https://api.anthropic.com/v1",
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-4-20250514");
    // ANTHROPIC_BASE_URL not set for default Anthropic endpoint
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("sets ANTHROPIC_BASE_URL for non-Anthropic endpoints", () => {
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://api.deepseek.com/anthropic",
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
  });

  it("resolves $VAR from process.env", () => {
    process.env.MY_API_KEY = "secret-123";
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      api_key: "$MY_API_KEY",
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_API_KEY).toBe("secret-123");
  });

  it("resolves ${VAR} syntax from process.env", () => {
    process.env.MY_KEY = "braces-key";
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      api_key: "${MY_KEY}",
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_API_KEY).toBe("braces-key");
  });

  it("throws when $VAR is not set", () => {
    delete process.env.BOGUS_VAR;
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      api_key: "$BOGUS_VAR",
    };
    expect(() => resolveEnv(preset)).toThrow("BOGUS_VAR");
  });

  it("resolves from .env file in CWD", () => {
    writeFileSync(join(tmpDir, ".env"), "LOCAL_KEY=env-file-value\n", "utf8");
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      api_key: "$LOCAL_KEY",
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_API_KEY).toBe("env-file-value");
  });

  it("walks up directories to find .env file", () => {
    writeFileSync(join(tmpDir, ".env"), "WALK_KEY=deep-value\n", "utf8");
    const subdir = join(tmpDir, "sub", "deep");
    mkdirSync(subdir, { recursive: true });
    process.chdir(subdir);

    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      api_key: "$WALK_KEY",
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_API_KEY).toBe("deep-value");
  });

  it("process.env takes precedence over .env file", () => {
    writeFileSync(join(tmpDir, ".env"), "DUPE_KEY=from-file\n", "utf8");
    process.env.DUPE_KEY = "from-process";
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      api_key: "$DUPE_KEY",
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_API_KEY).toBe("from-process");
  });

  it("resolves extra_env with $VAR expansion", () => {
    process.env.COLLECTOR = "https://otel.example.com";
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      extra_env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: "$COLLECTOR",
        OTEL_SERVICE_NAME: "claude-wrap",
      },
    };
    const env = resolveEnv(preset);
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe("https://otel.example.com");
    expect(env.OTEL_SERVICE_NAME).toBe("claude-wrap");
  });

  it("handles .env with comments and quotes", () => {
    writeFileSync(
      join(tmpDir, ".env"),
      '# this is a comment\nKEY="quoted-value"\nOTHER=\'single-quoted\'\nPLAIN=plain-value\n',
      "utf8",
    );
    const preset: Preset = {
      model: "gpt-4o",
      base_url: "https://example.com",
      api_key: "$KEY",
      extra_env: {
        OTHER_VAL: "$OTHER",
        PLAIN_VAL: "$PLAIN",
      },
    };
    const env = resolveEnv(preset);
    expect(env.ANTHROPIC_API_KEY).toBe("quoted-value");
    expect(env.OTHER_VAL).toBe("single-quoted");
    expect(env.PLAIN_VAL).toBe("plain-value");
  });
});
