# THE FAINT BOUNDARY — D2, D3 AND D4 DO NOT SHARE A CAUSE, AND D4'S CARD IS REFUTED

**2026-08-29, ENGINE.** Batch of one. Census **803 -> 804 live / 804 probed / 0 missing**.
Empirical board-parted **90 -> 88 of 961**, protocol **205 -> 204**. The prediction was 88 and it HELD.

Nothing was committed and nothing was pushed. `data/game-differential.json` was not written; the
whole-game run went to `data/verification/game-differential.volleyreact.json`.

---

## 1. THE VERDICT ON THE FAMILY, TAKEN BEFORE ANYTHING WAS FIXED

The brief asked whether D2, D3 and D4 share a cause. **They do not, and the grouping in
`docs/_reports/2026-08-29-empirical-divergence-cards.md` is wrong in two places.** Measured by
reading each card's own lines out of `data/verification/divergence-turns.empirical.json` rather than
by reading the card titles:

| card | the report said | what the lines say |
|---|---|---|
| **D2** | "the faint is announced before the hit's consequences" | **NOT ONE THING.** Its five cards split four ways — section 3. Two are the reactor COUNT (fixed today), two are the reactor POSITION, and two are chance rolls. |
| **D3** | "an on-KO boost lands after the authority has ended the battle" | **CONFIRMED, and it is its own site.** `checkWin` returns above `AfterFaint` (`sim/battle.ts:2592` against `:2596`). Nothing to do with D2 or D4. Section 5. |
| **D4** | "Stamina fires once per move, not once per hit" | **REFUTED. Both engines fire Stamina TWICE.** The count has been right since WIRE 84. What differs is the POSITION — and THAT is shared, with half of D2. Section 4. |

So the one genuine cause-sharing in this family is **D4 with the ordering half of D2**, and it is not
a faint problem at all: it is `runEvent('DamagingHit')` being raised per ARRIVAL inside
`spreadMoveHit`, and batched below the whole volley here.

---

## 2. THE AUTHORITY'S FAINT PATH, READ WHOLE

`sim/pokemon.ts:1587` `faint()` only QUEUES. `faintMessages()` (`sim/battle.ts:2532-2604`) writes the
line, and it is called at eight places. Read to the end, two statements decide this whole family:

```
  2592    if (checkWin && this.checkWin(faintData)) return true;     <- returns HERE on a wipe
  2596    if (faintData && length) this.runEvent('AfterFaint', ...)  <- so this never runs
```

and, one level up, the loop that governs how many times an on-hit event can fire at all —
`data/mods/champions/scripts.ts:461-464`, the Champions override, **not** mainline:

```
  for (hit = 1; hit <= targetHits; hit++) {
    if (damage.includes(false)) break;
    if (hit > 1 && pokemon.status === 'slp' && (!isSleepUsable || gen === 4)) break;
    if (targets.every(target => !target?.hp)) break;      <- the volley cannot OPEN an
                                                             arrival against a corpse
```

with `-hitcount` written as `hit - 1` at `:550`.

**Those are two different statements in two different files, and the D-family divides along them
rather than along the faint queue.**

This engine already carries the queue (`queueFaint` / `drainFaints`, 2026-08-23) and its own header
declares the remainder: *"the authority ALSO defers `fainted`, `isActive`, `clearVolatile` and
`side.totalFainted` to the drain... The state half is OWED."* **That remainder is not the cause of
any card examined here** — worth saying, because it is where the brief's hypothesis pointed.

---

## 3. D2 IS FOUR THINGS

Cards read out of `data/verification/divergence-turns.empirical.json`; the index is the position in
`divergences[]`.

### 3a. The reaction COUNT — cards 7 and 228. BOARD-MATERIAL. **FIXED TODAY.**

Card 7, Dual Wingbeat into a Rough Skin Garchomp that dies to arrival 1:

```
  |-damage|p1a: Garchomp|0 fnt
  |-damage|p2a: Aerodactyl|79/155|[from] ability: roughskin|[of] p1a: Garchomp
  SHOWDOWN : |faint|p1a: Garchomp                                     <- one toll, then the faint
  MEDICHAM : |-damage|p2a: Aerodactyl|60/155|[from] ability: roughskin  <- a SECOND toll
```

Card 228, Triple Axel into the same shape: the authority tolls twice and writes `-hitcount 2`; we
toll **three** times. The attacker keeps HP it should have lost — 19 in card 7, 18 in card 228.

**The cause is not the faint at all.** `_stepApply`'s packet loop already breaks on `tg.curHP<=0` and
already counts what landed into `R.hitLanded`, which `_stepHitCount` announces. `_react` — the number
of times every `onDamagingHit` reactor is set off — was a SECOND opinion about that same quantity,
taken from the DRAWN count `_hitsThisUse`. So the engine printed `|-hitcount|1` beside two Rough Skin
tolls off one click: two implementations of one fact, four hundred lines apart in one function, which
is the breach CLAUDE.md names.

### 3b. The reaction POSITION — cards 52, 72, 91, and the first half of 228. NARRATION. **NOT FIXED.**

```
  card 52 — Dual Wingbeat into a Rough Skin Garchomp that SURVIVES
  SHOWDOWN : -damage(hit1), roughskin, -damage(hit2), roughskin, -hitcount 2
  MEDICHAM : -damage(hit1), -damage(hit2), roughskin, roughskin, -hitcount 2
```

Same HP on both sides, same `-hitcount`. The authority raises `DamagingHit` **inside** each
`spreadMoveHit`; this engine wraps the whole step list once per MOVE — the KNOWN-OPEN arm
`tests/test-resolution-order.js` already carries, and which `_stepUpdate`'s own header already
declares. **This is D4.** See section 4.

### 3c. A 30% roll — card 58, Cursed Body's Disable. **UNATTRIBUTED.**

Hyper Voice kills a Cursed Body Dragapult; the authority writes the Disable and we do not. The site
IS reached — `_stepEffects` runs on a fainted row (`if(!R.hit&&!R.fainted)return;`) and the Cursed
Body block gates on the ATTACKER, not on the target. So the plausible reading is a die ADDRESS rather
than a gate. **Not measured, and therefore not claimed.**

### 3d. A 10% roll — card 73, a Blizzard freeze. **UNATTRIBUTED.**

Blizzard kills one spread target and freezes the other for us and nobody for the authority. Same
shape as 3c, and the same non-claim.

---

## 4. D4 IS REFUTED: BOTH ENGINES FIRE STAMINA TWICE

The report's D4 says *"Stamina fires once per move, not once per hit"*. Card 134, read whole:

```
  |move|p1b: Farigiraf|twinbeam|p2a: Archaludon
  |-resisted|p2a: Archaludon|1
  |-damage|p2a: Archaludon|140/165
  SHOWDOWN : |-boost|def|1 , |-resisted| , |-damage|119/165 , |-boost|def|1 , |-hitcount|2
  MEDICHAM : |-resisted| , |-damage|119/165 , |-boost|def|1|[from] ability: stamina ,
             |-boost|def|1|[from] ability: stamina , |-hitcount|2
```

**Two boosts on both sides.** The frequency is right; the POSITION is not. Card 212 is the same shape
on a different game. So D4 is card 3b, and the one real cause-sharing in this family is D4 with the
ordering half of D2 — which the card titles hid, and which is why the brief's instruction to measure
rather than guess was the right one.

*(A second, unrelated attribution gap is visible in the same card: the authority's Stamina boost
carries no `[from]` and ours does. NOT filed as a defect — the reducer's treatment of that field was
not checked, so it may be normalised away.)*

---

## 5. D3 IS A SEPARATE SITE, AND IT IS TWO DEFECTS

Card 215 — Discharge kills the last two bodies:

```
  SHOWDOWN : |faint|p1b: Milotic          (and nothing further — the battle is over)
  MEDICHAM : |-boost|p2a: Eelektross|atk|1|[from] ability: eelevate , |faint| , |-boost| again
```

