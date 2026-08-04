# SEARCH — does MILTANK choose better than MAG

**Owns:** `engine/miltank.js`, `engine/rollout_leaf.js`, the bring/lead search, the opponent model,
the mega choice, post-KO replacement. Design notes in [MILTANK.md](MILTANK.md).

**Its one number:** the SPRT verdict against the named champion.

**May not:** fix an engine bug it trips over — file it in [ENGINE.md](ENGINE.md). Patching mechanics
mid-run silently invalidates the run, and the run still prints a result.

<!-- GENERATED: engine/status.js -->

```
SEARCH — does MILTANK choose better than MAG
  R1 leaf accuracy   UNDECIDED — rollout 65.721% against material's 65.265% on 9,201 positions: +0.456 points, 95% CI -0.717 to 1.63   (2026-08-04 07:09)
    THE DUMPED COLUMN IS THE DETERMINISTIC-GREEDY PLAYOUT (explore=0).
    The published +2.91 gate result cannot be recomputed from anything committed. What survives is the incumbent arm of that comparison, and on it R1 is UNDECIDED.
  R2 leaf cost       477 boards over 200 games   (2026-08-03 08:22)
    STAMP RECONSTRUCTED, NOT OBSERVED — inferred from commit 05248f23d306; HIGH — written 25s before the commit that carried it
      explore: NOT RECORDED AND NOT PASSED.
      maxTurns: NOT RECORDED AND NOT PASSED.
      games: The artifact's `games` field is the GAMES environment CAP, not a count of games traversed.
      machine: A duration is a fact about a machine under a load.
  R3 divergence      72.9% over 70 decisions (19 agreed, 20 skipped)   (2026-08-03 20:25)
    STAMP RECONSTRUCTED, NOT OBSERVED — inferred from commit b4ec80b1c52d; HIGH — written 159s before the commit that carried it
      noise_floor: THE CONTROL IS MISSING.
      switches: THE ARTIFACT'S CAVEAT IS FALSE ABOUT THE RUN IT DESCRIBES.
      EVERY: The decision-sampling stride is an environment variable and is not recorded.
  R4 does it win     ACCEPT H1 — arm 1 (MILTANK) beats arm 2 (MAG): 55.5% of 535 decisive pairs, 95% CI [51.3, 59.7], 2,624 games  [engine moved since; transfer assumed, not measured]   (2026-08-04 06:35)
  runs vs engine (newest engine source: engine/medicham2-browser.js 2026-08-04 04:47):
    PRE-CHANGE games.r4-decided.jsonl  2026-08-04 04:41
    PRE-CHANGE games.r4-fixed-part1.jsonl  2026-08-04 02:36
    PRE-CHANGE games.r4.jsonl  2026-08-04 02:33
    PRE-CHANGE games.r4-baseline.jsonl  2026-08-04 01:22
    PRE-CHANGE games.r4-smoke.jsonl  2026-08-04 00:45
```

_stamped 2026-08-04 07:46_

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

## Open

### 0. The in-game leaf and the preview leaf are different players

MEASURE's calibration (2026-08-04) ranks the **preview** leaf at 53.22% (p<1e-4) and the **in-game**
leaf at 50.99% (p=0.47). Those are not two settings of one thing. `engine/miltank.js:216-222` is a
**second, hand-rolled playout loop** — `battleInit`/`battleTurn` directly, deterministic greedy on
both sides — that never calls `rolloutWinProb`. So MILTANK ships two leaves with different playout
policies and only one of them was ever swept.

The two are also measured on different position distributions (fresh full teams against mid-game
boards), so the contrast is confounded and is **not** evidence against explore=1.0 on its own. What
it is evidence for is that the preview loop should call the same leaf as everything else.

### 1. Opponent model — the A/B in flight

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
