# Four red clauses are one line of code, and the protect residual is two causes, not one

MEASURE, 2026-09-05/06, on a clean tree at `6ab375cc`. Read-only pass: nothing in `engine/`,
`tests/`, `data/` or `docs/` outside this folder was written, and nothing was committed. Diffs below
are proposals, not applied.

---

## VERDICT

**TASK 1.** All four failures of `tests/test-game-differential.js` are **the INSTRUMENT**, and they
are **one root cause**: `engine/game_differential.js:1688` reads `const PRIMARY_ARM = ARMS[0]`, and
`ARMS[0]` stopped being `top-tie-first` on **2026-08-13** when the `middle` arm was prepended
(`cf7a2c5a`). Lines 1692–1694 bind `pinRandom` / `PIN_CHANCE` / `mediRng` to it. Their own comment
says they are *"calibrated against the max-damage endpoint"* — which is `top-tie-first`
(`corner: CORNER_TOP, damageIndex: 0`). They are bound to `middle` (`CORNER_BOTTOM`,
`damageIndex: 8`, live address-keyed dice). The engine is not implicated: the two damage tables are
**exactly equal, all sixteen rolls**, whenever the harness stops critting on one side only.

**TASK 2.** The renormalisation hypothesis is **confirmed as about half the effect and refuted as the
whole of it**. Renormalisation alone predicts **16.2%**, not 20.8%. There is a second amplifier of
comparable size and it is **not a driver defect — it is the denominator**.

---

# TASK 1 — `tests/test-game-differential.js`, 4 FAILURES

## 0. Reproduction

```
cmd.exe /c "tools\lownode.cmd tests\test-game-differential.js"      exit 1
```

```
PART 1 — the pinned die, asserted on its BEHAVIOUR
  ok    all 41 pin claims hold
  FAIL  the two pinned dice disagree at randomChance(90, 100)
  FAIL  the two pinned dice disagree at randomChance(1, 4)
...
PART 3 — the findings §5a filed BY HAND reproduce through this driver
  ok    knock-off order ... AGREES for the whole scripted turn
  ok    contact punish  ... AGREES for the whole scripted turn
PART 3b — the damage interior
  FAIL  the ENDPOINTS disagree for "knock-off order ..." (showdown 108..174, medicham 108..127)
  FAIL  the ENDPOINTS disagree for "contact punish ..."  (showdown 66..104,  medicham 66..78)
...
4 FAILURE(S) — the INSTRUMENT is wrong, which is the only thing this file fails on
```

The file's last line is right, and it is right for a reason the file does not know.

## 1. The root cause, at the line

```js
// engine/game_differential.js
1686  const ARM_BY_ID   = new Map(ARMS.map(a => [a.id, a]));
1688  const PRIMARY_ARM = ARMS[0];
...
1690  /* Kept at module scope and bound to the PRIMARY arm, because the staged measurements below (the
1691   * Knock Off halves, the damage interior) are calibrated against the max-damage endpoint ... */
1692  const pinRandom  = PRIMARY_ARM.random;
1693  const PIN_CHANCE = PRIMARY_ARM.chance;
1694  const mediRng    = PRIMARY_ARM.mediRng();
```

`ARMS` today is `[middle, top-tie-first, bottom-tie-first]` — measured, not read off the source:

```
ARMS      : middle, top-tie-first, bottom-tie-first
PRIMARY   : middle  corner=0  damageIndex=8  middle=true
pinRandom === PRIMARY.random? true   PIN_CHANCE === PRIMARY.chance? true
```

`git show cf7a2c5a^:engine/game_differential.js` has `ARMS = [top-tie-first, bottom-tie-first]` with
the same `ARMS[0]`. The middle arm was inserted at index 0 on 2026-08-13 and its own header says
*"THE MIDDLE ARM IS OPT-IN AND IS NOT PART OF THE DEFAULT SET"*. It became the default binding for
every module-scope consumer in the same commit.

**This is not a proposal to change `PRIMARY_ARM`.** It is genuinely the arm the whole-game run plays
now (`:6700`, `:7268`, `:7372`), and every published board-material figure is a middle-arm figure.
What is wrong is that the *staged* measurements ride on the same constant.

