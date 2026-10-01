# DUSK — the endgame solver: design

**Version 0.1.0 · 2026-10-01 · status: DESIGN. Nothing in this file is built except the measurement scripts named in §1.**

DUSK is the "Endgame tables" row of `solver/PLAN.md` §2: small late positions in, a value and a strategy out, and it
must beat the search it replaces at endgames. This document decides what DUSK is, from our own data first and the
literature second. Every figure cites the artifact it came from. The tracked summary is
`solver/dusk/endgames-summary.json` (written by `solver/dusk/combine.js`); the bulky outputs are in `solver/out/dusk/`
(gitignored). The full account, with the method and every caveat, is `docs/_reports/2026-10-01-dusk-design.md`.

---

## 0. Decision in one screen

| Question | Answer | Why (short) |
|---|---|---|
| Tables, on-the-fly or hybrid? | **On-the-fly, with a per-game (per-series) memo.** No precomputed tables. | A table keyed on what decides the value never repeats: the chronological hit rate is 1.0% on species + sets and ≤0.8% once HP enters the key; 17% on the bare species matchup, which does not fix the value (§1.3). The opponent's spreads are hidden as well (§1.4). |
| What does DUSK search? | **A depth-limited, simultaneous-move backward induction with a matrix game at every node, chance enumerated by MILTANK's stratified enumerator, and a certified value band.** | The game is simultaneous, stochastic and short (median 2 decisions left after entry). The literature's answer for exactly this class is backward induction with a matrix game per node plus double-oracle and simultaneous alpha-beta (Bošanský et al. 2016; Saffidine et al. 2012). |
| Value | **P(win) for our side, as a band [lo, hi].** Exact when the band closes. | The PokaiTrainer certificate: an exact solve whose leaves are refilled with 0 and 1 is certified when the root does not move [REPORTED]. |
| Where it runs first | **1v1 and 2v1** (41% of endgame entries), then 2v2 behind double oracle | Sheet-bound joint menus: 1v1 16 cells, 2v1 280, 2v2 6,000 (median, §1.2). |
| Handoff | Root predicate **E2**: both sides have at most two alive, so no bench and no switch. DUSK takes the decision; inside MILTANK it serves certified leaves for E2 states. | E2 is reached in 44% of all open-sheet games (63% of clean, fully revealed ones) and 47% of ours. Inside E2, 89 of the search arm's 670 move decisions; 38 more are the turn before entry. |
| Clock | DUSK spends **the bank**: at E2 entry the median bank is 420 s with about 2 decisions left, so the per-turn cap (55 s) binds, not 5 s. | Measured on our ladder decisions (§1.5). The must-beat test gives the baseline the same clock. |
| Direct value on the ladder | **Small, and stated so.** Against humans from the same material and HP lead, our endgames convert 3.7 wins short over 88 E2 games, 95% CI [−10.8, +3.6]: not distinguishable from zero. | §2. The 35 of 108 losses that passed through an E2 entered even were mostly entered behind on HP; the search's own value at entry was ≥ 0.5 in 2 of its 14. |

---

## 1. What endgames occur in Reg M-C (our own data)

Store-only: the open-sheet bo3 store and the closed-sheet bo1 store in the main checkout, read explicitly by their `.gz`
paths, every `engine/quality.js` `reasons()` code charged (bots and behavioural bots included), then own accounts,
Illusion previews, parse errors, custom rules and no result excluded. Positions are the public start-of-turn state
rebuilt from the raw log by `solver/porygon2/v2/reveal.js`. Script: `solver/dusk/measure_endgames.js`
(`--fmt bo3|bo1`; `--keep-game-shape` is the sensitivity arm that does not charge forfeit-before-action, short games
and partial brings).

**Definitions** (`solver/dusk/lib.js` `DEFINITIONS`). `alive` = teamsize − fainted at the start of a turn (a brought
member never seen counts alive). **E2**: both sides ≤ 2 alive (no bench, so no switch). **E4**: ≤ 4 alive in total
(adds 3v1). **E1**: 1v1. The entry is the first start-of-turn position meeting the definition.

### 1.1 How often, when, and how long

