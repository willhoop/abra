# Applied: `001-ORIENTATION.md`

**Status: landed** as `docs/ORIENTATION.md`, linked from `README.md`. Commit `2bf4ac0`.
Draft moved to `docs/_inbox/applied/`.

## Verdict on the draft

Applied essentially as written. The discipline held — every figure was `<<MEASURED>>`, no invented
numbers, so there was nothing to reject. The structure is good and the "failure mode this project
keeps hitting" section is the most useful page in the repo. Keep writing them this way.

## Placeholders filled

| Placeholder | Measured |
|---|---|
| `<<MEASURED: collected>>` | **8,356** |
| `<<MEASURED: clean>>` | **1,061** (12.7%) |
| `<<MEASURED: assertion count>>` | **96** |
| `<<MEASURED: mean moves revealed>>` | **1.38 of 4** — plus 69.7% no item, 75.5% no ability, over 72,367 sets |

**1.38 replaces the 1.6 in the older docs.** Sets are even less known than previously written, which
strengthens the caveat rather than weakening it.

## What I added beyond the draft

- The full funnel table, stage by stage.
- The archive-completeness rule under "store raw, analyse on top" — the principle is only true while
  the raw archive is complete, and it had quietly stopped being complete for 453 games.
- Concrete examples in the failure-mode section, since the abstract version is less convincing than
  "the nature table held 23 of 25".
- The `merge=union` correction stated explicitly, because four documents still carry the wrong cause.
- "33 engines still bypass this filter" in the bot section.

## Two defects the draft flushed out

Applying it meant running the tests, which found things nobody was looking for.

**1. `tests/test-quality.js` had never run on this machine.** It hardcoded `python3`. On Windows the
python.org installer ships `python.exe`, not `python3.exe`, so `python3` resolved to the Microsoft
Store alias stub — printing "Python was not found" and exiting 9009. The JS/Python parity check
therefore passed in Linux CI and did nothing locally. It now probes `python3`, `python`, `py -3` and
exits 2 (distinct from a failure) when none works.

**2. Once it ran, it failed 2 of 24 — both stale pins, not regressions.**

- **A sixth behavioural bot crossed the threshold: `HospitalityCheck`, 55 games, 1 team.** Recorded
  in `quality-filter.json`. Flagged as the weakest of the six: its name is not machine-shaped like
  the other five, and it sits just above the 50-game cutoff. Re-examine it first if the rule is ever
  loosened.
- The config funnel was pinned to the 7,547-game store.

The bare `bots.size === 5` assertion is gone. It has been replaced with the rule itself — every
detected account must have `>= min_games` and exactly one distinct team. A count cannot tell a false
positive from a genuine new bot; the invariant can. That is S6 applied.

`quality-filter.json` keeps the superseded figures under a `superseded` key rather than overwriting
them.

## Note for your next drafts

The clean **share** barely moved: 12.3% → 12.7%. The store got bigger, the filter did not get
harsher. If you write about the funnel, that stability is the interesting part — it suggests the bot
population scales with the ladder rather than being a fixed set of accounts.

## Tests after the change

```
sanity_check.py            96 passed, 0 failed
test-quality.js            25 passed, 0 failed
test-rollout-effects.js    39 passed, 0 failed
```

## Still open from your queue

- **Item 2 — re-run every model on the clean store.** Not started. Until this runs, the role-pair
  figure (~52) and every model result in the docs are computed on a store that no longer exists.
- **Item 3 — ADR-001 golden master and precompute.** Not started.
