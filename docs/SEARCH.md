# SEARCH — does MILTANK choose better than MAG

**Owns:** `engine/miltank.js`, `engine/rollout_leaf.js`, the bring/lead search, the opponent model,
the mega choice, post-KO replacement. Design notes in [MILTANK.md](MILTANK.md).

**Its one number:** the SPRT verdict against the named champion.

**May not:** fix an engine bug it trips over — file it in [ENGINE.md](ENGINE.md). Patching mechanics
mid-run silently invalidates the run, and the run still prints a result.

<!-- GENERATED: engine/status.js -->

```
SEARCH — does MILTANK choose better than MAG
  R1 leaf accuracy   PASS_ON_BASELINE — rollout 67.971% against material's 65.265% on 9,201 positions: +2.706 points, 95% CI 1.596 to 3.817   [explore=1.0 — THE ARM MILTANK RUNS]   (2026-08-04 07:34)
    RECORDED, not inferred: n=40, explore=1, key "40@1", stamped by the run that wrote the rows.
    SUPERSEDED 2026-08-04 by this artifact. That sentence was written when only the explore=0 dump existed, and it is TRUE OF THAT DUMP ONLY. This file IS the explore=1.0 arm, dumped over the same 9,201 positions and verified row for row, and on it the published figure reproduces: 67.971% against material 65.265%, +2.706 [1.596, 3.817] against the published +2.91 [1.79, 4.04]. The retraction was correct about PROVENANCE -- nothing committed could reproduce it at the time -- and wrong about the ARM. R1 is UNDECIDED on the incumbent greedy playout and PASSES on the arm engine/miltank.js:44 actually runs.
  R2 leaf cost       477 boards over 200 games   (2026-08-03 08:22)
    STAMP RECONSTRUCTED, NOT OBSERVED — inferred from commit 05248f23d306; HIGH — written 25s before the commit that carried it
      explore: NOT RECORDED AND NOT PASSED.
      maxTurns: NOT RECORDED AND NOT PASSED.
      games: The artifact's `games` field is the GAMES environment CAP, not a count of games traversed.
      machine: A duration is a fact about a machine under a load.
  R3 divergence      80.2% over 121 decisions (24 agreed, 29 skipped)   (2026-08-04 07:55)
    stamped: n=600@explore=1  (TREE WAS DIRTY — trust source_digests, not the commit)
  R4 does it win     ACCEPT H1 — arm 1 (MILTANK) beats arm 2 (MAG): 55.5% of 535 decisive pairs, 95% CI [51.3, 59.7], 2,624 games  [engine moved since; transfer assumed, not measured]   (2026-08-04 06:35)
  runs vs engine (newest engine source: engine/medicham2-browser.js 2026-08-04 08:29):
    PRE-CHANGE games.r4-decided.jsonl  2026-08-04 04:41
    PRE-CHANGE games.r4-fixed-part1.jsonl  2026-08-04 02:36
    PRE-CHANGE games.r4.jsonl  2026-08-04 02:33
    PRE-CHANGE games.r4-baseline.jsonl  2026-08-04 01:22
    PRE-CHANGE games.r4-smoke.jsonl  2026-08-04 00:45
```

_stamped 2026-08-04 08:33_

<!-- /GENERATED -->

## Read R4 correctly

R4 measured `--miltank-n 30`, uniform-random playout opponents, preview search disabled. It is a
**floor, not a description**. It does not say "the bot is good".

What it does say is the thing worth keeping: the pre-fix baseline on the broken engine was −0.28,
and the same search with the same flags came back positive once the model was fixed. **A search is
worth exactly what its model is worth.** That is why this division's open items are mostly about
what the search *believes*, not how deep it goes.

And note the `PRE-CHANGE` markers in the generated block: those runs predate the current engine
source. Under the frozen-release rule in [DIVISIONS.md](DIVISIONS.md) that is a re-run, not a
judgement call.

## The `--rollout-explore` default was re-earned, 2026-08-04

MEASURE retracted R1 that morning: the published `68.18%` had no artifact, and the only committed row
dump held the **explore=0** arm, on which R1 is UNDECIDED. `--rollout-explore` defaults to `1.0` and
two comments cite that retracted figure as the reason.

