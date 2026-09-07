# Comparability restore — backfilling `steering.driver_code` by re-running, not by stamping

2026-09-06 evening, MEASURE. Resumed after two previous attempts lost their account to a dropped
process. Written incrementally as the runs completed, so a third drop leaves a record.

**Nothing in this pass back-stamps.** No `driver_code` was written onto an existing artifact, no tool
that could do so was built, and none was found on disk (§7 re-checks the triage's finding).

---

## 0. Guard rails honoured

- An ENGINE agent was live throughout, editing `engine/medicham2-browser.js`, `engine/board_state.js`,
  `tests/roster.js` and its own probes, and cutting releases. **No instrument file was edited by this
  pass** — not `engine/game_differential.js`, `diff_swarm.js`, `steering.js`, `data/protocol-events.json`,
  `status.js`, `quarantine.js` or `docs_scan.js`. `engine/status.js --write` was not run.
  `data/policy-weights.json` was not touched.
- Every heavy run went through `cmd.exe //c "<script>.cmd"` → `tools\lownode.cmd`.
- **Re-confirmed once, myself, that a pinned release serves the SNAPSHOT and not the live tree**, which
  is what makes this safe beside a live ENGINE agent:

  | | digest | bytes |
  |---|---|---|
  | `data/releases/316669459d67/engine/medicham2-browser.js` | `c2438663ebe5` | 2,941,106 |
  | live `engine/medicham2-browser.js` | `7944a53d9ae3` | 3,144,960 |

  `REL.stamp().source_digests['engine/medicham2-browser.js']` reads `c2438663ebe5` — the snapshot.
  `REL.require()` served **97** exports against the live module's **98**, and **61 exported functions
  have a different `toString()`** between the two. A digest comparison alone would not have proved the
  snapshot was *served*; the source comparison does.
- The instrument was digested before the series started and again after every arm:
  `driver_code = 228006b5faca` over 11 files, and every artifact written tonight carries
  `driver_code_stable: true`.

---

## 1. The five files left on disk by the previous attempts: ALL FIVE ARE WHOLE, AND ALL FIVE ARE THE WRONG RUN

`data/verification/restamp/` held `_smoke-fb7.json`, `fix-batch-7.json`, `fix-batch-8.json`,
`fix-batch-M1M3M4.json`, `fix-batch-M5M7M8.json`.

**Torn-read check — all five pass.** Each parses, each carries `steering.driver_code` (`228006b5faca`,
11 files) and `driver_code_stable: true`, and in each the `generated` timestamp equals the file mtime
to within 0.1 s, which means the single `writeFileSync` at the end of the run completed. The gaps
between consecutive mtimes reconcile with the recorded `elapsed_s` in every case:

| file | mtime | `elapsed_s` | gap from previous |
|---|---|---|---|
| `_smoke-fb7.json` | 19:31:05 | 1.6 | — |
| `fix-batch-7.json` | 19:37:08 | 306.1 | 363 s |
| `fix-batch-8.json` | 19:41:55 | 284.0 | 287 s |
| `fix-batch-M1M3M4.json` | 19:46:25 | 268.7 | 270 s |
| `fix-batch-M5M7M8.json` | 19:52:58 | 385.3 | 393 s |

No process died mid-write. **Nothing was discarded and nothing was deleted.**

**But they do not replace the artifacts they are named after, and this is the finding of §1.** Held
against the originals in `data/verification/`, three run parameters differ:

| | original (2026-09-04/05) | previous attempt (tonight 19:31–19:52) |
|---|---|---|
| `games` | **961** | **777** |
| `pins.arms_run` | `["middle"]` | `["middle","top-tie-first","bottom-tie-first"]` |
| `state_mode` / `end_state_mode` | `true` / `true` | **absent — `state` is `null`** |
| census pin | `census-pin-9446a684709d.json`, 643 rows | same |
| team store | `data/team-pool-frozen` | same |
| pool digest / picked | `0d103fb9fa87` / 1968 | `b2b61ec40281` / 1597 |
| engine release | per-arm, pinned | same per-arm ids |

The `777` is the known trap, and `docs/ENGINE.md:17894` already records the cause: **the standing
961-game baseline was run at `--games 1200`.** Run at `--games 961` the pinned pool yields 777 pairs.
The previous attempt passed `--games 961` and got a smaller, different sample.

The `state: null` is the expensive half. **Every figure the living documents quote off `fix-batch-7`
is a board-material count** — `state.games` less `state.games_board_never_diverged` — and a run with
no state block cannot produce one at any sample size.

`engine/arms_comparable.js`, asked about the original against the previous attempt's replacement,
**verbatim**:

```
  NOTE: both arms name the SAME engine release. This is a REPEAT, not a before/after.

  NOT COMPARABLE — shown to differ:
    - the TEAM POOL differs: 0d103fb9fa87 vs b2b61ec40281 (8778 vs 8778 distinct teams in the
      corpus, 1968 vs 1597 picked). The game store moved between the arms, so they played
      different teams — the other half of the sample.
    - `games` differs: 961 vs 777 — a different number of games is a different sample
    - `mode` differs: A/middle/pins:bcb38e47d94f/credit:observed-effect/v1/nature:real vs
      A/middle/pins:9c31c43fab38/credit:observed-effect/v1/nature:real — Mode A and Mode B are
      different instruments

  UNKNOWN — could not be shown the same:
    - only the after-arm records `driver_code`. The other predates the instrument stamp, so
      nothing recorded which bytes of engine/game_differential.js and engine/empirical_driver.js
      played its games. [...]

  DO NOT PUBLISH THIS AS A BEFORE/AFTER.
```

Note the corpus is the same 8,778 teams in both — the pool digest moved because a smaller `--games`
picks fewer keys, not because the store moved. `arms_comparable`'s wording ("the game store moved")
is the one line in its output that overstates what it measured here.

**What the previous attempt DID achieve, and it is worth keeping:** its four arms are mutually
COMPARABLE. Asked pairwise — 7→8, 8→M1M3M4, M1M3M4→M5M7M8, 7→M5M7M8 — `arms_comparable` returned
`COMPARABLE. Both arms selected their sample the same way`, **exit 0, four of four**, with the driver
CHECKED on both sides of each pair. It is a coherent stamped series at 777 games with no board
comparison. **The files are left on disk untouched** (this pass wrote to new `*.961.json` names) so
that judgement can be revisited.

---

## 2. THE THING THAT GOVERNS THIS WHOLE TASK: A RE-RUN RESTORES A STAMPED SERIES, IT DOES NOT RESTORE THE PUBLISHED FIGURE

A 30-game smoke run tonight on the originals' exact pins came back with
`mode: A/middle/pins:de38d17e15a2/...`. The originals read `pins:bcb38e47d94f`. **The pin digest has
moved**, because `BattleActions#selfDrops` got its own address category `sdrop` today (2026-09-06) —
a real change to how a die is addressed, recorded in `pins.arms[].dice_model`.

So `arms_comparable` will refuse *every* old-artifact-versus-new-artifact pair on `mode` alone, no
matter how carefully the census, the pool, the release, `--games` and the turn cap are matched. That
is not a defect in the plan; it is the check doing its job. **The honest statement of what a backfill
re-run buys is:**

- it produces an artifact at the cited path that carries a `driver_code`, so pairs *within* the new
  series are checkable;
- it **does not** back-cast the published number, and the published number therefore MOVES;
- so every backfill re-run owes a `docs/RUNNING-NOTES.md` row naming what it supersedes.

There is no third option that leaves the old figure standing with a receipt. That is exactly the
back-stamp, and §7 says why it is refused.

---

## 3. `data/state-ladder.json` — **WITHDRAWN, NOT RE-RUN**

Cited by 7 living documents for one figure: *"The board at the end of turn 1 is identical in 56.0% of
games at the …"* (`ABRA-whitepaper`, `ABRA-deck-plain-english`, `ABRA-technical-docs`,
`GAME-DIFFERENTIAL-DESIGN`, `MODELS`, `SUMMARY`, `DAMAGE-STAGES`).