| | bo3 (open sheets) | bo1 (closed sheets) |
|---|---|---|
| clean games kept | 26,945 | 29,119 |
| reach E2 | **62.9%** [62.3, 63.5] | 64.3% |
| reach E2, games that ended normally | 73.6% | 75.7% |
| reach E4 / E1 | 80.4% / 15.7% | 81.2% / 18.4% |
| E2 entry turn | median 7 (p10 5, p90 10) | median 7 |
| decisions left after E2 entry (normal end) | mean 2.19, median 2, p90 4, p99 7 | mean 2.39, median 2, p90 4 |
| E2 games then ended by forfeit | 16.1% (2,737 of 16,951) | 18.7% (3,509 of 18,733) |
| **reach E2, every real game** (sensitivity arm: forfeit-after-preview, short games and partial brings kept) | **44.0%** of 38,534 [43.5, 44.5] | 42.4% of 44,246 |

**Read the two reach figures together.** `reasons()` excludes a game in which some brought member was never seen
(`partial_bring`, 9,417 bo3 games). That is a mechanical correlate of a game that ended early, so the clean corpus is
conditioned toward long games: the 11,589 bo3 games the sensitivity arm adds contain 8 more E2 endgames. **44% is the
population figure for "how often does a game reach an endgame"; 63% is the figure for clean, fully revealed games**,
and every per-endgame figure below is the same in both arms (the added games hardly contain endgames). Our own ladder
rate, 46.6% (§2), sits beside the population figure.

By rating band the clean-corpus E2 reach is flat: 60.6–64.5% in every bo3 band with at least 700 games (1400–1499: 50
of 95).

### 1.2 What the endgame looks like (bo3, E2 entry)

| | |
|---|---|
| material | 2v2 59.0%, 2v1 38.1%, 1v1 2.9% |
| side ahead wins | 2v1 **88.8%** [88.0, 89.6]; 3v1 (E4) 97.0%; 1v1 HP leader 71.6% |
| 2v2, HP leader wins | **64.1%**: lead 1–25 → 55.0%, 26–50 → 60.0%, 51–100 → 68.8%, > 100 → 85.3% |
| HP of live members | mean 69%; 39.5% at full |
| status | 3.8% of members (paralysis 1.5%, burn 1.0%) |
| any stat stage | 26.9% of members (Attack drops are the commonest, 13.3%) |
| field | 83.1% carry a weather, terrain, room or side condition: terrain 58%, weather 39%, Trick Room 10.3%, Tailwind 13.5%, screens 6.2% |
| mega still available | to at least one side in 28.2% |
| commonest species | Rillaboom (in 27.0% of endgames), Sneasler 21.1%, Incineroar 18.6%, Gholdengo 16.7%, Kingambit 15.3%, Arcanine-Hisui 14.2%, Basculegion 14.0%, Salamence-Mega 12.4% |
| sheet-bound actions per side | 2v2 median 80 (p90 120); 2v1 20; 1v1 4 |
| **joint menu (cells)** | **2v2 median 6,000 (p90 12,000); 2v1 280; 1v1 16** |

The action count is an upper bound from the open sheets (each known move times its target choices, times two where
the body can still mega; `lib.js` `actionCount`). Choice lock, Encore, Taunt, Disable, PP and the Protect repeat are
not applied; MEDICHAM's `legalActions` is the authority and owes the exact count (OWED).

### 1.3 How many distinct endgames — the table question

`keysOf` builds colour-blind keys at seven levels (`DEFINITIONS.keys`). The decisive column is the **chronological
hit rate**: the keys of the first 80% of E2 entries by upload time, asked of the last 20%.

| key (bo3 E2, 16,951 entries) | distinct | singletons | entries covered by the top 1,000 keys | hit rate, later 20% |
|---|---|---|---|---|
| K0 species matchup | 14,724 | 78% of entries | 16.1% | **17.0%** |
| K0set + items, abilities, moves | 16,774 | 98% | 6.9% | **1.0%** |
| K1q K0 + HP quarters | 16,814 | 98% | 6.7% | 0.8% |
| K1d K0 + HP tenths | 16,911 | 99.6% | 6.1% | 0.3% |
| K2 + status, stages, volatiles | 16,942 | 99.9% | 6.0% | 0.06% |
| K3 + field | 16,946 | 99.95% | 5.9% | 0.06% |
| K3set exact public state | 16,951 | 100% | 5.9% | 0 |

