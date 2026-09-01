# The accuracy stage and the evasion stage are ONE clamped stage — and the truncation reaches further than the combination does

Batch of one, from the misconception audit's row A1
(`docs/_reports/2026-08-31-misconception-audit.md`). Prediction written to disk before any run:
`data/verification/2026-08-31-accuracy-stage-combine-prediction.json`.

---

## 1. THE AUTHORITY, AND THE TWO-CLAMP DETAIL IS AS DESCRIBED — BUT ONLY ONE CLAMP CAN BITE

`sim/battle-actions.ts:713-727`, inside `hitStepAccuracy`:

```js
let boost = 0;
if (!move.ignoreAccuracy) {
  const boosts = this.battle.runEvent('ModifyBoost', pokemon, null, null, { ...pokemon.boosts });
  boost = this.battle.clampIntRange(boosts['accuracy'], -6, 6);
}
if (!move.ignoreEvasion) {
  const boosts = this.battle.runEvent('ModifyBoost', target, null, null, { ...target.boosts });
  boost = this.battle.clampIntRange(boost - boosts['evasion'], -6, 6);
}
if (boost > 0)      { accuracy = this.battle.trunc(accuracy * (3 + boost) / 3); }
else if (boost < 0) { accuracy = this.battle.trunc(accuracy * 3 / (3 - boost)); }
```

**Champions does NOT override `hitStepAccuracy`.** `grep hitStepAccuracy data/mods/champions/scripts.ts`
is empty; the mod's only `ignoreAccuracy` / `ignoreEvasion` text is at `:487` and `:496`, inside
`hitStepMoveHitLoop`'s `multiaccuracy` branch, which is hits 2..n of a multi-accuracy volley and a
different question. The probe asserts this from the file on every run.

**The two clamps are separate and nested exactly as the brief says, and the FIRST one cannot bite.**
A stage is already held inside ±6 when it is applied, and the one `onModifyBoost` ability with a legal
carrier in this format — Unaware, 2 carriers — sets a stage to **zero** rather than out of range. So
`clampIntRange(boosts['accuracy'], -6, 6)` is a no-op here. **The SECOND clamp is the whole caps
result**: `-6 - (+6)` is `-12` and must come back as `-6`, which is 33 and not 11.

`trunc` is not `Math.trunc`. `Dex#trunc` is literally `num >>> 0` (`sim/dex.ts:391`). The engine now
uses `>>> 0` for that reason; accuracy here is bounded by 3× the printed value, so the 32-bit wrap
that would separate the two cannot be reached.

### The ignore flags, enumerated over the format

Filtered `exists && !isNonstandard && tier !== 'Illegal'`, 500 legal moves:

| flag | legal moves | which |
|---|---|---|
| `ignoreAccuracy` | **0** | — the clause can never be taken in this format |
| `ignoreEvasion` | **2** | Darkest Lariat, Sacred Sword |
| `multiaccuracy` | **2** | Population Bomb, Triple Axel |

Abilities that set `move.ignoreEvasion` from `onModifyMove`: **Keen Eye and Illuminate**, both wired
and both probed (`ability|ignoresEvasion`). **The MOVE half is NOT modelled** — see OWED.

---

## 2. WHAT THIS ENGINE DID

```js
if(_ab)acc*=accStageMul(_ab);
if(_eb)acc/=accStageMul(_eb);
```

Two lookups, multiplied, no combined clamp, no truncation, and sitting **above** the modifier walk.
Every number below is the authority's own, captured from the argument it passes to
`randomChance(accuracy, 100)` on a real staged Champions battle — not computed here:

| printed | acc stage | eva stage | ABRA before | AUTHORITY |
|---|---|---|---|---|
| 100 | −1 | +1 | 56.25 | **60** |
| 100 | −2 | +2 | 36.00 | **42** |
| 100 | −6 | +6 | 11.11 | **33** |
| 100 | +1 | +2 | 80.00 | **75** — *the direction reverses* |
| 95 | −1 | +2 | 42.75 | **47** (47.5 before the truncation) |
| **95** | **0** | **+1** | **71.25** | **71** |
| **80** | **0** | **+6** | **26.67** | **26** |

### The finding that was not in the brief: the last two rows have ONE stage at zero and still part

The audit — and my own first draft of this probe's header — said the two forms *"agree exactly
whenever one side is zero."* **That is false.** They agree when one side is zero **and the result is
an integer**. The truncation runs on any non-zero combined boost, so a one-sided stage on a
95- or 80-printed move parts too.

