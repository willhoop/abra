# The `selfdestruct: 'always'` family faints above the whole hit — ROADMAP #331, second half

2026-08-22, ENGINE. One fix, its own batch. Releases: **`59bb68aa89a9`** (before), **`7da11c1d4d10`** (after).

---

## 1. The verdict, first

`a3-boom-probe` went from **KNOWN-OPEN** to **RED PROVEN**: it agrees with Showdown line for line on
the live tree and parts under a surgical revert of exactly this fix. `tests/test-resolution-order.js`
now runs **26 arms, 1 KNOWN-OPEN, 0 failing** (it was 15 arms, 2 KNOWN-OPEN before). The three `ifHit`
arms are untouched and still pass. Census **629 live / 0 missing → 630 live / 0 missing**. The new row is `move/userFaints`
*"Explosion writes the USER's faint first, and pays it even into a Protect"* — the deliberate twin of
the Final Gambit row landed earlier the same day, whose CONTROL asserts the OPPOSITE outcome (`ifHit`
behind a Protect costs its user nothing; `always` behind a Protect kills it anyway).

**The ripple was ONE mechanic, not the two that were guessed, and the two that were guessed are both
vacuous for this family.** A third thing turned up that is not a ripple of this fix at all and is
declared unfixed.

---

## 2. The authority's site, verified rather than taken on trust

`sim/battle-actions.ts`, inside `useMoveInner` — line numbers read off the tree at
`C:/Users/willj/Projects/Pokemon/pokemon-showdown` on 2026-08-22:

```
:485  let tryMoveResult = this.battle.singleEvent('TryMove', ...);
:486      tryMoveResult = this.battle.runEvent('TryMove', pokemon, target, move);
:489  if (!tryMoveResult) return tryMoveResult;                       <- DAMP ANSWERS HERE
:493  this.battle.singleEvent('UseMoveMessage', move, null, pokemon, target, move);
:500  if (this.battle.gen !== 4 && move.selfdestruct === 'always') {
:501      this.battle.faint(pokemon, pokemon, move);
:510  if (!targets.length) { this.battle.add('-fail', pokemon); return false; }
:516  moveResult = this.actions.trySpreadMoveHit(targets, pokemon, move);   <- THE WHOLE HIT
```

The brief said `:499`; the current file says **`:500`**. It is above `trySpreadMoveHit`, therefore
above the Protect step, above type immunity, above the accuracy roll and above the
no-legal-target return.

`Pokemon#faint()` (`sim/pokemon.ts:1587`) is:

```js
if (this.fainted || this.faintQueued) return 0;
const d = this.hp; this.hp = 0; this.switchFlag = false; this.faintQueued = true;
this.battle.faintQueue.push({ target: this, source, effect });
```

so it sets **hp to 0**, leaves `fainted` false and `isActive` true, and **writes no line**. The
`|faint|` is written later by `faintMessages()`, which drains the queue in order — the user first.

---

## 3. What the ripple actually is — derived, not imagined

The claim "the user sits at 0 HP for the whole hit" is a claim about **hp**, not about a
fainted flag. Every authority guard that could act on the user in that window tests hp:

| guard | source |
|---|---|
| `Battle#spreadDamage` | `if (!target \|\| !target.hp) { retVals[i] = 0; continue; }` |
| `Battle#heal` | `if (!target?.hp) return false;` |
| `Battle#boost` | `if (!target?.hp) return 0;` |

medicham2 has no "0 HP but still active" state, and does not need one: `!m.fainted` is already the
gate on almost every self-affecting block, so setting `m.fainted` at the site reproduces all three
guards at once. I walked every write to the user between the new site and the end of the action and
sorted them into three groups.

### 3a. Already gated — no work, and now load-bearing rather than incidental

`_stepSelfPay`'s drain, the recharge arming, `hazardOnHit`, `removesHolderItem`, `locksIntoMove`,
`cantUseTwice`, the pivot, the max-HP recoil, the ordinary recoil's status/boost halves, the shield's
status and boost punishes, and **`boostsOnKO` (the Moxie family) in `_stepFaint`** — all already carry
`!m.fainted`. `boostsOnKO` is the one the brief named; it needed nothing.

### 3b. Vacuous for this family, and that is DERIVED

The brief named a Spiky Shield tolling a fainted body. Read off the move table:

```
explosion       Normal  Physical 250  allAdjacent  flags {protect, mirror, metronome, noparentalbond}
selfdestruct    Normal  Physical 200  allAdjacent  flags {protect, mirror, metronome, noparentalbond}
mistyexplosion  Fairy   Special  100  allAdjacent  flags {protect, mirror, metronome}
```

