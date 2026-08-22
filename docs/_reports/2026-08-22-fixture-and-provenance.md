# Two red instruments that are not the MEDICHAM gate — 2026-08-22, MEASURE

Historical findings record. Not maintained, not current state, never cited as a figure.
Superseded by whatever register rows it feeds.

Written under a hard constraint: an ENGINE agent was running the gate re-run chain against release
`603d9a69d5a3` and was actively writing `data/roster.{items,abilities,moves}.json`,
`data/game-differential.json` and `data/all-mechanics-fire.json`. **None of those five was read.**
`engine/quarantine.js`, `engine/status.js --write`, `tests/roster.js`, `engine/game_differential.js`
and `engine/all_mechanics_fire.js` were not run. `engine/provenance.js` was **also not run** — see §2.4
for why, which was not in the brief.

---

## 1. THE FEATURE SEMANTICS CHECK

### 1.1 The question, and the answer

> Are the two new fixture scenarios new COVERAGE (restamp is correct), or did `board.js`'s feature
> semantics change (a restamp would bury it)?

**Neither branch, and the third one is the finding.**

- The fixture change is **entirely fixture-side**. Two scenarios of new coverage plus a legality
  repair to eight bodies inside the original ten. Nothing about it implicates `board.js`.
- **`board.js`'s feature semantics are provably unchanged.** Zero of 76 columns move between the
  stamp-era `board.js` and today's, on an identical fixture with identical data.
- **But eleven of the 76 columns HAVE moved since the stamp**, and the cause is what the features
  READ, not what they compute. The damage table was regenerated: 318 → 322 species, digest
  `405c836793d1` → `1bda9df11d73`, with 76 rows rewritten.

**I did NOT restamp.** A restamp writes `table.digest = 1bda9df11d73` into the baseline and converts
a live refit signal into silence. `docs/MEASURE.md` and my own standing brief say it in one line:
*a restamp is only valid if the feature FUNCTION is unchanged; damage table moved → REFIT, not
restamp. There is no version where the shortcut is fine.* The brief's binary did not have a branch
for "the fixture is clean, `board.js` is clean, and the table underneath both moved", and that is
exactly the state.

### 1.2 What the fixture divergence actually was

`data/policy-weights.json` was stamped at `2026-08-05T04:00:43Z` against the fixture as it stood in
commit `bb66821` (2026-08-04 19:05): **10 scenarios, 324 candidates, 1,309 pairs, 58 marginal + 18
joint features.** The feature LIST has not changed since — 58 and 18 today, with no name added,
removed or renamed.

Two commits moved the fixture, both on 2026-08-13:

| commit | time | scenarios | what it did |
|---|---|---|---|
| `1cd6af5` | 2026-08-13 16:52 | 10 → 11 | *Hazards were never a fit defect…* — added `hazards-already-up` (Stealth Rock / Spikes / Sticky Web / Toxic Spikes already on the board), the blind spot ROADMAP #254 named |
| `89b67d4` | 2026-08-13 17:27 | 11 → 12 | the legality sweep — added `sand-weather-ball`, AND repaired eight illegal declarations inside the original ten |

The eight repairs inside the original ten, from the diff `bb66821..HEAD`:

- Venusaur `Rocky Helmet` → `Miracle Seed`, in **three** scenarios (Rocky Helmet is banned in Reg M-B)
- Grimmsnarl `Thunder Wave` → `Taunt`, in **two** scenarios
- Torkoal `Body Press` → `Will-O-Wisp`
- Farigiraf `Electric Seed` → `Mental Herb`
- Farigiraf `Throat Spray` → `White Herb`
- Garchomp `Weather Ball` → `Rock Slide` (the flip moved to its own board, `sand-weather-ball`)

So the identity mismatch has **two** causes, not one, and `verify()` can only see the first: the
stamp is `version 2` with no `bodies` block (that block was added by the same 2026-08-13 work), so
the eight body edits are invisible to it. Had the scenario COUNT not also changed, the check would
have reported the moved columns as *"these features changed MEANING since the weights were fitted"* —
which would have been false, and would have accused `board.js`.

### 1.3 The experiment, and why it is decisive

The fixture cannot be compared as it stands: 12 scenarios of rows against 10 stored hashes. So the
fixture was held CONSTANT and `board.js` varied instead — the only cut that isolates the question.

