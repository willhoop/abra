# Scoping the whole-game differential's turn cap — MEASURE, 2026-08-29

**Costing and design only. No game was played, no differential was run, no engine file was touched.**
Every artifact figure below was read through `git show HEAD:<file>` (the working tree was not read for
`data/game-differential.json`, `data/published-samples.json`) because an ENGINE agent is mid-write on
the differential. The two cross-cap artifacts read from disk — `data/verification/gd-endstate-982.json`
and `gd-endstate-982-t30.json` — are dated 2026-08-19/20 and are not written by any live process.

---

## 0. THE PREMISE IS CONFIRMED AND UNDERSTATED

`data/game-differential.json` (`generated 2026-08-29T00:24:05Z`, release `4e5c7b3400de`, arm `middle`,
961 games) carries:

```
turns_cap: 12
arms[0].end_reasons: { "the turn cap (12)": 944, "both engines ended the battle": 17 }
coverage.median_completed_turns_before_divergence: 12
```

**944 of 961 games — 98.2% — are cut off by the cap. 17 games, 1.8%, reach a natural end.**
The coordinator's reading ("the median game ends AT the cap") is right and is the weak form of the
finding. The median is not near the cap; almost the entire distribution is *at* it.

`state.agreement_by_turn` gives the attrition inside the twelve turns:

| turn | 1–6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|
| games still running | 961 | 960 | 957 | 956 | 952 | 949 | 944 |

`state.turn_boundaries_compared` = 12,445 boundaries. Every one of them is at turn ≤ 12.

**This is already instrumented.** `engine/coverage.js:113` and `:434` print exactly this sentence under
the gate clause, and `engine/arms_comparable.js:32` already refuses a cross-cap comparison with the
right reason (*"a deeper cap lets games part later, which moves every class count"*). Nothing here is
a missing guard; it is an unanswered question.

---

## 1. THE CONFLATION IS REAL, AND THE SENTENCE THAT CARRIES IT IS IN MEASURE'S OWN LEDGER

The standing defence of cap 12 has two legs. **Leg (a) is sound. Leg (b) does not describe this
instrument's games at all.**

**Leg (a) — MECHANIC coverage. Sound, and I could not break it.**
`credit_turn_profile` in the current artifact: 178 of 253 credited census rows are first credited on
turn 1 (70.4%), 243 by turn 4 (96.1%), 246 by turn 6 (97.2%), and the **deepest first credit is turn
10**. `rows_first_credited_at_turn_13_or_later` is an empty array. The 2026-08-25 cap-30 run found
exactly **2 of 254** rows first credited past turn 12, both of which the other pinned arms credit
*inside* twelve turns. A deeper cap buys ~25,000 more credit events per turn and about one row.
**On mechanic coverage, 12 is not merely defensible — it is generous.**

**Leg (b) — GAME coverage. It is measured on a different population and does not transfer.**
The argument is *"real ladder games have a median of 7 turns and 96.6% finish by turn 12."* That is a
true statement about `data/team-pool-frozen`'s 17,381 stored games, and about `engine/bench_speed.js`'s
self-play (2,831 games, median 7 turns, max 21, all ended by side wipe). It is **not** a statement
about the games this instrument plays, and the two populations differ by a factor of ~55:

| population | games reaching turn 12 |
|---|---|
| real ladder games (store) | 3.4% |
| medicham2 greedy self-play (`bench_speed.js`) | 4.4% |
| **the whole-game differential** | **98.2%** |

The cause is not subtle and it is declared in the artifact. `steering.policy` is
`census-coverage-seeking/v1`: *"at every decision the driver prefers the legal action reaching the
least-exercised row of `data/mechanics-census.json`."* The driver is not trying to win, so the games do
not end. `docs/ENGINE.md:18285` records the same fact from the other side — *"275 games ran to the turn
cap and NEITHER engine rolled anything — status moves, setup."*

**The specific sentence to retract is mine.** `docs/MEASURE.md:469-470`, written 2026-08-27:

> **The cap does not bind.** Only 4.4% of games reach turn 12 at all, so the whole-game differential's
> 12-turn cap truncates 1 game in 23 and is a no-op on the rest.

