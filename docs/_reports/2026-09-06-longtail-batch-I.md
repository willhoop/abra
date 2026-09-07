# ENGINE — long-tail batch I (2026-09-06)

Resumed after the previous attempt exited. Baseline at start: **board-material 18 of 961**, protocol
89, narration 70, release `1fc8ed7adfd7`, cap 20, `middle` arm, `empirical-click/v1`, census pin
`9446a684709d`, `--team-store data/team-pool-frozen`, census 830/830/0.

---

## 0. THE FILE LEFT ON DISK DID NOT RUN, AND THAT IS THE FIRST FINDING

`tests/probe_reaction_address.js` (346 lines, untracked) **was a syntax error**, twice:

```
tests/probe_reaction_address.js:164
        + 'authority addresses Gengar's 30% roll there (0.2640 -> it fires). medicham2 addressed it '
                                      ^ SyntaxError: Unexpected identifier 's'
```

and the same shape again at the `the authority's roll went the way` claim string. So it had **never
been executed** — every number in its header was written from reading the authority, not from running
anything. Judged on merits rather than adopted: the two apostrophes were repaired, and then the
*claims* were checked one at a time against what the file actually measures.

**The diagnosis in its header is CORRECT and I re-derived it independently before touching the
engine**, from the Showdown source rather than from the file's prose:

- `sim/battle-actions.ts:1092-1101` — the save/restore around steps 4 and 5, with the authority's own
  comment saying why (`needs to be preserved for Dancer`).
