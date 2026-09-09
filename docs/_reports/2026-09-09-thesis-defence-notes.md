# Thesis defence 2026-09-09 — receipts and commands

Companion to `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md`. Historical record, never maintained. Every
figure in the review traces to one of the entries below. HEAD at the time: `d6789951` (2026-09-09
11:53 -0400). No file under `data/` was written; no game was played; `engine/status.js` was not run.

## Gate reading (not run — read)

- `docs/MEASURE.md:13-30` generated block, stamped 2026-09-09 08:09: "MEDICHAM is not correct — 1 of
  9 gate clauses fail (whole-game differential / NARRATION)"; leaf calibration, leaf/engine contrast,
  click censoring, weights all QUARANTINED; REFIT OWED.
- `data/open-work.json` (generated 2026-09-09T15:59:34Z): `counts` = register_rows 512, open 220,
  closed 292, open_asserting_breakage 52, measured_disagreements 0, unregistered 0.
- `data/provenance-stamp.json` (generated 2026-09-09T16:11:48Z): `mtime_only` 179, `void_files`
  [exploitability.json, medicham-bench.json], graph_files 255, no_writer_files 49.

## Artifact fields read (path:field = value)

| receipt | value |
|---|---|
| `data/war.json:generated` | 2026-07-28 |
| `data/war.json:n_games / n_species / min_games` | 3663 / 167 / 30 |
| `data/war.json:ridge / ridge_legacy` | 200.0 / 6.0 |
| `data/war.json:ridge_selection.criterion` | "held-out log-loss, minimised over a grid (same method as engine/fit_policy.js)" |
| `data/war.json:ridge_selection.sweep[ridge=200].log_loss` | 0.69358 (minimum of 11) |
| `data/war.json:ridge_selection.ordering_stability[ridge=0].spearman_vs_selected` | 0.9655 |
| `data/war.json:held_out` | log_loss 0.6936, coin 0.6931, accuracy 0.504 |
| `data/war.json:verdict` (first clause) | "WORSE THAN A COIN AT EVERY REGULARISATION STRENGTH TESTED." |
| `data/nmf-rank-selection.json:generated / bootstrap_pairs / iters` | 2026-07-28T13:43:18 / 6 / 300 |
| `data/nmf-rank-selection.json:results[rank=4]` | stability 0.9992, null 0.9217, excess +0.0775 |
| `data/nmf-rank-selection.json:results[rank=6]` | stability 0.8148, null 0.9218, excess −0.1070 |
| `data/nmf-rank-selection.json:results[rank=3] / [rank=5]` | excess −0.0788 / +0.0248 |
| `data/nmf-rank-selection.json:matrix` | rows 7330, cols 46 |
| `data/nmf-roles.json:generated / archetype_rank / archetype_recon_error / rank / n_documents / n_moves / reconstruction_error_ratio` | 2026-08-04 / 6 / 0.682 / 10 / 14808 / 263 / 0.8356 |
| `data/nmf-roles.json:archetypes[].id,prevalence,top_roles[0]` | A1 0.225 wall 0.256; A2 0.216 phys_attacker 0.46; A3 0.176 spread 0.556; A4 0.165 debuff 0.68; A5 0.112 setup 0.625; A6 0.106 fakeout 0.63 |
| `data/roles-eval.json:generated / n_games / n_train / n_test` | 2026-07-31 / 5269 / 4192 / 1073 |
| `data/roles-eval.json:log_loss` | roles 0.6935, rating_baseline 0.6967, coin 0.6931 |
| `data/roles-eval.json:role_logloss_ci` | [0.6885, 0.6986] |
| `data/role-matchups.json` (computed) | 1101 cells with n, median n = 74, n_games 5269, generated 2026-07-31 |
| `data/guru-matchups.json:n_games / n_archetypes / n_decisive` | 5265 / 12 / 6 (directed) |
| `data/guru-matchups.json:decisive_matchups[0]` | Charizard-Garchomp vs Trick Room p 0.66 ci [0.526, 0.773] n 53 |
| `data/guru-matchups.json:predictive_test` | test_games 1053, matchup_prior 0.7124, coin 0.6931, usage 0.6928, winner_pick 0.4982 |
| `data/guru-matchups.json:archetypes` | Charizard-Garchomp, Garchomp-Incineroar, Gengar-Incineroar, Incineroar-Whimsicott, Kingambit-Garchomp, Kingambit-Sneasler, Other, Pelipper-Archaludon, Sableye-Aerodactyl, Sand, Trick Room, Whimsicott-Garchomp |
| `data/archetypes.json:n_games / k_selected / silhouette` | 19978 / 12 / 0.126; names Sableye-Grimmsnarl, Trick Room, Whimsicott-Staraptor, Pelipper-Archaludon, Garchomp-Tyranitar, Incineroar-Gengar, Kingambit-Basculegion, Sinistcha-Incineroar, Sand, Charizard-Garchomp, Whimsicott-Charizard, Kingambit-Staraptor |
| `git log -- data/archetypes.json` | `1ffa031f` 2026-08-25 "The archetype counts, regenerated against a larger store by a run nobody claimed" |
| `data/chomp-ev.json:n_total_games / n_human_games / n_eval_games / n_train / n_test` | 30934 / 5618 / 5509 / 4407 / 1102 |
| `data/chomp-ev.json:headline_beat_test` | p 0.5123, ci95 [0.4997, 0.5246] |
| `data/chomp-ev.json:proper_score_logloss` | chomp_align 0.6921 [0.6904, 0.6937]; belief 0.6924 [0.6911, 0.6937]; xatu_context 0.6923; coin 0.6931; elo 0.6921; usage 0.6926 |
| `data/chomp-ev.json:brier` | chomp 0.2495, coin 0.25 |
| `data/chomp-ev.json:selection_audit` | eval_mean_turns 8.12, **excluded_mean_turns null, n_qualifying 5618, n_excluded_human 0** |
| `data/chomp-ev.json:robustness_no_forfeits` | p 0.5082 [0.4937, 0.5223], logloss 0.6926 vs coin 0.6931 |
| `data/bring-bias.json:generated / pool_games / retained_games / retained_share` | 2026-07-28 / 3865 / 2860 / 0.74 |
| `data/bring-bias.json:mean_abs_shift_points / max_abs_shift_points / species_tested / species_raw_z_over_2 / species_surviving_bh / expected_false_positives` | 1.5447 / 4.9413 / 84 / 12 / 0 / 4.2 |
| `data/slowking-eval.json:exploitability` | nash 0.0001, greedy 0.041, uniform 0.0761, greedy_minus_nash 0.0409 ci95 [−0.0001, 0.1735] |
| `data/slowking-eval.json:top_nontransitive_cycle` | Charizard-Garchomp → Kingambit-Garchomp → Incineroar-Whimsicott, legs n 49/37/15, supported false, 1320 triples |
| `data/slowking-eval.json:verdict` (opening) | "SLOWKING's equilibrium is substantially less exploitable, though sparse matchups keep the 95% CI lower bound near 0 (-0.0001)…" |
| `data/slowking-playstyle-eval.json:top_nontransitive_cycle` | TailwindOffense → Sand → TrickRoom, legs n 40/5/140, supported false, 336 triples; gap 0.026 ci [−0.0001, 0.1498] |
| `data/playstyle-matchups.json:matrix.Rain.Sun` | p 0.538, lo 0.466, hi 0.609, n 182; n_games 2860 |
| `data/policy-eval.json` (2026-07-30) | species_only_clone top1 0.2979 [0.2914, 0.3045], top3 0.6564, CE 2.6353; baselines global_move_freq_ce 4.7346, uniform_moveset_ce 3.0286 |
| `data/pory-eval.json:log_loss` | pory 0.6236 [0.607, 0.6387], coin 0.6931, material_two_feature 0.623623; paired diff +0.000001 ci [−0.000026, 0.000029] clustered by game, n_test_games 1177 |
| `data/pory-nn.json:arms` | B0 coin 0.6931; B2 alive+hp 0.6229; LR rich 0.6064 (THEORY.md:91 says 0.5473 vs 0.5748 — not in this artifact) |
| `data/quality-filter.json:version / updated` | 1.3.0 / 2026-08-27; changelog 1.2.0: "EVERY number computed on a clean corpus before this date … needs re-running" |
| `data/quality-filter.json:rules.require_full_bring.known_limitation` | "…'the bring, among games long enough to show it'… State it that way." |
| `data/smogon-priors.json` | `teammates` field present (per-species co-occurrence list) |
| `data/damage-validation.json` (via white paper `:1560`) | 36 scenarios, within 5% on 100% — not re-read this pass |

