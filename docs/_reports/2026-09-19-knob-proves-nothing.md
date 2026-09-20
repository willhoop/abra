# A knob that silences its own probe — the whole class, enumerated, fixed and guarded

2026-09-19, ENGINE, isolated worktree, LIGHT MODE.
Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-ac71d6b782e7d578a`.

This is a findings record, not a living document. It is not current state and is not cited as such.
No lattice, no full battery and no `quarantine.js` was run, so **nothing here is a claim about the
gate.** No engine byte changed in this pass — `engine/medicham2-browser.js` is untouched.

---

## 0. VERDICT

**The class is 59 `(probe, engine knob)` pairs. 28 pairs in 26 files were broken; 27 of them now read
`clean 0 / knob 1`.** The 28th (`probe_midturn_herb_resort`) has its control arm fixed like the rest
and is still red — for a reason that is NOT this class, §6a. One other probe is red on its own clean
run for a real engine reason, §6b. Both are named in the artifact and printed on every run, not filed.

| | pairs |
|---|---|
| population, derived at run time | **59** |
| broken (`clean 0`, `knob 0` — the probe exits 0 against a deliberately broken engine) | **28**, in 26 files |
| now reading `clean 0 / knob 1` | **27** of the 28 |
| declared SILENT CONTROLS, where `knob 0` is the correct pass | **4** (not a defect; the rule was wrong, not the probes) |
| RED on a clean run, so the knob question cannot be asked either way | **2** — `probe_midturn_herb_resort`, `probe_trace_list` |
| table-driven probes, named and not pair-measured | **3** — each measured by hand to exit 1 under a real knob |

The whole population reads: **57 of 59 at `clean 0`** — 53 of those at `knob 1`, 4 at `knob 0` as
their own probe declares — and **2 red on a clean run**.

New guard: **`tests/test-knob-control-arm.js`** (discovered by `run-all.js`'s `tests/test-*.js` glob),
artifact **`data/probe-knob-arms.json`**. Shown RED three ways on deliberately re-broken probes (§5).

---

## 1. PINS AND WHAT WAS RUN

| pin | value |
|---|---|
| `SHOWDOWN_PATH` | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` |
| release cut in this worktree | **`18773c22878f`** — cut 2 of an identical tree, so the id is unchanged (no engine byte moved). `data/engine-release.json`, `cuts.jsonl` and `release.json` were **restored to HEAD afterwards**, as the brief required |
| team pool | the main tree's `data/team-pool-frozen` shards, HARD-LINKED into this worktree (`ln`, not copied — 137 MB shared, 0 MB added). Without them `probe_trace_list` and `probe_weather_forme_faint` read NOT-STAGED, which is a claim about the fixture and not the engine |
| every probe run | `node -r ./tests/_live_release.js tests/<probe>.js`, so no run cut into `data/releases/` |
| NOT run | `quarantine.js`, the lattices, the full battery, `tests/test-mechanics.js`, `status.js --write` |

**A MEASUREMENT HAZARD FOUND AND CLOSED IN THE FIRST TEN MINUTES.** The first sweep ran the probes
*without* the `-r ./tests/_live_release.js` preload. Five of them — `probe_fractional_priority_draw`,
`probe_mega_trace_entry`, `probe_party_key_collision`, `probe_trace_list`, `probe_trace_target` —
**cut ten real releases into `data/releases/18773c22878f/cuts.jsonl` as a side effect of loading the
differential**, and repointed `data/engine-release.json` under whatever else was measuring. Reverted,
and every run since carries the preload.

---

## 2. THE DEFECT, AND WHY IT IS INVISIBLE

A probe that restores a defect behind `MEDI_<KNOB>=1` re-runs ITSELF with the knob set, as a control
arm that asserts nothing and must exit 0. The broken ones keyed that quiet arm on **the knob variable
itself**:

```js
const CHILD = process.env.MEDI_SMART_TARGET_SURVIVES_REDIRECT === '1';
...
if (CHILD) { console.log('CONTROL ARM — asserts nothing'); process.exit(0); }
```

