# Fairy Aura (#542 a) and Beat Up ally order (#544) — both instruments built, both red, both fixes derived and verified without touching the engine

ENGINE, 2026-09-05/06. Release under test `63cbcc2ef605` (unchanged tree; the two probes' `cut()` calls
appended cut events 18 and 19 to that same id — no new release directory, pointer unmoved).

**Census: 829 live / 829 probed / 0 missing, generated 2026-09-06T01:15:13.054Z — UNCHANGED and not
regenerated.** No engine byte moved in this pass. Both fixes were verified against a PATCHED SNAPSHOT
in a throwaway release store under `%TEMP%`, never against the working tree.

---

## What was asked, and what was found

| | verdict |
|---|---|
| **#542 (a) Fairy Aura, "four whole-game divergences, instrument never built"** | **REAL ENGINE DEFECT.** Not an instrument artefact, not a misattribution. All THREE doors the row named — entry, exit, faint — reproduce on a staged board, each at the aura's own multiplier, with the sign flipping exactly as the row derived. |
| **#544 Beat Up ally order** | **REAL ENGINE DEFECT, and #544's reading of the authority is correct in every particular.** The staged board reproduces a pure PERMUTATION of the four hits — same count, same four packets, different order — and this engine's sequence after a switch is byte-identical to the authority's sequence with NO switch. |

Neither fix is applied. `engine/medicham2-browser.js` was not edited (another agent holds it tonight).

---

## The two new files

- `C:\Users\willj\Projects\Pokemon\ABRA\tests\probe_fairy_aura.js` — 4 arms (2 red, 2 control)
- `C:\Users\willj\Projects\Pokemon\ABRA\tests\probe_beatup_ally_order.js` — 4 arms (2 red, 2 control)

Both are built on `engine/game_differential.js`'s staged-game harness, on the same pattern as
`tests/probe_moldbreaker_ally_guard.js`. Both derive their legality, their population and their
mechanism from `Dex.forFormat('gen9championsvgc2026regmb')` at run time and exit `2` — "that is a
finding, not a pass" — if the format stops carrying the rule.

Scratch verification harness (temp only, not in the repo, not committed):
`%LOCALAPPDATA%\Temp\claude\...\scratchpad\_proposed_fix_release.js`. It freezes the LIVE tree into a
throwaway release store (the `tests/_live_release.js` trick), applies the eight edits below to the
SNAPSHOT'S bytes, and re-stamps that one digest so `open()`'s verification passes. The repository file
is never opened for writing.

---

## TASK 1 — ROADMAP #542 (a), Fairy Aura

### The authority, read and not recalled

`node engine/mod_audit.js`'s question answered directly: **Champions does NOT override `fairyaura`**
(`grep -c 'fairyaura *:' data/mods/champions/abilities.ts` → 0), so mainline `data/abilities.ts:1256`
is what this format runs:

```js
fairyaura: {
  onStart(pokemon) { if (this.suppressingAbility(pokemon)) return; this.add('-ability', pokemon, 'Fairy Aura'); },
  onAnyBasePowerPriority: 20,
  onAnyBasePower(basePower, source, target, move) {
    if (target === source || move.category === 'Status' || move.type !== 'Fairy') return;
    if (!move.auraBooster?.hasAbility('Fairy Aura')) move.auraBooster = this.effectState.target;
    if (move.auraBooster !== this.effectState.target) return;
    return this.chainModify([move.hasAuraBreak ? 3072 : 5448, 4096]);
  },
  flags: {},
}
```

`onAnyBasePower` is a handler registered on a STANDING BODY and collected by `findEventHandlers` at the
moment the event runs. Its reach is therefore decided **per move**, not per turn.

Derived on the format, filtered to legal entities: **`Floette-Mega` is the only legal Fairy Aura carrier
in Reg M-B**, its single ability slot IS Fairy Aura, and the only door to it is
`floettite.megaStone = { 'Floette-Eternal': 'Floette-Mega' }`. Champions DOES override `moonblast`
(`data/mods/champions/moves.ts:652`) but only to move the secondary chance to 10%; type, category, base
power, target and accuracy are read out of `Dex.forFormat` and asserted there.

