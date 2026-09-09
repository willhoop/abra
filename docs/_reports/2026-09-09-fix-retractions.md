# 2026-09-09 — retractions applied to the living documents (MEASURE fix pass)

Historical by construction (`docs/_reports/`). Never cited as current state. Tree at `bf4ff432` plus
uncommitted edits listed here; nothing committed, no RUNNING-NOTES or CHANGELOG row written (both
proposed in §D below). No game-playing script and no `status.js` run.

Inputs verified line by line before any edit: `docs/_reports/2026-09-09-pre-600-causal-and-boundary.md`
Q1 (R1–R5) and `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md` §2, §3, "Required to reach a pass". Every
receipt held. One discrepancy with the brief, stated in §A1 below.

---

## A. The five refuted-but-still-stated claims — all five rewritten

| # | file:line (before) | what it said | refuting receipt (opened) | what it says now |
|---|---|---|---|---|
| A1 | `CLAUDE.md:356-358` | the union driver "is the confirmed cause of the store duplicating" | `CHANGELOG.md:26611-26620` (3.23.0): three doublings at ancestry depths 329/336/383 inside the driver's window 307–417; a FOURTH, `009af264` "dedupe after rebase (137 duplicate lines)", 208 commits after removal; a FIFTH, a commit that published a 0-line store. `git log -S'merge=union' -- .gitattributes` confirms removal at `b6ea2dc9` (2026-07-24). | Hypothesis supported inside the window, unsupported outside; prohibition on restoring the driver kept verbatim. **Added the SIXTH shape:** sharding cutover `18432bcb` (2026-09-06 16:25) deleted `data/games.ladder.jsonl.gz` (54,323,899 B → 0) and `games.bo3.jsonl.gz` and cut shards from a stale local file, dropping **11,110 ladder / 4,752 bo3** games held at `d2a418a5` — `docs/_reports/2026-09-09-pre-600-store-and-authority.md` §1a-bis, id set difference. Recovery in flight. |
| A2 | `CLAUDE.md:586-587` (the DAMP STALE marker) | "The other three items in the sentence were not re-checked in that pass and are NOT claimed fixed here" | Weather Ball: `CHANGELOG.md:21137` (3.79.0), `docs/ENGINE.md:36378`, `:43373`; Sand Rush: same 3.79.0 line + `docs/ROADMAP.md:1314` (#100, the control arm measured the control); Solar Beam: `docs/ENGINE.md:43373` `chargeSkippedByWeather` LIVE; transform revert: `docs/ENGINE.md:14488` `tests/probe_transform_faint_revert.js` | Marker sentence replaced with the four receipts; the dated 2026-08-08 paragraph above it untouched. |
| A3 | `docs/ARCHITECTURE.md:42-43` | "7,040 duplicates from `merge -X ours` reconciliations" | `CHANGELOG.md:28240-28244` (3.1.2): "That is wrong, and acting on it would not have stopped a fourth occurrence" | 7,040 duplicate lines from divergent reconciliations; parenthetical records 3.1.2's withdrawal AND 3.23.0's counter-example, so neither mechanism is stated as the cause. Header (v1.2 pin) untouched. |
| A4 | `docs/SEARCH.md:2506` | "An unattended auto-commit publishes on a timer here, so a commit id is not a stable statement" | `CLAUDE.md` "THE AUTO-COMMIT IS DEAD": last `auto:` commit 2026-07-25 16:51, measured dead 2026-08-06 | Clause struck (~~…~~) with the date; the digest-set conclusion stands on the dirty-tree reason alone. |
| A5 | `docs/ENGINE.md:404`, `:412-413`, `:418-419`, `:423` | "ABOUT ONE IN SIX", "3 of the 19 causes", the Instruct/perish survivor, "about 3 causes. 6.0.0 should say so" | `docs/ENGINE.md:306-311` (THE HAND LIST, commit `47bcc4d4`) and `CHANGELOG.md:78-82` (5.273.0): 2 of 19, the perish survivor was the ten-line `--dump-games` window | Heading, the "3 of 19" sentence, the perish bullet and the "about 3 causes" instruction each struck and restated as **2 of 19** with the 5.273.0 receipt — the ledger's own convention. The line-420 instruction to 6.0.0 now carries the right number. |

**Discrepancy with the brief (A1).** The brief says "hypothesis supported for two events". The record
(`CHANGELOG.md:26613-26615`, `.gitattributes:10-11`) says THREE doublings — 7,040, 401, 8,139 lines —
fell inside the driver's window. CLAUDE.md now says what the record says. Neither count is a test of the
mechanism; both are ancestry coincidence.

**Not edited, reported:** `.gitattributes:9-11`, `.github/workflows/ingest.yml:355-357` and
`push-all.bat:9-10` still state the union driver / `-X ours` as THE mechanism. They are live files, not
living documents, and not in the brief. `CLAUDE.md` already tells readers to ignore the `push-all.bat`
header.

---

## B. NUMBERS CORRECTED

Every artifact field below was opened with `node -e` this pass (see the commands at the end). Every
living document in the brief's list was grepped for each old value — white paper, deck, technical docs,
SUMMARY, MODELS, ROLE-FAMILY, SLOWKING-whitepaper, PUBLICATION, README, ENGINE, MEASURE, SEARCH, OPS,
WEB — plus CLAUDE.md, ARCHITECTURE.md and DEFENSE.md. "Checked-and-clean" lists the documents that
were searched and carried NO copy.

| old value | new value, or WITHDRAWN (reason; artifact field) | every file:line it appeared in (all edited) | checked-and-clean |
|---|---|---|---|
| **WAR** clean-store **0.7048** log-loss, **accuracy 0.502** (the v3.2.0 run, 1,061 games) | **0.6936** vs coin 0.6931, **accuracy 0.504**, n_games **3,663**, λ=200 selected on held-out — `data/war.json:held_out.log_loss / .coin / .accuracy`, `n_games`, `ridge`; `verdict` "WORSE THAN A COIN AT EVERY REGULARISATION STRENGTH TESTED" | whitepaper:1968; MODELS.md:1783 (table row struck, artifact row added); SUMMARY.md:1310; ROLE-FAMILY.md:62; PUBLICATION.md:32 | deck, technical-docs, README, SLOWKING-whitepaper, ENGINE, MEASURE, SEARCH, OPS, WEB. (MODELS.md:1775 restates 0.6905 only inside an explicit "The previous entry read:" quotation — left.) |
| "which specific species you bring at preview carries a **small real signal**" | WITHDRAWN — `war.json:verdict`: "Do not quote WAR as evidence that a species wins games" | whitepaper:1968; ROLE-FAMILY.md:63; PUBLICATION.md:31 (item heading) | deck, technical-docs, README, SUMMARY (already "Null"), SLOWKING-whitepaper, ledgers |
| "WAR **barely clears** it" / "WAR **only edges** it" / "beats the **rating baseline (0.6905)**" | WITHDRAWN — `war.json` contains no rating baseline; verdict as above | whitepaper:1986; ROLE-FAMILY.md:98-99; ROLE-FAMILY.md:62-63 | all others |
| **NMF** archetype reconstruction **error 0.53** | **0.682** — `data/nmf-roles.json:archetype_recon_error` (generated 2026-08-04, `archetype_rank` 6) | whitepaper:1978; MODELS.md:1798; ROLE-FAMILY.md:81 | SUMMARY.md:1311 and PUBLICATION.md:41 already record 0.53 as withdrawn; deck, technical-docs, README, ledgers |
| "topic coherence (Mimno 2011) … the **next** refinement" | DELETED; replaced by the criterion actually run: rank 6 excess over null **−0.107** (stability 0.8148 vs null 0.9218), rank 4 most reproducible **+0.0775** — `data/nmf-rank-selection.json:shipped_rank`, `most_reproducible`, `results` | whitepaper:1981-1983; MODELS.md:1798; ROLE-FAMILY.md:102-104 | all others |
| **CHOMP-EV** "On **1,205** games" | **1,102** — `data/chomp-ev.json:n_test` | whitepaper:1691; MODELS.md:1687; PUBLICATION.md:21 | deck, technical-docs, SUMMARY, README, ledgers |
| CHOMP-EV log-loss **0.6918** | **0.6921** — `chomp-ev.json:proper_score_logloss.chomp_align` (coin 0.6931 unchanged) | whitepaper:1692; MODELS.md:1687 | all others |
| CHOMP-EV sign test **0.512, CI [0.493, 0.535]** | **0.5123 [0.4997, 0.5246]** — `chomp-ev.json:headline_beat_test.p_winner_more_aligned / .ci95` | whitepaper:1694; MODELS.md:1687 | all others |
| CHOMP-EV forfeit-robustness **0.505** | **0.5082** — `chomp-ev.json:robustness_no_forfeits.p_winner_more_aligned` | whitepaper:1694 | MODELS.md:1687 states it without a number (kept, number added) |
| CHOMP-EV selection audit "eval **6.5** turns / **1280** rating vs **6.08** / **1267** excluded … **making the null conservative**" | WITHDRAWN — `chomp-ev.json:selection_audit.n_excluded_human` = **0**, `excluded_mean_turns` = **null**: `engine/chomp_ev.js:120` `if (!CLEAN.has(g.id)) continue;` sits above the qualify test at `:128`, so `audExcl` can never receive a game. No artifact establishes the bias direction. The thesis-notes measurement (7.81 vs 6.74 turns, +4.44 points) is referenced by PATH only, not restated — see §E for why. | whitepaper:1696-1698; MODELS.md:1687 ("null is conservative") | PUBLICATION.md:21-22 carries no audit claim; deck, technical-docs, SUMMARY, README, ledgers |
| **XATU** clone **top-1 35.9% (CI 35.2–36.5), top-3 71.6%, CE 2.27**, baselines **4.54 / 2.91** | WITHDRAWN — in no artifact. `data/policy-eval.json:species_only_clone` (committed 2026-07-31) reads top-1 **0.2979 [0.2914, 0.3045]**, top-3 **0.6564**, CE **2.6353**; `baselines.global_move_freq_ce` **4.7346**, `uniform_moveset_ce` **3.0286** — stated beside the withdrawal | whitepaper:1676-1678; MODELS.md:1405; DEFENSE.md:247 (35.9% → 29.8% with the artifact field) | SUMMARY (no copy today, despite MEASURE.md:5337 saying it quotes one), deck, technical-docs, README. **MEASURE.md:5337's 71.6% is PORY-NN's auc, a different measurement** (already recorded at MEASURE.md:5239); a dated correction note was added there so the registry does not accuse it. |
| **§1 ceiling** Elo log-loss **0.687 vs coin 0.693** on 600+ games | WITHDRAWN — `engine/predictability.py` has no `json.dump` (grep: none); `data/skill-variance.json` and `engine/skill_variance.py` do not exist (`ls`) | whitepaper:1491-1492; PUBLICATION.md:16 | MODELS.md:1404 "player-Elo ≈ coin (0.687)" sits inside a paragraph headed "The 2026-07-23 reading, **superseded**, kept" — a dated record, left. deck, technical-docs, SUMMARY, README, ledgers clean. |
| §1 ceiling **52.4%, 95% CI [49.9, 54.9]** | WITHDRAWN — same reason | whitepaper:1494-1495; SUMMARY.md:1392 | PUBLICATION.md has no copy. **MEASURE.md:6271, :6272, :6342 write "52.4%" as the majority-class baseline of the turn-0 leaf arms — a different quantity — left, and deliberately NOT registered (see §D).** |

Counts: **5 causal claims** rewritten across 8 locations; **22 numeric values** withdrawn or replaced
across **21 figure locations** in 7 documents (whitepaper 6, MODELS 4, ROLE-FAMILY 4, PUBLICATION 3,
SUMMARY 2, DEFENSE 1, MEASURE 1 note). Every living document in the brief's list was grepped for every
old value; the deck, technical docs, README, SLOWKING paper and the OPS / WEB ledgers carried none.

**Kept, per the brief's "do not touch" list:** rank 4 adoption, the three-way WAR split, the SLOWKING
bootstrap replicates. Also NOT touched (out of scope, listed in OWED): the ROLE-FAMILY §4 archetype
table, the "26 roles" count, the role-matrix "n=20 across 1,051 cells", the SLOWKING cycle paragraph,
GURU 0.7122, PORY "the thesis, demonstrated".

---

## C. `data/docs-currency-baseline.json`

Added to `unversioned_exempt` (the array has no per-file reason field; the 07-27/07-28/07-31 reviews
sit there as bare paths): `docs/ARCHITECTURE-REVIEW-2026-09-09.md` (after the 07-27 entry) and
`docs/THESIS-DEFENCE-REVIEW-2026-09-09.md` (after the 07-31 entry). Both files exist on disk now.

Added to `known.retraction_violations`, on the precedent of the 07-28 review's two entries:
`docs/THESIS-DEFENCE-REVIEW-2026-09-09.md|1,205|1205`, `…|35.9%|35.9%`, `…|71.6%|71.6%` — the dated
review restates the figures it caused to be withdrawn, and a dated record is not edited.

**The test wrote the baseline itself on the green run** (its ratchet behaviour, not mine): `generated`
→ `2026-09-09T17:12:42Z`, `changelog_top_at_baseline` 5.270.0 → 5.274.0, and two
`citation_mismatches` entries removed (`docs/ABRA-whitepaper.md|4.54|…` and `|71.6%|…` against
`data/xatu.json,data/policy-eval.json`) because the XATU paragraph is now a QUALIFIED block. Visible in
`git diff data/docs-currency-baseline.json`.

---

## D. Proposed rows — NOT written

### How the derived registry reads a retraction (`engine/docs_scan.js:585 retractionRegistry`)

- **Strong (fails the build):** (1) any figure inside `~~…~~` on a line that also contains
  `retract|withdraw|superseded|void`; (2) "the prior / published / old / former / previous / figure of /
  headline <figure>" on such a line. **Weak (reported only):** a figure within 12 characters before
  `retracted|withdrawn|void`.
- **Distinctiveness floor (`isDistinctive`):** a percent needs **≥ 3 significant figures**; a bare number
  needs **value ≥ 1000**. So `35.9%`, `71.6%`, `1,205`, `1280`, `1267`, `52.4%` CAN register;
  `0.7048`, `0.53`, `0.687`, `0.693`, `0.6918`, `2.27`, `6.5`, `6.08`, `0.502` CANNOT, whatever the
  wording.
- **`CHANGELOG.md` is `EXEMPT_FILES` (`docs_scan.js:36`) and the registry never reads it.** CHANGELOG
  wording registers NOTHING. Registration comes from the living documents' own lines (done — the
  registry now reads `35.9%, 71.6%, 1205` as retracted in writing, sources `docs/ABRA-whitepaper.md:1682`,
  `:1701`, `docs/MODELS.md:1405`, `:1687`) and from `docs/RUNNING-NOTES.md`, which is in `docs/` and IS
  scanned.