bo1 is the same shape (K0 7.2%, K0set 0). **A precomputed table cannot pay**: the only key that repeats (the species
pair) does not fix the value, and a table under it would be a function over sets, HP, status, stages, field timers and
the hidden spreads, regenerated every time any of them is new.

### 1.4 What is hidden at an endgame

The sheets are open, the dice and the opponent's simultaneous choice are not, and neither are the opponent's Stat
Points. On our ladder decisions inside E2, XATU's belief still held a **median of 7,755 worlds** (p10 1,099, p90 16,492;
`honest.worlds` in the ROTOM decision logs). The back line is known by then (every live member is on the field), so
these worlds are spread candidates. DUSK cannot solve per world; it must solve per CLASS of worlds (§3.3).

### 1.5 The clock at an endgame

The format's timer (`solver/rotom/clock.js`, read from the checkout's ruleset): a 420 s bank, a 90 s grace, at most
55 s per turn, no increment. On our ladder games the bank at E2 entry was **median 419.9 s** (p10 404.9, min 349.9;
`bank_before_s`), and about two decisions remain (§1.1). The adaptive clock's budget
`min(turnLeft − margin, (bank − reserve) / E[remaining requests])` is therefore capped by the 55 s turn limit in an
endgame. Today's ladder arm spends a fixed 5 s (median 4.73 s per endgame decision, median 471 playouts).

---

## 2. What endgames cost us (our ladder games)

Read-only over `solver/out/rotom/` in the main checkout: `aa1`, `aa2`, `gen5ab`, `chomp1`, 189 games, release
`eaa5becc54eb`. The `chomptop` run was live while this was written and is not in these figures (OWED). Script:
`solver/dusk/measure_ladder.js`; the opponent-coverage test is the post-mortem's.

| | all 189 | search arm (91) | prior arm (98) |
|---|---|---|---|
| won / lost (our forfeits) | 81 / 108 (0) | 40 / 51 (0) | 41 / 57 (0) |
| reached E2 | 88 (46.6%) | 38 | 50 |
| at E2 entry: ahead → won | 15 → 15 | 6 → 6 | 9 → 9 |
| at E2 entry: even → won | 56 → **21 (37.5%)** | 21 → 7 | 35 → 14 |
| at E2 entry: behind → won | 17 → 1 | 11 → 1 | 6 → 0 |
| losses that passed through an E2 entered even or ahead | **35 of 108 (32%)**, none from ahead | 14 of 51 | 21 of 57 |
| even entries, HP ahead → lost | 12 of 24 | 4 of 9 | 8 of 15 |
| even entries, HP behind → lost | 21 of 29 | 10 of 12 | 11 of 17 |

**Against the human base rate.** For each of our E2 entries, the human bo3 win rate from the same material and the same
summed-HP-lead bucket is its expectation (`combine.js`, buckets with ≥ 30 human entries; 4,000 game resamples):

| | games | won | expected | won − expected [95% CI] |
|---|---|---|---|---|
| all | 88 | 37 | 40.7 | **−3.7 [−10.8, +3.6]** |
| search arm | 38 | 14 | 15.4 | −1.4 [−5.8, +3.2] |
| prior arm | 50 | 23 | 25.3 | −2.3 [−7.6, +3.1] |

**What the search did there.** Inside E2 it searched a 4×4 table (16 cells) against a sheet-bound joint menu of median
4,096 cells at entry (search arm; 4,800 over all 88); the opponent's actual move ids were in its 4 columns on 76% of endgame decisions [67, 84]. Its
root value inside E2 is roughly calibrated at the ends (values 0.9–1.0 averaged 0.97 and won 93%; values 0–0.1
averaged 0.03 and won 8%; Brier 0.126 on 99 decisions). In the 14 search-arm losses from an even entry, the value at
entry was ≥ 0.5 twice (0.868, 0.524); the median was 0.18. The losses were mostly decided before the endgame.

