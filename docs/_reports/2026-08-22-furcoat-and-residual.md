# ENGINE — Fur Coat, and the residual/upkeep/faint tail. 2026-08-22.

Historical record of one session, per CLAUDE.md §1. **Not maintained, not current state, superseded
by the register rows and the census it feeds.** The live numbers are `node engine/status.js`.

Engine release for everything below: **`18b227eee69f`** (cut 2026-08-22T20:00Z, re-cut 20:08Z over an
identical tree — same id by design).

---

## THE HEADLINE

| instrument | before | after |
|---|---|---|
| `data/mechanics-census.json` | 623 probed / **623 live** / 0 missing | 626 probed / **626 live** / 0 missing |
| `data/engine-diff.json` (seed 20260804, n 6000) | **24** disagree | **5** disagree |
| `tests/test-resolution-order.js` | 12 arms, 5 red, 6 control, 1 known-open | 14 arms, **6 RED PROVEN**, **7 CONTROL HELD**, 1 known-open, 0 failing |

Census rows gained (nothing lost, nothing flipped, one `detail` moved — the Monte-Carlo
`formatSecondaryChance` row this ledger already records as not reproducible run to run):

1. `ability/condStatMult` — *Fur Coat halves physical damage with no condition at all, and Mold Breaker takes it back*
2. `item/healsAtThreshold` — *a body the residual chain kills is DEAD before its Sitrus is reachable*
3. `move/userFaints` — *Final Gambit writes the USER's faint before the TARGET it just killed*

---

## BATCH 1 — FUR COAT (ROADMAP #317)

### The defect, derived not typed

```
Dex.forFormat('gen9championsvgc2026regmb').abilities.get('furcoat').onModifyDef
  -> onModifyDef(def) { return this.chainModify(2); }
```

`data/tags.json` gave `furcoat` one tag, `breakable`. The `condStatMult` derivation required
`if (pokemon.status)` in the handler, and the consumer in `dmgRange` was

```js
if(_cs&&_cs.mult&&_cs.when==='statused'&&def.status&&def.status!=='none'){...}
```

so an unconditional multiplier was **dropped at both ends with no counter**. That is the silent
default this division's brief is about: the ability had 8 sheet uses and a x2 on the most-clicked
category in the format, and nothing anywhere read zero.

### RED FIRST, on the shipped tree

```
phys ironhead:     ability blanked 83   furcoat 83     <- the knob does not move: UNWIRED
spec flamethrower: ability blanked 31   furcoat 31
```

and then, with the probe written and the tag not yet regenerated,
`node tests/test-mechanics.js` -> **`623 live, 1 missing`**, naming the new row.

### The fix

- `engine/tag_dex.js` — the `condStatMult` derivation reads the condition instead of requiring one:
  no branch -> `when:'always'`; `if (pokemon.status)` -> `when:'statused'`; **anything else REFUSED**.
- `engine/medicham2-browser.js` — the consumer evaluates `when` and counts what it cannot name
  (`MEDFAILS.condStatMultUnknownWhen`, 0 today).

**Membership printed before wiring** (every non-Past ability in the format declaring
`onModifyDef`/`onModifySpD`):

```
MATCH   furcoat      {"stat":"def","mult":2,"when":"always"}      <- NEW
refused grasspelt    onModifyDef(pokemon){ if (this.field.isTerrain("grassyterrain")) ... }
MATCH   marvelscale  {"stat":"def","mult":1.5,"when":"statused"}  <- unchanged
```

Grass Pelt is the reason the third arm is a refusal: a derivation that read "no status branch" as
unconditional would have handed it a permanent x1.5 Defence off the grass.

The regenerated `data/tags.json` diff is **one ability row plus the tag's own summary line**
(`n 1 -> 2`, `uses 51 -> 59`, example `Fur Coat` added). `data/abra-tags.js` rebuilt from it.

### The probe

Three knobs, each of which must move the right way:

```
[ability blanked, Fur Coat] — PHYSICAL Iron Head into Furfrou 83,42 (x1.98, must be ~2);
SPECIAL Flamethrower 31,31 (must NOT part — it is Defence, not bulk);
a MOLD BREAKER Iron Head through the same Fur Coat 83, which must equal the 83 the blanked body took
```

The Mold Breaker arm is what proves the multiplier arrives through the TAG and not through a name:
it is spent on `defAb`, the SUPPRESSED ability, so a hardcoded `def.ability === 'furcoat'` would
still halve it there.

### The 24 -> 5, and why the first version of it was not a before/after

The committed `data/engine-diff.json` was generated **18:49:56Z**. The ingest commit `1fe3ab3`
rewrote **`data/move-priors.json` at 18:53Z**, and `tests/test-engine-diff.js` draws both its species
list and its move rows from that file. My first post-fix run therefore walked a **different sample** —
`skipped_multihit` 170 against 154, a different `dropped_where`, a different insertion order — so the
comparison would have been across two populations.

Checked rather than assumed:

