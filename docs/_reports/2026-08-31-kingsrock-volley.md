# King's Rock on a volley — one die per LANDED arrival, and this engine took one per CLICK

2026-08-31, ENGINE. Batch of one.

**Will asked whether King's Rock is a "super flinch machine" on a multi-hit move. It is, and this
engine was not modelling it.** The item rolled its 10% ONCE per click however many arrivals landed,
so a two-hit Dual Wingbeat flinched at 10% instead of 19% and a five-hit volley at 10% instead of
41%. Fixed; the census carries a probe for it now.

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 817 live / 817 probed / 0 missing | **818 / 818 / 0**, 0 hollow, 0 threw |
| empirical board-parted | 82 of 961 | **82** — predicted, at the point estimate |
| empirical protocol-diverged | 172 of 961 | **172** — predicted |
| distinct divergence causes | 150 | **150**, zero added, zero removed — predicted |
| end-state verdicts | 905 / 53 / 2 / 0 / 1 | **905 / 53 / 2 / 0 / 1** — predicted |
| engine release | `862624c9826e` | **`b43a2fea0cb1`** |

**Eleven predictions written to disk before any run
(`data/verification/2026-08-31-kingsrock-volley-prediction.json`). Eleven held, all at the point
estimate.**

---

## 1. THE AUTHORITY, READ RATHER THAN RECALLED — AND THEN INSTRUMENTED

King's Rock runs **no handler at hit time**. It pushes a secondary and leaves
(`data/items.ts:3212-3224`, and `grep kingsrock data/mods/champions/items.ts` returns nothing, so
Champions does not touch it):

```js
onModifyMovePriority: -1,
onModifyMove(move) {
  if (move.category !== "Status") {                       // the STATUS refusal
    if (!move.secondaries) move.secondaries = [];
    for (const secondary of move.secondaries) {
      if (secondary.volatileStatus === 'flinch') return;   // the NO-STACKING clause
    }
    move.secondaries.push({ chance: 10, volatileStatus: 'flinch' });
  }
}
```

So the die is drawn wherever every other secondary is drawn — `BattleActions#secondaries`,
`sim/battle-actions.ts:1343`, one `this.battle.random(100)` per entry per living target. That
function is **step 5 of `spreadMoveHit`** in the Champions override
(`data/mods/champions/scripts.ts:388`), which `hitStepMoveHitLoop` calls **once per hit** (`:518`),
under the guard that answers the second half of the question (`:461-464`):

```js
for (hit = 1; hit <= targetHits; hit++) {
  if (damage.includes(false)) break;
  if (hit > 1 && pokemon.status === 'slp' && ...) break;
  if (targets.every(target => !target?.hp)) break;   // no arrival is opened against a corpse
```

**Per LANDED arrival. Never per arrival the volley DREW.** `-hitcount` is the same counter written
out as `hit - 1` (`:550`), which is what lets both protocol streams supply the expected number
instead of a typed one.

**This was not left as a reading.** `BattleActions.prototype.secondaries` was wrapped and the
King's-Rock-shaped entry counted per living target per call. Measured, on real staged boards:

| board | authority `-hitcount` | authority King's Rock dice |
|---|---|---|
| Dual Wingbeat (`multihit: 2`, fixed) | 2 | **2** |
| Icicle Spear (`multihit: [2,5]`, drew 3) | 3 | **3** |
| Brave Bird (single hit) | 1 | **1** |
| the volley that KILLS on arrival 1 of 2 | 1 | **1** — only `dualwingbeat#1` reached `secondaries` |
| the same volley with no item | 2 | **0** |
| Air Slash (already flinches) | 1 | **0** — and its OWN 30% flinch still rolled |
| Taunt (a Status move aimed at a foe) | 0 | **0** |

Champions does not override `secondaries`, so the prototype is the live path; the probe asserts the
instrument saw a non-zero count rather than trusting that.

## 2. WHAT THIS ENGINE DID

`_STEPS` (`medicham2-browser.js:34049`) wraps the whole step list **once per MOVE** and keeps the
arrivals inside `_stepApply`'s packet loop. WIRE 103 lives in `_stepEffects`, so it ran once per
click and took exactly one die.

