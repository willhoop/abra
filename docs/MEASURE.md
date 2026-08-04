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
  leaf calibration: live in-game leaf is WORSE than a coin on Brier (paired +0.0502, 95% CI 0.0371 to 0.0628; negative is better). When it says 90-100% it wins 54% (n=56). Names the winner on 51.0% of 1314 decisive calls, 95% CI 48.3-53.7%. ECE 0.1811. See reliability_curve.
    n=1378 games, 200 rollouts each   (2026-08-04 07:09)
    when it says 90-100% it wins 54% (n=56); when it says 0-10% it wins 54% (n=52)  — ECE 0.1811
    powered for MDE 53.8% held-out / 51.7% full corpus; the prior effect needed n=2835
    CURRENT — every engine source the leaf reads still hashes to what it was measured against
    (the corpus has grown since: data/games.ladder.jsonl — more power available, not staleness)
  provenance: 0 unsafe, 23 possibly stale, 53 ok, 0 missing
  refit edge: CLEAN — feature_fixture --check passes: all 58 columns hash-identical to fit time
    (engine/medicham2-browser.js moved 2026-08-04 04:47, but the feature function did not)
    (data/abra-tags.js moved 2026-08-04 04:21, but the feature function did not)
```

_stamped 2026-08-04 07:16_

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

### 1. LEAF CALIBRATION — MEASURED 2026-08-04. The leaf is not calibrated, and the claim is now powered.

`data/winrate-backtest.json` was re-derived against the current engine, on the whole clean corpus
instead of a 350-game subsample, and it publishes a reliability curve. The finding is worse than the
verdict string it replaces, and worse in a specific and actionable way.

**The old number scored a leaf no live decision calls.** It measured `winProb2` — `battle()` at
MEDICHAM's default 20-turn horizon with entry effects re-fired. MILTANK calls neither: its
team-preview leaf is a greedy playout at `maxTurns=60` with `seeded:true`, and its in-game leaf is
`rollout_leaf.rolloutWinProb` at `explore=1.0 / foePolicy=uniform / maxTurns=60`. All three are now
scored on identical positions, so the difference between them is about the leaf.

**Confidence carries no information.** The curve is close to a horizontal line:

| leaf | says 0-10% | says 90-100% | discrimination | Brier vs coin (paired) |
|---|---|---|---|---|
| in-game, 200 rollouts, held-out n=1,378 | wins 53.8% (n=52) | wins 53.6% (n=56) | 50.99% [48.3, 53.7] | **+0.0502 [0.0371, 0.0628]** |
| preview, 40 rollouts, full clean n=6,886 | wins 45.7% (n=831) | wins 55.3% (n=933) | 53.22% [52.0, 54.4] | **+0.0740 [0.0668, 0.0813]** |

Positive is worse. Both leaves are decisively **worse than a coin** on Brier and on log-loss, and
worse than player-Elo, paired on the games where both have an opinion. The preview leaf puts
**25.6% of all its predictions into the two extreme buckets**, where it is wrong by ~40 points.

**Discrimination and calibration are separate failures needing separate answers.** The preview leaf
does rank — 53.22% on 6,700 decisive calls, p < 1e-4 — real, but only ~1.9 points above the
split-half noise floor. The in-game leaf does not rank at all: 50.99%, p = 0.47. Randomising the
playout bought variance and spent the signal.

**What this is not.** Nothing here says the engine is broken. The legacy `winProb2` leaf reproduces
the 2026-08-02 number closely on the current engine — held-out log-loss **1.0243** against the
**1.0748** published, discrimination **51.94%** against **52.63%** — so the twenty-two engine commits
in between did not move the headline. Do not spend this finding on a mechanics hunt.

Also fixed here: the split was cutting on **store append order**, not date, and the store carries
4,775 date inversions. A side-symmetry witness scores 400 boards from both sides and reports
mean(p1+p2−1) = **−0.0099**, so no side advantage inside the engine is contaminating the result.

Still open, in order:

- the leaf is scored at **turn 0**, because that is where a game-outcome label exists.
  `rollout_r1.js` scores mid-game positions and is the other half of this; the two have never been
  read together.
- the **horizon** is the first suspect. `battleResult` falls back to bodies-then-HP whenever the
  playout does not finish, so a confident number can be a material count wearing a probability's
  clothes. That is a SEARCH change, not a MEASURE one — file it, do not fix it here.
- `data/winrate-backtest-rows.jsonl` holds the per-game predictions, so the curve can be re-cut
  without re-running the ~15 minutes of rollouts.

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

### 3. R1 has an artifact, and it does not say what the docs said — CLOSED 2026-08-04

`engine/rollout_r1_artifact.js` writes `data/rollout-r1.json` from the committed row dump, and
`status.js` prints its verdict. The gate previously read a file of the same name that
`engine/rollout_r1_join.py` wrote for the **withdrawn** cross-language join — nothing was hidden, the
join prints its own withdrawal, but the gate read it because it owned the filename. The join is now
`data/rollout-r1-withdrawn-join.json` with `withdrawn: true`, and `status.js` refuses to print any
artifact carrying that field.

**The recomputation does not reproduce the published PASS.** `docs/ROLLOUT-design.md` claimed 68.18%
against material's 65.26%, +2.91 [1.79, 4.04]. From `data/rollout-r1-rows.jsonl` the same formulas
give **65.72% against 65.26%, +0.46, 95% CI [-0.72, +1.63] — UNDECIDED** on 9,201 positions.

The material column matches the published figure to the digit, so it is the same sample. The rollout
column reproduces §4.2.1's **greedy** calibration table bin-for-bin, so the surviving dump is the
`explore=0` incumbent and the `explore=1` run that produced 68.18% left no file. That is the lesson,
not the arithmetic: **the dump stamped no `N`, no `explore` and no build digest, so two runs four
accuracy points apart were byte-indistinguishable.** `rollout_r1.js` now writes
`data/rollout-r1-rows.meta.json` beside every dump. R2 and R3 still have the same hole.

The split-half spread of this run ranges 0.43 to 2.01 points against an effect of 0.46 — the effect is
inside its own noise floor, which is an independent route to the same UNDECIDED.

Open consequence, filed to SEARCH: `--rollout-explore` defaults to `1.0` and
`engine/rollout_leaf.js:147`, `engine/mag_bot.js:145` and `docs/MILTANK.md` all cite 68.18% as the
reason. Re-running `EXPLORE_LIST=1 DUMP=rollout-r1-rows.jsonl node engine/rollout_r1.js` and then
`node engine/rollout_r1_artifact.js` settles it, and R2 says the leaf is cheap.

### 4. The 24 possibly-stale artifacts

`node engine/provenance.js` lists them. Most are ordering artefacts inside a single run and are
already annotated as such. The ones to actually chase are those older than `policy-weights.json`
and those recording no game count at all — a file that does not say what it was built from cannot
be checked by anyone, ever.

### 5. The noise floor is not a standing artifact

Split one arm in half and measure the spread. An effect smaller than that is not an effect. This
gets re-derived by hand every time somebody needs it, which means it usually is not derived at all.

Two consumers now emit their own and neither is general: `rollout-r4.json` carries three split-half
cuts of the H2H, and every block of `winrate-backtest.json` carries a `noise_floor` on Brier and on
accuracy. That is the right shape — the floor belongs to the measurement, not to a global constant —
but there is still no A/A run for the H2H, and a floor computed inside the arm being judged cannot
see between-run variance.

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

## Running the backtest

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/backtest_winrate.js
```

