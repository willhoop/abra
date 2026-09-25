# Solver log

Running log of the new solver stack (everything except MEDICHAM, rebuilt from scratch for Reg M-C,
open team sheets). Newest first. Each entry: what landed, the verdict, where the detail lives.
Roadmap page: https://claude.ai/artifact/3Xd2MvVhdE3xdZqsFDbmDG

---

## 2026-09-25

### ROTOM private-series hang fixed; bounded waits; supervisor watchdog (abra/regmc 1.12.0)
- Both aa1 hangs (after k=3 and k=6) had one cause. A hidden series is renamed `…-<pw>pw`, the client also joined
  the old id, and that id's `noinit|nonexistent` reply created a phantom series (k=4, k=7) that never ended. Fixed
  at the root. Every ladder wait is now bounded: a silent series is probed, then orphaned as a counted error. The
  supervisor restarts a client that makes no progress and has no game open.
- `test-rotom-private-series.js` replays both sequences through the real client: GREEN 23/23, and RED on the old
  code. A 3-series local dry run with private rooms and a drilled hang gave 6 rows and 1 watchdog restart.
- Detail: `docs/_reports/2026-09-25-rotom-series-hang.md`.

### Mega as a RATE, per bot (abra/regmc 1.11.0)
- Humans mega on 0.949 of the sides that could (45,952 of 48,430; 0.974 in games that end normally), half of
  the time on turn 1. On release `eaa5becc54eb`: DODUO-greedy 0.907 pooled (185/204), MILTANK 0.946 (53/56) and
  the gen5 champion 0.948 (55/58). No bot is near the floor.
- `solver/arena/mega_rate.js` gives one definition for the arena, MEW/MACHAMP shard summaries, ROTOM's per-game
  record and the human rate. `solver/tests/test-mega-rate.js` sets floor = human − 0.15 on the Wilson upper bound.
  It is GREEN 20/20 and RED under `ARENA_BREAK=nevermega`.
- Fixed on the way: `test-machamp.js --release <id>` ran 0 clauses and printed GREEN.
- Detail: `docs/_reports/2026-09-25-mega-rate.md`.

### MACHAMP loop — one line per generation (solver/machamp/loop_sprt.js)
- gen7: rejected — SPRT H0 after 652 games, 0.489 [0.451, 0.528] vs gen5; clone 0.670; PORYGON2 human Δ -0.0059 PASS. `solver/machamp/models/gen7/gates.json`
- gen6: rejected — SPRT H0 after 166 games, 0.434 [0.361, 0.510] vs gen5; clone 0.705; PORYGON2 human Δ -0.0051 PASS. `solver/machamp/models/gen6/gates.json`

### Deadline follow-ups (abra/regmc 1.10.0)
- ROTOM runs `collectIdle()` after each MILTANK choice (in a local set: 24 of 24, max 412 ms, no decision over its
  budget). `--priority normal` raises a ladder client's decider, and the runbook uses it. The reserve is now 300 ms
  at 5 s, and the serial 5 s max fell to 5,126 ms (margin 374 ms, was 74 ms).
- Self-play note: MEW records a root only when `info.rec` exists, and a deadline fallback has none. Fallback turns
  therefore drop out of the training data.