## Store-digest scan

```
node -e "<scan data/*.json for /store_digest|store_sha|games_digest|game_ids|corpus_digest|source_digests|input_digest|store_content_digest/i>"
```
Result: 56 files carry some digest field (engine-release stamps), 179 do not. All of: war.json,
nmf-roles.json, nmf-rank-selection.json, guru-matchups.json, roles-eval.json, chomp-ev.json,
archetypes.json, slowking-eval.json, meta-usage.json, bring-priors.json, bring-bias.json,
quality-filter.json → "no store digest". `data/skill-variance.json`, `data/predictability.json`,
`engine/skill_variance.py` → do not exist.

## GURU multiplicity (computed)

```
node -e "<over data/guru-matchups.json:matrix, unordered pairs, Wilson + exact two-sided binomial>"
```
66 unordered cells; 53 with n ≥ 30; 3 decisive at 95%; expected false positives 0.05 × 53 = 2.65.
Smallest p-values: Kingambit-Sneasler vs Sableye-Aerodactyl 59/91 p=0.0061; Charizard-Garchomp vs
Trick Room 35/53 p=0.027; Gengar-Incineroar vs Sableye-Aerodactyl 41/66 p=0.064. Bonferroni α =
0.05/53 = 9.4e-4; BH rank-1 threshold 9.4e-4. Zero survive. Hand Wilson k=35 n=53 → [0.526, 0.773].

