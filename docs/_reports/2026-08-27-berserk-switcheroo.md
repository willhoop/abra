# Berserk's boost order and Switcheroo's activate line — DIAGNOSIS ONLY, NOTHING FIXED

Dated findings record. Not a living document, not current state, superseded by whatever register row
it feeds. No byte under `engine/` was edited.

- **Probe:** `C:\Users\willj\Projects\Pokemon\ABRA\tests\probe_berserk_switcheroo.js` (new, exits 0)
- **Full output:** `C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\6e93c397-51cb-4089-996b-51fc61c6e7c7\scratchpad\bsk-full.out`
- **HEAD when run:** `0e4f0a80`. Releases redirected to a temp store by `tests/_live_release.js`, so the
  live release pointer and `data/releases/` were untouched. Team store pinned to `data/team-pool-frozen`.
- **The state block I was handed is already stale.** It said census 765; the run read **766 rows,
  digest `483d3ec020d2`** (was `6cb72af79e3b`/765 at the start of my session). Another agent landed a
  mechanic while I worked. Nothing here depends on it — every board below is hand-staged, and the
  census only steers the driver's team sampling, which no arm of this probe uses.

---

## A — BERSERK

### A0. THE LEAF IS COMPARABLE. THE SCOUT'S CAVEAT IS REFUTED.

The scout read `end_reason: "THREW"` on both arms as "the comparison produced nothing". That is a
misreading of the field: `end_reason` is the reason the WALK ended, recorded after the boards were
already taken. The same artifact row records `boundaries: 4`, `boundaries_agreed: 4`,
`boards_after_the_parting: 3`, `leaves_compared_min: 369`. Four boards were compared, three of them
at or after the turn the protocol parted.

That is the artifact arguing for itself, which is not enough — a leaf you cannot compare reads as
agreement. So it was demonstrated:

**RED PLANT.** On a staged board (`Crabominable` Icicle Spear into a Berserk `Drampa`, hpBoost x3,
carrier holding with Amnesia), the carrier's LIVE medicham `boosts.sa` was corrupted `1 -> 4` at
boundary 1 — the first boundary at or after the parting — and `board_state.js` caught it on two paths:

```
p1.active[0].boosts.spa      us 4   sd 1   bucket off-by-2-or-3
p1.party.drampa.boosts.spa   us 4   sd 1   bucket off-by-2-or-3
```

Two things follow, and the second is the useful one:

1. The SpA stage — **the exact leaf this mechanic writes** — is a compared leaf. An
   ANNOUNCEMENT-ONLY verdict on this row is earned.
2. The plant reports `sd: 1`, and our pre-plant value was `1`. **Both engines held Berserk's +1 at
   that boundary.** The mechanic fires, once, identically, on both sides.

### A1. THE DIVERGENCE IS REAL AND CURRENT, AND IT PARTS FOR EXACTLY ONE REASON

Reproduced at HEAD `0e4f0a80`:

```
showdown    -hitcount@14   -ability@15   -boost@16     HITCOUNT FIRST
medicham2   -ability@13    -boost@14     -hitcount@15  BOOST FIRST
```

The driver's own first divergence: `ordering — -boost before -hitcount`,
cause `ordering :: |-hitcount|p1a|5 <> |-boost|p1a|spa|1`.

**One reason, decided in the comparator's own vocabulary rather than mine.** `div.sdAfter` /
`div.meAfter` are the streams AFTER `reduce()` has applied every declared EQUIV rule. Over the common
prefix (5 lines — the driver stops our stream at the divergent board, so the windows are 6 and 5) the
multiset diff is **empty in both directions**: the two windows are an exact permutation. Only the
order of `-hitcount` and `-boost` differs.

> **My first cut of this check was wrong and said the opposite.** It diffed the raw 10-line windows,
> found `|turn|2` only on showdown's side, and printed *"MORE THAN ONE REASON — this fixture proves
> nothing"*. That was the WINDOW, not the game. Corrected to the common prefix; the correction is in
> the probe with the reason written at the line.

The raw unreduced residual is `|-ability|p1b|pressure` (rule `ability-announcement`,
`engine/game_differential.js:1990`) and `icicle spear` vs `iciclespear` (folded by the engine's own
`traceCanon`). Both are declared, neither is a second defect.

### A2. THE AUTHORITY'S POSITION, CITED

