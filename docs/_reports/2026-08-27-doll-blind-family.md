# The doll-blind family — 2026-08-27, ENGINE

## LEAD: SEVEN KINDS, NOT EIGHT AND NOT NINE, AND THEY DO SHARE ONE ROOT

The brief's own count discrepancy — "EIGHT MORE KINDS" followed by a list of nine — was not carried.
It was re-derived from scratch: all **54** legal Status moves that are foe-aimed and carry no
`bypasssub` were classified through this engine's OWN `playerAction`, and each resulting `a.kind===`
branch was asked structurally whether it calls `subBlocks(`.

**NINE kinds fail that grep. SEVEN are defects.** The other two were separated by PLAYING them, not
by reading them:

| kind | moves | verdict |
|---|---:|---|
| `typechange` | 4 — trickortreat forestscurse magicpowder soak | **DEFECT — fixed** |
| `abilitywrite` | 3 — entrainment simplebeam worryseed | **DEFECT — fixed** |
| `statrewire` | 2 — guardsplit powersplit | **DEFECT — fixed** |
| `boostally` | 1 — decorate | **DEFECT — fixed** |
| `healdesc` | 1 — healpulse | **DEFECT — fixed** |
| `lockon` | 1 — lockon | **DEFECT — fixed** |
| `reorder` | 1 — quash | **DEFECT — fixed** |
| `transform` | 1 — transform | **NOT A DEFECT.** It asks the doll through a bare `_tt._sub>0`, which a grep for `subBlocks(` cannot see. Played both arms: neither parts. Carried as a control that must stay unparted. |
| `trickitem` | 3 — corrosivegas switcheroo trick | **BLOCKED TWICE — reported, not fixed.** See §5. |

**SEVEN KINDS, THIRTEEN MOVES.** All thirteen were shown RED BY PLAY before a byte moved, each with a
control that HOLDS.

**AND THE ROOT IS GENUINELY SHARED — verified, not assumed.** The doll's handler does not know which
move hit it. `data/moves.ts`'s `substitute` CONDITION (Champions overrides neither `substitute` in
`moves.ts` nor anything in `conditions.ts` — that file has no `substitute` key and no
`onTryPrimaryHit` at all) is:

```js
if (target === source || move.flags['bypasssub'] || move.infiltrates) return;
let damage = this.actions.getDamage(source, target, move);
if (!damage && damage !== 0) { this.add('-fail', source); this.attrLastMove('[still]'); return null; }
```

Every one of the thirteen is `basePower: 0` Status, so `getDamage` returns **undefined**
(`sim/battle-actions.ts:1620`) and every one takes the identical two lines: `|-fail|` on the MOVER,
`[still]` on the mover's own `|move|` line. Measured on the authority, one staged turn per move:

```
trickortreat@doll  showdown |-fail|p2a: Gourgeist    medicham |-start|p1a: Garchomp|typeadd|Ghost|[from] move: trickortreat
forestscurse@doll  showdown |-fail|p2a: Trevenant    medicham |-start|p1a: Garchomp|typeadd|Grass|[from] move: forestscurse
magicpowder@doll   showdown |-fail|p2a: Hatterene    medicham |-start|p1a: Garchomp|typechange|Psychic
soak@doll          showdown |-fail|p2a: Pelipper     medicham |-start|p1a: Garchomp|typechange|Water
entrainment@doll   showdown |-fail|p2a: Audino       medicham |upkeep
simplebeam@doll    showdown |-fail|p2a: Audino       medicham |upkeep
worryseed@doll     showdown |-fail|p2a: Musharna     medicham |upkeep
guardsplit@doll    showdown |-fail|p2a: Bastiodon    medicham |-activate|p2a: Bastiodon|move: guardsplit|[of] p1a: Garchomp
powersplit@doll    showdown |-fail|p2a: Cofagrigus   medicham |-activate|p2a: Cofagrigus|move: powersplit|[of] p1a: Garchomp
decorate@doll      showdown |-fail|p2a: Alcremie     medicham |-boost|p1a: Garchomp|atk|2
healpulse@doll     showdown |-fail|p2a: Slowbro      medicham |-heal|p1a: Garchomp|183/183
lockon@doll        showdown |-fail|p2a: Dragapult    medicham |-activate|p2a: Dragapult|move: lockon|[of] p1a: Garchomp
quash@doll         showdown |-fail|p2a: Tinkaton     medicham |-activate|p1a: Skarmory|move: quash
```

