# Changelog — ABRA

All notable changes to ABRA are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Rule.** Every change is logged here in the same pass as the code, together with the matching
updates to the white paper, the deck, and the technical documentation. A prior conclusion is never
silently rewritten; what changed and why is stated.

---

## [2.3.0] — 2026-07-23

### Added
- **SLOWKING preview-Nash** (`engine/slowking_preview.py` → `data/slowking-eval.json`, `data/slowking.js`): solves GURU's real 13-archetype matchup matrix (5,199 games) to an equilibrium mixed strategy and grades it by **exploitability** (the spec's acceptance bar for the strategic layer) against greedy-single-deck and uniform baselines, with a bootstrap CI that propagates matchup-count uncertainty (Beta resampling). Also reports the strongest **non-transitive 3-cycle** in the meta.
- **Playstyle layer** (`engine/playstyle.js` → `data/playstyle-matchups.json`; SLOWKING re-run with `MATRIX_FILE=…/playstyle TAG=playstyle` → `data/slowking-playstyle-eval.json`): a rule-based classifier tags each real team by playstyle (TrickRoom / Rain / Sun / Sand / Snow / Setup / PerishTrap / TailwindOffense / FakeOutBalance / Stall / HyperOffense) and builds a playstyle×playstyle matrix from 2,866 games. **This is where the non-transitivity is real:** greedy single-playstyle exploitability 0.115 vs Nash 0.0002, gap CI [0.001, 0.280] (clears 0), with a clean cycle **TrickRoom → HyperOffense → Sand → TrickRoom** (~0.115 edge/leg). Equilibrium: Rain 0.51 / Sand 0.26 / HyperOffense 0.10 / Setup / PerishTrap / Snow.
- **Test + CI:** `tests/test-slowking.py` — a hand-derived Rock-Paper-Scissors unit test of the Nash solver (answer is uniform, value 0) plus shipped-artifact invariants; gated in the `tests` workflow (regenerates the artifact then checks it).
- **Portfolio:** ABRA added to `willhoop.github.io` as a one-object entry in the `PROJECTS` array (its own convention), leading with a measured number (PORY 0.567 vs coin 0.693). A `PUSH-TO-GITHUB.bat` was added to the portfolio repo for one-click publishing.

### Findings (honest)
- **Equilibrium mixture:** Kingambit-Basculegion 0.84 / Garchomp-Incineroar 0.16. Exploitability **Nash ≈ 0 vs uniform 0.109** — mixing over the right decks is far less exploitable than spreading evenly.
- **Greedy ≈ Nash at the archetype level:** this meta is currently near-transitive (a dominant deck), so "pick the single best deck" is about as unexploitable as the equilibrium *right now* — stated plainly rather than spun as a win for mixing. **However** a real rock-paper-scissors cycle exists (Charizard-Venusaur → Whimsicott-Garchomp → Garchomp-Incineroar → back, ~0.10 edge/leg), and the greedy-vs-Nash gap CI reaches 0.27, so under plausible resamples the meta is non-transitive. Finer, playstyle-level archetypes (stall / Trick Room / perish-trap / setup) would expose more cycles — the documented next refinement.

### Notes
- Archetype-level, not set-level: SLOWKING solves over 13 discovered archetypes, not exact teams/sets; a belief over the opponent's real six (XATU) is the next refinement. Exploitability grades the preview *decision*, never who wins a match (GURU's own predictive test ties a coin).

---

## [2.2.0] — 2026-07-23

The v2 decision-stack release: stop predicting winners, support decisions. Models built + graded
this session, each with a proper score + clustered-by-game CI + honest baseline, persisted to JSON.

