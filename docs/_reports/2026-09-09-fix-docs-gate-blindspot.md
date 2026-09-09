# 2026-09-09 — ROADMAP #552: the docs gate could not see a wrong headline

MEASURE. Nothing committed, nothing pushed, `status.js --write` not run (held by another agent).
Files changed: `engine/docs_scan.js`, `tests/test-docs-current.js`, `data/docs-currency-baseline.json`
(hand edit, then rewritten by the green run), `docs/RUNNING-NOTES.md` at the two rows
`tests/test-docs-quarantine.js` named. Every figure below was measured this session on the working
tree as other agents left it; where their in-flight edits move a number it is said.

## Verdict

- **Green-on-wrong reproduced on the committed instrument.** `27 of 961` → `41 of 961` at
  `docs/MODELS.md:7`, injected through `read`, never written: **0 hits before, 0 hits after.**
- **The landed instrument reads that block and says what it can and cannot judge.** The block is
  stamped 5.266.0 (CHANGELOG 2026-09-06) and cites `data/game-differential.json`, regenerated
  2026-09-09 (0 of 958). It is filed as PREDATING, not accused, and the two operands the sentence
  names are what it reports: `961 (field state.games reads 958)`, `934 (field
  state.games_board_never_diverged reads 958)` — original and mutant alike. **The digit 41 itself is
  not catchable from the disk:** `41` and `27` are BOTH in the artifact by set membership (turn
  indices), and the instance the sentence describes no longer exists on disk. That is a finding
  about the block, not a gap left open: the same mutation in a current sentence, or bound to a field,
  is red by name — `docs/_x.md:3  41  not in data/game-differential.json  (field state.games reads
  958)` — with the 958 control green in both forms.
- `tests/test-docs-current.js`: **32 passed / 1 failed → 35 passed / 0 failed**, exit 0.
- `tests/test-docs-quarantine.js`: the 23 `docs/RUNNING-NOTES.md` hits are gone; **red only on
  `docs/ARCHITECTURE-REVIEW-2026-09-09.md:656`** (8 figures, a review table that quotes the withheld
  profile numbers while describing them) — not a file this task owns.
- **19 of 19 browser bundles parse; 0 "present but unparsable" warnings.**

## 1. What was actually wrong, measured

Two mechanisms were named in the brief. Scoping `QUALIFIED` to the sentence exposed a third and a
fourth, and the composition of what it exposed is the finding.

| stage | fresh accusations vs the 59-key baseline | what explained the drop |
|---|---|---|
| committed instrument | 0 | block-level `QUALIFIED`: one word anywhere exempts every figure |
| `QUALIFIED` per sentence | **632** (MODELS 226, whitepaper 130, RUNNING-NOTES 115, tech-docs 71, SUMMARY 32, TAG-COVERAGE 22, +7 docs) | — |
| + block dated vs artifact `generated` | 463 | 201 figures sit in blocks that predate the artifact on disk |
| + a `**5.264.0 -` paragraph dates its followers | 406 | the ledgers stamp a paragraph, then elaborate it |
| + **citation bound to the sentence, not the block** | **60** | 63 accusations in ONE `**5.244.0 -` paragraph were figures judged against `data/policy-weights.json` because the paragraph said no vector was written to it |
| + field citation binds the adjacent figure; container size counts; bold-title dating; `correction` in QUALIFIED | 52 | `"5,265 games (data/guru-matchups.json:n_games), 12 archetypes"` had scored the 12 against `n_games` |
| + `;` is a clause boundary | 46 | `"WAR 0.6936 — data/war.json; NMF 0.682 — data/nmf-roles.json; ..."` — one claim per clause |
| + hard-wrapped bold titles read across three lines | **45** | the white paper wraps at ~100 columns |

**Every `docs/RUNNING-NOTES.md` row carries a `**Supersedes.**` bullet, so the notes page had never
once been under rule 3b(b).** The test's comment that the rule "applies to it exactly as to the white
paper" described a check that had never fired on it.

