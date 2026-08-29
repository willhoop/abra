# REDIRECTION — CARD C1, AND WHY C2 IS NOT THE SAME BUG (2026-08-29, ENGINE)

**Verdict.** Six legal entities carry the redirection shape and two more turn it off. The mechanism
was **GAPPED, not absent** — `redirectDrawnTo` has been correct since ROADMAP #362 and the caller
refused Parting Shot by ACTION KIND. **C2 does NOT share the cause** and is reproduced red here as a
separate defect. **The 30-game leaf attribution HELD in direction but its number was from a
superseded artifact**: on the baseline actually in force it was 19 games, and it fell to 10.

| | before | after |
|---|---|---|
| census live / probed / missing | 786 / 786 / 0 | **788 / 788 / 0** |
| empirical board-parted games (961) | **114** | **106** |
| `by_cause_totals.games_board_material` | 104 | **96** |
| `by_cause_totals.BOARD_MATERIAL` causes | 95 | **90** |
| protocol diverged | 231 | **225** |
| end-state SAME / DIFFERENT / ENDED-APART / THREW | 875 / 81 / 3 / 2 | **884 / 73 / 2 / 2** |
| `active[].boosts.atk` leaf family | 19 games | **10** |
| `party.boosts.atk` | 18 | **9** |
| `active[].boosts.spa` / `party.boosts.spa` | 11 / 11 | **4 / 4** |
| damage differential, 6000, seed 20260804 | 0/6000 at all 16 corners | **unmoved** |

Pins, both arms: `--games 1200` (yields 961), `--arm middle`, `--turns 12`, `--steering empirical`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`.
Release `b39a5c87fe2d` → **`4b67526d29d8`** (cut for this pass). `arms_comparable.js` reads
**COMPARABLE**. After-artifact: `data/verification/game-differential.redirect.json`.
`data/game-differential.json` was NOT written; `tests/test-engine-diff.js` was NOT run.

---

## 1. WHICH LEGAL ENTITIES CARRY THE SHAPE — DERIVED, NOT RECALLED

```
Dex.forFormat('gen9championsvgc2026regmb'), filtered exists && !isNonstandard && tier !== 'Illegal'
```

| entity | handler | note |
|---|---|---|
| **Follow Me** | `onFoeRedirectTarget`, priority 1 | draws only a FOE's click |
| **Rage Powder** | `onFoeRedirectTarget`, priority 1 | same, plus `source.runStatusImmunity('powder')` |
| **Lightning Rod** | `onAnyRedirectTarget`, priority 0 | **`Any` — draws an ALLY's click too.** 5 legal carriers: Pikachu, Raichu, Sceptile-Mega, Manectric, Rhyperior |
| **Counter** | `onRedirectTarget`, priority −1 | `target:'scripted'`; a different mechanism (aim at the last attacker), 16 uses |
| **Mirror Coat** | `onRedirectTarget`, priority −1 | same, 43 uses |
| **Stalwart** | writes `move.tracksTarget` | turns the whole event OFF. 2 legal carriers: Archaludon, Skarmory-Mega |

**Storm Drain and Propeller Tail have ZERO legal carriers in this regulation**, which is why
`tags.json` reads `redirectsType` n=1 and `ignoresRedirection` n=1 rather than 2 and 2. The tag
deriver is right; the counts looked like an under-match and are not. **Snipe Shot and Pursuit — the
two `tracksTarget` moves in mainline — are not legal here either**, so no legal MOVE carries
`tracksTarget` and `TAGS.has('move',id,'tracksTarget')` can never match today. That is a live
never-matching branch, reported below rather than removed.

## 2. WHAT THE AUTHORITY ACTUALLY CHECKS

`Pokemon#getMoveTargets` (`sim/pokemon.ts:791-838`), read whole. Champions overrides none of the
four files involved — checked with `ls data/mods/champions/` and a grep for each id.

