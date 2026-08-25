# Board-material, third pass — 18 → 10 games, and the biggest single cause was an ADDRESS, not a rule

**ENGINE, 2026-08-25.** Historical record, per `docs/_reports/` convention. Not current state;
superseded by the register rows it feeds. Every figure is read out of a run whose command is printed
beside it, or cited to a line in the pinned Showdown checkout.

---

## 0. VERDICT

**Board-material 18 games / 17 causes → 10 games / 10 causes.** Arm `middle`, 961 games,
`--games 1200` (a PAIR budget), release **`cbf345e56bc0`**, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json`, `--end-state --write`.

| quantity | before (HEAD `df82b43`) | after (`cbf345e56bc0`) |
|---|---|---|
| games | 961 | 961 |
| protocol parted, raw | 35 | **28** |
| declared (`fallenundefined`) | 5 | 5 |
| **undeclared** | 30 = 3.1% | **23 = 2.4%** |
| **board-material** | **18 games / 17 causes** | **10 games / 10 causes** |
| narration-only | 17 games / 16 causes | 18 games / 17 causes |
| DIFFERENT-END-STATE | 12 | **8** |
| middle-arm VOID | 1 | 1 |
| census probed / live / missing | 693 / 693 / 0 | **696 / 696 / 0** |
| damage differential, all 16 corners | 0 of 6000 | **0 of 6000** |

**The brief's "undeclared 22 = 2.3%" does not reproduce from the committed artifact**, which reads
30 = 3.1% under the same declared list. The before column above is computed from
`git show HEAD:data/game-differential.json` by the same expression as the after column, so the two
are the same question.

**Narration rose by exactly one game and it is a game that came DOWN from board-material.** Full
game-by-game attribution in §4 — no game started parting that was not parting before.

---

## 1. THE EVENT ADDRESS OUTLIVED THE ACTION — 7 games cleared outright, 3 more moved on

**This is the whole of the movement.** It is one mechanism and it cleared six Moody games, one Harvest
game, and un-hid three defects underneath them.

### What was wrong

The middle arm keys BOTH engines' dice on `seed | turn | category | move | target | nth`. The
authority's `move`/`target` fields come off `battle.activeMove` / `battle.activeTarget`, and the
authority **nulls both after every action and again at the top of the residual**:

```
sim/battle.ts:2828   this.clearActiveMove();                      <- after EVERY action
sim/battle.ts:2810   case 'residual': this.clearActiveMove(true);
sim/battle.ts:376    clearActiveMove() { ... this.activeMove = null;
                                             this.activePokemon = null;
                                             this.activeTarget = null; }
```

`medicham2-browser.js` wrote `MID_MOVE`/`MID_TGT` at the top of each action and **never cleared them**.
So every die rolled at the END of a turn carried the last click's name, and the two engines could never
be rolling for the same event.

### Measured, not argued

Both address logs printed side by side out of `game_differential.js`'s own `midAddresses()`, on one
staged turn — a Trevenant clicking Curse, eating its Sitrus, and Harvest's `randomChance(1, 2)` at the
residual:

```
authority     20260813|1|any|-|-|0            <- Harvest's coin
this engine   20260813|1|any|curse|p20|0      <- the same coin, a different address
```

Two addresses that cannot match are two INDEPENDENT dice. The board says the same thing: the same
board staged with `tests/staged_board.js`'s helpers, Trevenant with a Sitrus and Harvest, **no sun** so
the coin decides —

```
turn 1: 2 DIFF of 289
  p1.party.trevenant.item     us "sitrusberry"  sd ""
  p1.active[0].item           us "sitrusberry"  sd ""
```

and after the fix, `identical (289 leaves)` on every turn.

### The population is bigger than Harvest, and Moody is most of it

Anything rolled outside `hitStepAccuracy` / `secondaries` / `getDamage` falls in the `any` category —
which is every residual chance. **Moody takes two `sample()` draws at `onResidualOrder: 28`**, and the
`-boost field 3` / `-unboost field 3` family was the single biggest board-material class in the run
(8 of 18 games). Staged, four turns, one Scovillain:

```
CONTROL (MEDI_ACTIVE_MOVE_STICKY=1, the old behaviour)
  turn 4: 8 DIFF of 288 — boosts.atk us 2 / sd 0, boosts.spa us -1 / sd 5, boosts.spe us 4 / sd 0, ...