**Nothing in the repository could have seen it.** WIRE 103's own comment says its carriers "measure
within sampling error of `pFlinch x accuracy` over 2,000 staged turns" — and every one of those turns
is an ordinary single-hit move, so "one die per click" and "one die per landed arrival" were the same
observation. The census probe for `addsFlinch` stages a Night Slash.

**And King's Rock is the only way this is observable at all in this format**, which is why the
standing once-per-move wrap (`test-resolution-order.js`'s KNOWN-OPEN arm) never caught it: derived on
every probe run, **14 legal `multiHit` moves and every one of them carries `secondaries: null`.** No
multi-hit move in Champions Reg M-B has a secondary of its own.

## 3. THE POPULATION IS NOT OBSCURE

Counted off the store, not estimated:

- **82 of 211** King's Rock sheet entries across `games.ladder.jsonl` + `games.bo3.jsonl` carry a
  multi-arrival move — Population Bomb 36, Bullet Seed 24, Rock Blast 19, Dual Wingbeat 11, Dragon
  Darts 11, Beat Up 3.
- In the pinned pool: **120 King's Rock entries, 52 of them with a volley**, over 13,214 bo3 games.

So the *build* is common and the *pool rate* is not: 36 of 7,772 distinct pinned-pool teams (0.46%)
carry such a body, which is why the pool was predicted UNMOVED — see §5.

## 4. THE FIX

One loop, and it reads a number that already existed.

```js
R.arrivals = _packets ? _landed : 1;     // in _stepApply, where the packet loop counts it
```

`-hitcount` (`R.hitLanded`), `timesAttacked` and now the King's Rock die are **three readers of one
number**, exactly as the authority derives all three from one `hit` counter. A second expression for
it in the secondaries step would have been the facts-are-global breach this line already carries a
comment about. A row that reaches WIRE 103 with no count falls back to one die **and says so** —
`MEDFAILS.kingsRockNoArrivalCount`, asserted at zero by every arm of both instruments.

`MEDSEEN.kingsRockRolls` counts the die where it is taken, because at 10% a counter of OUTCOMES is
nine parts noise — which is the whole reason this survived eighteen days.

### THE DECLARED REMAINDER, WHICH IS NOT FIXED AND CANNOT REACH A BOARD

The authority takes a die on the arrival that **kills**, because `secondaries` runs inside that
arrival's own `spreadMoveHit`. This engine's step list is wrapped once per move, so the row is
already fainted when WIRE 103 runs and it takes none.

It cannot part a board: the authority's own `addVolatile` bails on a body at zero
(`sim/pokemon.ts:1980`), so the flinch it rolled for is refused there too, and an arrival that kills
ends the volley anyway. Taking the die here would add a `sec` draw on **every killing hit by a King's
Rock holder**, shifting the `nth` of later draws at that address for no board benefit — so it is
left, and `MEDSEEN.kingsRockRollSkippedOnKO` carries **how many** dice were skipped. Both instruments
assert it is non-zero on their kill arm, so "we chose not to" can never read like "nobody noticed".

## 5. THE SCOREBOARD WAS NAMED BEFORE THE RUN

`data/verification/2026-08-31-kingsrock-volley-prediction.json`, written before the census and before
the differential. **The lab moves; the pool does not**, and the arithmetic was stated first: 36 of
7,772 pinned-pool teams carry the body, so a 961-game sample expects ~4 games in which it appears at
all — and in each the body must be BROUGHT, must CLICK the volley, and the extra dice must move a
board leaf rather than a message.

| # | prediction | point | band | measured |
|---|---|---|---|---|
| P1 | census live | 818 | 818 | **818** |
| P2 | census probed | 818 | 818 | **818** |
| P3 | census missing / hollow / threw | 0 | 0 | **0 / 0 / 0** |
| P4 | board-parted of 961 | 82 | 80-84 | **82** |
| P5 | protocol-diverged of 961 | 172 | 170-175 | **172** |
| P6 | distinct causes | 150 | 147-153 | **150** (0 added, 0 removed) |
| P7 | end-state verdicts | 905/53/2/0/1 | ±2 any cell | **905/53/2/0/1** |
| P8 | sample identity | identical | identical | **identical** — see below |
| P9 | probe clean | GREEN | GREEN | **GREEN** |
| P10 | probe `--red` | GREEN (lives part, controls hold) | GREEN | **GREEN** |
| P11 | `MEDFAILS.kingsRockNoArrivalCount` | 0 | 0 | **0** on every arm |

**Sample identity, checked and not assumed:** 961 games both runs, `turns_cap` 12, arm `middle`,
steering `empirical-click/v1`, census pin `9446a684709d`, pool `0d103fb9fa87` under
`--team-store data/team-pool-frozen`, `closet.teams_dropped` 43, `coverage.exercised` 556,
`order_probe` 2 rows, median turn of first board divergence 5, `mode` string identical
(`A/middle/pins:ccb365985023/credit:observed-effect/v1/nature:real`). **The `by_cause` list is
byte-equal both ways.**

Artifacts: `data/verification/game-differential.kingsrock.json` and
`data/verification/divergence-turns.kingsrock.json`, release `b43a2fea0cb1`, `--dump-games 250`
(163 of 172). **`data/game-differential.json` was NOT touched** — its mtime is still 2026-08-28
23:14; `--out` redirects the write.

## 6. THE TWO INSTRUMENTS

**`tests/probe_kingsrock_volley.js`** — 7 arms, both engines, one turn each, under the differential's
own `middle` pin. Nothing is typed as an expected value: the authority's instrumented die count and
both streams' `-hitcount` supply every number. Shown RED first (authority 2 / medicham 1 and
3 / 1 on the two live arms, four controls already green), then green after the fix, then green under
`--red` where the two live arms MUST part and the four controls MUST NOT.