### Added
- **GURU** — meta/matchup matrix from REAL game outcomes with Wilson CIs (`engine/guru.py` → `data/guru.js`). Replaces the biased *simulated* payoff matrix at the source.
- **XATU** — opponent belief (item/ability/moves) inferred from replays (`engine/xatu.py` → `data/xatu.js`).
- **PORY** — mid-game win-prob value net from real replays (`engine/pory.py` → `data/pory.js`). **The win:** held-out log-loss **0.567 vs coin 0.693**, beats a material-sign heuristic, calibrated (ECE 1.6%), clustered-by-game CI [0.548, 0.583]. Proves the v2 pivot — mid-game state is predictable even though pre-game sheets are not.
- **PORY wired into KADABRA:** the coach now shows a per-turn **"you're at X%"** chip at each key moment, computed in-browser from `data/pory.js` (site includes it now). `web/index.html` `kadBuild`/`renderKad`; mirrored to `app/`.
- **CHOMP-EV proof** (`engine/chomp_ev.js` → `data/chomp-ev.json`): the winnable team-preview test — do CHOMP's recommended brings beat humans' actual brings on held-out games? Ranks each side's actual bring among all 15 candidate brings by CHOMP exact-damage coverage; headline sign test + held-out logistic log-loss (Brier too), clustered bootstrap CI, baselines = coin / Elo / usage-prior, plus a forfeit-robustness pass and a measured selection audit.
- **Test + CI:** `tests/test-chomp-ev.js` validates the committed `data/chomp-ev.json` invariants (split bookkeeping, score ranges, CI brackets, verdict-vs-numbers consistency, honesty block); gated in the `tests` workflow.

### Findings (honest)
- **CHOMP-EV is a NULL at the format ceiling.** On 1,205 held-out human games, CHOMP's bring ranking does **not** beat a coin (log-loss 0.6918 vs 0.6931, CIs overlap), ties an Elo and a usage-prior baseline, and winners are only marginally more CHOMP-aligned than losers (0.512, CI [0.493, 0.535] — includes 0.5). CHOMP's top pick matches the human bring ~9.5% of the time (chance 6.7%). **Robust:** dropping all forfeits leaves it unchanged (0.505; log-loss 0.690 vs 0.693). **Selection audit:** eval games average 6.5 turns / 1280 rating vs 6.08 / 1267 excluded — a mild bias that, if anything, *favors* CHOMP, making the null conservative.
- **What this does NOT impugn:** CHOMP's damage math stays VALIDATED vs `@smogon/calc`; the null is about the *bring-selection signal*, which sits at the same near-coin ceiling as pre-game win prediction. It guards against optimizing a bring metric with no held-out winning signal (the DITTO/Goodhart trap). Path to a real edge: score brings with belief-aware value (XATU) + the lead stage-game (SLOWKING) + PORY leaf value, then re-run this exact test.

### Notes
- White paper and plain-English deck updates for GURU/XATU/PORY/CHOMP-EV are still pending (this pass shipped code + CHANGELOG + MODELS/HANDOFF; the long-form docs are the next documentation pass).

---

## [2.1.0] — 2026-07-23

### Validated
- **MEDICHAM damage engine validated against `@smogon/calc`** (`engine/validate_damage.js`): with stats aligned, matches the ground-truth calc within 5% on 100% of 31 meta scenarios (median 0% error). Fixed the level-50 harness bug, then closed the ability gaps it surfaced.

### Added
- **Ability/item layer, each validated vs Smogon:** Ruin quartet, Solar Power, Guts, Orichalcum Pulse, Hadron Engine, Adaptability, Technician, Tinted Lens, Filter/Solid Rock, Multiscale, Thick Fat, Heatproof, Purifying Salt, type-immunity abilities, Expert Belt, Muscle Band, Wise Glasses.
- **DITTO policy hardening:** accuracy-weighted move value, recoil cost, self-stat-drop moves (Close Combat/Superpower/Overheat) with **Contrary** flip, **Mega ability tracking** (base vs Mega stone — Staraptor→Contrary, Swampert→Swift Swim + canonical Megas), weather-speed abilities (Swift Swim/Chlorophyll/Sand Rush/Slush Rush). Reduces the speed/frailty over-crediting (the Staraptor problem).
- **Site now grows:** `data/live.js` (counts + data-derived archetypes) and `data/kad-replays.js` (offline replay bundle) regenerate via `engine/refresh-site-data.py`, run by the daily replay pull. Town stats + DITTO archetypes read live.
- **Archetypes discovered from data** (`engine/archetypes.py`, k-means over 9,998+ real teams), not hand-listed — refreshes as the meta shifts.
- **ORB (CHOMP dock) upgraded to a validated Smogon-grade substitute:** reads live stats/items/boosts/weather/terrain/Helping Hand/spread/screens, shows applied conditions. One-click install; auto-updates.

