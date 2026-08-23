# Narration: the RULES, the 42 grouped by mechanism, and a gate specification

**ENGINE, 2026-08-23. DERIVATION ONLY.** No file under `engine/` or `tests/` was written. No game was
played: no `game_differential.js`, no `all_mechanics_fire.js`, no `roster.js`, no `test-engine-diff.js`,
no `test-mechanics.js`, no `quarantine.js`, no `status.js`, no fit, no self-play, no CHANGELOG entry.
Everything below is read out of `data/game-differential.json` (generated `2026-08-23T12:58:11Z`,
release `dd3b8bdd482f`) or cited to a line in the pinned Showdown checkout
(`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`) or in `engine/medicham2-browser.js`.

Historical record, per `docs/_reports/` convention. Not current state; superseded by the register rows
it feeds.

---

## 0. VERDICT

**The count is 42, not 43.** The published artifact's `middle` arm reads
`narration_games 42 / 38 causes / board_parted 30 / unknown 0`, and the three columns reconcile against
the 72 parted games. 43 was the previous run's figure. Every number below is the `middle` arm.

**The 42 reduce to 15 mechanisms and 11 implementable rules, plus one derived TIE exclusion.**

| rank | rule | games | also writes STATE? |
|---|---|---|---|
| 1 | **A `[silent]` `-end` is a protocol event.** Three triggers, one emission rule | **8** | 1 of the 8 (Syrup Bomb) |
| 2 | **`\|faint\|` is never written at the moment of lethal damage** | **5** | yes, all 5 |
| 3 | **A boost of magnitude ZERO is still announced** | **5** | no |
| 4 | **The weather upkeep line** — one derived defect + one UNATTRIBUTED cause | **5** | unknown; see §3.4 |
| 5 | **ONE action queue, ONE selection sort** (moves + switches + megas together) | **7**, of which ≤5 are ties | no |
| 6 | **The target's berry resolves ABOVE the attacker's recoil / Life Orb** | **3** | marginal |
| 7 | **Substitute BREAKING writes `-end`, not `-activate [damage]`** | **2** | **yes — and invisible to the board comparator** |
| 8 | **Switch-in handlers are one flat speed sort with the tie pre-resolved once** | 2, ≥1 a tie | no |
| 9 | **`onTryImmunity` returning false writes `-immune` and refuses the hit** | 2 | **yes** |
| 10 | **A spread drain heals per target, interleaved** | 1 | marginal |
| — | **Tailwind on both sides is an EXACT TIE — NOT A DEFECT, derived** | **2** | n/a |

**Answer to the brief's part (a): the announce-failure rule explains ZERO of the 42.** Every surviving
`-fail` divergence in the artifact is classified BOARD-MATERIAL, not narration (§2.3). The rule as
restated in the brief is also **wrong in two of its twelve sites** and I verified it at the lines rather
than trusting it (§2).

**Answer to the brief's part (b): the ordering half is bigger and it is mostly ONE rule** — the
authority's five-key `comparePriority` applied uniformly to five sorted groups this engine sorts
separately or not at all.

---

# PART A — THE RULES

## 1. The five sort keys, and the two nobody was using

`sim/battle.ts:404` `comparePriority` — and the brief's restatement named **three** keys. There are
**five**, and the two missing ones are exactly the ones that decide narration order:

```
sim/battle.ts:393-410
 * 1. Order, low to high (default last)          order   ASC   (falsy -> 4294967296)
 * 2. Priority, high to low (default 0)          priority DESC
 * 3. Speed, high to low (default 0)             speed   DESC
 * 4. SubOrder, low to high (default 0)          subOrder ASC     <-- MISSING FROM THE BRIEF
 * 5. EffectOrder, low to high (default 0)       effectOrder ASC  <-- MISSING FROM THE BRIEF
```

**`subOrder` is a TYPE table, assigned when the handler is built** (`sim/battle.ts:955-992`), and it is
what interleaves a side condition against a Pokemon's own residual inside one order group:

```
Condition 2 | slot condition 3 | side condition 4 | field condition / Weather / Format / Rule 5
Poison Touch & Perish Body 6 | Ability 7 | Item 8 | Stall 9
```

An effect may override it: `onResidualSubOrder`, `onSideResidualSubOrder`. **Read the full expiry table
for side conditions at order 26, derived from `data/moves.ts` rather than typed:**

```
reflect 1  lightscreen 2  safeguard 3  mist 4  tailwind 5  luckychant 6
waterpledge 7  firepledge 8  grasspledge 9  auroraveil 10  gmax* 11
```

So **two DIFFERENT side conditions expiring on the same turn are fully deterministic**, and this retires
the comment standing in `engine/medicham2-browser.js:24789` — *"a Tailwind expiring on the same turn as
an Aurora Veil is announced in the wrong order here"*. Tailwind 5 goes before Aurora Veil 10, always.

