# `|-immune|` against `|-miss|` — No Guard's other half. 2026-08-27, ENGINE.

**WHERE THE IMMUNITY CHECK SITS, CITED — THE LEAD, BECAUSE IT IS WHAT THE BRIEF ASKED FIRST.**

`sim/battle-actions.ts`, `trySpreadMoveHit`'s `moveSteps` array. This is mainline `sim/`, and the
Champions mod does **not** override it: `grep -n "hitStep\|trySpreadMoveHit\|moveSteps"
data/mods/champions/scripts.ts` returns **no match** for any of the three (the mod overrides
`hitStepMoveHitLoop` at `:428` and `spreadMoveHit` at `:315`, both of which are *below* the step list).

```
sim/battle-actions.ts:556   this.hitStepInvulnerabilityEvent   // 0  semi-invulnerability
sim/battle-actions.ts:559   this.hitStepTryHitEvent            // 1  Protect, Magic Bounce, Volt Absorb
sim/battle-actions.ts:562   this.hitStepTypeImmunity           // 2  THE TYPE CHART
sim/battle-actions.ts:565   this.hitStepTryImmunity            // 3  powder, Prankster-into-Dark, onTryImmunity
sim/battle-actions.ts:568   this.hitStepAccuracy               // 4  THE DIE
```

and the only reorderings below it are `if (this.battle.gen <= 6)` and `if (this.battle.gen === 4)`
(`:578-586`), neither of which applies. **IMMUNITY IS TWO STEPS ABOVE ACCURACY.** A body the type
chart refuses never reaches the roll, so the authority prints `-immune` whatever the die would have
done — the two orderings are distinguishable exactly when both would have fired, and this game is
one of those.

**AND THAT ORDERING WAS NOT THE DEFECT.** medicham2 already has it. `_STEPS`
(`engine/medicham2-browser.js:29207`, pre-edit numbering) is
`[_stepInvuln, _stepTryHit, _stepTypeImm, _stepTryImm, _stepAccuracy, …]`, each step written with the
authority's line number in its header, and a staged Zap Cannon into a **standing** Golurk prints
`|-immune|` in both engines today. **The premise "medicham2 checks accuracy before immunity" is
refuted.** The defect is one step further up.

---

## 1. THE DIRECTION, READ OFF `classify()` AND NOT OFF THE PROSE

`engine/game_differential.js:4190`:

```js
return { cls, detail, cause: cls + ' :: ' + ga + ' <> ' + gb + raw };
```

with `ga = gen(sdHead)` and `gb = gen(meHead)` (`:4187-4188`), and `sdHead = d.sdAfter[0]`,
`meHead = d.meAfter[0]` (`:4161`). **The left field is SHOWDOWN, the right is MEDICHAM2.** So

```
unrelated event mismatch :: |-immune|p1a <> |-miss|p2b|p1a
```

is *the authority declares an immunity; we declare a miss*. The brief's reading was right.

The row, from `first_divergences` on release `f3383ff4aa29`:

```
config pair-protect-bust
seed   gen9championsvgc2026regmbbo3-2660356793 vs gen9championsvgc2026regmbbo3-2660492912
turn   10, index 115, 115 lines agreed first
showdown  |-immune|p1a: Golurk
medicham  |-miss|p2b: Raichu|p1a: Golurk
```

## 2. WHAT THE BODIES ACTUALLY WERE — AND THE ANSWER IS IN THE ITEMS

Both sheets are in the pinned pool (`data/team-pool-frozen/games.bo3.jsonl`). p1 is 2660356793's p2
side, p2 is 2660492912's p1 side. The two entries that decide this:

```
p1 slot 0  golurk  item Golurkite   ability IronFist      moves HeadlongRush PhantomForce IcePunch Protect
p2 slot 1  raichu  item RaichuniteY ability LightningRod  moves FakeOut ZapCannon FocusBlast Protect
```

Derived from `Dex.forFormat('gen9championsvgc2026regmb')`'s Champions dex, never typed:

```
Golurk         Ground/Ghost   {0:Iron Fist, 1:Klutz, H:No Guard}
Raichu-Mega-Y  Electric       {0:No Guard}          requiredItem "Raichunite Y"
Zap Cannon     Electric  Special  acc 50  ignoreImmunity false
getImmunity('Electric', ['Ground']) === false     <- Ground REFUSES Electric
getImmunity('Electric', ['Ghost'])  === true      <- Ghost does not
```

So the turn is: **Golurk is mid-Phantom-Force, and the Raichu that swings at it has mega-evolved into
No Guard.** The line above it in `showdown_before` corroborates the vanish — `|move|p2a: Sneasler|Dire
Claw|p1a: Golurk|[miss]` then `|-miss|`, a **100-accuracy** move missing, which only step 0 can do.

**REPRODUCED WITH THE REAL SHEETS BEFORE ANY BYTE MOVED** (scratch, not committed): Golurk clicks
Phantom Force on turn 1, Raichu megas and then clicks Zap Cannon on turn 2 —

```
MEDICHAM2   |move|p2b: Raichu|zapcannon|p1a: Golurk
            |-miss|p2b: Raichu|p1a: Golurk
```

## 3. THE MECHANISM: HALF AN ABILITY WAS WIRED

`data/abilities.ts` — mainline, and `grep -n noguard data/mods/champions/abilities.ts` returns
**nothing**, so this is the Champions rule too:

```js
noguard: {
  onAnyInvulnerabilityPriority: 1,
  onAnyInvulnerability(target, source, move) {
    if (move && (source === this.effectState.target || target === this.effectState.target)) return 0;
  },
  onAnyAccuracy(accuracy, target, source, move) { … return true; },
  …
}
```

Two handlers, one guard clause, and the guard names **either end** of the move. `trySpreadMoveHit`
keeps a target whose step result is zero:

```
sim/battle-actions.ts:605   targets = targets.filter((val, i) => hitResults[i] || hitResults[i] === 0);
```

`0` is falsy but is not `false`, so the `-miss` in `hitStepInvulnerabilityEvent` (`:633-640`, gated on
`hitResults[i] === false`) is not written and the row survives to step 2, where
`Pokemon#runImmunity` (`sim/pokemon.ts:2242`) writes the bare `this.battle.add('-immune', this)`.

**medicham2 wired the `onAnyAccuracy` half only.** `_neverMissAb` (`:7657`) reads the ability off
`ACCMOD`'s `never` flag and `hitChance` (`:8212`) consults it on both bodies — correctly, and with a
comment saying why both. `_invulnDecide` (`:25769`) consulted **Lock-On and the charging move's own
`pierces` list and nothing else**. Phantom Force declares an EMPTY `pierces`, so the row was dropped
at step 0 with a `-miss` and the immunity two steps below was never asked.

**THE FILE HAD ALREADY WRITTEN DOWN THE SHAPE OF THIS BUG**, about Lock-On, at `:3949`:

> *"One predicate, called by the accuracy path and by the semi-invulnerability step, because the
> authority's condition answers both questions (`onSourceAccuracy` returns true,
> `onSourceInvulnerability` returns 0) off the same two clauses … Two copies of that pair is how one
> of the two halves ends up wired and the other does not."*

That is exactly what happened to No Guard, which is why the fix calls **the same predicate** rather
than adding a second reading of the tag.

**THE TAG MATCH WAS PRINTED BEFORE IT WAS WIRED.** Everything carrying `writesAccuracy`:

```
compoundeyes  {setsTo:null, mult:1.3, scope:"its own moves"}
hustle        {setsTo:null, mult:0.8, scope:"its own moves"}
noguard       {setsTo:1,    mult:null, scope:"every move, both directions"}
sandveil      {setsTo:null, mult:0.8, scope:"moves aimed at it"}
snowcloak     {setsTo:null, mult:0.8, scope:"moves aimed at it"}
tangledfeet   {setsTo:null, mult:0.5, scope:"moves aimed at it"}
```

