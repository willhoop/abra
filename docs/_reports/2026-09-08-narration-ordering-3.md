# NARRATION BATCH Q — the ordering class, third pass

ENGINE. Written as the work happened; the verdict block at the foot is the last thing added.

---

## 1. THE RE-DERIVATION — 13 CAUSES, SEVEN MECHANISMS

Taken from `end_state[0].summary.by_cause` filtered to `materiality === 'NARRATION-ONLY'` and
`cause` starting `ordering`, **not** from `first_divergences`. The baseline artifact is
`data/game-differential.json` generated `2026-09-08T22:34:13.648Z`, release `f6f44b329132`,
census digest `886d47cf7fef` (830 rows, live, `matches_live: true`), pool `data/team-pool-frozen`,
961 games, `--turns 50`, `--steering empirical`, `--arm middle`, `--end-state`.

**13 causes, one game each.** Cards rendered fresh with
`--dump-games 60 --dump-out data/_narration3-dump.json` on the same release (53 of 56 diverging
games; the 3 excluded are the instrument's own void games) and read one by one.

| # | cause | mechanism |
|---|---|---|
| 1 | `-boost p1a def 1 <> -status p2b brn [spicyspray]` | **M1** DamagingHit fragmented across steps |
| 3 | `-damage p1a [roughskin] <> -status p2a psn [poisontouch]` | **M1** |
| 4 | `-status p1b brn <> -start p2b disable [cursedbody]` | **M1** |
| 7 | `-end p1b substitute <> -damage p1a 0fnt` | **M2** substitute step 0 not run over all targets first |
| 8 | `-activate p2b substitute [damage] <> -damage p2a` | **M2** |
| 13 | `-end p1b substitute <> -resisted p1a 1` | **M2** |
| 2 | `-damage p2b brn <> -damage p1b brn` | **M3** residual order across two bodies |
| 6 | `-damage p1a psn <> -damage p1b psn` | **M3** |
| 10 | `-heal p1b leftovers <> -heal p2a leftovers` | **M3** |
| 11 | `switch p2a archaludon <> switch p1a gholdengo` | **M4** post-KO replacement switch-in order |
| 5 | `-activate p1a lightningrod <> -prepare p1b electroshot` | **M5** redirect activation vs the charge `-prepare` |
| 9 | `faint p2b <> -end p1a syrupbomb` | **M6** faint message vs a volatile ended by its source leaving |
| 12 | `-activate p1a protect <> move p2a flareblitz` | **M7** the smart-target shield line |

**Thirteen causes collapse to SEVEN mechanisms**, three of them carrying three games each.

**THE CLASS NAMES THE COMPARATOR, NOT THE DEFECT — and #12 is the proof.** Nothing is out of order
in that card at all. medicham2 is one LINE SHORT, and the comparator reports the first pair that
fails to match, which happens to be an `-activate` against a `move`. Read off the rollup alone it
would have been worked as a turn-order bug.

### The rules behind M1 and M2, read off the authority while classifying (not fixed this pass)

- **M1.** `runEvent('DamagingHit', damagedTargets, …)` is ONE event
  (`data/mods/champions/scripts.ts:410`) raised BELOW self-drops and secondaries (steps 4 and 5 at
  `:384-388`), and its handlers are sorted by `compareLeftToRightOrder` — `onDamagingHitOrder` ASC,
  then priority, then **target index** — not by speed (`sim/battle.ts:789`, `:421`). Six abilities
  carry `onDamagingHitOrder: 1` (aftermath, electromorphosis, innardsout, ironbarbs, roughskin,
  windpower; `data/abilities.ts`), everything else defaults. medicham2 pays that one event in FOUR
  places: Poison Touch and Cursed Body inside `_stepEffects` (both sites say so in their own
  comments), the punish family in `_stepDamagingHit`, the frozen thaw in `_stepThawDamagingHit`, and
  the buff family in `_stepBuffOnHit` — so across two targets the family decides the order where the
  authority uses the index.
- **M2.** Substitute is step **0** of `spreadMoveHit`, `tryPrimaryHitEvent` over ALL targets
  (`data/mods/champions/scripts.ts:341-348`), above `getSpreadDamage`. medicham2 prices the doll
  inside `_stepApply` per target, so a doll on index 1 announces after damage on index 0.

Both are named here with their source lines so the next pass starts from a read rather than a guess.

---

## 2. BATCH Q1 — M7, THE SMART-TARGET SHIELD LINE

**Probe:** `tests/probe_smart_target_shield_line.js` (27 assertions, four arms, two knobs).
**Prediction, written before the run:** `data/verification/_prediction-2026-09-08-narration-ordering-3.json`.

### The rule has TWO clauses and this engine had neither

**Clause 2 — the silence is a ONE-SHOT.** Every shield condition:

```
onTryHit(target, source, move) {
  if (this.checkMoveBypassesProtect(move, source, target)) return;
  if (move.smartTarget) { move.smartTarget = false; }
  else { this.add('-activate', target, 'move: Protect'); }
                                              data/moves.ts:1008-1013 (protect), same block elsewhere
```

The assignment is to a field on the ACTIVE MOVE, and all the visits happen inside ONE event —
`hitStepTryHitEvent` is `runEvent('TryHit', targets, pokemon, move)`
(`sim/battle-actions.ts:642`), which collects handlers per target (`sim/battle.ts:1037-1047`) and
sorts them left to right (`compareLeftToRightOrder`, `:421`, via the `'TryHit'` branch at `:789`).
So **N shields yield N-1 lines.**

**Clause 1 — `smartTarget` is CLEARED AT TARGET SELECTION when the move cannot split.**

```
getSmartTargets(target, move) {
  const target2 = target.adjacentAllies()[0];
  if (!target2 || target2 === this || !target2.hp) { move.smartTarget = false; return [target]; }
  if (!target.hp)                                  { move.smartTarget = false; return [target2]; }
  return [target, target2];
}                                    sim/pokemon.ts:757-768, called from getMoveTargets at :838-840
```

**That is the pool's card.** In `pair-redirect-priority ...bo3-2657802642` the defending side held
ONE live body at turn 8, so the dart was not a smart-target move by the time the shield answered and
the authority announced normally.

### The first fix was right and did not close the game — recorded because it is the useful part

Clause 2 alone was landed and MEASURED on release `04f6aae3cb27`: **board-material 0 of 958,
ordering 13 causes, narration unmoved, the flareblitz row still there byte for byte.** The
prediction MISSED. Reading the row's own `showdown_before` block showed why — one live body, not
two — and clause 1 followed from `getSmartTargets`. A fix that is correct in the lab and moves
nothing in the pool is not a fix of the pool's defect, and saying so is cheaper than assuming.

### What was measured in the authority before a byte moved

| arm | showdown | medicham2 (pre-fix) |
|---|---|---|
| smart move, BOTH foes Protect | **1**, on the SECOND foe | 0 |
| smart move, only the FAR foe shielded | 0 | 0 |
| non-smart move, both Protect | 1, on the FIRST foe | 1 |
| smart move into a side holding ONE live body | **1** | 0 |

### The arms and the knobs

- **REAL** — the smart move into two shields. Both engines write exactly one line, on the second foe.
- **SILENT A** — the same board, a non-smart single-target move. Both write one line, on the first
  foe. This is what stops a green REAL arm from meaning "nothing announces anything".
- **SILENT B** — the smart move with only the far foe shielded. Both write ZERO, because the one
  refusal spends the silence. It stops the fix being read as "always announce".
- **SOLO** — clause 1's own board, CONSTRUCTED rather than found: three self-fainting clicks with no
  bench behind them empty the defending side's second slot, and only then does the dart go in. The
  fixture checks its own claim on the authority's stream (three faints in that slot, nothing entering
  it afterwards) and refuses BY NAME otherwise. Its first draft picked an evasion boost as the idle
  click, which made the third self-faint MISS — a fixture failure that reads exactly like a mechanic
  that cannot be staged.
