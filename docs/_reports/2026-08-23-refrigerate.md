# Refrigerate, Pixilate, Aerilate — the five `aurorus hypervoice` rows are the HARNESS, not the engine

Dated findings record. Not maintained; superseded by whatever register row it feeds.
LIGHT MODE: staged boards only. Nothing in `engine/` or `tests/` was edited.

## Verdict

1. **MEDICHAM applies BOTH halves of Refrigerate** — the Normal→Ice retype and the 1.2x — and it
   gets the same number the official simulator gets, at BOTH corners of the damage roll, on all five
   reported defenders.
2. **The wrong component is the HARNESS's entry point.** `tests/test-engine-diff.js`'s
   `showdownDamage` calls `battle.actions.moveHit` directly. Every `-ate` ability fires from
   `onModifyType`, which the authority runs in `useMoveInner` at `sim/battle-actions.ts:438` —
   **932 lines above** `moveHit` (`sim/battle-actions.ts:1370`). The reference therefore prices a
   plain Normal move with no boost. It is an instrument defect, and it belongs to
   `tests/test-engine-diff.js` (which writes `data/engine-diff.json`), **not** to
   `engine/medicham2-browser.js`.
3. **Pixilate is affected identically and is currently INVISIBLE, not passing.** It never enters a
   comparison at all — see §4. Its 5,423 uses are unmeasured by this instrument, not measured-and-clean.
4. **Spread is NOT involved.** Ruled out by measurement, not by assumption — see §5.

## 1. The three entry points on one staged board

Aurorus body and defender bodies from `MEDI.buildMon`, aligned onto the Showdown side exactly as
`showdownDamage` does. Roll pinned. `AUTHORITY(1 foe)` is a REAL turn played with `makeChoices`,
with the partner slot fainted so the move has a single target and `move.spreadHit` stays false —
so all three columns answer the same question.

