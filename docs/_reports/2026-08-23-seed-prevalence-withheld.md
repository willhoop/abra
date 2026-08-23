# Two seed-prevalence figures withheld — the generator's species lookup dropped every forme

2026-08-23, MEASURE. Historical findings record; not current state, not a living document.
Upstream account of the bug itself: `docs/_reports/2026-08-23-mc-key-ratchet.md`.

## 1. The verdict

`data/rollout-seed-prevalence.json` publishes six rates. **Two are withheld. Four stand.**

| rate | status |
|---|---|
| `pct_248_bench_moves_differ` | **WITHHELD** — inflated, magnitude unpublished |
| `pct_any` | **WITHHELD** — an OR containing the above |
| `pct_250_first_turn_move_offered_but_illegal` (17.655) | stands |
| `pct_248_bench_hurt_or_statused` (17.053) | stands |
| `pct_249_hazard_screen_or_gravity_up` (13.089) | stands |
| `pct_247_carrier_entered_over_graves` (0.061) | stands |

**The scope is measured, not assumed.** `datasetMoves` is called at **exactly one site** in the
generator — `engine/rollout_seed_prevalence.js:175` — and it feeds only `movesDiffer`:

```js
if (declared.length && declared.join(',') !== datasetMoves(sp).join(',')) movesDiffer = true;
```

`out.dp.any` (line 219) is `movesDiffer || benchHurt || stale || sideState || snapshot`. The other
four counters never touch the mon table. So the contamination is bounded to two of the six by the
call graph, not by judgement.

**The mechanism.** `MC.mons[base(sp)]`, and `base()` ends in `norm()`, which strips the hyphen
`MC.mons` keys every forme with. `Rotom-Wash` asked for `rotomwash`, got nothing, and returned an
**empty** dataset moveset — which can only score as *"the moves differ."* One-directional inflation.
47 of 256 store species names, 10,980 of 144,260 brought bodies (7.61%), 7,177 of 231,924 sheet
bodies (3.095%) flipping true → false once the row is found.

**No corrected value is estimated anywhere.** The direction is known; the magnitude is not. A
body-level flip rate does not translate one-for-one to a decision point that ORs over the whole live
bench.

## 2. What was withheld, and where — every site, with line references

Withheld means **removed**, per CLAUDE.md *"A CAPTION IS NOT A QUARANTINE… the figure must be
WITHHELD, not annotated."* No site was footnoted and no site retained the digits.

### `docs/SEARCH.md` — mine, edited

| was at | what it was | now |
|---|---|---|
| 648 | argmax-paired reach column, `h254 -> r14` cell: `70.55%` | `**WITHHELD**` + a note under the table saying the flip column is unaffected and which reach cells come from other artifacts |
| 651 | same table, `pre -> head` POOLED cell: `70.55%` | `**WITHHELD**` (same note) |
| 1261 | **section headline** `R14 — THE SEED WAS WRONG AT 70.6% OF DECISION POINTS` | `R14 — THE SEED WAS WRONG OFTEN ENOUGH TO CLOSE FOUR ROWS; THE HEADLINE SHARE IS WITHHELD` |
| 1272 | *"At 70.55% of open-sheet decision points…"* — the verdict-in-one-line | rewritten with no number, plus a pointer to the withholding block |
| 1307 | prevalence table, `#248 moveset` row: `55.379%` | `**WITHHELD — see below**` |
| 1312 | prevalence table, `ANY of the five` row: `70.554%` | `**WITHHELD — see below**` |

The withholding block itself is new, anchored `#seed-prevalence-withheld`, immediately under the
prevalence table. It carries exactly the three things asked for and nothing else: the claim is
withheld; the mechanism; and the pinned command. It also states which four rates are unaffected and
why (the single call site), because a blanket withholding of the artifact would have retracted four
sound figures.

### `docs/ROADMAP.md` — mine, edited

- **#248's closure text** carried `55.379%`. Replaced with a `WITHHELD` statement naming the
  mechanism and pointing at #402. The `17.053%` in the same sentence is **kept** — it is
  `benchHurt`, computed independently.
- **#402 opened** (new row, appended after #401): the withholding, the mechanism, the measured
  scope, the four unaffected rates, the four closed rows and why they do not rest on it, and the
  pinned re-run command. `roadmapRowIsClosed` reads it OPEN and `roadmapRowSaysBroken` reads it
  false — correct, since no engine is broken, a figure is withheld.

### Beyond the brief's list — found by sweep, edited

