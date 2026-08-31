# Does Last Respects update mid-turn? — ENGINE, 2026-08-31

*Historical findings record. Not maintained, not current state, superseded by the census rows it feeds.*

## VERDICT

**Yes, it updates mid-turn, and we already get it right.** The authority prices a Last Respects at
BP 50 with the partner alive and BP 100 with the partner KOd earlier in the same turn; this engine
does the same, on three different roads to the corpse rather than the one that was probed.

The drain-relative case **was not reachable** — measured, not reasoned. Nothing in the pool moved,
because **no engine byte changed**: this batch is two new probes and the discovery that the pivot road
runs through a different mechanism than the settle everybody assumed.

## WHAT THE AUTHORITY DOES — RE-DERIVED, NOT ACCEPTED

Every claim in the brief was checked against the format before anything here was read.

| claim | verified |
|---|---|
| `lastrespects` is legal here | `isNonstandard: null` |
| Champions does not override it | `grep lastrespects data/mods/champions/moves.ts` -> nothing |
| the handler | `basePowerCallback(pokemon, target, move) { return 50 + 50 * pokemon.side.totalFainted; }` |
| no cap on the power | correct — the only clamp anywhere is `if (pokemon.side.totalFainted < 100)` on the counter |
| the increment site | `sim/battle.ts:2551`, inside `faintMessages()`, immediately before `pokemon.fainted = true` |
| exactly three legal carriers | **Basculegion, Basculegion-F, Houndstone** (filtered walk of the format) |
| `fallenCount()` is at `medicham2-browser.js:18354` | correct; `fallenSettle` at `:18387`, four call sites |
| Supreme Overlord is NOT the same rule | correct — `onStart` reads `totalFainted` once into `effectState.fallen` |

**Measured on Showdown**, seed `[1,2,3,4]`, doubles, Houndstone at 10 Speed, Garchomp at 200,
the ally at 1 HP, damage roll pinned:

```
ally alive           Last Respects deals 30    p1.totalFainted 0
ally KOd this turn   Last Respects deals 58    p1.totalFainted 1     x1.933   BP 50 -> 100
```

`|faint|p1b: Milotic` precedes `|-damage|p2a: Garchomp` in the log.

## THE FOUR THINGS THE BRIEF ASKED TO STAGE

### 1. The asked case — partner faints earlier in the turn. ALREADY PROBED, GREEN, AND REAL.

`tests/test-mechanics.js:9092`, *"Last Respects counts an ally that died EARLIER IN THE SAME TURN"*.
Reads `0,51` control and `1,100` test. It is not hollow: with the two action-boundary `fallenSettle`
calls removed from a compiled mutant, the test arm falls back to `51`.

### 2. The drain-relative subtlety — REACHABILITY MEASURED, AND IT IS NOT REACHABLE.

The concern is real and the two engines genuinely disagree about *when*: the authority increments at
the **drain**, this engine sets `fainted` at **HP zero**. The faint-queue block at `:20597` says so
explicitly — *"The authority ALSO defers `fainted`, `isActive`, `clearVolatile` and
`side.totalFainted` to the drain... The state half is OWED"*.

So the authority was instrumented at the exact entry into `getDamage` for `lastrespects`, recording
`side.totalFainted`, `battle.faintQueue.length`, and every body with `hp === 0 && !fainted`, at five
distinct drain sites:

| staged case | drain site exercised | at the callback |
|---|---|---|
| control, nobody dies | — | `tf 0, queue 0, undrained []` |
| single-hit foe move KOs the ally | `runMove` tail | `tf 1, queue 0, undrained []` |
| MULTI-HIT foe move KOs the ally | `hitStepMoveHitLoop` tail | `tf 1, queue 0, undrained []` |
| SPREAD foe move KOs the ally | `spreadDamage` / `runMove` tail | `tf 1, queue 0, undrained []` |
| the ally SELF-DESTRUCTS (`selfdestruct: 'always'`) | the user's own `runMove` tail | `tf 1, queue 0, undrained []` |
| a PIVOT REPLACEMENT dies on entry hazards | the switch-in path | `tf 1, queue 0, undrained []` |

**The undrained set is empty at every one.** The window exists in the authority and no Last Respects
click can sit inside it: the count is consumed only at move execution, and every move execution is
preceded by a drain. Two further checks close the remaining doors —

- **Revival Blessing** is the one thing that would separate a *derived* count (ours, which would go
  back down) from the authority's *monotone tally*. It is `isNonstandard: 'Past'` in this format with
  **zero legal users**.
- **`onBeforeFaint`** is the only handler that can make the authority refuse an increment for a body
  at 0 HP. It appears nowhere in this format's data (one hit, in an unrelated mod).

This is a **measured non-reachability**, not a COULD-NOT-STAGE. All five cases staged and ran.

### 3. The freshness contrast. STAGED ON THE NEW BOARD, x1.000.

Folded into the new pivot probe rather than left as a separate row, so the probe carries its own
discriminator: the identical Spikes/U-turn/dying-entrant board, with a Kingambit standing where the
Houndstone stood, clicking Iron Head under Supreme Overlord. **97 with the entrant alive, 97 with it
dead — x1.000 against Last Respects' x1.96**, and it stays 97 under every mutant tried.

### 4. The over-fire control. It is the control arm of all five `powerFromFallen` probes.

Every one varies exactly one thing and reads back the side count beside the damage, so "the count
moved but the damage did not" is distinguishable from "neither moved".

