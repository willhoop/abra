# Is the open-defect clause interpretable? — MEASURE, 2026-08-23

Dated findings record. Not maintained, not current state, superseded by the register rows it feeds.
Run in LIGHT MODE: no game played, no artifact regenerated, no `status.js`, no `quarantine.js` CLI,
no `register_reality.js` in any mode.

---

## 0. Verdict first

**The open-defect clause is uninterpretable, and so is the one other clause that was carrying a
substantive number.** Of the MEDICHAM gate's 8 clauses, 1 passes on current evidence and **0 of the
7 failures rest on a measurement of the engine in this tree.** Five say so on their own face. The
sixth (open defect) does not say so and cannot. The seventh (game differential) does not say so and
*structurally cannot*, because its artifact carries no release stamp and the clause never looks for
one.

The gate today is not evidence the simulator is broken and not evidence it is correct.

---

## 1. The premise — CONFIRMED, and the gap is worse than stated

### 1a. The clause does read `data/register-reality.json`

It is **`openDefectClause()` in `engine/quarantine.js`**, not in `status.js`. `status.js:106` does
`require('./quarantine.js')` and is a reporter — its own header says so ("The gate and the membership
test live in engine/quarantine.js, not here"). `grep -n register engine/status.js` returns exactly
one hit, and it is a comment.

The clause reads the artifact through the declared shape constant `REGISTER_REALITY`
(`quarantine.js:1411`), which `register_reality.js` imports and writes through — the single-writer
repair made after the wire carried zero rows for its whole life on a three-way key mismatch
(`results`/`cmd`/`green` vs `rows`/`command`/`exit`).

Called directly (read-only, sub-second):

```
node -e "const Q=require('./engine/quarantine.js'); const c=Q.openDefectClause(); ..."

ok: false
open rows: 49
withRed: #218,#224,#241,#258
debt: 45
staleRows: (none)
unrunnable: (none)
verdicts_read: 31   verdicts_generated: 2026-08-22T01:55:12.569Z
```

Premise confirmed exactly: this is the file, this is the clause, these are the four rows.

### 1b. The two-hour gap is a mtime artefact. The real gap is ~26 hours.

| | value |
|---|---|
| `data/register-reality.json` **mtime** | 2026-08-23T01:54:26Z = **Sat Aug 22 21:54 local** |
| `data/register-reality.json` **internal `generated`** | 2026-08-22T01:55:12.569Z = **Fri Aug 21 21:55 local** |
| last commit whose content is this file (`f6dd014`) | **2026-08-21 21:57:27 -0400** |
| `git status` / `git diff HEAD` on the file | **empty — byte-identical to HEAD** |
| `engine/medicham2-browser.js` mtime | 2026-08-23T03:49:15Z = **Sat Aug 22 23:49 local** |

The file's content is the run committed at `f6dd014`, 2m15s after its own `generated` stamp. Its
mtime is 24 hours later, to within 46 seconds, with **no content change** — a touch (checkout, stash,
or similar). So the artifact is **~26 hours older than the simulator**, not ~2.

This is CLAUDE.md's mtime rule cashing in, and in the dangerous direction: mtime made the artifact
look a full day fresher than it is.

---

## 2. Q1 — is the verdict artifact stale against the current tree? YES, by content.

### 2a. First: the artifact cannot answer this about itself

Top-level keys of `data/register-reality.json`:

```
generated, by, what, why, weaker_than_it_looks, counts, instrument_owed, results,
unverifiable_open_defects
```

**No `engine_release`. No `source_digests`.** `engine/provenance.js` would classify it
`digestState = 'mtime-only'` (`provenance.js:1378`). Compare `data/game-differential.json`, which
carries `engine_release` and is refused by three separate readers when it mismatches. The verdict
artifact that gates the register has strictly weaker provenance than the artifacts it adjudicates.

### 2b. Method used, and why it is sound

mtime is excluded by rule. Instead:

1. Establish that HEAD is the tree the gate reads. `git status --porcelain -- engine/ data/` shows
   only `data/open-work.json` and `data/provenance-stamp.json` modified plus `data/_pair-pilot.json`
   untracked — **`engine/` is clean against HEAD**, so HEAD's bytes are the running bytes.
2. Establish the artifact's tree. Content-identical to HEAD's copy, last written at `f6dd014`,
   2m15s after its `generated` stamp. So `f6dd014` is the tree it measured, to within two minutes.
3. For each of the four instruments, compute its **require-closure** using
   **`quarantine.js`'s own exported `requiresOf()`** — reusing the canonical dependency extractor
   rather than hand-rolling a second one — then sha256 every file in that closure at `f6dd014` and
   in the working tree and compare digests.

This is sound because a gate's verdict is a function of (its code + its transitive requires + the
data it reads). A changed digest anywhere in that closure means the recorded verdict describes other
bytes. It cannot be fooled by a touch, and it cannot be fooled by a file being "newer than its
source".

