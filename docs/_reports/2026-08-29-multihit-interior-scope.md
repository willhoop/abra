# Reaching multi-hit counts 3 and 4 — a scope, 2026-08-29, ENGINE

**SCOPING PASS. No game was played, no roster stage, no census, no `all_mechanics_fire`, no
differential, no `tags.json` regeneration. Nothing was committed. Everything below is a source read,
a `Dex.forFormat` derivation, or an arithmetic check.**

Verdict, four lines:

1. **The arm machinery CAN express 3 and 4** — as a *parameterised* corner, not a new boolean. The
   generalisation `Math.floor(corner * m)` is bit-identical to today's `top ? m - 1 : 0` at both
   shipped corners (0 mismatches, `m = 1..200,000`), and it is the identity `armClaims` **already
   asserts for medicham2's half of the same pin**. What it costs is not the line — it is a third
   `armClaims` branch, or `game_differential.js` exits 1 at load and takes every roster run with it.
2. **`multiaccuracy` is a DIFFERENT defect, and the two questions are disjoint by construction.**
   Derived from the format: 14 legal multiHit moves, **8** carry `[2,5]`, **2** carry `multiaccuracy`
   (`populationbomb`, `tripleaxel`) — and both of those have a **fixed** count. The intersection is
   **empty**. All 7 of card B3's games are `tripleaxel` or `populationbomb`; **none draws a hit count
   at all**.
3. **The volley loop is cheaper than the 2026-08-28 report said, and that report's central claim is
   wrong.** `hitStepMoveHitLoop` is a **sibling** of `moveHit`, not two levels above it — both sit
   below `useMoveInner`, so it drags in no `-ate` and no accuracy step. It would take
   `skipped_multihit` **134 → 0**; it would **not** touch `skipped_ability_multihit` 17.
4. **`ranged mechanics fully staged 0 of 8` cannot be moved by ANY of the three routes as they
   stand.** `coverage.js` computes `interior = hi - lo - 1` straight out of `tags.json`. It is a
   restatement of the declared range, not a measurement of what an arm reached. It moves only when
   something WRITES the reached counts and `rangeStaged()` reads them.

**Recommended route: A (the probes), then C (the volley loop) as a separate pass. Not B.**

---

## 0. WHAT WAS DERIVED, PRINTED BEFORE USE

`Dex.forFormat('gen9championsvgc2026regmb')`, filtered `exists && !isNonstandard && tier !== 'Illegal'`
— 500 legal moves, 14 with `multihit`:

| move | multihit | multiaccuracy | acc | smartTarget |
|---|---|---|---|---|
| bonerush | `[2,5]` | no | 90 | no |
| bulletseed | `[2,5]` | no | 100 | no |
| iciclespear | `[2,5]` | no | 100 | no |
| pinmissile | `[2,5]` | no | 95 | no |
| rockblast | `[2,5]` | no | 90 | no |
| scaleshot | `[2,5]` | no | 90 | no |
| tailslap | `[2,5]` | no | 85 | no |
| watershuriken | `[2,5]` | no | 100 | no |
| doublehit | 2 | no | 90 | no |
| dragondarts | 2 | no | 100 | **yes** |
| dualwingbeat | 2 | no | 90 | no |
| twinbeam | 2 | no | 100 | no |
| **tripleaxel** | **3** | **yes** | 90 | no |
| **populationbomb** | **10** | **yes** | 90 | no |

`data/tags.json` (generated 2026-08-29T02:44Z) agrees **exactly**: 14 `multiHit`-tagged moves, the
same 8 with `params.multiHit.range = [2,5]`, and `params.multiAccuracy = {perHit:true, accuracy:90}`
on exactly `tripleaxel` and `populationbomb`. **The card's set is verified, not inherited.**

**`loadeddice` is BANNED in this format (`isNonstandard: 'Past'`).** Both `loadeddice` branches of
`hitStepMoveHitLoop` (`data/mods/champions/scripts.ts:442`, `:452`) are dead here, which removes the
one other lever that could reach 4 and 5. Skill Link is legal on **Heracross-Mega and Toucannon
only**, and it pins to 5 — already implemented and probed.

---

## 1. WHY THE ARMS REACH ONLY THE ENDS — CONFIRMED, WITH THE EXACT MECHANISM

Confirmed. The chain is:

```
scripts.ts:441   targetHits = this.battle.sample([2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,5,5,5])
battle.ts:356    sample(items) -> this.prng.sample(items)
prng.ts          sample(items) -> items[this.random(items.length)]        // ONE-argument random(20)
game_differential.js:3357   installs the arm as `battle.prng.random`
game_differential.js:1389   one-arg branch:  return top ? m - 1 : 0
```

Index 19 → **5**, index 0 → **2**. A `[2,5]` move never reaches the `random(m, n)` RANGE form at all,
which is what the roster note is about. Index→count, measured:

| count | indices | corner `u` that selects them |
|---|---|---|
| 2 | 0..6 | `[0, 0.35)` |
| 3 | 7..13 | `[0.35, 0.70)` |
| **4** | 14..16 | `[0.70, 0.85)` |
| 5 | 17..19 | `[0.85, 1)` |

medicham2 reads the byte-identical table (`medicham2-browser.js:12755`, `MULTIHIT_2_5`) at
`Math.floor(rnd() * 20)` inside `rollHitsOf` (`:12798`), off `battleTurn`'s `rng` — which is
`rngStreams(rng).any`, i.e. the arm's constant scalar. So **both engines index one table with one
number**, and the arm supplies that number on both sides.

### What a third arm would have to answer — and it is a PARAMETERISED arm, not a new id

To land on 3 the arm must answer `random(20)` with an index in **7..13**; on 4, **14..16**. And
medicham2 must land on the same index, which means its scalar must be a `u` with
`floor(u * 20) = that index`. One change satisfies both halves:

```js
// game_differential.js:1389, the scalar one-argument branch
return top ? m - 1 : 0;               // today
return Math.floor(spec.corner * m);   // the generalisation
```

**Measured, not assumed: 0 mismatches over `m = 1..200,000` at both shipped corners.** It is a proven
no-op today. It is also *already the declared semantics of the other half of the same pin* —
`armClaims` asserts, verbatim:

```js
P('the medicham2 scalar picks the TOP integer of any span',
  () => [1, 2, 11, 16, 32].every(s => Math.floor(a.corner * s) === s - 1));
```

So `top ? m - 1 : 0` is a boolean-encoded special case of a rule the file already writes down for
medicham2. Unifying them is the FACTS-ARE-GLOBAL rule, independent of multi-hit.

### The four things a third arm still needs, none of which the one line gives you

1. **Its own `armClaims` branch, or nothing runs.** `armClaims` is `if (a.middle) … else if (a.top) …
   else <bottom>`. An interior corner falls into the bottom branch and fails it immediately
   (`a.chance(1,24) === true` is false at `u=0.5`; `floor(0.5*32) === 0` is false). `PIN_BAD` then
   **`process.exit(1)` at module load** — and `tests/roster.js` requires this module, so it would take
   every roster stage with it. This is exactly what the file records happening when the `middle` arm
   was registered without claims.
2. **The damage index must be INVERTED, not shared.** Showdown's `random(16)` is an index where 0 is
   MAXIMUM; medicham2's `u` is a position where 1 is maximum. The mapping is
   `damageIndex = 15 - floor(u*16)` — which `midDamageIndex` (`:752`) already is. At `u=0.5` that is
   index **7**, not 8. Getting this backwards is the measured cause of 226 of 491 diverging games in
   the middle arm. An interior arm should set `damageIndex: midDamageIndex(corner)`, and the two
   shipped corners satisfy that formula exactly (top→0, bottom→15).
3. **`PINS.arms` would publish a lie.** `corner === CORNER_TOP ? 'top' : 'bottom'` renders any
   interior corner as `'bottom'`.
4. **It is a THIRD GAME, not a multi-hit knob.** The same scalar drives `chance(num, den) =
   random(den) < num`. Measured at `u = 0.5`:

   | | 85/90/95-acc move | 1-in-24 crit | 30% secondary |
   |---|---|---|---|
   | top (`u≈1`) | MISS | no | no |
   | bottom (`u=0`) | HIT | **yes** | **yes** |
   | interior (`u=0.5`) | **HIT** | no | no |

   That combination — sub-100 moves land while no crit and no secondary fires — is reachable by
   **neither** corner, and is arguably worth having on its own merits. But it changes which games get
   played, so `PIN_DIGEST` forks and `arms_comparable.js` must refuse the pair.

