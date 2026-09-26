# Protect overuse: why the search double-protects, and what the fix bought (2026-09-26)

SOLVER. Engine release `eaa5becc54eb` (Reg M-C gate open), `--team-store data/team-pool-frozen-regmc`
(pool digest `792daded918f`), honest information. Every artifact is in `solver/results/2026-09-26-protect-overuse/`.

## Verdict

1. **(b) was a real defect and it is fixed.** ROTOM's live world (`solver/rotom/world.js`) laid no volatile, the
   consecutive-Protect counter included, so every playout of the live search priced a second Protect as a sure thing.
   A parallel branch (1.18.0) has since added an approximate streak. The world now reads the exact counter off the
   room's public log. The log-read counter matches MEDICHAM's own counter on
   1,583 of 1,583 body-turns, and the test is RED under `ROTOM_WORLD_BREAK=nostall`.
2. **(a) the engine is right.** A second Protect succeeds 195 of 600 times (0.325), in a full battle and in the lean
   playout mode alike. A position with the counter zeroed predicts 600 of 600. There is no engine bug to file.
3. **The counter is not the main cause, and the target is not met.** In the arena at the live 5 s budget, carrying
   the counter moves the Protect share from 16.9% to 16.7% and the fail rate from 13.1% to 13.4%, which is no change.
   Humans on the ladder are at 12.4% and 3.6%. Both pre-registered protect bars **FAILED**, at 1 s and at 5 s.
4. **What remains is the one-ply game over DODUO's candidates.** When DODUO's top four rows hold a repeat Protect
   (13 of 40 probe positions), the search puts 61% of its mix on it at 48 passes, with the 1-in-3 odds known. Swapping
   the leaf (64%), widening the opponent to 8 columns (78%) or the rows to 8 (56%) does not remove it. In 7 of the 13
   positions the repeat row is in the equilibrium support at a value gap within 0.001 of the best other row. So the
   search is **mixing** a repeat Protect in as equilibrium play. (c), the leaf, and (e), the opponent model, are ruled
   out as the driver. DODUO-greedy has the same excess in the same games, so (d), the ranking prior, is shared.
5. **Strength: no loss detected.** The pre-registered non-regression SPRT (1 s, fixed against pre-fix, elo0 −20,
   elo1 0, α = β = 0.05, 400 games) ended **INCONCLUSIVE**: 208–192, 0.520 [0.471, 0.569], LLR 1.98 against the bound
   2.94. Against DODUO-greedy on the same 100 pairs and seeds, the fixed agent scored higher at both budgets: 0.660
   against 0.625 at 1 s, and 0.695 against 0.630 at 5 s. The intervals overlap.

**Owed to Will.** The gen5-vs-prior ladder rows played before this fix measure the pre-fix agent. A restart with this
code is a new run id, not a continuation.

## The defect, as measured

`docs/_reports/2026-09-26-click-outcomes.md` §1 and §4 give the live numbers. The search (arm A of gen5ab,
`miltank-gen5` at 5 s) uses the protect family on 21.7% of its actions, and 18.0% of those fail. Every failure is a
consecutive use. DODUO-greedy is at 19.8% and 14.8%. Humans are at 12.4% and 3.6%.

The same logs, read per turn with the counter (`solver/tests/probe_protect_live.js`, `probe-live.txt`):

| group (gen5ab + aa1 + aa2) | turns with the counter | re-clicked | of those failed | P(repeat given counter) | P(protect given no counter) |
|---|---|---|---|---|---|
| search (miltank-gen5) | 90 | 28 | 20 | **0.311** | 0.178 |
| DODUO-greedy, arm B | 114 | 17 | 12 | 0.149 | 0.170 |
| DODUO-greedy, arm A of aa | 59 | 7 | 5 | 0.119 | 0.202 |
| humans (the opponents in the same games) | 146 | 4 | 4 | **0.027** | 0.099 |

## The candidates, one by one

### (a) Does MEDICHAM apply the consecutive-use chance? **Yes. Not a cause.**