Set the knob from OUTSIDE and the probe takes the quiet path too, so **it exits 0 against a
deliberately broken engine**. From outside that is indistinguishable from a knob wired to nothing —
`memory/an-unwired-knob-gives-identical-output.md` says an identical result across a varied knob IS
the finding, and here the finding was about the probe.

**THE FIX IS A SEPARATE MARKER THE KNOB CANNOT SET.** `ABRA_PROBE_CONTROL_ARM=1`, or an existing
`--red` / `--knob-child` argv where the probe already had one:

```js
const KNOB_SET = process.env.MEDI_SMART_TARGET_SURVIVES_REDIRECT === '1';
const CHILD    = KNOB_SET && process.env.ABRA_PROBE_CONTROL_ARM === '1';
```

and the self-spawn is SKIPPED when `KNOB_SET` — a control child of an already-broken parent compares
a control against a control and reports that the knob changed nothing, which is true and about the
wrong thing.

### Four spellings of the same hole, and the third and fourth were found only by measuring

| shape | example | caught by |
|---|---|---|
| **A. quiet exit** `if (CHILD) { … exit(0) }`, `CHILD` = the bare knob | `probe_smart_target_redirect` and 15 more | the static clause |
| **B. quiet exit, `\|\|` decl** — two knobs on one `CHILD`, one of them wrapped onto a second line | `probe_smart_target_shield_line`, `probe_replacement_entry` | the static clause, only after it was widened twice (§4) |
| **C. assertion BRANCH, no early exit** — the knob selects a whole "the defect must be PRESENT" block instead of the clean clauses | `probe_mega_trace_entry`, `probe_trace_target`, `probe_random_target_die`, `probe_disguise_crit` | **only the measured pair.** The static clause is green on all four and always will be |
| **D. inverted guard** `if (!KNOB) { …every assertion… }` | `probe_sound_lock_restart` | **only the measured pair** |

---

## 3. THE EXIT-CODE TABLE

`clean` = `node -r ./tests/_live_release.js tests/<probe>.js`.
`knob` = the same with `MEDI_<KNOB>=1` set from outside. **The bar is `clean 0` and `knob 1`.**

### 3a. The 28 pairs that were broken (30 rows — one row was already right, one is still red)

The first 18 were measured BEFORE the fix. The next 8 were identified by the static clause after the
detector was widened and were fixed before a "before" could be taken — for those the before column
reads `shape` and is honest about it. The last 3 were measured broken in the first full sweep.

