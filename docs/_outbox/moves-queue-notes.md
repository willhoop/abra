# ROADMAP #139 — the moves queue, and the seven items handed over while it ran

ENGINE division, 2026-08-10/11. Every figure below was measured; nothing here is remembered.

**Census: 390 live / 390 probed → 407 live / 407 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed,
0 direct-call.** `node tests/test-engine-diff.js --n 20000` stayed at **0 disagreements** throughout.

Frozen releases cut for this work: `432477ef068d` (batches A+B) and `e5451d32f349` (batch C). The
pre-session engine is `07ffb4e75207`; every probe below was watched RED against it before a byte moved.

---

## THE ELEVEN

### FIRED-AND-BOARDS-DIFFER: 7 of 7 now PASS (moves stage, release `432477ef068d`)

| row | what was wrong | proof |
|---|---|---|
| toxic | the ramp was `floor(maxhp x stage / 16)`; the authority truncates the SIXTEENTH and multiplies after. 170 HP body: 10/21/31/42 against 10/20/30/40 | census probe `inflictsToxic` — "the Toxic ramp is the stage times a truncated sixteenth" |
| clangoroussoul | `data/tags.json` said the cost was 1/3. It is **33/100** — the fraction was a hand-written name table wearing a derivation's clothes. 150 HP body: 50 against 49 | `costsUserHP` probe, with the threshold arm (pays from 50, FAILS from 49) |
| steelbeam | `mindBlownRecoil` is a share of the USER'S MAX HP and the move table carries no `rc`, so a 140 BP click was **free** | `recoil` probe — 180 HP body pays 90, Iron Head pays 0, **Rock Head still pays 90** |
| noretreat | the second click re-applied instead of failing | `failsIfVolatile` probe — 1/1/1/1/1 twice, against Swords Dance stacking 2 → 4 |
| saltcure | THE TAG WAS RIGHT AND THE READER WAS MISSING — and the volatile was never even written: the secondary loop had a branch for status, target drops, self boosts, confusion and flinch, and none for a plain volatile | `perTurnHP` probe — Corviknight (Steel) loses max/8, Farigiraf max/16 |
| growth | `weatherScaled.byWeather.sun.boosts {atk:2, spa:2}` had no reader | `weatherScaled` probe, with a Swords-Dance-under-the-same-sun third arm |
| terrainpulse | the TAG carried `{scalesWith:'terrain'}` and nothing else — no type map, no doubling | `terrainScaled` probe: a GHOST isolates the type, a neutral body isolates the power, an Air Balloon isolates the ground |

### DID-NOT-FIRE: all 4 wired

`painsplit` (`sharesHP`), `copycat` (`callsAnotherMove`), `endure` (`survivesAnyHit`),
`metalburst` (`scripted` target). Each has its own probe with a control that fails.

### The two shelved rows Will asked for anyway

`block` and `meanlook` now carry `trapsTarget`, derived from their own `onHit`. The switch is refused
and a **Shed Shell walks out of it**.

---

## THE SEVEN ITEMS HANDED OVER MID-TASK

**1. Parental Bond — REAL, FIXED, and the acceptance test is Will's.**
The x1.25 was applied several stages after the authority's slot. Showdown applies
`modify(baseDamage, 0.25)` in the SPREAD MODIFIER'S slot and runs the whole formula again. Now a
two-packet plan through the existing per-hit loop.
Will's test — *"have mega kanga try and KO a mon holding a focus sash"* — is **binary and it passes**:

```
                                       frozen 07ffb4e75207        live
BOND into a Focus Sash holder          hp 1/30  down=false        hp 0/30  down=true
CONTROL 1: ability blank, same Sash    hp 1/30  down=false        hp 1/30  down=false
CONTROL 2: BOND, no Sash               hp 0/30  down=true         hp 0/30  down=true
```

Against the authority through `battle.actions.useMove` (top roll pinned, stats aligned): Fire Punch
frozen **43**, live **42**, Showdown **42**. `noExtraHit` is derived from the dex flags, so Solar
Beam, Fling, Explosion, Final Gambit, Dragon Darts and every charge move correctly get NO second hit.

*Not claimed:* the DAMAGE is still two packets summed into one range, as it is for the whole multi-hit
family. What the split buys is the ARRIVAL — the Focus Sash answers one packet — and reactions firing
twice. `|-hitcount|` is not emitted by this engine at all (declared, `derive_protocol_events.js`).

**2. Rage Powder / Follow Me — RETRACT. The redirect works; the fixture was confounded.**
Breaking Swipe is `allAdjacentFoes` — a SPREAD move. It hits both slots in Showdown too, and
redirection does not apply to it. Measured on the same board with two genuinely single-target moves:

```
                        drawer   partner
ragepowder, both single-target   146        0
followme,   both single-target   146        0
nothing clicked                    0      110
ragepowder + Breaking Swipe       94       48   <-- the 48 IS the spread move's own share
```

**3. Imposter — HALF RETRACT. The copy works, including stat stages. The REVERT did not exist.**
`battleInit(..., {seeded:true})` **skips entry effects by design** — the probe that read
`["transform"]` was staged that way. With a real entry, a Ditto in slot 0 becomes the foe's slot 1
(the diagonal), takes its species, stats, types, moves, ability AND boosts, keeps its own max HP.
Measured: boosts `{at:2,sp:1}` on the copied body crossed intact.
ROADMAP #95's actual open half was the revert, and it is now closed: switching out restores species,
stats, types, moves and ability. Probed with the copy asserted FIRST.

**4. ROADMAP #112 — RETRACT, PER ABILITY, WITH EVIDENCE.** All four fire, at the authority's exact
numbers (`dmgRange`, no roll confound, top roll pinned, stats and HP aligned):

