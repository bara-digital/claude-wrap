import { readFileSync, writeFileSync } from "node:fs";
import { text, confirm, intro, outro, isCancel, cancel, log } from "@clack/prompts";
import { parse, parseDocument } from "yaml";
import { xdgConfigPath } from "./config";

function readConfigRaw(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    const dir = path.split("/").slice(0, -1).join("/");
    const { mkdirSync } = require("node:fs");
    mkdirSync(dir, { recursive: true });
    return "presets:\n";
  }
}

export async function runAdd(explicitPath?: string): Promise<void> {
  const configPath = explicitPath ?? xdgConfigPath();

  intro("claude-wrap — add preset");

  const name = await text({
    message: "Preset name:",
    placeholder: "my-provider",
    validate(value) {
      if (!value.trim()) return "Name is required";
      if (!/^[a-zA-Z0-9_-]+$/.test(value))
        return "Only letters, numbers, hyphens, and underscores";
      return;
    },
  });

  if (isCancel(name)) {
    cancel("Aborted.");
    process.exit(0);
  }

  const raw = readConfigRaw(configPath);
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(raw) ?? {};
  } catch {
    parsed = {};
  }
  const presets = (parsed.presets as Record<string, unknown>) ?? {};
  if (name in presets) {
    cancel(`Preset '${name}' already exists.`);
    process.exit(1);
  }

  const model = await text({
    message: "Model (optional — leave empty to use Claude's default):",
    placeholder: "claude-sonnet-4-20250514",
  });

  if (isCancel(model)) {
    cancel("Aborted.");
    process.exit(0);
  }

  const baseUrl = await text({
    message: "Base URL:",
    placeholder: "https://api.openai.com/v1",
    validate(value) {
      if (!value.trim()) return "Base URL is required";
      if (!value.startsWith("http://") && !value.startsWith("https://"))
        return "Must start with http:// or https://";
      return;
    },
  });

  if (isCancel(baseUrl)) {
    cancel("Aborted.");
    process.exit(0);
  }

  const apiKey = await text({
    message: "API key — sets ANTHROPIC_API_KEY (x-api-key header):",
    placeholder: "$MY_API_KEY",
  });

  if (isCancel(apiKey)) {
    cancel("Aborted.");
    process.exit(0);
  }

  const authToken = await text({
    message: "Auth token / Bearer — sets ANTHROPIC_AUTH_TOKEN (Authorization: Bearer header):",
    placeholder: "$MY_AUTH_TOKEN",
  });

  if (isCancel(authToken)) {
    cancel("Aborted.");
    process.exit(0);
  }

  const desc = await text({
    message: "Description (optional):",
    placeholder: "GPT-4o via OpenRouter",
  });

  if (isCancel(desc)) {
    cancel("Aborted.");
    process.exit(0);
  }

  const addExtra = await confirm({
    message: "Add extra environment variables?",
    initialValue: false,
  });

  if (isCancel(addExtra)) {
    cancel("Aborted.");
    process.exit(0);
  }

  const extraEnv: Record<string, string> = {};
  if (addExtra) {
    let more = true;
    while (more) {
      const key = await text({
        message: "  Env var name:",
        placeholder: "CUSTOM_VAR",
      });
      if (isCancel(key)) {
        cancel("Aborted.");
        process.exit(0);
      }
      if (!key.trim()) break;

      const val = await text({
        message: `  Value for ${key}:`,
        placeholder: "some-value",
      });
      if (isCancel(val)) {
        cancel("Aborted.");
        process.exit(0);
      }
      extraEnv[key.trim()] = val;

      const cont = await confirm({
        message: "  Add another?",
        initialValue: false,
      });
      if (isCancel(cont) || !cont) {
        more = false;
      }
    }
  }

  // Build preset entry
  const preset: Record<string, unknown> = {
    base_url: baseUrl,
  };
  if (model) preset.model = model;
  if (desc) preset.description = desc;
  if (apiKey) preset.api_key = apiKey;
  if (authToken) preset.auth_token = authToken;
  if (Object.keys(extraEnv).length > 0) preset.extra_env = extraEnv;

  // Append via the document model so comments in the existing file are
  // preserved (DEEP-SCAN 1.1 — full stringify previously stripped them).
  const doc = parseDocument(raw);
  if (!doc.hasIn(["presets"]) || doc.get("presets") == null) {
    doc.set("presets", {});
  }
  doc.setIn(["presets", name], preset);

  writeFileSync(configPath, String(doc), "utf8");

  outro(`Preset '${name}' added to ${configPath}`);
  process.exit(0);
}
