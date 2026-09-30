# PORYGON2 v2 — trained, gate (a) read once: FAIL (2026-09-30)

SOLVER. abra/regmc 1.47.0, branch `worktree-agent-ab8ab0c3767cc90fc`. No game was played. Every run was at BelowNormal.

## Verdict

- **Gate (a) FAILS, by the pre-registered rule, by a hair.**
  - The pooled Δ = log-loss(v2) − log-loss(v1) is **−0.0098 [−0.0202, +0.0002]**. The upper bound must be below 0, and it is +0.0002.
  - It is measured on 1,521 bo3 test games that v1 never saw (10,728 positions, paired on game id and turn).
  - Both gating bands have a point estimate ≤ 0. Below 1100 (575 games): −0.0165 [−0.0349, +0.0017]. 1100–1199 (413 games): −0.0014 [−0.0172, +0.0157].
  - Consequences: v2 does not land, gate (c) is not pre-registered, and no league file names v2.
- **v2 beats gen5's net outright**: −0.0127 [−0.0202, −0.0048]. That comparison is reported only; it does not gate.
- **Calibration.** 10-bin ECE is v2 0.018, v1 0.017, gen5 0.018. Brier is v2 0.1740, v1 0.1777 (Δ −0.0037 [−0.0074, +0.0001]).
- **Datasets after the rebuild.** Game-shape codes are now recorded, not charged (Will, 2026-09-30).
  - bo1: **41,989 games / 286,770 positions**.
  - bo3: **36,232 / 251,760**.
  - The leak test stays GREEN 222,895/222,895, and RED under both breaks.

## 0. The quality rule is called, never copied

`solver/human/build_dataset.js` and `solver/meta/extract.js` no longer carry their own bot rule. They build each game's
store row (durable-ingest `extract()`) and call `engine/quality.js` `reasons(g, cfg, behaviouralBots(...))`.

**Measured.**
- The full bo3 human stream (`solver/out/porygon2-v2/gate-human`, 271 shards) is charged **0** behavioural-bot games.
  The copy of the rule charged 321 games on the 203-shard stream (`solver/out/human/manifest.json`).
- The meta extract flags 7 bot accounts, and none of them in bo3.

**Decision (Will, 2026-09-30).** In the value-net datasets, the game-shape codes `forfeit_no_action`, `short` and
`partial_bring` do not exclude a game, because forfeits and short games are real outcomes. Each kept row records its
reasons in `quality_reasons`.
- Bots, illegal teams, custom-rule rooms, own accounts, Illusion rooms and pre-Eject-Button-fix games stay excluded.
- `build_dataset.js` and `meta/extract.js` count the same three codes without charging them.
- **The human decision dataset `solver/out/human` was NOT rebuilt.** v2's `v1_unseen` flag is keyed on its manifest.
  Rebuilding it is owed to MAG/DODUO's owner. On the first 3,000 bo3 rows, charging those codes would have removed
  1,016 games for `partial_bring` alone.

| | bo1 | bo3 |
|---|---:|---:|
| store games | 59,752 | 37,526 |
| kept games / positions (shape codes recorded, not charged) | 41,989 / 286,770 | 36,232 / 251,760 |
| train / val / test games | 26,266 / 7,231 / 8,492 | 23,488 / 5,951 / 6,793 |
| bo3 test games with `v1_unseen`, by min rating band | | <1100 577, 1100–1199 413, 1200–1299 160, ≥1300 82, unrated 294 |

Before the decision, with the codes charged, the build kept bo1 27,603 / 222,744 and bo3 25,295 / 200,620 (behavioural
bots bo1 15 → 7, bo3 8 → 0). The manifests are `solver/porygon2/v2/manifest-bo1.json` and `manifest-bo3.json`. The store
sha256 is unchanged (bo1 `341e5953c4c7`, bo3 `3e5affee9991`).

## 1. Encoder, net, trainer

- **`solver/porygon2/v2/features.js`.**
  - Both producers end in v1's own H, so v1's MEDICHAM per-token facts are reused unchanged, on release `eaa5becc54eb`.
  - The body builder fills nothing. It uses known moves only, the known item or none, and `noability` for an unknown
    ability. A member with no known move still gets a body, so it has a speed and can be hit.
  - Ids have `<UNK>` distinct from `<NONE>`, plus 9 reveal numbers per token.
  - No action history (shield streak, turns in, PP, lock). The engine producer blanks the same fields.
  - UNK share of member fields: bo1 stage-A draws 68%, bo3 stage-B draws 21%.
  - `solver/tests/test-porygon2-v2-features.js`: **GREEN 70,591/70,591**. It is RED under `PORY2V2_FEAT_BREAK=fill` (NOFILL)
    and `=history` (ENGINE).
