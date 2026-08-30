# G6 AND G8 ARE TWO FIXES, G6 IS NOT THE STANDING DISGUISE DEFECT, AND THE BERRY FIX HAD NOT TOUCHED G8

**2026-08-30. ENGINE. Both landed, both probed, both shown red under their own knob first.**

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 810 probed / 810 live / 0 missing | **812 / 812 / 0** |
| empirical protocol-diverged games | 181 of 961 | **175** |
| empirical board-parted | 84 of 961 | **84 — unmoved, as predicted** |
| `ordering` class, games | 31 | **24** |
| end-state verdicts | 903 / 55 / 2 / 0 / 1 | **903 / 55 / 2 / 0 / 1 — identical** |
| engine release | `a18431d6dbe2` | **`68c90b3b9f17`** |

---

## 0. THE PREDICTION, WRITTEN TO DISK BEFORE THE RUN

`data/verification/prediction-formeoneat.json`, stamped 14:16Z; the differential started at 14:22Z.

| | baseline | predicted | accepted band | **measured** |
|---|---|---|---|---|
| protocol-diverged games | 181 | **175** | 172–179 | **175** |
| board-parted games | 84 | **84 — unmoved** | 82–85 | **84** |
| `ordering` class, games | 31 | **24** | 22–26 | **24** |
| end-state verdicts | 903 / 55 / 2 / 0 / 1 | **identical** | identical | **identical** |

**Four for four, all at the point estimate.**

**Which scoreboard, said in advance.** Both mechanics are line-ORDER defects with no HP consequence —
the busted-disguise reveal already landed on the right HP (114/130 either way, asserted by the probe's
own arithmetic control) and Cheek Pouch's final HP was never wrong (568/596 either way). The
2026-08-29 breakdown flags one of G6's four games as board-material and explicitly declines to
attribute it. So the board was predicted UNMOVED and the protocol to move, which the brief also asked
for in advance.

**Why a band on protocol.** Seven cause strings leave, but at least one of the seven games was expected
to resurface later: dump row 85's stream, once realigned, continues to a Rising Voltage this engine
kills Charizard with (`0 fnt`) where the authority leaves it on 55/153. **That game did resurface, on
exactly that line.**

---

## 1. ONE FIX OR TWO — MEASURED, NOT ARGUED

**TWO.** The 2×2 over the two revert knobs, one staged board per defect, asserted on the FULL canonical
line arrays and not on the shape strings:

```
                              G6 board (Heat Wave / Disguise)   G8 board (Sitrus / Cheek Pouch)
  neither                     VZXDC     CORRECT                 BIP   CORRECT
  MEDI_FORME_BUST_INLINE      VZDCX     WRONG                   BIP   CORRECT
  MEDI_EATREACT_BEFORE_BERRY  VZXDC     CORRECT                 PBI   WRONG
  both                        VZDCX     WRONG                   PBI   WRONG
```

V = the `-activate`, Z = the holder's zero-damage line, X = what the move still owed (here the other
spread target's `-damage`), D = `detailschange`, C = the `maxhp/8` chip; B = `-enditem [eat]`,
I = the berry's own `-heal [from] item`, P = Cheek Pouch's `-heal`.

Each knob moves its own board and leaves the other **byte-identical under both settings of the other**.
The census agrees in both directions: each knob takes exactly its own probe MISSING (811 live / 1
missing) and leaves the other LIVE, and both are registered in `DELIBERATE_BREAK`, so both runs
REFUSED to write the census and the message named the right `MEDFAILS` key.

They are two mechanics on two hooks in two files. There was never a shared cause to find.

## 2. G6 IS **NOT** THE STANDING DISGUISE DEFECT — THAT ONE IS CLOSED AND PROBED

The brief flagged a standing open defect that *Disguise fires on the already-busted forme*. That is
**ROADMAP #392**, and it is **CLOSED (2026-08-23)**. It is carried live in the census today as
`ability / formeOnHit / a body that is ALREADY the busted forme absorbs nothing`, and `open_work.js`
does not list it.

The two claims are different questions about the same ability:

| | #392 | G6 |
|---|---|---|
| asks | **WHO** the absorb refuses | **WHERE** the reveal is written |
| handler | `onEffectiveness` (the Champions override) | `onUpdate` (inherited) |
| symptom | a body built from the observed key `mimikyubusted` swallowed a hit whole | `detailschange` came out above the other spread target's damage |

**Nor is it ROADMAP #505.** `sim/pokemon.ts:1564` `clearVolatile`'s closing `setSpecies(baseSpecies)`
reverts a NON-permanent forme, and #505's own row already says a permanent one is exempt. Disguise's
`onUpdate` calls `pokemon.formeChange(speciesid, this.effect, true)` — the third argument **is**
`isPermanent`, so this forme is in the exempt set and #505 cannot reach it. **A second, independent
defect.**

## 3. G8 WAS RE-MEASURED ON THE CURRENT TREE, AS THE BRIEF ASKED

The berry fix that landed on 2026-08-30 (`item/resistBerryAtCalculation`) had **not** changed G8's
shape. Re-read from the `a18431d6dbe2` dump: **the same three games and the same three cause strings**,
rows 50, 143 and 162, all `|-enditem|…|sitrusberry|[eat] <> |-heal|…|[from]cheekpouch`.

**That is the right answer rather than a coincidence, and the two are on different roads.** The resist
berry never went through `consumeBerry` at all — its site writes its own `[eat]`/`[weaken]` pair and
empties the hand directly (which is a defect of its own, filed below). G8 is the `onUpdate` pinch
berry, the `berryPinchUpdate` road, and nothing in the earlier batch touched it.

## 4. THE AUTHORITY'S TWO STATEMENTS — CHAMPIONS CHECKED FIRST, BOTH TIMES

- **Disguise.** `data/mods/champions/abilities.ts:14` declares `disguise: { inherit: true,
  onEffectiveness(...) }` — it replaces `onEffectiveness` and **nothing else**, so `onDamage`
  (`data/abilities.ts:962-967`) and `onUpdate` (`:991-997`) are the mainline bodies. `onDamage`
  writes the `-activate`, sets `busted` and **returns 0**, inside `spreadDamage`. `onUpdate` performs
  the `formeChange` and then `this.damage(pokemon.baseMaxhp / 8, ...)`, and it is raised by
  `eachEvent('Update')` at the **foot of the hit iteration** —
  `data/mods/champions/scripts.ts:538`, which is below the whole of `spreadMoveHit`: below every other
  spread target's `-damage` (`:368`), below `runMoveEffects` (`:373`) and below `secondaries` (`:386`).
- **Cheek Pouch.** `data/mods/champions/abilities.ts` carries **no `cheekpouch` key at all**, so the
  whole thing is inherited: `onEatItem(item, pokemon) { this.heal(pokemon.baseMaxhp / 3); }`
  (`data/abilities.ts:483-485`). `Pokemon#eatItem` is one straight line — `-enditem [eat]` (`:1789`),
  `singleEvent('Eat')` (`:1791`, the BERRY), `runEvent('EatItem')` (`:1792`, CHEEK POUCH), then the
  slot is cleared (`:1806-1808`) and `AfterUseItem` reaches Symbiosis (`:1809`).

## 5. WHAT MOVED IN THE ENGINE

**G6.** The single-arrival road's `dmg=_abs.chip; TR.dmg(tg); _bust();` becomes `dmg=0` plus a
move-scoped `_bustPending`, flushed at `_stepUpdate`. Three things fall out of that and each is the
authority rather than bookkeeping:

- **`dmg` goes to ZERO, not to the chip.** `onDamage` returns 0, so `damage[i]` is 0 and the eighth is
  a separate `this.damage(baseMaxhp/8, pokemon, pokemon, species)` whose source effect is a SPECIES
  and not a Move — which is why no Focus Sash, no Endure and no recoil may answer it. Those three
  blocks sit below this one and read `dmg`. Strictly closer to the authority than the old value, and
  it is a state change rather than a line move, so it is said out loud.
- **The zero-damage line is no longer emitted at the absorb site.** With `dmg` at zero, the shared
  `tg.curHP-=dmg` / `TR.dmg(tg,_cf)` pair below emits exactly it, at unchanged HP with `_chipFrom`
  still null. One emitter, not two — the first version of #526's fix printed that line twice.