**Four measured reasons. Read reason 1 with §3a — it is not what it looks like.**

1. **The artifact says of itself that it is not a ladder.** `determinism.verdict` reads verbatim:
   *"THE TWO BASELINES DISAGREE. Do not read the table below as a ladder."* The pre-WIRE-1 baseline
   was run first and last with twelve arms between, and `reproduces` is `false`. **No living document
   mentions this.** Seven of them publish the ladder's deltas — 56.0% → 66.9%, *"WIRE 10 is a
   regression the protocol instrument scored as an improvement"* — off a table the artifact tells its
   reader not to read as a ladder.
2. **Its sample cannot be reproduced.** `steering.team_pool_digest: 32b2abcbfeb7`, 7,509 teams,
   3,999 picked, drawn from the LIVE store: `source_digests` records `data/games.bo3.jsonl` at
   `ff6529f6a6d7`. That file is `da8597c45bb8` today, a month of hourly appends later. There is no
   frozen copy of that pool.
3. **Its instrument is a month gone.** `engine/game_differential.js` `c49693fa99e6` → `1f13edfb057a`;
   `engine/diff_swarm.js` `ecf3284aabb1` → `1c50526141d6`; `data/protocol-events.json` — the declared
   skip list, which decides which Showdown lines are deleted before alignment — `9c1dfeb7973c` →
   `9abf74a7597e`; `data/engine-data.js` `96a94b7fadf7` → `bbc417dfae0e`.
