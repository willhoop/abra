# The turn-10 attack drop in `pair-protect-bust` — what lowered Attack on both bodies

2026-08-27. ENGINE. Release `549cdbdd8060`. Full account; the verdict is section 1.

---

## 1. WHAT ACTUALLY LOWERED ATTACK ON BOTH BODIES

**A mega evolution installed Trace, Trace copied Intimidate off one of the two foes, and the
authority then ran the *copied* ability's `Start` handler — inside the evolution, before anything
else on that turn.**

The line, cited:

```
sim/pokemon.ts:1946   setAbility(...)
    if (ability.id && this.battle.gen > 3 &&
        (!isTransform || oldAbility.id !== ability.id || this.battle.gen <= 4)) {
      this.battle.singleEvent('Start', ability, this.abilityState, this, source);
    }
```

Every ability write runs the NEW ability's `Start`. Trace's own handlers, mainline
`data/abilities.ts:5110` — `data/mods/champions/abilities.ts` is 100 lines and carries no `trace`
row (grepped case-insensitively over the WHOLE file), so Champions inherits mainline:

```js
onStart(pokemon)  { this.effectState.seek = true; ...
                    if (this.effectState.seek) this.singleEvent('Update', this.effect, this.effectState, pokemon); }
onUpdate(pokemon) { const possibleTargets = pokemon.adjacentFoes().filter(
                        t => !t.getAbility().flags['notrace'] && t.ability !== 'noability');
                    if (!possibleTargets.length) return;
                    const target = this.sample(possibleTargets);
                    pokemon.setAbility(target.getAbility(), target); }     // <- and THAT runs Start again
```

A mega evolution reaches `setAbility` through `formeChange` with `isPermanent`; the
`isFromFormeChange` flag suppresses the `SetAbility` event and the `-ability` announcement, **not**
the `Start` handler. So the chain is:

```
detailschange -> -mega -> Trace.onStart -> singleEvent('Update') -> setAbility(Intimidate)
              -> Intimidate.onStart -> -unboost BOTH foes -> the herb answers
```

### The brief's reading was right about the herb and had not named the source

The brief said the herb consumed itself clearing its own drop, and that is exactly what the stream
shows. It also said, correctly, not to assume the drop's source. **The source is not the Incineroar's
own Intimidate switching in** — that had already fired six lines earlier and both engines agreed on
it. It is the *mega's traced copy of it*, fired back at p2. The authority's raw stream:

```
|switch|p2b: Incineroar|incineroar, L50|170/170
|-unboost|p1a: Meowstic|atk|1          <- Incineroar's OWN Intimidate. Both engines agree.
|-unboost|p1b: Talonflame|atk|1
|switch|p2a: Rampardos|rampardos, L50|172/172
|detailschange|p1a: Meowstic|meowstic-m-mega, L50
|-mega|p1a: Meowstic|Meowstic|meowsticite
|-unboost|p2a: Rampardos|atk|1         <- THE DIVERGENCE. Meowstic-M-Mega's ability is TRACE.
|-unboost|p2b: Incineroar|atk|1
|-enditem|p2b: Incineroar|White Herb
|-clearnegativeboost|p2b: Incineroar|[silent]
```

`Meowstic-M-Mega` abilities, derived: `{"0":"Trace"}`.

**The `|-ability|` lines are missing from that excerpt because `game_differential.js` drops them
under its own `ability-announcement` equivalence** — `data/divergence-turns.json` contains zero
`-ability` lines of any kind. That is why the drop looks source-less in the card and is not.

### Established from replayed streams, not from the card

The recorded game could not be replayed in isolation (the driver's choice state accumulates across
games in a config, and `midClearNth` is not exported), so the mechanism was staged directly instead,
with everything derived from the format:

```
p1a  Alakazam + Alakazite -> Alakazam-Mega {"0":"Trace"},  clicks Protect with mega: true
p2a  Arbok / Intimidate     p2b  Arcanine / Intimidate     both click Protect
```

```
SHOWDOWN                                                       MEDICHAM (before the fix)
|detailschange|p1a: Alakazam|Alakazam-Mega, L50               |detailschange|p1a: Alakazam|alakazam-mega, L50
|-mega|p1a: Alakazam|Alakazam|Alakazite                       |-mega|p1a: Alakazam|Alakazam|alakazite
|-ability|p1a: Alakazam|Intimidate|Trace|[from] ability:      |-ability|p1a: Alakazam|intimidate|[from] ability: trace
    Trace|[of] p2b: Arcanine                                  |move|p1a: Alakazam|protect|p1a: Alakazam
|-ability|p1a: Alakazam|Intimidate|boost
|-unboost|p2a: Arbok|atk|1
|-unboost|p2b: Arcanine|atk|1
```

