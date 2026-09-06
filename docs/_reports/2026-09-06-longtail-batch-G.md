# Long-tail batch G — the five uncaused board games were three `stall` games and they are gone, and the sleep timer was being drawn out of the wrong dice bucket

ENGINE, 2026-09-06. Two fixes, two new probes, both shown RED under their own restore knob before
either was trusted. Release cut: **`ab22bc503717`**.

---

## The headline

| clause | before (`57679ef9a4a3`) | after (`ab22bc503717`) |
|---|---|---|
| whole-game **BOARD-MATERIAL** | **27 of 961** | **22 of 961** |
| whole-game PROTOCOL | 93 | **91** |
| whole-game NARRATION | 70 (71 raw less 1 declared) | **70** (71 raw less 1 declared) |
| board parted with **NO protocol divergence anywhere** | **5** | **2** |
| census | 830 live / 830 probed / 0 missing | **830 / 830 / 0**, `run_ok` true |
| roster items | 140 matched, 0 DIFFER, 0 DID-NOT-FIRE | **140 / 0 / 0** |
| roster abilities | 129 matched, 0 / 0 | **129 / 0 / 0** |
| roster moves | 475 matched, 0 / 0 | **475 / 0 / 0** |
| staged mechanics | 1,313 games, 0 threw | **1,313 games, 0 threw**; moves / abilities / items summaries byte-identical |
| game differential | 0 of 6000, seed 20260804 | **0 of 6000**, re-run on `ab22bc503717`, exit 0 |
| the gate | 7 pass / 2 fail | **7 pass / 2 fail**, both measured disagreements on current bytes |

**One self-inflicted near-miss, recorded because it would have been invisible.** The first
`all_mechanics_fire.js` re-run was taken without `--kind all`, whose default is `moves` — so for
about four minutes `data/all-mechanics-fire.json` held a 617-game MOVES-ONLY artifact where the
published one covers moves, abilities and items. It was caught by diffing the summary keys against
`git show HEAD:` rather than by any check, and re-run in full. A narrowed artifact reports `0 threw`
exactly as a complete one does.

**The sample.** Both runs are the same sample definition and the digests say so:

```
node engine/game_differential.js --steering empirical --release ab22bc503717 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

961 games played, `--games 1200` (the swarm is sized from it, so it is part of the sample and not a
budget), cap 20, `middle` arm, `empirical-click/v1`, pool digest `0d103fb9fa87` **PINNED** to
`data/team-pool-frozen`, showdown `20ad99ffc9a5`, `driver_code_stable: true` (driver code
`228006b5faca` over 11 files, unchanged across the whole run), elapsed 296 s.

**Which scoreboard each fix was expected to move, called before the run.** Both fixes are POOL work,
not lab work: each was diagnosed by replaying a game out of the pinned pool, so the pool was expected
to move and the census was expected to sit still. It did — 830/830 both sides.

---

## Fix 1 — `stall`'s duration is spent at the FOOT of the residual walk, not when the residual opens

**Probe: `tests/probe_stall_uncaused.js`. Restore knob: `MEDI_STALL_LAPSE_AT_RESIDUAL_OPEN=1`.**

### What was measured first

The five board-material games that carried no protocol divergence at all are invisible to
`--dump-games` by construction: that dump writes the lines either side of a PROTOCOL split and these
games have none. The probe replays them out of the pinned pool and prints, at every boundary, each
engine's stall clock plus the whole final turn of both streams. Red first, on the published bytes:

```
omit-weather t7   Garchomp    me tookProtectTurns 1 -> 0   sd counter 3 duration 1 -> 3 duration 1
omit-weather t9   Staraptor   me 1 -> 0                    sd 3 dur 1 -> 3 dur 1
omit-spread  t16  Overqwil    me 1 -> 0                    sd 3 dur 1 -> 3 dur 1
```

and the three final turns, printed by the probe, are one shape:

```
AUTHORITY  ... |-damage|p2a: Staraptor|0 fnt|[from] brn  |faint|p2a: Staraptor  |  |win|A
MEDICHAM2  ... |-damage|p2a: Staraptor|0 fnt|[from] brn  |faint|p2a: Staraptor
```

A residual chip killed the last body. No `|upkeep|` in either stream.

### The rule, read rather than remembered

`data/conditions.ts` `stall` carries **no `onResidualOrder`**. `fieldEvent` collects it only because
it HAS a duration (`getKey = 'duration'`, sim/battle.ts:487), and `comparePriority` reads a missing
order as `4294967296` (sim/battle.ts:405) — so it sorts **below every numbered handler in the
format**, and the `handler.state.duration--` at sim/battle.ts:516 is among the last things the walk
does. `fieldEvent` runs `faintMessages()` after each handler and returns the instant the battle ends,
and every residual that can KILL is numbered far above `stall`. So a residual that ends the battle
never reaches the decrement.

The witness that it is the WALK and not the TURN: on the t7 board a Sinistcha that Protected on that
same final turn ends it at `duration 2` — `onRestart`'s refresh, never decremented. The authority
spent no duration at all on that turn.

The 2026-08-26 placement (spend the clock where the residual OPENS) fixed the turn that never reaches
the residual and was still one whole walk too early. `docs/ENGINE.md` carried this as
`turnEndedInResidual`, declared and not fixed.

### The fix

`_stallExpire()` moved from the residual open to below the residual group loop, guarded by the group
loop's OWN predicate — `sideWiped(S) && !faintQueueOwed()`, which is `fieldEvent`'s
`faintMessages(); if (this.ended) return;`. Asking it once more at the foot covers the one gap the
group-top check leaves: a wipe inside the LAST group.

Two new counters, both read by the probe: `MEDSEEN.stallExpireAtResidualFoot` (the walk ran to the
end and the clock was spent) and `MEDSEEN.stallHeldByUnfinishedResidual`.

### The evidence

Green, and the counters say the sweep still WORKS rather than never firing:

```
stallExpireAtResidualFoot +29   stallLapsedUnrefreshed +8   held +3
```

`stallLapsedUnrefreshed +8` is the control that matters: an engine that simply stopped expiring stall
counters would pass every board arm in the file. Under `MEDI_STALL_LAPSE_AT_RESIDUAL_OPEN=1` the
child fails on all three games plus the held-counter counter.

---

## Fix 2 — the sleep timer is drawn from the CALLER's dice stream, because the authority's is too

**Probe: `tests/probe_status_clock_dice.js`. Restore knob: `MEDI_SLEEP_START_ANY_ADDR=1`.**

### The authority, cited

Champions overrides `slp`. `data/mods/champions/conditions.ts:11-29`, `inherit: true` with `onStart`
replaced:

```
// 1/3 chance for a Pokemon to wake up on turn 2
this.effectState.startTime = this.sample([2, 3, 3]);
this.effectState.time = this.effectState.startTime;
```

`onBeforeMove` is NOT overridden, so mainline's runs (`data/conditions.ts:66-80`): `time--`, `if
(time <= 0) cureStatus()`, else `add('cant')`. `Battle#sample` is `items[this.random(items.length)]`,
so the START is one `random(3)` and there is **no draw at the wake site**. A start time of 2 costs
one missed turn, 3 costs two. (CLAUDE.md records "2 or 3 turns" as a value typed from memory; the
probe re-derives the table off the format on every run and FAILS if it is not `[2,3,3]`.)

