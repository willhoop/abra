# Does the middle-arm die mix `nth`? — independent verification

2026-08-27. MEASURE. Static/numeric only: no game was played, no store or pool was loaded, no file
under `engine/` was modified. The filed claim was re-derived from source with a fresh sweep; the
original probe (`tests/probe_random_target_address.js`) was not run and none of its helpers reused.

## STRAIGHT ANSWER

**No. `nth` does not mix.** Confirmed, with the mechanism identified in closed form and the closed
form verified exactly (zero error over 500 bases x 10 indices).

But the filing is **right in substance and wrong in two of its three specifics**, and it named the
smaller of the two consequences.

| filed | verdict |
|---|---|
| "FNV-1a's trailing index TRANSLATES the value modulo 1" | **Confirmed but imprecise.** It is not one translation; it is one of at most 16 translations selected by the low nibble of the internal state. Bound is exact and tight. |
| "shift 0.0352 for a one-digit index" | **CONFIRMED to 5 figures.** Measured max circular shift 0.0351571 = 9 x 16777619 / 2^32 = 0.03515709. |
| "shift 0.4999 for a two-digit index" | **REFUTED AS STATED.** Two-digit indices mix *fully*. 0.4999 is the ceiling of the circular-distance metric, which any uniform value attains — it is not evidence of translation, it is what "mixed" looks like under that statistic. |
| "a multi-hit move's per-hit accuracy rolls are one die read three times with a nudge" | **Partly true, and it is the wrong headline.** Only **2** legal moves roll accuracy per hit. The **damage** roll is per-arrival on **all 14**, and it is far worse. |
| "identically in both engines, which is why no instrument has ever noticed" | **CONFIRMED, and this is the finding.** |

---

## Q1 — Is the translation real, and what is the actual function?

The hash, byte-identical in both engines:

- `engine/medicham2-browser.js:18487` — `function midEventHash(str)`
- `engine/game_differential.js:786` — `function midHash(str)`

```js
let h = 0x811c9dc5 >>> 0;
for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; }
```

`midEventValue(ctx) = midEventHash(ctx) / 4294967296` (`:18492`). The address is
`seed|turn|cat|move|targetSlot` (`midEventBase`, `:18560`) and the draw appends `'|' + n`
(`midEventDraw`, `:18575`).

### The mechanism

FNV-1a's **last** round is `h = (state XOR c) * P mod 2^32`, so the final character contributes a
single multiply with no diffusion after it. Let `A = state_after("...|") XOR 48`. Because
`48 = 0b110000` shares no bits with any digit `0..9`, appending digit `d` gives state `A XOR d`, so

```
value(nth = d)  -  value(nth = 0)   ==   ((A XOR d) - A) * 16777619  mod 2^32  /  2^32
```

**Verified exactly**: predicted == measured to < 1e-12 on every one of 500 bases x indices 0..9.
`(A XOR d) - A` is a signed sum of powers of two drawn from the low nibble, so it takes at most 16
values and is bounded by 9 in magnitude relative to `d = 0`, and by 15 across a pair.

### Sweep — 2,400 real addresses

Bases built from the format, nothing typed: 500 legal move ids from
`Dex.forFormat('gen9championsvgc2026regmb')` (filtered), the 7 categories read out of
`RNG_STREAMS` in source, `MID_EVENT_SEED = 20260813` read out of source, 24 turns, 5 slot strings.

| k | distinct shifts over 2,400 bases | max circular distance from v(0) |
|---|---|---|
| 1 | 2 | 0.003906 |
| 2 | 2 | 0.007813 |
| 4 | 2 | 0.015625 |
| 7 | 8 | 0.003906..0.996094 (i.e. +/- 0.0039) |
| 9 | 4 | 0.027344 |
| **0..9 overall** | **<= 16** | **mean 0.033207, max 0.0351571** |
| 10 | **2,400** (one per base) | mean 0.2569, sd 0.1451 |
| 11 | **2,400** | — |
| 12 | **2,400** | — |

`v(10) - v(0) mod 1` over 2,400 bases: mean 0.4947, sd 0.2831, 2,400 distinct values.
A uniform variable gives mean 0.5000, sd 0.2887. **Two-digit indices mix.**

### The correct statement of the defect

It is not `nth` that fails to mix — it is the **trailing digit**.

