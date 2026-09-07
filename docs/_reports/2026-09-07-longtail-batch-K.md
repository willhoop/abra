# LONG-TAIL BATCH K — the thirteen, taken one at a time

**Opened 2026-09-07.** Written as the work happens, not at the end; three agents this week lost their
account to a dropped process.

## THE STATE THIS BATCH STARTED FROM

Read off `engine/status.js` and `data/game-differential.json` before anything was touched:

| clause | value |
|---|---|
| whole-game **BOARD-MATERIAL** | **13 of 961** (`state.games` 961 less `state.games_board_never_diverged` 948) |
| whole-game PROTOCOL | 83 |
| whole-game NARRATION | 70 net (71 raw less 1 declared) |
| `state.board_parted_before_the_protocol_did` | **0** |
| census | 830 / 830 / 0 missing, `run_ok` true, digest `da714ebda9a7` |
| release | `791c9fd873f3`, cap 20, `middle`, `empirical-click/v1` |
| pool | `0d103fb9fa87` pinned to `data/team-pool-frozen` |

Sample line the bar above was measured on:

```
node engine/game_differential.js --steering empirical --release 791c9fd873f3 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

`--games 1200` (961 played) is part of the SAMPLE DEFINITION and not a budget.

---

## FINDING 1 — THE TYPE-RESIST BERRY IS SPENT AGAINST THE MOVE'S *STATIC* TYPE

**The pool row it closes:** `omit-weather ...bo3-2659988022 vs ...bo3-2660048519`, turn 7,
`p1.party.grimmsnarl.item` reading `roseliberry` here against `''` there — a Mega Gardevoir's
Pixilate Hyper Voice into a Grimmsnarl holding Roseli. The HP AGREED to the point; only the item
parted, which is the signature of the defect below.

### Two implementations of one fact

| reader | what it asks | verdict |
|---|---|---|
| the HALVE, `dmgRangeOneHit` (`engine/medicham2-browser.js:13126`) | `_rb.onType === mvT`, where `mvT` is the type AFTER the forme table, `setsOwnTypeAlways`, `convertsMoveTypeTo` and `weatherScaled` | correct |
| the CONSUMPTION, the battle loop (`:34432`) | `_rbC.onType === mv.t` — the engine-data row's STATIC type | **wrong** |

So a converted move was halved and the berry was never spent. The berry then goes on halving the
next super-effective hit, forever, and the item leaf parts on the turn boundary.

The authority has one reader and no second copy: `data/items.ts`'s handler is
`onSourceModifyDamage(damage, source, target, move) { if (move.type === 'Fairy' && ...typeMod > 0) { ... target.eatItem() ... } }`,
and `move.type` there is the ACTIVE move's type — `runEvent('ModifyType')` has already rewritten it,
and `ModifyDamage` runs long afterwards.

### The probe, RED on published bytes

`tests/probe_resist_berry_resolved_type.js`, knob `MEDI_RESIST_BERRY_BASE_TYPE=1`.

Nothing in it is typed: the 18 berries come from `data/tags.json`'s `resistBerry` rows with their own
`onType`; the converters from the `convertsMoveType` rows; the second family from `weatherball`'s own
`weatherScaled.byWeather` table paired with a legal `weatherSetter` ally. Defenders are chosen so the
RESOLVED type is super-effective and the BASE type is not — a cell where both are super-effective
cannot tell the two readings apart and is refused and printed.

**Published bytes, before any engine edit:**

```
CLAUSE A — the AUTHORITY spent the berry on 7 of 7 scored cell(s).
CLAUSE B — 0 of 7 scored cell(s) agree on the item leaf.        <-- RED
CLAUSE C — 7 no-conversion control cell(s).   neither engine spends
CLAUSE D — 3 base-type control cell(s).       both engines spend
CLAUSE E — across 17 cell(s) the authority spent on 10 and kept on 7.
```

Both families are red, across five berries and four skies:

```
ability       passhoberry  ->Bastiodon   showdown ate=YES  medicham ate=no
ability       roseliberry  ->Umbreon     showdown ate=YES  medicham ate=no
ability       yacheberry   ->Goodra      showdown ate=YES  medicham ate=no
weather:rain  passhoberry  ->Bastiodon   showdown ate=YES  medicham ate=no
weather:sand  chartiberry  ->Avalugg     showdown ate=YES  medicham ate=no
weather:snow  yacheberry   ->Goodra      showdown ate=YES  medicham ate=no
weather:sun   occaberry    ->Aegislash   showdown ate=YES  medicham ate=no
```

### THE PROBE WAS WRONG TWICE BEFORE THE ENGINE WAS

1. It picked the attacker's move by base power, which chose **Last Resort** for Sylveon and **Dive**
   for the Primarina control — one fails on turn one, the other is a two-turn move. Both cells read
   "never connected" and one of them looked like a green control. Fixed with a DERIVED predicate
   (`LANDS`) off the move row: no `flags.charge`, no `flags.recharge`, no `onTry*`.
2. It picked **Abomasnow** — Snow Warning — to click Weather Ball under a Drought ally. The two entry
   abilities RACED, the `sun` cell resolved to Ice, and the authority ate nothing. That surfaced as
   CLAUSE A failing rather than as a staging error, which is the only reason it was caught. The ally
   is now the only sky-setter on the board, and the pad refuses any species with a `weatherSetter`
   ability.

### The fix

`engine/medicham2-browser.js`. `dmgRangeOneHit` now returns `type` — the `mvT` it actually priced —
on **every** one of its eight returns, `dmgRange` propagates it through both the flat and the
per-hit paths, and the consumption site reads `d.type`. `d` is `_price(false)`, i.e. this very
click's price, so the halve and the spend can no longer disagree.

The fallback is LOUD, not silent: if a `dmgRange` return is ever added without a `type`,
`MEDFAILS.resistBerryTypeUnresolved` counts it and `resistBerryTypeUnresolvedFirst` names the move,
before it drops back to the static type. `MEDI_RESIST_BERRY_BASE_TYPE=1` restores the old read and
stamps `MEDFAILS.resistBerryBaseTypeRestored=1` at module load.

### The measurement — FIX A ALONE

Release **`7aecab883009`** (26 files frozen). Sample line, in full:

```
tools\lownode.cmd engine\game_differential.js --steering empirical --release 7aecab883009 \
  --arm middle --end-state --state --census data\verification\census-pin-9446a684709d.json \
  --games 1200 --turns 20 --team-store data\team-pool-frozen --write
