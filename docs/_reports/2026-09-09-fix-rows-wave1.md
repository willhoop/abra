# 2026-09-09 — MEASURE: record-keeping pass for MINOR 5.276.0 (wave 1)

Historical findings record; not maintained, superseded by the register rows it feeds. Nothing committed,
no game played, `status.js --write` and `run-all` not run.

## Landed

- **`docs/RUNNING-NOTES.md`** — 9 rows under `[5.276.0] — 2026-09-09`, beside the existing Reg M-C detector row:
  board clause 3 of 961 + release tracked; authority pin consumer + ingest `--check`; self-play ids;
  void games attributed (ENGINE); red-test batch 1; NMF rank 4 / clone re-derived; Reg M-C hourly
  collection (OPS); docs gate rule 3d (#552); test waivers. Every figure was re-read from its artifact
  this pass before being written (see below). The docs-gate row was NOT on the page despite the brief
  saying it was — the blind-spot agent had edited two EXISTING rows (the MILTANK profile row and one
  other), not added its own — so it is landed once here.
- **`CHANGELOG.md` `## [5.276.0]`** — Added / Changed / Fixed / Removed / Notes extended; Notes declare the
  MINOR (NMF rank 4, XATU re-derived, board clause counting parted void games) and that the whole-game
  clauses are being re-measured on the moved engine in this release, row to follow.
- **`docs/ROADMAP.md`** — new rows **#553** (Reg M-C changes, ENGINE, sequenced after the Reg M-B gate),
  **#554** (pre-commit hook cannot pass on a fresh clone, MEASURE), **#555** (roster `in_scope` by legal
  carrier, ENGINE, not a 6.0.0 blocker). Updated **#536** closed (3,090 / 3,090), **#551** attributed
  (2 ENGINE fixed, 1 INSTRUMENT owed to MEASURE), **#552** closed (35/0).
- **`docs/ARCHITECTURE-REVIEW-2026-09-09.md`** — `## Corrections, same day` appended (finding 11 withdrawn
  on Will's ruling; fresh-clone finding; MILTANK row de-captioned; ten one-liners for what landed after).
  PDF rebuilt via headless Chrome: **1,471,636 → 1,510,749 bytes**; the `.html` the build left
  (created 17:56:19 by this run, untracked) was deleted.
- **`CLAUDE.md`** — "KNOWN FAILURE": the one-line waiver rule. "WHO MAY WRITE": `abra-bot` row; the
  lead sentence now says four agents, one keyboard publisher.
- **Ledgers, outside GENERATED blocks** — `docs/ENGINE.md` (roster-scope wiring owed, #555; the void-games
  row was already there from ENGINE), `docs/MEASURE.md` (gate honesty, docs gate, waivers, red-test
  batch), `docs/OPS.md` (Reg M-C stores, hourly workflow, gap detector, Will's game present).
- `tests/test-docs-quarantine.js` BASELINE: the stale key `docs/MEASURE.md|51.25%|data/winrate-backtest.json`
  removed (the test itself said DELETE; owed by the blind-spot report).

## Figures verified against their artifacts

| figure | artifact / command | matches report |
|---|---|---|
| 3 of 961 (958 + 3 void, 3 parted) | `data/game-differential.json` `state.games`, `games_board_never_diverged`, `mid_void.void_games`, `void_game_tags[].board_parted_at_turn`; `generated` 2026-09-09T11:48Z | yes |
| 7 waivers, 4 web / 3 MAG | `data/test-waivers.json` | yes |
| 3,090 lines / 3,090 unique ids | `wc -l` + `grep -o '"id"' \| sort -u` over `data/games.selfplay.jsonl` | yes |
| rank 4, `archetype_recon_error` 0.738, excess 0.0775 | `data/nmf-roles.json`, `data/nmf-rank-selection.json` | yes |
| clone 0.293 / 0.6459 / 2.3365 vs 4.7124 / 3.6978, 118,274 clicks, 24,114 logs | `data/policy-eval.json` | yes |
| GURU 0.7124 | `data/guru-matchups.json` | yes |
| roles 52 | `data/pokemon-roles.json:roles` | yes |
| census 830 / 830 / 0 | `data/mechanics-census.json` | yes |
| 92,379 games, 2026-09-09T18:46Z | `data/store-validation.json:judged.games` | yes |
| regmc 1,412 / bo3 727 rows | `gzip -dc \| wc -l` on both stores | yes |
| release tracked, 29 files | `git ls-files data/releases/b730e44f3314` | yes (report said 7.1 MB; `du` reads 6.8M — rounding, not restated) |
| `test-prng` 7/0 | re-run | yes |
| **em_validation bias 0.7643 < floor 0.8655** | `data/partial-label-em.json` | **NOT in the artifact** — the waiver row states "red on the recorded Stage C verdict" without the two numbers |

Not verified (cited to the report only): `identity_audit` 2 → 0, conformance 29 → 24, `selftest` 16 → 4,
`test-quality` 31/1, `quarantine.js --selftest` 239, `test-engine-release` 80, the 176 / 61 games/h rates
and 7.1 h window (run-output figures, not artifact fields).

## Gates after the edits

- `node tests/test-docs-current.js` — **35 passed, 0 failed** (baseline ratcheted; the file was already modified in tree).
- `node tests/test-docs-quarantine.js` — **all checks passed**.
- `node tests/test-roadmap-register.js` — **3 passed, 0 failed** (521 register items, 335 cited).

## Observed, left alone

- The working tree is CRLF and the blobs are LF (`core.autocrlf`). My first inserts were LF and left
  three files mixed; all three were normalised to the tree's CRLF. `CHANGELOG.md` is LF-only in the
  tree and was left that way.
- `data/docs-currency-baseline.json` was rewritten by the green run (ratchet); it was already modified
  by another agent.

## OWED, NOT RUN

- **The re-measure row.** The pinned whole-game re-run on the moved engine (another agent, in flight):
  its `[5.276.0]` notes row, the board / protocol / narration counts, and the "row to follow" pointers
  in this pass's rows and in CHANGELOG Notes resolve to it.
- **`node engine/status.js --write`** — the three ledgers' GENERATED blocks are stamped 17:22 and say so.
- **`tests/run-all.js`** — expected: seven `WAIVED`, `em_validation` FAIL, exit 1 on the group-B/C reds.
- **The commit** — by the coordinator, by name; `.githooks/pre-commit` runs the docs gates and will
  stage the ratcheted baseline.
- MEASURE's own one-line edit at `engine/game_differential.js:1623` (#551, instrument half) — not made
  here because the differential is being run by another agent right now.