### MILTANK's deadline is hard (abra/regmc 1.9.0)
- The 28-39 s decisions at a 5 s budget had one cause on the pool path: the parent waited for every worker, and a
  worker read the clock only after a playout, so one BELOW_NORMAL worker starved of CPU held the decision.
  Reproduced on the old code: 17.2 s at a 1 s budget. The serial path (ROTOM's) had a second cause, major GCs of
  1.1-1.6 s inside a decision.
- Fix: absolute deadline + reserve; no pass starts late; the pool resolves on a timer with streamed slices; late
  workers cancelled and counted; playouts abandoned between turns; solve capped; a counted fallback to the
  ranking prior's top joint when the table is too empty; diagonal cell walk; `collectIdle()` between decisions.
- 2,000 real Reg M-C positions per arm, one-core artificial load: 0 over budget + 500 ms at 1 s and 5 s, pool
  and serial (maxes 1,004 / 4,906 / 1,268 / 5,426 ms). Break arms first: 73/300 and 31/100 over.
- **Not free:** under that load 65% (pool) and 30% (serial) of 1 s decisions fell back to the prior. Strength is
  not measured. ROTOM does not call `collectIdle` yet, and its clients run BELOW_NORMAL: both are owed before any
  search-based ladder play.
- Detail: `docs/_reports/2026-09-25-miltank-deadline.md`; artifacts `solver/results/2026-09-25-deadline/`.
### Round 3 — gen5 ACCEPTED (abra/regmc 1.8.0)
- The changes: a strong DODUO anchor; PORYGON2 on 0.5·z + 0.5·deep value (exact replay, then 4 × 3-turn
  human-clone rollouts; 0 mismatches over 39,538 positions); every round's data pooled (5,200 games).
- **SPRT (elo0 0, elo1 +20, α = β = 0.05): H1 after 1,268 games, 0.528 [0.501, 0.556] against gen0.**
- Human clone 0.660; PORYGON2 human gate PASS.
- gen5 is the champion. `r3-sp0` (1,000 games) was played in the background for round 4.
- Detail: report §12.

### gen4 ablation (abra/regmc 1.7.0)
- A, new PORYGON2 only: 0.465 [0.397, 0.534] against the champion.
- B, DODUO refit with a strong human pull (drift +0.012 nats instead of +0.051), PORYGON2 v0: 0.500 [0.431, 0.569].
- **Neither net detectably helps or hurts at n = 200**; the DODUO-drift hypothesis is not confirmed.
- Next: keep the strong anchor, stop training PORYGON2 on its own depth-0 value, accumulate data, gate by SPRT.
- Detail: report §11.

### MACHAMP round 2 — generations 3 and 4 (abra/regmc 1.6.0)
- Settings: full search (k 4×4, 1,000 ms, depth 0), 3 workers, teams from `data/team-pool-frozen-regmc`.
- 736 games/hour; 0.1% of cells empty.
- gen3 against the champion 0.430 [0.363, 0.499]: **significantly worse**.
- gen4 against the champion 0.475 [0.407, 0.544].
- Both beat the human clone: 0.675 and 0.690. Both pass the PORYGON2 human gate.
- Neither accepted; the champion stays gen0 (as `gen0-r2`).
- Suspected cause: DODUO distilled toward a 4-row mix drifts +0.05 nats from humans. A one-net-at-a-time ablation
  is owed. Detail: `docs/_reports/2026-09-25-selfplay-v0.md` §10.

### Self-play loop v0 — MEW + MACHAMP (abra/regmc 1.5.0; branch worktree-agent-aab7de2f53411dba8, merged)
- MEW plays real human open-sheet team pairs (train-split players) on the frozen release `eaa5becc54eb`. Both
  sides are MILTANK with the generation's DODUO prior and PORYGON2 leaf, at 500 ms per decision, k 5×5, depth 0.
  League weights: current 0.6, previous 0.2, human clone 0.2. Each decision records the position, v, both
  mixes, the matrix and the result.
- MACHAMP builds the targets:
  - PORYGON2: 0.5·v + 0.5·z, with human positions 1:1.
  - DODUO: 0.7·search mix + 0.3·DODUO v1, plus the human-click NLL.
- MACHAMP gates each candidate with the pre-registered gates (`solver/machamp/preregistration.json`, committed
  before the first game).
- **Throughput: 1,721 and 1,943 self-play games/hour** on 4 workers. One generation step takes about 80 min.
- **2 generations trained, 0 accepted:**
  - gen1: PORYGON2 human Δ −0.0025 [−0.0053, +0.0005] PASS; beats gen0 0.525 [0.456, 0.593] FAIL; vs clone
    0.560 PASS.
  - gen2: Δ −0.0038 [−0.0062, −0.0014] PASS; beats gen0 0.520 [0.451, 0.588] FAIL; vs clone 0.490 PASS.
  - The champion stays gen0.
- The search is starved at this budget: 30–41% of cells were unfilled, so 36–54% of decisions are too empty to
  train DODUO on. Next: a longer or pass-capped self-play budget, a human-only PORYGON2 control, and a gate
  sized for about 3 points.
- `solver/tests/test-machamp.js` 95/95, RED on 6 breaks. Detail: `docs/_reports/2026-09-25-selfplay-v0.md`.

### First post-gate measurements, and the ladder bot: DODUO-greedy
- All on frozen release `eaa5becc54eb`, the same 100 real Reg M-C team pairs (pool `9d07c522200de072`, ids
  `ba106d1ad5487ac2`), paired seats, 200 games, `--workers 4`, through `tools\lownode.cmd`, Wilson 95%.
- MILTANK (heuristic, d2) vs DODUO-greedy: **0.470 [0.402, 0.539] at 1 s; 0.510 [0.441, 0.578] at 5 s.**
- Heuristic d0 vs d2, 1 s: 0.540 [0.471, 0.608]. PORYGON2 vs heuristic leaf, d2: 0.560 [0.491, 0.627] at 1 s,
  0.505 [0.436, 0.574] at 5 s. Greedy: DODUO vs MAG 0.555 [0.486, 0.622], DODUO vs prior 0.580 [0.511, 0.646],
  MAG vs prior 0.595 [0.526, 0.661].
- **LADDER BOT: DODUO-greedy (ROTOM `prior` policy).** The rule was the configuration that best beats
  DODUO-greedy within ≤20 s a decision. Nothing tested beats it: MILTANK's best is a tie at 5 s, costs
  100-1000× the decision time, and showed 28-39 s single decisions under load. The pick is provisional, by
  default of evidence, not a shown superiority. The next bar is MILTANK at depth 0 (heuristic and PORYGON2)
  against DODUO-greedy, with more games and a compute-fixed budget (5 s wall bought only ~1.2-2× the
  playouts of 1 s on a loaded machine).
- Detail: `docs/_reports/2026-09-25-first-solver-measurements.md`; artifacts `solver/results/2026-09-25-first/`.

### ROTOM replays + ladder mode merged (abra/regmc 1.1.0 replays, 1.2.0 ladder, 1.3.0 merge)
- Ladder mode uses the replay-save and games.jsonl hooks; one rating parser; one local start-up path
  (`solver/rotom/local_server.js`) for run_local and the ladder dry run.
- The local server made 9 public attempts at start-up (Tor exit list, invalidatecss, seasons ladder fetch). Now 0:
  loginserver / routes.root / routes.replays switched to the local stand-in, the switchless Tor fetch refused by name.
  `solver/tests/test-rotom-localnet.js` GREEN, RED on `--break`. Detail: `docs/_reports/2026-09-25-rotom-merge.md`.

### ROTOM ladder mode — prepared, not launched (branch worktree-agent-a389a1eed5928626f; merged in 1.3.0)
- `--ladder` searches `gen9championsvgc2026regmcbo3`, plays the series, repeats to STOP / set count / time cap /
  3 consecutive errors. Per-series A/B arm and rotation team from a seed committed before the first search.
- Guard: machine lock + `/crq userdetails willhoop` before every search; pauses while willhoop is connected.
  A search in progress is invisible to the server's API: that gap is stated, and the rule is "log willhoop out".
- Dry run on a local server, the same client code path, with every non-loopback connection refused in every process.
- Runbook `solver/rotom/LADDER.md`. Detail: `docs/_reports/2026-09-25-rotom-ladder-mode.md`.

## 2026-09-24

### PORYGON2 v0 — the value net (branch worktree-agent-ade91fd3b83d5aa3c, unmerged)
- Deep-Sets net over the six sheet tokens per side plus MEDICHAM damage-race facts: KO, speed order,
  kill-first, turns-to-clear. The facts are PRE-GATE. Antisymmetric by construction. Trained on human
  Reg M-C outcomes with the MAG/DODUO player split; only games with both players in train are trained on.
- Held-out log-loss: **0.517**, against 0.577 for the count-HP logistic and 0.536 for the embeddings-only
  net. Brier: 0.176, against 0.199 and 0.183. Every paired game-clustered CI is clear, and the margin is
  above the split-half floor (0.004).
- Engine facts earn their place from turn 2 onward. On turn 1 the full − emb CI touches 0.
- Node matches Python to 9e-16. `solver/tests/test-porygon2.js` is GREEN at 423/423 and RED on 5 breaks.
- Leaf cost: 0.85 ms median per position. Of that, 0.64 ms is the engine facts and 0.16 ms is the net.
- MILTANK leaf: `MILTANK_LEAF=pory2` or `o.leaf`. PRE-GATE arena, 200 games, 1 s, depth 0 on both sides:
  PORYGON2 leaf vs heuristic leaf **0.515 (0.446–0.583)**. That is a tie, so V2 is not shown.
  Against the default (heuristic after depth-2 random rollouts): **0.605 (0.536–0.670)**. That is confounded
  with depth, and the heuristic depth-0 vs depth-2 control is owed.
- Detail: `docs/_reports/2026-09-24-porygon2-v0.md`.

### Landed in main (merge coordinator, 2026-09-24)
- Merged to main in order, each tested there: engine name-cache PATCH (0.112.2), MAG v1 + DODUO v1 (0.113.0),
  XATU v1 (0.114.0), SLOWKING v1 + MILTANK v1 skeleton + arena (0.115.0), worker pool + playout fixes (0.116.0),
  lean playouts (0.116.1), Supreme Overlord / Revival Blessing narration (0.117.0-0.119.0). Duplicate cherry-picks
  resolved to main's bytes. Engine merges proved on a pinned Reg M-C `--games 1200` differential: 955/955 games
  identical per game for the cache and lean merges; narration merge 3 -> 0 protocol divergences, boards 0.
- Detail: `docs/_reports/2026-09-24-solver-merge.md`.

### Handover from the MEDICHAM chat
- Will handed the Reg M-C engine to this chat. State at handover (from `docs/_reports/2026-09-23-engine-pass10.md`):
  the M-C gate is NOT open. The pass-10 engine was never re-measured (lattices, roster, gate re-read owed on
  fresh releases), `probe_court_change` can't stage under Reg M-B (it counts against the gate), and Reg M-C
  narration items are still open.
- Dispatched: (1) ENGINE, in main — the owed gate re-read, measurement only, on frozen releases;
  (2) ENGINE, in a worktree — the additive solver API (clone, RNG handle, legalActions, step, terminal check)
  from the interface brief. Not merged until the re-read finishes.

### Solver engine API (branch `worktree-agent-a1ac483af93614de1`, commit 76691522, unmerged)
- `engine/medicham_api.js`: clone, RNG handle, legalActions, step (non-mutating), terminal check that
  doesn't treat the 20-turn cap as game over. The two battle leaks are fixed opt-in, only for API-built battles.
- Tests pass: clone round trip, no input mutation, no cross-battle leaks. Differential byte-identical at
  --games 1200 (955 games), and 22,283/22,283 turns replay identically on clones.
- legalActions vs Showdown: 5,526/5,552 slots agree. The 26 are MEDICHAM move-menu bugs: Fake Out after
  a Parting Shot that didn't switch (20), Imprison (4), Heal Block (2). A separate agent is fixing them.
- Owed: the release-list change resets the differential's instrument stamp; status.js --write was skipped
  (corrupts from a worktree); mid-turn-choice callback (step 6) not done.
- Detail: that branch's `docs/_reports/2026-09-24-solver-engine-api.md`.

### Overnight results (2026-09-24), all unmerged unless noted
- **MILTANK playout speed** (branch `playout-speed`): the engine turn is ~80% of a playout; the low count was
  mostly machine load. Worker pool matches in-process exactly; empty-cell bug 34.8% → 6.3%. PRE-GATE vs
  prior-greedy, 200 games: 1 s × 4 workers 0.565 (0.496–0.632); 1 s in-process 0.590 (0.521–0.656);
  **5 s × 4 workers 0.640 (0.571–0.703)**. Engine turn now ~3× slower than 2026-08-28; profiling
  dispatched (tags.js name cleanup ≈13%).
- **MAG v1 / DODUO v1** (branch worktree-agent-ae26f145ebead8fac): joint log-loss 2.730 vs v0 2.921; recall@16
  87.2% vs 83.1%; switch turns 80.6%, turn 1 81.6%. Test 3,826/3,826 re-run by coordinator (needs
  SHOWDOWN_PATH set to the M-C checkout when run from a worktree). PyTorch 2.14.0+cpu installed.
- **XATU v1** (branch worktree-agent-aae6baa63246ab32f): back-two never excludes the truth (0/10,942);
  turn-1 log-loss 1.348 vs 1.792 uniform; top-1 47% vs 19%. Spread narrowing is weak (~30 of 33 values survive).
- **Engine fixes queued for merge:** Court Change scope; Emergency Exit/Berserk, White Herb; Curse, Beak
  Blast burn; Lightning Rod, Magic Bounce; mega-stone take guard (Magic Room); API; Fake Out/Imprison/Heal
  Block menus; disabled → Struggle + Torment; Gravity menu + execution + called moves; -ate Weather Ball
  exclusion + picker; roster staging (Natural Cure, Regenerator, Effect Spore, Belch, berry); Mimicry
  terrain-only; Reflect Type added-type corners; #310/#442 instruments; #310 closed. In flight: Burn Up
  added type, engine turn speed.
- **Will's calls pending:** narration baseline (recommend ratchet at today's count); the unpublished Reg M-B
  roster/census readings.

