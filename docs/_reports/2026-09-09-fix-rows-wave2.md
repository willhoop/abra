# 2026-09-09 — record-keeping pass for MINOR 5.277.0, wave 2 (MEASURE)

Dated findings record, never maintained, superseded by the register rows it feeds. Nothing here played
a game. No commit was made; the coordinator commits.

## What landed (files: `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md`, `docs/ENGINE.md`, `docs/MEASURE.md`, `docs/OPS.md`)

Every figure below was re-read from its artifact or command before it was written, not copied from the
three source reports:

| figure | read from |
|---|---|
| census 835 probed / 835 live / 835 armed / 0 missing / 0 threw / 0 hollow, `run_ok` true, `results.length` 835; the five new rows present and `live: true` | `data/mechanics-census.json` (generated 2026-09-09T22:52:07Z) |
| roster abilities scope: out_of_scope 115, in_scope 201, tested 139, could_not_stage_in_scope 43, unattributable 14, deferred 5, differ 0, silent 0 | `data/roster.abilities.json:scope` |
| roster moves scope: out_of_scope 2, in_scope 498, tested 487, could_not_stage_in_scope 8, deferred 3 | `data/roster.moves.json:scope` |
| roster items scope: in_scope 148, tested 142, could_not_stage_in_scope 6 | `data/roster.items.json:scope` |
| raw shard 58,753,177 B, commit `71771f0b` (2026-09-09 18:32:59 -0400) | `ls -l data/raw/games.ladder/20260909T2052-00.jsonl.gz`; `git log -1 -- <path>` |
| `gh run list --workflow next-regulation.yml` → `[]` (no run); last `ingest` run 34404028238 success 2026-09-09T20:56:23Z | `gh run list`, 23:11Z |

- **RUNNING-NOTES**: three `## [5.277.0] — 2026-09-09` rows (screens + Compound Eyes; roster scope by
  carrier; raw shard cap + `gate_fail_and_silent` pin). The screens row carries
  `**Supersedes.** ~~census 830/830~~ → 835/835 (...)` as briefed. The roster row supersedes
  139 of 202 → 139 of 201, 487 of 500 → 487 of 498, could-not-stage 44 → 43 and 10 → 8.
- **CHANGELOG**: `## [5.277.0] — 2026-09-09` above 5.276.0 — Added / Changed / Fixed / Notes; Notes says
  the narration batch Y row and its re-measurement join this entry in the same release.
- **ROADMAP**: #555 closed (one ability and two moves left the denominators; 43 / 8 / 6 could-not-stage
  plus 14 CONTROL-NOT-QUIET and 5 DEFERRED remain in scope with legal carriers — fixture gaps in the lab
  tail, not removed entities; the 115 with no carrier were already out, 114 of them). New: #556 raw shard
  cap (closed, MEASURE/OPS); #557 41 param-half tags + `refusesCopy` (open, ENGINE, lab tail); #558 two
  U+FFFD `|win|` rows (open, OPS re-fetch card); #559 Trick `-fail` never announced — #241's class
  re-populated by one (open, ENGINE narration; the pin re-seed half is closed); #560 Infiltrator screens
  hole (closed, ENGINE — no row had existed).
- **Ledgers**: one dated hand entry each in ENGINE (screens + Compound Eyes, sweep, pointer to the roster
  entry the roster agent already wrote — not duplicated), MEASURE (raw cap, pin re-seed, store
  reconciliation, 7,599 rows without a raw log), OPS (raw cap, the two U+FFFD rows, the hourly collector's
  CI state: no run yet).

## Gates

| test | result | note |
|---|---|---|
| `tests/test-roadmap-register.js` | **3 passed, 0 failed** | register 521 → 526 items |
| `engine/open_work.js` | #557 #558 #559 open; #555 #556 #560 not in the open list | the run rewrote `data/open-work.json`; restored to HEAD's bytes (`git checkout -- data/open-work.json`), it was clean before this pass |
| `tests/test-docs-current.js` | **34 passed, 1 failed** — SAME red as before this pass | see below |
| `tests/test-docs-quarantine.js` | **1 CHECK FAILED** — pre-existing at HEAD | see below |

### The docs-current red cannot be cleared by a row, and was not

Clause 3b(b), ratchet key `docs/RUNNING-NOTES.md|830|data/mechanics-census.json`, first hit now
`docs/RUNNING-NOTES.md:256` (was :234; my three rows shifted it) — the **5.270.0** row's sentence
"Census 830 live / 0 missing / 830 probed (`data/mechanics-census.json`)". Not the 5.276.0 row at :74
(its `830/830` is not lexed as a bare figure).

Why the struck span in the new row does not excuse it: `engine/docs_scan.js citationMismatches` never
consults the retraction registry; `QUALIFIED` (which includes `~~`) is scoped to the SENTENCE that
carries it, and the row's own text was not touched. The row is accused because its block dates to
2026-09-09 (CHANGELOG 5.270.0) and the census's `generated` is 2026-09-09T22:52Z — at the rule's DAY
granularity (`artifactDate` truncates to `YYYY-MM-DD`, judgeable when `stamp <= when`) a same-day
artifact is "an instance the block could have read". It clears itself the moment the census is
regenerated with a `generated` date after 2026-09-09 — it is already 2026-09-10 UTC, and batch Y's
end-of-batch `all_mechanics_fire.js` census run does exactly that. The alternative is a key in
`data/docs-currency-baseline.json:known.citation_mismatches` — a `data/` file, outside this brief.
**I did not rewrite the row, and no NEW key beyond this one exists** (the 45 → 46 is that one key).

### The quarantine red pre-exists at HEAD

`docs/MEASURE.md:6387` (was :6378 before this pass's +9 lines), a majority-class percentage in the
dated backtest block, attributed to `data/winrate-backtest.json`. Reproduced RED in a detached worktree
of HEAD `71771f0b` (62 artifacts withheld there, 64 in the live tree) — so it was committed red in the
commit that last touched `tests/test-docs-quarantine.js`. The test's BASELINE is a literal set inside
`tests/` and the key (`doc|figure|cite`) carries no line number, so nothing in this pass moved it.
Owner MEASURE; the fix is either the baseline entry with a reason, or deleting the figure from the
dated block (a caption is not a quarantine). Not done here: `tests/` is outside this brief, and rewriting
a dated ledger block is a decision for the coordinator.

## OWED, NOT RUN

- **Narration batch Y row** — its RUNNING-NOTES row, CHANGELOG bullets and ENGINE ledger entry join
  `## [5.277.0]` when the coordinator lands them ("in the same release" is already stated in Notes).
- `node engine/status.js --write` — every ledger's `<!-- GENERATED -->` block is stamped 2026-09-09 18:00
  and is one pass behind the roster scope, the census and the register.
- `tests/run-all.js` — not run; nothing here plays a game.
- **Commit** — nothing is committed. The pre-commit hook wants the RUNNING-NOTES row (now present) and
  the docs gates green (one red above, self-clearing on the census regeneration).
- `data/docs-currency-baseline.json` / `tests/test-docs-quarantine.js` BASELINE — the two reds above,
  if the coordinator chooses the baseline route.
- **7,599 ladder rows with no raw log** (92,431 parsed vs 84,832 raw) — named in three ledgers and the
  raw-shard-cap report, NOT given a register row (not in the brief's list); `open_work.js` will not see it
  until it has one.
- The first CI pass of `ingest.yml` / `next-regulation.yml` through the 56 MB raw shard on the default heap.
