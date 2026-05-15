import { isCancel, cancel, intro, select } from "@clack/prompts";
import type { Config } from "./config";

export async function pickPreset(
  config: Config,
  forcePicker: boolean,
  presetFlag?: string,
): Promise<string | null> {
  const names = Object.keys(config.presets);

  if (names.length === 0) {
    cancel("No presets defined in config. Run 'claude-wrap --init' first.");
    return null;
  }

  if (presetFlag) {
    if (!config.presets[presetFlag]) {
      cancel(`Preset '${presetFlag}' not found. Available: ${names.join(", ")}`);
      return null;
    }
    return presetFlag;
  }

  if (config.default && !forcePicker) {
    if (!config.presets[config.default]) {
      cancel(
        `Default preset '${config.default}' not found. Available: ${names.join(", ")}`,
      );
      return null;
    }
    return config.default;
  }

  // Sort presets by name for consistent display
  names.sort();

  intro("claude-wrap — select provider");

  const selected = await select({
    message: "Choose a model backend:",
    options: names.map((name) => ({
      value: name,
      label: name,
      hint: config.presets[name].model,
    })),
  });

  if (isCancel(selected)) {
    cancel("No preset selected.");
    return null;
  }

  return selected;
}
