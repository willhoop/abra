# 2026-09-11 — Register plan: the 44 debt rows and the 6 stale-green rows

MEASURE, planning only. This pass wrote this file and nothing else. It ran no git writes, played no games and did not run `engine/register_reality.js`.

## What was read, and when

| Input | How it was read | Stamp |
|---|---|---|
| The open-defect clause | `openDefectClause()` from `engine/quarantine.js`, which uses `roadmapRowIsClosed` | live `docs/ROADMAP.md`, 2026-09-11 ~02:45 EDT |
| `docs/ROADMAP.md` | The working tree. Its only uncommitted change touches #571, #583 and #584, so every row below is byte-identical to HEAD | HEAD `ea437935` |
| `data/register-reality.json` | `git show HEAD:` | generated 2026-09-11T03:51:11Z |
| `data/game-differential.json` | `git show HEAD:` | 2026-09-11T03:16:02Z, release `5973a4e3c768` |
| `data/roster.{moves,items,abilities}.json` | `git show HEAD:` | 03:14–03:17Z, release `5973a4e3c768` |
| `data/all-mechanics-fire.json` | `git show HEAD:` | 03:18:26Z, release `5973a4e3c768` |
| `data/engine-diff.json` | `git show HEAD:` | 03:12:01Z, release `5973a4e3c768` |
| `data/tags.json`, `data/tag-consumption.json` | `git show HEAD:` | — |
| Engine source | `git show HEAD:engine/medicham2-browser.js` (46,462 lines). Every line number below is from HEAD. | HEAD `ea437935` |
| Authority | the sibling `pokemon-showdown` checkout, read directly | — |

**AN ENGINE AGENT IS LIVE.** The working tree is ahead of HEAD by:
- `engine/medicham2-browser.js`: +360 lines
- `tests/test-mechanics.js`: +319 lines
- `tests/probe_red_demo.js`: +60 lines