The predicate goes through `ACCMOD['ability:noguard'].never`, whose membership is asked by SHAPE and
whose carriers are audited by `tests/test-engine-diff.js`. **No over-match**: only No Guard carries
`never`, and the census run under the knob moved exactly one row and no other (754 live / 1 missing
against 755 / 0).

## 4. THE FIX

`engine/medicham2-browser.js` only. One new predicate beside `_neverMissAb`:

```js
function noGuardThroughInvuln(att,def){
  if(!_neverMissAb(att)&&!_neverMissAb(def))return false;
  if(NOGUARD_INVULN_BLIND){MEDFAILS.noGuardInvulnBlindRestored=1;return false;}
  MEDSEEN.noGuardThroughInvuln++;
  return true;
}
```

called at **three** sites, all of which already asked `guaranteedAgainst` (Lock-On) and none of which
asked this:

| site | what it is |
|---|---|
| `_invulnDecide` | the attack road's step 0, the shipped path |
| `_stepInvuln` | the same verdict under `MEDI_INVULN_BELOW_SHIELD=1`, so that knob still changes only the STAGE |
| the `a.kind!=='attack'` branch | the non-attack road's step 0 (`statusMissedInvuln`) — **this one hides**, and a fix applied to the damaging path alone leaves it |

It is placed **last** in the non-attack branch's condition chain, so Lock-On, Helping Hand and a
Poison-type's Toxic short-circuit ahead of it and the counter means *bodies carried*, never *times
asked*.

Knob: `MEDI_NOGUARD_INVULN_BLIND=1`. Counters: `MEDSEEN.noGuardThroughInvuln`,
`MEDFAILS.noGuardInvulnBlindRestored`. The `MEDFAILS` flag is set only where the knob **changed the
answer**, so it cannot read 1 off an arm carrying no No Guard.

## 5. THE PROBES, RED FIRST

**`tests/probe_noguard_invuln.js`** — two engines, five arms, one turn each, `--turns 1` spliced in
before the driver parses argv so nothing downstream of the measured line can move.

Fixture: Machamp (No Guard, 55 Spe) swinging at a Dragapult (Infiltrator, 142 Spe) that vanished with
Phantom Force on the same turn. **The immunity-reason count is DERIVED and printed per arm and the
file refuses a target with more than one** — Dragapult is Dragon/Ghost, only Ghost refuses Fighting,
its ability carries no absorb tag and it holds no item: `reasons: ["type:Ghost"]`, one.

```
arm                                            authority   clean     --red
A  vanished + Fighting  No Guard                immune     immune     miss   PARTS
B  vanished + Ice       No Guard                hit        hit        miss   PARTS
F  vanished + ScaryFace No Guard                unboost    unboost    miss   PARTS
C  vanished + Fighting  Steadfast  [control]    miss       miss       miss   HOLDS
D  STANDING  + Fighting No Guard   [control]    immune     immune     immune HOLDS
```

RED FIRST, measured, before a byte moved: A/B/F all failed (`showdown immune vs medicham miss`,
`showdown hit vs medicham miss`, `showdown unboost vs medicham miss`) and both controls held.
After: `GREEN — every claim held over 5 staged turns`; `--red`: `GREEN` with A/B/F required to PART.
Receipt asserted at exact equality: `MEDSEEN.noGuardThroughInvuln === 3` clean, `=== 0` under the knob,
`MEDFAILS.noGuardInvulnBlindRestored === 1` under the knob and `=== 0` clean.

**Arm B is the load-bearing one for the DIRECTION of the fix** — no immunity anywhere in it, so it
says the change is *No Guard sees through the vanish* and not *an immune body reports sooner*.
**Arm C is the load-bearing control** — a change that simply stopped dropping semi-invulnerable rows
passes A, B and F and fails C.

**Census row** — `tests/test-mechanics.js`, `ability|writesAccuracy`, *"No Guard reaches a
semi-invulnerable body, and the IMMUNITY below it is what answers"*. Three clicks against a cleared
control (`bare()` leaves the ability at `'none'`). Under `MEDI_NOGUARD_INVULN_BLIND=1` it goes
MISSING and **no other row moves**.