- **`_stepUpdate` pays it ABOVE `_updateEvent`**, because Showdown's `findPokemonEventHandlers`
  collects a body's handlers ability-first, so the forme change and its chip precede a pinch berry in
  the one pass. That is the same order the between-arrival seam already used, and both call the same
  closure `_stepApply` built — so a volley and a single hit cannot come to rename the forme
  differently.

**The pending is counted at both ends.** `MEDSEEN.formeAbsorbBustAtUpdate` (decided) and
`formeAbsorbBustPaidAtUpdate` (paid) must be equal, and `MEDFAILS.formeBustPendingUnpaid` catches a
body left renamed with no `detailschange` — which is not expected, since the driver's backstop calls
`_stepUpdate` unconditionally.

**G8.** `consumeBerry` is `Pokemon#eatItem`'s body now, in its order, and takes the caller's `onEat`
closure. **The `-enditem` line moved INSIDE it.** That is the load-bearing half: four callers each
writing their own line is four chances to write it on the wrong side of the eat, and three of the four
had. `EatItem` (Cheek Pouch, Cud Chew — one hook, so one position) now runs below the effect;
`AfterUseItem` (Symbiosis) stays last, where it already was.

**One caller was already right and is the over-fire control.** `berryCureUpdate` wrote its `-enditem`
and `-curestatus` above the call, so the status-berry road already read `B S P`. It is routed through
`onEat` anyway, so the position is stated in one place rather than held by three callers agreeing with
a fourth by accident — and the probe asserts it did not move.

**No HP moved.** Both probes assert it: Mimikyu ends on 114/130 on the spread arm and the plain arm,
and the Cheek Pouch body ends on 568/596 with the fix and without it. What moved on G8 besides the
order is what the berry's own `-heal` line SAYS: 370/596 now, 568/596 before — the post-both total,
which is the second half of the same defect and is asserted against the no-ability control.

## 6. THE PROBES — RED FIRST, WITH THE OVER-FIRE CONTROLS THAT MUST NOT MOVE

Both were written and shown RED before a line of engine changed:

```
MISSING  formeOnHit          ... Heat Wave "VZDCX", Moonblast "VZDCX", Throat Chop "VZDCX"  (must be VZXDC)
MISSING  healsOnBerryEaten   ... "PBI" must be BIP; the item line reads 568 against a control 370
```

**`ability/formeOnHit`**, five arms, all through `battleInit` / `battleTurn`.

- TESTS, all three must read `VZXDC`: **Heat Wave** into a Disguise Mimikyu beside another foe (the
  other target's `-damage`), **Moonblast** (a 100% SpA-drop secondary), **Throat Chop** (an `onHit`
  `-start`). Those are the three shapes the four pool games take.
- **OVER-FIRE CONTROL 1: a plain single-target click with nothing owed after the damage** must stay
  `VZDC`. A fix that deferred the reveal to the end of the TURN rather than to the move's `Update`
  passes every test arm and fails this one.
- **OVER-FIRE CONTROL 2: a multi-arrival volley** (Dual Wingbeat) must stay `VZDCZ` — its bust has
  fired at the between-arrival `Update` seam since ROADMAP #526, which is the same event, and must not
  be dragged to the foot of the move.
- **ARITHMETIC CONTROL:** the holder ends on `maxhp - maxhp/8` on the spread arm and the plain arm.

**`ability/healsOnBerryEaten`**, four arms.

- TEST: Cheek Pouch + Sitrus must read `BIP`. `PBI` is the defect, three games of the pool. **And the
  berry's own line must report the berry's own HP** — equal to the no-ability control's, which is what
  says the two heals are no longer one lump.
- **OVER-FIRE CONTROLS:** the same body with no ability (`BI`), with an EMPTY HAND (no line at all),
  and **the STATUS-berry road** (`BSP`), which was already in the authority's order and must not move.

## 7. THE EMPIRICAL ARM — ATTRIBUTED, NOT ASSUMED

**Exactly seven causes removed and every one names one of the two mechanisms:**

