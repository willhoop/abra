# The crit die is rolled once per HIT by the authority and was rolled once per CLICK here

ENGINE, 2026-08-27. Landed. Register rows ROADMAP **#499 — CLOSED**, **#500 — FILED**.
CHANGELOG 5.184.0. Measured on engine release **`6ed5d6734c80`**.

---

## 1. THE HEADLINE — DAMAGE AT ALL SIXTEEN CORNERS, BEFORE AND AFTER

`SHOWDOWN_PATH=... node tests/test-engine-diff.js --n 6000`, seed 20260804, the same seed both times.

```
                BEFORE (artifact 2026-08-27T17:31:11Z)     AFTER (artifact 2026-08-27T19:41:01Z)
top             0/6000                                     0/6000
bottom          0/6000                                     0/6000
idx01           0/6000                                     0/6000
idx02           0/6000                                     0/6000
idx03           0/6000                                     0/6000
idx04           0/6000                                     0/6000
idx05           0/6000                                     0/6000
idx06           0/6000                                     0/6000
idx07           0/6000                                     0/6000
idx08           0/6000                                     0/6000
idx09           0/6000                                     0/6000
idx10           0/6000                                     0/6000
idx11           0/6000                                     0/6000
idx12           0/6000                                     0/6000
idx13           0/6000                                     0/6000
idx14           0/6000                                     0/6000

compared        6000 / agreed 6000 / disagreed 0            6000 / 6000 / 0
skipped_multihit  134                                       134
skipped_non_finite 0, threw 0                                0, 0
```

**PREDICTED BEFORE THE RUN, AND THE PREDICTION HAS A REASON RATHER THAN A HOPE.** Two independent
things make this instrument blind to a per-hit crit:

1. **It skips multi-hit moves outright** — `skipped_multihit` reads 134 in both artifacts, and a
   per-hit crit can only differ from a per-click crit on a volley.
2. **Every arm is a pinned CORNER**, so the crit stream returns the same value for every draw of a
   click. Per-arrival and per-click decisions therefore coincide by construction at all sixteen
   indices, exactly as ROADMAP #322's own header says the per-arrival *damage* index does.

So a movement here would have been a finding in its own right, and there is none.

---

## 2. THE PROBE, RED THEN GREEN THEN RED AGAIN

