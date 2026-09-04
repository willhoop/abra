# The settled republish — one release, five pinned artifacts, and the gate goes 6-of-8 failing to 1-of-8

MEASURE, 2026-09-04. Nothing was committed. Nothing was fixed. This is a photograph.

## The release

`0dec37ff5ad9` — cut 2026-09-04T21:09:39Z, 26 files frozen, showdown commit
`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`. Every one of the five regenerations below was handed
this same id, and the one that stamps from the live tree (`tests/test-engine-diff.js` via
`liveStamp()`) resolves to it because the worktree is byte-identical to the snapshot — verified,
not assumed.

## The published board-material, before and after

| | before | after |
|---|---|---|
| artifact | `data/game-differential.json` | `data/game-differential.json` |
| generated | 2026-09-04T02:01:07Z | 2026-09-04T21:15:27Z |
| release | `8ad06030e129` | `0dec37ff5ad9` |
| pin digest | `ccb365985023` | `bcb38e47d94f` |
| **BOARD-MATERIAL** (`state.games` minus `state.games_board_never_diverged`) | **77 of 961** | **46 of 961** |
| **PROTOCOL first-divergence** (`diverged`) | **168 of 961** | **141 of 961** raw, **140** after 1 declared |
| void / threw | 8 / 1 | 7 / 1 |

**Games actually PLAYED: 961.** `--games 1200` is a PAIR budget. Elapsed 111.3 s.

`engine/publish_guard.js` did **not** divert this run. `engine/game_differential.js` does not route
through the guard at all; `--write` with no `--out` lands directly on `data/game-differential.json`,
and the file's mtime, `generated`, `engine_release` and 26 `source_digests` all moved. The run log is
852 lines, not a banner.

The 46 that had been sitting unpublished in `data/verification/fix-batch-M6instr-defog.json` since
20:08Z is now the published figure. The gate no longer prints a number five fixes out of date.

## The scoreboard was called in writing before the run, and it went 4 for 4

`data/verification/2026-09-04-settled-republish-prediction.json`, saved before
`engine/game_differential.js` was started.

Called: board-material **46** (band 44–48), protocol **141** (band 138–145), void **7**, threw **1**.
Read: **46 / 141 / 7 / 1**. Four of four, all exact.

**The brief's premise was right for three files and incomplete for the fourth, and that is the part
worth keeping.** The comparison was not made from git — release `252025cfcddc`, which produced the
46, was cut from a working tree that matches **no commit**, so a `git diff` between the two releases
is not the diff that happened. It was made by byte-diffing the two frozen snapshots under
`data/releases/<id>/` with line endings normalised. **Four of 26 files moved:**

- `engine/medicham2-browser.js` — **four counter declarations and nothing else.**
  `retaliateWhenLowered` / `retaliateSourceUnknown` and `volatileCuredByNonBerry` added,
  `roostRiderNoPrimary` moved between two object literals. Zero executable lines outside those.
- `engine/rollout_leaf.js` — **comment-only.** No executable line differs.
- `engine/position_features.js` — one counter declaration (`movesFirstCalls`) and one increment.
- `data/smogon-priors.json` — **not a counter.** The Smogon month advanced **2026-07 to 2026-08** and
  `species_count` fell **284 to 283**.

So the prediction was made with its own falsifier named: a counter declaration cannot alter a board,
but a priors month can, because `engine/game_differential.js` requires `engine/champions_sim.js`,
which reaches `engine/set_priors.js` then `engine/smogon_priors.js` to fill unrevealed set slots. The
prediction said in advance that if the number moved, it was the priors and not the counters.

**It did not move, and the inertness is measured rather than argued.** Against the 46 artifact:
`classes` byte-identical, `first_divergences` byte-identical. Every field that differs is a stamp or
a live corpus count — `severity_usage_source.species_with_a_usage_figure` 266 to 267 and the
`corpus_teams` figures underneath it, all read from `data/meta-usage.json`, which the artifact itself
labels `read: LIVE — not in the frozen release`. Not one game-level number moved. The open-team-sheet
pool leaves the prior-fill path unexercised.

## The gate, clause by clause

