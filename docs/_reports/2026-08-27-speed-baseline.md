# MEDICHAM speed baseline — how long does one game take to play out?

MEASURE, 2026-08-27. Dated findings record. Not current state, not a living document, never cited as
an artifact. The numbers below are wall-clock on ONE box on ONE night and are only meaningful with
the machine state attached, which is why the machine state is in the headline.

**No old baseline is quoted here.** Will: *"i dont care about the old one i just want an honest
baseline of how fast medicham can play a game out"*. Any previous figure was taken on a different
engine, so it is not a comparator; it is a different measurement wearing the same words.

---

## 1. THE NUMBER

**A complete game costs a median of 7.4–9.7 ms of wall-clock and 11.5–14.3 ms of CPU.**
p90 10.6–14.1 ms, p99 14.4–19.1 ms. Games are 2–21 turns, median 7. **Nothing hit a cap.**

**Do not quote a max from this without reading §7.** In all twelve repeat runs the maximum game was
the COLD FIRST GAME, not a slow game — the two figures are equal to three decimals in every one.

Rested box → the low end; twelve minutes of sustained load → the high end. Same engine, same seed,
same 1,184 games. §4 measures that and proves it reverses.

The range is not sloppiness. It is the honest answer, and section 4 is why.

The single cleanest run of the session — taken before the box filled up, and the one to quote if a
single number is wanted:

| | |
|---|---|
| **p50** | **7.40 ms** |
| p10 / p90 | 5.08 / 10.56 ms |
| p99 / p99.9 | 14.49 / 19.48 ms |
| max | 45.19 ms — a genuine warm 10-turn game, but a **lone outlier**: the next-slowest warm game is 20.7 ms and the cold first game is 37.1 ms. Consistent with one GC pause. |
| **n** | **2,831 games, every one played to natural completion** |
| turns | p50 7, p90 10, max 21, min 2 |
| games hitting the 200-turn safety cap | **0** |
| games ending by a side wipe | **2,831 of 2,831** |
| CPU per game | 12.3 ms (see §5 — CPU exceeds wall) |

Two derived figures, offered because they are what the number is usually wanted for:

- **~1.1 ms per turn** (p10 0.90, p50 1.115, p90 1.38). This is the composable primitive. A game is
  turns × this, and almost nothing else.
- **100–130 complete games per second per process**, single-threaded, end to end including per-game
  overhead (run A: 2,831 games in 21.8 s of play = 130/s; the loaded repeats: 118/s). A 40-rollout
  leaf is therefore ~0.3 s and a 200-rollout leaf ~1.6 s **if the rollouts run to completion from
  turn 0** — they usually do not, so treat this as a ceiling on cost, not an estimate of it. See §7
  for the cold-start caveat and the OWED list for what is missing.

## 2. WHAT A "GAME" IS HERE — the boundary, stated so a later run is comparable

| in the timer | out of the timer |
|---|---|
| `GD.freshBodies(pairA)` + `freshBodies(pairB)` — eight bodies rebuilt per game | process start |
| `M.battleInit(A, B, {})` — entry abilities, weather, Imposter, hazards | opening the frozen release |
| `while (!M.battleOver(S)) M.battleTurn(S, rng)` | the Showdown dex |
| `M.battleResult(S)` | reading the 110 MB frozen team store |
| | building the swarm / pairing the teams |

Setup, measured once and excluded: `require('engine/game_differential.js')` **0.76 s** with the pool
cache warm (**41 s** cold — see §8), and **1.13 s** from process start to the first game.

**Who is playing: nobody.** `battleTurn(S, rng)` with no action arrays is medicham2 playing BOTH
sides with its own internal policy — the identical call `medicham2-browser.js`'s own `battle()` makes
and the one `backtest_winrate.js`'s `previewLeaf` makes. **There is no MAG, no MILTANK and no rollout
search in this number.** It is the cost of the simulator, which is the thing every search multiplies.

**One engine, not two.** This is NOT the whole-game differential. The differential also constructs a
Showdown `Battle`, aligns stat lines, mirrors every choice and compares two protocol streams. Timing
that would measure the instrument.