## 2. Failures 1 and 2 — the pinned dice

### What the clause asserts

```js
// tests/test-game-differential.js:52-57
for (const [n, d] of [[100,100],[95,100],[90,100],[50,100],[30,100],[1,24],[1,8],[1,4],[1,2],[1,3]])
  if (G.PIN_CHANCE(n, d) !== (G.pinRandom(d) < n)) fail(...);
```

The settling source line is **`sim/prng.ts:115-117`**:

```ts
randomChance(numerator: number, denominator: number): boolean {
    return this.random(denominator) < numerator;
}
```

The identity holds *only if both sides consume the same draw*. In the two scalar arms they do —
`chance` is literally `random(den) < num` (`game_differential.js:1486`). In the middle arm they do
not, **by explicit design**:

```js
1479  /* `chance` MUST NOT go through the range form in the middle arm: `random(den) < num`
1480   * re-derives a uniform from a floor and loses resolution at small denominators. */
1482  const chance = (num, den) => {
1483    if (spec.middle) { ... return midDraw(...) < (num / den); }
1486    return random(den) < num;
```

and `midDraw` is not repeatable, because `midCtx` appends an incrementing repeat index:

```js
1015  function midCtx(parts) {
1016    const base = parts.join('|');
1017    const n = (MID_NTH.get(base) || 0);
1018    MID_NTH.set(base, n + 1);
1019    return base + '|' + n;
1020  }
```

So `G.PIN_CHANCE(n,d)` and `G.pinRandom(d)` are **two independent uniforms**. The clause asks whether
two independent draws land on the same side of `n/d`. It is not a property that can hold.

### Measured

Same ten rates, per arm:

| arm | disagreements |
|---|---|
| `middle` | **90/100, 1/4, 1/3** |
| `top-tie-first` | none |
| `bottom-tie-first` | none |

And the failing set is **not stable**, because it depends on where in the `nth` sequence the sweep
starts. Three observations in one session: `{90/100, 1/4}` (the test itself), `{90/100, 1/4, 1/3}`
(a second sweep in the same process), `{1/24, 1/3}` (a fresh process). A rate is not the variable;
position in the draw stream is.

### Why it only went red recently — the finaliser, dated