### Fixed
- KADABRA works offline (`file://`) — coaches from the local bundle, clean move-by-move viewer with arrows and a bold "what you should've done" (dropped the Showdown iframe clutter).
- Abilities corrected from a curated meta map (no more bogus "Pressure"); real move names + spacing; Laplace smoothing so win rates never read 0%/100%.
- Non-transitivity view rebuilt as big whimsical rock-paper-scissors loops (no tiny text). Town card honesty (daily, real counts). Footer/sprite overlap.

### Known gaps (not guessed — need confirmation)
- **Champions rule changes vs Gen 9** (sleep, paralysis, specific move changes) are NOT yet modelled — pending the exact format rules.
- Enemy EVs are assumed (unknowable). Mega **stats/types** not yet swapped (abilities are).

---

## [2.0.0] — 2026-07-23

The "honest instrument" release: a real doubles engine, an evaluation layer that grades every
probability, the SLOWKING belief-search stack, and the first learned value function (the flywheel's
core). Also a strict self-review that reshaped the roadmap.

### Added
- **MEDICHAM v3 — real Gen-9 doubles engine** (`engine/medicham2-browser.js`, embedded in the site):
  replaces the 1v1 OHKO-chain that collapsed to 0%/100%. Damage formula with boosts/spread/crit/rolls,
  weather, Trick Room, Tailwind, priority, Protect, items, abilities, Fake Out; behaviour-cloned policy
  (samples real move rates), need-based Protect. Verified: mirror 0.50, healthy distribution, 400
  rollouts/29ms. Win rates now carry a 95% CI on the site.
- **Evaluation harness** (`engine/eval_harness.py`): temporal held-out log-loss / Brier / calibration
  vs coin, player-Elo, and usage baselines with bootstrap CIs. **Verdict: JOLTEON ties a coin in
  log-loss** — demoted from headline predictor to fast prior + baseline; site copy made honest.
- **Calibration** (`engine/calibrate.py`): temperature scaling; the Python JOLTEON was 6× overconfident.
- **Learned in-battle value function** (`engine/train_value.py` → `data/value-net.json`): reconstructs
  per-turn HP state and regresses the outcome. Beats a coin (log-loss 0.682) and is calibrated — the
  first genuinely learned, calibrated component, and the leaf evaluator + flywheel core.
- **SLOWKING infrastructure** (`engine/slowking/`): `nash.py` (equilibrium, verified on RPS/2×2),
  `belief.py` (public-belief-state + Bayesian filter), `ismcts.py` (simultaneous-move regret matching,
  recovers exact Nash), `game.py` (engine interface), `solver.py` (team-preview Nash + continual
  re-solve; returns bring *mixes* + win%), `value.py` (loads the learned leaf). All unit-tested.
- **Self-play data pipeline** (`sim/generate-dataset.js`) writing engine games into the store schema —
  the unlimited, unbiased "more games" path. Scraper default raised 2→25 pages (~10× per run).
- **Non-transitivity finding** (`data/nontransitivity.json`, DITTO tab): the meta is rock-paper-scissors
  (3 robust cycles after noise control) — empirical proof an additive rating can't capture it. Shown
  with an explicit "preliminary, thin data" caveat.
