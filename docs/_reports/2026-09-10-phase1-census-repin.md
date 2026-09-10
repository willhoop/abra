# Phase 1 of the 6.0.0 path — settle the instruments, then re-measure on them

**Historical by construction. Every figure here is derived; re-derive rather than quoting this file.**
`node engine/status.js` prints what is true now.

**One line.** The last illegal fixture in the repository is repaired and the census is regenerated —
`1da84d77888e` → **`257acf955593`**, **835 rows in and 835 rows out, zero added, zero removed, zero
status flips** — and the whole gate chain re-run on the new census reads **GATE: OPEN, 9 of 9 clauses
PASS**, board-material **0 of 961** and narration **0 undeclared of 961**, identical to the pinned-census
chain it supersedes. **Two instrument defects were found in step 5 and left unfixed**: a corner-arm run
compares no board at all yet reports the gate's board-material arithmetic as a clean `0`.

---

## 0. THE GUARD — the tree was settled before anything was measured

`git status --short` at 02:45 showed a MEASURE agent's docs edits in flight. Step 1 (which touches
neither the docs nor any artifact) was done first, and the tree was then polled at 20-second intervals
for two minutes: the newest mtime anywhere under `docs/`, `data/`, `engine/` and `tests/` held still at
`docs/ROADMAP.md 02:50:58` across six samples. The release was cut at 02:57. No file in frame moved
during any leg.

**A COMMIT LANDED AT 02:54:12 AND IT CHANGED NOTHING IN FRAME.** `fc470fd5` (the publisher, committing
the previous chain) went in between the last mtime poll and the census regeneration. A commit records
the working tree, it does not rewrite it, and that was CHECKED rather than assumed: the live
`engine/medicham2-browser.js` hashes to `204e6c4e9548`, **identical to the copy frozen under
`data/releases/8ac9c4d888f1/`**, and `git show HEAD:engine/game_differential.js` still carries all
three Incineroar/Knock Off sites, so this phase's repair is uncommitted working-tree work exactly as
intended. It also cleared an inherited red: `tests/test-docs-current.js` was 34 passed / 1 failed at
the start of this phase (`docs/MODELS.md|7,381`) and reads **35 passed / 0 failed** after it.

---

## 1. THE LAST ILLEGAL FIXTURE — repaired at four sites, two different repairs, on purpose

`tests/test-fixture-legality.js` read **2 FAILED**: one NEW illegal set and one NEW illegal declaration,
both the same sentence.

```
[PAIRING] Incineroar can't learn Knock Off.   carriers: 95
  set:   incineroar @ (no item) / Blaze / [Knock Off, Protect]
  sites: engine/game_differential.js:6186, :6256, :6325, :6348
```

**The carrier is DERIVED, not typed.** `CS.moveCarriers('Knock Off')` under
`gen9championsvgc2026regmb` answers **95 legal carriers**; intersected with the damage engine's own
table through `engine/mc_key.js` (never a species key in a grep) that is **80 carriers the engine can
build**. The body chosen preserves what the arms actually take from Incineroar:

| | type | atk | spe | ability declared |
|---|---|---|---|---|
| Incineroar | Fire/**Dark** | 115 | 60 | Blaze |
| **Pangoro** | Fighting/**Dark** | 124 | 58 | Iron Fist |

**Dark is the load-bearing half** — Knock Off is a Dark move and all three load-bearing arms are priced
with STAB — and the two-point speed gap moves no script's turn order (Snorlax 30 still last, Gengar 110
still first). Iron Fist is inert here: Knock Off's flags read `{contact, protect, mirror, metronome}`
with **no `punch`**, read off `dex.moves.get('knockoff').flags` rather than recalled.
`CS.canLearn('Pangoro','Knock Off')` and `('Pangoro','Protect')` both answer `true`.

**THE FOURTH SITE IS REPAIRED THE OTHER WAY ROUND, AND THAT IS THE POINT.** At `:6256` the row is *the
sandstorm residual is speed-sorted, not slot-ordered*, its script is four Protects, and Knock Off is a
filler nothing clicks. Its premise **is** Incineroar — a body slower than the Whimsicott sitting behind
it in slot B, and one sandstorm can chip. Swapping the body there would have thrown away the thing the
row exists to test in order to repair a decoration, so the DECORATION was replaced:
`CS.canLearn('Incineroar','Close Combat')` = `true`.

**THE RISK WAS NAMED BEFORE THE SWAP AND THEN MEASURED.** The Sitrus arm's premise is that the hit
crosses BELOW half without killing; Pangoro's 8% more Attack could have over-run it into a KO and left
the arm passing while asserting nothing. Measured from the authority's own stream, not assumed:

```
before (Incineroar)   |-damage|p2a: Gengar|145/405     35.8% — below half, alive
after  (Pangoro)      |-damage|p2a: Gengar|133/405     32.8% — below half, alive
```

**RESULT.** `node tests/test-fixture-legality.js` → **ALL GREEN**: *"no new illegal fixture set — 15
verdicts, all 15 on the baseline"*, *"no new illegal declaration — 15 pairs, all on the baseline"*, and
all 15 baselined verdicts still produced (no stale allowance). The one UNREACHABLE row
(`Milotic can't learn Spore`) is baselined with a written reason and is untouched.

`cmd /c tools\lownode.cmd tests\test-game-differential.js` → **ALL PASSED**, including the arms that
would have caught a broken repair:

```
PART 3b  "knock-off order — the item leaves before": endpoints agree (114..135) AND the interior
         is the authority's — 15 distinct values on both sides, every multiplicity equal
PART 3c  boost x1.5: showdown 1.479, medicham 1.479   (expected 1.5, tolerance 0.05)
         reduction x0.5: showdown 0.500, medicham 0.500
         the three arms are distinguishable: 192 / 284 / 142
         both engines record Colbur as EATEN BY ITSELF and neither as knocked off
         the Sitrus half agrees exactly: both engines strip it, neither heals
```

---

## 2. THE CENSUS — regenerated, and it moved two rows, both still LIVE

```
cmd /c tools\lownode.cmd tests\test-mechanics.js      exit 0, 864 lines, "wrote data/mechanics-census.json"
```

| | before | after |
|---|---|---|
| sha256[0:16] | `1da84d77888ebc90` | **`257acf955593baf2`** |
| steering digest | `1da84d77888e` | **`257acf955593`** |
| generated | 2026-09-10T02:07:00.933Z | 2026-09-10T06:56:45.839Z |
| probed / live / missing | 835 / 835 / 0 | **835 / 835 / 0** |
| `results` rows | 835 | 835 |
| run_ok / threw / hollow / unarmed | true / 0 / 0 / 0 | true / 0 / 0 / 0 |

**Rows added 0, rows removed 0, status flips 0** — keyed on `kind + id` and compared row by row. So the
row POPULATION either side of the regeneration is identical, and a comparison drawn across it is not
invalidated by a changed denominator. **The digest changed regardless**, because `generated` is inside
the hashed bytes.

**EXACTLY TWO ROWS' CONTENT MOVED**, and neither changed a verdict:

- `move/formatSecondaryChance` — *Iron Head flinches at this FORMAT's 20%* — `20.3% → 19.1%` over 6000
  turns, control Rock Slide `25.8% → 27.0%`. Unseeded Monte Carlo noise around the same claim.
- `move/setsTerrain` — *Psychic Terrain refuses priority only against a GROUNDED target* — the counter
  `seen.terrainSparedAirborne` reads **+4 → +2**. **This is the measurable footprint of the terrain-gate
  fix** (the Sucker-Punch-vs-terrain cause closed at 5.279.0, which moved the terrain bar below the
  move's own `Try`). The row's assertion is `must be > 0` and it still holds; every damage figure in the
  row is byte-identical.

---

## 3. THE RELEASE — and the id did not move, which is the finding

```
node engine/engine_release.js cut "PHASE 1 of the 6.0.0 path ..."
  -> 8ac9c4d888f1   27 files frozen   showdown 20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4
```

**The same id as the narration-close chain**, appended as cut 16 of identical bytes with nothing
overwritten (`cut`/`why` at the top level still name the first freeze, 2026-09-10T05:41:36.883Z).
That is correct and it is load-bearing: `engine/game_differential.js` and `data/mechanics-census.json`
are **not** among the 27 frozen SOURCES, so **no engine byte moved in this phase**. Any difference in
what follows is the instrument or the census, and cannot be the simulator.

*(Three cuts were taken while establishing this — two of them with a thin `why`. Cuts are append-only
events in `data/releases/8ac9c4d888f1/cuts.jsonl` and none of them rewrote anything; recorded here
because it is visible in the log.)*

---

## 4. THE GATE CHAIN ON THE NEW CENSUS — every leg, every flag

Every leg through `cmd /c tools\lownode.cmd` (BelowNormal), `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.
**Judged on the artifact's own `generated` stamp and the size of its output, never on the exit code.**

| leg | flags | result | artifact `generated` |
|---|---|---|---|
| `tests/test-engine-diff.js` | `--n 6000 --seed 20260804 --write` | **6000 compared, 0 disagreed** | 06:59:27.824Z, release `8ac9c4d888f1` |
| `tests/roster.js` | `--stage items --reds --write --release 8ac9c4d888f1` | **142 of 148 tested, 0 DIFFER, 0 DID-NOT-FIRE**, 0 CONTROL-NOT-QUIET, 6 COULD-NOT-STAGE | 06:59:45.818Z |
| `tests/roster.js` | `--stage abilities --reds --write --release 8ac9c4d888f1` | **139 tested, 0 DIFFER, 0 DID-NOT-FIRE**, 0 dead anchors (44 of 44 plants apply exactly once) | 07:00:23.542Z |
| `tests/roster.js` | `--stage moves --reds --write --release 8ac9c4d888f1` | **487 tested, 0 DIFFER, 0 DID-NOT-FIRE** | 07:01:04.791Z |
| `engine/all_mechanics_fire.js` | `--kind all --write --release 8ac9c4d888f1` | **1313 games played, 0 threw**, 0 sheets unassembled; moves diverged **4**, abilities **1**, items **0** | 07:01:13.317Z |
| `engine/game_differential.js` | `--steering empirical --release 8ac9c4d888f1 --arm middle --end-state --census data/mechanics-census.json --games 1200 --team-store data/team-pool-frozen --turns 50 --write` | **961 games of 1200 requested** | 07:04:15.006Z |

**The three roster stages were run INDIVIDUALLY**, never `--stage all` — that writes `roster.all.json`
and not the three artifacts the gate reads.

**THE WHOLE-GAME CLAUSES, WITH THE CLAUSE NAMED AND BOTH OPERANDS READ.**

```
BOARD-MATERIAL = state.games (961) less state.games_board_never_diverged (961)  =  0 of 961
                 10,705 of 10,705 turn boundaries compared were IDENTICAL
                 state.first_board_divergences is EMPTY
NARRATION      = state.protocol_diverged_board_never_did (1) less the declared rows (1)  =  0 undeclared
                 protocol_diverged_games 1;  960 of 961 games' protocol never parted
```

`by_cause_totals` is not a top-level field of this artifact; the by-cause attribution lives at
`end_state[0].summary.by_cause` and reads **BOARD-MATERIAL 0 causes / 0 games, NARRATION-ONLY 1 cause /
1 game, UNKNOWN 0** — the perish drain Will closeted on 2026-08-28. Other pins the artifact records:
`census_role: "CREDITED ONLY — it measures coverage and does not select"` (empirical steering does not
select on the census), team pool `0d103fb9fa87` (1968 teams from a corpus of 8778), `turns_cap 50`,
`games_cut_off_by_the_turn_cap 0`, `games_void_excluded 0`, `mid_void.usable_games 961 of 961`,
`declared_gaps.choices_refused 2`, `undeclared_event_drops 0`, driver code `4a1731a53d97` unchanged
across the whole run.

**THE GATE.** `node engine/quarantine.js` → **GATE: OPEN — MEDICHAM passes both conditions; nothing is
withheld**, all 9 clauses PASS. `node engine/status.js` prints *"the LIVE gate says 0 of 9 GATING
clauses fail (OPEN)"* and no QUARANTINE block.

### The predictions, and how they came out

Written to `data/verification/_prediction-2026-09-10-phase1.json` **before** any leg ran.

| # | predicted | measured | |
|---|---|---|---|
| 0 | fixture legality ALL GREEN; Sitrus arm still crosses below half | ALL GREEN; 133/405 | ✔ |
| 1 | census 835/835/0 unchanged, digest changes anyway | 835/835/0, 0 adds/removes/flips, `257acf955593` | ✔ |
| 2 | the gate stays 9 of 9 PASS | 9 of 9 PASS | ✔ |
| 3 | 6000 compared / 0 disagreed | 6000 / 0 | ✔ |
| 4 | roster 142 / 139 / 487, all zero-differ | 142 / 139 / 487, all zero-differ | ✔ |
| 5 | ~1313 games, 0 threw, diverged 4 / 1 / 0 | 1313, 0 threw, 4 / 1 / 0 | ✔ |
| 6 | 961 games, board-material 0, narration 0 undeclared | 961, 0, 0 | ✔ |
| 7 | corner arms — declared GENUINELY UNKNOWN | see §5; the honest answer is that the arms as run cannot say | — |
| 8 | multi-hit ~134 / ~17 | 134 / 17 | ✔ |

**`node engine/arms_comparable.js` answers NOT COMPARABLE against HEAD's artifact**, for two stated
reasons and both are true: the INSTRUMENT moved (`engine/game_differential.js`, the fixture repair) and
the steering INPUT moved (census `1da84d77888e` → `257acf955593`). **That refusal is correct and it is
not in tension with the identical numbers.** The two arms played the same number of games (961), took
the same number of boundaries (10,705), exercised the same coverage (732) and produced the same three
clause values; but they were not the same question, so this is reported as *the chain re-run on the new
census reads the same*, never as a before/after.

---

## 5. THE TWO CORNER ARMS — and TWO INSTRUMENT DEFECTS, FOUND AND LEFT

Both arms: same release `8ac9c4d888f1`, same census `257acf955593`, `--steering empirical --end-state
--games 1200 --team-store data/team-pool-frozen --turns 50`, each `--write --out` to its own file.

**`--write` WAS REQUIRED AND THE BRIEF SAID NOT TO PASS IT.** The first `top-tie-first` run used
`--out` alone: it played all 961 games, printed 506 lines and **wrote no artifact**, exiting 0 — the
write is gated on `WRITE` (`engine/game_differential.js:9517`). The published slot is protected
separately: the guard at `:298` is `WRITE && !OUT && ...`, so `--write --out <path>` cannot touch
`data/game-differential.json`. Both arms were re-run that way. `data/game-differential.json` is
byte-unchanged since 07:04:15 and still carries the middle arm.

| | middle | top-tie-first | bottom-tie-first |
|---|---|---|---|
| games | 961 | 961 | 961 |
| **`state.games` less `state.games_board_never_diverged`** | 961 − 961 = **0** | **0 − 0** | **0 − 0** |
| `state.turn_boundaries_compared` | **10,705** | **0** | **0** |
| `end_state.by_cause` BOARD-MATERIAL | 0 causes / 0 games | **14 causes / 15 games** | **12 causes / 13 games** |
| `end_state.by_cause` NARRATION-ONLY | 1 / 1 | 10 / 10 | 20 / 20 |
| protocol parted | 1 | 25 | 33 |
| end-state verdicts | 960 same, 0 different, 1 threw | 947 same, 9 different, 4 ended-apart, 1 threw | 948 same, 11 different, 0 ended-apart, 2 threw |
| `mid_void.usable_games` | 961 | **0** | **0** |

### DEFECT A — a corner-arm run compares NO board, and the gate's own arithmetic reads it as a clean zero

`state.turn_boundaries_compared` is **0** on both corner arms. The cause is one line:

```js
// engine/game_differential.js:1946
const PRIMARY_ARM = ARMS[0];                       // always `middle`
// :7199 (the per-arm loop)
const isPrimary = arm.id === PRIMARY_ARM.id;
...
if (isPrimary) { results = armResults; control = armControl; }
```

`--arm` sets `ARMS_RUN`; it does **not** move `PRIMARY_ARM`. So on a corner-only run `isPrimary` is
false for every arm, `results` stays empty, and `STATE_SUMMARY` — which is `((allResults) => ...)(results)`
at `:8299` — walks nothing. **The bar the quarantine clause names then computes `0 − 0 = 0` over an
empty population and is indistinguishable from a perfect run.** This is the repository's signature
failure: a capability absent, everything reporting success.

**Cleared with a knob-varied control**, not inferred: the identical command line with `--arm middle`
reads `state.games 961 / boundaries 10,705`, and with `--arm top-tie-first` reads `0 / 0`. The only
thing varied is `--arm`.

### DEFECT B — the low-identity exclusion is middle-only, so a corner arm cannot tell the engine from the ruler

`MID_VOID_SUMMARY` is computed inside `if (PRIMARY_ARM.middle)` (`:7825`), so both corner artifacts
carry `mid_void.usable_games: 0`. The middle arm's whole purpose is that the two engines draw the same
dice; a corner arm deliberately does not, and the instrument's own filter for *"the two dice streams are
not shared, so this board split is the RULER and not the engine"* never runs there.

**The causes say the same thing without needing the filter.** The board-material causes on both corner
arms are dominated by DICE shapes — `|-miss|` against `|-damage|`, `|-crit|` against `|-damage|`,
`-supereffective` against `-miss`, and one `-damage field 3` whose whole disagreement is
`131/135 vs 132/135` (a single damage-roll index).

### AND THE TWO CORNERS SHARE NOT ONE CAUSE

The brief's rule — *a board that parts only at a corner is a tie-handling defect; a board that parts at
both is not a tie question at all* — needs a third answer here. The intersection of the two corner arms'
board-material cause sets is **EMPTY**: 14 causes top-only, 12 bottom-only, **0 in both**. A genuine
tie-handling defect would be expected to reproduce under at least one corner consistently; **two disjoint
sets of one-game causes, each dominated by miss/crit/damage-roll draws, is the signature of unshared
dice**, not of tie order.

**VERDICT ON STEP 5: the corner arms as run do not answer the tie question, and the honest report is
that they cannot until Defect A and Defect B are fixed.** Reported and left, per the brief. Nothing here
is quoted as a board-material figure for MEDICHAM; the gate's board-material number remains **0 of 961
on the middle arm** and is unaffected.

Artifacts: `data/verification/game-differential-top-tie-first.json` (450,537 bytes, generated
07:10:32.637Z) and `data/verification/game-differential-bottom-tie-first.json` (452,900 bytes, generated
07:12). Neither is published and neither is read by any gate.

---

## 6. THE MULTI-HIT SCOPE — reported, not fixed

On the freshly regenerated `data/engine-diff.json` (`generated 2026-09-10T06:59:27.824Z`,
6000 compared, 0 disagreed):

```
skipped_multihit          134
skipped_ability_multihit   17
```

**The damage differential has still never applied a multi-hit move.** 134 volleys and 17 Parental Bond
clicks are skipped rather than compared, unchanged from the previous chain. Wiring the volley loop is
its own batch and nothing here touches it.

---

## 7. OUT OF SCOPE, HONOURED

- **The item-disposition leaf** (`lastItem` / `ateBerry`, CANDIDATE in `state.not_compared`) was not
  touched. Its own note says the expected effect is NOT zero; it gets its own batch so a board-material
  change can be attributed to it.
- `docs/MODELS.md` was not touched.
- Nothing found in steps 2-6 was fixed while measuring.

---

## OWED, NOT RUN

```bash
# 1. DEFECT A — A CORNER-ARM RUN COMPARES NO BOARD AND THE GATE'S ARITHMETIC READS IT AS ZERO.
#    engine/game_differential.js:1946 `const PRIMARY_ARM = ARMS[0]` and :7199 `isPrimary` mean a
#    corner-only run never assigns `results`, so STATE_SUMMARY walks an empty array and
#    `state.games - state.games_board_never_diverged` is 0 - 0. Write the probe FIRST: it must assert
#    that a corner-arm artifact carries turn_boundaries_compared > 0, and be shown RED on these bytes.
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release 8ac9c4d888f1 --arm top-tie-first --end-state --census data/mechanics-census.json --games 60 --team-store data/team-pool-frozen --turns 50 --write --out data/verification/_probe-cornerstate.json
node -e "const j=require('./data/verification/_probe-cornerstate.json');console.log(j.state.games, j.state.turn_boundaries_compared)"

# 2. DEFECT B — THE LOW-IDENTITY (`mid_void`) EXCLUSION IS COMPUTED ONLY WHEN PRIMARY_ARM.middle
#    (:7825), so both corner artifacts read `usable_games: 0` and cannot separate an engine board
#    split from a dice-stream split. Until this is fixed no corner-arm board figure is attributable.
node -e "for(const p of ['top','bottom'])console.log(p, JSON.stringify(require('./data/verification/game-differential-'+p+'-tie-first.json').mid_void))"

# 3. THE TIE QUESTION IS STILL UNANSWERED. Once A and B are fixed, re-run both corners on ONE release
#    and ONE census and report the intersection of the board-material cause sets — today it is EMPTY
#    (14 top-only, 12 bottom-only, 0 shared), which is the signature of unshared dice, not tie order.

# 4. THE MULTI-HIT VOLLEY LOOP — 134 skipped volleys and 17 Parental Bond clicks, still never applied
#    by the damage differential. Its own batch.
node -e "const j=require('./data/engine-diff.json');console.log(j.skipped_multihit, j.skipped_ability_multihit)"

# 5. THE PERISH DECLARATION'S EVIDENCE IS STILL OLDER THAN THE ENGINE — measured on release
#    5f3f7141227c, artifact is 8ac9c4d888f1. The clause prints EVIDENCE NOT RE-CHECKED on every run.
node -e "const j=require('./data/game-differential.json');console.log(j.state.protocol_diverged_board_never_did, j.state.games_board_never_diverged, j.state.games)"

# 6. THE SUPREME OVERLORD DECLARATION STILL MATCHES NOTHING IN THE NARRATION CLAUSE. It is still
#    matched by the MECHANICS clause, so check both before withdrawing it.

# 7. CARRIED FROM THE NARRATION-CLOSE OWED BLOCK, UNTOUCHED BY THIS PHASE:
node engine/provenance.js
cmd /c tools\lownode.cmd tests\test-mutation-coverage.js --write
node tests/test-board-browser.js
node tests/test-docs-current.js     # inherited red: docs/MODELS.md|7,381, a PORY judgement, not an engine fix
```
