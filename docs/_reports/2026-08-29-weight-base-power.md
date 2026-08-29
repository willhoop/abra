# Weight-based base power — card B1 — 2026-08-29

**VERDICT.** Four legal moves carry the weight shape, in two families that are not the same formula.
The brackets, the tag payload and both `effWeight` call sites were already **correct**; what was wrong
is that **the weight itself never moved**. `buildMon` stamps `m.wt` once and no forme door ever
rewrote it, so a **mega evolution was priced off the body that left the field** — in both families.
Fixed at the seven species doors, where the authority writes it. **Census 784 → 786 live / 786 probed
/ 0 missing.** Empirical board-material **117 → 114 of 961** (`arms_comparable`: COMPARABLE).
**The Moonblast five are NOT this cause** — Moonblast carries no weight shape at all.

---

## 1. THE MEMBERSHIP, DERIVED FROM THE FORMAT AND NOT FROM MEMORY

```
SHOWDOWN_PATH=... node -e "
const {Dex}=require(process.env.SHOWDOWN_PATH+'/dist/sim');
const D=Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
for(const m of D.moves.all()) if(legal(m) && /[Ww]eight/.test(String(m.basePowerCallback)+String(m.onModifyMove))) ...
"
```

**TOTAL: 4 legal moves.** `data/mods/champions/moves.ts` carries **no `basePowerCallback` at all**
(grepped over the whole file), so all four inherit mainline verbatim.

| move | family | corpus uses (`tags.json`) |
|---|---|---|
| **Low Kick** | `targetWeightKg` | 8,484 |
| **Grass Knot** | `targetWeightKg` | 607 |
| **Heavy Slam** | `weightRatio` | 526 |
| **Heat Crash** | `weightRatio` | 16 |

The card names two; the membership is four, and the fix covers all four because it is a fix to the
WEIGHT, not to either handler.

**The authority's thresholds are in HECTOGRAMS** (`target.getWeight()` returns `weighthg`), so
`>= 2e3 / 1e3 / 500 / 250 / 100` is **200 / 100 / 50 / 25 / 10 kg**. `data/tags.json` already carries
them converted: `grassknot.variablePower.brackets = [[200,120],[100,100],[50,80],[25,60],[10,40],[0,20]]`.
**The derivation was not the bug.**

## 2. WEIGHT IS NOT STATIC, AND THE AUTHORITY READS THE CURRENT ONE

- `Pokemon#getWeight()` = `runEvent('ModifyWeight', ..., this.weighthg)`, floored at 1 — `sim/pokemon.ts:685`.
- `Pokemon#setSpecies` = `this.weighthg = species.weighthg` — `sim/pokemon.ts:1402`.
  **Every** identity change goes through it: Champions' own `formeChange` override
  (`data/mods/champions/scripts.ts:57-60`) and `clearVolatile`'s closing
  `setSpecies(this.baseSpecies)` (`:176` of the same override).
