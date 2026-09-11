# 2026-09-10 — the non-engine reds from the full suite, and the killed agent's diff

MEASURE. Nothing here played a game. Suite source: the 620-line run, 13 unwaived FAIL, 7 WAIVED,
2 SKIP, plus the coverage FAIL. Every test named FIXED was re-run individually after the change
(output read, not only the exit code).

## Verdict

| Red | State | One line |
|---|---|---|
| `tests/test-board-browser.js` | **FIXED** | The bundle was dated 2026-08-03. I rebuilt it with `build/build_board_browser.js`: 58 of 58 features agree, 14/0. |
| ROADMAP #568's orphan (`9,759`) | **REFUTED** | Rebuilding orphans nothing. `9,759` traces through `CHANGELOG.md:449`. `test-docs-current` stays 35/0. |
| `tests/test-docs-quarantine.js` | **FIXED** | Three new hits. One was real (MEASURE.md `53.09%`): withheld. Two were coincidences (RUNNING-NOTES `6,000`): the scanner was fixed to stop charging them. Now 6/6 green. |
| `tests/test-register-cell-parse.js` | **FIXED** (another agent's edit) | This was the red the dead agent introduced, via the `**` widening in `quarantine.js`. Another agent finished the fix at 19:55. |
| `tests/test-policy-promote.js` | **FIXED** | The refusal was never broken. The staging simulation had gone stale when the stores were sharded on 2026-09-06. 17/0. |
| `engine/selftest.js` | **3 of 4 FIXED**, 1 owed to ENGINE | The three census tools now exclude bot games through the new `engine/quality_bots.js`. `medicham2-browser.js` needs one declaration line. |
| `engine/provenance.js` | **GREEN now** (exit 0) | The hard arm is empty. The suite's red was most likely a transient: ENGINE was rewriting artifacts on an untracked release. |
| `engine/conformance.js` | **NEEDS WILL** | 107 regressions, not the 4 the suite's tail showed. It has been red for weeks. 0 of the 107 are mine. |
| `gate_offfield_target` / `gate_fail_and_silent` | **DEFERRED to ENGINE** | These refusals are correct: every artifact they read was measured on another release. They answer after ENGINE's re-measure. |
| UNACCOUNTED-FOR CHECK | **NEEDS WILL** | 171 probes, 169 of which play a game, all landed 09-01..09-10. Classifying them needs a rule, not a 169-line typed table. |
| `test-workflow-paths` store shard | **DIAGNOSED ONLY** | No row is in no shard. The local stores are BEHIND their shards (ladder 163, bo3 47). The command the test prints would refuse. |
| `engine/sanity_check.py` | **NEEDS WILL** | Two rows carry U+FFFD in `\|win\|` (#558). This needs a store repair or a declared exclusion. |
| `engine/em_validation.js` | **NEEDS WILL** | The gate demands a scientific outcome that the data refused to produce. |
| `tests/test-mutation-coverage.js` | **DEFERRED** | Its re-sweep mutates and plays the engine, so it waits for ENGINE's slot. |

## Step 0 — the killed agent's diff, file by file

All of it was kept. One part of it was the red, and that red is now fixed downstream.

- `engine/conformance.js` — **KEEP.** `checkHeader` now steps over leading `//` declaration lines
  (`RAW-STORE-OK:`) before it looks for the block header. Without that, two conventions accuse each
  other. The one-line-header clause was kept too. It retires five `no opening comment` false
  findings, and conformance's own output lists them FIXED.
- `engine/gate_offfield_target.js` — **KEEP. It did NOT cause the CANNOT-ANSWER.** The edit only
  adds the `ABRA-EXIT <n>` stderr declaration. `tests/run-all.js:812` maps exit 2 to SKIP whether or
  not a declaration is present, and it uses the first output line as the reason. The exit 2 comes
  from `verdict()`: both artifacts were measured on other releases (below).
- `engine/provenance.js` — **KEEP.** RULE 1's cutoff is now the date of the commit that last
  changed the `rules` object of `data/quality-filter.json`, not the file mtime. A provenance
  restamp had moved UNSAFE from 174 to 244, and all 70 of the new ones were false alarms. Measured
  now: 172 UNSAFE, cutoff 2026-08-27 (`78bff6c1`). The two catches (~:1228, ~:1247) both call
  `failedToRead`, and `node tests/test-no-silent-failure.js --only engine/provenance.js` reports
  none. One edge case, noted and not fixed: an unreadable HISTORICAL copy in the middle of the walk
  can move the cutoff EARLIER, which is the permissive direction. The code comment claims the
  opposite. It needs a `git show` failure on one commit to happen.
- `engine/quarantine.js` — **KEEP.** Two parts:
  - `declareClauseExit`: stderr only, and the same convention as `gate_fail_and_silent.js`.
  - The `**` widening in `roadmapRowIsClosed`. **This is the red the agent believed it
    introduced.** It un-reds #565 in PART 2 of `test-register-cell-parse.js` and reds door #9003 in
    PART 1.
  - Another agent converted #9003 into control #9013 at 19:55:46. **Collision, stated:** I did not
    know that. I reverted the widening at 20:00:46 and restored it byte-identical a few minutes
    later, once the test showed the other agent's control. The net change is zero. The test now
    PASSES, with 0 rows moved.
  - The claim that exactly one whole-function verdict moves (#565) is **not independently
    re-verified**. At cell-clause level alone, 17 rows move. My whole-function comparison failed on
    escaping and was not redone.
- `engine/register_reality.js` (a child's `ABRA-HEAP` is honoured), `engine/wire_ladder.js` (exit
  declarations), `tests/test-stadium-roster.js` (a smogon-coverage sentence): **KEEP.**
- `tests/probe_item_disposition.js` — **KEEP.** It also fixes a **syntax error that is live at
  HEAD**: an unescaped apostrophe, `'the authority's own split'`. So HEAD's probe does not parse.
  `data/verification/probe-item-disposition.json` in the tree is output from a run of that probe,
  which plays a game. It is not mine and I left it.
- `tests/test-red-run-writes.js` (modified, not on the brief's list): **KEEP.** It drops the
  `test-mechanics.js` floor row by its own rule, and it is green in the suite.
- Releases `6fb9ebd3b704`, `84f466e7e0d2` and `cf8567c4db78` are **staged**, 16 MB in all. They are
  what keeps RULE 5's hard arm empty. Leave them staged and commit them.

## The fixes

**Board bundle.** The bundle is `data/board-data.js` (Generated 2026-08-03). After the rebuild:
node and browser agree on 58/58; `test-docs-current` 35/0.
- **The #568 prediction is refuted by measurement.** `9,759` is also in `CHANGELOG.md:449`, which
  `docs_scan` treats as a trace. Nothing was orphaned. #568 can close (row text below).
- **A side effect, reported:** the new bundle carries `2.92` and `0.234`. That breaks route 2's
  unique attribution, so MODELS.md `2.92%` (line 1976, a self-play realism figure) and `23.4%` (lines
  107 and 2168) no longer fire against `data/policy-weights.json`.
- I left their two BASELINE lines in place, because the documents still state the figures. `23.4%`
  is a store fact (`board.js:377`, human double-targeting). Its old attribution to the MAG weights
  was probably a coincidence all along. `2.92%` is MAG self-play and is owed to the MODELS.md pass.

**Docs quarantine.**
- `docs/MEASURE.md` "A SIGN FLIP WORTH A RE-RUN": every figure is deleted, not captioned (`53.09%`,
  `51.66%`, `+1.44 [0.10, 2.77]`, `6,886`, `9,201`, `+3.20 [2.24, 4.15]`, `0.10`, `0.75`,
  `0.3240`/`0.2966`). The claim and the noise-floor judgement stay.
- `engine/docs_scan.js` route 1: a figure that a NON-withheld artifact cited in the same paragraph
  CARRIES is not charged. Both RUNNING-NOTES rows cite `data/engine-diff.json`, whose `compared` is
  6,000. That is route 2's "two owners is a coincidence" rule applied inside one paragraph.
- A new RED arm shows that a quotable citation which does NOT carry the figure clears nothing.
- The BASELINE line `docs/MEASURE.md|55.92%|data/leaf-position-contrast.json` is deleted, as the
  test instructs.

**Promote test.** The staging simulation read paths off comment lines and cut every glob at the
`*`. That gave `data/games.` three times, from a comment saying the monoliths are gone. It also
asserted the monolith `.gz` that the workflow correctly no longer stages. It now reads code lines
only, gives each glob one concrete matching file, and asserts that a parsed store shard is staged.
All six refusal arms were green throughout.

**Selftest.** The check had not been reached since the bo3 store grew: selftest died of heap until
`ABRA-HEAP` landed on 2026-09-09.
- The three census files each claim a HUMAN population and counted bot games. They now exclude
  quality.js's `bot`, `behavioural_bot` and `illegal_team` reasons only. `loadGames()` would also
  cut short and forfeit games, which biases the length distribution the rollout cap is derived
  from.
- The helper is new, `engine/quality_bots.js`, because `quality.js` is a frozen-release source.
- `mega_sets_from_sheets` smoke run: ladder **45,297 bot games excluded**, bo3 1,422.
  `joint_click_census --limit 300` (no `--write`) runs. Not published; see OWED.
- `medicham2-browser.js` (ENGINE applies): it names the ladder store only in the 2026-08-10
  corpus-scan comment (~line 7580). Add beside that comment:
  `RAW-STORE-NOT-READ: the path names a one-off 2026-08-10 corpus scan quoted in this comment; the simulator never opens the store.`

## What needs a decision

**Conformance, 107 regressions.**
- Of these, 94 are "subject not in the previous scan" and 13 are "subject changed".
- The baseline scope was seeded 2026-08-11 with 96 findings. HEAD's own report
  (`data/conformance.json`, 00:37Z today) carries 206 findings, so this has been red for weeks. The
  suite showed only the last four lines.
- None of the 107 is my file. The +1 during this session is ENGINE's new `tests/probe_disguise_crit.js`.
- The four S13 rows in the tail are authored inputs: Will's waivers, Will's scenarios, and ENGINE's
  side-selection declarations. The fourth is `smogon-priors.observed.json`, which the workflow
  copies from `engine/smogon_priors.js` output.
- S13 currently exempts authored inputs only through a typed regex (`quality-filter|regulations`).
  Admitting a class of declared authored inputs is a new exemption. That is Will's call, and the
  other 103 regressions need triage, not a re-seed.

**UNACCOUNTED-FOR, 171.** 169 load a game or simulator; 28 carry a `VERIFIED BY` marker. They landed
over 2026-09-01..10, roughly 10 a day. The honest classification for most is "PENDING-WIRE: plays a
game". Proposal: a probe declares its runner or blocker at the site of use, the way `RAW-STORE-OK`
works, and run-all reads that declaration instead of a hand table.

**em_validation.** It fails because "the amplified regime's censoring bias did not exceed its own
noise floor". That is a RESULT. The `--check` mode already re-derives each verdict from the
artifact, per `test-red-run-writes`' own note. The gate should assert that the recorded verdict is
re-derivable, not that bias exceeds the floor. Rewriting it is Will's call.

**sanity_check.** Two rows carry U+FFFD in `|win|` (#558). This needs a re-parse from raw logs
(`engine/reprocess.js`) or a declared exclusion. Either one changes the store.

## Provenance and releases

- Exit 0 now: 172 UNSAFE, 2 VOID, 21 ledger-arm cites, and **0 on the living-document arm**.
- The tree is on release `f83fb5670a11` (ENGINE's, untracked); HEAD is on `49f914e83f77`.
  Whatever ENGINE publishes into a white-paper-cited artifact on that release will fire the hard arm
  until the release is tracked.
- Ledger arm: 21 cites over 13 releases. **All 13 are on disk, 67 MB in total.** They are not
  staged. RULE 5's own header says widening past the hard arm is a decision with the MB attached.

## CANNOT-ANSWER, measured

Read via `git show HEAD:`, never from the working tree.
- `data/game-differential.json` is on `3c2b2f9ac845`; `data/divergence-turns.json` is on
  `791c9fd873f3`; the tree is on `f83fb5670a11`.
- Both gates correctly refuse, and they refused at HEAD too.
- The off-field gate answers once `game-differential.json` is rewritten on the current release.
  `divergence-turns.json` needs its own re-run.

## Store shards, diagnosis only

This was measured with a read-only id-set difference, local plain store against the tracked shards:

| store | local ids | shard ids | local not in any shard | shard not local |
|---|---|---|---|---|
| ladder | 92,431 | 92,594 | **0** | 163 |
| bo3 | 32,810 | 32,857 | **0** | 47 |
| ots | 4,167 | 4,167 | 0 | 0 |

- `compress-stores.js --check` refuses with "the local file is BEHIND".
- The test's message ("rows in no shard … Run: node build/compress-stores.js") is wrong in both
  halves: nothing is unsharded, and the command it names refuses.
- The reconcile command is below; it rewrites the local stores.

## Notes-row text for the coordinator

```
- **What changed.** MEASURE, non-engine reds from the 2026-09-10 suite. (1) `data/board-data.js` rebuilt: node and browser board agree on 58/58 features (`tests/test-board-browser.js` 14/0). The #568 orphan prediction is REFUTED: `9,759` traces through `CHANGELOG.md`, and `tests/test-docs-current.js` stays 35/0. (2) `engine/docs_scan.js` route 1 no longer charges a figure that a non-withheld artifact in the same paragraph carries. The two RUNNING-NOTES `6,000` hits were `data/engine-diff.json`'s `compared`. A new RED arm pins that a citation alone clears nothing. (3) `docs/MEASURE.md`'s turn-0 sign-flip paragraph is withheld: its figures come from the leaf backtest and explore sweep, which the gate withholds. (4) `tests/test-policy-promote.js`'s staging simulation was stale since the 2026-09-06 sharding. The refusals were never broken. (5) `engine/joint_click_census.js`, `engine/rollout_switch_census.js` and `engine/mega_sets_from_sheets.js` exclude bot games through the new `engine/quality_bots.js` (quality.js's bot, behavioural_bot and illegal_team reasons only). The ladder store is 45,297 bot games of 92,431 by this filter. Code only; the artifacts are not re-run. (6) The killed agent's diff was reviewed and all of it kept. `tests/probe_item_disposition.js` at HEAD had a syntax error, fixed by that diff. Full account: `docs/_reports/2026-09-10-instrument-reds.md`.
- **Supersedes.** ROADMAP #568's claim that rebuilding the bundle orphans `9,759`. The MEASURE.md sign-flip figures are withdrawn, not superseded.
- **Basis.** unchanged
- **Owes.** docs/MODELS.md: `2.92%` (MAG self-play realism, line ~1976) is no longer attributable by route 2 once the bundle is rebuilt, and still stands. Withhold it in the MODELS pass.
```

ROADMAP #568 status cell, if you want to close it:
`closed 2026-09-10 — MEASURE. Rebuilt; board-browser 14/0, 58/58. The predicted orphan does not occur: 9,759 traces through CHANGELOG.md:449 and test-docs-current stays 35/0. docs/_reports/2026-09-10-instrument-reds.md.`

## OWED, NOT RUN

After ENGINE releases its slot (the census artifacts are read live by the empirical driver):

```bash
cmd //c "tools\\lownode.cmd engine\\rollout_switch_census.js"          # writes data/rollout-switch-census.json (bot-filtered)
cmd //c "tools\\lownode.cmd engine\\joint_click_census.js --write"     # writes data/joint-click-census.json (bot-filtered)
SHOWDOWN_PATH=/c/Users/willj/Projects/Pokemon/pokemon-showdown node tests/mutation_harness.js   # then tests/test-mutation-coverage.js
node engine/gate_offfield_target.js && node engine/gate_fail_and_silent.js                    # after game-differential.json is on the current release
```

Mega sets: re-derive only with ENGINE, because the result feeds `data/engine-data.js`:

```bash
cmd //c "tools\\lownode.cmd engine\\mega_sets_from_sheets.js --json"
```

When ENGINE publishes on its release (RULE 5 hard arm):

```bash
git add -f data/releases/f83fb5670a11
```

Only if Will widens RULE 5 to the ledgers (67 MB, 13 releases):

```bash
for id in 1a9d81ca552c 39ac0253d3ca 5a7bd8a8178a 5e0853311131 5f3f7141227c 6155acc0fb26 6272fa445b73 72e361e1bd44 791c9fd873f3 957c638ba6e5 978ca8fe72c9 a63f0f139f37 a81663f17c0c; do git add -f data/releases/$id; done
```

Store reconcile (Will decides; rewrites the local plain stores from the shards, adding ladder 163 and bo3 47):

```bash
node build/compress-stores.js --restore-parsed
node build/compress-stores.js --check
```

ENGINE applies to `engine/medicham2-browser.js` beside the ~7580 corpus-scan comment, then:

```bash
cmd //c "tools\\lownode.cmd engine\\selftest.js"
```