| probe | knob | before | after |
|---|---|---|---|
| `probe_damaginghit_order.js` | `MEDI_DH_IN_EFFECTS` | 0 / **0** | 0 / 1 |
| `probe_entry_update_before_mega.js` | `MEDI_MEGA_BEFORE_UPDATE` | 0 / **0** | 0 / 1 |
| `probe_mega_trace_entry.js` | `MEDI_MEGA_TRACE_LATE` | 0 / **0** | 0 / 1 |
| `probe_midturn_herb_resort.js` | `MEDI_RESORT_BEFORE_UPDATE` | 1 / **0** | 1 / 0 — **still red, §6** |
| `probe_multihit_update.js` | `MEDI_MULTIHIT_UPDATE_ONCE` | 0 / **0** | 0 / 1 |
| `probe_party_key_collision.js` | `MEDI_PARTY_KEY_DISPLAY` | 0 / **0** | 0 / 1 |
| `probe_pickpocket_event_position.js` | `MEDI_PICKPOCKET_IN_HIT_LOOP` | 0 / **0** | 0 / 1 |
| `probe_pickpocket_on_a_corpse.js` | `MEDI_PICKPOCKET_ON_A_CORPSE` | 0 / **0** | 0 / 1 |
| `probe_pivot_after_battle_end.js` | `MEDI_PIVOT_AFTER_BATTLE_END` | 0 / **0** | 0 / 1 |
| `probe_recoil_after_clamp.js` | `MEDI_DEALT_BEFORE_CLAMP` | 0 / **0** | 0 / 1 |
| `probe_refill_entry_herb.js` | `MEDI_REFILL_NO_HERB` | 0 / **0** | 0 / 1 |
| `probe_second_update_pass.js` | `MEDI_NO_SECOND_INMOVE_UPDATE` | 0 / **0** | 0 / 1 |
| `probe_selfboost_empty_foe_side.js` | `MEDI_SELFBOOST_IGNORES_EMPTY_FOE_SIDE` | 0 / **0** | 0 / 1 |
| `probe_selfswitch_update_pass.js` | `MEDI_NO_SELFSWITCH_UPDATE` | 0 / **0** | 0 / 1 |
| `probe_smart_target_redirect.js` | `MEDI_SMART_TARGET_SURVIVES_REDIRECT` | 0 / **0** | 0 / 1 |
| `probe_status_chip_scaled.js` | `MEDI_STATUS_CHIP_UNSCALED` | 0 / **0** | 0 / 1 |
| `probe_trace_target.js` | `MEDI_MID_RANGE_DRAWS` | 0 / **0** | 0 / 1 |
| `probe_transform_faint_revert.js` | `MEDI_TRANSFORM_SURVIVES_FAINT` | 0 / **0** | 0 / 1 |
| `probe_hazard_lay_order.js` | `MEDI_HAZARD_FIXED_ORDER` | shape A | 0 / 1 |
| `probe_quick_claw_above_bracket_zero.js` | `MEDI_FRACPRI_PRIORITY_GATE` | shape A | 0 / 1 |
| `probe_smart_target_immune_line.js` | `MEDI_SMART_IMMUNE_LINE` | shape A | 0 / 1 |
| `probe_smart_target_shield_line.js` | `MEDI_SMART_SHIELD_ALL_SILENT` | shape B | 0 / 1 |
| `probe_smart_target_shield_line.js` | `MEDI_SMART_PROTECT_LINE` | shape B | 0 / 1 |
| `probe_replacement_entry.js` | `MEDI_ENTRY_HAZARD_INLINE` | shape B | 0 / 1 |
| `probe_replacement_entry.js` | `MEDI_REPLACE_SPEED_MODIFIED` | shape B | 0 / 1 |
| `probe_disguise_crit.js` | `MEDI_PREVENTSCRIT_ABILITY_ONLY` | 0 / **0** | 0 / 1 |
| `probe_disguise_crit.js` | `MEDI_FORMEONHIT_THROUGH_DOLL` | 0 / 1 (already right) | 0 / 1 |
| `probe_random_target_die.js` | `MEDI_TGT_ADDR_LEGACY` | 0 / **0** | 0 / 1 |
| `probe_sound_lock_restart.js` | `MEDI_SOUND_LOCK_RESTARTS` | 0 / **0** | 0 / 1 |

### 3b. The pairs that were already correct — 10 measured before any change

`probe_ability_flag_refusal`, `probe_direclaw_attribution`, `probe_fractional_priority_draw`,
`probe_magnetrise_clock`, `probe_perishsong_field`, `probe_rampage_length`, `probe_selfdrop_through_sub`,
`probe_simple_beam`, `probe_sun_refuses_freeze`, `probe_trap_duration` — all **0 / 1** before and after.
Their `CHILD` decorates a label and guards the spawn, and never silences an assertion. That is the
same fix in a different spelling, and it is why the fix is not "delete the CHILD variable".

### 3c. `probe_trap_timing` was NOT a red — it was the runner

Measured **2 / 2** at first and nearly filed as a broken probe. It REFUSES to run without an explicit
`--release <id>` (requiring the differential bare CUTS a release), and the preload does not satisfy
that check. Re-run with `--release 18773c22878f` it is **0 / 1**. The measure runner now retries with
the pointer's id, **records the pin in the artifact and prints it on the line** — a silent retry would
look exactly like a feature that works.

---

## 4. THE THREE PROBES THAT ARE NOT IN THE CLASS, AND WHY NAMING THEM MATTERS

`probe_narration_a`, `probe_narration_c` and `probe_multihit_reaction_per_arrival` gate on
`PROBE_NARA_CHILD` / `PROBE_NARC_CHILD` / `PROBE_MHR_CHILD` — names they SET in their own child and
read to go quiet, which is the same *syntax* as the defect. They are correct: that name is a bare
marker with no engine effect, so setting it cannot break the engine, and their real knobs are chosen
at run time from their own tables. **Measured rather than argued:**