- **Two figures deliberately NOT struck through anywhere, and the row below keeps it that way:**
  `52.4%` — a strong entry would accuse `docs/MEASURE.md:6271-6272, 6342`, where 52.4% is the turn-0
  arms' majority-class baseline (a different quantity); `1280` / `1267` — would accuse
  `docs/ENGINE.md:35712` "1,280 lines into an unrelated file". The 9.7%-accuses-10% failure, exactly.
  Both are named as literals only in the CHANGELOG (exempt). For a decision-withdrawn figure the
  registry cannot carry, the right home is the hand-typed `RETRACTED` list in
  `tests/test-docs-current.js:103` — proposed entries at the end of this section.

### RUNNING-NOTES row (page shape; version is the coordinator's call — MINOR because published figures moved under an unchanged basis)

```
## [5.275.0] — 2026-09-09 — the living documents stop stating five refuted mechanisms and the figures their artifacts contradict
- **What changed.** Documents only; no engine byte. `CLAUDE.md` (the union-driver "confirmed cause" becomes a hypothesis with 3.23.0's counter-examples, and records the sixth shape — the 2026-09-06 sharding cutover `18432bcb` dropping 11,110 ladder / 4,752 bo3 games held at `d2a418a5`; the DAMP marker's "not re-checked" sentence replaced with the four receipts), `docs/ARCHITECTURE.md` §1.6, `docs/SEARCH.md` (the dead auto-commit clause struck), `docs/ENGINE.md` ("one in six" / "3 of 19" struck to 2 of 19 per 5.273.0), and the WAR / NMF / CHOMP-EV / XATU / §1-ceiling figures in `docs/ABRA-whitepaper.md`, `docs/MODELS.md`, `docs/SUMMARY.md`, `docs/ROLE-FAMILY.md`, `docs/PUBLICATION.md`, `docs/DEFENSE.md`. Report: `docs/_reports/2026-09-09-fix-retractions.md`.
- **Measured.** NO NEW FIGURE. Restated from artifacts already on disk: WAR 0.6936 vs coin 0.6931, accuracy 0.504 — `data/war.json`, n=3,663, λ=200 selected on held-out log-loss; NMF reconstruction error 0.682 at rank 6 — `data/nmf-roles.json`; rank 6 excess over null −0.107, rank 4 +0.0775 — `data/nmf-rank-selection.json`; CHOMP-EV n_test 1,102, log-loss 0.6921 vs 0.6931, sign test 0.5123 [0.4997, 0.5246], forfeits dropped 0.5082, selection audit n_excluded_human 0 — `data/chomp-ev.json`; clone top-1 0.2979 [0.2914, 0.3045], top-3 0.6564, CE 2.6353 vs baselines 4.7346 / 3.0286 — `data/policy-eval.json`.
- **Basis.** unchanged.
- **Supersedes.** ~~0.7048, accuracy 0.502~~ retracted (WAR on the clean store, the v3.2.0 run — stood in the white paper, MODELS, SUMMARY, ROLE-FAMILY and PUBLICATION and has been DELETED there); ~~"carries a small real signal" / "barely clears" / "only edges" a coin / "beats the rating baseline (0.6905)"~~ retracted; ~~0.53~~ retracted (NMF error) and ~~"topic coherence is the next refinement"~~ deleted; ~~1,205~~ retracted (CHOMP-EV games), ~~0.6918~~, ~~0.512 [0.493, 0.535]~~, ~~0.505~~ retracted, and the selection audit's four turn/rating figures with "making the null conservative" retracted — the audit measured zero excluded games (the two rating literals are written in CHANGELOG only; struck here they would register and accuse `docs/ENGINE.md:35712`); ~~35.9% (CI 35.2–36.5), 71.6%, 2.27 nats, 4.54, 2.91~~ retracted (XATU clone — in no artifact); ~~0.687 vs 0.693~~ retracted and the bot-filtered "higher-rated player wins" rate with its CI [49.9, 54.9] retracted (§1 ceiling — no artifact; the percent is written in CHANGELOG only, because struck here it would register and accuse `docs/MEASURE.md:6271-6272, 6342`, an unrelated majority-class baseline); ~~"about one in six" / "3 of 19"~~ retracted → 2 of 19 (5.273.0; ENGINE.md's own copies now struck); ~~"the union driver is the confirmed cause"~~, ~~"duplicates from `merge -X ours`"~~, ~~"an unattended auto-commit publishes on a timer here"~~ retracted as mechanisms.
- **Owed to the next major.** White paper §1, §4.2, §4.4, the role-family appendix; MODELS (XATU, CHOMP-EV, WAR, NMF); SUMMARY (WAR row, "Honest ceilings"); ROLE-FAMILY §3–§5 and its §4 archetype table (still the 2026-07-24 run's, not the artifact's); PUBLICATION items 1, 4, 8; `docs/ARCHITECTURE.md` §1.6.
```

