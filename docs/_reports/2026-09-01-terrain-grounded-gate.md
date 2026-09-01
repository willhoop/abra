# The terrain multiplier gets its grounded gate — 2026-09-01

**Written by the coordinator, not by the agent.** The agent that did this work stalled twice — once on
"register the knob", once on an API error while verifying — so the account below is assembled from the
artifacts it left and **every figure in it was read off disk by the coordinator**, not relayed. Where
something could not be verified that way it is marked so.

## WHAT LANDED

The batch before this one gated the terrain-conditional target REWRITE on the user's feet and left the
×1.5 MULTIPLIER ungated, so the same move widened correctly and boosted incorrectly on one board — an
airborne user reading 114 where the authority reads 76. This closes that.

| | before | after |
|---|---|---|
| board-parted | **78** of 961 | **77** |
| protocol diverged | **169** | **168** |
| distinct causes | 147 | **146** |
| census live / probed / missing | 822 / 822 / 0 | **825 / 825 / 0** |

Release `1c346ff23712` → **`d9dc3afe16ef`**.

## THE DELTA IS KNOB-CONTROLLED, ON ONE RELEASE

This is the part worth trusting and the part the coordinator checked directly.
`data/verification/game-differential.terraingate-before.json` and
`…terraingate.json` **both carry `engine_release: d9dc3afe16ef`** — the same bytes — and read:

```
BEFORE-ARM   board-parted 78   protocol 169
AFTER        board-parted 77   protocol 168
```

The before-arm reproduces the router's stated baseline exactly. **So the movement is attributable to
the fix rather than to a release change**, which a cross-release diff could not have established. Every
batch this session has used this form after a cross-release comparison misattributed a result earlier
in the run.

## THE KNOB

`MEDI_TERRAIN_SCALED_UNGATED` restores the defect, and `terrainScaledUngatedRestored` is registered in
`DELIBERATE_BREAK` in `tests/test-mechanics.js` — verified present by the coordinator, alongside its
sibling `terrainTargetSingleRestored` from the previous batch. Seventeen knobs are now registered
there, one per defect deliberately kept reachable.

## WHAT IS NOT VERIFIED HERE, AND IS OWED

The agent stalled before writing its own account, so **three questions from the brief have no answer on
record** and must not be assumed:

1. **The membership count.** How many legal moves carry the `terrainScaled` shape, derived from the
   format and carrier-checked. The scope said two. `tests/test-mechanics.js` carries three
   `terrainScaled` references, which is consistent with two members plus a control but **is not a
   derivation**.
2. **Whether the two members really gate on different feet.** `medicham2-browser.js:11520` declares
   that one gates on the USER's and one on the TARGET's, and that asymmetry was the stated reason the
   gap was deferred in the first place. **A fix applied uniformly would close one and break the other.**
   The census reading 825 live / 0 missing is consistent with both being right, but consistency is not
   the same as an arm that would have caught it.
3. **Whether both directions are asserted for each member** — grounded gets the boost, airborne does
   not. Census rows exist; whether they carry both arms is unread.

**`isSemiInvulnerable()` was checked and REFUSED in the previous batch** — the move handler names
`isGrounded()` and nothing else — so it should not have reappeared here. Unverified either way.

## THE PREDICTION

`data/verification/2026-09-01-terrain-grounded-gate-prediction.json` was written **before any
measurement, engine edit, census run or differential run** — it says so in its own first field — and
carries nine `P*` clauses covering membership, subjects, red-first, probe shape, census, which
scoreboard, the knob, counters, the damage differential, `isSemiInvulnerable` and void/usable.

**It has not been scored.** The agent stalled before doing so. Scoring it is the first item owed.

## OWED, NOT RUN

```
node -e "const p=require('./data/verification/2026-09-01-terrain-grounded-gate-prediction.json');console.log(JSON.stringify(p,null,1))"
```

Then, in order:

1. **Score the nine prediction clauses** against what landed, and record hits and misses. The running
   tally across the last ten batches is 4/4, 5/5, 5-of-7, 6-of-8, 6/6, 8/8, 11/11, 11-of-12,
   8-hit-3-missed and 8-hit-5-missed. A miss recorded has been worth more than a hit assumed twice
   this session.
2. **Derive the `terrainScaled` membership** from the format, filtered
   `exists && !isNonstandard && tier !== 'Illegal'` and carrier-checked. Do not inherit the scope's
   count of two.
3. **Confirm the two members gate on different feet**, and that each has both a grounded and an
   airborne arm.
4. `cmd //c "<abs path to a two-line .cmd wrapper>"` for the wrapper; `tests/test-resolution-order.js`
   needs `--max-old-space-size=3400` and passes there at 26 arms / 0 failing.

## STANDING NOTES

- `--steering` must be passed explicitly; omitting it silently runs the default coverage arm.
- `--out` redirects the MAIN artifact and `--dump-out` is separate.
- `--games 1200` yields 961; `--games 1000` is a different sample.
- **A raw store click count does not translate into pool games** — `--steering empirical` samples
  `P(move | species)` rather than replaying the store, which is what made the previous batch's pool
  prediction miss.