| index block | max within-block circular distance | distance from v(0) |
|---|---|---|
| 0..9 | 0.047208 mean / **0.058595** max | 0 by definition |
| 10..19 | 0.046730 / 0.058595 | mean 0.2569 sd 0.1451 |
| 20..29 | 0.046720 / 0.058595 | mean 0.2369 sd 0.1433 |
| 100..109 | 0.046678 / 0.058595 | mean 0.2537 sd 0.1442 |

`0.058595 = 15 x 16777619 / 2^32` exactly, and 15 is `max(d1 XOR d2)` for digits (6 XOR 9). So:
**a sequence of N indexed draws has N/10 independent values, each blurred by a jitter of width
<= 0.0586.** That is the whole of it, and it is a stronger and cleaner statement than the filing's.

### Controls (each expected to come out differently, and did)

| control | mean spread of 10 values |
|---|---|
| C1 vary `nth`, trailing, **as shipped** | **0.0332 circular** (0.0884 linear, inflated by wrap) |
| C2 vary the **turn** field — a middle field, same hash, same bases | 0.816554 |
| C3 same index moved to the **front** of the string | 0.815726 |
| C4 index appended, then one murmur3 avalanche pass on the output | 0.816845 |
| reference: 10 genuinely independent hash draws | 0.848 (theory 9/11 = 0.818) |

C2 is the load-bearing control: same function, same strings, a field one position earlier — full
mixing. The probe can see mixing when mixing is there. C4 is the fix, priced: one avalanche pass
restores it.

Cross-checks: the engine's and the authority's hash bodies are textually identical modulo the
function name; both agree with an independently written FNV-1a over 400 x 13 strings; the `Math.imul`
is load-bearing (a plain `*` diverges).

---

## Q2 — Which draw families consume `nth > 0`?

Derived from `RNG_STREAMS = ['acc','crit','sec','dmg','stall','tie']` (`:18428`), the address
mapping `MID_ADDR_CAT = { stall: 'any' }` (`:18601`), and the call sites. `nth > 0` requires the same
`turn|cat|move|targetSlot` tuple to repeat.

| family | carries `nth > 0`? | why |
|---|---|---|
| **`dmg`** | **YES, structurally, and this is the largest** | `engine/medicham2-browser.js:26631` — `const _au=(i===0)?_u:_R.dmg();` "the damage stream, once per arrival". ROADMAP #322 added this deliberately so an N-hit volley spends N indices. It spends N *addresses*; it does not get N *values*. |
| **`any`** | **YES, and it is the widest population** | `midClearActiveMove` (`:18546`) sets `MID_MOVE=MID_TGT='-'`, so every residual/end-of-turn draw collapses onto one address `seed|turn|any|-|-` and `nth` counts up across *all* of them — Harvest, Moody's two `sample()` draws, sleep/freeze/paralysis timers, forme cycles, target selection, the chooser's coins (all listed in the header at `:18416` as deliberately staying on `any`). Plus the 1,000 `no_battle` draws addressed `seed|0|any|-|-|<nth>`, which `game_differential.js:5491` already calls "a sequence and not an address". |
| **`sec`** | YES | multiple secondaries on one move (`:28366`, Dire Claw takes two `_R.sec()` in order), King's Rock beside a move's own secondary (`:28236`), and the per-target fallback at `:26024` when `_secAddrSlot` is null. |
| **`acc`** | YES, but **only 2 moves** | Derived: `multiaccuracy` is true for exactly `populationbomb` and `tripleaxel`. The other **12 of 14** multihit moves roll accuracy once. And medicham2 does not roll per hit at all — WIRE 59 (`:11200`) models `multiaccuracy` as an *expected hit count* `1 + p + p^2 + ...`. So the per-hit accuracy die exists on the **authority side of the middle arm only**. |
| **`crit`** | rarely | `:26543` — "the CRIT ITSELF is still one decision for the whole volley", declared. |
| **`stall`** | folds into `any` | `MID_ADDR_CAT` maps it, deliberately, `:18601`. |
| **`tie`** | never | pinned to `() => 0` in the middle arm (`game_differential.js`, ~`:1240`). |

**Per-family draw counts are NOT in this report.** `data/game-differential.json` carries no `nth`
histogram, and getting one requires playing games. The exact command is in OWED below. What can be
said without a game: `dmg` and `any` carry `nth > 0` *by construction on every multi-hit click and
every turn with two or more residual coins*, so this is not one move family — it is most of the die.

---

## Q3 — Does it change an OUTCOME?

