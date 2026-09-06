# THE NARRATION GATE, THE DOCS QUARANTINE CLAUSE, AND WEB'S GENERATED BLOCK — BUILD ACCOUNT

MEASURE, 2026-09-06. Three gate-level fixes built. Nothing committed. `status.js --write` NOT run.
No differential, census, roster stage or release cut was started, and nothing under `web/`,
`engine/steering.js`, `engine/medicham2-browser.js`, `engine/board_state.js` or
`engine/game_differential.js` was touched — an ENGINE agent was editing those throughout.

## 0. THE SPEC'S NUMBERS, RE-DERIVED BEFORE ANYTHING WAS BUILT ON THEM

Read from `git show 324ae2b8:data/game-differential.json` (release `db248fe67a5e`), never from the
live file, which was rewritten at 04:19 while this ran.

| spec `docs/_reports/2026-09-06-narration-gate-spec.md` says | measured here | verdict |
|---|---|---|
| `by_cause_totals`: 130 causes / 151 games | 130 / 151 | confirmed |
| `games_narration_only` 105, `NARRATION_ONLY` 86 causes | 105 / 86 | confirmed |
| `games_board_material` 46, `BOARD_MATERIAL` 44 causes | 46 / 44 | confirmed |
| `by_cause_reconciles: true`, 105 + 46 = 151 | true, sums | confirmed |
| board clause quantity `games − games_board_never_diverged` = 961 − 911 = 50, and the 4-game gap is real | 50, gap 4 | confirmed |
| only **52 of 130** causes appear in the capped `first_divergences` (66 of 151 games) | 52 / 130, 66 games | confirmed |
| `fairyaura` / `unnerve` appear zero times | zero | confirmed |
| **"36 of the 86 narration-only causes occur exactly once"** | **76 of 86** | **WRONG — corrected** |

The games-per-cause histogram of the narration-only rows is `{1: 76, 2: 7, 3: 1, 6: 2}`. Mean 1.22
(105/86) is right, so the spec's own mean and its singleton count disagree; the "~29 singletons" row
in its §1.5 table is a MECHANISM-level grouping and the §1.5 sentence read it as a CAUSE-level one.
The error is in the safe direction — the tail is longer than the spec argued, so its case against a
"≤5 games" tolerance is stronger, not weaker — but the number is corrected here rather than carried.

**The artifact moved under this work, twice.** `HEAD` (54ecb6f3, release `a985300cb8ed`) already
carries a smaller run: 961 games, **114** raw protocol, 110 causes, **69 narration-only games / 67
causes (65 singletons)**, 45 board-material games / 43 causes, `games_board_never_diverged` still 911
so the board clause quantity is still 50. Nothing here is hardcoded to either run.

---

## 1. TASK 1 — THE NARRATION CLAUSE. `engine/quarantine.js`

### 1.1 What it reads today: **WITHHELD, and that is the correct answer**

```
RPRT  whole-game differential / NARRATION — protocol divergence with no board effect
  MEASURED AGAINST A DIFFERENT ENGINE — data/game-differential.json ran on release a985300cb8ed
  and the tree is 2a5fd78725e7. ... EVERY COUNT IN IT IS WITHHELD and none is repeated here.
  exit 2
```

The ENGINE agent is editing `engine/medicham2-browser.js` right now, so the shared pin door
(`wholeGameDoor`) refuses the artifact and publishes no count. **The BOARD-MATERIAL clause is refused
by the same door on the same bytes**, so the two agree. The tree digest moved twice during this
session (`583f3f5ff815` → `2a5fd78725e7`).

**The quantity the clause WOULD read, taken off the committed artifact by hand and labelled as a
derivation rather than as the clause's verdict: 69 of 961 narration-only games across 67 causes, 65
of them occurring once, on release `a985300cb8ed`.** That figure is not quotable as a gate verdict
until the differential is re-run against the current bytes.

### 1.2 The change