**No `contact` flag on any of the three.** Both punishes are gated on
`if (this.checkMoveMakesContact(move, source, target))` — Spiky Shield's
`this.damage(source.baseMaxhp / 8, source, target)` and Baneful Bunker's
`source.trySetStatus('psn', target)`. So neither can fire for this family whatever the HP is.

I added the `!m.fainted` guard to the shield's fraction toll anyway, and **declared it unobservable**
rather than claiming it as a fix: it is `spreadDamage`'s guard written down, so a contact member
arriving later cannot toll a corpse. The over-fire control that proves the harness can see a toll is a
Shadow Punch (contact, `accuracy: true`) into the same Spiky Shield, which tolls on both engines.

### 3c. The one real ripple — THE LIFE ORB TOLL

`engine/medicham2-browser.js`'s Orb block had **no HP gate at all**:

```js
if(_loC&&_reached>0&&!TAGS.has('move',a.move.id,'statusCategory') ...
```

The authority's toll is `this.damage(source.baseMaxhp / 10, source, source, item)` on
`AfterMoveSecondarySelf`, and `spreadDamage` refuses at `!target.hp`. So an exploding Life Orb holder
pays **nothing** there — and this engine paid a tenth of its maximum, printed a
`-damage ... [from] item: Life Orb` the authority does not write, and announced a **second** `|faint|`.
Life Orb is 21,257 sheets, so the pairing is not hypothetical.

The same missing gate also let an ordinary user **killed by its own recoil twenty lines above** be
tolled a second time. Fixed by the same `!m.fainted`, which is exactly the authority's guard.

### 3d. Nothing else is reachable

None of the three carries recoil, drain, a self-drop, a recharge, a lock-in, a pivot or a secondary.
Nothing in the format modifies a Normal or Fairy move's damage off the attacker's remaining HP (the
pinch abilities are type-gated to Fire/Water/Grass/Bug). `ident()` in the trace addresses a body by its
slot index and not by `fainted`, so the corpse-naming rule that bites `-hitcount` does not bite here.

---

## 4. The change

`engine/medicham2-browser.js`, four edits:

1. `let _selfKOPending=false;` hoisted from beside `dealt` up to **above the shield loop** — the
   `ifHit` site is inside `_stepApply` and low enough there; the `always` site is not.
2. The site itself, immediately above the shield loop and below WIRE 46's Damp refusal:
   ```js
   const _ufA=TAGS.param('move',a.move.id,'userFaints');
   if(_ufA&&_ufA.faints==='always'&&!m.fainted){
     m.curHP=0;m.fainted=true;_selfKOPending=true;MEDSEEN.selfKOAlwaysAboveTheHit++;}
   ```
   No move is named; the gate is read out of `data/tags.json`.
3. A drain of `_selfKOPending` on the **fully-shielded early exit**
   (`if(_hadTargets&&!targets.length){...continue;}`), which leaves hundreds of lines above both
   `_stepFaint` and WIRE 46's backstop. Counted as `selfKOLineFromShieldExit`.
4. `!m.fainted` added to the Life Orb toll and to the shield's contact-punish fraction.

WIRE 46's `faints:'always'` clause is **kept and now never fires**, stated in a comment: a regression
at the new site then degrades to the old position instead of to no faint at all.

Two new counters, each naming the noun it counts: `selfKOAlwaysAboveTheHit` (users spent at the
`:500` site, once per action — never targets, never lines) and `selfKOLineFromShieldExit`.


The census row is asserted, and it is the twin: `tests/test-mechanics.js` `move/userFaints` *"Explosion
writes the USER's faint first, and pays it even into a Protect"*. Its OPEN arm reads
`[|faint|p1a: metagross  |faint|p2a: weavile]` and its CONTROL — the same board with the target behind
a Protect — reads `[|faint|p1a: metagross]` with the foe untouched on 145/145 and the site counter at
1. The Final Gambit probe landed earlier the same day demands the OPPOSITE control (no faint at all
behind a Protect), so the two rows together pin the `ifHit`/`always` split rather than one rule.

---

## 5. Every arm, reported on its own line

`tests/test-resolution-order.js`, break `selfko-always-below-the-step-list` (deletes the new site; WIRE
46 then answers, which is the engine exactly as it stood). RED = agrees clean, parts under the break.
CONTROL = agrees clean AND under the break.

