# The 22 damaging `self` moves — which door, which are reachable, how many batches

ROADMAP #364. READ-ONLY DERIVATION, 2026-08-23. No engine file, no test file and no artifact was
written; no game was played; no release was cut. `data/roster.*.json`, `data/game-differential.json`
and `data/all-mechanics-fire.json` were **not read** (mtimes 22:36–22:41 EDT against a 22:45 clock —
a gate chain was mid-write). `data/mechanics-census.json` was read from `git show HEAD:` for a stable
copy rather than off disk.

**Sources.** Membership and every move property: `Dex.forFormat('gen9championsvgc2026regmb')` at
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`, with the champions mod's own
overrides checked file by file. Corpus counts: `data/abra-tags.js`, generated 2026-08-22T19:29:03Z,
198,840 sheet entries, 794,368 total move clicks. Engine behaviour: read out of
`C:\Users\willj\Projects\Pokemon\ABRA\engine\medicham2-browser.js`.

---

## 0. THE HEADLINE, BEFORE THE DETAIL

- **21 of the 22 are already correctly gated.** Three of the four `self` shapes carry the failed-hit
  gate today, and one of them (`recharge`) carries it *because* ROADMAP #161 / WIRE 43 measured this
  exact door in August and got it backwards once first.
- **One shape is not gated: `locksIntoMove` — Outrage, Petal Dance, Raging Fury, Thrash, Uproar.**
  WIRE 144's arming site tests only `!m.fainted`. Its own comment claims it "sits below every
  `continue` that means the move did not happen at all". That is true for a **Protect** and false for
  every other refusal.
- **There is ONE door, not five.** In the authority the whole family funnels through
  `selfDrops`' `if (target === false) continue`, and `targets` is emptied by six upstream hit-steps.
  The engine's four *implementation sites* are what differ, not the mechanism.
- **It is a tail: 142 corpus clicks, 0.02%.** The 30,180-click boost family — Close Combat and
  friends, the bulk of #364's 7.6% — is already right. Said plainly so nobody sizes this off the
  register row's percentage.
- **One batch**, with a second seam explicitly deferred and a third handed off.

---

## 1. THE 22, DERIVED

`D.moves.all().filter(x => x.exists && !x.isNonstandard)` filtered on a non-empty `self` returns
**25** legal moves. Three are Status — **Baton Pass**, **Shed Tail** (both `self: { onHit }`, which
serialises as `{}` because the key is a function) and **Roost** (`self: { volatileStatus: 'roost' }`,
the heal-primary member #343 fixed). The remaining **22 are damaging**, and they fall into four
`self` SHAPES:

### Shape A — `self.boosts` (10 moves, 30,180 clicks, 3.80% of all clicks)

| move | cat | acc | `self` | uses | legal carriers |
|---|---|---|---|---|---|
| Close Combat | Phys | 100 | def −1, spd −1 | 18,305 | 72 |
| Make It Rain | Spec | **95** | spa −2 | 3,681 | 1 (Gholdengo) |
| Draco Meteor | Spec | 90 | spa −2 | 2,942 | 21 |
| Overheat | Spec | 90 | spa −2 | 2,227 | 42 |
| Leaf Storm | Spec | 90 | spa −2 | 1,494 | 35 |
| Superpower | Phys | 100 | atk −1, def −1 | 880 | 80 |
| Hammer Arm | Phys | 90 | spe −1 | 378 | 21 |
| Ice Hammer | Phys | 90 | spe −1 | 106 | 5 |
| Headlong Rush | Phys | 100 | def −1, spd −1 | 103 | 4 |
| Armor Cannon | Spec | 100 | def −1, spd −1 | 64 | 1 (Armarouge) |

*Champions overrides Make It Rain* (`data/mods/champions/moves.ts`): accuracy **95** and
`self.boosts.spa: **−2**`, against mainline's 100 / −1. Its target is `allAdjacentFoes` — the only
spread member of the 22. Everything in the table is the format's value, not mainline's.

### Shape B — `self.volatileStatus: 'mustrecharge'` (6 moves, 4,193 clicks, 0.53%)

Hyper Beam 4,078 (326 carriers) · Giga Impact 64 (332) · Hydro Cannon 24 (13) · Blast Burn 10 (14) ·
Rock Wrecker 9 (1, Rhyperior) · Frenzy Plant 8 (13). All 90 accuracy.

### Shape C — `self.volatileStatus: 'lockedmove' | 'uproar'` (5 moves, 142 clicks, 0.02%)

Outrage 113 (79 carriers) · Petal Dance 18 (9) · Uproar 7 (104) · Raging Fury 4 (3) · Thrash 0 (47).
**All five are 100 accuracy and all five target `randomNormal`.**

### Shape D — `self.onHit` (1 move, 49 clicks, 0.01%)

Burn Up, 9 legal carriers (Arcanine, Arcanine-Hisui, Typhlosion, Typhlosion-Hisui, Emboar,
Emboar-Mega, …). Champions' override is `{ inherit: true, isNonstandard: null }` — it does nothing
but make the move legal; the handler is mainline's `setType(Fire → '???')`.

Every one of the 22 has at least one legal carrier in the regulation. Nothing here is inert for want
of a user.

---

## 2. WHICH DOOR — AND THERE IS ONE, NOT FIVE

### The authority

`trySpreadMoveHit` (`sim/battle-actions.ts:550`) runs a data-driven `moveSteps` array and **filters
the target list after every step**:

```js
targets = targets.filter((val, i) => hitResults[i] || hitResults[i] === 0);
if (!targets.length) break;
```

so a target refused by **invulnerability (step 0)**, **TryHit / Protect / an absorbing ability
(step 1)**, **type immunity (step 2)**, **a move-specific immunity (step 3)**, **the accuracy roll
(step 4)** or **break-protect (step 5)** never reaches `hitStepMoveHitLoop`, therefore never reaches
`spreadMoveHit`, therefore never reaches step 4 `selfDrops`, which opens
`for (const target of targets) { if (target === false) continue; }` (`:1321`).

**Those six are entrances, not doors.** The door is one line. Three consequences follow, and each is
a thing that could have been guessed wrong:

- **A SUBSTITUTE IS NOT A REFUSAL.** `spreadMoveHit` step 0 writes `targets[i] = null` for a hit the
  doll ate, and `null !== false`, so `selfDrops` still runs. Close Combat into a Substitute **does**
  drop the user's defences. The engine agrees by construction — `connected = true` is assigned
  *above* the substitute early return at `medicham2-browser.js:20870`, and its declaration comment
  says so deliberately.
- **A SECOND, INTERNAL DOOR EXISTS AND NO TRIGGER FOR IT HAS BEEN IDENTIFIED AMONG THESE 22.** Inside
  `spreadMoveHit`, `getSpreadDamage` writes `damage[i] = false` when `getDamage` returns
  `false`/`null`, and `runMoveEffects` writes `damage[i] = false` when the primary effect did nothing
  — that second one is precisely #343's failed-Roost door. For a damaging move with no
  `damageCallback` and no heal-primary effect the value is always a number (0 survives: the guard is
  `if (!damage[i] && damage[i] !== 0)`). **Unprobed. I am not claiming it unreachable, only that I
  found no trigger.**
- **`self` IS PAID ONCE PER MOVE, NOT ONCE PER TARGET**, guarded by `move.selfDropped` — *unless*
  `move.multihit`, in which case Showdown deliberately does not set the flag. **No member of the 22
  is multihit**, so that branch is unobservable here. Declared rather than left to be rediscovered.

### The engine — four sites, three gated

| shape | site | gate today | matches the authority? |
|---|---|---|---|
| A `self.boosts` | `_stepSelfPay`, `:22652` — `const sdrop = connected ? (a.move.mv && a.move.mv.self) : null` | `connected` | **yes** (WIRE 65) |
| B `mustrecharge` | `_stepSelfPay`, `:22668` + backstop `:23268` | `_reached > 0` | **yes** (WIRE 43 / #161) |
| D `spendsOwnType` | `:22934` | `connected` | **yes** (#210) |
| **C `locksIntoMove`** | **WIRE 144, `:23293`** | **`!m.fainted` only** | **NO** |

`_reached` is incremented at the top of `_stepDamage` (`:20501`) — i.e. "this row survived
invulnerability, TryHit, both immunities, accuracy and break-protect", which is exactly
"`targets[i] !== false` at the moment `selfDrops` runs". `connected` is set one step later, in
`_stepApply`, above the substitute return. Both are faithful readings of the same door.

**THE PROTECT CASE IS THE TRAP, AND IT IS WHY WIRE 144'S COMMENT READS TRUE.** This engine answers
Protect *above* the step list (`:20098`–`:20157`), removes shielded bodies from `targets`, and then
`if (_hadTargets && !targets.length) { … continue; }`. So a fully-shielded Outrage leaves the branch
hundreds of lines before WIRE 144 and never arms anything. Every other refusal — a miss, a type
immunity, an absorbing ability, a semi-invulnerable body — only sets `R.out` on the row; control
still falls through the whole step list and reaches `:23293`. **This is the identical shape as
#161's finding for the recharge**, whose own comment says: *"The Protect row is why the old line
looked right … the ONLY family that was wrong was the one the shield never covers — an immunity."*

**WHAT WIRE 144 ARMS ON A REFUSED HIT — two effects, not one.** The same `if` block also runs the
Uproar sweep:

```js
if(!m.fainted&&TAGS.has('move',a.move.id,'locksIntoMove')){
  … m._mtLock={move,left,confuse,vol,blockSleep};
      refreshSleepBlock(actA,actB,sfA,sfB);          // field-wide sleep refusal, THIS TURN
  if(_lk&&_lk.wakesSleepers) for(const _b of [...actA,...actB])
      if(_b&&!_b.fainted&&_b.status==='slp'){ _b.status=''; … }   // wakes BOTH sides
}
```

In the authority the wake is `uproar.onTryHit` — a **move-level** handler, run by
`singleEvent('TryHit', moveData, …)` at the **top of `spreadMoveHit`**, not by
`hitStepTryHitEvent`. That site is still below all six hit-steps, so **the wake carries the same
`_reached > 0` gate as the lock** — but it sits *above* the damage, where the lock sits *below* it.
Two effects, one gate, two positions.

**MEMBERSHIP OF `locksIntoMove`, PRINTED BEFORE PROPOSING ANY WIRING**, over `data/abra-tags.js`:
`outrage(113) petaldance(18) ragingfury(4) thrash(0) uproar(7)` — **exactly five, no over-match.**

---

## 3. WHICH OF THE 22 CAN ACTUALLY DIVERGE

Reachability is asked in two halves, and conflating them is how this gets overclaimed: **(i) is the
door reachable for this move in this format**, and **(ii) is the engine wrong at that door today**.

### (i) Door reachability — all 22, by construction

Every one of the 22 carries `flags.protect: 1`, so Protect reaches all of them; Protect is legal and
common in Reg M-B. But Protect is the one refusal this engine already exits above, so it decides
nothing here. The refusals that *do* reach the ungated site:

| move | type immunity in the format | absorbing ability | miss | semi-invuln |
|---|---|---|---|---|
| **Outrage** (Dragon) | **Fairy — 34 legal species** | none for Dragon | acc 100, only via stages | yes |
| **Thrash** (Normal) | **Ghost — 40 legal species** | — | acc 100 | yes |
| **Uproar** (Normal, `sound`) | **Ghost — 40** | **Soundproof** | acc 100 | yes |
| **Petal Dance** (Grass) | none | **Sap Sipper** | acc 100 | yes |
| **Raging Fury** (Fire) | none | **Flash Fire**, **Well-Baked Body** | acc 100 | yes |

Absorbing abilities were derived from the format's own ability handlers, not recalled: 18 legal
abilities carry an `onTryHit` refusal, and the type-matching ones above are `sapsipper`,
`flashfire`, `wellbakedbody`, `soundproof`.

**So all five Shape-C members are reachable, and Outrage-into-a-Fairy is the common board.**

### (ii) Engine correctness at that door — the honest split

| moves | status | how I decided |
|---|---|---|
| **5** — Outrage, Petal Dance, Raging Fury, Thrash, Uproar | **DIVERGES — predicted, not measured** | Traced control flow at `:23293`. A type-immune or missed row sets `R.out`, leaves `_reached` at 0, does not `continue`, and reaches an arming site whose only test is `!m.fainted`. |
| **10** Shape A + **6** Shape B + **1** Shape D | **PREDICTED CORRECT — unprobed** | Each reads a gate (`connected` / `_reached > 0`) that is a faithful reading of `target !== false`. Shape B's immunity arm was measured against the authority in #161; Shape A's Protect arm was measured by the generated pair matrix in WIRE 65; Shape D's Protect arm was measured in #210. **None of the three has ever been probed at a MISS or a TYPE IMMUNITY.** |

**Neither row is promoted to "measured".** `data/mechanics-census.json` (630 probed, 630 live, 0
missing) holds two `lowersUser` rows, one `recharge` row, one `spendsOwnType` row and **six**
`locksIntoMove` rows, and **every one of the ten stages a hit that LANDS.** There is no probe in the
census — none — that asserts a self-rider on a hit the authority refused. #364's "INSTRUMENT OWED"
is exactly right and is still owed.

**No corpus corroboration either way.** `data/divergence-turns.json` (2026-08-21, safe to read, not
in flight) contains **zero** occurrences of Outrage, Uproar, Thrash, Petal Dance or Raging Fury.
That is what 142 clicks in 198,840 sheet entries buys — absence of evidence, and it is quoted as
such.

---

## 4. THE FIX AND ITS RIPPLE

### The fix

One gate, on one block, in the shape WIRE 43 already uses two dozen lines above it:

```
:23293   if(!m.fainted && TAGS.has('move', a.move.id, 'locksIntoMove')){
   ->    if(!m.fainted && _reached>0 && TAGS.has('move', a.move.id, 'locksIntoMove')){
```

with a counter on the refused arm (`lockSkippedNoTarget`, mirroring `rechargeSkippedNoTarget`) so
that a skip is loud rather than silent. Nothing else changes: the tag, the params, the turn count,
the confusion and the wake list all stay where they are.

### The ripple — derived by asking what reads the user's state, not from a list

WIRE 144 sits at the **bottom** of the attack branch. Below it are only WIRE 44 (`cantUseTwice`), a
comment block, and then the branch closes into `flushAfterMoveSpends`, `opportunistSettle`,
`receiverSweep`, `traceSweep`, `fallenSettle`, the `sideWiped` check and `_updateAll`. **None of
those reads `_mtLock`.** So the "between the skip and the end of the hit" window is **empty for the
lock itself** — and that is the trap the last two passes fell into. The real consequences are one
step out, and there are three:

1. **SAME TURN, IMMEDIATELY: `refreshSleepBlock(actA, actB, sfA, sfB)` is called synchronously inside
   the block.** Its own comment says why: *"The field fact changes the instant the lock is armed, so
   a Spore thrown LATER IN THE SAME TURN is refused."* A **failed** Uproar therefore refuses a Spore,
   Hypnosis, Sleep Powder or Yawn thrown by a slower body on the same turn, on a board where the
   authority lets it land. This is a board change, not a line change.
2. **SAME TURN, IMMEDIATELY: the `wakesSleepers` sweep mutates `status` on every sleeping body on
   BOTH sides.** A woken foe that has not yet acted then acts. A failed Uproar currently hands the
   opponent a turn.
3. **NEXT 2–3 TURNS: `_mtLock` is read in five places** — `selectableMoves:9077` (hard lock, the menu
   can never empty to Struggle), `refreshSleepBlock:11052` (`blockSleep`), the action override at
   `:14592` (the caller's click is discarded and the locked move is played), the PP site at `:16051`
   (**the locked turns are free — one PP for the whole rampage**, which the census already proves),
   and the residual at `:24311` (tick, `lockBrokenBySleep`, and `confusion` on expiry). The census row
   *"a locked body is TRAPPED — the switch is refused"* means a spuriously-armed lock also **removes
   the switch** for two to three turns.

So the ripple of the *skip* is: no lock, no trap, no forced click, no free PP, no end-of-run
confusion, no sleep block, no wake. All of which is the authority's behaviour.

### The ripple of MOVING it, if anyone is tempted to

WIRE 43's fix did not just add a gate, it **relocated** the arm into `_stepSelfPay` (step 9 of 15) to
match `selfDrops`' position. Doing the same for the lock would expose steps 10–15 (`_stepEffects`,
`_stepDamagingHit`, `_stepBuffOnHit`, `_stepAfterHit`, `_stepFaint`, `_stepHitCount`) to a set
`_mtLock`. **Checked, and it is vacuous:** all five Shape-C moves carry `formatSecondaryCount: 0`, so
`_stepEffects` inflicts nothing on the user, and nothing in steps 10–15 reads `_mtLock` or the sleep
block. **A relocation is therefore unnecessary for the lock and buys nothing measurable.**

The **wake** is the opposite: its authority position (top of `spreadMoveHit`, above the damage) is
genuinely different from where the engine pays it (bottom of the branch), so the `|-curestatus|`
lines come out after the `|-damage|` instead of before. That is a protocol-order defect **only**, and
it should not ride in the same batch as the gate.

---

## 5. SIZING — ONE BATCH, PLUS TWO THINGS THAT ARE NOT IT

**BATCH 1 — the only engine change. `_reached > 0` on WIRE 144.** One line, one counter, five moves,
two effects. Attribution is clean because both effects share one gate and one value.

Probes, and the control is cleared explicitly in each:

| probe | arm | control | what it must show |
|---|---|---|---|
| Outrage into a **Fairy** | the lock | the **same** Outrage, same seed, into a **non-Fairy** body | RED today: locked/trapped in both arms. GREEN after: free in the immune arm, locked in the control. |
| Uproar into a **Ghost** (or a **Soundproof** body), with a sleeping partner and a Spore thrown later in the turn | the wake **and** the sleep block | the same Uproar into a legal body | RED today: partner wakes and Spore refused in both arms. GREEN after: partner stays `slp` and the Spore lands in the immune arm only. |

**Land Shape A / B / D's three control probes in the SAME run**, because a probe that is green on its
first run proves nothing on its own — green next to Batch 1's red is what makes it a control rather
than a decoration, and it is what closes #364's "one staged pair per `self` SHAPE" without an engine
change:

- Close Combat into a **Ghost** — the Def/SpD drop must not happen (Shape A, 18,305 clicks).
- Hyper Beam into a **Ghost** — no `mustrecharge` (Shape B; this is #161's own measured board).
- Burn Up into a **Flash Fire** body — the user keeps its Fire type (Shape D).

Expected: five census rows added, three green on the first run, two red until the gate lands.

**BATCH 2 — DEFERRED, DO NOT MERGE INTO BATCH 1. The Uproar wake's position.** Move it from the
bottom of the branch to the top of the hit (below `_stepBreakProtect`, above `_stepDamage`), matching
`singleEvent('TryHit', moveData, …)` at the head of `spreadMoveHit`. **State-identical once Batch 1
lands; the probe is a line-order assertion, and it cannot be attributed if it rides with a gate
change.** Seam is exact: Batch 1 changes *whether*, Batch 2 changes *when*.

**BATCH 3 — NOT ENGINE'S TO LAND, REPORTED NOT FIXED. `selfBoost` is a THIRD authority site and this
engine has merged it into the second.** Found while checking `locksIntoMove` for over-match; it is
adjacent to #364 and is not one of the 22:

- `data/abra-tags.js`'s `lowersUser` has **13** members, not 10: it also holds **Clanging Scales
  (1,162 uses)**, **Scale Shot (258)** and **Shell Smash (1,092)**.
- Derived from the format: Clanging Scales and Scale Shot carry **`selfBoost`**, not `self`
  (`clangingscales.self === undefined`, `selfBoost === {boosts:{def:-1}}`); Shell Smash carries plain
  `boosts` with `target: 'self'`. **All three nevertheless report `readFrom: "m.self.boosts"` in the
  tag, which is false for all three.**
- `selfBoost` is applied at `sim/battle-actions.ts:520` — in `useMoveInner`, **outside**
  `trySpreadMoveHit`, gated on `moveResult`, and therefore **below `faintMessages` and below
  `applyRecoilDamage`**, where `self.boosts` is **above** both.
- `data/engine-data.js` merges `selfBoost` into `mv.self`
  (`"clangingscales":{…,"self":{"def":-1}}`), so `_stepSelfPay` pays it at Shape A's position. **The
  gate is right; the position is one faint too early.** The census row *"the user's own stat drop is
  paid BEFORE the KO it scored is announced"* is correct for Close Combat and wrong for Clanging
  Scales and Scale Shot.
- **Fixing it requires telling the two provenances apart, and the only place that distinction can
  live is `data/engine-data.js`, which ENGINE may not edit.** Per CLAUDE.md this is a refit and
  belongs to MEASURE. **Reported, not attempted.** 1,420 clicks, protocol-order only.

---

## 6. WHAT THIS REPORT DOES **NOT** CLAIM

- It does not claim the five diverge. **It predicts they do, from control flow, and names the two
  probes that would decide it.** Nothing was staged.
- It does not claim the other 17 are correct. **It predicts they are, and says the census has never
  asked.**
- It does not claim a strength gain. 142 clicks is 0.02% of the corpus; the per-event state change
  (a trapped, forced, PP-free body for 2–3 turns, ending in confusion) is large, but nothing
  measurable from ENGINE follows from that, and the register row's 7.6% belongs almost entirely to a
  family that is already right.
- **The census was not regenerated and `engine/status.js --write` was not run** — both write
  artifacts, and a gate chain was in flight. The census figure quoted (630 / 630 / 0) is `HEAD`'s.
- **Usage counts here are from `data/abra-tags.js` and differ from the ones in ROADMAP #364**, which
  reads a different corpus cut ("clean clicks", 424,933): Close Combat 18,305 here vs 18,600 there,
  Draco Meteor 2,942 vs 3,291, Hyper Beam 4,078 vs 1,708. Both are sheet counts, neither is a
  measurement of how often the mechanic fires, and the artifact I actually read is the one cited.