- **Docs:** `docs/POKER-TO-POKEMON.md` (the founding white paper), `docs/THESIS-REVIEW.md` +
  `docs/THESIS-REVIEW-v2.md` (strict self-critique with fixes), `docs/COMPETITORS.md` (VGC-Bench et al.
  and how we refine them), `docs/OVERNIGHT-HANDOFF.md`.
- **Site:** in-browser DITTO (item tuning + PokéPaste export) and KADABRA (client-side replay coach);
  MEDICHAM/DITTO use the sprite picker; saved-teams in the matchup; ORB opens from Chomp's room;
  per-room personality mascots; threats table with sample-adjusted Win%, real speed, Games column.

### Changed / Honest corrections
- JOLTEON reframed as a fast prior, not an oracle (backtest: ~coin in log-loss).
- White paper corrected: the current SLOWKING search is IS-MCTS/PIMC (strategy fusion), a rung below
  the ReBeL target — no longer overclaimed.
- Non-transitivity presented as preliminary (approximate engine, small sample), not a settled claim.

### Fixed
- MEDICHAM special-move bug (special attackers dealt 0 damage); booth slot regression that broke
  "Surprise me"; DITTO/KADABRA no longer require a server.

---

## [1.0.0] — 2026-07-22

### Added
- **ABRA is born**, split out from CHOMP as its own project: the Automated Battle Replay Analyzer.
  CHOMP stays the bring-4/lead-2 engine; ABRA is the meta-analysis brain that feeds it.
- **Durable, incremental, no-redo ingest** (`engine/durable-ingest.js`): pulls public Champions
  Reg M-B replays from the Showdown API (paginated, ~200 logs/sec, concurrent), stores every game
  raw and tagged — both teams' six, brings, leads, observed moves/items/abilities, result, both
  ratings, and a bot flag. Appends only new games (dedup by id). Tested on 1,501 real ladder games.
- **Analysis over the store** (`engine/analyze.js`): usage model at any rating cutoff / humans-only,
  plus a personal split by Showdown username. Writes `data/meta-usage.json` for CHOMP.
- **`ME` alias list** so a Showdown rename is a one-word edit, never a re-pull.
- `tests/test-parse.js` — 12 hand-derived checks on the replay extractor (teams, leads, brings,
  observed set fields, bot flag, rating, date).
- Governance: LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, .gitignore, CI workflow.

### Validated
- High-ladder filter (humans, 1300+) reveals real signal distinct from the raw ladder — e.g.
  Kingambit 62% win, Incineroar 65% — confirming the tag-and-filter design earns its keep.

## [1.1.0] — 2026-07-22

### Changed
- **Reframed to its true scope.** ABRA is documented as the live-data platform whose purpose is to
  feed a simulator that models games and teams — a self-improving flywheel (collect → simulate →
  optimise teams → play with CHOMP → auto-ingest enemy teams → improve). CHOMP is one small early
  consumer, not the point. White paper §8 states the flywheel and the honest built-vs-roadmap status.

## [1.2.0] — 2026-07-22

### Added
- **Simulator research white paper** (`docs/ABRA-simulator-whitepaper.md`): an MIT-level treatment of
  learning a VGC battle simulator from logged replays. Formalises the game (POSG, imperfect info,
  simultaneous moves), derives three modelling tiers with their estimators and failure modes, frames
  team optimisation and the self-improving flywheel, and grounds every claim in the 2025 literature
  (PokéChamp, Metamon, VGC-Bench, ReBeL/Player-of-Games, Sampled/Gumbel MuZero, offline RL). Names the
  model family in the CHOMP/ABRA tradition — **JOLTEON** (fastest, win-prob),
  **MEDICHAM** (Rapidash, rollouts), **SLOWKING** (slow deep learned dynamics), **DITTO** (team
  optimiser) — speed of the Pokémon matches the cost of the model. Folds in CHOMP's pKO threat scoring
  as JOLTEON's features and MEDICHAM's dynamics (grey-box modelling).

## [1.6.0] — 2026-07-23

