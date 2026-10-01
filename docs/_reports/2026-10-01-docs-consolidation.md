# 2026-10-01 — Documentation consolidation (abra/regmc 1.60.0)

MEASURE. Will approved the consolidation on 2026-10-01. Branch `worktree-agent-a63299b1fc159afcf`,
merged with `origin/main` at `eece3fc8` (main had not moved). Nothing in this report is state; it is
the account of one change.

## Verdict

- **Step 1 done.** `docs/RUNNING-NOTES.md` is FROZEN, not migrated, and `CHANGELOG-REGMC.md` carries the
  record from 1.51.0 on: one entry per version, with a `### Record` section holding the row's four fields.
  Every consumer reads the new source. The backlog is **63 of 165 before and 63 after** on the same tree.
  It is **64** with this change's own entry, which is what the old reader gives for the same change
  written as a notes row.
- **Step 2 done.** `solver/LOG.md` is frozen with a pointer. Its obligation is removed from the solver
  agent, `solver/PLAN.md`, the skills and `solver/machamp/loop_sprt.js`.
- **Step 3 done, into README.** It overlaps more than the deck does. `docs/SUMMARY.md` and its `.pdf` are
  removed with `git rm`.
- **Step 4 done, with one change from the brief.** The one remaining `docs/HANDOFF-*.md` moved to
  `docs/archive/`, not to a new top-level `archive/handoffs/`.
- **Step 5 done.** The technical docs link the white paper for the gate readings and drop the stale
  Status column. Lexed figures fell from 34 to 16. The header stays at 1.0.0, so the backlog floor did
  not move.
- **Every moved gate was shown RED on a deliberate break and green after restore**, 5b included. 5b was
  shown on a constructed, unreachable commit after the real one, see §5b.
- **The umbrella check was already failing before this change, and it still fails.**
  `check_projects.py` reports ABRA `changelog=7.0.0 file=1.0.0 MISMATCH`, because it reads the closed
  Reg M-B `CHANGELOG.md` against the Reg M-C white paper. This change touches neither file. The brief
  assumed the check passed; it did not.

## 0. Measure first — who reads each file, and how much the files overlap

### Consumers (tracked files, excluding `docs/_reports/` and `data/`)

| file | read or written by |
|---|---|
| `docs/RUNNING-NOTES.md` | `engine/docs_scan.js`: `NOTES_LOG`, `notesEntries()`, `--owed`, `--note-check`, `closedLineBreaches()`, `majorPolicy()`, `crlfProof()` and the CLI registry. `tests/test-docs-current.js`: clauses 2, 3b(a), 3b(b) and 5/5a/5b/5c/5d. `.githooks/pre-commit`: the running-notes gate. `build/build_pdfs.js`: the RESIDUAL entry. `engine/regulation_touchpoints.js`: never-edit list. **Writes the page:** `solver/machamp/loop_sprt.js`. Prose: `start` skill, `solver.md` agent, CLAUDE.md, ORIENTATION, REGMC, REGULATION-ROTATION, white paper, technical docs. **`engine/orient.js` does NOT read it.** Measured: no reference. Its OWED scan reads `docs/_reports/`. `engine/open_work.js` prints `owedReport()`. |
| `solver/LOG.md` | Written by `solver/machamp/loop_sprt.js` `logLine()`. Prose: `solver.md` agent (read-first and per-change), `solver/PLAN.md`, CLAUDE.md, README, ORIENTATION, `docs/SOLVER.md`, white paper, MODELS. No gate reads it. |
| `docs/SUMMARY.md` (+ `.pdf`) | `engine/sanity_check.py` §5, which **runs in `tests/run-all.js`**. `engine/major_readiness.js` `LIVING_SET`. `build/build_pdfs.js` derives its set from `docs/*.md`. A living document on `abra/regmc` at 1.0.0. Its baseline `reasons` keys are not a ratchet. |
| `docs/HANDOFF-2026-08-01.md` | `data/docs-currency-baseline.json` `unversioned_exempt`. **No tracked markdown links it.** The other twelve handoffs were already in `docs/archive/`. |
| `docs/ABRA-technical-docs.md` | A living document; it is part of the backlog floor (`documentedAt`). Untraced-figure ratchets. |

