# ENGINE — does the simulator do what Pokémon does

**Owns:** `engine/medicham2-browser.js`, `engine/tag_dex.js`, `data/abra-tags.js`,
`tests/test-mechanics.js`, `tests/walk_tags.js`, `tests/test-engine-diff.js`,
`tests/test-game-diff.js`, `tests/interaction_matrix.js`, `tests/test-interaction-matrix.js`,
`tests/mechanics_rank.js`, `tests/mutation_harness.js`, `tests/test-mutation-coverage.js`,
`tests/test-medicham-coverage.js`, `tests/regulation_usage.js`, `tests/probe_red_demo.js`,
`tests/test-protocol-trace.js`, `engine/derive_protocol_events.js`, `data/protocol-events.json`

**Six instruments, and none substitutes for another:**

| file | asks | structurally cannot see |
|---|---|---|
| `test-mechanics.js` | is ONE mechanic live | tag x tag; and whether a LIVE verdict rests on a probe that asserts rather than proves |
| `test-engine-diff.js` | is ONE HIT's damage right | every turn counter |
| `test-game-diff.js` | do the two engines hold the same STATE after every turn | damage magnitude |
| `test-interaction-matrix.js` | does every carrier x reactor pair resolve the way the official engine says | anything the generator refuses to emit — printed on every run |
| `test-protocol-trace.js` | does the engine EMIT what it did, in Showdown's own protocol shapes, and does every event it claims actually FIRE | whether a MECHANIC is right — it is a stream, not an oracle; the comparison driver over two streams is ROADMAP #68's next step |
| `mutation_harness.js` | does the handler MATTER, or does it only FIRE — change the FACT, watch the BEHAVIOUR | a fact derived WRONG upstream (it is propagated and consumed faithfully and scores LIVE); anything outside `medicham2-browser.js`; a branch no scripted turn reaches, which it counts rather than hides |

**Its one number:** mechanics live. **It must never go down.**

**May not:** claim a strength gain (that is SEARCH, gated by MEASURE), change what board.js
*means* by a feature, or land during a fit or self-play run.

<!-- GENERATED: engine/status.js -->

```
ENGINE — does the simulator do what Pokémon does
  281/282 probed mechanics live, 1 missing   (census 2026-08-07 19:16)
  missing:
    move    needsTargetToAttack    Avalanche doubles after the target hits it this turn
  1/150 differential comparisons disagree with Showdown   (2026-08-07 19:16)
    seed 20260804, requested 150, 11 not comparable (multihit 7, non-finite 0, threw 4)
    chesnaught woodhammer -> mimikyu: showdown 0-0, medicham 120-130  (63 uses)
    a differential hit is NOT in the census count above — the census probes what someone thought to probe
  interaction matrix: 1624/1643 live carrier x reactor pairs agree with the official engine (98.8%)   (2026-08-06 21:50)
    2300 of 8795 theoretical pairs staged — agreement is a claim about the 2300 that ran, not about the 8795
      530 inert      not scored — the reference engine behaves identically with and without the reactor
      109 saturated  not scored — the control arm already dealt 100% of HP, so a damage ratio is clamped
       16 ko-timing  not scored — a damage-magnitude question — tests/test-engine-diff.js owns it
        2 threw      not scored — the harness could not stage it
    DISAGREES  stoneaxe -> roughskin  (secondary, 63 uses)
    DISAGREES  stoneaxe -> wanderingspirit  (secondary, 63 uses)
    DISAGREES  stoneaxe -> mummy  (secondary, 63 uses)
    DISAGREES  stoneaxe -> gooey  (secondary, 63 uses)
    DISAGREES  gigaimpact -> spikyshield  (secondary, 38 uses)
    DISAGREES  supercellslam -> kingsshield  (secondary, 85 uses)
  release ladder: 14 frozen releases x 1997 games, one pinned census   (2026-08-07 17:44)
    median completed turns before divergence: 1 at the baseline, 1 at the top rung  <-- UNMOVED by the whole series
    whole-game agreement 7/1997 -> 134/1997; first-divergence line, mean 14.78 -> 33.98
    paired against the baseline: 1295 games part later, 116 EARLIER, 586 unchanged
    the baseline ran first and last and reproduced exactly; comparability: every arm cleared
  tag coverage: 162/181 probed, 19 unprobed
```

_stamped 2026-08-07 19:17_

<!-- /GENERATED -->

## The working rule

**A mechanic is not open work until a probe fails on it.** Everything in the generated block above
came out of an artifact; anything in the hand list below is a claim about the engine that nothing
checks. The job of that list is to empty itself — each item becomes a probe in
`tests/test-mechanics.js`, and from then on the census carries it and the line disappears from here.

That is the whole reason the census count may never fall: it is the only number in the project that
a human cannot quietly soften.

## ROADMAP #81 WIRE 11 — FOUR DEFECTS READ OFF REAL DIVERGENCES, AND TWO OF THE FOUR WERE NOT WHAT THEY LOOKED LIKE. 2026-08-07.

Census **270 live / 271 probed → 281 live / 282 probed**, `missing` unchanged at 1 (Avalanche, which
has its own verdict at the bottom of this file). Eleven probes added: **eight were written RED and
went green when the engine changed**, three were written for claims that turned out to be ALREADY
LIVE and are probed anyway so the census carries them. `armed` 282/282, `directCall` 0, `hollow` 0,
`threw` 0. `tests/probe_red_demo.js` **168 → 177 demonstrations, 0 failed** — seven source-reverted
demos and two controls.

**Every measurement below is STATE**, in HP, an item slot, a stat stage, or the Speed that decided
who moved first. No claim here rests on a protocol string except defect 3's order, which has no state
reading and says so.

### 1. THE SPREAD MODIFIER IS DECIDED BY TARGETS ENTERED, AND HALF OF IT WAS ALREADY RIGHT

`sim/battle-actions.ts:551` sets `move.spreadHit` from the array that ENTERS `trySpreadMoveHit`,
above the whole step list — so nothing a step does to that array can take the 0.75 back off.

| staging | before | after | authority |
|---|---:|---:|---|
| Dazzling Gleam → Archaludon, partner alive | 65 | 65 | 0.75 applies |
| …partner behind a **Protect** | **87** | **65** | 0.75 still applies — it is alive and still in the array |
| …partner **already fainted** | 87 | 87 | no modifier — `Side#allies()` filtered it before the array was built |

Observed live at 130/165 against our 118/165 — 35 against 47, ratio 0.745. Ours now reads 65/87 =
0.747. **The fainted-partner half was already correct** and for exactly the right reason: `live(foes)`
filters the same bodies `Side#allies()` does. It is probed rather than asserted, because the fix is
one line away from breaking it.

`smartTarget` (Dragon Darts) has no representation in this engine, so no exclusion for it is written.

### 2. WHITE HERB WAS NOT DOING NOTHING — IT WAS A WHOLE TURN LATE

The first diagnosis was wrong and the probe is what corrected it. **WIRE 56 had already wired what the
herb DOES**; it wired it at one trigger. `data/items.ts` gives whiteherb **four** — `onAnySwitchIn`
(priority -2), `onAnyAfterMega`, `onAnyAfterMove` and `onResidual` — and three were missing.

| staging | before | after |
|---|---|---|
| Sneasler Intimidated, read at the switch-in | atk **-1**, holding `whiteherb` | atk **0**, holding `` |
| same body, negative-only rule at the residual | atk +2 / spe 0 / def 0 | unchanged — this was WIRE 56's and is LIVE either way |
| Sneasler 100 Speed vs an Intimidating Incineroar at 150 on 1 HP | Sneasler **took 155** | Sneasler **took 0** |

The third row is the one Will named and it is the dangerous half: **losing the item is a SPEED TIER
CHANGE MID-TURN**, not an announcement. `unburden.onAfterUseItem` adds the volatile the moment the
herb is spent and the volatile is `onModifySpe -> chainModify(2)`, so 100 becomes 200, Sneasler moves
first, and the Incineroar dies before it acts. At the residual the item came off *after* the order had
already been spent. White Herb is **2,380** corpus sheets and Unburden **2,509**; `buildMon`'s own
usage set for Sneasler is Unburden **holding a White Herb**, so the pair is the common case.

`restoreStatsUpdate()`/`restoreStatsAll()` is the one implementation, called from the switch-in, the
mega, the after-action pass and the residual. Membership is the artifact's and was printed before it
was wired: **`restoresStats` matches exactly one item.**

### 3. THE CONTACT PUNISH FIRED BEFORE THE DAMAGE — AND THE STATE HALF IS THE `onFaintOnly` GATE

`spreadDamage` is step 2 of `spreadMoveHit` (`battle-actions.ts:1079`); `runEvent('DamagingHit')` is
four numbered steps later (`:1117`). WIRE 10 filed this and did not fix it because it changes
single-target order, which was that rung's control. It is fixed here.

- **The order.** Tyranitar Knock Off into a Rough Skin Garchomp: the damage lines were
  `attacker,target` and are now `target,attacker`, with the target's loss and the attacker's 1/8 toll
  identical in both builds (79 and 21). Rough Skin is **6,499** sheets.
- **The state.** Aftermath's own gate is `if (!target.hp && …)` — the HP **after** the packet landed.
  Read before the damage, the gate had to compare the RAW `dmg` against `tg.curHP`, which is the
  number **before** a Focus Sash or a busted Disguise cut it down. So:

| staging | before | after |
|---|---:|---:|
| Knock Off into a 20 HP Aftermath body, **no item** — it dies | attacker pays 43 | attacker pays 43 |
| same body holding a **Focus Sash** — it survives on 1 | attacker pays **43** | attacker pays **0** |

  43 is a quarter of Tyranitar's 175. Aftermath is only **3** corpus sheets — the ORDER is the
  valuable half and the Sash gate is the correct half.
- **The third claim was real in the authority and has NO state consequence here.** A dead attacker
  takes no further toll (`Battle#spreadDamage` returns 0 and emits nothing when `!target.hp`) and this
  engine had no `!m.fainted` guard. `curHP` clamps at 0 either way, so nothing moved on state; the
  guard is added because the LINE does. **Counted as a stream fix, not as a win.**
- **What did NOT move, checked rather than assumed:** the punish is still paid when the target dies
  to the packet. `runEvent` skips a handler whose holder is `fainted` (`sim/battle.ts:512`) and
  `Pokemon#faint` explicitly does not set that flag until the queue resolves.

### 4. A CRITICAL HIT IGNORES THREE THINGS AND MODELLED NONE. IT DOES NOT IGNORE BURN.

`moveHit.crit` sets both `ignoreNegativeOffensive` and `ignorePositiveDefensive`
(`battle-actions.ts:1683-1691`), applied as `ignoreOffensive = (… && atkBoosts < 0)` and
`ignoreDefensive = (… && defBoosts > 0)`. The stated blocker was that `dmgRange` recomputes A and D
without a crit flag; **`isCrit` is now its sixth parameter**, optional, and every pre-existing caller
gets exactly what it got before.

Meowscarada into Garchomp, Flower Trick (pCrit 1) against Knock Off (the plain physical control):

| staging | plain move | crit before | crit after |
|---|---:|---:|---:|
| baseline | 70 | 113 | 113 |
| attacker **Intimidated** (a real Intimidate, from the foe slot) | 47 | **76** | **113** |
| defender at **+2 Defence** | 36 | **58** | **113** |
| **Reflect** up | 47 | **76** | **113** |
| attacker **burned** | 35 | 56 | **56 — unchanged, and it must be** |
| defender at **-2 Defence** | — | 224 | 224 — a crit still takes a MINUS |

**Will named the trap and it is now a probe.** *"i dont think it ignores burn tho"* — correct. The
three rules operate on BOOST STAGES; burn's halving is an `onModifyAtk` multiplier and survives a
crit. Gen 2 ignored it, Gen 3 onward does not. A probe and a demo both go RED on any future engine
that "completes" the list with a fourth member.

**The crit ODDS were already right and were not touched** — `CRIT_BY_STAGE=[1/24,1/8,1/2,1]` matches
`critMult = [0,24,8,2,1]` for gen 7+.

**THE ROLLED CRIT IS RE-PRICED WITHOUT SPENDING A NEW DIE.** One `rng()` is drawn where it was always
drawn and is kept as an INDEX; if the crit lands, the same index is read off the crit range. So a crit
with nothing to ignore is **byte-identical** to the old arithmetic — asserted, not claimed:
`113 vs 113` under the reverted engine.

### THE ELEVEN PROBES AND THE NINE DEMONSTRATIONS

`tests/test-mechanics.js` — 8 red-first, 3 already-live:

| tag | probe | was |
|---|---|---|
| `spreadFoes` | a PROTECTING partner still costs the survivor the spread 0.75 | RED |
| `spreadFoes` | an ALREADY-FAINTED partner removes the modifier entirely | already live |
| `restoresStats` | White Herb clears the Intimidate drop and is consumed | RED |
| `restoresStats` | White Herb restores NEGATIVE stages only and leaves a positive one | already live (WIRE 56's residual) |
| `speedOnItemLoss` | losing a White Herb to Intimidate procs Unburden in the same turn | RED |
| `punishesAttacker` | Aftermath reads the post-Sash HP, so a survivor does not detonate | RED |
| `punishesAttacker` | the contact punish is paid AFTER the damage lands, not before | RED |
| `alwaysCrit` | a crit ignores the ATTACKER's negative Attack stages | RED |
| `alwaysCrit` | a crit ignores the DEFENDER's positive Defense stages | RED |
| `alwaysCrit` | a crit ignores Reflect | RED |
| `alwaysCrit` | a crit does NOT ignore a burn | already live — a guard, not a gap |

`tests/probe_red_demo.js` — seven `demoSource` cases plus **two controls**, and the second control is
the attribution claim the wire cannot make about itself: **45/45 ordinary clicks land in an IDENTICAL
state** under all three reversals applied at once, the stream moves on every unconditional-toll row
and on no reactorless row, and a ROLLED toll reorders at the roll that fires it.

### THE CONTROL FOUND A DEFECT IN ITSELF FIRST, WHICH IS THE POINT OF WRITING IT

The first cut of that control listed Static, Stamina and Weak Armor as "must reorder" and went red on
all three. Both reasons are real and neither is a probe bug in the ordinary sense:

- **Static's toll is a 30% roll.** On the pinned median die it does not fire, so two of its three
  cells are legitimately identical. It IS a reorder at roll 0, and that is now pinned on its own.
- **Stamina and Weak Armor did not move, and in the authority they should have.** See the filed item
  below.

### FILED, NOT FIXED — one residual, staged in the authority rather than guessed

**`buffsHolderOnHit` IS THE SAME EVENT AS `punishesAttacker` AND THIS ENGINE RESOLVES THEM IN TWO
DIFFERENT STEPS.** Stamina, Weak Armor and Rough Skin are all `onDamagingHit` in Showdown, which runs
**after** `runMoveEffects`, `selfDrops` and `secondaries` (`battle-actions.ts:1117`). WIRE 11 moved
`punishesAttacker` below the damage — which is the divergence that was observed and filed — but not
below the SECONDARIES, and it left `buffsHolderOnHit` where it was, at the top of `_stepEffects`.
So two things remain out of place: the punish is one step early relative to a contact move's own
secondary, and the buff family is in a different step from the toll family it shares an event with.

Closing it properly means a NEW per-row step after `_stepEffects` carrying both families, which moves
where every secondary on every contact move lands. That is a shape change of the same size as WIRE 10
and it must be its own rung, or the next ladder run cannot say which change moved it. Measured
exposure: the control above shows the buff family holding still on all 6 of its cells under a full
WIRE 11 reversal, so nothing here has drifted — it simply has not been done.

### Green, and what was NOT re-run

Run and green: `tests/test-mechanics.js` (281/282), `tests/probe_red_demo.js` (177/0),
`tests/test-engine-consistency.js`, `tests/test-medicham.js` (5/5),
`tests/test-engine-diff.js` (**1/150 at seed 20260804, the same single SUSPECT row —
`chesnaught woodhammer -> mimikyu`, unchanged**), `tests/test-game-diff.js` (all five scripted games
agree on every turn, and the injected-divergence proof still catches its plant), plus
`test-tag-wire`, `test-tag-consumed`, `test-speed-multipliers`, `test-rollout-effects`,
`test-dead-volatile`, `test-priority-block`, `test-entry-effects`, `test-charge`, `test-choice-lock`,
`test-weather-duration`, `test-mega-timing`, `test-forced-switch`, `test-future-sight`.

**ONE GATE WENT RED BECAUSE THE ENGINE GOT BETTER, AND IT SAID SO IN ITS OWN FAILURE MESSAGE.**
`tests/test-protocol-trace.js` PART 5 is the acceptance case for defect 4 and it asserted
`meIntim !== meCtrl` — *"either the declared crit limitation is gone (good news, and this test must
then be rewritten) or the Intimidate never landed."* The limitation is gone. The assertion is
**inverted** and the escape hatch in that message is **closed by a control**: "the two arms agree" is
satisfied just as well by a scenario that never staged the drop, so the `|-unboost|` line is now
asserted present in the Intimidate arm and absent from the Blaze arm, **on each engine's own stream**.
It reads `showdown 112/170 in both arms, medicham 111/170 in both arms`. The one-HP gap is the die
multiplicity difference that test's own header documents at length and is deliberately not asserted.

**THE REFIT DEBT DID NOT GROW, AND THAT IS CHECKED RATHER THAN HOPED.** `engine/feature_fixture.js`
reports the SAME eight features with the SAME before/after digests as it did before this wire started
(`koTarget b6902f89050e -> fc2501572a6e`, `screenValue 68d992e33616 -> b34d1b81da46`, and six more).
So WIRE 11 moved no value on the fixture board and `REFIT OWED` is exactly the debt MEASURE already
had. That is a fact about the fixture, not a claim that no feature can ever move: the fixture board
carries no guaranteed-crit move, no screen under a crit and no shielded partner, which is precisely
the surface this wire touched.

**NOT RE-RUN, and the reason:** the whole-game differential and the release ladder are held by other
divisions this session and were not touched. `tests/test-interaction-matrix.js --full` WAS run and
reads **1557/1574 live pairs (98.9%)** against a published **1624/1643 (98.8%)** — **the artifact was
NOT overwritten** (the shrink guard refused a smaller live count, correctly). That comparison is **not
attributable to this wire**: the published run is dated 2026-08-06 and predates WIRE 8, 9 and 10 as
well as this one. The one parting row that looked like it might be mine — `stoneaxe -> beakblast`,
`.B.active[0].hurt` — was played directly against an engine with **all three of this wire's reversals
applied** and is **byte-identical**, so it is not.

## ROADMAP #81 WIRE 10 — THE SHAPE LANDED AND THE MEDIAN TURN IS STILL 1. THE STOP TEST RETURNED A NEGATIVE. 2026-08-07.

**SAID FIRST, BECAUSE IT IS THE ANSWER THE RUNG WAS RUN FOR: THE MEDIAN COMPLETED TURN BEFORE
DIVERGENCE IS 1, AT THE BASELINE AND AT THE TOP RUNG, FOR THE TENTH CONSECUTIVE RUNG.** The largest
structural target in the differential landed, the cause family it was aimed at fell by 125 games, and
the number the whole series exists to move did not move. What that means is at the bottom of this
section and it is not "keep grinding".

Census **267 live / 268 probed → 270 live / 271 probed** (the three probes were written RED first and
are listed below; they read 267/271 with 4 missing until the engine changed). `missing` unchanged at 1
(`needsTargetToAttack`). 0 hollow, 0 unarmed, 0 direct-call, 0 threw. `tests/probe_red_demo.js`
**164 → 168 demonstrations, 0 failed** — three source-reverted, plus a CONTROL that is not a
demonstration and says so.

### ONE PATH OR TWO — ASKED BEFORE ANYTHING WAS BUILT, BECAUSE THE ANSWER DECIDES THE FIX

Showdown has no single-target path; it has an array of length 1. **Neither did this engine, and that
was the good news** — `targets = a.move.spread ? live(foes) : [aim]` has always produced one array and
one loop. What was not unified was the STEP STRUCTURE inside that loop, and at N=1 a per-target loop
is indistinguishable from a per-step one. So the fix is not "reorder the spread branch": it is that
the single loop becomes the step list, and the single-target case follows for free because at one
target the two loop orders are **the same permutation**.

That is why the control below could be stated as an equality and then measured rather than assumed.

### THE CONTROL, RESTATED AGAINST THE AUTHORITY AND NOT AGAINST OUR YESTERDAY

The dispatch said *"single-target damage must be byte-identical before and after"*, and that assumes
our single-target behaviour is correct — the same shape as a probe that asserts what the engine
already does. Restated and measured both ways:

| | before | after |
|---|---|---|
| `tests/test-engine-diff.js` — one hit against the authority | 1/150 disagree | **1/150 disagree, the same row** (`chesnaught woodhammer -> mimikyu`) |
| 36 single-target clicks × 3 rolls, shipped driver vs reverted per-target driver | — | **36/36 byte-identical**, stream and HP |

**IT DID NOT AGREE NOW IN ONE PLACE, AND THAT WAS A FINDING RATHER THAN SOMETHING TO PRESERVE.** The
accuracy roll was this engine's step 0 and is Showdown's step **4** — after invulnerability, TryHit,
type immunity and move-specific immunity (`sim/battle-actions.ts:555-577`). A target dropped by one of
those never reaches the die, so a Normal move thrown at a Ghost on a losing roll is `|-immune|` in the
authority and was `|-miss|` here, **at one target as much as at four**. That is the whole
`|-immune| <> |-miss|` family, it is single-target behaviour, and preserving it would have been the
scope rule protecting a bug.

**AND THE CONTROL CAUGHT ITSELF FIRST.** Its first cut listed `makeitrain` and `earthquake` among the
"single-target" clicks and reported five of them moving. Both are spread moves — the control was
measuring the one thing it exists to hold constant. Single-targetness is now ASSERTED per row (the
partner slot must take nothing and no `p2b` line may appear) instead of claimed by the name of the
list.

### WHAT CHANGED: THE ORDER IS DATA NOW, AND THE BLOCKS DID NOT MOVE

`trySpreadMoveHit` holds eight steps and each walks every target before the next begins;
`spreadMoveHit` (`:1023`) numbers six more inside the last. medicham2 now holds a `_STEPS` array of
nine closures and drives it with two nested loops:

```js
for(const _step of _STEPS)for(const R of _rows){if(R.out)continue;_step(R);}
```

The mechanic blocks stayed exactly where the file already had them — only their `continue` became
`R.out=true;return`. **The step ORDER lives in one array, as it does in the authority**, which is why
the gates could be re-sequenced into Showdown's order (invulnerability, TryHit, type immunity,
move-specific immunity, accuracy) without moving a line of the mechanics they contain. Reverse the two
`for`s and you have the engine as it stood through WIRE 9; that one-line swap is the known-bad build
every demonstration below runs against.

Staged in the authority before a line moved — Gholdengo's Icy Wind into two Milotic:

```
|-resisted|p2a: Milotic|1        <- every effectiveness line
|-resisted|p2b: Milotic2|1
|-damage|p2a: Milotic|160/170    <- then every damage line
|-damage|p2b: Milotic2|161/170
|-unboost|p2a: Milotic|spe|1     <- then every secondary
|-unboost|p2b: Milotic2|spe|1
```

against this engine's `eff(a) dmg(a) sec(a) eff(b) dmg(b) sec(b)`. It now prints the left-hand column.

### IT WAS NEVER ONLY A STREAM CLAIM, AND THE FIRST PROBE READS HP

`beastboost`/`eelevate` fire from `onSourceAfterFaint`; `AfterFaint` is run by `faintMessages`
(`sim/battle.ts:2598`), which `hitStepMoveHitLoop` calls **after the whole loop**
(`battle-actions.ts:972`). So a spread move that kills its first target cannot be holding a +1 when it
prices its second. This engine fainted, boosted, and only then priced — measured, not argued:

| Make It Rain into two Milotic | second foe took |
|---|---|
| first foe survives | 33 |
| first foe DIES (Eelevate) | **50** → now 33 |
| first foe dies, no ability | 33 (the control: the faint alone is not what moves it) |

### THE THREE PROBES AND THE FOUR DEMONSTRATIONS

| probe (`move\|spreadFoes`) | asserts | the arm that stops it being vacuous |
|---|---|---|
| *a spread move prices every target before any of them faints* | the second foe's HP loss | **the arms are NOT the two damage figures** — the probe asserts those are EQUAL and the harness would rightly call that hollow. They are `[second foe's damage, KO boost that fired]`: the varied knob is shown to have MOVED something (0 → 1 boost line) while the damage it must not reach stayed put. A third arm kills with no ability at all |
| *a spread move runs each step over every target before the next step* | the step shape `eff,eff,dmg,dmg,sec,sec` | the same click on ONE foe, whose shape must stay `eff,dmg,sec`. Without it "every eff precedes every dmg" passes vacuously on an engine that stopped emitting effectiveness lines |
| *a target that faints to a spread hit does not interrupt the other target* | `dmg,dmg,faint` | the same click with the first foe healthy: the shape must lose the faint and NOTHING else, and the survivor's HP loss is asserted identical in both arms |

The KO probe's first cut read the boost off `boosts` and reported **0 on the arm where the boost
demonstrably happened** — Eelevate raises the highest raw stat, which on Gholdengo is the same Special
Attack that Make It Rain drops by two, so a stage read off the body cannot tell "+1 fired and was
cancelled" from "+1 never fired". It counts the `|-boost|` line instead.

**FOUR REVERSALS IN `probe_red_demo.js` HAD TO BE RE-ANCHORED AND EVERY ONE OF THEM THREW FIRST**
(WIRE 126, WIRE 128, WIRE 129, WIRE 130 and WIRE 9's miss line). That is the guard working exactly as
its header promises: a patch that silently stopped matching would have made a broken engine look
fixed. Each reversal is unchanged in substance and re-pointed at the same site's new form.

### THE TABLE — 14 arms × 1,997 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`, census pinned to `data/wire-ladder-census.pin.json`, new rung
`a13-wire10` on release **`dc3c43336539`**. The baseline ran first and last with twelve arms between
and **reproduced EXACTLY**. All 13 non-baseline arms comparable; **all 11 watched inputs
byte-identical before and after, and the three game stores were re-digested by hand around the run and
did not move.** The store HAS grown since WIRE 9's published run (1,996 → 1,997 games), so every figure
here is from THIS run and none of it may be compared against the WIRE 9 table.

| arm | div/1997 | agreed whole | causes | **medTurn** | median line | mean | vs previous rung (later/earlier/**net**) |
|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1990 | 7 | 1171 | **1** | 13 | 14.78 | — |
| WIRE 7 | 1939 | 58 | 1293 | **1** | 16 | 28.79 | 541/178/**+363** |
| WIRE 8 | 1900 | 97 | 1381 | **1** | 16 | 31.22 | 390/185/**+205** |
| WIRE 9 | 1868 | 129 | 1336 | **1** | 18 | 33.24 | 490/177/**+313** |
| **WIRE 10** | **1863** | **134** | 1421 | **1** | **19** | **33.98** | 368/**265**/**+103** |
| baseline, REPEATED | 1990 | 7 | 1171 | **1** | 13 | 14.78 | — |

- **NET, THE ONLY HONEST FORM. Against WIRE 9: 368 later, 265 EARLIER, 1,364 unchanged — net +103**,
  median delta 0 lines. That is the **smallest net of the last five rungs**, and 265 is the **largest
  parted-EARLIER count anywhere in the ladder** (the previous high was 185). Against the baseline:
  1,295 later, 116 earlier — net +1,179, up from +1,161.
- Whole-game agreement **129 → 134**. Median first-divergence line 18 → 19, p75 41 → 42, p90 flat at 95.
- **THE TARGET FAMILY DID FALL, AND BY THE PREDICTED AMOUNT: `ordering` 440 → 315 games, −125**, and
  the `|-supereffective| <> |-damage|` shape the roadmap named is gone from its top causes entirely.
  What is left in `ordering` is sandstorm residual order (11), the Rough Skin toll (16, filed below)
  and `-unboost` body order (8).
- **AND `extra event emitted by medicham2` ROSE 140 → 266, +126, which is very nearly the same count.**
  Said rather than buried: the two are close enough that the honest reading is that a large part of the
  `ordering` fall was RECLASSIFIED rather than removed. The classifier decides between "same events,
  different order" and "we emitted something they do not have here" from the surrounding window, and
  the window is exactly what this wire changed. The paired count (+103) and the whole-game agreement
  (+5) are the figures that cannot be reclassified, and they are what the rung is worth.

### THE NEW TOP OF THE FILE, READ OFF THIS RUN'S OWN TOP RUNG

Largest single named cause is unchanged from WIRE 9: **`|-end|pXX|throatchop <> |upkeep`, 36 games**
(3,167 uses) — the Throat Chop silence expires and this engine announces nothing. Then
`|-activate|pXX|feint` 27 (437 uses) and `|-enditem|pXX|whiteherb` 8 (2,380). The `ordering` class is
no longer led by the spread-move shape; it is led by an 11-use sandstorm residual.

### FILED, NOT FIXED — three residual orderings, each staged in the authority rather than guessed

Mixing these in would have made the rung unattributable, which is the misattribution the ladder exists
to prevent. All three are order WITHIN a step, not the shape of the step list.

1. **THE CONTACT PUNISH IS PAID BEFORE THE DAMAGE AND SHOWDOWN PAYS IT AFTER THE SECONDARIES.**
   **CLOSED AT ROADMAP #81 WIRE 11, 2026-08-07 — the half about the DAMAGE. The half about the
   SECONDARIES is still open and is re-filed at the top of this file, together with the discovery that
   `buffsHolderOnHit` shares the same Showdown event and is in a different step here.**
   `runEvent('DamagingHit', …)` is the last thing `spreadMoveHit` does; this engine's punish block sits
   above `tg.curHP -= dmg`. Staged, Knock Off into a Rough Skin Garchomp:
   `|-damage|p2a: Garchomp|137/183` then `|-damage|p1a: Incineroar|149/170|[from] ability: Rough Skin`.
   It is 16 games of the surviving `ordering` class (`|-damage|pXX <> |-damage|pXX|[from]roughskin`,
   6,499 uses). Not moved because it changes SINGLE-TARGET order, which is the control.
2. **A MOVE-LEVEL `self` DROP IS EMITTED AFTER THE FAINT AND SHOWDOWN EMITS IT BEFORE.** `selfDrops` is
   step 4 and `faintMessages` runs after the loop. Staged, Make It Rain killing its first target:
   `-damage, -damage, |-unboost|p1a: Gholdengo|spa|2, |faint|p2a`. This engine writes the `-unboost`
   after the faint. Order only — the state is identical.
3. **THE RESIST BERRY IS SPENT IN THE APPLY STEP AND SHOWDOWN EATS IT INSIDE `getDamage`.** So on a
   spread move its `[eat]`/`[weaken]` pair falls between the damage lines instead of beside the
   effectiveness lines. Single-target order is unaffected, which is why it was left.

### Green, and what was NOT re-run

Run and green: `tests/test-mechanics.js` (270/271), `tests/probe_red_demo.js` (168/0),
`tests/test-engine-diff.js` (1/150, unchanged row), `tests/test-game-diff.js` (all five scripted games
AGREE for every turn), `tests/test-game-differential.js` (ALL PASSED), `tests/test-protocol-trace.js`
(ALL PASSED), `tests/test-charge.js` (18/0), `tests/test-medicham.js` (5/0),
`tests/test-engine-consistency.js`, `tests/test-priority-block.js`, `tests/test-choice-lock.js`,
`tests/test-dead-volatile.js` (15/0), `tests/test-forced-switch.js`,
`tests/test-no-silent-failure.js` (0 new), `engine/conformance.js` (RATCHET 96 baselined, **0 new**).

`tests/test-interaction-matrix.js` was run at its DEFAULT depth only — 350/354 live cases agree
(98.9%), and **all four partings are already in the published deep artifact** (`upperhand->steadfast`,
`yawn->insomnia`, `fakeout->shielddust`, `throatchop->shielddust`), so there is no new disagreement at
the depth that was run. It correctly REFUSED to overwrite the 1,643-case artifact with a 354-case one;
the published matrix figure is therefore still WIRE 9's and says so in its own stamp.

**RED AND NOT MINE, NAMED RATHER THAN FILED:** `node engine/status.js`'s FEATURE SEMANTICS CHECK fails
on eight features (`koTarget`, `dmgFrac`, `killIsRoll`, `killsThreat`, `switchSurvives1`,
`switchKOSlow`, `switchDiesFirst`, `screenValue`). It was red on eight before this session and is
recorded as such in the WIRE 9 entry below. Every one of them is damage-derived through `dmgRange`,
which this wire did not touch, and both damage instruments say damage did not move. It is a REFIT, it
belongs to MEASURE, and ENGINE may not run one — so it is reported, not filed.

### THE MEDIAN TURN, SAID PLAINLY — AND THIS IS THE STOP TEST'S ANSWER

**Ten rungs. ~1,180 net games parting later. Whole-game agreement 7 → 134. The median completed turn
has never left 1, including at the rung built specifically to move it.**

WIRE 9 predicted that the remaining mass was a SHAPE and that one restructure was worth more than the
next five mechanics. **The shape was real, it was fixed, and it bought +103 net games — the smallest
rung of the last five.** The prediction was wrong, and the way it was wrong is informative: the
`ordering` class fell by exactly what was forecast, and the median turn did not care.

**So the differential should stop being ground.** The reading is that the median game parts inside turn
one on something that is NOT a mechanic and NOT the hit shape — 1,863 of 1,997 games still diverge, on
1,421 distinct causes across 25 classes, with the largest single cause worth 36 games. **That is a long
tail with no head left.** Nine mechanic wires and one structural wire have taken the head off; what
remains is 1,400 causes each worth one or two games, and the arithmetic of that is that the next
mechanic is worth ~0.1% of the corpus.

Two things follow, and neither is another wire:

- **THE MEDIAN TURN MAY BE THE WRONG INSTRUMENT, AND THAT IS TESTABLE.** A game parting at line 19 of
  turn 1 and a game parting at line 95 of turn 1 are both "turn 1", and the line moved 13 → 19 while
  the turn sat still. If turn-1 line depth is what actually predicts whether a ROLLOUT is faithful,
  then the series has been succeeding against a statistic that cannot see it. Nobody has measured
  which of the two predicts rollout fidelity, and until somebody does, "the median turn is 1" is a
  fact whose CONSEQUENCE is unknown.
- **THE DIFFERENTIAL IS NOT THE ONLY INSTRUMENT AND IS NO LONGER THE SHARPEST.** The generated
  interaction matrix reaches 1,643 pairs and disagrees on 19; the mutation harness asks whether a
  handler MATTERS rather than whether it fires. Both are cheaper per finding than a rung that moves
  the corpus by five games.

**This is a clear negative on the largest structural target and it is worth more than another +300
net.** It is not a reason to stop fixing the engine; it is a reason to stop letting the whole-game
differential choose what gets fixed.

## ROADMAP #81 WIRE 9 + ROADMAP #84 — THE LARGEST SURVIVING CAUSE WAS NOT AN ANNOUNCEMENT BUG. A FIFTH OF EVERY DAMAGING CLICK IN THE FORMAT WAS A NO-OP TURN. 2026-08-07.

Census **265 live / 266 probed → 267 live / 268 probed** (it opened at 262/263; the three WIRE 9
probes and the two ROADMAP #84 ones were written RED first and are listed below). `missing` unchanged
at 1 (`needsTargetToAttack`). 0 hollow, 0 unarmed, 0 direct-call, 0 threw. `tests/probe_red_demo.js`
**157 → 164 demonstrations, 0 failed**, seven of them new.

### THE COLUMN ORDER, STATED BACK AND THEN STAGED

`classify()` returns `cause: cls + ' :: ' + gen(sdHead) + ' <> ' + gen(meHead)`
(`engine/game_differential.js:1145`). **LEFT IS SHOWDOWN, RIGHT IS MEDICHAM2.** So
`|-miss|p2a|p1a <> |-fail|p2a` reads *Showdown wrote `-miss` with a target; we wrote a bare `-fail`*
— the roadmap's reading, not WIRE 8's. It was not believed off the source: a case was staged and
`meRaw` read back as literally `|-fail|p2a: Charizard` against Showdown's
`|-miss|p2a: Charizard|p1a: Aerodactyl`.

### CLAIM 1 WAS TRUE AND WAS THE SMALL HALF. THE FAMILY IS A STATE BUG.

`playerAction`'s damaging branch was `if (mv && hasPower(mv) && target)`, because `dmgRange(me,
target, …)` needs a defender to price the click. **A spread move has no target to name.** Showdown's
own request carries no target field for `allAdjacentFoes` or `allAdjacent`, so every driver that asks
the authority what is legal correctly hands this engine a `null` — and the click then fell through the
entire status chain and came out as `{kind:'affect'}` (Heat Wave, Rock Slide, Snarl: anything with a
secondary, emitting the bare `|-fail|` the ladder saw) or `{kind:'pass'}` (Earthquake, Dazzling Gleam,
Make It Rain: emitting nothing at all).

**33 legal moves and 56,524 corpus uses — 20% of every damaging click in this format — dealing ZERO.**
Measured against the format rather than remembered:

| Showdown `target` | moves | corpus uses | this engine |
|---|---|---|---|
| `normal` / `any` | 282 | 237,947 | fine — the target is named |
| **`allAdjacentFoes`** | 19 | **47,549** | **no-op turn** |
| **`allAdjacent`** | 14 | **8,975** | **no-op turn** |
| `randomNormal` (Outrage) | 6 | 92 | still refused, now COUNTED |
| `scripted` (Mirror Coat) | 4 | 42 | still refused, now COUNTED |

It only reached the ladder as a PROTOCOL divergence because Mode A pins every sub-100-accuracy move to
MISS on both sides — so the 90-accuracy spread moves parted on a stream line while the 100-accuracy
ones (Earthquake 7,913 uses, Dazzling Gleam, Make It Rain, Discharge, Surf) were quietly dealing
nothing.

**AND IT HAD BEEN SEEN ONCE AND FILED AS A SCENARIO PROBLEM.** The ROADMAP #68 session recorded
*"Icy Wind was clicked with no target, so `playerAction` classified it as a non-attack and `-unboost`
never fired"* — under a heading saying the fault was the SCENARIO and not the trace (this file, the
protocol-trace section). Icy Wind is `allAdjacentFoes`. The observation was right and the diagnosis
inverted it.

**THE TURN LOOP NEVER NEEDED THE TARGET:** it resolves `targets = a.move.spread ? live(foes) : [aim]`,
so the aim is discarded for exactly this family. The fix reaches the board through `liveFoesOf()` — the
battle state is now stamped on the per-side object that already carries the party and the death counter
by reference — and prices `d`/`acc` against the body the move hits hardest, which is what
`targetForMove()` already does for the Choice lock. **A single-target click with no target is still
refused**, because Showdown rejects that choice and aiming it would invent a decision nobody made; it
is counted in `MEDFAILS.damagingClickWithoutTarget` rather than swallowed.

**The announcement half is real too and is now per target.** `hitStepAccuracy` writes
`add('-miss', pokemon, target)` inside the per-target loop (`sim/battle-actions.ts:738`); this engine
wrote one line with an EMPTY target field. **The one-roll-per-move divergence is unchanged and is not
widened** — with a single roll every target missed, so the list is complete.

### CLAIM 2 — ROADMAP #84. THE ENGINE COULD NOT REPRESENT THE SPLIT, AND THE REASON IS WORSE THAN ONE BOOLEAN.

**IT STORED NOTHING.** Not one boolean, not a field. `moveResult` appears in `medicham2-browser.js`
exactly once, inside a comment. Established by reading the state, not by inferring it from output —
grep for `moveResult|_failed|Failed|_moveOK|_didMove|_acted` returns the comment and a `forbidTableFailed`
counter, and nothing else. So Stomping Tantrum was wrong in **one** direction only: it never doubled
(3,545 corpus uses), and it was wrong SILENTLY, because `variablePower` was consumed under
`if (_vp && _vp.kind)` and twelve moves carry the tag with no `kind` at all — the unknown-kind counter
beside it is gated on the same field, so the whole family was skipped without incrementing anything.

Every member was checked INDIVIDUALLY against its own handler, and the split is not "was I stopped"
versus "did I choose":

| returns | members, each with its line |
|---|---|
| **`false` — COUNTS** | flinch (`conditions.ts:205`), full paralysis (`:43`), freeze (`:104`), sleep (`:76`), Taunt / Throat Chop / Disable (`moves.ts`), no PP (`battle-actions.ts:285`), a `beforeMoveCallback` (`:274`), **a MISS**, a type immunity — anything reaching `trySpreadMoveHit` with an explicit failure |
| **`null` — DOES NOT** | recharge (`conditions.ts:372`), and **PROTECT**, which is the counter-intuitive one: protect's `onTryHit` returns `this.NOT_FAIL` — the empty string (`battle.ts:272`) — which is falsy but is not `false`, so `atLeastOneFailure` stays false and `battle-actions.ts:616` writes null |

So **a Stomping Tantrum thrown into a Protect does NOT double next turn and one that MISSED does.**
Sleep is in the `false` group but a `sleepUsable` move returns `undefined`, which leaves the event's
relayVar `true` and is a different branch entirely; that is why each was read rather than grouped.

`_mvRes` / `_mvResLast` now carry the three states, roll over at the turn boundary exactly as
`nextTurn` does (`battle.ts:1671`), and are cleared on switch-out as `clearVolatile` does
(`pokemon.ts:1551`). **The twenty-one `if(TR)TR.fail(m)` sites became `mvFail(m)`**, because a move
result is state and recording it inside the announcement would have made the mechanic depend on
whether a trace was attached — this repo's own "capability that cannot prove it ran", inverted.

**NAME-WIRED, AND THE MEMBERSHIP WAS PRINTED BEFORE THE NAMES WERE TYPED.** `moveLastTurnResult === false`
appears exactly **twice** in `data/moves.ts` — `stompingtantrum` (18048) and **`temperflare`** (19184,
48 uses), which the brief did not name and which is the same handler written twice. There is no shape
to match on: both carry `variablePower {computed:true, note:"idiom not yet derivable"}` **and so do ten
others** — ragefist, assurance, avalanche, **lastrespects (5,248 uses)**, payback, risingvoltage, round,
spitup, tripleaxel, watershuriken. Matching the shape would have doubled Last Respects after any failed
turn. Stated rather than fixed: the **Metronome item** (`items.ts:4010`, legal here) reads the same
field as a TRUTHY test for its consecutive-use counter; this engine has no Metronome item, and the
state it would need now exists.

### TWO MORE, TAKEN BECAUSE THIS WIRE OPENED THEM

Both were unreachable while the family was a no-op, and both appeared in the ladder the moment it
started resolving:

- **Wide Guard named NOBODY.** `|-activate||move: Wide Guard` — the engine emptied its target list and
  then wrote the line. Showdown's `add('-activate', target, 'move: Wide Guard')` fires inside the
  per-target TryHit event, so there is one line per shielded body. It opened a whole new divergence
  class (`-activate: a different body`, 18 games) on the first WIRE 9 rung; the class is gone.
- **A QUAKE HITS YOUR OWN PARTNER FIRST.** `getMoveTargets` (`sim/pokemon.ts:809`) builds an
  `allAdjacent` list `push(...adjacentAllies())` and only then falls through to `push(...adjacentFoes())`.
  Staged in the authority rather than read off the switch statement:
  `|move|p1a: Garchomp|Earthquake|p2b: Tyranitar|[spread] p1b,p2a,p2b`. This engine appended the ally
  LAST. `|-immune|pXX <> |-supereffective|pXX` went 0 → 20 and `|-immune|pXX <> |-damage|pXX` 4 → 21 on
  the first rung, which is what named it.

### THE FIVE PROBES AND THE SEVEN RED DEMONSTRATIONS

Every demonstration is source-reverted (`demoSource`) and every one flipped.

| probe | asserts | the arm that stops it being vacuous |
|---|---|---|
| `move\|spreadFoes` — *a targetless spread click still hits both foes* | both foes' HP | the arms are the SINGLE-target click against the spread one, both with the target withheld. The named-vs-withheld claim is an EQUALITY, so using it as the arms would be hollow; the Shadow Ball arm is the **opposite-sign guard** — an engine that started aiming every targetless click would make it non-zero |
| `move\|spreadFoes` — *a miss names every target it missed* | the `-miss` lines' SHAPE, four fields with a foe slot in the fourth | the control is the same click on a WINNING roll — no `-miss` and real damage. A count-only assertion would pass on a bare `\|-miss\|p1a: X` |
| `move\|oneTurnGuard` — *Wide Guard names each body it shielded* | one line per body, and zero damage beside it | the same click with no Wide Guard: no lines and real damage, so "no lines" cannot come to mean "no block" |
| `move\|spreadAll` — *a quake resolves ally-first* | the `-damage` order `p1b,p2a,p2b` | a `spreadFoes` move on the same board must stay `p2a,p2b` — without it this passes on an engine that reversed every target list |
| `move\|variablePower` — *a FLINCHED Tantrum doubles and a RECHARGING one does not* | the HP the turn-2 Tantrum takes: 101 / 200 / 101 | three arms, and the third is the whole of #84. Two demonstrations carry **opposite signs**: one reverts the flinch site (the flinched arm must stop doubling) and one reverts recharge from `null` to `false` (**the recharged arm must stop reading 75**) — which is the obvious wrong fix, one boolean for "my move did not happen", stated as such |

### THE CONTROLLED TABLE — 13 arms × 1,996 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`, census pinned to `data/wire-ladder-census.pin.json`
(`f63179105d3c`), release **`86048ca3a422`**. The baseline ran first and last with eleven arms between
and **reproduced EXACTLY** — every measured field identical and the per-game divergence depth identical
game for game.

**THE WHOLE LADDER WAS RE-RUN, SO EVERY NUMBER BELOW INCLUDING WIRE 8's IS FROM THIS RUN.** Do not
compare a figure here against the one published beside WIRE 8: the game store grew (7,375 → 7,401
teams, 1,995 → 1,996 games) and every arm moved slightly. Comparing across the two runs is the
uncontrolled-pair mistake `wire_ladder.js` exists to prevent.

| arm | div/1996 | agreed whole | classes | causes | moves | **median line** | p75 | p90 | mean |
|---|---|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1991 | 5 | 20 | 1141 | 228 | 13 | 18 | 30 | 15.11 |
| WIRE 7 | 1943 | 53 | 21 | 1284 | 267 | 16 | 29 | 85 | 28.16 |
| WIRE 8 | 1903 | 93 | 21 | 1363 | 268 | 16 | 37 | 95 | 31.62 |
| **WIRE 9** | **1859** | **137** | 22 | 1292 | **269** | **18** | **41** | 95 | **33.11** |
| baseline, REPEATED | 1991 | 5 | 20 | 1141 | 228 | 13 | 18 | 30 | 15.11 |

- **THE MEDIAN COMPLETED TURN IS STILL 1, AT EVERY RUNG INCLUDING THIS ONE. NINE WIRES HAVE NOT MOVED
  IT.** Said first, because it is the number the ladder exists to refuse to soften. What that means is
  below.
- **THE MEDIAN FIRST-DIVERGENCE LINE MOVED, 16 → 18** — it had stood at 16 through WIRE 8. p75 37 → 41,
  mean 31.62 → 33.11, p90 flat at 95.
- **NET, THE ONLY HONEST FORM.** Against the baseline: **1,275 later, 123 EARLIER, 598 unchanged — net
  +1,152**, median delta **3** lines (WIRE 8 was +1,050 at 1 line). Against WIRE 8: **506 later, 163
  earlier, 1,327 unchanged — net +343**, the largest single-rung net since WIRE 7.
- **WHOLE-GAME AGREEMENT 93 → 137 of 1,996**, the largest single-rung gain in the series.
- **`event missing from medicham2` 672 → 522.** `-damage field 3` 276 → 336 and `ordering` 243 → 451,
  both UP: games that survive further reach bugs the earlier arms never got to, and the ordering rise
  is named below rather than left as a shrug.

### WHAT ACTUALLY MOVED — counted in the arms' own cause lists, this run

| family (occurrences at the top rung) | baseline | WIRE 7 | WIRE 8 | **WIRE 9** |
|---|---|---|---|---|
| `\|-miss\|ATT\|TGT <> \|-fail\|ATT` | 42 | 69 | 96 | **5** |
| anything `<>` a `-fail` of ours | 226 | 197 | 233 | **88** |
| `wideguard` | 12 | 35 | 41 | **28** |
| `throatchop` | 14 | 46 | 51 | 52 |
| `feint` | 25 | 32 | 29 | 29 |
| `whiteherb` | 29 | 36 | 37 | 35 |

The target family is cleared. The five that survive are alignment offsets against an unrelated line,
not the shape itself.

### THE NEW TOP OF THE FILE, READ OFF THIS RUN'S OWN TOP RUNG

Largest single named cause: **`|-end|pXX|throatchop <> |upkeep`, 37 games** (3,167 uses) — the Throat
Chop silence expires and this engine announces nothing. Then `|-enditem|pXX|whiteherb` 30 (2,380 uses)
and `|-activate|pXX|feint` 25 (437).

**But the largest ROOT is bigger than any of them and this wire diagnosed it without fixing it.**
`ordering :: |-supereffective|pXX|1 <> |-damage|pXX|H/H` is **45 games**, and it is one root with three
more shapes beside it — `|-immune| <> |-miss|` 31, `|-damage| <> |-damage|…roughskin` 28,
`|-resisted| <> |-damage|` 19, `|-immune| <> |-damage|` 17. **Showdown resolves a spread move in STEPS
ACROSS ALL TARGETS; this engine resolves it TARGET AT A TIME.** Staged in the authority, an Earthquake
into three bodies:

```
|-supereffective|p1b: Incineroar|1     <- every effectiveness line first
|-supereffective|p2b: Tyranitar|1
|-damage|p1b: Incineroar|38/170        <- then every damage line
|-damage|p2a: Milotic|104/170
|-damage|p2b: Tyranitar|77/175
```

medicham2 emits `SE(a) DMG(a) SE(b) DMG(b)`. That is `spreadMoveHit`'s step list
(`sim/battle-actions.ts`) against this engine's per-target loop, and it is **a restructure of the hit
loop, not a wire** — which is exactly why it is written here with its measurement rather than started.
Combined the family is **>110 games**, larger than throatchop by a factor of three, and it is the
recommended next target.

### THE MEDIAN TURN, SAID PLAINLY

**Nine wires, ~1,150 net games parting later, whole-game agreement 5 → 137, and the median completed
turn has never left 1.** That is not a failure of the wires and it is not noise: the median game still
parts inside turn one, and every one of the nine has moved the LINE the game parts on (13 → 18) while
leaving the TURN alone. The two facts are consistent and the reading is this — **the remaining
divergences are dominated by things that happen within the first turn's own event stream**, which is
where the ordering family above lives. A per-target loop against a per-step one parts on turn 1 of
almost any doubles game with a spread move in it, however many mechanics are right.

**So the grind should continue, but the next item is not another mechanic.** Eight of the nine wires
fixed a MECHANIC; the ladder says the remaining mass is a SHAPE — how a hit is sequenced — and one
restructure of `trySpreadMoveHit`'s equivalent is worth more than the next five mechanics. If that
lands and the median turn is still 1, that is the point to stop grinding the differential and say so.

### Green, and what was NOT re-run

Run and green: `tests/test-mechanics.js` (267/268), `tests/probe_red_demo.js` (164/0),
`tests/test-charge.js` (18/0), `tests/test-medicham.js` (5/0), `tests/test-game-diff.js`,
`tests/test-game-differential.js` (ALL PASSED), `tests/test-protocol-trace.js` (ALL PASSED),
`tests/test-engine-consistency.js`, `tests/test-no-silent-failure.js` (0 new; 1 baselined block now
speaks), `tests/test-engine-diff.js` (1/150 disagree, unchanged), `engine/conformance.js`
(RATCHET 96 baselined, **0 new**).

**A LADDER RUN WAS VOIDED AND IS REPORTED RATHER THAN DROPPED.** The first attempt at the WIRE 9
table was destroyed mid-run: OPS's ingest appended to `data/games.bo3.jsonl` at 13:01:49, the team
pool digest moved `4f9002f01f7c → deb14a3d200e` between two arms, and `arms_comparable` REFUSED all
twelve. `data/wire-ladder.json` was written with `determinism.verdict: "THE TWO BASELINES DISAGREE. Do
not read the table below as a ladder."` — the instrument doing its job, and the CLAUDE.md photograph
rule arriving through the one door a frozen engine release cannot close: **the release freezes the
engine, and the game store is not in it.** The table above is the clean re-run.

**Also fixed in `engine/wire_ladder.js`:** the drift check named `'a01-baseline-run1'` and
`'a12-baseline-run2'` as literals, and inserting a rung ahead of the repeated baseline renamed the
second one. The two baseline arms are now DERIVED (the two arms on the baseline release, refusing if
there are not exactly two) — the same defect WIRE 8 found in the hard-coded `'a09-wire6'`, one
function over.

**NOT re-run, and named rather than inherited as passing:** `tests/test-prng.js`,
`tests/test-stadium-roster.js`, `engine/provenance.js --strict`, `tests/test-site-data-fresh.js`, and
`node engine/status.js`'s FEATURE SEMANTICS CHECK, which was failing on eight features before this
session and was not touched.

## ROADMAP #81 WIRE 8 — TWO FAMILIES, ONE OF THEM A REAL DAMAGE BUG, AND THE LADDER'S OWN "WHAT REMAINS" LIST WAS READING THE WRONG ARM. 2026-08-07.

Census **258 live / 259 probed → 262 live / 263 probed.** Four new probes, all LIVE; `missing` is
unchanged at 1 (`needsTargetToAttack`). 0 hollow, 0 unarmed, 0 direct-call, 0 threw — every ratchet
held. `tests/probe_red_demo.js` **151 → 157 demonstrations, 0 failed**, six of them new.

### FAMILY A WAS A STATE BUG, NOT AN ANNOUNCEMENT BUG, AND THE ARTIFACT HAD THE TWO COLUMNS THE OTHER WAY ROUND

The roadmap read the cause `|-fail|p2b <> |-sidestart|p2:|tailwind` as *"we `-fail` a side condition
Showdown sets"*. It is the opposite: `classify()` writes `SD <> ME`
(`engine/game_differential.js:1145`), so **Showdown FAILS the second Tailwind and this engine SET
it.** Established by staging it in both engines rather than by re-reading the string — the same
scenario played through `playGame` shows Showdown writing `|-fail|p1a: Whimsicott` where medicham2
writes a second `|-sidestart|p1: |move: Tailwind`.

**And a second `-sidestart` is not a spare line, it is a reset clock.** `Side.addSideCondition`
(`sim/side.ts:420`) returns `false` when the condition is already present and declares no
`onSideRestart`; **measured over the format, none of tailwind / reflect / lightscreen / auroraveil /
safeguard / stealthrock / stickyweb declares one, and exactly two do — spikes (cap 3) and toxicspikes
(cap 2).** This engine wrote `field.twA=4` and `sf.scrP=turns` unconditionally, so a side that
re-clicks Tailwind or Reflect once a turn keeps it **forever**. That is a damage and a speed bug for
the rest of the game, which is why both probes read HP and Speed and neither reads a protocol line.

### THE SCREENS BECAME THREE NAMED CONDITIONS, BECAUSE THE DUPLICATE QUESTION CANNOT BE ASKED OF A CATEGORY

`sf.scrP` / `sf.scrS` were two counters keyed by damage CATEGORY. Three defects fell out of that one
representation and only the first was on the roadmap:

| | |
|---|---|
| **it cannot answer "is Reflect already up"** | which is the duplicate check itself |
| **an expiring Aurora Veil announced a Reflect AND a Light Screen** | the companion cause the roadmap spotted (`\|-sideend\|p2: \|Aurora Veil <> \|-sideend\|p2: \|Reflect`). It was not "the state is confused" — it was that this engine had no name to announce |
| **two overlapping screens with different expiries were unrepresentable** | `tests/test-game-diff.js` had to collapse the reference side with a `Math.max` and said so. Both halves of that approximation are now gone and the comparison is exact, with `auroraveil` compared as its own third clock |

`sf.sc` is keyed by the MOVE ID, so the announcement is the move's own name and the category comes
from that move's own `halvesDamage` tag. **No screen is named anywhere in the engine.** The iteration
order is derived too: Brick Break walks `['reflect','lightscreen','auroraveil']`
(`data/moves.ts:1833`) and the residual sub-orders are 1, 2 and 10 in that same sequence — sorting on
`halvesDamage.category` (Physical, Special, both) reproduces it without writing a name down.

**WHAT WAS DELIBERATELY NOT CHANGED:** one multiplier however many screens are up. Showdown chains a
second `onAnyModifyDamage` when a Reflect and an Aurora Veil overlap; this engine has always applied
the reduction once and still does. Folding a damage change into a representation change would make
the ladder unable to say which did what.

### FAMILY B WAS BOTH, AND THE STATE HALF COSTS 49% OF A HIT

Every one of the **ten** `chargeTurn` moves in this format — solarbeam, electroshot, phantomforce,
solarblade, meteorbeam, skyattack, dig, dive, bounce, fly, all `LEGAL`, checked against
`gen9championsvgc2026regmb` rather than remembered — carries the same handler shape, and
`this.add('-prepare', ...)` is the **first** line of it, above the boost, above the weather test and
above the `ChargeMove` event (verified on all ten: the `-prepare` index precedes the `ChargeMove`
index in every one). This engine had the whole wind-up inside the "we are charging" branch:

| | defect | evidence |
|---|---|---|
| **order** | the `\|-boost\|` was written above the `\|-prepare\|` | `data/moves.ts:4644` — announce, then boost |
| **announcement** | a SKIPPED charge announced nothing at all | Solar Beam in sun: Showdown writes `\|-prepare\|` and then hits; medicham2 just hit |
| **state** | **a rain Electro Shot fired with NO +1 Special Attack** | staged against the official engine before a line changed — Archaludon into a Snorlax under Drizzle, **Showdown 97, medicham2 65**. After: 97 |

The roadmap's framing — *"two-turn moves emit no `-prepare`"* — is true only of the skipped case.
Staged clean, medicham2 emitted `|-prepare|solarbeam` correctly on a normal charge turn all along;
what it never emitted was the wind-up it did not spend a turn on.

**POWER HERB IS `isNonstandard: 'Past'` IN CHAMPIONS.** Asked of the format, not remembered. Its
branch is kept correct (the `|-enditem|` now follows the announcement and the boost, which is where
`onChargeMove` sits) and **no probe is written for it**, because a probe on an unreachable item is a
census row that cannot fail.

### THE FOUR PROBES AND THE SIX RED DEMONSTRATIONS

Every demonstration was run against a **source-reverted** engine (`demoSource`), and every one flipped.

| probe | what it asserts | the arm that stops it being vacuous |
|---|---|---|
| `move\|doublesSideSpeed` — *a second Tailwind does not extend the first* | the partner's SPEED at the start of turn 5 | the assertion is an EQUALITY, so a third arm plays **the identical turn-2 click alone** and must still be fast. Without it, "the two arms agree" is also what an engine with no Tailwind at all prints |
| `move\|halvesDamage` — *a second Reflect does not extend the first* | the DAMAGE a turn-6 Earthquake deals | the same shape: the turn-2 click alone halves turn 6, so the measurement is shown able to see the extension before it is used to claim there was none |
| `move\|halvesDamage` — *Aurora Veil still goes up on a side that already has Reflect* | the SPECIAL damage starts being halved and the physical does not move | **the over-match guard, and its claim has the opposite sign.** The obvious wrong fix is a check per damage CATEGORY; it passes the two probes above and stops an Aurora Veil ever landing beside a Reflect. Its known-bad engine is that wrong fix, stated as such rather than argued about |
| `move\|chargeTurn` — *Electro Shot keeps its +1 Special Attack when rain skips the charge* | 185 damage in rain, +1 stage, and 0 on a dry turn-1 | the control is the same click **from −1**, which nets zero and deals 123. An engine that skipped the boost prints the two arms EQUAL |

Two of the six demonstrations are STREAM claims and are labelled as such at the line, because the
state really is identical either way: an expiring Aurora Veil falls on the same turn whichever name
it announces, and Solar Beam in sun deals the same 160 with or without its `|-prepare|`.

### THE CONTROLLED TABLE — 12 arms × 1,995 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`, census pinned to `data/wire-ladder-census.pin.json`
(`f63179105d3c`), release `dd3da7c69cb0`. **The baseline ran first and last with ten arms between and
reproduced EXACTLY** — every measured field identical AND the per-game divergence depth identical
game for game. The whole ladder was then run a **third** time end to end after the instrument edits
below, and every arm reproduced to the digit.

| arm | div/1995 | agreed whole | classes | causes | moves | **median line** | p90 | mean |
|---|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |
| WIRE 6 | 1962 | 33 | 25 | 1174 | 263 | 14 | 55 | 23.36 |
| WIRE 7 | 1931 | 64 | 25 | 1261 | 267 | 16 | 89 | 27.75 |
| **WIRE 8** | **1893** | **102** | 27 | 1355 | **269** | **16** | **94** | **31.00** |
| baseline, REPEATED | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |

- **THE MEDIAN COMPLETED TURN IS STILL 1, AT EVERY RUNG INCLUDING THIS ONE.** Eight wires have not
  moved it. That is the headline the ladder was built to refuse to soften.
- **THE MEDIAN FIRST-DIVERGENCE LINE DID NOT MOVE EITHER — 16, the same as WIRE 7.** The mean went
  27.75 → 31.00 and p75 28 → 35, so the tail lengthened and the middle did not. Said plainly rather
  than quoting the mean on its own.
- **NET, WHICH IS THE ONLY HONEST FORM.** Against the baseline: **1,183 later, 154 EARLIER, 658
  unchanged — net +1,029** (WIRE 7 was +882). Against WIRE 7: **415 later, 182 earlier, 1,398
  unchanged — net +233**.
- **WHOLE-GAME AGREEMENT 64 → 102 of 1,995.** The largest single-rung gain in the series.
- **`-damage field 3` 257 → 290 and distinct causes 1,261 → 1,355, both UP** — games that survive
  further reach bugs the earlier arms never got to. `event missing from medicham2` fell 677 → 653,
  which is the `-prepare` family emptying.

### WHICH OF THE TWO ACTUALLY MOVED ANYTHING — counted in the arms' own cause lists

Occurrences at the top rung, WIRE 7 → WIRE 8:

| family | WIRE 7 | WIRE 8 |
|---|---|---|
| `\|-prepare\|`, any slot, any move | 141 | **0** |
| `solarbeam` | 107 | 26 |
| `electroshot` | 68 | 10 |
| `tailwind` | 94 | 27 |
| `-sidestart` | 142 | 18 |
| `lightscreen` / `reflect` / `auroraveil` | 23 / 31 / 23 | 5 / 6 / 13 |
| `-sideend` | 4 | **11 — UP, and named below** |

**`-prepare` reaches zero.** Nothing else does. What survives in the other rows is downstream: every
remaining `solarbeam` and `tailwind` row is an alignment offset against an unrelated `|-immune|` line,
and the surviving `-sidestart` rows are **hazards**, not screens.

### The boundaries — measured, declared, NOT fixed

- **THE HAZARD HALF OF FAMILY A IS NOT DONE, and the reason is not a judgement call.** Stealth Rock
  and Sticky Web declare no `onSideRestart`, so a second lay FAILS exactly like a Tailwind; Spikes and
  Toxic Spikes DO, capped at 3 and 2. **The cap is not in `data/tags.json`** — the move's `hazard`
  param carries only `{hazard:'spikes'}` — and `data/tags.json` **cannot be safely regenerated**
  (ROADMAP #65, below: five entities would silently drop out of the engine's knowledge). Refusing all
  four duplicates would break Spikes' second and third layer. It reads **6 games across 5 causes** at
  the top rung (`|-fail| <> |-sidestart|p2:|stealthrock`, `…|stickyweb`) and is left alone with the
  reason.
- **THE SIDE RESIDUAL SUB-ORDER IS NOT MODELLED.** Showdown's are reflect 1, lightscreen 2, tailwind
  5, auroraveil 10, and its per-Pokémon items sit at a different order entirely. This engine ticks
  Tailwind as a FIELD counter above the per-body loop, so a Leftovers heal and a `-sideend` on the
  same turn come out in the wrong order. That is **6 of the 11** `-sideend` occurrences — five
  distinct causes, four of the shape `|-heal|…leftovers <> |-sideend|…` and one
  `|-damage|…sandstorm <> |-sideend|…`; the other five rows are alignment offsets against an
  unrelated line. Splitting the two sides' residuals apart is a restructure, not a wire. **Declared at
  the line in the source.**
- **AURORA VEIL AND REFLECT DO NOT STACK HERE.** One multiplier however many screens cover the
  category, unchanged from before this wire — see above.

### THE LADDER'S OWN "WHAT REMAINS" BLOCK WAS TWO RUNGS STALE, AND WIRE 7 PUBLISHED FROM IT

`engine/wire_ladder.js` built `what_remains_at_the_top_rung` from a **hard-coded `'a09-wire6'`**. So
the surviving-cause list published beside WIRE 7 was WIRE 6's, and it still named **251 hospitality
rows that WIRE 7 had taken to zero**. The roadmap for this wire was written off that block, which is
why it opened with a Tailwind cause at 20 games and a claim that nothing parts more than 3.

Found by reading this wire's own output and noticing hospitality in it. The top rung is now
**derived** — the last arm that is not the repeated baseline — and the artifact carries a `top_rung`
block naming the arm, label and release it came from, so a stale read cannot happen silently again.
This is `docs/LESSONS.md`'s own lesson wearing an instrument's hat: **a name typed into a generator
goes stale the moment the thing it names moves.**

### THE TAIL IS NOT FLAT, AND THAT WAS AN ARTEFACT OF THE STALE BLOCK

The brief asked for a clear negative if the top surviving cause were still 3 games. It is not. With
the top rung read correctly, the largest single cause at WIRE 8 is:

```
32  unrelated event mismatch :: |-miss|p1b|p2a <> |-fail|p1b
26  unrelated event mismatch :: |-miss|p2a|p1a <> |-fail|p2a
24  unrelated event mismatch :: |-miss|p1a|p2a <> |-fail|p1a
23  unrelated event mismatch :: |-miss|p2b|p1a <> |-fail|p2b
```

One shape in four slot spellings, **114 games** — Showdown writes `|-miss|ATTACKER|TARGET` where
medicham2 writes a bare `|-fail|ATTACKER` (`|-miss|p2a: Charizard|p1a: Primarina` against
`|-fail|p2a: Charizard`). **It is pre-existing and it grows with trajectory depth: 41 games at the
baseline, 55 at WIRE 6, 83 at WIRE 7, 114 here.** It is the single largest thing left in the file by a
factor of two and **it is NOT diagnosed** — saying which move and which branch needs its own staging,
and this wire did not do it. Behind it: `-end|throatchop` (30 games, 3,167 uses), `-activate|feint`
(25, 437), `-enditem|whiteherb` (10 games, 2,380 uses — the roadmap's "also in range" item, which is
NOT on the same code path as either family and was not taken), and the sandstorm/Intimidate residual
orders at 10 each.

**So the recommendation is to keep going, but not by ranking causes off the artifact's top-5 lists
again.** Two of the last three wires were aimed by a block that was describing a different engine.
The next target should be picked off a freshly-read top rung, and the `-miss <> -fail` family is it.

### Instruments that moved BECAUSE the engine got better, and are fixed here

- **`tests/test-game-differential.js` — 2 FAILURES, both good news, both closed.** The Electro Shot
  DIRECTED scenario stopped diverging, so it now declares `expect: 'agree'` with a `closed_by` and
  will fail just as loudly if it re-opens. That took the `ordering` acceptance test back to one
  scenario, **and the bar was not lowered** — a replacement was staged from the ladder's own largest
  surviving `ordering` cause (`|-damage|p1b|[from]sandstorm <> |-damage|p1a|[from]sandstorm`, 10
  games): Showdown's residual is speed-sorted across every body on the field, medicham2 walks its own
  slots, and four Protects make it deterministic. It parts exactly as predicted. This is the SECOND
  time this scenario has had to be restaged for this reason, and that is the acceptance test working.
- **`tests/test-game-diff.js`** now compares three named screen clocks instead of two category
  counters, on BOTH sides. Its planted-divergence proof — which is literally an injected extra turn of
  Tailwind — still fires at the turn it was planted, and all five scripted games agree throughout.

### Green, and what was NOT re-run

Run and green: `tests/probe_red_demo.js` (157/0), `tests/test-mechanics.js` (262/263), `tests/
test-charge.js` (18/0), `tests/test-medicham.js` (5/0), `tests/test-engine-diff.js` (1/150 disagree,
unchanged), `tests/test-game-diff.js`, `tests/test-game-differential.js` (ALL PASSED),
`tests/test-protocol-trace.js` (ALL PASSED, `traceBodyOffField = 0`), `engine/conformance.js`
(RATCHET 96 baselined, **0 new**).

`tests/test-interaction-matrix.js --full`: **1,557/1,574 (98.9%) — identical to WIRE 7**, and the
SHRINK GUARD still refuses to publish against the artifact's 1,643. Unchanged and still not this
wire's: the LIVE/INERT split is decided by the REFERENCE engine's two arms.

`node engine/status.js` still opens with **FEATURE SEMANTICS CHECK FAILED on the same eight features**
— `switchSurvives1`, `switchKOSlow` and `switchDiesFirst` carry byte-identical digests to the ones
recorded for ROADMAP #31 below, and the count did not change. A refit is MEASURE's.

**NOT re-run, and named rather than inherited as passing:** `tests/test-prng.js`,
`tests/test-stadium-roster.js`, `engine/provenance.js --strict`, `tests/test-site-data-fresh.js` and
the three `run-all`-only failures WIRE 7 recorded. None of them is ENGINE's and none was touched, but
this wire did not run them and does not claim their state.

## ROADMAP #81 WIRE 7 — SIX MECHANICS IN ONE BATCH, AND THE MEDIAN FIRST-DIVERGENCE LINE MOVED FOR THE FIRST TIME. 2026-08-07.

Census **251 live / 252 probed → 258 live / 259 probed.** Seven new probes, all LIVE; the one MISSING
row (`needsTargetToAttack`) is unchanged. 0 hollow, 0 unarmed, 0 direct-call, 0 threw — every ratchet
held. `tests/probe_red_demo.js` **142 → 151 demonstrations, 0 failed**, nine of them new.

**A BATCH BECAUSE SIX SEPARATE WIRES WERE NOT PAYING.** `data/wire-ladder.json` replayed all six of
the night's wires over 1,995 games under one pinned census and the median completed turn before
divergence never moved off 1 at any rung. These seven targets are ABSENT OR MISORDERED MECHANICS
rather than roots to be found, so they went together and were measured once.

### What was measured BEFORE anything was wired, and what the measurement changed

**Two of the roadmap's seven targets did not survive contact with the authority's source, and saying
so is half the result.**

| # | roadmap's claim | what the authority actually says |
|---|---|---|
| 2 | **FOCUS SASH NEVER ENDS** — 14,668 uses, "the heaviest entity in the whole artifact" | **NO DEFECT. Not wired, and nothing was changed for it.** Staged in both engines: Showdown writes `\|-enditem\|Focus Sash` then `\|-damage\|1/103`, and so does medicham2 — same order, same 1 HP, same spent item. Ranked by ITEM USAGE, not by divergence: the ladder's own cause list carries **one** `focussash` row at the top rung and it is `ordering :: \|-damage\| <> \|-enditem\|focussash\|[from]knockoff` — the Knock Off bug wearing a Sash. It fell 7 → 3 anyway, as a consequence of the Knock Off ordering fix |
| 5 | **RAGE POWDER / FOLLOW ME BEATING A TYPE IMMUNITY** | **THE DIAGNOSIS IS WRONG.** `onFoeRedirectTarget` (data/moves.ts) is gated on `validTarget` and, for Rage Powder alone, on `runStatusImmunity('powder')` — which this engine already asks. Redirection is not gated on type immunity in either engine and both draw correctly. The defect was the ANNOUNCEMENT, and it was the opposite of what was filed: medicham2 wrote an `\|-activate\|move: followme` that Showdown never writes, and did NOT write the `\|-activate\|ability: Lightning Rod` that it does |
| 7 | **SHED TAIL** — "Showdown starts a Substitute; we take the HP loss and make none" | **STALE.** WIRE 130 landed `grantSubstitute` and the doll has been built since. What was wrong was the ORDER and the ROUNDING, and what is still wrong is the SELF-SWITCH — see the boundaries below |

### The six that landed, each with the source line it was read from

| | defect | authority |
|---|---|---|
| **1** | **Hospitality announced a heal onto a full-HP partner, and announced an `\|-ability\|` it never has.** 5,779 uses and the single largest cause at the top rung — 127 games across two divergence classes | `Battle.heal()` returns **before** it announces: `if (target.hp >= target.maxhp) return false;`. And `hospitality`'s handler is a bare `for (const ally of pokemon.adjacentAllies()) this.heal(...)` with no `this.add('-ability')` in it, unlike Intimidate |
| **2** | **Knock Off stripped the item BEFORE the damage** — ROADMAP #80's open half, whose damage claim was retracted | `onAfterHit` runs after. Staged: `\|-damage\|p2a: Gengar\|0 fnt` → `\|-enditem\|Life Orb\|[from] move: Knock Off` → `\|faint\|`. `takeItem` has **no hp test at all**, so a body reduced to 0 still loses it — the faint is announced last |
| **3** | **A mega stone could be knocked off the body it belongs to** | `onTakeItem(item, source) { return !item.megaStone?.[source.baseSpecies.baseSpecies] }`. **MEASURED over the format**: exactly **75** legal items declare an `onTakeItem` and **all 75 are mega stones** — no Z-crystal, no plate, no Griseous Orb in Champions. This is a STATE bug: the body could not mega for the rest of the battle |
| **4** | **A self-eaten resist berry was recorded as KNOCKED OFF, and wrote one line where Showdown writes two** | Colbur is `onSourceModifyDamage` — it fires INSIDE the calculation, so `onAfterHit` finds nothing. `eatItem()` writes `[eat]` and the handler then writes `[weaken]`. Harvest, Recycle, Belch, Cud Chew and Unburden all read that difference |
| **5** | **The pinch and status berries fired only at the RESIDUAL** — Sitrus is 13,079 uses | They are `onUpdate`, and `Battle.eachEvent('Update')` runs after **every action** plus once inside `spreadMoveHit` right after the damage. So the berry is eaten BETWEEN the two attackers of a double |
| **6** | **The substitute doll was a floored quarter, its `-start` came after the `-damage`, and a second `-start` was emitted** | `this.effectState.hp = Math.ceil(target.maxhp / 4)` while the cost is `directDamage(maxhp / 4)`, which truncs — **ceil for the doll, floor for the cost, one rule for both members**. `moveHit` adds `volatileStatus` and only then calls `onHit`, where the `directDamage` lives |
| **7** | **Protean converted AFTER the move resolved, so it was worth exactly zero on offence** | `onPrepareHit` fires at `battle-actions.ts:591`, **above the whole eight-step hit list** — before invulnerability, before the TryHit that Protect answers, before type immunity and before the accuracy roll |

**PROTEAN'S OFFENSIVE HALF WAS WORTH NOTHING AND THE OLD COMMENT SAID SO WITHOUT MEANING IT.** WIRE 54
placed the conversion below every branch of the resolved move and called it "the wrong order by a
hair", on the belief that moving it would mean re-pricing `d`. `d` is recomputed at the hit site per
target, so it cost nothing. Measured, Meowscarada's Earthquake into an unfaintable Ceruledge:

| | no ability | Protean |
|---|---|---|
| before | 123 | **123** |
| after | 123 | **184** |

### The one derivation that needed measuring before it was wired

`itemRefusesTake` reads the artifact's own `megaStone.into` table — **and deliberately not through
`megaKeyFor`**, whose suffix fallback would answer `garchomp-mega` for a Gengarite on a Garchomp and
refuse a knock-off that is legal. Checked against Showdown's own predicate over **47,064 (item ×
body) pairs**: **156 refusals, 5 disagreements**, and all five are the same axis — Showdown compares
against `baseSpecies.baseSpecies` (the family) and this reads the exact forme key.

| pair | Showdown | here |
|---|---|---|
| `floette-eternal @ floettite` (and its mega) | allows | refuses |
| `raichu-alola @ raichunitex` / `raichunitey` | refuses | allows |
| `slowbro-galar @ slowbronite` | refuses | allows |

All five are a regional forme holding its family's stone, which this engine cannot mega with anyway
(`megaKeyFor` finds no row). **Declared, with the number, rather than left to be discovered.**

### THE CONTROLLED TABLE — 11 arms × 1,995 games, one pinned census, every arm COMPARABLE

`node engine/wire_ladder.js --write`. Census pinned to `data/wire-ladder-census.pin.json`
(`f63179105d3c`); **the baseline ran first and last with nine arms between and reproduced EXACTLY —
every measured field identical AND the per-game divergence depth identical game for game.**

| arm | div/1995 | agreed whole | classes | causes | moves | **median line** | p90 | mean |
|---|---|---|---|---|---|---|---|---|
| baseline (pre-WIRE-1) | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |
| WIRE 1 | 1986 | 9 | 21 | 1069 | 228 | 13 | 31 | 15.92 |
| WIRE 2 | 1976 | 19 | 24 | 1153 | 233 | 13 | 44 | 20.94 |
| WIRE 3 | 1975 | 20 | 24 | 1187 | 237 | 14 | 44 | 21.62 |
| WIRE 4 (complete) | 1965 | 30 | 23 | 1151 | 237 | 14 | 46 | 21.93 |
| WIRE 6 | 1962 | 33 | 25 | 1174 | 263 | 14 | 55 | 23.36 |
| **WIRE 7** | **1931** | **64** | 25 | 1261 | **267** | **16** | **89** | **27.75** |
| baseline, REPEATED | 1989 | 6 | 22 | 1129 | 224 | 13 | 30 | 14.83 |

- **THE MEDIAN COMPLETED TURN IS STILL 1, AT EVERY RUNG INCLUDING THIS ONE.** Seven wires have not
  moved it. That is the headline the ladder was built to refuse to soften.
- **THE MEDIAN FIRST-DIVERGENCE LINE MOVED BY TWO, WHICH NO PREVIOUS RUNG DID.** 14 → 16, and p90
  55 → 89. Paired against the baseline, `median_delta_lines` is **1** — the first rung in the series
  where the median paired shift is not zero.
- **NET, WHICH IS THE ONLY HONEST FORM.** Against the baseline: **1,060 games part LATER, 178
  EARLIER, 757 unchanged — net +882**. Against WIRE 6: **533 later, 174 earlier, 1,288 unchanged —
  net +359**. Games parting earlier is a trajectory reaching a different pre-existing bug sooner,
  not a regression, and the count is printed rather than netted away.
- **WHOLE-GAME AGREEMENT 33 → 64**, and 6 at the baseline.
- **DISTINCT MOVES CONNECTED 263 → 267**; census rows reached by a connecting move unchanged at 113.
- **`-damage field 3` 169 → 257 and distinct causes 1174 → 1261, both UP.** That is the trajectory
  working: games that survive 16 lines instead of 14 reach bugs the earlier arms never got to.

### WHICH OF THE SEVEN ACTUALLY MOVED ANYTHING — attributed, not assumed

Both arms re-run alone at 1,995 games under the same pinned census and asserted COMPARABLE by
`engine/arms_comparable.js`. Occurrences in the artifact's cause list, by family:

| family | WIRE 6 | WIRE 7 |
|---|---|---|
| `hospitality` | 251 | **0** |
| `knockoff` | 90 | 21 |
| redirect (`followme` / `ragepowder` / `lightningrod`) | 63 | 15 |
| `protean` / `typechange` | 39 | 19 |
| `sitrusberry` | 38 | 6 |
| `substitute` | 31 | 3 |
| `[eat]` dispositions | 35 | 6 |
| `focussash` | 7 | **3 — and NOTHING WAS WIRED FOR IT** |
| `shedtail` | 6 | 2 |

**Hospitality reaches zero.** Nothing else does, and what is left is named below rather than rounded
off.

### The boundaries — measured, declared, NOT fixed

- **Hospitality carries `onSwitchInPriority: -2`** and this engine speed-sorts entrants with no
  priority term, so it resolves too early against a priority-0 entry ability. Sixteen abilities in
  this format carry a switch-in priority and **`data/tags.json` carries none of them** — wiring it
  means typing sixteen names. It can only bite when a partner is ALREADY DAMAGED as the pair enters,
  which turn-1 leads never are; the family reads **0** occurrences in 1,995 games after the full-HP
  gate. Reported, not filed.
- **Shed Tail does not switch its user out.** `selfSwitch: 'shedtail'` passes the doll to the
  incoming body; `playerAction` classifies the move as `affect` (it carries a `statusInflict`
  volatile) and no pivot happens. The `passesState` tag is read by nothing. 64 uses.
- **Shed Tail's cost is `Math.ceil(maxhp / 2)` and this engine pays `floor`** — one HP on an odd-HP
  body. `costsUserHP.costsFraction` is `0.5` with no rounding hint in the artifact, so closing it
  means keying on the move's name. The DOLL's rounding was closed because `ceil(maxhp/4)` is one rule
  for both members of the tag and needs no name.
- **Lightning Rod does not draw a move aimed by the rod's OWN ALLY.** Showdown registers
  `onAnyRedirectTarget`, which fires for a move from either side; this engine looks for the rod among
  the ATTACKER's foes. Ten occurrences remain at the top rung, all `\|-activate\|lightningrod` present
  in Showdown and absent here.
- **Protean now converts on some moves Showdown fails outright.** `singleEvent('Try', ...)` runs
  BEFORE `PrepareHit`, so a move whose own `onTry` refuses never converts. The engine's `onTry`
  equivalents that emit `-fail` sit above the new conversion site for Sucker Punch and Steel Roller
  but not for everything; about nine of the nineteen surviving `typechange` rows are this shape, and
  some of those are Reflect Type rather than Protean. Traded a larger error for a smaller one and
  said so.
- **Libero is UNREACHABLE in this format — 0 legal carriers — and was not wired.** Confirmed against
  the roadmap's own instruction.

### Three instruments went red BECAUSE the engine got better, and all three are fixed here

**`tests/test-game-differential.js` — 4 FAILURES, every one of them good news.**

1. Two of the three §5a directed scenarios (`knock-off order`, `resist berry`) stopped diverging.
   Each `DIRECTED` entry now declares `expect: 'agree' | 'diverge'` with a `closed_by`, and the test
   fails just as loudly if a closed case RE-OPENS. A prediction that came true is a claim, not a mute.
2. **A scripted game ran past the end of its script.** Every `DIRECTED` entry carries a ONE-turn
   script and the loop only ever ran one turn because every scenario diverged on turn 1. When two
   started agreeing the loop ran on, `scripted()` returned `pass` for a slot with no step, and
   Showdown rejected the choice — so a FIXED ENGINE reported as `THREW: … Can't pass`. A scripted
   game now ends when its script does.
3. The `ordering` acceptance test needs TWO scenarios and WIRE 7 closed one of them. **The bar was
   not lowered.** A replacement was staged from the ladder's own surviving causes — Electro Shot's
   `\|-prepare\|` against the `\|-boost\|spa\|1` it grants, 2,579 corpus uses, Archaludon its only
   carrier here — and it parts exactly as predicted.
4. PART 3c asserted that medicham2 records Colbur as KNOCKED OFF. It records it as EATEN now; the
   assertion is inverted and KNOCKED-OFF is the failure.

**`engine/wire_ladder.js` REFUSED TO PUBLISH THE WIRE 7 ARM, and it was right.** *"the verbose stream
carries 1994 games and the artifact says 1995"* — one game THREW. Root-caused rather than worked
around: Showdown's request for a **recharging** body carries one pseudo-move, `recharge`, which is not
a dex entry, so `chooseAction` dropped every candidate, `trapped: true` left no switch, and the driver
answered `pass` — which Showdown rejects. A pre-existing hole in the driver that WIRE 7's deeper
trajectory reached first. The fallback is `move 1`, and it is COUNTED as
`declared_gaps.forced_first_slot` (**1** in 1,995 games) because a silent one looks exactly like a
working feature.

**`engine/conformance.js` RATCHET BROKEN — 1 new finding, `engine/wire_ladder.js` names
`move:protect`.** It had typed the starved swarm configurations into a prose field
(`omit-protect: 84 teams available`). S12b matched a diff_swarm CONFIG ID rather than a move, and it
was still right for its own reason: a name typed there goes stale the moment the swarm's configuration
list changes. Read off the baseline arm's own `swarm` block now. **RATCHET — 96 baselined, 0 new.**

### Red on the runner and NOT this wire's

- `tests/test-prng.js` — `tests/test-protocol-trace.js`'s LCG. Documented as red before this wire,
  MEASURE's rule, untouched.
- `tests/test-stadium-roster.js` — the GURU hole, `docs/MODELS.md` is MEASURE's. Untouched.
- `engine/provenance.js --strict` — `exploitability.json`, DECLARED VOID by its own generator and
  ratcheted. Pre-existing.
- `tests/test-site-data-fresh.js` — every site bundle behind the game store by 0.6d, plus three stale
  fits. OPS appends continuously; untouched by this wire.
- `tests/test-wiring.js`, `tests/test-forced-switch.js`, `tests/test-team-preview-race.js` — FAIL
  under `run-all` and PASS standalone (`test-wiring` reports mega 5.33/game alone and 0.00 under the
  runner). That is filed as 18 and is a property of the runner.
- **`node engine/status.js` opens with FEATURE SEMANTICS CHECK FAILED on eight features.** Three of
  them (`switchSurvives1`, `switchKOSlow`, `switchDiesFirst`) are ROADMAP #31's, recorded below with
  the identical digests; the other five are damage-shaped and moved with WIRE 4's fixed point. **This
  wire adds to it and cannot close it: a refit is MEASURE's.** Routed, not filed.
- `tests/test-interaction-matrix.js --full` runs and the SHRINK GUARD refuses to publish — 1,574 live
  cases against the artifact's 1,643, so the generated block above still quotes 2026-08-06. The
  shrink is **structurally not this wire's**: the LIVE/INERT split is decided by the REFERENCE
  engine's two arms and the emitted count by `data/tags.json` × `MC.mons`, neither of which medicham2
  can touch. Agreement on what DID run: **1,557/1,574 (98.9%)**.

### A NOTE ON `tests/test-mechanics.js` AND THE PIN

It was run — landing seven probes requires it — and **it did not invalidate the ladder**, because
`engine/wire_ladder.js` steers from `data/wire-ladder-census.pin.json` and never from the live census.
The pinned digest is `f63179105d3c` and the live one is now `acf001302733`; the artifact records both
and says they differ. That separation is exactly what WIRE 5 built.

## ROADMAP #81 WIRE 5 — THE INSTRUMENT WAS STEERED BY A FILE NOBODY HAD LISTED, AND WIRE 4's TABLE DOES NOT REPRODUCE. 2026-08-07.

Census **249 live / 250 probed → 249 live / 250 probed** — unchanged, and deliberately: this is a
measurement-integrity wire and no mechanic moved. `tests/test-mechanics.js` was **not run**, because
running it regenerates the very file this wire pins.

**THE DEFECT.** `covWant()` in `engine/game_differential.js` scores every legal action by the
least-exercised row of `data/mechanics-census.json`, so the census decides which moves the driver
clicks and therefore **which games the run plays**. The census is regenerated by
`tests/test-mechanics.js` — which is what ENGINE runs after landing every probe. Landing a probe
changes the sample the differential measures. Four WIREs were reported as before/after pairs and all
four landed probes into the census in the same session.

**AND THERE WAS A SECOND ONE, FOUND WHILE FIXING THE FIRST.** `diff_swarm.buildSwarm` reads
`data/games.bo3.jsonl` and `data/games.ots.jsonl` **live**, dedupes to distinct teams, and picks by a
**stride** over the matching set — so one appended game shifts the stride and changes which teams get
played. OPS appends to that store continuously; it moved twice during this wire's own test runs.

### The option taken, and why the other two are wrong

| | verdict |
|---|---|
| **(1) add the census to `engine_release.js`'s SOURCES** | **REJECTED, and not on taste.** A before-arm is run as `--release <old-id>`. With the census inside the release the before-arm reads the OLD census and the after-arm the NEW one, so **the two arms would steer differently by construction** — it makes each run individually reproducible and every before/after pair non-comparable, which is the failure being fixed. It is also unworkable: the census carries a `generated` stamp, so its bytes change on **every** run of `test-mechanics.js` even when no mechanic moved (measured: content digest `28203348a7ff` stable, file digest `c6be796631be` not). Every test run would fork a release id and `drift()` would never read zero |
| **(2) a run-local snapshot taken once at start** | **REJECTED — it fixes nothing that is broken.** The differential is single-process and already reads the census exactly once at module load. There is no mid-run drift. The failure is BETWEEN arms and a run-local snapshot says nothing about the other arm |
| **(3) declare the policy, digest it, pin it, and refuse an incomparable pair** | **TAKEN** |

`engine/steering.js` resolves the selection input, refuses to run on one that is unreadable, unparsable
or empty (an empty census makes `covWant` return `Infinity` for everything and the driver falls back to
click order — a run with no steering that looks exactly like a run), and returns a block that goes
straight into the artifact:

```
"steering": { "policy": "census-coverage-seeking/v1", "input_digest": "c6be796631be",
              "input_rows": 250, "input_generated": "…", "pinned": true, "matches_live": true,
              "team_pool_digest": "19174ee16416", "team_pool_teams": 7360, "team_pool_picked": 791 }
```

`--census <file>` pins both arms to the same bytes. `--baseline <artifact>` **refuses to start**, exit
3, before a single game is played. `engine/arms_comparable.js` is the same check over two artifacts
already on disk, which is the reporting act that actually went wrong. **An artifact with no `steering`
block fails CLOSED** — every artifact written before tonight has none, and the honest verdict for those
is "nothing recorded whether they were comparable", never "they were".

### The red demonstration — `tests/test-arm-steering.js`

The control is cleared first, because identical results across a varied knob mean the knob is unwired.

| | result |
|---|---|
| **1 GREEN CONTROL** two arms, same release, byte-identical census | **identical numbers**, guard says COMPARABLE (exit 0) |
| **2 THE KNOB IS WIRED** same frozen release `45485dee6a43`, census minus 43 move rows | **the numbers move.** `unrelated event mismatch` 20 → 16, `ordering` 6 → 9, `event missing` 17 → 18, `-damage field 3` **2 → 1**, moves connected 76 → 80 — on 51 games with **the engine byte-identical** |
| **3 RED** the guard on that pair | **NOT COMPARABLE, exit 1**, naming both digests |
| **4 RED, EARLIER** `--baseline` against it | **exit 3, no artifact written, no game played**; the control (`--baseline` with the same census) runs normally |
| **5 FAILS CLOSED** an artifact declaring no steering | NOT COMPARABLE, with the reason |

`-damage field 3` — the family WIRE 4 reported on — **moved on a census change alone.**

### WIRE 4's numbers do NOT hold. The conclusion does.

Both arms re-run tonight at 395 games, `--census` pinned to one file (`c6be796631be`), same team pool
(`19174ee16416`), asserted COMPARABLE by the instrument itself. **The before-arm was then run a third
time and reproduced the first exactly**, so what follows is input, not noise.

| | WIRE 4 published | controlled re-run | |
|---|---|---|---|
| **`-damage field 3`, before-arm** | 46 games / 45 causes | **59 / 56** | |
| **`-damage field 3`, after-arm** | 31 / 31 | **38 / 35** | |
| the effect | −33% games, −31% causes | **−36% games, −37.5% causes** | direction and magnitude **hold** |
| of those, `[from]recoil` | 4 → 2 | **8 → 0** | stronger |
| diverged | 391 → 390 | **392 → 389** | |
| `-heal field 3` | 2 → 0 | **3 → 0** | |
| `-immune field 3` | 1 → 0 | **1 → 0** | holds exactly |
| classes | 12 → 12 | **10 → 10** | |
| distinct moves connected | 177 → 176 (−1) | **175 → 173 (−2)** | the coverage loss is **twice** what was reported |
| census reached by a connecting move | 107/112 → 107/112 | **107/112 → 107/112** | holds exactly |

**EVERY ABSOLUTE FIGURE IN WIRE 4's DIFFERENTIAL TABLE IS RETRACTED. The finding is not.** The
arithmetic fix still removes a third of a 56-cause family and takes `[from]recoil` to zero, which is
more than was claimed, and the two `field 3` classes it emptied are still empty. What cannot be
defended is any specific number, and the receipts for why are exact: WIRE 4's after-arm was written at
**06:51:15**, the live census was regenerated at **06:57:42 — six minutes later**, so the census those
arms ran under no longer exists; and the game store has grown since (ladder store 206,789,118 B at
WIRE 4's assertion, 207,410,186 B now), so the team pool is not the one it sampled.

`data/game-differential.json` is now the controlled after-arm and is the first differential artifact to
carry a `steering` block and a `baseline_comparability` verdict.

### Filed, not fixed

12. **THE DRIVER ITSELF IS NOT DIGESTED ANYWHERE.** `engine/game_differential.js` is the instrument,
    not the engine, so it is correctly outside the release — and no artifact records its content
    digest, so two arms taken either side of an edit to it cannot be distinguished from two arms taken
    either side of an engine change. WIRE 4 asserted it by hand. `arms_comparable.js` prints this as a
    stated limit rather than passing over it.
13. **`data/protocol-events.json` IS A THIRD UNLISTED INPUT.** It is the declared skip list: it decides
    which Showdown lines are removed before alignment, so a change to it moves every class count in
    every table above. Not stamped, not compared.
14. **THE COMMENT ABOVE `COV_TARGETS` IS STALE AND SAYS `235 rows / 192 measurable / 43`.** The run
    prints 250 / 205 / 45. Cosmetic, but it is a number in prose describing a corpus, which is the
    thing this project has already learned prose cannot do.

## ROADMAP #81 WIRE 6 — TWO ACTION KINDS OUT OF TWENTY-SEVEN NEVER SAID WHAT THEY DID, AND EVERY RULE KEYED OFF THE MOVE ID SKIPPED THEM. 2026-08-07.

Census **249 live / 250 probed → 251 live / 252 probed**, `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Red demonstrations **139 → 142, 0 failed** (three new, a different broken engine each).

**THE DEFECT, AND IT IS A FAMILY RATHER THAN A MOVE.** `playerAction` resolves a click to one of
**27 action kinds**. Every rule that sits above the kind dispatch — the Taunt refusal (WIRE 119), the
Throat Chop silence (WIRE 77), the priority bracket, and the `|move|USER|MOVE|TARGET` line the
protocol trace emits — asks `actionMoveId(a)` which move was clicked. `actionMoveId` read `a.mv`, and
for the kinds that carried none it fell back to `KIND_MOVE`, **three hand-written rows**. Two kinds
were not in those three rows:

| kind | moves | corpus uses | what it announced |
|---|---|---|---|
| `trickroom` | 1 | **8,077** | nothing |
| `pass` — the engine models no effect for the click | **46** (Quick Guard 803, Ally Switch 190, Instruct 173, Heal Pulse 126…) | 2,145 | nothing |
| the other 25 kinds | 454 | — | correctly |

Trick Room's *mechanic* has been green for weeks — `reversesSpeed` has a probe, the turn really does
invert. What was missing was the **announcement**, and no probe in `tests/test-mechanics.js` could
tell those two apart because every probe in it reads state.

### The fix is at the root: an action carries the move that made it

`playerAction` now stamps `mv` on every action it builds, including `{kind:'pass',mv:id}` — an
unmodelled click is still a click — and the emit gate's `&& a.kind!=='pass'` is gone. `KIND_MOVE`
stays as the backstop for a bare action a **caller** hand-built; a bare `{kind:'pass'}` (the idle ally
in ~200 probes, `game_differential`'s empty slot) still has no `mv` and still announces nothing, so the
two meanings are distinguishable, which they were not.

**AND IT MOVED THREE OTHER RULES, WHICH IS THE POINT OF FIXING A ROOT AND ALSO THE RISK.** Measured
directly against the frozen release rather than argued:

| move | real bracket | before | after |
|---|---|---|---|
| Quick Guard | +3 | **0** | +3 |
| Ally Switch | +2 | **0** | +2 |
| Counter | −5 | **0** | −5 |
| Mirror Coat | −5 | **0** | −5 |

Taunt and Throat Chop now refuse these 46 moves as well, which is correct (45 of them are
`statusCategory`) and emits `|cant|` where the engine used to emit nothing at all. The one hazard is
named rather than assumed: the `costsUserHP` charge sits above the kind dispatch too, and **no move
that lands on `pass` carries that tag** (checked over the whole of `MC.moves` against
`data/tags.json`). If one ever does it would pay HP for an effect the engine does not grant, which is
WIRE 130's exact shape.

### How much of the family this actually explains — 27 of 133, and the honest bound

The target was the largest class in the controlled artifact, `event missing from medicham2`. In the
**before-arm taken for this wire** it is 133 games / 107 distinct causes. Sorting its causes by the
corpus usage of the entities they mention, and asking the **frozen before-engine** which of them
resolve to a silent action kind:

| | games |
|---|---|
| the family | 133 |
| first divergence is a missing `\|move\|` line | **56** |
| …of those, the move resolves to a **silent action kind** — the root above | **27** (Trick Room 20, Heal Pulse 3, Quick Guard 2, Wish 1, Role Play 1) |
| …of those, the move resolves to a LOUD kind and the line was lost for another reason | 29 |
| first divergence is some other event entirely | 77 |

**So the root explains 27 of 133 — 20% of the family — and not one game more.** The other 106 are
led by `-fail` (22), `-activate` (15), `-immune` (15), `-prepare` (15) and `-enditem` (11); the 29
loud-kind ones are a **turn-order / spread-target** shape, not this one — `|move|p1b: Garchomp|Earthquake|p2b: Venusaur|[spread] p2b`
against our `|move|p1a: Dragonite|hurricane|p2a: Charizard`, where Showdown's line never reappears in
our stream *identically* because the target field differs, so the classifier files an ordering fault
as a missing event. **That is a separate WIRE and it is filed below.**

After the wire the **whole** `|move|`-head sub-family is empty (56 → 0), which is more than the 27 the
root accounts for; the rest is the priority correction above reordering turns that were parting for
ordering reasons. Both effects are the same change and neither is separable from the other in this
instrument, so **27 is what is claimed and 56 is what is observed**.

### Before / after, and the instrument's own verdict

Both arms 346 games, mode A, `turns_cap` 12, `--census` pinned to one file (`c6be796631be`), taken
back-to-back so the live game store could not move between them. `node engine/arms_comparable.js`:

> **COMPARABLE.** Both arms selected their sample the same way, so a difference between their numbers
> is the change under test.
> before release `45485dee6a43`, steering `c6be796631be`, 346 games — after release `3fd06d865427`,
> steering `c6be796631be`, 346 games.

| class | before | after | |
|---|---|---|---|
| **event missing from medicham2** | **133 / 107** | **120 / 113** | the target |
| …of which a missing `\|move\|` line | **56** | **0** | |
| unrelated event mismatch | 84 / 57 | 91 / 60 | |
| ordering | 49 / 41 | 50 / 41 | |
| extra event emitted by medicham2 | 39 / 32 | 42 / 35 | |
| `-damage field 3` | 19 / 19 | 24 / 23 | |
| **turn order** | **9 / 9** | **0 / 0** | |
| `switch: a different body` | 4 / 4 | 4 / 4 | |
| `-start field 4` | 2 / 2 | 2 / 2 | |
| `-activate field 4` | 2 / 2 | 2 / 2 | |
| `-status field 4` | 1 / 1 | 3 / 3 | |
| `-start: a different body` | 1 / 1 | 2 / 2 | |
| `-heal field 3` | 0 | 1 / 1 | |
| diverged | 343 | **341** | of 346 |
| classes | 11 | 11 | |
| threw | 1 | 1 | |

**THE FAMILY FELL BY 13 AND ITS DISTINCT CAUSES ROSE BY 6, AND THAT IS THE WIRE WORKING RATHER THAN
HALF-WORKING.** Emitting a line the engine owed pushes the first divergence LATER into the game, so
games leave this class and games arrive in it from elsewhere. `diverged` moved 343 → 341, which is the
only number here that says two whole games now agree end to end. **A class count is a
first-divergence count and nothing else; it is not a bug count.**

`data/game-differential.json` is the after-arm above, verbatim.

### Coverage direction — the largest gain of the series

| | before | after |
|---|---|---|
| **distinct moves connected** | 177 | **197 (+20)** |
| distinct species | 258 | 260 |
| distinct abilities | 161 | 162 |
| census rows reached by a connecting move | 108 / 112 | 108 / 112 |
| `not_exercised` | 5 | 5 — **membership swapped**: `move:reversesSpeed` left, `move:inflictsToxic` arrived |
| clicked but always missed (the Mode A pin) | 47 | 46 |

WIRE 3 gained five distinct moves and WIRE 4 lost one. This gains twenty, because 46 moves the engine
had been resolving into silence now register as connected.

### The three red demonstrations, one per site

| broken engine | what it must break |
|---|---|
| `{kind:'trickroom',mv:id}` → `{kind:'trickroom'}` | Trick Room announces the move that set it |
| `{kind:'pass',mv:id}` → `{kind:'pass'}` | Quick Guard and Psych Up announce themselves |
| the emit gate `if(TR&&_mid)` → `if(TR&&_mid&&a.kind!=='pass')` | the gate is on THE MOVE, not on the kind being liked |

Each carries the same two controls, asserted on **both** engines: an ordinary Earthquake announces
itself, and a body that PASSED announces nothing. Without the second one these would be watching "the
trace emits `|move|` at all". A **fourth** reversal had to be repaired rather than added —
`ARM doublesSideSpeed` reverts `if(id==='tailwind')return {kind:'tail'};` and that line now carries an
`mv`; `revertedEngine` refused to apply the patch and threw, which is that guard doing its job.

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES FORTY.

The first `moveLines()` helper filtered the trace on `l.split('|')[3] === (mv || ' ')` — so the
no-click **control** compared the move name against nothing and could only ever return zero. A control
that cannot fail is the hollow shape this whole file exists to catch, written straight into the probe
meant to catch it. The helper now returns every `|move|` line the acting body emitted and the probe
does the naming.

**AND THE RATCHET CAUGHT BOTH NEW PROBES AS DIRECT CALLS ON THEIR FIRST RUN** — `directCall` went
0 → 2 and the file went red — because `REALTURN` matches the probe's own source and `moveLines(` was
not in it. It is declared there now, with its reason, exactly as that comment requires. That is a gate
that could have been softened by renaming a helper, and was not.

### THE SKIP LIST MOVED UNDER THE TABLE, AND THE TABLE REPRODUCED EXACTLY

`data/protocol-events.json` is derived from `medicham2-browser.js`'s `add()` claims, so changing the
engine staled it — `engine/provenance.js` read it UNSAFE, *COMPUTED FROM DIFFERENT CONTENT*. It was
regenerated (`derive_protocol_events.js --write`, both gates pass, 38 emitted / 56 declared-not-emitted
/ 10 partial, unchanged) **and both arms were then re-taken under the new file**, because it is WIRE
5's filed item 13 — the skip list decides which Showdown lines are removed before alignment, so a
change to it can move every count in the table above.

**Every figure in the table reproduced to the digit** — all twelve class counts, all twelve cause
counts, `diverged` 343 → 341, connected 177 → 197, `not_exercised` membership, `threw`. So the
regeneration was stamp-only in effect, the pair is comparable both to itself and across the change,
and the instrument has now been shown deterministic across a third input as well. `arms_comparable.js`
returns COMPARABLE on the re-taken pair, and `data/game-differential.json` is that after-arm.

### Three tests were red beside this work. One was ENGINE's and is FIXED here; two are not ENGINE's

**FIXED — `tests/test-tag-wire.js`, and it was WIRE 4's, not this one's.** `rain Solar Beam lands at
x0.545 of clear-sky` against a `< 0.03` tolerance. The probe aimed a Grass move into a Fire/Dark
Incineroar, where it is resisted twice over and the top roll is **22 points** — so a single damage
point is 4.5% and no engine could meet a 3% ratio. Showdown's base-damage formula ends `floor(…) + 2`,
so halving the BASE POWER cannot halve the DAMAGE; the flat +2 survives. Measured against the frozen
releases: `cf6a68fa412c` (pre-WIRE-4) 22 → **11**, an exact 0.500 — **the probe was passing because
the engine truncated a float**. `45485dee6a43` (post-WIRE-4) 22 → **12**. WIRE 4 corrected the
arithmetic and the probe went red on the better engine, and it stayed red through WIRE 5. The arm now
aims at a Milotic, where the +2 is 1.4% and the ratio reads 0.514. **The tolerance was not widened and
the claim was not weakened** — with `weatherScaled` stripped from the artifact the same assertion
reads x1.000 and still fails, checked.

**RED, NOT ENGINE's, NOT FIXED — reported.**
- `tests/test-prng.js` — *no file multiplies its state by 1103515245 in float arithmetic — found in:
  `tests/test-protocol-trace.js`*. That constant is inside a file this division owns but the check
  belongs to MEASURE's PRNG rule; the LCG there is a fixture generator, not a sampler feeding a
  bootstrap. Untouched by this wire and red before it.
- `tests/test-stadium-roster.js` — `engine/diff_swarm.js` and `engine/mega_decision_census.js` are in
  neither `docs/MODELS.md` nor the `NOT_A_MODEL` table. **The GURU hole**, and the file says in as
  many words that `docs/MODELS.md` is MEASURE's. Untouched by this wire.
- `engine/provenance.js --strict` — exit 1 on `exploitability.json`, **DECLARED VOID by its own
  generator**, which is a recorded decision and is ratcheted. Pre-existing.

**AND `tests/run-all.js` REPORTS FAILURES ITS OWN TESTS DO NOT REPRODUCE.** Across two full runs,
`test-forced-switch`, `test-team-preview-race`, `test-wiring` and `engine/validate_selfplay` failed
under the runner and pass standalone (exit 0, 16/16 and 58 features respectively); `test-wiring`
reported *mega 0.00 per game* under the runner and its normal rate alone. The set of failures differed
between the two runs, which is the signature. That is a property of the runner, not of the engine, and
it means **a FAIL line in run-all is not evidence on its own** — every one above was re-run alone
before it was believed or dismissed. Filed as 18.

**CAUSED BY ME AND FIXED IN THE SAME PASS.** `tests/test-web-status.js` was red at *engine.probed =
235 but the census says 252*; the census had moved and the board had not, so `node web/build-status.js`
was run — the rebuild that test itself prints. That then reddened `tests/test-site-sync.js`, because
`web/status-data.js` and `app/status-data.js` must be byte-identical and only `web/` had been written.
`cp web/status-data.js app/status-data.js`, the procedure that test's own header documents. Both green.


### Filed, not fixed

15. **`{kind:'struggle'}` IS RETURNED AND NEVER DISPATCHED.** `chooseAction` returns it in three
    places; no branch of the executor handles it and it carries no `mv`, so a struggling body does
    nothing and announces nothing. Not in this wire's sweep because `playerAction` never produces it.
    Reachable when a body has no attacking move it may click.
16. **AN ORDERING FAULT IS BEING FILED AS A MISSING EVENT — ~29 GAMES.** `classify`'s lookahead asks
    whether the other engine's line reappears *identically*. A spread move's `|move|` line carries
    `[spread] p2b` and a redirected one carries a rewritten target, so a genuine turn-order difference
    on Earthquake reports as `event missing from medicham2`. This is the largest remaining share of
    that class and it belongs to the instrument, not to the engine.
17. **`movePriority` READS 0 FOR METAL BURST AND COMEUPPANCE**, whose real bracket is −4. Found while
    verifying the four brackets above; it is an artifact gap, not a `playerAction` one.
18. **`tests/run-all.js` PRODUCES FAILURES ITS OWN TESTS DO NOT REPRODUCE**, a different set on each
    run, on tests that spend real games. Every FAIL from it now has to be re-run alone before it means
    anything, which is a tax on every division. Not diagnosed here; it is the runner, not a test.


## ROADMAP #81 WIRE 1 — A PROTECT BLOCK WAS BEING RESOLVED AS A TYPE IMMUNITY AND AS A MISS, AND THE CRASH IT OWES WAS NEVER PAID. 2026-08-07.

Census **240 live / 241 probed → 243 live / 244 probed**, `unarmed` 0, `directCall` 0, `hollow` 0.
Red demonstrations **128 → 132, 0 failed** (four new, a different broken engine each).
Whole-game differential, the same 395 games against two frozen releases that differ in exactly one
file: **394/395 diverged → 394/395. THE RATE DID NOT MOVE AND NEITHER DID THE MEDIAN.** What moved is
that the target cause is gone — **6 games' first divergence → 0** — and that 6.6% more protocol was
compared for the same games.

**ONE ROOT, THREE SITES: THE HIT STEPS WERE IN THE WRONG ORDER.** Showdown's `trySpreadMoveHit`
(`sim/battle-actions.ts:553-576`) runs 0 invulnerability, **1 TryHit — where Protect lives** — 2 type
immunity, 3 move-specific immunity, **4 accuracy**. medicham2 rolled accuracy first, then checked the
type chart, and only then the shield. So a shield lost two races it always wins in the real game:

```
supercellslam -> a Protecting Garchomp      SD |-activate|p2a|move: Protect     MC |-immune|p2a
a 90%-accuracy move -> a Protecting body     SD |-activate|p2a|move: Protect     MC |-miss|p1a|p2a
```

**THE EXPENSIVE HALF IS NOT THE PROTOCOL LINE.** `crashOnMiss` was consumed at exactly one site — the
accuracy roll — and Showdown fires the crash from `singleEvent('MoveFail', ...)`
(`battle-actions.ts:526`), which runs on ANY falsy move result. High Jump Kick's crash is an
`onMoveFail` handler, so **a shield makes the hit fail and the crash lands.** Measured in the
authority, both dice pinned, before a line of this changed:

```
High Jump Kick -> a Protecting Garchomp   |-activate|p2a|move: Protect
                                          |-damage|p1a: Hitmonlee|63/125|[from] highjumpkick
High Jump Kick -> Gengar (Ghost)          |-immune|p2a
                                          |-damage|p1a: Hitmonlee|0 fnt|[from] highjumpkick
Supercell Slam -> Ground behind a Spiky Shield
                                          |-activate|p2a|move: Protect
                                          |-damage|p1a: Bellibolt|97/184|[from] Spiky Shield|[of] p2a
                                          |-damage|p1a: Bellibolt|5/184|[from] supercellslam
```

medicham2 charged nothing in any of the three. High Jump Kick is on **146 sets**, Supercell Slam
**88**, Axe Kick carries the same tag: a 130 BP move with no downside against the most-clicked move in
the format is the "priority move with no drawback" shape that WIRE 47 was written to remove, left open
on the half nobody had measured. The `[from]` field was wrong too — `Recoil`, where the authority
prints the move's own id — and that was one game of the differential on its own.

**THE PROTECTION-COUNTER CLAIM IN THE SPEC IS WRONG, AND IT IS CORRECTED RATHER THAN WORKED AROUND.**
ROADMAP #81 asked for an assertion that *the protection counter increments on a block and not on an
immunity*. It does not: Showdown's counter is the `stall` volatile, added by Protect's own
`onHit` — i.e. by consecutive USE — and it is indifferent to whether anything was blocked. Measured in
a real battle: a Protect that blocked nothing still carries `stall {counter: 3}`. What genuinely
separates the two states is the **contact toll**, so that is what the probe asserts, on HP:

```
Body Slam (Normal, contact) -> Gengar behind a Spiky Shield   |-activate| + 1/8 of the attacker
the same click with the shield down                           |-immune|   + nothing
```

**FOUR PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` —
there is no tag to strip, because `crashOnMiss` and `punishesContact` were both already consumed and
what changed is the ORDER):

| probe | census row | the broken engine it is red on |
|---|---|---|
| a blocked High Jump Kick still pays its crash | `move crashOnMiss` | the crash paid only off the accuracy roll |
| a High Jump Kick that hits nothing but a type immunity pays its crash | `move crashOnMiss` | the post-loop MoveFail test removed |
| a Spiky Shield answers before the type chart | `move punishesContact` | the old gate order, immunity first |
| a shield blocks a move whose accuracy die missed | `move stalling` | the roll hoisted back above the shield |

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES.** The two arms are the frozen
releases `0771dc47b5f6` and `41e28311e591`, whose manifests differ in `engine/medicham2-browser.js`
and in nothing else — a controlled experiment rather than two runs.

| | before | after |
|---|---|---|
| diverged | 394 / 395 | 394 / 395 — **unchanged** |
| median completed turns before divergence | 1 | 1 — **unchanged** |
| **`-activate protect <> -miss` / `<> -immune` as the FIRST divergence** | **6 games** | **0** |
| classes | 14 | 13 |
| `-miss field 3` | 1 game | **0** |
| `-damage field 4` (the crash's `[from] recoil`) | 2 games | **1** — only the unrelated Infestation cause left |
| `-start field 3` | 2 games | 1 |
| `ordering` | 43 games | 40 |
| `extra event emitted by medicham2` | 37 games | 32 |
| `unrelated event mismatch` | 116 games | **125** |
| `event missing from medicham2` | 128 games | **129** |
| normalised protocol lines compared | 19,906 | **21,214** (+6.6%) |
| distinct moves the driver got to CONNECT | 171 | 173 |
| census mechanics reached by a connecting move | 103 / 109 | 104 / 109 |

**THE RATE DID NOT MOVE, THE MEDIAN DID NOT MOVE, AND TWO CLASSES GOT BIGGER. That is the correct
shape of this result and it is not a disappointment.** A game stops at its FIRST divergence, so
removing a first-turn cause does not make the game agree — it makes the game run on and part deeper,
at whatever was behind it. That is why `unrelated event mismatch` and `event missing` grew while the
target cause emptied, and it is why the only aggregate that can show the gain is DEPTH: 6.6% more
protocol compared for the same 395 games, two more moves connected, one more census mechanic reached.
The median stays at one turn because the causes that dominate it — the Hospitality heal, the Trick
Room field line, and the consecutive-Protect failure filed as (1) below — are untouched by this wire.

**AND THE FIRST VERSION OF THIS TABLE WAS WRONG, IN THE FLATTERING DIRECTION.** It read
`395/395 → 394/395` and called that game the first this instrument had ever seen agree. It was not
the wire. **`engine/diff_swarm.js` draws its teams from the LIVE store, and the store is not in the
frozen release** — `data/games.ladder.jsonl` and `data/games.bo3.jsonl` were both appended to at
04:03, between the two arms, which changes the deterministic stride and therefore which 395 games get
played. Re-run back to back with the store's size and mtime asserted identical before, between and
after, both arms read 394/395. **This is the 2026-08-04 void arriving through a door the release rule
does not cover: 23 files are frozen and the INPUT CORPUS is not one of them.** Filed as (4) below.

**FOUR THINGS FOUND ON THE WAY, FILED AND NOT FIXED — they are WIRE 2+, not this one:**

1. ~~**The stall counter never resets…**~~ **LANDED AS WIRE 2, below.** The census carries both halves
   now, so this line is closed rather than carried.
2. **The shield's own two emits are one field off.** Showdown writes
   `|-damage|…|[from] Spiky Shield|[of] p2a: X` and `|-singleturn|X|move: Protect` for the punishing
   shields; medicham2 writes `[from] move: spikyshield` and a bare `|-singleturn|X|Protect`. The
   canoniser folds case and spaces but not the colon, so both part the streams on a line the differ
   compares. Reachable far more often now that blocks resolve properly.
3. **`data/interaction-matrix.json` is stale against `data/tags.json`** — tags.json moved at 23:33 on
   2026-08-06, after the matrix was published at 21:50, so the generator now emits 1,574 LIVE cases
   against the artifact's 1,643 and the shrink guard correctly refuses to publish. Re-run at `--full`
   on this engine reads **1,557 / 1,574 (98.9%)** and the parting list loses exactly two rows —
   `gigaimpact -> spikyshield` and `supercellslam -> kingsshield`, the pair this ledger already had as
   *"crash damage on a blocked move"* — with nothing new appearing. Whether to republish under a
   declared reason is MEASURE's call, not this dispatch's.
4. **THE DIFFERENTIAL'S INPUT CORPUS IS NOT IN THE PHOTOGRAPH.** `engine/diff_swarm.js` calls
   `loadTeams()` against the live `data/games.*.jsonl`, and the 23 frozen files do not include them.
   The store grew mid-session — an ingest appending, which is OPS working normally and not a
   violation of anything — and the two arms of a before/after therefore played different games. It
   cost nothing here only because the discrepancy was large enough to notice and the run is cheap
   enough to repeat; a slower measurement would have published the difference. The fix belongs to
   whoever owns `engine_release.js`'s `SOURCES`: either freeze a team MANIFEST (the picked team ids
   are already in `data/diff-swarm.json`) or have the swarm read the corpus through `REL`. Until then
   **any before/after on this instrument must assert the store's size and mtime unchanged across both
   arms**, which is what the numbers in the table above did.

## ROADMAP #81 WIRE 2 — THE `stall` VOLATILE HAD ONE OF ITS THREE RULES. 2026-08-07.

Census **243 live / 244 probed → 244 live / 245 probed**, `unarmed` 0, `directCall` 0, `hollow` 0.
Red demonstrations **132 → 134, 0 failed** (two new, a different broken engine each). The whole-game
differential's target family — `|-singleturn|X|protect <> |-fail|X` and its mirror — **37 games → 7**,
and the seven that remain are named below.

**WHAT WAS WRONG.** Every shield in Showdown's `data/moves.ts` — protect, detect, spikyshield,
kingsshield, banefulbunker, and both Guards — opens with the same two lines, and medicham2 implemented
the middle third of them:

```ts
onPrepareHit(pokemon) { return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
onHit(pokemon)        { pokemon.addVolatile('stall'); }
// data/conditions.ts, stall:
onStallMove(pokemon) { const success = this.randomChance(1, counter);
                       if (!success) delete pokemon.volatiles['stall']; return success; }
```

1. **THE COUNTER IS DELETED THE INSTANT THE ROLL FAILS**, so the shield after a failed one is a
   guaranteed 100% again. medicham2 incremented `tookProtectTurns` on every attempt and never brought
   it back down: a body that lost one roll kept decaying 1/27, 1/81, 1/243 for the rest of its life on
   the field. `counterMax: 729` is 3^6, so the depth caps at six and now does here too.
2. **A SHIELD FAILS OUTRIGHT WHEN ITS USER HOLDS THE LAST ACTION OF THE TURN.**
   `BattleQueue.willAct()` (`sim/battle-queue.ts:310`) returns the first `move`/`switch`/`instaswitch`/
   `shift` still IN THE QUEUE BEHIND the current action, and the shield fails if there is none. It is
   **short-circuited before `runEvent('StallMove')`**, so a shield that moves last draws no die and does
   not touch the counter at all. medicham2 did not model it in any form. In a format where Protect is on
   99.30% of declared teams this is not an edge case: four bodies clicking a shield in the same turn
   means the slowest one fails, every time.

**THE POSITION OF THE PRE-PASS IS NOW PART OF THE MECHANIC.** WIRE 119's shield pre-pass ran ABOVE
`sortTurnOrder`, which was fine while the only question a shield asked was "how many in a row". Rule 2
can only be answered by the RESOLUTION ORDER, so the pre-pass moved below the sort. Nothing between the
two points reads `protect` or `tookProtectTurns` — Protect's +4 comes from the move table and the Quick
Claw roll is per-item — so this is a move and not a re-ordering of the mechanic. It does shift the RNG
stream for a turn carrying BOTH a Quick Claw holder or a speed tie AND a repeated shield; the census is
the guard on that and it did not move.

**TWO PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` — the
`stalling` tag is already consumed, so there is nothing to strip and the breakage has to be the
behaviour). Both read HP, never a `-singleturn` line:

| probe | what separates the engines | the broken engine it is red on |
|---|---|---|
| `consecutive Protect decays, and a FAILED Protect resets the counter to fresh` | turn **4** of four Protects at a fixed roll of 0.2: `0, 0, 158, 0` fixed against `0, 0, 158, 158` | the counter increments on every attempt and is never deleted |
| `Protect FAILS outright when its user holds the LAST action of the turn` | turn 2 behind a shield at a losing roll: **`182` / `0`** fixed against **`182` / `182`** | the `willAct()` gate replaced by `if(false)` |

**THE FIRST PROBE REPLACED ONE THAT ENCODED THE BUG.** `repeated Protect starts failing` spent three
turns and asserted `dealt[0] === 0 && dealt[last] > 0` — the decay half, which was never wrong. It
stopped **one turn before the only turn that can tell the two engines apart**, so it scored LIVE on a
wrong engine for as long as it existed. The second probe's `182` against `182` is the other shape this
ledger keeps warning about: identical results across a varied knob mean the knob is unwired.

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES** (`--games 450`; the before-arm
is the frozen release `41e28311e591` and reproduces WIRE 1's after-arm figure for figure, the after-arm
is `6b6f898f136f`). `data/games.ladder.jsonl` and `data/games.bo3.jsonl` were asserted identical in size
and mtime before, between and after both arms, which is filed item (4) below still being unfixed.

| | before | after |
|---|---|---|
| **the target family, both directions** | **37 games** | **7** |
| diverged | 394 / 395 | **393 / 395** |
| whole-run control arm, every stone stripped | 395 / 395 | **394 / 395** |
| median completed turns before divergence | 1 | 1 — unchanged |
| `unrelated event mismatch` | 125 games | **100** |
| `event missing from medicham2` | 129 | 145 |
| `extra event emitted by medicham2` | 32 | 37 |
| `ordering` | 40 | 41 |
| `turn order` | 12 | 13 |
| `-damage field 3` | 43 | 44 |
| `-immune field 3` | 2 | 1 |
| `-unboost: a different body` | 1 | **0** |
| classes | 13 | 13 |
| normaliser invocations (see below) | 21,214 | 54,773 |
| distinct moves the driver got to CONNECT | 173 | **169** |
| census mechanics reached by a connecting move | 104 / 109 | 104 / 110 |

**THE RATE MOVED, AND IT IS ONE GAME.** 394 → 393 diverged, and the stripped control arm 395/395 →
394/395. This instrument is deterministic and pinned, so one game is a real game and not noise — but it
is one game, and the honest reading is the same as WIRE 1's: a game stops at its FIRST divergence, so
clearing a cause makes games run ON and part deeper at whatever was behind it. That is why
`event missing`, `extra event` and `ordering` all grew while the target family emptied.

**AND THE DEPTH HEADLINE WIRE 1 USED IS THE WRONG NUMBER — filed as (5).** `total_lines_collapsed` is
not "protocol lines compared". `alignAndCheck()` (`engine/game_differential.js:791`) re-reduces the
WHOLE stream from scratch once per turn and `bumpNorm` counts every normaliser invocation, so a game of
T turns contributes about T²/2 × lines-per-turn. The quantity is monotone in depth and the direction is
real; the NAME and the PERCENTAGE are not. 21,214 → 54,773 is roughly **1.6x the turns played**, not
2.6x the protocol, and WIRE 1's "+6.6% lines compared" was nearer +3% of turns.

**THE COST, STATED.** `distinct moves connected` fell 173 → 169 and `not_exercised` rose 6 → 7. That is
the fix working in the direction that hurts coverage: a correctly-resetting shield goes UP more often,
so fewer clicks connect. It is not a regression to chase — it is what the real game does — but a
coverage figure that fell should never be left to be rediscovered as a counter that quietly went down.

**THREE THINGS FOUND ON THE WAY, FILED AND NOT FIXED:**

5. **WIDE GUARD AND QUICK GUARD SHARE THE `stall` VOLATILE AND THIS ENGINE RESETS IT.** Showdown's
   `wideguard`/`quickguard` carry `onTry() { return !!this.queue.willAct(); }` and
   `onHitSide(side, source) { source.addVolatile('stall'); }` — they never ROLL the counter, but they
   ARM it, so a Protect after a Wide Guard is already at 1/3, and they fail when their user acts last.
   medicham2's pre-pass does the opposite: `it.mon.tookProtectTurns=0` on a Wide Guard. Two of the seven
   remaining target-family causes are `|-fail|X <> |-singleturn|X|wideguard`. Deliberately left: it is a
   third rule needing its own probe, and this dispatch was one wire.
6. **`total_lines_collapsed` IS QUADRATIC IN GAME DEPTH AND IS REPORTED AS A LINE COUNT.** Detailed
   above. Either count the reduction once per game or rename the field; every before/after in this
   ledger that quotes it is quoting a square.
7. ~~**THE OTHER FOUR-FIFTHS OF `-fail` IS NOT PROTECT.**~~ **THE STAT-DROP HALF LANDED AS WIRE 3, below**
   — and it was two bugs, not one. `|-fail|X <> |-sidestart|X|tailwind` is untouched and stays open.

## ROADMAP #81 WIRE 4 — THE HYPOTHESIS HELD: SHOWDOWN'S MULTIPLIERS ARE FIXED POINT AND THIS ENGINE'S WERE FLOATS. 2026-08-07.

Census **246 live / 247 probed → 249 live / 250 probed**, `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Red demonstrations **136 → 139, 0 failed** (three new, a different broken engine each). The
target family — a first divergence of class `-damage field 3` — **46 games / 45 distinct causes →
31 / 31**, which drops it from the third-largest class in the artifact to the fifth.

**THE HYPOTHESIS WAS NOT ASSUMED, AND OUR SIDE WAS MEASURED FIRST.** The dispatch characterised
Showdown's arithmetic and explicitly did not establish that medicham2 gets it wrong. A new exact
comparison does: `dmgRange`'s two endpoints against `battle.actions.getDamage` at rolls 15 and 0,
**tolerance zero**, 300 sampled real matchups per arm with both engines given the species' slot-0
ability and the same stats. `tests/test-engine-diff.js` cannot see this — its stated bar is
"midpoints within 12%", which was chosen so that rounding would not read as a bug, and it is exactly
the bug.

| what was on the field | exact agreement, BEFORE | AFTER |
|---|---|---|
| **no modifier at all — the CONTROL** | 293 / 300 (97.7%) | 293 / 300 — **unchanged** |
| **a SPREAD move** | **226 / 300 (75.3%)** | **291 / 300 (97.0%)** |
| **a LIFE ORB holder** | **107 / 300 (35.7%)** | **293 / 300 (97.7%)** |
| an attacker at −1 / +2, a defender at +1 | 293 / 292 / 292 | unchanged |

The control's 7 residual rows are the same species and moves in every arm — Flash Fire, Gravity
Apple, Illusion, Water Bubble — i.e. **other bugs, not arithmetic**, and both fixed arms land exactly
on that floor. Two thirds of every Life Orb damage number this engine has ever produced was off by
one, in both directions.

**AND ONE LIMB OF THE HYPOTHESIS WAS FALSE, WHICH IS WHY IT WAS MEASURED.** `boostMul(-1)` returns
`2/3` where Showdown divides by 1.5, and `3 * (2/3) === 1.9999999999999998` — a genuine float defect,
and it is **NOT** part of this family: the three boosted arms read 293/292/292 against a control of
293. Real stats are large enough that the ulp almost never crosses an integer. It is left alone and
recorded rather than "fixed" on the strength of the argument.

**THE ROOT, AND IT IS ONE FUNCTION** (`sim/battle.ts:2318-2340`). `md4096` is Showdown's `modify`,
`ch4096` is its `chain`, `mdChain` spends an accumulated chain the way `runEvent` spends
`this.event.modifier`. `+2047` is a round-half-up baked into integer arithmetic; `Math.floor(v * m)`
is a truncation. **They agree exactly on ×2, ×1.5, ×0.5 and the type chart** — which is why no probe
in this file had ever caught it — and disagree on everything else: ×0.75 on ~50% of values, ×1.3 on
~64%. Thirty-odd call sites now route through the one function, and **the float argument is not an
approximation**: `tr(1.3 * 4096) = 5324` IS Life Orb's literal `[5324, 4096]`, and 1.2 → 4915,
1.1 → 4505, 4/3 → 5461, 0.75 → 3072 all land exactly. `md4096` also takes an explicit `[num, den]`
pair, which is what the two 5461/4096 ability sites now pass.

**A SECOND ROOT OF THE SAME FAMILY, FOUND BY LOOKING AT WHAT THE DIFFERENTIAL ACTUALLY NAMED.** Three
of the four largest `-damage field 3` causes in the before-arm were `[from]recoil`, and recoil does
not go through `modify` at all:

```
sim/battle-actions.ts:1384   clampIntRange(Math.round(damageDealt * move.recoil[0] / move.recoil[1]), 1)
sim/battle.ts:2168           Math.round(targetDamage * effect.drain[0] / effect.drain[1])
medicham2, before            Math.floor(dealt * (rc[0] / rc[1]))
```

Two errors on one line: a floor where the rule is `Math.round`, **and** a pre-divided float, so a 1/3
recoil arrived as `0.3333333333333333` and fell an ulp short of `dealt/3` on every multiple of three.
Measured in the authority by CALLING `applyRecoilDamage`, not by reading it:

```
dealt   1     2     3     4     5    100   101   102   103
SD      1     1     1     1     2     33    33    34    34     <- Math.round, floored at 1
naive   0     0     0     1     1     33    33    33    33
```

Drain is the same rule with the opposite sign — 8,553 corpus clicks, each half a point of health
short.

**THIS CORRECTION TURNED TWO GREEN PROBES RED, AND THAT IS THE FINDING, NOT AN INCONVENIENCE.** The
Choice Scarf and Swift Swim probes both prove "the foe never acted" by asserting the killer took
**zero** damage — and both had the killer click **Wave Crash**, whose recoil is clamped to a minimum
of 1. So killing a 1 HP foe really does cost the killer a point, and those two probes had been green
**because of** a bug that made a real cost vanish. Fixed at the probe: my click is now Liquidation
(same type, same category, 100%, no `rc`) and the foe still clicks Wave Crash, so the only thing that
can move my HP is the foe getting a turn.

**THREE PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` —
there is no tag to strip, the artifact was innocent in all three). **Every one asserts its CONTROL arm
too, and the control is equal on both engines by construction** — an off-by-one is only legible
against an arm that does not move, and a demo watching only the second number would also flip on an
engine that had stopped applying the modifier altogether.

| probe | census row | what separates the engines |
|---|---|---|
| a spread move takes ×0.75 rounded half up, not a truncation | `move spreadFoes` | Garchomp → Kingambit: single-target Flamethrower **64 on both**, spread Heat Wave **51** against **49** |
| Life Orb is 5324/4096 rounded half up, not a float 1.3 | `item damageMultAll` | Incineroar → Garchomp: no item **80 on both**, Life Orb **104** against **103** |
| the recoil charged is Showdown's ROUND of the damage dealt | `move recoil` | Brave Bird **41** against **40**, Flare Blitz **14** against **13**, Wave Crash **27 on both** |

**THE THIRD ARM OF THE RECOIL PROBE IS A CASE WHERE THE TWO RULES AGREE**, and the expected value is
COMPUTED from an observed quantity — the probe reads what the foe lost and asserts the user paid
`round` of it — so it states the rule rather than pinning a magic constant. It also asserts
`round !== floor` on the two discriminating moves, so a staging that ever drifts onto a
non-discriminating value goes **RED rather than hollow**.

The four exact damage numbers above came out of the authority with those exact bodies at those exact
rolls: Flamethrower 58-70, Heat Wave 46-56 spread, Close Combat 73-86, Close Combat + Life Orb 95-112.

> **RETRACTED 2026-08-07 BY WIRE 5 — EVERY ABSOLUTE FIGURE IN THE TABLE BELOW.** The differential was
> steered by `data/mechanics-census.json`, which is outside the photograph, and by the live game store,
> which OPS appends to. Neither arm below recorded either. A controlled re-run — one pinned census,
> one team pool, asserted comparable by the instrument, and the before-arm reproduced a third time —
> reads **59/56 → 38/35** where this table says 46/45 → 31/31, and **175 → 173** connected moves where
> it says 177 → 176. **The finding survives and is larger than claimed** (−36% of the family, and
> `[from]recoil` to zero rather than to two). Read the numbers from WIRE 5's table, not this one.
>
> The exact-damage sweep above it (300 matchups per arm, tolerance zero) is **not** affected — it does
> not go through the differential's game selection.

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES.** Before-arm the frozen release
`128a1ca28d34`, after-arm the live tree. `data/games.ladder.jsonl` (206,789,118 B @ 04:03:19.248Z),
`data/games.bo3.jsonl`, `data/tags.json`, `data/diff-swarm.json` and `engine/diff_swarm.js` were
asserted identical in size and mtime **before, between and after both arms**, and the driver's own
content digest (`9438fce…`) was asserted equal across both — filed item (4) is still unfixed and this
is the workaround it demands.

| | before | after |
|---|---|---|
| **the target family, `-damage field 3`** | **46 games / 45 distinct causes** | **31 / 31** |
| of those, causes that are `[from]recoil` | 4 | **2** |
| diverged | 391 / 395 | **390 / 395** |
| whole-run control arm, every stone stripped | 391 / 395 | **389 / 395** |
| the same pairs with the stones removed | 389 / 393 | **387 / 393** |
| median completed turns before divergence | 1 | 1 — unchanged |
| classes | 12 | 12 |
| `event missing from medicham2` | 132 | **127** |
| `unrelated event mismatch` | 101 | 110 |
| `ordering` | 45 | 50 |
| `turn order` | 15 | 19 |
| `-heal field 3` | 2 | **0** |
| `-immune field 3` | 1 | **0** |
| mega evolutions issued and executed in both engines | 519 | 519 — unchanged |
| **distinct moves the driver got to CONNECT** | **177** | **176 — A LOSS OF ONE** |
| distinct abilities / items / species | 160 / 124 / 257 | **161** / 124 / 257 |
| census mechanics reached by a connecting move | 107 / 112 | 107 / 112 |

**THE COVERAGE DIRECTION IS DOWN BY ONE AND IS REPORTED AS SUCH.** 177 → 176 connected moves. WIRE 2
cost four, WIRE 3 bought five back, this one costs one; distinct abilities gained one in the same
run. `not_exercised` is 6. It is not worth chasing — a recoil that now rounds up kills its own user
slightly sooner, so a few clicks that used to happen do not — but a coverage figure that fell must
never be left to be rediscovered as a counter that quietly went down.

**THE RATE MOVED BY ONE GAME AND THAT IS NOT THE HEADLINE.** The headline is that a family of 45
distinct causes lost a third of its members to ONE arithmetic rule plus ONE rounding rule, with no
per-cause patching. Two classes grew, which is the same shape WIREs 1-3 recorded: a game stops at its
FIRST divergence, so clearing a cause makes the game run on and part deeper at whatever was behind it.
`total_lines_collapsed` is deliberately not quoted — filed item (6) — and the depth proxies here
(megas 519 → 519, median 1 → 1) did not move.

**THE INSTRUMENT'S OWN INPUT SET IS STILL WRONG, AND THIS WIRE FOUND THE SPECIFIC LEAK.** The first
before/after pair of this session read `-damage field 3` at **51 games / 50 causes**; a second run of
**the identical frozen release** over a **byte-identical store** read **46 / 45**. The run is
deterministic — a third run reproduced the second exactly — so something outside the 23-file
photograph reached the games. It is `data/mechanics-census.json`:

```js
/* How badly does the run still need this entity? Lower count = more wanted. A move is scored by the
 * least-exercised census mechanic it can reach, then by its own click count. */
const covWant = (sec, key) => { ... for (const t of COV_TARGETS) ... }   // COV_TARGETS := the census
```

**The driver STEERS its move choice by census coverage, and the census is a live file.** Landing a
probe in `tests/test-mechanics.js` therefore changes which moves the differential clicks and which
games it plays — so every before/after on this instrument is void unless both arms see the same
census. That is why both arms above were re-run after the census settled. Filed as (8) below.

**FOUR THINGS FILED AND NOT FIXED — they are WIRE 5+, not this one:**

8. ~~**`data/mechanics-census.json` STEERS THE DIFFERENTIAL AND IS NOT IN THE PHOTOGRAPH.**~~
   **CLOSED — ROADMAP #81 WIRE 5, at the top of this file.** The proposed fix in this line ("it belongs
   in `SOURCES`") is the one WIRE 5 rejected, and the reason is worth keeping: freezing the census
   inside the release would make the before-arm read the OLD census and the after-arm the NEW one, so
   the two arms would steer differently *by construction*. What landed instead is a declared, digested,
   pinnable selection policy plus a guard that refuses an incomparable pair. WIRE 5 also found a SECOND
   unlisted steering input — the live game store the swarm picks teams from — and stamps that too.
9. **RECOIL IS CHARGED ON UNCAPPED DAMAGE.** Showdown passes `move.totalDamage` — the HP actually
   removed — to `applyRecoilDamage`; medicham2 passes its raw roll. Killing a body on 1 HP with Brave
   Bird costs 1 in the real game and 21 here. **This is the whole of what remains of the recoil half
   of the family**: both surviving `[from]recoil` causes in the after-arm now have medicham *higher*
   by one, which is this and not the rounding. Not fixed because it needs the pre-hit HP threaded to
   the recoil site and this dispatch was one root.
10. **THE BASE-POWER MODIFIERS ARE APPLIED TO THE WRONG QUANTITY.** Technician, Tough Claws, the
    terrains, Muscle Band, the type-boost items and Dry Skin are all `onBasePower` in Showdown —
    they chain into ONE modifier applied to `basePower` before the damage formula. medicham2 applies
    them to the computed base damage (terrain, Technician) or folds them into the final ModifyDamage
    chain (the items). The ARITHMETIC is now right at both sites; the PLACEMENT is not, and the two
    differ by a truncation. Unmeasured — it needs its own sweep arm.
11. **`board.js` STILL DOES ITS MULTIPLIERS IN FLOAT.** `md4096`/`ch4096`/`mdChain` are exported from
    `medicham2-browser.js` precisely so there is one implementation, and board.js is not this
    division's file. It computes an EXPECTATION rather than an exact hit, so this may well be the
    legitimate exception CLAUDE.md already names — but nobody has checked, and "probably fine" is how
    the priority-blocking duplicate survived.

**ONE UNRELATED RED TEST WAS FOUND AND FIXED RATHER THAN FILED.** `tests/test-no-silent-failure.js`
was red on four NEW silent catch blocks in `engine/game_differential.js` — the format-standing
lookups added earlier the same day, none of them mine. Each hands a plausible value downstream on a
throw (an empty tag table, an empty carrier map, a null dex row) and every one of those reads exactly
like a legitimate absence, which destroys the `uses: 0` vs `uses: null` distinction the whole block
exists for. They now count and print themselves (`format-standing lookups that threw and fell back:
… (must all read 0)`), and the ratchet reads 219 against a baseline of 220 with 0 new. **It is not
re-baselined** — `--update` rewrites a shared artifact and that is not this dispatch's call to make.

## ROADMAP #81 WIRE 3 — THE REFUSED STAT DROP WAS SILENT *AND*, FOR FOUR ABILITIES, NOT ACTUALLY A REFUSAL. 2026-08-07.

Census **244 live / 245 probed → 246 live / 247 probed**, `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Red demonstrations **134 → 136, 0 failed** (two new, a different broken engine each). The
target family — a first divergence of the shape `|-fail|X|unboost|…` — **16 games → 1**, and the whole
`-fail` mention count **81 → 67**.

**THE FIRST QUESTION WAS WHICH BUG IT WAS, AND THE ARTIFACT CANNOT TELL YOU.** A `-fail` divergence is
consistent with the drop being blocked-but-unannounced (a protocol bug, cosmetic to the game state)
and with the drop being applied (a -1 Attack for the rest of the game). **Measured on STATE — the
target's `boosts.at` after the switch-in — before a line of the engine changed:**

| | medicham2 | Showdown | verdict |
|---|---|---|---|
| Intimidate → Clear Body | atk stage **0** | atk stage **0** | **BLOCKED, and silent.** A protocol bug. |
| Charm (−2 atk) → Inner Focus | atk stage **0** | atk stage **−2** | **REFUSED HERE AND APPLIED THERE.** A state bug. |

So it is **both**, and the second half is the expensive one — it was invisible to the differential
because those games part earlier, and invisible to the census because the existing probe
(`Clear Body refuses Intimidate`) is green on an engine that refuses everything from everyone.

**THREE SITES DECIDED THIS QUESTION AND NONE OF THEM READ THE TAG'S OWN `blocks` PARAMETER**, which
`tag_dex` has derived from `onTryBoost` since the day Will asked *"do we need to specify that clear
body is just a better hyper cutter"*:

| site | what it did | what `data/abilities.ts` says |
|---|---|---|
| `applyStatDrop`'s `INTIM_IMMUNE` | a ten-name list | — |
| the `statChange` + `statChangeInCode` pair | `TAGS.has(…,'preventsStatDrop')` — a **boolean** | Keen Eye / Illuminate / Mind's Eye delete `boost.accuracy` only; Big Pecks `boost.def` only; Inner Focus / Oblivious / Own Tempo / Scrappy fire only on `effect.name === 'Intimidate'` |
| the secondary `targetBoosts` block | a hardcoded `clearbody‖whitesmoke‖fullmetalbody` triple | Hyper Cutter deletes Breaking Swipe's −1 Attack; Big Pecks deletes Crunch's −1 Defense |

Measured membership of the over-block, before the fix: **Charm into Keen Eye, Illuminate, Big Pecks,
Flower Veil (on a Garchomp), Inner Focus, Oblivious, Own Tempo and Scrappy all read atk stage 0** and
Showdown lands −2 on every one of them. All eight now read −2. Exposure in the store: Clear Body 1,834,
Inner Focus 863, Scrappy 543, Oblivious 514, Own Tempo 61, and Intimidate itself 31,129.

**ONE GATE, FOUR CALLERS.** `statDropRefusal()` / `refuseStatDrop()` in `engine/medicham2-browser.js`
is the single reader of `preventsStatDrop` — CLAUDE.md's *"one implementation, everyone calls it"*,
and the reason the fix could not be split: emitting a `-fail` from three sites that disagree about who
refuses would have produced the *wrong* announcement in a new place. `blocks` comes from the artifact;
`accuracy` maps to no stage this engine has, so an accuracy-only blocker refuses **nothing** here,
which is the right answer rather than a skipped one. **The INTIMIDATE-ONLY scoping did not exist in the
artifact** — `engine/tag_dex.js` now derives `preventsStatDrop.onlyFrom` from
`effect.name === '…'`, and the engine reads that first with a named five-name bridge for the
pre-regeneration artifact, the same pattern WIRE 113's Simple/Defiant numbers use.

**THE ANNOUNCEMENT IS SUPPRESSED FOR A SECONDARY AND FOR OCTOLOCK; THE BLOCK IS NOT.** Every one of
these handlers guards its `this.add` with `!(effect as ActiveMove).secondaries`. Backwards, this would
have fired a `-fail` on every Icy Wind and parted the streams in a new place instead of an old one.
Verified on a live Champions battle rather than off SIM-PROTOCOL.md — both shapes, and the `-unboost`
that must still land:

```
|-ability|p1a: Incineroar|Intimidate|boost
|-fail|p2a: Metagross|unboost|[from] ability: Clear Body|[of] p2a: Metagross     blanket: no stat named
|-fail|p2b: Gallade|unboost|Attack|[from] ability: Inner Focus|[of] p2b: Gallade  scoped: the stat named
|move|p1a: Incineroar|Charm|p2b: Gallade
|-unboost|p2b: Gallade|atk|2                                                     Inner Focus does NOT refuse this
```

**TWO PROBES, EACH SHOWN RED ON ITS OWN BROKEN ENGINE** (`tests/probe_red_demo.js`, `demoSource` —
there is no tag to strip, the artifact was innocent), because these are two independent claims and one
demonstration would let either half ride on the other:

| probe | what separates the engines | the broken engine it is red on |
|---|---|---|
| `Inner Focus refuses INTIMIDATE and nothing else — a Charm still lands` | `[Intimidate, Charm]` = **`[0, −2]`** against `[0, 0]` | the `onlyFrom` scoping deleted — the blanket boolean read |
| `a refused stat drop is ANNOUNCED, naming the ability and (when scoped) the stat` | the canonised emit list, `[-fail, -fail]` against `[]` | the one `TR.failUnboost` call silenced |

**THE SECOND DEMO ASSERTS THE STAT STAGES TOO, AND THEY HOLD ON BOTH ENGINES.** That is the point of
it: the reverted build's state is byte-identical and only the protocol parts, which is exactly why this
family survived WIRE 1 and WIRE 2 and why the state had to be measured separately from the output.

**WHAT THE DIFFERENTIAL SAYS, BEFORE AND AFTER, ON THE SAME 395 GAMES** (`--games 450`; before-arm the
frozen release `6b6f898f136f`, after-arm `128a1ca28d34`). `data/games.ladder.jsonl` (206,789,118 B @
04:03:19.248Z), `data/games.bo3.jsonl`, `data/tags.json` and `data/diff-swarm.json` were asserted
identical in size and mtime **before, between and after both arms** — filed item (4) is still unfixed
and this is the workaround it demands.

| | before | after |
|---|---|---|
| **the target family — a first divergence `\|-fail\|X\|unboost\|…`** | **16 games** | **1** |
| all first divergences mentioning `-fail` | 81 | **67** |
| diverged | 393 / 395 | 393 / 395 — **unchanged** |
| whole-run control arm, every stone stripped | 394 / 395 | **393 / 395** |
| the same pairs with the stones removed | 392 / 393 | **391 / 393** |
| median completed turns before divergence | 1 | 1 — unchanged |
| classes | 13 | 13 |
| `event missing from medicham2` | 145 | **134** |
| `unrelated event mismatch` | 100 | 106 |
| `-damage field 3` | 44 | 48 |
| `extra event emitted by medicham2` | 37 | 38 |
| `turn order` | 13 | 14 |
| `ordering` | 41 | 41 |
| `-heal field 3` | 2 | **1** |
| **distinct moves the driver got to CONNECT** | 173 → 169 (WIRE 2) | **174** |
| `not_exercised` | 7 | 7 — the identical seven |
| census mechanics reached by a connecting move | 104 | 104 |
| mega evolutions issued and executed in both engines | 504 | **518** |

**THE COVERAGE COST WENT THE OTHER WAY THIS TIME, AND IT IS STILL WORTH STATING.** WIRE 2 cost four
connected moves (173 → 169) because a correctly-resetting shield goes up more often. This wire **buys
five back, 169 → 174**, and `not_exercised` is the same list of seven — a scoped refusal means a Charm,
a Parting Shot and a Breaking Swipe now *do something* instead of being silently eaten. Distinct species
fell 257 → 256, which is the same mechanism working against it and is reported rather than omitted.

**THE DEPTH NUMBER IS `mega evolutions`, NOT `total_lines_collapsed`.** Filed item (6) stands:
`total_lines_collapsed` is quadratic in depth (54,773 → 56,906 here) and is not a line count. Mega
evolutions are individual in-game events counted once each, agreed by both engines, and 504 → 518 is a
2.8% deeper run on the same 395 games.

**THE ONE SURVIVOR OF THE FAMILY IS NOT A REFUSAL BUG.** It reads
`extra event emitted by medicham2 :: |-fail|p2a|unboost|[from]clearbody <> |-heal|p1a|H/H|[from]hospitality`
— the `-fail` is correct and is landing at the wrong point in the ENTRY-EFFECT ORDER, beside the
already-present `|turn|1 <> |-heal|p2a|H/H|[from]hospitality` (9 games → 10). Filed as (10).

**THREE THINGS FOUND ON THE WAY, FILED AND NOT FIXED:**

8. **GUARD DOG DOES NOT REFUSE INTIMIDATE — IT REVERSES IT, AND THIS ENGINE STILL BLOCKS.** Measured in
   the authority: an Okidogi met by Intimidate emits `|-ability|p2a: Okidogi|Guard Dog|boost` then
   `|-boost|p2a: Okidogi|atk|1` and ends at **atk stage +1**; medicham2 leaves it at 0. It is the same
   `onTryBoost` family and the same one gate, but it is a BOOST rather than a refusal and needs its own
   probe, so it was left at its pre-wire behaviour rather than guessed at. Exposure in the store is
   small — Guard Dog does not appear in `data/games.ladder.jsonl` at all — which is why it is filed
   rather than bundled.
9. **MIRROR ARMOR REFLECTS THE DROP BACK AT THE SOURCE AND ANNOUNCES `|-ability|X|Mirror Armor|`.**
   `data/abilities.ts` deletes the boost, adds the ability line, and applies the negative boost to the
   SOURCE. medicham2 blocks it, which is right about the holder and wrong about the attacker; the new
   gate deliberately suppresses the `-fail` for it (`REFLECTS_DROP`) rather than inventing a line
   Showdown does not write. ~390 mentions in the store, on Corviknight.
10. **THE ENTRY-EFFECT ORDER PUTS HOSPITALITY'S HEAL IN THE WRONG PLACE.** Two shapes, both present
    before this wire and both grown by one game as games run deeper: `|turn|1 <> |-heal|…hospitality`
    (9 → 10) and the surviving `-fail` above. WIRE 123 ordered the entry ABILITIES by Speed; the heal
    itself appears to resolve after the announcement block rather than inside it. Not measured further —
    it is a different wire.

## MEGA EVOLUTION IS A CHOICE NOW, MADE MID-TURN, AND THE DIFFERENTIAL HAS ITS MEGAS BACK. ROADMAP #31 + #68. 2026-08-07.

Census **234 live / 235 probed → 240 live / 241 probed**. `unarmed` 0, `directCall` 0, `hollow` 0,
red demonstrations **128 / 0 failed** (six new, one broken engine each). `data/game-differential.json`
re-run: **`mega_stones_stripped` 0**, 372 stone sets kept, **181 evolutions in each engine**.

**WHAT WAS WRONG, MEASURED BEFORE ANYTHING CHANGED.** `buildMon('gengar', {})` returned a body that
neither engine models:

```
stats  135/76/80/200/95/170   <- BASE Gengar
ability  shadowtag            <- MEGA Gengar
```

The two halves failed in opposite directions and cancelled. `megaForme()` resolves through
`window.MEGA_FORMES`, which does not exist under node, so the STATS never swapped; `megaAbility()`
reads a module-level table, which always works, so the ABILITY always did. Showdown's Gengar has
Cursed Body until it evolves **on a choice, mid-turn**, so a stone parted the two protocol streams on
line one of every game carrying one — which is why the first whole-game differential had to strip 460
sets and test **zero mega bodies** in a ~26%-mega format.

**WHAT IT IS NOW.** `buildMon` returns the BASE forme holding the stone. `megaTargetFor(mon)` DERIVES
the capability from the body's own name and item every time it is asked — never a flag stamped at
build time, because the item moves (Knock Off, Trick, `b.item = x` after the build, which is what the
harness and every probe do) and a stamp that did not happen looks exactly like a body that cannot
mega. `megaEvolveNow(S, mon)` performs the evolution inside the turn.

**THE POSITION IN THE TURN IS THE MECHANIC.** Showdown queues it at ORDER 104 —
`sim/battle-queue.ts:184` — below `switch` (103) and above every move (200). This engine orders
everything through one comparator and a bare switch sits at priority 6, above the format's ceiling of
+5, so "after the switches, before the moves" is exactly "the first action with priority below 6". A
pre-pass before the loop would be wrong and observably so: a Pelipper switching in sets rain at 103,
and a Charizard megaing into Drought at 104 must paint over it rather than the other way round.

**AND THE TAIL IS RE-SORTED, BECAUSE THE MEGA'S NEW SPEED GOVERNS THE TURN IT ARRIVES IN.** Showdown
gets that for free (gen ≥ 8 re-sorts the queue before every `move` action, which is after the megaEvo
actions have run); WIRE 118's re-sort here only fires for `actIdx > 0`, so a mega on the first action
would have left the whole turn ordered on PRE-mega Speed.

**TWO MEGAS IN ONE TURN RESOLVE IN SPEED ORDER AND ONLY SPEED ORDER.** The first cut walked the
already-sorted action list, which is (priority, speed) — and megaEvo actions carry no priority;
`comparePriority` breaks the tie at order 104 on `speed` alone. So a slow body clicking Protect (+4)
megaed before a fast body clicking an attack. **The differential caught it**, as
`|detailschange|p1b: Glimmora-Mega <> |detailschange|p2b: Drampa-Mega` — the same two bodies evolving
in opposite orders — and the ordering class fell from 26 games to 19 when it was fixed.

**THE ABILITY IS AN OVERWRITE, AND THE TEST FOR IT IS AN EQUALITY.** `setAbility(species.abilities[0],
null, null, true)` still fires the ability's `Start` handler, so an entry-style ability on the mega
forme fires ON EVOLUTION — that is `applyEntryEffects` + `applyEntryDrops`, the same two calls
`battleInit` makes for a lead, so a mechanic wired for a switch-in cannot be missing for an evolution.
**Asserting "the ability changed" would fail on a correct engine**: measured against
`Dex.forFormat('gen9championsvgc2026regmb')`, **8 of the 74 megas in this format keep their base
slot-0 ability** (Tyranitar-Mega Sand Stream, Medicham-Mega Pure Power, Abomasnow-Mega Snow Warning,
Malamar-Mega Contrary, Barbaracle-Mega Tough Claws, Drampa-Mega Berserk, Chimecho-Mega Levitate,
Audino-Mega Healer). That list is read from the dex, never maintained here.
`tests/test-mega-timing.js` drives **all 74** through a real turn and asserts the evolved `.ability`
EQUALS the dex's value for that forme; the count of ability-keepers is printed so the equality can
never become vacuous.

### The six proofs, each red on its own broken engine

| proof | where | the broken engine it was shown red on |
|---|---|---|
| the body is BASE at build and evolves on a CHOICE | census `item:megaStone` | `buildMon` runs `megaAbility()` again — the pre-change engine |
| the ability is OVERWRITTEN and the new one FIRES | census `ability:megaAbilityOverwrite` | `megaEvolveNow` returns false at entry |
| either slot | census `item:megaStone` + `test-protocol-trace` PART 2 | `if (slot !== 0) return false` — the literal historical defect |
| the new Speed governs the turn | census `item:megaStone` | the tail re-sort removed; it still evolves, correctly, too late |
| an entry ability fires on evolution | census `ability:megaEntryAbility` | the two `applyEntry*` calls removed |
| one mega per side per battle | census `item:megaStone` | the `sf.megaUsed` test removed |

**THE OVERWRITE PROOF USES SKILL SWAP, NOT WORRY SEED, AND THAT IS A FINDING RATHER THAN A
SUBSTITUTION.** Will's acceptance case is *"Worry Seed a Tyranitar to Insomnia, then mega it"*.
Measured first: **`worryseed` carries only `moveClass` and `statusCategory` in `data/tags.json` — no
ability-writing tag — so this engine does not implement it and the move is inert.** A probe built on
it would have been green while proving nothing, because both arms would have started from Sand
Stream. Skill Swap is the same mechanism and is wired. The probe swaps Sand Stream away, puts RAIN on
the field so "the sandstorm returned" cannot be satisfied by a sandstorm nobody cleared, and then
megas: ability back to `sandstream`, sky back to `sand`.

**THE RATE FLOOR IS ON THE CHOICE, NOT ON THE SIDE.** Every choice the differential's driver issues
came from Showdown's own `canMegaEvo`, so **every one must produce exactly one evolution in each
engine** — 181 / 181 / 181, a hard 100%. "Sides that brought a stone" reads 181 / 255 (71.0%) and is
deliberately **not** the floor: a game stops at its first divergence, the median game lasts one
completed turn, and a benched stone-holder is never offered the choice. Making that the floor would
be measuring the harness's early stop. `tests/test-protocol-trace.js` PART 2 carries the other floor —
every side that COULD mega DID (8/8), from both slots (4 left, 4 right) — because its games run to the
end.

### Three things the same-weather rule and the identifier fixed, each found rather than assumed

- **RE-SETTING THE WEATHER THAT IS ALREADY STANDING IS A NO-OP, AND NOT A REFRESH EITHER.**
  `sim/field.ts setWeather()` returns false when `this.weather === status.id` for an Ability source in
  gen > 5; `setTerrain()` does the same unconditionally. This engine set and announced it every time.
  It was reachable before (two weather setters, one arriving under the other's sky) and ROADMAP #31
  makes it constant — a Tyranitar sets sand on entry then megas into Sand Stream on turn one, so
  **every mega weather setter emitted a `-weather` line Showdown does not, on the line straight after
  the `-mega`.**
- **THE PROTOCOL IDENTIFIER IS THE NICKNAME AND MUST NOT FOLLOW THE FORME.** Showdown's `|switch|p1a:
  X` field is `pokemon.name`, which `formeChange` never touches: a Tyranitar that megas keeps emitting
  `p1a: Tyranitar` for the rest of the battle and the new forme appears only in `|detailschange|`.
  This engine keyed it off `m.name`, which IS the forme. Unreachable before mega existed in-battle —
  **with one exception that was already live: Zero to Hero rewrites `m.name` to `palafin-hero`, so a
  Palafin that pivoted parted the streams on every later line it appeared in.** `_ident` is stamped by
  `buildMon` and re-stamped for anything `battleInit` is handed without one.
- **SHOWDOWN DEFAULTS THE NICKNAME TO `baseSpecies`.** A set whose name equals its species is renamed
  when the battle loads it, so a Floette-Eternal is `|switch|p1a: Floette|Floette-Eternal, L50|`. That
  parted 35 games in one run — **a class that had been there all along behind a silent drop**, because
  the harness keyed species with `id()`, which strips hyphens, so `floetteeternal` missed
  `data/engine-data.js`'s `floette-eternal` and **117 sets counted as unbuildable and left the run**.
  Routing that through `mcKey` took `sets_unbuildable` **117 → 0** and `teams_unbuildable` **3 → 0**.

### What the differential says now, and what it still cannot say

`mega_stones_stripped` reads **0**. Both engines are built Serious / 0 EVs / 31 IVs from the same base
stats, so `alignStats` had to move a stat **0 times** in 139 games — the two are literally the same
Pokemon rather than one being copied onto the other, which is what makes a forme change survivable at
all (`setSpecies` RECOMPUTES `storedStats` mid-turn from the SET, and `battle.choose` runs the whole
turn, so there is no seam for a harness to re-align in). The cost is stated and is new: **the ladder's
SPREADS are no longer tested.**

**THE RATE IS SATURATED, SO IT CANNOT ANSWER "WHAT DID MEGAS COST" AND THE ARTIFACT DOES NOT PRETEND
IT CAN.** Every pair is played TWICE, same seeds, same frozen driver state, stones the only
difference:

```
with megas, on the pairs that carry a stone   139/139
the SAME pairs with the stones removed        139/139
stoneless pairs whose two arms differed          0   (the pairing is sound)
```

So the paired comparison is reported instead: of 139 stone-carrying pairs the mega arm parted EARLIER
on 15, LATER on 96 and at the same line on 28, and **0 games have a `|-mega|` line as their first
divergence** — nothing in this run is attributable to the evolution itself. `|detailschange|` is
first on exactly 1, and it is a **Palafin**, not a mega, which is why the two are counted apart.

**FILED, NOT FIXED — ZERO TO HERO IS SILENT.** Showdown transforms Palafin on **switch-OUT**
(`|detailschange|p1a: Palafin|Palafin-Hero, L50`) and announces `|-activate|…|ability: Zero to Hero`
on the way back in. medicham2 transforms on the RETURN, inside `bringIn()`, and emits neither. That is
a different moment and two missing lines, and the emitter for it now exists.

### WIRE — KNOCK OFF'S ×1.5 KEPT THE HALF, AND SHOWDOWN TRUNCATES IT. FOUND AND FIXED IN THIS PASS.

The first re-run read `showdown 87..103` against `medicham 88..105` on the knock-off scenario, while
the contact-punish scenario on the same page agreed at both ends. The only difference between them is
Knock Off's item multiplier, and the arithmetic is exact:

```
showdown  chainModify(1.5) is FIXED POINT — tr(tr(65 * 6144) / 4096) = 97
          22*97   * 135/85 /50 + 2 = 69   -> STAB x1.5 -> 103
medicham  65 * 1.5 = 97.5, and the half survived every later floor
          22*97.5 * 135/85 /50 + 2 = 70   -> STAB x1.5 -> 105
```

Two points, on **3,341 corpus uses**. `mvBP=Math.floor(mvBP*_vp.mult)` in the `targetHasItem` branch,
and ONLY that branch: the other two variable-power multipliers are ×2 on integer base powers (Hex 65,
Infernal Parade 20, Acrobatics 55) and two of the three reach it through `basePowerCallback` returning
`bp * 2`, which is a plain multiply upstream and does NOT truncate — flooring them would assert a
rounding rule Showdown does not apply. Knock Off is the only member carrying a non-integer `mult`.

**IT HAD BEEN INVISIBLE, AND THE REASON IS THE LESSON.** The staged bodies used to carry the dataset's
spread and the two engines happened to land on the same integer, so `endpoints_agree` read **true for
a reason that had nothing to do with the arithmetic being right**. Flattening the harness's stat line
for ROADMAP #31 moved it off that coincidence. `tests/test-engine-diff.js` compares exactly these two
endpoints at 149/150 and did not see it either — it stages its own pairs and never hit the pairing.
After the fix: interior endpoints AGREE on both scenarios, `test-engine-diff` unchanged at 1/150, and
`tests/test-game-differential.js` back to ALL PASSED (its ordering assertion had gone red too, because
the knock-off scenario was parting on the DAMAGE line before the ordering line could show).

### THIS INVALIDATES MAG'S WEIGHTS, AND THAT IS THE INVALIDATION GRAPH WORKING RATHER THAN A BUG

`node engine/status.js` now opens with:

```
FEATURE SEMANTICS CHECK FAILED — data/policy-weights.json
    switchSurvives1  (0e94b1687aa4 -> 54d70a9e6ad9)
    switchKOSlow     (2045dd8d8175 -> 9c9d7efd0c30)
    switchDiesFirst  (83f864ebe7e8 -> c22f00eb026f)
```

It was clean at the start of this session, so this is ROADMAP #31 and nothing else. The three
features are computed on a STATIC build of a bench body, and a stone-holder's static build changed:
it used to carry the mega's ABILITY with the base's STATS and now carries the base forme's ability
plus the capability to evolve. **That is CLAUDE.md's own case — the weights were fitted against the
old definition and no longer describe these quantities.** ENGINE cannot close it: a refit is MEASURE's
and running one from here is out of bounds. **Routed, not filed.**

### `tests/test-effective-identity.js` — GREEN, AND THE WAY IT GOT THERE IS THE RECORD

**19 passed, 0 failed.** Section 2b was rewritten to pin the new contract at BOTH moments — `.ability`
is the base forme's before the choice (62/62) and the mega forme's after a real turn (62/62), and an
evolved body agrees with the mega row (61/61). That is a STRONGER claim than the one it replaced, not
a weaker one: the old assertion was green on a chimera.

Two of the ratchet's three growers are now DECLARED with construction reasons —
`engine/game_differential.js` (the harness AUTHORS both engines' teams, so the reads are assignments
of the sheet's DECLARED ability, which is exactly what a mega must evolve *from*) and
`tests/test-mega-timing.js` (two dex reads, which are the authority, and one read of the value under
test). The third, `engine/mega_decision_census.js`, is another division's and they declared it
themselves. `tests/test-no-silent-failure.js`: **0 new**.

**THAT FILE WAS OVER THE IDENTITY RATCHET FROM THE MOMENT `engine/game_differential.js` WAS WRITTEN,
and neither ROADMAP #31 nor anybody's regression caused it.** `data/effective-identity-baseline.json`
is dated **2026-08-02**; every read in a file newer than the baseline counts as new, and the
differential harness was written on 2026-08-06. It had been red for a day waiting for someone to look.
Recorded in the DECLARED entry itself so the next reader does not spend the time working it out again.

**AND A PROCESS LESSON THAT COST REAL WORK, WRITTEN DOWN BECAUSE IT IS CHEAP TO WRITE AND EXPENSIVE TO
REPEAT.** This section's changes were destroyed once and rebuilt by hand. A second agent, clearing an
unrelated syntax error in the same file, ran `git checkout -- tests/test-effective-identity.js` while
the ROADMAP #31 edits sat UNCOMMITTED. **A working-tree overwrite has no reflog and git cannot bring
it back** — the same permanence CLAUDE.md already records for deleting an untracked file, reached
through a command that looks like a revert rather than a delete. The old contract came back and went
RED against a correct engine, asserting the chimera again, which is precisely what the rewrite exists
to stop. It is restored verbatim rather than approximately, and the block says so in its own header.
**The rule this earns: `git checkout --` on a path is a DELETE of whatever is uncommitted under it,
and belongs to whoever holds that file.**

## THE COMPARISON DRIVER RUNS. 159 OF 160 REAL GAMES DIVERGE, AFTER A NORMALISER THAT PROVES ITSELF. ROADMAP #68, STEP TWO. 2026-08-06.

Census **234 live / 235 probed → 234 live / 235 probed**, unchanged: nothing in this pass touched a
mechanic. `unarmed` 0, `directCall` 0, `hollow` 0, differential 1/150, red demonstrations 122/0
failed, coverage ratchet held, conformance ratchet 0 new, silent-failure ratchet 0 new. The one
number that moved is a new one: **`data/game-differential.json`, 160 games, 160 diverged, 0 threw,
19 classes.**

`engine/game_differential.js` plays one team pair through BOTH engines under a pinned die, aligns the
two protocol streams, and records the **first differing line**. Gated by
`tests/test-game-differential.js`, which goes red only when the INSTRUMENT is wrong — a divergence is
a finding, exactly as the census reports a missing mechanic.

**READ THAT RATE WITH THIS BESIDE IT: 460 mega-stone sets were stripped, so THIS RUN TESTED ZERO MEGA
BODIES in a format whose mega usage is ~26%.** It is stated at the top level of the artifact
(`rate_excludes`) and not only in `declared_gaps`, because a reader who takes `diverged / games` and
nothing else has taken a number about a format with the megas removed. Closing it is the next job and
it is the same change ROADMAP #31 already requires — mega must become a CHOICE, not a build-time
default, or a search can never decide whether to mega.

> **CLOSED 2026-08-07 — see the ROADMAP #31 section at the top of this file.** Everything from here to
> the end of the 2026-08-06 section is the record of the run that had no megas in it, kept as written.
> `mega_stones_stripped` reads **0** now and the stone-holding sets are on the field; the figures below
> are that run's and are not restated.

### THE FIRST RUN'S RATE WAS NOT A RATE, AND SAYING SO IS THE POINT

Run one read **160 / 160 diverging with a median of ONE completed turn**, and the largest class (44
games) was the TARGET FIELD of a spread move — Showdown names one victim plus `[spread]`, this engine
names its own user. Beside it:

```
showdown  |-ability|p1a: Sharpedo|Speed Boost|boost
medicham  |-boost|p1a: sharpedo|spe|1|[from] ability: speedboost
```

Same mechanic, same state change, two spellings. **That number measured how fast the two PROTOCOLS
look different, not how often MEDICHAM is WRONG** — §2.2 of the design, the Csmith lesson, arriving in
our own instrument: where the compared thing is not semantically meaningful the oracle collapses and
the real bugs drown. And they were in there, unranked against the noise.

So a **semantic normaliser** sits under the aligner, and it is the dangerous part of the instrument,
so it carries two rules of its own:

**1. AN EQUIVALENCE MUST NOT BE ABLE TO NORMALISE A REAL BUG AWAY.** Each rule carries a pair that
must compare EQUAL (the form it collapses) and a pair that must still compare UNEQUAL (the meaning it
must not). Both directions run before any game does, and `tests/test-game-differential.js` PART 1b
fails on either. **A rule with no red demonstration is a silencer, not a normaliser**, and does not go
in the list. The general argument that makes all seven safe is one sentence: **every rule drops an
ANNOUNCEMENT or an ATTRIBUTION and never a STATE CHANGE.**

**2. WHAT IT COLLAPSED IS COUNTED AND PUBLISHED, PER RULE.** A normaliser whose effect is invisible is
how a 100% divergence rate becomes 2% with nobody able to say whether the engine improved or the
comparator got quieter.

| rule | lines collapsed | what it drops, and why that is not a state change |
|---|---:|---|
| `move-target-field` | 2,472 | a `\|move\|` line means "this body used this move". WHO WAS HIT is in the `-damage` / `-status` / `-unboost` / `-enditem` lines that follow, which are kept and compared body by body — so a redirection bug is caught one line later, not never. Its `distinct` pair is exactly that case |
| `effect-namespace` | 784 | `move: Reflect` against a bare `Reflect`. The NAME is kept |
| `display-flags` | 492 | `[silent]`, `[still]`, `[miss]`, `[spread]`. Each decorates a state carried by a separate event (`-miss`, `-prepare`, one `-damage` per body) |
| `ability-announcement` | 480 | `\|-ability\|` is a cosmetic announcement; every consequence is a separate line, so an ability that did not fire still shows as a missing effect |
| `source-tag` | 351 | `[of] pXy`, whose effect name `[from]` already carries |
| `switch-cause` | 32 | `[from] U-turn` on a pivot switch — the pivot is the `\|move\|` line right before it |
| `stat-attribution` | 16 | `[from] ability: X` on a stat line. Body, stat, direction and amount are all kept |
| | **4,627** | **total across 7 rules, all seven proved in both directions** |

**AFTER IT: 159 of 160 games diverge, 0 threw, 14 classes** (was 160/160 and 19). The rate barely
moved and that is the honest answer — the shape noise was hiding real classes rather than inflating a
small number. What moved is that the classes now name mechanics.

**A HARNESS BUG THE NORMALISER EXPOSED, AND IT WAS MINE:** four games threw
`Can't move: You can't choose a target for Solar Beam`. Showdown OMITS the `target` field from a
request entry for a LOCKED move — the second turn of Solar Beam or Phantom Force — because the target
was chosen when the move started. Falling back to the dex row supplied one anyway. `'target' in mv` is
the authority answering; `mv.target || dm.target` was a guess.

**BOTH PREDICTED FINDINGS REPRODUCE, WHICH IS THE ACCEPTANCE TEST FOR THE ALIGNMENT ITSELF.** §5a
filed them by hand before this driver existed; a harness that cannot reproduce a finding somebody
already made without it is misaligned.

```
knock-off order        10 lines agreed, class "ordering"
  showdown  |-damage|p2a: Snorlax|135/235                        <- HP first
            |-enditem|p2a: Snorlax|Leftovers|[from] move: Knock Off
  medicham  |-enditem|p2a: snorlax|leftovers|[from] move: knockoff   <- item first
            |-damage|p2a: snorlax|135/235
contact punish         12 lines agreed, class "ordering"
  showdown  target -damage, -unboost, -unboost, THEN Rough Skin's -damage
  medicham  Rough Skin's -damage THREE LINES EARLY, before the target's HP moves
```

End-of-turn state is identical in both, which is exactly why `tests/test-game-diff.js` agrees on all
five of its scripted games and the trace does not. **That is §5's whole argument, now mechanical
rather than hand-run.**

**THE DAMAGE INTERIOR IS MEASURED RATHER THAN QUOTED.** The second filed prediction was that
`tests/test-engine-diff.js` compares `roll=0` against min and `roll=15` against max, so 149/150 is
compatible with every middle roll being wrong. Measured on a staged Knock Off:

```
showdown 84..100, 12 distinct values over its 16 rolls
medicham 84..100, 17 distinct values sampled UNIFORMLY
endpoints AGREE; medicham can roll 86, 89, 92, 95 and 98 and Showdown CANNOT
worst per-value probability gap 6.62 points (5.36 on the contact-punish case, where the spans match exactly)
```

So the two engines agree on the range and disagree on the distribution inside it. **Mode B is not
optional and it is not far away** — that is a rate error of up to 6.6 points per damage value, on
every hit, invisible to every instrument this division owns.

**THE PIN IS THE PART THAT NEEDED THINKING ABOUT, AND IT IS ASSERTED ON BEHAVIOUR.** medicham2 rolls
`min + floor(rng * span)` — eleven integers. Showdown rolls `tr(tr(base * (100 - random(16))) / 100)`
— sixteen indices, **inverted**, index 0 being maximum damage. Different sizes, opposite senses:
there is no scalar that makes them agree in the middle. So Mode A pins the damage roll to the
**maximum on both sides**, which is the endpoint `test-engine-diff` already validates, and pins
everything else on the Showdown side to the TOP of its range, which is the reading that agrees with
medicham2 at `rng = 1 - 1e-9` event for event. Nine claims are checked before a game runs, and
`PIN_CHANCE` is defined AS `pinRandom(den) < num` so CHANGELOG 3.45.0's two-different-dice failure
cannot recur by construction. **A sub-100-accuracy move therefore MISSES in both engines** — symmetric,
no false divergence, and a real coverage hole the report states in as many words (32 moves this run).

**THE PLANTED-DIVERGENCE PROOF FAILED TWICE BEFORE IT WAS HONEST, AND BOTH FAILURES ARE THE HOUSE
SHAPE.** It first reported all three plants "caught at line 0", which reads as a healthy comparator:
`battleInit` takes the team BY REFERENCE, so the second arm was playing from the wreckage of the
first and its leads announced already-damaged HP. Fixed, it reported NOT CAUGHT: the driver is
coverage-seeking and therefore **stateful**, so the clean and planted arms were not the same game.
Fixed again, one plant passed for the wrong reason — the plants ran on the pre-turn-1 alignment where
the stream is four lines long, so the swap plant wrote `undefined` into the stream and was "caught"
at the line it had corrupted by accident. The plants are now indexed off the clean run's OWN
divergence, so each lands inside the agreeing prefix, and the test asserts **caught AND earlier than
the clean divergence AND at exactly the planted line**.

### The 14 classes, after normalisation — a class is a WIRE, an instance is not

Median game still parts after **one completed turn**, so nothing below is about long sequences yet.

| games | causes | class | what it is |
|---:|---:|---|---|
| 55 | 32 | `unrelated event mismatch` | two unrelated things at the same index. Led by **`-singleturn protect` against our `-fail`** (9 games — the two engines disagree about whether a Protect SUCCEEDS) and by medicham2 emitting a Hospitality `-heal` where Showdown emits none |
| 49 | 46 | `event missing from medicham2` | Showdown emits something we do not. **`\|move\|X\|trickroom` — medicham2 emits no `\|move\|` line for Trick Room at all** (5 games); `-fail\|unboost\|[from] clearbody` and the Inner Focus / Own Tempo / Oblivious / Scrappy family refusing Intimidate; **Mirror Armor, where Showdown reflects the drop and we unboost our own side** |
| 18 | 14 | **`ordering`** | the predicted one, and more. **Which side's Intimidate resolves first (4 games)**; `-start substitute` against the `-damage` that pays for it; Protean's typechange against the effectiveness line; a drain heal against the faint it causes |
| 9 | 9 | **`turn order`** | nine distinct games where a different body moves first |
| 8 | 8 | **`-damage field 3`** | **off by one under a pinned MAXIMUM roll** — recoil (`118/160` vs `119/160`) and direct damage. One game is worse: `H/H` against `0 fnt`, i.e. one engine kills and the other does not |
| 8 | 8 | `extra event emitted by medicham2` | Mummy's `-activate` before the damage; a `-boost` at upkeep; Protect's `-activate` where Showdown says `-immune` |
| 3 | 3 | `-miss field 3` | medicham2 emits `-miss` with no target, or names the wrong one |
| 2 | 2 | `switch: a different body` | **Illusion: Showdown announces the disguise, medicham2 announces Zoroark.** Both games |
| 2 | 2 | `-start: a different body` | Perish Song counted on the wrong side, and at a different count |
| 1 each | | `-immune field 3` (Good as Gold unattributed), `-boost: a different body` (**and its identifier is `??`**), `-damage field 4` (High Jump Kick crash tagged as generic recoil), `-activate field 4` (Skill Swap does not name the two abilities), `-status field 4` (sleep unattributed to Hypnosis) |

**THE REMAINING SHAPE CLASSES ARE NOT COSMETIC AND MUST NOT BE DEPRIORITISED AS SUCH.** They are what
stops the median game reaching turn two, so every sequencing question past the first turn is still
untestable. Closing the top two is what buys the instrument its depth.

### The Knock Off ordering, asked as TWO INDEPENDENT HALVES, and the prediction was WRONG

Showdown's `data/moves.ts:9962` takes Knock Off's x1.5 in `onBasePower` BEFORE damage and calls
`takeItem()` in `onAfterHit` AFTER it. Colbur Berry (`items.ts:1133`) is `onSourceModifyDamage` and
fires INSIDE the calculation; Sitrus (`items.ts:5740`) is `onUpdate` and fires after `takeItem` has
run. Opposite answers, same move, same turn. **The two halves are asserted apart on purpose: if the
1.5x were also evaluated after removal, a lost boost and a lost halving would partially cancel and the
net would look fine — the worst outcome, because it looks like agreement.**

```
boost      x1.5 for holding an item        showdown 1.471   medicham 1.480   (expected 1.5)
reduction  x0.5 Colbur vs super-eff Dark   showdown 0.500   medicham 0.500   (expected 0.5)
net        the two multiplied              showdown 0.735   medicham 0.740   (expected 0.75)
the three arms are distinguishable: 204 / 300 / 150   (x8 HP pool, or all three clamp to 135 and
                                                       both ratios read 1.0 and both checks are vacuous)
```

**THE PREDICTED DAMAGE BUG DOES NOT REPRODUCE, and the diagnosis is the finding.** The prediction was
that stripping the item first means *"Colbur can never fire for us — we deal full super-effective
damage where Showdown deals half"*. It fires. medicham2 prices **both** halves correctly, because
`playerAction` computes the damage RANGE at CLICK time, before the item is stripped, so the ordering
costs no damage here at all.

**What DOES differ is the item's DISPOSITION:**

```
showdown  |-enditem|p2a: Gengar|Colbur Berry|[eat]        <- the berry ate ITSELF, inside the calc
          |-enditem|p2a: Gengar|Colbur Berry|[weaken]        so takeItem() then found nothing
medicham  |-enditem|p2a: gengar|colburberry|[from] move: knockoff|[of] p1a: incineroar
```

Same end state, **different FACT** — and *"was it eaten"* is exactly what Harvest, Recycle, Belch, Cud
Chew and Unburden read. The Sitrus half **agrees exactly**: both engines strip it and neither heals.

### Two corrections to `traceCanon`, both of which it already CLAIMED

Found by the driver on its first run, and the claim-before-truth is the worse half:

- **the hyphen.** This engine holds ids (`doubleedge`), Showdown writes display names
  (`Double-Edge`). Lowercasing alone leaves `double-edge`. Every hyphenated move, apostrophe species
  and `-mega-y` forme read as a divergence. Now folded, together with `.` (`Mr. Rime`, reported as
  `switch: a different body  mr.rime <> mrrime`) and combining diacritics (`Flabébé`). **Known
  residue, stated: `Type: Null` carries a COLON, which is structural, so it is not folded.**
- **the side field.** The comment claimed "`p1: A` → `p1:a`, and this engine emits `p1: ` → `p1:`, so
  the player name is dropped from both". It was dropped from NEITHER. Every `-sidestart` and
  `-sideend` in every game parted on a player name this engine does not have.

Fields 0 and 1 are structure and are left alone — folding `-` out of field 1 would rename half the
protocol.

### What the run says it did NOT test — the honest half

- **Coverage is reported at two strengths and they are deliberately not added up.** `91 / 106`
  mechanics reached by a move that CONNECTED; `78 / 86` reached only by an ability or item that was
  ON THE FIELD. The median game parts after one turn, so most of those bodies never acted. **Present
  is not exercised**, and a single union figure (170/192) would be the 12%-tolerance mistake again.
- **43 of the 235 census rows are declared UNMEASURABLE by this instrument**, each with its reason —
  they name an INTERACTION (`intimidateRetaliationNet`, `drainThenPunishOrder`) rather than a
  taggable entity. Counted as covered or as uncovered they would both be wrong.
- **33 moves were clicked and ALWAYS missed** under the pin, and are not counted as covered.
- **NO MEGA BODY WAS TESTED AT ALL.** 460 stone-holding sets were stripped, because medicham2 megas at
  BUILD time and Showdown megas on a CHOICE — a stone parts the streams on the `|switch|` line of turn
  zero in every game that carries one. `tests/test-mega-timing.js` owns that question; this instrument
  cannot answer it until they agree on WHEN. **(CLOSED 2026-08-07, ROADMAP #31: 0 stripped, 372 kept,
  181 evolutions in each engine.)**
- **Gender is `N` on both sides**, so Attract, Rivalry and Cute Charm are not exercised. Same control,
  same reason, as CONTROL FIX 6 in the damage differential.
- **`MEDFAILS.traceBodyOffField = 2`** across 160 games — a `??` identifier reached the stream (first:
  a Roar phazing a body off the field). `tests/test-protocol-trace.js` PART 6 says this must read 0;
  it does on that file's own games and does not on these.
- 3 teams and 117 individual sets could not be built in both engines and were skipped, counted.
- `omit-priority` produced **3 games** against 20 for every other configuration: only 7 of 7,256 real
  teams carry no priority move. The starvation is the swarm's, not the format's, and is printed.

### Filed by the whole-game differential, not fixed

Every item below has a reproducing class in `data/game-differential.json`. Nothing here is a probe
yet, so nothing here is in the census — that is the next pass's job, and the working rule at the top
of this file applies.

- **the two ordering findings** — knock-off / resist-berry / contact-punish resolve against the target
  before its HP is subtracted. Staged in `DIRECTED` and gated by `tests/test-game-differential.js`.
  **the Knock Off section above establishes this costs no DAMAGE**; what it costs is the item's disposition.
- **the resist berry is a THIRD shape, not the same as knock-off.** Showdown spends it with
  `-enditem ... [weaken]` BEFORE the damage line; medicham2 emits no `-enditem` in the window at all.
- **Trick Room emits no `|move|` line at all** — `playerAction` returns `kind:'trickroom'` and that
  branch never reaches `TR.mv`. Five games. Same shape for the other non-`attack` action kinds.
- **the two engines disagree about whether a Protect SUCCEEDS** — `-singleturn protect` against our
  `-fail`, nine games, under a pin where both stall checks are supposed to read the same die.
- **Mirror Armor does not reflect Intimidate.** medicham2 drops its own ally's Attack instead.
- **Colbur is recorded as KNOCKED OFF where Showdown records it as EATEN.** Harvest, Recycle, Belch,
  Cud Chew and Unburden all read "was it eaten". Same family as #28, the resist berries.
  **THE REGISTER DOES NOT CARRY THIS ITEM.** It was filed to me as ROADMAP item eighty, and
  `docs/ROADMAP.md` §5 names 48 items, none of which is that one or the related item seventy-one — so
  the reference is written out by description rather than by number. `tests/test-roadmap-register.js`
  is RIGHT to fail on a ledger scheduling an item the register has never heard of, and ROADMAP.md is
  not ENGINE's to edit; the numbers can come back the moment §5 carries them.
- **Illusion announces the wrong body** on switch-in — filed in docs/GAME-DIFFERENTIAL-DESIGN.md §3.2
  and now with a reproducing game rather than a citation. The register entry belongs to whoever owns
  that item; this ledger does not schedule it, so it does not name its number.
- ~~**damage is off by one under a pinned maximum roll**, on recoil and on direct damage, five
  games.~~ **CLOSED AS A HAND-LIST ITEM — ROADMAP #81 WIRE 4.** It was one root twice over: Showdown
  does every damage multiplier in fixed point on 4096ths with a round-half-up, and recoil/drain are
  `Math.round` of a RATIO. The census carries three probes for it now (`move spreadFoes`,
  `item damageMultAll`, `move recoil`) so this line is no longer a claim nothing checks. What is left
  of it is narrower and is filed as (9) on that wire: recoil is still charged on UNCAPPED damage.
- **the Intimidate x guaranteed-crit case is still open** (§6): `107/170` against `128/170`. It has a
  probe in `tests/test-protocol-trace.js` PART 5 and is still the declared limitation.
  **CLOSED AT ROADMAP #81 WIRE 11, 2026-08-07.** `dmgRange` takes a crit flag; PART 5's assertion was
  inverted and now reads `showdown 112/170 in both arms, medicham 111/170 in both arms`.
- **`data/diff-swarm.json`, `data/rerun-list.json` and `data/store-validation.json` trip the
  provenance ratchet and none of them is ENGINE's.** Red on arrival; filed under the DIVISIONS rule.

## MEDICHAM EMITS A SHOWDOWN-SHAPED PROTOCOL TRACE. ROADMAP #68, STEP ONE. 2026-08-06.

Census **234 live / 235 probed → 234 live / 235 probed**, unchanged and re-measured twice: once
against the `data/tags.json` that was in the tree at the start of the session, and again after another
division committed `5da0b0d` and regenerated it mid-pass. `unarmed` 0, `directCall` 0, `hollow` 0,
`threw` 0. Differential **1/150**, the same `chesnaught woodhammer -> mimikyu` row.
`tests/probe_red_demo.js` **122 demonstrations, 0 failed** (five re-anchored — see below).
`tests/test-game-diff.js --all` AGREES on every turn of all five scripted games and on 0 of 40
generated pairs parting. `tests/test-engine-consistency.js` all passed. Accuracy conformance 500/500,
accuracy-modifier 12 handlers / 13 rows / 0 disagree, substitute-bypass 51 carried / 0 missing / 0
invented.

**No mechanic changed. This pass adds an INSTRUMENT.** `docs/GAME-DIFFERENTIAL-DESIGN.md` §5 compares
two engines by diffing their EVENT STREAMS rather than their end-of-turn state, because Showdown's
protocol log is already a step-level trace *labelled with the mechanism that made each decision*.
Showdown emits one. **MEDICHAM emitted nothing, so there was nothing to diff.**

| | |
|---|---|
| `TRACE_EVENTS` in `engine/medicham2-browser.js` | the 36 event types this engine claims it can emit |
| `data/protocol-events.json` | 91 events Showdown can emit; 36 emitted, 58 declared with a reason, 10 partial shapes with a reason |
| `engine/derive_protocol_events.js` | derives that list from Showdown's own `add()` sites, and gates on INVENTED and UNDECLARED |
| `tests/test-protocol-trace.js` | 7 parts; the census-style guard that every claimed event actually FIRES |

### THE ACCEPTANCE TEST SEPARATES, AND IT SEPARATES ON ONE LINE

`docs/GAME-DIFFERENTIAL-DESIGN.md` §6's case, staged: an Intimidated Meowscarada throwing Flower
Trick (a guaranteed crit) into an Incineroar. Showdown ignores the attacker's NEGATIVE offensive
stages on a crit (`sim/battle-actions.ts:1683-1691`); MEDICHAM's declared limitation says it does not.
**HISTORICAL AS OF ROADMAP #81 WIRE 11, 2026-08-07 — the numbers below are the PRE-WIRE build's.
MEDICHAM now reads `111/170` in BOTH arms and PART 5's medicham assertion is inverted to match.**

```
showdown   Intimidate 112/170   control 112/170     <- the crit ignored the -1
medicham2  Intimidate 130/170   control 111/170     <- it did not
  the two streams agree on all 15 lines before the divergence
  the FIRST differing line is the |-damage| itself
```

**THE CONTROL IS THE ARM WITH INTIMIDATE SWAPPED FOR BLAZE, AND IT HAD TO BE, BECAUSE THE OBVIOUS
TEST IS WRONG.** Asserting "the two engines' damage numbers match" is false for a reason that has
nothing to do with crits: measured while writing this, MEDICHAM's damage RANGE for Knock Off
Incineroar → Snorlax is **57..67, eleven integers, sampled uniformly**, and Showdown rolls **sixteen**
indices onto the same span with unequal multiplicities. A "median" roll is therefore not the same die
on the two sides and every damage line differs by one or two even where the rules agree. So each
engine is compared **against itself across the control**, which is the actual rule being tested.

### WHAT THE TRACE FOUND WHILE IT WAS BEING WIRED, AND NEITHER IS A CENSUS ROW

1. **THE INTERMEDIATE DAMAGE ROLLS ARE NOT THE SAME DISTRIBUTION, AND NO INSTRUMENT WE OWN LOOKS AT
   THEM.** `tests/test-engine-diff.js` calls `showdownDamage()` at `roll=0` and `roll=15` against
   MEDICHAM's `min` and `max` — it is an **endpoint-to-endpoint** comparison, by construction. The
   fourteen rolls in between are `d.min + floor(rng * (d.max - d.min + 1))`, a **linear interpolation
   over an 11-wide integer range**, where Showdown applies its multipliers to sixteen separately
   floored base values. The endpoints can agree perfectly, 149/150, while every middle roll is off by
   one or two and every roll's PROBABILITY is wrong. That is Mode B in the design doc, and it is
   filed rather than fixed: changing how MEDICHAM draws a damage roll moves every seeded run in the
   repository and is a decision above ENGINE's pay grade tonight.
2. **THE ORDER WITHIN A HIT IS NOT SHOWDOWN'S, AND THE STATE COMPARISON CANNOT SEE IT.** MEDICHAM
   resolves the knock-off, the resist berry and the contact punish **before** subtracting the target's
   HP, so the stream reads `-enditem`, Rough Skin's `-damage`, then the target's `-damage`; Showdown
   subtracts first. End-of-turn state is identical, which is exactly why `tests/test-game-diff.js`
   agrees on all five scripted games and this trace does not. Same for the pinch berries: Sitrus fires
   in MEDICHAM's end-of-turn residual and on Showdown's `onUpdate` immediately after the hit. Both are
   recorded in `data/protocol-events.json`'s `partial[]`, with the reason.
3. **`|move|`'s TARGET NAMED A BODY THAT HAD LEFT THE FIELD.** The action is built before the turn is
   sorted, so a target that switched out mid-turn has no slot identifier at all — the first version of
   the emit produced `??` four times in sixteen games and `MEDFAILS.traceBodyOffField` caught it. It
   now resolves through `it.tgtSlot` against the live foe array, which is what the attack branch
   already does for `aim`. **A counter that could not have existed before this pass found a defect in
   this pass**, which is the whole argument for `MEDSEEN`/`MEDFAILS`.

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-NINE.

The Intimidate rate floor asserted "two `|-unboost|` lines against two live foes" and read **one**.
The engine was right: the second foe was a **Slowking with Oblivious**, which is Intimidate-immune in
this generation, so `applyStatDrop` correctly returned `blocked` and emitted nothing. The probe was
staged with a body that cannot take the drop it was asserting. Fixed by giving the partner
Regenerator, not by weakening the assertion.

Two more of the same shape, both in the coverage scenarios rather than the engine: Icy Wind was
clicked with **no target**, so `playerAction` classified it as a non-attack and `-unboost` never
fired; and White Herb never triggered because the body holding it was **Protecting on the turn the
drop was aimed at it**. In all three cases "the event never fired" was the SCENARIO, not the trace.

### THE COST, MEASURED, AND IT IS NOT RESOLVED BY THE BENCHMARK I HAVE

Every emit site is `if(TR)` — one module-global load and a falsy test — and `TR` is null unless a
caller passed `{trace: []}`. Against a build with all **188** guards compiled out (`if(TR)` →
`if(false)`, dead-code-eliminated), two runs of 4,000 full games disagreed **in sign**: +3.9% and
−7.0%. **The off-path cost is below the noise of this benchmark and is reported as unresolved rather
than as free.** With the trace ON the same benchmark reads ~5% slower, which is the honest price of
asking for it.

### FIVE RED DEMONSTRATIONS WERE RE-ANCHORED, AND NOT ONE REVERSAL CHANGED

`tests/probe_red_demo.js` reverts the engine by **exact source text**, so instrumenting a line breaks
its anchor — loudly, which is the guard doing its job. Five anchors moved: the Grassy Terrain heal
(WIRE 117), the type-immunity gate (WIRE 126 and WIRE 128, two demonstrations on one line), the
move-class immunity (WIRE 128) and the substitute bypass (WIRE 130, two). **In every case only the
SHIPPED half was re-anchored; the known-bad half is byte-identical to what it was**, so each
demonstration still shows exactly the defect it was written for. 122 demonstrations, 0 failed.

### FILED, NOT FIXED

- **The two damage-roll findings above (1 and 2).** Neither is a census row and neither is a WIRE
  yet — they are what the instrument exists to find, and the fix cycle is ROADMAP #68's next step.
- **A spread move's `[spread]` attribute and its per-target effectiveness ORDER are not emitted.**
  MEDICHAM resolves the target list after the move line is written and rolls accuracy once per move
  rather than per target (`MEDSEEN.accSpreadNoDefender`), so a per-target attribute would not be true.
  Declared in `data/protocol-events.json`.
- **`-terastallize`, `replace`, `swap`, `-hitcount` and 52 others are not emitted**, each with a
  written reason in `data/protocol-events.json`. **`-mega` and `detailschange` USED to be on that list**
  with the reason *"mega evolution happens in `buildMon`/`oneMegaPerSide` before `battleInit`, so there
  is no in-battle event to emit at all"*. That was an honest declaration of a real modelling limit and
  the limit is gone: both are in `TRACE_EVENTS` as of ROADMAP #31 (2026-08-07), emitted by
  `megaEvolveNow` in Showdown's own order, and `tests/test-protocol-trace.js` PART 1 holds them to it.
  The counts moved 36 → **38** emitted and 58 → **56** declared.
- **THE TREE MOVED UNDER THIS PASS, AND ONE OF THE MOVES WAS MINE.** Another division committed
  `5da0b0d` (`tags.json` unfrozen and regenerated, `engine/tag_dex.js`, `engine/fit_policy.js`) and
  `219ce3b` (`diff_swarm.js`, the swarm half of this same ROADMAP item) during the session. The census
  was therefore re-run against the new artifact and reads the same 234/235. **I also ran
  `git stash`/`git stash pop` to establish a baseline, which is a mutation of the working tree in a
  repository another agent was committing to, and it should not have happened.** Nothing was lost —
  the pop restored cleanly and `HEAD` is intact — but the window existed and is recorded here rather
  than left out.
- **`engine/status.js` throws before its ENGINE block**: `engine/mc_key.js:129 — LK.resolve is not a
  function`, from `engine/feature_fixture.js:461` through the new `engine/lookup.js` (`eb500a1`). The
  report still prints; the fixture verification does not. **Not this pass's file and not fixed here.**
- **`engine/provenance.js` still reports 3 artifacts resting on mtime alone** —
  `diff-swarm.json`, `rerun-list.json`, `store-validation.json`. `protocol-events.json` was a fourth
  when it was first written and now carries `source_digests` and the pinned Showdown commit, so it
  has left that list. The other three are not this pass's generators.

## `unarmed` REACHED ZERO, AND ARMING THE PROBES FOUND WIRE 131, WIRE 132 AND SIX TAGS NOTHING READS. 2026-08-06.

Census **231 live / 232 probed → 234 live / 235 probed**. Missing still **1** — the same
`move|needsTargetToAttack`, unchanged and for the reason recorded below. `hollow` 0, `threw` 0,
**`directCall` 0 and it did not rise**. **`unarmed` 76 → 0**: every probe in the file now returns
`{control, test}` and the harness checks the pair structurally.
`tests/probe_red_demo.js` **79 → 122 demonstrations, 0 failed**.

Every other instrument held. Differential **1/150**, the same pre-existing
`chesnaught woodhammer -> mimikyu` row and the same 11 not comparable; accuracy conformance
**500/500 · 0 disagree**; accuracy-modifier conformance **12 handlers / 13 rows / 0 disagree**,
`accModUntabled` **0**; substitute-bypass conformance **51 carried / 0 missing / 0 invented**.
`tests/test-game-diff.js` agrees on every turn of all five scripted games.
`tests/test-interaction-matrix.js --full`, re-run against the changed engine: **1,624/1,643 (98.8%)**,
the same 530 inert / 109 saturated / 16 ko-timing / 2 threw and the same 19 parting rows.
`tests/test-engine-consistency.js` all passed.

**THE COVERAGE GATE'S ARMED NUMBERS ARE WHERE THIS PASS SHOWS UP, AND THEY WERE THE WORST NUMBERS ON
THE PAGE.** Weighted by corpus usage, inside the union 99% set:

| | armed before | armed after |
|---|---|---|
| moves (289 in the set, 1,859,794 uses) | **63.4%** | **97.4%** |
| abilities (99 in the set, 186,879 uses) | **82.2%** | **93.8%** |
| items (108 in the set, 171,843 uses) | **58.9%** | **99.9%** |

Nothing else in that gate moved: (a) 14, (b) 9, (c) 1, (d) 17 of 17, and **`tags probed and live but
with no ARMED probe: 62 → 0`**. Re-stamped into `data/medicham-coverage.json` with `--stamp`.

### WIRE 131 — THE ENGINE DODGED WITH SAND VEIL AND THE BOT PRICED EVERY CLICK AS IF IT DID NOT EXIST

Found by Will, from domain knowledge, and routed in mid-pass. WIRE 129 converted the five
**RESOLUTION** sites (the to-hit rolls) to `hitChance`. It did not convert the four **VALUATION**
sites — the places that answer *what is this click worth* — and those kept calling the bodiless
`moveAccuracy(id, field)` with a hand-written `att.ability === 'noguard'` beside it.

Measured before a line of engine changed, Hydro Pump (80 printed) out of a Milotic, all seven arms:

```
plain defender            bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 80
defender has NO GUARD     bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance Infinity
ATTACKER has No Guard     bestMoveVs.acc 1     playerAction.acc 0.8   hitChance Infinity
defender Bright Powder    bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 72
defender at +6 evasion    bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 26.7
attacker at +6 accuracy   bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 240
attacker Wide Lens        bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 88
```

**Identical results across a varied knob mean the knob is unwired, six times over** — and the one arm
that did move, the attacker-only No Guard, was the **fifth copy** of a rule `ACCMOD` already owns and
was **half the ability**: No Guard's hook is `onAnyAccuracy`, so a move aimed AT a No Guard body
cannot miss either, and all four sites priced that at 80%. This format gives No Guard to Pidgeot-Mega,
Raichu-Mega-Y, Machamp, Golurk, Hawlucha-Mega and Lycanroc-Midnight.

`hitProb(att, def, id, field, ctx)` is the valuation wrapper — `hitChance` clamped into [0,1] with
Infinity reading as 1 — and **all four sites call it**: `bestMoveVs`, the KO scan's per-foe weight,
`bestKOsNow`, and the `acc` field on `playerAction`'s action object. After the fix every one of the
seven arms above moves and agrees with the resolution path.

**ZOOM LENS IS DECLARED OFF AT VALUATION TIME RATHER THAN GUESSED.** Its `when` is
`targetAlreadyMoved`, a fact about an order that does not exist when a click is priced. Passing no ctx
makes `_accWhen` return false, which is the honest answer; the resolution site still applies it.

**IT DOES NOT MOVE A `board.js`-FACING NUMBER, AND THAT IS STRUCTURAL RATHER THAN OBSERVED.**
`board.js` imports exactly two things from this file — `M.dmgRange` and `M.buildMon` (board.js:885) —
and neither changed. Its own `accuracy` feature is computed from the Showdown dex at board.js:2439 and
never from `moveAccuracy`. `engine/position_features.js:197` calls `M.moveAccuracy(id, field)`, whose
signature and every returned value are untouched. **No refit is owed by this wire.**

**AND THE `acc` FIELD ON THE ACTION OBJECT IS READ BY NOBODY.** A repo-wide search for a consumer of
`playerAction(...).move.acc` finds none — not `board.js`, not `miltank.js`, not `rollout_leaf.js`, not
the site. It is now correct rather than wrong, which costs nothing, but it is **filed** below: a field
that is written and never read is a silent default waiting for a reader.

**TWO OF THE FOUR SITES COULD NOT BE DEMONSTRATED RED AND ARE DECLARED, NOT FAKED.** The KO scan and
`bestKOsNow` live inside `_chooseAction`, which is not exported. The only external route is letting the
bot pick freely and reading which foe lost HP, and **every arm of that experiment printed the same two
numbers** because the partner, the priors sampler and the to-hit roll all move underneath it. A
demonstration that cannot isolate its knob is the hollow shape `probe_red_demo.js` exists to reject.
Both lines are still pinned: the two `demoSource` rows assert their own text applied, and two new
census probes assert the two exported numbers.

### THE TWO NEW PROBES ASK WHAT THE BOT *THINKS*, NEVER WHETHER THE MOVE LANDS

`ability|writesAccuracy` — *"the bot VALUES a click into a No Guard body as certain, not at its printed
80"* — and `ability|accuracyMod` — *"the bot PRICES an evasive body, and not only dodges around it"*.
Every accuracy probe written before this pass reads DAMAGE ON THE BOARD, which is exactly why all of
them stayed green through WIRE 131: the resolution path was already right. The new pair reads
`bestMoveVs(...).acc` and `playerAction(...).move.acc` off bodies staged through `battleInit`.

`valuedAcc(` is declared by name in `REALTURN` **with its reason**, exactly as that ratchet's comment
requires, and it is the one helper in the file that deliberately does not spend a turn: spending one
would be the wrong instrument for a valuation bug.

### WIRE 132 — MEGA FLOETTE THREATENED NOTHING, ON 10.5% OF LADDER SIDES, AND THE RIGHT KEY WAS IN THE ARTIFACT

Found from a question Will asked about Fairy Aura and routed in mid-pass. `buildMonFromSet` built the
mega forme by CONCATENATION — `key + '-mega'` — while `data/abra-tags.js` has carried the real mapping
all along in `item|megaStone.into`.

**MEMBERSHIP PRINTED BEFORE ANYTHING WAS WIRED, over all 76 into-pairs in the artifact:**

```
76 into-pairs;  the concatenated guess agrees on 74;  it DIFFERS on exactly 2:
  floettite     base floette-eternal   guess floette-eternal-mega [row exists]  artifact floette-mega
  meowsticite   base meowstic          guess meowstic-mega  [NO ROW]            artifact meowstic-m-mega
```

So reading the artifact cannot over-match: 74 of 76 are the same string either way. What the two cost:

| | before | after |
|---|---|---|
| `buildMonFromSet` Floette-Eternal @ Floettite | `floette-eternal-mega` · ability **''** · SpA 175 | `floette-mega` · **fairyaura** · SpA 192 |
| `buildMon('floette-mega')` | 4 moves? **no — `mv: []`, it threatened nothing** | 4 moves, its Dazzling Gleam dealt **160** |
| `buildMonFromSet` Meowstic @ Meowsticite | **`meowstic`** — the mega branch never fired at all | `meowstic-m-mega` · trace · SpA 163 |

`floette-eternal-mega` is the **one row in the whole 318-row table with `ab: null`**, and it also
carries `mv: []`. The artifact's own answer, `floette-mega`, carries Fairy Aura and the right base
stats and was sitting beside it. **Six of the 81 mega rows carry `mv: []`** — salamence-mega,
latios-mega, latias-mega, diancie-mega and both Floettes — and of the six, only Floette has a base row
in this dataset to recover from; the other four have **6, 0, 0 and 0** ladder sides between them.

**THE HAND-TYPED `MEGA_ABIL` KEYS FLOETTE AS `floette:'fairyaura'`, WHICH IS NEITHER KEY.** That is
`merge_mega_into_engine.js`'s failure from CLAUDE.md verbatim — *"the builder keyed `venusaurmega`
while the artifact keyed `venusaur-mega`, so zero of its 67 writes ever matched"* — the same shape on a
new pair. It is left in place as the fallback for a stone the artifact has not derived, and the
artifact is asked first.

Three functions, one owner each: **`megaKeyFor(baseKey, item)`** (the forme, from the artifact, with
the suffix guess as a COUNTED fallback), **`megaRowMoves(key, m)`** (a mega never changes its moveset,
so an empty `mv` inherits the base's — found through the INVERTED into-map, because no string surgery
gets from `floette-mega` to `floette-eternal`), and **`megaRowAbility(key, m)`** (a mega row with no
ability takes its SIBLING forme's, never its base's — a mega's whole point is that the ability
changes). Six counters, three recoveries and three failures, all named:
`megaKeyFromSuffix` **0**, `megaMovesFromBase` (floette-mega ← floette-eternal),
`megaAbilityFromSibling`, `megaRowNoMoves` (**5**, first `floette-eternal-mega`), `megaRowNoAbility`
(**1**, `floette-eternal-mega`), `megaIntoNoTable` **0**.

**THIS ONE DOES MOVE A `board.js`-FACING NUMBER, AND THE SIZE OF IT IS MEASURED RATHER THAN ASSUMED.**
`board.js` imports `M.buildMon`. Diffed over **all 318 rows**, old engine against new: **exactly ONE
row changes** — `floette-mega`, which gains its four moves. Ability, base ability and moves are
byte-identical on the other 317. `buildMonFromSet` also changes for a Floettite and a Meowsticite set,
and board.js does not import it. **So any MAG feature computed on a board containing a Mega Floette
moves, and nothing else does. MEASURE was told.**

**`floette-eternal-mega` IS LEFT BROKEN ON PURPOSE.** It is an orphan: the artifact names no stone that
produces it, and base `floette` is `isNonstandard: 'Past'` in this format, so the row is unreachable by
construction. Making it work by stripping `-mega` off its own name would legitimise a row that should
not be reached and would hand it its BASE's ability. It is counted instead, loudly, and reported.

**THE `artifact_audit.js` GAP IS REPORTED AND NOT PATCHED.** A mega row with `mv: []` is never
legitimate and the audit passes cleanly over all six, because its duplicate check normalises
`floette-mega` and `floette-eternal-mega` to genuinely different strings. Adding that assertion today
would make a registered GATE red with no way to close it from here — the fix is in
`data/engine-data.js`, which ENGINE may not edit. **Routed out.**

### ARMING 76 PROBES FOUND SIX TAGS THE ENGINE DOES NOT READ AT ALL

Declaring arms is paperwork; **the demonstration is what makes an arm worth anything**, and 41 new
rows in `tests/probe_red_demo.js` re-run each newly-armed probe's own two-arm assertion against a
known-bad artifact or a reverted source. **Ten of the first forty-one stayed GREEN on a strip of the
tag the census row is named for**, which is the file working:

| census row | what the engine actually reads |
|---|---|
| `move\|inflictsBurn` (24,070), `move\|inflictsSleep`, `move\|inflictsParalysis` | `data/move-effects.js`'s **`fx.status`** — classified at medicham2:5269, applied at 3857. Neither the per-status tag nor `statusInflict` is consulted |
| `move\|inflictsFreeze` | **`fx.secondary`** — the secondary loop walks move-effects; `statusInflict` supplies only the format's CHANCE |
| `move\|readsTargetItem` (3,405), `move\|takesTargetItem` (3,709) | **`removesItem`** (and `removesItem.steals`) — the comment at medicham2:4243 says so in as many words |
| `move\|locksTarget` (5,583) | **`statusInflict`** — Encore's volatile arrives the same way Substitute's does |
| `move\|setsWeather` (1,607) | **`fx.weather`** out of move-effects; the tag is never consulted |
| `move\|doublesSideSpeed` (11,944) | **a hard-coded id**: `if(id==='tailwind')return {kind:'tail'}` |
| `move\|thawsTarget` (13,772) | for Flare Blitz, **the Fire TYPE clause**, not the tag |

None of these is a broken mechanic — every one of them works — but **the census row names a tag the
engine does not consume**, so a future regeneration that dropped that tag would move nothing and a
future consumer would inherit a dead name. Each demonstration now targets the fact that is actually
read, and says so at the line.

**`move|thawsTarget` GOT A THIRD ARM OUT OF IT.** The engine thaws on
`effMoveType === 'Fire' || TAGS.has(...,'thawsTarget')`, so Flare Blitz satisfies the first clause and
the artifact is never asked. **Matcha Gotcha (5,352 uses) is GRASS and carries the tag**, so the probe
now runs Crunch (no thaw) / Flare Blitz (thaws by TYPE) / Matcha Gotcha (thaws by TAG) and the
demonstration strips the tag off the carrier it actually drives.

**ONE TAG CANNOT BE DEMONSTRATED THIS WAY AND IS NAMED RATHER THAN FAKED.** `move|spreadAll` is read
through `const HITS_ALLY = new Set(TAGS.withTag('move','spreadAll'))` at medicham2:230, which is
evaluated when the module is required — `__setDB` afterwards cannot reach it. The probe is armed (Rock
Slide, a `spreadFoes` move, must leave my own partner untouched); the red demonstration is absent and
that is stated here.

**THE ARMS THAT WERE ADDED ARE CONTROLS, NOT ANNOTATIONS.** The rule applied throughout: the control
spends the SAME turn on a click that must NOT do the thing, so "a turn happened" is true on both arms.
Drain Punch against **Close Combat** (same type, same contact flag, no drain); Spiky Shield against
**Protect** (blocks identically, tolls nothing); Covet against **Knock Off** (empties the hand, does
not fill mine); Earthquake against **Rock Slide** (spreads to the foes, not to my partner); Life Dew
against **Recover** (heals, but not the partner); Tailwind read on **the foe's side as well as mine**;
Will-O-Wisp against **Spore** (so "a status move stamps one status" fails). Fourteen probes gained a
third arm on top, because two could not attribute the effect.

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-EIGHT.

The re-armed `forbidsStatusMoves` probe read the freed foe's pick out of `S.lastActs` and got
**"nothing"** in the control arm, reporting a working Taunt as MISSING. Two separate staging errors,
both found by looking at the record rather than at the engine:

- handing side B a **`null`** action map instead of a partial one leaves no side-B row in `lastActs`
  at all — the Disable probe next door already stages it as `new Map([[f2, {kind:'pass'}]])` and that
  is where the correct form came from;
- **a status click does not always carry a move NAME.** `chooseAction` emits Tailwind as
  `{kind:'tail'}` with `move: null`, so the reading is the KIND: every non-attack kind in this engine
  is a status click, which is exactly the set Taunt forbids.

### ONE RED TEST WAS MINE AND IT IS FIXED IN THIS PASS, AND IT LEFT A RATCHET SMALLER THAN IT FOUND IT

`tests/test-mc-key.js` went **13 passed / 2 failed → 15 / 0**. WIRE 132 added four computed
`MC.mons[...]` lookups to `medicham2-browser.js` and one to `probe_red_demo.js`, and that file's
whole point is that four separate callers wrote their own doorway into the species table and two of
them were silently broken for 8.17% of the metagame. The exception medicham2 holds — it is a browser
file and cannot `require('./mc_key.js')` — is not a licence to grow.

**Fixed by routing EVERY computed index in the file through one line**, `monRow(key)`, rather than by
re-baselining upward: `engine/medicham2-browser.js` **5 → 1**, and `tests/probe_red_demo.js` drops off
the list entirely because its WIRE 132 revert now targets the single line that asks the artifact
instead of embedding the old call site. The baseline was re-stamped **downward**, 17 → 16.

### FILED, NOT FIXED

- **`playerAction(...).move.acc` is written and read by nothing** in the whole repository.
- **`move|doublesSideSpeed`, and the weather and major-status families, are routed by a hard-coded id
  or by `data/move-effects.js` rather than by the tag the census names.** Listed in full above.
- **`move|spreadAll` is consumed at module-load time**, so no artifact mutation can produce a
  known-bad engine for it.
- **`data/engine-data.js` still has five mega rows with `mv: []` and one with `ab: null`** —
  `floette-eternal-mega` (orphan, unreachable), `salamence-mega`, `latios-mega`, `latias-mega`,
  `diancie-mega`. WIRE 132 recovers the one that has a base row and COUNTS the rest; the data fix is
  not ENGINE's. **`engine/artifact_audit.js` has no assertion for it**, and adding one would open a
  gate that cannot be closed from here.
- **`ability|auraBoost` is still absent, so a correctly-built Mega Floette carries Fairy Aura and the
  ability does nothing.** ROADMAP #64, untouched by this pass as instructed.
- **`tests/test-no-silent-failure.js` reports 3 NEW silent catch blocks, all in
  `engine/rerun_list.js` (lines 60, 136, 145). This pass did not touch that file** — its mtime moved
  during the session, so a concurrent writer was active. Reported, left alone.
- Everything below this section from the previous passes is unchanged.

## ACCURACY MODIFICATION LANDS AS ONE UNIT, AND THE FIRST TAG PROBED AFTER IT HAD WIRE 130 UNDER IT. 2026-08-06.

Census **218 live / 221 probed → 231 live / 232 probed**. Missing **3 → 1** — `ability|accuracyMod`
(Sand Veil) and `ability|writesAccuracy` (No Guard) were two of the three declared-missing mechanics
and both are live; only `move|needsTargetToAttack` remains, unchanged and for the reason recorded
below. `hollow` 0, `threw` 0, **`directCall` 0 and it did not rise** — the two new staging helpers
(`hitOnRoll`, `twoTurn`) are declared in `REALTURN` by name, exactly as that ratchet's comment
requires. `unarmed` **76 and unchanged**: all eleven new probes are armed.
`tests/probe_red_demo.js` **65 → 79 demonstrations, 0 failed**.

Every other instrument held. Differential **1/150**, the same pre-existing
`chesnaught woodhammer -> mimikyu` row and the same 11 not comparable; accuracy conformance
**500/500**. `tests/test-game-diff.js` agrees on every turn of all five scripted games. The
interaction matrix re-run at `--full` against the changed engine is **byte-for-byte identical to the
pre-pass artifact** — 1,624/1,643 (98.8%), the same 530 inert / 109 saturated / 16 ko-timing / 2
threw. `engine/feature_fixture.js --check` is **CLEAN — all 58 columns hash-identical to fit time**,
so **no refit is owed**. `tests/test-engine-consistency.js` all passed.
`tests/test-no-silent-failure.js` **0 new** (one was mine and it now speaks — see below).

**The coverage ratchet moved forward and was re-stamped.** `tests/test-medicham-coverage.js`
(b) "tags with NO PROBE AT ALL" **17 → 9**; (c) "tags whose every probe reports MISSING" **3 → 1**;
(a) 14, (d) 17 of 17, `notArmed` 62 — none of them rose. New baseline in
`data/medicham-coverage.json`.

**The generated block at the top of this file is one census behind**, because this pass was dispatched
under an explicit instruction not to run `engine/status.js --write`. **THE RESTAMP IS OWED**; the
artifacts already say the right thing.

### WIRE 129 — ~5,000 CORPUS USES OF "DOES THIS MOVE HIT" AND NOT ONE AXIS OF IT WAS WIRED

The dispatch was right that the four doors are one mechanic, and right that all four were open. What
the measurement added is that they were open in three *different* ways, so a single fix would not
have closed them:

| door | what was actually wrong |
|---|---|
| `move\|accuracyMod` (Coil 2,351, Minimize 1,050) | `SD2ENG` mapped `accuracy` and `evasion` to **null**. Eleven boost appliers in this file key off that map, so `data/move-effects.js`'s own `targetBoostsAlways:{atk:1,def:1,accuracy:1}` landed two thirds of the time and the accuracy stage was dropped on the floor |
| `item\|accuracyMod` (Wide Lens 757, Bright Powder 208) | nothing read the item at all |
| `ability\|accuracyMod` (Sand Veil 307, Snow Cloak 353) | nothing read the ability at all |
| `ability\|writesAccuracy` (No Guard) | nothing read the ability at all |
| **all four** | the battle loop's to-hit roll called `moveAccuracy(id, field)`, which **is handed no bodies** — the signature gap the census had been reporting as three separate misses since WIRE 78 |

Measured before a line of engine changed, both arms on each axis, into a Garchomp on 183 HP:

```
Hydro Pump (80) at roll 0.85 after Howl 0 / after Coil 0        <- Coil's +1 accuracy did nothing
Ice Beam  (100) at roll 0.85 into Protect 258 / Minimize 258    <- +2 evasion did nothing
Hydro Pump (80) at roll 0.85 no item 0 / Wide Lens 0            <- x1.1 did nothing
Hydro Pump (80) at roll 0.75 no item 116 / Bright Powder 116    <- x0.9 did nothing
Hydro Pump (80) at roll 0.70 sand + Sand Veil 115 / clear 115   <- x0.8 did nothing
Hydro Pump (80) at roll 0.99 no ability 0 / No Guard 0          <- never-miss did nothing
```

**Identical results across a varied knob mean the knob is unwired**, six times over.

**ONE AUTHORITY, `hitChance(att, def, id, field, ctx)`, AND ALL FOUR TO-HIT SITES CALL IT.** The
`affect` branch, the Leech Seed branch, the status branch and the attack branch each had their own
`moveAccuracy(...)` line; there are now four calls to one function. `printedAccuracy` is split out
underneath it so `true` survives as `true` — Showdown skips the boost table and every ModifyAccuracy
handler when a move cannot miss, so a +6 Minimize does nothing to Swift and cuts Ice Beam to 3/9.
**`moveAccuracy` keeps its exact signature and every value it returns**, because it is on the export
list `board.js` and `engine/position_features.js` read and its meaning may not move under them.

**THE STAGE TABLE IS NOT THE STAT TABLE**, and reusing `boostMul` is the comfortable mistake: stat
stages are (2+n)/2, accuracy and evasion stages are (3+n)/3, so +1 accuracy is 1.33x and not 1.5x and
+6 is 3x and not 4x.

**THE ARTIFACT'S DIRECTION IS INVERTED ON EVERY CARRIER, AND THAT IS A REAL BUG IN AN ENGINE-OWNED
FILE.** `engine/tag_dex.js`'s `writesAccuracy` derivation puts `onModifyAccuracy` under
*"its own moves"* and `onSourceModifyAccuracy` under *"moves aimed at it"*. Showdown fires the first
on the **TARGET** and the second on the **ATTACKER**. So `data/abra-tags.js` records **Sand Veil as
sharpening its own moves and Compound Eyes as sharpening the foe's** — precisely backwards, on all
nine carriers. Nothing had ever consumed `scope`, which is why it survived.

**The derivation is corrected in `engine/tag_dex.js`. The ARTIFACT is NOT regenerated, and the reason
is measured rather than assumed** — see the separate section below. So **nothing in the engine reads
`scope`**: membership comes from the tag (`accuracyMod` / `writesAccuracy`), and the number and the
direction come from `ACCMOD`, a table **re-derived on every run** by a new
`ACCURACY-MODIFIER CONFORMANCE` block in `tests/test-engine-diff.js`. It reads the handlers straight
out of `gen9championsvgc2026regmb` and takes the direction from the **hook name**, which is the fact:

```
onModifyAccuracy        handler on the TARGET     -> side 'def'    sandveil snowcloak tangledfeet wonderskin brightpowder laxincense
onSourceModifyAccuracy  handler on the ATTACKER   -> side 'att'    compoundeyes hustle widelens zoomlens
onAnyAccuracy           neither end may miss      -> both, never   noguard
onAnyModifyAccuracy     the whole SIDE            -> not expressible in hitChance
```

**12 handlers in the format, 13 rows in the table, 0 disagreements.** The block failed on its own
first run over a key-casing bug and named every row — which is the check working before it was
trusted.

**A CARRIER WITH NO ROW IS LOUD.** `MEDFAILS.accModUntabled` counts any entity the artifact tags as
touching accuracy that `ACCMOD` has no row for, and it reads **0**. A silent default here is
indistinguishable from the bug this wire fixes.

**THREE ROWS ARE DECLARED OFF WITH THEIR REASONS, RATHER THAN HALF-WIRED**, because a tag consumed
half-right is how the 20-mechanic batch went wrong:
- `tangledfeet` — needs the confusion volatile and **this engine has no confusion at all** (4 uses);
- `victorystar` — its `onAnyModifyAccuracy` guard is `source.isAlly(...)`, so it boosts the whole
  SIDE, and `hitChance` holds one attacker and one defender and no side (0 uses in this regulation);
- `skilllink` — a **FALSE POSITIVE in `data/abra-tags.js`**: `tag_dex`'s probe matches `/accuracy/i`
  against Skill Link's `delete move.multiaccuracy`. It writes multihit, not accuracy. The row exists
  so the untabled counter does not report it forever, and it applies nothing.

**THE ATTACK-SITE ROLL MOVED BELOW TARGET RESOLUTION, AND THAT IS THE HALF THAT NEEDED A DEFENDER.**
It used to happen above `const foes=...`, where no defender exists — so the whole `def` side of
accuracy was unreachable there whatever `hitChance` did. Nothing between the old site and the new one
consumes rng, and that is **verified rather than argued**: the interaction matrix is byte-for-byte
identical.

**ONE ROLL PER MOVE, NOT PER TARGET, IS A DECLARED DIVERGENCE AND IT IS COUNTED.** Showdown rolls
accuracy separately against each target of a spread move. Rolling per target here would change how
much rng every seeded run in the repository consumes, which is a much larger change than this wire is
buying — so a spread move rolls once with the attacker's modifiers only and increments
`MEDSEEN.accSpreadNoDefender`. Single-target moves, where every evasion item and ability in this
format actually lives, get the real defender.

### WIRE 130 — SUBSTITUTE WAS PAID FOR AND NEVER BUILT. 1,976 CORPUS CLICKS OF A MOVE STRICTLY WORSE THAN PASSING.

Found by writing the probe for `move|substitute`, the second-biggest tag on the coverage gate's
"NO PROBE AT ALL" list. Measured before anything changed, a Garchomp on 183:

| the foe clicked | it paid | then took Ice Beam for | `_sub` |
|---|---|---|---|
| Howl | 0 | **183** | – |
| **Substitute** | **45** | **138** | **0** |

`playerAction` resolves Substitute to `kind:'affect'` — it carries `statusInflict` with a volatile,
and that branch is checked long before the `costsUserHP` fallback. So **the `kind==='sub'` branch
WIRE 42 wrote for it is unreachable and always was**, and what ran instead was the generic
`costsUserHP` deduction at the top of the resolution loop. The click bought a quarter of the user's
max HP worth of nothing. WIRE 42's own comment says it modelled both halves *"on purpose"* because
charging the cost without granting the doll *"would make the most-clicked defensive setup move in the
format strictly worse than doing nothing"*. That is exactly what shipped.

**MEMBERSHIP PRINTED BEFORE IT WAS WIRED.** `move|substitute` matches exactly two rows and both are
real: `substitute` (buffer 0.25) and `shedtail` (buffer 0.25, and it pays **half** for the same
quarter-size doll — so the buffer is read from the tag and never inferred from the cost).

Three fixes, one authority each:
- `grantSubstitute(m, moveId)` builds the doll from the tag's `buffer`, called from the generic cost
  block and from the `sub` branch, so the doll has one size and not two;
- a **second** Substitute now fails **before** the deduction. Showdown returns early when the volatile
  is up and never charges; paying for a doll you do not get is worse than either outcome;
- `subBlocks(att, def, moveId)` is the one answer to "does the doll eat this", asked by the damage
  path **and** by every status path.

**AND IT CLOSED THE DECLARED DIVERGENCE THAT SAT AT THE ABSORB SITE.** That line said, in a comment,
that sound moves and Infiltrator go through a real substitute and this engine did not track either.
They do now — and the fix went in the direction the measurement chose, not the comfortable one:

**THE COMFORTABLE VERSION WOULD HAVE BEEN A BIGGER BUG THAN THE ONE IT FIXED.** The obvious rule is
"a substitute blocks status moves, except sound ones", built on the `sound` tag the artifact already
has. Measured against the format first: the three most-clicked status moves that reach a substitute
in this regulation — **Encore (4,848), Taunt (1,503), Disable (730)** — all carry `bypasssub` and
**none of them is a sound move**. That rule would have walled all three.

The real fact is Showdown's `bypasssub` flag and **no artifact this engine reads carries it**:
`data/move-effects.js` has no flags block and `data/abra-tags.js` has no tag for it. So it is a
51-entry `SUBPASS` set in the engine, re-derived over all 500 moves in `MC.moves` on every run by a
new `SUBSTITUTE-BYPASS CONFORMANCE` block in `tests/test-engine-diff.js`: **51 carried, 0 missing, 0
invented.** Infiltrator comes from the artifact's own `ignoresScreensAndSubs.ignoresSubstitute`, never
from its name.

After: Ice Beam into a substituted Garchomp deals 0, Hyper Voice deals 45 with the doll still
standing, an Infiltrator's Ice Beam deals 138, Will-O-Wisp burns nothing through a doll and burns
without one, and a second Substitute costs nothing.

### THE ELEVEN NEW PROBES, AND THE FIVE THINGS THEY MEASURE THAT NOTHING DID

`move|accuracyMod`, `item|accuracyMod`, `ability|accuracyMod`, `ability|writesAccuracy`,
`move|substitute`, `ability|ignoresScreensAndSubs`, `move|swapsAbilities`, `move|readsOwnItem`,
`move|ohko`, `ability|survivesFromFull`, `ability|boostsFromFallen`. All eleven spend real turns, all
eleven are armed, and each has a demonstration in `tests/probe_red_demo.js` — **fourteen new
demonstrations, each reverting exactly one argument, one table row or one operand.** Two of them are
reverted in the direction that still "works", which is the shape a one-armed probe cannot see:
`_accWhen('sand') -> return true` leaves Sand Veil firing and only the CLEAR-SKY control catches it;
`subBlocks -> tg._sub>0` leaves the doll eating Ice Beams and only the sound arm catches it.

**`move|ohko` IS STOCHASTIC AND THE PROBE ASSERTS THE MECHANISM.** The target is given **eight times**
its max HP, so no damage formula in this engine can reach it — a faint can only be the OHKO rule. The
control is Ice Beam at the *same winning roll*, which must NOT faint it, so "Fissure kills it" cannot
be reached by a staging that kills it anyway.

**`ability|boostsFromFallen` IS SUPREME OVERLORD AND IT IS WHY THIS BATCH EXISTS.** WIRE 125 found the
death counter falling back to zero one turn after every death, and found it because Last Respects had
a probe; Supreme Overlord reads the same field and had none. It is live and correct: Iron Head 97 with
0 fallen, **126** with 3 (the tag says +10% each, capped at 5). The staging is three turns because the
snapshot is taken at **switch-in** (`countedAt: "switch-in"`), and the third arm — no ability, three
fallen, 97 — separates "the ability" from "the deaths".

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-SEVEN.

The first `boostsFromFallen` probe put the Kingambit on the field at `battleInit` and killed three
bench bodies, then clicked. It read **97 in every arm** and reported the mechanic missing. Supreme
Overlord snapshots at switch-in and that body never switched in, so on a perfectly correct engine the
probe was asking a question with one answer. The fix is a real switch action after a real end-of-turn
recount — and the same staging then showed the counter is right for a *faint replacement* in the same
turn as the death, which was worth knowing and is now measured rather than assumed.

### `data/tags.json` CANNOT BE SAFELY REGENERATED TODAY, AND THE REASON IS NOT ENGINE'S — ROADMAP #65

The `tag_dex` fix above only reaches the engine through a regeneration, so a regeneration was tried
and measured against the current artifact rather than trusted. **Tag membership and every param are
identical — 0 differences across 500 moves, 262 abilities and 146 items.** What moved is usage, and
it moved a long way:

```
sheet_entries  110,760 -> 78,480      (fit_policy.loadCorpus(), the corpus tag_dex counts over)
move:priority   134,174 -> 96,911     move:contact 129,222 -> 90,974     and so on, uniformly
```

**Five entities DROP OUT of the artifact entirely**, because their usage fell to zero:
`ability curiousmedicine`, `ability serenegrace`, `ability steelyspirit`, `ability tintedlens`,
`item leppaberry`. `data/abra-tags.js` is what the engine reads params from, so regenerating would
**silently delete Serene Grace and Tinted Lens from the engine's knowledge**. That is a regression and
this pass did not make it. `data/tags.json` was restored byte-identical (`git status` clean on it).

**This is not an ENGINE finding and it is not ENGINE's to fix.** The corpus `fit_policy.loadCorpus()`
returns shrank by 29% at some point since the artifact was last generated. **Routed out: MEASURE or
OPS should say whether that is a deliberate re-filter or a store problem.** Until it is answered, the
`writesAccuracy` scope correction sits in `engine/tag_dex.js` and not in the artifact — which costs
nothing, because nothing consumes `scope`.

### WHAT IS STILL UNPROBED, WITH THE REASON, RATHER THAN A PROBE THAT PASSES ON A DELETED MECHANIC

Nine tags remain on the coverage gate's (b) list. Four of them are **absent from the engine**, and a
probe for those would go red — which is the honest state and is exactly what the (c) ratchet counts.
They are reported here rather than staged, because writing a probe that passes on a deleted mechanic
is what created the 47 direct-call probes in the first place:

| tag | measured state |
|---|---|
| `ability\|auraBoost` (Fairy/Dark Aura, the biggest at 5,663) | **absent, and it needs state `dmgRange` cannot see.** Measured: Dazzling Gleam deals 79 with Fairy Aura on the attacker, on its ally, on the foe, and on nobody. The multiplier is field-wide over **every body on the field**, and `dmgRange(att, def, mv, field, spread)` is handed two bodies and a field that holds no roster. Wiring it means putting the active abilities on `field` — which changes an input `board.js`'s six exports read. **A design call, not a patch; routed for a decision — ROADMAP #64.** |
| `move\|instructsTarget` (Instruct, 2,222) | **absent by construction and declared at the line**: `playerAction` excludes `instructsTarget` from the `reorder` branch, so Instruct resolves to `pass`. Making the target take an extra action means re-entering action resolution from inside the resolution loop. |
| `move\|passesState` (Baton Pass 1,793, Shed Tail) | **absent.** Needs boosts and volatiles to survive a switch; `switchOut` clears `out.boosts` unconditionally. Shed Tail's substitute half now works, its pass half does not. |
| `move\|punishesBoostedTarget` (Alluring Voice 604, Burning Jealousy) | **absent and it needs a fact nothing tracks.** Measured: Burning Jealousy leaves a +2 target unburned. The tag is `onlyIfTargetBoostedThisTurn` and no per-turn "was boosted" flag exists. Alluring Voice's half also needs the **confusion volatile**, which this engine does not have at all — the same missing state Tangled Feet is off for. |
| `ability\|randomBoostEachTurn` (Moody, 590) | **STOCHASTIC and staged only against a seeded rng.** Not attempted this pass. The probe must assert the mechanism — a stat moved up two and another down one — and not a particular stat. |
| `ability\|terrainSetter` (2,044), `ability\|switchInForme` (511), `ability\|amplifiesBoosts` (309), `move\|dualPurpose` (363) | not measured this pass. |

### FILED, NOT FIXED

- **`data/tags.json` / `data/abra-tags.js` carry an INVERTED `writesAccuracy.scope` on all nine
  carriers.** The derivation is fixed in `engine/tag_dex.js`; the artifact is not, for the corpus
  reason above. Nothing reads it, so the engine is correct either way — but any *other* consumer that
  starts reading `scope` inherits the inversion.
- **`ability|skilllink` carries `writesAccuracy` in the artifact and should not.** `tag_dex`'s probe
  matches `/accuracy/i` against `delete move.multiaccuracy`. Same regeneration blocker.
- **A spread move's to-hit roll ignores the defender**, counted as `MEDSEEN.accSpreadNoDefender`.
- **`engine/medicham_coverage.js` and `data/provenance-stamp.json` were modified in the tree during
  this pass and this pass touched neither.** `medicham_coverage.js` gained a 65-line artifact-writing
  block. **Reported, left alone**, per the do-not-delete rule — but it means a concurrent writer was
  active, and a `run-all` result taken while somebody else is writing is not a photograph.
- Everything below this section from the previous passes is unchanged, including
  **`clickFragility` pricing an -ate click against the raw move type** (routed to MEASURE, #50) and
  the **`dmgRange` `damageReduce` over-match on `prismarmor` / `shadowshield` / `ripen`**.

## THE DIRECT-CALL COUNT REACHED ZERO, AND THE LAST NINE CONVERSIONS FOUND WIRE 128. 2026-08-06.

Census **218 live / 221 probed**, unchanged; missing still 3 (the same three), hollow 0, `threw` 0.
**`directCall` 37 → 0** and it is now a FIELD IN THE CENSUS, computed structurally and ratcheted.
`unarmed` **116 → 76**. `tests/probe_red_demo.js` **38 → 65 demonstrations, 0 failed**. Differential
unchanged at **1/150** (the same pre-existing `chesnaught woodhammer -> mimikyu` row, the same 11 not
comparable, accuracy conformance 500/500). `tests/test-game-diff.js` agrees on every turn of all five
scripted games. The interaction matrix re-run at `--full` against the changed engine is
**byte-for-byte unchanged**: 1,624/1,643 live pairs agree (98.8%), the same 530 inert / 109 saturated
/ 16 ko-timing / 2 threw / 53 off-gate. `engine/feature_fixture.js --check` is **CLEAN — all 58
columns hash-identical to fit time**, so no refit is owed.

**The generated block at the top of this file is one census behind**, because this pass was
dispatched under an explicit instruction not to run `engine/status.js --write`. **THE RESTAMP IS
OWED**; the artifacts already say the right thing.

### WIRE 128 — THE BATTLE LOOP AND THE DAMAGE CALC HAD TWO DIFFERENT ANSWERS TO THREE QUESTIONS

Found by converting `ignoresTypeImmunity`, `ignoresDefenderAbility` and `immuneToMoveClass`, which
are the three probes on the ranked list that ask about an ATTACKER changing a DEFENDER's refusal.
All three were green. All three were asking `dmgRange`, which was the half that was already right.

Measured before a line of engine changed, both arms printed:

| | `dmgRange` said | a real turn dealt |
|---|---|---|
| Scrappy Incineroar, Body Slam → Gengar | **88** | **0** |
| Mold Breaker Tinkaton, Earthquake → a Levitate body | **60** | **0** |
| Mold Breaker Tyranitar, Rock Blast → Bulletproof | (blocked at the calc too) | blocked |

Three separate gates in `battleTurn`, each a second implementation of a fact `dmgRange` already owned:

- the stage-5 type gate was a bare `mcEff(effMoveType(...), tg.types)`. It knew nothing about
  **Scrappy / Mind's Eye** (so every Normal and Fighting click from a Scrappy body into a Ghost dealt
  zero in every rollout and every self-play game this engine has ever run) and nothing about
  **Freeze-Dry / Thousand Arrows**' `overridesEffectiveness`, which can turn a chart zero into a hit.
- the absorb gate read `tg.ability` **raw**, so a Mold Breaker, Teravolt or Turboblaze click was
  absorbed by Levitate, Volt Absorb, Water Absorb, Flash Fire, Sap Sipper, Motor Drive, Earth Eater,
  Well-Baked Body, Lightning Rod and Storm Drain — every one of which Showdown marks `breakable`.
- `moveClassBlocked()` read `tg.ability` raw as well, while **dmgRange carried its own private copy
  of the same check** that used the suppressed ability. Two implementations of one rule, in one file,
  already disagreeing.

Three functions now, one owner each — `suppressedAbility`, `typeEffAgainst`, `absorbedBy` — and
`dmgRange`'s inline `immuneToMoveClass` block is deleted in favour of `moveClassBlocked(def, id, att)`.
Every one of the ten `moveClassBlocked` call sites in the file now passes the acting mon.

**THE SUPPRESSION SET WAS PRINTED BEFORE IT WAS TRUSTED, per docs/LESSONS.md 4.** Every ability in
`data/tags.json` carrying `typeImmunity` or `immuneToMoveClass` was checked against
`Dex.forFormat('gen9championsvgc2026regmb')` at the pinned commit `20ad99ff`: **32 of 35 relevant
abilities are `breakable`, and all of the typeImmunity and immuneToMoveClass carriers are.** So the
fix cannot over-match on the two gates it touches. **The three that are NOT breakable —
`prismarmor`, `shadowshield`, `ripen` — all carry `damageReduce`, which `dmgRange` was ALREADY
suppressing before this pass. That is a pre-existing over-match, it is FILED below, and it is latent:
Prism Armor and Shadow Shield have zero corpus usage and Ripen has 14.**

`tests/probe_red_demo.js` gained three source-reverted demonstrations, one per gate, each reverting
exactly the one argument that carries the attacker and nothing else. Each asserts its control in
BOTH engines, so "Scrappy landed" cannot be reached by an engine that stopped enforcing
Normal-into-Ghost altogether.

### `directCall` IS A CENSUS FIELD NOW, AND IT IS THE RATCHET

`unarmed` falls as paperwork and says nothing about coverage. `directCall` only falls when a probe
starts spending a real turn, which is the class of probe that can catch a wiring bug — and WIRE 123,
WIRE 126 and now WIRE 128 are all wiring bugs that sat green under a direct-call probe.

It is computed **structurally over each probe's own source** (`String(fn)` against
`/battleTurn|battleInit|\bboard\(|\bturnDamage\(|\bturnDamageBig\(/`), written to
`data/mechanics-census.json` as `directCall`, printed with the offending probes named, and
**ratcheted: it may fall and may never rise**. The helper list is explicit rather than a loose
pattern, and that cost two probes their credit the first time `turnDamageBig` was used — which is the
strictness working: a new helper has to be declared, and cannot sneak a direct-call probe past.

### THE OTHER 29 CONVERSIONS, AND WHAT CHANGED BESIDES THE ROUTE

Nine of them were made STRICTER because the conversion exposed that they had no control at all:

| probe | what it used to accept |
|---|---|
| `ignoresStatStages` Sacred Sword | `a.max === b.max` — what an engine ignoring stat stages for EVERY move prints. Close Combat is now the control and must fall |
| `alwaysCrit` / `preventsCrit` Flower Trick | a synthetic id-renamed copy, which **cannot be clicked** — Knock Off at rng 0.99 is the control now |
| `untagged` Marvel Scale | it burned BOTH bodies and varied only the ability, which cannot tell "hardens while statused" from "hardens always" |
| `halvesTypeDamage` Dry Skin | one arm. Body Slam must not move |
| `weatherSuppression` Air Lock | `control > test`. The suppressed number must EQUAL the clear-sky number, not merely be smaller |
| `setsTerrainEveryMember` | `playerAction(...).kind === 'terrain'` — a CLASSIFICATION. It now reads the terrain standing on the board |
| `privateWeather` Mega Sol | the "private" half was asserted in a COMMENT. The field is now read after the turn and an ALLY holding it must not benefit |
| `recoil` / `spreadFoes` / `secondaryStatEffect` / `statusInflict` | one arm each: "the user lost HP", "both foes took damage", "the stat dropped", "it burned" — all true of engines with much worse bugs |
| `multiAccuracy` Triple Axel | the previous pass declined this as a pricing question `dmgRange` owns, and that was right about the ratio. The turn asks something new: the discount is 1+p+p²=2.71, the CONDITIONAL expectation, and the loop then rolls to hit on top of it — measured, it misses at rng 0.99 and lands at 0.5, so the 90% is not counted twice |

**`needsTargetToAttack` STAYS MISSING AND THE REASON IS NOW RECORDED RATHER THAN GUESSED AT.** The
old probe set `curHP = half` and called that "already hit", which is a HP LEVEL and not an event; the
real rule is *damaged by the target this turn*, and Avalanche is -4 priority so a foe clicking in the
same turn always lands first. Staged that way it is still flat. The tag carries
`{needs: "target attacking"}` for **all nine** of its members, and those nine do four completely
different things with that condition — double the power, reflect the damage, fail outright, go first.
Sucker Punch's half IS wired, through the separate and much sharper `failsIfTargetNotAttacking`.
**The fix is a tag before it is any code.**

### AND MY OWN PROBES WERE WRONG BEFORE THE ENGINE WAS, THREE TIMES. THAT MAKES THIRTY-SIX.

- **34.** `untagged` Marvel Scale, first cut: arms were the STATUS at a fixed ability, and it read
  `clean 92 → burned 147` — the ability apparently making the body softer. It was the end-of-turn
  **burn chip**, which lands inside the same HP-loss reading. Both burned arms carry the identical
  chip on the identical body, so comparing them cancels it; comparing a burned arm against a clean
  one does not.
- **35.** `weatherAccuracy` Thunder fired at a **Garchomp**, which is Dragon/GROUND and takes
  literally nothing from an Electric move. Every arm read 0 including the winning-roll control, and
  on a perfectly correct engine the probe reported the mechanic MISSING. A never-miss claim means
  nothing against a target the move cannot damage.
- **36.** `privateWeather`, first cut: the "ally holds it" arm put the ability on the ally **and then
  had the ally shoot** — the same body wearing a different label. It read 179 both ways and looked
  exactly like a private sun leaking across the side.

### THE COVERAGE GATE — WILL'S 99%-OF-USAGE BAR, DERIVED AND RED-PROVEN

`tests/test-medicham-coverage.js`, auto-discovered by `tests/run-all.js`. Will approved the target on
2026-08-06: **99% of usage, plus a carve-out for anything that can turn a CERTAINTY into a FAILURE
regardless of usage.** Nothing in the file names a Pokemon, a move, an ability or an item —
`tests/regulation_usage.js` derives the set at runtime from the store (a ~8s scan, cached on the
corpus's own size and mtime so a changed store re-derives). **A threshold is a list and goes stale; a
coverage target is a mechanism and re-derives itself**, which is the whole reason Will picked a target.

**IT IS THE UNION OF THE RAW AND THE CLEAN CORPUS, AND THE FIRST VERSION WAS WRONG ABOUT WHY.** The
gate initially read the raw store only, with the comfortable story that raw is the conservative
direction because bot spam can only ADD junk entities. `engine/selftest.js`'s clean-data check caught
the new file, and measuring rather than declaring showed the story is wrong in one of the two
directions:

| | distinct with any usage | the 99%-of-usage prefix |
|---|---|---|
| raw, 46,211 games | moves 486, ab 175, items 146 | moves 277, ab 78, items 100 — **455** |
| clean, 8,193 games (`engine/quality.js`) | moves 462, ab 167, items 142 | moves 283, ab **98**, items 107 — **488** |

The raw store SEES MORE distinct things and demands a SMALLER prefix, because repeated bot clicks
concentrate the distribution. The clean corpus sees fewer and demands a LARGER one. **Neither
dominates, so picking either would have quietly relaxed the bar** — and on abilities the raw-only
version was asking for 78 where the clean corpus asks for 98. The gate takes the **union**, which is
strictly more demanding than both and cannot be moved by the mix of games in the store. `RAW-STORE-OK`
was NOT declared; the clean filter is applied, which is the honest way to satisfy that rule.

**807 things carry real usage in this regulation and 495 are in the union of the two 99% sets**
(moves 288 of 486, abilities 98 of 175, items 109 of 146). Usage for weighting is raw + clean, so an
entity only one corpus saw still carries weight.

| | count in the 99% set | | | | usage-weighted | | | |
|---|---|---|---|---|---|---|---|---|
| | tagged | probed | LIVE | armed | tagged | probed | LIVE | armed |
| moves (288) | 286 | 272 | 269 | 151 | 99.4% | 98.5% | **96.7%** | **63.1%** |
| abilities (98) | 87 | 80 | 78 | 53 | 98.7% | 93.5% | **93.3%** | **81.8%** |
| items (109) | 108 | 107 | 107 | 88 | 99.9% | 99.7% | **99.7%** | **58.8%** |

**Move-armed was 9.2% of usage when the gate was first run**, against 260 of 277 moves LIVE — the
count read respectably and the weighted figure did not, which is exactly the pair of numbers the gate
exists to put side by side. The gap was that the handful of tags the biggest moves carry
(`statusInflict` 585,893, `contact` 444,874, `priority` 359,331, `statChange`, `spreadFoes`,
`stalling`) were the ones nobody had declared arms on. **Those ten were armed, chosen by the weighted
number rather than by eye, and it moved to 63.1%.**

**"NO PROBE" IS REPORTED SEPARATELY FROM "UNARMED", because it is a worse state.** 17 tags carried by
the union set have no probe at all: `move|accuracyMod` (5,986), `ability|auraBoost` (5,620),
`move|substitute`, `move|instructsTarget`, `move|swapsAbilities`, `ability|terrainSetter`,
`move|passesState`, `move|ohko`, `move|readsOwnItem`, `move|punishesBoostedTarget`,
`ability|randomBoostEachTurn`, `ability|switchInForme`, `move|dualPurpose`, `ability|amplifiesBoosts`,
`ability|boostsFromFallen`, `item|accuracyMod`, `ability|survivesFromFull`. **That is the ranked next
job.**

**THE CARVE-OUT IS 17 TAGS AND IT IS FULLY COVERED: 17 of 17 live and armed.** It is a set of TAG
SHAPES, never of entities — naming Queenly Majesty would leave Dazzling and Armor Tail out, and
naming `blocksMove` picks up all three plus the fourth that ships next generation. Every tag is
asserted to exist in `data/tags.json`, so an upstream rename fails the file loudly instead of quietly
emptying the carve-out. Three are excluded and the two REASONS are printed apart, because they are
different: `item|blocksPowder` and `item|blocksSecondary` have **no row in the artifact at all**
(Safety Goggles and Covert Cloak are `isNonstandard` in this format), while `ability|preventsSwitch`
has **three real carriers at zero usage** and could become live tomorrow with no code change.

**IT IS A RATCHET, NOT A BAR AT 100%.** A permanently red gate is what this repository has already
learned gets called a "known failure" and ignored. The counts may fall and may never rise, the
baseline is `data/medicham-coverage.json`, and **a rise fails whether it came from a regression or
from the metagame bringing in something unprobed** — both are work owed — with the new-since-baseline
rows named so the reader can tell them apart.

**AND IT IS SHOWN RED BEFORE IT IS TRUSTED.** `--selftest` plants three faults in memory and asserts
rejection on each: a tag nothing probes bolted onto the single highest-usage move in the corpus
(derived, not named — it picked `protect`, 175,476 uses), every probe of a tag that move carries
marked MISSING, and every probe of `ability|blocksMove` killed. All three are caught, by the three
different clauses.

**(a) IS SPLIT BY KIND AND THE SPLIT IS LOAD-BEARING.** 14 entities in the union set carry only
`untagged`. Two are MOVES — Power Gem (6,371) and Hydro Pump (4,799) — and a move with no mechanic is
a **vanilla attack the generic damage path covers completely**, so counting it as a gap would be
counting the engine working. Twelve are abilities and one item, and every ability does *something*:
`pressure` (962), `telepathy` (462), `berserk` (245), `moxie` (204), `raindish` (119), `naturalcure`
(115), `trace` (100), `magician` (95), `aromaveil` (71), `frisk` (45), `magicguard` (34), and
`item ironball` (189). **That is a tag_dex job, not an engine one.**

**AND `ability|accuracyMod` JOINED THE MISSING LIST WHEN THE UNION LANDED**, which is the gate doing
exactly what it is for: Sand Veil is in the CLEAN corpus's 99% ability set and was not in the raw
one, so a mechanic the census has reported MISSING all along became visible as a coverage gap. It is
one of the three census misses and is not new work discovered by this pass — it is the same hole,
now counted.

### THREE RED TESTS WERE MINE AND ALL THREE ARE FIXED IN THIS PASS

`tests/run-all.js` went **75 passed / 8 failed → 78 / 5**. Named rather than filed, because
"KNOWN FAILURE" is a banned phrase here:

- **`engine/selftest.js` — "every raw reader of the ladder store declares why".** The new files read
  the store and neither filtered nor declared. **Fixed by MEASURING rather than by declaring**, and
  the measurement changed the gate: `RAW-STORE-OK` would have been a claim that raw is the
  conservative direction, and it is not. `tests/regulation_usage.js` now calls `engine/quality.js`'s
  own `loadGames()` and the gate reads the union. 25 passed, 0 failed.
- **`tests/test-no-silent-failure.js` — 3 NEW silent catch blocks, all mine.** An unparseable store
  line is now COUNTED and printed (`unparsed`, currently 0); a cache that will not read says so, and
  is told apart from a cache that does not exist yet; the coverage ratchet's missing baseline is told
  apart from a corrupt one. 0 new.
- **`tests/test-effective-identity.js` — `tests/regulation_usage.js: 0 -> 2` raw reads of a
  transforming field.** DECLARED with a construction reason rather than re-baselined: the file never
  builds, loads or touches a live Pokemon — it opens the store, counts strings and returns
  `id -> integer` maps — and the PRE-mega ability is the answer the question wants, because it is
  measuring how much usage each declared ability carries. 18 passed, 0 failed.

**THE FIVE THAT REMAIN ARE NOT MINE, and one of them appeared mid-session from another writer.**
`tests/test-site-data-fresh.js` (eleven site bundles ~1.1 days behind the newest game data),
`engine/conformance.js` (`build/strong_player_baseline.js` ×2, `data/dusk-size-gate.json`,
`data/json-nan-guard-baseline.json`), `engine/provenance.js` (the pre-existing declared-void
`exploitability.json`), `engine/em_validation.js` (`board.js` and `fit_policy.js` digests moved, and
this pass touched neither). **`tests/test-site-sync.js` — `web/stadium.html` vs `app/stadium.html`,
137,656 against 114,884 bytes — was PASSING at 14:00 and failing by 15:06.**

**A CONCURRENT WRITER WAS ACTIVE IN THE TREE DURING THIS PASS AND THE DISPATCH SAID THERE WAS NOT.**
`web/stadium.html` (15:06) and `docs/MODELS.md` (14:34) both moved and this pass touched neither;
`tests/test-stadium-roster.js` flipped from FAIL to PASS between two of my runs because somebody
added the three missing ledger entries. **Nothing of mine overlaps** — every file this pass wrote is
`engine/medicham2-browser.js`, `tests/*`, `docs/ENGINE.md` and three `data/` artifacts it generated —
and the engine-side instruments (census, red demos, differential, game-diff, interaction matrix,
feature fixture, coverage gate) all read files this pass owns. It is stated because a run-all result
taken while somebody else is writing is not a photograph, and this repository has already lost 7,100
games to exactly that assumption.

### FILED, NOT FIXED

- **`dmgRange` suppresses `damageReduce` for a Mold Breaker on three abilities Showdown marks NOT
  breakable** — `prismarmor`, `shadowshield`, `ripen`. Pre-existing (WIRE 37's `defAb` shadow), and
  latent: 0, 0 and 14 corpus uses. The clean fix needs the artifact to carry Showdown's `breakable`
  flag, which is `tag_dex` work.
- **`STATUS_IMMUNE_ABIL` is a hand table and the red demo proves it.** Stripping `statusImmune` off
  Insomnia does not stop it refusing Spore. That deviation is already declared — the artifact's param
  is a bare `{immune: true}` on all twelve carriers and does not say WHICH status, so consuming it by
  shape would make Leaf Guard (sun only) and Pastel Veil (poison only) refuse everything always. The
  demonstration is now a **source reversion** rather than a tag strip, so the declared thing is shown
  to be the thing running.
- Everything below this section from the previous passes is unchanged, including
  **`clickFragility` pricing an -ate click against the raw move type** (routed to MEASURE, #50) and
  **`data/move-effects.js` disagreeing with the format dex on four accuracies**.

## THE DIRECT-CALL PROBES WERE ARMED, AND THREE OF THEM WERE HIDING A BUG. WIRES 124–126. 2026-08-06.

Census **217 → 218 live / 220 → 221 probed**; missing still 3 (the same three), hollow 0, `threw` 0.
`unarmed` **145 → 116**. **28 of the 47 direct-call probes were converted to spend a real turn** —
the whole ranked top 30 bar two, each named below with its reason. Differential unchanged at **1/150**
(the same pre-existing `chesnaught woodhammer -> mimikyu` row, the same 11 not comparable).
`tests/test-game-diff.js` agrees on every turn of all five scripted games. The interaction matrix was
re-run at `--full` against the changed engine and is **byte-for-byte unchanged**: 1,624/1,643 live
pairs agree (98.8%), the same 530 inert / 109 saturated / 16 ko-timing / 2 threw, the same six named
disagreements. `tests/probe_red_demo.js` is **38 demonstrations, 0 failed** (was 35).

**Every one of the three bugs below was invisible to the probe that covered it**, and that is the
finding this pass was dispatched to test. All three sat under a probe the census graded **LIVE**.

**The generated block at the top of this file is one census behind**, because this pass was dispatched
under an explicit instruction not to run `engine/status.js --write`. **THE RESTAMP IS OWED**; the
artifacts already say the right thing.

**AND THE RED-DEMO GUARD EARNED ITS KEEP MID-PASS.** WIRE 124's reversal patch was written, then the
engine block it reverts was edited again (the `moveFx` catch was given a counter so
`tests/test-no-silent-failure.js` would stop flagging it). `revertedEngine()` threw
`reversal did not apply — the source no longer contains:` and printed the stale text. That is the
alternative to a known-bad engine quietly becoming the shipped one, which would have made every
demonstration below it meaningless while still printing OK.

### WIRE 124 — 78 MOVES COULD NOT MISS, AND THE PROBE ASSERTED THE ANSWER

`moveAccuracy` ended `return ACC[id]||100` over a **hand-typed 35-move literal**. Every move not on
that list was never-missing. Measured over all 500 moves in `MC.moves` against the format dex at the
pinned commit `20ad99ff`:

| | |
|---|---|
| moves with accuracy below 100 in `gen9championsvgc2026regmb` | **78** |
| of those, present in `ACC` | **0** |
| corpus clicks on them | **35,608** |

Led by **Heat Wave 90% (7,405 clicks)**, Matcha Gotcha 90% (5,352), Dual Wingbeat, Make It Rain,
High Horsepower, Draco Meteor, Hyper Beam, Icy Wind, Toxic, Rock Tomb, Triple Axel, Population Bomb.

**THE PROBE COULD NOT HAVE SEEN IT, AND SAID SO IN ITS OWN SHAPE.** It read
`moveAccuracy('aerialace') >= 100` — which is exactly what an engine where *everything* is 100 also
returns. A never-miss set means nothing unless the moves outside it can miss, and nothing asked.

**The source was already in the tree and two other sites in this same file were already using it.**
`data/move-effects.js` carries `accuracy` for all 954 of its moves (`true` for a never-miss), it is
already a frozen release SOURCE, and the two status branches in the battle loop already read
`(fx&&fx.accuracy===true)?100:...` for this exact purpose. So the defect was **also a
FACTS-ARE-GLOBAL violation**: two accuracy engines in one file, one derived and one typed, disagreeing
on 78 moves. All three sites now call `moveAccuracy`.

**`ACC_FIX` IS NOT THE OLD LIST SHRUNK.** It is the rows where the GENERATED artifact disagrees with
the format dex, derived over all 500 moves rather than remembered, and it is exactly four —
`crabhammer 90→95`, `makeitrain 100→95` (2,443 clicks), `syrupbomb 85→90`,
`clangoroussoul 100→never-misses`. `data/move-effects.js` is generated from CHOMP's JSON and is not
ENGINE's to correct, so the deviation is carried at the engine with the dex's number beside it.
**The 35 hand-typed entries all AGREED with the dex** and are simply redundant now — the list was not
wrong, it was absent.

**AND THE CORRECTION LIST IS CHECKED, WHICH IS THE ONLY THING THAT MAKES IT DIFFERENT IN KIND FROM
THE LITERAL IT REPLACES.** `tests/test-engine-diff.js` gained an ACCURACY CONFORMANCE block that
re-derives every move's accuracy against the live format and exits 1 on a fifth row. It reads
**500 compared, 0 disagree, 0 unknown**. That harness compares DAMAGE and calls `dmgRange`, which
never rolls to hit — so it had been structurally blind to this for its whole life, and the new block
is the cheapest place to give it eyes.

### WIRE 125 — THE DEATH COUNTER FORGOT THE DEAD, ONE TURN AFTER THEY DIED

Found by converting `powerFromFallen`, whose old body contained its own confession:

```js
S.sfA.fainted = 3;      // the input, not the effect: three of ours are down
```

It wrote the counter by hand and asked whether `dmgRange` read it. Nothing had ever asked whether
anything **increments** it. The end-of-turn recount was
`[...act,...bench].filter(x=>x.fainted).length`, and `bringIn()` — the one path a replacement arrives
through — does `bench.splice(...)` then `act[i]=nx`. **The fainted body is in neither array
afterwards.** So the count was right for exactly the turn of the death and fell back to **zero** at
the end of the next one.

Last Respects (**19,299 uses**, a move whose entire identity is that it grows as your team dies) read
50 BP forever after the turn its ally fell. Supreme Overlord's `_fallenStuck` is stamped from the same
field, so every body entering later than the turn of a death carried an undercount — and the deeper
into a game, the more of the roster is dead and the wronger it got, which is precisely the phase both
mechanics exist for.

The roster was already on the side object (`battleInit` stamps `sf.team`). Still derived from the live
`fainted` flags every turn — no tally to drift — and a missing roster is **counted**
(`MEDFAILS.fallenNoRoster`, 0 over 40 random games), because a quiet fallback to the arrays that
caused this is indistinguishable from the bug.

### WIRE 126 — A COMMENT SAID THE -ATE ABILITIES WERE HONOURED. THE FUNCTION IT NAMED TAKES NO ATTACKER.

Found by converting `convertsMoveType`. The battle loop's type-immunity gate reads:

```js
/* effMoveType, not mv.t: the -ate abilities rewrite a Normal move to Flying or Fairy, and
 * a converted move DOES hit a Ghost. */
if (mcEff(effMoveType(mv, a.move.id, field), tg.types) === 0) continue;
```

`effMoveType(mv, moveId, field)` is handed **no attacker** and knew only about Weather Ball. The -ate
rewrite lived inside `dmgRange` and nowhere else. **This is WIRE 119's Taunt failure exactly — a
capability absent while a comment reports success — and it is the second time in three days this file
has been caught by one.**

Measured, both arms, before the fix: an Aerilate Staraptor's **Body Slam into a Ghost was priced by
`dmgRange` at 136–162 and dealt 0 by the battle loop.** Four more sites read the same helper and were
wrong the same way, so a Galvanized Body Slam was **not drawn by a Lightning Rod, not absorbed by Volt
Absorb, did not thaw, and did not make a Protean body Electric**.

One implementation now: `convertsMoveTypeTo()` owns the conversion, `effMoveType` calls it, and
`dmgRange` keeps only the POWER half (`damageMult`), which is a power question and belongs where the
power is.

**ONE CALL SITE DELIBERATELY STILL PASSES NO ATTACKER, AND IT IS DECLARED AT THE LINE.**
`clickFragility` is one of the six exports `board.js` reaches this engine through, so its output is a
**MAG feature input** — passing `att` would move the fitted vector and owe a refit, which is MEASURE's
expensive edge and not ENGINE's to spend. The consequence is stated rather than discovered: an -ate
body's click is priced against its RAW type there while the battle loop resolves it as the converted
one. **FILED below.**

### WHAT WAS CONVERTED, AND THE TWO THAT WERE NOT

28 of the ranked 47, which is the top 30 minus two, each judged rather than skipped:

- **`weatherSetter` "Drizzle sets rain on entry"** — the ranked list counts it because it spends no
  `battleTurn`, but the mechanic IS an entry effect and `battleInit` with entry effects on is the real
  path. WIRE 123's bug lived in that function and was caught by the three-armed probe beside it.
  Spending a turn adds nothing. **Armed instead** — it always computed a real control.
- **`multiAccuracy` "Triple Axel is priced below three full hits"** — an EXPECTED-HITS pricing
  question that `dmgRange` owns by design (WIRE 20's declared divergence: multi-hit damage is one
  packet). A real turn re-derives the same number through one more layer and asks nothing new.

**THE RATCHET IS THE DIRECT-CALL COUNT, NOT `unarmed`**, which is what #42/#45 asked for and the
reason is in the section below: `unarmed` falls as paperwork and says nothing about coverage.
Structurally — a probe body that mentions `battleTurn`, `battleInit`, `board(` or `turnDamage(`
against one that does not — the file now reads **182 spend a real turn or a real entry, 37 call the
mechanic directly**. It may fall and it may never rise.

Everything else in the top 30 now spends a real turn: the four accuracy probes, Intimidate through
**both** entry routes, Clear Body and Defiant through a real switch-in, Choice Scarf and Chlorophyll
as **turn ORDER** rather than a speed number, the mega stone through `battleInit` to the sun on the
field, and the whole damage family.

**FOUR PROBES WERE MADE STRICTER IN THE SAME PASS, BECAUSE THE CONVERSION EXPOSED THAT THEY HAD NO
CONTROL AT ALL:**

| probe | what it used to accept |
|---|---|
| `ignoresBoosts` Darkest Lariat | `a.max === b.max` — which is what an engine that ignores stat stages for EVERY move prints. Crunch is now the control and must fall |
| `needsUntrackedState` Gyro Ball | an Archaludon against a **Weavile** — different Attack, types and everything; "the numbers differ" was guaranteed. One body now, only Speed varied, and the DIRECTION asserted |
| `weightBased` Grass Knot | a Whimsicott against an **Archaludon**. One species now with `wt` overridden |
| `damageBoost` Aerilate | `b.max !== a.max`, which passes on an engine that made the move weaker |

### AND MY OWN PROBE WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-THREE.

The `overridesEffectiveness` control arm was written *"Freeze-Dry must equal Ice Beam against a
non-Water body"*. **Freeze-Dry is 70 BP and Ice Beam is 90**, so the correct answer off a Water target
is that Freeze-Dry is LOWER, and the probe would have failed on a perfectly correct engine. The
comfortable shape was "a control arm should be a null result"; the honest one is the direction the
base powers dictate, and it separates the two hypotheses just as well.

### MAG'S INPUTS DID NOT MOVE — MEASURED, NOT ARGUED

`engine/feature_fixture.js --check`: **CLEAN — all 58 columns hash-identical to fit time.** None of
the three wires is on `board.js`'s six-export path: `moveAccuracy` is not one of them and is not
called by `clickFragility` or `punishExposure`; `fallenCount` is inside `battleTurn`; and
`effMoveType`'s one feature-path caller was deliberately left unchanged for that reason. What changed
is ROLLOUT behaviour, which is the point of an engine fix and does not owe a refit.

**`engine/position_features.js` IS A DIFFERENT MATTER AND IT IS OWED A LOOK.** Line 197 reads
`1 - (M.moveAccuracy(id, field) / 100)` as a `risk` feature, so **that column really did move for 78
moves** — it was constant-zero for all of them and is now the true miss chance. Features are per-model
(CLAUDE.md), so this is not MAG's vector and `feature_fixture` correctly reports clean; but any model
fitted on position features predates the correct number. **Routed to MEASURE, not decided here.**

### FILED, NOT FIXED

- **`clickFragility` prices an -ate click against the raw move type.** Fixing it means passing the
  attacker into `effMoveType` at `medicham2-browser.js:1782`, which moves a MAG feature and owes a
  refit. Declared in a comment at the line.
- **`data/move-effects.js` disagrees with the format dex on four accuracies** (`crabhammer`,
  `makeitrain`, `syrupbomb`, `clangoroussoul`). It is generated by `build/build_browser_data.js` from
  CHOMP's `move-effects.json` — not ENGINE's file. The engine corrects them locally in `ACC_FIX`; the
  upstream artifact is still wrong and anything else reading it inherits that.
- **Found red, NOT mine.** `tests/test-no-silent-failure.js` reports **four NEW silent catch blocks in
  `build/strong_player_baseline.js`** (:300, :323, :425, :426). Not a file this pass touched. The two
  in `engine/dusk_size_gate.js` reported on 2026-08-06 are gone. Stated for the router to place, not
  filed as a status.

## WIRE 123 — ENTRY ABILITIES RESOLVED IN ARRAY ORDER, SO SIDE B'S LEAD OWNED THE SKY. 2026-08-06.

Census **216 → 217 live / 219 → 220 probed**; missing still 3 (the same three), hollow 0, `threw` 0,
`unarmed` still 145 — the new probe is armed. Differential unchanged at **1/150**, the same
pre-existing `chesnaught woodhammer -> mimikyu` row and the same 11 not-comparable.
`tests/test-game-diff.js` agrees on every turn of all five scripted games. The interaction matrix was
re-run at `--full` against the changed engine and is **unchanged**: 1,624/1,643 live pairs agree
(98.8%), the same six named disagreements, the same two `THREW`.

**The generated block at the top of this file is one census behind, because this pass was dispatched
under an explicit instruction not to run `engine/status.js --write` while two other agents held the
docs open. THE RESTAMP IS OWED**, and the artifacts already say the right thing.

Will, 2026-08-06: *"if two incins come out, which intim goes first indicates speed."*

### The claim is true of the real game, and the mechanic under it is one speed-sorted event

Read out of Showdown at the pinned commit `20ad99ff`, not remembered:

```
sim/battle-actions.ts:175  runSwitch(pokemon)  gathers every simultaneous switch-in off the queue
                     :184  this.battle.fieldEvent('SwitchIn', switchersIn)
sim/battle.ts:794          fieldEvent -> ... else { this.speedSort(handlers); }
sim/pokemon.ts             getActionSpeed()    Trick Room inverts it (10000 - speed)
```

Faster resolves FIRST. So the **LAST** entry weather setter to run owns the field, which means the
**SLOWER** one wins it — a real competitive fact and the sharpest possible test, because getting it
backwards multiplies every damage roll for the rest of the battle by the wrong number.

### MEASURED IN THE REFERENCE ENGINE, BOTH ARMS PRINTED, BEFORE A LINE OF ENGINE CHANGED

L50, Champions SP, `gen9championsvgc2026regmb` at the pinned commit:

| leads | reference | medicham2, before |
|---|---|---|
| Pelipper 117 Drizzle **v** Tyranitar 81 Sand Stream | **sand** | sand |
| Pelipper 85 Drizzle **v** Tyranitar 113 Sand Stream | **rain** | **sand** |
| Pelipper 117 + its ALLY Torkoal 40 Drought **v** Tyranitar 113 | **sun** | **sand** |

`battleInit` walked `A[0], A[1], B[0], B[1]` and applied every entry effect in that order, so **side
B's lead always won the weather**, whatever the speeds were. Three arms, one answer — *identical
results across a varied knob mean the knob is unwired*.

**THE THIRD ROW IS NOT DECORATION AND IT NEARLY WENT MISSING.** The sort is over ONE list containing
BOTH sides, so a slow ALLY resolves after the opposing lead. A per-side implementation ("all of A,
then all of B", or "A's lead against B's lead") passes the first two rows and fails the third, and it
is exactly the comfortable shape to reach for. It was measured before it was implemented.

### THE PROBE'S FIRST STAGING WAS WRONG BEFORE THE ENGINE WAS. THAT MAKES THIRTY-TWO.

The obvious pairing is Drizzle against Drought — Pelipper and Torkoal, the two the format actually
runs. In Champions a stat is base + SP + 20, so **Torkoal caps at 72 Speed and Pelipper floors at
85**: the two arms printed *the same faster body* and the reference gave sun in both. The knob did not
move, and on a FIXED engine that probe would have read as agreement. Pelipper (base 65) against
Tyranitar (base 61) overlaps, so the speed knob genuinely flips who is faster.

### One implementation of "who is faster", which is WIRE 118's whole point

`effSpeed` for the number and `compareTurnOrder` for the rule. **No second copy of the comparison is
written**, and the Trick Room inversion comes free from the comparator — which matters, because
Showdown's `getActionSpeed` inverts under Trick Room too and a hand-rolled `>` here would not have.

### MID-BATTLE SWITCHING WAS ALREADY RIGHT, AND THAT IS MEASURED RATHER THAN ASSUMED

Showdown queues **one `runSwitch` per switch action** (`insertChoice`, order 101 against `switch`'s
103), so a mid-turn double switch resolves entry abilities in the order the SWITCH ACTIONS ran — i.e.
by the **OUTGOING** body's speed, not the incoming one's. `bringIn` is called from inside those
already-sorted actions, so it agrees by construction. Four arms, and the knob was varied on both
sides of the question:

```
vary the OUTGOING speeds:  Corviknight 119 v Milotic 101 -> sand    Corviknight 87 v Milotic 133 -> rain
vary the INCOMING speeds:  Pelipper 117 v Tyranitar 81   -> sand    Pelipper 85  v Tyranitar 113 -> sand
```

medicham2 tracked the reference on all four. The incoming speed genuinely does nothing here, in BOTH
engines — so the fix is confined to `battleInit` and touches no switch path.

### WHERE THE INTIMIDATE SIGNAL ACTUALLY LIVES, because it decides where part 2 has to read from

**The order of two Intimidates is NOT observable in the board state.** Measured, both engines, both
arms, on Incineroar 112 v Arcanine-Hisui 110 and again on 80 v 142:

```
SHOWDOWN atk boosts [A0 A1 B0 B1] : [-1,-1,-1,-1]      MEDICHAM: [-1,-1,-1,-1]      both arms
```

Both drops land, on every body, whichever went first. The order is visible **only in the PROTOCOL
STREAM**, and there it is unambiguous:

```
Incineroar faster :  |-ability|p1a: Incineroar|Intimidate|boost   then  |-ability|p2a: Arcanine|Intimidate|boost
Arcanine   faster :  |-ability|p2a: Arcanine|Intimidate|boost     then  |-ability|p1a: Incineroar|Intimidate|boost
```

So **speed inference from duelling Intimidates must hook into the replay/live protocol parser, not
into any board or engine state.** medicham2 emits no protocol stream at all and is the wrong place to
read it from; `engine/durable-ingest.js` and the live client are where those lines exist. That is an
OPS-side channel, filed here because this pass is what established it.

**The weather case is the opposite and that is why it was worth the wire:** it IS in the board state,
it persists for the whole battle, and it was wrong.

### The probe, and the red is permanent

`ability weatherSetter — "the SLOWER entry weather setter owns the field, across both sides"`, armed,
three arms, the outcome (the weather standing on the field) rather than an order list. It reads the
reference's own numbers.

```
RED    Pelipper 117 v Tyranitar 81 -> sand;  85 v 113 -> sand;  + Torkoal 40 as A's ALLY -> sand
GREEN  Pelipper 117 v Tyranitar 81 -> sand;  85 v 113 -> rain;  + Torkoal 40 as A's ALLY -> sun
```

`tests/probe_red_demo.js` gained a `demoSource` arm whose known-bad engine is **the comparator and
nothing else** — `entrants.sort(compareTurnOrder…)` becomes `entrants.sort(()=>0)`, leaving the
entrants list, the interleaving and the tie counter exactly as shipped, so the one thing that flips is
the ordering rule. **35 demonstrations, 0 failed**; `shipped-arm=true, reverted-arm=false`.

### A SPEED TIE IS AN APPROXIMATION, SO IT IS COUNTED

Showdown breaks a tie with a coin (`speedSort`'s Fisher-Yates). `battleInit` is handed no rng and
inventing one would move every seeded run in the repo for a reason that has nothing to do with entry
abilities, so it keeps declaration order — and **`MEDFAILS.entryOrderTie` counts every time it has
to**. Measured over 2,000 random battle starts: **155 ties, 0.077 per start**. That is not zero, and
for two Drizzle bodies on the same Speed it is the weather.

### MAG's inputs did not move

`engine/feature_fixture.js --check`, read through `engine/status.js`: **CLEAN — all 58 columns
hash-identical to fit time**, with `engine/medicham2-browser.js moved 2026-08-06 06:45, and no feature
the fixture exercises moved with it`. The changed site is inside `battleInit`, which `board.js`'s
feature path does not call; what changed is ROLLOUT behaviour, which is the point of an engine fix and
does not owe a refit.

### Found red, NOT mine, reported rather than filed

`tests/test-no-silent-failure.js` exits 1 on **two NEW silent catch blocks in
`engine/dusk_size_gate.js:50` and `:212`**. Not this pass's file and not this pass's doing — the three
files edited here (`medicham2-browser.js`, `tests/test-mechanics.js`, `tests/probe_red_demo.js`) added
**zero** catch blocks between them. It is stated here for the router to place, not filed as a status.
The related `provenance` ratchet trip on `dusk-size-gate.json` is the same file.

## "UNARMED" IS MEASURING A CONVENTION THAT IS TWO DAYS OLD. MEASURED 2026-08-06.

**Will set the bar (2026-08-06):** *"i still want medicham to be fully wired and tested on every move
and ability and item in the regulation (with any usage at all) before we start taking its output and
using them."* Sizing that job produced a number that looked catastrophic, and the number is measuring
the wrong thing.

### The denominator Will asked for, which nobody had computed

Derived over 53,796 games / 117,588 sheet entries, counting both DECLARED sheet entries and moves
actually CLICKED in the turn stream. **819 distinct things carry real usage in this regulation.**

| | any usage | has a tag | every tag probed | every probe ARMED |
|---|---|---|---|---|
| moves | 491 | 99.2% | 93.3% | **9 (1.8%)** |
| abilities | 185 | 100.0% | 95.1% | **61 (33.0%)** |
| items | 143 | 98.6% | 89.5% | **7 (4.9%)** |

Usage-weighted armed: moves **0.8%**, abilities **3.7%**, items **2.2%**. Tagging is done, probing is
good, and the collapse is at arming — and it is the TOP of the distribution that is missing, not the
tail: `protect` 198,900 uses, `fakeout` 43,495, `intimidate` 10,754, `armortail` 3,403 (rank **8** of
185 — Smogon's 1630-cutoff file has Farigiraf running it **99.06%** of the time), `focussash` 15,037.

**This is also why "216/219 mechanics live" is the wrong number.** It counts probes that EXECUTED.
Will's question counts things people CLICK, and there are 819 of those.

### But `armed` is a declaration, not a capability — and here is the count

`armed` is set by `tests/test-mechanics.js` when a probe **returns `arms: {control, test}`**. The arms
protocol was added **2026-08-04, two days before this measurement**, so almost every probe predates
it. `armed: false` therefore means *"written before the convention"* at least as often as it means
*"weak"*.

The Choice Scarf probe is the proof. It is counted unarmed, and it builds **two** Basculegion, gives
one the item, and asserts `sb > sa * 1.4`. Delete Choice Scarf from the engine and `sb === sa`, the
assertion is false, **the probe goes red.** It has a control. It just does not declare it in the
machine-readable shape.

Classifying all **142** unarmed-and-live probes structurally:

| | count | what it means |
|---|---|---|
| spends a REAL TURN (`battleTurn`) | **93** | tests the **wiring** |
| calls the mechanic **directly** | **47** | tests the **function** only |
| has a control variant anyway | **111** | 78% — the flag is measuring declaration |

### The better diagnostic, and tonight's bug proves it

**A probe that calls the mechanic directly cannot catch a wiring bug.** WIRE 123 above is exactly
that bug: `applyIntimidate` and every entry-drop handler were CORRECT, and the ORDER they were called
in was not — so side B's lead owned the weather and every subsequent damage roll carried the wrong
multiplier.

And the Intimidate probe is on the direct-call list:

```js
probe('ability', 'onSwitchInDrop', 'Intimidate drops Attack', () => {
  const foe = bare('garchomp');
  const before = foe.boosts.at;
  M.applyIntimidate(foe);                       // <- called DIRECTLY, never through a switch-in
  return { works: foe.boosts.at < before, detail: `atk ${before} -> ${foe.boosts.at}` };
});
```

**It would not have caught WIRE 123**, and it is `live`, and it is about the single most-used ability
in the format. That is the class worth fixing, and it is **47**, not 482.

### What this changes about the work

- The job is **not** "write hundreds of tests". For 111 of 142 it is declaring a control the probe
  already computes — mechanical.
- The real work is the **47 direct-call probes**, converted to spend a real turn. That is the class
  that catches wiring, and wiring is where this engine's expensive bugs have actually been.
- **Ratchet on the direct-call count, not on `unarmed`.** `unarmed` will fall as a paperwork exercise
  and will not tell you whether coverage improved. Filed as #42 / #45.
- The cutoff for Will's gate is a **99%-of-usage coverage target** (moves 267, abilities 117, items
  100 — 484 of 819) rather than a per-entity threshold: a threshold is a list and goes stale when the
  meta moves, a coverage target is a mechanism and re-derives itself. **Plus a carve-out** for
  anything that turns a certainty into a failure regardless of usage — Queenly Majesty is 0.361%,
  rank 50, and it blocked a Sucker Punch in a real game on 2026-08-06.

## WIRES 119–122 — TAUNT DID NOT EXIST, AND THE #1 ROW BY VOLUME WAS NOT A HARNESS FAULT. 2026-08-06.

Census **211 → 216 live / 214 → 219 probed**; missing still 3 (the same three), hollow 0, `threw` 0,
`unarmed` still 145 — all five new probes are armed. Differential unchanged at **1/150**, the same
pre-existing `chesnaught woodhammer -> mimikyu` row and the same 11 not-comparable.
`tests/test-game-diff.js` agrees on every turn of all five scripted games.

**The interaction matrix, before and after, at `--full` against the pinned commit `20ad99ff`:**

| | before | after |
|---|---|---|
| live cases | 1,634 | 1,643 — nine cases became judgeable because a fix stopped the harness reading them as inert |
| live disagreements | 20 | **19** |
| off-gate disagreements (real, but in a bucket the gate discards) | 74 | **53** |
| **TOTAL KNOWN DISAGREEMENTS** | **94** | **72** |

Every expected value below was played at the pinned commit FIRST, both arms printed, before a line of
engine changed. Every probe was shown RED on a known-bad engine — `tests/probe_red_demo.js`, now 34
demonstrations, 0 failed.

### WIRE 119 — `forbidsStatusMoves`. TAUNT, 1,503 CLICKS, AND THE ENGINE DID NOT IMPLEMENT IT.

Will: *"Start with TAUNT — it is the biggest and it is the Incineroar mirror."* He is right, and the
state of it was worse than "partial": the volatile was written onto the target by the generic
`statusInflict` applier, decremented in the chooser, and **read by nothing**. A Taunted body still
landed Hypnosis, Stun Spore, Decorate, Screech, Disable, Feather Dance, Strength Sap, Trick-or-Treat
and another Taunt — twelve separate `X -> taunt` rows on the matrix.

**AND THE FILE SAID THE OPPOSITE IN WORDS.** The comment at `chooseAction` read *"Taunt forbids status
moves, so the mon falls through to the normal chooser with its status options removed"*, sitting
directly above a line that only did `me._vol.taunt--`. That is this repository's signature failure —
a capability that is absent while everything reports success — arriving through a comment.

**Showdown answers Taunt in TWO handlers off ONE condition, and both are wired:**

| | Showdown | where it lives here |
|---|---|---|
| **SELECTION** | `onDisableMove` — every Status move on the request is `disabled: true` | `illegalMoveNow`, hoisted to module scope so the **priors sampler** asks the identical question |
| **EXECUTION** | `onBeforeMove` — a status move already chosen FAILS when it runs | one gate **above the kind dispatch**, WIRE 77's place for WIRE 77's reason |

**THE EXECUTION GATE IS WIRE 77's PLACE BECAUSE TAUNT REFUSES A STATUS MOVE OF ANY KIND.** `affect`,
`status`, `setup`, `tail`, `haze`, `hazard`, `sub` and `phaze` are all status moves and all separate
branches; a copy per branch is exactly what let Roar through the Throat Chop silence. Protect and Wide
Guard are pre-resolved above the loop and are gated there instead — correctly, because Protect is +4
and Taunt is +0, so a Taunt landing *this* turn does not stop a shield that has already gone up.

**DERIVED FROM THE TAG, NOT BY NAMING TAUNT.** The table is `volatile -> the CATEGORY that volatile
refuses`, built from `forbidsStatusMoves.forbids` plus the same move's `statusInflict` volatile.
Membership was printed before it was trusted and is exactly one entry:
`taunt -> forbids "Status" via volatile taunt, turns 3`. **And the category predicate was checked
against the format dex before being trusted**: over every move in `data/tags.json`, `statusCategory`
agrees with Showdown's own `move.category === 'Status'` on all of them — zero tagged-and-not-Status,
zero Status-and-not-tagged. A category the artifact names and this engine cannot decide is COUNTED
(`fails.forbidCategoryUnknown`), never silently allowed.

**THREE THINGS IT HAD TO NOT GET WRONG:**

- **THE TICK MOVED TO END OF TURN**, beside Disable's, for Disable's own written reason: a duration
  that only counts down on turns the engine happens to be CHOOSING lasts forever in a rollout driven
  from outside (the WIRE 24 rule).
- **TAUNT LASTS THREE OF THE TARGET'S TURNS, NOT THREE TURNS.** Showdown's condition bumps its own
  duration when the target has already moved (`target.activeTurns && !this.queue.willMove(target)`).
  Measured both ways at the pinned commit: a **faster** taunter blocks turns 1(exec), 2, 3; a
  **slower** one blocks 2, 3, 4 — three refusals either way. Without the bump the slow case gets two.
  WIRE 118's `unresolved` set answers Showdown's exact pair of clauses, including the `activeTurns`
  half: a body dragged in mid-turn is in neither set and is correctly not bumped. medicham2 now
  reproduces both rows.
- **`_lastMove` IS DELIBERATELY NOT SET**, unlike WIRE 77 one line above. `runMove` calls
  `pokemon.moveUsed()` — the only writer of `lastMove` — AFTER the BeforeMove event, so a move
  refused by Taunt cannot become what an Encore repeats.

**AND THE PROBE THAT ALREADY EXISTED WAS THE PROBLEM, NOT THE ENGINE'S ONLY ONE.** `forbidsStatusMoves`
was in the census as LIVE and **UNARMED**: it checked that a Taunted body's free pick was not a status
move, with **no control arm** showing an untaunted one would have picked one. It passed for the whole
history of the engine not implementing Taunt. Two armed probes replace what it could not ask:

```
execution  foe attacked   -> foe ends up Taunted true      (reference: true)
           foe Taunted first -> foe ends up Taunted false   (reference: false)
selection  status clicks in 40 seeded draws: untaunted 16, Taunted 0
```

**A SIDE FINDING, FILED NOT FIXED.** The selection probe's first run leaked 5 Tailwinds through the
gate, and the cause is not Taunt: the priors label is a coarse INTENT and `pick.kind==='speed'`
converts *whatever move carried it* into `{kind:'tail'}` — **Milotic's priors label ICY WIND as
`speed`**, so a sampled Icy Wind came out of the chooser as a Tailwind. The gate now asks about the
action the branch PRODUCES rather than the move that was sampled, which is correct for Taunt (Icy
Wind is Special and stays legal). That the mapping fabricates a Tailwind at all is a separate
pre-existing defect in `MC.priors` handling.

### WIRE 120 — `partingshot -> throatchop` IS THE #1 ROW BY PAIR VOLUME AND IT IS **NOT** A HARNESS FAULT

The dispatch flagged it as smelling like a staging fault, on the strength of a `species` mismatch in
slot 0, and said to check before touching the engine. **Checked, and it is the engine.**

`kind:'switch'` serves two completely different actions and both were given priority **+6**: a BARE
switch, which really is a separate phase that happens first, and a **pivot MOVE** (`a.mv` present —
Parting Shot at **7,475 clicks**, Chilly Reception at 27), which is an ordinary status move. So
Parting Shot was the fastest action in the game. It dodged every hit aimed at its user, it out-sped
the Taunt and the Throat Chop that exist to stop it, and **the replacement, not the pivot user, ate
the attack.**

```
reference, 20ad99ff:  |move|p2a: Milotic|Scald  ->  |-damage|p1a: Incineroar|54/170  ->  |move|p1a: Incineroar|Parting Shot
                      identical damage against a Knock Off control — the pivot changes nothing about when the user is hit
medicham2, before:    pivot user took 0, its replacement took 54
medicham2, after:     pivot user took 115, its replacement took 0
```

Every `partingshot -> *` row left the matrix.

### WIRE 121 — `voltswitch -> lightningrod`, THE LARGEST REMAINING ROW (1,459 x 2,108)

Showdown fires `selfSwitch` only when `moveHit` did not fail, so a Volt Switch into **Lightning Rod,
Volt Absorb or Motor Drive** leaves its user standing. medicham2 pivoted anyway, which turns the three
abilities built to punish an Electric click into a free escape.

```
reference, all three arms:  Lightning Rod -> p1 slot0 = pikachu    Volt Absorb -> pikachu
                            Marvel Scale control -> garchomp        (the arms genuinely differ)
```

The gate is `dealt > 0`, the same one WIRE 46 puts on `userFaints`, and it is an **approximation
stated rather than discovered**: it would also refuse a pivot on a hit that legitimately deals zero,
of which this format's `pivotDamaging` set has no member. It also removed the `flipturn ->
spikyshield / banefulbunker / kingsshield` rows, because a blocked Flip Turn deals nothing either.

### WIRE 122 — Good as Gold refuses Yawn, and the Yawn branch was the one route that never asked

`refusesStatusMoves` is checked in **nine** places in this file. The `yawn` branch was the tenth site
and had no check, so Gholdengo (2,461 sheets) took a drowse it is immune to. Reference, both arms on
the SAME body so the body is not the variable: Good as Gold `vol=[]`, Honey Gather control
`vol=[yawn]`.

**A TENTH HAND-WRITTEN COPY IS EXACTLY WHAT CLAUDE.md's FACTS-ARE-GLOBAL RULE FORBIDS, and it is
written anyway — with the reason.** Each of the nine sits beside a *different* set of companion gates
(`bounceOff`, `moveClassBlocked`, `powderBlocked`, `pranksterBlocked`), so collapsing them is a
consolidation this pass is not scoped to make. **FILED: `refusesStatusMoves` wants one predicate and
has ten call sites.**

### THE ROWS THAT ARE GENUINELY HARNESS, NAMED

- **`taunt -> taunt`** — the generator picks `usersOf('taunt')[0]` for BOTH the carrier user and the
  reactor holder, so it is **Alakazam against Alakazam**: a pure speed tie, and the two engines flip
  their own coins. Still off-gate; not an engine fault.
- **`yawn -> insomnia`** — already filed as harness by the dispatch and confirmed: the two engines
  have different bodies in slot 0, so the comparison means nothing.
- **`voltswitch -> lightningrod` STAGED TWICE** — the dispatch's generator fault is real and is
  **still there**: the same (key, carrier, reactor) triple appears twice under `moveType:Electric`.
  The row is now fixed so it no longer disagrees, but the duplicate staging is untouched and remains
  open in `tests/interaction_matrix.js`.

### MAG'S INPUTS DID NOT MOVE, AND THAT IS MEASURED RATHER THAN ARGUED

Every site these four wires touch is inside `battleTurn`, `chooseAction` or `actionPriority`. Counters
were wrapped around every relevant engine export and the fit's OWN decision walk was run —
`fit_policy.decisionsFor` into `board.featuresFor`, **57,275 candidate vectors over 300 clean games**:

```
battleTurn 0    actionPriority 0    playerAction 0    sortTurnOrder 0    turnOrderKey 0
compareTurnOrder 37,084   priorityRefusedAbove 5,555   dmgRange 262,737   buildMon 265,221
```

The feature path calls **none** of the changed functions. `compareTurnOrder` is the one turn-order
function it does call and it is byte-identical. `board.js` reaches this engine through exactly six
exports (`buildMon`, `dmgRange`, `clickFragility`, `punishExposure`, `priorityRefusedAbove`,
`compareTurnOrder`) and not one of them was edited.

**`engine/feature_engine_contrast.js` WAS NOT RUN, AND THAT IS A DELIBERATE CALL RATHER THAN A SKIP.**
It contrasts LIVE against a FROZEN RELEASE, and every frozen release predates WIRE 118 — so it
already reports `MOVED (deadNoLastMove, movesFirst, diesBeforeMoving)` for a documented reason that
has nothing to do with this pass. Quoting it here would be a null from an instrument that cannot
isolate the question. The counter walk above can, and does.

**WHAT DID CHANGE IS ROLLOUT BEHAVIOUR.** `rollout_leaf.js` calls `battleTurn`, so MILTANK's rollouts
now play Taunt, Parting Shot and Volt Switch correctly. That is the point of an engine fix; it is not
a feature-vector move and it does not owe a refit.

## THE 97 DEFECT CANDIDATES WERE TRIAGED. NOUGHT OF THEM IS A DEFECT. 2026-08-06.

The sweep below reported **97 DEFECT-CANDIDATE** operators and they were handed on as 97 bugs. Will
asked what the top two actually were. **Both are false positives**, and neither is a close call:

| row | what the source does |
|---|---|
| `damageMultAll / lifeorb` — 10,791 uses, the **highest row in the list** | the DAMAGE half is read straight off the tag at `medicham2:1216`. Only the **recoil** branches on `m.item==='lifeorb'`, so mutating `costsPerAttack` cannot move behaviour. A *derive, never name* violation that is **LATENT** — Life Orb is the only carrier of `costsPerAttack` today — not a live defect |
| `halvesDamage / lightscreen` — 3,404 uses | **NOT A DEFECT AT ALL, and the engine is deliberately right.** `medicham2:2924` keeps separate P/S counters and honours the category the tag declares. It ignores the tag's `mult` **on purpose**: the tag carries the SINGLES 0.5 and this is a doubles engine where the reduction is 2732/4096. Using 0.5 would overvalue every screen click by a third |

The harness's header has said since it was written that *"READ-AND-IGNORED IS NOT THE SAME THING AS A
DEFECT, AND THE RULE THAT SEPARATES THEM IS WRITTEN DOWN RATHER THAN APPLIED BY FEEL"*. The rule it
had could not see a **DELIBERATE OVERRIDE**. That was the gap.

### The classification, and it is a PARSE of the source — never a comment

A comment is prose and this repo has been burned by trusting prose, so nothing here is graded on one.
The classifier parses every `TAGS.param / has / withTag / reactorsTo` call in the frozen engine with a
balanced-paren argument scan (a loose regex over a 220-char window conflates the tag argument with its
neighbours, and the B/C split turns on which argument a literal sits in), then asks two questions:
**is this param dereferenced off the variable the lookup was bound to**, and **does the carrier's id
drive a branch by name**.

| | | of the 97 | of all 340 open |
|---|---|---|---|
| **A** | **TAG NEVER READ.** No lookup names the tag (or none for this carrier's KIND), and the id drives no branch either. **Nothing in the simulator implements this fact.** The real-defect class | **0** | **163** ops, 56 rows |
| **B** | **PARAM OVERRIDDEN.** The tag IS read; the param is dereferenced nowhere. The engine consumes membership and substitutes its own value. Not a defect — the site is printed so a human can check the substitution | 40 | 73 |
| **C** | **HARDCODED BY NAME.** As B, and the id drives a branch. **LATENT**: correct while the simulator names the only carrier, wrong the moment a second arrives — so the tag's carrier count is printed as the risk | 5 | 52 |
| **D** | **BATTERY GAP.** The param IS dereferenced in the source, so the fact is consumed and this battery could not move it (an unreached branch, or an equivalent/saturated mutant). The same kind of answer as UNREACHED-BY-THIS-BATTERY | 52 | 52 |

**Nought of the 97 is a defect.** Every class A operator came out of the NO-CONSUMER-IN-SOURCE bucket
instead — which is where Taunt has been sitting.

### The triage is a check, so it is gated like one

Three cases were decided BY HAND, by reading the engine, before the rule existed. The sweep refuses to
run and writes no artifact unless the rule reproduces all three, and `tests/test-mutation-coverage.js`
asserts the artifact on disk was produced by a rule that could:

```
MATCH   forbidsStatusMoves / taunt          expected A, got A
MATCH   halvesDamage / lightscreen          expected B, got B
MATCH   damageMultAll / lifeorb             expected C, got C
```

### THREE FALSE MATCHES WERE IN THE RULE BEFORE THE ENGINE WAS, AND ALL THREE HID A DEFECT

Every one demotes a row OUT of the defect class, which is the dangerous direction, and every one was
found by printing what the rule matched before trusting it (LESSONS §4):

- **Comments quote code.** `'encore'` appears at 2478 inside *``kept reading `vol medi=["encore"]` ``*
  and `'trickroom'` at 2296 inside a sentence about actions. Both read as the engine branching on that
  name. Comments are stripped before any name is looked for.
- **`{kind:'protect'}` writes an ACTION KIND** and decides nothing about the move. Only an equality, a
  `.has/.includes/.indexOf`, or membership of a name set counts; anything else is recorded as `other`.
- **`SPREAD_LEGACY` at line 166 is LIVE CODE** (line 169 uses it as the spread fallback) and it holds
  `'blizzard'`, `'rockslide'` and `'heatwave'`. A plain "is the name in a set" test moved
  `blizzard / inflictsFreeze`, `rockslide / flinches` and `heatwave / inflictsBurn` out of the defect
  class on the strength of a set about something else entirely. **A name-set match now requires half
  the set's members to carry the tag** — POWDER scores **0.88** against `powder` and counts,
  SPREAD_LEGACY scores **0.03** against `flinches` and does not. Derived from the artifact, not from an
  opinion about which set is which.

A fourth was the opposite error and was fixed in the same pass: requiring an ID-SHAPED left side on an
equality rejected `_e.volatile==='encore'`, which is exactly how Encore is implemented, and put a
4,695-use row in the defect class on a technicality. This engine names its actions and volatiles after
their moves, so an equality counts whatever is on the left of it.

### The ratchet is class A only

`defectCandidates + tagNotConsumed + noConsumerInSource` = 340 is retired as a ceiling. **A number
that counts false positives is a number people learn to ignore.** The ceiling is 163 and carries its
own scope, which hashes **the text of the classifier** — for exactly the reason the battery scope
hashes the script text, and it earned that: the rule was tightened three times during calibration and
each tightening moved class A (139 → 167 → 163). The per-operator ratchet keeps the BATTERY scope
alone, because its verdicts are LIVE / READ-AND-IGNORED and are untouched by how they are classified.

### CLASS A IS NOT "163 MISSING MECHANICS" AND THE ARTIFACT SAYS SO

It means the fact reaches the simulator **neither as a tag nor through the carrier's name**. A THIRD
route can still carry it — `mv.rc` for recoil, `data/move-effects.js` for every secondary, an action
`{kind:'weather'}` — and this instrument cannot see any of those. The census can, and it is the second
sort key: **49 of the 56 rows have no ARMED census probe**, and that is the number that is a defect
claim. The top of the fix order, ranked by what the census can prove and then by usage:

```
   uses   share   cum   carrier / tag                          census
  11895   2.78%   2.8%  move:rockslide / flinches              UNARMED-LIVE
   7297   1.70%   4.5%  move:partingshot / lowersTarget        UNARMED-LIVE
   7162   1.67%   6.1%  move:heatwave / inflictsBurn           UNARMED-LIVE
   7109   1.66%   7.8%  move:moonblast / secondaryStatEffect   UNARMED-LIVE
   6660   1.55%   9.4%  move:flareblitz / inflictsBurn         UNARMED-LIVE
   6660   1.55%   9.4%  move:flareblitz / recoil               UNARMED-LIVE
   6180   1.44%  10.8%  move:wavecrash / recoil                UNARMED-LIVE
   5504   1.28%  12.1%  move:shadowball / secondaryStatEffect  UNARMED-LIVE
   5491   1.28%  13.4%  move:kowtowcleave / neverMissesAttack  UNARMED-LIVE
   4774   1.11%  14.5%  move:lastrespects / needsUntrackedState UNARMED-LIVE
   6802   1.59%  24.9%  move:suckerpunch / needsTargetToAttack  NO-LIVE-PROBE
    690   0.64%   0.6%  item:widelens / accuracyMod             NO-LIVE-PROBE
```

Share is **within the carrier KIND** — a move's uses is a click count and an item's is a sheet count,
and adding them would be the Blaze error with an extra step — so the item rows carry their own
cumulative column. **Two of the three mechanics the census itself lists as MISSING land in class A** —
`needsTargetToAttack` (4 operators) and `accuracyMod` (8) — which is the closest thing this pass has to
a positive control: the classifier found them by a route that knows nothing about the census. **The
third does not, and the reason is stated rather than rounded off**: `writesAccuracy` emits **no
operators at all** — it is UNSTAGEABLE in this battery, so it is absent from the letters rather than
graded by them. A claim of "all three" was written here first and was wrong; the artifact says
otherwise and the artifact wins.

**AND THE LIST IS ALREADY ONE ROW OUT OF DATE, WHICH IS THE MECHANISM WORKING RATHER THAN FAILING.**
`move:taunt / forbidsStatusMoves` is class A against release `032b4a2979dd` and sorts **last** in the
fix order, because the census — read from the LIVE tree — now grades it **ARMED-LIVE**: a second ENGINE
agent landed the Taunt wire while this swept. Against the frozen bytes the verdict is still true, and
the census column is a POINTER for ordering work and never evidence about those bytes; the artifact
says so in `triage.census.note`. Class A will fall at the next release cut, and it will fall because a
mechanic landed rather than because a rule was loosened.

Sweep: 182 tags, 785 operators, 58s, peak RSS 413 MB, frozen release **`032b4a2979dd`**. **No engine
file was edited by this pass**, and none was read for behaviour — a second ENGINE agent held
`medicham2-browser.js` open for the Taunt work while it ran.

## COVERAGE LAYER 2 SWEPT ALL 182 TAGS, AND 52 OF THEM THE SIMULATOR NEVER LOOKS UP. 2026-08-05.

**Superseded in part, 2026-08-06** — see the section above. This pass's `open defects: 340` counted
false positives and is retired as a number; its 206 / 37 / 97 split is still what the MUTATION found
and is unchanged. What changed is what the split MEANS.


Will: *"i bet there are 100s like taunt just sitting there man"* … *"okay fix it."* He is right. The
count is **206 operators**, and the shape of them is worse than the number.

`tests/mutation_harness.js` + `data/mutation-coverage.json`, measured against frozen release
**`032b4a2979dd`** and stamped with it, because a second ENGINE agent was rewriting
`medicham2-browser.js` for dynamic speed while this ran. **No engine file was edited by this pass.**

| | before (12 tags) | now (all 182) |
|---|---|---|
| tags swept | 12 of 182 | **182 of 182** — derived from the release's own `data/tags.json`, never typed |
| operators | 93 | **785** — 322 LIVE, 463 READ-AND-IGNORED |
| open defects | `defectCandidates: 45`, which counted **no tag-level finding at all** | **340** — 206 NO-CONSUMER-IN-SOURCE + 37 TAG-NOT-CONSUMED + 97 DEFECT-CANDIDATE |
| `unstageableTags` | `[]`, for 12 tags | 25 UNSTAGEABLE + 5 NO-CARRIER + 32 UNREACHED-BY-THIS-BATTERY, each named |
| `streamShiftSuspect` | 2, unexplained | 3, **explained below** |

### THE FINDING: `data/tags.json` IS NOT THE SIMULATOR'S SOURCE OF TRUTH FOR 52 TAGS

A source grep of every `TAGS.param / has / withTag / reactorsTo` call in the frozen
`medicham2-browser.js` finds **131 distinct tag names. The artifact has 182.** The 52 that appear in
no lookup are printed on every run. Cross-referenced against `data/mechanics-census.json`'s own
`armed` field — the one thing that separates a probe which PROVES a mechanic from one that asserts it
in a prose string — they split three ways, and the split is the fix order:

| census says | tags | what it means |
|---|---|---|
| **UNARMED-LIVE** | **27** | a probe ASSERTS the mechanic, the simulator does not read the tag, **and nobody has proven anything.** `forbidsStatusMoves` — Taunt, 1,438 uses — is in this bucket, and today's interaction matrix found a Taunted body still lands Hypnosis. This bucket is where the bodies are |
| **NO-LIVE-PROBE** | 20 | no live probe AND no lookup. Nothing anywhere demonstrates the fact. Led by `needsTargetToAttack` (Sucker Punch, 6,802), `accuracyMod` and `writesAccuracy` — all three already in the census's MISSING list — then `substitute` (567), `ohko`, `setsRoom`, `passesState` |
| **ARMED-LIVE** | 5 | a probe PROVES the mechanic and the fact is carried elsewhere. `doublesSideSpeed`, `lowersUser`, `statusCategory`, `statusImmune`, `untagged`. A second, unread copy — the FACTS-ARE-GLOBAL risk — not a missing mechanic, and ranked last |

**THE INSTRUMENT DOES NOT CLAIM 206 MISSING MECHANICS AND MUST NOT BE READ AS IF IT DID.** Recoil
comes off `mv.rc` in the move table, flinch and every secondary off `data/move-effects.js`, Protect
off a `PROTECTMOVES` name set, Tailwind off `{kind:'tail'}`, powder off a hard-coded eight-name
`POWDER` set. Those work. What NO-CONSUMER-IN-SOURCE says is that the fact has a second copy the
simulator does not read — which is how `data/tags.json` and the engine drift apart without either
failing, and it is why a new powder move next regulation arrives in the artifact and not in the set.

### The top 20 by usage, and what fraction they carry

The 20 rows are 16 distinct moves carrying **180,189 clicks — 42.0% of all move clicks in the
corpus.** Every one is NO-CONSUMER-IN-SOURCE with an UNARMED census probe:

```
 uses   share  carrier / tag                              uses   share  carrier / tag
71951  16.79%  protect / neverMisses                      7109   1.66%  moonblast / secondaryStatEffect
71951  16.79%  protect / priority                         6660   1.55%  flareblitz / inflictsBurn
71951  16.79%  protect / stalling                         6660   1.55%  flareblitz / recoil
12872   3.00%  fakeout / flinches                         6192   1.44%  ragepowder / powder
12872   3.00%  fakeout / priority                         6180   1.44%  wavecrash / recoil
11895   2.78%  rockslide / flinches                       5504   1.28%  shadowball / secondaryStatEffect
11581   2.70%  tailwind / neverMisses                     5491   1.28%  kowtowcleave / neverMissesAttack
 7297   1.70%  partingshot / lowersTarget                 4774   1.11%  lastrespects / needsUntrackedState
 7195   1.68%  trickroom / reversesSpeed                  4695   1.10%  encore / locksTarget
 7162   1.67%  heatwave / inflictsBurn                    3631   0.85%  sludgebomb / inflictsPoison
```

Share is **within the carrier KIND**. A move's `uses` is a click count and an ability's is a sheet
count; adding them and calling the result a share is the Blaze error with an extra step.

### WHAT WAS TRIAGED OUT, each by a rule that is written down and prints what it matched

`readAndIgnored` is 463 and OPEN is 340. The 123 that came off did so under one of these, in order,
and the membership of every one is in the artifact:

| rule | n | decided from |
|---|---|---|
| **UNREACHED-BY-THIS-BATTERY** | 32 | the simulator DOES look the tag up and no scripted turn reached the branch. **Not a defect — this battery's own gap** |
| PRESENCE-ONLY | 61 | a boolean on a tag whose removal is LIVE; membership already carries the bit |
| RESTATES-THE-TAG | 13 | a STRING param identical on every carrier (≥2). `spreadFoes.target` is `allAdjacentFoes` on all of them: the tag IS the selector |
| NO-LEGAL-CARRIER | 11 | an ability no species with `isNonstandard: null` in the format has — derived, not remembered |
| ZERO-USE-IN-CORPUS | 6 | 0 uses across every ingested sheet |
| BANNED-BY-FORMAT | 0 | `isNonstandard != null`, asked of the format. Zero, and that is a result: `tag_dex` is not emitting banned carriers |
| null params | 41 | a null param is not a fact; writing a sentinel asks the consumer to honour something the artifact never asserted |
| nested params | 21 | objects and arrays-of-objects are not perturbed, counted rather than silent |

**The format id is read out of the release's own `data/regulations.json`.** Not typed —
`engine/conformance.js` S12 caught the literal on the first run of this file, which is the guard
working.

### FOUR THINGS WERE WRONG IN THIS FILE BEFORE THE ENGINE WAS. THAT MAKES THIRTY-ONE.

Every one produced a comfortable answer, and three of the four were found by looking at a number that
was too clean:

- **The harness did not run at all.** The half-finished pairing refactor left `TEAM_A`/`TEAM_B`
  undefined, so every staging threw, both arms read the same exception text, they compared EQUAL, and
  every tag scored UNSTAGEABLE. The planted-stub gate caught it — which is what it is for — and
  `allThrew` is now a per-case field so a staging failure can never again be read as inertness.
- **`speedMult` and `stabBoost` read READ-AND-IGNORED on an engine that reads both.** The only
  pairing had an 80-Speed body opposite a 161, so a x1.5 overtakes nothing and turn order — a speed
  multiplier's only observable — never moves. There is no name-based Choice Scarf fallback anywhere
  in the engine; grep it. Pairing 2 puts every active body inside one multiplier of the body opposite
  it, stated as a property of a battery rather than as a fix for one item.
- **The battery was too SHORT to see the tag this whole file was built around.** `extendsDuration`
  turns 5 into 8, and a five-turn trace ends with the screen still up in BOTH arms — so Light Clay
  and Damp Rock reported 7 defect candidates on an engine that reads them perfectly. At ten turns the
  screen (T1) and the weather (T2) both expire inside the trace and the tag comes back **10 LIVE**.
  The weather was also being set on T1 by the script, which overwrote every entry `weatherSetter`
  before it could be observed — that tag went from UNSTAGEABLE to **4/4 LIVE** by moving one click.
- **`asked = 0` IS NOT DECISIVE HERE, AND A CLASS CALLED `NO-CONSUMER-ANYWHERE` NEARLY SHIPPED SAYING
  IT WAS.** `engine/tags.js`'s header calls ASKED = 0 decisive, and it is — for a battery of real
  games. The receipt that it is false for a ten-turn script: **`survivesFromFull` came back asked=0**,
  and its consumer is `medicham2-browser.js:3508`, WIRE 12, **Focus Sash, 13,125 uses**, which was
  sitting fifth in the ranked defect list. It reads zero because that branch only runs when a lethal
  hit lands on a full-HP body and no scripted turn does that. The decision moved to a SOURCE GREP,
  which cannot be unreached, and the false class became `UNREACHED-BY-THIS-BATTERY`.

**AND THE RATCHET LIED ON ITS FIRST RUN.** It reported
`item:blackglasses:damageMultType.mult LIVE -> READ-AND-IGNORED` as a regression against an engine
that had not moved — same release id in both runs. The per-operator ratchet was comparing verdicts
across two different BATTERIES. Both ratchets are now scoped, and the scope hashes the script text,
because turns and arms were unchanged while the actions on each turn were rewritten. **The release id
is deliberately NOT in the scope** — a new release resetting the ceiling would switch the ratchet off
at exactly the moment it is needed.

### The three stream-shift suspects, explained rather than left as a hedge

`--explain=<operator>` replays one operator and prints the first turn at which the two traces diverge,
field by field. (It was wrong first too: it staged the reference arm AFTER installing the mutant DB,
and `TAGS` is one shared module, so both arms ran against the mutant and it printed "no difference"
for an operator scored LIVE with changed=5.)

| operator | what the replay shows |
|---|---|
| `poisontouch:poisonsOnMyContact.needsContact:=false` | **A die drawn and discarded.** The site is `(!_pt.needsContact \|\| mvMakesContact(…)) && rng()<p`, so the mutant short-circuits TRUE and rolls on the special attack too. Under k05 the roll SUCCEEDS and `applyStatus(tg,'psn')` does nothing, because Will-O-Wisp already burned the only target that attack reaches. The extra draw realigns both LCGs; every difference printed is 1-7 HP of damage roll |
| `toxicchain:poisonsOnMyContact.needsContact:=false` | identical, same site, same carrier tag |
| `prankster:priorityMod.shift:=10` | **Characterised, not fully explained.** One of twenty arms, streaming, diverging at turn 5 in which body is active. All three constant rngs are byte-identical, and +1 already outranks everything else in this script, so the shift reorders nothing — the likeliest cause is the lazily-drawn speed-tie coin being demanded on one turn and not the other. Said plainly: the LIVE verdict for this operator rests on a realignable stream |

A stream-shift-suspect keeps its LIVE verdict on purpose. LIVE is the safe direction — calling it
READ-AND-IGNORED would manufacture a defect.

### It is registered, and the ratchet is real

`tests/test-mutation-coverage.js` — auto-discovered by `tests/run-all.js`, unlike a file called
`mutation_harness.js`. It re-runs the planted-stub gate (~13s), asserts both ratchets, and asserts
the sweep still covers **every** tag in the release artifact, so a sweep quietly narrowed back to a
comfortable dozen fails instead of reading as a pass. It does **not** fail when a newer release
exists; it prints the drift and the command, and the reason that is a deliberate call rather than a
silent one is written in the file's header.

Full sweep: **171s, 182 tags, peak RSS 358 MB**, single process.

## WIRE 118 — THERE WERE TWO IMPLEMENTATIONS OF "WHO MOVES FIRST". ONE IS DELETED. 2026-08-05.

Census **210 → 211 live / 213 → 214 probed**; missing still 3 (the same three), hollow 0, `threw` 0,
`unarmed` 145 (the new probe is armed). Differential **1/150**, the same pre-existing
`chesnaught woodhammer -> mimikyu` row and the same 11 not-comparable. `tests/test-game-diff.js`
agrees on every turn of all five scripted games.

Will has raised this three times and the previous answers were the wrong shape — a consistency test, a
ratchet, a proposed shared module. **A test that checks two copies agree is a workaround for having
two copies.**

| | before | after |
|---|---|---|
| `engine/medicham2-browser.js` | sorted `acts` ONCE per turn and walked it frozen — **no dynamic speed at all** | freezes the bracket, then **re-sorts the remaining actions before each one resolves** |
| `engine/board.js:2791` | `(slowFirst ? mySpe < thSpe : mySpe > thSpe) ? 1 : 0` — the Trick Room inversion and the speed comparison, restated by hand **twelve lines below `D2.priorityRefusedAbove`**, a call into the very engine that owns the rule | `D4.compareTurnOrder({spe: mySpe}, {spe: thSpe}, {tr: slowFirst ? 1 : 0}) < 0` |

The two had **measurably diverged**, and it is not a corner case: `board.js:466` says in words that a
Tailwind on a Prankster user lets the partner's Earthquake land first THIS turn, so MAG's `speedSwing`
and `speedSetupHelpsPartner` believe in dynamic speed — while the rollout that checks MAG's opinion
said the Tailwind did nothing. MILTANK sat between them and **the search believes the simulator.**

### The rule is Showdown's own, read out of Showdown

```
sim/battle-queue.ts, file header:  "Actions are sorted based on order (lower first) followed by
                                    priority (higher first) followed by speed (higher first).
                                    Ties are broken with Fischer-Yates."
sim/battle.ts, gated on gen >= 8:  "In gen 8, speed is updated dynamically so update the queue's
                                    speed properties and sort it."
                                    this.updateSpeed(); …getActionSpeed(a)…; this.queue.sort();
```

**The re-sort re-derives the SPEED only.** `order` and `priority` are resolved once, when the action is
queued — so `_pri` is frozen at the top of the turn here rather than recomputed, and a Grassy Terrain
set halfway through a turn does not retroactively give Grassy Glide its priority.

**MEASURED FIRST, in the official engine at the pinned commit, both arms printed before a line of
engine changed** (`scratchpad/ref-dynspeed.js`, then `ref-dynspeed2.js` for the exact probe pair).
L50 / 0 EV / 31 IV / Serious — Whimsicott 136, Garchomp 122, Milotic 101, Incineroar 80 (160 under
Tailwind):

```
control : Whimsicott -> Garchomp -> Milotic -> Incineroar
tailwind: Whimsicott -> Incineroar -> Garchomp -> Milotic     Incineroar OVERTOOK, inside the turn
```

### The probe, and it was RED first

`move doublesSideSpeed — "Tailwind speeds the PARTNER up inside the same turn"`, armed. The tag already
had a probe; that one reads the partner's speed AFTER the turn and **structurally cannot see when the
boost starts counting** — the weather-rock lesson again, a mechanic with two halves needs a probe per
half. The outcome, not the order list: Milotic is left on 1 HP, so whoever moves first decides whether
Milotic ever acts.

```
RED    partner (Incineroar 80) took 115 … and 115 after the ally clicked Tailwind
GREEN  partner (Incineroar 80) took 115 … and 0   after the ally clicked Tailwind
```

**AND THE RED IS PERMANENT, NOT A TRANSCRIPT.** `tests/probe_red_demo.js` gained a `demoSource` arm
whose known-bad engine is **exactly the frozen queue and nothing else** — the three-line re-sort
deleted, with the comparator, the frozen bracket, the tie and the `order` overrides all left in place,
so the one thing that flips is the thing this wire is about. 29 demonstrations, 0 failed;
`shipped-arm=true, reverted-arm=false`. The revert asserts it applied, so a patch that silently
stopped matching cannot make a broken engine look fixed.

**THE FIRST STAGING WAS WRONG BEFORE THE ENGINE WAS, WHICH MAKES TWENTY-SEVEN.** The dispatch's pair
was Garchomp/Incineroar, correct at 0 EV. `buildMon` uses USAGE spreads and its **Garchomp is invested
at 161**, so Tailwind's 160 does not overtake it — the probe would have printed identical arms on a
FIXED engine and read as agreement. Incineroar (80) and Milotic (101) are the two bodies whose `MC`
lines are exactly the reference's own 0-EV lines, so the probe and the reference ask one question at
one set of numbers.

### The three things the re-sort had to not break, each made explicit

- **THE TIE MUST NOT RE-ROLL.** The old comparator ended `sp||(rng()<0.5?-1:1)` — a coin flipped INSIDE
  the sort. Re-sorting each iteration re-draws it, the RNG stream diverges, and every seeded run in the
  repo changes for reasons that have nothing to do with speed. The tie is now rolled **once per action,
  on first demand, and stored** (the shape `_qc` already uses). Lazily, so a turn with **no** speed tie
  draws exactly as many numbers as before this wire and the existing seeded probes are untouched rather
  than merely close.
- **AFTER YOU / QUASH NO LONGER SPLICE THE ARRAY.** A splice is undone by the next re-sort, so WIRE 109
  would have gone silently dead under dynamic speed. They write the action's `order` — Showdown's own
  `3` for next and `201` for last against `200` for a plain move — which is the FIRST key the
  comparator reads and therefore survives every later re-sort.
- **"HAS IT ALREADY ACTED" IS NOW "HAS IT RESOLVED".** The flinch bookkeeping was an INDEX into a list
  frozen at the top of the turn, which stops meaning anything once the list re-sorts. It is a set of
  the actions still outstanding, which is the same question asked directly **and keeps the half the
  index was quietly also answering**: a body with no action this turn (dragged in by Roar) is not in
  the set either, so it cannot be handed a flinch that would leak into the next turn.

### board.js was edited, which this division normally may not do, and here is the evidence it owes

The deletion IS in board.js — there is nothing to delete anywhere else — so this pass touched a file
ENGINE does not own, under an explicit dispatch, and the obligation that comes with it is discharged
by measurement rather than by argument:

| question | instrument | answer |
|---|---|---|
| did the **board.js** edit move the feature function? | a direct A/B: the WIRE 118 hunk textually reverted and compiled in memory at board.js's own path, both arms hashed column-by-column over the fit's own corpus | **IDENTICAL** — all 58 columns, **1,136,845 candidate vectors over 6,055 clean games**, same row keys |
| can that instrument SEE a difference? | positive control: the reverted arm's rule INVERTED | **MOVED — `movesFirst`, `deadNoLastMove`, `diesBeforeMoving`** |
| could the **medicham2** edit move it? | every module export wrapped with a counter over a 300-game feature walk | `battleTurn` — the only existing function this wire changed — is called **0 times** by the feature path. The only new call is `compareTurnOrder`, 37,084 times |

**`engine/feature_engine_contrast.js` CANNOT SEE A board.js CHANGE and its header says so**: it swaps
`medicham2-browser.js` and `tags.js` between bundles and holds board.js FIXED in every arm, which is
right for the question it asks and is not this question. Quoting it as if it covered the board edit
would be a null from an instrument that cannot see. It was run anyway, and it is **NOT IDENTICAL**:

```
MOVED — at least one feature column differs on identical rows. This is a REFIT, not a restamp.
  live vs 09acd3b404ef: 3 columns moved: deadNoLastMove, movesFirst, diesBeforeMoving
  live vs 032b4a2979dd: 3 columns moved: deadNoLastMove, movesFirst, diesBeforeMoving
  rows 1,136,845 over 6,055 games   (sample pinned, same_rows true)
```

**THE VERDICT IS REPORTED AS IT CAME OUT, AND IT IS ATTRIBUTED RATHER THAN EXPLAINED AWAY — measured,
in the same arrangement:**

| arm | `compareTurnOrder` on the injected engine | `dmgFailures.unavailable` over 20 games | mean `movesFirst` |
|---|---|---|---|
| live | `function` | **0** | 0.5212 |
| release `09acd3b404ef` injected under live board.js | `undefined` | **2,110** | 0.2302 |

The release arms run the **live** board.js against an engine that predates the exported rule, so
board.js's own loud unavailable branch fires and `movesFirst` keeps only its priority half.
`deadNoLastMove` and `diesBeforeMoving` are its two dependents, which is why exactly those three move —
the same three the board A/B's positive control moves. **On a like-for-like tree** (the same engine on
both sides, only the board line varied) **the feature function is IDENTICAL on all 1,136,845 rows.**

**IT IS STILL A REAL PROPERTY AND IT IS MEASURE'S CALL, NOT ENGINE'S.** From now on live board.js
requires a post-118 engine, so any arrangement that pairs it with a frozen pre-118 release degrades
`movesFirst` — loudly and counted, but it degrades. The alternative was to have board.js fall back on
the hand-rolled comparison, which is the duplicate this wire deletes, put back for the sake of a
cross-version convenience. **The dispatch's rule is followed: the verdict is not IDENTICAL, it is said
plainly, and no refit was started here.**

### What the re-sort costs

Two extra sorts per turn, measured rather than assumed: `sortTurnOrder` on a four-action list is
**1.96 µs** against the old inline comparator's **2.38 µs** — cheaper per sort, because the keys are
built once per ACTION instead of once per comparison — so the wire adds about **4 µs to a turn that
takes 800–1,100 µs**. The whole-turn benchmark cannot resolve that: five interleaved pairs against
HEAD's bytes ran 760–3,327 turns/sec inside a single arm, and the medians came out 1,141 (HEAD) vs
1,281 (WIRE 118), which is noise with a sign. Recorded that way rather than as a win.

### FILED, NOT FIXED — the fit corpus MOVED THREE TIMES IN ONE HOUR, and an artifact was written across the move

Not ENGINE's, and not caused by this wire, but it was found while measuring and a silent one is worse
than a loud one. `fit_policy.loadCorpus()` returned **9,361** clean open-sheet games at 19:48Z,
**6,055** at 19:52Z when this pass measured, and **8,957** at 20:35Z — with 3.47.0 recording 9,230
this morning. An earlier `data/feature-engine-contrast.json` was written straight across that: its
`live` and `09acd3b404ef` arms scored 9,361 games / 1,774,684 rows and its `032b4a2979dd` arm scored
**6,055 / 1,136,845**, so `same_rows` was false, all 58 columns "moved", and it published
`MOVED — this is a REFIT, not a restamp` off arms that had walked different corpora. *(The instrument
was fixed while this pass ran — it now pins the sample of game ids before any bundle starts and prints
the pin, and `provenance.js` has grown a CORPUS DRIFT check that names it. Both are somebody else's
work, landed in the same hour, and are recorded here because this pass's own numbers sit on top of
them.)* **This pass's board A/B is a photograph of the 6,055-game moment and says so: both arms walked
the same corpus and the row-key hash proves it, which is the guard doing its job rather than a claim
that the corpus held still. Why it moves at all is MEASURE's.**

## WIRE 117 — PSYCHIC TERRAIN REFUSED PRIORITY AGAINST BODIES THAT WERE NOT ON THE GROUND. 2026-08-05.

Census **208 → 210 live / 211 → 213 probed**; missing still 3, hollow still 0, `threw` 0, `unarmed`
**146 → 145**. Differential unchanged at **1/150** (the same pre-existing `chesnaught woodhammer ->
mimikyu` row). One new probe, `move setsTerrain — "Psychic Terrain refuses priority only against a
GROUNDED target"`, and it was **shown RED first** against a source-reverted engine.

**THE MATRIX FIGURE IN THE GENERATED BLOCK ABOVE PREDATES THIS WIRE and says so in its own stamp
(16:46).** `tests/test-interaction-matrix.js --full` publishes an artifact and was deliberately NOT
run: a second division was measuring against release `032b4a2979dd` while this landed, and an
instrument that publishes while the engine moves is the 7,100-game failure in a new costume. It is
owed on the next matrix pass, together with the staged `priorityMove` regeneration below.

Will: *"Psych terrain is sorta like queenly majesty"*. He is right, and being right is exactly what
hid the defect: both resolve through `priorityRefusedAbove`, and **the terrain branch sat OUTSIDE the
defender loop and never inspected a body at all.**

```js
for (const d of (defenders || [])) { …the ability bar… }
if (field && terrainId(field.terrain) === 'psychic') out = Math.min(out, 0);   // no `d` anywhere
```

So MEDICHAM refused **Fake Out (12,872 uses — one of the most-clicked moves in the format)**, Extreme
Speed, Sucker Punch, Aqua Jet, Ice Shard and Upper Hand into every Flying type, every Levitate body
and every Air Balloon on the field. The comment at the site said grounded-ness *"is not tracked in
this engine"*. **That stopped being true at WIRE 90 and the comment survived the change** — the same
shape as the partial trap's *"the switch-blocking half is NOT modelled"*, which was true when written
and is how a declared gap outlives the gap.

**AND IT IS THE CENSUS'S OWN BLIND SPOT AGAIN — a mechanic with a SCOPE.** The existing `setsTerrain`
probe stages the block against a **Garchomp**, which is Dragon/Ground, so it passes on the broken
engine and on the fixed one. Every instrument here asks whether a mechanic FIRES; this is the third
time in two days that the answer was *yes, and everywhere it should not*.

### The fact existed three times and none of them was the one that mattered

`isGrounded(mon)` is now one function and every site calls it — the hazard block (Spikes / Toxic
Spikes / Sticky Web), `preventsSwitch.onlyGrounded` in the switch branch, the Grassy Terrain heal,
and Psychic Terrain's priority bar. This is CLAUDE.md's **FACTS ARE GLOBAL** broken and repaired: the
three hand-written copies disagreed about Iron Ball and about Eelevate, and the Grassy Terrain copy
**counted its own known-wrong half in `MEDFAILS.terrainHealUngrounded`**. Somebody knew that one was
wrong. `fails.terrainHealUngrounded` is retired to zero and replaced by
`seen.terrainHealSkippedAirborne`, so the event is still countable (docs/ENGINE.md rule — a counter
does not merely vanish).

### Every clause checked against the FORMAT, not remembered

The rule is Showdown's own `Pokemon#isGrounded` (`sim/pokemon.ts:2153`), clause for clause:

| clause | asked of the format | decision |
|---|---|---|
| **Iron Ball** — grounds, and beats the Flying clause | `isNonstandard` **null** — LEGAL, 113 corpus uses | **WIRED** |
| **Flying type** | — | **WIRED** |
| **Levitate** | 2,540 uses | **WIRED** |
| **Eelevate** | Eelektross-Mega, 0 sheets (Lesson 3) | **WIRED** |
| **Air Balloon** | `isNonstandard` **'Past'** — BANNED, and absent from `data/tags.json`'s items entirely | kept as the RULE, **unreachable here**, stated rather than dropped |
| **Telekinesis** | `isNonstandard` **'Past'** — BANNED | **not wired**, and this HONOURS the declaration already at the hazard block instead of contradicting it |
| **Magnet Rise** | legal, **1** corpus use, a volatile this engine does not carry | **not wired**, declared |
| **Gravity** | legal, **79** uses, grounds EVERYTHING, and this engine has no pseudo-weather slot | **not wired**, declared — the largest live gap here |
| **Roost** | legal, **2,109** uses; grounds the user by deleting Flying for one turn | **not wired**, declared — no per-turn type override exists; the second-largest gap |
| **Smack Down** / **Ingrain** | legal, 10 uses / 0 uses, volatiles | **not wired** |

**THE ABILITY SET IS A NAME AND THAT IS THE STANDING DECLARATION HONOURED, NOT AN EXCEPTION TO IT.**
The tempting shape is `typeImmunity {type:'Ground'}` — and its membership was **printed before it was
trusted**: `eelevate`, `levitate` **and `eartheater`** (45 uses, Orthworm). Earth Eater is
Ground-immune and firmly on the floor. Consuming that tag by shape would have made Orthworm airborne,
and the over-match would have been invisible because the case looks identical to Levitate. Showdown
itself hard-names the pair inside `isGrounded`, so this mirrors the reference implementation.

### Every expected value came out of the official engine

Played at the pinned commit under `gen9championsvgc2026regmb` — Incineroar's Fake Out into a Psychic
Terrain the *opposing* Indeedee's Psychic Surge put up, both arms printed before a line of engine
changed:

```
Garchomp    Rough Skin              |-activate| move: Psychic Terrain          BLOCKED, 0 damage
Orthworm    Earth Eater             |-activate| move: Psychic Terrain          BLOCKED, 0 damage
Talonflame  Flame Body              |-hint| "doesn't affect airborne Pokémon"  LANDS  237 -> 216
Hydreigon   Levitate                |-hint| "doesn't affect airborne Pokémon"  LANDS  251 -> 233
Talonflame  Flame Body + Iron Ball  |-activate| move: Psychic Terrain          BLOCKED
Hydreigon   Levitate  + Iron Ball   |-activate| move: Psychic Terrain          BLOCKED
```

**THE REFERENCE HARNESS WAS WRONG BEFORE THE ENGINE WAS — LESSON 5, VERBATIM.** Its first version
gave both p2 bodies **Protect** as their only move, so all four arms read `damaged: false` and the
engine would have been declared correct. Its second gave Garchomp **Earthquake**, a spread move, and
`battle.choose` rejected the turn outright.

### The ally case was already handled at the boundary, and it was verified rather than assumed

Psychic Terrain does not block a priority move aimed at your own side (`target.isAlly(source)` in the
terrain's own `onTryHit`). All three medicham2 call sites pass the FOE array: `:1520` passes a single
bench foe, `:2384` is gated on `_pf.indexOf(a.target) >= 0`, and the attack branch aims at `actB`/
`actA`. Ally Switch and Follow Me are self-targeted and never reach the gate. board.js filters on
`f.side === foeSide`. **No change was needed and none was made.**

### The bar is per-SIDE for the abilities and per-TARGET for the terrain

Queenly Majesty and Armor Tail protect their partner, so folding them over every live defender is
right. Psychic Terrain asks about **the body being aimed at**, so `priorityRefusedAbove` gained an
optional third argument. Without it a grounded partner would refuse a Fake Out aimed at the
Talonflame standing next to it.

### FILED, NOT FIXED — `terrainScaled`'s grounded half, and the reason it is the TAG this time

The `terrainScaled` block in `dmgRange` carried the stale caveat *"grounded-ness, which this engine
does not track (the same caveat priorityRefusedAbove already carries)"*. That reason is dead. The
**live** blocker is real and is in the artifact: the tag's two members disagree about whose feet
matter — Expanding Force tests `source.isGrounded()`, Rising Voltage tests `target.isGrounded()` —
and `terrainScaled` carries `{terrain, mult}` with no subject. Wiring a grounded test here would be a
coin flip that is wrong for one of the two. It needs a `grounded: 'user'|'target'` enrichment,
derivable from the handler text exactly as WIRE 83 derived its conditions. 296 corpus uses between
them. **The comment is corrected in place rather than left pointing at a fixed problem.**

### FILED, NOT FIXED — board.js and position_features.js hand over PARTIAL bodies

Both map their priority defenders to `{ability, fainted}` — no `types`, no `item`. The Levitate
clause reaches them; the Flying and Iron Ball clauses cannot, so a Flying-type foe is **still
over-refused in the FEATURE vector**. That is a feature-semantics change on files ENGINE may not
touch (a `board.js` signature change is a refit, which MEASURE owns), so it is declared and **LOUD**:
`fails.groundedBodyIncomplete` counts every such call and names the first offender.

### The tag_dex half is STAGED, and it is why the matrix has never seen this

`data/tags.json`'s `priorityMove` linkage carries three reactors — armortail, queenlymajesty,
dazzling — and **`reactorMoves` is EMPTY**, so the interaction matrix has never staged a single
Psychic-Terrain-against-priority case. The derivation tested `move.priority > 0`; Showdown writes the
same predicate the other way far more often (`if (move.priority <= 0.1) return;`) and reaches it
through `effect.priority` and `baseMove.priority` too, because a terrain's condition is handed an
*effect*. Broadened in `engine/tag_dex.js`, **from the handler's shape and not by naming a terrain**,
so a terrain added next regulation arrives without an edit. Membership printed against the format dex
before staging:

```
was   ability armortail, dazzling, queenlymajesty
is    ability armortail, dazzling, queenlymajesty     (unchanged — no ability moves)
      move    psychicterrain    the terrain's onTryHit, `effect.priority <= 0.1`
      move    quickguard        blocks priority for the side, and was simply absent
      move    upperhand         fails unless the TARGET is about to use a priority move
```

The two idioms are enumerated rather than a loose `[<>]=?` because a loose one also matches
`priority < 0`, which is a NEGATIVE-priority reactor and a different key. **`data/tags.json` is
untouched:** it is a frozen-release source and an input to the feature vector, so regenerating it is
the coordinator's single-writer moment, not ENGINE's to take while a measurement is running.

### How the probe was proved RED

`tests/probe_red_demo.js` gained a **second kind of known-bad engine**. Its existing `demo()` mutates
the ARTIFACT, which is the right input for a wire whose defect was "nothing consumed this tag" — and
it cannot express a defect that lives in the CODE with no tag to strip. `demoSource()` loads the
engine source into a fresh module, textually reverts the WIRE's sites to exactly what they said
before, and **asserts every reversal applied**; a patch that silently failed to match would make a
broken engine look fixed. Both WIRE 117 rows flip (shipped `true`, reverted `false`); 28
demonstrations, 0 failed. The first attempt threw because the engine file is CRLF and the patterns
are LF — **the guard firing, which is what it is for.**

## THE FROZEN RELEASE LOST A RECORD, AND "RE-CUTTING IS A NO-OP" IS WHY. 2026-08-05.

ENGINE rewrites the simulator while SEARCH measures, and the only reason that is safe is that a
measurement reads a frozen release rather than the live tree. That mechanism had a hole in the half
nobody freezes: **the record**.

**THE RECEIPT.** `engine/engine_release.js cut` ran twice over an unchanged tree — 02:12:57Z by
SEARCH (*"h60 log leg of the R1 explore-sweep re-run — cut immediately before the run because ENGINE
lands roughly every half hour"*) and 02:26:04Z by the router (*"R10/click-censoring parallel
session"*). Both produced id `09acd3b404ef`, because the id is the digest **of the file digests** and
an identical tree must yield an identical id. Exactly **2 lines** of `release.json` changed and
**zero of the 23 digests**, so no measurement is corrupted — and the first cut's time and reason were
**destroyed**. Every artifact SEARCH had already stamped `09acd3b404ef` then pointed at a record
claiming a freeze **thirteen minutes after the run that read it**, for an unrelated purpose. That is
the *artifact newer than an input it never read* shape this repo has already lost 7,100 games to.

**The docs called a second cut "a no-op". True of the frozen BYTES, false of the RECORD** — and that
sentence is exactly what made the overwrite look intended.

**THE FIX IS A CUT LOG, NOT A GUARD.** A cut appends one line to `cuts.jsonl` beside the snapshot;
`release.json`'s `cuts[]` is a rendering of that log, and `cut`/`why` at the top now mean the **FIRST
freeze of these bytes** and are never rewritten. Under any other reading an artifact can end up older
than the release it names. An append cannot lose an earlier line, which a read-modify-write of a JSON
array can under two concurrent cuts — and two agents cutting at once is not hypothetical here, it is
what happened. A second cut still succeeds and still returns the same id, so no workflow is blocked.

| requirement | how it is met |
|---|---|
| determinism unchanged | id is still the digest of the digests; the test asserts both cuts return `09acd3b404ef` and that not one of the 23 digests moved |
| the first cut is never lost | `cut`/`why` = event 0; later cuts append |
| a re-cut is still ergonomic | it succeeds, prints `THIS TREE WAS ALREADY FROZEN — this is cut N`, and lists every event |
| `stamp()` still answers "which bytes" | `engine_release` + the full `source_digests` set, unchanged; `engine_release_cut` is now the first freeze, so it is always ≤ the artifact's own time; new `engine_release_cuts` tells a reader to go and read `cuts[]` |

**THREE MORE OVERWRITE HAZARDS WERE IN THE SAME FILE, and one of them was worse because it wrote
NOTHING.** The snapshot copy loop was wrapped in `if (!fs.existsSync(dir))`, so a release whose
snapshot was incomplete (an interrupted cut) or had rotted on disk stayed broken through every later
cut **while the cut reported success**. It is now per file against the digest the manifest will
claim, and a repair is shouted and recorded in the cut event, because a silent repair hides that a
snapshot rotted. The **pointer** `data/engine-release.json` is the one file that is *supposed* to be
overwritten — that is what a pointer does — but it was copying the latest cut's time, so it made the
same false claim; it now mirrors the first freeze and carries `latest_cut`/`latest_why` beside it.
And `release.json` and the pointer are now written **atomically** (temp + rename), so a measurement
opening a release mid-write cannot read a truncated document.

**PROVEN BY REPRODUCING THE NIGHT.** `tests/test-engine-release.js` cuts, records the metadata,
stamps an artifact, cuts again over the unchanged tree, and asserts the first record survived — and
it was **shown red first**: 8 failures on the metadata arm plus 2 on the snapshot-repair arm before
the fix, 44 passed / 0 failed after. The mutation arms are asserted to have run (`the second cut
genuinely ran`, and the rot arm asserts `verify()` FAILS before the repairing cut, so the bad input
is real). It cuts into a **throwaway store** passed as `{store}` — a test that cut into the real one
would repoint the live pointer while another division measures, which is this mechanism's own failure
mode arriving through its test.

**The lost record was restored afterwards, as a separate labelled step and through the mechanism**:
both events written into `cuts.jsonl`, each marked `reconstructed` with its provenance in the record
(the first also `restored: true`, sub-second precision unrecoverable), then re-rendered with
`engine_release.js rerender`. Digests untouched, `verify()` intact, 23 files.

**FILED, NOT FIXED — not ENGINE's file.** `engine/miltank.js:145` reads the pointer for
`rel.digests` and `rel.release`, which **`engine_release.js` has never written** (it writes
`current`/`cut`/`why`). So `resolveRelease` compares **zero** files, finds zero moved, and stamps
`release: 'UNNAMED', release_status: 'ON_RELEASE'` — a green attribution derived from an empty
comparison. Two pointer schemas exist (the other is the hand-rolled recipe in `docs/SEARCH.md:825`).
SEARCH owns both.

## THE SCOPE PASS — WIRES 114–116. **THE CENSUS NEVER ASKED WHETHER A MECHANIC FIRES ONLY WHERE IT SHOULD.** 2026-08-05.

Census **202 → 208 live / 205 → 211 probed**; missing still 3, hollow still 0, `unarmed` still 146 (all
six new probes are armed), `threw` 0. Matrix **899/899 at `--full`**, denominator unshrunk. *(3.43.0
supersedes that figure: the denominator was itself unchecked. See "THE SIZE, AND THE COVERAGE,
HONESTLY" below — 1,027/1,031 once the generator's arithmetic was closed.)*
Differential **1/150**, the same pre-existing `chesnaught woodhammer -> mimikyu` row.

Three defects, one shape, and the shape is the finding. **Every instrument this division owns asks
whether a mechanic FIRES. None of them asks whether it fires ONLY WHERE IT SHOULD** — and two of
these three would have passed a "does it fire" probe on the day they were broken:

| | the mechanic FIRED | and it was still wrong |
|---|---|---|
| Shield Dust | blocked Nuzzle's paralysis, correctly | and blocked Will-O-Wisp, Thunder Wave, Spore, Toxic and Static, none of which it touches |
| the partial trap | chipped every turn, expired on time, died with its trapper (WIRE 105) | and stopped **nothing** — the switch-blocking half is most of what those seven moves are |
| Purifying Salt | its Ghost-damage half worked all along, off `halvesTypeDamage` | and its status half did not exist, so "is Purifying Salt live" had a true answer and a false one at once |

**EVERY EXPECTED OUTCOME CAME OUT OF THE OFFICIAL ENGINE, NOT OUT OF ANYBODY'S MEMORY.** Each case
was played at the pinned commit under `gen9championsvgc2026regmb` with both arms printed before a
line of engine changed. That is what caught the fourth item below, which contradicts the dispatch.

### WIRE 114 — Purifying Salt refuses every status. `statusImmune`, `probe: 'Purifying Salt refuses every major status, and Sturdy takes them all'`

`STATUS_IMMUNE_ABIL` had six per-status lists and Purifying Salt was in **none** of them, so
**Garganacl — legal, 51 declared sheets — took Will-O-Wisp, Thunder Wave, Spore and Toxic like any
other Rock type.** Official engine, both arms: into Purifying Salt all four leave it clean, into a
Sturdy control the same four bodies burn / paralyse / sleep / badly-poison.

It is wired as **one ANY-status list**, not a seventh entry in six places, because the handler is a
single unconditional `return false` and a seventh status added tomorrow would otherwise need six
edits and get five. **It is a NAME and that is the standing declaration honoured, not an exception to
it**: the artifact's `statusImmune` is a bare `{immune:true}` on all twelve carriers, so consuming it
by shape would make Leaf Guard (sun only) and Pastel Veil (poison only) block everything always —
which is exactly what the Layer 0 triage said, and why the hand table is richer than the artifact.

**COMATOSE IS DECLARED DEAD AND KEPT.** It sat in five of the six lists with nothing saying it cannot
fire: its only carrier is **Komala**, `isNonstandard: 'Past'` in this format, verified against the
format rather than remembered. It belongs in the ANY list on the same handler shape and is labelled
unreachable in place. A table carrying an unreachable entry invites trust in the rest of it.

**AND THE DROWSE ASKED A DIFFERENT QUESTION FROM THE SLEEP.** The Yawn branch tested `!t.status`,
which is one clause of `canTakeStatus`, so an Insomnia or Purifying Salt body took the counter and
then failed to fall asleep two turns later. Showdown's yawn condition refuses on
`!target.runStatusImmunity('slp')`. One function now answers "can this body be slept" for both routes.

**THE OTHER HALF IS PINNED, NOT FIXED, AND SAYS SO.** Purifying Salt also halves Ghost damage, and
that was already LIVE off `halvesTypeDamage`. It gains a probe anyway — the weather-rock lesson: a
mechanic with two halves needs a probe per half, or the halves drift and one passing number covers
both. The red demo asserts this one stays **GREEN** on the reverted engine, declared as a PIN.

### WIRE 115 — Shield Dust, at the one scope where it is correct. `probe: 'Shield Dust blocks a move SECONDARY and does not block a status MOVE'` (+2 more)

`canTakeStatus` opened with a blanket `if(ab==='shielddust') return false`. That function is the gate
**every** status in this engine passes, and both its callers are places Shield Dust does not reach:
the direct status-move path, and the punish-ability loop (Static, Flame Body). Covert Cloak is banned
in this format, so Shield Dust is the live carrier of the whole family.

The line was **not** deleted. It moved to the secondary loop in the attack branch and grew the two
special cases the real engine has, because **deleting it would have lost a rule the blanket check was
accidentally getting right**:

| route | official engine | before | after |
|---|---|---|---|
| direct status move (Wisp / T-Wave / Spore / Toxic) | **lands** | refused | lands |
| a move's secondary status, drop or flinch | blocked | blocked | blocked, at the secondary loop, counted in `MEDSEEN.dustBlockedSecondary` |
| Static / Flame Body punishing a Shield Dust ATTACKER | **paralyses / burns** | refused | lands |
| **Poison Touch** into a Shield Dust body | **blocked** — 0/40 seeds vs 12/40 into a control | blocked (by accident) | blocked, named at the effect, with Showdown's own comment quoted |
| a secondary that boosts the **USER** (Trailblaze, Aqua Step, Flame Charge…) | **kept** — spe+1 | **zeroed** | kept |

**THE DISPATCH'S DIAGNOSIS WAS WRONG ON ONE POINT AND IT IS RECORDED RATHER THAN QUIETLY CORRECTED.**
It said Shield Dust "does NOT block an ABILITY effect". True of Static and Flame Body; **false of
Poison Touch**, which Showdown special-cases in its own source — *"Despite not being a secondary,
Shield Dust / Covert Cloak block Poison Touch's effect"* — and the 40-seed sweep confirms behaviourally.
A straight deletion of the blanket line would have introduced a new bug while fixing an old one.

**AND A FIFTH ROW NOBODY ASKED ABOUT, found by reading the handler rather than the summary.** Shield
Dust is `secondaries.filter(effect => !!effect.self)` — it **keeps** the self ones — while Sheer Force
sets `move.secondaries = null` and removes them all. This engine had merged the two into one boolean,
so a Trailblaze into a Shield Dust body left the attacker at Speed 0 where the official engine leaves
it at +1. The two suppressions are now separate; `suppressed` survives only for King's Rock and the
procedural-status set, where both abilities really do stop the same thing.

**A RED TEST THAT PINNED THE DEFECT.** `tests/test-rollout-effects.js` asserted
`canTakeStatus(shielddust,'brn') === false` and went red on the fix. The assertion was wrong, not the
engine — the same event as the Simple/Intimidate row on 2026-08-05 — so it was **re-pinned against the
official engine with the receipt in place**, and four Purifying Salt rows were added beside it.
43 passed / 0 failed.

### WIRE 116 — the partial trap holds the switch. `partialTrap`, `probe: 'a partial trap holds a voluntary switch, and Ghost / Shed Shell / a pivot get out'`

`_trap` was initialised, set, chipped, expired and taught to die with its trapper — and **appeared in
no switch decision anywhere**, so Fire Spin, Wrap, Infestation, Whirlpool, Sand Tomb, Thunder Cage and
Magma Storm dealt their chip and let the victim walk out. The comment at the site that SETS the trap
said *"the switch-blocking half is NOT modelled"*, which is how a declared gap survives: it was true,
so nobody re-read it.

The rule was taken off the official engine, four arms, all printed:

| arm | official engine |
|---|---|
| bare switch out of an Infestation | **REJECTED** — `Can't switch: The active Pokémon is trapped` |
| a **Ghost** type | leaves freely, and **keeps the volatile and the chip** (98/130 → 82/130 the following turn) — which is why the exemption is at the switch and not at the tick |
| a **Shed Shell** holder | leaves |
| a pivot **MOVE** (U-turn) | pivots — already expressed by the existing `!a.mv` gate |

Shed Shell is a **name** because `data/tags.json` has no `shedshell` entry at all — there is nothing
to read by shape. Stated where it is read, like Shield Dust.

**FILED, NOT FIXED: Shed Shell does not release a body from ABILITY trapping.** It should. The
ability branch was scoped out of this dispatch as correct-and-untouched, and the exposure is zero
today (Shadow Tag is Gengar-Mega; Magnet Pull and Arena Trap have no corpus presence). Declared at
the site.

**AND THE STALE COMMENT ON THAT SAME BLOCK IS GONE.** It claimed `onlyGrounded`/`onlyTypes` "are not
in the params yet" and that Arena Trap and Magnet Pull "over-trap". The staged tag_dex batch landed
those params, the code reads them, and the comment described a world that ended.

### How each probe was proved

`tests/test-mechanics.js` gained six probes, all **armed**. Every one was demonstrated RED against a
**known-bad engine**: the source is loaded through a require hook, the seven WIRE sites are reverted
in memory to exactly what they said before this pass, and **each reversal asserts it applied** —
a patch that silently failed to match would make a broken engine look fixed, which is this project's
signature failure arriving through the test meant to catch it. **6 of 6 behaved as declared:
5 RED, 1 GREEN because it is the declared PIN.** The reverted-engine readings are the receipts:

```
statusImmune           sturdy brn,par,slp,tox | salt brn,par,slp,tox     <- the immunity did nothing
shield dust / status   wisp/dust none  (post-fix: brn)
shield dust / ability  static plain par  dust none                       <- refused a punish ability
shield dust / self     trailblaze dust 0  plain 1                        <- deleted the attacker's own boost
partial trap           trapped:incineroar                                <- trapped, and it left anyway
```

**TWO PROBES WERE WRONG BEFORE THE ENGINE WAS, WHICH MAKES TWENTY-SIX.** The first Shield Dust
ability arm staged the attack with `tackle`, which is **not in `MC.moves`** — `playerAction` returned
`{kind:'pass'}`, so both arms read "nothing happened" and the defect looked like agreement. The second
replaced it with **Flare Blitz**, whose own 10% burn secondary fired on the forced low roll and was
read as the Poison Touch proc. The shipped probe uses **Drain Punch**: contact, and no secondary of
its own.

**AND SO WAS THE OFFICIAL-ENGINE HARNESS, THREE TIMES, IN THE SAME DIRECTION.** Every reactor was
given `['Protect']` as its only move and duly clicked it, so **every status read as blocked** and the
engine would have been declared correct. Then `pass` was rejected in a doubles slot that has a live
body. Then Fire Spin's 85% missed on the pinned seed and the trap arm read as "not trapped". Each of
those makes the reference say what the wrong answer wanted it to say.

## THE FOUR MISSING MECHANICS, EACH WITH ITS REASON. 2026-08-05, after the Layer 0 pass.

**A declared gap with a reason is a finished item; an undeclared one is not.** The census carries all
four; this is why each is still there. There were 8; Air Lock came off as WIRE 78, `conditionalPower`
and `needsUntrackedState` came off together as WIRE 83, and **`reordersTurn` came off as WIRE 109 —
its blocking claim was WRONG**: "nothing in the artifact tells Instruct apart from After You" was
false, because Instruct also carries `instructsTarget {extraAction:true}`, a declared fact the
consumer now excludes on. The previous probe was then found staged against a body that could not show
the effect (Weavile 187 outruns Whimsicott 177, so the hit always landed before After You resolved) —
Lesson 5, again. Marvel Scale stays MISSING in the shipped artifact but its "blocked on the
derivation" verdict is retired: `condStatMult` is written in `tag_dex` (membership printed: exactly
`marvelscale def 1.5`), the consumer is live in `dmgRange` (WIRE 112), and only the STAGED
regeneration separates it from LIVE.

| # | mechanic | by DECISION or by OMISSION | why |
|---|---|---|---|
| 1 | `needsTargetToAttack` — Avalanche doubles after being hit | **DECISION**, re-confirmed 2026-08-05 | The probe asks for a rule that does not exist. Avalanche doubles when the user was damaged BY THAT TARGET THIS TURN; `dmgRange` is handed no turn state and must not invent any. 13 corpus uses. The tag's other nine members include Sucker Punch (6,673), already fully modelled through `failsIfTargetNotAttacking`, so the tag is not inert — only this member is |
| 2 | `writesAccuracy` — No Guard | **OMISSION, blocked on a SIGNATURE**, costed rather than gestured at, re-confirmed current 2026-08-05 | `moveAccuracy(id, field)` takes neither body. 11 call sites across 4 files; two of them (`board.js`, `position_features.js`) are **not ENGINE's** and a signature change there is a feature-vector change, which is the refit edge MEASURE owns. The compatible shape is `moveAccuracy(id, field, att, def)` with both optional. **It is a deliberate pass, not a one-liner, and was explicitly excluded from the 2026-08-05 dispatch for running beside MEASURE's refit** |
| 3 | `accuracyMod` — Sand Veil | **OMISSION, same signature**, same pass as #2 | — |
| 4 | `untagged` — Marvel Scale raises Defense while statused | **OMISSION, regeneration STAGED** | 36 uses. The derivation (`condStatMult`, an `onModifyDef` gated on `pokemon.status`, multiplier read from the handler's own chainModify) and the consumer (WIRE 112 in `dmgRange`, Mold Breaker punches through) both exist; `tests/probe_red_demo.js` proves the pair by injecting the staged tag through `TAGS.__setDB`. Flips LIVE at the next tag_dex regeneration |

## THE GENERATED INTERACTION MATRIX — `tests/interaction_matrix.js` + `tests/test-interaction-matrix.js`

Will: *"Basically all the tags on moves and stuff should trigger all the flags on abilities and types
and etc and have it flow from there"*, *"we def need interactions thats the whole point and multi turn
things like tailwind and trick room"*, *"the interactions should be pretty formulaic now that we have
all the tags and such."* He is right that it is formulaic. The generator is the formula; the runner
plays every case in medicham2 and in the official pinned engine and **authors no expected outcome**.

**THE SIZE, AND THE COVERAGE, HONESTLY.**

| | |
|---|---|
| theoretical cross product, no filter at all | **8,795** — flag 8,159, type 480, field 156 |
| emitted at `--full` | **2,300** — flag 1,831, type 313, field 156 |
| by layer | secondary 883, legality 379, damage 323, immunity 83, targeting 7 |
| **LIVE** (the reference engine's two arms differ, so the mechanic can fire) | **1,634** |
| INERT (the reference engine behaves identically with and without the reactor) | 530 |
| SATURATED (the control arm KO'd, so a damage ratio is clamped) | 109 |
| KO-TIMING (a damage-magnitude question — `test-engine-diff.js` owns it) | 25 |
| THREW (both are the harness — Curse takes no target and `battle.choose` rejects the turn) | 2 |
| **medicham2 agrees with the official engine on** | **1,027 of 1,031 — 99.6%** (3.43.0). The four are UNWIRED knobs, not wrong arithmetic — MEDICHAM's own two arms are identical on each: `fakeout`, `throatchop`, `psychicnoise` → **Shield Dust**, and `upperhand` → **Steadfast** |

### THE 902 PAIRS THAT "HAVE A PROBABILITY" — TWO FAULTS WEARING ONE REASON STRING. 2026-08-05.

Will: *"We cant just toss inaccurate moves can we?"*, then *"Flare blitz is 100 accurate man same with
iron head."* Both right, and the second is the sharper one: **`carrier-is-a-die` was a single reason
covering two faults with nothing in common**, and reading it back out loud got Flare Blitz — a
100%-accurate move — described as inaccurate.

| | pairs dropped | what it actually was |
|---|---|---|
| **A. the move CAN MISS** | 647 over seven accuracy tiers | Play Rough, Rock Slide, Megahorn, Power Whip, Triple Axel, High Horsepower |
| **B. the move ALWAYS CONNECTS and carries a chance side effect** | 255 | Flare Blitz's 10% burn, Iron Head's 30% flinch, Ice Punch, Dire Claw — **noise**, not the subject, when the case is Rough Skin against Flare Blitz |

Between them they are the most-clicked physical moves in Reg M-B, so the contact reactors (Rough
Skin, Spiky Shield, Beak Blast, King's Shield, Weak Armor, Toxic Debris, Mummy) were being tested
only with the contact moves nobody clicks.

**THE DICE WERE COUNTED BEFORE THEY WERE FORCED**, which is why the remedy is a filter and a pin
rather than a forcing. Every draw both engines took was tallied, in both arms, for all 717 of the 902
that reach the carrier loop. The result kills the premise: **the pinned die is not a STREAM.**
`pinDice` replaces `prng.random` with a pure function of its arguments, so a differing draw COUNT
between the two arms cannot shift a later draw — position does not enter. There was no stream hazard.

**WHAT THERE WAS INSTEAD WAS A MISALIGNMENT, AND THE DROP WAS HIDING IT.** `random` was pinned to the
MIDDLE of its range and `randomChance` to `num >= den` — a different die. `PRNG.randomChance(n, d)`
*is* `this.random(d) < n` (sim/prng.ts:115), and accuracy is checked as `randomChance(accuracy, 100)`
(sim/battle-actions.ts:738), so:

```
    old pin:   90 >= 100                 -> FALSE   every sub-100 move MISSED in the reference
    medicham2: rng()=0.5, 50 > 90 false  -> HIT     every sub-100 move CONNECTED in ours
```

Two pinned functions and nothing comparing them — and the filter that dropped all 647 such pairs is
what stopped anyone noticing. `tests/test-game-diff.js` now defines both pins as named constants and
**asserts at module load that they are the same die**, against the PRNG's own definition. That check
goes red on the old value at `(90,100)` and `(95,100)`.

**MEASURED, against frozen release `032b4a2979dd`, before a line of this was written:**

| | |
|---|---|
| bucket B staged with the roll left completely alone, OLD pin | 124 live, **123 agree (99.2%)** — the drop was precautionary and wrong |
| bucket A under the OLD pin | **377 of 501 INERT** (the reference simply missed) and **24 of the 95 live ones DISAGREED** for no reason but that miss |
| bucket A under the FIXED pin | 279 live, **268 agree (96.1%)** |
| the **1,675 cases already staged**, run under both pins, case by case | **NOT ONE verdict moved** — 1,027/1,031 either way |
| `playrough -> roughskin` | old pin **INERT** → fixed pin **live/agree**, at q=.25, .50 and .75 alike |
| `powerwhip -> beakblast` | old pin **live/DISAGREE** → fixed pin INERT. The old pin was manufacturing a disagreement |
| `ironhead -> roughskin` | **live/agree under all four conventions** — the flinch roll is noise, exactly as Will said |

**TWO DROPS SURVIVE, NAMED SEPARATELY, AND BOTH ARE ABOUT THE PINNED DIE RATHER THAN ABOUT LUCK:**

- `carrier-misses-the-pinned-median-die: accuracy N <= 50` — **44 pairs** (tiers 30 and 50). At
  exactly 50 the two engines split on a strict-versus-non-strict comparison of the same median
  (medicham2 misses on `50 > acc`, so it HITS at 50; the PRNG's `random(den) < num` MISSES); below
  50 they agree and both miss. Either way the carrier never lands. Refused here, named, rather than
  staged and reported as INERT — **an inert row caused by the harness reads exactly like a mechanic
  that cannot fire.**
- `carrier-reaches-this-key-only-through-a-roll` — **108 pairs**. Derived from the KEY, never from a
  list of names: `moveSecondary` membership *is* "the move has a secondary", and `volatile:flinch` is
  reached by Iron Head *only* through its 30%. If the flag is unconditional (contact, sound, punch,
  bite, physicalMove) the secondary is noise and the pair is staged. **Membership was printed before
  it was wired**, per LESSONS §4: 34 `moveSecondary` + 12 `volatile:flinch` + 1 `volatile:confusion`
  in bucket B and 53 more in bucket A, and **all 47 measured bucket-B members came back INERT, 47 of
  47** — which is what "cannot express itself" looks like from outside. It keeps the flinch class's
  real coverage gap visible (**Inner Focus and Steadfast have no 100%-flinch carrier to test them
  with**) instead of dissolving it into the INERT count.

**Will's collision rule was asked for and the measurement says the set is EMPTY, so it is not
shipped.** The proposal was to drop a bucket-B pair when the carrier's own secondary collides with
the reactor's effect. **No staged carrier has a secondary above 50%** — the maximum across all 216 is
exactly 50 — so at the pinned median not one of them fires, and a collision cannot occur. Shipping a
guard that can never fire is a silent default with extra steps. The rule that replaced it is the one
above, which is the same question asked from the other side: not *does the secondary collide* but
*is the secondary the only reason this pair exists*.

**WHAT IT COSTS AND WHAT IT BUYS**, at `--full`, dry-run against `032b4a2979dd` (the artifact is NOT
republished here — the other ENGINE agent was editing medicham2, and a full pass against a moving
engine is void):

| | before | after |
|---|---|---|
| staged | 1,675 | **2,272** |
| LIVE | 1,031 | **1,428** |
| agree | 1,027 (99.6%) | **1,412 (98.9%)** |
| disagreements | 4 | **16** — the same 4, plus **12 newly reachable** |

**Reconciliation still balances and `--selftest-reconcile` still passes.** Every pair that stopped
being dropped became a STAGED pair; none vanished.

**THE TWELVE NEW DISAGREEMENTS, all on carriers nobody could previously test**, filed here rather
than fixed (this pass owns the matrix, not the simulator):

| carrier | reactors | what parts |
|---|---|---|
| `stoneaxe` (62 uses) | roughskin, wanderingspirit, mummy, beakblast, toxicdebris, weakarmor — 6 rows | `.B.hazards.stealthrock medi=null sd=1` — **its 100% Stealth Rock secondary is absent**; only reachable because the move is 90% accurate |
| `scaleshot` (151) | toxicdebris, weakarmor | `.boosts.def medi=0 sd=-1`, `.boosts.spe medi=0 sd=+1` — WIRE 81 wired `secondaries[].self`; Scale Shot's boosts live in the move's own `self` |
| `gigaimpact` (34), `rockwrecker` (2) | spikyshield, bulletproof | `vol medi=["mustrecharge"] sd=[]` — a move BLOCKED or made immune still charged medicham2 with the recharge |
| `supercellslam` (81) | kingsshield | `.A.active[0].hurt medi=false sd=true` — **crash damage on a blocked move** |
| `bugbuzz` (55) | throatchop | `.B.hurt medi=true sd=false` — a sound move silenced on the same turn. **The one row whose verdict was NOT stable across quantiles** (it agrees at q=.25), so it is filed as *possibly the harness* and needs its own look |

**Static and Flame Body are still out, and that is a different bucket.** They fall under
`reactor-is-a-die` (their own effect is a percentage), which this pass did not touch and did not
double-count.

**THE FIVE OUTCOME ROWS SUM TO `emitted`, AND THEY DID NOT BEFORE 3.42.0.** `saturated` did not
exclude a case that had THROWN and `ko_timing` excluded nothing at all, so four cases sat in two rows
each and the column summed to 1,679 against 1,675 run. `tests/test-interaction-matrix.js` now
classifies once, in a stated precedence, and throws if the five do not partition the run.

**THE GENERATOR ASSERTS ITS OWN ARITHMETIC.** `theoretical = staged + dropped`, checked per axis and,
on the flag axis, per `(key, reactor)` — where N is known exactly, so the throw names the reactor
instead of reporting a gap somewhere in 8,000 pairs. Three faults on its first run: the denominator
read `tags.linkage` while the generator staged against `LINKAGE` (= the artifact's keys MERGED with
this file's supplementary ones), understating it by 170; the type axis incremented its carrier index
*before* testing the depth cap, so each of 32 firings lost the very carrier it broke on; and the
outcome rows above. `node tests/interaction_matrix.js --selftest-reconcile` mis-costs one drop by one
pair and requires the identity to stop the run — because the header claimed the assertion fired while
`reconcile()` was defined and never called.

**EVERY DROP IS NAMED AND COUNTED AND PRINTED ON EVERY RUN.** A silent cap reads as "covered
everything", which is this project's signature failure. The largest buckets are `carrier-does-not-aim-
at-a-foe` (400 — self- and side-targeting moves), `no-control-carrier` (192), `no-user` (158+47),
`reactor-not-in-format` (Iron Barbs, Tangling Hair, Lingering Aroma and Perish Body have **zero**
species in Champions), `holder-immune-by-chart`, and `layer-unclassified`.

*(`carrier-is-a-die` was the second-largest at 662 and **no longer exists**. It named two unrelated
faults at once and 750 of its 902 pairs were being dropped for a hazard that was not there; what
replaced it is `carrier-misses-the-pinned-median-die` (44) and
`carrier-reaches-this-key-only-through-a-roll` (108). See the section above for the measurement.)*

**FOUR THINGS A GENERATED CASE MUST KNOW, and the previous sampled version (82 pairs) got each wrong.**

1. **WHICH SIDE THE REACTOR STANDS ON.** `linkage.contact.abilities` holds Rough Skin AND Tough Claws.
   The sampled matrix staged every reactor on the DEFENDER, so Tough Claws, Long Reach, Unseen Fist,
   Iron Fist, Sharpness, Strong Jaw, Punk Rock and Poison Touch were all cases in which the mechanic
   could not fire — **and every one of them read as agreement.** The side is derived from the reactor's
   own tags and a reactor whose tags do not decide it is dropped as `side-unknown`.
2. **WHICH RESOLUTION LAYER IT TESTS**, from docs/TAGS.md's own table. The layer decides the
   EVALUATOR, and that is not bookkeeping: the state comparator is blind to the DAMAGE layer by
   construction, so a `halvesTypeDamage` case handed to it comes back INERT forever and looks covered.
3. **WHETHER THE PAIR CAN ACTUALLY MEET**, answered by the REFERENCE engine rather than by us. Every
   case is played **four** times — with the reactor and without it, in each engine. If Showdown's two
   arms are identical the case is INERT and is never counted as agreement. *Identical results across a
   varied knob mean the knob is unwired* — applied to the HARNESS as well as to the engine.
4. **WHAT WAS DROPPED.** See above.

**THE MULTI-TURN HALF IS GENERATED TOO, and the answer to "can the matrix drive it" is YES for the
FIELD.** A pair cannot reach a sequence, but the persistent field effects cross-product **with each
other**: `setsWeather`, `setsTerrain`, `reversesSpeed` (Trick Room), `doublesSideSpeed` (Tailwind) and
`halvesDamage` (the screens) are all derived from tags that mean *"this outlives the turn it was
clicked on"*. Each of the 156 ordered pairs becomes an **eight-turn script** — A lands on turn 1, B on
turn 3, everything idles to expiry — and every counter is compared at every turn. That is literally
*"Trick Room was up and then a Tailwind landed"*, generated rather than typed. **156 of 156 now agree**;
it was 30 of 156 when it was first run.

**FOUR THINGS THE HARNESS GOT WRONG BEFORE THE ENGINE DID, and each is written into the code:**
- **Protect has EIGHT PP.** A nine-turn field script ran every idle body out and made it STRUGGLE on
  turn 9 — three bodies suddenly damaged in 126 of 156 cases, an 80% "divergence" rate that was
  entirely the harness. Eight turns still covers every expiry in the set.
- **Sturdy on the bulkiest Fighting-weak body.** `closecombat -> chopleberry` read a damage ratio of 56.7%
  against a true 50% because the control arm's overkill was stopped at 1 HP by **Bastiodon's slot-0
  ability**, so the "full damage" the ratio divided by was not the full damage. Every body that is not
  the one under test now gets an inert control ability and no item — `bare()` applied to a generator.
- **A body that faints is REPLACED at full HP**, so a lethal hit reads as a loss of ZERO. Strong Jaw's
  x1.5 came back as a ratio of 0.000, which looks exactly like a boost wired backwards.
- **`stripIdentity` deleted its own evidence.** Blanking `ability` on all four slots for the inertness
  test removed the ONLY witness Mummy and Wandering Spirit have. Only the body under test is stripped.

**WHAT IT FOUND — ten wires, and not one was reachable from a single-mechanic probe.**

| # | found as | the bug | wire |
|---|---|---|---|
| 1 | 24 of 156 field cases at once | **Grassy Terrain never set a terrain.** It carries `perTurnHP` for the terrain's own heal and that branch sits above the terrain branch in `playerAction`, so the one terrain move that also heals was the one the engine could not set — and the other three worked, which is why nothing noticed | **72** |
| 2 | the residue of #1 | **Grassy Terrain's 1/16 heal**, derived from the terrain move's own tag | **73** |
| 3 | `sandstorm + grassyterrain`, the last pair standing | **the sandstorm chipped on the turn it expired** — five ticks where the official engine deals four. Visible ONLY as a pair, because the grassy heal is exactly the 1/16 the sand takes, so the two cancel and the extra tick is the only HP left on the table. **The counter was never wrong**, which is why nothing had caught it | **74** |
| 4 | `psychicnoise -> liquidvoice`, ratio medi **1.000** vs sd 0.375 | **`convertsMoveType.converts` names either a TYPE or a FLAG** and only the type half was read, so **Liquid Voice** (346 uses) was completely inert | **75** |
| 5 | `psychicnoise -> soundproof` | **`immuneToMoveClass` had one consumer per stage-3 mechanism instead of one per STAGE.** A Soundproof body took zero damage and still got two turns of Heal Block. docs/TAGS.md already says *"an immune target takes nothing — not the damage, and not the secondary"* | **76** |
| 6 | `roar -> throatchop` | **the Throat Chop silence was checked in the ATTACK branch and in `chooseAction`** — one class of action out of a dozen. Roar is a sound move that resolves down the `phaze` branch, so a silenced body phazed anyway | **77** |
| 7 | census row, not the matrix | **Air Lock / Cloud Nine.** See below — the "no artifact to wire from" verdict was wrong | **78** |
| 8 | `strengthsap -> suckerpunch`, medi's own arms identical | **`statChangeInCode` with `on:'target'` had a READER and no CLASSIFIER.** WIRE 67 put the reader inside the pivot branch because Parting Shot was the case it was written for, so **Strength Sap (637 uses)** resolved to `kind:'pass'` — a wasted turn | **79** |
| 9 | 12 cases at once | **Mummy and Wandering Spirit.** Both grounds for filing them retired — see below | **80** |
| 10 | 23 cases at once, at `--full` | **the secondary that boosts the USER.** The block read `status`, `targetBoosts` and the flinch and never `selfBoosts`, so Trailblaze, Aqua Step, Flame Charge, Rapid Spin, Torch Song, Aura Wheel and Psyshield Bash landed their damage and left the user's stages alone. **12 moves, 1,199 corpus uses** | **81** |

**DEPTH IS A KNOB AND THE DEFAULT IS NOT THE WHOLE MATRIX.** `--depth=N` takes the N most-clicked
carriers per (key, reactor); `--full` takes all of them and the drop ledger counts what a depth cap
excluded under `depth-cap`. Every number above is `--full`. **Depth matters**: three of the ten wires
above are invisible below depth 6, and WIRE 81 needed `--full`.

## What is left, and why each one is left

*(2026-08-05: the three bullets that used to live here all landed and their census probes carry them —
the variable-power family as WIRE 83 (`variablePowerAbsolute`, `speedRatioPower`, `hpScaledPower`),
Beak Blast as WIRE 82 (`preTurnShield`), and the drain/toll order as WIRE 87 (`drainThenPunishOrder`).
What is left after the Layer 0 pass:)*

- **`skillswap -> prankster`, the one remaining matrix disagreement.** Consumer wired (WIRE 110),
  `swapsAbilities` derivation written and membership-verified (exactly one move); blocked ONLY on the
  staged tag_dex regeneration, which may not run beside MEASURE's refit.
- **The staged regeneration batch** — see THE LAYER 0 PASS below for the full list.
- **The two Curse THREW rows** are the harness (`battle.choose` rejects a targeted Curse from a
  non-Ghost); named on every run, not the engine.

## THE LAYER 0 PASS — wires 90–112, 2026-08-05

Census **181 → 201 live / 186 → 205 probed**, nothing fell. Matrix **999/1,012 → 1,011/1,012** at
`--full`, denominator unshrunk. `data/tag-consumption.json` DEAD **61 → 40** (the ratchet fell, 21
tags moved to LIVE). Every new probe was demonstrated RED on a known-bad engine by
**`tests/probe_red_demo.js`** — the mechanism is `TAGS.__setDB` (built this pass as Layer 2's
injection point, with the derived-set rebuild hook the amendment requires): each probe's core
assertion runs against the shipped artifact (must hold) and against the artifact with the consumed
tag stripped (must fail), 26 demonstrations, 26 flips. One demo was wrong before the engine was —
it staged the Intimidate entry drop with `{seeded:true}`, the flag that exists precisely to SKIP
entry effects.

### The 13 matrix disagreements, dispositions

| rows | case | disposition |
|---|---|---|
| 2 | `flipturn/uturn -> toxicdebris` | **FIXED, WIRE 90.** Toxic Spikes and Sticky Web now resolve on entry. The declared blocker ("grounded-ness is not tracked") was a claim about a field nobody had derived — Flying is on `types`, Levitate on `ability`, Air Balloon on `item`. Poison-type absorb included; Sticky Web's drop rides applyStatDrop so Defiant retaliates. Spikes gained the same grounded test (a Levitate body walks over them) |
| 3 | `decorate -> goodasgold / suckerpunch / upperhand` | **FIXED, WIRE 106.** playerAction dropped the caller's TARGET for `boostsTarget` moves, so a foe-aimed Decorate boosted the ally. The foe path passes the standard status gates; Good as Gold refuses via the already-live `refusesStatusMoves` |
| 2 | `trick/switcheroo -> quickclaw` | **FIXED, WIRE 107.** `takesTargetItem {swaps:true}` executes the swap (Corrosive Gas's `removes` too). A `megaStone`-tagged item refuses to move — the artifact's own shape. Sticky Hold remains undescribed by any tag and is stated at the site |
| 2 | `trickortreat -> suckerpunch / upperhand` | **FIXED, WIRE 108.** `changesTargetType` was fully wirable with NO tag_dex change: the written type is the MOVE'S OWN TYPE for all four members (Trick-or-Treat/Ghost, Forest's Curse/Grass, Soak/Water, Magic Powder/Psychic) |
| 2 | `whirlwind -> suckerpunch / upperhand` | **FIXED, WIRE 102, and the fix is making the engine HONESTLY RANDOM.** Showdown's dragIn is `this.sample(possibleSwitches)`; medicham2 always took bench[0], a policy difference reading as a rule divergence under pinned dice. The drag now rolls the battle rng uniformly over the live bench — probed by varying the die and demanding the arrival move with it |
| 1 | `infestation -> beakblast` | **FIXED, WIRE 105.** Reproduced first: Beak Blast KO'd the trapper in BOTH engines and only medicham2 kept the partial trap chipping. `_trap` now records its trapper and dies with it (Showdown's own onUpdate rule). The probe controls on the trapper-alive arm still chipping |
| 1 | `skillswap -> prankster` | **STAGED, WIRE 110.** No usable tag existed. `swapsAbilities` derivation written in tag_dex — exact, not heuristic: Skill Swap's handler is the same `this.skillSwap()` call WIRE 80 reads off Wandering Spirit, and Worry Seed / Entrainment / Role Play / Simple Beam / Doodle use one-directional `setAbility` and are excluded. Membership printed: exactly one move. Consumer live; flips at regeneration |

### The 26 orphan ability/item tags, triaged

19 ability + 4 item + 3 mixed, per docs/TAG-COVERAGE.md §3. **(a)** = was covered by name, consumer
now reads the artifact by shape; **(b)** = genuinely missing, wired; **(c)** = redundant, survivor
named, tag_dex change staged; **(d)** = blocked or declared, reason stated.

| tag | uses | verdict |
|---|---|---|
| `megaStone` | 29,790 | **(a) WIRE 111.** "Is this a stone" was a `/ite[xy]?$/` name-shape regex in `megaAbility` and `buildMonFromSet`; both now ask the tag first (regex kept as OR-fallback because the X/Y forme SUFFIX genuinely lives in the item name). The stone-stats artifact stays MEGA_FORMES — richer than the tag and shared with the canonical engine |
| `damageBoost` | 12,085 | **(d) DECLARED.** 44 carriers whose conditions the params do not carry (Blaze `onlyWhen:"only below 1/3 HP"` is prose; Rivalry needs gender the engine lacks; Slow Start needs a turn clock). Guts stays name-wired; wiring the family's bare `mult` would fire Blaze at full HP. Needs a derivation pass of its own — the WIRE 83 shape, not started inside this dispatch |
| `onSwitchInDrop` | 10,415 | **(a) WIRE 100a + STAGED enrichment.** Membership from the tag (`applyEntryDrops`), amounts typed for Intimidate until the enrichment lands. The enrichment also caught the derivation OVER-MATCHING (Lesson §4): **Download carried it** — its onStart boosts ITSELF off the foes' defences. The enriched derivation reads the literal drop table and Download falls out. Supersweet Syrup's evasion drop skips honestly (no evasion slot) |
| `boostsWhenLowered` | 7,965 | **(a) WIRE 100 + STAGED enrichment, and the ARITHMETIC WAS WRONG.** Verified against the official handlers: the drop LANDS, then the +2 fires. Intimidate into Defiant is net **+1** (engine said +2); into Competitive it is **Atk −1 AND SpA +2** (engine skipped the drop). Probed. Enrichment emits the boost tables read from the handlers |
| `priorityMod` | 7,958 | **(a) WIRE 93.** Prankster's literal in the priority sort now reads the tag (`movesOfClass:'status'`) — and **Gale Wings had no consumer at all**: a TYPE-valued `movesOfClass` now shifts attacks of that type, the 'only at full HP' condition string is evaluated, any OTHER condition fails closed and is counted (`fails.priorityModUnknownCond`). The Prankster/Dark immunity stays in pranksterBlocked — it is Prankster-specific in the real engine too |
| `contactPunish` | 6,829 | **(c) REDUNDANT — survivor `punishesAttacker`.** Verified: every carrier also carries punishesAttacker, whose params are a strict superset and are what the consumer reads. Both tag_dex entries (item: banned Rocky Helmet; ability) retired, STAGED |
| `speedMult` | 6,141 | **(a) WIRE 91.** `effSpeed`'s `==='choicescarf'` literal now reads `speedMult.mult` |
| `stabBoost` | 4,468 | **(a) WIRE 95.** The `==='adaptability'?2:1.5` literal now reads `stabBoost.stab`; the 1.5 base stays typed as the game's constant |
| `speedCond` | 3,564 | **(a) WIRE 91, weather members; (d) the rest.** Swift Swim / Chlorophyll / Sand Rush / Slush Rush read `{inWeather, speedMult}` through weatherId. Quick Feet, Surge Surfer and Slow Start carry `inWeather: []` — their real conditions (status / terrain / turn clock) are not in the params, so they are REFUSED and counted (`fails.speedCondUnconditional`) rather than given an unconditional multiplier; enrichment staged |
| `blocksStatusMoves` | 2,539 | **(c) REDUNDANT AND WRONG — survivor `refusesStatusMoves`.** Good as Gold's refusal is already consumed at five sites; the orphan's derivation ALSO matched Telepathy (blocks ally spread damage, not status) and Wonder Guard (allows status) — the exact over-match pair refusesStatusMoves was tightened against. Derivation retired, STAGED |
| `accuracyMod` | 2,537 | **(d) BLOCKED** on the `moveAccuracy(id, field)` signature — confirmed excluded by the dispatch, wording in the missing table above re-confirmed current |
| `writesAccuracy` | 1,073 | **(d) BLOCKED**, same signature |
| `randomBoostEachTurn` | 515 | **(c)/(d) derivation over-matched, fix STAGED.** Matched any random onResidual, catching **Healer** (cures ally status) and **Harvest** (regrows a berry). Tightened to require the boost call: membership is exactly Moody. Moody's consumer deliberately not written — the tag's own text says it belongs in forecast variance, not in a feature |
| `statusImmune` | 430 | **(d) DECLARED.** `{immune:true}` names no status — wiring by shape would make Leaf Guard block everything always. The hand table (STATUS_IMMUNE_ABIL) is currently RICHER than the artifact; enrichment (which statuses, from onSetStatus) is future tag_dex work, noted, not staged in code this pass. **2026-08-05: the declaration held and the table was still INCOMPLETE — Purifying Salt was in none of its six lists. WIRE 114. The verdict was right about the artifact and said nothing about whether the richer table was correct, which is the gap that let a legal, played ability be missing entirely** |
| `invertsBoosts` | 193 | **(a) WIRE 100b.** Seven `==='contrary'` literals replaced by one `invSign()` reading the tag |
| `removesOwnSecondaries` | 161 | **(b) WIRE 97.** The suppression half was name-wired (`mAb==='sheerforce'`, now the tag); the **x1.3 was absent entirely** — a Sheer Force body lost its secondaries and got nothing, strictly worse than no ability. Damage half wired on moves that HAVE a secondary; Life Orb recoil skipped on boosted moves (the real interaction) |
| `addsFlinch` | 83 | **(b) WIRE 103.** King's Rock: 10% flinch on damaging moves without a flinch of their own (the handler's gate, reproduced), inside the same Shield Dust / Sheer Force suppression, same actedAt / Inner Focus bookkeeping |
| `fractionalPriority` | 78 | **(b) WIRE 101.** Quick Claw: rolled once per holder per turn BEFORE the sort (a comparator roll would re-draw), rng consumed only when the item carries the tag so seeded probes keep their stream |
| `critDamageUp` | 43 | **(b) WIRE 96.** Sniper x1.5 on the crit, at both crit sites (dmgRange's certain path, the battle loop's rolled path) |
| `ignoresStatStages` | 2,445 | **(b) ability half / (c) move half.** Unaware wired in dmgRange, both directions, Mold Breaker punches through. The MOVE half (Darkest Lariat, Sacred Sword) has been live all along under `ignoresBoosts` — a redundant second spelling; move-side derivation retired, STAGED |
| `preventsSwitch` | 0* | **(b) WIRE 92 + STAGED enrichment.** *Sheet count lies by Lesson 3: Shadow Tag is Gengar-Mega. A voluntary switch is refused while a live foe carries the tag; Ghost types and same-tag holders exempt (shape reads); `onlyTypes` (Magnet Pull/Steel) and `onlyGrounded` (Arena Trap) derived from the handlers, honoured when the regeneration lands — until then those two carriers, zero corpus presence, over-trap, stated at the site. **2026-08-05: the regeneration ran, the params are read, and the comment saying otherwise survived it and was corrected. This tag is the ABILITY half only; the MOVE half was absent entirely — WIRE 116** |
| `boostsOnKO` | 0* | **(b) WIRE 104.** Eelevate (Eelektross-Mega — Lesson 3 again) and Beast Boost: +1 to the killer's highest raw stat, from the tag's own params |
| `privateWeather` | 0* | **(b) WIRE 99.** Mega Sol (Meganium's mega): the holder's own damage formula reads a sun the field never reports, through `effWeatherOf` — precisely the consumer shape the tag's own text demands ("ask what weather THIS mon sees") |
| `hitsTwice` | 0* | **(b) WIRE 98.** Parental Bond (Kangaskhanite, 217 stone uses): x1.25 on single-target damaging moves, not on spread, not on multi-hit |
| `auraBoost` | 0 | **(d) DECLARED, 0 exposure.** Dark/Fairy Aura carriers (Yveltal/Xerneas) are not in the format; Floette-Mega's fairyaura is in MEGA_ABIL but has no corpus presence. Left DEAD; the ratchet permits it |
| `untagged` | 5,172 | **not one mechanic — the explicit placeholder bucket** (61 carriers). Its named member with a census row, Marvel Scale, is STAGED (WIRE 112/`condStatMult`); Shield Dust and Magic Guard remain name-checked/counted and say so in place |

### Staged tag_dex changes — the regeneration this dispatch may NOT run

All code landed in `engine/tag_dex.js`; `data/tags.json` untouched. Every membership was printed
against the format dex BEFORE staging (the scratch replication run, LESSONS §4):

1. **`swapsAbilities` NEW** — matches exactly `skillswap`
2. **`condStatMult` NEW** — matches exactly `marvelscale {stat:'def', mult:1.5, when:'statused'}`; defensive stats only, on purpose (the offensive twin is Guts, already served)
3. **`contactPunish` retired** (both entries) — survivor `punishesAttacker`
4. **`blocksStatusMoves` retired** — survivor `refusesStatusMoves`
5. **move-side `ignoresStatStages` retired** — survivor `ignoresBoosts`
6. **`randomBoostEachTurn` tightened** — membership Moody alone (was + Healer, Harvest)
7. **`onSwitchInDrop` enriched and tightened** — `{boosts:{atk:-1}}` etc.; **Download falls out**
8. **`boostsWhenLowered` enriched** — `{boosts:{atk:2}}` / `{boosts:{spa:2}}`
9. **`preventsSwitch` enriched** — `onlyTypes:['Steel']` (Magnet Pull), `onlyGrounded` (Arena Trap)

After the regeneration runs (single-writer moment): the diff must be verified entry-by-entry
excluding `uses`, `skillswap -> prankster` should fall out of the matrix's parting list, the census's
Marvel Scale row flips LIVE, and `feature_fixture --check` decides whether a refit is owed.

**2026-08-05, later: items 1–9 RAN at the coordinator's single-writer moment and landed clean**
(census 202/205, matrix 899/899, DEAD 38, `feature_fixture --check` green on both vectors) — **and
the first consumer-day of `invertsBoosts` exposed a TENTH staged item, WIRE 113.** The derivation
`a.onChangeBoost ? {inverts:true}` had always over-tagged **Simple** (whose handler is
`boost[i] *= 2` — it DOUBLES) and **Ripen** (berry boosts only) beside Contrary; harmless while the
tag was DEAD, live the moment WIRE 100b read it by shape: Intimidate into Simple read **+1** against
the official engine's **−2** (verified by real battle at the pinned commit, all five reactor rows).
`tests/test-rollout-effects.js` caught it the same day — three of its four failures were the OLD
wrong retaliation model and were re-pinned to the official table; the Simple row was TRUE and was
not re-pinned, the engine was fixed. Staged now: `invertsBoosts` derives only from `*= -1` (membership:
exactly contrary), new **`amplifiesBoosts {mult:2}`** (exactly simple, Ripen excluded by its
`isBerry` gate). The consumer bridge (`_NOT_INVERTERS` in `invSign`, the `ab==='simple'` fallback in
`applyStatDrop`) makes the engine produce the official numbers with the artifact as shipped and goes
structurally dead when the regeneration lands.

**AN ELEVENTH STAGED ITEM, WIRE 117.** `priorityMove`'s linkage test broadened from `move.priority > 0`
to Showdown's two real idioms, adding **three reactor MOVES** (`psychicterrain`, `quickguard`,
`upperhand`) and changing the ability side not at all. Membership printed above. It is what lets the
interaction matrix stage a Psychic-Terrain-against-priority case for the first time; the engine fix
itself does not depend on it, and the census probe carries the mechanic today.

## Hand list — found by differential testing, not yet probed

**EMPTY except for Rivalry, and Rivalry has never been probeable.** Everything else that was on this
list has become a probe and the census now carries it. That is the list doing its job.

**AND IT HAS A SUCCESSOR THAT CANNOT GO STALE, 2026-08-06.** A hand list is prose, and prose cannot
track a corpus — the same reason `docs/HANDOFF-*.md` are history. The open-work list is now DERIVED:
`node tests/test-medicham-coverage.js` prints, every run, the tags carried by the 99%-of-usage set
that have **no probe at all** (17 today, led by `move|accuracyMod` at 5,986 uses and
`ability|auraBoost` at 5,620), the abilities and items the artifact derived **no mechanic** for (12),
and the usage-weighted coverage beside the count. Work the list below; then work that one, because it
re-derives itself when the metagame moves and this section does not.

**AND A SECOND DERIVED LIST LANDED 2026-08-06:** `data/game-differential.json`'s `classes` block. The
coverage list above says which mechanics have NO PROBE; that one says which mechanics have a probe and
still resolve differently from the authority IN A REAL GAME. **Eleven classes** over 346 games today
(2026-08-07, with the megas in and ROADMAP #81 WIREs 1-6 landed), each with its count and its distinct
causes, and each cause carrying `mentions` so a class can be sorted by the corpus usage it actually
reaches rather than by how many games happened to hit it. Regenerated by
`node engine/game_differential.js --write`. Neither list is typed and neither can go stale, which is
the whole reason the section below is nine lines long — and the count moving from nineteen to eleven
is the artifact doing exactly that, not a claim anybody typed twice.

- **Rivalry** — x1.25 into the same gender, x0.75 into the opposite, x1.0 if either is genderless.
  Wholly absent. Blocked on data, not on will: `MC.mons` carries no gender and `buildMon` returns
  none, and `data/engine-data.js` belongs to MEASURE. Its `damageBoost` tag carries a bare
  `mult:1.25` with no condition and 43 other members including Blaze 1.5 and Slow Start 0.5, so it
  cannot be wired from the artifact as it stands. The differential can no longer see it either:
  CONTROL FIX 6 sets `gender:'N'` on both sides, because `gender:''` made Showdown roll one off the
  battle seed and MEDICHAM has none — a seed-dependent x0.75 nothing could match.

## THE THIRD INSTRUMENT — `tests/test-game-diff.js`, built 2026-08-04

Will: *"yeah we def need interactions thats the whole point and multi turn things like tailwind and
trick room."* Neither existing instrument can reach that, and the reason is structural rather than an
omission:

| instrument | what it asks | what it structurally cannot see |
|---|---|---|
| `test-mechanics.js` | is ONE mechanic live | tag x tag. 176 tags individually verified says nothing about any pair |
| `test-engine-diff.js` | is this ONE HIT's damage right | every turn counter — Tailwind expiring, Trick Room toggling, a screen running out, an Encore ending |
| **`test-game-diff.js`** | **do the two engines hold the same STATE after every turn** | damage magnitude (that is the file above), and everything in its own `NOT_COMPARED` |

It plays a fixed action script in `medicham2-browser.js` and in the official pinned Showdown engine,
compares a dice-independent projection of the whole state after every turn, and reports the **first**
turn they part. Artifact: `data/game-diff.json`.

**TWO MODES, AND THE SPLIT IS THE POINT.** `--pairs` GENERATES its cases from the tag artifact — the
cross product of a linkage key's carrier moves against its reactor abilities — and never authors an
expected outcome, because the official engine supplies it. That is the half that makes it safe: every
one of the roughly twenty-three wrong probes this project has produced was a human writing down what
should happen. A cross product can never reach a SEQUENCE, though, so the scripted multi-turn games
are the other half. Neither substitutes for the other, and it is written in those words because the
next person will otherwise try to make one do both.

**IT DEPENDED ON PRIORITIES #44 AND THAT IS WHY #44 LANDED FIRST.** `reactorsTo('contact').moves`
returned 152 moves that CARRY contact — Fake Out, Close Combat, Flare Blitz. Those are attackers. The
moves that actually REACT — Spiky Shield, Baneful Bunker, King's Shield — were not in the index at
all. `tag_dex.js` now emits `carrierMoves` and `reactorMoves` separately, the reactor side derived by
the SAME handler probe the abilities and items use, and `moves` is GONE rather than aliased: an alias
keeps every existing misreading working silently.

**WHAT IT DOES NOT COMPARE is printed on every run** and is the honest half: HP amounts (the two
engines roll their own dice), accuracy misses, chance secondaries, crit, a reactor whose effect is a
roll, a KO the two engines time differently (a DAMAGE question, which belongs to `test-engine-diff`),
the `protect` volatile (both have it and clear it at different points in the turn), Showdown-only
volatiles, and PP. Stat VALUES are **aligned** rather than excluded, and that is a control that has to
hold: unaligned, the two engines disagree about SPEED ORDER and about who survives a hit, and both
read as rule divergences.

**THE INJECTED-DIVERGENCE PROOF RUNS FIRST AND THE FILE REFUSES TO REPORT WITHOUT IT.** One extra turn
of Tailwind is planted on turn 2 of a clean game; the comparator must catch it, at turn 2, on
`.field.tailwindA`. A silent zero is a broken comparator, not a clean engine.

### What it found, in order

| # | found by | divergence | verdict |
|---|---|---|---|
| 1 | scripted game 3 | `weatherTurns medi=4 sd=3` on turn 2 | **REAL.** A weather move clicked into its OWN weather REFRESHED the clock; Showdown fails it. **WIRE 64**, weather and terrain together |
| 2 | pair matrix | `closecombat -> anything`: `boosts.def medi=-1 sd=0`, six pairs at once | **REAL.** A move blocked by Protect still paid its self-drop. **WIRE 65** |
| 3 | pair matrix | `partingshot -> soundproof`: medi switched, Showdown did not | **REAL, two bugs.** A blocked Parting Shot still pivoted (WIRE 65), and `immuneToMoveClass` lived only in `dmgRange`, so a Soundproof body took a sound STATUS move (**WIRE 66**) |
| 4 | pair matrix | `partingshot -> stancechange`: `boosts.atk medi=0 sd=-1`, three pairs | **REAL.** Parting Shot's −1 Atk / −1 SpA was the documented unmodelled half, 7,184 corpus uses. **WIRE 67**, from a `statChangeInCode` derivation that now reads the literal boost object out of the handler |
| 5 | pair matrix | `fakeout -> toxicdebris`: `hazards.toxicspikes medi=null sd=1` | **REAL.** `punishesAttacker.hazard` had "nowhere to land" until WIRE 41 gave each side an `hz` bag. **WIRE 68** |
| 6 | pair matrix | `roar -> soundproof`: medi phazed a Soundproof body | **REAL.** Roar IS a sound move and WIRE 66 had not reached the phaze branch |
| 7 | pair matrix | `encore -> stancechange`: `vol medi=["encore"] sd=[]` | **REAL.** Encore against a target that has never moved has nothing to repeat. **WIRE 69** |
| 8 | pair matrix | `wavecrash -> mummy` / `-> wanderingspirit` | **REAL AND NOT FIXED.** Contact REWRITES the attacker's ability. Both carry only `contactPunish` and neither has a param for it; **0 corpus sheets between them.** Filed |

**FOUR OF THE TEN "DIVERGENCES" IT REPORTED FIRST WERE THE HARNESS**, and each was fixed rather than
excused: a bench index that meant different bodies in the two engines (trap 1 broken by the harness
itself), an ally target emitted as a positive slot so `battle.choose` silently REJECTED the turn and
froze the reference engine, a `benched` list that counted fainted bodies on one side only, and a
reactor staged with Protect as its only move so the interaction under test could not happen at all.
The last is Lesson 5 in a generator: **ask what the target would do if the mechanic did not exist.**

## WEATHER — THE WHOLE SURFACE, AUDITED AT ONCE. 2026-08-04.

Will: *"Weather is something that is the deciding factor in like every game so we need to get it
bulletproof."* It had been found broken four separate times in one day by four different routes, which
means it was being found by luck. Batch 8 of `tests/test-mechanics.js` probes every path at once, and
every probe in the batch declares its arms.

| path | probe | result |
|---|---|---|
| setting, by move | `setsWeather` | LIVE, unchanged |
| setting, by ability on entry | `weatherSetter` | LIVE, unchanged |
| setting, **by a MEGA's ability** | `megaWeatherSetter` **new** | **LIVE**: base Charizard (Blaze) sets CLEAR, Charizard-Mega-Y (Drought) sets sun |
| **duration and expiry** | `weatherDuration` **new** | **LIVE**: sun on turn 1, still sun after 3 idle turns (Flamethrower 74), CLEAR after 4 (49) |
| **the rocks** | `extendsDuration` **new arm** | **WAS MISSING — WIRE 70.** The tag has carried `toTurns: 8` all along and only the SCREEN branch read it; the weather branch wrote a literal 5, so Heat, Damp, Smooth and Icy Rock were inert on the one mechanic they exist for |
| **the rocks, on the other three routes** | `test-weather-duration.js` **new** | **WIRE 70 WAS ONE BRANCH OF FOUR — WIRE 71.** See below |
| offensive multipliers, **both directions** | `weatherDamageMult` **new** | **LIVE**: Flamethrower clear/sun/rain 56/84/27, Surf 75/37/112 |
| defensive multipliers | `weatherDefenceMult` **new** | **LIVE**: Shadow Ball into a Rock 31 to 21 in sand (into a Water 40 to 40), Earthquake into an Ice 157 to 106 in snow (into a Fire 246 to 246) |
| residual | `weatherChipImmune` | LIVE — sand 1/16, Rock/Ground/Steel and the tag's own immunities exempt, **snow chips nothing** |
| accuracy, **both directions** | `weatherAccuracy` **new** | **LIVE**: Thunder clear 70, rain 100, sun 50 |
| Weather Ball | `weatherBall` **new** | **LIVE**: into a Gengar, clear 0 (Normal is nothing to a Ghost), rain 144, sun 144, sand 96, snow 96 |
| Solar Beam | `chargeSkippedByWeather` | LIVE, unchanged |
| Aurora Veil | `failsWithoutWeather` | LIVE, unchanged |
| weather speed abilities | `speedCond` + `speedCondWrongWeather` **new** | **LIVE with the WRONG-SKY arm**: Swift Swim in rain 135 to 270, **in sun 135** |
| Solar Power | `solarPower` **new** | **LIVE**: in sun Flamethrower 84 to 126, Earthquake 37 to 37, no sun 56 to 56 |
| **Air Lock / Cloud Nine** | `weatherSuppression` | **LANDED — WIRE 78, and the "nothing to wire from" verdict was wrong.** See below |

**TWO PROBES IN THE BATCH WERE WRONG BEFORE THE ENGINE WAS, WHICH MAKES TWENTY-THREE.** The first
Weather Ball probe fired it at a **Garchomp**, which is Dragon/**Ground** — so the sand form (Rock) is
RESISTED, 100 BP at x0.5 is the same number as 50 BP at x1, and `sand 43 vs clear 44` read exactly
like a dead knob. The engine was right and the type chart was doing its job. The first
`megaWeatherSetter` control was a plain **Charizard**, and `buildMon` hands a Pokemon its USAGE item —
which is a Charizardite Y, so the "base forme" arm was already a mega and already set sun. That is the
original Choice Scarf mistake, verbatim, seven months later.

**THE VOCABULARY, GREPPED FOR SURVIVORS.** Three copies of the Showdown-name to engine-word map
remained. `engine/medicham2-browser.js:182` is the canonical one behind the exported `weatherId()`.
Two more sat inside `engine/tag_dex.js`'s `weatherScaled` and `weatherSetter` derivations, were
identical to each other and **not** to the display map twenty lines above them (`hail` was `hail` in
one and `snow` in the others). Both now read one `W2ENGINE`, and regenerating produced no change
beyond the session's intended 35 entries — which confirms the two were already agreeing and the
consolidation is a no-op today and a guarantee next month. `engine/board.js:1190` is the fourth and is
**NOT ENGINE's**: it is a refit trigger (14 of 58 feature columns move) and MEASURE has the patch
measured and deliberately reverted in `docs/MEASURE.md` section 11. Any further board.js weather
defect is filed there, not fixed here.

### WIRE 78 — AIR LOCK AND CLOUD NINE. "No artifact to wire from" was a claim about the DERIVATION.

The previous pass recorded this as MISSING-declared with *"`cloudnine` carries `untagged` and
`airlock` has no artifact entry at all, so there is nothing to wire from."* That was a true statement
about `data/tags.json` and a false one about the dex, and the difference is the whole lesson:

**Showdown does not express weather suppression through a HANDLER. It is a flat property on the
ability object — `suppressWeather: true`.** Every derivation in `tag_dex.js` probes a handler NAME
(`onStart`, `onImmunity`, `onModifySpe`, …), so a property-shaped fact was invisible to all of them,
and the gap read as *not derivable* when it was *not looked for*. `dex.abilities.all().filter(a =>
a.suppressWeather)` returns **exactly two**, `airlock` and `cloudnine`, and Delta Stream carries the
same property set to `false` and is correctly excluded by truthiness. The tags diff, excluding `uses`,
is exactly those two entries.

**IT IS NOT "CLEAR THE WEATHER".** The sky is still raining and the clock still runs; what stops is
every READ. So the suppression is a field flag recomputed at the top of every turn from whoever is
standing there, and it gates: the damage multipliers (via one shadow at the top of `dmgRange`, so
every weather read below it is covered without a gate per site), Weather Ball's type, the weather
accuracies, Solar Power and Orichalcum Pulse, the snow/sand defence bumps, the weather-speed
abilities, the sandstorm chip, the Solar Beam charge skip and Aurora Veil's legality. Clearing it
instead would let a second Drizzle re-set it and would make the Veil's failure look like the absence
of snow rather than its suppression.

**THE EXPOSURE WAS MEASURED BEFORE THE WIRE, because it decides how much machinery this deserves.**
**Air Lock is ZERO** — its only carrier is Rayquaza and Rayquaza is not in this format. Cloud Nine has
**two** carriers that are, **Altaria and Drampa**, and **18 declared sheets across 40,595 stored
games**. Small, derived anyway, because the cost was one derivation block and the alternative was a
census row asserting the engine cannot know.

**A pure `dmgRange` call still cannot see an Air Lock ALLY** — it is handed two bodies — and that is
stated in the code rather than silently equivalent. The battle loop is the only caller that can, and
it is the one that sets the flag.

### WIRE 71 — WIRE 70 FIXED ONE BRANCH OF FOUR, AND THE PROBE COULD NOT SEE THE OTHER THREE

Weather is set **four** ways in this format, and each had its own branch:

| # | route | site | read the rock? |
|---|---|---|---|
| 1 | an ability on switch-in — Drought 899 uses, Drizzle 3,075, Sand Stream 1,716, Snow Warning 1,561 | `medicham2-browser.js:1524` | **no — literal 5** |
| 2 | a MOVE — Sunny Day 588, Rain Dance 919, Sandstorm 10, Snowscape 11 | `:2149` | yes, since WIRE 70 |
| 3 | **MEGA evolution** — Charizard-Y arriving with the stone | `rollout_leaf.js:186` | **no — literal 5** |
| 4 | a punish ability — the Sand Spit class | `:2629` | **no — literal 5** |

So a Torkoal holding a Heat Rock set **five** turns of sun by switching in and **eight** by clicking
Sunny Day. Same held item, same sky, two answers, decided by how it arrived.

**The probe that found WIRE 70 was staged on route 2 and passed on route 2.** It was not a weak probe
— it was a correct probe pointed at one of four bodies that can show the effect, which is the same
shape as the mega bug that ran at 56% of sides against 85% and passed a non-zero check. A tag with
four consumers needs a probe per consumer, or an assertion over the consumers as a set.

This one is the second: `tests/test-weather-duration.js` asserts the **invariant** — for a given sky
and a given item, every route agrees — rather than four separate numbers. A fifth route added
tomorrow that hardcodes 5 fails without anyone remembering to extend a list of four. The duration rule
now lives once, in the exported `weatherTurns(weather, item)`, beside `weatherId`.

**The two vocabularies meet inside it**, and that is why it could not be a one-line read at each site:
`extendsDuration.extends` holds MOVE ids (`sunnyday`), because the rock's rulebook text names the
move, while `weatherSetter.weather` holds ENGINE words (`sun`). WIRE 70's inline version compared the
raw `extends` entry against `a.mv` — correct on the move branch by luck of spelling and silently
never matching on the other three. Both sides now go through `weatherId`, so neither spelling is
authoritative.

**It is a small mechanic that decides whole games.** 14 of 496 declared setters in the store carry the
matching rock — Damp Rock on a Drizzle body is the common one at 6.2%, Heat Rock 2.2%, and neither
Smooth nor Icy Rock appears at all. Three extra turns of rain is most of a game, and the population is
small enough that no aggregate would ever have shown it.

**A one-character bug caught in review, recorded because it is the shape that survives.** The first
cut of the punish branch read `m.item` — but `tg` is the **holder** of the punish ability and `m` is
the attacker who set it off, so Sand Spit would have run for eight turns whenever the mon that hit it
happened to carry a Smooth Rock. Right function, right tag, wrong subject.

**The probe was run against the pre-fix engine and failed 4 of 60**, then passed 60 of 60. A test
written after a fix that is never shown failing is an assertion about the code as it stands.

**And the unit half would not have caught the original bug.** `weatherTurns` returns 8 correctly
whether or not the switch-in branch calls it. `test-weather-duration.js` therefore builds a real
Torkoal, runs the real `applyEntryEffects`, and reads the real field — with a counter asserting the
probe ran 8 times, which is what caught the build failing silently: `buildMon`'s override bag is keyed
by **species** (`{torkoal: 'Heat Rock'}`), so the natural-looking `{item: 'Heat Rock'}` was ignored and
the mon kept its dataset default of Charcoal. Without the counter that is a probe measuring the wrong
item and reporting a pass.

**PRIMORDIAL SEA AND DESOLATE LAND ARE UNIMPLEMENTED BY DECISION, NOT BY OVERSIGHT.** Will,
2026-08-04: *"The primordial and desolate stuff aint in this regulation so just make a note to deal
with that if kyogre gets added."* **0 occurrences in 339,483 boards.** `tag_dex`'s `W2ENGINE` maps
both onto plain rain and sun, which is wrong for the real mechanic — they cannot be replaced and they
nullify the opposing type entirely — and correct for a format that cannot produce them. **The trigger
condition is a primal Kyogre or Groudon entering the format.** Recorded here so a regulation change
surfaces it rather than someone rediscovering it as a bug.

## THE ARMS PROTOCOL — the hollow detector, finished. 2026-08-04.

The previous pass built the structural detector (a probe that READS THE SOURCE) and **costed** the
other half rather than doing it: a probe with ONE arm, whose reading an engine with the mechanic
DELETED would also produce. That is what made the Disable probe a false LIVE for as long as it
existed, and the heuristic beneath it — count LIVE probes whose `detail` carries two equal numbers —
is a heuristic precisely because `detail` is prose and cannot tell an ARM from an annotation.

It is done. A probe may now return `arms: {control, test}`; the harness asserts `control !== test`
structurally, with no parsing and no judgement, and a probe whose arms agree is marked **HOLLOW** and
fails the file exactly as a source grep does.

**THE OPT-IN IS NOT A HOLE, BECAUSE THE OPT-OUT IS RATCHETED.** `unarmed` is written to
`data/mechanics-census.json` and **may fall and may never rise**. A new probe written without arms
fails the file. The existing ones convert at whatever rate a pass can afford — which is the cheapest
version that closes the hole rather than costing a day up front, and it is exactly what the previous
pass's costing asked the next one to decide with the number in front of it.

**Seven were converted in this pass and every one was a genuine one-armed probe**, exactly as the
heuristic said: `lowersUser` (`def -1 spd -1` is also what an engine that dropped the user on EVERY
attack prints — the control is now Brave Bird, which must leave the stages alone), `recharge`,
`statChangeInCode`, `boostsTarget`, `clearsBoosts`, `cantUseTwice`, `statusCategory`. Ten more were
written armed. **The flat-arms heuristic fell 7 to 2, and both survivors are annotations rather than
arms.**

## Filed by the game differential, not fixed

- ~~**Mummy and Wandering Spirit rewrite the ATTACKER's ability on contact.**~~ **LANDED as WIRE 80,
  and BOTH grounds for filing it were wrong.** The filing said (1) *"neither has a param for the
  rewrite, so there is nothing to wire from"* and (2) *"0 corpus sheets between them"*.
  (1) was true of the TAG and false of the DEX: both handlers state the whole rule in one call —
  `source.setAbility("mummy", target)` and `this.skillSwap(source, target)`, both gated on
  `checkMoveMakesContact` — so `tag_dex` now derives `rewritesAbilityOnContact` with a `mode` of
  `infect` or `swap`, matching **exactly three** abilities (the third is Lingering Aroma, 0 uses).
  (2) does not hold on the current store: the artifact's own counts read **mummy 41, wanderingspirit
  58**. It matters more than 99 sheets suggests, because the ability is an INPUT to every later
  number — a Blastoise that walks into a Cofagrigus keeps being priced as a Torrent body for the rest
  of the rollout. That is the Knock Off lesson in CLAUDE.md, one field over.
  **The general lesson: "the artifact cannot express it" is a claim about the DERIVATION, not about
  the dex, and it has now been wrong twice in one session — here and for Air Lock.**
- **A KO the two engines time differently is a DAMAGE question**, and `tests/test-engine-diff.js` owns
  it. One pair (`bitterblade -> sharpness`) is excluded on that basis and COUNTED, never dropped.
- ~~**The `moveAccuracy` table in `medicham2-browser.js` is a hand-typed 35-move literal**~~ **LANDED
  as WIRE 124, and the filing understated it by an order of magnitude.** It was not two missing moves;
  it was **78 of the 500** in this engine's own table, led by Heat Wave at 7,405 clicks. The census now
  carries it (`move neverMisses — "a move the artifact does NOT tag neverMisses can still miss"`) and
  `tests/test-engine-diff.js` re-derives all 500 accuracies against the live format dex on every run.
- **Strength Sap's HEAL is still absent (WIRE 79 landed only the Attack drop)**, and the receipt for it
  moved: the move used to be counted in `fails.healProcedural` because it resolved to `kind:'heal'`
  with `heal: true`, and it now resolves to `affect`, so that counter no longer sees it. The heal
  scales off the TARGET's Attack and no artifact this engine reads carries it. Recorded here because a
  counter that quietly went down is exactly the shape this file exists to stop.
- **Shed Shell does not release a body from ABILITY trapping (WIRE 116 landed it only on the MOVE
  branch).** The item lets its holder out of Shadow Tag, Magnet Pull and Arena Trap in the real game.
  The ability branch was scoped out of the 2026-08-05 dispatch as correct-and-untouched, and the
  exposure is zero today. Declared at the site, one line above the branch.
- **ENGINE's own number is restated in two documents ENGINE does not own, and the scope pass staled
  both.** `docs/ADR-002-showdown-is-the-authority.md:52` and `docs/MODELS.md:265` both read
  **"202 / 205 live"**; the artifact now reads **208 / 211**. `tests/test-docs-current.js` catches it
  (4 of the 25 new `citation_mismatches` entries) and was **already red on arrival** — the other 21
  cite `policy-weights.json` and figures quoted from ADR-001, none of which this pass touched. Two
  line edits, outside the 2026-08-05 dispatch's file scope, so filed rather than made. **This is the
  standing hazard of a census that may only rise: every document that quotes it goes stale on a good
  day.** The generated block at the top of this file is the only copy that cannot.
- **Two ratchets are RED on arrival and neither flags a file ENGINE owns**, re-confirmed 2026-08-05:
  `test-effective-identity` fails on **`engine/click_class.js: 0 -> 2`**,
  and `test-no-silent-failure` on 12 new catches across `click_census.js`, `docs_scan.js`,
  `em_validation.js`, `engine_release.js`, `job_cost.js`, `test-docs-current.js` and
  `test-engine-release.js`. medicham2's own declaration is still PINNED and still passes. Filed under
  the DIVISIONS rule "if you trip over another division's bug, you file it".
- ~~**Grounded-ness is still not tracked, and WIRE 73 inherits the gap.**~~ **CLOSED, WIRE 117.**
  `fails.terrainHealUngrounded` is gone; the heal asks the shared `isGrounded` and its receipt is
  `seen.terrainHealSkippedAirborne`. The line is kept struck through rather than deleted because it
  is the second time this exact gap was declared and left, and the declaration is the evidence.

## The three ratchets — 2026-08-04, PRIORITIES #40 / #40a

All three were red **before** this session and two of them **crashed** rather than failed unless
`SHOWDOWN_PATH` was set, which is most of why nobody ran them. Both now exit **2** with one line:
*NOT RUN — set SHOWDOWN_PATH*. A check that crashes is a check that gets skipped.

| Ratchet | Was | Now |
|---|---|---|
| `test-mc-key` | RED, `medicham2-browser.js: 5 -> 7` | **GREEN**, back to 5. The two lookups were **removed**, not baselined |
| `test-effective-identity` | RED, 234 → 302 raw reads | **GREEN**, with 7 files **declared** and medicham2's declaration **pinned by an assertion** |
| `test-no-silent-failure` | RED, 53 new silent catches | still RED at **40**, and **none of them are in a file ENGINE owns** |

**`--update` was refused on all three, and that is the point.** Raising a ratchet is the opposite of
what a ratchet is for. `test-no-silent-failure --update` would have laundered 40 catches belonging to
MEASURE, SEARCH and OPS along with the 11 that were mine.

**The two mc-key lookups both went through `pasteKey()`**, this file's own resolver — the one the
test's header already names as working. `bringIn` normalised `switchInForme.becomes` by hand and then
indexed `MC.mons`; `oneMegaPerSide` wrote out the `-mega` suffix strip that `pasteKey` already does.
Neither was a behaviour change and both are strictly more capable (pasteKey has the flat rescan).

**`test-effective-identity` needed a third option, because it had only two and both were wrong.**
Leave it red forever, or `--update` and launder `rollout_leaf.js`'s real violation with the rest. So a
file whose raw reads are correct BY CONSTRUCTION now DECLARES that, with the reason, in the shape this
project already uses for `RAW-STORE-OK`. Three rules keep it from being a mute button: the reason must
be about construction, a declaration that can be pinned is pinned, and every declared file prints its
count on every run. **The ratchet was re-verified to still bite** by dropping a throwaway file with two
raw reads into `engine/` — it failed on it.

**All 67 of medicham2's raw reads were walked, not asserted.** 66 are live battle bodies this engine
constructed; the one exception (`norm2(set.ability)` in `buildMonFromSet`) reads a parsed SHEET, which
is the case the test itself names as correct.

**What the walk found is the part that mattered.** The construction claim was FALSE — see below.

## What verifying the claim turned up: two mega-ability bugs

Both are probed in `tests/test-mechanics.js`. Census **100 → 102 live**, nothing fell.

1. **`megaRowAbilityCase`.** 85 of the 318 `MC.mons` rows key a mega and store `ab` in DISPLAY case —
   `"Technician"`, `"Huge Power"`, `"Tough Claws"`. `buildMon` copied that through, and every ability
   test in this engine is a lowercase literal (`att.ability==='technician'`). A body built from its
   MEGA ROW carried exactly the right ability and **not one line of it fired**: Mega Scizor's Bullet
   Punch read **52 where Technician makes it 78**. It hid because the OTHER door — base row + stone —
   goes through `megaAbility()`, which returns from a lowercase hand-written map, and because
   `board.js` overwrites the ability with `effAbility()` before its own damage call. Only the
   mega-keyed door was wrong: `position_features.js`, `sets.js`, `winProb2` called with a mega name.
2. **`megaSheetAbility`.** `buildMonFromSet` read `declaredAb || megaAbility(...)`, so a paste of
   *Scizor @ Scizorite / Ability: Swarm* built a `scizor-mega` body running **Swarm**. A team sheet
   lists the PRE-mega ability; this is the mega ability gap living in the engine rather than in
   `board.js`, which had already fixed its own half at `board.js:964`. **Two engines disagreeing about
   a FACT**, which CLAUDE.md names as this project's most expensive failure. Only the branch that
   swaps the key to a mega row overrides the sheet — a non-mega set still lets a declared Rough Skin
   beat the dataset's Sand Veil.

**`tests/test-paste.js` was asserting the bug and its assertion was inverted.** It read
`geng.ability === 'cursedbody'` for a Gengar holding a Gengarite. Mega Gengar has **Shadow Tag** —
the worked example in `test-effective-identity`'s own header. Confirmed three ways before the line was
touched: Showdown's dex gives Gengar-Mega exactly one ability, `board.js effAbility` returns
`shadowtag` for the same sheet, and medicham2 now agrees.

**A probe was wrong before the engine was, for the tenth time.** The structural pin first reported
three megas with the wrong ability — Garchomp, Lucario, Absol. Champions ships a **second mega per
stone**: `garchompiteZ -> garchompmegaZ`, Rough Skin instead of Sand Force. The loop kept whichever
stone it saw LAST, which was the Z one. They are now excluded **with the reason**: `MC.mons` has zero
`-mega-z` rows and the store has zero `itez` occurrences, so the engine cannot represent them at all.

## The differential harness was silently dropping 12 rows, all of them the same Pokemon

Five catch blocks in `tests/test-engine-diff.js` returned a plausible `null` and said nothing, so a row
that failed to BUILD and a row that was never sampled were the same event. That matters here more than
almost anywhere: the headline is a RESIDUAL, and a silent drop shrinks the denominator without
shrinking the claim. Now counted, named and written to `data/engine-diff.json` as
`dropped_by_exception`.

Naming them earned its keep on the first run. At seed 20260804 `--n 400` it fires **12 times and all
twelve are Bellibolt**. The throw is inside Showdown: Electromorphosis's `onDamagingHit` adds the
`charge` volatile, and Charge's `onStart` reads a `source` that only the full move pipeline sets —
`moveHit`, the entry point this harness must use, leaves it null. **Not a MEDICHAM bug**, and on the
same layer boundary as the Disguise SUSPECT row, so it is recorded rather than papered over. It was
invisible until this session.

`tests/walk_tags.js` had the same shape and worse: its three silent catches returned `null`, and a
`null` prints as **NOT COVERED**, which the report calls "honest ignorance, not a pass". It was not
honest — an engine that THREW and a tag with no handler produced the same word.

## PRIORITIES #0 — the leaf's weather string. LANDED 2026-08-04, with a before/after.

**The engine could SET weather and could not READ the weather it was handed.** `board.weather` holds
Showdown's `|-weather|` line, which is a MOVE name — and across **41,122 weather events in the whole
store there are exactly four values**: `SunnyDay` 17,375, `RainDance` 11,355, `Snowscape` 6,304,
`Sandstorm` 6,088. Every formula in `medicham2-browser.js` compares against `sun`/`rain`/`sand`/`snow`.
`rollout_leaf.applyField` assigned the string straight through, so a mid-battle board's weather was
truthy enough to suppress the mega-weather guard and meaningless to every multiplier.

**What was exported, and why there.** `SD2WEATHER` already existed in `medicham2-browser.js`, beside
`SD2ENG` and `CODE_OF_STATUS`, under a comment saying naming conventions live there. It is now wrapped
in **`weatherId()`** and exported from that file — **not moved**, and **no second map written**. The
engine owns its own vocabulary; a copy in `rollout_leaf.js` is how `choiceLock` came to have two
engines disagreeing. It is **idempotent**, so the two paths that already spoke the engine's words
(`weatherSetter` on switch-in, a weather move played inside a playout) are untouched, and an
**unrecognised value returns `''` and is counted in `MEDI.fails.weatherUnknown`** rather than passed
through as a truthy string nothing reads. That counter is **0** over 10,000 playouts.
`:1481`, `:1825` and `:2156` were routed through it too — `:1825` read `SD2WEATHER[_pun.setsWeather]`
with no normalisation and would have silently failed on any capitalised value.

**Parity, 250 corpus boards, both arms in ONE process at n=40, seeds fixed per board.**

| | before | after |
|---|---|---|
| boards walked | 250 | 250 |
| boards carrying a weather | 130 (52.0%) | 130 |
| `rolloutWinProb` different | — | **77** (30.8% of all boards, **59.2% of the weather boards**) |
| boards moved with NO weather | — | **0** ← the control |
| mean \|Δ\| on the movers | — | **9.98 pt**, max **37.5 pt** |

By weather: sun 28/41 at 12.10 pt, rain 27/42 at 9.68, snow 7/15 at 9.11, sand 15/32 at 7.00. The
snow and sand numbers are the right order for weathers whose main modelled effect is a defence
multiplier. **The 41% of weather boards that did not move are n=40 quantisation and saturation, not
inertness** — the direct counter below settles that a different question was asked of the engine.

**The direct counter, because a parity delta is indirect.** `battleTurn` wrapped, field read on turn 1
of every playout, 250 boards × 40:

```
before : 0 of 10,000 playouts began in a weather MEDICHAM can read   (0.00%)
after  : 5,760 of 10,000                                            (57.60%)   sun 2120, rain 1600, sand 1360, snow 680
```

Probed permanently by `boardWeatherLanguage` in `tests/test-mechanics.js`, which calls the real
`applyField` and demands the resulting damage EQUAL the damage under the engine's own word, having
first shown that `sun` beats clear on the same Flamethrower — `clear 56, 'sun' 84, as landed 84`.
`applyField` is exported as a named test seam for it.

## The two dead wires in `tests/test-tag-wire.js` — BOTH CLOSED, and only one was the engine

It is **GREEN**, 104 checks, 0 dead wires. Census **102 → 105 live / 144 → 147 probed**; nothing fell.

1. **`typeImmunity` was the PROBE, not the engine.** The wire staged Volt Absorb on a **Garchomp** —
   Dragon/**Ground**, which takes zero from Electric with no ability at all. So *"an Electric hit into
   Volt Absorb prices at zero"* was true of a Garchomp with `ability:'none'`, and the heal could not
   fire because nothing was ever absorbed. It also left the absorber FREE with `moves:['protect']`, so
   the engine chose Protect and blocked the hit — two independent reasons the arm could not pass
   whatever the engine did. Same shape as the redirection false alarm (a Dragon move at a Fairy type).
   Re-staged on **Milotic** with an explicit control arm, the unmodified engine reads
   `hp change: ability none -34, Volt Absorb +35 (a quarter is 35)` — **exact**. New census probe
   `typeImmunityHeals`, LIVE on the engine as it already stood.
2. **`sealsMoves` was the engine, and the consumer was unreachable.** The wire sat inside
   `playerAction`'s `kind==='status'` branch. Encore, Disable and Taunt carry a **volatile and no major
   status**, so `playerAction` classifies them as `affect` and control never arrived. Moved to where
   they actually resolve (**WIRE 26**), and **the duration now comes from the artifact** — it read
   `encore?3:taunt?3:1`, so Disable, which the tag says lasts **5**, got one turn. Encore now rides the
   **same `_lock` the Choice items use**, so a caller-SUPPLIED action is bound as well as a chosen one
   (the WIRE 24 rule, which nothing about Encore honoured); a Choice lock is never shortened by it.

**And the Disable probe in the census had been a FALSE LIVE for as long as it existed.** It ran ONE
arm: the foe committed Rock Slide, was Disabled, chose freely, picked Earthquake, and the probe called
the mechanic live. Remove the Disable click and it picks Earthquake anyway. **Identical results across
a varied knob mean the knob is unwired.** Both arms print now, and the staging was inverted so the
control REPEATS — Rock Slide is precisely the move the control does not repeat, which is why the probe
read green while dead.

**Filtering `me.moves` was not enough, and the probe caught that too.** The priors sampler
(`MC.priors[me.name]`) picks a move **by name** and never consults `me.moves`, so the seal leaked
through the single most-used exit in `chooseAction`. Both arms clicked Dragon Claw until it was
guarded. Disable also ticks at **end of turn** rather than in `chooseAction`, or a duration only counts
down on turns the engine happens to be choosing — which in a rollout driven from outside is never.

**My own Encore probe was wrong first, which makes eleven.** It handed the foe a FORCED action on the
pinned turn, and a forced action bypasses `chooseAction` — it measured the caller's obedience. Both
probes now read `S.lastActs`, the engine's own record of what was clicked, because `_lastMove` is not
written by every action kind and a pass leaves yesterday's move sitting there.

## The HEALING CLASS — validated as a class, 2026-08-04. Census 105 → 107.

Will: *"lets validate all the healing tags like drain and hospitality and life dew and recover and
regenerator."* It is a class and only one member (`drain`) had been fixed. All eight members now have
a **behavioural, two-armed** probe and all eight are LIVE.

**THE DIFFERENTIAL CANNOT SEE ANY OF THIS, and `tests/test-mechanics.js` now says so in its own
comment.** `test-engine-diff.js` compares one `moveHit` against one `dmgRange` — a single-hit DAMAGE
number. Healing is HP over turns. A residual of 1/400 says nothing whatever about this class. Same
statement `multiHit` carries, same structural reason.

### The tag over-matched, and printing the membership first is what caught it

`tag_dex.js` derived `healsOnSwitchOut` as `a.onSwitchOut ? {heal: 1/3}` — **any** ability that does
anything on the way out. Membership printed **before** wiring:

```
OLD derivation matched 3 : naturalcure, regenerator, zerotohero
NEW derivation matched 1 : regenerator {"heal":0.3333}
```

**Natural Cure cures status and heals nothing; Zero to Hero forme-changes Palafin.** Wiring the tag as
it stood would have handed two abilities a 33% heal they do not have, on **227 corpus uses**. The
derivation now READS the number out of the handler — `pokemon.heal(pokemon.baseMaxhp / 3)` — instead of
assuming it. LESSONS §4 for the fourth time.

**The regeneration was verified, not assumed**, by the procedure this file already documents: after
excluding `uses`, **exactly 2** entries in `data/tags.json` differ and both are the intended ones
(411 entries' `uses` moved because the store grew; no feature reads `.uses`).
`engine/feature_fixture.js --check` exits **0** afterwards, so **no refit is owed**.

### What was WIRED versus what was already HARDCODED

| Tag | Uses | Before | Now |
|---|---|---|---|
| `healsOnSwitchOut` | 845 | **nothing at all** — a Regenerator pivot was priced as a plain switch | WIRE 27, from the corrected tag, in `switchOut` |
| `blocksHealing` | 196 | **nothing at all** | WIRE 30, on a connecting hit, per target |
| `passiveHeal` | 6,483 | `if (m.item === 'leftovers') ... /16` — **a name check** | WIRE 29, from `passiveHeal.heal` |
| `healsSelf` / `healsAlly` | 2,592 | the dex blob's `fx.heal`, and `fx.target === 'allies'` for the spread — **a second copy of the fact** | the tag's own params; Life Dew spreads because it carries BOTH tags |
| `drain` | 8,553 | already tag-driven (WIRE 19) | + the Heal Block gate |
| `healsAtThreshold`, `healsAllyOnSwitchIn`, `perTurnHP` | — | already tag-driven | + the Heal Block gate where it applies |

**Routing `healsSelf`/`healsAlly` through the tag is a behavioural NO-OP and that was checked move by
move before the switch**: across all 14 members the tag's fraction equals the dex's exactly wherever
both exist (`lifedew [1,4]`, `roost/recover/slackoff/softboiled [1,2]`), and where the tag says
`heal: true` the dex carries nothing either. So nothing moved and **membership stopped being typed** —
docs/TAGS.md invariant 3. A move added next regulation with `healsSelf` now works without an edit.

**`heal: true` is a boolean in a fraction's clothing and is left visibly unwired**, counted in
`MEDI.fails.healProcedural`: Rest (full, plus the sleep), Synthesis / Moonlight / Morning Sun
(weather-dependent), Wish (delayed), Healing Wish (the user faints), Swallow (needs Stockpile),
Strength Sap (scales off the TARGET's Attack), Heal Pulse (91 uses, heals its target). They are
deliberately NOT classified as `kind:'heal'` — Rest's real click is the sleep and Strength Sap's is the
Attack drop, and capturing them here would turn a partly-modelled move into a fully no-op turn.

### `blocksHealing` is the counter and it landed in the SAME pass, on purpose

Wiring the healers without it makes every healer in the format strictly better than it is — a
one-directional error. It gates **healing moves, the heal half of a drain (the damage still lands), a
passive item tick, a pinch berry (which is not consumed either), and Leech Seed's return to the
seeder**. It does **not** gate `healsOnSwitchOut` — that fires as the body leaves, and leaving ends the
volatile — nor Hospitality, which heals on ENTRY. Both exclusions are stated in the code.

### THREE CENSUS ENTRIES WERE HOLLOW — LIVE by SOURCE GREP, not by behaviour

The contradiction Will's brief pointed at turned out to generalise. `healsAllyOnSwitchIn` read
`/hospitality|healsAllyOnSwitchIn/.test(src)` — it would have returned **LIVE for a mechanic that was
commented out, renamed, or wired to the wrong body.** It is now behavioural and two-armed and reads
`ability none 0, Hospitality 43 (a quarter is 43)`. **A hollow entry is worse than a missing one,
because it occupies a slot in a number that may never fall.**

**Two more of the same shape were still LIVE by grep and were named here rather than quietly left:**
`priorityMod` and `weatherChipImmune`. **Both were converted on 2026-08-04 — see "THE HOLLOW PROBES"
below. One was honest and one was hiding a dead wire.** `blocksBerries` and `disablesAttacker` were
the same shape reporting MISSING; they are behavioural now too, and still MISSING.

### The census-versus-tag-wire contradiction, and which one lied

**`tests/test-tag-wire.js` lied.** `data/mechanics-census.json` was right: Volt Absorb heals exactly a
quarter and always did. The wire staged the absorber as a **Garchomp** — Dragon/**Ground**, already
immune to Electric with no ability at all — and then left it FREE with `moves:['protect']`, so the
engine chose Protect and blocked the hit. Two independent reasons the arm could not have passed
whatever the engine did. See the dead-wires section above; the census probe `typeImmunityHeals` was
written this session, watched fail on nothing, and reads `ability none -34, Volt Absorb +35`.

**Where the fact lives, since it lives in an odd place.** `voltabsorb`, `waterabsorb`, `stormdrain`,
`poisonheal` and `healer` carry **no heal tag**; the heal is a param of `typeImmunity` and that is the
one place it lives. Volt Absorb and Water Absorb are the same shape and both work.

### Not done, and named so nobody assumes it was

- **`leechseed` and `pollenpuff`.** Leech Seed is **already tagged** — `perTurnHP {effect:'drain',
  per:8, on:'target', to:'user', immuneType:'Grass'}` — and already wired (WIRE 8), so the brief's
  "carries no heal tag at all" is not quite right; what it lacks is membership in the `drain` tag, and
  adding a second tag for the same fact is what invariant 2 forbids. **Pollen Puff (99 uses) is a real
  gap**: it heals an ally instead of damaging and carries nothing for it.
- **`naturalcure` is now `untagged`.** It genuinely cures status on switch-out and no derivation
  describes that. It lost a tag it should never have had; it still needs one it does not have.

## Found red, NOT mine, NOT fixed — reported rather than filed

- **`tests/test-web-status.js` is RED BECAUSE MY CENSUS MOVED, and I did not run the fix.** It says
  `engine.live = 105 but data/mechanics-census.json -> live = 107`. The fix is one command and the
  test names it: **`node web/build-status.js`**. It is a generator — it authors no number, it copies
  artifacts onto the board — but it writes into `web/`, which this pass was told not to touch. So it is
  reported here in full rather than left to be discovered: **WEB owes one command.**
- **`tests/test-no-silent-failure.js` is RED at 47 new silent catches (was 40), none in an ENGINE
  file.** The seven that appeared since the 40 were counted: `backtest_winrate.js`, `mag_bot.js` ×3,
  `miltank.js` ×3 and neighbours — MEASURE, SEARCH and OPS. The one match inside `rollout_leaf.js`
  (`movePriorFor`, line 216) is **pre-existing at HEAD** and was verified against
  `git show HEAD:engine/rollout_leaf.js`; it moved down seven lines because of a comment.
- **`test-site-data-fresh` and `test-stadium-roster` are RED and are MEASURE/WEB.** The first is the
  stale-fit list (`pory`, `xatu`, `nmf`, `slowking`); the second is the GURU hole, PRIORITIES #41.

## A SECOND weather boundary exists, is the same bug, and is measured at ZERO exposure — FILED

`engine/position_features.js:291` builds `field.weather = B.norm(board.weather)` — the same
untranslated move name — and hands it to `M.effSpeed`. The loss is exact and was measured, not argued:

```
swiftswim   clear 161   engine-word 'rain' 322   board-word 'raindance' 161
chlorophyll clear 161   engine-word 'sun'  322   board-word 'sunnyday'  161
sandrush / slushrush    identical
```

**It is not fixed here, and the reason is a number.** Over **400 corpus boards, 192 of which carry a
weather, ZERO** had a weather-speed ability among the actives standing in its own weather (95% upper
bound ~0.75%). The control holds: `MC.mons` carries **9** such rows — Excadrill, Swampert-Mega,
Basculegion-F, Venusaur, Vileplume, Victreebel, Overqwil, Beartic, Houndstone — so the mechanism is
real and the event is rare, rather than the probe being broken. It is a latent hazard, and fixing it
changes a **feature vector**, which is the refit edge MEASURE owns. `board.js:1190` holds a THIRD copy
of the same map (`WEATHER_KIND`, sun/rain only), and `board.js` is not ENGINE's to edit.

**Terrain was the same mismatch and it is now MEASURED AND FIXED — see the next section.**

## PRIORITIES #0's TWIN — THE TERRAIN VOCABULARY. LANDED 2026-08-04, with the exposure measured first.

**The split ran through the middle of this engine, not only at its edge.** Three writers, two
vocabularies, nobody translating — and medicham2's own readers were on *both* sides of it:

| Reader | wanted | got from the artifact | got from a Board |
|---|---|---|---|
| Hadron Engine (`:631`) | `electric` | `electric` ✓ | `electricterrain` ✗ |
| Grassy Glide (`:97`) | `grassy` | — | `grassyterrain` ✗ |
| Psychic Terrain priority block (`:144`) | `psychicterrain` | `psychic` ✗ | `psychicterrain` ✓ |

Measured on the shipped engine before anything was touched:

```
Surf under Hadron Engine   clear 99   'electric' 130   'electricterrain' 99
movePriority(grassyglide)  'grassy' 1                  'grassyterrain' 0
priorityRefusedAbove       'psychic' Infinity          'psychicterrain' 0
```

So **Psychic Surge has never blocked a priority move** (its `terrainSetter` says `psychic`), and a
board's `electricterrain` has never boosted or hastened anything. Both halves looked live and both
were dead, in opposite directions.

### Exposure, measured before the fix

- **The store holds exactly four values** over **1,845** field-start terrain events across 52,441
  games: `Electric Terrain`, `Psychic Terrain`, `Grassy Terrain`, `Misty Terrain`. The translation
  therefore covers **100%** of what exists, the same way the weather one did.
- **1.98%** of the 8,759-game fit corpus carries a terrain at all (173 games, 199 events).
- **863 of 69,623 corpus boards — 1.24%** — carry a terrain by the Board's own key, against **48.1%**
  for weather. By value: electric 597, psychic 243, grassy 18, misty 5.
- **0 of those 863** are found by the extractor that actually feeds the leaf. `miltank.js:781` and
  `rollout_r1.js:175` do `['electric','grassy','misty','psychic'].find(t => board.hasField(t))` — a
  **THIRD** vocabulary, short words against a Board that stores long ones. **Leaf-side terrain exposure
  is exactly zero today and stays zero until those files' owners change them.** Filed below.

### Parity, and the honest answer is ZERO with a reason

150 terrain boards + 150 no-terrain controls, `n=40`, seeds fixed per board, the board's own key
handed in, pre-fix and post-fix engines run over the identical sample:

| | terrain boards | control (no terrain) |
|---|---|---|
| paired | 142 | 134 |
| `rolloutWinProb` different | **0** | **0** |

**Zero everywhere, and this time it is not "the fix did not take" — it is measured inertness with
three stacked causes**, each of which is a number rather than an argument:
1. the 37 psychic boards were **already** reaching the one reader written for the board's spelling, so
   before == after there by construction;
2. the 101 electric boards can only be read by **Hadron Engine**, which has **0 corpus uses** and
   exactly one `MC.mons` row (`raichu-mega-x`);
3. grassy is **18 of 69,623** boards and its only reader is **Grassy Glide, 3 corpus uses**.

The direction that *did* change — the artifact's `psychic` now blocking priority — has **2** corpus
uses of `psychicsurge`. So the terrain **field** is a tiny lever in this format, and the vocabulary fix
is worth having because it is correct, not because it moves the number.

**The terrain MOVES are the lever, and they are where the pass paid.** `psychicterrain` is clicked
114 times, `expandingforce` 182, `risingvoltage` 114 — an order of magnitude more than the abilities.
Both were wired in the same pass (`setsTerrain`, `terrainScaled`, below) and both go through
`terrainId`, which is what makes the translation load-bearing rather than decorative.

**Whole-session parity, same 276 boards, session-start engine against now** — this arm has no control
by construction, because the sandstorm chip and Magic Bounce also landed, so it is decomposed by
weather instead:

```
sandstorm  9/22 moved (40.9%)   <- the sandstorm residual
none       9/118       (7.6%)   <- Magic Bounce, the terrain moves, Expanding Force
raindance  3/50        (6.0%)
sunnyday   0/59        (0.0%)   <- the control: nothing this pass touches sun
snowscape  0/27        (0.0%)   <- and snow is correctly NOT a chip in this generation
```

Mean |Δ| 4.20 pt on the terrain boards and 7.00 pt on the rest, max 8.8 pt.

**`terrainId()` is `weatherId()`'s sibling and no second map was written.** Same shape, same
idempotence, same loud unknown (`fails.terrainUnknown`, which names the first value it drops). It is
exported. Idempotence matters more here than it did for weather because **both** vocabularies genuinely
arrive — the artifact's on a switch-in and the Board's at the leaf boundary. Probed permanently by
`boardTerrainLanguage`, which asserts **both sites in both vocabularies**: `clear 99, 'electric' 130,
as landed 130` and `priorityRefusedAbove: clear Infinity, 'psychic' 0, 'psychicterrain' 0`.

## THE HOLLOW PROBES — one was honest, one was hiding a dead wire

### `weatherChipImmune` was LIVE by grep and THE ENGINE HAD NO WEATHER CHIP AT ALL

The probe read `/icebody|weatherChipImmune|magmaarmor/.test(src)`. It passed on the word
`magmaarmor`, which appears in this engine **once** — inside the **freeze**-immunity table at
`:1097`, with nothing whatever to do with weather. So the census carried an immunity as working while
the damage it is immune to did not exist: burn, poison, Toxic and Leech Seed all ticked at end of
turn and **sandstorm did not**. Sand Stream is 1,705 sheets and the store holds 6,167 sandstorm events.
CLAUDE.md's own advice — *"Bring Steels against Tyranitar sand — they take no sandstorm chip"* — was
describing a mechanic the simulator did not have.

**Landed as WIRE 31**, first in the residual order, which is the real one. Snow is **not** a chip in
this generation (Snowscape replaced Hail) and the probe asserts that a fourth arm reads zero, so an
engine that chipped in snow would be a new wrong number rather than a wired mechanic. Reads:
`sand, Milotic: ability none -10 (a sixteenth is 10), Sand Veil -0; sand, Archaludon (Steel) -0;
snow, Milotic -0`. **40.9% of sandstorm boards moved** in the parity above.

**The tag over-matched and printing the membership caught it, for the fourth time in this file.**
`onImmunity` is Showdown's one hook for "I ignore a named source of harm" and the derivation excluded
only the type names:

```
OLD matched 8 : icebody magmaarmor oblivious overcoat sandforce sandrush sandveil snowcloak
NEW matched 6 : icebody overcoat sandforce sandrush sandveil snowcloak
```

Magma Armor's handler is `if (type === 'frz')`; Oblivious's is `if (type === 'attract')`. Wiring it as
it stood would have handed a sandstorm immunity to bodies that take the chip. The **weathers are now
read out of the handler** — Overcoat refuses both, Sand Veil only sand, Ice Body only snow — so the
consumer names no ability. Magma Armor is left with **no tag**, which is honest: its real mechanic is
freeze immunity through `onImmunity` rather than `onSetStatus`, so the statusImmune derivation next
door does not describe it either.

**Magic Guard is deliberately NOT exempted and is COUNTED** (`fails.magicGuardChip`). It blocks
indirect damage through `onDamage`, carries `untagged` (79 uses), and exempting it by name would type a
membership list *and* leave the ability half-right, since burn and poison above still chip it.

### `priorityMod` was hollow and the mechanic underneath it is genuinely LIVE

Prankster's `+1` really is applied in `battleTurn`'s sort. Re-staged behaviourally on the case the
wire's own comment names: a **Grimmsnarl** (base 60) puts up Reflect against a **Weavile** (base 125)
that is clicking Icicle Crash, so a 0-priority screen goes up after the hit it is meant to blunt.
`ability none 118, Prankster 78` — x0.667, which is the doubles screen, so the screen landed first.

**`S.lastActs` is NOT the resolution order and the probe says so in a comment.** medicham2 writes it
from `acts` *before* the sort, so it records what was committed. The first version of this probe
printed it and got the same name in both arms, which reads exactly like a dead knob.

### A SYSTEMATIC DETECTOR — built, because it was cheap and exact

`tests/test-mechanics.js` now captures each probe's own source and flags any probe that **reads a file
instead of running the engine**. It is structural, costs nothing, is written to the census as
`hollow`, and the file **exits 1** if it is non-zero — a different exit from MISSING on purpose, because
a MISSING mechanic is honest state and a hollow probe is not evidence about the engine at all. All
five that ever existed would have been caught the day they were written. **It is 0 now.**

**The "both arms agree" version is measured rather than asserted, and the measurement is the reason.**
`detail` is free-form prose carrying arm values, thresholds (*"a quarter is 43"*), stage counts and
stat names all as bare digits, so no parser can tell an ARM from an ANNOTATION. The scan prints how
many LIVE probes have ≥2 numbers that are all equal:

```
23 over the whole census  ->  6 once restricted to LIVE  ->  3 after fixing what it found
```

The 6 were not false positives about agreeing arms — they were **one-armed probes**, and three of them
could not have failed:
- **`preventsStatDrop`** read `atk 0 -> 0`, which is also what an engine with no Intimidate prints;
- **`blocksStatusMoves`** read `target atk stage after Charm: 0 (0 = refused)`, same shape;
- **`chargeTurn`** read `foe took 0 on the charge turn`, which a move dropped to `kind: pass` also
  prints — it now also plays turn 2 and demands Fly actually **lands**.

The remaining 3 (`lowersUser -1/-1`, `boostsTarget 2/2`, `statusCategory 0 + par`) are genuine
heuristic noise: each asserts a specific non-default value a no-op engine could not produce.

**Doing it properly is a PROTOCOL change** — probes return `arms: {control, test}` and the file asserts
`control !== test` — and it has to be applied by hand to all 154 probes, because a probe that kept
returning only `detail` would opt itself out silently, which is the same hole in a new place. Costed
here so the next pass decides with the number in front of it.

## Walking the unprobed tags — 2026-08-04, in descending corpus usage

| Tag | Uses | Result |
|---|---|---|
| `moveClass` | 76,625 | **LIVE.** Four arms — Iron Fist must boost Mach Punch and must **not** move Flare Blitz, or "boosts everything" passes |
| `statChange` | 64,869 | **LIVE**, and the SIZE is asserted: Charm is exactly −2, from the param |
| `sound` | 14,797 | **LIVE.** Soundproof refuses Hyper Voice and still takes Moonblast |
| `punishesAttacker` | 8,953 | **LIVE.** Rough Skin tolls Waterfall and **not** Surf — the trigger is `contact` and a probe that only tested contact would pass on a wire that punished everything |
| `reflectsStatusMoves` | 568 | **WAS MISSING — WIRED (WIRE 33).** See below |
| `setsTerrain` | 141 | **WAS MISSING — WIRED (WIRE 32).** `playerAction` had a branch for the four weather moves and none for the four terrain moves, so Psychic Terrain (114 uses) resolved to `kind: pass`. Probed by outcome — the foe's Ice Shard is blocked — not by reading the field back, which would pass on a string nothing reads |
| `terrainScaled` | 296 | **WAS MISSING — WIRED (WIRE 34).** Expanding Force 105 → 157 |

**`reflectsStatusMoves` over-matched, and this is the fifth membership print to earn its keep.**
`onAllyTryHitSide` is the hook for "I react to something aimed at my side" and says nothing about what
the reaction is:

```
OLD matched 3 : magicbounce, sapsipper, soundproof
NEW matched 1 : magicbounce
```

Sap Sipper **boosts** off an ally's Grass move; Soundproof **refuses** an ally's sound move. Wiring the
tag as it stood would have sent every Will-O-Wisp aimed at a **Soundproof** body back at its user —
355 corpus uses — and a bounce is strictly worse than an immunity, because it is a move that lands on
you. The discriminator is the bounce itself: only Magic Bounce rebuilds the move and calls `useMove`
back at the source, gated on Showdown's `reflectable` flag.

**`reflectable` was added to the `moveClass` derivation in the same pass**, so the wire is the same
ability-names-a-flag / move-carries-it JOIN `immuneToMoveClass` already uses rather than a second
membership rule in the consumer. 60 moves carry it; the tags.json diff was verified to be **exactly**
that addition and nothing else. Probe reads `atk stages (target/user): ability none -2/0, Magic Bounce
0/-2`. What is **not** modelled is stated: the tag's `scope` covers the whole side including hazards,
and this engine keeps neither hazards nor side conditions.

**`terrainScaled` carried no number and that is why nothing read it.** `{scalesWith:'terrain'}` named
the mechanism and gave a consumer nothing, so Expanding Force (182) and Rising Voltage (114) were
priced at base power in every rollout. `tag_dex` now pulls **which terrain** out of Showdown's own
`isTerrain("psychicterrain")` and **the multiplier** out of the `chainModify` or `basePower * n` beside
it — and it probes `onBasePower` too, which was never probed and is where Expanding Force and Misty
Explosion live. Membership: `expandingforce 1.5`, `risingvoltage 2`, `mistyexplosion 1.5`, and
**`terrainpulse` keeps the bare tag with no number on purpose** — it changes TYPE as well as power and
must not be given a multiplier. ~~Grounded-ness is not tracked (the same caveat
`priorityRefusedAbove` already carries)~~ — **that reason died at WIRE 117**; the live blocker is that
`terrainScaled` names no SUBJECT while Expanding Force tests the user's feet and Rising Voltage tests
the target's, so the two cannot share one wire. Expanding Force becoming a spread move is still not
modelled; both are stated in the code.

**Every regeneration of `data/tags.json` was verified the way this file requires** — diff excluding
`uses`, count the entries, read every one. `weatherChipImmune` 8, `reflectsStatusMoves` 3,
`moveClass` 60, `terrainScaled` 3, all intended. `engine/feature_fixture.js --check` exits **0** after
each, so **no refit is owed**.

## Filed, not fixed

- **A THIRD terrain vocabulary sits between the Board and the leaf, and it finds nothing.**
  `engine/miltank.js:781` and `engine/rollout_r1.js:175` both extract with
  `['electric','grassy','misty','psychic'].find(t => board.hasField(t))`, while `board.startField`
  stores `norm(move.terrain)` — the LONG words. Measured: **0 of the 863 terrain-carrying boards** in
  a 69,623-board walk are found by that extractor, so the leaf is handed `''` on every board that has
  a terrain. `medicham2` now accepts either vocabulary, so the fix on their side is to pass the key the
  Board actually holds. `miltank.js` and `rollout_leaf.js` are **SEARCH's**; `rollout_r1.js` is a
  MEASURE gate. Exposure is small (1.24% of boards) and the fix is one array.
- **`engine/position_features.js:296` reads the LONG terrain words and `:291` the untranslated
  weather.** Both change a **feature vector**, which is the refit edge MEASURE owns. `board.js:1190`
  holds a third copy of the weather map (`WEATHER_KIND`, sun/rain only). Neither file is ENGINE's.
- **`engine/status.js` prints the differential count without its seed.** The artifact now carries
  `seed`, `requested`, `skipped_multihit` and `skipped_non_finite`; the print reads none of them, so
  "1/400 differential comparisons disagree" still looks unconditional and does not say that 15 rows
  were skipped as not-comparable. `status.js` is MEASURE's file. One line.
- **`engine/status.js` does not read `data/interaction-matrix.json` at all**, so the ENGINE block prints
  a census and a damage residual and says nothing about whether the mechanics work TOGETHER — which is
  now a bigger surface than either (1,008 live pairs against 174 probes). The artifact carries
  `live`, `agree`, `inert`, `saturated`, `ko_timing`, `threw` and the full `dropped_by_the_generator`
  ledger, ready to print. **`status.js` is MEASURE's file.** Filed, not fixed.
- **The last differential row is a LAYER MISMATCH, not an engine bug, and it is flagged in place.**
  `chesnaught woodhammer -> mimikyu` reads `showdown 0-0, medicham 120-130` and is marked SUSPECT.
  Showdown's `onDamage` returns 0 while the maxhp/8 never lands, because this harness never calls
  `battle.update()`; MEDICHAM's `dmgRange` correctly reports raw damage because WIRE 23 substitutes
  one level up in the battle loop. Both engines are right and the comparison is asking `dmgRange` a
  question about `battleTurn`. It is still COUNTED in the residual — flagging must never move the
  number. Fixing it properly means teaching the harness to run the damage-layer abilities, which is
  a bigger change than the row is worth.
- **`battleResult` cannot tell a finished battle from an expired clock.** `medicham2-browser.js:1802`
  scores bodies-then-HP unconditionally; `battleOver` returns true for a wipeout *and* for
  `S.turn >= maxTurns`, and the caller cannot distinguish them from the return value. Every
  cap-expired playout is therefore a material count returned as a win probability, silently.
  Filed by SEARCH 2026-08-04 while testing whether that was the cause of the flat leaf calibration.
  **It is not** — measured by wrapping `battleResult` over 1.1M playouts, 99.5–99.8% end by an actual
  wipeout at every explore setting and at horizons 20 and 60, and cap-hits run 0.2–0.5%. So this is a
  latent hazard, not a live defect, and it is filed rather than ranked. The cheap fix is for
  `battleResult` to return the reason beside the score so a caller can weight or discard those rows;
  do not change what it *scores*, which several artifacts depend on.

## The authorised list — ALL LANDED, 2026-08-04

Cleared after the SEARCH explore sweep and the leaf calibration landed. Census **42 → 100 live**,
differential **4/400 → 1/400** at seed 20260804, refit edge still CLEAN (all 58 feature columns
hash-identical, so no refit is owed).

**The item ranked first was not a bug.** `redirects` (7,240 uses) was filed as "the attack VANISHES
— the worst bug in the repo". It does not. The probe aimed **Dragon** Claw at **Whimsicott**, which
is Grass/**Fairy** and immune to Dragon: Follow Me fired correctly, pulled the attack off Incineroar,
and landed it on a body that takes exactly zero. Both arms read 0 and the conclusion was written from
that. Re-staged with Milotic the same code reads `aimed 0 / redirector 101`. Follow Me and Rage
Powder have always worked, so **no rollout, H2H, R3 or R4 result is invalidated by this** — the
blast-radius note attached to the original filing should be retracted.

Nine probes in this file have now been wrong before the engine was, and this is the first that was
believed. A red probe is a QUESTION.

| # | Item | Result |
|---|---|---|
| 1 | ~~`redirects`~~ → **`redirectsType`** (Lightning Rod, 1,901) | **LANDED** (WIRE 25). The real redirection gap: the engine only looked for the Follow Me volatile, so an Electric move aimed past a Lightning Rod hit its partner. Probe now reads `aimed 0 / rod 0 / spa +1` — the rod both draws and absorbs, and the boost is the receipt. |
| 2 | **`drain`** (8,553) | **LANDED** (WIRE 19). `dealt 51 → user 85→110`. The fraction did not exist in the artifact: the tag said `readFrom:"m.drain"`, a pointer into a dex this engine does not have. `tag_dex.js` now emits the value, so Draining Kiss gets its 3/4 instead of an assumed 1/2. |
| 3 | **`multiHit`** (4,655) | **LANDED** (WIRE 20). `expectedHitsOf()` already existed and only `punishExposure` read it. Rock Blast 17 → 52. The differential now SKIPS multi-hit moves — comparing an expectation against one sample is not a comparison — so `tests/test-mechanics.js` is the only guard and says so in its own comment. |
| 4 | **`choiceLock`** (5,886) | **LANDED** (WIRE 24), in medicham2 — **no `board.js` change was needed**. `chooseAction` had honoured the lock since WIRE 18; `_a = forced \|\| chooseAction(...)` let every caller-supplied action through. A switch is still legal, which is the half a naive fix breaks. |
| 5 | **`fixedDamage`** (1,122) | **LANDED** (WIRE 21). Super Fang, Final Gambit, Endeavor and the OHKOs had no base power, so `hasPower()` rejected them and they were worth zero. Counter/Mirror Coat/Metal Burst need turn state a pure pricing function is not given, and are left at zero **loudly** rather than approximated. |
| 6 | **Foul Play** (734) | **LANDED**. `dmgRange` read `statSwap` (Body Press, Psyshock) and nothing had ever read `swapsStat.offensiveFrom`. The target's Attack **stage** moves with it, or a Swords Dance matchup — where the move is actually played — becomes a new wrong number. Differential: both directions now rel **0.0%**. |
| 7 | **`immuneToMoveClass`** (Soundproof 349, Overcoat 240, Bulletproof 85) | **LANDED** (WIRE 22) **with** CONTROL FIX 10 in the same pass, as required. Membership printed first: five abilities, and `magicbounce`/`reflectable` is excluded deliberately — it bounces status moves and grants no damage immunity. Powder is left to `powderBlocked()`, which already owns that question. |
| 8 | **Disguise** | **LANDED** (WIRE 23). Exactly `maxhp/8`, not a flat zero. My probe's own threshold (`≤15% of the real hit`) would have **rejected** the correct fix — 16 against a 92 hit is 17% — so the assertion was corrected to the exact rule first. The busted flag is deliberately NOT cleared on switch-out. |
| 9 | **Dry Skin Fire x1.25** | **LANDED** — tag first, exactly as specified. `tag_dex.js` now probes `onSourceBasePower` beside the stat route; membership printed before wiring matched **exactly one** ability corpus-wide. The four hardcoded `thickfat/heatproof/purifyingsalt/waterbubble` lines in `dmgRange` are gone, replaced by one tag-driven read. Differential: `houndoom fireblast -> heliolisk` now rel **0.0%**. |
| — | `train_policy.js` `writeWeights` provenance | STILL NOT DONE. Carried from the previous pass. |

**Regenerating `data/tags.json` was verified, not assumed.** The generator did **not** reproduce its
own artifact on the first run — 285 entries differed. Every one of those was the `uses` count alone,
because the store grew mid-session; after excluding `uses`, exactly **9** entries changed and all 9
were the intended ones (8 drain moves + `dryskin`). No feature reads `.uses`, and
`feature_fixture --check` is clean afterwards. Anyone regenerating tags should run that same diff
rather than trusting the file.

**The mechanism in item 5 was diagnosed wrongly first and the correction matters.** A starved
`basePowerCallback` does compute NaN, but Showdown clamps before it reaches the target's HP, so the
row comes back as a clean, plausible, entirely fake **zero** — not a NaN. A `Number.isFinite` guard
therefore does *not* catch it and has never fired on this corpus; the guard is kept and says so in
its own comment, and the phantom zero is caught by the SUSPECT marker instead. A fix aimed at the
wrong mechanism is still a bug.

## Ranked engine fixes — every one has a red probe behind it

The 2026-08-04 tag walk added 88 probes and moved the census from 54 probed to 142. `live` went
42 → 100 and `missing` from 12 to 42, and not one previously-live probe fell. Nine of the entries
below have since LANDED (see the authorised list above); what remains here is the queue. Ranked by corpus uses, then by how badly wrong the
behaviour is, with Lesson 3 applied by hand.

**Nine of these were my probe being wrong, not the engine, and each was caught by its own control
before it reached this list** — a spread move aimed where a single-target one was needed, Close
Combat fired at a Ghost that is immune to it, Toxic fired at a Steel that cannot be poisoned, and a
Fly declared by a Pokemon slower than its attacker (which the real game also lets through). That is
Lesson 5 for the sixteenth-through-nineteenth time, and it is why every probe here prints BOTH arms.

1. **`redirects` — 7,240 (Rage Powder 5,874, Follow Me 1,366). Take this first, and not for the
   usage.** The failure is worse than absence: the attack *vanishes*. Probe reads
   `no Follow Me: aimed 92 / partner 0 | Follow Me: aimed 0 / partner 0` — nobody takes it. Every
   Rage Powder in every rollout ever run has been a free team-wide Protect, and the searcher
   maximises exactly the lines its model is most optimistic about (Lesson 2). `redirectsType`
   (Lightning Rod, 1,901) is the same bug through a different door and reads the same way.
2. **`drain` — 8,553 (Matcha Gotcha 4,957, Giga Drain 1,255, Drain Punch 916, Draining Kiss 814).**
   `move dealt 51 to the foe; user 85 -> 85 hp`. The damage lands and the heal is dropped, so the
   most-clicked recovery route in the format is worth nothing.
3. **`choiceLock` — 5,886.** Not unimplemented: `tests/test-choice-lock.js` asserts it four ways and
   passes, on `board.js`. MEDICHAM obeys whatever action it is handed. Two engines disagreeing about
   a FACT is the CLAUDE.md rule this project has broken most expensively.
4. **`multiHit` — 4,655 (Dual Wingbeat 2,675, Twin Beam 676, Triple Axel 522, Population Bomb 385).**
   Priced as ONE hit. Dual Wingbeat is exactly half its real damage; Population Bomb about a seventh.
   The differential cannot see this — single-call `moveHit` also hits once — so only the probe can.
5. **`blocksSoundMoves` — 2,726 (Throat Chop).** One move, all real clicks, no effect at all.
6. **`punishesContact` — 1,761 (Spiky Shield 887, Baneful Bunker 698, King's Shield 176).** The block
   works and the punish does not, so the three are currently just Protect.
7. **`swapsStat` / Foul Play — 734, and the only red item with an independent authority behind it.**
   Confirmed twice against Showdown in the same run and in BOTH directions —
   `spiritomb foulplay -> wyrdeer` 178 there against 132 here, `klefki foulplay -> pangoro` 19
   against 8. `dmgRange` reads the `statSwap` tag, which Foul Play does not carry; its `swapsStat`
   params say `offensiveFrom:"target"` and nothing reads that field.
8. **`overridesEffectiveness` / Freeze-Dry — 1,252.** `mrrime freezedry -> araquanid` reads 96-114 on
   Showdown and 24-28 here: the full 4x, the move's entire identity, and independently confirmed.
9. **`fixedDamage` — 1,122 (Super Fang 577, Final Gambit 250, Endeavor 93).** `mv.bp=0`, so
   `dmgRange` short-circuits and these moves are worth literally zero to the engine.
10. **`boostsEachTurn` — 1,137 (Speed Boost 700, Moody 434)** and **`healsOnSwitchOut` — 1,057
    (Regenerator 830).** Both sheet counts, but both fire on a schedule rather than on a condition,
    so the count is close to the real rate.
11. **`costsUserHP` — 929 (Substitute 528).** Resolves to `kind: affect` and costs nothing;
    Substitute is not modelled at all and the HP cost is only its visible half.
12. **`poisonsOnMyContact` — 947 (Poison Touch)**, **`reducesAllyDamage` — 875 (Friend Guard)**,
    **`immuneToMoveClass` — 838 (Soundproof 344, Overcoat 240, Bulletproof 84)**. Sheet counts, and
    Lesson 3 bites hardest on Poison Touch: it fires only on CONTACT moves, so a special attacker
    carrying it contributes to the 947 and never triggers.
13. **`clearsBoosts` — 542 (Haze).** `playerAction` resolves it to `kind: pass`, so Haze is a wasted
    turn in every rollout.
14. **`partialTrap` 772, `terrainScaled` 296, `cantUseTwice` 186, `untagged`/Marvel Scale.** Real
    but small. Infestation lands its 8 damage and then chips nothing at all; Spiky Shield (item 6)
    blocks correctly and then punishes nothing — both probes print which half happened, so neither
    can be confused with a move that never resolved.
15. **`formeChange` / Disguise — 111 sheet uses, and the count badly understates it.** Mimikyu
    appeared in three of the residual differential rows across four seeds, because every Mimikyu that
    appears at all uses Disguise on turn one. Note the artifact will not hand this to you:
    `disguise.tags` is `["preventsCrit","formeChange"]`, and `preventsCrit` also holds Battle Armor,
    Shell Armor and Ice Face.

**The second block, found by walking further down the same list.** Smaller individually, and three
of them are whole categories of turn the engine cannot represent at all:

16. **`forcesSwitch` — 513 (Roar 400, Dragon Tail 96).** The move deals its 69 damage and the drag
    does not happen, so a phazing turn is priced as a weak attack.
17. **`noRecoil` — 731 (Rock Head)**, **`curesVolatile` — 665 (Mental Herb)**,
    **`blocksExplosion` — 545 (Damp)**, **`ignoresTypeImmunity` — 469 (Scrappy)**,
    **`reordersTurn` — 463 (After You 148, Instruct 162, Quash 153)**. All sheet or click counts,
    all read identical across the knob.
18. **`userFaints` — 338.** Explosion leaves its user on full HP. **`crashOnMiss` — 199**: High Jump
    Kick misses correctly and costs nothing. **`hazard` — 195**: the switch happens and Stealth Rock
    chips a 4x-weak Staraptor for zero.
19. **`typeBecomesMoveType` — 248 (Protean)**, **`ignoresDefenderAbility` — 212 (Mold Breaker,
    verified against a Levitate hard zero)**, **`blocksHealing` — 196 (Psychic Noise)**,
    **`curesStatus` — 208 (Lum Berry 175)**.
20. **`multiAccuracy` — 907 (Triple Axel 522, Population Bomb 385), and it hides a second bug.**
    Three 90% rolls compound to about 73%, and `moveAccuracy('tripleaxel')` returns **100** — so the
    printed accuracy is wrong before the per-hit rule is even considered.
21. **`alwaysCrit` — 274 (Flower Trick 216).** Same design question as `critRatioUp` below, not a
    separate decision.

## THE CRIT VERDICT — it WAS a bug, it is fixed, and here is the exposure. 2026-08-04.

The previous pass wrote *"`critRatioUp` may not be a bug — `dmgRange` models no crit anywhere"*. That
was half right in a way that hid the real defect: **the BATTLE LOOP has always rolled a crit**, a flat
`rng() < 1/24` for every move and every defender. So the engine had two crit facts and both were
wrong, in opposite directions.

**Measured before anything was touched, the way the terrain vocabulary was.** Over **48,274 stored
games**, **7.53%** carry a crit-tag move on an observed set — **1.68%** an `alwaysCrit` move and
**5.98%** a `critRatioUp` one. `preventsCrit` outside Disguise (Shell Armor, Battle Armor, Ice Face)
is **41 games, 0.08%**. By clicks: `alwaysCrit` **278** (Flower Trick 219, Frost Breath 40, Storm
Throw 19), `critRatioUp` **1,162** (Psycho Cut 276, Leaf Blade 169, Stone Edge 169, …).

**The two halves are not the same size of error and do not belong in the same place.**

- `alwaysCrit` is a **certainty**: a flat x1.5 the pricer was missing on every one of 278 clicks, so
  Flower Trick was priced 33% below what it does. It belongs in `dmgRange`, and it is what Showdown's
  own `willCrit` does — so the differential AGREES with it once its control is right.
- `critRatioUp` is a **RATE**, 1/24 to 1/8, an expectation difference of about 4%. It must NOT go in
  `dmgRange`: folding an expectation into a min/max stops `max` being the maximum roll and puts every
  ratio move permanently out of step with the differential's non-crit comparison. It rides the battle
  loop's roll, which is where the 1/24 already lived.
- **Shell Armor did nothing whatever**, and now turns both off.

Landed as **WIRE 35**, with one `critChance()` that every caller reads. The two ABILITY carriers of
`critRatioUp` are **deliberately refused and counted** (`MEDFAILS.critRatioAbility`, 15 corpus uses):
the tag's only param is `critRatio: 2`, which cannot express Merciless's condition — a GUARANTEED crit
into a poisoned target, not a permanent stage bump — and Super Luck, which genuinely is a permanent
bump, is indistinguishable from it in the artifact. Wiring both would hand Merciless an unconditional
1/8 it never has. Scope Lens (an ITEM, unconditional) IS wired.

**THE PROBE HAD TO BE REWRITTEN, and that is the actual answer to "is it a bug".** It read
`dmgRange(Night Slash) > dmgRange(the same move with its id changed)` — it was asking the PRICER for
an expectation, which is the thing that must not happen. It is now behavioural and pinned at a roll
that SEPARATES the rates: **0.1 is below 1/8 (0.125) and above 1/24 (0.0417)**, so a base-rate move
cannot crit on it and a one-stage move must. Four arms, because two cannot attribute it — Shell Armor
is the discriminator on the ratio move, and **Crunch** (Dark, physical, same attacker, same target, no
crit ratio) is the control that must not move at all. An engine that simply raised the base rate for
everything passes a two-armed version and fails this one. Reads
`Night Slash plain 100 / Shell Armor 67  |  Crunch plain 77 / Shell Armor 77`.

**THE DIFFERENTIAL WENT 1/400 TO 5/400 THE MOMENT THE ENGINE LEARNED THE MECHANIC, AND THE HARNESS
WAS WRONG.** Four of the five new rows were Flower Trick and Frost Breath with MEDICHAM exactly 1.5x
above the reference, because `test-engine-diff.js` pinned `move.willCrit = false` — right for a random
crit, which is noise both engines must be held to, and wrong for the three moves whose crit is not
random at all. **CONTROL FIX 11** pins it to the move's own dex value, so it now only ever CLEARS a
crit that would otherwise be rolled. Back to **1/400** at seed 20260804, same single SUSPECT row.

**`preventsCrit` (151 uses) had never been probed at all** and now is, through the sharpest available
form: Flower Trick's max into a plain Garchomp against the same into a Shell Armor one, with a third
arm carrying no crit tag to show the plain number really is the un-crit one. `plain 123, Shell Armor
82, no crit tag 82`.

**One that is still NOT a one-line fix, called out so nobody starts it by accident:**

- **`writesAccuracy` (987) and `accuracyMod` (927) are blocked on a signature, and the cost is now
  stated rather than gestured at.** `moveAccuracy(id, field)` takes neither the attacker nor the
  defender, so No Guard, Compound Eyes, Sand Veil and Snow Cloak have nowhere to be read from. Both
  probes clear their control — the No Guard one pins the roll at 0.9 against 80% accuracy, so the
  control correctly MISSES — and both still read identical across the knob, which by Lesson 5 means
  unwired rather than unimportant.
  **What the change costs: 11 call sites across 4 files.** Inside `medicham2-browser.js`,
  `moveAccuracy` is read by `playerAction` (which has both bodies), the battle loop's to-hit roll
  (both), the `affect` branch's status roll (both), the status branch (both), `bestMoveVs` (both) and
  `expectedHitsOf` (**neither** — it is called from `dmgRange`, which is pure and is handed no field).
  `engine/exposure.js`, `engine/board.js` and `engine/position_features.js` each call it too, and the
  last two are **not ENGINE's** — a signature change there is a feature-vector change and therefore
  the refit edge MEASURE owns. The compatible shape is `moveAccuracy(id, field, att, def)` with both
  optional, which leaves every existing caller correct and lets the six that have the bodies pass
  them; `expectedHitsOf` would keep the two-argument form and the ability would simply not apply
  there, which is honest because a pure pricing function has no attacker. **It is a deliberate pass,
  not a one-liner, and it should not be started inside another division's run.**

- **`needsTargetToAttack` / Avalanche — VERDICT: the probe asks for a rule that does not exist, and it
  is left MISSING on purpose.** Avalanche doubles when the USER was damaged BY THAT TARGET THIS TURN.
  The probe compares a fresh body against one whose `curHP` was halved — i.e. it asks `dmgRange` to
  double on "the user is below full HP", which is not the mechanic and would be a new wrong number on
  every hurt Avalanche user. `dmgRange` is handed no turn state and must not invent any; the tag's
  own param is the prose string `"target attacking"`. **13 corpus uses.** The nine other members of
  the tag include Sucker Punch (6,673), which is already fully modelled through
  `failsIfTargetNotAttacking` — so the tag is not inert, only this member is.

## Ordering the queue

`tests/mechanics_rank.js` ranks unread tags by corpus usage — use it, not intuition, and read the
result against Lesson 3: **usage counts are sheet counts.** Blaze reads 4,585 uses and is worthless
because 30 of 54 entries are a Charizard that megas into Drought on turn one. Ice Scales, Filter,
Aerilate, Prism Armor, Punk Rock and Ripen read zero.

The damage disagreements in the generated block are ordered by `uses` for the same reason, and carry
the same caveat.

## Before wiring a new derived tag

Print what it matched. Every derivation over-matches on the first try — `refusesStatusMoves` caught
Telepathy and Wonder Guard, `speedOnItemLoss` caught Sticky Hold, `failsIfTargetNotAttacking` caught
Quick Guard, Wide Guard and Round. See `docs/LESSONS.md` §4.

## Done looks like

- The census `live` count is higher than it was.
- No probe that passed yesterday fails today.
- The differential test finds fewer disagreements **at the same `--seed` and `--n`**, or the same
  ones with smaller error. Quoting a residual without its seed is quoting a coin flip: the sampler
  used bare `Math.random()` until 2026-08-04, and two runs on identical source gave 6 and then 3.
- Nothing in the hand list above that has not become a probe.

**`missing` going UP is not a regression, and this is the one place the rule is easy to misread.**
It rose 12 → 42 on 2026-08-04 while `live` rose 42 → 100, because 88 probes were written for
mechanics nobody had asked about before. The number that may never fall is `live`. A rising `missing`
means the census stopped flattering the engine.

## The one thing this division owes the others

A **named engine release**. Fixes batch; the release is what triggers the refit and the restamps —
see [DIVISIONS.md](DIVISIONS.md). Landing engine changes continuously is what leaves SEARCH
measuring a build that no longer exists.
