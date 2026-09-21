# VERSION PER (MODEL, REGULATION) — the implementation, the parsers, and the four deliberate breaks

2026-09-20. MEASURE. Historical findings record; not maintained, not current state.

---

## 1. THE SHAPE CHOSEN, AND WHY IT IS NOT (a) OR (b)

The brief offered **(a)** a separate `CHANGELOG-REGMC.md` with `CHANGELOG.md` left closed, or **(b)**
one changelog whose entries carry a regulation-scoped version. What shipped is **(a) as the storage
and a third thing as the mechanism**: a first-class concept called a **LINE**, derived at run time.

> A LINE is a version series for one *(project or model, regulation)* pair. It owns a changelog, a
> document floor, a set of documents and a set of notes rows. **A version is compared only inside its
> own line.**

Reading the parsers first is what ruled out (b). `engine/docs_scan.js` compares versions in **nine**
places, and every one of them is a comparison between two numbers that were only ever meaningful in
one series: the document floor, the pin check, the backlog, the block-dating, the figure binding, the
release-kind policy. Putting `0.2.0` and `7.0.0` in one file does not make them comparable; it makes
every one of those nine comparisons silently wrong. The worst of them is not an error, it is a
**green**: `documentedAt()` takes the minimum header over the living documents, so a single `0.1.0`
document pegs the repository's floor at `0.1.0` and reports every notes row ever written as owed —
and, the other way round, a `0.2.0` notes row measured against a `7.0.0` floor sorts BELOW it and
reads as already folded in. That is a backlog counter structurally incapable of counting, which is
the exact failure the CRLF bug produced (`0 of 100 ... nothing owed` against a page holding four
rows) and the exact failure `OWED_CAP` exists to make impossible.

(a) alone was not enough either, for the same reason: two changelogs with parsers that only know
about one of them is a version scheme half-taught.

### Nothing in the scheme is typed

| what | derived from |
|---|---|
| the lines | the `CHANGELOG*.md` files present at the repository root |
| each line's identity, label, format, close version | that changelog's own masthead, `<!-- LINE: id=...; label=...; format=...; closed=... -->` |
| which line a document is on | that document's own masthead, `**Line: abra/regmc**`; absent reads as the main line |
| which line a notes row is on | the row's heading, `## [abra/regmc 0.2.0]`; absent reads as the main line |
| a line's document floor | its last `X.0.0`, or — if it has never shipped one — its TOP |
| the models | `## NAME` headings in `docs/MODELS.md`, which CLAUDE.md already names the per-model registry |
| a model's published artifacts | the `data/*.json` files its own ledger section cites |
| which model a gate certifies | the gate's own `SIMULATOR` constant |
| whether a regulation is simulated | whether the simulator's source names that regulation's format id |

The default in every case is the **main** line, which is the strict direction: the main line is the
one with a major floor to meet, so a forgotten declaration fails loudly instead of quietly exempting
a document.

### The one judgement inside it: a `0.x` line's documents are due EVERY release

A line with no major has no deferred pass, so there is nothing for a backlog to be measured against
(SemVer 2.0.0 clause 4 — anything may change at any time below 1.0.0). Its floor is its TOP. That is
**stricter** than the Reg M-B rule, it is cheap while a line is young, and it relaxes by itself on the
day the line reaches 1.0.0, with nothing to remember to change.

---

## 2. EVERY PLACE A VERSION IS PARSED OR COMPARED, AND WHAT CHANGED THERE

Found by grepping for every reader of a version, then by reading each one. All of them are in three
files plus two shell/hook call sites.

