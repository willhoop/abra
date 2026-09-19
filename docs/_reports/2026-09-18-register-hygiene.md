# REGISTER HYGIENE — THE SIX `--whole-game` CLOSURES, AND THE 29 OPEN ROWS THAT ASSERT BREAKAGE

2026-09-18, MEASURE. This is a findings record, not a living document. The register rows it feeds supersede it,
and it is never quoted as current state.

Mode: LIGHT. No games were played through `game_differential`, no roster stage ran, and `all_mechanics_fire`,
`quarantine.js --whole-game` and a full `register_reality.js` sweep were not run. Every probe listed below
stages a few boards. Each ran through `tools/lownode.cmd` (spawned from node with an argv vector), with
`-r ./tests/_live_release.js` wherever the probe would otherwise cut a real release. For every run, the
mtimes of `data/engine-release.json`, `data/game-differential.json` and `data/register-reality.json` were
checked before and after, and all three were unchanged.

The differential artifacts were read ONLY through `git show HEAD:`. The live copies were being rewritten by
another agent during this pass: `data/game-differential.json`, `.g1350.json` and `.g1950.json` all turned
`M` in `git status` while this pass was running.

---

## 0. VERDICT

- **The six closed rows: 6 of 6 stand. None was reopened.** Five now name a light instrument that was
  run green in this pass. #301 is left with no marker, because nothing light decides it.
- **The 29 open rows that assert breakage:**
  - **5 CLOSED**, on probes that were run in this pass: #334, #361, #403, #541, #543. Each probe was green,
    and each went red under its restore knob.
  - **15 STALE or PARTLY STALE.** Each has a dated note, and each stays open.
  - **6 still true.**
  - **3 cannot tell.**
- `node engine/open_work.js` went from **29 → 24** open rows that assert breakage.
- `node engine/register_reality.js --only 218,314,315,439,542,334,361,403,541,543` gives **10 of 10
  CONFIRMED** and writes nothing.
- `tests/test-roadmap-register.js` passes 3 of 3. `tests/test-register-cell-parse.js` passes.

**Two reds were seen and are not fixed.** This pass could edit only the register and the ledger:

1. `engine/register_reality.js --selftest` reads **87 passed, 1 failed** (§4a).
2. `tests/probe_selfdestruct_winner.js` exits 1 with 0 boards staged, because its plant anchor has drifted
   (§4b).

**One defect has no register row:** Mummy overwrites Zero to Hero on the `--games 1950` lattice (§4c).

---

## 1. THE SIX CLOSED ROWS

Background: HEAD's lattices (release `bc8d7cf849dd`) read board-material **0 of 961** at `--games 1200`,
**9 of 1069** at 1350 and **21 of 1497** at 1950. All 30 board-material games are listed in
`state.first_board_divergences`. Both non-zero counts are under that list's cap of 40, so the capped list
is the whole population here.

| row | what it closed | does the closure depend on the one-lattice zero? | evidence this pass | new marker |
|---|---|---|---|---|
| #218 | the whole-game differential gated nothing | **No.** The row is about GATING. The count belongs to #81's queue. | `node engine/quarantine.js --selftest`: 279 passed, 0 failed, exit 0. The twelve LATTICE arms show that one non-zero lattice shuts the clause with exit 1. | `node engine/quarantine.js --selftest` |
| #301 | forced-switch lookup misses | **No.** The closure rests on the artifact counter. | On all three lattices: `medicham_lookup_missed` 0, `showdown_lookup_missed` 0, `misaddressed` 0, over 5,248, 5,870 and 8,623 switches sent. No light instrument reads the counter. | none. The row's account already carries INSTRUMENT OWED. |
| #314 | the board comparator's planted-state proof had holes | **No.** The closure rests on the proof. | On each lattice, 42 of 42 plants are applied and caught, and `planted_state_proof_ok` and `mappings_all_proved` are true. The `--selftest` SPLIT arm shows that a hollow proof cannot read green. | `node engine/quarantine.js --selftest` (it decides the door, not the plants) |
| #315 | a fainted mega keeps its forme ("wrong authority") | **No.** The closure rests on the Champions source. | `probe_forme_revert_silent.js` exit 0. Its §0 asserts that Champions' `formeChange` sets `formeRegression` once and mainline sets it twice. No species, forme or maxhp leaf appears among the 30 board-material games. | `node -r ./tests/_live_release.js tests/probe_forme_revert_silent.js` |
| #439 | a KO'd spread target's faint came below the secondary | **Partly.** A better account was found. | The row's game, seed pair `…2654469023 vs …2654553264`, carries the cause in every committed artifact from `0447cd1f` through `8ba14c7e` (release `7fc604e5bc44`). It is absent at `09611679` (release `ef2c826b5718`), which is the #447 commit, and #447 names this game: Matcha Gotcha burning an Excadrill. So the cause was the ruler's address. `probe_spread_secondary_address.js` exits 0, and exits 1 under `MEDI_SEC_ADDR_PER_TARGET=1`. | `node tests/probe_spread_secondary_address.js` |
| #542 | a fence over seven damage-value games | **No.** "Every bucket has a home." | `probe_fairy_aura.js`: all 4 arms clear, and its red arms separate the engines. `probe_moldbreaker_ally_guard.js`: all 5 arms clear. The shape of (d) recurs on the new lattices, in three cases: Floette-Eternal 94 vs 95 and Metagross 82 vs 84 at 1350, and Gholdengo 122 vs 124 at 1950. #622 lead (1) now covers it. | `node -r ./tests/_live_release.js tests/probe_fairy_aura.js` |

Each old fenced marker became `FORMERLY NAMED: node engine/quarantine.js --whole-game` (unfenced, so
nothing runs it). In #218 the cell also withdraws the claim "the divergence it measured is gone from the
pinned pool". That claim is true of one lattice only. #619's cell records the discharge.

---

## 2. THE 29 OPEN ROWS THAT ASSERT BREAKAGE

Closed-row detection used only `roadmapRowIsClosed`, imported from `engine/quarantine.js`. For every edited
row, the before and after values of `roadmapRowIsClosed` and `roadmapRowSaysBroken` were printed and
checked against the intent. No row gained the words "NOT A DEFECT".

