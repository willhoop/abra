# MACHAMP unattended loop — warm-start recipe — one section per generation

Written by `solver/machamp/loop_sprt.js --recipe warm` under `solver/machamp/preregistration-warm.json`. Historical by construction.

**Why.** gen6 (H0 after 166 games, 0.434) and gen7 (H0 after 652 games, 0.489) failed the SPRT against gen5, and each
restarted training from MAG v1 + DODUO v1 and PORYGON2 v0 (`docs/_reports/2026-09-25-machamp-loop.md`).

**Recipe (pre-registered before generation 8's first game).**
- Warm start: MAG/DODUO and PORYGON2 from the current champion's files. Learning rate DODUO 1e-4 (was 3e-4), PORYGON2
  1.5e-4 (was 5e-4). Epochs unchanged (3 and 6).
- Recency: a self-play directory played by the current champion (its manifest's `league.current` digests equal the
  champion's files) carries sample weight 3, every other 1, normalised to mean 1 on self-play train rows.
- DODUO's pull to the human clone is unchanged: β 0.7, human weight 3.0, anchor DODUO v1. The +0.05-nat selection
  tolerance is measured from the clone's human val NLL, not the warm init's.
- PORYGON2 target unchanged: 0.5·z + 0.5·v_deep (4 rollouts × 3 turns of DODUO-v1 play, frozen PORYGON2 v0 leaf).
- The search's fallback decisions (table too empty to solve, or the search threw) are recorded from generation 8 on and
  are DODUO targets on the played joint. The seven earlier directories never recorded theirs (loop-sp7 lost 14).
- Gates and the SPRT are the loop's, unchanged: elo0 0, elo1 +20, α = β = 0.05, ≤ 2,000 games, vs the CURRENT champion.
- Stop after two consecutive SPRT failures.

**Run.** Release `eaa5becc54eb`; team store `data/team-pool-frozen-regmc` (main checkout, read only); 3 workers. The
seven earlier self-play directories and their deep values are read, read-only, from the worktree that played them
(`.claude/worktrees/agent-aab7de2f53411dba8/solver/out/`), through directory junctions.

## gen8 — rejected (2026-09-26T03:04:26.358Z)

- Self-play: `solver/out/selfplay/eaa5becc54eb/loop-sp8`, 1000 games, 732.6 games/hour, 1.33% cells empty.
- Pool: 8 self-play directories, 106122 DODUO decisions, 70464 PORYGON2 positions (all with a deep value: 70464).
- **SPRT vs gen5** (elo0 0, elo1 +20, α = β = 0.05): **H0 — X is not stronger (elo0 = 0 accepted)**, LLR -3.08, 142 pairs = 284 games; 132–152 = 0.465 [0.408, 0.523] (Wilson at the stop, slightly optimistic).
- Human clone: 0.735 [0.670, 0.791] (PASS). PORYGON2 human log-loss vs v0: -0.0048 [-0.008, -0.002] (PASS).
- DODUO drift from the human clone: 0.0077 nats.
- Champion after: `solver/machamp/league/gen5.json`.
- Recipe: warm start from `solver/machamp/league/gen5.json`; lr DODUO 0.0001, PORYGON2 0.00015; champion self-play weight 3 on solver/out/selfplay/eaa5becc54eb/loop-sp6, solver/out/selfplay/eaa5becc54eb/loop-sp7, solver/out/selfplay/eaa5becc54eb/loop-sp8; fallback decisions in the DODUO targets: 38; selected epochs DODUO 0, PORYGON2 5.
