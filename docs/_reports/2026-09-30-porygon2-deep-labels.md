# PORYGON2 v1-r2: deep labels on c1, then a refit (2026-09-30)

**Verdict. Gate (a) FAILS on the human half, so no arena game was played and nothing landed.**

| gate (a) half | r2 − gen5 log-loss (95% CI, bootstrapped by game) | result |
|---|---|---|
| human | **−0.0044 [−0.0086, +0.0002]** | FAIL: the upper bound is not below 0 |
| self-play | **−0.0131 [−0.0178, −0.0084]** | pass |

- **Against v1**, on v1's own test rows (report-only, `compare.js`), r2 − v1:
  - human **+0.0033 [+0.00004, +0.0068]**: r2 is still worse than v1 on human positions;
  - self-play −0.0048 [−0.0101, +0.0006].
- **Against r1** on the same rows, r2 − r1:
  - human −0.0012 [−0.0042, +0.0017];
  - self-play +0.0032 [−0.0032, +0.0089].
- **Gate (c):** not run, as pre-registered.
- **Not run for landing:** test-porygon2-v1 and run_breaks were not run on r2, because nothing lands.
- **gen5 is unchanged.** Neither `gen5.json`, the league nor ROTOM names r2.

**Reading.** Moving from cheap to deep labels, and from 61,000 cheap rows to 13,414 labelled rows, recovered part of
r1's loss on human positions (r2 − r1 human −0.0012, which is not significant). It did not get back to v1. The
self-play gain is real in both refits. Adding self-play data of any label quality has not improved the human half,
which is the half gate (a) fails on. v1 remains the best PORYGON2 on human positions, and its own SPRT is still
INCONCLUSIVE at 2,000 games.

## Pre-registration
- `solver/porygon2/v1/preregistration-r2.json`. It was committed at `c4035df6` before the full labelling run, and
  amended at `e35100a5` and `f04e2745`. Both amendments were made after a stop and before any label was read into a
  fit.
- **Gate (a) rule:** both halves' upper 95% bounds must be below 0.
- **Gate (c):** the v1/r1 SPRT (elo0 0, elo1 20, α = β = 0.05, max 2,000, seed 9101, gen5, 1,000 ms per decision,
  honest). Its spec is `solver/porygon2/v1/gen5-p2v1r2.json`.

## Pins
- **Release:** `eaa5becc54eb` (verify: intact).
- **Team store:** main's `data/team-pool-frozen-regmc`. `games.bo3.jsonl` sha256 is `a68263bb…`.
- **Corpus:** `p2v1-c1`. The manifest sha256 `de336bb2…` and the shard sha256s `9f867ba0…`, `82c2ad29…` and
  `f9235d8e…` match r1's record. The corpus was copied into this worktree.
- **Training inputs:** copied into `solver/out/p2v2/in/` and checked byte-identical by tree hash:
  - human `s0`, from worktree `a0e24792`;
  - the ten earlier self-play builds and v1's 5,466 labels, from the same worktree;
  - r1's three c1 builds, from worktree `a42a8c84`.
- **Heavy runs:** the harness refused `cmd.exe /c tools\lownode.cmd` from Bash. The runs used plain node through a
  scratch wrapper that sets BELOW_NORMAL, which child processes inherit and whose exit code passes through.

## Labelling (`label.js`)
- **Settings:** the report's settings (k 6x6, 1 reserved switch row, 8 passes, both seats, chance 3, exact-depth 2,
  seed 1, gen5 leaf/MAG/DODUO). Also `--per-game 3 --train-only`, 4 workers.
- **Timing sample:** 82 labels at 2.91 label-s per position, which predicted about 5 h. The real cost was 17-36 s per
  game per worker (deep p90 about 16 s). The machine was paging, and from 05:00Z the v2 job and other agents'
  processes held most of the cores.

