# 2026-09-10 — the release-tracking clause, the register refresh, and two instruments printing a false sentence

MEASURE. Three items, in the order they were given. No engine byte was touched;
`engine/medicham2-browser.js` and the game logic were not opened.

---

## 1. RULE 5 — a published figure may not cite a release whose bytes are not in the repository

### What was built

`engine/provenance.js` gains RULE 5. It sits with the four rules that file already carries and is
documented in the same place, at `releaseBytesState()`.

Three derivations, none of them a typed list:

| question | derived from |
|---|---|
| which documents publish a figure | `docs_scan.livingDocs()` (a version header in the masthead) + `.claude/agents/*.md` for the division ledgers |
| which artifacts those documents cite | `docs_scan.citationsIn()` |
| which release an artifact cites | the fields `engine_release`, `release`, `release_id`, `roster_release`, `source_release`, matched **exactly** |

The field names are matched exactly rather than by `/release/i` on the key, because `source_digests`
is keyed by PATH and `engine/engine_release.js` is a path containing the word — a loose match
credited `data/conformance-baseline.json` with citing five "releases" that are source digests.

**It asks the MANIFEST, not the directory.** `data/releases/<id>/release.json` must be tracked and
every path in its `files` map must be tracked. A directory-level check would pass a release that is
half in the repository and cannot be opened from a clone. Measured: three release directories carry a
partial tracked footprint (`5fc1f711a0e3` 1 file, `55c7a0f19c86` 2, both correctly PRUNED;
`d3d04b669e18` 13 of 13 — an early 12-source manifest, complete).

**The verdict is graded.**

- **UNSAFE (hard arm)** — an artifact a LIVING DOCUMENT cites. CLAUDE.md names the declared public
  API of this project as "the numbers in the white paper, the deck, `docs/SUMMARY.md` and
  `docs/MODELS.md`", so this is a published figure by the project's own definition and
  `engine/status.js` withholds it.
- **stale? (soft arm)** — an artifact a DIVISION LEDGER cites. Will ruled on 2026-09-06 that a ledger
  is "a working document … handed to nobody"; it gets no PDF and is not the public API. It is still
  NAMED, with the release id, because silence is how the class survived three fixes.
- **warning, never failure** — a release whose bodies were deliberately PRUNED. `prune()` keeps
  `release.json`, whose digests still prove what the snapshot contained. That is a recorded decision.
- **fails open, loudly** — if `git` cannot answer, the rule cannot run; that goes into `READ_FAILURES`
  and is printed. It does not become "everything is tracked". `logUnreadable()` was deliberately NOT
  used, because it is silent on ENOENT and ENOENT here means *git is not installed*.

The hard arm sets `process.exitCode = 1` on a plain report run, as the void ratchet does, not only
under `--strict`.

### Shown RED first, in both shapes

Against a **copy** of `.git/index` in the scratchpad, via `GIT_INDEX_FILE`. The real index and the
working tree were untouched in both runs (`git status --porcelain` unchanged, the release directories
still on disk).

```bash
cp .git/index "$S/break-index"
GIT_INDEX_FILE="$S/break-index" git rm --cached -r --quiet data/releases/3c2b2f9ac845
GIT_INDEX_FILE="$S/break-index" node --max-old-space-size=4096 engine/provenance.js
```

→ exit 1, and the hard arm named **exactly the six artifacts of instance 3**:

```
  10 on the LIVING-DOCUMENT arm — UNSAFE, so status.js withholds the figure:
    data/all-mechanics-fire.json  ->  3c2b2f9ac845  (absent)  cited by docs/ABRA-technical-docs.md, ...
    data/engine-diff.json         ->  3c2b2f9ac845  (absent)  ...
    data/game-differential.json   ->  3c2b2f9ac845  (absent)  ...
    data/roster.abilities.json    ->  3c2b2f9ac845  (absent)  ...
    data/roster.items.json        ->  3c2b2f9ac845  (absent)  ...
    data/roster.moves.json        ->  3c2b2f9ac845  (absent)  ...
```

