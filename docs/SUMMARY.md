# ABRA — Project Summary

**Version 7.0.0 · 2026-09-20 · Will Hooper**

**7.0.0 — THE MEDICHAM QUARANTINE GATE IS OPEN. THE SIMULATOR AGREES WITH SHOWDOWN ON EVERY
INSTRUMENT THAT MEASURES IT, INCLUDING A HELD-OUT SAMPLE THE GATE DOES NOT READ. EVERY MODEL
DOWNSTREAM OF IT BECOMES RE-RUNNABLE, NONE HAS BEEN RE-RUN, AND SO NOT ONE OF THEIR FIGURES APPEARS
IN THIS DOCUMENT.**

ABRA is the Automated Battle Replay Analyzer. It ingests public Champions Reg M-B replays from
Pokémon Showdown, models the ladder metagame, and feeds the model CHOMP reads. Underneath that sit a
simulator (MEDICHAM), a board evaluation, a fitted action model (MAG) and a search player (MILTANK).
The dependency runs one way, which is why a wrong simulator was never an engine-only problem:

```
MEDICHAM  ->  board.js  ->  MAG weights  ->  MILTANK baselines  ->  live
(engine)      (features)    (the refit)      (every head-to-head)
```

Everything right of the first arrow has been withheld since 2026-08-08, because the box on the left
was known incorrect. That is what changed today, and it changed for the left-hand box only.

---

## 1. Every component, and the state it is in

| component | what it is | state today |
|---|---|---|
| **MEDICHAM** — the simulator | plays Champions Reg M-B locally so a position can be rolled out | **GATE OPEN.** All ten clauses of `node engine/quarantine.js` pass on release `0d7b1d9db6d1` |
| **The Showdown differential** | plays the same game on both engines and compares the board at every turn boundary | LIVE and clean — see §2. It measures MEDICHAM, so it was never quarantined |
| **The damage differential** | stages damage stage by stage against the authority | LIVE and clean at every interior index — see §2 |
| **The deliberate roster** | one staged scenario per legal item, ability and move | LIVE and clean on all three stages — see §2 |
| **The mechanics census and the staged harness** | probes a mechanic inside a real game and reads the verdict off Showdown | LIVE and clean — see §2 |
| **`board.js`** — the features | turns a position into the numbers every model scores | moves with the simulator; nothing in it is published as a figure |
| **MAG** — the fitted action model | scores one candidate action | **WITHHELD.** A re-run is owed, and a REFIT before it — see §3 and §4 |
| **The joint layer** | scores both of my slots together on one turn | **WITHHELD.** Same fit, same refit |
| **MILTANK** — the search player | chooses leads, brings, mega timing and post-KO | **WITHHELD.** Every baseline it holds was taken through a rollout |
| **GARY** — the opponent inside the search | models what the other side does while MILTANK searches | **WITHHELD.** Reads a rollout |
| **PORYGON2 / DODUO / SLOWKING** | position value, one-turn joint policy, the bring | **WITHHELD.** Each reads a rollout |
| **Leaf calibration** — MEASURE's one number | does the leaf's stated win probability match the frequency actually observed | **NOT MEASURED on this engine.** No replication verdict, no bucket share, no calibration gap, no sample size — and no direction may be read into the absence |
| **The store and the ingest** | every replay kept raw, forever, with rating and bot tags | LIVE, six-hourly — see §2 |
| **META-USAGE** — the model CHOMP reads | usage, threats and bring priors off the store | LIVE — see §2 |
| **The next-regulation collector** | pulls Reg M-C games hourly so the corpus exists before the work does | COLLECTING ONLY. Nothing about M-C is simulated, and nothing here is a claim about it |
| **ABRA WORLD** — the site | renders what the artifacts say, and never authors a number | PAUSED. Its bundles were built 2026-08-25 and do not describe today's gate; `node engine/status.js` calls the drift by name |
| **The honesty machinery** | `status.js`, `provenance.js`, `quarantine.js`, the docs gate | LIVE, and two of its own ratchets are red — see §4 |

**Nothing in the WITHHELD rows is a judgement about quality.** It is the rule this project has run
since 2026-08-08: a figure taken through a simulator that has been repaired since is not a bad
figure, it is an unrepeated one. The gate opening makes those artifacts **re-runnable, not true.**

---

## 2. What is measured, and what it reads

All of it on engine release `0d7b1d9db6d1`, with the census pinned and the team pool pinned to
`data/team-pool-frozen`. The flags are part of the sample definition, so they are named in the row.

