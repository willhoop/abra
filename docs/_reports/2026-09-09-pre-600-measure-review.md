# Pre-6.0.0 MEASURE review — 2026-09-09, read-only

**Dated evidence, not current state.** Every figure below was read from an artifact or a command
output on 2026-09-09 between 16:03Z and 17:10Z, on a tree whose engine digest was `b730e44f3314`
(`engine_release.treeDigest()` at 16:35Z). Re-derive before quoting. Nothing in the repository was
edited by this review except this file; the working-tree modifications listed in §12 were made by
the test suite and by other agents running in the same round, and are reported rather than reverted.

The question throughout: **can the numbers 6.0.0 would publish be believed, and is the release
process honest.** Severity per item is one of BLOCKS 6.0.0 / SHOULD FIX BEFORE / DEFER WITH REASON.

---

## 0. Two premises in the brief that are wrong, stated first

1. **"`probe_uncompared_leaves`: compared 33 / declared 4 / neither 43 of 80 leaves" is stale.**
   `node engine/coverage.js` today: *board leaves compared 54 — 54 is the CEILING, not the 80 … 6
   are declared uncomparable, 18 carry a declared duration of 1 and are ended in the residual, and 2
   are removed inside their own action … 0 uncompared leaves CAN stand at a boundary and are the
   whole of the widening work.* The 33/4/43 figure is the 2026-08-28 number that `engine/coverage.js`
   quotes in its own header comment as the reason the file exists (lines 10–11). The widening
   happened (the `state.not_compared` row for slot conditions is dated 2026-09-05).
2. **"25 RUN / 18 EXCLUDE" is not today's split.** `major_readiness` derives **40 LIFT / 24 STAY**
   over 64 withheld artifacts, and the LIFT set has **23 distinct generators**, not 25: the gate
   instruments (`game_differential`, `all_mechanics_fire`, three roster stages) are already current
   on `b730e44f3314` and are no longer withheld, and three generators the plan never listed —
   `engine/rollout_r1_artifact.js`, `engine/rollout_r2.js`, `engine/rollout_r4.js` (R1 leaf
   accuracy, R2 leaf cost, R4 head-to-head) — are in it. See §7.

---

## 1. THE TEST SUITE — run once, `cmd /c tools\lownode.cmd tests\run-all.js` from PowerShell

Started 16:03:55Z, finished 16:48:01Z; log 848 lines, `EXIT=1`. Headline:
**`150 passed, 27 failed, 0 skipped`** of 177 checks (150 in `tests/`, 27 engine gates). The
session-close report carried three reds "openly" (docs-quarantine, pinch-family, quality) plus the
feature-semantics print; the suite today has **27**. None is waived by Will by name in any record
this review found. Grouped by what is red:

**A. Deliberate consequences of two owner decisions — 8 files. These need a NAMED waiver at the cut,
or the decisions reversed; they are not defects the release can fix.**

| test | what it asserts, and why it is red |
|---|---|
| `tests/test-site-sync.js` (11/5) | `web/{stadium,status,tower}.html` identical to `app/` — `app/` is not published while web is paused (207,007 vs 177,312 B etc.). **Confirmed: red because web is paused**, not for another reason. |
| `tests/test-site-data-fresh.js` (5/2) | every regenerable bundle the site loads is newer than the newest game data — `data/abra-meta.js` 28.4 d, `status.js` 28.4 d, `xatu.js` 30.3 d. Web paused. |
| `tests/test-web-quarantine-loaders.js` (2) | the committed `web/quarantine-data.js` and the `stadium.html` block withhold the set the builder decides now — same two DRIFTs as `web/build-quarantine.js --check`. Web paused. |
| `tests/test-web-status.js` (12) | `web/status-data.js` (board of 2026-08-11) vs artifacts: `engine.live 423` vs census `830`, `ops.games 52089` vs `data/live.js 81269`, … **and it prints that `data/mechanics-census.json` was rewritten by THIS suite run.** Web paused. |
| `tests/test-forced-switch.js` | throws at `engine/magnemite.js:101 checkSemantics` ← `loadWeights` — the MAG weights refuse to load (`FEATURE SEMANTICS CHECK FAILED`, §8). MAG after 6.0.0. |
| `tests/test-team-preview-race.js` | same throw, via `ScoringPlayerAI` ← `showdown_bot.js:320`. |
| `tests/test-wiring.js` (10 NOT WIRED) | 6 self-play games per configuration report **no capability line at all** — not `policy=score`, not `aiming`, not `open team sheets`, not `mega`, not `team preview`; joint layer mega `0.00 per game`. Consistent with the same weights refusal (the scoring player cannot construct), not proven here. This is the exact failure shape CLAUDE.md names; it is currently masked by the MAG pause and **must be re-run the day the weights load.** |
| `engine/em_validation.js` | "the amplified regime's censoring bias did not exceed its own noise floor" — reads `data/policy-weights.json`, a STAY artifact. |

**B. The instrument, the docs, or the store — 17 files. Owned mostly by MEASURE and OPS.**