**So DUSK's direct ceiling is small.** The point estimate is about 4 wins per 100 E2 games, and the interval includes
zero. DUSK earns its place through three things the measurement does support: (1) it looks past the 4×4 table, which
holds 16 of a median 4,096 joint cells and missed the opponent's actual move on 24% of endgame decisions; (2) it can spend the 420 s bank where only ~2 decisions remain; (3) it serves
certified values to MILTANK on the turn before entry, where a one-turn leaf currently stands in for a two-to-four turn
game (38 decisions on the search arm, 5.7% of its 670). The must-beat test (§5) is what decides it.

---

## 3. Design

### 3.1 Tables, on-the-fly, or hybrid: on-the-fly with a memo

Chess decided on retrograde tables (Thompson 1986; Nalimov, Haworth & Heinz 2000; Syzygy) because the endgame space is
small, complete and the same in every game: KRPvKR is KRPvKR. None of that holds here (§1.3, §1.4). What DUSK keeps
from the chess design:

- **Syzygy's split between a search probe and a root probe.** Syzygy's WDL tables are the only ones probed during
  search and the DTZ tables only at the root (`syzygy1/tb` README). DUSK's analogue: inside MILTANK it answers with a
  value band only (a probe); at an E2 root it also returns the strategy.
- **A memo, not a table**: a transposition table keyed by `medicham_api.digest(S)` plus the world class, kept for the
  game and carried across the games of a bo3 series (the same two sheets meet again; the spreads are locked).
- **Lazily solved 1v1 sub-games.** At a 2v2 or 2v1 root, the 1v1 states its lines reach are solved exactly (16 cells
  each) and memoised first, so the larger solve's deepest leaves are exact. This is the only "table" DUSK builds, and
  it is built per game, on demand.

### 3.2 State and chance: exact state, enumerated dice

- **The state is the engine's own battle**, exact integer HP, stages, status counters, PP, field and side timers,
  volatiles. DUSK abstracts nothing in the state. Bucketing was measured biased in this repository: classing a damage
  draw by its consequence with the later dice held fixed enumerated a 12.7% survival as 0
  (`docs/_reports/2026-09-29-weighted-chance-search.md` §2). HP buckets appear only in the measurement keys of §1.3.
- **Chance comes from `solver/miltank/chance.js`**: a scripted `rngStreams` struct, each die's thresholds found by
  bisection on the board digest and snapped to the simplest rational, each class played at a u drawn inside it. The
  engine keeps every threshold (accuracy, crit, the 16 damage rolls `85 + floor(u·16)`, secondaries, the Protect
  repeat). DUSK uses `dmg: 'exact'` where the node is small (1v1) and `coarse` elsewhere, and counts
  `truncatedMass`. Measured cost on general positions: median 138 stepped turns per joint pair coarse, 1,721 exact
  (same report §3).
- **Speed ties are a branch, never a die** (Will, 2026-08-24, memory "a speed tie is a branch, not a die"). chance.js
  cannot bisect the tie die and samples it (`sampledTie`). DUSK v0 therefore treats a tied pair as an explicit
  two-way chance node only once ENGINE exposes the tie at the point it is resolved (OWED, a capability request). Until
  then DUSK counts `tieSampled` and a node with a sampled tie is never reported as certified.
- **Termination.** The game graph with PP in the state is finite in practice but cyclic in the memo (healing,
  repeated Protect). DUSK runs Shapley's value iteration (1953) on the reachable memo graph with a turn horizon; a
  value whose band has not closed at the horizon is a band, not a number.

### 3.3 The solution concept at each node

- **A zero-sum matrix game over the joint simultaneous choice.** Rows are our joint actions, columns theirs, and each
  cell is the expectation over the enumerated chance buckets of the child's value. It is solved by SLOWKING's exact LP
  (`solver/slowking/matrix.js` `solveLP`); the root's mix is what ROTOM samples, never the argmax.
- **The value is P(win) for our side**: `medicham_api.winner(S)` at a terminal (1, 0, or 0.5 for a double wipe with
  no faint order), never `horizonScore`.
- **Backward induction with double oracle.** A 2v2 node has a median 6,000-cell menu. DUSK grows each node's matrix by
  best responses only (the DOBI scheme of Bošanský et al. 2016): start from DODUO's top joints per side, solve,
  add each side's best response against the other's current mix, stop when neither improves. MAG v2's dead-click gate
  runs first, so a click MEDICHAM proves dead is never expanded.
