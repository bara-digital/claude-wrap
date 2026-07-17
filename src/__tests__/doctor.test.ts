import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { probeEndpoint } from "../doctor";

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("probeEndpoint", () => {
  it("sends Authorization: Bearer for auth_token presets", async () => {
    let captured: Record<string, string> | undefined;
    globalThis.fetch = (mock(async (_url: string, init?: { headers?: Record<string, string> }) => {
      captured = init?.headers;
      return new Response("", { status: 200 });
    }) as unknown as typeof globalThis.fetch);

    const res = await probeEndpoint("https://gw.example.com/v1", {
      ANTHROPIC_AUTH_TOKEN: "tok-abc",
    });

    expect(res.reachable).toBe(true);
    expect(captured?.["Authorization"]).toBe("Bearer tok-abc");
    expect(captured?.["x-api-key"]).toBeUndefined();
  });

  it("sends x-api-key for api_key presets", async () => {
    let captured: Record<string, string> | undefined;
    globalThis.fetch = (mock(async (_url: string, init?: { headers?: Record<string, string> }) => {
      captured = init?.headers;
      return new Response("", { status: 200 });
    }) as unknown as typeof globalThis.fetch);

    const res = await probeEndpoint("https://gw.example.com/v1", {
      ANTHROPIC_API_KEY: "key-xyz",
    });

    expect(res.reachable).toBe(true);
    expect(captured?.["x-api-key"]).toBe("key-xyz");
    expect(captured?.["Authorization"]).toBeUndefined();
  });

  it("sends no auth header when neither credential is set", async () => {
    let captured: Record<string, string> | undefined;
    globalThis.fetch = (mock(async (_url: string, init?: { headers?: Record<string, string> }) => {
      captured = init?.headers;
      return new Response("", { status: 200 });
    }) as unknown as typeof globalThis.fetch);

    await probeEndpoint("https://gw.example.com/v1", {});

    expect(captured?.["x-api-key"]).toBeUndefined();
    expect(captured?.["Authorization"]).toBeUndefined();
  });

  it("reports unreachable when the fetch throws", async () => {
    globalThis.fetch = (mock(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof globalThis.fetch);

    const res = await probeEndpoint("https://gw.example.com/v1", {
      ANTHROPIC_API_KEY: "key",
    });

    expect(res.reachable).toBe(false);
    expect(res.error).toContain("ECONNREFUSED");
  });
});