FIXED
  turn 1..4: identical (288 leaves)
```

**`MEDI_ACTIVE_MOVE_STICKY=1` restores the leak** and stamps `MEDFAILS.activeMoveStickyRestored = 1`,
so the red is reproducible rather than remembered.

### CLAUDE.md's memory "Moody is a declared non-defect — the stat pick has no shared die" is REFUTED

It was true as a description and wrong as a conclusion. The die was not shared **because the address
was wrong**, and the address is ours. Nothing about how Moody picks a stat changed; what changed is
that the two engines now agree about WHICH EVENT they are rolling for, which is the whole premise of
the arm.

### The paired control at 344 games, before the other two fixes existed

Same pool, same census pin, same 344 games, the only difference the knob:

```
STICKY (old)   28 diverged   BOARD-MATERIAL 18 / 18   NARRATION 10 / 10
FIXED          25 diverged   BOARD-MATERIAL 15 / 15   NARRATION 10 / 10
```

Three games cleared, all three `-boost field 3`, **every other cause identical line for line**.

---

## 2. THUNDER WAVE IGNORED THE TYPE CHART — 1 lab row, and it is the only member in this format

`hitStepTypeImmunity` runs for every move, status included:

```
if (move.ignoreImmunity === undefined) move.ignoreImmunity = (move.category === 'Status');
hitResults[i] = (move.ignoreImmunity && ...) || targets[i].runImmunity(move, ...);
```

A Status move skips the chart BY DEFAULT — which is why this engine's status branch never had the gate
and why its absence was invisible. A move that DECLARES `ignoreImmunity: false` is judged by the chart
like any attack. **Derived over the format: exactly one such move, `thunderwave` (564 uses).** That is
why a Ground type cannot be paralysed by it.

RED first, staged Kingambit Thunder Wave into an Excadrill:

```
turn 1: 2 DIFF of 291
  p2.party.excadrill.status     us "par"  sd ""
  p2.active[0].status           us "par"  sd ""
