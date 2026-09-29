# The lookahead options at ROTOM's real clock (~14 s adaptive): a short screen before the ~38 h SPRT

2026-09-29. SOLVER. Asked by Will: *"Lets do small test runs first before committing to a 38 hour one."*
Engine: frozen release `eaa5becc54eb`. Pool: `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`
(`games.bo3.jsonl` sha256 `a68263bb…`, the same file as the 2 s screen), TEST pairs. Information: honest.
Artifacts: `solver/results/2026-09-29-lookahead-screen-14s/`. Shards and logs: `solver/out/lookahead-14s/` (gitignored).

## Verdict

- **Screen, options ON vs OFF, both adaptive target 14 s: 101–99, 0.505 [0.436, 0.574], 200 games. PASS** on the
  pre-registered rule (Wilson upper ≥ 0.5 and point ≥ 0.47). Pairs both/split/lost 20/61/19. 0 errors, 0 fallbacks,
  0 warnings, 0 timeouts. The options fired: 2,329,935 quiesced playouts.
- **The screen was NOT at equal wall-clock.** ON spent 9,940 ms per searched decision, OFF 8,912 (ratio 1.115, over the
  pre-registered 1.10). Same target, but OFF stops clear more often (median decision 2.0 s vs 7.7 s).
- **Time-only calibration: OFF at target 17 s spends 9,952 ms**, inside the pre-registered ±5% band around ON's 9,940
  (9,443..10,437). **MATCHED.** The SPRT should be ON at 14 s against OFF at 17 s.
- **Per-game time:** 163 s per game per worker in the screen (8,174 s wall, 200 games, 4 workers), 194 s in the
  calibration (both arms near 10 s), 205 s in the 6-game smoke. **The full SPRT (3 workers, max 2,000 games) is 30–36 h
  at the cap**, not 38; an SPRT that stops at ~750 games (as the adaptive-clock SPRT did) is ~11–13 h.
- **Recommendation: low expected value; run it only when the machine would otherwise be idle.** Across 400 games
  (2 s and 14 s) the options score 0.500 and 0.505, and at 14 s they had 11.5% more clock and still showed nothing. The
  +20 Elo H1 is not ruled out (the screen's interval runs to about +52 Elo), but the likely outcome is H0 after 10–20 h.
  Until an H1, the options stay off every ladder arm.

## 1. What was run, and why these flags (read, not guessed)

- **Arms** (`on-14s.json`, `off-14s.json`) are the arms of the stopped ~10 s SPRT
  (`solver/results/2026-09-27-adaptive-options/adaptive-10s-{on,off}.json`) with only `name` and `adaptive` changed:
  `targetMs 14000`, `credit0Ms 4667` (= target/3, the rule used at 2 s and 12 s; `solver/rotom/adaptive.js` DEFAULTS
  `credit0Ms: null = target / 3`). The options are `quiesce: "all"`, `flatEps: 0.001`, `reserveNoRepeat: true`. gen5
  MAG/DODUO/PORYGON2, k1 = k2 = 4, depth 0, reserveSwitch 1.
- **Why 14 s.** `docs/_reports/2026-09-27-adaptive-clock.md` §8: at target 12 s the realised mean was ~8.5 s (8,850 on,
  8,165 off); the owed item was "target ~14 s for a ~10 s mean". Measured here: ON 9.94 s, OFF 8.91 s.
- **The stopped ~10 s SPRT.** `sprt.js --seed 27102 --workers 3`, the rest as the adaptive-clock SPRT, run through a node
  BELOW_NORMAL launcher (its log head: `belownode: … priority 10`, three shard pids). It was stopped by its pids at a
  stopping point Will asked for, after 66–67 pairs in ~117 min (commit `300fde10`, CHANGELOG-REGMC 1.24.1). Its shards
  are in `.claude/worktrees/agent-a23d34a92f0037aaa/solver/out/adaptive-options/sprt-10s-on-vs-off.shards/`; only the
  log's head and its progress lines were read here, never a score.
- **Launcher.** `cmd.exe /c tools\lownode.cmd solver/machamp/gate.js …` spawned from a small node script with an argv
  vector (BELOWNORMAL), env `ABRA_REGULATION=regmc`. The harness allowed it.

## 2. Smoke (6 games, not counted)

`gate.js --pairs 3 --pair-seed 29 --seed 29000 --workers 3` (`smoke.json`, `smoke-read.json`). 0 errors, 0 fallbacks,
0 timeouts. Pair wall 244 / 402 / 585 s (205 s per game). ON 10,490 ms vs OFF 8,862 ms per searched decision; slowest
decision 27.7 s; heaviest game 177 s of decision time. 165,546 quiesced playouts. ON stops: clear 32, hard 28, soft 3.
Its score was not used.

## 3. Screen (pre-registered before its first game, commit `75883b22`)

`gate.js --release eaa5becc54eb --x on-14s --y off-14s --pairs 100 --pair-seed 1 --seed 29101 --workers 4 --cap 50
--rule notlose --info honest --team-store <pool>` (`preregistration.json`, `screen-14s.json`, `screen-14s-read.json`).
pair-seed 1 = the same 100 TEST pairs as the 2 s screen. Started 15:59:34Z, finished 18:15:49Z (8,174 s).

| | ON (X) | OFF (Y) |
|---|---|---|
| score | **0.505 [0.436, 0.574]** (101–99) | |
| ms per searched decision | 9,940 | 8,912 |
| decision p50 / p99 / max (ms) | 7,715 / 27,723 / 27,742 | 2,033 / 27,719 / 27,745 |
| bank used per game mean / p95 / max (s) | 84.3 / 151.5 / 200.4 | 75.6 / 145.2 / 174.3 |
| decisions over 55 s / games over 420 s | 0 / 0 | 0 / 0 |

ON's stops over 1,697 searched decisions: clear 967 (57%), hard 534 (31%), soft 196 (12%). 0 fallbacks,
4,793,181 PORYGON2 leaf evaluations, 2,329,935 quiesced playouts, unfilled cells 0 on every worker, per-game hash
`2e471f8a6d169b25`.

**Reading.** PASS: no loss shown. That is necessary for the SPRT, not evidence that the options are stronger. It is
also not at equal wall-clock (ratio 1.115 > 1.10), so by the pre-registration the SPRT has to match time.

## 4. Time-only calibration (pre-registered before its first game, commit `06fd0053`)

OFF at target 17 s (`off-17s.json`, credit0 5,667) vs OFF at 14 s, 20 pairs, pair-seed 2, seed 29102, 4 workers
(`calibration-preregistration.json`, `calib-off17.json`, `calib-off17-read.json`). Neither arm has the options, so it
says nothing about the hypothesis; its score was not read.

The first attempt was killed at Will's pause (a coordinator request; the workers were already gone when checked by
pid). Its partial output is VOID (CPU contention with his emulator) and is kept unread as
`solver/out/lookahead-14s/VOID-paused-calib-off17.shards/`. The re-run was from scratch.

