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
  R4 does it win     ACCEPT H1 — arm 1 (MILTANK) beats arm 2 (MAG): 55.5% of 535 decisive pairs, 95% CI [51.3, 59.7], 2,624 games  [engine moved since; transfer assumed, not measured]   (2026-08-04 08:43)
  runs vs engine (newest engine source: engine/medicham2-browser.js 2026-08-04 19:42):
    PRE-CHANGE games.r4-decided.jsonl  2026-08-04 04:41
    PRE-CHANGE games.r4-fixed-part1.jsonl  2026-08-04 02:36
    PRE-CHANGE games.r4.jsonl  2026-08-04 02:33
    PRE-CHANGE games.r4-baseline.jsonl  2026-08-04 01:22
    PRE-CHANGE games.r4-smoke.jsonl  2026-08-04 00:45
```

_stamped 2026-08-04 19:43_

<!-- /GENERATED -->

## What the 2026-08-04 mega-weather fix invalidates

Stated plainly rather than left to be inferred, because a leaf change that moves values and is not
declared is how a stale number survives. **Everything below was computed on a leaf in which a mega
never brought its weather.** None of it is wrong about its own arm; all of it describes a build that
no longer exists.

| | why it is affected | what it needs |
|---|---|---|
| **R1** leaf accuracy, and the explore sweep | every position scored through `rolloutWinProb`; 6.4% of corpus boards carry a mega setter in clear weather and move by ~9.7 pt | re-run at the release boundary. The *sign* is very unlikely to move; the point estimate will |
| **R2** leaf cost | already under re-run (PRIORITIES #14). Cost measured unchanged here (17.53 → 16.93 ms at n=40), so this fix is not the reason | nothing extra |
| **R3** divergence | `rolloutAfterActions` moved on the same boards, by more (mean \|Δ\| 18.3 pt at n=24) | re-run |
| **R4** the SPRT | every leaf call in both arms | re-run. Note both arms shared the defect, so it partly cancels — which is precisely the failure mode CLAUDE.md names, and is not a reason to keep the number |
| the **leaf calibration** (53.22% / 50.99%) | already void for the preview under PRIORITIES #38; the in-game half is now void too | MEASURE, after the boundary |

**This is a release-boundary matter, not a footnote** — PRIORITIES P0.5. The runs on disk were
already `PRE-CHANGE` against the engine; they are now `PRE-CHANGE` against the leaf as well, and the
leaf is SEARCH's own file. Do not start a wide run until the boundary is cut.

**And a caution the parity does not cover.** `docs/SEARCH.md` item 5b records that the board's
weather string has never meant anything to MEDICHAM. Until that is fixed, **a re-run of R1/R3/R4
would still be measuring a leaf that is blind to 60.8% of boards' weather.** Sequencing the two
matters: fixing 5b after re-running the gates buys a second round of invalidation.

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

## The live budget — SETTLED 2026-08-04 from the Showdown source, and it was not 45 seconds

This section previously said "a 7-minute chess clock with a 45-second cap on any one decision",
flagged as an **unverified rules assumption** (PRIORITIES #39). It has now been read out of the
implementation we actually play against, and **two of its three numbers were wrong**. Correcting the
diagnosis, not just the number:

`config/formats.ts` gives `[Gen 9 Champions] VGC 2026 Reg M-B` the ruleset
`['Flat Rules', 'VGC Timer', 'Open Team Sheets']`. `data/rulesets.ts` `vgctimer` is, verbatim:

```
Timer Starting = 420      Timer Grace = 90          Timer Add Per Turn = 0
Timer Max Per Turn = 55   Timer Max First Turn = 90
Timeout Auto Choose       DC Timer Bank
```

and `server/room-battle.ts` says what those do:

| fact | line | consequence |
|---|---|---|
| `secondsLeft = starting + grace` | `:210` | the bank is **510 s**, not 420 |
| `turnSecondsLeft = Math.min(secondsLeft, maxTurnTime)` | `:327` | **the per-turn cap is DRAWN from the bank.** One clock, not two |
| `addPerTurn` = 0, and `updateTurn` adds it | `:306` | **no refill.** A true bank, exactly as feared |
| `maxPerTurn` = 55 | ruleset | the per-decision wall is **55 s**, not 45 |
| `maxFirstTurn` = 90 | `:326` | **team preview gets 90 s**, from the same bank |
| turn expires, bank alive → `>{slot} default` | `:451-453` | a **server-chosen move**, not a loss |
| bank hits 0 → `forfeitPlayer(..., ' lost due to inactivity.')` | `:455` | **you lose the game** |

### Three further facts read on 2026-08-04, two of which correct the table above

The section above was right that the clock is one drawn bank and wrong about its size. Corrected
against the source rather than argued:

**1. THE BANK IS 420 s, NOT 510. The grace is use-it-or-lose-it and is not bankable.** `:209` does
initialise `secondsLeft = starting + grace = 510`. But `updateTurn` at `:305-306` runs

```
player.secondsLeft = Math.min(player.secondsLeft + addPerTurn, this.settings.starting);
```

on **every new turn**, `addPerTurn` is 0 and `starting` is **420**. So `Math.min(510, 420)` fires on
the second timed request and the 90 s of grace is *clamped away*. It is spendable only on the first
timed request. `updateTurn` returns early the very first time (`:270-274`, `this.turn === null`), which
is exactly why the clamp lands on the second request and not the first.

**Consequence: `budgetMs: 20000` buys 21 decisions, not 24.** The figure this file replaced —
"21 decisions" — was right by accident, off a wrong premise; the corrected derivation is 420,000 /
20,000 = 21, with preview free because it comes out of the grace that is about to be clamped anyway.

**2. THE BANK DOES NOT TICK WHILE THE TIMER IS OFF, so the mid-game switch-on is benign.**
`secondsLeft` is decremented only inside `nextTick` (`:353`), which is scheduled only by
`nextRequest` (`:341`), which returns at `:320` when `!this.timerRequesters.size`. `start()` then
calls `nextRequest` itself (`:239-240`). So an opponent typing `/timer on` at turn 9 **does not find
a bank MILTANK has already spent** — it finds a full one, and the 90 s `maxFirstTurn` allowance is
granted on whatever turn the timer starts, because `isFirstRequest` (`:167`, `:326`) is still true.
The premise that the constraint arrives with unknown consumption already charged is **false**, and
that makes the design easier rather than harder.

**3. THE UNIT THAT SPENDS THE BANK IS A REQUEST, NOT A TURN.** A post-KO replacement is its own
request with its own 55 s window off the same bank — `updateTurn` returns at `:286` for a mid-turn
request without clamping and without adding. So a game with KOs has more requests than turns, and
"expected remaining decisions" must be estimated in **requests**. Charging is also quantised:
`TICK_TIME = 5` (`:41`) and each tick subtracts five whole seconds, so 12 s of thinking costs 15 s.

### What MILTANK can and cannot observe about the clock

**It can observe the bank exactly, and that was the surprise.** `room-battle.ts:332` sends the
player, privately, on **every request while the timer is on**:

```
|inactive|Time left: 55 sec this turn | 420 sec total | 90 sec grace
```

so `turnSecondsLeft` and `secondsLeft` are both **observed, not inferred**. Two parsing traps: the
`total` field is `secondsLeft - grace` (`:330-332`), so the true bank is `total + grace` and reading
`total` alone under-reads by 90 s; and the grace field is simply absent once it is gone.
`|inactive|Battle timer is ON:` (`:237`) and `|inactiveoff|Battle timer is now OFF.` (`:257`) bracket
the on/off state, and both are room-level so both players see them.

**But nothing reads any of it.** `engine/mag_bot.js` handles **zero** `|inactive|` lines — grepped,
not assumed. So the capability exists in the protocol and is absent from the bot, which is CLAUDE.md's
signature failure shape verbatim. `engine/miltank.js` now exposes `bot.noteClock(line|{turnSec,
totalSec, graceSec})` and counts its calls in `bot.clockStats().notes`; **that counter is 0 in every
run to date and will stay 0 until OPS wires the handler in `mag_bot.js`, which is not SEARCH's file.**

**Therefore the adaptive rule is designed against the worst case and does not depend on the
observation.** With no observation it assumes the timer has been on since the first request and
charges itself its own tick-rounded wall clock from a full 420 s. If the timer is actually off it has
throttled for nothing — a weaker search, not a lost game. If the timer comes on at turn 9 the
estimate has over-charged for turns that were free, so it under-spends. Both errors land on the safe
side, which is the only property that function is allowed to have.

### The shipped numbers against the walls

| | shipped | the wall |
|---|---|---|
| in-game decision | `budgetMs` **20,000** | **55,000 ms**, capped by whatever is left in the bank |
| team preview | `previewMs` **15,000** | **90,000 ms**, and it comes out of the grace, so it is **free** |
| the whole game | **21 decisions** at 20 s | **420,000 ms, no refill** |
| post-KO replacement | **no budget at all** until 2026-08-04 | its own 55 s request off the same bank |

**Per decision MILTANK is nowhere near the wall.** The binding constraint on one turn is `budgetMs`,
which we chose. **Per game it is genuinely tight**, and it is invisible in every H2H we run because
`mew.js` has no clock and both arms are equally free — the same *testing environment ≠ playing
environment* error CLAUDE.md names, one layer out (PRIORITIES #39a).

## R6 — the per-decision wall-clock distribution, MEASURED 2026-08-04

Artifact: **`data/miltank-timing-r6.json`**, rows in `data/.miltank-timing/r6.jsonl`. 12 self-play
games, `--policy score --policy2 score --miltank --miltank-n 200 --miltank-preview-n 40 --seed 90001`,
**120 decisions across 11 recorded games**, the 7,264-team clean pool (announced by the run, **not**
`--meta-teams`), one process, Ryzen 7 7735HS / node v24.15.0.

**THE BUILD THIS DESCRIBES, and it is already PRE-CHANGE.** `medicham2-browser.js` `b1b3ea94d5c3`,
`rollout_leaf.js` `974c94d92398`, `board.js` `abeb747f3219`, `miltank.js` `2cdf6f5b0924`. The run
window was 19:17:21–19:25:29 UTC; ENGINE wrote `data/abra-tags.js` at 19:32:34 and
`medicham2-browser.js` at 19:33:47, so **the tree moved seven minutes after the last row**. All 11
per-game stamps carry one digest, so the run is internally consistent — the digest is taken at module
*load*, not at the first row, precisely so it cannot describe a file edited underneath a running
process. **A duration is a fact about a machine under a load and about a build.** This one is not
R2's mistake (PRIORITIES #14) because it says which; it is nonetheless a distribution for a build
that no longer exists, and the weather-boundary fix makes playouts longer, so **treat every figure
below as a LOWER BOUND on the post-fix engine.**

| | median | p90 | p99 | max | over the 55 s turn wall |
|---|---|---|---|---|---|
| **all decisions** (n=120) | 2,169 ms | 9,977 ms | 23,812 ms | 23,866 ms | **0** |
| in-game move (n=98) | 2,234 ms | 13,891 ms | 23,866 ms | 23,866 ms | **0** |
| team preview (n=11) | 2,076 ms | 4,041 ms | 4,195 ms | 4,195 ms | 0 — **but censored, see below** |
| post-KO replacement (n=11) | 445 ms | 607 ms | 4,528 ms | 4,528 ms | 0 |

**A single decision cannot breach the 55 s wall at shipped settings.** The worst of 120 was 23.9 s
against a 55 s cap, on menus running 2–49 joint options. The brief's worse case — one decision
exceeding the per-turn wall — **does not occur**, and that is the good half of this result.

**`budgetMs` IS A CHECKPOINT, NOT A DEADLINE, and that is a real finding.** 9 of 98 move decisions
finished *over* the configured 20,000 ms, by up to **3,866 ms**. The budget is tested between
finalists (`miltank.js`, the `finalists` loop), so whichever finalist is in flight runs to completion
past it. The effective per-decision cap is `budgetMs + one finalist evaluation` ≈ 24 s at n=200. It
is comfortably inside 55 s today; it is not a bound anyone should quote as one.

**Per game, against the 420 s bank:**

| | p50 | p90 | max | over the bank |
|---|---|---|---|---|
| requests per game | 10 | 13 | 14 | — |
| total spend per game | 25.2 s | 128.5 s | **137.1 s** | **0 of 11** |

**The worst game observed spent 33% of the bank.** To forfeit, a game would have to cost roughly
three times the worst one measured.

### How long a real game actually is — 30,396 non-forfeit ladder games

`node engine/miltank.js --horizon data/games.ladder.jsonl`, folded into the artifact. Counted in
**requests** (turns plus turns in which one of our bodies fainted, because a replacement is its own
request off the same bank):

| | p50 | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| requests per game | 9 | 11 | 13 | 15 | **19** | 74 |

**0.58% of games exceed 21 requests**, 0.30% exceed 24, 0.08% exceed 34. And the self-play run's
own request counts (p50 10, p90 13) reproduce the store's (p50 9, p90 13) almost exactly, so the
harness is a fair — mildly conservative — proxy for game length.

### The verdict, stated plainly because it is not the one this was expected to produce

**The shipped flat `budgetMs: 20000` is not currently a forfeit risk, and the measurement says so
rather than the argument.** Two independent legs:

- *Observed*: 0 of 11 games came within 3× of the bank; worst was 137 s of 420 s.
- *Worst case*: even charging the full 20 s to every request, only **0.58%** of real games have
  enough requests to empty the bank, and MILTANK actually spends a median of 2.2 s.

So the adaptive rule is **a guard against a 0.6% tail and against an engine that is about to get
slower**, not a fix for a live bleeding problem. That is a weaker case than PRIORITIES #39a assumed
and it should be said out loud before anyone spends 420 games on R6a. **What has NOT been retired is
the environment mismatch itself** — nobody has ever watched MILTANK play with a clock running, and
the two facts that make the flat constant survivable (games are short, the search is usually fast)
are properties of *this* build on *this* pool.

### Preview is censored here and is the one number this run cannot give you

`mew.js` hardcodes `previewMs: 4000` and SEARCH may not edit it. **One of 11 previews truncated at
16 of 90 brings in 4,195 ms**; the other ten completed 90/90 in 2.1–3.2 s. Extrapolating the censored
one at its own ~262 ms per bring gives **~23.6 s for a full preview** — which would truncate against
the shipped `previewMs: 15000` too, and is still far inside the **90 s** first-turn wall. So preview
cost varies ~9× with the team, and **preview is `previewMs`-bound, not wall-bound**.

Given that preview time comes out of grace that `updateTurn` is about to clamp away regardless,
**`previewMs: 15000` is spending 17% of a free 90 s allowance.** Raising it is an accuracy decision,
not a clock one, and it belongs with the preview-calibration item (#38) rather than here.

## Adaptive spend — implemented 2026-08-04, behind a flag, DEFAULT OFF

`engine/miltank.js` now carries the rule this file asked for. **`clock: false` is the default and the
OFF path is byte-for-byte the player R4 measured**, so nothing changes in a live game without a
deliberate decision.

The rule, in one line: **spend `(bank − reserve) / expected remaining requests`, clamped under the
per-turn wall with a safety margin, floored so a starved tail still searches something.** Four
properties it was given on purpose:

- **It can only ever lower the budget, never raise it.** `budgetFor()` takes `min(adaptive,
  configured)`. A rule that could also spend *more* would need accuracy evidence of its own; this one
  needs only to not be worse.
- **The reserve is asymmetric, because the failures are.** Overrunning the *turn* costs one
  server-chosen move (`Timeout Auto Choose`, `:451-453`); emptying the *bank* forfeits the game
  (`:455`). So the reserve sits on the bank (`clockReserveMs`, 45,000 — nine ticks) and the turn gets
  only a tick-quantisation margin (`clockSafetyMs`, 10,000 under the 55 s wall).
- **The horizon is a high quantile of requests per game, not the mean** (`clockHorizonRequests`,
  default **19** = the measured p99 above) — the same reason the distribution is being measured at
  all. It is also floored by `clockTailMin` (8), because past the horizon `EXPECT − requests`
  collapses to 1 and the throttle silently switches *itself off* exactly when the game has proved it
  is a long one. Caught by driving the clock through 40 requests, not by reading it.
- **It bounds the post-KO replacement search, which had no deadline whatsoever.** Five candidates at
  `2 × ROLLOUT_N` on a request that draws its own 55 s from the bank was the one decision nothing
  capped. Only enforced when the flag is on.

| knob | default | meaning |
|---|---|---|
| `clock` / `MILTANK_CLOCK=1` | **off** | adaptive spend against the bank |
| `clockReserveMs` | 45,000 | bank held back; a bank timeout is a forfeit |
| `clockMinMs` | 1,500 | floor, so a starved tail still searches |
| `clockSafetyMs` | 10,000 | margin under the 55 s per-turn wall |
| `clockHorizonRequests` | **19** | planning horizon in requests — the p99 measured over 30,396 ladder games |
| `clockTailMin` | 8 | never plan for fewer than this many more requests, so the throttle survives past the horizon |
| `clockEarlyDefer` / `MILTANK_EARLY_DEFER=1` | **off** | stop before the finalist round on positions heading for the tie band |
| `timing` / `MILTANK_TIMING=<path>` | off | write the per-decision wall-clock artifact |

**`clockEarlyDefer` is not a timing lever and must not be argued as one.** MILTANK hands turns back
to MAG *after* paying for the finalist round. **Measured in R6: 31.6% of move decisions deferred, and
they consumed 30.5% of the total spend** — deferred and chosen decisions cost almost identically
(4,639 ms against 4,585 ms mean), so the saving really is proportional and **30.5% is the ceiling on
this lever**, not the "roughly a quarter" this file previously guessed. The screen already has an opinion
about the spread; it is only noisier. The estimator subtracts the expected pure-dice range of K
estimates of one true value (≈2.8σ at the screen's `n`) from the observed screen spread and asks
whether what is left clears the **final** round's tie band. **It changes what gets clicked on every
turn where the screen and the finals would have disagreed, so it gets its own SPRT arm.** Its bias is
stated rather than hidden: it is biased *low*, which makes it defer more often than it should.

**Why an environment variable rather than a flag.** The A/B has to run through `engine/mew.js`, which
is MEASURE's file, and the live path is `engine/mag_bot.js`, which is OPS's. SEARCH cannot add
`--miltank-clock` to either — the same one-liner PRIORITIES #33 already owes `--miltank-explore`.
The env var is recorded in every timing row, so a result is still attributable to the lever. Replace
it with a real flag when #33 lands; do not leave two ways to set one thing.

## R6 — the validation. SPEC. NOT RUN.

**It is three questions and only one of them is an H2H.** Collapsing them is the mistake this spec
exists to prevent.

### R6a — the DIVERGENCE screen first, and it is probably where this stops

**Do not open with the 420-game H2H. It is a null by construction and the probe says so before any
games are played.** Driving the clock through 40 requests at the horizon and reserve that ship:

| what MILTANK wants per request | requests where adaptive ≠ flat | first divergence |
|---|---|---|
| **4.6 s** — the R6 measured mean | **0 of 40** | never |
| 20 s — every request at the full budget | 29 of 40 | request 12 |

At the spend actually measured, **the throttle never engages at all**: `(420 − 45)/19 ≈ 19.7 s` is
already above what MILTANK asks for, and `budgetFor` only ever takes the smaller of the two. That is
the design working — it is a guard, and a guard that fires when nothing is wrong is a bug — but it
means an H2H between the two arms would compare **two identical players on ~99.4% of games** and
return a null that says nothing about the rule.

**So R6a is a divergence count, not an SPRT.** Run ~40 instrumented games with `MILTANK_TIMING` set
on both arms and count the decisions whose `budget` differs from `budgetMs`. Publish that count.

- **If divergence is ~0** — the expected outcome — the rule is inert in normal play, the flag stays
  off, and **there is nothing to SPRT.** That is the honest end of this item and it costs 40 games,
  not 420.
- **Only if divergence is material** does the H2H below become worth its cost.

### R6a′ — the H2H, conditional on R6a showing divergence (~420 decisive pairs)

Paired and seed-matched exactly as R4. **Arm 1 is the challenger**: `MILTANK_CLOCK=1`. Arm 2 is the
shipped flat `budgetMs: 20000`. Everything else identical — `--miltank-n 200`, explore 1.0,
`foe uniform`, turns 60, same seeds, same team pool, pool announcement recorded. `mew.js` having no
clock is *correct* here: it isolates the search-quality cost of throttling from the forfeit benefit,
which is R6b's job.

Read once, at the bound. `node engine/sprt.js <cat of shards>`.

**One behaviour the H2H must be told to expect, or it will be read as a bug.** When the bank falls
under `clockSafetyMs + 2 ticks` the budget goes to zero, the screen cuts every pair, and MILTANK
falls back to MAG for the rest of the game. That is deliberate — with 10 s of bank left, an instant
imitation move is strictly better than a forfeit — and it will show up as a burst of fallbacks at the
end of long games in the challenger arm only.

### R6b — how often does the flat constant actually forfeit? (NOT an H2H) — ANSWERED

**An H2H in `mew.js` structurally cannot see this**, because mew has no clock, so both arms are free
and the forfeit never happens in either. It is answered from the timing artifact instead, and it has
been: `games_over_bank_pct` is **0.0** (0 of 11; worst game 137 s of 420 s), and only **0.58%** of
30,396 real games have enough requests to empty the bank even at the full 20 s every time. **This is
the number that decides the item and it says the lever is a guard, not a fix.**

It must be re-read after the engine release, because the weather-boundary fix lengthens playouts and
every figure here is a lower bound on the post-fix build. `node engine/miltank.js --reduce <rows>
--horizon-store data/games.ladder.jsonl --out data/miltank-timing-r7.json`.

### R6c — `clockEarlyDefer` (a separate H2H, never confounded with R6a′)

Arm 1 `MILTANK_CLOCK=1 MILTANK_EARLY_DEFER=1`, arm 2 `MILTANK_CLOCK=1`. Same size, same pairing.
Running it inside R6a′ would make a play result unattributable between two levers, which is the
failure "levers are per arm" exists to stop.

**This is the one of the three worth running even though the clock does not bind**, and the reason is
not the clock at all: it buys **30.5% of the search budget back** on positions the search then throws
away, and that time can be spent on `--rollout-n` instead. Its risk is bounded and stated — it can
only change decisions that the finalist round would have deferred anyway or that the screen misranks.
Size it at ~420 decisive pairs; the null it has to beat is "no worse".

### The rule for all three

**Run them after the P0.5 release boundary.** Started before, they are born `PRE-CHANGE` and describe
a build that stopped existing — already true of every R4 shard on disk. And every run must stamp
`n_measured` / `n_unit`, the engine source digests, node version and machine: a duration is a fact
about a machine under a load, which is precisely why PRIORITIES #14 says R2 is re-run or nothing. Do
not let R6 become a second R2.

### The commands. PREPARED, NOT RUN.

Four processes, not six — RAM is the ceiling and `FreePhysicalMemory` was 2.33 GB when R6 ran, which
is **one** process. Check it before choosing a number. `SHOWDOWN_PATH` is required.

**R7 — re-measure the distribution on the named release** (one process, ~10 min, 12 games):

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
MILTANK_TIMING=$PWD/data/.miltank-timing/r7.jsonl \
  node --max-old-space-size=1536 engine/mew.js --n 12 --conc 1 \
    --policy score --policy2 score --miltank --miltank-n 200 --miltank-preview-n 40 \
    --seed 90001 --out data/.miltank-timing/r7-games.jsonl

node engine/miltank.js --reduce data/.miltank-timing/r7.jsonl \
    --horizon-store data/games.ladder.jsonl --out data/miltank-timing-r7.json
```

