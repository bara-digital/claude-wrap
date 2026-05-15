import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";

export interface Preset {
  description?: string;
  model: string;
  base_url: string;
  api_key?: string;
  extra_env?: Record<string, string>;
}

export interface Config {
  default?: string;
  claude_bin?: string | string[];
  presets: Record<string, Preset>;
}

export function xdgConfigPath(): string {
  const xdg =
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdg, "claude-wrap", "presets.yaml");
}

function walkUp(
  start: string,
  filename: string,
): string | null {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, filename);
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // file doesn't exist, keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadYaml(path: string): Config {
  const raw = readFileSync(path, "utf8");
  const parsed = parse(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`${path}: empty or invalid YAML`);
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path}: expected a YAML mapping at top level`);
  }
  return validateConfig(parsed as Record<string, unknown>, path);
}

function validateConfig(raw: Record<string, unknown>, path: string): Config {
  const errors: string[] = [];

  if (!raw.presets || typeof raw.presets !== "object" || Array.isArray(raw.presets)) {
    throw new Error(`${path}: missing required key 'presets' (must be a mapping)`);
  }

  const presetsRaw = raw.presets as Record<string, unknown>;
  const presets: Record<string, Preset> = {};

  for (const [name, value] of Object.entries(presetsRaw)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`presets.${name}: must be a mapping`);
      continue;
    }
    const p = value as Record<string, unknown>;

    if (!p.model || typeof p.model !== "string") {
      errors.push(`presets.${name}: missing required field 'model'`);
    }
    if (!p.base_url || typeof p.base_url !== "string") {
      errors.push(`presets.${name}: missing required field 'base_url'`);
    }
    if (p.description !== undefined && typeof p.description !== "string") {
      errors.push(`presets.${name}: 'description' must be a string`);
    }
    if (p.api_key !== undefined && typeof p.api_key !== "string") {
      errors.push(`presets.${name}: 'api_key' must be a string`);
    }
    if (p.extra_env !== undefined) {
      if (typeof p.extra_env !== "object" || Array.isArray(p.extra_env)) {
        errors.push(`presets.${name}: 'extra_env' must be a mapping`);
      } else {
        for (const [ek, ev] of Object.entries(p.extra_env as Record<string, unknown>)) {
          if (typeof ev !== "string") {
            errors.push(`presets.${name}.extra_env.${ek}: must be a string`);
          }
        }
      }
    }

    if (errors.length === 0 || !errors.some((e) => e.startsWith(`presets.${name}:`))) {
      const preset: Preset = {
        model: p.model as string,
        base_url: p.base_url as string,
      };
      if (p.description !== undefined) preset.description = p.description as string;
      if (p.api_key !== undefined) preset.api_key = p.api_key as string;
      if (p.extra_env !== undefined) preset.extra_env = p.extra_env as Record<string, string>;
      presets[name] = preset;
    }
  }

  if (errors.length > 0) {
    throw new Error(`${path}:\n  ${errors.join("\n  ")}`);
  }

  if (raw.default !== undefined && typeof raw.default !== "string") {
    throw new Error(`${path}: 'default' must be a string`);
  }

  if (raw.claude_bin !== undefined) {
    if (typeof raw.claude_bin === "string") {
      // valid
    } else if (
      Array.isArray(raw.claude_bin) &&
      raw.claude_bin.every((v) => typeof v === "string")
    ) {
      // valid
    } else {
      throw new Error(
        `${path}: 'claude_bin' must be a string or array of strings`,
      );
    }
  }

  return {
    default: raw.default as string | undefined,
    claude_bin: raw.claude_bin as string | string[] | undefined,
    presets,
  };
}

export function loadConfig(explicitPath?: string): Config {
  const globalPath = explicitPath ?? xdgConfigPath();

  let global: Config;
  try {
    global = loadYaml(globalPath);
  } catch (err) {
    if (explicitPath) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load config from ${globalPath}\n${msg}\n\n` +
        `Create one with: claude-wrap --init`,
    );
  }

  const localPath = explicitPath ? null : walkUp(process.cwd(), ".claude-wrap.yaml");
  if (!localPath) return global;

  let local: Config;
  try {
    local = loadYaml(localPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load config from ${localPath}\n${msg}`);
  }

  // Deep merge: local presets win completely over global presets with same name
  const mergedPresets = { ...global.presets, ...local.presets };
  const mergedDefault = local.default ?? global.default;
  const mergedClaudeBin = local.claude_bin ?? global.claude_bin;

  // Validate that required fields are still met after merge
  const merged: Config = {
    default: mergedDefault,
    claude_bin: mergedClaudeBin,
    presets: mergedPresets,
  };

  return merged;
}

export function resolveClaudeBin(
  claudeBin: string | string[] | undefined,
): string[] {
  if (claudeBin === undefined) return ["claude"];
  if (typeof claudeBin === "string") return [claudeBin];
  return claudeBin;
}

export function getInitTemplate(): string {
  return `# claude-wrap preset configuration
# See all options: https://github.com/dedisuhanda/claude-wrap

# Optional: default preset (skips the picker)
# default: anthropic

# Optional: override path to the claude binary
# claude_bin: /opt/homebrew/bin/claude
# claude_bin:
#   - npx
#   - "@anthropic-ai/claude-code"

presets:
  # Example: Anthropic (direct — no proxy needed)
  anthropic:
    description: "Claude Sonnet via Anthropic API"
    model: claude-sonnet-4-20250514
    base_url: https://api.anthropic.com/v1
    api_key: $ANTHROPIC_API_KEY

  # Example: OpenAI via OpenRouter (proxy translates Anthropic API → OpenAI)
  # openai:
  #   description: "GPT-4o via OpenRouter"
  #   model: gpt-4o
  #   base_url: https://openrouter.ai/api/v1
  #   api_key: $OPENROUTER_API_KEY

  # Example: Groq via local LiteLLM proxy
  # groq:
  #   description: "Llama 3.3 via Groq + LiteLLM"
  #   model: groq/llama-3.3-70b-versatile
  #   base_url: http://localhost:4000
  #   api_key: $GROQ_API_KEY

  # Example: Ollama (local)
  # ollama:
  #   description: "Local Ollama models via LiteLLM"
  #   model: ollama/llama3
  #   base_url: http://localhost:4000
  #   # no api_key needed for local Ollama
`;
}

export function setDefault(
  rawYaml: string,
  presetName: string,
  allPresets: string[],
): string {
  if (!allPresets.includes(presetName)) {
    throw new Error(
      `Preset '${presetName}' not found. Available: ${allPresets.join(", ")}`,
    );
  }

  const lines = rawYaml.split("\n");
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#?\s*default:/.test(lines[i])) {
      lines[i] = `default: ${presetName}`;
      found = true;
      break;
    }
  }

  if (!found) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "presets:") {
        lines.splice(i, 0, "", `default: ${presetName}`);
        break;
      }
    }
  }

  return lines.join("\n");
}