`engine/feature_fixture.js` at `bb66821` was staged into the scratchpad with its three relative
requires rewritten to absolute engine paths (`board.js`, `champions_sim.js`, `mc_key.js`), so it
loads the LIVE tree. Nothing in the repository was modified. Run through `tools\lownode.cmd`.

Three runs:

| # | fixture | board.js | data | result |
|---|---|---|---|---|
| A | `bb66821` (10 scenarios, original bodies) | **HEAD** | current | 324 cands, 1309 pairs — **11 of 76 columns differ from the stored hashes** |
| B | `bb66821` | **`bb66821`** (stamp-era, requires rewritten to absolute) | current | 324 cands, 1309 pairs — **the same 11 columns differ, identically** |
| A vs B | — | — | — | **0 of 76 columns differ** |

Run A reproduces the stored shape exactly — 324 candidates and 1,309 pairs, the numbers in the stamp
— which is the control that says the reconstruction is the right fixture.

**A vs B is the answer.** The stamp-era `board.js` and today's `board.js` produce byte-identical
hashes on all 58 marginal and all 18 joint columns. Every `board.js` commit since the fit —
`3be3f3b`, `71da955`, `1cd6af5`, `25d67c5`, `435be2b`, `58a26a7`, `f545e35`, `442c5c0`, `c447b99`
(the 2026-08-19 19:52 one the brief named) — changed no feature's meaning on those ten boards.

Stated with its limit, because the file's own header states it and `status.js` already learned this
the hard way on 2026-08-05: **a guard only guards what it exercises.** Ten frozen boards is not the
corpus. `data/feature-engine-contrast.json` is the instrument that answers the same question over
real corpus rows, and it is itself UNSAFE (6 of 9 declared inputs moved), so it cannot corroborate
this today.

### 1.4 The eleven columns that moved, and what moved them

```
features:koTarget          b6902f89050e -> 0c290f8833f7
features:dmgFrac           2b64a511105f -> c08198cc8330
features:tgtMayProtect     0748a39cf364 -> 962b78b2329f
features:killIsRoll        e1ed22a59376 -> 4e1d884aaa08
features:killsThreat       9b4ca3e30b54 -> bad8a19a144b
features:switchSurvives1   0e94b1687aa4 -> 54d70a9e6ad9
features:switchKOSlow      2045dd8d8175 -> 9c9d7efd0c30
features:switchDiesFirst   83f864ebe7e8 -> c22f00eb026f
features:screenValue       68d992e33616 -> b34d1b81da46
features:stallIntoEncore   e210019a66b6 -> f9e9bdab4149
jointFeatures:partnerCoversMe  8891ed302b59 -> 05389a767e9d
```

Ten of the eleven are damage-derived. The table digest moved with them:
`{318 species, 405c836793d1}` → `{322 species, 1bda9df11d73}`.

Diffed `data/engine-data.js` at `bb66821` against today, over exactly the fields `tableDigest()`
hashes (`mv`, `item`, `ab`, `st`, `bs`, `ty`):

- **+5 rows** — `castform-snowy`, `castform-rainy`, `castform-sunny`, `morpeko-hangry`,
  `mimikyu-busted` (the forme rows landed 2026-08-22; see `docs/_reports/2026-08-22-formes.md`)
- **−1 row** — `floette-eternal-mega`
- **76 rows changed** — every one a `*-mega`, including `garchomp-mega`, `gyarados-mega`,
  `venusaur-mega`, `clefable-mega`, `tyranitar-mega`, `skarmory-mega` and `excadrill-mega`, whose
  base bodies all stand on the fixture boards

Attribution stated honestly: `tableDigest()` covers `MC.mons` only. `engine/medicham2-browser.js`
(moved 2026-08-22 02:05) and `data/abra-tags.js` (2026-08-22 00:49) are also read by the damage path
and are not in that digest, so "the damage table moved" is the confirmed and sufficient cause, not
the exclusively proven one. What IS exclusively proven is the negative: **it is not `board.js`.**

### 1.5 The instrument defect — the check regressed on 2026-08-13 and lost a verdict it used to give

`verify()` returns at the FIRST failing gate, in this order:

1. no hashes at all
2. **round / scenario-label identity** ← currently returns here
3. bodies digest
4. table digest
5. per-feature columns