## 3. COMPLETION vs CAP — the cap does not bind, and that is the finding

`battleOver` is `S.turn >= (S.maxTurns || 20) || sideWiped(S)`. Every game here ran with
`S.maxTurns = 200` and **not one game reached it**. All 2,831 ended with a side wiped, and the end
condition was read off the final board (live bodies per side) rather than assumed.

| turns | share | cumulative |
|---|---|---|
| ≤ 5 | 31.5% | 31.5% |
| 6 | 18.3% | 49.8% |
| 7 | 16.6% | 66.4% |
| 8–10 | 26.9% | 93.3% |
| 11–13 | 4.9% | 98.1% |
| 14–21 | 1.9% | 100% |

**Only 125 of 2,831 games (4.4%) reach turn 12 at all**, so the 12-turn cap the whole-game
differential runs at truncates 4.4% of games and is a no-op on the other 95.6%. For the games that
do reach it, time to turn 12 is p50 11.2 ms — obtained exactly, from cumulative per-turn stamps in
the uncapped run, because the first twelve turns of a game are byte-identical whichever cap is set.

**Median 7 turns is short for a doubles game and it is a fact about the POLICY, not about speed.**
medicham2's internal side policy is greedy; it does not stall, pivot or preserve. A game driven by
MILTANK would be longer and the per-game figure would rise roughly in proportion to turns. Anyone
reusing this number for a searched game should scale by their own turn count, not reuse 8 ms.

## 4. WHY THE ANSWER IS A RANGE — THE BOX MOVED UNDER THE MEASUREMENT

The within-run noise floor is tiny. Splitting one run in half by interleave (LESSONS §9) gives a p50
spread between the halves of **0.006–0.152 ms**. On that floor almost anything looks significant.

It is the wrong floor. Twelve **byte-identical** repeats — same release, same seed, same pool, same
pairing, same 1,184 games, run back to back:

| run | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wall p50 (ms) | 8.04 | 8.19 | 8.39 | 8.33 | 8.43 | 8.33 | 8.73 | 9.27 | 9.45 | 9.51 | 9.53 | 9.74 |
| CPU/game (ms) | 12.26 | 12.17 | 12.46 | 12.35 | 12.54 | 12.39 | 12.97 | 13.76 | 13.80 | 14.12 | 13.96 | 14.28 |

**A 21% monotone drift with the inputs held exactly constant** — 140× the within-run floor. An
earlier pair of repeats was worse: run A gave p50 7.398 and run D, identical to it in every input,
gave 8.889.

**The cause is clock, not contention, and the instrument can tell them apart.** `cpu/wall` sits at
1.401–1.453 across all twelve runs — dead flat. If the process were being descheduled by a busy box,
that ratio would fall. It does not; the CPU *time itself* rises in lockstep with wall time. This is a
laptop Ryzen 7 7735HS shedding boost clock under sustained load, not another process stealing cores.

**PROVEN REVERSIBLE, not asserted.** After an idle gap the same run was repeated three more times:

| run | cool1 | cool2 | cool3 |
|---|---|---|---|
| wall p50 (ms) | **7.82** | 7.90 | 8.01 |
| CPU/game (ms) | 11.48 | 11.53 | 11.92 |
| cpu/wall | 1.402 | 1.398 | 1.412 |
| free RAM (GB) | 1.55 | 1.56 | 1.57 |

p50 fell back from 9.74 to 7.82 and immediately began climbing again. Free RAM was **unchanged**
(1.46 → 1.55 GB), so it is not memory pressure; `cpu/wall` was unchanged, so it is not scheduling.
A reversible, duration-dependent rise in CPU cycles per unit of identical work is a clock effect.
This is the control the measurement needed and it moved.

**So: any A/B on this box that compares two arms run at different times, on a difference smaller than
~20%, is measuring the thermal state of the laptop.** Interleave the arms or do not run the test.
That applies to this division's own future work, not only to other people's.

## 5. CPU EXCEEDS WALL, AND THAT MATTERS FOR PARALLEL RUNS

