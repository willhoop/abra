# The random-target address — the collision is real, so nothing landed

**2026-08-27, ENGINE.** Release `7f7de860723b`, arm `middle`, cap 12, `--games 1200` (961 games
played), `--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`.
Instrument: `tests/probe_random_target_address.js` (new).

## VERDICT

**BOARD-MATERIAL DID NOT REACH ZERO. IT IS UNMOVED AT 1 OF 961, BECAUSE NOTHING WAS LANDED.**

The brief's landing was conditioned on a collision proof, and the proof came back the other way:
**the collision exists, it is measured, and it bites.** Per the standing instruction — *"If a
collision exists, STOP and report — the ruling was made on the assumption it does not"* — no engine
byte moved. The census is unmoved at **754 live / 754 probed / 0 missing**; no release was cut.

**The ruling's premise is 99.3% true and not 100% true, and the missing 0.7% is exactly the
collision.**

## WHAT THE RULING ASSUMED

> If the addresses matched, both engines would draw the same value and pick the same body.

That holds only if the ADDRESS matches, and an address is `seed|turn|cat|move|target|nth`. Blanking
the move and target fields matches the first five. It does not match `nth`, and `nth` is a counter
over everything else that lands in the same bucket.

## 1. THE AUTHORITY'S BLANK `any` BUCKET IS ELEVEN CALL SITES, NOT ONE

Read off the real stack at every draw, never paraphrased. 961 games, 9,839 authority draws, 1,332 of
them at `<seed>|<turn>|any|-|-|<nth>`:

```
 380  PRNG.sample < Battle.sample < Side.randomFoe < Battle.getRandomTarget < Battle.getTarget < Battle.getActionSpeed
 274  PRNG.sample < Battle.sample < Battle.singleEvent < Battle.fieldEvent < Battle.runAction < Battle.turnLoop
 203  PRNG.sample < Battle.sample < Side.randomFoe < Battle.getRandomTarget < BattleQueue.resolveAction < BattleQueue.addChoice
 164  Battle.random < BattleQueue.insertChoice < BattleActions.switchIn < Battle.runAction < Battle.turnLoop
 137  PRNG.sample < Battle.sample < Side.randomFoe < Battle.getRandomTarget < Battle.getTarget < BattleActions.runMove   <- THE ONE
 124  PRNG.sample < Battle.sample < Battle.singleEvent < Battle.singleEvent < Battle.fieldEvent < BattleActions.runSwitch
  19  ... BattleQueue.resolveAction < BattleQueue.resolveAction
  13  Battle.randomChance < Battle.singleEvent < Battle.fieldEvent < Battle.runAction < Battle.turnLoop
  12  Battle.randomChance < Battle.runEvent < BattleQueue.resolveAction < BattleQueue.addChoice < Side.commitChoices
   5  PRNG.sample < Battle.sample < Battle.singleEvent < Battle.singleEvent < Pokemon.setAbility
   1  PRNG.sample < Battle.sample < Battle.singleEvent < Pokemon.setStatus < Pokemon.trySetStatus < Battle.singleEvent

base addresses 668:  drawn ONCE 377,  drawn MORE THAN ONCE 291 (43.6%),  deepest 12
```

**The draw the fix is about is only 137 of 1,332 — 10%.** The largest contributor is
`Battle#getActionSpeed`, which calls `getTarget` on **every move action, every turn** purely to hand
`ModifyPriority` a target (`sim/battle.ts:2641`), and for a `randomNormal` move that falls through to
`getRandomTarget` exactly as `runMove` does. `BattleQueue.addChoice` does it again at choice commit.

## 2. THE AUTHORITY'S runMove TARGET DRAW IS NEVER AT `nth = 0`

```
nth= 1   13   9.5%      nth= 5   25  18.2%      nth= 9    1   0.7%
nth= 2    4   2.9%      nth= 6    6   4.4%      nth=10    1   0.7%
nth= 3   41  29.9%      nth= 7    3   2.2%      nth=11    1   0.7%
nth= 4   39  28.5%      nth= 8    3   2.2%
candidates per draw: 1 candidate x41,  2 candidates x96
```

Our engine's own blank bucket holds **603 draws over 429 bases, deepest 3**. The sites that sit ahead
of the authority's target draw — `getActionSpeed`, `addChoice`, `insertChoice`, the residual
`fieldEvent` sample — are draws **this engine does not make at all**. There is no `nth` it can pick
that lands on the authority's event. **The two engines would share a BASE and not an ADDRESS.**

## 3. IT WORKS ANYWAY, 136 TIMES OUT OF 137 — AND THE REASON IS A WEAKNESS IN THE HASH

```
3. THE PROPOSAL — our draw blanked, taken at nth=0
   picks the authority's body   136 of 137   99.3%
   a coin over the same candidates would score 65.0%   <- the floor

4. NEGATIVE CONTROL — the same draw addressed to the WRONG TURN
   picks the authority's body    64 of 137   46.7%     <- on the floor, so the probe can see a miss
```

**Do not read 99.3% as "the collision is harmless".** It is 99.3% because FNV-1a barely mixes the
trailing repeat index:

```
FNV-1a's last step is  h = (h ^ c) * 0x01000193
=> two addresses differing only in the trailing index differ by  d * 16777619 (mod 2^32)
=> the index TRANSLATES the value modulo 1. It does not mix.
   Swept over 2,000 bases: a one-DIGIT index moves it by at most 0.0352
                           a two-digit index reaches 0.4999

on the 137 real draws, the CIRCULAR step from nth=0 to the authority's nth is at most 0.1622
the closest any of the 96 multi-candidate values came to a boundary was 0.0129
draws where that step moved the PICK across a boundary: 1 of 137
```