Champions **does** override the containing function — `hitStepMoveHitLoop`,
`data/mods/champions/scripts.ts:428` — and inside it:

```
data/mods/champions/scripts.ts:547   this.battle.faintMessages(false, false, !pokemon.hp);
                             :550     this.battle.add('-hitcount', targets[0], hit - 1);
                             :554   if (move.totalDamage) this.applyRecoilDamage(...);
                             :563-568 target.gotAttacked(...); target.timesAttacked += hit - 1;
                             :575   this.battle.eachEvent('Update');
                             :577   this.afterMoveSecondaryEvent(targetsCopy.filter(...), pokemon, move);
```

Champions **also** overrides Berserk (`data/mods/champions/abilities.ts:8-13`) but only the `onDamage`
bookkeeping line; the boost is inherited from `data/abilities.ts:420-428`, on
`onAfterMoveSecondary`. So the authority's `-hitcount` sits **27 lines and four statements above** the
boost. Mainline agrees (`sim/battle-actions.ts:978` and `:1005`), so this is not a Champions quirk.

### A3. WHERE OURS COMES FROM

`_hpThresholdBoost` is defined inside `_damagingHit` and called at the close of it
(`engine/medicham2-browser.js`, anchor `function _hpThresholdBoost(){` and the bare
`_hpThresholdBoost();` two dozen lines below — ~29422 and ~29442 at HEAD, but **the file is live under
another agent, so locate by anchor**). `_damagingHit` is run by `_stepDamagingHit`, which is **step 12
of 19** in `_STEPS`. `_stepHitCount` is **step 19, the last**. That is the whole of it.

