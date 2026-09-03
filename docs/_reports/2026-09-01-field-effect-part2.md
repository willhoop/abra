# Field effects, part 2 — closing the terrain-gate questions, then Electric Terrain's status refusal

2026-09-01. ENGINE. **Part 1 (verification) is written first and Part 2 is appended**, so a stall
costs one half rather than both.

---

# PART 1 — THE THREE OPEN QUESTIONS. ALL THREE ANSWER CLEANLY; THE FIX IS COMPLETE, NOT PARTIAL.

## 1. THE `terrainScaled` MEMBERSHIP — FOUR, DERIVED TWO INDEPENDENT WAYS

**The scope's "two" was wrong and the prediction's "four" was right.**

Derivation A — walk `data/tags.json` for the tag, then ask the format about legality:

```
expandingforce  legal  uses 310  {scalesWith:terrain, terrain:psychicterrain,  mult:1.5}
mistyexplosion  legal  uses   7  {scalesWith:terrain, terrain:mistyterrain,    mult:1.5}
risingvoltage   legal  uses 185  {scalesWith:terrain, terrain:electricterrain, mult:2}
terrainpulse    legal  uses  16  {scalesWith:terrain, byTerrain:{...}, anyTerrainBPMult:2, requiresGrounded:true}
```

Derivation B — never touch the tag file. Walk the **500 legal moves** of
`Dex.forFormat('gen9championsvgc2026regmb')` filtered `exists && !isNonstandard && tier !== 'Illegal'`,
and stringify each move's `basePowerCallback` / `onBasePower` / `onModifyMove` / `onModifyType` looking
for a terrain read. **The same four, and nothing else.** The format holds exactly 500 legal moves and
`tags.json` covers all 500, so the two walks are over the same population and their agreement is real.

**THREE of the four reach the ungated multiplier site**, because that site keys on `{terrain, mult}`
and Terrain Pulse carries `byTerrain`/`anyTerrainBPMult`/`requiresGrounded` instead — it is gated on
the USER at the type/base-power site and has its own census probe.

**Carrier-checked**, via `champions_sim.moveCarriers` (the format's own `TeamValidator.checkCanLearn`
over the 347-body legal roster):

| move | legal carriers |
|---|---|
| Expanding Force | **38** |
| Rising Voltage | **24** |
| Misty Explosion | **20** |
| Terrain Pulse | **12** |

Psyblade is mainline's fifth member and Champions marks it `isNonstandard: 'Past'` — **derived, not
recalled** — so it is not a member of this format at all.

### The instrument was wrong before the engine was, again

My first carrier count was a hand-rolled walk of `getLearnsetData` up the prevo/base-forme chain, and
it returned **13** for Misty Explosion against `moveCarriers`' 20. **`moveCarriers` is right and my
walk was wrong** — it calls the real validator, which sees egg and transfer sources a raw learnset
walk does not. This is LESSONS §8 exactly ("reuse the canonical path"), and it is recorded because the
comfortable move would have been to file a "the engine comment says 20 and the truth is 13" defect.
There is no defect. The engine comment, the probe comment and the prediction all say 20 and all three
are correct.

## 2. DO THE MEMBERS GATE ON DIFFERENT FEET? YES — AND THE ENGINE'S MAP MATCHES THE AUTHORITY EXACTLY

Read out of the format, not out of the engine's comment:

```
expandingforce  onBasePower(basePower, source)      field.isTerrain('psychicterrain')  && source.isGrounded()  -> chainModify(1.5)   USER
mistyexplosion  onBasePower(basePower, source)      field.isTerrain('mistyterrain')    && source.isGrounded()  -> chainModify(1.5)   USER
risingvoltage   basePowerCallback(source, target, move)
                                                    field.isTerrain('electricterrain') && target.isGrounded()  -> basePower * 2      TARGET
terrainpulse    onModifyType / onModifyMove         pokemon.isGrounded()                                                             USER
```

The engine's literal is
`TERRAIN_SCALED_SUBJECT = { expandingforce:'user', mistyexplosion:'user', risingvoltage:'target' }` —
**identical to the authority, member for member.** `data/mods/champions/moves.ts` overrides none of the
four (grepped by key; the only one of the five names present in that file is `psyblade`), so mainline
is the authority here and saying so is a derivation rather than an assumption.

**`isSemiInvulnerable()` is in none of the four handlers.** Confirmed by reading the stringified
handler source, not by recalling the previous batch's answer. It belongs to the terrain CONDITION's
handlers and correctly does not appear at the MOVE's site.

## 3. ARE BOTH DIRECTIONS ASSERTED FOR EACH MEMBER? YES, AND THE CROSS ARM IS THERE TOO

Five `terrainScaled` census rows exist (the coordinator's report said `test-mechanics.js` carries
three references; it carries **five probes**). All five are `live: true` and `armed: true`. Read at
HEAD, exact figures from this session's own run:

| probe | grounded arm | airborne arm | over-fire controls |
|---|---|---|---|
| Expanding Force | Psychic Terrain + grounded user **148** | AIRBORNE user **76** = the no-terrain 76 | Electric Terrain 76; no terrain + airborne 76; **TARGET airborne 148** (must NOT move) |
| Misty Explosion | Misty Terrain + grounded user **218** | AIRBORNE user **146** = the no-terrain 146 | Electric Terrain 146; no terrain + airborne 146 |
| Rising Voltage | grounded user + grounded target **121** | grounded user + AIRBORNE target **61** | Misty Terrain 48; **AIRBORNE user + grounded target 94 — the x2 STILL PAID**; both airborne 48 = the clear field |

