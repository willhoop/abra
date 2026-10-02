# MEDICHAM speed pass (solver/PLAN.md N3): three byte-identical batches landed, PAUSED by Will before the gate

ENGINE, 2026-10-02. Main checkout, Reg M-C. Paused on Will's instruction after batch 3; the gate re-run was stopped
part-way and its artifacts were reverted, so **no gate verdict exists for the new engine yet** (owed, below).

## Verdict

- **Landed, each committed with its Record and pushed:** 1.77.1 (`volSeqSync`), 1.77.2 (`sideWiped`), 1.77.3
  (`legalActions`' counter restore in `engine/medicham_api.js`). One rejected and reverted before commit (a last-hit
  cache in `engine/tags.js` lean view: ×0.99, no gain).
- **Speed, paired same-process A/B against `2b0e43e3` (pre-pass), wall time, 300 Reg M-C human-sheet games at
  observed-v1 spreads:**
  - an engine turn (`stepInPlace` only): lean ×1.27 / ×1.26 / ×1.22 block median over three runs; full ×1.15 / ×1.16;
  - a game loop that reads the menu every turn (two `legalActions` + one step): ×3.2 lean, ×2.1 full (batch 3 alone);
  - a ladder-shaped MILTANK playout (k 4×4, depth 0, gen5 PORYGON2 leaf, quiescence on): **×1.07** (three runs,
    1.071 / 1.071 / 1.074 block median); heuristic leaf, depth 1: ×1.09. The cell values hash equal on both arms.
- **The honest reading: the single-thread pass is a ~7% win for the search, not 2×.** A ladder playout is ~61% engine
  turn, ~28% PORYGON2 leaf (SOLVER's features, which themselves call `dmgRange`) and ~6% world copy. Inside the turn
  the profile is flat: the hottest single line is ~1.3% of a turn.
- **Identity, per batch:** whole-battle digest (`medicham_api.digestString`) after every turn, full AND lean, 5,624
  turns; winners and per-stream draw counts equal; play-phase deltas of MEDSEEN, MEDFAILS and tag `hits`/`asked` equal
  (`9efb59cf8f96fef7` on every batch). `solver/bench/playout_bench.js` hashes unchanged (batch 1). `tests/test-medicham-api.js`
  GREEN with its 3 breaks red (batch 3).

## Profile (lean turn workload, `--cpu-prof`, self time inside `stepInPlace`)

Before batch 1: `battleTurnBody` self ~20% + `battleTurn` call line ~6% (diffuse, see below), `volSeqSyncAll` 11%
inclusive (`residualShadowVolPresent` 7%), `_walk` 21% inclusive, `residualOrder` 4.4% (effSpeed ×4 per residual group,
24 groups), `dmgRange` ~6%, tags lean `entry` ~2%, `sideWiped` 1.6% (four arrays per call), GC ~3-6%.
`legalActions` was 70% of a menu-reading game loop: `structuredClone` of each of ~1,900 counter keys, twice a call.

`battleTurnBody` is 206 KB of bytecode (1,125 registers): above TurboFan's 61 KB cap, Maglev-compiled in ~650 ms, and
deoptimised ~9 times per 11k turns. Raising `--max-optimized-bytecode-size` or turning Maglev/OSR off did not move the
turn rate, so the tier is not the lever we measured. Its self time is spread over thousands of lines; the residual
walk (~100 `_G.has` tests per body per group) is the largest region.

## Instruments (scratchpad, not committed)

`work.js` (fixed workload: seeded uniform play over real sheets), `pair.js` (two trees in one process, alternating
blocks, identity mode), `pobench.js` (paired ladder-shaped playouts), `ladbench.js` (playouts per decision vs pool
size, written, NOT RUN), `rdprof.js` / `rdsub.js` / `rdinc.js` / `rdlines.js` (profile readers), `gate.js` (the gate
driver). Wall time per process is bimodal on this machine (1.2 vs 4-6 ms a turn between identical runs), so only
same-process paired ratios are reported.

## The stopped gate run (release `74972dd2db89`, cut over 1.77.3)

Release differs from `df172ccd2aaf` in `engine/medicham2-browser.js`, `engine/medicham_api.js`, and also
`engine/quality.js` + `data/quality-filter.json` (other work since 1.57.0). Readings before the stop, NOT a gate
verdict: census 1027/0/1027 (one sampled-probe detail line moved, Iron Head 19.7% → 20.3%); lattices 1200/1600/1900
0 board-material of 954/1266/1497; engine diff exit 0; roster 166/166, 210/214, 510/511; all-mechanics-fire exit 0.
register_reality was killed mid-run and quarantine never ran. Every tracked artifact the run wrote was reverted.
Left on disk (mine, untracked): `data/releases/74972dd2db89/`, `data/verification/census-pin-regmc-c759d0a8eb23.json`.

## OWED, NOT RUN

- **The gate re-run on the new engine.** Cut a release over HEAD (or reuse `74972dd2db89` if HEAD's engine bytes still
  match), then the full Reg M-C sequence (census + pin, lattices 1200/1600/1900, engine diff 6000, roster ×3,
  all-mechanics-fire, register_reality, quarantine). Then `solver/tests/test-lean-mode.js`, `test-miltank.js`,
  `test-body-parity.js`, `test-playout-speed.js`. Force-track the release dir if it becomes the gate release.
- **Next profile targets (engine):** the residual walk's per-group work (`residualOrder` recomputes effSpeed for every
  body in each of 24 groups; Will's constraint on order-deciding speed reads applies, so a cache needs an invalidation
  proof); the residual walk's `_G.has` chain; `residualExpireAt` building closures per group; `dmgRange`'s tag reads.
  A structural split of `battleTurnBody` is the large lever and is a refactor, not a patch.
- **For SOLVER (filed, not done):** the PORYGON2 leaf is ~28% of a ladder playout (`features.js` `factsFor`/`hits`
  calling `dmgRange`); the world copy (`v8.deserialize`) ~6%.
- **Parallelism (the coordinator's scope addition), not started:** ROTOM's live search calls `MT.decide` in-process,
  so the ladder uses ONE core per decision; the pool path (`decideAsync`) exists and is identity-tested but ROTOM never
  uses it (a `solver/rotom/policy.js` change, SOLVER's). `ladbench.js` is written to measure playouts per decision at 5 s
  / 14 s for pool sizes 0,1,2,4,8,12,14 with worker RSS. `solver/machamp/sprt.js` refuses >3 workers by a hard-coded
  check added in `02156176` (2026-09-25) with no stated reason; `solver/machamp/gate.js` caps at 4. Throughput at
  3/6/10/14 game workers is unmeasured; measure by forking `solver/mew/play.js --mode match` shards as sprt.js does.
- **Self-play games per hour on 3 workers:** not measured (ENGINE runs no self-play). Derivable from the N7 smoke's
  18.2 worker-s per game beside the ladder and the ×1.07 playout figure, after the gate.