```
MEDI_ROOST_ANNOUNCE_FLYING_ONLY=1  probe_narration_a                   exit 1
MEDI_FOREWARN_SILENT=1             probe_narration_c                   exit 1
MEDI_REACT_LATE_ONCE=1             probe_multihit_reaction_per_arrival exit 1
```

They are PRINTED on every run of the guard as NOT PAIR-MEASURED with the reason, because an unlisted
exclusion is how a population quietly shrinks.

### The four SILENT CONTROLS, which a naive rule would have called broken

Three probes deliberately re-run themselves under **another** probe's knob to show the two fixes are
independent — `ok(quiet.status === 0, 'SILENT CONTROL — an unrelated knob does not move this probe')`.
A rule that demanded `knob 1` everywhere would have condemned four correct files:

| probe | knob | expected |
|---|---|---|
| `probe_accuracy_modifier_chain.js` | `MEDI_WEATHER_FORME_SURVIVES_FAINT` | **0** |
| `probe_mental_herb_update.js` | `MEDI_WEATHER_FORME_SURVIVES_FAINT` | **0** |
| `probe_pressure_terrain_target.js` | `MEDI_WEATHER_FORME_SURVIVES_FAINT` | **0** |
| `probe_weather_forme_faint.js` | `MEDI_PP_PRESSURE_STATIC_TARGET` | **0** |

The guard reads the declaration off the probe's own line (`SILENT CONTROL` on the same line as the
knob) and prints the classification for every pair. All four measure 0 as declared.

### The enumeration got it wrong three times before it was right, and each error was PRINTED first

| attempt | what it produced | why it was wrong |
|---|---|---|
| `spawnSync(process.execPath, [[^\]]*__filename[^\]]*]` | 16 of 30 | the real argument list is `[...(process.execArgv \|\| []), __filename]`, whose inner `[]` ends a character class early. **14 pairs reported absent** |
| `engineSrc.includes(name)` for "is it an engine knob" | 60+, including `SHOWDOWN_PATH` | engine/ certainly reads `SHOWDOWN_PATH`; it is a PATH, not a switch. Now the shape `process.env.X === '1'` is the test |
| env-literal names only | missed 5 files | five probes set the child's knob through a COMPUTED key (`env: { [knob]: '1' }`) while reading one fixed name at the top. All five were in the broken class and were filed as "chosen at run time" |
| line-scoped decl pattern in the static clause | green on `probe_accuracy_modifier_chain` | its `\|\|` wraps onto a second line. Matched over the whole source now |

Each wrong population was printed in full before anything rested on it, which is the standing rule
about a derived tag that over-matches, and it is the only reason these were caught.

---

## 5. THE GUARD, AND THREE RED DEMONSTRATIONS

`tests/test-knob-control-arm.js`. Discovered by `run-all.js`'s `tests/test-*.js` glob — **deliberately
NOT added to `GATES`**, because `run-all.js`'s own exemption table warns twice that a GATES entry for a
discovered file buys a second execution of the same command (the probe_red_demo trap).

- **CLAUSE 1 — the population, derived.** A file under `tests/` that spawns ITSELF with a name
  `engine/` reads as `process.env.X === '1'`. Nothing is typed. Prints all 59 pairs, the 3 table-driven
  exclusions and the 4 silent controls.
- **CLAUSE 2 — the static shape.** A variable assigned STRAIGHT from the knob, with no `&&`
  conjunction, must not guard a block that exits 0. Catches shapes A and B. **~1 second.**
- **CLAUSE 3 — the measured pair, ratcheted.** Reads the RECORDED exit codes from
  `data/probe-knob-arms.json` and re-hashes the probe file — the hash-not-mtime arrangement
  `engine/em_validation.js --check` already uses, because a live sweep of 59 pairs is ~30 minutes and
  this file is in the suite. Edit a probe and its verdict goes stale and this goes red.
  `--measure [file]` re-runs and rewrites.
- **The clean-red list is NAMED, not counted.** A bare count lets one probe get fixed and another go
  red in the same pass and reports nothing.

Total runtime of the gate: **under 2 seconds.**

