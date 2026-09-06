# RUNNING NOTES — every change, in the same pass, between major releases

**This page is the living-docs pass now.** Will, 2026-09-06: *"we can update the documents every
major release and just keep a running notes page in between change the documentation rules"*.

- **Every change writes a row here, in the same pass as the code, with the same rigour as the white
  paper.** Figures trace to an artifact. A number that has been superseded is struck out, not
  softened. A quarantined figure is withheld, not captioned.
- **The full living-document set — white paper, deck, technical docs, `SUMMARY.md`, `MODELS.md`, and
  every PDF — is folded in on a MAJOR release**, from the rows below.
- `CHANGELOG.md` and the version bump are unchanged. This page is additional to them, not instead.

**This is not a handoff document and it is not state.** It is a LOG: append-only, newest first, never
edited to agree with today. `node engine/status.js` remains the only statement of what is true now,
and `docs/HANDOFF-*.md` is what happens to a page that forgets that.

**What is owed to the next major is derived, never counted by hand:**

```bash
node engine/docs_scan.js --owed     # the backlog, and how close it is to the cap
node engine/open_work.js            # prints the same block beside the open register rows
```

The backlog is every row below that is newer than the lowest unpinned version header among the living
documents, plus everything still under `[Unreleased]`. It empties itself when the major pass bumps
those headers. `tests/test-docs-current.js` FAILS when the backlog goes over the cap, when this page
is missing, and when git shows a commit that moved code without moving this page.

---

## How to write a row

Copy this shape. Four lines is a good row; a paragraph is a report and belongs in `docs/_reports/`.

```
## [5.267.0] — 2026-09-06 — one line naming what moved
- **What changed.** The mechanic, the instrument, or the document. Name the file.
- **Measured.** <figure> — `data/<artifact>.json`, n=<sample>, against <baseline>.  Or: NO FIGURE.
- **Supersedes.** ~~<old figure>~~ retracted — it stood in `docs/<doc>.md` and has been DELETED there.
- **Owed to the next major.** Which living document has to absorb this, or `none`.
```

Three rules about the figures in a row, all of them already enforced elsewhere:

- **Cite the artifact by name.** A figure attributed to an artifact that does not contain it fails
  the citation clause of the documentation gate, on this page exactly as on the white paper.
- **Write a retraction as a strikethrough with the word `retracted` on the same line.** That is the
  form the derived retraction registry reads. Once a row here retracts a figure, any living document
  still stating it as fact fails the build — which is the point: **deferring the documentation pass
  never defers a retraction.** The stale number comes OUT of the white paper in this pass; only the
  rewrite waits for the major.
- **A quarantined figure is not written here at all.** A caption is not a quarantine.

---

## [5.267.0] — 2026-09-06 — a condition with no residual order sorts below every numbered handler
- **What changed.** `engine/medicham2-browser.js`. `stall`'s duration is spent at the FOOT of the residual walk — it carries no `onResidualOrder`, so `comparePriority`'s `order || 4294967296` (`sim/battle.ts:405`) sorts it below every numbered handler, and a residual that KILLS never reaches the decrement. Second fix: the sleep timer took the caller's dice stream — `slp.onStart`'s `sample([2,3,3])` is drawn inside `BattleActions#secondaries`, addressed `sec` by the middle arm, and this engine drew it under `any`.
- **Measured.** Board-material **27 → 22 of 961**, protocol **93 → 91**, narration level 70, census 830/830/0 — `data/game-differential.json`, release `ab22bc503717`, `--games 1200` (961 played), `--turns 20`, arm `middle`, `empirical-click/v1`, pool `0d103fb9fa87`. Uncaused board partings 5 → 2. Probes `tests/probe_stall_uncaused.js` and `tests/probe_status_clock_dice.js`, each shown RED under its own knob first.
- **Supersedes.** Board-material ~~27~~ and protocol ~~93~~, both from release `57679ef9a4a3`. Three claims in the dispatching brief were wrong and are corrected here: Rapid Spin's partial-trap clause ALREADY has a probe (landed 5.265.0, `live: true` in the census); freeze is NOT board-material on its accusing game (`board_div` null, `any` and `acc` logs 4/4 and 13/13 SHARED, refuting an address mismatch) and belongs to the narration gate; and a new `sleeppowder` ACCURACY divergence at t15 was found where both engines asked the SAME address.
- **Owed to the next major.** The white paper, the deck, `docs/SUMMARY.md` and `docs/MODELS.md` all still publish the superseded 27 / 93.


## [Unreleased] — 2026-09-06 — the division ledgers stop getting PDFs, and tonight's rules are written down

- **What changed.** `build/build_pdfs.js` now excludes the division ledgers from the PDF set, under a
  stated rule — *a division ledger is a working document and gets no PDF* — derived from
  `.claude/agents/*.md` rather than a typed filename, and printed on every run so the exclusion can
  prove it ran. The five ledger PDFs are untracked (`git rm --cached`, files left on disk) and ignored
  via a new `docs/.gitignore`; the root `.gitignore` was not touched, because another agent holds it.
  `CLAUDE.md` and `.claude/skills/start/SKILL.md` gained tonight's operating rules: the `--games` flag
  is part of the sample definition, the capped divergence lists are not the population, the clause is
  not the field whose name looks right, a receipt is written from the path the run opened, deleting a
  tracked file recovers no history, the 100 MB push wall and its date, and why a history rewrite is
  unavailable.
- **Measured.** No model figure moved. The repository figures are derived from git, not from an
  artifact, and the commands are in the report: the five ledger PDFs hold **132.4 MB of a 524.28 MiB
  pack**, `docs/ENGINE.pdf` alone **108.4 MB across ten versions**, and one rebuild pass over the five
  costs **16.6 MB of pack, 13.9 MB of it ENGINE**. **The saving is entirely future — untracking them
  recovers zero bytes of existing history.** `node build/build_pdfs.js --check` went from 4 documents
  to rebuild to 2, both pre-existing and neither a ledger; it exits 1 before and after.
- **Supersedes.** Nothing. No published figure changed value.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` describe the
  publishing procedure and must record that division ledgers carry no PDF.

---

## [Unreleased] — 2026-09-06 — the documentation rule itself

Rows written before the release that carries them. The publish pass renames this heading to the
version it lands as. **An `[Unreleased]` row COUNTS as owed** — a heading nobody remembers to rename
would otherwise be a debt that never appears, which is the failure the backlog exists to refuse.

- **What changed.** The documentation rule itself. `CLAUDE.md` now requires this page per change and
  the full living-document set per major release; `tests/test-docs-current.js` gained the notes-page,
  major-release and owed-backlog clauses; `.githooks/pre-commit` blocks a commit that moves code and
  records nothing here; `engine/docs_scan.js` derives the backlog and prints it under `--owed`.
- **Measured.** NO FIGURE. The reason for the change is a cost, and it is stated where the rule is —
  `CLAUDE.md`, with the PDF and repository sizes that were measured on 2026-09-06.
- **Supersedes.** Nothing. No published figure changed value in this pass.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` describe the
  documentation procedure and will need the new rule; the white paper and the deck do not state it.

---

## Backlog at the moment this page was created

Nothing was owed. The full living-document set was published at 5.266.0 on 2026-09-06 and every
unpinned living document carried that header when this file was written, so the first major release
after it starts from a clean floor rather than inheriting an untracked debt. That is luck of timing,
not a property of the design, and it is recorded here so a later reader does not read the empty
backlog as evidence that the mechanism was never exercised.
