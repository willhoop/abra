# Cleaning the ladder corpus of custom-ruleset games — 2026-09-21

Dated findings record. Historical by construction: not a living document, not maintained, not to be
cited as current state. Supersedes §5b of `docs/_reports/2026-09-21-six-bring-game.md` and nothing
else in it.

**THE STORE WAS NOT EDITED.** `store raw, analyze on top`. Every game stays; the ANALYSIS excludes.
`extract()` was not touched — the six-bring investigation proved it innocent byte for byte.

---

## 0. Verdict

| | |
|---|---|
| store rows played under a custom ruleset | **6,952 = 7.37% of 94,360** |
| — of those, altering legality or the pick count | **129** (149 by the wider `+X`/`-X` classifier) |
| — of those, setting a different information regime | **6,823**, of which **5,210** are a bare `Best of = 3` |
| clean ladder corpus, before → after | **33,539 → 28,454** (−5,085, −15.16%) |
| the earlier figure, 1,176 | **superseded** — its regex required the plural `custom rules:` |
| any published Reg M-B figure affected | **no** — the frozen team pool shares zero ids with the ladder store |
| untestable | **17,527 rows (18.57%)** have no local raw log and were never asked |

---

## 1. Which number was right, and why the other one was wrong

The brief carried two counts of the same thing: **1,176** (the six-bring investigation, §5b) and
**6,952** (a later scan). They differ by a single character in a regular expression.

Showdown writes the infobox summary as `<strong>1 custom rule:</strong>` when a room sets exactly one
rule and `<strong>N custom rules:</strong>` otherwise. The investigation matched
`<strong>(\d+) custom rules:</strong>` — **plural only** — so every one-rule room was invisible to it,
and a one-rule room is overwhelmingly a bare `Best of = 3`.

`engine/scan_custom_rulesets.js` matches `custom rules?:` and reports the split on every run, so the
claim is checkable rather than argued:

```
custom-rule infobox  6,978 (9.03%)  in 30 distinct rule strings
  plural "rules:"    1,186   <- what the 2026-09-21 investigation could see
  singular "rule:"   5,792   <- what it could not
```

**Reconciled to the unit.** Joining the plural subset to the store gives **1,184**, against the
investigation's 1,176, and its per-string joined counts reproduce **exactly**:

| rule string | this scan, joined | §5b |
|---|---|---|
| `Force Open Team Sheets, Best of = 3` | 691 | 691 |
| `Best of = 3, !OpenTeamSheets` | 170 | 170 |
| `Best of = 3, !Open Team Sheets` | 101 | 101 |
| `!open team sheets, best of=3` | 56 | 56 |

The residual 8 is one rule string the earlier tally does not hold — `Best of = 3, - Garchomp,
- Kingambit, - Incineroar, …`, 8 rows — which also accounts for **20 plural strings here against its
19**. The legality subset matches **129 both ways**, which is what cross-checked the classifier.

**So: 6,952 is right, and the brief's hypothesis was correct in substance.** The missing rows are the
single-rule boxes, which are dominated by plain `Best of = 3`.

---

## 2. The instrument

`engine/scan_custom_rulesets.js` — two streaming passes, ~5 s, no game is played.

1. **`data/games.ladder.raw-logs.jsonl`** (77,235 records, mtime `2026-09-04T05:30:37Z`). The infobox
   lives only in the raw log. Each record's id is read with a regex against the first key rather than
   by parsing a 100 KB log 77,000 times; a record without one is COUNTED, never skipped silently
   (0 of 77,235).
2. **`data/games.ladder.jsonl`** (94,360 rows, 94,360 unique ids, mtime `2026-09-21T02:33Z`,
   494,439,698 bytes — identical at the start and end of the pass, so nothing moved under the
   measurement). This pass produces the join and the untestable share.

