# DUSK, the endgame solver: design and measurement (abra/regmc 1.51.0)

2026-10-01. SOLVER. Design plus store-only and read-only measurement. **No game was played, no engine was loaded, no
ladder or arena run was started.** The design is `solver/dusk/DESIGN.md`; this file is the full account.

## Verdict

- **Endgames are common.** Both sides at two or fewer (E2: no bench, no switch) is reached in **44.0%** of all
  open-sheet bo3 games (38,534), **62.9%** of quality-clean fully revealed ones (26,945), and **46.6%** of ours (88 of
  189). About two decisions remain after entry (mean 2.19, p90 4). The material is 2v2 59%, 2v1 38%, 1v1 3%.
- **They cost us less than the raw count suggests.** 35 of our 108 losses passed through an E2 we entered even on
  material, none from ahead. But most were entered behind on HP, and against the human base rate from the same
  material and HP lead our endgames convert **−3.7 wins over 88 games, 95% CI [−10.8, +3.6]**; the search arm alone
  **−1.4 [−5.8, +3.2]** over 38. The search's own value at entry was ≥ 0.5 in 2 of its 14 even-entry losses.
- **Architecture: on-the-fly, not tables.** A precomputed table keyed on anything that fixes the value never repeats:
  the chronological hit rate is 1.0% on species plus sets, ≤ 0.8% once HP enters, 17% on the bare species matchup. The
  opponent's spreads are still hidden at the endgame (a median of 7,755 XATU worlds on our E2 decisions). DUSK is a
  depth-limited simultaneous-move backward induction, a matrix game at each node solved by SLOWKING's LP, chance from
  MILTANK's existing stratified enumerator, double oracle for the 2v2 menu, and a certified value band (leaves refilled
  with 0 and 1). A per-game memo carries across a bo3 series; 1v1 sub-games are solved exactly and memoised first.
- **Its leverage is the clock and the menu, not the conversion gap.** At E2 entry the bank is a median 419.9 s with
  about two decisions left, so DUSK can spend up to the 55 s turn cap where the ladder arm spends 5 s; and the 4×4
  table it replaces holds 16 of a median 4,096 joint cells and missed the opponent's actual move on 24% of endgame
  decisions. The must-beat SPRT (pre-registered in draft, §6) decides whether that is worth anything.
- **Path:** D0 positions-to-boards + feasibility bench → D1 1v1/2v1 solver with V-D1 brute-force agreement → D2
  handoff behind a flag → D3 2v2 with double oracle → D4 the SPRT (Will launches) → D5 Bayesian root.

## 1. Method

### 1.1 The meta measurement (`solver/dusk/measure_endgames.js`, `solver/dusk/lib.js`)

- **Inputs** (main checkout, read explicitly by path): `data/games.gen9championsvgc2026regmcbo3.jsonl.gz` (39,541 rows,
  the bo3 open-sheet store) and `data/games.gen9championsvgc2026regmc.jsonl.gz` (63,048 rows, the bo1 closed-sheet
  store), joined on id to the raw logs under `data/raw/games.<format>/` and the plain raw archive. Each input's bytes
  and sha256 are in `solver/out/dusk/endgames-<fmt>.json` `inputs`.
