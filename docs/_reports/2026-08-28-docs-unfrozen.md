# The documents are unfrozen, the sprint notes are deleted, and five gate clauses went blank on a line ending

2026-08-28 · MEASURE · CHANGELOG 5.205.0

## What was updated

| document | what landed | PDF |
|---|---|---|
| `docs/ABRA-whitepaper.md` | sprint close-out section, the die arithmetic and its table, the void ruling, the withheld set, the four caveats | rebuilt |
| `docs/ABRA-deck-plain-english.md` | the same in plain English, including "we are refusing to tell you and here is why" | rebuilt |
| `docs/ABRA-technical-docs.md` | the same in ASD-STE100, one instruction per line | rebuilt |
| `docs/SUMMARY.md` | close-out section, a quotable/withheld table, and the MEDICHAM row's Status cell | rebuilt |
| `docs/MODELS.md` | MEDICHAM's ledger entry for the whole sprint | rebuilt |
| `docs/DAMAGE-STAGES.md` | no stage moved; re-read at 1696/1696 exact; the crit and event dice named as the battle loop's | rebuilt |
| `docs/MEASURE.md` | the division section for this pass — the stranding, measured | rebuilt |
| `docs/ENGINE.md` | short section: the CRLF stranding recurred, remedy is ENGINE's | rebuilt |
| `docs/OPS.md`, `docs/SEARCH.md` | `status.js --write` restamp only | rebuilt |
| `CHANGELOG.md` | 5.205.0 entry | — |
| `data/docs-currency-baseline.json` | six `MEDICHAM SPRINT PAUSE` pins retired | — |

All six version-headed documents now read **5.205.0 · 2026-08-28**, matching the CHANGELOG top.

## The sprint notes are deleted and the full rule is re-armed

`docs/MEDICHAM-SPRINT-NOTES.md` removed with `git rm` (tracked, therefore recoverable). Two
suppressions ended with it:

- `engine/docs_scan.js#sprintActive()` exempted the log from the figure clauses while it existed.
- `.githooks/pre-commit`'s SPRINT clause substituted a sprint row for the full living-docs pass.

The six version pins in `data/docs-currency-baseline.json` were retired in the same pass, as their own
reason text required (*"these pins must be retired in that same pass"*).

Gates after the change, all run unpiped:

```
tests/test-docs-current.js        EXIT 0   23 passed, 0 failed
tests/test-roadmap-register.js    EXIT 0
tests/test-artifact-rerunnable.js EXIT 0
python portfolio/build/check_projects.py   ABRA: all twelve artefacts yes, changelog 5.205.0
```

One new untraceable figure was caught by the gate and fixed rather than baselined: `16777619`, the
FNV-1a prime, written into a formula. It is a constant of the hash, not a measurement, so it is now
written as `0x01000193`. The display-math block it lived in was also off-convention — this document
writes every other formula as inline code with unicode, and the PDF builder renders no LaTeX, so the
`$$` block appeared as raw source in the PDF people actually read. Rewritten in house style and the
PDF re-checked with `pdf-inspector`.

## THE FINDING: the gate read 7 of 8 this morning and reads 5 of 8 now, with no engine byte changed

The three deliberate-roster stages, the whole-game differential and the staged-mechanics comparison
were all written at 09:56–09:58Z stamped engine release `5f3f7141227c`. The tree now hashes to a
different release, so `engine/status.js` calls every count in them *"an answer about other bytes"* and
withholds them.

Exactly ONE of the twenty-six frozen sources moved — `data/tags.json`, mtime 10:06Z. The release keeps
a **copy**, not a checksum, so the two can be compared directly:

```
data/releases/5f3f7141227c/data/tags.json   799,498 bytes
data/tags.json                              842,110 bytes
raw equal?                 false
CRLF-normalised equal?     true
JSON deep-equal?           true
```

A checkout under `core.autocrlf = true` rewrote `tag_dex.js`'s LF output as CRLF between the runs and
now. **`docs/ENGINE.md` documents the identical event on 2026-08-26** and predicted the recurrence in
those words. The hazard is standing rather than closed: `git diff` currently warns *"LF will be
replaced by CRLF the next time Git touches it"* on every living document too.

**Nothing was done to make the gate read 7 of 8.** Restoring the file to LF would edit an input so a
ruler prints the wanted number, and would produce a release id no checkout reproduces. The remedy is
ENGINE's and is the one already on the record: cut over the bytes a checkout produces, then re-run.

## Figures WITHHELD rather than written