That matters twice:

1. It **widens the population** from "both stages non-zero" (essentially unreachable in the pinned
   pool) to "any stage at all, on a move whose printed accuracy is not a multiple of the denominator".
2. It **caught an existing census row that was pinning the bug.**
   `ability|accuracyMod — the bot PRICES an evasive body` asserted `0.2667,0.2667` for an 80-printed
   move at +6 evasion. The authority reads **26**. That row went MISSING on the first census run after
   the fix, and its expectation is corrected to `0.26` — not from arithmetic, but from the
   `trunc-eva6` arm, which stages that exact board on the real simulator and reads what the authority
   rolls against.

---

## 3. THE FIX

The stage step is now ONE combined, clamped boost, looked up once and truncated, and it has **moved
below the modifier walk**, which is the authority's own order:

```js
_bst = clamp(Math.round(+_ab||0), -6, 6);
_bst = clamp(_bst - Math.round(+_eb||0), -6, 6);
if (_bst !== 0) { const _pre = (_bst>0) ? acc*(3+_bst)/3 : acc*3/(3-_bst); acc = _pre >>> 0; }
```

**The reorder is not tidying.** `hitStepAccuracy` runs `runEvent('ModifyAccuracy', ...)` — Bright
Powder, Wide Lens, Zoom Lens, Compound Eyes, Hustle, Sand Veil, Snow Cloak, Wonder Skin, Tangled Feet
and Gravity are all `onModifyAccuracy` / `onSourceModifyAccuracy` handlers — and only *then* the
stages. Multiplications commute, so the old order was harmless while there was no truncation. The
moment one exists, the order decides where the fraction is thrown away: Compound Eyes on a 90-printed
move into +1 evasion is `trunc(117 * 3/4) = 87` on the authority and `trunc(90 * 3/4) * 1.3 = 87.1`
the other way round. Putting the stage step below the walk makes the two agree by construction.

**Three counters, not one**, because the three populations differ by orders of magnitude and one
number would hide which a run exercised:

| counter | what it counts | staged reading |
|---|---|---|
| `MEDSEEN.accStageCombined` | every check with a non-zero combined boost | 5 of 6 staged calls |
| `MEDSEEN.accStageBothSides` | the subset where BOTH stages are non-zero | 1 |
| `MEDSEEN.accStageTruncated` | the subset where `>>> 0` actually threw a fraction away | 2 |

