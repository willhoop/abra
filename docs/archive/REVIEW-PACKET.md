# ABRA — Independent Review Packet

Hand this whole file to a fresh model for an outside review. It is self-contained: it states what
the project is, every model's method and honest status, what has been validated and how, the open
gaps, and the decisions in play. If the reviewer also has the repo, file paths are given.

---

## 0. Instructions to the reviewing model

You are a tough, fair external reviewer with the standards of an **MIT statistics department chair**
at a PhD defense. Do not flatter. Hold this bar:

- Probabilities must be judged by **proper scoring rules** (log-loss, Brier), with **calibration** and
  **confidence intervals**, against **honest baselines** (coin, base rate, Elo/usage). Accuracy alone is not acceptable.
- Interrogate **construct validity**: does each number mean what it's presented to mean?
- Check whether each model's **structure can represent the phenomenon** (e.g. can it represent a non-transitive metagame?).
- Watch for **garbage-in-garbage-out**: a model on an unvalidated engine/dataset is decoration until the base is validated.
- If a model is unsound as formulated, say **scrap and rebuild**, not patch.

Deliver: (1) the one sentence that should worry us most; (2) a model-by-model teardown (claim → fatal
flaw → statistical sin → fix or rebuild); (3) cross-cutting failures; (4) a prioritized fix list;
(5) a verdict (pass / major revisions / rebuild) with the bar to flip it. Then answer the **specific
questions in §6**.

---

## 1. What the project is

**ABRA** — a live-data model family for **Pokémon Champions VGC (Reg M-B)**, a doubles format, framed
as "poker theory → Pokémon." It ingests real ladder replays (currently **5,200 games**, 32,624 turns,
3,523 observed move-damage profiles), and exposes a set of models through a whimsical single-file website
(`web/index.html`). A companion tool, **CHOMP** (a Showdown userscript), gives in-battle bring/lead advice
and carries **ORB**, a live damage calculator.

Data pipeline: `engine/durable-ingest.js` pulls replays daily (scheduled task) → `engine/refresh-site-data.py`
regenerates discovered archetypes + the site's live-data files. Archetypes are **discovered by k-means over
9,998+ real teams** (`engine/archetypes.py`), not hand-listed, and refresh as the meta shifts.

## 2. The models (each: job / method / honest status)

**JOLTEON** — instant pre-game win probability from two team sheets.
- Method: Bradley-Terry-style logistic (sum of learned per-species strengths + speed/firepower + type-coverage), sigmoid.
- Honest status: **demoted to a fast prior, not an oracle.** Held-out: ~55% accuracy but **log-loss ties a coin** (0.699 vs 0.693); only matches player-Elo; overconfident (temperature ≈ 6). Finding, not just a weak model: an additive model structurally cannot represent a non-transitive metagame.