Second break, one manifest file removed rather than the whole release:

```
  roster.moves.json  UNSAFE  PUBLISHED FIGURE ON AN UNTRACKED RELEASE — data/releases/3c2b2f9ac845/ is
  only PARTLY in the repository — 1 of 27 manifest file(s) untracked, so it cannot be opened from a clone.
```

### Measured on the clean tree

**4 on the hard arm, 21 on the soft arm.** 32 of 646 release directories are tracked.

| artifact | release | cited by |
|---|---|---|
| `data/million-run.json` | `84f466e7e0d2` | deck, technical docs, white paper, MODELS.md |
| `data/million-run-150k.json` | `84f466e7e0d2` | deck, technical docs, white paper, MODELS.md |
| `data/mutation-coverage.json` | `6fb9ebd3b704` | MODELS.md |
| `data/search-decision-profile.json` | `cf8567c4db78` | MODELS.md |

Soft arm (21): `argmax-paired{,-n12,-n100}.json` `957c638ba6e5`; `divergence-turns.json` `791c9fd873f3`;
`game-differential-endstate{,-turn19,-turn40}.json` `6155acc0fb26`; `game-differential-endstate-v2.json`
`a81663f17c0c`; `game-differential-PRE.json` `1a9d81ca552c`; `nature-arms.json` `72e361e1bd44`;
`replay-differential{,-freezes}.json` `a63f0f139f37`; `roster.all.json` `5a7bd8a8178a`;
`roster.all.prev.json` `39ac0253d3ca`; `whole-game-baseline.json` `6272fa445b73`; `_bench-scaling.json`
`5f3f7141227c`; `_pair-pilot.json` `5e0853311131`; `_r220-gd-{pre,post}.json` and
`_r220-void-pair-{PRE,POST}.json` `978ca8fe72c9`.

**Two provenance verdicts moved**, and only two:

```
replay-differential-freezes.json   ok -> stale?
search-decision-profile.json       ok -> UNSAFE
```

Totals 173 → 174 UNSAFE, 38 → 36 ok, 43 → 44 stale?, 2 VOID. Three of the four hard-arm artifacts were
already UNSAFE for other reasons, so the enforcement cost one newly withheld figure, not four.

### Why the rule is not "track every release"

A release directory is **6.8 MB**; `.git` is **724 MB packed**; GitHub hard-rejects a single file over
100 MB. Clearing all 26 offenders by force-adding would cost ~177 MB and buy protection for figures
nobody publishes. The three other ways to clear a row are cheaper and better: re-run the artifact on a
tracked release, stop citing it in a published document, or force-add that one release if the figure
must stay quotable. The printed footer says exactly that.

### What it would and would not have caught

Caught by name: instance 2 (`cbd510bc2b13`, `game-differential.json` + the MODELS.md 6.0.0 headline)
and instance 3 (`3c2b2f9ac845`, six artifacts) on the hard arm; instance 1 (`b730e44f3314`,
`data/roster.spine.json`, named only by `docs/ENGINE.md`) on the soft arm.

**Not** caught, and written into the clause header rather than discovered later:

1. **A release id typed into PROSE with no artifact under it.** 40 distinct untracked ids appear in
   living-document text today, nearly all inside dated per-version history rows the documents keep and
   do not rewrite. A bare 12-hex token is also indistinguishable from a commit hash, and CLAUDE.md
   records 271 commit hashes resolving in tracked markdown. Accusing on the token alone would fire on
   the wrong thing.
2. **An artifact that records a release it did not read.** Same limit the whole file has.
3. **Anything at all if `git` is missing** — reported, never assumed away.

ROADMAP #577.

---

## 2. `data/register-reality.json` — refreshed, and the gate's evidence changed underneath it

