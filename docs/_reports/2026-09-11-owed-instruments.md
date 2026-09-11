# 2026-09-11 — The owed instruments: 20 probes for the 20 "still true, instrument owed" register rows

ENGINE, instrument pass. This is a historical record (see CLAUDE.md on `docs/_reports/`); it is not maintained and it is not current state.

**What this pass wrote:** 20 new files under `tests/`, plus this report. It edited no existing file, did not fix the engine, and made no commit or push.

**What it ran:** single staged boards and short staged turns only. It ran no differential, roster, census, H2H or `register_reality.js`. The one exception is `engine/all_mechanics_fire.js --limit 1`, run twice with `--out` pointed at scratch.

**Pin:** every engine-facing probe runs against the frozen release **`2b5a6585d8cf`** by default (`--release` overrides it). Showdown is `20ad99f`; the format is `gen9championsvgc2026regmb`.

## Verdict

| | Count | Rows |
|---|---:|---|
| **RED as the row claims** — fails today on `2b5a6585d8cf`, cell named | **16** | #318 #323 #325 #348 #349 #350 #375 #380 #399 #412 #425 #467 #511 #524 #529 #535 |
| **REFUTED** — green today; the row's claim is false on this release | **3** | #310 (the rollout half), #440 (every staged shape), #541 (the fainting-holder half, fixed in the release; green-then-red shown) |
| **Written, NOT RUN** | **1** | #442 — it regenerates the whole census, which this brief forbade; only `--dry` was run |

**Effect on the gate.** Once the markers are applied and a register pass runs, up to 16 open rows name a RED instrument. The open-defect clause (`openDefectClause`, `ok: withRed.length === 0`) goes **RED**, which is the intended direction.

**Cause of the three refutations:**
- **#310:** a rollout's `battleInit` is seeded, and the seeded path skips the lead entry pass. Trace then resolves on the per-turn retry sweep, which draws from `battleTurn`'s own streams.
- **#440:** the release has modelled the conditional drain since 2026-08-26, and all four staged shapes agree, including the pool game's rain-plus-emptied-slot shape. The one pool divergence has a cause these boards do not reproduce.
- **#541:** the release carries the `_faintOut === false` fix, and `MEDI_ACQUIRED_START_NEEDS_HP=1` turns the probe red.

## How each probe is built

- **ABRA-EXIT on every path.**
  - 0 is `VERDICT-GREEN`, 1 is `VERDICT-RED`, 2 is `CANNOT-ANSWER`.
  - Every probe installs an `uncaughtException` handler that prints `ABRA-EXIT 2 CANNOT-ANSWER`, because Node exits 1 on a throw and the register would read that as RED. This handler was added after three staged probes crashed early and exited 1 with no verdict (see *Instrument faults*).
  - A staging refusal prints `CANNOT ANSWER — <why>` and exits 2. It is never exit 0, which is #524's own defect.
