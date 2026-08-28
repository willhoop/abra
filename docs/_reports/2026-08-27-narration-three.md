# Three narration fixes, landed one at a time — 2026-08-27

ENGINE. Three patches, three releases, three measurements, three attributions. Every figure below is
read out of `data/game-differential.json` after its own run, never off stdout.

---

## THE THREE DELTAS

| # | patch | whole-game | board-material |
|---|---|---|---|
| A | a single-arrival volley announces `\|-hitcount\|TARGET\|1` | **4 -> 3 of 961** (raw 9 -> 8) | **0 of 961** |
| B | a partial trap ending with its source announces its `-end` | **3 -> 2 of 961** (raw 8 -> 7) | **0 of 961** |
| C | a lock's fatigue carries `[fatigue]` and lands at `onAfterMove` | **2 -> 1 of 961** (raw 7 -> 6) | **0 of 961** |

Every delta was predicted before its run. **Board-material never left zero.** Damage re-ran in full
at 0/6000 on all sixteen corners after each patch. `PIN_DIGEST` stayed `ccb365985023` and
`DICE_MODEL` stayed v5 throughout — no instrument moved.

Releases, in order: `ffd74ed20b75` (A), `718392c70ef8` (B), `345f4193d440` (C). Baseline was
`5ed4753b7322`.

---

## THE RUN PINS, IDENTICAL ON ALL FOUR MEASUREMENTS

```
--arm middle --turns 12 --games 1200 (yields 961)
--team-store data/team-pool-frozen
--census data/verification/census-pin-9446a684709d.json
--state --end-state
```

Proven identical rather than assumed, read off each artifact's own `steering` block:

| | baseline | A | B | C |
|---|---|---|---|---|
| games | 961 | 961 | 961 | 961 |
| team pool corpus / picked | `0d103fb9fa87` 8778 / 1968 | same | same | same |
| census pin / rows | `9446a684709d` / 643 | same | same | same |
| pin digest | `ccb365985023` | same | same | same |
| threw / void | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

**The two quantities, never conflated.** Whole-game is `diverged` minus the five declared
`fallenundefined` rows. Board-material is `games − state.games_board_never_diverged`, which read
`961 − 961 = 0` on every one of the four runs.

---

## A — THE HIT-COUNT LINE.  ROADMAP #510 closed, #511 filed.  CHANGELOG 5.188.0

**The authority returns above the line only when NOTHING landed.** Champions overrides the whole hit
loop and closes it with `if (hit === 1) return damage.fill(false);` then `if (move.multihit && typeof
move.smartTarget !== 'boolean' && !(move.hit === 1 && parentalbond)) this.battle.add('-hitcount',
targets[0], hit - 1);`. `hit` is one HIGHER than the arrivals, so one arrival prints
`|-hitcount|TARGET|1`.

**The arrival counter only existed on the packet road, and that road needs two packets.**
`_stepApply` builds `_packets = (R.pk && R.pk.length > 1 && dmg === R.dmg) ? R.pk : null` and
increments `_landed` inside it; a volley whose second per-hit accuracy roll missed took the `else`,
never wrote `R.hitLanded`, and `_stepHitCount` returned at its first line.

**The count was never wrong.** `_arrivals = _packets ? _landed : 1` already gave Rage Fist its `+1`
off the same road, and the HP subtraction is the full drawn total — which is why no board saw it.

**Red then green.** `tests/probe_upkeep_lines.js --only hitcount`. Its `A TEST` expectation read
`PARTS` while the defect was being diagnosed — a probe that pins the bug — and the file printed a
verdict and always exited 0. Both were fixed first: the expectation is now the AUTHORITY's behaviour
and the file carries an exit code. RED exit 1 at reduced index 37; GREEN exit 0 after, with the two
streams matching on `1 x3  10 x4  3 x1  4 x1  7 x1  8 x1` — three of them the single-arrival case.
**The pre-patch release `5ed4753b7322` reproduces the SAME red at the SAME index**, not a third
behaviour. The bottom-corner control agreed on twelve matched lines before AND after.