`MEDI_ACC_EVA_SEPARATE=1` restores the old pair **at the old position**, so the restore arm is the old
function rather than a rearranged approximation of it. It stamps `MEDFAILS.accEvaSeparateRestored` at
declaration and is registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`.

---

## 4. THE SCOREBOARD WAS NAMED BEFORE THE RUN, INCLUDING THE HONEST PROBABILITY CAVEAT

**Said before the run:** *this is a LAB-FIRST move.* It alters a RATE, not a deterministic value, and
Mode A pins the dice. The two corner arms hold the accuracy die at a constant (every sub-100 move
misses, or every one hits), so 56.25 → 60 cannot be seen there **at all**. Only the `middle` arm draws
a live seeded value per address, and only a die landing in the gap flips a board.

Measured from the pinned pool **before** the run, not asserted:

| | pinned pool (13,214 bo3 games / 26,428 team sheets) |
|---|---|
| sheet entries carrying an evasion-stage mover | **47** — Minimize 42, Sweet Scent 3, Double Team 2 |
| sheet entries carrying an accuracy-stage mover | Muddy Water 1,009, Coil 724, Night Daze 15, Mud-Slap 8 |
| games with an evasion-stage mover **on either side** | **40 of 13,214** (0.30%) |
| games pairing an accuracy-stage mover against an evasion-stage mover | **2 of 13,214** (0.015%) |

A 961-game sample therefore expects **~0.15 games** in which both stages could be non-zero on one
check — and in each the move must be brought, clicked, and land. Hence the point estimate of
**unmoved**.

| # | prediction | point | band | measured |
|---|---|---|---|---|
| P1 | census live | 819 | 819 | **819** |
| P2 | census probed | 819 | 819 | **819** |
| P3 | census missing / hollow / threw | 0 / 0 / 0 | 0 / 0 / 0 | **0 / 0 / 0** |
| P4 | board-parted of 961 | 82 | 80-84 | **82** |
| P5 | protocol-diverged of 961 | 172 | 169-175 | **172** |
| P6 | distinct causes | 150 | 146-154 | **150** (0 added, 0 removed)** |
| P7 | end-state verdicts | 905/53/2/0/1 | ±2 any cell | **905/53/2/0/1** |
| P8 | sample identity | identical | identical | **identical on every field checked** |
| P9 | `probe_accuracy_stage_combine.js` clean | GREEN | GREEN | **GREEN** |
| P10 | the same probe `--red` | GREEN (lives part, controls hold) | GREEN | **GREEN** |
| P11 | census under the knob | 818 live / 1 missing, refused to write | narrow | **MISS — 817 live / 2 missing**, refused to write |
| P12 | new silent-fallback counter | 0 | 0 | **none was added** |
| P13 | `tests/test-engine-diff.js` | NOT RUN | declared | **not run** |

**P11 missed, in the informative direction and for a reason worth stating.** I predicted the knob
would move exactly one row. It moves **two**: my new row, and
`ability|accuracyMod — the bot PRICES an evasive body`, whose expectation the fix corrected from
0.2667 to 0.26. Under the knob the engine goes back to the old arithmetic and that row is honestly
red too. Two of 819 is still narrow, and the census was **REFUSED** on that run — the artifact digest
`1dd3020d0708` is byte-identical either side of it.

**Sample identity, checked and not assumed.** 961 games both runs, `turns_cap` 12, arm `middle`,
steering `empirical-click/v1`, pin digest `ccb365985023`, census pin `9446a684709d`,
`--team-store data/team-pool-frozen`, `closet.teams_dropped` 43, `coverage.exercised` 556,
`order_probe` 0 rows, turn-1 boards identical 956, median turn of first board divergence 5, `mode`
string identical (`A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real`). **The class
table, the 60-entry `first_divergences` list, the coverage block and the end-state summary are all
byte-equal between the two artifacts.**

Artifacts: `data/verification/game-differential.accstage.json` and
`data/verification/divergence-turns.accstage.json`, release `52e0e7effbd6`, `--dump-games 250`.
**`data/game-differential.json` was NOT touched** — its mtime is still 2026-08-28 23:14.

### A SECOND, INDEPENDENT SCOREBOARD ALSO DID NOT MOVE

The first differential of this pass was run with the DEFAULT `coverage` steering by mistake
(`--steering` was omitted, and the published 82/172 figures are `empirical`). It is reported rather
than discarded, because it is a real reading of a different sample: **961 games, 6 protocol-diverged,
board-parted 0 of 961**, which is exactly the coverage-steering figure standing since 2026-08-29
(*"961 games / 6 raw / 6 declared / 0 that count"*). **Both scoreboards are unmoved.**

That run also wrote `data/divergence-turns.json`, because `--out` redirects the main artifact and
`--dump-out` is a separate flag. It was **restored from HEAD immediately** (`git checkout --`) and the
re-run wrote to `data/verification/divergence-turns.accstage.json`. Recorded because a silent clobber
of a published artifact is the failure this repository keeps paying for; nothing was lost.

---

## 5. THE TWO INSTRUMENTS, BOTH SHOWN RED FIRST

**`tests/probe_accuracy_stage_combine.js`** — 11 arms over two engines, one turn each, under the
differential's own `middle` pin. **Nothing is typed as an expected accuracy.** The authority is
instrumented at `BattleActions.prototype.hitStepAccuracy` itself: the wrapper writes the two stages
onto the live bodies (the format offers only four accuracy movers and three evasion movers, so
reaching ±6 through moves is a fixture problem rather than a mechanic) and captures the argument the
**same call** hands to `randomChance(accuracy, 100)`. medicham2 is asked `hitChance`, which is the
function its four roll sites call. Then the number is **tied to a board**: every arm spends a real
medicham turn at two dice straddling the authority's number and asserts the HP the target lost.

**Shown RED first: 10 failing assertions across 5 live arms, with all 4 controls already green**, and
every measured number matching the prediction table exactly. GREEN after. GREEN under `--red`, where
every live arm MUST part and every control MUST NOT move.

The over-fire controls, and why each is the one it is:

| control | why | reading, identical before and after |
|---|---|---|
| `both-zero` | the 99% case | 100 / 100 |
| `acc-only` | one stage zero on a **printed-100** move, so the answer is a whole number and the truncation has nothing to take | 75 / 75 |
| `eva-only` | the other side, same reason — and it is the shape every pre-existing census row has | 60 / 60 |
| `keeneye` | **both stages non-zero on the board** while the attacker's ability sets `move.ignoreEvasion`, so the authority never takes the second clause. The composition check for the `ignoresEvasion` consumer that sits two lines above the rewritten arithmetic | 75 / 75 |

and `reverse` is the arm that stops "make everything more accurate" passing: +1 accuracy into +2
evasion is 80 on the old arithmetic and **75** on the authority.

**`tests/test-mechanics.js`, `move|accuracyMod`** — one new census row, four live arms with BOTH
stages non-zero and three controls, all read as HP lost on a real turn with the die pinned to a
constant chosen to sit between the two engines' answers. Before the fix it read
`A 0 / B 0 / C 64 / D 0` against `A>0 / B>0 / C=0 / D=0`; after, `A 62 / B 58 / C 0 / D 0`. The six
control readings are **byte-identical across the knob** (64/0, 62/0, 64/0), which is what says the
knob is narrow rather than that the arms are insensitive.

Arm D is a **guard rather than a demonstration**: 95 printed at a combined −3 is 47.5 untruncated and
47 truncated, so a die of 0.473 misses on the authority and would HIT on a combined-but-untruncated
fix. It reads the same before and after on purpose — what it catches is the *wrong* fix.

---

## OWED, NOT RUN

- **`move.ignoreEvasion` IS NOT MODELLED, and it is a real, separate defect.** Two legal carriers,
  **Darkest Lariat and Sacred Sword**, both `ignoreEvasion: true` in the dex
  (`data/moves.ts:3333` for the first). `data/tags.json` gives both of them
  `ignoresBoosts {defensive: true}` — which is derived from `ignoreDefensive` and is the **damage
  chain's** business — and **no tag anywhere carries `ignoreEvasion`**, so nothing in `hitChance`
  reads it. Against a target on positive evasion both moves are less accurate here than in the real
  game. The fix is a param on the existing `ignoresBoosts` derivation (`engine/tag_dex.js:5034`) plus
  one read; membership does not change, because both carriers already hold the tag. **It was left out
  deliberately to keep this a batch of one**, and the probe's "ignores one half" control uses the
  ABILITY carrier instead, which is the implemented one. `ignoresBoosts` is 4,423 corpus uses.
- **`MEDSEEN.accStageCombined / accStageBothSides / accStageTruncated` have no pool-scale reading.**
  `game_differential.js` surfaces no `MEDSEEN`, so all three have only been read on a staged board.
  The *right* next measurement for this batch is "how many accuracy checks in the 961-game pool carry
  a non-zero stage, and how many of those truncate" — it would turn the ~0.15-game estimate above into
  a count. It needs a change to the differential's reporting, which is not this batch.
- **`tests/test-engine-diff.js` was NOT run.** It has no `--out` and would republish
  `data/engine-diff.json`, from which the published `0 of 6,000 at all sixteen corners` is read.
  Nothing here touches a damage byte — the change decides WHETHER a move connects, above every damage
  step. Stated rather than quietly skipped.
- **The three roster stages were NOT re-run** and already read `MEASURED AGAINST A DIFFERENT ENGINE`
  before this pass (they ran on `e129bca605e3` against a tree that was already `b43a2fea0cb1`). This
  batch does not worsen them and does not repair them.
- **The `multiaccuracy` second path is unexamined.** Champions gives hits 2..n of Population Bomb and
  Triple Axel their own **separately-multiplied, separately-clamped, untruncated** accuracy block
  (`data/mods/champions/scripts.ts:484-505`) — that is, the arithmetic this batch just removed from
  `hitStepAccuracy` is *correct* there and lives in a different function. I did **not** check what
  medicham2 does for arrivals 2..n of those two moves. 1,880 corpus uses of the two combined.
  Hypothesis, not a finding.
- **`ModifyBoost` is not modelled at all.** Unaware (2 legal carriers) zeroes the target's evasion
  when it attacks and the attacker's accuracy when it defends, via `onAnyModifyBoost`
  (`data/abilities.ts:5207-5221`). The engine reads `att.boosts.acc` and `def.boosts.eva` raw. I
  enumerated the carriers and did not check the engine, so this is a hypothesis; it is named here
  because the brief asked about `ModifyBoost` and the honest answer is "one ability, two carriers, not
  looked at".