The distance has to be CIRCULAR: the two values are translates modulo 1, so `|0.98 - 0.04| = 0.94` is
a step of 0.06 that wrapped — and a wrap crosses a candidate boundary just as a step does.

The one that moved is the two-digit case:

```
baseline   ...bo3-2654515998 vs ...bo3-2654545512
  20260813|5|any|-|-|10   candidates 2   authority picks 0, blanked-at-0 picks 1
```

**That is the collision, in a real game, on the pinned pool.** A hash that mixed `nth` properly would
turn clause 3 into a coin outright — so the fix's correctness currently rests on the die being weak,
which is not a property anyone should be relying on and is not a safety argument.

## 4. WHAT LANDING IT WOULD HAVE DONE, MEASURED RATHER THAN GUESSED

The one board-material game of the pinned 961 is
`baseline / gen9championsvgc2026regmbbo3-2635122796 vs -2634861011`, turn 2, four leaves
(`p2.party.staraptor.hp` 160/87, `p2.party.incineroar.hp` 106/170 and the two actives) — read out of
`data/game-differential.json` `state.first_board_divergences`, not typed.

```
8. THE FOCUSED GAME — `--focus 2635122796`
   AGREES   20260813|2|any|-|-|3   candidates 2   authority 0  blanked-at-0 0
```

**One random-target draw, on the turn the board parts, and blanking it AGREES with the authority.**
So the ruling's fix would very probably have taken board-material **1 -> 0**, and the single draw it
still gets wrong is in a different game that has no board divergence today.

Net expected effect, if it were landed: **~48 wrong target picks become 1** (137 draws, 65.0% floor
today against 99.3%).

**That is a large improvement and it is still not the thing the brief authorised.** The brief
authorised a landing *given no collision*. There is one. The decision to accept a 1-in-137 shared-die
error in exchange for board-material zero is Will's, not this division's, and it is offered here as a
single question rather than taken.

## 5. THE SECOND FINDING, WHICH IS BIGGER THAN THIS ROW

**`nth` TRANSLATES the value instead of mixing it — at most 3.5 points of a unit draw while the index is one digit.** That is not specific to
the blank bucket — it is a property of `midEventValue` / `midHash`, which both engines implement
independently and identically (`tests/test-middle-identity.js` re-implements it a third time and
asserts all three agree).

Consequence: **every repeated draw at one address in the middle arm is very nearly the same value.**
A three-hit move's per-hit accuracy rolls, or a move with two secondaries, are drawn at
`...|acc|<move>|<slot>|0`, `|1`, `|2` — values within 0.035 of each other (modulo 1). Under the middle arm those
are not three independent dice; they are one die read three times with a nudge. Both engines do it the
same way, so it costs nothing in AGREEMENT — which is exactly why no instrument has noticed — but it
is wrong as a die, and `test-middle-identity.js` currently prints the `nth>0` population as "the
population where a count difference can still hide" without knowing that the values there barely
differ.

Fixing it means changing `midHash`/`midEventValue` in **both** `engine/medicham2-browser.js` and
`engine/game_differential.js`, which re-values every address in the arm and re-baselines every
published rate. It is filed here and deliberately not touched.

## 6. INSTRUMENT NOTES — WHAT THIS PROBE GOT WRONG FIRST

- **Clause 4 was 100% by construction.** Its first form re-hashed `base + '|' + nth`, which *is* the
  authority's own address string, so it could never have been anything but 100% and it was read as
  "the arithmetic checks out". Replaced with a real negative control (the same draw addressed to the
  next turn), which reads 46.7% against a 65.0% floor — so the file can see a miss.
- **A print block was inserted by a `replace` that silently did not match** and the run came back with
  no clause 7 or 8 at all, reporting success. Caught by reading the SIZE of the output against what
  the file was supposed to print.
- **`tools/lownode.cmd` cannot be called from Git Bash's `cmd.exe /c "..."`.** `start` opens a bare
  interactive shell, runs nothing, and **exits 0**. `tests/test-lownode.js` is GREEN — it invokes the
  wrapper through `child_process.execFileSync('cmd.exe', ['/c', WRAP, ...])`, which works. This is a
  shell quirk on the caller's side and not a repo defect, but it is exactly the "reports success
  having done nothing" shape, so it is recorded. Every run in this report went through a node
  `spawnSync('cmd.exe', ['/c', WRAP, ...])` shim.

## OWED, NOT RUN

- **The landing itself**, pending Will's call on section 4.
- `tests/test-engine-diff.js` — **not re-run**; no damage code was touched and no engine byte moved,
  so the 0 of 6000 at sixteen corners stands from 2026-08-27 02:09.
- `tests/test-mechanics.js` — **not re-run**; nothing was fixed, so the census cannot have moved. It
  is unmoved at 754 / 754 / 0.
- The three roster stages and `all_mechanics_fire.js --kind all` — **not re-run**; no release was cut.
- `tests/interaction_matrix.js`, `engine/wire_ladder.js`, `tests/run-all.js`, `tests/staged_board.js`,
  `tests/bench-medicham.js --record` — **not run**, as in the preceding batches.
- The `midHash` weakness in section 5 — filed, not fixed. It belongs to whoever owns re-baselining the
  arm, because it moves every published rate.
- `tests/test-middle-identity.js`, `tests/test-web-status.js` and `tests/test-resolution-order.js`
  were named RED at HEAD in an earlier brief; **not run and not this batch's.**
- `.scratch_*`, `stash@{0}` and the pre-modified `data/*.json` are another session's. Reported, left,
  nothing executed in any of them.