```
  four Disguise rows      |-unboost|p1b|spa|1     <> |detailschange|p1b|mimikyubusted,l50
                          |-damage|p2b|H/H        <> |detailschange|p2a|mimikyubusted,l50   (x2)
                          |-start|p2a|throatchop  <> |detailschange|p2a|mimikyubusted,l50
  three Cheek Pouch rows  |-enditem|…|sitrusberry|[eat] <> |-heal|…|[from]cheekpouch        (x3)
```

**One cause added, and it is one of the seven games diverging later:**

```
  + event missing from medicham2 :: |-damage|p1a|H/H <> |-damage|p1a|0fnt
```

That is dump row 85 — the Rising Voltage KO named in the prediction before the run.

```
  ordering                        31 -> 24     exactly the seven
  event missing from medicham2    53 -> 54     one of the seven resurfaced later
  every other class                unchanged
  TOTAL                          181 -> 175
```

**Sample identity checked rather than assumed:** 961 games both runs, `turns_cap` 12, arm `middle`,
steering `empirical-click/v1`, census pin `9446a684709d`, pool digest `0d103fb9fa87`,
`closet.teams_dropped` 43, `coverage.exercised` 556 of 580, `state.not_compared` 5, `mid_void` 9,
`order_probe` 2 rows both, `mode` string identical. **`engine/arms_comparable.js` reports COMPARABLE.**

Artifacts: `data/verification/game-differential.formeoneat.json` and
`data/verification/divergence-turns.formeoneat.json`, release **`68c90b3b9f17`**, pool
`data/team-pool-frozen`, `--dump-games 250` (166 of 175). **`data/game-differential.json` was NOT
touched** — its mtime is still 2026-08-28 23:14; `--out` redirects the write.

**A METHOD NOTE THAT COST TWO RUNS AND IS WORTH WRITING DOWN.** `--out` redirects the artifact but
does **not** imply `--write`, and `--state` / `--end-state` are their own flags. A run without them
completes, exits 0, writes the DUMP and writes no artifact at all; a run with `--write` but without
`--end-state` writes an artifact whose `state` block is `null` and whose `diverged` is 177 rather
than 175, because the end-state comparison is what marks one game THREW. **Two arms that differ in
`--end-state` are not comparable on `diverged`**, and the baseline this batch is measured against ran
with it.

## 8. TWO PRE-EXISTING REDS — NEITHER IS THIS BATCH'S, BOTH SHOWN SO

