# The roster's 157 — 2026-08-22

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

---

## VERDICT

**The 157 is not #304, not #312, and not a damage defect of any kind. It is an INSTRUMENT defect:
`tests/roster.js` asked for its primary pin arm BY OMISSION, and since 2026-08-13 the driver's
default arm has been `middle` — real, event-addressed dice — not `top-tie-first`.** Every one of the
157 rows still printed `arm: "top-tie-first"`.

Split, measured, PAIRED on release `603d9a69d5a3` with the arm resolution as the only difference:

| stage | committed artifact | restored defect | arm resolved by id |
|---|---|---|---|
| moves | 157 DIFFER / 0 SILENT | **157 / 0** | **5 / 0** |
| items | 3 / 0 | *(not re-run under the flag)* | **2 / 0** |
| abilities | 8 / 1 | *(not re-run under the flag)* | **0 / 0** |

**The restored-defect run reproduces the committed artifact on 500 of 500 rows, verdict for verdict**
(`FIRED-AND-BOARDS-DIFFER 157, DID-NOT-FIRE 0, DEFERRED-BY-OWNER 25, FIRED-AND-BOARDS-MATCH 298,
CONTROL-NOT-QUIET 0, COULD-NOT-STAGE 20` — identical counts and identical per-row verdicts). That is
the attribution: **162 of the 169 roster accusations against the engine were this instrument.**

Second deliverable: **the differential can now see the band.** `tests/test-engine-diff.js` sweeps all
sixteen indices, the fourteen interior arms are in `data/engine-diff.json` and therefore in the gate
(`differentialClause` iterates whatever arms the artifact carries), and they have their own red
demonstration, `--plant band`. **The interior is clean apart from rows already filed.**

---

## 1. THE BRIEF'S HYPOTHESIS IS REFUTED, AND THE COORDINATOR'S MID-TASK CHALLENGE IS CONFIRMED — WITH ONE CORRECTION

The challenge said: *"tests/roster.js pins every die to a CORNER … and the file states both engines
are pinned to it identically."*

That is what the file **said**. It is not what the file **did**, and the gap is the whole finding.

```js
// tests/roster.js, before this pass
const PRIMARY_ARM_ID = 'top-tie-first';
function play(sc, src, armId) {
  let ARM = null;
  if (armId && armId !== PRIMARY_ARM_ID) {          //  <-- the primary arm is NEVER resolved
    ARM = G.ARM_BY_ID.get(armId);
  }
  ...
  G.playGame(a, b, 'directed', 'roster:' + sc.id, { arm: ARM || undefined, ... });
}
```

`arm: undefined` takes the driver's default, and the driver's default is

```js
// engine/game_differential.js:1263
const PRIMARY_ARM = ARMS[0];
```

`ARMS[0]` was `top-tie-first` until commit **cf7a2c5, 2026-08-13, "The middle arm exists"**, which
prepended `middle` to the array. That commit's own message says the middle arm is *"opt-in and
deliberately NOT in the default set"*. It became the default for every caller that omits `arm`.

**The challenge's third bullet was the right thread and stopped one step short.** The arm asymmetry
is not "a fact about the pinned corner" — it is the fact that **one of the two arms was not pinned at
all**. `bottom-tie-first` is fetched by id (`armFor()` returns it explicitly), so it was genuinely
pinned; `top-tie-first` was requested by omission, so it was not:

```
data/roster.moves.json, by arm            DIFFER   MATCH   rate
  top-tie-first   (fell through)            156     184    45.9% of 340 tested
  bottom-tie-first (resolved by id)           1     114     0.87% of 115 tested
```

Items: all 3 differs on `top-tie-first`. Abilities: all 8 differs and the 1 `DID-NOT-FIRE` on
`top-tie-first`. A damage defect cannot know which label a row carries.

**Everything the challenge verified about the index is correct and none of it was ever in doubt.**
`damageRollIndex` and `midDamageIndex` are the same expression, both engines derive the same index
from the same draw, and 2,635 inversions producing no divergence is exactly what that predicts. The
index was never the mechanism; the mechanism is that on 156 of the 157 rows **there was no pin at
all**, so the two engines were on the middle arm's event-addressed dice while every rule in the file
was written against a constant corner ("the pin makes every sub-100 move miss", "no crit lands",
"the maximum roll is the roll the pin selects").

**And the two instruments were never in contradiction.** `test-engine-diff.js` reads 0/6000 at the
corners because it really is at the corners — it calls `dmgRange` directly and never plays a game.
The roster believed it was at a corner and was not. That is the whole of the "both cannot be true"
puzzle.

## 2. HOW IT WAS FOUND — THE PROBE, RED FIRST

