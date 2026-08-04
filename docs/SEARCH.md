# SEARCH — does MILTANK choose better than MAG

**Owns:** `engine/miltank.js`, `engine/rollout_leaf.js`, the bring/lead search, the opponent model,
the mega choice, post-KO replacement. Design notes in [MILTANK.md](MILTANK.md).

**Its one number:** the SPRT verdict against the named champion.

**May not:** fix an engine bug it trips over — file it in [ENGINE.md](ENGINE.md). Patching mechanics
mid-run silently invalidates the run, and the run still prints a result.

<!-- GENERATED: engine/status.js -->

```
SEARCH — does MILTANK choose better than MAG
  R1 leaf accuracy   joined 230, dropped 7007 misaligned, k=200   (2026-08-03 08:14)
  R2 leaf cost       477 boards over 200 games   (2026-08-03 08:22)
  R3 divergence      72.9% over 70 decisions (19 agreed, 20 skipped)   (2026-08-03 20:25)
  R4 does it win     ACCEPT H1 — arm 1 (MILTANK) beats arm 2 (MAG): 55.5% of 535 decisive pairs, 95% CI [51.3, 59.7], 2,624 games  [engine moved since; transfer assumed, not measured]   (2026-08-04 06:35)
  runs vs engine (newest engine source: engine/medicham2-browser.js 2026-08-04 04:47):
    PRE-CHANGE games.r4-decided.jsonl  2026-08-04 04:41
    PRE-CHANGE games.r4-fixed-part1.jsonl  2026-08-04 02:36
    PRE-CHANGE games.r4.jsonl  2026-08-04 02:33
    PRE-CHANGE games.r4-baseline.jsonl  2026-08-04 01:22
    PRE-CHANGE games.r4-smoke.jsonl  2026-08-04 00:45
```

_stamped 2026-08-04 06:37_

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

## Open

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
