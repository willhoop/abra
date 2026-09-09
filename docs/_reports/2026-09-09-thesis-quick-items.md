# Thesis defence quick items — 2026-09-09 (MEASURE)

Historical record, never maintained. Companion to `docs/THESIS-DEFENCE-REVIEW-2026-09-09.md` "Required to
reach a pass" items 1, 6, 8, 9, 12 and `tests/test-stadium-roster.js`. Nothing committed. No game played.
`status.js`, `run-all.js` not run. Every generator that ran did so alone, BELOWNORMAL, by PID.

## 0. Audit of the killed agent's uncommitted work — KEPT, with corrections

`git diff` on the nine named files was entirely the killed agent's (the retraction commit `49793320`
landed earlier and is not in the diff). Verified against artifacts and KEPT:

| file | what it did | verification |
|---|---|---|
| `engine/nmf_roles.py` | `ARCH_RANK = 6` → `read_selected_rank()` from `data/nmf-rank-selection.json:most_reproducible.rank`, `SystemExit` if absent; store receipt (path/bytes/sha256) mirroring `quality.py`'s `_store_handle` rule; writes `archetype_rank_source`, `store`, `n_team_sides_role_matrix`, `n_roles_role_matrix` | read the diff; `python -c ast.parse` ok |
| `engine/nmf_rank.py` | `PAIRS` from argv; `shipped_rank` read from `data/nmf-roles.json:archetype_rank` instead of `== 6`; `cophenetic_correlation: null` field | read the diff; parses |
| `data/nmf-roles.json` (14:38) | rank 4, `archetype_recon_error` 0.738, 63,882 × 52, receipts | `sha256sum data/nmf-rank-selection.json` = `f1354dd8…` = `archetype_rank_source.sha256`; `sha256sum data/games.ladder.jsonl` = `cde0fa05…` = `store.sha256` (store mtime 13:05, unchanged since); `data/nmf.js` == `window.NMF=`+json (checked) |
| docs table (4 archetypes) | A1 27.1% phys 39 / priority 22 / setup 6 / tailwind 6; A2 25.7% wall 23 / spec 15 / rain 10 / redirection 6; A3 25.2% spread 54 / spec 8 / tailwind 6 / sand 4; A4 22.1% debuff 42 / fakeout 26 / pivot 8 / setup 3 | every cell re-read from `archetypes[].prevalence` / `top_roles[].weight` — matches |
| GURU §4.1 rewrite | 5,265 / K 12 / 0.7124 vs 0.6931 / 1,053; multiplicity 66 / 3.3 / 3 / 6.1e-3 / 7.6e-4 / 0 / 0 | `data/guru-matchups.json:n_games,n_archetypes,predictive_test,n_decisive`; `data/guru.js:multiplicity` all fields match; `engine/guru.py:60` is the temporal split, matrix from ALL rows (`:62-63`) |
| GURU "no committed `archetypes.json` matches GURU's 12 names" | `git show {7215fff2,d88fea4b,1ffa031f^,HEAD}:data/archetypes.json` cores — none yields `Sableye-Aerodactyl` or `Kingambit-Sneasler` beside `Garchomp-Incineroar`; HEAD (2026-08-28) reads `k_selected` 12, `silhouette` 0.126, `n_games` 19,978 — a different labelling | confirmed |
| refs 13–16 added to the white paper; Geng 2016 / arXiv 2304.08272 marked motivation; Hart & Mas-Colell 2000 cited at the regret-matching sentence | bibliographic detail checked against the task brief (Sill 2010 MIT SSAC title; Rosenbaum 2004 82games.com; Pearl 1988 Morgan Kaufmann; Econometrica 68(5)) | kept |