`aerialace`: Goodra-Hisui clicks Aerial Ace at Goodra-Hisui twice, `hpB: 8`. Showdown 1216, ours
1215, bucket `off-by-one`, exactly as the artifact says. Turn 1 agreed at 1228; turn 2 did not.

**The same click on the same board dealt 12 then 13.** A constant die cannot do that. Patching the
release's engine to dump the damage internals (via `staged_board.harness(src)`, which injects into
the snapshot's own module path) gave the answer in one line:

```
DBG mv=aerialace u=0.33557984861545265 idx=10 dmin=11 dmax=14 band=[14,13,13,13,13,13,13,13,12,12,12,12,12,12,12,11] dmg=12
DBG mv=aerialace u=0.9253654214553535 idx=1  dmin=11 dmax=14 band=[...]                                                dmg=13
DBG mv=aerialace u=0.37998624169267714 idx=9 dmin=11 dmax=14 band=[...]                                                dmg=12
```

`u` is a different float every turn. Under `top-tie-first` the same probe reads:

```
DBG mv=aerialace u=0.999999999 idx=0 dmin=11 dmax=14 band=[14,13,...,11] dmg=14   (x5, identical)
```

`u = 0.999999999` is `CORNER_TOP = 1 - 1e-9`. The band was always right; the die was never pinned.

## 3. WHAT WAS LANDED

**One mechanism, one batch.** `engine/game_differential.js` was NOT touched — see §5.

### `tests/roster.js`

- `play()` now resolves the arm BY ID in every case: `G.ARM_BY_ID.get(armId || PRIMARY_ARM_ID)`.
  `arm: undefined` is no longer reachable from this file.
- **`ARM_PLAYED`** — a counter keyed on the id of the arm OBJECT that reached the driver, published
  as `arms_played` in the artifact and printed on every run. A label is not a receipt: every one of
  the 157 rows carried the right label and the wrong dice, which is why nothing could see it. A
  `DRIVER-DEFAULT:` key is printed with `<-- NOT PINNED BY NAME. This run is not the arm it says it is.`
- **`ROSTER_ARM_FALLS_THROUGH=1`** restores the defect at runtime, on the same rule as
  `MEDI_DAMAGE_SPAN_DRAW` — the defect stays reachable for a paired measurement without swapping a
  file, and a run carrying it says so out loud.

### `tests/test-roster-arm-pin.js` — NEW

Four sections, all shown red before they were believed:

- **§1, at the driver.** Six identical clicks on one staged board. Under a named corner every hit
  must deal the SAME damage; under `middle` it must NOT. The middle row is the over-fire control —
  without it the file would pass on an engine whose damage never varies. Fixture derived from the
  format every run (a body whose ability registers no `on*` key; the highest-power 100-accuracy move
  with no secondary, drain, recoil, multi-hit or raised crit ratio).
  Measured: `top-tie-first 12 12 12 12 12 12`, `bottom-tie-first 15 15 15 15 15 15`,
  `middle 12 11 17 11 12 11`.
- **§2, at the roster.** No `arms_played` key may start with `DRIVER-DEFAULT:`; every arm a compared
  row declared must appear as a key; every key must be an arm the driver publishes.
- **§3, the red demonstration.** §2 re-run under `ROSTER_ARM_FALLS_THROUGH=1` MUST fail. It reads
  `{"DRIVER-DEFAULT:middle":280}`.
- **§0** prints `PRIMARY_ARM` and flags it when it is not `top-tie-first`, so the condition that made
  this possible is visible rather than remembered.

**Two instrument bugs of my own were found and cleared before the engine was believed**, and both
would have produced a confident wrong answer:

1. §1's first version aimed both of side A's bodies at `t: 0`, so p2a took two hits a turn and the
   corner arms read `33 12 33 12 …` — which looks exactly like an unpinned die. Slot b now aims at
   slot b.
2. §2 treated the roster's non-zero exit as a crash. The roster exits 1 whenever any row differs,
   which is most of the time; both sections were red on a run that had produced a perfectly good
   artifact.

### `tests/test-engine-diff.js` — the band sweep (the second deliverable)

`dmgRange` already fills a sixteen-entry `rolls` band in the authority's index order (#304) and
`showdownDamage(...)` already takes the index as a parameter — so the interior was one out-parameter
away and nobody had asked. Fourteen new arms `idx01`…`idx14`, same 12% band, same cap, same
worst-of-branches rule as the corners. `engine/quarantine.js` iterates whatever `arms` the artifact
carries, so **the gate picked them up with no change on that side.**

- **`--plant band`** perturbs the fourteen interior rolls and leaves indices 0 and 15 alone — the
  exact inverse of `--plant spread`. An arm with no plant that can move it is an arm nobody has checked.