**R6a — the divergence screen** (same command, `MILTANK_CLOCK=1` added, shard 0..3 by `--seed`):

```
SHOWDOWN_PATH=... MILTANK_CLOCK=1 MILTANK_TIMING=$PWD/data/.miltank-timing/r6a-s<N>.jsonl \
  node --max-old-space-size=1536 engine/mew.js --n 10 --conc 1 \
    --policy score --policy2 score --miltank --miltank-n 200 --miltank-preview-n 40 \
    --seed 9100<N> --out data/.miltank-timing/r6a-s<N>-games.jsonl
```

Cat the shards, then `--reduce` once, and count rows where `budget < budgetMs`. **Read it at the
bound, once.**

**R6c — the `clockEarlyDefer` H2H**, only after R7 has re-stamped the leaf. Arm 1 is the challenger
and carries `MILTANK_EARLY_DEFER=1`; both arms carry `MILTANK_CLOCK=1`. ~420 decisive pairs, sharded
four ways, then `node engine/sprt.js <cat of shards>` **once**.

## Open

### 6. `mag_bot.js` PARSES NO `|inactive|` LINE — FILED FOR OPS, NOT FIXED HERE

The server hands the player its exact bank on every request while the timer is on
(`room-battle.ts:332`) and **the bot throws it away**: grep `engine/mag_bot.js` for `inactive` and it
returns zero. `engine/miltank.js` now exposes `bot.noteClock(line)` and counts calls in
`bot.clockStats().notes`; **that counter is 0 and stays 0 until something calls it.** Under CLAUDE.md
the capability is therefore assumed broken.

