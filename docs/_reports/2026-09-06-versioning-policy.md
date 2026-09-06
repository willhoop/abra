# What counts as a major release — the study, the decision, and a defect found on the way

MEASURE, 2026-09-06. Dispatched on Will's *"whatever the best practices are study them and implement
them and document them."*

`docs/_reports/` is historical by construction. It is never maintained, never cited as current state,
and is superseded by the register rows and the running-notes row it feeds.

---

## 0. The headline, before anything else

**The backlog counter that the whole deferral bargain rests on had never read a single row.** It
reported `0 of 100 — nothing owed` against a page holding four, and `tests/test-docs-current.js`
passed **30 of 30** while it did. Section 3. The versioning policy is section 2; it is the smaller
half of this report.

---

## 1. The sources, read rather than recalled

Four were read in full or in the relevant sections, and each is cited by clause or item number below.
Retrieved 2026-09-06.

| source | what it settles | what it does not |
|---|---|---|
| **Semantic Versioning 2.0.0**, semver.org | the arithmetic, once an API is declared | it cannot tell you what ABRA's API is |
| **Keep a Changelog 1.1.0**, keepachangelog.com | the file format, already the house standard | takes no position on what a major is |
| **ESS Guidelines on Revision Policy**, Eurostat 2013, KS-RA-13-016 (52pp, text-based) | routine vs major revision, back-casting, the documentation a major owes | written for statistical agencies, not software |
| **CalVer**, calver.org | the alternative scheme and its own admission test | — |

### 1.1 SemVer 2.0.0, the clauses that matter

- **Clause 1.** *"Software using Semantic Versioning MUST declare a public API. This API could be
  declared in the code itself or exist strictly in documentation."* This is the load-bearing one. It
  explicitly permits an API that lives only in documentation.
- **Clause 6.** *"Patch version Z ... MUST be incremented if only backward compatible bug fixes are
  introduced. A bug fix is defined as an internal change that fixes incorrect behavior."*
- **Clause 7.** *"Minor version Y ... MUST be incremented if new, backward compatible functionality is
  introduced to the public API. ... It MAY be incremented if substantial new functionality or
  improvements are introduced within the private code."*
- **Clause 8.** *"Major version X ... MUST be incremented if any backward incompatible changes are
  introduced to the public API."*
- **FAQ, on the fear of reaching 42.0.0 quickly.** *"This is a question of responsible development and
  foresight. ... Having to bump major versions to release incompatible changes means you'll think
  through the impact of your changes."*
- **FAQ, on a change that does not fit the number.** *"Use your best judgment. ... Remember, Semantic
  Versioning is all about conveying meaning by how the version number changes. If these changes are
  important to your users, use the version number to inform them."*

The last quotation is the licence for everything in section 2. SemVer's own FAQ says the purpose of
the number is to convey meaning to the people who depend on the thing, and instructs judgement where
the mechanical rule does not reach.

### 1.2 Keep a Changelog 1.1.0

Guiding principles: *"Changelogs are for humans, not machines"*, an entry for every version, newest
first, ISO dates, *"Mention whether you follow Semantic Versioning"*. Types of change: Added, Changed,
Deprecated, Removed, Fixed, Security. `CHANGELOG.md` already conforms and already links both specs in
its header. **Nothing here needed to change.** It offers no definition of a major.

### 1.3 ESS Guidelines on Revision Policy — the closest real analogue

This is the source that actually fits, because it is written for a producer whose deliverable IS a
published number.

- **Item 2.0, routine revisions.** *"Routine revisions are changes in published data which are related
  to the regular data production process (e.g. estimated values for missing responses are replaced by
  reported figures)."* Published on a pre-announced calendar. The series keeps its meaning; the values
  move.
