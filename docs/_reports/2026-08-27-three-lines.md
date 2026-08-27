# Three lines, three knobs, three probes — 2026-08-27 (ENGINE)

Release cut: **`d03fb31456e2`**, named *"three lines: the sound lock refuses a restart, step 0 is
decided above the shield, a capped hazard announces its failure"*.

## THE SCOREBOARD, EACH QUANTITY NAMED

Pinned three ways, identical to the run this replaces: release `d03fb31456e2`,
`--arm middle --turns 12 --games 1200 --team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json --state --end-state --write`.
Team pool `0d103fb9fa87`, census pin `9446a684709d` — the same two the 2026-08-26 rebaseline used, so
this IS a before/after and not two instruments subtracted.

| quantity | before (`6272fa445b73`) | after (`d03fb31456e2`) | predicted |
|---|---|---|---|
| whole-game clause | 13 of 961 | **10 of 961** | 10 — **hit** |
| raw diverged | 18 of 961 | **15 of 961** | 15 — **hit** |
| board-material | 4 of 961 | **3 of 961** | unmoved at 4 — **MISSED, in the good direction** |
| boards never parted | 957/961 | 957/961 | unmoved |
| census | 754 live / 754 probed / 0 missing | **754 / 754 / 0** | unmoved — hit |
| roster items / abilities / moves | 139 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE | **identical** | unmoved |
| `test-engine-diff --n 6000` | 0 of 6000 at 16 corners | **0 of 6000 at 16 corners** | unmoved |

**THE UNPREDICTED MOVEMENT IS NAMED AND ATTRIBUTED.** I predicted board-material unmoved because the
hazard card was filed under `event missing from medicham2`, which reads as narration. It was not: the
cause that left the board-material worklist is exactly

```
  turn 6   event missing from medicham2 :: |-fail|p1b  <>  |upkeep
```

— the Sticky Web card, fix #3. The remaining three board-material causes are byte-identical to the
list this batch inherited (the recoil `-damage` field 3 at turn 8, the White Herb `-enditem` ordering
at turn 4, the spread `-damage: a different body` at turn 2). So the movement is one cause leaving,
not a reshuffle, and it belongs to fix #3.

## THE THREE FIXES

Each has its own knob, its own probe and its own named divergence. Nothing here rests on a knob
that was not shown to move its own arm and to leave every control arm alone.

### 1. A SECOND THROAT CHOP RESTARTED OUR CLOCK

`engine/medicham2-browser.js`, the `blocksSoundMoves` branch of the secondary loop.

`Pokemon#addVolatile` (sim/pokemon.ts:1994-1997) refuses a volatile a body already carries when its
condition declares no `onRestart`. `throatchop`'s does not, and the fact was **already derived** into
`data/tags.json` as `volatileRestart.throatchop = {restart:false, duration:2}`. A general reader for
it — `volRefusesRestart` — **already existed**, consulted inside `applyMoveVolatile`. Throat Chop
walked past it because its state lives in `tg._noSound`, outside `_vol`.

`_n0` was *already read at the application site*, to suppress the duplicate `-start` line, and the
counter was rewritten regardless. So the engine knew the lock was up and restarted it anyway.

The card, `baseline` config of `gen9championsvgc2026regmbbo3-2656159439 vs -2656116859`:

```
  t5   |-start|p1a: Mawile|Throat Chop|[silent]            (both engines)
  t6   |move|p2b: Incineroar|throatchop|p1a: Mawile        (both, and no second -start in either)
  t6   SHOWDOWN  |-end|p1a: Mawile|Throat Chop|[silent]
       MEDICHAM  |upkeep
```

Knob `MEDI_SOUND_LOCK_RESTARTS=1`. Counters `MEDSEEN.soundLockRestartRefused`,
`MEDFAILS.soundLockNoRestartRow` (a carrier with no `volatileRestart` row takes the old rewrite AND is
counted — "the authority refuses this" and "nobody could tell" must not read alike).

Probe `tests/probe_sound_lock_restart.js`, five arms, all derived and none typed:

```
  A  TEST      chopped t1 and t2, sound click t3      AGREES  applied 1  refused 1   (knob: PARTS)
  B  CONTROL   chopped t1 only                        AGREES  applied 1  refused 0
  C  CONTROL   two chops, two DIFFERENT bodies        AGREES  applied 2  refused 0
  D  CONTROL   chopped t1 and t3, AFTER it lapsed     AGREES  applied 2  refused 0
  E  2nd BRANCH the PARTIAL TRAP re-applied t1 and t2 AGREES              (unchanged, both arms)
```

