# The doll's status road is `onTryPrimaryHit` — 2026-08-27, ENGINE

**LEAD: THE AFFECTED MOVE SET IS NOT EMPTY. Eleven legal moves show it, led by Thunder Wave, Toxic
and Will-O-Wisp.** The brief's premise is confirmed and it was two-thirds of the defect; the other
third was found while confirming it and is bigger.

Release `500a9312f041`. CHANGELOG 5.174.0. Register row ROADMAP **#485**.
Probe: `tests/probe_substitute_status_step.js` — 12 arms, 7 red proven, 5 controls held, 0 failing.

---

## 1. THE PREMISE, CONFIRMED FROM THE AUTHORITY'S OWN SOURCE

`Battle.actions.trySpreadMoveHit` (`sim/battle-actions.ts:550-577`) declares `moveSteps` as data.
The Champions mod overrides `spreadMoveHit` (`data/mods/champions/scripts.ts:315`) and
`hitStepMoveHitLoop` (`:428`) and **nothing above them** — the file contains no `trySpreadMoveHit`
and no `moveSteps` — so gen 9 Champions keeps mainline's order:

```
556  hitStepInvulnerabilityEvent   0
559  hitStepTryHitEvent            1   Protect, Good as Gold, the absorbers
562  hitStepTypeImmunity           2
565  hitStepTryImmunity            3   powder, onTryImmunity, Prankster-into-Dark
568  hitStepAccuracy               4   THE DIE
571  hitStepBreakProtect           5
574  hitStepStealBoosts            6
577  hitStepMoveHitLoop            7   -> spreadMoveHit -> tryPrimaryHitEvent -> THE DOLL
```

`data/mods/champions/scripts.ts:342` is the mod's own `// 0. check for substitute`, calling
mainline `tryPrimaryHitEvent` (`:1138`), which runs the `substitute` condition's `onTryPrimaryHit`
in `data/moves.ts`. **Champions overrides neither `substitute` in `moves.ts` nor anything in
`conditions.ts`** — grepped both, no match.

So the doll is asked at index **7** and accuracy at index **4**. The brief is right.

## 2. AND THE HANDLER DOES SOMETHING THIS ENGINE NEVER DID

```js
let damage = this.actions.getDamage(source, target, move);
if (!damage && damage !== 0) { this.add('-fail', source); this.attrLastMove('[still]'); return null; }
```

A Status move is `basePower: 0`, so `getDamage` returns **`undefined`** at
`sim/battle-actions.ts:1620` (`if (!basePower) return basePower === 0 ? undefined : basePower;`).
It cannot answer `-immune` on the way in: `hitStepTypeImmunity` sets `move.ignoreImmunity = true`
for every Status move (`:655-657`), so `runImmunity` inside `getDamage` short-circuits true.

**So the authority's answer to a status move at a doll is `|-fail|<THE MOVER>` with the `|move|`
line's target blanked and `[still]` appended.** Staged and read, not inferred:

```
SHOWDOWN   |move|p2a: Slowbro|Thunder Wave||[still]     |-fail|p2a: Slowbro
MEDICHAM   |move|p2a: Slowbro|thunderwave|p1a: Alakazam |-activate|p1a: Alakazam|move: Substitute|[block]
```

`|-activate|...|move: Substitute|[block]` **is not a gen 9 line at all.** `[block]` appears twice in
the whole simulator — `data/mods/gen1stadium/moves.ts:234` and `data/mods/gen2/moves.ts:690` — and
even there the shape is `'[block] ' + move.name`.

## 3. WHICH MOVES ARE AFFECTED — DERIVED, NOT LISTED

Status, foe-aimed, no `bypasssub`, printed accuracy under 100, filtered
`x.exists && !x.isNonstandard && x.tier !== 'Illegal'` on `gen9championsvgc2026regmb`. **Eleven**,
re-derived and printed by the probe on every run:

```
hypnosis@60  leechseed@90  poisonpowder@75  sleeppowder@75  stringshot@95  stunspore@75
swagger@85   sweetkiss@75  thunderwave@90   toxic@90        willowisp@85
```

Not exotic. The **line** half is wider still: it is every sub-blocked status move at any accuracy,
which includes the thirteen 100%-accuracy ones (`block`, `yawn`, `painsplit`, `meanlook`, …).

## 4. DOES ANYTHING KEY ON "MISSED" RATHER THAN "BLOCKED"? — CHECKED, NOT INHERITED