4. **The instrument names this file, by name, as not comparable.** `engine/game_differential.js`'s own
   `baseline_reset` string, written into every artifact it produces: *"NO NUMBER IN THIS ARTIFACT MAY
   BE COMPARED WITH ANY RUN TAKEN BEFORE 2026-08-07 — not the 75.5% turn-1 figure, not
   data/state-ladder.json, not the class counts."* Register row #396 says the same independently.

A re-run today would answer a different question — different pool, different 643-row census against
its 252-row pin, different skip list, different driver, four pinned arms where it had one. **A re-run
answering a different question is worse than a withdrawal.** So: withdrawn. **The ladder deltas are
retracted and are not replaced by a new number in this pass.** Nothing is captioned; they come out.

### 3a. SUSPECT THE INSTRUMENT BEFORE THE ENGINE — the red determinism verdict is very probably a FALSE ALARM, and it could not be settled

Reason 1 above is quoted as the artifact's own words and it must not be leaned on, because the
evidence inside the same artifact contradicts it. Walking the two baseline arms field by field, **every
measured field is identical**:

| field | `a01-baseline-run1` | `a14-baseline-run2` |
|---|---|---|
| release | `cf6a68fa412c` | `cf6a68fa412c` |
| games / diverged / agreed_completely | 1998 / 1963 / 35 | 1998 / 1963 / 35 |
| classes / distinct causes | 22 / 1134 | 22 / 1134 |
| turn-1 boards identical | 1119 (0.5601) | 1119 (0.5601) |
| `vs_baseline` | — | `parted_at_the_same_line: 1998`, `net_later: 0`, `median_delta_lines: 0` |

All 1,998 games parted at the same line, and `determinism.per_game_depth_identical` is `true`. The
**only** substantive field that differs anywhere in the two arm records is
`declared_gaps.tags_release_matches_live`: `true` on the first arm, `false` on the last — a flag about
whether the LIVE tree's `data/tags.json` still matches the release, which moved during the ladder's
~50-minute run. It is not a fact about the games.

`baselineReproduces` (`engine/wire_ladder.js:410`) compares the two whole artifacts through
`stripVolatile`, which deletes exactly `generated`, `elapsed_s`, `baseline_comparability`,
`engine_release_cut`, `engine_release_cuts` and `steering`. `declared_gaps` is not stripped. Its own
comment claims *"Everything removed here is a fact about WHEN the run happened … never about what it
measured. If any measured field differed the comparison below would say so"* — and the failure is the
mirror image: a field that measures nothing was **left in** and fired the verdict.

**THIS IS NOT PROVEN AND IS NOT REPORTED AS PROVEN.** `stripVolatile` runs on the raw per-arm
artifacts, and those are gone: `data/wire-ladder.json` records `arm_artifacts: "not kept — re-run this
file to regenerate them"`, and `data/state-ladder.json` points at a scratchpad directory belonging to
an August session. So the comparison cannot be replayed. What is established is that **no measured
field in the artifact supports the verdict**, and that the one field which does differ is not a
measurement. Filed as a suspected instrument defect in `engine/wire_ladder.js`; **not fixed here**,
because MEASURE does not edit an instrument mid-pass and a fix would move `wire_ladder.js`'s own
digest under a live ENGINE agent.

**Which does not rescue the figure.** Reasons 2, 3 and 4 are independent of the verdict and each is
sufficient on its own. And the second half of reason 1 stands whichever way the verdict falls: a red
line printed in an artifact that seven living documents quote, and that none of them mentions, is the
`PRE-CHANGE` failure again — the caption is rendered and the number gets used.