The rule was read from the checkout, not typed. It is `pokemon-showdown-mc` `data/conditions.ts` `stall`:
`duration: 2`, `counterMax: 729`, `onStart` counter 3, `onRestart` ×3, and `onStallMove` `randomChance(1, counter)`,
which deletes the volatile on a loss. `solver/tests/probe_protect_repeat.js` prints it. The protect family is derived
from the format: every legal `stallingMove` plus every legal move whose `onHitSide` adds `stall` to its user. That
gives Baneful Bunker, King's Shield, Protect, Spiky Shield, Detect, Endure, Quick Guard and Wide Guard. The two guards
feed the counter and never roll it (`onTry` is only `willAct`).

The staged board is Raichu (A slot 0) clicking Protect twice into two attacks, 600 seeds (`probe-repeat.txt`):

| arm | second Protect succeeded |
|---|---|
| full battle | 195 / 600 = 0.325 |
| lean (API.makeLean, what every playout runs) | 195 / 600 = 0.325 |
| the counter zeroed before turn 2 | 600 / 600 = 1.000 |

MEDICHAM holds the counter as `tookProtectTurns` (`engine/medicham2-browser.js` `_stallRoll`, `_stallExpire`). The
chance reaches the playout and the lean mode unchanged.

### (b) Does the world the search plays carry the counter? **Live: NO. Fixed.** Arena: yes, always.

- **ROTOM** built the root from the protocol and stated it: *"NOT laid on: … volatiles"*. A body that had just
  Protected started the search's world at `tookProtectTurns = 0`, so every playout's second Protect was 100%.
- **The honest arena** (`solver/xatu/worlds.js arenaView`) clones the true battle, so the counter was always there.
  The honest-arena figures that sent gen5 to the ladder (abra/regmc 1.16.0) measured an agent that knew the counter.
  The live agent did not.
- **The XATU worlds** (`worlds.js rollout`) clone the root and swap only unrevealed bench bodies, so the counter
  survives into every world. Actives are never swapped.

**Overlap with the gates branch.** While these runs were going, the MAG/DODUO gates branch landed on main (abra/regmc
1.18.0, merged 2026-09-26 07:50Z; gen5ab had started at 04:06Z, so its games ran without it). It laid an *approximate*
streak in `world.js`: consecutive turns on which the body clicked a `stallingMove`, whether or not the click held. That
approximation is wrong in two ways. A failed Protect deletes the volatile, so the next Protect is 100% again, but the
walk counts it. Wide Guard and Quick Guard feed the counter, and the walk misses them. The merge keeps that walk for
its other fields (`_lastMove`, `_usedEntry`, `_pp`) and for a build with no log. When the log is given, the exact
counter below overrides it. The WORLD clause checks the failed-Protect case, which the walk gets wrong.

**Fix.** `world.js stallStreaks(lines, sheets)` reads the counter off the public log. A use is the user's own
`|move|` of a family move. It succeeded when the protect condition announces itself on the user
(`|-singleturn|<user>|…`, the `onStart`/`onSideStart` of every family member) before the user's next line. The counter
at a turn's start is the unbroken run of successful uses ending on the last closed turn. A block closes at the next
`|turn|`, or at `|upkeep|` for a replacement request. Switching, being dragged out or fainting clears it.
`build({… lines})` lays it on every active body. `rotom.js` passes `B.lines`. A build without a log is counted as
`stallNoLines`, and a laid counter as `stallLaid`. Both are in ROTOM's summary counters.

**Test.** `solver/tests/test-rotom-world-stall.js`:
- ENGINE: 30 seeded games whose clicks lean on the family. At every turn start, the log-read counter equals MEDICHAM's
  `tookProtectTurns` on 1,583 of 1,583 body-turns. Coverage: counter 1 on 440, counter 2+ on 100, 393 runs ended.
- WORLD: on a captured live request, a Protect that went up last turn gives a counter of 1. One that failed gives 0.
  A build with no log is counted.
- **RED under `ROTOM_WORLD_BREAK=nostall`**: 540 mismatches, and WORLD red.

### (c) Does the leaf reward stalling? **No, not as the driver.**

`probe_protect_passes.js` uses 40 positions from DODUO-greedy walks on TEST pairs. Each has a side-A body with the
counter ≥ 1 and its Protect legal, and gen5's search runs on the true battle at a fixed pass count (`probe-*.txt`):

