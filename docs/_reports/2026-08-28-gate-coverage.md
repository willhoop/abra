# The gate now prints its own coverage — 2026-08-28, MEASURE

**Historical record, not current state.** Every count below was read at a stamped instant while an
ENGINE re-run batch was rewriting the artifacts. Re-derive before acting on any of it:
`node engine/status.js`, `node engine/coverage.js`, `node engine/coverage.js --audit`.

---

## THE VERDICT

**42 distinct scope fields** sit under the six gate clauses that read an artifact, and **none of them
was in a headline**. Four had been described to me; the mechanism found the rest without being told
any of them. Two of the four I was given did not survive being checked, and the corrections are the
most useful thing in this report.

The gate now prints, under every clause: the AGE of the artifact the verdict was drawn from, and what
that artifact's own denominator excludes. Above the sections, a `COVERAGE` block states the finish
line as **9 derived counts**, so *"is MEDICHAM done"* is one command.

---

## WHAT WAS BUILT

| file | what changed |
|---|---|
| `engine/coverage.js` | **new.** The whole derivation. Not a gate — a reporter. |
| `engine/status.js` | prints the scope under each clause, prints the `COVERAGE` block, and stops computing tag coverage itself |
| `tests/probe_uncompared_leaves.js` | refactored to export `derive()`; the CLI is now a renderer over it. Output proved **byte-identical**, both `--json` and text. |
| `docs/MEASURE.md` | the division's account, outside the `GENERATED` block |

`engine/quarantine.js` and `tests/roster.js` were **left alone** — they are held uncommitted by
another agent. Everything landed in `status.js`, which was clean at HEAD. Nothing in this pass needed
to touch either held file: `status.js` is what renders the clause list, so the scope lines attach
there. `git status` confirms the only files I changed are `engine/status.js`,
`tests/probe_uncompared_leaves.js`, `docs/MEASURE.md` and the new `engine/coverage.js`.

---

## THE FOUR CLAIMS I WAS GIVEN, CHECKED

| claim | verdict |
|---|---|
| damage differential `0 of 6000` has never run a multi-hit volley; `skipped_multihit: 134` is the record | **TRUE in substance, OVERSTATED as a reporting gap.** The raw skip count was ALREADY on `status.js`'s differential line (`134 not comparable (multihit 134, …)`). It was not hidden. What was genuinely absent: the skip is a whole **FAMILY** — 14 of 500 legal moves carry the `multiHit` tag and are excluded by construction, so the volley loop has never been damage-compared once. 11 were drawn and skipped; **3 were never drawn at all** (`bonerush`, `doublehit`, `tailslap`), so they appear in no artifact field anywhere. |
| "the boards match" is 33 of 80 leaves, 43 read by nothing | **TRUE.** Confirmed against `tests/probe_uncompared_leaves.js`. It was in a probe nothing runs. |
| census `780 probed / 780 live / 0 missing` while 67 mechanics have never fired | **TRUE.** The 67 is `summary.abilities.did_not_fire + summary.items.did_not_fire` in `all-mechanics-fire.json`, printed only in the mechanics clause tail — never beside the census headline. Now beside it. |
| roster multi-hit rows are `FIRED-AND-BOARDS-MATCH` **only ever at 2 hits** | **REFUTED**, and `tests/roster.js` already said so. See below. |

### The multi-hit claim, refuted by the instrument's own header

`tests/roster.js`, family `move/multihit`, `why` (dated 2026-08-27):

> *"This sentence read `random(m,n)` is pinned to `m` in EVERY arm, so a 2-5 range lands on TWO hits …
> It is FALSE for the `[2,5]` family, because that family does not go through the range form at all:
> `data/mods/champions/scripts.ts:441` draws it with `this.battle.sample([2 x7, 3 x7, 4 x3, 5 x3])`,
> `PRNG#sample` is `this.random(items.length)` — the ONE-argument form — and the arms answer that with
> `top ? m-1 : 0`. … MEASURED, both engines, one staged turn per corner
> (`tests/probe_multihit_corners.js`): Icicle Spear reads authority 5 / medicham2 5 at the TOP corner
> and 2 / 2 at the BOTTOM. The old note was TYPED from `e.multihit[0]` and was never a reading of
> anything."*

