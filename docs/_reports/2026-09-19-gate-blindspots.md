# 2026-09-19 — three blind spots become failing gate clauses (MEASURE, 6.64.0)

Will: *"stop saying medicham is done when all these blind spots remain"*. From now on `engine/quarantine.js` prints
whether MEDICHAM is done. No summary claims it. Only `engine/quarantine.js` was edited, plus its selftest, the
notes row, the CHANGELOG and the MEASURE ledger. No `data/` artifact was touched, and no heavy stage was run.

## Verdict

- **Three new failing conditions are wired.** All three were shown RED on a planted case, and each one was
  shown RED again on a deliberate break of the shipping code.
- **Read against the old artifacts (release `4c9b0cc4a4da`, HEAD), two gating clauses would now fail:**
  - **mechanics** fails with **63 unproven in-scope rows**;
  - **board-material** fails with **1 / 1 / 2 thrown games** on the three lattices.
  - The leaves clause reads **0** and passes.
- **The brief assumed a parted board already failed elsewhere. It did not.** `move:axekick` parted a board
  with `diverged: false`, and nothing counted it. It is now counted, and today it sits below the reach shelf.
- **The selftest passes 315 of 315.** It passed 285 before, so there are 30 new arms.

## 1. The mechanics clause needs proof (`mechanicsProof`, ANDed into `mechanicsClause`)

**Rule.** The scope comes from `engine/legal_scope.js derive()`, the same producer `engine/coverage.js` uses.

| kind | proven | everything else fails |
|---|---|---|
| ability | `verdict === 'FIRED'` and a control arm | DID-NOT-FIRE, FIRED-UNCONTROLLED, UNPROVEN-UNCONTROLLED, SHOWDOWN-ONLY, MEDICHAM-ONLY, "FIRED WITH NO CONTROL ARM", NO ROW |
| item | the same as an ability | the same as an ability |
| move | `resolved && medicham_resolved` (the predicate coverage.js credits) | NOT RESOLVED ON SHOWDOWN / ON MEDICHAM / ON NEITHER, NO ROW |

The proof is computed after the pin guard. It is ANDed into both return paths, including the rows-and-summary
early exit, so no early exit can open the clause over an unproven row.

**Only two things excuse a row, and both are read from where the ruling lives:**

- **DEFERRED-BY-OWNER.** This is the `tests/roster.js DEFERRED` map, read from the artifact's `closet.ids`.
  `engine/all_mechanics_fire.js` writes that block from `Object.keys(require('../tests/roster.js').DEFERRED)`.
  - It is not `require`d directly, for a measured reason. Loading `tests/roster.js` pulls in the whole
    differential harness. That costs **~8 s** and prints a page of stdout into every gate read.
  - Under `node -e`, the load throws (`steering.driverCode: no entry file`).
- **The Illusion closet.** This is `CLOSET_ABILITY` / `CLOSET_SPECIES`, read from the `closet` block that
  `engine/game_differential.js` stamps into each lattice artifact (`ability: "illusion"`,
  `species: ["zoroark","zoroarkhisui"]`). These are the harness's own constants, carried in its receipt and
  never re-derived. The samples must agree with each other. If they disagree or carry no block, the closet
  excuses nothing.
- **Anything else excuses nothing.** A `deferred` stamp that neither source corroborates excuses nothing and
  is named.

**The board-only divergence.** `classifyMechanics` read only `r.diverged`, which is the protocol comparison.
On `4c9b0cc4a4da`, the board of `moves:axekick` parted with `board.verdict: 'STATE'`: `vol.confusion` read us 1
against Showdown 2. Its `diverged` was `false`. `data/roster.moves.json` usage-shelves the same move as
DEFERRED-BY-OWNER, so no clause counted it.

A board-only parting now takes the same path as a divergence:

- the owner's shelf, the reach shelf and decision impact all apply;
- a declaration never applies, because the row has no protocol cause;
- it is counted apart from `rowsSeen`, so the rows-versus-summary check does not change.

Today axekick has 2 clicks out of 64,846 games, which puts it below the reach shelf. It is printed but not
counted.

**Read on HEAD's `data/all-mechanics-fire.json`** (release `4c9b0cc4a4da`, generated 2026-09-19T13:18:26Z,
with the pin guard bypassed by handing `cur = 4c9b0cc4a4da`): **63 unproven**.

