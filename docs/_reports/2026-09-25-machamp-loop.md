# MACHAMP unattended loop — one section per generation

Written by `solver/machamp/loop_sprt.js` under `solver/machamp/preregistration-loop.json`. Historical by construction.

## gen6 — rejected (2026-09-25T19:37:52.850Z)

- Self-play: `solver/out/selfplay/eaa5becc54eb/loop-sp6`, 1000 games, 754.4 games/hour, 0.07% cells empty.
- Pool: 6 self-play directories, 78343 DODUO decisions, 54884 PORYGON2 positions (all with a deep value: 54884).
- **SPRT vs gen5** (elo0 0, elo1 +20, α = β = 0.05): **H0 — X is not stronger (elo0 = 0 accepted)**, LLR -2.97, 83 pairs = 166 games; 72–94 = 0.434 [0.361, 0.510] (Wilson at the stop, slightly optimistic).
- Human clone: 0.705 [0.638, 0.764] (PASS). PORYGON2 human log-loss vs v0: -0.0051 [-0.008, -0.002] (PASS).
- DODUO drift from the human clone: 0.0099 nats.
- Champion after: `solver/machamp/league/gen5.json`.