**`effectOrder` is only assigned for TWO callbacks** (`sim/battle.ts:994-1000`), and Showdown says so in
its own comment:

```ts
if (callbackName.endsWith('SwitchIn') || callbackName.endsWith('RedirectTarget')) {
    handler.effectOrder = handler.state?.effectOrder;
    // TODO: In-game, other events are also sorted this way, but that's an implementation for another refactor
}
```

**That TODO is the whole of the Tailwind divergence** (§3.7).

**Ties are a die.** `speedSort` (`sim/battle.ts:429-459`) is a SELECTION SORT and its last act on any
tied group is `this.prng.shuffle(list, sorted, sorted + nextIndexes.length)` at **`:455-457`**.

### 1a. Speed is not on a Side or a Field handler

`resolvePriority` assigns `handler.speed` only when the holder has `getStat`
(`sim/battle.ts:1001-1003`). `findSideEventHandlers` (`:1140`) and `findFieldEventHandlers` (`:1180`)
set `effectHolder` to the Side / Field, so **every side and field handler has speed 0** and sorts below
every living body inside its order group.

### 1b. The residual is ONE pooled list

`fieldEvent('Residual')` (`sim/battle.ts:484-567`) concatenates field handlers, side handlers, per-body
handlers, per-body side handlers, per-body field handlers and battle handlers into **one array**, calls
`this.speedSort(handlers)` once at `:507`, and then walks it. Three consequences a fixer needs:

- **the duration decrement and the `end` call happen INSIDE the walk** (`:514-524`), at that handler's
  sorted position — which is where `-sideend`, `-end` and `-weather|none` are written;
- a handler whose duration reaches zero **`continue`s**, so **it does not also run its body that turn**
  (this is why a five-turn sandstorm chips four times, already landed as WIRE 74);
- **`this.faintMessages()` is called after EVERY handler** (`:565`).

### 1c. The action order table

`sim/battle-queue.ts:174-194`, and it is a single number per choice:

```
team 1 | start 2 | instaswitch 3 | beforeTurn 4 | beforeTurnMove 5 | revivalblessing 6
runSwitch 101 | switch 103 | megaEvo/X/Y 104 | runDynamax 105 | terastallize 106
priorityChargeMove 107 | shift 200 | move 200 (default) | residual 300
```

**Every one of these actions gets a speed** — `getActionSpeed` ends with
`action.speed = action.pokemon.getActionSpeed()` (`sim/battle.ts:2649-2658`) with no exemption for
switch or megaEvo — and `queue.sort()` runs ONE `speedSort` over the WHOLE list. That is the rule
behind §3.5.

## 2. The `-fail` rule, verified at the lines — and corrected