Clause-5d check on that row: it declares `Basis. unchanged` and supersedes figures → must be MINOR or
higher; `[5.275.0]` satisfies it, `[Unreleased]` does too until released.

### CHANGELOG block

```
## [5.275.0] — 2026-09-09

### Fixed
- **FIVE REFUTED MECHANISMS WERE STILL STATED AS FACT IN THE LIVING DOCUMENTS.** The union merge driver
  as "the confirmed cause" of the store duplicating (`CLAUDE.md`) — 3.23.0 had already recorded a fourth
  duplication 208 commits after the driver was removed and a fifth event of a different shape; it is now a
  hypothesis with its counter-examples, the prohibition on restoring the driver unchanged. A SIXTH shape
  is recorded: the 2026-09-06 sharding cutover (`18432bcb`) sharded a stale local file and dropped 11,110
  ladder and 4,752 bo3 games from the tracked shards (id set difference against `d2a418a5`); recovery is
  in flight. `docs/ARCHITECTURE.md` §1.6 blamed `merge -X ours`, retracted by 3.1.2 the same day it was
  written. `docs/SEARCH.md` argued from an auto-commit timer dead since 2026-07-25. `docs/ENGINE.md`
  still headed "ABOUT ONE IN SIX" and instructed 6.0.0 to say "3 causes" — 5.273.0 had retracted both to
  2 of 19, one hundred lines above. The DAMP STALE marker in `CLAUDE.md` said the other three 2026-08-08
  defects were "not re-checked"; all four were, with receipts (3.79.0, ROADMAP #100,
  `chargeSkippedByWeather`, `tests/probe_transform_faint_revert.js`).
- **Restated from the artifacts on disk, which the documents contradicted:** WAR `data/war.json`
  0.6936 vs coin 0.6931, accuracy 0.504, n=3,663, λ=200 selected on held-out (verdict: worse than a coin
  at every regularisation strength tested); NMF `data/nmf-roles.json` reconstruction error 0.682 at
  rank 6, and `data/nmf-rank-selection.json` rank 6 at −0.107 excess over null against rank 4 at +0.0775;
  CHOMP-EV `data/chomp-ev.json` n_test 1,102, log-loss 0.6921, sign test 0.5123 [0.4997, 0.5246],
  forfeits dropped 0.5082, selection audit n_excluded_human 0; the policy clone `data/policy-eval.json`
  top-1 0.2979 [0.2914, 0.3045], top-3 0.6564, CE 2.6353 vs baselines 4.7346 / 3.0286.
- `data/docs-currency-baseline.json`: the two 2026-09-09 reviews declared unversioned; three known
  retraction restatements recorded for the dated thesis review, on the 07-28 review's precedent.

### Removed
- **RETRACTED — WAR on the clean store: ~~0.7048, accuracy 0.502~~** (the v3.2.0 run on 1,061 games) and
  the sentences "carries a small real signal", "barely clears" / "only edges" a coin and "beats the rating
  baseline (0.6905)" — `data/war.json` contains no rating baseline and its verdict forbids the reading.
  Deleted from the white paper, MODELS, SUMMARY, ROLE-FAMILY and PUBLICATION.
- **RETRACTED — NMF ~~error 0.53~~** and "topic coherence is the next refinement" (white paper, MODELS,
  ROLE-FAMILY). The 2026-07-31 defence ruled that *next* is not a justification; the shipped rank is below
  the null on the project's own criterion and the documents now say so.
- **RETRACTED — CHOMP-EV ~~1,205 games~~, ~~0.6918~~, ~~0.512 [0.493, 0.535]~~, ~~0.505~~**, and the
  selection audit "~~eval 6.5 turns / 1280 rating vs 6.08 / 1267 excluded~~ … making the null
  conservative". `engine/chomp_ev.js:120` drops non-clean games above the qualify test at `:128`, so
  `audExcl` is structurally empty: the artifact reads `n_excluded_human` 0 and `excluded_mean_turns`
  null. The comparison was never made; "conservative" is withdrawn with it.
- **RETRACTED — XATU clone ~~top-1 35.9% (CI 35.2–36.5), top-3 71.6%, CE 2.27, baselines 4.54 / 2.91~~**
  (white paper §4.2, MODELS, DEFENSE). In no artifact; the cited harness artifact holds different values,
  now stated beside the withdrawal.
- **WITHDRAWN — the §1 ceiling ~~0.687 against a coin's 0.693~~ and ~~52.4%, 95% CI [49.9, 54.9]~~**
  (white paper §1, SUMMARY "Honest ceilings", PUBLICATION item 1). `engine/predictability.py` writes
  nothing; `data/skill-variance.json` was never built. Both return when an artifact exists.

### Notes
- Nothing here re-ran a generator. Every replacement value was READ from an artifact already on disk
  and dated by its commit (`war.json` 2026-07-28, `nmf-roles.json` 2026-08-04, `chomp-ev.json`
  2026-08-01, `policy-eval.json` 2026-07-31). All four predate quality filter 1.3.0 (2026-08-27) — the
  thesis defence's item 11 re-run is still owed and is not claimed.
- `tests/test-docs-current.js`: 32/1 before (clause 2b, the undeclared 09-09 review), 33/0 after. The
  derived registry now reads 35.9%, 71.6% and 1,205 as retracted in writing.
```

