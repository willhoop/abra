# The documentation rule changed: a ROW every change, the DOCUMENTS every major

2026-09-06. MEASURE. Full account; the verdict was returned separately.

Will, 2026-09-06: *"we can update the documents every major release and just keep a running notes
page in between change the documentation rules"*.

---

## 1. What the rule now says

`CLAUDE.md` section **"Living docs — a ROW every change, the DOCUMENTS every major release"**.

**Every change, same pass, no exceptions:**

- `docs/RUNNING-NOTES.md` — one row: what changed, the figure and the artifact it came from, any
  figure this supersedes, which living document owes the fold-in. Same rigour as the white paper.
- the division ledger, then `node engine/status.js --write`.
- `CHANGELOG.md` and the version bump, unchanged.

**Every MAJOR release — a CHANGELOG entry of the form `X.0.0`, derived, never declared by hand:**

- `docs/ABRA-whitepaper.md`, `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`,
  `docs/SUMMARY.md`, `docs/MODELS.md`, and the PDFs — folded in from the rows accumulated since.

The measured reason is stated where the rule is, not in a report nobody opens: `docs/ENGINE.pdf` is
28.8 MB per rebuild, `.git` is 1.1 GB, pushes were returning HTTP 408, and
`data/games.ladder.jsonl.gz` is 51.8 MB against GitHub's hard 100 MB single-file rejection. The
documents were never the thing at risk; the ability to push was.

**Corroborating evidence found while building clause 5b.** Running the git-history clause against a
long-committed file printed the recordable paths of the last 276 commits. `docs/ABRA-WhitePaper.pdf`
and `docs/ABRA-technical-docs.pdf` appear in nearly every release commit of 2026-09-06 — the churn
Will described is visible in the history, not inferred from it.

---

## 2. How the notes page is gated

Two instruments, one scope function, no second implementation.

| | where | what it refuses |
|---|---|---|
| at the commit | `.githooks/pre-commit`, new "running-notes gate" clause | a commit that stages `engine/`, `tests/`, `web/`, `build/`, a live document or the CHANGELOG and does not stage `docs/RUNNING-NOTES.md` |
| after the commit | `tests/test-docs-current.js` clause 5b | any commit in git history newer than the last commit that moved the notes page, if it moved something recordable |

The second exists because the first can be stepped around with `--no-verify`, and because the hook
cannot see a commit made in another clone. The second reads `git log --name-only` rather than
trusting that the hook ran.

**The scope is decided in ONE place.** `engine/docs_scan.js` exports `recordableChanges(paths)`; the
hook shells out to `node engine/docs_scan.js --note-check $STAGED` rather than carrying a second
regex. Two files that both decide one fact disagree eventually and the disagreement is invisible
because both keep working — the same reason `status.js` shells out to `provenance.js`. Cost is one
node start.