- `Pokemon#transformInto` = `this.weighthg = pokemon.weighthg` — `sim/pokemon.ts:1298`.
- Modifiers legal in Reg M-B: **Heavy Metal** (×2, one carrier: Aggron) and **Light Metal**
  (`trunc(hg/2)`, two carriers: Scizor, Metagross). **Float Stone and Autotomize are both
  `isNonstandard: 'Past'`** — banned — so they cannot move a weight here.
  Those two abilities were already wired (`effWeight`, ROADMAP #213) and are untouched.

## 3. THE DEFECT

`megaEvolveNow` rewrote `st`, `name`, `types`, `_bsAtk` and `ability` and **never `wt`**. Neither did
`formeSwap`, the Forecast rename, the Forecast switch-out revert, `revertMegas`, or the two
`formeRenamedNoRow` branches. Transform was the one door that already kept it in step (`m.wt=t.wt`).

**Both cards the review named are exactly this, and the arithmetic closes:**

| card | move | true weights | authority BP | our BP | predicted ratio | observed ratio |
|---|---|---|---|---|---|---|
| **#28** | Grass Knot → **Staraptor-Mega** | 50 kg (base 24.9) | `>=50` → **80** | `>=10` → **40** | 0.500 | **0.478** (11 vs 23) |
| **#10** | **Steelix-Mega** Heavy Slam → Kingambit | 740/120 = 6.17 (base 400/120 = 3.33) | `>=5` → **120** | `>=3` → **80** | 0.667 | **0.677** (42 vs 62) |

Both bodies were at full HP on a switch-in, so the prior is not in doubt, and both ratios sit outside
the 0.85–1.177 band two rolls of one base can span.

**The other two weight cards in the same dump are roll residue and were left alone**, which is the
control that says this is a bracket bug and not "weight moves are wrong":
`#74 Low Kick → Staraptor 71 vs 75 (0.947)` and `#48 Heat Crash → Falinks 116 vs 103 (1.126)` — both
inside the band, both landing in the same bracket on either reading.

## 4. THE FIX — AT THE DOOR, NOT AT THE READER

`engine/medicham2-browser.js`. One new function, `weightFollowsForme(m)`, called at **seven** species
doors. `effWeight` is unchanged.

**A reader-side fix was written first and thrown away, and the reason matters.** Reading
`monRow(m.name).wt` inside `effWeight` is one line and is WRONG: `m.wt` is a real per-body field in
the authority too, a caller is entitled to set it, and the census already has a probe that does —
`weightBased` puts 5 kg and then 400 kg on ONE Garchomp so that weight is the only thing moving. A
reader that went behind that field would have discarded the override and turned a working probe green
for the wrong reason. The authority writes the field at `setSpecies`; so do we.

Two of the seven doors are provably no-ops today and are wired anyway rather than reasoned about:
Castform's four formes all weigh 0.8 kg and Cherrim's two both weigh 9.3 kg (derived, not recalled).

**The fallback is loud.** Where the forme standing on the field has a row with no `wt`,
`MEDFAILS.weightRowNoValue` counts it and names the first; where it has no row at all,
`MEDFAILS.weightNoRow` does. Measured on a staged board: `weightRowNoValue 2, first falinks-mega`.

## 5. THE PROBE — RED FIRST

Two census rows, `tests/test-mechanics.js`, tag `move:variablePower`:

- *a MEGA EVOLUTION moves the TARGET weight the brackets are read from*
- *a MEGA EVOLUTION moves the USER weight the Heavy Slam ratio is read from*

**The observable is a RATIO against a fixed-power control move of the same type and category**
(Low Kick vs Brick Break; Grass Knot vs Energy Ball; Heavy Slam vs Iron Head). A mega changes Defence,
Attack and sometimes types, so raw damage cannot attribute a step to the weight — it moves on an
engine that reads no weight at all. Every multiplier the mega touched is common to both moves and
cancels; what is left is the base power.

**Two rungs each plus a non-crossing control**, because both families are step functions:

| arm | weight | bracket | BP | step before | step after |
|---|---|---|---|---|---|
| Pidgeot (target) | 39.5 → 50.5 | `>=25` → `>=50` | 60 → 80 | **0.0%** | **+32.0%** |
| Sableye (target) | 11 → 161 | `>=10` → `>=100` | 40 → 100 | **+2.5%** | **+152.3%** |
| Steelix (target) — CONTROL | 400 → 740 | `>=200` both | 120 → 120 | −4.2% | **−4.1%** |
| Tyranitar (user ratio) | 1.98 → 3.66 | `<2` → `>=3` | 40 → 80 | **−1.7%** | **+94.1%** |
| Kingambit (user ratio) | 3.33 → 6.17 | `>=3` → `>=5` | 80 → 120 | **0.0%** | **+51.4%** |
| Whimsicott (user ratio) — CONTROL | 60.6 → 112 | `>=5` both | 120 → 120 | −1.6% | **−1.6%** |

The controls are what separate this from *"a mega deals more damage"*: they mega, they gain weight,
they cross no bracket, and their ratio must not step. Their residue (−4.2% / −1.6%) is the `+2` and
the two floors in the damage formula, present before and after the fix. Thresholds: a crossing must
move the ratio by **>20%**, a control by **<8%** — set in open ground, not tuned to the measurement.

**RED ON DEMAND.** `MEDI_WEIGHT_STATIC=1` leaves the stamp alone at every door and stamps
`MEDFAILS.weightStaticRestored`. Under it the census reads **784 live, 2 missing**, and the two
missing rows are exactly these two. The four crossing arms collapse onto the controls.

## 6. WHICH SCOREBOARD — STATED BEFORE THE RUN, AND BOTH MOVED

Predicted **both**: the lab because the mechanic is staged directly, and the pool because Low Kick is
8,484 corpus uses and the card had already found two board-material games.

| | before | after |
|---|---|---|
| census (live / probed / missing) | 784 / 784 / 0 | **786 / 786 / 0** |
| empirical board-material of 961 | **117** | **114** |
| empirical protocol-diverged | 233 | 231 |
| `-damage field 3` first-divergence games | 20 | **17** |
| `by_cause` BOARD-MATERIAL | 112 | 109 |
| end-state verdicts | 875 / 81 / 3 / 0 / 2 | **unchanged** |
| damage differential, 6000 comparisons, seed 20260804 | 0 disagreements | **0 disagreements** |
| census `threw` / `hollow` / `unarmed` / `directCall` | 0 / 0 / 0 / 1 | **0 / 0 / 0 / 1** |

Pins, both runs: `--games 1200` (yields 961), `--arm middle`, `--turns 12`, `--steering empirical`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`.
Engine release `e129bca605e3` → **`b39a5c87fe2d`** (cut for this pass). `arms_comparable.js` reads
**COMPARABLE**. After-artifact: `data/verification/game-differential.weightfix.json`.

**Three games, not two.** The card verified two by hand; the third is a weight case outside the
235-card dump window. `-damage field 3` fell by exactly 3, so nothing else moved into or out of the
class.

## 7. THE MOONBLAST FIVE ARE A DIFFERENT CAUSE — ESTABLISHED BEFORE THE FIX

**Moonblast carries no weight shape** — it is not one of the four members, so a weight fix cannot
touch it, and the re-run confirms it did not. All twenty-one `-damage field 3` cards in the dump,
with the move that produced them:

```
#8   moonblast → Gengar        45 vs 34   1.324
#47  moonblast → Floette-Mega  52 vs 67   0.776
#49  moonblast → Floette       57 vs 75   0.760
#97  moonblast → Archaludon   117 vs 88   1.330
#226 moonblast → Toxapex       74 vs 82   0.902
```

Four of the five are outside the roll band and they point in BOTH directions, which is what a stale
stat STAGE looks like rather than a base-power error — consistent with the review's own H3 hypothesis
that Moonblast's 30% SpA-drop secondary landed on one side and not the other on an earlier turn.
**Not separated here, not fixed here, and not claimed.** It is a separate batch.

---

## OWED, NOT RUN

- **`data/engine-data.js` has ten rows with `wt: null`, and ENGINE does not own that file.** Named on
  the hand list since 2026-08-23 as *"uncomputable rather than wrong"*; it is now measured, and it is
  worse than that. The fallback keeps the base forme's weight, and **6 of the 10 land in a DIFFERENT
  Low Kick bracket from the truth**:

  | row | true kg | fallback kg | bracket |
  |---|---|---|---|
  | `victreebel-mega` | 125.5 | 15.5 | **100 vs 10** |
  | `feraligatr-mega` | 108.8 | 88.8 | **100 vs 50** |
  | `skarmory-mega` | 40.4 | 50.5 | **25 vs 50** (the only one that should go DOWN) |
  | `barbaracle-mega` | 100 | 96 | **100 vs 50** |
  | `gourgeist-small` | 9.5 | 12.5 | **0 vs 10** |
  | `gourgeist-super` | 39 | 12.5 | **25 vs 10** |
  | `falinks-mega` | 99 | 62 | 50 vs 50 |
  | `aegislash-blade` | 53 | 53 | 50 vs 50 |
  | `gourgeist-large` | 14 | 12.5 | 10 vs 10 |
  | `palafin-hero` | 97.4 | 60.2 | 50 vs 50 |

  Filling those ten `wt` fields is a one-line-per-row write to `data/engine-data.js` and belongs to
  whoever owns the builder. `MEDFAILS.weightRowNoValue` will fall to zero when it lands.
  **No Skarmory-Mega down-step arm exists in the probe for exactly this reason** — it is the only
  mega in the format whose weight goes DOWN across a bracket, and its row has no `wt`, so the arm
  would have been asserting the data hole rather than the mechanic.

- **`weightNoRow` has never been observed above zero.** It is the `formeRenamedNoRow` family
  (Morpeko-Hangry, Mimikyu-Busted). Nothing staged reached it in this pass, so the branch is written
  and unexercised.

- **The narration gate.** No `|-damage|` VALUE lines are in scope of this pass beyond the three that
  moved; the weight fix emits no new lines and removes none.

- **`data/engine-diff.json` WAS republished, and that was not intended — stating it rather than
  burying it.** `tests/test-engine-diff.js` has **no `--out` flag** (only `--write`, and it writes by
  default once the sample is not smaller than the artifact's), so the 6000-comparison run at seed
  20260804 overwrote it. **The only line that changed is `generated`** — `compared 6000`,
  `agreed 6000`, `disagreed 0` at both endpoints are byte-identical to the version at HEAD, so
  nothing was lost and the artifact now describes the post-fix engine rather than `e129bca605e3`.
  The earlier n=150 run was correctly REFUSED by the smaller-sample guard and went to
  `data/verification/engine-diff.n150.json`.

- **The roster stages were not re-run.** They were already `MEASURED AGAINST A DIFFERENT ENGINE` before
  this pass (release `e129bca605e3` against a moved tree) and remain so; this pass did not make that
  worse and did not fix it.

- **Nothing was committed and nothing was pushed.**
