---
Status: accepted
---

# CLI argument forwarding boundary

claude-wrap owns a fixed set of wrapper flags (`--preset`, `--config`, `--init`, `--doctor`, `--update`, `--add`, `--list`, `--session`, `--dry-run`, `--no-bare`, etc.); every argument it does not recognize is forwarded verbatim to the `claude` binary. `parseFlags` (`src/index.ts`) consumes known flags and pushes anything else onto `result.args`; a literal `--` sends all remaining arguments straight through untouched (`args.slice(i + 1)`). At launch the forwarded args are appended after any baked-in `claude_bin` arguments: `finalArgs = claudeCmd.slice(1).concat(args)` (`src/launcher.ts`). We chose an allowlist-of-wrapper-flags-plus-passthrough (rather than requiring `--` for everything) so common `claude` flags "just work" through the wrapper while claude-wrap's own flags stay unambiguous.

## Consequences

- A name collision between a future wrapper flag and a `claude` flag would shadow the `claude` flag; `--` is the escape hatch to force passthrough.
- Auto-injected flags (notably `--bare`, see ADR 0006) are prepended to `finalArgs`, and injection is skipped if `--bare` already appears anywhere in the resolved args (from `claude_bin` config or forwarded by the user).
- `--session [id]` is a wrapper flag that consumes an optional following value only when it does not look like another flag (`!args[i].startsWith("-")`), otherwise it defaults to `latest`.
