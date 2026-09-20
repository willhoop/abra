# The knob-control-arm guard, taken from 28 clause failures to green — and the exclusion it was hiding

2026-09-19 / 2026-09-20. ENGINE, main tree, LIGHT MODE (probes only; no lattice, no battery, no
`quarantine.js`). Release pin `834713ccb303`. `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.

Census `live` unchanged at **977 of 984** (`data/mechanics-census.json`, generated
2026-09-20T02:12:33Z). Nothing under `engine/` was edited, so the census could not move and was not
regenerated.

---

## 1. The three quiet-arm bugs (CLAUSE 2)

Each of the three probes written earlier tonight had `const KNOB = <bare engine knob>` guarding a
block that calls `process.exit(0)`. Set the knob from outside and the probe takes the quiet control
path and **exits 0 against an engine with the defect deliberately restored** — indistinguishable
from a knob wired to nothing.

The prescribed fix was applied to all three: a separate marker set **only by the probe's own spawn**,
a printed notice when the knob arrives from outside, and the control child **skipped** when the knob
is already set in this process (a child of a knobbed parent compares a control against a control).

| probe | knob | clean exit | knob exit |
|---|---|---|---|
| `tests/probe_aftermove_cure.js` | `MEDI_AFTERMOVE_CURE_OFF` | **0** | **1** (2 assertions failed) |
| `tests/probe_partial_trap_source_returns.js` | `MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE` | **0** | **1** (3 assertions failed) |
| `tests/probe_recoil_on_a_whiff.js` | `MEDI_RECOIL_ON_A_WHIFF` | **0** | **1** (2 assertions failed) |

The shape now in each file:

```js
const KNOB_SET = process.env.MEDI_AFTERMOVE_CURE_OFF === '1';
const KNOB     = KNOB_SET && process.env.ABRA_PROBE_CONTROL_ARM === '1';
if (KNOB_SET && !KNOB) { /* notice: the assertions below are expected to FAIL and this MUST exit 1 */ }
```

and the spawn carries `ABRA_PROBE_CONTROL_ARM: '1'` beside the knob.

Every other use of the old `KNOB` variable that described **engine state** rather than **which arm
is running** was moved to `KNOB_SET` — the `MEDI_..._OFF=1  (PRE-FIX ENGINE: ...)` banner line in each
file. Leaving it on `KNOB` would have printed `=0` on a knobbed outside run, which is a false receipt.

## 2. Stale and missing recorded pairs (CLAUSE 3)

Re-measured with the tool's own switch, `node tests/test-knob-control-arm.js --measure <files...>`,
so `data/probe-knob-arms.json` describes the bytes that exist now.

**25 pairs across 21 files** re-measured for the original red list:

`probe_accuracy_modifier_chain` (2), `probe_direclaw_attribution`, `probe_fractional_priority_draw`,
`probe_healblock_clock` (2), `probe_magnetrise_clock`, `probe_mental_herb_update` (2),
`probe_perishsong_field`, `probe_rampage_length`, `probe_selfdrop_through_sub`, `probe_simple_beam`,
`probe_stall_uncaused`, `probe_status_clock_dice`, `probe_sun_refuses_freeze`, `probe_trap_duration`,
`test-damage-roll-support`, `test-multihit-roll` (the stale-digest set), plus the previously
unmeasured `probe_aftermove_cure`, `probe_partial_trap_source_returns`, `probe_recoil_on_a_whiff`,
`probe_sec_addr_selfdrop` (2) and `probe_stall_sweep_order`.

**No clean 0 / knob 0 hole was found.** Every non-silent pair measured clean `0`, knob `1`. Two of
the re-measured pairs are declared `SILENT CONTROL` in the probe's own source
(`probe_accuracy_modifier_chain :: MEDI_WEATHER_FORME_SURVIVES_FAINT` and
`probe_mental_herb_update :: MEDI_WEATHER_FORME_SURVIVES_FAINT`), where `0` is the pass; both read 0.
Nothing was re-recorded to make a reading go away.

A further **16 pairs** were measured after §3 widened the population — see below. Artifact total is
now **81 pairs**, recorded 2026-09-20T02:42:54Z.

## 3. The run-time-knob question: NOT a hole in the probes, and a REAL hole in the guard

The brief asked whether `probe_multihit_reaction_per_arrival`, `probe_narration_a` and
`probe_narration_c` — listed as `NOT PAIR-MEASURED — the knob is chosen at run time from the probe's
own table` — are safe or a second hole.

**The probes are safe, and I measured it rather than reasoning about it.** Their quiet arm is keyed
on a dedicated marker (`PROBE_MHR_CHILD`, `PROBE_NARA_CHILD`, `PROBE_NARC_CHILD`); `grep` over
`engine/` returns nothing for all three, so setting one cannot break the engine. Running the **full**
table from outside — not the one knob each the guard's header named — gives:

```
clean: probe_narration_a 0   probe_narration_c 0   probe_multihit_reaction_per_arrival 0
narration_a:  ROOST_ANNOUNCE_FLYING_ONLY 1  SPREAD_NOFOE_FAILS 1  SYNC_IMMUNE_SILENT 1
              COACHING_NOALLY_SILENT 1      ITEMMOVE_NOTARGET_SILENT 1
