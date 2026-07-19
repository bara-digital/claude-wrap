import { describe, it, expect } from "bun:test";
import { buildPreset } from "../setup";
import { findProvider, type ProviderCatalogEntry } from "../providers";
import { appendPreset } from "../config";

describe("buildPreset", () => {
  const openrouter = findProvider("openrouter")!;

  it("login entry produces no key and sets login: true", () => {
    const entry = findProvider("anthropic")!;
    const p = buildPreset(entry, { storeAsVar: false });
    expect(p.login).toBe(true);
    expect(p.api_key).toBeUndefined();
    expect(p.auth_token).toBeUndefined();
    expect(p.base_url).toContain("api.anthropic.com");
  });

  it("none entry (ollama) produces no key and keeps the model", () => {
    const entry = findProvider("ollama")!;
    const p = buildPreset(entry, { storeAsVar: false });
    expect(p.api_key).toBeUndefined();
    expect(p.auth_token).toBeUndefined();
    expect(p.model).toBe("ollama/llama3");
  });

  it("api_key entry stores the literal value when storeAsVar is false", () => {
    const p = buildPreset(openrouter, { keyValue: "sk-123", storeAsVar: false });
    expect(p.api_key).toBe("sk-123");
    expect(p.auth_token).toBeUndefined();
  });

  it("api_key entry stores a $VAR reference when storeAsVar is true", () => {
    const p = buildPreset(openrouter, { keyValue: "sk-123", storeAsVar: true });
    expect(p.api_key).toBe("$OPENROUTER_API_KEY");
  });

  it("auth_token entry sets auth_token (literal and $VAR)", () => {
    const entry: ProviderCatalogEntry = {
      id: "gw",
      label: "gw",
      hint: "",
      baseUrl: "https://gw.example.com/v1",
      authKind: "auth_token",
      envVar: "GW_TOKEN",
    };
    expect(buildPreset(entry, { keyValue: "t-1", storeAsVar: false }).auth_token).toBe(
      "t-1",
    );
    expect(buildPreset(entry, { keyValue: "t-1", storeAsVar: true }).auth_token).toBe(
      "$GW_TOKEN",
    );
  });

  it("honors a model override over the catalog default", () => {
    const p = buildPreset(openrouter, {
      storeAsVar: true,
      modelOverride: "anthropic/claude-opus",
    });
    expect(p.model).toBe("anthropic/claude-opus");
  });

  it("omits model when catalog has none and no override", () => {
    const entry: ProviderCatalogEntry = {
      id: "x",
      label: "x",
      hint: "",
      baseUrl: "https://x/v1",
      authKind: "none",
    };
    const p = buildPreset(entry, { storeAsVar: false });
    expect(p.model).toBeUndefined();
  });
});

describe("appendPreset comment preservation", () => {
  it("keeps surrounding comments and the default line when adding", () => {
    const raw = `# header comment
default: anthropic

presets:
  # existing preset comment
  anthropic:
    base_url: https://api.anthropic.com/v1
    login: true
`;
    const updated = appendPreset(raw, "openai", {
      base_url: "https://openrouter.ai/api/v1",
      api_key: "$OPENROUTER_API_KEY",
    });
    expect(updated).toContain("# header comment");
    expect(updated).toContain("# existing preset comment");
    expect(updated).toContain("default: anthropic");
    expect(updated).toContain("openai:");
    expect(updated).toContain("$OPENROUTER_API_KEY");
  });
});