| arm | verdict | showdown | medicham UNDER THE BREAK | counters (clean) |
|---|---|---|---|---|
| `a3-boom-probe` — Explosion, partner behind Protect | **RED PROVEN** | `\|faint\|p1a: Metagross` | `\|faint\|p2a: Weavile` | above=1, shieldExit=0, callback=0 |
| `a5-selfdestruct-red` — same board, Self-Destruct | **RED PROVEN** | `\|faint\|p1a: Metagross` | `\|faint\|p2a: Weavile` | above=1 |
| `a5-boom-protect-full` — every adjacent body behind Protect | **RED PROVEN** | `\|faint\|p1a: Metagross` | `\|upkeep` — **no faint at all** | above=1, **shieldExit=1**, backstop=0 |
| `a5-boom-spikyshield` — Chesnaught behind Spiky Shield | **RED PROVEN** | `\|faint\|p1a: Metagross` | `\|faint\|p2b: Weavile` | above=1, shieldExit=0 |
| `a5-boom-banefulbunker` — Toxapex behind Baneful Bunker | **RED PROVEN** | `\|faint\|p1a: Metagross` | `\|faint\|p2b: Weavile` | above=1, shieldExit=0 |
| `a5-shadowpunch-spikyshield` — CONTACT move, same shield (over-fire control) | **CONTROL HELD** | — | agrees | above=0 |
| `a5-boom-ghost-immune` — Explosion into three Ghosts | **CONTROL HELD** | — | agrees | **above=1 on a move that reached no body** |
| `a5-mistyboom-ghost-hits` — Misty Explosion, SAME three Ghosts | **RED PROVEN** | `\|faint\|p1a: Clefable` | `\|-activate\|p2b: Gengar\|ability: cursedbody` | above=1 |
| `a5-boom-damp` — Swampert with DAMP on the field | **CONTROL HELD** | — | agrees | **above=0 (exact)** |
| `a5-boom-damp-cleared` — identical Swampert, ability TORRENT | **RED PROVEN** | `\|faint\|p1a: Metagross` | `\|faint\|p2a: Swampert` | **above=1** |
| `a5-boom-lifeorb-red` — Life Orb Metagross booms | **RED PROVEN** | `\|faint\|p1a: Metagross` | `\|faint\|p2a: Weavile` | above=1, **orbTollPaid=0 clean, 1 under the break** |
| `a5-lifeorb-control` — same Orb, SHADOW PUNCH (over-fire control) | **CONTROL HELD** | — | agrees | above=0, **orbTollPaid=1** |

### The three that answer the brief's named consequences

- **Protect / Spiky Shield / Baneful Bunker, three separate arms.** The user faints in all three. The
  toll and the poison do not fire — because of `flags.contact`, not because of the HP, and that is
  stated rather than blurred. `a5-shadowpunch-spikyshield` is the arm that shows the harness *can* see
  a toll.
- **The Ghost pair, used as one.** `a5-boom-ghost-immune` is Normal into three Ghosts: three
  `|-immune|` lines, nobody dies, `selfKOAlwaysAboveTheHit` still reads **1**. `a5-mistyboom-ghost-hits`
  is Fairy into the identical three Ghosts: Spiritomb is Ghost/Dark, takes it at 2x, dies, and the
  order becomes visible again. Together they separate *the user dies because the hit resolved* from
  *the user dies regardless*, and only the second is what `:500` says.
- **Damp — the inverse, and the arm that could have condemned the fix.** `a5-boom-damp` holds:
  the move never happens, the user does not faint, and `selfKOAlwaysAboveTheHit` is asserted at
  **exact zero**. `a5-boom-damp-cleared` is the same board and the same Swampert with **one field
  changed** — ability `Torrent` instead of `Damp` — and the counter goes 0 → 1.

**On the CLAUDE.md note that "Damp fires in Showdown and not here": that note is STALE.** Damp is
implemented at WIRE 46 of `medicham2-browser.js` (the `blocksExplosion` block, `continue`ing before
the move happens) and both engines refuse identically over the whole arm. There was no second cause to
isolate.

---

## 6. The winner question — `tests/probe_selfdestruct_winner.js` (new file)

End-state mode, three boards, each played clean and under the same revert.

| board | showdown | medicham | verdict |
|---|---|---|---|
| `w1-user-side-empties-first` — p1 all exploders, p2 four Ghosts | `winner="B"`, pokemonLeft 0/4 | live 0/4 → p2 | **WINNER AGREES**, protocol identical (no parted line) |
| `w2-foe-side-empties-first` — p1 keeps Ghosts, p2 all exploders | `winner="A"`, pokemonLeft 2/0 | live 2/0 → p1 | **WINNER AGREES**, protocol identical |
| `w3-simultaneous` — one boom takes the last four bodies at once | `winner="B"`, pokemonLeft **0/0** | live 0/0 → **draw** | **KNOWN-OPEN — see below** |