| row | the mechanic, in plain words | verdict | evidence |
|---|---|---|---|
| #175 | 23 tags the engine never reads | **stale** (note) | `tests/test-tag-consumed.js` 7/0, exit 0. Of the 23: 14 LIVE, 6 STAGED, 3 no longer tags. DEAD today is 4 other tags inside the ratchet floor. The test wrote `data/tag-consumption.json`, which was restored to HEAD's bytes (§5). |
| #207 | PP left out of the roster verdicts | **stale** (note) | `tests/roster.js:6716` says it declares no `ppHold`. The 1950 lattice carries a PP board divergence. |
| #220 | Protect's consecutive-use (stall) counter: the authority raises Protect where we write `-fail` | **cannot tell** | The family (`-singleturn` protect against `-fail`) is ABSENT from all three HEAD lattices (0 of 961, 1069 and 1497 first divergences). On 09-04 it was already down to 4 causes over 6 games. There is no probe, and absence from the pool is not proof of a fix. The two lattice cases `\|-fail\|p2a <> \|-singleturn\|p2b\|helpinghand` look similar but are a different mechanism: Helping Hand at a partner who is protecting, which is #622 lead (9). |
| #284 | a code comment quotes the wrong Last Respects usage | **still true** | `engine/medicham2-browser.js:23045` still says 19,299. `data/tags.json` `moves.lastrespects.uses` reads 15,240. |
| #285 | the docs-currency gate is red on the white paper | **stale** (note) | The pre-commit hook runs `test-docs-current.js --staged`, and docs commits landed through 2026-09-12. The baseline lists no white-paper entry under `untraceable_by_doc`; 257 are grandfathered. |
| #67 | Illusion is not modelled | **still true** (shelved by owner) | `engine/medicham2-browser.js:23582` says "this engine models no Illusion". Carriers derived as legal: Zoroark and Zoroark-Hisui. `CLOSET_SPECIES` drops them. |
| #310 | Trace takes slot 0 with no die | **partly stale** (note) | The rollout half is refuted by its own marker. The residual stands: `engine/bench_speed.js:179` calls `battleInit(A, Bt, {})`. |
| #334 | the confusion self-hit draws a different damage index | **CLOSED** | `probe_confusion_selfhit_address.js`: all checks passed. It exits 1 with 3 failing checks under `MEDI_CONFUSION_DMG_ADDR_LEGACY=1`. |
| #361 | multi-hit volleys land a different number of hits | **CLOSED** | `probe_multiaccuracy_address.js`: all checks passed. It exits 1 with 4 failing checks under `MEDI_MULTIACC_RAW_ACC=1`. Scope: counts equal, addresses checked one way only. |
| #362 | a simultaneous double wipe scores as a draw | **stale by source** (note) | `medicham2-browser.js:46885` applies the last-faint rule (WIRE 160, 2026-08-23). The probe cannot confirm this; see §4b. |
| #365 | forced-switch mirror keyed on species name | **partly stale** (note) | It is keyed on `rosterKey` now, and answered `from_ordered_occupancy`. `forced_switch_unmirrorable` is 1 / 0 / 3 across the lattices, with the reason "authority has FAINTED". |
| #367 | a published rate names a pool the artifact does not declare | **partly stale** (note) | `engine/pin_guard.js` exists and the selftest's PIN GUARD arms are green. The CHANGELOG 5.74.0 half is history. |
| #369 | `register_reality --list` overwrote its artifact | **stale** (note, not closed) | `tests/test-register-reality-readonly.js`: every #369 assertion holds (bytes and mtime unchanged), but the test exits 1 on an unrelated selftest arm (§4a). |
| #393 | the damage harness never runs `ModifyMove` | **stale** (note) | `tests/test-engine-diff.js`: CONTROL FIX 14 runs it. `data/engine-diff.json` (2026-09-12) reads `disagreed` 0. |
| #397 | Psychic Terrain, Sand Spit and Protean do not fire | **partly stale** (note) | Protean has 3 live census rows. Sand Spit: `probe_punish_side_and_sky.js` ALL CLAUSES HELD. Psychic Terrain with a Prankster status move: **cannot tell**, because no arm stages it. |
| #400 | a locked Phantom Force deals nothing on turn 2 | **stale by evidence** (note) | `probe_charge_release.js` exit 0 (Phantom Force release turn). The census strike-turn row is live. Neither was built for the locked case. |
| #403 | Sucker Punch into a Follow Me user | **CLOSED** | `probe_sucker_redirect_refusal.js`: all checks passed. Its redirect arm DIFFERS under `MEDI_SUCKER_AIMS_PRE_REDIRECT=1`. |
| #421 | roster `--stage all` vs per-stage verdicts disagree | **cannot tell** | HEAD `data/roster.all.json` (release `5a7bd8a8178a`, 09-10) reads FIRED-AND-BOARDS-DIFFER. `data/roster.moves.json` (release `bc8d7cf849dd`, 09-12) reads DEFERRED-BY-OWNER for Axe Kick and Electrify. The releases differ, so this is not the owed same-release diff. |
| #423 | an entry tie in a rollout takes one branch | **still true, by Will's ruling** | The `entryOrderTieNoDie` counter is at `medicham2-browser.js:4791`. The cell calls it a search-quality choice, yet the row trips `saysBroken`. Flagged, not edited. |
| #441 | a single-game replay is not the same game | **partly stale** (note) | `engine/replay_one.js` replays the schedule first (the warm-up), so the consequence is mitigated. The process-scoped state remains by design. |
| #442 | a census committed that its tree does not reproduce | **stale** (note) | The owed instrument is the row's own marker. `data/register-reality.json` (09-12) reads it green and calls the row STALE ROW. Not re-run, because it regenerates the census. |
| #473 | `g.sets` duplicates declared and clicked moves | **still true** | In the last 400 games of `data/games.bo3.jsonl` (through 2026-09-10), 387 repeat a move id; 1,688 of 5,094 sets. Example: `…2675950617` Maushold `["Protect","FollowMe","AfterYou","PopulationBomb","After You"]`. |
| #495 | a corpse's queued action is re-priced | **cannot tell** | No fixture exists. The row itself says the consequence is unmeasured. |
| #507 | Healer and Shed Skin draw a die before checking status | **still true** | `medicham2-browser.js`: `if(_wOK&&(+_cr.chance>=1\|\|rng()<+_cr.chance))` draws before the per-target `!_t.status` check. |
| #530 | a frozen release lacks the rollout switch census | **stale** (note) | The census is in `SOURCES` (`engine_release.js:199`). The row's own two-line decider, run by hand on `bc8d7cf849dd`, returned `ok: true`, `switchRate` 0.0998, `maxTurns` 14. |
| #533 | the random-target probe measures an empty bucket | **still true** | `tests/probe_random_target_address.js:168,218` still filter the blank `any` bucket. It is unchanged since 2026-08-29. |
| #541 | an ability moved by contact is announced on the wrong body and never Starts | **CLOSED** | `probe_contact_ability_transfer.js`: all checks passed. It exits 1 with 6 failing checks under `MEDI_CONTACT_ABILITY_LEGACY=1`. The fainting-holder marker was already green. |
| #543 | the Encore'd second Protect rolls a different stall die | **CLOSED** | `probe_encore_stall_address.js`: all checks passed. It exits 1 with 5 failing checks under `MEDI_MID_ADDR_PRE_OVERRIDE=1`. |
| #550 | the store lost games at the sharding cutover | **partly stale** (note) | `ingest.yml` now runs `compress-stores.js --check`. The shrink guard's self-baseline remains. The parser records belong to #558. |

