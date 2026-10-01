# ABRA
### Automated Battle Replay Analyzer

> **New here? Read [docs/ORIENTATION.md](docs/ORIENTATION.md) first.** It is the entry point: what
> the project is, the plan, what each model does, and the failure mode this project keeps hitting.

**ABRA builds a player for Pokémon Champions VGC, Reg M-C, open team sheets, and takes it up the
Showdown ladder.** The engine is the foundation; the search is the point:

1. **MEDICHAM is correct.** It is ABRA's own doubles simulator, and it agrees with Showdown on every
   instrument that measures it. The Reg M-C gate is OPEN, 10 of 10
   ([report](docs/_reports/2026-09-24-regmc-gate-final.md)).
2. **So the solver searches on it, live, every turn.**
   - **CHOMP** solves team preview: both open sheets in, a mixed strategy over which four to bring and
     which two to lead out.
   - **XATU** holds the belief over what is hidden: the opponent's back two and their stat spreads.
   - **MAG and DODUO** narrow the candidates to the joint actions a strong human would consider.
   - **MILTANK** fills a payoff matrix by playouts on MEDICHAM, and **SLOWKING** solves it for an
     equilibrium mix.
   - **PORYGON2** is the value net that replaces long playouts.
   - **MEW and MACHAMP** train it by self-play.
   - **HYPNO** is a capped exploit dial against human habits (GARY).
   - **ROTOM** is the live client that plays it on the ladder.
3. **It climbs the ladder** on account `medicham32`, cleared with Showdown staff. It is judged by the
   settled rating ± SD over many series, never the peak.

The plan, the model registry and the milestones are [`solver/PLAN.md`](solver/PLAN.md). What has
landed is recorded once per change in [`CHANGELOG-REGMC.md`](CHANGELOG-REGMC.md). The measured numbers
are [`docs/MODELS.md`](docs/MODELS.md) and [the white paper](docs/ABRA-whitepaper.md).

```
both open sheets ─► CHOMP ─► bring 4, lead 2
each turn:  XATU (worlds) ─► MEDICHAM legalActions ─► DODUO (prune) ─► MILTANK (playouts)
            ─► SLOWKING (equilibrium) ─► HYPNO (exploit dial) ─► sample ─► ROTOM ─► ladder
```

## Every component

*(Folded in from `docs/SUMMARY.md` on 2026-10-01; its last edition is `git show a085dd9f:docs/SUMMARY.md`
and its Reg M-B edition `git show 1be7343c:docs/SUMMARY.md`. This table says what each part IS. What is
built is the registry in `solver/PLAN.md` §2, and what is true is what `node engine/status.js` prints.)*

| component | what it is |
|---|---|
| **MEDICHAM** | ABRA's doubles simulator, and its solver API `engine/medicham_api.js` (`clone`, `legalActions`, `step`, terminal check, lean playouts) |
| **CHOMP** | team-preview solver: both open sheets in, a mixed strategy over the bring/lead options out. Rebuilt inside ABRA; the old `../CHOMP` repository is reference only |
| **XATU** | belief over the opponent's back two and stat spreads |
| **MAG** | per-slot action scorer — the human policy prior |
| **DODUO** | joint coordinator — scores both slots as one joint action |
| **MILTANK** | search harness: candidates, playouts on MEDICHAM, the payoff matrix, the clock |
| **SLOWKING** | per-turn simultaneous-move solver (regret matching and an exact LP) |
| **PORYGON2** | value net: state → P(win) |
| **GARY / HYPNO** | human habits by situation / the capped exploit dial |
| **MEW / MACHAMP** | self-play factory / training loop |
| **WOBBUFFET / DUSK** | exploitability best-responder / endgame tables |
| **GURU** | meta analysis over the store, store-only |
| **DITTO** | team builder |
| **ROTOM** | the live ladder client; replaces `engine/mag_bot.js` |
| **ALAKAZAM / KADABRA** | the assembled agent / the coach |
| **The store and the ingest** | every Reg M-C game kept raw, collected hourly (OPS) |
| **The honesty machinery** | `status.js`, `provenance.js`, `quarantine.js`, the documentation gate |
| **ABRA WORLD** — the site | renders what the artifacts say |

