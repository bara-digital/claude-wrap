import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig, getInitTemplate } from "./config";
import { pickPreset } from "./picker";
import { resolveEnv, execClaude, dryRun } from "./launcher";

function printHelp(): void {
  const help = `claude-wrap — launch Claude Code with any LLM backend

Usage:
  claude-wrap [wrapper-flags] [-- claude-args...]

Wrapper flags:
  --preset, -p <name>   Skip picker, use named preset
  --config, -c <path>   Explicit config file path
  --init                Generate template config at ~/.config/claude-wrap/presets.yaml
  --init --force        Overwrite existing config
  --list, -l            List all available presets (no launch)
  --pick                Force interactive picker even when default is set
  --dry-run             Print resolved env vars and command without launching
  --version, -v         Show version
  --help, -h            Show this help

All other arguments are forwarded to claude.

Config discovery:
  1. Explicit:        --config /path/to/presets.yaml
  2. Global:          ~/.config/claude-wrap/presets.yaml  (XDG_CONFIG_HOME aware)
  3. Local (merged):  walk-up from CWD for .claude-wrap.yaml

Examples:
  claude-wrap                          # Interactive picker
  claude-wrap --preset openai          # Use 'openai' preset
  claude-wrap -p groq -- --model llama # Forward args to claude
  claude-wrap --dry-run                # Debug preset resolution
  claude-wrap --list                   # Show all presets
  claude-wrap --init                   # Generate initial config
`;

  process.stdout.write(help);
  process.exit(0);
}

function printVersion(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require("../package.json");
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

function parseFlags(): {
  preset?: string;
  config?: string;
  init: boolean;
  initForce: boolean;
  list: boolean;
  pick: boolean;
  dryRun: boolean;
  help: boolean;
  version: boolean;
  args: string[];
} {
  const args = process.argv.slice(2);
  const result = {
    preset: undefined as string | undefined,
    config: undefined as string | undefined,
    init: false,
    initForce: false,
    list: false,
    pick: false,
    dryRun: false,
    help: false,
    version: false,
    args: [] as string[],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--preset" || arg === "-p") {
      i++;
      if (i >= args.length) {
        process.stderr.write("claude-wrap: --preset requires a value\n");
        process.exit(1);
      }
      result.preset = args[i];
      i++;
      continue;
    }

    if (arg === "--config" || arg === "-c") {
      i++;
      if (i >= args.length) {
        process.stderr.write("claude-wrap: --config requires a value\n");
        process.exit(1);
      }
      result.config = args[i];
      i++;
      continue;
    }

    switch (arg) {
      case "--init":
        result.init = true;
        break;
      case "--force":
        result.initForce = true;
        break;
      case "--list":
      case "-l":
        result.list = true;
        break;
      case "--pick":
        result.pick = true;
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--version":
      case "-v":
        result.version = true;
        break;
      default:
        if (arg === "--") {
          // Everything after -- goes to claude
          result.args.push(...args.slice(i + 1));
          i = args.length;
          continue;
        }
        result.args.push(arg);
    }
    i++;
  }

  return result;
}

function doInit(force: boolean): void {
  const xdg =
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  const dir = join(xdg, "claude-wrap");
  const path = join(dir, "presets.yaml");

  if (existsSync(path) && !force) {
    process.stdout.write(
      `Config already exists at ${path}\n` +
        `Use --init --force to overwrite, or edit it manually.\n`,
    );
    process.exit(1);
  }

  const { mkdirSync } = require("node:fs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, getInitTemplate(), "utf8");
  process.stdout.write(`Created ${path}\n`);
  process.exit(0);
}

function doList(config: ReturnType<typeof loadConfig>): void {
  const names = Object.keys(config.presets).sort();
  if (names.length === 0) {
    process.stdout.write("No presets defined.\n");
    process.exit(0);
  }

  const def = config.default;
  for (const name of names) {
    const preset = config.presets[name];
    const marker = name === def ? " [default]" : "";
    process.stdout.write(
      `  ${name}${marker}\n    model:    ${preset.model}\n    base_url: ${preset.base_url}\n`,
    );
    if (preset.description) {
      process.stdout.write(`    desc:     ${preset.description}\n`);
    }
    process.stdout.write("\n");
  }
  process.exit(0);
}

async function main(): Promise<void> {
  const flags = parseFlags();

  if (flags.help) printHelp();
  if (flags.version) printVersion();

  if (flags.init) {
    doInit(flags.initForce);
  }

  const config = loadConfig(flags.config);

  if (flags.list) {
    doList(config);
  }

  const presetName = await pickPreset(config, flags.pick, flags.preset);
  if (presetName === null) {
    process.exit(0);
  }

  const preset = config.presets[presetName];

  let envVars: Record<string, string>;
  try {
    envVars = resolveEnv(preset);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`claude-wrap: ${msg}\n`);
    process.exit(1);
  }

  if (flags.dryRun) {
    process.stdout.write(
      dryRun(presetName, envVars, config, flags.args),
    );
    process.exit(0);
  }

  execClaude(config, presetName, envVars, flags.args);
}

main().catch((err) => {
  process.stderr.write(`claude-wrap: ${err.message}\n`);
  process.exit(1);
});