About 13-18 minutes, one process, on 6,886 clean games (809s and 1,046s on two runs). `MAXG=200`
thins it for a smoke run, and the artifact records the n it actually scored, so a thinned run cannot
be mistaken for a published one. It writes `data/winrate-backtest.json` and the per-game rows beside
it. Every seeded configuration reproduces bit-identically across runs; the unseeded legacy
`winProb2` arm moved 0.26 accuracy points between two full runs, which is its run-to-run floor.

**It stamps the sha256 of every source the leaf reads.** `status.js` re-hashes those and prints
`CURRENT` or `PRE-CHANGE`, which is a comparison rather than an mtime inference — a checkout moves an
mtime without moving code, and the 2026-08-02 artifact was quoted for two days against an engine that
had gained "one mega per side" in between.

## Done looks like

- `status.js` prints a leaf calibration line that is fresh, adequately powered, and states the
  reliability curve rather than a verdict string. **Done 2026-08-04** — and the answer is that the
  leaf is worse than a coin.
- `provenance.js --strict` exits zero.
- Every gate R1–R4 has an artifact. **Done 2026-08-04** — and R1's turned out to disagree with the
  prose it replaced. An artifact per gate is the floor, not the goal: R2 and R3 have one each and
  neither records the build it measured, so neither can be checked against anything.
- `REFIT OWED` is either clear or has a dated reason next to it.