### Shown red on deliberately re-broken probes, three ways

| what was re-broken | result |
|---|---|
| `probe_smart_target_redirect`'s decl reverted to the bare knob | **CLAUSE 2 RED** (`:76 — CHILD is the bare knob and guards an exit(0) at line 275`) **and CLAUSE 3 RED** on the stale digest `f4c97a6d62128b61 -> fc6d85f0ddfdb30e`. Exit 1 |
| …then `--measure`d, to check the re-measurement cannot launder it | `measured clean=0  MEDI_SMART_TARGET_SURVIVES_REDIRECT=1 -> 0` and **CLAUSE 3 RED**: *"leaves it GREEN"*. Exit 1 |
| `probe_random_target_die` reverted to the **branch** shape (C), which CLAUSE 2 cannot see | **CLAUSE 2 green — 59 checked**, **CLAUSE 3 RED**. Exit 1. This is the demonstration that the two clauses are not redundant |

Both probes and the artifact were restored; the gate is **exit 0** on the final tree.

---

## 6. TWO PROBES ARE RED ON THEIR OWN CLEAN RUN. THEY ARE NOT THIS CLASS AND THEY ARE NOT FIXED.

Both were red before this pass and are red now. They are named in `data/probe-knob-arms.json`
(`clean_red_allowed`) with the measured reason and printed on every run of the guard; a THIRD one
appearing fails the gate by name. **Neither is waived, and neither is "known".**

### 6a. `probe_midturn_herb_resort.js` — the knob reaches its code and the board does not move

```
green  the knob REACHED THE CODE it names (MEDFAILS.resortBeforeUpdateRestored) — counter 1
RED    the knob CHANGES the real arm — default holder vs control holder
RED    the control arm parts on its own line, so the knob reached the RULE — no divergence at all
```

The counter line is NEW in this pass — the probe had no receipt distinguishing *"the knob changed
nothing"* from *"the knob reached no code"*, which are different defects that read identically at the
board. It now reads **1**: `MEDI_RESORT_BEFORE_UPDATE=1` really does run the re-sort above
`_updateAll()` (`engine/medicham2-browser.js:31459`) and skips the correct one (`:31508`), and the
staged cast still resolves the same way.

**The staged fixture is also ILLEGAL**, by `game_differential.js`'s own legality check and not by
recall: *"FIXTURE ILLEGAL (built at tests/probe_midturn_herb_resort.js:206, NOT baselined): Slurpuff
can't learn Covet"*, 2 of 9 sets. The cast is Morpeko @ Choice Scarf clicking Parting Shot at Slurpuff
@ White Herb [Unburden] with Pidgeot clicking Tailwind; authority speeds pivot 223, holder 124,
ally 143.

**Owed:** either a fixture that still discriminates between the two placements, or a measured finding
that they are now equivalent for this board. That is a fixture rebuild and belongs to whoever owns the
mid-turn herb; it is not the knob-control-arm class and was not attempted here.

### 6b. `probe_trace_list.js` — a real engine divergence, one draw in 2,442

Over the pinned pool, **8,778 teams / 222 Trace boards / 2,442 joined draws**:

```
identical list (same members, same order)   2442
MEMBERSHIP differs                          0
ORDER differs, same members                 0
same list, DIFFERENT INDEX drawn            1
  MIRROR  gen9championsvgc2026regmbbo3-2655593982  t6/5  holder p1[1]
      showdown list [p2[0]:whimsicott:prankster  p2[1]:metagross:clearbody]  idx 0 -> whimsicott
      medicham list [p2[0]:whimsicott:prankster  p2[1]:metagross:clearbody]  idx 1 -> metagross
```

The probe's own knob arm works (`idx 1 -> 8` under `MEDI_TRACE_SOLO_NODRAW=1`), so the instrument is
sound and **the ENGINE is what is red.** One shared list, two different indices, on a mirror board at
turn 6. **Owed:** the Trace index defect. Not attempted — it is a die-address question and this brief
was probe hygiene.

---

## PROPOSED NOTES ROW

