# ABRA — the model family (living reference)

The single source of truth for what each model **is**, **how it works**, its **honest current status**, and **where the code lives**. Updated as models change. Last updated: 2026-07-23.

Guiding principle: **garbage in, garbage out.** The browser engine's **damage math is now validated** against `@smogon/calc` (within 5% on 100% of tested scenarios — see MEDICHAM below). The remaining GIGO caveats are the rollout *policy* and format-specific data (Champions rule changes, some Mega/ability specifics) — stated per-model.

---

## JOLTEON — Joint Odds, Ladder-Trained Expected-Outcome Network
**Job:** instant pre-game win probability from two team sheets.
**Method:** Bradley-Terry-style logistic — sum of learned per-species strengths + speed/firepower edges + a team-vs-team type-coverage term, through a sigmoid. Rarity-aware L2 shrinkage; recency-weighted.
**Honest status:** **demoted to a fast prior, not an oracle.** Held-out backtest (`eval_harness.py`): accuracy ~55% (at the format's skill ceiling) but **log-loss ties a coin** (0.699 vs 0.693) and only matches player-Elo. Overconfident (temperature ≈ 6 to calibrate). The team sheet simply doesn't determine the winner much in a non-transitive, high-variance format — that's a real finding, not just a weak model.
**Code:** `engine/jolteon.py` (train), `pwin()` in `web/index.html` (deployed).
**Open:** add a low-rank non-transitive interaction term; it's the only lever left and won't move the ceiling much.

## MEDICHAM — Matchup Evaluation, Damage-Informed CHOMP-Heuristic Approximate Moves
**Job:** grounded win rate by actually playing the matchup out.
**Method:** real Gen-9 **doubles** Monte-Carlo rollout (`engine/medicham2-browser.js`, embedded as `MEDI2` in the site). Damage formula with boosts, spread ×0.75, crit, rolls, STAB, type, weather, Trick Room, Tailwind, priority, Protect, items (scarf/band/specs/AV/Life Orb/leftovers/sitrus/**Expert Belt/Muscle Band/Wise Glasses**), and a **validated ability/item layer** (Ruin quartet, Solar Power, Guts, Orichalcum Pulse, Hadron Engine, Adaptability, Technician, Tinted Lens, Filter/Solid Rock, Multiscale, Thick Fat, Heatproof, Purifying Salt, type-immunity abilities). **Mega abilities tracked** (base vs Mega stone: Staraptor→Contrary, Swampert→Swift Swim, + canonical Megas). Status, Fake Out flinch, **recoil**, **self-stat-drop moves with Contrary flip**, **weather-speed abilities** (Swift Swim etc.). Policy = **behaviour cloning** (samples the move real players click) + take an obvious KO + need-based Protect, now **accuracy-weighted** (a 70% nuke isn't a guaranteed KO) and recoil-aware (reduces the fast-frail over-crediting).
**Honest status:** big improvement over the old 1v1 chain (which gave 0%/100%). Mirror 0.50, healthy spread, 400 rollouts in ~30ms, results carry a 95% CI on the site. **The damage math is now VALIDATED** against `@smogon/calc` (MIT ground truth): with stats aligned, MEDICHAM matches the calc to the integer on 18/22 meta scenarios; after adding the Ruin quartet + Solar Power + Guts, it's **within 5% on 100% of scenarios, median error 0%** (worst 3% = 16-roll rounding). See `engine/validate_damage.js` and `data/damage-validation.json`. The remaining caveat is the *policy* (behaviour-cloned; over-credits speed control), not the damage numbers.
**Code:** `engine/medicham2-browser.js`; `mcWinProb`/`mcWinProbI` in the site delegate to it (now Laplace-smoothed so a rollout can never read 0%/100%). Abilities patched from a curated meta map; move names + items from real ladder sets.
**Open:** **Champions rule changes vs Gen 9 (sleep, paralysis, specific moves) are NOT yet modelled — pending the exact format rules** (flagged rather than guessed). Also: DAgger/improve the rollout policy; Protosynthesis/Quark Drive stat boosts; Mega stat/type swaps (abilities are done, stats aren't). Validation harness: `engine/validate_damage.js`, report `data/damage-validation.json`.

## DITTO — Double-oracle Iterative Team-Tuning Optimiser
**Job:** turn your seed team into the best version against the live meta.
**Method (as of 2026-07-23):** (1) solves the **Nash equilibrium** over the archetype match-up matrix (`data/meta-nash.json`: Rain/Sand/FakeOut), (2) **best-responds to that equilibrium**, and — the key fix — the hill-climb now optimises the **grounded MEDICHAM value**, using JOLTEON only to shortlist candidates. Enforces the **item clause** (one item per team). (3) reports a per-archetype **matchup bar chart** ("how your team does vs the meta") and names your exploiters.
**Honest status:** the earlier version optimised JOLTEON (≈coin) and produced junk teams JOLTEON loved but MEDICHAM rated ~18% — fixed by optimising MEDICHAM directly. Still inherits MEDICHAM's unvalidated-engine caveat (GIGO). Confidence numbers (e.g. 84%) are against only the 3-archetype equilibrium and run high.
**Code:** `runDitto()` in `web/index.html`; `engine/slowking/nash.py` provides the equilibrium math.
**Open:** true *iterated* double-oracle (grow the population, best-respond, repeat); more archetypes.

## KADABRA — Key Analysis of Decisions, Advice & Better Replay Annotation
**Job:** coach a real replay — take you to the turns that mattered.
**Method (as of 2026-07-23):** parses the replay log to find decisive turns (KOs, losses), then runs a **clean move-by-move walkthrough** — big prev/next arrows, sprites + HP each key turn, and a bold **"what you should've done"** panel with the prescriptive fix. No Showdown iframe (dropped as clutter). **Works offline (`file://`)**: coaches from a locally-bundled set of recent games (`data/kad-replays.js`), with a recent-games picker and a raw-log paste fallback.
**Honest status:** working offline; coaching is heuristic ("you traded X for nothing — Protect/pivot keeps it alive"), not yet equilibrium-grade — that's ALAKAZAM, later.
**Code:** `runKadabra`, `kadCoach`, `kadPickerUI`, `kadBuild`, `renderKad` in `web/index.html`; bundle from `engine/refresh-site-data.py`.
**Open:** deeper per-turn analysis (win-prob delta per decision) once the engine + value net are wired.

## SLOWKING — Search over Learned Opponent-belief World, Knowledge-Intensive Nash Game-solver
**Job:** the endgame — tell you the equilibrium-best move (and win %) on a live position.
**Method:** the poker-AI stack (CFR → DeepStack → Libratus → ReBeL) adapted to VGC. `engine/slowking/`: `nash.py` (equilibrium, verified on RPS/2×2), `belief.py` (public-belief-state + Bayesian filter), `ismcts.py` (simultaneous-move regret matching, recovers exact Nash), `game.py` (engine interface), `solver.py` (team-preview Nash + continual re-solve → bring **mix** + win%), `value.py` (learned leaf evaluator).
**Honest status:** a **correct, unit-tested chassis, not yet a playing bot.** The current search is IS-MCTS/PIMC (strategy fusion) — a rung below the ReBeL target. Verified only on toy games; not yet wired to the real engine.
**Code:** `engine/slowking/*`; white paper `docs/POKER-TO-POKEMON.md`.
**Open:** wire `ChampionsGame` to the real engine; PIMC → outcome-sampling MCCFR / PBS re-solving; train the value net via self-play.

## The learning core (the flywheel)
**value net:** `engine/train_value.py` reconstructs per-turn HP state and regresses the outcome → `data/value-net.json`. Beats a coin (log-loss 0.682), calibrated, compressed at the tails (thin data). It's SLOWKING's leaf evaluator.
**self-play:** `sim/generate-dataset.js` writes engine games into the store schema (unlimited, unbiased data).
**flywheel:** `engine/flywheel.py` — self-play → retrain → re-evaluate → report the delta. The thing that makes ABRA *learn over time*.

## CHOMP / ORB (companion tools, separate repo)
**CHOMP** — the bring-4/lead-2 decision engine (Showdown userscript). Picks your best 4 and 2 leads by exact damage over the opponent's whole six. *Open:* bring/lead should be a minimax matrix game (`nash.py`), not greedy coverage.
**ORB** — On-battle Read Board, the damage calculator. **Direction (2026-07-23):** the Smogon calc is MIT open source, so ORB = a **self-hosted fork of the Smogon Champions calc** with our auto-fill layer (same-origin, so it *can* auto-populate — unlike the hosted official one). Recipe in `docs/ORB-smogon-fork.md`. A minimizable in-battle dock (`chomp-orb.user.js`) that auto-fills both teams from preview is in progress.

---

## Evaluation & honesty (cross-cutting)
- `engine/eval_harness.py` — held-out log-loss / Brier / calibration vs coin, Elo, usage baselines with bootstrap CIs. **The bar every model must clear.**
- `engine/calibrate.py` — temperature scaling.
- `docs/THESIS-REVIEW.md` / `THESIS-REVIEW-v2.md` — strict self-critique with fixes (willing to scrap/rebuild).
- `docs/COMPETITORS.md` — VGC-Bench, PokéLLMon, offline-RL transformers, and how we refine them.
- Non-transitivity: `data/nontransitivity.json` — the meta is rock-paper-scissors (labeled preliminary, approximate engine).

## The one thing that unblocks everything
**Wire + validate the open Showdown engine** (`sim/`). Until then, MEDICHAM/DITTO/SLOWKING/value-net all rest on an unvalidated engine. Validating it converts ABRA from "a beautiful, honest approximation" into "validated."