So the two arms reach the two **ENDS** of the range. **The unreached set is the INTERIOR: hit counts
3 and 4**, on the 8 moves declaring `[2,5]`. Fixed-count moves are fully covered.

**AND THE ARTIFACT STILL PUBLISHES THE REFUTED SENTENCE.** `tests/roster.js:7665` still builds the
row `note` from `const n = Array.isArray(e.multihit) ? e.multihit[0] : e.multihit`, so every
`[2,5]` row in `data/roster.moves.json` reads *"THE PIN LANDS ON 2 HIT(S), which is the bottom corner
of the range and the only count either engine can be asked about here"*. The `why` was corrected and
the `note` was not. **That is how the wrong claim reached me**, and it is a live reporting defect —
OWED to whoever holds `tests/roster.js`; I did not touch it. It is also the reason `coverage.js`
derives the range gap from `data/tags.json` `params.<tag>.range` and **parses no prose**: a `note` is
exactly where a scope goes to die.

---

## THE SCOPE INVENTORY

Counted at **2026-08-29T00:24:38Z**, mid-batch. Values move; the field NAMES and the mechanism do not.

| clause | artifact | scope fields now printed |
|---|---|---|
| game differential | `engine-diff.json` | 3 |
| deliberate roster / items | `roster.items.json` | 2 |
| deliberate roster / abilities | `roster.abilities.json` | 6 |
| deliberate roster / moves | `roster.moves.json` | 4 |
| whole-game differential | `game-differential.json` | 4 |
| mechanics / staged and compared | `all-mechanics-fire.json` | 23 |
| coverage / every used mechanic | *(no artifact — the clause states its own shelf)* | — |
| no open, known engine defect | *(no artifact)* | — |
| | | **42** |

### The ones nobody had named, worth reading twice

- **`turns_cap: 12` on the whole-game differential.** The clause is called *"the same game on both
  engines"* and it compares the first twelve turns. `coverage.median_completed_turns_before_divergence`
  equals the cap, i.e. **the median game ENDS AT THE CAP**, so turn 13 onward is compared by nothing.
  This is the single widest unstated narrowing in the gate and it was in no headline.
- **Board rows vs entities.** `summary.boards.<kind>.rows` covers a fraction of
  `summary.<kind>.exist`. A mechanic with no board row is one whose EFFECT nothing compared, however
  clean its protocol line read.
- **`roster.abilities.json` `scope.unattributable`.** Rows that FIRED but whose control was not quiet —
  not a match and not a mismatch, and it sat inside the `scope` object while the headline counted
  `FIRED-AND-BOARDS-MATCH`.
- **`summary.abilities.did_not_fire_unexplained`.** A subset of the 67 with no reason recorded.
- **`summary.preflight.trigger_unstaged` / `refused`.** Triggers the harness planned and never staged.
- **`closet.teams_dropped`.** Teams removed from the pool before a game was played.
- **Artifact AGE.** No clause printed it. See the next section.

### The finish line, as counts

Nine rows, all derived, printed by `node engine/coverage.js`:

```
board leaves compared              tags with an engine consumer      turn boundaries compared
staged mechanics that fired        tags with a census probe          entities exercised in a real game
mechanics with a board compared    moves the damage diff can compare ranged mechanics fully staged
```

Read the values from the tool. They are deliberately not transcribed here — a figure typed into prose
is the fourteen stale handoffs in a new costume, and this file is dated evidence, not current state.

---

## THE AGE LINE, ADDED MID-TASK

A stage run **without `--write`** prints a complete report and exits 0 while its artifact never moves.
`data/roster.items.json` went on publishing a `DEFERRED-BY-OWNER` row that had been fixed hours
earlier because of exactly that. The verdict was published; the staleness was not.