```

**The first version of that probe was vacuous and it was caught by reading the trace**: the target was
clicking Protect, so both engines agreed about nothing at all. The second version gives the target
Swords Dance.

`statusCategory.respectsTypeChart` is derived in `tag_dex.js` from `ignoreImmunity === false` and was
printed before it was wired — **1 move: `thunderwave` (564 uses)**. The engine reads the tag, never
the name.

**Two existing census rows were GREEN ON THE DEFECT** and went red the moment the engine was right:
`move/inflictsParalysis` and `move/statusCategory` both aimed Thunder Wave at a **Garchomp**, which is
Ground. The FIXTURE was wrong, not the engine. Both now aim at a Snorlax; `statusProbe` grew an
optional target so the Will-O-Wisp row is bit-identical.

---

## 3. BUG BITE ATE A NON-BERRY — 1 lab row

```
bugbite / pluck   onHit(target, source) {
                    const item = target.getItem();
                    if (source.hp && item.isBerry && target.takeItem(source)) { ... }
```

The strip is gated on the item being a BERRY. `removesItem` said only whether the user keeps it, so
this engine took whatever was in the slot. RED first, staged Scizor Bug Bite into a Pelipper holding
**Mystic Water**:

```
turn 1: 2 DIFF of 291
  p2.party.pelipper.item      us ""  sd "mysticwater"
  p2.active[0].item           us ""  sd "mysticwater"
```

`removesItem.requiresItemClass` derived in `tag_dex.js` from the guard, printed before wiring: eight
legal moves call `takeItem` and exactly **two** carry a class guard — `bugbite` and `pluck`, both
`["isBerry"]`. Knock Off, Corrosive Gas, Thief, Covet, Trick and Switcheroo carry none and are
unchanged. No legal move mentions `.isBerry`/`.isGem` without calling `takeItem`.

**A class this engine cannot ask about is REFUSED and counted** (`MEDFAILS.itemClassGuardUnknown`),
not treated as a pass — `isGem` has no legal carrier in Reg M-B and no tag, and reading an unknown as
"allowed" is the silent-default shape.

**Over-fire control holds**: Bug Bite still strips a Sitrus Berry, and Knock Off still strips the same
Mystic Water.

---

## 4. WHAT MOVED, GAME BY GAME

The attribution is a diff on `config|seed`, not a net:

```
--- games that STOPPED parting (7):
    6 x  -boost / -unboost field 3          (Moody)
    1 x  |upkeep <> |-activate|p1b|sitrusberry   (Harvest)
--- games that STARTED parting: NONE
--- games parting in BOTH but on a different cause (3):
    |cant|p2a|slp <> |-curestatus|p2a|slp|[msg]   ->  |-singleturn|p2a|protect <> |-fail|p2a
    -boost field 3 (Moody)                        ->  |-immune|p1a <> |-miss|p2b|p1a
    -unboost field 3 (Moody)                      ->  |switch|p1a|krookodile <> |detailschange|p1b|charizardmegay
```

So: **board-material 18 − 6 (Moody gone) − 1 (Harvest gone) − 1 (sleep, now narration) = 10**, and
**narration 17 + 1 = 18**. The one narration game came DOWN from board-material; nothing was created.

The sleep game is worth naming: `|cant|slp` vs `|-curestatus|slp` was a sleep-COUNTER divergence, and
Champions' `slp.onStart` sets the counter with `this.sample([2, 3, 3])`. Applied at the residual (Yawn)
that draw is at exactly the address this pass cleared, so the counters now agree and the game parts
later on a Protect narration line instead.

**A standing note is corrected.** `docs/MEDICHAM-SPRINT-NOTES.md` recorded the Harvest coin and said
fixing it *"moves a board-material game onto the narration gate rather than closing it."* That
prediction was wrong: the coin was never the thing to fix — the ADDRESS was — and the game closed.

---

## 5. HARVEST AND PICKUP ANNOUNCED THE WRONG EVENT — narration, closed on the way past

```
harvest   this.add('-item', pokemon, pokemon.getItem(), '[from] ability: Harvest')
pickup    this.add('-item', pokemon, this.dex.items.get(item), '[from] ability: Pickup')
```

Both write `|-item|`. This engine wrote `|-activate|BODY|item: <id>`, which is Quick Claw's and Cud
Chew's event and not this one. Measured on a staged Trevenant **under sun**, where the restore is
certain on both engines and the LINE is the only thing left to compare:

```
authority     |-item|p1a: Trevenant|Sitrus Berry|[from] ability: Harvest
this engine   |-activate|p1a: Trevenant|item: sitrusberry
```

After the fix the whole staged game reads `div: null`. Pickup was staged separately (Gourgeist taking a
Curse-eaten Sitrus off a Trevenant) and also reads `div: null`.

---

## 6. THE THREE NEW CENSUS PROBES — 693 → 696

Every one carries a control that would fail a do-nothing engine.

| row | asks | control |
|---|---|---|
| `move/statusCategory` — *"Thunder Wave is refused by a GROUND body, and an ordinary status move is not"* | Thunder Wave into Garchomp → `none` | the same click into a Snorlax → `par`; **Will-O-Wisp into the SAME Garchomp → `brn`** |
| `move/removesItem` — *"Bug Bite takes a BERRY and leaves anything else"* | Bug Bite into Mystic Water → item SURVIVES | Bug Bite into a Sitrus → gone; **Knock Off into the same Mystic Water → gone** |
| `ability/restoresBerryAtResidual` — *"Harvest announces the returned berry with `-item`, not `-activate`"* | the line is `\|-item\|…\|[from]ability:harvest` | the same board with no ability writes NO restore line |

The address fix has **no census probe** and that is stated rather than papered over: it is a property of
how the differential's shared die is addressed, not of what the engine does on its own, so the evidence
is the staged board plus the `MEDI_ACTIVE_MOVE_STICKY` knob and the paired 344-game control.

---

## 7. WHAT REMAINS BOARD-MATERIAL — 10 causes, and one of them is the instrument

| cause | read |
|---|---|
| `\|-damage\|p2a <> \|-damage\|p2b` | **THE INSTRUMENT.** This is the run's ONE void game. `mid_void.unshared_address_shapes` names `acc/crit/dmg outrage [sd only]` and `[me only]`, `unshared_address_field: target differs` — Outrage is `randomNormal` and the two engines draw its target from addresses that cannot match. Fixing it changes the arm's pin, so it is scoped and NOT started. |
| `\|move\|p2a\|psychicfangs <> \|cant\|p2a\|flinch` | a Rock Slide flinch on a spread hit where one target fainted |
| `\|faint\|p2b <> \|-status\|p2a\|brn` | the faint/secondary ordering inside the hit loop — see `docs/_reports/2026-08-23-faint-restructure.md`; still a restructure |
| `\|switch\|p2a\|crabominable <> \|cant\|p1b\|recharge` | a switch the authority makes and we do not |
| `\|switch\|p1b\|whimsicott <> \|switch\|p1a\|alakazam` | switch-in order; the board had already parted a turn EARLIER, so this row is downstream |
| `\|-supereffective\|p1a <> \|move\|p1a\|gravity` | a Phantom Force release that did nothing; board parted EARLIER, downstream |
| `\|-fail\|p2b <> \|-start\|p1a\|disable\|protect` | Disable refused by the authority. The authority's `\|move\|…\|Disable\|\|[still]` carries an EMPTY target field, so the target was gone; staged Disable against a Protect-lastMove target agrees, so the probe I wrote does not reach it |
| `\|-activate\|p2a\|telepathy <> \|-immune\|p2a\|[from]telepathy` | the board parted LATER, so this row is not the board cause |
| `\|-immune\|p1a <> \|-miss\|p2b\|p1a` | NEW SURFACE — an immunity the authority sees and we miss instead. Was hidden behind a Moody divergence |
| `\|switch\|p1a\|krookodile <> \|detailschange\|p1b\|charizardmegay` | NEW SURFACE — mega vs switch ordering. Was hidden behind a Moody divergence |

---

## 8. ARTIFACTS RESTORED

All four, at release `cbf345e56bc0`:

```
tests/roster.js --stage items      DIFFER 0  DID-NOT-FIRE 0  MATCH 139  DEFERRED 1  COULD-NOT-STAGE 8
tests/roster.js --stage abilities  DIFFER 0  DID-NOT-FIRE 0  MATCH 130  CONTROL-NOT-QUIET 45  COULD-NOT-STAGE 141
tests/roster.js --stage moves      DIFFER 0  DID-NOT-FIRE 0  MATCH 475  DEFERRED 3  COULD-NOT-STAGE 22
engine/all_mechanics_fire.js --kind all --write   summary UNMOVED, field for field, in all three populations
```

`engine/status.js` reads **5 of 8 clauses PASS** — game differential, all three roster stages, and
coverage. The two FAILs are the whole-game clause (23 of 961) and the mechanics clause (10 of 17), the
same two as before.

**`all_mechanics_fire` did not move and that was expected**: its scenarios stage each entity alone and
none of the four fixes is in one of its fixtures. It still reports `vol.trapped showdown 0 / we 1` on
`magicbounce` and an HP gap on `sandforce` — **the move-trap defect the brief called the strongest
candidate is NOT fully closed in the lab**, even though the pool row it was named for is gone.

---

## 9. OWED, NOT RUN

- `tests/run-all.js` in full. Run individually: `tests/test-mechanics.js`, `tests/test-engine-diff.js`
  (`--n 6000 --seed 20260804`, 0 of 6000 at all 16 corners), `tests/roster.js` x3,
  `engine/all_mechanics_fire.js`, `engine/game_differential.js`, `engine/tag_dex.js`, `engine/status.js`.
- `tests/interaction_matrix.js` (last run 2026-08-11), `tests/mutation_harness.js`,
  `engine/selftest.js`, `engine/conformance.js`, `engine/feature_fixture.js --check` (RED at HEAD; the
  refit question is MEASURE's).
- **`engine/provenance.js` was NOT re-stamped.** The artifacts moved; the stamp did not.
- **The Bug Bite EAT half.** The authority does not merely remove the berry, it makes the ATTACKER eat
  it (`singleEvent('Eat', item, …, source, …)`) and writes `[from] stealeat|[move] Bug Bite` rather
  than `[from] move: bugbite`. Only the over-fire is closed. No failing probe on the eat half yet —
  it is visible as the first divergence of the berry-holder control arm.
- **The `any`-category address for `getRandomTarget`.** Fixing the Outrage void needs the authority's
  `getRandomTarget` draw to be addressable, which means wrapping another method in
  `game_differential.js` and therefore moving `PIN_DIGEST`. Scoped, not started.
- The eight items still on the hand list in `docs/ENGINE.md`.