Thresholds derived from the format, not typed. Accuracy values present among 500 legal moves:
`100:256 95:23 90:49 85:15 80:5 75:7 70:4 60:1 55:1 50:3 30:4` plus 132 never-miss moves.
Secondary chances: `100:92 70:2 50:11 40:2 30:47 20:26 10:56`.

### Accuracy and secondaries — the filing is right that this barely matters

Flip rate, v(0) vs v(1..4) across each real threshold:

| threshold | measured flip | independent die would give |
|---|---|---|
| acc 95 | 1.75% | 9.50% |
| acc 90 | 1.76% | 18.00% |
| acc 85 | 1.74% | 25.50% |
| acc 75 | 1.83% | 37.50% |
| acc 50 | 1.53% | 50.00% |
| acc 30 | 1.89% | 42.00% |
| sec 30 | 1.89% | 42.00% |
| sec 10 | 1.59% | 18.00% |
| acc 100 | 0.00% | 0.00% |

Flat at **~1.7% regardless of threshold** — exactly what a bounded translation predicts (the shift
only matters when v(0) lands within ~0.017 of the line). A 10x–30x under-decorrelation, but small in
absolute terms.

### Damage — this is where it bites, and the filing missed it

`DAMAGE_ROLL_SIDES = 16` (`:10415`), `damageRollIndex(u) = 15 - floor(u*16)` (`:10431`). Boundary
spacing 0.0625, and the shift is up to 0.0586 — the same order.

- **P(nth = k lands in the same 1-of-16 damage bucket as nth = 0), k = 1..4: 86.02%.**
  An independent die gives **6.25%**.
- mean |bucket(nth=1) - bucket(nth=0)| = **0.091** of 15. Independent: **5.31**.

Per-arrival damage for every real multihit move (24 turns x 4 slots each):

| move | arrivals N | distinct damage indices, shipped | independent reference | all N identical |
|---|---|---|---|---|
| dualwingbeat | 2 | 1.03 | 1.94 | 96.9% |
| dragondarts | 2 | 1.07 | 1.94 | 92.7% |
| twinbeam | 2 | 1.07 | 1.95 | 92.7% |
| doublehit | 2 | 1.08 | 1.93 | 91.7% |
| tripleaxel | 3 | 1.22 | 2.83 | 78.1% |
| bulletseed | 5 | 1.18 | 4.40 | 82.3% |
| scaleshot | 5 | 1.23 | 4.43 | 77.1% |
| rockblast | 5 | 1.27 | 4.50 | 72.9% |
| iciclespear | 5 | 1.32 | 4.47 | 67.7% |
| bonerush | 5 | 1.34 | 4.36 | 65.6% |
| tailslap | 5 | 1.41 | 4.36 | 59.4% |
| watershuriken | 5 | 1.41 | 4.41 | 59.4% |
| pinmissile | 5 | 1.42 | 4.40 | 58.3% |
| populationbomb | 10 | **1.80** | **7.56** | 19.8% |

ROADMAP #322's own header says an N-hit volley "spends N INDEPENDENT indices". **It spends N
addresses and gets 1.2 to 1.8 distinct values.** The wire is correct; the hash does not deliver what
the wire assumes.

### The residual `any` collapse — a 1/2 coin that is not a coin

Every end-of-turn draw shares `seed|turn|any|-|-`. Consecutive values, verbatim:

```
turn 1   0.6532 0.6571 0.6454 0.6493 0.6376 0.6415 0.6297 0.6336 0.6219 0.6258
turn 5   0.6265 0.6304 0.6187 0.6226 0.6421 0.6460 0.6343 0.6382 0.5952 0.5991
turn 12  0.7208 0.7247 0.7286 0.7325 0.7052 0.7091 0.7130 0.7169 0.7521 0.7560
```

As a 1/2 coin (Harvest, Moody), all three turns read `TTTTTTTTTT` — 0 heads in 10.
**P(nth = 1..5 gives the same 1/2 coin as nth = 0), over 200 turns: 97.60%.** Independent: 50.00%.

So in the middle arm, two Pokemon's Harvest coins on the same turn are the same coin 97.6% of the
time. `game_differential.js` already records `-boost field 3` (Moody) as the biggest board-material
class it has seen.

### The authority-side per-hit accuracy, since the filing named it

Only `populationbomb` (acc 90, 10 hits) and `tripleaxel` (acc 90, 3 hits) roll per hit, and only on
the authority side of this arm.