- **Staged probes** (#318, #511, #529, #535, #541, #440) play through `tests/staged_board.js`'s harness on the pinned release:
  - The board is compared at every boundary by `engine/board_state.js`.
  - The protocol is compared by the driver's own aligner (`r.div`); speed by the driver's `speedRows`, for #535.
  - Nothing types an expected value, and Showdown is the expectation.
- **Fixture legality** comes from Showdown's `TeamValidator` for the regulation, checked for every body, ability, item and move, and printed. A fixture that is not legal is refused. `engine/stage_planner.js` was not used; the validator does the same job directly.
- **Every cell names its cell:** the row, the leaf or line, and both values.
- **Knob hooks.** Where a `MEDI_*` knob exists, the probe honours it and labels the arms expected to go RED. Where none exists yet, the probe reads a proposed name that ENGINE should create with the fix: `MEDI_UNBURDEN_FROM_CURRENT_ABILITY` for #535 and `MEDI_HITCOUNT_DROP_ON_COLLAPSE` for #511. Static probes take `--artifact <path>` or `--plant` instead.

## Per row

Figures are from runs on 2026-09-11 between 09:08Z and 09:47Z, against release `2b5a6585d8cf`, with the committed artifacts read via `git show HEAD:`.

| Row | Probe | Verdict | The cell (verbatim where short) | Control / red-first |
|---|---|---|---|---|
| #310 | `tests/probe_rollout_trace_stream.js` | **REFUTED (rollouts)** | `rolloutWinProb`, Trace lead, 3 samples x 3 turns: `traceChoiceDie +3, traceChoiceNoDie +0 (traceRetryCopied +3)`. | Synchronize lead 0/0. Unseeded `battleInit` WITH `rng` gives Die +1. The PLANT, unseeded `battleInit` with no `rng`, gives NoDie +1, so the counter reads the defect where it still exists. |
| #318 | `tests/probe_roster_learnset_refusals.js` | **RED** | **420 distinct refused body/move pairs over 39 bodies** across the three stages (item 40, ability 54, move 340); the heaviest body is `goodrahisui 325`. The row said 632 on 2026-08-21: this is re-measured, not a before/after. | The roster's own `assign()` plus `SB.fixtureAudit` in report mode, no game played. Controls: garchomp/rockslide reports 0; snorlax/swordsdance reports 1. |
| #323 | `tests/probe_mutation_classA_sibling.js` | **RED** | **33 of 36** class-A carrier x tag rows say "Nothing in the simulator implements this fact" while a *specific* sibling tag on the carrier is read. The row's example `move:leechseed / immunityGate` has read siblings `perTurnHP, statusInflict, volatileAnnounce`. | Premise re-checked: no class-A tag is itself read. Tags carried by more than 25% of a kind are excluded as siblings (printed: `pp`, `targetClass`, `formatSecondaryCount`, `statusCategory`, `moveClass`, `contact`, `breakable`, `megaStone`, `flingable`). 3 rows have no read sibling and are not flagged. The artifact is on release `6fb9ebd3b704` and is checked against that release's source. |
| #325 | `tests/probe_mutation_provenance_params.js` | **RED** | `summary.provenanceParamsSkipped` is absent, and **17 of 998** READ-AND-IGNORED rows mutate a citation. First cell: `move:feint / breaksProtect.from = "DERIVED:..."`. The row said 11. | Membership printed. 18 name-matches were REJECTED as game facts (`via: "secondary"`, `from: "Palafin"`), and a class-D (dereferenced) row is rejected. 1,154 non-provenance rows are untouched. |
| #348 | `tests/probe_lownode_argv.js` | **RED (Git Bash one-string route only)** | ROUTE B, `cmd //c "tools\\lownode.cmd ... --why \"a vs b\""`: node received `["--why","\"a","vs","b\""]`. ROUTE B with `C:/Users/willj/x.json`: node received `["C;C:\\Program","Files\\Git\\Users\\willj\\x.json"]` (MSYS path-list conversion). | ROUTE A (node to `cmd.exe /c`) and ROUTE C (Bash, separate words) are green on all four arms; the plain control is green on every route. The file is its own child (`--child-echo`). |
| #349 | `tests/probe_divergence_rank_side.js` | **RED** | The head row is the Defiant cause at **214,548** uses, which is `move/protect`, named only by the medicham line. It sits above the Sitrus cause at 34,983, with no side printed. | The real `divergence_report.js` runs in a scratch tree on a two-cause fixture. With the `protect` mention removed, Sitrus heads the list. Usage comes from the release's `tags.json`. |
| #350 | `tests/probe_open_defect_marker_debt.js` | **RED** | (1) A fixture row carrying `VERIFIED BY: \`node ...\`` lands only in `debt`, under "assert breakage with NO instrument that decides them". (2) An artifact generated 2000-01-01, against a ROADMAP mtime of 2026-09-11T07:45Z, gets no staleness line. | The real `openDefectClause()` runs with `fs.readFileSync` intercepted for the two paths only. An unmarked row correctly goes to debt, and a future-dated artifact is not called stale. |
| #375 | `tests/probe_differential_cause_context.js` | **RED** | On the one cause (`|upkeep <> |faint|p1a`): (1) before/sdAfter/meAfter = true/false/false; (2) species/attribution = false/false (mentions 0); (3) `entryOrderTie` and `replaceOrderTie` are absent from the artifact. | The caps (`.slice(0, 60)` at `game_differential.js:9581`, `.slice(0, 40)` at `:8460`) are printed as structural context and are not a cell: they cannot bite at 1 divergent game. |
| #380 | `tests/probe_open_defect_refusal_holds.js` | **RED** | (2) Fixture #9201 with `green:null` gives `ok=true, cannot_answer=undefined`, bucketed `unrunnable`. (3) STRUCTURAL: `run-all.js` never requires a shared classifier, and `register_reality.js` does not export `classifyExit`. | The same row with `green:false` gives ok:false, and with `green:true` gives ok:true. Half (1)'s sentence is fixed and is printed as context. |
| #399 | `tests/probe_divergence_cards_stale.js` | **RED** | The dump is on `791c9fd873f3` and the differential on `2b5a6585d8cf`. `divergence_cards.js` exits 0, and its page and console output are **byte-identical** to a matched control once release ids are blanked. The same holds for a planted `ffffffffffff`. | The control (the dump re-stamped with the differential's release) renders. The first form of this probe grepped for "stale" and its control went red on card text; see *Instrument faults*. |
| #412 | `tests/probe_priority_bar_effective_ability.js` | **RED (structural; exposure zero)** | With the one `RUNTIME_ALLOWED` entry cut in memory, `test-effective-identity.js` goes from 24/0 to **23/1**, citing `engine/position_features.js:249 x36 [ability]`. | The unmodified test through the same `-r` preload passes 24/0. It refuses unless live `board.js` and `position_features.js` are byte-identical to the release's copies (they are: `c85a3b756c98`, `622482051bf4`). No legal board can show a disagreement, which the row's own entry guard re-derives. |
| #425 | `tests/probe_amf_default_populations.js` | **RED** | `all_mechanics_fire.js` with no `--kind` published `["moves"]` and no rows for abilities or items. | `--kind all` published all three (it exits 1 on its own verdict over 38 games; the artifact is what is read). This decides the "default to all" fix; the "refuse a partial canonical write" fix needs the canonical path and is not staged here. |
| #440 | `tests/probe_perish_faint_upkeep.js` | **REFUTED (staged shapes)** | Four arms all agree, protocol and board: BARE (`perish0 x4 \| upkeep \| faint x4`), FOLLOWER with a turn-2 Tailwind (`faint x4 \| upkeep`), POOL SHAPE (3 perish0, p2b KO'd that turn), and POOL + RAIN (Drizzle, Raichu/Archaludon/Politoed perish0, p2b emptied). | Under `MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP=1`, BARE and POOL SHAPE go RED at `\|upkeep <> \|faint\|`. The pool game's divergence (bo3-2656930062 vs -2656925075, turn 12) is **not reproduced** by any staged shape. |
| #442 | `tests/probe_census_reproduces.js` | **NOT RUN** | — | `--dry` only (it reads committed census 856/856/0 at `da75211ec621`). The full run `git archive`s HEAD to temp, runs `test-mechanics.js` there and diffs. `--plant` flips a row to prove the compare can fail. |
| #467 | `tests/probe_differential_void_attribution.js` | **RED (field; no bite)** | The cause `\|upkeep <> \|faint\|p1a` (n=1) has no `void_n`. `mid_void.void_games` = 0, so the clause arithmetic is unaffected on this artifact. | The row's (a) half belongs to #543. |
| #511 | `tests/probe_volley_collapse_clamp.js` | **RED** | ENDURE: authority `\|-hitcount\|...Garchomp\|4`, and medicham announced NO count. FOCUS SASH: authority 2, and medicham NO count. `hitCountDroppedOnCollapse` +1 on each. Both routes also part in protocol order: `-supereffective` against medicham's `-activate`/`-enditem`. | The control (no clamp) agrees, 2 vs 2. Both routes are selected on the authority's stream. Boards agree on all arms (HP-neutral). |
| #524 | `tests/probe_couldnotstage_exit_zero.js` | **RED** | **7 sites in 4 files:** `probe_hazard_recap_fail.js:108`, `probe_protect_stage_order.js:107`, `probe_sound_lock_restart.js:106,187,196`, `probe_trap_timing.js:115,149`. The row said 12; 5 have been converted since. | The converted site `probe_hazard_recap_fail.js:132` is read as converted, as are 16 converted sites in 11 files. `--plant` adds one, which goes red. |
| #529 | `tests/probe_stealeat_derivation.js` | **RED (derivation)** | In release `tags.json`: `bugbite` has handler eats=true but `consumesAndGainsEffect=false`, and `pluck` is the same. The other 7 `takesTargetItem` moves agree. | The engine half agrees on both arms (Sitrus eat; Leftovers control), with `stealEatViaClassGuard` +1 on the eat arm. Under `MEDI_STEALEAT_STRIP_ONLY=1` the eat arm goes RED: `p1.party.scizor.hp` ours 109 against authority 145, plus `ate_berry`. |
| #535 | `tests/probe_unburden_acquired.js` | **RED** | `p1a clefable` at boundaries 3 and 4: authority **112**, medicham **224** (x2.00), ability `unburden` on both engines, item empty. | CONTROL 1: Liepard holding Unburden loses Leftovers, and the authority's Speed goes 158 to 316 with no disagreement. CONTROL 2: Clefable keeps its item and nobody doubles. |
| #541 | `tests/probe_contact_transfer_fainting_holder.js` | **REFUTED (fainting-holder half fixed)** | The KO arm agrees on board and protocol: the authority writes `-activate\|p2a: Scrafty\|Skill Swap\|...\|Intimidate` and then `-unboost` on both p2 bodies, before `faint\|p1a: Runerigus`. `acquiredStartAtZeroHP` reads +1. | The non-contact KO control agrees. Under `MEDI_ACQUIRED_START_NEEDS_HP=1` it goes RED: `p2.party.scrafty.boosts.atk` ours 1 against authority 0, `hydreigon` ours 0 against authority -1. |

## Instrument faults found in this pass, before any result was reported

Each was mine, and each pointed toward a comfortable answer.

1. **#323 over-matched.** Its first form flagged 36 of 36 on `pp`, `targetClass` and `formatSecondaryCount`. Generic siblings are now excluded and printed.
2. **#325 over-matched.** It counted `goodasgold blocksMove.what`, which the simulator dereferences (class D). Now rejected, with the membership printed.
3. **#399's control went red.** The regex "stale|mismatch" matched card text. It is now a normalised page diff against the control.
4. **#310's controls ran `battleInit` seeded,** which skips the lead pass, so they read 0/0 and asked nothing. They now run unseeded.
5. **#348's route B generated its own quoting,** so its control arrived as `"alpha"`. Each arm is now typed the way an agent types it.
6. **#535 used Alakazam.** Knock Off OHKO'd it on turn 1; it is now Clefable.
7. **#511's hitcount regex required `p2a:`.** A fainted body is `p2:`, so the control and the Sash route compared null to null and "agreed". The regex is fixed, and the probe now refuses if the control has no count.
8. **#440 ran 3 turns.** Perish needs 4. Its rain arm then KO'd its own Archaludon.
9. **Three staged probes crashed before printing** (a bash loop mangled the script path) and exited 1 with no verdict. That is why every probe now installs the throw guard.

## Hazards and side effects, checked

- **No release was cut by this pass.**
  - `d44869164a40`'s cuts (08:53Z) predate the first file I wrote (09:08Z).
  - `13257c8bc397` is ENGINE's own "batch B" cut (09:25Z).
  - The canonical `data/all-mechanics-fire.json` and `data/game-differential.json` that moved at 09:34–09:35Z are stamped `13257c8bc397`, which is ENGINE's re-measure.
- **Files:** the 20 probes plus this report. The other untracked `tests/probe_*.js` (`ability_flag_refusal`, `bond_secondary_order`, `magnetrise_clock`, `rampage_length`, `simple_beam`) and the `_prediction-*`/`engine-fixes.md` files belong to the live ENGINE agent and were not touched.
- **The default pin is `2b5a6585d8cf`.** A marker run later with no `--release` would keep testing the old engine and stay red after a fix. Every engine-facing `VERIFIED BY` below therefore carries `--release <REL>`, which is the release ENGINE's commit cuts. Confirm that `register_reality.js`'s `SAFE` guard admits a flag with a value (`node engine/register_reality.js --list`), as the plan report also asked for #393.
- **run-all classification.** 11 of the probes load a game module (`staged_board` or `engine_release`) and become derived **PENDING-WIRE** once named in `docs/ENGINE.md`: #310 #318 #323 #325 #349 #412 #440 #511 #529 #535 #541. The other **9 load no game module and would stay UNACCOUNTED FOR** even with a ledger row: #348 #350 #375 #380 #399 #425 #442 #467 #524. They need a hand `PENDING_WIRE` entry in `tests/run-all.js`, or wiring as checks. Wiring them ships red checks, since they are red by design until the fixes land, so that is the coordinator's call. **Until one of those is done, `tests/run-all.js`'s coverage assertion fails on these 20 new files.**
- **#310's residual.** The rollout path is clean. The callers that still reach the no-die branch are unseeded `battleInit` with no `rng`: `engine/bench_speed.js:179`, `engine/game_differential.js:6591,6632`, `engine/million_run.js:762,1867`, `engine/replay_differential.js:971,1125`, `engine/speed_vs_pokeenv.js:185` and `tests/mutation_harness.js:365`. Self-play was not measured here.

## For the applier — after ENGINE lands

### `VERIFIED BY` lines (each starts with `node`, ROADMAP #579)

`<REL>` is the release ENGINE's commit cuts.

```text
#310  VERIFIED BY: `node tests/probe_rollout_trace_stream.js --release <REL>`
#318  VERIFIED BY: `node tests/probe_roster_learnset_refusals.js --release <REL>`
#323  VERIFIED BY: `node tests/probe_mutation_classA_sibling.js`
#325  VERIFIED BY: `node tests/probe_mutation_provenance_params.js`
#348  VERIFIED BY: `node tests/probe_lownode_argv.js`
#349  VERIFIED BY: `node tests/probe_divergence_rank_side.js`
#350  VERIFIED BY: `node tests/probe_open_defect_marker_debt.js`
#375  VERIFIED BY: `node tests/probe_differential_cause_context.js`
#380  VERIFIED BY: `node tests/probe_open_defect_refusal_holds.js`
#399  VERIFIED BY: `node tests/probe_divergence_cards_stale.js`
#412  VERIFIED BY: `node tests/probe_priority_bar_effective_ability.js --release <REL>`
#425  VERIFIED BY: `node tests/probe_amf_default_populations.js --release <REL>`
#440  VERIFIED BY: `node tests/probe_perish_faint_upkeep.js --release <REL>`
#442  VERIFIED BY: `node tests/probe_census_reproduces.js`
#467  VERIFIED BY: `node tests/probe_differential_void_attribution.js`
#511  VERIFIED BY: `node tests/probe_volley_collapse_clamp.js --release <REL>`
#524  VERIFIED BY: `node tests/probe_couldnotstage_exit_zero.js`
#529  VERIFIED BY: `node tests/probe_stealeat_derivation.js --release <REL>`
#535  VERIFIED BY: `node tests/probe_unburden_acquired.js --release <REL>`
#541  VERIFIED BY: `node tests/probe_contact_transfer_fainting_holder.js --release <REL>`
```

**Rows the refutations change:**
- #310's rollout claim and #541's last half are false on `2b5a6585d8cf`; re-cell them on the probe's green.
- #440 as filed ("one line early when nothing follows") is false for every staged shape. The pool instance needs a replay of that exact game, not a staged board.
- #442 stays marker-only until its heavy run is scheduled.
- #412 and #380 (3) are structural reds, with no outcome to stage.

### `docs/ENGINE.md` mechanism-table rows

Each probe must be named in backticks so `tests/run-all.js` derives PENDING-WIRE for the 11 game-loading probes.

```text
### OWED INSTRUMENTS — 2026-09-11 (docs/_reports/2026-09-11-owed-instruments.md)

| # | what the authority does / what the instrument checks | probe | knob |
|---|---|---|---|
| #310 | a Trace resolution inside a rollout draws its target from a stream | `tests/probe_rollout_trace_stream.js` | plant: unseeded battleInit, no rng |
| #318 | the deliberate roster stages no body/move pair the TeamValidator refuses | `tests/probe_roster_learnset_refusals.js` | — |
| #323 | no class-A mutation row says "nothing implements this fact" beside a read sibling tag | `tests/probe_mutation_classA_sibling.js` | `--artifact` |
| #325 | the mutation battery skips, and counts, provenance params | `tests/probe_mutation_provenance_params.js` | `--artifact` |
| #348 | tools/lownode.cmd delivers spaced and drive-letter arguments byte for byte | `tests/probe_lownode_argv.js` | — |
| #349 | the divergence worklist ranks by the line that differs, or names the key's side | `tests/probe_divergence_rank_side.js` | — |
| #350 | the open-defect clause separates "names a marker, no verdict" from "names nothing", and says STALE | `tests/probe_open_defect_marker_debt.js` | — |
| #375 | every divergence cause carries context, species/attribution and the tie counters | `tests/probe_differential_cause_context.js` | `--artifact` |
| #380 | an open row whose instrument refused holds the clause as CANNOT-ANSWER; one exit classifier | `tests/probe_open_defect_refusal_holds.js` | — |
| #399 | the card renderer refuses or marks a dump from another release | `tests/probe_divergence_cards_stale.js` | — |
| #412 | the priority bar's defender list resolves the effective ability (tripwire with no allowlist entry) | `tests/probe_priority_bar_effective_ability.js` | — |
| #425 | a default all_mechanics_fire run publishes moves, abilities and items | `tests/probe_amf_default_populations.js` | — |
| #440 | a perish death's `\|faint\|` lands on the authority's side of `\|upkeep\|` (bare, follower, pool, pool+rain) | `tests/probe_perish_faint_upkeep.js` | `MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP=1` |
| #442 | the committed tree reproduces the committed census | `tests/probe_census_reproduces.js` | `--plant` |
| #467 | every divergence cause carries `void_n` | `tests/probe_differential_void_attribution.js` | `--artifact` |
| #511 | a clamped multi-hit volley (Endure, Focus Sash) still announces the authority's `\|-hitcount\|` | `tests/probe_volley_collapse_clamp.js` | `MEDI_HITCOUNT_DROP_ON_COLLAPSE=1` (to be created) |
| #524 | no probe prints a staging refusal and exits 0 | `tests/probe_couldnotstage_exit_zero.js` | `--plant` |
| #529 | takesTargetItem.consumesAndGainsEffect agrees with the format's handler; Bug Bite eats on both engines | `tests/probe_stealeat_derivation.js` | `MEDI_STEALEAT_STRIP_ONLY=1` |
| #535 | an Unburden acquired with an empty hand does not double Speed (no volatile) | `tests/probe_unburden_acquired.js` | `MEDI_UNBURDEN_FROM_CURRENT_ABILITY=1` (to be created) |
| #541 | a contact KO of a Wandering Spirit holder still swaps and Starts the acquired ability | `tests/probe_contact_transfer_fainting_holder.js` | `MEDI_ACQUIRED_START_NEEDS_HP=1` |
```

### Notes-row text

For `docs/RUNNING-NOTES.md`. ENGINE assigns the version, and the CHANGELOG entry must land with it.

```text
## [<version>] — 2026-09-11 — twenty owed instruments: sixteen rows now read RED on a measurement, three are refuted, one is written and not run

- **What changed.** Twenty new `tests/probe_*.js`, one per register row that asserted a live defect with nothing deciding it (#310 #318 #323 #325 #348 #349 #350 #375 #380 #399 #412 #425 #440 #442 #467 #511 #524 #529 #535 #541). No existing file edited; engine untouched. Every probe declares ABRA-EXIT on every path, treats a throw as CANNOT-ANSWER, names its failing cell, carries a control that differs in one variable, and pins release 2b5a6585d8cf by default. Detail: `docs/_reports/2026-09-11-owed-instruments.md`.
- **Measured.** On release 2b5a6585d8cf: 16 RED as their rows claim, 3 refuted (#310's rollout half; #440 on four staged shapes including the pool game's rain-plus-emptied-slot shape; #541's fainting-holder half, green-then-red shown under MEDI_ACQUIRED_START_NEEDS_HP=1), 1 not run (#442, a census regeneration). Re-measured rather than quoted: #318 420 distinct refused pairs over 39 bodies (the row read 632 on 2026-08-21, different release), #524 7 exit-zero refusal sites in 4 files (the row read 12), #325 17 mutated citations scored READ-AND-IGNORED (the row read 11), #323 33 of 36 class-A rows unsupported.
- **Supersedes.** Nothing published. The register figures above are re-measurements on another release, not a before/after.
- **Basis.** unchanged.
- **Owed to the next major.** none.
```

## OWED, NOT RUN

Run these **after the live ENGINE agent commits and cuts its release** `<REL>`, wrapped in `tools\lownode.cmd` from PowerShell (`cmd /c tools\lownode.cmd <script> <args>`).

The census reproduction (#442). It is heavy, since it plays every census probe inside a temp checkout of HEAD, and it writes nothing in the repository:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/probe_census_reproduces.js
node tests/probe_census_reproduces.js --plant    # must go RED: the compare can fail
```

Confirm the register's `SAFE` guard admits `--release <id>` before applying the release-pinned markers:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/register_reality.js --list
```

Re-run every engine-facing probe on ENGINE's landed release (replace `<REL>`):
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/probe_rollout_trace_stream.js --release <REL>
node tests/probe_roster_learnset_refusals.js --release <REL>
node tests/probe_priority_bar_effective_ability.js --release <REL>
node tests/probe_amf_default_populations.js --release <REL>
node tests/probe_perish_faint_upkeep.js --release <REL>
node tests/probe_volley_collapse_clamp.js --release <REL>
node tests/probe_stealeat_derivation.js --release <REL>
node tests/probe_unburden_acquired.js --release <REL>
node tests/probe_contact_transfer_fainting_holder.js --release <REL>
```

The green-then-red demonstrations, once ENGINE has created the two proposed knobs with its fixes:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
MEDI_UNBURDEN_FROM_CURRENT_ABILITY=1 node tests/probe_unburden_acquired.js --release <REL>
MEDI_HITCOUNT_DROP_ON_COLLAPSE=1 node tests/probe_volley_collapse_clamp.js --release <REL>
MEDI_STEALEAT_STRIP_ONLY=1 node tests/probe_stealeat_derivation.js --release <REL>
MEDI_ACQUIRED_START_NEEDS_HP=1 node tests/probe_contact_transfer_fainting_holder.js --release <REL>
MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP=1 node tests/probe_perish_faint_upkeep.js --release <REL>
```

After the markers and ledger rows are applied, run the register pass and the coverage check. The coverage check stays red on the 9 static probes until they get a `PENDING_WIRE` entry or are wired:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/run-all.js --list
node engine/register_reality.js
node engine/open_work.js
node engine/status.js --write
```

#440's surviving pool divergence needs the exact game replayed, not a staged board:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/replay_one.js --release 2b5a6585d8cf --team-store data/team-pool-frozen \
     --games <the pinned run's --games> --arm middle --config omit-spread \
     --seed "gen9championsvgc2026regmbbo3-2656930062 vs gen9championsvgc2026regmbbo3-2656925075"
```
The flag shape is copied from `engine/replay_one.js`'s own usage header (lines 3-5). `--games` is part of the sample definition (CLAUDE.md), so take it from the flags recorded in `data/game-differential.json` for the 961-game run on `2b5a6585d8cf`. Do not guess it.