### What this engine does

`field.aura` is a CACHE with exactly two writers:

```
engine/medicham2-browser.js:23434   field.aura   = auraStateOf([...actA, ...actB]);        // top of every turn
engine/medicham2-browser.js:19567   S.field.aura = auraStateOf([...S.actA, ...S.actB]);    // megaEvolveNow
```

`recomputeWeatherSuppression` — the identical `onAny` shape, wired by WIRE 78 and ROADMAP #352 — has
**four**: those two plus `runEntryPass` (a body arrives or leaves) and `_updateAll` (top of every
action, which is the one that catches a mid-turn FAINT). **The aura got two of the four.**

### The measurement

Board: Floette-Eternal @ Floettite + Corviknight (the anvil, Flying/Steel so Fairy is derived at 0.5 and
it survives three boosted Moonblasts) against Clefable/Magic Guard + Tinkaton. Pin `middle`. The aura
holder is never the attacker and never the target — it stands in the far slot and does nothing but
switch, so the half of the mechanic that helps the opponent is the half being measured.

`aura-doors` (3 turns: mega, switch OUT, switch back IN), damage the anvil lost:

| turn | door | Showdown | medicham | medicham/Showdown |
|---|---|---|---|---|
| 1 | aura ARRIVED at the mega | 51 | 51 | 1.0000 — agrees, the mega site was already resynced |
| 2 | the holder LEFT | **38** | **50** | **1.3158** |
| 3 | the holder RETURNED | **52** | **39** | **0.7500** |

`aura-faints` (2 turns: mega, then Tinkaton's Gigaton Hammer kills the holder before the slower Clefable
clicks):

| turn | door | Showdown | medicham |
|---|---|---|---|
| 1 | aura ARRIVED at the mega | 51 | 51 |
| 2 | the holder was KILLED first | **38** | **50** |

Both controls (`mega: true` cleared, the ONLY difference — same body, same item, same switches, same
clicks, so the ability is Flower Veil and there is no Fairy Aura in the format on that board) agree on
every hit and every board on both engines.

**The cross-arm claim, read off SHOWDOWN alone** (`5448/4096 = 1.33008`):

```
turn 1  aura ARRIVED (mega)     aura arm 51   control 39   ratio 1.3077   HIGHER
turn 2  holder LEFT             aura arm 38   control 38   ratio 1.0000   EQUAL
turn 3  holder RETURNED         aura arm 52   control 39   ratio 1.3333   HIGHER
```

So in the authority the aura moves the number, a DEPARTED aura prices exactly like no aura, and a
RETURNED aura is a live one. Nothing in the file types a damage number.

*(A methodological note that cost a rebuild: the `middle` pin draws a real damage index PER HIT, so an
arm's own three turns are three different rolls and are NOT comparable to each other. Every claim above
compares the SAME turn of the two arms, which the run demonstrates share a roll — turn 2 reads the
identical integer 38 on both arms, which it could not under different rolls.)*

### The proposed diff — `engine/medicham2-browser.js`, six edits

**1. The knob**, immediately after `const WSUP_STALE=...` (~line 14046):

```js
/* ROADMAP #542 (a), 2026-09-05 -- MEDI_AURA_STALE=1 PUTS THE ONCE-A-TURN AURA CACHE BACK: the two
 * mid-turn re-computations of `field.aura` (the entry pass and the per-action pass) are skipped, so a
 * carrier that arrives, leaves or dies during a turn is not noticed until the next turn starts, which
 * is what this engine did until today. The top-of-turn and mega sites are NOT under the knob -- they
 * are the behaviour being restored, not the defect, exactly as MEDI_WSUP_STALE leaves its own two
 * alone. Any run carrying it also carries a non-zero `MEDFAILS.auraStaleRestored`. */
const AURA_STALE=(typeof process!=='undefined'&&process.env&&process.env.MEDI_AURA_STALE==='1');
```

