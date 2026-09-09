# ABRA — thesis defence, 2026-09-09

**Third defence.** The 2026-07-27 committee returned MAJOR REVISIONS; the 2026-07-31 committee
returned PASS WITH MINOR REVISIONS with one blocking item and three reporting items. This defence
examines the work as RESEARCH against the current tree, checks whether each July demand was met, and
grades the store-derived results on their own artifacts.

Every number below was produced by running something during this defence or read out of a named
artifact field, with the command or `path:field` beside it. **This is a dated record, not current
state.** Defended against commit `d6789951` (2026-09-09 11:53 -0400). Companion notes with every
command and raw output: `docs/_reports/2026-09-09-thesis-defence-notes.md`.

**Quarantine, honoured.** `docs/MEASURE.md:18` (generated block, stamped 2026-09-09 08:09) reads
*"MEDICHAM is not correct — 1 of 9 gate clauses fail (whole-game differential / NARRATION)"*;
`data/open-work.json:counts` (generated 2026-09-09T15:59Z) reads 220 open rows, 0 measured
disagreements. Every figure downstream of the simulator — MAG, MILTANK, DODUO, PORYGON2, GARY,
exploitability, the policy weights, R1–R4, leaf calibration — is **withheld** here. Their METHODS are
evaluated; their results are not quoted. No game was played for this review.

---

## Verdict: **MAJOR REVISIONS**

The blocking item from July — the NMF rank — is not merely unresolved; the artifact was **regenerated
at the undefended rank four days after that defence** (`data/nmf-roles.json:generated` = 2026-08-04,
`archetype_rank` = 6) and the white paper still justifies it with the number its own script says
cannot justify it. Beyond that, the store-derived layer — the only layer this thesis can currently
publish — carries **at least twelve figures in the white paper that disagree with the artifact the
sentence cites** (enumerated in §2–§3: WAR score, NMF error, XATU, CHOMP-EV n, CHOMP-EV audit, GURU
log-loss, SLOWKING archetype count, uniform exploitability, the cycle, Rain vs Sun, the median role
cell, the role count), one "measured" selection audit that structurally measured zero games, a regularisation
parameter selected on the same partition its score is reported on, and confidence intervals the
generator itself annotates as *"unusable"* still quoted as evidence. Not one store-derived artifact
records which games it was computed on. The headline metric of the thesis (§0, exploitability) has
no value.

The measurement culture that the July committee praised is real and has improved further (frozen
releases, prediction cards written before runs, a derived retraction registry, BH corrections in
three generators). But **the claimed contribution of this thesis is measurement discipline, and the
failures below are failures of measurement discipline.** A committee cannot pass a thesis on the
strength of the part it says it is best at when that is precisely where the defects are.

---

## 0. The July demands, one by one

| July 31 demand | status | receipt |
|---|---|---|
| 1. Resolve the NMF rank (ship 4, or state in SUMMARY + white paper that 6 ships below null; remove "recon-err 0.53") | **UNMET.** Rank 6 still ships (`engine/nmf_roles.py` `ARCH_RANK = 6`); artifact regenerated 2026-08-04 at rank 6. `docs/SUMMARY.md:1311` and `docs/PUBLICATION.md` item 9 carry the caveat; `docs/ABRA-whitepaper.md:1978` still reads "(error 0.53)", `:1981-1983` still says topic coherence is "the next refinement"; `docs/MODELS.md:1798` and `docs/ROLE-FAMILY.md:81,103` identical. | `data/nmf-rank-selection.json:shipped_rank.excess_over_null` = −0.107; `most_reproducible.rank` = 4 |
| 2. Multiplicity correction on the 56 weights, family named | **MET, then quarantined.** `engine/weight_multiplicity.js` exists; white paper `:1705` states the family. The weights are downstream of MEDICHAM, so the figure is withheld. | `docs/ABRA-whitepaper.md:1705` |
| 3. Reconcile 48.1% vs 55.9% | **MET as a paragraph** (`:1800`), which itself says "The difference is not explained." Both figures are now quarantined. | `docs/ABRA-whitepaper.md:1800` |
| 4. Bring-statistic phrasing in the documents that report bring statistics | **MET** in the white paper (`:1707`) and SUMMARY (`:1315`); the magnitude was withdrawn at 5.259.0 and none is published. Measured again below (§3.4). | `docs/ABRA-whitepaper.md:1707` |
| July 27/28 item: state the noisy-OR assumption and its direction | **UNMET.** "noisy-OR" appears in no living document (`grep` over `docs/ABRA-whitepaper.md`, `ROLE-FAMILY.md`, `MODELS.md`: zero hits; only in the three defence records and `engine/roles.py:371,431`). | §2.3 below |

