# The PORY two-feature baseline figure — what it was, and why it is withdrawn

MEASURE, 2026-08-29. Trigger: `tests/test-docs-current.js` at **22 passed / 1 failed**, blocking a push.

---

## 1. THE PREMISE WAS RIGHT IN SUBSTANCE AND WRONG IN ONE DETAIL

The brief named clause **3b(b)** — *"a figure attributed to an artifact is IN that artifact"*. The
failing clause is **3b(c)** — *"census: figures with no artifact behind them anywhere"*. 3b(b) was
green on the first run of this session and stayed green (baseline 65, now 65). The distinction is
load-bearing: 3b(b) fires on a paragraph that NAMES a `data/*.json` file; 3b(c) fires on a paragraph
that names none and states a number no artifact holds. The offending paragraphs cite
`engine/pory_baseline.py`, which is a `.py` and therefore not a citation as `citationsIn()` defines
one — that is exactly why the figure fell into the census clause instead.

Everything else in the brief held. Two entries, one value:

```
FIGURES THAT ARE NEWLY UNTRACEABLE SINCE THE BASELINE:
docs/ABRA-technical-docs.md|0.5822
docs/SUMMARY.md|0.5822
```

## 2. WHAT 0.5822 ACTUALLY IS

A **held-out log-loss**. Specifically arm **B2** of the five-arm comparison in
`docs/REVIEW-2026-07-25.md` §I.1: a logistic regression on `[alive_diff, hp_diff]` — two material
features — fitted by `engine/pory_baseline.py` and scored on a game-hashed held-out split. Its
companion `0.5840` is arm **P**, PORY's full feature set through the same estimator. Lower is better,
so the pair says the two-feature baseline BEAT the model by 0.0018.

The two living documents state it as current fact:

- `docs/SUMMARY.md`, the PORY row of the model table: *"its features ARE the material state, and it
  **loses to a two-feature baseline** (alive_diff+hp_diff 0.5822 vs PORY 0.5840, same estimator)"*.