Thirteen movers, thirteen different branches, **one answer**. That is what makes it one batch.

## 1. THE ROOT IS SHARED. THE INSERTION POINT IS NOT — AND COPYING ONE WOULD HAVE BEEN WRONG THREE TIMES

The doll sits BELOW the move's own `onTryHit` and ABOVE its `onHit`. So each branch's existing guards
had to be sorted into those two groups first, read out of `Dex.forFormat` one move at a time:

| move | handlers the format declares | consequence |
|---|---|---|
| trickortreat / forestscurse / magicpowder / soak | `onHit` only | the engine's `_tRefused` guard is BELOW the doll — the doll check goes ABOVE it |
| entrainment / simplebeam | `onTryHit`, `onHit` | the ability guards are ABOVE the doll — the doll check goes BELOW `_blocked` |
| worryseed | `onTryImmunity`, `onTryHit`, `onHit` | same, and `immunityGateRefuses` stays above |
| guardsplit / powersplit | `onHit` only | nothing between the shield and the doll |
| decorate | **none at all** — the whole effect is the `boosts` field in `runMoveEffects` | doll above the boost |
| healpulse | `onHit` | the full-HP `-fail|<target>|heal` and the same-status refusal are BELOW the doll |
| lockon | `onTryHit`, `onHit` | `refusesIfAlreadyUp` is ABOVE the doll and is repeated at the new call |
| quash | `onHit` | **the one that would have been silently wrong** |

**QUASH IS THE CASE THAT JUSTIFIES DOING THIS PER BRANCH.** Its `if (!this.queue.willMove(target))
return false` lives in `onHit`, not `onTryHit`. A doll check written under the engine's
`unresolved.has(t)` test would never run on the turns the target has already moved — which is most of
them — and every arm would still have been green, because both roads end in a `-fail` on the mover.
The two failures also print differently: the doll's carries `[still]` and `mvFail` does not.

## 2. THE FIX

`engine/medicham2-browser.js` only. One helper beside `subStatusRefuse`, seven callers:

```js
function subRefusesStatus(att,def,mvId){
  if(!def||def.fainted||def.curHP<=0)return false;
  if(!subBlocks(att,def,mvId))return false;
  if(DOLL_BLIND_FAMILY){MEDSEEN.dollBlindFamilyIgnored++;return false;}
  subStatusRefuse(att,def);
  return true;
}
```

One function rather than seven copies, because the answer is identical for all thirteen and a seventh
copy is the facts-are-global breach CLAUDE.md names. `subStatusRefuse` is the SAME helper the six
pre-existing sites already take, so the counter `MEDSEEN.subStatusFailedBelowAccuracy` covers this
family too and no second implementation of "what happened" was added.

`MEDI_DOLL_BLIND_FAMILY=1` reverts all seven at once — one knob, deliberately, because they are one
root and a per-branch knob would let a partial revert read as a pass. It stamps
`MEDFAILS.dollBlindFamilyRestored` at LOAD time and counts `MEDSEEN.dollBlindFamilyIgnored` per
refused target.

## 3. THE PROBE — `tests/probe_doll_blind_family.js`

**34 scored arms, 2 excluded. RED FIRST, AND IT WAS: 13 arms `PARTS CLEAN`, 47 failing, exit 1.
After: 0 failing, exit 0.**

- **13 red arms**, one per move, doll standing.
- **12 no-doll controls** — the identical board, click and turn, with Swords Dance raised instead of a
  Substitute.