| test | failing assertion |
|---|---|
| `tests/test-lownode.js` (3/1) | `could not observe the child priority at all — the arm proves nothing, treat as red` (`Get-Process` PID 10584 gone before the probe). The three exit-code arms PASS, so the load-bearing claim holds; the priority arm raced, possibly because this run was itself nested under `lownode`. |
| `tests/test-fixture-legality.js` (3) | 2 of 3 are pairings read out of **`.claude/worktrees/agent-af59bcfe6a6444960/tests/`** — a git worktree another agent created at 12:05 local today (`git worktree list`), which the scanner walked as if it were the repo (`Toxapex/Stealth Rock`, `Whimsicott/Agility`). 1 is real: `"off"` in `tests/probe_punish_side_and_sky.js:161` names nothing in the format. |
| `tests/test-counter-init.js` (3/1) | 2 increments on undeclared `MEDFAILS` fields → NaN counters: `medicham2-browser.js:19590 sideBuffVolatileIdsUnknown`, `:32302 yawnRefusalSecondaryUnknown`. A counter that cannot prove it ran. **ENGINE.** |
| `tests/test-mutation-coverage.js` (5/1) | `the planted-stub gate catches both stubs (0/2 caught)`; its artifact measured `6fb9ebd3b704`, not the current release. |
| `tests/test-prng.js` (6/1) | float LCG (`1103515245`) in `tests/bench-medicham.js`, `tests/test-mechanics.js`, `tests/test-protocol-trace.js`. |
| `tests/test-policy-promote.js` (15/2) | `staged 7 of 12 artifacts`; `an unproduced artifact stopped the store being staged — the run would ship nothing`. **OPS.** |
| `tests/test-workflow-paths.js` (4/1) | `a store has rows in no shard` — run `node build/compress-stores.js`. **OPS.** |
| `tests/test-stadium-roster.js` (3) | models in `docs/MODELS.md` with no cabinet; 5 generators in neither MODELS.md nor the Stadium (`bench_speed`, `joint_click_census`, `next_regulation_ingest`, `side_selection_census`, `smogon_coverage`); `NOT_A_MODEL` entries MODELS.md now documents (`leaf_engine_contrast`, `click_census`, `quarantine`). **MEASURE owns MODELS.md.** |
| `tests/test-docs-quarantine.js` (1) | `NO NEW figure sourced from a quarantined artifact has entered a living document` — **`docs/RUNNING-NOTES.md:286`** quotes `66.6%, 27.1%, 92.0%, 25514, 42510, 99.5%, 78.8%, 83.7%` from `data/search-decision-profile.json`, a STAY artifact (the MILTANK profile row of 2026-09-08). A SEARCH row broke a MEASURE gate; the figures must come out. |
| `tests/test-quality.js` (31/1) | `clean share is stable: 31.3% now vs 28.0% recorded (drift 3.3 pts, tolerance 3). Store has grown 67384 -> 76833.` The recorded funnel is a stale corpus stamp. **MEASURE.** |
| `engine/selftest.js` (24/1) | 16 files read the ladder store raw with neither a clean filter nor `RAW-STORE-OK` (`bench_speed_consolidate.js`, `click_counts.js`, `durable-ingest.js`, …). |
| `engine/conformance.js` | S13 regressions: `replay-differential-freezes.json` and `whole-game-baseline.json` "generated but does not say so"; `scenarios-from-will.json` and `side-selection-declarations.json` "no generator writes it". **MEASURE (stamps).** |
| `engine/provenance.js` (gate) | exits 1 whenever `unsafe.length > 0` (`provenance.js:1691, :1754`) — red by construction until the re-run clears the 178 quality-filter-era artifacts. **A gate that has been red for weeks and read as "expected" is the shape CLAUDE.md bans.** |
| `engine/validate_selfplay.js` (16/1/1) | `no duplicate ids (89)` in the self-play store; mirror symmetry 142/300 = 47.3% CI [41.8, 53.0] passes. **OPS/store.** |
| `engine/sanity_check.py` (95/1) | `store shape: the winner is always one of the two players (2 bad)`. **OPS/store.** |
| `engine/identity_audit.js` | `RED — 2 identity read(s) do not go through the door`: `UNROUTED` `tests/probe_weather_forme_faint.js:153` (`_switchKey \|\| name`) and `:154` (`set.species \|\| set.name`); 2,982 soft-chain reads counted, not enforced. |
| `tests/test-board-browser.js` (13/1) | the browser copy of the board features disagrees with `board.js` — worst gaps `switchDiesFirst 0.500`, `killIsRoll 0.486`, `dmgFrac 0.310`. `data/board-data.js` has a builder with no `--check` (`artifact_audit`). |

**C. The engine — 2 files.**

| test | failing assertion |
|---|---|
| `engine/gate_fail_and_silent.js` | ROADMAP #241(3): **1 live cause over 1 game** — `event missing from medicham2 :: \|-fail\|p2a <> \|move\|p2b\|rockslide`; "green only at zero". Read on `data/game-differential.json` release `b730e44f3314`; the pin's sample (census `2e3953f1f882` / pool `631d4ea60a80` / 995 games) differs from this run's, so no movement is attributable. One of the 13 narration causes. |
| `tests/test-pinch-family.js` (1 of 61) | `all five 0-use members are still in the ungated set — ungated set is: firemane`. |