---

## 4. `data/wire-ladder.json` — a re-run is a NEW SERIES, not a restoration

Priority 1 in the brief: 5 living documents, and the only unstamped steering artifact `engine/status.js`
names. Unlike §3 it is internally sound — `determinism.reproduces: true`, `comparability.all_ok: true`,
14 arms over 14 frozen releases from 2026-08-06/07.

**But it is already WITHHELD.** `docs/ENGINE.md:144` prints
`release ladder: WITHHELD — engine/provenance.js calls data/wire-ladder.json UNSAFE`, and
`docs/MEASURE.md:2480` records it staying withheld at ladder scale. So the receipt this backfill would
buy attaches to a figure the gate already refuses to publish.

**And its sample cannot be reproduced either**, for the same reason as §3 and one more:

- `steering.team_pool_digest: bd29c210884e`, 7,454 teams, 3,996 picked, **from the live store**
  (`data/games.bo3.jsonl` `a5cba908de66`, now `da8597c45bb8`). `engine/wire_ladder.js` today freezes a
  store per run (`PIN_STORE`, `--no-pin-store`, `STORE_DIR`), which makes a *new* run's 14 arms mutually
  comparable — it cannot recover August's pool.
- `data/protocol-events.json` `9c1dfeb7973c` → `9abf74a7597e`; `engine/game_differential.js`
  `9221179f56fa` → `1f13edfb057a`; `engine/diff_swarm.js` `dae9c1d7d942` → `1c50526141d6`.
- The artifact carries **no `pins` block at all**, so it predates ROADMAP #88's four pinned arms — it is
  on the far side of the same 2026-08-07 baseline reset that condemns §3.
- `arm_artifacts: "not kept — re-run this file to regenerate them"`, so there is nothing to re-read.

**Considered and refused:** reconstructing August's pool from `git show <commit>:data/games.bo3.jsonl`.
It would not work — `engine/diff_swarm.js`'s own predicates moved (`dae9c1d7d942` → `1c50526141d6`), so
the pool would not reproduce from the same store bytes, and the run would still be on today's skip list
and today's driver.

**Verdict: do not re-run it as a backfill.** A 14-arm run at 2,700 requested games is ~1.5–2 h of one
process and yields a *new* ladder over the same 14 releases whose every number supersedes the old one —
which is a legitimate measurement worth commissioning on its own terms, and is not what "restore
comparability" means. Recorded as an option with its cost, not taken tonight.

---

## 5. THE RE-RUNS — seventeen arms at the originals' exact pins

### 5a. The sample line, recorded in full because `--games` is part of it

Every one of the seventeen arms was run with **exactly** this, changing only `--release` and `--out`:

```
tools\lownode.cmd engine\game_differential.js
    --games 1200                                          <- 961 games PLAYED; see below
    --turns 12
    --end-state                                           <- implies --state
    --arm middle
    --steering empirical
    --census data/verification/census-pin-9446a684709d.json    (643 rows, matches_live false)
    --team-store data/team-pool-frozen                         (8,778 teams, digest 0d103fb9fa87)
    --release <the artifact's own engine_release>
    --write --out data/verification/restamp/<name>.961.json
```

**`--games 1200`, not `--games 961`, and that is the whole 777-versus-961 trap.** `docs/ENGINE.md:17894`
records it: the standing 961-game baseline was run at `--games 1200`; run at `--games 961` the pinned
pool yields 777 pairs. Every arm below reports `games: 961`, `team_pool_picked: 1968` and
`team_pool_digest: 0d103fb9fa87` — **identical to the artifact it replaces on all three** — so the
sample was reproduced rather than approximated.

Pins verified per arm, not assumed: release id, census digest `9446a684709d` / 643 rows, pool digest,
`turns_cap: 12`, `state_mode: true`, `end_state_mode: true`, `pins.arms_run: ["middle"]`, policy
`empirical-click/v1`. All seventeen releases were opened and `REL.require`'d before the series started:
**0 stranded**, exports 96 or 97.

The instrument was digested before the first arm and after the last: **`228006b5faca`, unchanged**, and
every artifact written carries `driver_code_stable: true` — the differential's own within-run check that
no instrument byte moved between load and write.

### 5b. THE HEADLINE: THE ENGINE DID NOT MOVE AND THE NUMBER DID