**`PIN_DIGEST` note, measured from the source:** the digest is built from `ARMS_RUN`, not `ARMS`.
`ARMS_RUN` is all arms when `--arm` is absent and the named subset when it is present. So adding a
fourth arm forks the digest of a **default** run but not of `--arm middle` or
`--arm top-tie-first,bottom-tie-first`. The load-time `PIN_CLAIMS` guard, by contrast, walks **all**
`ARMS` unconditionally.

**`tests/roster.js` needs nothing.** It resolves `G.ARM_BY_ID.get(armId)` by name per scenario
(`:893`), so a new arm id is selectable by the 8 `[2,5]` rows alone and no other row's arm moves.

---

## 2. IS `multiaccuracy` THE SAME QUESTION? — NO. DISJOINT BY CONSTRUCTION.

**Derived, from the table in §0: `multiaccuracy ∩ [2,5] = ∅` in this regulation.** The two
multiaccuracy moves have fixed counts (3 and 10). The eight `[2,5]` moves roll a count and never roll
per-hit accuracy. These are not "different but related"; they cannot co-occur here.

### Which of B3's 7 is which — all 7 are multiaccuracy, none is a count draw

Pulled from `data/verification/divergence-turns.empirical.json` (mtime 00:26 EDT, settled 3.5 h;
`divergences[]`, keys `arm, config, seed, agreed_lines, cls, cause, end_reason, ended_showdown,
ended_medicham, final_roster, at, before, before_raw, after`). Ten rows have medicham emitting
`|-hitcount|` at the divergence. They split cleanly:

**The 7 that are card B3 — every one `tripleaxel` or `populationbomb`:**

| move (from `before[]`) | medicham | showdown |
|---|---|---|
| Tsareena `tripleaxel` → Swampert | `-hitcount 1` | `-damage 149/175` (hit 2 lands) |
| Maushold `populationbomb` → Blastoise | `-hitcount 1` | `-damage 89/154` |
| Maushold `populationbomb` → Maushold | `-hitcount 4` | `-damage 0 fnt` (hit 5 KOs) |
| Maushold `populationbomb` → Raichu | `-hitcount 1` | `-damage 65/135` |
| Tsareena `tripleaxel` → Whimsicott | `-hitcount 1` | `-supereffective` (another hit) |
| Weavile `tripleaxel` → Metagross | `-hitcount 1` | `-resisted` (another hit) |
| Maushold `populationbomb` → Pelipper | `-hitcount 8` | `-damage 12/135` (hit 9) |

**The other 3 are a different card** — Kangaskhan `doubleedge`, class `extra event emitted by
medicham2`, Showdown emitting `[from] Recoil` where we emit `|-hitcount|p2: <name>|1` after the
target has already fainted (note the malformed slot: `p2:` with no letter). That is Parental Bond
line **ordering and slot rendering**, not a count.

### The two source-level candidates for B3, both cited, neither confirmed without a run

- **medicham2 uses a FLAT printed accuracy.** `rollHitsOf` (`:12813`) reads
  `const _p = (+_ma.accuracy || 100) / 100` and compares `rnd() >= _p`. The authority
  (`scripts.ts:483-505` / `battle-actions.ts:910-936`) re-derives accuracy **per hit** through
  `ModifyBoost` on the user's accuracy, `ModifyBoost` on the target's evasion, `ModifyAccuracy` and
  `Accuracy` before rolling. Any accuracy/evasion boost, or any handler on those events, makes the two
  thresholds differ on the same `u`.
- **medicham2 draws ALL the per-hit accuracy rolls UP FRONT.** `rollHitsOf` is called once per use,
  inside `_stepDamage` for the first target (`:28811`), and walks `for (h = 2; h <= n; h++)` there and
  then. The authority interleaves: hit 1 damage → hit 2 accuracy → hit 2 damage → … Under a constant
  scalar arm that is invisible; under the `middle` arm's address-plus-`nth` scheme (and under real
  dice) the two engines consume different positions. **This run was `--arm middle`.**

**These are an ENGINE defect and an INSTRUMENT artefact respectively, and B3 cannot be attributed
until they are separated.** The probe that separates them is in `## OWED, NOT RUN`. It costs one
staged turn per arm, not a differential.

---

## 3. THE VOLLEY LOOP IN THE DAMAGE DIFFERENTIAL — SMALLER THAN REPORTED, AND THE PRIOR REPORT IS WRONG ON THE KEY POINT