**Neither multi-hit fix moved this, and neither could have.** The per-arrival crit (#499) changes which
die is drawn; the single-arrival announcement (`R.hitLanded = 1`) adds a line that was absent. Neither
touches `_stepHitCount`'s position in the list or `_hpThresholdBoost`'s call site. Reproduced at HEAD
with both landed.

**The comment at the call site is now stale on its own justification.** It says the call sits there
"BEFORE the attacker's own Scale Shot self-drops — which is why the call sits here, at the close of the
damage step, rather than at the foot of the action." That constraint was real when written and is no
longer binding: `selfBoost` moved on 2026-08-24 to below the whole step list (the `_sb2 =
selfBoostVia(a.move.id)` block, ~31169), matching `battle-actions.ts:520`. Scale Shot carries
`selfBoost` (`data/moves.ts:15774`, field at :15784), so **any** position inside `_STEPS` is above it.

### A4. BOARD-MATERIAL OR NARRATION — NARRATION, WITH THE BOUND STATED

Narration. Evidence, not inheritance:

- the SpA leaf is proven compared (A0), and both engines read `+1` at the boundary;
- the two reduced windows are an exact permutation (A1);
- the artifact's own row: 4 boundaries, 4 agreed, 402 leaves max, `uncomparable_leaves: []`,
  `core_leaf_unchecked: false`.

**And the bound, because "it's just a message" is a guess and this is not.** `boostsAtHPThreshold` has
exactly **one** member in this format — `berserk`, 61 sheets — printed by the probe, and exactly **two**
carriers, `Drampa` and `Drampa-Mega`. Its only effect is `{spa: +1}`, a POSITIVE stage. The one item
that reads a boost stage in this window is White Herb, and every one of its hooks tests `< 0`
(`data/items.ts:7654` block, and the Champions override at `data/mods/champions/items.ts:1023` only
reschedules `onAnyAfterMove` — read in full, both files). Nothing else between our position and the
authority's reads a stat stage. So for the sole legal member, moving the boost across `-hitcount`
cannot change a compared leaf.

Anger Shell — the other member of this shape, whose vector *does* carry negatives and *would* interact
with White Herb — has no legal carrier here, which the probe's membership print confirms rather than
assumes.

### A5. THE #511 INTERACTION — ASKED, AND THE ANSWER IS TWO-PART

`hitCountDroppedOnCollapse` names three producers: a Focus Sash, an Endure, a busted Disguise. Both
reachable ones were staged.

**Focus Sash: UNREACHABLE, and this refutes the obvious fixture.** A Sash needs `target.hp ===
target.maxhp`, and hit 1 of a volley takes the body off full — so the item never fires against a
multi-hit at all. Staged: the authority did NOT spend the item, the carrier died, and **both engines
emitted `|-hitcount|p1|5` over the corpse with `NO DIVERGENCE in the whole game`**. (Note the `p1:`
corpse form on both sides — the `faintMessages`-then-`-hitcount` fix is holding.)

**Endure: THE TWO DEFECTS MEET, and the board is far worse than #511 describes.** Drampa learns Endure;
Disguise belongs to a different species entirely, so Endure is the only route by which a
`boostsAtHPThreshold` carrier can survive a collapse. Staged:

```
showdown            medicham2
-damage 91/153      -activate move: endure
-damage 29/153      -damage 1/153
-activate endure    -ability berserk|boost
-damage 1/153       -boost spa|1
-activate endure
-damage 1/153
-activate endure
-damage 1/153
-hitcount 5
-ability berserk|boost
-boost spa|1
```

Our engine **collapsed a five-arrival volley into one packet.** The driver's first divergence is
`event missing from medicham2 :: -supereffective` — four whole arrivals upstream of the hit count. The
missing `-hitcount` there is a downstream symptom of that collapse, not an independent line defect.

**NOT MINE — reported, not chased.** It belongs with #511 / whoever owns the collapse road. Two
consequences for this diagnosis:

1. An Endure board **must not** be used as a Berserk ordering fixture — it qualifies for at least two
   reasons and would prove nothing about either.
2. The ordering fix and the collapse fix are **independent sites** and can land in either order. An
   ordering fix alone leaves the Endure board diverging, and that should be said in advance rather than
   discovered as a "regression".

### THE PATCH, NOT APPLIED

One move, no logic change, in `engine/medicham2-browser.js`.

1. Inside `_stepApply`'s `_damagingHit`, replace the bare call

   ```js
   _hpThresholdBoost();
   ```

   with a hand-off onto the row, exactly as `_damagingHit` itself already does at `R._dh=_damagingHit;`:

   ```js
   R._hpt = _hpThresholdBoost;
   ```

2. Add the step, beside `_stepDamagingHit` (anchor
   `const _stepDamagingHit=(R)=>{ if(!R._dh)return; ... }`):

   ```js
   const _stepHpThresholdBoost=(R)=>{ if(!R._hpt)return; const _f=R._hpt; R._hpt=null; _f(); };
   ```

3. Append it to `_STEPS` **after** `_stepHitCount` — i.e. it becomes the last step, matching
   `afterMoveSecondaryEvent` at `scripts.ts:577` sitting below `-hitcount` at `:550`.

4. Rewrite the stale half of the call-site comment (A3): the "before Scale Shot's self-drops"
   justification is satisfied by any position in `_STEPS` since `selfBoost` moved below the list on
   2026-08-24, and the comment should say what the position now IS — below `faintMessages` and below
   `-hitcount`, above `selfBoost`.

**Declared remainder, so it is not inherited silently:** the authority runs `applyRecoilDamage` (:554)
and a second `eachEvent('Update')` (:575) between `-hitcount` and the boost. This engine pays recoil
below the whole step list and has no second Update pass (`_updateEvent`'s own header at ~20722 already
declares that omission). Neither reads a stat stage, so neither can move this row's board — but the
patch does not close them and should not claim to.

**Predicted effect — say it before the run.** Lab moves, pool sits still. `all_mechanics_fire`
abilities `diverged 3 -> 2`; census unmoved (Berserk already carries two live probes — the crossing
row and the pay-once row — and this adds a third only if a position probe is written). The frozen pool
holds 231 of 17,381 games with a Drampa at all (1.3%), and this needs a Drampa **plus** a multi-hit
crossing half **plus** survival, so **the pool should not move and that is not a disappointment.**

---

## B — SWITCHEROO

### B0. "BLOCKED BEHIND THE TRICK REMAINDER" IS FALSE. THEY ARE TWO STATEMENTS IN ONE BLOCK.

The "declared Trick remainder" is a sentence inside `subRefusesStatus`'s header (anchor:
*"`trickitem` is blocked twice (its no-doll control parts as well, on a separate `-activate|move:
trick` / missing `-enditem` message defect) so its cell is evidence for nothing"*). That declaration is
about **the substitute sweep's cell being uninformative**. It is not a dependency, it names no owner,
and nothing in it prevents the `-activate` name being fixed. Measured below: the two defects sit on
**different statements** and can land in either order.

### B1. THE AUTHORITY'S LINES, BYTE FOR BYTE

Champions overrides **neither** move — `grep '^\tswitcheroo:\|^\ttrick:' data/mods/champions/moves.ts`
returns nothing. Both handlers are identical in shape and both write **`move: Trick`**:

```
data/moves.ts:18666   this.add('-activate', source, 'move: Trick', `[of] ${target}`);      switcheroo
data/moves.ts:18669     this.add('-item', target, myItem, '[from] move: Switcheroo');
data/moves.ts:18671     this.add('-enditem', target, yourItem, '[silent]', '[from] move: Switcheroo');
data/moves.ts:18675     this.add('-item', source, yourItem, '[from] move: Switcheroo');
data/moves.ts:18677     this.add('-enditem', source, myItem, '[silent]', '[from] move: Switcheroo');

data/moves.ts:19887   this.add('-activate', source, 'move: Trick', `[of] ${target}`);      trick
data/moves.ts:19890/19892/19896/19898   the same four, reading `move: Trick`
```

So: **the `-activate` says Trick for both moves; only the `[from]` on the item lines carries the
clicker's own name.** The `-enditem` fires on whichever side handed over nothing, naming the item it
just gave away.

### B2. WHAT IS ACTUALLY COMPARED — TWO DEFECTS, NOT THE TWO FIELDS THE SCOUT COUNTED

Four staged games (Arbok/Alakazam holding a Choice Scarf, receiver holding Leftovers or nothing;
receiver holds with Calm Mind so the shield does not eat the move — my first cut scripted it onto
Protect and both engines printed one agreeing `|-activate|p2a|move: protect`, which is the shield, not
the mechanic).

| arm | driver's first divergence |
|---|---|
| `switcheroo`, both hold an item | `-activate field 3 :: \|-activate\|p1a\|trick <> \|-activate\|p1a\|switcheroo` |
| `switcheroo`, receiver holds nothing | the same — the name, first |
| **`trick`, both hold an item** | **NO DIVERGENCE IN THE WHOLE GAME** |
| `trick`, receiver holds nothing | `event missing from medicham2 :: -enditem` |

**The `[of]` is NOT a compared field.** The driver's declared `source-tag` rule
(`engine/game_differential.js:2007`) strips `[of] pXy` from every line. Read out of the reduced streams:
showdown's `-activate` reduces to `|-activate|p1a:arbok|trick`, ours to `|-activate|p1a:arbok|switcheroo`.
**One field, not two.** Adding `[of]` matches the authority byte for byte and moves no counter; that
should be said when it lands so nobody credits it.

**The item-name spelling is also not a divergence.** Our `|-item|p2a|choicescarf` against the
authority's `|-item|p2a|Choice Scarf` is folded by the engine's own `traceCanon` — both reduce to
`choicescarf`. Not a defect.

**The `[silent]` `-enditem` IS compared, and it is the bigger of the two.** `display-flags` drops the
FLAG, not the LINE, so a missing `-enditem` survives reduction and parts. It is missing for **both**
moves — and for Trick it is the ONLY divergence there is.

### B3. WHERE OURS COMES FROM — ONE BLOCK, TWO STATEMENTS

`engine/medicham2-browser.js`, the `_ti.swaps` arm of `if(a.kind==='trickitem')`
(anchor `if(_ti.swaps){const _mi=itemLose(m),_yours=itemLose(t);`, ~24524 at HEAD):

```js
if(_ti.swaps){const _mi=itemLose(m),_yours=itemLose(t);
  if(_yours)itemGive(m,_yours);
  if(_mi)itemGive(t,_mi);
  if(TR){TR.act(m,'move: '+a.mv);
         if(itemOn(t))TR.item(t,itemOn(t),'[from] move: '+a.mv);
         if(itemOn(m))TR.item(m,itemOn(m),'[from] move: '+a.mv);}}
```

- `TR.act(m,'move: '+a.mv)` writes the CLICKED move's id. For `trick` that lowercase-matches the
  authority's `Trick` and is already right; for `switcheroo` it is wrong.
- the two `if(itemOn(...))` guards have no `else`, so the authority's `-enditem` is never written.

Membership is bounded and was printed: `takesTargetItem{swaps:true}` is `covet`, `switcheroo`, `thief`,
`trick`, and only the two **Status** members reach `kind:'trickitem'` — `covet` and `thief` carry base
power and are served by `removesItem` in the attack branch. So this block is Trick and Switcheroo and
nothing else.

### THE PATCH, NOT APPLIED

Three separable changes in the block above. **They can land independently; nothing blocks anything.**

**1. The activate name — and it must be DERIVED, not typed.** Both handlers hard-code `'move: Trick'`.
Writing that literal into `medicham2-browser.js` types a Pokémon value. The right shape is a param on
the tag that already routes this branch:

- in `engine/tag_dex.js`, add `announcesAs` to `takesTargetItem`, read out of the handler source by
  matching `this.add('-activate', source, 'move: X'` in the move's own `onHit`;
- **print all four members' derived value before wiring it** — a new derived param over-matches, every
  time. Expected: `switcheroo -> Trick`, `trick -> Trick`, `covet`/`thief` -> none (their handlers
  write no `-activate`);
- the emitter becomes `TR.act(m,'move: '+(_ti.announcesAs||a.mv))`, with the fallback COUNTED
  (`MEDFAILS.swapActivateNameUnderived`) rather than silent.

**2. The `[silent]` `-enditem`.** Mirror the authority's own if/else, reading the taken values rather
than re-reading `itemOn` after the gives:

```js
if(TR){TR.act(m,'move: '+NAME,'[of] '+ident(t));
       if(_mi)   TR.item(t,_mi,'[from] move: '+a.mv);
       else      TR.enditem(t,_yours,'[silent][from] move: '+a.mv);
       if(_yours)TR.item(m,_yours,'[from] move: '+a.mv);
       else      TR.enditem(m,_mi,'[silent][from] move: '+a.mv);}
```

`TR.act(m,eff,extra,extra2)` and `TR.enditem(m,it,tag,of)` already take the extra fields (~3272, ~3471).
Note the `[from]` on the item/enditem lines keeps the CLICKED move's name (`a.mv`), which is what the
authority does — only the `-activate` says Trick.

**3. The `[of]`.** Included in the snippet above. **It moves no counter** (`source-tag` drops it) and is
there so the line matches the authority byte for byte.

**Predicted effect — say it before the run.** Lab moves, pool sits still.
- change 1 closes the `switcheroo` moves row: `all_mechanics_fire` moves `diverged 8 -> 7`.
- change 2 closes the empty-handed arm for BOTH moves. **This is the only one of the three with a
  plausible pool signal**: the frozen store holds `switcheroo` in 10 of 17,381 games (0.06%) but
  `trick` in 1,020 (5.9%). Even so, it needs one side holding nothing at the moment of the click, and
  the whole-game clause is already at 1 of 961 — so **expect the pool unmoved and say so in advance.**
- change 3 moves nothing measurable by construction.
- census: neither move currently carries a probe for the announcement shape. Two would be earned —
  "Switcheroo's activate names Trick" and "the empty-handed side gets its `-enditem`" — each shown red
  first. The second must stage BOTH moves, or it credits a fix on the 19-sheet member and leaves the
  522-sheet one untested.

---

## OWED, NOT RUN

- **The Endure volley collapse is a bigger defect than #511 as filed, and it is not mine.** A
  five-arrival volley into an Endure emits ONE `-damage` here against the authority's five, with four
  `-activate move: endure` lines missing. First divergence `event missing from medicham2 ::
  -supereffective`, four arrivals upstream of the hit count. Reproduced this session; route it to
  whoever holds the collapse road. **Reported and left alone.**
- **`hitCountDroppedOnCollapse` deserves a re-read against the Sash.** The counter's own comment names
  a Focus Sash as a producer; staged here, a Sash cannot survive a multi-hit at all (it needs full HP
  and hit 1 removes that), and the Sash board showed no divergence whatever. The Sash clause may be
  dead. Not verified beyond one board.
- **No pool run.** The brief forbade `game_differential.js`, the roster, `all_mechanics_fire` and
  `status.js`, so every predicted delta above is a prediction and none is measured.
- **The switcheroo/trick boards were not board-compared.** The `all_mechanics_fire` row already
  reports ANNOUNCEMENT-ONLY with 402/402 leaves and `end_reason: the script ran out`, and the `item`
  leaf is in `board_state.js`'s compared set — but unlike Berserk's SpA leaf, I did not red-plant it
  this session. If either change is claimed narration-only, plant the `item` leaf first.
- **The census moved under me** (765 -> 766) and the file `engine/medicham2-browser.js` is live under
  another agent — every line number above is at `0e4f0a80` and should be located by the quoted anchor.