- **1 `healpulse@dollbroken` control**, because Heal Pulse cannot use the no-doll control the other
  twelve use: its `onHit` fails at full HP, and a target that never raised a Substitute never paid the
  25%, so a plain no-doll arm would be **blocked for a second reason**. Instead the partner breaks the
  doll with a fixed-damage Seismic Toss (50 against the doll's 46, no damage roll, no spill), leaving
  the target's HP identical to the red arm's. **One variable, and it is the doll.**
- **4 Infiltrator over-fire controls** — Malamar, Malamar, Whimsicott, Dragapult, each the SAME SPECIES
  as its red arm with ONE ABILITY CHANGED. `move.infiltrates` is the authority's own second escape from
  `onTryPrimaryHit`, so the doll is STANDING and the move must land through it. A fix that made every
  status move fail at a doll passes all thirteen reds and fails these four.
- **`bypasssub`** (Disable), **`damage-doll`** (Hydro Pump), **`transform@doll`**, **`transform@nodoll`**
  — the roads that must not move.

**THE KNOB IS PROVEN TO HAVE REACHED THE MODULE THE DRIVER PLAYED**, not assumed:
`MEDFAILS.dollBlindFamilyRestored` **absent on the clean load, present on the knob load**, and the two
counters exact mirrors on every arm (`subStatusFailedBelowAccuracy` 1/0 clean-vs-knob on a red,
`dollBlindFamilyIgnored` 0/1).

**ONE REFUSAL REASON PER CELL, DERIVED AND REFUSED ABOVE ONE.** Six families, each read from the format
or an artifact rather than listed: type immunity walked one type at a time; the refusing ability/item
tags; the move's own `reflectable` rule against `reflectsStatusMoves`; the move's own `powder` rule
through `dex.getImmunity('powder', types)`; the type-writers' handler guard off `changesTargetType` in
`data/tags.json`; the ability-writers' guard off THIS ENGINE'S own action (`a.refused`, `a.becomes`)
plus the `cantsuppress` flag. **Every scored arm printed `(none)`.**

**AN INSTRUMENT FAULT, RECORDED BECAUSE IT KILLED THE FIRST RUN.** Alternating the harness per arm —
drop the driver and the snapshot engine out of `require.cache`, re-require, play, flip — is what the
Yawn probe does at 6 arms. At 34 arms it is 68 loads of a large module graph and node dies with a FATAL
v8 allocation failure part-way through. Both loads are now played as whole PASSES, clean then knob, two
loads total.

## 4. THE CENSUS ROWS — SEVEN, ONE PER KIND

`tests/test-mechanics.js`, reading the BOARD where the probe reads the stream. Three arms each: control
(Swords Dance, no doll), test (Substitute), and an **over-fire arm with Infiltrator on the mover** that
must land THROUGH the standing doll.

| tag | reads | control / doll / Infiltrator |
|---|---|---|
| `changesTargetType` | the target's types | `[Dragon,Ground,Ghost]` / `[Dragon,Ground]` / `[Dragon,Ground,Ghost]` |
| `rewritesTargetAbility` | the target's ability | `simple` / `roughskin` / `simple` |
| `rewritesStoredStats` | the target's Def (started 115) | `174` / `115` / `174` |
| `boostsTarget` | the target's **SpA** stage | `2` / `0` / `2` |
| `healDescriptor` | the target's HP (put at 91) | `183` / `91` / `183` |
| `guaranteesNextMove` | the mover's `lockon` volatile | `1` / `0` / `1` |
| `reordersTurn` | the target's Atk boost after a slower partner's Haze | `2` / `0` / `2` |

**TWO OF THESE ROWS WERE WRONG IN A COMFORTABLE DIRECTION FIRST AND WERE CORRECTED BEFORE LANDING.**

- `boostsTarget` originally read **Attack**. The no-doll control's setup click IS Swords Dance, which
  raises Attack by two on its own — so the control would have read "landed" on a board where Decorate
  did nothing at all. Decorate raises two stages and Swords Dance raises one; **Special Attack is the
  stage only Decorate can have moved.**
- `reordersTurn` cannot be read off the target at all, because what Quash changes is WHEN it moves. The
  observable is a **Haze from the quasher's slower partner**: Skarmory (70) outspeeds Toxapex (35), so an
  unquashed Swords Dance is raised and then wiped and the target ends at +0, while a quashed one is sent
  BELOW the Haze and survives at +2. Haze targets no body, so **the doll cannot absorb the measurement** —
  which every damage-based observable would have let it do.

**AND THE QUASH FIXTURE'S TARGET IS SKARMORY FOR A DERIVED REASON, NOT A CONVENIENT ONE.** There is no
legal Quash user faster than Garchomp — 8 legal learners, top base Speed 97 — so a Garchomp target would
have already moved, refusing Quash for a SECOND reason. Tinkaton is 94 to Skarmory's 70.

`dollArms(` was added to `REALTURN` in `tests/test-mechanics.js` **deliberately and with its reason**,
exactly as that file's own paragraph requires: it stages a real doubles board through `board()` →
`battleInit` and spends TWO real turns through `battleTurn`.

## 5. TRICK — THE SECOND MESSAGE DEFECT, REPRODUCED HERE AND LEFT ALONE

Not inherited from the brief; played, with Slowbro holding Leftovers so both bodies are not empty-handed:

```
trick@doll        parted   showdown |-fail|p2a: Slowbro
                           medicham |-activate|p2a: Slowbro|move: trick
trick@nodoll CTL  parted   showdown |-enditem|p2a: Slowbro|Leftovers|[silent]|[from] move: Trick
                           medicham |move|p2b: Slowking|calmmind|p2b: Slowking
```

**BOTH ARMS PART**, so the cell is evidence for nothing about the doll. Two separate faults are visible
in it: an `|-activate|…|move: trick` line the authority never writes, and a **missing** `|-enditem|…|
[from] move: Trick` pair. Both arms are carried in the probe as `excluded` and are printed and NOT
scored. Fixing the message defect first is owed; `corrosivegas` and `switcheroo` ride the same branch and
are blocked behind it.

## 6. THE SCOREBOARD — PREDICTED PER KIND BEFORE THE RUN

Stated in advance: **census up by seven, pinned pool still.** Rationale, per kind: these are rare moves
and the interaction needs one of them aimed at a body standing behind a Substitute in the same game.

| | before | after |
|---|---|---|
| census | 757 live / 757 probed / 0 missing | **764 live / 764 probed / 0 missing** |
| whole-game clause | 14 of 961 (19 raw, less 5 declared) | **14 of 961 (19 raw, less 5 declared)** |
| board-material | 12 of 961 (961 − 949) | **12 of 961 (961 − 949)** |
| mechanics clause | 5 of 12 | **5 of 12** |
| roster / items | 139 of 148, 0 DIFFER, 0 DID-NOT-FIRE | 139, 0, 0 |
| roster / abilities | 129, 0 DIFFER, 0 DID-NOT-FIRE | 129, 0, 0 |
| roster / moves | 475, 0 DIFFER, 0 DID-NOT-FIRE | 475, 0, 0 |
| damage, sixteen corners | 0 of 300 | 0 of 300 |

**THE BASELINE IN THE BRIEF (3 of 961 / 1 of 961) IS PRE-#489 AND MAY NOT BE COMPARED TO ANYTHING HERE.**
`node engine/arms_comparable.js <HEAD artifact> data/game-differential.json` **exits 1** with
*"`mode` differs: pins:2efbc9ed1946 vs pins:f646b0163bc0"*. ROADMAP #489's die finaliser landed under
this session and moved the pin digest; its own row already publishes 3 → 14 and 1 → 12 as a predicted
re-baseline. **My knob arm and my clean arm both read 19 raw / 12 board-material on the same release
`f9f3a61481cb`**, and `arms_comparable.js` calls THAT pair COMPARABLE (exit 0). So none of the rise is
this batch's.

**"THE POOL DID NOT MOVE" IS A MEASUREMENT HERE, NOT A SHRUG.** A preload counting the engine's own
globals across the whole pinned run reports:

```
COUNTERS subStatusFailedBelowAccuracy=0 dollBlindFamilyIgnored=0 yawnDollIgnored=0
```

**Zero doll refusals of any status move in 961 games** — not this family's seven sites, not Yawn, not
the six that already had the check. So the fix is not exercised by the pinned pool at all and could not
have moved either differential number. It is not an unwired knob: the probe asserts the knob's stamp
present-on-knob and absent-on-clean, and the counters mirror exactly on all thirteen red arms.

**WHICH OF THE KINDS APPEAR IN THE POOL AT ALL**, so the sentence above carries its real meaning. From
the run's own coverage block, six of the seven tags ARE exercised in the 961-game sample and
**`guaranteesNextMove` (Lock-On) is in `not_exercised`**. Raw occurrence counts across the whole frozen
store (`games.bo3.jsonl` + `games.ots.jsonl`, an upper bound — sheets and logs together): soak 495,
healpulse 416, entrainment 296, worryseed 182, decorate 178, simplebeam 74, trickortreat 26,
magicpowder 26, forestscurse 4, quash 832, and **guardsplit 0, powersplit 0, lockon 0**. Three of the
thirteen are absent from the frozen store entirely. The rest are clicked and connect; what does not
occur is one of them meeting a STANDING doll.

**THE DIE DOES NOT MOVE.** Five of the thirteen print `accuracy: true` and take no draw at all; the
other eight print `100` and draw in `hitStepAccuracy` on BOTH engines whether or not the doll answers,
because the doll is consulted three steps further down inside `hitStepMoveHitLoop`. `getDamage` returns
at the `basePower` test, ABOVE the crit `randomChance`. Corroborated downstream: `test-engine-diff
--n 300 --seed 20260804` reads **0 of 300 at every one of the sixteen corners** and the interior is clean
across all 14 indices; the publish guard refused the shrink as designed (exit 3).

## 7. WHAT WAS RUN

Release **`f9f3a61481cb`** (cut for this batch — `engine/medicham2-browser.js` is a SOURCES file and it
moved), arm `middle`, 961 games, `--turns 12`, `--team-store data/team-pool-frozen`, census pin
`9446a684709d`, `--state --end-state`.

| command | result |
|---|---|
| `node tests/probe_doll_blind_family.js` | 34 arms / 0 failing / 2 excluded (before: 13 `PARTS CLEAN`, 47 failing) |
| `node tests/test-mechanics.js` | **764 live, 0 missing, 764 probed**, 0 threw, 0 hollow, direct-call back to its floor of 1 |
| `game_differential.js … --write` | 961 games, 19 raw, board-material 12, `SAME-END-STATE` 955 / `DIFFERENT` 6 |
| the same, under `MEDI_DOLL_BLIND_FAMILY=1` | **961 games, 19 raw, board-material 12 — identical** |
| `node engine/arms_comparable.js` knob vs clean | exit 0, COMPARABLE |
| `node engine/arms_comparable.js` HEAD vs clean | exit 1, NOT COMPARABLE (#489 moved the pin digest) |
| `tests/roster.js --stage {items,abilities,moves} --write` | 139 / 129 / 475, 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE in all three |
| `engine/all_mechanics_fire.js --kind all --write` | 1289 games, 0 threw; moves STATE 5 / ANNOUNCEMENT-ONLY 7 / NO-DIVERGENCE 484, abilities 1/3/166, items 1/1/71 — summary identical to the pre-batch artifact |
| `node tests/test-engine-diff.js --n 300 --seed 20260804` | 0 of 300 at all sixteen corners; publish guard refused the shrink (exit 3) |
| `node --max-old-space-size=6144 tests/test-resolution-order.js` | **26 arms, 1 KNOWN-OPEN (`a1-multihit-frequency`), 0 failing** — ROADMAP #446's OOM avoided at the raised heap, as briefed |
| `node tests/probe_yawn_substitute.js` | 6 arms, 0 failing |
| `node tests/probe_substitute_status_step.js` | 12 arms, 0 failing |
| `node tests/test-end-state.js` | ALL GREEN |
| `node tests/test-volatile-duration.js` | all 4 scenarios identical to the official engine |
| `node tests/test-engine-consistency.js` | all checks passed |

## 8. THE BRIEF SAID NOTHING ELSE WAS RUNNING. SOMETHING WAS.

The brief opened *"You have the game slot — nothing else is running"* and gave `HEAD e3587c62`. A
second agent (ROADMAP #489) was live throughout and committed three times during this session —
`6ee4a666`, `d988aadc`, `8a5eb4cc` — and its own commit message names this session by its release id
and its run timestamps. It read `data/game-differential.json` while I was writing it and reports the
torn read itself.

**Nothing was lost and the collision was benign in this instance**, because the two runs agree exactly
(961 games, 19 raw, 12 board-material, pin digest `f646b0163bc0`) on two different releases — which is
an independent corroboration neither of us arranged. But the first forty minutes of this batch were
spent attributing a 8 → 19 jump that was another agent's landed, predicted, Will-ruled change, and the
only reason it was attributed correctly rather than published as a regression is that the knob arm was
run before anything was written down.

## 9. NOTICED, NOT TOUCHED

- `MEDSEEN.allyVeilRefusedVolatile` still increments while emitting nothing, where Sweet Veil's
  `onAllyTryAddVolatile` writes `|-activate|…|ability: Sweet Veil`. Filed by the Yawn batch, still open.
- The `[of] <source>` on `|-start|…|move: Yawn` is still on the hand list and still needs an instrument
  that does not collapse the source-tag equivalence.
- `transform`'s doll check is a bare `_tt._sub>0` rather than `subBlocks`, so an Infiltrator body would
  be refused where the authority lets it through. **Unreachable in this format** — Ditto is the only
  legal Transform user and its abilities are Limber and Imposter — so it is recorded, not changed.
- Not touched, per the brief: `midEventValue`, `midEventDice`, `tests/test-middle-identity.js`,
  Tailwind, the closet, every declared row including Supreme Overlord's `fallenundefined`,
  `magnetrise@18`, `perishsong@24`, `uproar@28`, `lockedmove`, `_refills`/`speedSort`, the multi-hit
  `nth`, `web/`, `app/`, `data/engine-data.js`, `engine/quality.js`, `data/quality-filter.json`,
  `engine/board.js`, `engine/magnemite.js`.

## OWED, NOT RUN

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` for all of them.

```bash
# 1. TRICK'S OWN MESSAGE DEFECT, which blocks the last kind. We write
#    `|-activate|p2a: <mover>|move: trick` (a line the authority does not have, and lower-cased)
#    and never `|-enditem|<target>|<item>|[silent]|[from] move: Trick`. Until that is settled the
#    doll cell for `trickitem` cannot be measured at all. Reproduce with:
node tests/probe_doll_blind_family.js --only trick@nodoll

# 2. AFTER (1): the doll check for `trickitem`, covering corrosivegas, switcheroo and trick.
#    The insertion point is BELOW `immunityGateRefuses` (Sticky Hold's onTryImmunity, which the
#    authority runs at hitStepTryImmunity) and ABOVE the swap/remove, which is the onHit.

# 3. Sweet Veil / Flower Veil announce nothing (`allyRefusesVolatile`). Not measured, not mine.

# 4. NOTHING IN THIS BATCH IS A STRENGTH CLAIM AND NONE IS OWED. No fit, no self-play, no 6,000-row
#    re-run: damage did not move and §6 says why it could not.
```