Two committees asked for item 1. The July 31 record said, in its last sentence, that this item
"becomes a fatal one if it is left standing after two committees have now asked." It has been left
standing after three.

---

## 1. The claim

**What the thesis asserts (white paper §0, `:1370-1487`).** The headline metric is exploitability;
the thesis is that a per-turn re-solving agent is harder to exploit than a compiled policy, with
VGC-Bench's "~100% exploitable" as the comparator. The paper says this is "the experiment of this
project, not its assumption" and, at `:1447-1452`, that "the honest state of that metric today is
that we do not have one." `data/provenance-stamp.json:void_files` confirms `exploitability.json` is
declared void.

**So the doctoral claim is currently unmeasured, and the paper says so.** What is measurable today is
the store layer. Per model:

| model | kind of contribution | is it stated that way? |
|---|---|---|
| MEDICHAM + census + differential | engineering, and the instrumentation is the one thing the paper can defend as its own (§0.2 `:1449-1452`) | yes |
| GURU | a census with Wilson intervals — application | yes ("descriptive") |
| WAR | RAPM (basketball) — application; a null | the white paper says "null" and "carries a small real signal" in the same sentence (`:1968-1970`) |
| ROLES | multi-label tagging + ridge logistic — application; a null | yes |
| NMF | Lee–Seung multiplicative updates — application; rank undefended | no (see §0) |
| XATU / policy clone | behaviour clone with revealed-move constraint — application; modest positive | the paper's numbers are not the artifact's (§3.6) |
| PORY | logistic on material — retracted; application | heading says RETRACTED, body (`:1685`) still says "the thesis, demonstrated" |
| CHOMP-EV | held-out sign test + logistic — application; a null | yes, but its audit is vacuous (§3.5) |
| SLOWKING (preview) | regret matching over a matchup matrix — application | the artifact verdict contradicts its own interval (§3.7) |

**Does the white paper blur novel and applied?** Mostly not: §0.2 says "Not novelty on the format or
the infrastructure." The blur is in the companion `docs/SLOWKING-whitepaper.md`, whose §10 claims a
novel combination — *"belief-state search over a learned grey-box model of a closed battle engine"* —
while its own §1 (v1.1 correction) withdraws the premise: the engine is open source and *"the
known-simulator path is now the primary plan."* A novelty claim for an unbuilt design whose defining
constraint the same document retracts is a proposal, not a contribution, and should be labelled one.

**What is genuinely new** is unchanged from July: the measurement practice — paired seed-matched A/B
with a refusal state, the derived-artifact audit, frozen engine releases, prediction cards written
before a run, a retraction registry that fails the build. That is a contribution to research
practice in this domain. It is also the layer where this defence found the most defects.

---

## 2. The mathematics

### 2.1 WAR ridge — selected by a criterion, on the wrong partition

`engine/war.py` sweeps `GRID = [0, 1, 4, 6, 10, 20, 50, 100, 200, 500, 1000]` and picks the λ
minimising held-out log-loss. The artifact records it: `data/war.json:ridge` = 200, `ridge_legacy`
= 6, `ridge_selection.criterion` = "held-out log-loss, minimised over a grid", the full sweep, and a
Spearman ordering-stability check (0.9655 at λ=0 against the selected ordering). The July demand —
a criterion, recorded — is met on its face.

**Two defects.** (a) The partition used to SELECT λ is the partition used to REPORT the score. There
is one split (`h % 5 == 0` on the game id, 20% test) and no validation set, so `held_out.log_loss`
= 0.6936 is the minimum of eleven fits on the same 20%, an optimistically biased estimate. (b) The
code says the grid was extended "after the first sweep selected the largest value on the grid" —
the held-out results were inspected and the search redesigned. That is model selection on the test
set, twice.

