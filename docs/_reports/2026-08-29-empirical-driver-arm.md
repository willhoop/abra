# The empirical-driver arm of the whole-game differential — built, run, measured. MEASURE, 2026-08-29

**Built and run.** Two legs, same session, same binary, same pins: release `e129bca605e3`, census pin
`data/verification/census-pin-9446a684709d.json` (digest `9446a684709d`, 643 rows),
`--team-store data/team-pool-frozen`, `--games 1200` (a PAIR budget yielding **961 games**), arm
`middle`, `--turns 12`, `--state --end-state`. Both diverted with `--out` to `data/verification/`;
`data/game-differential.json` was not written.

Artifacts:
- `data/verification/game-differential.coverage-control.json` — generated `2026-08-29T03:54:01Z`
- `data/verification/game-differential.empirical.json` — generated `2026-08-29T03:58:42Z`

---

## 0. VERDICT

**The driver diagnosis is CONFIRMED, and the number is larger than the diagnosis needed it to be.**

| | coverage-seeker (control) | **empirical-click** |
|---|---|---|
| both engines ended the battle | **17 (1.8%)** | **459 (47.8%)** |
| cut off by the turn cap (12) | 944 (98.2%) | 454 (47.2%) |
| one engine ended, the other did not | 0 | 4 (0.4%) |
| instrument stop (unmirrorable forced switch) | 0 | 42 (4.4%) |
| THREW | 0 | 2 (0.2%) |

**1.8% → 47.8% at an identical cap, an identical release, an identical census pin and a byte-identical
team pool (`0d103fb9fa87`).** The cap was never the binding term. The driver was.

**And it costs the clean sheet.** The control reproduces the published headline exactly — 6 parted, all
NARRATION-ONLY, **0 board-material**, 0 DIFFERENT-END-STATE, 253 census rows credited. The empirical arm
on the same 961 games reads **248 parted, 128 board-material causes, 99 DIFFERENT-END-STATE, 41 games
where a body is dead in one engine and standing in the other.** The two cause sets are **disjoint**: not
one of the control's 6 appears among the empirical arm's 225.

**That is not a regression and it must not be reported as one.** `arms_comparable.js` refuses the pair
on `policy`, correctly. The 128 are a population the coverage arm has never once visited — turns 5-12 of
games that resolve, forced switches, post-KO replacement, and endings. **The quarantine clause reads
board-material zero on games that do not end.**

**Band 1 (DIFFERENT-WINNER) is reachable for the first time and reads ZERO.** 459 games resolved in both
engines; of the 99 whose final boards differ, none disagree about who won. That is a real result and it
is the first time this instrument could produce it.

---

## 1. WHAT WAS BUILT

Three files, ~330 lines, no engine change and no new data.

| file | what |
|---|---|
| `engine/empirical_driver.js` (NEW) | the table loader, the weighted draw, the switch rate, the counters. No heavy deps — it requires nothing. |
| `engine/steering.js` | a second policy `empirical-click/v1` beside `census-coverage-seeking/v1`, a `census_role` field, a `driver_inputs` block, and a comparability clause over the behaviour tables. |
| `engine/game_differential.js` | `--steering <coverage\|empirical>`; the release-read of the priors; `coveragePick` (the existing rule, moved out unchanged) and `empiricalPick`; a stateless driver address; the counters printed and stamped. |
| `engine/rollout_leaf.js` | **export only** — `pickByPrior` and `movePriorFor`, so the duplication can be tested. No behaviour changes, no require edge added, `engine_release.js` SOURCES untouched, no release stranded. |
| `tests/test-empirical-driver.js` (NEW) | 20 checks, **GREEN**. |

**Only the action selection changed.** Same swarm teams, same Mode A pinned dice on both sides, same
comparators, same census credit rule, same target rule, same mega policy, same ban/prefer axes. The
candidate set that `chooseAction` builds — legality from Showdown's own request, targets, `claimed` —
is byte-identical under both arms.