The measurement (4.4%) is correct for what it measured — `battleTurn(S, rng)`, medicham2's own greedy
policy, no search, natural side wipe. The **inference drawn from it about the differential is wrong by
a factor of about 23, in the reassuring direction**: the cap truncates **24 games in 25**, not 1 in 23.
That paragraph is the single most load-bearing "the cap is fine" claim in the repository and it is a
population transfer that was never checked. Correcting it is owed (§6).

---

## 2. THE RUN THAT PRODUCED 28 → 80: FOUND, DATED, AND ITS MULTIPLIERS DO NOT TRANSFER

**Source:** `docs/ENGINE.md:10310-10412`, headed *"THE TURN CAP IS SET BY COVERAGE, AND COVERAGE IS
FLAT BY TURN 6 — SO 12 STAYS"*, dated **2026-08-25**. Full account at
`docs/_reports/2026-08-25-turn-cap.md`. Release **`c6d45355668e`**, same pins, same frozen pool, same
961 games, only the cap differing.

| | cap 12 | cap 16 | cap 30 |
|---|---|---|---|
| protocol PARTED | **28** | 40 | **80** |
| board-material | **10 causes / 10 games** | 17 / 19 | **41 / 43** |
| narration-only | 17 / 18 | 19 / 20 | 34 / 36 |
| DIFFERENT-END-STATE | 8 | 18 | 31 |
| census rows credited | 252 | 253 | 254 |
| deepest FIRST credit | turn 11 | turn 13 | turn 23 |

**What it actually pinned, and why the numbers are stale.** It pinned a *cap-12 baseline of 28 parted /
10 board-material*. The current cap-12 baseline is **6 parted / 0 board-material / 0
DIFFERENT-END-STATE** — a 4.7x improvement in parted and a clean sheet on materiality. So:

- The **multiplier** reading (x2.86 parted, x4.1 board-material) is arithmetically useless applied to
  today's numbers: 0 x 4.1 = 0, and that is not a prediction, it is a division by the thing that
  changed. The 33 extra board-material causes at cap 30 were causes the cap-12 run **never had in its
  numerator**.
- The **additive** reading is the usable one. The turn-13+ excess in that run was **52 parted causes
  and 31 board-material causes**, and the report's own mechanism breakdown says only **three families
  are genuinely turn-13-only** — PP exhaustion, a multi-turn counter expiring unannounced, and a forme
  failing to revert when its field effect ends (~9 games between them). *"Everything else is a
  mechanism the cap-12 run already sees, given more chances to fire."*

**Of the three turn-13-only families, one is verifiably closed and two are not.**

| family | status today | evidence |
|---|---|---|
| PP exhaustion narrated as Struggle instead of `\|cant\|…\|nopp\|<move>` | **CLOSED** | `engine/medicham2-browser.js:22682-22687` now emits `TR.cant(m,'nopp',_ppId)` on the authority's own line |
| multi-turn counter expiring unannounced | **PARTLY** — the residual clock ORDER was reworked 2026-08-27, but that is placement, not the missing `\|-end\|`; the same block declares `magnetrise@18` still a **MISSING TICK** ("a clock nobody spends is a volatile that never ends") | `medicham2-browser.js:6654-6705` |
| forme not reverting on field-effect end (Forecast on `\|-weather\|none`, Morpeko on Throat Chop end) | **NOT VERIFIED** — Forecast/Castform emission exists at `:17689-17746`, the *revert-on-expiry* path was not traced | — |

The fixes since 2026-08-25 were selected **from the cap-12 list**, so they had no systematic reason to
reach the turn-13+ population except where the mechanism is shared — which the report says is most of
it. That is the basis of the estimate in §4.

---

## 3. THE COST CURVE — AND THE BINDING TERM IS NEITHER ENGINE

**Trap first: `--games` is a PAIR/TEAM budget, not a game count.** `--games 1200` is divided across the
nine swarm configurations and yields **961 played games**. Two configurations are pool-limited and do
not scale at all: `omit-priority` has 7 teams available → **3 games**, `omit-protect` has 99 → 48 games.
Every figure below is *for the same 961 games*.

**Per-turn cost is measured from the artifacts, not modelled.**