### Proposed additions to the hand-typed `RETRACTED` list (`tests/test-docs-current.js:103`) — for the figures the derived registry cannot carry

```js
{ bad: /\b0\.7048\b/, what: "WAR's clean-store log-loss of 0.7048 (the v3.2.0 run)",
  why: 'withdrawn 2026-09-09 — data/war.json reads 0.6936 at the held-out-selected lambda',
  allowIfNear: /withdraw|retract|superseded|v3\.2\.0/i },
{ bad: /Removing them gives 52\.4%|52\.4%, 95% CI \[49\.9, 54\.9\]|\b52\.4% skill ceiling/, what: 'the 52.4% skill ceiling',
  why: 'withdrawn 2026-09-09 — no artifact; predictability.py writes nothing, skill-variance.json was never built',
  allowIfNear: /withdraw|retract|no artifact/i },
{ bad: /\b0\.687 (?:against|vs)\b|log-loss 0\.687\b/, what: "the §1 player-Elo log-loss of 0.687",
  why: 'withdrawn 2026-09-09 — no artifact', allowIfNear: /withdraw|retract|superseded|no artifact/i },
{ bad: /\b1280 rating\b|\b6\.08 \/ 1267\b/, what: "the CHOMP-EV selection-audit figures",
  why: 'withdrawn 2026-09-09 — selection_audit.n_excluded_human is 0; the excluded set was never measured',
  allowIfNear: /withdraw|retract|zero excluded|never measured/i },
```
Each is phrase-scoped, so `docs/MEASURE.md`'s 52.4% majority-class cells and `docs/ENGINE.md`'s "1,280
lines" cannot match. Not written: the brief asked for no test edits.

