# Cloud Nine — two defects, both landed. The upkeep line is exempt from suppression; the flag is live.

Written 2026-08-23 by ENGINE. Both defects came from
[`docs/_reports/2026-08-23-weather-war.md`](2026-08-23-weather-war.md), which named them off artifacts
and citations without running anything. This pass **re-derived both at the authority's lines,
MEASURED both expectations in the official simulator, and landed both.**

---

## VERDICT

1. **DEFECT 1 landed.** `|-weather|W|[upkeep]` now prints while a weather suppressor is standing on the
   field. **The chip does not** — asserted at exactly zero on the same board, and that assertion is the
   control that makes the probe mean anything.
2. **DEFECT 2 landed, and it is the board-material one.** `field.wSup` is re-derived whenever the set of
   standing bodies changes, so a suppressor that leaves or faints mid-turn stops suppressing at that
   turn's residual. The authority chips 10 HP a body there; this engine chipped nothing.
3. **The five games cleared.** The two weather-upkeep causes in `data/game-differential.json` — 4 games
   of `|-weather|raindance|[upkeep] <> |upkeep` and 1 of the sandstorm one — are **gone**, and a full
   diff of the cause list shows **nothing new appeared and nothing else changed**.
4. **Census 662 → 664 live, 0 missing.** Damage differential held at 0 of 6000 on all 16 corners.
   Board-material held at 24 games. **ROADMAP #352 closes.**

---

## 1. DEFECT 1 — the gate on the upkeep LINE

### Re-derived at the lines

| where | what it says |
|---|---|
| `sim/battle.ts:615-621` (`singleEvent`) | a `Weather`-effect handler is suppressed **unless** `eventid` is `FieldStart`, `FieldResidual` or `FieldEnd` |
| `sim/battle.ts:558-563` (`fieldEvent`) | `handlerEventid = 'Field' + eventid` when the holder is the `Field`, so the weather's residual arrives as **`FieldResidual`** — i.e. exempt |
| `data/conditions.ts:505-508` rain, `:653-656` sandstorm | `onFieldResidual() { this.add('-weather', …, '[upkeep]'); … this.eachEvent('Weather'); }` |
| `sim/battle.ts:888-894` (`runEvent`) | the chip **is** suppressed: `eventid === 'Weather'` is not on the exempt list |
| `sim/field.ts:101-115` | `isWeather()` reads `effectiveWeather()`, which is `''` under suppression — sandstorm is doubly refused |

**Champions overrides none of it.** `data/mods/champions/conditions.ts` carries no weather condition
(`grep raindance|sandstorm|sunnyday|snowscape` returns nothing) and `scripts.ts` overrides no event
dispatcher — its only `singleEvent`/`runEvent` mentions are call sites inside `moveHit`.

