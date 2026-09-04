# The pinned regeneration — five artifacts re-measured under one release, and the leaf-widening batch

2026-09-04, MEASURE. Heavy mode, authorised. Six stages, serial, each verified before the next
started. Nothing committed. `engine/quarantine.js` and `engine/status.js` were NOT run — the
coordinator reads the gate once the other two agents settle.

---

## 0. The release, and the thing the brief predicted that did not happen

```
node engine/engine_release.js cut "pinned regeneration after leaf widening and pin guard"
  cut engine release 8ad06030e129
  first frozen: 2026-09-04T01:08:54.834Z
  showdown:     20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4
  26 source digests
```

**The id is UNCHANGED — `8ad06030e129`, not a new one.** The brief expected a new id because "three
leaves were wired into `engine/board_state.js`". `board_state.js` is **not one of the 26 frozen
sources**. It is the COMPARATOR — an instrument, and instruments are not frozen, only the engine is.
Cutting over an identical tree appends a cut event and returns the same id, which is the documented
behaviour and is the right answer here.

That matters more than a naming detail: it means the before-run and the after-run of the leaf
widening were played on **byte-identical engine bytes**, and the comparator is the only thing that
moved between them. This is a clean single-variable comparison rather than a confounded one.

Verified rather than assumed:

```
liveStamp()   engine_release=8ad06030e129  cut=2026-09-04T01:08:54.834Z  source_digests=26
pointer       data/engine-release.json id=8ad06030e129
```

## 1. THE BLOCKER — three of the five regenerations could not run at all

The first attempt at `tests/roster.js --stage items --release 8ad06030e129 --write` **died at exit 2
after four seconds**, printing a message about a file it does not write:

```
REFUSING TO PUBLISH A COVERAGE-ARM RUN INTO data/game-differential.json.
```

`engine/game_differential.js` runs that refusal at **module load**, off `process.argv.slice(2)` —
the whole process's argv. Thirty-odd callers `require` that module for `ARM_BY_ID`,
`CLOSET_SPECIES` and `buildPair`. `tests/roster.js` and `engine/all_mechanics_fire.js` are two of
them, and both are invoked with `--write`. So **any** run of those two with `--write` was killed the
instant it reached the require, before a single game, with a message about `data/game-differential.json`.

MEASURED with a knob-cleared control, not argued:

```
node -e "require('./engine/game_differential.js')" pad --write                        -> exit 2, refusal
node -e "require('./engine/game_differential.js')" pad --write --steering empirical   -> LOADED OK
```

Byte-identical calls but for the one flag, and the outcomes differ. This is a real defect landed by
`a347d6d0` ("the gate now refuses the driver that produced it"), and it is the ugly kind: **exit 2 is
also the SKIP code these tests use**, so under `tests/run-all.js` a permanently dead roster would
have read as politely skipped rather than as broken. Nothing would have said so.

**Fix, one line plus its reason**, in `engine/game_differential.js`:

```js
if (require.main === module && WRITE && !OUT && !EMPIRICAL) {
```

That restores the guard to the question it means to ask — *is the run I am about to perform going to
publish a coverage arm* — and a direct invocation is the only caller that can publish anything there.
Both arms re-checked after the edit: `node engine/game_differential.js --games 2 --write` still
refuses; the requiring caller loads. The refusal is still at second zero.

`game_differential.js` is not one of the 26 frozen sources, so this edit does not move the release id.

## 2. Stage 1 — the damage differential

```
cmd /c tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804
```

110 lines of output, exit 0, published (the guard did not divert — the sample equals the published
ceiling of 6000).

| | before (@HEAD, 2026-08-29T06:49:53Z) | after (2026-09-04T07:02:40Z) |
|---|---|---|
| `engine_release` | **absent** | `8ad06030e129` |
| `source_digests` | **absent** | 26 |
| `showdown_commit` | absent | `20ad99ffc9a5…` |
| midpoint disagreed | 0 of 6000 | **0 of 6000** |
| top corner | 0 / 6000 | **0 / 6000** |
| bottom corner | 0 / 6000 | **0 / 6000** |
| interior idx01–idx14 | 0 each | **0 each** |
| `band_missing` | 0 | 0 |