---

## E. Verification

| gate | before (HEAD, pre-edit) | after |
|---|---|---|
| `node tests/test-docs-current.js` | **32 passed, 1 failed** — clause 2b "undeclared unversioned documents: baseline 57, now 58" (the 09-09 thesis review). **Not** the archive index: clause 3c was green at HEAD, contrary to the test-break report's prediction. | **33 passed, 0 failed.** Clause 2b green (baseline 59, now 59). Intermediate run after the document edits: clause 3b(a) RED with 4 NEW restatements — `docs/DEFENSE.md:247` (35.9%), `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md:267/:271/:421` (35.9% / 71.6% / 1,205). DEFENSE.md is a living document and was corrected in place with the artifact field; the dated review received three `known` entries. 3b(b) 61 → 59 (the XATU block is now qualified). 3b(c) unchanged, 23 across 3 documents. Clause 5: no commit has moved code since the notes page did — stays green until this lands, at which point the proposed row is required. |
| `node engine/docs_scan.js --owed` | 51 of 100 owed to the next major; last folded 5.266.0 | **51 of 100**, unchanged — no row was written. |
| `node engine/docs_scan.js --quarantine \| tail -20` | 23 untraceable across 3 documents (MODELS 13, whitepaper 9, ARCHITECTURE 1) | **identical** — 23 across 3. No living document gained an untraceable figure. |