**2. One writer**, inserted immediately BEFORE `function auraFor(field,att,def){` (~line 11173):

```js
/* ONE WRITER FOR `field.aura`, FOUR CALLERS -- top of turn, mega, entry pass, per action -- for the
 * reason `recomputeWeatherSuppression` has one: two copies of "who is standing here" disagree
 * eventually and the disagreement is invisible because both keep working. Returns whether the ANSWER
 * moved, so a counter beside it rises on a real change rather than on every call. */
function refreshAura(field,bodies){
  if(!field)return false;
  const was=JSON.stringify(field.aura===undefined?null:field.aura);
  field.aura=auraStateOf(bodies||[]);
  return JSON.stringify(field.aura)!==was;
}
```

**3. The entry pass** — in `runEntryPass`, immediately after the existing `WSUP_STALE` pair (~line 21212):

```js
  if(WSUP_STALE)MEDFAILS.wSupStaleRestored=1;
  else recomputeWeatherSuppression(field,[...(act||[]),...(foes||[])]);
+ if(AURA_STALE)MEDFAILS.auraStaleRestored=1;
+ else if(refreshAura(field,[...(act||[]),...(foes||[])]))MEDSEEN.auraResyncedOnEntry++;
```

**4. The per-action pass** — `_updateAll` (~line 24369), which is the site that catches a FAINT:

```js
  const _updateAll=()=>{ _updateEvent(); restoreStatsAll(actA,actB);
    if(WSUP_STALE)MEDFAILS.wSupStaleRestored=1;
-   else recomputeWeatherSuppression(field,[...actA,...actB]); };
+   else recomputeWeatherSuppression(field,[...actA,...actB]);
+   if(AURA_STALE)MEDFAILS.auraStaleRestored=1;
+   else if(refreshAura(field,[...actA,...actB]))MEDSEEN.auraResyncedInAction++; };
```

**5 and 6. The two existing writers become calls**, so the "one writer" claim is true rather than
aspirational (byte-identical behaviour — the same expression, the same write):

```js
-    field.aura=auraStateOf([...actA,...actB]);          // ~23434, top of turn
+    refreshAura(field,[...actA,...actB]);
-  S.field.aura=auraStateOf([...S.actA,...S.actB]);       // ~19567, megaEvolveNow
+  refreshAura(S.field,[...S.actA,...S.actB]);
```

### Under that patch

`probe_fairy_aura.js` → **all 4 arms clear**, `MEDI_AURA_STALE=1` reproduces every red reading exactly
(exit 50, entry 39, faint 50) and moves **no byte of either control**.

---

## TASK 2 — ROADMAP #544, Beat Up ally order

### The authority, verified against the source

`data/moves.ts:1150`, and Champions does not override it
(`grep -c 'beatup *:' data/mods/champions/moves.ts` → 0):

```js
basePowerCallback(pokemon, target, move) {
  const setSpecies = this.dex.species.get(move.allies!.shift()!.set.species);
  return 5 + Math.floor(setSpecies.baseStats.atk / 10);
},
onModifyMove(move, pokemon) {
  move.allies = pokemon.side.pokemon.filter(ally => ally === pokemon || !ally.fainted && !ally.status);
  move.multihit = move.allies.length;
},
```

`sim/battle-actions.ts:119-133`, inside `switchIn`'s `if (oldActive)` block — **CONFIRMED verbatim**:

```js
oldActive.position = pokemon.position;
...
pokemon.position = pos;
side.pokemon[pokemon.position] = pokemon;
side.pokemon[oldActive.position] = oldActive;
```

That is a SWAP of two indices: the entrant takes the active slot's index, the body it replaced takes the
entrant's old bench index. `shift()` consumes `move.allies` one member per hit, so **hit *n* is member
*n* of `side.pokemon`**, and after one switch that array is no longer the build order. #544's reading is
correct in every particular.

### What this engine does

```js
function beatUpAllies(att,vp){
  const party=(att&&att._sf&&att._sf.team&&att._sf.team.length)?att._sf.team:[att];
```