**MEDICHAM** — grounded win rate by actually playing the matchup out (Monte-Carlo doubles rollout).
- Method: real Gen-9 doubles engine (`engine/medicham2-browser.js`). **Damage math VALIDATED vs `@smogon/calc`** (see §3). Ability/item layer (Ruin quartet, Solar Power, Guts, Adaptability, Technician, Tinted Lens, Filter/Solid Rock, Multiscale, Thick Fat, type-immunities, Expert Belt/Muscle Band/Wise Glasses), Mega abilities (base vs stone), recoil, self-stat-drop moves with **Contrary** flip, weather-speed abilities. Policy = **behaviour cloning** (samples real players' move frequencies) + take obvious KO + need-based Protect, accuracy-weighted and recoil-aware.
- Honest status: damage is validated; the **policy is the remaining GIGO lever** (behaviour-cloned, still over-credits speed control somewhat). Win rates Laplace-smoothed (never 0%/100%), carry 95% CIs.

**DITTO** — turn your seed team into the best version vs the meta.
- Method: two modes (Refine / Build). Hill-climbs on the **grounded MEDICHAM value** (JOLTEON only shortlists), scores vs all discovered archetypes with a weight floor, enforces item clause, shows an all-archetype matchup chart.
- Honest status: sound objective now that MEDICHAM's damage is validated; inherits the policy caveat.

**KADABRA** — coach a real replay.
- Method: parses the replay log, finds decisive turns, renders a **clean move-by-move walkthrough** (arrows, sprites/HP, bold "what you should've done"). Works offline (`file://`) from a local replay bundle.
- Honest status: working; coaching is **heuristic**, not equilibrium-grade (that's the future "ALAKAZAM").

**SLOWKING** — the endgame: equilibrium-best move + win% on a live position.
- Method: the poker-AI stack (CFR → DeepStack → Libratus → ReBeL) adapted to VGC. `engine/slowking/`: nash, belief (public belief state), IS-MCTS, game interface, solver, value net.
- Honest status: a **correct, unit-tested chassis, not yet a playing bot.** Search is IS-MCTS/PIMC (strategy fusion) — a rung below the ReBeL target. Verified only on toy games; not wired to the real engine.

**CHOMP / ORB** (companion userscript).
- CHOMP: bring-4/lead-2 by exact damage over the opponent's whole six. ORB: a **validated Smogon-grade damage calc** built into the dock — same engine validated vs `@smogon/calc`, reading the live battle (real stats/items, boosts, weather, terrain, Helping Hand, spread, screens). One-click install, auto-updates.

## 3. What is validated, and how

`engine/validate_damage.js` compares MEDICHAM's damage to `@smogon/calc` (MIT ground truth), **stats aligned**
so it tests the damage *math*, across 31 meta scenarios (STAB, resist, super-effective, spread, items, weather,
and each added ability). Result: **median 0% error, within 2% on 97%, within 5% on 100%, worst 3%** (16-roll
rounding). Report saved: `data/damage-validation.json`. The method that found the gaps: the calc's exact
discrepancies (e.g. −25% = unmodeled Sword of Ruin; −33% in sun = unmodeled Solar Power) named each missing
mechanic, which was then added and re-validated.

## 4. Evaluation & honesty infrastructure

- `engine/eval_harness.py` — held-out log-loss / Brier / calibration vs coin, Elo, usage baselines, bootstrap CIs.
- `engine/calibrate.py` — temperature scaling. Non-transitivity: 3 robust rock-paper-scissors cycles among archetypes (labeled preliminary — few archetypes, approximate).
- `docs/THESIS-REVIEW.md` — a prior internal MIT-chair review (this is a *re-review* against it).

## 5. Honest open gaps (not hidden)

1. **Champions rule changes vs Gen 9** (sleep, paralysis, some moves) are **NOT modelled** — the format changed mechanics and we are declining to guess them without the exact rules. Biggest current data gap.
2. **Rollout policy** is behaviour-cloned; it still over-credits speed somewhat (the "loves Staraptor" symptom). The damage under it is validated; the move-choice isn't.
3. **Enemy EVs are assumed** (unknowable — Smogon's calc has the same limit).
4. **Mega stats/types not swapped** yet (abilities are; stats/types still the base forme).
5. **JOLTEON** ties a coin on log-loss — kept only as a fast prior/shortlister, not a predictor.
6. **SLOWKING** is a chassis, not a bot; search is PIMC (strategy fusion), below ReBeL.
7. **Non-transitivity matrix** is illustrative (few archetypes, approximate), not a settled claim.

## 6. Specific questions for the reviewer

1. Given the damage engine is validated but the **policy** is behaviour-cloned, is MEDICHAM's win rate trustworthy enough to drive DITTO's team recommendations? What's the minimum bar the policy must clear (and how would you measure it)?
2. Is **discovering archetypes by k-means** over team-composition vectors a defensible way to define the meta for a Nash/matchup analysis, or does it bake in bias? Better alternatives?
3. JOLTEON ties a coin on log-loss. Is keeping it as a "fast prior / candidate shortlister" honest, or should it be cut entirely?
4. The **non-transitivity** claim rests on an approximate engine over few archetypes. What would make it a settled empirical result rather than an illustration?
5. Architecture: the app is a single-file, no-build, `file://`-openable page. Given plans for heavier models, is porting to **React + Vite (with Web Workers / WASM / a backend for compute)** the right move, a different framework, or is the compute concern orthogonal to the UI framework? What would you do?
6. Anything presented as more certain than the evidence supports?

## 7. Key files

- Site: `web/index.html` (engine embedded), synced to `app/index.html`. Live data: `data/live.js`, `data/archetypes.json`, `data/kad-replays.js`.
- Engine: `engine/medicham2-browser.js`; validation `engine/validate_damage.js` + `data/damage-validation.json`.
- Data/refresh: `engine/durable-ingest.js`, `engine/archetypes.py`, `engine/refresh-site-data.py`.
- SLOWKING: `engine/slowking/*`. Docs: `docs/MODELS.md` (living reference), `CHANGELOG.md`, `docs/THESIS-REVIEW.md`, `docs/POKER-TO-POKEMON.md`.
- CHOMP/ORB: separate repo `github.com/willhoop/chomp`, install file `app/plugin/chomp-bring4.user.js`.