**It was re-run at explore=1 and it reproduces.** Artifacts:
`data/rollout-r1-explore-sweep.json` (the arm-vs-arm verdict, written by
`engine/rollout_explore_sweep.js`) and `data/rollout-r1-explore1.json` (the gate, written by the
existing `engine/rollout_r1_artifact.js` from `data/rollout-r1-explore1-rows.jsonl`).

| | explore=0 | explore=0.5 | explore=1.0 | material |
|---|---|---|---|---|
| accuracy, horizon 20 (9,201 positions) | 65.72% | 67.58% | **67.97%** | 65.27% |
| accuracy, horizon 60 (4,487 positions) | 64.21% | 66.50% | **67.46%** | 63.78% |
| ECE | 0.196 | — | **0.104** | 0.050 |
| share saturated in the 0–10 / 90–100 bin | 50.7% | — | **29.4%** | — |

Paired, on the identical sample: **+2.25 points, 95% CI [1.31, 3.19]**, monotone in explore at both
horizons. The published `68.18%` lands at `67.97%` and the published `+2.91` over material lands at
`+2.71 [1.60, 3.82]` — the retraction was right about the *provenance* and the claim survives it.

Three things the re-run settled that were not the question:

- **The committed greedy dump was NOT clobbered.** `DUMP=` resolves under `data/`, so the command
  MEASURE left would have overwritten the only evidence for the incumbent arm. New filename used.
- **The "64.42% for greedy" half does not reproduce** — greedy measures 65.7% on both the committed
  dump and a fresh run on the current engine. Same sign, gap 2.25 not 3.76. The two comments
  overstate it and should be restated against the artifact.
- **Unfinished playouts are not the mechanism.** `battleResult` does score bodies-then-HP whether or
  not the battle ended, but 99.5–99.8% of playouts end by an actual wipeout at every explore setting
  and at both horizons. Cap-hits are 0.2–0.5%. Exploration makes playouts *longer* (4.4 → 6.1 mean
  turns), not truncated.

**This is a verdict on a JUDGE, not on a player.** It does not say explore=1.0 wins more games, and
`engine/mew.js` exposes no `--miltank-explore`, so the A/B that would say is not currently runnable.
R4 was itself run at 1.0 and cannot arbitrate its own setting.

## The live budget is 45 SECONDS A DECISION, and nothing in this repo knew that

Real VGC runs a **7-minute chess clock** in doubles with a cap of **45 seconds on any one decision**.
That is the hard outer wall on every design decision in this division and it appeared **nowhere in
the repository** before 2026-08-04. It is recorded here so it stops being tribal knowledge.

Against it, what MILTANK ships:

| | shipped | the wall |
|---|---|---|
| in-game decision | `budgetMs` **20,000** | 45,000 ms |
| team preview | `previewMs` **15,000** | preview clock, separate — **NOT MEASURED**, do not assume 45 s |
| one leaf at n=200 | 141.85 ms | ~317 leaf calls fit in 45 s |
| one leaf at n=40 | 37.48 ms | ~1,200 leaf calls fit in 45 s |

Two things follow, and the second is the one that matters.

**Per decision, MILTANK is nowhere near the wall.** A ~63-cell menu at n=200 costs about 8.9 s. The
binding constraint on a single turn is `budgetMs`, which we chose, not the clock.

**Per GAME it may be well over it.** 7 minutes is 420 seconds for the WHOLE game. At `budgetMs`
20,000 that is **21 decisions before the clock is gone**, and VGC games routinely run longer. If the
45 s is drawn from the 420 s total rather than refunded — which is how a chess clock normally works,
but which **I did not verify against the official rules and it must be verified before this is acted
on** — then the shipped budget loses games on time and the search never gets blamed for it, because
a timeout says nothing about the player. The number to fix is `budgetMs`, and the arithmetic says
something nearer 420/expected-turns, not 20,000.

Nothing here is measured. It is the constraint written down plus arithmetic on it, and it is flagged
as such. PRIORITIES #36.

## Open

### 0. ~~The in-game leaf and the preview leaf are different players~~ — CLOSED 2026-08-04