| passes | mix mass on repeat rows (all 40) |
|---|---|
| 2 | 0.123 |
| 8 | 0.186 |
| 48 | 0.199 |

The mass **rises** with passes, so this is not sampling noise or a winner's curse on a coin-flip row. It is what the
table believes. With the repeat offered (13 of 40, 48 passes):

| variant | offered | mix mass on repeat rows | sampled a repeat |
|---|---|---|---|
| base (gen5 PORYGON2 leaf, 4 × 4) | 13 | **0.611** | 8 / 13 |
| heuristic leaf | 13 | 0.641 | 8 / 13 |
| 8 opponent columns | 13 | 0.776 | 11 / 13 |
| 8 candidate rows | 18 | 0.560 | 9 / 18 |

The count-HP heuristic, which knows nothing that PORYGON2 learned, endorses the repeat as much as PORYGON2 does.

### (d) Does DODUO over-rank Protect, and does its repeat pull fail? **It over-ranks. The feature fires.**

The `stall_repeat` feature fires on the live row for every one of our bodies that carried the counter (263 of 263).
DODUO v1 puts 16.5% on the repeat there, and its argmax takes it 16.3% of the time. On held-out HUMAN positions
(`probe_doduo_protect.js`, `probe-doduo.txt`, 260 TEST-split games):

| model | slot-decisions | DODUO mass on Protect | humans | DODUO argmax |
|---|---|---|---|---|
| v1, repeat | 712 | 0.079 | 0.053 | 0.060 |
| v1, fresh | 4,122 | 0.218 | 0.169 | 0.230 |
| gen5, repeat | 712 | 0.081 | 0.053 | 0.070 |
| gen5, fresh | 4,122 | 0.224 | 0.169 | 0.243 |

On human positions DODUO is a little Protect-heavy, about +3 points fresh and +2.6 points repeat. On the bot's own
positions it puts three times the human mass on the repeat. It does not price the 1-in-3 odds, because a policy prior
cannot. The search takes its rows from it: the repeat is offered in 13 of 40 probe positions (DODUO mass 0.106).
DODUO-greedy in the arena protects about as often as the fixed search (tables below). **Not changed here:** a parallel
branch owns `solver/mag`, and DODUO-greedy is arm B of a registered A/B, so changing it would change the baseline.

### (e) Is the opponent model too aggressive? **No.**

In the live gen5 tables (298 searched decisions), 17.1% of the opponent's columns hold a protect-family slot and 24.1%
hold a switch. Widening to 8 columns raises the repeat mass (0.611 → 0.776) rather than lowering it.

### What the search is doing

In 7 of the 13 offered positions, the best repeat row and the best other row are within 0.001 in value against the
solved column mix, which is the signature of a mixed equilibrium. Gaps: −0.379, −0.099, −0.039, 0, 0, 0, 0.0001,
0.0003, 0.0007, 0.0028, 0.0099, 0.0122, 0.0768. The one-ply game over these rows and columns makes the repeat Protect
part of the equilibrium mix. That is the documented design (sample the row mix, never the argmax), so it is not a bug in
SLOWKING. Whether the mix is right is a question about the depth-0 model, and only a strength test can answer it.

## The arena, before and after

Protect share = family clicks / (move + switch choices). Fail = no counter after the turn, which includes a click that
never executed (a flinch or sleep) on every arm alike. Consecutive = the body's family use succeeded the turn before.
Read by `solver/arena/protect_read.js` from the run's own shards.

| run (200 games each vs DODUO-greedy; 400 in the SPRT) | arm | share | fail | consec / protects | consec failed | score |
|---|---|---|---|---|---|---|
| P-before, 1 s | gen5, counter dropped | 17.7% | 12.6% | 16.3% | 64.6% | 0.625 [0.556, 0.689] |
| P-after, 1 s | gen5, counter carried | 15.8% | 10.4% | 13.9% | 60.5% | 0.660 [0.592, 0.722] |
| P5-before, 5 s | gen5-5s, counter dropped | 16.9% | 13.1% | 17.7% | 68.0% | 0.630 [0.561, 0.694] |
| P5-after, 5 s | gen5-5s, counter carried | 16.7% | 13.4% | 15.3% | 71.6% | 0.695 [0.628, 0.755] |
| S, 1 s, head to head | fixed | 17.5% | 14.4% | 18.4% | 67.4% | 0.520 [0.471, 0.569] |
| S, 1 s, head to head | pre-fix | 19.6% | 18.5% | 23.5% | 71.8% | — |
| (DODUO-greedy, the y of the four P runs) | | 15.6–16.8% | 8.6–10.9% | 15.7–17.3% | 50–56% | — |
| humans, live ladder (click-outcomes §1, §4) | | 12.4% | 3.6% | 5.3% | 60% | — |