## Baseline arithmetic (computed)

- Wilson at n=5509, p̂=0.5123 → [0.4990, 0.5254] vs artifact bootstrap [0.4997, 0.5246].
- H(q) = −(q ln q + (1−q) ln(1−q)): H(0.5)=0.6931, H(0.52)=0.6923, H(0.55)=0.6881.
- p1 base rate measured 0.5045 → H = 0.69311; ln 2 = 0.69315.

## Bring-rate selection bias — the one store pass run this defence

Script (scratchpad `bring_bias_pass.js`, reproduced in full so it can be re-run), executed as
`cmd /c tools\lownode.cmd <path>\bring_bias_pass.js > out.json` (BELOWNORMAL). Runtime ≈ 30 s.

```js
'use strict';
const fs = require('fs'), rl = require('readline');
const STORE = 'C:/Users/willj/Projects/Pokemon/ABRA/data/games.bo3.jsonl';
const st = fs.statSync(STORE);
const seen = new Set();
let lines = 0, dup = 0, bot = 0, noSix = 0, noWinner = 0, kept = 0;
let fullBoth = 0, turnsFull = 0, turnsAll = 0, p1wAll = 0, p1wFull = 0, forfeitAll = 0;
const six = new Map(), brFull = new Map(), sixFull = new Map(), brAny = new Map();
const rd = rl.createInterface({ input: fs.createReadStream(STORE) });
rd.on('line', line => {
  if (!line.trim()) return; lines++;
  let g; try { g = JSON.parse(line); } catch (e) { return; }
  if (seen.has(g.id)) { dup++; return; } seen.add(g.id);
  if ((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot)) { bot++; return; }
  const s1 = g.six && g.six.p1, s2 = g.six && g.six.p2;
  if (!s1 || !s2 || s1.length !== 6 || s2.length !== 6) { noSix++; return; }
  const y = g.winner === g.p1.name ? 1 : g.winner === g.p2.name ? 0 : null;
  if (y === null) { noWinner++; return; }
  kept++;
  const b1 = (g.brought && g.brought.p1) || [], b2 = (g.brought && g.brought.p2) || [];
  const nt = (g.turns && g.turns.length) || 0;
  const full = b1.length === 4 && b2.length === 4;
  turnsAll += nt; p1wAll += y; if (g.forfeit) forfeitAll++;
  if (full) { fullBoth++; turnsFull += nt; p1wFull += y; }
  for (const [s, b] of [[s1, b1], [s2, b2]]) {
    const bs = new Set(b);
    for (const sp of s) {
      six.set(sp, (six.get(sp) || 0) + 1);
      if (bs.has(sp)) brAny.set(sp, (brAny.get(sp) || 0) + 1);
      if (b.length === 4) { sixFull.set(sp, (sixFull.get(sp) || 0) + 1); if (bs.has(sp)) brFull.set(sp, (brFull.get(sp) || 0) + 1); }
    }
  }
});
rd.on('close', () => {
  const out = { store: STORE, store_bytes: st.size, store_mtime: st.mtime.toISOString(), lines, dup, dropped_bot_flag: bot, dropped_no_six: noSix, dropped_no_winner: noWinner,
    games_kept_unfiltered: kept, games_both_full_bring: fullBoth, share_full_bring: +(fullBoth / kept).toFixed(4),
    mean_turns_unfiltered: +(turnsAll / kept).toFixed(2), mean_turns_full_bring: +(turnsFull / fullBoth).toFixed(2),
    p1_win_rate_unfiltered: +(p1wAll / kept).toFixed(4), p1_win_rate_full_bring: +(p1wFull / fullBoth).toFixed(4),
    forfeit_share_unfiltered: +(forfeitAll / kept).toFixed(4) };
  const rows = [...six.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([sp, n]) => {
    const nf = sixFull.get(sp) || 0, kf = brFull.get(sp) || 0, ka = brAny.get(sp) || 0;
    return { species: sp, n_six_all: n, bring_rate_unfiltered: +(ka / n).toFixed(4), n_six_full: nf, bring_rate_full: +(kf / nf).toFixed(4), diff_points: +((kf / nf - ka / n) * 100).toFixed(2) };
  });
  out.top25_by_usage = rows;
  const diffs = rows.map(r => r.diff_points); out.mean_diff_points_top25 = +(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(2);
  out.max_abs_diff_points_top25 = +Math.max(...diffs.map(Math.abs)).toFixed(2);
  console.log(JSON.stringify(out, null, 1));
});
```