**THE PROBE WAS WRONG BEFORE THE ENGINE WAS, TWICE, BOTH ON THE SAME FIELD NAME.** The Scary Face arm
first read `f1.boosts.spe` — this engine's boost keys are its own (`SD2ENG` at
`medicham2-browser.js:5320` maps `spe -> sp`), so it printed `0` against `0`, which reads exactly like
an unwired gate. Fixed to `sp`; then the trace assertion read `\|sp\|` where the PROTOCOL writes
`\|spe\|`. Both are recorded in the probe's own comments.

## 6. THE SCOREBOARD — PREDICTED BEFORE THE RUN, AND IT HELD

Predicted: **whole-game falls by 1, board-material stays 1**, because an immunity and a miss both deal
zero damage. Measured, identical sample proven rather than assumed:

| | before (`f3383ff4aa29`) | after (`e5957689f94f`) |
|---|---|---|
| whole-game clause | **5 of 961** (10 raw, less 5 declared) | **4 of 961** (9 raw, less 5 declared) |
| board-material (`games − games_board_never_diverged`) | **1 of 961** | **1 of 961** — unmoved |
| census | 754 live / 754 probed / 0 missing | **755 / 755 / 0** |
| mechanics clause | 5 of 12 | 5 of 12 — unmoved |
| roster items / abilities / moves | 0 DIFFER, 0 DID-NOT-FIRE | 0 / 0 on all three |
| damage differential | 0 of 6000 × 16 corners | not re-run — see §8 |

Comparability, field by field: same `games` 961, same census steering digest `9446a684709d` over 643
rows, same team pool digest `0d103fb9fa87` (8,778 teams, 1,968 picked), same pin digest
`2efbc9ed1946`, same 12,450 turn boundaries compared and 12,439 identical, `threw` 0 both.
**Exactly one first-divergence removed and none arrived** — the removed one is
`pair-protect-bust | …2660356793 vs …2660492912`, the Golurk pair, by name.

**The scoreboard called before the run, per the standing rule:** No Guard is 117 uses and this is the
pinned pool's only game of its shape, so the pool was expected to move by exactly one and the LAB was
expected to gain a row. Both did.

## 7. THE TWO THINGS THE BRIEF ASKED ME TO SEPARATE

### 7a. Does anything key on "failed" against "missed"? **No — the one thing that does is banned here.**

`hitStepAccuracy` is the only step that distinguishes them, and the only consumer in it is
**Blunder Policy** (`sim/battle-actions.ts:745`, `if (!move.ohko && pokemon.hasItem('blunderpolicy')
&& pokemon.useItem()) this.battle.boost({spe: 2}, pokemon)`). Derived:
`Dex.forFormat(…).items.get('blunderpolicy').isNonstandard === 'Past'` — **BANNED in Reg M-B**, and
medicham2 has no reference to it at all (`grep -c blunder engine/medicham2-browser.js` is 0).

Everything else treats the two identically and was checked rather than assumed: `atLeastOneFailure`
is set by `hitStepInvulnerabilityEvent`, `hitStepTypeImmunity` and `hitStepAccuracy` alike, so
`moveThisTurnResult` is `false` in every one of them and **Stomping Tantrum doubles either way**; the
crash family (`_crashOnFail` / `onMoveFail`) pays on any failure. Nothing in scope.

### 7b. Substitute above accuracy — **A SECOND DEFECT, NOT THIS ONE. Not fixed in this batch.**

They are different in kind and in direction.

- **This one was a MISSING HANDLER with the stage order already right.** medicham2's `_STEPS` matches
  `moveSteps`; what was absent was `onAnyInvulnerability`.