**The number did not move. What moved is that it can now be checked.** The four frozen sources that
had drifted underneath the old stamp — `medicham2-browser.js`, `engine-data.js`, `tags.json`,
`abra-tags.js` — are now inside the digest set this figure declares.

Conformance sections all clean: accuracy 0 disagree over 500 moves, accuracy-modifier 0 disagree over
13 handlers, Substitute-bypass 51 carried / 0 missing / 0 spurious, 0 rows dropped by exception.

## 3. Stages 2–4 — the deliberate roster

```
cmd /c tools\lownode.cmd tests\roster.js --stage {items,abilities,moves} --release 8ad06030e129 --write
```

| stage | FIRED-AND-BOARDS-DIFFER | DID-NOT-FIRE | MATCH | COULD-NOT-STAGE | DEFERRED | tested / in scope / total |
|---|---|---|---|---|---|---|
| items | **0** | **0** | 140 | 8 | 0 | 140 / 148 / 148 |
| abilities | **0** | **0** | 129 | 141 | 1 | 129 / 202 / 316 |
| moves | **0** | **0** | 475 | 22 | 3 | 475 / 500 / 500 |

Identical to the artifacts they replaced (each run printed the summary of the file it was replacing;
all three matched). Every one now carries `engine_release` + `engine_release_cut` +
`showdown_commit` + 26 `source_digests`; before, they carried an id and **no digests**, which is the
`THE PIN CANNOT BE VERIFIED` refusal exactly.

The gate's two roster clauses are therefore at **zero and zero across all three stages** — CLAUDE.md
still describes them as "currently 2 and 5".

**One deviation from `tests/roster.js`'s own header, stated rather than buried.** That header says
`--reds` is not default and that `--write` without it silently stamps `reds: []`, and that it "is not
optional for a run whose artifact is going to be trusted". Neither the brief's command nor the OWED
block in `docs/_reports/2026-09-04-clause-staleness-pins.md` passes it, and I did not add it: it
roughly triples wall clock and, more importantly, it would have changed **two** things at once. The
last recorded `--reds` run failed 30 of 82 rules' own red demonstrations; landing that inside a run
whose purpose is "the pin, and nothing else" would have made the pin regeneration unattributable.
`reds: []` is carried forward unchanged from the previous artifacts. It is in OWED.

## 4. Stage 5 — the mechanics staging

```
cmd /c tools\lownode.cmd engine\all_mechanics_fire.js --kind all --release 8ad06030e129 --write
```

`--kind all` was passed, as instructed; the artifact carries all three populations and did not become
a moves-only file.

| | before (@HEAD, 01:30:14Z) | after (07:12:33Z) |
|---|---|---|
| pin | `release: 8ad06030e129` hand-rolled, **no digests, no `showdown_commit`** | full `stamp()`: 26 digests + `showdown_commit` (and `release` kept beside it) |
| populations | moves 500 / abilities 316 / items 148 | **identical** |
| games played | 1313, 0 threw | **1313, 0 threw** |
| verdicts | moves RESOLVED 495 · abilities FIRED 104 / DID-NOT-FIRE 20 / SHOWDOWN-ONLY 8 · items FIRED 64 | **identical, row for row** |

Board-state comparison in this run: moves STATE 4 / ANNOUNCEMENT-ONLY 4 / NO-DIVERGENCE 488;
abilities ANNOUNCEMENT-ONLY 2 / NO-DIVERGENCE 168; items NO-DIVERGENCE 73. The four STATE rows are
`axekick`, `clearsmog`, `healbell`, `reflecttype`; two of them part on the board **with no line
difference at all**, which the protocol arm structurally cannot see.

The `showdown_commit` field is the one that mattered here and was missing: the AUTHORITY selects this
file's population (`dex.moves.all()` filtered to the format), so "500 moves" is a fact about a
checkout and had nothing recording which one.

