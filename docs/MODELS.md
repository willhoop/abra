# ABRA — the model family (living reference)

**Version 1.0.0 · Last updated 2026-09-24.**
**Line: abra/regmc** — `CHANGELOG-REGMC.md`.

**1.0.0 — THE REG M-C LEDGER. MEDICHAM IS CERTIFIED ON REG M-C, AND EVERY OTHER MODEL IS REBUILT FROM
SCRATCH UNDER `solver/`.** Reg M-B is retired (Will, 2026-09-24). The Reg M-B edition of this ledger,
with every entry it held, is archived at
[`docs/archive/MODELS-regmb-7.0.0.md`](archive/MODELS-regmb-7.0.0.md). It is history: no figure in it
links to one here, because the models, the regulation and the question all changed.

**The engine is the foundation; the search is the point.** MEDICHAM is correct, so the solver searches
on it: CHOMP at preview; each turn XATU's belief, MAG and DODUO's candidates, MILTANK's playouts and
SLOWKING's equilibrium, with HYPNO's capped exploit dial; PORYGON2 as the value net; MEW and MACHAMP for
self-play; ROTOM on the ladder. Each model keeps its old name in the role `solver/PLAN.md` §2 gives it,
and each has a test fixed before its run and a named baseline it must beat.

**Three rules govern every figure below.**

- **Store-only models stand.** A model that trains on the human dataset and never runs the simulator
  was never downstream of MEDICHAM, so its held-out figures are quoted.
- **PRE-GATE figures are withheld, not captioned.** A figure played on MEDICHAM before release
  `eaa5becc54eb` — the release the Reg M-C gate opened on — describes an engine the gate did not
  certify. It is re-run, not quoted. No direction may be read into its absence.
- **Every figure cites its source**: a `data/` artifact, the CHANGELOG-REGMC entry that recorded it, or
  a readout from a tracked metrics file with the command above the digits.

---

## The registry at a glance

The full registry — input and output, dependencies, the proving test and the baseline — is
`solver/PLAN.md` §2. State on 2026-09-24:

| model | role | built | figures |
|---|---|---|---|
| **MEDICHAM** | the simulator and its solver API | yes | the Reg M-C gate, below |
| **MAG** | per-slot action scorer: the human policy prior | v1 | held-out, store-only, below |
| **DODUO** | joint coordinator over MAG | v1 | held-out, store-only, below |
| **XATU** | belief over the back two and stat spreads | v1 | held-out, store-only, below |
| **SLOWKING** | per-turn simultaneous-move solver | v1 | unit tests only |
| **MILTANK** | the search harness | v1 | strength PRE-GATE, withheld |
| **GURU** | meta analysis | v0 (descriptive) | report only |
| **CHOMP** | team-preview solver | no (M4) | — |
| **PORYGON2** | value net | no (M5) | — |
| **GARY** | human habits by situation | no (M1/M7) | — |
| **HYPNO** | capped exploit dial | no (M7) | — |
| **MEW / MACHAMP** | self-play factory / training loop | no (M5) | — |
| **WOBBUFFET** | exploitability best-responder | no (M6) | — |
| **DUSK** | endgame tables | no (M6) | — |
| **DITTO** | team builder | no (M8) | — |
| **JOLTEON** | CHOMP's optional pre-screen, only if PORYGON2 is too slow | optional | — |
| **ROTOM** | the live client | no (M3) | — |
| **ALAKAZAM** | the assembled agent | no | — |
| **KADABRA** | the coach | no (M8) | — |

---

## MEDICHAM — the simulator (Reg M-C)

**Role.** Plays Champions Reg M-C locally so a position can be searched. Exposes the solver API in
`engine/medicham_api.js`: `clone`, `legalActions`, `step` (non-mutating), a terminal check that does
not treat the turn cap as game over, and lean playouts that write the same boards with no protocol.

**Gate: OPEN, 10 of 10** (CHANGELOG-REGMC 1.0.0; `docs/_reports/2026-09-24-regmc-gate-final.md`), on
release `eaa5becc54eb`, census pin `123aa264f88d`, pool `data/team-pool-frozen-regmc`:

| instrument (1.0.0) | reading | artifact |
|---|---|---|
| whole game, board-material, `--games` 1200 / 1600 / 1900 | 0/955, 0/1266, 0/1497 | `data/game-differential-regmc.json`, `data/game-differential.g1600-regmc.json`, `data/game-differential.g1900-regmc.json` |
| whole game, undeclared narration | 0/955, 0/1266, 0/1497; baseline stamped at zero | `data/whole-game-baseline-regmc.json` |
| damage differential | 0/6000 at every roll index | `data/engine-diff-regmc.json` |
| roster: items / abilities / moves | 166/166, 210/214, 510/511 | `data/roster.items-regmc.json`, `data/roster.abilities-regmc.json`, `data/roster.moves-regmc.json` |
| mechanics staged | 0 diverge in 4,867 games | `data/all-mechanics-fire-regmc.json` |

**Lean playouts are board-identical to full ones** (CHANGELOG-REGMC 0.116.1): every game of the
`--games 1200` lattice, 22,283 turns, every board and every per-stream draw equal, and red on a
deliberate break (`solver/tests/test-lean-mode.js`).

**Owed.** The mid-turn-choice callback (a faint replacement or a pivot's switch-in asked of the
solver rather than pre-decided), step 6 of `docs/_reports/2026-09-23-engine-interface-brief.md`.
Illusion stays the one declared exclusion.

---

## The human dataset — what the store-only models learn from

**Role.** Infrastructure, not a model. `solver/human/` turns the Reg M-C bo3 open-sheet games into one
clean decision record per side per turn: both sheets, the public state, and the joint action taken,
with every exclusion counted by reason (`docs/_reports/2026-09-23-human-dataset.md`). The file itself
lives in `solver/out/human/`, which git ignores; every model below stamps its sha256.

```
$ node -e "const m=require('./solver/mag/model/mag-doduo-v1.metrics.json');console.log(m.dataset.games_read,m.split.players,m.test.decisions,m.test.joint_status.exact)"
26888 { train: 4892, val: 603, test: 620 } 37816 25477
```

Games read; the split **by acting player**, so no test player was ever seen in training; test
decisions; and the test decisions whose exact joint action is visible, which is what the joint figures
below are scored on.

---

## MAG v1 and DODUO v1 — narrowing the candidates

**Role.** MAG scores each slot's options — the human policy prior. DODUO scores the two slots as one
joint action, which is what makes focus fire, redirect-then-attack and double switches visible. The
search uses them to prune the joint actions it will actually play out, with switch and mega slots
reserved. Code `solver/mag/`; models `solver/mag/model/mag-v1.json` and `doduo-v1.json`, tracked.
Successors to the prior v0 (`solver/prior/`), which is kept as the baseline.

**Measured, held-out players, store-only** (CHANGELOG-REGMC 0.113.0). On 25,477 exact joint actions,
DODUO's joint log-loss is 2.730 (95% CI 2.699–2.761) against v0's 2.921. The node forward pass matches
Python to 2.1e-14, and `solver/tests/test-mag-doduo.js` passes 3,826 of 3,826, shown red on deliberate
breaks first.

Joint recall — the share of turns on which the human's exact joint action is in the model's top k —
read from the tracked metrics file:

```
$ node -e "const m=require('./solver/mag/model/mag-doduo-v1.metrics.json');for(const s of ['all','switch','turn1'])for(const k of ['doduo_v1','mag_v1','prior_v0']){const r=m.by_subset[s][k];console.log(s,k,'r4',(100*r.joint_r4.est).toFixed(1),'r8',(100*r.joint_r8.est).toFixed(1),'r16',(100*r.joint_r16.est).toFixed(1),'ll',r.joint_ll.est.toFixed(3))}"
all doduo_v1 r4 55.4 r8 72.5 r16 87.2 ll 2.730
all mag_v1 r4 52.1 r8 69.6 r16 85.7 ll 2.823
all prior_v0 r4 50.3 r8 66.5 r16 83.1 ll 2.921
switch doduo_v1 r4 41.5 r8 60.2 r16 80.6 ll 3.215
switch mag_v1 r4 38.4 r8 57.4 r16 78.2 ll 3.274
switch prior_v0 r4 33.4 r8 52.0 r16 74.8 ll 3.441
turn1 doduo_v1 r4 48.3 r8 65.5 r16 81.6 ll 3.050
turn1 mag_v1 r4 45.6 r8 61.9 r16 79.6 ll 3.158
turn1 prior_v0 r4 43.3 r8 58.8 r16 76.0 ll 3.277
```