It is one handler in the socket loop, and `mag_bot.js` is **OPS's file and the live path** — SEARCH
must not touch it while Will may be playing. Two things whoever wires it must get right, both read
out of the source rather than guessed:

- the bank is `total + grace`, not `total`. `:330-332` prints them apart and the grace field is
  absent once it is gone. Reading `total` alone under-reads the bank by 90 s at the start;
- `|inactive|Battle timer is ON:` (`:237`) and `|inactiveoff|` (`:257`) are **room-level**, so both
  players see them, but the `Time left:` line at `:332` is sent to **that player only** — do not try
  to read the opponent's clock off it.

Until then the adaptive rule runs on the worst-case self-charged estimate, which is deliberate and is
strictly on the safe side, but it is an estimate.

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

### 5. `applyMegaWeather` — FIXED 2026-08-04, with #40b, and measured

`engine/rollout_leaf.js` called `applyMegaWeather(S)` and then assigned the caller's field over the
top — `S.field.weather = f.weather || ''` — **unconditionally, one line later**.
`battleInit({seeded:true})` leaves `S.field.weather` null, so the guard `if (S.field.weather) return`
never fired, the function always ran, and its write was always discarded. Mega Charizard Y stood in
clear weather in every mid-battle rollout this project ever ran.

**Fixed by ORDER**: the caller's field is applied first and `applyMegaWeather` second, so the guard
arbitrates instead of being overwritten. A real weather the board reports still wins.

