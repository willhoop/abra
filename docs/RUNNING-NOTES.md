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