`sf.team` is stamped ONCE — `S.sfA.team=teamA.filter(Boolean)` at `battleInit` (~line 22384) — and
nothing in this engine reorders it. The FILTER is the authority's and was already corrected; the ORDER
never was. `dmgRangeOneHit`'s own comment claims the index is "in `pokemon.side.pokemon` order", which is
precisely the array this engine does not hold.

The engine already performs the authority's swap on its BENCH array
(`if(outgoing)bench[_j]=outgoing;` in `bringIn`) — it is only `sf.team` that was left static.

### The measurement

Attacking side, four bodies with four DISTINCT `5+floor(atk/10)` (derived, and the file refuses to run
if any two collide):

```
0  Weavile      base atk 120   power 17     <- the user, never changes slot
1  Whimsicott   base atk  67   power 11     <- switches OUT on turn 1
2  Kangaskhan   base atk  95   power 14
3  Hydreigon    base atk 105   power 15     <- switches IN
```

Target Snorlax (Normal, neutral to Dark, survives four hits). Turn 1 is the switch (or a Protect, on the
control); turn 2 is the Beat Up.

At pin `top-tie-first` (one constant damage index on every hit, so a per-hit number is a pure function of
the base power):

| arm | Showdown | medicham |
|---|---|---|
| **after-a-switch** | `[25, 22, 21, 16]` | `[25, 16, 21, 22]` |
| no-switch (control) | `[25, 16, 21, 22]` | `[25, 16, 21, 22]` |

Hit count **4 on both engines on both arms** — #542's "count" reading is refuted here as well as on the
card. Same multiset, different order: a pure permutation.

**Cross-arm, read off Showdown alone:** with a switch `[25,22,21,16]`, without one `[25,16,21,22]` —
**reordered YES, same multiset YES**. And the diagnosis: **medicham's switch-arm sequence is byte-identical
to the authority's NO-SWITCH sequence.** This engine walked build order straight through the switch.

**And a second pair at pin `middle`, which is where the pool card came from and is the answer to "does
this part a board":**

| arm | Showdown | medicham | board |
|---|---|---|---|
| after-a-switch-middle | `[24, 21, 19, 21]` | `[24, 15, 19, 30]` | **b2 PART** |
| no-switch-middle (control) | `[24, 15, 19, 30]` | `[24, 15, 19, 30]` | ok |

**At the corner the divergence is protocol-visible and writes NO board leaf** — the same four packets in a
different order sum to the same total against a constant roll. At `middle` the four hits draw four
different indices, the permutation lands different rolls on different packets, and the total moves. That
is why the pool game is board-material and why a corner-only arm would have under-reported this.

### The proposed diff — `engine/medicham2-browser.js`, two edits

**1. The knob**, immediately after `const NO_ENTRY_FIELD_SYNC=...` (~line 14028):

```js
/* ROADMAP #544, 2026-09-05 -- MEDI_BEATUP_BUILD_ORDER=1 PUTS THE STATIC BUILD ORDER BACK: `sf.team` is
 * left in the order battleInit stamped it, so Beat Up prices its hits off the team sheet rather than off
 * the live party array. It exists so tests/probe_beatup_ally_order.js can be shown RED on demand without
 * swapping a file. Any run carrying it also carries a non-zero `MEDFAILS.beatUpBuildOrderRestored`. */
const BEATUP_BUILD_ORDER=(typeof process!=='undefined'&&process.env&&process.env.MEDI_BEATUP_BUILD_ORDER==='1');
```

**2. The permutation**, in `bringIn`, inserted immediately BEFORE
`nx._turnsOut=0; nx._mvActs=0; nx._fallenStuck=sf.fainted; act[i]=nx;` (~line 20906) — it must be above
that line because it reads `act[i]`, which is still the OUTGOING body there:

```js
  /* ROADMAP #544 -- `side.pokemon` IS PERMUTED BY EVERY SWITCH-IN AND `sf.team` IS THIS ENGINE'S COPY
   * OF IT. sim/battle-actions.ts:119-133 swaps two indices: the entrant takes the active slot's index
   * and the body it replaced takes the entrant's old bench index. The BENCH array three lines up
   * already does exactly this (`bench[_j]=outgoing`); `sf.team` was the copy nobody permuted, and
   * `beatUpAllies` walks `sf.team`, so Beat Up priced its hits off the team SHEET.
   *
   * IT READS `act[i]` RATHER THAN THE `outgoing` PARAMETER, and that is the whole of the faint case:
   * a replacement arrives with `outgoing` undefined and the corpse still standing in the slot, and the
   * authority swaps with that corpse too (`oldActive` is simply a fainted body there). */
  if(BEATUP_BUILD_ORDER)MEDFAILS.beatUpBuildOrderRestored=1;
  else {const _out=act&&act[i];
    if(sf&&sf.team&&_out&&_out!==nx){
      const _a=sf.team.indexOf(nx),_b=sf.team.indexOf(_out);
      if(_a>=0&&_b>=0&&_a!==_b){sf.team[_b]=nx;sf.team[_a]=_out;MEDSEEN.partyOrderPermuted++;}
    }}
```

### Under that patch

`probe_beatup_ally_order.js` → **all 4 arms clear** (medicham reads `[25,22,21,16]` and `[24,21,19,21]`,
the boards stop parting at `middle`), `MEDI_BEATUP_BUILD_ORDER=1` reproduces every red reading exactly,
and neither control moves.

---

## WHAT IS OWED — read this before applying

1. **`node engine/status.js --write` was NOT run** and no `<!-- GENERATED -->` block was hand-edited.
   Another agent is the exclusive writer of `engine/medicham2-browser.js` tonight, so a restamp would
   have stamped a moving tree.
2. **The census was NOT regenerated** and is quoted as it stands: 829 / 829 / 0. It cannot have moved —
   no engine byte and no artifact byte was written by this pass.
3. **`sf.team`'s ORDER acquires a second consumer under the #544 fix, and two existing readers should be
   re-checked by whoever applies it.** `fallenCount` (`sf.team.filter(x=>x.fainted).length`) and
   `board_state.js`'s `partyMap` (keyed by species, never by index) are both order-insensitive and are
   fine. The two I could not clear from here are in `engine/game_differential.js`, which I may not edit:
   `STATE_PLANTS` at lines 5598 and 5601 pick "a BENCHED party member" as `t[t.length-1]`, and after a
   permutation that index can hold a STANDING body. The plant would still be caught under `party.` (a
   standing body keeps its `hp` leaf in `benchRow`), so I expect no red — but it is an assumption, not a
   measurement, and `tests/test-end-state.js` is the gate that settles it. `benchedLiving` (line 5391)
   also picks a different body after a permutation; it is a plant selector and is harmless.
4. **Regression gates owed on application**, none of them run here: `tests/test-mechanics.js` (the census
   must not fall from 829), `tests/roster.js`, `tests/test-engine-diff.js`, `tests/test-end-state.js`,
   `tests/test-resolution-order.js`.
5. **The aura fix has real exposure and should not be treated as a rare-tail change.**
   `game_differential.js`'s own note records Floette-Eternal at ~10.5% of ladder sides, megaing 96.1% of
   the time, so the pinned pool should be expected to MOVE. The Beat Up fix is the opposite — #544 is 1
   board-material game of 961 — and the lab is the scoreboard to read for it.
6. **Two NARRATION gaps were measured beside this work and are not claimed fixed.** This engine prints
   neither `|-ability|<x>|Fairy Aura` on the carrier's entry/mega nor `|-ability|<x>|Unnerve` on a
   switch-in. Both are on every arm including both controls, so neither can flatter a red arm; both
   belong to the narration gate.
7. **`data/engine-release.json` is modified in the working tree** — the probes' `cut()` calls appended
   cut events to the EXISTING release. The tree was unchanged, so the id is still `63cbcc2ef605`, no new
   release directory was created and the pointer did not move.
8. **Nothing is committed.** The two probe files and this report are on disk only.
