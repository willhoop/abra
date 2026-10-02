# The N7 self-play loop: built, smoke-tested beside the ladder, generation 1 pre-registered (abra/regmc 1.77.0)

2026-10-02. SOLVER, milestone N7 of `solver/PLAN.md` 0.3.0 (revised 1.53.0). Historical findings record, not
maintained.

**No generation was run and no gate game was played.** The only games played were:
- a tiny smoke of 20 self-play games, run four times: three practice runs while the code was being finished, and one
  recorded run, `smoke-2026-10-02d`, on the final code;
- the test's own 4-game runs.

A live ladder run (`topreal`, release `eaa5becc54eb`, a fixed 5 s in-process search) was playing the whole time. Every
process of this work ran BelowNormal with at most 2 workers.

## Verdict

- **Bad news first: BelowNormal and two workers did NOT protect the live ladder's search.**
  - Over the four smoke windows the ladder's search played a median **966 playouts per move decision (37 decisions)**,
    against **2,493 (205)** outside them.
  - By phase: turns 1–2, 350 against 1,619; turns 5 and later, **270 against 3,576**.
  - Within one game the ladder went from 211–255 playouts during a smoke (turns 7–11) to 2,429–3,171 a minute after the
    smoke ended (turns 5–11).
  - A 30-second no-game test that only loads the engine and the team store came with 146–158 (turns 2–3).
  - The clock was never at risk: 0 timeout or inactivity lines, 0 decisions over budget, bank ≥ 400 s.
  - But the ladder's searches were thinner, by up to ~10× on the decisions that overlapped this work.
  - The playouts were also falling before any heavy run of mine (turns 5+: 4,901 in 03:54–04:20, 3,546 in 04:20–04:40),
    so the cause is not fully attributed. Total CPU was about 20% of 16 threads and 4.2 GB was free, so memory or
    cache pressure is the suspect, not priority. That is not measured.
  - **The reading for the coordinator:** run even a "tiny" job only in a ladder gap. The loop already refuses to start
    or continue beside a ladder process. Only `--smoke --allow-beside-ladder` overrides that, and it should not be used
    again during a rated batch. Receipt: `solver/results/2026-10-02-n7-smoke/ladder-during-smokes.json`.