- **Filter.** Every `engine/quality.js` `reasons()` code excludes a game (behavioural bots computed over the same file
  with `behaviouralBots`), then own accounts (`solver/meta/extract.js` list), then no raw log, wrong format, a preview
  Illusion holder (the declared exclusion), parse errors, custom rules (Showdown's infobox in the raw log), no result.
  - bo3: 39,541 → 27,146 after quality and own accounts (partial bring 9,417, short 2,421, forfeit before any action
    237, bot 228, own 82, illegal team 10) → **26,945** kept (Illusion 198, no result 2, parse error 1).
  - bo1: 63,048 → 31,616 (partial bring 12,629, behavioural bot 8,194, bot 6,637, short 3,667, forfeit before action
    269, illegal 20, custom ruleset 10, own 6) → **29,119** kept (custom rules 1,748, Illusion 742, no result 7).
- **Nothing lost silently.** A raw-log line that fails to parse is skipped without a counter in `measure_endgames.js`;
  its game would then land in `funnel.no_raw_log`, which is 0 in all four runs, so no kept or wanted game was lost.
- **Sensitivity arm** `--keep-game-shape`: forfeit-before-action, short and partial bring recorded but not charged (the
  PORYGON2 v2 rule). bo3 38,534 kept, bo1 44,246.
- **Positions** are `solver/porygon2/v2/reveal.js` snapshots: the public state at each `|turn|n` line (displayed HP %,
  status, stages, volatiles, forme, mega, field, side conditions, and the open sheets in bo3).
- **Definitions** are in `lib.js` `DEFINITIONS` and copied into every output: alive = teamsize − fainted (an unseen
  brought member counts alive); E2 both ≤ 2; E4 total ≤ 4; E1 1v1; entry = the first such start-of-turn position.
- **Keys.** Seven colour-blind abstraction levels from the species matchup to the exact public state (DESIGN §1.3).
  The table question is answered by a chronological split: keys of the first 80% of entries by upload time, asked of
  the last 20%.
- **Action count.** A sheet-derived upper bound per side, target types read from the Reg M-C dex
  (`solver/human/dex.js`), mega read from `item.megaStone`. Not the engine's `legalActions` (OWED).
- **Runs.** Both formats and both arms, through `tools\lownode.cmd`, 2026-10-01. Outputs:
  `solver/out/dusk/endgames-{bo3,bo1}{,-allshape}.json` and `positions-*.jsonl.gz` (each game's E2 entry position: the
  start bank for the must-beat test). The headline was run three times on the same store files and gave identical counts each time.

### 1.2 The ladder measurement (`solver/dusk/measure_ladder.js`)

- Read-only over `solver/out/rotom/<run>/games/medicham32/*.{log,decisions.jsonl}` in the main checkout: runs `aa1`,
  `aa2`, `gen5ab`, `chomp1` (release `eaa5becc54eb` throughout). **`chomptop` started at 04:18Z today and was still
  live**, so it is excluded from every figure here (OWED).
- The same `reveal.js` + `lib.js` path on the server's own log; our chair from the `|player|` line. The opponent's action
  per turn and the "covered by a searched column" test are copied from the post-mortem's `postmortem.js`.
- Arms: the search arm is every game whose decisions carry a `miltank-*` policy (gen5ab arm A, chomp1); the prior arm is
  everything else (aa1, aa2, gen5ab arm B).

### 1.3 The combination (`solver/dusk/combine.js`)

Writes the tracked `solver/dusk/endgames-summary.json` and computes the conversion test: for each of our E2 entries,
the human bo3 win rate from the same material (ours v theirs) and summed-HP-lead bucket (≤ −100, −99..−50, −49..−25,
−24..−1, 0, 1..24, 25..49, 50..99, ≥ 100; buckets with ≥ 30 human entries) is the expectation; actual − expected is
bootstrapped over our games (4,000 resamples, seeded). Pooled over every human band; a both-rated-≥-1100 table gives the
same answer (−3.5 [−10.7, +3.8]).

### 1.4 Tests

`solver/tests/test-dusk-measure.js`: GREEN 42/42. It was run RED first under each deliberate break (`DUSK_BREAK=alive`
35/40, `DUSK_BREAK=colour` 33/40) and its CONTROL clause re-runs itself under both and requires a non-zero exit.

## 2. What endgames occur (bo3 unless marked)

### 2.1 Reach, timing, length

| | bo3 | bo1 |
|---|---|---|
| E2, clean corpus | 16,951 / 26,945 = **62.9%** [62.3, 63.5] | 18,733 / 29,119 = 64.3% |
| E2, every real game (sensitivity) | 16,959 / 38,534 = **44.0%** [43.5, 44.5] | 18,743 / 44,246 = 42.4% |
| E2 among games that ended normally (clean) | 73.6% | 75.7% |
| E4 / E1, clean | 80.4% / 15.7% | 81.2% / 18.4% |
| entry turn | median 7, p10 5, p90 10, p99 14 | median 7 |
| decisions left after entry, normal ends | mean 2.19; 1: 4,893; 2: 5,138; 3: 2,401; 4: 972; 5+: 728 | mean 2.39 |
| ended by forfeit after E2 entry | 16.1% | 18.7% |
| game length (all clean) | median 8 turns, p90 11 | — |

The clean corpus excludes a game in which some brought member never appeared; that is close to "the game ended
early", so the clean reach is conditioned upward. The sensitivity arm adds 11,589 bo3 games and only 8 E2 endgames.
**44% is the population answer; 63% is the answer for fully revealed games.**

By band (clean, min of the two ratings): <1100 63.6%, 1100–1199 62.2%, 1200–1299 60.6%, 1300–1399 64.5%, 1400–1499 52.6%
(50 of 95), unrated 63.3%. Flat; the top band is too small to read.

### 2.2 Material and who wins

| E2 entry material | share | P(side ahead wins) | ended by forfeit | decisions left, normal end (median / p90) |
|---|---|---|---|---|
| 2v2 | 59.0% | HP leader 64.1% (n 9,533) | 17.8% | 2 / 4 |
| 2v1 | 38.1% | **88.8%** [88.0, 89.6] | 14.2% | 1 / 3 |
| 1v1 | 2.9% | HP leader 71.6% (n 433) | 8.4% | 1 / 3 |

2v2 by the size of the HP lead (summed displayed %): 1–25 → 55.0%, 26–50 → 60.0%, 51–100 → 68.8%, > 100 → 85.3%.
E4 adds 3v1 (28.2% of E4 entries), won by the side ahead 97.0%. bo1: 2v1 ahead wins 84.0%, 2v2 HP leader 62.5%.
2v1 by band: 85.8–89.5% in every band with ≥ 150 entries.

### 2.3 The state at E2 entry

| | bo3 | bo1 |
|---|---|---|
| live members | 60,351 | 66,702 |
| mean HP / at full | 69.1% / 39.5% | 69.7% / 41.2% |
| any status | 3.8% (par 1.5%, brn 1.0%, slp 0.5%, psn 0.5%, tox 0.2%, frz 0.05%) | 4.1% |
| any stat stage | 26.9% | 26.1% |
| commonest volatiles | Perish count 562, Throat Chop 136, Encore 99, type change 86 | Perish 512, type change 246 |
| any field or side condition | 83.1% | 82.8% |
| terrain / weather | 58.1% (Grassy 38.8%, Psychic 18.9%) / 38.9% (Rain 13.5%, Sun 11.5%, Sand 9.2%, Snow 4.7%) | 53.3% / 43.3% |
| Trick Room / Tailwind (either) / screens | 10.3% / 13.5% / 6.2% | 12.8% / 12.5% / 9.1% |
| Trick Room age at entry (turns since set; dex duration 5) | 1: 182, 2: 393, 3: 507, 4: 666 | — |
| mega still available to a side | 28.2% | 30.3% |

Species in the most endgames (bo3, share of E2 entries containing it): Rillaboom 27.0%, Sneasler 21.1%, Incineroar
18.6%, Gholdengo 16.7%, Kingambit 15.3%, Arcanine-Hisui 14.2%, Basculegion 14.0%, Salamence-Mega 12.4%, Archaludon 7.9%,
Sylveon 7.8%, Golisopod-Mega 7.4%, Milotic 7.4%, Charizard-Mega-Y 7.4%, Farigiraf 7.3%, Raichu-Mega-Y 7.0%. The
commonest single species matchup occurs 10 times in 16,951.

The field's durations are read from the dex in the output (`trick_room_duration_from_dex` 5, Tailwind 4, screens 5).

### 2.4 Distinct states and the table question

As DESIGN §1.3. Chronological hit rate in the later 20% (3,391 bo3 entries): K0 17.0%, K0set 1.0%, K1q 0.8%, K1d 0.3%,
K2 0.06%, K3 0.06%, K3set 0. bo1 (3,747): K0 7.2%, K0set 0, K1q 0.6%. Half of all bo3 E2 entries need 6,249 species
matchups to cover them and 8,299 set matchups.

### 2.5 The size of the game DUSK must solve (sheet upper bound, bo3)

| material | actions per side, median (p90) | joint cells, median (p90, max) |
|---|---|---|
| 2v2 | 80 (120) | 6,000 (12,000; 57,600) |
| 2v1 | 20 (56) | 280 (432) |
| 1v1 | 4 (4) | 16 (16) |

bo1 counts are from revealed moves only and are not used.

## 3. What endgames cost us

### 3.1 The counts

As DESIGN §2. Additional detail:

- E4 (adds 3v1): reached in 133 of 189; ahead 29 → won 28; even 58 → won 21; behind 46 → won 1.
- Decisions inside E2: 197 of 1,337 move decisions (search arm 89 of 670); the turn before entry: 88 (search arm 38).
- Search-arm endgame decisions: 4×4 tables on every one (99 decisions), playouts median 471 (p10 133, p90 3,960), wall
  4.73 s median, 109 playouts per wall second median (p10 32, p90 859).
- The prior arm (no search) converted about as well as the search arm against the human expectation (−2.3 vs −1.4).

### 3.2 The 14 search-arm losses from an even E2 entry

From `endgames-summary.json` `ladder.losses_from_ahead_or_even_e2` (entry HP is the summed displayed %, ours v theirs):

| run | replay (id tail) | entry | HP | value at entry → later |
|---|---|---|---|---|
| chomp1 | …2690121468 | t6 2v2 | 109 v 190 | 0.277 → 0.036 |
| chomp1 | …2690128111 | t6 2v2 | 106 v 188 | **0.868** → 0.002 (our 6% Sneasler attacked into Protect) |
| chomp1 | …2690133981 | t8 2v2 | 129 v 128 | 0.072 → 0.699 → 0.016 … |
| chomp1 | …2690137512 | t7 2v2 | 200 v 161 | **0.524** → 0.057 → 0.003 |
| chomp1 | …2690142835 | t5 2v2 | 100 v 110 | 0.011 (our second body at 0% displayed) |
| gen5ab | …2688035918 | t6 2v2 | 82 v 78 | 0.026 … 0.183 → 0.062 |
| gen5ab | …2688037293 | t6 2v2 | 200 v 139 | 0.194 → **0.990** → 0.042 |
| gen5ab | …2688042008 | t8 2v2 | 94 v 200 | 0.211 → 0.070 |
| gen5ab | …2688042743 | t4 2v2 | 103 v 200 | 0.339 → 0.008 |
| gen5ab | …2688049677 | t11 2v2 | 43 v 198 | 0.064 |
| gen5ab | …2688063201 | t5 2v2 | 45 v 117 | 0.337 |
| gen5ab | …2688066421 | t7 2v2 | 188 v 200 | 0.127 → 0.081 → 0 (their Kingambit at +6 Attack) |
| gen5ab | …2688072061 | t9 1v1 | 28 v 56 | 0.045 … 0.053 |
| gen5ab | …2688078494 | t6 2v2 | 149 v 200 | 0.169 → 0.023 |

Three games are where an endgame solver could have mattered by the search's own reading: …2690128111 (0.868 at entry),
…2690137512 (0.524, and 200 v 161 HP), …2688037293 (0.990 a turn after entry, lost the next turn). The rest were
entered losing, and the search knew it. These three are the V-D3 / must-beat test's first hand-checked fixtures (OWED).

### 3.3 The conversion test

| expectation from | arm | games | won | expected | won − expected [95% CI] | per game |
|---|---|---|---|---|---|---|
| humans, all bands | all | 88 | 37 | 40.66 | −3.66 [−10.78, +3.59] | −0.042 |
| | search | 38 | 14 | 15.41 | −1.41 [−5.84, +3.23] | −0.037 |
| | prior | 50 | 23 | 25.25 | −2.25 [−7.58, +3.14] | −0.045 |
| humans, both ≥ 1100 | all | 88 | 37 | 40.54 | −3.54 [−10.67, +3.76] | −0.040 |

Caveats, stated: our opponents' ratings are not in the logs read here, so the human table is pooled; the expectation
conditions on material and HP only (not species, sets, field or who holds speed control); 88 games is a small sample.

## 4. Literature (verified 2026-10-01; DOIs through Crossref, arXiv ids through the arXiv API, READMEs fetched)

| Work | What DUSK takes from it |
|---|---|
| Thompson 1986 (ICCA J. 9(3):131–139); Nalimov, Haworth & Heinz 2000 (ICGA J. 23(3):148–162); Schaeffer et al. 2007 (Science 317:1518–1522) | Retrograde analysis pays when the endgame space is complete, small and identical across games. Measured here: none of the three holds (§2.4). Not adopted. |
| Syzygy (`syzygy1/tb` README) | WDL tables are probed during search, DTZ only at the root. DUSK's split: a value band as a probe inside MILTANK, the strategy only at an E2 root. |
| Shapley 1953 (PNAS 39(10):1095–1100) | Stochastic games have a value; value iteration converges. DUSK uses it on the cyclic memo graph (healing, repeat Protect) with a horizon. |
| Bošanský, Lisý, Lanctot, Čermák, Winands 2016 (AIJ 237:1–40) | Backward induction with a matrix game at each node, and its double-oracle variant (DOBI), for two-player simultaneous-move games. DUSK's core. |
| Saffidine, Finnsson & Buro 2012 (AAAI 26:556–562) | Alpha-beta bounds for simultaneous moves via LPs over child bands. DUSK's pruning. |
| Lanctot, Lisý & Winands 2014 (CCIS 408); Lisý, Kovařík, Lanctot & Bošanský 2013 (NeurIPS, arXiv:1310.8613) | Simultaneous-move MCTS and when it converges. The alternative to exact backward induction; DUSK keeps MILTANK as the sampled fallback rather than adding a second sampler. |
| Bošanský, Kiekintveld, Lisý & Pěchouček 2014 (JAIR 51:829–866) | Double oracle for exact equilibria without enumerating the whole menu. |
| Ballard 1983 (AIJ 21(3):327–350); Hauk, Buro & Schaeffer 2006 (LNCS 3846:35–50) | Chance nodes with bounds (*-minimax): a chance node's band is the weighted band of its children. DUSK's band arithmetic. |
| Moravčík et al. 2017 (Science 356:508–513); Brown & Sandholm 2017 (arXiv:1705.02955) and 2018 (Science 359:418–424); Burch, Johanson & Bowling 2014 (AAAI 28); Ganzfried & Sandholm 2015 (AAMAS) | Endgame and subgame solving under hidden information, with the safety question of re-solving against a blueprint. At a Reg M-C endgame the only hidden information is the opponent's spreads (sheets are open), so DUSK's form is the simpler one: a Bayesian root over spread classes, no blueprint. |
| Schmid et al. 2023, Student of Games (Sci. Adv., doi:10.1126/sciadv.adg3256) | Public-belief-state search, the frame PokaiTrainer adapts. |
| Frank & Basin 1998 (AIJ 100:87–123); Long, Sturtevant, Buro & Furtak 2010 (AAAI 24:134–140) | Strategy fusion: averaging over worlds lets a player act as if it knew the world. DUSK v0's per-class averaging has it on the opponent's side; v1 removes it at the root. |
| Hart & Mas-Colell 2000 (Econometrica 68(5):1127–1150) | Regret matching (SLOWKING's RM+); DUSK uses SLOWKING's exact LP instead, because endgame matrices after double oracle are small. |
| PokaiTrainer (Yu 2026, arXiv:2608.29197) [REPORTED] | Its engine enumerates a joint action's weighted outcome distribution in one pass; on 33 late-endgame roots with certified value bands, budgeted solves landed inside the band for every network ("search absorbs leaf error where the horizon is short"); the certificate is an exact solve whose leaves are refilled with 0 and ±1. DUSK adopts the certificate. |
| PokéChamp (arXiv:2503.04094), Metamon (arXiv:2504.04395), poke-engine README | Singles engines and agents: depth-limited minimax/expectiminimax (poke-engine's `generate-instructions` lists a turn's weighted outcomes), LLM-guided minimax, and search-free offline RL. None publishes an endgame solver; none is doubles. |

No community endgame tool for doubles was found: an arXiv title/abstract search for Pokémon endgame work returned
nothing beyond the agents above.

## 5. Design rationale (the short version of DESIGN §3)

- **Exact state, enumerated chance.** The weighted-chance report measured that bucketing a die by consequence is
  biased (a 12.7% survival enumerated as 0); chance.js's stratified sampling with the strata at the engine's own
  thresholds is unbiased and is exact where a stratum is pure. DUSK reuses it rather than writing a second enumerator.
- **Cost, honestly.** On general positions one enumerated joint pair costs a median 138 stepped turns (coarse) and
  1,721 (exact). A 2v2 node at the sheet bound (6,000 cells) is therefore out of reach at any clock without double
  oracle and the MAG v2 dead-click gate; 1v1 (16 cells) and 2v1 (280) are where DUSK starts. The endgame turn draws
  fewer dice than the general positions measured there, so the per-pair cost should fall; it is not measured (OWED).
- **Speed ties.** chance.js samples the tie die because it cannot be bisected. A node with a sampled tie is never
  certified until ENGINE exposes the tie at the point it is resolved.
- **The clock** is the largest lever: about 420 s of bank and two decisions left at entry.
- **History, not evidence.** A Reg M-B DUSK size gate (`docs/SOLVER.md`, archived half, 2026-08-06,
  `engine/dusk_size_gate.js`) also rejected a memoised tablebase. It measured a retired regulation; none of its figures
  is used or compared here, and the Reg M-C verdict above stands on its own measurement.

## 6. The must-beat test, drafted (NOT RUN)

As DESIGN §5: gen5 + DUSK at every E2 decision against gen5, equal wall-clock (5 s, then the adaptive endgame clock),
starts drawn from `positions-bo3.jsonl.gz` TEST-split players and stratified to the measured material mix, each start
played twice with seats swapped, role-v1 spreads, honest information, SPRT elo0 0 / elo1 +20 / α = β = 0.05, read once
at the bound, on a frozen release ≥ `eaa5becc54eb` with `--team-store data/team-pool-frozen-regmc` and the census pin.
A feasibility gate (V-D5) runs first. Will launches it.

## 7. Files

| File | Tracked | What |
|---|---|---|
| `solver/dusk/DESIGN.md` | yes | the design |
| `solver/dusk/lib.js` | yes | predicate, keys, action bound, summary statistics |
| `solver/dusk/measure_endgames.js` | yes | the store measurement |
| `solver/dusk/measure_ladder.js` | yes | the ladder measurement |
| `solver/dusk/combine.js` | yes | the tracked summary and the conversion test |
| `solver/dusk/smogon_foldin.js` | yes | the Smogon hook report (prints NOT PUBLISHED today) |
| `solver/dusk/endgames-summary.json` | yes (~150 KB) | every number above |
| `solver/tests/test-dusk-measure.js` | yes | GREEN 42/42; RED under both breaks |
| `solver/out/dusk/*` | no | full outputs and the E2 position banks (~5 MB each) |

## OWED, NOT RUN

1. **The Smogon fold-in.** September 2026's Reg M-C files were not published on 2026-10-01 (the stats index lists
   months to 2026-08; August holds no Reg M-C file). When they are out (expected about 2026-10-04; a scheduled task
   also checks):
   `ABRA_REGULATION=regmc node engine/fetch_smogon_stats.js 2026-09` (from the main checkout), then
   `node solver/dusk/smogon_foldin.js` → `solver/out/dusk/smogon-foldin.json` (spread concentration for the 15 commonest
   endgame species), then fold the spread prior into the world-class count measurement (item 5).
2. **The `chomptop` run.** Live during this measurement (started 2026-10-01 04:18Z). When it ends:
   `node solver/dusk/measure_ladder.js` (all runs) then `node solver/dusk/combine.js`, and restate §3 with it.
3. **The exact action count**: MEDICHAM `legalActions` on boards built from the E2 positions, against the sheet bound.
4. **D0, the positions-to-boards builder** (E2 entries from real logs into MEDICHAM bodies at role-v1 spreads, HP from
   the displayed %), and **V-D5's feasibility bench** at 5 s and 50 s. This also measures the per-pair chance cost on
   endgame turns (the 138 / 1,721 stepped-turn figures are from general positions).
5. **World classes per endgame**: how many consequence classes XATU's worlds fall into for the bodies on the field.
   It decides whether the Bayesian root (D5) is cheap.
6. **ENGINE capability requests (not defects; for the coordinator to route, not filed in `docs/ENGINE.md`)**: each die
   reporting its outcome classes, and the speed tie exposed where it is resolved.
7. **V-D1 to V-D4** (DESIGN §4) and the three hand-checked fixtures from §3.2.
8. **The must-beat SPRT** (§6). Will's call.
9. **`node engine/status.js --write`** from the main checkout after this branch is merged (a worktree must not run it).