`docs/_reports/2026-08-28-multihit-coverage.md` §3 says the reference "would have to enter at
`trySpreadMoveHit` or above", that this "cannot be repaired by moving the reference up two lines, only
by moving it up two LEVELS", and that "the two levels above this one also roll accuracy". **Read
against the source, that is not the call graph.**

```
useMoveInner            battle-actions.ts:~430   <- onModifyType, the -ate abilities
  trySpreadMoveHit      :550                     <- runs a LIST of hit steps, in order:
      hitStepInvulnerabilityEvent  :621
      hitStepTryHitEvent           :643
      hitStepTryImmunity           :666
      hitStepAccuracy              :690          <- THE accuracy step lives HERE
      hitStepBreakProtect          :755
      hitStepStealBoosts           :781
      hitStepMoveHitLoop           :857          <- the volley loop; calls spreadMoveHit PER HIT
  moveHit                 :1370                  <- calls spreadMoveHit ONCE and returns [0][0]
    spreadMoveHit         :1023
```

`hitStepMoveHitLoop` and `moveHit` are **siblings** over `spreadMoveHit`. Entering at
`hitStepMoveHitLoop` is **one** level, not two: it skips the same six steps `moveHit` skips today, and
it is equally below `useMoveInner`, so the `-ate` situation (CONTROL FIX 13, which reruns
`ModifyType`/`ModifyMove` by hand) is **unchanged**. The per-hit accuracy roll inside the loop is
gated on `move.multiaccuracy && hit > 1` — 2 of the 14 moves — so it does not drag accuracy in for the
other 12.

### The edits it actually needs

1. **`battle.prng.random` must be overridden, NOT `battle.random`.** `:430` currently pins
   `battle.random = (n) => (n === 16 ? roll : 0)`. `battle.sample` goes to `this.prng.sample` →
   `prng.random`, straight past that override — the same trap the file already documents at `:343`
   for `randomChance`. Without this the hit count would be drawn from the **unpinned** `[1,2,3,4]`
   seed and the harness would silently compare a random count.
2. **`move.hit = 1` (CONTROL FIX 9, `:468`) must become conditional.** The loop assigns `move.hit`
   itself; a hardcoded 1 would freeze Triple Axel's `20 * move.hit` at the first hit's power.