| row | AUTHORITY, real turn, 1 foe | AUTHORITY via `moveHit` (the harness's reference) | MEDICHAM `dmgRange` |
|---|---|---|---|
| aurorus hypervoice -> aggron | 64 – 76 `[Ice / typeChangerBoosted]` | 18 – 21 `[Normal]` | **64 – 76** |
| aurorus hypervoice -> gallade | 76 – 91 `[Ice / boosted]` | 43 – 51 `[Normal]` | **76 – 91** |
| aurorus hypervoice -> tauros | 115 – 136 `[Ice / boosted]` | 64 – 76 `[Normal]` | **115 – 136** |
| aurorus hypervoice -> swampert | 94 – 112 `[Ice / boosted]` | 52 – 62 `[Normal]` | **94 – 112** |
| aurorus hypervoice -> roserade | 137 (capped at HP) | 46 – 55 `[Normal]` | **168 – 198 → 137 capped** |
| CONTROL tauros bodyslam -> gallade | 112 | 112 | 112 |
| CONTROL aurorus ancientpower -> gallade (non-Normal, SAME body) | 26 | 26 | 26 |

The `moveHit` column is **bit-identical to MEDICHAM with the ability blanked to `none`** on every
row — which is the cleanest statement of what the reference is computing: the damage of an Aurorus
that does not have Refrigerate.

The two controls are the reason this is not a general damage bug: the harness and the engine agree
exactly on a Normal move from a body with no `-ate` ability, and on a non-Normal move from the SAME
Aurorus body.

## 2. Does MEDICHAM apply both halves, or only one?

Same body, ability live vs blanked, `dmgRange` only:

| row | ability | live | blanked | ratio |
|---|---|---|---|---|
| aurorus hypervoice -> gallade | refrigerate | 76–91 | 43–51 | 1.784 |
| aurorus hypervoice -> aggron | refrigerate | 64–76 | 18–21 | 3.619 |
| aurorus hypervoice -> roserade | refrigerate | 168–198 | 46–55 | 3.600 |
| gardevoirmega hypervoice -> gallade | pixilate | 216–254 | 60–71 | 3.578 |
| altariamega bodyslam -> garchomp | pixilate | 180–212 | 50–59 | 3.593 |
| pinsirmega bodyslam -> gallade | aerilate | 306–362 | 85–101 | 3.584 |
| CONTROL tauros bodyslam -> gallade | intimidate | 94–112 | 94–112 | 1.000 |
| CONTROL aurorus ancientpower -> gallade | refrigerate | 21–26 | 21–26 | 1.000 |

1.78 on a neutral defender decomposes as 1.2 (the ability) x 1.5 (STAB, because the new type is the
user's own) — both halves, not one. Where the type chart moves as well (Aggron: Normal 0.25x on
Steel/Rock vs Ice 0.5x; Roserade: Normal 1x vs Ice 2x) the ratio is 2x that, ~3.6. A retype with no
boost would read 1.5 and a boost with no retype would read 1.2; neither is what the engine does.

## 3. Which of the three is wrong, and how that was decided

- **The engine is right.** Its band `[64, 76]` equals the authority's `[roll 15 = 64, roll 0 = 76]`
  exactly, at both corners, on every row. Nothing was fitted to make that true.
- **The authority is right** — obviously, and the point is that the authority's *real turn* and the
  authority's *`moveHit` call* disagree with each other by exactly the ability. Same simulator, same
  board, same seed, two entry points.
- **The harness's entry point is the wrong one for this class of ability.** `onModifyType` is run by
  `runEvent('ModifyType', …)` at `sim/battle-actions.ts:438`, inside `useMoveInner` (line 377).
  `moveHit` is line 1370. Refrigerate's own handler (`data/abilities.ts:3802-3817`) sets
  `move.type = 'Ice'` AND `move.typeChangerBoosted = this.effect`, and its `onBasePower` returns
  `chainModify([4915, 4096])` **only if** `move.typeChangerBoosted === this.effect` — so skipping
  `onModifyType` loses BOTH halves, which is why the reference is low by the full 1.2 x STAB x
  type-chart factor rather than by 1.2. Confirmed on the object: after the harness's call,
  `move.type === 'Normal'` and `move.typeChangerBoosted === undefined`.
- **Champions does not override any of it.** `grep refrigerate|pixilate|aerilate|galvanize
  data/mods/champions/*.ts` returns nothing.

This is the same shape as CONTROL FIX 5 and CONTROL FIX 10 already recorded in that file: an
ability handler that `moveHit` does not reach, so the *reference* is wrong and the engine's correct
answer is filed as the engine's bug. It is the third member of that family.

## 4. Why all five rows are `aurorus hypervoice` — and why Pixilate never shows up

The differential's species pool is `Object.keys(move-priors.json .species)` filtered by
`MEDI.buildMon` returning something. Derived, printed:

```
move-priors species 345, DRAWABLE by tests/test-engine-diff.js: 207   (138 dropped)

SPECIES IN THE POOL WHOSE SLOT-0 ABILITY CONVERTS A MOVE TYPE
   gardevoirmega   pixilate     dropped   Normal damaging moves in its priors: hypervoice
   glaliemega      refrigerate  dropped   explosion, bodyslam, hyperbeam
   altariamega     pixilate     dropped   hypervoice, bodyslam, doubleedge
   feraligatrmega  dragonize    dropped   doubleedge, bodyslam, facade
   pinsirmega      aerilate     dropped   bodyslam, feint, quickattack
   aurorus         refrigerate  DRAWABLE  hypervoice
 => rows the differential can draw with an -ate ability live: aurorus hypervoice
```

So the five rows are five DEFENDERS of the one drawable row. Two independent reasons hide the rest:

**(a) All 76 mega keys are silently dropped from the pool.** `move-priors.json` keys a mega the way
Showdown does — `gardevoirmega` — and `MEDI.buildMon` wants the hyphen:

```
gardevoirmega  in pool=true  buildMon(gardevoirmega)=false  buildMon(gardevoir-mega)=true  slot0=Pixilate
altariamega    in pool=true  buildMon(altariamega)=false    buildMon(altaria-mega)=true    slot0=Pixilate
pinsirmega     in pool=true  buildMon(pinsirmega)=false     buildMon(pinsir-mega)=true     slot0=Aerilate
glaliemega     in pool=true  buildMon(glaliemega)=false     buildMon(glalie-mega)=true     slot0=Refrigerate
```

`buildMon` returns null rather than throwing, so `logDroppedRow` never records it: 76 of the 138
drops are megas and none of them appears in the run's dropped-row report. This is the same key
mismatch CLAUDE.md records for `merge_mega_into_engine.js` (`venusaurmega` vs `venusaur-mega`),
in a second place. **It is a separate defect from the entry point and it is larger in scope** — the
damage differential has never compared a mega at all.

**(b) The harness pins BOTH engines to `abilities['0']`**, deliberately and for a good reason
(CONTROL FIX 4). But the two highest-usage carriers in this format hold theirs on slot H:

```
sylveon    slotH=pixilate     DRAWABLE   hypervoice(p=0.509), hyperbeam(p=0.112), quickattack(p=0.097)
primarina  slotH=liquidvoice  DRAWABLE   hypervoice(p=0.359)
```

Sylveon is drawable, Hyper Voice is its most-used move by a distance, and every Sylveon row is
built with **Cute Charm**. So the differential's clean Sylveon rows say nothing about Pixilate.

**Pixilate on Sylveon's real ability, measured directly:**

| row | AUTHORITY real turn, 1 foe | harness `moveHit` | MEDICHAM |
|---|---|---|---|
| sylveon(Pixilate) hypervoice -> aggron | 75 – 89 `[Fairy/boosted]` | 21 – 25 `[Normal]` | **75 – 89** |
| sylveon(Pixilate) hypervoice -> swampert | 130 (roll 0) `[Fairy/boosted]` | 73 `[Normal]` | **109 – 130** |
| sylveon(Cute Charm) hypervoice -> gallade — CONTROL | 45 spread / 60 single `[Normal]` | 60 `[Normal]` | 60 |

MEDICHAM is exactly right on Pixilate too. The instrument would report it as a disagreement the
moment either (a) or (b) is fixed — so **fixing the pool or the ability slot WITHOUT fixing the
entry point would turn 5 red rows into many more, all of them false.** The three land together or
not at all.

## 5. Spread — ruled OUT by measurement

Hyper Voice is `allAdjacentFoes`, so this had to be checked rather than assumed.

- The harness's `moveHit` call passes ONE target and `move.spreadHit` is false — no 0.75.
- The harness calls `MEDI.dmgRange(..., spread = false, ...)` — no 0.75 on the engine side either.
- Both sides therefore ask the single-target question, and they are consistent on that axis.
- Proof: with the partner slot fainted so the authority's own turn is single-target, the authority
  returns **exactly** MEDICHAM's no-spread band (76/64 vs 64–76 on Aggron; 136/115 vs 115–136 on
  Tauros). In full doubles the authority returns 57 and 69, and MEDICHAM's `spread = true` call
  returns 57 and 69 — also exact.