`web/status-data.js` holds a snapshot of `status.js` from **2026-08-10 21:32**, three days before the
fixture grew. It reads:

```
feature_fixture --check FAILED:   Measure what it touches before deciding — how many corpus games
contain a changed species — | then refit (node engine/fit_policy.js, then node engine/fit_joint.js)
if it reaches the fit, | or restamp with: node engine/feature_fixture.js --stamp <file>
```

That is gate **4**, the DAMAGE TABLE branch, firing correctly and saying the right thing. On
2026-08-13 the fixture grew, gate 2 started returning first, and the table verdict has been
unreachable ever since. **The check did not stop working on 2026-08-13; it stopped reporting the one
verdict it was still entitled to give**, and the message it substituted — *"restamp after checking
board.js"* — points at the one action that would erase it.

This is the file's own stated principle broken by its own gate ordering. Its header:

> IT IS A SEPARATE BLOCK BECAUSE IT MEANS A DIFFERENT THING… A moved FEATURE hash means board.js
> changed… A moved TABLE hash means a derived table was re-ingested… **Collapsing the two into one
> verdict makes the louder one unreadable.**

**The fix, specified and NOT applied.** `tableDigest()` reads `mcKey.all()` — the whole damage table.
It has zero dependence on `SCENARIOS`. It is therefore valid to evaluate even when the fixture
identity has moved. `verify()` should accumulate rather than return early: evaluate the table block
first, then the identity/bodies block, then the columns (columns only when the identity matches,
since those genuinely cannot be compared across a changed fixture), and join. Strictly more
information, never less.

**Why it was not applied in this session, said plainly rather than filed:**

1. `verify()`'s return value is parsed by `engine/status.js:389-401`, which takes the last three
   non-empty lines of the child's output, and by `engine/magnemite.js:76-108` on every weight load.
   The ENGINE agent's chain runs `status.js`. Changing the output of an instrument while another
   division is reading that output is *nothing in frame may move*, which is the rule that cost 7,100
   games on 2026-08-04.
2. `tests/test-feature-semantics.js` never exercises gate 2 — every stamp it builds is derived from
   `hashes()` and so always matches the fixture identity. The change therefore needs a new red-first
   test case, and `tests/run-all.js` cannot be run safely right now.
3. The finishing step, `node engine/status.js --write`, is forbidden by the brief.

The measurement in §1.3 answers the check's question for today. The code change makes it
self-answering next time, and it should land in a session where the tree is quiet.

### 1.6 Surrounding truth, so this is not overclaimed

`data/policy-weights.json` is QUARANTINED regardless — the weights were fitted on features computed
through MEDICHAM, and the refit is OWED, gated behind the engine rather than behind compute
(ROADMAP #26, owned by Will, who is reworking the weights himself). Nothing here changes that, and
none of it is a reason to run a fit. The only thing this session changes is that `REFIT OWED` is now
backed by a measured cause — a regenerated damage table under eleven named columns — instead of by
an instrument that could not compare anything.

---

## 2. `data/wire-ladder.json`

### 2.1 The verdict: it is not a treadmill and it is not a re-run. **The re-run is impossible.**

Provenance's stated remedy is `node engine/wire_ladder.js`. **That command cannot run.**

ROADMAP **#109** already records it — *"`engine/wire_ladder.js` cannot run at all (all 14 rungs lack
the symbol, so the published ladder stands but is no longer replayable)"* — and it was re-measured
today rather than taken from the row:

```
node engine/engine_release.js compat engine/medicham2-browser.js natureL50
  268 of 329 releases can serve it.  4 pruned, 0 predate the file, 56 predate an export, 1 broken.
```

All thirteen distinct releases the ladder is built from are in the 56:

```
cf6a68fa412c LACKS natureL50   28e66a7c9ab8 LACKS   0771dc47b5f6 LACKS   41e28311e591 LACKS
6b6f898f136f LACKS             128a1ca28d34 LACKS   1e29ff6c431b LACKS   45485dee6a43 LACKS
3fd06d865427 LACKS             0aa54cb1a9de LACKS   dd3da7c69cb0 LACKS   86048ca3a422 LACKS
dc3c43336539 LACKS
```