Every clause now prints `READ FROM <artifact>, <age>`. The age is the artifact's **own `generated`
stamp**, never its mtime — *"newer than its source"* is no evidence at all, and `engine-data.js` was
newer than the merge script that had lost its output. The mtime is read for one purpose: to say out
loud when a file changed **in the last minute**, because a torn read is a plausible, well-formed,
completely fictitious answer rather than an error. `humanAge(null)` returns
*"NO `generated` STAMP — age unknown, which is not the same as fresh."*

---

## WOULD IT CATCH A FIFTH INSTANCE?

**Partly, and the header says exactly where the line is.** Three mechanisms, in decreasing generality.

1. **NAME VOCABULARY** — walks any artifact and reports every non-zero numeric or non-empty list whose
   key matches ~50 exclusion words in head or tail position. **It is given no list of artifacts and no
   list of fields.** A new instrument writing `skipped_volleys` is reported on the run it first writes
   one, with no edit.
2. **ARITHMETIC RESIDUAL** — structural, not lexical. Any object carrying both a population-shaped key
   (`in_scope`, `total`, `exist`, `probed`, `requested`, `measurable`) and an accounted-shaped key
   (`tested`, `fired`, `resolved`, `compared`, `matched`, `live`, `exercised`) reports the difference.
   **This catches an exclusion with no name at all** — the rows simply are not in the tested count.
3. **DECLARED RANGES** — any tag param carrying `range: [lo,hi]` with `hi > lo`. Today the class has
   exactly one member (`multiHit`); a second ranged param is reported without an edit.

**WHERE IT FAILS, STATED IN THE CODE'S OWN HEADER AND DEMONSTRATED:** an exclusion named outside the
vocabulary — `volleysNotRun`, `remainder`, `theOtherOnes` — is **MISSED**. There is no mechanical
defence against a word nobody used, and pretending otherwise would make this the next incomplete
verdict. The partial answer is `node engine/coverage.js --audit`, which prints the **unmatched**
numeric field names for every gate artifact, so a reader auditing a new instrument sees the names that
exist rather than only the ones a regex recognised.

---

## SHOWN RED ON A DELIBERATE BREAK

Run from the scratchpad; nothing was written into the repository. All eight groups behaved as their
headers claim, **including the negative control that proves the limitation above is real rather than
rhetorical**:

| case | result |
|---|---|
| `skipped_volleys` — a field that exists nowhere in this repo — is reported | GREEN |
| `whatever_unchecked` (invented word, tail form) is reported | GREEN |
| a **zero** exclusion is NOT reported (a zero is coverage, not a gap) | GREEN |
| **NEGATIVE CONTROL:** `volleysNotRun` / `remainder` / `theOtherOnes` are **missed**, exactly as the header says | GREEN |
| …but their names still appear in `unclassified` | GREEN |
| `exist 100 / fired 40` reports a 60 gap with nothing named | GREEN |
| no false gap when the population is fully accounted, or when only one side is present | GREEN |
| **break the leaf producer → the row reads `NOT DERIVED`, never a comfortable 0** | GREEN |
| restored, the imported number equals the probe CLI's own number (one producer, not two) | GREEN |
| a clause whose artifact cannot be identified prints **nothing**, not a guess | GREEN |
| mtime one second ago → `beingWritten`; two hours ago → not | GREEN |
| an artifact with no `generated` stamp says so rather than reading as fresh | GREEN |
| the gate artifact set is derived from `quarantine.js` / `status.js` source, not typed | GREEN |

`engine/status.js --selftest`: 6 + 7 passed, 0 failed. `node engine/status.js` exits 0.

---

## ONE PRODUCER PER FACT

- The leaf split is **imported** from `tests/probe_uncompared_leaves.js`. Its CLI is now a renderer
  over `derive()` and holds no arithmetic; text and `--json` output were diffed before/after and are
  identical. Break the producer and the coverage row reads `NOT DERIVED`.
- Tag coverage **moved out of `status.js`** into `coverage.js`. Both were computing it; they agreed
  today, and two implementations of one fact is the breach that had the closed-row detector
  disagreeing with itself on 24 of 292 rows in both directions.
