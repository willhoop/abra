# Reg M-C narration to zero: the last three causes (abra/regmc 0.120.0 – 0.123.0)

ENGINE, 2026-09-24. Brief: the three causes `docs/_reports/2026-09-24-narration-last.md` left on the Reg M-C narration
clause (0/955, 2/1266, 1/1497). Derive each from whole blocks of the `pokemon-showdown-mc` source (checkout `f10d679`),
fix the engine or the instrument, prove each red -> green with a control, re-run the three lattices on a fresh release.
Branch `worktree-agent-ac013915325ecdea1`, based on `91230995`. Reg M-C only.

## Verdict

| lattice | before (release `aed9780fc4e3`) | after (release `015ab5fd1cc1`) | board-material |
|---|---|---|---|
| `--games 1200` | 0 / 955 | **0 / 955** | 0 |
| `--games 1600` | 2 / 1266 | **0 / 1266** | 0 |
| `--games 1900` | 1 / 1497 | **0 / 1497** | 0 |

**0/0/0 is met.** All three causes were engine defects; none was the instrument. One commit per cause, plus the
measurement commit.

| cause | verdict | commit | probe |
|---|---|---|---|
| (a) White Herb order | engine: holders walked in side order | `f96ea904` (0.120.0) | `tests/probe_regmc_white_herb_speed_order.js` |
| (b) Grassy Terrain heal on a tie | engine: a spent flinch was missing from the residual handler list | `c1bec57a` (0.121.0) | `tests/probe_regmc_flinch_residual_list.js` |
| (c) Emergency Exit game | engine: the residual door was counted, not modelled | `3669e2c3` (0.122.0) | `tests/probe_regmc_emergency_exit_residual.js` |

## Cause (a): two White Herbs are spent fastest holder first

**The authority** (`data/items.ts` whiteherb :7658-7710, no Champions override): `onAnySwitchIn` (priority -2),
`onAnyAfterMega`, `onAnyAfterMove` and `onResidual` all call the item's `onStart`. There is no `onUpdate`. Each trigger
is one handler per active holder in a list the event speed-sorts: `fieldEvent` (`sim/battle.ts` :484-507) for SwitchIn,
`runEvent`'s `speedSort(handlers)` (:794) for the others; `resolvePriority` (:1001-1013) sets `speed = pokemon.speed`.
So the faster holder's `-enditem` comes first, whichever side it is on.

**The engine** walked `[...actA, ...actB]` in `restoreStatsAll` at all six call sites.

**The fix.** `restoreStatsAll(a, b, field)` finds the owed holders first. When two or more are owed, it orders them by
the cached action speed (`_sdSpe`, or the live `sdActionSpeed`) through `sdSpeedSortEntries`, the one sort
implementation. Nothing is sorted or drawn when none or one is owed. Declared, not modelled: an exact tie between two
owed holders (at a SwitchIn the authority reuses `runSwitch`'s `speedOrder` rank instead of a fresh draw, and it sorts
the herbs among every other handler of the event). Counter `MEDSEEN.herbSpeedOrdered`, knob `MEDI_HERB_SIDE_ORDER`.
`tests/probe_red_demo.js`'s WIRE 11 reversal was re-aimed at the function's new first lines.

**The probe.** Items and abilities found by tag (`restoresStats`, `onSwitchInDrop`).
- LEAD: two Intimidate leads, a White Herb holder on each side, p2's holder faster.
- AFTERMOVE: a spread stat-drop into two p2 holders, p2b faster.
- CONTROL: LEAD with the speeds swapped, so side order and speed order agree.

| run | result |
|---|---|
| pre-fix engine (`--medi`, base bytes) | **RED**, 3 (LEAD and AFTERMOVE diverge at `-enditem`; counter 0). CONTROL green |
| fix, release `4a74cd6c09eb` | **GREEN** |
| fix + `MEDI_HERB_SIDE_ORDER=1` | RED, 2 |

Regression, green on the fix: `probe_regmc_white_herb_before_switch`, `probe_regmc_white_herb_at_win`,
`probe_herb_before_pivot_switch`, `probe_refill_entry_herb`, `probe_unburden_herb_paths` (all `--regulation regmc`).

