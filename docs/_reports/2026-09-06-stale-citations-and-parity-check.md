# Two stale citations and an unchecked parity check — MEASURE, 2026-09-06

Dated findings record. Not a living document, not current state, never cited as either.
Nothing in this pass was applied to `docs/`, `data/`, `engine/`, `tests/` or `web/`, and nothing was
committed. No engine job, differential, census, roster or release cut was run; ENGINE was editing
`engine/medicham2-browser.js` throughout (its mtime moved from 02:38 to later during this pass, and
its size read 3,039,719 bytes at 02:38 against the 2,990,704 quoted in the brief — the file is
moving under us, which is why no measurement was taken against it).

Every artifact read here was checked against the clock first, or read with `git show HEAD:<file>`.

- `data/quality-filter.json` — mtime **2026-08-27 01:37**, ten days cold. Read at `HEAD`.
- `data/winrate-backtest.json` — mtime **2026-08-04 03:09**. Read live, stable.
- `data/docs-currency-baseline.json` — mtime **2026-08-27**. Read live, stable.

This report EXTENDS `docs/_reports/2026-09-06-pdf-and-artefact-debt.md` (written 02:21 the same
morning), which found both citations and correctly declined to edit either. What is new here is the
HISTORY verdict on the white paper's figures, the reconstruction of the population they were really
measured over, the classification ruling on `docs/WEB.md`, and the two diffs.

---

## 1. `docs/ABRA-whitepaper.md:1602` — the figures were never in the artifact, on any day

### 1a. What the artifact says now

`data/quality-filter.json` is version **1.3.0**, `provenance.measured_on` **2026-08-27**,
`provenance.store_size` **67,384** (`data/games.ladder.jsonl`). Its funnel, in full:

```
collected                 67384
after_bot_filter          31531
after_behavioural_bots    27901
after_forfeit_filter      27793
after_min_turns           26142
after_full_bring          18908      <- the require_full_bring step
after_legality            18859
```

So the correct kept/dropped pair for `require_full_bring` **today** is **18,908 kept and 7,234
dropped**, of the 26,142 games that reach the rule. `18908` is a field
(`provenance.funnel.after_full_bring`); `7234` is not — it is `after_min_turns − after_full_bring`
and must be written as a subtraction of two named fields, not quoted as though the artifact stated
it.

There is a second funnel in the same file, `provenance.open_sheet_funnel` over
`data/games.ots.jsonl`: 3,865 → 2,860 at this step. It is dated **2026-07-28** and the artifact says
so itself. Neither funnel produces anything near 19,589.

### 1b. Was 19,589 / 8,713 ever true? Not of the file it cites — checked against every version

`data/quality-filter.json` has **six** commits in its whole history
(`git log --follow`). Every funnel any of them ever held:

| commit | date | store | after_min_turns | after_full_bring |
|---|---|---|---|---|
| `78bff6c1` | 2026-08-27 | 67,384 | 26,142 | **18,908** |
| `50800379` | 2026-07-28 | 20,688 | 4,872 | **3,571** |
| `2bf4ac0f` | 2026-07-24 | 8,356 | 1,283 | **1,061** |
| `236ebbba` | 2026-07-24 | 7,547 | 1,124 | **927** |
| `bba6cd34` | 2026-07-24 | 7,547 | 1,124 | **927** |
| `c6886596` | 2026-07-24 | 7,547 | 2,354 | **1,941** |

**No version contains 19,589 or 8,713.** Stronger: no version of the file has ever carried a
mean-turn field at all — the only turn keys in it are `min_turns` and `after_min_turns` — so
`1.71x`, `7.4` and `4.3` were never citable to it either. The citation could not have supported any
of the three figures on any day since the file existed. This is not a stale citation; it is a
citation that never held.

### 1c. Where the numbers did come from — a real measurement of a different population