```
switch (move.target) {
  case 'all' / 'foeSide' / 'allySide' / 'allyTeam':   ... break;    <- never redirected
  case 'allAdjacent' / 'allAdjacentFoes':             ... break;    <- never redirected
  case 'allies':                                      ... break;    <- never redirected
  default:
    if (this.battle.activePerHalf > 1 && !move.tracksTarget) {
      const isCharging = move.flags['charge'] && !this.volatiles['twoturnmove'] && ...
      if (!isCharging) target = this.battle.priorityEvent('RedirectTarget', this, this, move, target);
    }
}
```

Four conditions, and **category is not one of them**:

1. **doubles only** — always true here;
2. **not `tracksTarget`** — Stalwart / Propeller Tail, and `exceptScripted` in their own handler;
3. **not the CHARGING turn of a charge move** — the release turn redirects normally;
4. **the target type must fall through to `default:`** — so the five single-target names, and
   `self` / `adjacentAlly` / `adjacentAllyOrSelf` reach the event but can never win it, because each
   handler ends in `this.validTarget(holder, source, move.target)` and `validTargetLoc`
   (`sim/battle.ts:2395`) refuses a foe's body for an ally-shaped target type.

**`validTargetLoc` is where C2 lives.** For `normal`, `randomNormal` and `scripted` it tests
**adjacency only, not side** — so an ADJACENT ALLY is a valid `normal` target. Lightning Rod is
`onAnyRedirectTarget` and additionally rewrites `adjacentFoe` → `normal` before asking. Both together
mean: **your own ally's Lightning Rod pulls your Electric move onto itself.** Follow Me and Rage
Powder cannot do this — they are `onFoeRedirectTarget`.

## 3. C1 — GAPPED, AND THE CARD'S OWN HYPOTHESIS WAS WRONG

The card guessed *"our redirect check is gated on the move being damaging"*. It is not. ROADMAP #362
already routes single-target STATUS moves through `redirectDrawnTo`, and `tests/test-mechanics.js`
has carried a green Will-O-Wisp probe for it since.

The real gate was the ACTION KIND. `playerAction` returns `{kind:'switch', mv, target}` for a
`pivotStatus` move, and the non-attack draw site read:

```js
if(it.a && it.a.target && it.a.kind!=='attack' && it.a.kind!=='switch'){
```

`pivotStatus` membership over the whole legal move table, printed before anything was wired:
**chillyreception (`target:'all'`, 93 uses)** and **partingshot (`target:'normal'`, 13,924 uses)**.
So the name test excluded exactly one move and it was the most-clicked redirectable status move in
the format.

**MEASURED BEFORE THE EDIT**, same board, same two drops, only the move varied:

```
partingshot + Follow Me   [aimed at, aimed sa, drawer at, drawer sa] = [-1,-1, 0, 0]   <- wrong
nobleroar   + Follow Me                                              = [ 0, 0,-1,-1]   <- right
```

**This is the second time `kind==='switch'` has been asked in place of "is this a move" in this
file.** The BeforeMove gate ~90 lines below carries the identical finding (a frozen body used
Parting Shot) and the identical fix: ask `actionMoveId`. The clause was removed, not replaced — a
bare switch carries no `mv`, so `actionMoveId` answers null and the existing `if(_rid && …)` skips
it exactly as the removed clause did.

## 4. THE PROBES

**`tests/probe_pivot_redirect.js`** — the knob, shown RED first.

```
MEDI_PIVOT_SKIPS_REDIRECT=1 node tests/probe_pivot_redirect.js     3 FAILED
                            node tests/probe_pivot_redirect.js     all checks passed
```

