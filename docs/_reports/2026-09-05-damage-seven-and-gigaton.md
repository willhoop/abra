# Gigaton Hammer's `cantusetwice`, and the damage seven attributed one by one

ENGINE, 2026-09-05. Dated findings record. Not maintained; superseded by the register rows it feeds.

Release `63cbcc2ef605`. Baseline `data/verification/cap20-empirical.json` (release `688e696f00c8`).
New measurement `data/verification/fix-batch-9.json`. Prediction written before the run:
`data/verification/_prediction-fix-batch-9.json`.

---

## 1. GIGATON HAMMER — THE MECHANISM

`cantusetwice` is enforced in the authority in **exactly one place**, and it is the request builder.

```
sim/battle.ts:1692        (inside the per-request handler sweep)
  if (activeMove.flags['cantusetwice'] && pokemon.lastMove?.id === moveSlot.id) {
    pokemon.disableMove(pokemon.lastMove.id);
  }
```

There is **no refusal at use time**. The only two other sites are a marker and its hint:

```
sim/battle-actions.ts:267   // Used exclusively for a hint later
  if (move.flags['cantusetwice'] && pokemon.lastMove?.id === move.id) pokemon.addVolatile(move.id);

sim/battle-actions.ts:313
  if (move.flags['cantusetwice'] && pokemon.removeVolatile(move.id)) {
    this.battle.add('-hint', `Some effects can force a Pokemon to use ${move.name} again in a row.`);
  }
```

The hint exists **because the repeat is legal**. Encore and Instruct bypass selection, so the disable
never applies and the move runs at its full 160 BP. Champions overrides neither move — `gigatonhammer`
appears under `data/mods/champions/` only at `learnsets.ts:14479` — and the Champions `encore` override
(`data/mods/champions/moves.ts:286`) makes the case *easier*: it calls
`queue.changeAction(target, {choice:'move', moveid: move.id, order: action.order})` and rewrites the
already-queued action in place.

Derived at run time by the probe, not recalled: two `cantusetwice` moves exist in the dex and only
**Gigaton Hammer** is legal here (`bloodmoon` is `Past`); **Tinkaton** is the sole carrier;
`gigatonhammer` carries no `failinstruct`, so Instruct repeats it too.

### What this engine did

`medicham2-browser.js` WIRE 44 armed `_noRepeat` and then asked it in **two** places:

- `moveDisabledBy` -> `'noRepeat'` — the authority's clause, correct;
- an execution gate above the kind dispatch — `if(m._noRepeat===a.move.id){ mvFail(m); }` — with no
  counterpart in the authority at all.

And the STATE was a **timer**: `_noRepeatT = (+lockoutTurns||1)+1`, ticked at the foot of every turn,
where the authority holds no clock and re-reads `pokemon.lastMove` at every request. On a turn the body
never reached `moveUsed` — a Taunted status click, a flinch, a full paralysis — the authority's
`lastMove` is untouched and the slot stays disabled, while our counter ran down.

### The fix

- The execution refusal is gone. It survives only behind `MEDI_CANTUSETWICE_EXEC_REFUSE=1`.
- `cantUseTwiceLocked(me,id)` derives the lock from `_lastMove`, which is written at this engine's
  `moveUsed` position — the same position `battle.ts:1692` reads.
- The authority's marker condition is counted at that same site (`MEDSEEN.cantUseTwiceRepeatRan`),
  which is where `battle-actions.ts:267` sits relative to `:291`.
- `moveDisabledBy` is exported so an instrument can ask THIS function rather than a second copy.

### The probe — `tests/probe_gigaton_repeat.js`, 9 arms, all clear

Knob `MEDI_CANTUSETWICE_EXEC_REFUSE=1`. Driver `game_differential.js`, arm `middle`, `--state`,
`--end-state`.

RED, before the fix (the primary arm, Instruct):

```
showdown  ... move|tinkaton|gigatonhammer -> -resisted|kingambit -> -damage|kingambit|87175
medicham  ... move|tinkaton|gigatonhammer|still -> -fail|tinkaton
board     b1 PART   p1.party.kingambit.hp  medicham 134  showdown 87
```

After: identical lines, boards identical, and the knob puts every red arm back apart.