| group | n | ids |
|---|---|---|
| ability FIRED-UNCONTROLLED | 20 | disguise, eelevate, spicyspray, angerpoint, cudchew, drought, electricsurge, forecast, goodasgold, hungerswitch, innardsout, levitate, parentalbond, sandspit, sandstream, stancechange, sweetveil, waterabsorb, weakarmor, zerotohero |
| ability DID-NOT-FIRE | 18 | healer, aromaveil, curiousmedicine, earlybird, guts, harvest, lightmetal, magician, marvelscale, noguard, poisonheal, quickfeet, ripen, screencleaner, steadfast, swiftswim, synchronize, technician |
| ability UNPROVEN-UNCONTROLLED | 11 | dragonize, firemane, megasol, piercingdrill, unseenfist, aerilate, furcoat, megalauncher, mimicry, shadowtag, surgesurfer |
| ability SHOWDOWN-ONLY | 6 | naturalcure, moldbreaker, pressure, rockhead, supremeoverlord, unnerve |
| move NOT RESOLVED ON MEDICHAM | 8 | allyswitch, destinybond, guardswap, lifedew, powerswap, sleeptalk, topsyturvy, wish |

Five rows are excused: `move:copycat`, `ability:anticipation`, `ability:pickup` and `ability:stall` come from
DEFERRED, and `ability:illusion` comes from the Illusion closet. No stamp was left uncorroborated. Items are
148 of 148 FIRED with a control.

**The 8 moves need an ENGINE judgement.** `medicham_why` reads *"the move executed and produced no consequence
line at all"* on seven of them. Lifedew reads `-fail heal` at row level while its planned arms read
`medicham_resolved: true`. Their boards read NO-DIVERGENCE. The brief's rule is "resolved on both engines", and
by that rule they fail. They may be a MEDICHAM narration marker gap rather than a board defect. The clause
names them, and ENGINE decides which they are.

## 2. The board-leaves clause (`boundaryLeavesClause`, new, gating)

The clause is named `board leaves / nothing that can stand at a turn boundary goes uncompared`.

- **It fails when** `tests/probe_uncompared_leaves.js derive().standing_at_the_boundary > 0`. This is the one
  producer that coverage.js quotes, and the clause names each leaf.
- **It cannot answer (exit 2) when:**
  - `boundaryCallSites()` shows a second `BS.snapshot` caller. The standing count rests on a single sampling
    point, so a second caller breaks it.
  - the derivation throws.
- **Its receipt is `PIN.noArtifact`**, because the clause derives from the live tree.
- **Today it reads 0 standing.** 56 leaves are compared and the hole holds 20. `BS.snapshot` has 1 call site
  and no other caller. The clause passes.
- **One thing is not gated, on purpose.** coverage.js also joins "uncomparable leaves with no firing writer".
  Those leaves cannot stand at the boundary at all, so the gap is evidence rather than an unread board. The
  join stays reported in coverage.js and is not gated.

## 3. A game that threw fails the board-material clause

- **The defect.** `playGame` catches a refused choice and returns `err` / `endReason: 'THREW'`, and it keeps
  its pre-throw boundaries. `state.games_board_never_diverged` is `boundaries > 0 && !stateDiv`, so a
  truncated game counted as agreeing.
- **The fix.** `wholeGameClause` now reads `j.threw` and `j.errors[]`:
  - if the two disagree, it uses the larger and prints the disagreement;
  - if both are absent, it returns CANNOT ANSWER;
  - `ok = material === 0 && threw === 0`.
- **The lattice.** A thrown game makes its sample NON-ZERO (exit 1), not CANNOT-ANSWER. The tally prints
  `+ N THREW`.
- **Read on HEAD's lattices (`4c9b0cc4a4da`):** `threw` is 1 / 1 / 2 at `--games` 1200 / 1350 / 1950.
  - 1200: `Can't move: Floette's Protect is disabled`
  - 1350: `Can't move: Sinistcha's Matcha Gotcha is disabled`
  - 1950: `Altaria's Protect is disabled`, `Mr. Rime's Protect is disabled`
- **On the new engine.** CHANGELOG 6.63.0 says the driver no longer clicks refused moves, and that the four
  truncated games now play out on `d92bdfb50d88`. If that holds, this clause reads zero thrown games on the
  republished lattices.

## Red demonstrations

**Planted cases (selftest arms, shipping functions, handed-in fixtures, one knob each):**

- **Proof.** Each of these fails, exit 1, and is named with its label: DID-NOT-FIRE, FIRED-UNCONTROLLED,
  UNPROVEN-UNCONTROLLED, SHOWDOWN-ONLY, MEDICHAM-ONLY, FIRED-without-control, an item that did not fire, a move
  not resolved on MEDICHAM, and NO ROW.
  - The gate turns on these cases.
  - The excusals hold: DEFERRED and Illusion rows are excused.
  - The negative cases fail: an Illusion row with the closet unread fails, an uncorroborated stamp fails, a
    scope that throws fails, and the rows-missing path fails.
