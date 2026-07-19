import { describe, it, expect } from "bun:test";
import { getPlatform, binaryName } from "../update";

describe("getPlatform", () => {
  it("combines the platform with the host arch", () => {
    expect(getPlatform("win32")).toBe(`win32-${process.arch}`);
    expect(getPlatform("darwin")).toBe(`darwin-${process.arch}`);
    expect(getPlatform("linux")).toBe(`linux-${process.arch}`);
  });
});

describe("binaryName", () => {
  it("appends .exe on Windows", () => {
    expect(binaryName("win32-x64")).toBe("claude-wrap-win32-x64.exe");
    expect(binaryName("win32-arm64")).toBe("claude-wrap-win32-arm64.exe");
  });

  it("has no extension on Unix", () => {
    expect(binaryName("darwin-arm64")).toBe("claude-wrap-darwin-arm64");
    expect(binaryName("linux-x64")).toBe("claude-wrap-linux-x64");
  });
});