| | shipped | independent ref | true binomial |
|---|---|---|---|
| populationbomb, all 10 connect | **86.5%** | 28.1% | 34.9% |
| populationbomb, zero connect | **4.2%** | 0.0% | 0.00% |
| tripleaxel, all 3 connect | 92.7% | 77.1% | 72.9% |
| tripleaxel, zero connect | 6.3% | 0.0% | 0.10% |

A move that should connect on all ten hits a third of the time does so 86.5% of the time, and fails
every hit 4.2% of the time against a true probability of 1 in 10^10.

---

## Q4 — What would fixing it cost?

**Far less than the filing implies, and that is the actionable part.**

`midEventDice` has exactly **one** non-test caller in the repository:

```
engine/game_differential.js:1219      const d = M.midEventDice({ seed: spec.middleSeed });
```

The two other references are `tests/probe_random_target_address.js` and
`tests/probe_spread_secondary_address.js`. The engine says so itself at `:10942` — "`MID_TGT` is read
by `midEventDraw` alone, so nothing outside `midEventDice` — no self-play game, no rollout, no seeded
census probe — can observe either arm."

Every other consumer of the engine gets `Math.random` or the per-stream LCG from `rngStreams`
(`:18429`), neither of which touches `midEventHash`.

### Re-baselines — named, not "most measurements"

| artifact | why |
|---|---|
| `data/game-differential.json` | The committed run is `pins.arms_run = ["middle"]`, `primary: "middle"`. Its `games 961 / diverged 14`, its `mid_void.diverged_among_usable 13 / 960` (rate 0.0135), its `damage_roll_index_inversions 3073`, its `no_battle_draws 1000`, its class table and its `first_divergences` list are all middle-arm output. |
| `data/divergence-turns.json` | Same arm; read alongside it by `engine/gate_offfield_target.js:52`. |
| **the quarantine clause itself** | `engine/quarantine.js:1550` and `:2095` read `data/game-differential.json` — the differential clause and the `order_probe` clause. This is the gate that decides whether MEDICHAM is correct, so a re-baseline is not cosmetic. |
| `engine/gate_fail_and_silent.js` | reads the same artifact at `:275`. |
| `engine/divergence_report.js`, `engine/explain_divergence.js`, `engine/divergence_shape.js` | pure readers of the artifact; they re-derive. |
| the four middle-arm pin claims in `game_differential.js:1373-1387` | one of them must be rewritten — see the blind-spot section. |

### NOT affected — say this plainly

**No refit. No re-fit of `data/policy-weights.json`, no joint weights, no leaf calibration, no
winrate backtest, no MILTANK baseline, no SLOWKING/GARY/DODUO/PORYGON2 report, no rollout figure,
no census, no roster, no `data/all-mechanics-fire.json`.** None of them ever call `midEventDice`.
The seven artifacts a refit invalidates are untouched by this.

### The trap in the fix

`engine/game_differential.js:1535` — `PIN_DIGEST` **deliberately excludes the dice model**:

```
/* `dice` is DELIBERATELY NOT IN THE DIGEST. The split was measured, made the instrument worse, and
 * was reverted to the corner ... Had the split been kept, this line would have to include it */
```

`DICE_MODEL` (`:1534`) is carried in `pins` as prose but is not digested. So **changing the hash
changes the arm's behaviour and does not move `PIN_DIGEST`**, and `engine/arms_comparable.js` would
table a pre-fix run against a post-fix run as comparable. Whoever fixes the hash must put the dice
model into the digest in the same commit, or the re-baseline happens silently — which is the
2026-08-07 reset happening again without the banner.

### Cost of the fix itself

One line. Control C4 above measured it: appending an avalanche finaliser to `midEventValue` restores
full mixing (mean spread 0.8168 against an independent reference of 0.848). It must land in **both**
copies — `medicham2-browser.js:18492` and `game_differential.js:790` — which is exactly the
"duplicated on purpose" interface the header at `:18456` describes, and `tests/test-middle-identity.js`
already asserts they agree over real games.

---

## THE ANGLE THAT MATTERS — could any instrument see this?

**No. Not one. And I do not think one could have.**

Two independent reasons, and both are the CLAUDE.md capability-absent shape:

**1. The differential cancels it exactly.** Both engines compute the same `nth`, build the same
address string and run the same hash. `midEventHash` and `midHash` are textually identical. So the
middle arm — the only instrument that uses this die at all — compares two bodies that share the blind
spot, and a shared blind spot subtracts to zero. This is the head-to-head failure described in
CLAUDE.md, arriving through the die instead of through a missing capability.

**2. The one test that looks at the hash asks the wrong question, and is green.** The middle arm's pin
claims are at `engine/game_differential.js:1373-1387`:

```js
P("the nth index separates repeats -- 6 of 20 authority draws share a context without it",
  () => { midClearNth();
          const a1 = midCtx([1, "acc", "rockslide"]), a2 = midCtx([1, "acc", "rockslide"]);
          return a1 !== a2 && midValue(a1) !== midValue(a2); });
```

It asserts the two values are **different**. They are — by 0.0039. It asserts nothing about
independence, and it will stay green after any fix, so it cannot even confirm one.

```js
P("the hash is UNIFORM enough to price a 90-accuracy move  [2,000 contexts, +/- 5 points]",
  () => { let hit = 0; for (let i = 0; i < 2000; i++) if (midValue("acc|" + i) < 0.9) hit++;
          return Math.abs(hit / 2000 - 0.9) < 0.05; });
```

This one sweeps `i = 0..1999` — a **trailing** index, the exact failing position. It passes anyway,
because `i` is mostly 3–4 digits and only the *last* digit fails to mix; the leading digits carry the
uniformity. **It measures the marginal distribution. The defect is entirely in the conditional.**
That is `a-green-test-can-be-asking-nothing` in its purest form: the test is not merely weak, it is
sweeping the broken axis and reporting health.

The repository has no autocorrelation, no conditional-independence and no serial-dependence check on
any die. Nothing else in the tree could have seen this, and nothing will see it after a fix unless a
claim is added that asserts *independence across `nth`* rather than *inequality across `nth`*.

**This is the finding.** The hash arithmetic is a footnote next to it.

---

## SCOPE — what this report does NOT claim

- It does **not** claim any specific game in `data/game-differential.json` is misclassified.
  The error cancels between the engines, so the most likely effect on the published
  **whole-game rate (14 of 961)** and the **board-material rate** is that both are measured in a
  parameter region the real game does not occupy — not that either is arithmetically wrong.
  Which of the two moves, and by how much, requires a game.
- It does **not** claim per-family `nth > 0` counts. Structure only. See OWED.
- Nothing here touches live play, rollouts, self-play, the census or the roster, because none of
  them reach this code path.

## OWED, NOT RUN

Each needs a game or a gate run, which LIGHT MODE forbade. Run against a pinned release, a pinned
census and `data/team-pool-frozen`, and check `mtime` before reading any artifact.

```bash
# 1. Per-family nth histogram — the one number Q2 could not derive statically.
#    Instrument midEventDraw's MID_NTH map, or post-process midEventLog(), splitting on field 2
#    (category) and field 5 (nth). Fraction of draws with nth > 0, per family.
SHOWDOWN_PATH=/c/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools/lownode.cmd engine/game_differential.js --arm middle --games 200 \
  --team-store data/team-pool-frozen --out data/_nth-histogram.json

# 2. Does fixing the hash move the published rate? Same pool, same census, same release,
#    hash patched in BOTH copies, PIN_DIGEST forced to fork.
SHOWDOWN_PATH=... tools/lownode.cmd engine/game_differential.js --arm middle \
  --team-store data/team-pool-frozen --out data/_gd-nth-before.json
#   ... apply the avalanche to medicham2-browser.js:18492 AND game_differential.js:790,
#       add DICE_MODEL to the PIN_DIGEST input at game_differential.js:1535 ...
SHOWDOWN_PATH=... tools/lownode.cmd engine/game_differential.js --arm middle \
  --team-store data/team-pool-frozen --out data/_gd-nth-after.json
node engine/arms_comparable.js data/_gd-nth-before.json data/_gd-nth-after.json   # must REFUSE

# 3. Prove the two samples are identical before comparing them at all.
#    Same protocol classes, same first-divergence list, same coverage block.

# 4. Re-read the quarantine clause on the after-artifact — it is the consumer that matters.
tools/lownode.cmd engine/quarantine.js

# 5. Add a claim that can FAIL: independence across nth, not inequality across nth.
#    Suggested shape, to sit beside game_differential.js:1376 —
#    over 2,000 bases, P(damageRollIndex(v(base|0)) === damageRollIndex(v(base|1))) must be
#    within +/- 5 points of 1/16 = 6.25%.  Today it measures 86.02% and the existing claims are green.
#    SHOW IT RED ON THE CURRENT HASH BEFORE TRUSTING IT.
```

Sweep scripts used for this report (scratch, not committed):
`<scratchpad>/nth_sweep.js`, `nth_sweep2.js`, `nth_sweep3.js`.
