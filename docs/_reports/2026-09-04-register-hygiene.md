# Coverage after the marker rebuild: 123 admitted, 46 owed, 0 refused — and 163 open rows that say nothing at all — 2026-09-04 (MEASURE)

Scope: `docs/ROADMAP.md` (2 rows) and this file. Nothing that plays a game was run. `engine/register_reality.js`
was NOT run in measuring mode; `--list` was run once and the artifact was checked byte-and-mtime identical
either side of it. `data/register-reality.json` was not written and not hand-edited. One artifact did move —
`node engine/open_work.js` rewrites `data/open-work.json` on every run; see §4. Nothing was committed.

---

## 1. TASK 1 — #320 and #322 carried a caveat that was true when written and false since 2026-08-28

Both rows carried this paragraph, identically, and neither had been corrected:

> **MARKER NOT MACHINE-RUNNABLE — NOTED 2026-08-23 BY MEASURE, ROW OTHERWISE UNTOUCHED.** This row's
> `VERIFIED BY` carries an environment prefix and a literal placeholder, so `engine/register_reality.js`
> refuses it rather than shell-executing it, and the row files as INSTRUMENT UNRUNNABLE — which is not
> agreement and is not evidence either. The command is a correct instruction to a human; it is not an
> instrument. See #381.

A dated addendum is appended to each row. The paragraph is **left standing** — it is dated evidence and
the house rule is that dated evidence is not rewritten in place. The addendum quotes it verbatim (the
quote is **lifted out of the row's own bytes by the edit script**, never retyped, so it cannot drift) and
states what moved.

### The brief's premise needs one correction, and it matters for what the addendum says

The brief said these two "were only ever refused by the old `SAFE` predicate, which has been replaced"
tonight. **Measured, that is not when it happened.** Both halves moved on **2026-08-28**, six minutes
apart, under ROADMAP #521 — seven days ago, not tonight:

| commit | time | what it did |
|---|---|---|
| `a099d6c1` | 2026-08-28 05:26 | gave `SAFE` its `-r <repo script>` preload clause |
| `f4979984` | 2026-08-28 05:32 | rewrote both markers from `SHOWDOWN_PATH=... node tests/<x>.js` to `node -r ./tests/_live_release.js tests/<x>.js` |

Derived, not recalled: the `SAFE` literal was walked back through every commit that touched
`engine/register_reality.js`, and the `-r` clause first appears at `a099d6c1` (`da53059b`, 2026-08-23, has
`/^node\s+((?:engine|tests|build)[\\/]…/` with no preload alternative). The marker text was walked the same
way through `docs/ROADMAP.md`; at `da53059b` both rows still read `SHOWDOWN_PATH=...`, so **the caveat was
accurate on the day it was noted.**

**So tonight changed nothing about these two rows, and the addendum says that rather than claiming credit.**
Proof, run without starting either instrument: the `SAFE` literal lifted from `429e8d84` — last night's
shipping bytes, before tonight's rewrite — returns **ADMITTED** on both markers; tonight's `classifyMarker()`
also returns **ADMITTED**, argv `-r tests/_live_release.js tests/<x>.js`, and both files exist on disk.

Two clauses of the old paragraph are false of these rows *as they stand* and the addendum names both:
the marker carries **no environment prefix** and **no placeholder** (`PLACEHOLDER` is `/<[^>]*>|\.\.\./`
and neither matches), and the row has **not filed as INSTRUMENT UNRUNNABLE since 2026-08-28 05:32**.

What the addendum deliberately does NOT claim: nothing was run against either row in this pass, so it says
the marker is READABLE, never that the exit code is green.

### Confirmed not to have broken anything

- `node tests/test-roadmap-register.js` → **3 passed, 0 failed** (509 items, 320 cited, 5 declared exceptions).
- `git diff --numstat docs/ROADMAP.md` → **2 insertions, 2 deletions**, one line each. Pipe count per row
  unchanged (#320: 6 before and after; #322: 12 before and after), so no table column moved.
- Driven through the shipping `Q.roadmapRowIsClosed` / `Q.roadmapRowSaysBroken`: both rows still
  `closed=true`, `saysBroken=false`, marker still parsed by the shipping `MARKER` regex. No row changed
  bucket and no gate moves.

---

## 2. TASK 2 — coverage after the rebuild, derived and then cross-checked against the canonical path

`classifyMarker()` was lifted out of the **shipping bytes** of `engine/register_reality.js` by line span
and driven directly. That file has **no `require.main === module` guard and no `module.exports`**, so
requiring it executes the driver, which `execFileSync`s every marker it accepts. The span lift asserts
`classifyMarker` and `insideRepo` are inside it and throws on drift; `MARKER` and the row regex are
compared against literals and throw on drift.

### The three numbers

| | count | of what |
|---|---|---|
| **ADMITTED** — the classifier will read and run this marker | **123** | of 123 markers on the register |
| **OWED** — the row declares in writing that nothing decides it | **46** | rows |
| **STILL REFUSED** — the row claims coverage the classifier will not read | **0** | was **9** last night |

Split by row state, because the gate only cares about one half:

|  | all 219 open rows | the 74 open rows that assert breakage | 241 closed rows |
|---|---|---|---|
| admitted marker | 13 | 8 | 110 |
| INSTRUMENT OWED | 43 | 23 | 3 |
| marker refused | **0** | **0** | **0** |
| **neither — prose only** | **163** | **43** | 128 |

**Cross-checked against the canonical path rather than published on my own arithmetic.**
`node engine/register_reality.js --list` (coverage only; the artifact's size and mtime were captured before
and after and were **byte-identical**, `75935 / 1787861538` both times) prints:

```
   460  defect-register rows  (of 506 `| #N |` rows in the file; the other 46 are planning tables …)
   123  rows carrying a VERIFIED BY marker in total
    46  rows declaring INSTRUMENT OWED — nothing decides them and they say so
     0  markers this file REFUSES TO READ … (0 on an OPEN row asserting breakage)
```

`node engine/open_work.js` independently reports **506 register rows, 74 asserting breakage** — the
gate-relevant population agrees exactly with mine. The 506 / 460 and 261 / 219 differences are the
documented denominator split (`parse()` requires a bolded claim; `open_work.js` counts every `| #N |` line),
not a disagreement.

### Before and after, measured rather than asserted

The pre-rebuild state was reconstructed by lifting the `SAFE` literal from `429e8d84` and applying it to
that commit's `docs/ROADMAP.md`: **124 markers, 115 admitted, 9 refused, 45 rows declaring OWED.**

So the delta is **+8 admitted, −9 refused, −1 marker, +1 owed**. Four came from the classifier rewrite
(#344, #438, #439, #440 — spelling refusals: a bare `1200`, a bare `abilities`, `middle` and a store path);
four came from repairing the ROW (#316, #330, #319, #526 — real placeholder and not-a-command defects); and
one marker was **removed** on purpose (#318, now `INSTRUMENT OWED`, because `tests/roster.js --stage moves`
exits 0 on 632 learnset refusals and would have reported that open row CONFIRMED-and-green).

### The honest gap is not the OWED count

The brief called the OWED count "the honest coverage gap". It is the honest **declared** gap, and 46 rows
saying in writing that nothing decides them is a good property. **The gap is the 163.**

**163 of 219 open rows (74%) carry neither a marker nor a debt declaration — 43 of them assert breakage and
hold the open-defect clause shut on prose.** ROADMAP #381 measured this at **35 of 49** on 2026-08-23. The
register has grown since (49 → 74 asserting breakage); marked coverage went 6 → 8 and declared debt 8 → 23,
so **the declared half improved and the undeclared half grew with the register**: 35 → 43. Both facts are
true and reporting only the first would be the flattering half.

### One structural weakness the rebuild did not touch, and it is the mechanism behind #403

**123 admitted markers point at only 69 distinct instruments. 70 of the 123 rows (57%) share an instrument
with at least one other row**, and an exit code is one number:

```
  29  tests/test-mechanics.js      #352 #357 #404 #405 #415 #426 … #461   (29 rows, one exit code)
   6  engine/quarantine.js         #218 #290 #297 #298 #376 #508
   4  tests/test-effective-identity.js · 4  tests/test-seed-clock.js
   3  tests/test-rollout-fallen.js · 3  tests/test-rollout-seed.js · 3  engine/register_reality.js
   2  ×10 more
```

`tests/test-mechanics.js` sets `process.exitCode = red.length ? 1 : 0` over the **whole census**. Green on it
means *the census has no red row*, not *this row's claim holds*. That is exactly how #403 read `closed` over
four live games: the shared gate was green, the row's clause existed, and the row's second road was untested.
Not an accusation against any of the 29 — a statement that for 57% of this register's coverage, the exit code
cannot say which row it is about.

---

## 3. TASK 3 — the opposite error, swept over the 120 rows closed since 2026-08-21

120 of the 241 closed rows carry a closure date in the last two weeks. 86 carry a marker; **31 carry neither
a marker nor a debt declaration.**

### The shape the brief named first returns zero, and it returns zero for a good reason

**A closure whose stated evidence is a probe the classifier refuses: 0 of 86.** Every recently-closed marker
is admitted today. That is not a null result — it is the same fact as §2, arriving from the closed side.

But there is a version of it that is NOT zero, and it is the one worth carrying:

> **Four CLOSED rows named a marker the register had never once executed.** #316, #330, #344 and #526 were
> all refused by `SAFE` until tonight, and the last real artifact files three of them `INSTRUMENT UNRUNNABLE`
> and has never heard of the fourth (#526 is absent from it entirely). All four are admitted now and **none
> has been run**, because `data/register-reality.json` is 2026-08-27 stale and regenerating it is blocked on
> a decision already filed. Their closures rest on a reading of an instrument, not on its exit code.

### Two rows read `closed` off an instrument the register measured RED, and neither has moved since

From `data/register-reality.json` (generated **2026-08-27T20:06:53Z**, 112 markers — **stale, and stamped as
such**), the last real run recorded **3 PREMATURE CLOSE** and **4 STALE ROW**. `PREMATURE CLOSE` is exactly
the #403 shape: the row says closed, the instrument it names exits red.

| row | marker | closed | drifted since the artifact? |
|---|---|---|---|
| **#258** | `node tests/test-no-silent-failure.js` | 2026-08-24, asserts breakage | **row line UNCHANGED, instrument UNCHANGED** |
| **#409** | `node tests/test-no-silent-failure.js` | 2026-08-23 | **row line UNCHANGED, instrument UNCHANGED** |
| #450 | `node tests/probe_mid_cat_reload.js` | 2026-08-26 | row unchanged, **instrument CHANGED** — verdict may not survive |

Drift was checked rather than assumed: `git rev-list -1 --before=2026-08-27T20:06:53Z` gives `14fd083f`, and
each row line and each instrument was compared byte-for-byte between that tree and today's.

**#258 and #409 are the two candidates.** Both rows state in their own status cell that the gate is green —
#258: *"`node tests/test-no-silent-failure.js` exits 0: 0 NEW, floor 201 unmoved"*; #409: *"the instrument is
green, is enforced at the commit"* — and four days later the register ran that byte-identical instrument and
it exited non-zero. One of those two statements is wrong.

**Evidence for, and against, in the same breath.** `tests/test-no-silent-failure.js` is a **shared**
instrument: both rows point at it and its exit code is one ratchet over the whole repository's silent-catch
count. It can go red because a THIRD file gained a catch block, in which case neither closure is wrong and the
red belongs to nobody. So this is a candidate list, **not a reopen** — the brief is right that a wrongly
reopened row costs what a wrongly closed one costs, and #403 was reopened on a measured second road, not on a
shared gate's colour.

**I did not run it, deliberately.** It is cheap (0.68 s, no game, writes nothing without `--update`/`--accept`)
and running it would settle both rows in one command. But its whole-repo pass scans the **worktree**, and the
live ENGINE agent owns `engine/medicham2-browser.js` and `engine/game_differential.js` — two of the files it
counts. A catch block landing mid-scan changes the number, and a torn read here is a plausible, well-formed,
fictitious answer of exactly the kind this repo has already published once. It is one command **after** the
ENGINE pass lands, and it is OWED below.

### The other direction, reported because it costs the project too

Four **STALE ROW** verdicts in the same artifact — row OPEN, instrument GREEN. **#389** is the one that
survives a drift check: row line and `tests/test-red-run-writes.js` both unchanged since the run, and #389 is
open AND asserts breakage, so it is holding the open-defect clause shut while its own named instrument reads
green. #402, #412 and #444 all name instruments that have changed since, so their verdicts are not carried
here. #389's own status cell says *"MEASURE has NOT run it"* — so the row is honest about why, and the fix is
the same single run.

### The #361 shape (a null result taken against a fixture that cannot carry the mechanism) — no new candidate

Swept mechanically two ways and neither produced one. (a) Every recently-closed row's cited tag id and `--only`
arm id was checked for literal presence in the instrument it names: **all present**. (b) Every closure resting
on null-result language was split by whether the row shows a knob-cleared control; the three that read as
"closed on a test that was already green" — **#416, #450, #490** — were each read by hand and each carries its
own control (#416: the max-HP×12 pair green before and after; #490: `transform` carried as a must-stay-unparted
control; #450: the one-load replay). Not candidates.

**Stated limit, so it is not read as an all-clear.** #361's defect was that `scaleshot` carries
`multiaccuracy: false` — a fact that lives in the dex, not in the register and not in the instrument. **No
text sweep can find that shape.** Finding the next one needs each staged entity derived against
`gen9championsvgc2026regmb` and checked for the flag the row's mechanism depends on. That is a real instrument
and it does not exist; it is OWED below rather than claimed as swept.

---

## 4. What was NOT done

- **`node engine/status.js --write` was not run.** An ENGINE agent is live and playing games; the restamp
  reads gate artifacts that agent may be mid-rewrite of. Same call the previous pass made, same reason.
- **`data/register-reality.json` was not regenerated** and not hand-edited. It is 2026-08-27, 112 markers
  against today's 123, 416 rows against 460. Every verdict quoted from it in §3 is stamped with that date and
  with a drift check against today's tree.
- **No row was reopened, closed, or had its status cell touched.** The only edits are two appended addenda in
  the CLAIM cell of #320 and #322.
- **One artifact WAS written and it is disclosed rather than left to be found:** `node engine/open_work.js`
  rewrites its own `data/open-work.json` on every invocation, so the cross-check in §2 moved it (4 lines —
  the stamp and the counts, reflecting the #320/#322 edit that preceded it). It was clean in `git status` at
  the start of this pass. It is `open_work.js`'s own output and no MEDICHAM gate clause reads it, but a
  measuring pass that says "nothing was written" and moved a file would be the wrong kind of report.
- **`docs/MEASURE.md`, `CHANGELOG.md` and the version bump are unmet**, named rather than half-done: they
  belong with the commit and this pass was told not to commit.

---

## OWED

1. **`data/register-reality.json` has never seen 8 of the 123 markers it should now carry**, and it cannot
   report `MARKER REJECTED` at anything but 0 until it is regenerated. Still blocked on the decision filed as
   OWED 2 in `docs/_reports/2026-09-04-safe-marker-rejection.md`: the pass now runs 14 artifact-writing
   scripts, two of which rewrite gate inputs, plus a full move-stage run. **Do not run the measuring path
   beside a live agent until that has an owner's answer.**
2. **#258 and #409 read `closed` off `tests/test-no-silent-failure.js`, which the register measured RED on
   2026-08-27 with neither the rows nor the instrument having moved since.** One run of
   `node tests/test-no-silent-failure.js`, **after the ENGINE pass lands**, settles both — and if it is red,
   its per-file list says whether the red belongs to either row or to a third file. Not reopened on a shared
   gate's colour.
3. **#389 is open and asserting breakage while `tests/test-red-run-writes.js` reads green** (unchanged since
   the artifact). Its own cell says MEASURE has not run it. Same single run, same window.
4. **Four closures — #316, #330, #344, #526 — rest on instruments the register has never executed.** They
   become real evidence on the first regeneration after (1), and not before.
5. **57% of this register's marker coverage is a shared exit code that cannot name the row it decided**
   (70 of 123 rows across 16 instruments; 29 on `tests/test-mechanics.js` alone). That is the mechanism that
   let #403 sit closed over four live games. No instrument measures it. The cheap half is a
   `register_reality.js` coverage line printing rows-per-instrument so it is ratcheted rather than
   rediscovered; the expensive half is per-row clause addressing, which is a decision, not a patch.
6. **163 of 219 open rows carry neither a marker nor a declared debt — 43 of them assert breakage.** #381
   owns this and its figure (35 of 49) is now stale in the direction that matters. #381's own `INSTRUMENT
   OWED` already names the coverage figure that would ratchet it; the `--list` block now prints four of the
   five numbers needed.
7. **No instrument can find the #361 shape.** A sweep asking, per staged entity, whether it carries the flag
   the row's mechanism depends on — derived against the regulation, never recalled — does not exist. Until it
   does, "no new #361 candidates" means "no *text* sweep found one", which is what §3 says.