Card 216 — a double KO that does NOT end the battle:

```
  SHOWDOWN : |faint|Charizard , |faint|Tyranitar , |-boost|p1b: Eelektross|atk|2
  MEDICHAM : |-boost|atk|1|[from] eelevate , |faint|Tyranitar , |-boost|atk|1 again
```

Two clauses, both from `faintMessages()`'s tail, and neither from anything in section 3:

1. **`checkWin` returns above `AfterFaint`** (`:2592` against `:2596`), so a battle-ending KO runs no
   on-KO hook at all. We run ours. That is card 215.
2. **`onSourceAfterFaint(length, ...)` is paid ONCE with `length` = the size of the drain**, so a
   double KO is a single `-boost atk|2`. We pay `+1` per target row inside `_stepFaint`, above
   `_stepDrainFaints`, so ours interleaves with the faints. That is card 216.

**Not landed.** A different function, a different authority statement and a different fix, and the
batch was one. In the hand list.

---

## 6. WHAT LANDED — ONE EXPRESSION, ONE KNOB, ONE COUNTER

`engine/medicham2-browser.js`, inside `_stepApply`'s `_react` computation:

```js
if(_hitsThisUse!==null&&TAGS.param('move',a.move.id,'multiHit')){
  const _drawn=Math.max(1,_hitsThisUse);
  if(_packets&&_landed>0&&_landed<_drawn){
    MEDSEEN.volleyReactStoppedAtKO++;
    if(VOLLEY_REACT_DRAWN){MEDFAILS.volleyReactDrawnRestored=1;return _drawn;}
    return _landed;
  }
  return _drawn;
}
```

- **Gated on the packet road having run.** `_landed` is 0 on the single-packet road AND on the
  COLLAPSED road (a Focus Sash, an Endure or a busted Disguise rewrote the total, so `_packets` is
  null). WIRE 20's declared divergence is untouched; on those roads the drawn count is still the
  answer.
- **One count, not two.** `R.react` is read by the `punishesAttacker` loop and by
  `buffsHolderOnHit`'s loop, so both families were corrected by the one expression. That is the
  facts-are-global rule: how many arrivals landed is ONE fact, and `R.hitLanded` already carried it.
- **The knob is the before-arm.** `MEDI_VOLLEY_REACT_DRAWN=1` restores the drawn count and stamps
  `MEDFAILS.volleyReactDrawnRestored` at DECLARATION, not only where it fires — so a run under the
  knob is identifiable before a killing volley happens to occur.
- **`tests/test-mechanics.js` now refuses to write the census under it**, joining `residualCollapsed`
  in a named `DELIBERATE_BREAK` list. Demonstrated rather than asserted: the knob run printed
  *"REFUSED to write data/mechanics-census.json"* and the artifact's md5 was byte-identical across it.

---

## 7. THE PROBES — SHOWN RED FIRST, ON BOTH ENGINES

### `tests/probe_volley_reactor_count.js` (new) — two engines, one board

Run with `--release <id>`. It FORCES `--state` and says so in its own output, because the section-3b
INTERLEAVE parts the protocol on turn 1 and the default stop rule would end the game ABOVE the KO
turn this probe is about. CLAUDE.md's rule is the reason: commentary may differ; boards may not.

**Before**, release `070890fc77a2` — exactly one assertion RED, and it is the defect:

```
  turn |         SHOWDOWN                     |         MEDICHAM
  1    | hit,TOLL,hit,TOLL,count:2  [tolls 2] | hit,hit,TOLL,TOLL,count:2   [tolls 2]
  2    | hit,TOLL,faint,count:1     [tolls 1] | hit,TOLL,TOLL,faint,count:1 [tolls 2]
  FAIL  turn 2: showdown 1 (count 1), medicham 2 (count 1)
```

**After**, release `12dae69813f6` — GREEN, and turn 2 is identical line-for-line on both engines.

Controls, all holding in both arms:

