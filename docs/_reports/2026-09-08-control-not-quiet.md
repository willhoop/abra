# CONTROL-NOT-QUIET: 45 abilities, one mechanism, and twelve greens that were never green

**2026-09-08. ENGINE.** Release `f0f10cd06861`, format `gen9championsvgc2026regmb`.
Artifact before: `data/roster.abilities.json` generated 2026-09-08T05:54:19.689Z (kept at
`data/roster.abilities.prev.json`). Artifact after: same path, regenerated with `--reds --write`.

---

## THE VERDICT IN ONE PARAGRAPH

The 45 `CONTROL-NOT-QUIET` ability rows are **one mechanism, not forty-five**, and it is an
INSTRUMENT defect, not a fixture problem: `engine/board_state.js` writes the carrier's ability onto
**two** leaves — the active slot and the party row — so the ability-swap control arm cannot be played
without moving them, and `tests/roster.js#armDelta` counted that as evidence. It is the Focus Sash
defect of 2026-09-07 on the ability axis, at twelve times the scale. **45 of 45** rows had at least
one control arm whose ENTIRE delta was that swap, and — the expensive half — **12 of the 146
`FIRED-AND-BOARDS-MATCH` rows had no other evidence at all.** Those twelve were green because both
engines write the ability name we set them.

**No engine defect was found.** Zero `FIRED-AND-BOARDS-DIFFER` before, zero after. The 45 abilities
were not diverging; they were not being exercised.

---

## 1. THE GROUPING, BEFORE ANYTHING WAS FIXED

Every one of the 45 came out of the SAME branch of `runEntry`: the second control **ran**, and
`leaves_kept == 0` ("nothing survives both controls"). There is no second branch and no third.

Counting the leaves in the two arms:

| | rows | what it means |
|---|---|---|
| dropped leaves that are the carrier's own `.ability` field | **1,380 of 1,738 — 79.4%** | the control arm describing itself |
| rows whose SMALLER arm is 100% that leaf | **45 of 45** | against at least one control the subject moved **nothing** |
| rows whose BOTH arms are 100% that leaf | 31 of 45 | the fixture never exercises the ability at all |
| rows carrying a REAL ability rewrite (`with` is not the ability under test) | **1** — Trace | Gardevoir's slot reads `pressure`, in both engines |

