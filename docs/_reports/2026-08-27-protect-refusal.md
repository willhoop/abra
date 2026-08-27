# Protect's refusal is the INVERSE of the substitute's — 2026-08-27, ENGINE

**LEAD: NO. IT IS NOT THE SAME STATEMENT, AND THE HELPER FROM THIS MORNING WOULD HAVE BEEN EXACTLY
THE WRONG FIX.** The substitute answers `|-fail|` on the MOVER. A shield answers
`|-activate|<TARGET>|move: Protect` and writes **no `-fail` at all**, because
`protect.condition.onTryHit` ends `return this.NOT_FAIL` (`data/moves.ts:14000`) and
`hitStepTryHitEvent` writes its `-fail` only on a strict `false` (`sim/battle-actions.ts:645`).

**AND THE BRIEF'S DIRECTION WAS BACKWARDS.** The authority prints the `-activate`; **we** printed the
`-fail`.

Release `5ed4753b7322`. CHANGELOG 5.187.0. ROADMAP **#508** closed, **#509** filed.
Probe: `tests/probe_shield_refusal_line.js` — 13 arms, 8 red proven, 5 controls held, 0 failing.

```
                        before      after     predicted before the run
whole-game           6 of 961    4 of 961    4 of 961      (raw 11 -> 9, declared 5 unchanged)
board-material       0 of 961    0 of 961    0 of 961
census            765/765/0   765/765/0   765/765/0
roster            139/129/475 139/129/475  unchanged, 0 in both failure columns
damage              0/6000      0/300       unmoved at all sixteen corners
pin digest      ccb365985023 ccb365985023  unmoved; DICE_MODEL v5
gate               6 of 8      6 of 8       unchanged
```

Both quantities read out of `data/game-differential.json`, never off stdout.

---

## 1. THE DIRECTION, ESTABLISHED FIRST BECAUSE THE BRIEF HAD IT THE OTHER WAY

`classify()` at `engine/game_differential.js:4553` builds

```js
return { cls, detail, cause: cls + ' :: ' + gen(sdHead) + ' <> ' + gen(meHead) + raw };
```

so the LEFT of the `<>` is SHOWDOWN. The two rows in the artifact, verbatim:

```
unrelated event mismatch         showdown |-activate|p2b: Garchomp|move: Protect
  (Speed Swap)                   medicham |-fail|p1b: Alakazam
extra event emitted by medicham2 showdown |-activate|p2a: Scovillain|move: Protect
  (Entrainment)                  medicham |-fail|p1a: Hawlucha
```

**The authority announced the shield. We named the mover.** The brief said the reverse, and the whole
fix would have pointed the wrong way had that been taken on trust.

## 2. IS IT THE SUBSTITUTE'S STATEMENT? NO — IT IS THE INVERSE, AND TWO LINES DECIDE IT

| | the handler | what reaches the wire |
|---|---|---|
| the doll | `substitute.onTryPrimaryHit` — `getDamage` returns `undefined` for `basePower: 0` | `-fail` on the MOVER, `[still]` |
| the shield | `protect.condition.onTryHit`, `data/moves.ts:13987-14000` | `-activate` on the TARGET, and nothing else |

```js
// data/moves.ts:13987-14000
onTryHit(target, source, move) {
  if (this.checkMoveBypassesProtect(move, source, target)) return;
  if (move.smartTarget) { move.smartTarget = false; }
  else { this.add('-activate', target, 'move: Protect'); }
  ...
  return this.NOT_FAIL;
}
```

```js
// sim/battle-actions.ts:643-652
hitStepTryHitEvent(targets, pokemon, move) {
  const hitResults = this.battle.runEvent('TryHit', targets, pokemon, move);
  if (!hitResults.includes(true) && hitResults.includes(false)) {
      this.battle.add('-fail', pokemon); this.battle.attrLastMove('[still]');
  }
  for (const i of targets.keys()) {
      if (hitResults[i] !== this.battle.NOT_FAIL) hitResults[i] = hitResults[i] || false;
  }
  return hitResults;
}
```

`NOT_FAIL` is `''`. `''` is not `false`, and the **second loop is what stops it becoming one** —
without that guard the array would be coerced and the `-fail` would fire on the next step's read.
`trySpreadMoveHit` then filters the target out (`targets.filter((val, i) => hitResults[i] || hitResults[i] === 0)`),
breaks the step loop on `!targets.length`, and returns `false` with `atLeastOneFailure` still false.