- **Turn 1 is the survivor control.** The identical click into a body that lives through both
  arrivals must still toll TWICE. Without it, "the toll is paid once" is satisfied by an engine that
  forgot how to count hits — which is what this engine was before WIRE 84.
- **`no-ability`** is the cleared control: Sharpedo's OTHER legal ability (Speed Boost), same board,
  same clicks. Zero toll lines on both engines **and the body still dies** — asserted explicitly,
  because an arm where nothing could have happened proves nothing.
- The cast is checked through `TeamValidator` (`CS.canLearn`, 7 of 7 legal) and the type chart is read
  out of `Dex.forFormat` and printed, never recalled.

### `tests/test-mechanics.js` — the census row

`ability` / `punishesAttacker` — *"a volley that kills on its first arrival tolls the attacker ONCE,
not once per drawn hit"*. Three arms on one staged doubles board: Talonflame Dual Wingbeat into a
Rough Skin Garchomp. An eighth of Talonflame is 19.

| arm | before (under the knob) | after |
|---|---|---|
| survivor — it lives | `-hitcount 2`, 2 tolls, paid 38 | **unchanged**: `-hitcount 2`, 2 tolls, paid 38 |
| killer — it is on 5 HP | `-hitcount 1`, **2 tolls, paid 38** | `-hitcount 1`, **1 toll, paid 19** |
| cleared — no ability | `-hitcount 1`, 0 tolls, paid 0, dead | **unchanged** |

The helper `volleyToll(` is declared in the `REALTURN` header with its reason, per that block's own
rule: a direct call would be HANDED a hit count by the caller and would assert the caller's arithmetic
instead of the loop's.

---

## 8. WHICH SCOREBOARD, SAID BEFORE THE RUN

**Stated before running:** the LAB should move (a new census row) and the POOL should move by **2** —
board-parted 90 -> **88** — because cards 7 and 228 are the only two board-material instances of this
mechanic in the empirical population, and the commoner shape (3b, the interleave) is narration that a
board comparison cannot see. The range given was 88-90, and it must not rise.

**RESULT: 88. The prediction HELD at its point estimate.**

| | baseline | after |
|---|---|---|
| board-parted | **90** of 961 | **88** of 961 |
| `games_board_never_diverged` | 871 | **873** |
| protocol diverged | 205 | **204** |
| threw | 1 | 1 |
| census | 803 / 803 / 0 | **804 / 804 / 0** |

Baseline read from `data/verification/game-differential.sidetarget.json`, release `070890fc77a2`.
After read from `data/verification/game-differential.volleyreact.json`, release `12dae69813f6`,
`--arm middle --end-state --steering empirical --census data/verification/census-pin-9446a684709d.json
--team-store data/team-pool-frozen --games 1200` (which yields 961), cap 12, pool `0d103fb9fa87`,
census pin `9446a684709d`, policy `empirical-click/v1`. **One run parameter differs from the baseline
and it is the release.**

---

## 9. THE CLOSETED PERISH ROW (ROADMAP #440) STILL HOLDS

**Nothing in this batch touched the drain position.** The diff is one expression inside `_stepApply`'s
`_react`, a knob declaration and two counters. `queueFaint`, `drainFaints`, `residualEvent`,
`residualFollowerRuns` and the residual walk are untouched — established by reading the diff, not
asserted.

Against the row's own four falsifiers:

- **(a) the pair appearing with no `perish0` in `showdown_before`** — the `|upkeep <> |faint|pXY` pair
  does not appear at all among this arm's causes. Not falsified.
- **(b) the board claim failing** — that is a claim about `data/game-differential.json`, the COVERAGE
  arm on release `5f3f7141227c`. **NOT RE-RUN THIS BATCH.** It is neither confirmed nor falsified
  here, and it is listed under OWED below. This is the one honest gap.
- **(c) `MEDFAILS.residualFollowerUnmapped` becoming non-empty** — no such line in this run's output.
  The stronger available evidence is that all **seven** `move/perishClock` census probes are LIVE on
  the post-fix census (804 live, **0 missing**), including *"a perish `|faint|` sits below `|upkeep|`
  when nothing follows it in the walk, and above it when something does"*. Not falsified.