**The baseline it had to beat.** The v0 prior already beat the frequency baselines it was registered
against; the readout, from its own tracked metrics file:

```
$ node -e "const m=require('./solver/prior/model/prior-v0.metrics.json').summary;for(const k of Object.keys(m))console.log(k,'r16',(100*m[k].joint_r16.est).toFixed(1),'ll',m[k].joint_ll.est.toFixed(3))"
model r16 83.1 ll 2.921
uniform r16 31.5 ll 4.401
species_freq r16 44.3 ll 4.347
species_freq_plus r16 49.2 ll 4.037
```

**Weak spots.** Switch turns and turn 1 are still the weakest subsets, which is why MILTANK reserves
switch slots rather than trusting the prune there. **Owed:** intersecting MAG's candidates with
MEDICHAM's `legalActions` (milestone M1); adding MEDICHAM relational facts as features, now that the
gate is open.

---

## XATU v1 — the belief over hidden information

**Role.** Under open team sheets the six are known; what is hidden is which two stayed in the back and
each Pokémon's stat spread. XATU keeps a posterior over both, updated from reveals, turn order and
damage, and hands the search a small set of worlds to play out. Code `solver/xatu/`; model
`solver/xatu/model/bring-v1.json`, tracked. Every stat, speed and damage number comes from the Reg M-C
Showdown checkout; nothing is typed.

**Measured, held-out series, store-only** (CHANGELOG-REGMC 0.114.0). On 10,942 held-out sides, turn-1
log-loss on the true back pair is 1.348 against 1.792 for a uniform guess, and the true bring is never
ruled out at any turn. Tests on main: `test-xatu-api` 6,335, `test-xatu-bring` 33, `test-xatu-sd` 584,
all passed.

**Weak spot, stated.** The spread posterior is sound — the true spread was never excluded — but it
narrows little, because a replay hides both players' spreads. Live play, where our own spread is known,
should narrow more and has not been measured. **Owed:** a soft spread posterior and a store-derived
spread prior (the store holds no spreads). Account: `docs/_reports/2026-09-24-xatu-v1.md`.

---

## SLOWKING v1 — the matrix solver

**Role.** Given the payoff matrix MILTANK fills, returns an equilibrium mix for both sides and the
game's value: regret matching (RM+) with an exact LP beside it. At preview it will solve CHOMP's
bring/lead matrix the same way. Code `solver/slowking/`.

**Measured: correctness only** (CHANGELOG-REGMC 0.115.0). `solver/tests/test-slowking.js` passes 1,559
of 1,559 and was shown red on deliberate breaks: rock-paper-scissors solves to uniform, known small
games match the LP, and RM+ stays inside its proven convergence bound. SLOWKING needs no gate for this:
the tests construct their own matrices. Its strength inside the search is MILTANK's figure, which is
withheld.

*(The Reg M-B SLOWKING's team-preview Nash table, over a matchup matrix built from real Reg M-B ladder
results, is in the archived edition and answers a question about Reg M-B.)*

---

## MILTANK v1 — the search harness

**Role.** For each decision: prior-ranked candidate joints with switch and mega slots reserved, a
world sample for the opponent's unrevealed back line, playouts on MEDICHAM with common random numbers
spread over the cells, and SLOWKING on the result, all inside the clock. Successive halving over the
cells is planned (`solver/PLAN.md` §2) and not in v1. A playout steps
the joint action, then a few random legal turns, and ends in a named HP heuristic that PORYGON2 is to
replace. In v1 the world is drawn uniformly; wiring XATU's posterior in is the next step. Code `solver/miltank/`; the offline arena
`solver/arena/`; benches `solver/bench/`.

**Built and tested** (CHANGELOG-REGMC 0.115.0, 0.116.0): `test-miltank` 3,414 of 3,414,
`test-playout-speed` 1,184 of 1,184, `test-arena` 15 of 15. The worker-process pool is bit-identical
to serial play at a pass cap, and playouts run in MEDICHAM's lean mode.