## 5. Stage 6 — THE LEAF-WIDENING MEASUREMENT

```
cmd /c tools\lownode.cmd engine\game_differential.js --release 8ad06030e129 --arm middle --end-state \
  --census data/verification/census-pin-9446a684709d.json --games 1200 \
  --team-store data/team-pool-frozen --steering empirical --write \
  --out data/verification/leaf-widening-batch1.json
```

**`--write` is NOT in the brief's command and had to be added.** The artifact write in
`game_differential.js` sits inside `if (WRITE)`; `--out` only chooses *where*. Run as written, this
stage would have printed 911 lines of complete-looking report and changed nothing — the exact failure
the brief warns about two paragraphs earlier. `data/game-differential.json` was never the target and
its mtime is unchanged (`2026-09-04T02:16Z`, my run wrote at `07:16Z`).

### The scope fields, printed before the headline

Every pin is identical across the two runs:

| | baseline `data/game-differential.json` | this run `data/verification/leaf-widening-batch1.json` |
|---|---|---|
| generated | 2026-09-04T02:01:07Z | 2026-09-04T07:16:57Z |
| `engine_release` / cut | 8ad06030e129 / 01:08:54.834Z | **same** |
| `source_digests` | 26 | 26 |
| steering policy | `empirical-click/v1` | **same** |
| census `input_digest`, pinned | `9446a684709d`, true | **same** |
| `team_pool_digest` / teams / store | `0d103fb9fa87` / 8778 / `data/team-pool-frozen` | **same** |
| mode | `A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real` | **same** |
| `state_mode` / `end_state_mode` / turn cap | true / true / 12 | **same** |
| games **PLAYED** | 961 | **961** |
| threw | 1 | 1 |

Same budget, same played count, same everything but the comparator. The comparator moved at
`06:02:01Z` (`engine/board_state.js` mtime) — **after** the baseline run and **before** this one, so
the widening is genuinely inside this measurement and outside the baseline.

### The result

```
WHOLE-GAME BOARD-MATERIAL  = state.games − state.games_board_never_diverged
   before   961 − 884 = 77
   after    961 − 884 = 77          FLAT

PROTOCOL first-divergence (a.diverged / state.protocol_diverged_games)
   before   168
   after    168                     FLAT
```

**The prediction held: board-material did not fall.** It stayed flat.

Three further quantities, each named so it is not confused with the two above: of the 168 protocol
first-divergences, 102 never parted a board (before and after); 16 games parted their BOARD before
the protocol did (before and after). The 68 board-divergence FAMILIES are identical between the two
runs, in the same order — no new family named for any of the three leaves appeared.

### What this does and does not say

It says: **widening the board comparator from 34 to 37 of the 80 leaves found nothing new in the
pinned pool.** Three leaves whose writers carry 5,577 / 4,701 / 1,416 corpus uses were added, and 961
real ladder games produced zero additional board-material divergence.

It does not say the three leaves are clean, and I will not let that reading stand. This artifact
records DIVERGENCES, not per-leaf agreements, so a flat result is consistent with two different
worlds: the two engines agree on all three, or the three leaves were never non-null in this sample.
`tests/probe_leaf_widening.js` is the instrument that separates them — its RED arm plants the leaf on
medicham2's live state and requires the comparator to catch it. **I did not run it**: it is `M` in
the working tree, i.e. another agent is mid-edit on it, and running someone's in-flight file under a
measurement is the photograph rule broken. It is in OWED.

This is also the shape CLAUDE.md predicts. *"Rank by the pinned pool; the roster and the census carry
the obscure tail."* The pool sitting still after a comparator widening is not zero information — it
is one instrument saying this widening does not change what the metagame exercises.

## 6. Verification of the pins, with the control that makes it evidence

The shipping `engine/pin_guard.js` was run directly against all six artifacts (this is the guard the
gate uses; `quarantine.js` itself was not run, per the brief):