| file | what it does with a version | change |
|---|---|---|
| `engine/docs_scan.js` `changelogTop` | the top of "the" changelog | takes a line id; defaults to main |
| `engine/docs_scan.js` `lastMajor` | the major floor | takes a line id |
| `engine/docs_scan.js` `documentFloor` | **new** | major, or TOP for a 0.x line |
| `engine/docs_scan.js` `changelogVersions` | released versions, for the release-kind policy | takes a line id |
| `engine/docs_scan.js` `changelogDates` / `changelogDate` | version → ISO date, used to DATE a block | per-line cache; resolved per document |
| `engine/docs_scan.js` `changelogHas` | "is this figure anywhere in the changelog" | per-line cache; resolved per document |
| `engine/docs_scan.js` `changelogEntryIndex` | figures an entry states, for binding | per-line cache; resolved per document |
| `engine/docs_scan.js` `documentedAt` | lowest unpinned header | over that line's documents only |
| `engine/docs_scan.js` `owedToNextMajor` | the backlog | per line; `owedByLine()` added |
| `engine/docs_scan.js` `majorPolicy` | the three release-kind refusals | per line; `majorPolicyByLine()` added |
| `engine/docs_scan.js` `notesEntries` | parses `## [X.Y.Z]` rows | also parses `## [<line> X.Y.Z]`, carries `line_id` |
| `engine/docs_scan.js` `citationMismatches` | dates a block from its version stamp | dates from the document's OWN line |
| `engine/docs_scan.js` `untraceableCensus` | binds a figure to an artifact or an entry | binds to the document's OWN line's changelog |
| `engine/docs_scan.js` `EXEMPT_FILES` | "CHANGELOG.md is not a living document" | matches the SHAPE `CHANGELOG(-X).md` |
| `engine/docs_scan.js` `RECORDABLE` | what change owes a notes row | `CHANGELOG-<LINE>.md` is a changelog |
| `engine/docs_scan.js` `closedLineBreaches` | **new** | refuses an entry or row above a line's close version |
| `engine/docs_scan.js` CLI | `--owed` | every line; `--lines` added |
| `tests/test-docs-current.js` clause 2 | doc header vs major floor | per line, floors printed per line |
| `tests/test-docs-current.js` clause 2 | **new** | unknown line declaration; closed-line breach |
| `tests/test-docs-current.js` clause 5c | backlog vs cap | per line — one line's slack cannot pay another's debt |
| `tests/test-docs-current.js` clause 5d | release-kind policy | per line |
| `engine/major_readiness.js` | prints the backlog | per line, plus closed-line breaches |
| `engine/open_work.js` | prints `owedReport()` | unchanged — `owedReport()` now covers every line |
| `.githooks/pre-commit` | scope regex naming `CHANGELOG\.md` | matches `CHANGELOG[A-Za-z0-9-]*\.md` |
| `engine/status.js` | did not read a version | **new**: prints the per-(model, regulation) table |

**Two of these were gates getting quietly weaker as a side effect of a new file existing**, and both
are the most important lines in the diff:

- `RECORDABLE = /...^(?:CHANGELOG|README|CLAUDE)\.md$/` — `CHANGELOG-REGMC.md` did not match, so a
  commit touching only the new line's changelog owed **no notes row**.
- `.githooks/pre-commit`'s `grep -qE '^(docs/|engine/|tests/|web/|CHANGELOG\.md|...)'` — the same
  commit **skipped the hook entirely**.

Neither would have produced an error. Both are fixed by matching the shape rather than the name.

`tests/test-roadmap-register.js` parses no version — checked, not assumed.

---

## 3. THE PER-MODEL HALF: `engine/model_versions.js`

The key is a pair, and the answer is a **state**, never a counter:

```
0.0.0   nothing exists for this pair
0.x     it exists and it is NOT USABLE YET          (SemVer 2.0.0 clause 4)
1.0.0   a gate certifies it AND nothing it publishes is withheld
```

Nothing here increments on activity. That is the whole point: `7.0.0` was reached by releasing often.

**The clauses, in the order that decides.** Each failing clause is printed as a REASON beside the
number, because a version with no reason is a caption, and this repository has twice proved a caption
beside a number gets skimmed past.

1. the regulation is SIMULATED — the simulator's source names its format id;
2. a gate certifies THIS model on it — read off the gate's own `SIMULATOR`, not typed;
3. that gate is OPEN — `CANNOT-ANSWER` is never a pass;
4. the model publishes at least one artifact its ledger section cites;
5. **not one of those artifacts is WITHHELD by `engine/quarantine.js`'s require-graph walk.**

Clause 5 is the one the brief asked for: *build it so that a model whose figures were measured under a
superseded engine cannot read 1.0.0*. It is not a judgement — it asks the withholder that already
derives what is downstream of the simulator.

**Reading today**, with `SHOWDOWN_PATH` pointed at the pinned M-B authority:

```
gate        engine/quarantine.js  ->  MEDICHAM   OPEN
regulations abra/regmb [simulated]   abra/regmc [not simulated]
ledger      docs/MODELS.md — 33 model entr(ies)

1.0.0   abra/regmb   USABLE           MEDICHAM
0.1.0   abra/regmb   NOT USABLE YET   27 models — DODUO, MACHAMP, WOBBUFFET, DITTO, KADABRA, GURU,
        SLOWKING, ALAKAZAM, CHOMP, ROLES, WAR, NMF, COUNTERPLAY, ILLUSION, XATU, MAGNEMITE, MILTANK,
        GARY, META-USAGE, MOVE PRIORS, PORYGON2, SPECIES SETS, COUNTERS, BRING PRIORS, CORES,
        DYNAMICS, SMOGON PRIORS
        NO GATE — nothing certifies this model on this regulation, so it cannot leave 0.x.
0.0.0   abra/regmc   NOT STARTED      MEDICHAM — nothing is simulated for gen9championsvgc2026regmc
```

**No bar was invented.** Every model other than MEDICHAM reads `0.x` with the reason `NO GATE`,
including SLOWKING — whose team-preview Nash table is genuinely upstream of MEDICHAM and survived the
7.0.0 cull on its own evidence. Being correct is not the same as being certified, and this ruler
reports only the second. Saying so is the honest answer; giving SLOWKING a 1.0.0 would have required
inventing a bar, which the brief forbids.

**`--selftest` is seven cases, each with its opposite**, run through the shipping function rather than
a copy of it (`engine/quarantine.js` learned that the expensive way — its first selftest asserted the
gate rule against a five-line copy and a deliberate break left the copy at 210 passed, 0 failed). The
positive control `gate-open-and-nothing-withheld-is-1.0.0` exists because without it every other case
is satisfied by a function that always answers `0.1.0`.

**A note on the environment.** In a bare worktree with no `SHOWDOWN_PATH`, two gate clauses report
`CANNOT ANSWER — Could not load the Showdown simulator`, the gate is not OPEN, and MEDICHAM correctly
falls to `0.1.0` with `GATE CANNOT-ANSWER` printed as the reason. That is the designed behaviour and
it was verified both ways.

---

## 4. THE FOUR DELIBERATE BREAKS. EACH WAS RED BEFORE ANYTHING WAS TRUSTED

Run against `tests/test-docs-current.js`, which was green at 39/39 before and after each. The test
writes its baseline only on a fully green run (`if (F === 0)`), so a red demonstration cannot record
itself as normal — checked before starting.

**BREAK 1 — a PATCH that supersedes a figure.** Re-tagged the top Reg M-C release `0.2.0 -> 0.1.1` in
both `CHANGELOG-REGMC.md` and its notes row, making the top bump a PATCH while the row still retracts
a figure.

```
FAIL every released row's version agrees with the basis and supersession it declares
     (abra/regmb: 193 of 197 rows matched a release, top 7.0.0 is a major bump;
      abra/regmc: 2 of 2 rows matched a release, top 0.1.1 is a patch bump)
     patch_moved_a_figure  abra/regmc 0.1.1  docs/RUNNING-NOTES.md:60
DOC CURRENCY TESTS: 38 passed, 1 failed
```

Note the clause is now evaluated **on the new line**, against the new line's releases. It was not
inherited; it was re-pointed and demonstrated.

**BREAK 2 — a document trailing its floor.** Left `docs/REGMC.md` at `0.1.0` with its line's floor at
`0.2.0`.

```
line abra/regmc   floor 0.2.0   top-of-a-0.x-line   1 versioned document(s)
FAIL every version-headed document is at or past its line's floor or is a declared pin
     docs/REGMC.md @ 0.1.0  (line abra/regmc, floor 0.2.0)
DOC CURRENCY TESTS: 38 passed, 1 failed
```

This is the clause the old pin was suppressing, now firing on the right floor.

**BREAK 3 — a figure a cited artifact does not contain.** Restored `docs/SUMMARY.md`'s Reg M-C corpus
row.

```
FAIL retracted figures restated as fact: no new entries (baseline 3, now 5)
FAIL figures a cited artifact does not contain: no new entries (baseline 18, now 20)
     docs/SUMMARY.md:72  32,997  not in data/next-regulation.json
     docs/SUMMARY.md:72  23,616  not in data/next-regulation.json
DOC CURRENCY TESTS: 37 passed, 2 failed
```

