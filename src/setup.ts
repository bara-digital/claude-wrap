import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  intro,
  outro,
  text,
  password,
  confirm,
  select,
  isCancel,
  cancel,
  log,
} from "@clack/prompts";
import {
  xdgConfigPath,
  readConfigRaw,
  ensureConfigDir,
  appendPreset,
  setDefault,
  type Preset,
} from "./config";
import {
  PROVIDER_CATALOG,
  findProvider,
  type ProviderCatalogEntry,
} from "./providers";
import { resolveEnv } from "./env";
import { probeEndpoint } from "./doctor";
import { parse } from "yaml";

export type LaunchMode = "terminal" | "web";

export interface SetupResult {
  presetName: string | null;
  launch: boolean;
  launchMode: LaunchMode;
}

export interface BuildPresetOpts {
  /** pasted key (literal) — ignored for login/none auth */
  keyValue?: string;
  /** override the catalog's default model */
  modelOverride?: string;
  /** for api_key/auth_token: true → store as $ENVVAR, false → literal value */
  storeAsVar: boolean;
}

/**
 * Pure: build a Preset object from a catalog entry + the user's answers.
 * Unit-tested in src/__tests__/setup.test.ts.
 */
export function buildPreset(
  entry: ProviderCatalogEntry,
  opts: BuildPresetOpts,
): Preset {
  const preset: Preset = { base_url: entry.baseUrl };
  const model = opts.modelOverride?.trim() || entry.defaultModel;
  if (model) preset.model = model;

  switch (entry.authKind) {
    case "login":
      preset.login = true;
      break;
    case "none":
      // no auth
      break;
    case "api_key":
      preset.api_key =
        opts.storeAsVar && entry.envVar ? "$" + entry.envVar : (opts.keyValue ?? "");
      break;
    case "auth_token":
      preset.auth_token =
        opts.storeAsVar && entry.envVar ? "$" + entry.envVar : (opts.keyValue ?? "");
      break;
  }
  return preset;
}

function aborted(): SetupResult {
  cancel("Aborted.");
  return { presetName: null, launch: false, launchMode: "terminal" };
}

async function promptBaseUrl(): Promise<string | null> {
  const url = await text({
    message: "Base URL:",
    placeholder: "https://api.example.com/v1",
    validate(value) {
      if (!value.trim()) return "Base URL is required";
      if (!value.startsWith("http://") && !value.startsWith("https://"))
        return "Must start with http:// or https://";
      return;
    },
  });
  return isCancel(url) ? null : url;
}