Under the knob: the draw arm reads `[-1,-1,0,0]`, `MEDFAILS.pivotSkipsRedirectRestored = 3` (the
defect's own count of clicks it ate), `MEDSEEN.redirectedPivotStatus = 0`. Unarmed:
`redirectedPivotStatus = 3`, `pivotSkipsRedirectRestored = 0`.

**The knob is specific, and that is asserted rather than assumed.** Noble Roar reads `[0,0,-1,-1]`
on BOTH arms and Chilly Reception's weather lands on both — if either moved, the fixture would be
measuring its own staging.

**The negative arms, all four measured:**

| arm | knob | result |
|---|---|---|
| Stalwart attacker (Archaludon) vs its own Stamina | ability | `[-1,-1,0,0]` vs `[0,0,-1,-1]` — not drawn |
| Grass-type user (Meganium) vs Incineroar, into Rage Powder | user type | `[-1,-1,0,0]` vs `[0,0,-1,-1]` — not drawn |
| Follow Me into the same Grass user | move | drawn — Follow Me is not a powder |
| Chilly Reception (`target:'all'`) | Follow Me up / down | snow both ways — untouched |

**Two census rows added** in `tests/test-mechanics.js` under tag `redirects`:
*"Parting Shot is drawn by Follow Me — a pivot is a move"* and *"a drawn Parting Shot still obeys
Stalwart and the powder immunity"*. Census **786 → 788**, 0 missing, 0 threw, 0 hollow, 0 unarmed,
directCall floor unmoved at 1.

## 5. WHICH SCOREBOARD, SAID BEFORE THE RUN

Stated before the differential was launched: *the lab must move (+2 rows), and the pool must move
too — Parting Shot is 13,924 corpus uses and the two redirectors 14,182, so this is not a tail
mechanic. Expect a fall of at most 7 from 114, because clearing a first divergence can unmask a
later one in the same game. Damage differential and the roster: unmoved, no damage path touched.*

**Both moved. Board-parted 114 → 106, a fall of 8.** The eight is larger than the card's seven
because the card counted only games whose FIRST divergence carried this cause.

**The seven causes the card named are gone, one for one.** The class `-unboost: a different body`
went from **5 occurrences to zero**, and so did `|-unboost|p2b|atk|1 <> |-activate|p2a|protect` and
`|-unboost|p2b|atk|1 <> |-immune|p2a` — which is exactly the card's *"three more are the same
mechanic landing on a Protect or an immunity instead."*

## 6. THE 30-GAME LEAF ATTRIBUTION — HELD, BUT ITS NUMBER WAS STALE

The card claimed *"`active[].boosts.atk` at 30 games and `party.boosts.atk` at 28."* **That was
measured on release `e129bca605e3`, board-material 135.** On the baseline actually in force
(`b39a5c87fe2d`, 114) the same families read **19 and 18**. Quoting 30 as current would have been
the fourteen-stale-handoffs failure in a new costume.

**The attribution itself held.** Both families fell by 9 (19→10, 18→9) — Parting Shot drops Attack,
so the direction and the size are what the diagnosis predicts.

**And it reaches a family the card attributed elsewhere.** `boosts.spa` fell **11 → 4** on both
`active[]` and `party` — Parting Shot drops Special Attack too. The card's **H3** filed the `spa`
leaves as *"consistent with either story"* against five Moonblast damage cards; at least seven of
them were this. **H3 is narrowed, not closed** — 4 games remain.

## 7. C2 IS A DIFFERENT CAUSE, AND IT IS REPRODUCED RED

The card reads C2 as *"Lightning Rod does not redirect"*. **It does.** Staged foe-side, aimed at a
non-immune body, with the ability as the only knob:

```
thunderbolt   no rod [aimed lost 160, rod lost 0, rod SpA 0]    rod [0, 0, +1]
voltswitch    no rod [132, 0, 0]                                rod [0, 0, +1]
electroshot   no rod [160, 0, 0]                                rod [0, 0, +1]   (both turns played)
```

**Both C2 cards in the dump are ALLY-side draws**, and that is the defect:

```
card 2   |move|p2b: Rotom|voltswitch     SHOWDOWN |-activate|p2a: Sceptile|ability: Lightning Rod
card 0   |move|p1b: Archaludon|electroshot  SHOWDOWN |-activate|p1a: Raichu|ability: Lightning Rod
```

In both, the rod holder is the ATTACKER'S OWN PARTNER. `redirectDrawnTo` is only ever handed the
FOE array (`_rfoes2` at the status site, `foes` at the attack site), so `onAnyRedirectTarget` can
never fire for an ally. **Reproduced in the lab, identical arms across the ability knob — the
unwired-knob signature:**

```
own-side ally Manectric, attacker Rotom-Heat, aimed at a foe
  thunderbolt   ally=static [ally lost 0, foe lost 160, ally SpA 0]   ally=lightningrod [0, 160, 0]
  voltswitch    ally=static [0, 160, 0]                               ally=lightningrod [0, 160, 0]
```

The authority would redirect, absorb, boost and announce. **FILED, NOT FIXED** — batch of one, and
it is a different edit in a different function with a different negative arm (the ally axis must NOT
be offered to Follow Me or Rage Powder, which are `onFoeRedirectTarget`).

## 8. C3 AND C6 — CHECKED, BECAUSE THE BRIEF ASKED WHETHER THEY SHARE A CAUSE. THEY DO NOT.

- **C6 Armor Tail is LIVE.** Fake Out into a Farigiraf's partner: 35 HP with Sap Sipper on the
  Farigiraf, **0 HP** with Armor Tail. The tag is read. Its one game has some other cause.
- **C3 Wide Guard is HALF LIVE, and the missing half is the card's exact shape.** Against a FOE's
  spread move it protects both bodies (`[40,160]` → `[0,0]`). Against the USER'S OWN ally's spread
  move it does nothing — `[40,160]` with Wide Guard up and `[40,160]` without, identical arms. That
  is the card's Rotom-Discharge-into-its-own-Bastiodon. **FILED, NOT FIXED.**

## 9. FILED, NOT FIXED — A LIVE BRANCH THAT CAN NEVER MATCH

`tracksTargetOf` opens with `if(mvId && TAGS.has('move',mvId,'tracksTarget')) return true;`. **No
legal move in this regulation carries `tracksTarget`** (Snipe Shot and Pursuit are the only mainline
carriers and neither is legal), so that line has never matched and cannot. It is harmless and it is
the shape this project keeps paying for — a silent branch nobody can tell from a working one. It is
reported rather than removed: a member could arrive with a format change, and deleting a correct
tag-first read to leave only the name bridge would be the wrong direction.

---

## OWED, NOT RUN

- **The three roster stages and `all_mechanics_fire.js` are stale against release `4b67526d29d8`.**
  They were already stale before this pass (they ran on `e129bca605e3` while the tree was
  `b39a5c87fe2d`), so this is carried forward, not created here. Five of the eight gate clauses read
  `MEASURED AGAINST A DIFFERENT ENGINE` for that reason and none of them reads a divergence.
  Expected on a re-run: **items 140 / abilities 129 / moves 475 with zero in both failure columns**,
  and `all-mechanics-fire` **moves 4, abilities 1, items 0** — nothing this pass touched is staged
  by either instrument except through the two new census rows.

  ```
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage items      --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage abilities  --write
  SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage moves      --write
  SHOWDOWN_PATH=... tools\lownode.cmd engine\all_mechanics_fire.js --write
  ```

- **`data/game-differential.json` — the COVERAGE arm — was not re-run.** The coverage driver parted
  6 times in 961 games and 0 of those were board-material, so this fix cannot move it; expected
  **961 games / 6 raw / 6 declared / 0 that count**.

  ```
  SHOWDOWN_PATH=... tools\lownode.cmd engine\game_differential.js --end-state --arm middle \
    --games 1200 --turns 12 --release 4b67526d29d8 --team-store data/team-pool-frozen \
    --census data/verification/census-pin-9446a684709d.json --write
  ```

- **`tests/test-engine-diff.js` was NOT run**, deliberately: it has no `--out` and would republish
  `data/engine-diff.json`. The status gate read that artifact at 30 minutes old and **0/6000 at all
  sixteen corners**; nothing in this pass touches a damage path, so a re-run is expected to reproduce
  it exactly.

- **C2's ally-axis Lightning Rod** and **C3's own-side Wide Guard**, both reproduced red above and
  both owed as their own batches. C2 needs the attacker's own side offered to the `redirectsType`
  family ONLY, with a negative arm proving Follow Me and Rage Powder are still foe-only.

- **The turn cap is 12** and 47–48% of these games reach an ending, so a divergence that would first
  appear after turn 12 reads as narration here. Unchanged from every previous arm; stated so the
  106 is read as what it is.
