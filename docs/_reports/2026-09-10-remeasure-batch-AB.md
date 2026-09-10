# Re-measure batch AB — the whole gate chain on the current tree

**Historical by construction. Every figure here is derived; re-derive rather than quoting this file.**
`node engine/status.js` prints what is true now.

**One line.** Nothing was fixed and nothing was found broken that was not already named: the six
clauses that read `MEASURED AGAINST A DIFFERENT ENGINE` were all re-run on one release and **five of
them PASS**; the gate now reads **8 of 9 PASS with NARRATION alone red at 3 of 961**, down from 6 of
961, and the three causes that disappeared are exactly the three residual-order rows the handler-list
fix was aimed at.

---

## 1. The premise of the brief was correct

Before the chain, `engine/status.js` read 6 FAIL / 2 PASS and **every one of the six failures was the
same kind** — `MEASURED AGAINST A DIFFERENT ENGINE — ran on release 489bea0577bc, tree is
5a7bd8a8178a`. Not one asserted breakage. `engine/medicham2-browser.js` had moved at
2026-09-10T02:59:28Z (commit `75efb271`, the residual handler-list sort, ROADMAP #563) and no
instrument had been run since.

Working tree at the start: clean apart from `data/open-work.json` and `data/provenance-stamp.json`
(both rewritten by a `status.js` run), no rebase in progress.

## 2. Pins, and every flag

**One release, cut once, handed to every leg.**

```
node engine/engine_release.js cut "re-measure batch AB on the residual handler-list sort (ROADMAP #563)"
  -> 5a7bd8a8178a   27 files frozen under data/releases/5a7bd8a8178a/
```

It reports **cut 7 of the same bytes, appended, nothing overwritten** — the first freeze of this tree
was 2026-09-10T02:59:43.699Z ("residual handler-list sort (interim, ROADMAP #563)") and this cut is
stamped 2026-09-10T04:28:56.728Z. `cut`/`why` at the top level still name the FIRST freeze, which is
the intended behaviour.

| pin | value | how it was checked |
|---|---|---|
| release | `5a7bd8a8178a` | passed explicitly to the roster, `all_mechanics_fire` and the whole-game differential; the damage differential stamps `engine_release.liveStamp()` off the tree and its artifact came back `5a7bd8a8178a` |
| census | `data/mechanics-census.json`, sha256[0:16] `1da84d77888ebc90`, steering digest `1da84d77888e` | `git diff HEAD -- data/mechanics-census.json` is EMPTY, so these are the committed 02:07:00.933Z bytes that were deliberately restored last session. The artifact records `matches_live: true` and the SAME `input_digest` the `489bea0577bc` run used, so the two arms select their samples identically |
| team store | `data/team-pool-frozen` | passed on the whole-game leg |

**The census was NOT regenerated.** It is a pin on this chain, not an output: `tests/test-mechanics.js`
was deliberately not run, because regenerating the census would have changed the steering bytes and
broken comparability with the run being superseded. Census stands at **835 probed / 835 live / 0
missing**, generated 2026-09-10T02:07:00.933Z — a claim about `489bea0577bc`, and re-running it is
OWED (below).

**Flags, in full, per leg.** `--games` is part of the sample definition and is recorded as such.

```
tests/test-engine-diff.js         --n 6000 --seed 20260804
tests/roster.js                   --stage all       --reds --write --release 5a7bd8a8178a
tests/roster.js                   --stage items     --reds --write --release 5a7bd8a8178a
tests/roster.js                   --stage abilities --reds --write --release 5a7bd8a8178a
tests/roster.js                   --stage moves     --reds --write --release 5a7bd8a8178a
engine/all_mechanics_fire.js      --kind all --write --release 5a7bd8a8178a
engine/game_differential.js       --steering empirical --release 5a7bd8a8178a --arm middle --end-state
                                  --census data/mechanics-census.json --games 1200
                                  --team-store data/team-pool-frozen --turns 50 --write
```

Every leg through `cmd /c tools\lownode.cmd` (BelowNormal) with
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`. Showdown commit
`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`.

**The brief's instruction to add `--census` to the differential line was followed.** Note what the
artifact says about it under empirical steering: `census_role: "CREDITED ONLY — it measures coverage
and does not select"`. The pin is still recorded and still checked by `arms_comparable.js`; it simply
is not the thing selecting games on this arm.

## 3. The exit code was not read as evidence

Every leg was checked on the artifact's own `generated` stamp and on the size of its output.

| leg | output | artifact `generated` | release in artifact |
|---|---|---|---|
| damage differential | full run, `wrote data/engine-diff.json` | 2026-09-10T04:30:39.478Z | `5a7bd8a8178a` |
| roster `--stage all` | 1368 lines | 2026-09-10T04:31:57.843Z | `5a7bd8a8178a` |
| roster items | 263 lines | 2026-09-10T04:33:05.264Z | `5a7bd8a8178a` |
| roster abilities | 619 lines | 2026-09-10T04:33:33.804Z | `5a7bd8a8178a` |
| roster moves | 661 lines | 2026-09-10T04:34:03.696Z | `5a7bd8a8178a` |
| all_mechanics_fire | 196 lines, 1313 games played, 0 threw | 2026-09-10T04:34:21.962Z | `5a7bd8a8178a` |
| whole-game differential | 628 lines | 2026-09-10T04:38:13.146Z | `5a7bd8a8178a` |
| `engine/status.js` | 805 lines | — | reads the seven above |

**`--stage all` does not write the three artifacts the gate reads.** It writes `data/roster.all.json`
(plus the `roster.json` convenience copy) and leaves `roster.items.json`, `roster.abilities.json` and
`roster.moves.json` untouched — their mtimes did not move. The three per-stage runs were therefore run
as well; without them the three roster clauses would still have been reading `489bea0577bc` artifacts
while the run reported success. This is exactly the shape the brief warned about, met in the field.

## 4. What the gate says now

**8 of 9 clauses PASS. One FAILS, and it is a named instrument red, not a re-run.**

| clause | before | after |
|---|---|---|
| game differential (damage) | FAIL — re-run owed | **PASS** — 0 of 6000 at the midpoint and at all sixteen indices, seed 20260804 |
| deliberate roster / items | FAIL — re-run owed | **PASS** — 142 of 148 tested, 0 DIFFER, 0 DID-NOT-FIRE |
| deliberate roster / abilities | FAIL — re-run owed | **PASS** — 139 of 201 tested, 0 DIFFER, 0 DID-NOT-FIRE |
| deliberate roster / moves | FAIL — re-run owed | **PASS** — 487 of 498 tested, 0 DIFFER, 0 DID-NOT-FIRE |
| coverage / every used mechanic measured | PASS | **PASS** — all 412 moves above 25 clicks |
| whole-game / BOARD-MATERIAL | FAIL — re-run owed | **PASS** — **0 of 961** |
| whole-game / NARRATION | FAIL — re-run owed | **FAIL — 3 of 961 across 4 causes** (4 raw, less 1 declared, 0 cleared on decision impact) |
| mechanics / staged and compared | FAIL — re-run owed | **PASS** — 5 diverge, 1 declared, 4 below the reach shelf, leaving 0 |
| no open, known engine defect | PASS | **PASS** — no open row names a RED instrument |

**The board-material clause, named:** `state.games` (961) less `state.games_board_never_diverged`
(961) = **0**. That is the clause the bar reads. `by_cause_totals` is `null` on this artifact and is
NOT the operand. 10705 of 10705 turn boundaries compared were identical; that denominator is not the
clause's.

**The narration clause, named:** 4 narration-only raw, less 1 declared (the perish drain above
`|upkeep|`, closeted by the owner) = **3 of 961 = 0.3%**, across **4 causes, each occurring in exactly
one game**.

## 5. What actually moved, and it is exactly the fix

`node engine/arms_comparable.js <HEAD artifact> data/game-differential.json` returns **COMPARABLE** —
same steering digest `1da84d77888e`, same 961 games, releases `489bea0577bc` -> `5a7bd8a8178a`. So the
difference between the two numbers is the change under test and nothing else.

Field by field, before -> after:

```
games                             961  ->  961     same
games_board_never_diverged        961  ->  961     same   (BOARD-MATERIAL 0 -> 0)
protocol divergences                7  ->    4     MOVED
protocol_diverged_board_never_did   7  ->    4     MOVED
turn_boundaries_compared        10705  -> 10705    same
coverage.exercised                732  ->  732     same
closet.teams_dropped               43  ->   43     same
threw                               1  ->    1     same
declared_gaps.choices_refused       2  ->    2     same
games_cut_off_by_the_turn_cap       0  ->    0     same
```

**The three causes that stopped are all three residual-order rows:**

```
GONE  ordering :: |-damage|p2b|H/Hbrn|[from]brn  <>  |-damage|p1b|H/Hbrn|[from]brn
GONE  ordering :: |-damage|p1a|H/Hpsn|[from]psn  <>  |-damage|p1b|H/Hpsn|[from]psn
GONE  ordering :: |-heal|p1b|H/H|[from]leftovers <>  |-heal|p2a|H/H|[from]leftovers
```

The four that remain:

```
ordering                 :: |-activate|p1a|lightningrod <> |-prepare|p1b|electroshot   1 game
event missing from medi. :: |upkeep <> |faint|p1a                                      1 game
-fail field 3            :: |-fail|p1a|shedtail|[weak] <> |-fail|p1a                   1 game
unrelated event mismatch :: |-fail|p2b <> |-activate|p1a|psychicterrain                1 game
```

One of those four is the declared perish-drain row, which is why the clause reads 3 rather than 4.

## 6. The prediction, scored

Written to `data/verification/_prediction-2026-09-10-batch-AB.json` **before the first run**, and it
states which of the prior session's numbers it agrees with.

| predicted | measured | verdict |
|---|---|---|
| damage differential 6000 compared / 0 disagreed | 6000 / 0 | **right** |
| roster: 0 DIFFER across all three stages, counts identical | 142 / 139 / 487, 0 DIFFER, 0 DID-NOT-FIRE | **right** |
| `all_mechanics_fire`: moves resolved 495 of 500, diverged 4 | 495 of 500, diverged 4; abilities fired 104, diverged 1; items fired 64, diverged 0 | **right** |
| whole game: 961 games | 961 | **right** |
| BOARD-MATERIAL 0 of 961 | 0 of 961 | **right** |
| NARRATION 3 of 961 (point estimate inside a 3-6 range) | 3 of 961 across 4 causes | **right, at the point estimate** |

**What the prediction got wrong: nothing in its numbers, and one thing in its scope.** It did not
anticipate that `--stage all` writes a different artifact from the three the gate reads, so the leg
list in the brief would, taken literally, have left three clauses stale. That is a gap in the plan,
not in the prediction.

**I agreed with the prior session's prediction and narrowed it.** Its BOARD-MATERIAL 0 and its
narration range 3-6 were both correct; committing to 3 was justified by the trio being exactly three
games with a mechanism proven in both directions by the two knob probes, and the by-cause diff above
confirms the attribution rather than merely the total.

**The named risk did not materialise.** The prediction stated that a residual-ORDER change is not
automatically narration — if two bodies both die to residual damage, which one is walked first decides
which faints first, and a faint order is board state. Board-material stayed at 0, so on this pool no
game was near that edge.

## 7. Findings recorded and deliberately NOT fixed

Nothing in `engine/` was touched during this chain. Three things are named so they are not found
later as surprises.

**(a) The roster's `all` stage and its per-stage runs disagree on two rows, and it is the usage shelf.**
`data/roster.all.json` reads `FIRED-AND-BOARDS-DIFFER: 2` — `axekick` and `electrify`. In
`data/roster.moves.json` those same two rows read `DEFERRED-BY-OWNER`, *"SHELVED ON USAGE, NOT MEASURED
CLEAN"* — 2 clicks and 18 clicks across 64,846 stored games, under the shelf of 25. So they are real,
reproducible divergences that the moves stage shelves and the all stage does not, and the gate reads
the per-stage artifacts. **This is not new and not caused by the fix**: `data/roster.all.prev.json`
(2026-08-23, release `39ac0253d3ca`) carries the same two rows with the same verdict. It is the obscure
tail Will ranked below the pinned pool on 2026-08-23, and it is a discrepancy between two artifacts
rather than a divergence between two engines.

**(b) Two `battle.choose()` refusals and one thrown game persist, and both print `MUST READ 0`.**
`declared_gaps.choices_refused: 2` (first: p1 `"move 4, move 1"` — *Can't move: Floette's Protect is
disabled*) and `threw: 1`. Identical to the superseded artifact, so unchanged by the fix.

**(c) `all_mechanics_fire` still reports 2 rows that part a BOARD with the two protocol streams in
agreement** — `axekick` and `clearsmog`, both *"boards parted at turn 1 ... WITH NO LINE DIFFERENCE AT
ALL"* — plus `healbell` and `reflecttype` parting with a line difference. All four sit inside the 4
diverging move rows the mechanics clause counts, all 4 of which are below the reach shelf, which is why
that clause passes at 0. They are measured, they are counted, and they are not on the gate.

## 8. Every artifact this chain rewrote

```
data/engine-diff.json
data/roster.all.json        (+ data/roster.all.prev.json, data/roster.json)
data/roster.items.json      (+ .prev.json)
data/roster.abilities.json  (+ .prev.json)
data/roster.moves.json      (+ .prev.json)
data/all-mechanics-fire.json
data/game-differential.json
data/verification/_prediction-2026-09-10-batch-AB.json   (written BEFORE the chain)
data/releases/5a7bd8a8178a/cuts.jsonl                    (one appended cut event)
data/open-work.json, data/provenance-stamp.json          (rewritten by status.js; not an outcome)
```

Nothing under `engine/` moved. `data/mechanics-census.json` was not touched.

---

## OWED, NOT RUN

```bash
# 1. THE CENSUS STILL STANDS ON 489bea0577bc. It was pinned on this chain rather than regenerated,
#    deliberately, because regenerating it changes the steering bytes and breaks comparability with
#    the run being superseded. Re-run it FIRST in the next session, then re-pin, and note that every
#    differential taken after it answers a slightly different question.
cmd /c tools\lownode.cmd tests\test-mechanics.js
node engine/status.js

# 2. THE NARRATION CLAUSE IS THE WHOLE OF THE GATE NOW - 3 of 961, four causes, one game each.
#    Take one cause, write the probe, watch it fail, fix, re-run this same chain on a fresh release.
#      ordering                 :: |-activate|p1a|lightningrod <> |-prepare|p1b|electroshot
#      event missing from medi. :: |upkeep <> |faint|p1a
#      -fail field 3            :: |-fail|p1a|shedtail|[weak] <> |-fail|p1a
#      unrelated event mismatch :: |-fail|p2b <> |-activate|p1a|psychicterrain
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release 5a7bd8a8178a --arm middle --end-state --census data/mechanics-census.json --games 1200 --team-store data/team-pool-frozen --turns 50 --dump-games

# 3. THE ROSTER'S TWO SHELVED DIFFERS - axekick and electrify. Decide whether the usage shelf should
#    hide a reproducible divergence from the all-stage artifact, or whether roster.all.json should
#    apply the same shelf the per-stage runs do.
node -e "const a=require('./data/roster.all.json'),m=require('./data/roster.moves.json');const f=j=>(j.rows||j.results||[]).filter(r=>/axekick|electrify/.test(r.id||r.name||'')).map(r=>[r.id||r.name,r.verdict||r.status]);console.log('all',f(a));console.log('moves',f(m))"

# 4. THE CORNER ARMS HAVE STILL NEVER BEEN RUN ON THE WHOLE GAME (carried from the 2026-09-10
#    session-close block; a board that parts only at a corner is a tie-handling defect).
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release 5a7bd8a8178a --arm top-tie-first --end-state --census data/mechanics-census.json --games 1200 --team-store data/team-pool-frozen --turns 50 --out data/verification/game-differential-top-tie-first.json
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release 5a7bd8a8178a --arm bottom-tie-first --end-state --census data/mechanics-census.json --games 1200 --team-store data/team-pool-frozen --turns 50 --out data/verification/game-differential-bottom-tie-first.json

# 5. THE DAMAGE DIFFERENTIAL HAS STILL NEVER APPLIED A MULTI-HIT MOVE - 134 skipped volleys and 17
#    Parental Bond clicks, on the freshly measured artifact.
node -e "const j=require('./data/engine-diff.json');console.log(j.skipped_multihit, j.skipped_ability_multihit)"

# 6. CARRIED, UNTOUCHED BY THIS CHAIN - the last illegal fixture in the repository
#    (engine/game_differential.js:6186,6256,6325,6348 stages a body that cannot learn its move):
node tests/test-fixture-legality.js

# 7. CARRIED - the stale bundle and the figure it orphans (ROADMAP #568), and the two stale instruments:
cmd /c tools\lownode.cmd tests\test-mutation-coverage.js --write
node tests/test-board-browser.js
```
