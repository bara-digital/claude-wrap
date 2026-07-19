# claude-wrap — Deep Scan (findings, inconsistencies, risks)

A second, deeper pass over the repository: beyond the control/data-flow in
[ARCHITECTURE.md](ARCHITECTURE.md), this scans for **behavioral bugs, security
edges, tooling inconsistencies, and test-coverage gaps**. Each finding cites the
file and (where useful) line, with a severity and a concrete fix.

Severity scale: **H** = user-visible defect or security weakness · **M** = real
issue, limited blast radius · **L** = smell / latent / portability.

---

## 1. Behavioral / correctness bugs

### 1.1 `add.ts` rewrites the whole config and **strips comments** — M
`src/add.ts:162-169` builds the new file with `stringify(parsed)`, which
re-serializes the *entire* YAML. Every comment in the user's `presets.yaml` is
lost on the first `--add`. This contradicts the other mutators, which edit
surgically and **preserve** comments:
- `setDefault` (`config.ts:364`) — regex edit on the `default:` line only.
- `removePreset` (`config.ts:398`) — `delete` + `stringify`, but on a *copy*
  with `presets` mutated in place (still loses comments on remove, see 1.2).

`--add` is the worst case because it's the most common write and it nukes
comments project-wide.

**Fix:** mirror `removePreset`'s approach but do a *textual* append of the new
preset block (like `setDefault` does), instead of `stringify`-ing the whole doc.

### 1.2 `removePreset` also loses comments on remove — L
`src/config.ts:409-417` parses, deletes the key, and `stringify`s. Any comment
on a *retained* preset disappears. Lower impact than 1.1 (remove is rarer), but
same root cause. **Fix:** text-based deletion of the preset block.

### 1.3 `stats.recordLaunch` is dead code — M
`src/stats.ts:31` is exported and imported in `index.ts:14`, but **never called**
from `main()`. Consequence: `claude-wrap --stats` (`src/stats.ts:37`) always
reports "No launches recorded yet." The stats feature is effectively inert.

**Fix:** call `recordLaunch(presetName)` in the launch path (local + web) right
before `execClaude`/`runWeb`. Add a test that asserts the count increments.

### 1.4 `doctor.ts` duplicates the `.env` walk-up and mis-sends Bearer tokens — L/M
- `src/doctor.ts:49-64` reimplements `walkUp`/`loadDotEnv` inline instead of
  importing `loadDotEnv` from `env.ts`. Drift risk: if the env-resolution logic
  changes, doctor silently diverges.
- `src/doctor.ts:105` sends the resolved token as an `x-api-key` header for the
  `GET /models` reachability probe. For `auth_token` (Bearer) presets that is
  **wrong** — a healthy Bearer-only gateway can report a false ✗. The probe
  should branch on whether `ANTHROPIC_AUTH_TOKEN` vs `ANTHROPIC_API_KEY` is set.

**Fix:** import `loadDotEnv`/`resolveVar` from `env.ts`; send `Authorization:
Bearer` when the preset uses `auth_token`.

### 1.5 `validateConfig` builds preset objects it then discards — L
`src/config.ts:125` constructs `presets[name]` even when *other* presets have
errors; the function unconditionally throws at `src/config.ts:140` with the full
error list. The per-preset construction is dead work. Harmless, but worth
simplifying (build only on the success path).

---

## 2. Security edges (mostly positive)

The security model holds up under deeper inspection:

- **Secrets never hit argv.** `execClaude` (`launcher.ts:64`) and `runWeb`
  (`web.ts:211`) both pass creds via `env`, never args. Verified live in the
  `--web` smoke test (the `ps`/`tmux` tail shows `claude --bare`, no keys).
- **`BLOCKED_ENV_VARS` denylist** (`env.ts:109`) correctly blocks `PATH`,
  `LD_*`, `DYLD_*`, `HOME`, `XDG_*` etc. from `extra_env`. Good.
- **`claude_bin` allowlist + path guards** (`config.ts:256-300`) prevent a cloned
  repo from pointing at a local executable. Solid.
- **Web isolation** — dedicated tmux socket (`-L claude-wrap-<preset>`) inherits
  ttyd's env and is torn down on exit (`web.ts:217-236`). Good.

### 2.1 Walk-up local config is an accepted, documented trust boundary — info
`.claude-wrap.yaml` found via walk-up (`config.ts:39-61`) can set `base_url` to
any endpoint and pull `api_key: $VAR`. This is the inherent risk of ADR 0003/0007
and is acceptable by design — but a malicious repo dropped in a directory above
CWD would be picked up. No code change; just noted for the threat model.

### 2.2 Local `.claude/settings.local.json` is overly broad — info (not repo code)
`/Users/dedisuhanda/.claude/settings.local.json` contains `"Bash(:)"`, which
grants **all** Bash commands without a prompt, plus `tmux -L claude-wrap-openai`
entries left over from the `--web` test session. This is the user's *local*
settings, not part of the repo. Flagging because `Bash(:)` is a wide grant;
consider narrowing it. The `tmux` entries are stale test artifacts and can be
removed.

---

## 3. Build / tooling inconsistencies