### Major finding
- **The Champions engine is OPEN, not closed** (`docs/OPEN-ENGINE-FINDING.md`). Verified by cloning
  `smogon/pokemon-showdown`: the exact format `[Gen 9 Champions] VGC 2026 Reg M-B` (and its Bo3
  variant) is in `config/formats.ts`, backed by a full `champions` mod (SP system in
  `data/mods/champions/scripts.ts`). This overturns the project's founding assumption. SLOWKING no
  longer needs to *learn* the dynamics — it can query the real engine (ReBeL over a known simulator),
  and MEDICHAM/DITTO/JOLTEON can use exact rollouts + self-play. SLOWKING white paper §3 corrected;
  roadmap task added to wire the engine as ABRA's simulator.

### Added
- **MEDICHAM runs in the browser** — the damage engine, type chart, sets, and behaviour-clone priors
  (96KB) are embedded in `web/index.html`; the rollout runs client-side (~40ms / 200 rollouts). The
  "MEDICHAM check" button and Medicham's run panel now work with **no server**. Validated: mirror
  0.53, rain-vs-sun 0.19 (matches the Node engine).
- **Combined team+rating predictor** (`engine/predictability.py` §2.5): the real pre-game ceiling is
  ~57% — combining team sheets AND player ratings does no better than team alone, confirming the game
  is variance-dominated (and that the two ~55%s are different axes that corroborate, not the same
  claim). Predictability study updated with the honest framing.
- **ABRA MCP server** (`mcp/`): exposes the models as tools Claude can call — `abra_win_probability`
  (JOLTEON), `abra_rollout` (MEDICHAM), `abra_threats`, `abra_species_stats`, `abra_optimize_team`
  (DITTO), `abra_coach_replay` (KADABRA). Local stdio server; `claude mcp add abra -- node mcp/server.js`.
- **Regulation registry + archive** (`data/regulations.json`, `build/archive-regulation.js`): the
  active regulation is a one-line config edit; ingest/analysis read it. When a reg ends,
  `archive-regulation.js` snapshots the store + all models into `data/archive/<id>/` (date-stamped,
  with a manifest) so previous-regulation data is preserved forever. `--rotate` starts a fresh store.
- **Mega Evolution** added to the game's action model (SLOWKING white paper §2) as a per-turn step.
- **Ditto page rebuilt**: team-builder on top + a live, sortable/searchable **threat rankings table**
  (usage / bring / lead / win% / speed) from the real stats; static chips removed.
- **Team carries between models** (localStorage), hover-× to remove a Pokémon / clear team, usage-
  ranked picker, in-browser MEDICHAM, lightning flash on JOLTEON, confetti idle-loop stopped.
- **Omnibus is now robust** (`build/omnibus.py`): always emits a self-contained HTML (SVG embedded
  directly, no LibreOffice), attempts the PDF only if `OMNIBUS_PDF=1` — reproduces the Special Cut
  reliably as the docs grow.
- New docs sewn into the Special Cut: predictability study, SLOWKING white paper + roadmap,
  architecture notes.

## [1.5.0] — 2026-07-23

### Added
- **Recency weighting (concept-drift decay)** in JOLTEON: every training game is weighted
  `w = 0.5 ** (age_days / τ)` with a half-life τ (default 30d), so the models track the *live*
  metagame instead of averaging over stale history. Normalised to mean 1 (L2 scale unchanged);
  `τ → ∞` recovers equal weighting. No-op on the current 2-day store (reported honestly);
  unit-verified on synthetic 90-day data (oldest 0.33, newest 2.14). Same rule applies to the usage
  model and behaviour-clone. Fully documented in `docs/ARCHITECTURE-NOTES.md`.
- **SLOWKING white paper** (`docs/SLOWKING-whitepaper.md`): the definitive Tier-3 design — offline
  belief-state search over a *learned grey-box model* of the *closed* Champions engine (residual over
  CHOMP), simultaneous-move mixed-Nash subgames, warm-started by the behaviour-clone. Grounded in
  ReBeL, Student of Games, PokéChamp (ICML 2025), Gumbel MuZero, Metamon. Plus a
  **research roadmap** (`docs/SLOWKING-research-roadmap.md`) turning it into five buildable papers.
