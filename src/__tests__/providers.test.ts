import { describe, it, expect } from "bun:test";
import { PROVIDER_CATALOG, findProvider } from "../providers";

describe("PROVIDER_CATALOG", () => {
  it("has the expected providers", () => {
    const ids = PROVIDER_CATALOG.map((p) => p.id);
    expect(ids).toContain("anthropic");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("openrouter");
    expect(ids).toContain("groq");
    expect(ids).toContain("ollama");
    expect(ids).toContain("custom");
  });

  it("every entry has required fields", () => {
    for (const p of PROVIDER_CATALOG) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.hint).toBeTruthy();
      expect(p.authKind).toMatch(/^(login|api_key|auth_token|none)$/);
    }
  });

  it("anthropic uses login auth and has no envVar", () => {
    const a = findProvider("anthropic")!;
    expect(a.authKind).toBe("login");
    expect(a.envVar).toBeUndefined();
    expect(a.baseUrl).toContain("api.anthropic.com");
  });

  it("known api_key providers declare an envVar and a baseUrl", () => {
    const known = PROVIDER_CATALOG.filter(
      (p) => p.authKind === "api_key" && p.id !== "custom",
    );
    expect(known.length).toBeGreaterThan(0);
    for (const p of known) {
      expect(p.envVar).toBeTruthy();
      expect(p.baseUrl).toBeTruthy();
    }
  });

  it("custom has no preset envVar (generic gateway — stored literally)", () => {
    const c = findProvider("custom")!;
    expect(c.envVar).toBeUndefined();
  });

  it("custom needs a base URL from the user", () => {
    const c = findProvider("custom")!;
    expect(c.needsBaseUrl).toBe(true);
    expect(c.baseUrl).toBe("");
  });

  it("ids are unique", () => {
    const ids = PROVIDER_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findProvider resolves ids and returns undefined for unknown", () => {
    expect(findProvider("openrouter")?.id).toBe("openrouter");
    expect(findProvider("nope")).toBeUndefined();
  });
});