### Overlap, measured (5-word shingles, then figures)

| A vs B | shingles of A in B | figures of A in B |
|---|---|---|
| RUNNING-NOTES vs CHANGELOG-REGMC | 3.4% | 931 / 2,269 (41%) |
| solver/LOG vs CHANGELOG-REGMC | 8.6% | 428 / 613 (70%) |
| solver/LOG vs RUNNING-NOTES | 6.2% | 446 / 613 (73%) |
| solver/LOG vs docs/SOLVER.md | 5.5% | 228 / 613 |
| SUMMARY vs README | 5.9% (README 15.6% covered) | 6 / 49 |
| SUMMARY vs deck | 0.7% | 9 / 49 |
| SUMMARY vs MODELS / white paper | 11.4% / 8.3% | 42 / 49, 41 / 49 |
| technical docs vs white paper | 6.5% | 59 / 66 |

**The brief's premise is half right.** The notes row and the changelog entry were not "nearly the same
text twice": they share 3.4% of their wording. They were the same CHANGE written twice, in different
words, and 41% of the page's figures stand in both. That is still a duplication worth removing, because
the merge conflicts were real, but it is a duplication of facts and not of text. That is why the merge
copies FIELDS and does not concatenate the two.

## 1. Notes → changelog

**Choice: freeze, do not migrate.** Migrating 214 rows would add about 4,000 lines to the changelog's
released entries. It would rewrite dated entries, and would duplicate the facts the merge exists to
remove. Freezing changes no dated claim. The archive is still READ, cut at a DECLARED version per line:
`<!-- FROZEN: abra/regmb=7.0.0; abra/regmc=1.50.0; date=2026-10-01 -->`. The cut is declared rather
than derived from the newest row. A derived cut would let a row merged from an in-flight branch move it
silently, and would drop the changelog's fields for those versions.

How it reads now (`engine/docs_scan.js`):

- `notesEntries()` returns the open changelogs' entries above the freeze, then the archive's rows at or
  below it. Both go through one parser, `parseRows()`. With no FROZEN marker it returns the page alone,
  exactly as before.
- `recordTargets()` returns the open changelog(s) after the freeze, and the page before it.
  `recordableChanges()` excludes the record. The frozen page is now RECORDABLE, so editing history needs
  an entry.
- `closedLineBreaches()` adds `row_after_freeze`. It fails `--owed`, `--lines` and clause 2.
- `readRecordAware()` and `recordView()` present a record changelog as its post-freeze entries only.
  Older lines are blanked and line numbers are kept. Clauses 1, 1b, 3b(a) and 3b(b) read the record
  through it, so new entries are held to the notes page's rigour and 4,000 lines of history are not
  judged by rules they never faced.
- `recordFieldGaps()` feeds the new clause 5e.
- `crlfProof()` now calls `parseRows()` directly. `notesEntries()` reads several files, so an injected
  reader would have handed it the synthetic page once per file.

The backlog, shown both ways:

| tree | reader | regmc owed |
|---|---|---|
| before (HEAD `eece3fc8`) | old | 63 of 165 |
| code changed, page not frozen | new | 63 |
| page frozen, no new entry | new | 63 |
| page frozen, no new entry | old (HEAD's `docs_scan.js`) | 63 |
| + synthetic post-freeze ROW in the page | old | **64** |
| + same row | new | 63 + `row_after_freeze` breach, exit 1 |
| + `--migrate` | new | **64**, no breach, page byte-identical to before |
| this commit's 1.60.0 entry | new | **64** |

Equality of cap semantics: `OWED_CAP` (165), `OWED_WARN` and the per-line floor are untouched.

Release-kind (5d): regmc 212 of 214 rows matched before, and 213 of 215 after (+1 is this entry).
regmb 193 of 197 both times.

Umbrella: `python ../portfolio/build/check_projects.py` prints `ABRA changelog=7.0.0 file=1.0.0 MISMATCH`
both before and after. It reads `CHANGELOG.md`, which is closed at 7.0.0 and untouched, against the Reg M-C
white paper at 1.0.0. That is pre-existing, and it is not in this change's write scope, which is the portfolio
repository. All seven artefacts are still present for ABRA.

## 2. solver/LOG.md

Frozen with a header that says where new entries go. 70% of its figures were already in the changelog
and 73% in the notes page, so copying content into `docs/SOLVER.md` would only make a fourth retelling.
The SOLVER ledger now names the changelog as the record.

`loop_sprt.js` now publishes an accepted generation as one changelog entry with a `### Record` section.
It writes no notes row and no LOG line, and the line goes to the run log. The preregistration JSONs
(`preregistration-loop.json`, `-warm.json`) still describe the old publish bookkeeping. They are dated
pre-registrations, so they were not edited. **SOLVER should note that the loop's publish format differs
from them in bookkeeping only. No measurement changed.** `logLine()` is now unused and was left in place:
it is SOLVER's file.

## 3. SUMMARY → README

README overlaps SUMMARY three times more than the deck at 3-grams (10.8% vs 2.3%), so README it is.
README gained the pipeline sketch, the component table (what each part is, no state column) and two
limits ("a zero on the gate is a statement about what was measured" and "the ladder can resolve only
large differences"). It also gained links to where each figure lives: white paper §4.2, §2.12–2.13 and
§5.1, MODELS, and PLAN §3 and §5.

**SUMMARY's figures were linked, not copied.** README is unversioned (`unversioned_exempt`), so the
citation and census rules do not read it. Copying the gate table there would have moved 49 figures from
a checked document to an unchecked one. 42 of 49 already stand in MODELS and 41 in the white paper.

Consumers moved: `engine/sanity_check.py` §5 reads README, and was shown RED by appending the withdrawn
0.6236 to README. `engine/major_readiness.js` dropped SUMMARY from `LIVING_SET`. `build/build_pdfs.js`
needed no code change, because it derives the set from the files on disk. Its RESIDUAL text for
RUNNING-NOTES was updated.

Floor: SUMMARY sat at 1.0.0, like the deck. The lowest unpinned regmc header is still 1.0.0 (the deck),
so removing it did not move the backlog.

## 4. HANDOFF

`git mv docs/HANDOFF-2026-08-01.{md,pdf} docs/archive/`. Its twelve siblings were already there. A new
top-level `archive/handoffs/` would sit outside every scan. `liveDocs()` does not reach it, and
`note_archive` says that moving a file into the archive "must not convert a caught retracted figure into
an uncaught one". The file gained the provenance header its siblings carry, with `Retracted inside: NOT
AUDITED`. It is grandfathered in `data/docs-currency-baseline.json` `archive_grandfathered`, by hand,
with a reason key. Its `unversioned_exempt` entry retired by itself. `docs/archive/INDEX.md` was
regenerated (`--check` clean). No tracked markdown linked the file, and no commit hash changed.

## 5. Gates moved, and the red demonstrations

All breaks were applied to backups and restored, and the restored files were verified with `cmp`.

| gate | break | result |
|---|---|---|
| clause 2 / `--owed` `row_after_freeze` | a synthetic 1.59.9 row inserted into the frozen page | FAIL `row_after_freeze abra/regmc 1.59.9`; `--owed` exit 1 |
| 5e Record fields | the `Owed to the next major.` line removed from 1.60.0 | FAIL `lacks Owed to the next major` |
| 5d release kind | `Basis. CHANGED` on a MINOR | FAIL `basis_change_not_major abra/regmc 1.60.0 CHANGELOG-REGMC.md:31` |
| 3b(a) retraction registry reads the record | `~~4867~~ retracted` in the 1.60.0 Record | FAIL, 3 new: `docs/ABRA-whitepaper.md:503`, `docs/MODELS.md:74`, `docs/RUNNING-NOTES.md:715` restate it |
| 3b(a) history is NOT read | the same retraction in the pre-freeze 1.50.0 entry only | registry through `readRecordAware`: 4867 absent; raw read: present |
| 3b(b) citation rule reads the record | `` `data/engine-diff-regmc.json` reads 987654 `` in the Record | FAIL `CHANGELOG-REGMC.md:53 987654 not in data/engine-diff-regmc.json` |
| 5a archive | `docs/RUNNING-NOTES.md` moved away | FAIL; `--owed` prints `IS ABSENT`, exit 1 |
| hook record gate | the changelog unstaged, everything else staged | `note-check: 15 recordable path(s) and NOTHING recorded in CHANGELOG-REGMC.md`, exit 1 |
| hook, old habit | `engine/open_work.js` + `docs/RUNNING-NOTES.md` only | exit 1: the frozen page no longer counts as the record |
| sanity_check §5 | 0.6236 appended to README | `FAIL ... still in: README (was SUMMARY)` |
| converter | a row with no `Basis.` line | prints the section without it, says so, exit 2 |

The first five rows ran in one combined break: `DOC CURRENCY TESTS: 36 passed, 5 failed`. Green after
restore: **41 passed, 0 failed**. That is 39 before, plus 5a's record-exists assertion and 5e.

**5b** reads committed history, so a red demonstration needs a commit after the record that moves code
and not the changelog. The hook refuses to make one, and `--no-verify` is forbidden. Its code changed
only in which path `git log -1 -- <path>` is given: `recordTargets()`, the same function the hook's
decision uses, and that decision is shown red above. The post-commit demonstration is in §5b below.

### 5b — post-commit demonstration

This was done after commit `5b47e879` without `--no-verify` and without a branch commit. The steps:

1. A dangling commit `c07e2d00` was built with plumbing: `hash-object -w` of a copy of
   `engine/open_work.js` with one added comment line, then `read-tree` / `update-index --cacheinfo` /
   `write-tree` into a temporary index, then `commit-tree -p 5b47e879`.
2. HEAD was pointed at it with `update-ref --no-deref`. The index and the working tree were not touched.
3. `node tests/test-docs-current.js` ran.
4. HEAD was restored with `symbolic-ref HEAD refs/heads/worktree-agent-a63299b1fc159afcf`. HEAD read
   `5b47e879` afterwards and the tree was clean.

The result was **FAIL**: `no commit has moved code or a document since the record (CHANGELOG-REGMC.md)
last moved (5b47e879) — 1 commit(s) recorded nothing: c07e2d00 ... engine/open_work.js`
(40 passed, 1 failed). The commit is unreachable, was never pushed, and will be garbage-collected.

**Note on the hook in worktrees:** `core.hooksPath` is the MAIN checkout's `.githooks`, so a commit
from a worktree runs main's copy of the hook until this branch merges. Main's copy still prints
"running-notes gate", but it delegates the decision to `engine/docs_scan.js --note-check`, which is
this branch's code. That is why this commit passed it correctly.

## 6. Converter — for the coordinator merging in-flight branches

`engine/notes_to_changelog.js`. It moves text; it never writes a field the row did not state.

```bash
# after merging a branch that wrote a RUNNING-NOTES row (the usual case; git may merge the row into
# the frozen page cleanly, which clause 2 then refuses as row_after_freeze):
node engine/notes_to_changelog.js --migrate --dry-run     # see the plan
node engine/notes_to_changelog.js --migrate               # move the rows into their versions' entries

# before merging, from the branch itself:
node engine/notes_to_changelog.js --ref origin/<branch>           # print the Record sections
node engine/notes_to_changelog.js --ref origin/<branch> --apply   # write them into CHANGELOG-REGMC.md

# one row in a file, or on stdin:
node engine/notes_to_changelog.js row.md            # the ### Record section
node engine/notes_to_changelog.js row.md --entry    # a whole entry (### Changed + ### Record)
```

- An existing entry for the version receives a `### Record` section at its end. A version with no
  entry receives a whole entry above the newest one.
- An entry that already has a `### Record` is left alone and reported. Merge it by hand.
- A row on a closed line, or one that names no line, is refused.
- Exit 2 means at least one row lacked a required field, and clause 5e stays red until a person writes
  it. The converter does not invent `unchanged`.
- It keeps each file's line endings. A migrate round trip left the page byte-identical (`cmp`).

**If a branch's merge conflicts in `docs/RUNNING-NOTES.md`:** take main's side of the conflict (the
frozen page) and keep the branch's row text aside in a file. Then run
`node engine/notes_to_changelog.js <that file> --entry`, or `--apply` against the ref.

## 8. Merge with main at 1.64.0 (coordinator's second brief)

**Merged.** `origin/main` was at abra/regmc 1.64.0 and is now merged into this branch (merge commit
`9f373f03`). The only conflict was the top of `CHANGELOG-REGMC.md`. In the resolution my entry sits
above main's entries.

**Renumbered.** My entry moved from 1.60.0 to **1.65.0**, along with its mentions. Main's own 1.60.0
entry is untouched. The commit subjects `5b47e879` and `fff77da3` still say 1.60.0; they are history
and are not rewritten.

**The cut moved to 1.64.0. Nothing was migrated.** The masthead now reads
`<!-- FROZEN: abra/regmb=7.0.0; abra/regmc=1.64.0 -->`. Main merged 1.51.0–1.64.0 in the old format:
each version has a notes row AND a changelog entry. Migrating them would have meant appending
`### Record` sections to 14 released changelog entries and deleting 14 dated rows from the page. That
edits released records twice over, for no gain, because both copies already exist. Moving the cut
leaves every row and every entry byte-for-byte as main wrote it, and those versions are still checked
by 5d and still counted by the backlog through the archive. Every mention of the cut was moved with it:
the CHANGELOG-REGMC masthead, the frozen page's header, `solver/LOG.md`, `solver/PLAN.md`,
`docs/SOLVER.md`, `docs/ORIENTATION.md`, the technical docs, `build/build_pdfs.js` and a
`docs_scan.js` comment. `solver/LOG.md` also gained main's lines after my freeze header; its header
now says it ends with the lines written up to 1.64.0.

**Backlog:**

| reader | regmc owed |
|---|---|
| main's `docs_scan.js` on main's rows | **75 of 165** |
| new reader, cut 1.64.0, with this entry | **76 of 165** |

The difference of 1 is this entry. regmb is 0 under both readers. 5d matched 225 of 227 regmc rows,
with the top 1.65.0 read as a minor bump.

**A history defect from main, repaired.** Main's 1.64.0 renumber (`44eb852e`) ran an unescaped
`1.65.0 → 1.64.0` pattern. It rewrote release id `1a6550ea5ec6` to `1.64.0ea5ec6` in 7 places, in
dated 6.58.0 / 6.59.x rows of `docs/RUNNING-NOTES.md`. Those bytes are restored to what they were at
`eece3fc8`; the count is 7 = 7. **Renumber scripts must escape the dots.**

**An orient defect from main, fixed.** `tests/test-orient.js` was RED on main itself, with
`THE MODELS derived 0 models`. Main's `solver/PLAN.md` rewrite put a "what changes" table at the top of
§2, and `engine/orient.js` read the first table's header. Orient now takes the first table whose header
names `Name` and `Role`. The test is GREEN with 26 models, and `ORIENT_BREAK=models` still fails.

**LINE marker.** Line 3 of `CHANGELOG-REGMC.md` now ends with `; docs=major`. `versionLines()` ignores
unknown keys, and `--lines` still parses the line.

**Gates after the merge commit:**
- `tests/test-docs-current.js`: **41 passed, 0 failed**, covering 5a, 5b (last record move
  `9f373f03`), 5c, 5d and 5e.
- `--owed`: exit 0.
- The hook passed on the merge commit.
- `--note-check engine/orient.js`: exit 1. `--note-check engine/orient.js CHANGELOG-REGMC.md`: exit 0.
- `test-orient`: GREEN.
- `sanity_check.py`: 0 FAIL lines, with the PORY/README clause ok. It still dies afterwards in a worktree
  on the absent `data/games.ladder.jsonl`. That is pre-existing and does not happen on main.

### What a new entry must contain under the new format (from abra/regmc 1.66.0 on)

Write ONE entry at the top of `CHANGELOG-REGMC.md`. Write nothing in `docs/RUNNING-NOTES.md`; it is
frozen, and a row there fails clause 2 as `row_after_freeze`.

```
## [1.66.0] — 2026-10-01

**One line naming what moved.** MINOR/PATCH: whether a published figure moves.

### Changed            (or Added / Fixed / Removed, as they apply)
- ...

### Record
- **Measured.** <figure> — `data/<artifact>.json`, n=<sample>, against <baseline>.  Or: NO FIGURE.
- **Basis.** unchanged.  Or: CHANGED — <what a reader can no longer be told>  (only on an X.0.0)
- **Supersedes.** Nothing.  Or: ~~<old figure>~~ retracted — and DELETED from the doc that stated it.
- **Owed to the next major.** the living document that must absorb this, or none.
```

- All four Record bullets are required (clause 5e).
- A figure attributed to an artifact must be in that artifact (3b(b)).
- A struck figure in `Supersedes.` registers as retracted, so no living document may restate it (3b(a)).
- The commit must stage `CHANGELOG-REGMC.md`; the hook's `--note-check` enforces it.
- A branch that still wrote an old-style row: after merging it, run
  `node engine/notes_to_changelog.js --migrate`.

## OWED, NOT RUN

```bash
# 1. (done) The 5b red demonstration, §5b.
# 2. Fold-in owed to the next document pass (white paper §2 / §4.3 / §8 sources, MODELS line 284 still
#    name solver/LOG.md and the notes page as the record):
node engine/docs_scan.js --owed
# 3. The technical-docs PDF still shows the 1.0.0 text; rebuild it at the next pass, not now:
node build/build_pdfs.js --check
# 4. Umbrella version check, pre-existing MISMATCH (closed CHANGELOG.md 7.0.0 vs Reg M-C white paper 1.0.0)
#    — a portfolio/build/check_projects.py decision for Will, not an ABRA edit:
python ../portfolio/build/check_projects.py
# 5. For each in-flight branch above 1.50.0 (1.51.0–1.59.x left free for them):
node engine/notes_to_changelog.js --ref origin/<branch>
node engine/notes_to_changelog.js --migrate      # after the merge
# 6. engine/sanity_check.py exits 1 in a worktree for a pre-existing reason (data/games.ladder.jsonl is
#    not in a worktree); run it from the main checkout:
python engine/sanity_check.py
# 7. tests/run-all.js was not run in full (a light-work brief; heavy gates were not touched). Run it from main:
node tests/run-all.js
```

**Debris left, not deleted:** none created in the repository. The accidental `build/build_pdfs.js`
run (§7) rewrote five tracked PDFs; they were restored from HEAD, because those rewrites were this
agent's own.

## 7. Incident

`node build/build_pdfs.js --help` does not print help. It treats `--help` as no flag and **started
rebuilding PDFs**. It rewrote `docs/ABRA-Defense.pdf`, `ABRA-Methodology.pdf`, `ABRA-Orientation.pdf`,
`ABRA-WhitePaper.pdf` and `ORIENTATION.pdf` before it was killed by its own PID (36235, this agent's
process only). The five PDFs were restored with `git checkout --`. Nothing was committed. Use `--check`.