narration_c:  FOREWARN_SILENT 1  CHILLY_NOBENCH_SILENT 1  STATUS_HELD_AFTER_FIELD 1  HARVEST_COIN_GATED 1
mhr:          REACT_LATE_ONCE 1  MULTIACC_UPFRONT 1  VOLLEY_IGNORES_SLEEP 1  SPORE_DIE_UNGATED 1
```

13 of 13 exit 1. No probe is lying.

**The exclusion itself was the hole, and the stated reason for it was wrong.** The guard's comment
said a run-time table has "no single env name to set from outside". That is false — the names are
written in the probe's own `KNOBS` table and are perfectly settable, which is exactly what the 13
runs above did. The **actual** reason all three fell out of CLAUSE 1 is that `isEngineKnob` matched
only the literal text `process.env.NAME === '1'`, and every knob in those tables is read through a
helper:

```js
engine/medicham2-browser.js:6484   const _MK=k=>(typeof process!=='undefined'&&process.env&&process.env[k]==='1');
engine/medicham2-browser.js:6549   const ROOST_ANNOUNCE_FLYING_ONLY=_MK('MEDI_ROOST_ANNOUNCE_FLYING_ONLY');
```

So **57 knobs** — read through `_MK()` and `_knob()` — were invisible to the population, and CLAUSE 2
does not scan a file outside the population. A table-driven probe that later keyed its quiet arm on a
table knob would have been invisible to **both** clauses. That is the failure this file exists for,
inside this file.

Closed, in `tests/test-knob-control-arm.js`:

- **The helper names are DERIVED, not typed.** Anything bound to an arrow that compares
  `process.env[<its own parameter>]` to `'1'` is a knob helper, so a second helper added later is
  picked up with no edit here. Two were found: `_MK`, `_knob`.
- **A run-time table's knobs are lifted into the population** — matched as a bare token and filtered
  through `isEngineKnob`, because the two tables are written differently (`mhr` uses an array of
  quoted strings; the narration probes use an object with **bare identifier keys**, which a
  quoted-literal-only scan reported as absent — the silent-default shape again). Guarded so it
  reaches only a file that genuinely picks its knob at run time.
- **PRINTED BEFORE RELIED ON**, per the standing rule. The matcher lifted exactly the 4 / 5 / 4 names
  in the three tables and nothing else, and the run now prints both knob-shape counts:
  `engine/ reads 340 knob(s) as process.env.X === '1' and 57 through _MK/_knob()` — a shape that stops
  matching looks exactly like a shape that is not used.
- The stale comment block was rewritten and the exclusion branch **kept**, now empty, so the list
  cannot come back silently.

Effect: population **65 → 81 pairs**. Three probes joined that were not table-driven at all and had
simply been invisible for their helper-read knob — `probe_bounced_move_redirect`
(`MEDI_BOUNCE_IGNORES_REDIRECT`), `probe_fickle_beam_die` (`MEDI_CONDPOWER_OFF_ANY`) and
`probe_redirect_onto_the_aim` (`MEDI_REDIRECT_NEEDS_AIM_CHANGE`). All 16 new pairs measured clean
`0`, knob `1`; CLAUSE 2 is green across all 81.

## 4. The guard's final reading

```
CLAUSE 1  81 (probe, engine knob) pair(s).   340 direct knobs + 57 via _MK/_knob()
CLAUSE 2  green  no probe reaches its quiet arm on the knob alone — 81 checked
CLAUSE 3  green  every pair exits 0 clean and 1 under its knob — 81 of 81 measured
                 (4 declared SILENT CONTROL, where 0 is the pass), recorded 2026-09-20T02:42:54.833Z
PROBES THAT DO NOT EXIT 0 ON A CLEAN RUN: 2 of 81, 2 declared
green — every clause held                                                          exit 0
```

The two clean-red probes are the pre-existing declared pair, unchanged and not the knob class:
`probe_midturn_herb_resort :: MEDI_RESORT_BEFORE_UPDATE` (illegal fixture, owed a discriminating one)
and `probe_trace_list :: MEDI_TRACE_SOLO_NODRAW` (the engine's Trace index defect).

## 5. Shown RED on a deliberate break, twice

A green guard that cannot go red is not a guard. Reverting a single line and restoring it, both times
against the bytes that ship:

```
revert tests/probe_recoil_on_a_whiff.js KNOB to the bare knob   -> exit 1
   RED  probe_recoil_on_a_whiff.js:83 — `KNOB` is the bare knob and guards an exit(0) at line 254
   RED  probe_recoil_on_a_whiff.js changed since it was measured (3bd8d08... -> a226384...)
