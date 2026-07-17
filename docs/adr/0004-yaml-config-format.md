---
Status: accepted
---

# Preset config uses YAML

claude-wrap stores presets in `presets.yaml` (and a per-project `.claude-wrap.yaml`), parsed and emitted with the `yaml` npm package. We chose YAML because the shipped init template (`getInitTemplate`) relies heavily on inline comments to document example presets users uncomment, which JSON cannot express; YAML is also less punctuation-noisy than JSON for a file users hand-edit directly via `--config-edit`/`--edit` in `$EDITOR`. This is a comparatively soft, reversible decision, recorded only because a reader may wonder why not JSON.

## Considered Options

- YAML — chosen (comments + ergonomic nested mappings for presets)
- JSON — rejected (no comments, noisier to hand-edit)
- TOML — rejected (fine, but YAML's nested-mapping ergonomics fit presets better and the ecosystem is familiar)

The `yaml` package is one of only two runtime dependencies; keeping that footprint small is part of the same minimalism recorded in ADR 0010.