| instrument | reading | read from |
|---|---|---|
| held-out wide sample, `--games 12000` | **7,182 games, 0 board-material** | recorded in CHANGELOG `6.83.0`; readout below |
| gate lattice A, `--games 1200` | **961 games, 0 board-material, 0 undeclared narration**; all 10,716 compared turn boundaries identical, `turns_cap` 50, pool digest `0d103fb9fa87` off 8,778 teams with 1,968 picked | `data/game-differential.json` |
| gate lattice B, `--games 1350` | **1,069 games, 0 board-material, 0 undeclared narration** | `data/game-differential.g1350.json` |
| gate lattice C, `--games 1950` | **1,497 games, 0 board-material, 0 undeclared narration** | `data/game-differential.g1950.json` |
| the damage differential | **6,000 compared, 0 disagreed** at the midpoint and at every interior index, seed 20260804 | `data/engine-diff.json` |
| deliberate roster, items | **148 of 148 in scope tested**, 0 differ, 0 did-not-fire | `data/roster.items.json` |
| deliberate roster, abilities | **196 of 200 in scope tested**, 0 differ, 0 did-not-fire | `data/roster.abilities.json` |
| deliberate roster, moves | **496 of 497 in scope tested**, 0 differ, 0 did-not-fire | `data/roster.moves.json` |
| the mechanics census | **1,004 probed / 1,004 live / 0 missing** | `data/mechanics-census.json` |
| the staged harness | **4,632 games played, 0 threw**; 497 moves, 200 abilities and 148 items in scope, 0 diverging | `data/all-mechanics-fire.json` |
| the store | **94,360 games recorded, 28,454 usable** — the ratio is arithmetic over those two, not a stored figure | `data/quality-filter.json:provenance.funnel.collected` / `:provenance.funnel.after_custom_ruleset` |
| META-USAGE | **94,360 collected**, a funnel ending at **28,454** clean games | `data/quality-filter.json` |
| the Reg M-C corpus | collected, not simulated — the counts are a live derivation over untracked store files and are quoted in `docs/REGMC.md`, not claimed here | — |

The held-out sample is drawn by a stride the gate does not use, so it is a different lattice rather
than a larger one. Its artifact is not a top-level `data/*.json` file, so its readout is quoted here
rather than cited:

```
$ node -e "const j=require('./data/verification/game-differential.g12000.json');const s=j.state;console.log(j.engine_release,s.games,s.games_board_never_diverged,s.protocol_diverged_games,s.protocol_diverged_board_never_did)"
0d7b1d9db6d1   games 7182   board_never_diverged 7182   protocol_diverged 75   protocol_diverged_board_never_did 75
```

**Read the second half of that line as carefully as the first.** Board-material is zero on the wide
sample. Protocol divergence is not: each of those games parts a line of commentary somewhere and no
board anywhere. The narration gate is measured on the three lattices, where it reads zero undeclared;
on the wide sample narration is reported, and it is not zero.

---

## 3. What is withheld, and what would end it

The list is derived, never typed — `node engine/quarantine.js` walks the require graph and names
every artifact downstream of the simulator, and `node engine/status.js` prints what re-runs each one.

| withheld | what re-runs it |
|---|---|
| leaf calibration | `node engine/backtest_winrate.js` |
| R1 leaf accuracy | `node engine/rollout_r1_artifact.js` |
| R2 leaf cost | `node engine/rollout_r2.js` |
| R3 divergence | `node engine/rollout_r3.js` |
| R4 head-to-head | `node engine/rollout_r4.js` |
| engine correctness → leaf | `node engine/leaf_engine_contrast.js` |
| click censoring | `node engine/click_census.js` |
| the MAG and joint weights | a REFIT and not a restamp: `node engine/fit_policy.js`, then `node engine/fit_joint.js` |
| every model report that reads a rollout — MAG, MILTANK, GARY, PORYGON2, DODUO, SLOWKING | each has its own generator; `node engine/status.js` names it beside the withheld figure |

**The re-run is owed and none of it is done.** Will's instruction of 2026-09-09 stands: leave them
until MAG and MILTANK are reworked. So this document quotes no model figure at all — not a
head-to-head, not an exploitability share, not a leaf accuracy, not a calibration gap.

---

## 4. The honest column

**The zero is a statement about what was measured.** Four lattices and a staged lab, on one release,
over a frozen pool of real ladder games. It is not a proof of equivalence, and a lattice that
contains no divergence is not the same claim as an engine that cannot produce one — that lesson was
bought on 2026-09-12, when one sample read zero and two wider ones did not.

**Illusion is the one declared exclusion.** The differential drops teams carrying a legal Illusion
body rather than modelling the disguise, and the gate excuses those rows by name. Derived from the
format and from the frozen pool rather than recalled:

```
legal carriers, from Dex.forFormat('gen9championsvgc2026regmb'): zoroark, zoroarkhisui
data/team-pool-frozen/games.bo3.jsonl    13,214 games    26,428 sides (one side = one player's team in one game)
sheets carrying a legal Illusion body    452 of 26,428 = 1.71%    of those 452, brought one: 229
```