**Accusing dated records is the treadmill `changelogHas()` already documents.** `game-differential.json`
is rewritten by every ENGINE batch; a row that faithfully recorded 27 of 961 on 2026-09-06 would go red
on 2026-09-07 for nothing anyone did. So the rule now dates both sides — a version stamp opening the
block, a date or version in its bold title, the nearest dated heading, or the document's declared pin
in `version_pins`, resolved through CHANGELOG.md; against the artifact's own `generated` (248 of 286
artifacts carry one) — and files a figure whose every cited artifact was regenerated after the block as
**PREDATING: reported on every run, not gated.** Not a word anyone can add: moving a block into that set
means stamping it with an old version, which is a falsified record. **88 figures** over living + notes
(SUMMARY 27, MODELS 18, whitepaper 14, RUNNING-NOTES 9, tech-docs 7, ENGINE-COVERAGE-PLAN 7, ADR-002 5,
GAME-DIFFERENTIAL-DESIGN 1); the CLI prints 79 over living documents alone.

## 2. The field-aware check (item 2)

- `data/x.json:a.b[0].c` — the figure ADJACENT to the citation (after it through a short connector,
  else before it within a parenthetical reach) is judged against that subtree only, with the existing
  rounding / ×100 / ÷100 tolerance; `[]` reaches every element; a container's size counts as a claim
  about it (`"data/pokemon-roles.json:roles, 52 keys"`); a field the artifact lacks is a hit keyed
  `:field`. 45 such citations exist in `docs/` today.
- A backticked key path that resolves to a numeric leaf in a cited artifact, followed by a figure
  (`` `state.games` 961 ``), binds that figure to that leaf. This is the operand form the MODELS.md:7
  headline uses, and it is what turned that block from silently green into "961, field reads 958".
- **The "numeric leaf whose key path shares a token with the sentence" rule for file-only citations was
  prototyped and left out.** Measured on the MODELS.md:7 block: it REFUSED the correct 961
  (`arms[0].games` shares no prose token once code is stripped) and PASSED the mutant 41
  (`state.agreement_by_turn[40].turn` shares `state`). A rule that fails the true figure and clears the
  false one has not understood the defect; the comment in `docs_scan.js` records it.
- Never weaker than today: a subtree is a subset of the file, a leaf a subset of the subtree, and a
  file-only citation with no key path is still set membership.

## 3. The docs-quarantine row (item 3)

`docs/RUNNING-NOTES.md`, the `[Unreleased] — 2026-09-08` MILTANK profile row: the `**Measured.**`
bullet's figures came OUT (sayHeld shape — the artifact is named, why it is withheld is stated, the
re-run is given, the qualitative findings stand without a number); the `**Owed**` bullet's four overrun
readings and the budget constant came out. In the `[5.267.0]` row the struck span `~~MILTANK's 20,000
ms budget~~` — the constant is uniquely the withheld profile's — now reads "per-decision budget". The
test's remaining red is `docs/ARCHITECTURE-REVIEW-2026-09-09.md:656`, and its own BASELINE still lists
`docs/MEASURE.md|51.25%|data/winrate-backtest.json`, which no longer fires (the test prints the DELETE
line); neither file is this task's.

## 4. The browser bundles (item 4)

`bundleJson()` strips leading comments, takes the first `=`, and reads the first balanced `{…}`/`[…]`
after it with a string-aware scan — `window.X=`, `window.X = `, `(function(root){root.MAG=…})(…)`,
`const MC = {…}` inside a closure, and the `window.STATUS = window.ABRA_STATUS` alias line all parse;
a JS object literal comes back as NOT DATA rather than being executed. 8 wrapper shapes are pinned by
`bundleProof()`. All 19 parse (abra-meta 306 numbers, abra-tags 814, board-data 2,884, engine-data 990,
guru 329, kad-replays 685, live 20, mag 1,233, mega-formes 97, mew 380, move-effects 41, nmf 163, pory 12,
roles 2,145, scoreboard 1,509, slowking-playstyle 19, slowking 19, status 25, xatu 1,102).

