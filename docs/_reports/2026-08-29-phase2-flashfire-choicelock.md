# Phase 2 — Flash Fire's absorbed gift, then `choicelock`

ENGINE, 2026-08-29. Batch of one, then a comparator widening, measured between them. Engine release
cut at the end of Part A and used for both measurements: **`e129bca605e3`**.

Re-derive rather than quoting this page:

```
node engine/status.js
node engine/quarantine.js
node tests/probe_uncompared_leaves.js
node tests/test-mechanics.js
```

---

## 0. THE HEADLINE

| | before | after |
|---|---|---|
| census | 782 probed / 782 live / 0 missing | **784 / 784 / 0** |
| board leaves compared | 33 of 80 (43 read by nothing) | **34 of 80 (42 read by nothing)** |
| gate | 8 of 8 PASS, OPEN | **8 of 8 PASS, OPEN** (4 of 8 in between, all four withheld on a release mismatch, all four re-run) |
| whole-game differential | 961 games, 6 raw / 6 declared / 0 that count | **unmoved** |
| turn boundaries compared / identical | 12,445 / 12,445 | **12,445 / 12,445, with the new leaf in the set** |
| damage differential | 0 of 6000 at sixteen corners | **unmoved** |
| roster items / abilities / moves | 140 / 129 / 475, 0 in both failure columns | **unmoved** |

Everything above was PREDICTED before its run. Nothing missed.

---

## 1. PART A — THE GIFT WAS COUNTED AND BINNED

### 1.1 What was wrong

`engine/medicham2-browser.js` `absorbGift` (~:14823 before the change):

```js
/* FLASH FIRE'S GIFT IS A VOLATILE AND THIS ENGINE DOES NOT GRANT IT -- unchanged and COUNTED */
if(!_h&&!_ab.gain.boosts&&_ab.gain.volatile){
  MEDFAILS.absorbGiftUnmodelled++;
  ...
}
```

Two consequences, and they are the same line's two halves in the authority:

1. **The 1.5x never happened.** Board-material through DAMAGE, not narration.
2. **`-immune` was announced on the FIRST absorb.** The authority's `-immune` sits inside
   `if (!target.addVolatile("flashfire"))` — it is the gift's ELSE. With the gift binned there was
   nothing for the else to test, so this engine wrote it every time. ROADMAP #432 says exactly that
   and counted it.

### 1.2 The authority, derived from the format and not recalled

`Dex.forFormat('gen9championsvgc2026regmb').abilities.get('flashfire')`. Champions overrides
`flashfire` in NONE of its eight files (`grep -n flashfire data/mods/champions/*.ts` returns nothing),
so mainline's handler is the format's, read whole:

```js
onTryHit(target, source, move) {
  if (target !== source && move.type === "Fire") {
    move.accuracy = true;
    if (!target.addVolatile("flashfire")) this.add('-immune', target, '[from] ability: Flash Fire');
    return null;
  } }
onEnd(pokemon) { pokemon.removeVolatile("flashfire"); }
condition: { noCopy: true,
  onStart(target) { this.add('-start', target, 'ability: Flash Fire'); },
  onModifyAtk / onModifySpA:
    if (move.type === "Fire" && attacker.hasAbility("flashfire")) return this.chainModify(1.5); }
```

### 1.3 The derivation, and the over-match check that came before it

`engine/tag_dex.js` now derives, inside the existing `typeImmunity` predicate:

```
gain.volatileBoost = { stats, moveType, mult, announce, endsWithAbility }
```

- `stats` from which of `condition.onModifyAtk` / `onModifySpA` exist,
- `moveType` and `mult` from the handler text, with `one()` demanding **one distinct type and one
  distinct multiplier across as many handlers as there are stats** — anything less derives NOTHING,
  because a half-read multiplier is a wrong number wearing a derivation,
- `announce` from `condition.onStart`'s own `this.add('-start', target, '<literal>')`, so a two-word
  ability is spelled the authority's way instead of being composed from an id,