**Run-all's own coverage block:** `223 file(s) outside the run list report their own verdict: 24
NOT A CHECK, 38 PENDING-WIRE, 161 unaccounted for` — and it FAILS on the 161 (`FAIL —
UNACCOUNTED-FOR CHECK`). Among PENDING-WIRE, two are flagged RED today by their own entry:
`engine/feature_fixture.js` (the refit gate, §8) and `engine/side_selection_census.js`
(`undeclared 84`, measured 2026-09-04).

Severity: **BLOCKS 6.0.0** as a process fact — a major cut over 27 unwaived reds is the "known
failure" state by another name. Group A is 8 named waivers Will can give in one line each; group B
is mostly MEASURE/OPS housekeeping (stamps, the quality funnel, MODELS.md, the store); group C is
ENGINE's. `test-docs-quarantine` (a withheld MILTANK figure in a notes row) and `test-quality`
(a stale corpus stamp) are MEASURE's to clear before the cut.

---

## 2. THE GATE — 1 of 9 fails, and every PASS was measured on the current tree

Read via `require('./engine/quarantine.js').medichamIsCorrect()` (the same call
`engine/major_readiness.js` makes), not from a printout.

| clause | verdict | receipt |
|---|---|---|
| game differential (damage) | PASS | `data/engine-diff.json` generated `2026-09-09T11:57:17.879Z`, release `b730e44f3314`, `0 of 6000` at all sixteen corners |
| deliberate roster / items | PASS | `data/roster.items.json` 11:54:46Z, `differ 0, silent 0, matched 142, couldNotStage 6` |
| deliberate roster / abilities | PASS | `data/roster.abilities.json` 11:55:09Z, `differ 0, silent 0, matched 139, couldNotStage 158, deferred 5, unattributable 14` |
| deliberate roster / moves | PASS | `data/roster.moves.json` 11:55:33Z, `differ 0, silent 0, matched 487, couldNotStage 10, deferred 3` |
| coverage / every used mechanic is measured | PASS | `above_shelf 412`, all measured by roster or census |
| whole-game / BOARD-MATERIAL | PASS | `data/game-differential.json` generated `2026-09-09T11:48:00.710Z`: `state.games 958`, `state.games_board_never_diverged 958` → **0 of 958** |
| whole-game / NARRATION | **FAIL** | `narration_only 13` raw, less 1 declared = **12 of 961** as `status.js` prints it; `rate 0.01665` vs `baseline 0.01873`; 13 causes, all singletons |
| mechanics / staged vs showdown | PASS | `data/all-mechanics-fire.json` 11:57:33Z, `diverged 5, declared 1, shelved 4 (below reach), counted 0` |
| no open, known engine defect | PASS | `data/register-reality.json` verdicts generated `2026-09-08T16:34:05Z` (123 read) — **a day older than the engine; see §12** |

**Release identity.** All five gate artifacts stamp `engine_release b730e44f3314`, cut
`2026-09-09T11:45:50.749Z`. `engine_release.js list` marks that id current with **`0 of 27 files have
moved since`**, and `engine_release.treeDigest()` on the live tree at 16:35Z returned
`{"id":"b730e44f3314", …}`. During the suite run the same id was re-cut **25 more times**
(`data/releases/b730e44f3314/cuts.jsonl`, 16:11:54Z → 16:21:50Z, every one "game differential mode
A" — the side-effect cut named in the session-close report) and never a new id. **The tree has not
moved. Every PASS is measured against the engine that is on disk now.** No re-measure is owed for
that reason.

**Pins the run carried** (from the artifact, not the commit message): `games 961` (`--games 1200`
requested; `swarm[]` picked 1,968 of 8,778 teams), `turns_cap 50`, `steering.policy
empirical-click/v1`, `pins.primary middle` (dice pin digest `de38d17e15a2`), `end_state` present,
`steering.team_store_pinned_to data/team-pool-frozen` (pool digest `0d103fb9fa87`),
`showdown_commit 20ad99ffc9a5…`, `elapsed_s 124`. **The census was NOT pinned:**
`steering.pinned false`, `input_read_from data/mechanics-census.json`, `input_digest fe79e7bf2fb9`,
`matches_live true` at run time, role `CREDITED ONLY — it measures coverage and does not select`.
That census file was then rewritten by the suite at 16:21:25Z (§12), so `matches_live` would now
read false; because the census does not select the sample this does not void the run, but the
receipt no longer matches the live file and a re-run must pin it (`--census
data/verification/census-pin-<id>.json`).

**Comparability.** `node engine/arms_comparable.js <HEAD~1 artifact> data/game-differential.json` →
`COMPARABLE … NOTE: both arms name the SAME engine release. This is a REPEAT, not a before/after.`
The committed artifact and its predecessor commit carry the same release; the batch-X before/after
pair lives in `data/verification/` and was not re-derived here.

Severity: **none for the gate itself.** The one FAIL is the narration clause, which Will set as a
separate gate on 2026-08-22 (CLAUDE.md), so it does not block the board-material claim. What it
does block is the word "correct" without qualification — see §3 and §6.

---

## 3. THE BOUND ON THE HEADLINE — what "BOARD-MATERIAL 0 of 958" covers

Read from `data/game-differential.json`:

- `games 961`; `mid_void.void_games 3` (all `why: low-identity`, boards parted at turns 4, 6 and 3
  — `void_game_tags[].board_parted_at_turn`); `threw 1`; `state.games 958`.
- `state.games_cut_off_by_the_turn_cap 0`; `state.turn_boundaries_compared 10675`,
  `state.turn_boundaries_identical 10675`; `state.game_agreement 1`.
- `end_state[0].summary.end_reasons`: `both engines ended the battle 958`; `the boards parted —
  medicham2's placement cannot be expressed to showdown 2` (typhlosion, mudsdale); `THREW 1`.
  `verdicts: SAME-END-STATE 958, DIFFERENT-END-STATE 2, ENDED-APART 0, THREW 1`. Severity band 1
  `DIFFERENT-WINNER: games 0`. **So the completion rate IS in the artifact: 958 of 961 ended with
  both engines agreeing on the winner and the final board; 0 hit the cap.**
- `by_cause_totals.games_board_material 3` — the BY-CAUSE ATTRIBUTION, which is computed over the
  UNFILTERED results and therefore counts the 3 voided games (2 parted same turn + 1 later, exactly
  matching the three `void_game_tags`). This is the field CLAUDE.md warns about; the clause reads
  the filtered `state.*` pair. Both are right about their own population.