- **`encode.js`**: tensors in 4 shards per format, under `solver/out/porygon2-v2/<fmt>/tensors/`.
- **`net.py`**: 17 tokens, 2 pre-LN blocks, d 48, 4 heads, FFN 96. The rating context is added to every query
  (Maia-2 form). The value is antisymmetric by chair swap. Auxiliary heads are as designed. 109,716 parameters.
- **`train.py`**: stage A, then stage B with 25% bo1 replay. The auxiliary weight is frozen after 200 steps at 25% of the
  main gradient (0.0234 for K=1). A checkpoint is written every epoch, with resume.
- **CPU.** No GPU; torch 2.14+cpu. The machine is CPU-starved at BelowNormal: about 2 ms per position forward, single
  thread, and one thread measured fastest.
- **Pre-registered before any stage-B model existed** (commits b8652d23, d53258e3, 2ec5e92b):
  - addendum `a`: the gate (a) protocol and v1 named by sha256;
  - addendum `b`: the data after Will's rule;
  - addendum `c`: fixed validation rows and a stop after 6 epochs without improvement.

## 2. Training (validation only; the test split untouched until gate (a))

| arm | A: bo1 val (epoch) | B: bo3 val (epoch) |
|---|---:|---:|
| **K = 1 (selected)** | 0.5474 (8) | **0.5063** (8) |
| K = 2 | 0.5508 (4) | 0.5075 (6) |
| K = all | 0.5552 (0) | 0.5120 (1) |
| K = 1, no aux | 0.5496 | 0.5092 |
| K = 1, no rating | 0.5503 | 0.5090 |
| K = 1, no pretrain | — | 0.5090 |

- K = 1 won on bo3 validation, as pre-registered.
- **AlphaGo diagnostic** (train sample minus val). K=1 B: −0.04. K=all A reached −0.17 by epoch 4. Training on every
  position memorises outcomes, as AlphaGo reported.
- The metrics are in `solver/porygon2/v2/model/porygon2-v2-k1.stage{A,B}.metrics.json`. The runs are in
  `solver/out/porygon2-v2/runs/`, also copied to the main checkout's `solver/out/porygon2-v2/`.

## 3. Gate (a) — `solver/porygon2/v2/gate-a.json`

- **Models.** v2 = `runs/k1/B/model.pt`, exported to `solver/porygon2/v2/model/porygon2-v2-k1.json`
  (sha256 `d5409446cb6f…`). v1 = `solver/porygon2/model/porygon2-v1.json` (`01bb559ef0e7…`).
- **v1's scores.** `solver/porygon2/v2/score_v1.js` produced them through v1's own `fromDataset → encode` path, on the
  human dataset built from the same raw shards. It scored 1,521 of the 1,526 eligible games; 5 were dropped by the human
  builder.

| | log-loss | Brier |
|---|---:|---:|
| v2 | 0.5132 | 0.1740 |
| v1 | 0.5230 | 0.1777 |
| gen5 | 0.5258 | 0.1793 |
| count-HP logistic | 0.5702 | |
| **v2 − v1** | **−0.0098 [−0.0202, +0.0002]** | −0.0037 [−0.0074, +0.0001] |
| v2 − gen5 | −0.0127 [−0.0202, −0.0048] | |
| v2 with both ratings UNRATED − v1 | −0.0067 [−0.0169, +0.0034] | |

| min rating band | games | v2 − v1 | gates |
|---|---:|---:|---|
| <1100 | 575 | −0.0165 [−0.0349, +0.0017] | yes |
| 1100–1199 | 413 | −0.0014 [−0.0172, +0.0157] | yes |
| 1200–1299 | 157 | −0.0120 [−0.0470, +0.0188] | no (<200) |
| ≥1300 | 82 | +0.0154 [−0.0307, +0.0693] | no (<200) |
| unrated | 294 | −0.0152 [−0.0338, +0.0034] | not a band |

**By turn.** Turns 1–3: −0.0126 [−0.0225, −0.0029]; v2 is better there. Turns 4 and later: −0.0078 [−0.0205, +0.0057].

**Ablations** (same positions; each minus the selected v2):

| ablation | minus v2 |
|---|---:|
| K=2 | +0.0002 |
| K=all | +0.0013 |
| no aux | +0.0017 [−0.0009, +0.0044] |
| no rating | +0.0020 [−0.0015, +0.0058] |
| no pretrain | +0.0024 [−0.0020, +0.0071] |

Every ablation is worse, and none is significantly worse.