**`tests/probe_red_demo.js`** reads the inherited set unchanged: **5 COULD NOT BE APPLIED and 1
HOLLOW of 200**, and the five are the same five by name as at HEAD (WIRE 117 Psychic Terrain, ROADMAP
#81 WIRE 2, WIRE 7 mega stone, WIRE 8 ×2). Neither of this batch's edits is anchored by any demo.

**`tests/probe_upkeep_lines.js` is RED at 4 of 49 arms and it is NOT this batch's.** Proven with a
knob-cleared control rather than argued:

| arm | run |
|---|---|
| live tree, release `68c90b3b9f17` | 4 not as expected — A TEST, C hungerswitch, C whiteherb, D uproar |
| **both knobs restored** (`MEDI_FORME_BUST_INLINE=1 MEDI_EATREACT_BEFORE_BERRY=1`) | **character-identical** |

The same four by name as the 2026-08-30 packet-timing baseline. All four are the perish/upkeep
faint-drain boundary.

**ROADMAP #440's closet row still holds.** This batch does not touch the drain: the G6 edit is inside
`_stepApply` / `_stepUpdate`, both of which are inside the move's step list and above `_stepFaint`,
and the G8 edit is inside `consumeBerry`, which the residual calls but which writes no faint and reads
no queue. Its cause string appears in neither the added nor the removed set of the dump diff, and the
knob-cleared control above is the same evidence from the other direction. **Falsifier (b) — the
COVERAGE arm of `data/game-differential.json` — remains undecided, exactly as it was**: that artifact
is still stale on `e129bca605e3` and was deliberately not republished.

## 9. WHAT WAS RUN

| | |
|---|---|
| `tests/test-mechanics.js` | **exit 0, 812/812/0**, hollow 0, unarmed 0, threw 0 |
| under each knob | census REFUSED, correct probe MISSING, the other LIVE (811/1 both ways) |
| the 2×2 over both knobs | each moves its own board, leaves the other byte-identical |
| `tests/test-resolution-order.js` | PASS, 26 arms, 0 KNOWN-OPEN, 0 failing |
| `tests/probe_multihit_update.js` | PASS |
| `tests/probe_multihit_corners.js` | PASS |
| `tests/probe_volley_collapse.js` | PASS (3 declared-open ENDURE rows, unchanged) |
| `tests/probe_punish_announce.js` | PASS |
| `tests/probe_recoil_after_clamp.js` | PASS |
| `tests/probe_innards_out.js` | PASS |
| `tests/probe_knockoff_megastone.js` | PASS |
| `tests/probe_hp_pair.js` | PASS |
| `tests/test-end-state.js` | PASS |
| `tests/test-engine-consistency.js` | PASS |
| `tests/test-seed-clock.js` | PASS (134/0) |
| `tests/probe_turn_order.js` | PASS (12 staged, 0 not matching) |
| `tests/probe_endturn_clock_order.js` | PASS (7 arms, 1 KNOWN-OPEN declared) |
| `tests/probe_residual_shadow.js` | PASS |
| `tests/test-residual-order-observed.js` / `-population.js` | PASS |
| `tests/test-perish-song.js` | PASS |
| `tests/test-forme-assert.js` | PASS — 6 of 6 rows agree on all four assertions |
| `tests/test-wiring.js` | every capability proved it ran |
| empirical whole-game differential | above |

## OWED, NOT RUN

- **A NEWLY-MEASURED GAP THIS BATCH'S READING EXPOSED AND DID NOT FIX: three berry-eating roads never
  raise `EatItem` at all.** The authority's `onSourceModifyDamage` calls `target.eatItem()`, which is
  the WHOLE of `eatItem` — so a type-resist berry eaten under Cheek Pouch heals a third. This engine's
  resist-berry site writes its own `[eat]`/`[weaken]` pair and empties the hand directly, never
  through `consumeBerry`. **Measured on a staged board, not reasoned**: Close Combat into a Cheek
  Pouch Maushold holding a Chople Berry emits `-enditem [eat]`, `-enditem [weaken]`, `-damage` and
  **no `-heal`**. `itemCuresVolatile` (a Persim/Lum spent on confusion) is the same shape. Cud Chew,
  Symbiosis and the `_lastItem` / `_ateBerry` record Harvest and Belch read are all owed on the same
  roads. Its own batch, because it changes HP.
- **A POOL-SCALE READING OF THE FOUR NEW COUNTERS.** `MEDSEEN.formeAbsorbBustAtUpdate`,
  `formeAbsorbBustPaidAtUpdate`, `berryEatReactionAfterEffect` and `MEDFAILS.formeBustPendingUnpaid`
  have only ever been read on a staged board — `game_differential.js` surfaces no `MEDSEEN`. The seven
  removed causes are the pool-scale evidence that both roads ran; they are not the counters.
- **THE ROSTER, ALL THREE STAGES, AND `data/all-mechanics-fire.json`.** Still on `e129bca605e3` and
  WITHHELD by the release-mismatch clause, which now predates this batch by three releases.
- **THE COVERAGE ARM of the whole-game differential** (`data/game-differential.json`). Stale on
  `e129bca605e3` and already withheld by `status.js` before this batch. It is falsifier (b) of the
  closeted ROADMAP #440 row, so that clause remains undecided.
- **`tests/test-engine-diff.js`** — not run, deliberately: it has no `--out` and would republish
  `data/engine-diff.json`. It calls `moveHit` ONCE and no damage number moved in this batch.
- **THE THREE HAND-LIST ROWS CARRIED FORWARD FROM THE PACKET-TIMING BATCH**, each its own batch: the
  volley halving every arrival against a resist berry; the drain heal paid per row rather than per
  hit; and an attacker killed by an interior arrival's toll not stopping the volley.
- **TRIPLE AXEL INTO AN INTACT DISGUISE DEALS ZERO ON ARRIVALS 2 AND 3.** Seen while choosing this
  batch's volley control and NOT diagnosed here; it is the `formeAbsorbPerHitPlan` remainder ROADMAP
  #526 already declared open by name. Dual Wingbeat, which takes the addressable road, is correct and
  is what the probe uses.