- **Bounds.** Every child carries [lo, hi]. A cell's band is the chance-weighted band of its children; Saffidine et al.
  (2012)'s simultaneous alpha-beta LPs prune a row or column whose best case cannot enter the support.
- **The certificate.** An unexpanded leaf is filled twice, with 0 and with 1. When the root value does not move, the
  value is certified (PokaiTrainer §E.6 [REPORTED]: "fill-independence is the certificate"). Otherwise the leaf is
  PORYGON2's value for play and the band for honesty.
- **Hidden spreads: per class, Bayesian at the root.** Worlds are grouped by consequence for the bodies on the field:
  the speed order against each of our actives (faster, slower, tie) and, per known attack, whether each roll range
  crosses the KO line. v0 solves each class, weights cells by XATU's posterior mass and solves one matrix. That is
  strategy fusion on the opponent's side (Frank & Basin 1998): it lets the opponent not know its own spread. v1 solves
  the root as a Bayesian game, one regret table per class for the opponent (PokaiTrainer's form [REPORTED]) and
  measures the gap. The number of classes per endgame is not measured yet (OWED); it decides whether v1 is cheap.

### 3.4 Correctness: one transition function

DUSK reads MEDICHAM only through `engine/medicham_api.js`, bound to a frozen release (`engine_release.js`
`REL.require`): `clone`, `legalActions`, `step` with the scripted dice, `isTerminal`, `winner`, `digest`. It computes no
damage, no speed order and no probability of its own. Every artifact stamps `REL.stamp()`, the census pin, the team
store pin and every flag.

### 3.5 The handoff

1. **At an E2 root** (both sides ≤ 2 alive at a move request), ROTOM calls DUSK with the clock's budget
   (§1.5: up to the 55 s cap less the margin). DUSK deepens iteratively, solving the 1v1 sub-games first.
2. If the root band closes to ≤ 0.02, DUSK's mix is played. If the budget ends first, DUSK's mix on its last
   completed iteration is played. If no iteration completed, MILTANK's answer is played and **counted**
   (`dusk.fallback`), as is MAG's top legal action if MILTANK also fails (ROTOM's existing rule).
3. **Inside MILTANK** (any root), a cell whose stepped state satisfies E2 asks DUSK's memo: a certified band replaces
   PORYGON2's leaf (`dusk.leafServed`); otherwise PORYGON2 stays. A synchronous DUSK call is allowed only for a 1v1
   state (16 cells) until its cost is measured.

### 3.6 Counters (a capability that cannot prove it ran is assumed broken)

`roots, certified, band_width (p50/p90), iterations, nodes, steps, tt_hits, chance_buckets, truncated_mass,
tie_sampled, world_classes, do_rounds, fallback, timeout, leaf_served`. A run with `roots > 0` and `certified = 0`, or
any `fallback`, is called out by name in its report.

---

## 4. Verification ladder

| Rung | Test | Bar (set now) |
|---|---|---|
| V-D1 brute force | Constructed 1v1 and 2v1 fixtures, every die enumerated exactly and no pruning, no double oracle, no memo, against DUSK's full machinery | equal to 1e-9; RED on three breaks (chance weights dropped, the best-response oracle off by one action, the memo key missing HP) |
| V-D2 sampled play | From each certified root, 2,000 seeded playouts with both sides sampling DUSK's own mixes | the mean lies inside the band ± 3 SE on every root |
| V-D3 deep MILTANK | MILTANK with full menus, depth to the terminal and 10^5 playouts on the same roots | agrees with DUSK's certified value within 3 SE; a disagreement is a bug in one of them, chased to a board |
| V-D4 the authority | On endgame boards from real bo3 logs, each snapped die probability DUSK found (accuracy, crit, roll, secondary) against the probability Showdown's own sim computes for that event; the boards themselves are already covered by the MEDICHAM gate (shared dice, board-material zero) | 0 mismatches; a mismatch is FILED to ENGINE, never fixed here |
| V-D5 feasibility | 200 TEST-split E2 roots from `positions-bo3.jsonl.gz`, at 5 s and at the 50 s endgame clock | 5 s: ≥ 90% of 1v1 and ≥ 50% of 2v1 roots certified. Failing at 5 s moves the must-beat test to the 50 s clock for both arms |