**WHY FIVE ROWS WENT UNNOTICED.** Commit `ecc245d1` (2026-09-04) landed M1, M5, M7 and M8, each with its own
probe. `aa4aca01` landed M6's probe. None of those probes was written into a register cell. That is the
same shape as #362: the fix was made and the row was never touched.

---

## 3. WHAT WAS RUN (every command, every exit code)

All runs were at BELOWNORMAL through `tools/lownode.cmd`.

| command | exit | notes |
|---|---|---|
| `node engine/open_work.js` | 0 | 29 before the edits, 24 after. Rewrites `data/open-work.json`, which was already `M` in the tree. |
| `node tests/probe_spread_secondary_address.js` | 0 | also `MEDI_SEC_ADDR_PER_TARGET=1` → 1 |
| `node -r ./tests/_live_release.js tests/probe_fairy_aura.js` | 0 | red arms are internal |
| `node -r ./tests/_live_release.js tests/probe_moldbreaker_ally_guard.js` | 0 | |
| `node -r ./tests/_live_release.js tests/probe_forme_revert_silent.js` | 0 | |
| `node engine/quarantine.js --selftest` | 0 | 279 ok |
| `node tests/probe_selfdestruct_winner.js` | **1** | plant anchor drift (§4b) |
| `node tests/test-register-reality-readonly.js` | **1** | 9 passed, 1 failed (§4a) |
| `node engine/register_reality.js --selftest` | **1** | 87 passed, 1 failed |
| `node tests/test-tag-consumed.js` | 0 | **wrote `data/tag-consumption.json`**, restored (§5) |
| `node -r ./tests/_live_release.js tests/probe_confusion_selfhit_address.js` | 0 | knob → 1 |
| `node -r ./tests/_live_release.js tests/probe_multiaccuracy_address.js` | 0 | knob → 1 |
| `node -r ./tests/_live_release.js tests/probe_sucker_redirect_refusal.js` | 0 | knob → 1 |
| `node -r ./tests/_live_release.js tests/probe_punish_side_and_sky.js` | 0 | |
| `node -r ./tests/_live_release.js tests/probe_encore_stall_address.js` | 0 | knob → 1 |
| `node -r ./tests/_live_release.js tests/probe_contact_ability_transfer.js` | 0 | knob → 1 |
| `node -r ./tests/_live_release.js tests/probe_priority_modified.js` | 0 | |
| `node -r ./tests/_live_release.js tests/probe_charge_release.js` | 0 | |
| scratch: open release `bc8d7cf849dd`, `REL.require('engine/rollout_leaf.js').census()` | 0 | `ok: true`. Release directory unchanged. |
| `node engine/register_reality.js --list` | 0 | none of the edited markers REJECTED. Wrote nothing. |
| `node engine/register_reality.js --only 218,314,315,439,542,334,361,403,541,543` | 0 | 10 CONFIRMED. Wrote nothing. |
| `node tests/test-roadmap-register.js` | 0 | 3/0 |
| `node tests/test-register-cell-parse.js` | 0 | |

---

## 4. RED, UNREGISTERED, OR BROKEN — FOUND IN PASSING

**(a) `engine/register_reality.js --selftest`: 87 passed, 1 failed. This is MEASURE's own file.**

- The failing arm is `RED — post-entry tokens reach the child VERBATIM`.
- It expected the argv of `node engine/game_differential.js --arm middle --team-store data/team-pool-frozen`.
- It received `--max-old-space-size=8192` before the entry point. That flag comes from the `ABRA-HEAP: 8192`
  marker that `engine/game_differential.js` gained in `302b48a5` (2026-09-12).
- The flag is a legitimate node option placed before the entry point. What went stale is the arm's
  expectation, not the property the arm protects.
- It breaks `tests/test-register-reality-readonly.js`, which runs this selftest as its tenth check.
- **This test is red and is not waived.** It needs a fix to the arm (either pick a fixture script with no
  heap marker, or assert only the post-entry tail). The brief did not allow editing that file.

**(b) `tests/probe_selfdestruct_winner.js`: every arm stops at `PLANT FAILED (winrule) … anchor matched 0 times`.**

- `BREAK_WINRULE_FROM` quotes `lastFaintSeq([...S.actA,...S.benchA])`.
- The engine now calls `lastFaintSeq([...S.actA,...S.benchA],_ep)`
  (`engine/medicham2-browser.js:46885`).
- So 0 boards are staged, the probe exits 1, and the clean win-rule arms are never judged.
- #362 is therefore stale by source only, and is not closed.

**(c) An unregistered board-material defect.**

- Where: on HEAD's `--games 1950` lattice, seed `…2659857771 vs …2659970659`, turn 10.
- What: in this engine Mummy overwrites Palafin's ability (`p2.party.palafin.ability`: ours `mummy`,
  the authority's `zerotohero`). The protocol cause is
  `extra event emitted by medicham2 :: |faint|p1b <> |-activate|p1b|mummy|p2b|[ability]zerotohero`.
- The authority's rule, read from source: `mummy.onDamagingHit` returns early when
  `sourceAbility.flags['cantsuppress']` (Showdown `data/abilities.ts:2772`).
- Derived from `Dex.forFormat('gen9championsvgc2026regmb')`:
  - Zero to Hero's flags include `cantsuppress`.
  - Palafin is legal, with the single ability Zero to Hero.
  - Neither ability has a Champions override.
- No register row names it. It is recorded in #541's closing cell and is still owed a row. **Scoreboard:**
  this is a pool finding, so the pinned pool should move when it is fixed.