Withheld from all six documents, and confirmed withheld afterwards — `engine/quarantine.js` re-run
under `tools/lownode.cmd`, `citation_sites` **unmoved at three entries**
(`docs/ENGINE.md`, `web/build-status.js`, `web/publish-rule.js`), `gate_open` false, 5 failing clauses
before and after:

- the whole-game differential rate, its diverged count, its game count and its class composition;
- board-material, in every form;
- all three deliberate-roster stages and their red-demonstration columns;
- the staged-mechanics diverging counts;
- every downstream figure already under quarantine — leaf calibration, R1–R4, exploitability, the
  weights.

The brief's orientation figures (gate 7 of 8, whole-game 1 of 961, board-material 0 of 961, roster
139/129/475) are among these and **were not written into any document.**

## Figures published, each with its bound stated in the same sentence

| figure | artifact | bound written beside it |
|---|---|---|
| 780 probed / 780 live / 0 missing; 780 armed, 0 unarmed, 0 threw, 0 hollow | `data/mechanics-census.json` | a LAB — one staged scenario per mechanic, usage-blind. Answers *is this correct*, never *does this matter* |
| 6000 compared / 6000 agreed / 0 disagreed, and 0 at each of the sixteen band indices separately | `data/engine-diff.json` | its own `scope` is damage only — no items, abilities, turn order, status duration or switching — and `skipped_multihit` 134 with `skipped_ability_multihit` 17 means **it has never applied a multi-hit move** |
| 1696/1696 exact, 0 at the wrong stage, 5 re-derived `CH_EXACT` overrides, 0 wrong | `tests/test-damage-stages.js`, re-run green this pass | the stage chain only |
| 33 compared / 4 declared / 43 in neither list, 25 live at the boundary, over 500 moves + 201 abilities + 148 items | `tests/probe_uncompared_leaves.js`, run this pass | **"the boards match" is a claim about 33 leaves of 80** — written into all six documents as the largest caveat in the set |
| die: max circular shift 0.0351571 vs ~0.5; consecutive arrivals sharing a damage bucket 89.5% vs 6.25%; lag-1 autocorrelation 0.8873 vs ~0; marginal hit rate 0.9214 vs 0.9 | the sprint log's own table, carried forward | an instrument repaired, not a regression: whole-game 3 → 14, board-material 1 → 12 |

## The void ruling, and how it was written

Every figure that passed through the event die before 2026-08-27 is **VOID, not stale** — the two
engines were compared over a narrower slice of outcome space than the comparison claimed, so an
agreement is not evidence of one. The documents state this **once, governing**, at the top of each,
and the old paragraphs stay in place as dated history under it. No per-figure asterisk was added:
*"the figure must be WITHHELD, not annotated"*, and a document with a hundred asterisks is a document
whose asterisks are skipped.

## Quarantine, stated as two facts and not resolved

`data/quarantine-stamp.json` reads `gate_open` false; the computed condition is not met. Will's
narrower bar of 2026-08-22 — board-material zero plus a clean roster, narration as its own gate
afterwards — was met by the last measurements before the stranding, but **the gate was never re-cut to
test that bar.** Both facts are written into all six documents. Neither is resolved there, because
resolving it is a ruling and a code change, not a sentence.

## OWED, NOT RUN

- **The re-run that lifts the stranding.** `tests/roster.js` at all three stages,
  `engine/game_differential.js` and `engine/all_mechanics_fire.js`, over a release cut on the bytes a
  checkout produces. Explicitly out of scope for this pass. Until it exists, five clauses say nothing.
- **The CRLF hazard itself is standing, not closed.** Second occurrence in three days. No register row
  was filed by this pass; ENGINE owns the remedy.
- **The MAG refit.** `engine/status.js` still reports it OWED with `feature_fixture --check` failing on
  both the fixture identity and the damage table (318 → 322 species, digest `405c836793d1` →
  `1bda9df11d73`). Gated behind the engine, not behind compute. Not started; a refit needs Will's
  go-ahead.
- **Leaf calibration — this division's one number — remains QUARANTINED and unmeasured.**
  `data/winrate-backtest.json` stays stale behind the gate. The standing priority is untouched by this
  pass and is not claimed otherwise.
- **28 PDFs elsewhere in `docs/` remain stale or missing** (`node build/build_pdfs.js --check`). Only
  the ten documents this pass touched were rebuilt; the rest predate it and were left alone.
- **`check_projects.py` exits 1 on CHOMP**, not on ABRA — `changelog 2.5.0 vs file 2.9`. Pre-existing,
  another project, reported not touched.
- **`docs/MEASURE.md` is 379 KB and `docs/ENGINE.md` is 2.4 MB.** Both are append-only ledgers with no
  compaction policy. Not a defect today; it will become one.