`node engine/register_reality.js` (the MEASURING invocation, which writes; **not** `--list`, whose
recorded hazard is that it once wrote the artifact and turned the gate green by erasing five
`green:false` rows). Run through `tools/lownode.cmd`, ~16 minutes, 81 distinct commands.

Stamp **2026-09-08T16:34:05Z → 2026-09-10T18:43:07Z**. Results **123 → 136**.

| count | before | after |
|---|---|---|
| CONFIRMED | 109 | 109 |
| STALE ROW | 10 | 9 |
| PREMATURE CLOSE | 3 | 1 |
| EXIT CODE UNDECLARED | 1 | 6 |
| INSTRUMENT CANNOT ANSWER | 0 | 2 |
| MARKER REJECTED | 0 | 9 |
| distinct commands run | 73 | 81 |
| register rows | 466 | 493 |

**8 rows changed verdict; 13 are new.**

```
#218  STALE ROW/green        -> EXIT CODE UNDECLARED/null   node engine/quarantine.js --whole-game     exit 2
#224  CONFIRMED/green        -> EXIT CODE UNDECLARED/null   node engine/gate_offfield_target.js        exit 2
#241  PREMATURE CLOSE/red    -> INSTRUMENT CANNOT ANSWER    node engine/gate_fail_and_silent.js        exit 2 (declared)
#290  PREMATURE CLOSE/red    -> EXIT CODE UNDECLARED/null   node engine/quarantine.js --order-probe    exit 2
#376  CONFIRMED/red          -> EXIT CODE UNDECLARED/null   node engine/quarantine.js --order-probe    exit 2; row also CLOSED since
#389  STALE ROW/green        -> CONFIRMED/red               node tests/test-red-run-writes.js          exit 1
#471  PREMATURE CLOSE/red    -> EXIT CODE UNDECLARED/null   node tests/test-quality.js                 exit 134
#479  CONFIRMED/green        -> PREMATURE CLOSE/red         node tests/test-claim-truth.js             exit 1
```

### Does the open-defect clause's answer change? No. Its evidence does.

`openDefectClause()` reads `ok: false` before and after — but on a different row.

- **Before:** #376 was the open row asserting breakage whose instrument was red.
- **Now:** #376 is CLOSED and its instrument no longer returns a verdict at all. **#389 is the single
  open red row.**

```
1 OPEN roadmap row(s) name an instrument that is RED: #389.
8 open row(s) declare NOT A DEFECT in their status cell and are excused …
1 open row(s) name an instrument that WAS ASKED AND ANSWERED NOTHING USABLE: #218 [EXIT CODE UNDECLARED]
44 open row(s) assert breakage with NO instrument that decides them — DEBT, not evidence
```

So the clause certifying MEDICHAM has no known defects was running on two-day-old evidence, and the
row it was resting on is not the row it rests on now. Nothing was adjusted to keep the gate open.

### Two rows that were GREEN are now RED

**#389 — `node tests/test-red-run-writes.js`, exit 1, reproduced by hand.** *14 passed, 1 failed.*

```
FAIL no NEW check publishes on red — the accepted set is 7 file(s)
     tests/probe_item_disposition.js  writes at line 216, fails at line 225
         process.exit(removalParted ? 1 : 0);
```

A new probe joined the class that row exists to close: it writes its artifact and then exits non-zero,
so a red run republishes and launders the regression. One file LEFT the accepted floor in the same
period (`tests/test-mechanics.js`), which is the direction the ratchet allows. ENGINE owns the probe;
MEASURE filed the receipt on #389 and did not touch it.

**#479 — `node tests/test-claim-truth.js`, exit 1, reproduced by hand.** A CLOSED row with a red
instrument. *357 claims extracted, 323 checkable, **1 FALSE**:*

```
WRITES  tests/test-stadium-roster.js:NOT_A_MODEL[engine/smogon_coverage.js]
    claims: engine/smogon_coverage.js -> data/smogon-coverage-2026-08.json
    truth : it is not so
```