- **Item 3.0, major revisions.** *"Major revisions are changes in published data, often substantial,
  due to one of the following reasons: ... An update of the weights of the base year of an index
  series ... A change in the concepts, definitions and/or classifications used to produce the series
  ... Major revisions affect a large part of the time series and sometimes even the complete time
  series. Therefore it is necessary to back-cast the series, otherwise major revisions will produce
  breaks and inconsistencies in the time series."*
- **Item 3.2, back calculation.** *"When the weights of an index series are updated, the new index
  using the updated weights should be calculated for an overlapping period with the old series so that
  the two can be linked."*
- **Item 3.4, documentation.** *"The release of major revisions should be accompanied by documentation
  which allows users to assess the new time series. The documentation shall detail the reasons for the
  revisions, estimate their impact on the aggregated series, offer a comparison between the 'new' and
  the 'old' series and detail the length and depth of the revisions."*
- **Item 3.1, scheduling.** Major revisions are announced well in advance and put in the release
  calendar.

Item 3.4 is, almost line for line, the living-document fold-in this repository already performs. Item
3.2 supplies the operational test — **can the old and the new be linked** — and ABRA already owns an
instrument that answers it for its headline artifact: `engine/arms_comparable.js`.

### 1.4 CalVer, and why it is rejected

calver.org's own admission test: *"Does your project feature a large or constantly-changing scope?"*
and *"Is your project time-sensitive in any way? Do other external changes drive new project
releases?"* — Ubuntu's five-year support windows, `certifi`'s certificate refreshes, the IANA timezone
database's political deadlines. **ABRA's releases are driven by measurements, not by a calendar.** A
date in the version would say nothing about whether a figure still stands, which is the only question
anybody asks of an ABRA version. Rejected.

### 1.5 Dataset and model conventions, and why they were not adopted wholesale

Dataset practice (a new DOI per version, a concept DOI resolving to the latest) exists so that a
citation points at exactly the bytes analysed. ABRA already solves that problem better and more
specifically, with frozen engine releases, census pins and pool pins — a release id identifies the
bytes, and the version identifies the story. Layering DOI-style versioning on top would be a second
implementation of a fact that already has one, which is the `buildMon("Scizor")` failure. Not adopted.

---

## 2. The policy

### 2.1 Does ABRA have a public API?

Asked honestly: **no, not in the sense clause 1 was written for.** ABRA ships no library. Nobody runs
`npm install`. Nobody pins `>=5.2.0 <6.0.0` against it. The single machine-readable contract is
`data/meta-usage.json`, consumed by CHOMP, and that is a schema question a schema check should own,
not a version number.

What consumers actually consume is **figures**: the numbers in the white paper, the deck,
`docs/SUMMARY.md`, `docs/MODELS.md` and on the site. Clause 1 permits an API that exists strictly in
documentation. So the declaration is made explicitly, in `CLAUDE.md`:

> **The declared public API of ABRA is the figures it publishes.**

Everything else follows mechanically.

### 2.2 The candidate definition, tested

Will's candidate: *"MAJOR = a reader's understanding must change. ... Board-material 59 → 22 is
refinement — same story, better number. Board-material reaching ZERO and the quarantine lifting is a
major."*

**It survives contact with SemVer, and it is improved by being restated in the spec's own terms.**
"A reader's understanding must change" is the right instinct but it is a statement about a person, and
a person's understanding changes when they read anything. Under an API that is the published figures,
clause 8's *backward incompatible change* has an exact reading: **the old figures can no longer be
used the way they were.** That is a property of the numbers, not of the reader, and it is the same
property ESS Item 3.2 calls linkability.

So the definition landed is:

> **PATCH** — no published figure moves. (Clause 6: an internal change that fixes incorrect behaviour.)
> **MINOR** — a published figure moves, under an unchanged BASIS. (Clause 7.)
> **MAJOR** — the BASIS moves, so old and new cannot be linked. (Clause 8.)
>
> **The basis is the question the number answers.** If a reader can be told *"27 became 22"*, it is a
> MINOR. If the honest sentence is *"the 27 answered a question we no longer ask"*, it is a MAJOR.