```

961 games played, cap 20, `middle`, `empirical-click/v1`, pool `0d103fb9fa87` pinned to
`data/team-pool-frozen`, census pin `9446a684709d`, driver code `228006b5faca` over 11 files
unchanged across the run, 128.1 s.

| clause | before `791c9fd873f3` | after `7aecab883009` |
|---|---|---|
| whole-game **BOARD-MATERIAL** | **13 of 961** | **12 of 961** |
| whole-game PROTOCOL | 83 | **82** |
| whole-game NARRATION | 70 net (71 raw less 1 declared) | **70** (68 causes, 70 games) |
| board parted with NO protocol divergence | 0 | **0** |
| census | 830 / 830 / 0 | **830 / 830 / 0**, `run_ok` true, 0 threw, 0 hollow |
| roster items / abilities / moves | 140 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE | **identical on all three** |
| damage differential | 0 of 6000 | **0 of 6000**, re-run on `7aecab883009` |

### Predictions — SEVEN WRITTEN, SEVEN HIT

`data/verification/_prediction-2026-09-07-resist-berry-resolved-type.json`, written before the run.

| id | claim | outcome |
|---|---|---|
| P1 | board-material 13 -> 12 | **HIT** |
| P2 | protocol 83 -> 82 | **HIT** |
| P3 | narration stays 70 | **HIT** |
| P4 | census stays 830/830/0 | **HIT** |
| P5 | roster stays clean on all three stages | **HIT** — 140/129/475, 0/0 |
| P6 | damage differential stays 0 of 6000 | **HIT** |
| P7 | no game ENTERS the board-material set | **HIT** — the twelve are twelve of the original thirteen, none new |

No transfers. `omit-weather ...bo3-2659988022` left the set and did not re-enter on another cause.

---

## FINDING 2 — THE THAW IS PAID ABOVE THE DAMAGE, SO A FROZEN BODY TAKES THE MOVE'S OWN BURN

**The pool row it targets:** `pair-redirect-priority ...bo3-2635897393 vs ...bo3-2635852385`, turn 4,
`p2.party.gengar.status` reading `brn` here against `''` there and the HP `54` against `62` — a
Sinistcha's Matcha Gotcha into a Gengar that switched in FROZEN. The missing 8 is the burn's own
residual chip. The protocol row is `|-damage|p2b:gengar|62/135frz` against
`|-curestatus|p2b:gengar|frz|[msg]`.

### One rule, in the wrong place

Both thaw routes are handlers on the `frz` CONDITION, and Champions overrides only `onStart` and
`onBeforeMove` (`data/mods/champions/conditions.ts:31-56`, `inherit: true`), so these two are
mainline's (`data/conditions.ts:112-125`):

```
onAfterMoveSecondary(target, source, move) { if (move.thawsTarget) target.cureStatus(); }
onDamagingHit(damage, target, source, move) {
  if (move.type === 'Fire' && move.category !== 'Status' && move.id !== 'polarflare') target.cureStatus();
}
```

`spreadMoveHit` runs `secondaries` at `sim/battle-actions.ts:1099`, `runEvent('DamagingHit')` at
`:1121`, and `afterMoveSecondaryEvent` from `:1005` — **all three below the secondary**. So the
target is still frozen when the move's own status secondary is tried, `Pokemon#trySetStatus` refuses
a body that already carries a status, and the authority's own `-damage` line prints the suffix:
`|-damage|p2a: Milotic|127/170 frz`, and only then `|-curestatus|`.