> ### 2026-09-19 — a red-demonstration knob that leaves its own probe green proves nothing, and 29 of them did
>
> **What changed.** Every `(probe, engine knob)` pair under `tests/` is now enumerated from what the
> code DOES — a file that spawns itself with a name `engine/` reads as `process.env.X === '1'` — and
> each one is measured as a pair: the probe must exit **0** clean and **1** with its knob set from
> outside. **28 pairs in 26 files failed that**, because their quiet control arm was keyed on the knob
> variable itself, so setting the knob took the quiet path and the probe exited 0 against a
> deliberately broken engine. The control arm now carries its own marker (`ABRA_PROBE_CONTROL_ARM=1`,
> or the `--red` / `--knob-child` argv where one already existed) and the self-spawn is skipped when
> the knob came from outside. **27 of the 28 now read 0 / 1**; the 28th is red for a separate reason,
> below.
>
> **The figure and where it came from.** `data/probe-knob-arms.json` — **59 pairs measured, 57 at
> `clean 0`, 4 of those declared SILENT CONTROLS where `knob 0` is the pass, 2 red on their own clean
> run and named.** `tests/test-knob-control-arm.js` re-checks it in under 2 seconds against a content
> digest of each probe, and was shown RED three ways on deliberately re-broken probes — including one
> re-break its static clause is structurally blind to, which is why the measured clause exists.
>
> **Two reds carried forward, not waived.** `probe_midturn_herb_resort.js` is red because
> `MEDI_RESORT_BEFORE_UPDATE=1` reaches its code (`MEDFAILS.resortBeforeUpdateRestored = 1`, a receipt
> added in this pass) and no longer moves its staged board, whose fixture is additionally illegal by
> the differential's own check. `probe_trace_list.js` is red on a real engine divergence: **1 of 2,442
> joined Trace draws took a different INDEX from a list both engines built identically.** Both are
> named in the artifact and printed on every run.
>
> **Supersedes.** Nothing. No published figure moves; no engine byte changed.
>
> **Basis.** unchanged.
>
> **Owes a fold-in to.** `docs/ENGINE.md` (done in the same pass: the Owns list and the instruments
> table).

---

## OWED, NOT RUN

1. **`probe_trace_list.js`'s Trace INDEX divergence is an open ENGINE defect** — 1 of 2,442 draws,
   §6b. Not attempted. It is a die-address question and needs its own pass.
2. **`probe_midturn_herb_resort.js` needs a fixture that discriminates** — §6a. Its staged Slurpuff
   set is ILLEGAL by the differential's own legality check, and the knob reaches its code and moves
   nothing. Not attempted.
3. **`CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`, `engine/game_differential.js`
   were NOT touched, and `status.js --write` was NOT run**, as the brief required. The notes row above
   is proposed text only.
4. **No lattice, no full battery, no `tests/test-mechanics.js`, no census regeneration.** The census
   count is therefore not quoted anywhere in this report, and nothing here is a claim about the gate.
5. **The "before" column for 8 of the 29 pairs reads `shape`, not a measurement** (§3a). They were
   identified by the static clause after the detector was widened and fixed before a before-run could
   be taken. Their AFTER is measured; their BEFORE is the source shape.
6. **`data/team-pool-frozen` in this worktree now holds two HARD LINKS to the main tree's shards.**
   They are untracked, share the same inodes (0 bytes added), and were created so `probe_trace_list`
   and `probe_weather_forme_faint` could stage. Left in place; nothing was deleted. Any other
   worktree-isolated agent hits the same NOT-STAGED until it does the same.
7. **The full `--measure` sweep was run once over the whole population and once over 11 files.** The
   artifact's `generated` stamp is the LAST write, so it is newer than some of the measurements it
   carries; each pair carries its own probe digest, which is the thing that actually invalidates.
8. **NOT CLAIMED: that the 28 fixes are independent of one another.** They were applied in three
   batches (16 by codemod, 5 by a second codemod plus one by hand, 3 by hand) and measured per batch.
9. **Ten real releases were cut into `data/releases/18773c22878f/` by the first unpreloaded sweep and
   were reverted** (§1). If anything downstream read that store between 01:02 and 01:05 UTC on
   2026-09-20, it saw a pointer with `cuts: 11`.