Three consequences worth writing down because each is counter-intuitive:

1. **A simulator bug fix is NOT a patch here.** Under SemVer-for-code it obviously is: an internal
   change that fixes incorrect behaviour. Under SemVer-for-figures it moves the published numbers, so
   it is a MINOR. This is the single most likely thing for a future session to get wrong from muscle
   memory, so it is stated in `CLAUDE.md` in those words.
2. **A figure being withheld and restored is not automatically a basis change.** 5.265.0 withheld the
   whole-game counts and 5.266.0 restored them on new engine bytes. That looks like the set of things
   a reader may be told changing — the archetype of a major. It is not one, because
   `engine/arms_comparable.js` answered COMPARABLE and the five numbers reproduced digit for digit.
   **That is a back-cast, and a series that links is one series.** Tonight's sharpest test case.
3. **The quarantine gate opening IS the archetypal major**, and for the reason ESS Item 3.0 gives:
   every artifact downstream of MEDICHAM stops being withheld at once, nothing that has been published
   survives unrewritten, and the documents genuinely have to be rewritten rather than restamped.

### 2.3 Derived, or declared? — declared, and said so plainly

**It is a JUDGEMENT.** Nothing in this repository can decide *supersedes or refines* from the numbers,
because that is a claim about what the two numbers mean. The closest instrument,
`engine/arms_comparable.js`, answers the linkability question for one artifact under one protocol.

The brief's instruction was to make the judgement **cheap and visible** rather than pretend it is
mechanical, and that is what was built:

- **The judgement is one word, in a row that already had to be written.** `**Basis.** unchanged` or
  `**Basis.** CHANGED — <what a reader can no longer be told>`, in `docs/RUNNING-NOTES.md`.
- **The arithmetic around it is mechanical.** `engine/docs_scan.js` gained `majorPolicy()`;
  `tests/test-docs-current.js` gained clause 5d, which refuses three inconsistencies:
  - `basis_change_not_major` — a row declaring a basis change that released as anything but `X.0.0`;
  - `major_without_basis` — an `X.0.0` whose row names no basis change. Without this, a major means
    whatever the person cutting it felt, and it also refuses bumping `X.0.0` to clear a backlog;
  - `patch_moved_a_figure` — a PATCH bump whose row supersedes a figure.
- **The asymmetry is deliberate.** A MINOR that moved nothing is NOT an error: clause 7 says MINOR
  *may* be incremented for improvements "within the private code". Only the direction that can lie is
  refused, so the clause cannot fire on a legitimate release.
- **An absent `Basis.` line reads as unchanged and PRINTS as absent** — `[basis not stated]` on every
  `node engine/docs_scan.js --owed`. Failing on absence would fail every row written before the rule
  existed, and back-filling those rows would be editing the log to agree with today, which the page's
  own preamble forbids. The soft edge is named as a soft edge rather than hidden.

### 2.4 The risk this design carries, stated rather than hidden

**The incentive is inverted relative to SemVer.** Under SemVer a major costs your *users*, so authors
under-cut it out of consideration for them. Here a major costs *you* — a full documentation pass — so
the person making the judgement is the person paying for it. **Expect systematic under-declaration.**
The counterweights are the cap and the quarantine gate, both of which fire without anyone volunteering
anything. Good intentions are not one of the counterweights and are not treated as one.

### 2.5 What happens at the cap — the brief's question 3

The cap is 100 rows and it fails the build. Two answers:

**(a) It should BLOCK, not prompt.** A prompt is a caption, and this repository has already proved
twice over that a printed warning beside a number gets skimmed: `PRE-CHANGE` was printed beside every
R4 figure and the figures were quoted anyway, and a red gate was reported as "one of the two known
failures" for two days. `CLAUDE.md` states the rule in its own words — *a caption is not a
quarantine*. A prompt at the cap would be the fifteenth thing that prints and the fifteenth thing
nobody reads. ESS Item 3.1 arrives at the same place from the producer's side: major revisions are
pre-announced and scheduled precisely so they do not wait for somebody to feel ready.