1. **the sampler is deterministic** — two consecutive runs on one tree agree on `compared`, `agreed`,
   `disagreed`, `skipped_multihit`, `dropped_by_exception`, the multihit-move table and the whole
   disagreement list;
2. **so the control was re-measured on today's inputs** — `data/tags.json` and `data/abra-tags.js`
   restored to HEAD (`TAGS.param('ability','furcoat','condStatMult')` asserted `null` before the run),
   the identical command re-run, artifacts restored afterwards byte-for-byte.

```
CONTROL  disagreed 24   skippedMulti 154   threw 58   by def {furfrou:19, aggron:1, gallade:1, tauros:1, roserade:1, swampert:1}
FIXED    disagreed  5   skippedMulti 154   threw 58
same sample?  multihit-moves true   dropped_where true
gone 19   remaining 5   new []
```

**19 Furfrou rows gone, 0 new.** The brief predicted "about 5" and it is 5.

### The residual 5 are one attacker, and the evidence points at the INSTRUMENT

All five are `aurorus hypervoice`. Single-case mode:

```
aurorus hypervoice -> aggron    showdown 18-21   medicham 64-76   DISAGREE  [refrigerate vs sturdy]
aurorus hypervoice -> snorlax   showdown 45-53   medicham 79-94   DISAGREE  [refrigerate vs immunity]
aurorus icebeam    -> aggron    showdown 54-63   medicham 54-63   AGREE
```

Aurorus's slot-0 ability is **Refrigerate**. Its `onModifyType` is an ABILITY handler, so it runs in
`runEvent('ModifyType', ...)` at **`sim/battle-actions.ts:438`, inside `useMoveInner`** — one level
above `battle.actions.moveHit`, which is the entry point `showdownDamage` must use. That is the same
layer gap `CONTROL FIX 5` in that file already records for `onTryHit` (Water Absorb).

Arithmetic consistent with it: an unconverted NORMAL Hyper Voice into Aggron against the same
Aurorus's STAB Ice Beam is `(90 x 0.25) / (95 x 1.5 x 0.5) = 0.316`; the measured ratio is
`21/63 = 0.33`. A converted Ice Hyper Voice would be `1.14 x` Ice Beam, which is what MEDICHAM reads.

**Filed, not fixed.** It is a control fix that moves this file's headline number, and a control
changed in the same pass as a result is how a comfortable answer gets manufactured. Next batch, with
its own red. If it holds, the differential clause of the quarantine gate is reachable.

---

## BATCH 2 — THE RESIDUAL / UPKEEP / FAINT TAIL

### #332 was already landed. The question that decides it had never been asked.

The `eachEvent('Update')` position was fixed earlier the same day (`docs/ENGINE.md`, THE ORDERING
PASS). `a4-red` asserts the **position** of `|-enditem|` against `|upkeep|`; the pre-existing
`healsAtThreshold` probe asserts an **HP total** on a body that survives on both engines either way.
The register's own decisive test — *"stage a Sitrus holder at an HP the residual chain exactly kills,
on both engines, and assert the body is dead on both"* — was not asserted anywhere.

Fixture, arithmetic rather than a damage roll:

- Froslass, max 145, on `floor(145/2)+1 = 73` — one point above its own Sitrus threshold, the idiom
  the neighbouring probe already uses;
- LEECH SEEDED (`onResidual` order 8, `floor(145/8) = 18`) and BADLY POISONED at counter 7
  (order 9, `floor(145/16) x 7 = 63`).

```
SEEDED    73 -> 55 (under half, berry now due) -> 63 lethal
          hp 0, fainted true, item "sitrusberry" NEVER EATEN, post-upkeep eats 0
UNSEEDED  73 -> 10, berry eaten below |upkeep| -> 46, item "", post-upkeep eats 1
```

The probe also asserts the fixture is the fixture: the seed crosses the threshold, the chip behind it
is lethal, **and** `afterSeed + restore > tox` — i.e. the berry would have saved it. Without that last
clause the two arms could differ for any reason at all.

**Shown red on a deliberate break.** `engine/medicham2-browser.js` recompiled in memory with the
one-line revert `tests/test-resolution-order.js` calls `berry-at-every-group`:

```
LIVE TREE        {"works":true,  "dies":[0,true,"sitrusberry"], "lives":[46,false,""]}
UNDER THE REVERT {"works":false, "dies":[28,false,""],          "lives":[46,false,""]}
```

Alive at 28, healed, berry spent — exactly the board consequence Will's card predicted — and the
control arm is UNMOVED, so it is the position and nothing else.

### #331's Final Gambit half IS a live defect, and the first arm proved nothing

The first draft of the arm had the TARGET clicking Protect. Nothing fainted, the streams agreed, and
the arm read green while staging **no faint at all** — the `selfdestruct: 'ifHit'` control arm wearing
the red arm's name. That is the fifteenth instance of this division's standing warning and it was
caught by reading the script, not by the result.

With the Gambit connecting (Basculegion 195 into Weavile 145, no roll needed):