Not recordable, each with a reason: `docs/_reports/` (a findings record is not a change),
`docs/_inbox/` and `docs/_outbox/` (a Cowork draft is a proposal), `docs/archive/` (moving a file
into history changes nothing a reader takes as current), the notes page itself, and `data/`
(a generator re-running is not a documentation event — the hook's own scope guard already says so).

**Deleting the notes page ends nothing.** This is deliberately UNLIKE the MEDICHAM sprint marker,
which was a temporary deferral that ended by being deleted. Clause 5a fails on a missing page.

---

## 3. How the owed-backlog is derived and printed

Derived from three files. Nothing typed except the cap.

```
the notes page   every `## [X.Y.Z] — date — title` heading, plus `## [Unreleased]`
the living docs  the LOWEST version header among the UNPINNED ones = when they were last folded
CHANGELOG.md     the most recent `X.0.0` entry = the last major release
```

`OWED = every notes row above that floor.` It empties itself: the major-release pass bumps the
document headers, every row falls below the new floor, the count returns to zero. Nothing has to be
remembered or cleared — the same self-clearing property as the sprint marker that ended by being
deleted.

Three decisions worth recording:

- **Pinned documents are excluded from the floor.** A pin is a declared freeze (`docs/ARCHITECTURE.md`
  at 1.2, nineteen of them). Taking the minimum over pins would peg the floor at 0.1 forever and
  report every row ever written as owed — a number so large it says nothing, which is the same as not
  printing it.
- **A fenced code block is not a row.** The page carries a copy-this-shape template inside triple
  backticks. Counting it would report a release that never happened; `notesEntries()` skips fences,
  the same refusal `figuresInText` already makes one function up. Verified: with three synthetic rows
  added, the backlog read 3 and not 4.
- **`[Unreleased]` COUNTS as owed.** The first draft said the opposite — that a row is not owed until
  it ships. That is a hole: a heading nobody remembers to rename is a debt that never appears, which
  is precisely the failure the backlog exists to refuse. Counting it is the conservative direction;
  the worst case is a backlog that reads one high for a few hours.

**Printed in three places**, because a backlog nobody sees is not deferred work, it is abandoned work
with a promise attached:

```bash
node engine/docs_scan.js --owed        # the canonical printer; exits 1 if missing or over cap
node engine/open_work.js               # prints the same block beside the open register rows
node tests/test-docs-current.js        # prints it on every run, hook included
```

`open_work.js` is the one CLAUDE.md tells the next session to run, which is why the block goes there
rather than only in a tool nobody would think to invoke. It CALLS `docs_scan.owedReport()` — it does
not reimplement it — and its `catch` prints `NOT DERIVED` with the error, because a missing backlog
otherwise reads as no debt, the one wrong answer this block can give.

**The cap.** `OWED_CAP = 100` in `engine/docs_scan.js`, the single hand-typed value in this change,
and it is argued rather than asserted. Measured on `CHANGELOG.md` today: 266 releases in the 27 days
since 5.0.0 (2026-08-10), median ~10/day, 42 on the busiest. CLAUDE.md records what unbounded drift
already cost — documents four days behind code, and the next session mischaracterised the whole model
family. Four days is exactly what Will has traded away, so the bound cannot be four days; it must
still be a bound. 100 rows is roughly ten working days at the measured cadence. The gate FAILS above
it, and the only ways out are the major-release pass or raising the constant in a diff somebody can
see. A warning fires at half the cap.

---

## 4. A number the notes page supersedes must not read as current

**It is withheld, not annotated, and the machinery for that already existed.**

`engine/docs_scan.js`'s DERIVED retraction registry reads any scanned document for a strikethrough or
a named-prior retraction and then fails the build on any document restating that figure as fact. The
notes page is in `liveDocs()`, so it is scanned. Therefore:

> A row that writes `~~63.2%~~ retracted — superseded by …` makes every living document still stating
> 63.2% fail `tests/test-docs-current.js` immediately, because a new violation is a new ratchet entry.

The consequence is the sentence now in CLAUDE.md: **deferring the documentation pass never defers a
retraction.** The stale number comes OUT of the white paper in the same pass that supersedes it —
deleted, not captioned — and only the REWRITE waits for the major. That keeps the existing rule
intact ("the figure must be WITHHELD, not annotated; printing it with a caveat is the bug") without
adding any new mechanism.

The notes page states the recognised form so authors write it correctly: strikethrough plus the word
`retracted` on the same line. Percentages need three significant figures to register, by the existing
`PCT_SIGFIG_FLOOR` rule — that is not new and is not weakened here.

---

## 5. What was shown RED before being trusted

Five deliberate breaks. Each was reverted and the tree re-verified afterwards.

| # | break | result |
|---|---|---|
| 1 | notes page absent (`node engine/docs_scan.js --owed`) | `DOCUMENTATION DEBT — docs/RUNNING-NOTES.md IS ABSENT`, exit 1 |
| 2 | notes page moved out of `docs/` and the gate run | `FAIL docs/RUNNING-NOTES.md exists` — 25 passed, 1 failed |
| 3 | `NOTES_LOG` temporarily pointed at `docs/DIVISIONS.md` (a long-committed file) | `FAIL no commit has moved code or a document since docs/DIVISIONS.md last did (da53059b) — 276 commit(s) recorded nothing`, each named with its recordable paths |
| 4 | `OWED_CAP` set to 1 and three synthetic rows appended | `3 of 1 *** OVER CAP ***`, `FAIL the backlog owed to the next major is under the cap` — and it read 3, not 4, proving the fenced template is not counted |
| 5 | `lastMajor()` stubbed to `6.0.0` via a `--require` preload, mutating nothing on disk | `FAIL every version-headed document is at or past 6.0.0` naming all six: whitepaper, deck, technical-docs, DAMAGE-STAGES, MODELS, SUMMARY |

**And the hook itself, both ways, against a temporary index** (`GIT_INDEX_FILE` pointed at the
scratchpad, so the real index was never touched — confirmed clean before and after):

- staging `engine/docs_scan.js` alone → **BLOCKED**, exit 1, with the full "how to fix it" message.
- staging it together with `docs/RUNNING-NOTES.md` → `pre-commit: green`, exit 0.

Break 5 is worth noting as a technique: `node --require <patch> tests/test-docs-current.js` overrides
an exported function in the module cache, so a gate can be shown red against a state that does not
exist on disk. Nothing had to be edited into `CHANGELOG.md` to fake a major release.

**A sixth red was not deliberate and is the best evidence of all.** Creating the notes page made
`tests/test-docs-current.js` clause 2b go red on its own — `undeclared unversioned documents: no new
entries (baseline 56, now 57)` — because a new unversioned document must be declared by hand with a
reason. The existing ratchet caught the new file without being told about it.

---

## 6. Every ratchet, before and after

Measured on `data/docs-currency-baseline.json` immediately before the first edit and after the final
green run.

| ratchet | before | after | note |
|---|---|---|---|
| `version_pins` | 19 | 19 | unchanged |
| `unversioned_exempt` | 56 | **57** | the ONLY movement: `docs/RUNNING-NOTES.md`, hand-added with a reason, as the ratchet's own procedure requires |
| `archive_grandfathered` | 25 | 25 | unchanged |
| `known.retraction_violations` | 8 | 8 | unchanged |
| `known.citation_mismatches` | 56 | 56 | unchanged — and the notes page is now INSIDE this scan |
| `known.untraceable_by_doc` | 34 across 5 docs | 34 across 5 docs | unchanged |
| `known.untraceable_figures` | 31 | 31 | unchanged |
| clause count | 24 passed / 0 failed | **30 passed / 0 failed** | six new assertions |

The baseline was NOT rewritten by any green run (`no ratchet movement — left untouched`), so the hook
has nothing to stage and the `changelog_top_at_baseline` provenance key is undisturbed.

**Which checks moved, and in which direction:**

- **STRENGTHENED.** `citationMismatches` now scans `docs/RUNNING-NOTES.md` by name — a figure the page
  attributes to an artifact that does not contain it fails the build, exactly as in the white paper.
  The retraction registry (rule 1, 1b, 3b(a)) and the quarantine clause both cover it automatically,
  because they scan `liveDocs()` and it is a live document.
- **LOOSENED, DELIBERATELY, AND COMPENSATED.** Clause 2's bar moved from the CHANGELOG top to the last
  `X.0.0`. That is the rule change itself. What it stops measuring — how far the documents trail the
  code — is now measured by name and by count in clause 5, gated against a cap, and printed on every
  run. The comment in the test says so, and says that deleting clause 5 without restoring the old bar
  would leave the drift unmeasured.
- **CARVED OUT, WITH A REASON.** The notes page is excluded from clause 3b(c), the untraceable-figure
  census. That clause is a per-document count that may only FALL, and the notes page is append-only,
  so its count can only RISE — including it would build a gate guaranteed to go red for recording work
  faithfully, which is the exact failure the ratchet comment warns about and the same reason the
  MEDICHAM sprint log was carved out on 2026-08-15. The rigour is not lost: the strongest clause
  (3b(b), "the document told you where to check and the file says something else") applies to it.
  No other document lost any coverage; the census still reports the same 34 figures across the same
  five documents.

**Other gates run green after the change:** `tests/test-docs-quarantine.js`,
`tests/test-roadmap-register.js`, `tests/test-no-silent-failure.js --only` on the three edited .js
files, `engine/artifact_audit.js` and `tests/test-artifact-rerunnable.js` (both via the green hook
run), and the full `node engine/docs_scan.js` census CLI.

---

## 7. The umbrella rule — PROPOSED, NOT APPLIED

`C:\Users\willj\Projects\Pokemon\CLAUDE.md` is **outside this repository and is not under git at
all** — `git rev-parse` in `C:\Users\willj\Projects\Pokemon` reports *not a git repository*. It
governs HoopaDex, Event Desks, CHOMP and the portfolio as well as ABRA, so it is Will's call and
nothing has been edited there.

**It does need the change, and there is a live consequence.** Two of its rules now contradict ABRA's:

**(a) "Rule: three places must agree", step 2.** Currently: *"Update the documentation in the same
pass: white paper, deck, technical documentation."* Proposed replacement:

> 2. Update the documentation in the same pass: white paper, deck, technical documentation.
>    **A project MAY defer that pass to major releases if it keeps a running notes page instead.**
>    The trade is allowed only with all three of: a `docs/RUNNING-NOTES.md` updated in the SAME pass
>    as the code; a check that FAILS when code moved and the page did not; and a derived, printable
>    backlog of what the next major owes, capped so it cannot grow silently. ABRA does this —
>    `node engine/docs_scan.js --owed`. A project without all three updates the full set every change,
>    as before. **A deferral never defers a RETRACTION:** a figure the notes page supersedes comes out
>    of the document in that same pass.

**(b) "Rule: one changelog format", the version-equality bullet.** Currently: *"The top version MUST
equal the version stamped on the project's primary artifact."* Proposed replacement:

> - The top version MUST equal the version stamped on the project's primary artifact — **unless the
>   project defers its documentation pass to major releases, in which case the stamp must equal the
>   most recent `X.0.0` entry and must never trail it.**

**(c) The live consequence.** `portfolio/build/check_projects.py` implements exactly the rule in (b):
`newest_changelog_version(base)` against `find_stamp(base)`, which reads the white paper masthead with
the same regex ABRA's `versionHeader()` uses. From the first ABRA release after a major, ABRA's white
paper legitimately trails the CHANGELOG and **that script will report ABRA as version-inconsistent
when ABRA is correct.** It is not wired into any ABRA gate — one comment in `web/figure-audit.js`
mentions it and nothing invokes it — so nothing breaks automatically, but the next manual pre-publish
run will accuse a correct repository. Teaching it the same distinction as (b) is a portfolio change
and was not made here.

---

## 8. The CHANGELOG entry I would write

Not applied: no version bump and no `CHANGELOG.md` edit was made, per the brief. A publish pass
follows and will fold this in.

```
### Changed
- **The documentation rule.** Will, 2026-09-06: "we can update the documents every major release and
  just keep a running notes page in between change the documentation rules". Every change now writes a
  row to the new `docs/RUNNING-NOTES.md` in the same pass, with the same rigour; the white paper, the
  deck, the technical docs, `SUMMARY.md`, `MODELS.md` and the PDFs are folded in on a MAJOR release —
  a CHANGELOG entry of the form `X.0.0`, derived rather than declared. `CHANGELOG.md` and the version
  bump are unchanged. The measured reason is push size, not documentation: `docs/ENGINE.pdf` is
  28.8 MB per rebuild, `.git` is 1.1 GB, pushes were returning HTTP 408, and
  `data/games.ladder.jsonl.gz` is 51.8 MB against GitHub's hard 100 MB single-file limit.
- `tests/test-docs-current.js` clause 2 now measures a version-headed document against the last
  `X.0.0` release instead of the CHANGELOG top. The commit that writes an `X.0.0` entry raises that
  floor in the same instant, so the full pass cannot be deferred past the major it was deferred to.

### Added
- `docs/RUNNING-NOTES.md` and the clauses that make it a gate rather than a promise.
  `.githooks/pre-commit` blocks a commit that changes something a reader reads and records nothing;
  `tests/test-docs-current.js` clause 5 re-checks that against git history, so `--no-verify` does not
  launder it, and FAILS when the backlog owed to the next major passes `OWED_CAP`.
  `engine/docs_scan.js --owed` prints the backlog, derived from the notes page, the document headers
  and the CHANGELOG; `engine/open_work.js` prints the same block beside the open register rows.
  Shown red five ways before being trusted, including the hook both ways against a temporary index.

### Notes
- `data/docs-currency-baseline.json`: `unversioned_exempt` 56 -> 57, a hand edit with a reason.
  Every other ratchet is unchanged: 19 pins, 25 grandfathered, 8 retraction violations, 56 citation
  mismatches, 34 untraceable figures across 5 documents. The gate goes 24 clauses to 30.
- The umbrella `Pokemon/CLAUDE.md` and `portfolio/build/check_projects.py` still hold the old rule and
  are Will's call; the proposed wording is in `docs/_reports/2026-09-06-documentation-rule-change.md`.
```

---

## 9. What the next commit needs to know

**The hook is armed now.** The next commit by anyone in this working tree that touches `engine/`,
`tests/`, `web/`, `build/`, a live document or `CHANGELOG.md` will be BLOCKED unless it also stages
`docs/RUNNING-NOTES.md`. The refusal message says exactly what to add. Two division agents were live
while this was built and neither's files were touched.

The publish pass should rename `## [Unreleased]` in the notes page to the version it lands as. Until
it does, the backlog correctly reads `1 of 100` and names it.

**Files changed:** `CLAUDE.md`, `docs/RUNNING-NOTES.md` (new), `engine/docs_scan.js` (+205),
`tests/test-docs-current.js` (+155/-11), `.githooks/pre-commit` (+79/-9), `engine/open_work.js` (+22),
`data/docs-currency-baseline.json` (the one hand-added exemption and its reason).

**Not touched, and deliberately:** `docs/ENGINE.md` and `docs/MEASURE.md` (live agents own them),
`CHANGELOG.md`, any version stamp, `engine/status.js`, and no engine job, differential, census, roster
or release cut was run. `data/open-work.json` was restored byte-for-byte after the one verification
run of `open_work.js`; the working tree is clean of it.

**Debris seen and left, not deleted, per the standing rule:** `tests/probe_stall_uncaused.js`,
`tests/probe_status_clock_dice.js`, `data/verification/_prediction-2026-09-06-stall-residual-foot.json`,
and `docs/_reports/2026-09-06-instrument-defects-546-548.md` are untracked and belong to the live
agents.
