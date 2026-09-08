# Three runs on a settled tree — board-material, the register, and the gate

MEASURE, 2026-09-08. Tree `97d7b389`, clean at the start, no other agent live.
Nothing in this pass edited an engine source. Nothing was committed.

---

## THE HEADLINE

| | expected before the run | measured |
|---|---|---|
| board-material | 0 of 958 | **0 of 958** |
| narration (gate clause) | 53 | **53 of 961**, 52 causes |
| register verdicts vs the mid-edit artifact | unknown | **123 of 123 identical, 0 changed** |
| register verdicts vs the 2026-08-27 baseline | unknown | **37 genuinely changed** |
| gate | — | **7 of 9 clauses FAIL**; 5 of the 7 are staleness, 2 are measured |

Both Job-1 predictions were written down before the run and both held.

---

## JOB 1 — THE WHOLE-GAME DIFFERENTIAL AFTER THE `champions_sim` SEAM CHANGE

### A release was required, and this says why

`data/engine-release.json` pointed at `f0f10cd06861` (cut 05:41Z, latest cut 06:31Z).
`engine_release.drift('f0f10cd06861')` on the settled tree returned three SOURCE files:

```
["engine/medicham2-browser.js", "engine/rollout_leaf.js", "engine/champions_sim.js"]
```

Two of the three are real. `engine/rollout_leaf.js` differs by **14 lines** (commit `94d997a4`,
09:51 — the ability-control fix) and `engine/champions_sim.js` by **108 lines** (commit `97d7b389`,
10:14 — the `dexFor()` refusal and the `Dex` Proxy). The third is not a change at all; see the
line-endings finding below.

So a release was cut on the settled tree:

```
1415f271058e   first frozen 2026-09-08T16:10:12Z   27 files
  8bdea30dbb42  engine/medicham2-browser.js
  d00e77a7ac26  engine/rollout_leaf.js
  5e5d21bf1fb1  engine/champions_sim.js
  showdown      20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4
```

### The sample line, in full

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
node engine/game_differential.js --steering empirical --release 1415f271058e --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 50 --team-store data/team-pool-frozen \
  --dump-games 200 --dump-out data/verification/batchQ-settled/dump.json --write
```

`--games 1200` and `--turns 50` are part of the SAMPLE DEFINITION, not a budget. Run through
`tools\lownode.cmd`. **961 played, 958 readable, 3 void (`low-identity`), 0 games cut off by the
turn cap**, elapsed 130.8 s. Arm `middle`, `empirical-click/v1`,
`mode = A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`,
census pin `9446a684709d` (`pinned: true`), team store `data/team-pool-frozen`, pool digest
`0d103fb9fa87` (8,778 teams, 1,968 picked), driver code `49cc7bf27fb2` over 11 files,
`driver_code_stable: true`, `planted_divergence_proof_ok: true`.

### The numbers

Read from `data/game-differential.json`, generated `2026-09-08T16:15:01Z`:

```
TURNS whose end-of-turn board is IDENTICAL   10675/10675   100.0%
GAMES whose board NEVER diverged             958/958       100.0%
BOARD-MATERIAL GAMES                         0/958   (the bar: state.games less state.games_board_never_diverged)
games CUT SHORT by the turn cap of 50        0/958
for comparison, the PROTOCOL rate            904/961   94.1% of games agreed
```

The bar is `state.games` (958) less `state.games_board_never_diverged` (958). It is **not**
`by_cause_totals.games_board_material`, which reads 3 on this artifact — the two differ by the
games the by-cause attribution can reach and the bar's void exclusion, exactly as documented.

Narration, from the gate clause: **53 of 961 = 5.5%, across 52 causes** — 54 narration-only raw,
less 1 declared, less 0 cleared on decision impact.

### Nothing moved, and the sample is provably the same sample

| | release | driver code | games | diverged | narration raw | by-cause board-material | **bar** |
|---|---|---|---|---|---|---|---|
| previous (`git show HEAD:data/game-differential.json`) | `f0f10cd06861` | `81b6bca47dab` | 961 | 57 | 54 | 3 | **0 of 958** |
| this run | `1415f271058e` | `49cc7bf27fb2` | 961 | 57 | 54 | 3 | **0 of 958** |

Checked rather than assumed: the `first_divergences` list is **identical game-for-game, all 57**;
the class table is identical; the `errors` block is the same single entry (`p1 choice rejected …
Floette's Protect is disabled`, pre-existing, unchanged); `mode` and `pins.digest` are identical;
the pool digest, team count, picked count and census pin are identical.