- **Two knobs, one on each side of the rule.** `MEDI_SMART_SHIELD_ALL_SILENT=1` is the engine as it
  stood until today (**0** lines) and `MEDI_SMART_PROTECT_LINE=1` is the engine before 2026-08-24
  (**2** lines). The correct answer is **1**. Three distinct medicham2 readings across a varied knob,
  so the knob reaches the rule; SILENT A does not move under either.

Counters: `MEDSEEN.smartTargetShieldSilent` (the spent silence),
`MEDSEEN.smartTargetShieldAnnounced` (clause 2's later shields),
`MEDSEEN.smartTargetUnsplitAnnounced` (clause 1's unsplit dart) —
`MEDFAILS.smartShieldAllSilentRestored` on the new knob.

`_smartSplit` is deliberately a SECOND name and not a narrowing of `_smartTarget`: the authority
reads the field two ways and only one of them is the value. `-hitcount` is suppressed by
`typeof move.smartTarget !== 'boolean'` (`data/mods/champions/scripts.ts:548`), which is true for a
dart whether it split or not, so `R.hitcount` must keep reading the tag.

### The measurement — batch Q1

**The full sample line, every pin and every flag:**

```
SHOWDOWN_PATH=... node engine/game_differential.js --steering empirical --release 3b30a88ffa23 \
  --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --write
```
census `87d990cf3634` (830 rows, live, `matches_live: true`), pins `de38d17e15a2`, pool `0d103fb9fa87`,
961 games played, cap 50.

| | before (`f6f44b329132`) | after (`3b30a88ffa23`) |
|---|---|---|
| **BOARD-MATERIAL** (`state.games` less `state.games_board_never_diverged`) | 0 / 958 | **0 / 958** |
| the `-activate p1a protect <> move p2a flareblitz` cause | present | **absent** |
| `ordering` NARRATION-ONLY causes | 13 | **12** |
| NARRATION-ONLY causes / games | 51 / 53 | **50 / 52** |
| gate narration (declared-adjusted) | 52 of 961 | **51 of 961** |
| protocol diverged (raw) | 56 | **55** |
| census live | 830 / 830 | **830 / 830** |
| roster items / abilities / moves | 142 / 139 / 487, 0 DIFFER, 0 DID-NOT-FIRE | **identical** |

**Zero transfers.** Every other cause in the artifact is byte-identical.

---

## 3. BATCH Q2 — M1 (PARTIAL), THE `DamagingHit` EVENT

**Probe:** `tests/probe_damaginghit_order.js` (17 assertions, two arms, one knob).
**Knob:** `MEDI_DH_IN_EFFECTS=1`.

### The rule

`runEvent('DamagingHit', damagedTargets, pokemon, move, damagedDamage)` is ONE event
(`data/mods/champions/scripts.ts:410`), raised at step **7** of `spreadMoveHit` — BELOW
`runMoveEffects` (3), `selfDrops` (4) and `secondaries` (5) at `:374-388`. `runEvent` puts
`DamagingHit` in the `compareLeftToRightOrder` branch (`sim/battle.ts:789`), which is
`onDamagingHitOrder ASC -> priority DESC -> target index ASC` (`:421`) — **never speed**. Within one
index the collection order is status, volatiles, ABILITY, item, then the SOURCE's `onSource...`
handlers last (`findEventHandlers`, `sim/battle.ts:1053-1069`).

**Derived on the run, not named:** six abilities carry `onDamagingHitOrder: 1` in this format —
aftermath, electromorphosis, innardsout, ironbarbs, roughskin, windpower. Everything else defaults.

### What this engine did

medicham2 paid **Cursed Body** and **Poison Touch** inside `_stepEffects`, the SECONDARY step. Both
sites said so in their own comments — *"This engine pays it in `_stepEffects`, which is a DIFFERENT
STEP and a separate question"* — and neither had a witness. The pool had two:

- `omit-weather ...bo3-2661573110` — Rough Skin's toll (order 1) below Poison Touch's poison (no
  order, and on the SOURCE, so it sorts last within the index).
- `omit-weather ...bo3-2662074768` — a Matcha Gotcha spread whose 20% burn landed on the SECOND body
  while Cursed Body sat on the FIRST, so the authority wrote the burn first and this engine wrote the
  disable first.

Both are now deferred to a new `_stepDamagingHitLate`, which runs `_dhAbil` (the target's
default-order ability effect) then `_dhSrc` (the attacker's `onSource` handler) — the last two entries
of one index in the authority's sorted list. **The die moves with the effect**, because the authority
throws `randomChance` inside the handler; leaving the roll behind would put the draw at a moment the
authority never draws at. The ADDRESS is untouched (`_reactAddr`, the lingering slot), so under the
middle arm this re-orders draws and not their values.

Counters: `MEDSEEN.dhAbilityAtDamagingHit`, `MEDSEEN.dhSourceAtDamagingHit` — both count the HANDLER
RUNNING, not the die coming up, because a deferral that silently drops the closure is the one way this
change can be catastrophically wrong.

### The fixture had to be SEARCHED, and that is a fact about the instrument

The middle arm keys every draw on the ADDRESS, so replaying one board gives the SAME 30% every time.
A first attempt varied the game seed forty times and the poison never landed once — not because the
mechanic is broken but because one fixture has one answer. The probe therefore enumerates candidate
(attacker, contact move, order-1 punisher) triples in a derived order and takes the first where the
AUTHORITY writes both lines, refusing each earlier one BY NAME.

Chosen: **Toxicroak @ Poison Touch clicks Payback at Sharpedo @ Rough Skin**, which idles on Agility.
Silent arm: the same board with Toxicroak's other legal ability, Anticipation — no poison line in
either engine, and the toll still happens, so the board is otherwise identical.

Under `MEDI_DH_IN_EFFECTS=1` the arm INVERTS — toll 15 / poison 14 against the default's toll 14 /
poison 15 — and parts on `|-status|p2a: Sharpedo|psn|[from] ability: poisontouch`. The silent arm does
not move.

### THE ROSTER'S RED ANCHORS DIED ON THIS EDIT, AND THE ROSTER SAID SO

Two `break.patch` anchors in `tests/roster.js` quoted the old one-line form and matched **0 times**:
`ability/seals-the-attacking-move-by-chance` and `ability/poisons-what-it-touches-by-chance`. The
abilities stage printed `42 of 44 apply exactly once`, named both DEAD ANCHORs and **exited 1** with
its counts otherwise unchanged — *"Every row this rule produced is UNPROVEN until it is re-aimed."*
Re-aimed onto the coin itself; `44 of 44` again, and both re-run under `--reds` read **CAUGHT**
(cursedbody -> CONTROL-NOT-QUIET on `vol.disable`; poisontouch -> DID-NOT-FIRE on
`party.hp, party.status, hp, status`). **A green stage with a dead anchor would have been vacuous, and
the exit code was the only thing that said so.**

### The measurement — batch Q2

```
SHOWDOWN_PATH=... node engine/game_differential.js --steering empirical --release 0c5a4da9c512 \
  --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --write
```
census `87d990cf3634` (830 rows, live), pins `de38d17e15a2`, pool `0d103fb9fa87`, 961 games, cap 50.

| | before (`3b30a88ffa23`) | after (`0c5a4da9c512`) | predicted |
|---|---|---|---|
| **BOARD-MATERIAL** | 0 / 958 | **0 / 958** | 0 |
| the roughskin/poisontouch cause | present | **absent** | absent |
| the cursedbody/burn cause | present | **absent** | absent |
| `ordering` NARRATION-ONLY causes | 12 | **10** | 10 |
| NARRATION-ONLY causes / games | 50 / 52 | **48 / 50** | 48 / 50 |
| gate narration (declared-adjusted) | 51 of 961 | **49 of 961** | 49 |
| protocol diverged (raw) | 55 | **53** | 53 |
| census live | 830 / 830 | **830 / 830** | 830 |
| roster items / abilities / moves | 142 / 139 / 487 | **142 / 139 / 487**, 0 DIFFER, 0 DID-NOT-FIRE | 0 |
| `test-engine-diff` | 6000 / 6000 agreed | **6000 / 6000, 0 disagreed** | — |

**Every clause hit at the point estimate. Zero transfers** — the ten remaining `ordering` causes are
byte-identical to the twelve less the two that closed.

The named risk did not materialise: Poison Touch now runs BELOW the secondaries, so a secondary that
lands a status first would refuse it, and Cursed Body re-reads `m.fainted` and `m._vol.disable` a step
later. Neither moved a board in 958 games.

`data/all-mechanics-fire.json` was staled by the engine edit and re-run
(`node engine/all_mechanics_fire.js --kind all --write`, 1313 games, 0 threw); without that the gate
reads **2 of 9** clauses failing for a staleness reason and not an engine one.

---

## 4. WHAT WAS DIAGNOSED AND NOT FIXED

- **M3, the residual order (3 games).** NOT a rule defect as far as the lab can see. Two deliberate
  fixtures, both green: at clearly different Speeds (Jolteon 182 against Torkoal 62) both engines walk
  the Leftovers residual fast-first; at an EXACT cross-side tie (the same species on both sides, both
  reading 112) both engines order `p1b, p2b`. So the three pool rows are not explained by "the residual
  sort is broken", and the next pass should start by getting the two bodies' actual Speeds in those
  three games rather than assuming a sort bug. Recorded as an open question, not as a clean bill.
- **M2, substitute step 0 (3 games).** Rule read and cited in section 1; not attempted. It moves the
  doll's damage roll out of `_stepApply`, which is a board risk on the one clause that must stay at
  zero.
- **M6, `faint` against a volatile ended by its source leaving (1 game).** Fully diagnosed and NOT
  fixed. The authority raises `eachEvent('Update')` TWICE — once inside the hit loop
  (`data/mods/champions/scripts.ts:538`, ABOVE `faintMessages` at `:547`) and once below it (`:574`) —
  and `isActive` is cleared inside `faintMessages` (`sim/battle.ts:2563`). medicham2 raises ONE Update,
  placed where the first one is, and `sourceOffField` tests `curHP<=0`; so the `-end` lands above the
  `|faint|` where the authority puts it below. The fix is a second Update pass plus a real `isActive`
  flag, which can move a berry and therefore a board — too much risk for one narration game while
  BOARD-MATERIAL is the clause that matters.
- **M1's remaining half (1 game).** `_stepDamagingHit` still mixes the order-1 punishers with the
  default-order ones, so a spread hit whose order-1 reactor stands at a HIGHER target index than a
  default-order reactor runs them index-major where the authority runs the order-1 one first. That is
  the `-boost p1a def 1 <> -status p2b brn [spicyspray]` row. Named in the new step's own header.
- **M4 (post-KO replacement switch-in order) and M5 (redirect activation against the charge
  `-prepare`)** — one game each, not investigated.

---

## 5. VERDICT

- **13 `ordering` NARRATION-ONLY causes re-derived; they collapse to SEVEN mechanisms.**
- **Two mechanisms closed** — M7, the smart-target shield line, and M1-partial, the `DamagingHit`
  event — each with a probe that is red under a knob and green without it.
- **`ordering` 13 -> 10 causes. Gate narration 52 -> 49 of 961. BOARD-MATERIAL 0 of 958, unmoved
  after both fixes.** Census 830/830. Roster 142 / 139 / 487, 0 DIFFER, 0 DID-NOT-FIRE.
  `test-engine-diff` 6000/6000. `engine/status.js` reads **1 of 9 gate clauses fail**, the same one.
- **Predictions:** batch Q1's first attempt MISSED (clause 2 alone moved nothing; the pool's card was
  clause 1). Batch Q1 as landed and batch Q2 both hit **every clause at the point estimate**, with
  **zero transfers**.