**The bo1 test split, v2 alone** (diagnostic). Pooled 0.549 [0.540, 0.558], ECE 0.028. Both players at 1500 or above:
117 test games. By min rating band: 1500–1599 is 0.599 (n = 110) and ≥1600 is 0.663 (n = 7).
- **Correction.** The `both_at_least_*` fields counted unrated games. They are marked WRONG in `gate-a.json` and are not
  reported. `gate_a.py` is fixed. The verdict is unaffected.

**Auxiliary losses on the eligible positions:** survival 0.416, HP 0.270, material 1.595, HP difference 0.085, next faint
side 1.039, delay 1.034, turns left 1.204.

**Process note, stated because it matters.** The first launch of `gate_a.py` was killed about a minute in, before any
line or file of output existed and before anything was read. It would have scored the no-rating ablation with ratings
supplied. The fix is to read a `--no-rating` model with ratings UNRATED. The gate then ran once.

## 4. What exists but is not on any arm

The Node forward pass, the export and the leaf are built. The v2 leaf is inert: no league file names a v2 model.
- `solver/porygon2/v2/infer.js` is the Node forward pass. `export.py` writes the model JSON and the parity fixture.
- `solver/porygon2/v2/leaf.js` is the v2 leaf. Its counter is `counters.evals`. Its rating query defaults to [1600, 1600].
- `solver/porygon2/leaf.js` dispatches arch `v2-transformer` to it. v1 and v0 files still dispatch as before.
- `solver/tests/test-porygon2-v2.js --leaf` is **GREEN 32/32**.
  - Node agrees with Python within 8.9e-16. It is antisymmetric, and member order does not matter.
  - A MILTANK decision served 18 v2 leaf evaluations.
  - It is RED under `PORY2V2_INFER_BREAK=rating`.
- **Gate (c) is NOT pre-registered.** Gate (a) failed.

## 5. Where the edge is, and what would move it

- The edge over v1 is real at the point estimate and one-sided in the gating bands. It is concentrated in turns 1–3, below
  1100 and in unrated games.
- v2 loses at ≥1300, on 82 games. That is exactly where the bo3 data is thin.
- The interval misses by +0.0002. More v1-unseen games will narrow it: every new raw shard is v1-unseen. This is a
  statement about the next read, not a re-read of this one.

## OWED, NOT RUN

1. **Re-read gate (a) later**, on a fresh set of v1-unseen games collected after this run. It needs a new
   pre-registration naming the shards cut after 2026-09-30, and the same model file (`porygon2-v2-k1.json`, sha256
   `d5409446cb6f…`). No re-training is needed to take that read.
2. **Rebuild `solver/out/human` under the new quality call.** The human dataset's owner decides whether to charge the
   game-shape codes. MAG/DODUO must be refitted after it, and v1's `v1_unseen` bookkeeping moves with it.
3. **Stage C** (search targets) was not run. It depends on the v1 deep-label result, and 1.46.0 records that gate (a)
   failed there too.
4. **Gate (c) SPRT**: only after gate (a) passes. The commands, for when it does, with the league file still to be written:

```
REM cost bar first (the same 300 positions; v2 at most 1.5x v1's median)
cmd.exe /c tools\lownode.cmd solver\porygon2\v1\bench.js --release eaa5becc54eb --selfplay solver\out\selfplay\eaa5becc54eb\p2v1-c1 --models solver\porygon2\model\porygon2-v1.json,solver\porygon2\v2\model\porygon2-v2-k1.json --positions 300 --reps 3 --out solver\out\porygon2-v2\bench.json
REM league file solver\porygon2\v2\gen5-p2v2.json = gen5-p2v1.json with "pory2": "solver/porygon2/v2/model/porygon2-v2-k1.json"
cmd.exe /c tools\lownode.cmd solver\machamp\sprt.js --release eaa5becc54eb --x solver\porygon2\v2\gen5-p2v2.json --y solver\porygon2\v1\gen5-p2v1.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9301 --workers 3 --team-store C:\Users\willj\Projects\Pokemon\ABRA\data\team-pool-frozen-regmc --info honest --out solver\out\porygon2-v2\sprt-v2-vs-v1.json
cmd.exe /c tools\lownode.cmd solver\machamp\sprt.js --release eaa5becc54eb --x solver\porygon2\v2\gen5-p2v2.json --y solver\machamp\league\gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9302 --workers 3 --team-store C:\Users\willj\Projects\Pokemon\ABRA\data\team-pool-frozen-regmc --info honest --out solver\out\porygon2-v2\sprt-v2-vs-gen5.json
```

5. `node engine/status.js --write` from the main checkout after merge (not run here: this is a worktree).