Nothing below cites those uncommitted bytes as a fix. The one row they touch (#541) says so.

**The list moved since the brief.** It still has 44 debt rows. It now has 6 stale-green rows, not 7: #389 is closed, and its marker reads CONFIRMED in the 03:51Z artifact.

## Verdicts

| Verdict | Rows | Count |
|---|---|---|
| **ALREADY FIXED** — closable now on evidence already on disk | #218 #289 #314 #319 #370 #413 #438 #439 #542 | 9 |
| **ALREADY FIXED** — closable after one run of an existing instrument | #175 #220 #334 #361 #362 #365 #369 #393 #403 #530 | 10 |
| **ALREADY FIXED** — closable after a small new check, which plays no game | #300 #301 | 2 |
| **NOT A DEFECT / STALE** | #315 #364 #446 #500 #549 | 5 |
| **STILL TRUE, INSTRUMENT OWED** | #310 #318 #323 #325 #348 #349 #350 #375 #380 #399 #412 #425 #440 #442 #467 #511 #524 #529 #535 #541 | 20 |
| **CANNOT TELL WITHOUT RUNNING** | #397 #400 #421 #441 | 4 |

If all of this is applied:
- **Debt** drops from 44 to 22 (18 still-true rows plus the 4 cannot-tell rows).
- **Stale-green** drops from 6 to 2: #412 and #440. Both carry markers that ask nothing (see Finding 2).

### What this does to the gate

The clause is **green today**: 0 open rows name a RED instrument, and debt never holds it shut.

**Writing the owed ENGINE probes will turn it RED, and that is the intended direction.** The rows concerned are #535, #541's fainting-holder half, #511 once it is run in `--declared-red` mode, #440, and #364, #397 or #400 if they read red. Each of those rows then holds the clause shut on a measurement rather than a sentence. Say this before the batch, not after it.

## Findings that are not about one row

1. **Three rows count as breakage only because of a word in a negated or stale sentence.**
   - **#364**'s cell says *"no DEFECT token"*, and that is the token.
   - **#500**'s cell says *"NOT A MEASURED DEFECT"*. `\bNOT A DEFECT\b` does not match that phrase, so the bare `DEFECT` inside it counts.
   - **#542** counts through *"an engine DEFECT hypothesis"* — a hypothesis that has since been confirmed, applied and closed.

   This is the same class as the `/NOT A DEFECT/i` override. Found with a scratch reader applying the clause's own cell regex and prose vocabulary to each row.

2. **Three markers read green without deciding their row.**
   - **#439 and #440** name `engine/game_differential.js --arm middle --team-store data/team-pool-frozen`. That script exits 0 on any divergence by design, so it could never have read red on either row.
   - **#412**'s instrument, `tests/test-effective-identity.js`, is green only because `RUNTIME_ALLOWED` (lines 528–539) declares the exact defective line.

3. **The pinned pool is nearly silent now.** On release `5973a4e3c768`, `data/game-differential.json` reads:
   - 961 games, 1 protocol divergence;
   - 961 of 961 boards never parted;
   - 0 void;
   - the plant proof is sound: 42 plants, all caught.

   So every "N board-material games of 961" figure in #361, #403, #541 and #542 is **absent from the pool**. The pool cannot tell a fixed mechanism from one that is no longer reached. The lab probes decide those rows, and several have not been run since their fix.

4. **The one surviving divergence is #440's closeted perish family.** The cause is `event missing from medicham2`, upkeep against faint, game `omit-spread`, turn 12. The authority's last lines before it are three `perish0` starts, which is the shape the `CLOSETED` row matches.

5. **Two test comments cite the wrong register rows.** Reported here, not edited.
   - `tests/test-mechanics.js:3436` says "ROADMAP #361" about a body that is no longer on the field.
   - `tests/test-mechanics.js:7389` and `:7440` say "ROADMAP #362" about a status move walking past Follow Me.

   Neither subject is row #361 or row #362, and no register row carries those titles. Anyone grepping those numbers will land on the wrong probe.

6. **One residual that is not #365's claim.** `declared_gaps.forced_switch_unmirrorable` reads **6** on release `5973a4e3c768`. The first entry is *"slot 1 holds staraptor, which showdown has FAINTED"*, which is a board parting, not the name key #365 was about. Check whether a row owns it before filing one.

## Per-row table

**Decides it** names the command a `VERIFIED BY` should carry. A bracketed decider means none exists yet.

| Row | Verdict | Evidence, read from the tree and HEAD artifacts rather than from the row | Decides it |
|---|---|---|---|
| #175 | FIXED, owed run | HEAD `data/tag-consumption.json` (2026-09-10T20:25Z) has a dead floor of 5, and **none** of the row's 23 tags is in it. | `node tests/test-tag-consumed.js` |
| #218 | FIXED, green | The gate clause exists and exits 0 (register-reality 03:51Z). Boards 961/961. | `node engine/quarantine.js --whole-game` (already on the row) |
| #220 | FIXED, owed run | The cause was the stall die's ADDRESS in the middle arm — zero in both corner arms (header of `tests/test-middle-stall-address.js`). The HEAD differential has 0 `-singleturn` causes. | `node tests/test-middle-stall-address.js` |
| #289 | FIXED, green | The move-primary sites landed 2026-08-23 (`tests/test-mechanics.js:30699-30714`: Parting Shot and Charm, via `sc.target` and `boostsTarget`). The ability sites are covered by `tests/probe_ability_zero_boost_line.js`. `test-mechanics.js` was green at 03:51Z. | `node tests/test-mechanics.js` |
| #300 | FIXED, check owed | `let MID_WRAP_ERROR = null` sits at `engine/game_differential.js:439`, above the assignment at `:543`. No arm exercises the bad-path branch. | [new `tests/test-midwrap-error-path.js`] |
| #301 | FIXED, check owed | The miss counts are published at `game_differential.js:9378-9381`. On `5973a4e3c768` they read medicham 0 / showdown 0. Nothing fails on them. | [new `tests/test-switch-lookup-zero.js`] |
| #310 | STILL TRUE | `engine/rollout_leaf.js:1327` and `:1395` call `battleInit` with no `rng`, so `traceChoiceNoDie` still counts in every rollout. The row defers this by cost, and it is a LEAF-side defect. | [owed] |
| #314 | FIXED, green | HEAD plant proof: 42 plants, each caught with `moved_a_compared_leaf: true`, 7 of them party/bench plants. `planted_state_proof_ok` and `mappings_all_proved` are both true. `quarantine.js:2392` makes the clause CANNOT-ANSWER if either is false. | `node engine/quarantine.js --whole-game` |
| #315 | NOT A DEFECT | The revert (`sim/battle.ts:2555-2571`) is gated on `formeRegression`. The Champions `formeChange` sets that flag in the Tera branch only (`data/mods/champions/scripts.ts:75-78`), not in the item/mega branch. The only other `sim/` setter is Morpeko's (`sim/battle-actions.ts:1962`). MEDICHAM's HEAD note at line 21938 says the same. The row read the mainline rule. | `node engine/quarantine.js --whole-game` (weak: pool coverage only) |
| #318 | STILL TRUE | `tests/roster.js` does not publish the learnset-refusal count. The HEAD roster artifacts carry no such key. | [owed] |
| #319 | FIXED, green | HEAD `roster.moves.json`: DIFFER 0, DID-NOT-FIRE 0. The five named entities read FIRED-AND-BOARDS-MATCH, and `bigroot` MATCHES in `roster.items.json`. | `node tests/roster.js --stage moves` (already on the row) |
| #323 | STILL TRUE | `tests/mutation_harness.js:907` still prints "Nothing in the simulator implements this fact." There is no sibling-tag column. | [owed] |
| #325 | STILL TRUE | There is no provenance-param skip beside `nestedParamsSkipped` and `nullParamsSkipped` (`mutation_harness.js:458`, `:1426`). | [owed] |
| #334 | FIXED, owed run | Both halves landed 2026-09-04: the address, and the dmg category via `around('getConfusionDamage','dmg',…)`. Header of `tests/probe_confusion_selfhit_address.js`. | `node tests/probe_confusion_selfhit_address.js` |
| #348 | STILL TRUE | `tests/test-lownode.js` has no space-argument arm and no drive-path arm. | [owed] |
| #349 | STILL TRUE | `engine/divergence_report.js:71` ranks on `max_uses` and prints no key naming which side's line it came from. Low stakes today: 1 divergence. | [owed] |
| #350 | STILL TRUE | `registerEvidence` (`quarantine.js:3157`) still sends "no marker" and "marker but no verdict" to one `debt` bucket. It prints no artifact age against ROADMAP. It mis-buckets **nothing today**: no debt row carries a backticked marker. | [owed] |
| #361 | FIXED, owed run | The M1 fix is at HEAD line 4336. `tests/probe_multiaccuracy_address.js` stages both legal `multiaccuracy` carriers. Neither is a HEAD cause. | `node tests/probe_multiaccuracy_address.js` |
| #362 | FIXED, owed run | `battleResult` (HEAD 45295) reads `lastFaintSeq` from `noteFaint`. `tests/probe_selfdestruct_winner.js` runs `w3-simultaneous` as a must-agree arm. | `node tests/probe_selfdestruct_winner.js` |
| #364 | NOT A DEFECT (unmeasured) | Its own words: *"NOTHING HERE CLAIMS THEY ARE WRONG."* It counts only via Finding 1. The probe is still owed. | [owed] |
| #365 | FIXED, owed run | The mirror keys on `rosterKey` (`game_differential.js:5234-5241`). Lookup misses read 0/0. Pinned by `tests/test-roster-identity.js` and `tests/test-forced-switch-mirror.js`. | `node tests/test-roster-identity.js` |
| #369 | FIXED, owed run | `--list` exits before any write (`register_reality.js:1356-1358`). The selftest booby-traps `writeFileSync`. `tests/test-register-reality-readonly.js` cites #369. | `node tests/test-register-reality-readonly.js` |
| #370 | FIXED, green | `restatesFigure` accepts a shortened figure only where truncating and rounding agree (`docs_scan.js:743-759`). There is a 3-significant-figure floor on percents (`:650`). `RETRACTION_CASES` are asserted at `tests/test-docs-current.js:526`, which was green at 03:51Z. | `node tests/test-docs-current.js` (the oracle is wider than the row) |
| #375 | STILL TRUE | The caps remain: `first_divergences` `.slice(0,60)` at `:9567`, `first_board_divergences` `.slice(0,40)` at `:8446`. No bite today. | [owed] |
| #380 | STILL TRUE (1 of 3 fixed) | (1) Fixed: the sentence now reads "ASKED AND ANSWERED NOTHING USABLE". (2) Still true: `ok` ignores `unrunnable`. (3) Still true: `classifyExit` lives at `register_reality.js:511`, and `run-all.js` does not import it. | [owed] |
| #393 | FIXED, owed run | CONTROL FIX 14 runs `ModifyMove` (`tests/test-engine-diff.js:558-590`). HEAD `engine-diff.json` reads 6,000 compared, 0 disagreed. | `node tests/test-engine-diff.js --out data/verification/engine-diff.register.json` |
| #397 | CANNOT TELL (1 of 3) | **Sand Spit**: fixed, `tests/probe_punish_side_and_sky.js` E2. **Protean**: fixed, `probe_red_demo.js` ARM `typeBecomesMoveType`, green at 03:51Z. **Psychic Terrain**: the shared priority reader landed and `galewings-psychicterrain` is a red arm, but **no arm stages a Prankster status move into a grounded foe under the terrain**, which is the row's case. | [one arm owed] |
| #399 | STILL TRUE | `engine/divergence_cards.js` prints the dump's release (`:336`) and never compares it with the differential's. | [owed] |
| #400 | CANNOT TELL | (b) is the second-turn Phantom Force lock. `tests/probe_charge_release_chosen_slot.js` (#551) fixed the release slot, which is plausibly the same road. No plain two-turn arm asserts damage on turn 2. | [one arm owed] |
| #403 | FIXED, owed run | At HEAD `redirectDrawnTo(m,targets[0],…)` is at line 34787, above the `failsIfTargetNotAttacking` refusal at 35231. `tests/probe_sucker_redirect_refusal.js` (M5) has arm 4 as a control over the queue clause. | `node tests/probe_sucker_redirect_refusal.js` |
| #412 | STILL TRUE | `engine/position_features.js:249` still reads the declared ability raw. The test is green only through the allowlist entry. Exposure is zero, re-derived by that entry's guard. | fix, then drop the allowlist entry → `node tests/test-effective-identity.js` |
| #413 | FIXED, green | Re-aimed 2026-08-26 under #449 with a third edit (`probe_red_demo.js:3149-3161`). The probe exits ABRA-EXIT 1 on any HOLLOW row, and it was green at 03:51Z (#273/#449 CONFIRMED). | `node tests/probe_red_demo.js` |
| #421 | CANNOT TELL | Both rows now read DEFERRED-BY-OWNER on a store click count: 2 and 18 clicks, under a shelf of 25. That rule does not depend on the invocation, so the row is probably stale — unproven. | run `--stage all` and the per-stage run on one release |
| #425 | STILL TRUE | `all_mechanics_fire.js:92` still defaults `--kind` to `moves`. | [owed] |
| #438 | FIXED, green | HEAD AMF `magicbounce`: board NO-DIVERGENCE, 5 of 5 boundaries, empty diffs, control arm the same. The fixing change was not identified in this pass. | already on the row |
| #439 | FIXED, green | The cause is absent from the HEAD differential, and board-material reads 0 of 961. The marker must be re-pointed (Finding 2). | `node engine/quarantine.js --whole-game` |
| #440 | STILL TRUE | It is the only HEAD divergence (Finding 4) and it is closeted by Will. Its marker asks nothing. Related: #584. | [owed] |
| #441 | CANNOT TELL | No per-game reset of the tie key or the address log was found by symbol. | play one pair alone vs at position N |
| #442 | STILL TRUE | No check regenerates the census from the committed tree and compares it. | [owed] |
| #446 | NOT A DEFECT | The runner half closed 2026-08-27. The header of `test-resolution-order.js` (lines 12-15) declares per-arm snapshots by design, plus `ABRA-HEAP: 6144`. `run-all.js` honours the heap declaration, and so does `register_reality.js:333-354`. | `node tests/test-resolution-order.js` |
| #467 | STILL TRUE, part (b) only | No `void_n` is written beside `n`. No bite today: `void_games` 0. | [owed] |
| #500 | NOT A DEFECT | HEAD `data/tags.json` has five `buffsHolderOnHit` members, and exactly one is crit-conditioned: `angerpoint`, `boosts {atk:12}`, which saturates. So `some(Boolean)` is exact in this format. It counts only via Finding 1. | [new `tests/test-crit-reaction-saturates.js`] |
| #511 | STILL TRUE | The Endure road is DECLARED OPEN in `tests/probe_volley_collapse.js:389-393`. `hitCountDroppedOnCollapse` still counts at HEAD lines 38139 and 38945. The probe is green only because its declaration holds; #526 uses the same command. | [flag owed] |
| #524 | STILL TRUE (5 of 12 converted) | 7 COULD-NOT-STAGE → `process.exit(0)` paths remain: `probe_hazard_recap_fail.js:110`, `probe_protect_stage_order.js:109`, `probe_sound_lock_restart.js:108,188,197`, `probe_trap_timing.js:117,151`. | [owed] |
| #529 | STILL TRUE (derivation half) | HEAD `tags.json`: `bugbite` and `pluck` still read `takesTargetItem {consumesAndGainsEffect:false, removes:true}`. The ENGINE half **is fixed in code** at HEAD lines 41586-41590 by a class-guard fallback, counted as `MEDFAILS.stealEatViaClassGuard`. No probe asserts the eat. | [owed] |
| #530 | FIXED, owed run | `data/rollout-switch-census.json` is in `SOURCES` (`engine_release.js:199`, 2026-09-08), asserted by `tests/test-engine-release.js:451-466`. | `node tests/test-engine-release.js` |
| #535 | STILL TRUE | HEAD line 17811 still pushes the doubling off the CURRENT ability. Two legal doors exist: Skill Swap, and a contact hit into a Wandering Spirit holder. Unburden's 5 legal carriers were derived. | [owed] |
| #541 | STILL TRUE, 1 of 3 halves | At HEAD the announcement uses the authority's field order (`TR.abswap`, line 39636) and both `Start`s run (39637). `tests/probe_contact_ability_transfer.js` has a no-contact control. **The fainting-holder window is wrong at HEAD** (`_abStart` refuses `curHP<=0`, ~39606) and is being fixed **right now in uncommitted bytes** (a 2026-09-11 note in the working tree). | after that commit lands, the probe plus a fainting-holder arm |
| #542 | FIXED, green (fence) | (a) applied 2026-09-06; (b) re-filed as #544; (c) closed 2026-09-05. (d) is absent from the pool. | `node engine/quarantine.js --whole-game` |
| #549 | NOT A DEFECT / STALE | The row's own same-day correction refuted it. `leppaberry` now MATCHES in HEAD `roster.items.json`. What remains is an audit of COULD-NOT-STAGE reasons, which is a work item. | none — re-cell |

## Proposed row text

**Rules for the applier:**
1. Replace the **whole last cell**. Every cell below starts with `closed` or `open`, which is what `roadmapRowIsClosed` reads.
2. None contains a `|`.
3. Where a row already carries a marker, register_reality reads the FIRST `VERIFIED BY:` followed by a backtick. Demote an old marker by breaking that shape: write `FORMERLY NAMED:` and drop the backticks.
4. A closed row whose instrument is red reads PREMATURE CLOSE. Apply the "after one run" group only after the command in `## OWED, NOT RUN` exits 0 on the committed tree.

### Group 1 — closable now (green evidence already on disk)

**#218** — the marker is already on the row; keep it.
```text
closed 2026-09-11 — the gating half this row was filed for landed 2026-08-12 and the clause is green: node engine/quarantine.js --whole-game exited 0 in data/register-reality.json (2026-09-11T03:51:11Z), against data/game-differential.json (2026-09-11T03:16:02Z, release 5973a4e3c768, 961 games, 961 of 961 boards never parted, 1 protocol divergence). The 39.6% in the title is 480 of 1,213 RAW on release 5a557b07821c and is a before for no figure here. MEASURE 2026-09-11.
```

**#319** — this row's marker lives in its cell, so it is carried into the new cell.
```text
closed 2026-09-11 — VERIFIED BY: `node tests/roster.js --stage moves` — green in data/register-reality.json (2026-09-11T03:51:11Z). data/roster.moves.json (2026-09-11T03:17:49Z, release 5973a4e3c768): FIRED-AND-BOARDS-DIFFER 0, DID-NOT-FIRE 0, FIRED-AND-BOARDS-MATCH 487. dragoncheer, fakeout, psychup, transform and matchagotcha all read FIRED-AND-BOARDS-MATCH, and bigroot the same in data/roster.items.json. Not a before/after with 157 or 5: different release. MEASURE 2026-09-11.
```

**#438** — marker already on the row; keep it.
```text
closed 2026-09-11 — data/all-mechanics-fire.json (2026-09-11T03:18:26Z, release 5973a4e3c768) carries the magicbounce row, carrier espeon, control Synchronize: board NO-DIVERGENCE, 5 of 5 boundaries agreed, no diffs, and the control arm the same. node engine/all_mechanics_fire.js --kind abilities was green in data/register-reality.json (03:51:11Z). The vol.trapped leaf no longer parts. The change that fixed it was not identified in this pass. MEASURE 2026-09-11.
```

**#439** — RE-POINT the marker. Demote the existing `node engine/game_differential.js …` marker to `FORMERLY NAMED: node engine/game_differential.js --arm middle --team-store data/team-pool-frozen` (no backticks). Add to the row body: `VERIFIED BY: \`node engine/quarantine.js --whole-game\``
```text
closed 2026-09-11 — the cause is absent from data/game-differential.json (2026-09-11T03:16:02Z, release 5973a4e3c768, 961 games), whose only divergence is the perish upkeep-versus-faint cause #440 owns, and board-material reads 0 of 961. This row was board-material, so the board-material clause decides it. The old marker named engine/game_differential.js, which exits 0 on any divergence by design and could never have read red here. MEASURE 2026-09-11.
```

**#289** — add `VERIFIED BY: \`node tests/test-mechanics.js\``
```text
closed 2026-09-11 — both remaining sites landed 2026-08-23: the boostsTarget branch and a status move's declared drop (Parting Shot and Charm among them), recorded at tests/test-mechanics.js:30699-30714. The ability sites are covered by tests/probe_ability_zero_boost_line.js. node tests/test-mechanics.js was green in data/register-reality.json (2026-09-11T03:51:11Z). No divergence of this shape in data/game-differential.json on release 5973a4e3c768. MEASURE 2026-09-11.
```

**#314** — add `VERIFIED BY: \`node engine/quarantine.js --whole-game\``
```text
closed 2026-09-11 — both holes are closed in the comparator the gate reads. data/game-differential.json (release 5973a4e3c768) carries 42 plants, every one caught and every one recording moved_a_compared_leaf true, seven of them party plants. state.planted_state_proof_ok and state.mappings_all_proved are true, and engine/quarantine.js:2392 makes the whole-game clause CANNOT-ANSWER when either is false, so a hollow proof can no longer read green. tests/probe_bench_plants.js still exits 0 on a hole and is superseded rather than repaired. MEASURE 2026-09-11.
```

**#370** — add `VERIFIED BY: \`node tests/test-docs-current.js\``. This oracle is wider than the row: it fails on any docs clause. Batch A3 offers a narrow replacement.
```text
closed 2026-09-11 — engine/docs_scan.js:743-759 accepts a shortened retracted figure only where truncating and rounding give the same digits, and :650 sets a three-significant-figure floor on a retracted percent. The row's three cases are RETRACTION_CASES, and retractionProof() is asserted at tests/test-docs-current.js:526, which was green in data/register-reality.json (2026-09-11T03:51:11Z) as #390's marker. The oracle is wider than this row. MEASURE 2026-09-11.
```

**#413** — add `VERIFIED BY: \`node tests/probe_red_demo.js\``
```text
closed 2026-09-11 — the WIRE 7 Sitrus demonstration was re-aimed 2026-08-26 under #449 with a third edit that also removes the in-move Update pass, the second deliverer that had made it hollow (tests/probe_red_demo.js:3149-3161). The probe exits ABRA-EXIT 1 on any HOLLOW row, and it was green in data/register-reality.json (2026-09-11T03:51:11Z) as the marker of #273 and #449. MEASURE 2026-09-11.
```

**#542** — add `VERIFIED BY: \`node engine/quarantine.js --whole-game\``
```text
closed 2026-09-11 — the fence served and every bucket has a home: (a) Fairy Aura presence applied 2026-09-06 (tests/probe_fairy_aura.js); (b) re-filed as #544; (c) Mold Breaker through an ally's Friend Guard closed 2026-09-05 (tests/probe_moldbreaker_ally_guard.js). (d), the one index-compatible game, is absent from the pinned pool: data/game-differential.json (release 5973a4e3c768, 961 games) has a single divergence, not a damage cause, and 961 of 961 boards never parted. Absent is not proven — (d) never had a hypothesis — and a recurrence is filed fresh. MEASURE 2026-09-11.
```

### Group 2 — close after ONE run exits 0 (commands in `## OWED, NOT RUN`)

Each row gets its `VERIFIED BY: \`<command>\``.

- **#175** — `node tests/test-tag-consumed.js`. Note that it rewrites `data/tag-consumption.json` when the census moved and the run is green, so a register pass can republish that file.
  ```text
  closed 2026-09-11 — none of the 23 tags this row named is dead: data/tag-consumption.json at HEAD (2026-09-10T20:25:28Z) holds a dead floor of 5 and none of the 23 is in it. The ratchet fails on any tag that dies outside that floor. MEASURE 2026-09-11.
  ```
- **#220** — `node tests/test-middle-stall-address.js`
  ```text
  closed 2026-09-11 — the family was the consecutive-Protect die's ADDRESS in the middle arm, not the stall rule: zero in both corner arms and live only where the die is a real draw (header of tests/test-middle-stall-address.js). data/game-differential.json (release 5973a4e3c768, 961 games) carries no -singleturn cause. The 32 and the 6 in this row's history are counts on other releases. MEASURE 2026-09-11.
  ```
- **#334** — `node tests/probe_confusion_selfhit_address.js`
  ```text
  closed 2026-09-11 — both halves landed 2026-09-04: the authority's damage draw is addressed at the confused body, and getConfusionDamage is wrapped as a dmg draw so both engines read the sixteen-index roll in one direction (header of tests/probe_confusion_selfhit_address.js, which asserts both with the self-target click as its control). MEASURE 2026-09-11.
  ```
- **#361** — `node tests/probe_multiaccuracy_address.js`
  ```text
  closed 2026-09-11 — a multiaccuracy volley now reaches its per-arrival accuracy (engine/medicham2-browser.js, M1 2026-09-04, line 4336 at HEAD ea437935), and tests/probe_multiaccuracy_address.js stages both legal carriers of the flag, asserting arrival counts and shared acc addresses. Neither move is a cause in data/game-differential.json on release 5973a4e3c768. The Scale Shot null result stands as written. MEASURE 2026-09-11.
  ```
- **#362** — `node tests/probe_selfdestruct_winner.js`
  ```text
  closed 2026-09-11 — battleResult reads the faint order (lastFaintSeq over noteFaint's sequence, engine/medicham2-browser.js line 45295 at HEAD ea437935), so a mutual wipe goes to the side whose body fainted last, as sim/battle.ts does. tests/probe_selfdestruct_winner.js carries w3-simultaneous as an ordinary arm that must agree. The perish-order case is not claimed. MEASURE 2026-09-11.
  ```
- **#365** — `node tests/test-roster-identity.js`
  ```text
  closed 2026-09-11 — mirrorForcedSwitch keys on rosterKey, not the display name (engine/game_differential.js:5234-5241), so a renamed body can be asked for. tests/test-roster-identity.js and tests/test-forced-switch-mirror.js pin it, and data/game-differential.json (release 5973a4e3c768) reads 0 lookup misses on both sides. Its forced_switch_unmirrorable count of 6 opens on a body Showdown has FAINTED — a board parting, not this row's claim. MEASURE 2026-09-11.
  ```
- **#369** — `node tests/test-register-reality-readonly.js`
  ```text
  closed 2026-09-11 — --list returns before any write (engine/register_reality.js:1356-1358), the selftest runs the listing path with fs.writeFileSync booby-trapped, and tests/test-register-reality-readonly.js is this row's own check that a coverage-only invocation leaves the artifact byte-identical. MEASURE 2026-09-11.
  ```
- **#393** — `node tests/test-engine-diff.js --out data/verification/engine-diff.register.json`. The `--out` keeps a register pass from rewriting `data/engine-diff.json`, as `tests/run-all.js:789` does. Confirm `node engine/register_reality.js --list` admits the flag.
  ```text
  closed 2026-09-11 — the harness runs ModifyMove and sets the active move as the authority does (tests/test-engine-diff.js:558-590, CONTROL FIX 14), and data/engine-diff.json (2026-09-11T03:12:01Z, release 5973a4e3c768) reads 6,000 compared, 0 disagreed. MEASURE 2026-09-11.
  ```
- **#403** — `node tests/probe_sucker_redirect_refusal.js`
  ```text
  closed 2026-09-11 — the redirect is drawn before the failsIfTargetNotAttacking refusal (engine/medicham2-browser.js at HEAD ea437935: redirectDrawnTo at line 34787, the refusal at 35231), matching sim/battle-actions.ts:466-468 then :590. tests/probe_sucker_redirect_refusal.js stages the Follow Me and Rage Powder users, with a no-redirector arm as the control over the queue clause. MEASURE 2026-09-11.
  ```
- **#530** — `node tests/test-engine-release.js`. Its `ABRA-HEAP: 6144` is honoured by register_reality.
  ```text
  closed 2026-09-11 — data/rollout-switch-census.json is in SOURCES (engine/engine_release.js:199, 2026-09-08), so a release cut since then can switch; tests/test-engine-release.js:451-466 asserts it. Snapshots cut before cannot be repaired, and the refusal in the same block covers them. MEASURE 2026-09-11.
  ```

### Group 3 — close after a small new check (Batch A7 and A8)

- **#300** — `VERIFIED BY: \`node tests/test-midwrap-error-path.js\``
  ```text
  closed 2026-09-11 — MID_WRAP_ERROR is declared at engine/game_differential.js:439, above its assignment at :543, so the catch block can report a failed wrap. The new check loads the driver with a deliberately wrong SHOWDOWN_PATH and asserts the require failure is reported rather than a ReferenceError. MEASURE 2026-09-11.
  ```
- **#301** — `VERIFIED BY: \`node tests/test-switch-lookup-zero.js\``
  ```text
  closed 2026-09-11 — the miss counts are published as switch_addressing.medicham_lookup_missed and showdown_lookup_missed (engine/game_differential.js:9378-9381) and read 0 and 0 on release 5973a4e3c768. The new check fails while either is non-zero. MEASURE 2026-09-11.
  ```

### Group 4 — NOT A DEFECT

- **#315** — add `VERIFIED BY: \`node engine/quarantine.js --whole-game\``. This is weak: pool coverage only. The optional staged mega-faint arm is Batch B8.
  ```text
  closed 2026-09-11 — NOT A DEFECT in this format. The revert this row cites (sim/battle.ts:2555-2571) is gated on pokemon.formeRegression, which the Champions formeChange override sets only in the Tera branch (data/mods/champions/scripts.ts:75-78), never in the item branch a mega takes; the only other setter in sim/ is Morpeko's (sim/battle-actions.ts:1962). A fainted Champions mega therefore keeps its forme, which is what this engine does (its note at engine/medicham2-browser.js line 21938, HEAD ea437935). The 3 species and 2 maxhp leaves were read against the mainline rule. MEASURE 2026-09-11.
  ```
- **#446** — `VERIFIED BY: \`node tests/test-resolution-order.js\`` (run first).
  ```text
  closed 2026-09-11 — the runner half closed 2026-08-27. The leak half is NOT A DEFECT as filed: tests/test-resolution-order.js declares the per-arm snapshots by design (lines 12-15) and declares ABRA-HEAP 6144, which tests/run-all.js and engine/register_reality.js (lines 333-354) both honour, and an OOM is still annotated rather than skipped. Whether the snapshots still accumulate was not re-measured; this closes on the exit code under the declared heap. MEASURE 2026-09-11.
  ```
- **#500** — stays open on the escape hatch until Batch A9 exists, then closes with `VERIFIED BY: \`node tests/test-crit-reaction-saturates.js\``
  ```text
  open — NOT A DEFECT, derived 2026-09-11 from data/tags.json at HEAD: of the five buffsHolderOnHit members exactly one is crit-conditioned, angerpoint, whose boost is atk 12 and saturates, so collapsing per-arrival crits with some(Boolean) is exact for every member in this format. The per-hit loop itself stays the declared KNOWN-OPEN arm of tests/test-resolution-order.js. The earlier cell carried a bare breakage token inside a negation and was counted as asserting breakage for that reason alone. MEASURE 2026-09-11.
  ```
- **#364** — stays open; the probe is owed (Batch B4).
  ```text
  open — NOT A DEFECT until measured, and UNMEASURED: 22 members, 32,135 clicks (7.6% of clean clicks), declared open by #343's pass. The earlier cell was counted as asserting breakage only because it named the breakage token while saying none was filed. INSTRUMENT OWED as written in the account. MEASURE 2026-09-11.
  ```
- **#549**
  ```text
  open — NOT A DEFECT as filed: the same-day correction refuted it, since no switch action was missing and the refusal regex and the blank stat line were instrument faults, both fixed 2026-09-07. leppaberry now reads FIRED-AND-BOARDS-MATCH in data/roster.items.json (release 5973a4e3c768). What remains is an audit of the surviving COULD-NOT-STAGE reasons in the three roster artifacts, which is a work item and not a claim about the game. MEASURE 2026-09-11.
  ```

### Group 5 — still-true rows whose marker is wrong

- **#440** — demote the `node engine/game_differential.js …` marker to `FORMERLY NAMED:` without backticks.
  ```text
  open — engine DEFECT, narration, CLOSETED BY WILL 2026-08-28 and still live: it is the only divergence in data/game-differential.json (release 5973a4e3c768, 961 games), game omit-spread turn 12, three perish0 starts immediately before it. The marker named engine/game_differential.js, which exits 0 on any divergence, so it read green on a live row, and it is demoted. INSTRUMENT OWED: a staged perish board with no following handler, asserting the faint's position against the authority. Related: #584. MEASURE 2026-09-11.
  ```
- **#412** — preferred: land the fix (Batch B1). Until then, demote the marker so the row stops reading STALE:
  ```text
  open — DEFECT, one fact with two implementations: engine/position_features.js:249 still reads the declared ability raw where engine/board.js resolves it through effAbility. tests/test-effective-identity.js is green on it only because RUNTIME_ALLOWED (lines 528-539) declares this exact line, so that marker is not evidence and is demoted until the fix removes the entry. Exposure is zero and is re-derived by that entry's guard. MEASURE 2026-09-11.
  ```

## Batch plan for the instrument-owed rows

Owners follow `docs/DIVISIONS.md`. **Game?** means the check stages battles in both engines. None of these runs the whole differential unless it says so.

### Batch A — static or artifact-only, no games (MEASURE, except where noted)

| # | Rows | Files | Red arm | Control | Game? |
|---|---|---|---|---|---|
| A1 | #350 | `engine/quarantine.js`: split `registerEvidence`'s `debt` into *names nothing* and *names a marker, no verdict* by reading `MARKER` on the row; print `register-reality.json` `generated` against the ROADMAP mtime. Add an arm to the `--selftest` block. | a fixture row carrying a marker and absent from the verdicts must land in the second bucket | a row with no marker stays in the first | no |
| A2 | #380 (2)(3) | `engine/register_reality.js`: export `classifyExit`. `tests/run-all.js`: import it (ENGINE is live in `tests/`). `engine/quarantine.js`: make `unrunnable` produce `ok:false, cannot_answer:true`. **Measure before landing**: the 03:51Z artifact has 2 unrunnable open rows, #578 and #579. If they assert breakage, the clause goes CANNOT-ANSWER. | an exit-2 child with an open row gives `cannot_answer` | exit 0 gives green | no |
| A3 | #370 (optional narrower oracle) | new `tests/test-retraction-cases.js` requiring `engine/docs_scan.js`, asserting every `RETRACTION_CASES` entry via `retractionProof()` | flip one case's expectation | the unmodified cases | no |
| A4 | #524 | new `tests/test-probe-refusal-exit.js`: static scan of `tests/probe_*.js` for a `COULD-NOT-STAGE` print followed by `process.exit(0)` within 3 lines. Then fix the 7 paths in the 4 files to `ABRA-EXIT 2 CANNOT-ANSWER` plus `exit(2)`, the arrangement already used at the converted sites. | today's tree (7 hits) | a converted site such as `probe_hazard_recap_fail.js:132` | no |
| A5 | #425 | `engine/all_mechanics_fire.js` (ENGINE): refuse to publish a partial artifact to the canonical path, or default to `all`. New `tests/test-amf-populations.js`: the canonical artifact carries `rows.moves`, `rows.abilities` and `rows.items`. | a copy with one kind deleted | HEAD's artifact, which has all three today | no |
| A6 | #399 | `engine/divergence_cards.js`: banner and `exit 2` when `data/divergence-turns.json`'s `engine_release` differs from `data/game-differential.json`'s | mismatched fixture | matching fixture | no |
| A7 | #301 | new `tests/test-switch-lookup-zero.js`: reads `switch_addressing.{medicham,showdown}_lookup_missed` from `data/game-differential.json` | a copy with a 1 | HEAD, 0/0 | no |
| A8 | #300 | new `tests/test-midwrap-error-path.js`: spawns `node -r ./tests/_live_release.js engine/game_differential.js --games 1` with `SHOWDOWN_PATH` pointing at a missing directory; asserts stderr names the require, not `ReferenceError`. **Check first** that `engine/showdown_path.js` respects a preset variable; if it overrides one, stage the failure another way. | a copy of the driver with the declaration moved back below the catch | the real driver | no — it fails at require |
| A9 | #500 | new `tests/test-crit-reaction-saturates.js`: over `data/tags.json`, every `buffsHolderOnHit` member whose `when.cond === 'crit'` has a saturating boost (magnitude of 12 or more on every stat). Print the membership before asserting. | a synthetic member with `atk:1` | angerpoint | no |
| A10 | #323, #325 | `tests/mutation_harness.js`: class-A string becomes "a second, unread copy of the fact", plus a sibling-tag column in `defectEvidence`. Skip `from`, `note`, `cite`, `via` and `what` params, counting them as `provenanceParamsSkipped`. | the 11 provenance rows move out of READ-AND-IGNORED | the non-provenance rows are unchanged | no new games (the harness re-run is its own cost) |
| A11 | #349 | `engine/divergence_report.js`: print the ranking key (entity and which side's line) beside each cause | — | — | no |
| A12 | #318 | `tests/roster.js` (ENGINE): publish `learnset_refusals` into `data/roster.*.json`; a check fails while it is non-zero or rises | — | — | the publish rides the next roster run |
| A13 | #348 (OPS) | `tests/test-lownode.js`: an arm passing an argument with a space and one with a drive-letter path, asserting the child's argv byte for byte. Show it RED on the current wrapper first. | current wrapper | a plain argument | no |
| A14 | #529, derivation half (ENGINE) | `engine/tag_dex.js`: quote-agnostic `eats` regex. Regenerate `data/tags.json` **with the store pinned**. `tests/test-tag-params-derived.js`: `bugbite` and `pluck` must read `consumesAndGainsEffect:true, removes:false`. | HEAD tags | knockoff and thief unchanged | no. **Blocked on the store pin**, as the row says. |

### Batch B — ENGINE, staged games. These turn rows RED, which is the point.

| # | Rows | Files | Red arm | Control | Game? |
|---|---|---|---|---|---|
| B1 | #412 | `engine/position_features.js:249` → `B.effAbility(f.mon, dex)`; delete the matching `RUNTIME_ALLOWED` entry in `tests/test-effective-identity.js`. **The feature FUNCTION changes** with output unchanged at zero exposure. Under the restamp rule, anything fitted on `position_features` owes a refit — and those artifacts are already quarantined, so land this **before** the refit, not after. | the test with the old line and no allowlist entry | the fixed line | no |
| B2 | #535 | new `tests/probe_unburden_acquired.js`: a body loses its item first (a spent Focus Sash), then acquires Unburden by Skill Swap from its partner. Assert Speed unmoved on both engines. The second door is a contact hit into a Wandering Spirit holder. | the acquired-after-loss board | the same body holding Unburden from the start, which must double | yes, staged |
| B3 | #541, fainting-holder half | `tests/probe_contact_ability_transfer.js`: add an arm where the contact hit KOs the Wandering Spirit holder, so the authority swaps and Starts on a holder at 0 HP that is not yet `fainted`. **The live ENGINE agent is fixing this in uncommitted bytes; check its commit before writing anything.** | holder KO'd by the hit | holder that fainted in an earlier action, which must be refused | yes, staged |
| B4 | #364 | new `tests/probe_self_rider_refused.js`: one pair per `self` SHAPE, with membership derived from the format rather than listed. Boosts: Close Combat into Protect. Lock: Outrage into Protect. The onHit member is derived. Assert the rider fires on both engines or on neither. | the refused hit | the same move landing | yes, staged |
| B5 | #397, Psychic Terrain | `tests/probe_priority_modified.js`: add the red arm `prankster-thunderwave-psychicterrain`, a Prankster Thunder Wave into a grounded foe under the terrain | that arm | the existing `prankster-thunderwave` arm without terrain | yes, staged |
| B6 | #400 (b) | `tests/probe_charge_release_chosen_slot.js`: add a plain two-turn Phantom Force arm asserting damage on turn 2 | no re-aim, target standing | the row's control, the lock broken | yes, staged |
| B7 | #511 | `tests/probe_volley_collapse.js`: add a `--declared-red` flag that counts DECLARED rows as failures, plus a Focus Sash route. **Keep the default**, which #526's marker relies on. The #511 marker becomes `node tests/probe_volley_collapse.js --declared-red`. | Endure and Sash routes | the packet road and one-arrival Disguise | yes, staged |
| B8 | #315 (optional) | a fainted-mega arm in `tests/test-forme-assert.js` or a new probe: species and maxhp equal on both engines after the mega faints | — | a non-mega faint | yes, staged |
| B9 | #440 | new `tests/probe_perish_faint_position.js`: a perish group with no following handler; assert the faint line sits on the authority's side of upkeep. Blocked on the handler list, and it may fold into #584. | — | the same board with a surviving follower | yes, staged |
| B10 | #529, engine half | `tests/test-mechanics.js`: Bug Bite into a Sitrus holder; the attacker eats (HP on both engines) and `MEDFAILS.stealEatViaClassGuard` reads 1 until A14 lands, then 0 | the eat | the same move into a non-berry holder | yes, staged |

### Batch C — needs whole runs (MEASURE decides first)

- **#441**: new `tests/probe_replay_isolation.js`. Play one pair alone, then at position N of a run, and compare first divergences; then reset the tie key and the address log per game and compare again. Plays differential games.
- **#421**: run both invocations on one frozen release and diff the verdicts for `axekick` and `electrify`.
- **#375 and #467 (b)** (ENGINE's file): per-cause context and `void_n` in `engine/game_differential.js`. Needs a full differential run to populate. There is no bite today (1 divergence, 0 void), so schedule it behind everything above.
- **#442**: new `tests/test-census-reproduces.js`. Regenerate the census from the committed tree into a temp path and diff it against `git show HEAD:data/mechanics-census.json`. Plays every staged census probe.
- **#310**: hand rollouts a stream in `engine/rollout_leaf.js` and gate `MEDSEEN.traceChoiceNoDie === 0` on a staged Trace-lead rollout. **This moves every seeded run**, so it belongs to the post-quarantine re-run list, not to this batch.

## OWED, NOT RUN

**When to run these.** Run everything below **after the live ENGINE agent commits**, so the tree equals a committed state.

**One of these writes when run bare.** `tests/test-resolution-order.js` CUTS A REAL RELEASE when given no `--release` (lines 136-138: `ER.cut(...)`). Pass `--release <id>` once the ENGINE commit has its own cut. A register pass that runs #446's marker will cut one too. Wrap the heavy ones in `tools/lownode.cmd` (`cmd.exe /c tools\lownode.cmd <script>`). Apply the Group 2 closures only for commands that exit 0.

Group 2 instruments, in one pass. The last three write nothing canonical.
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/test-tag-consumed.js
node tests/test-middle-stall-address.js
node tests/probe_confusion_selfhit_address.js
node tests/probe_multiaccuracy_address.js
node tests/probe_selfdestruct_winner.js
node tests/test-roster-identity.js
node tests/test-register-reality-readonly.js
node tests/test-engine-diff.js --out data/verification/engine-diff.register.json
node tests/probe_sucker_redirect_refusal.js
node --max-old-space-size=6144 tests/test-engine-release.js
node --max-old-space-size=6144 tests/test-resolution-order.js
node engine/register_reality.js --list
```

Re-confirm the Group 1 greens on the committed tree. They were last green at 03:51Z, before the live agent's uncommitted edits.
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/quarantine.js --whole-game
node tests/probe_red_demo.js
node tests/test-docs-current.js
```

After the rows are applied, run the register pass (it plays games) and restamp:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/register_reality.js
node engine/open_work.js
node engine/status.js --write
```

The Batch C measurements, not run and not scheduled here:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/roster.js --stage all
node tests/roster.js --stage moves
```