MEASURE's calibration (2026-08-04) ranked the **preview** leaf at 53.22% (p<1e-4) and the **in-game**
leaf at 50.99% (p=0.47). Those were not two settings of one thing. `engine/miltank.js` held a
**second, hand-rolled playout loop** — `battleInit`/`battleTurn` directly, deterministic greedy on
both sides — that never called `rolloutWinProb`. MILTANK shipped two leaves and only one of them was
ever swept.

**There is now one playout.** `rollout_leaf.runPlayout` is the single implementation; both leaf
entry points call it, and the preview calls `rolloutWinProb` like everything else. What used to be a
second implementation is now three parameters:

| | preview before | preview now | why |
|---|---|---|---|
| playout policy | deterministic greedy, both sides | `explore` (default = the in-game 1.0) | one player, not two. `previewExplore: 0` restores greedy |
| opponent model | `chooseAction`, ignored `--miltank-foe` | `foePolicy` — the flag now reaches preview | the foe A/B was silently not running at preview |
| game start | `battleInit({seeded:true})` on a game that had not started | `seeded:false` | see item 1 below |
| horizon | hardcoded 60 | `turns` | it happened to agree; now it cannot drift |
| dice across brings | a fresh seed per bring | **common random numbers**, one seed for the whole preview | each bring was judged on its own independent draws, so the difference between two brings sat under the noise. Same fix, same reason, as `replSeed` in the post-KO search |

**This changes what the bot leads with, and the 53.22% no longer describes a policy that ships.**
That figure was measured on the greedy loop; it is now a number about a deleted implementation and
must not be quoted for the shipped preview. Re-measuring it is MEASURE's, after the release boundary.

Two things this does NOT settle. The old 53.22%-vs-50.99% contrast was also measured on different
position distributions (fresh full teams against mid-game boards), so it was confounded twice over
and unifying removes only one of the confounds. And nothing has measured that preview *wants*
explore=1.0 — defaulting it there is a decision to have one player until something says otherwise.

### 0b. The preview enumerated brings it could not field — fixed the same pass

Caught by the smoke run for the unification, not by anything that was watching. The bring enumerator
mixed **positions in the buildable list** with **team indices**: the lead pair came from one and the
back pair from the other. They coincide when all six Pokemon build, which is why it survived. On a
team with two unbuildable bodies, measured:

- 19 brings enumerated where exactly **6** exist
- **18 of the 19** named a Pokemon the search had just printed as unbuildable
- 15 "distinct" brings out of a true set of 6

and the missing body was then silently dropped by `.filter(Boolean)`, so a **three**-Pokemon bring
was scored and reported as a four-Pokemon one. Full six-buildable teams enumerate 90 before and
after, so this only ever bit the case the "drop what cannot be built" path exists for.

### 1. The preview seeded a game that had not started — fixed 2026-08-04

`chooseTeamPreview` called `battleInit(..., {seeded: true})`. `seeded` exists to stop a **mid-battle**
leaf re-firing entry effects that already happened — re-running Intimidate would drop the same Attack
a second time on every board with an Incineroar. At team preview nobody has entered yet, so it
suppressed the entry effects entirely, and those are most of what a lead decision *is*. Deciding a
lead is largely deciding who eats an Intimidate, and the search could not see one.

Measured directly against the engine, Torkoal + Incineroar leading into Garchomp + Gholdengo:

```
seeded=true    weather=null    weatherT=0    foe atk stages=[0, 0]
seeded=false   weather="sun"   weatherT=5    foe atk stages=[-1, -1]
```

So before the fix every preview playout ran with **no Drought, no Drizzle, no Sand Stream, no Snow
Warning, no terrain setter and no Intimidate on turn one** — the whole switch-in-ability class,
deleted, in the one decision they matter most for. Fixed by making `seeded` a parameter of
`rolloutWinProb` (default unchanged at `true`) and passing `false` from preview only.

### 1b. Opponent model — the A/B in flight

Playouts move uniformly at random. Real Charizard clicks Protect 60.6% of the time, not 25%.
`--miltank-foe prior` exists and is being compared against uniform; shards land in
`data/.mew-shards/foe-s*.jsonl`.

If prior wins this changes every evaluation in the project, because every leaf number was computed
against a foe that does not exist.

Counter-consideration, and it is not small: a fully random rollout has repeatedly judged *better*
than a greedy one. Do not assume a more realistic playout is a better estimator — that is exactly
what the A/B is for. Read it at the bound.