**Proof that the default did not move:** the control leg reproduces the published artifact's numbers
exactly (961 games, pool `0d103fb9fa87`, `{"the turn cap (12)":944,"both engines ended the battle":17}`,
6 parted, 0 board-material, 253 rows credited).

### 1.1 The reuse question, answered honestly

**`rollout_leaf.pickByPrior` could not be called, and the sampling rule is therefore DUPLICATED.**
Three reasons, in the code's header:

1. `rollout_leaf.js` requires `engine/medicham2-browser.js` and `engine/board.js` **from the live tree**
   at module load. Requiring it from the differential would pull a second, live copy of the simulator
   into a process whose entire purpose is to read a frozen release — the photograph rule broken by the
   act of importing the reuse.
2. `movePriorFor` reads `data/move-priors.json` off the live tree. The differential must read it out of
   the release, because that file **is** one of `engine_release.js`'s frozen SOURCES.
3. Lifting the sampler into a shared module adds a require edge to a frozen SOURCE, which
   `requireClosure()` then demands be added to SOURCES, which **strands every release cut before today**
   (LESSONS §12 — that reached 168 of 200 releases once). MEASURE does not get to impose that to save
   fifteen lines.

**So the duplication is pinned by a test rather than by a promise.**
`tests/test-empirical-driver.js` §1 runs 720 draws of the same rows through both implementations across
a sweep of `u` and asserts the same move comes back every time. **720/720 agree.** The `0.02`
carried-but-never-observed floor is kept byte-for-byte from `rollout_leaf.js:718`.

---

## 2. CAN IT SWITCH? YES — AT THE MEASURED RATE, AND THE BODY IT SENDS IS UNMODELLED

**Yes.** `data/move-priors.json` carries no switch model, so the RATE is read from
`data/rollout-switch-census.json` — `pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch`,
**9.98%**, derived from the raw logs of both human stores over 58,639 finished games. That artifact is
upstream of MEDICHAM and not quarantined. It is the CONDITIONAL rate, matched to this denominator
(the draw only happens when a live body is on the bench) — using the marginal rate instead is the
documented mistake that made a playout switch at 3.9% while claiming 7.7%.

**Realised: 9.675% over 42,604 decisions taken with a live bench.** Against 9.98% measured. The draw is
working.

**Absent artifact is a REFUSAL, not a zero.** `rollout_leaf.js` degrades to "cannot switch" and announces
it on stderr; this refuses at second zero, because a game that cannot switch does not end like a real
one and that is the entire question.

**WHAT IS NOT MODELLED, and it is stamped in the artifact rather than left to the reader:**
- **which body a switch goes to** — uniform over the legal bench. The priors say nothing about it.
- **the target of a move** — the existing first-live-foe rule is unchanged, deliberately, so that the
  only difference between the two arms is the action. `board.js:377` measures humans double-targeting
  23.4% of the time against ~50% for independent choice, so a target model is a real missing capability.
  Filed, not faked.

---

## 3. THE COUNTERS — 77,611 DECISIONS, PRINTED INCLUDING THE ZEROS

```
decisions                77611
move_from_prior          73489   (94.7%)   of which lead_table_used  7458
uninformed_draw           1820   (2.3%)    a row existed but held NONE of this body's legal moves
no_prior_row                 0   (0.0%)    <-- the loud state. ZERO.
row_via_base_forme          11             castformsunny -> castform and similar
switch_reached_the_draw  42604
switch_offered            4122   (9.675% realised against 9.98% measured)
no_bench                 33932
trapped                   1075
no_move_candidates           0
prefer_narrowed          20423
ban_narrowed                 0
driver_address_repeats       0   (must read 0)
```