### 3.1 `tsconfig` references `bun-types` but deps declare `@types/bun` — L
`tsconfig.json:17` sets `"types": ["bun-types"]`, while `package.json:34` lists
`"@types/bun": "latest"`. `bun-types` is the legacy package name. Typecheck
currently passes (Bun resolves it), but this is a latent break if `@types/bun`
stops re-exporting it.

**Fix:** set `"types": ["bun-types"]` → `"types": ["@types/bun"]`, or drop the
`types` field (Bun picks up `@types/bun` automatically).

### 3.2 `scripts/release.sh` uses macOS-only `sed -i ''` — L
`scripts/release.sh:45-48` use `sed -i ''` (BSD/macOS syntax). On GNU sed
(Linux) this errors (`sed: can't read ''`). The release is actually triggered by
a git tag (not by running this script in CI), so it only bites a Linux
maintainer running the helper locally.

**Fix:** use `sed -i.bak … && rm -f *.bak` (portable) or `perl -i`.

### 3.3 `release.sh` convention diverges from actual release flow — info
`scripts/release.sh` opens a `release/vX` PR titled "Release vX", but the merged
release (v0.7.0) used `chore/bump-<ver>` + a manual tag. Not a bug — the script
is one optional path. Documented in ARCHITECTURE.md §9.

### 3.4 `install.sh` dependency on `curl`/`wget` — info
Falls back cleanly (`install.sh:42-49`). Darwin/Linux only (`install.sh:21-28`);
fine for the target platforms.

---

## 4. Test-coverage gaps

Current suite: **57 tests** across `config.test.ts`, `env.test.ts`, `web.test.ts`.
Notably **untested**:

| Area | Gap |
|------|-----|
| `launcher.execClaude` | spawn path, stdin handling, exit-code forwarding |
| `web.runWeb` / `web.webDryRun` | the spawn + cleanup-on-signal path (only the *pure* helpers `resolveWebSettings`/`buildTtydArgs`/`generateCredential`/`dependencyInstallHint` are tested) |
| `env.ts` `BLOCKED_ENV_VARS` | no test asserts that `extra_env: { PATH: "/x" }` throws |
| `doctor.ts` | reachability probe, Bearer vs x-api-key header choice |
| `stats.ts` | `recordLaunch` increment (would currently fail — see 1.3) |
| `update.ts` | version compare, download/verify (network; hard to unit-test) |
| `picker.ts` / `add.ts` / `completions.ts` / `info.ts` | interactive paths |
| `index.main` dispatch | flag routing / early-exit order (ARCHITECTURE.md §2 documents it, but no test pins it) |

**Highest-value additions:** (a) an `env.test.ts` case for the `BLOCKED_ENV_VARS`
deny, (b) wire + test `recordLaunch`, (c) one integration test that
`runWeb` build path composes `ttyd … tmux -L claude-wrap-<p>` correctly with a
stubbed `ttyd` (already largely covered by `buildTtydArgs`; extend to assert the
`$VAR` auth resolution branch).

---

## 5. Minor positives / non-issues

- **Single source of `--bare` rule** (`launcher.ts:13-29`) reused by exec, dry-run,
  and web — no duplication, no drift risk.
- **Pure/testable helpers** — every non-trivial decision (resolve, build, validate)
  is a pure function; only the spawn/exit edges are impure. Good design.
- **`resolveEnv` precedence** (`.env` < `process.env`) is intentional and tested.
- **Web `$VAR` resolution** happens *after* auto-generated detection
  (`web.ts:166-174`), so a `$WEB_PASS` config value is resolved at launch and the
  "(auto-generated)" label is correctly suppressed.

---

## 6. Prioritized fix list

| # | Severity | Fix | Status |
|---|----------|-----|--------|
| 1.3 | M | Wire `recordLaunch` into launch path + test | Done (index.ts + stats.test.ts) |
| 1.1 | M | `add.ts`: append via `parseDocument`/`setIn` (comments kept) | Done |
| 1.4 | M | `doctor.ts`: dropped dead `.env` walk-up; `probeEndpoint` picks Bearer vs x-api-key | Done (+ doctor.test.ts) |
| env gap | M | Add `BLOCKED_ENV_VARS` deny tests (PATH, LD_PRELOAD) | Done (env.test.ts) |
| 3.1 | L | `tsconfig`: `bun-types` -> `@types/bun` | Done |
| 1.2 | L | `removePreset`: `deleteIn` on document model (comments kept) | Done |
| 3.2 | L | Portable `sed -i.bak` in `release.sh` | Done |
| 2.5 | info | Narrow `Bash(:)` in local settings; drop stale tmux perms | Out of scope (user-local, not repo) |

## 7. Resolution notes (this pass)

All in-repo findings from sections 1-4 are resolved and covered by tests. The
suite went **57 -> 65 passing** (env +2, stats +2 new file, doctor +4 new file).
Verified separately: `add` / `remove` now preserve YAML comments (1.1 / 1.2).

The only open item is **2.5**, which lives in the user's personal
`~/.claude/settings.local.json` (a `Bash(:)` broad grant plus stale
`tmux -L claude-wrap-openai` permission entries from the earlier `--web` test).
That file is machine-local and not part of this repository, so it was left
untouched — narrow it locally if desired.