## WHAT WAS ACTUALLY MISSING, AND IT IS NOT WHAT THE BRIEF EXPECTED

The three pre-existing probes all reach the count by **the same road: an ally killed by a foe's
attack**. Two more roads were staged, and the second one turned out to be a **different mechanism
inside this engine**:

| road to the corpse | how the count reaches Last Respects here |
|---|---|
| a foe's attack KOs the ally | `fallenSettle(S)` at the action boundary (`:23268`, `:34897`) |
| the ally kills ITSELF (Memento, `selfdestruct: 'ifHit'`) | the same action-boundary settle |
| a PIVOT REPLACEMENT dies on entry hazards | `if(nx._sf)nx._sf.fainted++` **inline at the switch-in** (`:19802`) |

### THE RED DEMONSTRATION, FOUR COMPILED BUILDS

Mutants compiled in memory through `tests/mutation_harness.js` `loadEngine`; **nothing on disk was
edited**. `memCtl/memTest` are the Memento probe, `pivCtl/pivTest` the pivot probe, `freeze*` the
Supreme Overlord contrast.

```
SHIPPING                          mem 51 -> 100   piv 51 -> 100   freeze 97 -> 97
M1 action-boundary settles out    mem 51 ->  51   piv 51 -> 100   freeze 97 -> 97   <- MOVED
M2 switch-in inline tally out     mem 51 -> 100   piv 51 -> 100   freeze 97 -> 97
M3 both out                       mem 51 ->  51   piv 51 ->  51   freeze 97 -> 97   <- MOVED
```

So the Memento probe discriminates the settle; the pivot probe is correct **twice over** and only goes
red when both mechanisms are gone. Both greens could have been red. The freeze contrast is immovable
under every mutant, which is what says the probes read *freshness* and not just *a number*.

## AN OBSERVATION, FILED, NOT FIXED

`fallenSettle` **derives** the side count from live `fainted` flags; two sites (`:19802`, `:27271`)
also `++` the same field. That is the two-copies-of-a-fact shape this repository has paid for before.

**No measured drift exists today**, and this is why: every settle overwrites with the derived truth,
and each `++` fires once per body at its own transition, so the hybrid value only lives inside a
window nothing reads. There is no failing probe, so there is no fix here. The redundancy is now
recorded in the pivot probe's comment so that deleting the `++` as an obvious duplicate does not pass
silently.

Two empty scratch files were created by a path typo and **left in place, not deleted**, per the
standing rule: `.../C--Users-willj-Projects-Pokemon-ABRA/3373376e-24aa-470c-a411-22c738d9b102_x.js`
and `.../3373376e-24aa-470c-a411-22c738d9b102/scratchpad/x.js`. Both are 0 bytes and inert; the second
sits in another session's scratchpad.

## SCOREBOARD

Prediction written to `data/verification/2026-08-31-fallen-midturn-prediction.json` **before any
engine ran**. Named scoreboard: **the lab moves, the pool does not** — three legal carriers, and a
corpse made by a switch-in.

| | before | after |
|---|---|---|
| census live / probed / missing | 815 / 815 / 0 | **817 / 817 / 0** |
| census hollow / threw / unarmed | 0 / 0 / 0 | 0 / 0 / 0 |
| board-parted | 82 | 82 (unmoved **by construction**) |
| protocol diverged | 172 | 172 (unmoved by construction) |
| distinct causes | 150 | 150 (unmoved by construction) |
| release / tree | `862624c9826e` | `862624c9826e` |

`git diff --stat -- engine/` is **empty**: no simulator byte changed, so the pool figures cannot have
moved and were not re-measured. Eight predictions written, eight held.

**The probes that prove it:**
- `move|powerFromFallen` — *"Last Respects counts an ally that killed ITSELF earlier in the same turn"*
- `move|powerFromFallen` — *"Last Respects counts a PIVOT REPLACEMENT that died on hazards mid-turn — and the frozen count does not move"*

## OWED, NOT RUN

- **The whole-game differential was NOT re-run.** It is unnecessary — no engine byte changed — but it
  means the pool figures in the table above are carried forward from the brief's baselines rather than
  re-measured today. If anyone wants them re-confirmed the command is unchanged, with the pinned pool,
  the pinned census and `--release 862624c9826e`.
- **The deliberate roster was NOT re-run**, and it is still red for the pre-existing reason
  `status.js` prints: `roster.{items,abilities,moves}.json` were measured on release `e129bca605e3`
  and the tree is `862624c9826e`. Not this batch's doing and not worsened by it.
- **The `++`-beside-derived redundancy at `:19802` and `:27271` is not resolved.** It is recorded, it
  has no failing probe, and collapsing it onto one road is a separate batch with its own knob.
- **The `fainted`-at-HP-zero vs `fainted`-at-the-drain state gap remains OWED**, exactly as the
  faint-queue block already declares. This batch only establishes that **Last Respects cannot observe
  it**; it says nothing about the other ~40 guards in the file that read `m.fainted`.
- **Inherited reds, untouched and not worsened**: `probe_red_demo` (5+1 of 200),
  `probe_upkeep_lines` (4 of 49), `test-pinch-family` (1 of 61), `run-all --coverage`
  (54 unaccounted). The `FEATURE SEMANTICS CHECK FAILED` banner on `status.js` is a MEASURE-owned
  weights/fixture staleness gate and predates this batch.
- **No commit, no push**, per the brief.