- `docs/ABRA-technical-docs.md`, in the argument for why a value NETWORK would not help:
  *"`engine/pory_baseline.py` already established the relevant fact: PORY's six material features are
  **beaten by two of them** (`alive_diff + hp_diff` at 0.5822 vs PORY's 0.5840)."*

Both attribute it to `engine/pory_baseline.py`. Neither names a data artifact.

## 3. IT CANNOT BE SOURCED, AND THE THREE REASONS ARE INDEPENDENT

**(a) The generator writes no artifact — verified, not taken on trust.**

```
$ grep -n "json.dump\|open(.*['\"]w\|write(" engine/pory_baseline.py
NONE
```

It builds a table, `print`s it and exits. There has never been a file for a document to be checked
against. An independent walk of **5,288 JSON files under `data/`** (not the gate's own index — a
separate script, matching at `x`, `x*100` and `x/100` to four decimals) finds **zero** matches for
0.5822.

**The same walk finds 14 matches for 0.5840, all of them coincidence** — `58.4` and `0.584` in
`data/meta-usage.json`, `data/bring-bias.json` and two archived `dynamics` snapshots. Those are usage
shares. So the surviving half of the pair passes the census today by colliding with an unrelated
percentage, which is the ENGINE agent's "matched coincidentally by some other file" hypothesis caught
live rather than inferred. It is worth knowing the census can be satisfied by an accident.

**(b) It was measured on the wrong population.** `git show e39329de:engine/pory_baseline.py` — the
2026-07-25 commit that produced the table — has **no clean-data filter** in `rows()`. The filter
landed in `941cb506` on 2026-07-30, five days after the figures were published, and the comment added
with it says the unfiltered archive is ~87% bots, forfeits and stubs, so *"the comparison that is
supposed to keep this project honest is itself measuring the wrong population."* The clean corpus
moves every arm by far more than the 0.0018 the pair was reporting — the same generator's own model
arm moved 0.6298 → 0.6236 across a much smaller corpus change.

**(c) The CLAIM is superseded, not merely the sourcing.** The question *"does PORY beat a competent
material baseline?"* is already answered on the current clean corpus by PORY's own shipped estimator,
**paired and clustered by game** rather than as two unpaired point estimates. From
`data/pory-eval.json` (5,883 clean games / 97,732 states):

| field | value |
|---|---|
| `log_loss.pory` | 0.6236, 95% CI [0.607, 0.6387] |
| `log_loss.material_two_feature` | 0.623623 |
| `paired_vs_material_two_feature.difference` | +0.000001 (`direction`: positive = PORY WORSE) |
| `paired_vs_material_two_feature.ci95_clustered_by_game` | [−0.000026, +0.000029] |
| `paired_vs_material_two_feature.n_test_games` | 1,177 |

The interval contains zero. **The result is a TIE, not a loss.** `docs/MODELS.md:1145` and
`docs/MEASURE.md` have both said "ties" since 2026-08-04; `tests/test-docs-current.js`'s own rule-1
rationale says *"It ties the two-feature baseline"*. SUMMARY and the technical docs were the last two
places carrying the stronger, unsourced claim.

**Re-sourcing was available and would have been wrong.** `pory_baseline.py` could be given a
`json.dump` in ten minutes; `data/games.ladder.raw-logs.jsonl` is on disk at 345 MB and numpy is
installed. That does not rescue THIS figure — the corpus and the filter both moved, so a re-run
produces a different number, and writing the published one into an artifact to satisfy a gate is
typing rather than measuring. **Sourcing a figure means finding what measured it, not making a file
that contains it.**

## 4. NOT QUARANTINED — CHECKED, NOT ASSUMED

The brief flagged PORY as quarantine-adjacent. It is not, and the reason is a name collision:

- **PORY** is `engine/pory.py`, the logistic value net. It imports `json, os, math, random, numpy`,
  reads `data/games.ladder.raw-logs.jsonl`, and never loads the simulator. **It reads no rollout.**
- **PORYGON2** is the nearest-neighbour value function (`docs/MODELS.md:1865`), explicitly *"distinct
  from PORY"*. PORYGON2 is the name on CLAUDE.md's quarantine list.

Had they been the same model the correct action would have been to WITHHOLD the figure rather than
correct it. They are not, so the correction stands.

## 5. WHAT CHANGED

| file | change |
|---|---|
| `docs/SUMMARY.md` | PORY row: the pair replaced by the artifact-backed paired tie, with the withdrawal stated in the cell |
| `docs/ABRA-technical-docs.md` | value-network section: same replacement, plus a `WITHDRAWN:` paragraph giving all three reasons |
| `docs/REVIEW-2026-07-25.md` | five-arm table LEFT STANDING; gains a `SUPERSEDED` note saying what moved and that the headline's direction does not survive, while affirming the part that does |
| `docs/MEASURE.md` | division ledger entry |
| `CHANGELOG.md` | 5.210.0 |
| six version-headed docs | 5.209.0 → 5.210.0 with a 5.210.0 block each |

**The withdrawn numerals are written in exactly one place** — `docs/REVIEW-2026-07-25.md`, which
measured them. They are deliberately absent from the CHANGELOG entry: `changelogHas()` would then make
them traceable in every document at once, which is the loop `engine/docs_scan.js` warns about in its
own header and the route the ENGINE agent declined. **`data/docs-currency-baseline.json` was not
touched** — the ratchet came down by fixing the figure.

## 6. THE GATE

```
== 3b(c). census: figures with no artifact behind them anywhere ==
  ok   no living document gained untraceable figures (35 across 6 documents)
DOC CURRENCY TESTS: 23 passed, 0 failed
```

Census **37 → 35**. `docs/SUMMARY.md` leaves the census entirely (1 → 0); `docs/ABRA-technical-docs.md`
returns to its baseline (2 → 1). 3b(a) 8 → 8, 3b(b) 65 → 65, baseline file untouched.

---

## OWED, NOT RUN

- **`engine/pory_baseline.py` still writes no artifact, and that is a live hole, not a closed one.**
  Nothing stops the next document quoting its printed table. Giving it a `json.dump` and re-running it
  on the clean corpus would restore the B1 / B3 arms (`alive_diff` alone, `sign(alive_diff)`) as
  CURRENT figures — no artifact holds them today. Not run here: it is a fresh measurement, not a fix
  to the failing gate, and it takes a full pass over the 345 MB raw archive.
- **The five-arm question is only half-answered by `data/pory-eval.json`**, which compares PORY against
  `alive_diff + hp_diff` and nothing else. Whether PORY beats `alive_diff` ALONE on the clean corpus is
  not measured anywhere.
- **No game was played and no engine was run in this pass** — another agent holds the differential.
  Every number here is read out of a committed artifact or out of git history.
- **The census still stands at 35 across 6 documents.** They are ratcheted, not clean:
  `docs/MODELS.md` 14, `docs/ABRA-whitepaper.md` 10, `docs/SLOWKING-whitepaper.md` 7,
  `docs/ROLE-FAMILY.md` 2, `docs/ABRA-technical-docs.md` 1, `docs/ARCHITECTURE.md` 1. Each is a figure
  that is generated, cites an artifact, or should be deleted — and nothing has decided which.
- **PDFs were not rebuilt** for the six documents whose version headers moved.