Rising Voltage is a full 2x2 and the third cell is precisely the arm a uniform user-gate would have
broken: it must read 94, and a user-gated Rising Voltage collapses it to 48. **The asymmetry is
asserted, not merely implemented.** The x2 read off the two attacker-airborne cells is **1.96** — that
ratio is the move's doubling with the terrain condition's own x1.3 held out of it, because the
condition's boost is gated on the ATTACKER and the attacker is airborne in both of those cells.

## 4. RED-FIRST, RE-DEMONSTRATED THIS SESSION

`MEDI_TERRAIN_SCALED_UNGATED=1` was run at HEAD. The three probes go **MISSING** and read exactly the
predicted defect:

```
Expanding Force  airborne user   114   (must be 76)
Misty Explosion  airborne user   218   (must be 146)
Rising Voltage   airborne target 121   (must be 61), both-airborne 94 (must be 48), doubling 1.00
```

and the run **REFUSED to write `data/mechanics-census.json`** because `terrainScaledUngatedRestored`
is registered in `DELIBERATE_BREAK`. The Expanding Force grounded arm (148) and the Rising Voltage
cross arm (94) are unmoved by the knob, which is what says the knob restores one defect rather than
disabling the block.

## 5. THE COUNTERS MOVE IN BOTH DIRECTIONS

Measured over the whole census run through a preload hook (no repo file was edited to get this):

```
MEDSEEN.terrainScaledGateApplied  22
MEDSEEN.terrainScaledGateRefused  11
MEDFAILS.terrainScaledSubjectUnknown 0   (first: "")
MEDFAILS.terrainScaledGateNoBody     0
```

Both directions fire, so the gate is wired rather than a constant. The loud fallback for an
unrecognised `{terrain, mult}` member never fired, which is the correct answer for a membership of
three.

## 6. THE BASELINES, RE-READ OFF DISK

Both differential artifacts carry `engine_release: d9dc3afe16ef` — the same bytes — so the delta is
knob-attributable and not a release artefact:

| artifact | games | board-parted | protocol |
|---|---|---|---|
| `game-differential.terraingate-before.json` | 961 | **78** (961 − 883 never-diverged) | **169** |
| `game-differential.terraingate.json` | 961 | **77** (961 − 884) | **168** |

Census at HEAD, re-run this session: **825 live / 825 probed / 0 missing, 0 threw, 0 hollow.**

## 7. THE PREDICTION, SCORED — 10 HIT, 1 MISSED

The file carries **eleven** `P*` clauses, not nine.

| clause | verdict | evidence |
|---|---|---|
| `P_membership` | **HIT** | 4 tag members / 3 reach the site; carriers 38 / 24 / 20 / 12 exact |
| `P_subjects` | **HIT** | user / user / target, read off the authority's handler source; no Champions override |
| `P0_red_first` | **HIT** | knob reproduces 114 / 218 / 121 and leaves the 94 cross arm unmoved |
| `P1_probe_shape` | **HIT** | three probes, both directions each, RV cross arm, both named over-fire controls |
| `P2_census` | **HIT** | 825 exactly, point estimate not just band |
| `P3_which_scoreboard` | **HIT (band), point off by one on all three** | 77 vs point 78 band [75,79]; 168 vs 169 band [165,170]; 146 vs 147 band [144,149]. The stated hedge — "a move of one or two games is INSIDE the prediction" — is what saved this clause, and it was written because the previous batch missed in the other direction |
| `P4_knob` | **HIT** | before-arm reproduces 78 / 169 on the SAME release; census refuses to write under the break |
| `P5_counters` | **HIT** | 22 applied / 11 refused; loud fallback at 0 |
| `P6_damage_differential` | **HIT** | `engine-diff.terraingate.json`: seed 20260804, requested 6000, compared 6000, agreed 6000, **disagreed 0** |
| `P7_isSemiInvulnerable` | **HIT** | absent from all four handlers, verified from source this session |
| `P8_void_usable` | **MISS on the figure** | predicted "void 9 unchanged". `provenance-stamp.json` `void_files` is **2** (`exploitability.json`, `medicham-bench.json`), identical to `HEAD`. The substance holds — nothing was newly declared void — but the number 9 was never true |

**10 hit, 1 missed.** Running tally: 4/4, 5/5, 5-of-7, 6-of-8, 6/6, 8/8, 11/11, 11-of-12,
8-hit-3-missed, 8-hit-5-missed, **10-hit-1-missed**.

## PART 1 VERDICT

**The fix is correct and complete.** The membership is four (three at the site), the feet genuinely
differ and the engine reproduces the difference member for member, and both directions plus the cross
arm are asserted. Nothing here says the fix is wrong or partial, so Part 2 proceeds.

Two corrections to the coordinator's own report, neither material: it says `test-mechanics.js` carries
**three** `terrainScaled` references (five probes) and that the prediction carries **nine** clauses
(eleven).