`tests/probe_hp_pair.js`, written by the diagnosing pass, unpiped every time (a `| tail` returns
TAIL's exit code, which is how a red test was briefly believed to exit 0 earlier the same night).

```
BEFORE                                                                    exit 1, 8 FAILURES
  CONTROL single hit  Psychic Fangs   authority [85*]        ours [85*]          draws 1 / 1
  THE OBSERVED PAIR   Dual Wingbeat x2 authority [60* 40]     ours [60* 60*]      draws 2 / 1
  the other dmgRange  Triple Axel x3   authority [36* 45 67]  ours [36* 67* 100*] draws 3 / 1

AFTER                                                                     exit 0, all rows agree
  CONTROL single hit  Psychic Fangs   authority [85*]        ours [85*]          draws 1 / 1
  THE OBSERVED PAIR   Dual Wingbeat x2 authority [60* 40]     ours [60* 40]       draws 2 / 2
  the other dmgRange  Triple Axel x3   authority [36* 45 67]  ours [36* 45 67]    draws 3 / 3

MEDI_CRIT_ONCE_PER_CLICK=1                                                exit 1, 8 FAILURES
  the IDENTICAL eight failures with the IDENTICAL numbers as BEFORE
```

The knob is a **restore**, proven rather than asserted: not merely red, but the same red. A knob
whose two arms agree is unwired; a knob whose red arm differs from the original defect is a third
behaviour wearing the defect's name.

**THE KNOB IS THE HIT COUNT.** The authority's draw count moves 1 → 2 → 3 with it. Before the fix
this engine sat pinned at 1 across all three rows — identical output across a varied knob, which is
the unwired signature and not evidence that the knob does not matter.

---

## 3. THE PINNED POOL

Release `6ed5d6734c80`, arm `middle`, `--games 1200` (yields 961), `--turns 12`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`,
`--state --end-state`. Both figures read out of `data/game-differential.json`, never off stdout.

```
                              BEFORE (release 9dc79a4d459b)   AFTER (release 6ed5d6734c80)
games                         961                             961
raw diverged                  14                              12
declared (the `fallenundefined` family, the authority's own typo)
                              5                               5
WHOLE-GAME  = raw − declared  9                               7        PREDICTED
state.games_board_never_diverged
                              954                             956
BOARD-MATERIAL = 961 − that   7                               5        PREDICTED
threw                         0                               0
pin digest                    44bd49403231                    44bd49403231   (unmoved, argued below)
team pool digest              0d103fb9fa87                    0d103fb9fa87   (the same sample)
```

**THE TWO ROWS THAT CLOSED**, both `unrelated event mismatch :: |-damage|p1a|H/H <> |-crit|p1a` at
turn 5, second arrival of a two-hit Dual Wingbeat off `p2b: Aerodactyl`:

```
seed ...-2656492881 vs ...-2656780112   p1.party.glimmora.hp   medicham 109  showdown 117
seed ...-2657375767 vs ...-2657339156   p1.party.tyranitar.hp  medicham  89  showdown  98
```

**THE FIVE THAT REMAIN**, unchanged in seed, turn and diff, and none of them is this:

```
t3   ...-2654113586   p1.active[0].vol.confusion       medicham 2          showdown 5
t7   ...-2655780718   p2.party.gardevoir.ability       medicham goodasgold showdown innerfocus
t12  ...-2657831051   p1.party.meowscarada.types       medicham ice        showdown dark/grass
t6   ...-2662482898   p2.party.diggersby.status        medicham par        showdown ""
t2   ...-2635122796   -damage: a different body                            (ROADMAP #478)
```

**THE POOL CACHE MISSED AND THE SAMPLE DID NOT MOVE.** The run reported `pool cache MISS —
rebuilding from the store`, because the live store moved under an OPS ingest. That rebuilds a CACHE;
the pinned selection is unchanged, and the proof is the pool digest — `0d103fb9fa87` in both
artifacts, 1968 teams picked from a corpus of 8778, `PINNED to data/team-pool-frozen`. This is
checked rather than assumed because CLAUDE.md records a run withdrawn for exactly this: 897/205 and
982/182 an hour apart were not two samples of one question.

---

## 4. WHAT THE AUTHORITY DOES, READ NOT RECALLED

`data/mods/champions/scripts.ts` overrides exactly the hit LOOP and `spreadMoveHit`, and overrides
**neither `getSpreadDamage` nor `getDamage`** — so the loop is the mod's and the die is mainline's,
inside the per-hit call:

```
data/mods/champions/scripts.ts:461   for (hit = 1; hit <= targetHits; hit++) {
data/mods/champions/scripts.ts:518     [moveDamageThisHit, targetsCopy] = this.spreadMoveHit(...)
data/mods/champions/scripts.ts:361       damage = this.getSpreadDamage(damage, targets, ...)
sim/battle-actions.ts:1156                 const curDamage = this.getDamage(source, target, moveData);
sim/battle-actions.ts:1637                   const moveHit = target.getMoveHitData(move);
sim/battle-actions.ts:1638                   moveHit.crit = move.willCrit || false;
sim/battle-actions.ts:1639-42                if (move.willCrit === undefined)
                                               if (critRatio) moveHit.crit = randomChance(1, critMult[critRatio]);
sim/battle-actions.ts:1633                 critMult = [0, 24, 8, 2, 1]        (the gen 9 branch)
sim/dex-moves.ts:486                       this.critRatio = Number(data.critRatio) || 1   -> critMult[1] = 1/24
sim/battle.ts:350                          randomChance() calls this.prng DIRECTLY — not via battle.random
```

**N hits spend N crit draws**, each re-writing `getMoveHitData(move).crit`, which `modifyDamage`
reads at `scripts.ts:220` and announces at `:285`.

**THE ENGINE HAD ALREADY DECLARED THE GAP AND NOTHING PRINTED IT.** ROADMAP #322's header in
`engine/medicham2-browser.js`:

> *"The CRIT ITSELF is still one decision for the whole volley; the authority rolls it per hit too,
> and that is a separate defect which this wire deliberately does not touch rather than bundle."*

There was **no register row**, so `open_work.js` — which prints unclosed register rows plus the
defects an instrument measures — could list neither half. A defect living only in a source comment is
invisible to every list this project has. That is the fourteen-stale-handoffs shape in a new costume,
and it is why the row was written before the fix.

---

## 5. THE PATCH AS APPLIED, AND WHERE IT DEPARTS FROM THE DIAGNOSIS

The diagnosis located it correctly and could not test its own edit. Three of its four points landed
as written; the fourth did not fit what is actually there, and this is that difference.

**(A) The plain packet bands are snapshotted immediately after `let d=_price(false)`.** As located.
Both of `dmgRange`'s paths blow `hit.packets` away and rebuild it, so the plain and crit sets have to
be in hand at the same time now that arrivals can differ. A PRICE pays nothing — `wantPackets` is set
only by a real turn, so `_hitCtx.packets` is null for `winProb2`, `board.js` and every rollout leaf
and the expression short-circuits.

**(B) `_R.crit()` is drawn once per ARRIVAL**, sized by the plain packet list, unconditionally, one
boolean per arrival. A click dmgRange handed no packets for is one arrival and takes exactly one draw
— byte-identical to every run before this.

**(C) — THE DEPARTURE.** The diagnosis proposed selecting per arrival "in the band loop and the emit
loop", reading `_hitCtx.packets` in both. **That does not fit the file**, for two reasons found by
reading it:

1. **The emit loop is a different closure.** The price step ends and `_stepApply` begins as a separate
   arrow function, so `_crits` is not in scope where the `|-crit|` lines are written. The vector
   travels on the row as `R.crits`, the same way `R.pk` already does, and the apply loop reads
   `R.crits[i]`.
2. **`_hitCtx.packets` cannot be the source at all any more.** It holds whichever price ran LAST,
   which was safe while a click was crit or was not. With a decision per arrival it is neither set.
   Worse, **the two prices can disagree about whether the click splits at all**: `dmgRange`'s flat
   path only splits a band that divides by the hit count (`_flat.min % _n === 0 && _flat.max % _n === 0`)
   and a crit band is a different pair of numbers. So one resolved list `_pkSel` is built once, out of
   both prices, and **every** downstream reader takes it — the per-arrival index loop, the greedy
   fallback, and `_multiPk` itself, which had silently become "did the last price split" rather than
   "will the apply step emit per arrival". The unaddressable case is counted, where before it
   collapsed to a one-packet volley in silence.

**THE FOURTH POINT, ALSO A DEPARTURE.** The diagnosis suggested `_price(true)` be guarded on
`_crits.some(Boolean) && _cc > 0 && _cc < 1`. That is what landed for the RE-PRICE, but the summed
`dmg` / `_roll` / `_rmin` are now written only when `_crits[0]` is true: those three describe ONE
range, so they can only speak for one arrival, and arrival 0's decision is the one the click has
always carried on the paths where the arrivals cannot be addressed.

---

## 6. THE JUDGEMENT CALL — DECIDED, NOT SILENTLY PICKED

`R.crit`'s one downstream reader is `buffsHolderOnHit` (Anger Point) through `condHolds`'s
`w.cond === 'crit'` branch. `_stepEffects` is wrapped **once per MOVE** here; the authority raises the
reaction inside `spreadMoveHit`, once per HIT. A single boolean must therefore stand in for a vector.

| candidate | what it means | verdict |
|---|---|---|
| `_crits.some(Boolean)` | any arrival crit | **CHOSEN** |
| `_crits[_crits.length-1]` | what `getMoveHitData(move).crit` holds after the volley | rejected |

**Why `some`, and it is not the lazy one.** Anger Point maxes Attack on a crit and cannot be maxed
twice, so the authority's per-hit pass has the observable outcome "+6 iff at least one hit crit" —
which is `some`, exactly. The last-hit reading would take a Dual Wingbeat that crit on hit 1 and
refuse the boost outright: a fix turning into a new defect on the one ability that reads this flag.

**Not coerced.** `R.crit` is `undefined` when the damage step never ran; `condHolds` refuses a
non-boolean and counts it, and `!!` would turn "nobody knows" into a confident `false` — ROADMAP
#101's reason, unchanged. `_crits` is null on exactly that path, so the expression yields `undefined`.

**Filed, not bundled: ROADMAP #500.** `some` is right for every member of this family in this format
and it is not right in general — it is wrong the moment a reaction COMPOUNDS across hits. That is the
same missing loop `tests/test-resolution-order.js` already stages as its one declared KNOWN-OPEN arm,
so the two are one piece of work. #500 states plainly that **nothing is known to break today** and
owes an instrument that separates idempotent reactions from compounding ones, printed before wiring.

---

## 7. THE COUNTERS, AND ONE OF THEM CORRECTED A SENTENCE I HAD TYPED

Read on a staged fixture (Dual Wingbeat, Triple Axel, Bullet Seed, Psychic Fangs, all bodies derived
from the format):

```
MEDSEEN.perArrivalCritDecision      5   arrivals carrying their own decision (2 + 3; the single-hit row is not counted)
MEDFAILS.critPerArrivalUnsplit      0   a multi-hit click with no packet list to hang decisions on
MEDFAILS.critPerArrivalUnaddressed  0   the two prices disagree about whether the click splits
MEDFAILS.critOncePerClickRestored   0   the knob (reads 1 under MEDI_CRIT_ONCE_PER_CLICK=1)
MEDFAILS.packetBandMissing          0   unchanged
```

**The first draft of `critPerArrivalUnsplit`'s comment said "expected non-zero — it is the 2-5
family".** It reasoned from `dmgRange`'s own header, which says the 2-5 family is priced as one
packet. That is true of a PRICE and false of a TURN: a real turn has already drawn the count and
hands it down, so a staged Bullet Seed splits into **three** arrivals, spends three crit dice and
reads the counter at zero. The wrong sentence is left in the source with the correction beside it,
because it was typed rather than measured — the same reason the retracted paragraphs in CLAUDE.md
stand.

**Trace lines from the staged fixture, one `|-crit|` where the volley earns one:**

```
Dual Wingbeat  |-crit| |-damage| |-damage|                   (arrival 1 crit, arrival 2 not)
Triple Axel    |-crit| |-damage| |-damage| |-damage|
Bullet Seed    |-crit| |-damage| |-damage| |-damage|
Psychic Fangs  |-crit| |-damage|
```

---

## 8. THE PIN DIGEST WAS DELIBERATELY NOT MOVED — THE ARGUMENT, NOT AN OMISSION

The brief required this be thought through and justified either way. **It must not move.**

`DICE_MODEL` and `PIN_DIGEST` live in `engine/game_differential.js` and describe the **INSTRUMENT** —
which corner each arm pins, the damage index, whether ties go to the second body, the `middle` arm's
addressing and hash, and the range form's behaviour. Every version they have ever carried was a
change inside that file:

```
#222   the RNG streams were split off the single scalar          (instrument)
#489   midHash gained a fmix32 finaliser, changing every value   (instrument)
#491   the range form random(m,n) was pinned to m, consuming no address  (instrument)
```

This change is in the **ENGINE**, and it is the same shape as ROADMAP #322's per-arrival `dmg` draw —
an engine consuming a different number of draws at an event-addressed die — which moved no digest.
The digest's job is to stop `arms_comparable.js` tabling two runs made with two different rulers; an
engine fix is a different SUBJECT, not a different ruler, and that is what the release id tracks.
**Moving it would falsely declare an instrument reset and refuse the exact before/after comparison
this report rests on.** `engine/game_differential.js` was not edited.

---

## 9. EVERYTHING ELSE THAT WAS RUN

```
tests/probe_hp_pair.js                       RED 8 → GREEN → RED 8 under the knob
tests/test-multihit-roll.js                  PASS (incl. its own MEDI_MULTIHIT_ONE_INDEX red arm)
tests/test-damage-stages.js                  PASS
tests/probe_multihit_update.js               PASS
tests/test-protocol-trace.js                 PASS
tests/test-engine-consistency.js             PASS
tests/test-mc-seal.js                        33 passed, 0 failed
tests/test-resolution-order.js               PASS (--max-old-space-size=6144; 26 arms, 1 KNOWN-OPEN, 0 failing)
tests/test-mechanics.js                      census 765 live / 765 probed / 0 missing — UNMOVED, predicted
tests/roster.js --stage items                139 match / 0 DIFFER / 0 DID-NOT-FIRE — byte-identical
tests/roster.js --stage abilities            129 match / 0 DIFFER / 0 DID-NOT-FIRE — byte-identical
tests/roster.js --stage moves                475 match / 0 DIFFER / 0 DID-NOT-FIRE — byte-identical
engine/all_mechanics_fire.js --kind all      identical diverging set (moves 8 + 11 resolution,
                                             abilities 3, items 1) and identical board tallies
engine/status.js                             gate still 3 of 8 clauses failing (unchanged)
```

**THE LIVE TREE DIFFERS FROM THE MEASURED RELEASE BY COMMENTS ONLY.** After the runs, one counter
comment was corrected (§7). Stripping every comment from both copies of
`engine/medicham2-browser.js` — the release snapshot's and the working tree's — leaves them
byte-identical, checked with `diff`. Anyone re-running must pass `--release 6ed5d6734c80`.

---

## OWED, NOT RUN

```bash
# a POOL-SCALE reading of the three new counters. game_differential.js surfaces no MEDSEEN, so
# perArrivalCritDecision / critPerArrivalUnsplit / critPerArrivalUnaddressed have only ever been read
# on a staged board — the same gap ENGINE.md records for MEDFAILS.roomItemIsLostRestored.

# ROADMAP #500 — an instrument over buffsHolderOnHit's membership that separates an IDEMPOTENT
# per-hit reaction from a COMPOUNDING one, printed before anything is wired. Until it exists,
# `_crits.some(Boolean)` is a decision with a reason and not a measured result.

# not re-run on this release by this pass
node tests/interaction_matrix.js
node tests/mutation_harness.js
node engine/quarantine.js
node engine/wire_ladder.js      # data/wire-ladder.json is UNSAFE and its figure is withheld

# the KO'd-volley draw asymmetry, declared and not bundled: the arrival loop computes all N packets
# before the tg.curHP<=0 break, so on a volley that KOs early this engine draws more `crit` (and more
# `dmg`, pre-existing) than the authority does. Harmless under an event-addressed die by construction
# — game_differential.js's middle-arm header says so — and unmeasured here.

# whether ANY board-material game remains that a per-hit crit could still explain: five remain and all
# five were attributed elsewhere by their diff, not by re-play. Not re-checked by this pass.
```