| run | games | turn-pairs compared | elapsed | ms per turn-pair |
|---|---|---|---|---|
| current, cap 12 (`HEAD:data/game-differential.json`) | 961 | 11,484 | 256.2 s | **22.3** |
| 2026-08-19, cap 30 (`data/verification/gd-endstate-982-t30.json`) | 797 | 22,723 | 392.7 s | **17.3** |

Turn-pairs are `sum over t of state.agreement_by_turn[t].reached` — the number of turn boundaries the
instrument actually walked, not `games x cap`. The instrument has got ~29% more expensive per turn
since 19 August (more comparators: `--state`, `--end-state`, the address log). **The 2026-08-25 timings
(95.3 s / 195.9 s / 238.8 s) are not usable for costing** — they are mutually inconsistent under a
linear model (cap 16 is *more* than three-quarters of cap 30's cost) and were plainly taken under
machine contention.

**The authority's per-turn cost, and why it does not matter.** Measured
(`docs/ABRA-whitepaper.md` §3.0, both engines on the same four teams, 8-second runs):
`champions_sim` **523 turns/sec = 1.91 ms/turn**; MEDICHAM **13,041 turns/sec = 0.077 ms/turn**.
Both engines together are therefore **~2.0 ms of the 22.3 ms** the differential spends per turn — under
10%. That benchmark was taken with `choose('default')` and no protocol capture, so 1.91 ms is a **lower
bound** on the authority inside the harness; even at 3x it is under a quarter of the cost. **~80-90% of
the differential's wall clock is the harness** — the coverage steering scoring every legal action
against a 643-row census at every decision, board extraction and comparison at every boundary, address
hashing, and 556,190 credit events over 11,484 turns (48 per turn). So the honest statement is not
"our throughput is not the binding term" but **neither engine is the binding term, and the cost of a
deeper cap is a harness cost that scales with turns compared.**

**The projection.** Survival past turn 12 is taken from the *measured* cap-30 curve (797 games,
2026-08-19), which is a property of the driver and pool rather than of engine correctness; past turn 30
it is extrapolated at the measured survival factor 0.99474/turn (see §5 for why that extrapolation is
weak). Cost is quoted as a range over the two measured per-turn readings.

| cap | mean turns/game | turn-pairs (961 games) | wall clock @17.3 ms | @22.3 ms | games completing naturally |
|---|---|---|---|---|---|
| **12 (standing)** | 11.9 | 11,456 | 3.3 min | **4.3 min (measured 4.27)** | **2.4%** |
| 16 | 15.8 | 15,157 | 4.4 min | 5.6 min | 4.5% |
| **20** | 19.5 | 18,755 | 5.4 min | **7.0 min** | 7.2% |
| 24 | 23.2 | 22,269 | 6.4 min | 8.3 min | 9.4% |
| **30** | 28.5 | 27,399 | 7.9 min | **10.2 min** | 11.9% |
| 40 | 37.1 | 35,622 | 10.3 min | 13.2 min | 16.4% |
| **60** | 52.9 | 50,824 | 14.7 min | **18.9 min** | 24.8% (extrapolated) |

**The cost is single-digit minutes, not hours.** The 2026-08-25 report's *"18 extra turns on 961 games
costs 2.5x every run"* is the correct multiplier and reads far worse than the absolute number: cap 30
is **+6 minutes** on a 4-minute run.

---

## 4. WHAT IT WILL FIND, WITH THE UNCERTAINTY STATED

Today's cap-12 baseline: **6 parted, all 6 `NARRATION-ONLY`, 0 board-material, 0 DIFFERENT-END-STATE,
0 THREW.** All six are `event missing from medicham2`; five carry the `\|-end\|…\|fallenundefined`
shape and one is `\|upkeep <> \|faint\|p2b`.

**Estimate for a cap-30 run on today's engine, and it is a wide one:**

| | central | range | basis |
|---|---|---|---|
| protocol PARTED | **~15** | **8–30** | additive: 6 (scaled by turns compared, x2.4) plus the turn-13+ residual, discounted by the 79% cap-12 improvement |
| board-material causes | **~5** | **0–15** | 31 late causes at 2026-08-25, discounted the same way; two of three named late-only families unverified |
| DIFFERENT-END-STATE | **~3** | **0–12** | tracked board-material closely in the 2026-08-25 table (31 vs 41) |
| census rows credited | 254 ± 1 | — | measured directly at cap 30 on 2026-08-25 |

**Why the range cannot be tightened without running it.** The multiplier was measured against an engine
that has since improved 4.7x on the only clause that can be compared, and the improvement was driven
entirely by the cap-12 list. There is no instrument in this repository that can say how much of the
turn-13+ population those fixes reached, because nothing has looked past turn 12 on any release since
`c6d45355668e`.

**One thing the depth genuinely buys, per unit of compute.** Board-material causes per 1,000 turn-pairs
compared, from the 2026-08-25 three-point curve: **0.87 at cap 12, 1.12 at cap 16, 1.50 at cap 30.**
Parted per 1,000: 2.44 / 2.64 / 2.92. So the marginal turn past 12 is about **1.7x richer in
board-material divergences** than the average turn under 12, at the same ms/turn. Depth is not merely
more of the same; it is a better-yielding sample.

**And the asymmetry that decides whether this is urgent.** Quarantine lifts on *board-material zero*.
Today that clause reads zero on the pool. **If it is zero because the horizon is twelve turns, then
lifting on it is lifting on a claim about the first twelve turns of a game that never ends.** Ten
minutes of machine time converts that from an assumption into a measurement, and there is no cheaper
way to get it.

---

## 5. IS THE CAP THE RIGHT KNOB?

**Truncated, not resolved.** `game_differential.js:4110-4112` — a game that runs the loop out is
stamped `the turn cap (12)`; there is no alternative resolution rule, no adjudication, no HP-based
winner. The 944 games simply stop. `end_state` then compares the two boards *as they stand*, which is
why 961 of 961 read `SAME-END-STATE` and `DIFFERENT-WINNER` (severity rank 1) has never once been
reachable — the instrument even prints *"BAND 1 IS EMPTY IN THIS ARM. Read it against the turn cap"*
and *"a 12-turn cap resolves almost nothing"* (`:7238-7271`).

**Interactions checked — all four are clean or already guarded:**

- **medicham2's own horizon.** `game_differential.js:3315` sets `S.maxTurns = Math.max(MAXTURNS+1, 20)`.
  This exists precisely because a 40-turn run on 2026-08-12 produced **943 ENDED-APART of 983 games,
  937 of them "ONLY medicham2 ended the battle"** — 96% of the run was one hard-coded default. It is
  fixed and it scales; no cap raise re-opens it. **Do not remove the floor of 20.**
- **Comparability.** `engine/arms_comparable.js:32` already lists `turns_cap` as a refusal key. A
  cap-30 artifact cannot be silently diffed against a cap-12 one. `first_divergences` is indexed by
  protocol LINE and is not comparable across caps at all.
- **The sample budget.** Independent of the cap — `--games` is a pair budget divided nine ways, and 2
  of the 9 configurations are pool-limited (3 and 48 games) regardless.
- **The census steering.** Coverage credit accumulates *during* a run and steers later games, so a cap
  change changes **which actions get picked** in games 500-961. A cap-30 run is a **RE-BASELINE, not a
  delta** — this is the same warning `baseline_reset` already carries in the artifact.

**THE TRAP IN THE BRIEF IS WRONG, AND IT MATTERS FOR THE COMMAND.** `engine/publish_guard.js` does
**not** protect `data/game-differential.json`. Grepped repo-wide, `publish_guard` is required by
exactly five files — `engine/publish_guard.js`, `tests/test-publish-guard.js`,
`tests/test-engine-diff.js`, `tests/test-red-run-writes.js`, `tests/test-stadium-roster.js` — and
`data/published-samples.json` holds two artifacts, `data/engine-diff.json` and
`data/engine-diff-PLANTED-band.json`. Neither is the differential. Moreover the guard keys on **sample
size**, and a cap-30 run at `--games 1200` yields the same 961 games — so even if it were wired, it
would not refuse. **A cap-30 run with `--write` and no `--out` overwrites the published cap-12 artifact
and nothing stops it.** The protection that does exist is that `--write` is opt-in
(`game_differential.js:58`) and `--out <file>` redirects the artifact (`:144`, applied at `:8040`).
`data/verification/` is the right destination — by publish_guard's own header it is *"a SUBDIRECTORY,
so a verification artifact never joins the top-level data/ set that provenance, quarantine and the docs
gates enumerate."*

**AND THE CAP IS THE WRONG KNOB FOR THE QUESTION WILL IS ACTUALLY ASKING.** The hazard rate is flat.
From the measured cap-30 curve, games complete at **~0.53% per turn** from turn 7 all the way to turn
30 with no knee anywhere:

```
turn:      12     16     20     24     30     40*    60*
running:  97.6%  95.5%  92.8%  90.6%  88.1%  83.6%  75.2%    (* extrapolated)
```

The coordinator's instinct — *"the right cap is where the marginal game-completion rate flattens"* — is
the right criterion and **it has no answer**, because the curve is already flat and stays flat. At a
0.53%/turn hazard you need a cap around **turn 130** to complete half the games. The cap cannot deliver
game coverage at any affordable value.

What can: **the driver.** `bench_speed.js` shows the *same engine* completing 95.6% of games by turn 12
(median 7, max 21, 2,831 games, zero hitting a 200-turn cap) when it plays its own greedy policy
instead of chasing census rows. A second arm driven that way would answer *"do the two engines play the
same GAME to a result"* — and would populate severity band 1 (DIFFERENT-WINNER), which no configuration
of this instrument has ever been able to reach. **That is a separate instrument and a separate job**,
named here because raising the cap will not substitute for it and should not be sold as if it did.

---

## 6. RECOMMENDATION

**Do two distinct things. They have different costs and different risks.**

**(1) NOW — one diagnostic run at `--turns 30`, to `data/verification/`, ~10 minutes.**
Not to the published artifact. This is the only outstanding question that can invalidate a quarantine
lift, and it is ten minutes. It answers: *is the clean sheet a property of the engine, or of the
horizon?* If it comes back 0 board-material, the gate's claim gets strictly stronger for free. If it
comes back 5-10, the gate must not lift on the cap-12 reading.

Cap **30** for the diagnostic specifically — not 20 — because a diagnostic should see the whole tail
once, and the marginal cost of 30 over 20 is 3 minutes.

**(2) THEN — set the standing default to `--turns 20`, if and only if (1) finds something.**

**Why 20 and not 12, 16, 30 or 60:**

- **Not 12.** It compares 11.9 of a game's turns and truncates 98.2% of them, and the marginal turn
  past 12 is 1.7x richer in board-material causes per unit of compute than the average turn under it.
- **Not 16.** 16 is 1.3 min cheaper than 20 and misses the discriminating family: **PP exhaustion is
  unreachable before turn ~17** (a 16-PP move cannot empty sooner). Cap 16's deepest first credit was
  turn 13. 16 buys the cost without the coverage.
- **20 is where the three named turn-13-only families have all had a chance to fire, with margin.**
  PP exhaustion ~turn 17; a multi-turn counter reaching zero (Infestation, Heal Block, Throat Chop)
  ~turn 15-18 given a mid-game click; a forme reverting when its weather expires ~turn 13-18 on a
  second weather set. 20 clears all three. Nothing named is first reachable between 21 and 30.
- **Not 30.** It costs 2.4x the standing run against 1.64x for 20, and by the 2026-08-25 measurement it
  buys **one extra census row** and mostly repetition. `--turns` remains a flag, so a deep run is one
  word away when a specific late mechanism is under test.
- **Not 60.** Past turn ~32 a 16-PP move is empty and games become Struggle loops — a population no
  ladder game reaches. The store's whole tail past turn 20 is **0.38% of real games**. At that depth
  the instrument stops measuring the game we play, and it still only completes a quarter of its games.

**Cost of the standing raise:** 4.3 min → 7.0 min per run (**+2.7 min, 1.64x**), paid by every ENGINE
before/after pass. **Plus a one-time re-baseline**: every published cap-12 count (6 parted, 0
board-material, 253 rows credited, the 27-cause table) becomes non-comparable, correctly refused by
`arms_comparable.js`, and ENGINE needs one clean cap-20 baseline before its next wire.

**If (1) comes back at 0 board-material, do not raise it.** In that case 12 is right on both legs, the
gate's coverage line gets a measured cap-30 companion, and this job ends where the coordinator said it
might.

---

## OWED, NOT RUN

Nothing below was executed. Commands are pinned to the current artifact's own stamps: release
`4e5c7b3400de`, census pin `data/verification/census-pin-9446a684709d.json` (digest `9446a684709d`),
`--team-store data/team-pool-frozen`, arm `middle`, `--games 1200` (a PAIR budget yielding 961 games).
`SHOWDOWN_PATH` must be set. **ENGINE holds the machine — this is for ENGINE to run, not MEASURE.**

```bash
# (1) THE DIAGNOSTIC — cap 30, ~8-11 min, NEVER touches data/game-differential.json.
#     --out is honoured only inside the --write block, so BOTH flags are required.
#     data/verification/ is excluded from provenance, quarantine and the docs gates by design.
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/game_differential.js \
  --games 1200 --arm middle --turns 30 \
  --release 4e5c7b3400de \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --state --end-state \
  --write --out data/verification/gd-turns30-4e5c7b3400de.json

# (1b) THE PAIRED CONTROL — the SAME release and pins at cap 12, also diverted.
#      Required, not optional: the standing artifact was generated on the live tree and a
#      re-baseline needs both legs taken by the same binary in the same session.
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/game_differential.js \
  --games 1200 --arm middle --turns 12 \
  --release 4e5c7b3400de \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --state --end-state \
  --write --out data/verification/gd-turns12-4e5c7b3400de.json

# (1c) READ THE TWO — arms_comparable will REFUSE the pair on turns_cap. That is correct and
#      expected; read the summary counts as two baselines, never as a delta.
node -e "for (const f of ['gd-turns12-4e5c7b3400de','gd-turns30-4e5c7b3400de']) {
  const j = require('./data/verification/'+f+'.json'), a = j.arms[0], s = j.end_state[0].summary;
  const bc = s.by_cause.reduce((m,c)=>{m[c.materiality]=(m[c.materiality]||0)+c.games;return m;},{});
  console.log(f, 'cap', j.turns_cap, '| games', j.games, '| elapsed_s', j.elapsed_s,
    '| parted', a.diverged, '| end_reasons', JSON.stringify(a.end_reasons),
    '| materiality', JSON.stringify(bc), '| verdicts', JSON.stringify(s.verdicts),
    '| rows credited', j.credit.rows_with_an_observed_effect,
    '| deepest first credit', j.credit_turn_profile.deepest_first_credit_turn); }"

# (2) THE STANDING RAISE — ONLY IF (1) FINDS BOARD-MATERIAL CAUSES PAST TURN 12.
#     This DOES overwrite data/game-differential.json. publish_guard does not protect this
#     artifact and will not refuse it. It is a RE-BASELINE: every cap-12 figure in
#     docs/ENGINE.md becomes non-comparable and must be labelled, not rewritten.
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/game_differential.js \
  --games 1200 --arm middle --turns 20 \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --state --end-state --write
node engine/status.js --write
```

**Also owed, and MEASURE's own:**

- **Retract `docs/MEASURE.md:469-470`** — *"the whole-game differential's 12-turn cap truncates 1 game
  in 23 and is a no-op on the rest."* The measurement behind it is sound; the population transfer is
  not. The differential truncates 24 games in 25. Dated-history rules apply: label the block, do not
  rewrite the 4.4% figure, and put the corrected reading in a new block above it.
- **Verify the two unverified turn-13-only families** — the missing `|-end|` at counter expiry
  (`magnetrise@18` is declared a MISSING TICK at `medicham2-browser.js:6654-6705`) and forme revert on
  field-effect end. Both are lab probes costing milliseconds, and the 2026-08-25 report is explicit
  that the lab is the cheap way to reach them. **Route to ENGINE.**
- **The DIFFERENT-WINNER band has never been reachable and the cap cannot fix it.** A greedy-driver
  arm — the same engine that completes 95.6% of games by turn 12 in `bench_speed.js` — is the
  instrument that would populate severity rank 1. Not scoped here. **Needs a register row.**
- Nothing in this scoping run was measured on a live engine; every figure is read out of an artifact,
  and the two cross-cap timings are 9 days apart on different comparator sets. The cost table's range
  is honest about that and its endpoints are attributed.