| arm | kind | producer |
|---|---|---|
| `instruct-repeat-gigaton` | red | Oranguru Instructs the Tinkaton that just swung; one turn, no random-target draw |
| `instruct-repeat-gigaton-mirror` | red | sides exchanged whole |
| `encore-into-gigaton` | red | Whimsicott/Prankster Encores while the queued action is live; Champions rewrites it |
| `encore-into-gigaton-mirror` | red | sides exchanged whole |
| `blank-turn-keeps-the-lock` | red | Taunt eats the turn-2 status click, so `lastMove` is untouched and the slot stays disabled on turn 3 — the timer half; under the knob the lock read parts `b2:-/D` |
| `instruct-repeat-nonlocked` | control | the same splice with Facade, which carries no `cantusetwice` |
| `no-instruct` | control | the breaker cleared; its authority lines are asserted DIFFERENT from the red arm's |
| `gap-then-gigaton` | control | Gigaton, Facade, Gigaton — the turn-3 click IS on the authority's request |
| `no-encore` | control | Charm in the Encore's place |

Two things make the file hard to fool:

1. **The sensitivity check is the authority's own instrumentation.** `battle-actions.ts:267` raises the
   marker under exactly the condition this fix is about, and `:313` spends it on the `|-hint|` line — so
   the count of hints in Showdown's raw log IS the authority saying "a `cantusetwice` repeat ran". An arm
   declaring a repeat that produces no hint fails as a *fixture*, not as a verdict.
2. **The SELECTION lock is read at every boundary of every arm**, from Showdown's `moveSlot.disabled`
   against this engine's exported `moveDisabledBy`. Without it, a "fix" that deleted the mechanic
   outright would pass all five red arms and `gap-then-gigaton` too.

Fixture note: Play Rough (90%) was replaced by Facade after a shared accuracy die missed and the two
narrators wrote the miss differently — a second, unrelated divergence the file cannot tell from its own.

### The census probe was pinning the bug

`tests/test-mechanics.js` asserted that a **second caller-supplied** Gigaton Hammer deals 0.
`playerAction` is the Encore/Instruct road, not the menu, so the probe was green on the one behaviour
the authority never has and would have stayed green through the fix. Re-aimed to ask both moments: the
menu says `noRepeat`, and the forced repeat still lands. Census level unchanged: **829 live / 829
probed / 0 missing, 0 hollow, 0 threw, `run_ok: true`.**

### The `-hint` — a measured non-emission, not an omission

This engine emits no `-hint` at all. `-hint` is a **DECLARED** non-emission in
`data/protocol-events.json` (*"client hint text; carries no rule"*), it is absent from `TRACE_EVENTS`,
and `game_differential.js`'s `sdStream` therefore drops it from the **authority's** side as well. So the
missing line is invisible to the whole-game differential in both directions, and emitting it unclaimed
would fail `tests/test-protocol-trace.js` PART 1's unclaimed-event check. The probe asserts our count at
exact 0 and prints Showdown's beside it. **Not fixed here.**

---

## 2. THE SEVEN, ONE BY ONE

All seven re-read out of `data/_diag77-cards.json`, **including the lines after the split** — which is
what settles two of them, because #542 reasons from the first `-damage` line alone.

| # | card | mechanism | status |
|---|---|---|---|
| 1 | Moonblast into a Floette-Mega that switched in at `149/149` | Fairy Aura field presence (ENTRY) | **unchanged, open** |
| 2 | Moonblast into a Floette-Mega at `140/149 brn` | Fairy Aura field presence (ENTRY) | **unchanged, open** |
| 3 | Moonblast into Archaludon, aura holder switched OUT that turn | Fairy Aura field presence (EXIT) | **unchanged, open** |
| 4 | Moonblast into Gengar, aura holder FAINTED that turn | Fairy Aura field presence (FAINT) | **unchanged, open** |
| 5 | Beat Up into a Milotic that switched in at `170/170` | **the ORDER of `move.allies`, not the count** | **re-cut as ROADMAP #544** |
| 6 | Gigaton Hammer into Lucario, resisted | **Mold Breaker suppressing an ally's breakable Friend Guard** | **FIXED and measured** |
| 7 | Vacuum Wave into Gardevoir, gap of 1 | index-compatible | **unchanged, open** |

### Card 6 — it was never a Gigaton Hammer mechanic

#542 filed it UNATTRIBUTED and said *"a STEEL move that no aura can reach"*. That is right; the
multiplier was never an aura.

`friendguard` (`data/abilities.ts`) declares **`flags: { breakable: 1 }`**, and:

```
sim/battle.ts:836-841       (inside runEvent's handler loop)
  if (effect.effectType === 'Ability' && effect.flags['breakable'] &&
      this.suppressingAbility(effectHolder as Pokemon)) { ...; continue; }

sim/battle.ts:365-368
  suppressingAbility(target) {
    return this.activePokemon && this.activePokemon.isActive &&
           (this.activePokemon !== target || this.gen < 8) &&
           this.activeMove && this.activeMove.ignoreAbility && !target?.hasItem('Ability Shield');
  }
```

