# 2026-09-11 — The five living documents said the MEDICHAM gate is open; it is closed. Dated corrections, no figure withheld

MEASURE. No games played. This is a historical record (CLAUDE.md on `docs/_reports/`): not maintained,
not current state — current state is `node engine/status.js` and `node engine/open_work.js`. Nothing was
committed or pushed, per the brief.

## Verdict

| | value | source |
|---|---|---|
| gate at finish | `GATE: CLOSED — 2 of 9 GATING clauses fail` | `node engine/quarantine.js`, HEAD `bf2d594f`, run 2026-09-11T12:34:00–12:34:13Z (first read 12:21:36–12:21:48Z, identical) |
| failing clause 1 | *no open, known engine defect* — `10 OPEN roadmap row(s) name an instrument that is RED`: #535, #529, #318, #348, #375, #380, #412, #425, #467, #511 | same |
| failing clause 2 | *mechanics / each one staged and compared against showdown* — `9 of 16 DIVERGING MECHANICS ARE PLAYED AND UNCLEARED` | same |
| passing | the other seven, including both whole-game clauses (board-material 0 of 961, narration 0 undeclared) | same |
| withheld set | 87 of 256 artifacts downstream of MEDICHAM | same |
| pinned pool | `state.games` 961, `state.games_board_never_diverged` 961, `games_void_excluded` 0, `turns_cap` 50 | `git show HEAD:data/game-differential.json`, generated 2026-09-11T11:23:47.994Z, release `aefcb93baf14` |
| documents corrected | 5 — 75 insertions, 7 deletions | `git diff --stat` |
| figures withheld | **none** | see "Quarantine consequence" |
| `tests/test-docs-current.js` | **37 passed, 0 failed** before and after | runs at ~12:1x and after the edits |
| `tests/test-docs-quarantine.js` | **red before and after, identical**: 1 check failed, 46 flagged lines, the same set with line numbers ignored | diff of the two outputs |

The 7 deletions are three `Last updated` dates and four long lines (three SUMMARY table rows, one MODELS line)
where a dated sentence was inserted into the line. No dated text was removed or reworded.

## Sites corrected

Each correction is dated 2026-09-11 and sits beside the 6.0.0 statement, which stays as dated evidence.

| document | site | what it said | correction |
|---|---|---|---|
| `docs/ABRA-whitepaper.md` | head, above the 6.0.0 block | "AND THE GATE IS OPEN"; "MEDICHAM IS CORRECT"; "prints GATE: OPEN … 40 LIFT / 24 STAY" | four paragraphs: the gate reading and both clauses; why it closed; the pool unmoved; the quarantine consequence |
| same | leaf calibration paragraph (§ on the backtest) | "The gate is now OPEN, so the artifact is RE-RUNNABLE … quotable on one command" | withheld by the gate; needs the gate AND the re-run |
| same | limitation 6 (R1/R2/R3) | "The gate is open, so those artifacts are RE-RUNNABLE rather than quarantined" | withheld by the gate again |
| same | limitation 7 (exploitability) | "NOW BY DECISION … The gate opening released nothing here" | withheld by the gate as well as by decision |
| same | limitation 8 (engine speed) | `data/medicham-speed.json` "lifts on a re-run" | withheld by the gate |
| same | header | Last updated 2026-09-10 | 2026-09-11 (version stays 6.0.0) |
| `docs/ABRA-technical-docs.md` | head | "THE GATE IS OPEN"; "It prints GATE: OPEN" | GATE / CAUSE / POOL / QUARANTINE, in STE |
| same | header | Last updated 2026-09-10 | 2026-09-11 |
| `docs/SUMMARY.md` | head, above the 6.0.0 table | "NOTHING ELSE GATES THIS MAJOR"; gate row "9 of 9 clauses PASS — OPEN" | a correction table in the same shape |
| same | leaf/engine contrast paragraph | "At 6.0.0 the gate is OPEN, so this artifact is RE-RUNNABLE" | withheld by the gate |
| same | components table, MEDICHAM Status cell (a CURRENT-STATE table by its own text) | "The MEDICHAM gate reads OPEN at 6.0.0 — 9 of 9" | the cell now leads with CLOSED; the 6.0.0 reading follows, labelled dated |
| same | components table, MEDICHAM Headline cell | win-probability gap "lifts on a re-run" | withheld by the gate |
| same | components table, MAG row | "at 6.0.0 that is a DECISION rather than a gate" | both a gate and a decision |
| same | Measurement validity table, click censoring | "the artifact lifts on a re-run" | withheld by the gate |
| `docs/MODELS.md` | head | "THE DISTANCE TO THE GATE IS ZERO AND THE GATE IS OPEN"; "nine PASS"; "NOW A DECISION RATHER THAN A GATE"; leaf calibration "needs one command and no permission from the gate" | two paragraphs; the last claim is retracted by name, because it is this division's number |
| same | MEDICHAM section, above "MECHANICS STATE, 6.1.0" | "`node engine/quarantine.js` reports the gate OPEN" | a dated MECHANICS STATE paragraph |
| same | MAG Method line | "6.0.0 — THE CORPUS SIZES ARE STILL ABSENT, AND IT IS NOW A DECISION" | a gate as well as a decision |
| same | header | Last updated 2026-09-10 | 2026-09-11 |
| `docs/ABRA-deck-plain-english.md` | head | "THE SIMULATOR PASSES"; "About 40 older results stop being blocked" | five plain-English paragraphs |

