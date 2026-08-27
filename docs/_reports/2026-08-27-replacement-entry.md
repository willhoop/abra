# Faint replacements — one batched entry event, and the corpse's RAW speed decides the order

2026-08-27, ENGINE. Release `6a845424c450`. Probe: `tests/probe_replacement_entry.js`.
Register: ROADMAP **#481**. CHANGELOG 5.169.0.

---

## LEAD — WHICH ORDERING RULE IS ACTUALLY TRUE

**The announcement order of two simultaneous faint replacements is the OUTGOING corpse's RAW STORED
SPEED: boosts zeroed, and NO speed modifier applied at all — no Choice Scarf, no Tailwind, no
weather-speed ability, no paralysis. Trick Room still inverts it.**

That is neither of the two readings this project has already refuted, and it explains why both of them
failed:

| reading | status | why it failed |
|---|---|---|
| the INCOMING body's speed | refuted earlier | correct — `Side#chooseSwitch` builds `{choice:'instaswitch', pokemon: the FAINTED active, target: the bench body}` (`sim/side.ts:1007-1011`) and `getActionSpeed(action)` reads `action.pokemon` (`sim/battle.ts:2652-2657`). The incoming body is `action.target` and is never consulted. |
| the OUTGOING body's ACTION SPEED | refuted later, on a real board | **the right BODY, the wrong NUMBER.** The observer computed a modified speed; the authority does not. |
| *"behaves as if the two switch actions tie"* | the symptom, not the rule | what a modified-speed expectation looks like when the authority has dropped the modifier. |

### The mechanism, read from the code

`faintMessages()` runs, in this order, **before the switch request is ever issued**
(`sim/battle.ts:2560-2562`, request at `:2907-2911`):

```js
pokemon.clearVolatile(false);   // zeroes pokemon.boosts
pokemon.fainted  = true;
pokemon.isActive = false;       // <-- this is the one nobody had
```

`getActionSpeed()` is `getStat('spe', false, false)`, whose last step is
`runEvent('ModifySpe', this, ...)`. `findEventHandlers` opens with:

```js
if (target instanceof Pokemon && (target.isActive || source?.isActive)) {
    handlers = this.findPokemonEventHandlers(target, `on${eventName}`);
    ...
    target = target.side;          // ONLY reassigned inside this block
}
...
if (target instanceof Side) { /* side conditions — Tailwind lives here */ }
```
(`sim/battle.ts:1053-1067`)

For a corpse the guard is **false**, `target` is never promoted to the Side, and the `instanceof Side`
block below it therefore never runs either. **`runEvent('ModifySpe', corpse)` collects ZERO handlers.**
Item, ability, side condition and status all vanish together. `getStat` returns `storedStats.spe`
untouched.

Trick Room survives because `getActionSpeed` reads
`this.battle.field.getPseudoWeather('trickroom')` **directly**, not through an event.

**A voluntary switch is a different action and is NOT affected** — that body is still `isActive` when
`getActionSpeed` is called, so its Scarf and its Tailwind do count. That is the `switch` action
(order 103); this is `instaswitch` (order 3). The engine's `effSpeed` is the right read there and was
left alone.

### The measurement, made before a line was written

One fixture played twice; the side-speed doubler is the only knob. Corpses at raw base Spe 30 (side A,
which gets the doubler) and 35 (side B).

| arm | showdown's `\|switch\|` order | showdown's ENTRY order |
|---|---|---|
| plain | p2a (35) then p1a (30) | p2a then p1a |
| doubled (30 x2 = 60) | **p2a (35) then p1a (30) — unmoved** | **p1a then p2a — moved** |

The second column is the finding. The third is its control: the doubler *did* reach the battle (the
arriving bodies are still active and their entry handlers do take it), so an instrument that saw
nothing move anywhere is ruled out. Both are asserted in the probe.

---

## THE OTHER HALF — BATCHING

`BattleActions#switchIn` writes the `|switch|` line and only QUEUES `{choice:'runSwitch'}`
(`sim/battle-actions.ts:155-158`). `runSwitch` DRAINS every consecutive `runSwitch` off the queue head
into one list and fires a SINGLE `fieldEvent('SwitchIn', switchersIn)` (`:172-186`). Hazards are inside
that event — `stealthrock.condition.onSwitchIn` is a SIDE CONDITION handler collected by
`findSideEventHandlers(side,'onSwitchIn',undefined,active)`, and Healing Wish is a SLOT condition
collected by `findPokemonEventHandlers` (`sim/battle.ts:494-505`). **Neither can fire between two
`|switch|` lines.**

medicham2 fired both at the PLACEMENT, above `bringIn`'s `deferEntry` return. The 2026-08-12 batching
moved the ABILITIES into `refill()`'s ordered walk and left these two behind.

