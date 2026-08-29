# The five withheld clauses, re-run under the settled engine — 2026-08-28/29, ENGINE

Verdict: **THE GATE IS 8 OF 8 AND OPEN.** All five clauses that read *"MEASURED AGAINST A DIFFERENT
ENGINE"* were re-run on release `4e5c7b3400de`, every artifact's `generated` stamp moved, and **every
one of the ten values the previous agent predicted came true — none missed.** The Metronome row is now
`FIRED-AND-BOARDS-MATCH` **in a written artifact**, not only in a printed one.

Nothing was fixed during this batch. No engine file was touched. No commit, no push.

---

## 1. THE STALE ARTIFACT — WHICH FAILURE WAS IT

**It was run, it printed a green verdict, and it was never written.** Not a prediction, and not a
never-ran.

The evidence is the previous agent's own report, `docs/_reports/2026-08-28-metronome-item.md` §6, which
states it in the last line of the section:

> `SHOWDOWN_PATH=... node tests/roster.js --stage items --only metronome --reds --release 4e5c7b3400de`.
> **Not written — the artifact on disk is still the 15:24 run.**

Two things follow, and they matter differently:

- The run was **`--only metronome`**, a one-entity run. Even with `--write` that is not a stage
  artifact, so `data/roster.items.json` could not have moved from it. The stale stamp is not evidence
  of the `--write` trap here.
- The verdict was therefore **produced and observed**, on one entity, and then **asserted about a
  148-entity stage it had not run.** That is a smaller gap than "never ran" and a real one: the
  DEFERRED-BY-OWNER count, the tested count and the scope block are stage-level facts that a
  single-entity run cannot report.

**The full stage has now been run and it reproduces the one-entity result exactly** (§2). So the green
verdict was correct; it was simply never in a file anything reads.

Confirmed by inspection before the re-run: `data/roster.items.json` stamped `2026-08-28T19:24:11.088Z`,
`engine_release 5f3f7141227c`, `counts.DEFERRED-BY-OWNER 1`, `FIRED-AND-BOARDS-MATCH 139`, and the
metronome row still carrying its full `deferred: {by: "Will", on: "2026-08-10", ...}` block — while the
live `tests/roster.js` had that entry commented out at line 1263. The artifact and the map had already
parted.

## 2. THE PINS, AND THE PROOF THAT THE SAMPLE DID NOT MOVE

| pin | value | how it was established |
|---|---|---|
| engine release | `4e5c7b3400de` | handed down by the coordinator; `node engine/engine_release.js verify 4e5c7b3400de` -> **intact** before the batch |
| census (differential only) | `data/verification/census-pin-9446a684709d.json` | the pin the last published run used, read out of `game-differential.json.steering.input_read_from`. **It had not aged out** — the file is present, 643 rows, generated `2026-08-23T09:53:56.393Z`, and the run re-read it and re-derived digest `9446a684709d` |
| team store | `data/team-pool-frozen` | pool digest `0d103fb9fa87`, 1,968 of 8,778 teams picked — **identical to the previous run** |

`data/engine-release.json` records four cuts of this same tree; the newest, `2026-08-29T00:03:10.637Z`,
carries `why: "phase-0 settled: WIRE 158 metronome ladder; re-run baseline"`. **I cut nothing.**

**The census pin is not the live census and that is deliberate.** The live census is 782 rows
(`a5ba1acb78ba` at run time); the pin is 643 rows. Pinning to the older bytes is what makes this run a
before/after of the previous one rather than a different question — the run printed
`DIFFERENT from the live census` itself.

## 3. THE FIVE RE-RUNS

Every one through `cmd /c tools\lownode.cmd` (BELOWNORMAL) with
`--max-old-space-size=6144`, serialised, one process at a time.

### 3.1 roster / items — 259 lines of output, artifact moved

```
tests\roster.js --stage items --reds --write --release 4e5c7b3400de
```

| | predicted | measured |
|---|---|---|
| tested | 139 -> **140** | **140** of 148 in scope |
| `metronome` | -> `FIRED-AND-BOARDS-MATCH` | **`FIRED-AND-BOARDS-MATCH`**, rule `item/held-and-nothing-more`, no `deferred` block |
| `DEFERRED-BY-OWNER` | 1 -> **0** | **0** |
| FIRED-AND-BOARDS-DIFFER | (implied 0) | **0** |
| DID-NOT-FIRE | (implied 0) | **0** |

`generated 2026-08-29T00:13:33.890Z`, `engine_release 4e5c7b3400de`. The run printed
`REPLACING an existing data/roster.items.json (... release 5f3f7141227c, generated 19:24:11 ...
DEFERRED-BY-OWNER 1, FIRED-AND-BOARDS-MATCH 139)` and kept the old bytes at
`data/roster.items.prev.json` — so the move is receipted from both sides.