**(b) But the cap owes a DOCUMENT PASS, not a major — and the prose said otherwise.** Read the code:
`owedToNextMajor()` computes the backlog against `documentedAt()`, the lowest unpinned version header
among the living documents. **The backlog empties when those headers move, at any version.** Nothing
in the mechanism requires an `X.0.0`. The prose in `CLAUDE.md`, in the notes preamble and in the test's
own failure message all said *"cut the major"*, which is a stricter and wrong description of what the
code does, and it creates exactly the pressure that would destroy the meaning of a major: bump `X.0.0`
to clear a backlog. Corrected in all three places. **No check was loosened** — the assertion is
byte-for-byte the same; the escape route was already available and is now described correctly, and
`major_without_basis` closes the door on faking a major to use it.

### 2.6 Tonight's ten releases: which would have been major?

**None of them.** Honest answer, as invited.

| release | what it did | kind under this rule |
|---|---|---|
| 5.258.0 | Big Root read one heal source of five | MINOR — figures moved |
| 5.259.0 | three figures cited to an artifact that never held them | MINOR — published figures corrected |
| 5.260.0 | `onTryHit` below the hit-step gates; protocol 151 → 114 | MINOR |
| 5.261.0 | engine fix; `status.js --write` deliberately not run | MINOR |
| 5.262.0 | Sitrus timing family closed; the `any` dice bucket | MINOR |
| 5.263.0 | a gate fixed mid-pass; predictions 9 of 10 | MINOR |
| 5.264.0 | third-arm reproduction, digit by digit | MINOR |
| 5.265.0 | hazard sweep order; whole-game counts WITHHELD | MINOR |
| 5.266.0 | the withheld counts restored, re-measured, COMPARABLE | MINOR — a back-cast, not a break |
| 5.267.0 row | `stall` residual order and the sleep dice stream; 27 → 22 | MINOR |

The rule does change one thing, downward. The two infrastructure rows still under `[Unreleased]` —
store sharding, and the division ledgers losing their PDFs — both state *"Supersedes. Nothing. No
published figure changed value."* Under this rule those are **PATCH**, not MINOR. That is the first
practical consequence of the definition, and it is a demotion rather than a promotion, which is the
right shape for a rule that is supposed to make a major mean something.

---

## 3. THE DEFECT — the backlog counter had never read a row

### 3.1 What was found

`node engine/docs_scan.js --owed` printed:

```
  DOCUMENTATION DEBT — 0 of 100 notes entries owed to the next major
    nothing owed — the documents are level with the notes page.
```

`docs/RUNNING-NOTES.md` held **four** rows at that moment. `S.notesEntries()` returned `[]`.

### 3.2 Why

`notesEntries()` anchors its heading pattern with `$`:

```
/^##\s*\[(Unreleased|\d+\.\d+(?:\.\d+)?)\]\s*—?\s*(\d{4}-\d{2}-\d{2})?\s*—?\s*(.*)$/i
```

`core.autocrlf` is `true` on this machine. The committed blob of `docs/RUNNING-NOTES.md` is LF; the
working copy is CRLF. Lines split on `\n` therefore end in a bare `\r`. **In JavaScript a CR is a line
terminator**, so `.` does not match it and `$` — without the `m` flag, anchored at end of input —
cannot be reached past it. Every heading failed. The same page parsed correctly with the CR removed.

### 3.3 Why it matters more than it looks

The entire argument for deferring the living-document pass to the major is that the debt is COUNTED
and REFUSED past a bound. `CLAUDE.md` says so in as many words, and `engine/docs_scan.js` carries a
comment block explaining that *"'We will update the documents at the next major' is that failure in a
new costume unless something prints the size of the promise."*

