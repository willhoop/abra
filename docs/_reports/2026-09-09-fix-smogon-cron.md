# 2026-09-09 — the Smogon cron stops rewriting a frozen engine source

MEASURE. Findings record, not state; superseded by the register rows it feeds.

## The hazard, proven before the edit

`engine/smogon_priors.js:219` stamps `generated: new Date().toISOString().slice(0,10)` on every run,
and `data/smogon-priors.json` is entry :150 of `SOURCES` in `engine/engine_release.js`.
`.github/workflows/smogon-stats.yml` runs the script on the 4th and 11th of every month and `git add`s
the result. abra-bot committed that file on 2026-08-04, 08-11 and 09-04 (`git log -- data/smogon-priors.json`).

Run locally (the script reads `data/smogon-stats/` only — no network, seconds):

```
node engine/smogon_priors.js          -> wrote data/smogon-priors.json — 283 species from 2026-08 ...
node engine/smogon_priors.js --bo3    -> wrote data/smogon-priors-bo3.json — 217 species from 2026-08 ...
git diff --stat -- data/smogon-priors.json data/smogon-priors-bo3.json data/mew.js
   data/smogon-priors-bo3.json | 2 +-
   data/smogon-priors.json     | 2 +-
```

Newest archived month before and after: **2026-08**. `generated` **2026-09-04 → 2026-09-09**. With
`generated` masked the two JSONs are **byte-identical** (`identical apart from generated: true`).
So: **yes, bytes moved with no new month**, and the only bytes that moved were the date. Every one of
those three bot commits was a same-shape rewrite of a frozen source. `data/mew.js` was not touched.
Both files restored with `git checkout --`; `git status -- data/` clean afterwards.

Next firing was 2026-09-11 07:00 UTC, which would have done it a fourth time.

## What was changed

**One file: `.github/workflows/smogon-stats.yml`.** Nothing under `engine/`.

- The rebuild step now runs
  `node engine/smogon_priors.js && cp -f data/smogon-priors.json data/smogon-priors.observed.json`
  followed by an unconditional `git checkout -- data/smogon-priors.json`. The frozen file is written
  by the script (its output path is a fixed literal) and put back in the same step; the observed twin
  keeps the bytes. The `&&` list means a failed derivation cannot skip the restore under `bash -e`,
  so a dirty frozen file can never reach the `git rebase origin/main` that follows (which refuses a
  dirty tree — the collector would have died there, silently, the way ingest did for 24 days).
- The `git add` line stages `data/smogon-priors.observed.json` instead of `data/smogon-priors.json`.
- The comment block above the step states the defect, the proof and where the promotion lives.

**Promotion is the existing command.** `node engine/smogon_priors.js` run by a person IS the explicit
act that writes the frozen file — it already existed and already says what month it wrote. No new
`--promote` flag was added.

**`engine/policy.js --promote` was read and NOT reused.** Its `profile()`/`delta()` read the
move-priors shape (`p`, `acts`, `lead`, `prot` per species); the Smogon file carries
`moves: [{move, pct}]`, `spreads`, `items`, `abilities`, `teammates`, `checks`. It would parse, count
0 cells, and refuse. Generalising it is a larger job than this fix.

**Why the workflow and not the script.** `engine/smogon_priors.js` is itself in `SOURCES` (entry :138;
`.gitattributes` names it among the nine deliberately unpinned). An `--observed` flag would have been
the cleaner shape, and it would have moved the tree digest and stranded release `b730e44f3314` — the
release every current gate artifact stamps (`all-mechanics-fire`, `engine-diff`, `engine-release`,
`game-differential`, `roster.*`). Moving the digest to stop the digest moving is the wrong trade.
Confirmed after the edit:

```
node engine/engine_release.js drift b730e44f3314
  NO-DRIFT — Every file release b730e44f3314 froze is byte-identical in the live tree right now.
```

**`data/smogon-priors-bo3.json` is NOT a frozen source** (`engine_release.js:1377` names it explicitly
as a writer literal excluded from the derived dependency set) — so it stays on the direct path, as the
brief conditioned. The cron will keep committing a date-only churn on it each month; harmless to the
release id, and mirroring it would add a second observed file for a file nothing freezes.

**Seeded `data/smogon-priors.observed.json`** (untracked, new) from the same run, so the path exists on
the first cron run even if the derivation step fails — a `git add` on a missing path exits 128 under
`bash -e` and kills the commit step, which is the exact `tests/test-workflow-paths.js` defect. **It
must be `git add`ed with this commit.** It is the frozen file with `generated: 2026-09-09`; 1.3 MB,
same as the file it twins, and it replaces (not adds to) the monthly churn the frozen file carried.