**Ours before:** `engine/medicham2-browser.js` — `if(TR){if(field.weather&&!field.wSup)TR.wx(...)}`.
The line itself was gated. The chip gate beside it (`residualUpdatePass`'s `!field.wSup`) was and is
correct.

### MEASURED, not read — the official simulator, both arms

Altaria + Milotic against a Sand Stream Tyranitar + Incineroar, everybody clicking Protect:

```
ability Cloud Nine     |-weather|Sandstorm|[upkeep]     and ZERO `[from] Sandstorm` damage lines
ability Natural Cure   |-weather|Sandstorm|[upkeep]     and THREE of them
```

**The line is in both streams. Only the damage moves across the knob.**

### The fix, and what is NOT under the knob

The exemption is spelled as the authority spells it — the announcement only. The chip gate is
untouched and is asserted at exact zero on the suppressed arm. `MEDI_WEATHER_UPKEEP_GATED=1` restores
the old gate and stamps `MEDFAILS.weatherUpkeepGatedRestored`. **The counter is set OUTSIDE the
`if(TR)` block deliberately**: a run with no trace attached writes no upkeep line either way, so a
receipt that only appeared when somebody was listening would be a silent default.

### The probe, and the chip control

`tests/test-mechanics.js` → `condition/weatherUpkeepUnderSuppression`.

**The arms are the CHIP, not the line.** The line is identical on both arms by construction — that is
the whole finding — so a probe whose arms were the line would have been hollow the day it went green,
and a "print the line anyway" fix that also un-suppressed the damage would have passed it.

```
RED   (MEDI_WEATHER_UPKEEP_GATED=1)
  sand + no suppressor   line "|-weather|sandstorm|[upkeep]"   chip 10
  sand + cloudnine       line ""                               chip 0     <- the defect
GREEN (clean tree)
  sand + no suppressor   line "|-weather|sandstorm|[upkeep]"   chip 10
  sand + cloudnine       line "|-weather|sandstorm|[upkeep]"   chip 0     <- line back, chip still 0
```

Third arm: **rain**, which has no residual damage at all, must still print its upkeep line — so "only
sandstorm announces" cannot pass.

**The suppressing class is DERIVED, and printed.** `TAGS.withTag('ability','weatherSuppression')`
returns exactly `["cloudnine"]` and the probe prints it in its own detail on every run, so a member
added later is played without editing the file. Air Lock has no legal carrier in Reg M-B.

---

## 2. DEFECT 2 — the flag was computed once a turn

### Re-derived

`sim/field.ts:106-115` — `suppressingWeather()` walks `battle.sides[].active` **on every call** and
skips a fainted body. There is no cache. `effectiveWeather()` (`:101-104`) is that walk.

Ours computed `field.wSup` once at the top of the turn, and resynced it **only on a mega** — with a
comment that already said *"a switch or a faint changes it"*.

### MEASURED — the departure knob moved the authority and did not move us

Same four bodies, Altaria switching to Gallade on turn 2, everybody else clicking Protect:

| arm | authority, turn 2 | this engine before | this engine after |
|---|---|---|---|
| Cloud Nine, Altaria **LEAVES** | Milotic 160/170, Gallade 135/143, Incineroar 160/170 | **no chip at all** | 160/170, 135/143, 160/170 — identical |
| Cloud Nine, Altaria **STAYS** (knob cleared) | no chip | no chip | no chip |
| Natural Cure, LEAVES (ability control) | chips on both turns | chips on both turns | chips on both turns |

**Two arms reading 0 and 0 across a varied knob that moves the authority by 10 HP a body is an unwired
knob, not a mechanic that does not matter.**

### The fix

One function, `recomputeWeatherSuppression(field, bodies)` — because the expression was already
written out twice and two copies of "who suppresses the weather" is the FACTS-ARE-GLOBAL breach
CLAUDE.md names. **Four callers:**

| caller | why |
|---|---|
| top of turn | the existing site, unchanged in behaviour |
| the mega path | the existing site, unchanged in behaviour |
| `runEntryPass` | a switch is the commonest mid-turn change, in both directions |
| `_updateAll` | the settle at the top of every action and after the last one — **this is the half `runEntryPass` cannot see: a FAINT.** A suppressor that faints is not replaced until after the residual in doubles, so nothing else in the turn would notice |

**The `runEntryPass` call runs BEFORE `syncFieldTypes`, and that ordering is load-bearing rather than
tidy.** `syncWeatherFormes` asks `effWeatherOf`, whose first clause is `field.wSup`; a Castform walking
in beside a suppressor that just left would otherwise retype off the stale flag.

**It cannot over-fire.** It is the same expression the top-of-turn site already ran, over whoever is
standing there now. `MEDSEEN.wSupResynced` counts the flag **MOVING**, never the recomputation — a
counter that rose on every call would say nothing.

`MEDI_WSUP_STALE=1` restores the once-a-turn cache and stamps `MEDFAILS.wSupStaleRestored`. It is a
**second** knob rather than a clause of the first because one defect is a line and one is HP, and a
knob that restored both could not tell which half a red arm was about.

### The probe

`tests/test-mechanics.js` → `condition/weatherSuppressionIsLive`. **The arms are the DEPARTURE** — the
identical board where the suppressor STAYS is the control, so the two differ by exactly the switch.
A "Cloud Nine vs no ability" pair would already have been green on the broken engine.

```
RED   (MEDI_WSUP_STALE=1)   cloudnine STAYS t1 0 t2 0;  cloudnine LEAVES t1 0 t2 0;  none t1 10 t2 10
GREEN (clean tree)          cloudnine STAYS t1 0 t2 0;  cloudnine LEAVES t1 0 t2 10; none t1 10 t2 10
```

Turn 1 is asserted at 0 on both suppressed arms, so "the fix un-suppressed everything" cannot pass.

### What the state instrument said

`node engine/move_result_state.js --selftest` — **18 passed, 0 failed.** Stated plainly: that
instrument compares `moveThisTurnResult` / `moveLastTurnResult`, which **this change does not touch**.
It is a receipt that the move-result comparator is intact, not evidence about weather suppression. The
state evidence for defect 2 is the HP table above, taken from `board_state.js`'s own leaves through
the whole-game run.

---

## 3. THE NUMBERS

**Damage differential** — `tests/test-engine-diff.js --n 6000 --seed 20260804`, run after each defect
separately: **0 of 6000 at every one of the 16 corners**, 134 not comparable (multihit 134, non-finite
0, threw 0). Unmoved.

**Census** — `data/mechanics-census.json`:

```
before   662 live / 662 probed / 0 missing
after    664 live / 664 probed / 0 missing
ratchets unarmed 0, directCall 1, hollow 0, threw 0   (all held; no --accept needed)
```

**Whole-game** — `engine/game_differential.js --games 1200 --arm middle --team-store
data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json --end-state --write`.
**This is a re-baseline, not a delta**: the release moved and the pins did not.

| quantity | before, release `c30534af567b` | after, release `a7839b20e7d5` |
|---|---|---|
| raw parted | 53 | **48** |
| undeclared (raw less 5 declared Supreme Overlord) | 48 of 961 = 5.0% | **43 of 961 = 4.5%** |
| **board-material** causes / games | 23 / **24** | 23 / **24** — unmoved |
| narration-only causes / games | 24 / **29** | 22 / **24** — fell by 5 |
| DIFFERENT-END-STATE among parted | 17 | 17 — unmoved |
| VOID (instrument desync) | 2 | 2 |

**The five games, attributed.** A full diff of `summary.by_cause` between the two artifacts:

```
gone   NARRATION-ONLY x4   event missing from medicham2 :: |-weather|raindance|[upkeep] <> |upkeep
gone   NARRATION-ONLY x1   event missing from medicham2 :: |-weather|sandstorm|[upkeep] <> |upkeep
new    (none)
changed(none)
```

Perfect isolation. The one weather cause that remains — `ordering :: |-unboost|p1a|atk|1 <>
|-weather|raindance|[from]drizzle`, 1 game — is the simultaneous-switch-order question and belongs to
#353, not here.

**Which scoreboard, said before the run:** BOTH were expected to move. Cloud Nine's exposure is 286 of
26,370 sheets (1.08%) but the five carded divergences were all in the pinned pool, so the pool was the
right instrument for defect 1. Defect 2 needs a suppressor to LEAVE mid-turn, which is rarer; **it is
not separately attributed inside the whole-game number** and no claim is made that it moved one.

**Roster, all three stages re-run against the new release** (they had gone WITHHELD, as they do after
any engine edit):

```
items      0 FIRED-AND-BOARDS-DIFFER   0 DID-NOT-FIRE   139 match, 1 deferred, 8 could-not-stage
abilities  0 FIRED-AND-BOARDS-DIFFER   0 DID-NOT-FIRE   130 match, 45 control-not-quiet, 141 could-not-stage
moves      0 FIRED-AND-BOARDS-DIFFER   0 DID-NOT-FIRE   475 match, 3 deferred, 22 could-not-stage
```

Every verdict distribution is **identical** to the previous release's. This change moved nothing in
the lab.

**`all_mechanics_fire`, re-run against the new release:** moves 20, abilities 8, items 1. Previously
moves 20, abilities 9, items 1. **This is NOT a before/after** — the instrument is steered by the
census and the census gained two rows, so it played a different set of games. The absolute numbers are
current; the difference is not attributable.

**Other instruments, run and green:** `tests/test-protocol-trace.js` (all passed, both derivation
gates), `tests/test-resolution-order.js` (26 arms, 1 declared KNOWN-OPEN, 0 failing),
`tests/test-engine-consistency.js` (all checks passed), `tests/test-volatile-duration.js` (4 of 4
identical).

---

## 4. OWED, NOT RUN

- **`node engine/quarantine.js`** — not run. `status.js` computes the same clauses and was run; the
  full derivation and the withheld set were not printed.
- **`engine/replay_one.js` on the five seeds** — not run. It was not needed: the cause diff above
  attributes all five by name off two artifacts, which is stronger than reading one replay.
- **`engine/wire_ladder.js`** — `data/wire-ladder.json` is UNSAFE (its inputs moved) and the release
  ladder figure is WITHHELD. Pre-existing; not caused by this pass.
- **The FEATURE SEMANTICS CHECK failure** printed by `status.js` — the fixture changed (scenarios
  10 → 12) and the damage table was regenerated (318 → 322 species). **Neither is this pass**: no file
  under `data/engine-data.js` or `engine/board.js` was touched here. It belongs to MEASURE.
- **`engine/decision-impact`** — `data/decision-impact.json` is still absent, so nothing is excused on
  decision impact and every played divergence counts. Unchanged by this pass.
- **The whole-game direction-of-travel** is WITHHELD by `status.js` because the stamped baseline pin
  is a different corner (`top-tie-first`) from this run's (`middle`). Re-stamping is
  `node engine/quarantine.js --stamp-whole-game` and is a MEASURE decision, not taken here.
- **Defect 2 is not separately attributed in the pool.** The whole-game fall of 5 is defect 1's. No
  pinned-pool evidence is claimed for defect 2; its evidence is the staged board against the authority.
- **Two families the live re-derivation does NOT cover**, stated rather than missed: an ability
  REMOVED mid-turn by Gastro Acid / Neutralizing Gas, and a suppressor whose ability is swapped away by
  Skill Swap / Worry Seed / Entrainment. Both land at the next `_updateAll`, which is the top of the
  next action — correct for the residual and one action late for a damage read inside the same action.
  Not staged, not claimed.

---

## 5. REGISTER — proposed text (ROADMAP.md NOT edited)

**CLOSE #352.** Proposed status cell and closing note:

> **CLOSED 2026-08-23 (ENGINE).** Both clauses landed. (a) The `wSup` gate on the
> `|-weather|W|[upkeep]` LINE was a derived decision the authority never makes — `sim/battle.ts:615-621`
> exempts `FieldStart`, `FieldResidual` and `FieldEnd` by name — and the chip stays suppressed, asserted
> at exact zero. (b) A second, board-material clause found in the same neighbourhood: `field.wSup` was
> cached once a turn where `sim/field.ts:106-115` evaluates live, so a suppressor that left mid-turn
> kept suppressing and the residual did not chip. **This row was dismissed earlier the same day as
> "certain but probably irrelevant" because four staged arms had no suppressor on the field at all, so
> the flag was never set. It claims the five carded weather-upkeep games**: `summary.by_cause` loses
> exactly `|-weather|raindance|[upkeep] <> |upkeep` (4 games) and `|-weather|sandstorm|[upkeep] <>
> |upkeep` (1 game) and gains nothing.
> **VERIFIED BY** `tests/test-mechanics.js` `condition/weatherUpkeepUnderSuppression`
> (knob `MEDI_WEATHER_UPKEEP_GATED=1`) and `condition/weatherSuppressionIsLive`
> (knob `MEDI_WSUP_STALE=1`).

**No new row is proposed.** The two families under OWED above (Gastro Acid / Neutralizing Gas, and an
ability swapped away mid-action) are one action late rather than wrong at the residual, are unstaged
and unmeasured, and a row asserting breakage with no instrument that decides it is DEBT — the register
already carries 53 of those.