**A counter stuck at zero can never reach `OWED_CAP`, so the cap could never have fired.** The
deferral was unbounded from the day it was created, and everything printed green — including
`tests/test-docs-current.js` at 30 passed, 0 failed, and `engine/open_work.js`, which prints the same
block. This is the repository's signature failure exactly: a capability absent, everything reporting
success.

It is also the **third** occurrence of this line-ending class. `.gitattributes` carries a block headed
*"A LINE ENDING BLANKED THE GATE TWICE IN THREE DAYS"*, describing `data/tags.json` going CRLF on a
rebase twice and taking the engine release id and the gate with it.

### 3.4 The fix, and where it was put

At the READ, not in the pattern. `engine/docs_scan.js`:

```js
function stripCR(text) { return String(text).replace(/\r\n/g, '\n'); }
function slurp(abs) { return stripCR(fs.readFileSync(abs, 'utf8')); }
function readDoc(rel) { return slurp(D(rel)); }
```

`changelogTop()` and `lastMajor()` were moved onto `slurp` as well, so the module has one read path.
Patching the single failing regex would have left the class alive in every other one — **27 of the 107
documents this module scans are CRLF in the working tree**, so a quarter of the surface was being fed
to `$`-anchored patterns with a CR on the end.

The `.gitattributes` remedy (`docs/RUNNING-NOTES.md text eol=lf`) was considered and rejected: it
fixes one filename on a hand-maintained list, which is the ban-list-of-four failure. `eol` pins exist
in this repo because the ENGINE RELEASE identifies a file by its **bytes**; a document's identity is
its **content**, so the right layer is the read.

### 3.5 Blast radius, measured before the fix was trusted

A probe loaded a transformed copy of `engine/docs_scan.js` in memory (nothing written into the repo)
and ran both variants over the whole document surface:

| derivation | raw read | CR-stripped read |
|---|---|---|
| living documents | 25 | 25 |
| citation mismatches | 78 | 78 |
| **notes entries** | **0** | **4** |

**Only the broken derivation moved.** That is what made the fix safe to land without a ratchet
regression: had the figure scans gained entries, the ratchet would have failed and the finding would
have had to be worked through first.

---

## 4. What was shown RED

Four deliberate breaks, three of them permanent regression pins.

**(1) The real file, the real path, end to end.** `docs/RUNNING-NOTES.md` was backed up byte-exactly to
the scratchpad (sha256 `7c82b305370a8a24…`), its `5.267.0` heading was retitled to `5.266.0` so it
matched a published release, and `- **Basis.** CHANGED — DELIBERATE BREAK, probe only.` was inserted.
The gate reported:

```
  FAIL every released row's version agrees with the basis and supersession it declares
         basis_change_not_major  5.266.0  docs/RUNNING-NOTES.md:56
```

32 passed, 1 failed. The file was restored from the backup and the sha256 verified identical;
`git status` on it is clean. **No `git checkout` was used** — Lesson 11.

**(2) `stripCR` removed from the read path.** The original defect reproduced exactly — the backlog fell
back to `0 of 100 — nothing owed` — and the new clause caught it:

```
  CARRIAGE RETURNS REACHED A PARSER FROM: docs/ADR-001-…, docs/ARCHITECTURE.md, …
  FAIL the notes page is read the same on a CRLF checkout as on an LF one
       (2/2 demonstration cases; 23 of the live documents are CRLF on disk, 23 leaked a CR to a parser)
```

32 passed, 1 failed. Reverted.

**(3) The central refusal disabled** (`if (false && e.basis.changed && !isMajor)`):

```
  basis-change-released-as-a-minor-is-refused: expected ["basis_change_not_major"], got []
  FAIL the major/minor/patch rule holds in both directions (6/7 demonstration cases)
```

32 passed, 1 failed. Reverted.

