# Changelog — ABRA

All notable changes to ABRA are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Rule.** Every change is logged here in the same pass as the code, together with the matching
updates to the white paper, the deck, and the technical documentation. A prior conclusion is never
silently rewritten; what changed and why is stated.

---

## [3.33.0] — 2026-08-04

### Corpus drift is measured in absolute power, not in percent — and `slowking-playstyle` is not a playstyle result

**The drift threshold was a treadmill by construction.** `data/pory-nn.json` was regenerated on the
current corpus and `tests/test-site-data-fresh.js` reported *CORPUS DRIFT 15.7%* the same day. The
store is append-only and collects hourly (clean games 5,269 → 7,123 in four days), so a percentage of
it is an AGE, not a fraction: a 10% threshold marks every artifact stale about a day and a half after
it is built, however often it is rebuilt. `engine/provenance.js` now prints an absolute-power line
beside every drift note — how many percentage points of 95% CI width the missing games buy, and a 2sd
bound on how far they could move the point estimate. Measured across all thirteen drifting artifacts
the percentages span 4× and the power spans 2×: `war.json` is missing **48.6%** of its corpus and can
move a proportion by **0.83 points**; `counterplay.json` at 12.8% can move it **0.42**, which is below
the smallest split-half noise floor this project has published (0.43). **No artifact in the repository
has enough missing data to move a proportion by one point.** The bound is `√f/√n`, so it shrinks as
the corpus grows — the treadmill ends on its own rather than being switched off.

**The 10% trigger is deliberately unchanged**, because `max_shift` still cannot see the distance from
an artifact's headline to its decision boundary — the thing that actually decided every row of
`docs/MEASURE.md` §5c's hand triage. The next rung is a declared `decision_margin`.

- **Added** `population_ceiling` as a declaration `provenance.js` honours, in the same convention as
  `not_store_derived`, `raw_store_ok`, `gate` and `games_requested`. It fixes the drift check's own
  measured false positive: `data/pory-eval.json`'s population is a strict subset (clean ladder games
  whose raw log exists AND names a winner — 5,456, not 7,123) and can never read below ~21% against
  the wrong denominator. The reader side exists; `engine/pory.py` must write the key on its next
  deliberate run.
- **Unchanged on purpose:** the quality-filter check (`data/counters.json`, UNSAFE for nine days) is a
  PREDICATE test, not a volume test, and no amount of power makes a differently-filtered artifact
  valid. Confusing the two is how a volume rule takes credit for a correctness rule's catch.

**`data/slowking-playstyle.js` has been a GURU result under the playstyle name since 2026-08-03.**
`engine/slowking_preview.py` takes its output NAME from `TAG` and its MATRIX from `MATRIX_FILE`, which
defaults to `data/guru-matchups.json`. Run with `TAG=playstyle` and `MATRIX_FILE` unset it writes GURU
under the playstyle filename, and that is what is on disk: `slowking-playstyle.js` has a payload
**byte-identical** to `slowking.js`, and `slowking-playstyle-eval.json` is a **byte-identical file** to
`slowking-eval.json` — 5,265 games over 12 species-pair archetypes, where the real playstyle matrix
holds 2,860 games over 8 playstyles. Re-running it correctly reproduces the figures `docs/MODELS.md`
already publishes (336 candidate triples, greedy−Nash 0.026 CI [−0.0001, 0.1498], mixture Rain 0.81 /
Setup 0.17 / FakeOutBalance 0.03) to the digit, so **the docs are right and the artifact is wrong**.
Not repaired here: it moves every figure the site's cycle panel renders, so it is a joint pass with
WEB. `engine/build-status.js:18`, `engine/sanity_check.py:32` and `tests/test-docs-current.js` all
read the clobbered file today.

- **Verified, not landed:** `data/engine-data.js` was reported 0.9 days stale;
  `build/rebuild_sets_from_sheets.js --write` reproduces it **byte-identically** (318 species, 195
  rebuilt, materially changed 0). The original mtime was restored, because bumping it turned
  `counterplay.json`, `scoreboard.js` and `winrate-backtest.json` into "older than its input" for a
  regeneration that changed nothing.
- **Fixed** `tests/test-site-data-fresh.js` printing `node engine/slowking_preview.py` as a repair
  command in its STALE table; the interpreter is now derived from the extension there too.

### `docs/MODELS.md` had drifted in three places, and a fourth report did not reproduce

- MAG's method line read *53 features / 6,091 games / 146,910 decisions (117,824 / 29,086)*. The
  artifact `data/policy-weights.json` carries **58** features and a `corpus` of
  **8,414 / 220,613 / 176,580 / 44,033**. A second heading two screens down said *56 features*, so the
  file disagreed with itself as well as with the artifact.
- MAG's corpus line read *198,157 usable decisions from 7,507 games*; the same artifact records
  **220,613 kept of 228,084 seen from 8,414 games**.
- SLOWKING's headline mixture (*Kingambit-Basculegion 0.84*), exploitability (*uniform 0.109*), named
  cycle (*Charizard-Venusaur → Whimsicott-Garchomp → Garchomp-Incineroar*) and gap CI (*upper bound
  0.27*) exist in **no file on disk**. Replaced with what `data/slowking-eval.json` says.
- **Did not reproduce:** the mechanics census. `data/mechanics-census.json` reads **102 live of 144
  probed, 42 missing**, `docs/ENGINE.md:15` already prints that, and `docs/MODELS.md` carries no
  census figure at all. Nothing was changed for the reported *42/54*.
- **Did not reproduce:** *"the site rendered GURU's 0.735"*. `0.735` appears nowhere in `web/` or
  `app/` except as Golurk's percentiles in the JOLTEON roster. The stale figure was in
  **`docs/SUMMARY.md`**, attached to a superseded 1,124-game / 11-archetype run; that row is corrected
  to the artifact's 5,265 games / 12 archetypes / **0.7124**, with the multiplicity arithmetic beside
  it. The verdict — worse than a coin — is the same under both runs.

### Added — GURU has an entry in `docs/MODELS.md`

The matchup matrix had no ledger entry, the same gap MILTANK had. It carries the honest state: a
12×12 = 144-cell matrix over **5,265 clean games** generated 2026-07-31 and now **26.1% behind**;
**6 directed / 3 distinct** decisive matchups of which **ZERO survive FDR at q=0.05 or Bonferroni**
(66 pairs, 3.3 expected by chance, 3 observed, smallest exact p **6.1e-3** against a BH threshold of
**7.6e-4**); a predictive test of **0.7124** against a coin's 0.6931 — **worse than a coin**; and the
`n_decisive` bug, in which `build_guru_js.js` read a
key that did not exist, recomputed the count from its own empty fallback and shipped *"ZERO
statistically-decisive matchups"* as a finding. It was **accidentally right by way of a bug**, which is
worse than wrong, because a conclusion produced by a broken path cannot be checked and licenses the
path. Not regenerated, deliberately — it moves every number the GURU booth renders.

### R2 and R3 stamp their configuration — and R3's published number turns out to have no control

R1 lost its result to a missing stamp: the published *"68.18% against material's 65.26%, +2.91
[1.79, 4.04]"* recomputes from the only committed evidence to **+0.456, 95% CI [-0.717, +1.630] —
UNDECIDED**, because a dump taken at `explore=0` and a dump taken at `explore=1` are byte-compatible
and differ by nearly four accuracy points. R2 and R3 had the identical hole. This closes it, and
finds two things on the way that matter more than the plumbing.

#### Do the published numbers reproduce?

| gate | published | recomputed from committed evidence | verdict |
| --- | --- | --- | --- |
| R2 | 477 boards over 200 games; 5.83 ms median at n=10 | affordability table reproduces to the digit (K=3 → 0.47 s / 1.75 s; K=4 → 1.49 s / 5.53 s) | derived layer **yes**; base layer **NOT CHECKABLE** |
| R3 | 72.9% over 70 decisions (19 agreed, 20 skipped) | 100 × (70 − 19) / 70 = **72.857142857142854**, bit-identical | **yes — and it is a tautology** |

Neither reproduction is worth much. R3's divergence is a pure function of two fields in the same
file; there are no per-decision rows, so "it reproduces" means only that the artifact is internally
consistent. R2 dumps no per-leaf timing, and a duration is not recomputable by anyone in principle —
it is a fact about a machine under a load, and nothing records the CPU, the node version or what else
was running. **R2 is re-run or it is nothing.** This is a different failure from R1's: R1's number was
wrong, these two are unfalsifiable.

#### R3's result is not interpretable as published

`engine/rollout_r3.js` computes the only control that makes a divergence rate mean anything — the same
search on a different seed disagreeing with **itself**, where the truth is 0.00 by construction — and
it prints it and does not write it. Its own verdict branches on that number (`rate <= floor` prints
NOT A RESULT), so `data/rollout-r3.json` cannot say which branch its own run took.
`docs/ROLLOUT-design.md` §5 publishes floors of 71.7 / 50.0 / 45.5 / 43.8% — for four earlier runs,
none of them the committed one. At N=20 that floor measured *higher* than the divergence.

The divergence is probably real: the floor fell as N rose, and this run used N=600. But *probably* is
an inference from a different run, and the Wilson interval on 51/70 is **[61.5%, 81.9%]**.
`engine/status.js` and `docs/MILTANK.md` both quote the 72.9%, and MILTANK.md spends it on a build
decision. The floor is now written into the artifact along with a `verdict` and `verdict_code`.

#### R2 timed a leaf the bot does not run

`rollout_r2.js` called `RL.rolloutWinProb` without `explore` or `maxTurns`, inheriting
`engine/rollout_leaf.js:197`'s `explore = 0` and `engine/medicham2-browser.js:1079`'s `maxTurns = 20`.
MILTANK's in-game leaf is **explore=1.0 at maxTurns=60**. R1's hole in cost form: two library
defaults, written down nowhere, deciding the number that the whole affordability table rests on.

#### And `data/rollout-r3.json`'s own caveat is false about the run it describes

It reads *"Switch candidates are excluded and counted"*. Commit `b4ec80b` deleted the
`if (ca.switchTo || cb.switchTo) continue;` line — switches went **on** the menu, which is what that
commit was for — and left the string alone. The `withSwitch` / `choseSwitch` counters it added were
printed and never written, so its headline ("4 of 12 when one is on the menu") lives in a commit
message.

### Added
- `engine/run_stamp.js` — one implementation of the sidecar `rollout_r1.js` hand-rolled inline, so the
  next gate cannot grow a second format. `writeStamp()` records N, explore, every knob including the
  ones left at a default, sha256 content digests of every source the gate reaches, the commit, and
  **whether the tree was dirty** — a clean commit id over a dirty tree is a lie of exactly the kind
  this exists to stop. `reconstruct()` infers a stamp for an artifact that predates all of this, from
  the commit that carried it, and marks itself `reconstructed: true` on every line.
- `data/rollout-cost.meta.json`, `data/rollout-r3.meta.json` — retrospective stamps. Both score HIGH:
  written 25 s and 159 s respectively before the commits that carried them.

### Changed
- `engine/rollout_r2.js` — `explore` and `maxTurns` are explicit, overridable and stamped, with
  defaults that preserve the previous behaviour exactly. `games` is now the distinct games actually
  traversed rather than the `GAMES` environment cap, which `status.js` had been printing as
  "over 200 games". Adds `n` / `n_unit`, `samples_per_n` (the quantile columns were not guaranteed to
  be measured over the same board set), `boards_traversed`, `leaf_config` and a `caveats` array.
- `engine/rollout_r3.js` — writes the noise floor, a `verdict` and `verdict_code`, the switch
  counters, and the disagreement-gap median from the same variable it prints rather than recomputing
  it at the write site. Caveat corrected and moved to a `caveats` array.
- `engine/status.js` — prints each gate's stamp, or its absence, under the gate line. It derives the
  sidecar path from `run_stamp.metaPathFor` rather than spelling it a second time, and stays quiet for
  an artifact that already carries its own `stamps` block, because a line that fires forever after the
  fix is a line people learn to skip.
- `caveats` is now an array on all four rungs. It was `caveats` on R1 and R4, scalar `note` on R2 and
  scalar `caveat` on R3 — three shapes for one idea. No reader breaks: `status.js` and
  `web/build-status.js` read only the count fields, `generated` and `verdict*`.

### Notes
- **Not renamed:** `data/rollout-cost.json` should be `data/rollout-r2.json` — it is the only rung
  whose file does not carry its gate's name. Four readers, three of them under `web/`, which MEASURE
  does not own. A rename that misses one prints NOT DERIVED and reads as "nobody ran this". Needs WEB
  in the same pass.
- **Not corrected:** `docs/ROLLOUT-design.md` §5's "roughly 200x the simulated turns per millisecond"
  is **155x** by the arithmetic of the two artifacts it cites, and 155x is itself a ceiling because it
  assumes no playout ends early. SEARCH's document, and a SEARCH sweep is live. `rollout_r2.js` now
  prints the division rather than a remembered figure.
- **Not fixed:** `n` / `n_unit` on R1 and R4 (one line in each generator); `rollout_r1_join.py`'s naked
  Python `isoformat()`, which JavaScript reads four hours early; `engine/rollout_r1.js` calling
  `run_stamp.js` instead of its inline copy — SEARCH holds that file.
- Neither R2 nor R3 was re-run. Every figure above is arithmetic over committed evidence.

---

## [3.32.0] — 2026-08-04

### Leaf calibration, re-measured: the leaf the search actually uses is WORSE than a coin

`data/winrate-backtest.json` said *"MEDICHAM does NOT beat coin; does NOT beat Elo"* off 350 games at
40 rollouts, dated 2026-08-02. Four things were wrong with it, and none of them was the leaf.

1. **It scored a leaf no live decision calls.** It measured `winProb2` — `battle()` at MEDICHAM's
   default 20-turn horizon with entry effects re-fired. MILTANK calls neither. Its team-preview leaf
   is a greedy playout at `maxTurns=60 / seeded:true`; its in-game leaf is
   `rollout_leaf.rolloutWinProb` at `explore=1.0 / foePolicy=uniform / maxTurns=60`.
2. **It was stale and nothing said so.** `engine/medicham2-browser.js` moved 2026-08-04 04:47 across
   22 commits, one of which records that 45% of rollouts had been on an illegal board.
3. **n=350 could not carry "does not beat a coin".** The 95% interval on 52.63% over 342 decisive
   calls is ±5.3 points. Absence of evidence was reported as evidence of absence.
4. **MEDICHAM and Elo were compared on different samples** — 350 games against 238.

`engine/backtest_winrate.js` now builds a real turn-0 `board.js` Board from the brought teams and the
real leads, hands it to `rollout_leaf` (no second body builder — LESSONS 8), scores three leaves on
identical positions, and publishes a **reliability curve with counts and Wilson intervals per bucket**
instead of a verdict string. Every comparison is paired with a bootstrap CI. n is set by a power
calculation printed before the run: detecting the prior 52.63% effect at 80% power / α 0.05 needs
n=2,835, so the full clean corpus (6,886) is used and the held-out fifth (1,378) is reported beside it.

| leaf | n | Brier vs coin, paired | discrimination | says 90-100% → wins |
| --- | --- | --- | --- | --- |
| in-game, 200 rollouts (held-out) | 1,378 | **+0.0502 [0.0371, 0.0628]** | 50.99% [48.3, 53.7], p=0.47 | 53.6% (n=56) |
| in-game, 40 rollouts (full clean) | 6,886 | **+0.0466 [0.0407, 0.0523]** | 51.80% [50.6, 53.0], p=0.004 | 53.5% (n=344) |
| team-preview, 40 rollouts (full clean) | 6,886 | **+0.0740 [0.0668, 0.0813]** | 53.22% [52.0, 54.4], p<1e-4 | 55.3% (n=933) |

Positive is worse. All three lose to a coin and to player-Elo, decisively and on paired intervals
that exclude zero. The curve is close to **horizontal**: the in-game leaf's 0-10% bucket also wins
53.8%. The preview leaf puts 25.6% of its predictions in the two extreme buckets and is wrong there
by about 40 points. **Confidence carries no information; the search is maximising a number that is
flat.** LESSONS 2.

**Not an engine regression.** The legacy `winProb2` path reproduces the old artifact closely
(held-out log-loss 1.0243 against 1.0748 published, discrimination 51.94% against 52.63%), so the 22
engine commits did not move the headline. Two independent full runs of that arm differ by 0.26
accuracy points on n=6,886, which is the run-to-run noise floor for this instrument; every seeded
config reproduces bit-identically.

Also fixed, all in the same file: the "temporal" split was cutting on **store append order**, and the
store has 4,775 date inversions — it is sorted by date now. A side-symmetry witness scores 400 boards
from both sides and reports mean(p1+p2−1) = −0.0099, so no side advantage is contaminating the result.

**The artifact now stamps the sha256 and mtime of every source the leaf reads**, and `engine/status.js`
re-hashes them and prints `CURRENT` or `PRE-CHANGE` — a comparison, not an mtime inference. The store
is reported separately from the engine sources: an append-only corpus growing means more power is
available, not that the number went stale, and a flag that is always on is a flag nobody reads.

Per-game predictions are kept in `data/winrate-backtest-rows.jsonl` so the curve can be re-cut without
re-running 17 minutes of rollouts. `MAXG` thins the corpus for a smoke run and the artifact records the
n it actually scored.

**Filed, not fixed** (MEASURE does not touch a search knob — DIVISIONS rule 2): the horizon is the
first suspect. `battleResult` falls back to bodies-then-HP whenever a playout does not finish, so a
confident leaf reading can be a material count wearing a probability's clothes.

### R1's published PASS is withdrawn. It had no artifact, and the evidence that survives says UNDECIDED

`docs/ROLLOUT-design.md` published *"R1 — PASSED ON THE BASELINE. 9,201 positions, fully random
playout: rollout 68.18% against material's 65.26%, +2.91, 95% CI 1.79 to 4.04."* `engine/rollout_r1.js`
printed that with `console.log` and wrote **no artifact for it**. Meanwhile `data/rollout-r1.json` —
the file `engine/status.js` read and labelled "R1 leaf accuracy" — held the 230-row cross-language
join that the same design doc records as **withdrawn**. So the gate reported a withdrawn result while
the real one had no file at all. The identical defect `status.js` already called out for R4, one gate
above it, undetected for longer.

Recomputed from the one committed input, `data/rollout-r1-rows.jsonl` (9,201 rows), with the formulas
in `rollout_r1.js`:225-272 and no re-run:

| judge | accuracy | Brier | log-loss |
| --- | --- | --- | --- |
| coin (= the base rate) | 52.46% | | |
| material, porygon2 form (graded) | **65.26%** | 0.2127 | 0.6124 |
| ROLLOUT, the dumped column | **65.72%** | 0.2573 | 1.7674 |

**+0.46 points, 95% CI −0.72 to +1.63. McNemar on 3,034 discordant positions (1,538 / 1,496).
UNDECIDED by `rollout_r1.js`'s own thresholds** — the interval spans zero.

The material column reproduces the published 65.26% exactly, so it is the same 9,201 positions. The
rollout column is a different rollout: its reliability bins reproduce §4.2.1's **greedy** saturation
table count-for-count (2,245 at 26.0%, 2,612 at 75.9%), so the surviving dump is the `explore=0`
incumbent, not the fully random playout the verdict was computed from. `mpy` is deterministic given a
position, so a matching material accuracy proves the same **sample**, never the same **run**. The
generator asserts that comparison against the design doc rather than restating it.

**The published 68.18% cannot be recomputed from anything committed.** It is retracted as
*uncheckable*, not as *wrong*, and the sentence is kept verbatim in `ROLLOUT-design.md` §5.

The cause is a missing stamp, not a bad number. The dump recorded neither `N` nor `explore` nor any
build digest, so two runs four accuracy points apart were byte-indistinguishable.

### Added
- `engine/rollout_r1_artifact.js` — recomputes R1 from the row dump and writes `data/rollout-r1.json`.
  Arithmetic only: no engine, no Showdown, no weights, because the engine is a fact about how the rows
  were produced and not about how they are counted. It records the reliability curve, a three-cut
  split-half floor (spread 0.43–2.01 points against an effect of 0.46 — the effect is inside its own
  noise floor) and `stamps: null` with the reason, rather than hashing today's sources and implying
  they describe the run.
- `data/rollout-r1-rows.meta.json` — a sidecar `rollout_r1.js` now writes beside every dump, carrying
  `N`, `explore`, the sweep and content digests of every source the leaf reaches. A sidecar and not a
  header line, because `rollout_r1_join.py` parses every line of the dump as a position.

### Changed
- `data/rollout-r1.json` is now the recomputed gate result. The withdrawn join moved to
  `data/rollout-r1-withdrawn-join.json` with `withdrawn: true` and its reason as a field. A withdrawn
  result must stay readable — a prior conclusion is never silently rewritten — but it must never be
  what a gate reads.
- `engine/rollout_r1_join.py` writes the withdrawn name, sets `withdrawn` from its own alignment
  check, and can no longer claim the gate's filename.
- `engine/status.js` prints R1's verdict the way it prints R4's, and **refuses to print any artifact
  carrying `withdrawn: true`** whatever it is called. It also prints which rollout the dumped column
  is, because that changes how the verdict reads.

### Fixed
- `rollout_r1.js` dumped `ps[N_LIST[last]]`, but the sweep keys become `${n}@${explore}` as soon as
  `EXPLORE_LIST` holds more than one value — so under an explore sweep the lookup returned `undefined`,
  `JSON.stringify` dropped the field, and every dumped row lost its rollout column silently. It now
  uses the same key the verdict does.

### Notes
- `--rollout-explore` still defaults to `1.0`, and `engine/rollout_leaf.js:147`, `engine/mag_bot.js:145`
  and `docs/MILTANK.md` all cite 68.18% as the reason. That default now rests on the MCTS literature and
  on the saturation table, not on a measured head-to-head. Filed to SEARCH; not changed here.
- R2 and R3 have the same missing-stamp hole. Neither `data/rollout-cost.json` nor `data/rollout-r3.json`
  records the build it measured, so neither can be checked against one.
- `engine/provenance.js` cannot see `data/rollout-r1-rows.jsonl` as an input — its scan covers `*.json`,
  `*.js` and `games.*.jsonl` — so the artifact carries the dump's sha256 instead.

---

### The differential count was never reproducible, and Rage Powder deletes the attack

`engine/status.js` printed *"6/120 differential comparisons disagree"* as an artifact-backed figure.
The sampler used bare `Math.random()`; two runs on identical source gave **6, then 3**. It is now
seeded (`--seed`, default `20260804`) and consecutive runs are byte-identical. Found while seeding:
`argv[argv.indexOf('--seed')+1]` reads `argv[0]` when the flag is absent, so the harness printed
`seed NaN` while quietly running seed 1 — the silent default this project bans. `argInt()` now exits
non-zero on a bad flag.

**Five of the six open differentials were HARNESS bugs, not engine bugs.** The hypothesis that they
shared a spread-move `0.75x` cause is **refuted**: the ratios cluster at **1.50**, not 1.33, and the
`0.75` cancels on both sides because `moveHit` enters at `spreadMoveHit` and never sets `spreadHit`.
The real causes were Intimidate and Sand Stream leaking through Showdown's switch-in, unpinned
`gender` handing Rivalry a seed-dependent 0.75 that no engine could match, and `moveHit` skipping
the ability's `onTryHit` so Water Absorb never fired — meaning the harness reported MEDICHAM's
**correct** 0-0 into Vaporeon as the engine's bug. Each fix was judged by driving its target case to
`rel 0.0%`, not by inspection. Seeded residual **4/400 (1.0%)**.

**Tag walk: 88 probes written, 40 red. Census 42 → 90 live. Coverage 53/176 → 137/176.** No
previously-live probe fell.