**The copy happened. The run did not.**

---

## 2. WHERE IT WAS, IN THIS ENGINE

`megaEvolveNow` (`engine/medicham2-browser.js`) wrote the mega's ability and then called
`applyEntryEffects` + `applyEntryDrops` **with the body holding `trace`**, which drops nothing. The
copy landed LATER, at a `traceSweep` boundary, where no entry effect runs at all — `traceSweep`'s own
header says the sweep deliberately does not fire entry effects, and `receiverSweep` one function down
carries the same gap under a named counter (`MEDFAILS.inheritedAbilityStartNotFired`).

Both ORDINARY Trace doors already do it in the right order — `traceCopy(...)` then
`applyEntryEffects(...)`, at the refill and at the lead pass — and `traceCopy`'s own header has
claimed that ordering since it was written: *"THE COPIED ABILITY'S ENTRY EFFECT IS RUN, because the
caller runs `applyEntryEffects` immediately after this … A Trace that copied Intimidate and did not
drop Attack would be a second, quieter bug."* **The mega door was simply not one of those callers.**

The fix is one call, in the same order as the two that already existed:

```js
if(!MEGA_TRACE_LATE&&traceCopy(m,_live(foes)))MEDSEEN.megaTraceCopied++;
applyEntryEffects(m,S.field,own.find(x=>x&&x!==m));
applyEntryDrops(m,_live(foes));
```

`abRewrite` stamps `_preAb = 'trace'`, which is correct rather than an accident of order: the
permanent formeChange wrote `baseAbility = trace` (`sim/pokemon.ts:1495`) and `clearVolatile`
restores FROM that field, so a mega-Trace body that pivots comes back holding Trace and not the
ability it copied.

---

## 3. THE PROBE — `tests/probe_mega_trace_entry.js`

Six arms over two engines, one board each, **no typed expectation**: the quantity is a count of
`|-unboost|p2*|atk|` lines, `|-enditem|…|White Herb` lines and Trace-copy lines read out of BOTH
streams, and an arm passes when the two engines agree. Showdown is the answer.

Everything is derived from `Dex.forFormat('gen9championsvgc2026regmb')` filtered
`exists && !isNonstandard && tier !== 'Illegal'` and printed every run. The entry-drop *shape* is
read off the handler source (`onStart` calling `boost({atk:-1`), never off a name; the herb is the
`restoresStats` tag and the file refuses to run unless that tag matches exactly one item.

```
Trace mega        Alakazam + Alakazite -> Alakazam-Mega   {"0":"Trace"}
entry-drop mega   Manectric + Manectite -> Manectric-Mega {"0":"Intimidate"}
non-mega Trace    Gardevoir
entry droppers    Arbok / Intimidate   and   Arcanine / Intimidate
traceable+inert   Abomasnow / Soundproof   and   Absol / Super Luck
restoresStats     White Herb   (the tag matches exactly 1 item)
```

### The fixture audit — derived, printed, able to refuse

Two counts per arm, and the file exits 1 rather than reporting anything if either is wrong:

- **SOURCES** — how many distinct things on the board could lower a p2 Attack on the staged turn.
  Every click is Protect or a switch, so the only candidates are entry-shaped drops from p1 bodies.
  An arm that expects a drop is REFUSED at anything but 1.
- **REASONS** — per foe, how many distinct things could stop the drop STICKING (an ability with
  `onTryBoost` / `onChangeBoost` / `onAfterEachBoost`, an item tagged `restoresStats`). **Refused
  above 1.** Arms B and F put the herb there on purpose, so their foes read exactly 1 and the herb is
  the single reason.

```
ok  A mega-Trace copies the drop, no items       SOURCES 1 [the ability Trace copies]      Arbok=0  Arcanine=0
ok  B the real game — one foe holds the herb     SOURCES 1 [the ability Trace copies]      Arbok=0  Arcanine=1(holds White Herb)
ok  C control — the mega's OWN ability drops     SOURCES 1 [the mega forme's own ability]  Arbok=0  Arcanine=0
ok  D control — mega-Trace onto no onStart       SOURCES 0 [none]                          Abomasnow=0  Absol=0
ok  E control — the ORDINARY switch-in door      SOURCES 1 [the ability the entrant Traces] Arbok=0 Arcanine=0
ok  F mega-Trace, BOTH foes hold the herb        SOURCES 1 [the ability Trace copies]      Arbok=1(herb)  Arcanine=1(herb)
```

### Red, then green, then red again under the knob