The sentence entered at commit **`fd59a4c7`, 2026-07-31 14:10:29** ("3.30.0 — every fix and
recommendation from the three reviews"). Its CHANGELOG entry is explicit that the figures were
computed in that pass — *"THE BRING PHRASING quality-filter.json has always mandated is now used
where bring statistics are reported. Measured: the filter keeps games 1.71x longer (7.4 vs 4.3 mean
turns, 19,589 vs 8,713)"* — with no artifact written and no script named. The citation to
`data/quality-filter.json` is a citation for the PHRASING RULE, which the artifact does mandate; the
figures were carried into it by proximity.

19,589 + 8,713 = **28,302 games**, which is larger than the entire ladder store on that date
(20,788), so no ladder-only population can produce it. Reconstructing over the three raw stores as
committed at that exact commit — a plain read of the `.gz` blobs, brought-both-sides-4 vs not, no
other filter:

| population at `fd59a4c7` | games | kept | dropped | mean turns kept | mean turns dropped | ratio |
|---|---|---|---|---|---|---|
| `games.ladder.jsonl` | 20,788 | 14,177 | 6,611 | 7.34 | 4.13 | 1.78 |
| `games.ots.jsonl` | 4,167 | 2,914 | 1,253 | 8.07 | 4.48 | 1.80 |
| `games.bo3.jsonl` | 2,898 | 1,990 | 908 | 8.05 | 4.45 | 1.81 |
| **union of the three** | **27,853** | **19,081** | **8,772** | **7.52** | **4.21** | **1.79** |

The union reproduces the published pair to within the hours of ingest between the committed blobs
and the live store at 14:10 (kept +508, dropped −59, total +449 — the store grows ~2,500/day). So
**the figures were a genuine one-off measurement over the UNION of the three raw, unfiltered
stores** — a population the quality filter does not describe, does not compute, and is not the
funnel the sentence points at. `require_full_bring` in the artifact is applied AFTER the bot,
behavioural-bot, forfeit and min-turns rules; the measurement applied it to raw stores with none of
those, which is why the counts are four times the funnel's.

The turn-mean pair does not reproduce exactly (7.52 / 4.21 measured here against 7.4 / 4.3
published, ratio 1.79 against 1.71). That gap is not chased: whatever population was actually in
memory at 14:10 is gone, and no artifact records it. It is the reason the ratio is **withdrawn
rather than restated** below.

### 1d. The replacement, as a diff

The same sentence is in **two** live documents and must move in one pass, or
`engine/docs_scan.js`'s retraction registry will register `19,589` as withdrawn in one and then
correctly flag the other:

- `docs/ABRA-whitepaper.md:1602`
- `docs/SUMMARY.md:1184`

Both are byte-identical today. The diff below is written for the white paper; apply the identical
text at `docs/SUMMARY.md:1184`. Both PDFs (`docs/ABRA-WhitePaper.pdf`, `docs/SUMMARY.pdf`) rebuild
in the same pass, plus a CHANGELOG entry and a version bump, per the living-docs rule.

```diff
--- a/docs/ABRA-whitepaper.md
+++ b/docs/ABRA-whitepaper.md
@@ -1602 +1602,3 @@
-**A phrasing the filter itself mandates.** `require_full_bring` conditions on game length: measured 2026-07-31, the games it keeps are **1.71x longer** on average (7.4 vs 4.3 mean turns; 19,589 kept vs 8,713 dropped). Every bring statistic in this project is therefore *"the bring, **among games long enough to show it**"*, which is not the same as "the bring". `data/quality-filter.json` states this at the point of filtering and requires it to be said downstream; this is that.
+**A phrasing the filter itself mandates.** `require_full_bring` conditions on game length, so every bring statistic in this project is *"the bring, **among games long enough to show it**"*, which is not the same as "the bring". `data/quality-filter.json` states that at the point of filtering, in `rules.require_full_bring.known_limitation`, and requires it to be said downstream; this is that. The size of the conditioning is the step the artifact actually records: `provenance.funnel.after_min_turns` **26,142** to `provenance.funnel.after_full_bring` **18,908**, measured on `provenance.store_size` **67,384** at `provenance.measured_on` 2026-08-27.
+
+**AND THE THREE FIGURES THIS SENTENCE USED TO CARRY ARE WITHDRAWN, BECAUSE THE ARTIFACT IT CITES NEVER HELD THEM.** It read ~~1.71x longer on average, 7.4 vs 4.3 mean turns, 19,589 kept vs 8,713 dropped~~, citing `data/quality-filter.json`. That file has six commits and not one of them contains those counts, and no version of it has ever carried a mean-turn field at all — so the citation could not have supported them on any day, which is a larger failure than a figure going stale. They were a one-off measurement made on 2026-07-31 over the UNION of the three raw stores with no filter applied, a different population from the funnel the citation names and one nothing computes now. The length-conditioning CLAIM stands on the artifact's own `known_limitation`; the RATIO is withheld until something measures it against a pinned store.
```

Field names the replacement cites, all present in `data/quality-filter.json`:
`rules.require_full_bring.known_limitation`, `provenance.funnel.after_min_turns`,
`provenance.funnel.after_full_bring`, `provenance.store_size`, `provenance.measured_on`.

Three notes for whoever applies it:

1. **26,142, 18,908 and 67,384 are literal values in the cited artifact**, so
   `docs_scan.js`'s `citationMismatches` clears them. 7,234 is deliberately NOT written as a bare
   figure — it is stated as a step between two named fields.
2. **The withdrawal paragraph is one physical line on purpose.** The retraction registry extracts
   per-line: a `~~…~~` span only registers when a retraction verb sits on the same line. `1.71`,
   `7.4` and `4.3` are below the distinctiveness floor and will not register, so no small-integer
   poisoning follows.
3. **Re-deriving the length ratio is a filter pass over the store, not an engine job** — but the
   store is appended hourly by OPS, so it needs a run that pins the store, and it must go through
   `engine/quality.js` rather than a re-implementation of the six rules.

---

## 2. `docs/WEB.md:117` — living document, so the figure is WITHHELD

### 2a. The classification, read rather than felt

Three independent sources agree, and none of them is a judgement call:

1. **CLAUDE.md's living-docs rule** names `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md` as the division
   ledger that must be updated in the same pass as any change. `docs/DIVISIONS.md` lists
   `WEB.md` as WEB's ledger in the division table.
2. **`engine/docs_scan.js` `liveDocs()`** enumerates every `.md` in `docs/` and the repository root,
   with exactly one exemption, `CHANGELOG.md`. `docs/WEB.md` is in the scanned set by construction.
3. **`data/docs-currency-baseline.json`** lists `docs/WEB.md` under `unversioned_exempt`, whose own
   `note_unversioned` reads: *"They are EXEMPT FROM RULE 1 ONLY - they are still scanned by the
   retracted-number rules."* Rule 1 is the version-header rule. The figure rules apply.

It is **not** in `archive_grandfathered`, it is not in `docs/archive/`, and it carries no
`SUPERSEDED … by <file>` header — the only two routes by which a document in this repository is
treated as historical. It is a living document. **The figure must be withheld, not annotated.**

**WEB being a PAUSED division does not change the answer, and cuts the other way.** A pause stops
new work; it does not make a published figure true, and `docs/WEB.md` is what a reader consults to
learn what the site claims. If anything a paused ledger is worse: nobody is looking at it, so the
figure sits longer. And the pause and the quarantine have the SAME cause — MEDICHAM not being
correct — so the figure cannot become quotable before the pause lifts anyway.

### 2b. Why nothing caught it, which is the part worth keeping

Two mechanisms, both structural:

- **`engine/docs_scan.js` has no quarantine clause at all.** Grep for `quarantin` in that file
  returns nothing. Its citation rule asks *"is this figure in the artifact it cites?"* — and
  `data/winrate-backtest.json` genuinely contains `51.0` and `1314`, so the sentence PASSES. The
  gate cannot distinguish a faithful citation of a quarantined artifact from a faithful citation of
  a live one. `engine/status.js` withholds the figure; `docs_scan.js` re-publishes it.
- **`docs/WEB.md` receives no generated stamp, ever.** `engine/status.js` defines
  `SECTIONS = { ENGINE, MEASURE, SEARCH, OPS }` (line 1126) and `--write` iterates those blocks only.
  WEB is not in the set, so `--write` does not stamp it and does not even print a skip line for it.
  There is no `<!-- GENERATED -->` block in `docs/WEB.md`. **Every number in the WEB ledger is
  hand-typed and cannot self-correct** — the fourteen-stale-handoffs mechanism, inside the ledger
  system that replaced them.

Neither is fixed here. Both are MEASURE's to file.

### 2c. What the artifact actually says about itself

`data/winrate-backtest.json`, `measured_at` 2026-08-04T07:09:31Z, records
`measured_against["engine/medicham2-browser.js"]` = `{ bytes: 134648, sha256_12: "0710a325219e" }`.
The live file read 3,039,719 bytes mid-pass and is being edited right now. `node engine/status.js`
prints leaf calibration as `QUARANTINED — the figure is withheld, not annotated`, names
`engine/backtest_winrate.js` as in the play layer, and states the lift condition: the MEDICHAM gate
opens AND the backtest is re-run.

### 2d. The replacement, as a diff

```diff
--- a/docs/WEB.md
+++ b/docs/WEB.md
@@ -115,7 +115,9 @@
-  **And when the caveat itself goes stale, quote the artifact and strike the old claim.** This entry
-  used to read *"MEDICHAM's win rate is below chance and the Stadium says so"*. That was the
-  2026-07-23 reading. `data/winrate-backtest.json`, measured 2026-08-04, puts the live in-game leaf at
-  **51.0%** of 1,314 decisive calls, 95% CI **[48.3, 53.7]** — worse than a coin on Brier, but an
-  interval that *contains* chance, so "below chance, systematically inverted" is a stronger claim than
-  the evidence now supports. A memorable caveat is exactly the kind of sentence that survives the
-  measurement it came from.
+  **And when the caveat goes stale, strike the old claim — and when the artifact under it is
+  QUARANTINED, strike it and print NOTHING in its place.** This entry read *"MEDICHAM's win rate is
+  below chance and the Stadium says so"* (the 2026-07-23 reading), and was then rewritten to quote a
+  leaf calibration figure from `data/winrate-backtest.json`. **That figure is withheld.**
+  `node engine/status.js` prints leaf calibration as QUARANTINED: the artifact was measured on
+  2026-08-04 against an `engine/medicham2-browser.js` of **134,648** bytes, against a live simulator
+  more than twenty times that size, so it is a claim about a build that no longer exists. A caption is
+  not a quarantine, so no number, no interval and no sample size is carried here in its place. It
+  becomes quotable when the MEDICHAM gate opens AND `node engine/backtest_winrate.js` is re-run.
```

`134,648` is `measured_against["engine/medicham2-browser.js"].bytes` in the cited artifact, so the
block still cites a figure the artifact contains — the replacement does not create a new untraceable
number, and it says nothing about calibration. "More than twenty times" is written in words
deliberately: a derived ratio against a file ENGINE is editing this minute would be wrong within the
hour.

**A second instance in the same bullet, reported and not diffed.** `docs/WEB.md:112` reads *"MILTANK's
cabinet says its 55.5% is biased high by the stopping rule"*. MILTANK is on CLAUDE.md's quarantine
list ("every model report that reads a rollout"), and that block cites no artifact at all. It needs
the same ruling and it is outside the brief; it goes to WEB with this.

---

## 3. The umbrella parity check — ABRA was unchecked, not verified

File: `C:\Users\willj\Projects\portfolio\build\check_projects.py`. **Outside this repository. Changed
on disk, not committed, not pushed.**

### 3a. How `STAMPS` was used, and what a missing entry did

`STAMPS` mapped `project folder -> (relative file, regex)`. The version-consistency loop read:

```python
if base in STAMPS:
    ...compare CHANGELOG top against the stamped version...
else:
    print(f'{proj.ljust(14)} changelog={cv}  (no stamped artifact to compare)')
```

**A missing entry skipped silently and there was no fallback.** It printed a row, contributed nothing
to `vgaps`, and could not fail the build. Four of eight projects were in that state — ABRA, Event
Desks, KaizoDex, Portfolio, Guardian Chess (five, in fact) — and the run still ended
`All versions consistent.` if the three listed projects agreed. A hand-typed list of three deciding
which projects get audited is the same failure ABRA's CLAUDE.md is written about, one directory up.

**A second, larger defect found while reading it:** the artefact-gap block called `sys.exit(1)`
BEFORE the version-consistency section. So the version check was **unreachable whenever any project
was missing any of the twelve artefacts** — a LICENSE gap anywhere would silently disable version
auditing everywhere. It only ran today because every project happens to be complete.

### 3b. What was changed

1. **The version lookup is now DERIVED**, with `STAMPS` demoted to an override list for the two
   stamps no shape rule can find (CHOMP's userscript `@version`, HoopaDex's HTML comment inside the
   deployed page). `jeopardy-wagering` was removed from the list because it is now found by
   derivation — same file, same value.
2. **`find_stamp(base)`** looks for `docs/*whitepaper*.md` / `docs/*white-paper*.md` and reads a
   **masthead** version — first 25 lines, regex `\bversion\b\s*:?\s*\*{0,2}\s*(\d+\.\d+(?:\.\d+)?)` —
   which is the same rule and the same window as ABRA's own `engine/docs_scan.js versionHeader()`,
   cited in a comment. Searching the whole file would credit a document that merely mentions a
   version in prose.
3. **Ambiguity is reported, never guessed.** ABRA's `docs/` holds `ABRA-whitepaper.md` (5.258.0)
   beside `MEW-whitepaper.md` (1.0) and `SLOWKING-whitepaper.md` (1.0), which carry component
   version schemes. Taking the first glob hit would compare ABRA's CHANGELOG against MEW's stamp and
   accuse a correct document. The file is chosen by matching the basename against the project folder
   name, falling back to a generically named `white-paper.md`, falling back to a single candidate; a
   set with none of those is printed as `AMBIGUOUS` and counted as a gap.
4. **`UNCHECKED` is now its own row and is a gap**, so a project with no discoverable stamp fails the
   build instead of printing "nothing to compare" and passing.
5. **The early `sys.exit(1)` is removed**, so both sections always run; the process exits non-zero at
   the end if either produced gaps. Exit-code semantics are unchanged for a failing run.
6. Each row now prints the file the stamp came from and whether it was `(derived)` or `(override)`,
   so the ruler is visible.

**ABRA's stamp is `docs/ABRA-whitepaper.md`**, masthead line 3, `**Version 5.258.0 · Last updated
2026-09-06**`, against `CHANGELOG.md` top `## [5.258.0] — 2026-09-06`. (`package.json` carries no
`version` field, so it is not the stamp.)