**Two corrections to #40b as filed, both measured rather than reasoned.**

- **The raw ability read was not returning a wrong answer on this path.** `dmgMon` already calls
  `effAbility` itself, so a Charizard + Charizardite Y body arrives at the function carrying
  `drought`, not `blaze`. Probed directly (`species=charizard item=Charizardite Y` → body ability
  `drought`; same for Tyranitar→`sandstream`, Abomasnow→`snowwarning`). #40b is a **latent** hazard
  here — live the moment a caller omits `dex` — not the live defect the filing describes. #37 alone
  was the visible bug. Routed through `effective()` anyway, and `rollout_leaf.js` now holds **0** raw
  reads of a transforming field against a baseline of 0, down from **2** at `bd8f388`.
- **The field the fix actually needed was `mega`, not the ability.** The discarded version had **no
  mega check at all** — it took the weather of the first ACTIVE with a weather-setting ability, mega
  or not. Landing #37 without adding that gate would have **invented weather**: a Torkoal standing on
  a board the tracker says is clear is a legal observed state, and re-setting its sun overrules the
  one thing that knows. The board is authoritative for a body that is what the board says it is; a
  mega is the sole exception, because `dmgMon` has already upgraded it to a forme the real game has
  not seen. **So #37 and #40b were coupled, but not for the reason filed.**