- **Quantity** — `end_state[0].summary.by_cause_totals.games_narration_only`, less declared, less
  decision-cleared, exposed as `quantity: 'narration_only_undeclared_games'`. It was `j.diverged`
  (151 on the spec's artifact), 46 of which also part a board and are the other clause's business.
- **Refusal, not fallback** — an artifact with no reconciled `by_cause_totals` returns
  `withheld: true` / `cannot_answer: true` and prints no number. There is deliberately no fallback
  onto `diverged`; that is what would publish the board clause's population under this one's name.
- **Threshold: zero undeclared**, with the tail printed beside it (`TAIL: N of M causes occur in
  exactly ONE game`) so the reason for zero is visible rather than argued in a comment.
- **The name moved with the quantity** — `whole-game differential / NARRATION — protocol first
  divergence` → `… — protocol divergence with no board effect`. A row titled with a different number
  from the one underneath it is ROADMAP #387 exactly.
- **The trend is labelled** — `progress` / `regressed` still compare the RAW protocol rate against
  `data/whole-game-baseline.json`, because that is what the baseline was stamped on. Both trend
  sentences now say so in words, so the trend cannot be read as a trend in the verdict quantity.

### 1.3 `gates` is COMPUTED

```js
const board = boardClause === undefined ? wholeGameClause(artifact) : boardClause;
const gates = !!(board && board.ok === true && board.pins);
```

`medichamIsCorrect()` computes the board clause once and hands it in, so one artifact is not parsed
twice and there is only ever one board verdict in play. `pins` is part of the condition because
`PIN.audit` withholds a receiptless clause — reading `ok` alone would let narration start gating on a
verdict the assembled gate refuses.

Selftest arms (`node engine/quarantine.js --selftest`, **226 passed, 0 failed**):
- ARM A (12 boards part, narration clean) → narration `gates: false`, verdict says *REPORTS, IT DOES
  NOT HOLD THE GATE SHUT*;
- ARM B (40 narration divergences, no board parts) → **narration `gates: true`**, verdict says *THIS
  CLAUSE NOW HOLDS THE GATE SHUT*;
- and the flag MOVES between the two arms — a typed `gates: false` reads identically on both, which
  is the unwired-knob shape this repository has a receipt for.
- A refusal path with clean boards now carries `gates: true`: a clause that cannot answer holds the
  quarantine shut once boards are clean. That is the safe direction and it is asserted.

### 1.4 The anti-absorption rule — the part most likely to go wrong

The declared/decision-impact loop iterates `by_cause` rows whose `materiality` is `NARRATION-ONLY`
**only**, so a declaration cannot subtract a cause the artifact measured as parting a board even if
its matcher is `() => true`. A second pass runs the same matchers over the BOARD-MATERIAL rows purely
to NAME what they would have taken, subtracting nothing:

```
  A DECLARED ROW MATCHED A BOARD-MATERIAL CAUSE AND WAS NOT SUBTRACTED [1]:
    `<row>` [AUTHORITY-WRONG] matched `<cause>`, which parted a board in 3 of its 3 game(s).
      A narration declaration asserts no board moves; this artifact MEASURED one that does.
```

Exported as `declared_matched_board_material`. Four selftest arms drive it on ONE knob — the same
cause, the same evidence, the same `match: () => true` row, with only `materiality` changing:
subtracts 1 on NARRATION-ONLY, subtracts 0 and is named on BOARD-MATERIAL, and the declared count
MOVES between them.

### 1.5 Five lines the count may not be printed without

1. **`THIS IS A LOWER BOUND, NOT A COUNT OF DEFECTS`** — a game records only its FIRST divergence, so
   a defect that is never earliest is not counted at all; Fairy Aura's `-ability` on entry/mega and
   Unnerve's on switch-in are named in the line as the two measured, unfixed examples.
2. **`BOUNDED BY:`** — the artifact's own `bounded_by` sentence (board_state NOT_COMPARED + turn cap),
   quoted, not paraphrased.
3. **`NOT THIS CLAUSE:`** — the board-material games and causes, with `by_cause_reconciles`, so the
   two rows can never be read as one quantity.
4. **`LARGEST:` / `TAIL:`** — the top five causes and the singleton count, derived from the rows.
5. **`EVIDENCE COVERAGE`** — see below.

### 1.6 The `DECLARED_DIVERGENCE` mechanism: **left, and declared**

Two hand-typed rows; the spec's finding is confirmed. `fallenundefined` matches nothing (the register
printer already says so on every run). The perish-drain `CLOSETED` row matches a cause and DECLINES,
because its evidence predicate reads `first_divergences`, which the differential writes CAPPED.

I did not repair it, and the reason is ownership: the cap is in `engine/game_differential.js`, which
an ENGINE agent is editing. What the clause now does instead is refuse to be silent about it — every
run prints, derived from today's artifact:

```
  EVIDENCE COVERAGE — N of M cause(s) (X of Y games) carry a row in `first_divergences`, which is a
  CAPPED sample. A DECLARED_DIVERGENCE matcher that requires evidence cannot be judged on the other
  … and DECLINES by construction — the safe direction, and still wrong: whether a declaration is
  honoured is currently a function of the cap. The repair is in engine/game_differential.js.
```

**OWED to ENGINE:** write `first_divergences` rows uncapped for any cause a declaration names, or
publish an uncapped cause→evidence index. On the spec's artifact this silently cost 57% of the
population the ability to be declared at all.

---

## 2. TASK 2 — THE DOCS QUARANTINE CLAUSE. `engine/docs_scan.js`

### 2.1 What it caught