**THE SECOND PRODUCER IS STILL LIVE — ROADMAP #511, filed, not papered over.** When `R.pk.length > 1`
but the total was rewritten between pricing and application (a Focus Sash, an Endure, a busted
Disguise) the volley collapses to one packet, `_landed` stays 0 and nothing is announced, though the
authority landed 2+ arrivals. Writing `1` there would be an invented number, so the guard is
`if (R.pk && R.pk.length > 1)` -> `MEDFAILS.hitCountDroppedOnCollapse`, `else` -> `R.hitLanded = 1`.
No fixture stages it; its reach is unknown and is not claimed.

---

## B — THE PARTIAL-TRAP END.  ROADMAP #512 closed.  CHANGELOG 5.189.0

`partiallytrapped.onResidual` (`data/conditions.ts:236-241`) takes the state and the line on two
consecutive statements — `delete pokemon.volatiles['partiallytrapped'];` then `this.add('-end',
pokemon, this.effectState.sourceEffect, '[partiallytrapped]', '[silent]');`. It is a `delete`, not a
`removeVolatile`, so `onEnd` never fires and that inline line is the only one written. **Champions
does not override the condition**: `data/mods/champions/conditions.ts` is 57 lines holding `par`,
`slp` and `frz`, read in full.

This engine's source-gone branch did `m._trap = null` with no trace call, while the duration-expiry
branch four lines below already emitted the correct line — one mechanic, two exits, one announcement.
`[silent]` is stripped by the reducer, so the same three-argument `TR.vend` the expiry branch uses is
exact and the two branches now share one announcement.

**Every member staged, not one chosen by hand.** All seven `partialTrap` moves with a legal carrier:
bind, firespin, infestation, sandtomb, snaptrap, whirlpool, wrap. **7 of 7 red (exit 1), 7 of 7
green (exit 0)**, each arm printing the authority's own staging receipt
(`|-activate|TARGET|move: NAME`) so an AGREES with nothing staged cannot read as a pass, and each
control — the same board with the trapper staying in — agreeing before AND after with no `-end` in
either stream.