| leg | window (UTC) | labels | games | end |
|---|---|---|---|---|
| `labels-c1` | 22:37 to ~03:28 | 10,434 | 3,207 | died with the machine; no summary; every shard ended on a whole game |
| `labels-c1b` (`--resume-after`) | 05:03 to 06:31 | 1,228 | 374 | workers gone at Will's pause; no summary |
| `labels-c1c` (`--resume-after`) | 07:53 to 09:35 | 1,752 | 542 | 09:35 deadline, summary written, 0 errors, 0 search fallbacks |
| **total** | about 8.0 h | **13,414** | **4,123** | 0 duplicate labels and 0 games shared between legs |

- **Kinds:** 11,740 deep, 1,659 deep2 and 15 exact.
- **Receipts:** `solver/results/2026-09-30-porygon2-deep-labels/labels-receipt.json` holds a sha256 for every file.
- **A small defect:** the coordinator's summary sums `resumed_after` as a string across shards. It is cosmetic, and
  the per-shard values are correct in the log.

## Refit (`train.py`)
- **Command:** `--arch attn --epochs 12 --threads 3 --lr 1e-3 --wd 1e-4 --dropout 0.1 --seed 1 --boot 2000
  --block 2048 --bs 512 --human-weight 1.16 --labelled-only <c1 builds>`, with v1's eval-exclude. The full list is
  in `porygon2-v1r2.metrics.json` `flags`, and the log is in `train.log`.
- **Labels read:** 18,880, all 18,880 matched to a row; the c1 train rows (4,490 + 4,389 + 4,535) = 13,414.
- **Mix:**
  - 217,847 train rows: human 119,334 at weight 1.16, self-play 98,513;
  - human share of the weight 0.584, v1's 0.5837;
  - r1 had 265,423 rows and a 0.45 human share.
- **Selection:** epoch 7, combined validation loss 0.47259. Wall time 37 min.
- **Model:** `solver/porygon2/model/porygon2-v1r2.json`, sha256 `902f7c69…`. It is not promoted.

| by turn, r2 − gen5 | human | self-play |
|---|---|---|
| 1 | −0.0022 [−0.0066, +0.0023] | −0.0078 [−0.0148, −0.0007] |
| 2 | −0.0056 [−0.0109, −0.0004] | −0.0101 [−0.0177, −0.0028] |
| 3 | −0.0105 [−0.0159, −0.0051] | −0.0064 [−0.0143, +0.0014] |
| 4-5 | −0.0083 [−0.0139, −0.0028] | −0.0115 [−0.0185, −0.0043] |
| 6-8 | −0.0036 [−0.0105, +0.0034] | −0.0157 [−0.0233, −0.0076] |
| 9+ | +0.0120 [−0.0101, +0.0396] | −0.0289 [−0.0441, −0.0137] |

**Brier and calibration:**
- Brier r2 − gen5: human −0.0019 [−0.0035, −0.0001]; self-play −0.0041 [−0.0060, −0.0023].
- ECE r2 / gen5: human 0.0127 / 0.0065; self-play 0.0149 / 0.0208.

## v1's 4,000-game SPRT
Not run. It costs up to twice the refit's SPRT, so it is not cheaper. It is still owed (below).

## OWED, NOT RUN

```
# v1 (not r2) gate (c) to a decision: the same SPRT, a fresh seed, a larger budget. Pre-register first.
node solver/machamp/sprt.js --release eaa5becc54eb --x solver/porygon2/v1/gen5-p2v1.json --y solver/machamp/league/gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 4000 --seed 9103 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --info honest --out solver/out/p2v1r/sprt/v1-vs-gen5-4000.json

# r2's gate (c). NOT to be run: gate (a) failed. Listed only so the pre-registration is complete.
# node solver/machamp/sprt.js --release eaa5becc54eb --x solver/porygon2/v1/gen5-p2v1r2.json --y solver/machamp/league/gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9101 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --info honest --out solver/out/p2v2/sprt/r2-vs-gen5.json
```
The rest of `p2v1-c1`'s train games (about 3,900) are unlabelled. More labels of the same kind are not recommended:
two refits have now failed to improve the human half.
