# ROTOM world fixes and fast-species spreads (abra/regmc 1.40.0 to 1.44.0)

2026-09-30. SOLVER. This follows up the ladder loss post-mortem (`docs/_reports/2026-09-30-ladder-loss-postmortem.md`).
There are five batches, each with its own red-on-break test. The world fixes are checked against the real chomp1 ladder
logs. No game was played and no ladder was touched. Engine: release `eaa5becc54eb`.

The work was paused once by Will's order at 02:2xZ, when one process (pid 3805) was killed by pid before it wrote
anything. It resumed on his word.

## Verdict

| batch | version | defect | verified on the real logs |
|---|---|---|---|
| 1 | 1.40.0 | ROTOM's world laid no Perish count, and no other volatile clock | sdkvndfv g1 t4: both actives at perish 1; one engine step faints both, as the server did |
| 2 | 1.41.0 | A changed ability was not carried (a Skill-Swapped Shadow Tag) | pandywulu g1 t8: Espeon holds Shadow Tag; the engine offers our Incineroar 0 switches (before: 1, the one ROTOM chose; the server refused it) |
| 3 | 1.42.0 | Entry hazards were written to `sf.sc`; the engine reads `sf.hz` | AngryGator g3 t3: Rillaboom switching into Toxic Spikes is poisoned, as on the server (before: clean) |
| 4 | 1.43.0 | Lead-set and post-residual weather and terrain were one turn short | 22 field clocks in 5 fixture games agree with the server; the old path got 12 wrong |
| 5 | 1.44.0 | Fast species ran 0 Speed | Sneasler, Gengar-Mega, Raichu-Mega 0 → 32 Speed SP; both rotations re-spread and validate |

**Sweep over all 50 chomp1 logs** (scratch sweep, read-only):
- At every turn start: 369 world builds, 0 threw.
- 153 weather, terrain, Trick Room and Tailwind clocks all equal the turns the server let them run.
- 28 laid perish counts all equal the server's next count + 1.
- Laid in those builds (counters): perish 28, Choice lock 31, ability change 26, sleep 6, Substitute 5, hazard 4.

## 1. Perish and the volatile class (1.40.0)

- **Engine semantics.** The engine sets `_perish = 4` when it prints `perish3`, and ticks the value in the residual. So
  `_perish` is the count the log last showed after a residual, or that count + 1 for the use-time `[silent]` mark.
- **The walk.** `solver/rotom/world_log.js` walks the public protocol once. Every clock's age is the number of `|upkeep|`
  lines since it started.
  - Durations come from the dex: `condition.duration`, or its `durationCallback` asked with the setter's item.
  - The start adjustment is read from the condition's own `onStart`: Taunt and Encore +1 on a target that has acted,
    Disable -1 on one that has not.
- **Laid on the engine's own fields** (the ones `engine/board_state.js` mediBody reads):
  - `_perish`;
  - `_vol[id]` for every volatile a legal move starts;
  - `_encoreMove` and the lock, `_sealed`, `_healBlock`, `_noSound`, `_sub`, `_seededBy`;
  - `_vol.confusion`, `_trap`, `_trapHard`, `_yawn`, `slpTurns` / `slpTime` (Rest), `toxTurns`, and a Choice lock.
- **Hidden quantities are stated.**
  - The Substitute's remaining HP is not in the log. The doll is laid fresh, at the engine's own size.
  - The confusion count is hidden. It is laid as the posterior mean of the dex's draw (2 to 5) given the attempts seen.
- **Test:** `solver/tests/test-rotom-world-clocks.js`.
  - PERISH is the replay.
  - CLOCKS: a Taunt and an Encore are spliced into turn 2, and the engine's menu then offers Salamence no status move and
    Volcarona only Quiver Dance. The walk-level sleep, toxic, Disable and Rest checks are here too.
  - AUDIT: 68 board leaves are parsed from `engine/board_state.js`; 54 are CARRIED and 14 OWED. A new leaf fails by name.
  - RED under `ROTOM_WORLD_BREAK=noclocks`.

## 2. Ability changes (1.41.0)

- **Why only the world can carry this trap.** Showdown's Shadow Tag traps with `tryTrap(true)`, and the request hides a
  trap set that way (`sim/pokemon.ts`, `trapped: 'hidden'`). So `request.js` could never know it.
