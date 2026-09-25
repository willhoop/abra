# ABRA — Project Summary

**Version 1.0.0 · 2026-09-24 · Will Hooper**
**Line: abra/regmc** — `CHANGELOG-REGMC.md`.

**1.0.0 — MEDICHAM IS CERTIFIED ON REG M-C. THE ENGINE IS THE FOUNDATION; THE SEARCH IS THE POINT.
THE SOLVER NOW SEARCHES ON IT, AND THE FINISH LINE IS HIGH ON THE LADDER.**

ABRA builds a player for Pokémon Champions VGC, Reg M-C, open team sheets, and takes it up the Showdown
ladder (`gen9championsvgc2026regmcbo3`, account `medicham32`, cleared with Showdown staff). The plan
runs in three steps:

1. **MEDICHAM is correct.** ABRA's simulator agrees with Showdown on every instrument that measures it
   on Reg M-C, and the gate is OPEN (§2).
2. **So the solver searches on it, live, every turn.** At team preview **CHOMP** solves the bring and
   the lead. Each turn **XATU** holds the belief over hidden information, **MAG and DODUO** narrow the
   candidate joint actions, **MILTANK** fills a payoff matrix by playouts on MEDICHAM and **SLOWKING**
   solves it; **HYPNO** is a capped exploit dial against human habits. **PORYGON2** is the value net,
   **MEW and MACHAMP** train it by self-play, and **ROTOM** is the live client.
3. **It climbs the ladder**, judged by a settled rating ± SD over many series and the per-series
   residual, never the peak.

```
both open sheets ─► CHOMP ─► bring 4, lead 2
each turn:  XATU (worlds) ─► MEDICHAM legalActions ─► DODUO (prune) ─► MILTANK (playouts)
            ─► SLOWKING (equilibrium) ─► HYPNO (exploit dial) ─► sample ─► ROTOM ─► ladder
```

The plan, with the model registry and milestones, is `solver/PLAN.md`; what landed is `solver/LOG.md`.
**Reg M-B is retired** (Will, 2026-09-24). Its record is `CHANGELOG.md`, closed at 7.0.0, and the
Reg M-B edition of this document is `git show 1be7343c:docs/SUMMARY.md`. Nothing here is comparable
with a figure in it.

---

## 1. Every component, and the state it is in

| component | what it is | state on 2026-09-24 |
|---|---|---|
| **MEDICHAM** | ABRA's doubles simulator, and its solver API `engine/medicham_api.js` (`clone`, `legalActions`, `step`, terminal check, lean playouts) | **Reg M-C GATE OPEN**, all ten clauses (§2) |
| **CHOMP** | team-preview solver: both open sheets → a mixed strategy over the bring/lead options | to build (milestone M4). Rebuilt inside ABRA; the old `../CHOMP` repository is reference only |
| **XATU** | belief over the opponent's back two and stat spreads | **v1 built**, store-only (§3) |
| **MAG** | per-slot action scorer — the human policy prior | **v1 built**, store-only (§3) |
| **DODUO** | joint coordinator — scores both slots as one joint action | **v1 built**, store-only (§3) |
| **MILTANK** | search harness: candidates, playouts on MEDICHAM, the payoff matrix, the clock | **v1 built** with a worker pool and lean playouts. Strength figures PRE-GATE, **withheld** (§3) |
| **SLOWKING** | per-turn simultaneous-move solver (regret matching and an exact LP) | **v1 built**, unit-tested (§3) |
| **PORYGON2** | value net: state → P(win) | to build (M5) |
| **GARY / HYPNO** | human habits by situation / the capped exploit dial | to build (M7) |
| **MEW / MACHAMP** | self-play factory / training loop | to build (M5) |
| **WOBBUFFET / DUSK** | exploitability best-responder / endgame tables | to build (M6) |
| **GURU** | meta analysis over the store | **v0 built**, descriptive, store-only |
| **DITTO** | team builder | to build (M8) |
| **ROTOM** | the live ladder client; replaces `engine/mag_bot.js` | to build (M3) |
| **ALAKAZAM / KADABRA** | the assembled agent / the coach | to build |
| **The store and the ingest** | every Reg M-C game kept raw, collected hourly | LIVE (OPS) |
| **The honesty machinery** | `status.js`, `provenance.js`, `quarantine.js`, the documentation gate | LIVE |
| **ABRA WORLD** — the site | renders what the artifacts say | PAUSED |