**Champions checked, not assumed:** `data/mods/champions/moves.ts:755` is
`protect: { inherit: true, pp: 5 }` — the PP and nothing else. `data/mods/champions/scripts.ts`
contains no `hitStepTryHitEvent`, no `trySpreadMoveHit` and no `moveSteps`, and
`data/mods/champions/conditions.ts` has no `protect`.

## 3. WHICH MOVE WAS REFUSED — IT DOES NOT CHANGE THE ANSWER, AND THAT WAS DERIVED

The only two conditions on the line are `checkMoveBypassesProtect` (`sim/battle.ts:1300` —
`(move.category !== 'Status' || blockStatus) && move.flags['protect'] && runEvent('HitProtect', …)`,
which is already exactly what `shieldRefuses` reads) and `move.smartTarget`, which has its own knob
(`MEDI_SMART_PROTECT_LINE`). **Category is irrelevant to the LINE** — it only decides whether King's
Shield lets a Status move through, and that is `shieldsUser.blocksStatus`, already wired.

So an unconditional `-fail` would have been a new defect. An unconditional `-activate` breaks the Role
Play control in §6.

## 4. THE TWO CLASSES ARE ONE ROOT SEEN FROM TWO SIDES

`classify` files a divergence as *extra* when our head line reappears inside its 10-line lookahead on
the authority's stream. In the Entrainment game a **second** move met the same shield one line later,
so our missing `-activate` turned up again and the lookahead matched it. In the Speed Swap game
nothing followed, so the identical defect fell through to `unrelated event mismatch`. One wire, two
class names — and both cleared together, which is the confirmation.

## 5. WHAT WAS ACTUALLY WRONG — ONE FACT, THREE ANSWERS, SEVEN SITES

`shieldRefuses` answers *whether*; thirteen callers read it and ten already announced. The seven that
did not disagreed with each other:

| kind | what it said | members a shield can reach | uses |
|---|---|---|---|
| `statrewire` | `mvFail(m)` | speedswap, powersplit, guardsplit | 21 |
| `abilitywrite` | `mvFail(m)` | worryseed, entrainment, simplebeam | 247 |
| `reorder` | `mvFail(m)` | quash | 260 |
| `abilitycopy` | `mvFail(m)` | **none** (roleplay has no `protect` flag) | 0 |
| `abilityswap` | silence | skillswap | 198 |
| `typechange` | silence | soak, trickortreat, magicpowder, forestscurse | 224 |
| `pploss` | silence | spite, eeriespell | 14 |

**964 corpus uses.** Membership is re-derived from `playerAction`'s OWN routing predicates on every
probe run, not from the routing tag — `reordersTurn` is carried by **Instruct** as well as Quash and
`changesTargetType` by **Reflect Type** as well as Soak, and a loose tag read would have credited this
batch with two mechanics it does not touch. `boostally` and `abilitycopy` print **EMPTY**, and that
empty line is the derived reason `boostally`'s own `shieldRefuses` call was left alone.

**ROADMAP #241 FILED THIS IN WRITING.** Its header says the Good-as-Gold hoist covers *"the two
refusals that answer at Showdown's onTryHit step, and leaves Protect, the move-class immunities and
the powder rule where they are."*

### The fix

`engine/medicham2-browser.js` only.

- `shieldRefusalAnnounce(tgt)` — one function, one fact: `MEDSEEN.shieldRefusalAnnounced++;
  TR.act(tgt, 'move: Protect')`.
- The shield term is **lifted out of** each site's `_ok` / `_blocked` conjunction and answers with its
  own `continue`. It could not be folded into the shared `else mvFail(m)`: the OTHER conjuncts —
  Quash's "the target has already acted", Entrainment's "the target already holds it", a missing
  target, a body with no stored stats — really do take the generic `|-fail|<mover>` out of
  `useMoveInner`, and collapsing them was three different authority answers wearing one name.
- `MEDI_SHIELD_REFUSAL_UNANNOUNCED=1` restores each of the seven **in its own old shape** — a `mvFail`
  where there was a `mvFail`, silence where there was silence — and stamps
  `MEDFAILS.shieldRefusalUnannouncedRestored` at MODULE LOAD, which every arm asserts present on the
  knob load and absent on the clean one before it classifies anything.

## 6. THE PROBE — 13 ARMS, NO TYPED EXPECTATION

Both engines play the same script under the differential's own pin (`top-tie-first`); the pass is that
the two protocol streams do not part. Every fixture is legality-checked against `Dex.forFormat`
(species, ability, item, learnset) before any arm runs. Every arm derives and prints its target's
refusal reasons NOT counting the shield — type and status immunity off the dex, refusing abilities and
items off `data/tags.json`, **and the move's own `onTryHit` guard off the routing params** — and an
undeclared reason fails the arm. All eleven shield arms read `(none)`.

