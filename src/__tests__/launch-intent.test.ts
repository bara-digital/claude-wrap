import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isLaunchIntent, shouldRunFirstRun, type Flags } from "../index";

function baseFlags(over: Partial<Flags> = {}): Flags {
  return {
    preset: undefined,
    config: undefined,
    init: false,
    initForce: false,
    list: false,
    doctor: false,
    update: false,
    completion: undefined,
    configEdit: false,
    local: false,
    setDefaultPreset: undefined,
    removePreset: undefined,
    add: false,
    exportOnly: false,
    noBare: false,
    session: undefined,
    editPreset: undefined,
    which: false,
    stats: false,
    info: false,
    pick: false,
    dryRun: false,
    web: false,
    webPort: undefined,
    webHost: undefined,
    webAuth: undefined,
    webTlsCert: undefined,
    webTlsKey: undefined,
    webNoAuth: false,
    webFontSize: undefined,
    help: false,
    version: false,
    args: [],
    ...over,
  };
}

let tmpDir: string;
let origXdg: string | undefined;
let origAppData: string | undefined;

beforeEach(() => {
  origXdg = process.env.XDG_CONFIG_HOME;
  origAppData = process.env.APPDATA;
  tmpDir = mkdtempSync(join(tmpdir(), "cw-li-"));
  // Point the platform-specific global config dir at tmpDir so configExists()
  // resolves inside it on every OS (%APPDATA% on Windows, XDG on Unix).
  if (process.platform === "win32") {
    process.env.APPDATA = join(tmpDir, "AppData", "Roaming");
  } else {
    process.env.XDG_CONFIG_HOME = tmpDir;
  }
});

afterEach(() => {
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = origXdg;
  if (origAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = origAppData;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("isLaunchIntent", () => {
  it("is true for a plain run", () => {
    expect(isLaunchIntent(baseFlags())).toBe(true);
  });

  it("is true when only --local is given (no config yet) — L1", () => {
    expect(isLaunchIntent(baseFlags({ local: true }))).toBe(true);
  });

  it("is false for every management / diagnostic subcommand", () => {
    const cases: Array<[keyof Flags, unknown]> = [
      ["init", true],
      ["add", true],
      ["editPreset", "x"],
      ["removePreset", "x"],
      ["configEdit", true],
      ["list", true],
      ["doctor", true],
      ["stats", true],
      ["info", true],
      ["update", true],
      ["completion", "zsh"],
      ["setDefaultPreset", "x"],
    ];
    for (const [flag, val] of cases) {
      expect(
        isLaunchIntent(baseFlags({ [flag]: val } as Partial<Flags>)),
      ).toBe(false);
    }
  });
});

describe("shouldRunFirstRun", () => {
  it("is true for a plain run with no config", () => {
    expect(shouldRunFirstRun(baseFlags())).toBe(true);
    expect(shouldRunFirstRun(baseFlags({ local: true }))).toBe(true);
  });

  it("is false once a config file exists", () => {
    expect(shouldRunFirstRun(baseFlags())).toBe(true);
    // Write to the same platform-specific dir beforeEach pointed at tmpDir.
    const cfgDir = process.platform === "win32"
      ? join(tmpDir, "AppData", "Roaming")
      : tmpDir;
    mkdirSync(join(cfgDir, "claude-wrap"), { recursive: true });
    writeFileSync(join(cfgDir, "claude-wrap", "presets.yaml"), "presets:\n");
    expect(shouldRunFirstRun(baseFlags())).toBe(false);
  });
});