## Cause (b): a spent flinch still stands in the residual handler list

**It was a real tie, measured, and the tie die was not the defect.** A preload hook on the authority's
`Battle#fieldEvent('Residual')` printed its handler list before and after `speedSort` for the field game (1600,
omit-weather `…2684772479 vs …2684878616`, turn 1). Both Rillaboom are at 137:

```
BEFORE  grassyterrain(field,o27) flinch@p1a(137) gt@p1a(o5,137) protect@p1b(324) stall@p1b(324) gt@p1b(o5,324)
        gt@p2a(o5,137) gt@p2b(o5,178)
AFTER   gt@p1b gt@p2b gt@p1a gt@p2a grassyterrain(field) stall protect flinch
```

The differential pins the authority's `prng.shuffle` to the identity and neutralises the engine's tie key, so under the
harness the tied pair's order comes entirely from the selection sort's swaps. Those swaps depend on what stands between
the pair. The engine consumes the tie die the way the authority does (one lazily drawn key per tied member, the same
`tie` stream, `residualShadowSort`). What differed was the list.

**The authority.** `data/conditions.ts` flinch: `duration: 1`, and `onBeforeMove` writes `cant` without removing the
volatile. `fieldEvent('Residual')` collects duration-only handlers under `getKey = 'duration'` (:484-524), so the flinch
is in the list until it expires there.

**The engine** cleared `_flinch` at the `cant` and again at the foot of the action loop, both above
`residualShadowRank`. Its list had no flinch. Worked by hand, that sort puts p2a first, which is what it wrote.

**The fix.** `_flinchHeld` carries the volatile from either clear to the residual list's build. The `flinch` reader is
`!m.fainted && (m._flinch || m._flinchHeld)`. It is dropped right after the build, and on every switch-out and turn
exit. Counter `MEDSEEN.flinchHeldToResidual`, knob `MEDI_FLINCH_GONE_AT_RESIDUAL`.

**The probe.** The first cut staged the field case's own cast (a Grassy Surge Fake Out user, Life Orb, a Protecting
partner) and its cast search found no combination under its filters. The same list shape was then rebuilt from other
legal bodies:
- A tied pair (same species and set), each holding Leftovers (order 5).
- Two faster bodies with an order-5 ability residual (Shed Skin / Hydration / Healer; nothing to cure, so no line and
  no die).
- FLINCH: p2a Fake Outs p1a.
- CONTROL: p2a Fake Outs p1b instead. The authority heals the pair the other way, so the flinch's position alone moves
  the answer, and the comparison can see it.

| run | result |
|---|---|
| pre-fix engine | **RED**, 2 (FLINCH diverges at `-heal`; counter 0). CONTROL green, authority p2a-first |
| fix, release `a44ee1a83d38` | **GREEN**, authority FLINCH p1a-first / CONTROL p2a-first |
| fix + knob | RED, 1 |

`--only-game` replay of the field game on `a44ee1a83d38`: no protocol and no board divergence. Regression, green:
`probe_residual_shadow` (PASS), `test-rollout-effects` (38/38).

## Cause (c): Emergency Exit's residual door. An engine defect, not an instrument limit

**The authority.** `sim/battle.ts` records `residualPokemon` at the residual's head (:2815). Below the residual's
`eachEvent('Update')` (:2860-2867) it raises `EmergencyExit` for every body still standing that went from above half to
at or below it. The Champions handler (`data/mods/champions/abilities.ts` :22-29) sets `switchFlag` and writes
`-activate`. The request at :2905-2911 is answered by an `instaswitch` (`sim/side.ts` :1011): a bare `|switch|` before
the next `|turn|`.

**The engine** counted this door (`MEDFAILS.emergencyExitOtherDoorUnmodelled`) and did nothing, so it wrote no
`-activate` and kept Golisopod in the slot. The harness's forced-switch mirror reads the engine's slot occupant to
answer the authority's request, and found the body still active: "slot 1 holds golisopod, which showdown already has
ACTIVE". **The mirror is correct.** Once the engine switches, it expresses the placement unchanged, as the probe and
the replay below show. So the instrument needed no change.