Under the break, w1 and w2 still name the same winner and their protocol streams part
(`|faint|p1a: Metagross` vs `|faint|p1b: Vanilluxe` / `|faint|p2b: Garbodor`). So on those two boards
the fix is a line-order change and not a result change.

### The thing this found, and it is NOT a ripple of this fix

I expected a simultaneous double wipe to be a draw. It is not:

```js
checkWin(faintData?) {                                              // sim/battle.ts:2603
  if (this.sides.every(side => !side.pokemonLeft)) {
    this.win(faintData && this.gen > 4 ? faintData.target.side : null);
    return true;
  }
  for (const side of this.sides) if (!side.foePokemonLeft()) { this.win(side); return true; }
}
```

`faintData` is the **last** entry `faintMessages()` shifted off the queue. So in Gen 5+ the side whose
body fainted **last** wins — the cartridge rule that the self-destructing player loses, expressed as a
queue position. **The faint order is load-bearing for the RESULT, not only for the narration.**

medicham2's `battleResult` resolves an equal live-body count by total HP fraction and calls 0 against
0 a `0.5`. It has no notion of who died last.

**This pass does not close it, and the reason is measured rather than asserted: the disagreement is
identical clean and under the break.** It is not the self-KO position — it is `battleResult`, which
would need a new field written at every faint site in the engine, and which every rollout and every
H2H reads. `w3-simultaneous` is a declared KNOWN-OPEN board with its own verdict word, runs on every
invocation, and is not counted as a pass or a failure. **It needs its own batch and its own roadmap
row.**

---

## 7. Instrument errors caught before they were reported as engine verdicts

Four, and every one of them read like a result:

1. **`a5-boom-spikyshield` / `a5-boom-banefulbunker` reported BREAK SILENT.** The second foe was a
   Snorlax that survived the boom, so nothing else fainted and there was no adjacent `|faint|` for the
   user's to be above. The shield was staged correctly and the ORDER was not staged at all. Replaced
   with a Weavile.
2. **Both Ghost arms had every adjacent body clicking Protect.** They were the fully-shielded case
   wearing the Ghost pair's name and never reached the type-immunity step — and one of them
   **reported RED PROVEN off a mechanism it was not staging**. Replaced the shields with Nasty Plot.
3. **`w3` filled both benches with exploders**, so the second side to empty never got its action: the
   battle had already ended. It reported a clean winner while staging a *sequential* wipe under the
   name of a simultaneous one.
4. **The winner probe read `battle.winner` as a side id.** The driver names its players `A` and `B`,
   so comparing against `p1`/`p2` scored **two of three boards as WINNER DIFFERS** on a run where both
   engines had emptied the same side. The mapping is now a table and an unmapped name fails loudly.

---

## 8. Whole-game differential — a NULL result, with its reason

Two runs, same pinned team pool digest `6630c23f39e3` (359 teams), same pinned census, differing only
in `--release`:

```
              games  diverged  threw   arm
59bb68aa89a9    176        40      0    middle          35 top-tie-first   45 bottom-tie-first
7da11c1d4d10    176        40      0    middle          35 top-tie-first   45 bottom-tie-first
```

**Byte-identical.** That is the shape this repo calls an unwired knob, so it is checked rather than
assumed: **79 of the 17,381 games in the frozen pool mention the family at all (0.45%)**, and the three
moves are 65 corpus uses between them. A 176-game sample containing none is the expected outcome. The
differential neither confirms nor refutes this fix; the twelve staged arms do, and the release ids in
the two headers confirm the flag was honoured.

---

## 9. Other gates

`tests/test-mechanics.js` **630 live / 0 missing** (629 -> 630, 0 threw).
`tests/test-protocol-trace.js` ALL PASSED. `tests/test-engine-consistency.js` all checks passed.
`tests/test-end-state.js` ALL GREEN.

---

## 10. Left on the table, named rather than left to be found

- **`battleResult` does not implement the last-fainted tie-break** (section 6). Needs its own batch.
- **A move with NO legal target writes `|-fail|`** on the authority (`battle-actions.ts:510`) and
  medicham2 writes nothing. Seen in an earlier draft of the `w3` fixture — a Forretress whose
  Explosion had no adjacent body left — as `sd |-fail|p2a: Forretress` against `me |faint|p2a:
  Forretress`. **Observed, not probed**, and the fixture that showed it no longer exists. It is
  above the site this pass touched and is unaffected by it. Route it; do not treat it as measured.
- **`a1-multihit-frequency`** remains the other declared KNOWN-OPEN arm in
  `tests/test-resolution-order.js`, unchanged by this pass.