- **Read from the log:**
  - Skill Swap: `-activate|SRC|Skill Swap|<target's>|<source's>|[of] TGT`. An ally swap names no ability, and the two
    swap what they hold.
  - Any `-ability` carrying `[from]`: Trace, Role Play, Entrainment, Worry Seed, Simple Beam, Wandering Spirit.
  - Mummy (`-activate|HOLDER|ability: Mummy|CHANGED`).
  - Gastro Acid (`-endability`, laid as `_abParked` plus `_vol.gastroacid`).
  - The mega reset.
- **Reg M-C scope.** Neutralizing Gas has no legal species in Reg M-C (checked by a filtered species walk).
- **On the body.** `_preAb` holds what a switch restores. On my side the request's `ability` and `baseAbility` win.

## 3. Hazards (1.42.0)

- The engine lays and reads hazards only in `sf.hz`. `world.js` wrote them into `sf.sc`, so no ROTOM world ever
  charged a hazard.
- Membership comes from the dex: a foe-side condition with a switch-in effect, which gives Spikes, Stealth Rock, Sticky
  Web and Toxic Spikes.

## 4. Field clocks (1.43.0)

- **The old path.** It laid duration - (turn - turn set). Measured on the ladder logs, a lead Sand Stream or Psychic
  Surge ends in the residual of turn 5, so 5 turns are left at turn 1. The old path said 4.
- **The fix.** `layField` lays weather, terrain, Trick Room, Gravity, Magic Room, Wonder Room, Fairy Lock, Tailwind,
  screens and hazards from the log, with clocks in residuals.
- **FIELD clause.** It holds every clock at every turn start of 5 fixture games against the server's own end line.
  RED under `ROTOM_WORLD_BREAK=turnclock`.

## 5. Spreads (1.44.0)

- **The real mechanism was not the one the brief named.** A fast species did not fail to reach the median at full
  investment. It already beat the median (138) at 0 SP, so "the least SP that beats the median" was 0.
- **The new rule, against the population's full-investment speed tiers:**
  - the cap if the set's cap speed reaches the 0.75 quantile (172);
  - otherwise the least SP beating the heaviest tier it can flip;
  - Scarf / Tailwind and Trick Room are unchanged.
- **Consequences, stated:**
  - 16 of 48 sets that are neither Scarf/Tailwind nor Trick Room are now top tier and run 32.
  - Middle-speed sets now buy the heaviest tier just under them (Incineroar 23, Kingambit 11), where they ran 0 before.
    That is the rule's output; it is not measured to be better.
- **The population moved on the same store sha.** The population re-read at floor 1410 with 150 teams (was 1409 and
  148). `engine/quality.js` changed in the store-quality entry (1.36.0, commit `97b8d576`) after the 1.35.0 re-spread.
  Both files now record the new population. REPRODUCE passes on it.
- **Tests.**
  - `solver/tests/test-rotom-spreads.js` GREEN 27 of 27. RED under `--break tier`, `--break scarf` and
    `SPREADS_BREAK=median`.
  - `test-rotom-top-rotation.js` GREEN 9 of 9. Its REBUILD is NOT CHECKED because the live store has moved.

## OWED, NOT RUN

- **No series has played on any of this.** The fixes change what the search sees, and the effect on the rating is
  unmeasured. A ladder run is Will's call.
- `test-rotom-world-stall.js` could not run in this worktree: `data/team-pool-frozen-regmc` is absent here. Re-run it
  from the main checkout. The fixture worlds it builds (move-disabled, force-a/b) were rebuilt here without error.
- **World leaves OWED** (`world_log.js` OWED):
  - type changes;
  - `last_item` and `ate_berry`;
  - a two-turn charge, the rampage lock, Uproar and the recharge;
  - Flash Fire, the Ally Switch ladder, the Metronome item ladder and Unburden;
  - Wish and Healing Wish slots;
  - PP beyond one per move seen.
- Also not laid: Curse (`_ptDmg`), Attract's `_attractedBy`, Early Bird's extra sleep tick, and the transform (Imposter
  Ditto).
- `docs/SOLVER.md` ledger and `node engine/status.js --write` are owed from the main checkout. They are never run from
  a worktree.
- Versions 1.40.0 to 1.44.0 were free at 02:05Z and 07:30Z. Two WIP branches (CHOMP v2, PORYGON2 v1-r2) carry no new
  version yet. Whoever merges second renumbers.