`node engine/quarantine.js` — **GATE: CLOSED, 1 of 8 gating clauses fail.** It was **6 of 8** before
this pass, and **five of those six were state (a): measured against a different engine.** All five
are cleared.

| # | clause | verdict | quantity, with its scope |
|---|---|---|---|
| 1 | game differential | **PASS** | 0 of 6000 at every one of 17 damage indices, seed 20260804. SCOPE: `skipped_multihit` 134, `skipped_ability_multihit` 17, `pool.dropped` 9 |
| 2 | deliberate roster / items | **PASS** | 0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE. 140 tested of 148 in scope; 8 could-not-stage |
| 3 | deliberate roster / abilities | **PASS** | 0 / 0. 129 tested of 202 in scope; 114 out of scope, 45 unattributable, 27 could-not-stage, 1 deferred |
| 4 | deliberate roster / moves | **PASS** | 0 / 0. 475 tested of 500 in scope; 22 could-not-stage, 3 deferred |
| 5 | coverage | **PASS** | all 412 moves above 25 clicks measured by the roster or the census |
| 6 | whole-game / **BOARD-MATERIAL** | **FAIL** | **46 of 961 = 4.8%** (961 less 915 whose board never diverged) |
| 7 | whole-game / NARRATION | RPRT — **RED**, does not gate | 140 of 961 = 14.6% (141 raw less 1 declared, 0 cleared on decision impact) |
| 8 | mechanics staged against showdown | **PASS** | 5 diverge, 1 declared, 4 below the reach shelf, **0 left**. moves 4, abilities 1, items 0. 1313 games, 0 threw |
| 9 | no open, known engine defect | **PASS** | 112 verdicts read; no open row names a RED instrument |

**The one FAIL is state (b): a named instrument genuinely RED.** `data/game-differential.json` was
measured against release `0dec37ff5ad9`, which is the tree, and it reports a real board divergence in
46 games. It is not staleness and it is not an unmeasured claim.

**No clause is currently in state (a).** That was the whole point of this pass.