`engine/game_differential.js` is not in `engine_release.js`'s `SOURCES`, so the driver is live while
the engine is frozen; the live driver reads `natureL50`, and bytes cut on 2026-08-07 never held it.
CLAUDE.md §12 governs: **a stranded artifact is a figure to WITHHOLD and re-measure, never to
resurrect.** The release-ladder figure stays withheld permanently. It does not come back.

So the honest disposition is a third one the brief did not offer: **the remedy string is wrong.**
`engine/provenance.js` and `engine/status.js` both tell a reader to run a command that exits before
it plays a game, which is a remedy that will be attempted, will fail confusingly, and will teach
someone to distrust the tool. It should say STRANDED, not "re-run this".

### 2.2 And the artifact over-declares its inputs, which is a separate, live defect

Even setting the stranding aside, **re-running would not have cleared it**, and this matters for the
next ladder anybody runs.

`wire_ladder.js:596` stamps `source_digests: RS.sourceDigests(WATCHED)`. `WATCHED` is a *drift
detector* — "things that could move under me and waste the run", digested before and after and
reported as `instrument.inputs_before/after/inputs_that_moved`. `source_digests` is a *provenance
declaration* — "the bytes this result was computed from". **They are different contracts and the same
list is being used for both.** Five of the eight moved inputs are files the run demonstrably did not
read:

| declared input | was → is | did the run read it? | verdict |
|---|---|---|---|
| `data/games.bo3.jsonl` | `a5cba908de66` → `1a9d45809719` | **yes, live** — this artifact (2026-08-07 17:44) predates the copy-the-store fix; `instrument.team_store_pinned` is absent | genuine, and self-moving (OPS appends hourly) |
| `data/mechanics-census.json` | `3d914acf9978` → `80e648f34d56` | **no** — `steering.pinned: true`, `input_read_from: data/wire-ladder-census.pin.json`, and `matches_live: false` **at run time** | **FALSE UNSAFE** |
| `data/tags.json` | `94eaa5a4d8e0` → `a98dbd1a195a` | **no** — `game_differential.js:330` uses `REL.read('data/tags.json')`; it is in the release's 26 SOURCES | **FALSE UNSAFE** |
| `data/engine-data.js` | `96a94b7fadf7` → `c73da1d25212` | **no** — `game_differential.js:198` uses `REL.require('data/engine-data.js')`; in SOURCES | **FALSE UNSAFE** |
| `engine/champions_sim.js` | `fa5b8af6513a` → `b9ae3b072b4a` | in SOURCES and served from the release | **FALSE UNSAFE** |
| `data/protocol-events.json` | `9c1dfeb7973c` → `c0652df52e29` | **yes** — `game_differential.js:1514` reads it live | genuine |
| `engine/game_differential.js` | `9221179f56fa` → `672dfe5c0573` | **yes** — spawned live as a child | genuine |
| `engine/diff_swarm.js` | `dae9c1d7d942` → `d734cffd2372` | **yes** — live | genuine |

Unmoved and correctly so: `data/games.ots.jsonl`, `data/wire-ladder-census.pin.json`,
`engine/steering.js`.

`wire_ladder.js` itself already knows this and says so at line 624 about one of the eight:

> THE TEAM STORE IS COPIED, NOT WATCHED… When it is pinned, `inputs_that_moved` naming
> `games.bo3.jsonl` is NOT a fault: the ladder read the copy.

That comment is inside `instrument`, where it is true. The same digests are also written to
`source_digests`, where provenance reads them and it is not.

**Owed (file it, do not run it):** `source_digests` must declare what was consumed — the release
ids, `data/wire-ladder-census.pin.json`'s digest, the frozen team-store digest, and the three live
instrument files — and leave `WATCHED` in `instrument.inputs_before/after` where it belongs. Without
that, ANY future ladder is stamped UNSAFE within the hour of finishing, permanently, for reading a
file it went to deliberate trouble not to read. That is the treadmill the brief asked about, and it
is real — it is just downstream of a re-run that cannot happen.

`data/state-ladder.json` carries the identical eight-input declaration (it is the same script under
`--state`) and inherits the whole finding.

### 2.3 The wider shape