`engine/arms_comparable.js` on the original `fix-batch-7` against its re-run — same release, same 961
games, same pool digest, same picked count, same census, same cap — **verbatim**:

```
  NOTE: both arms name the SAME engine release. This is a REPEAT, not a before/after.

  NOT COMPARABLE — shown to differ:
    - `mode` differs: A/middle/pins:bcb38e47d94f/credit:observed-effect/v1/nature:real
                  vs   A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real
                  — Mode A and Mode B are different instruments

  UNKNOWN — could not be shown the same:
    - only the after-arm records `driver_code`. The other predates the instrument stamp, so
      nothing recorded which bytes of engine/game_differential.js and engine/empirical_driver.js
      played its games. That is not "probably the same" — an edit to exactly those files is what
      produced 138 and 167 from identical pins.

  DO NOT PUBLISH THIS AS A BEFORE/AFTER.
```

**Every line about the sample is gone from that output.** The pool line that fired against the previous
attempt does not fire here. What is left is the instrument, on both axes — the pin digest, which moved
because `BattleActions#selfDrops` got its own address category `sdrop` today, and the driver closure,
which the old side never recorded and which no work today can recover.

So the movement in §5c is attributable to the instrument and to nothing else, and it is **large**.

### 5c. Old against re-run — seventeen arms, same release, same sample, one ruler apart

Ordered by release cut, oldest first. Every row: identical `engine_release`, identical `games: 961`,
identical `turns_cap: 12`, identical census pin `9446a684709d`/643 rows, identical pool
`0d103fb9fa87`/1,968 picked, identical `pins.arms_run: ["middle"]`, identical policy
`empirical-click/v1`. **Pin identity was checked per arm rather than assumed: 17 of 17 clean, 0
failed.** The only thing that differs is the instrument.

| arm | release | cut | board-material was | now | Δ | protocol was | now | Δ | void was/now |
|---|---|---|---|---|---|---|---|---|---|
| `gd.instructshield532` | `705ead2014b2` | 2026-08-29 | 91 | **114** | +23 | 205 | **242** | +37 | 9/10 |
| `gd.instructaim534` | `e8f7c7dba595` | 2026-08-29 | 90 | **113** | +23 | 205 | **242** | +37 | 9/10 |
| `gd.sidetarget` | `070890fc77a2` | 2026-08-29 | 90 | **113** | +23 | 205 | **242** | +37 | 9/10 |
| `gd.volleyreact` | `12dae69813f6` | 2026-08-29 | 88 | **112** | +24 | 204 | **241** | +37 | 9/10 |
| `gd.afterfaint` | `26787be1b8b4` | 2026-08-30 | 84 | **108** | +24 | 199 | **237** | +38 | 9/10 |
| `gd.residualorder` | `b45e6b257029` | 2026-08-30 | 84 | **108** | +24 | 191 | **229** | +38 | 9/10 |
| `gd.packettiming` | `a18431d6dbe2` | 2026-08-30 | 84 | **108** | +24 | 181 | **216** | +35 | 9/10 |
| `gd.formeoneat` | `68c90b3b9f17` | 2026-08-30 | 84 | **108** | +24 | 175 | **210** | +35 | 9/10 |
| `gd.eatevent` | `f933a01b792a` | 2026-08-30 | 84 | **108** | +24 | 175 | **210** | +35 | 9/10 |
| `gd.stolenberry` | `0e8ec5729a7b` | 2026-08-30 | 83 | **107** | +24 | 173 | **208** | +35 | 9/10 |
| `gd.enginedata` | `862624c9826e` | 2026-08-31 | 82 | **106** | +24 | 172 | **207** | +35 | 9/10 |
| `fix-batch-M1M3M4` | `f3504e5f88d6` | 2026-09-04 | 61 | **82** | +21 | 161 | **193** | +32 | 7/7 |
| `fix-batch-M5M7M8` | `9b449a41c865` | 2026-09-04 | 50 | **74** | +24 | 150 | **181** | +31 | 7/6 |
| `fix-batch-M6-sidesel` | `7ffc58da8ef8` | 2026-09-04 | 53 | **74** | +21 | 154 | **179** | +25 | 7/6 |
| `fix-batch-M6instr-defog` | `252025cfcddc` | 2026-09-04 | 46 | **66** | +20 | 141 | **167** | +26 | 7/6 |
| `fix-batch-7` | `316669459d67` | 2026-09-05 | 37 | **53** | +16 | 122 | **143** | +21 | 6/6 |
| `fix-batch-8` | `a5c736283129` | 2026-09-05 | 35 | **50** | +15 | 120 | **140** | +20 | 4/4 |