**State (c) exists and does not hold anything shut, which is why it must be named separately.**
Inside clause 9, which PASSES: 7 open rows name an instrument that was asked and answered nothing
usable (#218, #318, #319, #376, #438, #439, #440); **40 open rows assert breakage with no instrument
that decides them** — DEBT, not evidence; 3 open rows name a GREEN instrument (#389, #403, #412).
Collapsing those 40 into the gate's verdict would describe a broken simulator when what exists is an
unmeasured one.

## What the 46 is made of, and the unit hazard inside it

The run log prints **"BOARD-MATERIAL 40 causes, 41 games"**. The gating quantity is **46**. They are
different counts and neither is wrong: the cause table is a *sample* of the 46, and **5 of the 46
part a board while the protocol never diverges at all** — no cause, no class, no shape, nothing to
grep. Four first-board-divergence rows carry `protocol_diverged_at_turn: null`
(`p1.active[0].vol.charging`, two `stall`, and `p2.party.castform.species` / `.types`).

Per-boundary the same run reads **10472 of 10613 turn boundaries identical**. That denominator always
reads greener and is not the one this clause uses.

## Scope disclosures that belong beside these numbers

- **The census pin is 643 rows dated 2026-08-23; the live census is 829 rows dated 2026-09-04.** The
  artifact records `matches_live: false` and it is not a defect: under `--steering empirical` the
  census is `CREDITED ONLY — it measures coverage and does not select`. It steers nothing here.
  `engine/all_mechanics_fire.js` reads the **live** census, so the two instruments are not on one pin.
- **`data/meta-usage.json` is read live by the differential's severity ladder** and moved under this
  comparison (266 to 267 species). It touches labels, not board comparison.
- **The narration clause withholds direction of travel**: its stamped baseline is
  `pins:2efbc9ed1946` and this run is `pins:bcb38e47d94f`. Two pins are two instruments. A restamp
  (`node engine/quarantine.js --stamp-whole-game`) is available and was **not** run — that is an
  owner's call, not a reporting convenience.
- **Release `252025cfcddc` was cut from a working tree reachable from no commit.** Its
  `data/smogon-priors.json` is the July file, which appears in none of tonight's commits. The
  snapshot directory holds the bytes, so the 46 was reproducible; but a release whose inputs are not
  in git is a release nobody can re-derive if `data/releases/` is ever pruned.

## The refit is a REFIT, not a restamp

`engine/status.js` prints `FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` with two
gates fired — fixture identity (scenarios 10 to 12) and **the damage table (318 species to 322,
digest `405c836793d1` to `9d289cf77e24`)**. The feature FUNCTION's input moved, so a restamp would
write over the evidence for the refit rather than answer it. `data/policy-weights.json` was **not
touched** and no fit was started. REFIT stays OWED and it is the owner's call.

Provenance moved on this pass: **188 unsafe, 2 void (declared), 30 possibly stale, 33 ok, 0 missing**
(from 189 / 2 / 34 / 28 / 0).

## What ran, and what it wrote

| step | command | evidence it did something |
|---|---|---|
| 1 | `engine_release.js cut` | id `0dec37ff5ad9`, 26 files frozen |
| 2 | `game_differential.js ... --steering empirical --write` | 852-line log, artifact `generated` 21:15:27Z, 26 `source_digests` |
| 3a | `tests/test-engine-diff.js --n 6000 --seed 20260804` | `wrote data/engine-diff.json`, compared 6000, ratchet held at 6000 |
| 3b | `tests/roster.js --stage items --write --release 0dec37ff5ad9` | 148 rows, prev kept at `roster.items.prev.json` |
| 3c | `... --stage abilities ...` | 316 rows |
| 3d | `... --stage moves ...` | 500 rows |
| 3e | `all_mechanics_fire.js --kind all --release 0dec37ff5ad9 --write` | `red_ok true`, 21 red plants all caught, **three populations** (moves 500 / abilities 316 / items 148), 1313 games |
| 4 | `status.js --write` | stamped `docs/ENGINE.md`, `docs/MEASURE.md`, `docs/SEARCH.md`, `docs/OPS.md` |

Every heavy run went through `tools\lownode.cmd`. Exit codes were **not** read as evidence: each
stage was checked on output size, on the artifact's `generated` stamp moving, and on the pin
(`engine_release`, 26 `source_digests`, `showdown_commit`) actually being present.

## OWED

- **The gate is still CLOSED on one clause: board-material 46 of 961.** That is ENGINE's, and it is
  the only thing between here and lifting quarantine. Narration is RED at 140 of 961 and is its own
  gate by Will's 2026-08-22 call.
- **Leaf calibration — this division's one number — stays WITHHELD.** `data/winrate-backtest.json` is
  downstream of MEDICHAM and the gate has not opened. It was not run. The standing item in the
  MEASURE brief (point `backtest_winrate.js` at the current leaf and publish a reliability curve)
  cannot be honestly discharged until clause 6 is zero; publishing a calibration curve measured
  through an engine that parts boards in 4.8% of games would be a number wearing a receipt.
- **The MAG refit stays OWED and is a REFIT.** The damage table moved (318 to 322 species). Do not
  restamp. `data/policy-weights.json` untouched — the owner's call.
- **`docs/WEB.md` carries no `<!-- GENERATED -->` block**, so `status.js --write` stamps four of the
  five ledgers. Reported, not changed. WEB is paused.
- **The narration baseline restamp** (`node engine/quarantine.js --stamp-whole-game`) is available
  and unrun, so direction of travel on protocol divergence stays withheld.
- **40 open register rows assert breakage with no instrument that decides them**, 7 name an
  instrument that answers nothing usable, and 3 name a green one. That is the register's coverage
  gap, unchanged by this pass and not measured here.
- **`data/register-reality.json` was not regenerated.** `engine/register_reality.js` in measuring
  mode `execFileSync`s every marker; four newly-admitted ones are heavy and two rewrite gate inputs.
  Blocked on an owner's decision, exactly as the previous pass filed it.
- **Nothing was committed.** Will publishes. The tree now carries 13 modified data files, 4 stamped
  ledgers, and one new untracked file:
  `data/verification/2026-09-04-settled-republish-prediction.json` (the pre-run prediction).