```
PASSES    data/engine-diff.json
PASSES    data/roster.items.json
PASSES    data/roster.abilities.json
PASSES    data/roster.moves.json
PASSES    data/all-mechanics-fire.json
PASSES    data/verification/leaf-widening-batch1.json   (release + digests + population)
PIN_COUNTERS {"checked":6,"no_release":0,"wrong_release":0,"no_digests":0,"population":0,"no_receipt":0}
```

**A guard that returns PASSES for everything has proved nothing**, so the same function was pointed at
the pre-run bytes out of `git show HEAD:`:

```
WITHHELD  engine-diff @HEAD          MEASURED ON BYTES NOBODY RECORDED — carries no `engine_release` field
WITHHELD  roster.items @HEAD         THE PIN CANNOT BE VERIFIED — names 8ad06030e129 and carries no source_digests
WITHHELD  all-mechanics-fire @HEAD   THE PIN CANNOT BE VERIFIED — names 8ad06030e129 in `release (legacy)`
```

Those are the two refusal strings the coordinator quoted, produced on demand and then cleared. The
knob is varied and the outcomes differ.

Every stage was also checked on three things the exit code cannot carry: the output was the size of a
real run (110 / 240 / 432 / 608 / 185 / 911 lines), the `generated` stamp moved to today, and the pin
field is present by direct read.

## 7. Files touched

Written: `data/engine-diff.json`, `data/roster.{items,abilities,moves}.json` (+ their `.prev.json`
and the `data/roster.json` convenience copy), `data/all-mechanics-fire.json`,
`data/verification/leaf-widening-batch1.json`, `data/engine-release.json` (one appended cut event),
`data/published-samples.json` (the publish guard's own ledger).

Edited: `engine/game_differential.js` — the one-line `require.main === module` scoping in §1.

**Not touched**: `data/game-differential.json`, `engine/quarantine.js`, `engine/status.js`,
`tests/probe_leaf_widening.js`, `docs/ENGINE.md`, and anything under `data/smogon-stats/` (the other
agent's ingest). Nothing was deleted. Nothing was committed.

---

# OWED

```bash
# 1. the roster's own reds arm — its header calls this not optional for a trusted artifact, and all
#    three artifacts still carry `reds: []`. Held back deliberately so the pin regeneration stayed a
#    single-variable change. Expect it to be LOUD: the last recorded run failed 30 of 82 rules.
for st in items abilities moves; do
  cmd /c tools\lownode.cmd tests\roster.js --stage $st --reds --write --release 8ad06030e129
done

# 2. the residual on §5 — were the three widened leaves ever non-null in the pool, or merely absent?
#    Run once the agent holding this file has landed it; it is `M` in the working tree right now.
cmd /c tools\lownode.cmd tests\probe_leaf_widening.js

# 3. the gate and the sweep, for the coordinator once the other two agents settle — NOT run here.
node engine/quarantine.js --selftest
node engine/sweep.js
node engine/quarantine.js
node engine/status.js --write
```

Also owed, and named rather than fixed here:

- **`engine/game_differential.js`'s module-load refusal has no test.** The fix in §1 is a fix, not a
  mechanism. A future guard added above `require.main !== module` reintroduces it, and the failure
  mode is exit 2, which every runner reads as SKIP. A red-first arm asserting *"requiring this module
  from a `--write` caller does not terminate the caller"* is the honest close.
- **`engine/sweep.js` §2 still reports `NO POPULATION PIN` against `all-mechanics-fire.json`** and
  will keep doing so after this regeneration — its `POP_RX` vocabulary matches `pool` / `census` /
  `team_pool`, and this artifact's population is pinned under `showdown_commit` + `source_digests`.
  Carried over verbatim from the previous report; widening the regex trades a false positive for
  false negatives elsewhere.
- **`tests/test-engine-release.js` still dies with `Reached heap limit`** in its `compat`/`census`
  section (523+ releases on disk). Pre-existing, unchanged by anything here.
