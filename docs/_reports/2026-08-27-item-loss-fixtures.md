# Four item-loss fixtures, staged — 2026-08-27 (ENGINE)

Release `7f7de860723b`. Arm `middle`. Nothing was fixed in this pass and no engine byte moved, so no
release was cut and the census was NOT regenerated (it reads **754 / 754 / 0**, unchanged, digest
`367f919d3200`). Three probe files were added; all three were shown RED on a known-bad before being
believed.

## The four answers

| # | fixture | verdict |
|---|---|---|
| 1 | Poltergeist, with and without an item — **including an item removed earlier in the same turn** | **CORRECT** |
| 2 | Unburden via Close Combat + White Herb (the after-move door) | **CORRECT** |
| 3 | Unburden via Intimidate + White Herb (the switch-in door) | **CORRECT** — the 2026-08-27 `refill()` pass holds |
| 4 | Knock Off into a mega stone, un-evolved and evolved | **CORRECT** — and the premise of the question is false; see below |

Boards identical at every boundary on **every arm of all three files**, narration identical on every
arm except one declared-cosmetic line (§5).

## 1. Poltergeist reads the slot at USE TIME — `tests/probe_poltergeist_use_time.js`

Three arms, one board, one item knob.

| arm | authority `\|move\|` order | damage to the target |
|---|---|---|
| held (control) | `swordsdance, calmmind, aquatail, poltergeist` | **90** |
| empty (control) | same | **0** — `onTry` refused |
| stripped (under test) | `knockoff, calmmind, aquatail, **poltergeist**` | **85** — the Knock Off only |

The strip is asserted to resolve BEFORE the click out of the authority's own `|move|` order, not out
of this file's speed arithmetic, and the authority's body is asserted empty-handed at the boundary.
Both engines write `|-fail|p1a` and neither writes an `-activate`. `scriptMoveNotOnRequest` is 0 on
all three arms.

**Red-checked** under `MEDI_ITEM_READ_SILENT=1`: the `held` arm goes red on two clauses (narration and
`-activate`), the other two stay green — so the instrument sees the announcement and is not merely
agreeing with itself.

The existing `tests/probe_poltergeist_item_line.js` already covered held/empty. What is new is the
mid-turn arm, which is the only one that can tell "asks at use time" from "answered at build time".

## 2 and 3. One herb, two doors — `tests/probe_unburden_herb_paths.js`

The holder is a legal Unburden carrier at slot 1; the comparator's Speed is DERIVED to straddle the
doubling and the file refuses to run outside that window (`162 < 165 < 324`). Speed is not a board
leaf, so "did Unburden proc" is read off WHO MOVED FIRST in the authority's own `|move|` order.

**Block A — the after-move door.** Close Combat drops the user's Def and SpD.

| arm | Def / SpD at the t1 boundary | item | turn-2 order |
|---|---|---|---|
| herb + Unburden | 0 / 0 | spent | **holder first** |
| herb + a different ability | 0 / 0 | spent | comparator first |
| no item + Unburden | **−1 / −1** | — | comparator first |

**Both stats come back for ONE consumption**, asserted on both engines. The no-herb arm is what
proves the authority really applied two drops — an arm where nothing dropped would be green and
empty. Turn 1 the comparator moves first in all three arms, so the arms start equal.

**Block B — the switch-in door.** Nobody clicks anything that lowers a stat; the drop is an entry
ability opposite.

| arm | Atk at the t0 boundary | item | turn-**ONE** order |
|---|---|---|---|
| entry drop + herb + Unburden | 0 | spent | **holder first** |
| entry drop + herb + a different ability | 0 | spent | comparator first |
| **no** entry drop + herb + Unburden | 0 | **still held** | comparator first |

Will's free control holds exactly: with nothing to clear, the herb does not activate and is not
consumed. Unburden is live on turn one with no move spent, which is the whole point of the door.

**Red-checked** with `--red`: `restoresStats` stripped from the in-memory artifact **through the
tags module the driver is actually using** — `REL.require('engine/tags.js')`, not a plain `require`.
The first attempt used the live-tree module, changed nothing, and reported *0 of 4 broke*; that is
the failure shape this repository is named after and it is recorded in the file. With the right
module: **4 of 4** — both boards part and both orders stop flipping.

## 4. Knock Off into a mega stone — `tests/probe_knockoff_megastone.js`

Six arms. Boards identical everywhere; the item never leaves any stone arm in either engine.

