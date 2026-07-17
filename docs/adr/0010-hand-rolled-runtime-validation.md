---
Status: accepted
---

# Hand-rolled runtime config validation

claude-wrap validates its YAML config in a hand-written `validateConfig` function that manually type-checks each preset field and accumulates human-readable, path-prefixed error messages (e.g. `presets.foo: missing required field 'base_url'`). No schema-validation library (Zod, ajv, valibot, etc.) is used — the only runtime dependencies are `@clack/prompts` and `yaml`. We deliberately keep runtime dependencies minimal because the tool ships as a compiled binary and the config schema is small and stable, so a validation library would add weight for little gain while the bespoke messages stay tuned for direct end-user readability at the CLI.

## Consequences

- Adding many more config fields would raise the maintenance cost of manual validation and could tip the trade-off toward adopting a schema-validation library.
- This is the opposite of the common "just use Zod" default; do not "fix" it by introducing a validation dependency without revisiting this decision. The `yaml` package (chosen in ADR 0004) is one of the two runtime deps this minimalism is protecting.