- `endsWithAbility` from whether `onEnd` calls `removeVolatile`.

**THE MATCHED SET WAS PRINTED BEFORE ANYTHING WAS WIRED**, over 316 legal abilities:

```
DERIVED  flashfire  vol=flashfire  atk+spa x1.5 on Fire moves;
         announce "ability: Flash Fire"; endsWithAbility true
```

One member, no others. `tag_dex.js` prints that set — and a `REFUSED` line for any ability whose
condition exists and cannot be read whole — on **every** run, so a second member arrives named rather
than silently inheriting Flash Fire's rule.

### 1.4 The engine change

- **`absorbGift`** grants `_vol[gain.volatile]` and returns `_gift = true` only when it was NOT
  already there, which mirrors `addVolatile` returning false on a repeat. It announces
  `gain.volatileBoost.announce`. A volatile whose payoff `tag_dex` could not read whole is **still
  granted** (the authority grants it either way) and the unmodelled EFFECT is what is counted, so
  `MEDFAILS.absorbGiftUnmodelled` keeps its name and changes its meaning: it now means "the gift
  landed and this engine cannot price it". Zero today.
- **`dmgRangeOneHit`** spends the multiplier in the `_aCh` STAT relay beside Guts and Huge Power —
  the stage the authority spends it at. Four things are read and none is named: the ATTACKER's own
  ability carries the tag (`attAb`, which is the authority's `attacker.hasAbility(...)`), the VOLATILE
  must be standing, the boosted TYPE is compared against `mvT` (the EFFECTIVE type), and the STAT must
  be the one this move actually uses.
- **`abRewrite`** removes the volatile when the ability that granted it is replaced, gated on the
  tag's own `endsWithAbility`. The switch-out road already empties `_vol` wholesale, and
  `capturePassedState` carries an explicit list that does not include `_vol`, so `noCopy: true` is
  satisfied by construction.
- **Knob** `MEDI_ABSORB_GIFT_VOLATILE_BLIND=1` restores the bin. Both halves at once, which is why the
  two census rows fail together under it and neither fails alone.
- **Counters** `MEDSEEN.absorbGiftVolatile / absorbGiftVolatileRepeat / absorbGiftVolatilePaid /
  absorbGiftVolatileEnded`.

### 1.5 The authority, PLAYED

One real `gen9championsvgc2026regmb` `Battle`, medicham2's own built stats written onto its Pokemon so
the two answers are about the MECHANIC and not about two stat systems, damage roll pinned, ONE knob —
the TYPE of the move that hit the Flash Fire Armarouge on turn 1:

| roll | t1 Body Slam (Normal) | t1 Fire Punch (absorbed) | ratio |
|---|---|---|---|
| 0 | 100 | 148 | 1.4800 |
| 8 | **91** | **136** | **1.4945** |
| 15 | 84 | 126 | 1.5000 |

The ratio is not exactly 1.5 because the multiplier is a STAT stage and passes through the damage
formula's truncations — which is also why it belongs in `_aCh` and not in the final chain.

Two Fire Punches into the same body:

```
|move|p2a: Snorlax|Fire Punch|p1a: Armarouge
|-start|p1a: Armarouge|ability: Flash Fire
|move|p2a: Snorlax|Fire Punch|p1a: Armarouge
|-immune|p1a: Armarouge|[from] ability: Flash Fire
```

### 1.6 The two census rows, shown RED first

`tests/test-mechanics.js`, both under `ability/typeImmunity`.

**RED** (`MEDI_ABSORB_GIFT_VOLATILE_BLIND=1`), quoted from the run's own detail:

```
MISSING  Flash Fire's absorbed gift is a volatile, and it multiplies the holder's own Fire moves
  CONTROL ["|-damage|p2a:snorlax|142/235"] ... deals 93.
  TEST    ["|-immune|p1a:armarouge|[from]ability:flashfire","|-damage|p2a:snorlax|142/235"] ... deals 93.
MISSING  a Flash Fire body announces `-start` on the first Fire hit and `-immune` only on the second
  FLASH FIRE ["|-immune|...","|-immune|..."];  CONTROL (WEAK ARMOR) ["-damage","-damage"]
```

Identical damage on both arms of a varied knob is the unwired signature this file exists to catch, and
it is exactly what the pre-fix engine produced.

**GREEN** (clean):

```
LIVE  CONTROL ["|-damage|p2a:snorlax|142/235"] deals 93
      TEST    ["|-start|p1a:armarouge|ability:flashfire","|-damage|p2a:snorlax|97/235"] deals 138
LIVE  FLASH FIRE ["-start","-immune"];  CONTROL (WEAK ARMOR) ["-damage","-damage"]
```

`93 -> 138` is the same **+45** the authority read at its own mid-roll (`91 -> 136`).

**Both controls are the authority's own other branch or the body's other legal ability.** The damage
control varies the incoming move's TYPE and holds the ability fixed, so "Armarouge hits hard" cannot
pass it and neither can an engine that boosted every Fire move a Flash Fire body clicks. The
announcement control is the same Armarouge carrying WEAK ARMOR —
`species.get('armarouge').abilities` is `{0: Flash Fire, 1: Weak Armor}` — which must announce neither
line and take the damage.

Census **782 -> 784 live / 784 probed / 0 missing**, `run_ok: true`.

### 1.7 The pool, and why it said nothing

**Predicted before the run:** the LAB moves, the POOL does not.

Measured over `data/team-pool-frozen` (the same corpus the differential draws from):

```
pool games                         17381
games with a DECLARED Flash Fire    1177   6.77%
...and the FOE declares a Fire mv    902   5.19%
deduped teams (the corpus)          8778
...carrying a Flash Fire body        365   4.16%
```

The differential played 961 games from 1,968 picked teams and **the absorb never happened once**. That
is a deduction from the instrument, not an assumption: `flashfire` appears **0 times** in the artifact,
and had an absorb occurred, the PRE-FIX engine's `-immune` would have parted from the authority's
`-start` right there. The baseline's six divergences are five Supreme Overlord `fallenundefined` rows
and one faint order, none of them an absorb.

**So the pool's silence is a fact about the SAMPLE, not about the fix.** 1,177 games is SHEET
PRESENCE across the whole pool; the mechanic additionally needs the body BROUGHT (4 of 6) and hit by a
Fire move inside twelve turns.

---

## 2. PART B — THE COMPARATOR IS ONE LEAF WIDER

### 2.1 What was added

`engine/board_state.js`, both readers:

```js
// medicham2 — `_lock` carries TWO locks and `_lockT` tells them apart
choicelock: (m._lockT === Infinity && m._lock) ? id(m._lock) : '',
// the authority — `choicelock` stores `this.effectState.move = move.id` in onStart
choicelock: v.choicelock ? id((v.choicelock.move) || '') : '',
```

Three decisions, each stated in the file:

- **It is the MOVE, not a presence bit.** Which move the body is bound to is the whole mechanic; a
  flag would report agreement between two engines locked into different moves.
- **`_lockT === Infinity` is the discriminator.** A finite `_lockT` is Encore, which has its own
  `vol.encore` leaf; reading the bare `_lock` would double-count every Encore as a Choice lock.
- **The raw field on both sides.** `lockStillBinds` is the engine's own reader and it MUTATES (it
  destroys a lock whose item has gone), so calling it from a comparator would make measuring change
  the board. The authority's SUSPENSION case (Magic Room / Klutz, where the volatile stands while the
  item is ignored) is held the same way on both sides, so the raw pair is right there too.

