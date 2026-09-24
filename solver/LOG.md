# Solver log

Running log of the new solver stack (everything except MEDICHAM, rebuilt from scratch for Reg M-C,
open team sheets). Newest first. Each entry: what landed, the verdict, where the detail lives.
Roadmap page: https://claude.ai/artifact/3Xd2MvVhdE3xdZqsFDbmDG

---

## 2026-09-24

### MAG v1 + DODUO v1 (successors to prior v0)
- MAG v1 = per-slot scorer (v0 features + species identities, candidate-set pooling); DODUO v1 = joint
  coordinator over MAG (pairwise MLP + bilinear + v0 pair indicators). PyTorch 2.14.0+cpu (PyPI).
- Same player split as v0 (val/test tensors byte-identical). Test players, exact joints: DODUO log-loss
  **2.730 vs v0 2.921**, recall@4/8/12/16 **55.4 / 72.5 / 81.4 / 87.2** vs 50.3 / 66.5 / 76.5 / 83.1; every
  paired CI clear of zero. MAG alone (no pair term) 2.823, @16 85.7 — also beats v0.
- Weak spots improved most, still weakest: switch @16 74.8 → 80.6, turn 1 @16 76.0 → 81.6.
- Node forward pass matches Python to 2.1e-14 on 76 decisions; `solver/tests/test-mag-doduo.js` GREEN
  3,826/3,826, red on four deliberate breaks first. Dataset sha256 stamped in both model files.
- Detail: `docs/_reports/2026-09-24-mag-doduo-v1.md`; code `solver/mag/`.

---

## 2026-09-23

### Human policy prior v0
- Predicts P(joint action | state, both sheets) from the human dataset; no simulator.
- Held-out by acting player (4,892 / 603 / 620 players). Joint recall of the human's exact joint action:
  top-4 50.3%, top-8 66.5%, top-12 76.5%, **top-16 83.1% (95% CI 82.4–83.6)** vs 44.3% per-species
  frequency and 49.2% stronger frequency baseline. Joint log-loss 2.92 vs 4.35 / 4.04.
- Per-slot top-8 is 99% — per-slot badly overstates joint. Excluded: 9,421 hidden-choice turns, 2,910
  uncertain-target turns.
- Weak spots: switch turns 74.8% at top-16, turn 1 76.0% → search must reserve switch slots. Pair
  scoring helps.
- Only numpy installed (no torch/sklearn): gradients hand-written, numerically checked. Node forward
  pass matches Python logits to 1.07e-14 on 37 decisions. `solver/tests/test-prior.js` GREEN 1062/1062
  (re-run by coordinator), red on two deliberate breaks first.
- Limits: candidates are "legal-looking", not engine-legal (search must filter); opponent switch options
  only valid inside each possible-bring world.
- Trained on dataset sha256 `9d07c522…`, stamped in the model file.
- Detail: `docs/_reports/2026-09-23-policy-prior-v0.md`; code `solver/prior/`.

### Engine interface brief
- Most of the solver API wraps existing MEDICHAM exports. Three real gaps: no state clone (fix:
  `structuredClone` minus the trace sink), mid-turn choices (faint replacement / pivot switch-in) are
  pre-decided instead of asked (fix: an opt-in callback, do last), two globals still leak between
  battles (event-dice repeat counter, three trace fields). The terminal check counts the 20-turn cap
  as game over.
- Seven single-commit steps, each checked against the differential. For the MEDICHAM chat, after the
  Reg M-C gate. Line numbers are from the live file and will drift.
- Detail: `docs/_reports/2026-09-23-engine-interface-brief.md`

### Reg M-C meta analysis
- 28,274 clean open-sheet games, 6,822 players, 09-09 → 09-23; effectively all bo3 (559 bo1 left).
- Legality checked against the M-C Showdown checkout (`pokemon-showdown-mc`); illegal entities only in
  custom-rule rooms.
- Games cluster by player: Wilson intervals ~4× too narrow; player-clustered intervals given.
- 12 species risers, 17 fallers (first vs last week). 8 archetypes, but none met the pre-set stability
  bar (median bootstrap ARI 0.80) — treat as rough. One archetype off expectation after rating
  correction (~3.6 pts below).
- Bo3: same four brought again 61% after a win, 30% after a loss, 21% vs a new opponent.
- No SP spreads in the store.
- Tests: `solver/tests/test-meta-lib.js` 29/29, `test-meta-artifacts.js` 21/21 (re-run by coordinator).
- Detail: `docs/_reports/2026-09-23-regmc-meta.md`; code `solver/meta/`; outputs `solver/out/meta/`.

### Human-play dataset
- 26,888 of 28,283 Reg M-C bo3 games kept; 185,480 turns; 370,960 side-turn decisions, 74.3% with the
  full joint action visible.
- Exclusions 1,395: pre-fix Eject Button 335, behavioural bots 321, no action 308, Illusion 225, named
  bots 168, no result 36, custom rules 2. None of Will's accounts in this stream.
- 10% of targeted moves flagged "target not certain" (redirection, retargets).
- Test `solver/tests/test-human-parse.js` GREEN 24,605/24,605 (re-run by coordinator); shown red on a
  deliberate break.
- `games.jsonl` is 498 MB → `solver/out/` gitignored.
- Detail: `docs/_reports/2026-09-23-human-dataset.md`; code `solver/human/`.

### Research (four reports)
- Turn search: per-turn payoff table over hidden back-two + spreads, regret matching, short rollouts,
  capped exploit dial. Prior art PokaiTrainer (arXiv 2608.29197, verified: 59% of 150 sets vs ~1320
  Elo field, briefly top 500).
- Learning: clone humans first, then search-driven self-play; small nets, PyTorch train, Node forward
  pass; must beat an HP-count baseline.
- Humans & ladder: bots not banned by written rules but staff discretion — message an admin first.
  Format `gen9championsvgc2026regmcbo3`. Rating drifts ±55–60 Elo on its own.
- Teams & meta: preview is a 90×90 game with a learned cell scorer; builder is population search +
  screen + spread optimiser.
- Detail: `docs/_reports/2026-09-23-solver-research-{turn-search,learning,humans-and-ladder,teams-and-meta}.md`

### Decisions (Will)
- Open team sheets only · Reg M-C · rebuild every non-MEDICHAM model from scratch · laptop compute ·
  finish line = high on the ladder · equilibrium base + capped exploit dial · ladder account
  `medicham32` (disclose to an admin, no VPN) · eventually team building + meta · research now ·
  archive old models when their replacement lands.

### Not yet done
- Nothing under `solver/` or the new reports is committed — waiting for the MEDICHAM chat to be out of git.