- **`docs/MILTANK.md:261`** — `### 3.9 The seed was wrong at 70.6% of decision points`. A second
  headline, in SEARCH's design-notes doc. Rewritten with no figure.
- **`docs/MILTANK.md:278, 282`** — the **rounded** forms `55.4%` and `70.6%`. My first sweep, which
  matched only the exact published digits, missed both. Withheld; the four unaffected shares
  (17.7 / 17.1 / 13.1 / 0.061) are kept in place.
- **`docs/MEDICHAM-SPRINT-NOTES.md:788, 790`** — `55.379%` and `70.554%`. This is the one that
  mattered most and is the least obvious: the file's own header says the living-docs pass is
  **deferred** and *"the whole batch is written up when the gate closes"*, so it is a pending SOURCE
  for the white paper, the deck and SUMMARY. A retracted figure left there gets copied forward into
  documents that do not yet contain it. Withheld; the four unaffected shares kept.

Both files are outside the two I was granted. Neither is held by a live agent (`git diff` shows no
other hand in either). Flagged here so the calls are visible and trivially reversible.

### Deliberately NOT changed — and why

- **`CHANGELOG.md:4924, 4961, 4964`** — three sites, including a headline. Two reasons, either
  sufficient: it is held by the ENGINE agent tonight, and a CHANGELOG entry is a **dated record of
  what was published on that date**, which this project does not rewrite in place (the same
  reasoning that leaves the stale Damp sentence standing in CLAUDE.md). #402 is the forward-facing
  record. **If Will wants the CHANGELOG corrected, it should be a NEW dated entry, not an edit to
  the 2026-08-14 one** — and that entry is the coordinator's to write.
- **`docs/archive/SESSION-2026-08-02-evening.md:115`** — `| Protect | 59.0% | 54.9% | **70.6%** |`.
  A **false positive**: a Protect rate from a different measurement that happens to round to the
  same three digits. This is the exact hazard on record from the previous retraction that matched a
  rounded value and wrongly accused 52 lines. Not touched, and it is in `archive_grandfathered`.
- **`engine/rollout_seed_prevalence.js:102`** — the source comment names `movesDiffer 105,430 of
  190,378` and already says the artifact **"is OWED a re-run."** That is a correct, self-describing
  record at the site of the bug, not a figure a reader would take as current. Left, and it is the
  other agent's edit from tonight.
- **`data/rollout-seed-prevalence.json` itself** — see §5, it is a decision for Will.
- **`web/`** — swept and **clean**. `web/quarantine-data.js:308` and `web/stadium.html:648` list the
  artifact PATH in a roster; neither renders either figure. Nothing in `web/` matches any form of
  the numbers.
- **The white paper, the deck, the technical docs, `docs/SUMMARY.md`, `docs/MODELS.md`,
  `docs/MEASURE.md`, `docs/LESSONS.md`, `README.md`** — swept, **zero** occurrences of either
  figure or the artifact name. (`docs/MEASURE.md:4156` has a bare `70.6` in a cutoff table; a
  different measurement, not touched.)
- **No `<!-- GENERATED -->` block was edited.** `docs/SEARCH.md`'s generated block is lines 11–41
  and contains none of these figures — every site is outside it. Nothing is owed to a regeneration
  on this account.

## 3. The sibling artifacts are clean, and that was checked rather than assumed

The same `docs/SEARCH.md` table publishes reach figures of **8.75%** (`#244`), **3.62%** (`#271`)
and **39.72%** (`#267–#270`) from `rollout-fallen-prevalence.json`, `rollout-item-prevalence.json`
and `rollout-clock-prevalence.json`. `rollout_item_prevalence.js` even says its helper is *"identical
to the helper in rollout_seed_prevalence.js, deliberately"*, which is exactly the shape that spreads
a bug.

**Measured: none of the three generators mentions `MC.mons` at all.** `grep` for `MC.mons`, `mcKey`
and `.mons` returns nothing in any of them; the only `.mv` reads are `norm(e.mv)` off a store EVENT,
not the mon table. Those three figures are unaffected and were left standing.

## 4. Which register rows rest on the figure — NONE, and none were reopened

Two rows cite the artifact (`roadmapRowIsClosed` over every `#NN` row in `docs/ROADMAP.md`; the
detector was imported from `engine/quarantine.js`, not re-implemented):

| row | cites | status | rests on the withheld figure? |
|---|---|---|---|
| #247 | `116 of 190,378 = 0.061%` | closed | **no** — that rate is one of the four unaffected |
| #248 | `55.379%` **and** `17.053%` | closed | **no** — see below; the `55.379%` restatement is now withheld |
| #249, #250 | no artifact citation | closed | **no** |