- The multi-hit skip set is derived from `data/tags.json` `moves[].tags` containing `multiHit` —
  **the same expression `tests/test-engine-diff.js` builds its skip set from** — never from the dex's
  `multihit` field and never from a list of names.
- The clause→artifact map is **derived**, not typed: a clause either names its `file` or carries the
  `generated` stamp it read, and a stamp matching zero or two artifacts yields no scope line rather
  than a guess.

---

## RED TESTS I AM LEAVING, AND WHY THEY ARE NOT MINE

`node tests/test-docs-current.js` — **21 passed, 2 failed**, both pre-existing and both owned by the
ENGINE release pass that is in flight:

- *every version-headed document is at 5.208.0* — `CHANGELOG.md` was bumped to 5.208.0 this hour by
  the WIRE 158 pass; the six living documents have not been restamped yet.
- *figures a cited artifact does not contain: baseline 65, now 69* — the census moved 780 → 782 under
  the documents that cite it.

**Measured, not assumed:** both failures read identically before and after my edits, and the
untraceable-figures check stayed green (`35 across 6 documents`, unchanged), so my `docs/MEASURE.md`
section added no new figure without an artifact behind it.

---

## OWED, NOT RUN

**`CHANGELOG.md` was deliberately not edited.** It is held and being actively rewritten by the ENGINE
agent assembling 5.208.0, and a concurrent edit to a file another agent is writing is the collision
this repository has a rule about. The entry to add under the existing `## [5.208.0] — 2026-08-28`:

```
### Added
- **THE GATE PRINTS ITS OWN COVERAGE. `engine/coverage.js`, read by `engine/status.js`.** Every gate
  clause now prints, under its verdict, the AGE of the artifact it was drawn from and what that
  artifact's own denominator EXCLUDES — 42 scope fields across six gate artifacts, none of which was
  in a headline. A `COVERAGE` block states the finish line as nine derived counts. Three mechanisms,
  in decreasing generality: a name vocabulary over any artifact's fields, an arithmetic residual that
  catches an exclusion with no name at all, and declared tag ranges. Shown red on a deliberate break
  including the negative control that an exclusion named outside the vocabulary is MISSED.
- `tests/probe_uncompared_leaves.js` exports `derive()`; its CLI is a renderer over it, proved
  byte-identical. `status.js` no longer computes tag coverage itself.

### Fixed
- **`data/roster.moves.json` publishes a per-row `note` its own family header refutes.** NOT FIXED —
  filed. `tests/roster.js:7665` still types the note from `e.multihit[0]`; the `move/multihit` `why`
  block has recorded since 2026-08-27 that the arms reach the two ENDS of the range and that the note
  "was never a reading of anything". Owner: whoever holds `tests/roster.js`.
```

**`node engine/status.js --write` was deliberately not run.** It stamps four division ledgers from
artifacts that an ENGINE agent is rewriting right now; stamping a mid-batch read into six documents is
precisely the torn-read failure. Run it once the batch settles:

```
node engine/status.js                 # confirm the artifacts have stopped moving
node engine/coverage.js
node engine/coverage.js --audit
node engine/status.js --write
node tests/test-docs-current.js       # expect the two ENGINE-owned failures to clear with the restamp
```

Not done, and not mine to do:

```
# the refuted note, in a file held by another agent
#   tests/roster.js:7665 — derive the staged hit count instead of typing e.multihit[0]

# the scope line under a clause that reads no artifact (2 of 8 clauses)
#   `coverage / every used mechanic` and `no open, known engine defect` state their own shelf in
#   `why`; neither carries a `file` or a `generated` stamp, so clauseArtifact returns null and no
#   scope line prints. That is the correct behaviour today — it is NOT DERIVED, not a clean bill.

# quarantine.js printing the same scope lines when it is run directly
#   status.js prints them; `node engine/quarantine.js` does not. The module is exported and ready
#   (`COVERAGE.clauseLines(clause, cache, indent)`); the file is held.
```