### 2c. Result

```
#218  seed=engine/quarantine.js               closure=15  CHANGED=7
      engine/mc_key.js, engine/medicham2-browser.js, engine/quarantine.js,
      engine/rollout_leaf.js, engine/set_priors.js, engine/smogon_priors.js, engine/tags.js
#224  seed=engine/gate_offfield_target.js     closure=1   CHANGED=0
#241  seed=engine/gate_fail_and_silent.js     closure=2   CHANGED=0
#258  seed=tests/test-no-silent-failure.js    closure=1   CHANGED=0
```

Code-closure alone understates it, because three of the four gates read artifacts or the source tree
rather than requiring the simulator. Whole-tree diff `f6dd014..HEAD`:

```
data/engine-data.js          |    2 +-
engine/medicham2-browser.js  | 2192 +++++++++++++++++++++--   (+1,965 / -227)
engine/policy.js             |  320 +++++-
engine/register_reality.js   |  336 +++++--
engine/tag_dex.js            |  344 ++++++-
engine/game_differential.js  |  252 ++++-
engine/quarantine.js         |   92 +-
... 16 files changed, 4,459 insertions(+), 389 deletions(-)
```

Independent corroboration from `node engine/where.js --gates` (read-only):

```
register-reality.json: generated 2026-08-22T01:55:12.569Z,
  281 id rows then vs 340 in docs/ROADMAP.md now  <- STALE, the register has grown since
4 row(s) here have NO verdict in that artifact: #318, #319, #320, #322.
```

**ANSWER: the verdict artifact is stale against the current tree, established by content digest over
each instrument's require-closure plus a whole-tree content diff, and corroborated by a 59-row growth
in the register it claims to cover.**

---

## 3. Q2 — the four rows, individually

Both cheap gates were confirmed to contain **no `writeFileSync`** before being run, and were run with
`--json`. Neither writes anything.

### #218 — `node engine/quarantine.js --whole-game`

The instrument is `wholeGameClause()`. Computed in-process (quarantine.js contains **no `execSync`,
`spawnSync` or `spawn` anywhere** — the entire 8-clause gate is artifact reads and completed in
**81 ms**):

> **MEASURED AGAINST A DIFFERENT ENGINE** — this artifact ran on release `c66976713feb` and the tree
> is `33d871e6db92`. … THE RATE, THE DIVERGED COUNT, THE GAME COUNT AND THE CLASS COMPOSITION ARE ALL
> WITHHELD.
>
> `cannot_answer: true`

**#218's RED is the whole-game clause — one of the five Will has already discounted — re-entering the
gate through a second door.** Its recorded `green:false / "exit 1"` was taken when the artifact and
the tree agreed on a release. Today the instrument refuses to answer. **Describes an older tree.**

### #224 — `node engine/gate_offfield_target.js`

```json
{ "row": 224, "tree_release": "33d871e6db92",
  "counted": [],
  "not_counted_stale": [
    { "file": "data/game-differential.json", "ranOn": "c66976713feb" },
    { "file": "data/divergence-turns.json",  "ranOn": "6a05dd9ad60d" } ],
  "verdict": "CANNOT ANSWER", "exit": 2 }
```

Register says `green:false, why:"exit 1"`. Today: **exit 2, CANNOT ANSWER, `counted: []`.** A
genuinely different verdict. **Describes an older tree.**

### #241 — `node engine/gate_fail_and_silent.js`

```json
{ "row": 241, "pinned_sample": { "census":"2e3953f1f882","pool":"631d4ea60a80","games":995 },
  "run_sample":    { "census":"80e648f34d56","pool":"0d103fb9fa87","games":961 },
  "sample_matches": false,
  "engine_release": "c66976713feb",
  "causes": null, "games": null,
  "verdict": "CANNOT ANSWER", "exit": 2 }
```

Doubly unanswerable: wrong release **and** the pinned sample (census + pool + game count) does not
match. Counts withheld. Register says `"exit 1"`. **Describes an older tree.**

### #258 — `node tests/test-no-silent-failure.js`

**NOT RUN** — the auto-mode classifier blocked the invocation. On the OWED list below.

What can be said without running it: this gate does **not** read a pinned artifact. It statically
scans `engine/` and `tests/` source against `data/silent-catch-baseline.json`. Its input is therefore
the whole source tree, which moved **4,459 lines across 16 files** since the verdict was recorded.
The recorded verdict is a claim about other bytes.

**But #258 is the one row of the four that is cheaply recoverable.** It reads the LIVE tree, so
re-running it today gives a real answer about this engine with no differential re-run needed. The
other three cannot be answered until `game_differential.js` is re-run on `33d871e6db92`.

