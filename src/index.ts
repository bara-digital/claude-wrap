import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig, getInitTemplate, xdgConfigPath, setDefault, removePreset, hasLocalConfig } from "./config";
import { pickPreset } from "./picker";
import { execClaude, dryRun } from "./launcher";
import { resolveEnv } from "./env";
import { runDoctor } from "./doctor";
import { runUpdate } from "./update";
import { runAdd } from "./add";
import { generateCompletion } from "./completions";
import { recordLaunch, showStats } from "./stats";
import { showInfo } from "./info";
import { VERSION } from "./version";

function printHelp(): void {
  const help = `claude-wrap — launch Claude Code with any LLM backend

Usage:
  claude-wrap [wrapper-flags] [-- claude-args...]

Wrapper flags:
  --preset, -p <name>    Skip picker, use named preset
  --config, -c <path>    Explicit config file path
  --init                 Generate template config at ~/.config/claude-wrap/presets.yaml
  --init --force         Overwrite existing config
  --local                Target local .claude-wrap.yaml instead of global config
  --list, -l             List all available presets (no launch)
  --add                  Interactive wizard to add a new preset
  --remove <name>        Delete a preset from config
  --set-default <name>   Set the default preset from CLI
  --config-edit          Open the presets config file in \$EDITOR
  --doctor               Validate all presets — base_url reachability, auth, \$VAR resolution
  --update               Self-update binary from GitHub Releases
  --export               Print resolved env vars as shell export statements
  --completion <shell>   Print shell completion script (zsh, bash, fish)
  --pick                 Force interactive picker even when default is set
  --dry-run              Print resolved env vars and command without launching
  --no-bare              Skip auto-injecting --bare for non-Anthropic backends
  --which                Print which preset would be selected (no launch)
  --stats                Show launch statistics per preset
  --info                 Print environment diagnostics
  --session [id]         Resume a previous Claude Code session
  --version, -v          Show version
  --help, -h             Show this help

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
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

function parseFlags(): {
  preset?: string;
  config?: string;
  init: boolean;
  initForce: boolean;
  list: boolean;
  doctor: boolean;
  update: boolean;
  completion?: string;
  configEdit: boolean;
  local: boolean;
  setDefaultPreset?: string;
  removePreset?: string;
  add: boolean;
  exportOnly: boolean;
  noBare: boolean;
  session?: string;
  which: boolean;
  stats: boolean;
  info: boolean;
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
    doctor: false,
    update: false,
    completion: undefined as string | undefined,
    configEdit: false,
    local: false,
    setDefaultPreset: undefined as string | undefined,
    removePreset: undefined as string | undefined,
    add: false,
    exportOnly: false,
    noBare: false,
    session: undefined as string | undefined,
    which: false,
    stats: false,
    info: false,
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
      case "--doctor":
        result.doctor = true;
        break;
      case "--update":
        result.update = true;
        break;
      case "--completion":
        i++;
        if (i >= args.length) {
          process.stderr.write("claude-wrap: --completion requires a shell name (zsh, bash, fish)\n");
          process.exit(1);
        }
        result.completion = args[i];
        break;
      case "--config-edit":
        result.configEdit = true;
        break;
      case "--local":
        result.local = true;
        break;
      case "--add":
        result.add = true;
        break;
      case "--remove":
        i++;
        if (i >= args.length) {
          process.stderr.write("claude-wrap: --remove requires a preset name\n");
          process.exit(1);
        }
        result.removePreset = args[i];
        break;
      case "--export":
        result.exportOnly = true;
        break;
      case "--set-default":
        i++;
        if (i >= args.length) {
          process.stderr.write("claude-wrap: --set-default requires a preset name\n");
          process.exit(1);
        }
        result.setDefaultPreset = args[i];
        break;
      case "--list":
      case "-l":
        result.list = true;
        break;
      case "--pick":
        result.pick = true;
        break;
      case "--no-bare":
        result.noBare = true;
        break;
      case "--which":
        result.which = true;
        break;
      case "--stats":
        result.stats = true;
        break;
      case "--info":
        result.info = true;
        break;
      case "--session":
        i++;
        if (i < args.length && !args[i].startsWith("-")) {
          result.session = args[i];
        } else {
          result.session = "latest";
          i--; // backtrack — no arg
        }
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

function doConfigEdit(explicitPath?: string, local?: boolean): void {
  const path = explicitPath ?? (local ? join(process.cwd(), ".claude-wrap.yaml") : xdgConfigPath());

  if (!existsSync(path)) {
    if (local) {
      const template = `# Local claude-wrap config (project overrides)
# Presets defined here override same-name presets from the global config.
#
# See: https://github.com/bara-digital/claude-wrap

presets:
  # example:
  #   model: gpt-4o
  #   base_url: https://openrouter.ai/api/v1
  #   api_key: $OPENROUTER_API_KEY
`;
      writeFileSync(path, template, "utf8");
    } else {
      process.stderr.write(`Config not found at ${path}\n`);
      process.stderr.write(`Run 'claude-wrap --init' to create one.\n`);
      process.exit(1);
    }
  }

  const editor = process.env.EDITOR || process.env.VISUAL || "vim";

  const child = spawnSync(editor, [path], { stdio: "inherit" });
  process.exit(child.status ?? 0);
}

function doSetDefault(name: string, explicitPath?: string): void {
  const path = explicitPath ?? xdgConfigPath();

  if (!existsSync(path)) {
    process.stderr.write(`Config not found at ${path}\n`);
    process.stderr.write(`Run 'claude-wrap --init' to create one.\n`);
    process.exit(1);
  }

  const config = loadConfig(explicitPath);
  const presets = Object.keys(config.presets);

  if (!presets.includes(name)) {
    process.stderr.write(
      `Preset '${name}' not found. Available: ${presets.join(", ")}\n`,
    );
    process.exit(1);
  }

  const raw = readFileSync(path, "utf8");
  const updated = setDefault(raw, name, presets);
  writeFileSync(path, updated, "utf8");
  process.stdout.write(`Default preset set to '${name}'\n`);
  process.exit(0);
}

function doRemove(name: string, explicitPath?: string): void {
  const path = explicitPath ?? xdgConfigPath();

  if (!existsSync(path)) {
    process.stderr.write(`Config not found at ${path}\n`);
    process.exit(1);
  }

  const config = loadConfig(explicitPath);
  const presets = Object.keys(config.presets);

  const raw = readFileSync(path, "utf8");
  const updated = removePreset(raw, name, presets);
  writeFileSync(path, updated, "utf8");
  process.stdout.write(`Preset '${name}' removed.\n`);
  process.exit(0);
}

function doInit(force: boolean, local?: boolean): void {
  if (local) {
    const path = join(process.cwd(), ".claude-wrap.yaml");
    if (existsSync(path) && !force) {
      process.stdout.write(
        `Config already exists at ${path}\n` +
          `Use --init --local --force to overwrite, or edit it manually.\n`,
      );
      process.exit(1);
    }
    const template = `# Local claude-wrap config (project overrides)
# Presets defined here override same-name presets from the global config.
#
# See: https://github.com/bara-digital/claude-wrap

presets:
  # example:
  #   model: gpt-4o
  #   base_url: https://openrouter.ai/api/v1
  #   api_key: $OPENROUTER_API_KEY
`;
    writeFileSync(path, template, "utf8");
    process.stdout.write(`Created ${path}\n`);
    process.exit(0);
  }

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

  // Determine which presets come from local config
  const localPath = hasLocalConfig();
  let localPresets: Set<string> = new Set();
  if (localPath) {
    try {
      const localRaw = readFileSync(localPath, "utf8");
      const { parse: yamlParse } = require("yaml");
      const localParsed = yamlParse(localRaw);
      if (localParsed?.presets) {
        localPresets = new Set(Object.keys(localParsed.presets));
      }
    } catch {
      // ignore parse errors
    }
  }

  const def = config.default;
  for (const name of names) {
    const preset = config.presets[name];
    const markers: string[] = [];
    if (name === def) markers.push("default");
    if (localPresets.has(name)) markers.push("local");
    const marker = markers.length > 0 ? ` [${markers.join(", ")}]` : "";
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

  if (flags.update) {
    await runUpdate();
  }

  if (flags.completion) {
    process.stdout.write(generateCompletion(flags.completion));
    process.exit(0);
  }

  if (flags.stats) {
    showStats();
  }

  const config = loadConfig(flags.config);

  if (flags.info) {
    showInfo(config);
  }

  if (flags.doctor) {
    await runDoctor(config);
  }

  // Inject session args into claude passthrough
  if (flags.session) {
    if (flags.session === "latest") {
      flags.args.unshift("--continue");
    } else {
      flags.args.unshift("--resume", flags.session);
    }
  }

  const presetName = await pickPreset(config, flags.pick, flags.preset);
  if (presetName === null) {
    process.exit(0);
  }

  const localPath = hasLocalConfig();
  const preset = config.presets[presetName];

  if (flags.which) {
    process.stdout.write(`${presetName}\n`);
    process.exit(0);
  }

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
      dryRun(presetName, envVars, config, flags.args, flags.noBare),
    );
    process.exit(0);
  }

  if (flags.exportOnly) {
    for (const [key, value] of Object.entries(envVars)) {
      process.stdout.write(`export ${key}='${value}'\n`);
    }
    process.exit(0);
  }

  // If preset has login: true, run claude login first (Anthropic OAuth flow)
  if (preset.login) {
    const loginResult = spawnSync("claude", ["login"], {
      stdio: "inherit",
      env: { ...process.env, ...envVars },
    });
    if (loginResult.status !== 0) {
      process.exit(loginResult.status ?? 1);
    }
  }

  if (localPath) {
    process.stderr.write(`[claude-wrap] using project config: ${localPath}\n`);
  }

  recordLaunch(presetName);

  execClaude(config, presetName, envVars, flags.args, flags.noBare);
}

main().catch((err) => {
  process.stderr.write(`claude-wrap: ${err.message}\n`);
  process.exit(1);
});