**The identity proof the previous agent left in place is corroborated by a measurement.** The seam
change is a no-op for the played sample.

Three driver files legitimately moved with commit `97d7b389` and are recorded:
`engine/engine_release.js`, `engine/game_differential.js`, `engine/names.js`.

---

## FINDING — TWO CONTENT DIGESTS MOVED FOR LINE ENDINGS ALONE

Reported, not fixed.

**1. `engine/medicham2-browser.js`.** Release digest `9a54ee6881cf` → `8bdea30dbb42`. The snapshot
under `data/releases/f0f10cd06861/` is LF (0 CR bytes); the working-tree file is CRLF (43,530 CR
bytes). A CR-insensitive diff is **0 differing lines**. The simulator function did not change. The
file was reverted at some point before this session (it was `M` in the opening `git status` and
clean by the first tool call), and a `git checkout --` on this box rewrites with `core.autocrlf`.

`status.js` already separates this correctly and says so in every stale clause:

> WHY THE DIGEST MOVED: 2 of 3 moved source(s) really changed — engine/rollout_leaf.js,
> engine/champions_sim.js; 1 other(s) differ only in line endings (engine/medicham2-browser.js).

**2. `data/protocol-events.json` — the alignment axis.** `steering.alignment_inputs[0].digest`
moved `7c9de3868d6f` → `2638eb253525` between the two runs. The file is **clean in git** and
unmodified since `db3d518b`; `generated`, `rows` (50) and `derived_from_medicham2` are identical in
both artifacts. Demonstrated:

```
sha256(file as-is, CRLF)        = 2638eb253525    <- this run
sha256(file LF-normalised)      = 7c9de3868d6f    <- the previous run
```

This one matters more than the first, because `engine/arms_comparable.js` compares that digest
unconditionally and would answer NOT COMPARABLE on the alignment axis for a pair of runs whose skip
list is byte-identical in content. `.gitattributes` carries `text/eol=lf` for
`data/rollout-switch-census.json` only; neither of these two files is covered.

This is the inverse of the hazard MEASURE.md's skip-list section argues against: not a stamp that
fails to fire, but a digest that fires when the FUNCTION has not moved. Routing is not mine.

---

## JOB 2 — `data/register-reality.json` REGENERATED ON THE SETTLED TREE

```
node engine/register_reality.js      (via tools\lownode.cmd)
```

Generated `2026-09-08T16:34:05Z`, 123 rows, `distinct_commands_run: 73`, exit 0.

### `tree_state` landed

```json
"tree_state": {
  "head": "97d7b3894ab64e9b4def2b304cd22431fa839fe1",
  "dirty_at_start": ["M data/engine-release.json", "M data/game-differential.json"],
  "dirty_at_end":   ["M data/engine-release.json", "M data/forme-assert.json",
                     "M data/game-differential.json", "M data/mechanics-census.json",
                     "M data/provenance-stamp.json"],
  "moved_during_the_run": true,
  "settled": false,
  "read_error": null
}
```

**It lands, and it reads `settled: false` — and both operands need naming rather than a caption.**

- `dirty_at_start` is two DATA artifacts written by Job 1 in this same session (the release pointer
  and the differential). **No engine SOURCE is in it.** The tree was clean of hand edits.