**104 figures across 14 documents are sourced from an artifact the gate currently withholds** (72
artifacts withheld). Per document: MODELS 23, ROADMAP 19, MEASURE 17, whitepaper 15, SUMMARY 8,
ENGINE 5, SEARCH 5, WEB 4, technical-docs 2, MILTANK 2, and one each in ENGINE-COVERAGE-PLAN,
EXTERNAL-EVIDENCE, GAME-DIFFERENTIAL-DESIGN, PRIORITIES.

The rule: a paragraph that CITES a quarantined artifact and states a figure that artifact contains.
The withheld set is `require('./quarantine.js').state().withhold` — the same function `status.js`
asks, so no list is typed and the clause correctly accuses nobody on the day the gate opens
(`gate_open` is returned and printed).

**There is no prose escape.** `citationMismatches` skips a paragraph matching `QUALIFIED`
("previously", "stale", "was measured"); this rule refuses that, because an escape spelled with a
word is a caption and a caption is what the rule exists to refuse. A permanent selftest arm asserts
it.

**`isDistinctive` is the coincidence bar** — the file's own. Dropping it turns 104 into 468, because
`policy-weights.json` holds tens of thousands of floats and any two-digit integer matches one.

### 2.2 It is NOT a second copy of an existing mechanism — checked first

`engine/quarantine.js --check` already ratchets citations into `data/quarantine-stamp.json`, and it
holds **3** sites. It matches the first ~50 characters of a quarantined artifact's own
`verdict`/`headline`/`summary` STRING. That is why nothing fired on 2026-09-06: it catches a document
quoting the SENTENCE and cannot see one quoting only the NUMBER beside a faithful citation. Verdict
granularity there, FIGURE granularity here, and the figure lexer lives only in `docs_scan.js`. The
cross-reference is written into the clause header so the next reader does not merge them.

### 2.3 Shown RED, three ways

- **Live, against the real gate, no file touched.** Re-inserting the withheld leaf sentence into
  `docs/WEB.md` through the clause's `read` injection point took it from **4 hits to 6** — the two new
  ones being `51.0% <- data/winrate-backtest.json` and `1,314 <- data/winrate-backtest.json`, neither
  in the seeded baseline, so the gate goes RED. Removing it returns to 4.
- **Synthetic red arm**, permanent, in the test: a paragraph citing a withheld artifact and stating
  `51.0%` is caught.
- **Control**, permanent: the identical paragraph with the artifact NOT withheld is clean, so the
  clause keys on the gate rather than on the citation.
- **Caption arm**, permanent: the same paragraph wrapped in "PREVIOUSLY / now stale / was measured
  before the fix" is STILL caught.

### 2.4 The gate: `tests/test-docs-quarantine.js` (new, auto-discovered by `tests/run-all.js`)

A ratchet, seeded with the 104 keys as a literal, keyed `doc|figure|artifact` so prose can move. A
key not in the list FAILS; a key that stops firing is REPORTED so the line can be deleted. Runs in
11s. **This is debt made visible, not a tolerance:** every offender is named, nothing is absorbed by a
word in a paragraph, and the list cannot grow without somebody typing into it.

The alternative — a zero-threshold gate — would be RED on day one over 104 findings in ledgers owned
by four other divisions, and a red gate nobody can clear is how "one of the two known failures" got
normalised for two days. The baseline is NOT written by the run; a self-seeding baseline adopts
whatever the tree looks like on the day it breaks.

**Where the baseline lives, and why not in `data/`:** a new `data/*.json` with no `source_digests`
joins `mtime_only_files` in `data/provenance-stamp.json`, which is a ratchet that may only shrink —
adding one artifact would have turned `provenance --strict` red as a side effect.

---

## 3. TASK 3 — WEB'S GENERATED BLOCK. `engine/status.js`

`SECTIONS` is now `{ ENGINE, MEASURE, SEARCH, OPS, WEB }`. What it prints today, verbatim:

```
WEB — the site, and what it is allowed to publish
  no sprint marker on disk (docs/MEDICHAM-SPRINT-NOTES.md absent) — the living-docs rule is fully armed for this division too.
  web/quarantine-data.js: built 2026-08-25 19:07  — the site publishes 3 of 8 clauses failing, gate CLOSED
    the LIVE gate says 6 of 8 GATING clauses fail  (CLOSED)
    DRIFTED — the committed bundle is not what the gate says today.
      published clause(s) the gate no longer has: whole-game differential / the same game on both engines
      clause(s) the gate has and the bundle does not: whole-game differential / BOARD-MATERIAL — games whose boards part; whole-game differential / NARRATION — protocol divergence with no board effect
    withheld set: 60 artifact(s) in the bundle against 72 quarantined today
    0 figure(s) are RELEASED to the pages; every other slot carries no value at all, which is the withheld-not-annotated rule in the bundle itself
  web/status-data.js: built 2026-08-10 21:32  — 13 of 51 slot(s) carry state "quarantined" and publish no value
  docs/WEB.md: 4 figure(s) sourced from a QUARANTINED artifact are still stated — 134,648 <- data/winrate-backtest.json; 63.2% <- ...; 16.9% <- ...; 84.3% <- ...
  rebuild the bundles: node web/build-quarantine.js && node web/build-status.js   — a PUBLISH (app/) is Will's call and this file never makes one.
```

