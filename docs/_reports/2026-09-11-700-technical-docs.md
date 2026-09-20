# 7.0.0 fold-in — docs/ABRA-technical-docs.md

Dated findings record. Not maintained, not current state, superseded by the register rows it feeds.

## Scope

One document and its PDF: `docs/ABRA-technical-docs.md`, `docs/ABRA-technical-docs.pdf`. No other
file was edited. No git, no tests, no games. The white paper, deck, SUMMARY and MODELS were held by
other agents in this pass.

## What was done

- Header bumped to `**Version 7.0.0 · Last updated 2026-09-11**`.
- New `7.0.0` block at the top of the document, above the 2026-09-11 gate-closed correction. The
  correction and the 6.0.0 block are kept unedited as dated evidence; the new block states that each
  dated block is true of the release it names.
- Folded in the owed rows 6.1.0 through 6.26.0: the new tools and commands (`engine/stage_planner.js`,
  `engine/legal_scope.js`, `engine/tag_lookups.js`, `engine/exit_codes.js`), the pre-commit hook
  judging the staged tree, the traceability ratchet, the quarantine classifier routes, the corner
  arms, and the frozen-release / three-pins procedure.
- Section 2 gained twelve tasks. Section 3 gained five reference subsections (3.4 scope codes, 3.5
  exit codes, 3.6 quarantine routes, 3.7 engine mechanisms and knobs, 3.8 instruments). Section 4
  gained 4.-3 on what a search can rely on in the simulator. The frozen-engine section gained four
  procedures and rules.
- Two dated blocks got a dated line appended rather than a rewrite: the "tool has never applied a
  multi-hit move" paragraph (superseded by CHANGELOG 6.1.0) and the "how to compare two runs"
  paragraph (pointed at the three-pins procedure).

## Verification

Every command, flag, knob and route was read from source, not from memory:

- `--games`, `--turns`, `--census`, `--team-store`, `--release`, `--arm`, `--steering`, `--end-state`
  read out of `engine/game_differential.js`; arm ids `middle`, `top-tie-first`, `bottom-tie-first`.
- `compat`, `cut`, `list`, `verify`, `rerender`, `--allow-authority-drift`, `cuts.jsonl` read out of
  `engine/engine_release.js`.
- Hook gate order and every `--staged` argument read out of `.githooks/pre-commit`.
- Commit-pinned citation form read out of `engine/docs_scan.js` `PIN_CITE_RE` /
  `pinnedCitationsIn`: `<commit>:data/<file>.json[:<field>]`, hash 7–40 hex.
- The eleven `MEDI_*` knobs were confirmed present in `engine/medicham2-browser.js`.
- `refusedByAbilityFlag` membership (`n` = 6) and its examples read out of `data/tags.json`.
- Every entity named in the document was filtered through `Dex.forFormat('gen9championsvgc2026regmb')`
  with `exists && !isNonstandard && tier !== 'Illegal'`. All passed; nothing illegal was written.

**Figure cross-check.** All 48 values typed into the new block were compared against the artifacts
they cite by script: 48 of 48 match. Artifacts were read at 21:34Z with a common mtime of 17:30:37
(≈4 h settled), so no torn read.

## Figures bound, and to what

| figure set | artifact | release |
|---|---|---|
| whole games, middle arm (961 / 961, protocol 0, narration 0, cap 50, pool 8778 / 1968) | `data/game-differential.json` | `534442d71183` |
| damage (6000 compared, 0 disagreed, seed 20260804, skips 0/0, volley 130/12/4) | `data/engine-diff.json` | `534442d71183` |
| roster items / abilities / moves scope blocks | `data/roster.{items,abilities,moves}.json` | `534442d71183` |
| census 883 / 883 / 883, 0 missing | `data/mechanics-census.json` | none stamped |
| staged mechanics 4702 games, 0 threw, planner 3836 | `data/all-mechanics-fire.json` | `534442d71183` |
| emitted events 45 | `data/protocol-events.json` | n/a |
| corner arms 961/960 protocol 12; 961/959 protocol 15 | `data/verification/game-differential-{top,bottom}-tie-first.json` | `b42b81899631` |

## Caveats and what could not be bound

1. **The corner arms are not on the gate release.** Both corner artifacts stamp `b42b81899631`, not
   `534442d71183`. No corner reading exists on the gate release. The document states the readings
   with an explicit rule not to attribute them to `534442d71183`.
2. **The census carries no release stamp.** `data/mechanics-census.json` has no `engine_release` key,
   so its figures are bound to the artifact alone.
3. **The three residual clock-card games were not written as a figure.** 1 + 2 is a derivation across
   two artifacts, not a field. The document says "the games that stay apart" and points at ROADMAP
   #584.
4. **`volley.unstageable` holds one row and the move is not named.** Naming it would have been an
   entity claim I had not put through the legality filter.
5. **`OWED_CAP` is named, not quoted.** The constant lives in `engine/docs_scan.js`; a code constant
   is not an artifact trace.
6. **No withheld figure was restored.** The clone-cost, interleave and profile results (6.9.2,
   6.10.2, 6.12.2) are referenced by CHANGELOG version with no numbers.

## Placeholder

One `<<GATE>>`, at **line 9**, in the GATE paragraph. Everything around it is phrased to survive
either verdict: the paragraph names the two dated CLOSED readings as belonging to earlier releases
and tells the reader to run the command. The "what an open gate does not do" paragraph is
conditional in form and states that downstream artifacts stay absent either way.

## Incidental finding (not fixed — ENGINE's file)

`engine/legal_scope.js`'s header comment says "Three of ENGINE's files still decide scope their own
way — engine/all_mechanics_fire.js, tests/roster.js, engine/tag_dex.js". Measured this pass: all
three import `legal_scope`, as do `engine/coverage.js` and `engine/stage_planner.js`. The comment is
stale as of CHANGELOG 6.14.0. The document was written from the measurement, not from the comment.