**The fix.** `emergencyExitResidualDoor` runs below `residualUpdatePass` and above `refill`. It reads the HP recorded at
the residual head (`_eeResHP`), asks the existing `emergencyExitAsk`, and switches through `switchOut` in the leaving
bodies' speed order, the road the Eject Button and the in-move exit already take. Declared, not modelled:
- An exit and a corpse refill in the same request go exits-first, where the authority sorts them as one queue
  (`MEDFAILS.eeResidualBesideRefill`).
- The hazard door stays counted.

Counter `MEDSEEN.emergencyExitResidual`, knob `MEDI_EMERGENCY_EXIT_NO_RESIDUAL`.

**The probe.** The ability is found by tag (`switchesOutAtHalf`: Golisopod is the only M-C carrier).
- RESIDUAL: p2a Leech Seeds the holder on turn 1 and everyone idles, so the seed's chip is the only damage. The holder
  crosses half at a residual (78 -> 60 of 150) and nowhere else.
- CONTROL: a body without the ability in the same slot, played for the same number of turns.

| run | result |
|---|---|
| pre-fix engine | **RED**, 3 (`-activate` missing; the stream stops; counter 0). CONTROL green |
| fix, release `015ab5fd1cc1` | **GREEN** (`-activate` directly below `|upkeep|`, then `|switch|p1a: Beedrill`) |
| fix + knob | RED, 2 |

`--only-game` replay of the field game (1900, omit-spread `…2679451964`) on `015ab5fd1cc1`: no protocol and no board
divergence. Regression, green: `probe_regmc_emergency_exit`, `probe_regmc_eject_items`,
`probe_regmc_eject_entry_address`.

## The re-run

Release `015ab5fd1cc1`, cut on the tree at `3669e2c3` (0 of 33 files moved). The runs were serial through
`cmd.exe /c tools\lownode.cmd`, from a spawnSync driver, and each log ends `##EXIT 0` (229 s, 302 s, 431 s). Flags:

```
engine\game_differential.js --regulation regmc --steering empirical --arm middle --end-state
  --release 015ab5fd1cc1 --census data/verification/census-pin-regmc-ccd979c30997.json
  --team-store data/team-pool-frozen-regmc --games {1200,1600,1900} --write --out <gate path>
  --dump-games 2000 --dump-out data/verification/gd-regmc-narration-zero-g<N>.json
```

The pool is `data/team-pool-frozen-regmc`: the untracked `.jsonl` files, hard-linked from the main checkout. The samples
match 0.119.0: 955 / 1266 / 1497 played, the same one void game at 1200 (`pair-speedctrl …2680752139`, low-identity),
0 void at 1600 and 1900, 0 threw, and every by-cause table reconciles. The clause operands are
`state.games - state.games_board_never_diverged` (board) and
`end_state[0].summary.by_cause_totals.games_narration_only` (narration):

| lattice | state.games | board-material | narration-only |
|---|---|---|---|
| 1200 | 954 | 0 | **0** |
| 1600 | 1266 | 0 | **0** |
| 1900 | 1497 | 0 | **0** |

No dump file was written: with nothing diverged, there was nothing to dump.

## Census

`tests/test-mechanics.js --regulation regmc` was run after each fix (through `lownode`). It read **1024 live / 0 missing
/ 1024 probed** each time (the 0.119.0 figure). None of the three fixes added a census row; the probes carry them. The
committed census stays the lattice pin (`ccd979c30997`); the run's output was not committed.

## Not done, and owed

- **Reg M-B not run.** All three edits are on shared paths. Emergency Exit has no Reg M-B carrier. Cutting a Reg M-B
  release rewrites the tracked `data/engine-release.json`, and the brief retires M-B except where it is cheap.
- **`node engine/status.js --write` not run.** From a worktree it writes missing untracked files as fact. It is owed
  after merge.
- **A trap I hit, for the next agent.** A bare `node -e` that pushes `--regulation regmc` onto `process.argv` after
  start still loads **Reg M-B** (`CS.FORMAT` read `gen9championsvgc2026regmb`). In that dex Rillaboom and Golisopod are
  `Past`. Under the probe kit (Reg M-C) both are legal (`OU`). Derive M-C facts through the kit or with a real
  `--regulation regmc` argument.