`cpu_ms_per_game` (12.3) is **1.4×** `wall_ms_per_game` (8.4). The game loop is single-threaded, so
the extra 0.4 cores' worth is V8 — GC and background compilation.

Practical consequence: **6 concurrent processes will not give 6× throughput.** Budget ~1.4 cores per
process, so ~11 of 16 cores for the documented six-process cap, before the store and the dex are
resident in each. RAM, as CLAUDE.md says, is the real ceiling: peak RSS was **492–528 MB per
process**.

## 6. WHERE THE TIME GOES

Share of a median game: **turn loop 98.7%**, body build 0.7%, `battleInit` 0.5%. Setup per game is
noise; the game is the turns.

Correlation between turn count and game time: **r = 0.777, r² = 0.60**. Per-turn cost is remarkably
tight and, if anything, *falls* as a game runs longer (JIT warming inside the game, and fewer live
bodies late):

| turns | n | p50 game (ms) | per-turn (ms) |
|---|---|---|---|
| 4 | 289 | 4.97 | 1.244 |
| 6 | 518 | 6.98 | 1.163 |
| 8 | 368 | 8.63 | 1.079 |
| 10 | 167 | 10.08 | 1.008 |
| 13 | 25 | 11.56 | 0.889 |

Spread decomposition, p90/p10 ratio: **turn count 2.50, per-turn cost 1.54, whole game 2.08.**
**The spread in "how long does a game take" is mostly the spread in how long the game IS.**

Team composition is not a driver. Across the differential's nine configurations, p50 ranges
7.26–7.61 ms (excluding `omit-priority`, n=3).

The warm tail, so the outlier is not mistaken for the shape: 45.2 (10t), 20.7 (14t), 19.2 (17t),
17.8 (21t), 17.7 (16t), 17.6 (12t). **Excluding the cold first game changes p50 by 0.002 ms**
(7.398 → 7.396) and p99.9 by 1.4 ms — the cold game moves the extreme tail and nothing else.

## 7. WARM vs COLD — real, and confined to game one

Explicitly checked, because a timer that wraps a cached path measures the warm path from game two
onward. **Game 1: 37–72 ms. Steady state: 7.4–9.7 ms.** A 5–8× cold penalty, on the first game only.
Decile medians across a run are flat thereafter (run A: 7.94, 7.13, 7.40, 7.44, 7.37, 7.19, 7.95,
7.25, 7.26, 7.37). `freshBodies` calls `M.buildMon` fresh every game and memoises nothing, so bodies
are genuinely rebuilt; freshness was asserted per game (full HP, unfainted) and never failed.

**Anything that plays a handful of games pays this once and should not divide by n.**

## 8. THE INSTRUMENT, AND HOW IT COULD HAVE FAILED

`<scratch>/speed_baseline.js`. It reuses the canonical path rather than reimplementing it:
`GD.SW` / `GD.pairsFor` for the sample (same pool, same deterministic stride, same closet drops as
the whole-game differential), `GD.buildPair` / `GD.freshBodies` for the bodies, and
`GD.REL.require('engine/medicham2-browser.js')` so the timed module instance is the same frozen one
the differential holds.

Four failure modes checked per game rather than assumed, all **0 across every run**:
`staleBodies` (a game handed the wreckage of the last one runs short and fast), `zeroTurn`,
`badResult` (a result outside {0, 0.5, 1} means the loop exited somewhere unexpected), `threw`.

Two sanity checks that could have caught a broken sample and did not fire: the win split is
**1,457 / 1,374** — no side bias — and there were **zero draws**, consistent with every game ending
on a wipe.

**Pins.** Release `6a845424c450` (**0 of 26 files moved since the cut** — it is HEAD, and it is the
release `data/game-differential.json` is stamped with, so no new cut was needed). Team store pinned
to `data/team-pool-frozen`, corpus 8,778 distinct teams. Deterministic mulberry32 stream per game,
seeded `20260827 + i*7919`.

Two sample sizes were used and they are different samples, so both digests are recorded:

| budget | games | teams picked | pool digest | used for |
|---|---|---|---|---|
| `--games 4000` | 2,831 | 5,799 | `888f7adf17e5` | §1 headline, §3 turn table, §6 decomposition |
| `--games 1500` | 1,184 | 2,437 | `3cab533ba136` | §4 repeat series and the cooled control |

`--games` is a PAIR BUDGET split across nine configurations, not a game count — 4,000 yields 2,831
games played.

**The census pin is not applicable and saying so is part of the pin.** `data/mechanics-census.json`
steers `all_mechanics_fire.js`; it does not steer which games this harness plays. Nothing here reads
it.

**Priority: measured both ways, and it does not matter.** Normal priority p50 7.398; the same run
through `tools\lownode.cmd` (BelowNormal) p50 7.467. The 0.069 ms difference is **below** the
within-run noise floor of 0.146 ms — and far below the between-run drift of §4. On an idle box
BelowNormal costs nothing, exactly as `tools/lownode.cmd`'s own header claims.

**Writes.** Nothing under `engine/`. No gate artifact touched: `data/game-differential.json`,
`data/all-mechanics-fire.json` and the census are unmodified. `engine/game_differential.js` has a
`require.main !== module` guard and all three of its `writeFileSync` calls are behind it.

**ONE SIDE EFFECT, REPORTED RATHER THAN HIDDEN.** `engine/diff_swarm.js` rebuilt and rewrote its team
pool cache, `data/diff-team-pool.json`, on the first run of this session — it is gitignored, it is a
cache and not an artifact, and it is single-slot, so **it now holds the FROZEN pool key rather than
the live one.** The next run against the LIVE store will take a ~41 s rebuild. Nothing is corrupted
and nothing needs undoing; it is a cost, and it belongs in the record because the next person to see
a 41-second pause should know why.

## 9. THE MACHINE — part of the instrument, not a footnote

AMD Ryzen 7 7735HS, 16 logical cores, 13.35 GB. Windows 11 26200. Node v24.15.0. Uptime 37 h.

**The box was not idle and got busier during the measurement.** Free RAM fell 4.89 GB → 2.05 GB → 1.46 GB
over the session. Resident throughout: 5 Claude processes (~1.9 GB), Brave (~1.7 GB across 5
processes), Windows Defender `MsMpEng` (353 MB), and — appearing mid-measurement and **not mine** — a
`vmmem` at **3.9 GB** (WSL2 or a VM). Nothing was killed, by me or by the OS. No process was killed
by image name; nothing of mine hung.

**Read the §1 range, not the §1 single number, unless you also read §4.** The 7.40 ms figure is the
least-contended reading of the night. The 8.0–9.7 ms band is what this box actually delivers under
its normal load, and it is the number to plan against.

---

## OWED, NOT RUN

- **A cold-machine re-take.** Every figure here was taken while `vmmem` held 3.9 GB and free RAM sat
  under 2 GB. §4's cooled control shows the drift is a clock effect and reverses, but the FLOOR — how
  fast this is on a genuinely quiet box — is still unmeasured; 7.82 ms is the best reading obtained,
  not a proven floor. Re-run §4's twelve repeats after a cold boot with nothing else resident:
  ```
  node <scratch>/speed_baseline.js --games 1500 --label cold$k --seed 20260827
  ```
- **A searched-game baseline.** This is medicham2's greedy self-policy. Nobody has measured what a
  game costs when MILTANK picks the clicks, and §3 says the turn count — and therefore the cost —
  will not be the same. That is SEARCH's number to ask for and MEASURE's to take.
- **Rollout cost from a mid-game position.** §1's per-leaf derivation assumes a rollout plays from
  turn 0 to completion. Rollouts are truncated and start mid-game, so the real per-rollout cost is
  lower and is not measured here.
- **The full run, reproduced:**
  ```
  node <scratch>/speed_baseline.js --games 4000 --label A --seed 20260827
  powershell -File <scratch>/runB.ps1        # the same run at BelowNormal via tools\lownode.cmd
  ```
  Both pin `--release 6a845424c450` and `--team-store data/team-pool-frozen` internally.