```
showdown  |-damage|p2a: Weavile|0 fnt   |faint|p1a: Basculegion   |faint|p2a: Weavile
medicham  |-damage|p2a: Weavile|0 fnt   |faint|p2a: Weavile       |faint|p1a: Basculegion
```

378 corpus uses.

**The authority's order is a queue, not a print sequence.** `Pokemon#faint()`
(`sim/pokemon.ts:1587-1598`) sets hp to 0, pushes onto `faintQueue` and writes **nothing**;
`faintMessages()` drains it afterwards. Final Gambit's own handler queues the user while the damage is
still being computed:

```js
damageCallback(pokemon) { const damage = pokemon.hp; pokemon.faint(); return damage; }   // data/moves.ts:5306-5310
```

so the user is in the queue before the target has been touched, and comes out of it first.

The fix is two positions, held apart:

- **the STATE** (`hp = 0`, `fainted`) at the top of `_stepApply` — after `_stepDamage` has priced the
  move off the user's own HP (fainting any earlier prices it at zero) and before the target's HP
  moves. That is `damageCallback`'s moment, both halves of it.
- **the LINE** drained at `_stepFaint`, above its `!R.fainted` early return, plus a counted backstop
  below WIRE 46 for a hit a Substitute absorbed (which returns out of `_stepApply` before the faint
  step).

**The first attempt emitted the line at the callback and was one line too early** — above the
authority's own `|-damage|p2a: Weavile|0 fnt`, the same defect mirrored. The census probe asserts the
`-damage` line comes first for exactly that reason.

Gate, read out of `data/tags.json` and naming no move:

```
userFaints [6]:  explosion(always,43)  finalgambit(ifHit,378)  healingwish(ifHit,23)
                 memento(ifHit,57)     mistyexplosion(always,6)  selfdestruct(always,16)
of those with fixedDamage.source === 'myRemainingHP': [finalgambit]
```

Memento and Healing Wish are `ifHit` and deal no damage, so they can never race a target's faint and
correctly keep WIRE 46's position (`sim/battle-actions.ts:1287`).

New counters: `MEDSEEN.selfKOAtDamageCallback` (users killed at that site — 1 on the red arm, **0**
behind a Protect) and `MEDSEEN.selfKOLineFromBackstop`.

### The `always` half is measured, declared, and NOT fixed

`a3-boom-probe`, a KNOWN-OPEN arm. Metagross booms into a Weavile, its own partner behind a Protect:

```
showdown  |faint|p1a: Metagross   |faint|p2a: Weavile
medicham  |faint|p2a: Weavile     |faint|p1a: Metagross
```

Explosion 43 uses, Self-Destruct 16, Misty Explosion 6. The authority's site is
`if (move.selfdestruct === 'always') this.battle.faint(pokemon, pokemon, move)` at
**`battle-actions.ts:499`, above the whole hit** — which is above the Protect step too, so being
faithful means the user is at 0 HP for the entire hit: a Spiky Shield must not toll it and a
`boostsOnKO` must not fire off it. That is a state change with a blast radius this pass has not
measured, and the `ifHit` fix is a position inside one step. Staged so the claim carries a running
measurement instead of a sentence.

---

## WHAT ELSE MOVED, AND WHAT I DID NOT TOUCH

- **`board.js` needs no change.** It reaches damage through `medicham2`'s `dmgRange`
  (`engine/board.js:1371-1391`), so the Fur Coat fix propagates. `tests/test-engine-consistency.js`
  passes. `board.js`, `magnemite.js` and `engine-data.js` were not edited.
- **`tests/test-docs-current.js`: 21 passed, 0 failed** after the ENGINE.md section was added, and it
  gained no untraceable figures. It did NOT rewrite its baseline on my run.
- **Not run, deliberately:** the whole-game differential, the roster, the interaction matrix, any fit
  or self-play. The roster and whole-game artifacts now read `MEASURED AGAINST A DIFFERENT ENGINE` in
  `status.js`, which is the correct consequence of an engine release and is a re-run owed to whoever
  wants those numbers.
- **Observed, not caused:** `data/docs-currency-baseline.json` was rewritten at **19:48Z** by
  `tests/test-docs-current.js` while I was working (`changelog_top_at_baseline 5.67.0 -> 5.68.0`).
  Another agent is live in the tree. It did not touch anything this pass measured — both differential
  legs were proven to be the same sample.
- **The living-docs set is OWED and not done here**: CHANGELOG entry + version bump, whitepaper, deck,
  technical docs, SUMMARY, MODELS. `docs/ENGINE.md` is updated and `status.js --write` has restamped
  the generated blocks. Nothing is committed or pushed — one publisher.

## THE THREE THINGS THAT WOULD HAVE GONE WRONG SILENTLY

1. **the differential control.** Reading "24" off the committed artifact would have been a comparison
   across two team pools, because an ingest commit moved `move-priors.json` four minutes after that
   artifact was stamped.
2. **the Final Gambit arm.** A protecting target made it green while it staged nothing.
3. **the emission site.** Fixing the faint ORDER by emitting at the callback passes any probe that
   only asks which faint precedes which, and is wrong against `|-damage|`.
