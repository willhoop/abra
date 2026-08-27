# The three `<> |upkeep` rows — diagnosis only, nothing applied

2026-08-27. ENGINE, diagnostic pass. **No file under `engine/` was touched.** The only file written
besides this one is `tests/probe_upkeep_lines.js`.

Artifact read: `git show HEAD:data/game-differential.json` (HEAD `6f58787d`, generated
2026-08-27T22:47:24Z, release `a4b2832e0a0f`, 961 games, 11 diverged, 8 in `event missing from
medicham2`). The on-disk copy is byte-identical modulo CRLF and was 15 minutes settled when read.
**The brief's "whole-game 6 of 961" is a NEWER number than this artifact carries; the three rows
below are quoted from the artifact, not from the brief.**

---

## THE CLASSIFIER, FIRST — WHICH SIDE IS WHOSE

`engine/game_differential.js`, `classify()`:

```js
const sdHead = sdAt[0], meHead = meAt[0];
...
else if (meLater)  { cls = 'event missing from medicham2'; detail = sdEv; }
...
const gen = s => String(s).replace(/(p[12][ab]):[^|]*/g, '$1').replace(/\d+\/\d+/g, 'H/H');
const ga = gen(sdHead), gb = gen(meHead);
return { cls, detail, cause: cls + ' :: ' + ga + ' <> ' + gb + raw };
```

**`cause` is `<class> :: <SHOWDOWN'S line> <> <MEDICHAM2'S line>`.** The left is always the
authority. The artifact's per-row record carries the same two under explicit `showdown` /
`medicham` keys, which is the second confirmation.

So the class name reads in *opposite directions* across these three rows:

| row | showdown emits | medicham2 emits | reading |
|---|---|---|---|
| hitcount | `\|-hitcount\|p2a\|1` | `\|upkeep` | **we omit a line** |
| trap | `\|-end\|p2a\|infestation\|[partiallytrapped]` | `\|upkeep` | **we omit a line** |
| perish | `\|upkeep` | `\|faint\|p2b` | **we emit the faint EARLY** |

The third is not "a line missing from medicham2" in any useful sense — it is an ORDERING, filed
under that class only because showdown's `|upkeep` does not reappear inside the 10-line lookahead.

---

## ROW 3 — `|-hitcount|p2a|1 <> |upkeep`   **CONFIRMED. ENGINE DEFECT. NARRATION-ONLY.**

### The authority