**Store-only** means the model never runs the simulator, so it never waited on the gate. Everything
that plays games on MEDICHAM did wait, and anything it measured before the gate opened is withheld.

---

## 2. MEDICHAM on Reg M-C — what the gate read

All on engine release `eaa5becc54eb`, census pin `123aa264f88d`, pool `data/team-pool-frozen-regmc`,
authority the `pokemon-showdown-mc` checkout (CHANGELOG-REGMC 1.0.0;
`docs/_reports/2026-09-24-regmc-gate-final.md`). `--games` is part of the sample definition, so each
lattice is named by it.

| instrument | reading (1.0.0) | read from |
|---|---|---|
| whole game, board-material, `--games` 1200 / 1600 / 1900 | **0/955, 0/1266, 0/1497** games part a board | `data/game-differential-regmc.json`, `data/game-differential.g1600-regmc.json`, `data/game-differential.g1900-regmc.json` |
| whole game, undeclared narration | **0/955, 0/1266, 0/1497**; the narration bar is stamped at zero | the same three, and `data/whole-game-baseline-regmc.json` |
| the damage differential | **0/6000** at the midpoint, top, bottom and all 14 interior roll indices | `data/engine-diff-regmc.json` |
| deliberate roster | items **166/166**, abilities **210/214**, moves **510/511** | `data/roster.items-regmc.json`, `data/roster.abilities-regmc.json`, `data/roster.moves-regmc.json` |
| every in-scope mechanic staged | 0 diverge in **4,867** games, 0 threw | `data/all-mechanics-fire-regmc.json` |
| coverage | all **269** moves above **25** clicks measured (CHANGELOG-REGMC 1.0.0) | `node engine/quarantine.js --regulation regmc` |
| the gate | **OPEN**, 10 of 10 clauses (CHANGELOG-REGMC 1.0.0) | `node engine/quarantine.js --regulation regmc` |

The four ability rows not counted as tested at 1.0.0 are declared, not hidden: three pass as
announcement-only on recorded receipts, and one (Illusion) is deferred by the owner.

---

## 3. The solver — what is built and what it measured

**Store-only models, measured on held-out players.** These train on the Reg M-C human dataset (bo3,
open sheets) with no simulator in their path, so their figures stand.

- **MAG v1 and DODUO v1** (CHANGELOG-REGMC 0.113.0). On the held-out test players' 25,477 exact joint
  actions, DODUO's joint log-loss is 2.730 (95% CI 2.699–2.761) against the v0 prior's 2.921. The node
  forward pass matches Python to 2.1e-14; `solver/tests/test-mag-doduo.js` passes 3,826 of 3,826.
- **XATU v1** (CHANGELOG-REGMC 0.114.0). On 10,942 held-out sides, turn-1 log-loss on the true back pair
  is 1.348 against 1.792 for a uniform guess, and the true bring is never ruled out.

The recall figures behind those two lines are read from the tracked metrics file; the readout, with the
command, is in `docs/MODELS.md` under *MAG v1 and DODUO v1*.

**Models that play on MEDICHAM.** SLOWKING v1, MILTANK v1 and the offline arena are built and
unit-tested (CHANGELOG-REGMC 0.115.0): `test-slowking` 1,559/1,559, `test-miltank` 3,414/3,414,
`test-arena` 15/15. **Every arena strength figure so far is PRE-GATE — it was played before release
`eaa5becc54eb` — and is withheld, not captioned.** The re-run on that release is the first thing owed.
No direction may be read into the absence.