18 red demonstrations, **18 CAUGHT, 0 missed** (unchanged).

### 3.2 roster / abilities — 462 lines, artifact moved

| | predicted | measured |
|---|---|---|
| tested | unmoved at **129** | **129** of 202 in scope |
| differ / silent | (implied 0) | **0 / 0** |
| `DEFERRED-BY-OWNER` | — | 1 (`stall`, unchanged) |
| CONTROL-NOT-QUIET | — | 45 (unchanged; the control is itself a live ability) |

`generated 2026-08-29T00:15:02.424Z`. 29 reds, **29 CAUGHT**.

### 3.3 roster / moves — 646 lines, artifact moved

| | predicted | measured |
|---|---|---|
| tested | unmoved at **475** | **475** of 500 in scope |
| differ / silent | (implied 0) | **0 / 0** |
| `DEFERRED-BY-OWNER` | — | 3 (unchanged) |
| COULD-NOT-STAGE | — | 22 (unchanged) |

`generated 2026-08-29T00:18:40.087Z`. 35 reds, **35 CAUGHT**.

### 3.4 whole-game differential — 527 lines, artifact moved

```
engine\game_differential.js --release 4e5c7b3400de --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --arm middle --end-state --games 1200 --write
```

**`--games` IS A PAIR BUDGET.** `--games 1200` produced **961 games played** — the same 961 the last
published run reports. The budget is divided per configuration at
`game_differential.js:5979` (`perConfig = floor(GAMES / live.length)`), so the number asked for and the
number played are different quantities and both are stated here.

`--arm middle` and `--end-state` were passed **explicitly**, matched off the previous artifact
(`pins.arms_run ["middle"]`, `end_state_mode true`). The default `--arm` is *every* arm, not middle;
taking middle by omission would have been the "asking by omission" failure.

| | predicted | measured |
|---|---|---|
| raw divergences | unmoved at **6** | **6** |
| board agreement | **1 of 961** | `game_agreement 1`, `games_board_never_diverged 961/961` |
| games | 961 | **961** |

**The sample is proven identical, not assumed.** Compared field-by-field against `git show
HEAD:data/game-differential.json`:

```
PREV  rel 5f3f7141227c  games 961  diverged 6  cov 563  pool 0d103fb9fa87  census 9446a684709d  agree 1  ndiv 961
NEW   rel 4e5c7b3400de  games 961  diverged 6  cov 563  pool 0d103fb9fa87  census 9446a684709d  agree 1  ndiv 961
mode identical:            A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real
classes identical:         true
first-divergence list:     identical (6 rows, same order)
```