`midHash` gained an avalanche finaliser on **2026-08-27** (`245cb90d`, ROADMAP #489). Replicating
only that four-line hash and evaluating both versions on the driver's own address shape:

| | mean \|u(nth+1) − u(nth)\| | disagreements over the ten rates | crit `randomChance(1,24)` over 16 draws |
|---|---|---|---|
| bare FNV-1a (before 2026-08-27) | **0.043138** | **NONE** | **0 fired** |
| with the finaliser (today) | **0.332859** | 2 | 1 fired |

(0.3333 is the mean gap between two independent uniforms.) Before the finaliser, consecutive draws at
one address were nearly the same number, so `chance` and `random` almost always agreed and the crit
die almost never fired. **The clause and the endpoints both passed by luck for fourteen days.** This
is `tests/test-pin-arms.js` again, in a different file.

### Verdict

**INSTRUMENT.** Plus a **stale assertion in prose** — `game_differential.js:793-794` states:

> *"The two pins are still ONE FUNCTION BY CONSTRUCTION — `PIN_CHANCE(num, den)` is literally
> `pinRandom(den) < num`, which IS `PRNG.randomChance` (sim/prng.ts:115)."*

That is false for the arm those symbols are currently bound to.

## 3. Failures 3 and 4 — the damage endpoints

### The asymmetry, at the line

`damageInterior` (`:6031`) sweeps Showdown by roll index and medicham by die position:

```js
6034    for (let roll = 0; roll < 16; roll++) v = oneHitDamage(a, b, sc.script, { sdRoll: roll });
6054    const u = (16 - 1 - i + 0.5) / 16;
6055    v = oneHitDamage(a, b, sc.script, { mediStreams: inertExcept('dmg', u) });
```

```js
6019  function inertExcept(which, u) {
6020    const S = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
6021                dmg: () => 0.5, stall: () => 0.999, split: true, seed: null };
6022    S[which] = () => u;
```

medicham's crit, accuracy, secondaries and stall are all held inert. Showdown's are not:

```js
6107    battle.prng.random       = (m2, n2) => (n2 === undefined && m2 === 16 ? opt.sdRoll : pinRandom(m2, n2));
6108    battle.prng.randomChance = (num, den) => (den === 16 ? opt.sdRoll < num : PIN_CHANCE(num, den));
```

Only `random(16)` is pinned. Everything else goes to the middle arm's **live** dice. `inertExcept`
is an exact mirror of `top-tie-first` (`chance(num,den) = (den-1) < num` → no crit, no secondary; a
100-accuracy move still hits) and of nothing else.

The crit is the one that fires. Showdown source:

```ts
sim/battle-actions.ts:1633     critMult = [0, 24, 8, 2, 1];              // gen >= 7
sim/battle-actions.ts:1641     moveHit.crit = this.battle.randomChance(1, critMult[critRatio]);
sim/battle-actions.ts:1749-52  const isCrit = target.getMoveHitData(move).crit;
                               if (isCrit) baseDamage = tr(baseDamage * 1.5);
sim/battle-actions.ts:1755     baseDamage = this.battle.randomizer(baseDamage);
sim/battle.ts:2388-90          randomizer(b) { return tr(tr(b * (100 - this.random(16))) / 100); }
```

Measured directly: `PIN_CHANCE(1,24)` fires **1 in 32** consecutive draws. Over the 16 iterations of
`damageInterior` that is 0–3 crits, and a crit at roll index *i* replaces the non-crit value there.

### The arithmetic, both scenarios

Crit is applied **before** the randomizer (`:1751` above `:1755`), so the crit value at index *i* is
`tr(tr(tr(B·1.5)·(100−i))/100)` where `B` is the non-crit pre-roll base.

| scenario | non-crit max = B | `tr(B·1.5)` | observed showdown-only values | index | check |
|---|---|---|---|---|---|
| knock-off (Incineroar Knock Off → Snorlax) | 127 | **190** | **190** | i=0 | `tr(190·100/100)=190` ✔ |
| | | | **174** | i=8 | `tr(190·92/100)=174` ✔ |
| | | | **169** | i=11 | `tr(190·89/100)=169` ✔ |
| contact punish (Incineroar Close Combat → Garchomp) | 78 | **117** | **104** | i=11 | `tr(117·89/100)=104` ✔ |

and the value each one displaces is exactly the medicham-only value reported alongside it:
contact punish loses `69 = tr(78·89/100)` at the same index i=11. Every observed number is accounted
for by the crit multiplier and nothing else.

### The control — a damage bug reproduces; this does not

`damageInterior` is deterministic given the tables. Called fourteen times in one process on the same
scenario (only the `nth` counter advances):

```
  run  1  sd 108..174  me 108..127  onlySD[169,174]     onlyME[112,117]  gap=0.0625
  run  2  sd 108..178  me 108..127  onlySD[178]         onlyME[]         gap=0.0625
  run  3  sd 109..190  me 108..127  onlySD[160,190]     onlyME[108,127]  gap=0.0625
  run  4  sd 108..174  me 108..127  onlySD[166,169,174] onlyME[111,112,117]
  run  5  sd 108..127  me 108..127  onlySD[]  onlyME[]  gap=0   <<< IDENTICAL, ALL 16
  run  6  sd 108..127  me 108..127  onlySD[]  onlyME[]  gap=0   <<< IDENTICAL, ALL 16
  run  7  sd 108..127  me 108..127  onlySD[]  onlyME[]  gap=0   <<< IDENTICAL, ALL 16
  run  8  sd 108..127  me 108..127  onlySD[]  onlyME[]  gap=0   <<< IDENTICAL, ALL 16
  run  9  sd 108..178  me 108..127  onlySD[174,178]     onlyME[117]
  run 10  sd 108..127  me 108..127  onlySD[]  onlyME[]  gap=0   <<< IDENTICAL, ALL 16
  run 11  sd 108..184  ...   run 12  sd 108..187  ...   run 13  sd 108..177  ...   run 14  sd 108..166 ...

  crit-free (fully identical) runs: 5 of 14
```

Three things settle it:

1. **medicham's span is `108..127` on all fourteen calls.** Showdown's moves on every one.
2. **On 5 of 14 calls the two engines produce the identical sixteen values** — both endpoints, zero
   exclusive values on either side, worst per-value probability gap **0.0000**. The same held for
   `contact punish` (run 3 of 3: `sd 66..78 == me 66..78`, both lists empty).
3. Run 3 shows Showdown **losing its minimum** (`109..190`, medicham-only `[108,127]`). A damage
   table that is too high cannot lose the bottom of its own span; a crit at roll index 15 can.

### Verdict

**INSTRUMENT.** The test's own message is the **stale assertion** here:

> *"tests/test-engine-diff.js compares exactly these two endpoints at 149/150, so a disagreement here
> is a damage bug, not a granularity one."*

The claim is false as written — a disagreement here is a *harness* bug when one side's crit die is
live and the other's is pinned off — and the citation has rotted: `tests/test-engine-diff.js:149-150`
is now the `logDroppedRow` helper; the endpoint comparison lives at `:888-889`.

This also explains the apparent contradiction the task named. PART 3's `AGREES for the whole scripted
turn` is measured through `playGame`, where **both** engines get the arm's dice; PART 3b's endpoints
are measured through `oneHitDamage`, where only Showdown does. The interior was telling the truth.

## 4. The proposed diff — NOT APPLIED

**Do not touch `PRIMARY_ARM`.** Bind the staged measurements to the arm they are documented to be
calibrated against, by NAME rather than by position.

```diff
--- a/engine/game_differential.js
@@ -1686,7 +1694,7 @@
 const ARM_BY_ID = new Map(ARMS.map(a => [a.id, a]));
 const PRIMARY_ARM = ARMS[0];
-/* Kept at module scope and bound to the PRIMARY arm, because the staged measurements below (the Knock
- * Off halves, the damage interior) are calibrated against the max-damage endpoint and are NOT swept
- * across arms. Exported under their old names so nothing downstream has to know about arms. */
-const pinRandom = PRIMARY_ARM.random;
-const PIN_CHANCE = PRIMARY_ARM.chance;
-const mediRng = PRIMARY_ARM.mediRng();
+/* BOUND BY NAME, NOT BY POSITION — 2026-09-05. These drive `oneHitDamage`, whose medicham side is
+ * `inertExcept(...)`: acc 0, crit/sec/stall 0.999. That is an exact mirror of `top-tie-first` and of
+ * NOTHING ELSE. `ARMS[0]` was `top-tie-first` until the middle arm was prepended on 2026-08-13
+ * (cf7a2c5a), and that one line silently handed Showdown a LIVE crit die while medicham kept a pinned
+ * one — 4 red clauses in tests/test-game-differential.js, none of them the engine. It stayed invisible
+ * until 245cb90d (2026-08-27) gave the middle hash a finaliser; before that, consecutive draws at one
+ * address differed by 0.043 and the crit simply never fired. `PRIMARY_ARM` is the arm the RUN plays
+ * and must stay `ARMS[0]`; the staged measurements are a different question and now say so. */
+const STAGED_ARM = ARM_BY_ID.get('top-tie-first');
+if (!STAGED_ARM) throw new Error('game_differential: the staged measurements are calibrated against '
+  + 'the max-damage scalar corner and no arm named "top-tie-first" exists. Renaming that arm without '
+  + 'repointing this line would silently re-run the 2026-08-13 defect.');
+const pinRandom = STAGED_ARM.random;
+const PIN_CHANCE = STAGED_ARM.chance;
+const mediRng = STAGED_ARM.mediRng();
```

Two prose corrections that must land in the same pass, because both currently read as receipts:

```diff
@@ -793,4 +793,7 @@
- * connected in the other. The two pins are still ONE FUNCTION BY CONSTRUCTION — `PIN_CHANCE(num, den)`
- * is literally `pinRandom(den) < num`, which IS `PRNG.randomChance` (sim/prng.ts:115).
+ * connected in the other. `PIN_CHANCE(num, den)` is `pinRandom(den) < num` — `PRNG.randomChance`
+ * (sim/prng.ts:115) — IN THE SCALAR ARMS ONLY. The MIDDLE arm deliberately draws the float directly
+ * (see `chance` below), so its two entry points are two INDEPENDENT draws off an nth-indexed address
+ * and the identity does not hold for it. `pinRandom`/`PIN_CHANCE` are bound to `top-tie-first`.
```

```diff
--- a/tests/test-game-differential.js
@@ -216,3 +216,4 @@
-    fail('the ENDPOINTS disagree for "' + it.name + '" (showdown ' + it.sd_span.join('..')
-      + ', medicham ' + it.me_span.join('..') + '). tests/test-engine-diff.js compares exactly these '
-      + 'two endpoints at 149/150, so a disagreement here is a damage bug, not a granularity one.');
+    fail('the ENDPOINTS disagree for "' + it.name + '" (showdown ' + it.sd_span.join('..')
+      + ', medicham ' + it.me_span.join('..') + '). tests/test-engine-diff.js compares these two '
+      + 'endpoints (:888). BEFORE READING THIS AS A DAMAGE BUG: `oneHitDamage` pins medicham through '
+      + '`inertExcept` (crit 0.999) but sends Showdown\'s crit to PIN_CHANCE. If those two are not the '
+      + 'same arm, a value ~1.5x the span is the harness critting on one side. Call damageInterior '
+      + 'twice — a damage table cannot move between calls.');
```

And PART 1's second clause should stop being satisfiable by luck. It currently exercises one arm; the
scalar arms are the ones the identity is true for, and the middle arm makes a different claim that
nothing tests:

```diff
--- a/tests/test-game-differential.js
@@ -49,10 +49,20 @@
 {
   let bad = 0;
-  for (const [n, d] of [[100,100],[95,100],[90,100],[50,100],[30,100],[1,24],[1,8],[1,4],[1,2],[1,3]])
-    if (G.PIN_CHANCE(n, d) !== (G.pinRandom(d) < n)) { bad++; fail('the two pinned dice disagree at randomChance(' + n + ', ' + d + ')'); }
-  if (!bad) pass('randomChance and random are the SAME die at every rate a battle asks about');
+  const RATES = [[100,100],[95,100],[90,100],[50,100],[30,100],[1,24],[1,8],[1,4],[1,2],[1,3]];
+  /* PER ARM, AND ONLY WHERE THE IDENTITY IS THE ARM'S CLAIM. A scalar arm's `chance` IS
+   * `random(den) < num`; the middle arm's takes its own draw on purpose, so asking it this question
+   * compares two independent uniforms and passes or fails by where the nth counter happens to be. */
+  for (const a of G.ARMS) {
+    if (a.middle) continue;
+    for (const [n, d] of RATES)
+      if (a.chance(n, d) !== (a.random(d) < n)) { bad++; fail(a.id + ': the two pinned dice disagree at randomChance(' + n + ', ' + d + ')'); }
+  }
+  /* THE MIDDLE ARM'S OWN CLAIM, WHICH IS THE OPPOSITE ONE: two entry points, two independent draws.
+   * A middle arm whose two dice agreed everywhere would be the pre-finaliser hash back again. */
+  { const M = G.ARM_BY_ID.get('middle');
+    if (M) { let same = 0; for (let i = 0; i < 400; i++) if (M.chance(1, 2) === (M.random(2) < 1)) same++;
+      if (same > 260 || same < 140) { bad++; fail('the middle arm\'s chance and random are not two '
+        + 'independent draws — they agreed ' + same + '/400 where ~200 is independence. The nth-indexed '
+        + 'address has stopped re-drawing (see 245cb90d).'); } } }
+  if (!bad) pass('every scalar arm\'s randomChance IS its random (prng.ts:115), and the middle arm\'s two dice are independent');
```

---

# TASK 2 — the residual protect rate

## 0. What was measured, against what

| pin | value |
|---|---|
| engine release | `688e696f00c8` (frozen — the same one the 961-game protect-fix run used) |
| census | `data/verification/census-pin-9446a684709d.json` |
| team store | `data/team-pool-frozen` |
| arm / driver | `middle`, `--end-state` off, `--steering empirical` (`empirical-click/v1`) |
| games | 300 requested, **260 played**, 18,927 driver decisions, **17,532 sampled move draws** |
| human ruler | `data/team-pool-frozen/games.bo3.jsonl`, bots and forfeits dropped |
| family | derived from `data/tags.json` `shieldsUser`, cross-checked against `move-priors.json`'s own `kind: 'protect'` — identical. No move name typed. |

`engine/medicham2-browser.js` digested **`922e9d77cccb` before and after** the run — the ENGINE
agent's live edits did not straddle it, and the release pins it anyway.
`engine/empirical_driver.js` `6853914324fe`, `engine/game_differential.js` `968fb34920e9`,
`data/move-priors.json` `e667fe8ab457`. None moved during the pass.

**The human ruler reproduces exactly.** Reading the frozen store's own sheets and click events:
**13,214 games in file → 8,388 kept → 190,954 clicks → 28,179 protect-family = 14.757%**. That is the
published 8,388 / 190,954 / 14.76% to the digit, so the corpus below is the same corpus.

## 1. THE ANSWER

**Renormalisation alone predicts 16.2%, not 20.8%.** The hypothesis is real and it is roughly half
the effect. The other half is the **denominator**.

### 1a. On the ladder corpus — the static computation the task asked for

185,422 human clicks (of 190,954; 5,514 dropped where the acting body could not be matched to a
sheet entry, 18 where the species has no prior row). Every click is scored twice from
`data/move-priors.json` through `EMP.loadPriors` / `EMP.rowFor`, once as the marginal the table
carries and once as the driver's `renormalise-over-legal/v1` rule would weight the four moves that
body's sheet declares:

| ruler | value |
|---|---|
| A — marginal `E[famP(species)]`, click-weighted on this corpus | **14.233%** |
| B — renormalised over the body's declared moveset | **16.228%** |
| B without the turn-1 lead table | 16.256% |
| **what humans actually did** | **14.757%** |

**Renormalisation is ×1.140.** 13.565% × 1.140 = 15.5%. It cannot reach 20.8%.

The mechanism is exactly as hypothesised, and here is its size: the full species row carries
**0.9352** of mass over its eight listed moves; the four moves one body carries hold **0.7140**. The
missing 0.221 is redistributed, and protect survives the subsetting because **73.7% of clicks are
made by a body whose sheet carries a family member**.

### 1b. On the run's own 17,532 decisions — the three-way decomposition

Every step below is computed on the *same* decisions, so nothing is a comparison across populations:

| step | value | factor |
|---|---|---|
| 0 — declared input, acts-weighted over the whole table | **13.565%** | |
| 1 — the same table's **marginal**, weighted by the decisions this run actually took | **16.209%** | **×1.195** |
| 2 — **renormalised** over the legal candidate set (= the weights the sampler was handed) | **20.257%** | **×1.250** |
| 3 — **realised** (what the sampler returned) | **20.374%** | ×1.006 |
| | | **total ×1.502** |

The run's own printed counter agrees independently: *"protect family: 20.37% of 17532 sampled clicks
realised, 20.26% expected from the weights"*. **The sampler is faithful to ×1.006.** All of the
residual is in the weights, and the weights split into two causes of comparable size.

### 1c. Legality subsetting is NOT the second cause — the direction is backwards

The earlier report attributed part of the residual to candidate sets averaging ~3.14 of 4 moves.
Measured on this run, the mean is **3.772**, and conditioning on it:

| legal candidates | decisions | marginal | renormalised | realised | prior mass on the set |
|---|---|---|---|---|---|
| 1 | 836 | 13.863% | **8.134%** | 8.134% | 0.216 |
| 2 | 48 | 11.425% | 5.806% | 10.417% | 0.197 |
| 3 | 1,395 | 10.240% | 11.978% | 13.262% | 0.394 |
| **4** | **15,253 (87.0%)** | 16.899% | **21.724%** | 21.727% | 0.632 |

**87% of decisions already have all four moves, and they are the ones reading 21.7%.** The narrowed
decisions read *lower*, not higher — a body down to one legal move is usually down to its attacking
move, not its Protect. Legality subsetting is a small **negative** contribution. That part of the
earlier diagnosis is withdrawn.

### 1d. What the second cause actually is

Step 0→1 (×1.195) is the **sample**, and it decomposes further:

- 13.565% → 14.233% (**×1.049**) — the priors table is acts-weighted over its own 435,700-act corpus;
  the frozen pool's clicks weight the same table slightly differently.
- 14.233% → 16.209% (**×1.139**) — the census-coverage-seeking swarm plus the four-body bring. The
  bodies this arm plays are drawn from species that carry the family at a higher marginal rate than
  the ladder's own click distribution does.

And the same steering inflates step 1→2 as well. Renormalisation is ×1.140 on the ladder and ×1.250
on the run, because the pool's bodies sit further from their species' modal moveset: mass over the
legal set is **0.5921 of a 0.9130 row** on the run (ratio 1.542) against **0.7140 of 0.9352** on the
ladder (ratio 1.310). **14.5% of the run's candidates fall to the 0.02 unobserved floor.** Only
0.72% of family candidates do — protect is almost never the floored one, so every floored teammate
transfers mass to it.

**So `13.565%` is the wrong denominator to charge the driver against.** It is the table's marginal
over the whole ladder; the arm is not playing the whole ladder. The right same-table denominator for
this run is **16.209%**, and against that the arm reads ×1.257, not ×1.53.

## 2. THE DEFECT THAT IS LEFT, SIZED AGAINST GROUND TRUTH

The only place both a prediction and a truth exist is the human corpus. Split-half, games alternating,
92,949 / 92,473 scored clicks — the carriage table `c_m` is fitted on one half and evaluated on the
other, so nothing below is fitted on what it is scored against:

| half | humans observed | renorm(marginal) — today's rule | renorm(carriage-corrected `p_m/c_m`) |
|---|---|---|---|
| A | 14.610% | 16.254% | **15.015%** |
| B | 14.612% | 16.258% | **15.116%** |

| | error vs humans |
|---|---|
| **noise floor** — half-vs-half spread on the observed rate | **0.002 points** |
| today's rule | **+1.644 / +1.646 points** (×1.113) |
| carriage-corrected | **+0.405 / +0.504 points** (×1.031) |

Both halves reproduce to within 0.01 points, which is 800× the noise floor away from zero on the
first row — the over-prediction is real. **`p_m / c_m` removes about 72% of it**, held out, where
`c_m` is the share of that species' acts made by bodies carrying `m` (left at the marginal below 2%
carriage, where the estimate is noise).

## 3. WHAT I WOULD PUBLISH

- **The driver's rule over-predicts human protect clicking by ×1.11, not ×1.53.** The 1.53× is the
  rule (×1.14 on the ladder, ×1.25 on this pool) times the sample (×1.20).
- **The residual is one defect, not two.** The renormalisation is the defect; the sample is a
  denominator error in how the residual was reported.
- **Owed item 1 of the earlier report now has a measured expectation**: switching to `p_m/c_m` should
  land the arm near **15.0–15.1%** on a ladder-shaped population, and near `16.209% × 1.031 ≈ 16.7%`
  on this census-steered pool — *not* at 14–15% as that report predicted, because the pool is not the
  ladder.
- **Any future statement of the form "the arm reads X% against 13.565%" should carry the pool-matched
  marginal beside it.** A run whose census pin changes moves that denominator; on this one it is
  16.209%.

## 4. NOT DONE, AND WHY

- **Nothing was applied and nothing committed.** Read-only pass; the diffs in §1.4 are proposals.
- **`node engine/status.js --write` was NOT run.** It writes inside `<!-- GENERATED -->` blocks in
  `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md`, which is outside this pass's scope and would collide
  with two live agents. The stamp is owed once their work lands.
- **Left in the tree, not touched, reported:** `tests/probe_fairy_aura.js` is untracked;
  `data/engine-release.json` is modified. Neither is mine.
- Scratch files for this pass live in the session scratchpad, not in the repo.