**Board-material rose by a mean of +22.2 (range +15 to +24). Protocol first-divergence rose by a mean
of +32.6 (range +20 to +38).** No engine byte moved in any of the seventeen comparisons. Total measured
cost of the series: **3,647 s** of `elapsed_s` across 17 arms, min 149.1 s, max 292.3 s, two streams in
parallel, 20:05–20:54 EDT, every arm `EXIT 0`.

**THE SHAPE OF THE STORY SURVIVES; THE LEVEL DOES NOT.** Taking the sixteen adjacent steps in release
order, **fifteen keep their sign** and one flips:

- `fix-batch-M5M7M8` → `fix-batch-M6-sidesel` read **+3** on the old instrument (a regression of three
  board-material games) and reads **0** on today's (flat). That step is the one published claim in the
  series a reader could compute that does not survive re-measurement. It is a derived delta, not a
  sentence: the living documents state `fix-batch-M6-sidesel`'s **53** and name the artifact, which is
  correct and unaffected.
- Across the whole series the engine work reads **91 → 35 = −56** on the old instrument and
  **114 → 50 = −64** on today's. The fixes bought **more** than was published, which is the same
  direction as WIRE 4's controlled re-run (a published 46/45→31/31 that was really 59/56→38/35).

### 5d. Comparability, from the tool rather than from me

- **NEW against NEW — `COMPARABLE`, 16 of 16, zero refusals.** Every arm compared against
  `fix-batch-7.961.json` as the reference. `arms_comparable` reports for each pair: *"COMPARABLE. Both
  arms selected their sample the same way, so a difference between their numbers is the change under
  test"*, and the driver line reads *"the driver is CHECKED for this pair (steering.driver_code, both
  arms)"*. The seventeen arms may be tabled together.
- **OLD against NEW — `NOT COMPARABLE`, 17 of 17.** Across all seventeen, the reasons tally is:

  | | count |
  |---|---|
  | proven different: `mode` differs (the pin digest) | **17** |
  | proven different: anything else — `games`, `turns_cap`, team pool, steering policy, census | **0** |
  | UNKNOWN: *"only the after-arm records `driver_code`"* | **17** |

  Nothing about the SAMPLE is refused anywhere. The refusal is the instrument, twice over, in every
  single case. **A refusal is a result, and this is the result.**

### 5e. What was NOT done to the originals

The seventeen originals in `data/verification/` were **not overwritten and not deleted.** The re-runs
are new files, `data/verification/restamp/<name>.961.json`. Both series are true and they answer
different questions: the original is what that engine measured under that day's ruler, the re-run is
what the same engine measures under today's. Per this repository's own standing rule, name the artifact
every time either is quoted — and **never table one against the other**, which is what
`arms_comparable` refuses 17 times above.

The five files the previous attempts left in `data/verification/restamp/` were also left untouched.

## 6. The eleven `game-differential.<mechanic>.json` arms

They share the fix-batch recipe exactly — 961 games, cap 12, `--end-state`, arm `middle`,
`empirical-click/v1`, census `9446a684709d`, pool `0d103fb9fa87` — and differ only in release. So the
seventeen arms together form **one stamped ladder over seventeen releases measured with one ruler**,
which is something none of the published per-version deltas can be: each of those was taken with its own
contemporaneous instrument.

**The whitepaper's eleven citations are NOT rewritten, deliberately.** Each sits inside a dated version
entry (`5.236.0 — …`) that names the artifact, the release, the arm, the census pin, the pool and the
cap, and states a before→after delta measured on that day's instrument. Those are the log. Restating
them at today's levels would be editing the log to agree with today, which this page's own preamble and
CLAUDE.md's revision rule both refuse. What the re-runs add is a second, stamped series beside them.

## 7. Back-stamping: re-checked independently, still nothing — and the shape to refuse

Every `driver_code` occurrence outside `engine/steering.js` and `engine/arms_comparable.js` was read
again tonight. **No tool writes a `driver_code` block onto an artifact it did not produce, and none was
written in this pass.**

- `engine/game_differential.js` writes `driver_code_stable` / `driver_code_at_load` /
  `driver_code_at_write` for **its own** run only (`:9286`, `:9300–9301`) — that is a run stamping
  itself, which is the only legitimate case.