It stamps `by`, `generated` and `report` (conformance S13), and it records the paths it **actually
opened** — repo-relative when inside the repo, absolute when not — rather than the canonical path for
that kind of file (ROADMAP #547).

**It prints the untestable share every run.** The count is a **FLOOR, never a census**: 17,527 store
ids (18.57%) have no local raw log, because the raw-log file is a snapshot of 2026-09-04 and the
parsed store kept growing. Silence there would let a partial scan read as a clean corpus.

### The two classifiers, and why the split is itself a lower bound

`alter_legality_or_pick` is the investigation's classifier, kept **unchanged** so the two runs
compare: `!obtainable`, `+past`, `+jirachi`, `+<stone>ite`, `!Picked Team Size`, `!Min Team Size`.
It returns 129, matching §5b exactly.

It is not complete, and the scan says so rather than quietly widening. A second classifier,
`entity_token` — any `+X` or `-X` token — returns 111 and catches what the first misses:
`+golisopod` (3), `+electrium z` (1), `-Drizzle, -Rain Dance, …` (2), and the two restricted-event ban
lists (8 and 6). Neither classifier contains the other: `!obtainable, forceopenteamsheets, bestof=3`
(34) has no entity token at all. **The union is 149.** Nothing turns on the split — both kinds are
excluded — so the split is reported and not used to decide.

---

## 3. Why both kinds are filtered

A minority alter what a team may legally CONTAIN or how many are picked. Those admit entities the
regulation does not contain, and their usage is not this format's usage.

The majority set a different **information regime**:

| rule string | raw rows |
|---|---|
| `Best of = 3` | 5,210 |
| `Force Open Team Sheets, Best of = 3` | 691 |
| `Force Open Team Sheets` | 470 |
| `Best of = 3, !OpenTeamSheets` | 172 |
| `Best of = 3, !Open Team Sheets` | 101 |
| `!open team sheets, best of=3` | 56 |
| `Best of = 5` | 46 |
| `bestof=3` | 41 |

These are **bo3 tournament games sitting in the bo1 ladder store**. This project keeps two human
stores and treats bo3 as a different metagame under a different information regime, so the rows are
MISFILED rather than merely odd. They reached the ladder store because `engine/durable-ingest.js`
discovers replays by FORMAT ID and Showdown indexes a custom-rule battle under its base format id —
a format id does not encode custom rules. That is the whole mechanism, and it is unchanged by this
work.

**They are not duplicates of the bo3 corpus.** `data/games.bo3.jsonl` namespaces its ids
`gen9championsvgc2026regmbbo3-…`, so these 6,952 rows are a separate population, not a second copy.

---

## 4. The funnel, before and after

One store read, one config, the only difference being whether the new rule is read.

| stage | BEFORE | AFTER |
|---|---|---|
| collected | 94,360 | 94,360 |
| after_bot_filter | 55,256 | 55,256 |
| after_behavioural_bots | 49,215 | 49,215 |
| after_forfeit_filter | 49,017 | 49,017 |
| after_min_turns | 46,368 | 46,368 |
| after_full_bring | 33,641 | 33,641 |
| after_legality | 33,540 | 33,540 |
| after_corrupt_winner | 33,539 | 33,539 |
| after_nonstandard_ruleset | — | 33,539 |
| after_custom_ruleset | — | **28,454** |
| **clean** | **33,539 (35.5%)** | **28,454 (30.2%)** |

Every stage above the new one is IDENTICAL, which is what makes the comparison a before/after rather
than two measurements.

- **removed from the clean corpus: 5,085** — rows whose only reason is `custom_ruleset`.
- **flagged anywhere: 6,952.** The other 1,867 were already excluded by another rule.
- **Enrichment 2.06×.** 7.37% of the raw store, 15.16% of the previously-clean corpus. Same direction
  and same cause as `exclude_illegal_teams`'s 2.27×: the bot and forfeit rules remove bot games, and
  bots do not play custom-rules rooms. **The corpus the models read was dirtier than the store.**
- **Side effect on the legality rule.** `exclude_illegal_teams`'s `removed_from_clean` falls
  **101 → 28** on the same store, because 73 of the games it alone excluded are now also flagged
  `custom_ruleset`. Its `flagged_anywhere` is unchanged at 155. Nothing was lost; the attribution
  moved, and that is the expected consequence of a multi-reason model.

`data/quality-filter.json`'s `provenance` block is restamped to the AFTER funnel, with the 2026-09-10
block (92,431 games, 32,080 clean) moved under `superseded` rather than deleted. The restamp is
necessary as well as correct: `tests/test-quality.js` allows 3 points of clean-share drift and this
change is 4.5, so leaving the old block would have made the gate red for the right reason at the
wrong number.

---

## 5. Does this move a published figure? — the judgement, stated plainly

**No published Reg M-B figure rests on a contaminated game.** Reg M-B's record is closed at 7.0.0 and
its engine figures rest on `data/team-pool-frozen`. Measured 2026-09-21:

| file | unique ids | custom-ruleset ids present |
|---|---|---|
| `data/team-pool-frozen/games.bo3.jsonl` | 13,214 | **0** |
| `data/team-pool-frozen/games.ots.jsonl` | 4,167 | **0** |
| `data/games.bo3.jsonl` (live) | 33,332 | **0** |
| `data/games.ots.jsonl` (live) | 4,167 | **0** |

**And the zeros are load-bearing for the right reason.** The frozen pool contains **no ladder rows at
all**: its bo3 half uses a different format-id namespace, and its ots half shares **zero** ids with
the ladder store (measured directly — 0 of 4,167). The 6,952 ids are ladder ids by construction, so
they cannot be in the pool. **This is a cleanup, not a retraction.**

Two honest qualifications, because a zero can be read as more than it is:

- For `games.bo3.jsonl` the zero is **structural** (different namespace), not a clean bill of health.
- For `games.ots.jsonl` there is **no local raw-log file**, so the open-sheet corpus has never been
  asked this question at all. A custom-ruleset game in it would be invisible to this scan.

**One published figure DID move, and it has been taken out rather than captioned.**
`docs/SUMMARY.md` published *"94,360 games recorded, 33,539 usable (35.5%), 28,681 teams"* citing
`data/live.js`. The usable count is now **28,454 (30.2%)** and is re-cited to
`data/quality-filter.json`; the two team counts are **WITHHELD**, not restated, because they have not
been re-derived. `data/live.js` (`usable 33539`, `usablePct 35.5`, `teams 28681`) and
`data/meta-usage.json` still carry the old figures and are **STALE** — they owe an OPS regeneration,
which is not this division's to run.

---

## 6. What was built

| file | what |
|---|---|
| `engine/scan_custom_rulesets.js` | **new.** Derives the id set; prints the untestable share and the singular/plural split every run. |
| `data/custom-ruleset-ids.json` | **new, generated.** 6,952 ids indexed into a 30-row `rule_strings` table, plus counts, source stamps and the untestable block. |
| `data/quality-filter.json` | **1.6.0.** `exclude_custom_ruleset` added; provenance funnel restamped; the 2026-09-10 block moved under `superseded`. |
| `engine/quality.js`, `engine/quality.py` | read the new rule **and** `exclude_nonstandard_ruleset`; both carry the untestable share to `funnel()` and print it. |
| `engine/sanity_check.py` | the bring clause honours the declaration, fails on an undeclared breach and on a stale declaration. |
| `tests/test-quality.js` | rule count 7 → 9; the two new funnel stages; a check that every ENABLED rule has a reason code a reader emits. |
| `docs/SUMMARY.md` | superseded figure deleted, not captioned. |

### `exclude_nonstandard_ruleset` had no reader, and that is its own finding

The rule was added to `data/quality-filter.json` at 1.5.0, switched on, given evidence and a
`report` — and **neither `engine/quality.js` nor `engine/quality.py` ever looked at it.** Every funnel
printed a plausible number and nothing said the rule was inert. That is this project's signature
failure mode: a capability absent with everything reporting success. A rule COUNT cannot catch it, so
`tests/test-quality.js` now asks each enabled rule for a reason code that a reader emits and a funnel
stage that counts it.

It is **not** redundant with the detector, and the file records why: its one declared id has **no raw
log on disk** (verified absent from `data/custom-ruleset-ids.json`), so the detector cannot see it and
never will. A declaration is the only thing that can cover a row whose evidence was fetched by hand.

### `sanity_check.py`, shown red on both breaks before being trusted

```
GREEN  store shape: nobody brings more than four ({0: 1524, 2: 12085, 3: 24549, 4: 150560, 6: 2};
       0 undeclared; 1 declared nonstandard_ruleset, excluded by data/quality-filter.json)

BREAK 1 — declaration emptied
FAIL   … 1 undeclared; 0 declared …; UNDECLARED: gen9championsvgc2026regmb-2676161109

BREAK 2 — a declaration whose row brings four
FAIL   … STALE DECLARATION - brings four or fewer now, remove from `declared`:
       gen9championsvgc2026regmb-2653451938
```

`data/quality-filter.json` was restored from a scratchpad copy and verified by sha256
(`2c3236d8df55…`).

### Provenance attributed the artifact to its READER

`engine/provenance.js --graph` first said `data/custom-ruleset-ids.json` was written by
`engine/quality.py`, via `path variable` — quality.py's `open(CUSTOM_RULESET, encoding='utf-8')` is a
READ, but at that rank a bare `open` counts, and the scanner's flag-bound output path scored lower.
That is the same false-attribution class provenance.js's own header records four times over. Fixed at
the writer: the default output path is spelled out **on the write line**, which is the rank the
checker treats as strongest. The graph now reads:

```
{ "file": "custom-ruleset-ids.json", "by": "engine/scan_custom_rulesets.js",
  "from": ["games.ladder.raw-logs.jsonl"], "corpus": "ladder", "storeDerived": true,
  "via": "write line" }
```

---

## 7. Tests

| | |
|---|---|
| `engine/sanity_check.py` | **96 passed, 0 failed** |
| `tests/test-quality.js` | **42 passed, 0 failed** — JS 28,454 / Python 28,454, identical selection `sha 41229c4830fc9d7c` |
| `engine/conformance.js` | **red before this pass and still red — none of it is mine.** `RATCHET — 96 baselined, 10 new (10 regression, 0 discovery), 28 fixed`. All ten are S13 on artifacts this pass never touched: `all-mechanics-fire.boardstate`, `conditional-audit`, `divergence-middle`, `exploitability-holdout`, `meta-nash`, `policy-weights-nopop`, `policy-weights-pre-censoring`, `pory-nn`, `raw-log-census`, `smogon-priors.observed`. 33 of the same S13 findings already exist in the committed `data/conformance.json` at `HEAD`. **`data/custom-ruleset-ids.json` and `engine/scan_custom_rulesets.js` are flagged by nothing** — grepping the whole run for either name returns no line. |
| `tests/test-docs-current.js` | **39 passed, 0 failed** |
| `tests/test-roadmap-register.js` | **3 passed, 0 failed** |

---

## 8. Deviations and things left as they are

- **`tools/lownode.cmd` could not be used.** This session's worktree sandbox refuses any `cmd`
  invocation, including `cmd //c echo hi`, so the documented wrapper was unreachable from Bash. The
  runs were plain `node`: two sequential-read streaming passes (~5 s, one core) and a funnel at
  **2,494 MB peak RSS / 8 s** under `--max-old-space-size=3500`. Neither is a core-pinning run, and
  nothing was spawned that was not waited on. Stated rather than hidden.
- **`engine/status.js --write` and `engine/provenance.js --strict` were NOT run**, per the brief:
  both write the absence of untracked files as fact from a worktree.
- **`data/games.ladder.jsonl` and `data/games.ladder.raw-logs.jsonl` were hard-linked into the
  worktree** so the tests could read them. Hard links, so zero extra bytes and a single inode; both
  paths are `.gitignore`d and neither is tracked. Leaving them costs nothing; deleting either name
  does not touch the data.
- **`data/quality-filter.json` was copied in from the main checkout**, where it sat modified at 1.5.0
  and untracked-adjacent. `engine/scan_custom_rulesets.js` and the six-bring report were likewise
  produced in the main checkout by an earlier pass; the scanner was rewritten here.
- **Nothing was deleted.** `data/custom-ruleset-ids.json` in the main checkout is the earlier pass's
  copy and was left where it is.

## 8b. Reg M-C: the same instrument, the opposite answer

Run because the rotation runbook needs it and because it is one command. Scratch output, not a tracked
artifact.

```
$ node engine/scan_custom_rulesets.js --raw data/games.gen9championsvgc2026regmc.raw-logs.jsonl \
      --store data/games.gen9championsvgc2026regmc.jsonl.gz --out <scratch>
  raw logs             1,412 records  (2026-09-09T20:52:08Z)
  custom-rule infobox  57 (4.04%)  in 2 distinct rule strings  -- 41 Force Open Team Sheets, 16 Best of = 3
  plural "rules:"      0        <- the old regex would have reported ZERO contamination here
  alters legality/pick 0
  store                33,743 unique ids
  JOINED               57 = 0.17% of the store
  UNTESTABLE           32,331 store ids have no raw log on disk (95.82%)

$ (the same id set, joined against the frozen M-C pool)
  data/team-pool-frozen-regmc/games.bo3.jsonl   23,473 rows    0 hits
  data/team-pool-frozen-regmc/games.ots.jsonl    1,359 rows   44 hits (3.24%)
      39  Force Open Team Sheets
       5  Best of = 3
```

**The M-B rule must NOT be copied to M-C, and this is the reason.** `Force Open Team Sheets` is the
rule that MAKES a ladder game open-sheet, and open sheets are the M-C scope — excluding those 39 would
delete exactly the evidence the scope was chosen to collect. Only the 5 `Best of = 3` rows are a
different information regime. **The cut is a judgement and it was not taken**: the pool is frozen, and
nothing is changed on the strength of five games. The M-B rule cannot reach them anyway — the id set is
ladder-only, and `data/team-pool-frozen-regmc` carries no ladder-store id.

**Every one of the 57 is a SINGLE-rule room, so the superseded plural-only regex would have reported
Reg M-C as entirely clean.** That is the clearest statement of what the one-character difference cost.

**Two things found on the way, both OPS's, neither fixed here:**

- `data/games.gen9championsvgc2026regmc.jsonl` on disk is a **1,412-row snapshot of 2026-09-09** while
  `data/games.gen9championsvgc2026regmc.jsonl.gz` beside it holds **33,743 rows** and is current.
  `engine/quality.js` and `engine/quality.py` both prefer the PLAIN file when both exist — correct for
  the ladder store, which a local collector appends to, and **wrong here**. Any reader of the M-C store
  today silently gets 4% of it.
- The M-C raw-log files stop at 2026-09-09 while the stores run to 2026-09-21, which is the whole of
  the 95.82%.

## 9. What remains

- **The 18.57% that cannot be asked.** Closing it is a re-fetch, which `store raw, analyze on top`
  says to avoid, or an ingest-schema change: `extract()` reads neither `|rule|`, nor the `|raw|`
  infobox, nor `|teamsize|`, so the store cannot answer *"was this played under the format's own
  rules?"* without going back to the log. Recording those at ingest makes every FUTURE row
  self-declaring and back-fills the 76,833 rows whose raw log is on disk as a re-derive.
- **`data/games.bo3.jsonl` and `data/games.ots.jsonl` are unfiltered for this.** The bo3 store has a
  raw-log file and was not scanned; the ots store has none.
- **`data/live.js` and `data/meta-usage.json` owe an OPS regeneration.**
- **Whether `exclude_illegal_teams` already caught some of the 129** was not measured here either —
  it was §5b's open question and it stays open. What IS measured is that the two rules overlap on 73
  games in total.

## 10. Commands

```bash
node engine/scan_custom_rulesets.js            # re-derive the id set; prints the untestable share
node engine/quality.js                         # the funnel, with the new stage and its caveat
python engine/sanity_check.py                  # the store-shape clauses
node --max-old-space-size=4096 tests/test-quality.js
node engine/provenance.js --graph --json       # confirm the writer attribution
```