- **Built:** `solver/machamp/n7/loop.js`, one resumable script for the whole generation:
  1. self-play with playout-cap randomisation;
  2. the learner, a policy+value net;
  3. the offline gate (the v3 harness plus the policy head's held-out test);
  4. a not-lose screen and an SPRT, each read once with capability bars;
  5. promotion on H1 only;
  6. the next generation.
- **Crash-safe:** a kill or a ladder pause never corrupts a generation. Each stage writes to a temporary name and renames
  it when done. The state file is replaced atomically. Every corpus and model gets a sha256, and a resume re-hashes it.
  A finished stage is never redone.
- **Ladder first:** a ladder process makes the loop exit 3 (PAUSED). If one appears during a stage, the loop stops its
  own child tree by pid.
- **Tests:** `solver/tests/test-n7-loop.js` has 8 clauses and 10 deliberate breaks.
  - The three clauses the brief asked for: **resumption after a real kill mid-generation** (and the learner's own
    checkpoint), **manifest integrity**, and **promotion refusing anything but H1**.
  - Every clause and every break has been run GREEN and RED respectively (§5). The game-playing clauses' last full run
    with their breaks predates the last three small changes; re-running the whole test in a ladder gap is OWED item 0.
  - The existing `test-machamp` (106/106) and `test-col-coverage` (13/13) stay GREEN on the edited MEW files.
- **The smoke ran end to end** (`smoke-2026-10-02d`): 20 games, 2 workers, one epoch with the human anchor, and the
  offline gate on a 10% subsample.
  - Every self-play capability bar passed, with 0 searches cut short of their pass cap.
  - Node/Python parity was 1.8e-15 (value) and 2.8e-17 (policy).
  - The candidate leaf served 7,124 harness evaluations with 0 errors.
  - **None of the smoke's figures is a result.**
- **Generation 1 is pre-registered and NOT RUN** (`solver/machamp/n7/preregistration-gen1.json`): 10,000 honest
  self-play games, then the gate at a 2 s clock against gen5 (screen seed 41101, SPRT seed 41201).
  - **Estimated cost: about 12–24 h of wall time on 3 local workers.**
    - Self-play is 9–17 h of it. The low end comes from the 2 s screen's playout rate; the high end is the smoke's rate,
      measured beside the ladder: 18.2 worker-seconds a game.
    - Training is about 0.25 h, the offline gate at most 0.4 h, the screen 0.55 h, and the SPRT 1.1–5.5 h.
  - A generation the offline gate rejects has still paid for its self-play.
  - **Owed before it can start:** the frozen harness and the human-anchor data exist only in another agent's worktree
    and must be copied to the main checkout. The commands are in *OWED, NOT RUN*.
- **Not built, and said plainly: N6, the several-turn public-belief search.** Generation 1 searches gen5's depth-0
  MILTANK, with the net as its leaf and the net's policy head tilting the candidate prior. The brief asked for exactly
  this ("the current champion"). The plan's N7 assumes N6.

## 1. The loop

| stage | what runs | written to `solver/out/n7/<tag>/gen<g>/` | refuses / stops when |
|---|---|---|---|
| selfplay | `solver/mew/run.js --n7 --pcr …`, in `chunks`; chunk *c* on seed `seed_base + c` | `selfplay/chunk-NN/` (renamed from `.tmp` only after its shards hash to its manifest) | a corpus bar fails: errors > 1%, fallbacks > 5%, unfilled cells > 1%, no position or policy target, > 2% full decisions without a target, the FULL share outside p ± 0.05, answer maps absent or erroring |
| build | `solver/machamp/n7/build.js` over the replay window (this and up to 4 earlier generations) | `data/rows.jsonl.gz` + `manifest.json` (every input shard's sha256, the output's) | a chunk's shards do not hash to its manifest; two releases in the window; a game id twice |
| train | `solver/machamp/n7/train.py train` then `export`; then the Node parity check | `train/` (epoch checkpoints, `net.json`, `fixture.json`, `metrics.json`, `val_policy.jsonl`, `parity.json`) | the anchor is required and absent, or not the pinned teacher cache; parity worse than 1e-9 |
| offline | `solver/machamp/n7/offline_gate.js` (the v3 harness copied, scored, benched, reported; the head's held-out test) | `offline/verdict.json` | value FAIL = generation rejected before any game |
| screen | `solver/machamp/gate.js --rule notlose`, 200 games, guarded; `solver/machamp/n7/read.js` once | `screen/result.json`, `read.json`, `guard.jsonl` | not PASS = rejected; a ladder mid-run = VOID |
| sprt | `solver/machamp/sprt.js`, guarded; read once at its stop | `sprt/…` | H0 / INCONCLUSIVE = rejected |
| promote | `promote()`: H1, every bar, this generation's pre-registration, the X arm carrying this net | the net copied to `solver/machamp/models/<tag>-gen<g>/` (tracked, ~0.23 MB) | anything else |

**State.** The state file is `<tag>/state.json`. It records the following:
- Each generation names the pre-registration it runs under, with its sha256. A generation is started only under the file
  registered for it (`"generation": g`) and resumed only under the same bytes.
  - The hash is taken over the text with its line endings normalised: `core.autocrlf` checks the file out as CRLF here
    and LF elsewhere. `preregistration-gen1.json` hashes to `de13163d…` either way.
- Every finished stage records its output digests.
- Events (created, resumed) are logged.

**Exit codes:**
- 0: done, or stopped at `--stop-after`.
- 1: a failure, including MANIFEST INTEGRITY.
- 2: a usage or preflight refusal.
- 3: PAUSED for the ladder.
- 4: a VOID screen or SPRT. It is replayed only with `--retry-void`.

**Other modes:**
- `--dry-run` prints the preflight, every stage's exact argument vector and the estimate, and writes nothing.
- `--estimate` prints the estimate alone. `--measured <run dir>` makes it use a finished run's measured rates.
- `--status` summarises the state.
- `--smoke` applies the pre-registration's `smoke` block: at most 2 workers, one epoch, a 10% harness subsample, and a
  stop after the offline gate. `--allow-beside-ladder` is accepted only with it, and never for a screen or an SPRT.

## 2. Design decisions and their sources

- **Playout-cap randomisation, as KataGo does it** (Wu 2019, arXiv 1902.10565 §3.1, p = 0.25; correction 3 in
  `solver/porygon2/v3/DESIGN.md`). Each decision draws FULL or FAST from the bot's own seeded hash (`solver/mew/agent.js`).
  - **Only FULL decisions are recorded as targets.** FAST decisions exist to play more games.
  - **Pass caps, not a clock**, so a decision's search does not depend on machine load. FULL is 24 passes of the 4×4
    table, 384 playouts: the search of the 2 s gate clock (the 2 s reference arm made 382.4 playouts per searched
    decision). FAST is 4 passes. budgetMs is only a ceiling (15,000 / 5,000 ms). A search it cuts short of its pass cap is counted
    (`pcr.full_cut` / `fast_cut`) and barred above 1%, because a cut makes the corpus depend on machine load (§6).
- **Honest information in self-play.** The training data are played under the information every gate, SPRT and the
  ladder play under (CLAUDE.md: fitting and playing environments must match). MACHAMP v0's self-play was omniscient.
- **The encoded board is the decider's own view, not the true battle.**
  - `solver/mew/play.js` encodes the view the search was handed: its own side exact, the opponent's hidden fields UNK
    and its bodies public. This is exactly the board the policy head reads at play time.
  - It is one row per recorded decision.
  - **The first practice smoke encoded the true battle; that was changed before the recorded smoke.** The true board
    leaks the opponent's hidden Stat Points into v1's engine facts.
  - The outcome z and the answer map are labels, so they are read from the true battle.
- **The value target is the outcome z, nothing blended into it** (AlphaZero; DESIGN §3, correction 2), with ONE position
  per game per epoch carrying the z loss (DESIGN §2, AlphaGo's memorisation result).
  - The short-horizon search values are **auxiliary heads**, as in KataGo. They are λ-returns over the later root values
    and then z, with λ = h/(h + 1) for h = 1 and 3 turns. Fast roots count; they are root values too.
  - So are the student's material, HP-difference and turns-left heads, on the game's real end, and the
    **answer-map summary**.
  - The answer map is an offline target only, never an input (1.58.0). It uses the one implementation,
    `answer_map.js`, on a seeded 10% of the recorded turns at 8 duels per pair. Its four numbers, each in [0, 1]: per side,
    the weakest coverage of an opposing threat and the share of threats with fewer than 0.5 answers.
- **The policy head (tilt-v1).** The head reads the deciding chair's 64-unit hidden, the same layer the value is read
  from, and outputs (β, θ). Each valid cell k of the DODUO decision scores s_k = e^β·lp_k + θ·bits_k.
  - This is GARY's form (`solver/gary/fit.js`, 14 class bits from `solver/gary/situation.js`), conditioned on the board
    instead of a bucket.
  - It starts at zero, which is DODUO exactly. An L2 on (β, θ) pulls it back there where the data are thin.
  - It is trained on the search's root mix laid on DODUO's valid cells: AlphaZero's π target, the search head of DESIGN §3.
  - **It is not the piKL anchor** (correction 4). The human anchor stays DODUO, and this head tilts it.
  - At play time `solver/machamp/n7/policy.js` wraps the prior adapter. MILTANK's candidates, its reserved rows and its
    fallback joint all read the tilted scores.
  - The record and the play path share one implementation (`cellsOf`). The head is pinned to the DODUO file it was
    fitted on, and serving it over another DODUO is refused.
- **The human anchor** (PLAN N7: "not optional"). Every step also distils the v2 teacher on human TRAIN rows, exactly as
  the student was trained.
  - These are the student's own data: the v2 tensors and the k1 teacher cache, pinned by the cache manifest's sha256
    `6cc5a7c8…`. They predate 1.76.0's stream dedupe, so 851 games count twice in distillation. TEST rows are never read.
  - The offline gate adds a **human clause**: on the harness's strong human sources (bo1 rated 1500 or more, bo3 rated
    1300 or more), the candidate's log-loss is at most +0.01 above the champion's.
- **Warm start.** Generation 1 starts from the v3 student (39,892 parameters, 0.91× gen5's leaf cost). Later generations
  start from the champion net. **The exported file is a `v3-student` file**: `solver/porygon2/leaf.js` serves its value
  unchanged, and the policy block rides beside the weights.
- **The replay window:** this generation's self-play plus up to 4 earlier generations of the same run and release. This
  is the 2026-09-25 lesson below.
- **The offline gate is a non-inferiority screen.** The SPRT decides improvement.
  - Each margin is 2× the 95% CI half-width measured for the student against gen5 on the same frozen set (1.62.0):
    - τ-b lower bound ≥ −0.024;
    - regret upper bound ≤ +0.0062;
    - ECE upper bound ≤ +0.031.
  - Cost ≤ 1.10× the champion's net, the clock-ratio tolerance.
  - The candidate leaf served every evaluation with 0 errors.
  - The policy head goes ON only if its held-out cross-entropy against its DODUO base has a game-clustered CI entirely
    below 0, on at least 200 decisions. Otherwise the candidate plays DODUO untilted. That is recorded, not a failure.
- **The game gates run at the 2 s adaptive clock**, against gen5 at the same clock. This is the clock of the 2026-10-01
  2 s screen, and its measured floor (161) carries over.
  - The 14 s ladder clock costs about 7× the CPU per game (7,428 s against 1,479 s for 200 games, both 4 workers).
  - The N7 exit, the net's SPRT against the **pipeline** champion at the ladder clock, is a separate test and is not
    registered here.
- **Promotion is the only way the champion moves**, and only on an SPRT read of H1 with every bar met. Nothing goes on
  a ladder arm from it.

## 3. Why loop v0 accepted one generation in five, and what this loop does about it

`docs/_reports/2026-09-25-selfplay-v0.md`:
- **Round 1** (gen1–2) gated with a fixed 200-game "beats" rule, and the search was starved: 30–41% of cells were
  unfilled at 500 ms.
- **Round 2** (gen3–4) fixed the budget and still lost: gen3 0.430, gen4 0.475.
- **The ablation (§11) found the self-play updates "not yet worth anything in play".** Its four prescriptions, and where
  each one lives here:
  1. A strong DODUO anchor. Here DODUO is not retrained at all: the policy head tilts it under an L2, and the gate's
     human clause checks the value net.
  2. Stop distilling PORYGON2 on its own bootstrapped value. Here z is the only main target, and search values are
     auxiliary heads.
  3. Give the gate statistical power. Here a 200-game not-lose screen licenses an SPRT (elo1 +20, α = β = 0.05, up to
     2,000 games). This is how gen5 itself was accepted (H1 at 1,268 games).
  4. Accumulate data. Here the replay window does it.
- **Starved corpora are refused by the corpus bars** before anything trains on them.

## 4. Shared code changed (opt-in; the defaults are byte-for-byte the old behaviour)

- `solver/mew/agent.js`: the spec field `policyNet` (the head, pinned to the spec's DODUO; counters in
  `COUNTERS.policy[name]`), and `bot(seed, { pcr })`. `prior` is now exposed on the bot.
- `solver/mew/play.js`:
  - `--n7` records per game: `feats` (one encoded view per recorded decision), `vt` (every root value), each decision's
    `pt` (policy target), `am` and `end`. `--pcr`, `--am-rate` and `--am-n` are new.
  - A FAST decision is not recorded as a target.
  - The match line's `ctr` carries `policy` (the head's counter, read by `read.js`).
- `solver/mew/run.js`:
  - Passes `--info`, `--n7`, `--pcr`, `--am-rate` and `--am-n` through.
  - The manifest records them and sums the N7 counters, the PCR counts and each head's counters.
  - It warns on a zero.

## 5. Tests — `solver/tests/test-n7-loop.js`

The test runs the real loop on a tiny pre-registration it writes itself: 4 games in 2 chunks, one worker, 3- and 1-pass
searches, one short epoch. It uses release `df172ccd2aaf` and the frozen team store, and writes to
`solver/out/n7/test-<pid>/`. The whole test, with every red run, took 8 min 51 s.

**The runs, in order (each on the code of its moment):**

| when (UTC) | what | result |
|---|---|---|
| 04:43–04:52 | every clause + every break then defined (9) | GREEN 62/62, each break exit 1 |
| 05:01 | every clause, `--no-red`, after the switch to per-decision view encoding | GREEN 53/53 |
| 05:14 | PCR, after the pass-cap cut counter | GREEN |
| 05:22 | PROMOTE, POLICY, PCRCUT, PAUSE with their 4 breaks (no games) | GREEN 27/27, each break exit 1 |

**Changes after the last full red run that touch a game-playing clause:**
- the per-decision view encoding (`play.js`, `build.js`, the PCR check);
- the pass-cap cut counter (`agent.js`; its bar is set to 1 in the test's own pre-registration);
- the anchor pin (not exercised: the test runs `--no-anchor`).

The full run with every break is **OWED item 0**, in a ladder gap. It plays games, about 9 minutes at one worker.

| clause | what it holds | RED under |
|---|---|---|
| RESUME | the loop is **killed** (taskkill /T /F of the child the test started, by pid) during chunk 1, after chunk 0 finished: the state still parses, chunk 0 is done with its digests, and chunk 1 is not. The same command then finishes through training **without replaying chunk 0** (its manifest's start time and digests are unchanged) and records the resume. The learner, asked for 2 epochs after 1, plays exactly one more, RESUMED | `N7_LOOP_BREAK=resume`; `N7_TRAIN_BREAK=nosave` |
| MANIFEST | chunks, the dataset, the net, the checkpoint, the fixture and the metrics carry sha256s. `build.js verify` passes the dataset, fails a one-byte edit, and finds no game in both splits. **One byte appended to a finished chunk's shard makes the resume refuse** ("MANIFEST INTEGRITY") | `N7_LOOP_BREAK=integrity`; `N7_BUILD_BREAK=split` |
| PROMOTE | `promote()` refuses H0, INCONCLUSIVE, VOID, a failed bar, another pre-registration's read, an X arm without this net, a screen read and a missing read. It promotes only a clean H1 | `N7_LOOP_BREAK=promote` |
| NET | `net.js` and the deployed `porygon2/v3/infer.js` reproduce Python's float64 logits, and `net.js` both chairs' policy outputs, to 1e-9. Antisymmetry holds. The head is pinned | `N7_NET_BREAK=chair` (the loop's own parity check refuses first) |
| POLICY | on six real positions, a switch-favouring head is served (counted, tilted), moves the scores off DODUO's, raises switch mass and sums to 1. A head served over another DODUO is refused | `N7_POLICY_BREAK=off` |
| PCR | FULL and FAST were both played, only FULL was recorded, and there is exactly one encoded view per recorded decision | `N7_RECORD_BREAK=fast` |
| PCRCUT | one FULL decision under a 1 ms ceiling is counted cut (`info.pcr_cut`, `pcr.full_cut`); one that reached its 2-pass cap is not | `N7_PCR_BREAK=nocut` |
| PAUSE | with a ladder process present the loop exits 3 before any stage starts | `N7_LOOP_BREAK=ladder` |

Two of the red runs were checked for the right reason, not just the exit code:
- chair: "parity FAILED … max_abs_tilt 0.109";
- integrity: "a resume over an edited shard did not refuse (exit 0)".

## 6. The smoke (recorded run `smoke-2026-10-02d`; figures are NOT results)

```
node solver/machamp/n7/loop.js --prereg solver/machamp/n7/preregistration-gen1.json --smoke --allow-beside-ladder \
  --tag smoke-2026-10-02d --harness-src <v3 worktree>/solver/out/p2v3/evalset \
  --anchor-data <v3 worktree>/solver/out/p2v3/v2data --anchor-teacher <v3 worktree>/solver/out/p2v3/teacher
```

Release `df172ccd2aaf`, the frozen team store, honest information, `observed-v1` spreads. PCR p 0.25: FULL 24 passes,
FAST 4, ceilings 15,000 / 5,000 ms. Answer map on 10% of the recorded turns at 8 duels. The pre-registration sha256 is
`de13163d…`, the same bytes as committed. Wall time 05:16:20–05:20:15 (3 min 55 s).

| stage | what it did | receipt |
|---|---|---|
| self-play | 20 games in 2 chunks (44 s and 139 s). 330 searched decisions: 80 FULL (24.2%), 250 FAST, 0 cut short of their cap. 0 errors, 0 fallbacks, 0 unfilled cells. 80 policy targets, none unmapped. 80 encoded views; 6 answer maps (1.9 s), 0 errors. Every corpus bar passed | `smoke-d-state.json` |
| build | 80 rows (9 VAL, 2 VAL games), 80 decisions | `smoke-d-dataset-manifest.json` |
| train | 1 epoch, 1 step, 1.2 s including the VAL evaluation (24,000 human anchor rows). The anchor ON, pinned. VAL z log-loss 0.2567 against the student's 0.2524; anchor distillation 0.5029 against 0.5025; policy cross-entropy 1.999 against DODUO's 2.054 (9 decisions) | `smoke-d-train-metrics.json` |
| export + parity | `net.js` and the deployed `v3/infer.js` at 1.8e-15 on 9 rows; policy outputs at 2.8e-17; the fixture names the file | `smoke-d-parity.json` |
| offline gate (10% subsample, NOT a gate) | value **FAIL**: τ-b and ECE CIs too wide on 1/10 of the set. Regret, both human clauses, cost (0.921×) and capability passed. The policy head is OFF (9 held-out decisions, against the 200 required) | `smoke-d-offline-verdict.json` |

The FAIL is the machinery working: a one-epoch net on 20 games, scored on a tenth of the set, cannot clear a
non-inferiority bar sized for the full set. The policy head's 0.05-nat gain on 9 decisions is noise until a real
generation has 200 or more.

**Practice runs (the evidence for two changes).**
- **Run 1 (04:56) encoded the true battle**, not the decider's view. This was changed: §2.
- **Runs `b` and `c` replayed the same 20 games on the same seeds.** 19 of 20 matched exactly. The one that did not was
  the first game of a cold worker in run `b`: its FULL searches stopped at the 6,000 ms ceiling, at 123 and 232
  playouts instead of 384, at about 5.7 s each. Run `b`'s machine was also slow overall (19.4 worker-seconds a game).
  - **So the ceilings were raised to 15,000 / 5,000 ms, and a cut is now counted and barred** (`pcr.full_cut` /
    `fast_cut`, at most 1% of searches).
  - Run `d` reproduced run `c`'s games and training history exactly, with 0 cuts.
- Self-play throughput beside the ladder varied 2.3× between runs: 7.8 worker-seconds a game in `c`, 18.2 in `d`, 19.4
  in `b`.

**The ladder while the smoke ran.** The live `topreal` run was playing, on a fixed 5 s clock, in-process.
Medians of the ladder's playouts per move decision, read from its own decision log
(`solver/results/2026-10-02-n7-smoke/ladder-during-smokes.json`):

| | decisions | all turns | turns 1–2 | turns 3–4 | turns 5+ |
|---|---:|---:|---:|---:|---:|
| inside the four smoke windows | 37 | 966 | 350 | 1,514 | **270** |
| outside them (03:54–05:21) | 205 | 2,493 | 1,619 | 2,112 | **3,576** |

By time, turns 5+ medians were:
- 4,901 in 03:54–04:20, before any work of mine beyond reading files;
- 3,546 in 04:20–04:40, with 1-worker development runs;
- 1,992 in 04:40–04:56, the full test at 1 worker;
- 425 in 04:56–05:21, the smokes.

Right after the last smoke, the same game's turns 5–12 read 2,429–8,024. A 30 s no-game test at 05:22, which loads the
engine and the team store, overlapped turns 2–3 at 146 and 158.

The clock held throughout: ms per decision 4,705–4,897 (budget 5 s), 0 over budget, minimum bank 400 s, 0 timeout or
inactivity lines. **The search did not hold.** CPU priority did not protect it, and CPU was not saturated (about 20% of
16 threads, 4.2 GB free in one sample), so memory, cache or thermal pressure is the suspect. That is not measured.

## 7. Compute per generation (local; `node solver/machamp/n7/loop.js --prereg … --estimate --measured <smoke dir>`)

Two estimates, both from `loop.js --estimate` (receipts in `solver/results/2026-10-02-n7-smoke/estimate-gen1-*.json`):

| | derived (the 2 s screen's rates) | measured (smoke `d`, beside the ladder) |
|---|---:|---:|
| decision time FULL / FAST / mean | 1.76 / 0.29 / 0.66 s | — |
| worker-seconds per self-play game | 10.1 | **18.2** |
| self-play, 10,000 games, 3 workers | 9.3 h (28 worker-h) | **16.9 h** (51 worker-h) |
| training (≈ 36,300 recorded views × 5 epochs, with the anchor) | — | 0.24 h (an upper bound: the smoke's one step included its VAL pass) |
| offline gate (full set, 2 nets, 3 workers) | ≤ 0.41 h | (the 10% smoke took 30 s at 2 workers) |
| screen, 200 games at 2 s | 0.55 h | — |
| SPRT, typical stop (416–1,268 games) to the 2,000-game budget | 1.1–3.5 h, ≤ 5.5 h | — |
| **total per generation** | **11.9–17.8 h** | **19.2–23.5 h** |

The plan's §6a figure was about 15 h of CPU self-play plus gate, at 1 s a decision.
- This loop records only a quarter of its decisions as targets, at the 2 s search, and makes them cheap with FAST
  searches. Its self-play cost lands in the same range.
- `--workers 4` (`run.js`'s cap) would cut the self-play wall time by a quarter. Generation 1 is registered at 3.

Cloud prices and scale-out are `solver/PLAN.md` §6a and N8. N8 needs N3 (the MEDICHAM speed pass) and Will first.
**No spending.**

## 8. Limits and deviations

- **N6 is not built** (see the verdict).
- **The harness and the anchor data live in another agent's worktree** (`agent-aadbc255e960b0c50`). Gitignored outputs
  are not on main. The loop defaults to the main checkout's `solver/out/p2v3/{evalset,v2data,teacher}` and refuses to
  start generation 1 without them (preflight, then train and offline).
- **The anchor tensors predate the 1.76.0 dedupe.** The pin and the reason are in the pre-registration.
- **Out-of-vocabulary ids.** In the first smoke, 19 ids were outside the student's vocabulary: the one declared
  exclusion's sheet (Illusion: its species, ability and a signature move). They map to `<oov>`, as in the leaf, and are
  counted in `metrics.json` (`oov_ids`).
- **The policy head's cost at play:** one extra encode and forward per side per decision, plus two extra DODUO
  predictions. This is milliseconds against a 2 s decision. It is counted (`COUNTERS.policy[name].ms`), and the clock
  ratio bar covers it.
- **The smoke ran beside the ladder, as the brief allowed** (`--allow-beside-ladder`, 2 workers, BelowNormal).
  - The brief's check, "no timeouts", held.
  - The ladder's search was still thinned (verdict, §6).
  - `--allow-beside-ladder` remains for a smoke, but it should not be used during a rated batch.
  - Its throughput is a beside-the-ladder rate, and the estimate uses it as the high case.
- **The pre-registration was edited while the practice smokes ran:** the replay window, the anchor pin, the ceilings and
  the cut bar were added. Those smokes' states name the earlier bytes. The recorded smoke `d` ran on the final bytes
  (`de13163d…`). No generation-1
  game has been played, so nothing registered was revised after a game.

## OWED, NOT RUN

Every command below runs from the **main checkout** (`C:\Users\willj\Projects\Pokemon\ABRA`) after this branch merges.
Self-play, the screen and the SPRT play games. They need a ladder gap and the coordinator's say, and must not overlap a
ladder batch: the loop exits 3 and stops its own processes if one starts.

0. **The whole test, every break included, in a ladder gap** (it plays games, about 9 min at one worker):
   ```
   node solver\tests\test-n7-loop.js
   ```
   It must end `GREEN`, with every listed break at exit 1.
1. **Copy the frozen harness and the anchor data to the main checkout** (gitignored, about 1.6 GB; read-only sources).
   In PowerShell:
   ```
   $src = 'C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-aadbc255e960b0c50\solver\out\p2v3'
   $dst = 'C:\Users\willj\Projects\Pokemon\ABRA\solver\out\p2v3'
   New-Item -ItemType Directory -Force $dst | Out-Null
   Copy-Item -Recurse "$src\evalset" "$dst\evalset"
   Copy-Item -Recurse "$src\teacher" "$dst\teacher"
   Copy-Item -Recurse "$src\v2data"  "$dst\v2data"
   ```
2. **Dry run.** It must print every preflight `ok: true`, except "no ladder process running" when a ladder is up:
   ```
   node solver\machamp\n7\loop.js --prereg solver\machamp\n7\preregistration-gen1.json --dry-run
   ```
3. **Generation 1, in ladder gaps.** Run the same command again to resume after a pause (exit 3). It stops by itself at
   promotion or rejection:
   ```
   $env:ABRA_REGULATION='regmc'; cmd.exe /c tools\lownode.cmd solver\machamp\n7\loop.js --prereg solver\machamp\n7\preregistration-gen1.json
   ```
   Staged, if the coordinator prefers to see the offline gate before any game against the champion:
   ```
   $env:ABRA_REGULATION='regmc'; cmd.exe /c tools\lownode.cmd solver\machamp\n7\loop.js --prereg solver\machamp\n7\preregistration-gen1.json --stop-after offline
   $env:ABRA_REGULATION='regmc'; cmd.exe /c tools\lownode.cmd solver\machamp\n7\loop.js --prereg solver\machamp\n7\preregistration-gen1.json
   ```
   Status at any time: `node solver\machamp\n7\loop.js --prereg solver\machamp\n7\preregistration-gen1.json --status`.
4. **Read the outcome** from `solver/out/n7/n7g1/state.json` (`gens[0].status`) and the reads it names:
   `offline/verdict.json`, `screen/read.json` and `sprt/read.json`. Each is read once, at its stop, and was already
   applied by the loop.
5. **Generation 2 needs its own pre-registration** (`"generation": 2`, new seeds), written before its first game. The
   loop refuses to start it otherwise.
6. **The N7 exit is a separate, unregistered test:** the net's SPRT against the **pipeline** champion at the ladder's
   14 s clock. Nothing in this loop puts a net on a ladder arm.
7. `node engine/status.js --write` from the main checkout after the merge. It was not run here, because this is a
   worktree.