**Deliberately not corrected:**
- "gate OPEN" in the 5.207.0–5.209.0 blocks, which record an earlier opening and are superseded in their own text;
- every conditional "becomes quotable when the gate opens AND …", which is still true;
- the `Version 6.0.0 · 2026-09-10` date in the SUMMARY and deck headers, where the date sits beside the version and reads as the release date.

No version header moved: this pass is the retraction, not the fold-in owed at the next major.

## How the figures in the corrections are bound (the traceability ratchet)

- **The gate readings are verbatim quotes of the tool's output in code spans** (`GATE: CLOSED — 2 of 9 GATING
  clauses fail`, `10 OPEN roadmap row(s) …`, `9 of 16 DIVERGING MECHANICS …`), each with the command, HEAD and time.
  `engine/docs_scan.js`'s `figuresInText` returns nothing for a code span or a time, which was checked before writing.
  No artifact stores today's gate reading: `data/quarantine-stamp.json` is from 2026-09-10T23:44:15Z.
- **740, 783 and 845** bind to the CHANGELOG 6.14.0 entry, which each paragraph that uses them names.
- **961** binds leaf-exact to `data/game-differential.json` (`state.games` 961, `state.games_board_never_diverged` 961).
- **The count of withheld artifacts (87) is not typed into any document.** Each correction names `node engine/quarantine.js`
  instead, because that count is printed state.
- "twenty", "ten", "eight", "four" and "seven" are counts taken from CHANGELOG 6.13.0/6.14.0 and the tool output. They are
  written as words in prose that already cites those sources.

## Why the gate closed — what the corrections say, and the evidence

- CHANGELOG 6.13.0: twenty register rows that asserted a defect with nothing checking them gained a deciding probe.
  On `aefcb93baf14` ten read RED (`docs/_reports/2026-09-11-integration.md`, Batch 0 table).
- CHANGELOG 6.14.0: the staging planner is inside the harness. Staged mechanics that fired went from 740 to 783 of 845.
  Eight new partings were registered (#593–#600): four board (Oblivious/Taunt, Magic Bounce/Spite, Super Luck or Scope
  Lens after Focus Energy, mega stone under Klutz) and four narration (Cute Charm, Own Tempo, Sweet Veil, Covet).
- No fix introduced these defects. They were in the engine at 6.0.0, and nothing staged them. The documents say both:
  the instrument improved, and the defects are real. "MEDICHAM is correct" is withdrawn as a statement about the engine.
- The middle arm of the pinned pool did not move (961/961), and the documents say so. The corner arms are not restated
  in the corrections. The 6.0.0 block's 16 and 15 stay there as dated figures; the 6.14.0 notes row records 1 and 2 on
  the current release.

## Quarantine consequence, checked

- **Nothing was released as quotable at 6.0.0.** Every "re-runnable" / "LIFT" site in the five documents was read.
  Each says that none of the 40 was re-run and that its figure is absent. Those sites now say the artifact is withheld
  by the gate, and no figure was present to delete.
- **The MODELS 6.1.0 MEDICHAM block** cites only instruments (`data/engine-diff.json`, `data/mechanics-census.json`,
  `data/game-differential.json`). None of them is on today's withheld list.
- **The `tests/test-docs-quarantine.js` flags in these five documents** are nine figures (348,595 / 243,467 / 173,784,
  one line in each of the five documents, fifteen flags in all). All are in the **3.78.0** block, cite
  `data/nature-arms.json`, and were written 2026-08-08 (`git blame`: `af69da4b`).
  `data/nature-arms.json` is **absent** from `data/quarantine-stamp.json`'s quarantined list (64 entries, 2026-09-10T23:44:15Z)
  and **present** in today's 87. So the withheld set has grown since that stamp, and that growth is what makes them fire.
  6.0.0 did not lift them, so they fall outside this brief. Whether `nature-arms.json` belongs in the withheld set is
  the question the other MEASURE agent is diagnosing. **Left in place and reported, not deleted.** If that diagnosis
  confirms the artifact is downstream, these figures must come out of all five documents (delete, never caption).

## Side effects of this session

- `data/provenance-stamp.json`: the only change is its `generated` field, 12:10:26Z → 12:21:30Z. This session's
  baseline doc-test runs finished just before 12:21:36Z, so one of them is the likely writer (both read the stamp).
  It was left in place.
- The PDF build rebuilds every PDF older than its source. Besides the five PDFs here, it also rebuilt
  `DAMAGE-STAGES.pdf`, `KADABRA-coach-spec.pdf`, `ORIENTATION.pdf` and `ABRA-Orientation.pdf`, which were already stale.
  `ROADMAP.md` and `RUNNING-NOTES.md` are excluded by the script. Result: `9 built, 0 failed`, exit 0, 12:35–12:36Z.
- `tests/test-docs-current.js` was green against the **working tree**, which includes another MEASURE agent's
  uncommitted edits to `engine/docs_scan.js` and `tests/test-docs-current.js`.

## Notes-row text (for the ENGINE agent, who owns `docs/RUNNING-NOTES.md`)

```
## [6.15.0] — 2026-09-11 — the five living documents stop saying the MEDICHAM gate is open; it closed at 6.14.0, and each now says so in a dated correction