The brief's restatement is **substantially right and wrong in three places**. `grep "'-fail'"
sim/battle-actions.ts` returns exactly twelve, and I read all twelve:

| site | guard | attribution | verdict on the restatement |
|---|---|---|---|
| `:463` | `if (!target)` | `[notarget]` | **NOT a `=== false` guard** |
| `:512` | `if (!targets.length)` | `[notarget]` | **NOT a `=== false` guard** |
| `:595` | `hitResult === false` | `[still]` | holds |
| `:646` | `!hitResults.includes(true) && hitResults.includes(false)` | `[still]` | holds, as an ARRAY predicate |
| `:831` | `hitResult === false` | `[still]` | holds |
| `:850` | `hitResult === false` | `[still]` | holds |
| `:1048` | `hitResult === false` | `[still]` | holds |
| `:1175` | `damage[i] === false && !isSecondary && !isSelf` | `[still]` | holds, with two extra conjuncts |
| `:1203` | `target.hp >= target.maxhp` | `[still]` | **a STATE test, not `=== false`; names the TARGET and carries a third field `heal`** |
| `:1213` | `!d && d !== 0` then `d !== null` | `[still]` | **`undefined` announces here** |
| `:1306` | `didAnything === false` | `[still]` | holds — this is the general tail |
| `:1362` | `hitResult === false && move.category === 'Status'` | `[still]` | holds, with the category conjunct |

`combineResults` is at **`sim/battle-actions.ts:1561-1576`** (the priority list at `:1566`), and the
ranking `['undefined', string, object, 'boolean', 'number']` is confirmed. **One clause the restatement
omits and it matters:** `else if (left && !right && right !== 0) return left;` — a truthy left beats a
falsy right of the same rank, so **one target succeeding suppresses another target's `false`**, not
merely a number suppressing a boolean.

**And "twelve sites" is only the GENERIC ones.** The complete `-fail` emitter census in the reachable
data:

```
sim/battle-actions.ts   12   generic, all paired with attrLastMove
sim/field.ts:59          1   setWeather refused         -fail|SRC|EFFECT|[from] WEATHER
sim/pokemon.ts:1706-8    2   setStatus refused          -fail|SELF|STATUS  /  -fail|SRC
data/*.ts + champions   52   move- and item-specific, most carrying extra fields
                        --
                        67
```

Fifteen of the 52 carry a third and fourth field (`'heal'`, `'unboost'`, `'move: Substitute'`,
`'[weak]'`, `'[heavy]'`, `'[from] item: Clear Amulet'`, …). A fixer wiring "announce on boolean false"
alone will emit a bare `-fail` where the authority writes a decorated one.

### 2.3 How many of the 42 does the rule explain? ZERO.

Every `-fail` row in the current artifact is on the BOARD side of the cross-tab:

```
|-fail|p1a <> |move|p2b|roleplay          BOARD-MATERIAL, board parted EARLIER (turn 9)
|-fail|p2b <> |move|p1a|curse             BOARD-MATERIAL, board parted EARLIER (turn 9)
|-fail|p2b <> |-start|p1a|disable|protect BOARD-MATERIAL, board parted SAME TURN (turn 9)
```

The third is already named unfixed in `docs/_reports/2026-08-23-mechanics-by-reach.md` —
`disable.onStart` returns false when the target's `lastMove` slot has no PP left, and this engine
applies the seal regardless. **The announce-failure class is finished as a narration question; what
remains of it is board-material and belongs to the existing gate.**

### 2.4 The `[still]` blindness is real and it is DOUBLE

The brief names `move-target-field` (`f => f[1]==='move' ? f.slice(0,4) : f`, 872,735 lines collapsed).
There is a second silencer on the same fact: the `display-flags` rule
(**262,636 lines collapsed**) drops `[silent]`, `[still]`, `[miss]` and `[spread]` from *every* line, not
just `|move|`. So the ~70 of ~84 `mvFail` sites that do not call `attrStill` are invisible **twice
over**, and no change to `slice(0,4)` alone would reveal them.

---

# PART B — THE 42, GROUPED BY MECHANISM

Reconciled: **15 groups, 38 causes, 42 games, zero unassigned.**

| # | mechanism | games | causes | rule | state? | tie? |
|---|---|---|---|---|---|---|
| 1 | `[silent]` `-end` on SWITCH-OUT (Supreme Overlord ×5, Syrup Bomb ×1) | 6 | 6 | R1 | 1 | no |
| 2 | `[silent]` `-end` at RESIDUAL EXPIRY (Throat Chop ×2) | 2 | 2 | R1 | maybe | no |
| 3 | zero-magnitude `-boost` / `-unboost` at the ±6 cap | 5 | 5 | R3 | no | no |
| 4 | the faint queue drains eagerly | 4 | 4 | R2 | **yes** | no |
| 5 | `-weather X [upkeep]` absent | 5 | 2 | R4 | ? | no |
| 6 | the target's berry vs the attacker's recoil / Life Orb | 3 | 3 | R6 | marginal | no |
| 7 | Protect vs Protect / Protect vs Detect | 3 | 3 | R5 | no | **suspect** |
| 8 | Tailwind expiring on both sides | 2 | 1 | — | no | **YES, derived** |
| 9 | Substitute breaking | 2 | 2 | R7 | **yes** | no |
| 10 | two megas the same turn | 2 | 2 | R5 | no | 1 suspect |
| 11 | simultaneous switch / switch-vs-move order | 2 | 2 | R5 | no | 1 suspect |
| 12 | switch-in ability order (Intimidate vs Drizzle; Intimidate vs Intimidate) | 2 | 2 | R8 | no | 1 suspect |
| 13 | `-immune` where we deal damage | 2 | 2 | R9 | **yes** | no |
| 14 | spread drain heal not interleaved | 1 | 1 | R10 | marginal | no |
| 15 | a `faint()` death writes a `-damage` line here | 1 | 1 | R2 | **yes** | no |

## 3. The rules, in rank order of games cleared

### R1 — A `[silent]` line is a PROTOCOL event. 8 games (groups 1, 2)

`[silent]` is a CLIENT hint; the line is in the log. The `display-flags` normalisation already drops the
flag, so **the flag is not the problem — the absent event is.**

Class print, derived over the whole data tree rather than over the rows we happened to see:
**21 `this.add('-end', …, '[silent]')` sites and 6 `'-start'` sites**, including one Champions override
(`data/mods/champions/conditions.ts:27`, Nightmare). The three triggers in the 42 are three DIFFERENT
mechanisms and a fixer must not treat them as one:

**1a. An ABILITY's `onEnd` fires on switch-out** — `sim/battle-actions.ts:100-101`, inside `switchIn`:

```
runEvent('BeforeSwitchOut')  ->  eachEvent('Update')  ->  runEvent('SwitchOut')
  ->  singleEvent('End', ability)  ->  singleEvent('End', item)
  ->  queue.cancelAction  ->  copyVolatileFrom  ->  clearVolatile()
```

Supreme Overlord (`data/abilities.ts:4722-4733`) writes `-end|BODY|fallen${effectState.fallen}|[silent]`
**unconditionally**, while its `onStart` writes only when `side.totalFainted` is non-zero. With zero
faints `effectState.fallen` is `undefined`, so **`fallenundefined` IS THE AUTHORITY'S OWN TEXT** and all
five cards are turn-2 switches with no faint yet. Anyone "fixing" it to a number creates a new
divergence. Kingambit is 23.4% of teams.

**1b. `clearVolatile` does NOT run `onEnd`.** `sim/pokemon.ts:1514-1545` sets `this.volatiles = {}`
directly. So no volatile's `-end` is written on a switch-out **except** through `removeLinkedVolatiles`.
This kills the obvious wrong fix.

**1c. Syrup Bomb ends because its SOURCE left, not because the holder did.**
`data/moves.ts:18771-18774` — `onUpdate(pokemon) { if (this.effectState.source && !source.isActive)
pokemon.removeVolatile('syrupbomb'); }`, reached through the `eachEvent('Update')` at
`battle-actions.ts:81`. **This one writes STATE**: if we do not remove it, its `onResidual` keeps taking
a Speed stage every turn from a source that has left the field.

**1d. Throat Chop is a duration expiry** — `data/moves.ts:19383`, ended by the residual walk's decrement
at `sim/battle.ts:514-524`. Board-material **if and only if** the expiry turn is off by one.

### R2 — `|faint|` is never written at the moment of lethal damage. 5 games (groups 4, 15)

`Pokemon#faint()` (`sim/pokemon.ts:1587-1599`) sets `hp = 0`, pushes onto `battle.faintQueue`, and
**adds nothing to the log at all.** The line comes from `faintMessages()`
(`sim/battle.ts:2532-2576`), which also does `pokemonLeft--`, `totalFainted++`, `runEvent('Faint')`,
ability `End`, item `End`, `clearVolatile(false)`, `faintedThisTurn`.

**The eight call sites are the whole rule, and every one is a STEP BOUNDARY:**

```
battle-actions.ts:336   between Dancer copies
battle-actions.ts:347   after the whole move resolves
battle-actions.ts:976   after the multi-hit loop, ABOVE applyRecoilDamage(:983)
battle.ts:565           after EVERY residual handler
battle.ts:1554          the side-wipe path
battle.ts:2180          spreadDamage's `instafaint`
battle.ts:2832          after each action in runAction
battle.ts:2897          BeforeSwitchOut
```

All four group-4 cards are this: Stone Axe's `-sidestart` before the KO's `|faint|`, Fling's `-enditem`
before it, a spread-mate's Sitrus before it, and the sandstorm chipping **both** bodies before either
faints (because one `onFieldResidual` runs `eachEvent('Weather')` over every body, and `faintMessages`
is only reached at the end of that handler).

**Group 15 is the same rule's other half.** `|upkeep <> |-damage|p1b|0 fnt` — a Perish Song death. The
authority calls `faint()` and writes nothing; we write a `-damage` line. **This is STATE**: `damage()`
runs the Damage event, sets `hurtThisTurn` and `lastDamage`; `faint()` does none of it.

### R3 — A boost of magnitude ZERO is still announced. 5 games (group 3)

`sim/battle.ts:2072-2077`, the two `else` arms of the `if (boostBy)` branch:

```js
} else if (effect?.effectType === 'Ability') {
    if (isSecondary || isSelf) this.add(msg, target, boostName, boostBy);   // boostBy === 0
} else if (!isSecondary && !isSelf) {
    this.add(msg, target, boostName, boostBy);                              // boostBy === 0
}
```

**The two conditions are INVERSES of each other** and that asymmetry is the whole rule: a MOVE (or item,
or no effect) announces a zero when it is neither a secondary nor a self-boost; an ABILITY announces a
zero **only** when it is. And the message word is chosen at `:2040`:

```js
if (boost[boostName] < 0 || target.boosts[boostName] === -6) msg = '-unboost';
```

so **a positive boost onto a body already at −6 announces as `-unboost|stat|0`.** All five cards are
moves at a cap — Decorate onto +6 Atk, Parting Shot and Tearful Look onto −6 Atk.
`boost()` returns `success = null` in this branch, so `statsRaisedThisTurn` / `statsLoweredThisTurn` do
not move: **pure narration, provided this engine already applies the cap** (it does — the boards agree).

### R4 — the weather upkeep line. 5 games (group 5), and only HALF of it is attributed

**The derived defect, which is certain:** `engine/medicham2-browser.js:24836` reads

```js
if(TR){ if(field.weather && !field.wSup) TR.wx(field.weather,null,null,true); else if(_wx0 && !field.weather) TR.wxNone(); }
```

The authority does **not** suppress this line under Cloud Nine / Air Lock. `findFieldEventHandlers`
reaches the condition through `field.getWeather()` (`sim/field.ts:126-128`), which returns
`this.weather` **without** consulting `suppressingWeather()`; only `effectiveWeather()` (`:101-104`)
does. And the emission is **above** the suppression test inside the handler —
`data/conditions.ts:655-657`:

```js
onFieldResidual() {
    this.add('-weather', 'Sandstorm', '[upkeep]');            // unconditional
    if (this.field.isWeather('sandstorm')) this.eachEvent('Weather');   // <- the guard
}
```

Same shape at `:507` (rain), `:585` (sun), `:722` (snow). So **the sky still announces itself under a
suppressor and merely stops doing anything.** All eight weathers carry `onFieldResidualOrder: 1`.

**But this almost certainly does NOT explain the five games.** Derived from the format, filtered:

```
abilities with suppressWeather: Air Lock, Cloud Nine
legal carriers (2): Altaria, Drampa
```

and none of the five cards shows either. **The cause of the five is UNATTRIBUTED and I will not guess
it.** Three hypotheses were tested statically and all three are dead: the clock arithmetic is right
(`weatherTurns` = 5, decremented above the walk at `:24778`, so four upkeeps for a five-turn sky —
WIRE 74); re-setting the same weather correctly fails on both sides (`sim/field.ts:45-53` returns false
in gen > 2, `medicham2:12850` guards on `field.weather !== _w`); and the field-position worry is void
because `TR.push` filters empty fields (`medicham2:2297`), so we would emit `|-weather|raindance|[upkeep]`
and not `|-weather|raindance|||[upkeep]`.

**The command that settles it** — a staged two-turn board with a Drizzle carrier, reading both engines'
residual streams, which is a probe and not a differential run:

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node -r ./tests/_live_release.js tests/<new>_probe_weather_upkeep.js
# arms: rain by MOVE / rain by DRIZZLE-on-switch-in / rain with a Drampa on the field (the wSup control)
# assert: the count and the TURN INDEX of every `-weather|W|[upkeep]` line, both engines, turns 1..6
```

### R5 — ONE action queue, ONE selection sort. up to 7 games (groups 7, 10, 11)

`queue.sort()` runs a single `speedSort` over the whole list: switches (103), megaEvo (104) and moves
(200) are sorted **together**, and a selection sort's swaps move untied elements around, so **the
permutation a tied group is left in depends on what else is in the list.**

This engine does not have one list.

- `TURN_ORDER = { move: 200, next: 3, last: 201 }` (`medicham2:10235`) has **no slot for switch (103)
  or megaEvo (104)**;
- `sortTurnOrder` (`:10417-10446`) faithfully reproduces the authority's selection sort **for the move
  actions only** — and its own header (`:10380-10415`) records that the algorithm, not the comparator,
  is what decides a tie;
- the mega phase (`:16128-16172`) is a **separate, stable `Array.prototype.sort` with no tie key**:
  `_run.sort((x,y)=>compareTurnOrder({spe:x.spe},{spe:y.spe},field))`.

So the mega group's tie keeps input order here and takes the queue's post-swap order there, and the
move group is sorted over a shorter list than the authority's. **One rule fixes all three groups:
assemble every action into one list with the authority's `order` numbers and run one selection sort.**

**Two of the seven are almost certainly real defects rather than ties:**
`|detailschange|p1a: Starmie-Mega <> |detailschange|p2a: Charizard-Mega-Y` — 115 base Speed against
100 — and `|switch|p1a: Palafin <> |move|p2b: Helping Hand`, where a switch (103) must precede a move
(200) under any tie resolution.

### R6 — the target's berry is ABOVE the attacker's recoil. 3 games (group 6)

`sim/battle-actions.ts:971` calls `this.battle.eachEvent('Update')` **inside** the hit loop — that is
where an `onUpdate` item (Sitrus) fires — and `applyRecoilDamage` is at **`:983`**, after the loop and
after `faintMessages()` at `:976`. Life Orb is later still (`onAfterMoveSecondarySelf`). All three cards
are exactly this inversion.

### R7 — Substitute BREAKING. 2 games (group 9) — **and this one is not narration**

`data/moves.ts:18349-18356`:

```js
if (target.volatiles['substitute'].hp <= 0) {
    if (move.ohko) this.add('-ohko');
    target.removeVolatile('substitute');          // -> onEnd -> |-end|TARGET|Substitute   (NOT silent)
} else {
    this.add('-activate', target, 'move: Substitute', '[damage]');
}
```

The `-activate` is the **else** arm — it is written only when the sub SURVIVES. We write it in both
cases and never write `-end`.

**`end_state_not_compared` names Substitute HP**, so if this engine also fails to remove the volatile,
the sub persists at ≤0 HP and absorbs every later hit, and **the board comparator cannot see it.** This
is the row of the 42 most likely to be mis-labelled narration. It is also the row the brief's first
warning is about: `move_result_state.js` found two state defects on arms whose boards agreed and one of
whose protocol was byte-identical. Note also `:18345-18348` — damage is clamped to the sub's HP and
`source.lastDamage` takes the CLAMPED value, which recoil and drain then read.

### R8 — switch-in handlers are one flat sort with the tie pre-resolved ONCE. 2 games (group 12)

`sim/battle-actions.ts:175-186`:

```js
const allActive = this.battle.getAllActive(true);
this.battle.speedSort(allActive);                                     // the tie is rolled HERE, once
this.battle.speedOrder = allActive.map(a => a.getFieldPositionValue());
this.battle.fieldEvent('SwitchIn', switchersIn);
```

and then, for every `*SwitchIn` handler (`sim/battle.ts:1008-1013`):

```js
handler.speed -= this.speedOrder.indexOf(pokemon.getFieldPositionValue()) / (this.activePerHalf * 2);
```

so **no two switch-in handlers can tie**, and the order they take is the one `runSwitch` resolved before
any of them ran. Both sides' handlers are in ONE list — Intimidate and Drizzle compete directly on
holder speed, not side-then-slot. (`getCallback`, `:1017-1031`, is what maps an ability's or item's
`onStart` onto `onSwitchIn` in gen ≥ 5.)

The `|-unboost|p1a: Staraptor|atk|1 <> |-unboost|p2a: Staraptor|atk|1` card is two Staraptor and is
probably a tie; the Archaludon/Politoed card is probably the rule.

### R9 — `onTryImmunity` writes `-immune` and refuses the hit. 2 games (group 13)

`sim/battle-actions.ts:666-688`, the second arm:

```js
} else if (!this.battle.singleEvent('TryImmunity', move, {}, target, pokemon, move)) {
    this.battle.add('-immune', target);
    hitResults[i] = false;
}
```

The first card is Endeavor: `data/moves.ts:4796-4798` `onTryImmunity(target, pokemon) { return
pokemon.hp < target.hp; }`, not overridden by Champions. **It writes state** — `hitResults[i] = false`
feeds `combineResults` and therefore `moveThisTurnResult`. The board agreed only because our Endeavor
happened to deal zero damage in that game.

The second card (`|-immune|p1b <> |cant|p2a|flinch`, Fake Out into a mega Scovillain) is **not
attributable from six lines of context**. `--dump-games` was capped; ROADMAP #375 owns that.

### R10 — a spread drain heals per target, interleaved. 1 game (group 14)

`sim/battle.ts:2159-2171` — the drain heal is emitted **inside** `spreadDamage`'s per-target loop,
immediately after that target's `-damage`:

```
-damage|target1 ; -heal|user|hp|[from] drain|[of] target1 ; -damage|target2 ; -heal|user|hp|[from] drain|[of] target2
```

Matcha Gotcha, Sinistcha 17.3% of teams. Marginally state-bearing: the amount is
`Math.round(targetDamage * drain[0] / drain[1])` **per target**, so batching can round differently, and
`Battle#heal` returns false at full HP (`:2270-2272`) which a batched total would mask.

## 4. THE `[from]` / `[of]` ATTRIBUTION RULE, since the brief asked for it

Two switches, and neither is a per-effect decision.

**`-damage`** (`sim/battle.ts:2138-2157`) — `tox` is renamed to `psn` at `:2137`:

```
effect.effectType === 'Move' || !name         ->  |-damage|TARGET|hp
source && (source !== target || Ability)      ->  |-damage|TARGET|hp|[from] NAME|[of] SOURCE
otherwise                                     ->  |-damage|TARGET|hp|[from] NAME
partiallytrapped / powder / confused          ->  three named special forms (:2140-2147)
```

**`-heal`** (`sim/battle.ts:2274-2296`):

```
leechseed, rest  -> |[silent]      drain -> |[from] drain|[of] SOURCE      wish -> nothing at all
zpower -> |[zeffect]
Move             -> |-heal|TARGET|hp                    (bare)
source !== target-> |[from] EFFECT.fullname|[of] SOURCE
otherwise        -> |[from] EFFECT.fullname
```

**An ability BOOST is never attributed inline.** `sim/battle.ts:2065-2069` puts it on a separate
`|-ability|TARGET|NAME|boost` line, once per vector, and **suppresses it when the handler passes
`isSecondary`**. This is already landed (`docs/_reports/2026-08-23-mechanics-by-reach.md` §2, Gooey) and
is restated only so a fixer does not reintroduce the inline form.

Note that the differential's `source-tag` and `stat-attribution` rules drop `[of]` and boost `[from]`
entirely (171,509 and 13,614 lines collapsed), so **none of §4 is measurable by the whole-game
instrument.** It is stated for correctness, not for the gate.

## 5. TIES — what to exclude from the work list

**EXCLUDE, DERIVED, NO MEASUREMENT NEEDED: group 8, Tailwind, 2 games.**
Two Tailwinds expiring the same turn are an EXACT five-key tie:

```
order 26 (both)   priority 0 (both)   speed 0 (both — Side holders, §1a)
subOrder 5 (both, data/moves.ts onSideResidualSubOrder)
effectOrder 0 (both — resolvePriority assigns it ONLY for SwitchIn/RedirectTarget, sim/battle.ts:994)
```

so `comparePriority` returns 0 and `speedSort` hands the pair to `prng.shuffle` (`:455`). **Showdown's
own TODO at `:996` says this is not the in-game rule.** Neither engine is wrong; there is no correct
answer to implement. File NOT A DEFECT with this derivation attached.

**SUSPECTED TIES, up to 5 more games** — the three Protect/Detect rows, one of the two mega rows (two
Mawile-Mega), one of the two switch rows, one of the two switch-in ability rows (two Staraptor).

**AND THE EARLIER "NOT A DEFECT" FILING NEEDS RE-CHECKING, BECAUSE THE INSTRUMENT MOVED.**
`engine/game_differential.js:570-586` records that this instrument **manufactured a turn-order
divergence on every speed tie for most of its life** — Showdown resolving to the later body under the
identity-shuffle pin, medicham2 to the earlier. `:1236-1238` then records that **3.74.0 FIXED IT AT THE
ROOT**: medicham2 now runs the authority's selection sort and *"the two agree under identical pinned
dice"*, which is why the two `tie-second` arms were retired as a desynchroniser. **So a tie divergence
surviving in today's artifact is no longer explained by the pin**, and "exact speed tie, neither is
wrong" can no longer be asserted without a spread.

Cross-arm reproduction does **not** settle it either, and I nearly reported that it did: all three arms
run are `tie-first` (`ARMS` at `:1210-1260`), so a tie behaves identically in all three and the Moody
signature (8 / 0 / 0) has no counterpart here.

**The command that settles every suspected tie at once** — it needs the built spreads, which the
artifact does not carry:

```bash
# for each suspect cause, from data/game-differential.json's first_divergences[].seed,
# rebuild the two teams and print effSpeed for the two bodies named on the row:
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/explain_divergence.js --cause "<cause string>" --dump-speeds
# EQUAL  -> tie, file NOT A DEFECT with the spread printed
# UNEQUAL-> a real sort defect, and R5 / R8 is the rule
```

If `explain_divergence.js` has no `--dump-speeds`, the same answer comes from re-running the published
differential with `--dump-games` raised; that is a run and belongs to whoever owns the settled tree.

## 6. WHICH ROWS TOUCH STATE

| certainty | games | rows |
|---|---|---|
| **writes state, certain** | **10** | faint queue (4), Substitute (2), `-immune`/`onTryImmunity` (2), the Perish `-damage` (1), Syrup Bomb's `onUpdate` removal (1) |
| **conditional on the cause** | **7** | the weather upkeep (5 — narration if `wSup`, state if a clock), Throat Chop (2 — state only if the expiry turn is off) |
| **marginal** | 4 | berry-vs-recoil (3), spread drain (1) |
| **pure narration** | 21 | Supreme Overlord (5), zero-magnitude boost (5), the tie rows (up to 7), the sort rows |

**Every row in the first two bands must go through `engine/move_result_state.js` before it is called
landed.** `mvFail` writes `_mvRes` as well as printing, the 2026-08-12 retraction was a state change
riding in on a narration fix, and the Suction Cups arm in
`docs/_reports/2026-08-23-announce-failure-class.md` had **byte-identical protocol and the wrong state
in the opposite direction**.

---

# PART C — THE GATE

## 7. Specification (NOT built)

**Name.** `engine/gate_narration.js`, beside `engine/gate_fail_and_silent.js`, whose CANNOT-ANSWER /
exit-2 refusal it should copy exactly.

**What it reads.** The published `data/game-differential.json` only. It plays no game and loads no
simulator, so it is light and can run in any batch. It **refuses with exit 2** (never a pass, never a
fail) when the artifact's `engine_release` is not the live tree's release — the same refusal
`gate_fail_and_silent.js` already implements, and the reason the announce-failure session could quote no
whole-game number.

**What it counts.** Three numbers off `end_state[0].summary.by_cause`, per arm, never pooled:

```
narration_games        the ratchet          today 42
narration_causes       the ratchet          today 38
narration_by_class     { event missing from medicham2, extra event emitted by medicham2, ordering,
                         unrelated event mismatch }   split, because a fix that converts one class
                         into another is not progress and a single total would hide it
```

**How it avoids being a list of known-bad lines.** Two predicates, and the second is the one that makes
it a gate rather than a scoreboard:

1. **RATCHET.** `narration_games` and `narration_causes` may not rise. Baselined in
   `data/narration-baseline.json` alongside the release id and the census digest, ratcheted downward
   only by a run that also records those pins.
2. **SUBSET.** The measured cause SET must be a **subset** of the baseline cause set. A cause that
   disappears and a new one that appears leaves the count flat, and that is the exact shape of the
   Cursed Body result in `docs/_reports/2026-08-23-mechanics-by-reach.md` — *"one board-material cause
   removed, one revealed behind it"*. Without the subset clause a regression can hide inside a fix.

**The exclusion list is a list of MECHANISMS with derivations, never of lines.** Today it holds exactly
one entry — Tailwind, §5 — and every entry must carry (a) the file:line derivation that makes it
unfixable and (b) a `recheck_when` field naming the instrument fact it depends on (for Tailwind:
`game_differential.js` tie pinning). An excluded row that becomes fixable is then found by re-reading
the field, not by remembering. **An exclusion without a derivation fails the gate's own selftest.**

**What it must NOT count.**

- **anything the normalisation already collapses.** `[still]`, `[silent]`, `[miss]`, `[spread]`, `[of]`,
  boost `[from]`, `|-ability|` lines and `|move|` fields 4+. A gate that appeared to count those would
  be reading noise, because the artifact does not carry them.
- **`unknown_games`.** ENDED-APART / NO-COMPARABLE-BOARD / THREW is not a narration verdict.
- **the corner arms' narration counts as a total.** They play different games (all-miss/max-damage and
  all-hit/min-damage); they are reported for corroboration, never summed.
- **board-material rows.** Those belong to the existing quarantine clause and double-counting them
  would let a board fix appear to move the narration gate.

**How it is shown RED.** The engine already carries restore knobs of exactly the right shape — the six
landed last night each have one (`MEDI_REGEN_SILENT`, `MEDI_HERB_END_FIRST`, `MEDI_ABILITY_VOL_LINE_BLIND`,
`MEDI_VOL_START_ARG_BLIND`, `MEDI_ITEM_READ_SILENT`, `MEDI_PUNISH_ANNOUNCE_BLIND`). The demonstration is:
cut a release with `MEDI_REGEN_SILENT=1` set, produce a differential, and the gate must go **red naming
the Regenerator cause** — not merely red on a count. Do this before the baseline is trusted, as
`tests/test-lownode.js` and `.githooks/pre-commit` were.

**And the limit goes in the gate's own header, not only here:** the gate is limited by its SAMPLE (961
games from `data/team-pool-frozen`, turn cap 12) exactly as `probe_announce_failure.js` is limited by its
FIXTURES. A narration defect in a mechanism the pool never reaches is invisible to it. That is the same
hole in a different place, and it is why the roster and the census stay in the picture — Will's
2026-08-23 call.

## 8. Can the gate be built without first fixing `slice(0,4)`? YES.

**None of the 42 depends on field 4 of a `|move|` line.** Checked row by row: the only two `|move|` rows
in the narration set are the Protect ties, which differ in field 2 (who moved), not in the target field.
So the whole-game instrument can carry this gate today, unchanged.

**What the gate must DECLARE rather than measure** is the second half of §2.4 — the ~70 of ~84 `mvFail`
sites that write a bare `-fail`. That is silenced twice (`move-target-field` **and** `display-flags`),
it has **no instrument and no known cost**, and it must be a named, counted `NOT_MEASURED` entry in the
gate's output rather than an absence. Widening `slice(0,4)` is a MEASURE decision about what the
instrument counts; it is not on this gate's critical path.

---

## 9. OWED, NOT RUN, AND NOT MINE THIS PASS

```
node tests/test-mechanics.js                 NOT run — another agent owns it this window
node engine/status.js  /  --write            NOT run — another agent owns MEASURE's tree
tools\lownode.cmd engine\game_differential.js NOT run — would void two live measurements
node tests/roster.js                         NOT run
```

- **`docs/ENGINE.md`'s hand list was NOT edited.** The brief restricts this pass to one file, and the
  standing ENGINE rule to prune the hand list applies to the batch that lands the probes, not to this
  derivation. Nothing here became a probe, so nothing has earned removal yet.
- **No census movement is claimed and none occurred.** No engine file was written.
- **Two things named for the fixer that are not mine to touch:** `engine/game_differential.js` (holds
  both silencers) and `engine/board_state.js` (where `move_result_state.js` still is not wired — the
  announce-failure session's OWED item 4).
- **One item for MEASURE, not ENGINE:** `docs/_reports/2026-08-23-board-materiality.md` files three
  Protect orderings as NOT A DEFECT on the reasoning that an exact speed tie has no right answer. That
  filing predates my reading of `game_differential.js:1229-1257`, which says the tie was fixed at the
  root in 3.74.0. The filing may still be correct; **it is no longer supported by the reason given**,
  and §5 names the command that settles it.
