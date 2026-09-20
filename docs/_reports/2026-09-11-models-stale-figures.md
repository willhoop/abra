# MODELS.md — figures measured on superseded engine bytes, withdrawn. 2026-09-11 (MEASURE)

Scope: `docs/MODELS.md` and `docs/MODELS.pdf` only. No other document, no artifact, no git, no games
played, no refit. `tests/test-docs-current.js` deliberately NOT run (shared baseline, concurrent
agents). `tests/test-docs-quarantine.js` run — read-only — and green.

## 1. Why this pass existed, and what the instruments say today

`node engine/quarantine.js` reads **GATE: OPEN — MEDICHAM passes both conditions; nothing is
withheld**. The same run prints:

> `69 of 258 artifacts are downstream of MEDICHAM and are now RE-RUNNABLE. They are NOT withheld and
> they are NOT current — every one was measured under an engine that has since changed, so each must
> be re-run before it is quoted (ROADMAP #57)`

So the withholding machinery no longer accuses any of these figures. `tests/test-docs-quarantine.js`
passes **vacuously** and says so in its own output: *"THE GATE IS OPEN — nothing is quarantined today,
so this clause can accuse nothing. That is a fact about the gate, not about the documents."* Its four
RED plants still behave (they fire on a planted `51.0%`), so the test is alive; it simply has nothing
to charge while the gate is open. **A figure that was withheld yesterday is therefore un-flagged today
and still not true.** That is the hazard this pass addressed, and it is the reason the work could not
wait for an instrument to point at it.

Will's standing instruction is that the re-runs are NOT done now (2026-08-11, *"Dont re run the
artifacts weve bene over this"*). Nothing here re-runs anything.

## 2. The rule applied

A figure in `docs/MODELS.md` is **WITHDRAWN** — deleted, not captioned — if it is the output of a
model that was produced by playing games or fitting features through `engine/medicham2-browser.js`,
AND either

- its artifact is on the 69-artifact downstream list `engine/quarantine.js` prints (so it was measured
  under an engine that has since changed), or
- **no artifact on disk holds it**, so the bytes it was measured on cannot be identified.

A figure **STAYS** if it measures MEDICHAM itself (the engine-correctness instruments), or is stamped
with the current release `534442d71183`, or is a store/corpus census with a cited artifact that reaches
no simulator.

In every withdrawal the sentence stays and says what was measured, why the number is gone, and that it
has not been re-run. No strikethrough anywhere.

## 3. Provenance, derived per figure (not assumed)

### The figures named in the brief

| figure | artifact that holds it | engine bytes | verdict |
|---|---|---|---|
| `speedSwing` / `screenValue` / `healValue` weights + CIs | `data/policy-weights.json` — **no release id in the file at all** (`fitEnvironment`, `featureHashes`, nothing naming a release); on the downstream list | fitted 2026-08-05, simulator rewritten since | WITHDRAWN |
| choice-lock share of items; 222 → 239 switch events | **no artifact** — `grep` over `data/*.json` finds neither figure in any MAG artifact | fit + greedy self-play, 3.29.0 era | WITHDRAWN |
| opponent model: damaging-move rate, two feature falls, board count | **no artifact** — `data/opponent-calibration.json` (2026-08-03) holds ECE/Brier/bins and **none** of these; its generator requires `board.js` | superseded | WITHDRAWN |
| covariate shift: team gap, behaviour gap, per-weight SE moves | team/behaviour gaps are inside `data/policy-weights.json`'s `covariateShift.note`; the SE moves are in **no** artifact. `engine/corpus_shift.js` requires `board.js` (line 37) | no release id; downstream | WITHDRAWN |
| MEW mirror symmetry + interval + battle count | **no artifact** — `engine/validate_selfplay.js` prints and writes nothing; `data/mew.js` is on the downstream list | unidentifiable | WITHDRAWN |

**Extra finding on the weight table.** The three published weights did not match the artifact on disk
either. `data/policy-weights.json` today reads `speedSwing` 0.8040, `screenValue` 1.0453,
`healValue` 2.8327 (with standard errors 0.0242 / 0.0422 / 0.0982) against a table printing
+0.983 / +1.128 / +2.220. The published table was not merely stale against the engine; it was stale
against its own artifact.

### The sweep — everything else of the same class

Withdrawn, same rule, same reason:

- MILTANK's deferred-decision share under time pressure — `data/miltank-timing-r6.json`, which stamps
  `medicham2-browser.js: b1b3ea94d5c3` (2026-08-04) and has **no discoverable writer**.
- The learned leaf evaluator against the count-bodies-and-HP baseline — `data/leaf-comparison.json`,
  which declares itself *"an ad-hoc MEASURE analysis; NO generator script is committed for this
  file… do not quote it after the value net or the leaf moves"*. The leaf has moved.
- The live leaf's accuracy quoted beside the value net's 66.92% in-sample ceiling.
- MEDICHAM's honest-status line: the mirror value, the rollout count-and-latency pair, the spread.
- `tests/test-medicham.js`'s mirror-symmetry value; DITTO's `medichamRank` value.
- The click matcher's cause shares and its slot-level match rate before/after.
- `board.dmgMon.unknownSpecies` before/after shares.
- The switch-in ability sweep: sweep size, the `levitate` control's count, the three post-fix counts.
- The greedy bot's super-effective rate; MAG's four motivating clone-vs-human rates.
- DODUO: the two held-out figures behind "force the 18 to zero and it is the same player"; the
  double-target pair (MAG's and the humans'); the non-zero-joint-vector count out of 72; the
  choice-lock share repeated in that section; the retired double-target figure named in the
  `Code:`-line aside.

Kept, and why:

- Everything in the 7.0.0 head block — board-material 0 of 961, narration 0, 10,705 boundaries,
  `engine-diff` 6,000/6,000, the three roster stages, census 883/883, the staged harness — **stamped
  release `534442d71183`**, and each measures MEDICHAM rather than consuming it.
- `data/damage-validation.json` (regenerated 2026-09-10): 36 scenarios, within 5% on 100%, worst 0%.
- The CHAMPIONS_SIM speed block and the rollout-cost profile: they measure MEDICHAM itself and carry
  release ids (`fb0058fb5702`, `13257c8bc397`) with artifacts under `data/verification/`.
- Non-simulator model artifacts with cited fields: XATU belief (`1.9889` etc. verified field-for-field
  against `data/xatu-belief.json`), XATU context, GURU, SLOWKING's preview-Nash table, WAR, ROLES,
  NMF, COUNTERS, CORES, BRING PRIORS, SPECIES SETS, META-USAGE, MOVE PRIORS, DYNAMICS, COUNTERPLAY,
  `data/policy-eval.json` (re-run 2026-09-09, plays no game), `data/chomp-ev.json`, `data/pory-eval.json`.
- `data/value-net.json`'s two scored fields, verified on disk: `test_logloss` 0.65364,
  `test_brier` 0.23062. Store-derived; `engine/train_value.py` plays nothing.
- The dated per-release blocks (5.2xx.0 and earlier) are dated engine-state evidence, not model
  output, and are not rewritten in place.

## 4. Grandfathered figures bound or withdrawn where a withdrawal touched them

Three sentences carried untraceable figures alongside a withdrawn one:

- The value-net paragraph's accuracy, coin and alive-count baselines were already marked as absent
  from the artifact by an earlier pass; the withdrawal beside them (the live leaf's accuracy) is now
  explicit, and the two figures the artifact does hold are named with their fields.
- The click-matcher sentence withdrew its own shares; the surviving clause cites `engine/click_match.js`
  as the fix site rather than a number.
- The DODUO `Code:`-line aside no longer prints the retired double-target figure it was describing.

Still printed and **not** of this class, flagged rather than touched: JOLTEON's held-out accuracy and
log-loss (`engine/eval_harness.py`, no simulator, no artifact cited) and the value net's accuracy and
baselines. Both are traceability debts, not engine-bytes debts. They are owed a citation or a
withdrawal in a later pass and are named here so they are not discovered as a surprise.

## 5. What was NOT done

- No re-run of anything. ROADMAP #57 is unchanged and no shorter.
- `node engine/status.js --write` NOT run: it stamps generated blocks in ledgers other agents hold
  this pass. `docs/MODELS.md` has no `<!-- GENERATED -->` block, so nothing here is owed a restamp.
- The document's version header is left at 7.0.0; the coordinator assigns the version.
- `docs/MODELS.pdf` rebuilt from the edited markdown (2,333 KB, chrome.exe).