**Store-only** means the model never runs the simulator, so it never waited on the gate. Everything
that plays games on MEDICHAM did wait, and anything it measured before the gate opened is withheld.

**Where each figure lives** — linked, not restated, so there is one copy to keep true:

- The Reg M-C gate and every reading behind it: [white paper §4.2](docs/ABRA-whitepaper.md#42-the-reading),
  and live, `node engine/quarantine.js --regulation regmc`.
- What each solver model measured: [`docs/MODELS.md`](docs/MODELS.md), *The Reg M-C models*.
- The milestones M0–M8 and how a version is judged: `solver/PLAN.md` §3 and §5;
  [white paper §2.12–§2.13](docs/ABRA-whitepaper.md#212-how-a-version-is-judged).
- Why 1.0.0 is a MAJOR: [white paper §5.1](docs/ABRA-whitepaper.md#51-why-this-is-a-major-revision) and the
  `CHANGELOG-REGMC.md` 1.0.0 entry.

**Reg M-B is retired.** Its record is closed at 7.0.0 in [`CHANGELOG.md`](CHANGELOG.md) and stays as
history. The Reg M-C line is [`CHANGELOG-REGMC.md`](CHANGELOG-REGMC.md) and
[`docs/REGMC.md`](docs/REGMC.md).

## Where the data comes from

ABRA collects real ladder games from the Showdown replay API and keeps every one raw, forever.
**Store raw, analyse on top:** a new question is a re-filter or a re-parse, never a re-pull. The Reg M-C
games are collected hourly by the next-regulation workflow. The human dataset the store-only models
learn from is built from them (`solver/human/`).

## What is state, and where it is printed

Nothing in this README is state. These print it:

```bash
node engine/status.js                               # every figure, with the artifact it came from
ABRA_REGULATION=regmc node engine/quarantine.js     # the Reg M-C gate, clause by clause
node engine/open_work.js                            # every open register row and measured defect
node engine/where.js <thing>                        # which file owns a fact
```

## Repo layout

```
engine/   MEDICHAM (medicham2-browser.js), its solver API (medicham_api.js), the gate, the instruments,
          the ingest. The retired Reg M-B models still sit here until each is archived (solver/PLAN.md §8)
solver/   the Reg M-C player: PLAN.md, LOG.md, one directory per model, tests/, out/ (gitignored)
data/     the stores, the frozen team pools, the gate artifacts (*-regmc.* for Reg M-C)
tests/    the engine and documentation gates
docs/     ORIENTATION, MODELS, the division ledgers, the white paper, deck and technical docs
```

## How the work is divided

Five divisions, cut on what a change invalidates: ENGINE (the simulator), MEASURE (whether a number
is true), SOLVER (everything under `solver/`), OPS (ingest and the store) and WEB (the site). See
[`docs/DIVISIONS.md`](docs/DIVISIONS.md).

## Honest limitations

- **Every arena figure measured so far is PRE-GATE** — played before the Reg M-C gate opened — and is
  withheld until it is re-run. No strength claim is made yet.
- **Open team sheets only.** Nothing here says how the player does when the sheet is hidden.
- **Illusion is the one declared exclusion** from the simulator's gate.
- **A zero on the gate is a statement about what was measured** — three lattices, a damage battery and
  a staged lab, on one release and one frozen pool. It is not a proof of equivalence.
- **The ladder can resolve only large differences.** Rating noise alone moves an account by tens of
  points, and a small improvement needs hundreds of series per arm to show (`solver/PLAN.md` §5,
  derived in `docs/_reports/2026-09-23-solver-research-humans-and-ladder.md`).
- **The ladder has not been played yet.** The live client is not built.