**(d) Rows whose markers are REJECTED (not mine; already the subject of #579).** #553, #555, #558, #563,
#566, #569, #570, #574, #576, #603, #618, #619, #620 and others are listed by `register_reality --list` as
NOT A COMMAND or PLACEHOLDER.

**(e) #423 and #67 trip `roadmapRowSaysBroken`, and their own cells say something different.**

- #423's cell says "not a correctness gap against the authority, ruled by Will".
- #67's cell says it is shelved by its owner.
- Both still count toward the gate's open-defect input.
- This was not changed. The only lever is the executable phrase, and Will has not ruled with those words.

---

## 5. SIDE EFFECTS OF THIS PASS

- `tests/test-tag-consumed.js` printed `wrote data/tag-consumption.json`. That artifact is outside this
  brief. It was restored by writing `git show HEAD:data/tag-consumption.json` back over it. No git
  command was run to do this.
- `git diff -- data/tag-consumption.json` is now empty. `git status` still shows it as `M` because the
  file's stat changed and its line endings are now LF (the `core.autocrlf` checkout was CRLF). The
  content is identical to HEAD.
- A copy of what the run wrote is in the session scratchpad.
- No other file outside `docs/ROADMAP.md`, `docs/MEASURE.md` and this report was changed by this pass.
- `data/open-work.json` is rewritten by `open_work.js`. It was already modified before this pass started.

---

## PROPOSED NOTES ROW

For `docs/RUNNING-NOTES.md`. The version is the next MINOR after whatever the CHANGELOG owner has at the top.

```
## [x.y.0] — 2026-09-18 — register hygiene: the six --whole-game closures all stand, five open breakage rows close on probes green since 2026-09-04, and the gate's count goes 29 → 24
- **What changed.** `docs/ROADMAP.md` only, plus `docs/MEASURE.md`. #218, #314, #315, #439 and #542 re-pointed from `node engine/quarantine.js --whole-game` (exit 1 since #619) to a light instrument run green on 2026-09-18; #301's marker withdrawn (nothing light decides it); #334, #361, #403, #541, #543 CLOSED on their own probes (M6, M1, M5, M8, M7), each green and each red under its restore knob; fifteen rows carry a dated stale-by-evidence note and stay open.
- **Measured.** `node engine/open_work.js`: 29 → 24 open rows assert breakage. `node engine/register_reality.js --only 218,314,315,439,542,334,361,403,541,543`: 10 of 10 CONFIRMED. Lattice facts read from `git show HEAD:` of `data/game-differential{,.g1350,.g1950}.json`, release `bc8d7cf849dd`.
- **Basis.** unchanged.
- **Supersedes.** ~~29 open register rows assert breakage~~ — now 24. #439's account (a faint-order defect) is superseded: the game is #447's and cleared at `09611679`.
- **Owed to the next major.** none. Owed now: a fix to `engine/register_reality.js --selftest`'s argv arm (87/1), the plant anchor in `tests/probe_selfdestruct_winner.js`, and a register row for Mummy overwriting Zero to Hero.
```

**CHANGELOG text** (under the same version, `### Changed` and `### Notes`):

```
### Changed
- Register hygiene (MEASURE). The six closed rows whose marker was `quarantine.js --whole-game` — which
  exits 1 since the gate reads three team lattices — were re-checked one by one; all six closures stand on
  something other than the one-lattice zero, five are re-pointed to a light instrument run green, and #301
  carries no marker because nothing light decides it. Five open rows that asserted breakage (#334, #361,
  #403, #541, #543) are closed on the probes their fixes landed with on 2026-09-04, each re-run green and
  red under its restore knob; none of those probes had been written into a register cell. Open rows
  asserting breakage: 29 → 24.
### Notes
- Seen red and not fixed in this pass: `engine/register_reality.js --selftest` 87/1 (an argv arm predates
  the `ABRA-HEAP` marker in `engine/game_differential.js`), and `tests/probe_selfdestruct_winner.js`'s
  win-rule plant no longer matches the engine. Unregistered: Mummy overwriting Zero to Hero on the
  `--games 1950` lattice. Full account: docs/_reports/2026-09-18-register-hygiene.md.
```

---

## OWED, NOT RUN

```bash
# 1. Restamp the generated blocks. Not run here: another agent was rewriting the differential artifacts
#    during this pass, and status.js would read them mid-write. Run it once that agent has finished.
node engine/status.js --write

# 2. The full register sweep. It RUNS every marked instrument (heavy), and it writes data/register-reality.json.
#    It should read the six re-pointed rows CONFIRMED, and #310 and #442 as STALE ROW, as they already are.
tools\lownode.cmd engine\register_reality.js

# 3. Rows left stale but not closed, because their decider writes an artifact or is heavy:
tools\lownode.cmd tests\test-docs-current.js              # #285 (writes its baseline on green)
tools\lownode.cmd tests\test-engine-diff.js               # #393 (rewrites data/engine-diff.json)
tools\lownode.cmd tests\probe_census_reproduces.js        # #442 (regenerates the census)
tools\lownode.cmd tests\roster.js --stage all --release bc8d7cf849dd --team-store data/team-pool-frozen   # #421, then diff per-row verdicts vs --stage moves on the SAME release

# 4. The two reds seen in passing, after the fixes land:
node engine/register_reality.js --selftest                 # must read 88/0
node tests/test-register-reality-readonly.js               # must read 10/0; then #369 can close on it
node tests/probe_selfdestruct_winner.js                    # must stage its boards; then #362 can close on it

# 5. #530 can close once its two-line decider is a repository file:
#    open a release, REL.require('engine/rollout_leaf.js').census(), exit 1 on ok:false.
```

---

## 6. FOLLOW-UP, SAME DAY (coordinator's brief): BOTH REDS FIXED, #362 AND #369 CLOSED, COUNT 24 → 22

**(a) `engine/register_reality.js --selftest`: 87/1 → 89/0.**

- **The defect.** The argv test (`post-entry tokens reach the child VERBATIM`) compared
  `seenArgs[0].slice(1)` against the tail, so it assumed the entry point is argv[0]. Since `302b48a5`,
  `engine/game_differential.js` declares `ABRA-HEAP: 8192`. #578's reader correctly puts
  `--max-old-space-size=8192` in front of the entry, so `slice(1)` began at the entry and the test went red
  on an argv that was right.
- **The fix.** The test now asserts the WHOLE child argv exactly. The expected vector is the heap flag
  (derived from the entry file on this run, never typed), then the entry path, then the tail. That is
  strictly tighter than before: the old check never looked at what came before the tail.
- **A new companion test drives that same predicate against three wrong argvs.** All three are refused:
  - a dropped bare value;
  - the tail moved in front of the entry point;
  - the heap flag moved behind the entry point.
- **Red demonstration on the shipping code.** `engine/register_reality.js` was compiled in memory with the
  argv builder broken. Nothing on disk changed; the script is `rr_red.js` in the session scratchpad.
  - Heap flag after the entry: **87 passed, 2 failed.** Both this test and #578's heap test fail.
  - Last token dropped: **87 passed, 2 failed.** Both this test and the preload test fail.
- `tests/test-register-reality-readonly.js`: **10 passed, 0 failed.** #369 is closed on it.

**(b) `tests/probe_selfdestruct_winner.js`: 0 boards staged → 5 staged, 0 failing, exit 0.**

- **The fix.** `BREAK_WINRULE_FROM` (a copy of the block's text) is replaced by `locateWinRule`. It finds
  `function battleResult(` (exactly once), matches its braces, and finds the ONE both-sides-empty guard
  inside it (the regex tolerates whitespace). That block must read `lastFaintSeq` and bump
  `doubleWipeDecidedByLastFaint`; anything else is a refusal that names what was missing.
- **The build is checked, not assumed.** On every tied board the patched engine must fire
  `doubleWipeDecidedByLastFaint` 0 times, and the clean engine exactly once. Otherwise the probe reports
  PLANT INERT.
- **The verdict.** `w3-simultaneous` (#362's board): both sides end at 0 bodies. Showdown answers `B` and
  medicham2 answers `p2`, so the winner AGREES. Deleting the tie-break moves it to a draw (RED PROVEN).
  Both Perish Song boards also move to a draw. The two untied boards do not move.
- **#362 is closed on this verdict.**
- **An observation, not counted as a failure.** On `w3` the self-KO position revert now CHANGES the
  comparison. The probe's header recorded it as not doing so on 2026-08-22. The file prints this and does
  not count it; it is left for ENGINE to read.

**Not touched:** Mummy / Zero to Hero. ENGINE owns it.

`register_reality --only 362,369`: both CONFIRMED, nothing written. `open_work`: **22** open rows assert
breakage. `tests/test-roadmap-register.js` and `tests/test-register-cell-parse.js` are both green.

### PROPOSED NOTES ROW — follow-up

This row can be folded into the one above under the same version, or written as its own row.

```
## [x.y.z] — 2026-09-18 — the register_reality selftest's argv arm and the self-destruct winner probe are repaired; #362 and #369 close on them
- **What changed.** `engine/register_reality.js`: the post-entry argv selftest arm asserts the exact child argv (heap flag derived from the entry file) and a companion arm proves the predicate refuses three wrong argvs. `tests/probe_selfdestruct_winner.js`: the win-rule revert is located by structure inside `battleResult` rather than by a copy of its text, and the run asserts the revert removed the tie-break (`doubleWipeDecidedByLastFaint` 0 under it, 1 clean). `docs/ROADMAP.md`: #362 and #369 closed on those instruments.
- **Measured.** register_reality selftest 87/1 → 89/0; test-register-reality-readonly 9/1 → 10/0; probe_selfdestruct_winner 0 boards staged → 5 staged, 0 failing. Open rows asserting breakage (`node engine/open_work.js`): 24 → 22.
- **Basis.** unchanged.
- **Supersedes.** ~~24 open register rows assert breakage~~ — now 22.
- **Owed to the next major.** none.
```

**CHANGELOG** (`### Fixed`):

```
- `engine/register_reality.js --selftest` was red at 87/1: its argv arm assumed the entry point is argv[0]
  and predated the `ABRA-HEAP` heap flag `engine/game_differential.js` gained in `302b48a5`. It now asserts
  the exact child argv and proves the predicate refuses a wrong one; 89/0, and
  `tests/test-register-reality-readonly.js` 10/0.
- `tests/probe_selfdestruct_winner.js` staged 0 boards: its win-rule revert was a text copy that stopped
  matching when `lastFaintSeq` gained an epoch argument. It now locates the block structurally and asserts
  the revert took effect; 5 boards, 0 failing. ROADMAP #362 and #369 close on these instruments.
```

---

## 7. SECOND FOLLOW-UP: THE THREE CANNOT-TELL ROWS, EACH GIVEN A FIXTURE — #220 CLOSED, #421 CAUSE FOUND, #495 PRICE MATCHES. COUNT 22 → 21

### #220: the Protect stall counter. CLOSED.

- **Instrument, new.** `tests/probe_protect_stall_lifecycle.js`. It stages five boards and compares, in
  both protocol streams, every Protect click as raised or refused. It also compares every board, which
  includes the `stall` leaf.
  - **streak**: two bodies shield for four turns.
  - **gap**: shield, Swords Dance, shield, shield.
  - **all-four-shield**: the last shield holds the final action, so `willAct()` finds nothing after it.
  - **three-shield-one-attacker**.
  - **after-refusal**.
- **Authority, read at the line.**
  - `data/moves.ts:13975-13980` (Champions keeps only a PP override, `data/mods/champions/moves.ts:755-758`).
  - `data/conditions.ts:439-462`.
  - `sim/battle-queue.ts:310-317`.
- **Result on release `bc8d7cf849dd`, run twice: all 5 AGREE.** The authority really took both refusal
  roads: 9 lost rolls and 7 last-action refusals.
- **`--red`.** In memory, the engine's willAct analogue (`_anyActionAfter`) is made to always answer true.
  2 of 5 scenarios then PART, with `p2.active[0].stall` 3 against 0.
- **One caution, kept.** One run against the LIVE tree went green under `--red`. It ran within a minute of
  ENGINE rewriting `engine/medicham2-browser.js` (mtime 20:21:16). A clean live re-run was red, and so were
  both runs on the frozen release. That is why the marker pins `--release`.
- The candidate #220 left open, the `willAct()` membership, is decided: the engine uses the authority's
  four choices (`SD_WILL_ACT`).

### #421: roster `--stage all` against per-stage verdicts. REPRODUCED, CAUSE FOUND, STILL OPEN (ENGINE's file).

- **What was run.** `tests/roster.js --only axekick` (and `--only electrify`) with `--stage moves` and then
  with `--stage all`, all on `--release bc8d7cf849dd`. Each invocation stages one row, and none writes.
- **What it measured.**
  - The board diffs are identical under both invocations.
  - The per-stage run buckets the row DEFERRED-BY-OWNER. The `all` run buckets it FIRED-AND-BOARDS-DIFFER.
- **The cause: `tests/roster.js:2445-2446`.**

  ```
  function usageShelf(r) {
    if (STAGE !== 'moves' || !r || !CLICKS) return r;
  ```

  Under `--stage all`, STAGE is `'all'`, so the usage shelf never applies. The shelf threshold is under 25
  store clicks. `data/click-counts.json` gives Axe Kick 2 and Electrify 18.
- **Owed to ENGINE.** Key the shelf on the row being a move, for example on the rule's `move/` prefix or
  on `r.kind`, not on the stage name.
- **Not a defect in the gate today.** The gate reads the per-stage artifacts.
- **The shelved Axe Kick board difference is real and unexplained:**
  - Goodra-Hisui confusion: 2 turns on the authority, 1 here, then 1 against none.
  - HP: 700 against 716.
  - A Focus Energy volatile and its PP spend appear here only.

### #495: a corpse's queued Gale Wings action. OWED FIXTURE BUILT; PRICE MATCHES; CONSEQUENCE NOT OBSERVABLE ON IT. NOT CLOSED.

- **Instrument, new.** `tests/probe_corpse_priority_galewings.js`. It derives, then stages, this board:
  - A Gale Wings Talonflame clicks Brave Bird.
  - A Choice Scarf Lycanroc's Accelerock (+1, Rock) KOs it in the +1 bracket, before it acts.
  - Its corpse then lands in a Speed-126 group with Pyroar-Mega and a second Talonflame. `talonflame` and
    `pyroarmega` are exactly the legal base-126 species; this is asserted in §0 of the file.
  - The control is the same board with Lycanroc protecting.
- **Clean result.**
  - Staged on the authority: p1a faints before any Brave Bird.
  - The engine re-derived the corpse's bracket: `bracketRederiveMoved` +1.
  - Both scenarios AGREE, on protocol and on board.
- **Red result.** In memory, `abilityPriorityShift`'s full-HP test spares a fainted body, so the corpse
  keeps +1 (`bracketRederiveMoved` +0). **It ALSO agrees.** So on this board the corpse's position reaches
  no live action, and the clean agreement is NOT evidence about position.
- **What IS decided.**
  - The PRICE matches, for a structural reason. Gale Wings' handler requires
    `pokemon.hp === pokemon.maxhp` (`data/abilities.ts:1580`), so a corpse is at 0 on the authority
    whether or not the handler is collected.
  - The engine prices it at 0 by the same HP test. For Gale Wings, the only handler #495 counted, the
    price cannot diverge.
- **Not verified.** Whether the pinned tie resolves a three-way group deterministically. If it does, the
  corpse's position is unobservable under any pinned arm by construction.

### The six still-true rows: owner, and whether any is a small light-mode job

| row | owner | light-mode job? |
|---|---|---|
| #284 Last Respects usage in a comment | ENGINE (`engine/medicham2-browser.js:23045`) | **Yes, trivial.** Replace the typed 19,299 with a pointer to `data/tags.json` `moves.lastrespects.uses` (15,240 today) rather than a new typed number. It is ENGINE's file, and ENGINE is editing that file right now. |
| #67 Illusion not modelled | ENGINE; shelved by Will ("DO NOT MODEL ILLUSION") | No. It is closeted by the owner and nothing is owed. It trips the breakage count only because of its vocabulary. |
| #423 entry tie with no die in rollouts | ENGINE (the visible counter, live) + SEARCH (plan both branches, PAUSED) | No. Will ruled "no die". It counts toward the gate only through its wording, and whether it should is Will's call. |
| #473 `g.sets` duplicates declared and clicked moves | OPS (`engine/durable-ingest.js` reveal path; the row says ENGINE/OPS) | Small code, but NOT light: it changes what ingest writes, and the bot runs ingest. MEASURE's side is only to keep refusing `g.sets[x].moves` as a moveset. |
| #507 Healer and Shed Skin draw before the status check | ENGINE (`medicham2-browser.js`, the `curesStatusResidual` block near :45305) | The code move is small. It changes the die count in every seeded run, so it needs a probe and a re-measure. Not a light-mode job. |
| #533 random-target probe measures an empty bucket | MEASURE (`tests/probe_random_target_address.js:168,218`) | The filter fix is light. The verification is not: the row requires a re-run at `--games 961` against the pinned pool, which is a game_differential run. |

**Count.** `open_work`: **21** open rows assert breakage. `register_reality --only 220`: CONFIRMED. The
register tests are green.

### PROPOSED NOTES ROW: second follow-up

```
## [x.y.z] — 2026-09-18 — two fixtures built for rows nothing could decide: the Protect stall counter closes, the Gale Wings corpse's price is shown to match, and the roster's all-stage disagreement is traced to one guard
- **What changed.** New `tests/probe_protect_stall_lifecycle.js` (five staged stall roads, both engines, `--red` breaks the willAct analogue in memory) and `tests/probe_corpse_priority_galewings.js` (a Gale Wings corpse in a Speed-126 group; `--red` keeps the corpse's +1). `docs/ROADMAP.md`: #220 closed on the first; #421 and #495 carry dated measured notes.
- **Measured.** Stall probe on release `bc8d7cf849dd`: 5 of 5 agree, 9 lost rolls and 7 last-action refusals exercised, 2 of 5 part under `--red`. Corpse probe: staged, price re-derived (+1 counter), agrees; the red arm also agrees, so position is not observable on that board. `tests/roster.js --only axekick|electrify`: per-stage DEFERRED-BY-OWNER, `--stage all` FIRED-AND-BOARDS-DIFFER on identical board diffs — `usageShelf` returns early unless `STAGE === 'moves'` (tests/roster.js:2446). Open rows asserting breakage: 22 → 21.
- **Basis.** unchanged.
- **Supersedes.** ~~22 open register rows assert breakage~~ — now 21.
- **Owed to the next major.** none. Owed to ENGINE: the `usageShelf` stage guard (#421).
```

**CHANGELOG** (`### Added`):

```
- `tests/probe_protect_stall_lifecycle.js` — the Protect stall counter staged on five boards in both
  engines, with an in-memory willAct break as its red arm; ROADMAP #220 closes on it.
- `tests/probe_corpse_priority_galewings.js` — ROADMAP #495's owed fixture: a Gale Wings corpse re-priced
  mid-turn. The price matches the authority; the corpse's position is not observable on the staged board.
```

---

## 8. THIRD FOLLOW-UP — #533: THE RANDOM-TARGET PROBE CAN NO LONGER PASS ON AN EMPTY BUCKET. CLOSED. COUNT 21 → 20

**The defect, confirmed in the code before the fix.**
- `tests/probe_random_target_address.js` looked for the runMove target draw in two steps. First it
  required the authority's BLANK address (`p[2]==='any' && p[3]==='-' && p[4]==='-'`). Only then did it
  match the call site.
- #478 moved that draw into its own category. `game_differential.js`'s `midAddrCat` now files an
  in-runMove target draw as `tgt`. After that move, nothing reached the blank-address test, clauses 2-4
  printed `0 of 0`, and the file exited 0.

**The fix, in one test file, and light.**
1. A pure `selectTargetDraws(sd, sites, sizes, V)` selects the draw by CALL SITE alone
   (`RUNMOVE_TARGET`, read off the real stack). It does not type any category, and it records the
   category the draw is actually filed under. The main loop and the selftest share it.
2. **An empty sample is refused.** When no runMove target draw was measured, the probe prints
   `MEASURED NOTHING — … This is NOT an answer` and exits **1**, before any clause prints a rate over it.
3. `--selftest` loads no driver, plays nothing and cuts no release. It runs in 1.5 s. It checks:
   - the old filter reads 0 on today's `tgt` address shape;
   - the new selector reads 2;
   - the category is recorded as `tgt x2`;
   - the OLD blank-bucket shape still selects;
   - an empty log selects 0, and the refusal text says it is not an answer.

**Shown.**
- `node tests/probe_random_target_address.js --selftest`: **6 passed, 0 failed**, exit 0.
- **Red demonstration.** The file was compiled in memory with the pre-fix conjunction restored
  (`blankOnly = true`), and nothing on disk changed. It reads **4 passed, 2 failed, exit 1**. The two
  checks that the new selector finds the `tgt` draws and records the category go red.
- **One real game** (`--release bc8d7cf849dd --games 1`, 18 s, no artifact written):
  - 73 authority draws, **0** of them in the blank bucket.
  - The target draw was found **4 times, filed as `tgt`**, all at nth 0.
  - Clause 3 read 4 of 4 and clause 4 read 3 of 4, against a 75.0% floor.
  - One game is not a figure, and neither number is quoted anywhere.

**Two things the one game shows that are NOT this row. They are recorded, not acted on.**
- **Clause 1 and clause 6 are also empty.** They study the blank bucket, and the one game drew nothing
  in it on either engine. Whether the bucket is now empty across the pool is a question for the 961-game
  run. The refusal covers clauses 2-4 only, which is what #533 names.
- **Clause 5's prose is stale.** Its sweep now reads a one-digit index moving the value by up to 0.5000,
  where its comment says FNV-1a "only translates, at most 0.0352". The hash appears to mix `nth` now. The
  printed conclusion ("THE CLAUSE 1 COLLISION IS REAL AND THIS IS WHAT MASKS IT") is therefore unsupported
  on today's engine. This belongs to whoever owns #478's hash; it was not edited here.

**Row.** #533 is closed on `node tests/probe_random_target_address.js --selftest`.
`register_reality --only 533`: CONFIRMED. `open_work`: **20** open rows assert breakage.

### OWED, NOT RUN — the figures #533 requires before any number is quoted

This is a game_differential run. It was not started, because another agent owns the CPU.

```
tools\lownode.cmd tests\probe_random_target_address.js --release bc8d7cf849dd --games 1200 --team-store data/team-pool-frozen --arm middle
```

- `--games 1200` is the published lattice, which plays 961 games. The pool pin is `data/team-pool-frozen`.
- The driver reads the live census, which is `632a699468ca` today and is the gate's pin. Record the census
  digest the run prints.
- Before quoting, check that the header reads `961 games`, that the category line shows a non-zero `tgt`,
  and that the run exited 0. An exit 1 means MEASURED NOTHING.

### PROPOSED NOTES ROW — third follow-up

```
## [x.y.z] — 2026-09-18 — the random-target probe measured an empty bucket and called it an answer; it now selects the draw by call site and refuses an empty sample
- **What changed.** `tests/probe_random_target_address.js`: clauses 2-4 select the runMove target draw by call site through a pure `selectTargetDraws`, record the category it is filed under, and exit 1 with MEASURED NOTHING when no draw was measured; new `--selftest`. `docs/ROADMAP.md`: #533 closed on the selftest.
- **Measured.** `--selftest` 6/0; the pre-fix filter restored in memory 4/2, exit 1. One game on release `bc8d7cf849dd`: 0 blank-bucket draws, 4 target draws filed as `tgt` (not a figure). Open rows asserting breakage: 21 → 20.
- **Basis.** unchanged.
- **Supersedes.** ~~21 open register rows assert breakage~~ — now 20.
- **Owed to the next major.** none. Owed: the `--games 1200` run above before any #478 figure is quoted; clause 5's stale hash prose.
```

**CHANGELOG** (`### Fixed`):

```
- `tests/probe_random_target_address.js` printed `0 of 0` and exited 0 once ROADMAP #478 moved the runMove
  target draw out of the blank address bucket. It now finds the draw by call site, records its category,
  and exits 1 when it measured nothing; `--selftest` proves the old filter reads zero on today's shape.
  ROADMAP #533 closes.
```

---

## 9. FOURTH FOLLOW-UP: CLAUSES 1, 5 AND 6 OF THE RANDOM-TARGET PROBE — FOUND WHERE THEY LIVE NOW, REFUSE ON NOTHING, CLASSIFY INSTEAD OF ASSERT

(An interlude first. For a few minutes this session's working directory pointed at another agent's
worktree, `.claude/worktrees/agent-a3958a3f18be49387`, which held uncommitted `tests/roster.js` and
simulator edits. Nothing was written there. The coordinator confirmed the main checkout, and all work
below is in `C:\Users\willj\Projects\Pokemon\ABRA`.)

**Where the draws live now, measured before any edit.** I ran a scratch script (`addr_shapes.js`) on 3
games of release `bc8d7cf849dd`. It histograms the address shapes on both engines and the call site of
every non-damage authority draw.

| | acc | tgtla | crit | dmg | tgt | sec | any (move in scope) | sdrop | blank `any\|-\|-` |
|---|---|---|---|---|---|---|---|---|---|
| authority | 51 | 36 | 30 | 30 | 7 | 5 | 2 | 1 | **0** |
| medicham2 | 51 | — | 30 | 30 | 6 | 5 | 3 | — | **0** |

- The blank bucket is empty on both engines. What used to crowd it is now `tgtla`: all 36 draws are
  `Side.randomFoe` target resolutions that `Battle#getActionSpeed` and `BattleQueue#resolveAction` make as
  lookaheads, which is #478's split.
- Two categories are authority-only: `tgtla` and `sdrop`. This is derived per run from the two logs.

**Clause 1: re-aimed at the draws only the authority makes, and refuses on nothing.**
- A pure `formerBlankPopulation(sdAll, meAll)` builds the population: every category the authority draws
  in and medicham2 never does (derived per run, not typed), plus anything still blank. For each category
  it reports base addresses, collisions (a base drawn more than once) and depth, with the top call sites.
- An empty population is `MEASURED NOTHING (clause 1)`.
- One game on the frozen release: authority-only `sdrop, tgtla`; population 24 of 73 authority draws.
  `tgtla` is 23 draws on 7 bases, **5 of them drawn more than once, deepest 6**. `sdrop` is 1 draw.
- The collision the clause was written to show is still real. It now lives in a bucket nothing on our
  side reads, so it can only shift the authority's own later draws in that bucket.

**Clause 6: re-aimed at whether the two engines address the target draw identically, and refuses on
nothing.**
- The 2026-08-27 proposal this clause priced, blanking our draw, was never landed: #478 gave the draw its
  own category on both engines. So the clause now asks whether the addresses are the same.
- A pure `targetAddressMatch(sdAll, meAll, cats)` compares them in the category the authority's target
  draws are actually filed under (clauses 2-4's `targetCats`). It reports shared, authority-only and
  ours-only addresses, and names up to five of each.
- Our having no target draw at all is `MEASURED NOTHING (clause 6)`.
- One game: `tgt`, authority 4, medicham2 4, **shared 4**, 0 authority-only, 0 ours-only. Our blank
  bucket is 0 of 50.

**Clause 5: the sweep now decides the sentence.**
- The old clause printed a fixed conclusion: the trailing index "only TRANSLATES the value modulo 1 — it
  does not mix … THE CLAUSE 1 COLLISION IS REAL AND THIS IS WHAT MASKS IT". Its own sweep read 0.5000.
- The driver's `midHash` gained a finaliser. The comment above `midHash` in `engine/game_differential.js`
  says so, and records a pre-fix maximum circular shift of 0.0351571.
- A pure `classifyNthStep(steps)` now sorts the sweep into one of three classes:
  - **TRANSLATES** when the maximum step is under 0.05;
  - **MIXES** when the mean circular step is within [0.20, 0.30], since independent uniforms have a mean
    circular distance of 0.25;
  - **UNCLASSIFIED** otherwise.
- Only the reading that follows from the class is printed.
- One game: one-digit index max 0.5000, mean **0.2489 → MIXES**; two-digit mean 0.2499 → MIXES. The clause
  now says that clause 3 recovers the authority's pick only where the authority drew at nth 0 (4 of 4
  here), and is a coin everywhere else.

**Refusals.** The file collects every clause's refusal, prints all clauses, and then exits 1. The #533
early exit for clauses 2-4 stays where it was, before any rate prints.

**Shown.**
- `node tests/probe_random_target_address.js --selftest`: **16 passed, 0 failed**.
  - It adds clause 1: the authority-only bucket is derived (`tgtla`), shared `acc` is excluded, a
    collision is counted, the old blank-only population is empty on today's shape, and an all-shared
    log is empty.
  - It adds clause 6: shared, authority-only and ours-only are split 1 / 1 / 1, and an empty ours-side
    log is caught.
  - It adds clause 5: a translating stub classifies as TRANSLATES, a mixing stub as MIXES, and no
    sample as NO SAMPLE.
- **Old-filter red, again, in memory** (`blankOnly = true`): **14 passed, 2 failed**, exit 1.
- **Refusal wiring on a real run.** The one-game run was repeated in memory with clause 1 handed an empty
  authority log and clause 6 an empty ours-side log (scratch `rta_refuse_demo.js`). Both print
  `MEASURED NOTHING`, and the run ends `REFUSED — 2 clause(s) measured nothing` with **exit 1**.
- **One-game frozen-release run**, `--release bc8d7cf849dd --games 1`: exit 0, every clause populated as
  above, `data/` untouched.
- `register_reality --only 533` still reads CONFIRMED.

**Not done here:**
- The old `byBase`, `perSite` and `meBase` bookkeeping is still computed in the loop. No clause reads it
  any more. It is harmless and was left in, to keep the edit to what was asked.
- The 961-game run in §8 is still owed, and clause 1's collision rate over the full pool is part of what
  it would measure.

### PROPOSED NOTES ROW: fourth follow-up

```
## [x.y.z] — 2026-09-18 — the random-target probe's clauses 1 and 6 read empty buckets and clause 5 printed a conclusion its own sweep contradicted; all three now measure where the draws live and refuse on nothing
- **What changed.** `tests/probe_random_target_address.js`: clause 1 reads every authority-only category (derived per run) plus anything still blank; clause 6 compares the two engines' target-draw addresses in the category the draw is filed under; clause 5 classifies its nth sweep (TRANSLATES / MIXES / UNCLASSIFIED) and prints only the matching reading; clauses 1 and 6 refuse an empty population and the run exits 1 after printing. `--selftest` covers all three.
- **Measured.** One game, release `bc8d7cf849dd`: authority-only `sdrop, tgtla`, `tgtla` 23 draws on 7 bases with 5 collisions; target addresses 4 shared of 4 each side; nth sweep one-digit mean 0.2489 → MIXES. Selftest 16/0; old filter in memory 14/2; empty populations in memory → REFUSED x2, exit 1. Not a figure: one game.
- **Basis.** unchanged.
- **Supersedes.** ~~"the trailing index only TRANSLATES the value — it does not mix"~~ (the probe's clause 5 text, true of the 2026-08-27 hash only).
- **Owed to the next major.** none. Still owed: the `--games 1200` run in §8.
```

**CHANGELOG** (`### Fixed`):

```
- `tests/probe_random_target_address.js` clauses 1 and 6 measured the blank address bucket, which #478
  emptied, and clause 5 printed a "does not mix" conclusion its own sweep contradicted after the driver's
  hash gained a finaliser. Clause 1 now reads the authority-only categories, clause 6 compares both
  engines' target-draw addresses, clause 5 classifies its sweep, and an empty clause fails the run.
```
