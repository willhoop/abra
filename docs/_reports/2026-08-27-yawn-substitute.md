# Yawn never asked the doll — 2026-08-27, ENGINE

## THE ANSWER TO THE QUESTION THE BRIEF ASKED FIRST: WHAT THE AUTHORITY PRINTS

Measured on the official simulator, one staged turn, Alakazam behind a Substitute, Slowbro clicking
Yawn at it. Both engines played the identical script under the differential's own pin:

```
showdown  |-fail|p2a: Slowbro
medicham  |-start|p1a: Alakazam|move: Yawn
```

**`|-fail|` on the MOVER.** Not `-activate`. Not a line on the target. Not the
`|-activate|<target>|move: Substitute|[block]` shape the last batch had to delete, and not a tidier
invention. The mover's `|move|` line also carries `[still]` (`attrLastMove('[still]')`), which is the
same two-part answer `subStatusRefuse` already emits at the five sites the previous batch fixed —
so the fix reuses that helper rather than writing a sixth line.

## 1. THE PREMISE WAS CORRECT — CONFIRMED, NOT ASSUMED

`grep subBlocks engine/medicham2-browser.js` named ten call sites before this batch. The
`a.kind==='yawn'` branch was not one of them. It walked its veil check (`allyRefusesVolatile`), its
`tryHitRefusal` (Good as Gold, Magic Bounce), its `shieldRefuses` (Protect), its already-drowsing
`-fail` and its `canTakeStatus` — and then wrote the drowse onto the body BEHIND the doll.

A MISSING check, not a misplaced one. That is why it is its own batch.

### Where the authority asks, derived rather than recalled

`Battle.actions.trySpreadMoveHit` (`sim/battle-actions.ts:550-577`) declares `moveSteps` as data.
The Champions mod overrides `spreadMoveHit` (`data/mods/champions/scripts.ts:315`) and
`hitStepMoveHitLoop` (`:428`) and nothing above them. Inside the mod's own `spreadMoveHit`:

```
:332   hitResult = this.battle.singleEvent('TryHit', moveData, {}, target, pokemon, move);
:336   if (hitResult === false) { add('-fail', pokemon); attrLastMove('[still]'); }
:343   // 0. check for substitute
:346   damage = this.tryPrimaryHitEvent(damage, targets, pokemon, move, moveData, isSecondary);
:373   // 3. onHit event happens here   -> runMoveEffects -> addVolatile('yawn')
```

So the MOVE's own `onTryHit` is above the doll and `addVolatile` is below it. Yawn's own handler
(`data/moves.ts:21135-21139`) is `onTryHit(target) { if (target.status ||
!target.runStatusImmunity('slp')) return false; }`.

**The doll's handler is mainline's, and that was checked rather than assumed.**
`data/mods/champions/conditions.ts` has no `substitute` key and no `onTryPrimaryHit` at all (grepped,
zero matches); `data/mods/champions/moves.ts` has no `substitute` key. So the `substitute` CONDITION
inside `data/moves.ts`'s `substitute` entry is what this format plays:

```js
if (target === source || move.flags['bypasssub'] || move.infiltrates) return;
let damage = this.actions.getDamage(source, target, move);
if (!damage && damage !== 0) { this.add('-fail', source); this.attrLastMove('[still]'); return null; }
```

Yawn is `basePower: 0`, so `getDamage` returns **undefined** at `sim/battle-actions.ts:1620`
(`if (!basePower) return basePower === 0 ? undefined : basePower;`). It cannot answer `-immune` on
the way, because `hitStepTypeImmunity` sets `move.ignoreImmunity = true` for every Status move
(`:655-657`).

## 2. NO DIE MOVES — SO SEEDED RUNS STAY COMPARABLE

Unlike the stage-order batch, where the authority drew `acc` and this engine drew nothing:

- Yawn's printed accuracy is `true` (`dex.moves.get('yawn').accuracy`, printed by the probe on every
  run), so `hitStepAccuracy` takes no draw for it on either engine.
- `getDamage` returns at the `basePower` test, which is **above** the crit `randomChance`.

**Nothing in this batch changes a draw.** Corroborated downstream: `tests/test-engine-diff.js
--n 300 --seed 20260804` reports **0 of 300 at every one of the sixteen corners** (top, bottom and
idx01–idx14), and the publish guard refused the shrink as designed (exit 3, wrote
`data/verification/engine-diff.n300.json`, left `data/engine-diff.json` alone). Damage did not move,
which is what the brief said to check for.