**Parity, same boards, same seeds, both entry points, HEAD leaf against the working tree, in one
process so the engine cannot differ between arms.**

| | before | after |
|---|---|---|
| boards walked | 60 | 250 |
| `rolloutWinProb` different | **0** | 14 |
| `rolloutAfterActions` different | **0** | 14 |
| boards moved on at least one | **0** | **15** |
| boards moved that are NOT a mega-setter-on-a-clear-board | 0 | **0** |

15 of the 16 boards that hold a mega weather setter with no board weather moved; the 16th sits at
0.975/1.000 and is saturated at n=40. **Nothing else moved at all** — the reorder's only other side
effect, `weatherT` no longer being left at 5 on boards that already have weather, is inert, and the
parity proves it rather than assuming it.

Effect size, and it is not small: mean |Δ| **9.67 pt** on `rolloutWinProb` (max 17.5) and **18.33 pt**
on `rolloutAfterActions` (max 62.5, n=24 and correspondingly noisier). The direction is the
correctness evidence — **Charizard-Mega-Y's sun is worth +11.0 pt to the side that owns it and
−12.5 pt to the side that faces it.** Tyranitar-Mega's sand moves ±5 pt, which is the right order for
a weather whose main modelled effect is a Rock special-defence multiplier.

**Direct counter, because a parity delta is indirect.** `battleTurn` wrapped, field read on turn 1 of
every playout, 250 boards × 40:

```
HEAD leaf    : 0 of 9,040 playouts began in a weather MEDICHAM can read   (0.00%)
working tree : 640 of 9,040                                              (7.08%)   sun 480, sand 160
```

Rate in the corpus sample: 32 of 250 boards (12.8%) hold a mega weather setter among the actives —
Charizard-Mega-Y 17, Tyranitar-Mega 15 — and 16 of 250 (6.4%) are the ones with no board weather that
#37 can move. **That is the honest exposure figure, and it is not the "~26% of format usage" the
filing quoted**: 26% is megas in general, most of which set no weather.

Leaf cost: 17.53 → 16.93 ms per call at n=40 over 120 boards, i.e. no regression (one machine, one
load — an order of magnitude, not a figure).

The unseeded preview path is untouched, and that was checked rather than argued: 12 preview-shaped
calls (`seeded:false`, `buildTeams`, a mega setter on both sides) are identical across the two leaves.

**The engine moved under this work.** `engine/medicham2-browser.js` was committed and then modified
again between the before-run and the after-run — 4 of the first 60 HEAD-leaf values differ across the
two runs. The parity verdict survives it because both arms run in one process against one engine, and
the after-run carries its own before-state column measured on the current engine. The absolute
numbers above describe the tree at `9a4f82d` plus uncommitted ENGINE work, not a named release.