- **SLOWKING Paper-1 built** (`engine/game-spec.js`): encodes stored replays into
  `(state, observation, action, reward)` trajectories — 30,608 real state-transitions with actions and
  terminal rewards. The offline dataset a Tier-3 solver trains on; a re-parse, never a re-pull.
- **Behaviour-clone + status/field MEDICHAM v2** (`engine/policy.js`, `engine/moves-meta.js`,
  `engine/medicham.js`): the rollout now samples *what real players click* (Tailwind 34% for
  Whimsicott, Fake Out 30% for Incineroar, …) and applies the effects — sleep, burn, paralysis,
  Tailwind (2× speed), Trick Room (inverted order), setup boosts, Protect. Speed control and setup are
  now *valued emergently*. Fixed a faint-and-replace symmetry bug (mirror back to ~0.50) and gated
  support on survival (don't set up into a KO). `tests/test-medicham.js`, `tests/test-dynamics.js`.
- **DITTO ported to Node** (`engine/ditto.js`): the whole live app now runs with **no Python**.
  JOLTEON scoring reimplemented in JS from the trained weights; **MEDICHAM wired in natively as the
  finalist re-ranker** (coarse-to-fine: JOLTEON proposes thousands, MEDICHAM decides the finalists).
  In a real run MEDICHAM overruled JOLTEON — chose the rain team (75.7%) over JOLTEON's tyranitar pick
  (68% grounded vs 79.8% JOLTEON). `server.js` `/api/ditto` now calls Node.
- **Local app + server** (`server.js`, `start.bat`, `app/`): the site is served from `app/` and runs
  the real engines on the user's machine (MEDICHAM/KADABRA/DITTO via Node, JOLTEON in-page). Lazy,
  robust Python probe (skips the Windows Store stub) kept only for optional JOLTEON *retraining*.
  Booth is searchable and usage-ranked; team-builder enlarged; live "MEDICHAM check" button.
- **Multi-format + open-sheet tags**, **dedup-by-replay-id everywhere** (never double-count a game
  reviewed or self-uploaded), **per-turn extractor + raw-log archive** (any new field is a re-parse).
- **ABRA WORLD website** with per-model "How X thinks" panels, teleporting-Abra background,
  usage-ranked sprite picker, PokéPaste input (accepts any species; off-roster treated as neutral).
- `docs/ARCHITECTURE-NOTES.md`: the Python/JS split rationale and the recency-weighting design, in
  detail.

### Changed
- Model labels describe the role (win probability, battle rollouts, team optimiser, replay coach,
  belief search, bring-4 engine), not the Pokémon name twice.

### Queued
- **ORB** — CHOMP's auto-fill mid-game calculator (the Life Orb of the CHOMP family): pulls your six
  (moves/items/EVs) and the opponent's revealed team from the live battle so there's nothing to type
  mid-game; opens in its own tab.

## [1.4.0] — 2026-07-22

### Added — the model family (the simulator, stages 2–3, now has working v1s)
- **Per-turn extraction** (`engine/durable-ingest.js` v2): the extractor now captures a per-turn
  event stream — move order (→ speed), exact damage % per move, faints, status, and reveals — on
  every game. Backfilled onto all 4,999 games: **30,611 turns, 55,336 damaging move events.**
- **Raw-log archive + `MODE=reparse`**: each raw `.log` is archived (`data/*.raw-logs.jsonl`), so any
  NEW field is a re-parse, never a re-pull. Proven by backfilling `format`/`openSheet` onto 4,999
  games with **zero network calls.** (Archive is gitignored; the extracted store carries the turns.)
- **Dynamics model** (`engine/dynamics.js` → `data/dynamics.json`): observed speed (who-moves-first,
  incl. Choice-Scarf hints) for 186 species, and observed damage distributions for 1,170
  (attacker, move) pairs. E.g. Garchomp Earthquake mean 57%, Basculegion Wave Crash 62.5%.
- **JOLTEON v2** (`engine/jolteon.py`): win-probability model gains **rarity-aware L2 shrinkage**
  (a species seen 25× is pulled toward neutral; seen 1000× is trusted — a Goodhart guard at the
  model level) plus speed-edge and firepower-edge features from the dynamics model. Honest result:
  ~55% humans-only held-out vs ~49% coin flip; the dynamics features tie species-only (firepower
  earns weight +0.30, speed-edge is noise at this scale). Reported straight.
- **MEDICHAM built** (`engine/medicham.js`): Tier-2 Monte-Carlo rollout over CHOMP's exact damage
  engine. Rain core beats sun core 0.60; mirror 0.51; ~1s / 300 playouts. Sequential-singles v1
  (honest scope). `tests/test-medicham.js`.
- **DITTO built** (`engine/ditto.py`): team optimiser using JOLTEON as evaluator against a gauntlet
  of REAL ladder teams, double-oracle rounds, **usage-weighted threat coverage** (guarantees an
  answer to high-bring threats like Basculegion, ignores rare ones like Camerupt), and a **bias
  report** showing where rarity shrinkage suppresses a pick. Surfaces the Goodhart failure honestly:
  JOLTEON-optimised "90%" team → MEDICHAM rollouts reveal ~12% → this is *why* Tier-2 vets Tier-1.
- **KADABRA v1 built** (`engine/kadabra.js`): turn-by-turn coach over a replay — reconstructs each
  scene, gives the speed read + damage read (cross-checked vs the ladder average, flags high/low
  rolls), draws the lesson, and background-appends the game (the flywheel from the coaching seat).
- **SLOWKING scaffold** (`engine/slowking.py`): Tier-3 interface fixed + data-readiness report;
  honestly flagged as a research effort, not a trained model.
- **Multi-format + open-sheet tags**: `FORMATS=` env supports collecting other ladders (e.g. the
  Reg-G best-of-3); every record now carries `format` and `openSheet` (bo3 / agreed open team sheet
  is a distinct information regime). 42 open-sheet games found in the current store.
- **ABRA WORLD website** (`web/index.html`): a Club-Penguin-styled interactive town — one room per
  model — with the JOLTEON win-probability model running live client-side (real embedded weights),
  sprite team pickers, animated odds meter, and links to the rest of the portfolio.
- Tests: `tests/test-medicham.js`, `tests/test-dynamics.js` (all green alongside parse + jolteon).

### Changed
- The flywheel's honest status advances: stages 2 (simulate) and 3 (optimise) now have working v1
  models (MEDICHAM, DITTO), with the tiered vetting (Tier-1 proposes, Tier-2 checks) demonstrated
  end-to-end. Tier-3 depth (SLOWKING) remains roadmap.

## [1.3.0] — 2026-07-22

### Added
- **JOLTEON v1 built** (`engine/jolteon.py`) — the Tier-1 win-probability model, a Bradley–Terry
  logistic over per-species strengths with a min-sample floor (anti-overfit). Trained on 5,000 real
  ladder games (temporal split, humans only). **Measured: 56.6% held-out accuracy vs 49.6% baseline**,
  Brier 0.251 (calibrated) — a real, honest, modest edge from team composition alone, as the domain's
  variance predicts. Ships a `predict` CLI and `tests/test-jolteon.py` (antisymmetry, mirror=50%,
  coverage, range). Model saved to `data/jolteon-weights.json`.
- **Full ladder pulled** — the durable store grew from 1,501 to **5,000 games** (incremental, dedup).

### Notes
- The first training on 1,501 games did **not** beat the baseline; more data (5,000) and a min-sample
  floor were what cleared it. Recorded honestly: this is why the flywheel (more games over time) and
  damage-grounded features (§4.3.1) matter, not species identity alone.
