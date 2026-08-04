# THE COVERAGE JOB — four layers, in order, with the trap named at each step

**Version 3.40.0 · 2026-08-04 · Authorized by Will: "im gonna turn on feeble for you to handle
this, this is a big job." Standard set by Will the same night: completeness, not usage-triage —
"WE NEED ALL FUNCTIONS IN THE GAME TO MAKE IT WORK. OTHERWISE ITS PLAYING BLIND MAN."**

This is the execution plan for ending the class of bug this project keeps finding: a fact exists in
the data, and the engine consults it partially, wrongly, or not at all — with nothing failing.
`docs/TAG-COVERAGE.md` holds the analysis and literature; this file holds the ORDER, the GATES, and
the honest failure modes. Read both before touching anything.

## The standing gate on all of it

**No check is committed until it has been shown failing on a known-bad input.** Tonight's split:
every instrument that met this bar worked (weather duration: red 4/60 pre-fix; engine release: live
edit under an open measurement, snapshot unmoved). Every instrument that skipped it produced garbage
(first tag sweep: 132 false DEADs; four successive flinch probes; an inflated exposure number quoted
to Will). The difference was never skill on the day — it was whether the failing-arm demonstration
was demanded before trusting the green.

## Current state (2026-08-04, end of session)

- Census 167 live / 174 probed / 7 missing-with-reasons. Differential 1/400 at seed 20260804.
- `data/interaction-matrix.json`: 1,008 co-occurring pairs, 940 agree, **68 disagreements queued**
  — ENGINE agent dispatched on all 68 plus the 7 missing plus the pre-turn class (Focus Punch /
  Beak Blast / Shell Trap; Shell Trap is entirely untagged).
- `tests/test-tag-consumed.js` + `data/tag-consumption.json` (ratcheted): 33 LIVE, 4 STAGED, 77
  UNREACHED (sweep gap, not engine gap — the sweep does not drive the battle loop), **61 DEAD**.
- The 61 split: 35 move tags mostly duplicated by the second rulebook (below); **26 ability/item
  tags, 104,484 uses, with no consumer and no fallback** — the sharp residue. Some are hardcoded by
  name instead (intimidate ×5, prankster ×10 as literals in the simulator).
- `MEDSEEN` counters exist in medicham2 for within-turn mechanics (flinch measured: 89 in 636
  turns). Pattern: any mechanic set and cleared inside one turn is unobservable from outside and
  needs a counter, not a probe.
- MEASURE refit MAG on the four-channel sheet (Will: open sheets always); weights moved in-tree,
  report pending. SEARCH fixed/probing the 58-dim step rule; exploitability re-run is QUEUED behind
  the engine work, against a fresh release. `data/exploitability.json` is void and must stay void
  until then.

## Layer 0 — the queue that is already concrete (no design, just work)

The 68 matrix disagreements and the 26 orphan ability/item tags. Each has a reproducible case or a
named carrier. An agent is on it. Nothing below starts until the 68 are resolved or reclassified,
because the matrix is the instrument that will verify everything else.

## Layer 1 — ONE GENERATOR for the two rulebooks

`data/tags.json` (500 moves) and `CHOMP/data/move-effects.json` (954 moves, and THE one the engine
reads for flinch/status/secondary/recoil) are two derivations of the same upstream. Decision made:
**neither wins — one derivation, two emitted shapes**, so disagreement becomes impossible. CHOMP
keeps its file format; ABRA keeps its tags; one script writes both.

- **First, the cheap measurement that could deflate this layer:** do the two rulebooks DISAGREE
  anywhere today, field by field over the moves both cover? If zero disagreements, this layer is
  insurance rather than a fix — build it anyway (it is small), but stop citing it as urgent. If
  nonzero, each disagreement is a live bug in whichever consumer reads the stale copy. ENGINE was
  asked for exactly this collision report.
- Gate: the merged generator reproduces BOTH current files byte-identically (modulo agreed fixes
  from the collision report) before it replaces either.

## Layer 2 — THE REGISTRY: a tag with no handler fails at LOAD

The exhaustiveness check the architecture always needed. Not a test that reports — a load that
refuses. A red report gets named a "known failure" and lived with (this repo did exactly that for
two days across ~40 commits); an engine that will not start cannot be lived with.

- **The trap, named by Will:** stub handlers written to make the build green. Mitigation is already
  built — a registered handler that never fires shows up in `asked()`/`hits()` as a live tag with
  zero reads, and `test-tag-consumed.js` ratchets it. A stub converts a loud failure into a counted
  one, not into silence.
- **Sequencing trap:** the registry cannot ship while 26 orphans exist, or day one is 26 failures
  and stub pressure. Layer 0 clears them first.
- Hardcoded names (intimidate, prankster) get rewritten to read the artifact as part of this layer
  — with the registry on, a name-only implementation is structurally impossible to mistake for
  coverage, because the tag still has no handler.
- Gate: registry on, engine loads, `test-tag-consumed.js` DEAD count is 0, and deleting any single
  handler makes the engine refuse to start (that is the known-bad-input demonstration).

## Layer 3 — MUTATION: prove each handler MATTERS

Registry proves a handler exists; only mutation proves it changes behaviour. WIRE 71 had handlers
on all four routes — three wrote the wrong constant.

- Method (spec in TAG-COVERAGE.md §2): `__setDB()` injection point in `engine/tags.js` (do NOT
  clear the require cache — it drops the counters), remove one tag, re-run a fixed seeded battery,
  digest the turn-by-turn state. State moves → tag matters. State identical → check whether the
  REFERENCE engine's arms differ (the interaction-matrix trick) before calling it read-and-ignored.
- Operators come free from the tag list; this is a targeted study, not blind mutation. Cost is
  O(tags × battery), fine at ~174 × seconds.
- Gate: the harness itself is validated by planting one known read-and-ignore (spreadAll's
  `hitsAlly` param is a real one today if still unfixed) and confirming it is caught.

## Layer 4 — what none of the above catches, and what already covers it

A tag derived WRONG from upstream is faithfully propagated by one generator, happily registered,
and behaviourally consistent under mutation. Only the differential against the official engine sees
it: `tests/test-engine-diff.js` (1/400), `tests/test-game-diff.js` (multi-turn), and the interaction
matrix's four-arm design. These stay, run in CI order after the layers land, and the two unexplained
Mummy/Wandering-Spirit divergences in the matrix are the standing example of why.

## What "done" means

1. 68 disagreements: 0 remaining (each fixed, or reclassified with the reference engine's evidence).
2. Two rulebooks: one generator, collision report published, both outputs reproduced.
3. Registry on; DEAD = 0; delete-a-handler refuses to load.
4. Mutation pass complete; every read-and-ignore either fixed or declared with its reason.
5. Matrix re-run at `--full`; agreement ≥ current 940/1,008 with the denominator not shrunk by
   reclassification games.
6. Exploitability re-run against a release cut AFTER all of the above, with the fixed step rule.
   That number — the one Will has been owed since the retraction — is the point of the entire job.

## Division etiquette (unchanged, learned expensively)

Writers may run beside writers. A measurement opens `engine_release` and reads the snapshot —
never the live tree. Cut a fresh release after the engine work lands and before any measurement.
No agent runs git. No agent deletes a file. A red test is fixed in the session that sees it red or
reported by name — never filed.