Champions overrides the whole hit loop — `data/mods/champions/scripts.ts:425` `hitStepMoveHitLoop`,
read whole (the comment above it is *"Parental Bond shouldn't announce hit count if it only hits
once"*). Its close:

```ts
// hit is 1 higher than the actual hit count
if (hit === 1) return damage.fill(false);
if (nullDamage) damage.fill(false);
this.battle.faintMessages(false, false, !pokemon.hp);
if (move.multihit && typeof move.smartTarget !== 'boolean' &&
    !(move.hit === 1 && move.multihitType === 'parentalbond')) {
    this.battle.add('-hitcount', targets[0], hit - 1);
}
```

and the per-hit accuracy break, same file, inside the loop:

```ts
if (target && move.multiaccuracy && hit > 1) { ...
    if (accuracy !== true && !this.battle.randomChance(accuracy, 100)) break;
}
```

So a multiaccuracy volley whose SECOND roll misses leaves `hit === 2` and the authority prints
`|-hitcount|TARGET|1`. Only a volley that landed **zero** arrivals returns above the line.

### What medicham2 does

`_stepApply`, `engine/medicham2-browser.js`:

```js
const _packets=(R.pk&&R.pk.length>1&&dmg===R.dmg)?R.pk:null;
if(!_packets&&R.pk&&R.pk.length>1)MEDSEEN.multiHitPacketsCollapsed++;
let _landed=0;
if(_packets){ ...  tg.curHP-=_packets[i];_landed++; ...
  if(R.hitcount&&_landed>0)R.hitLanded=_landed;
}else{ tg.curHP-=dmg; ... }
```

and the announcement:

```js
const _stepHitCount=(R)=>{ if(!R.hitLanded)return; ... if(TR)TR.hitcount(R.tg,R.hitLanded); ... };
```

**`_landed` only exists on the packet road, and the packet road requires `R.pk.length > 1`.** A
volley that resolved to exactly ONE arrival never enters it, `R.hitLanded` is never written, and
`_stepHitCount` returns at its first line. The count itself is drawn correctly — `rollHitsOf`
implements the per-hit break at `if(rnd()>=_p){n=h-1;MEDSEEN.multiHitAccuracyStopped++;break;}` — so
this is purely the announcement.

### The measurement

`tests/probe_upkeep_lines.js --only hitcount`, release `a4b2832e0a0f`, team store pinned to
`data/team-pool-frozen`. Move DERIVED as the `multiHit + multiAccuracy` member with the most hits
(Population Bomb, 10 hits at 90%); attacker derived as its fastest legal carrier; three idle bodies
with pairwise-distinct base Speed so nothing in the fixture is decided by a tie.

```
A TEST     real per-hit dice (middle arm)          -> *** PARTS *** at reduced index 35
      showdown -hitcount: 1 x1  10 x1
      medicham -hitcount:       10 x1
      SD  |-hitcount|p2a: Clefable|1
      US  |upkeep
B CONTROL  bottom corner, every sub-100 roll HITS  -> AGREES
      showdown -hitcount: 10 x12
      medicham -hitcount: 10 x12
```

The parted line is byte-identical in shape to the pool row. The control moves exactly one knob —
the dice — and the counter is demonstrably wired (12 matched `10` lines), so the TEST arm is not a
dead instrument.

### Missing or ordering?

**MISSING.** medicham2's whole stream contains no `|-hitcount|…|1` at all; the control proves it
emits the event when the packet road is taken.

### Board leaf?

**Narration-only, and this was checked rather than inherited.** `-hitcount` writes no state in
either engine. The other reader of the same number is already correct through a separate expression:

```js
const _arrivals=_packets?_landed:1;
if(_arrivals>0){tg._timesAttacked=((tg._timesAttacked)|0)+_arrivals; ...}
```

so Rage Fist's counter gets its +1 on the single-packet road. The HP subtraction is `tg.curHP-=dmg`
with the full drawn total. Nothing but the line is wrong.

### Relation to ROADMAP #499 (crit per arrival)

This **predates** it and is untouched by it. #499 changed which crit boolean each arrival reads
(`R.crits[i]` vs `R.crit`) *inside* the packet loop; the packet loop is exactly the road this defect
never reaches. `skipped_multihit = 134` in the damage instrument is a different exclusion (the
damage-interior measurement declines to price multi-hit) and does not bear on the count line.

### THE PATCH, NOT APPLIED

`engine/medicham2-browser.js`, function `_stepApply` (the `else` branch of the `_packets` test, the
one beginning `}else{ tg.curHP-=dmg;`). Add, beside the existing `_timesAttacked` expression so the
two readers of "how many arrivals landed" stay one fact:

```js
}else{ tg.curHP-=dmg;
  ...
  /* THE SINGLE-ARRIVAL VOLLEY STILL GETS ITS LINE. scripts.ts:541 returns above `-hitcount` only
   * when hit === 1, i.e. when NOTHING landed; one arrival prints `|-hitcount|TARGET|1`. Guarded on
   * `R.pk` so the COLLAPSE road below is not given a wrong count. */
  if(R.hitcount&&!(R.pk&&R.pk.length>1))R.hitLanded=1;
}
```

`R.hitcount` is already `hitcountable && !smartTarget`, so a plain single-hit move cannot reach it.

**A SECOND PRODUCER OF THE SAME SYMPTOM IS LEFT OPEN DELIBERATELY, AND IT IS CURRENTLY SILENT.**
When `R.pk.length > 1` but `dmg !== R.dmg` — a Focus Sash, an Endure, a busted Disguise, a hit
through Protect — the volley collapses to one packet, `MEDSEEN.multiHitPacketsCollapsed` is bumped,
`_landed` stays 0 and **no `-hitcount` is emitted either**, though the authority landed 2+ arrivals
and prints the real count. The guard above deliberately does not paper over it with a `1`. It needs
its own fixture and its own measurement; a `MEDFAILS.hitCountDroppedOnCollapse` counter at that
line would make it loud in the meantime. **Not measured in this pass — see OWED.**

---

## ROW 2 — `|-end|p2a|infestation|[partiallytrapped] <> |upkeep`   **CONFIRMED. ENGINE DEFECT. NARRATION-ONLY.**

### The authority

`data/conditions.ts:222-248`, `partiallytrapped`, read whole. **Champions does not override it** —
`data/mods/champions/conditions.ts` carries no `partiallytrapped` key.

```ts
onResidualOrder: 13,
onResidual(pokemon) {
  const source = this.effectState.source;
  const gmaxEffect = ['gmaxcentiferno','gmaxsandblast'].includes(this.effectState.sourceEffect.id);
  if (source && (!source.isActive || source.hp <= 0 || !source.activeTurns) && !gmaxEffect) {
    delete pokemon.volatiles['partiallytrapped'];
    this.add('-end', pokemon, this.effectState.sourceEffect, '[partiallytrapped]', '[silent]');
    return;
  }
  this.damage(pokemon.baseMaxhp / this.effectState.boundDivisor);
},
onEnd(pokemon) { this.add('-end', pokemon, this.effectState.sourceEffect, '[partiallytrapped]'); }
```

Note it is a `delete`, not `removeVolatile`, so `onEnd` does **not** fire — the source-gone line is
written inline and carries `[silent]`.

### What medicham2 does

`engine/medicham2-browser.js`, the `trap` residual group:

```js
if(_G.has('trap')&&m._trap&&m.curHP>0){
  const _by=m._trap.by;
  if(_by&&(_by.fainted||_by.curHP<=0||(actA.indexOf(_by)<0&&actB.indexOf(_by)<0))){m._trap=null;}
  else{ ...chip... 
    if(--m._trap.turns<=0){const _tmv=m._trap.mv;m._trap=null;
      if(TR)TR.vend(m,_tmv||'partiallytrapped',_tmv?'[partiallytrapped]':'');}
    ...
  }
}
```

**The state is right and the announcement is owed.** The source-gone branch clears `m._trap` with no
trace call at all; the duration-expiry branch, three lines below, already emits the correct line.
`[silent]` costs nothing here — `game_differential.js:2023-2027` strips `[silent] [still] [miss]
[spread] [anim]` before comparing — so the existing three-argument `TR.vend` matches exactly.

### The measurement

`tests/probe_upkeep_lines.js --only trap`. **Every** `partialTrap` move with a legal carrier is
staged, derived from the tag, not chosen by hand. Turn 1 the trapper lands it; turn 2 the trapper
switches out; the divergence lands at that turn's residual. The control is the same board with the
trapper staying in. Every arm also prints the authority's own staging receipt
(`|-activate|TARGET|move: NAME`), so an AGREES with nothing staged cannot be read as a pass.

```
A TEST  bind        -> PARTS   SD |-end|p2a: Clefable|Bind|[partiallytrapped]|[silent]        US |upkeep
A TEST  firespin    -> PARTS   SD |-end|p2a: Clefable|Fire Spin|[partiallytrapped]|[silent]   US |upkeep
A TEST  infestation -> PARTS   SD |-end|p2a: Clefable|Infestation|[partiallytrapped]|[silent] US |upkeep
A TEST  snaptrap    -> PARTS   SD |-end|p2a: Clefable|Snap Trap|[partiallytrapped]|[silent]   US |upkeep
A TEST  whirlpool   -> PARTS   SD |-end|p2a: Clefable|Whirlpool|[partiallytrapped]|[silent]   US |upkeep
A TEST  wrap        -> PARTS   SD |-end|p2a: Clefable|Wrap|[partiallytrapped]|[silent]        US |upkeep
A TEST  sandtomb    -> PARTS   SD |-end|p2a: Arcanine|Sand Tomb|[partiallytrapped]|[silent]   US |upkeep
B CONTROL (all seven, trapper stays in) -> AGREES, no -end in either stream
```

**Seven of seven**, each with the authority's staging receipt printed (`trap landed in the
authority: yes`) and each control AGREEING. The `infestation` line is the pool row verbatim.

*(An earlier run of this arm read `sandtomb -> AGREES`. That was the receipt regex anchoring on `$`
against a line that ends `|[of] SOURCE`, so a staged arm was being reported as unstaged and then as
a pass. Fixed in the probe and noted here rather than quietly corrected — a control that reports
success for the wrong reason is the failure this file is about.)*

### Missing or ordering?

**MISSING.** The line appears nowhere in medicham2's stream for the whole game; the control shows
the residual chip and the ordinary expiry are both fine.

### Board leaf?

**Narration-only.** `m._trap = null` is the same state change the authority makes, at the same
residual order (13), and the differential's board comparison had nothing to say about it — the
controls agree on every HP line either side of it. Switch legality is therefore also correct.

### THE PATCH, NOT APPLIED

`engine/medicham2-browser.js`, the `trap` residual group, the source-gone branch:

```js
/* WIRE 105 -- and it ANNOUNCES. `partiallytrapped.onResidual` deletes the volatile AND writes
 * `add('-end', pokemon, sourceEffect, '[partiallytrapped]', '[silent]')` (data/conditions.ts:239-240)
 * on the same two lines; this engine took the state and left the line. `[silent]` is stripped by the
 * reducer, so the same three-argument call the expiry branch below uses is exact. */
if(_by&&(_by.fainted||_by.curHP<=0||(actA.indexOf(_by)<0&&actB.indexOf(_by)<0))){
  const _tmv=m._trap.mv;m._trap=null;MEDSEEN.trapEndedSourceGone++;
  if(TR)TR.vend(m,_tmv||'partiallytrapped',_tmv?'[partiallytrapped]':'');
}
```

**One thing NOT in this patch, stated rather than folded in:** medicham2's source-gone predicate is
`fainted || curHP<=0 || not-on-the-field`. The authority's is `!source.isActive || source.hp <= 0 ||
!source.activeTurns`. **`!source.activeTurns` has no counterpart here** — a trapper that entered the
field THIS turn ends the trap in Showdown and does not here. Not measured in this pass; it is a
different fixture and belongs in a different batch.

---

## ROW 1 — `|upkeep <> |faint|p2b`   **NOT REPRODUCED. THE OBVIOUS HYPOTHESIS IS REFUTED.**

### The authority

`sim/battle.ts`:

```ts
case 'residual':
  this.add(''); this.clearActiveMove(true); this.updateSpeed();
  residualPokemon = this.getAllActive().map(...);
  this.fieldEvent('Residual');
  if (!this.ended) this.add('upkeep');              // :2814
  break;
...
this.faintMessages();                                // :2832, EIGHTEEN LINES BELOW
```

and inside `fieldEvent` (:484-567), the half that decides everything:

```ts
if (eventid === 'Residual' && handler.end && handler.state?.duration) {
  handler.state.duration--;
  if (!handler.state.duration) { handler.end.call(...); if (this.ended) return; continue; }   // :514-524
}
...
if (handler.callback) { this.singleEvent(...); }
this.faintMessages();                                                                          // :565
if (this.ended) return;
```

`perishsong.condition.onEnd` (`data/moves.ts:13268-13270`, no Champions override) is
`this.add('-start', target, 'perish0'); target.faint();` and `Pokemon#faint()` only QUEUES. A
duration expiry `continue`s past :565, so the perish deaths are paid by **the next handler that does
not itself expire** — and if none exists, by :2832, below `|upkeep|`.

medicham2 models this exactly, with `residualFollowerRuns()` choosing between
`drainFaints('residualClocks')` (above `TR.upkeep()`) and `drainFaints('residualAfterUpkeep')`
(below it). The pool row can only be produced by that predicate returning TRUE where the authority
has no follower.

### The measurement — 33 arms, and the predicate holds on every one

`tests/probe_upkeep_lines.js --only perish`. Doubles, Perish Song from a derived carrier, four
turns to `perish0`, all idle clicks are Agility (no residual footprint), every body pairwise
tie-free on base Speed, and no `battleOnly`/mega forme anywhere on a sheet.

The membership is PRINTED, not assumed — `M.residualFollowerReport()` reads **14 handlers, 26
clocks, 18 always-expire, 0 unmapped**.

```
A TEST   bare board, nothing follows perishsong
   SD  perish0 x4  |upkeep  |faint x4
   US  perish0 x4  |upkeep  |faint x4          <- identical

C follower cudchew / harvest / opportunist / pickup / whiteherb(item)
   SD  perish0 x4  |faint x4  |upkeep
   US  perish0 x4  |faint x4  |upkeep          <- identical, all five

D clock  fairylock gravity magicroom trickroom wonderroom
         auroraveil lightscreen reflect safeguard tailwind
         electric/grassy/misty/psychic terrain
         allyswitch bounce dig dive fly lockon phantomforce
   SD == US on every one of the twenty-two.

E stall  Protect clicked on the kill turn, from a body with someone still to act after it,
         and from the LAST body to act (where `protect.onPrepareHit`'s `!!this.queue.willAct()`
         refuses the shield). SD == US on both.
```

Not one arm put the faint on a different side of `|upkeep|` from the authority. **The
`residualFollowerRuns` over-fire hypothesis is refuted for every family member that can be staged.**

(Whole-file run: **49 arms, 6 not as expected** — the six are the five listed immediately below plus
the bare board, and every one of them parted on something other than the perish/upkeep boundary.)

Five arms did part, and **none of them parted on this mechanic** — in every case the whole
`perish0 / upkeep / faint` window was byte-identical and the split came later or earlier:

| arm | split | what it is |
|---|---|---|
| bare, whiteherb | idx 76, after the window | `\|-unboost\|p1a\|atk\|1 <> \|-unboost\|p2a\|atk\|1` — Intimidate order on a DOUBLE replacement after a 4-way wipe. Not this row. |
| uproar | idx 63, inside the perish group | `\|-start\|p1a\|perish0 <> \|-start\|p2a\|Uproar\|[upkeep]` — we emit Uproar's residual re-announce (order 28) between two perish0 lines (order 24). A residual-ORDER defect, almost certainly the `perish-vs-speedboost` KNOWN-OPEN arm of `probe_endturn_clock_order.js` in another costume. |
| speedboost, moody, hungerswitch | idx 19, four turns early | the same end-turn clock-order family the engine already documents at `medicham2-browser.js:6429` (`-perish-counter`, `Disable`- and `Taunt`-against-Speed-Boost). Fixture never reached perish0; reported NOT-STAGED. |

### Was the pool game replayable?

No, and the tool said so rather than guessing. `engine/replay_one.js --release a4b2832e0a0f
--team-store data/team-pool-frozen --games 1200 --config baseline --seed "…2654016071 vs
…2654363031"` printed **`*** NOT REPRODUCED — THIS IS A DIFFERENT GAME FROM THE ONE IN THE
ARTIFACT ***`**: the census has moved (digest `0e2506b1e0c5`, 765 rows, regenerated 22:21) and the
pool resolves to a different pairing, so the driver clicked something else. At `--games 961` the
seed is not in the pool at all (105 baseline pairs). **A replay that does not match is not the
game**, so nothing was read off it.

### Missing or ordering? Board leaf?

**Ordering, on the evidence available**, and the answer to "does it write a board leaf" is the one
that matters here: **a faint IS board-material, but the ORDER of `|faint|` against `|upkeep|` is
not** — no state changes between :2814 and :2832 in either engine, the bodies are already dead on
both sides of the line, and `_wipedAtResidual` / `faintQueueOwed()` are read before either. The
consequence of the pool row is a divergence in the NARRATION of a turn whose end state is the same.
That is a claim about this row's shape, not a general licence.

### THE PATCH, NOT APPLIED

**There is none to propose, and proposing one would be the failure this file exists to avoid.** The
bare board is right, every stageable follower is right, and a change to `residualFollowerRuns` that
made the pool row go away would break 33 arms that currently pass. Three things are genuinely open
and each is a fixture problem rather than a code one:

1. **Three clock readers were never exercised**: `volatile:mustrecharge` (`m._recharge`),
   `volatile:lockedmove` (`m._mtLock`, non-Uproar) and `volatile:stall`'s *second* turn. The probe
   prints them as UNSWEPT rather than passing over them. `_mtLock` is exercised by the Uproar arm.
2. **`RESIDUAL_AFTER_PERISH` treats `r.order === null` as "sorts last, therefore follows"**, which
   is `comparePriority`'s substitution of 4294967296 and is correct — but it is the one clause that
   admits a member with no residual handler at all. Printing the null-order members by name would
   settle it in one line.
3. **The pool row may already be gone.** The brief's state (`whole-game 6 of 961`) is newer than the
   artifact this row was read from, and other agents have landed fixes tonight.

---

## OWED, NOT RUN

None of the following was run by this pass. All of them are cheap.

```bash
# 1. the three arms, as they stand tonight (~40 s, one process, no artifact written)
node tests/probe_upkeep_lines.js --release a4b2832e0a0f --team-store data/team-pool-frozen
node tests/probe_upkeep_lines.js --release a4b2832e0a0f --team-store data/team-pool-frozen --only hitcount
node tests/probe_upkeep_lines.js --release a4b2832e0a0f --team-store data/team-pool-frozen --only trap
node tests/probe_upkeep_lines.js --release a4b2832e0a0f --team-store data/team-pool-frozen --only perish

# 2. AFTER either patch: the same probe must flip A TEST to AGREES and leave every CONTROL alone.
#    A run in which a control also moves is a fix that changed something else.

# 3. the pool scoreboard. SAY WHICH ONE SHOULD MOVE BEFORE RUNNING IT:
#      - the trap `-end`  : partial traps are rare in the pinned pool; expect the LAB to move and the
#                           pool to sit still. Do not read a flat pool as a failed fix.
#      - the hitcount     : Population Bomb + Triple Axel are 926 corpus uses between them, and the
#                           row is IN the pinned pool, so this one should move the pool by one game.
tools\lownode.cmd engine\game_differential.js --release <new id> --team-store data/team-pool-frozen \
    --games 1200 --arm middle          # ~minutes. NOT for this agent; MEASURE's call.

# 4. the second producer named under ROW 3, currently silent:
#    a multi-hit into a Focus Sash / Endure / Disguise collapses the packets and drops `-hitcount`
#    entirely. Read the counter that already exists before building a fixture:
node -e "const M=require('./engine/medicham2-browser.js'); console.log(M.seen.multiHitPacketsCollapsed)"
#    then stage it as a fourth arm of probe_upkeep_lines.js.

# 5. the unmeasured half of the trap predicate: Showdown ends the trap when `!source.activeTurns`,
#    i.e. when the trapper entered THIS turn. Stage: trap lands, trapper switches out, trapper
#    switches back in on the turn of the next residual.

# 6. the two incidental rows this pass surfaced and did NOT own:
#      uproar@28 emitted between two perish0 lines  (probe_endturn_clock_order.js, KNOWN-OPEN arm)
#      Intimidate order on a double replacement      (probe_replacement_entry.js)
```

## FILES

- `C:\Users\willj\Projects\Pokemon\ABRA\tests\probe_upkeep_lines.js` — new, three arms plus controls.
  Not registered in `tests/run-all.js`; it is a probe, not a gate.
- `C:\Users\willj\Projects\Pokemon\ABRA\docs\_reports\2026-08-27-upkeep-lines.md` — this file.