| arm | | before — sd / me | after — sd / me |
|---|---|---|---|
| A | p2 atk unboosts | 2 / **0** | 2 / 2 |
| B | p2 atk unboosts, herb spends | 2 / **0**, 1 / **0** | 2 / 2, 1 / 1 |
| C | p2 atk unboosts | 2 / 2 | 2 / 2 |
| D | p2 atk unboosts | 0 / 0 | 0 / 0 |
| E | p2 atk unboosts | 2 / 2 | 2 / 2 |
| F | p2 atk unboosts, herb spends | 2 / **0**, 2 / **0** | 2 / 2, 2 / 2 |

`MEDI_MEGA_TRACE_LATE=1` reverts exactly the one call — the sweep still lands the copy afterwards, so
the knob reproduces the engine as it was rather than removing Trace. In the child: **A, B and F part;
C, D and E hold.** The knob's arrival is asserted through `MEDFAILS.megaTraceLate`, PRESENT on the
child and ABSENT on the parent, because a knob that reaches no module reads as a row of held
controls and that has happened here before. The parent judges the child on its exit code, and under
the knob the child asserts the defect is PRESENT, so a working knob exits 0.

**Arm E is the one that matters most.** The ordinary switch-in door was already correct before this
pass — measured, not assumed — so a fix that changed it would be doing the copy twice.

---

## 4. WILL'S TWO WHITE HERB QUESTIONS, ANSWERED

> *"make sure the white herb undoes both def and spec def drops after a close combat. for some reason
> it covers both"*

**It clears EVERY negative stage in one consumption, and positives are untouched. Both engines.**

Champions overrides the item — `data/mods/champions/items.ts:1023` — but only with `inherit: true`
plus a rewritten `onAnyAfterMove` (see §6). The clearing body is mainline `data/items.ts`:

```js
onStart(pokemon) {
  this.effectState.boosts = {};
  let ready = false;
  for (i in pokemon.boosts) if (pokemon.boosts[i] < 0) { ready = true; this.effectState.boosts[i] = 0; }
  if (ready) this.effectState.target.useItem();
},
onUse(pokemon) { pokemon.setBoost(this.effectState.boosts); this.add('-clearnegativeboost', pokemon, '[silent]'); }
```

A whole-table loop, applied by one `setBoost`. So a Close Combat's Def **and** SpD both come back on
the one herb. This engine matches, in `restoreStatsUpdate`:

```js
for(const k in m.boosts)if(m.boosts[k]<0)m.boosts[k]=0;
```

> *"it would also clear an intim for example and proc unburden."*

**Both true, both wired.** An Intimidate drop is cleared at the `onAnySwitchIn` (priority −2) door and
— as of this pass — at the `onAnyAfterMega` door, which is precisely the door the game in §1 needed.
All four of the item's triggers are `restoreStatsAll`, one implementation.

And **consuming it fires the item-loss consequences.** The herb goes out through `useItem()`, which
raises `AfterUseItem`; Unburden's `onAfterUseItem` adds the volatile and that volatile is
`onModifySpe -> chainModify(2)`. In this engine `restoreStatsUpdate` sets `m.item = ''` and
`effSpeed` reads `_hadItem && !m.item`, so the speed tier moves in the same instant — an Intimidate
makes the body it just weakened move FIRST. `passItemFromAlly(m)` is called last, so Symbiosis
answers too, in the authority's own order (`-enditem`, then `-clearnegativeboost`, then
`-activate … Symbiosis`).

`tests/probe_unburden_herb_paths.js` measures the two doors and is green on this release. Arms B and
F above measure the spend itself: 1 of 1 and 2 of 2 against the authority.

---

## 5. THE MEASUREMENT — LIKE FOR LIKE

Arm `middle`, `--games 1200` (yields 961), cap 12, `--team-store data/team-pool-frozen`, census pin
`9446a684709d`, `--state --end-state`. **Predicted before the run: board-material 11 -> 10 and
whole-game 14 -> 13, a fall of exactly one on each, because no other board-material game has a mega
into a Trace forme.**

| | before (`f9f3a61481cb`) | after (`549cdbdd8060`) |
|---|---|---|
| pin digest | `44bd49403231` | `44bd49403231` (unmoved — no die changed) |
| games | 961 | 961 |
| raw diverged | 19 | **18** |
| threw | 0 | 0 |
| whole-game (raw less 5 declared) | **14 of 961** | **13 of 961** |
| board never diverged | 950 | **951** |
| **board-material** | **11 of 961** | **10 of 961** |
| board parted before the protocol did | 4 | 4 |
| median turn of first board divergence | 5 | 5 |

**Both row sets were DIFFED, not just counted.**