## 5. The must-beat test (pre-registration draft; NOT RUN, no game played)

- **Arms.** A: today's ladder arm (`miltank-gen5`: gen5 MAG/DODUO/PORYGON2, k 4×4, depth 0, 1 reserved switch row) with
  DUSK taking every E2 decision. B: the same arm without DUSK. Nothing else differs.
- **Equal wall-clock.** Both arms get the same per-decision budget: run 1 at the fixed 5 s, run 2 at the adaptive
  endgame clock (§1.5). The measured clock ratio is reported and must lie in [0.95, 1.05].
- **Starts.** E2 entry positions from real bo3 games in `solver/out/dusk/positions-bo3.jsonl.gz`, TEST-split players only
  (MAG/DODUO's salt), stratified to the measured material mix (2v2 59%, 2v1 38%, 1v1 3%). Each position is played twice
  with the seats swapped. Bodies at the arena's `role-v1` spreads; honest information (XATU).
- **Statistic.** SPRT on the paired game result, elo0 0, elo1 +20, α = β = 0.05, read once at the bound.
- **Pins.** A frozen release at or after `eaa5becc54eb`, `--team-store data/team-pool-frozen-regmc`, the census pin,
  every flag in the artifact. **Will launches it**; this file only prepares it.

## 6. The Smogon hook

Smogon's monthly Reg M-C files are not out (2026-10-01: `smogon.com/stats/` lists months to 2026-08, and August holds
no Reg M-C file). ROTOM already reads them when they exist (`solver/rotom/spreads.js` `findObserved`,
`parseMoveset`). DUSK uses them in one place: the spread prior XATU's worlds are drawn from, which sets how many
world classes an endgame has (§3.3). `solver/dusk/smogon_foldin.js` reports, for the 15 commonest endgame species, how
much spread mass the top five listed spreads hold and how many distinct Speed investments they carry. It prints
NOT PUBLISHED and exits 0 until the file exists. The fetch-and-fold step is in the report's OWED list.

## 7. Path

| Step | What lands | Exit test |
|---|---|---|
| D0 | The positions-to-boards builder (E2 entries from real logs into MEDICHAM bodies) and V-D5's feasibility bench | Every board's public state equals the log's; V-D5 bars read |
| D1 | DUSK v0: 1v1 and 2v1, exact chance, memo, certificate, counters | V-D1 GREEN and RED on its breaks; V-D2, V-D3 |
| D2 | The handoff in ROTOM and the leaf probe in MILTANK, behind a flag | ROTOM's existing tests GREEN; counters non-zero on a local series |
| D3 | 2v2 with double oracle and the MAG v2 gate; world classes | V-D1 on 2v2 fixtures; class count measured |
| D4 | The must-beat SPRT (§5) | H1, or the row says H0 and DUSK stays off |
| D5 | Bayesian root (one table per world class) | V-D1 on a constructed hidden-spread fixture; the fusion gap measured |

ENGINE capabilities DUSK would use, requested and not filed as defects: each die reporting its outcome classes (it
removes the ~10 stepped turns per boundary that bisection costs), and the speed tie exposed where it is resolved.

## 8. Sources (each checked 2026-10-01)

- K. Thompson, "Retrograde Analysis of Certain Endgames", *ICCA Journal* 9(3):131–139, 1986. doi:10.3233/ICG-1986-9302
- E. V. Nalimov, G. McC. Haworth, E. A. Heinz, "Space-Efficient Indexing of Chess Endgame Tables", *ICGA Journal*
  23(3):148–162, 2000. doi:10.3233/ICG-2000-23304
- R. de Man, Syzygy tablebase generator, `github.com/syzygy1/tb` README (WDL `.rtbw` probed during search, DTZ `.rtbz`
  only at the root).
- J. Schaeffer et al., "Checkers Is Solved", *Science* 317(5844):1518–1522, 2007. doi:10.1126/science.1144079
- L. S. Shapley, "Stochastic Games", *PNAS* 39(10):1095–1100, 1953. doi:10.1073/pnas.39.10.1095
- B. Bošanský, V. Lisý, M. Lanctot, J. Čermák, M. H. M. Winands, "Algorithms for computing strategies in two-player
  simultaneous move games", *Artificial Intelligence* 237:1–40, 2016. doi:10.1016/j.artint.2016.03.005
