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
  runs vs engine (newest engine source: engine/medicham2-browser.js 2026-08-04 09:06):
    PRE-CHANGE games.r4-decided.jsonl  2026-08-04 04:41
    PRE-CHANGE games.r4-fixed-part1.jsonl  2026-08-04 02:36
    PRE-CHANGE games.r4.jsonl  2026-08-04 02:33
    PRE-CHANGE games.r4-baseline.jsonl  2026-08-04 01:22
    PRE-CHANGE games.r4-smoke.jsonl  2026-08-04 00:45
```

_stamped 2026-08-04 09:23_

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

**So the DRAWN reading is confirmed and the arithmetic stands, with different numbers.** Against it,
what MILTANK ships:

| | shipped | the wall |
|---|---|---|
| in-game decision | `budgetMs` **20,000** | **55,000 ms**, capped by whatever is left in the bank |
| team preview | `previewMs` **15,000** | **90,000 ms** — measured now, no longer "do not assume" |
| the whole game | ~24 decisions at 20 s, after preview | **510,000 ms, no refill** |
| one leaf at n=200 | 141.85 ms | ~388 leaf calls fit in 55 s |
| one leaf at n=40 | 37.48 ms | ~1,467 leaf calls fit in 55 s |

**Per decision MILTANK is nowhere near the wall**, and now by a wider margin than the old figure
implied — a ~63-cell menu at n=200 costs ~8.9 s against 55 s. The binding constraint on one turn is
`budgetMs`, which we chose.

**Per GAME it is genuinely tight.** 510 s, no refill, 15 s spent at preview, leaves 495 s — **24
decisions at `budgetMs: 20000`**. That is more than the 21 this file used to claim, and the
conclusion is unchanged: VGC doubles games run past 24 turns often enough that the shipped budget can
forfeit a won game on inactivity, and **a timeout says nothing about the player**. It is also
invisible in every H2H we run, because `mew.js` has no clock at all and both arms are equally free.

**What the fix should be, given the shape is a bank and not a per-turn allowance.**

- **Not a constant.** Spend against `secondsLeft / expected remaining decisions`, which is the thing
  a bank calls for. A flat 16.5 s survives 30 decisions; a flat 20 s does not.
- **Hold a reserve.** `Timeout Auto Choose` means running out of *turn* time costs one bad move,
  while running out of *bank* costs the game — those are not the same failure and the budget should
  be far more afraid of the second.
- **Deferral is free time we are not taking.** MILTANK handed 29% of turns back to MAG in an R4 run
  and **paid the full search first every time**. A screen that stops once the finalists are provably
  inside the tie band would return roughly a quarter of the clock at zero cost in play.
- **Preview is cheap and under-spent, not expensive.** 15 s against a 90 s cap. If preview is worth
  anything it is worth more than 3% of the bank; that is an accuracy question, not a clock one.

**One measurement still missing, and it is the one that decides the number.** Nothing has recorded
MILTANK's per-decision wall-clock **distribution** over a real game — only single decisions. The
smoke below shows 114–664 ms at `--miltank-n 20`, and R2's 8.9 s is at n=200 and is itself under
re-run (PRIORITIES #14). **The mean is not what times you out; the tail is.** Record the distribution
before choosing a constant.

**One caveat that is not ours to control:** the timer only runs when a player starts it
(`room-battle.ts:606` — `Config.forcetimer` is off on the main server, and `:727` is `/timer on`).
So the bank binds when the opponent turns the clock on, which we cannot predict and must assume.

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
