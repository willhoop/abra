# ABRA — Project Summary

**ROADMAP #81 WIRE 12 — FIVE ENGINE DEFECTS OFF THE TURN-1 BOARD, TWO OF THEM MIS-DIAGNOSED BEFORE
THEY WERE FIXED (3.71.0).** The auras (Fairy, Dark, Aura Break) are wired FIELD-WIDE at the base-power
stage — they multiply one type for every body on the field, the foe's moves included, and Aura Break
INVERTS to x0.75 rather than cancelling; exact against the official engine on 12 of 12 staged arms.
Baton Pass and Shed Tail switch for the first time (`passesState` had been derived and never
consumed, so Baton Pass was a no-op turn and Shed Tail paid half its user's HP to stand still). Curse
is two moves and the engine had neither. Perish Song counted from 3 instead of 4 and therefore fainted
every affected body on both sides a full turn early, on 1,141 corpus uses — the KO itself had always
fired. And ROADMAP #81 WIRE 10's measured board regression is one line: the Life Orb toll was being
paid by a move that MISSED. **Two of the five briefed diagnoses were wrong** — the tagger was not
testing `selfSwitch === true`, and the substitute doll was not confounded, it was a regression this
project introduced at WIRE 7 on a misquoted source line. Census 281/282 → 293/294 live.

**Version 3.71.0 · 2026-08-07 · Will Hooper**

**THE INSTRUMENT WAS MEASURING ANNOUNCEMENTS, AND THE HEADLINE IS NOW THE BOARD AT THE END OF
TURN 1 (3.70.0).** `engine/board_state.js` reads HP, status with its counters, items, all seven stat
stages, aliveness, every field condition WITH ITS CLOCK and the persistent volatiles out of BOTH
engines' live bodies at every turn boundary, after the whole residual phase. Read every figure from
`data/state-ladder.json`. **The board at the end of turn 1 is identical in 56.0% of games at the
pre-WIRE-1 baseline (1119/1998) and 66.9% at the top rung (1337/1998)**, peaking at 69.3% at WIRE 9;
whole-game board agreement went 6.4% -> 15.6% against a protocol number that read 1.8% -> 10.3%, so
the wires were real and the protocol number overstated them. **WIRE 10 is a regression the protocol
instrument scored as an improvement** — 47 fewer clean turn-1 boards, and diffed per field it is one
field, end-of-turn-1 HP wrong in 427 -> 473 games. **41.0% of games whose narration parted inside
turn 1 reached an identical board anyway.** The comparator proves itself first: 7 representation
mappings red-demonstrated in both directions and 25 planted state divergences, each of which must be
caught at the planted boundary and localised to the planted field — 25/25 on all fourteen arms.

**THE FORK IS DECIDED — A MORE CORRECT ENGINE DID NOT MAKE BETTER PREDICTIONS (3.69.0).**
`engine/leaf_engine_contrast.js` → `data/leaf-engine-contrast.json`. MILTANK's live in-game leaf scored
on **8,883 identical positions with identical seeds** through two frozen releases differing in exactly
`engine/medicham2-browser.js`.

| question | answer | n |
|---|---|---|
| paired Brier, WIRE 10 − pre-WIRE-1 | **0.0000 [−0.0007, +0.0007]** — floor 0.000642, MDE 0.001013 | 8,883 |
| McNemar, doubly-decisive calls | 37 vs 36, p = 0.91 | 7,994 |
| does **line** depth predict leaf error | **rho +0.0010 [−0.019, 0.022]** (MDE 0.0298) | 8,855 |
| does **turn** depth predict leaf error | **rho −0.0000 [−0.021, 0.023]** | 8,855 |
| Δdepth vs Δerror | **rho −0.0115 [−0.031, +0.008]** | 8,601 |
| is the depth ruler any good | **rho 0.836 [0.825, 0.846]** (reversed-order control) | 8,855 |
| both leaves vs a coin | **+0.0325 [0.0281, 0.0372]** Brier — worse | 8,883 |
| calibration | **ECE 0.1514**; says 94%, wins 59% | 8,883 |

**The interval is narrower than the smallest detectable effect, so this is a tight null and not an
underpowered one.** The engine fidelity gain is real and replicates here (never-parting games 13 → 246,
median divergence line 12 → 16, median completed turns 1 → 1) — it just does not reach the leaf.
**Engine correctness is not what limits the leaf; calibration is.**

**THE RELEASE LADDER — SEVEN FIXES DID NOT MOVE THE MEDIAN TURN (3.68.0, re-run 2026-08-07).**
`engine/wire_ladder.js` plays every frozen release of the wire series through the differential. It uses
one pinned census and one team pool, so all eleven arms compare with each other and not only with their
neighbour. **Read every figure from `data/wire-ladder.json`** — the figures below moved when ROADMAP
#81 WIRE 7 was added and the whole ladder was replayed, so any earlier quotation of them is retracted.
On 1,995 games for each arm, the median game stops after **one completed turn at every rung**. That
number does not change. 64 games of 1,995 agree completely, against 6 games at the baseline. The depth
of the first disagreement does change: the mean goes from 14.8 to 27.8 protocol lines, the 90th
percentile from 30 to 89, and the MEDIAN first-divergence line from 13 to 16 — the first rung in the
series to move it. The baseline arm ran first and last, with nine arms between them, and gave the same
result. Therefore the table shows the engine change and not the run.

**THE DIFFERENTIAL HAS RUN, AND MEGAS ARE IN IT (3.62.2).** `engine/game_differential.js` plays a real
stored team through MEDICHAM and through the official Showdown engine, step for step, against a stamped
frozen release. **Read every figure from `data/game-differential.json`, never from this sentence** — the
first version of this paragraph quoted a run that a later one replaced within the day, which is the
drift this whole document set keeps having to correct.

At the time of writing it reports every measured game diverging, with the median parting after a single
completed turn. **Mega bodies are now tested** (ROADMAP #31): no stone is stripped from the measured arm,
and every mega choice Showdown offered was taken by both engines.

**Two limits travel with any rate this instrument prints and must never be separated from it.** Nothing
past the first turn is exercised, because a game stops at its first divergence. And both sides are built
Serious / 0 EVs / 31 IVs so the two engines compute the same stat line before *and* after a forme change
— **this tests RULES, not the spreads the ladder actually brings.**

A one-page map of the whole project and every component. For depth: the
[white paper](ABRA-whitepaper.md) (math + sources), the [deck](ABRA-deck-plain-english.md)
(plain-English), the [technical docs](ABRA-technical-docs.md) (how to run it), and the living
[model ledger](MODELS.md).

## What ABRA is

ABRA is a decision-support model family for **Pokémon Champions VGC, Reg M-B, best-of-one
closed-sheet ladder**. It stores every public ladder replay and builds small, CPU-trainable models on
that growing store. It runs in a browser with no build step.

## The headline finding, 2026-08-06 — VGC is a poker problem, and the metric changes (3.62.2)

**The field has been treating VGC as a chess problem or a pure-RL problem. It is a poker problem.**
ABRA's headline metric is now **exploitability, not win rate** (ADR-003).

**The evidence is somebody else's measurement.** VGC-Bench (Angliss, Cui, Hu, Rahman, Stone — AAMAS
2026, [arXiv 2506.10326](https://arxiv.org/abs/2506.10326)) is the only published work in this exact
format. They trained behaviour cloning on 700,000+ human logs, fine-tuned with PPO under self-play,
fictitious play and double oracle, and **beat a World Championships competitor** in a single-team
mirror. They then trained a best response against each of their own agents and found **all of them
approximately 100% exploitable**. Their expert tester: *"after enough successive games, strong human
players can adapt and beat the agent."* Against their *advanced* tester the agent won 2 of 5.

**That is the predicted behaviour of a compiled policy in an imperfect-information game**, not a flaw
in their execution. `docs/POKER-TO-POKEMON.md` argued from theory that the solution concept here must
be a mixed equilibrium rather than a single best move; it now has the measurement it was missing.

| what changes | to what |
|---|---|
| headline metric | exploitability, comparator VGC-Bench's ~100% |
| WOBBUFFET | side-check → **primary instrument** |
| SLOWKING | preview solver → **the shape of the whole agent** |
| MEDICHAM's justification | "the official engine is slow" → **"the engine is justified iff search pays"**, gated by ROADMAP #62 |

**The thesis under test: a re-solving agent should be harder to exploit than a compiled one.** A
learned policy *recalls*; a search *recomputes*, and presents no fixed mapping for a best response to
attack. **Whether that survives simultaneity, stochasticity and a ~6-turn horizon is UNKNOWN — it is
the experiment, not the assumption.**

**And ABRA has no exploitability number today.** `data/exploitability.json` is declared void. Making
the headline a metric this project cannot currently produce is deliberate; it states the gap rather
than hiding it.

**Two more facts that make the comparison honest.** VGC-Bench is **open team sheets** — the same
information setting as our Reg M-B best-of-three — so they had *more* information than a closed-sheet
agent and were still ~100% exploitable; the exploitability comes from holding a fixed policy, not from
hidden teams. And a head-to-head is impossible (their checkpoints are Reg M-A, ours Reg M-B, and their
own paper shows policies do not transfer across team sets) — but **exploitability is intrinsic**,
measured against a best response trained against *you* in *your* format, so the numbers compare
although the agents can never meet.

**Their dataset is not usable and the code already knew.** Their Reg M-B holding is 4,167 games over
4 days in June 2026 and 100% of it is already in our store as `data/games.ots.jsonl`, against our own
9,701 best-of-three games over 15 days. The 700,000 headline is Reg M-A. An earlier claim in this
session that their archive covered our format inferred coverage from a filename and is withdrawn.

### The plan, four phases

```
1  finish MEDICHAM        search needs an engine that is fast AND correct
2  GATE #62               does compute buy anything: untimed vs on-the-clock
3  if yes -> search, and measure EXPLOITABILITY against their ~100%
4  if no  -> adopt their recipe: BC + PPO self-play/FP/DO, open source, reproducible
```

Branch 4 is approved in advance and is a **result, not a defeat** — the method is published and
reproducible, so taking it would be a finding about VGC rather than a failure of this project. On
compute: cores help the search (CPU-bound, root-parallelisable), GPUs help BC/PPO. MILTANK needs 26 s
against a 20 s budget on one core of sixteen, so sixteen cores fixes the clock — but root
parallelisation scales **sublinearly**, so it converts a failed budget into a met one rather than a
shallow search into a deep one.

### The correction that came with it: 117x was 24.9x

ADR-001 chose to keep a hand-written simulator on a benchmark of **29 vs 3,401 battles/sec/core —
117x**. Re-measured on this machine, same four teams (derived from the store), 8-second runs at a
60-turn cap: MEDICHAM **13,041 turns/sec / 217 battles/sec**, `champions_sim` **523 / 28** — a ratio
of **24.9x**. **`turns/sec` is the comparable unit and `battles/sec` is not**, because MEDICHAM ran to
its 60-turn cap and Showdown ran with `choose('default')` to a natural end. The old figures are kept in
ADR-001 with a dated correction beside them. **The decision stands and its stated justification does
not** — a 24.9x gap still rules out live browser simulation, but the reason for the engine is now the
falsifiable one above. A third reading exists that is neither: ROADMAP #61 measured 1,606 battles/sec.
**Nothing in this repository ratchets engine speed**, which is how three readings of one quantity
disagreed by an order of magnitude with no test going red.

## The finding that shapes everything

**You cannot reliably predict who wins from the two team sheets** — even a player-rating model ties a
coin. So ABRA does not sell outcome prediction. It supports *decisions* and grades every model with a
proper score, a confidence interval, and an honest baseline. Wins are reported as wins; two honest
negatives are reported as negatives.

## The finding that shapes what gets built next (2026-07-30)

**Four experiments added knowledge to the model. All four measured a null. Two experiments changed
what the model is optimising for. Both were large wins.**

| change | kind | result |
|---|---|---|
| take the best move instead of sampling it | objective | **+12 points, 79.7% of decisive pairs** |
| self-play policy improvement over the clone | objective | **55.9%** |
| four separate feature additions | knowledge | four nulls |

> **RECONCILED 2026-07-31.** That 55.9% was measured on the **53-feature vector with switching OFF**. Repeating the experiment on the **56-feature vector with switching ON** gives **48.1%** [46.5, 49.8] over 9,728 paired games — a interval entirely below 50, i.e. self-play training made the policy *worse*. Both numbers stand as measurements of different configurations; neither generalises to 'self-play helps'. The difference is not explained, and three candidate causes are untested: switching exploration being harmful (which used to be supported by the older 10-point switching loss — **that figure is RETRACTED 2026-08-06 as unattributable and confounded**: medicham2 playouts predating WIRES 123-128, no `engine_release` stamp, and `bringIn()` selects `live(bench)[0]`, so it measured switching to an ARBITRARY body rather than to a chosen one. The candidate cause stands; its supporting evidence does not. See #63), 36.5% drift over 18 iterations, or self-play eroding imitation-fitted features that were already good.

The nulls survived the obvious check: an overdispersion test across teams reads ~1.00, against 1.169
for a known real effect, so they are genuine rather than a real effect hidden by team variety.

**The constraint is the objective, not the knowledge.** This is why the next item is retraining a
model that already exists (DODUO, the pair-scoring layer, which lost at 42.0% fitted to *resemble
humans* and has never been fitted to *win*), rather than adding more features to MAG.

**A second, blunter lesson from the same day.** Every integrity bug found had one shape: a fact
reached one consumer and not the next. Priority blocking was in the artifact but not the simulator,
so Sucker Punch beat a Farigiraf in every game ever simulated. A switch-in's own ability never
reached the code that chooses the switch — measured over 40,001 matchups, declaring Intimidate,
Drizzle or Drought changed nothing at all. And every mega forme carried no ability, no moves and no
item, so **26% of the format scored as threatening nothing**. None of these were modelling
disagreements. They were plumbing.

**A third lesson, 2026-08-04, and it is about the rulers rather than the models.** A result that does
not record its own configuration cannot be checked by anyone, including the person who produced it.
The R1 gate published *"+2.91 [1.79, 4.04]"*; recomputed from the only committed evidence it is
**+0.456 [−0.717, +1.630] — UNDECIDED**. Nothing was falsified: the row dump recorded the answers and
not the settings, so a run at exploration 0 and a run at exploration 1 left byte-compatible files that
differ by nearly four accuracy points.

Auditing the sibling gates against the same standard found two more.

| gate | published | what the evidence supports |
|---|---|---|
| R1 leaf accuracy | +2.91 [1.79, 4.04], PASSED | **+0.456 [−0.717, +1.630], UNDECIDED** |
| R2 leaf cost | 5.83 ms median | reproduces only as arithmetic on itself, and it timed `explore=0` at a 20-turn horizon while the shipped leaf runs `explore=1.0` at 60 |
| R3 divergence | 72.9% over 70 decisions | recomputes exactly — from two fields in the same file. **Its control was printed and never stored**, and the gate's own verdict branches on that control |

Every gate now writes a sidecar (`engine/run_stamp.js`) recording budget, exploration rate, horizon,
content digests of every source it reads, the commit, and whether the tree was dirty. Older artifacts
carry one reconstructed from the commit that contained them, labelled inferred rather than observed.

## The components at a glance

| Model | What it is | Status | Headline result |
|---|---|---|---|
| **MEDICHAM** | Hand-written doubles doubles-battle simulator. **Its justification is now falsifiable (ADR-003, 3.62.2): it exists so per-turn re-solving is affordable, so the engine work is justified if and only if search pays — gated by ROADMAP #62.** The speed ratio that originally justified it is corrected in the section above | ⚠️ **Being replaced** | Within 5% of the Smogon calculator on 31 scenarios, but disagrees with the OFFICIAL Champions engine by 31.1 points of win probability. ADR-001: becomes a lookup over precomputed tables. **Mechanics census 231 live of 232 probed, 1 missing with a reason** (`data/mechanics-census.json`, wires 82–130 landed 3.40.0–3.56.0; **129 is the whole of accuracy** — Coil, Wide Lens, Sand Veil and No Guard all measured IDENTICAL with and without, ~5,000 uses, three unrelated causes, now one `hitChance(att,def,id,field,ctx)`; **130 is Substitute, charged for and never built**, 1,976 clicks of a move strictly worse than passing; 117 is Psychic Terrain refusing priority against airborne bodies, and the shared `isGrounded` that replaced three hand-written copies of the predicate; 118 is dynamic speed; **119 is TAUNT, which the simulator had never implemented at all** — 1,503 clicks, the volatile written and read by nothing — and 120–122 are a pivot move resolving at the bare-switch priority, Volt Switch pivoting out of an absorbed hit, and Yawn passing through Good as Gold); **generated interaction matrix 98.8% — 1,624 of 1,643 live carrier x reactor cases**, PLUS the artifact's own `off_gate` count of **53** disagreements in buckets the gate discards — read both, because 3.50.0 moved the second while the rate did not move of 2,300 staged from a theoretical 8,795, i.e. **26.2% coverage** (3.43.0 closed the generator’s own arithmetic — `theoretical = staged + dropped`, asserted per axis, which found an understated denominator, a depth-cap off-by-one and outcome buckets that were not a partition; 3.45.0 then recovered the 902 pairs dropped for “having a probability” and found that the harness’s two pinned dice were not the same die, so every sub-100-accuracy move had been MISSING in the reference engine while medicham2 hit. The agreement figure has fallen twice while the engine did not change — both falls are the denominator becoming honest), **multi-turn field axis 156/156** (`data/interaction-matrix.json`); damage differential **1/150**, the one row a documented harness-layer artifact (Disguise); two-rulebook collision ratchet **2 clashes / 151 comparable facts** (`data/rulebook-collision.json`); DEAD-tag ratchet **61 → 38**; mutation tier (`data/mutation-coverage.json`) **163 class-A operators over 56 carrier × tag rows** — the 97 "defect candidates" of 3.49.0 were triaged A/B/C/D from a parse of the engine source and **none of them is class A**, so the ratchet counts class A only |
| **GURU** | Meta matchup matrix from real outcomes | ⚠️ **No decisive cells that survive multiplicity** | `data/guru-matchups.json`, 2026-07-31, **5,265 clean games / 12 archetypes / 144 cells**. **6 directed = 3 distinct** matchups clear a 95% test one at a time, and **ZERO survive FDR at q=0.05 or Bonferroni** — 66 pairs, 3.3 expected by chance, 3 observed, smallest exact p 6.1e-3 against a BH threshold of 7.6e-4. Predictive test **0.7124** vs a coin 0.6931 over 1,053 held-out games — **worse than a coin**. Descriptive structure only. (This row read *1,124 clean games, 11 archetypes, 0.735* until 2026-08-04, from a superseded run; the verdict is unchanged.) |
| **XATU** | Opponent set + next-move belief | ✅ Built | Top-1 36% / top-3 72% on held-out human moves (beats its baselines) |
| **PORY** | Mid-game win-probability value net | ⚠️ **Contribution unclear** | Log-loss **0.6236** 95% CI [0.6070, 0.6387] vs coin 0.6931 and vs the material heuristic 0.6428 (regenerated 2026-08-05 on 5,883 clean games; the previously published 0.567 predated the current quality filter) — but its features ARE the material state, and it **loses to a two-feature baseline** (alive_diff+hp_diff 0.5822 vs PORY 0.5840, same estimator). Report the gain over MATERIAL, not over a coin. See engine/pory_baseline.py |
| **CHOMP** | Bring-4 / lead-2 team-preview engine | ✅ Ships (standalone) | Exact-damage picker; **CHOMP-EV proof: brings tie a coin (honest null)** |
| **SLOWKING** | Team-preview Nash (mixed strategy) — **and, since ADR-003 (3.62.2), the shape of the whole agent rather than the preview solver**: equilibrium mixing plus continual re-solving is the answer poker reached for exactly this class of game | ✅ Built | Equilibrium ≪ exploitable than uniform; playstyle cycle is **suggestive on small samples** |
| **KADABRA** | Replay coach | ✅ Works offline | Per-turn "you're at X%" from PORY |
| **DITTO** | Team optimiser | ⚠️ Pivoting | Objective de-biased to validated damage (was optimising a backwards signal) |
| **ALAKAZAM** | In-battle decision engine (capstone) | 🔜 In development | Belief + search + learned value; built last on the inputs above |
| **MEW** | Self-play data engine | ✅ **Built** | Runs the OFFICIAL Champions engine against itself on real observed teams. 1,000 games, 13/13 validation checks, mirror 51.0% CI [45.4, 56.6] |
| **MAGNEMITE** (MAG) | The in-battle policy that reads the board | **Built, and improving by self-play (3.28.0)** | Conditional logit over **58 features**, fitted to **232,815 usable human clicks of 241,927 seen** from 8,942 clean open-sheet games (`data/policy-weights.json`, 3.42.0 — this row read 53 / 146,910 / 6,091 until then, three fits behind). Held out by game: top-1 **32.9%** against the behaviour clone's 23.4%. **1,336 recorded actions that were not clicks at all have been removed from the labels** and 3,260 redirected ones are fitted over a candidate set. It now DOES decide switches and DOES run a real damage calculation — both were listed here as missing and both became false. Still one ply, still no model of the opponent's move |
| **WOBBUFFET** | Exploitability of MAG — hill-climb a counter over MAG's own weights. **PRIMARY INSTRUMENT since ADR-003 (3.62.2)**: this produces the project's headline metric, and its published comparator is VGC-Bench's approximately-100% exploitability | ❌ **NOT MEASURED** | **There is no exploitability number for this project (2026-08-04).** The published ~~63.2% [56.6, 69.3], mirror 47.5%~~ is **retracted**: 17 features against the 58 we ship, an engine 25 wire-fixes old, computed before the quality filter existed. The 58-feature re-run is **void** — `data/policy-weights.json` was refitted at 22:15:24 UTC *while it was running* and `engine/medicham2-browser.js` changed content twice more afterwards. Separately its hill-climb accepted **1 of 24** steps and would have been uninformative anyway. `engine/exploit.js` stamps nothing about what it read, which is why none of this was visible to it. See `docs/SEARCH.md` §R8 |
| **DUSK** | Endgame exact solver | 🔜 Roadmap | Solves small boards (≤2v2, 1v1) perfectly — sharpens ALAKAZAM's endgame and gives clean training targets for PORY |
| **HYPNO** | Opponent read / exploitability dial | 🔜 Roadmap | Estimates opponent strength + predictability; tells ALAKAZAM when to play safe (vs strong) or exploit (vs weak/predictable) |
| **ROLES** | Multi-label team composition (26 roles) | ✅ Built | Role-pair matrix pools data to median cell **n=20** across 1,051 cells (vs old single-label n=11–18) — the 7,971 once published was retracted in 2.7.0; preview roles tie a coin (honest null) |
| **WAR** | Wins Above Replacement (species RAPM) | ⚠️ **Null** | **Withdrawn 2026-07-25.** Beat a coin only on the unfiltered store (0.6860). On clean games: **0.7048 vs coin 0.6931, accuracy 0.502** — the signal was four bots playing one team 1,446 times |
| **NMF** | Emergent roles / archetypes | ⚠️ **Rank not defensible** | Rank 6 ships, but the project's own criterion (`engine/nmf_rank.py`, bootstrap factor stability, cf. Brunet et al. 2004) selects **rank 4** — and rank 6 scores **−0.107 excess over null**, i.e. its factors are *less* reproducible across resamples than factors fitted to shuffled data. The old justification here was reconstruction error 0.53, which that same script states **cannot select a rank** (it falls monotonically by construction). A team is a *blend*, learned not hand-labelled — but the number of blends is not currently defended |

**Multiplicity, corrected 2026-07-31.** The fit reports a 95% interval for all 56 features, so at alpha 0.05 about **2.8 of them clear zero by chance alone**. The family is **every feature in the shipped fit**, because every one is reported to the reader — choosing a smaller family after seeing which are large is the practice the correction exists to prevent. Uncorrected, **53** clear zero. Under **Benjamini–Hochberg** (FDR, 1995) **53** survive; under **Bonferroni** (FWER) **49**. Nothing significant uncorrected fails the FDR correction, so the headline count is not an artefact of having looked at 56. Computed by `engine/weight_multiplicity.js` → `data/weight-multiplicity.json`. **This says which weights are distinguishable from zero. It says nothing about whether an imitation-fitted weight is evidence about WINNING** — a separate and larger question this project has measured going the other way.

**A phrasing the filter itself mandates.** `require_full_bring` conditions on game length: measured 2026-07-31, the games it keeps are **1.71x longer** on average (7.4 vs 4.3 mean turns; 19,589 kept vs 8,713 dropped). Every bring statistic in this project is therefore *"the bring, **among games long enough to show it**"*, which is not the same as "the bring". `data/quality-filter.json` states this at the point of filtering and requires it to be said downstream; this is that.


## The engine can say WHAT it did, not only where it ended up (3.58.0)

`engine/medicham2-browser.js` emits a **Showdown-shaped protocol trace** on request
(`battleInit(A, B, {trace: []})`, off by default). The event set is derived from Showdown's own
`add()` call sites, including this **format's** overrides, and is published in
`data/protocol-events.json`, whose `showdownEvents`, `emittedCount`, `notEmittedCount` and
`partialCount` read 91 / 38 / 56 / 10 — every non-emitted event carries a written reason. Two gates
fail the run: an event claimed here that Showdown never emits, and an event Showdown emits that is
neither emitted nor explained. `tests/test-protocol-trace.js` fails if any claimed event never fires
in a real game.

No mechanic changed: census **234 live / 235 probed**, differential **1/150**, 122 red demonstrations
0 failed, all five scripted whole-game comparisons agree on every turn.

**It immediately said something about our own instruments.** The damage differential compares only
`roll=0` and `roll=15` — the endpoints — and in between MEDICHAM samples an 11-integer range uniformly
where Showdown floors 16 base values separately. **149/150 endpoint agreement is compatible with every
interior roll being off by one or two.** Separately, MEDICHAM resolves the knock-off, the resist berry
and the contact punish *before* subtracting the target's HP; end-of-turn state is identical, which is
why the state comparison agrees and the trace does not. Both are recorded, neither is fixed — changing
how a damage roll is drawn moves every seeded run in the repository.

## How it fits together

The **store** (every real game) feeds **GURU** (meta), **XATU** (belief), **PORY** (value), and
**MEDICHAM** (damage). **SLOWKING** solves the preview; **CHOMP** picks the bring; **KADABRA** coaches
a replay with PORY. **ALAKAZAM** is the capstone that assembles belief + search + value into the
win-%-optimal move, built last. Every change updates the code, this summary, the white paper, the
deck, the technical docs, and the CHANGELOG in the same pass.

## Repositories and site

| Piece | Repo | Live |
|---|---|---|
| ABRA (models + site) | `github.com/willhoop/abra` | `willhoop.github.io/abra/app/` |
| CHOMP (bring engine) | `github.com/willhoop/chomp` | Showdown userscript |
| Portfolio | `github.com/willhoop/willhoop.github.io` | `willhoop.github.io` |

## The data, as of 2026-07-25

| | |
|---|---|
| Collected (closed-sheet Bo1 ladder) | see `data/live.js` — generated on every refresh, growing hourly (hardcoded sizes retracted, S13) |
| Usable after the quality filter | **1,124** (12.8%) |
| Self-play (MEW, official engine) | 1,000 — separate file, never pooled |
| Open-team-sheet archive | 4,167 (MIT, 2026-06-17..20) — separate file, different information regime |
| Smogon official priors | 283 species, whole-ladder aggregate |

## Two metagames, not one

`meta-usage.json` publishes both, because they answer different questions:

```
competitive  garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion
ladder       garchomp, whimsicott, kingambit, basculegion, charizard, incineroar
```

**Competitive** is what humans choose when trying — right for tournament prep and for any claim about
the game. **Ladder** is what you actually face: three in four STORED games involve a bot. That is a property of what gets
uploaded rather than of the ladder: bot-team species are over-represented in the scrape by a mean of
+8.3 points against Smogon whole-ladder statistics, while other top species run -2.9. The true share
of bot opponents is lower than the store implies, but it is not small. Charizard sits at 25.7% on the ladder
view and outside the competitive top six because it is on the bot team. Consumers must say which they
used.

## Honest ceilings

Predicting the match winner from sheets is a coin flip in this format — and the previously published
55.0% skill ceiling was itself measured with bots included. Removing them gives 52.4%, an interval
that contains a coin flip. Every preview-level model now sits at that ceiling: JOLTEON, roles,
CHOMP-EV, and as of 3.2.0 **WAR, whose result is withdrawn**.

Most results here are also **underpowered**: 1,124 clean games can only detect an edge of ~4.2
accuracy points, and a 2-point effect needs ~4,900. `engine/eval_harness.py` now refuses to report a
null without stating what it could have seen.

The one load-bearing win is the **validated damage engine** — **36 scenarios, 100% within 5% of
`@smogon/calc`, 97% within 2%, median error 0%, worst 3%** (`data/damage-validation.json`,
2026-08-05). This line previously read "31/31 within 2%", which overstated the project's single
load-bearing result in both the count and the tolerance; the artifact is the authority and the
whitepaper's "within 5%, worst 3%" was the correct statement all along. PORY was the other, until 2026-07-25 showed it loses to a two-feature material baseline.
The project's two genuine contributions are the ones it treats as plumbing: **behavioural bot
detection**, and the **measurement discipline** that dissolved WAR, the 55% ceiling and GURU's matchup
matrix in a single day.

## Correction — the scrape over-samples bots

Measured 2026-07-25 against Smogon's whole-ladder statistics for the same format and month
(1,163,315 battles vs the count generated into `data/live.js`):

| | mean difference, uploaded vs whole ladder |
|---|---|
| The five bot-team species | **+8.3 points** |
| Every other top species | **−2.9 points** |

75% of *stored* games involve a detected bot. That is a fact about **what gets uploaded**, not about
the ladder — bots save replays far more readily than humans do. Any statement of the form "three in
four of your opponents are bots" is therefore an overestimate and should not be made from this store.

This also bounds the earlier upload-bias result. Comparing our open-team-sheet Bo3 games against the
whole Bo3 ladder gave a mean absolute difference of only 1.84 points — but that corpus contains
almost no bots (29 named-bot sides in 4,167 games). So **human** upload bias is small; **bot** upload
bias is large, and the closed-sheet Bo1 store carries the latter.

## Measurement validity (3.39.0)

| item | state |
|---|---|
| engine release | `5fc1f711a0e3`, 12 files frozen, Showdown `20ad99ff`. A measurement reads the snapshot, not the live tree, so the divisions can run concurrently. |
| provenance method | **content digests**, no longer mtime. 0 artifacts verified by content, **92 by mtime alone** — printed every run, ratcheted downward by a named list. |
| exploitability | **no figure.** 63.2% retracted on its own merits; the 2026-08-04 re-run is `void: true`. |
| mirror control | **49.7% [46.2, 53.2]**, n=782 — survives the void run and retires the seat-asymmetry worry. |
| MAG refit | ran; **moved nothing measurable.** Weather fix +0.048 top-1 [0.009, 0.093]; the refit itself −0.074 [−0.155, +0.004] against a 0.192-point noise floor. |
| open, needs a decision | the fit sees `{nature, item}`; the player sees `{nature, item, ability, moves}`. **50.47% of trained decisions**, 99.75% of games. |
| click censoring (3.42.0, re-measured 3.47.0) | **1,475 of 270,022 recorded actions were never clicks** (Encore 1,243, `\|drag\|` 232) and were being fitted as human choices. Removed and counted. **3,526 redirected attacks (1.3180%)** now enter as a two-member candidate set instead of a certainty on the redirector. Paired on 48,274 held-out decisions: on coerced turns P(the fabricated action) **−0.002613 [−0.003650, −0.001672]**; on redirection turns **no improvement**; corpus top-1 flat. Both artifacts were re-run under the current engine after four simulator wires landed underneath them, on a corpus grown to 10,009 games, and every 3.42.0 figure reproduced inside its interval — the smaller run's numbers are in `CHANGELOG.md` 3.42.0. `data/click-censoring-census.json`, `data/censoring-value.json` |