**(4) The permanent pins.** `MAJOR_POLICY_CASES` holds seven synthetic rows driven through the
**shipping** `majorPolicy()` — not a copy beside the test, which is the mistake `engine/quarantine.js`
records its selftest making. Every refusal carries its opposite, so no clause can be satisfied by a
function that refuses everything:

- basis change as a MINOR → refused; basis change as `X.0.0` → fine
- `X.0.0` naming no basis change → refused
- PATCH that supersedes a figure → refused; PATCH that moves nothing → fine
- MINOR that moves nothing → **fine** (clause 7's private-code allowance, pinned so nobody tightens it)
- a row ahead of its release → reported as not checkable, never passed silently

`crlfProof()` pins the read in both directions and additionally walks the live surface: a document
whose bytes contain a CR must come back from `readDoc` without one. On an all-LF checkout that second
half would prove nothing, so it prints the number of CRLF documents it actually found (23 today)
rather than a bare green line.

---

## 5. Ratchets, before and after

Every one identical. Nothing was loosened, adopted or laundered.

| ratchet | before | after |
|---|---|---|
| undeclared unversioned documents | 57 | 57 |
| archived documents with no SUPERSEDED header | 25 | 25 |
| retracted figures restated as fact | 8 | 8 |
| figures a cited artifact does not contain | 56 | 56 |
| untraceable figures census | 34 across 5 documents | 34 across 5 documents |
| version pins | 19 | 19 |
| versioned documents scanned | 25 | 25 |
| retraction-matcher demonstration cases | 7/7 | 7/7 |
| figure-lexer demonstration cases | 7/7 | 7/7 |
| **assertions run** | **30 passed, 0 failed** | **33 passed, 0 failed** |
| **backlog owed to the next major** | **0 of 100 (fictitious)** | **5 of 100 (measured)** |

`data/docs-currency-baseline.json` was not rewritten on any run — the gate reports "no ratchet
movement", which is the correct outcome: a new clause that finds nothing new must not dirty the
baseline.

`data/open-work.json` and `data/provenance-stamp.json` are modified in the working tree. Both are pure
run-stamp churn from `node engine/open_work.js` and `node engine/status.js` (a `generated` timestamp
and one `age_days` rounding 25.9 → 26). No content finding. **They were left as they are** — not
reverted, on the standing rule about not undoing files this pass does not own.

---

## 6. Files changed

| file | what |
|---|---|
| `CLAUDE.md` | *What counts as a major* — the definition, the citations, the worked examples, the inverted-incentive warning, the CalVer rejection. The cap prose corrected to "a document pass, not a major", and the CRLF defect recorded beside the backlog bullet. |
| `engine/docs_scan.js` | `stripCR` / `slurp` one read path; `changelogVersions()`, `bumpKind()`, `basisOf()`, `supersedesOf()`, `majorPolicy()`, `majorPolicyProof()` + `MAJOR_POLICY_CASES`, `crlfProof()`; `notesEntries()` now attaches the two declared fields; `owedReport()` prints the basis per row and what the cap actually owes. |
| `tests/test-docs-current.js` | clause 5d, and the two proofs asserted. The over-cap message corrected. |
| `docs/RUNNING-NOTES.md` | preamble: the three release kinds, the `Basis.` field in the template, what the cap owes; plus this pass's row. |

**Not done, and owed.** `docs/MEASURE.md` is not restamped: that requires `node engine/status.js
--write`, which this pass was instructed not to run while another agent is live. `CHANGELOG.md` is
untouched and the row is `[Unreleased]` — the publisher assigns the version, and clause 5d becomes
checkable on the commit that does.

---

## 7. One thing this does not fix

`majorPolicy()` currently reports `0 of 5 rows matched a CHANGELOG release`. Every row on the page is
either `[Unreleased]` or ahead of the CHANGELOG top, so the live clause has judged nothing yet. That
is printed in the assertion itself rather than hidden behind a green line, and it resolves on the next
publish. The synthetic cases are what pin the rule until then, and the end-to-end break in section 4
is what proved the live path can fire.