**Caveat first: this is NOT provenance's verdict table.** See §2.4. What follows is a mechanical
digest comparison — for every `data/*.json` carrying a `source_digests` block, which declared inputs
no longer match the file on disk, using `engine_release.sha12`. It is a SUPERSET of provenance's
UNSAFE set (57 artifacts carry the block; 54 have at least one moved input; provenance says 24 are
unsafe, applying rules about graph membership, `void`, scratch files and `.meta.json` that this scan
does not). The five files the ENGINE agent is writing were excluded.

**Which declared inputs moved, and in how many artifacts:**

```
 42 engine/medicham2-browser.js      11 engine/mc_key.js            2 engine/tags.js
 41 data/engine-data.js              11 data/smogon-priors.json     2 data/policy-weights-joint.json
 40 engine/board.js                   9 data/policy-weights.json    2 data/mechanics-census.json
 40 data/tags.json                    8 engine/lookup.js            1 engine/durable-ingest.js
 36 engine/champions_sim.js           6 engine/rollout_r1.js        1 engine/conformance.js
 35 data/abra-tags.js                 5 engine/fit_policy.js        1 engine/tag_dex.js
 35 data/move-priors.json             5 engine/diff_swarm.js        1 data/games.bo3.raw-logs.jsonl
 33 data/move-effects.js              4 data/games.bo3.jsonl        1 engine/leaf_engine_contrast.js
 24 engine/rollout_leaf.js            4 engine/game_differential.js 1 engine/miltank.js
                                      3 data/games.ladder.jsonl     1 engine/mega_decision_census.js
                                      3 data/protocol-events.json   1 engine/board_state.js
                                                                    1 engine/quarantine.js
                                                                    1 engine/engine_release.js
                                                                    1 engine/joint_rows.js
```

**The composition, which is the answer to "how many are wire-ladder's problem":**

- **Overwhelmingly engine-driven, not store-driven.** The top nine causes are all frozen-release
  SOURCE files. `engine/medicham2-browser.js` alone appears in 42 of the 54. It moved
  2026-08-22 02:05; `data/engine-data.js` 01:46; `data/abra-tags.js` 00:49 — i.e. last night's
  ENGINE work. `engine/board.js` (40) and `data/tags.json` (40) are older moves (2026-08-19 and the
  last `tag_dex` run). These are not defects and they are not a treadmill: they are the expected
  consequence of the engine changing, and the artifacts under them genuinely need re-running once
  the MEDICHAM gate opens. That is ROADMAP #57 and it is already the plan.
- **The self-moving-input class is small: six artifacts.** `data/wire-ladder.json`,
  `data/state-ladder.json`, `data/store-validation.json`, `data/dusk-size-gate.json`,
  `data/diff-swarm.json`, `data/mega-decision.json`.
  - Only **two** are unsafe *purely* for a self-moving input: `store-validation.json`
    (`games.ladder.jsonl` + `games.bo3.jsonl`) and `dusk-size-gate.json` (`games.bo3.jsonl` +
    `games.bo3.raw-logs.jsonl`). Both of those genuinely describe the store as of a moment, so
    "the store moved" is a legitimate and cheap re-run signal for them, not a mis-declaration.
  - **Two** are MIXED and are the real instance of the defect — the two ladders, which declare
    pinned inputs as live ones.
  - **Two** (`diff-swarm`, `mega-decision`) are mixed store + engine and are ordinary #57 work.

So: the wire-ladder pattern accounts for **2 of ~54**, not for the bulk. The bulk is the engine
moving, which is the system working.

### 2.4 The ratchet — `data/provenance-stamp.json`

**`engine/provenance.js` was not run.** It has no `module.exports`; the CLI is the only entry point,
and it WRITES `data/provenance-stamp.json` (`:1525`) on every plain run. That file was rewritten at
**02:37**, four minutes before this was checked, by the ENGINE agent's own chain — so running it
would have been a second writer on a file another agent was writing, while reading five artifacts
that agent was mid-rewrite. Reported and not run. **The canonical 24/1/116/85/0 must be re-derived
from `engine/provenance.js` once the ENGINE chain finishes.**

The trajectory below is a stable read — `git show <commit>:data/provenance-stamp.json` across the
148 commits that touched it.