**Strength: WITHHELD, PRE-GATE.** Every arena result so far — MILTANK against the prior played
greedily, at several time budgets — was played before release `eaa5becc54eb`. It describes an engine
the gate did not certify, so it is not quoted here, with or without a caption. **Owed first:** the
arena re-run on `eaa5becc54eb`, pinned and SPRT-read, against greedy one-turn and against MAG with no
search (milestone M2). Accounts of the earlier runs, which are history:
`docs/_reports/2026-09-24-slowking-miltank-arena.md`, `docs/_reports/2026-09-24-playout-speed.md`.

---

## GURU v0 — the meta, described

**Role.** Descriptive meta analysis of the Reg M-C open-sheet store: usage, sets, archetypes, bring and
lead patterns, and how players adapt across a best-of-three. Store only. Code `solver/meta/`; outputs
`solver/out/meta/` (gitignored). Tests `solver/tests/test-meta-lib.js` and
`solver/tests/test-meta-artifacts.js`.

**What it may claim.** Its archetype clustering did not meet its pre-set stability bar, so archetypes
are rough labels, not findings; games cluster by player, so its intervals are player-clustered. It feeds
the set library DITTO and ROTOM's team rotation will draw from. Its figures are in
`docs/_reports/2026-09-23-regmc-meta.md` and are not restated here: they are a description of a moving
store, and a typed copy would go stale with the next ingest.

---

## CHOMP — the team-preview solver (to build, M4)

**Role.** Both open sheets in; a mixed strategy over the bring-four, lead-two options out. The preview
is a matrix game between the two sides' options: PORYGON2 (or, at v0, the rollout leaf) scores each
cell, SLOWKING solves it, and the bring and lead are sampled from the mix, never taken as an argmax.
JOLTEON is an optional pre-screen, built only if scoring every cell is too slow. Rebuilt inside ABRA
under `solver/chomp/` (Will, 2026-09-24): the old `../CHOMP` repository runs on stale mainline data and
its bring choices tested at coin level, so it is reference only.

**Must beat** uniform, the human-modal bring, and a greedy argmax; judged by preview exploitability and
by a head-to-head with the same in-battle agent on both sides. **May later ship** as a standalone
advisor — sheets in, a recommendation out — which clicks nothing for the player.

---

## ROTOM — the live client (to build, M3)

**Role.** Plays the assembled agent on the `gen9championsvgc2026regmcbo3` ladder as `medicham32`,
replacing `engine/mag_bot.js`, which only accepts challenges. It ladders one series at a time, budgets
every decision against the Showdown clock read from the server, warms the search workers during
preview, carries game-1 observations into games 2 and 3, rejoins every open room after a disconnect,
and, if the search fails, plays MAG's top legal action **and counts it**. A lock refuses to search
while one of Will's own accounts could be laddering. Requirements: `solver/PLAN.md` §4.

**Must prove before the ladder:** a timer-on local series with zero timeouts, zero bank forfeits and
zero series lost to a disconnect. **The first ladder series is Will's call.**

---

## The rest of the stack (to build)

Each is specified in `solver/PLAN.md` §2 with its test and baseline, and gets an entry here when it
first measures something.

- **PORYGON2** (M5) — value net: state → P(win), trained on MEW self-play; must beat a count-HP
  logistic and then the rollout leaf in the same search (`solver/PLAN.md` Appendix B).
- **GARY** (M1, M7) — human habit per situation bucket; per bucket it must beat the equilibrium's own
  prediction on held-out log-loss, or it gets no weight.
- **HYPNO** (M7) — the capped exploit dial: an ε-safe response to GARY, whose worst case stays within ε
  of the equilibrium value on every logged decision.
- **MEW / MACHAMP** (M5) — the self-play factory on a frozen release, every record stamped with the
  release id and the weights digest; the training loop, where generation n+1 must beat n by SPRT.
- **WOBBUFFET** (M6) — the exploiter; its win rate must not rise generation over generation.
- **DUSK** (M6) — exact endgame values, checked against deep search on constructed endgames.
- **DITTO** (M8) — the team builder; ranks must agree under two agent strengths.
- **ALAKAZAM** — the assembled agent; **KADABRA** (M8) — the coach, every sentence traced to a logged
  decision.

---

## Where the current state is read

```bash
node engine/status.js
node engine/quarantine.js --regulation regmc
node engine/open_work.js
```

`solver/LOG.md` records each landing; `docs/_reports/` holds the dated accounts. Neither is state.