Every figure is READ: a timestamp out of a bundle, a count of rows in it, or the live gate as
`quarantine.js` computes it. **It authors nothing**, it renders no site, and it writes nothing under
`web/`. The pause is read off the sprint marker rather than typed, so it cannot go stale.

The bundles are PARSED, never executed — a brace-balanced, string-aware scan, because running page
code inside the one command every session starts with is not acceptable, and a `}` inside a clause
`why` sentence would end a naive scan early.

**`docs/WEB.md` has no `<!-- GENERATED -->` block**, and the writer used to print `skip WEB.md (no
GENERATED block)` and move on — which is why every number in that ledger stayed hand-typed. `--write`
now INSERTS an empty block immediately above the first `## ` heading (where the other four ledgers
carry theirs) and stamps it on the same run, naming what it did. No prose is moved and nothing is
deleted. **This path has not been executed: `--write` was not run, per the brief.**

---

## 4. GATES RUN

| gate | result |
|---|---|
| `node engine/quarantine.js --selftest` | **226 passed, 0 failed** |
| `node tests/test-divergence-composition.js` | exit 0 (fixtures updated — see below) |
| `node tests/test-docs-quarantine.js` (new) | all checks passed, 11s |
| `node tests/test-docs-current.js` | exit 0 |
| `node tests/test-roadmap-register.js` | exit 0 |
| `node tests/test-register-cell-parse.js` | exit 0 |
| `node tests/test-register-reality-readonly.js` | exit 0 |
| `node engine/status.js --selftest` | 6 + 7 passed, 0 failed |
| `node engine/status.js` (read-only) | exit 0 |
| `node engine/docs_scan.js` | exit 0 |
| `node tests/test-no-silent-failure.js --only <my 5 files>` | exit 0 (one new silent catch was found and fixed) |

**`tests/test-divergence-composition.js` was edited and it is outside my three files.** Its eleven
arms build artifacts with no `end_state`, so the new refusal turned all of them into withheld
clauses and the file went red — the THIRD time that file has gone red for a fixture declaring less
than a real artifact does, as its own two comment blocks record. The `end_state` split is now DERIVED
from each fixture's causes rather than typed beside them. Editing it was unavoidable: "known failure"
is a banned phrase, and the file touches nothing the ENGINE agent is working on.

**Three WEB tests are RED and were red before this work: `test-web-quarantine-loaders`,
`test-web-status`, `test-site-data-fresh`.** They fail on the committed bundles being 12 and 27 days
old (e.g. `engine.live = 423` in a bundle built 2026-08-10 against a census reading 829 today).
Nothing in this change can move those numbers, and clearing them means rebuilding `web/`, which is
forbidden to me and is a publish decision. **Reported, not filed as "known".**

---

## 5. OWED, AND NOT DONE HERE

1. **The differential re-run.** Both whole-game clauses are refused at the pin door because
   `engine/medicham2-browser.js` moved. No narration figure is quotable until ENGINE settles and the
   run is repeated.
2. **`engine/game_differential.js`: uncapped evidence for declared causes** (§1.6). Until then a
   declaration is honoured or refused depending on whether its cause fit in a capped list.
3. **104 quarantined figures in 14 living documents** (§2.1). A documents pass across four ledgers.
   The list is in `tests/test-docs-quarantine.js`'s `BASELINE`, and every line deleted from it is a
   figure withheld.
4. **The web bundles are 12 and 27 days stale** and publish a clause name the gate no longer has.
   WEB's, and a publish is Will's.
5. **CHANGELOG entry, version bump and ledger judgement.** Not written — the brief reserves
   publishing. `tests/test-docs-current.js` is green as the tree stands.
6. **Register rows** for items 2, 3 and 4. `docs/ROADMAP.md` is not mine to edit in this pass.

## 6. FILES CHANGED

- `engine/quarantine.js` — narration quantity, computed `gates`, anti-absorption, five print lines,
  clause rename, header, `--narration` CLI, selftest fixtures + 9 new arms.
- `engine/docs_scan.js` — `quarantinedFigures()`, `quarantineKey()`, CLI census section.
- `engine/status.js` — `web()` section, `webBundle()` parser, `SECTIONS` + WEB, `--write` inserts a
  missing GENERATED block.
- `tests/test-docs-quarantine.js` — NEW.
- `tests/test-divergence-composition.js` — fixtures only (see §4).

Nothing committed. `status.js --write` not run.