### 2. Which mega to take

Currently "the lead keeps it", which is arbitrary. It should be a search decision, and it is cheap
to make one — only two-stone brings branch at all.

"Biggest stat gain" was **measured and discarded**: every Champions mega is +101 to +104. Do not
re-propose it.

### 3. Team quality

`--meta-teams` yields 169 teams, but the base filter is **completeness, not quality** — so the pool
contains Mickey Mouse teams: real, open-sheet, and still terrible. The pool is announced on every
start, on or off. Read the announcement before attributing a result to a lever.

### 4. Leaf calibration blocks everything here

Every decision this division makes is an argmax over the leaf. If the leaf is uncalibrated, a
better search is a better-aimed error. This is MEASURE's item, not SEARCH's — but SEARCH should
know that a null result here may not be about the search at all.

### 5. `applyMegaWeather` has never done anything on the seeded path — FILED, not fixed

`engine/rollout_leaf.js` calls `applyMegaWeather(S)` to give a mega its own weather (a stone-holder
is built as its MEGA FORME, so the rollout assumes the mega happened while the sun it brings never
fires). Both leaves then assign the caller's field over the top — `S.field.weather = f.weather || ''`
— **unconditionally**. `battleInit({seeded:true})` leaves `S.field.weather` null, so the guard
`if (S.field.weather) return` never fires, the function always runs, and its write is always
overwritten a line later. Mega Charizard Y has stood in clear weather in every mid-battle rollout
this project has ever run, with every Fire move and every Solar Beam mispriced for the whole playout,
and the comment above the function describes behaviour the code does not have.

**Deliberately not fixed in the unification pass.** Correcting it moves every in-game leaf value on
~26% of this format's usage; that is a measured change, and landing it in the same pass as a change
to the preview leaf would confound exactly the contrast the unification exists to clean up. It also
must not land while ENGINE is mid-flight. The fix is to apply the caller's field *before*
`applyMegaWeather` instead of after, guarded so a real weather already on the board still wins. Do it
after the release boundary, with an R1 re-run beside it.

The unseeded preview path does not need it: the entry effects fire for real there, so
`applyMegaWeather` is a genuine no-op rather than a discarded write.

## R5 — the action-ranking backtest. SPEC. NOT RUN.

**This is the measurement nobody has done, and it is the one that decides whether the rollout leaf
is worth its 142 ms.** Every leaf number produced so far — R1, the explore sweep, the calibration —
scores a **predictor of a game outcome from a fixed position**. A search leaf is asked something
different: *which of ~63 candidate joint actions is best*. Those are not the same job. **Two leaves
with identical Brier can order actions completely differently**, and ordering is the only thing a
search consumes.

### The question, and what is NOT being asked

> At a real decision point, does `rolloutWinProb` **order** the expressible joint actions differently
> from `materialP` on the post-action board?

Not "which is more accurate" — that is R1 and it is answered. **Do not size this as a superiority
test.** At R1's effect size a decision-level superiority test needs roughly **190,000 decisions**;
this run is ~2,000 and would be catastrophically underpowered for that question. Agreement needs no
effect size, which is the whole reason this is the affordable measurement.

### Procedure

1. **Sample.** Walk clean corpus games with the same `JR.build` walker `engine/rollout_r2.js` and
   `rollout_r3.js` use. Take every 3rd board so one long game cannot dominate. Target **~2,000
   decision points**. Record the game id on every row — the analysis clusters on it.
2. **Enumerate the menu the search actually sees.** `board.js` `candidates()` per slot, then the
   *same* expressibility filter `miltank.js` applies: drop anything MEDICHAM resolves as `pass`, and
   drop a pure-status click whose every effect is refused. Offering a cell the engine cannot express
   makes distinct options collapse into one and the agreement rate becomes an artefact. Corpus median
   is ~8 options a slot, so ~63 joint cells.