This engine cleared `frz` inside `_stepApply`, **above the damage**, and the comment at the site said
so — *"Cleared BEFORE the damage lands"*. Two consequences: the burn landed (board), and the
`-curestatus` was emitted above the `-damage` (narration).

`polarflare` is the Fire handler's one exception and is `isNonstandard: 'CAP'` in this regulation, so
it is unreachable here. The probe asserts that off the format and refuses to run if it changes.

### The probe, RED on published bytes

`tests/probe_thaw_after_secondary.js`, knob `MEDI_THAW_BEFORE_SECONDARY=1`.

**The freeze has to be HUNTED.** The highest `frz` chance in this regulation is 10% — derived and
printed — so the probe plays a 21-turn phase-1 battle in which a low-offence carrier (Azumarill,
Blizzard/Ice Beam/Ice Punch) clicks a freezing move at a self-healing defender (Milotic, Recover)
until BOTH engines report `-status ... frz` on the same turn, then replays the identical script up
to that turn and clicks the thawing move on the next one from a partner FASTER than the defender.
A hunt that finds nothing is a COULD-NOT-STAGE about the fixture, and says so.

Cells are scored only where the **AUTHORITY'S OWN** `-damage` line carries the `frz` suffix — the only
available proof that the target was frozen when the move landed.

**Published bytes:**

```
CLAUSE B — 7 of 8 scored cell(s) agree on what the frozen defender gained.   <-- RED
  FAIL — inferno sd=[] me=["brn"] {"path":"p2.party.milotic.status","medicham":"brn","showdown":""}
CLAUSE F — 0 of 8 cell(s) emit `-curestatus frz` BELOW the `-damage`.        <-- RED
CLAUSE C — 9 unfrozen controls, agree, authority applied a status on 6
CLAUSE D — 1 non-thawing control (Nuzzle), defender stays frozen in both
```

Inferno is the deterministic cell — a 100% burn secondary — so its board leaf parts every time. The
other seven scored moves carry a 10-30% burn and their board leaf only parts when the shared `sec`
die fires, which is why clause F exists: the line ORDER is wrong on all eight regardless.

### THE PROBE WAS WRONG ONCE BEFORE THE ENGINE WAS

Its first unfrozen control staged Inferno on a single fixed turn — and Inferno is 50% accurate, so on
that turn it MISSED. Clause C read *"the authority applied NO status on any unfrozen control"*, which
is indistinguishable from a dead secondary wire. The control's turn is now swept until the authority
both connects and applies.

### The fix

The cure is deferred out of `_stepApply` into two new steps, because the two routes are two different
events and the line order is the observable half:

- `_stepThawDamagingHit` — the Fire route, beside `_stepDamagingHit`. It takes no address:
  `cureStatus` throws no die.
- `_stepThawAfterSecondary` — the `thawsTarget` route, at the foot of the step list beside
  `_stepHpThresholdBoost`, which is already the `AfterMoveSecondary` slot.

The closure re-reads the status when it fires, so a body that fainted to the hit carries `fnt` and is
left alone — which is what `Pokemon#cureStatus` does in the authority too. A row the Substitute
absorbed returns above the site and arms neither slot, matching `spreadMoveHit` nulling the target
before `DamagingHit`.

Counters: `MEDSEEN.thawBelowSecondary` for every deferred cure that fired, and
`MEDSEEN.thawAboveDamageRestored` + `MEDFAILS.thawBeforeSecondaryRestored` under the knob, so a
restore arm and a broken engine cannot read as the same run.