Output (sample definition: `data/games.bo3.jsonl`, 227,347,410 bytes, mtime 2026-09-04T05:30:48Z,
25,522 lines, 0 duplicate ids; bot-flag rule only — behavioural-bot, forfeit, min-turns and illegal-team
rules NOT applied):

| | value |
|---|---|
| dropped: bot flag / no six / no winner | 70 / 0 / 17 |
| games kept, unfiltered | 25,435 |
| games with both sides' brought == 4 | 17,552 (69.01%) |
| mean turns, unfiltered / full-bring | 6.74 / 7.81 (ratio 1.159) |
| p1 win rate, unfiltered / full-bring | 0.5045 / 0.5038 |
| forfeit share, unfiltered | 0.3454 |
| top-25 species: mean bring-rate shift under the filter | +4.44 points (all 25 positive) |
| max shift | +8.19 (basculegion 0.6612 → 0.7431, n 13,627 → 10,921) |

Per species (n_six_all, rate_unfiltered, n_six_full, rate_full, shift): kingambit 20776 .5922 16213
.6578 +6.56 · garchomp 16058 .6559 12977 .7197 +6.38 · incineroar 14735 .6573 11913 .7079 +5.05 ·
basculegion 13627 .6612 10921 .7431 +8.19 · charizard 12376 .6231 10073 .6563 +3.32 · sneasler 12262
.7250 9732 .7678 +4.28 · whimsicott 11707 .7244 9367 .7529 +2.85 · sinistcha 10392 .5936 8288 .6525
+5.89 · farigiraf 9613 .6741 7451 .7136 +3.95 · staraptor 9483 .5827 7390 .6051 +2.24 · sylveon 8831
.5842 6920 .6432 +5.90 · floetteeternal 8298 .5241 6692 .5511 +2.70 · raichu 7279 .6344 5691 .6644
+3.00 · venusaur 5834 .5321 4892 .5628 +3.07 · delphox 5598 .5016 4443 .5309 +2.93 · tyranitar 5223
.7392 4238 .7961 +5.69 · aerodactyl 5012 .5910 3992 .6117 +2.07 · archaludon 4984 .7205 4229 .7754
+5.49 · gholdengo 4899 .5697 3867 .6224 +5.27 · pelipper 4868 .8024 4138 .8598 +5.75 · milotic 4412
.5854 3460 .6243 +3.88 · grimmsnarl 3695 .6341 3145 .6642 +3.01 · swampert 3501 .6210 2986 .6554
+3.44 · dragonite 3436 .5230 2718 .5636 +4.07 · excadrill 3388 .5998 2718 .6611 +6.14.