Two clauses fired, which is the retraction registry and the citation check agreeing.

**BREAK 4 — the new closed-line clause.** Wrote a `## [7.1.0]` entry back into `CHANGELOG.md`.

```
FAIL no changelog entry or notes row sits above the version its line is declared CLOSED at
     (abra/regmb @ 7.0.0)
     entry_above_close  abra/regmb 7.1.0  CHANGELOG.md
       Move the entry to the line that is open (abra/regmc) and renumber it there.
       Do NOT renumber anything at or below the close version — that record is cited.
DOC CURRENCY TESTS: 38 passed, 1 failed
```

Every break was reverted and the suite is back to **39 passed, 0 failed**.

---

## 5. WHAT MOVED IN THE RECORD, AND WHAT DID NOT

**Did not move.** No Reg M-B figure. No Reg M-B document's version header. No MEDICHAM gate clause.
No entry at or below 7.0.0 in `CHANGELOG.md` was renumbered, rewritten or restated. `CHANGELOG.md`
gained a masthead line declaring its line id and its close version — a declaration about the file, not
a change to any entry in it.

**Moved, and each one is the brief.**

- `CHANGELOG.md`'s `## [7.1.0]` entry is now `CHANGELOG-REGMC.md`'s `## [0.1.0]`, content unchanged
  word for word, with a closing note saying where it was first published.
- Its notes row is re-tagged `## [abra/regmc 0.1.0]`.
- `docs/REGMC.md` is at `0.2.0`, declares `**Line: abra/regmc**`, and carries the scheme.
- The `docs/REGMC.md` pin is **removed** from `data/docs-currency-baseline.json`, with the reason
  recorded in `reasons`. The pin said `OWN VERSION LINE` and the reason was right; a pin was the wrong
  instrument. A pin is a declared FREEZE, and that document would have tripped `movedPins` on its very
  next release.
- `docs/SUMMARY.md`'s Reg M-C corpus figures are **deleted**, not captioned, and replaced by the
  command. They were a cited figure over a store the collector appends to hourly, and the citation
  gate was **already red on them before this pass started** — verified: `data/next-regulation.json` was
  regenerated at `50c4c753`, after `docs/SUMMARY.md` at `bfbf9cf9`, and contains neither value.

---

## 6. WHAT COULD NOT BE DONE

**The `7.2.0` entry could not be moved.** It exists only as an uncommitted change in the main
checkout (`M CHANGELOG.md`, `M docs/RUNNING-NOTES.md`, `M docs/SUMMARY.md`, `M docs/REGMC.md`,
`M .github/workflows/ingest.yml`, `M data/docs-currency-baseline.json`), and a worktree-isolated agent
must not write there. Its content — Will's three Reg M-C decisions: the M-B collector's schedule off,
the M-C scope, the Eject Button cut at 335 bo3 games — belongs to the M-C line as **`0.3.0`**,
unchanged.

**It cannot be forgotten, and it cannot pass.** `tests/test-docs-current.js` clause 2 fails by name
and by file the moment those changes are combined with this branch:

```
entry_above_close  abra/regmb 7.2.0  CHANGELOG.md
notes_row_above_close  abra/regmb 7.2.0  docs/RUNNING-NOTES.md:<n>
```

The fix is mechanical: move the `## [7.2.0]` block from `CHANGELOG.md` into `CHANGELOG-REGMC.md` as
`## [0.3.0]`, re-tag its notes row `## [abra/regmc 0.3.0]`, and bump `docs/REGMC.md` to `0.3.0`
(a 0.x line's documents are due every release). Nothing else.

**Not attempted, and named rather than half-done:** the living documents were not re-read for the
per-model version — `docs/MODELS.md` gained a pointer to the command and no per-model number, which is
the correct direction (a version typed into a document is a number somebody has to remember to lower)
but it is not a documentation pass. No PDF was rebuilt. `engine/provenance.js`'s staleness verdict is
NOT consulted by `model_versions.js`: it costs ~15 seconds as a subprocess, and the quarantine
withholder already covers the clause the brief actually asked for. That is a deliberate scope cut and
it is the one thing here worth revisiting.