```
overgrow  energyball    full sd 118 ours 118 EXACT | <=1/3 sd 175 ours 175 EXACT
blaze     flamethrower  full sd 132 ours 132 EXACT | <=1/3 sd 196 ours 196 EXACT
swarm     bugbuzz       full sd 276 ours 276 EXACT | <=1/3 sd 410 ours 410 EXACT
torrent   surf          full sd  85 ours 114 *** OUT   <-- STAGING, not the engine
```

Surf is `allAdjacent`: Showdown applied the 0.75 spread modifier and my `dmgRange` call passed
`spread=false`. 85/114 = 0.746. The ratio still reads 1.4941 against ours 1.5000, so Torrent fires.
**The ratios are 1.483–1.500 and not exactly 1.5 because the multiplier truncates before STAB and the
type chart** — that is the arithmetic, not an approximation. ROADMAP #112 should be retracted whole.

**5. Piercing Drill / Unseen Fist — TAG LANDED. The other agent's fixture is unblocked.**
`piercesProtect {bypassesProtect:true, onlyMoveFlag:"contact", appliesOnlyWhenBlocked:true,
damageMult:0.25}`, matched on SHAPE (`onHitProtect` writing `bypassProtect`), two members.
The 0.25 is **read out of `dist/sim/battle-actions.js`**, not typed and not parsed from the shortDesc —
it lives in the SIMULATOR, at the bottom of `modifyDamage`, not in the ability. Two facts the fixture
needs: the bypass is conditional on the CONTACT flag, and `checkMoveBypassesProtect` is called ONLY
from the protect family's own `onTryHit` — so a contact move into an UNPROTECTED body is never
quartered. That is arm 3 and it is a property of the authority, not of our reader.

**6. Shed Shell — FIXED, and the name is gone.** medicham2 said out loud *"SHED SHELL IS NOT HONOURED
ON THIS BRANCH"* and the other branch read it by NAME. `escapesTrap` is derived from the item's own
`onTrapPokemon`; exactly one item in the format declares one and no ability does. Both trap roads —
ability trapping and the partial trap — now ask the same tag.

**7. Suction Cups — TAG + READER.** There was no `suctioncups` row in `data/tags.json` at all.
`refusesForcedSwitch`, derived from `onDragOut` returning null; two members (`suctioncups`,
`guarddog` — no legal carrier here, which is a regulation fact, not a reason to name-match). It is
the MIRROR of `escapesTrap` and is a separate tag for that reason. Mold Breaker correctly ignores it.

---

## PP — SIZED, NOT STARTED, AND IT BELONGS AFTER THE ELEVEN

Confirmed: **zero PP anywhere in the engine.** The numbers are the format's and they are lower than
remembered — **Protect is 5, not 8**, on 112,177 clicks.

It is not bookkeeping. Five Protects is a resource, and an engine that believes Protect is infinite
makes every stalling rollout a game that cannot happen — which biases the search toward stalling.

**Size:** it touches `buildMon` (a `pp` map per body), `illegalMoveNow` / `chooseAction` (a spent move
leaves the menu), the turn loop (spend on use, and Pressure spends two), the switch path (PP survives
a switch, unlike every volatile), `board.js` and `position_features.js` (which are NOT mine), and the
rollout state that must survive a copy. It also unblocks three permanently-untestable roster rows:
Leppa Berry, Last Resort (0 mentions in the simulator) and Struggle.

**After the eleven**, because it is the first mechanic in this queue whose consumers live outside
ENGINE — and because the gate does not measure it, which is an argument that the gate is too narrow
rather than an argument for doing it now.

---

## THINGS I DID NOT DO, AND WHY

- **`|-hitcount|` is not emitted.** Declared in `engine/derive_protocol_events.js`. A stored replay
  carrying it still cannot be reproduced. Not in scope tonight and not silently skipped.
- **Aqua Ring and Ingrain came along for free** and are no longer DEFERRED — the same `perTurnHP`
  volatile map that ticks Salt Cure heals them, which is why the reader is a map and not a branch.
- **`data/tags.json` was regenerated five times and diffed every time** (ROADMAP #65). Entities
  removed: **zero**, at every step. Two over-matches were caught by the diff BEFORE a consumer read
  them — `curse` and `bellydrum` would have joined `costsUserHP` and Curse would have paid half its
  user's HP twice. That is the rule working, and it is the reason the predicate now requires a
  try-phase gate.

---

## THE ONE ROSTER ROW STILL RED, AND ITS CAUSE IS A DIFFERENT MECHANIC

`Copycat` still reads DID-NOT-FIRE on the moves stage. **The Copycat mechanism is wired and probed**
(census probe green, RED on `07ffb4e75207`, with a nothing-to-copy control that FAILS). What blocks
the roster row is a second, unfixed rule that the staging depends on:

> `Battle#addVolatile` returns **false** for a volatile already present whose condition declares no
> `onRestart`, and `clearActiveMove(failed)` then keeps `battle.lastMove` on the last move that
> actually **landed**.

The roster's generic staging idles every non-subject body on **Focus Energy**. In the authority the
second click FAILS, so `lastMove` stays on the aggressor's chip move and Copycat repeats THAT. In this
engine the repeat SUCCEEDS, so our Copycat faithfully repeats the inert click and moves no board.

Both halves of that rule are now correct on our side except the refusal itself: the failed-move clause
of `clearActiveMove` **is implemented** (a move whose `_mvRes` is false never becomes the last move).
What is missing is the no-restart refusal, and it must not be done blind — a blanket rule catches
Protect, Follow Me, Rage Powder and Helping Hand, every one of which MUST be re-settable. It needs its
own batch with the membership printed against the format before anything is wired, which is the rule
that caught `curse` and `bellydrum` earlier in this same pass.