## 3. THE FIX

`engine/medicham2-browser.js`, in the `a.kind==='yawn'` branch, immediately below the `shieldRefuses`
block and above the already-drowsing `-fail`:

```js
if(t&&!t.fainted&&subBlocks(m,t,a.mv)){
  if(YAWN_IGNORES_SUB)MEDSEEN.yawnDollIgnored++;
  else{subStatusRefuse(m,t);m._lastMove=a.mv;continue;}
}
```

Placement is the authority's, not a convenience: `tryHitRefusal` and `shieldRefuses` are the step-1
group and stay above; the already-drowsing `-fail` and the apply are `runMoveEffects` and stay below.

**`canTakeStatus` staying below the doll is not a discrepancy anything can observe.** The authority
puts yawn's own `onTryHit` above the doll, so a body that is BOTH sleep-immune and substituted is
refused by `onTryHit` there and by the doll here — and both write the identical `|-fail|<mover>` +
`[still]`. There is no third line to tell them apart.

The refusal is counted by the existing `MEDSEEN.subStatusFailedBelowAccuracy`, because it takes the
same helper and the same road as the other five sites. `MEDSEEN.yawnDollIgnored` counts only the
knob's road and must read 0 on any shipping run. `MEDFAILS.yawnIgnoresSubRestored` is stamped at
LOAD time under `MEDI_YAWN_IGNORES_SUB=1`.

## 4. THE PROBE — `tests/probe_yawn_substitute.js`

Six arms, two engines, no typed expectation; both engines play the identical script under the
differential's own pin and the two protocol streams are compared. Each arm is played twice — clean,
then under `MEDI_YAWN_IGNORES_SUB=1` — and the knob is asserted to have REACHED the module the driver
played (`MEDFAILS` stamp absent clean, present on the knob; the two counters exact mirrors).

| arm | kind | what it holds |
|---|---|---|
| `yawn-doll` | red | one turn. Parts clean before the fix, agrees after, parts under the knob |
| `yawn-doll-sleep` | red | two turns under `--end-state`. `\|-status\|…\|slp` count in the medicham stream: **0 clean, 1 on the knob** — the board-material claim, asserted |
| `nodoll` | control | doll cleared EXPLICITLY (Calm Mind instead of Substitute); the drowse still lands |
| `nodoll-sleep` | control | and the sleep still lands two turns on, in BOTH engines, on BOTH loads |
| `bypasssub` | control | Disable carries `bypasssub`; it must still reach the body behind the doll |
| `damage-doll` | control | Hydro Pump into the same doll — the damaging road is already correct and must stay so |

**RED FIRST, and it was.** Before the fix: `PARTS CLEAN yawn-doll` and `PARTS CLEAN
yawn-doll-sleep`, 6 arms staged / 9 failing, exit 1. After: 6 arms staged / 0 failing, exit 0.

**One instrument fault, caught and named.** The first draft declared `refuseKnob: 0` for the two doll
arms, which is self-contradictory — a knob that ignored nothing reverted nothing, and the arm could
not have parted. The engine was right and the table was wrong; it is now `ignoreKnob`, is 1 on both
doll arms, and the printed line says why.

**Fixture blocked for exactly one reason, derived and refused above one.** The probe derives the
sleep-blocking ability set from the format's own handlers (anything whose `onSetStatus` /
`onTryAddVolatile` / `onImmunity` / `onAllySetStatus` / `onStart` source names `slp` — **3** legal
members) rather than listing them, walks the target's types one at a time, asks `getImmunity` for the
status the move actually inflicts, and reads the tag artifact for ability and item refusals. Every
arm printed `(none)`. Alakazam is mono-Psychic with Inner Focus, statusless, on no terrain, drowsing
nothing.

Every body and click is learnset-legal, checked at run time against
`Dex.forFormat('gen9championsvgc2026regmb')`: Slowbro learns Yawn, Alakazam learns Substitute and
Calm Mind, Disable and Hydro Pump are Slowbro's.

## 5. THE CENSUS ROW

`tests/test-mechanics.js` gained `probe('move','delayedSleep','a substitute refuses a Yawn, and
Infiltrator drowses through it')` — three turns (set the doll up, click the Yawn, idle), three arms:

- **control** Swords Dance setup (a self-targeting click that leaves no doll) → drowsed, slept.
- **test** Substitute setup → not drowsed, not slept, doll still standing.
- **over-fire control** the same Substitute with an **Infiltrator** mover → drowsed THROUGH the doll
  and slept, doll still standing. This is what separates "the doll refused it" from "Yawn stopped
  working".

Fixture is learnset-legal: Slowbro learns Yawn, Garchomp learns Substitute and Swords Dance.

## 6. THE SCOREBOARD — PREDICTED BEFORE THE RUN, AND IT HELD

Stated in advance: **census/mechanics move, the pinned pool sits still.**

| | before | after |
|---|---|---|
| census | 756 live / 756 probed / 0 missing | **757 live / 757 probed / 0 missing** |
| whole-game | 3 of 961 (8 raw, 5 declared) | **3 of 961 (8 raw, 5 declared)** |
| board-material | 1 of 961 (961 − 960) | **1 of 961 (961 − 960)** |
| roster / items | 139 of 148 | 139 of 148 |
| roster / abilities | 129 of 202 | 129 of 202 |
| roster / moves | 475 of 500 | 475 of 500 |
| damage, sixteen corners | 0 of 300 | 0 of 300 |

Both differential figures read out of `data/game-differential.json` (`arms[0].diverged`,
`end_state[0].summary.verdicts`), not off stdout.

**Yawn IS exercised by the pinned pool, and that is worth saying rather than leaving as a shrug.**
The artifact's coverage block credits `move:delayedSleep` at **2** effect events across 961 games. So
the move is clicked and connects there; what does not occur in the pool is a Yawn meeting a STANDING
doll. The pool sitting still is therefore a fact about co-occurrence, not about the move being absent.

**And one instrument is structurally blind to half of this.** `board_state.js`'s `NOT_COMPARED` list
— printed by every `all_mechanics_fire` run — names *"yawn, attract, curse (the Ghost form) and heal
block"*. The DROWSE volatile is not a compared board leaf. The SLEEP it becomes is, which is why the
probe asserts on `|-status|…|slp` rather than on the drowse.

## 7. THE SWEEP — EIGHT MORE KINDS NEVER ASK THE DOLL. REPORTED, NOT FIXED.

Derived, not grepped by name: every legal Status move that is foe-aimed and carries no `bypasssub`
(**54** moves) was classified through the engine's OWN `playerAction`, and each resulting action kind
was asked structurally whether `subBlocks(` appears inside its `a.kind===` branch.

| moves | kind | doll consulted? |
|---:|---|---|
| 23 | `affect` | yes |
| 10 | `status` | yes |
| 2 | `trapmove` | yes |
| 1 | `sharehp` | yes |
| 1 | `yawn` | **yes — this batch** |
| 4 | `typechange` | **NO** — trickortreat forestscurse magicpowder soak |
| 3 | `trickitem` | **NO** — corrosivegas switcheroo trick |
| 3 | `abilitywrite` | **NO** — entrainment simplebeam worryseed |
| 2 | `statrewire` | **NO** — guardsplit powersplit |
| 1 | `boostally` | **NO** — decorate |
| 1 | `healdesc` | **NO** — healpulse |
| 1 | `lockon` | **NO** — lockon |
| 1 | `reorder` | **NO** — quash |
| 1 | `transform` | **NO** — transform |

**One of them was corroborated by PLAYING it, so the table does not rest on a grep.** Heal Pulse into
the same staged doll:

```
healpulse@doll        parted=true    showdown |-fail|p2a: Slowbro    medicham |-heal|p1a: Alakazam|130/130
healpulse@nodoll CTL  parted=false
```

The control clears the doll explicitly and HOLDS, so that cell has exactly one cause.

**Trick was also played and its cell is NOT attributable — declared rather than counted.** Both arms
part:

```
trick@doll        parted=true   showdown |-fail|p2a: Slowbro
                                medicham |-activate|p2a: Slowbro|move: trick
trick@nodoll CTL  parted=true   showdown |-enditem|p2a: Slowbro|Leftovers|[silent]|[from] move: Trick
                                medicham |upkeep
```

A fixture blocked for two reasons proves nothing about either. Trick carries a **separate,
pre-existing defect** (a `-activate|move: trick` line the authority does not write, and a missing
`-enditem`) which must be settled before its doll behaviour can be measured at all.