| arm | damage | item at the end |
|---|---|---|
| plain (ordinary item, un-evolved) | **106** | gone, `-enditem ... [from] move: Knock Off` |
| stone (its own stone, un-evolved) | **72** | still there |
| stone-mega (its own stone, evolved) | — | still there |
| edge-plain (the minority handler, un-evolved) | — | still there |
| edge-mega (the minority handler, evolved) | — | still there |
| **foreign** (a stone that is NOT this body's) | **106** | gone |

`plain` vs `stone` is the x1.5 knob on one species and one forme. `foreign` is the clause that says
the refusal is keyed on the PAIRING and not on the class — 72 → 106 on the same body.

### THE PREMISE OF THE BRIEF'S FOURTH FIXTURE IS FALSE, AND THE FIRST DERIVATION AGREED WITH IT

The brief expected the guard to stop matching after a mega, because it reads
`source.baseSpecies.baseSpecies` and `formeChange(..., isPermanent)` rewrites `baseSpecies`. A static
re-implementation of the guard said exactly that: **one stone of 75 becomes removable after mega.**

It is wrong, and the engines were right. **The stones do not all carry the same handler.** Walked and
EVALUATED over the format:

```
DISTINCT onTakeItem handlers among the 75 legal stones : 2
  x73   return !item.megaStone?.[source.baseSpecies.baseSpecies];
  x2    return !item.megaStone || !item.megaStone[source.baseSpecies.name] &&
                                  !Object.values(item.megaStone).includes(source.baseSpecies.name);
stones the handler lets go while UN-EVOLVED : 0
stones the handler lets go AFTER MEGA       : 0
```

The two exceptions are the stones whose base has more than one forme; their guard reads
`baseSpecies.NAME` and checks the megaStone map's VALUES as well as its keys, so the mega forme's own
name matches and the stone stays welded on. **No stone in this regulation is removable after mega
evolution.** Both engines refuse everywhere, so there is nothing to file.

The lesson is the one already in CLAUDE.md: a paraphrase of a handler is a value typed from memory
wearing a receipt. The probe now CALLS each handler with a minimal holder and prints both classes.

### Two instrument faults caught before they were reported as engine defects

- **`hpBoost` cannot be used in an arm that mega evolves.** Showdown's `formeChange` calls
  `updateMaxHp()` and recomputes from the species, so the harness's multiplier is dropped: at x8 the
  authority's body went `1320 → 165` the instant it evolved while ours stayed at 1320, and BOTH mega
  arms reported a four-leaf board divergence that was entirely the rig. The mismatch was exactly
  `maxhp` and exactly the factor 8, on both mega arms and neither un-evolved one. The file now runs
  at x1 and asserts the subject is alive and unchanged at the last boundary.
- **The attacker's own Swords Dance turned the control arm into a KO.** The target fainted, a
  replacement came in, and every read after it was of a different body while every clause stayed
  green. The turn-1 click is now a self-only move that boosts nothing.

**Red-checked** with `--red`: `removesItem` stripped from the strip move through the driver's tags
module. **6 of 6** — the two arms that remove an item part from the authority, and the four stone
arms are UNCHANGED, which is the second half and says the knob is hitting the right thing.

## 5. One narration difference, and it is a DECLARED equivalence — not filed

The authority writes `|-ability|` when an ability announces itself; this engine writes none, on any
arm — 1 line per arm on the un-evolved arms and 2 on the arm that megas into an announcing ability.

`engine/game_differential.js`'s EQUIV list carries `ability-announcement` verbatim: the `|-ability|`
is a cosmetic announcement, every consequence is a separate line, and those lines are kept and
compared. It ships with a red demonstration in both directions. **A probe stricter than the
instrument it feeds would report a defect nothing else in the repository agrees is one**, so the
knock-off probe applies the same drop and PRINTS the per-arm count instead of swallowing it.

## Which scoreboard moved, predicted before the run

- **Census: unchanged, 754 / 754.** No mechanic was landed, and no census row was added — that would
  regenerate `data/mechanics-census.json` and change which scenarios every steered run plays, which
  is not a thing to do inside a staging pass while other agents are live.
- **Pinned pool: unchanged, by construction.** Nothing was fixed, so there was nothing for it to move
  on. White Herb is 101 of 13,214 pool games, Unburden 2,930, Poltergeist 447 and the minority stone
  3,762 — none of which is the obscure tail, and all four turned out to be already correct.

## Owed, not run

- No census row was added for any of the four. All four are now covered by a standing probe file, but
  the census does not know about them, so `754 / 754` understates coverage by four fixtures. Adding
  them is a separate pass that regenerates the census.
- The mega arms have **no isolated boost control** and the probe says so rather than faking one:
  mega evolution requires holding the matching stone, so "this mega forme holding an ordinary item"
  is a board the game cannot produce. Their claim is the strip and engine agreement, nothing more.
- The missing `|-ability|` announcement is declared cosmetic by the differential and was NOT filed.
  If the narration gate ever becomes its own clause, this is one of its rows.