export async function runSetup(opts: {
  explicitPath?: string;
  local?: boolean;
  offerLaunch?: boolean;
}): Promise<SetupResult> {
  const path =
    opts.explicitPath ??
    (opts.local ? join(process.cwd(), ".claude-wrap.yaml") : xdgConfigPath());
  const offerLaunch = opts.offerLaunch ?? true;

  intro("Welcome to claude-wrap");
  log.step("Let's set up your first model backend.");

  // 1. Pick a provider from the catalog.
  const providerChoice = await select({
    message: "Choose a provider:",
    options: [
      ...PROVIDER_CATALOG.map((p) => ({
        value: p.id,
        label: p.label,
        hint: p.hint,
      })),
      {
        value: "__cancel__",
        label: "Set up later / cancel",
        hint: "Exit without changes",
      },
    ],
  });
  if (isCancel(providerChoice) || providerChoice === "__cancel__") {
    return aborted();
  }
  const catalogEntry = findProvider(providerChoice as string)!;

  // 2. Custom gateways need a base URL from the user.
  const baseUrl = catalogEntry.needsBaseUrl
    ? await promptBaseUrl()
    : catalogEntry.baseUrl;
  if (baseUrl === null) return aborted();

  // 3. Preset name (default to the catalog id).
  const name = await text({
    message: "Preset name:",
    initialValue: catalogEntry.id,
    validate(value) {
      if (!value.trim()) return "Name is required";
      if (!/^[a-zA-Z0-9_-]+$/.test(value))
        return "Only letters, numbers, hyphens, and underscores";
      return;
    },
  });
  if (isCancel(name)) return aborted();

  const raw = readConfigRaw(path);
  const existing = (parse(raw)?.presets ?? {}) as Record<string, unknown>;
  if (name in existing) {
    cancel(`Preset '${name}' already exists.`);
    return { presetName: null, launch: false, launchMode: "terminal" };
  }

  // 4. Credentials (masked — never echoed to stdout).
  let keyValue: string | undefined;
  let storeAsVar = false;
  if (catalogEntry.authKind === "api_key" || catalogEntry.authKind === "auth_token") {
    const secret = await password({
      message:
        catalogEntry.authKind === "auth_token"
          ? "Auth token / Bearer:"
          : "API key:",
    });
    if (isCancel(secret)) return aborted();
    keyValue = secret;

    if (catalogEntry.envVar) {
      const saveDirect = await confirm({
        message: "Save key directly in config? (recommended for a single-user machine)",
        initialValue: true,
      });
      if (isCancel(saveDirect)) return aborted();
      storeAsVar = !saveDirect;
      if (storeAsVar) {
        log.info(
          `Stored as $${catalogEntry.envVar}. Add to your shell: export ${catalogEntry.envVar}='<your key>'`,
        );
      }
    }
  } else if (catalogEntry.authKind === "login") {
    log.info(
      "Anthropic uses 'claude login' — authenticate in the browser when Claude starts.",
    );
  }

  // 5. Write the preset (document model keeps any existing comments).
  const entry: ProviderCatalogEntry = { ...catalogEntry, baseUrl };
  const preset = buildPreset(entry, { keyValue, storeAsVar });
  ensureConfigDir(path);
  writeFileSync(path, appendPreset(raw, name, preset), "utf8");
  log.success(`Preset '${name}' written to ${path}`);

  // 6. Make it the default?
  const makeDefault = await confirm({
    message: "Make this the default preset?",
    initialValue: true,
  });
  if (isCancel(makeDefault)) return aborted();
  if (makeDefault) {
    const written = readConfigRaw(path);
    const names = Object.keys((parse(written)?.presets ?? {}) as Record<string, unknown>);
    writeFileSync(path, setDefault(written, name, names), "utf8");
    log.success(`'${name}' is now the default.`);
  }

  // 7. Verify reachability + auth.
  const verify = await confirm({
    message: "Verify it now (reachability + auth)?",
    initialValue: true,
  });
  if (isCancel(verify)) return aborted();
  if (verify) {
    try {
      const envVars = resolveEnv(preset);
      if (catalogEntry.authKind === "login") {
        log.info(
          "Skipped: Anthropic login uses OAuth — authenticate in the browser when Claude starts.",
        );
      } else {
        const res = await probeEndpoint(
          envVars.ANTHROPIC_BASE_URL ?? preset.base_url,
          envVars,
        );
        if (res.reachable) log.success(`Reachable — HTTP ${res.status}`);
        else log.error(`Not reachable: ${res.error ?? "unknown error"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Could not verify: ${msg}`);
    }
  }

  // 8. Launch?
  if (!offerLaunch) {
    outro(`Preset '${name}' added. Run 'claude-wrap' to start.`);
    return { presetName: name, launch: false, launchMode: "terminal" };
  }

  const launchChoice = await select({
    message: "Launch now?",
    options: [
      { value: "terminal", label: "Terminal", hint: "claude in this terminal" },
      { value: "web", label: "Web UI", hint: "tmux + ttyd, open in browser" },
      { value: "skip", label: "Skip", hint: "finish setup for now" },
    ],
  });
  if (isCancel(launchChoice) || launchChoice === "skip") {
    outro("All set! Run 'claude-wrap' to start.");
    return { presetName: name, launch: false, launchMode: "terminal" };
  }

  return {
    presetName: name,
    launch: true,
    launchMode: launchChoice === "web" ? "web" : "terminal",
  };
}