| arm | the site | clean | knob |
|---|---|---|---|
| `speedswap` | `statrewire` — pool row 1 | agrees | **parts** |
| `entrainment` | `abilitywrite` — pool row 2, same species pair as the pool game | agrees | **parts** |
| `worryseed` | `abilitywrite`, its busiest member | agrees | **parts** |
| `skillswap` | `abilityswap`, the silent shape | agrees | **parts** |
| `soak` | `typechange`, the busiest move in the batch | agrees | **parts** |
| `spite` | `pploss` | agrees | **parts** |
| `quash` | `reorder` | agrees | **parts** |
| `tantrum-after-shield` | the STATE half, two turns | agrees | **parts** |
| `roleplay-noflag` | same family, no `protect` flag | agrees | holds |
| `speedswap-noshield` | shield cleared explicitly | agrees | holds |
| `entrainment-noshield` | shield cleared explicitly | agrees | holds |
| `twave-shield` | an already-correct shield site | agrees | holds |
| `tantrum-after-real-fail` | a GENUINE `-fail`, no shield | agrees | holds |

**Shown red first, unpiped, exit 1.** Before the fix all seven single-turn red arms read `PARTS CLEAN`
on exactly those shapes and all four controls held.

**`quash` IS THE ONE FIXTURE THAT CANNOT BE MADE SINGLE-REASON AND IT SAYS SO.** Protect is priority
+4, so the shield holder has always acted by the time Quash resolves and `unresolved.has(t)` is false
too. In the AUTHORITY there is still exactly one reason — Quash's `willMove` test is in its `onHit`,
six steps below `hitStepTryHitEvent` — and the arm carries a declared `secondReason` rather than
hiding it.

**`twave-shield` ALSO PROVES THE SHIELD BEATS THE DIE.** Thunder Wave is 90% and the arm runs on the
corner that misses every sub-100 move, and neither engine rolls: `hitStepTryHitEvent` is step 1 and
`hitStepAccuracy` is step 4.

## 7. THE STATE HALF — MEASURED, AND FILED AS #509 RATHER THAN FIXED