**THE PARTIAL TRAP HALF WAS ALREADY CORRECT AND THAT WAS MEASURED, NOT ASSUMED.** The brief predicted
`_trap` would need the same guard. It does not: `!tg._trap` already sits on its own application site,
and arm E agrees in both arms of the knob. `_trap` was left alone.

### 2. THE SHIELD IS STEP 1 AND SEMI-INVULNERABILITY IS STEP 0

`trySpreadMoveHit` (sim/battle-actions.ts:553-577) names its own order in its own comments and runs
**step outside, target inside** — so every target's step-0 answer precedes every target's step-1
answer:

```
  0  hitStepInvulnerabilityEvent    the `-miss` of a semi-invulnerable body
  1  hitStepTryHitEvent             Protect, Wide Guard, the absorbing abilities
  2  hitStepTypeImmunity            the `-immune`
```

ROADMAP #81 WIRE 1 hoisted the shield above the DRIVER to get it above the accuracy roll, which was
right, and it went one stage too far — above step 0 as well. The card, `pair-protect-bust` turn 10:

```
  SHOWDOWN   |-miss|p1b: Garchomp|p2b: Houndstone
             |-activate|p2a: Milotic|move: Protect
             |-immune|p1a: Rotom|[from] ability: Levitate
  MEDICHAM   |-activate|p2a: Milotic|move: Protect
             |-miss|p1b: Garchomp|p2b: Houndstone
             |-immune|p1a: Rotom|[from] ability: levitate
```

**IT RESISTED TWO PREVIOUS PASSES BECAUSE BOTH AIMED AT TARGET ORDERING.** The two lines belong to two
different TARGETS and two different STAGES; re-ordering the target walk cannot carry one past the
other, because within one stage each target is answered exactly once.

The fix is a step-0 pre-pass immediately above the shield block: `_invulnDecide(tg)` records the
verdict in a set and emits the `-miss`. **`targets` IS NOT FILTERED** — the row stays in `targets` so
`_rows` still carries it, and `_stepInvuln`, still step 0 of `_STEPS`, is still the only place a row is
dropped. Filtering would have moved a fully-invulnerable move onto the shield's `_mvRes = null` exit,
and an invulnerable target is Showdown's `false` (`atLeastOneFailure`) where a shield is its
`NOT_FAIL` — two different `moveThisTurnResult` values, which Stomping Tantrum reads.