**`no_prior_row` is zero and that is derived, not lucky.** `tests/test-empirical-driver.js` §4 walks the
format: of **347 legal species, 336 hit a prior row on Showdown's `species.id` directly and the other 11
resolve through the base forme** (Castform's weather formes, Vivillon and Alcremie patterns). Nothing in
this format is unprofiled. The fallback path exists, is counted, and did not fire.

**`ban_narrowed` reads 0 and that is CORRECT, not a dead counter.** `engine/diff_swarm.js` selects the
`omit-*` configurations' teams by a predicate that already excludes the feature
(`omit-protect: ok: t => !teamHas(t, F.protect, 'moves')`), so by the time `chooseAction` sees a body
there is no banned click left to remove. The `DRIVER_AXES` ban is belt-and-braces over a team predicate.
Confirmed by a dedicated `--config omit-protect` run: 324 decisions, 0 narrowed.

**`uninformed_draw` at 2.3% is the honest residue.** `engine/policy.js` keeps only the top 8 moves per
species, so a body carrying a rare fourth move gets the 0.02 floor on it. Those draws are near-uniform
over the moves the table does not know about and are counted as such rather than presented as behaviour.

---

## 4. WHAT THE ARM FOUND, AND HOW TO READ IT

### 4.1 The headline counts

| | control (coverage) | empirical |
|---|---|---|
| protocol PARTED | **6** | **248** |
| board-material causes / games | **0 / 0** | **114 causes / 128 games** |
| narration-only | 6 | 120 |
| verdicts | SAME-END-STATE 961 | SAME 856, DIFFERENT-END-STATE 99, ENDED-APART 4, THREW 2 |
| census rows credited | 253 | 252 |
| turn boundaries compared | 12,445 | 10,445 |
| elapsed | 102.8 s | 252.9 s |

**Severity bands over the 99 DIFFERENT-END-STATE games:**

| band | games | what |
|---|---|---|
| **1 DIFFERENT-WINNER** | **0** | the battle resolved in both and they disagree about who won |
| 2 DIFFERENT-BODIES-ALIVE | 41 | a body is dead in one engine and standing in the other |
| 3 HP-BEYOND-A-TYPICAL-HIT | 11 | (threshold measured: median hit 32.9% of a bar over 12,417 hits) |
| 4 DIFFERENT-IDENTITY-ON-A-LIVE-BODY | 5 | |
| 5 OTHER-STATE-DIFFERENCE | 28 | |
| 6 SMALL-HP-OR-BOOST-ONLY | 14 | |

Largest board-material families, by games:

```
  5  -status field 4        |-status|p1a|slp <> |-status|p1a|slp|[from]direclaw
  4  -unboost: a diff body  |-unboost|p1b|atk|1 <> |-unboost|p1a|atk|1
  3  event missing          |-damage|p1b|H/H|[from]innardsout <> |faint|p2a
  2  unrelated mismatch     |-damage|p2a|H/H <> |-hitcount|p2a|1
  2  unrelated mismatch     |-singleturn|p1a|protect <> |-fail|p1a
  2  ordering               |-damage|p2b|H/H <> |detailschange|p2a|mimikyubusted,l50
  2  unrelated mismatch     |-fail|p1b <> |-fieldactivate|perishsong
```

The tail is long and flat — 114 causes over 128 games, i.e. most causes are a single game. **This is a
first look at a new population, not a ranked defect list.** The end-state worklist (`party.hp` 73 games,
`active[].hp` 67, `party.status` 44, `party.fainted` 41) is the more useful entry point for ENGINE.

### 4.2 Three things that must be said beside those counts

1. **THIS IS A RE-BASELINE, NOT A DELTA.** `node engine/arms_comparable.js` on the two artifacts refuses
   the pair: *"the selection POLICY differs: census-coverage-seeking/v1 vs empirical-click/v1"*. It was
   checked against the requirement in the brief and it already refused on policy before I touched it;
   I added the same refusal over the empirical arm's own behaviour-table digests, which nothing covered.

2. **THE COMPARATOR MOVED THIS MORNING.** `choicelock` was added, taking the board comparator from 33
   leaves to 34. **It contributed nothing here** — grepped, and `choicelock` appears in zero of the 225
   causes and zero of the end-state leaf worklist rows. The 128 are not the new leaf.

3. **THE CENSUS PIN IS THE 643-ROW ONE, NOT THE LIVE 784.** Both legs used
   `census-pin-9446a684709d.json` so they are steered by identical bytes and so the control is
   comparable to the published artifact. The live census has since grown to 784 rows (`d8b2176a193f`).
   A run against the live census is a different sample.

### 4.3 The instrument's own limit, at 4.4%

**42 of 961 games (4.4%) stopped on "the boards parted — medicham2's placement cannot be expressed to
showdown".** This is the declared `mirrorForcedSwitch` refusal: the two engines already disagree about
which bodies are alive, so no answer to Showdown's replacement request reproduces medicham2's placement,
and the harness stops rather than manufacturing a divergence. Each of those games keeps its own EARLIER
divergence and is not a class of its own.

**It is a consequence of the arm, not a defect in it.** The coverage-seeker reaches almost no forced
switches; a driver that KOs bodies reaches them constantly (245 forced-switch slots mirrored in an
18-game smoke). It caps how deep this arm can follow a game once the boards part. It also means the
47.8% completion figure is a **lower bound** — those 42 games were still running.

**2 games THREW,** both instrument-side and both named in the artifact: a Protect disabled on the
authority but offered by our request, and a forced-switch `pass` Showdown would not take.

---

## 5. WHAT IT COSTS

**252.9 s against the control's 102.8 s on the same 961 games — 2.46x.** Note the direction: the
empirical arm compares **fewer** turn boundaries (10,445 vs 12,445, because half its games end early) and
still costs 2.5x. The cost is not turns; it is that 248 games part and each one carries context capture,
classification, shape analysis and an end-state board comparison, against 6 in the control.

**Four minutes for a run that reaches an ending in half its games.** Nothing here argues for raising the
cap: at cap 12 the empirical arm already completes 47.8%, and the companion turn-cap report measured the
coverage arm's hazard rate as flat at ~0.53%/turn, needing a cap near turn 130 to complete half its games.

---

## 6. WHAT I AM NOT CLAIMING

- **Not that 128 board-material causes are 128 defects.** They are 114 distinct causes across a
  population no instrument in this repository has looked at before, produced by an arm whose first run
  this is. Some fraction will be the instrument, as 162 of 169 roster accusations once were. The
  end-state leaf worklist is where to start, not the protocol cause list.
- **Not that band 1 = 0 proves the winner rule is right.** ROADMAP #362 records a real defect —
  `battleResult(S)` returns 0.5 on a simultaneous double wipe where `sim/battle.ts:2605` awards the win
  to the side whose body fainted last. Band 1 reads zero on **this** sample; a simultaneous wipe is rare
  and 459 resolved games may simply not contain one. The band being reachable is the finding; its value
  is a measurement on one sample.
- **Not that the empirical driver is realistic in every dimension.** It is realistic about WHICH MOVE
  and about HOW OFTEN SOMEBODY LEAVES. It is not realistic about the target (23.4% real double-targeting
  vs this driver's fixed first-live-foe) or about which body a switch sends. Both are stamped in the
  artifact under `not_modelled`.
- **Not that this replaces the coverage-seeker.** 48 legal moves are clicked zero times in 21,726 real
  games. The empirical arm cannot reach that tail by construction; the census and the roster are what do.
  The default is unchanged and the control leg proves the default did not move.
- **The two legs were taken 5 minutes apart on a settled tree**, with `data/game-differential.json`
  untouched by either. Neither leg read an artifact another process was writing.

---

## 7. OWED, NOT DONE

- **A register row.** The companion reports flagged this instrument from two sides
  (`2026-08-29-real-game-replay-scope.md` OWED item 7, `2026-08-29-turn-cap-scope.md` OWED item 3) and
  said it is the SAME row — do not open two. ROADMAP #263 should be **annotated**, not closed: its
  verdict *"do not lead with replay"* stands for a true replay and does not cover this arm, which keeps
  spreads unknown-but-identical and therefore keeps attribution.
- **A switch PRIOR, not just a switch rate.** The store carries the labels already — 110,495 voluntary
  switches and 99,113 post-faint replacements, separable by position within the turn. Until then the
  body a switch sends is uniform and the artifact says so. Route to whoever owns `engine/policy.js`.
- **A target model.** `data/move-priors.json` has none; `board.js:377` already measures the real
  double-target rate at 23.4%. ROADMAP #35.
- **`docs/MEASURE.md:469-470` still needs retracting** — *"the cap truncates 1 game in 23"*. The
  measurement (4.4% of `bench_speed.js` self-play games reach turn 12) is sound; the transfer to the
  differential is wrong by ~23x in the reassuring direction. Owed by the companion report, not done here.
- **`engine/replay_differential.js`'s `cannot_see` list is stale on two entries** (`c` and `ei` events
  have existed since commit `39e913f8`). Filed by the companion report. Not mine.
- **Nothing was committed and nothing was pushed.**

---

## OWED, NOT RUN

Everything below is what a follow-up would run. Nothing here has been executed.

```bash
# (1) THE SECOND SAMPLE. One run cannot separate the arm from the seed. The driver address is
#     stateless and derived from `cfgId|pr.tag`, so a re-run of these exact pins reproduces this
#     artifact byte-for-byte — which is a determinism check, not a second sample. To get a second
#     sample, move the team budget:
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/game_differential.js \
  --games 2400 --arm middle --turns 12 --steering empirical \
  --release e129bca605e3 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --state --end-state --write --out data/verification/gd-empirical-2400.json

# (2) THE DETERMINISM CHECK, which is cheap and worth having before anyone quotes the 128.
#     Re-run leg B unchanged and assert the artifact matches on games / end_reasons / by_cause.
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/game_differential.js \
  --games 1200 --arm middle --turns 12 --steering empirical \
  --release e129bca605e3 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --state --end-state --write --out data/verification/gd-empirical-repeat.json
node engine/arms_comparable.js data/verification/game-differential.empirical.json \
                               data/verification/gd-empirical-repeat.json   # must say COMPARABLE

# (3) THE DEEP DIAGNOSTIC THE TURN-CAP REPORT ASKED FOR, now worth running on THIS arm rather than
#     the coverage one — 47.2% of games are still truncated at 12 and they are the long games.
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/game_differential.js \
  --games 1200 --arm middle --turns 30 --steering empirical \
  --release e129bca605e3 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --state --end-state --write --out data/verification/gd-empirical-t30.json

# (4) READ ANY OF THEM. arms_comparable REFUSES a cross-policy or cross-cap pair; that is correct.
node -e "for (const f of ['game-differential.coverage-control','game-differential.empirical']) {
  const j = require('./data/verification/'+f+'.json'), a = j.arms[0], s = j.end_state[0].summary;
  const bc = s.by_cause.reduce((m,c)=>{m[c.materiality]=(m[c.materiality]||0)+c.games;return m;},{});
  console.log(f, '| policy', j.steering.policy, '| games', j.games, '| elapsed_s', j.elapsed_s,
    '| parted', a.diverged, '| materiality', JSON.stringify(bc),
    '| verdicts', JSON.stringify(s.verdicts),
    '| empirical', JSON.stringify(j.declared_gaps.empirical)); }"

# (5) THE GATE. `data/verification/` is outside provenance, quarantine and the docs gates by design,
#     so neither artifact above touches the published headline or the quarantine clause.
node engine/status.js --write
```
