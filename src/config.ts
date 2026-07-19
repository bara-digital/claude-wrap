import { parse, parseDocument, YAMLMap } from "yaml";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";

export interface Preset {
  description?: string;
  model?: string;
  base_url: string;
  api_key?: string;
  auth_token?: string;
  login?: boolean;
  bare?: boolean;
  extra_env?: Record<string, string>;
}

export interface WebConfig {
  host?: string;
  port?: number;
  auth?: string;
  tls_cert?: string;
  tls_key?: string;
  font_size?: number;
}

export interface Config {
  default?: string;
  claude_bin?: string | string[];
  web?: WebConfig;
  presets: Record<string, Preset>;
}

export function xdgConfigPath(): string {
  const xdg =
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdg, "claude-wrap", "presets.yaml");
}

export function hasLocalConfig(): string | null {
  return walkUp(process.cwd(), ".claude-wrap.yaml");
}

export function configExists(explicitPath?: string): boolean {
  return existsSync(explicitPath ?? xdgConfigPath());
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

    if (p.model !== undefined && typeof p.model !== "string") {
      errors.push(`presets.${name}: 'model' must be a string`);
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
    if (p.auth_token !== undefined && typeof p.auth_token !== "string") {
      errors.push(`presets.${name}: 'auth_token' must be a string`);
    }
    if (p.login !== undefined && typeof p.login !== "boolean") {
      errors.push(`presets.${name}: 'login' must be a boolean`);
    }
    if (p.bare !== undefined && typeof p.bare !== "boolean") {
      errors.push(`presets.${name}: 'bare' must be a boolean`);
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
        base_url: p.base_url as string,
      };
      if (p.model !== undefined) preset.model = p.model as string;
      if (p.description !== undefined) preset.description = p.description as string;
      if (p.api_key !== undefined) preset.api_key = p.api_key as string;
      if (p.auth_token !== undefined) preset.auth_token = p.auth_token as string;
      if (p.login !== undefined) preset.login = p.login as boolean;
      if (p.bare !== undefined) preset.bare = p.bare as boolean;
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

  if (raw.web !== undefined) {
    if (typeof raw.web !== "object" || Array.isArray(raw.web) || raw.web === null) {
      throw new Error(`${path}: 'web' must be a mapping`);
    }
    const web = raw.web as Record<string, unknown>;
    if (web.host !== undefined && typeof web.host !== "string") {
      errors.push(`web.host: must be a string`);
    }
    if (web.port !== undefined && typeof web.port !== "number") {
      errors.push(`web.port: must be a number`);
    }
    if (web.auth !== undefined && typeof web.auth !== "string") {
      errors.push(`web.auth: must be a string`);
    }
    if (web.tls_cert !== undefined && typeof web.tls_cert !== "string") {
      errors.push(`web.tls_cert: must be a string`);
    }
    if (web.tls_key !== undefined && typeof web.tls_key !== "string") {
      errors.push(`web.tls_key: must be a string`);
    }
    if (web.font_size !== undefined && typeof web.font_size !== "number") {
      errors.push(`web.font_size: must be a number`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`${path}:\n  ${errors.join("\n  ")}`);
  }

  return {
    default: raw.default as string | undefined,
    claude_bin: raw.claude_bin as string | string[] | undefined,
    web: (raw.web as unknown) as WebConfig | undefined,
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
  const mergedWeb = local.web ?? global.web;

  // Validate that required fields are still met after merge
  const merged: Config = {
    default: mergedDefault,
    claude_bin: mergedClaudeBin,
    web: mergedWeb,
    presets: mergedPresets,
  };

  return merged;
}

export function resolveClaudeBin(
  claudeBin: string | string[] | undefined,
): string[] {
  if (claudeBin === undefined) return ["claude"];
  if (typeof claudeBin === "string") {
    validateBinName(claudeBin);
    return [claudeBin];
  }
  if (!Array.isArray(claudeBin) || claudeBin.length === 0) return ["claude"];
  validateBinName(claudeBin[0]);
  return claudeBin;
}

const ALLOWED_BINS = ["claude", "npx", "node", "bun"];
const BLOCKED_BIN_PREFIXES = ["/tmp", "/var/tmp", "/dev"];

function validateBinName(cmd: string): void {
  if (!cmd) throw new Error("claude_bin: command cannot be empty");

  // If it looks like a path, apply the path guards.
  if (cmd.includes("/")) {
    for (const prefix of BLOCKED_BIN_PREFIXES) {
      if (cmd.startsWith(prefix)) {
        throw new Error(
          `claude_bin: binary path '${cmd}' is not allowed. ` +
            `Use a system-installed binary in /usr/local/bin or similar.`,
        );
      }
    }

    // Reject relative paths — a cloned repo could ship an executable
    // (e.g. ./runme or ../x) and point claude_bin at it.
    if (!cmd.startsWith("/")) {
      throw new Error(
        `claude_bin: relative paths are not allowed ('${cmd}'). ` +
          `Use an absolute path to a system-installed binary.`,
      );
    }

    // The basename must still be an allowed binary, so an absolute path
    // can only ever resolve to claude/npx/node/bun.
    const base = cmd.split("/").pop() ?? "";
    if (!ALLOWED_BINS.includes(base)) {
      throw new Error(
        `claude_bin: '${cmd}' is not allowed. ` +
          `The binary name must be one of: ${ALLOWED_BINS.join(", ")}`,
      );
    }
    return;
  }

  // Simple command name — allowlist
  if (!ALLOWED_BINS.includes(cmd)) {
    throw new Error(
      `claude_bin: '${cmd}' is not an allowed binary. Allowed: ${ALLOWED_BINS.join(", ")}`,
    );
  }
}

export function getInitTemplate(): string {
  return `# claude-wrap preset configuration
# See all options: https://github.com/bara-digital/claude-wrap

default: anthropic

# Optional: override path to the claude binary
# claude_bin: /opt/homebrew/bin/claude
# claude_bin:
#   - npx
#   - "@anthropic-ai/claude-code"

presets:
  # Anthropic via subscription (OAuth / login)
  anthropic:
    description: "Claude via Anthropic subscription"
    base_url: https://api.anthropic.com/v1
    login: true

  # DeepSeek via Anthropic-compatible API
  # deepseek:
  #   description: "DeepSeek V4"
  #   model: deepseek-v4-pro[1m]
  #   base_url: https://api.deepseek.com/anthropic
  #   api_key: $DEEPSEEK_API_KEY
  #   extra_env:
  #     ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro[1m]"
  #     ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro[1m]"
  #     ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]"
  #     CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"

  # OpenAI via OpenRouter
  # openai:
  #   description: "GPT-4o via OpenRouter"
  #   model: openai/gpt-4o
  #   base_url: https://openrouter.ai/api/v1
  #   api_key: $OPENROUTER_API_KEY

  # Groq via local LiteLLM proxy
  # groq:
  #   description: "Llama 3.3 via Groq + LiteLLM"
  #   model: groq/llama-3.3-70b-versatile
  #   base_url: http://localhost:4000/v1
  #   api_key: $GROQ_API_KEY

  # Ollama (local)
  # ollama:
  #   description: "Local Ollama models via LiteLLM"
  #   model: ollama/llama3
  #   base_url: http://localhost:4000/v1
  #   # no api_key needed

  # Gateway that needs a Bearer token instead of x-api-key
  # (ANTHROPIC_API_KEY is left unset so Claude Code routes through the gateway)
  # morph:
  #   description: "Custom model via third-party gateway"
  #   model: my-model
  #   base_url: https://api.morphllm.com/v1
  #   auth_token: $MORPH_API_KEY
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

export function removePreset(
  rawYaml: string,
  presetName: string,
  allPresets: string[],
): string {
  if (!allPresets.includes(presetName)) {
    throw new Error(
      `Preset '${presetName}' not found. Available: ${allPresets.join(", ")}`,
    );
  }

  // Edit via the document model so comments in the existing file are
  // preserved (DEEP-SCAN 1.2 — full stringify previously stripped them).
  const doc = parseDocument(rawYaml);
  doc.deleteIn(["presets", presetName]);
  if (doc.get("default") === presetName) {
    doc.deleteIn(["default"]);
  }

  return String(doc);
}

export function readConfigRaw(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    // No config yet — make sure the directory exists and return an empty
    // `presets:` document so the first preset can be appended cleanly.
    const dir = path.split("/").slice(0, -1).join("/");
    mkdirSync(dir, { recursive: true });
    return "presets:\n";
  }
}

export function ensureConfigDir(explicitPath?: string): string {
  const path = explicitPath ?? xdgConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

// Append (or replace) a preset via the document model so comments elsewhere in
// the file are preserved (DEEP-SCAN 1.1). Throws if the name already exists so
// callers can prompt rather than silently overwrite.
export function appendPreset(
  rawYaml: string,
  name: string,
  preset: Preset,
): string {
  const doc = parseDocument(rawYaml);
  if (!doc.hasIn(["presets"]) || doc.get("presets") == null) {
    doc.set("presets", new YAMLMap());
  }
  if (doc.hasIn(["presets", name])) {
    throw new Error(`Preset '${name}' already exists.`);
  }
  doc.setIn(["presets", name], preset);
  return String(doc);
}
