import { runSetup } from "./setup";

// `--add` now uses the same guided provider catalog as the first-run wizard,
// but without the "launch now" prompt — kept non-blocking so it can be chained
// in scripts. (Previously this was a fully freeform, comment-stripping flow.)
export async function runAdd(explicitPath?: string): Promise<void> {
  const result = await runSetup({ explicitPath, offerLaunch: false });
  process.exit(result.presetName === null ? 0 : 0);
}