Caveat stated in the review: "unfiltered" counts a species as brought only when the replay revealed
it, so its rate is a lower bound and the shift is an UPPER bound on the selection bias;
`data/bring-bias.json`'s post-stratified 1.54-point mean is the lower estimate.

## Code lines read

- `engine/war.py`: `RIDGE = 6.0` retained as legacy; `split()` = id hash `% 5 == 0` (20% test); GRID
  comment "Extended past 50 after the first sweep selected the largest value on the grid"; λ chosen by
  `min(sweep, key=log_loss)` on `test`; `fit_ridge` = 300 iters full-batch GD, lr 0.3, no convergence check.
- `engine/nmf_roles.py`: `ARCH_RANK = 6`; `RANK` default 10 for the move cut; multiplicative updates,
  seed 7, 300/400 iters.
- `engine/nmf_rank.py`: RANKS 2..12, PAIRS 6, greedy cosine matching, shuffled-data null.
- `engine/roles.py:371` `PRESENT_AT = 0.50`; `:428-436` `team_roles` noisy-OR; `:474-494` soft
  role-difference features, id-hash split; `:540-548` bootstrap of per-row losses, rng 7, 600 draws;
  52 entries in `ROLE_SIGNALS` (regex count).
- `engine/guru.py`: `split=int(len(rows)*0.8)` temporal on file order; matrix from ALL rows;
  decisive = n ≥ 30 and Wilson excludes 0.5; `assign()` = best overlap ≥ 1 with a 4-species core.
- `engine/chomp_ev.js:118` `if (!CLEAN.has(g.id)) continue;` precedes the qualify test at `:128-129`;
  `:271-273` temporal 80/20; `:315-326` game-level bootstrap; `:416` verdict requires sign CI > 0.5 AND
  log-loss CI < coin.
- `engine/slowking_preview.py:191-209`: "KNOWN DEFECT … treat both intervals as unusable rather than
  as evidence"; replicates at iters=1000 vs point estimate 15000; `:235-236` verdict strings.
- `engine/archetypes.py`: K bounded by sqrt(N/MIN_CELL), MIN_CELL 30, chosen by centroid silhouette proxy.
- `engine/predictability.py`: prints; no `json.dump`; no output artifact.
- `tools/lownode.cmd`: `start /B /BELOWNORMAL /WAIT node …`, exit code propagated.

## Living-document lines cited

