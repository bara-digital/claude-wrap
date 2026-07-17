import { spawnSync } from "node:child_process";
import type { Config } from "./config";
import { resolveClaudeBin } from "./config";
import { resolveEnv } from "./env";

interface PresetHealth {
  name: string;
  model: string;
  base_url: string;
  varsOk: boolean;
  varsError?: string;
  reachable: boolean;
  reachStatus?: number;
  reachError?: string;
  hasAuth: boolean;
}

async function checkEndpoint(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<{ reachable: boolean; status?: number; error?: string }> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return { reachable: true, status: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { reachable: false, error: msg };
  }
}

// Probe a preset's reachability, selecting the auth header that matches how the
// preset authenticates: Bearer for auth_token, x-api-key for api_key.
// (DEEP-SCAN 1.4 — doctor previously sent x-api-key for Bearer-only gateways,
// producing false ✗ results. Exported for unit testing.)
export async function probeEndpoint(
  baseUrl: string,
  envVars: Record<string, string>,
): Promise<{ reachable: boolean; status?: number; error?: string }> {
  const headers: Record<string, string> = {};
  if (envVars.ANTHROPIC_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${envVars.ANTHROPIC_AUTH_TOKEN}`;
  } else if (envVars.ANTHROPIC_API_KEY) {
    headers["x-api-key"] = envVars.ANTHROPIC_API_KEY;
  }
  return checkEndpoint(baseUrl, headers);
}

export async function runDoctor(config: Config): Promise<void> {
  process.stdout.write("claude-wrap doctor\n\n");

  const names = Object.keys(config.presets).sort();
  if (names.length === 0) {
    process.stdout.write("  No presets defined.\n");
    process.exit(0);
  }

  for (const name of names) {
    const preset = config.presets[name];

    let envVars: Record<string, string> | null = null;
    let varsError: string | undefined;
    try {
      envVars = resolveEnv(preset);
    } catch (err) {
      varsError = err instanceof Error ? err.message : String(err);
    }

    const hasAuth = envVars
      ? !!(envVars.ANTHROPIC_API_KEY || envVars.ANTHROPIC_AUTH_TOKEN)
      : false;
    const authToken = envVars
      ? (envVars.ANTHROPIC_AUTH_TOKEN ?? envVars.ANTHROPIC_API_KEY ?? "")
      : "";

    process.stdout.write(`  ${name}\n`);
    process.stdout.write(`    model:   ${preset.model}\n`);
    process.stdout.write(`    base:    ${preset.base_url}\n`);

    if (varsError) {
      process.stdout.write(`    vars:    \x1b[31m✗\x1b[0m ${varsError}\n`);
      process.stdout.write(`    reach:   (skipped — vars not resolved)\n\n`);
      continue;
    }

    process.stdout.write(`    vars:    \x1b[32m✓\x1b[0m all resolved\n`);

    if (hasAuth) {
      const keyPreview = authToken.slice(0, 4) + "...";
      process.stdout.write(`    auth:    \x1b[32m✓\x1b[0m (${keyPreview})\n`);
    } else {
      process.stdout.write(`    auth:    ⚠ no api_key set\n`);
    }

    if (envVars) {
      process.stdout.write(`    reach:   `);
      const result = await probeEndpoint(envVars.ANTHROPIC_BASE_URL ?? preset.base_url, envVars);
      if (result.reachable) {
        const statusColor = result.status === 200 ? "\x1b[32m" : "\x1b[33m";
        process.stdout.write(`${statusColor}✓\x1b[0m HTTP ${result.status}\n`);
      } else {
        process.stdout.write(`\x1b[31m✗\x1b[0m ${result.error}\n`);
      }
    }

    process.stdout.write("\n");
  }

  // Check claude binary
  process.stdout.write("---\n");
  const claudeBin = resolveClaudeBin(config.claude_bin);
  const cmd = claudeBin[0];
  const versionCheck = spawnSync(cmd, ["--version"], { stdio: "pipe", timeout: 5000 });
  if (versionCheck.status === 0) {
    const version = versionCheck.stdout.toString().trim().split("\n")[0];
    process.stdout.write(`  claude:   \x1b[32m✓\x1b[0m ${version}\n`);
  } else {
    const err = versionCheck.stderr?.toString() || versionCheck.error?.message || "not found";
    process.stdout.write(`  claude:   \x1b[31m✗\x1b[0m ${err.trim()}\n`);
  }

  process.exit(0);
}