- `end_state_not_compared`: 9 named fields (ability trapping, item disposition `lastItem/ateBerry`,
  yawn/attract/curse/healblock, Unburden, Power Shift, rampage count + Ally Switch ladder, Future
  Sight/Wish countdowns, the trapper mark, magnet-rise/syrup-bomb durations and charge commitment).
- `coverage.js`: 54 of 80 leaves compared, 26 can never stand at a boundary; **differential bodies on
  a REAL spread: 0 of 17,536** (`rate_excludes`: every stored sheet reads `evs: null`, so the
  instrument assigns a spread and tests rules, not the stat lines the ladder brings).
- `closet.teams_dropped 43` (Illusion carriers, by config).
- The hiding class: `docs/RUNNING-NOTES.md:83` — **2 of 19** narration windows were a board
  difference erased within the turn (the 5.272.0 "one in six" retracted in 5.273.0).

**The one sentence 6.0.0 must print:**

> On release `b730e44f3314`, 961 games drawn from a frozen pool of real ladder teams
> (`0d103fb9fa87`, `--games 1200`, cap 50, arm `middle`, empirical steering) were played in both
> engines; 3 were voided because their dice streams parted and 1 threw; in every one of the
> remaining 958, all 10,675 compared turn boundaries were identical on the 54 board leaves the
> comparator reads, none reached the turn cap, and both engines ended the game on the same board with
> the same winner. It does not cover a board difference erased inside a turn (measured at 2 of 19
> narration windows), the 3 voided games — whose boards did part — the 9 named fields and 26 leaves
> nothing compares, a mechanic nobody in the pool brought, or real EV spreads, which no body in the
> sample carries.

Severity: **SHOULD FIX BEFORE** — the sentence does not exist in any living document yet
(`docs/RUNNING-NOTES.md:91` owes it "to the next major").

---

## 4. RELEASE INTEGRITY

- **Releases.** `data/releases/` holds **636** directories; `engine_release.js list` prints **635**
  ids. `b730e44f3314` is current, `0 of 27 files have moved since`, opened by id and served
  `engine/medicham2-browser.js` (98 exports) at 16:35Z.
- **Stranded, from the ratchet that matters:** `node --max-old-space-size=6144
  tests/test-artifact-rerunnable.js` → `99 stamped artifact(s) over 36 release(s): 57 re-runnable,
  0 retired, 41 unknown-producer, 1 STRANDED and undeclared` … `no artifact became unre-runnable
  since the baseline (1 known, was 1)`; `436 manifest(s) audited against surface()`. Every gate
  artifact reads `RE-RUNNABLE b730e44f3314`.
- **Stranded across ALL 636 releases: NOT DERIVED.** `node engine/engine_release.js census` (dry run) died at
  `FATAL ERROR: Reached heap limit` after 177 s at the 2 GB default; `node --max-old-space-size=3072
  engine/engine_release.js compat engine/medicham2-browser.js` died the same way. Neither declares
  `ABRA-HEAP`. The last `data/release-census.json` is dated `2026-08-11T01:25:55Z` — **118 releases,
  118 verifiable, 54 runnable** — against 636 on disk today. `tests/test-artifact-rerunnable.js`
  (`ABRA-HEAP: 6144`) passed inside the suite in 24.1 s, so the ratchet that matters holds; the
  census instrument itself has outgrown its heap. **SHOULD FIX BEFORE** (a `ABRA-HEAP` header on
  `engine/engine_release.js`, or a streaming census) — a release store nobody can enumerate is the
  thing §12 of LESSONS warns about.
- **SOURCES = 27** (`require('./engine/engine_release.js').SOURCES.length`). CLAUDE.md says
  "twenty-five", `.gitattributes` says "26 files" — both prose counts are stale, cosmetic, and the
  file itself says to read the count from `SOURCES`.
- **The nine unpinned generated sources are still nine and still CRLF** on disk, measured as lines
  carrying a CR: `engine/medicham2-browser.js 45,344`, `rollout_leaf.js 1,544`,
  `position_features.js 496`, `engine/tags.js 185`, `mc_key.js 450`, `set_priors.js 728`,
  `smogon_priors.js 326`, `data/quality-filter.json 137`, `data/engine-data.js 13`. 18 of 27
  sources are pinned `text eol=lf`. The release digest is therefore still machine-dependent for a
  fresh checkout of those nine. **DEFER WITH REASON** — pinning them moves every release id and
  breaks `tests/roster.js`'s CRLF anchors (`.gitattributes` says so), and the read-side fix
  (`sha12Content`) already makes comparability EOL-insensitive; but 6.0.0 must not claim the id is
  reproducible on another machine.
- **`data/abra-tags.js` and `data/tags.json` are in sync at HEAD:** `node engine/artifact_audit.js`
  → `ok data/abra-tags.js is what build/build_tags_js.js would write from data/tags.json` … `no gaps
  found`. The "release re-cut owed" item from the session-close report is satisfied by
  `b730e44f3314` (cut 11:45Z, after commit `731ecad7` landed both files at 08:09Z).

---

## 5. PROVENANCE