`SD_VOLATILE_KEYS` is derived by reading `sdBody`'s own source, so the leaf registered itself:
23 keys, `choicelock` among them. `tests/probe_uncompared_leaves.js`: **COMPARED 33 -> 34,
NEITHER 43 -> 42.**

### 2.2 The receipt that the leaf is not two empty fields

Identical output across a varied knob is the unwired signature, so this was checked before the run was
believed. One staged board, both engines, the ITEM as the only knob, read through `board_state.js`'s
own two readers:

```
item "(none)"         showdown (absent)     leaf ""            medicham (absent)     leaf ""
item "Choice Scarf"   showdown dragonclaw   leaf "dragonclaw"  medicham dragonclaw   leaf "dragonclaw"
```

And in the 961-game run itself: Choice Scarf bodies stood on the field (`item=choicescarf` appears in
the run's own speed-agreement table) and `item:choiceLock` is **not** in `coverage.not_exercised`.

### 2.3 What the widening found

**Nothing.** Byte-identical to the Part A run in every state key: 961 games, 6 diverged, the same
first-divergence list, 12,445 turn boundaries compared and 12,445 identical, coverage 563/580.

That is a real result rather than a null one: the largest comparable leaf in the hole was wired and the
two engines agree on it everywhere the sample reached. **The gate did not reopen.**

---

## 3. THE MEASUREMENT DISCIPLINE

Both runs pinned three ways and the baseline reproduced first:

```
--release <id> --census data/verification/census-pin-9446a684709d.json
--team-store data/team-pool-frozen --arm middle --games 1200 --turns 12 --state --end-state
```

**The baseline on `4e5c7b3400de` reproduced the published artifact EXACTLY** — 961 games, 6 diverged,
pool digest `0d103fb9fa87`, 1,968 teams picked, mode digest `ccb365985023`.

**IT DID NOT ON THE FIRST TWO TRIES, AND THE CAUSE WAS MINE, NOT THE INSTRUMENT'S.** `--games 1000`
gave 805 games and 34 divergences; `--games 1200` gives 961 and 6. `--games` is a PAIR BUDGET divided
across the configs (`perConfig = floor(GAMES / live.length)`), so a different budget is a different
SAMPLE and not a longer run of the same one. The 34-divergence reading was a correct measurement of a
different question and was discarded, not reported. Two other things were ruled out along the way and
are worth recording so the next person does not re-derive them: `--arm` does not explain it (the
middle arm read 805/34 both with and without `--arm middle`), and neither does the pool cache
(`data/diff-team-pool.json` MISSED because it had been written for a different store key, but the
rebuild from the frozen files gives the same 8,778-team corpus).

**The census pin is the standing one and my census change did not perturb it.** The differential is
steered by `data/verification/census-pin-9446a684709d.json` (643 rows, 2026-08-23), not by the live
census, so 782 -> 784 cannot have changed which games were played.

**The gate read 4 of 8 in between and none of the four was a divergence.** The three roster stages and
`data/all-mechanics-fire.json` were WITHHELD on `MEASURED AGAINST A DIFFERENT ENGINE` — the correct
behaviour when an engine byte moves. All four were re-run on `e129bca605e3` and every count is
identical to the artifact it replaced.

**`data/tags.json` regenerates against a MOVING store, and that was measured before it was accepted.**
Publishing one new param rewrote 1,502 lines. Structural comparison against the committed bytes:
params **byte-identical on all 849 entities except `flashfire`**, linkage MEMBERSHIP identical on all
16 keys, one usage-tiebreak reorder (`magnet`/`habanberry` in `linkage.moveType.items`) and one
`used:false -> true` correction. Behaviourally inert. `data/abra-tags.js` was rebuilt from it —
`build/build_tags_js.js` — because it is a frozen SOURCE and the first release cut of the day
(`49bab398fb28`) froze a stale copy; that cut is superseded by `e129bca605e3` and left in place.

---

## 4. FILED, NOT FIXED

- **The two engines destroy a dead Choice lock at different moments.** The authority drops the
  volatile inside `choicelock.onDisableMove`, which runs when it builds a request; this engine drops
  it inside `lockStillBinds`, which runs when something asks the menu. If those straddle a turn
  boundary, a Knocked-Off or Tricked-away Scarf leaves a lock standing on one side only. **Predicted
  before the run and NOT observed in 961 games**, which is not the same as absent: no game in the
  sample staged a Knock Off onto a locked body at a boundary. What is owed is a staged probe, not a
  narrower comparator.
- **`MEDFAILS.absorbGiftUnmodelled` changed MEANING and kept its NAME.** It no longer counts a gift
  that was binned; it counts a gift that landed and whose effect cannot be priced. Zero today. A
  reader of an old artifact will read the old meaning.
- **`tests/test-docs-current.js` IS RED ON ONE CLAUSE AND IT IS NOT THIS BATCH'S — PROVED, NOT
  ASSERTED.** 3b(c) reports `docs/ABRA-technical-docs.md: 2 untraceable figures, was 1` and
  `docs/SUMMARY.md: 1, document was not in the baseline`. Both are the same figure, **0.5822** — the
  two-feature PORY baseline (`alive_diff+hp_diff`) published in both documents. **The test was run
  with HEAD's copies of those two documents against the CURRENT `data/` and returned the identical
  per-document census**, so no edit in this pass caused it. What changed is that nothing under
  `data/` holds a POSITIVE number rounding to 0.5822 any more (the only near match is
  `policy-weights.json`'s `-0.5821710041473884`, and the sign makes it a different figure), and
  `engine/pory_baseline.py` PRINTS its table and writes no artifact at all — so the figure never had
  a real source and was being matched coincidentally by a file that has since been rewritten, most
  plausibly the gitignored pool cache `data/diff-team-pool.json`, which this batch rebuilt. **The
  gate is telling the truth for the first time.** It is not fixable from ENGINE and it must not be
  laundered: writing the number into CHANGELOG.md would make `changelogHas` accept it, which is the
  exact loop `engine/docs_scan.js` warns about in its own header. **Owner: MEASURE / PORY. The fix
  is an artifact out of `engine/pory_baseline.py`, or deletion of the figure.** 3b(b) was red as
  well with five new entries; all five WERE this batch's and all five are fixed. The gate reads
  **22 passed / 1 failed**.
- **Two untracked files in the tree that are not mine**, both of which appeared during this session:
  `docs/_reports/2026-08-29-turn-cap-scope.md` and
  `docs/_reports/2026-08-29-real-game-replay-scope.md`. Reported, left alone.

---

## OWED, NOT RUN

Re-derive the state before acting on any figure above:

```
node engine/status.js
node engine/open_work.js
node engine/quarantine.js
node tests/probe_uncompared_leaves.js
```

Reproduce this batch:

```
SHOWDOWN_PATH=... node tests/test-mechanics.js
#   expect: 784 live, 784 probed, 0 missing, run_ok true

MEDI_ABSORB_GIFT_VOLATILE_BLIND=1 SHOWDOWN_PATH=... node tests/test-mechanics.js
#   expect: exactly two MISSING rows, both ability/typeImmunity, both Flash Fire.
#   THIS OVERWRITES data/mechanics-census.json — re-run the clean one afterwards.

SHOWDOWN_PATH=... node engine/game_differential.js \
  --games 1200 --turns 12 --arm middle --state --end-state \
  --census data/verification/census-pin-9446a684709d.json \
  --team-store data/team-pool-frozen --release e129bca605e3 --write
#   expect: 961 games, 6 diverged, pool digest 0d103fb9fa87, 1968 picked,
#           12,445 turn boundaries all identical
```

Not run here, and each needs a game:

```
# the Choice-lock removal-moment asymmetry — a staged Knock Off onto a locked body,
# read at a turn boundary in BOTH engines. No probe exists.
#   (write it, show it RED under a knob, then decide whether it is a defect)

# the next leaf in the Phase 2 order — throatchop (5,023 pool games) and unburden (4,121),
# which the Phase 1 map flags as carrying a NAMED inequivalence: a body handed an item
# mid-stint and losing it again gets the volatile in the authority and nothing here.
SHOWDOWN_PATH=... node tests/probe_leaf_name_map.js --pool
```