### 3c. Every row, after the change

```
Version consistency
============================================================
CHOMP          changelog=2.5.0    file=2.9      MISMATCH  <- app/plugin/chomp-bring4.user.js (override)
HoopaDex       changelog=5.47     file=5.47     ok        <- app/index.html (override)
Event Desks    changelog=1.0.3    file=1.0.1    ok        <- docs/white-paper.md (derived)
KaizoDex       changelog=1.1.0    file=1.0.0    MISMATCH  <- docs/KAIZODEX-whitepaper.md (derived)
ABRA           changelog=5.258.0  file=5.258.0  ok        <- docs/ABRA-whitepaper.md (derived)
Portfolio      changelog=1.6.0    file=1.0      MISMATCH  <- docs/PORTFOLIO-whitepaper.md (derived)
Jeopardy Wager changelog=1.4.0    file=1.4      ok        <- docs/white-paper.md (derived)
Guardian Chess changelog=1.0.0    file=1.0.0    ok        <- docs/GUARDIAN-CHESS-whitepaper.md (derived)
EXIT=1
```

The artefact table above it is unchanged: all eight projects, all twelve artefacts, `yes`.

**ABRA reads `ok`, and it now reads it because something compared two files.** That is the whole
point of the change; it was `ok`-by-omission before.