**What became scorable.** Bundles are now citeable (`citationsIn` admits `data/*.js`; documents cite
`data/engine-data.js` 101 times, `data/live.js` 15): **50 sentences cite a bundle, 23 figures in them
are judged, 20 are in the bundle, 1 is accused** (`docs/SUMMARY.md:1416` — 1,163,315 is Smogon's
battle count beside `data/live.js`), 1 sits in a qualified sentence, 1 cites `data/formats.js`, which
does not exist. In the census union they trace 2 of MODELS.md's figures (30 rather than 32).

**And they are NOT owners.** With bundles admitted to `uniqueOwners()` the quarantine clause fell
**79 → 74**: `data/pory.js` is built FROM `data/pory-eval.json` and became a second "owner" of PORY's
withheld figures — a copy of a withheld number acquiring a witness that is itself. `uniqueOwners()` is
now JSON-only, with the measurement in its comment. Quarantine hits: 79 before, 79 after.

## 5. The baseline, and what is in it now

`known.citation_mismatches`: 59 → **45**, every key re-keyed (the `cites` part is now the sentence's
citations) so the 59 retired by re-keying, not by being fixed; their prose reasons are kept. The 45:

| class | keys | where |
|---|---|---|
| another agent's in-flight regeneration — **not chased** | 10 | RUNNING-NOTES:88 `0.682` (`data/nmf-roles.json`, regenerated 2026-09-09, modified in tree) and 7 CHOMP-EV/clone figures + SUMMARY `3.6978` + whitepaper `26` (`data/policy-eval.json`, modified in tree) |
| a figure beside a citation that is not its source | 21 | RUNNING-NOTES :195 :203 :260 :300 :349 (a red test's `1 of 61`, store counts, register rows before/after, old speed figures, in the same clause that names policy-weights / register-reality / protocol-events / medicham-speed for another reason); SUMMARY 1,163,315 (live.js), 144 (12×12 cells), 85 (the store claim, re-keyed) |
| a dated record the disk can still judge and contradicts | 14 | whitepaper 322 / 24.2 / 26.5 / 1,995 / 181; tech-docs 81 / 82 / 21; MODELS:1466's four PORY coefficients (a correction blockquote without a qualifier word); whitepaper + SUMMARY 19,589 / 8,713 in a block that itself says they were never in `data/quality-filter.json` |

`known.untraceable_by_doc`: **raised by hand as a DISCOVERY** (the 2026-08-15 precedent): MODELS 13 → 30,
whitepaper 9 → 12, and three documents never counted — TAG-COVERAGE 14, tech-docs 1, SUMMARY 1. The
census used to skip a whole block for one citation anywhere in it; a sentence that cites nothing is now
the census's. No document changed; 34 figures the instrument had been looking away from.

The `0.79 not in data/nmf-roles.json` at whitepaper:2025 the brief mentioned is gone from the document
(another agent's edit), not from the instrument.

## 6. Receipts

```
committed instrument, MODELS.md:7                ORIGINAL 0 hits   MUTATED 27->41 0 hits
landed instrument,   MODELS.md:7                ORIGINAL accused 0, predating 2   MUTATED accused 0, predating 2
   PREDATING docs/MODELS.md:7  961  not in data/game-differential.json  (field state.games reads 958)  block 2026-09-06 < artifact 2026-09-09
   PREDATING docs/MODELS.md:7  934  not in data/game-differential.json  (field state.games_board_never_diverged reads 958)  block 2026-09-06 < artifact 2026-09-09
undated sentence, `state.games` 958->41          ACCUSED docs/_x.md:3  41  not in data/game-differential.json  (field state.games reads 958)
undated sentence, control 958                    accused 0
`data/game-differential.json:state.games` 41     ACCUSED docs/_x.md:3  41  (field state.games)
same, control 958                                accused 0
41 in the artifact by set membership: true; 27: true
citationProof 20/20 hold; bundleProof 8/8 hold  (asserted by tests/test-docs-current.js 3b(b))
tests/test-docs-current.js    35 passed, 0 failed, exit 0
tests/test-docs-quarantine.js exit 1 — ARCHITECTURE-REVIEW-2026-09-09.md:656 only (8), RUNNING-NOTES 0
node engine/docs_scan.js      unparsable warnings 0 (was 19); mismatches 23 over living; predating 79
```

## Proposed RUNNING-NOTES row (not written)

```
## [Unreleased] — 2026-09-09 — the docs gate could not see a wrong headline, and the notes page had never been under the citation rule
- **What changed.** `engine/docs_scan.js` rule 3d: QUALIFIED and the citation are scoped to the SENTENCE (a `;` clause counts); `data/x.json:field` judges the adjacent figure against the field; a backticked key path binds the figure beside it to that leaf; a block is dated (version stamp, bold title, heading, or declared pin, via CHANGELOG.md) against the artifact's `generated`, and a figure whose cited artifact was regenerated after the block is REPORTED as predating, not accused; `data/*.js` bundles parse by wrapper shape and are citeable but never an owner. `untraceableCensus` reads the same split. 28 proof cases, asserted by `tests/test-docs-current.js`.
- **Measured.** Mutation `27 of 961` → `41 of 961` at docs/MODELS.md:7: 0 hits on the committed instrument; the landed one files the block's operands as predating (`961`/`934`, field reads 958) and accuses the same mutation in a current or field-bound sentence by name. Exposures: 632 with sentence-scoped QUALIFIED alone → 45 after binding and dating, 88 figures reported as predating. Census discovery: MODELS 13 → 30, whitepaper 9 → 12, TAG-COVERAGE 14, tech-docs 1, SUMMARY 1. Bundles: 19/19 parse, 23 cited figures judged, 20 found. `tests/test-docs-current.js` 32/1 → 35/0.
- **Basis.** unchanged. No published figure moves; the instrument that judges them does.
- **Supersedes.** Nothing. The 59 citation-mismatch baseline keys are re-keyed, not fixed. No quarantined figure is read or quoted; the MILTANK profile row's figures are WITHHELD, not captioned.
- **Owed to the next major.** The 45 ratcheted keys are the rows' authors' (cite the source, or none); the 88 predating figures are the documents pass, which clause 5 already counts.
```

**CHANGELOG bullet (not written):** `Fixed — engine/docs_scan.js rule 3d: a block-level qualifier
word and set-membership over the whole artifact let a mutated headline pass byte-identically (#552);
now sentence-scoped, field-aware, dated against the artifact's own stamp, and the 19 browser bundles
parse. tests/test-docs-current.js 32/1 → 35/0; baseline re-keyed 59 → 45 with reasons.` MINOR.

## OWED, NOT RUN

- **A derived headline is not checkable from the disk.** "27, which is 961 less 934" is arithmetic on
  two named leaves; the operands are checked, the difference is not. Either the artifact publishes the
  count as a leaf, or the rule learns `which is A less B`. Not attempted.
- **A predating block could be adjudicated from git** — the instance it names
  (`generated 2026-09-06T17:42:35Z`) is in history. That would close the #552 mutation for dated
  records outright. Designed, not built.
- **`docs/ARCHITECTURE-REVIEW-2026-09-09.md:656`** republishes the withheld profile figures; its owner
  must strip them. **`tests/test-docs-quarantine.js` BASELINE** still lists a key that no longer fires
  (`docs/MEASURE.md|51.25%|...`); delete it there.
- **The 45 keys** are named by document and class above; each retires when its row cites the artifact
  the figure came from, or none. The 10 in-flight ones retire when the NMF/CHOMP-EV pass settles.
- **`docs/RUNNING-NOTES.md` is modified by another agent** (7 uncommitted lines at :69–75); my three
  edits are inside the two rows named and nowhere else. `node engine/status.js --write` and the commit
  are the coordinator's.