**Declared remainder, not fixed here.** The authority's predicate is `!source.isActive ||
source.hp <= 0 || !source.activeTurns`; this engine's is `fainted || curHP <= 0 || not-on-the-field`.
**`!source.activeTurns` has no counterpart** — a trapper that entered the field THIS turn ends the
trap in Showdown and does not here. Different fixture, not measured.

---

## C — THE `[fatigue]` TAG *AND* ITS POSITION.  ROADMAP #506 closed.  CHANGELOG 5.190.0

**Two defects on one line, and the second was not in the row as filed.**

```
turn 2  authority  [ 6 of 13]  |-start|p1a|confusion|[fatigue]
turn 2  ours       [11 of 13]  |-start|p1a|confusion
```

The field: `confusion.onStart` writes `[fatigue]` only when `sourceEffect.id === 'lockedmove'`, and
`lockedmove.onEnd` passes no arguments — `addVolatile` fills them from the running event, where
`battle.effect` IS that condition. The position: `lockedmove.onAfterMove` is `if
(this.effectState.duration === 1) pokemon.removeVolatile('lockedmove')`, and `removeVolatile` runs
`onEnd`. So the authority fatigues INSIDE the move for a body that MOVED, and only at the residual
for a body that was PREVENTED from moving. This engine had the second road alone.

**The discriminator is a handler, printed over the format before it was wired.** New derived tag
param `expiresAtMove` (`engine/tag_dex.js`, `lockShape`), read off the condition's own `onAfterMove`:
true for outrage, petaldance, ragingfury, thrash; false for uproar and for all six `mustrecharge`
moves. Exactly the four.

**Uproar must not move, and that was measured.** The one-turn roster and all-mechanics-fire stagings
cannot see this at all. `probe_upkeep_lines.js --only perish` carries a four-turn
`D clock volatile:uproar` arm that reaches the residual, and its whole output is **byte-identical
across the patch**, including its pre-existing part at reduced index 63 (a different open row —
Uproar's residual line between two `perish0` lines — which is not made worse here).

**The control could have failed.** Same Goodra, same ability, Outrage swapped for Dragon Claw; the
AUTHORITY's own confusion volatile moves `1` -> `null` across the knob, asserted before any narration
is read. The cell qualifies for exactly one reason and the probe derives and prints it —
`confusion sources in this cast, DERIVED from the format: 1 [move:outrage (via lockedmove.onEnd)]` —
and refuses to run if the answer is not 1.

**`data/tags.json` and `data/abra-tags.js` were regenerated, and that moved more than the new param.**
`tag_dex.js` reads the LIVE game store for its usage counts and the store has moved. A no-op
regeneration was run FIRST, before the `lockShape` edit, to separate the two: it moved ~600 leaves,
**every one of them a usage count or a linkage total, and not one a mechanic parameter**. Against
that baseline the edit adds exactly five leaves — `expiresAtMove` on outrage, petaldance, ragingfury,
thrash and uproar — and nothing else.

**Declared remainder.** The new block sits below the same "the move actually resolved" guard as the
lock-arming site, and the authority raises `AfterMove` even for a locked move that MISSED. A missed
last-turn Outrage therefore still fatigues at the residual here. Same state, different position,
unmeasured.

---

## THE FOURTH ROW — NOT TOUCHED, AND NOW PROVEN UNMOVED

`|upkeep <> |faint|p2b` (turn 11) is the one non-declared whole-game row left. It was NOT
REPRODUCED in the lab across 33 staged arms, and `probe_upkeep_lines.js --only perish` is
**byte-identical across all three patches** — same arms, same verdicts, same split indices. Nothing
in this session went near it.

---

## THE OTHER SCOREBOARDS, AFTER C

| instrument | reading | vs the brief's baseline |
|---|---|---|
| census (`tests/test-mechanics.js`) | **765 live / 765 probed / 0 missing**, 0 threw, 0 hollow, 765 armed | unmoved |
| roster items | 139 FIRED-AND-BOARDS-MATCH, **0 DIFFER, 0 DID-NOT-FIRE** | unmoved |
| roster abilities | 129 tested, **0 DIFFER, 0 DID-NOT-FIRE** | unmoved |
| roster moves | 475 FIRED-AND-BOARDS-MATCH, **0 DIFFER, 0 DID-NOT-FIRE** | unmoved |
| all-mechanics-fire | moves 8 diverged, abilities 3, 1289 games, 0 threw; **summary byte-identical except elapsed seconds** | unmoved |
| damage differential | **0/6000 at all sixteen corners** | unmoved |

**Which scoreboard should have moved, said before the runs:** all three are pool rows, so the pool
was expected to move by one game each and did. None is a census or roster mechanic, so the lab was
expected to sit still and did.

---

## OWED, NOT RUN

- **ROADMAP #511 — the collapse road.** A multi-hit into a Focus Sash, an Endure or a busted Disguise
  still drops `-hitcount` entirely. It is counted at `MEDFAILS.hitCountDroppedOnCollapse` and has no
  fixture; a fourth arm of `probe_upkeep_lines.js` staging a volley into a Sash would close it.
- **The trap's `!source.activeTurns` clause.** Showdown ends a partial trap when the trapper entered
  the field THIS turn; this engine has no counterpart. Stage: trap lands, trapper switches out,
  trapper switches back in on the turn of the next residual.
- **The missed locked move.** The authority raises `AfterMove` on a miss, so its lock expires at move
  time there and at the residual here. Position only; state agrees.
- **`tests/run-all.js` was NOT run in this pass.** The gates that were run are named above. Not a
  claim that it is green.
- **`node engine/status.js` and `--write` were run at the end**; the gate clause counts in it are read
  from that run and not from this file.
- **`probe_upkeep_lines.js` exits 1 on a whole-file run**, because the PERISH arm's five incidental
  parts are other rows' open defects (Uproar at residual order 28 between two `perish0` lines; the
  Intimidate order on a double replacement). Run it per-arm. This is stated rather than hidden by
  widening the expectations.
- **Debris left in place, reported not deleted.** `data/_scratch-scovillain-dump.json` and roughly
  twenty `.scratch_*` files sit untracked in the tree from earlier sessions, including
  `.scratch_eng_diffrun.cmd`, which pins a DIFFERENT simulator. Nothing in this session executed any
  of them and nothing was removed.