**Three MISMATCH rows, none of them touched.** CHOMP's was already firing before this change.
KaizoDex and Portfolio are newly VISIBLE, not newly broken — their white papers sit at 1.0.0 and 1.0
while their changelogs read 1.1.0 and 1.6.0. Per the brief, other projects' gaps are reported and
left alone.

**One weakness left in place and named:** `norm()` compares MAJOR.MINOR only, so Event Desks reads
`ok` at changelog 1.0.3 against a white paper stamped 1.0.1. Tightening it to full semver would flag
Event Desks, which is another project's gap, so it is reported rather than changed.

---

## 4. What this pass did not do

- **No engine job, differential, census, roster or release cut.** The heaviest things executed were
  `git show` of three `.jsonl.gz` blobs into the scratchpad and a JSON line-count over them, plus
  `python check_projects.py`. Nothing loaded the simulator, the board or the tags.
- **No file in this repository was written except this report.** No `docs/*.md`, no `data/`, no
  `engine/`, no `tests/`, no `web/`, no `CHANGELOG.md`.
- **`engine/status.js --write` was not run** and no `<!-- GENERATED -->` block was touched.
- **Nothing was committed and nothing was deleted.** The three scratchpad extracts are session files
  under the scratchpad, created this session.
- **The two diffs are proposals.** Neither was applied; both need their PDF, CHANGELOG and version
  bump in the same pass, and the white paper's must land with `docs/SUMMARY.md` in that same pass or
  the retraction registry will go red on the copy left behind.