- **(d) the cause reaching more than the single game measured** — not observed. Not falsified.

**The row still holds**, with (b) named rather than absorbed.

---

## 10. THE HAND LIST

**Leaves it:**

- ~~*"the faint is announced before the hit's consequences (D2), 5 games"*~~ — **it was never one
  thing.** Two of the five are the reaction COUNT and are fixed, with a census probe and a two-engine
  probe; two are the reaction POSITION and are D4; two are chance rolls and are named below.

**Joins it:**

- **`onDamagingHit` IS RAISED PER ARRIVAL AND WE BATCH IT BELOW THE VOLLEY** — cards 52, 72, 91, 134,
  212, 228, and the whole of D4. `spreadMoveHit` runs the entire hit chain per arrival; this engine
  wraps the step list once per MOVE. Narration on every card measured, and it is the KNOWN-OPEN arm
  `tests/test-resolution-order.js` already carries. **The largest single item left in this family.**
  Its own batch, and it is a restructure rather than an expression.
- **THE ON-KO BOOST RUNS AFTER A BATTLE THE AUTHORITY HAS ALREADY ENDED, AND IT PAYS PER TARGET
  INSTEAD OF PER DRAIN** — D3, cards 215 and 216. `checkWin` at `sim/battle.ts:2592` returns above
  `AfterFaint` at `:2596`; `onSourceAfterFaint(length, ...)` is paid once with the drain size. Ours is
  inside `_stepFaint`, per row, above `_stepDrainFaints`. Two clauses, one site. Its own batch.
- **A CURSED BODY 30% AND A BLIZZARD 10% THAT FIRE ON ONE ENGINE ONLY, BOTH ON A TURN SOMETHING DIED**
  — cards 58 and 73. The sites are reached; the reading is a die ADDRESS and it is NOT measured. Needs
  an address dump on those two seeds before anything is claimed.
- **CORRECTION TO THE STANDING `lownode` ITEM.** `tools\lownode.cmd` **is** reachable from this shell:
  `cmd //c "<absolute path to a two-line .cmd wrapper>"` works, and the wrapper's `exit /b
  %ERRORLEVEL%` is preserved. What does not work is `cmd //c "tools\lownode.cmd <args>"` inline, whose
  argument string is re-split. The item as filed — *"unreachable for the second session running"* — is
  too strong.

**Carried forward unchanged** from the hand lists below: the redirect gate's ally-aimed status move,
the ally-aimed delayed hit, Defog's `target.side`, the `self`-target heal `|move|` line, the
fainted-ally clause of `getTarget`, the `scripted` exemption from `aimTravelsByLoc`, the
`chillyreception` target-class exemption, and the `benchRisk` refit `clickFragility` owes MEASURE.

---

## OWED, NOT RUN

- **The coverage-arm whole-game differential (`data/game-differential.json`) was NOT re-run.** So the
  MEDICHAM gate clauses, and falsifier (b) of the closeted perish row, still rest on release
  `5f3f7141227c`. This batch's change is one expression on a multi-hit path, and the coverage driver
  reaches turn 12 in 98% of its games and ends almost none — so the expectation is "unmoved". **That
  is a prediction and not a measurement, and it is not counted here.**
- **The deliberate roster (`tests/roster.js`, all three stages) was NOT re-run**, and `status.js`
  already calls it stale against the tree for an earlier reason.
- **`data/all-mechanics-fire.json` was NOT re-run.**
- **The damage differential (`tests/test-engine-diff.js`) was NOT re-run.** It calls `moveHit` once and
  skips every `multiHit` move by construction, so it is structurally blind to this change — but that
  is an argument, not a run.
- **Cards 58 and 73 were not diagnosed.** Named in the hand list; no die-address evidence was
  collected.
- **The 3b interleave's board-materiality was not measured over the population.** Every card examined
  shows identical HP and identical `-hitcount` on both sides. That is evidence, not proof.
- **No commit and no push were made.**