Every red seen this pass was either the pre-existing 2b (closed by §C) or produced by my own
registration and closed in the same pass; none is left standing and none was waived.

**Why the thesis-notes measurement is referenced by path and not restated.** `untraceableCensus`
counts any figure in an uncited paragraph that no artifact contains and the CHANGELOG has not recorded,
and `citationMismatches` fails any figure in a paragraph that cites `data/*.json` and does not contain
it. 7.81 / 6.74 / +4.44 are in neither place, so writing them into the white paper would either raise
the untraceable count (a ratchet) or mis-cite `data/chomp-ev.json`. The white paper names the report
and says it is not a published figure; that is the most the gate allows and it is the right amount.

**Artifact reads (all run this pass):**
```
node -e "const w=require('./data/war.json');console.log(w.ridge,w.n_games,w.held_out,w.verdict,w.ridge_selection.sweep)"
node -e "const n=require('./data/nmf-roles.json');console.log(n.generated,n.archetype_rank,n.archetype_recon_error)"
node -e "const r=require('./data/nmf-rank-selection.json');console.log(r.shipped_rank,r.most_reproducible,r.results)"
node -e "const c=require('./data/chomp-ev.json');console.log(c.n_test,c.selection_audit,c.proper_score_logloss,c.headline_beat_test,c.robustness_no_forfeits)"
node -e "const p=require('./data/policy-eval.json');console.log(p.species_only_clone,p.baselines)"
grep -n "json.dump" engine/predictability.py          # none
ls data/skill-variance.json engine/skill_variance.py  # neither exists
sed -n '115,135p' engine/chomp_ev.js                  # CLEAN filter at :120, qualify test at :128
git show --stat 18432bcb | grep games.               # monoliths -> 0 bytes, shards created
```

