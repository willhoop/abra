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
landed is [`solver/LOG.md`](solver/LOG.md). The measured numbers are
[`docs/MODELS.md`](docs/MODELS.md).

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
docs/     ORIENTATION, SUMMARY, MODELS, the division ledgers, the white paper, deck and technical docs
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
- **The ladder has not been played yet.** The live client is not built.