`mvFail(mon)` is `{mon._mvRes = false; TR.fail(mon)}` — ONE call writing a line **and** a field, which
is why this class kept stalling (`mvFailSilent`'s own header says so). The authority ends a shielded
move with `moveThisTurnResult` at **`null`**:

```js
// sim/battle-actions.ts, trySpreadMoveHit
const moveResult = !!targets.length;
if (!moveResult && !atLeastOneFailure) pokemon.moveThisTurnResult = null;
```

and `useMove` keeps that `null` because `oldMoveResult !== pokemon.moveThisTurnResult`. We were
writing `false`, which is what Stomping Tantrum's doubler reads on the following turn
(`data/moves.ts:18048`). **Removing the `mvFail` leaves `true`** — the value the ten already-correct
shield sites have carried since WIRE 130 — so all thirteen now agree with each other and the residual
gap to `null` is one question at one place instead of a difference smeared across two shapes.

Measured, not argued, and turned into a PROTOCOL question because `engine/board_state.js` compares no
move-result field at all:

- `tantrum-after-shield`: shielded Worry Seed, then the same Venusaur's Stomping Tantrum into the same
  Alakazam with the shield down. Agrees with the authority over both turns and asserts
  `powerDoubledAfterFailure = 0` — EXACT zero, at the exact turn it would have fired.
- `tantrum-after-real-fail`: Audino Entrainments a Toxapex that already holds Regenerator — a genuine
  `|-fail|<mover>` in both engines, no shield anywhere. Asserts the same counter **non-zero**, so the
  zero next door is a real zero and not a dead counter. It reads **2** on one doubling, because the
  counter sits inside the base-power function and this engine evaluates that more than once per
  arrival; the assertion there is `>= 1` and the strong `= 0` claim lives on the other arm.

**THE KNOB CANNOT SEPARATE THE TWO HALVES AND THAT IS THE FINDING, NOT A GAP.** The line and the state
come out of the same call, so a knob that restored one without the other would not be a revert — and
the reverted stream parts at turn 1, before turn 2 is reached.

## 8. FILED, NOT FIXED — AND THIS ONE IS BOARD-MATERIAL

**`instruct` NEVER ASKS THE SHIELD AT ALL.** Its branch (`if(a.kind==='instruct')`) checks Good as
Gold, `refuses`, `_charging` and `_recharge`, and calls `shieldRefuses` nowhere. Instruct carries
`flags.protect` on **277 corpus uses**, so a Protecting body can be Instructed here and cannot there:
a STATE divergence and an EXTRA ACTION in the turn, not a line. It is a MISSING caller rather than a
misplaced one — every site this batch touched already CALLED `shieldRefuses` — so it is a different
change with a different control. Same reasoning `yawn` was named and left by the substitute batch.

Also noticed and not this batch's: `data/roster.abilities.json` reports 45 `CONTROL-NOT-QUIET` and 141
`COULD-NOT-STAGE` rows, both unchanged by this pass.

## OWED, NOT RUN

```bash
# the full 6,000-row damage differential — NOT re-run. This change is entirely inside status-branch
# announcement and never enters the damage function; the 300-row confirmation reads 0/300 at all
# sixteen corners and the publish guard refused the shrink as designed (exit 3), leaving the published
# 6,000-row artifact untouched at data/engine-diff.json.
SHOWDOWN_PATH=... node tests/test-engine-diff.js --n 6000 --seed 20260804

# already WITHHELD by provenance for reasons predating this change; not re-run
node tests/interaction_matrix.js
node engine/wire_ladder.js
node engine/tag_dex.js

# not re-run, as in the preceding batches
node tests/run-all.js
node tests/staged_board.js
node tests/bench-medicham.js --record
node tests/mutation_harness.js
node engine/quarantine.js

# NOT MINE, NOT NEW, NOT TOUCHED: the feature-semantics stamp gate at the top of status.js
# (FEATURE SEMANTICS CHECK FAILED, data/policy-weights.json); tests/staged_board.js 1 of 25;
# engine/register_reality.js exiting 1 by design.

# DEBRIS REPORTED, NOT DELETED (untracked, not created by this session):
#   .scratch_clk_*.out  .scratch_eng/  .scratch_eng_diffrun.cmd  .scratch_eng_rebaseline.out
#   .scratch_id_*.out  .scratch_id_run.cmd  .scratch_id_msg.txt  .scratch_pk/
#   data/_scratch-scovillain-dump.json  data/_pair-pilot.json  data/medicham-represented-clicks.json
# `.scratch_eng_diffrun.cmd` pins a DIFFERENT simulator and cost an agent a run today. Nothing in
# this session executed any of them; the release was cut and passed explicitly on every command.
```

**RUN, with results in the table at the top:**

```bash
node tests/probe_shield_refusal_line.js                                       # 13 arms, 0 failing
node tests/probe_shield_refusal_line.js --only speedswap                      # one arm
node tests/test-mechanics.js                                                  # 765 live / 765 probed / 0 missing
node engine/engine_release.js cut "..."                                       # -> 5ed4753b7322, 26 files
node engine/game_differential.js --games 1200 --arm middle --release 5ed4753b7322 \
  --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json \
  --state --end-state --write
node tests/roster.js --stage {items,abilities,moves} --release 5ed4753b7322 --write
node engine/all_mechanics_fire.js --kind all --release 5ed4753b7322 --write
node tests/test-engine-diff.js --n 300 --seed 20260804                        # 0/300, sixteen corners
node tests/probe_substitute_status_step.js                                    # 12 arms, 0 failing
node tests/probe_spread_status_steps.js  tests/probe_endturn_clock_order.js
node --max-old-space-size=6144 tests/test-resolution-order.js                 # 26 arms, 1 KNOWN-OPEN, 0 failing
node tests/test-protocol-trace.js  tests/test-game-diff.js  tests/test-end-state.js
node tests/test-middle-identity.js  tests/test-encore-fail-silent.js  tests/test-volatile-duration.js
node engine/status.js
```

`all_mechanics_fire --kind all` on `5ed4753b7322`: the **identical** diverging set — moves 8 (+2
shelved), abilities 3 (+1), items 1 (+1); board tallies unchanged (moves STATE 5 / ANNOUNCEMENT-ONLY
7 / NO-DIVERGENCE 484; abilities 1 / 3 / 166; items 1 / 1 / 71). Roster all three stages
`{"FIRED-AND-BOARDS-DIFFER":0,"DID-NOT-FIRE":0}`.

Every heavy run went through a `--require` preload that drops the process to BELOWNORMAL and exits 96
if `os.getPriority` does not confirm it; `tools/lownode.cmd` could not be reached from this shell.