- **Substitute is a genuine STAGE-ORDER defect, and only on the STATUS road.** In the authority the
  doll answers in `tryPrimaryHitEvent` (`sim/battle-actions.ts:1138`), called from `spreadMoveHit`
  (`:1057`), called from `hitStepMoveHitLoop` (`:947`) — **`moveSteps` index 7, three steps BELOW
  accuracy at index 4.** Champions overrides both and keeps the nesting (`scripts.ts:315`, `:346`,
  `:518`). medicham2 asks `subBlocks` inside `_asTryHit` — the status road's `_ASTEPS`
  (`medicham2-browser.js:22052`) index **1**, three steps ABOVE accuracy.
- **The damaging road is already right**: its `subBlocks` sits in `_stepApply`, `_STEPS` index 8.
- Observable: a sub-100 status move (Thunder Wave 90, Hypnosis 60) into a Substitute. The authority
  rolls first, and a miss prints `|-miss|` with the doll never mentioned; medicham2 prints
  `|-activate|…|move: Substitute|[damage]` and takes no die at all.
- It is already declared in `docs/ENGINE.md`'s instrument table, on
  `probe_spread_status_steps.js`'s row: *"the SUBSTITUTE step sits above accuracy here and below it in
  the authority — both declared, neither staged."* It stays declared and unstaged.

## 8. WHAT I DID NOT RUN, AND WHY

**The 6,000-row damage differential at sixteen corners.** Owed only if damage moved, and it did not:
the change adds one predicate at step 0 of the hit-step list and touches nothing inside `dmgRange`,
`getDamage`, the modifier chain or the roll index. The `PASS` clause in `engine/status.js` is the
06:34 artifact, which predates the edit — stated rather than quietly quoted.

**A refit.** `data/policy-weights.json` is quarantined and the refit is MEASURE's; `status.js` already
reports `REFIT OWED` and it is not made worse or better by this.

**`node engine/tag_dex.js`.** A tag for `onAnyInvulnerability` would be the more precise derivation
than reusing `writesAccuracy`'s `never` flag, and it is the right shape long-term. It is NOT done
here: regenerating `data/tags.json` is a SOURCES-file rewrite whose last attempt is on record as
having dropped five entities, and it would be a second change in one batch.

---

## OWED, NOT RUN

```bash
# nothing in this section is a prerequisite of the numbers above; each is a separate claim.

# 1. THE DAMAGE DIFFERENTIAL AT ALL SIXTEEN CORNERS. Not owed by this change (no damage code
#    moved), but the shipped PASS clause was measured at 06:34 on the previous release.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  tools\lownode.cmd tests\test-engine-diff.js --rows 6000 --all-corners --write

# 2. SUBSTITUTE ABOVE ACCURACY ON THE STATUS ROAD (§7b). A SECOND defect, deliberately not
#    touched here. The probe does not exist yet; the arm it belongs beside is
#    tests/probe_spread_status_steps.js, whose ledger row already declares it.
#    Staging shape: a 90-accuracy Thunder Wave into a Substitute, roll pinned to LOSE.
#    The authority must print |-miss| and never mention the doll.

# 3. A DERIVED TAG FOR onAnyInvulnerability (§8), replacing the reuse of writesAccuracy's
#    `never` flag. Costs a tags.json regeneration and belongs in its own batch.
node engine/tag_dex.js            # <- NOT run this pass. Read docs/ENGINE.md on the 2026-08-06
                                  #    regeneration that dropped five entities before running it.

# 4. RE-CHECK THAT THE THREE ROSTER STAGES AND all_mechanics_fire STILL SIT ON THE SHIPPED
#    RELEASE after any further engine edit — they were re-run on e5957689f94f this pass and
#    status.js WITHHOLDS them the moment the tree moves again.
SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage items --write
SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage abilities --write
SHOWDOWN_PATH=... tools\lownode.cmd tests\roster.js --stage moves --write
SHOWDOWN_PATH=... tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release <id>

# 5. THE PUSH. `git push` is REJECTED — another session is ahead of origin and holds a dirty
#    tree; rebase/merge/stash were all refused by the permission layer. This work is COMMITTED
#    LOCALLY AND NOT PUSHED, which is the expected outcome and not a failure.
```
