# Publish pass 5.258.0 — the living-docs restatement of board-material 50 / protocol 151

MEASURE, 2026-09-06. Settled tree. **Nothing committed** — Will pushes. No engine byte, no artifact
figure and no gate reading was moved by this pass; the only files written are documents, the four
`<!-- GENERATED -->` ledger blocks (by `status.js --write`, never by hand) and eleven PDFs.

---

## THE NUMBERS, RE-READ FROM THE ARTIFACTS RATHER THAN FROM THE BRIEF

Every figure below was read out of the artifact named beside it during this pass. **None disagreed
with the brief.** One near-miss is recorded because it is the kind of thing that becomes a wrong
published number: `end_state[0].summary.by_cause_totals.games_board_material` in
`data/game-differential.json` reads **46**, and that is **not** the gating clause's quantity. The
clause counts `state.games` less `state.games_board_never_diverged` — 961 − 911 = **50** — and the
46 is the by-cause attribution, which is smaller by exactly the **4** games that part a board with
the protocol identical all game. `engine/status.js` prints that derivation in full; reading the
field whose name looks right would have republished a 46 into six documents.

| figure | read from | value |
|---|---|---|
| board-material | `data/game-differential.json` via `engine/status.js` | **50 of 961** (5.2%) |
| protocol first divergence | `data/game-differential.json` `diverged` | **151 of 961** (15.7%) |
| release / cap / arm / steering / pool | `data/game-differential.json` stamps | `db248fe67a5e`, 20, `middle`, `empirical-click/v1`, `data/team-pool-frozen` |
| boards never diverged | `state.games_board_never_diverged` | 911 |
| boundaries compared | `state` | 10376 identical of 10539 |
| gate clauses | `node engine/status.js` | **7 of 9 passing**; the two failures are the whole-game BOARD-MATERIAL and NARRATION clauses |
| census | `data/mechanics-census.json` | 829 live / 829 probed / 0 missing / 0 threw / 0 hollow |
| roster items | `data/roster.items.json` | 140 tested of 148; `FIRED-AND-BOARDS-DIFFER` 0, `DID-NOT-FIRE` 0 |
| roster abilities | `data/roster.abilities.json` | 129 tested of 202; both counters 0 |
| roster moves | `data/roster.moves.json` | 475 tested of 500; both counters 0 |
| damage differential | `data/engine-diff.json` via status | 0/6000 at the midpoint and at all sixteen corners |
| mechanics fire | `data/all-mechanics-fire.json` | `games_played` 1313, `games_threw` 0 |

**The two failing clauses now fail on counts.** They had been failing on withheld staleness, which is
the same colour and a different statement.

## VERSION AND WHAT MOVED

**CHANGELOG top version 5.257.0 → 5.258.0 (minor).** Fixes plus a republished artifact; nothing
breaking.

| document | what it got |
|---|---|
| `CHANGELOG.md` | new `## [5.258.0] — 2026-09-06` entry, Keep-a-Changelog, `### Fixed` / `### Changed` / `### Notes` |
| `docs/ABRA-whitepaper.md` | version header + 9 new paragraphs |
| `docs/ABRA-deck-plain-english.md` | version header + 10 new paragraphs |
| `docs/ABRA-technical-docs.md` | version header + 11 ASD-STE100 blocks |
| `docs/SUMMARY.md` | version header + the question/artifact/answer table and 5 paragraphs |
| `docs/MODELS.md` | version header + 7 paragraphs |
| `docs/DAMAGE-STAGES.md` | version header + 4 paragraphs — **required by the gate, not on the brief's list**; it carries a version header and is not in `version_pins`, so it must track the CHANGELOG top |
| `docs/MEASURE.md` | new `CHANGELOG 5.258.0` section above the 5.257.0 one |
| `docs/ENGINE.md` | its two already-written sections for tonight tagged `CHANGELOG 5.258.0`; the Gigaton Hammer section tagged `CHANGELOG 5.257.0`, which it belonged to and had not carried |
| `docs/{ENGINE,MEASURE,SEARCH,OPS}.md` | `<!-- GENERATED -->` blocks restamped by `node engine/status.js --write`, `_stamped 2026-09-06 01:28_` |

`docs/ENGINE.md` needed no restatement: the engine agent had already written both of tonight's
sections with the correct 56 → 50 and 158 → 151 figures. What it lacked was the version tag.

## THE TWO CORRECTIONS, WRITTEN AS CORRECTIONS

Both appear in the white paper, the deck, the technical docs, SUMMARY, MODELS and the MEASURE
ledger, each stating the prior figure before the new one.

**1. The 1.53× protect amplification was measured against the wrong ruler.** Decomposed over the
run's own 17,532 decisions: declared input 13.565% → the same table's marginal weighted by the
decisions this arm took 16.209% (×1.195) → renormalised over the legal candidate set 20.257%
(×1.250) → realised 20.374% (×1.006), total ×1.502. The first factor is the **denominator**, not a
driver defect: the arm plays a census-steered pool, not the ladder. Against the pool-matched
16.209% the arm reads **×1.257**. **Legality subsetting is withdrawn as a cause and its sign is
inverted** — the mean candidate set is 3.772 of four, 87.0% of decisions (15,253) have all four
moves and read 21.724%, and a decision with one legal candidate reads 8.134%.

**2. Two prediction misses, both the same mistake.** Leech Seed called 58 / 157 and read 56 / 158;
Fairy Aura called 54 / 156 and read 51 / 153. Both reasoned from
`state.first_board_divergences`, **which is capped at 40 rows and is a sample, not the population.**