```
whole-game       GONE:  pair-protect-bust | t10 | event missing from medicham2 | ...-2657559916
                 NEW:   (none)     — the other 18 rows are identical, in order
board-material   GONE:  pair-protect-bust | t10 | p2.party.rampardos.boosts.atk, p2.party.incineroar.item
                 NEW:   (none)
```

Exactly one game removed from each, the right one, and nothing appeared.

### Unmoved, and checked rather than assumed

- **census 764 live / 764 probed / 0 missing** — unchanged. This is an instrument, not a census row.
- **the damage gate 0 of 6000 at all sixteen corners** (seed 20260804), re-run in full. An
  attack-stage change reaches damage, so this was the first thing measured after landing; it did not
  move. A 150-row verification run was clean at every index first.
- **the three roster stages, re-run under this release**: items 139, abilities 129, moves 475
  FIRED-AND-BOARDS-MATCH, with **0 `FIRED-AND-BOARDS-DIFFER` and 0 `DID-NOT-FIRE` in all three**.
  (The brief expected 2 and 5. Those had already been fixed earlier today and the roster had simply
  not been re-run under the current tree — the artifacts were stamped `f9f3a61481cb`.)
- `all_mechanics_fire.js --kind all --write`: 1,289 games, 0 threw, 0 sheets unassemblable.
- green: `probe_trace_target`, `probe_unburden_herb_paths`, `probe_refill_entry_herb`,
  `test-mega-timing`, `test-volatile-duration`, `test-protocol-trace`, `test-engine-consistency`,
  `test-wiring`, `test-game-diff`, `probe_endturn_clock_order`.

### Which scoreboard this was expected to move, said before the run

**The lab and the pool both**, and both moved. A mega into a Trace forme is not common, but the pool
contains one and it is a board-material game, so this is a pool mechanic and not a tail one.

---

## 6. WHAT THIS DOES NOT COVER, AND ONE NEW THING FOUND WHILE READING

- **The other copiers are unchanged and unmeasured here.** `receiverSweep` has the identical gap and
  says so under `MEDFAILS.inheritedAbilityStartNotFired`; Skill Swap, Entrainment and Role Play all
  write abilities through `abRewrite` without running the new ability's `Start`. This batch is ONE
  door, not the class.
- **`traceSweep`'s deferred copies still run no entry effect.** A Trace that finds nothing on entry
  and copies later (ROADMAP #310's re-attempt path) still copies without firing. Same class as the
  bullet above.
- **Which foe Trace picks** is `tests/probe_trace_target.js`'s question. Every arm here gives both
  foes the same ability on purpose, so the target die cannot decide any answer in this file.
- **NEW, FILED NOT FIXED — Champions moves White Herb's after-move trigger into the queue.**
  `data/mods/champions/items.ts:1023` replaces `onAnyAfterMove` with an `insertChoice` of a
  `WhiteHerb` event at `order: 99` — explicitly *"before switches"*, with the comment
  *"Desync: proceed from Parting Shot's point of view"*. This engine fires its after-move herb pass
  inline. That is a Champions-specific TIMING difference nothing here measures, and it is a
  different defect from the one in this report.

---

## OWED, NOT RUN

- **The second `pair-protect-bust` board-material game is untouched, deliberately.** `turn 6`,
  `p2.scovillain.hp` medicham 64 vs showdown 62, cause `-damage field 3`. It is a damage-value
  parting behind a Phantom Force through a broken Protect, not a boost or an item, and it does not
  share this root. Batches of one; it was left.
- **The Champions `onAnyAfterMove` White Herb queue entry** (§6) has no probe, no register row and no
  measurement. It should get all three before anybody assumes the after-move door is right.
- **`receiverSweep` and the deferred `traceSweep` copies** were not changed and were not measured
  under this release beyond the existing counters. `MEDFAILS.inheritedAbilityStartNotFired` is the
  live count of the first; there is no counter at all for the second.
- **No probe stages a mega-Trace onto a WEATHER setter.** `applyEntryEffects` now runs for the copied
  ability, so a traced Drought would set sun on the evolution — correct by the authority's reading,
  and unmeasured. Arm D covers only the no-`onStart` case.
- **`tests/staged_board.js` is RED and was red before this pass** — one of 25 scenarios,
  `roar-drags-whoever-is-standing-there`, `SHORT`. Its output is **byte-identical** with and without
  `MEDI_MEGA_TRACE_LATE=1`, so nothing here touched it. It is registered with a named owner and a
  named root (a temporal defect in the forced-switch mirror) and needs its own batch.
- **The feature-semantics stamp gate is failing at the top of `engine/status.js`** — the fixture
  changed (scenarios 10 -> 12) and the damage table was regenerated (318 -> 322 species). That is
  MEASURE's refit edge, it predates this pass, and nothing here touched `board.js` or
  `data/engine-data.js`.