~~The worst thing found is redirection, 7,240 uses: the attack VANISHES.~~ **WITHDRAWN THE SAME DAY —
the probe was wrong, not the engine.** It aimed **Dragon** Claw at **Whimsicott**, which is
Grass/**Fairy** and immune to Dragon: Follow Me fired correctly and landed the attack on a body that
takes exactly zero, so both arms read 0. Re-staged with Milotic the same unmodified code reads
`aimed 0 / redirector 101`. **Redirection works and always has; nothing was invalidated.** The real
gap was `redirectsType` — Lightning Rod and Storm Drain, **1,901 uses** — where the engine only ever
looked for the Follow Me volatile. Fixed. Left in place rather than deleted because a prior
conclusion is never silently rewritten.
(Note this does **not** contradict 3.31.1 below, which measured the *fit's* unmatched clicks over
real games and is unaffected by a rollout defect — but any rollout-based claim touching redirection
is now suspect.)

Behind it: `drain` 8,553 uses (*"dealt 51 to the foe; user 85 → 85 hp"*), `choiceLock` 5,886 — **not
unimplemented**, `board.js` passes its own test, so two engines disagree about a fact — `multiHit`
4,655 priced as a single hit, and `fixedDamage` 1,122 where `mv.bp=0` makes Seismic Toss worth
literally zero.

**Six probes were wrong before the engine was**, each caught by its own control: a spread move where
single-target was needed, Close Combat at a Ghost, Toxic at a Steel, Fly from a slower body, Protean
tested with a type it already had, and a redirect probe with no control arm. That is the probe-first
rule paying for itself.

### WEB — a fifth division, and ten numbers on the site that were not true

`web/` had no owner. ENGINE, MEASURE, SEARCH and OPS are cuts on the **model's** invalidation graph
and a website is not on that graph, so site work fell to whoever was holding it. WEB is the **leaf**
— everything flows in, nothing flows out — which is why it gets hands on its own files and none
anywhere else, and why its restriction is about authority rather than tools: **it renders numbers and
never authors one.**

Added `web/stadium.html` (ABRA STADIUM — a Pokémon Stadium 2 model-select screen, one cabinet per
model, each carrying its real figures **and its honest caveat**) and `web/status.html` (the STATUS
BOARD, built by `web/build-status.js` into a script-tag global rather than `fetch()`, because under
`file://` a fetch of a local JSON is CORS-blocked and returns nothing **with no error a visitor
sees**).

Ten rendered figures did not match their artifacts and were corrected: GURU `0.735 → 0.7124`, XATU
`36%/72% → 29.8%/65.6%`, open-sheet entries `60,852 → 85,992`, SLOWKING `"11–18 games each" → 49, 37,
15` with the artifact's own `supported: false` now on the page, resist berries `16 → 18`, the RPS
cycles downgraded from *"the proof"* to *"the hypothesis"*, and *"for the real read, play it out with
MEDICHAM"* replaced by the measured verdict. Four stale hardcoded fallbacks now render **NOT
MEASURED** instead of a plausible wrong number.

`tests/test-stadium-roster.js` compares the cabinet rack against `docs/MODELS.md` and failed on its
first run: **MILTANK — the search player that owns the R4 result — had no entry in the per-model
ledger at all.** Added.

### External evidence, recorded as priors and never as findings

`docs/EXTERNAL-EVIDENCE.md` (new). Three independent sources now say search beats a search-free
policy in Pokémon: R4's 55.5%, PokeTransformer's ~1900-vs-2300 ELO, and the PokéAgent Challenge
reporting that *"the top participants all used RL or MCTS rather than LLM reasoning."*

Two corrections came out of it, both against ourselves:

- **"More features did not help a linear model" is NOT evidence that "a nonlinear model would not
  help."** ABRA's four feature nulls were measured on a linear conditional logit, which cannot
  exploit interaction structure however good its features are. Only the first claim has been tested;
  the second was being treated as settled.
- A claim written in this file at 03:00 — that Gen9 VGC Reg I ships with a 4M-trajectory dataset and
  30 pre-trained agents — **was wrong and is corrected in place**. Metamon excludes VGC entirely; the
  only VGC-inclusive dataset is `pokechamp`. Two true sentences were joined into a false one.

Filed from it: an audit of whether `board.js` leaks later-revealed information into the fit (the
Metamon "spectator point of view" problem, against 146,910 fitted decisions); a re-measurement of
exploitability, since greedy-over-sampling shipped for +12 points and makes the policy **more**
deterministic while WOBBUFFET's 63.2% is three feature generations stale; and **downside-aware
selection** — MILTANK argmaxes the **mean** rollout value, so it cannot tell a flat 60% line from a
90% line that loses on the spot, despite computing the whole distribution and discarding everything
past the first moment.

Also written down for the first time: real VGC allows **45 seconds per decision** on a 7-minute
clock. That is MILTANK's live budget and R2's leaf cost has never been checked against it.

### Housekeeping

- Three dead git worktrees removed (`ABRA-old21`, `ABRA-prefeat`, `ABRA-tagsoff`), 273 MB. All were
  clean and fully contained in `main`. They were **worktrees, not clones** — `rm -rf` would have left
  stale registrations in `.git/worktrees`.
- `engine/status.js`, `docs/DIVISIONS.md`, `docs/LESSONS.md` and the four division agent files were
  **untracked**. `CLAUDE.md`'s first instruction pointed at files a fresh clone would not have.
- 46 commits were unpushed. `data/rollout-r1-rows.jsonl` — R1's only evidence — and the
  `data/train-doduo*/` weights behind four published CHANGELOG 3.31.0 figures were untracked; both
  committed, with the regenerable self-play blocks gitignored in negation form so the rule reads the
  way it behaves.

---

## [3.31.1] — 2026-08-02

### The 23% drop was never redirection, and measuring first is the only reason we know

Three documents, the roadmap and `fit_policy.js`'s own caveat all said the clicks the fit could not
match were "mostly redirection (Follow Me, Rage Powder)". Nobody had measured it.
`engine/redirect_audit.js` (new) did, over 7,454 games and 86,242 two-slot turns:

| | |
| --- | --- |
| joint turns dropped as unmatched | 19,995 (**23.18%**) — reproduces the shipped fit exactly |
| ...with a redirector up for them | **319 (1.60%)** |

Redirection *cannot* make a click unmatchable. The protocol emits no `-activate` line for a redirect
and prints only a move's **resolved** target, so the redirector is a legal candidate: the matcher
finds it and accepts the click **with the wrong label**. That is real, small (**1.55%** of all
clicks), and unrecoverable — the chosen target was never written down by anyone.

**The roadmap item proposing a `board.js` change for this is void**, and so is its second argument:
`engine/collinearity_joint.js` (new) shows `redirectThenAttack`'s −0.405 is not split credit
(VIF **1.2**), and humans pick that pair only **1.09x** the base rate among the same alternatives.

### What the drop actually was — three defects, one shape

`engine/click_match.js` (new) is now the single reader of "whose moveset is this, and which candidate
did they press", replacing the same three lines in seven files. By share of failures:

- **44.4% — the foe switched in that same turn.** Switches resolve before moves, so the protocol
  records the mon that *arrived* while the human was choosing against the one that *left*. A human
  aims at a SLOT; the store records a SPECIES.
- **19.7% — an in-battle forme change with no sheet entry.** `floette` 3,627, then `aegislashblade`,
  `palafinhero`, `mimikyubusted`, `morpekohangry`. The forme problem, in a third table.
- **16.4% — a mirror collapsed the two team sheets.** Species Clause is per PLAYER, so
  `sheet[base(species)]` overwrote one player's set with the other's. **58.63%** of corpus games carry
  a species on both sheets, **8.02%** of all slots were scored against the opponent's four moves, and
  **62.16% of those matched anyway and were fitted against the wrong choice set** — a wrong
  denominator that nothing counted.

Same replays scored twice: usable joint turns **76.80% → 94.52%**; slot match rate **87.2% → 97.2%**.

### Both vectors refitted and shipped, the marginal one SPRT-gated

- **Marginal:** 176,981 → **196,803** usable decisions (+11.2%); unmatched clicks **2.94%**.
  Head-to-head against the incumbent, both arms greedy, arm 1 the challenger: **58.4% of 238 decisive
  pairs**, DECIDED at 219 by `engine/sprt.js`, with `paired_h2h.js` agreeing 139/139 and 99/99.
  Stopped at 2,750 games of 20,000 — **17,250 saved**.
- **Joint:** 66,236 → **81,515** usable turns. **Zero sign flips across all 74 weights**, 12.0% L2
  movement, held-out pair top-1 12.2%. Shipped on correctness: it is opt-in (`--joint`) and not on the
  default play path, so no machine time was spent on its H2H.
- `RANKER_WEIGHTS` / `OUT_JOINT` let a candidate pair vector be fitted against a candidate marginal
  one without overwriting either incumbent, and the joint artifact now **records which ranker built
  it** — the top-K cap is taken by the single-move score, so that pairing was previously implicit.

### Guards

- **`tests/test-click-match.js`** — 23 assertions, each built from a measured defect, and each also
  asserting the OLD lookup fails. A test that passes before and after proves nothing.
- **`tests/test-degradation-budgets.js` did the other half of its job.** Built last session to record
  rates, it tonight *refused to pass* when two new counters appeared without ceilings. Ratcheted:
  `fit_joint.turnsDropped` **23.2% → 5.49%**, plus `fit_policy.unmatchedClicks` 2.95% and
  `fit_policy.decisionsDropped` 3.30%.
- **`tests/test-site-data-fresh.js` caught a regression as it was introduced.** Routing `fit_joint`'s
  write through an `OUT` variable hid its generator from the provenance scan, which pairs a filename
  with a write call on ONE line. It reported the new orphan at once — and that exposed the same blind
  spot on `data/policy-weights.json`, baselined as "no generator" ever since `OUT_WEIGHTS` was added
  to `fit_policy.js`. **The shipped model file had no discoverable way to rebuild it.** Both fixed,
  orphan list 7 → 6. The scan was not loosened.

### `engine/joint_rows.js` — the replay loop lives in one place

Extracted from `fit_joint.js` so that asking a question about the pair fit does not mean writing a
fourth copy of it. Verified against the shipped artifact's own tally: 86,242 seen, 66,236 kept,
19,995 unmatched, 11 ambiguous. It needs `--max-old-space-size=4096` — the corrected matcher's extra
rows walk Node's default 2GB heap into an OOM that looks like a crash rather than a limit, now
recorded in the header.

### `build/omnibus.py` no longer reports success when it produced nothing

It printed `FAILED` and exited **0**. It now exits 1, prints to stderr, and names the headless-Chrome
command that works. WeasyPrint's `libgobject` breakage is unchanged — that is an environment problem;
a build step lying about it was a code one.

### Corrections to the record

- **"Total variation distance 54.8%, every top species under-represented" does not reproduce.**
  `realism_report.js` on the current self-play store (MAG vs MAG, both greedy) gives a **3.0-point**
  mean absolute gap over the top 12, with **four of twelve over-represented**. The metric behind 54.8%
  could not be found in the repository. The deduplicated team pool is a *documented deliberate choice*
  (`mew.js:270-301`), not an oversight.
- **The large realism gaps are mechanical**, in the category that report labels "fix these": Protect is
  **23.2%** of MAG's moves against a human's **13.8%**; games run 12.28 turns against 8.13; moves
  outright fail 5.6% against 2.5%.
- **Greedy, not the missing opponent model, causes the conditional-move failures.** Sucker Punch:
  greedy 47.9% failure, **sampling 33.2%**, human **33.9%** — at identical usage. Baneful Bunker
  37.3% → **17.6%** against human 17.5%. Greedy takes the argmax every time, so a condition-dependent
  move gets clicked in all the spots where it whiffs. **This corrects a claim made earlier in the same
  session** that the 48% figure priced the absent opponent model; it does not. Protect is the mixed
  case — greedy explains about half the excess (219.7 → 165.5 per 1,000 moves), the rest is the
  weights, still 1.44x human.
- **`partial_bring` deletes a third of the self-play corpus, and it is a MAG symptom.** Dropped games
  average 8.55 turns and 2.86 switch events against kept games' 12.28 and 4.25: MAG under-switches, so
  fewer of its team are revealed, so the filter bins the game — biased toward short decisive ones. It
  also inflates the metric it is read from: across all self-play games the mean is **10.98** turns,
  not 12.28.

---

## [3.31.0] — 2026-07-31

**The first tagged release.** Both the engineering review and the systems audit noted that nothing
existed to roll back to. `v3.31.0` is that point. It is tagged with one test failing, named below,
because a rollback point that waits for a perfect tree is a rollback point that never exists.

### DODUO can be trained for winning
The 18 coordination weights had only ever been fitted to predict a human click. `train_policy.js
--joint` now moves them by whether the game was **won**; `--joint-only` freezes the 56 singles so the
whole trust-region step reaches the block under test.

- The pair softmax gradient is the concatenation `[xa + xb, jf]` — the two single vectors summed
  (both scored by the same single block), then the pair terms. `accumulateLogitGrad` was already
  generic, so no new mathematics was required. Vector length **74 = 56 singles + 18 pair terms**.
- **Four faults would each have produced a plausible, wrong learning curve**, all caught by checks
  rather than by reading: a run gradient sized from the single weight file and summed with
  `k < GRAD.length` (74 truncated to 56); `learnGrad` allocated before `this.wj` loaded; a hardcoded
  joint-weights path that made every iteration replay the frozen fit; and a preflight gate that
  indexed only `B.FEATURES`, certifying a joint run without checking the block it exists to train.
- **The trust region starved the pair block**, structurally rather than by mistuning. The first run
  (48,691 games) moved it 4.7% while the singles moved 21.7%. Single features appear in nearly every
  choice set; pair features are sparse, so they lose the shared budget by construction and more
  iterations scale both equally. With `--joint-only`: **40.0%**, and three sign flips —
  `overkill` −0.951 → +0.980, `focusFireKills` −0.107 → +1.094, `partnerCoversMe` −0.004 → +0.639,
  with `bothSameTarget` 0.031 → 2.249. The imitation fit penalised focus fire; training to win
  reverses it.
- **No win rate is claimed.** The head-to-head is running; nothing about winning has been measured.

### Every artifact is quotable again — 26 UNSAFE → 0
Both reviews independently reached the same item: wire `provenance --strict`, or waive by name.
Waiving 26 things is a promise to forget, so 25 were regenerated by re-running their own generators
and the last by fixing what the gate was actually complaining about. Two real bugs were underneath:

- `illusion.json` carried a sound RAW-STORE-OK justification **in its generator's source** that never
  travelled to the artifact, where provenance deliberately requires it. It is now stamped by reading
  the generator's own header rather than retyped.
- `archetypes.json` declared 10,538 games against 5,269 clean. The data was always clean; 10,538 is
  exactly 2 × 5,269 — **team sides**, two per game, reported as `n_games`. Every share and silhouette
  in that file had team sides as its sample size while the label said games.

A false-positive class in the checker was also fixed: a generator writing two artifacts in sequence
left the first permanently "older than its input" the second, a complaint no regeneration can satisfy.

### Speed multipliers are cross-checked (systems audit R2)
`board.js` derives them from the dex; `medicham2-browser.js` hardcodes them; nothing compared the two.
`tests/test-speed-multipliers.js` — **15 passed, 0 failed** — compares behaviour as ratios, and
compares the *sets*, so a new weather-speed ability in the dex cannot hide behind four passing
constants. The constants are correct today; that was never the finding.

### Reporting discipline (thesis defence)
- **Multiplicity correction now reaches the reader.** The script had been run since 14:04 and its
  result appeared in no reader-facing document; the only Benjamini–Hochberg text anywhere was about
  a different family of tests. Now stated where the weights are: 56 features, ~2.8 clear zero by
  chance, **53 uncorrected / 53 FDR / 49 Bonferroni, none lost**, family named.
- **`PUBLICATION.md` still cited the retired NMF justification** ("recon-err 0.53", "coherence is
  next") — the two phrases the defence ordered removed. The honest disclosure was in `SUMMARY.md`
  while the retired one was what would have been published.
- **A test asserted a count where it meant a direction.** `sanity_check.py` required Sun > 1000
  teams; Sun is the third largest of eight styles. Now relative, and mutation-tested.
- **`meta-nash.json` has no generator** anywhere in the repository. Rather than fabricate a date it
  carries the git add date, explicitly labelled as such, and a statement that it must not be quoted.

### Known failing at this tag
`tests/test-mag-page.js` — `app/index.html` assigns 21 of 56 features, so the site scores positions
the bot did not. Pre-existing, honest, and visible. Suite: **42 passed, 1 failed, 1 skipped**;
`sanity_check.py` 96 passed, 0 failed; `provenance --strict` green.

---

## [3.30.0] — 2026-07-31

### Every fix and recommendation from the three reviews

**`validate_damage_sim` was red, and the engine was never wrong.** ADR-001 step 3 blocked on 2 of 36
scenarios where the simulator's maximum damage was exactly **double** the calculator's with matching
minima. Diagnosed: the harness probes damage twice (`lo = dmgAt(15)`, `hi = dmgAt(0)`) against the
**same defender**, and a resist berry (Colbur, Chople) applies through `onSourceModifyDamage` and
**consumes itself**. The first probe ate the berry and came back correctly halved; the second ran
against a defender holding nothing. The reported range was `[halved_min, unhalved_max]` — a min/max
ratio of 0.42 where sixteen damage rolls can only give ~0.85. Same class as the crit leak the file
already documents: per-call state on a reused object.

```
before   within-5%  97%   worst 100%   FAIL
after    within-5% 100%   worst   2%   PASS — the wiring is sound
```

### Multiplicity correction — `engine/weight_multiplicity.js` (new)

The thesis defence: 56 features are reported with individual 95% intervals and **~2.8 clear zero by
chance**; no correction existed anywhere. Now measured, family named as the whole shipped vector:

| test | survives |
|---|---|
| uncorrected | 53 |
| Benjamini–Hochberg (FDR) | **53** — nothing lost |
| Bonferroni (FWER) | 49 |

The four that only Bonferroni drops: `killsThreat`, `priority`, `switchDiesFirst`, `switchSurvives2`.
Never significant: `allyHit`, `volatileOnFoe`, `tgtDefenseStage`.

### NMF rank — the disclosure the defence required

`SUMMARY.md` advertised *"6 clean archetypes (recon-err 0.53)"*. Reconstruction error **cannot select
a rank** — `nmf_rank.py`'s own caveat says so. The criterion it does use (bootstrap factor stability,
Brunet et al. 2004) selects **rank 4**, and **rank 6 scores −0.107 excess over null**: less
reproducible than factors fitted to shuffled data. Row now reads ⚠️ **Rank not defensible**.

### 48.1% reconciled against 55.9%

Both stand as measurements of **different configurations** — 55.9% on 53 features with switching off,
48.1% [46.5, 49.8] on 56 with switching on, over 9,728 paired games. Neither generalises to "self-play
helps". Three candidate causes named and untested.

### The bring phrasing the filter mandates

`require_full_bring` conditions on game length: measured, the games it keeps are **1.71× longer**
(7.4 vs 4.3 mean turns, 19,589 kept / 8,713 dropped). Every bring statistic is *"the bring, among
games long enough to show it"*. Now stated in `SUMMARY.md` and the white paper, as
`quality-filter.json` has always required.

### Gates wired

- **`validate_damage.js`** — the golden master against `@smogon/calc`, previously **not in the
  suite**. The coverage assertion missed it because it detects checks by *output format*; widened to
  recognise a gate by behaviour, then narrowed after the first version matched 36 files.
- **`validate_damage_sim.js`** — found by that widening.
- **`provenance.js --strict`** — both the systems audit and the engineering review found it
  independently: correct, complete, wired to nothing. **It is red at 31 artifacts.** The fix is to
  regenerate them, not to remove it from the list.

### Also

- `@smogon/calc` pinned to exactly **0.11.0** — it is the ground truth of the damage golden master and
  was a caret range.
- The simulator pin is now **verified**, not asserted: `actualCommit()` reads HEAD, `verify()` reports
  `commit_matches` as true/false/**null-for-unknown**, and `mew.js` stamps the **real** commit —
  it previously stamped the constant, so a checkout at any other commit still produced records
  claiming `20ad99ff`.
- Paralysis (×0.5) and Tailwind (×2) now checked in `test-engine-consistency.js`. `CLAUDE.md` names
  three multipliers that must be one definition; only Scarf was guarded.
- The suite's only literal tautology (`ok(true, …)`) replaced with a real assertion, and a silent
  fallback in `position_features.js` that reverted a documented bug is now counted.

---

## [3.29.0] — 2026-07-31

### Three features from the tag artifact, and all three are large

`data/tags.json` derives **96 move tags with their parameters**, and `engine/tags.js` exists to load
them — its own header says *"172 tags were a specification, not a component ... built, saved, quoted,
never used."* `board.js` read **none** of them; **72 of the 96 reached no consumer at all**.

Will spotted it from the symptom: *"DOES MAG STILL NOT VALUE TAILWIND?"* It did not, and could not.
Tailwind's tag is `doublesSideSpeed {speedMult: 2}` over 7,676 clicks, and MAG scored **Tailwind and
Protect identically at −1.54**, because the only features firing were `accuracy`, `isStatus` and
`priorLogP`. There was no speed-control feature in the 53.

Written as **conditions, not flags** — the design point. A bare "this move is Tailwind" cannot help a
one-ply scorer, because the payoff is on later turns and this turn shows only a turn spent doing no
damage. What one ply *can* see is whether the condition that makes it worth doing is true now:

| feature | fires when | measured weight |
|---|---|---|
| `speedSwing` | it flips speed order **in my favour** — zero when I'm already faster | **+0.983** [0.933, 1.032] |
| `screenValue` | it halves incoming damage AND something is hitting hard, graded by **category** | **+1.128** [1.031, 1.225] |
| `healValue` | it heals me AND I'm hurt enough for it not to be wasted; zero at full HP | **+2.220** [2.004, 2.436] |

Every interval clears zero by a wide margin and `healValue` is among the largest weights in the
model. Fit: logL/decision **−1.7380**, top-1 **31.1%**, in-sample −1.7402 against held-out −1.7380.
Against the current bot: **+0.9192 logL/decision, +7.9 points of top-1**.

**This breaks the four-null pattern of 3.28.0**, and the reason is worth keeping: those four were
knowledge already implied by other features. These three are mechanics with *no representation at
all*.

### Choice lock — a wrong denominator, not a scoring error

Will: *"LIKE CHOICE MONS ONLY GET SWITCH OR ATTACK AFTER SELECTION THATS EASY."* Live play was never
wrong — `magnemite.js` takes candidates from the request, which marks the rest `disabled`. **Fitting
was**: `fit_policy.js` handed `candidates()` all four sheet moves with no legality filter, so a
choice-locked human appeared to have ~9 options when they had 4. A conditional logit divides by the
sum over the choice set, so five alternatives that were never available inflated the denominator.
**6.52% of items in this format.**

Turn one needs no turn counter: `switchIn` starts every arrival with `lastMove: ''`, so that field
already means "has this moved since it arrived."

**After the refit** (6,517 games, 156,118 decisions), six of eight switch features have intervals
clearing zero — `switchKOSlow` +0.238 [0.142, 0.333], `switchSurvives1` +0.186 [0.149, 0.223].
`magnemite.js` describes the previous ones as *"fitted out of noise, acted on 4.43 times a game."*
They are now measured. And crucially: **switches now win the argmax** — greedy play went from 222
switch events per 60 games (all forced post-KO) to 239, where before the refit `--switching` changed
*nothing*.

### Job 2 of ALAKAZAM: the opponent model

`incomingThreat` took a **max** — the foe's hardest available hit — and nine features are built on
it. Measured on a real board, the foe's lead clicks a damaging move **52.9%** of the time and MAG
assumed 100%, *and* assumed it was the nastiest. It needed no new model: `candidates` and
`featuresFor` already take `side`, so the same weights score the other side of the field.

The max is now an expectation weighted by `P(their action)`. Across 44 boards: `protectThreatened`
fell 84%, `diesBeforeMoving` 78%, `switchDiesFirst` 88%. **The bot stops panicking.**

**Off by default**, which makes it an A/B by construction. Recursion is bounded at one level by
design. **A refit is required before it ships**, because nine features now mean something different.

### The preflight gate — 24 games instead of 144,000

Two 1.5-hour training runs completed before anyone compared the outputs. The **switch weights were
bit-identical to the behaviour clone in both** — zero change, every decimal, over 288,000 games.
Cause: `train_policy.js` spawned the farm without `--switching`, and `mew.js` makes it opt-in, so
MAG could not switch in a single training game and that block's gradient was exactly zero.

`engine/preflight.js` runs 24 games and reports which feature **blocks** received no gradient.
Verified both directions, because a test that always fails is useless: without `--switching`, 0 live
/ 8 dead / |grad| 0.00; with it, 7 live / 1 dead / |grad| 10.73. **14 seconds against 1.5 hours.**
Registered as a gate — `train_policy.js` refuses to start and passes the farm the same flags the
preflight verified.

### `engine/type_coverage.js` — best coverage against this meta

Usage-weighted. **Offence:** Ground + Ice + Electric + Steel covers **85.7%** of the meta
super-effectively, verified exhaustively over all 3,060 four-type combinations. **Defence:** Fire
9.7% of incoming power, Fighting 8.6%; best typings Ghost/Steel 39.9%, Ghost/Water 31.4%,
Ghost/Grass 29.9% — all typings people actually run. **The split:** physical 52.0% / special 48.0%
incoming, but **65.8% of the meta is bulkier physically** — so defend against physical and attack
specially.

A bug caught by disbelieving a number: counting move *slots* made Fake Out (40 BP, most-used damaging
move at 1,918,410 weight) count the same as Hyper Beam, putting Normal top of "what hurts me" while
Normal is super-effective against nothing. Base-power weighting moved Normal 12.0% → 8.1%.

### A bug the 3.28.0 mega repair shipped

`merge_mega_into_engine.js` wrote `st` (level-50) and never `bs` (base stats). The 48 existing formes
kept theirs through `Object.assign`; the **19 it added had none** — and `buildMon` opens with
`if(!m||!m.bs) return null`, so those formes **could not be built by the damage engine at all.** The
commit that fixed that class of bug introduced another instance of it.

Found by accident: a new CHOMP script vendoring ABRA's dex counted 289 species where ABRA reports
308. `engine/artifact_audit.js` missed it because `bs` was not in its field list — the one field the
repair forgot was the one field nothing looked at. Now checked, with the list commented as the
audit's entire field of view.

---

## [3.28.0] — 2026-07-30

### The finding that should govern what gets built next

Four experiments added KNOWLEDGE to the feature vector. All four measured a null. Two experiments
changed how the policy is USED. Both were large wins:

| change | kind | result |
|---|---|---|
| taking the best move instead of sampling it | how it is used | **+12 points raw, 79.7% of decisive pairs** |
| self-play policy improvement over the clone | how it is used | **55.9%** |
| four separate feature additions | knowledge | four nulls |

The nulls were tested for the obvious confound and survived it: an overdispersion check across teams
gives ~1.00 where a known real effect gives 1.169, so the nulls are genuine rather than a real effect
hidden by team heterogeneity.

**The constraint is the OBJECTIVE, not the KNOWLEDGE.** Search is a change to how the policy is used,
which is the category that has actually paid, and it is now the ranked next build.

### A class of bug: the fact reached one consumer and not the next

Every integrity bug found on 2026-07-30 was one shape — a fact living in the artifact, correctly read
by one file, and never reaching the file that makes the decision.

- **Priority blocking.** Armor Tail, Queenly Majesty, Dazzling and Psychic Terrain sat in the tag
  artifact, read by `clickFragility` and by nothing else. **Sucker Punch beat a Farigiraf in every
  rollout and every self-play game ever run.** A blocked move FAILS; it does not go second.
- **The sheet's ITEM and ABILITY** reached `switchIn` and not `switchFeatures` — the path that
  chooses the switch. A Choice Scarf switch-in read at two thirds of its speed.
- **The sheet's MOVES** reached `dmgMon` and not `position_features`, so every Pokemon was valued on
  the dataset's average moveset rather than the one it declared.
- **Mega formes** were never applied under node at all.

### Switch-in abilities reach the path that CHOOSES

Measured before fixing, over 40,001 switch-in matchups, changing ONLY the declared sheet ability:

| declared | matchups where the vector moved |
|---|---|
| `levitate` (control, known-wired) | 2,754 |
| `intimidate` | **0** |
| `drizzle` | **0** |
| `drought` | **0** |

MAG weighed bringing Incineroar in against the foe's FULL Attack, and weighed a rain setter with the
Water damage it is about to enable left out.

Modelling the drop alone would have been **worse than modelling neither** (Will: *"does it also proc
defiant and competitive when it switches in"*) — Intimidate into Kingambit is not a free -1 Attack,
it is +2 Attack for them. A stat drop is a three-stage pipeline on the TARGET's ability and all three
now run: `onChangeBoost` (Contrary inverts, Simple doubles), `onTryBoost` (Clear Body deletes; Inner
Focus / Own Tempo / Scrappy block Intimidate BY NAME; Guard Dog converts to +1; Mirror Armor reflects
it back), `onAfterEachBoost` (Defiant +2 Atk, Competitive +2 SpA).

Derived by calling the dex's own handlers against a recording stub. No ability and no weather is
named in `board.js`. **After: intimidate 9,227 of 40,001, drizzle 3,463, drought 3,438.**

### Every mega had no ability, no moves and no item — 26.0% of the format

`data/mega-dex-official.json` carried an ability for all 340 formes and `merge_mega_into_engine.js`
existed to apply them, while `data/engine-data.js` had `ab: null`, `mv: []`, `item: null` on all 57
mega entries. The two files disagreed on how to spell a key (`venusaurmega` vs `venusaur-mega`), so
**zero of the builder's 67 writes ever matched**, and a later wholesale regeneration left the nulls.

**The empty `mv` was the expensive half.** `buildMon` returned a Pokemon with no moves, so
`incomingThreat` found no attack, scored `best = 0`, and reported **every mega as threatening
NOTHING** — `switchSurvives` read "survives" against all of them and `switchDiesFirst` could never
fire. No Contrary on Staraptor-Mega (428,748 usage), no Drought on Charizard-Mega-Y, no Swift Swim on
Swampert-Mega, no Huge Power on Mawile-Mega.

289 → 308 species, 75 mega formes complete, 0 duplicate keys.

### Post-KO replacement, and Run and Bun's conjunction

Replacement after a KO was a coin flip. It is now scored, per foe rather than collapsed into a max
(Will: *"score that for both pokemon against both other mons"*), with one rule covering every case:

    hits = (voluntary ? 1 : 0) + (slower ? 1 : 0)

So the SAME slow candidate reads as dying when the switch is voluntary and as surviving when it is a
forced replacement. Three new features — `switchKOFast`, `switchKOSlow`, `switchDiesFirst` — are
mutually exclusive per foe, with "survives and has no kill" left as the reference level.

### Clean-data discipline: 11 raw-store violations → 0

Not one problem. One was a **false positive** (`calibrate.py` reaches the store through a third clean
entry point the checker did not know); one is a **legitimate raw read** (`role_atlas.py` builds a
COVERAGE catalogue, where filtering shrinks the thing that must not shrink, now declared
`RAW-STORE-OK`); nine were genuine.

`predictability.py`'s answer moved materially once cleaned: at a 100–200 rating gap the higher-rated
player wins **53.8%** where Elo predicts 65.9%. In `flywheel.py` and `train_value.py` only the LADDER
half is filtered — self-play is clean by construction and quality.py would reject it for lacking
fields it was never going to have.

### JOLTEON: from worse-than-a-coin to predictive

Retrained on self-play rather than the contaminated ladder store. DITTO consumes its weights.

### Two rules added to CLAUDE.md

- **FEATURES ARE PER-MODEL. FACTS ARE GLOBAL.** The models answer differently-shaped questions and
  must not share a feature vector; they must never each own a FACT about the game. Enforced by
  `tests/test-engine-consistency.js`.
- **A DERIVED ARTIFACT IS NOT A FACT UNTIL SOMETHING COMPARES IT TO ITS SOURCE.** The mega hole was
  invisible for as long as nobody ran a check. Enforced by `engine/artifact_audit.js`, registered as
  a gate.

### Measurement tools that were themselves wrong

- **`paired_h2h` attributed wins by POLICY NAME** and reported **100.0%** on a valid experiment. Now
  attributed by `winnerArm`; it refuses (exit 2) when the arms are indistinguishable, and labels each
  arm with its own flags.
- **`mew_farm` ate the workers' capability accounting**, which meant a 117k-game measurement could
  not prove the lever under test was even on.
- **`artifact_audit.js` shipped with two false positives of its own**, both fixed before landing: it
  first cleared the broken builder by averaging over rows that builder skips, then cried wolf forever
  after the fix by comparing raw key spellings instead of asking whether the artifact holds
  duplicates.

### Also

- `engine/position_features.js` — 16 features for what a POSITION is worth, with the damage engine
  finally pointed at it.
- `engine/train_policy.js` — the self-play improvement loop, closing the clone→farm→refit cycle.
- `app/scoreboard.html` + `build/build_scoreboard.js` — scores computed in node by the real engine and
  shipped as data, so the page renders a decision as an argument rather than a number.
- PORYGON2 retrained on open-sheet greedy self-play: **a clean null** (63.8% vs 63.6%). The
  closed-sheet-training-set hypothesis is refuted, stated plainly.
- `PORYGON2_MAXTRAIN` (default 120,000, uniform subsample) after an OOM that asked for 34.7 GiB.

---

## [3.27.0] — 2026-07-28

### The GARBODOR guard had a false negative, and a CHOMP input was built on the raw store

`engine/selftest.js` checks that every file naming the ladder store either filters or declares why not,
and it looked for the string `load_games`. Three files **defined their own** `def load_games()` reading the
store line by line with no filter at all — so they satisfied the guard by naming a function:

- `engine/xatu_context.py` — builds `data/xatu-context-sets.json`, **which CHOMP consumes**
- `engine/xatu_belief.py`
- `engine/train_value.py`

A false negative is the one error this check must never make, and it produced exactly the outcome the
GARBODOR rule exists to prevent: a CHOMP input derived from a population that is ~87% bot games,
forfeits, partial brings and stubs, with the guard reporting no offence.

**This also corrects yesterday's correction.** On 2026-07-27 the offender count was taken from 17 to 12 by
recognising three files that only *mention* the path. That was right and incomplete — the same pass should
have found these three. **The true debt was 15.** Over-counting is noise; under-counting is a clean bill of
health for contaminated data, and it is the worse direction to be wrong in.

The guard is now structural rather than textual: a loader name counts as evidence of filtering only if the
file did not define that loader itself. Stripping the definition and re-testing was the first attempt and
does not work, because the file goes on to *call* its own loader.

### Regenerated on clean data — and CHOMP does not survive it

`engine/xatu_context.py` now reads through `engine/quality.py`. `data/pokemon-roles.json` was not unsafe —
`roles.py` has always filtered, so the handoff's claim was wrong for that file — but it was **stale**,
generated 2026-07-24 against 1,061 clean games. Both regenerated in dependency order (roles → context →
CHOMP-EV) against the current store: **2,653 usable of 20,387 collected.**

**Roles, on 2.5× the data.** Held-out log-loss `roles = 0.6975`, `rating = 0.6982`, coin = 0.6931, CI
(0.6908, 0.7036). The existing null result **holds up**: role-level winner prediction still ties a coin.
334 species tagged, 52 roles, 978 matchup cells, median n = 51.

**XATU context survives.** Cross-entropy 3.595 → 3.5624, improvement **+0.0324, CI (0.021, 0.0435)**,
which clears zero. Top-1 37.1% → 37.9%. A small real effect on clean data.

**CHOMP-EV, on 2,603 eval games with clean inputs and a working bootstrap:**

| model | held-out log-loss | 95% CI |
|---|---|---|
| naive usage prior — "bring your most-brought four" | **0.6919** | — |
| CHOMP alignment | 0.6925 | [0.6898, 0.6951] |
| CHOMP + XATU context | 0.6926 | [0.6903, 0.6949] |
| CHOMP + belief weighting | 0.6929 | [0.6904, 0.6955] |
| a coin | 0.6931 | — |
| Elo rating | 0.6938 | — |

Every CHOMP variant's interval contains the coin, and **the naive baseline is better than all three of
them.** Adding XATU context and belief weighting makes the score slightly *worse*, which is consistent
with the project's existing null result that better beliefs did not improve the bring decision.

The bring effect is essentially unchanged by cleaning: **0.5132 → 0.5134, CI [0.4944, 0.5319]**, still
containing 0.5. So cleaning the inputs neither rescued CHOMP nor explained away its weakness — it simply
confirmed it on 20% more games.

**Stated plainly, because it is the point of the exercise: CHOMP has no demonstrated edge over bringing
your four most-used Pokémon.** That is a null result, and it is reported here with the same prominence the
positive results get.

---

## [3.26.0] — 2026-07-27

### Every self-play record states its whole configuration, including the defaults

`engine/mew.js` wrote `randmove`, `greedy` and `switching` **only when they differed from their defaults**.
That overloads a missing field with two incompatible meanings — "the default was used" and "this run
predates the flag" — so `engine/paired_h2h.js` had to guess, and printed **"SWITCH SETTING NOT RECORDED
(run predates the flag)"** about runs created minutes earlier. It did so three times on 2026-07-27, on the
two runs that answered the popularity × greedy question. The provenance of a published experiment was
unrecoverable from its own records while the run was still warm.

Now written unconditionally, plus the weight-file paths — a run of `policy=score` says nothing about
*which* fit played it, and the two arms of a popularity 2×2 are distinguished by nothing else. Recording
only deviations requires the reader to know what the defaults were on the day, which is the hand-kept
knowledge S13 forbids.

### xorshift32 seeded with zero returns zero forever, in three files

`engine/brood.js`, `engine/exploit.js` and `engine/ladder.js` all did `let _s = SEED0 >>> 0`. xorshift32
has exactly one fixed point and it is 0 — every shift and xor of zero is zero. Measured from seed 0 over
200,000 draws: **mean 0.00000, one distinct value.**

Both `--seed 0` and a non-numeric `--seed abc` reach it, because `+arg(...)` yields 0 or NaN and
`NaN >>> 0` is 0. In `brood.js` the result is a hang, since `gauss()` spins on `while (!u) u = rnd()` —
that is the *good* case. In `ladder.js` and `exploit.js` every "random" choice silently becomes identical
and the run reports a result anyway. Guarded with `(SEED0 >>> 0) || 1`; seed 0 now gives mean 0.50013 and
50,000 distinct values over 50,000 draws.

These three were audited because the broken LCG in 3.25.0 raised the question of what else generates
randomness here. The xorshift itself is sound: `<<` and `^` coerce to int32 *before* operating, which is
exactly why it survives where the LCG's float64 multiply did not.

### Not affected, and worth stating

`engine/paired_h2h.js` uses **no random source at all** — it computes the Wilson score interval in closed
form. The paired head-to-head figures never touched the broken bootstrap.

### Measured: popularity helps winning too, so it was never dragging MAG down

The fourth cell of the popularity × greedy 2×2 and its matching control, both run identically — closed
sheets, greedy, paired, versus the random bot:

| arm | decisive pairs | 95% CI |
|---|---|---|
| **popularity in** + greedy | **93.2%** | [92.3, 94.1] |
| popularity out + greedy | 90.8% | [89.6, 91.8] |

Intervals do not overlap, so popularity is worth about **2.4 points of decisive pairs**, on top of the
2.2 points of human-click prediction from 3.23.0. The retracted claim had it backwards in both
directions. The earlier handoff cells (91.8%, 81.9%) were run on **open** sheets and are not comparable;
MAG's features read the sheet, which is why the control was re-run rather than the old figure reused.

---

## [3.25.0] — 2026-07-27

### RETRACTED: "CHOMP's bring direction is the winning direction". The bootstrap PRNG was broken.

Every confidence interval in `engine/chomp_ev.js` came from a clustered bootstrap driven by this:

```js
seedState = (seedState * 1103515245 + 12345) & 0x7fffffff
```

That recurrence is correct in C, where the arithmetic is 32-bit. JavaScript has no integers. A mid-range
state times 1103515245 is about 1.4e18, past `Number.MAX_SAFE_INTEGER` (9.0e15), so the product loses its
**low** bits to float rounding — and the low bits are exactly what the mask and `Math.floor(rnd() * n)`
consume. Measured over 200,000 draws:

| | measured | should be |
|---|---|---|
| mean | **0.4954** | 0.5 |
| chi-square, 10 bins | **159.5** (9 df) | < 16.9 at 5% |
| distinct values | **16,403** | ~200,000 |

χ² = 159.5 on 9 df rejects uniformity at p < 10⁻²⁸, and the generator cycles with a period around sixteen
thousand.

**What gave it away** was the shape of the headline interval: `p = 0.5129, ci95 [0.5021, 0.5395]` is
asymmetric by a factor of 2.5 around a proportion near 0.5, which a healthy bootstrap cannot produce at
n = 2,124. The Wilson interval is **[0.4916, 0.5341]** and it contains 0.5.

Swapped for mulberry32 (all arithmetic through `Math.imul` and `>>>`, so the state never leaves 32-bit
range; mean 0.49984, χ² 13.2, 199,989 distinct) and re-ran the file otherwise unchanged:

| | p | ci95 | verdict the file printed |
|---|---|---|---|
| broken | 0.5129 | [0.5021, 0.5395] | "CI clear of 0.5 — CHOMP's bring direction is the winning direction." |
| fixed | 0.5132 | **[0.493, 0.533]** | **"suggestive, not significant."** |

The verdict is gated on `signCI[0] > 0.5`, so **the broken generator is the only reason this project ever
claimed a significant CHOMP bring effect.** The correct branch was already written in the same ternary.

The same file's proper score behaves the same way: CHOMP-alignment log-loss **0.6923, CI [0.6905, 0.694]**
against a coin's ln 2 = 0.6931. The interval contains the coin, so CHOMP's win-probability model is not
distinguishable from a coin flip on this evidence. Every location quoting `CI [0.5021, 0.5395]` is now
wrong and is corrected in `docs/THESIS-DEFENCE-REVIEW-2026-07-27.md`.

`build/build_mew_bundle.js` carried the same recurrence for its reservoir sample. Lower stakes — it biases
which games land in a viewer bundle rather than publishing an interval — but fixed for the same reason.

**`tests/test-prng.js` (new)** — 7 checks. It lifts each generator out of its source rather than
re-typing it, then asserts mean, χ² uniformity across 10 bins, and distinct-value count against the short
period. A structural check refuses the constant outright, with comments stripped first so the two files
can keep *describing* the old bug without tripping it. Verified to fail on the pre-fix code (3 failures)
and pass on the fix. A bad PRNG is the ideal silent failure: plausible numbers, no exception, and the
output is a confidence interval — the one artifact a reader is least likely to re-derive.

### Measured: the full-bring filter's selection bias, which the filter file predicted but nobody sized

`data/quality-filter.json` states the limitation correctly and has all along: requiring all four brought
to be revealed "conditions on game length, so the filtered set skews toward longer games." Isolating that
rule — games passing every other rule, split on full bring:

| | n | mean turns | median |
|---|---|---|---|
| full bring (kept) | 2,245 | **8.4** | 8 |
| partial (dropped) | 487 | **5.8** | 6 |

Difference 2.6 turns, Welch **t = 23.5**. Across 84 species with ≥60 appearances, 15 differ at |z| > 1.96
between kept and dropped — against 4.2 expected by chance at that threshold, so there is a real aggregate
effect — but Bonferroni requires |z| > 3.43 and **the largest observed is 2.9, so no individual species
difference is established.** Fast offensive Pokémon skew to the dropped short games (Volcarona, Mimikyu,
Oranguru); bulk and support skew to the kept long ones (Incineroar 3.84% vs 2.89%, Grimmsnarl).

The magnitude is a lower bound: the dropped set has incomplete brings by construction, so it under-counts
species revealed late — the comparison is contaminated by the censoring it measures. A censoring-aware
estimator is required and does not exist.

### Also

The funnel in `data/quality-filter.json` records `store_size: 8356, clean: 1061` from 2026-07-25. Measured
now: **17,075 collected → 2,245 usable (13.1%)**. The store doubled; the clean share barely moved
(12.7% → 13.1%), so nothing downstream is wrong, but a hand-kept provenance record in the file whose
purpose is to be the single answer is out of date.

---

## [3.24.0] — 2026-07-27

### The set sampler draws whole observed sets, and the correction that existed was unreachable

`set_priors.fillSet` filled unrevealed move slots from P(move | species) independently, which cannot
represent a **slot**: Dire Claw and Gunk Shot are both perfectly normal Sneasler moves competing for one
place, so marginals paired them at roughly P(a)·P(b) and the bot brought a Sneasler holding both.

The interesting part is that a fix was already in the file and could not be reached. `sampleMoves()`
carries a measured co-occurrence lift built precisely to stop near-substitutes pairing up — but
`fillSet` consulted **Smogon's percentages first** and only fell through to `sampleMoves` when Smogon
returned nothing, which is rare. So for most species the correction was dead code and the sampler drew
raw marginals.

**What is used now.** An open team sheet *is* the joint distribution, observed directly, and this
project holds **37,903 complete four-move sets across 232 species** in `games.bo3.jsonl` and
`games.ots.jsonl`. The sampler had been using none of them. `observedSets()` loads them (clean games
only, corpus named by path); `observedDraw()` takes the sets containing every already-revealed move —
the exact conditional distribution — and falls back to maximum-overlap nearest neighbour rather than
silence, because returning nothing would send the rarest builds back to the sampler that gets them
wrong. Species with fewer than 8 observed sets still use the marginal paths, which is now the third
preference rather than the first.

**Measured, `engine/stab_audit.js`,** two-or-more same-type attacking moves per set:

| corpus | human | generated before | generated after | gap before | gap after |
|---|---|---|---|---|---|
| bo3 (12,619 sets) | 23.0% | 32.9% | **27.4%** | +9.9 [8.8, 11.0] | **+4.3 [3.3, 5.4]** |
| ots (25,284 sets) | 23.6% | 33.0% | **27.4%** | +9.4 [8.6, 10.2] | **+3.7 [3.0, 4.5]** |
| ladder (1,392 sets) | 28.5% | 35.1% | **30.0%** | +6.6 [3.1, 10.0] | **+1.4 [−1.9, 4.8]** — now noise |

Sneasler holding both Dire Claw and Gunk Shot: **3.3% of 300 draws → 0.0%**.

**The residual +4.3 is not claimed as fixed.** Roughly half the original gap remains, from species below
the 8-set floor and from partially-revealed sets that mix an observed draw with what was already on
them. Recorded as open in `docs/ARCHITECTURE-REVIEW-2026-07-27.md` §6.

### The GARBODOR count was overstated, because naming a path is not reading it

`engine/selftest.js` greps for the store filename anywhere in a file, so three files that never open it
were counted as unfiltered readers: `coach.js` names it in a `console.log` describing where a finished
game goes, `stamp.js` shows it in a usage docstring as the value a caller passes for `corpus:`, and
`mew_farm.js` resolves it **only to refuse to write output over it** — a safety guard counted as a
violation of the rule it protects.

The count matters because this check is deliberately left failing while offenders remain, so its number
is the project's measure of remaining debt. Stripping comments and strings before matching is the obvious
fix and is wrong: `readFileSync('data/games.ladder.jsonl')` puts the path inside a string, so it would
produce false negatives — the one error this check must never make. A separate `RAW-STORE-NOT-READ`
declaration is recognised instead, and it has to say what the path is for.

`reprocess.js` gets `RAW-STORE-OK` on its merits: it REBUILDS the store, so it must read the dirty
records too. `isClean` is an analysis filter, not a retention policy, and filtering there would silently
delete replays that can never be re-fetched.

**17 → 12 offenders**, and all 12 are real. Each is an analysis script that should filter, and each needs
its own verification that filtering does not change a published output, so none were touched here.

**`tests/test-set-realism.js` (new)** — 6 checks, threshold 6.0 points, chosen to sit between the
pre-fix +9.9 and the current +4.3 so it fails on the old sampler and passes with headroom on the new
one. Verified both ways: pre-fix **3 passed, 3 failed**; current **6 passed, 0 failed**. It asserts
direction as well as magnitude, so the sampler cannot be "fixed" into under-producing doubles instead;
it asserts the observed-set store is populated, because if that store ever empties the sampler silently
reverts to marginals with nothing failing; and it checks the named Sneasler case directly.

---

## [3.23.0] — 2026-07-27

### RETRACTED: "dropping popularity makes MAG predict human clicks better". The drop never applied.

`DROP=<feature>` in `engine/fit_policy.js` refits the model as if a feature did not exist, by zeroing
its column. `decisionsFor` builds a decision's features in **two** places — once for a voluntary
switch, once for a move — and only the move path zeroed it. Every switch row kept its real value.

The column was therefore not constant. It had become a proxy for *"this row is a switch"*, and the
optimiser fitted a confident coefficient to it: `priorLogP` came out at **−1.73, SE 0.05** in a fit
whose entire purpose was its absence, with the **opposite sign** to the full model's +0.16. Nothing
errored. The fit exited 0 and wrote a weight file.

Refitting with the drop actually applied reverses the published result:

| held-out top-1 human-click accuracy | value |
|---|---|
| full model (popularity in) | 30.9% |
| popularity dropped — as published (broken) | 35.3% — *better* |
| popularity dropped — drop actually applied | **28.7% — worse** |

So dropping popularity makes MAG **worse** at predicting human clicks, not better. The claim in
CHANGELOG 3.22.0 and in commit `baa6425` is withdrawn. Both weight files were refitted.

**Fixed:** both paths now go through one `featsFor()`. `assertDropped()` refuses to fit if any row
escaped — it checks the whole corpus, not a leading sample. `tests/test-drop-guard.js` (7 checks) has
a behavioural half and a structural half; the structural half counts `B.featuresFor(` call sites and
fails on the pre-fix code (2 sites) while passing on the fix (1).

### The set-sampler audit was reading the closed-sheet ladder store

`engine/stab_audit.js` called `Q.loadGames('ots')`. `loadGames` takes an **options object**, so the
string had no `.path`, `readStore` fell back to its default, and the audit read
`data/games.ladder.jsonl` — the CLOSED-sheet ladder. It printed "clean open-sheet games 2,245" while
its stated premise, *all four moves public, no revelation bias*, was false for **95%** of that sample:
only 116 of those 2,245 games (5.2%) carry a sheet at all.

Measured on the corpora that actually have sheets, the finding is **stronger** and now replicates
across two independent collections:

| corpus | clean games | sheeted | human sets | human | generated | gap | 95% CI |
|---|---|---|---|---|---|---|---|
| `games.bo3.jsonl` (ours, sheets forced) | 1,059 | 99.4% | 12,619 | 23.0% | 32.9% | **+9.9** | [8.8, 11.0] |
| `games.ots.jsonl` (external archive) | 2,114 | 100% | 25,284 | 23.6% | 33.0% | **+9.4** | [8.6, 10.2] |
| `games.ladder.jsonl` (what was measured) | 2,245 | 5.2% | 1,392 | 28.5% | 35.1% | +6.6 | [3.1, 10.0] |

The old headline was **+6.2 points from 1,392 sets**; it is **+9.4 to +9.9 points from 12,619–25,284
sets**, and the two corpora agree. The per-species list is entirely different — Scrafty +47.9, Metagross
+40.0, Annihilape +40.0, none of which appeared before — and **40 of 58** per-species gaps clear zero.
Every row now carries the interval on its own gap; the generated sample is matched to the observed one
instead of being a quarter its size.

`loadGames()` now throws on a non-object argument. There is no honest default: guessing which store a
caller meant is what produced this.

### The test suite ran 6 of 18 files, and the gate that catches silent wrongness ran never

`.github/workflows/tests.yml` named each test in its own step. It named **6** of the 18 files in
`tests/`, and did not run `engine/selftest.js`, `engine/conformance.js` or
`engine/validate_selfplay.js` at all.

`selftest.js` — whose own header calls it "the checks that catch silent wrongness" — **was failing the
whole time**: 17 files read the raw ladder store with neither a clean filter nor a `RAW-STORE-OK`
declaration. That is the GARBODOR rule, and the guard was left failing on purpose while nothing
observed it.

**`tests/run-all.js` (new)** derives the list: 21 checks discovered. It keeps three outcomes distinct
that the hand-written workflow blurred into two — passed, failed, and **never ran**. A skip prints its
reason and is not a pass. Exit code 2 means "could not run" so a gate whose corpus is gitignored stays
listed instead of being forgotten. It also warns about `engine/*.js` files that report their own
pass/fail summary and are run by nothing, which is how `validate_selfplay.js` was found.

### The MEW acceptance gate could not be aimed at the artifact it gates

`engine/validate_selfplay.js` hardcoded `STORE = data/games.selfplay.jsonl` and ignored `argv`, while
`mew_farm.js` ends every run by printing "VALIDATE BEFORE USE: node engine/validate_selfplay.js".
Pointed at a real 59 MB run it reported **"FAIL self-play store exists"** three times about a file
that was plainly there. The store is now an argument and the raw-log path is derived from it.

Two further defects in the same file, both found by running it:

- **It baselined "realism" against the raw ladder store** — 13,374 games, roughly seven in eight of
  them bot games, forfeits, partial brings or stubs. Measuring a corpus of bots against other people's
  bots and calling the difference realism is circular. Filtered through `quality.js`, the real-ladder
  mega rate is **98.3% on 1,725 clean games**, not the 92.9% this file's own header quotes.
- **A side-balance check fired on 8 games.** Its guard was `if (!N) continue`, which skips only an
  empty sample. Seven wins in eight gives a Wilson interval of [52.9, 97.8], which excludes 50, so it
  announced "the harness itself favours a side" — while the dedicated 300-battle mirror check in the
  same run said 53.3% [47.7, 58.9] and passed. It now needs 100 games and otherwise reports
  *inconclusive*, which is neither a pass nor a failure.

### The site's MAGNEMITE room scores a 21-feature model and presents it as MAG

`web/index.html` re-implements `featuresFor`. It assigns **21 of 47** features; the other 26 are never
written and sit at the zero the array was filled with. `data/mag.js` was also stale at 46 features,
missing `deadNoLastMove` — regenerated.

`tests/test-mag-page.js` passed this for weeks because a fixture position where the engine also scored
zero agrees perfectly. Two checks were strengthened: the fixture comparison now reports **how many**
features disagree (7 across 9 cases: accuracy, koTarget, dmgFrac, tgtMayProtect, movesFirst, priority,
volatileOnSelf) instead of printing one example; and a new structural check reads the page's own source
for `x[MAGIX.<name>]` assignments and requires one per bundled feature.

**Not fixed, deliberately.** The 26 missing features cannot be written into the page as it stands —
`data/mag.js` does not ship the fields they need, including no accuracy field on a bundled move at all.
Closing it means extending the bundle and porting the logic, or deriving the browser scorer from
`board.js` instead of re-implementing it, which is the S13-correct answer. The check fails loudly in
the meantime rather than reporting a subset as agreement.

### Measured: the store duplication story is half right

The three large doublings all occurred with `merge=union` **active** (added at ancestry depth 307,
removed at 417; the doublings sit at 329, 336 and 383). That much holds. But a fourth event — `009af26`
"store: dedupe after rebase (137 duplicate lines)" — sits at depth **625**, with no active union
attribute, 208 commits after the driver was removed. `.gitattributes` states that the driver "had to
go, or the duplication returns on the next divergence"; the driver went and a duplication returned
anyway. Recorded as a hypothesis with a known counter-example rather than as the cause. A fifth event
is visible at depth 14: a commit published a store of **0 lines** and nothing caught it.

Current store measures clean: **17,075 lines, 17,075 unique ids, 0 duplicates, 0 unparseable.**

### Also

`data/h2h-nopop-greedy.jsonl` quarantined to `data/quarantine/` and re-run clean: **4,823 pairs,
90.8% of 2,814 decisive pairs [89.6, 91.8]** to MAG. The retracted figure was 35.4%. `engine/
encore_test.js` moved to `tests/test-encore-gate.js`; it and `engine/stab_audit.js` both carried
absolute `C:/Users/willj/...` paths and a hardcoded `SHOWDOWN_PATH` default, so neither could ever have
run on CI or another machine. `stab_audit.js` also had a `Q.loadGames ? ... : []` fallback that would
have reported a clean "+0.0 points" difference computed from nothing.

---

## [3.22.0] — 2026-07-27

### Encore no longer fires into a fresh switch-in, and Prankster is why the first fix was wrong

A human playing the bot for ten minutes found what no automated check had: MAG was clicking Encore at
Pokémon that had just switched in, where it fails outright. The whole "this move cannot work right
now" family — `deadStatus`, `deadSide`, `deadField`, `deadWeather`, `deadStall` — was missing this
member. Added `GAME_RULES.needsTargetToHaveMoved` (Encore, Disable, Torment, Spite, Mimic, Instruct,
Mirror Move) and feature #47 `deadNoLastMove`. Encore is on **5.34%** of teams in this format. The fit
agreed hard: **−2.943**, 95% CI [−3.359, −2.528].

The first version was still wrong, and the user said why: *"especially if they have Prankster
Encore."* The fact is not "the target has no last move" but "the target has no last move **and I
resolve first**." A fresh switch-in is about to move; a **slower** Encore lands after it does, which
is the normal correct play. Only a faster one fails — and Prankster's +1 makes Whimsicott, Sableye
and Grimmsnarl fail *every* time. The ungated feature penalised the good play exactly as hard as the
bad one. Now gated on `movesFirst`, and moved to the bottom of `featuresFor` because move order is not
settled until Tailwind, Trick Room and priority have been applied.

### Measured: the set sampler invents move combinations humans do not play, and misses ones they do

Prompted by a generated Sneasler holding both Dire Claw and Gunk Shot. Against open team sheets
(all four moves public, no revelation bias) from 2,245 clean games: sets with two or more *attacking*
moves of one type are **28.5%** for humans and **34.7%** generated. The per-species split is the real
result — Incineroar 0.0% → 22.5%, Raichu 9.3% → 30.0%, but **Kingambit 98.9% → 71.0%**, because Sucker
Punch and Kowtow Cleave are both Dark and nearly every Kingambit runs both.

So this is not a case for a "no two same-type attacks" rule, which would be wrong 99% of the time for
Kingambit. It is `set_priors.fillSet` drawing each move **independently** from P(move | species) when
real sets are correlated within a role: two moves competing for one slot get paired at P(a)·P(b).
Not yet fixed — `engine/stab_audit.js` measures it and `docs/HANDOFF-2026-07-27.md` proposes drawing
whole observed sets instead.

### Retracted before it was ever reported: the no-popularity greedy experiment

The fourth cell of the popularity × greedy 2×2 returned "35.4% of decisive pairs against a bot that
clicks at random." Losing two-to-one to a monkey takes confidently bad play, and the cause was ours:
the weight file was fitted at 46 features, `board.js` went to 47 mid-run, and the run kept writing for
another seven minutes. Games before and after the edit were not playing the same model. Discarded.
**New rule: never edit `board.js` while a fit or a self-play run is in flight** — Node caches the
module at require time, so old and new feature vectors land in one output file with no error.

### Also

`engine/mag_bot.js` — the live-odds page drops the confidence trace graph (user asked; the team sheet
it might have shown is already available by hovering the sprites in Showdown). `engine/encore_test.js`
promoted from scratch. `fit_policy.js` flags documented: they are the environment variables `DROP=` and
`OUT_WEIGHTS=`, and passing `--drop`/`--out` is silently ignored — it did a plain refit and overwrote
the main weight file.

---

## [3.21.0] — 2026-07-26

### Every document has a PDF, and the list is derived

23 of 36 markdown documents had **no PDF at all** — including ARCHITECTURE.md, MODELS.md, BACKLOG.md
and THEORY.md, which are the four a new reader would reach for first. The cause was that the build
list was typed on the command line each release, so it only ever covered the six somebody remembered,
and the source-to-output mapping (`DEFENSE.md` → `ABRA-Defense.pdf`) was retyped every time — S13, in
the publishing step of a project whose discipline is that documents track the code.

**`build/build_pdfs.js` (new)** derives it: every `docs/*.md` gets `docs/<same name>.pdf`. Three
legacy output names are kept in one place because published links point at them; everything new
builds to its own name. `--check` reports stale or missing without building, so CI can fail on a
document that says something the project no longer believes.

35 built. Markdown stays as the source — it is what git can diff and what the PDFs are built from.

### `docs/ROADMAP.md` (new)

Written to one bar: **a claim is only on the completed list if it would survive twenty hours of
someone trying to break it.** Several items that would have been on it a week ago are not, for
failing to be true when re-run today.

What passed: the quality filter and behavioural bot detection; the damage engine at 31/31 against an
independent implementation; MAGNEMITE's out-of-sample improvement; the exploitability result and what
it proves about imitation; the open-sheet corpus check; hourly Bo3 collection; the derived ability
rules; and the self-auditing tooling.

What did not, and is now listed as such: MAG is exploitable and is a starting position rather than a
player; the ladder has produced no evidence; 28 artifacts are unsafe to quote; and eight models are
retracted, null, or without usable input — recorded by name so they are not quoted again.

The summary the roadmap ends on: *the project's most valuable output to date is not a model — it is
the ability to tell which of its own results are real, demonstrated by dissolving four of them in a
single day.*

---

## [3.20.0] — 2026-07-26

### Full-codebase conformance review: the standards are now executable

132 source files, 23,909 lines, checked against S1–S13. Report in
[`docs/CONFORMANCE-REVIEW-2026-07-26.md`](docs/CONFORMANCE-REVIEW-2026-07-26.md).

**`engine/conformance.js` (new)** encodes the standards as checks. They were good standards and
nothing enforced them — they were kept by whoever remembered, which over one evening produced a
hand-typed threshold inside a file arguing against hand-typed thresholds, a hardcoded list inside the
tool built to catch hardcoded lists, two models quoted without checking their data, and a Pokémon not
legal in the format. Each passed review by someone who had just written the rule it broke.

### S12 — one format id, thirteen copies

`champions_sim.js` declared it as a literal and eleven other files restated it. `regulations.json`
already held it and two ingesters already read it. **All thirteen now do; S12 findings 13 → 0.** On a
regulation rotation every copy would have kept describing a metagame that no longer exists, and
nothing would have noticed, because a stale format id produces plausible output rather than an error.

### Three dead files deleted, and the stale claim one of them was propping up

All three were swept in by the auto-commit watcher on 23 July. `display-maps.json` (19 KB) and
`real-sets.json` (10 KB) were referenced by **nothing**.

`nontransitivity.json` was worse: nothing generated or loaded it, yet **`docs/MODELS.md` cited it as
live fact — "the meta is rock-paper-scissors"**. It was computed two days before the quality filter
existed, so its cycles were measured over a corpus that is 87% bots. Re-run on clean data, the
equilibrium collapses to 100% on one option with zero gap to greedy, and the clean matrix has 0
decisive matchups. Withdrawn in `MODELS.md`, and the file **deleted rather than kept — a stale
artifact on disk is how a retracted claim gets quoted again**, which is precisely what happened to it.

### The checker was wrong three times before it was trusted, and once dangerously

- It called **`engine/bring_priors.js` dead**. The hourly workflow invokes it by name; acting on that
  **would have stopped data collection**. Files are also reached by workflows, scripts and documented
  commands.
- It called **`build/build_engine_data.js` dead**. It generates the file the entire site loads.
- It reported **13 hardcoded format ids when 3 were real** — the other ten were the format named in
  prose, explaining itself. It now strips comments before looking.

False positives were treated as more serious than gaps throughout: a report that cries wolf is one
people learn to scroll past, which is how the project reached this state.

### Still open, catalogued rather than claimed done

13 generated artifacts that do not say they are generated, one undeclared constant
(`Z_ALPHA = 1.959964` in `triggers.js`), 13 files without the project's standard header paragraph,
and one dead-code candidate (`chomp-predict.js`). All listed by `node engine/conformance.js`.

Full test suite green throughout: 9 JS suites, 6 Python suites, selftest at 24 passed / 1 failed —
the failure being the 18-file raw-reader tracker, which is the intended signal.

---

## [3.19.0] — 2026-07-26

### One shape for every model, and the audit graph is derived rather than typed

Directive: standardise across all models, no stale models, no hardcodes, only links.

**`engine/stamp.js` (new)** is the single provenance block every artifact carries. Until now each
model described itself differently or not at all — `n_games` in one file, `games` in another,
`corpus.games` in a third, and nothing whatsoever in `chomp-ev.json`, `move-priors.json` or
`bring-priors.json`. Four fields, the same everywhere:

| field | why |
|---|---|
| `corpus` | which file the data came from |
| `games` | how many, so it can be checked against what exists clean |
| `clean` | whether the quality filter ran — the single most important bit |
| `filter` | the filter version in force, so a later rule change is detectable |

The filter version is the modification time of `data/quality-filter.json`, not a number somebody
types, because a version number is a thing to forget to bump. `raw_store_ok` takes a **reason**, never
a boolean, and `stamp()` throws if given one.

### The checker was breaking the rule it exists to enforce

`provenance.js` carried a **hand-written list** of every artifact, its generator and its inputs —
exactly the hand-maintained state S13 forbids, inside the tool built to catch it. Such a list is
correct the day it is written and rots when anyone adds a model.

It is now **derived from the source**: a generator that writes `data/x.json` names it beside a write
call, one that reads `data/y.json` names it beside a read. Both are greppable facts about the code
rather than claims about it, so a new model joins the audit by existing.

The difference is the whole point: the typed list covered **15** artifacts. The derived graph finds
**60**, of which **28 are UNSAFE** and 15 possibly stale. **Three quarters of the pipeline was
outside the audit I had just written.**

A first attempt at the dependency edges matched any filename appearing anywhere in a generator, which
gave `xatu-context.json` seventeen inputs because they were named in comments. The name must now sit
within ~120 characters of an actual read.

### Standing state

`No generator makes the quality filter opt-in. Clean is the default everywhere.` — the audit's own
last line, now true.

**28 artifacts remain unsafe to quote.** They are listed by `node engine/provenance.js` and none of
them should appear in any result until regenerated. That is the honest size of the problem, and it
was not visible before tonight.

---

## [3.18.0] — 2026-07-26

### The lazy path is now the right path

Asked whether the bad games should simply be deleted so they cannot be used by accident. **No — and
the reason they keep getting used is structural, not a matter of discipline.**

**They carry real value, and four things need them:** the behavioural bot detector identifies bot
ACCOUNTS by watching them replay one team across many games, so deleting the games destroys the
ability to find the bots; ability mechanics derived from all 14,933 battles yield 14 rules against 11
from clean-only, because physics does not care who is at the keyboard; the scrape-bias correction
needs them to measure the bias; and every past filtering decision becomes permanent and unreviewable
without the raw data. It is also the project's governing rule — *store raw, analyse on top; changing
how we segment games is a re-filter, never a re-pull.*

**The actual defect was that the wrong answer was the easy one.** `engine/pory_nn.py` took `--clean`
as an OPT-IN flag, so a plain run trained on the raw archive — which is how `data/pory-nn.json` came
to declare **61,274 games** against a clean store of ~2,000, and how its numbers came to be quoted in
conversation as PORY's honest standing.

Four other models already had it the right way round: `guru.py`, `archetypes.py`, `counterplay.py`
and `nmf_roles.py` all filter by default and take `ABRA_UNFILTERED=1` to opt out. `pory_nn.py` now
matches them, and `engine/provenance.js` fails the build on any generator that makes the filter
opt-in — with an exception for a file carrying a `RAW-STORE-OK` declaration, the same convention
`selftest.js` already enforces.

### The one justified exception, verified rather than argued

`build/build_ability_blocks.js` keeps the raw archive as its default. The defence is that ability
rules are mechanics rather than behaviour, and it was checked rather than asserted: both were
computed and **every rule is identical**, while filtering loses Volt Absorb, Water Absorb and
Purifying Salt entirely. The declaration and the comparison are recorded in the file and in the
artifact, so a reader sees them without opening the generator.

**This holds only because the quantity is mechanical.** Nothing about how people play may be taken
from the raw archive on the same reasoning.

---

## [3.17.0] — 2026-07-26

### Every input audited before anything else gets built

Directive, and it is the right one: *do not wire up SLOWKING and PORY and XATU only to say afterwards
that the data was bad — make the inputs bulletproof first.* The SLOWKING withdrawal in 3.16.0 was
exactly that failure, and it was not a one-off.

`engine/provenance.js` checks every published artifact against four questions no file currently
answers about itself:

1. **Is it older than the quality filter?** Then it was computed under different rules about what
   counts as a usable game. This is precisely what invalidated SLOWKING.
2. **Is it older than its own inputs?** Then it describes a corpus that has since moved.
3. **Does it declare more games than exist clean?** Then it cannot have been filtered.
4. **Does it record a corpus at all?** A file that does not say what it was built from can never be
   checked by anyone.

### What the audit found

**Four artifacts are UNSAFE and must not be quoted:**

| artifact | why |
|---|---|
| `pory-nn.json` | its generator's filter is **opt-in** (`--clean`, default off) and the file does not record it was used; declares **61,274 games** against ~2,000 clean |
| `playstyle-matchups.json` | predates the quality filter; declares 3,310 games against ~2,000 clean |
| `slowking-playstyle-eval.json` | derived from the above, and also predates the filter |
| *(and `slowking-eval.json`, fixed in 3.16.0 by re-running it)* | |

**And I quoted one of them in this very conversation.** The comparison offered as "the honest state of
PORY" — that simply counting Pokemon and HP scores 0.638 against PORY's 0.674 — came from
`pory-nn.json`, which was trained without the filter switched on. **Withdrawn.** PORY's standing is
now unknown rather than weak; `pory-eval.json` itself (from `pory.py`, which does refuse the raw
store) is a separate and still-usable artifact.

**Eight more are possibly stale** — older than inputs that have since grown, or recording no game
count at all. `move-priors.json`, `bring-priors.json` and `chomp-ev.json` state no corpus, so nobody
can check them without re-running them.

### The checker's own false alarm, fixed before it shipped

The first version compared every artifact's game count against the **ladder** clean count and flagged
`policy-weights.json` as unsafe for declaring 2,723 games. It is fitted on the **open-sheet** corpus,
which is a different population with its own clean count. A checker that cries wolf is one people
learn to scroll past — the same argument this project already made about a diagnostic that fired
every run — so each artifact now declares which corpus its count should be judged against.

---

## [3.16.0] — 2026-07-26

### WITHDRAWN: "this metagame is rock-paper-scissors, so you must mix"

Quoted earlier tonight as the justification for building a mixed-strategy branch scorer, citing
SLOWKING's equilibrium — a 48/33/19 mixture and a named cycle through Charizard-Venusaur, Trick Room
and Incineroar-Sneasler. **Both came from a stale artifact computed on the UNFILTERED store.**

`data/slowking-eval.json` is dated **24 July** and reports **7,314 games over 8 archetypes**. GURU was
quality-filtered on **25 July**, one day later. The clean store has never held more than about 2,000
games, so 7,314 could only have come from the raw store — which is 87% bots, forfeits and stubs.

Re-run against the current clean matrix (1,124 games, 5 archetypes, **0 decisive matchups**):

| | stale, unfiltered | clean |
|---|---|---|
| equilibrium | 48% / 33% / 19% mixture | **100% on one option** |
| gap between mixing and picking the best | material | **zero** |
| cycle found | Charizard-Venusaur → Trick Room → Incineroar-Sneasler | **none** |

SLOWKING's own output now says it: *"this meta is close to transitive at this granularity, so mixing
buys little here."*

### But the honest reading is "no input", not "mixing does not help"

The clean matrix contains **0 decisive matchups** — every cell's interval spans a coin. A Nash
solution over a matrix of noise is meaningless in either direction, so this cannot distinguish
"mixing is unnecessary" from "there is nothing here to solve". **SLOWKING currently has no usable
input**, and that is the accurate statement.

### What still stands, and it is the thing that matters

The case for a mixed strategy does **not** depend on GURU at all. It rests on a direct measurement
made tonight: a challenger built only to counter MAG beat it **63.2%**, and beat MAG's predecessor
68.2% where MAG manages 60.2%. MAG is demonstrably readable. That is measured on fresh games and is
untouched by any of the above.

So: the *empirical* claim about this metagame being cyclic is withdrawn. The *specific* claim that
MAG is exploitable stands. Whether mixing at the TURN level helps is untested — a team-preview null
over five coarse buckets says nothing about it.

### The rule this violated

Quoting a model's output without checking what its inputs were built from. The stale file carried no
warning, was a day older than the filter that invalidated it, and was cited as evidence for an
architecture. Every published artifact should record the corpus it was computed on, and a consumer
should refuse one that predates the filter it depends on.

---

## [3.15.0] — 2026-07-26

### The ladder: optimise for winning, against an opponent that improves too — and it caught my own bad statistics

`engine/ladder.js` runs champion versus challenger: beat the champion and you become it, so the bar
rises every generation instead of staying frozen. That matters because hill-climbing against a fixed
opponent is the trap this project already fell into — MAG's 60% over the prior bot turned out to be
mostly punishing a flaw it had been built to punish.

**The first run produced a false promotion, and the round robin is what caught it.** A generation-3
champion was promoted for beating generation 2 at **56.1%** over 319 games, then scored **49%**
against the very same opponent when replayed on different seeds.

The cause was mine: the challenger is the **best of five probes**, so its measured win rate is the
maximum of several noisy draws and is optimistically biased. Testing that maximum with an ordinary
95% interval — as though it were a single pre-planned comparison — is not a valid test. It is the
same selection error the project already documented once in `build_lab`, committed again.

**Fixed: a winner must now win twice.** Once to be selected, then again in a confirmation match on
independent seeds against the same champion, and only the second interval counts.

### And the reassuring message was also wrong

The first run printed *"No cycle detected: every champion beats or ties all of its ancestors."* Every
single ancestor comparison had an interval spanning a coin — nothing was decided either way. The
honest statement is that the round robin **had no power at that sample size**, not that the ladder
is clean. It now says that instead, and only claims a clean result when at least one comparison was
actually decisive.

That distinction matters more here than usual: in a cyclic metagame a ladder can climb forever
without going anywhere, and "no cycle detected" is precisely the sentence that would hide it.

### Net result of the first run: nothing established

Two promotions, both unconfirmed, and a round robin that could not resolve anything. **No evidence
the ladder improved on MAG.** Reported as a null rather than as two generations of progress, which is
what the original output would have implied.

---

## [3.14.0] — 2026-07-26

### MAG is exploitable, and the thing that exploits it is simply a better player

The first exploitability measurement this project has ever run on in-battle play, and it answers the
question that has been open all evening: are we building something that plays okay, or something
that approaches solved. **Plays okay.**

`engine/exploit.js` hill-climbed a challenger over **MAG's own 17 features** — same machinery, only
different numbers — to maximise its win rate against MAG. Eighteen rounds, ~220 games each, about
forty minutes:

| | win rate | 95% CI |
|---|---|---|
| challenger vs **MAG** | 63.2% | [56.6, 69.3] |
| MAG vs the prior bot | 60.2% | [57.4, 63.0] |
| **challenger vs the prior bot** | **68.2%** | **[64.6, 71.6]** |

**MAG is more exploitable than it is strong.** A counter found by a crude search beats it by more
than it beat its own predecessor.

**And it is not a rock-paper-scissors counter — it is transitively better.** Played against the old
prior bot, the challenger wins 68.2% where MAG manages 60.2%, on non-overlapping intervals. It is not
exploiting MAG specifically; it is a straightforwardly stronger policy that MAG's fitting procedure
failed to find.

**Which number to trust.** The 63.2% is the maximum over eighteen searched candidates and is
therefore optimistically biased — it was selected on that opponent. The **68.2% against the prior bot
is an independent evaluation** the search never optimised against, and it is the solid one.

### Why the fitting missed it, and what the counter actually learned

MAG's weights were fitted to **predict a human's next click**. The challenger's were fitted to **win**.
Those are different objectives and they disagree, in an interpretable way:

| feature | MAG (imitates humans) | challenger (wins games) |
|---|---|---|
| never waste a move (`immune`) | −2.24 | **−9.11** |
| finish a weakened target (`tgtHurt`) | +0.34 | **+2.75** |
| hit a 4x weakness (`eff4`) | +1.31 | **+0.19** |
| hit a 2x weakness (`eff2`) | +0.96 | +0.09 |

The winning policy barely cares about type effectiveness and cares enormously about **not wasting a
turn and finishing what is already hurt**. That is a real hypothesis about the game — KOs win games,
chip damage does not — and it is the opposite of what humans visibly do.

**This is the clearest demonstration yet that imitation is a ceiling, not a target.** Everything
reported about MAG until today measured how well it predicts people. Optimising the same seventeen
features for *winning* instead found something clearly stronger in forty minutes.

`abilityBlock` fell to ~0 in the challenger, one release after being added. It may be genuinely
unhelpful for winning, or noise in an 18-round search; it is flagged, not concluded.

### What this changes

The imitation fit should stop being treated as the objective. It is a sane initialisation and it is
now demonstrably leaving strength on the table. The next step is the one that was always the plan:
generate games with MAG and optimise for the outcome rather than for resemblance.

---

## [3.13.0] — 2026-07-26

### Measured before building: humans do NOT choose their two moves independently

MAG decides each of its two Pokemon separately, blind to what its partner is doing. Before building
joint scoring, the question was whether the effect is real. It is, and it is large — over 18,575 real
turns where both Pokemon acted:

| joint effect | if chosen independently | what humans actually do |
|---|---|---|
| both aim a single-target attack at the **same** foe | ~50% | **23.4%** |
| both use Protect on the same turn | 1.66% of turns | **3.47% — 2.1x** |
| Follow Me / Rage Powder used, partner then attacks | — | **97%** |

**Aiming is the big one.** MAG picks each target separately, so it doubles into one foe about half the
time; humans do it under a quarter of the time. That is a measurable gap MAG fails today, and it is a
new realism metric with a clear target.

Redirection is the cleanest case there is: Follow Me is used to enable the partner and essentially
nothing else. A model that scores the two Pokemon separately cannot represent that at all.

### And the finding that contradicted my own prediction

I expected humans to **avoid** double Protect as wasteful. They do it **twice as often as chance**. It
is a real tactic — scouting, stalling a Trick Room or Tailwind out, ducking a predicted double-up.
Had this been hand-written as a rule, it would have been written as a penalty and it would have been
backwards. Another entry for the same ledger: the values must be learned.

### A third keying error, caught before it was published

The first version of this measurement keyed the two Pokemon on **resolution order** rather than on
their field slot. Protect has +4 priority so it almost always resolves first, which manufactured a
fake asymmetry — "slot A protects 22.2%, slot B 3.5%" — and inflated the double-Protect effect to
4.45x. Keyed on the actual slot, the two sides come out at 12.5% and 13.3% as they must, and the
effect is 2.1x.

That is the third time tonight a keying or denominator mistake invented an effect, after
switches-per-move and the Protect-chain counter. The rule is now in three changelog entries and was
still not applied before running the query.

---

## [3.12.0] — 2026-07-26

### Abilities that eat a move — derived from real battles, not typed

"Flash Fire is immune to Fire" is a **rule of the game**, not a judgement about value, so encoding it
costs nothing in ceiling — the same way a chess engine is told how a knight moves. That is the line
this project now works to: **encode what the game permits, learn what is valuable.** "Moving first is
good" stays out, because it is usually true and flatly wrong under Trick Room, and only data knows
the difference.

`build/build_ability_blocks.js` reads the rules out of **14,744 recorded battles** rather than typing
them, because a fact typed in July is a fact nobody re-checks in November. Probing Showdown's own
handlers with a stubbed battle context was tried first and **failed silently** — it reported Fake Out
getting through Armor Tail.

`engine/board.js` gains `abilityBlock`: the probability that the target's ability nullifies the move,
weighted by Smogon's per-species ability odds — so it never peeks at hidden information, it only
knows what the population knows. Fitted weight **−1.75, 95% CI [−1.96, −1.55]**. Held out:
**−1.5858**, from −1.5927.

### Three wrong rules caught on the way, all the same mistake

1. **Assuming the rule is about type.** The first derivation recorded the *types* of everything an
   ability stopped, which is right for Levitate and badly wrong for the rest: Armor Tail came out
   "blocks Dark/Normal/Flying/Fire/Grass/Fairy" — merely the types of priority moves people threw at
   it. Fixed by testing candidate rules (type, priority, status, sound, bullet, powder) and taking
   the one that explains the evidence most cleanly.
2. **Letting a broad rule win a tie.** Good as Gold blocks status moves; "priority or status" also
   explained 100% of what it stopped, being broader — and would have claimed Fake Out, which Good as
   Gold does not block. **Ties now go to the narrower rule**, breadth measured as how many moves in
   the format each rule matches.
3. **Over-claiming anyway, in the shipped version.** The priority rule counted *every* status move,
   so it told MAG that no status move ever lands on Farigiraf. Armor Tail blocks moves that go
   **early**, and a status move goes early only if its **user has Prankster** — so Whimsicott's
   Thunder Wave is refused and an ordinary Pokemon's is not. The rule now depends on the user and
   returns a probability. Measured: from Whimsicott 99%, from Incineroar 0%, and Fake Out 99%
   from anyone.

All three are the same error — generalising from what was observed into cases that were not — and
the third one shipped despite the first two being caught the same hour.

---

## [3.11.2] — 2026-07-26

### The Protect-chain measurement was wrong, and the "bot signature" reading of it was wrong twice

3.11.1 reported Protect chains up to nine long and treated a long chain as evidence of a failing bot.
Two corrections, both from the same objection: *a human would never click Protect nine times, it only
has 8 PP.*

**First: Protect has 5 base PP, 8 with PP Ups. A chain of nine is not something a bot does — it is
something my detector invented.** It keyed the chain on the field SLOT rather than on the Pokemon, so
when one fainted and its replacement used Protect, the counter carried on as if it were the same
Pokemon. Re-keyed on slot *and* species, and restricted to the moves the dex actually marks
`stallingMove` (Wide Guard and Quick Guard have 16 PP and different mechanics and should never have
been in the bucket):

| | share of moves | repeated immediately | longest chain, same Pokemon |
|---|---|---|---|
| humans, as published in 3.11.1 | 14.3% | 12.5% | 9 |
| **humans, corrected** | **13.8%** | **8.1%** | **8** |

Eight is exactly max PP. Nothing anomalous survives.

**Second: even a chain longer than eight would not be bot evidence.** A Leppa Berry restores PP, so a
Pokemon can Protect to empty, eat the berry and continue. The "impossible, therefore a bot" reading
was wrong on its own terms.

**The bot-side figures in 3.11.1 came from the same broken detector and are withdrawn**, not merely
adjusted — the prior bot's 42.8% and MAG's 21.5% must be re-measured before either is quoted again.
The qualitative point that the baseline over-Protects survives; the numbers do not.

This is the third time a denominator or keying mistake has manufactured a defect in this project,
after switches-per-move and the set-diversity artifact. The rule stands and was not applied here:
before believing any gap, check that both sides had the same opportunity to produce it — and check
what the counter is actually keyed on.

---

## [3.11.1] — 2026-07-26

### Withdrawn: "MAG wins 60% of the time" as a claim about competence

3.11.0 reported MAG beating the prior bot 60.2% and called it the first evidence the policy is
better at the game. The number is real. **The framing was not**, and the objection was exact: *do we
want MAG playing against the bot that clicks Protect eight times in a row?*

Measured, and the description was literally accurate:

| | Protect-family, share of moves | clicked Protect AGAIN straight after | longest chain |
|---|---|---|---|
| prior bot | 23.6% | **42.8%** | 8 |
| MAG | 16.7% | 21.5% | 8 |
| **real humans** | 14.3% | **12.5%** | 9 |

The baseline wastes roughly a quarter of its turns on Protect and follows one Protect with another
almost half the time. MAG has a fitted term for exactly that failure. **So a large part of that 60%
is MAG beating a self-inflicted flaw it was specifically built to punish** — which is close to
teaching to the test, and is not evidence of competence. The claim is withdrawn. What survives is
weaker and still worth having: reading the board is not *harmful*, which was not guaranteed.

**MAG is not competent by this measure either.** It still repeats Protect at nearly double the human
rate and still produces an eight-long chain.

### The finding that cuts the other way, and defends the whole design

**Humans chain Protect too — up to nine in a row, 12.5% of the time.** So a hand-written rule saying
"never Protect twice" would be *more* wrong than the fitted weight, not less. The defect was never
the behaviour; it was the **rate**. A rule cannot express a rate, and this is the concrete case for
why nothing in this model is typed: two hundred hand-written rules would beat the other bots and
would encode a ceiling equal to whoever wrote them.

### What a competent opponent actually means

The opponent should be **the policy's own previous version**, not a fixed weak bot — that is what
makes the bar rise as the policy improves, and it is the missing piece between where this is and
outcome-based learning. `--policy2` now makes that runnable; nothing yet runs it.

---

## [3.11.0] — 2026-07-26

### The head-to-head gate, and the first evidence MAG is actually BETTER rather than just more human

Backlog item 4, and it was overdue. Everything reported about MAG until now measured how well it
**predicts a human's next click**. That is a different question from whether it **wins**, and only the
second one is the goal. The distinction was raised directly and it was fair: a policy fitted to
imitate people can get better at imitating while getting no better at playing.

`engine/mew.js` gains `--policy2`, so two policies play each other. Sides **alternate every battle**,
because a challenger that always sat on p1 would score that seat's advantages as policy strength, and
the winner is recorded as a **policy** rather than a side.

**MAG against the prior bot it replaced, 1,176 decisive games:**

| | |
|---|---|
| MAG wins | 708 |
| prior bot wins | 468 |
| MAG win rate | **60.2%**, 95% CI [57.4, 63.0] |

The interval clears a coin comfortably. Balanced across seats — 61.4% on p1, 59.0% on p2 — so it is
not a side artifact. **This is the first result in the project showing the board-aware policy is
better at the game, not merely better at resembling people.**

### Withdrawn: the old self-play corpus as evidence for anything

Previous entries used the 199,524-game self-play corpus to argue that outcome-based learning needs a
strong starting policy, citing PORY's weakness on it. **That corpus is not usable evidence** — it was
generated before the mega option was passed to the players, so essentially no game in it contains a
mega evolution in a format built around megas, and the set generator of the time could put two
Protect-family moves on one set. PORY's weakness on it may be those defects rather than anything
about outcome learning. The argument is withdrawn; the head-to-head above does not depend on it.

---

## [3.10.0] — 2026-07-26

### Effectiveness is no longer forced to be linear, and spread moves now know they hit your partner

Both came out of a direct challenge to the fitted weights.

**"Should a 4x hit be the highest click?"** The old model could not answer, because it had assumed
the answer: a single `eff` term on Showdown's integer scale forces 4x to be worth **exactly twice**
2x by construction. Effectiveness is now one-hot — a separate fitted weight per bucket, expressed as
the fraction of targets hit in each, with a neutral hit as the reference level. Measured:

| bucket | pull |
|---|---|
| 4x weakness | **+1.27** |
| 2x weakness | +0.95 |
| resisted | −0.79 |
| resisted twice over | −1.12 |
| immune | **−2.24** |

So a 4x hit is the biggest positive pull available — but only **1.33x** the pull of a 2x hit, not
2x. The old linear model was overstating the 4x premium by half. Humans treat super-effective as
close to a threshold, which is unsurprising once you notice that both usually take the same number
of hits to matter. And the strongest single term in the whole model remains a **negative** one:
doing nothing at all.

**Sixteen moves hit your own partner** — `allAdjacent`, which includes Earthquake, Discharge, Lava
Plume, Sludge Wave and Explosion. They were lumped in with foe-only spreads (`allAdjacentFoes`) and
scored against the opponents ONLY, so clicking Earthquake beside your own Garchomp looked free. It is
not, and the fit can now price it.

**The first version of that feature returned a POSITIVE weight** — "humans like hitting their own
partner" — which is not a credible reading. It fired on any non-immune ally, so it was mostly
measuring "this is a strong, popular spread move". Narrowed to fire only when the partner does not
resist, it comes back at **+0.11, 95% CI [0.01, 0.21]**: still positive, barely distinguishable from
zero. **Reported as a null.** The honest reading is that real teams are built so the partner resists
whatever it stands next to, so there is little left to detect — not that the cost is unreal.

Held out by game: **−1.5927**, against −1.5953 for the linear model. A real but small gain.

### Also

The room gains a **partner slot**, without which the ally feature could not be demonstrated at all.
`web/index.html` scoring, `engine/selftest.js` and `tests/test-mag-page.js` all follow the new
feature list, and the drift guard caught the page still computing the old single `eff` term.

**Confirmed rather than assumed while checking a related claim:** Showdown separates the
one-at-a-time major statuses (`brn/par/tox/slp`, on `move.status`) from stackable volatiles (Encore,
Taunt, confusion, on `move.volatileStatus`), and `deadStatus` only ever reads the former. That parse
was already correct.

---

## [3.9.2] — 2026-07-26

### Correction: open team sheets do not show the stat spread

3.9.1 said a damage calculation "needs the target's spread, item and ability &mdash; which in a normal
game you do not know. In open team sheets you do." **The last part is wrong**, and it was pointed out
immediately.

Measured over **60,852 sheet entries** across both open-sheet corpora:

| on the sheet | not on the sheet |
|---|---|
| species, ability, nature, level &mdash; 100% | **stat spread &mdash; 0%** |
| item 99.8%, all four moves 99.9% | IVs 0%, Tera type 0% |

So an exact damage number is **not** available even with sheets open: how much a Pokemon invested in
a stat stays hidden either way. The claim overstated what open sheets buy.

What they do buy is real, though, and larger than it first looks. **Nature is revealed** &mdash; and
Smogon lists its spread statistics keyed by nature, so knowing it cuts the plausible spreads for a
species from about six to one or two. Item and ability, the two biggest multipliers in a damage
calculation, are known outright. So the open-sheet damage calculation is a **tight estimate**, not an
exact figure, and the page now says exactly that.

---

## [3.9.1] — 2026-07-26

### Weather Ball was being scored as a Normal move. It is Water under rain.

Reported from the site: *Weather Ball changes type with the weather, Pelipper sets rain, so it should
be super effective on Incineroar.* Correct, and the bug was in **`engine/board.js`**, not just the
page — `featuresFor` read `move.type`, which is the move's type **on paper**. Thirteen moves in this
format change type with the board, and Weather Ball is the one that matters: Pelipper sets rain on
switch-in with Drizzle, so a rain team's main attack was being scored as a Normal move that is
neutral on everything, when it is a Water move that is super effective on Incineroar and carries
STAB. Terrain Pulse has the same problem on terrain.

`moveType()` now resolves it by **calling Showdown's own `onModifyType` handler** with a stub of the
tracked board and asking what the type would be. The mapping is not written down anywhere — the
source of truth answers for itself, so a regulation that changes a move stays correct. Moves whose
handler needs context the stub cannot supply (Judgment, Techno Blast, Tera Blast — item, species and
Tera dependent) fall back to their base type, which is a stated gap rather than a solved problem.

Refitted on the corrected features: **58,281 decisions**, held-out top-1 33.3%, +6.4 points over the
behaviour clone. `build/build_mag_data.js` asks the handler once per trackable weather and ships the
answers, and the browser fixture now scores **under rain** so this specific bug cannot come back
unnoticed. It immediately caught two harnesses that were not reproducing the fixture's weather.

### The weights chart was plotting the wrong quantity

Asked directly: *is the direction all that matters, or the magnitude too?* Both matter — the score is
a sum, so a term twice as large moves the answer twice as far. But the chart was comparing **raw
weights**, and those are only comparable if the things they multiply share a scale. They do not: most
features are 0-or-1 flags, while `eff` runs about −4..+2 and `priorLogP` about −7.6..0.

So the chart now plots **weight × how much that feature actually varies**, measured across every
candidate in the corpus and shipped in `data/policy-weights.json`. That reorders it completely, and
**corrects a claim this changelog has been repeating**:

| by raw weight | by actual influence |
|---|---|
| `deadSide` −2.29 | **`eff` +0.47** |
| `deadField` −2.19 | `immune` −0.45 |
| `immune` −2.07 | `priorLogP` +0.33 |
| `eff` +0.80 | `deadSide` −0.20 |

Earlier entries said "the biggest learned effects are not about damage at all, they are the dead-move
terms". That is true **per occurrence** — a dead move is punished about five times harder than a
weakness is rewarded — and false **overall**, because dead moves are rare while effectiveness differs
on every board. Hitting a weakness is the single biggest driver of a real decision. Both statements
are now on the page, distinguished.

### The room, remade

The old-bot comparison panel is gone — it existed to prove the improvement once, that is recorded
here, and it does not need permanent screen space. In its place: the **actual score** for every
option in its own column, and any row opens to show the arithmetic that produced it, term by term.
The opening board changed from Pelipper into Garchomp + Incineroar — where Hurricane is neutral on
**both**, so it scored 17% and 17% and looked like a bot that was not aiming — to Garchomp into
Charizard + Kingambit, which puts immunity, aiming, super-effective and spread on screen at once.

"What I do not do" now says **why not yet** for each item, because none of them are impossible:
switching needs to know when a human could have switched and did not (open sheets give that);
a real damage calculation needs the target's spread, item and ability (open sheets give that too);
and reading a Protect is a search problem, which is ALAKAZAM's.

---

## [3.9.0] — 2026-07-26

### The scoring bot is now MAGNEMITE, and it has a room on the site

**MAGNEMITE — Move Appraisal Grounded iN Effectiveness, Matchup, Immunity and Timing Estimates.**
"MAG" in the nav. The name is thematically right: the model's single biggest win was **locking onto
the correct target**, which the old policy left to a coin flip. `engine/score_policy.js` →
`engine/magnemite.js`.

**A real room in `web/index.html`, not a separate page.** Set a board up — your active and its four
moves, the two Pokémon opposite, their HP, whether they are statused, whether Tailwind or Trick Room
is already up, whether you Protected last turn — and watch it choose, with MAG on the left and the
old popularity-only bot on the right. Every row carries the reason in plain words: *4× super
effective*, *does nothing — immune*, *already up*, *target is hurt*. Underneath, what it is weighing,
as bars.

The tab is **derived, not placed**. `build/build_status.js` gains a MAGNEMITE rule that reads
`data/policy-weights.json` and compares the fit to the behaviour clone it replaces, both held out by
game. It currently reports *"guesses a human's next click 33% of the time, 7 points better than
popularity alone"* and a status of **win**. A refit that loses to the clone relabels the room and
drops the tab into the PC on the next build, with nobody editing the page.

**Two implementations of one definition, and the guard against them drifting.** The room re-implements
`engine/board.js` `featuresFor` in browser JavaScript, because the engine runs in Node. That is
exactly the drift this project keeps paying for, so `build/build_mag_data.js` ships a fixture the
**real engine** scored inside `data/mag.js`; the room re-scores it on open and shows a red banner on
any disagreement; and `tests/test-mag-page.js` lifts the page's own scoring functions out of the HTML
and fails the build if they disagree. Nine assertions, including that the page aims a 4× move at the
right foe and that Tailwind loses value once Tailwind is up.

Nothing in the room is typed: weights, moves, species, the type chart and the popularity priors all
come from the generated bundle (500 moves, 357 species, 111 KB).

### Smogon's Bo3 open-team-sheet statistics were being downloaded and never opened

`engine/fetch_smogon_stats.js` has pulled `gen9championsvgc2026regmbbo3` at all four cutoffs since it
was written. `engine/smogon_priors.js` only ever read the closed-sheet format, so **every** prior in
the project — sets, spreads, items, abilities, the build space — described one metagame while the
policy work had moved to the other.

`node engine/smogon_priors.js --bo3` now builds `data/smogon-priors-bo3.json`, and the monthly
workflow builds both. Separate files on purpose: writing the open-sheet population over
`smogon-priors.json` would repoint every downstream prior at a different metagame with nothing to
notice it. First build confirms they are not the same population — **224 species against 283**.

---

## [3.8.0] — 2026-07-26

### We were not collecting the Bo3 open-team-sheet ladder. Now we are.

Asked directly: *does the pull grab the Bo3 open-team-sheet data too?* It did not. The capability was
fully wired and never switched on — `data/regulations.json` already names the format
(`gen9championsvgc2026regmbbo3`) and already says `"openTeamSheets": true`, `durable-ingest.js`
already honours an `INCLUDE_BO3` flag, and **nothing anywhere in the repo ever set it.**

Confirmed against the simulator's own format table, and the distinction turns out to matter:

| format | ruleset | consequence |
|---|---|---|
| `gen9championsvgc2026regmb` (main ladder) | `Open Team Sheets` | **optional** — both players must agree, which is why only 184 of 15,386 stored games carry sheets |
| `gen9championsvgc2026regmbbo3` | **`Force Open Team Sheets`** | **every game** publishes all six sets of both sides |

So the Bo3 ladder is a continuously-refreshing corpus in which the **choice set of every decision is
known** — the one thing `fit_policy.js` needs and the reason it had been fitted on an external
archive instead. It is also our own scrape of our own ladder.

- `ingest.yml` now pulls it hourly into **`data/games.bo3.jsonl`**, a **separate store**. Bo3 is a
  different information regime and a different metagame; pooling it into the ladder store would
  silently change every behavioural statistic in the project. The format id is read from
  `regulations.json`, so a regulation rotation carries it automatically.
- The reconcile loop preserves that store across its `git reset --hard` exactly as it does the ladder
  store. Omitting that would have discarded every Bo3 game on the first push race.
- `fit_policy.js` now reads all three open-sheet sources: **48,538 → 58,085 usable decisions.**

**A store nobody was deduplicating.** `data/games.bo3.jsonl` was being written by something on this
machine that is not in the repo, and survived only because `git add -A` swept it up. It held **595
duplicate lines out of 2,504** — the same append-only-under-git duplication that has hit the ladder
store twice. `dedupe_store.py` was hardcoded to one path; it now takes one, defaulting to the ladder
store so every existing caller is unchanged, and the workflow dedupes both.

### The fitted weights now ship confidence intervals — and that changed the answer

3.7.1 judged "did the covariate correction move the weights" against a **hand-typed 0.25**. That is
precisely the invented constant S12/S13 forbid, it was mine, and it was wrong: it reported the
weights as *stable* when they are not.

Conditional logit has the observed information in closed form, so every weight now carries a proper
standard error and the shift is measured in **standard errors** against the same z = 1.96 the project
uses for every Wilson interval. Judged properly, five weights move materially:

| feature | open-sheet fit | reweighted to closed | shift |
|---|---|---|---|
| `priorLogP` | +0.241 | +0.192 | **10.8 SE** |
| `bp` | −0.131 | +0.032 | 6.2 SE (sign flips) |
| `deadSide` | −2.293 | −1.928 | 3.4 SE |
| `stab` | +0.164 | +0.121 | 2.5 SE |
| `deadField` | −2.185 | −1.883 | 2.1 SE |

So the open-sheet objection has real teeth, and precisely where it should: the terms that move are
**popularity** and **base power**, not board-reading. `eff` (+0.800), `immune` (−2.073),
`deadStatus` and `deadStall` are unmoved. Reading the board transfers between the two metagames;
how much popularity is worth does not — which is unsurprising, since `priorLogP` is itself derived
from the closed ladder.

**The reweighted vector now ships**, because MEW draws its teams from the clean ladder store and the
bot therefore plays in the closed-sheet metagame. Both vectors are recorded in
`data/policy-weights.json` along with which one shipped and why.

Every weight is also printed with a 95% interval, and any interval containing zero is labelled as a
feature doing no measurable work — this project asks that of every other model and this one had been
shipping a bare vector.

---

## [3.7.1] — 2026-07-26

### The open-sheet corpus objection, measured instead of argued

Raised against 3.7.0: *open team sheet teams have different incentives than closed team sheet teams.*
Correct, and sharper than the caveat 3.7.0 recorded — that one said open-sheet players *hedge less*,
which is about play. The real point is that the **teams themselves** are built differently, because a
surprise set or a bluff item is worth nothing against someone who read your sheet before game one.
The corpus even ships with a warning saying so: *"Different information AND incentive regime … Do
not pool."* It was there and the fit used the corpus anyway.

**`engine/corpus_shift.js` (new)** measures it, applying the same code to both corpora so a
difference is the population and not the measurement. The objection is right, and large:

| | open-sheet | closed ladder |
|---|---|---|
| Garchomp on a team | 81.6% | 47.7% |
| Basculegion | 61.3% | 33.2% |
| Staraptor | 44.0% | 25.1% |
| Tyranitar | 7.4% | 21.2% |
| Sitrus Berry (share of items) | 8.4% | 17.5% |

**551.9 points of total absolute species difference across 109 species.** Not the same metagame.

But behaviour *given a board* — the only thing the policy learns — is nearly identical: super
effective 35.59% against 37.08%, resisted 15.06% against 15.04%, immune 1.00% against 0.97%, dead
moves 1.30% against 1.53%, status 33.89% against 34.09%, Protect 13.87% against 13.79%.

That split is what licenses the corpus. The model is **conditional** on the board and never learns
what to bring — MEW samples teams from the clean ladder store regardless — so the composition gap
changes which situations were sampled, not what was learned from them.

**Corrected rather than argued away.** `fit_policy.js` now re-estimates on a sample
importance-weighted to the closed-sheet species mix on **every run**, and reports whether the weights
move. They do not: largest change `deadStatus` by **0.222** on a weight of −1.374, with 47% of the
sample surviving reweighting (Kish effective sample size, reported so a correction that ate the
sample would be visible). If that ever stops holding, the run says so in words and the conclusion is
void.

### "Most games are bot games" — checked on this corpus specifically, and it is the cleaner one

`quality.js`'s bot detection was tuned on our own scrape, so running it over a corpus somebody else
assembled proves little by itself. `corpus_shift.js` applies the project's own **team-invariance**
signal to both, before and after filtering:

| corpus | accounts flagged | games touched | after filtering |
|---|---|---|---|
| open-sheet | 1 | 50 of 4,167 (1.2%) | 0 remain |
| closed ladder store | 7 | 1,980 of 14,878 (13.3%) | 0 remain |

The scraped open-sheet corpus is **less** bot-contaminated than our own ladder store, not more. But
the rule needs ≥50 games from one account to fire and only 6 of 2,149 open-sheet accounts play that
many, so this is a **floor on detection, not a clean bill of health** — the right phrase stays "no
bot detected", never "human".

### Move quality barely varies with rating, which is a finding about the metrics

Raised alongside: low-rated players make rule-ignorant plays — Prankster Taunt into Farigiraf, Fake
Out into Tsareena. Measured against the protocol on the clean closed store:

| rating | failed | immune | super effective | blocked action |
|---|---|---|---|---|
| under 1100 | 2.59% | 1.94% | 22.59% | 4.66% |
| 1100–1250 | 2.38% | 2.13% | 21.57% | 4.25% |
| 1250–1400 | 2.34% | 2.40% | 20.50% | 4.25% |
| 1400+ | 2.30% | 1.61% | 21.21% | 3.43% |

Blocked actions do fall with rating. Failed and immune moves are **flat**, and low-rated players hit
super effectively *slightly more often*. So the open-sheet corpus being ~185 rating points weaker is
less dangerous than it looks — but the sharper consequence is that **these realism metrics are not
skill metrics**. Matching a human failure rate makes the bot human-*like*, not good, and ALAKAZAM
eventually needs the second thing.

### A gap the feature set cannot represent, now named

The specific plays raised are real and present: **Armor Tail 52, Queenly Majesty 9** in the clean
closed store. **No feature in `board.js` can represent any of them** — `immune` is computed from
**types only**, so ability-based immunity (Levitate, Flash Fire, Storm Drain, Sap Sipper) and
priority-blocking abilities are invisible to the model. Recorded in `data/policy-weights.json` and
DEFENSE §6 as a known hole rather than fixed here; at ~0.2% of moves it is a small slice of the
remaining 3.87-point failed-move gap, and switching is the larger prize.

---

## [3.7.0] — 2026-07-26

### The scoring bot — a player that looks at the other side of the field

Backlog item 3, and the one everything else was waiting on. The behaviour clone answers a single
question — *what does this species usually click?* — and is blind to the board. That showed up as two
numbers no amount of prior-tuning could fix, and it made every `build_lab` result a measurement of
what beats **bad** play.

- **`engine/board.js` (new)** reconstructs the state a decision was made against, and turns
  (move, target) pairs into features. Every "this move cannot work right now" test reads a dex **data
  field** — `move.status`, `move.sideCondition`, `move.pseudoWeather`, `move.weather`,
  `move.stallingMove` — and compares it against tracked state. **No move is named anywhere in the
  file**, so a move added by a future regulation is handled without an edit (S13).
- **`engine/fit_policy.js` (new)** fits those features to what people actually clicked, by
  conditional logit over **2,240 clean open-sheet games and 48,538 decisions**.
- **`engine/score_policy.js` (new)** is the player. `engine/mew.js` gains `--policy score`.

**Why open team sheets.** A choice model needs the *choice set* — the moves that could have been
clicked. A normal replay only reveals moves that were **used**, so alternatives reconstructed from
revelation are biased by revelation itself. Open sheets publish all four moves of all six up front.
The caveat is recorded in the weight file: open-sheet play involves less hedging against unknown
sets, so the weights are learned on a slightly different game than the one they are played in.

**Held out by game** (decisions inside a game are correlated, so splitting by decision leaks):

| model | logL/decision | top-1 |
|---|---|---|
| uniform over candidates | −1.7627 | 24.1% |
| behaviour clone alone (the current bot) | −1.9302 | 27.1% |
| board-aware fit | **−1.6006** | **33.6%** |

In-sample −1.5997 against held-out −1.6006, so it is not memorising games; weights identical at 200,
300 and 500 iterations.

**Two findings worth stating on their own.** The behaviour clone alone scores **worse than picking
uniformly at random** (−1.93 against −1.76), and the fit puts only **+0.25** on it — it is saying the
clone is far too confident about the popular move. And the largest learned effects are not about
damage at all: they are the "this move is already dead" features, at −2.3 each. Reading the board
turns out to be mostly about **not clicking moves that cannot work**.

### Measured out of sample — 600 seed-matched battles per policy

The fit never consults the realism report; it is held back as the out-of-sample check, because it
stops being evidence the moment it becomes the objective.

| metric | prior (was) | score (now) | real |
|---|---|---|---|
| moves that were super effective | 9.71% | **14.91%** | 21.37% |
| moves that outright failed | 9.68% | **6.34%** | 2.47% |
| moves that hit an immune target | 4.30% | **2.92%** | 1.91% |
| moves that were Protect-type | 21.62% | **16.71%** | 13.87% |
| moves resisted | 14.78% | **9.92%** | 11.20% |
| turns per game | 11.57 | 10.70 | 8.35 |
| games containing a mega | 81.15% | 84.78% | 98.52% |
| usable games of 591 | 382 | **427** | — |

Both target gaps roughly halved. Immune moves and Protect spam fell without being targeted, and more
games survive the quality filter, so the games are less degenerate.

**Aiming is most of it.** `RandomPlayerAI` picks which foe to hit with `prng.random(2)` *before*
`chooseMove` is called, so the target was a coin flip no matter how good the move choice was — and in
doubles, aiming is most of what "super effective" means. 13,474 decisions in this batch chose a target.

**It samples, it does not take the best move.** A greedy bot sails past 23.4% super-effective and is
*less* human, not more. Same argument as DEFENSE §2: a corpus is closest to reality in distribution
when it is drawn from the distribution.

### Reported plainly: one metric moved the wrong way, and it is measurement

Distinct sets per species goes from 0.53 above real to **4.21 above**. This change does not touch set
generation at all, so the underlying diversity cannot have moved. The scoring bot uses more of its
moveset, so it **reveals** more: 2.00 moves per set against the prior policy's 1.90 and a real 1.70,
and distinct counts over partial views grow with revelation depth. This is exactly the confound
BACKLOG item 1 documents.

Switches per game barely moved (8.31 → 8.38 against a real 10.67) because the switch decision is
inherited untouched. Said because it is the next thing, not because this release quietly does it.

### Four silent failures found and fixed

- **Pokemon were being buried alive.** HP was tracked as cumulative damage and the store records no
  healing, so mons drifted to zero and left the field without ever fainting. **1,219 unmatched clicks
  were aimed at a foe the tracker had already retired.** Faints now come only from faint events.
- **Spread moves were scored as status moves.** Rock Slide, Heat Wave and Dazzling Gleam were treated
  as target-less, so their type effectiveness read as zero — a large share of all damage in doubles.
  Once corrected, `tgtHurt` flipped from −0.19 to **+0.31**: humans do finish weakened targets.
- **A locked two-turn move killed the battle.** The request omits `target` for a charging move, and
  defaulting the missing field to `normal` made the engine reject the choice outright.
- **MEW reported the new policy through the wrong counter**, printing "0.0% sampled" and "the policy
  sampled NOTHING — do not use this batch" over a run in which 100% of decisions were scored. A false
  alarm on that line is worse than none: it is the line that catches a genuinely dead policy. Team
  preview accounting also moved out of the prior-only branch, where it would have silently stopped
  being reported.

### `engine/selftest.js` grows a board-reading section

Six checks, all of failures that would otherwise look fine: the weight vector matching the feature
list it was fitted against (insert a feature without refitting and every later weight silently
applies to a different quantity), a refit that comes out worse than the policy it replaces, a damaged
Pokemon staying on the field, per-foe scoring, spread scoring, and a dead move expiring on its own
from the dex duration.

One of those checks was itself wrong on the first run: it asserted Rock Slide scores above zero
against Garchomp and Incineroar, whose effectiveness is −1 and +1 — an average of exactly zero. It
failed while the code was correct. Fixed by choosing two Rock-weak foes, and recorded here because it
is the same error class the file exists to catch: an expected value arrived at by assumption.

The clean-data check now recognises `quality.reasons()` as a genuine filter alongside `loadGames()` —
it is the entry point for a record judged on its own structure rather than by store id, and rejecting
it would have pushed a correctly-filtered file into declaring `RAW-STORE-OK`. Still RED on the same
**18** undeclared raw readers; that is the tracker, not a regression.

---

## [3.6.0] — 2026-07-26

### The build space is now derived from Smogon instead of typed by hand

`build_lab` split moves at a hand-written `LOCK_AT = 85`. That violated S12/S13 and was wrong in both
directions: it called Garchomp's Earthquake a free choice at 76.9% usage, and said nothing at all
about how much room was left once the four most common moves were fixed.

- **`engine/set_space.js` (new)** replaces the threshold with an identity. Smogon's move percentages
  are shares of sets and every set has four moves, so the listed percentages plus "Other" sum to 400.
  Therefore `freedom = (400 - sum of the top four) / 100` reads directly as *slots a real player
  changes*: Garchomp 0.71, Farigiraf 1.47, Kingambit 0.59. Across 259 species with 2,000+ teams the
  four most common moves account for **68% of every move slot played**.
- **Where a cutoff is genuinely needed there is an exact one.** Always-including a move that sits on
  a fraction `p` of sets matches reality on `p`; sampling it matches on `p² + (1-p)²`. The difference
  is `(2p-1)(1-p)`, so always-include wins **exactly when p > 1/2**. No tuning, no judgement.
- **The blind spot is now quantified and printed.** Smogon buckets rare moves as "Other" at 15–20%
  per species, so `1 - (1 - other/400)^4` ≈ **17% of real sets contain a move no prior of ours can
  propose** (median 17%, worst 19%; Kingambit 3%). This is a floor on set realism and had never been
  written down. Spreads are worse — Garchomp's spread "Other" is 38.4% against 19.8% for moves.

### `build_lab` runs a full factorial

One-factor-at-a-time cannot detect interactions, and factorial designs need fewer runs for the same
power. The design now crosses move-combinations × items × spreads.

**Confirmed on the first 240-battle smoke run:** Adamant beats Jolly by ~10 points **under Life Orb**
and does nothing **under Choice Scarf**. Neither sweep alone could have produced that sentence.

### Three bugs found by that run

- **`fillSet` ignored a caller-supplied spread** and re-sampled from the prior, so any experiment
  holding the spread fixed was not holding it fixed.
- **`build_lab` forwarded only moves/item/ability into `packTeam`**, dropping the spread entirely, so
  all three spread arms were the same team. The tell was win rates identical *to the decimal* across
  supposedly different arms — a genuinely varied factor cannot tie that exactly.
- **The results table never printed the spread**, which is how the above survived a full run looking
  like a tie rather than a defect.

### A previously reported cause was tested and disproven

BACKLOG item 1 claimed the set-diversity gap came from too thin a candidate pool. Measured: the
correlation between our pool size and the gap is **0.04** across 28 species — none. Every species has
~7.8 candidates, Rotom-Wash and Garchomp alike, and Rotom-Wash has no gap.

The measurable cause is **mode collapse**: we produce the single most common set **48%** of the time
against a real **44%**, concentrated exactly where the gap is — Toxapex +18 points, Whimsicott +15,
Garchomp +11, Kingambit **−2** (we are slightly *more* varied than reality).

### Documentation

- **`docs/METHODOLOGY.md` (new)** — every design choice with the literature behind it: common random
  numbers for paired comparison (Goldsman; Nelson & Matejcik 1995; Yang & Nelson 1991) including the
  negative-covariance failure mode; factorial versus OFAT (Czitrom; Box/Hunter/Hunter); self-play
  overfitting and league training (AlphaStar; Minimax Exploiter; NeurIPS 2023); Benjamini–Hochberg.

---

### Mega rate 74% -> 80%, and three ruled-out causes

The preview draw now knows about mega stones. `bring_priors.js` measures two numbers from real
protocol logs — **77.5%** of real sides mega at all, **57.7%** of megas are one of the two leads —
and `chooseTeamPreview` aims at both. On 300 seed-matched games with identical teams, only the
preview policy changed: **71.6% -> 80.1%** of games contain a mega, 0.96 -> 1.07 megas per game.

The species priors could not express this, because "Charizard" and "Charizard holding Charizardite Y"
are the same key and different decisions.

**The previously stated cause was wrong.** BACKLOG said "real players bring their mega". Smogon's raw
counts against real counts say a mega forme is brought **0.90x** as often as a non-mega. Ruled out by
measurement, not argument:

- **team generation** — 1.54 stones per packed team against the 1.58 Smogon implies; stones match
  their holder 99.6% of the time
- **the form-change probability** — 0.85 to 1.0 moved the rate 0.7 points. Now a `--mega` flag so the
  claim can be re-checked
- **Terastallization stealing the roll** — `RandomPlayerAI` checks tera before mega, but Champions has
  no tera at all: measured 0.00 per game

The cause was the **lead**, not the bring.

**Residual, unfixed:** 80% against 93%, 1.07 against 1.58 megas per game. Form-change 1.0 on top of
the fix gives 80.5%, so that is saturated. Most likely a back-slot holder still reaches the field less
often than a human's, consistent with 4.3 switches per game against 5.7 — downstream of the scoring bot.

---

### Adversarial review, and an engine selftest

`docs/REVIEW-2026-07-26.md` — two passes at v3.6.0, statistical and engineering, every finding
grounded in a measurement or a line of code. **Three of the defects it found were in the measurement
apparatus rather than the model**, and one of those reverses the project's top backlog item.

- **Set diversity is CLOSED — the gap never existed.** `realism_report` capped the generated corpus
  with `--limit` but read the real one in full, and distinct-counts grow with n mechanically. Compared
  at matched n across 76 shared species: **13.2 distinct sets per species for us against 11.3 real.**
  We are slightly *more* varied than the ladder. It had been reported as a defect three times.
- **`build_lab` compared each arm to a field mean containing that arm**, shrinking every effect by
  exactly `(m-1)/m` — 17% at m=6, 1.2% at m=84, so it hid in the small runs people iterate on.
- **The factorial took a nested prefix when subsampled**, freezing the move axis and confounding
  factors with loop position. Now stride-walked, coprime to the cell count.
- **`--conc` does nothing** — 14.9 / 14.4 / 14.3 games/sec at conc 1 / 4 / 12. The simulator is
  CPU-bound and single-threaded; the 46 games/sec figure is a 12-**process** number and no tool here
  fans out. `set_space` now prints both, so the top-14 factorial is honestly ~39 hours as shipped.

**`engine/selftest.js` (new)** — 17 assertions on the parts that fail silently, no Showdown checkout
needed. It found a bug on its first run: an unlisted forme resolved to nothing and produced an
**empty moveset**, so the Pokémon plays Struggle all game and nothing is raised. `forSpecies` and
`resolveSpecies` now strip trailing hyphenated qualifiers progressively — a rule that covers formes
nobody has thought of yet, replacing a hand-kept list that was itself an S13 violation and had
already failed three times.

**Known and NOT fixed:** every `build_lab` win rate is still conditioned on a pilot that does not read
the board (super-effective 10.8% against 23.3%, failed moves 8.6% against 2.7%, games 10.1 turns
against 6.3). That makes every current build result provisional, and it is why the scoring bot is
the top of the backlog. `build_lab` also tests one host team against 40 opponents without saying so.

---

## [3.5.0] — 2026-07-26

### The self-play corpus was not modelling this format

Four independent defects, none of which errored, combined to leave 199,524 self-play games with
essentially **no mega evolutions** — in a format where **93% of real ladder games contain one**.

- **The player was never told it could mega.** `RandomPlayerAI` defaults `mega` to 0 and
  `engine/mew.js` never passed the option. Now passed as a per-decision probability.
- **The teams had no stones.** `fillSet` consulted Smogon's *base-forme* item list first, which
  contains no stones at all. Our own parse of real Champions replays does. Our measurement now wins.
- **Every Tyranitar held a stone.** `gearPriors` kept only the mode, turning a choice into a species
  trait. The full distribution is kept and sampled.
- **Megas used base-forme moves.** Mega Dragonite is special, ordinary Dragonite is physical, and 26
  mega formes had their own priors sitting unused. Unrevealed slots now re-drawn from the mega forme.

Result: **54.7% of self-play games contain a mega**, from ~0%.

### Smogon's statistics adopted, after verifying the methodology

We had been deriving from ~1,700 clean replays what Smogon publishes from **1,163,315 battles**.
Before relying on it, the key claim was checked: does Smogon know a Pokémon held a mega stone even
when it died without revealing it? **Yes — verified three ways.**

- **Raw counts sum to exactly 12.00 per battle** (13,959,780 ÷ 1,163,315). A VGC battle has 12
  Pokémon across the two teams, so every team slot is counted, brought or not. The `Real` column is
  5.49 per battle — that one is appearances.
- **They publish EV spreads**, which are never revealed in battle and can only come from team data.
- **Base-forme Charizard's item list contains zero mega stones.** Reveal-derived data would show
  stone-holders that died in the base entry. None appear.

Now parsed and available: **mega formes as separate species** (`megaInfo()`), **Checks and
Counters** with 95% intervals, **full teammates** (was truncated to 10), **viability ceiling**.

Stone-holding rates, weighted usage, 2026-06 cutoff 1630: Charizard 99.3% (Y 96.1% / X 3.2%),
Swampert 98.0%, Metagross 96.0%, Raichu 88.3%, Staraptor 81.7%, Tyranitar 66.0%, Aerodactyl 58.3%,
Venusaur 55.5%.

**Retracted from earlier the same session:** the claim that Smogon's non-mega share was inflated by
Pokémon that carried a stone and died before using it. It is not — those are counted under the mega
forme. The base entries are genuinely stone-less builds.

### The bots do not know the type chart

Measured, bots vs humans: hit something **immune** 4.3% vs 2.2%; **super effective** 9.9% vs
**23.4%**; **outright failed** 10.3% vs 2.7%. Super-effective-to-immune ratio 2.3:1 against humans'
10.7:1 — one bot move in twenty-three does literally nothing.

### Also

- **Redundant protection moves.** Sets held both Protect and Detect (1.1% of protection users across
  40,000 games). Redundant families now capped at one member per set, in both draw paths; 0 of 4,800
  after.
- **Mega timing confirmed.** Of 16,631 mega events in real games, **zero** occurred on the mon's
  switch-in turn — switching is that turn's action. 1.88% of switch-ins faint before acting.
- **Seed base wrapped every 2.78 hours** (`Date.now() % 1e7`), regenerating identical battles under
  fresh ids. Fixed, plus a guard against the engine's 28-bit seed ceiling. Adjacent seeds were
  checked and are *not* correlated.
- **Site numbers generated, not typed** (S13): dataset counts, team count, matchups and turns-per-game
  now derive from `data/live.js`, each tile showing its own arithmetic. Turns-per-game had been
  computed over all 12,872 collected games beside a tile using clean games only — corrected to 8.3.
- **MEW's replay viewer replaced** with Pokémon Showdown's own player. MEW stores the exact Showdown
  protocol, so it reads our games with no conversion; the hand-written viewer is deleted.

### Superseded

The 199,524-game corpus is **obsolete** — every game was played with no megas, wrong items, and mega
Pokémon using base-forme moves. Mechanically valid, but not this format. Regenerate before analysis.

Full write-up: `docs/FINDINGS-2026-07-26.md`.

## [3.4.0] — 2026-07-25

### Fixed — six defects in MEW, every one found by testing the chain before the first large run

The self-play engine had been built, validated and benchmarked, and was about to generate a corpus.
Testing it end to end first — from team construction through to the file PORY actually reads — found
six faults. Four of them produce data that looks completely normal and is quietly wrong, which is the
only kind of bug that matters for a training corpus. Recorded in the order they would have done
damage.

**1. Four in five self-play teams were illegal.** `BattleStream` does not run the team validator; it
plays whatever it is handed. Showdown's own `TeamValidator` rejected **80.5% of the pool (161/200
teams)**. The dominant cause was Item Clause — VGC permits one of each item per team, the set sampler
drew items independently per species, and **66 teams carried two Focus Sashes**. Every such game was
played with a team no human could bring, and nothing anywhere reported a problem.

`packTeam` now enforces Item Clause during packing (resampling from the species' own measured item
distribution rather than blanking the item, which would have biased the corpus toward itemless
Pokemon), then validates and repairs, and MEW discards anything still invalid instead of recording
it. **100% valid**, at a measured 9.6% throughput cost — 4.30 ms/team with the validator cached, and
constructing it per call rather than once accounted for 6.5 ms of the original 7.7.

The hand-rolled learnset check written first was itself wrong — 40 false positives on cosmetic formes
(Sinistcha-Masterpiece does learn Matcha Gotcha). Asking the official validator is both correct and
less code. S12 applies to legality rules as much as to constants.

**2. Illegal abilities, 0.4% of packed sets.** Meowstic with Intimidate, Snorlax with No Guard,
Gardevoir with Good as Gold. Abilities were sampled from observed sets keyed by species name and
never checked against the species. Intimidate alone shifts every physical damage roll against that
side, so these silently corrupted the battles they appeared in. Now clamped to the species' legal set
and **reported in `filled`** — a silent correction would hide the ingest fault that produced it.

**3. Matchup coverage was 0.15%.** Both teams were drawn as linear functions of the same seed:

    const a = teams[(seed * 2654435761) % teams.length];
    const b = teams[(seed * 40503 + 17) % teams.length];

Two linear maps of one counter do not explore a 2-D space, they walk a 1-D lattice through it.
Measured over 1,000,000 sequential seeds on a 1,326-team pool: **1,325 distinct matchups of 879,801
possible, each replayed ~755 times**, and zero mirror matches despite a comment asserting they
occurred. Independent random draws would have reached 68%.

Matchups are now **enumerated** over the triangular index of unordered pairs, verified bijective at
T=5, 50 and 1,326 (879,801 pairs, every one exactly once, zero malformed). The walk order is
scrambled by a stride coprime to the total, so coverage stays exactly-once while any **prefix** of an
interrupted run remains spread across the whole pool rather than being one team's matchups.

**4. Team preview was a constant.** `RandomPlayerAI.chooseTeamPreview` returns the literal `'default'`
— bring slots 1-4, lead 1-2 — and `PriorPlayerAI` did not override it. Every game with a given team
therefore made the identical preview decision: **1 of C(6,4) x C(4,2) = 90 choices per side**,
forever. Team selection is a large share of VGC skill and it was a fixed constant.

It is now sampled from measured ladder behaviour (`engine/bring_priors.js`: P(brought | on team) and
P(lead | brought), shrunk by 10 pseudo-observations). Uniform sampling over all 90 was rejected
deliberately — most brings are ones no player would make, and the corpus would fill with positions
that never occur. The lead rankings have face validity: Grimmsnarl 84%, Talonflame 82%, Whimsicott
77%, which are the format's actual screens and Tailwind leads. `p_lead` is measured from turn-1 leads
and is unbiased; `p_bring` comes from REVEALED species and is biased down, so it is a ranking rather
than a calibrated rate.

A consequence worth stating plainly: the 40–92% spread in per-species bring rates reported earlier in
this session was **positional artifact of the constant `default` bring**, not preference. It is
retracted.

**5. Battles were not replayable.** `>start {seed}` seeds the battle's dice; it does nothing for the
players, whose PRNG defaulted to a fresh random seed, and two draws in the policy used
`Math.random()`. A recorded seed therefore reproduced the damage rolls but not the decisions, and the
game diverged at the first choice. Any claim of the form "this switch is what won the game" was
unfalsifiable. Both players are now seeded from the battle seed via `PRNG.get`, and every sampling
draw uses the player's own PRNG. **Verified: 25/25 games byte-identical across separate runs** once
the `|t:|` wall-clock line is excluded.

**6. Writes were not durable, and the claim that they were is retracted.** The record and log streams
were `createWriteStream(..., {flags:'a'})`, described in a comment as keeping everything already
flushed if a run were killed. That was false. Observed directly: during a 12-worker run **every shard
sat at exactly 0 bytes for fifteen minutes** while each worker held ~500 MB resident. Records are
~5 KB, workers out-produce the disk, and Node answers backpressure by queueing in memory — nothing
reaches disk until the stream closes at process exit.

Three consequences: a killed worker lost **all** of its games rather than the last few; memory grew
in proportion to games generated (~170 MB queued per worker at 16,667 games); and progress was
invisible, which is how a **healthy 200,000-game run was mistaken for a hung one and killed at 15
minutes**, when each worker needed ~1.7 hours. Batched `appendFileSync` (50 records) bounds memory
and lands data continuously — verified at 7 MB / 21 MB / 31 MB on disk at t=20/40/60s of a live run.

### Fixed — the JS/Python parity test was verifying nothing

`tests/test-quality.js` probed `python3`, `python`, `py -3` and skipped with exit 2 when none worked.
On Windows all three resolve to the **Microsoft Store alias stub**, which prints "Python was not
found" and exits 9009 — while a working Python 3.12.10 sits in `%LOCALAPPDATA%\Programs\Python`. The
test that guarantees the two quality filters select identical games had therefore been skipping on
the development machine, reporting success while checking nothing.

`engine/python.js` (new) resolves a real interpreter by **executing** each candidate and requiring it
to echo a token — a name resolving on PATH proves nothing — and additionally searches the standard
install roots. The probe had been duplicated in `server.js` and the test and had drifted; it is now
one reader (S12). The parity check now runs: **27 passed**.

### Added

- `engine/bring_priors.js` — measured bring/lead propensities from clean ladder games.
- `engine/state_encoder.py` — a rich per-turn state encoding (121 features): HP per slot, active vs
  benched, status, boosts, weather/terrain/Trick Room/Tailwind/screens, hazards, active types. Both
  perspectives are emitted with sides swapped, because antisymmetry in the two players is a property
  of the game and a model trained on p1's view alone will not respect it.
- `engine/pory_nn.py` — the network-versus-baselines comparison, eight arms on one split.
- `engine/python.js`, `build/serve.js`.

### Changed

- `engine/mew_farm.js` — **`--conc` now defaults to 1, not 4.** The prior default cost 4x. Measured on
  8 physical / 16 logical cores: 8 procs at conc 4 gave 11 games/sec, the same 8 procs at conc 1 gave
  38. The simulator is synchronous and CPU-bound, so in-process concurrency never overlaps real work —
  it holds N battles live at once and multiplies GC pressure. 12 procs / conc 1 reproduced at 44–46.
  Two earlier throughput figures in this file are retracted: a projection of 131 games/sec
  (extrapolated from one process, never measured) and a claim that scaling collapses past 4 processes
  (measured, but every row carried the bad `--conc`, so a config artifact was written up as a hardware
  limit). Run-to-run variance is large — 8/conc-1 measured 37.8 and 15.1 on identical config — so
  single microbenchmarks here are worth ±2x.
- `engine/mew_farm.js` — merges the raw-log shards. It previously deleted the entire shard directory
  at merge, **destroying every protocol log a distributed run produced** at the moment it succeeded.
  Single-process runs kept them; the farm silently did not.
- `engine/mew.js` — writes a `.raw-logs.jsonl` sidecar in the ladder's own `{id, uploadtime, log}`
  schema. MEW captured the full omniscient log, passed it to `extract()`, and discarded it; but
  `extract()` produces game-level summaries and every value model reconstructs board states from the
  **protocol log**. A million games in the old format would have been unreadable by the model they
  exist to train.

---

## [3.3.0] — 2026-07-25

### Added — Smogon's official statistics, archived monthly, and what they immediately corrected

ABRA's ladder collection began 2026-07-22. Reg M-B started mid-June, so five weeks of the regulation
are missing and are **not recoverable**: Showdown's replay search exposes only a recent window, and
although an old replay still resolves by id, the ids are not discoverable — an archived sample of 324
Reg M-B games spans 1.9M sequential ids, because Showdown numbers across every format at once. Data
not captured at the time is gone.

Smogon has been computing statistics over the **whole ladder** throughout and publishes them monthly.
`engine/fetch_smogon_stats.js` archives them and `.github/workflows/smogon-stats.yml` runs it on the
4th and 11th of each month — in CI rather than on a machine, because a cron in the cloud cannot be
forgotten and the files stop being retrievable if nobody takes them. June 2026 backfilled: 16 files,
5.4 MB, both Reg M-B formats at cutoffs 0/1500/1630/1760.

**Cutoffs are weightings, not subsets.** All four files report the same 1,163,315 battles; the cutoff
changes how heavily strong play is weighted. "1760" never means "only 1760+ players".

#### Every Pokémon had a flat SP spread. That was wrong in every damage figure.

`champions_sim.js` gave every Pokémon `11/11/11/11/11/11` and nature Hardy, justified as "spread
evenly when unknown rather than maximising, because maximising would systematically overstate every
unknown Pokemon". The caution was right and the result was still badly wrong.

Real Garchomp runs **Jolly 2/32/0/0/0/32 on 42% of sets**. Since `stat = base + SP + 20`, that is
Attack **182** against the flat assumption's **161** — the format's most-used attacker understated by
**13%**, in every damage number the project has produced and in every MEW battle generated.

Flat spreads also erase the format's shape: **92% of real spreads touch the 32-per-stat cap**, so a
flat one invents a jack-of-all-trades that exists nowhere on the ladder.

`engine/smogon_priors.js` parses the moveset files into per-species spreads, items, abilities, moves
and teammates — 283 species. `set_priors.js` now samples a real spread proportional to how often it
is run, and prefers Smogon's **P(move is ON the set)** over our `move-priors.json` **P(move | action)**,
which is a different quantity: a move clicked rarely can still sit on most sets. Smogon's percentages
sum to ~400% precisely because every Pokémon carries four.

**Two mechanics confirmed against an independent source.** The SP budget is 66 and 97% of real
spreads spend all of it. And SP is capped at **32 per stat** — an early version asserted "sums to 66"
and flagged 100 spreads including `Jolly:32/0/0/0/0/32`, which sums to 64. Those were not malformed;
a two-stat spread cannot spend more, however much budget remains. Both invariants are now asserted.

### Fixed — open team sheets were parsed and then discarded

CHANGELOG 3.0.0 claimed "open team sheets are now parsed … the entire hidden-information problem
removed". The parsing landed; the **use** of it never did. `extract()` built its output only from what
play revealed and never merged the `sheets` it had just captured, so an open-sheet game came out
exactly as blind as a closed-sheet one. ARCHITECTURE fault 1.4 again — a fix applied to the wrong
artifact and reported as done.

Caught by importing an archived OTS corpus and noticing impossible numbers:

| | moves/4 | no item | no ability |
|---|---|---|---|
| closed-sheet ladder | 1.38 | 69.7% | 75.5% |
| OTS **before** fix | 1.50 | 69.7% | 73.8% |
| OTS **after** fix | **4.30** | **0.4%** | **10.1%** |

52,964 sets, 86% declared complete. The 1,624 Bo3 games already in the store have been blind this
whole time and will come back complete on the next reparse.

### Added — two metagames, published separately

`meta-usage.json` used to publish one distribution and call it "the metagame". There are two.

- **competitive** (filtered): what humans choose when trying. Correct for tournament preparation, for
  any claim *about the game*, and for anything an agent should imitate.
- **ladder** (everything): what you actually face. **6,297 of 8,356 stored games involve a bot —
  three in four opponents.** Filtering them out optimises for a metagame the user meets one game in
  four.

The top six differ, and informatively:

```
competitive   garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion
ladder        garchomp, whimsicott, kingambit, basculegion, charizard, incineroar
```

Charizard is 25.7% on the ladder view and outside the competitive top six — it is a bot-team member,
correctly surfacing as something you will meet.

The ladder view is not merely "unfiltered". Bots are the **most predictable opponent in the format**:
one account played 459 games with a single team, four ran the same six in 1,446. "23% of your
opponents will bring precisely these six" is more actionable than any distribution, because it is
certain rather than probabilistic.

And there is a genuine grey area, which is why both ship rather than one being chosen: **humans copy
strong bot teams to practise against**, so a bot team can re-enter the competitive metagame as a
legitimate archetype. Neither view alone is the truth. Consumers must state which they used.

### Notes — what the archives could and could not settle

- **Uploaded replays are broadly representative.** Comparing our uploaded Bo3 games against Smogon's
  whole-ladder Bo3 file for the same month and format: mean absolute difference **1.84 points** over
  the top 20 non-mega species, Spearman **0.733** across 202. Only 3.2% of battles are uploaded, but
  what is uploaded looks like the ladder. Mega formes appear to differ wildly only because Smogon
  counts the mega as its own species while our extractor collapses megas to base forme.
- **Our bot filter is far more aggressive than anyone else's.** Smogon does not filter bots at all
  (it weights by rating); VGC-Bench filters for open sheets only. Ours removes ~75% of the store.
  Consequence: **our filtered numbers are not directly comparable to theirs.**
- **The store is 8,757 unique games, 0 duplicates**, after a night of pushes, rebases and CI commits.
  The `merge=union` removal is holding.

---

## [3.2.0] — 2026-07-25

### Changed — five engines now read through the quality filter, and one headline result did not survive

`war.py`, `roles.py`, `nmf_roles.py`, `vocab.py` and `counterplay.py` each carried an identical
`load_games()` that opened the store directly. They now read through `engine/quality.py`, which reads
the single definition in `data/quality-filter.json`. No threshold is duplicated in any of them.
`ABRA_UNFILTERED=1` restores the old behaviour, for demonstrating the difference only — the same
switch `analyze.js` already had.

Each engine was run **both ways on the same store**, so the difference below is the filter alone and
not the reparse.

#### WAR no longer beats a coin. The prior conclusion is withdrawn.

| | held-out log-loss | vs coin 0.6931 | accuracy |
|---|---|---|---|
| unfiltered (as previously published) | **0.6860** | beats it | 0.539 |
| clean, 1,061 games | **0.7048** | **worse than a coin** | 0.502 |

This is the finding of the release and it is a negative one. WAR was described in the white paper,
`MODELS.md`, `ROLE-FAMILY.md`, `SUMMARY.md` and `PUBLICATION.md` as the model that *did* clear the
bar — "which specific species you bring at preview carries a small real signal that roles and raw
sheets do not". **On games with no bot detected, it does not.**

The mechanism is visible in the coefficients. Basculegion's WAR falls from **281.87 to 23.64**, and
Basculegion is one of the six Pokemon that four undetected bot accounts played in 1,446 identical
games. A ridge RAPM fitted on that data is not learning which species win; it is learning which
species belong to the account that played the most games. Charizard, also on that team, is the
largest negative in both runs — the same artifact with the sign reversed.

Accuracy of **0.502** is the plainest statement of it: on clean data the species model is a coin.

This does not touch PORY (0.567 vs 0.693), which is measured mid-game rather than at preview and is
unaffected by this change.

#### COUNTERPLAY got stronger, and that is also informative

| | tech-vs-standard coverage gap | 95% CI | species positive |
|---|---|---|---|
| unfiltered | +0.0321 | (0.0078, 0.0561) | 72/124 (58%) |
| clean | **+0.0707** | **(0.0252, 0.1179)** | 36/55 (65%) |

More than double, with the interval further from zero. This is the expected direction once the
mechanism is stated: the claim is about **human** choices — that players spend spare move slots
answering the metagame — and a bot never re-teches. Bot games were not noise here, they were
counter-evidence, and removing them sharpened the effect rather than shrinking it.

The top-threat list also corrects to the post-filter metagame:
`garchomp, incineroar, kingambit, sinistcha, basculegion, whimsicott`.

#### ROLES is unchanged in conclusion, corrected in magnitude

Preview roles still tie a coin — held-out log-loss **0.6915** vs 0.6931, CI (0.6783, 0.7049), which
contains the coin. That conclusion has never moved and does not move now.

The **role-pair median cell is 20**, across 1,051 cells. For the record of a number that has been
wrong in three documents for two versions:

| figure | where it came from | status |
|---|---|---|
| n = 7,971 | v2.6.0, over-tagged (19.6 of 26 roles per team) | retracted in 2.7.0, **still printed in the white paper, ROLE-FAMILY.md and PUBLICATION.md** |
| n ≈ 95 | 2.7.0, credible tags, 27 roles | superseded |
| n ≈ 50 | 2.8.0, 39 roles | superseded |
| **n = 20** | **this release: 52 roles, 1,061 clean games** | current |

The direction is the honest story: every step that made the taxonomy more precise, and now the games
cleaner, has cost cell size. n=20 is still above the single-label archetype cells (11–18) that
motivated the role model, but the pooling argument is far weaker than 7,971 ever suggested.

#### VOCAB and NMF

VOCAB: 1,061 games, 26,677 move events, 380 distinct moves; curated roles cover **97.3%** of real
in-battle move usage. NMF still factorises cleanly. Neither makes a claim that turns on the filter.

### Notes — why this was the right thing to do before any model work

The project's own build order (`docs/ALAKAZAM-v2-spec.md`) is inputs first, capstone last. The store
and the rules engine were secured earlier today; the filter was the third input and the only one
still broken. Wiring it first meant WAR's result was retracted **before** anything was built on top
of it, rather than after.

**28 engines still read the store raw.** These five were done first because they share an identical
`load_games()`, so one patch reached all five.

---

## [3.1.2] — 2026-07-24

### Fixed — the store duplication was `merge=union`, not `merge -X ours`

The diagnosis carried in `docs/HANDOFF-2026-07-24.md` and `docs/PROJECT-HANDOFF.md` named
`git merge -X ours` as the confirmed cause of the store duplicating three times. That is wrong, and
acting on it would not have stopped a fourth occurrence.

`.gitattributes` carried `data/games.ladder.jsonl merge=union` (and a catch-all `*.jsonl
merge=union`), added to stop the ingest Action's merge conflicts, with the note "readers dedupe by
id, so duplicate lines are harmless".

`merge=union` resolves a conflicting hunk by concatenating **both** sides in full. On an append-only
log every divergent reconciliation replays the entire appended block, doubling it. The decisive
point the old diagnosis missed: **the union driver applies to `git rebase` as well as `git merge`.**
Rewriting `push-all.bat` to use `--rebase` (shipped in 3.1.1) therefore did not remove the mechanism;
it only changed which command triggered it.

The merge driver has been removed. Divergent appends now produce a real conflict and the
reconciliation stops, which is what `push-all.bat` already expects. Resolution procedure is recorded
in `.gitattributes` itself.

The second half of the old note was also wrong: duplicates are not harmless. They break the S7
store-shape assertions and they corrupt every game count published by the site and the white paper.

### Repaired — store deduplicated, rebase completed

The repository was not in the state the handoff described. It was not a plain detached HEAD: an
interactive rebase was stopped 43 commits into 45. The documented repair (`git checkout main`) would
have abandoned those 43 replayed commits, and because `main` had diverged from `origin/main` by two
`ingest:` commits, the subsequent push would have been rejected as non-fast-forward — the exact point
at which a reconciliation strategy gets reached for. The rebase was completed instead; it finished
clean, with no conflicts.

`engine/dedupe_store.py --write` then took `data/games.ladder.jsonl` from 16,139 lines to **8,000
unique**, 0 duplicates, 0 unparseable, and a second run is a no-op. The store is 8,000 rather than
the 7,547 the handoff predicted because the two `ingest:` commits already on `origin/main` added
games after that document was written.

### Known issue — `sanity_check.py` reports 96 assertions, 94 passed, 2 failed

Reported plainly rather than worked around. Both failures are S7 store-shape:

    FAIL  store shape: every `brought` is a subset of `six`  (1,006 bad of 8,000 games)
    FAIL  store shape: nobody brings more than four
          ({0: 180, 2: 1001, 3: 1929, 4: 12022, 5: 845, 6: 23} over 16,000 player-sides)

These are **not** introduced by the deduplication, and not introduced by keeping the first of each
duplicated id. Evidence: the deduplicated store is byte-identical to the one already on
`origin/main`, and the same check run against the pre-incident merge base `4a5b455` is far worse —
11,239 bad player-sides, with 9,364 sides showing five brought and 3 showing seven. The current
figures are an improvement on the pre-incident store, not a regression from it.

**Cause established — battle forme changes are appended to `brought`.** Of the 1,033 offending
entries, **1,003 contain `mega`**; the remaining 30 are `palafinhero` (18), `aegislashblade` (7),
`mimikyubusted` (4) and `morpekohangry` (1). Zoroark accounts for **zero**. Every case is the same
mechanism: a forme change during battle is recorded as an additional species in `brought`, while
`six` carries the base forme, so the side shows five or six brought and the forme name is not a
member of `six`.

This is `docs/ARCHITECTURE.md` fault 1.5 recurring. That fault was recorded when the mega double
count collapsed CHOMP-EV's eval set from ~1,200 games to 43, and §5 of the same document still lists
"`brought` is still 5 in ~115 games and 0 in 176; not yet explained" as an open gap. It is now
explained, and it has grown from ~115 sides to 845 at five and 23 at six.

The fix belongs in `engine/durable-ingest.js` — a forme change must update the identity of an
existing `brought` entry rather than append a new one — followed by a `MODE=reparse`, which the raw
archive makes free. Not done in this pass.

An earlier version of this entry named Zoroark's Illusion as the likely cause. That was a guess and
it is wrong; the measurement above replaces it.

---

## [3.1.1] — 2026-07-24

### Fixed — the metagame model was literally the bot's team
`engine/analyze.js`, which writes `data/meta-usage.json` (the file CHOMP reads to make
recommendations), read the store directly and filtered only on the per-player `bot` NAME flag. It now
goes through the shared quality filter.

The old top six by team usage was:

    garchomp, whimsicott, basculegion, kingambit, charizard, sylveon

That is, exactly and in full, the six Pokemon on the team four undetected bot accounts played in
1,446 identical games. The recommender's picture of the metagame WAS one bot's team.

Corrected top six: `garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion`.

| species | was | now | change |
|---|---|---|---|
| whimsicott | 31.5% | 17.9% | -13.6 |
| basculegion | 30.5% | 17.8% | -12.6 |
| charizard | 29.1% | 16.5% | -12.6 |
| sylveon | 22.8% | 10.5% | -12.3 |
| garchomp | 34.2% | 24.4% | -9.7 |
| kingambit | 30.0% | 20.4% | -9.5 |
| incineroar | 21.0% | 23.5% | +2.5 |

Sampled team-slots drop from 9,594 to 1,854. Incineroar and Sinistcha - genuine top-tier picks that
the bot did not use - were being pushed down the list by it.

### Added
- `data/meta-usage.json` now carries its own **provenance block**: source, filter, the full funnel,
  and the caveat that bot detection is a floor rather than a proof. A consumer can now tell what a
  number is a statistic about.
- `ABRA_UNFILTERED=1` recomputes over everything, for demonstrating the difference only.

### Notes
36 other engines still read the store directly. This one was done first because it is the only one
whose output is consumed by another product.

---

## [3.1.0] — 2026-07-24

### Added — the official Champions engine
Showdown's `champions` mod exists in the master branch and implements this format exactly.
`engine/champions_sim.js` runs it on `gen9championsvgc2026regmb` — the format id on every replay in
the store — at pinned commit `20ad99ff`. `engine/prior_player.js` ports our behaviour-clone policy
into it so the two engines can be compared like for like.

- `data/quality-filter.json` v1.1 — behavioural bot detection by **team invariance**. Five accounts
  the name filter missed (459 / 426 / 294 / 267 / 147 games, **one team each**) were in 52.2% of the
  previously-clean set. Clean games: 1,941 -> **927 of 7,547 (12.3%)**.
- `engine/quality.js` and `engine/quality.py` — one shared definition, cross-checked by a test that
  asserts both readers select an identical set of game ids.
- `engine/dedupe_store.py`, `build/build_browser_data.js`, `tests/test-rollout-effects.js` (39),
  `tests/test-quality.js` (24), `docs/ADR-001-use-the-champions-mod.md`.

### Fixed — the rollout engine was wrong in eight ways, all silent
Random status instead of the move's status; only Fake Out could flinch; no type or ability
immunities; priority a hand-typed table of 18 moves (all 14 negative-priority moves resolved at 0, so
Trick Room went at normal speed); flinch leaked into the next turn; **Intimidate applied
unconditionally with the sign reversed on Defiant and Competitive**; no powder immunity; Prankster hit
Dark types. Measured effect on 120 real matchups: mean **4.35** points of P(win), max 24.2, favourite
flipped in 9.2%.

Also: the nature table held 23 of 25 (Naughty and Lax fell through to neutral), and the store's
duplicate check read only the first 5,000 lines while all 401 duplicates sat past line 7,144.

### Notes — what the validation actually showed
With identical teams, an identical policy, and both engines verified symmetric on mirror matchups,
our engine and the official simulator disagree by **31.1 percentage points on average**, flipping the
favourite in 3 of 8 matchups. Everything we fixed today was worth 4.35 points. The remaining gap is
seven times larger. This is why ADR-001 replaces the engine rather than continuing to repair it.

Three earlier versions of that comparison were wrong (32.2, 23.7, and a 32.2 where the policy port
silently fell through to random on 100% of decisions). All three are recorded in the ADR rather than
quietly re-run.

### Notes — measured, not asserted
Three Champions status constants had lived as unsourced inline comments. Checked against the mod's
`conditions.ts`: paralysis `randomChance(1, 8)` = 12.5%, sleep `sample([2, 3, 3])`, freeze
`randomChance(1, 4)` with `startTime = 3`. All three correct, and all three now cited. Independently
measured from 7,948 raw logs: 13.8% [11.9, 16.0], 35.3% [31.5, 39.2], 31.6% [23.3, 41.4].

The stat formula is confirmed from `scripts.ts`: `base + SP + 20`, and HP `base + SP + 75`.

### Notes — the meta model was reporting a bot's team
Four of the five undetected bot accounts played the **same six Pokémon** in 1,446 games. Those six are
exactly the species whose usage collapses once they are removed: Basculegion 34.1% -> 17.9%,
Whimsicott 31.9% -> 17.9%, Garchomp 35.5% -> 24.4%, Charizard 26.1% -> 16.5%, Sylveon 19.4% -> 10.5%,
Kingambit 29.1% -> 20.4%. `meta-usage.json`, which CHOMP reads, carries the inflated figures.
**37 engines still read the store directly and bypass the quality filter.** Not yet fixed.

---

## [3.0.2] — 2026-07-24

### Fixed — a store check that was aimed away from the fault
`sanity_check.py` reported "no duplicate ids" while the store held **401 duplicates**. It read only
the first 5,000 lines; the duplicates all sat past line 7,144. Duplicates enter an append-only log at
the **end**, which is exactly the region a head-sample cannot see, so the check passed 95/95 on a
store that was 5% duplicated. The duplicate scan now shares the existing full-file pass.

- Store deduplicated: **7,948 -> 7,547 unique games.**
- `engine/dedupe_store.py` is new: idempotent, order-preserving, atomic rewrite.

### Notes — where the duplicates come from
Not from the ingest. `durable-ingest.js` reads every stored id before appending and refuses repeats.
They come from **git**: an append-only file reconciled by a non-fast-forward merge replays the
appended block. This happened once before (7,040 duplicates from `merge -X ours`). Because the cause
is outside the ingest, a one-off cleanup cannot hold, which is why the fix is a re-runnable script
plus a check that actually looks at the whole file.

Counts computed before this pass were inflated by ~5%, and duplicated rows narrow confidence
intervals without adding information. Models have not yet been re-run on the deduplicated store.

### Notes — the rollout engine is NOT to standard (found, not yet fixed)
Two defects in `engine/medicham2-browser.js`, recorded here rather than silently carried:
- **Status moves apply a uniformly random status.** Line 205 picks from `['brn','par','slp']` at
  random, so Thunder Wave burns a third of the time and Will-O-Wisp can paralyse.
- **Only Fake Out can flinch.** Rock Slide's 30% flinch does nothing in simulation.
The shared rulebook (`data/move-effects.json`, 954 moves, 211 with a secondary, 33 flinch) exists and
is tested, but the rollout does not read it — a second, worse rulebook that fault 1.1 predicted.

---

## [3.0.1] — 2026-07-24

### Fixed — two of the twenty-five natures were missing
`CHOMP/engine/champ-model.js` held 23 natures. **Naughty** (+Atk / -SpD) and **Lax** (+Def / -SpD)
were absent from the table, and an absent nature falls through to the neutral multiplier. Those sets
therefore computed with 1.0 where the game applies 1.1 and 0.9 — a Naughty Kingambit read 187 Attack
instead of 205. Both are now present and verified against the Champions calculator.

### Added
- **S10 — enumerate the domain, do not spot-check it.** Where a rule has a closed, known domain the
  test walks every member and asserts the expected behaviour, plus a count assertion that the
  reference list is complete.
- `tests/test-mega-and-boosts.js` now iterates **all 25 natures** and asserts the *direction* of
  change for all five stats against a neutral baseline, and pins the Champions stat formula
  (`stat = (base + 20 + SP) x nature`, `HP = base + 75 + SP`). 24 -> 28 assertions.

### Notes
- The earlier nature check reported "unexpected multipliers: none" and was **wrong to be reassuring**.
  It asked whether any nature produced a multiplier outside {0.9, 1.0, 1.1}; a missing nature produces
  1.0, which is inside that set. A missing row and a legitimately neutral row are indistinguishable by
  count, which is exactly why S10 asserts direction instead.
- `docs/ARCHITECTURE.md` -> v1.1: fault 1.9 and standard S10 recorded.

---

## [3.0.0] — 2026-07-24

### Architecture — the plumbing, reviewed and standardised
`docs/ARCHITECTURE.md` is new: a blunt review of the whole system, ten engineering standards drawn
from it, and the check that enforces each. Every fault named there is one this project actually
shipped. The pattern behind all of them was singular: **knowledge with more than one home, and no
mechanism that noticed when the homes disagreed.**

### Fixed — faults found by the review
- **Three implementations of the same rules** (canonical engine, browser rollout, embedded site
  copy). When the canonical engine learned real mega base stats the rollout was left behind and the
  two disagreed by **30%** on Charizard-Mega-Y's Special Attack, silently. Fowler's Rule of Three
  says the third duplication is the moment to act; we were past it.
- **`data/engine-data.js` stored only DERIVED values** (level-50 stat lines, no base stats). Data
  that cannot be recomputed can only be copied — which is exactly why the browser engine could not
  follow the forme fix. It is now generated by `build/build_engine_data.js` and carries base stats.
- **A mega dex merged into the wrong artifact.** 67 formes were added to `engine-data.js` and
  reported as "in the engine dex"; the damage engine reads a different file entirely, so the fix
  reached nothing. The claim was made in good faith and was false.
- **Two hand-maintained mega-ability tables** from different sources (Showdown and Serebii). They
  agreed by luck. Now one generated file, `data/mega-formes.json`, read by both.
- **Identifiers were not normalised across boundaries** (`"sand stream"` vs `"sandstream"`).

### Added
- **`CHOMP/tests/test-engine-contract.js`** — a consumer-driven contract test (the Pact pattern):
  an executable statement of what every implementation must agree on. It caught the mega drift on
  its first run. 20 assertions.
- **`CHOMP/data/move-effects.json`** — one secondary-effect rulebook generated from Showdown's
  `moves.json`: 954 moves, 211 with a secondary effect, 33 that can flinch, with accuracy, status
  chances and stat drops. Two rules that are easy to get wrong are stated once and tested:
  **a flinch only lands if the user moves first** and expires at end of turn; **a status cannot
  apply to a Pokémon that already has one**, and type immunities hold (Scald cannot burn a Fire
  type — verified at 0%).
- **Store-shape invariants** in `sanity_check.py` (S7): `brought ⊆ six`, `lead ⊆ brought`, winner is
  a player, every field present, nobody brings more than four. A parser change that breaks the store
  now fails immediately — the mega double-count silently collapsed CHOMP-EV's eval set from ~1,200
  games to **43** before anything noticed.
- **Open team sheets are now parsed.** `|showteam|` declares every Pokémon's item, ability, all four
  moves and nature — the entire hidden-information problem removed. We were detecting these lines
  only to set a flag and discarding the sets. 1,624 Bo3 games are affected; that data now accumulates.
- **Forfeit flag** captured at parse time (1,911 of 7,948 games, 24%), so quality filters no longer
  need the raw archive.

### Changed
- Mega formes: all **95 stones** now carry real base stats, typing and ability. Pre-mega state is
  explicit and overridable (`premega: true`) — holding the stone is not the same as having used it.
- Stat stages (±6) are supported for attacker and defender, with the full crit rule pinned: a crit
  **ignores** the attacker's drops and the defender's boosts, and **keeps** the attacker's boosts and
  the defender's drops. Only the first of those four was previously asserted.

### Notes
- The Champions stat formula simplifies exactly: **normal stat = (base + 20 + SP) × nature**, and
  **HP = base + 75 + SP**, for every base value 1–255. SP budget is 66.
- Largest remaining gap, stated plainly: the canonical engine's dex is still scraped from an HTML
  file and parsed with `eval()`. That is the reason the wrong-artifact fault was possible, and it is
  the top of the remaining list in `ARCHITECTURE.md` §5.

## [2.10.1] — 2026-07-24

### Changed — every model re-run on the deduplicated store
All reports were still computed on the 14,361-line store that turned out to be ~half duplicates.
Re-run on the 7,315 unique games. What survived, and what did not:

| Model | On clean data | Verdict |
|---|---|---|
| PORY (mid-game value) | log-loss **0.5648** vs coin 0.6931, ECE 1.8%, CI [0.550, 0.584] | **holds** |
| WAR (species RAPM) | **0.6856** vs coin 0.6931, accuracy 54.1% | **holds** |
| MEDICHAM damage | 100% within 5% of the Smogon calculator | **holds** |
| SLOWKING (species) | greedy 0.078 vs Nash 0.0002, gap CI **[0.0031, 0.0977]** | **holds** |
| SLOWKING (playstyle) | gap CI **[-0.0001, 0.2105]** | **no longer clears zero** |
| COUNTERPLAY tech-lift | +0.0274, CI **[0.0006, 0.0533]** (was +0.0386 [0.0155, 0.0617]) | **barely holds** |
| GURU predictive test | log-loss 0.7007 vs coin 0.6931 | still a coin, as always documented |
| CHOMP-EV | winners lean more aligned, CI includes 0.5 | still the honest null |
| XATU policy clone | top-1 32%, phase-conditioning again did not help | unchanged |

- The pattern is consistent and worth stating plainly: **the strong results were unaffected and the
  marginal ones got weaker.** Duplicated rows inflate apparent independent evidence, so they narrow
  intervals without adding information. Nothing that was solid became shaky; two things that were
  already borderline (the playstyle equilibrium gap, the tech-lift) lost the significance they had
  been credited with.
- Site data regenerated from the clean store (7,315 games, 48,326 turns, 11 archetypes).

## [2.10.0] — 2026-07-24

### Fixed — the store was half duplicates, and every sample size was overstated
- **`data/games.ladder.jsonl` held 14,361 lines but only 7,315 unique games** — 7,040 duplicate rows,
  left over from the `merge -X ours` reconciliations during the earlier git incident. Every "14,355
  games" figure quoted today was inflated roughly 2x, and duplicated rows also narrow confidence
  intervals artificially. The store is now deduplicated; **no unique game was lost** (verified by id
  set comparison against the pre-merge backup).
- **Store reparsed from the raw log archive**, so the mega/weather/terrain parsing now applies to
  history rather than only to new games. Effect: **12,146 mega events** and **8,752 weather/terrain
  events** where there were none, and setter abilities appear at last — Pelipper **Drizzle 0 -> 1,490**,
  Torkoal **Drought 0 -> 613**, Incineroar Intimidate 1,934.
- **Illegal ability readings rejected.** Log attribution is imperfect (Trace copies opponents; a
  mis-attributed slot handed Basculegion an "Intimidate" it can never have). Observed abilities are
  now validated against the species' legal set from the dex, and impossible readings are dropped
  instead of creating phantom roles.

### Changed — a result got weaker on clean data, and that is reported
- **COUNTERPLAY's tech-lift, recomputed on the deduplicated store: +0.0274, 95% CI [0.0006, 0.0533].**
  It was +0.0386, CI [0.0155, 0.0617] on the duplicated store. The interval still excludes zero, but
  only barely — the earlier version overstated the evidence because duplicate games were counted as
  independent observations. The direction stands; the confidence does not. **WAR is unaffected in
  direction and still beats a coin: 0.6856 vs 0.6931, accuracy 54.1%.**

### Notes — what "known" actually means under closed sheets
- A correction to how the new `species-abilities.json` was described. **Nothing about an opponent's
  Pokemon is known until it is proven in play — ability, item, and moves alike.** The dex narrows the
  *possibilities*; it does not reveal the set:
  - **94 species have exactly one legal ability**, so for those the species genuinely does determine
    it at preview. That is the only truly certain case.
  - **213 species have two or three**, so the ability stays a belief until the log proves it —
    Basculegion is Swift Swim *or* Adaptability *or* Mold Breaker.
  - **A mega's ability is certain only once it megas.** Before that you cannot see the stone, so you
    do not even know a mega is coming, let alone which form.
  - **Items and moves are never given by the dex at all** — only revealed by use.
  - **EVs are the hardest of all, and are never stated anywhere.** They are only *bounded*, and only
    by inference: a damage roll narrows an attacking stat to a range rather than a value (16 possible
    rolls, all consistent with a band of EVs), and moving first only proves a Speed *inequality*
    against whatever it outsped — sharpest at a known benchmark, useless in Trick Room or under a
    Choice Scarf. So an EV spread never collapses to a point the way an ability or an item does; it
    narrows to an interval that tightens with every turn. The engine's level-50 numbers assume a
    standard competitive spread and are labelled an approximation for exactly this reason.
- The consequence is a design one: this is a belief-state problem, not a lookup. The right structure
  is a per-slot information state that starts as the legal possibility set and collapses on each
  reveal. That is XATU's job, and it is the next thing to build properly.

## [2.9.0] — 2026-07-24

### Fixed — the extractor never knew mega evolution existed
- **`engine/durable-ingest.js` did not parse `|detailschange|` or `|-mega|`.** Every mega therefore
  kept its BASE form's identity, and its new ability was never attributed to anything: **904 of 906**
  Charizard-Mega-Y sets had a blank ability, and Raichu-Mega-X (Electric Surge) was indistinguishable
  from Raichu-Mega-Y (No Guard) even though they play nothing alike. Now parsed, with the mega, its
  base form and the stone recorded.
- **Weather and terrain setters were half-invisible.** A setter ability is usually stated *only* in
  `|-weather|...[from] ability: Drizzle|[of] p1b: Pelipper`, which we did not read. Verified on a live
  replay: the fix recovers `pelipper -> Drizzle` and `glimmoramega` + `Glimmoranite`.
- **`engine/roles.py` had stopped finishing** (>120 s at 14k games). Two hot spots, both replaced with
  the identical calculation vectorised: the logistic fit, and a bootstrap that was re-running the model
  600 x |test| x |roles| times when per-row losses do not change between resamples. **5.2 s** now.

### Added
- **Mega dex from the authoritative source** (`engine/build_mega_dex.js` -> `data/mega-dex-official.json`,
  merged by `engine/merge_mega_into_engine.js`). Source is Showdown's own `pokedex.json` — the data the
  server runs this format on. **67 mega formes** added to the engine dex with real types, abilities,
  base stats and required stone. Damage validation re-run and unchanged (100% within 5%).
- **Zoroark-Hisui illusion detector** (`engine/illusion.js` -> `data/illusion.json`). Illusion copies the
  NAME, not the moveset, so a legality contradiction proves the disguise: the apparent species cannot
  learn the move and Zoroark can. On 395 Zoroark team-sides it proves **156 disguises** (0.39 each).
  Most common disguise Whimsicott; the giveaway moves are Hyper Voice (32) and **Bitter Malice (30)**,
  a Zoroark-Hisui signature. Conservative by construction, so the count is a floor.
- **Weather and terrain roles split by type** — rain/sun/sand/snow and psychic/grassy/electric/misty, on
  BOTH the setter and abuser side, so "Swift Swim with no Drizzle" is a detectable defect rather than
  two generic tags that never meet. Taxonomy is **52 roles**, covering **98.0%** of real move usage.

### Notes — measured, including what it cannot yet measure
- **Mega abilities cannot be harvested from logs, at all.** Mega evolution emits only `detailschange`
  and `-mega`; no ability line follows. An earlier harvest appeared to find 9 conflicts with the
  official dex — three were **Trace** correctly copying an opponent's ability, and the rest were
  attribution noise on 1–6 observations. The official dex is the source; the harvester is kept only
  to discover which formes exist.
- **First dead-ability measurement:** 72% of teams carrying an Expanding Force user have **no Psychic
  Terrain setter**, and 99.6% of Electric Terrain abusers have no setter. The weather equivalents
  return nothing yet — those roles are ability-based, abilities only announce sometimes, and the
  Wilson credibility gate correctly drops them as under-observed. Fix is to source abilities from the
  dex (certain where a species has only one) rather than from observation; not done yet.
- The store still needs a **reparse** before any of the new mega/weather events exist historically.

## [2.8.1] — 2026-07-24

### Notes — a wrong diagnosis, corrected
- The `auto: <date>` commits were diagnosed as a rogue timer running `push-all.bat` every ~2 minutes.
  **That was wrong.** Reading the commits properly showed they are authored by the workspace's own
  auto-commit, which fires ~2 minutes *after files change*, then commits and pushes. The apparent
  fixed cadence was simply a long stretch of continuous editing. Verified: a test edit was committed
  and pushed to origin unattended, with nothing outstanding afterwards.
- Consequence: the publish automation the project needed **already existed**. The idle-publisher
  scripts added earlier today (`build/auto-push.ps1`, `AUTO-PUSH-START.bat`, `AUTO-PUSH-INSTALL.bat`,
  `find-autocommit-task.bat`) were removed — a second publisher racing the first is what wedged the
  repo mid-rebase in the first place. One publisher is correct; two is a bug.

### Kept
- `push-all.bat` stays disarmed (requires the `GO` argument) and now refuses to act on a repo that is
  mid-rebase. That guard is the durable fix and is unrelated to the misdiagnosis.

## [2.8.0] — 2026-07-24

### Fixed
- **`engine/guru.py` aborted on a truncated store line**, so the site's headline numbers were frozen
  at **5,199 games** while the store had grown past **7,400**. The ingest job appends on a schedule
  and an interrupted run can leave a partial line (6 of 7,449 lines). GURU now skips unparseable
  lines like the other engines. Map metrics are live again.
- **`engine/vocab.py` ignored the multi-role override table**, so tagged moves (Psychic Fangs, Brick
  Break, Stockpile) were reported as untagged. Coverage of real in-battle move usage is **97.1%**.
- **The MAP's hover text** was long and carried leftover nickname glosses ("(MEDIcham)"). Every node
  blurb rewritten to one plain sentence.

### Changed
- **MAP edges are curved rather than straight.** A crossing-free drawing is not possible for this
  dependency graph — ALAKAZAM has six parents spread across a row and MEDI feeds both the far left
  and the far right — so instead of claiming otherwise, each edge now bows in proportion to how far
  it travels, which separates lines that previously overlapped. Hover still isolates one path.
- **Taxonomy expanded 27 → 39 roles**, all from real gameplay distinctions:
  status split by type (**burn** = a debuff that halves Attack, **paralysis** = speed control,
  **sleep** = action denial, **poison** = a clock) — each 1,000+ uses and 20–59 species, so none is
  sparse; **spread attacker** split from **field-wide (hits your own partner)**, because Earthquake /
  Surf / Discharge constrain team building (they need an immune partner); plus **multi-hit** (breaks
  Sash, Sturdy, Multiscale, Substitute), **fixed/fractional damage** (Super Fang, Seismic Toss —
  ignores stats and the type chart), **residual chip**, **hazards** (incl. Toxic Debris),
  **substitute**, **weather/effect denial** (Cloud Nine, Air Lock, screen-breakers),
  **weather/field abuser** (distinct from setter), and **positioning** (now including Roar-family
  forced switches). Freeze is documented as functionally sleep but *not* tagged: no move in Reg M-B
  sets it, so crediting every Ice attack would be dishonest.
- Ability mapping corrected throughout: Lightning Rod / Storm Drain → redirection; Hospitality and
  Regenerator → healing; trigger-boosters (Defiant, Competitive, Moxie) → setup. Fairy Aura and Dark
  Aura are deliberately **left untagged** — they are passive, permanent, type-wide multipliers, not
  the same job as Helping Hand's active one-turn boost.

### Added
- `engine/build_roles_js.py` → `data/roles.js`; the Roles booth gains a **species explorer** showing
  any Pokémon's role *distribution* with confidence intervals, and archetypes now show their most
  distinctive Pokémon by lift.

### Notes — the fragmentation trade-off, stated plainly
- A finer taxonomy costs cell size. The median role-pair cell has moved **7,971** (over-tagged, v2.6)
  → **95** (credible tags, 27 roles) → **~50** (39 roles). It is still far above the old single-label
  archetype cells (n=11–18), but the direction is the price of resolution. The test and sanity bars
  were lowered 100 → 50 → 35 **with the reason recorded in-line**, and they now act as the tripwire
  against adding roles without a justification.
- Winner-prediction from preview roles is unchanged at the coin (0.6935 vs 0.6931); WAR still beats
  it (0.6867, accuracy 54.4%). Neither headline conclusion moved.

## [2.7.0] — 2026-07-24

### Changed
- **A species now has a role DISTRIBUTION, not a role list.** The same species is support on one set
  and offensive on another, so `dex[species][role]` is now `p(role | that species appears)` measured
  across its revealed sets, and a team's role vector is a **noisy-OR** over its six
  (`1 − Π(1 − p_i)` = probability at least one of them plays the role). Under closed sheets this is
  also the correct object: before the set is revealed, the distribution *is* our belief.
- **Credibility is judged by a Wilson lower bound on the rate, not a flat count.** The old
  `count ≥ 2` rule could not tell a real minor set from noise — it tagged Basculegion as *debuff* on
  **2 of 3,566** appearances (0.06%). A role now counts only when the Wilson lower bound of its
  per-set rate clears 5%, which automatically demands more evidence from a common species and stays
  honest for a rare one.

### Fixed
- **Ability→role gaps found by audit:** *Lightning Rod* and *Storm Drain* now map to **redirection**
  (they redirect, and were untagged). Added a new role **weather/field abuser** (Chlorophyll, Swift
  Swim, Sand Rush, Solar Power, Protosynthesis, Quark Drive…) — a distinct job from *setting* the
  weather. Trigger-boosters (Defiant, Competitive, Moxie, Justified, Berserk…) now map to **setup**.
  Taxonomy is 27 roles; curated roles cover **90.8%** of real in-battle move usage.

### Added
- **`docs/ROLE-ATLAS.md` (+ PDF)** — the master list: every move (478) and ability (99) with the role
  it is tagged as, generated directly from `engine/roles.py` so it cannot drift, plus a ranked list of
  untagged-but-used moves as tagging candidates. Generator: `engine/role_atlas.py`.
- **`docs/ROLE-FAMILY.md` (+ PDF)** — one read-through of the role model, WAR, and the emergent NMF
  archetypes, with every result stated against its baseline.
- Site: the MAP tab now renders a real **map icon** in the nav, town and room hero (the Porygon2
  sprite is gone), and **MAP is first** in the nav order.

### Notes — a prior number changed, and why (not silently rewritten)
- The v2.6.0 claim "median role-pair cell **n = 7,971**" was **inflated by over-tagging**: under the
  old binary rule a team carried **19.6 of 26** roles on average, so nearly every game landed in
  nearly every cell. With credible tags a team carries **4.3 of 27**, and the honest median cell is
  **n ≈ 95**. That is still far above the old single-label archetype cells (n = 11–18) — the pooling
  argument stands — but the earlier figure overstated it. Test and sanity bars moved 100 → 50 with
  the reason recorded in-line.
- Winner-prediction from preview roles remains at the coin (0.694 vs 0.693); WAR still beats it
  (0.6875). Neither conclusion changed.
- The hourly **ingest** workflow no longer fails the run when Showdown rate-limits or serves a bad
  log (`continue-on-error` on the fetch/rebuild steps) — it was emailing a failure notice every hour.

## [2.6.0] — 2026-07-24

### Added
- **Emergent roles via NMF** (`engine/nmf_roles.py` → `data/nmf-roles.json`, `data/nmf.js`). Instead of
  hand-declaring roles, this factorizes the data (Lee & Seung 1999; topic-model / Label Distribution
  Learning framing, Geng 2016) into roles that are *discovered*. Two cuts: (1) team×MOVE usage →
  offensive cores (recon-err 0.79; attacking moves dominate — shown honestly); (2) team×ROLE →
  **emergent archetypes** (recon-err **0.53**, the clean view): Intimidate+Fake-Out control, physical
  offense, special offense+sustain, **bulky wall + screens + redirection**, Tailwind+Encore, priority.
  A team is a *blend* of these, never one hard label — the structural fix for the single-label grid.
- **Vocabulary census** (`engine/vocab.py` → `data/vocab-usage.json`): tags every move/ability/item and
  counts **actual in-battle usage** (from the turn log), not just sheet reveals. Curated roles cover
  90.4% of non-neutral battle usage; surfaces high-usage uncovered moves as tagging candidates.
- **Roles booth on the site** (`web/index.html` → `app/`): the "Role Foundry" (Smeargle) renders the
  emergent archetypes and offensive cores live from `data/nmf.js`, with the reconstruction errors shown.
- Role taxonomy grown to **26** roles (added ally-support/positioning and item-disruption); factual
  multi-role membership for multi-effect moves (Matcha Gotcha = attack+heal+status; Body Press =
  wall+attack; Knock Off = attack+item-strip; Fake Out = tempo only, not an attacker).

### Changed
- **Removed hand-set role weights.** An earlier draft assigned fractional primary/secondary weights
  (0.6, 0.4…) by hand — asserted, not measured. These were stripped: role *presence* is binary and
  data-justified, and graded *strength* is now the learned output of the NMF, not a typed input. This
  is the project's "measured, not asserted" rule applied to itself.
- Sanity extended to 77 checks (role model + WAR + NMF); `tests/test-roles.py` at 19 checks.

### Notes
- Honest read on the NMF: at the team level the dominant axis of variation is offensive core + speed
  control, so the move-level cut is coarse; the role-level cut is the useful one. Rank and the human
  names are the only non-data choices. Rigorous rank/weighting selection by topic coherence (Mimno
  2011) is noted as the next refinement — reconstruction error alone is not comparable across weightings.
- Still local + (about to) push. Site booth added; white paper / deck / technical docs for the role
  family remain to be written in a dedicated docs pass.

## [2.5.0] — 2026-07-24

### Added
- **ROLE model — multi-label team composition** (`engine/roles.py` → `data/pokemon-roles.json`,
  `data/role-matchups.json`, `data/roles-eval.json`). Replaces the single-label playstyle view.
  A team is tagged with every role it reveals (24 roles across speed control, weather, terrain,
  disruption, status/debuff, priority, prankster, setup, healing, screens, walls, pivot, trapping,
  perish, and physical/special attacker), where each **species earns a role from data** — it is
  credited once observed doing it (≥2 times). Team role vectors are built from the **team-preview six**
  (leak-free). Why: the old model forced one label per team and shattered the data into
  archetype×archetype cells of n=11–18; role-pair pooling gives a **median cell of n=7,750** (576 cells).
- **Role-pair matchup matrix** with Wilson CIs — the descriptive "which role beats which," now dense
  enough to reach significance, ready to feed GURU/KING and the site grid.
- **Win-credit attribution:** per-role logistic coefficients (each role's marginal contribution to
  winning) plus **KO-credit per species** from the turn log (who actually scored the knockouts in
  games their side won).
- **WAR for Pokémon — Wins Above Replacement** (`engine/war.py` → `data/war.json`). Ridge-regularized
  Adjusted Plus-Minus (basketball RAPM) on team-preview species indicators, with an explicit
  20th-percentile replacement baseline and the logistic wins conversion (0.25·Δβ·games).
- **Tests + sanity:** `tests/test-roles.py` (19 checks; hand-derived tags, reads shipped reports so it
  can't drift). `engine/sanity_check.py` extended to cover the role model + WAR (now 70 checks).

### Notes
- **Two honest results, stated plainly.** (1) Predicting the winner from **preview roles** ties a coin
  (held-out log-loss 0.6938 vs 0.6931) — consistent with the sheet-level null; the role model's value
  is descriptive + attribution, not prediction. (2) But the **species-level WAR model does beat a coin**
  (0.6875 < 0.6931) and beats the rating baseline (0.6905): *which* species you bring at preview carries
  a small real signal that raw roles and raw sheets do not. Effect sizes are small; WAR magnitudes are
  ridge-shrunk and flagged exploratory.
- White paper / deck / technical docs and the site grid are **not yet** updated for this model — code and
  reports are written and tested locally; the doc + site pass is the next step (flagged, not silently skipped).

## [2.4.0] — 2026-07-23

### Added
- **v2 models on the site (`web/index.html` → `app/`):** new booths for **GURU** (meta matchup matrix), **XATU** (opponent belief), **PORY** (mid-game win% — with a live interactive "your win %" demo driven by `data/pory.js`), and **ALAKAZAM** (the in-battle capstone, honestly flagged in-development). SLOWKING's booth rewritten to show its real equilibrium mixture + a **rock-paper-scissors triangle diagram**. Model names rendered in **ALL CAPS** across the nav and town.
- **Playstyle layer** (`engine/playstyle.js` → `data/playstyle-matchups.json`; SLOWKING re-run → `data/slowking-playstyle-eval.json`): classifies each real team by playstyle and builds a playstyle×playstyle matrix; surfaces the strongest non-transitive cycle (TrickRoom → HyperOffense → Sand → TrickRoom).
- **ALAKAZAM plain-English one-pager** (`docs/ALAKAZAM-one-pager.md` + `.pdf`): context, what it will be, how it works, compute needs, timeline — for a non-Pokémon audience.

### Changed
- **Honest framing of the playstyle cycle:** the cycle legs are 62% / 71% / 67% but on only n=13–18 games each, with 95% CIs that cross 50%. Site copy now calls it a **suggestive pattern, not a settled fact** — it sharpens as the store grows. No overclaiming.
- **Docs folder cleaned:** 13 superseded/duplicate files (old simulator whitepaper, special-cut, v2-plan PDF, old summaries/reviews/handoffs) moved to `docs/archive/`; one canonical version of each kept.
- **Site chrome:** removed the static side-advisor mascot (kept the roaming Abra sprites).

### Documentation (full v2 rewrite — brought to standard)
- **White paper, deck, and technical docs rewritten for v2** (they had drifted to pre-pivot v1). The white paper now covers the empirical ceiling, every model with its validated result (incl. the two honest negatives), the mathematics (Wilson interval, value-net logistic, regret-matching/exploitability, clustered + Beta-resampled CIs, HodgeRank for future core analysis), limits, and cited sources. The deck is plain-English; the technical docs are ASD-STE100 Simplified Technical English organised by Diátaxis. Each ships a matching **PDF**.
- **New `docs/SUMMARY.md` (+ PDF):** one-page whole-project + per-component summary table.
- **Corrected an error** in the ALAKAZAM one-pager: poker is *sequential*, not simultaneous — reframed as "hidden information like poker **plus** same-time choices like rock-paper-scissors."
- **CLAUDE.md** now lists the docs that MUST update in the same pass as any change (living-docs enforcement), so the white paper/deck/technical docs cannot silently drift again.

### Removed
- Nothing deleted — superseded docs are archived (reversible), not destroyed.

---

## [2.3.0] — 2026-07-23

### Added
- **SLOWKING preview-Nash** (`engine/slowking_preview.py` → `data/slowking-eval.json`, `data/slowking.js`): solves GURU's real 13-archetype matchup matrix (5,199 games) to an equilibrium mixed strategy and grades it by **exploitability** (the spec's acceptance bar for the strategic layer) against greedy-single-deck and uniform baselines, with a bootstrap CI that propagates matchup-count uncertainty (Beta resampling). Also reports the strongest **non-transitive 3-cycle** in the meta.
- **Playstyle layer** (`engine/playstyle.js` → `data/playstyle-matchups.json`; SLOWKING re-run with `MATRIX_FILE=…/playstyle TAG=playstyle` → `data/slowking-playstyle-eval.json`): a rule-based classifier tags each real team by playstyle (TrickRoom / Rain / Sun / Sand / Snow / Setup / PerishTrap / TailwindOffense / FakeOutBalance / Stall / HyperOffense) and builds a playstyle×playstyle matrix from 2,866 games. **This is where the non-transitivity is real:** greedy single-playstyle exploitability 0.115 vs Nash 0.0002, gap CI [0.001, 0.280] (clears 0), with a clean cycle **TrickRoom → HyperOffense → Sand → TrickRoom** (~0.115 edge/leg). Equilibrium: Rain 0.51 / Sand 0.26 / HyperOffense 0.10 / Setup / PerishTrap / Snow.
- **Test + CI:** `tests/test-slowking.py` — a hand-derived Rock-Paper-Scissors unit test of the Nash solver (answer is uniform, value 0) plus shipped-artifact invariants; gated in the `tests` workflow (regenerates the artifact then checks it).
- **Portfolio:** ABRA added to `willhoop.github.io` as a one-object entry in the `PROJECTS` array (its own convention), leading with a measured number (PORY 0.567 vs coin 0.693). A `PUSH-TO-GITHUB.bat` was added to the portfolio repo for one-click publishing.

### Findings (honest)
- **Equilibrium mixture:** Kingambit-Basculegion 0.84 / Garchomp-Incineroar 0.16. Exploitability **Nash ≈ 0 vs uniform 0.109** — mixing over the right decks is far less exploitable than spreading evenly.
- **Greedy ≈ Nash at the archetype level:** this meta is currently near-transitive (a dominant deck), so "pick the single best deck" is about as unexploitable as the equilibrium *right now* — stated plainly rather than spun as a win for mixing. **However** a real rock-paper-scissors cycle exists (Charizard-Venusaur → Whimsicott-Garchomp → Garchomp-Incineroar → back, ~0.10 edge/leg), and the greedy-vs-Nash gap CI reaches 0.27, so under plausible resamples the meta is non-transitive. Finer, playstyle-level archetypes (stall / Trick Room / perish-trap / setup) would expose more cycles — the documented next refinement.

### Notes
- Archetype-level, not set-level: SLOWKING solves over 13 discovered archetypes, not exact teams/sets; a belief over the opponent's real six (XATU) is the next refinement. Exploitability grades the preview *decision*, never who wins a match (GURU's own predictive test ties a coin).

---

## [2.2.0] — 2026-07-23

The v2 decision-stack release: stop predicting winners, support decisions. Models built + graded
this session, each with a proper score + clustered-by-game CI + honest baseline, persisted to JSON.

### Added
- **GURU** — meta/matchup matrix from REAL game outcomes with Wilson CIs (`engine/guru.py` → `data/guru.js`). Replaces the biased *simulated* payoff matrix at the source.
- **XATU** — opponent belief (item/ability/moves) inferred from replays (`engine/xatu.py` → `data/xatu.js`).
- **PORY** — mid-game win-prob value net from real replays (`engine/pory.py` → `data/pory.js`). **The win:** held-out log-loss **0.567 vs coin 0.693**, beats a material-sign heuristic, calibrated (ECE 1.6%), clustered-by-game CI [0.548, 0.583]. Proves the v2 pivot — mid-game state is predictable even though pre-game sheets are not.
- **PORY wired into KADABRA:** the coach now shows a per-turn **"you're at X%"** chip at each key moment, computed in-browser from `data/pory.js` (site includes it now). `web/index.html` `kadBuild`/`renderKad`; mirrored to `app/`.
- **CHOMP-EV proof** (`engine/chomp_ev.js` → `data/chomp-ev.json`): the winnable team-preview test — do CHOMP's recommended brings beat humans' actual brings on held-out games? Ranks each side's actual bring among all 15 candidate brings by CHOMP exact-damage coverage; headline sign test + held-out logistic log-loss (Brier too), clustered bootstrap CI, baselines = coin / Elo / usage-prior, plus a forfeit-robustness pass and a measured selection audit.
- **Test + CI:** `tests/test-chomp-ev.js` validates the committed `data/chomp-ev.json` invariants (split bookkeeping, score ranges, CI brackets, verdict-vs-numbers consistency, honesty block); gated in the `tests` workflow.

### Findings (honest)
- **CHOMP-EV is a NULL at the format ceiling.** On 1,205 held-out human games, CHOMP's bring ranking does **not** beat a coin (log-loss 0.6918 vs 0.6931, CIs overlap), ties an Elo and a usage-prior baseline, and winners are only marginally more CHOMP-aligned than losers (0.512, CI [0.493, 0.535] — includes 0.5). CHOMP's top pick matches the human bring ~9.5% of the time (chance 6.7%). **Robust:** dropping all forfeits leaves it unchanged (0.505; log-loss 0.690 vs 0.693). **Selection audit:** eval games average 6.5 turns / 1280 rating vs 6.08 / 1267 excluded — a mild bias that, if anything, *favors* CHOMP, making the null conservative.
- **What this does NOT impugn:** CHOMP's damage math stays VALIDATED vs `@smogon/calc`; the null is about the *bring-selection signal*, which sits at the same near-coin ceiling as pre-game win prediction. It guards against optimizing a bring metric with no held-out winning signal (the DITTO/measure-gaming trap). Path to a real edge: score brings with belief-aware value (XATU) + the lead stage-game (SLOWKING) + PORY leaf value, then re-run this exact test.

### Notes
- White paper and plain-English deck updates for GURU/XATU/PORY/CHOMP-EV are still pending (this pass shipped code + CHANGELOG + MODELS/HANDOFF; the long-form docs are the next documentation pass).

---

## [2.1.0] — 2026-07-23

### Validated
- **MEDICHAM damage engine validated against `@smogon/calc`** (`engine/validate_damage.js`): with stats aligned, matches the ground-truth calc within 5% on 100% of 31 meta scenarios (median 0% error). Fixed the level-50 harness bug, then closed the ability gaps it surfaced.

### Added
- **Ability/item layer, each validated vs Smogon:** Ruin quartet, Solar Power, Guts, Orichalcum Pulse, Hadron Engine, Adaptability, Technician, Tinted Lens, Filter/Solid Rock, Multiscale, Thick Fat, Heatproof, Purifying Salt, type-immunity abilities, Expert Belt, Muscle Band, Wise Glasses.
- **DITTO policy hardening:** accuracy-weighted move value, recoil cost, self-stat-drop moves (Close Combat/Superpower/Overheat) with **Contrary** flip, **Mega ability tracking** (base vs Mega stone — Staraptor→Contrary, Swampert→Swift Swim + canonical Megas), weather-speed abilities (Swift Swim/Chlorophyll/Sand Rush/Slush Rush). Reduces the speed/frailty over-crediting (the Staraptor problem).
- **Site now grows:** `data/live.js` (counts + data-derived archetypes) and `data/kad-replays.js` (offline replay bundle) regenerate via `engine/refresh-site-data.py`, run by the daily replay pull. Town stats + DITTO archetypes read live.
- **Archetypes discovered from data** (`engine/archetypes.py`, k-means over 9,998+ real teams), not hand-listed — refreshes as the meta shifts.
- **ORB (CHOMP dock) upgraded to a validated Smogon-grade substitute:** reads live stats/items/boosts/weather/terrain/Helping Hand/spread/screens, shows applied conditions. One-click install; auto-updates.

### Fixed
- KADABRA works offline (`file://`) — coaches from the local bundle, clean move-by-move viewer with arrows and a bold "what you should've done" (dropped the Showdown iframe clutter).
- Abilities corrected from a curated meta map (no more bogus "Pressure"); real move names + spacing; Laplace smoothing so win rates never read 0%/100%.
- Non-transitivity view rebuilt as big whimsical rock-paper-scissors loops (no tiny text). Town card honesty (daily, real counts). Footer/sprite overlap.

### Known gaps (not guessed — need confirmation)
- **Champions rule changes vs Gen 9** (sleep, paralysis, specific move changes) are NOT yet modelled — pending the exact format rules.
- Enemy EVs are assumed (unknowable). Mega **stats/types** not yet swapped (abilities are).

---

## [2.0.0] — 2026-07-23

The "honest instrument" release: a real doubles engine, an evaluation layer that grades every
probability, the SLOWKING belief-search stack, and the first learned value function (the flywheel's
core). Also a strict self-review that reshaped the roadmap.

### Added
- **MEDICHAM v3 — real Gen-9 doubles engine** (`engine/medicham2-browser.js`, embedded in the site):
  replaces the 1v1 OHKO-chain that collapsed to 0%/100%. Damage formula with boosts/spread/crit/rolls,
  weather, Trick Room, Tailwind, priority, Protect, items, abilities, Fake Out; behaviour-cloned policy
  (samples real move rates), need-based Protect. Verified: mirror 0.50, healthy distribution, 400
  rollouts/29ms. Win rates now carry a 95% CI on the site.
- **Evaluation harness** (`engine/eval_harness.py`): temporal held-out log-loss / Brier / calibration
  vs coin, player-Elo, and usage baselines with bootstrap CIs. **Verdict: JOLTEON ties a coin in
  log-loss** — demoted from headline predictor to fast prior + baseline; site copy made honest.
- **Calibration** (`engine/calibrate.py`): temperature scaling; the Python JOLTEON was 6× overconfident.
- **Learned in-battle value function** (`engine/train_value.py` → `data/value-net.json`): reconstructs
  per-turn HP state and regresses the outcome. Beats a coin (log-loss 0.682) and is calibrated — the
  first genuinely learned, calibrated component, and the leaf evaluator + flywheel core.
- **SLOWKING infrastructure** (`engine/slowking/`): `nash.py` (equilibrium, verified on RPS/2×2),
  `belief.py` (public-belief-state + Bayesian filter), `ismcts.py` (simultaneous-move regret matching,
  recovers exact Nash), `game.py` (engine interface), `solver.py` (team-preview Nash + continual
  re-solve; returns bring *mixes* + win%), `value.py` (loads the learned leaf). All unit-tested.
- **Self-play data pipeline** (`sim/generate-dataset.js`) writing engine games into the store schema —
  the unlimited, unbiased "more games" path. Scraper default raised 2→25 pages (~10× per run).
- **Non-transitivity finding** (`data/nontransitivity.json`, DITTO tab): the meta is rock-paper-scissors
  (3 robust cycles after noise control) — empirical proof an additive rating can't capture it. Shown
  with an explicit "preliminary, thin data" caveat.
- **Docs:** `docs/POKER-TO-POKEMON.md` (the founding white paper), `docs/THESIS-REVIEW.md` +
  `docs/THESIS-REVIEW-v2.md` (strict self-critique with fixes), `docs/COMPETITORS.md` (VGC-Bench et al.
  and how we refine them), `docs/OVERNIGHT-HANDOFF.md`.
- **Site:** in-browser DITTO (item tuning + PokéPaste export) and KADABRA (client-side replay coach);
  MEDICHAM/DITTO use the sprite picker; saved-teams in the matchup; ORB opens from Chomp's room;
  per-room personality mascots; threats table with sample-adjusted Win%, real speed, Games column.

### Changed / Honest corrections
- JOLTEON reframed as a fast prior, not an oracle (backtest: ~coin in log-loss).
- White paper corrected: the current SLOWKING search is IS-MCTS/PIMC (strategy fusion), a rung below
  the ReBeL target — no longer overclaimed.
- Non-transitivity presented as preliminary (approximate engine, small sample), not a settled claim.

### Fixed
- MEDICHAM special-move bug (special attackers dealt 0 damage); booth slot regression that broke
  "Surprise me"; DITTO/KADABRA no longer require a server.

---

## [1.0.0] — 2026-07-22

### Added
- **ABRA is born**, split out from CHOMP as its own project: the Automated Battle Replay Analyzer.
  CHOMP stays the bring-4/lead-2 engine; ABRA is the meta-analysis brain that feeds it.
- **Durable, incremental, no-redo ingest** (`engine/durable-ingest.js`): pulls public Champions
  Reg M-B replays from the Showdown API (paginated, ~200 logs/sec, concurrent), stores every game
  raw and tagged — both teams' six, brings, leads, observed moves/items/abilities, result, both
  ratings, and a bot flag. Appends only new games (dedup by id). Tested on 1,501 real ladder games.
- **Analysis over the store** (`engine/analyze.js`): usage model at any rating cutoff / humans-only,
  plus a personal split by Showdown username. Writes `data/meta-usage.json` for CHOMP.
- **`ME` alias list** so a Showdown rename is a one-word edit, never a re-pull.
- `tests/test-parse.js` — 12 hand-derived checks on the replay extractor (teams, leads, brings,
  observed set fields, bot flag, rating, date).
- Governance: LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, .gitignore, CI workflow.

### Validated
- High-ladder filter (humans, 1300+) reveals real signal distinct from the raw ladder — e.g.
  Kingambit 62% win, Incineroar 65% — confirming the tag-and-filter design earns its keep.

## [1.1.0] — 2026-07-22

### Changed
- **Reframed to its true scope.** ABRA is documented as the live-data platform whose purpose is to
  feed a simulator that models games and teams — a self-improving flywheel (collect → simulate →
  optimise teams → play with CHOMP → auto-ingest enemy teams → improve). CHOMP is one small early
  consumer, not the point. White paper §8 states the flywheel and the honest built-vs-roadmap status.

## [1.2.0] — 2026-07-22

### Added
- **Simulator research white paper** (`docs/ABRA-simulator-whitepaper.md`): an MIT-level treatment of
  learning a VGC battle simulator from logged replays. Formalises the game (POSG, imperfect info,
  simultaneous moves), derives three modelling tiers with their estimators and failure modes, frames
  team optimisation and the self-improving flywheel, and grounds every claim in the 2025 literature
  (PokéChamp, Metamon, VGC-Bench, ReBeL/Player-of-Games, Sampled/Gumbel MuZero, offline RL). Names the
  model family in the CHOMP/ABRA tradition — **JOLTEON** (fastest, win-prob),
  **MEDICHAM** (Rapidash, rollouts), **SLOWKING** (slow deep learned dynamics), **DITTO** (team
  optimiser) — speed of the Pokémon matches the cost of the model. Folds in CHOMP's pKO threat scoring
  as JOLTEON's features and MEDICHAM's dynamics (grey-box modelling).

## [1.6.0] — 2026-07-23

### Major finding
- **The Champions engine is OPEN, not closed** (`docs/OPEN-ENGINE-FINDING.md`). Verified by cloning
  `smogon/pokemon-showdown`: the exact format `[Gen 9 Champions] VGC 2026 Reg M-B` (and its Bo3
  variant) is in `config/formats.ts`, backed by a full `champions` mod (SP system in
  `data/mods/champions/scripts.ts`). This overturns the project's founding assumption. SLOWKING no
  longer needs to *learn* the dynamics — it can query the real engine (ReBeL over a known simulator),
  and MEDICHAM/DITTO/JOLTEON can use exact rollouts + self-play. SLOWKING white paper §3 corrected;
  roadmap task added to wire the engine as ABRA's simulator.

### Added
- **MEDICHAM runs in the browser** — the damage engine, type chart, sets, and behaviour-clone priors
  (96KB) are embedded in `web/index.html`; the rollout runs client-side (~40ms / 200 rollouts). The
  "MEDICHAM check" button and Medicham's run panel now work with **no server**. Validated: mirror
  0.53, rain-vs-sun 0.19 (matches the Node engine).
- **Combined team+rating predictor** (`engine/predictability.py` §2.5): the real pre-game ceiling is
  ~57% — combining team sheets AND player ratings does no better than team alone, confirming the game
  is variance-dominated (and that the two ~55%s are different axes that corroborate, not the same
  claim). Predictability study updated with the honest framing.
- **ABRA MCP server** (`mcp/`): exposes the models as tools Claude can call — `abra_win_probability`
  (JOLTEON), `abra_rollout` (MEDICHAM), `abra_threats`, `abra_species_stats`, `abra_optimize_team`
  (DITTO), `abra_coach_replay` (KADABRA). Local stdio server; `claude mcp add abra -- node mcp/server.js`.
- **Regulation registry + archive** (`data/regulations.json`, `build/archive-regulation.js`): the
  active regulation is a one-line config edit; ingest/analysis read it. When a reg ends,
  `archive-regulation.js` snapshots the store + all models into `data/archive/<id>/` (date-stamped,
  with a manifest) so previous-regulation data is preserved forever. `--rotate` starts a fresh store.
- **Mega Evolution** added to the game's action model (SLOWKING white paper §2) as a per-turn step.
- **Ditto page rebuilt**: team-builder on top + a live, sortable/searchable **threat rankings table**
  (usage / bring / lead / win% / speed) from the real stats; static chips removed.
- **Team carries between models** (localStorage), hover-× to remove a Pokémon / clear team, usage-
  ranked picker, in-browser MEDICHAM, lightning flash on JOLTEON, confetti idle-loop stopped.
- **Omnibus is now robust** (`build/omnibus.py`): always emits a self-contained HTML (SVG embedded
  directly, no LibreOffice), attempts the PDF only if `OMNIBUS_PDF=1` — reproduces the Special Cut
  reliably as the docs grow.
- New docs sewn into the Special Cut: predictability study, SLOWKING white paper + roadmap,
  architecture notes.

## [1.5.0] — 2026-07-23

### Added
- **Recency weighting (concept-drift decay)** in JOLTEON: every training game is weighted
  `w = 0.5 ** (age_days / τ)` with a half-life τ (default 30d), so the models track the *live*
  metagame instead of averaging over stale history. Normalised to mean 1 (L2 scale unchanged);
  `τ → ∞` recovers equal weighting. No-op on the current 2-day store (reported honestly);
  unit-verified on synthetic 90-day data (oldest 0.33, newest 2.14). Same rule applies to the usage
  model and behaviour-clone. Fully documented in `docs/ARCHITECTURE-NOTES.md`.
- **SLOWKING white paper** (`docs/SLOWKING-whitepaper.md`): the definitive Tier-3 design — offline
  belief-state search over a *learned grey-box model* of the *closed* Champions engine (residual over
  CHOMP), simultaneous-move mixed-Nash subgames, warm-started by the behaviour-clone. Grounded in
  ReBeL, Student of Games, PokéChamp (ICML 2025), Gumbel MuZero, Metamon. Plus a
  **research roadmap** (`docs/SLOWKING-research-roadmap.md`) turning it into five buildable papers.
- **SLOWKING Paper-1 built** (`engine/game-spec.js`): encodes stored replays into
  `(state, observation, action, reward)` trajectories — 30,608 real state-transitions with actions and
  terminal rewards. The offline dataset a Tier-3 solver trains on; a re-parse, never a re-pull.
- **Behaviour-clone + status/field MEDICHAM v2** (`engine/policy.js`, `engine/moves-meta.js`,
  `engine/medicham.js`): the rollout now samples *what real players click* (Tailwind 34% for
  Whimsicott, Fake Out 30% for Incineroar, …) and applies the effects — sleep, burn, paralysis,
  Tailwind (2× speed), Trick Room (inverted order), setup boosts, Protect. Speed control and setup are
  now *valued emergently*. Fixed a faint-and-replace symmetry bug (mirror back to ~0.50) and gated
  support on survival (don't set up into a KO). `tests/test-medicham.js`, `tests/test-dynamics.js`.
- **DITTO ported to Node** (`engine/ditto.js`): the whole live app now runs with **no Python**.
  JOLTEON scoring reimplemented in JS from the trained weights; **MEDICHAM wired in natively as the
  finalist re-ranker** (coarse-to-fine: JOLTEON proposes thousands, MEDICHAM decides the finalists).
  In a real run MEDICHAM overruled JOLTEON — chose the rain team (75.7%) over JOLTEON's tyranitar pick
  (68% grounded vs 79.8% JOLTEON). `server.js` `/api/ditto` now calls Node.
- **Local app + server** (`server.js`, `start.bat`, `app/`): the site is served from `app/` and runs
  the real engines on the user's machine (MEDICHAM/KADABRA/DITTO via Node, JOLTEON in-page). Lazy,
  robust Python probe (skips the Windows Store stub) kept only for optional JOLTEON *retraining*.
  Booth is searchable and usage-ranked; team-builder enlarged; live "MEDICHAM check" button.
- **Multi-format + open-sheet tags**, **dedup-by-replay-id everywhere** (never double-count a game
  reviewed or self-uploaded), **per-turn extractor + raw-log archive** (any new field is a re-parse).
- **ABRA WORLD website** with per-model "How X thinks" panels, teleporting-Abra background,
  usage-ranked sprite picker, PokéPaste input (accepts any species; off-roster treated as neutral).
- `docs/ARCHITECTURE-NOTES.md`: the Python/JS split rationale and the recency-weighting design, in
  detail.

### Changed
- Model labels describe the role (win probability, battle rollouts, team optimiser, replay coach,
  belief search, bring-4 engine), not the Pokémon name twice.

### Queued
- **ORB** — CHOMP's auto-fill mid-game calculator (the Life Orb of the CHOMP family): pulls your six
  (moves/items/EVs) and the opponent's revealed team from the live battle so there's nothing to type
  mid-game; opens in its own tab.

## [1.4.0] — 2026-07-22

### Added — the model family (the simulator, stages 2–3, now has working v1s)
- **Per-turn extraction** (`engine/durable-ingest.js` v2): the extractor now captures a per-turn
  event stream — move order (→ speed), exact damage % per move, faints, status, and reveals — on
  every game. Backfilled onto all 4,999 games: **30,611 turns, 55,336 damaging move events.**
- **Raw-log archive + `MODE=reparse`**: each raw `.log` is archived (`data/*.raw-logs.jsonl`), so any
  NEW field is a re-parse, never a re-pull. Proven by backfilling `format`/`openSheet` onto 4,999
  games with **zero network calls.** (Archive is gitignored; the extracted store carries the turns.)
- **Dynamics model** (`engine/dynamics.js` → `data/dynamics.json`): observed speed (who-moves-first,
  incl. Choice-Scarf hints) for 186 species, and observed damage distributions for 1,170
  (attacker, move) pairs. E.g. Garchomp Earthquake mean 57%, Basculegion Wave Crash 62.5%.
- **JOLTEON v2** (`engine/jolteon.py`): win-probability model gains **rarity-aware L2 shrinkage**
  (a species seen 25× is pulled toward neutral; seen 1000× is trusted — a measure-gaming guard at the
  model level) plus speed-edge and firepower-edge features from the dynamics model. Honest result:
  ~55% humans-only held-out vs ~49% coin flip; the dynamics features tie species-only (firepower
  earns weight +0.30, speed-edge is noise at this scale). Reported straight.
- **MEDICHAM built** (`engine/medicham.js`): Tier-2 Monte-Carlo rollout over CHOMP's exact damage
  engine. Rain core beats sun core 0.60; mirror 0.51; ~1s / 300 playouts. Sequential-singles v1
  (honest scope). `tests/test-medicham.js`.
- **DITTO built** (`engine/ditto.py`): team optimiser using JOLTEON as evaluator against a gauntlet
  of REAL ladder teams, double-oracle rounds, **usage-weighted threat coverage** (guarantees an
  answer to high-bring threats like Basculegion, ignores rare ones like Camerupt), and a **bias
  report** showing where rarity shrinkage suppresses a pick. Surfaces the measure-gaming failure honestly:
  JOLTEON-optimised "90%" team → MEDICHAM rollouts reveal ~12% → this is *why* Tier-2 vets Tier-1.
- **KADABRA v1 built** (`engine/kadabra.js`): turn-by-turn coach over a replay — reconstructs each
  scene, gives the speed read + damage read (cross-checked vs the ladder average, flags high/low
  rolls), draws the lesson, and background-appends the game (the flywheel from the coaching seat).
- **SLOWKING scaffold** (`engine/slowking.py`): Tier-3 interface fixed + data-readiness report;
  honestly flagged as a research effort, not a trained model.
- **Multi-format + open-sheet tags**: `FORMATS=` env supports collecting other ladders (e.g. the
  Reg-G best-of-3); every record now carries `format` and `openSheet` (bo3 / agreed open team sheet
  is a distinct information regime). 42 open-sheet games found in the current store.
- **ABRA WORLD website** (`web/index.html`): a Club-Penguin-styled interactive town — one room per
  model — with the JOLTEON win-probability model running live client-side (real embedded weights),
  sprite team pickers, animated odds meter, and links to the rest of the portfolio.
- Tests: `tests/test-medicham.js`, `tests/test-dynamics.js` (all green alongside parse + jolteon).

### Changed
- The flywheel's honest status advances: stages 2 (simulate) and 3 (optimise) now have working v1
  models (MEDICHAM, DITTO), with the tiered vetting (Tier-1 proposes, Tier-2 checks) demonstrated
  end-to-end. Tier-3 depth (SLOWKING) remains roadmap.

## [1.3.0] — 2026-07-22

### Added
- **JOLTEON v1 built** (`engine/jolteon.py`) — the Tier-1 win-probability model, a Bradley–Terry
  logistic over per-species strengths with a min-sample floor (anti-overfit). Trained on 5,000 real
  ladder games (temporal split, humans only). **Measured: 56.6% held-out accuracy vs 49.6% baseline**,
  Brier 0.251 (calibrated) — a real, honest, modest edge from team composition alone, as the domain's
  variance predicts. Ships a `predict` CLI and `tests/test-jolteon.py` (antisymmetry, mirror=50%,
  coverage, range). Model saved to `data/jolteon-weights.json`.
- **Full ladder pulled** — the durable store grew from 1,501 to **5,000 games** (incremental, dedup).

### Notes
- The first training on 1,501 games did **not** beat the baseline; more data (5,000) and a min-sample
  floor were what cleared it. Recorded honestly: this is why the flywheel (more games over time) and
  damage-grounded features (§4.3.1) matter, not species identity alone.
