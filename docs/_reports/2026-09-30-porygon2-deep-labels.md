# PORYGON2 v1-r2: deep labels on c1, then a refit (2026-09-30). PAUSED during labelling

**Verdict. Paused by Will during labelling. No fit was run, gate (a) was not read, no arena game was played and no
SPRT was started. Nothing landed. The labels written so far are intact and can be resumed.**

- Pre-registration: `solver/porygon2/v1/preregistration-r2.json`. It was committed at `c4035df6` before the full
  labelling run and amended at `e35100a5` after the crash, before any label was read into a fit.
- New flags, both off by default:
  - `label.js --train-only` labels only build.js's train-split games.
  - `label.js --resume-after <dir>` continues a stopped run.
  - `train.py --labelled-only <dirs>` cuts those directories' train and val rows to the rows that carry a label.
    Test rows are not touched.
- Smoke checks on `--labelled-only`:
  - All 82 timing-sample labels landed on train rows, with 0 off-train.
  - A deliberate break (c0's all-split labels under `--labelled-only`) reported 299 off-train labels, so the
    counter can see the failure.

## Pins
- **Release:** `eaa5becc54eb` (verify: intact).
- **Team store:** main's `data/team-pool-frozen-regmc`. `games.bo3.jsonl` sha256 is `a68263bb…`.
- **Corpus:** `p2v1-c1`. The manifest sha256 `de336bb2…` and the three shard sha256s match r1's record. The corpus
  was copied into this worktree's `solver/out/selfplay/eaa5becc54eb/p2v1-c1`.
- **Training inputs:** copied byte-identical (tree hashes checked) into `solver/out/p2v2/in/`:
  - the human `s0` build;
  - the ten earlier self-play builds;
  - v1's labels;
  - r1's three c1 builds.

## Labelling
- **Settings:** the report's label.js settings: k 6x6, 8 passes, chance 3, exact-depth 2, seed 1. Also
  `--per-game 3 --train-only`, 4 workers.
- **Timing sample:** 2.91 label-s per position, which predicted about 4.5-5 h. The real rate was 17-36 s per game
  per worker. Two things slowed it: the machine was paging, and after 05:00Z two python processes (the v2 job) and
  other agents' node processes were competing for the CPU.
- **Leg 1** (`solver/out/p2v2/labels-c1`): 22:37Z to about 03:28Z. It died with the machine and wrote no summary.
  It produced 10,434 labels on 3,207 games, and each shard ends on a whole game.
- **Leg 2** (`solver/out/p2v2/labels-c1b`, `--resume-after`): 05:03Z to 06:31Z. The workers were gone at 06:31:41Z,
  before its 07:15Z deadline, and no summary was written. It produced 1,228 labels on 374 games.
- **Across the two legs:** 0 duplicate labels and 0 games labelled in both legs.
- **Total:** 11,662 labels on 3,581 of about 8,000 train games. There were 0 search fallbacks and 0 errors in the
  progress lines read.

## OWED, NOT RUN

Resume from here. Leg 3 continues after leg 2's last game per shard. Use the same 4 workers. Leg 3 has about 0.1 h of
the 7 h cap left, so either accept the labels as they stand or amend the cap in the pre-registration first.

```
# (optional) leg 3 of labelling. Amend preregistration-r2.json's deadline first
node <lownode> solver/porygon2/v1/label.js --release eaa5becc54eb --selfplay solver/out/selfplay/eaa5becc54eb/p2v1-c1 --out solver/out/p2v2/labels-c1c --resume-after solver/out/p2v2/labels-c1b --workers 4 --per-game 3 --k 6 --passes 8 --chance 3 --exact-depth 2 --seed 1 --train-only --deadline <ISO>

# refit. First a 0-epoch count of the self-play train rows, to set --human-weight = round(1.40228 * SP_train / 119334, 2)
I=solver/out/p2v2/in; C=$I/c1/p2v1-c1-s0,$I/c1/p2v1-c1-s1,$I/c1/p2v1-c1-s2
python solver/porygon2/v1/train.py --data $I/human-s0,$I/sp/loop-sp9,$I/sp/loop-sp8,$I/sp/loop-sp7,$I/sp/loop-sp6,$I/sp/r3-sp0,$I/sp/p2v1-c0,$I/sp/r2-sp1,$I/sp/r2-sp0,$I/sp/gen1,$I/sp/gen0,$C --labels $I/labels/labels-0.jsonl,$I/labels/labels-1.jsonl,$I/labels/labels-2.jsonl,$I/labels2/labels-0.jsonl,solver/out/p2v2/labels-c1/labels-{0,1,2,3}.jsonl,solver/out/p2v2/labels-c1b/labels-{0,1,2,3}.jsonl --labelled-only $C --eval-exclude $I/sp/gen0,$I/sp/gen1,$I/sp/r2-sp0,$I/sp/r2-sp1 --arch attn --epochs 12 --threads 3 --lr 1e-3 --wd 1e-4 --dropout 0.1 --seed 1 --boot 2000 --block 2048 --bs 512 --human-weight <w> --name "PORYGON2 v1-r2" --out solver/porygon2/model/porygon2-v1r2.json --metrics solver/porygon2/model/porygon2-v1r2.metrics.json --fixture solver/out/p2v2/final/attn.fx.json

# gate (a): BOTH halves' upper 95% bounds of (r2 - gen5) log-loss must be < 0; otherwise stop. Report-only: compare.js r2 vs v1 and r2 vs r1 on v1's rows.
# gate (c), only if (a) passes. A fresh run from the pre-registration:
node solver/machamp/sprt.js --release eaa5becc54eb --x solver/porygon2/v1/gen5-p2v1r2.json --y solver/machamp/league/gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9101 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --info honest --out solver/out/p2v2/sprt/r2-vs-gen5.json
```
`<lownode>`: the harness refused `cmd.exe /c tools\lownode.cmd` from Bash. So the run used plain node, through a
wrapper that sets BELOW_NORMAL, which child processes inherit and whose exit code passes through. v1's 4,000-game
SPRT (seed 9103) was not chosen: it costs up to twice the refit's SPRT, so it is not cheaper. It stays owed.
