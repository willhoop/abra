# ADR-001 — Replace the hand-written rules engine with Showdown's Champions mod

**Status:** proposed · **Date:** 2026-07-24 · **Author:** Will Hooper

## Context

ABRA simulates Champions battles with `engine/medicham2-browser.js`, a rules engine written by hand
and corrected incrementally. On 2026-07-24 a single working session found the following defects in
it, every one of them silent — the engine returned a number, it was simply the wrong number:

| Defect | Effect |
|---|---|
| Status moves applied a **uniformly random** status | Thunder Wave burned a third of the time |
| **Only Fake Out** could flinch | Rock Slide's 30%, Iron Head's 30% and 31 others were inert |
| **No status immunities** | Fire types were burned, Electric types paralysed |
| Priority was a hand-typed table of 18 moves | All 14 negative-priority moves resolved at 0; Trick Room (−7) went at normal speed |
| Flinch was never cleared at end of turn | A flinch from a slower attacker stole the target's *next* turn |
| Intimidate was an unconditional −1 | Blocked by 10 abilities; **reversed** by Defiant (+2) and Competitive (+2 SpA) — the sign was wrong on the format's most-used ability |
| No powder immunity | Spore hit Grass types |
| Prankster hit Dark types | Illegal since Gen 7 |

Five of these were found because the project owner happened to mention them in conversation. That is
not a defect-detection process. The ones nobody mentioned are still there.

Measured impact of the corrections that were made: on 120 real matchups from the store, mean change
in P(win) was **4.35 points**, maximum **24.2 points**, and the favoured side **flipped in 9.2%** of
matchups. These are not cosmetic differences.

## The discovery that forces this decision

`data/mods/champions/` **exists in the Showdown master branch** and implements the format exactly:

```
abilities.ts       2.5 KB    the Champions-specific abilities
conditions.ts      1.8 KB    paralysis / sleep / freeze mechanics
formats-data.ts   75.4 KB    legality and tiering
items.ts          16.3 KB    mega stones
learnsets.ts     278.5 KB    what every species can learn
moves.ts          20.3 KB    move changes
rulesets.ts        1.9 KB    the SP system
scripts.ts        21.3 KB    stat and damage calculation
```

Three constants this project had carried as **unsourced inline comments** were checked against
`conditions.ts` and all three are exactly right:

| Mechanic | Asserted in our engine | Champions source | Our measurement (7,948 raw logs) |
|---|---|---|---|
| Full paralysis | 12.5% | `randomChance(1, 8)` | 13.8%, CI [11.9, 16.0] |
| Sleep, wake on turn 2 | 33% | `sample([2, 3, 3])` | 35.3%, CI [31.5, 39.2] |
| Freeze thaw per attempt | 25%, forced at 3 | `randomChance(1, 4)`, `startTime = 3` | 31.6%, CI [23.3, 41.4] |

They were right, but they were right by luck rather than by sourcing — nothing in the repository
said where they came from, and standard **S8 (measured, never asserted)** was being violated the
whole time. `conditions.ts` also carries `move.flags['defrost']`, the auto-thaw rule, which our
engine does not implement at all.

The npm package `pokemon-showdown@0.11.10` does **not** contain the mod; it is present only in the
master branch. That is why an earlier check of `@pkmn/sim` (201 formats, none matching) wrongly
concluded no Champions engine existed.

## Decision

**Adopt `data/mods/champions/` as the authoritative rules engine.** Drive it through the Showdown
simulator API rather than continuing to maintain a parallel implementation.

This is standard **S1 (single source of truth)** applied at the largest scale in the project. We have
been maintaining a second, worse implementation of rules that already have an authoritative one, and
paying for it in silent wrongness.

## Consequences

**Gained**
- Every rule is correct by construction, including the ones nobody has thought to check.
- Champions-specific mechanics come from the format's own definition, not from inference.
- Rule changes arrive by updating a dependency instead of by someone noticing a bug.
- Damage, accuracy, priority, immunities, abilities and items stop being our problem.

**Given up**
- Speed. Our engine runs a rollout in microseconds; the full simulator is far heavier. Rollout counts
  and any in-browser use must be re-measured before this is assumed viable, and that measurement is a
  precondition of accepting this ADR, not an afterthought.
- Buildless browser delivery. The simulator is not a file the site can `<script src>`. Either the
  rollout moves server-side, or the site keeps a cut-down engine that is validated against the
  simulator by a contract test.
- The current engine's damage output is validated to within 5% of `@smogon/calc` across 31 scenarios.
  That golden master must keep passing against the new path before any switch (**S9**).

**Risks**
- The master branch lists Reg **M-A**; our stored games are Reg **M-B**. The mod may have moved since
  the data was collected, so format versioning has to be handled explicitly.
- Depending on an unreleased branch means pinning a commit, not a version number.

## Migration, in order

1. Pin the Showdown master commit; vendor `data/mods/champions/` with provenance (**S4**).
2. Run the existing 31-scenario damage golden master against the simulator. If it disagrees with
   `@smogon/calc`, resolve that before going further.
3. Benchmark: rollouts per second, versus the current engine. Decide server-side or hybrid on the
   number, not on preference.
4. Move `medicham2-browser.js` behind the same interface, so consumers do not change.
5. Keep the contract test, re-pointed: the shipped engine must agree with the simulator.
6. Retire the hand-maintained tables (`ACC`, `SPREAD`, `MEGA_ABIL`, `PRIO_CONDITIONAL`).

## Alternative considered

**Keep fixing the hand-written engine.** Rejected. Today's session is the evidence: eight defects in
one sitting, five surfaced by conversation rather than by any test, on an engine that had already
been reviewed. The defect rate is not falling, and there is no reason to expect it to, because the
specification it is being written against is not written down anywhere we control.