---

## OWED, NOT RUN

Exact commands. None was run in this pass; none is a retraction.

```bash
# ROLE-FAMILY §4 archetype table and the whitepaper/MODELS archetype NAMES are the 2026-07-24 run's, not the
# artifact's (thesis §2.2: A1 wall/special/rain 22.5% ... A6 Fake Out 10.6%). Rewrite at the fold-in from:
node -e "const n=require('./data/nmf-roles.json');for(const a of n.archetypes)console.log(a.name||'',a.share,JSON.stringify(a.top_roles))"

# "26 functional roles" (whitepaper:1945, ROLE-FAMILY.md:25, SUMMARY.md:1309) vs the declared set (thesis §2.3 counted 52):
grep -c "^\s*['\"][a-z_]*['\"]\s*:" engine/roles.py ; node -e "console.log(require('./data/nmf-rank-selection.json').matrix.cols)"

# "median cell n = 20 across 1,051 cells" (whitepaper:1954, ROLE-FAMILY.md:45, SUMMARY.md:1309, PUBLICATION.md:27)
# vs data/role-matchups.json (thesis §3.3 computed 1,101 cells, median 74) — verify before touching:
node -e "const m=require('./data/role-matchups.json');/* count cells, median n */"

# SLOWKING cycle paragraph (whitepaper:1721-1727, PUBLICATION.md:25-27) names a cycle no artifact holds; Rain vs Sun 51% n=236 vs
# data/playstyle-matchups.json:matrix.Rain.Sun 0.538 n=182; "13 archetypes / uniform 0.109" vs 12 / 0.0761. Thesis item 4.
node -e "const s=require('./data/slowking-eval.json');console.log(s.top_nontransitive_cycle)"
node -e "const p=require('./data/playstyle-matchups.json');console.log(p.matrix.Rain.Sun)"

# GURU 0.7122 -> 0.7124 and the family statement into whitepaper §4.1 (thesis item 8):
node -e "const g=require('./data/guru-matchups.json');console.log(g.predictive_test)"

# PORY body "the thesis, demonstrated" under a RETRACTED heading (whitepaper:1685).

# CHOMP-EV audit made real (thesis item 3): populate audExcl from quality.js loadGames({clean:false}) with every rule
# but require_full_bring, then:
node engine/chomp_ev.js

# §1 ceiling artifact (thesis item 5): build engine/skill_variance.py -> data/skill-variance.json per
# docs/STUDY-DESIGN-skill-vs-luck.md §4.5/§6; make engine/predictability.py write its result.

# The store-layer re-run on quality filter 1.3.0 (thesis item 11); every artifact read above predates 2026-08-27:
python engine/war.py ; python engine/nmf_roles.py ; python engine/nmf_rank.py ; node engine/chomp_ev.js ; python engine/eval_policy.py

# The hand-typed RETRACTED entries proposed in §D, then:
node tests/test-docs-current.js

# Live files still stating the union driver / -X ours as THE mechanism (not living documents; ENGINE/OPS to decide):
sed -n '9,11p' .gitattributes ; sed -n '353,358p' .github/workflows/ingest.yml ; sed -n '9,10p' push-all.bat

# Quarantined-claim sentences left in place, out of scope: whitepaper §1 and PUBLICATION.md:16-17
# "a cloned-policy rollout engine (MEDICHAM) does worse than a coin" — a MEDICHAM-derived reading with no number.
```