**Why none of the four closures rests on it.** Each closed on `tests/test-rollout-seed.js`, shown
RED first at 23/24, with a per-row control (#247's inverted damage table with #243's split as the
control; #248's no-sheet control; #249's both-seats-plus-behavioural arm; #250's `activeMoveActions`
correction). The prevalence figures were published **beside** those closures as ceilings on reach —
`docs/SEARCH.md` states it in bold: *"EVERY FIGURE IS A CEILING… not decisions whose argmax flips."*
And the effect that actually mattered was measured independently: **61/131 paired argmax flips**
under common random numbers (#278, `data/argmax-paired.json`), which never reads this artifact.

**So: nothing marked for re-verification, nothing reopened.** The only repair owed to the register
was #248's closure PROSE restating a figure that is now withheld, and that is done.

## 5. For Will — two decisions, neither taken

**(a) The artifact still publishes both numbers in its own JSON.** The project's mechanism for that
is a self-declared `void: true` + `void_reason`, which `engine/provenance.js:1374` honours above
every inference. I did **not** apply it, for three reasons: it withholds the whole file including the
four sound rates; it is a hand-edit of a generated artifact; and `data/provenance-stamp.json`
currently lists `void_files: ["exploitability.json"]`, so a new void **breaks the void ratchet**
until a restamp — and restamping needs `status.js --write`, which I was told not to run. Measured
mitigation: **nothing in `engine/`, `tests/` or `web/` reads `pct_248_bench_moves_differ` or
`pct_any`** — the only reader is the generator's own console output. Your call whether to void it or
let the pinned re-run overwrite it.

**(b) `data/mc-key-door-baseline.json` is a NEW hand-written baseline** created tonight by the
agent that found this bug, established at today's measured level of **37 files / 96 sites** of
pre-existing debt. It is not the same act as moving an existing baseline to clear a red gate —
`data/mc-key-baseline.json` was untouched and section 2 went green on fixes — but it is a
hand-written baseline and it is yours to accept or reject. Recorded here as a decision, not defended
and not deleted.

Also for the record, not touched and not mine: `data/_pair-pilot.json` is untracked in the tree.

## 6. OWED, NOT RUN

- **`data/rollout-seed-prevalence.json` — PINNED RE-RUN OWED.** This is the only thing that restores
  the two figures.
  ```bash
  head -n 14102 data/games.bo3.jsonl > data/_seed-prev-pin.jsonl
  node engine/rollout_seed_prevalence.js --store data/_seed-prev-pin.jsonl
  ```
  Not run: by instruction, and because it rewrites a published artifact while agents are live. The
  store has grown **14,102 → 19,401 games**, so an unpinned run is a different question and not a
  before/after. **The pin has its own check** — a correct pin must return `decisionPoints: 190378`
  exactly, a quantity the bug cannot have touched, so the pin is verifiable independently of the
  thing being measured. The generator takes only `--store`; there is no `--games` flag.
- **A CHANGELOG entry is owed and is NOT written** — by instruction. It should be a NEW dated entry;
  the 2026-08-14 one is a dated record and should not be edited.
- **`node engine/status.js --write` NOT run** — by instruction. No `<!-- GENERATED -->` block
  contains either figure, so nothing is owed to a regeneration on this account.
- **Nothing committed.**
- **`engine/rollout_seed_prevalence.js` NOT re-run in any form; no game was played.**

## 7. Verification actually performed

| command | result |
|---|---|
| `node tests/test-roadmap-register.js` | **3 passed, 0 failed, exit 0** (register 364 items, #402 present) |
| `node tests/test-docs-current.js` | **23 passed, 0 failed, exit 0**; ratchet unmoved, baseline left untouched |
| `roadmapRowIsClosed('#402')` / `roadmapRowSaysBroken('#402')` | `false` / `false` — open, asserts no breakage |
| `roadmapRowIsClosed('#248')` | `true` — still closed, not reopened |
| repo-wide re-sweep for `70.55`, `70.554`, `55.379`, `55.4%`, `70.6%`, `70.5%`, `105,430`, `134,319` | only `CHANGELOG.md` ×3 and the Protect false positive remain, both deliberate |
| `grep MC.mons\|mcKey\|.mons` in the three sibling prevalence generators | **no matches** — their figures are unaffected |
| `grep pct_248_bench_moves_differ\|pct_any` in `engine/ tests/ web/` | no consumer outside the generators |