- **A move with no randomizer is not a missing band.** `dmgRangeOneHit` returns before filling
  `rolls` for exactly the cases the authority also decides above its randomizer (immunity, a
  type-chart zero, the fixed-damage family). Those are compared at `min` at every index, so the
  interior keeps its full denominator. Only a row with a real SPAN and no band is counted as
  `band_missing`, and it reads **0**.
- Both of those were got wrong first and caught by the plant: reading "is this flat?" AFTER
  `--plant spread` widened the range turned ten fixed-damage rows into ten `band_missing` ones and
  silently shrank the interior denominator to 190 of 200.

**The three plants are orthogonal, which is the proof the arms are independent** (n=200, seed 20260804):

| run | midpoint | top | bottom | interior (per index) |
|---|---|---|---|---|
| no plant | 1 | 1 | 1 | 1 |
| `--plant spread` | 1 | **135** | **143** | 1 |
| `--plant band` | 1 | 1 | 1 | **135** |

## 4. WHAT THE INSTRUMENTS READ NOW

**Roster, release `603d9a69d5a3`, `--json` (nothing under `data/roster.*.json` was overwritten — the
committed baseline is intact):**

```
moves      5 DIFFER   0 SILENT   469 MATCH   3 DEFERRED   23 COULD-NOT-STAGE   arms_played {top-tie-first:741, bottom-tie-first:246}
items      2 DIFFER   0 SILENT   137 MATCH                 8 COULD-NOT-STAGE   arms_played {top-tie-first:280}
abilities  0 DIFFER   0 SILENT   129 MATCH   46 CONTROL-NOT-QUIET   141 COULD-NOT-STAGE
```

The seven survivors, which are the real leads and are small enough to take one at a time:

| stage | id | leaf |
|---|---|---|
| moves | `dragoncheer` | `vol.focusenergy` sd 0 / me 1 |
| moves | `fakeout` | `vol.focusenergy` sd 1 / me 0 |
| moves | `psychup` | `vol.focusenergy` sd 0 / me 1 |
| moves | `transform` | `vol.focusenergy` sd 1 / me 0 |
| moves | `matchagotcha` | hp sd 583 / me 582 — `bottom-tie-first`, the one genuinely-pinned differ |
| items | `bigroot` | hp sd 693 / me 692 |
| items | `greninjite` | `types` sd `normal` / me `dark/water` — the Protean-on-mega row from the gate re-run |

Four of the seven are one family: the control click IS Focus Energy, so `dragoncheer`, `psychup`,
`transform` and `fakeout` are all about whether that volatile is copied, set or removed. That is a
single mechanism and a good next batch.

**A CAVEAT FOR WHOEVER TAKES THEM, BECAUSE IT WOULD OTHERWISE BE THE NEXT WRONG DIAGNOSIS.**
`tests/roster.js --selftest` prints that the control click's exemption is exactly
`[pp.focusenergy, vol.focusenergy]` — the same leaf these four rows part on. Confirm the exemption is
not itself producing the verdict before charging the engine. The selftest is green after this pass
(9 of 9 clauses), so the control is doing what it says; that is not the same as proving these four
rows are engine defects.

**Differential, `--n 6000 --seed 20260804`, published to `data/engine-diff.json` at 14:49:**

```
midpoint  24 / 6000        top  24 / 6000        bottom  24 / 6000
interior  24-25 per index across all 14, band_missing 0
```

**The 24 are not new and not the band.** 19 Furfrou rows (ROADMAP #317, Fur Coat carries no defence
multiplier, we deal exactly double) and 5 Aurorus Hyper Voice rows — the same two families
`docs/ENGINE.md` recorded yesterday as `14 of 3,000 at each corner` on the live tree. **The interior
of the roll adds no rows the corners do not already have**, which is a positive result about #304's
landing across ~96,000 comparisons.

**THE GATE CLAUSE THEREFORE FLIPS PASS -> FAIL, AND THE FAIL IS TRUE.** The published artifact said
`0/6000` and was generated 2026-08-18, before the engine moved. The number moved because the
ARTIFACT was stale, not because the band found anything: the midpoint and both corners read 24 with
and without this change, and the control for that is a paired n=200 run reading `agreed 199 /
disagreed 1` before the edit and `199 / 1` after it.

## 5. WHAT WAS DELIBERATELY NOT FIXED, AND WHY