3. **Score each cell twice, on the SAME dice.** One seed per decision point, shared across all cells
   — common random numbers, the same variance reduction the post-KO search already uses. Without it
   the disagreement set is mostly noise.
   - **rollout:** `RL.rolloutAfterActions(board, side, {n: 200, explore: 1.0, foePolicy: 'uniform',
     maxTurns: 60, myClicks, seed, dex, field})`.
   - **material:** step **one turn** with the same forced clicks and the same seed, then evaluate the
     material estimator on the **post-action** board. It must be the post-action board: scored on the
     pre-action board, material returns the same number for every cell and has no ordering at all,
     which would produce a meaningless 100% disagreement. Because the stepped turn is stochastic,
     average it over **m = 8** steps under the same seed and report `m`.
   - **Use the material estimator R1 was scored against — the existing one, by name, wherever it
     lives.** Do not write a second one. FACTS ARE GLOBAL; two implementations of "count the bodies"
     will disagree eventually and the disagreement will be invisible. Stamp which file it came from.
4. **Per decision point, record:** Spearman rho, Kendall tau-b (ties matter — a rollout at n=200 has
   granularity 1/200 and material is coarser still), whether the two argmaxes are the same **cell**,
   whether the rollout's argmax is inside material's top 3, and the rollout argmax's rank under
   material.
5. **Across decision points, report WITH INTERVALS — not a winner.** Mean rho and mean tau with a
   95% CI, and the argmax-agreement rate with a 95% CI. **Bootstrap clustered on GAME, not on
   decision.** Decisions inside one game are not independent and treating them as such is the single
   easiest way to publish an interval three times too narrow here.

### The decision rule, stated before the run

- **If argmax agreement is ~90% or higher and the lower CI bound holds above ~85%**, the two leaves
  choose the same action almost always and the 142 ms is **provably wasted as an action ranker**.
  That is a real, publishable, negative result and it redirects the division onto the leaf itself.
- **If they disagree materially**, the **disagreement set is the sample the H2H should then run on** —
  those positions and only those are where the two players differ, which is a far cheaper and far
  sharper H2H than 420 random games.

### Cost, and why ~2,000 is the size

| | per leaf call | per decision (~63 cells) | 2,000 decisions |
|---|---|---|---|
| n=200, explore=1.0, maxTurns=60 | 141.85 ms | 8.94 s | **~5.0 h**, one process |
| n=40 screen | 37.48 ms | 2.36 s | **~1.3 h**, one process |

Both leaf costs are R2's, and R2 is itself under re-run (PRIORITIES #14) — treat them as the order of
magnitude, not as the figure. A 40-rollout screen followed by n=200 on the survivors is the cheap
version, but note it changes the question: it measures agreement on the *shortlist*, not on the menu.
Run the full version if it can be afforded.

### Running it

Four processes, not six — ENGINE is live and PRIORITIES sets the working cap at 4. Shard by game id
modulo 4, one JSON row per decision point:

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  SHARD=<0..3> SHARDS=4 N_DECISIONS=500 ROLLOUT_N=200 EXPLORE=1.0 MAXTURNS=60 \
  node --max-old-space-size=4096 engine/rollout_r5.js --out data/.r5-shards/r5-s<0..3>.jsonl
```

Cat the shards, then reduce once. **Read it at the bound, once.**

### What the run must stamp on itself, or it is not evidence

`n`, `explore`, `foePolicy`, `maxTurns`, `m`, the engine source digest, the material estimator's file
and function, the corpus id and the team-pool announcement, node version and machine, and
`n_measured` / `n_unit` — PRIORITIES #20 records R1 and R4 missing exactly those two fields; do not
make it three.

**Run it after the P0.5 release boundary.** Started before, it is born `PRE-CHANGE` and describes a
build that stopped existing — which is already true of every R4 shard on disk.

## Running a comparison

Levers are **per arm**, and **arm 1 is the challenger** — check `winnerWeights` before ever
"fixing" an analyser that looks broken. SPRT-gate it and read it at the bound, never during.

Size the run to the question: an H2H decides in roughly 420 games, not 200,000.

## Done looks like

- A gated, artifact-backed SPRT verdict against a **named engine release**, not against HEAD.
- Every arm's flags recorded in the run, so a result can be attributed to a lever without guessing.
- The opponent-model A/B read once, at the bound, and written to an artifact.

## Where this is going

`docs/MILTANK.md` §3.1 explains why the current best-response player is exploitable by construction.
An opponent-aware playout is the first step toward an equilibrium player; ship it only if the A/B
says so.