## Verification

- `node --check`: no `.js` edited — nothing to check.
- YAML parses (`js-yaml`), six steps, names intact.
- `node tests/test-workflow-paths.js`: staging half **4 of 4 ok**, including
  `smogon-stats.yml stages data/smogon-priors.observed.json`. The test is still RED on its SECOND
  clause — *"a store has rows in no shard … Run: node build/compress-stores.js"* — which is the
  shard-currency check on the local ladder store and has nothing to do with workflow paths or this
  change. It was red before the edit for the same reason. Not fixed here: it would rewrite
  `data/parsed/` shards, outside this brief. Reporting it, not filing it.
- `git diff --stat`: `.github/workflows/smogon-stats.yml | 19 +++---` and nothing else tracked.
  Untracked new: `data/smogon-priors.observed.json`.
- Not run, by instruction: `status.js`, `run-all`, anything that plays a game.

## Proposed rows (another agent owns the files this pass)

### `docs/RUNNING-NOTES.md`

```
## [Unreleased] — 2026-09-09 — the Smogon cron rewrote a frozen engine source three times with nothing but a date

- **What changed.** `.github/workflows/smogon-stats.yml` no longer stages `data/smogon-priors.json`
  — entry :150 of `SOURCES` in `engine/engine_release.js`, read by `board.js` at run time. The cron
  now copies the rebuilt priors to `data/smogon-priors.observed.json`, restores the frozen file
  unconditionally, and stages the twin; the engine's copy moves only when a person runs
  `node engine/smogon_priors.js` by hand and commits it. Same defect and same fix as
  `data/move-priors.json` in `ingest.yml` (2026-08-22). Done in the workflow rather than the script
  because `engine/smogon_priors.js` is itself frozen (entry :138) and a flag would have moved the
  digest; `node engine/engine_release.js drift b730e44f3314` reads NO-DRIFT after the edit.
- **Measured.** `node engine/smogon_priors.js` on the newest archived month (2026-08) rewrote
  `data/smogon-priors.json` and `-bo3.json` **2 lines each, both the `generated` date**, JSON
  byte-identical with the date masked. abra-bot committed that file 2026-08-04, 08-11 and 09-04 —
  three engine digests minted for zero information. `tests/test-workflow-paths.js` staging clause
  **4 of 4 ok** on the new path; its shard-currency clause is red for an unrelated reason and is not
  touched here. `data/smogon-priors-bo3.json` is not a frozen source (`engine_release.js:1377`) and
  stays on the direct path.
- **Basis.** unchanged.
- **Supersedes.** Nothing.
- **Owed to the next major.** `docs/METHODOLOGY.md` (line ~192) and `docs/BACKLOG.md` (line ~136)
  say the workflow parses the priors monthly; both should say it parses into the observed twin and
  that promotion is a hand step.
```

### `CHANGELOG.md` — `### Fixed`

```
- **THE SMOGON CRON REWROTE A FROZEN ENGINE SOURCE EVERY MONTH.** `engine/smogon_priors.js` stamps
  `generated: <today>` unconditionally, `data/smogon-priors.json` is in `SOURCES`, and
  `smogon-stats.yml` staged it on the 4th and 11th — proven 2026-09-09: same month in, same month
  out, two lines changed, both the date; three bot commits (08-04, 08-11, 09-04) each minted a new
  engine digest and stranded every release before it. The workflow now writes
  `data/smogon-priors.observed.json` and restores the frozen file; the engine's copy moves only by a
  hand run of `node engine/smogon_priors.js`. Mirrors the `move-priors.observed.json` fix in
  `ingest.yml`. Workflow-only, so release `b730e44f3314` reads NO-DRIFT.
```

## OWED, NOT RUN

```
git add .github/workflows/smogon-stats.yml data/smogon-priors.observed.json     # the twin is NEW and untracked; without it the first cron run's git add exits 128
node build/compress-stores.js                                                    # clears the unrelated red clause in tests/test-workflow-paths.js (shard currency) — OPS' call, not this fix
node engine/status.js --write                                                    # after the commit, per the finishing rule; not run here by instruction
```

No release re-cut is owed: the tree digest did not move (`drift b730e44f3314` = NO-DRIFT).
No engine source was edited. A future `--observed` flag on `engine/smogon_priors.js` is the cleaner
shape and should ride the next edit that already moves that file, not a cut of its own.