The head-to-head pre-fix arm (19.6%, 18.5%, 23.5%) reproduces the live defect (21.7%, 18.0%, 25.2%) almost exactly.
All three fall with the counter, to 17.5%, 14.4% and 18.4%. Against DODUO-greedy the effect is small at 1 s and nil at
5 s. The fixed search then protects about as often as DODUO-greedy, and fails a little more.

**Pre-registered bars** (`preregistration.json`; the 5 s addendum `preregistration-5s.json` was written after the 1 s
read and before any 5 s game, with the bars unchanged):
- cause: before ≥ 10% AND after ≤ 7.2%. 1 s: 12.6% / 10.4%, **FAIL**. 5 s: 13.1% / 13.4%, **FAIL**.
- share: after ≤ 15.5%. 1 s: 15.8%, **FAIL**. 5 s: 16.7%, **FAIL**.
- strength: non-regression SPRT, **INCONCLUSIVE** at 400 games, 0.520 [0.471, 0.569]. No loss detected. The score
  leans toward the fix, but the bound was not reached.

**Why 5 s was added.** At 1 s a decision fills each of 16 cells about 1.75 times (playouts p50 28–29). At 5 s in the
arena the p50 is 156–160, which is about 10 passes. The live arm logged 1,356 playouts (85 passes) on one early
decision. The arena at 5 s is still well below the live pass count. So the live effect of the counter may be larger
than the arena's, and the live read after the fix is the test of that.

## Pins, flags, counters

- Release `eaa5becc54eb`. Store `data/team-pool-frozen-regmc` (`games.bo3.jsonl` sha256 `a68263bb…`, pool digest
  `792daded918f`), 173 TEST pairs.
- P runs: `gate.js --pairs 100 --pair-seed 1 --seed 26100 --workers 3 --cap 50 --info honest --rule notlose`. Before and
  after are the same pairs and seeds.
- S: `sprt.js --elo0 -20 --elo1 0 --alpha 0.05 --beta 0.05 --max-games 400 --seed 26101 --workers 3 --cap 50 --info honest`.
  Read once, at the budget.
- All runs: 0 errors, 0 capped, 0 unbuildable, 0 search fallbacks. `stallDropped` fired on every searched decision
  of a lost-stall arm (smoke: 37 of 37).
- Tests after merging main: `test-rotom-world-stall` GREEN 6/6 (RED under break), `test-rotom` 105/105,
  `test-machamp` 100/100, `test-honest-info` 1954/1954, `test-docs-current` 39/39. The first post-merge `test-rotom`
  read 104/105: the GEN5 clause's cold 700 ms decision drew a world and no playout. The clause now warms the searcher
  first, as ROTOM does at preview.
- Wall-clock caveat: a shared machine. The P runs of one budget ran back to back, not interleaved.

## What is owed

- **Will:** restart the ladder with this code under a new run id. The gen5ab rows before it are the pre-fix agent.
- **The next measurement:** the live read after the fix (`probe_protect_live.js`). The arena cannot reach the live pass
  count.
- **DODUO (owner of `solver/mag`):** the repeat mass on the bot's own positions (16.5%, against 2.7% for the humans in
  the same games). A candidate: the pair features see the counter, or the ranking is taken after the engine's success
  odds.
- **MILTANK (open):** the depth-0 equilibrium puts about 60% of its mix on a repeat when one is offered. Candidates:
  depth 1 on protect rows, or a branched stall die (plan both outcomes, as for speed ties). Each is a strength
  question and gets an SPRT.
- **ROTOM's world** still lays no other volatile (Substitute, Taunt, Encore, confusion, Leech Seed, Perish counts).
  This is the same class of gap. The search misprices those turns the same way.
