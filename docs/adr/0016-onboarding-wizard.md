---
Status: accepted
---

# First-run onboarding wizard

When `claude-wrap` is run with no config file present, it now launches an interactive
**onboarding wizard** (`runSetup` in `src/setup.ts`) instead of erroring out. The wizard
offers a curated **provider catalog** (`src/providers.ts`), writes a working preset, and
closes the loop by offering to set the preset as default, verify its reachability/auth, and
launch Claude Code immediately (terminal or web UI). The same wizard also powers `--add`
(catalog replaces the old freeform flow).

## Context

Before this decision, the first run was a dead-end: `main()` called `loadConfig` with no
guard, so a missing config threw `Failed to load config… Create one with: claude-wrap --init`
and exited 1. Even once a user discovered `--init` (a static template with only an Anthropic
login preset and everything else commented out) or `--add`, the experience was rough:

- `--add` was fully freeform — the user had to know each backend's `base_url`, exact `model`
  string, and which `$VAR` to set.
- After a preset was written, `runAdd` did nothing but print a confirmation and exit — no
  default, no verification, no launch.

## Decision

1. **Auto-launch the wizard** on a launch-intent run with no config (detected via the new
   `configExists` helper). Management subcommands (`--init`, `--add`, `--edit`, `--remove`,
   `--config-edit`, `--list`, `--doctor`, `--stats`, `--info`, `--set-default`, `--local`,
   plus `--help`/`--version`/`--update`/`--completion`) are excluded from this trigger so they
   keep working as before.
2. **Provider catalog** over freeform typing. `PROVIDER_CATALOG` ships Anthropic, DeepSeek,
   OpenRouter, Groq (LiteLLM), Ollama, and a `custom` entry that falls back to a prompted
   base URL. Each entry pre-fills `base_url` / `defaultModel` / `authKind` so the user only
   picks + pastes a key.
3. **Store the key literally in config by default** (frictionless first run on a single-user
   machine), with an opt-out that stores a `$VAR` reference instead and prints the `export`
   line to set. The key is collected via a masked `password()` prompt and never echoed.
4. **Reuse, don't duplicate**: config writes go through the existing comment-preserving
   `appendPreset` (`src/config.ts`, from the DEEP-SCAN comment-preservation work); verification
   reuses the existing `probeEndpoint` (`src/doctor.ts`); launch reuses `execClaude` /
   `runWeb`. `buildPreset` is a pure, unit-tested function.

## Considered Options

- **Keep the error dead-end + better message** — rejected: still requires the user to know
  about `--init`/`--add` and to hand-write YAML; does nothing for the "I just installed this"
  moment.
- **Non-interactive first run that writes the static `--init` template and exits** — rejected:
  only sets up Anthropic-login; the user still has to edit YAML to add any other backend, so
  the core friction (knowing base_url/model/key) remains.
- **Freeform interactive `--add` only (no catalog)** — rejected: shifts the burden of knowing
  each provider's exact endpoint + model string onto the new user; the catalog removes that.
- **Store every key as a `$VAR` reference by default** — rejected: requires the user to also
  set an env var / `.env` before anything works, adding a step that defeats the onboarding
  goal. Offered as an explicit opt-out instead.

## Consequences

- A brand-new install drops straight into a working setup; a plain `claude-wrap` after setup
  uses the chosen default preset.
- `--add` now shares one interactive code path with first-run, so the catalog and post-setup
  options stay consistent.
- Secrets are entered through a masked prompt and (in default mode) written to the local
  `~/.config/claude-wrap/presets.yaml` (or a gitignored local `.claude-wrap.yaml`) — never
  printed. This is consistent with the existing security model: credentials live in local
  config / env, never in argv.
- The catalog is a curated, versioned list; adding a provider is a one-entry change to
  `PROVIDER_CATALOG`. It is not a discovery mechanism — unknown gateways use the `custom`
  entry.