The bias runs in the model's favour and the model **still loses to the coin**: 0.6936 against
0.69315 (`war.json:held_out`, `verdict`: *"WORSE THAN A COIN AT EVERY REGULARISATION STRENGTH
TESTED"*). So the null is safe. The published prose is not: `docs/ABRA-whitepaper.md:1968` quotes
0.7048 / accuracy 0.502 (the 2026-07-25 run on 1,061 games, `MODELS.md:1783`) while the artifact
on disk says 0.6936 / 0.504 on 3,663 games (`war.json:n_games`); `:1970` ends the withdrawal
sentence with "which specific species you bring at preview carries a small real signal"; `:1986`
says "WAR barely clears it"; `docs/ROLE-FAMILY.md` §3 says WAR "beats the rating baseline (0.6905)"
and `war.json` contains no rating baseline at all.

Not checked: whether 300 iterations of full-batch gradient descent at lr 0.3 converge at λ=0. If not,
part of the sweep's shape is under-convergence rather than regularisation. Stated as untested.

### 2.2 NMF rank — the blocking item, still open, and the artifact moved under it

Rank is a literal: `ARCH_RANK = 6` in `engine/nmf_roles.py`. The criterion script `engine/nmf_rank.py`
(bootstrap factor stability, Brunet et al. 2004, with a shuffled-data null) was run once, 2026-07-28:

| rank | stability | null | excess over null |
|---|---|---|---|
| 4 (most reproducible) | 0.9992 | 0.9217 | **+0.0775** |
| 6 (shipped) | 0.8148 | 0.9218 | **−0.1070** |

(`data/nmf-rank-selection.json:results`). Then `data/nmf-roles.json` was regenerated on 2026-08-04 at
`archetype_rank` 6 with `archetype_recon_error` **0.682** — and the white paper (`:1978`),
`MODELS.md:1798` and `ROLE-FAMILY.md:81` still print 0.53. The archetype table in
`ROLE-FAMILY.md` §4 (A1 "Intimidate control 20%" … A6 "Priority 11%") does not match the artifact
(A1 wall/special/rain 22.5%, A2 physical/priority 21.6%, A3 spread 17.6%, A4 debuff 16.5%, A5 setup
11.2%, A6 Fake Out 10.6%: `nmf-roles.json:archetypes[].top_roles`). The six archetypes in the
documents are not the six on disk.

On the criterion itself: 6 bootstrap pairs with greedy cosine matching is thin; ranks 3 and 5 flip
sign (−0.079, +0.025), which reads as noise in the criterion at that pair count. Brunet's cophenetic
correlation over ≥50 resamples is the standard and is what should be run before rank 4 is adopted.

### 2.3 Noisy-OR in the role model — assumption unstated, direction unmeasured, prior defences contradict

`engine/roles.py:428-436` builds a team's soft role vector as
P(team has role r) = 1 − Π_{i∈six} (1 − p_i), with p_i = P(role r | species i appears) from the
capability table, then binarises at `PRESENT_AT = 0.50` for the matchup matrix and feeds the soft
differences to the win-credit logistic (`:474-485`).

This is exact only if the six indicators are conditionally independent given the latent role. They
are not: teams are built jointly. The SIGN of the error depends on the dependence — positive
dependence (a rain team stacking rain abusers) makes noisy-OR OVERSTATE the union; negative
dependence (a team carries one Trick Room setter, so one setter's presence lowers the others')
makes it UNDERSTATE. The 2026-07-28 defence asserted "systematically under-counts"; the 2026-07-31
defence asserted "overconfident." Both cannot stand, and no artifact settles it: `grep` for a
role-correlation measurement in `engine/roles.py`, `engine/nmf_roles.py` and the three living
documents returns nothing. The raw material exists — `data/smogon-priors.json` carries a per-species
`teammates` co-occurrence list — and is unused for this.

The threshold compounds it: six species each at p = 0.11 reach 0.50 under independence, so a team
with no member likely to play a role is counted as having it. The win-credit model then ties a
coin (§3.3), which is consistent with the features being wrong OR the game being unpredictable, and
the two cannot be told apart until the assumption is measured.

Also: the documents say **26 functional roles** (`ABRA-whitepaper.md:1945`, `ROLE-FAMILY.md:25`,
`SUMMARY.md:1309`). `engine/roles.py` declares **52** entries in `ROLE_SIGNALS` (counted by regex
this defence); `data/nmf-rank-selection.json:matrix.cols` = 46; `roles-eval.json:role_win_credit`
lists ~50. The typed count is stale by a factor of two.

### 2.4 Wilson, bootstrap, log-loss and Brier — arithmetic correct, baseline defensible

- **Wilson.** Hand computation for the GURU headline cell k=35, n=53 gives [0.526, 0.773];
  `data/guru-matchups.json:decisive_matchups[0].ci` = [0.526, 0.773]. Exact. Formula in white paper
  §5 (`:1732`) is correct.
- **Sign-test interval.** `chomp-ev.json:headline_beat_test.ci95` = [0.4997, 0.5246] by bootstrap;
  Wilson at n=5,509, p̂=0.5123 gives [0.4990, 0.5254]. Agree to 10⁻³. (The file header documents a
  prior bootstrap that was broken by LCG integer overflow and was caught — a good catch, recorded.)
- **Bootstrap unit.** `chomp_ev.js:315-326` resamples games; `pory-eval.json:paired_vs_material_two_feature.ci95_clustered_by_game`
  clusters by game (the right unit — states within a game are correlated); `roles.py:540-548`
  resamples per-game losses. None clusters by PLAYER, and players repeat across games; the
  intervals are therefore somewhat narrow. Not an error at this effect size; a stated limitation is
  owed.
- **Log-loss baseline.** Every "coin" is ln 2 = 0.69315, i.e. p = 0.5, not the climatological rate.
  Measured this defence over `data/games.bo3.jsonl` (25,435 non-bot-flagged games with a winner):
  p1 wins **0.5045**, so the climatological log-loss is H(0.5045) = **0.69311** — 4 × 10⁻⁵ below
  ln 2. The coin IS the climatological baseline here to four decimals. Negative finding, stated.
  GURU's `log_loss_usage` 0.6928 and CHOMP-EV's Elo 0.6921 are then the only sub-coin baselines and
  both sit inside the model CIs.
- **Brier.** Coin 0.25 (`chomp-ev.json:brier.coin`); correct.

---

## 3. Statistical validity of the store-derived results

### 3.1 Usage and bring rates
`data/bring-priors.json` (regenerated 2026-09-09) shrinks toward the pool mean with 10
pseudo-observations and publishes no interval. The bring rates are conditioned on
`require_full_bring` (§3.4). The usage table is a census; nothing to test.

### 3.2 GURU archetype matchups — exactly what chance predicts
Counted from `data/guru-matchups.json:matrix` this defence: 66 unordered pairs, **53 with n ≥ 30, 3
"decisive"** at 95%; **2.65 expected by chance**. Smallest exact two-sided binomial p = 0.0061
(Kingambit-Sneasler vs Sableye-Aerodactyl, 59/91) against Bonferroni 9.4 × 10⁻⁴; **zero survive**
Bonferroni or BH. `docs/MODELS.md:1503-1506` and `docs/SUMMARY.md:1296` say exactly this. **The white
paper does not** — §4.1 (`:1667-1672`) calls GURU "descriptive," quotes the predictive log-loss as
0.7122 (artifact `predictive_test.log_loss_matchup_prior` = 0.7124; worse than the coin), and never
states the family. Two further points: the decisive cells are computed on ALL rows (`guru.py`:
"build the matchup matrix from ALL games") so they are in-sample, and only the predictive test is
held out (temporal 80/20 on file order); and the archetype set the matrix was built on is stale —
`data/archetypes.json` was regenerated 2026-08-25 (commit `1ffa031f`, "by a run nobody claimed")
with different names (Sableye-Grimmsnarl, Whimsicott-Staraptor…) at **silhouette 0.126**
(`archetypes.json:silhouette`), which by Rousseeuw's convention is no substantial cluster structure.
`assign()` in `guru.py` puts a team in an archetype on best overlap of ≥1 species with a 4-species
core. A 12 × 12 matrix over clusters that barely exist, assigned by one shared species, is a weak
object to solve an equilibrium over.

### 3.3 "Preview roles tie a coin" — a correctly reported null
`data/roles-eval.json`: 0.6935, CI [0.6885, 0.6986], coin 0.6931, rating baseline 0.6967, n_test
1,073. The coin is inside the interval; the claim is sound. Split: id-hash 80/20, deterministic,
recorded in code not in the artifact. Because a hash split is stable across refits, the SAME test
games have been scored on every one of `roles.py`'s 14 commits since 2026-07-24 (`git log`); the
July caveat about a re-used held-out corpus stands and is still unstated in the paper. The
"median cell n = 20 across 1,051 cells" (`ABRA-whitepaper.md:1954`, `SUMMARY.md:1309`) is a
2026-07-25 figure; the artifact on disk (`data/role-matchups.json`, 2026-07-31) has **1,101 cells,
median n = 74** (computed this defence). Stale by 3.7×, in the direction that flatters — and
unreported.

### 3.4 The quality filter conditions on game length — quantified
`data/quality-filter.json:rules.require_full_bring.known_limitation` states the bias; the white paper
withdrew its magnitude at 5.259.0 and publishes none. Measured this defence in one pass over
`data/games.bo3.jsonl` (227,347,410 bytes, mtime 2026-09-04T05:30Z, 25,522 lines; bot-flag rule only,
no behavioural/forfeit/illegal rule; command in the notes):

| | games | mean turns |
|---|---|---|
| unfiltered (six + winner) | **25,435** | **6.74** |
| both sides revealed all four | **17,552** (69.0%) | **7.81** |

Bring rate for the 25 most-used species is **+4.44 points higher on average under the filter, max
+8.19 (Basculegion: 0.661 → 0.743)**, every one of the 25 positive. The unfiltered rate counts a
species as brought only if the replay revealed it, so it is a lower bound and +4.4 is an UPPER bound
on the bias; the post-stratified estimate in `data/bring-bias.json` (2026-07-28, ots pool 3,865 →
2,860) is a mean shift of 1.54 points, max 4.94, with **0 of 84 species surviving BH** (12 raw
|z| > 2, 4.2 expected). The truth sits between 1.5 and 4.4 points, per species, and the white paper
should say so rather than nothing.

### 3.5 "Better beliefs did not improve the bring decision" — sound null, vacuous audit
`data/chomp-ev.json:proper_score_logloss`: align 0.6921 [0.6904, 0.6937]; belief-weighted 0.6924
[0.6911, 0.6937]; coin 0.6931 inside both. Sign test 0.5123 [0.4997, 0.5246]. The verdict branch
(`chomp_ev.js:416`) requires BOTH tests — correct design. **But the selection audit the white paper
leans on measured nothing.** `chomp_ev.js:118` drops every game not in the clean set BEFORE the
qualify test at `:128-129`, and the clean set already enforces `require_full_bring`, so `audExcl`
can never receive a game: the artifact reads `selection_audit.n_excluded_human` = **0**,
`excluded_mean_turns` = **null**. The white paper (`:1697-1699`) nevertheless reports "eval 6.5
turns / 1280 rating vs 6.08 / 1267 excluded" and concludes the filter "favours CHOMP — making the null
conservative." Those four numbers are in no artifact, and the inference rests on a comparison that
was never made. `:1691` also says 1,205 games; `chomp-ev.json:n_test` = 1,102.

### 3.6 XATU / the policy clone
White paper `:1676-1678` and `MODELS.md:1405`: top-1 35.9% (CI 35.2–36.5), top-3 71.6%, CE 2.27,
baselines 4.54 / 2.91. The cited harness artifact `data/policy-eval.json` reads top-1 **0.2979**
[0.2914, 0.3045], top-3 **0.6564**, CE **2.6353**, baselines **4.7346 / 3.0286** (2026-07-30). Every
figure in the sentence differs from the artifact it names. `docs/MEASURE.md:5337` already flagged the
71.6% as a stop-and-ask on 2026-08-04; it is still in the paper.

### 3.7 SLOWKING preview equilibrium
`data/slowking-eval.json`: greedy − Nash = 0.0409, CI **[−0.0001, 0.1735]**; the `verdict` string
begins "SLOWKING's equilibrium is substantially less exploitable." The interval contains zero. Worse:
`engine/slowking_preview.py:191-209` documents that the bootstrap replicates are solved at
`iters=1000` against the point estimate's 15,000, that the intervals "do not contain their own
point estimates," and says *"treat both intervals as unusable rather than as evidence."* Both are
quoted in the white paper (§4.5) and `MODELS.md:1585`. The cycle: `top_nontransitive_cycle.supported`
= **false** on both artifacts (legs of 49/37/15 and 40/5/140 games, the best of 1,320 and 336
searched triples). The white paper's cycle paragraph (`:1721-1727`) names a different cycle
(TrickRoom → HyperOffense → Sand, "13–18 games" per leg, 73/71/67%) that exists in no artifact, says
"Over GURU's 13 species-archetypes … uniform 0.109" (artifact: 12, 0.0761), and "Rain vs Sun is 51%
(n=236)" (`data/playstyle-matchups.json:matrix.Rain.Sun` = 0.538 [0.466, 0.609], n=182).

### 3.8 Multiplicity, across the thesis
Corrections now exist where July found none: `engine/weight_multiplicity.js` (withheld),
`engine/bring_bias.js` (BH over 84 species), `engine/build_lab.js` (BH), the GURU family statement
in MODELS/SUMMARY, and the cycle search reports its family size (1,320 / 336 triples). There is still
**no experiment registry**, so the number of paired comparisons that preceded any reported search
result cannot be counted. And the correction that exists for GURU has not reached the white paper.

### 3.9 Held-out integrity, summarised
Splits are code-defined (id-hash mod 5 in `war.py`/`roles.py`; temporal 80/20 on FILE ORDER in
`guru.py`/`chomp_ev.js`, which depends on append order and is not recoverable from a re-pulled store).
No artifact records its split rule, seed, or test-set identity. `war.py` documents redesigning its
grid after seeing test results. Every store-derived artifact examined predates quality filter 1.3.0
(`quality-filter.json:updated` 2026-08-27), and the filter's own 1.2.0 changelog says *"EVERY number
computed on a clean corpus before this date … needs re-running."* None has been.

---

## 4. The null results — prominent in the ledgers, softened in the paper

`docs/SUMMARY.md:1296-1311` carries ⚠️ markers on GURU, PORY, NMF and WAR with the artifact numbers;
`docs/MODELS.md` leads GURU with *"THE HEADLINE IS A NULL, AND IT HAS TO BE SAID IN THAT ORDER."* That
is the standard July praised, and it holds in those two files.

The white paper — the document a reader outside the project actually gets — is the weakest of the
three: §4.1 GURU omits the family and the worse-than-coin figure; §4.3 PORY says RETRACTED in the
heading and "the thesis, demonstrated" in the body (`:1685`); §4.4 CHOMP-EV leans on a vacuous audit
to call the null "conservative"; §4.5 SLOWKING is headed "(suggestive)" over an artifact that says
`supported: false` and a CI including zero; the role-family appendix ends WAR's withdrawal by
asserting the signal (`:1970`) and its "Honest limits" says "WAR barely clears it" (`:1986`). The
positives get banner blocks at the top of the document; the nulls sit in §4 and the appendix with
prose that leans the other way. Prominence is not equal.

---

## 5. Literature

**Confirmed correct** (author/year/venue): Wilson 1927 JASA; McFadden 1974 in Zarembka; Zinkevich et
al. 2007 (CFR); Lanctot et al. 2009 (MCCFR); Moravčík et al. 2017 Science; Brown & Sandholm 2018
Science; Brown et al. 2020 NeurIPS (ReBeL); Schmid et al. 2023 Sci. Adv.; Schrittwieser et al. 2020
Nature; Danihelka et al. 2022 ICLR; Kumar et al. 2020 (CQL); Chen et al. 2021 (DT); Perolat et al.
2022 Science; Meta FAIR 2022 Science (CICERO); Chen & Joachims 2016 WSDM; Balduzzi et al. 2018
NeurIPS; Jiang–Lim–Yao–Ye 2011 Math. Prog.; Lee & Seung 1999 Nature; Blei–Ng–Jordan 2003 JMLR;
Tsoumakas & Katakis 2007; Geng 2016 IEEE TKDE; Mimno et al. 2011 EMNLP; Brunet et al. 2004 PNAS;
Benjamini & Hochberg 1995 JRSS-B; Lopez, Matthews & Baumer 2018 AoAS 12(4); Lanctot–Lisý–Winands 2013
(SM-MCTS); Bošanský et al. 2016 AIJ.

**UNCONFIRMED — flagged, not asserted:** VGC-Bench "AAMAS 2026" (arXiv 2506.10326 is a 2025 preprint;
the white paper ref. 5 and `SLOWKING-whitepaper.md` ref. 8 give **two different titles** for the same
id, and both cannot be right); Metamon "RLC 2025"; PokéChamp "ICML 2025 (spotlight)"; the PokéAgent
Challenge cited in `THEORY.md` as "NeurIPS 2025, arXiv:2603.15563" — a 2603 identifier is a March 2026
posting and cannot be the venue paper's original, so the citation is internally implausible as
written; arXiv 2304.08272 ("latent roles beat raw identity in team sports") — I cannot confirm the
paper says what it is cited for.

**Missing:** RAPM has no primary citation anywhere ("Rosenbaum-style RAPM" in `ROLE-FAMILY.md:109` is
a name, not a reference; Rosenbaum 2004 / Sill 2010 are the standard ones); noisy-OR has no Pearl
1988; regret matching is "(Hart & Mas-Colell)" at `:1766` with no year and no reference entry.

**Transfer argued or asserted?** NMF/coherence: rejected on transfer grounds in `nmf_rank.py` — argued,
and well. Belief-state search: argued through three named breaks (§0, `docs/POKER-TO-POKEMON.md`).
RAPM → species: argued only by analogy; the additive-linear assumption of RAPM (a species' effect is
independent of its teammates) is exactly what a synergy-driven doubles format violates, and the paper
does not say so. **Decorative:** Geng 2016 (Label Distribution Learning is a supervised paradigm with
distribution-valued targets; NMF loadings are not LDL, and the citation does no work beyond
legitimising "learned, not typed"); arXiv 2304.08272 (asserts a finding to motivate, never engaged);
Blei 2003 (framing only).

---

## 6. Construct validity

| model | validated against | artifact |
|---|---|---|
| damage formula | @smogon/calc (external) and the official engine, 1,728/1,728 rolls | `data/damage-validation.json`; `tests/test-damage-stages.js` |
| GURU, WAR, ROLES, CHOMP-EV, PORY, PORY-NN, XATU/clone | **real held-out store outcomes / clicks** | `guru-matchups.json`, `war.json`, `roles-eval.json`, `chomp-ev.json`, `pory-eval.json`, `pory-nn.json`, `policy-eval.json`, `xatu-belief.json` |
| SLOWKING preview | a REAL matrix, but graded by exploitability WITHIN that matrix — internal consistency, not accuracy; an equilibrium over cells that are noise (§3.2) is an equilibrium over noise | `slowking-eval.json` |
| leaf calibration, MAG, MILTANK, DODUO, PORYGON2, GARY, exploitability | MEDICHAM, or bot-vs-bot | **withheld** |

The store layer is honestly externally validated, and it is honestly null almost everywhere. The
structural gap the brief anticipated is real at the top: the thesis's headline metric,
exploitability, is defined against a best response trained inside the project's own simulator. Until
the exploiter is trained against the real engine, that number will establish internal consistency by
construction, and the paper does not yet address this.

---

## 7. Reproducibility

- **Stores:** `data/games.ladder.jsonl` 383.7 MB and `data/games.bo3.jsonl` 227.3 MB plain
  (gitignored; `.gz` tracked). A reader gets a snapshot at a commit, not the bytes an artifact read.
- **No store-derived artifact records which games it read.** A scan of `data/*.json` for any
  store/corpus/game-id digest field: `war.json`, `nmf-roles.json`, `nmf-rank-selection.json`,
  `guru-matchups.json`, `roles-eval.json`, `chomp-ev.json`, `archetypes.json`, `slowking-eval.json`,
  `meta-usage.json`, `bring-priors.json`, `bring-bias.json`, `pory-eval.json` — **none**.
  `data/provenance-stamp.json:mtime_only` = 179 and lists every one of them. ROADMAP #288 states the
  gap in its title and is open.
- **Splits** are recoverable from code for the hash-based ones and NOT recoverable for the temporal
  ones (file order).
- **Two headline figures have no artifact at all.** §1's "0.687 against a coin's 0.693 on 600+
  held-out games" and "52.4%, 95% CI [49.9, 54.9]" (`:1491-1495`): `engine/predictability.py` prints
  and writes nothing (`grep json.dump`: none); `data/skill-variance.json` and `engine/skill_variance.py`
  — the deliverable `docs/STUDY-DESIGN-skill-vs-luck.md` §6 specifies — **do not exist**, 46 days
  after the design was committed (`c396ccb0`, 2026-07-24).
- **Cannot be reproduced today:** any store-derived number to the game; the two §1 figures; the
  eleven white-paper figures that disagree with their artifacts (they describe runs that were
  overwritten); everything withheld.

---

## What I could not evaluate, and why

- Anything in the play layer — withheld by the gate, correctly; the METHODS were read and nothing
  above depends on a withheld number.
- Whether rank 4 is right — only that the shipped rank is below null on the project's own criterion
  and that the criterion is thin at 6 pairs.
- The magnitude and sign of the noisy-OR error — no artifact; the raw material exists (§2.3).
- Whether WAR's gradient descent converges at low λ.
- What the current store gives for GURU, WAR, ROLES, NMF, CHOMP-EV, SLOWKING under filter 1.3.0 — I
  ran no generator that writes into `data/` (seven agents on the machine, one running the full
  suite); those runs are listed as OWED in the notes with exact commands.
- The deck, technical docs, `POKER-TO-POKEMON.md`, `PRIOR-ART.md` — not read.

---

## Required to reach a pass

1. **NMF.** Either read the rank from `data/nmf-rank-selection.json:most_reproducible.rank` in
   `engine/nmf_roles.py` and regenerate, or state at `ABRA-whitepaper.md:1978-1983`, `MODELS.md:1798`
   and `ROLE-FAMILY.md:81,103` that rank 6 ships below the null with the reason. Delete "error 0.53"
   and "topic coherence is next" from all three. Replace the archetype table with the artifact's. Then
   re-run `python engine/nmf_rank.py` with ≥50 bootstrap pairs and Brunet's cophenetic correlation.
2. **WAR.** Three-way split by id hash (train / validation / test), select λ on validation, report
   test once; record split rule, seed, grid and store digest in `data/war.json`. Rewrite `:1968-1970`,
   `:1986` and `ROLE-FAMILY.md` §3 from the artifact's `verdict`.
3. **CHOMP-EV audit.** Populate `audExcl` from `quality.js loadGames({clean:false})` with every rule
   except `require_full_bring` applied, re-run `node engine/chomp_ev.js`, and replace 1,205 / 6.5 /
   6.08 / 1280 / 1267 at `:1691-1699` with artifact fields. Until then the sentence "making the null
   conservative" comes out.
4. **SLOWKING.** Solve the bootstrap replicates at the point estimate's iteration count
   (`slowking_preview.py:191-209`), re-run both tags; remove "substantially less exploitable" from the
   verdict branch; rewrite §4.5 from `supported`, `greedy_minus_nash_ci95`, and
   `playstyle-matchups.json:matrix.Rain.Sun`.
5. **§1 ceiling.** Build `engine/skill_variance.py → data/skill-variance.json` with the recovery
   simulation of `STUDY-DESIGN-skill-vs-luck.md` §4.5, or withdraw 0.687 / 0.693 and 52.4% from §1 and
   `PUBLICATION.md` until an artifact exists.
6. **XATU.** Reconcile `:1676-1678` and `MODELS.md:1405` with `data/policy-eval.json`, or cite the
   artifact that carries 35.9 / 71.6 / 2.27.
7. **Noisy-OR.** State the assumption in the white paper; measure P(team has role r) directly from
   observed sixes against the noisy-OR estimate over the same sixes; publish the signed discrepancy
   per role and settle the 07-28 / 07-31 contradiction.
8. **GURU in the white paper.** Carry the family statement from `MODELS.md:1503-1506` into §4.1;
   0.7122 → 0.7124; state that decisive cells are in-sample; regenerate on the current
   `archetypes.json` or pin the old one and say so; report the silhouette beside K.
9. **Roles count.** Replace "26" with the derived count everywhere, or derive it in the doc build.
10. **Bring-rate bias.** Publish the magnitude from one pinned pass (both operands: kept/dropped
    games, mean turns, per-species shift with and without post-stratification) into
    `data/quality-filter.json` or `data/bring-bias.json`, and cite it at `:1707`.
11. **Reproducibility (#288).** A store digest and a game-id-set digest in every artifact whose
    generator reads a game file, plus the split rule and seed. Then re-run the store layer once on
    filter 1.3.0.
12. **Citations.** Add RAPM (Rosenbaum 2004 / Sill 2010), Pearl 1988, Hart & Mas-Colell 2000;
    resolve the two VGC-Bench titles; fix or remove the 2603 arXiv id; mark Geng 2016 and
    arXiv 2304.08272 as motivation rather than method.

Items 1, 6, 8, 9, 12 are hours. Items 2, 3, 4, 10 are a day. Items 5, 7, 11 are real work and 11 is
the one that makes the rest checkable. None is a research problem. **All twelve are the kind of
defect this thesis says it exists to prevent, which is why they are graded as they are.**

---

*Defended 2026-09-09 against commit `d6789951`. Nothing in `data/` was written; one read-only pass
over `data/games.bo3.jsonl` was run at BELOWNORMAL priority through `tools/lownode.cmd`. Companion:
`docs/_reports/2026-09-09-thesis-defence-notes.md`.*
