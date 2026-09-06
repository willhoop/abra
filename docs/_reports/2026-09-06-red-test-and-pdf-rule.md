# 2026-09-06 — the artifact-keys red, and the PDF rule extended from the ledger to the working document

MEASURE. Two jobs, both closed. No published figure moved; nothing was run that plays a game, and
nothing under the ENGINE agent's hand was touched (`engine/medicham2-browser.js`, `engine/board_state.js`,
`engine/game_differential.js`, the probes, `docs/ENGINE.md`, `data/protocol-events.json`,
`engine/steering.js`, `engine/diff_swarm.js`, `engine/quarantine.js` — all left alone; no differential,
census, roster or release cut was run, and `engine/status.js --write` was not run).

Files changed: `build/build_pdfs.js`, `data/artifact-accessors.json`, `docs/.gitignore`,
`docs/ROADMAP.md` (#539 closed), `docs/RUNNING-NOTES.md` (row staged), and `docs/ROADMAP.pdf`
untracked with `git rm --cached` (file left on disk). Nothing committed.

---

## JOB 1 — `tests/test-artifact-keys.js`

### The verdict: the ARTIFACT side was right. The 2026-09-04 premise was wrong.

The red clause was

```
FAIL every table whose keys can be missed names the accessor that reads it
     — UNDECLARED: million-run-150k.json:engine_counters, million-run.json:engine_counters
```

`data/artifact-accessors.json` carried both under `deliberately_undeclared` with the disposition
**"DEAD TABLE — nothing reads it"**, and ROADMAP #539 said the red was correct and *"may not be
cleared by declaring an accessor"*. The stated remedy was **name a reader, or stop publishing**.

**The premise is false, and two things in this repository refute it — one of them a test that would
not exist otherwise.**

1. `docs/_reports/2026-09-04-dead-counters-audit.md` line 77 classifies **134** counter fields as
   *"PROVEN BY RUN — moved in a `million-run*.json` artifact"* and **363** as *"UNMEASURED — added
   after the last million-run"*. Both classes are derived from **which keys are present in these two
   tables**, and from nothing else. They are the only record in the repository of which engine
   counters have ever moved.
2. `tests/test-counter-init.js` exists **because** of this table. Its header:

   > *"`data/million-run.json` and `data/million-run-150k.json` both carry `"retaliateWhenLowered": null`
   > which is `JSON.stringify(NaN)` … It was the only non-finite value in either artifact."*

   Verified here on the current files: `retaliateWhenLowered` is inside `engine_counters` in both,
   and is the only non-finite value in either table.

The 2026-09-04 finding was true of **programmatic** readers and was read as true of **all** readers.

### Why the other remedy could not be taken

"Stop publishing" cannot clear this red today, and doing it retroactively would delete the evidence
above:

- The gate judges the two files **on disk**. Changing `engine/million_run.js:1463` stops FUTURE runs
  from writing the key and leaves the gate red until a re-run.
- Both artifacts were generated **2026-08-11** against release `84f466e7e0d2` and both open with
  `"note": "GENERATED — do not hand-edit."` Stripping the key by hand is banned by the artifact's own
  header, and it would remove the two lines `tests/test-counter-init.js` cites as its founding evidence.
- Regenerating means playing games through MEDICHAM, which is under an ENGINE agent tonight and is the
  thing under quarantine.

`engine/million_run.js` is therefore **unchanged**.

### What the declaration claims, stated so it cannot be over-read

Both keys are now in `accessors`:

```
accessor: engine/million_run.js
function: instrumentChecks(rows, counters) — engine/million_run.js:1269
```

- `instrumentChecks()` is the **one function that indexes the table**. It reads `counters.flinch` and
  `counters.secondaryVolatileApplied` by hard-coded literal and its verdict is published beside the
  table as `instrument_checks`.
- **It indexes the live object before the artifact is written. NOTHING reads the file's copy of the
  table by key.** That sentence is in the registry entry, so the declaration cannot be quoted as more
  than it is.
- The keys are the field names of the `MEDSEEN` object literal in `engine/medicham2-browser.js` — code
  identifiers on both sides, never a name a human or a sheet writes. That is the class the registry's
  own `not_species_keys` note already describes, and it is why this is not the `MC.mons` risk.
- Same shape as the two entries already in the file on this reasoning: `porygon2-species.json:mons`
  (one consumer, which also generates it) and `tag-consumption.json:by_tag` (writer and reader are the
  same file). Like both, the entry is the **warning** if a second consumer ever indexes by a derived
  name.

The old `deliberately_undeclared` text is **kept, not deleted** — it now sits under
`superseded_2026_09_06` with what it said, what refuted it, and why the other remedy was not taken.

### Still open, and not closed by this

The audit's separate proposal — publish `engine_counters_zero` beside the delta so a counter that
stayed at zero is NAMED rather than silently omitted. `seenDelta` (`engine/million_run.js:1241-1242`)
keeps only the keys that MOVED, so **this table can never report a zero**. That is an ENGINE/`million_run`
change plus a run, and it is recorded in the #539 closure as not closed.

### Ratchets, before and after

| | before | after |
|---|---|---|
| `tests/test-artifact-keys.js` | 5 passed, 1 failed, exit 1 | **6 passed, 0 failed, exit 0** |
| name-keyed tables found | 53 | 53 |
| flat-lowercase, structurally immune | 37 | 37 |
| **can be missed** | **16** | **16** |
| declared in `accessors` | 14 | 16 |
| `deliberately_undeclared` entries | 2 | 0 (superseded record kept) |
| `tests/test-roadmap-register.js` | not run before the edit | 3 passed, 0 failed |
| `tests/test-register-cell-parse.js` | not run before the edit | pass |
| `tests/test-claim-truth.js` | not run before the edit | 305 passed, 0 failed |

The three register tests were run only after the edit, and that is stated rather than implied. Their
before-state is not claimed. What IS a before/after is the artifact-keys line, which was measured red
at the top of the session.

**The detector was not weakened.** The risky set is the same 16 tables before and after; what changed
is that all 16 are now declared.

### Shown RED on a deliberate break

```
--- DELIBERATE BREAK: one declaration removed, one accessor pointed at a missing file
  FAIL every table whose keys can be missed names the accessor that reads it — UNDECLARED: million-run.json:engine_counters
  FAIL every declared accessor file exists (million-run-150k.json:engine_counters -> engine/does_not_exist.js)
ARTIFACT KEY TESTS: 4 passed, 2 failed   EXIT=1
--- RESTORED
ARTIFACT KEY TESTS: 6 passed, 0 failed
```

The guard still fails by name if the entry is removed, and the dangling clause proves the named file
must exist. The declaration is not a silencer.

`data/policy-weights.json` was not touched.

---

## JOB 2 — the PDF rule, extended to working documents

### It could NOT be derived, and five candidates were measured before saying so

Tonight's rule was *a division ledger is a working document and gets no PDF*, derived from
`.claude/agents/*.md`. The brief asked for the equivalent property for `docs/ROADMAP.md` and
`docs/RUNNING-NOTES.md`. Five candidate derivations were run over all **78** `docs/*.md`:

| candidate | result | why it fails |
|---|---|---|
| (a) named by a program anywhere in source | **56 of 78** | almost every hit is a path in a comment or a `console.log` ("see docs/LESSONS.md") |
| (b) named in CODE, comments stripped | **45 of 78** | a `console.log` string is code. It catches DEFENSE, METHODOLOGY and ORIENTATION, which have **published PDF links** |
| (c) no version header (`docs_scan.livingDocs()`) | only **24 of 78** claim currency | would drop 54 PDFs including those three legacy names. Right idea, wrong blast radius |
| (d) body shape — % of lines that are table rows | does not separate | ROADMAP **44.3%**, RUNNING-NOTES **0.0%**, SUMMARY **22.4%**, ROLE-ATLAS **98.8%** |
| (e) git history — additions vs deletions | cannot answer | it cannot classify a document created this week, which is exactly `RUNNING-NOTES.md` |

(b) was measured with a real comment/string-state stripper, not a grep. (d) counts non-blank,
non-fenced body lines.

**So clause 2 is a DECLARED RESIDUAL** — two entries, each carrying the property that made it a
working document — and it is **checked rather than trusted**.

### What the build now refuses

`workingDocs()` in `build/build_pdfs.js` THROWS on:

1. a residual entry naming a document that does not exist — *"a rule nobody can check"*;
2. a residual entry that has become a division ledger — the derivation moved underneath the list and
   the entry is now a second opinion;
3. **any excluded document whose PDF is still TRACKED BY GIT** — the clause that protects the saving,
   because an exclusion whose output is in git buys nothing. If `git` cannot be asked, that throws too:
   a silent skip here restores the whole cost while the run reports success.

All three were shown red on a deliberate break. (3) fired for real, on the tree as it stood, before
`docs/ROADMAP.pdf` was untracked:

```
Error: these documents are excluded from the PDF build and their PDFs are STILL TRACKED: ROADMAP.md.
Error: the declared residual names docs/ROADMAP-NO-SUCH-FILE.md, which does not exist. …
Error: docs/ENGINE.md is BOTH a derived division ledger and a declared residual. …
```

The excluded set is printed on every run **with its clause beside each name**, so a declared entry can
never be mistaken for a derived one.

### The measured saving

Derived from git, not from an artifact:

| | |
|---|---:|
| `docs/ROADMAP.pdf` in the tree | **7,229,637 B** (6.89 MiB) |
| distinct tracked versions | **8** |
| all versions, raw | **16.42 MB** |
| all versions, on-disk/packed | **5.19 MB** |
| the version at the most recent bump `d7ed4b75`, packed | **4,092,583 B = 4.09 MB** |
| `docs/RUNNING-NOTES.pdf` — never built; priced once to a scratch path | **241,109 B** at 190 lines |
| the same at ROADMAP's 57% pack ratio | ≈ **0.14 MB** |

**Per-bump saving ≈ 4.2 MB of pack**, on top of the 16.6 MB the ledger clause already removed.
`docs/ROADMAP.md` moves most sessions and `docs/RUNNING-NOTES.md` moves every change by design, so
both are rebuild-every-pass documents; `docs/ENGINE.pdf` at 108.4 MB across ten rebuilds is what the
RUNNING-NOTES figure becomes if it is left in.

**UNTRACKING RECOVERS ZERO BYTES OF EXISTING HISTORY.** The blobs stay in the pack; only a history
rewrite removes them, and that is ruled out. The 5.19 MB `ROADMAP.pdf` already costs is permanent.
The saving is entirely future — the opposite of the intuitive read.

Commands, so the numbers can be re-derived:

```bash
git log --format=%H -- docs/ROADMAP.pdf | while read c; do git rev-parse "$c:docs/ROADMAP.pdf"; done | sort -u \
  | git cat-file --batch-check='%(objectsize) %(objectsize:disk)'
git rev-parse d7ed4b75:docs/ROADMAP.pdf | git cat-file --batch-check='%(objectsize) %(objectsize:disk)'
node build/md_to_pdf.js docs/RUNNING-NOTES.md <scratch>/RUNNING-NOTES.pdf   # priced, not published
```

### `node build/build_pdfs.js --check`, honestly

**Before:** exit **1**, two items — `stale ROADMAP.pdf`, `missing RUNNING-NOTES.pdf`.
**After:** exit **0**, *"every document has a current PDF"*, 71 markdown sources and 7 excluded.

The clean exit is **not** a claim that anything was rebuilt. The check's only two outstanding items
were exactly the two documents the rule now excludes, so excluding them emptied the work list. If a
third document goes stale tomorrow, `--check` exits 1 again as it should.

### Ratchets, before and after

| | before | after |
|---|---|---|
| `tests/test-docs-current.js` | not run before the edit | **33 passed, 0 failed** |
| undeclared unversioned documents | 57 | 57 |
| archived docs with no SUPERSEDED header | 25 | 25 |
| retracted figures restated as fact | 8 | 8 |
| figures a cited artifact does not contain | 56 | 56 |
| untraceable-figure census | 34 across 5 documents | 34 across 5 documents |
| documentation backlog owed to next major | 5 of 100 | **6 of 100** (this row) |
| `tests/test-no-silent-failure.js --only build/build_pdfs.js` | — | no new silent catch blocks |

`data/docs-currency-baseline.json` was left untouched — the run reports no ratchet movement.

The one `catch` added (`trackedPdfs`) rethrows with the reason; there is no silent branch.

---

## What was deliberately NOT done

- **`engine/status.js --write` was not run** and no `<!-- GENERATED -->` block was hand-edited.
- **`engine/open_work.js` was not run.** `data/open-work.json` is modified in the working tree by the
  ENGINE agent's session; regenerating it would write over another agent's in-flight artifact, and
  reading it while it moves is the torn-read failure CLAUDE.md names. #539's closure is in
  `docs/ROADMAP.md`, which is where the shared closed-detector reads it from
  (`quarantine.roadmapRowIsClosed` matches the new status cell — verified).
- **Nothing was committed.** Will publishes.

## Debris observed, left in place

Three untracked probes and two modified engine/test files belong to the live ENGINE agent and were not
touched: `tests/probe_accuracy_modifier_chain.js`, `tests/probe_pressure_terrain_target.js`,
`tests/probe_weather_forme_faint.js`, `engine/medicham2-browser.js`, `tests/roster.js`. Reported, not
removed.