Its second census (reported, not gated) also names three absent files in comments:
`tests/rate_runner.js` (from `engine/game_differential.js`), `tests/test-engine-contract.js` (from
`engine/medicham2-browser.js`), `tests/a.js` (from `engine/register_reality.js`). **#479 is RE-OPENED**
with the receipt; the sentence is to be corrected, not deleted.

### Five instruments stopped returning a verdict (ROADMAP #578)

`#218`, `#290`, `#376` (`engine/quarantine.js --whole-game` / `--order-probe`) and `#224`
(`engine/gate_offfield_target.js`) exit **2** with no `ABRA-EXIT` declaration. `#471`
(`tests/test-quality.js`) exits **134** — a heap death, not a verdict; it needs an `ABRA-HEAP` line
the way `engine/provenance.js` has one. `register_reality.js` refuses to read any of them as green or
red, which is correct: those five rows are now **unmeasured**, neither confirmed nor cleared.
`#424` (`engine/wire_ladder.js`, exit 4) was already in this state before the refresh.

### Nine markers are rejected (ROADMAP #579)

`markers_rejected` 0 → 9: #553, #555, #558, #563, #566, #569, #570, #574, #576. Eight name a PATH
instead of a command (`engine/status.js`, `data/engine-diff.json`, `tests/probe_corner_arm_measures.js`
…) and one carries unexpanded template text (`--dump-out <absolute path>`). `classifyMarker()` is right
to refuse them — the alternative is guessing, which is #148 — but nine rows added since 2026-09-08 are
audited by nothing. None of the nine asserts breakage, so the gate is not held shut by them.

### One caveat on this run's own hygiene

`tree_state.moved_during_the_run` is `true` and `settled` is `false`: the run rewrote
`data/engine-release.json`, `data/forme-assert.json`, `data/mechanics-census.json` and
`data/provenance-stamp.json` as its instruments executed, and my three source edits were in the tree
at start. That is inherent to an instrument-running audit and is the same state the 2026-09-08 run
recorded. It is stamped in the artifact rather than hidden.

---

## 3. ROADMAP #575 — the false volley sentence, in two files and a third clause

`engine/status.js` and `engine/coverage.js` printed, unconditionally:

> *the skip is a FAMILY, not a rounding error: 14 of 500 legal moves carry the multiHit tag and are
> skipped by construction, so the volley loop has never been damage-compared. 0 were drawn and
> skipped; 14 were never drawn at all (bonerush, bulletseed, doublehit, …)*

Every clause of that was false by the time it was read. `data/engine-diff.json` (2026-09-10T17:54Z,
release `3c2b2f9ac845`, seed 20260804, n=6000) says `skipped_multihit` **0**,
`skipped_ability_multihit` **0**, `volley.move_rows` **130**, `volley.bond_rows` **12**.

**The mechanism of the bug was reading one door.** `drawn` was `Object.keys(skipped_multihit_moves)` —
the map of rows the differential REFUSED. A multi-hit move now appears in the OTHER door,
`volley.moves`, when it is actually run. With the skip map empty, every move in the family read as
"never drawn at all", which is exactly the shape the false sentence needed to look plausible.

Both blocks now branch on the counters and read both doors. `status.js` prints:

```
the volley loop IS damage-compared in this draw: 142 of 6000 rows ran as volleys (130 multi-hit move,
12 Parental Bond) and 0 rows were skipped for multi-hit, with 0 hit-count mismatch(es). 11 of the 14
moves carrying the multiHit tag were drawn; 3 were never drawn at all (bonerush, doublehit, tailslap)
— never drawn is a SAMPLING gap, not an exclusion.
```

Cross-checked against the artifact's own independent derivation: `volley.multihit_moves_not_drawn` is
the same three ids. Membership still comes through the same door `tests/test-engine-diff.js` uses to
build its skip set (the `multiHit` tag in `data/tags.json`), so the two cannot part.