**The load-bearing word is `effectHolder`.** The gate is asked about the body *carrying* the handler,
and for `onAnyModifyDamage` that is the ALLY beside the target, not the target. `moldbreaker.onModifyMove`
sets `move.ignoreAbility = true`, so a Mold Breaker punches through a partner's Friend Guard. Champions
overrides neither ability. Friend Guard is the **only** legal `onAnyModifyDamage` carrier in Reg M-B
(derived on every probe run).

The sheets behind the card, read out of `data/team-pool-frozen`, name both bodies:

```
tinkaton      MoldBreaker  MetalCoat
mausholdfour  FriendGuard  ChopleBerry     (standing beside the Lucario)
```

Arithmetic, exact rather than close: the authority deals 70, we dealt 52, and
`tr((70*3072 + 2048)/4096) = tr(52.99) = 52` — one Friend Guard chain, applied by us and refused by the
authority.

`_hitCtx` read `_pal.ability` **raw** and never went through `suppressedAbility` — the function in the
same file that already reads the `breakable` tag, already refuses to let a body break itself
(`att === def`), and already honours Ability Shield and Mycelium Might's `onlyCategory`. Every other
breakable read in this engine goes through it. One site did not.

**`tests/probe_moldbreaker_ally_guard.js`, 5 arms, all clear.** Knob `MEDI_ALLY_GUARD_UNBREAKABLE=1`.
Showdown 68 / medicham 51 before, 68 / 68 after, 51 again under the knob.

| arm | attacker | ally | showdown |
|---|---|---|---|
| `moldbreaker-vs-friendguard` (red) | Mold Breaker | Friend Guard | 68 |
| `moldbreaker-vs-friendguard-mirror` (red) | Mold Breaker | Friend Guard | 65 |
| `owntempo-vs-friendguard` (control) | Own Tempo | Friend Guard | 51 |
| `moldbreaker-no-friendguard` (control) | Mold Breaker | Technician | 68 |
| `owntempo-no-friendguard` (control) | Own Tempo | Technician | 68 |

The claim is a **cross-arm equality read off Showdown alone**: a suppressed Friend Guard prices
identically to no Friend Guard at all (68 == 68), and differs from an unsuppressed one (51). Own Tempo
is the *same Tinkaton's* other legal ability, so the breaker is cleared on the same body rather than by
swapping the attacker — the first draft used two attackers and would have been comparing two damage
formulas rather than one gate.

### Card 5 — Beat Up is an ORDER defect, not a count

#542 reads `9 damage against 6, ratio 1.5` off the first `-damage` line and infers a different number of
hits, filing it under #333. The lines that follow refute that:

```
showdown  -damage 161/170 -> 154 -> 144 -> 137   |-hitcount|p1a: Milotic|4     per-hit 9, 7, 10, 7
medicham  -damage 164/170 -> 157 -> 147 -> 138   |-hitcount|p1a: Milotic|4     per-hit 6, 7, 10, 9
```

**Both engines print `-hitcount 4`.** Hits 2 and 3 are identical; hits 1 and 4 are the two that move.
Same count, near-identical multiset of per-hit powers, different order.

```
data/moves.ts:1150  beatup
  basePowerCallback: const setSpecies = this.dex.species.get(move.allies.shift().set.species);
                     return 5 + Math.floor(setSpecies.baseStats.atk / 10);
  onModifyMove:      move.allies = pokemon.side.pokemon.filter(
                       ally => ally === pokemon || !ally.fainted && !ally.status);
                     move.multihit = move.allies.length;
```

`move.allies` is built from **`pokemon.side.pokemon`**, which Showdown PERMUTES on every switch-in:

```
sim/battle-actions.ts:131-133
  pokemon.position = pos;
  side.pokemon[pokemon.position] = pokemon;
  side.pokemon[oldActive.position] = oldActive;
```

The entrant and the outgoing body swap indices, so after one switch the party array is no longer the
build order. This engine's `beatUpAllies` walks `att._sf.team`, the static build order; the FILTER is
faithful and was already corrected, the ORDER is not modelled at all. Two switch-ins occurred on the
attacking side in that game before the Beat Up. **Filed as ROADMAP #544; derived from the authority's
source and from the card, NOT probed and NOT fixed.**