**It is board-material by construction, not narration.** The authority's own comment at
`sim/battle.ts:517` names the case — *"effect may have been removed by a prior handler, i.e. Toxic
Spikes being absorbed during a double switch"*. Two bodies arriving together share ONE sorted handler
list, so which of them absorbs the Toxic Spikes layer, and which is standing under the rocks at what
HP, is decided by that list rather than by the order the bodies were placed in.

---

## THE FIX

`engine/medicham2-browser.js` only. Nothing else in `engine/` moved.

1. **`applyEntryConditions(nx,sf,i,field)`** — the Healing Wish slot-condition block and the hazard
   block, lifted out of `bringIn()` **byte-for-byte**, comments and all. `bringIn` calls it inline for
   every caller that does not defer (unchanged), and hands `sf` to the deferring caller instead.
   `runEntryPass(nx,foes,act,i,field,sf)` runs it first when `sf` is present. `refill()` is the one
   deferring caller.
2. **`_refills`' sort key** is now `m.st.sp` — the built stat, i.e. `storedStats.spe` — instead of
   `effSpeed(...)`. `compareTurnOrder` is still the comparator, so Trick Room still inverts.

Knobs, each shown to move its own arm: `MEDI_ENTRY_HAZARD_INLINE=1`, `MEDI_REPLACE_SPEED_MODIFIED=1`.
Counters: `MEDFAILS.entryHazardInlineRestored`, `MEDFAILS.replaceSpeedModifiedRestored`.

---

## WHICH SCOREBOARD, SAID BEFORE THE RUN

Predicted: the **pool moves** (all three target cards are pinned-pool games), the **census sits still**
(no census row governs replacement ordering), **board-material does not fall** and **may rise** if the
mechanism becomes visible, **damage does not move**.

| | before | after |
|---|---|---|
| whole-game clause (played, less declared) | **9 of 961** | **6 of 961** |
| raw diverged games | 14 | **11** |
| `ordering` class | 6 games | **3 games** |
| board-material (`games - games_board_never_diverged`) | 1 of 961 | **1 of 961** |
| census | 754 live / 754 probed / 0 missing | **754 / 754 / 0** |
| roster items / abilities / moves | 0 DIFFER, 0 DID-NOT-FIRE | **0 DIFFER, 0 DID-NOT-FIRE** |
| damage, `--n 6000` at sixteen corners | 0 of 6000 | **0 of 6000** |
| mechanics clause | 5 of 12 | **5 of 12** |

Every prediction held. Board-material did not rise, so the three games really were narration-only on
these boards — which does not make the mechanism narration, only these three samples.

### The three cards that closed

```
ordering :: |switch|p1b|garganacl,l50|H/H <> |-damage|p2a|H/H|[from]stealthrock   (batching)
ordering :: |switch|p1a|garchomp,l50|H/H  <> |switch|p2b|blastoise,l50|H/H        (ordering)
ordering :: |switch|p1a|staraptor,l50|H/H <> |switch|p2a|incineroar,l50|H/H       (ordering)
```

The third is the one whose corpses are `p1a Gengar` (Gengarite, Timid) against `p2a Dragapult`
(**Choice Scarf**, Jolly). The Scarf is exactly the modifier the authority drops, which is what
produced the earlier *"a faster body still moved second"* reading.

---

## WHAT DID NOT MOVE, NAMED RATHER THAN LEFT TO BE FOUND

- **Three more emissions still land at the placement**, so on a double replacement they still sit
  between the two `|switch|` lines where the authority has them inside the same `SwitchIn` event: the
  Zero to Hero `-activate`, the Supreme Overlord `-activate`/`-start`, and the Magic Room item park.
  No card in the pinned pool lands on any of them and no probe fails on them. On the hand list.
- **`_refills` still uses `Array.prototype.sort`.** The authority's `queue.sort()` is `speedSort` — a
  SELECTION SORT whose swaps move untied elements past a tied pair, followed by `prng.shuffle` on the
  tie. This is the FIFTH speed-sort site in this engine and the only one WIRE 134 never reached (the
  move queue, the entry pass, the mega phase and the residual walk all have it). It can only differ
  when three or more bodies replace at once AND two of them tie on raw speed;
  `MEDFAILS.replaceOrderTie` already counts the tie population. Not fixed here — a batch of one.
- **`test-middle-identity.js` is RED and is not this change.** Its one failing clause is
  `game_differential.js CAPTURES the battle in the BattleActions wrapper`, which is ROADMAP #262's
  open authority half, in a file this change does not touch and this division does not own.
- **`test-resolution-order.js` needs `--max-old-space-size`** at node's default heap. Already known
  and already handled — `tests/run-all.js:534` gives it a heap explicitly. It PASSES at 6144 MB.

---

## OWED, NOT RUN

Nothing. Damage differential re-run in full (0 of 6000 at all sixteen corners), all three roster
stages re-run with `--write` on the new release, `all_mechanics_fire --kind all --write` re-run, the
pinned 961-game differential re-run with the census pin and the frozen team store, census regenerated.