Knob `MEDI_INVULN_BELOW_SHIELD=1` (the pre-fix path is the knob's arm, not dead code). Counters
`MEDSEEN.invulnDecidedAboveShield` and `MEDSEEN.invulnRowDropped`, which must move together.

Probe `tests/probe_protect_stage_order.js`, four arms, all derived:

```
  A  TEST      spread move into a PROTECTING foe and a SEMI-INVULNERABLE foe   AGREES  (knob: PARTS)
  B  CONTROL   nobody charging — only the shield answers   AGREES  misses=0 shields=3
  C  CONTROL   nobody shielding — only step 0 answers      AGREES  misses=1 shields=0
  D  CONTROL   a SINGLE-target click at the charging body  AGREES  misses=1 shields=0
```

**WHAT THIS DOES NOT FIX, STATED RATHER THAN LEFT TO BE FOUND:** the WIDE GUARD block sits above the
shield and is also a step-1 handler, so a side guard still announces itself before a step-0 `-miss`.
Moving it would change which targets a side guard is asked about — a second change, not made here.

### 3. A HAZARD AT ITS CAP FAILS, AND THE FAILURE IS ANNOUNCED

**THE HANDED DIAGNOSIS WAS WRONG AND THAT WAS SHOWN, NOT ARGUED.** The card was handed over as *"a move
with no legal target never prints its `-fail`"*, pointing at `useMoveInner`'s early return
(battle-actions.ts:509-511). Sticky Web's target is `foeSide`, which takes the other branch of that
same `if` and never reaches the no-target return at all. Both shapes were staged side by side before a
byte moved:

```
  a hazard re-laid at its cap         PARTS   showdown |-fail|, medicham silent
  a move whose ally target is absent  AGREES  both engines already handle it
```

The real site is `moveHit`: `hitResult = target.side.addSideCondition(...)` (:1240) feeding
`if (didAnything === false) { this.battle.add('-fail', source); ... }` (:1303-1308), and
`Side#addSideCondition` returns false for a condition already present with no `onSideRestart`.

**THE SCREEN HALF OF THIS EXACT RULE WAS ALREADY WIRED.** ROADMAP #81 WIRE 8 calls `mvFail` when a
screen is already up. The hazard branch is the half that was never done: `layHazard` has always
RETURNED whether a layer went down and its caller threw the answer away.

Knob `MEDI_HAZARD_RECAP_SILENT=1`. Counter `MEDSEEN.hazardRecapRefused`.

Probe `tests/probe_hazard_recap_fail.js`, five arms:

```
  A  TEST      a cap-1 hazard clicked twice                AGREES  sidestarts=1  refused 1  (knob: PARTS)
  B  CONTROL   the same hazard clicked once                AGREES  sidestarts=1  refused 0
  C  CONTROL   a cap-2 hazard clicked twice, below the cap AGREES  sidestarts=2  refused 0
  D  TEST      the cap-2 hazard clicked cap+1 times        AGREES  sidestarts=2  refused 1  (knob: PARTS)
  E  POSITIVE  a SCREEN clicked twice — already wired      AGREES               (unchanged, both arms)
```

Arm E is what says the probe can SEE the `-fail` shape at all rather than being red about everything:
the identical authority rule, already correct in this engine, agrees in both arms of the knob.

## SIX FIXTURE ERRORS, ALL FOUND BEFORE THEY BECAME A FINDING

The probes were wrong before the engine was, six times, and every one of them produced a GREEN arm
that had staged nothing. Recorded because that is the failure mode this division keeps paying for.

1. **`beedrillmega` was picked as the Throat Chop carrier.** `Dex.forFormat` is not a legality filter,
   arriving through a LEARNSET walk rather than through `.all()`. A body no sheet can declare.
2. **The victim clicked `clangoroussoul`** — a self-only sound move that spends a third of its user's
   HP, so the board moved for reasons unrelated to the lock.
3. **The victim was chosen for SPEED and was one-shot by the chop on turn 1.** `soundLockApplied` read
   0 in three of five arms; all five were green. Fixed with `hpBoost`, which `game_differential.js`
   mirrors onto the authority's body (`p.maxhp`), so nothing about the comparison is loosened.
4. **The victim was clicking Protect on the chop turns**, so every chop was blocked and `-activate` was
   the only thing that ever happened. It clicks `champions_sim.INERT_MOVE` now.
5. **The Protect fixture had the CHARGER faster than the attacker**, so the two-turn move came down
   before the spread was thrown and nothing was ever semi-invulnerable. And a two-turn shape needs the
   locked slot to answer a request whose entry carries NO `target` field, which Showdown rejects
   outright — *"You can't choose a target for Bounce"*. Both are gone: the charger is FASTER and the
   whole fixture is ONE turn.
6. **Arm C of the Protect probe read `shields=1` with nobody on the foe side shielding** — the
   ATTACKER'S OWN ALLY is a target of an `allAdjacent` move and was raising a shield too.

And one instrument error of a different kind: **the knob CHILD did not inherit `-r
./tests/_live_release.js`**, so it refused at its own guard and printed nothing the parent's filter
matched. That read as *"the knob is not wired"* when the knob had never been asked. All three probes
now pass the preload down and print the child's whole output when no arm row parses.

## WHAT WAS RUN

- `tests/test-mechanics.js` — **754 live, 0 missing, 754 probed**, 0 hollow, 0 threw, 0 unarmed,
  1 direct-call, exit 0.
- `tests/test-engine-diff.js --n 6000` — **0 of 6000 at all sixteen corners**, exit 0. Owed as a
  precaution; this batch reaches no damage path.
- The three roster stages on `d03fb31456e2` with `--write` — **0 FIRED-AND-BOARDS-DIFFER,
  0 DID-NOT-FIRE**, match counts **139 / 129 / 475**, all unmoved.
- `engine/all_mechanics_fire.js --kind all --write` on the same release.
- `engine/game_differential.js` — RUN ONCE, pinned three ways, with `--write`. The BEFORE figures are
  read from the artifact this run replaced, not from a second run.
- Green: `test-engine-consistency`, `test-volatile-duration`, `test-game-diff`, `test-end-state`,
  `test-coverage-stop`, `test-protocol-trace`, `test-encore-fail-silent`, `test-immunity-gate`,
  `test-tag-params-derived`, `test-mc-seal`, `test-bracket-regain`, `test-roster-arm-pin`,
  `test-damage-roll-support`, `test-charge`, `test-entry-effects`, `test-dead-volatile`.

## OWED, NOT RUN

- `tests/test-middle-identity.js`, `tests/test-web-status.js`, `tests/test-resolution-order.js` —
  **red at HEAD before this batch**, named in the brief, not run and not this batch's.
- `tests/interaction_matrix.js` — not re-run; stamped 2026-08-11 and already stale before this pass.
- `engine/wire_ladder.js` — not re-run; the release ladder stays WITHHELD, as it already was.
- `tests/run-all.js` — not run in full.
- `tests/staged_board.js` — not re-run this pass.
- The WIDE GUARD half of fix #2, stated above and deliberately not attempted.
