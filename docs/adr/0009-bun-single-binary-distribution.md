---
Status: accepted
---

# Bun Single-Binary Distribution

claude-wrap is built with Bun into a single self-contained compiled binary (`bun build --compile`) and distributed per-platform via GitHub Releases, with a built-in `--update` command that downloads and swaps the binary in place. This gives users a CLI with no Node/Bun runtime prerequisite and no node_modules — a curl|bash install (see install.sh) drops one file on PATH — while self-update keeps them current without a package manager. Bun is already the project's dev/test runtime, so `--compile` is the natural fit.

## Consequences

- Per-platform release assets must be built for each supported os-arch (darwin/linux, arm64/x64), named `claude-wrap-<os>-<arch>` (see `getPlatform` and `runUpdate` in `src/update.ts`: `getPlatform` returns only the `${os}-${arch}` suffix, while the `claude-wrap-` prefix is added in `runUpdate` at line 54).
- `--update` runs a pre-swap SAFETY GATE: before renaming, it executes the freshly downloaded temp binary with `--version` (lines 104-106) and aborts (deletes the temp file, exits 1) if it does not run cleanly, so a corrupt/non-executable download never reaches the running binary.
- `--update` replaces the running binary in place via `renameSync` over `process.execPath`. When the binary lives in a root-owned PATH location it hits permission-denied; on that path `--update` leaves the verified temp binary in place, prints `Run: sudo mv "<tmpPath>" "<currentPath>"`, and exits non-zero (lines 119-125). The temp file is intentionally **not** removed in this branch, so the printed command works and the user can finish the swap manually.
- This is a technology choice with modest lock-in (Bun's `--compile`), hence recorded as an ADR.

## Rejected Alternatives

- **npm-published package requiring Node + global install** — imposes a Node runtime prerequisite and pulls a `node_modules` tree; heavier install than a single binary.
- **Deno / pkg / nexe** — Bun is already the dev/test runtime, so introducing another toolchain adds cost without benefit.
- **Distributing raw TS/JS** — needs a runtime present on the user's machine, defeating the zero-prerequisite goal.