**`tests/test-mechanics.js`, item / `addsFlinch`** — a second row beside the existing single-hit one,
counting dice with the rng pinned to 0.5 so every die LOSES and the arms differ only in how many were
taken: `2 / 1 / 0 / 0 / 0+1 skipped`. The arrival count is read off `tags.js`
(`multiHit.hits`), not typed. Shown MISSING under `MEDI_KINGSROCK_ONCE_PER_MOVE=1` — where it reads
`1` — with **817 live / 1 missing**, so the knob is narrow, and the run REFUSED to write the census
because the knob is registered in `DELIBERATE_BREAK` (artifact digest unchanged across that run,
checked).

## OWED, NOT RUN

- **The killing arrival's die.** §4. Declared, counted by `MEDSEEN.kingsRockRollSkippedOnKO`, proven
  non-zero by both instruments, not fixed. It cannot reach a board; it is a die-address difference.
- **The once-per-move wrap of the whole step list** is unchanged and remains
  `tests/test-resolution-order.js`'s KNOWN-OPEN arm. This batch fixed the ONE secondary in this
  format that the wrap makes observable, and did not fix the wrap.
- **`MEDSEEN.kingsRockRolls` and `kingsRockRollSkippedOnKO` have no POOL-SCALE reading.**
  `game_differential.js` surfaces no `MEDSEEN`, so both have only been read on staged boards.
- **`tests/test-engine-diff.js` was NOT re-run** (0/6000 at all sixteen corners, 2026-08-29). No
  damage byte moved — the change is one loop around a secondary die. Stated rather than quietly
  skipped. Note that the standing `skipped_multihit 134` scope caveat is unrelated and unchanged:
  the damage differential still never runs a volley.
- **The three roster stages were NOT re-run** and now read `MEASURED AGAINST A DIFFERENT ENGINE`
  against release `b43a2fea0cb1`. They were already stale before this pass (they ran on
  `e129bca605e3` against a tree of `862624c9826e`), so this batch did not worsen them.
- **A second engine was writing the tree during this pass** (`engine/durable-ingest.js`,
  `.github/workflows/ingest.yml`, `docs/ENGINE.md`, plus untracked `engine/next_regulation*.js`).
  Every measurement here was taken against the **frozen release `b43a2fea0cb1`** and the frozen team
  pool, and the five hunks in `engine/medicham2-browser.js` are all this batch's. Recorded because
  the concurrency itself is a hazard the project has paid for.