3. **The medicham side already has its door — `dmgRange`'s 7th argument.** `dmgRange(att, def, mv,
   field, spread, isCrit, hit)` passes `hit` to `hitPlanOf`, which reads `hit.hits` as a **rolled**
   count (`:11926`, `rolled = (hit && +hit.hits > 0) ? floor(+hit.hits) : 0`). So
   `{ hits: H }` prices exactly H arrivals. **No engine change is needed.** This retires the prior
   report's "different quantities" objection: it is only an expectation when nobody hands it a count.
4. **Take `H` from the AUTHORITY's own `|-hitcount|`.** That is not "constructing the answer from the
   thing under test" — the count is the harness's *control input*, and the count itself is guarded
   separately by `tests/probe_multihit_corners.js` and the two census `multiHit` probes. Taking `H`
   from medicham2 would be the forbidden move; taking it from Showdown is not.
5. **The target must not faint.** `hitStepMoveHitLoop` breaks on `targets.every(t => !t?.hp)`, so a
   KO mid-volley makes the total not `H ×` the packet and the comparison unfair. Same fixture trap
   that killed the first version of `probe_multihit_corners.js`.
6. **Decide about the loop's side effects, explicitly**: `applyRecoilDamage(move.totalDamage)`,
   `battle.eachEvent('Update')` per hit, `faintMessages`, `target.gotAttacked`, `timesAttacked`,
   `add('-hitcount')`, `move.ohko`.

### What it moves, and what it does not

- **`skipped_multihit` 134 → 0** for the 11 drawn moves. `bonerush`, `doublehit` and `tailslap` are
  not in the pool (§4), so they stay at zero either way.
- **`skipped_ability_multihit` 17 stays 17.** Parental Bond sets `move.multihit = 2` in
  `PrepareHit`, which fires in `useMoveInner` — genuinely above this entry point. The harness already
  runs `singleEvent('PrepareHit', ab, …)` on a *probe copy* at `:619` purely to detect it and skip;
  running it on the real move is a second, separate decision.
- **The coverage row `moves the damage diff can compare` does NOT move**, because `coverage.js`
  derives the excluded set from `tags.json` and always subtracts it, regardless of what the run did.

**Cost: a contained change to one function plus a fixture, NOT a rewrite of the reference entry
point.** The risk is not size; it is that this is the file where every historical failure was "an
input that was not held equal", and items 1, 5 and 6 are exactly that shape.

---

## 4. THE THREE NEVER DRAWN — THREE-WAY ANSWER, AND ONE OF THEM IS A FILTER

The damage differential draws its move from `move-priors.json`:
`rows = (movePriors.species[attId] || {}).moves`, then `pick(rows)` **uniformly** (`:1007-1010`).

**None of the three appears anywhere in `move-priors.json`** — not on a dropped species, not at low
`p`. Checked across all 345 species. So the sampler and `test-engine-diff.js` are both exonerated.
The cause is one level up, and it is not the same cause for all three.

Counted in the two human stores (`games.ladder.jsonl` + `games.bo3.jsonl`, `"mv":"…"` clicks):

| move | clicks | by | verdict |
|---|---|---|---|
| **tailslap** | **0** | — | **A FACT ABOUT THE METAGAME.** Nobody has clicked it. Not a defect. |
| **bonerush** | 13 | lucario 4, lucariomega 9 | **A FILTER.** |
| **doublehit** | 8 | pinsirmega 4, scizor 3, mausholdfour 1 | **A FILTER.** |

The filter is `engine/policy.js:349`:

```js
const moves = Object.entries(d.all).sort((a,b) => b[1]-a[1]).slice(0, 8).map(...)
```

**A top-8 truncation with no comment stating why 8.** 318 of the 345 species have exactly 8 move
rows. The carriers' own click tables show how far below the cut these sit:

- `lucariomega`: 8th-ranked move is Rock Slide at **88** clicks; Bone Rush has **9**.
- `scizor`: 8th is Knock Off at **77**; Double Hit has **3**.
- `pinsirmega`: 8th is Thrash at **23**; Double Hit has **4**.

So this is a filter, and it is also **defensible for what the artifact is for** — `move-priors.json`
is a behaviour clone (8 ≥ the 4 move slots a set has), not a coverage source. Two things follow:

- **It is a filter being read as if it were coverage.** `coverage.js` reports "3 were never drawn at
  all", which reads as a hole in the differential and is really a truncation in a behaviour prior. The
  honest phrasing distinguishes "absent from the pool" from "never selected from the pool".
- **Widening it is NOT cheap.** `data/move-priors.json` is one of the files `engine_release.js`
  freezes as a SOURCE. Regenerating it forks every release digest and is a refit trigger — that
  belongs to MEASURE, not here. **Do not widen the slice to fix a coverage row.**

---

## 5. THE COVERAGE ROW IS A RESTATEMENT, NOT A MEASUREMENT — AND THIS IS THE LOAD-BEARING FINDING

`engine/coverage.js:176-194`:

```js
rows.push({ kind, id, tag, lo: r[0], hi: r[1], width: r[1]-r[0]+1,
            interior: Math.max(0, r[1] - r[0] - 1), ... });