`docs/ABRA-whitepaper.md`: 1370-1487 (§0), 1491-1495 (§1 ceiling), 1667-1672 (GURU), 1674-1679
(XATU), 1681-1687 (PORY; 1685 "the thesis, demonstrated"), 1688-1704 (CHOMP-EV; 1691 "1,205 games";
1697-1699 audit figures), 1705 (multiplicity), 1707 (bring phrasing), 1716-1729 (SLOWKING; 1720 "13
species-archetypes"; 1721-1727 cycle; "Rain vs Sun is 51% (n=236)"), 1732 (Wilson), 1766 (Hart &
Mas-Colell), 1795-1800 (55.9 / 48.1), 1912-1932 (references), 1945 ("26 functional roles"), 1954
(median cell n=20 / 1,051), 1968-1970 (WAR), 1978 ("error 0.53"), 1981-1983 (topic coherence "next"),
1986 ("WAR barely clears it").
`docs/MODELS.md`: 1405 (policy clone 35.9/71.6), 1494-1506 (GURU null + family), 1585-1591
(SLOWKING), 1715 (roles median n=20), 1773-1792 (WAR withdrawal, 1,061 games / 0.7048), 1798 (NMF 0.53,
coherence next).
`docs/SUMMARY.md`: 1296 (GURU), 1297 (XATU 36/72), 1298 (PORY), 1300 (SLOWKING), 1309 (ROLES 26 /
n=20), 1310 (WAR), 1311 (NMF caveat), 1315 (bring phrasing).
`docs/ROLE-FAMILY.md`: 25 (26 roles), §3 WAR ("beats the rating baseline (0.6905)"), 81 (six
archetypes, 0.53), §4 table, 98 ("WAR only edges it"), 103 (coherence), 109 ("Rosenbaum-style RAPM").
`docs/PUBLICATION.md`: item 9 (NMF caveat), item 5 (cycle "suggestive").
`docs/THEORY.md`: 91 (PORY 0.5473 vs 0.5748), 98 (31/31 within 2%).
`docs/SLOWKING-whitepaper.md`: §1 item 1 (v1.1 correction), §10 (novelty claim), ref 8 (VGC-Bench title).
`docs/STUDY-DESIGN-skill-vs-luck.md`: §6 deliverable `engine/skill_variance.py → data/skill-variance.json`;
committed `c396ccb0` 2026-07-24.
`docs/ROADMAP.md`: #288 (line 1137), #57 (1308, shelved), #547 (1441).
`docs/MEASURE.md`: 5337 (71.6% stop-and-ask).

## git history read

- `git log -- engine/war.py engine/roles.py engine/guru.py engine/nmf_roles.py engine/chomp_ev.js`:
  20 commits 2026-07-24 → 2026-08-06 (generators edited repeatedly against a fixed hash split).
- `git log -- data/{war,nmf-roles,nmf-rank-selection,guru-matchups,roles-eval,chomp-ev,archetypes,slowking-eval}.json`:
  last data-only touches 2026-08-27 (`61f523a7`) and 2026-08-28 (`96f2b716`); artifacts' own
  `generated` fields are the dates used above.

## OWED, NOT RUN

Nothing that writes into `data/` was run (seven agents live; one running the full suite; quarantine
stands). Each of these is a store-derived generator and each rewrites its artifact unconditionally,
so run ONE AT A TIME through the wrapper and diff against `git show HEAD:<artifact>` before trusting:

```
cmd /c tools\lownode.cmd engine\chomp_ev.js
python engine/war.py
python engine/roles.py
python engine/nmf_roles.py
python engine/nmf_rank.py
python engine/archetypes.py
python engine/guru.py
python engine/slowking_preview.py
set TAG=playstyle&& set MATRIX_FILE=data/playstyle-matchups.json&& python engine/slowking_preview.py
cmd /c tools\lownode.cmd engine\bring_bias.js
cmd /c tools\lownode.cmd engine\bring_priors.js
python engine/eval_policy.py
python engine/pory.py
python engine/predictability.py > docs/_reports/2026-09-09-predictability.txt
```

Do not run until each generator stamps a store digest (#288) — otherwise the re-run is a new
unstampable number replacing an old one. Order: land #288 first, pin the store, then the list above,
then `node engine/status.js --write`.

Additional analyses owed by the review (new code, not re-runs):

```
# WAR three-way split: add a validation partition (h % 10 in {0}) for lambda, report test (h % 10 in {1}) once
python engine/war.py                       # after the split change
# CHOMP-EV audit: move the CLEAN gate below the qualify test, or build audExcl from quality.js loadGames({clean:false})
cmd /c tools\lownode.cmd engine\chomp_ev.js
# SLOWKING: replicates at the point estimate's iteration count (B=100 at iters=15000, ~15x current)
python engine/slowking_preview.py
# noisy-OR check: for each role r, P_direct(team has r) over observed sixes vs 1 - prod(1 - p_i); publish the signed gap
# skill-variance study: engine/skill_variance.py -> data/skill-variance.json per docs/STUDY-DESIGN-skill-vs-luck.md §4-6
# bring-bias magnitude: write mean_turns_kept / mean_turns_dropped and the per-species shift table into data/quality-filter.json or data/bring-bias.json from a pinned pass (the script above is sufficient)
```