The remaining seven kinds are **structural only**: the check asks whether `subBlocks(` appears
between one `a.kind===` and the next, which can mis-slice a nested branch and cannot see a doll
consulted through a helper. They are filed, not claimed.

**Fixed here: Yawn alone. Batches of one.**

## 8. WHAT ELSE THE RUN SAID, LEFT ALONE

- The hand-list item *"`|-start|…|move: Yawn` carries `[of] <source>` in the authority and no `[of]`
  here"* is **not resolved and not re-verified**. The `nodoll` arms agree clean, but
  `game_differential.js` runs a `source-tag` equivalence that collapses exactly that field, so
  agreement there is not evidence either way. It stays on the hand list.
- `MEDSEEN.allyVeilRefusedVolatile` is incremented and NOTHING is emitted, where Sweet Veil's
  `onAllyTryAddVolatile` writes `|-activate|…|ability: Sweet Veil`. Noticed while placing this fix,
  not touched by it, and not measured — filed, not claimed.
- Not touched, per the brief: `midEventValue`, `midEventDice`, `tests/test-middle-identity.js`,
  Tailwind, the closet, any declared row, `magnetrise@18`, `perishsong@24`, `uproar@28`,
  `lockedmove`, `_refills`/`speedSort`, the multi-hit `nth`, `web/`, `app/`,
  `data/engine-data.js`, `engine/quality.js`, `data/quality-filter.json`.

## 9. WHAT WAS RUN

Release **`01be9daf14ee`** (cut for this batch — `engine/medicham2-browser.js` is a SOURCES file and
it moved), arm `middle`, 961 games, cap 12, `--team-store data/team-pool-frozen`, census pin
`9446a684709d`, `--state --end-state`.

| command | result |
|---|---|
| `node tests/probe_yawn_substitute.js` | 6 arms, 0 failing (before the fix: 9 failing, both reds `PARTS CLEAN`) |
| `node tests/test-mechanics.js` | **757 live, 0 missing, 757 probed**, 0 threw, 0 hollow |
| `tools\lownode.cmd engine\game_differential.js … --write` | 961 games, 8 raw diverged, `SAME-END-STATE` 960 / `DIFFERENT-END-STATE` 1 |
| `tools\lownode.cmd tests\roster.js --stage {items,abilities,moves} --write` | 139/148, 129/202, 475/500 — all three PASS, all three stamped `01be9daf14ee` |
| `tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write` | 1289 games, 0 threw; moves STATE 5 / ANNOUNCEMENT-ONLY 7 / NO-DIVERGENCE 484, abilities 1 / 3 / 166, items 1 / 1 / 71 |
| `node tests/test-engine-diff.js --n 300 --seed 20260804` | 0 of 300 at all sixteen corners; publish guard refused the shrink (exit 3, as designed) |
| `node --max-old-space-size=6144 tests/test-resolution-order.js` | 26 arms, 1 KNOWN-OPEN, 0 failing |
| `node tests/probe_substitute_status_step.js` | 12 arms, 0 failing (the neighbouring batch still holds) |
| `node tests/test-volatile-duration.js` | all 4 scenarios identical to the official engine |
| `node tests/test-end-state.js` | ALL GREEN |

## OWED, NOT RUN

Exact commands. `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` for all of them.

```bash
# 1. The eight kinds that never ask the doll (section 7). ONE BATCH EACH, red first, and the
#    fixture must be cleared for a single reason. Corroborate by PLAYING before fixing —
#    the structural sweep is a lead, not a measurement.
node tests/probe_yawn_substitute.js            # the pattern to copy: knob, control, no typed expectation

# 2. TRICK'S OWN DEFECT, which must be settled before its doll cell means anything:
#    we write `|-activate|p2a: Slowbro|move: trick` and never `|-enditem|…|[from] move: Trick`.
#    Blocked for two reasons today — that is why it is not counted in section 7.

# 3. The `[of] <source>` on `|-start|…|move: Yawn`, still on the hand list. It needs an
#    instrument that does NOT collapse the source-tag equivalence.

# 4. Sweet Veil / Flower Veil announce nothing here (`allyRefusesVolatile`). Not measured.

# 5. Nothing in this batch is a strength claim and none is owed. No fit, no self-play, no
#    6,000-row re-run: damage did not move, and section 2 says why it could not.
```