- A. Saffidine, H. Finnsson, M. Buro, "Alpha-Beta Pruning for Games with Simultaneous Moves", *AAAI* 26(1):556–562,
  2012. doi:10.1609/aaai.v26i1.8148
- M. Lanctot, V. Lisý, M. H. M. Winands, "Monte Carlo Tree Search in Simultaneous Move Games with Applications to
  Goofspiel", CGW 2013, *CCIS* 408, 2014. doi:10.1007/978-3-319-05428-5_3
- V. Lisý, V. Kovařík, M. Lanctot, B. Bošanský, "Convergence of Monte Carlo Tree Search in Simultaneous Move Games",
  NeurIPS 2013. arXiv:1310.8613
- B. Bošanský, C. Kiekintveld, V. Lisý, M. Pěchouček, "An Exact Double-Oracle Algorithm for Zero-Sum Extensive-Form
  Games with Imperfect Information", *JAIR* 51:829–866, 2014. doi:10.1613/jair.4477
- B. W. Ballard, "The *-minimax search procedure for trees containing chance nodes", *Artificial Intelligence*
  21(3):327–350, 1983. doi:10.1016/S0004-3702(83)80015-0
- T. Hauk, M. Buro, J. Schaeffer, "Rediscovering *-Minimax Search", CG 2004, *LNCS* 3846:35–50, 2006.
  doi:10.1007/11674399_3
- M. Moravčík et al., "DeepStack: Expert-level artificial intelligence in heads-up no-limit poker", *Science*
  356(6337):508–513, 2017. doi:10.1126/science.aam6960
- N. Brown, T. Sandholm, "Safe and Nested Subgame Solving for Imperfect-Information Games", NeurIPS 2017.
  arXiv:1705.02955
- N. Brown, T. Sandholm, "Superhuman AI for heads-up no-limit poker: Libratus beats top professionals", *Science*
  359(6374):418–424, 2018. doi:10.1126/science.aao1733
- N. Burch, M. Johanson, M. Bowling, "Solving Imperfect Information Games Using Decomposition", *AAAI* 28(1), 2014.
  doi:10.1609/aaai.v28i1.8810
- S. Ganzfried, T. Sandholm, "Endgame Solving in Large Imperfect-Information Games", AAMAS 2015, pp. 37–45.
- M. Schmid et al., "Student of Games: A unified learning algorithm for both perfect and imperfect information games",
  *Science Advances*, 2023. doi:10.1126/sciadv.adg3256
- I. Frank, D. Basin, "Search in games with incomplete information: a case study using Bridge card play", *Artificial
  Intelligence* 100(1–2):87–123, 1998. doi:10.1016/S0004-3702(97)00082-9
- J. Long, N. Sturtevant, M. Buro, T. Furtak, "Understanding the Success of Perfect Information Monte Carlo Sampling in
  Game Tree Search", *AAAI* 24(1):134–140, 2010. doi:10.1609/aaai.v24i1.7562
- S. Hart, A. Mas-Colell, "A Simple Adaptive Procedure Leading to Correlated Equilibrium", *Econometrica*
  68(5):1127–1150, 2000. doi:10.1111/1468-0262.00153
- M. Yu, "PokaiTrainer: Scaling Equilibrium Search to Competitive Pokémon VGC", arXiv:2608.29197 (2026) [REPORTED: the
  outcome-distribution engine, the 33 late-endgame roots with certified value bands, the per-world regret tables].
- S. Karten, A. L. Nguyen, C. Jin, "PokéChamp: an Expert-level Minimax Language Agent", arXiv:2503.04094 (2025).
- J. Grigsby et al., "Human-Level Competitive Pokémon via Scalable Offline Reinforcement Learning with Transformers"
  (Metamon), arXiv:2504.04395 (2025).
- pmariglia, `poke-engine` README (singles; `generate-instructions` lists a turn's weighted outcomes; expectiminimax,
  iterative deepening and MCTS modes), `github.com/pmariglia/poke-engine`.