- `moved_during_the_run: true` is **self-inflicted, and structurally so**. The three files that
  appeared are written by instruments `register_reality.js` itself runs. The diffs are one line
  each:
  - `data/forme-assert.json` — `generated` only.
  - `data/mechanics-census.json` — `generated`, plus one Monte-Carlo detail string
    (`Iron Head 19.1% → 19.9%`, control `Rock Slide 26.4% → 27.3%`, 6,000 turns each). No row was
    added or removed.
  - `data/provenance-stamp.json` — `generated`, and the ratchet `verified: 2 → 3` (Job 1's
    release-stamped differential is the third).

So **`settled` cannot read true for this tool as it is built**: it runs 73 instruments, at least
three of which write tracked artifacts, and then asks whether the tree moved. The field is still
worth having — it is what proves no ENGINE source moved — but the `settled` clause is measuring the
tool's own footprint. Reported, not fixed.

### How many verdicts genuinely changed

Three artifacts compared row-by-row on `n → verdict`:

- **A** = `f8716264:data/register-reality.json`, 2026-08-27T20:06Z, 112 rows — the twelve-day baseline.
- **B** = `HEAD:data/register-reality.json`, 2026-09-08T06:44Z, 123 rows — the mid-edit one, no `tree_state`.
- **C** = this run, 2026-09-08T16:34Z, 123 rows.

| pair | shared rows | same verdict | **changed** | only in first | only in second |
|---|---|---|---|---|---|
| A → C | 110 | 73 | **37** | 2 (`#318`, `#403`) | 13 |
| **B → C** | 123 | **123** | **0** | 0 | 0 |
| A → B | 110 | 73 | 37 | 2 | 13 |

**The settled-tree run reproduces the mid-edit artifact verdict-for-verdict.** All 37 changes
against the twelve-day baseline are real; none was a torn read. The 123 rows are now quotable, and
they carry a `tree_state` that says what they were taken on.

The 37, in full:

```
218 EXIT CODE UNDECLARED   -> STALE ROW          319 INSTRUMENT UNRUNNABLE -> STALE ROW
224 EXIT CODE UNDECLARED   -> CONFIRMED          438 INSTRUMENT UNRUNNABLE -> STALE ROW
241 INSTRUMENT CANNOT ANS. -> PREMATURE CLOSE    439 INSTRUMENT UNRUNNABLE -> STALE ROW
258 PREMATURE CLOSE        -> CONFIRMED          440 INSTRUMENT UNRUNNABLE -> STALE ROW
273 INSTRUMENT CANNOT ANS. -> CONFIRMED          471 CONFIRMED             -> PREMATURE CLOSE
290 EXIT CODE UNDECLARED   -> PREMATURE CLOSE
376 EXIT CODE UNDECLARED   -> CONFIRMED
409 PREMATURE CLOSE        -> CONFIRMED          450 PREMATURE CLOSE        -> CONFIRMED
449 INSTRUMENT CANNOT ANS. -> CONFIRMED
INSTRUMENT UNRUNNABLE -> CONFIRMED  (24 rows):
  316 320 322 330 344 448 468 469 470 481 482 483 484 485 486 489 490 491 492 496 497 499
  (plus 218/319/438/439/440 above, which went to STALE ROW instead)
```

Rows only in A: `#318`, `#403`. Rows only in C: `#416 #419 #478 #508 #521 #522 #523 #525 #526
#528 #532 #534 #539`.

Run-level counts: `register_rows 466`, `id_rows 512`, `marked 123`, `open_asserting_breakage 53`,
**`stale_rows 10`**, **`premature_closes 3`**, `unrunnable 0`, `cannot_answer 0`,
`exit_codes_undeclared 1`, `instrument_owed 47`, `markers_rejected 0`.
Final line: `REGISTER REALITY: 14 row(s) disagree with their own instrument.`

---

## JOB 3 — `node engine/status.js --write`