- **What changed.** `docs/ABRA-whitepaper.md`, `docs/ABRA-technical-docs.md`, `docs/ABRA-deck-plain-english.md`, `docs/SUMMARY.md` and `docs/MODELS.md` carry a dated correction above the 6.0.0 headline block, and at each of eleven body sites that stated the gate open or an artifact re-runnable as a present-tense fact. The 6.0.0 text stands as dated evidence. PDFs rebuilt. No version header moved: this is the retraction, not the fold-in.
- **Measured.** `node engine/quarantine.js` at HEAD `bf2d594f`, `2026-09-11T12:34Z`: `GATE: CLOSED — 2 of 9 GATING clauses fail` — `10 OPEN roadmap row(s) name an instrument that is RED` and `9 of 16 DIVERGING MECHANICS ARE PLAYED AND UNCLEARED`. `data/game-differential.json` (release `aefcb93baf14`) state.games 961, state.games_board_never_diverged 961.
- **Supersedes.** The present-tense claims "the gate is open" and "MEDICHAM is correct against the official simulator on the pinned pool" in the 6.0.0 headline blocks, and the 6.0.0 split of the downstream artifacts into ones that lift and ones that stay: every artifact downstream of MEDICHAM is withheld by the gate again. The 6.0.0 reading itself is not struck, because it was true on release `cbd510bc2b13`. No figure is withdrawn: 6.0.0 re-ran and published none.
- **Basis.** unchanged.
- **Owed to the next major.** Fold the correction into the rewritten headline sections. `tests/test-docs-quarantine.js` is red before and after this pass on the identical 46 flags; nine of them are the 3.78.0 `data/nature-arms.json` figures in these five documents (2026-08-08), which 6.0.0 did not lift and this pass did not remove, pending the withheld-set diagnosis.
```

It is written without `~~…~~` on purpose. A row that strikes a figure and says "retract" registers that figure
as retracted (`engine/docs_scan.js:887`, `:2665`), and the documents are told to delete it. That would contradict
keeping the 6.0.0 block as dated evidence. What is retracted here is a claim, not a number.

## CHANGELOG text (for the ENGINE agent, who owns `CHANGELOG.md`)

```
## [6.15.0] — 2026-09-11

### Fixed
- **The white paper, the deck, the technical documentation, the summary and the model ledger no longer say
  the MEDICHAM gate is open.** It closed at 6.14.0, when new instruments found ten live defects and eight new
  mechanics that part from the official simulator. The gate now fails 2 of its 9 clauses. Each document carries a
  dated correction above its 6.0.0 headline and at every place that stated the gate open or a withheld result
  re-runnable. The 6.0.0 text is kept as dated evidence. The instruments improved; the engine did not get worse,
  and the defects they found are real. The 961 real ladder games still show no board difference. Everything
  downstream of MEDICHAM is withheld again. No published figure is withdrawn, because 6.0.0 re-ran none of them.
```

Version: the next free MINOR when the ENGINE agent writes it. It is 6.15.0 only if nothing lands first. It is a
MINOR, not a PATCH, because a published reading (the gate) moves. The basis is unchanged: same gate, same clauses,
and a reader can be told "9 of 9 passing became 7 of 9".

## OWED, NOT RUN

The notes row and the CHANGELOG entry above. The pre-commit hook will refuse these five documents without the notes row.

```bash
# ENGINE agent: paste the two blocks above into docs/RUNNING-NOTES.md and CHANGELOG.md, then
node tests/test-docs-current.js
```

`node engine/status.js --write` was not run, because it restamps generated blocks in ledgers the ENGINE agent owns (`docs/ENGINE.md`).

```bash
node engine/status.js --write
```

Re-check the green against committed code once the other MEASURE agent's `engine/docs_scan.js` / `tests/test-docs-current.js` edits land:

```bash
cmd.exe /c "tools\lownode.cmd tests\test-docs-current.js"
cmd.exe /c "tools\lownode.cmd tests\test-docs-quarantine.js"
```

If the withheld-set diagnosis confirms `data/nature-arms.json` is downstream, delete the 3.78.0 figures 348,595 / 243,467 / 173,784 from all five documents:

```bash
grep -n "348,595\|243,467\|173,784" docs/ABRA-whitepaper.md docs/ABRA-deck-plain-english.md docs/ABRA-technical-docs.md docs/SUMMARY.md docs/MODELS.md
```

Before these corrections are quoted again, re-read the gate. An ENGINE agent is fixing these defects now:

```bash
cmd.exe /c "tools\lownode.cmd engine\quarantine.js"
```