restore                                                          -> exit 0

revert tests/probe_aftermove_cure.js KNOB to the bare knob      -> exit 1   (final bytes, post-§3)
   RED  probe_aftermove_cure.js:76 — `KNOB` is the bare knob and guards an exit(0) at line 193
   RED  probe_aftermove_cure.js changed since it was measured (3616f0f... -> 77c0258...)
restore                                                          -> exit 0
```

Both clauses fire independently on one break, which is the arrangement the file's header argues for.

## 6. Files changed

| file | what |
|---|---|
| `tests/probe_aftermove_cure.js` | quiet arm moved onto `ABRA_PROBE_CONTROL_ARM`; outside-knob notice; child skipped when knobbed; banner reads `KNOB_SET` |
| `tests/probe_partial_trap_source_returns.js` | same |
| `tests/probe_recoil_on_a_whiff.js` | same |
| `tests/test-knob-control-arm.js` | `isEngineKnob` sees helper-read knobs, helpers derived; run-time tables lifted into the population; both knob-shape counts printed; stale exclusion comment rewritten |
| `data/probe-knob-arms.json` | 41 pairs (re)measured; artifact now 81 pairs |

Nothing under `engine/` was touched. `CHANGELOG.md`, `docs/RUNNING-NOTES.md`,
`engine/quarantine.js`, `engine/game_differential.js`, `engine/medicham2-browser.js` untouched;
`status.js --write` not run; no git operation performed.

## Notes-row text, for the coordinator to place

> **The knob-control-arm guard is green, and the exclusion it printed was hiding 57 invisible knobs.**
> Three probes written 2026-09-19 (`probe_aftermove_cure`, `probe_partial_trap_source_returns`,
> `probe_recoil_on_a_whiff`) keyed their quiet control arm on the bare engine knob and so exited 0
> against a deliberately broken engine; each now exits 0 clean and **1** under its knob. 41 recorded
> pairs re-measured against current bytes. `isEngineKnob` matched only `process.env.X === '1'` and
> therefore could not see the **57** knobs `engine/medicham2-browser.js` reads through `_MK()`/`_knob()`
> — so `probe_narration_a`, `probe_narration_c` and `probe_multihit_reaction_per_arrival` were excluded
> for a reason the comment got wrong, and CLAUSE 2 never scanned them. Helper names are now derived;
> population **65 → 81 pairs**, all clean 0 / knob 1, exit 0. Shown RED on two deliberate reverts.
> Artifact: `data/probe-knob-arms.json` (81 pairs, 2026-09-20T02:42:54Z). Report:
> `docs/_reports/2026-09-19-knob-guard-green.md`.
> **Supersedes.** The guard's own claim that the three table-driven probes had "no single env name to
> set from outside"; and its one-knob-each measurement note, replaced by the full 13-knob sweep.
> **Basis.** unchanged.

## OWED, NOT RUN

- **The full test battery was not run.** Light mode, by the brief: `tests/run-all.js`,
  `tests/test-mechanics.js`, the three gate lattices and `engine/quarantine.js` were all skipped. The
  census was **read** (977 live of 984) and not regenerated; no `engine/` file was edited, so it
  cannot have moved, but that is an argument and not a measurement.
- **`node engine/status.js --write` was not run**, by the brief. The generated blocks in
  `docs/ENGINE.md` and the ledgers do not yet reflect this pass.
- **`docs/RUNNING-NOTES.md` and `CHANGELOG.md` have no row for this**, by the brief. The text above is
  owed placement by the coordinator; the pre-commit hook will refuse the commit without it.
- **`tests/run-all.js` was not re-run**, so it is unmeasured whether the widened population slows the
  discovered run. CLAUSE 3 stays a recorded read, so the added cost should be zero, but that is a
  prediction.
- **The two declared clean-red probes are still owed their fixes**, by whoever owns them:
  `probe_midturn_herb_resort` needs a legal fixture that still discriminates
  (`game_differential`'s legality check refuses the staged Covet set, 2 of 9), and `probe_trace_list`
  is reporting a real engine defect — the Trace index die, one draw in 2,442 over the pinned pool.
  Neither is the knob-control-arm shape and neither was touched here.
- **No second guard appears to share the helper blindness, but that is a grep and not a run.**
  `tests/test-knob-control-arm.js` is the only file under `tests/` or `engine/` that builds a
  knob-name detector; `tests/mutation_harness.js`'s `process.env.X === '1'` reads are its own
  switches, not an enumeration of engine knobs. Nothing was executed to confirm it.