| | OFF 17 s | OFF 14 s |
|---|---|---|
| ms per searched decision | **9,952** | 8,940 |
| max decision (ms) | 33,733 | 27,767 |
| bank used per game max (s) | 193.2 | 159.2 |
| timeouts | 0 | 0 |

**MATCHED**: 9,952 is within 5% of ON's 9,940. OFF at 14 s reproduces the screen's 8,912 (8,940), so the machine
behaved the same on both days. Wall 1,945 s for 40 games at 4 workers (194 s per game per worker).

## 5. Recommendation

The SPRT, if run, is ON at 14 s vs OFF at 17 s (equal clock, ~9.95 s mean each). At 3 workers (the `sprt.js` cap) and
163–194 s per game, the 2,000-game cap is 30–36 h. The evidence so far points to H0: 0.500 at 2 s, 0.505 at 14 s with
an 11.5% time advantage. The options also cost ~1 s more per decision at equal target. The run is worth it only as
overnight filler; it is not on any critical path, and a ladder arm with the adaptive clock at ~10 s does not need it
(options off).

## OWED, NOT RUN

The options SPRT at equal clock (Will's call; do not start without it). From the main checkout, in PowerShell:

```
$env:ABRA_REGULATION='regmc'; cmd /c tools\lownode.cmd solver/machamp/sprt.js --release eaa5becc54eb --x solver/results/2026-09-29-lookahead-screen-14s/on-14s.json --y solver/results/2026-09-29-lookahead-screen-14s/off-17s.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 29103 --workers 3 --cap 50 --info honest --team-store data/team-pool-frozen-regmc --out solver/out/lookahead-14s/sprt-on14-vs-off17.json
```

Read ONCE at the bound:

```
node solver/machamp/sprt_read.js --sprt solver/out/lookahead-14s/sprt-on14-vs-off17.json --out solver/out/lookahead-14s/sprt-read.json
node solver/bench/adaptive_read.js --sprt solver/out/lookahead-14s/sprt-on14-vs-off17.json --out solver/out/lookahead-14s/sprt-adaptive-read.json
```

Pre-register before the first game (in `solver/results/2026-09-29-lookahead-screen-14s/`): elo0 0, elo1 +20,
α = β = 0.05, max 2,000 games, seed 29103, H1 = options ON stronger at equal ~10 s clock; clock rule 0 decisions over
55 s and 0 games over 420 s; time condition |X/Y − 1| ≤ 0.05 on ms per searched decision. Deploy only on H1.

Re-running the calibration (if the pool or the machine changes):

```
$env:ABRA_REGULATION='regmc'; cmd /c tools\lownode.cmd solver/machamp/gate.js --release eaa5becc54eb --x solver/results/2026-09-29-lookahead-screen-14s/off-17s.json --y solver/results/2026-09-29-lookahead-screen-14s/off-14s.json --pairs 20 --pair-seed 2 --seed 29102 --workers 4 --cap 50 --rule notlose --info honest --team-store data/team-pool-frozen-regmc --out solver/out/lookahead-14s/calib-off17.json
```