CORRECTED (the killed agent's text was wrong against the artifact):

1. **"47 of them are earned by at least one species at the artifact's `present_at` floor"** — wrong. Derived
   from `data/pokemon-roles.json`: union of `species[*].roles` keys = **47** (roles with p ≥ `rate_floor`
   0.05 for some species); at `present_at` 0.5 the count is **40**; `all_roles` union 51; `roles` 52 keys,
   identical to the 52 keys of `engine/roles.py:ROLE_SIGNALS` (regex count, set equality checked). Fixed in
   `ABRA-whitepaper.md:1993`, `MODELS.md:1714`, `ROLE-FAMILY.md:26`.
2. **"the 0.79 this sentence carried was an earlier run's"** (`ABRA-whitepaper.md:2029`) — this was the ONE
   docs-currency failure (3b(b): 0.79 not in `data/nmf-roles.json`; 32/1 → 33/0 after the digits were
   deleted, per the retraction rule: a superseded figure comes out, not captioned).
3. **"32,092 quality-filtered games of 92,379 collected (the run's own print)"** (`ABRA-whitepaper.md:2035`)
   — a print is not a field, and my own re-run over the SAME store digest printed **32,040**. Deleted;
   replaced with the finding in §1 below.
4. **VGC-Bench "title UNCONFIRMED"** and **PokeAgent "2603 id UNCONFIRMED, removed"** — both resolved
   against the arXiv record (§5). The killed agent had no network check; I did.

Nothing was reverted.

## 1. NMF (T1) — DONE, re-run owed

- **Shipped:** `data/nmf-roles.json` `archetype_rank` **4**, read from `data/nmf-rank-selection.json:most_reproducible.rank`
  (`stability` 0.9992, `null_stability` 0.9217, `excess_over_null` +0.0775, `bootstrap_pairs` 6, generated
  2026-07-28); `archetype_recon_error` **0.738**; `n_team_sides_role_matrix` 63,882 × `n_roles_role_matrix` 52;
  move cut `rank` 10, `n_documents` 64,179, `n_moves` 375, `reconstruction_error_ratio` 0.8348.
  Old (HEAD): `archetype_rank` 6, `archetype_recon_error` 0.682 (2026-08-04, 14,808 docs) — not comparable.
- **Docs rewritten from the artifact** (killed agent, verified): `ABRA-whitepaper.md` §Emergent roles
  (~:2026-2052, table + receipt), `MODELS.md:1799`, `ROLE-FAMILY.md:81-103` (table + §5), `PUBLICATION.md`
  item 9. Mine: `SUMMARY.md:1311` NMF row (was "Rank 6 ships … 0.53").
- **My additions to `engine/nmf_roles.py`:** `n_games_usable`, `n_games_collected`, `quality_filter_version`
  as FIELDS (the counts were only printed), and `quality_inputs` receipts for `data/quality-filter.json` and
  `data/store-validation.json`.
- **FINDING — the store digest does not pin the sample.** `engine/quality.py` reads
  `data/store-validation.json` (`species_flagged_ids`) as well as the store. That file was rewritten by
  another agent at 16:46:24; the killed agent's run (14:38) printed 32,092 usable and mine (16:49) printed
  **32,040** over a byte-identical store (`cde0fa05…`). Both receipts are now in the script; the shipped
  artifact predates the fix and carries only the store digest.
- **Re-run of `nmf_roles.py`: OWED.** Started 16:49:54 as PID 7248 (BelowNormal), quality load done by
  ~16:53, still in the fit stage at 17:02:25 (12.5 min) → killed by PID. `data/nmf-roles.json` confirmed
  byte-identical to the 14:38 artifact after the kill (`cmp`). The shipped artifact stands on its verified
  digests.
- **`nmf_rank.py 50`: OWED, not started.** One `nmf_roles.py` pass (two fits on the 63,882-row matrix)
  exceeded 12 min on this machine; the selection is 11 ranks × 50 pairs × (2 fits + 2 null fits) = 2,200 fits
  of the same estimator. Brunet's cophenetic correlation is still `null` — a consensus matrix over 63,882
  team-sides is 63,882² entries (~32 GB as float64); it needs subsampling or a different formulation, and is
  new code, not a re-run.

## 2. XATU (T6) — DONE (re-run)

`node engine/where.js xatu` names no artifact carrying 35.9 / 71.6 / 2.27; the withdrawal stands.
`engine/eval_policy.py` imports `json, os, math, random, collections` only, reads
`data/games.ladder.raw-logs.jsonl` and `quality.load_games` — **plays no game** — so it was run: PID 11608,
17:02:42 → 17:04:2x (~2 min). Added to the script: `generated_at`, `source` receipt (raw-logs path/bytes/
sha256 — the file is gitignored so this is the only pin), `quality_inputs` receipts (store, filter,
store-validation), `clean_ids_from_quality`, `logs_kept`, `logs_dropped_by_quality`, `quality_filter_version`,
`split_rule`, `seed`.

| field | old (2026-07-31) | new (2026-09-09T21:04:26Z) |
|---|---|---|
| `n_games` / `train_games` / `test_games` | 3,903 / 3,122 / 781 | **24,114 / 19,291 / 4,823** |
| `test_clicks_scored` / skipped | 18,537 / 321 | **118,274 / 95** |
| `species_only_clone.top1_accuracy` [ci] | 0.2979 [0.2914, 0.3045] | **0.293 [0.2904, 0.2956]** |
| `top3_accuracy` [ci] | 0.6564 [0.6495, 0.6632] | **0.6459 [0.6432, 0.6486]** |
| `cross_entropy_nats` [ci] | 2.6353 [2.6165, 2.6540] | **2.3365 [2.3288, 2.3441]** |
| `baselines.global_move_freq_ce` / `uniform_moveset_ce` | 4.7346 / 3.0286 | **4.7124 / 3.6978** |
| `phase_conditioned_clone` top-1 / CE | — | 0.3068 / 2.5087 (not shipped, `verdict`) |
| `quality_filter_version` | (pre-1.3.0) | 1.3.0 |
| `source.sha256` / `quality_inputs.store_validation.sha256` | — | 4a332aeee377… / b1846b6b9a60… |

Rewritten: `ABRA-whitepaper.md:1701-1717` (§4.2), `MODELS.md:1405`, `SUMMARY.md:1297` (was "Top-1 36% /
top-3 72%" — the rounded withdrawn pair, missed by the earlier retraction).

## 3. GURU (T8) — DONE as PIN

Family statement carried from `MODELS.md:1494-1506` into `ABRA-whitepaper.md` §4.1; 0.7122 → **0.7124**
(`data/guru-matchups.json:predictive_test.log_loss_matchup_prior`; coin 0.6931; `test_games` 1,053); decisive
cells stated in-sample (`engine/guru.py:60` splits only for the predictive test; `:62-63` tallies all rows).
Silhouette: `guru-matchups.json` carries none, and no committed `data/archetypes.json` reproduces GURU's 12
labels, so the silhouette for GURU's OWN labelling is not recoverable — stated in the section; the current
`archetypes.json` (`k_selected` 12, `silhouette` 0.126, `n_games` 19,978) is a different labelling.
**Not regenerated, deliberately:** re-running `guru.py` on the current `archetypes.json` mixes a 19,978-game
labelling with a 92,379-row store; done properly it is `archetypes.py` → `guru.py` → `build/build_guru_js.js`
(the multiplicity block lives in `data/guru.js`, written by the build) → `slowking_preview.py` (reads the
matrix) → MODELS.md/SUMMARY.md/white paper GURU and SLOWKING sections — a cascade, not a quick item, and it
changes every number the GURU cabinet renders while WEB is paused.

## 4. Roles count (T9) — DONE

Shape printed: `data/pokemon-roles.json` keys `['generated','n_games','min_seen','roles','rate_floor',
'present_at','note','species','capability_note','capability','capability_from']`; `roles` is a dict of **52**
keys; `species` 297; `present_at` 0.5; `rate_floor` 0.05. Replaced (typed "26" meaning the roles count → 52
with citation): `ABRA-whitepaper.md:1992`, `MODELS.md:1714`, `ROLE-FAMILY.md:26`, `PUBLICATION.md:31`
(killed agent, verified), `SUMMARY.md:1309` (mine). Left every other "26" (twenty-six frozen sources, staged
comparisons, etc. — grepped `twenty-six|26 roles|26 functional`; none remain that mean the roles count).

## 5. Citations (T12) — DONE

- **VGC-Bench, resolved.** `curl export.arxiv.org/api/query?id_list=2506.10326` (2026-09-09): title
  *VGC-Bench: Towards Mastering Diverse Team Strategies in Competitive Pokémon*; authors Cameron Angliss,
  Jiaxun Cui, Jiaheng Hu, Arrasy Rahman, Peter Stone; published 2025-06-12. **Both repository titles were
  wrong** (white paper ref. 5 "A Benchmark and Strategy Suite for Competitive Pokémon Doubles Battling";
  SLOWKING ref. 8 "Generalizing Across Diverse Team Strategies in Competitive Pokémon"). Fixed:
  `ABRA-whitepaper.md` ref. 5, `SLOWKING-whitepaper.md:364`, `PRIOR-ART.md:35-38`.
- **2603.15563, genuine.** `id_list=2603.15563`: *The PokeAgent Challenge: Competitive and Long-Context
  Learning at Scale*, Karten, Grigsby, Upaa, Bae, … ; v2 published 2026-03-16 — a write-up postdating the
  NeurIPS 2025 event. Restored in `PRIOR-ART.md:216-220` with the reason; `THEORY.md:166-167`,
  `COMPETITORS.md:87,318`, `EXTERNAL-EVIDENCE.md:158` were already correct and are untouched.
- RAPM (Rosenbaum 2004; Sill 2010), Pearl 1988, Hart & Mas-Colell 2000 → white paper refs. 13–16, cited at
  `:1808` (regret matching), `:2001` (noisy-OR), `:2013` (WAR); `ROLE-FAMILY.md` §3 and Sources. Geng 2016 and
  arXiv 2304.08272 marked *motivation* in white paper, MODELS.md, ROLE-FAMILY.md, `nmf_roles.py` docstring and
  the artifact's `method` string. No citation invented; nothing beyond the API fields above is asserted.

## 6. `tests/test-stadium-roster.js` — RED, left red, pre-existing at HEAD

A cabinet is a `mon: "NAME"` entry in `web/stadium.html`; the test matches cabinets to `## NAME —` headings
in `docs/MODELS.md`, and accounts for every `data/*` generator by `nameBounded(MD, base)` (word-bounded
filename in MODELS.md), a heading/cabinet stem, or a `NOT_A_MODEL[name] = reason` entry **in the test file**.
Three failures, all present at HEAD (checked: `ALAKAZAM` heading committed 2026-09-04; the four "redundant"
names occur in `HEAD:docs/MODELS.md` at the same counts as the working copy; `nmf_rank.py`'s mention arrived
in `49793320` today):

1. `ALAKAZAM` heading, no cabinet → needs `NOT_A_CABINET['ALAKAZAM'] = 'unbuilt — heading added 2026-09-04
   as the capstone placeholder; no artifact, no decision'` (tests/) or a cabinet (web/, paused).
2. Six generators in neither file. By the test's own rule ("if this number is wrong, who is misled? — only
   us → pipeline step") all six are NOT_A_MODEL, which lives in tests/: `build/build_engine_data.js`
   (engine-data-purity: our artifact's conformance), `engine/bench_speed.js` (medicham-speed: our cost),
   `engine/joint_click_census.js` and `engine/side_selection_census.js` (censuses of our own rollouts),
   `engine/next_regulation_ingest.js` (next-regulation.json: our corpus), `engine/smogon_coverage.js`
   (coverage of our priors over our corpus). Adding fake model sections to MODELS.md to satisfy the
   substring test would be the wrong fix and I did not do it.
3. `NOT_A_MODEL` entries now named in MODELS.md — `leaf_engine_contrast.js`, `nmf_rank.py`, `click_census.js`,
   `quarantine.js` — the test says delete the exceptions; that is tests/.

`tests/` was off-limits for this pass, so the test stays red and this is the exact fix for whoever owns it.

## 7. Gate

`node tests/test-docs-current.js`: 32/1 on arrival (the killed agent's 0.79) → **33/0** after. The top
CHANGELOG version moved to 5.276.0 under another agent during the pass; not mine.

## Proposed `docs/RUNNING-NOTES.md` row (NOT written)

- **What changed.** NMF ships rank 4 read from `data/nmf-rank-selection.json:most_reproducible.rank`
  (`engine/nmf_roles.py`, was hand-set 6); `data/nmf-roles.json` regenerated (`archetype_recon_error` 0.738,
  63,882 × 52); `data/policy-eval.json` re-run under quality filter 1.3.0 with source and quality-input
  receipts (`species_only_clone` top-1 0.293, top-3 0.6459, CE 2.3365 vs 4.7124 / 3.6978, 118,274 clicks);
  GURU §4.1 carries the family statement, 0.7124, in-sample decisive cells, pinned labelling; roles count 52
  (`data/pokemon-roles.json:roles`); refs 13–16; VGC-Bench title and PokeAgent id verified against arXiv.
- **Supersedes.** `archetype_rank` 6 / `archetype_recon_error` 0.682 / the six-archetype table; policy-eval
  top-1 0.2979 / top-3 0.6564 / CE 2.6353 / baselines 4.7346, 3.0286 / n 3,903; GURU 0.7122; "26 roles";
  XATU "36% / 72%" in SUMMARY.md; two wrong VGC-Bench subtitles.
- **Basis.** unchanged.
- **Owes.** `python engine/nmf_roles.py` (receipts), `python engine/nmf_rank.py 50` + cophenetic;
  `tests/test-stadium-roster.js` three fixes (tests/).

## Proposed CHANGELOG bullets (NOT written; MINOR)

- Changed: `engine/nmf_roles.py` reads the archetype rank from `data/nmf-rank-selection.json` and fails if
  it is absent; writes rank source, store, quality-input receipts and the usable/collected counts as fields.
- Changed: `engine/nmf_rank.py` takes the bootstrap pair count from argv and reads the shipped rank from the
  shipped artifact; records `cophenetic_correlation: null` (not implemented).
- Changed: `engine/eval_policy.py` stamps source and quality-input receipts, split rule and seed;
  `data/policy-eval.json` re-run under quality filter 1.3.0 (24,114 clean logs).
- Fixed: the roles count (52, not 26) in five living documents; GURU 0.7122 → 0.7124 with the family
  statement; both VGC-Bench titles; PokeAgent arXiv id restored as verified.
- Fixed: the killed agent's "47 earned at present_at" (47 is at rate_floor 0.05; 40 at present_at 0.5).

## OWED, NOT RUN

```
python engine/nmf_roles.py            # re-run WITH quality_inputs receipts; >12 min BelowNormal on 2026-09-09, stopped by PID
python engine/nmf_rank.py 50          # 2,200 fits on 63,882 x 52; hours at this scale — not started
# Brunet cophenetic correlation: new code; needs subsampled consensus (63,882^2 is ~32 GB)
python engine/archetypes.py && python engine/guru.py && node build/build_guru_js.js   # GURU regenerate, joint with SLOWKING + WEB
node tests/test-stadium-roster.js     # red until tests/ NOT_A_CABINET / NOT_A_MODEL edits above land
```