The one item consumer inside `hitStepAccuracy` is **Blunder Policy**, and
`D.items.get('blunderpolicy').isNonstandard === 'Past'` — **banned in this format**, the same shape
the No Guard batch found. Swept every legal item and ability for an accuracy/miss handler:

```
item    brightpowder widelens zoomlens          (modify a number, no side effect)
ability compoundeyes hustle noguard sandveil snowcloak tangledfeet victorystar wonderskin
```

None of them acts on a miss. **What does key on it is the DIE**: the authority draws `acc` where
this engine drew nothing, and Wonder Skin's `this.random(2)` sits in that same step. Under a
live-dice arm that is a desynchroniser, not a cosmetic difference. It is why the fix is not purely
narration even though no board moved in the pool.

## 5. WHAT WAS ACTUALLY WRONG — FIVE SITES, ONE SENTENCE

| site | branch | position | what it said |
|---|---|---|---|
| `_asTryHit`, `_ASTEPS` index 1 | `affect` | above the die | `-activate ...\|[damage]` |
| top of the `status` chain | `status` (major status) | above powder, Prankster **and** the die | `-activate ...\|[block]` |
| `sharesHP` chain | Pain Split | already last (no die in that branch) | `-activate ...\|[block]` |
| `trap` chain | Block / Mean Look | already last (no die in that branch) | `-activate ...\|[block]` |
| `perTurnHP` guard conjunct | **Leech Seed** | above the die | **nothing at all** |

**The Leech Seed site was found while confirming the brief and is the worst of the five.** It was a
bare `&& !subBlocks(m,t,a.mv)` inside the guard, so a Leech Seed at a substituted body printed *no
line whatsoever* where the authority prints `|-miss|` at 90% or `|-fail|` when it lands.

## 6. THE FIX

`engine/medicham2-browser.js` only.

- `subStatusRefuse(att,def)` — one function, one fact: `TR.attrStill(); TR.fail(att); att._mvRes=false`,
  counting `MEDSEEN.subStatusFailedBelowAccuracy`.
- `affect`: a new `_asSub` step between `_asAccuracy` and `_asEffects` — its own step, not the first
  line of `_asEffects`, because the authority runs it across every target before any of them reaches
  `getSpreadDamage`, which is the same step-outside/target-inside rule the rest of `_ASTEPS` obeys.
- `status`: the call moves from the top of the chain to below the accuracy roll.
- `sharesHP`, `trap`: line only — those branches have no accuracy step, so they were already at the
  authority's position and only the answer was wrong.
- `leechseed`: the conjunct becomes an explicit `_lsDoll`, asked **after** the roll.

**The knob** `MEDI_SUB_STATUS_AT_TRYHIT=1` restores position *and* line together, per site, including
Leech Seed's silence — a revert that "tidied" the old behaviour would not be one. It stamps
`MEDFAILS.subStatusAtTryHitRestored = 1` at **module load**, and the probe asserts that stamp present
on the knob load and **absent** on the clean one before it classifies any arm.

## 7. THE PROBE — 12 ARMS, NO TYPED EXPECTATION

Both engines play the same script under the differential's own pin; the pass is that the two protocol
streams do not part. Every fixture is legality-checked against `Dex.forFormat` (species, ability,
item, learnset) before any arm runs. Every arm prints its target's **refusal-reason count not
counting the doll** and fails above one — it reads `(none)` on all twelve.

| arm | pin | clean | knob |
|---|---|---|---|
| `twave-miss` | top (all sub-100 miss) | agrees | **parts** |
| `twave-hit` | bottom (all sub-100 hit) | agrees | **parts** |
| `swagger-miss` | top | agrees | **parts** |
| `painsplit` | top | agrees | **parts** |
| `block-trap` | top | agrees | **parts** |
| `leechseed-miss` | top | agrees | **parts** |
| `leechseed-hit` | bottom | agrees | **parts** |
| `nodoll-miss` / `nodoll-hit` | top / bottom | agrees | holds |
| `damage-doll-miss` / `damage-doll-hit` | top / bottom | agrees | holds |
| `bypasssub` (Disable) | top | agrees | holds |

**Shown red first.** Before the fix all seven red arms read `PARTS CLEAN` on exactly those shapes and
all five controls held.

**The counter assertion is asymmetric on purpose, and that asymmetry IS the ordering claim.** Three
arms declare `refuseClean: 0, refuseKnob: 1` — under the top pin the die turns the move away at step
4, so the doll is never reached at all on the fixed engine and is reached first on the reverted one.
An arm that expected one number for both loads would have to be wrong about one of them.

