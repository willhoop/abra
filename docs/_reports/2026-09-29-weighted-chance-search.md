# Weighted-chance turn search (Will's idea, 2026-09-29) — phase 1

**Verdict.** Built behind a flag (off by default; `gen5.json` untouched). It is correct: the probability-weighted
expectation matches a 1,000-sample playout mean on 24 of 24 real joint pairs (|z| median 0.48, max 1.80). It is too
expensive to help: one enumerated cell costs a median **138 stepped turns** (about **250 sampled playouts** of wall
time), and per millisecond it buys less precision than playouts on the median pair (efficiency 0.40; better on 6 of
16 pairs that have any dice variance). At gen5's 1 s clock it fills 55% of the table against 100%. The phase-2 SPRT is
pre-registered behind a feasibility gate that this arm FAILS today, so it should not be launched.

Release `eaa5becc54eb` throughout; heuristic leaf, depth 0; positions are real Reg M-C open-sheet team pairs from
`solver/out/human/games.jsonl`, played forward by uniform legal joints (the test-miltank recipe).

## 1. What was built

| File | What |
|---|---|
| `solver/miltank/chance.js` | `enumerate(W, jA, jB, opts)` → buckets `{S, w}`, the distinct boards one turn on and their probabilities |
| `solver/miltank/rollout.js` | `chancePlayout`: Σ w · (depth random turns, then the leaf) over the buckets, when the job carries `chance` |
| `solver/miltank/cells.js`, `search.js` | `o.chance` / `job.chance`; refused with `quiesce`; one pass when no body is hidden (`chanceOnePass`) |
| `solver/mew/agent.js` | `chance` added to `SEARCH_EXTRAS`, so a league spec can set it |
| `solver/miltank/chance-gen5.json` | the phase-2 arm: gen5 plus `chance: {dmg: coarse}` |
| `solver/bench/chance_bench.js`, `chance_fill.js` | the cost and correctness bench; the fill-inside-the-clock bench |
| `solver/tests/test-miltank-chance.js` | WEIGHTS, DIST, AGREE, WIRED; RED under `MILTANK_BREAK=chance` |

**No probability is restated in solver code.** Every die of a turn enters the engine through `battleTurn(S, rng, …)`,
which runs `rngStreams(rng)` and passes a struct that already carries `any` straight through
(`engine/medicham2-browser.js`, `rngStreams`, `battleTurnBody`). The enumerator hands the step a scripted struct and
finds each die's thresholds by bisection on the resulting board digest, snapping each boundary to the simplest rational
in its bracket (9,947 of 10,078 snapped in the first full run). The engine keeps every threshold.

**It is stratified sampling, not a point enumeration.** Each class is played at a u drawn inside it, and a node lighter
than `massEps` (0.01) has its remaining dice drawn. The estimate is unbiased whatever the classing, and exact where a
class fixes the board.

## 2. The coordinator's framing, tested

| Claim | Finding |
|---|---|
| Removes sampling noise, counts rare outcomes | True where it runs. But the dice noise is already small at the real clock: the current search fills each cell 65 times at 1 s and ~400 times at 10 s (`f-fill-*.json`), and 8 of 24 pairs have no dice variance at all. |
| Does not fix the repeat Protect | Not tested (no arena games). Nothing in the design touches the horizon. |
| Exhaustive enumeration is infeasible | Confirmed. `dmg: exact` (every roll its own class): buckets median 174, stepped turns median 1,721, max 4,712, with most mass truncated at `massEps` 0.01 (`w-exact.json`, first design). |
| Bucket by board consequence per draw (KO/no-KO, mean HP) | **Refuted as stated.** Classing a draw by consequence, with the later dice at a fixed value, merges two low rolls that together leave a body standing. The first design enumerated a sampled **12.7% survival as 0** (z −12.1, `dump.json` pair 15) and missed by up to 15 SE. Bucketing is sound only on the final board, or with a drawn u inside each class (what shipped). |
| Reuse the labeller's exact-chance mode | **Refuted.** `solver/porygon2/v1/label.js --chance` is a sample count (seeded dice averaged per cell), not an enumeration. |
| Probabilities from MEDICHAM, not re-implemented | Met. Nothing filed to ENGINE. |