- **Board-only.** A row whose board parted is counted, and its control is not. Below the reach shelf the row is
  shelved. On the owner's shelf it is named apart. Through the clause, it fails.
- **Leaves.** Zero passes. One planted leaf (`volatile:unburden`) fails with exit 1. A second caller returns
  exit 2. A throw returns exit 2. The gate turns.
- **Threw.** One thrown game fails with exit 1. A count disagreement fails and uses the larger count. With no
  field the result is exit 2. Through the lattice, a thrown game fails with exit 1 and `+ 1 THREW`.

**Deliberate breaks of the shipping code, on scratch copies.** Each copy is the file with one line changed.
The scratch control copy fails 19 unrelated play-layer arms because the relocated file cannot see its own
source graph. The counts below are on top of those 19.

| break | new FAILs | which |
|---|---|---|
| `mechOk = counted.length === 0` (proof dropped) | 13 | every PROOF red arm and the excusal-negative arms |
| rows-missing branch `ok: div === 0` | 1 | the early-exit arm |
| `boardOnly = false` | 4 | every BOARD-ONLY arm |
| `ok: material === 0` (threw dropped) | 3 | every THREW red arm |
| leaves `ok: true` | 2 | the planted-leaf arm and the gate arm |

## Versioning

- **The version is 6.64.0, a MINOR.** The basis is unchanged: the question is still "is MEDICHAM correct", now
  with a stricter bar. This is the same precedent as 6.56.0, where an unstaged in-scope row began failing the
  roster clause.
- **It is not a PATCH, because it supersedes a published verdict.** The 6.61.0 row's ~~GATE: OPEN~~ was read
  under the nine-clause bar. There are now ten clauses, and that release's artifacts would not open the gate.
- **The ENGINE re-measure should take 6.65.0**, or the coordinator renumbers.

## Other gates run (light)

- **`tests/test-docs-current.js` reads 35 passed, 2 failed.** Both failures sit only in `docs/ABRA-deck-plain-english.md`,
  `docs/ABRA-technical-docs.md`, `docs/MODELS.md` and `docs/SUMMARY.md`. Those are the held next-major drafts,
  which were already modified in the working tree before this pass. I did not touch them.
- **My files are clean under that gate:** `CHANGELOG.md`, `docs/RUNNING-NOTES.md` and `docs/MEASURE.md`.
  The row check reads "top 6.64.0 is a minor bump" and matches.

## Files changed

- `engine/quarantine.js`: the three clauses, the board-only routing, the lattice THREW state, and 30
  selftest arms.
- `CHANGELOG.md`: 6.64.0.
- `docs/RUNNING-NOTES.md`: the 6.64.0 row.
- `docs/MEASURE.md`: a ledger entry above the 6.56.0 one, outside the GENERATED block.
- `docs/_reports/2026-09-19-gate-blindspots.md`: this report.

## OWED, NOT RUN

- **`node engine/status.js --write`** is not mine to run now. The ENGINE agent runs it after its re-measure.
- **The full gate (`node engine/quarantine.js`) on `d92bdfb50d88`** has not been run. It is the ENGINE agent's
  last step. On the current tree, the mechanics and lattice clauses are also withheld by the release pin until
  the republished artifacts land.
- **These are not gated, by choice:**
  - Board verdicts `NOT-ASKED` and `core_leaf_unchecked`. Both read zero rows on `4c9b0cc4a4da`.
  - A parted **control-arm** board: `ability:hypercutter`'s control (Anger Point) read STATE (atk 6 against 5).
    Anger Point is itself FIRED-UNCONTROLLED, so it already fails the proof.
  - The staged-game runner's own `games_threw`, which is 0 today.
  - The coverage.js "no firing writer" join.
- **The move usage shelf is not applied to the proof.** The brief excused only DEFERRED and Illusion. No move
  is affected today. If a rarely clicked move ever stops resolving, it holds the gate, and Will may want the
  25-click shelf to apply.
- **The 8 moves not resolved on MEDICHAM need ENGINE's judgement:** a real non-resolution, or a missing
  consequence line.
- **The held 7.0.0 draft needs re-reading against this change.** It is in `docs/_reports/2026-09-19-700-draft/`
  and in the working-tree deck, technical docs, MODELS and SUMMARY, and it says the gate is open.
- **`web/quarantine-data.js` will print DRIFTED** in status.js, because the new clause name is not in the
  bundle. Web is paused.
- **No commit and no push**, per the brief.