- `tests/probe_instrument_digest.js` §2b copies `_repro-smoke.json`'s block onto an **in-memory** copy
  of `cap20-control-12.json` to isolate the clause. Both digests are real measured values, the section
  is labelled `CONSTRUCTED`, and the file's only two `writeFileSync` calls (`:96`, `:99`) target a temp
  directory. Correct — **and it is the shape somebody would copy.**
- `tests/test-empirical-driver.js` and `tests/test-pin-arms.js` hold synthetic digests
  (`ddddddddddd0`, `eeeeeeeeeee1`, `cccccccccccc`) inside fixtures. Never written to an artifact.

**If a `--stamp` subcommand is ever proposed for `steering.js`, refuse it.** `engine/feature_fixture.js
--stamp` is the worked example in this repository of why: `node engine/status.js` prints, tonight,
*"A RESTAMP ANSWERS THE FIXTURE GATE AND SILENCES THE TABLE GATE — settle the table verdict first, or
the evidence for the refit is written over."* A restamp does not make a run comparable; it makes the
check stop asking.

**And §5b is the empirical case against it.** Had anything stamped `228006b5faca` onto the original
`fix-batch-7.json`, `arms_comparable` would have returned COMPARABLE about a pair whose numbers are 37
and 53 — a manufactured receipt on a 43% difference that the engine did not cause.

---

## 8. The 36 "dead" artifacts — **DO NOT DELETE. The triage's DEAD test had a blind spot.**

The triage proposed 36 for deletion (23.9 MB) on the test *"cited by no living document, not
`status.js`, not `quarantine.js`, not an open register row, not `engine/ tests/ build/ web/`, not a
ledger or the CHANGELOG."* That list omits `docs/_reports/`.

**Re-checked by name, one grep per file, tonight: 29 of the 36 are cited by at least one dated findings
report.** Examples: `game-differential.empirical.json` by **seven** reports,
`gd-empirical-cards.json` by five, `protect-fix-empirical.json` by three,
`game-differential.terraingate-before.json` by two. These are the evidence chain for measurements this
project traces by artifact name.

**Only these seven are cited by nothing at all:**

```
data/verification/game-differential.instructaim534-knob.json
data/verification/game-differential.shieldrearm-dump.json
data/verification/game-differential.terrainspread-before.json
data/verification/game-differential.terrainspread.json
data/verification/gd-card8-AFTER.json
data/verification/gd-card8-BEFORE.json
data/verification/gd-dump-run.json
```

**And even those should stay, on a measured argument rather than a cautious one.**
`docs/_reports/2026-09-06-repo-cleanup.md` establishes that all of `data/verification/` is **96 MB in
the working tree and 4.9 MB of packed history**, and that deleting a tracked file **recovers zero bytes
of history** — the blob stays in the pack forever. So the whole proposal buys 23.9 MB of working tree
and nothing that touches the 100 MB wall or the push failures. `git gc` recovered 512 MiB without
deleting anything.

**Reported, left in place. Nothing was deleted in this pass** — no tracked file, and no untracked file
including the five the previous attempts left in `data/verification/restamp/`.

---

## 9. What is still owed, named rather than implied

- **`docs/ENGINE.md` still carries the retracted state-ladder figures** at `:35070` and in the table at
  `:35089` (`1119/1998 56.0%` → `1337/1998 66.9%`). It is a division ledger, carries no version header,
  is therefore outside the living-document set the retraction registry reads — and it is ENGINE's file,
  not MEASURE's. **Filed, not edited.**
- **The suspected `engine/wire_ladder.js` determinism false alarm** (§3a). Filed, not fixed: MEASURE
  does not edit an instrument mid-pass, and the raw arm artifacts needed to prove it were not kept.
- **`data/protocol-events.json` is still in no digest set** — not the release, not `driver_code.files`,
  not `driver_inputs`, not `pins` — and it moved (`9c1dfeb7973c` → `9abf74a7597e`, regenerated
  2026-08-26) while its `source_digests` still names `engine/medicham2-browser.js` at `1337ff095e92`
  against a live `7944a53d9ae3`. Unchanged from the triage; re-verified, not re-argued.
