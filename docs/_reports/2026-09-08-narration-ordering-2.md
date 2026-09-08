# NARRATION BATCH P — THE ORDERING CLASS, SECOND PASS

2026-09-08. ENGINE. Sole engine agent. Tree clean at `1463de1c` at the start. The brief said a
MEASURE agent was live, benchmarking throughput on a frozen release and *"read-only on code"* — **it
was not**, and the section "the instrument moved under this batch" below records what that cost and
what it did not.

## BASELINE, RE-DERIVED RATHER THAN QUOTED

`data/engine-release.json` -> `current: fb0058fb5702` (read from the pointer file, never from
`engine_release.js list`).

Off `end_state[0].summary.by_cause` — the **uncapped** 57 rows, never `first_divergences`, which is
`.slice(0, 60)` and is keyed on the first PROTOCOL divergence while the board bar reads the first
BOARD one:

| class (the COMPARATOR's label) | games | narration | board |
|---|---|---|---|
| event missing from medicham2 | 19 | 18 | 1 |
| **ordering** | **16** | **16** | **0** |
| extra event emitted by medicham2 | 10 | 9 | 1 |
| unrelated event mismatch | 9 | 8 | 1 |
| -fail field 3 | 4 | 4 | 0 |
| showdown stopped emitting while medicham2 continued | 1 | 1 | 0 |
| **total** | **59** | **56** | **3** |

The brief's 16 is confirmed exactly, and **every one of the 16 is NARRATION-ONLY** — zero part a
board. `by_cause_totals.BOARD_MATERIAL: 3` is the BY-CAUSE ATTRIBUTION over 961 games and is a
different number from the board-material CLAUSE (`state.games 958 - state.games_board_never_diverged
958` = **0 of 958**). Both are written here so neither can be quoted as the other. The three are the
declared VOID games, where the two dice streams are not shared.

A byte copy of the baseline artifact and its dump were taken before anything ran, because another
agent was live and `data/game-differential.json` is rewritten by any run:
`data/verification/batchP/gd-baseline-published.json`, `data/verification/batchP/dump-baseline.json`.

## THE 16, GROUPED BY MECHANISM — THE CLASS NAME IS THE COMPARATOR, NOT THE DEFECT

Regrouped off the 16 rendered cards in the baseline dump. Six mechanisms, not sixteen:

| mechanism | games | what the authority does |
|---|---|---|
| **a `\|faint\|` owed by a residual EXPIRY, paid at the wrong point** | **3** | `fieldEvent`'s `faintMessages()` after every handler; the expiry branch `continue`s past it |
| the residual walk's ORDER between two bodies at the same `onResidualOrder` | 3 | one flat handler list, selection-sorted once |
| a Substitute intercepted at step 0 of `spreadMoveHit`, not at the damage step | 3 | `tryPrimaryHitEvent` over ALL targets before `getSpreadDamage` |
| `onDamagingHit` / `onSourceDamagingHit` as ONE speed-sorted event | 3 | `runEvent('DamagingHit', damagedTargets, ...)` |
| target selection announced above the move's own `TryMove` | 1 | `RedirectTarget` inside `getMoveTargets`, above `singleEvent('TryMove')` |
| turn order / replacement order between two bodies | 2 | one speed sort |
| a `smartTarget` volley into a shielded body announcing nothing | 1 | `-activate move: Protect` on the first dart |

Only the first was taken this batch. The other five are diagnosed at the bottom of this report with
the reason each was left, so the next batch is aimed rather than re-derived.

## THE FIX — `fieldEvent('Residual')` PAYS THE FAINT QUEUE AFTER A *SURVIVING* HANDLER

### THE AUTHORITY, READ AND CITED

`Battle#fieldEvent`, sim/battle.ts:484-568:

```js
if (eventid === 'Residual' && handler.end && handler.state?.duration) {
  handler.state.duration--;
  if (!handler.state.duration) {
    handler.end.call(...endCallArgs);   // perishsong.condition.onEnd -> `-start perish0` + faint()
    if (this.ended) return;
    continue;                          // <-- SKIPS the faintMessages() below
  }
}
...
if (handler.callback) this.singleEvent(handlerEventid, ...);   // the `perish3/2/1` line
this.faintMessages();                                          // :565
if (this.ended) return;                                        // :566
```

`Pokemon#faint()` writes no line — it queues. So a counter that reaches ZERO announces `perish0`,
queues a `|faint|` and announces nothing; the **next handler to reach :565** pays it, and that
handler may be a body whose own counter SURVIVED, inside the same order-24 group.

### WHAT THIS ENGINE ALREADY HAD, AND THE ONE HANDLER IT COULD NOT SEE

`RESIDUAL_AFTER_PERISH` derives every handler that sorts BELOW `perishsong@24.2` and drains above
`|upkeep|` when one of them will run. Its own header records the authority measurement it was built
from: *"bare reads `perish0 x4 | upkeep | faint x4`; the same board with a Protect, with a Tailwind,
or with a Pickup body on it reads `perish0 x4 | faint x4 | upkeep`."* That is right and is untouched.

It excludes `r === perish` — correctly, because it is a derivation about handlers BELOW perish. So the
one handler at the SAME order as the expiry, a perish counter that did not reach zero, paid nothing.
And the drain it does run is at the FOOT of the walk, which cannot put a `|faint|` BETWEEN two
`perishN` lines.

Both shapes were in the pinned pool, both `ordering`, both narration-only:

```
...bo3-2661861148 t4   |faint|p1a <> |upkeep
   SD  perish0 Politoed, perish0 Mawile, perish2 Incineroar, faint, faint, upkeep
   US  perish0, perish0, perish2, upkeep, faint, faint

...bo3-2658309440 t10  |faint|p2b <> |-start|p1b|perish0
   SD  perish0 Gengar, perish1 Excadrill, FAINT Gengar, perish0 Tyranitar, perish0 Politoed, faint, faint, upkeep
   US  perish0, perish1, perish0, perish0, faint, faint, faint, upkeep
```

The second is the one a foot-of-walk drain cannot produce: Gengar's `|faint|` is INTERLEAVED with the
`perishN` lines. Its own trailing two faints were already right, because three bodies had Protected
that turn and `stall` is a `RESIDUAL_AFTER_PERISH` clock.

### RED FIRST — `tests/probe_residual_faint_flush.js`, before any engine byte moved

A Perish Song hits every active body at once, so one cast expires all four together and there is no
surviving handler to pay anything. The counters are DESYNCHRONISED instead: the p2b body leaves on
turn 2 (which clears its volatile), a replacement walks in with none, and the same Politoed casts
again on turn 3 — `onHitField` skips a body that already carries the volatile (data/moves.ts:13254),
so only the replacement is given a fresh counter. Turn 4 therefore holds three expiring counters and
one surviving one, and the arm is WHERE the survivor sits in the speed order.

```
CLEAN, before the fix
  RED-LAST   survivor SLOWEST
      showdown  perish0 p2a, perish0 p1a, perish0 p1b, perish2 p2b, faint x3, upkeep
      medicham  perish0 p2a, perish0 p1a, perish0 p1b, perish2 p2b, upkeep, faint x3
    FAIL  this engine writes the authority's sequence line for line
    FAIL  the in-group drain FIRED            faintDrainResidualBodyStep +0
  RED-MID    survivor at index 1
      showdown  perish0 p2a, perish2 p2b, FAINT p2a, perish0 p1a, perish0 p1b, upkeep, faint, faint
      medicham  perish0 p2a, perish2 p2b, perish0 p1a, perish0 p1b, upkeep, faint x3
    FAIL  this engine writes the authority's sequence line for line
    FAIL  the in-group drain FIRED            faintDrainResidualBodyStep +0
  CTRL-NONE  nothing survives
      showdown  perish0 x4, upkeep, faint x4
      medicham  perish0 x4, upkeep, faint x4        <- already agreed, both arms, before and after
```

**RED-MID is the arm that refuses the lazy fix.** One faint is above `|upkeep|` and two are below it
in the SAME turn, so an engine that simply moved the whole drain above the upkeep line passes
RED-LAST and fails here. **CTRL-NONE is the over-fire control** and is the authority baseline
`RESIDUAL_AFTER_PERISH` was itself built on: nothing survives, nothing pays, all four faints land
below `|upkeep|` on both engines — before the fix and after it, and unmoved by the knob.

**A PROBE FAULT CAUGHT BY ITS OWN STAGING CLAIM.** The first cut picked its three replacements off
BASE Speed and got two of them wrong: `buildMon`'s spread is not neutral, so a base-120 Alakazam
sorts BELOW a base-110 Gengar and a base-65 Umbreon below a base-60 Primarina. The intended
"survivor first" arm was actually a survivor at index 1, and the intended "middle" arm was a
duplicate of "last". The staging claim reads the survivor's position off the AUTHORITY's own log and
failed on both, which is why it was a probe fault and not a finding.

### THE CHANGE

`engine/medicham2-browser.js`, at the close of the residual body loop, directly BELOW the existing
side-wiped stop:

```js
if(_ranExpiryHandler&&!_expiryQueuedFaint&&faintQueueOwed()){
  if(RESIDUAL_FAINT_AT_GROUP_END)MEDFAILS.residualFaintAtGroupEndRestored=1;
  else drainFaints('residualBodyStep');
}
```

Three things this deliberately does not do, each stated at the site:

- **It moves no state.** `queueFaint` has already written `curHP`, `fainted` and the faint sequence
  at the transition; `drainFaints` emits lines and nothing else. A board cannot move by construction,
  and the run confirms it did not.
- **It is placed BELOW the wipe block**, which has already broken out of the turn on the one path
  where the two interact — the only thing the drain moves is `faintQueueOwed()`, which the
  group-top stop reads.
- **It is narrower than the authority, said plainly.** `_ranExpiryHandler` is set by the perish step
  alone, so this reproduces `faintMessages()` for the order-24 group and not for an ordinary chip
  that kills at order 9, which this engine still announces at the foot of the walk. That is a second
  gap with a second fixture; folding it in would have destroyed this one's attribution.

Knob `MEDI_RESIDUAL_FAINT_AT_GROUP_END=1`, stamping `MEDFAILS.residualFaintAtGroupEndRestored`, and
set only where the restored engine actually held a line back.

## MEASURED — RELEASE `cf8567c4db78`, RE-CUT AND RE-MEASURED AS `f0f10cd06861`

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
node engine/game_differential.js --steering empirical --release cf8567c4db78 --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 50 --team-store data/team-pool-frozen \
  --dump-games 200 --dump-out data/verification/batchP/dump-published.json --write
```

`--games 1200` and `--turns 50` are part of the SAMPLE, not a budget. Arm `middle`,
`empirical-click/v1`, census pin `9446a684709d`, team store `data/team-pool-frozen`,
driver code `4dd225b7e8c9` over 11 files, unchanged across the whole run. **961 played, 958 readable,
3 void**, zero games cut off by the turn cap.

| | release | driver code | narration raw | protocol | by_cause rows | ordering | board-material |
|---|---|---|---|---|---|---|---|
| baseline | `fb0058fb5702` | `4dd225b7e8c9` | 56 | 59 | 57 | 16 | **0 of 958** |
| batch P | `cf8567c4db78` | `4dd225b7e8c9` | **54** | **57** | **55** | **14** | **0 of 958** |
| batch P, re-published | `f0f10cd06861` | `81b6bca47dab` | 54 | 57 | 55 | 14 | 0 of 958 |

**THE CONTROLLED COMPARISON IS THE FIRST TWO ROWS, AND THE DRIVER COLUMN IS WHY.** See "the
instrument moved under this batch" below. The third row is the artifact now on disk; it agrees on
every figure, which is corroboration and not the measurement.

Verdict block identical to the baseline's: SAME-END-STATE 958, DIFFERENT-END-STATE 2, ENDED-APART 0,
NO-COMPARABLE-BOARD 0, THREW 1. Every other class is unmoved to the game: missing 19, extra 10,
unrelated 9, `-fail field 3` 4, stopped 1.

The run was done TWICE on `cf8567c4db78` — once to `--out data/verification/batchP/gd-fix1.json` and
once without `--out` so it publishes to `data/game-differential.json` — and the two agree on every
figure above. `--out` and `--dump-out` write ALONGSIDE `--write`, and `--out` REDIRECTS the canonical
artifact, so the first run left the gate reading the stale one.

**AND THEN A THIRD TIME, BECAUSE A COMMENT MOVED THE DIGEST.** Correcting `_stepBuffOnHit`'s
"unobservable" derivation (section C below) edited `engine/medicham2-browser.js` AFTER the
measurement, and `engine_release.js drift('cf8567c4db78')` then read
`["engine/medicham2-browser.js"]` — the tree no longer contained the bytes every artifact was
stamped against. `status.js` did NOT catch it, because it compares an artifact's stamped release
against the POINTER in `data/engine-release.json`, which still said `cf8567c4db78`; the gate read 8
of 9 PASS on bytes that had stopped existing. Rather than leave that standing, or drop a correction
of a false claim, the tree was re-cut as `f0f10cd06861` and **all six artifacts were re-run on it**.
A comment-only change must reproduce every figure exactly, and it did — which is the check that the
change really was comment-only. `drift('f0f10cd06861')` is `[]`.

`node engine/status.js` clause: **NARRATION-ONLY 53 of 961 = 5.5%, across 52 cause(s)** (the clause
subtracts the declared row from the raw 54; batch O's same clause read 55).

**PREDICTION HIT AT THE POINT ESTIMATE ON EVERY CLAUSE.**
`data/verification/_prediction-2026-09-08-batchP-residual-faint-flush.json`, written BEFORE the run,
predicted ordering 14, narration raw 54, protocol 57, by_cause rows 55, board-material 0 of 958, the
two causes closed by name, and zero new causes. All seven held. **Zero transfers** — both named
games left the count and neither re-entered on another cause, which was named as risk 1 and did not
fire.

## THE GATE, AND THE FIVE ARTIFACTS THE ENGINE CHANGE INVALIDATED

Cutting a release restamps every artifact measured on the old bytes as `MEASURED AGAINST A DIFFERENT
ENGINE`. All five were re-run on `cf8567c4db78`:

| artifact | re-run | result |
|---|---|---|
| `data/engine-diff.json` | `tests/test-engine-diff.js --n 6000 --seed 20260804` | 0 of 6000, midpoint and all 14 interior indices |
| `data/roster.items.json` | `tests/roster.js --stage items --reds --write` | 140 of 148, 0 DIFFER, 0 DID-NOT-FIRE |
| `data/roster.abilities.json` | `--stage abilities --reds --write` | 146 of 202, 0 DIFFER, 0 DID-NOT-FIRE |
| `data/roster.moves.json` | `--stage moves --reds --write` | 487 of 500, 0 DIFFER, 0 DID-NOT-FIRE |
| `data/all-mechanics-fire.json` | `engine/all_mechanics_fire.js --kind all --write` | 1313 games, 0 threw, every mechanic anybody plays agrees |

**Zero `NOT CAUGHT` across all three roster stages** (grepped, count 0 in each log). Census
regenerated: **830 live / 830 probed / 0 missing**, unmoved. `node engine/status.js` reads **8 of 9
clauses PASS** and the one failure is this batch's own NARRATION clause — the same shape it had at
the start of the session, with a smaller number in it.

`tests/probe_red_demo.js`: **the count is WITHHELD and the reason is not this engine.** Four reads
during this batch gave **15, 10, 9 and 8 COULD NOT BE APPLIED**, on an engine tree that did not move
between the last three (`engine_release.js drift('f0f10cd06861')` is `[]` before and after all of
them). The file was being re-aimed by another agent while I read it — the diff carries its own
`RE-AIMED 2026-09-08, MEASURE` headers on WIRE 117, WIRE 121 and WIRE 129, which are three of the
five that stopped reading COULD-NOT-APPLY. **Every one of those four reads is a torn read of somebody
else's work in progress**, so none of them is quotable, including the first one that happened to
match batch O.

What IS attributable: this batch invalidated no certificate. The one hard failure —
`WIRE 120 Parting Shot does not jump the queue … reverted-arm=true (must be false)` — is present in
batch O's two logs, in this batch's first read and in its last, unchanged, and is inherited.

2 HOLLOW is stable across all four reads.

`node engine/status.js --write` was NOT run (a MEASURE agent was live), so the `<!-- GENERATED -->`
block in `docs/ENGINE.md` is stamped to an earlier pass. Nothing inside it was hand-edited.

## THE INSTRUMENT MOVED UNDER THIS BATCH, AND IT IS RECORDED RATHER THAN ABSORBED

The brief said a MEASURE agent was live and *"read-only on code"*. It is not read-only on the
comparison driver. Measured, not inferred — `git status` at the end of this batch, against a tree
that held only `engine/medicham2-browser.js` at the start:

```
 M engine/arms_comparable.js        (+11 lines)
 M engine/game_differential.js      (+79)
 M engine/steering.js               (+45)
 M tests/probe_red_demo.js          (+112, headers reading "RE-AIMED 2026-09-08, MEASURE")
 M tests/test-empirical-driver.js   (+34)
```

Two consequences, both handled rather than merely noted:

- **`steering.driver_code` moved from `4dd225b7e8c9` to `81b6bca47dab` between my second run and my
  third**, on `engine/game_differential.js` (`9c61584c1e4a -> e5e7246179d2`) and `engine/steering.js`
  (`ec92aa5b2c92 -> 5a4fe4e4421d`). The driver digest is stamped inside every artifact and it is
  reported `unchanged across the whole run` for each run individually, so no single run is torn. But
  a BEFORE and an AFTER taken under two drivers are two questions, and the fix's claim rests on the
  pair that shares `4dd225b7e8c9` — the batch-O baseline and my `cf8567c4db78` run. The third run
  agrees with the second on all five figures, which says the driver change moved none of them here;
  it does not make the third run the measurement.
- **`tests/probe_red_demo.js` cannot be read at all while it is being edited**, which is the
  paragraph above. The count it produced fell on three successive reads of an unchanged engine.

This is the *"a measuring agent may not run beside a writing agent"* rule arriving from the other
side: I was the one READING an artifact somebody else was writing, which CLAUDE.md already says is
enough to be wrong. Nothing here was reported as a finding before it was checked, and the check was
one `git status` and one digest comparison.

## THE 14 THAT REMAIN, DIAGNOSED AND NOT FIXED — THIS IS THE AIM FOR THE NEXT BATCH

Re-derived off `by_cause` on `cf8567c4db78`. Every one is NARRATION-ONLY.

### A. THE SUBSTITUTE IS INTERCEPTED AT THE WRONG STEP — 3 games

```
|-end|p1b|substitute       <> |-damage|p1a|0fnt
|-activate|p2b|substitute|[damage] <> |-damage|p2a|H/H
|-end|p1b|substitute       <> |-resisted|p1a|1
```

`spreadMoveHit` is STEP-MAJOR and the doll is step **0** — `tryPrimaryHitEvent` over ALL targets,
above `getSpreadDamage` (data/mods/champions/scripts.ts:341-360). Substitute's `onTryPrimaryHit`
calls `getDamage` itself, so the doll's OWN effectiveness line is written there too; every live
target's effectiveness and `-damage` lines come afterwards. This engine emits the doll's
`-end` / `-activate ... [damage]` from `_stepApply` (the damage step) and its effectiveness line
from `_stepDamage`, in target order, so a doll standing in a later slot speaks after an earlier live
body.

**LEFT DELIBERATELY, AND THE REASON IS THE DICE.** The clean fix is a doll-first row order for
`_stepDamage`, and `_stepDamage` is where the damage and crit dice are drawn. `_reactAddr`/`_subAddr`
count `nth` per address STRING and the doll's address is the lingering ACCURACY target, which can
collide with a live row's own slot — so reordering the rows reorders draws at a shared address. That
is exactly the shape that took board-material 0 -> 2 on the Parental Bond ordering fix earlier in the
day. It needs its own batch with a bisect budget, and the emission-only variant (move the doll LINE
without moving the dice) closes 2 of the 3 and TRANSFERS the third.

### B. THE RESIDUAL WALK'S ORDER BETWEEN TWO BODIES AT THE SAME `onResidualOrder` — 3 games

```
|-damage|p2b|H/Hbrn|[from]brn  <> |-damage|p1b|H/Hbrn|[from]brn
|-damage|p1a|H/Hpsn|[from]psn  <> |-damage|p1b|H/Hpsn|[from]psn
|-heal|p1b|H/H|[from]leftovers <> |-heal|p2a|H/H|[from]leftovers
```

**These are NOT an unresolved tie coin, and that was checked rather than assumed.**
`game_differential.js` sets `o.tie = () => 0` for the middle arm precisely because `pinShuffle` is a
no-op on the authority side, so a tied group is resolved by the selection sort alone on BOTH sides.

They are the limitation `residualOrder`'s own header already declares: *"the authority's list at (1)
holds every handler, not every body, and a tied pair's final order depends on the swaps made while
the OTHER handlers were placed. This engine's walk is group-major over BODIES and does not know which
handlers a body actually has."* The brn card is the proof — the same two Sinistcha come out `p1b,p2b`
at the order-5 Leftovers group and `p2b,p1b` at the order-9/10 chip group **in the authority**, which
no per-group body sort can produce. Closing it means building the flat handler list and running the
authority's selection sort over it, which is an architectural change to the residual, not a patch.

### C. `onDamagingHit` AND `onSourceDamagingHit` ARE ONE SPEED-SORTED EVENT — 3 games

```
|-boost|p1a|def|1                      <> |-status|p2b|brn|[from]spicyspray
|-damage|p1a|H/H|[from]roughskin        <> |-status|p2a|psn|[from]poisontouch
|-status|p1b|brn                        <> |-start|p2b|disable|matchagotcha|[from]cursedbody
```

`runEvent('DamagingHit', damagedTargets, pokemon, move, damagedDamage)` (champions scripts.ts:410)
collects the TARGETS' `onDamagingHit` handlers AND the SOURCE's `onSourceDamagingHit` handlers into
one list and `speedSort`s it — Poison Touch is `onSourceDamagingHit` (data/abilities.ts:3360), not a
secondary. This engine splits that one event into two adjacent steps, `_stepDamagingHit` then
`_stepBuffOnHit`, each walked over every row.

**`_stepDamagingHit`'s own header says the split is unobservable and the pool refutes it.** The
derivation there is *"both read the TARGET's ability, a body holds one ability, and no entity in
data/tags.json carries both `buffsHolderOnHit` and `punishesAttacker`"* — true for ONE body, and the
Spicy Spray card is a spread hit where an Archaludon's Stamina and a Scovillain's Spicy Spray are on
TWO bodies. That sentence should be corrected when the fix lands.

**LEFT DELIBERATELY, AND THE REASON IS THE DICE AGAIN.** Every member of the event is chance-gated —
Cursed Body's `randomChance(3,10)`, Poison Touch's, Static's, Flame Body's, Effect Spore's — and
`_reactAddr` spends them at an `nth`-counted address. Reordering the handlers reorders the draws and
moves boards.

### D. FIVE SINGLE-CARD MECHANISMS

- **`|-activate|p1a|lightningrod <> |-prepare|p1b|electroshot`.** `RedirectTarget` is raised inside
  `getMoveTargets` (sim/pokemon.ts:829, from battle-actions.ts:466) and the charge move's `-prepare`
  comes from `singleEvent('TryMove')` at :590 — so the redirect announcement is ABOVE the wind-up.
  This engine runs the charge block ~430 lines above the redirect block. Hoisting only the
  ANNOUNCEMENT would put the redirect decision in two places, which is the facts-are-global breach;
  hoisting the whole draw is a real restructure of the action head.
- **`|-activate|p1a|protect <> |move|p2a|flareblitz`.** A Dragon Darts into a field where p1b is an
  EMPTY slot and p1a has Protected: the authority writes `-activate move: Protect` for the dart and
  this engine writes nothing at all. It is a MISSING EVENT wearing an `ordering` label — the
  comparator matched our single later `-activate` (from the Flare Blitz) against the authority's
  first one.
- **`|faint|p2b <> |-end|p1a|syrupbomb`.** The same game whose BOARD half `sourceOffField` closed
  earlier today, so this is the narration residue of that fix. `syrupbomb.condition.onUpdate` fires
  on `!source.isActive`, and `isActive` is cleared INSIDE `faintMessages` (sim/battle.ts:2563) — so
  the authority prints `|faint|` first and removes the volatile at the NEXT Update. This engine's
  `sourceOffField` reads `fainted`, which `queueFaint` sets at the state transition, so the `-end`
  is written before the faint line is drained. **Not taken because the obvious repair moves STATE:**
  making `sourceOffField` wait for the drain would let the volatile survive into the residual, which
  is precisely the board defect that fix closed.
- **`|move|p2a|closecombat <> |move|p2b|tailwind`** and
  **`|switch|p2a|archaludon,l50 <> |switch|p1a|gholdengo,l50`.** Two ORDER-OF-ACTION disagreements,
  one in the turn queue and one in the post-KO replacement pass. Both are a single adjacent PAIR on
  the same side, and in the switch card the two engines AGREE on the third body (a Pelipper placed
  first, ahead of two higher-base-Speed bodies), so the sort mechanism is not simply absent. These
  are the two rows worth the most beyond narration — a turn-order rule reaches boards everywhere —
  and neither can be diagnosed without the two teams' actual spreads out of the frozen pool. **Named
  as the next batch's first job, deliberately not guessed at here.**

### CARRIED FROM THIS BATCH SPECIFICALLY

- **An ordinary chip that kills at residual order 9/10 is still announced at the foot of the walk.**
  The authority pays it under the chip's own `-damage` line. `_ranExpiryHandler` is set by the perish
  step alone, so the fix landed here does not reach it. **No pool witness exists** — none of the 59
  baseline divergences is that shape — so a probe would have to construct the fixture.
- **The residual-order limitation (B above) bounds what a per-body flush can ever be.** The drain
  added here fires at a BODY boundary; the authority's fires at a HANDLER boundary. The two coincide
  for the perish group because perish is the only handler in it.

## FILES

- `engine/medicham2-browser.js` — the knob, the counter, the drain.
- `tests/probe_residual_faint_flush.js` — new.
- `data/verification/_prediction-2026-09-08-batchP-residual-faint-flush.json` — written before the run.
- `data/verification/batchP/` — both differential runs, both dumps, the five artifact re-run logs, the
  red-demo log, the census log, and the two `.cmd` wrappers the runs were invoked through.
