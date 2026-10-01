# PORYGON2 v2 at the 14 s clock, and the gen5 baselines under `role-v1` (2026-10-01, abra/regmc 1.55.0)

SOLVER. Will delegated the choice of runs to the coordinator ("u choose", 2026-09-30), and the coordinator chose these
two. Branch `worktree-agent-a29208774c274090e`, run on main `e6e901a3` (1.50.0, which includes 1.49.0's `role-v1`
arena). origin/main was merged only after every run had stopped. This was the only game-playing job. Every heavy
step ran at BelowNormal through `tools\lownode.cmd`, launched through a node `spawnSync` with an argument vector, as
that file's header says to do from Bash.

**This is the NEW arena series.** Every game here fields `role-v1` true bodies (table
`solver/arena/spreads/role-v1.json`, sha256 `145edf08…` as stamped by every run, 0 derived at play time, 0 flat).
No figure here may be compared with an arena figure from before 1.49.0, and that includes the 1 s v2 SPRT (1.50.0,
xatu-random truth).

## Verdict

- **Run 1 (v2 as gen5's leaf vs gen5's own net, 14 s adaptive): it stops at the screen, and the SPRT was not run.**
  - **Path.** The screen went first. A 14 s SPRT at 2,000 games is about 30 h on 3 workers (54.0 s a game in
    1.50.0's piKL SPRT), which is at the brief's line. v2's evidence also already points against it.
  - **Result.** 200 games, **0.495 [0.426, 0.564]**, 99–101.
  - **Why it stopped.** Two clauses fail the pre-registered continue rule:
    - the point score is below 0.5;
    - the **clock ratio is 1.104**, over the 1.10 bar, so the screen is **VOID by its own rule** in any case.
  - **The leaf ran.** v2 served 805,441 leaf calls, equal to its own evals, with 0 errors. gen5's net served 1,893,120.
  - **No strength claim either way.**
- **Run 2a (gen5 vs gen0-r2, the predecessor; re-run on seed 9001, honest, `role-v1`): H0, labelled DEGRADED.**
  - **Result.** 1,098 games, **0.497 [0.468, 0.527]**, LLR −3.010. Clock ratio 1.020.
  - **The search was starved for about the first 40% of the run.**
    - 24.3% of searched decisions fell back to the prior (4,467 of 18,422). 3,041 had zero playouts.
    - There were 45.5 playouts per searched decision. 1.50.0's 1 s gen5 had 213.4.
    - X's decision mean was 1,567 ms on a 1,000 ms budget, and 2 decisions went over 55 s.
  - **The cause was machine load.** Node processes this agent did not start were using CPU, and the machine read
    54–77% busy.
  - **Status.** No pre-registered clause made the run VOID, so it is reported as read. It does **not** measure "gen5
    at 1 s against gen0-r2".
- **Run 2b (gen5 1 s vs the human clone; re-run on seed 26001, `role-v1`): H1.**
  - 90 games, **0.711 [0.610, 0.795]**, 64–26.
  - 0 prior fallbacks, 184.2 playouts per searched decision, 0 clock breaches.
- **Run 2c (gen5 5 s vs the human clone; re-run on seed 26005, `role-v1`): H1.**
  - 102 games, **0.667 [0.571, 0.751]**, 68–34, LLR 2.971.
  - 0 prior fallbacks, so it passes the addendum bar of ≤ 5%. 1,240.5 playouts per searched decision, 0 clock breaches.
- **Nothing here is on a ladder arm, and nothing changes one.**

## 1. Pre-registration

- **Run 1:** `solver/results/2026-10-01-v2-14s-rolev1/preregistration.json`, with the X spec
  `gen5-p2v2-adaptive-14s.json`. Both were committed in `b92d1892` and pushed before the first game.
- **Run 2:** `solver/results/2026-10-01-rolev1-baselines/preregistration.json`, in the same commit.
- **The R2c addendum:** `addendum-r2c.json`, commit `187ef06f`. It was written after R2a was read and while R2b was
  running, before R2c's first game. It adds one VOID bar for R2c only: prior-fallback share > 0.05.
- **Common to all four runs:**
  - release `eaa5becc54eb` (`97451d5fbf40` also passes the gate; the older one was kept for comparability);
  - the store `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`, TEST pairs (pool digest
    `792daded918f`, `games.bo3.jsonl` `a68263bb568d`);
  - `--info honest`, `--spreads role-v1` (passed explicitly), `--cap 50`.
- **The SPRTs:** elo0 0, elo1 20, α = β = 0.05, max 2,000, 3 workers.

| run | X | Y | seed | clock | what differs from the original |
|---|---|---|---|---|---|
| 1 screen | `gen5-p2v2-adaptive-14s.json` (sha256 `07e17335…`) | `screen-14s-off.json` (`da5e50f4…`) | 31001 (new) | adaptive 14 000 / 4 667, cap 5 000 | — (new question) |
| 1 SPRT | same | same | 31002 (new) | same | **not run** |
| 2a | `league/gen5.json` | `league/gen0-r2.json` | 9001 (original) | 1 000 ms both | spreads flat → role-v1 **and** information omniscient → honest (the original predates honest mode) |
| 2b | `league/gen5.json` | `league/human-clone.json` | 26001 (original) | 1 000 ms | spreads xatu-random → role-v1 only |
| 2c | `champ-vs-doduo/gen5-5s.json` | `league/human-clone.json` | 26005 (original) | 5 000 ms | spreads xatu-random → role-v1 only |

- **The X and Y specs differ only in `pory2` and `name`.** This was checked by deleting both fields from each spec
  and comparing what was left.
- **The 1.49.0 report's OWED command for 2a named seed 30001.** The piKL SPRT has since used that seed, so 2a runs on
  the original's seed, 9001.

## 2. Results

| | 1 screen | 2a | 2b | 2c |
|---|---|---|---|---|
| verdict | **stop: not continued** (VOID by clock; point < 0.5) | **H0 (DEGRADED)** | **H1** | **H1** |
| games counted | 200 (fixed) | 1,098 (549 pairs) | 90 | 102 |
| W–L | 99–101 | 546–552 | 64–26 | 68–34 |
| score [Wilson 95%] | 0.495 [0.426, 0.564] | 0.497 [0.468, 0.527] | 0.711 [0.610, 0.795] | 0.667 [0.571, 0.751] |
| pairs both / split / lost | 18 / 63 / 19 | 97 / 352 / 100 | 21 / 22 / 2 | 19 / 30 / 2 |
| LLR at stop | — | −3.010 | (H1 bound) | 2.971 |
| played past the stop | — | 30 | 8 | 8 |
| errored | 0 | 0 | 0 | 0 |
| X ms mean (budget) | 10,307 (adaptive) | 1,567 (1,000) | 952 (1,000) | 4,712 (5,000) |
| Y ms mean | 9,336 | 1,536 | 35 (no search) | 32 (no search) |
| clock ratio | **1.104** | 1.020 | n/a (Y greedy) | n/a |
| X decisions > 55 s / games > 420 s | 0 / 0 (max game 227 s) | **2** / 0 | 0 / 0 | 0 / 0 |
| playouts per searched decision | — | **45.5** | 184.2 | 1,240.5 |
| prior-fallback share | — | **0.2425** | 0 | 0 |
| agent fallbacks | 0 | 0 | 0 | 0 |
| PORYGON2 leaf calls | v2 805,441 (= own evals, 0 errors); gen5 1,893,120 | gen5 298,591; v0 300,054 | gen5 99,988 | gen5 712,262 |
| bodies dressed role-v1 / derived / flat | 1,600 / 0 / 0 | 8,784 / 0 / 0 | 720 / 0 / 0 | 816 / 0 / 0 |
| wall | 8,952 s | 10,580 s | 276 s | 1,354 s |

The reads are in `solver/results/2026-10-01-v2-14s-rolev1/screen-read.json` and
`solver/results/2026-10-01-rolev1-baselines/r2{a,b,c}-*-read.json`. Shards are under
`solver/out/{v2-14s-rolev1,spreads-v1}/`, which git ignores.

## 3. Reading

**Run 1: v2 is not shown to help at the ladder clock either.**
- The screen is a coin flip, 0.495.
- The X arm used **10% more wall-clock** than Y: mean 10,307 ms against 9,336, with p50 8,461 against 4,629. The
  adaptive clock gives more time to a decision whose search has not settled. v2's slower leaf means fewer playouts
  per second, so its decisions run longer.
- So the arms were not at equal clock, and X had the larger share. Even so, X did not score above 0.5.
- By the pre-registered rule the screen is VOID on the clock alone, and the point score fails the brief's rule too.
  The two clauses lead to the same place: no SPRT.
- What is left of the question is a cheaper v2 forward pass. Without one, the adaptive clock turns v2's cost into a
  time advantage that buys nothing.

**Run 2a: the result stands as read, and it is not evidence about gen5 against gen0-r2.**
- The 1,098 games were played on a partly starved search.
- Bucketed in shard-line order (pair-index order, which is the order the SPRT reads), the share of games with
  X ms mean > 1,200 ms was:
  - 75–80% in the first tenth;
  - 50–60% in the fourth;
  - 0–3% in the last two.
- In the starved games both arms mostly played the prior: MAG/DODUO gen5 against MAG v1/DODUO v1.
- **One more confound.** The original acceptance (0.528, H1 at 1,268) was omniscient on flat bodies. This re-run is
  honest on role-v1. So even a clean H0 would not be one quantity moving.
- **Owed:** a re-run on a quiet machine, with a capability bar written into the pre-registration (§OWED).

**Runs 2b and 2c: gen5's margin over the human clone survives real spreads.**
- 1 s: 0.711 against 0.71 on xatu-random truth (H1 at 100 games, 2026-09-26).
- 5 s: 0.667 against 0.712 (H1 at 104).
- Both stopped at H1 within about 100 games, and both CIs overlap their originals. These are separate series, so the
  numbers are not read as a before/after.
- The search ran cleanly in both: 0 fallbacks, and playouts per searched decision of 184 and 1,240 (the originals had
  85 and 551).
- **Inferred, not measured:** role-v1's playout rate is no slower than xatu-random's. That is consistent with R2a's
  slowdown being load rather than the spread mode, which 2b and 2c rule out as a cause.

## 4. Process notes

- **The harness refuses a bare `cmd.exe` in this worktree.** Heavy runs were launched as
  `node <scratchpad>/low.js <log> <script> <args…>`, which calls `spawnSync('cmd.exe', ['/c', 'tools\\lownode.cmd', …])`.
  That is the argument-vector route the `lownode.cmd` header prescribes from Bash. Exit codes propagated: every run
  exited 0.
- **The other CPU users.** The node processes this agent did not start (for example pid 24744: 20 min of CPU at
  04:07 local) were not identified or touched. The process list's command lines could not be read from this
  worktree.
- **The pre-commit generated-bundle gate** ran inside each results commit while games were playing. It is about
  1–2 min of extra load and is not the cause of R2a's long starved stretch.

## OWED, NOT RUN

1. **R2a again, on a quiet machine, under a new pre-registration.** Keep seed 9001, honest and role-v1, and add a
   VOID bar: prior-fallback share > 0.05. It is the coordinator's call whether a second look on the same seed is
   wanted. Command:
   `node solver/machamp/sprt.js (through tools\lownode.cmd) --release eaa5becc54eb --x solver/machamp/league/gen5.json --y solver/machamp/league/gen0-r2.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9001 --workers 3 --cap 50 --info honest --spreads role-v1 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/spreads-v1/sprt-gen5-vs-gen0r2-rolev1-r2.json`
2. **A capability bar in every future SPRT pre-registration** (a prior-fallback share, and a playouts floor). Only
   R2c had one. A starved search is a capability that did not run, and nothing caught it until the read.
3. **The v2 14 s SPRT:** not licensed by the screen. It needs a cheaper v2 forward pass first, for example caching the
   per-member token facts within a decision.
4. **The other 1.49.0 re-runs** this brief did not name: CHOMP v2's gate (a) with a spread arm, and the role-v1
   self-play corpus.
5. `node engine/status.js --write` from the main checkout after merge. It was not run here because this is a worktree.