A third item is carried as new evidence rather than as a correction: the protect rule now has a
**measured noise floor** — split-half on games, 92,949 / 92,473 clicks, the half-vs-half spread of
the observed rate is **0.002 points** against an over-prediction of **+1.644 / +1.646 points**. That
is the first calibration figure in this project to arrive with its own floor attached. **The noise
floor for the whole-game differential is still unmeasured and is still owed.**

## WHAT IS OWED AND IS SAID PLAINLY IN EVERY DOCUMENT

- Leaf calibration — MEASURE's one number — **stays WITHHELD and was not run.** `data/winrate-backtest.json`
  is downstream of MEDICHAM and the gate is shut on the board-material clause. No reliability curve
  is published in 5.258.0 and none is implied.
- **The MAG refit stays OWED and is a REFIT, not a restamp.** `data/policy-weights.json` was not
  touched. The damage table under the fitted vector moved from 318 species to 322, so the feature
  function's INPUT changed.
- Engine gaps named and not fixed: Struggle's `-activate` line (17 games, needs a `tags.json`
  regeneration); Poltergeist announcing at use time rather than inside `onTryHit` (7 games);
  `mustrecharge` at priority 11 outranking sleep and freeze.
- Narration gaps measured and not fixed: no Fairy Aura ability line on entry or mega, no Unnerve
  ability line on a switch-in.
- Filed as INSTRUMENT with the reason: ~6 Poison Touch / Cursed Body / Flame Body games in the `any`
  bucket `midGameVoid` declares unreadable, and 5 `stall` games with a board divergence and no
  protocol divergence, which `--dump-games` cannot show.

## GATES

| gate | reading |
|---|---|
| `tests/test-docs-current.js` | **24 passed, 0 failed** |
| — 3b(b) figures a cited artifact does not contain | baseline 67, now **67** — no new entry |
| — 3b(c) untraceable figures | **35 across 6 documents, unchanged** — this pass added none |
| `tests/test-roadmap-register.js` | 3 passed, 0 failed |
| `tests/test-artifact-rerunnable.js` | ALL GREEN, 5 checks, 1 known stranding (was 1) |
| `tests/test-register-cell-parse.js` | PASSED |
| `node engine/status.js` | 7 of 9 clauses passing (unchanged by this pass) |

**One gate went red during the pass and was FIXED, not filed.** `test-docs-current.js` 3b(b) reported
one new entry: `docs/MODELS.md:17  322  not in data/policy-weights.json`. The paragraph cited
`data/policy-weights.json` and stated the damage table's 318 → 322 move in the same breath, and 322
is not in the weights file. It was **split into two paragraphs** — the citation with the claim it
actually supports (the vector was not touched), and the table's movement on its own, pointing at
`node engine/status.js` for the moved-input list rather than typing one. The gate returned to 24/0.
The identical sentence passes in the white paper only because that paragraph happens to cite a second
artifact that does contain 322; that is luck, and it is recorded here rather than relied on.

**And one written reason in `data/docs-currency-baseline.json` was corrected rather than left to
rot.** The hand entry ENGINE added when the artifact was republished said the living-docs restatement
*"is what retires this entry"*. It does not: the offending line is a DATED 5.252.0 entry inside the
deck that states 4.8% and cites the artifact, and restating the current figure elsewhere in the same
document cannot make 4.8% reappear in `data/game-differential.json`. The reason now says the entry is
permanent and why. A ratchet entry whose stated retirement condition can never fire is the same
failure as a caption standing in for a quarantine. The file still parses and the gate is still 24/0.

Per-line backtick parity was checked on every block before insertion (an unpaired backtick once
blanked 27,000 lines of this scanner's input). Line endings were preserved per file — the deck,
technical docs, SUMMARY, MODELS, DAMAGE-STAGES and MEASURE are CRLF; CHANGELOG and ENGINE are LF.

## PDFs

**Rebuilt (11):** `ABRA-whitepaper.pdf` (and its case-identical legacy name `ABRA-WhitePaper.pdf` —
one file on this filesystem), `ABRA-deck-plain-english.pdf`, `ABRA-technical-docs.pdf`, `SUMMARY.pdf`,
`MODELS.pdf`, `DAMAGE-STAGES.pdf`, `ENGINE.pdf`, `MEASURE.pdf`, `OPS.pdf`, `SEARCH.pdf`,
`ROADMAP.pdf`. `build/md_to_pdf.js` was called per file, because `build/build_pdfs.js` takes no
file argument and would have rebuilt 35.

**NOT rebuilt: 24**, and none of them is a document this pass touched. They are pre-existing debt —
`ADR-002` and `PRIOR-ART` and `MEGA-FEATURES-SPEC` and `CARD-REVIEW-2026-08-22` are **missing**
outright, and 20 more are stale, including `DIVISIONS.pdf`, `GLOSSARY.pdf`, `LESSONS.pdf`,
`TAGS-MASTER.pdf` and `WEB.pdf`. `node build/build_pdfs.js --check` prints the list. They are
reported, not implied current.

## NOT DONE

- **Nothing is committed and nothing is pushed.** Will pushes.
- **`data/policy-weights.json` was not touched** and no fit was started.
- **No measurement was re-run by this pass.** Every count above is a read of an artifact another
  pass wrote; `status.js` was run twice read-only and once with `--write`.
- `data/provenance-stamp.json` is rewritten by any `status.js` run and has moved. That is generated
  output, not a figure.
- `docs/MEDICHAM-SPRINT-NOTES.md` does not exist, so the sprint exemption in `engine/docs_scan.js`
  is not active and every figure clause applied at full strength to everything written here.