`data/provenance-stamp.json` (generated 16:11:48Z by this review's own `provenance.js` run — the
file's `generated` field is rewritten on every run, which is why it shows modified in `git status`):
`verified 10`, `mtime_only 179`, `void_files 2` (`exploitability.json`, `medicham-bench.json`),
`graph_files 255`, `no_writer_files 49`, `discoveries 55`. The ratchet moved in the tightening
direction only (commit `bf4ff432` removed two batch-X dumps).

`node engine/provenance.js`: the UNSAFE set is dominated by `OLDER THAN THE QUALITY FILTER` rows
(the scope report counted 178 of 182 on the night; not re-counted here — the reason string is one
condition, and the re-run in §7 is what clears it). 15 of the mtime-only files are underscore
scratch (`_bench-*`, `_r220-*`, `_scratch-*`) sitting in `data/` and counted beside published ones.

**ROADMAP #547 is fixed in source:** `engine/diff_swarm.js:290 function poolSources(storeDir)`,
`:361 source_digests: RS.sourceDigests(poolSources(storeDir))`, `:365 store_dir`. The register row
reads `closed — FIXED 2026-09-06 by MEASURE`. **The on-disk receipt was not located by this review**
(no cache file under `data/team-pool-frozen/`, and the cache path is computed) — verification
against the artifact is in OWED. **DEFER WITH REASON** unless the 6.0.0 re-run's own receipt shows
`store_dir: data/team-pool-frozen` beside a frozen-store digest; check that on the first re-run.

---

## 6. THE 6.0.0 DOCUMENT PASS, and the BASIS

Re-derived 16:04Z–16:40Z:

| question | count | source |
|---|---|---|
| figures resting on a withheld artifact — whole corpus | **71** across 64 withheld artifacts | `docs_scan --quarantine` |
| … in the living set | **13** | `major_readiness` |
| stale citations (living set; all 84 are in it) | **84** | `docs_scan --quarantine` `cited-artifact mismatches: 84`; all map onto `data/docs-currency-baseline.json` keys, so `test-docs-current` passes them |
| untraceable — corpus / living set | **23** across 3 docs (MODELS 13, whitepaper 9, ARCHITECTURE 1) / **22** | `docs_scan --quarantine`, `major_readiness` |
| figure-level edits in the living set | **119** across 5 documents | `major_readiness` |
| notes rows owed to the next major | **51 of 100** (scope report said 42) — oldest 2026-09-06, documents last folded at 5.266.0, CHANGELOG top 5.274.0 | `docs_scan --owed` |
| retracted figures restated as fact | **0** (registry of 10) | `docs_scan --quarantine` |
| release ids cited in living docs + ledgers that no longer resolve | **0** of 29/19/15/15 (whitepaper/technical/SUMMARY/MODELS) and 164/31/4 (ENGINE/MEASURE/SEARCH) | grep against `data/releases/` |
| PDFs to rebuild | not re-derived (`build_pdfs.js` does a full build on an unrecognised flag; scope report said 11) | — |

**The basis.** `major_readiness` says: *NOT READY. The gate is shut, so there is no basis change to
release — 6.0.0 would be a major that moves nothing a reader depends on.* That is only half the
page. `docs/RUNNING-NOTES.md` already carries **two rows declaring `Basis. CHANGED`**, both under
`[Unreleased]` so clause 5d has never judged them:

- `:366` (2026-09-07, turn cap 20 → 50): *"a reader can no longer be told that a board-material
  figure covers whole games … whoever cuts the version owes it `X.0.0` with the document set folded
  in, or must show the samples identical."*
- `:444` (2026-09-07, spread-target die): *"the dice addressing moved, so a board-material or
  protocol level measured before this fix cannot be quoted in the same series as one measured after
  it."*

So the honest position is the opposite of "nothing to release as a major": **two basis changes are
already declared and owed an `X.0.0`, and the gate is not one of them yet.** What has to be true
for 6.0.0 to be a legitimate `X.0.0` rather than a backlog flush:

1. A `6.0.0` row on the notes page declares `**Basis.** CHANGED — …` naming what a reader can no
   longer be told. The two rows above supply that text today; the gate opening would supply the
   archetypal one if the narration clause closes first.
2. The full document set is folded in from the 51 owed rows in the same commit (the floor raises
   with the `X.0.0` entry).
3. The release states, in words, that it is a **partial lift**: 40 artifacts re-run, 24 stay
   withheld because their generator reaches the paused MAG weights or is MILTANK (`major_readiness`
   names all 24), and the narration gate is still shut if it is.
4. Every figure in the living set that rests on one of the 24 comes OUT (not captioned), and the
   84 stale citations are rewritten to the re-run artifacts.

Severity: **BLOCKS 6.0.0** until (1) is written — 5d refuses an `X.0.0` with no basis declared
(§11) — and **SHOULD FIX BEFORE** for (3)/(4).

---

## 7. THE RE-RUN PLAN — verified against `major_readiness` today

`major_readiness`: **40 LIFT / 24 STAY** over 64 withheld (plan said 39–40 / 22–24 — matches). The
24 STAY are named in its output and are the same set the plan lists plus `rollout-r3`,
`exploit-step-probe-reparam`, `exploitability-machamp/mag`, `policy-weights-joint-presheet`.

**Misfiled in LIFT — reaches MAG or MILTANK through a `require`, which the predicate does not
follow** (`reachesPausedWeights` greps the generator's own source for the literal
`policy-weights.json`, and `/miltank/i` against the generator's PATH only):

- **`engine/mew.js`** → `data/ab-batch-effect.json` (and MEW's other outputs): `:376 return
  require('./magnemite.js').makeScoringPlayer()`, `:661 require('./magnemite.js').loadWeights(…)`,
  `:550 const MT = require('./miltank.js')`. MEW is the H2H harness *between models*; its `score`
  player IS MAG. **Move to STAY.**
- `build/build_mew_bundle.js` → `data/mew.js`: re-bundles `data/games.selfplay.jsonl` — games
  already played by MAG-era bots. Re-running it lifts nothing about the engine; it is a viewer
  bundle of old games. Harmless but should not be reported as a quarantine lift.
- `engine/backtest_winrate.js`, `engine/leaf_engine_contrast.js`, `engine/bench_speed.js` import
  `miltank.js` for `DEFAULTS` only (config read, no search) and score the rollout leaf
  (`rollout_leaf.js` → `medicham2` + `board.js`; no weights). **Correctly in LIFT**, but by reading,
  not by the predicate. `backtest_winrate.js` is MEASURE's standing priority and its last artifact
  is `2026-08-04T07:09`, `runtime_seconds 1046`, `n_games_scored 1378`, `rollouts_per_game 200`,
  **no release stamp** — it must carry `--release b730e44f3314` this time.
- `engine/rollout_r1_artifact.js`, `rollout_r2.js`, `rollout_r4.js` are in today's LIFT and were
  **not in the plan's 25**. None requires `magnemite`/`miltank` or names the weights (grepped), so
  they are correctly LIFT — but they are the R1/R2/R4 measurements and they play rollouts.

**Machine time, from artifacts that record it:** `game_differential` `elapsed_s 124` (already
current); the three roster stages completed within 55 s of each other (11:54:46Z → 11:55:41Z;
already current); `all_mechanics_fire` `seconds 5.4 + 9.4 + 4.6` staging over 1,313 games (already
current); `winrate-backtest` **1,046 s**; `leaf-position-contrast` 14 s; `replay-differential`
4.8 s; `medicham-bench` 120 games. **14 of the 23 LIFT generators record no timing** (`mew.js`,
`bench_speed`, `rollout_explore_sweep`, `speed_vs_pokeenv`, `rollout_r1/r2/r4`, `feature_*`,
`collinearity_*`, `click_census`, `immunity_sweep`, `lookahead_cost`, `pp_board_probe`,
`redirect_audit`) and several are rollout sweeps. **Recorded total ≈ 20 minutes; the rest is NOT
DERIVED.** Run the rollout family one at a time through `tools\lownode.cmd`; two of the four
instruments this review ran died at a 2–3 GB heap while the suite was resident, on a 13 GB box.

Severity: **SHOULD FIX BEFORE** — `mew.js` must leave the RUN list, and the predicate should follow
one hop of `require` so the split is derived rather than eyeballed.

---

## 8. THE FEATURE SEMANTICS CHECK on `data/policy-weights.json`

`node engine/status.js` (no `--write`) prints first, outside every section block:

```
FEATURE SEMANTICS CHECK FAILED — data/policy-weights.json
  the fixture itself changed (rounding 6 -> 6, scenarios 10 -> 12). Old hashes cannot be compared …
  the DAMAGE TABLE these weights were fitted against has been regenerated (318 species -> 322,
  digest 405c836793d1 -> 9d289cf77e24).
  GATES THAT FIRED: fixture identity, damage table. A RESTAMP ANSWERS THE FIXTURE GATE AND SILENCES
  THE TABLE GATE — settle the table verdict first, or the evidence for the refit is written over.
```

and at line 758: `REFIT OWED — weights fitted 2026-08-28 15:46`.

**Disposition: correctly WITHHELD, not noise.** `data/policy-weights.json` is in the 24 STAY set
(`major_readiness`), so nothing it feeds is printed anywhere; the block is deliberately placed
outside the `<!-- GENERATED -->` sections so `--write` never stamps it into a ledger (`status.js`
comment at 1338/1372/1409). It is the one edge provenance cannot see (engine source → fitted
weights) and it is the honest state: the damage table under the weights moved. **Do not restamp**
— the print says why in its own last line. What 6.0.0 owes is one sentence in the release note:
the MAG weights are withheld for two independent reasons (quarantine; damage table 318 → 322
species) and the refit is sequenced after the major. **DEFER WITH REASON.**

---

## 9. The 19 `is present but unparsable` warnings

`engine/docs_scan.js:449-455`: an unparsable artifact returns `null` = "cannot judge", cached so the
warning prints once per file. At `:803` a figure's cited artifacts are filtered to the parsable
ones and **`if (!sets.length) continue;`** — a figure whose ONLY citations are `data/*.js` files is
skipped from the stale-citation scan and from the untraceable census alike. So it is a real gap,
bounded: lines in the living set that cite one of the 19 and no `.json`, and carry a figure:
**whitepaper 1** (`:181`, a withdrawal notice), **technical-docs 0**, **deck 0**, **SUMMARY 2**
(`:1366`, `:1415` — `data/live.js` battle counts), **MODELS 4** (`:181`, `:1463`, …). Seven lines,
of which the `data/live.js` counts in SUMMARY are the only ones that read as published figures
nothing scores. The 19 files are `window.X = …` / `/* GENERATED */` browser bundles, five of which
`artifact_audit.js` already compares to their JSON source (`abra-tags`, `engine-data`, `guru`,
`mega-formes`, `move-effects`) and five have a builder with no `--check` (`abra-meta`, `board-data`,
`mag`, `mew`, `status`). **DEFER WITH REASON** — the fix is to resolve a `.js` citation to its JSON
source in `docs_scan`, and it is 7 lines of exposure; but it is a gap, not noise.

---

## 10. RETRACTION — "about one in six" / "3 of 19"

- `docs/RUNNING-NOTES.md:83` (batch W row): `~~3 of 19 causes, about one in six~~ retracted, the
  measured figure is 2 of 19`. Correct by the page's own convention (the superseding row strikes it).
  The batch V row at `:91` still carries the words unstruck, which is how this page works.
- `CHANGELOG.md:78` (5.273.0) retracts; `:122-125` (5.272.0) is the historical entry. Correct.
- **`docs/ENGINE.md:404`**: a section heading **`### HOW MANY MORE CARDS ARE HIDING? ABOUT ONE IN
  SIX`** with `:411-412` *"3 of the 19 causes this batch started with … on this sample the gap is
  about 3 causes. 6.0.0 should say so in those words."* — **not struck, not captioned**; the
  retraction sits ~100 lines earlier in the batch-W block at `:310`. The derived retraction registry
  (`docs_scan`, 10 entries) cannot see it: "one in six" is words and "3 of 19" is two integers
  below its floor. `web/` carries no copy.

The ENGINE ledger is a working document with no PDF, but it is a living document under the
docs-currency rule and it instructs 6.0.0 to print a retracted rate. **SHOULD FIX BEFORE** (ENGINE's
file; one strike-through and a pointer to `:310`).

---

## 11. Clause 5d — would a `6.0.0` entry pass today?

`node tests/test-docs-current.js` → `ok every released row's version agrees with the basis and
supersession it declares (3 of 51 row(s) matched a CHANGELOG release; top 5.274.0 is a minor
bump)`. **48 of 51 rows are `[Unreleased]` and unjudged** — the notes rows are not being versioned
when the CHANGELOG is bumped, so the clause has checked three rows all sprint.

`engine/docs_scan.js majorPolicy()`: an `X.0.0` whose row does not declare `Basis. CHANGED` is
`major_without_basis`; a row declaring CHANGED released as anything else is
`basis_change_not_major`. Therefore:

- a `6.0.0` entry today with the current rows (every versionable one reads `Basis. unchanged`)
  **FAILS** on `major_without_basis`;
- versioning the two 2026-09-07 rows (`:366`, `:444`) under any `5.x` **FAILS** on
  `basis_change_not_major`;
- versioning them under `6.0.0` with the `Basis. CHANGED` text they already carry **PASSES**.

Standalone, the file reported **32 passed, 1 failed** on clause 2b: `docs/THESIS-DEFENCE-REVIEW-
2026-09-09.md` has no version header and is not in `data/docs-currency-baseline.json` (baseline 57,
now 58). It passed inside the suite at 16:04Z; the file was written at 12:25 local by another agent
in this round. **That test is red on the next suite run.** **SHOULD FIX BEFORE** (version header or
exemption, by whoever owns the file).

---

## 12. Everything else seen

- **The suite and the instruments write to the tree.** `git status` at the end of this review: 15
  tracked files modified by the suite and by `provenance.js` — `data/engine-release.json` (pointer
  `cuts 2 → 27`, `latest_cut` moved), `data/conformance.json`, `data/damage-validation.json`,
  `data/forme-assert.json`, `data/game-diff.json`, `data/job-costs.jsonl`,
  **`data/mechanics-census.json`** (rewritten by `tests/test-arm-steering.js`: `generated 11:54:09Z
  → 16:21:25Z`, one detail string `Iron Head 20.3% → 20.5%`), `data/open-work.json`,
  `data/provenance-stamp.json` (`generated`), `data/quarantine-stamp.json`,
  `data/regulation-usage.json` (1,749 lines), `data/rulebook-collision.json`,
  `data/switch-back-renamed.json`, `data/tag-consumption.json`,
  `data/verification/engine-diff.suite.json`. The five gate artifacts were not touched (mtimes
  unchanged at 16:42Z). **A test rewrote a gate-input artifact** — the census
  is credited-only for the differential but it steers `all_mechanics_fire.js` and is the census pin
  everybody is told to carry. Reported, not reverted (LESSONS §11). **SHOULD FIX BEFORE**: a test
  must not write a pinned artifact.
- **Other agents wrote during the measurement round:** `docs/THESIS-DEFENCE-REVIEW-2026-09-09.{md,html,pdf}`,
  `docs/_reports/2026-09-09-pre-600-{causal-and-boundary,engine-review,ops-review}.md`,
  `docs/_reports/2026-09-09-thesis-defence-notes.md`, and a **git worktree at
  `.claude/worktrees/agent-af59bcfe6a6444960`** (created 12:05 local, at `d6789951`). None is a
  frozen source and the tree digest held; but the worktree sits INSIDE the repo directory and
  `tests/test-fixture-legality.js` walked it as repository source (§1.B), so a parallel agent's
  checkout can make the main tree's suite red. Noted because the brief said only MEASURE plays
  games, not that nobody writes or checks out.
- **`--games 960` beside `--games 1200`** appears in the whitepaper (`:17`), technical-docs (`:21`)
  and SUMMARY (`:25`) — all three inside the paragraph that DIAGNOSES the 777-vs-961 sample as the
  `--games` flag. Explained side-by-side, not a defect.
- **The 100 MB wall for `data/games.ladder.jsonl.gz` is retired for the store.** The `.gz` is
  untracked at HEAD (`git ls-files` empty); its last tracked blob was **54,323,899 B** at
  `d2a418a5` (2026-09-06). Ingest now lands dated shards — `data/parsed/games.ladder/*.jsonl.gz`
  nine initial shards of ~4.0 MB plus hourly ~67 KB (`a07c00a4`), `SHARD_BYTES` capped
  (`build/compress-stores.js:53`). The largest tracked blob at HEAD is `data/games.r4-decided.jsonl`
  at **44,940,683 B**. The local plain stores are 383 MB / 227 MB and untracked.
- **`web/build-quarantine.js --check`: 2 DRIFTs** (`web/quarantine-data.js`, `web/stadium.html`
  inline block) — web is paused; the site is not what the builder would emit today.
- **`no open, known engine defect` reads verdicts generated `2026-09-08T16:34:05Z`** — one day and
  seven engine commits older than the engine it clears. `register_reality.js --list` wipes the
  artifact and was correctly not run here; the clause's evidence is stale by a day.
- **`data/winrate-backtest.json` — MEASURE's own number — is dated 2026-08-04, 40 rollouts per game
  in the 350-game arm, no release stamp.** It is in LIFT; it is the first thing MEASURE should run
  once the re-run starts, at the current leaf, with the reliability curve published rather than a
  verdict string.
- **Instruments that died this session at default heap:** `engine_release.js census`,
  `engine_release.js compat` (even at 3 GB), `tests/test-artifact-rerunnable.js` standalone (passes
  at its declared 6144 inside the suite).

---

## Ranked list — MEASURE-owned, before 6.0.0

**BLOCKS 6.0.0 — 3**
1. §1 — **27 red checks of 177, none waived by name.** 8 follow from the two owner pauses (web,
   MAG) and need a one-line named waiver each at the cut; 17 are instrument/docs/store reds, two of
   them MEASURE's to clear (`test-docs-quarantine`: withheld MILTANK figures in
   `docs/RUNNING-NOTES.md:286`; `test-quality`: the recorded clean-share funnel is 3.3 pts off its
   own store); 2 are ENGINE's (`gate_fail_and_silent` live `-fail`; `pinch-family` firemane).
2. §6/§11 — no `Basis. CHANGED` declaration exists that a `6.0.0` row could be released under, so
   clause 5d refuses the entry; two already-declared basis changes sit unversioned on the notes page
   and would refuse any `5.x` instead. Write the 6.0.0 row's basis.
3. §6 — the release must say PARTIAL LIFT in words: 24 artifacts stay withheld (the MAG/MILTANK
   family), the 13 living-set figures resting on them come out, and the narration gate is shut.

**SHOULD FIX BEFORE — 9**
4. §3 — the one-sentence bound on "0 of 958" is owed to every living document.
5. §7 — `engine/mew.js` is in LIFT and loads MAG through `magnemite.js`; move to STAY and make the
   predicate follow one hop of `require`.
6. §12 — `tests/test-arm-steering.js` rewrites `data/mechanics-census.json`; the gate run carried
   no census pin (`steering.pinned false`). Pin it on the re-run; stop the test writing it.
7. §4 — `engine_release.js census`/`compat` cannot run over 636 releases at default heap; the
   all-releases stranded count is NOT DERIVED and the last census is 2026-08-11.
8. §10 — `docs/ENGINE.md:404` heading carries the retracted "one in six / 3 of 19".
9. §11 — `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md` reds clause 2b on the next suite run.
10. §7 — `backtest_winrate.js` re-run with `--release`, publishing the reliability curve.
11. §12 — `register-reality.json` verdicts are a day older than the engine they clear.
12. §1.B — `engine/provenance.js` as a gate is red by construction until the re-run; say so in the
    release or it is "one of the known failures" again.

**DEFER WITH REASON — 5**
13. §8 — FEATURE SEMANTICS on `policy-weights.json`: correctly withheld; MAG after 6.0.0; never restamp.
14. §4 — the nine CRLF sources: pinning moves every release id; the read side is already EOL-insensitive.
15. §5 — #547 on-disk receipt: verify on the first pinned re-run rather than staging one now.
16. §9 — `docs_scan` skips figures cited only to `data/*.js`: 7 lines of exposure.
17. §12 — web quarantine drift and the four web tests: web is paused by the owner.

---

## OWED, NOT RUN

```bash
# 1. The release census, at a heap it can finish on (default 2 GB died at 177 s over 636 releases).
#    Declare ABRA-HEAP in engine/engine_release.js so lownode/run-all derive it; until then:
node --max-old-space-size=6144 engine/engine_release.js census            # dry run; add --write to publish
node --max-old-space-size=6144 engine/engine_release.js compat engine/medicham2-browser.js

# 2. The two MEASURE-owned reds, re-run after the fix (a withheld figure out of the notes row;
#    the quality funnel restamped on the grown store):
node tests/test-docs-quarantine.js
node tests/test-quality.js

# 3. MEASURE's own number, at the current leaf, stamped, reliability curve not verdict string:
tools\lownode.cmd engine\backtest_winrate.js --release b730e44f3314

# 4. #547 receipt check on the first pinned re-run — the pool cache header must read
#    store_dir "data/team-pool-frozen" and a frozen-store digest (games.bo3.jsonl 109,006,606 B):
tools\lownode.cmd engine\game_differential.js --steering empirical --release b730e44f3314 --arm middle --end-state --census data/verification/census-pin-9446a684709d.json --games 1200 --turns 50 --team-store data/team-pool-frozen --write
#    then read `steering.pinned`, `steering.team_store_pinned_to` and the pool cache's `store_dir`.

# 5. The rest of the LIFT list, one rollout-family generator at a time, each with --release <id>;
#    derive the list rather than pasting it, and drop engine/mew.js and build/build_mew_bundle.js:
tools\lownode.cmd engine\major_readiness.js

# 6. The register-reality verdicts behind the "no open, known engine defect" clause are a day old:
node engine/register_reality.js --list                                    # WIPES the verdict artifact; owner's call

# 7. The docs-currency baseline for the new unversioned document (owner of that file):
node tests/test-docs-current.js
```