### The "CLOSED language while counted open" contradiction — RESOLVED

Applied the shared `roadmapRowIsClosed` / `roadmapRowSaysBroken` to the current lines and to the same
lines at `f6dd014`:

| row | at `f6dd014` | now | status cell now |
|---|---|---|---|
| #218 | closed=false | closed=false | `open — engine DEFECT. **33.4% as of 2026-08-12** …` |
| #224 | **closed=true** | **closed=false** | `open — engine DEFECT. REOPENED 2026-08-22 BY MEASURE: traceBodyOffField = 4 (first offender farigiraf) …` |
| #241 | closed=false | closed=false | `(1)+(2)+attribution CLOSED — (3) OPEN, engine DEFECT …` |
| #258 | closed=false | closed=false | `open — engine/search DEFECT; re-measured 2026-08-19 …` |

- **#224** — the `CLOSED 2026-…` is in the **title**, historical, from the 2026-08-18 close. The
  **status cell** was `closed 2026-08-18 — measured absent on a current-release artifact` at
  `f6dd014` and now reads `open — … REOPENED 2026-08-22 BY MEASURE`. `roadmapRowIsClosed` returned
  **true then and false now, correctly both times**. The artifact's `closed:true` /
  `verdict:"PREMATURE CLOSE"` is a snapshot of the pre-reopen roadmap. **This is not a detector
  disagreement — it is one stale copy.** The single-detector invariant held.
- **#241** — the cell does not BEGIN with a closed word and explicitly scopes part (3) as open.
  Correctly open then and now. The `CLOSED` is part-scoped narrative about parts (1), (2) and
  attribution.

**Both apparent contradictions resolve. Neither is a bug in `roadmapRowIsClosed`.**

---

## 4. A finding not asked for, and material: the register launders CANNOT ANSWER into CONFIRMED

`engine/register_reality.js:172`:

```js
return { green: false, why: 'exit ' + (e && e.status), ms: Date.now() - t0 };
```

**Any** non-zero exit becomes `green: false`. `openDefectClause` (`quarantine.js:1573`) maps
`green === false` → `withRed` → *"an open defect backed by a failing measurement"*.

Both `gate_offfield_target.js` and `gate_fail_and_silent.js` reserve **exit 2** specifically for
CANNOT ANSWER — `gate_fail_and_silent.js:129` declares the verdict table with its exit codes for
exactly this purpose. The `green` tri-state was built so that INSTRUMENT UNRUNNABLE could not be read
as agreement; it has **no state for "ran, and refused to answer."**

Consequence: **re-running `register_reality.js` today would not repair this clause — it would
re-publish #224 and #241 as RED for the wrong reason.** The obvious remedy is not one. (Not fixed;
this report proposes nothing. Flagged for routing.)

---

## 5. Q3 — how many of the 7 rest on real evidence

All 8 clauses computed in-process, 81 ms, pure artifact reads:

| # | clause | verdict | rests on |
|---|---|---|---|
| 1 | game differential | **FAIL** — 5 of 6000 at MIDPOINT; worst `aurorus hypervoice -> aggron` (showdown 18-21, medicham 64-76) | `data/engine-diff.json` — see 5a |
| 2 | deliberate roster / items | FAIL **[CANNOT ANSWER]** | `c66976713feb` ≠ tree |
| 3 | deliberate roster / abilities | FAIL **[CANNOT ANSWER]** | `c66976713feb` ≠ tree |
| 4 | deliberate roster / moves | FAIL **[CANNOT ANSWER]** | `c66976713feb` ≠ tree |
| 5 | coverage / every used mechanic is measured | **PASS** — 412 moves above 25 clicks | current |
| 6 | whole-game differential | FAIL **[CANNOT ANSWER]** | `c66976713feb` ≠ tree |
| 7 | mechanics / each staged and compared | FAIL — "MEASURED AGAINST A DIFFERENT ENGINE" | `c66976713feb` ≠ tree |
| 8 | no open, known engine defect | FAIL — 4 RED | 26-hour-old verdict artifact |

The five Will named are rows 2, 3, 4, 6, 7. The sixth failure is the open-defect clause. **The
seventh is `game differential`, and it is the only failing clause carrying a substantive number.**

### 5a. The game-differential clause is stale too, and nothing tells the reader

```
data/engine-diff.json
  generated  2026-08-22T20:08:00.700Z   (= 2026-08-22 16:08 local)
  release    (UNSTAMPED)
  source_digests?  false
  compared 6000  disagreed 5  seed 20260804
  last content commit: 3d519ea, 2026-08-22 16:20 -0400
```