`engine/coverage.js` counts a move as EXCLUDED only when THIS RUN skipped it, so
**`moves the damage diff can compare` reads 500 of 500, not 486**, with the note
*"14 moves carry the multiHit tag and NONE was skipped by this run … 3 never drawn at all — a sampling
gap, not an exclusion"*.

**A THIRD hardcoded clause was found in the same file in the same pass** and was not in the brief: the
`ranged mechanics fully staged` row appended *"and the damage differential skips these moves outright,
so nothing in the project compares them there either"* unconditionally. It is read now, and reports
the arrival spread the artifact records:

```
those counts are reached by no arm, though the damage differential no longer skips these moves
(skipped_multihit 0) and its own rows arrived at x1/x2/x3/x4/x5/x6 hits, so the interior IS reached
there — by draw, not by an arm
```

The file's WHY header, which quotes `skipped_multihit: 134` as a motivating example, is dated evidence
and was NOT rewritten; a marker was added above it saying the rows are history and pointing the reader
at the derivation.

`node engine/status.js --write` was re-run and the `<!-- GENERATED -->` block in `docs/ENGINE.md` no
longer asserts it. ROADMAP #575 CLOSED with the receipt.

---

## Register rows written this pass

| row | what |
|---|---|
| #575 | CLOSED — the volley sentence is conditional in both files, plus the third clause |
| #479 | RE-OPENED — premature close, 1 FALSE claim in `tests/test-stadium-roster.js` |
| #389 | receipt appended — `tests/probe_item_disposition.js` publishes on red; the only open red row |
| #577 | NEW — RULE 5 landed; 4 hard-arm figures owed |
| #578 | NEW — five instruments exit outside {0,1}; `tests/test-quality.js` needs `ABRA-HEAP` |
| #579 | NEW — nine register markers name a path, not a command |

`node engine/open_work.js` printed **0 MEASURED BUT UNREGISTERED** before and after.

---

## OWED, NOT RUN

```bash
# 1. The four hard-arm figures. Each needs ONE of: a re-run on a tracked release, removal from the
#    living documents, or a force-add. Do not force-add all four without pricing it: ~6.8 MB each.
node engine/provenance.js | sed -n '/PUBLISHED FIGURES CITING/,/Tracking/p'
git add -f data/releases/84f466e7e0d2 data/releases/6fb9ebd3b704 data/releases/cf8567c4db78

# 2. #479 — correct the sentence, do not delete it, then re-run the instrument.
#    tests/test-stadium-roster.js declares engine/smogon_coverage.js -> data/smogon-coverage-2026-08.json
node tests/test-claim-truth.js

# 3. #389 — ENGINE owns tests/probe_item_disposition.js. Move the write behind the verdict, or declare
#    WRITE-POLICY: findings — <why> in the source AND stamp run_ok into the artifact.
node tests/test-red-run-writes.js

# 4. #578 — declare the exit codes, and give tests/test-quality.js a heap.
node engine/quarantine.js --whole-game ; echo $?
node engine/quarantine.js --order-probe ; echo $?
node engine/gate_offfield_target.js ; echo $?
node --max-old-space-size=4096 tests/test-quality.js ; echo $?

# 5. #579 — rewrite the nine markers as runnable commands, then confirm markers_rejected is 0.
node engine/register_reality.js --list      # ENUMERATION ONLY. Writes nothing. Do not use to measure.
node engine/register_reality.js             # the measuring invocation; ~16 min, writes the artifact

# 6. The standing MEASURE item, still not started this pass: leaf calibration.
#    data/winrate-backtest.json is UNSAFE and was scored at 350 games / 40 rollouts.
node engine/backtest_winrate.js

# 7. Re-run the whole suite before publishing this pass.
node tests/run-all.js
```
