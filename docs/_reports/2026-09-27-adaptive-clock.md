# ROTOM's adaptive per-decision clock (Reg M-C, release eaa5becc54eb)

2026-09-27 (runs 2026-09-26). SOLVER. Code: `solver/rotom/adaptive.js` (new), the `o.onPass` hook in
`solver/miltank/search.js` `decide` → `solver/miltank/cells.js` `fillSerial`, `spec.adaptive` in `solver/mew/agent.js`,
per-side searched counts and stop reasons on each match line in `solver/mew/play.js`, the ROTOM wiring in
`solver/rotom/rotom.js` and `solver/rotom/policy.js`, `eRemHi` and a tick-length correction in `solver/rotom/clock.js`.
Instruments: `solver/bench/adaptive_tune.js`, `solver/bench/adaptive_read.js`, `solver/tests/test-adaptive-clock.js`.
Artifacts: `solver/results/2026-09-27-adaptive-clock/`. Engine: frozen release `eaa5becc54eb`; pool
`data/team-pool-frozen-regmc`; honest information.

## Verdict

- **Not worse, at 23% less time, and never near the clock.** Pre-registered SPRT (elo0 0, elo1 +20, α = β = 0.05,
  ≤ 2,000 games), adaptive gen5 against the same gen5 at a fixed 5 s: **H0 at 748 games, 367–381, 0.491 [0.455, 0.526]**,
  LLR −3.107 against the bound −2.944, Elo estimate −6.5. The adaptive side spent **3,628 ms** per searched decision
  against **4,717 ms**. 0 timeouts on either side: no decision over 55 s, no game over 420 s. Heaviest game 134.3 s
  (adaptive) and 169.7 s (fixed) of decision time.
- **What H0 says, plainly.** The adaptive clock is NOT shown stronger by 20 Elo. The interval holds 0.5, so it is not
  shown weaker either, and it met the pre-registered landing rule (score within its Wilson half-width of 0.5, the time
  condition, 0 timeouts). It is not proven EQUAL: the interval still admits about −32 to +18 Elo.
- **The safety line holds in simulation.** 4,000 simulated slow games against the server's own timer (5 s ticks
  restarting at each request; bank 420 + 90 s; turn 55 s; every searched decision run to its hard line, then +0.5 s
  overrun, +0.65 s send gap and up to 3 s of GC): 0 bank-outs, 0 turn timeouts, lowest bank 30 s. RED on the
  deliberate break that ignores the line: 999 bank-outs.
- **ROTOM plays it.** A local run (2 bo3 sets, 4 games, `--adaptive-target-ms 4500`): 42 planned decisions, 0 timeouts,
  0 invalid, 0 fallbacks, no decision past its hard line + 500 ms.
- **The deeper-lookahead options on the adaptive clock:** pass a 2 s screen (0.500 [0.431, 0.569], 200 games). Their
  ~10 s SPRT was STOPPED UNREAD after 134 games at Will's stopping point; nothing is concluded (§8).
- **One pre-registered run was aborted** on its own time condition after 6 games, before any score was read (§3).

## 1. The design

`solver/rotom/adaptive.js`. The clock rule is read from the checkout (`clock.js readRule`, `pokemon-showdown-mc`
`data/rulesets.ts` `vgctimer`: Timer Starting 420, Grace 90, Add Per Turn 0, Max Per Turn 55, Max First Turn 90). The
server charges it in 5 s ticks (`server/room-battle.ts` `TICK_TIME = 5`); `clock.js` said 10 s and is corrected.

Per searched decision, with E the store's expected requests left from this turn (`solver/rotom/tables.json`, mean) and
E_hi its 90th percentile:

| quantity | definition |
|---|---|
| slack | bank − 30 s − 1 s · E_hi (what is left after the prior's answers for the rest of the game) |
| cap (the safety line) | min(turn left − 8 s, slack, 2 · slack / E) |
| credit | credit0 + Σ (target − spent) over this game's searched decisions |
| hard (MILTANK's budgetMs) | min(cap, 2 · target, target + credit) |
| soft | min(hard, target) |

Under 400 ms of hard the move is the prior, counted. A forced switch plans on half the target.

The stop rule, after every complete pass of the cell fill (`o.onPass`): from pass 4 on, solve the mean table (a short
RM+), take the column mix y and the top row b, and for every other row i the per-pass paired difference
d_i(q) = Σ_j y_j (v_bj(q) − v_ij(q)) (each pass plays every cell on one world: common random numbers).

- CLEAR: every d_i has mean − 2·se > 0 → stop, once 750 ms have passed.
- CLOSE: some d_i has mean < 1·se → keep going to hard.
- otherwise stop at soft.

MILTANK's hard deadline is unchanged. `hard` is its budget, and the hook can only END a fill earlier.

The hook in MILTANK is two lines: `fillSerial` takes an optional `onPass(vs)` and stops when it returns true, and
`decide` passes `o.onPass`. With no `onPass` the fill is byte-for-byte what it was (`test-playout-speed` IDENT 1088
playouts against the pre-change playout, GREEN).

## 2. Tuning, on TRAIN pairs only

`node solver/bench/adaptive_tune.js collect` then `analyze`. 36 honest games on TRAIN pairs (never the SPRT's TEST pairs),
gen5 against DODUO-greedy; each of 327 searched gen5 decisions recorded 60 complete passes (30 s ceiling). A policy's
loss is measured against the table of all 60 passes: regret-br = v* − min_j (x·A_ref)_j. That reference contains the
prefix, so it favours longer searches and judges an early stop conservatively. `tuning-train.json`:

| policy | mean ms | regret-br ×1000 | regret vs y_ref ×1000 |
|---|---|---|---|
| fixed 1 s | 980 | 10.23 | 4.63 |
| fixed 3 s | 2,860 | 4.67 | 1.29 |
| **fixed 5 s** | **4,740** | **3.95** | **1.27** |
| fixed 8 s | 7,740 | 1.43 | 0.20 |
| **adaptive, target 4.5 s, credit0 1.5 s (registered)** | **3,658** | **2.70** | **0.55** |
| adaptive, target 5 s, credit0 5 s (run 1) | 4,307 | 2.61 | 0.61 |

Both regrets are a few thousandths of a win probability per decision. Before the SPRT the expected result was written
down: +20 Elo is not expected; the likely outcome is INCONCLUSIVE or H0 (`preregistration.json` `expected`).

## 3. Run 1, aborted on its time condition (no score read)

Run 1 (seed 27001, commit `1f9d191e`) used target 5 s with credit0 = target. The first tuning charged a fixed budget and
an unfinished adaptive decision only up to the last RECORDED pass: fixed 5 s came out at 4,286 ms instead of the
4,740 ms a real fill spends. In the first 6 games the adaptive side spent 4.1–5.5 s per searched decision against
4.71–4.80 s: the pre-registered time condition (X ≤ Y) was going to fail by construction. The run was killed by its pids
after 6 games; its score was never read. The accounting was fixed (§2), the target set to 4.5 s with credit0 1.5 s, and
run 2 re-registered at a new seed before its first game (`preregistration.json` `supersedes`). The run-1 shards stay in
`solver/out/adaptive-sprt-aborted-run1/` (gitignored), unread.

## 4. The SPRT (run 2)

`solver/machamp/sprt.js --release eaa5becc54eb --x solver/results/2026-09-27-adaptive-clock/gen5-adaptive.json --y
solver/results/2026-09-26-champ-vs-doduo/gen5-5s.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000
--seed 27002 --workers 3 --cap 50 --team-store data/team-pool-frozen-regmc --info honest`, started at BELOW_NORMAL
through a node launcher (the sandbox refused `cmd.exe`, as on 2026-09-26). Read once, at the bound, with
`sprt_read.js` and `adaptive_read.js`.

| | value |
|---|---|
| verdict | **H0** at pair index 373: 748 games counted, 764 played (16 past the stop not counted), 0 errored |
| W–L | 367–381, **0.491 [0.455, 0.526]** (Wilson 95% at a data-dependent stop: conditional on it, slightly optimistic) |
| pairs both / split / lost | 58 / 251 / 65 |
| LLR | −3.107 (bounds ±2.944) |
| wall | 5.6 h |

| clock (counted games) | adaptive (X) | fixed 5 s (Y) |
|---|---|---|
| ms per searched decision | **3,628** | **4,717** |
| decision p50 / p95 / max | 3,331 / 8,706 / 10,438 | — / 4,739 / 5,849 |
| decision time per game, mean / p95 / max | 34.5 / 55.7 / 134.3 s | 44.8 / 70.7 / 169.7 s |
| decisions over 55 s | 0 | 0 |
| games over 420 s | 0 | 0 |

X's stops over 7,110 decisions: **clear 3,767 (53%)**, hard 2,516 (35%), soft 822 (12%), forced 5. 0 low-bank
fallbacks, 0 search fallbacks, 0 agent fallbacks. Mega timing (recorded, not concluded from): X delays 0.272
[0.240, 0.307] of its megas, inside the human band 0.2225 ± 0.15. Artifacts: `sprt-adaptive-vs-5s.json`,
`sprt-read.json`, `adaptive-read.json`.

**Reading.** Half the decisions stop clear before the soft line; a third are close and run to their hard line (at most
9 s plus the overrun). The
table-level gain the tuning saw (regret 2.70 vs 3.95 ×10⁻³) is too small to show in 748 games, which is what the
pre-registration expected. The result that stands is the time: the same strength, within this SPRT's resolution, for
23% less clock, and with the heaviest game at 134 s of a 420 s bank.

## 5. The test

`solver/tests/test-adaptive-clock.js`, GREEN 30/30 before the SPRT and on the merged tree (§7):

- RULE: the rule comes from the checkout's ruleTable, not the fallback constants.
- BANK: 2,000 slow games against the server model (40–80 requests, far past the store's longest) and 2,000 against a
  HARSH model (the tick phase uniform in [0, 5) s, as if every fast answer could cost a tick; 10–30 requests). Half use a
  greedy target (15 s, stretch 3). 0 bank-outs, 0 turn timeouts, lowest bank 30 s and 40 s; the safety line capped
  26,787 and 65 decisions and forced 7,105 prior answers in the long games, so it was exercised.
- CREDIT: an all-close game averages at most target + credit0/n; an all-clear game averages under the target and then
  lets a close decision run past it.
- STOP: a dominant row stops CLEAR (not before minMs or minPasses); two rows within noise are CLOSE and do not stop past
  soft; a row ahead inside the clear bar stops at soft and not before; a one-row table stops at soft.
- ARENA: one honest game on the frozen release, gen5 with `adaptive` against DODUO-greedy: every searched decision
  carries `info.adapt`, none past hard + 500 ms, the counters move, 0 fallbacks.
- RED: `ROTOM_CLOCK_BREAK=nocap` (the line ignored) turns BANK red with 999 bank-outs; `ROTOM_CLOCK_BREAK=nostop` turns
  STOP red. Both run on every test run.

**What the harsh model does not cover.** Under a uniform tick phase and 40–80-request games the line CAN run out,
because every prior answer after the slack is gone costs half a tick on average. The real server restarts the tick at
our request, so an answer under 5 s costs nothing; the server model is the one gated at 40–80 requests.

## 6. ROTOM

`--adaptive-target-ms T` on the client, or `"adaptive": { "targetMs": T }` in an arm. The plan replaces the clock's fixed
share for a searching move or forced switch; the turn and the bank still bind it. The decision log carries
`budget.adaptive` and `adapt` (stop, checks, state, credit after); the summary carries `adaptive` counters.

Local run (`run_local.js --sets 2 --a miltank-gen5 --b prior --a-args "--release eaa5becc54eb --adaptive-target-ms
4500" --port 8811`, `solver/out/rotom/run-2026-09-26T15-30-34-892Z/`, not committed): 2 series, 4 games, 0 timeouts,
0 invalid, 0 crashed sets, 0 self quits; 46 decisions (4 preview, 34 move, 8 forced switch), all `miltank-gen5`, 0
fallbacks; adaptive stops clear 15, soft 4, hard 15, switch 8; slowest decision 7,657 ms; 0 past hard + 500 ms; replays
4/4 saved locally; 0 public connections. With no arm cap the fixed share would have been up to 47 s at turn 1: the
adaptive plan is far below the clock, not at it.

No arms file uses it. Putting it on arm A is a new pre-registration and a ladder series is Will's call.

## 7. Regression

On the merged tree (origin/main `661e4618` merged at `e298f0f4`): `test-adaptive-clock` 30/30 (both breaks RED),
`test-rotom` 105/105, `test-rotom-ladder` 114/114, `test-honest-info` 1954/1954 (RED under peek), `test-miltank-quiesce`
1195/1195 (four breaks RED), `test-rotom-world-stall` 6/6, `test-playout-speed` 1184/1184 (four breaks RED; IDENT pins the
fill without `onPass` to the pre-change playout), `test-machamp --release eaa5becc54eb` 97/97 (every break RED),
`tests/test-docs-current.js` 39/39. `test-miltank-deadline --no-red` read 14/16 in the batch: its SEARCH clause, which is
load-sensitive and was run beside other agents' work, saw the pool path solve 40% of decisions. Re-run alone it read 6/6
(pool 100%, median 289 playouts; serial 100%, 309). This change adds no hook to the pool path. The same clause went red
the same way on 2026-09-26 and passed on re-run (`docs/_reports/2026-09-26-gen5-honest-and-ladder-prep.md` §6).

**The merge found `tests/test-docs-current.js` red on origin/main** (clause 3b(d), 592 → 594 unbound figures): the census
figure `1024 rows live` in `docs/ABRA-whitepaper.md` and `docs/ABRA-technical-docs.md` cites
`e1d04b89:data/mechanics-census-regmc.json:live`, and the census moved to 1027 in abra/regmc 1.21.0. The figure is a
dated pin and still true at that commit; both rows now also name `abra/regmc 0.125.0`, whose entry records it. The
test reads 39/39. No figure was changed.

## 8. The deeper-lookahead options on the adaptive clock (added after a restart, 2026-09-27)

Will wants the ladder budget near 10 s on average. The MILTANK options of `docs/_reports/2026-09-27-protect-repeat-fix.md`
(quiesce 'all' + flatEps 0.001 + reserveNoRepeat) lost at a fixed 1 s (0.418 [0.350, 0.488]), where each cell got about
1.4 playouts. Pre-registered before either stage (`solver/results/2026-09-27-adaptive-options/preregistration.json`):
a 200-game screen at adaptive 2 s, and the long SPRT at adaptive ~10 s only if the screen passes.

**Screen, options on vs off, both adaptive target 2 s** (`gate.js --pairs 100 --pair-seed 1 --seed 27101 --workers 4
--rule notlose`, `screen-2s.json`): **100–100, 0.500 [0.431, 0.569]**, pairs both/split/lost 20/60/20, 0 errors, 0
fallbacks; mean decision 1,695 ms (on) vs 1,789 ms (off); 326,550 quiesced playouts, so the option ran. **PASS** (upper
bound ≥ 0.5 and point ≥ 0.47). At 2 s the loss seen at 1 s is gone.

**SPRT, options on vs off, both adaptive target 12 s** (`sprt.js --seed 27102 --workers 3`, the rest as §4). **STOPPED
UNREAD** at a stopping point Will asked for, after 134 games (66 pairs, 1.9 h), by its pids; the score was never read and
does not exist as a result. Clock only (the time condition, not the score): 8,850 ms (on) vs 8,165 ms (off) per searched
decision, slowest decision 23.8 s, heaviest game 324.2 s of decision time, 0 decisions over 55 s, 0 games over 420 s,
0 errors. The realised mean is ~8.5 s, not 10: at a longer target more decisions stop clear, so the target/mean ratio
falls (0.81 at 4.5 s, ~0.71 at 12 s). The shards are in `solver/out/adaptive-options/sprt-10s-on-vs-off.shards/`
(gitignored); they are NOT to be read as a partial SPRT.

**What is left.** (1) Re-register the 10 s SPRT at a new seed (target ~14 s for a ~10 s mean) and run it to its bound:
about 38 h at 3 workers, 2,000 games max. (2) Only on H1, put the options into a ladder arm. (3) A ladder arm with the
adaptive clock at ~10 s needs its own pre-registration and Will's OK.

## 9. Owed

- A ladder arm with the adaptive clock (a new pre-registration; Will's call).
- The stop rule reads only the root table. Feeding it the leaf's own uncertainty, or XATU's, is not attempted.
- The pool path (`decideAsync`) takes no `onPass`; ROTOM and the arena use the serial path.