`differentialClause()` (`quarantine.js:593`) reads `data/engine-diff.json` and performs **no release
comparison of any kind** — it checks `plant`, it checks `arms`, it never asks which engine produced
the numbers. It is the only clause in the gate without that check, and its artifact is the only one
without the stamp that would make the check possible.

Content digests, `3d519ea` → working tree:

```
engine/medicham2-browser.js    then 912c62285a16   now 335abeb802ab   *** CHANGED ***   (+748 / -60)
data/engine-data.js            then cf15722c9b91   now c73da1d25212   *** CHANGED ***
engine/tags.js                 then 63effec9d5cd   now 145a3cc9ce2f   *** CHANGED ***
```

Six commits touched the simulator after that artifact was written (`f17d235`, `22e3578`, `186cb65`,
`cfa3cab`, `39a91ac`, `f36427f`). **`data/engine-data.js` is the damage/species table and its digest
moved** — CLAUDE.md's rule is explicit that a moved damage table is a REFIT, not a restamp. The
"5 of 6000, worst `aurorus hypervoice -> aggron`" figure is therefore about other bytes, exactly like
the five clauses that say so — with the difference that this one **prints its number** instead of
withholding it. A caption is not a quarantine; here there is not even a caption.

### 5b. No artifact in the repository describes this tree

I stamped every JSON in `data/` that carries a release field (76 files). **Zero carry
`33d871e6db92`.** The freshest are `c66976713feb` (`game-differential.json`, `all-mechanics-fire.json`,
`roster.{items,abilities,moves}.json`, all generated 2026-08-23T02:35–02:40Z). The current release was
cut at 2026-08-22 23:56 local, after every one of them.

### 5c. The number that routes the decision

> **8 clauses. 1 passes on current evidence (coverage). 0 of the 7 failures rest on a measurement of
> the engine in this tree.**
>
> - 5 declare it themselves (3 roster stages, whole-game, mechanics).
> - 1 (open defect) is uninterpretable: 2 of its 4 RED rows are CANNOT ANSWER today, 1 of the 4 *is*
>   the already-discounted whole-game clause, and the 4th was measured against a source tree 4,459
>   lines different.
> - 1 (game differential) is stale and does not know it, because it is the only clause with no
>   release check and its artifact is the only one with no release stamp.
>
> **The MEDICHAM gate currently proves nothing about the simulator in either direction.**

That is materially different from "the engine is broken." It is also materially different from
row #350's framing: #350 is about the `debt` bucket printing a false sentence, and notes that
"neither reading changes the gate." **This is the harder case — the same staleness has reached
`withRed`, which does hold the gate shut.** #350 recorded `withRed` as 3 rows (#218, #241, #258);
#224 was reopened on 2026-08-22 and made it 4.

---

## 6. Debris — REPORTED, LEFT IN PLACE. Nothing deleted, nothing edited.

- `data/_pair-pilot.json` — untracked, release `5e0853311131`, generated 2026-08-23T03:57Z. Not
  created by me. Left alone.
- `data/open-work.json`, `data/provenance-stamp.json` — modified in the working tree, uncommitted.
  Not touched.

## 7. What this session ran

Read-only, sub-second, no writes, no games, no child process left behind:
`git log/diff/show/status`, `node -e` probes over artifacts, `Q.openDefectClause()`,
`Q.wholeGameClause()`, `Q.medichamIsCorrect()` (81 ms, artifact reads only),
`node engine/gate_offfield_target.js --json`, `node engine/gate_fail_and_silent.js --json`,
`node engine/where.js --gates`.

---

## 8. OWED, NOT RUN — exact commands

```bash
# 1. #258's instrument — the only one of the four answerable without a differential re-run.
#    Blocked by the auto-mode classifier this session. Default path does not write; writeBaseline()
#    is reachable only via --update / --accept.
node tests/test-no-silent-failure.js

# 2. Re-measure the engine on the current tree. Every CANNOT ANSWER above unblocks on this and
#    nothing else. Pin all three things, not just the release.
SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/game_differential.js \
  --games 1200 --release 33d871e6db92 --team-store data/team-pool-frozen --write

# 3. Re-cut the damage differential so clause 1 stops quoting other bytes.
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-engine-diff.js --n 6000 --seed 20260804

# 4. The three roster stages and the census, on the current release.
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/roster.js --stage items
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/roster.js --stage abilities
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/roster.js --stage moves
SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/all_mechanics_fire.js

# 5. ONLY AFTER 2-4. Re-publish the verdicts. Running it before then re-publishes
#    #224 and #241 as RED on exit 2 (see section 4).
node engine/register_reality.js

# 6. Recompute the gate and restamp the generated blocks.
node engine/quarantine.js
node engine/status.js --write

# DO NOT RUN: node engine/register_reality.js --list   (ROADMAP #369 — overwrites the verdict
#             artifact and destroys every green:false row).
```
