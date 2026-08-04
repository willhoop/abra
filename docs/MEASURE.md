# MEASURE — can we believe a number

**Owns:** `engine/mew.js`, `engine/sprt.js`, `engine/provenance.js`, `engine/status.js`,
`engine/backtest_winrate.js`, `engine/paired_h2h.js`, the noise floor, the corpus stamps, and the
MAG refit.

**Its one number:** leaf calibration — when the leaf says 90%, is it 90%.

**May not:** change a policy, a search knob or an engine mechanic. This division builds the rulers;
it does not compete on them.

<!-- GENERATED: engine/status.js -->

```
MEASURE — can we believe a number
  leaf calibration: live in-game leaf is not separated from a coin on Brier (paired +0.0388, 95% CI -0.0306 to 0.113; negative is better). Names the winner on 54.0% of 37 decisive calls, 95% CI 38.4-69.0%. ECE 0.2054. See reliability_curve.
    n=39 games, 200 rollouts each   (2026-08-04 06:35)
    when it says 90-100% it wins 100% (n=1); when it says 0-10% it wins 50% (n=2)  — ECE 0.2054
    powered for MDE 71.8% held-out / 59.9% full corpus; the prior effect needed n=2835
    CURRENT — every source the leaf reads still hashes to what it was measured against
  provenance: 0 unsafe, 23 possibly stale, 52 ok, 0 missing
  refit edge: CLEAN — feature_fixture --check passes: all 58 columns hash-identical to fit time
    (engine/medicham2-browser.js moved 2026-08-04 04:47, but the feature function did not)
    (data/abra-tags.js moved 2026-08-04 04:21, but the feature function did not)
```

_stamped 2026-08-04 06:37_

<!-- /GENERATED -->

## Why the refit lives here, not in ENGINE or SEARCH

The refit is the expensive event on the one expensive edge, and it invalidates seven artifacts:
counterplay, winrate-backtest, opponent-calibration, weight-multiplicity, then the mag / mew /
scoreboard bundles. `provenance.js` derives that set rather than carrying a typed list of it.

The division that owns *knowing when a number stopped being true* is the one that should be pulling
that trigger.

**A restamp is only valid if the feature FUNCTION is unchanged.** Damage table moved → refit. Not a
restamp. There is no version of this where the shortcut is fine.

## Open — in priority order

### 1. LEAF CALIBRATION — the biggest remaining bug

`data/winrate-backtest.json` exists, and its verdict is in the generated block above. Read it before
doing anything else, because the honest reading is worse than "not yet measured":

- it is **stale** — provenance flags it as older than its input `engine-data.js`
- it scored **350 games at 40 rollouts each**, which is a thin sample for a calibration claim
- and on that evidence it did **not** beat a coin, and did not beat Elo on log-loss

Every MILTANK decision is an argmax over these numbers. A leaf that reads 100% and loses is not a
tuning problem, it is the thing the search is amplifying — Lesson 2. Point `backtest_winrate.js` at
the *current* leaf, at a sample that can carry the claim, and publish the reliability curve, not
just a verdict string.

### 2. R4 has an artifact — CLOSED 2026-08-04

`engine/rollout_r4.js` writes `data/rollout-r4.json`, and `status.js` now prints the verdict out of
that file instead of `NO ARTIFACT`. It does not re-pair anything: it shells out to `sprt.js --verify`
and `paired_h2h.js` and refuses to write if they disagree, the same way `status.js` shells out to
`provenance.js`.

The remembered 55.5% held. **ACCEPT H1 — MILTANK takes 55.5% of 535 DECISIVE PAIRS, decided after
522 of them, LLR 3.00 against a 2.94 bound.** The corpus is 5,248 lines, which is 2,624 games,
which is 1,312 seed pairs — the store writes a log-only companion record under the same id, so a
line count double-counts every game and the handoff's "5,248 games" was exactly twice the truth.
The artifact records all four numbers and asserts the invariant that makes them relate.

Two things it is not. The point estimate is **stopped at a boundary**, so it is biased high and the
95% CI beside it is a fixed-n formula quoted for context, not the inference — read the verdict.
And status.js classes the corpus **PRE-CHANGE**: `engine/medicham2-browser.js` moved 04:47, the
games were played 04:41. Both arms shared the pre-fix rollout model, so the contrast is fair and the
run stands as a measurement *of that build*; that the edge survives into HEAD is an assumption. It
gets re-run at the next frozen engine release.

No A/A run exists for this comparison, so the noise floor is **not established**. The substitute in
the artifact is three independent split-half cuts of this run: spreads of 0.2, 3.9 and 1.3 points
against an effect of 5.5. One cut alone would have been useless — the spread of a single split-half
is itself a draw with sd about 4.3 points at this sample size.

### 3. The 24 possibly-stale artifacts

`node engine/provenance.js` lists them. Most are ordering artefacts inside a single run and are
already annotated as such. The ones to actually chase are those older than `policy-weights.json`
and those recording no game count at all — a file that does not say what it was built from cannot
be checked by anyone, ever.

### 4. The noise floor is not a standing artifact

Split one arm in half and measure the spread. An effect smaller than that is not an effect. This
gets re-derived by hand every time somebody needs it, which means it usually is not derived at all.

## Reading a run

```bash
node engine/sprt.js <file>
```

Cat the shards together first. **Never read an interim SPRT** — 66.7% became 44%, 57.7% became 50%.
The bound exists precisely so you do not have to look. SPRT is valid under continuous monitoring
because its boundaries were derived for it; a Wilson interval read repeatedly is not the same thing
and does not inherit that property.

The unit is the **decisive pair**, not the game. In a paired run a 1-1 split means the team decided
it, not the policy.

## Done looks like

- `status.js` prints a leaf calibration line that is fresh, adequately powered, and states the
  reliability curve rather than a verdict string.
- `provenance.js --strict` exits zero.
- Every gate R1–R4 has an artifact.
- `REFIT OWED` is either clear or has a dated reason next to it.