Run last, after Jobs 1 and 2, exit 0. It restamped all five ledgers (`docs/{ENGINE,MEASURE,OPS,
SEARCH,WEB}.md`). Nothing was hand-edited inside a `<!-- GENERATED -->` block.

### The gate, verbatim

```
FAIL  game differential                       MEASURED AGAINST A DIFFERENT ENGINE — data/engine-diff.json ran on
                                              release f0f10cd06861 and the tree is 1415f271058e.
FAIL  deliberate roster / items               MEASURED AGAINST A DIFFERENT ENGINE — data/roster.items.json …
FAIL  deliberate roster / abilities           MEASURED AGAINST A DIFFERENT ENGINE — data/roster.abilities.json …
FAIL  deliberate roster / moves               MEASURED AGAINST A DIFFERENT ENGINE — data/roster.moves.json …
PASS  coverage / every used mechanic is measured by something clean: all 412 moves above 25 clicks
      are measured by the roster or the census
PASS  whole-game differential / BOARD-MATERIAL — games whose boards part
      BOARD-MATERIAL: 0 of 958 games. Every compared turn boundary in every game holds the SAME
      BOARD on both engines. This is the quantity Will named on 2026-08-22 — commentary may
      differ, boards may not — and it is met.
FAIL  whole-game differential / NARRATION — protocol divergence with no board effect
      NARRATION-ONLY: 53 of 961 = 5.5% of games diverge in NARRATION and never part a board,
      across 52 cause(s) (54 narration-only raw, less 1 declared and 0 cleared on decision impact).
      … THIS CLAUSE NOW HOLDS THE GATE SHUT … `gates` is that clause's own verdict, so this flipped
      the moment the boards stopped parting and would flip back if one parted again.
FAIL  mechanics / each one staged and compared against showdown
      MEASURED AGAINST A DIFFERENT ENGINE — data/all-mechanics-fire.json ran on release
      f0f10cd06861 and the tree is 1415f271058e.
FAIL  no open, known engine defect
      1 OPEN roadmap row(s) name an instrument that is RED: #376.
```

Header: `MEDICHAM is not correct — 7 of 9 gate clauses fail`.
Also stamped: `provenance: 184 unsafe, 2 void (declared), 39 possibly stale, 30 ok, 0 missing`
(was 185 / 2 / 41 / 26 / 0), `830/830 probed mechanics live, 0 missing`,
`0/6000 differential comparisons disagree with Showdown`.

### Which failures are measurement and which are staleness

| clause | kind | detail |
|---|---|---|
| game differential | **STALENESS** | `data/engine-diff.json` on `f0f10cd06861`; re-run `node tests/test-engine-diff.js --n 6000 --seed 20260804` |
| roster / items | **STALENESS** | `data/roster.items.json` on `f0f10cd06861` |
| roster / abilities | **STALENESS** | `data/roster.abilities.json` on `f0f10cd06861` |
| roster / moves | **STALENESS** | `data/roster.moves.json` on `f0f10cd06861` |
| mechanics | **STALENESS** | `data/all-mechanics-fire.json` on `f0f10cd06861` |
| NARRATION | **MEASURED DISAGREEMENT** | 53 of 961, 52 causes, on this run's own bytes |
| no open, known engine defect | **MEASURED DISAGREEMENT** | `#376` is open, asserts breakage, and `node engine/quarantine.js --order-probe` exits 1 — `CONFIRMED` in this pass's own register regeneration |

**Five of the seven failures are the direct cost of cutting `1415f271058e`.** They were not failing
on measurement before it; they are answers about `f0f10cd06861`'s bytes. Two of the three drifted
sources really changed, so the re-measurement is genuinely owed and the clauses are correct to
withhold. Board-material and coverage both pass on bytes measured today.

