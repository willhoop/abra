# Finding: the Champions engine is OPEN, not closed

**2026-07-23 · Will Hooper · ABRA**

> A correction that reshapes the roadmap. From day one the project assumed the Champions battle engine
> was **closed** — not queryable — which is why SLOWKING was designed to *learn* the dynamics from
> replays (the hardest, riskiest research piece). On checking the source, that assumption is **wrong**:
> Champions is a fully public mod in the open-source Pokémon Showdown repository and can be run locally.
> This turns "learn the simulator" into "**use** the simulator" across the whole model family.

---

## What was verified (directly, by cloning the repo)

Cloned `github.com/smogon/pokemon-showdown` (master, shallow) and inspected it:

- **The exact format is in `config/formats.ts`:**
  - `[Gen 9 Champions] VGC 2026 Reg M-B` — `mod: 'champions'`, doubles, `bestOfDefault: true`,
    ruleset `['Flat Rules', 'VGC Timer', 'Open Team Sheets']`.
  - `[Gen 9 Champions] VGC 2026 Reg M-B (Bo3)` — the best-of-3, `Force Open Team Sheets` variant.
  - Plus a family of `[Gen 9 Champions]` formats (Random Battle, OU, UU, BSS Reg M-A/M-B, Custom Game).
- **The mod is implemented in `data/mods/champions/`:** `scripts.ts` (battle logic incl. spread/damage),
  `moves.ts`, `items.ts`, `abilities.ts`, `learnsets.ts`, `formats-data.ts`, `conditions.ts`,
  `rulesets.ts`. There is also a `championsregma` mod. The SP stat system lives here (mod overrides).
- **Conclusion:** the engine and the exact ruleset we care about are open-source and runnable. It is
  **not** a closed environment. (One nuance: verifying a *battle runs end-to-end* on a local clone was
  blocked only by a slow `npm install` in the analysis sandbox — the code is unambiguously present;
  the run is a standard step on a normal machine, see recipe below.)

## Why this is big — it changes several models

The premise "closed engine ⇒ must learn a world model" was the load-bearing assumption behind the
hardest research. Remove it and:

- **SLOWKING** stops needing a learned dynamics model. It becomes **equilibrium search over a KNOWN
  simulator** — the exact setting ReBeL / AlphaZero occupy. The genuinely hard parts that remain
  (simultaneous-move mixed-Nash, belief-state search) are well-trodden, not novel invention. Far more
  feasible, and it unlocks **self-play**.
- **MEDICHAM** can replace its approximate sequential-singles rollout with **real-engine rollouts** —
  exact doubles, status, redirection, everything. Its behaviour-clone (what humans *click*) stays,
  because the engine gives dynamics, not policy.
- **DITTO** can evaluate candidate teams by **actually playing self-play games**, not just JOLTEON's
  guess — a ground-truth evaluator.
- **JOLTEON** can train on **unlimited self-play data** instead of only ~5k scraped replays.
- **CHOMP** gets a ground-truth reference to validate its damage engine against.
- **KADABRA/ALAKAZAM** can show *counterfactuals* ("if you'd clicked X, here's what the engine does").

Nothing becomes irrelevant; the **learned-dynamics component** is the one thing retired. The tiered
speed/cost structure still holds — you can't run deep search on every team, so cheap filters remain.

## What does NOT change

- The domain is still high-variance: the predictability study's ~57% pre-game ceiling is a property of
  the *game*, not of having/lacking a simulator. A perfect engine does not make outcomes more
  predictable before the game.
- Imperfect information and simultaneous moves are still real — a known simulator removes the
  *model-learning* problem, not the *game-solving* problem.

## Runnable recipe (on a normal machine)

```
git clone --depth 1 https://github.com/smogon/pokemon-showdown
cd pokemon-showdown
npm install                      # installs + builds (TypeScript -> dist)
# one battle in the real Reg M-B engine, driven over stdin:
./pokemon-showdown simulate-battle
# then feed the protocol, e.g.:
#   >start {"formatid":"gen9championsvgc2026regmb"}
#   >player p1 {"name":"A","team":"<packed team>"}
#   >player p2 {"name":"B","team":"<packed team>"}
#   >p1 team 1234 / >p2 team 1234 / >p1 move 1 / >p2 move 1 ...
```

The `Teams.pack()` / `Teams.import()` helpers in `sim/teams` convert PokéPaste ↔ packed format.

## Immediate next steps (roadmap change)

1. **Verify the run** end-to-end (the recipe above) — confirm a Reg M-B battle resolves with SP stats.
2. **Wrap it as ABRA's engine adapter** — a thin module that, given a state + joint action, returns the
   next state distribution by calling the sim. This is the `Tθ` interface (`engine/slowking.py`), now
   backed by the *real* engine instead of a learned model.
3. **Repoint MEDICHAM and DITTO** at the adapter for exact rollouts / self-play evaluation.
4. **Rewrite SLOWKING** around a known simulator (ReBeL/Student-of-Games), dropping the world-model
   track to an appendix/fallback.

**Related.** [SLOWKING white paper](SLOWKING-whitepaper.md) (§3 corrected) ·
[simulator white paper](ABRA-simulator-whitepaper.md) · [changelog](../CHANGELOG.md)