### 5b. THE LEAF'S WEATHER STRING HAS NEVER MEANT ANYTHING TO THE ENGINE — FILED, NOT FIXED

Tripped over while measuring #37, and it is **much larger than #37**. `applyField` assigns
`f.weather` straight into `S.field.weather`. `f.weather` comes from `board.weather`, which is
Showdown's `|-weather|` line normalised, so its values are **move names** — `sunnyday`, `raindance`,
`sandstorm`, `snowscape`. `engine/medicham2-browser.js` compares against `sun` / `rain` / `sand` /
`snow` (`:464`, `:486-487`, `:934`). **They have never matched.**

Measured on the shipped engine, Charizard Flamethrower into Garchomp:

```
weather=""           61-72        weather="sun"   92-109     weather="sunnyday"    61-72
                                  weather="rain"  29-35      weather="raindance"   61-72
```

So the weather a mid-battle board reports is **truthy enough to suppress a guard and meaningless to
every formula**. The turn-1 counter above says it exactly: **0 of 9,040 playouts on the HEAD leaf
began in a weather MEDICHAM could read**, while 5,320 of them had a weather string. 152 of 250
sampled boards (60.8%) carry one.

**Not fixed here, deliberately.** Correcting it moves roughly 65% of in-game leaf values — an order
of magnitude more than #37 — and landing it in the same pass would have made the #37 parity
unreadable, which is the exact confound #37 was deferred to avoid in the first place. It is an ENGINE
item; SEARCH could not write `docs/ENGINE.md` this pass and it is recorded here so it is not lost.
The translation point is `rollout_leaf.js applyField`, which now carries the finding in a comment.

**It also bounds what #37 bought.** With the board's weather inert-but-truthy, the mega's weather is
applied only where the board reports *no* weather at all. Under a real weather the mega still stands
in nothing — because the board's weather is nothing too. Fixing 5b will move #37's exposure up.

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
