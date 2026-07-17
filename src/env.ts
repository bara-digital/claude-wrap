import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { Preset } from "./config";

function walkUpEnv(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, ".env");
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // not found
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseDotEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadDotEnv(): Record<string, string> {
  const path = walkUpEnv(process.cwd());
  if (!path) return {};
  try {
    const raw = readFileSync(path, "utf8");
    return parseDotEnv(raw);
  } catch {
    return {};
  }
}

export function resolveVar(
  value: string,
  env: Record<string, string>,
): string {
  return value.replace(
    /\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_, name1, name2) => {
      const name = name1 ?? name2;
      const found = env[name];
      if (found !== undefined) return found;
      throw new Error(`Environment variable '${name}' is not set`);
    },
  );
}

export function resolveEnv(preset: Preset): Record<string, string> {
  const dotEnv = loadDotEnv();
  const combinedEnv = { ...dotEnv, ...(process.env as Record<string, string>) };

  const result: Record<string, string> = {};

  // Only set ANTHROPIC_BASE_URL for non-Anthropic endpoints.
  // Setting it for the default URL changes how Claude Code resolves models.
  if (!preset.base_url.startsWith("https://api.anthropic.com")) {
    result.ANTHROPIC_BASE_URL = preset.base_url;
  }

  if (preset.model) {
    result.ANTHROPIC_MODEL = preset.model;
  }

  if (preset.api_key) {
    const key = resolveVar(preset.api_key, combinedEnv);
    result.ANTHROPIC_API_KEY = key;
  }

  if (preset.auth_token) {
    const token = resolveVar(preset.auth_token, combinedEnv);
    result.ANTHROPIC_AUTH_TOKEN = token;
  } else if (preset.api_key) {
    // Backward compatibility: presets that only set `api_key` previously
    // populated both headers. Keep emitting ANTHROPIC_AUTH_TOKEN so gateways
    // that authenticate via `Authorization: Bearer` keep working.
    result.ANTHROPIC_AUTH_TOKEN = resolveVar(preset.api_key, combinedEnv);
  }

  if (preset.extra_env) {
    for (const [key, value] of Object.entries(preset.extra_env)) {
      if (BLOCKED_ENV_VARS.has(key.toUpperCase())) {
        throw new Error(
          `Cannot override protected environment variable: ${key}`,
        );
      }
      result[key] = resolveVar(value, combinedEnv);
    }
  }

  return result;
}

const BLOCKED_ENV_VARS = new Set([
  "PATH",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "EDITOR",
  "VISUAL",
  "PWD",
  "TMPDIR",
  "XDG_CONFIG_HOME",
  "XDG_STATE_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
]);