- `:1117` — `this.battle.runEvent('DamagingHit', damagedTargets, pokemon, move, damagedDamage)`.
- The **only** writers of `activeTarget` in the whole file are `:693` (`hitStepAccuracy`),
  `:1093/1101` (the save/restore) and `:1154` (`getSpreadDamage`'s per-target loop) — `grep -n
  activeTarget sim/battle-actions.ts sim/battle.ts`. `runEvent` takes an ARRAY and writes it nowhere.

So every `onDamagingHit` / `onSourceDamagingHit` die is addressed to **the last body
`getSpreadDamage` reached**, whichever body the handler is running on.

**Two of the file's own claims were WRONG and are corrected in the tree**, both about the engine
rather than the authority — see §1.

---

## 1. THE FIX — a `DamagingHit` reaction is addressed to the lingering slot

**RED FIRST, on published bytes `113ee1bd`** (`node tests/probe_reaction_address.js`, no knob):

```
RED-1  spread Rock Slide, Cursed Body in the FIRST slot
    showdown  p21|0        -> 0.2640, |-start|...|Disable FIRES
    medicham  p20|0        -> 0.8933, it does not
    |-start Disable lines:  showdown 1   medicham 0
RED-2  spread Icy Wind, same shape, address only     showdown p21|0  vs  medicham p20|0
CONTROL  Cursed Body in the LAST slot        identical  (the defect is POSITIONAL)
CONTROL  single-target Iron Head             identical
CONTROL  spread whose OTHER body Protects    identical
RED — 4 claim(s) failed over 5 staged turns
```

That is the `omit-weather / gen9championsvgc2026regmbbo3-2658746306` board-material row,
`p2.active[1].vol.disable  medicham 0 / showdown 3`, turn 3.

**WHAT THE LEFT-BEHIND FILE GOT WRONG ABOUT THE ENGINE.** It asserted the whole repair sits at
`_stepDamagingHit`. It does not: wiring only that step left **every arm still parted** while the new
counter read 8, which is the clean signature of a wire that ran and was not where the die is thrown.

- `disablesAttacker` (Cursed Body, the probe's own reactor) is paid in **`_stepEffects`**, not in
  `_damagingHit`.
- `poisonsOnMyContact` (Poison Touch, `p: 0.3`) is paid there too.
- Derived from `data/tags.json` rather than assumed: of the reaction families, only
  `punishesAttacker` (13 members, chance-gated in Cute Charm / Effect Spore / Flame Body / Poison
  Point / Static) lives in `_damagingHit`; `buffsHolderOnHit`'s five members
  (angerpoint, electromorphosis, justified, stamina, weakarmor) carry **no chance param at all**, so
  they throw no die and are deliberately left unwrapped.

**The change** (`engine/medicham2-browser.js`):

| where | what |
|---|---|
| `_dmgLastSlot`, move scope beside `_secAddrSlot` | the damage step's last slot, and it CANNOT share `_secAddrSlot` — that one is MOVED by `_secFired`, and the authority RESTORES the pre-secondary value before `DamagingHit` |
| `_stepDamage` | `_dmgLastSlot=_secAddrSlot` at the one line that mirrors `:1154` |
| `_reactAddr(fn)` | swaps `MID_TGT` for the call and restores it, exactly as `_secDraw` does |
| `_stepDamagingHit`, the interior-arrival `_damagingHit(1)`, Cursed Body's 30%, Poison Touch's 30% | the four sites that spend it |
| `MEDI_REACT_ADDR_PER_TARGET=1` | the revert knob, receipt `MEDFAILS.reactAddrPerTargetRestored` |

**AFTER**: `GREEN — every claim held over 5 staged turns`, and `--red` is also GREEN, i.e. RED-1 and
RED-2 PART under the knob and all three controls HOLD.

Receipt `MEDSEEN.reactionAddrFromLastSlot = 13`, derived: 8 blocks (2+2+2 damaged rows on the three
spreads, 1+1 on the single-body arms) + 5 draws (Cursed Body once per arm).

**It is an INSTRUMENT wire and cannot move a game.** `MID_TGT` is read by `midEventDraw` and nothing
else, so no self-play game, rollout or seeded census probe can tell the two arms apart. What it moves
is the differential: the two engines stop spending each other's numbers.

---

## 2. MEASURED — the sample line, in full

```
node engine/game_differential.js --steering empirical --release 0362ccffd3fe --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write \
     --out data/verification/batchI-post.json
```

(`--out` keeps the published slot free while a second agent is measuring. **`--out` alone writes
nothing** — the whole artifact block is inside `if (WRITE)`, so the first run of this command without
`--write` produced console output and no file; the run was repeated. Both runs are the same pins and
returned the same figures.)

| | before (`1fc8ed7adfd7`, `data/game-differential.json`) | after (`0362ccffd3fe`) |
|---|---|---|
| **BOARD-MATERIAL** = `state.games` − `state.games_board_never_diverged` | **18 of 961** | **17 of 961** |
| protocol games parted | 89 | 88 |
| narration-only (raw / less declared) | 71 / 70 | 71 / 70 |
| turn boundaries identical | 10483 / 10549 | 10486 / 10549 |
| census live / probed / missing | 830 / 830 / 0 | 830 / 830 / 0 |

**Exactly one game left the board-material set and none arrived** — set-differenced on
`config|seed` over `state.first_board_divergences`:

```
- omit-weather | gen9championsvgc2026regmbbo3-2658746306 vs ...-2658828809
```

which is the `p2.active[1].vol.disable  medicham 0 / showdown 3` row, i.e. the game the probe stages.

### Predictions, hit and missed

| | claim | outcome |
|---|---|---|
| P1 | clean arm green on 5 arms, `--red` parts the 2 and holds the 3 | **HIT** |
| P2 | `MEDSEEN.reactionAddrFromLastSlot` reads **8** | **MISS — it reads 13.** The 8 blocks were right; the prediction was written before I found that Cursed Body and Poison Touch are paid in `_stepEffects` and draw there, which added 5 more sites. The counter's DEFINITION grew, not the wire's reach — and the miss is the reason the first cut of the fix left every arm still parted. |
| P3 | the `omit-weather / 2658746306` row leaves the set | **HIT** |
| P4 | board-material 18 → 17, one row and no more | **HIT, exactly** — one left, none arrived |
| P5 | census does not fall from 830 | **HIT** — 830 / 830 / 0, and it cannot fall by construction: `MID_TGT` is unreadable outside `midEventDraw` |

**A second Poison Touch game is still board-material and this fix did not touch it**:
`|-status|p2a|psn|[from]poisontouch <> |upkeep` at turn 3. Its die is now thrown at the right
address; whatever parts it is a different defect, and it is NOT claimed here.
---

## 3. THE OWED CURSE/PRESSURE OVER-CHARGE **DOES NOT EXIST** — refuted, not fixed

The brief carried it as derived and owed: *"a non-Ghost Curse is over-charged by 1 PP into a Pressure
foe. It prints on every run of `tests/probe_pressure_terrain_target.js`."* It printed, but nothing had
ever measured it — the line is a COMMENT, not an instrument reading.

**The premise is true and the conclusion did not follow.** The authority does rewrite the target
(`curse.onModifyMove` -> `nonGhostTarget: 'self'`, before `getMoveTargets`, so `pressureTargets` holds
only the user and Pressure refuses an ally) and this engine does price Pressure off
`targetClass.pressureScope`, which carries the STATIC word `normal`. What the inference missed is that
**medicham2 resolves the type split when it BUILDS the action** — `|move|p1a: Clefable|curse|p1a:
Clefable` — so the PP road already sees the user in the target field and `ppPressureExtra`'s
`t === user` clause refuses it. Same answer, different road.

Five staged arms, `MEDSEEN.ppPressureCharged` movement, boards compared at every boundary:

| arm | charged | board |
|---|---|---|
| non-Ghost Curse, the Pressure foe NAMED | **0** (the accusation predicted 1) | identical |
| non-Ghost Curse, TWO Pressure foes | **0** | identical |
| non-Ghost Curse, Pressure in the UNAIMED slot | **0** | identical |
| non-Ghost Curse aimed at slot 1 | **0** | identical |
| **GHOST Curse, same click, same foe, same ability** | **1** | identical |

The Ghost arm is the knob-cleared control and it is what makes the four zeroes evidence: without it a
dead Pressure wire reads identically. `tests/probe_curse_pressure_pp.js` is that measurement, GREEN,
and it is kept as the standing refutation rather than deleted — the comment it refutes would otherwise
be re-derived by the next reader from the same true premise.

`tests/probe_pressure_terrain_target.js`'s comment and its printed detail string are corrected in the
same pass, so the false residue stops being announced on every run.

**One adjacent case is NAMED and NOT claimed**: a GHOST user clicking Curse at its own ALLY is
rewritten to `randomNormal`, and the authority then charges the re-rolled foe's Pressure where this
engine's ally-skip charges nothing. At most 1 PP on a click nobody makes, unstaged because the
directed script format has no ally-aim. Reported, not assumed absent.
---

## 4. A SUBSTITUTE'S OWN ROLL IS ADDRESSED TO THE BODY THAT PUT IT UP — the second address defect

Found by replaying the largest board-material bucket's turn-1 row (`baseline /
gen9championsvgc2026regmbbo3-2635208589`, `-crit: a different body :: |-crit|p2a <> |-crit|p2b`,
`p2.party.whimsicott.hp medi 65 / sd 86`) with the address hooks on both engines:

```
showdown   crit|rockslide|p21|0  dmg|rockslide|p21|0  crit|rockslide|p21|1  dmg|rockslide|p21|1
medicham   dmg|rockslide|p20|0   crit|rockslide|p20|0  dmg|rockslide|p21|0  crit|rockslide|p21|0
```

**The authority prices a doll BEFORE it re-aims.** `spreadMoveHit` step 0 is `tryPrimaryHitEvent` over
ALL targets (`:1053-1058`), the substitute's `onTryPrimaryHit` calls `this.actions.getDamage(...)`,
and the last thing to have written `activeTarget` is `hitStepAccuracy`'s own per-target loop
(`:693`) — `getSpreadDamage` (`:1154`) does not run until step 1. So both of the doll's draws are
addressed to the LAST body the accuracy step reached. `hitStepMoveHitLoop` filters `targets` after
every step (`:605`), so "last" means last SURVIVING, which is exactly the set this engine's driver
walks.

**The change**: `_accLastSlot` written at the top of `_stepAccuracy` (mirroring `:693`, including for
a row that MISSES, because the authority writes it before its own miss branch), and `_subAddr(on,fn)`
spending it around the two draws in `_stepDamage` when `subBlocks` says a doll will eat this hit.
Knob `MEDI_SUB_ADDR_PER_TARGET=1`, receipt `MEDFAILS.subAddrPerTargetRestored`.

`tests/probe_substitute_roll_address.js` — RED before (the spread arm parts a BOARD,
`p2.party.milotic.hp medi 136 / sd 137`), GREEN after, and GREEN under `--red` with the three
controls holding: doll on the LAST body (the positional control), single-target, and no doll at all.

### THE PROBE WAS ASKING NOTHING AND CAUGHT ITSELF DOING IT

Its board claims read `r.stateDiv` — which `playGame` only fills when the run asked for the state
comparison. Neither new probe pushed `--state`, so **every board claim printed "identical at every
boundary" for a board that was never compared**, on arms where the two engines were writing 136 and
137. Found by printing `G.lastSdLog()` beside `r.mediTrace` and seeing them disagree while the probe
said they matched. Both new probes now push `--state --end-state` before the require, with the reason
written above the line. **The Curse refutation in §3 was re-run under real board comparison and is
still green** — its verdict did not rest on the vacuous claim.

### MEASURED — and P7 MISSED

```
node engine/game_differential.js --steering empirical --release 3c5e1b1dd284 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write \
     --out data/verification/batchI-post2.json
```

**BOARD-MATERIAL 17 of 961 — unchanged.** Predicted 16.

The prediction was not wrong about the fix, it was wrong about the count. The accusing game left the
set at turn 1 and **re-entered it at turn 3 on a different leaf**:

```
before  turn 1   p2.party.whimsicott.hp   medi 65    sd 86
after   turn 3   p2.party.heliolisk.hp    medi 68    sd 102
                 p2.party.heliolisk.item  medi sitrusberry   sd ""
```

That is the brief's own warning arriving — *a fix reveals rows the old defect hid* — and it is the
honest reading: the crit divergence is closed and a **berry that this engine does not eat** was
sitting underneath it. Heliolisk pays half its HP to Shed Tail (137 -> 68, and 68 <= 68.5), the
authority's Sitrus fires and heals 34, and this engine leaves the berry in the pocket. **Named, not
claimed fixed.**

No other game entered or left: the set difference between `batchI-post.json` and `batchI-post2.json`
is empty in both directions.
---

## 5. A FAINT REPLACEMENT WALKS IN AND NOTHING RAISES `Update` — **board-material 17 -> 16**

The leaf §4 uncovered, chased to its rule. `eachEvent('Update')` at `sim/battle.ts:2858` is the TAIL
of `runAction` and runs for **every** action. `residualUpdatePass` already models that line for the
residual action, and its own header is right that it must sit ABOVE `refill()` — *"the replacements
are issued past this point"*. What was missing is that the replacement switch is then **its own
action**, and `runAction` closes it with the same call. So a body that walks in already at or below
its berry's threshold eats **before** the turn boundary; this engine ate on the far side of it, and
the board the differential compares is sampled AT that line.

```
showdown   |switch|p2a: Heliolisk|68/137   |-enditem|Sitrus Berry|[eat]   |-heal|102/137   |turn|4
medicham   |switch|p2a: Heliolisk|68/137   |turn|4   |-enditem|sitrusberry|[eat]   |-heal|102/137
```

**Both engines ate it. Only the moment differed.**

**The change**: one `residualUpdatePass(actA,actB,field,-1)` below `traceSweep` after `refill()` —
below, because the switch-in abilities run inside the action and `:2858` is its tail. Knob
`MEDI_NO_REFILL_UPDATE=1`, receipts `MEDSEEN.refillUpdatePasses` / `refillUpdateAte` /
`MEDFAILS.refillUpdateSkipped`. **This one is a GAME knob, not an instrument knob**, and the file says
so beside it.

`tests/probe_refill_update_pass.js`: RED before (the board parts at t1,
`p2.party.volcarona.hp medi 80 / sd 120`), GREEN after, GREEN under `--red`. **The fixture is derived
rather than chosen** — Volcarona is the ONLY legal body 4x weak to Rock and not Flying, so Stealth
Rock takes it to exactly `maxhp / 2` (160 -> 80) and the berry's own `hp <= maxhp / 2` is true on the
nose; the probe prints that derivation and refuses to run if it stops being true. Three controls: the
same entrant with **no berry** (so a hazard fix would part here), a **voluntary** switch onto the same
rock (already correct — a different road, and it must not move), and the same replacement with **no
hazard** (the silent arm).

### MEASURED

```
node engine/game_differential.js --steering empirical --release 0c8b0dc63766 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write \
     --out data/verification/batchI-post3.json
```

| | before | after |
|---|---|---|
| **BOARD-MATERIAL** | 17 of 961 | **16 of 961** |
| narration-only (raw / less declared) | 71 / 70 | 71 / 70 |
| board never diverged | 944 | 945 |
| census live / probed | 830 / 830 | 830 / 830 |

**P10 hit** (that row left), **P11 hit** (16, exactly one), **P12 hit**, **P13 hit** (narration flat).
One game left the set, none arrived.
---

## 6. FILED, NOT FIXED — **the authority picks a spread move's named target AT RANDOM, and this engine picks the first live foe**

Found while chasing the last PP-only row (`pair-speedctrl / ...bo3-2662992072`,
`p1.pp[0].hypervoice medi 3 / sd 2`). Its cause line is

```
|cant|p1a: Sylveon|par   <>   |move|p1a: Sylveon|hypervoice|p2b: Raichu
```

— a paralysis roll the two engines resolved differently, which is why one spent the PP and the other
did not.

**IT IS THE ADDRESS AGAIN, AND THE ADDRESS IS DOWNSTREAM OF THE NAMED TARGET.** Staged, a paralysed
Sylveon clicking Hyper Voice at two live foes, the `any`-category draws each engine asked for:

```
showdown   1|any|hypervoice|p20|0     2|any|hypervoice|p21|0
medicham   1|any|hypervoice|p20|0     2|any|hypervoice|p20|0     3|any|hypervoice|p21|0
```

One draw per turn on each side — the 12.5% full-paralysis check — and on turn 2 they are addressed to
DIFFERENT BODIES. **The click named `t: 0` explicitly in both engines**, so this is not the script
being vague.

**THE RULE, READ RATHER THAN GUESSED** (`sim/battle.ts`):

- `validTargetLoc(targetLoc, source, targetType)` has cases for `normal`, `randomNormal`, `scripted`,
  `adjacentAlly`, `adjacentAllyOrSelf`, `adjacentFoe` and `any` — and **falls off the switch returning
  `false` for `allAdjacentFoes` / `allAdjacent`**.
- so `getTarget` skips its "use selected target location" branch entirely and ends at
  `return this.getRandomTarget(pokemon, move)`.
- `getRandomTarget` in doubles ends at `pokemon.side.randomFoe()`, which is
  `this.battle.sample(actives)` — **a random draw over the live foes**.

So **every spread click in doubles names a randomly chosen foe**, and that body is `activeTarget` for
the whole action — the anchor of every `any`-category address in it. This engine names the first live
foe, deterministically.

**Two consequences, and the second is the expensive one:**
1. the `|move|` line names a different body (narration), and
2. every `any` draw in that action is addressed differently — the paralysis check, and anything else
   that rides that scope — so two correct engines spend each other's numbers.

**NOT ATTEMPTED IN THIS BATCH, DELIBERATELY.** It changes the named target of **every spread click in
every game**, in both engines' narration and in the dice addressing, so it can move many games in both
directions at once. That is a batch of its own with its own prediction, not a fourth change at the end
of this one. The staged reproduction above is the red arm it needs; `MEDSEEN.randomTargetDrawn` /
`randomTargetAmbiguous` (ROADMAP #478, `midTargetDraw`) are the wire it must be routed through, so the
two engines draw the same body rather than merely both drawing.
---

## 7. WHERE THE BATCH ENDS

`node engine/status.js`, read off the artifacts and not declared:

```
PASS  game differential                     0 of 6000 at every corner
PASS  deliberate roster / items             140 of 148 tested, clean
PASS  deliberate roster / abilities         129 of 202 tested, clean
PASS  deliberate roster / moves             475 of 500 tested, clean
PASS  coverage                              all 412 moves above 25 clicks measured
FAIL  whole-game differential / BOARD-MATERIAL     16 of 961
FAIL  whole-game differential / NARRATION          70 of 961
PASS  mechanics                             every mechanic anybody plays agrees
PASS  no open, known engine defect          clean
```

**BOARD-MATERIAL IS 16, NOT ZERO.** The quarantine does not open.

Both stale-artifact clauses were re-measured on the new bytes rather than left reading *"MEASURED
AGAINST A DIFFERENT ENGINE"*: `tests/test-engine-diff.js --n 6000 --seed 20260804`, all three
`tests/roster.js --stage <s> --write`, and `engine/all_mechanics_fire.js --kind all --write`.

**The instrument's own red plants were re-checked, as the brief required**: `tests/roster.js --reds`
reports **CAUGHT on 17 of 17** planted rules, 0 uncaught — so a stage reporting clean can still see a
planted defect.

### Artifacts written by this batch (all new files, nothing deleted)

| path | what |
|---|---|
| `data/verification/_prediction-batchI-{reaction-address,substitute-address,refill-update}.json` | written BEFORE each measurement |
| `data/verification/batchI-post.json` / `-post2` / `-post3` / `-post3b` / `-post3c` | the per-fix runs, kept so the set differences can be re-derived |
| `data/verification/batchI-dump.json` | `--dump-games 100` context for the diverging games |
| `data/game-differential.json` | re-published on release `0c8b0dc63766` so `status.js` is not reading a stale 18 |
| `tests/probe_reaction_address.js` | repaired from the previous attempt's unrunnable draft |
| `tests/probe_substitute_roll_address.js`, `tests/probe_refill_update_pass.js`, `tests/probe_curse_pressure_pp.js` | new |

Nothing was committed — the coordinator publishes.