...
const full = R.filter(r => r.interior === 0).length;
```

`interior` is `hi - lo - 1` **read out of `data/tags.json`**. It is a property of the declared range
and nothing else. `0 of 8` is therefore not a report of what any arm reached — it is arithmetic on
`[2,5]`, and **it will read `0 of 8` forever no matter what the arms, the roster or the differential
do**, until the metric is given a source.

`tests/probe_multihit_corners.js` is the only thing in the tree that has ever *measured* a reached
count, and it **writes no artifact** — 141 lines of console output. (It also re-types `CORNER_TOP` and
a local copy of `pinRandom` rather than importing them from `game_differential.js`, despite its own
comment saying they were "taken … rather than retyped". That is a second implementation of a fact,
and it is the FACTS-ARE-GLOBAL rule; worth folding in when the probe is next touched.)

**So closing `0 of 8` honestly means: measure the reached counts, WRITE them, and have
`rangeStaged()` read them.** No amount of arm work closes it on its own.

---

## 6. THE THREE ROUTES, RANKED

### A — parameterise the existing probes and write a reached-counts artifact. **RECOMMENDED, FIRST.**

**What changes.** `tests/test-mechanics.js` already carries the exact template:

```js
const TOP = () => 1 - 1e-9, BOTTOM = () => 0;
... works: manyTop === oneTop * 5 && manyBot === oneBot * 2
```

Add `MID3 = () => 0.5` (index 10 → 3) and `MID4 = () => 0.75` (index 15 → 4) and assert
`manyMid3 === oneMid3 * 3`, `manyMid4 === oneMid4 * 4`. The ratio-against-a-single-hit-copy control
divides the damage roll and the crit out exactly, because the die is constant across every packet
within an arm. Icicle Spear stays the carrier (acc 100, so no accuracy interference at any `u`).
Then generalise `tests/probe_multihit_corners.js`'s `top` boolean to a `u` scalar — 4 lines on each
side — so the AUTHORITY's `|-hitcount|` is read at the same `u`, over all 8 `[2,5]` moves, and write
the result.

**Cost.** No engine byte. No arm. No `PIN_DIGEST`. No release. No roster or differential re-run.
Fixture traps already known and documented in the probe (unfaintable target; foes click Iron Defence,
never Protect; a `null` FAILS rather than reading as agreement). Note that this probe compares
**counts**, not damage, so the damage-index inversion of §1(2) does not apply to it.

**What it proves.** That medicham2 lands on 3 and 4 where Showdown lands on 3 and 4, on every `[2,5]`
move — which is the actual question. Two new census rows on `multiHit`: **788 → 790 live**, ENGINE's
one number, up.

**What it does NOT prove.** That an interior count survives a *live game* — a KO mid-volley, a
Substitute breaking on hit 3, an item consumed between arrivals. Only a game reaches those.

### C — the volley loop in the damage differential. **SECOND, AS ITS OWN PASS.**

Cost and edits in §3. Retires `skipped_multihit 134` honestly and puts all 11 drawn multi-hit moves
into the 6,000-row damage comparison for the first time. It is the right home for the *damage* half.
It does not touch counts 3 and 4 specifically — it compares whatever count the pinned die produces —
so it complements A rather than replacing it. Keep the two changes in separate commits: mixing a new
entry point with a new count would make a red row unattributable.

### B — a third/fourth arm. **NOT RECOMMENDED FOR THIS PURPOSE.**

Everything in §1 applies: an `armClaims` branch (or nothing runs at all, roster included), the damage
index inversion, the `PINS.arms` label, a forked `PIN_DIGEST` for default runs, `arms_comparable.js`
refusing the pair, and a whole-game differential re-run against a pool that moves hourly. And the
multi-hit count is the *smallest* thing it changes — an interior corner rewrites accuracy, crits and
secondaries for every move in every game.

**It is still worth building later, for a different reason.** `u ≈ 0.5` reaches a behaviour profile
neither corner can — sub-100 moves HIT while no crit and no secondary fires — which disentangles the
accuracy pin from the crit/secondary pin for the first time. That is an instrument question and it
belongs to MEASURE's judgement about what the arm set should be, not to a multi-hit fix.

---

## 7. WHAT WAS NOT DONE

- Nothing was run beyond source reads, `Dex.forFormat` derivations, `git show HEAD:` artifact reads
  and arithmetic. No game, no roster, no census, no differential, no `tags.json` regeneration.
- `data/verification/*.json` were read at mtime 00:26 EDT against a 03:54 EDT clock — settled, not
  torn. `data/engine-diff.json` was read via `git show HEAD:`.
- **No living-docs change and no `status.js --write`**, per the brief. When route A lands it retires
  nothing currently on the ENGINE hand list; it would ADD the reached-counts artifact as a new
  dependency of `coverage.js`.
- **Two stale prose findings, reported and left in place, not edited:**
  `tests/test-engine-diff.js:467` says *"Rock Blast is one 25-BP hit in dmgRange"* — `dmgRange` now
  prices `hitPlanOf`'s total (the 3.1 expectation, or a rolled count) per ROADMAP #103. And
  `docs/_reports/2026-08-28-multihit-coverage.md` §3's "two LEVELS" claim is refuted in §3 above.
- **One debris-adjacent observation, reported and left:** `engine/archetypes.py.cronbak` sits in
  `engine/`. Not touched.

---

## OWED, NOT RUN

Route A, in order. Each command is a single process and does not read or write anything a MEASURE
agent has pinned.

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown

# ---------------------------------------------------------------------------------------------
# A1. THE PROBE FIRST, AND WATCH IT FAIL. Generalise tests/probe_multihit_corners.js's `top`
#     boolean to a `u` scalar on BOTH halves:
#       authorityHits(moveName, u):  battle.prng.random = (m, n) =>
#                                      n === undefined ? (m === undefined ? u : Math.floor(u * m))
#                                                      : m;
#       mediHits(moveId, u):         const rng = () => u;
#     Sweep u over the FOUR representative points, over all EIGHT [2,5] moves derived from
#     data/tags.json params.multiHit.range (never a name list):
#       u = 0.00 -> index  0 -> 2 hits      u = 0.50 -> index 10 -> 3 hits
#       u = 0.75 -> index 15 -> 4 hits      u = 1-1e-9 -> index 19 -> 5 hits
#     ASSERT: the two engines agree at every (move, u), AND that the counts across u are
#     2/3/4/5 — identical counts across a varied u would mean the knob is unwired.
#     FAIL LOUDLY on a null |-hitcount| (the Protect trap the probe already documents).
#     Keep the foes on Iron Defence. Keep the target unfaintable.
node tests/probe_multihit_corners.js
#     EXPECTED BEFORE ANY CHANGE: the probe only knows two points and cannot answer 3 or 4.

# A2. WRITE THE REACHED COUNTS, because coverage.js has no source today (§5):
#     add `--write data/multihit-counts.json` holding, per move: the declared range, the u swept,
#     the authority's |-hitcount|, medicham2's MEDSEEN.multiHitPacketsDealt, and agreement.
#     Then in engine/coverage.js:rangeStaged(), replace
#         interior: Math.max(0, r[1] - r[0] - 1)
#     with the count of declared interior values NOT present in that artifact's reached set,
#     and ND the row when the artifact is absent (never default it to zero — a silent default
#     here would read as full coverage).
node engine/coverage.js
#     EXPECTED AFTER: `ranged mechanics fully staged 8 of 8`, sourced from a measurement.
#     EXPECTED IF A2 IS SKIPPED: still 0 of 8, whatever A1 proved. That is the point of §5.

# A3. THE CENSUS ROWS. Two probes in tests/test-mechanics.js beside the existing
#     'Icicle Spear lands FIVE hits at one rng corner and TWO at the other', same ratio control
#     (a single-hit copy of the move with its id changed, at the SAME u):
#         MID3 = () => 0.5   assert manyMid3 === oneMid3 * 3
#         MID4 = () => 0.75  assert manyMid4 === oneMid4 * 4
node tests/test-mechanics.js
node engine/status.js
#     EXPECTED: census 788 -> 790 live / 790 probed / 0 missing. Nothing else down.

# ---------------------------------------------------------------------------------------------
# B3 — SEPARATE THE TWO CANDIDATE CAUSES BEFORE ANYTHING IS BUILT (§2). One staged turn, no run.
#     Stage Tsareena Triple Axel into an unfaintable target on the TWO SCALAR CORNERS (where the
#     die is constant and the address scheme cannot be the cause) and read both engines' hit
#     counts. If they AGREE on both corners, B3 is the `middle` arm's per-hit address — an
#     INSTRUMENT defect — and belongs with the arm, not the engine.
#     Then repeat with the target at +2 evasion, or the user at -1 accuracy, on the SAME corner:
#     medicham2 reads a flat 90 out of the tag (medicham2-browser.js:12813) while the authority
#     re-derives it through ModifyBoost / ModifyAccuracy / Accuracy per hit. A difference there
#     is an ENGINE defect and is independent of the arm.
#     THE CONTROL MUST BE EXPLICIT: the same fixture with a NON-multiaccuracy move (Icicle Spear)
#     must read identically on both arms, or the fixture is measuring its own staging.

# ---------------------------------------------------------------------------------------------
# ROUTE C — NOT PROPOSED FOR THIS PASS. If it is taken later, in its own commit, the six edits
#     are §3. The first two are the ones that fail silently if missed:
#       battle.prng.random  (NOT battle.random — sample() bypasses it, as :343 already documents)
#       move.hit = 1        must become conditional, or Triple Axel freezes at the first hit's BP
#     and `dmgRange(..., { hits: H })` with H taken from the AUTHORITY's |-hitcount|.

# ---------------------------------------------------------------------------------------------
# DO NOT: widen engine/policy.js's `.slice(0, 8)` to get bonerush/doublehit into the pool.
#     data/move-priors.json is an engine_release.js SOURCE; regenerating it forks every release
#     digest and triggers a refit. That is MEASURE's, not ENGINE's. And tailslap would still be
#     absent, because nobody has clicked it.
```