Why nothing caught it: `tests/test-engine-diff.js` skips all 14 multi-hit moves by construction, and the
census stages the mechanic on a board with no switches, where build order and live order are the same
array.

---

## 3. THE MEASUREMENT

```
tools\lownode.cmd engine\game_differential.js --release 63cbcc2ef605 --arm middle --end-state \
  --census data/verification/census-pin-9446a684709d.json --games 1200 \
  --team-store data/team-pool-frozen --steering empirical --write \
  --out data/verification/fix-batch-9.json
```

| figure | before | predicted | after |
|---|---|---|---|
| board-material (961 - boards-never-diverged) | 60 | **59** | **59** |
| protocol first divergence | 162 | **161** | **161** |
| games whose boards never diverged | 901 | **902** | **902** |
| `threw` | 1 | 1 | 1 |
| end state SAME / DIFFERENT / APART / THREW | 924/33/3/1 | unchanged | 924/33/3/1 |
| turn-1 boards identical | 958 | — | 958 |
| census level | 829/829/0 | 829/829/0 | 829/829/0 |

**Every figure called before the run landed at its point estimate; none was a band-hit and none missed.**
The prediction was written to
`data/verification/_prediction-fix-batch-9.json` before the run and the baseline was read out of the
artifact by this pass, not lifted from a sweep.

Attribution, joined on `config|seed`:

- **the named game closed:** `omit-spread | ...-2663738910 vs ...-2663705570`, first board divergence
  turn 4, `p1.party.lucario.hp medicham 93 / showdown 75`, is gone from `first_board_divergences`;
- **the only class that moved is `-damage field 3`, 10 -> 9.** Every other class is identical;
- `first_divergences` is identical in membership and in cause (0 closed, 0 opened, 0 causes moved) —
  the protocol 162 -> 161 came from a game outside that capped 60-row list;
- the driver held still: `driver_code e87506b2d737` over 11 files, unchanged across the whole run
  (`driverCodeGuard`).

**The Gigaton half moved 0 pool games, as called.** The string `gigatonhammer` does not appear anywhere
in the new artifact. That was the scoreboard called in advance: a lab fix, because a forced repeat needs
an Encore or an Instruct landing on the same Tinkaton inside the window.

### The five clauses this release staled, re-run

| clause | result |
|---|---|
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | **0 of 6000** disagreed, both corners |
| `tests/roster.js --stage items --write` | 140 tested, `FIRED-AND-BOARDS-DIFFER` 0, `DID-NOT-FIRE` 0 |
| `tests/roster.js --stage abilities --write` | 129 tested, 0 and 0 |
| `tests/roster.js --stage moves --write` | 475 tested, 0 and 0 |
| `engine/all_mechanics_fire.js --kind all --write` | moves resolved 495/500, abilities fired 104, items fired 64 — identical to the previous release |

`node engine/status.js` reads **2 of 9 clauses failing**, and both are the whole-game clauses reading
`data/game-differential.json`, which was deliberately **not** rewritten (republishing is a settled-tree
pass).

---

## 4. OWED

- **ROADMAP #544 — Beat Up's ally ORDER.** Derived from the authority's source and from the card;
  **not probed and not fixed.** The instrument owed is a staged Beat Up under the `middle` pin whose
  user's side has switched at least once before the click, with the no-switch board as the control —
  the control is the half that matters, because build order and live order coincide there and an arm
  that only played it would pass today.
- **ROADMAP #542 (a) and (d) stand.** The four Fairy Aura field-presence games (entry, exit, faint) and
  the one index game are untouched, and the Fairy Aura instrument #542 owes has not been built.
- **The `-hint` line is not emitted and is not claimed.** Claiming it means `TRACE_EVENTS`,
  `engine/derive_protocol_events.js`, `data/protocol-events.json` and a new PART 1 board. That is the
  narration gate's work, not this pass's. It is invisible to the differential today in both directions.
- **`data/game-differential.json` is stale on purpose** and is what the gate prints. Republishing it is
  a settled-tree pass.
- **Nothing is committed.** Two probes, the engine change, release `63cbcc2ef605`, the re-run artifacts,
  the ROADMAP rows and the ENGINE.md section are on disk only. The living-docs pass (white paper, deck,
  technical docs, SUMMARY, MODELS, CHANGELOG + version bump) belongs to whoever commits them.
- **Reported, not chased, and nothing deleted:** `data/roster.{items,abilities,moves}.prev.json` were
  written by the roster re-runs (they keep the previous bytes by design), and `data/roster.json` was
  rewritten as the convenience copy of the last stage.