For completeness, also re-derived and asserted every run: `frz` is Champions' own — `startTime = 3`
flat, `time--` then `time <= 0 || randomChance(1,4)`, the `||` short-circuiting so the third attempt
draws no die at all.

### The defect

The middle arm addresses a draw by the **scope it was made in**: `game_differential.js` wraps
`BattleActions#secondaries` as category `sec` (`around('secondaries','sec',1)`). A sleep applied from
inside a secondary therefore draws its timer under `sec` in the authority. medicham2 drew every
timer through `medRng()`, which is `_R.any`. **Two categories are two independent dice.**

Measured on the game that says so — `pair-protect-bust  ...bo3-2660356793 vs ...bo3-2660492912`, a
Golurk slept by a Dire Claw on turn 2:

```
boundary   this engine  slpTime 3          the authority  startTime 2, time 2
t6         |cant|p1a: Golurk|slp           |-curestatus|p1a: Golurk|slp|[msg]
```

and the `any` address log for the WHOLE game: `sd=0  me=3  shared=0`, this engine's extra draw
reading `20260813|2|any|direclaw|p10|0` — an address the authority never asks in that bucket, because
it asked the identical question one bucket over.

### The fix

`applyStatus` takes an optional `dstream` and hands it to `sleepDurationDraw`; the `proceduralStatus`
site passes `_R.sec`. Membership is the parameter, not a name — derived over the 500 legal moves,
`slp` arrives from inside `secondaries` through exactly one handler in this format, and hypnosis,
sing, sleeppowder and spore are PRIMARY `status: 'slp'` outside that scope (Rest overwrites the timer
to 3 with no draw). `MEDSEEN.sleepDurationDrawnUnderSecondary` counts the calls that carried a
stream, so a wire that stopped passing it reads zero rather than looking like a caller with nothing
to say.

### The probe was wrong before the engine was

The first version of the clock arm compared only ATTEMPTS SPENT — `frzTurns` against
`startTime - time` — and was **green over the defect**: on the Golurk card both engines had spent 0
while one held a length of 3 and the other of 2. The LENGTH is the leaf that decides the wake turn.
Both are asserted now, and the comment saying so is in the file.

---

## Attribution — five games closed, zero opened, and the fifth is not luck

Diffed against `git show HEAD:data/game-differential.json`:

| game | leaf that parted | owned by |
|---|---|---|
| omit-weather t7 `…2660414382` | `p1.active[1].stall` | fix 1 |
| omit-weather t9 `…2635949496` | `p1.active[0].stall` | fix 1 |
| omit-spread t16 `…2655675221` | `p2.active[1].stall` | fix 1 |
| pair-protect-bust t6 `…2660356793` | `p1.party.golurk.status` + counter | fix 2 |
| pair-redirect-priority t4 `…2659024897` | `p1.party.pelipper.hp` / `.fainted` | fix 2 |

**No new board-material game appeared.**

The Pelipper game is not a sleep card on its face, so it gets its own ATTRIBUTION arm in
`probe_status_clock_dice.js` rather than a sentence claiming five games were repaired. It replays
clean under the current bytes and goes RED under `MEDI_SLEEP_START_ANY_ADDR=1`, and
`sleepDurationDrawnUnderSecondary` goes 1 → 2 when it is added — so that game contains a
secondary-sourced sleep of its own and it is the same defect, not `nth` displacement.

---

## The prediction record — three hits, two named misses, both in the good direction

Written to `data/verification/_prediction-2026-09-06-stall-residual-foot.json` and
`_prediction-2026-09-06-sleep-start-stream.json` BEFORE the run.

| predicted | actual | |
|---|---|---|
| stall fix alone: board-material 27 → 24 | 3 games, so 24 | HIT |
| both fixes: board-material → 23 | **22** | MISS — I predicted only the Golurk game for fix 2 |
| protocol 93 → 92 | **91** | MISS — the Pelipper game carried a protocol divergence too |
| narration 70 → "69 or 70" | **70** | HIT |
| census 830/830 unchanged | 830/830 | HIT |
| roster 0/0 on all three stages | 0/0/0 | HIT |
| the three stall games have no protocol row to transfer into, so narration must not rise | 71 raw both sides | HIT |

---

## What was NOT fixed, and why — say it here rather than let it be found

**FREEZE is not a board defect on the game that accuses it.** Replayed on
`baseline ...bo3-2655996768 vs ...bo3-2656208114`, the artifact's own freeze card: `protocol_div_turn
= 7`, **`board_div = null`** — the boards never part in that game. It is a NARRATION divergence. And
the whole-game address logs are `any` **4/4 shared** and `acc` **13/13 shared**, which refutes an
address mismatch as its cause. Champions' `frz` arithmetic was re-derived and matches this engine's
line for line (`frzTurns >= 3 || rng() < 0.25` against `time <= 0 || randomChance(1,4)`, same
short-circuit, same order). **Undiagnosed and still open — but it is not board-material, so it
belongs to the narration gate.**

**The second sleep card is an ACCURACY card.** `omit-spread ...bo3-2661122292` t15: the authority's
Sleep Powder hits and this engine's misses. Both engines asked the SAME address
(`20260813|15|acc|sleeppowder|p11|0`, `nth` 0), so they drew the same number and the difference is
the accuracy THRESHOLD, not the die. Compound Eyes is tabled here at `x1.3`
(`'ability:compoundeyes':{side:'att',mult:1.3}`), so the obvious explanation is already wired and the
real cause is not yet known. **Filed, not fixed. This is one of the 22 remaining board-material
games.**

**The other two uncaused games remain and they are the same two:**

```
baseline    t6   …2661571698   p1.pp[1].expandingforce   medi 1 / sd 2
omit-spread t7   …2661455548   p2.party.castform.species medi castformrainy / sd castform  (+ .types)
```

**`tests/test-engine-diff.js` WAS re-run, because the release bump staled it.** Left alone it read
`MEASURED AGAINST A DIFFERENT ENGINE` on the gate, which is an answer about other bytes and not a
weaker one. `--n 6000 --seed 20260804`: **6,000 compared, 6,000 agreed, 0 disagreed**, exit 0 on
release `ab22bc503717`. The standing `exit 3` is the 150-default shrink guard and does not arise at
`--n 6000`; it is not a differential failure and was not one before this pass either.

**Three files this batch did not touch, by instruction:** `engine/game_differential.js`,
`engine/diff_swarm.js`, `engine/steering.js` — a second agent is fixing filed instrument defects in
them. `driver_code_stable` read `true` for the whole 296 s run, so nothing moved under this
measurement.

---

## Files

- `engine/medicham2-browser.js` — the two fixes, two restore knobs, four new counters.
- `tests/probe_stall_uncaused.js` — new.
- `tests/probe_status_clock_dice.js` — new.
- `data/verification/_prediction-2026-09-06-stall-residual-foot.json`,
  `data/verification/_prediction-2026-09-06-sleep-start-stream.json` — written before measuring.
- `data/game-differential.json`, `data/roster.{items,abilities,moves}.json`,
  `data/mechanics-census.json` — regenerated on release `ab22bc503717`.