| commit date | `mtime_only` | `verified` | `graph_files` | `discoveries` |
|---|---|---|---|---|
| 08-04 18:44 (first) | 90 | 0 | — | 0 |
| 08-06 15:23 | 91 | 1 | — | 0 |
| 08-09 19:21 | 129 | 5 | 161 | 2 |
| 08-11 16:25 | 153 | 2 | 190 | 21 |
| 08-21 21:18 | 167 | 2 | 224 | 34 |
| 08-22 02:27 (HEAD) | **169** | **2** | 224 | **36** |

**Is it moving in the right direction? No — and the escape hatch is why.**

Its own note says *"mtime_only_files may SHRINK and may never grow"*, with one exception: a recorded
DISCOVERY, i.e. the checker learning to see artifacts it could not see before. **It has grown from 90
to 169 and has never once shrunk, and all 36 growths went through the exception.** Reading the
`discoveries` array, the reasons are near-identical boilerplate — *"the writer scan gained coverage…
1 path variable"*, *"1 write line"*, *"1 DECLARED BY THE ARTIFACT"* — fired 36 times in 18 days,
three of them in the last 24 hours (167 → 168 → 169). A ratchet whose exception fires on a schedule
is not ratcheting; it is logging.

Two things must be said fairly, because the number is not as bad as 90 → 169 alone reads:

- The DENOMINATOR grew too, 161 → 224 visible artifacts. As a fraction: 129/161 = **80.1%** on
  08-09, 169/224 = **75.4%** today. Marginally better, essentially flat.
- `verified` is **not** a count of stamped generators and must not be read as one — it counts
  artifacts that are stamped AND whose stamps currently all match. It has oscillated 1, 2, 3, 13 and
  sits at 2 today largely because the engine moved last night and knocked stamped artifacts out of
  agreement. Its fall from 13 (08-18) to 2 is engine movement, not a loss of stamping.

The load-bearing statement, which neither caveat softens: **roughly three quarters of a 224-artifact
graph is still checked by mtime alone.** That is the method that marked the void 7,100-game WOBBUFFET
run `ok` on 2026-08-04, and the count of files resting on it has gone up every single week since the
ratchet was created.

---

## 3. What is owed

Nothing here was fixed. Four items, none of them runnable in a tree another division is writing:

1. **`verify()` must not let a fixture-identity mismatch swallow the table verdict.** Accumulate
   instead of returning at the first gate; `tableDigest()` is fixture-independent. Needs a red-first
   test — `tests/test-feature-semantics.js` currently never exercises that gate. §1.5.
2. **`data/policy-weights.json` must NOT be restamped** until the refit. The damage table under it
   moved and eleven named columns moved with it. §1.1.
3. **The remedy string for `data/wire-ladder.json` is wrong.** All 13 of its releases lack
   `natureL50`, so the generator cannot run at all. `provenance.js`/`status.js` should say
   STRANDED, and the figure stays withheld under CLAUDE.md §12, not "re-run this". ROADMAP #109. §2.1.
4. **`wire_ladder.js` must declare what it READ, not what it WATCHED.** Otherwise any future ladder
   is UNSAFE within the hour of finishing, for reading a copy it deliberately made. Same for
   `data/state-ladder.json`. §2.2.

---

## Reproduction

```bash
# §1.3 — the decisive experiment. Nothing in the repo is modified; the stamp-era fixture and
# board.js are staged into a scratch dir with their relative requires rewritten to absolute.
git show bb66821:engine/feature_fixture.js  > $S/fixture_at_stamp.js       # then absolutise requires
git show bb66821:engine/board.js            > $S/board_at_stamp.js         # then absolutise __dirname
tools\lownode.cmd $S/replay.js $S/fixture_at_stamp.js            # old fixture + HEAD board
tools\lownode.cmd $S/replay.js $S/fixture_at_stamp_oldboard.js   # old fixture + stamp-era board

# §1.4 — the damage table diff, over exactly the fields tableDigest() hashes
git show bb66821:data/engine-data.js > $S/engine-data-at-stamp.js
node $S/dumpmc.js $S/engine-data-at-stamp.js   # vs  node $S/dumpmc.js data/engine-data.js

# §2.1 — the stranding, re-measured rather than quoted from ROADMAP #109
node engine/engine_release.js compat engine/medicham2-browser.js natureL50
```

Scratch files are in this session's scratchpad and were all created this session.
Nothing in `data/`, `engine/`, `tests/` or `docs/` was modified except this file.