- **`data/wire-ladder.json`** — not re-run, for the reasons in §4. It stays UNSAFE and WITHHELD.
- **The 41 tier-3 artifacts** cited only by a source file, a ledger or the CHANGELOG: left unstamped,
  deliberately. Quoting one obliges saying out loud that the instrument axis was never checked.

---

## 10. THE RETRACTION IS WORDS AND NOT A STRIKETHROUGH, AND THAT WAS MEASURED RATHER THAN CHOSEN

`docs/RUNNING-NOTES.md`'s own rule says a retraction is written as a strikethrough with the word
`retracted` beside it, because that form is what `engine/docs_scan.js`'s derived retraction registry
reads. **The row written tonight deliberately does not do that, and here is the measurement.**

A probe: `~~56.0%~~ retracted, ~~66.9%~~ retracted` was added to the row, the gate was run, and the row
was reverted. `node tests/test-docs-current.js` went **red, 11 new entries over a baseline of 8**:

```
  FAIL retracted figures restated as fact: no new entries (baseline 8, now 19)
         docs/ENGINE.md:35089  states 56.0% — retracted by docs/RUNNING-NOTES.md
         docs/ENGINE.md:35089  states 66.9% — retracted by docs/RUNNING-NOTES.md
         docs/ENGINE.md:40594  states 56%   — retracted by docs/RUNNING-NOTES.md
         docs/FINDINGS-2026-08-01-live-play.md:97  states 56%
         docs/HANDOFF-2026-08-01.md:116            states 56%
         docs/PRIOR-ART.md:202                     states 56%
         docs/ROLE-FAMILY.md:85                    states 56%
         docs/THESIS-DEFENCE-REVIEW-2026-07-28.md:159  states 56.0%
         docs/predictability-study.md:134          states 56%
         CLAUDE.md:395                             states 56%
         docs/archive/THESIS-REVIEW.md:12          states 56%
```

**Two of those eleven are real** — `docs/ENGINE.md:35070` and `:35089` are the state-ladder table
itself. **Nine are a matcher collision.** `56%` is an extremely common number in this repository and it
means something different in every one of those files; the registry's truncation rule
(*"a retracted 63.2% MUST match a document writing 63%"*) cannot tell them apart, and `CLAUDE.md`
accuses itself.

So the choice is between a red gate on nine false accusations and a retraction the registry cannot
machine-enforce. **Taken: the words, and this paragraph saying out loud what is therefore not
enforced.** The six living documents no longer state the figures — that is a fact about the files, not
a promise — and the two real ENGINE.md lines are named in §9 for their owner. Reporting the trade is
the alternative to silently picking the option that keeps the build green, which is how *"one of the
two known failures"* started.

**Do not fix this by lowering the baseline.** The eight-entry baseline is a ratchet; raising it to 19
to admit nine false accusations would blunt the one check that catches a genuinely restated figure.

---

## 11. THE COUNT, AND WHY THE OBVIOUS COUNT IS THE WRONG ONE

Re-scanned at 20:56 EDT on the triage's own predicate (`data/`, `data/verification/`,
`data/verification/restamp/`, `data/quarantine/`, `data/archive/`):

| | 04:38 (triage) | 20:56 (now) |
|---|---|---|
| JSON objects scanned | 450 | **510** |
| carry a `steering` block | 112 | **143** |
| carry `steering.driver_code` | 16 | **47** |
| carry no `driver_code` | 96 | **96** |

**The unstamped count did not fall, and that is correct rather than a failure.** Two reasons, both
deliberate: the seventeen re-runs are NEW files beside the originals rather than replacements — the
originals are dated evidence and were not overwritten (§5e) — and the denominator moved, because the
live ENGINE agent wrote new arms all evening, exactly as the triage warned it would.

**So do not track "how many artifacts are unstamped". Track which CITED figures have a stamped
counterpart.** Against the triage's tier-1 list of nineteen:

| | count | what happened |
|---|---|---|
| re-run and stamped tonight | **17** | six `fix-batch-*`, eleven `game-differential.<mechanic>` |
| **withdrawn** rather than re-run | **1** | `data/state-ladder.json` — §3, figures deleted from six living documents |
| declined, with the reasons recorded | **1** | `data/wire-ladder.json` — §4, already UNSAFE and WITHHELD; a re-run would be a new series and its August pool is unrecoverable |
| back-stamped | **0** | and no tool that could was built or found — §7 |
| deleted | **0** | including the seven genuinely-uncited artifacts — §8 |