The six causes, unchanged: five `fallenundefined` (Supreme Overlord, the authority's own typo) and one
`|upkeep <> |faint|p2b` (the perish drain). 12,445 turn boundaries compared, **12,445 identical**,
`first_board_divergences []`.

**This was predicted to move nothing and the reason was stated before the run:** Metronome is 19 of
26,232 teams in the pool. It moved nothing. Per the two-scoreboards rule that is the LAB confirming a
rare mechanic and the POOL correctly sitting still — one instrument, not zero.

### 3.5 staged mechanics — 177 lines, artifact moved

```
engine\all_mechanics_fire.js --kind all --write --release 4e5c7b3400de
```

| | predicted | measured |
|---|---|---|
| items `diverged` | unmoved at **0** | **0** |
| items `diverged_including_shelved` | 1 -> **0** | **0** |
| items `shelved_by_owner` | 1 -> **0** | **0** |
| items `shelved_by_owner_diverging` | 1 -> **0** | **0** |
| abilities `diverged` | — | 1 (unchanged) |
| moves `diverged` | — | 4 (unchanged) |

`generated 2026-08-29T00:25:05.190Z`, `release 4e5c7b3400de`, 1,289 games played, 0 threw, `red_ok true`
with 21 red rows. The closet id list dropped `metronome`: **7 -> 6** ids
(`copycat, battlebond, stall, pickup, anticipation, forewarn`), read live out of
`tests/roster.js DEFERRED` as designed.

**Four predicted values, four hits. Zero misses across the whole batch.**

## 4. THE CENSUS CAVEAT DOES NOT BITE HERE, AND THE REASON IS A CORRECTION TO THE BRIEF

The brief carried CLAUDE.md's rule that *"a census that gained rows changes WHICH scenarios play, so a
mechanics count taken either side of that regeneration is not a before/after"*, and asked that it be
said rather than a delta presented. Measured, it applies to **one** of the two instruments:

- **`engine/game_differential.js` IS census-steered** — the census selects the sample. It was therefore
  **pinned to the same 643-row census the previous run used**, and §3.4 proves the two samples are the
  same one: same digest, same pool, same 6 first divergences, same coverage block. **So this is a
  genuine before/after** and the delta may be read.
- **`engine/all_mechanics_fire.js` DOES NOT READ THE CENSUS AT ALL.** `grep -c "mechanics-census"
  engine/all_mechanics_fire.js` returns **0**. It iterates the format's entities — 500 moves, 316
  abilities, 148 items — so the 780 -> 782 census move cannot have changed which scenarios it plays,
  and `games_played` is 1,289 in both runs, unchanged. **Its delta may be read too.**

Said plainly because the caveat is correct in general and would have been the wrong caveat to attach
here: nothing in this batch is uncomparable on census grounds.

## 5. THE GATE

**BEFORE (read at 2026-08-29 ~00:10Z, before any re-run): 3 of 8.**

```
PASS  game differential                          0 of 6000 at every corner
FAIL  deliberate roster / items                  MEASURED AGAINST A DIFFERENT ENGINE
FAIL  deliberate roster / abilities              MEASURED AGAINST A DIFFERENT ENGINE
FAIL  deliberate roster / moves                  MEASURED AGAINST A DIFFERENT ENGINE
PASS  coverage / every used mechanic is measured
FAIL  whole-game differential                    MEASURED AGAINST A DIFFERENT ENGINE
FAIL  mechanics / each one staged and compared   MEASURED AGAINST A DIFFERENT ENGINE
PASS  no open, known engine defect
```

**AFTER: 8 of 8. `GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld`.**

```
PASS  game differential                          clean at BOTH corners: 0 of 6000, all 15 corners
PASS  deliberate roster / items                  clean: 140 of 148 tested
PASS  deliberate roster / abilities              clean: 129 of 202 tested
PASS  deliberate roster / moves                  clean: 475 of 500 tested
PASS  coverage / every used mechanic is measured  all 412 moves above 25 clicks
PASS  whole-game differential                    ZERO divergences across 961 games that anything is
                                                 asked to answer for (6 raw, 6 declared, 0 cleared)
PASS  mechanics / each one staged and compared   5 diverge, 1 declared, 4 below the reach shelf -> 0
PASS  no open, known engine defect               112 verdicts read, no open row names a RED instrument
```

`node engine/quarantine.js` counts **8 PASS, 0 FAIL.** `node engine/status.js` no longer prints a
QUARANTINE block at all: the seven MEASURE/SEARCH figures that read `QUARANTINED — the figure is
withheld` before the batch now read `WITHHELD — engine/provenance.js calls <artifact> UNSAFE`, which is
**a different and weaker withholding**. They are no longer gated on MEDICHAM; they are stale artifacts
on the ROADMAP #57 re-run list. 72 of 250 artifacts are now reported **RE-RUNNABLE** rather than
withheld.

**THIS IS NOT A CLAIM THAT THE QUARANTINED NUMBERS ARE NOW TRUE.** They become re-runnable, not true —
CLAUDE.md's own words. Nothing downstream was re-run in this batch and nothing downstream may be quoted
off the back of it.

## 6. WHAT MOVED UNDER ME

- **`engine/status.js` changed content mid-batch**, between the roster/moves stage and the differential
  (md5 `a8eb700a32a4...` -> a new digest, then stable). That is the MEASURE agent the coordinator said
  was editing gate reporting. **`engine/quarantine.js` did NOT change** — digest `add496981c19...` held
  across the whole batch, checked four times. `engine/medicham2-browser.js` and `tests/roster.js` also
  held. So the gate LOGIC I read is the same logic throughout; only the status printer moved, and the
  8-of-8 reading is from `quarantine.js`, not from `status.js`.
- **A release was not cut by me and was cut by someone**: `data/engine-release.json` gained a fourth cut
  of the same tree at `00:03:10Z` (`why: "phase-0 settled: WIRE 158 metronome ladder; re-run
  baseline"`). Same id, same bytes, so it is an append and not a fork.

## 7. FILED, NOT FIXED — three things this batch surfaced

**7.1 The #440 closet declaration prints EVIDENCE NOT RE-CHECKED, and the evidence HAS now been
re-checked.** `engine/quarantine.js` renders, on the whole-game clause:

> *EVIDENCE NOT RE-CHECKED — the no-board-effect claim was measured on release `5f3f7141227c`
> (2026-08-28) and this artifact was measured on release `4e5c7b3400de`.*

The release id in that sentence is written into the declaration, so it stays at `5f3f7141227c` however
often the artifact is re-run. Measured against the artifact I just wrote, every clause of the
declaration's own `WOULD BE WRONG IF` test passes on `4e5c7b3400de`:

| clause | required | measured on `4e5c7b3400de` |
|---|---|---|
| (a) exemption spread to another residual drain | no such row | the one `\|upkeep <> \|faint\|p2b` row, unchanged |
| (b) `games_board_never_diverged` < `games` | must not | 961 = 961 |
| (b) `protocol_diverged_board_never_did` < `protocol_diverged_games` | must not | 6 = 6 |
| (b) `first_board_divergences` non-empty | must be empty | `[]` |
| (d) cause reaching more than one game | must not | n = 1 |

Clause (c), `MEDFAILS.residualFollowerUnmapped`, is an engine counter and is not in this artifact — **not
checked here**, and not claimed. **Owner: MEASURE (gate reporting).** An agent is live on exactly that
file; this is a note for them, not a fix from me.

**7.2 `data/quarantine-stamp.json` is stale at `2026-08-28T19:33:52Z`.** It is written only under
`node engine/quarantine.js --check` (`quarantine.js:4405`), which I was not asked to run and which
ratchets a citation list. Command in §OWED.

**7.3 `docs/ENGINE.md:127` carries `GATE 8 OF 8 -> 3 OF 8` as its headline**, which was true when
written four hours ago and is now superseded. Per the dated-evidence convention it was not edited in
place; a new dated section records the re-run above it.

## 8. WHAT WAS NOT DONE, AND WHY

- **`node engine/status.js --write`.** Deliberately not run, for the same reason the previous agent gave
  and one more: it stamps GENERATED blocks into five ledgers, and (i) `docs/ENGINE.md`, `docs/MEASURE.md`,
  `docs/OPS.md`, `docs/SEARCH.md` and `docs/SUMMARY.md` are all uncommitted-modified by other agents, and
  (ii) `engine/status.js` — the file that would do the stamping — **changed content during this batch**.
  Stamping a ledger from a printer another agent is mid-edit on is the write this repo can least afford.
  It is the first line of §OWED and it is a one-command job for the coordinator once MEASURE is clear.
- **No commit, no push**, as instructed.
- **No engine edit.** `engine/medicham2-browser.js` is byte-identical to the release throughout.
- **No fix.** §7 is filed, not repaired.

---

## OWED, NOT RUN

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown

# 1. THE LEDGER STAMP. Run this ONLY when no MEASURE agent is holding engine/status.js or the five
#    ledgers — status.js changed content during this batch. It is what puts "8 of 8" into the docs.
node engine/status.js --write

# 2. The quarantine citation ratchet — the only thing that moves data/quarantine-stamp.json
#    (stale at 2026-08-28T19:33:52Z). It is a GATE and it writes; MEASURE owns it.
cmd /c tools\lownode.cmd engine\quarantine.js --check

# 3. ROADMAP #57 — the quarantine has LIFTED, so the 72 downstream artifacts are now RE-RUNNABLE.
#    They are not true yet and must not be quoted until each is re-run. The list is printed by:
node engine/quarantine.js            # tail section, "72 of 250 artifacts ... RE-RUNNABLE"
#    The refit is the head of that queue and belongs to MEASURE, not here:
#      node engine/fit_policy.js  &&  node engine/fit_joint.js
#    status.js also reports REFIT OWED with feature_fixture --check FAILED on two gates
#    (fixture identity, damage table). Settle the table verdict BEFORE any restamp.

# 4. NOT RE-CHECKED IN THIS BATCH — clause (c) of the ROADMAP #440 declaration. It is an engine
#    counter, not an artifact field, so no re-run above answers it:
#      MEDFAILS.residualFollowerUnmapped must still be empty on release 4e5c7b3400de.

# 5. The narration gate (Will's second gate, 2026-08-22) is untouched by this batch. The 6 raw
#    protocol divergences above are all declared; none is a board divergence.
```

### Exact commands that WERE run, for reproduction

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
cmd /c tools\lownode.cmd --max-old-space-size=6144 tests\roster.js --stage items     --reds --write --release 4e5c7b3400de
cmd /c tools\lownode.cmd --max-old-space-size=6144 tests\roster.js --stage abilities --reds --write --release 4e5c7b3400de
cmd /c tools\lownode.cmd --max-old-space-size=6144 tests\roster.js --stage moves     --reds --write --release 4e5c7b3400de
cmd /c tools\lownode.cmd --max-old-space-size=6144 engine\game_differential.js --release 4e5c7b3400de \
    --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json \
    --arm middle --end-state --games 1200 --write
cmd /c tools\lownode.cmd --max-old-space-size=6144 engine\all_mechanics_fire.js --kind all --write --release 4e5c7b3400de
node engine/quarantine.js
node engine/status.js
```