## 3. Measurements (final design, `dmg: coarse`, 24 joint pairs, 5 seeds per pair, n = 1,000 samples)

`solver/out/chance/f-coarse.json`:

| | median | p90 | max |
|---|---|---|---|
| buckets per joint pair | 7 | 17 | 74 |
| stepped turns per joint pair | 138 | 354 | 884 |
| dice drawn per turn | 7 | — | 33 |
| cost in sampled playouts | 251 | 958 | — |
| \|z\| vs the sampled mean | 0.48 | — | 1.80 |

- **ms:** a stepped turn plus a digest costs about twice a playout. The ms column is noisy because the machine was shared
  (one 138-turn pair took 10 s under load). Read the cost in stepped turns.
- **Efficiency** (sampled variance × ms per playout ÷ enumerated variance × ms per enumeration): median 0.40; above 1 on
  6 of 16 pairs.
- **`dmg: sample`** (the roll drawn, not branched; `f-sample.json`): stepped turns median 94, efficiency median 0.12.
  One pair sits at z −7.0 with the enumeration's SE estimated from only 5 seeds. It is unresolved and not the default.
- **Fill inside the clock** (`chance_fill.js`, 8 decisions, gen5 shape 4×4): at 1 s the chance arm filled 0.547 with 1
  fallback and 1 pass; the base filled 1.0 with 64.9 passes (`f-fill-1s.json`). At 10 s: 0.774 and 1.5 passes against
  1.0 and 396.5 (`f-fill-10s.json`). Each pass is one world draw, so the chance arm also stops averaging over the
  opponent's hidden back line, which is the variance it does not remove.

## 4. What the engine cannot be asked, and what was done instead

- **No die exposes its threshold.** The enumerator finds each one by bisection, about 10 stepped turns per boundary at
  `delta` 2^-10. An engine hook that reported each draw's outcome classes would remove that cost. It is not filed: it
  would be a new engine capability, not a defect, and on these numbers it would not make the idea pay.
- **The speed-tie die cannot be enumerated this way.** Its raw value stays on the battle after the turn, and the outcome
  is a comparison with another die. Measured: one 33-draw turn went to 1,008 classes on a single tie draw and 1,745
  buckets. Tie draws are now drawn, never branched (`sampledTie`). This matches the existing rule that a tie is a
  branch the search plans for, not a threshold.
- Counters on every run: `streamMismatch` 0 and `runaway` 0 in every bench and test run (a replayed prefix always drew
  the same stream, and no turn looped on the canonical value).

## 5. Tests

`node solver/tests/test-miltank-chance.js`: 67 of 67 on 12 joint pairs (11 with 2 or more consequences), about 3 min
single-core. Under `MILTANK_BREAK=chance` (every bucket weighs the same) DIST fails, as required. DIST checks the
enumerated distribution over consequences against the frequency over 400 ordinary seeded turns, so it tests that the
probabilities are the engine's without the test knowing any accuracy or crit rate. `test-miltank.js --no-red` 3,414 of
3,414 after the change. `test-miltank-quiesce.js` cannot answer in a worktree (no team store). That was already the
case before this work.

## OWED, NOT RUN

Pre-registration: `solver/miltank/preregistration-chance.json`. Gate 0 comes first, and on today's numbers it fails:

```
node solver/bench/chance_fill.js --release eaa5becc54eb --games 6 --budget 1000 --dmg coarse --out solver/out/chance/<date>/fill-gate.json
```

PASS iff the chance arm's mean filled fraction is at least 0.99 AND fallbacks = 0. Only then:

```
cmd.exe /c tools\lownode.cmd solver\machamp\sprt.js --release eaa5becc54eb --x solver/miltank/chance-gen5.json --y solver/machamp/league/gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9301 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --info honest --out solver/out/chance/<date>/sprt-chance.json
```

Read once at the bound. Recommendation: do not spend the game slot on it. The variants that might pay are narrower:
chance only in cells whose sampled variance stays high after N passes, or only near a KO threshold. Each needs its own
gate 0.