---

## 4. The road to the ladder

The milestones are `solver/PLAN.md` §3, in dependency order. Where they stand:

| milestone | what lands | state |
|---|---|---|
| **M0** | Reg M-C gate open; solver API merged | gate OPEN (1.0.0); API merged; the mid-turn-choice callback still owed |
| **M1** | DODUO split out of MAG, XATU's bring posterior, GARY v0, MAG intersected with `legalActions` | MAG, DODUO and XATU v1 built; GARY and the `legalActions` intersection owed |
| **M2** | SLOWKING + MILTANK, one-ply matrix, rollout leaf | built; the post-gate SPRT against greedy one-turn and against MAG with no search is owed |
| **M3** | the clock and ROTOM on a local Showdown server | to build |
| **M4** | CHOMP v0, ALAKAZAM v1, the first ladder burn-in | to build; **a ladder launch needs Will's OK** |
| **M5–M8** | PORYGON2 and self-play, per-world opponent tables, HYPNO + GARY on the ladder, CHOMP v1, DITTO | to build |

**How it will be judged** (`solver/PLAN.md` §5): offline SPRTs at equal wall-clock against each model's
named baseline, then the per-series ladder residual `S − E`, read by SPRT, with the arm drawn per series
by a seeded coin. The headline is the mean rating over the last N series ± SD. Never the peak.

---

## 5. The honest column

- **No strength claim is made.** The only strength figures that exist are PRE-GATE and withheld.
- **A zero on the gate is a statement about what was measured** — three lattices, a damage battery and
  a staged lab, on one release and one frozen pool. It is not a proof of equivalence.
- **Open team sheets only.** Closed sheets and bo1 are out of scope; nothing here says how the player
  does when the sheet is hidden.
- **Illusion is the one declared exclusion.**
- **XATU's spread narrowing is weak.** Two unknown spreads cannot be pinned from a replay; live play,
  where our own spread is known, should narrow more and has not been measured.
- **The ladder can resolve only large differences** — rating noise alone moves an account by tens of
  points, and a small improvement needs hundreds of series per arm to show (`solver/PLAN.md` §5,
  derived in `docs/_reports/2026-09-23-solver-research-humans-and-ladder.md`).
- **The 1.0.0 release is published** (2026-09-25, tag `abra-regmc-v1.0.0`).

---

## 6. Why this is a MAJOR

A MAJOR here means the BASIS moved — the question the numbers answer. Two things a reader can no
longer be told:

1. **That MEDICHAM is not correct on Reg M-C.** It is, on every instrument, so the withholding that
   rested on that sentence ends for the Reg M-C line at once: every Reg M-C artifact downstream of
   MEDICHAM becomes RE-RUNNABLE, not current, and nothing measured before `eaa5becc54eb` may be quoted
   until it is re-run.
2. **That ABRA is a meta-analysis platform whose preview tool lives in another repository.** The
   project is now a player: every model except MEDICHAM is rebuilt from scratch under `solver/` for
   open-sheet Reg M-C, and CHOMP is its preview solver. The Reg M-B models are retired, not repaired,
   and no figure of theirs links to one here.

---

## 7. Where the current state is read

State is printed, never typed. Nothing in this document outranks what these print today.

```bash
node engine/status.js                               # every figure, with the artifact it came from
node engine/quarantine.js --regulation regmc        # the Reg M-C gate, clause by clause
node engine/open_work.js                            # every unclosed register row and measured defect
node engine/docs_scan.js --owed                     # what the documents still owe the next major
```

`docs/RUNNING-NOTES.md` is the log between majors. The division ledgers —
`docs/{ENGINE,MEASURE,SOLVER,OPS,WEB}.md` — carry the working detail, `solver/LOG.md` the solver's
narrative, and `docs/_reports/` the dated accounts. None of them is state.