Two clauses appear in the 7 that were not in the previous stamp's 6
(`game differential`, `no open, known engine defect`), and one left it (`BOARD-MATERIAL`, now PASS).
The previous stamp was `2026-09-07 19:51`, taken before the batch-P runs, so it is not a
like-for-like before/after and is not presented as one.

### The `146 abilities` item in the brief

**`status.js --write` could not have fixed it, because it was never generated.** No
`<!-- GENERATED -->` block in any of the five ledgers contains `146` or `139` — checked
programmatically across all five blocks. The stale 146 lives in hand-authored ENGINE-ledger tables
(`docs/ENGINE.md:522`, `:16998` and the dated headings around `:704` / `:831`), which the stamper
does not touch and which MEASURE does not own. `docs/ENGINE.md:247` already carries the
`146 → 139` heading, so the ledger contradicts itself in prose. Routing is not mine.

What the gate prints for that artifact now is not a count at all — `data/roster.abilities.json` is
withheld as measured against other bytes, and only its SCOPE is shown
(`scope.tested 139 of in_scope 202`, `swap_leaf_correction.self_describing_dropped 5344`),
captioned by the tool as *"the harness's shape, not a claim about this engine"*.

---

## THE THREE KNOWN REDS — ALL THREE STILL STAND

**1. `tests/test-docs-quarantine.js` — RED, exit 1, `1 CHECK(S) FAILED`.** Unchanged in cause: two
rows of `docs/RUNNING-NOTES.md` state figures out of `data/search-decision-profile.json`, which
`engine/quarantine.js` withholds (64 artifacts withheld this run). Offending locations as the test
prints them: `docs/RUNNING-NOTES.md:134` (`42773`, `35351`, `20000`) and `docs/RUNNING-NOTES.md:142`
(`20,000`). The test's own control arms pass, including the one that proves a caption does not clear
it. **The figures have to come OUT of those two rows.** This pass added a row and deliberately cites
no withheld artifact, so it adds no offending location.

**2. `tests/test-pinch-family.js` — RED, `1 of 61 FAILED`, exit 1.** The failing clause is the
positive control, section 4: `all five 0-use members are still in the ungated set` /
`ungated set is: firemane`. Pre-existing; every other clause in the file is green.

**3. `status.js` `FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` — still fires**,
first line of the run:

```
the fixture itself changed (rounding 6 -> 6, scenarios 10 -> 12).
the DAMAGE TABLE these weights were fitted against has been regenerated
  (318 species -> 322, digest 405c836793d1 -> 9d289cf77e24).
GATES THAT FIRED: fixture identity, damage table.
```

Untouched. MAG is paused and `data/policy-weights.json` was not opened for writing by anything in
this pass.

---

## NAMED, NOT FIXED

- The two CRLF digest flips above (`engine/medicham2-browser.js`, `data/protocol-events.json`).
- `register_reality.js`'s `settled` clause can never read true, because three of the instruments it
  runs write tracked artifacts.
- The five staleness clauses now owe a re-measurement on `1415f271058e`:
  `tests/test-engine-diff.js --n 6000 --seed 20260804`;
  `tests/roster.js --stage {items,abilities,moves} --reds --write`;
  `engine/all_mechanics_fire.js --kind all --write`.
- `docs/ENGINE.md` states `146` in tables and `146 → 139` in a heading.
- `#376` (three Protect/Detect orderings are exact speed ties) is open, red and confirmed; it is the
  only row holding the open-defect clause shut.
- `docs_scan` warns each run: `data/xatu.js is present but unparsable`.

## WHAT MOVED ON DISK

`data/engine-release.json`, `data/game-differential.json`, `data/register-reality.json`,
`data/forme-assert.json`, `data/mechanics-census.json`, `data/provenance-stamp.json`, the five
ledgers, `docs/RUNNING-NOTES.md`, this report, and a new release under
`data/releases/1415f271058e/`. New untracked directory `data/verification/batchQ-settled/` holds the
200-game dump. **Nothing was committed and no engine source was edited.**