The remaining 14 rows have real non-ability leaves in ONE arm — those leaves are the OTHER control's
own work (Intimidate's `-1 Attack` on four rows, Weak Armor's `def -1 / spe +2` on two, Supersweet
Syrup's evasion drop, Stamina, Anger Point, Speed Boost, Protean, Snow Cloak, Electromorphosis,
Pressure's PP tax). The subject is at exactly zero against the other control on every one of them.

### Why the swap leaf can never survive a second control

`DKEY` keyed on both values, including the CONTROL arm's:

```js
const DKEY = d => d.engine+'|'+d.turn+'|'+d.path+'|'+String(d.with)+'|'+String(d.without);
```

On an `.ability` leaf the control-arm value IS the control's identity — `without=synchronize` in arm
one, `without=telepathy` in arm two. Two arms can never agree on it **by construction**, so the leaf
is guaranteed to land in `dropped` and guaranteed to force "the two deltas differ". That is why the
verdict was so uniform.

---

## 2. THE FIX — CONDITIONED ON VALUES, NEVER ON THE PATH

A blanket path ignore was the obvious move and it is **wrong**: for Trace, Receiver, Protean and every
forme change the `.ability` leaf IS the effect. Gardevoir really does stop saying `trace` and start
saying `pressure`, in both engines, on this very fixture. Deleting the path would have made Trace
permanently unmeasurable.

Three changes in `tests/roster.js`, all in the file ENGINE owns. **`engine/medicham2-browser.js` was
not touched.**

1. `controlOf` now records the swap it performed — the subject's side, the swapped bodies' species,
   and the set of control abilities it wrote (`swap`).
2. `swapLeaf(swap, path, subjVal, ctrlVal)` classifies an `.ability` leaf on the subject's own side:
   `2` = the swap itself (dropped), `1` = the carrier rewrote its own ability (kept and flagged),
   `0` = not ours.
3. `DKEY` normalises the control-arm value to `«CONTROL-ABILITY»` on a flagged leaf, so a real
   rewrite can survive a second control.

Two counters are published and printed every run — `swap_leaf_correction.self_describing_dropped` and
`.real_ability_rewrite_kept` — and a ZERO in the first on an ability stage prints
*"the correction never reached a leaf and every row below is judged by the old ruler."*
`engine/status.js` already surfaces the first in its SCOPE block (`5344`).

### The correction was itself wrong first, and the counter is what caught it

The first version passed the comparator row `d` straight into `swapLeaf` and read `d.with` / `d.without`.
`BS.compare` names its operands `.medicham` and `.showdown`, so every field was `undefined`, `swapLeaf`
returned 0 on every leaf, and **nothing changed**. The row still printed
`FIRED-AND-BOARDS-MATCH` and the probe still failed — but the counter printed `0 leaves DROPPED`
with the ZERO warning attached, which is the only reason it took two minutes rather than an hour.
A silent default here would have looked exactly like a working feature.

---

## 3. THE PROBE — `tests/probe_control_self_name.js`, RED FIRST

Seven clauses, three rows, one roster run each (`--only`, `--json`, nothing written to `data/`).

| clause | before | after |
|---|---|---|
| A0 the correction reached this row's leaves (counter > 0) | **FAIL** (no counter existed) | ok — 16 |
| A1 nothing on Leaf Guard's row is a real rewrite, so A2 is aimed at a vacuous row | ok | ok |
| **A2 Leaf Guard is NOT counted as tested** | **FAIL — `FIRED-AND-BOARDS-MATCH`** | ok — `COULD-NOT-STAGE` |
| B0 the correction fired on Contrary's row too (16 dropped) and it still has 24 real leaves | ok | ok |
| **B1 a green resting on REAL leaves keeps its green** | ok | ok |
| C0 Trace really did rewrite its own slot (`with=pressure`), so there is something to preserve | ok | ok |
| **C1 Trace is released to a real verdict** | **FAIL — `CONTROL-NOT-QUIET`** | ok — `FIRED-AND-BOARDS-MATCH` |

Clause B is the control that refuses "delete the ability stage"; clause C is the control that refuses
a blanket path ignore. Clause A0 is the receipt that the assertion was reached — without it, clause A2
is satisfied by a roster that never staged Leaf Guard at all, which is the dead-anchor failure. A
MISSING `swap_leaf_correction` key throws rather than reading as zero.

---

## 4. WHAT THE 45 ACTUALLY DO — FOUR OF THEM NOW MEASURED

The correction says what the 45 are NOT (diverging). It does not stage them. Four new rules were
built, each matching **exactly one** legal ability by handler shape — printed before wiring, per the
over-match rule — each sitting above `ability/entry` so it can steal nothing, and each shown
`CAUGHT` by its own `--reds` break:

| rule | ability | why the old fixture could not touch it | the leaf that carries it | red demo |
|---|---|---|---|---|
| `ability/pp-tax` | **Pressure** | `onStart` is a message, so it was claimed by `ability/entry`, whose script is three IDLE turns — nobody swings | `p1.pp[0].moonblast`, 2 spent per click vs 1 | `CAUGHT … DID-NOT-FIRE on pp.moonblast` |
| `ability/refuses-the-ally-spread` | **Telepathy** | it refuses damage from an ALLY; the generic fixture has the aggressor swinging | carrier hp under the partner's `allAdjacent` click | `CAUGHT … DID-NOT-FIRE on party.hp, hp` |
| `ability/refuses-indirect-damage` | **Magic Guard** | the only damage in the generic fixture is a MOVE, the one kind it does not refuse | carrier hp, recoil-item toll | `CAUGHT … DID-NOT-FIRE on party.hp, hp` |
| `ability/heals-from-its-own-poison` | **Poison Heal** | nobody is poisoned in the generic fixture | carrier hp, sign flips between arms | `CAUGHT … DID-NOT-FIRE on party.hp, hp` |

Each shape was printed against the whole legal ability set before being wired:
`onTryHit` naming `isAlly(` → `telepathy` only; `onDamage` comparing `effectType` to `"Move"` →
`magicguard` only; `onDamage` naming `"psn"/"tox"` → `poisonheal` only. Matching on the HANDLER NAME
would have swept Soundproof, Bulletproof and Wonder Guard into the first and both `onDamage` families
into one rule.

**Magic Guard's first fixture was wrong and the instrument said so.** Sand from a partner produced
twelve real hp leaves in both engines — and then read `CONTROL-NOT-QUIET`, because Reuniclus's second
control is **Overcoat**, which blocks weather damage too. Two controls live in the same way on the
same leaves is exactly the case the second-control machinery declares it cannot see, and it declared
it. The recoil item (derived: the one legal item whose `onAfterMoveSecondarySelf` damages its holder)
is untouched by Overcoat, Regenerator, Cute Charm, Unaware, Synchronize or Inner Focus.

**Trace was released by the correction alone** — no new rule. Its evidence was always there.

---

## 5. THE COUNTS

Both artifacts on release `f0f10cd06861`, `--reds --write`, 316 rows, 202 in scope.

| verdict | before | after | why |
|---|---|---|---|
| FIRED-AND-BOARDS-DIFFER | 0 | **0** | no engine defect found |
| DID-NOT-FIRE | 0 | **0** | |
| FIRED-AND-BOARDS-MATCH | 146 | **139** | −12 vacuous greens exposed, +5 newly measured |
| CONTROL-NOT-QUIET | 45 | **14** | 30 fell to an honest COULD-NOT-STAGE, Trace released |
| COULD-NOT-STAGE | 124 | **158** | |
| DEFERRED-BY-OWNER | 1 | **5** | see below |
| red demonstrations | all CAUGHT | **44 of 44 CAUGHT, 0 NOT CAUGHT, 0 WEAK** | including all four new rules |

**The twelve that lost their green, all named, all in the predicted set:** Cloud Nine, Leaf Guard,
Light Metal, Long Reach, Magician, Natural Cure, Plus, Quick Feet, Receiver, Symbiosis, Synchronize,
Unaware. **No other green moved.** The 133 greens carrying a non-ability leaf are all still green.

**The five now newly measured:** Pressure, Telepathy, Magic Guard, Poison Heal, Trace.

**Four owner deferrals were hidden behind the same leaf.** `DEFERRED-BY-OWNER` went 1 → 5:
Anticipation, Forewarn, Pickup and Stall were already on the owner's shelf, and the shelf branch is
gated on `!sdMoved.length` — the swap leaf kept `sdMoved` non-empty, so the deferral never printed.
This was NOT predicted (the prediction said COULD-NOT-STAGE 166 / DEFERRED 1; the truth is 158 / 5).
**A shelf nobody can see is the invisible exception the file exists to prevent, and it was invisible
for as long as the leaf was counted.**

`engine/status.js` reads `PASS  deliberate roster / abilities  clean: 139 of 202 tested`.

---

## 6. THE PREDICTION, SCORED

Written to `data/verification/_prediction-2026-09-08-control-not-quiet.json` before the correction was
implemented.

| | claim | result |
|---|---|---|
| P1 | one mechanism, the control describing itself | **HIT** — 45 of 45 |
| P2 | FIRED 135, CNQ 14, CNS 166, DEFERRED 1 | **PARTIAL** — FIRED 135 and CNQ 14 exact; CNS 162 and DEFERRED 5, because four owner deferrals surfaced. The prediction did not know the shelf was hidden by the same leaf. |
| P3 | Trace is the only real ability-change leaf, and it MATCHES | **HIT** |
| P4 | no new FIRED-AND-BOARDS-DIFFER anywhere | **HIT** — 0 |
| P5 | the 133 greens with a real leaf all keep their green | **HIT** |

(The final artifact reads FIRED 139 rather than 135 because four new rules were added AFTER the
prediction was scored against the correction alone.)

---

## 7. WHAT IS LEFT, NAMED

**14 rows still `CONTROL-NOT-QUIET`, and every one now has a sharp diagnosis** — one arm is at
*exactly zero* and the other arm's leaves are the other control's own work:

| ability | control 1 | control 2 | deltas (arm1 v arm2) | what the live control is doing |
|---|---|---|---|---|
| aftermath | Stench | Weak Armor | 0 v 32 | Weak Armor's `def −1 / spe +2` |
| angerpoint | Intimidate | Cud Chew | 44 v 0 | Intimidate's `atk −1` |
| battlebond | Protean | Torrent | 12 v 0 | Protean's type change |
| damp | Electromorphosis | Static | 12 v 0 | Electromorphosis charging its own Electric click |
| justified | Intimidate | Flash Fire | 44 v 0 | Intimidate |
| keeneye | Weak Armor | Sturdy | 32 v 0 | Weak Armor |
| magmaarmor | (alt) | Anger Point | 0 v 12 | Anger Point's `+6 atk` |
| moxie | Shed Skin | Intimidate | 0 v 44 | Intimidate |
| opportunist | Frisk | Speed Boost | 0 v 8 | Speed Boost's `+1 spe` |
| rivalry | Intimidate | Guts | 44 v 0 | Intimidate |
| slushrush | (alt) | Snow Cloak | 16 v 0 | Snow Cloak's evasion |
| stalwart | Stamina | Sturdy | 20 v 0 | Stamina's `def +1` |
| stickyhold | Supersweet Syrup | Regenerator | 32 v 0 | Supersweet Syrup's evasion drop |
| superluck | Justified | Pressure | 0 v 6 | Pressure's PP tax |

They are NOT reclassified. "One arm is zero" does not prove the subject is inert — the subject could
be duplicating that control's effect — and two arms cannot separate those. What each needs is a
FIXTURE that exercises it, exactly as Pressure, Telepathy, Magic Guard and Poison Heal got one.

**And 34 abilities are now honestly `COULD-NOT-STAGE` where they were previously counted** — 22
released from CONTROL-NOT-QUIET plus the 12 vacuous greens. Each needs a fixture that reaches it:

| what the fixture has to supply | abilities |
|---|---|
| a landed CRIT | Sniper, Merciless |
| a MISS, or a move that cannot miss | Compound Eyes, No Guard, Tangled Feet, Illuminate |
| a BERRY and a threshold | Cheek Pouch, Gluttony, Cud Chew |
| a WEIGHT-BASED click | Heavy Metal, Light Metal |
| the counterpart ability on the PARTNER | Plus, Minus |
| a STATUS on the carrier | Early Bird, Hydration, Leaf Guard, Quick Feet, Synchronize, Natural Cure |
| an ITEM in play | Klutz, Magician, Pickpocket, Symbiosis |
| a fallen ALLY | Supreme Overlord, Receiver |
| a SCREEN | Screen Cleaner |
| the carrier moving LAST | Analytic |
| a MULTI-HIT click | Skill Link |
| a FLINCH | Steadfast |
| a drop below half HP | Berserk |
| a CONTACT reaction on the foe | Long Reach |
| a BOOSTED foe | Unaware |
| a WEATHER for the sky-reader | Cloud Nine |

Three more — Frisk, Forewarn, Anticipation — are message-only and carry no board leaf at all; the
last two are already on the owner's shelf, and Frisk is the remaining one of that shape.

The exact transitions, for the record:

| from | to | n | ids |
|---|---|---|---|
| CONTROL-NOT-QUIET | COULD-NOT-STAGE | 22 | analytic, berserk, cheekpouch, compoundeyes, cudchew, earlybird, frisk, gluttony, heavymetal, hydration, illuminate, klutz, merciless, minus, noguard, pickpocket, screencleaner, skilllink, sniper, steadfast, supremeoverlord, tangledfeet |
| CONTROL-NOT-QUIET | DEFERRED-BY-OWNER | 4 | anticipation, forewarn, pickup, stall |
| CONTROL-NOT-QUIET | FIRED-AND-BOARDS-MATCH | 5 | magicguard, poisonheal, pressure, telepathy, trace |
| FIRED-AND-BOARDS-MATCH | COULD-NOT-STAGE | 12 | cloudnine, leafguard, lightmetal, longreach, magician, naturalcure, plus, quickfeet, receiver, symbiosis, synchronize, unaware |

Nothing else moved.

---

## 8. WHAT WAS NOT TOUCHED

- `engine/medicham2-browser.js`, `engine/board.js`, `engine/magnemite.js`, `data/engine-data.js` —
  unchanged. No simulator fix was needed and none is handed over.
- `data/mechanics-census.json` — not regenerated. No engine behaviour changed, so the live count
  cannot have moved; it stands at 830/830.
- `data/roster.items.json`, `data/roster.moves.json` — not re-run. `swapLeaf` returns 0 immediately
  when the control wrote no ability (every item and move row), so those stages are provably
  unaffected. Items 140 of 148 and moves 487 of 500 stand.
- `data/policy-weights.json`, `engine/status.js --write` — not run.

**One pre-existing red, not mine and not fixed here:** `engine/status.js` opens with
`FEATURE SEMANTICS CHECK FAILED — data/policy-weights.json` (the fixture changed, 10 → 12 scenarios,
and the damage table was regenerated, 318 → 322 species). That is MEASURE's refit edge and it was red
before this work began.