**`PRIMARY_ARM = ARMS[0]` in `engine/game_differential.js` was left alone.** It is not obviously
wrong there: the whole-game differential intends `middle` as its headline arm (`data/game-differential.json`
carries `mode: A/middle/...`, and #303/#304 were both measured on it). Changing `ARMS[0]` would move
that published headline and every artifact keyed to `PIN_DIGEST` — a re-baseline, not a fix to bundle
into this batch. The roster-side fix makes the roster immune to it either way.

**BUT THE BLAST RADIUS IS MUCH WIDER THAN THE ROSTER AND SOMEBODY HAS TO OWN IT.** Every caller of
`playGame` that omits `arm` has been on the middle arm since 2026-08-13. Files with a `playGame` call
and **no `arm:` mention anywhere in them**:

```
tests/staged_board.js          tests/probe_bench_leaves.js     tests/probe_drag_body.js
tests/probe_drag_exposure.js   tests/probe_fail_and_silent.js  tests/probe_mega_direct.js
tests/probe_mega_priority.js   tests/probe_trace_choice.js     tests/probe_turn_order.js
tests/probe_volatile_leaves.js tests/test-bracket-regain.js    tests/test-effect-credit.js
tests/test-encore-fail-silent.js tests/test-end-state.js       tests/test-end-state-severity.js
tests/test-forme-assert.js     tests/test-imposter-transform-line.js tests/test-precharge-order.js
tests/test-resolution-order.js tests/test-speed-tie.js         tests/test-state-differential.js
tests/test-switch-back-renamed.js
engine/explain_divergence.js   engine/leaf_engine_contrast.js  engine/lookahead_divergence.js
engine/replay_differential.js  engine/replay_one.js
```

Some of those legitimately want real dice. Some certainly do not — `tests/test-speed-tie.js` and
`tests/test-bracket-regain.js` are ordering tests whose whole design assumes a deterministic board.
**Auditing 27 callers at once makes a bad result unattributable**, so this is filed rather than
fixed. `engine/all_mechanics_fire.js` is CLEAN — it resolves `bottom-tie-first` by id and refuses to
guess if it is gone, which is why the gate re-run saw it "barely move" while the roster's move stage
broke. That contrast is the diagnosis, not a coincidence.

## 6. THINGS OBSERVED, NOT CAUSED

- **A release was cut under me at 08:28.** `data/engine-release.json` moved from `603d9a69d5a3` to
  `e12ef20e7910` because `data/move-priors.json` — a SOURCE file — changed on the live tree.
  Not mine; nothing of mine writes it. Consequence: `engine/status.js` now reports all three roster
  clauses and the whole-game differential as `MEASURED AGAINST A DIFFERENT ENGINE`, and **an
  unpinned roster run silently measures `e12ef20e7910`**. Every number in this report is pinned with
  an explicit `--release 603d9a69d5a3`, and `engine_release.js verify 603d9a69d5a3` reads *intact*.
- **`CONTROL-NOT-QUIET 46` on the abilities stage is NOT the arm.** It reads 46 with the fix and 47
  in the committed artifact, so the 13 -> 47 movement the gate re-run flagged has some other cause
  and is still open.
- **`data/verification/engine-diff.n200.json`** is a new untracked file, written by my own timing
  runs. Mine, harmless, left in place.
- `data/docs-currency-baseline.json` and `data/provenance-stamp.json` are modified in the working
  tree and are not mine.

## 7. NOT DONE

- **`node engine/status.js --write` was NOT run.** It rewrites `data/open-work.json` and
  `data/provenance-stamp.json`, which are not outputs of this work, and two other agents are live in
  `docs/`. The GENERATED blocks in `docs/ENGINE.md` are therefore one restamp behind the
  `24/6000` differential figure. Flagged for the coordinator, not actioned.
- Nothing was committed or pushed.
- `docs/ROADMAP.md` was not touched.

## 8. WHAT THE REGISTER OWES

1. **A new row: the roster's arm fell through to `middle` for nine days.** Found and fixed
   2026-08-22 by ENGINE; verified by `tests/test-roster-arm-pin.js`. 162 of 169 roster differs were
   this. It retroactively invalidates the roster half of `docs/_reports/2026-08-22-gate-rerun.md`.
2. **A new row: 27 `playGame` callers omit `arm` and are on the middle arm.** §5 lists them. Audit
   owed; not a fix.
3. **#304 and #312 are untouched by this and neither is closed.** #312's three rows are measured by
   `all_mechanics_fire.js`, which pins its arm by id and was never affected. `shellsidearm` was
   inside the 157 and now MATCHES on the roster — that is the roster's staging not reaching the
   category flip, **not** evidence for #312.
4. **The differential clause is now FAIL at 24/6000 and it is a true fail** on #317 (19 Furfrou rows)
   plus 5 Aurorus Hyper Voice rows. The previous `0/6000` described bytes from 2026-08-18.