- The control seals it: `sylveon(Cute Charm) hypervoice` — a spread move with NO type conversion —
  has the harness at 60 and MEDICHAM's no-spread call at 60, agreeing. If spread were the mechanism
  this row would disagree too.

Spread is fine in both engines. The whole of the disagreement is the `-ate` conversion.

## 6. Probe hygiene — two false readings caught before they were reported

Recorded because both would have been reported as engine facts:

- `battle.randomChance = () => false` (to pin the crit off) makes **every move miss** — Showdown
  asks the accuracy question through `randomChance(accuracy, 100)`. The first real-turn run read
  `real = 0` on all nine rows, which reads exactly like an immunity. Correct pin:
  `(num, den) => den === 100`.
- The defender's derived filler move was **Protect** (`CS.firstLegalMove('Gallade')` is Protect), and
  then **Rest**, which healed the damage back before end-of-turn HP was read — Aggron reported
  `real = 0` while the protocol showed 145 → 88. Damage is now read from the `|-damage|` line, and
  the filler is derived to exclude stalling and healing moves.

## What this does NOT say

- Nothing about the census. `convertsMoveType` is already LIVE in `data/mechanics-census.json`
  ("Aerilate makes Body Slam hit a Ghost"), and `convertsMoveTypeByFlag` too. That verdict is
  corroborated here, not changed. No census row was added or removed by this work.
- Nothing about `dragonize` on Feraligatr-Mega beyond it carrying the same tag shape and being in
  the dropped-mega set.
- Nothing about multi-hit, or about any other row of the differential.

## Owed

Three items, all instrument-side, none in `engine/medicham2-browser.js`:

1. `tests/test-engine-diff.js` — the reference must run `ModifyType` before `moveHit`, the way
   CONTROL FIX 5 asks the ability's own `onTryHit` directly. The minimal form is
   `battle.singleEvent('ModifyType', …)` + `battle.runEvent('ModifyType', …)` on the active move
   before the `moveHit` call, which is what `useMoveInner:437-438` does.
2. `tests/test-engine-diff.js` — the pool's silent mega drop. 76 keys, a `buildMon` null that
   `logDroppedRow` never sees. 26% of this format's usage has never entered the damage differential.
3. `tests/test-engine-diff.js` — a carrier whose ability is not slot 0 (Sylveon/Pixilate,
   Primarina/Liquid Voice) is compared on an ability nobody runs. Not obviously a bug in the pin
   (holding the input equal is right), but it means the instrument's coverage claim should say
   "slot-0 abilities only" out loud.

Landing 1 without 2 and 3 leaves the coverage hole. Landing 2 or 3 without 1 turns a handful of
false reds into a lot of them.