### Gate re-read after pass 10 (commit 7c9f7534, abra/regmc 0.87.0)
- **Reg M-C CLOSED, 5 of 10 clauses fail** (release ec377f6f8159). Boards 0 of 955 / 1,266 / 1,497 at
  --games 1200/1600/1900; damage 0 of 6,000. Failing: Pixilate damage (Refrigerate unproven); roster can't stage
  Natural Cure, Regenerator, Belch, Effect Spore, plus a toothless berry self-test; narration 6/12/9 games
  with NO baseline stamped (Will's call); register rows #310 and #442 can't answer under M-C.
- **Reg M-B CLOSED, 4 of 10.** Boards and narration 0. Roster/mechanics, plus #442 failing. New M-B readings
  (roster 193/200, 494/497, census 1,006) are unpublished because the closed M-B docs say 196/200, 496/497, 1,004.
  Will's call. Saved in data/verification/*-7822a83cc49b.json.
- Dispatched: merge coordinator (7 branches, renumbered, in main); -ate abilities; roster staging; register
  rows #310/#442; Gravity/Belch/Stuff Cheeks menu halves; playout speed.
- Also finished: all-disabled menu → Struggle, plus Torment's menu half (branch disabled-choice-struggle). SLOWKING +
  MILTANK v1 + arena built (PRE-GATE: 0.530 vs prior-greedy, CI 0.461–0.598; only ~23 playouts per 1 s decision).

### Super drive (Will, 2026-09-24)
- Running in parallel worktrees: Court Change M-B fixture; narration (Emergency Exit/Berserk + White Herb;
  Curse + burn/sleep order; Lightning Rod + Magic Bounce + the faint-line instrument question); the
  move-menu bugs. Gate re-read continues in main. Merge order: gate re-read → fixes one at a time → API
  → fresh gate re-read.

### Lean playouts (PRE-GATE)
- MILTANK's playouts now run in MEDICHAM's lean mode (`newBattle({lean:true})` / `API.makeLean`): the same boards, no
  protocol, no process counters, tag answers from a table. `MILTANK_LEAN=0` plays full.
- Speed, paired in one process on the same cells: 1.25x to 1.33x playouts per main-thread CPU-second (block medians, three runs). Cell values hash equal; `playout_bench.js` prints the
  same `values_sha` and `decide_sha` with lean on and off.
- Proof of identity: `solver/tests/test-lean-mode.js` (the Reg M-C `--games 1200` lattice and 300 human-sheet games,
  red on a deliberate break). `test-playout-speed.js` and `test-miltank.js` GREEN.
- Detail: `docs/_reports/2026-09-24-lean-mode.md`.

### Playout speed and worker pool (PRE-GATE)
- About 80% of a playout is the engine turn (`battleTurn`). Solver overhead was about 8%: the clone plus the
  makeRng wrapper, now cut to about 4%. The earlier "23 playouts" figure was mostly machine load (the machine
  was 90–100% busy all day).
- Worker-process pool (`solver/miltank/pool.js`). It is bit-identical to serial at a pass cap. Cut-short
  passes now start at golden-ratio offsets; before that, the pool left 34.8% of cells empty.
  `test-playout-speed.js` GREEN 1,184/1,184 and red on 4 breaks.
- Arena against prior-greedy, 200 games:
  - 1 s, 4 workers: 0.565 (0.496–0.632), median 72 playouts.
  - 1 s, in-process: 0.590 (0.521–0.656), median 50.
  - **5 s, 4 workers: 0.640 (0.571–0.703)**, median 623, 0.12% of cells unfilled.
- Scaling could not be measured on a saturated machine. A playout costs about 10 ms of CPU at any worker
  count.
- Detail: `docs/_reports/2026-09-24-playout-speed.md`.

### SLOWKING v1, MILTANK v1 skeleton, offline arena (PRE-GATE)
- SLOWKING: RM+ plus an exact LP. Agreement on 200 random games. RM+ stays under the proven
  Δ(√m+√n)/√T bound on 90 runs. `solver/tests/test-slowking.js` GREEN 1,559/1,559 and red on 3 breaks.
- MILTANK v1: prior-ranked joints with reserved switch/mega slots, uniform-belief worlds, CRN playouts,
  SLOWKING, and a sampled move. `test-miltank.js` GREEN 3,414/3,414 and red on 5 breaks. `test-arena.js`
  GREEN 15/15.
- Fixed while building: the engine reorders `sf.team` on switches. Bodies now carry `_solverSheet`.
- Arena, PRE-GATE shakedown (200 games each, 1 s per decision, k 6×6, depth 1):
  - MILTANK vs prior-greedy: 0.530 (CI 0.461–0.598).
  - MILTANK vs random: 0.940.
  - Prior vs random: 0.945.
  - The search is starved: median 23 playouts for 36 cells, and 28% of cells unfilled. Cheaper cells come
    before any strength claim.
- Detail: `docs/_reports/2026-09-24-slowking-miltank-arena.md`. Code: `solver/slowking/`,
  `solver/miltank/`, `solver/arena/`.

### MAG v1 + DODUO v1 (successors to prior v0)
- MAG v1 = per-slot scorer (v0 features + species identities, candidate-set pooling); DODUO v1 = joint
  coordinator over MAG (pairwise MLP + bilinear + v0 pair indicators). PyTorch 2.14.0+cpu (PyPI).
- Same player split as v0 (val/test tensors byte-identical). Test players, exact joints: DODUO log-loss
  **2.730 vs v0 2.921**, recall@4/8/12/16 **55.4 / 72.5 / 81.4 / 87.2** vs 50.3 / 66.5 / 76.5 / 83.1; every
  paired CI clear of zero. MAG alone (no pair term) 2.823, @16 85.7 — also beats v0.
- Weak spots improved most, still weakest: switch @16 74.8 → 80.6, turn 1 @16 76.0 → 81.6.
- Node forward pass matches Python to 2.1e-14 on 76 decisions; `solver/tests/test-mag-doduo.js` GREEN
  3,826/3,826, red on four deliberate breaks first. Dataset sha256 stamped in both model files.
- Detail: `docs/_reports/2026-09-24-mag-doduo-v1.md`; code `solver/mag/`.

---

## 2026-09-23

### Human policy prior v0
- Predicts P(joint action | state, both sheets) from the human dataset; no simulator.
- Held-out by acting player (4,892 / 603 / 620 players). Joint recall of the human's exact joint action:
  top-4 50.3%, top-8 66.5%, top-12 76.5%, **top-16 83.1% (95% CI 82.4–83.6)** vs 44.3% per-species
  frequency and 49.2% stronger frequency baseline. Joint log-loss 2.92 vs 4.35 / 4.04.
- Per-slot top-8 is 99% — per-slot badly overstates joint. Excluded: 9,421 hidden-choice turns, 2,910
  uncertain-target turns.
- Weak spots: switch turns 74.8% at top-16, turn 1 76.0% → search must reserve switch slots. Pair
  scoring helps.
- Only numpy installed (no torch/sklearn): gradients hand-written, numerically checked. Node forward
  pass matches Python logits to 1.07e-14 on 37 decisions. `solver/tests/test-prior.js` GREEN 1062/1062
  (re-run by coordinator), red on two deliberate breaks first.
- Limits: candidates are "legal-looking", not engine-legal (search must filter); opponent switch options
  only valid inside each possible-bring world.
- Trained on dataset sha256 `9d07c522…`, stamped in the model file.
- Detail: `docs/_reports/2026-09-23-policy-prior-v0.md`; code `solver/prior/`.

### Engine interface brief
- Most of the solver API wraps existing MEDICHAM exports. Three real gaps: no state clone (fix:
  `structuredClone` minus the trace sink), mid-turn choices (faint replacement / pivot switch-in) are
  pre-decided instead of asked (fix: an opt-in callback, do last), two globals still leak between
  battles (event-dice repeat counter, three trace fields). The terminal check counts the 20-turn cap
  as game over.
- Seven single-commit steps, each checked against the differential. For the MEDICHAM chat, after the
  Reg M-C gate. Line numbers are from the live file and will drift.
- Detail: `docs/_reports/2026-09-23-engine-interface-brief.md`

### Reg M-C meta analysis
- 28,274 clean open-sheet games, 6,822 players, 09-09 → 09-23; effectively all bo3 (559 bo1 left).
- Legality checked against the M-C Showdown checkout (`pokemon-showdown-mc`); illegal entities only in
  custom-rule rooms.
- Games cluster by player: Wilson intervals ~4× too narrow; player-clustered intervals given.
- 12 species risers, 17 fallers (first vs last week). 8 archetypes, but none met the pre-set stability
  bar (median bootstrap ARI 0.80) — treat as rough. One archetype off expectation after rating
  correction (~3.6 pts below).
- Bo3: same four brought again 61% after a win, 30% after a loss, 21% vs a new opponent.
- No SP spreads in the store.
- Tests: `solver/tests/test-meta-lib.js` 29/29, `test-meta-artifacts.js` 21/21 (re-run by coordinator).
- Detail: `docs/_reports/2026-09-23-regmc-meta.md`; code `solver/meta/`; outputs `solver/out/meta/`.

### Human-play dataset
- 26,888 of 28,283 Reg M-C bo3 games kept; 185,480 turns; 370,960 side-turn decisions, 74.3% with the
  full joint action visible.
- Exclusions 1,395: pre-fix Eject Button 335, behavioural bots 321, no action 308, Illusion 225, named
  bots 168, no result 36, custom rules 2. None of Will's accounts in this stream.
- 10% of targeted moves flagged "target not certain" (redirection, retargets).
- Test `solver/tests/test-human-parse.js` GREEN 24,605/24,605 (re-run by coordinator); shown red on a
  deliberate break.
- `games.jsonl` is 498 MB → `solver/out/` gitignored.
- Detail: `docs/_reports/2026-09-23-human-dataset.md`; code `solver/human/`.

### Research (four reports)
- Turn search: per-turn payoff table over hidden back-two + spreads, regret matching, short rollouts,
  capped exploit dial. Prior art PokaiTrainer (arXiv 2608.29197, verified: 59% of 150 sets vs ~1320
  Elo field, briefly top 500).
- Learning: clone humans first, then search-driven self-play; small nets, PyTorch train, Node forward
  pass; must beat an HP-count baseline.
- Humans & ladder: bots not banned by written rules but staff discretion — message an admin first.
  Format `gen9championsvgc2026regmcbo3`. Rating drifts ±55–60 Elo on its own.
- Teams & meta: preview is a 90×90 game with a learned cell scorer; builder is population search +
  screen + spread optimiser.
- Detail: `docs/_reports/2026-09-23-solver-research-{turn-search,learning,humans-and-ladder,teams-and-meta}.md`

### Decisions (Will)
- Open team sheets only · Reg M-C · rebuild every non-MEDICHAM model from scratch · laptop compute ·
  finish line = high on the ladder · equilibrium base + capped exploit dial · ladder account
  `medicham32` (disclose to an admin, no VPN) · eventually team building + meta · research now ·
  archive old models when their replacement lands.

### Not yet done
- Nothing under `solver/` or the new reports is committed — waiting for the MEDICHAM chat to be out of git.
