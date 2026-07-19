import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { join } from "node:path";
import {
  userConfigDir,
  userConfigPath,
  userStateDir,
  userStatePath,
  commandExists,
  stripCmdExt,
  isBlockedBinPath,
  exportEnvLines,
  defaultEditor,
  isWsl,
} from "../platform";

let saved: NodeJS.ProcessEnv;

beforeAll(() => {
  saved = { ...process.env };
  process.env.XDG_CONFIG_HOME = "/tmp/xdg-config";
  process.env.APPDATA = "C:\\Users\\test\\AppData\\Roaming";
  process.env.XDG_STATE_HOME = "/tmp/xdg-state";
  process.env.LOCALAPPDATA = "C:\\Users\\test\\AppData\\Local";
});

afterAll(() => {
  process.env = saved;
});

describe("userConfigDir / userConfigPath", () => {
  it("uses XDG on Unix", () => {
    expect(userConfigDir("darwin")).toBe("/tmp/xdg-config");
    expect(userConfigDir("linux")).toBe("/tmp/xdg-config");
    // join() is platform-aware, so build the expectation the same way the
    // source does (forward slashes on Unix, backslashes on Windows).
    expect(userConfigPath("darwin")).toBe(
      join("/tmp/xdg-config", "claude-wrap", "presets.yaml"),
    );
  });

  it("uses APPDATA on Windows", () => {
    expect(userConfigDir("win32")).toBe("C:\\Users\\test\\AppData\\Roaming");
    const p = userConfigPath("win32");
    expect(p.startsWith("C:\\Users\\test\\AppData\\Roaming")).toBe(true);
    expect(p).toContain("claude-wrap");
    expect(p.endsWith("presets.yaml")).toBe(true);
  });
});

describe("userStateDir / userStatePath", () => {
  it("uses XDG state on Unix", () => {
    expect(userStateDir("darwin")).toBe("/tmp/xdg-state");
    expect(userStatePath("darwin")).toContain("claude-wrap");
    expect(userStatePath("darwin")).toContain("stats.json");
  });

  it("uses LOCALAPPDATA on Windows", () => {
    expect(userStateDir("win32")).toBe("C:\\Users\\test\\AppData\\Local");
    const p = userStatePath("win32");
    expect(p.startsWith("C:\\Users\\test\\AppData\\Local")).toBe(true);
    expect(p).toContain("stats.json");
  });
});

describe("commandExists", () => {
  it("resolves an absolute, existing path", () => {
    expect(commandExists(process.execPath)).toBe(true);
  });

  it("rejects an absolute, missing path", () => {
    expect(commandExists("/abs/not/here/xyz123")).toBe(false);
  });

  it("finds a command on PATH via which/where", () => {
    // `node` runs this test, so it must be on PATH.
    expect(commandExists("node")).toBe(true);
  });
});

describe("stripCmdExt", () => {
  it("strips Windows command extensions", () => {
    expect(stripCmdExt("claude.cmd", "win32")).toBe("claude");
    expect(stripCmdExt("claude.exe", "win32")).toBe("claude");
    expect(stripCmdExt("claude", "win32")).toBe("claude");
  });

  it("leaves the basename untouched on Unix", () => {
    expect(stripCmdExt("claude.cmd", "darwin")).toBe("claude.cmd");
  });
});

describe("isBlockedBinPath", () => {
  it("blocks Unix scratch dirs", () => {
    expect(isBlockedBinPath("/tmp/x", "linux")).toBe(true);
    expect(isBlockedBinPath("/usr/local/bin/claude", "linux")).toBe(false);
  });

  it("blocks Windows temp locations", () => {
    expect(
      isBlockedBinPath("C:\\Users\\me\\AppData\\Local\\Temp\\evil.exe", "win32"),
    ).toBe(true);
    expect(
      isBlockedBinPath("C:\\Program Files\\claude\\claude.exe", "win32"),
    ).toBe(false);
  });
});

describe("exportEnvLines", () => {
  it("emits cmd.exe syntax on Windows", () => {
    expect(exportEnvLines({ KEY: "val" }, "win32")).toEqual(['set "KEY=val"']);
  });

  it("emits bash export syntax on Unix", () => {
    expect(exportEnvLines({ KEY: "val" }, "darwin")).toEqual(["export KEY='val'"]);
  });
});

describe("defaultEditor", () => {
  it("is notepad on Windows, vim elsewhere", () => {
    expect(defaultEditor("win32")).toBe("notepad");
    expect(defaultEditor("darwin")).toBe("vim");
    expect(defaultEditor("linux")).toBe("vim");
  });
});

describe("isWsl", () => {
  it("returns a boolean", () => {
    expect(typeof isWsl()).toBe("boolean");
  });
});