## 8. WHICH SCOREBOARD IT SHOULD MOVE, SAID BEFORE THE RUN

**Predicted: the lab moves, the pool sits still.** No pool game stages a status move into a doll.
Measured, on release `500a9312f041`, arm `middle`, 961 games, `--team-store data/team-pool-frozen`,
census pin `9446a684709d`, `--state --end-state`:

| | before | after |
|---|---|---|
| census | 755 live / 755 probed / 0 missing | **756 / 756 / 0** |
| whole-game | 3 of 961 (8 raw, less 5 declared) | **3 of 961 (8 raw, less 5 declared)** |
| board-material (`games − games_board_never_diverged`) | 1 of 961 | **1 of 961** |
| mechanics clause | 5 of 12 | 5 of 12 |
| VOID (instrument desync) | 1 of 961 | 1 of 961 |

Both quantities read out of `data/game-differential.json`, never off stdout. The eight
first-divergence causes are the **same eight strings** before and after — five declared
`fallenundefined`, two Tailwind `-sideend`, one `-damage: a different body`. Nothing cleared and
nothing arrived. Prediction held.

Damage did **not** move: `tests/test-engine-diff.js --n 300 --seed 20260804` reads **0 of 300 at all
sixteen corners**; the publish guard refused the shrink as designed and wrote
`data/verification/engine-diff.n300.json`. The published 6,000-row artifact stands untouched.

## 9. FILED, NOT FIXED — AND THIS ONE IS BOARD-MATERIAL

**`yawn` NEVER ASKS THE DOLL AT ALL.** Its branch owns its own refusal chain (`allyRefusesVolatile`,
`tryHitRefusal`, `shieldRefuses`, `pranksterBlocked`) and does not call `subBlocks` anywhere, so a
Yawn at a substituted body **lands the drowse** here and fails outright there. Staged and read:

```
SHOWDOWN   |move|p2a: Slowbro|Yawn||[still]      |-fail|p2a: Slowbro
MEDICHAM   |move|p2a: Slowbro|yawn|p1a: Alakazam |-start|p1a: Alakazam|move: Yawn
```

That is a **state** divergence — the target falls asleep two turns later in this engine and never in
the authority — and it is a MISSING check, not a misplaced one. It is deliberately not in this batch:
every site this batch touched already CALLED `subBlocks`, and adding a caller is a different change
with a different control. Same reasoning `corrosivegas` was named and left by the spread-status batch.

Also noticed and not this batch's: `|-start|p1a|move: Yawn` carries `[of] p2a: Slowbro` in the
authority and no `[of]` here.

## OWED, NOT RUN

```bash
# the full 6,000-row damage differential — NOT re-run. The change is entirely inside the status
# branches; the damage differential drives the damage function directly and never enters them, and
# the 300-row confirmation above reads 0/300 at all sixteen corners.
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
```

**RUN, with results in section 8:**

```bash
node tests/probe_substitute_status_step.js                                   # 12 arms, 0 failing
node tests/probe_substitute_status_step.js --only twave-miss                 # one arm
node tests/test-mechanics.js                                                 # 756 live / 756 probed
tools\lownode.cmd engine\game_differential.js --games 1200 --arm middle \
  --release 500a9312f041 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --state --end-state --write
tools\lownode.cmd tests\roster.js --stage {items,abilities,moves} --release 500a9312f041 --write
tools\lownode.cmd engine\all_mechanics_fire.js --kind all --release 500a9312f041 --write
node --max-old-space-size=6144 tests/test-resolution-order.js                # 26 arms, 1 KNOWN-OPEN, 0 failing
node tests/probe_spread_status_steps.js                                      # 6 arms, 0 failing
node tests/probe_endturn_clock_order.js                                      # 7 arms, 1 KNOWN-OPEN, 0 failing
node tests/test-encore-fail-silent.js  tests/test-volatile-duration.js
node tests/test-protocol-trace.js  tests/test-game-diff.js  tests/test-end-state.js
node tests/test-middle-identity.js
```

Roster: all three stages byte-identical to the previous release —
`{"FIRED-AND-BOARDS-DIFFER":0,"DID-NOT-FIRE":0}` on items, abilities and moves.
`all_mechanics_fire --kind all` on `500a9312f041`: the **identical** diverging set —
moves 8 (+2 shelved), abilities 3 (+1), items 1 (+1); board tallies unchanged
(moves STATE 5 / ANNOUNCEMENT-ONLY 7 / NO-DIVERGENCE 484).