An earlier statement of this exclusion divided a SHEET count by a GAME count, which inflated the rate
about twofold. The readout above is the re-derivation, and the inflated pair appears nowhere in this
document — deleted rather than footnoted.

**A clean roster stage is not a fully tested one, and the gaps are declared.** Three ability rows
pass as ANNOUNCEMENT-ONLY on a recorded receipt — a restore knob and a probe each — and one is
deferred by the owner (`data/roster.abilities.json`); the moves stage carries one deferred row as
well (`data/roster.moves.json`). The staged harness shelves its diverging rows by the owner's
decision, and every one of them is staged on a legal Illusion carrier —
`data/all-mechanics-fire.json` `summary.moves.shelved_by_owner_diverging` 2 and
`summary.abilities.shelved_by_owner_diverging` 1. A shelved row is still staged and still played; it
does not vote.

**Closed team sheets and bo1 are out of scope this release.** Every figure in §2 describes open-sheet
play. Nothing here says how the engine, or anything fitted on it, behaves when the sheet is hidden.

**Seven live `lastMove` readings are an unregistered class.** The authority keeps the CALLING move
where this engine keeps the called one. Reported, not fixed, and carrying no roadmap row.

**Two of the ten gate clauses cannot be computed without a local Showdown checkout.** On a machine
with no `SHOWDOWN_PATH` the board-leaf clause and the mechanics clause read CANNOT-ANSWER — which
fails, and never reads as a pass. The OPEN verdict above is a reading taken where the authority was
present.

**The release these figures name is not in the repository.** `data/releases/` is ignored by git and
`0d7b1d9db6d1` was not force-added, so `node engine/provenance.js` marks every artifact citing it
`PUBLISHED FIGURE ON AN UNTRACKED RELEASE`. The manifest digests still say what was frozen; from a
fresh clone the evidence chain ends at that string rather than at bytes somebody can re-open.

**MAG's fitted vector is red on its own check, and it is the first thing owed.**
`engine/feature_fixture.js` fires two gates against the shipped weights: the fixture itself changed,
and **the damage table those weights were fitted against has been regenerated**, so the table digest
stamped beside the fit is not the digest of the table on disk. A restamp answers the fixture gate and
silences the table gate in the same stroke, which is why the order matters — settle the table
verdict, then refit. `node engine/status.js` prints it as REFIT OWED on every run.

**Two of this project's own ratchets are red.** `node engine/provenance.js` exits non-zero: six
`_diag*` artifacts ship without recording what content they read. And the bundles under `web/`
publish a gate state the live gate no longer has.

**The interaction matrix has not been re-run on this engine.** Its last run predates the release
above by weeks, so no agreement figure from it appears here.

---

## 5. Why this is a MAJOR, and how the old numbers link to the new

A MAJOR here means the BASIS moved — the question the numbers answer, rather than their values.
Three things a reader can no longer be told.

1. **That MEDICHAM is not correct.** That sentence has stood under every model figure in this project
   since 3.79.0, and it is why they were withheld. It is now false, and the withholding that rested
   on it ends at once.
2. **That a whole-game figure from this project describes an engine whose defects are unknown.** The
   instruments in §2 bound the engine's disagreement with the authority at zero on every board they
   compare; what is left is narration, and it is reported as narration.
3. **That the withheld models are merely out of date.** They are not comparable to anything measured
   today: they were taken through a simulator repaired many times since, so old and new cannot be
   linked by arithmetic. They have to be re-run, which is why no number from them is restated here.

**The back-cast, so the two series can be linked.** The held-out board partings across 2026-09-20 ran
**34 → 15 → 9 → 1 → 0**, recorded in CHANGELOG `6.83.0`, each step on its own engine release with the
pool and the census pinned. That sequence is the bridge between the last published series and this
one.

**Every whole-game count this document carried at 6.0.0 and earlier is DELETED, not captioned.** Those
readings belong to other engine bytes, other turn caps and other sample definitions; a caption beside
them is the failure this project has already paid for twice. What replaces them is §2 — one release,
one pool, and the flags written beside every row.

---

## 6. Where the current state is read

State is printed, never typed. Nothing in this document outranks what these print today.

```bash
node engine/status.js             # every figure, with the artifact it came from; NOT DERIVED where none says it
node engine/quarantine.js         # the gate, clause by clause, and every artifact downstream of the simulator
node engine/open_work.js          # every unclosed register row, and every defect a live instrument measures
node engine/docs_scan.js --owed   # what the documents still owe the next major
```

`docs/RUNNING-NOTES.md` is the log between majors, and this document is the fold-in of those rows at
7.0.0. The division ledgers — `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md` — carry the working detail,
and `docs/_reports/` carries the dated accounts. None of the three is state.
