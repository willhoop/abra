# Earned fire: the eleven ability rows are now staged on their own triggers — 2026-09-19, ENGINE (light mode)

This is a findings record, not a living document. Do not cite it as current state; `node engine/status.js` holds that.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a03a926362158850a`, based on HEAD `97f68254`.
`97f68254` differs from the brief's `5aaf3eeb` only in `data/next-regulation*`.

**Releases.**
- **Before (HEAD engine):** `54d02066fd71`. I cut it again here as a byte-identical cut, then restored its two
  tracked files to HEAD, because the extra cut added nothing.
- **After:** **`c4a0740cbc52`** (part 1), then **`a851fe9377de`** (part 2, §4b: `c4a0740cbc52` plus the faint
  fix). Both were cut in this worktree and live under `data/releases/`, which git ignores. **Merge `a851fe9377de`.**
- `data/engine-release.json` was restored from a copy made before the first cut, and `cmp` shows it is identical.

**How the rows were run.** Light mode, named rows only. Every run used this command:

```
engine/all_mechanics_fire.js --release <id> --kind <abilities|items> --only <names>
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen --write --out <scratch>
```

It went through `tools/lownode.cmd`. No artifact was written into the tree. **0 games threw in any run.**

---

## 0. VERDICT

**All eleven rows now read FIRED on the planner, against a control that the 6.67.0 watch measures QUIET.** No board
parted and no control arm parted.

| row | before (HEAD, `54d02066fd71`) | after (`c4a0740cbc52`) | subject's own receipt | earned by |
|---|---|---|---|---|
| Flash Fire | DID-NOT-FIRE (ladder) | **FIRED**, Justified quiet | LOUD `onTryHit`: volatile set, returned null | receipt + quiet A/B |
| Stench | DID-NOT-FIRE (ladder) | **FIRED**, Aftermath quiet | none (see below) | quiet A/B |
| Corrosion | FIRED on a loud Toxic Debris, UNEARNED | **FIRED**, Toxic Debris quiet | none possible: no handler | quiet A/B |
| Damp | FIRED on a loud Electromorphosis, UNEARNED | **FIRED**, Static quiet | LOUD `onAnyTryMove` returned false | receipt + quiet A/B |
| Infiltrator | FIRED on a loud Flame Body, UNEARNED | **FIRED** (screens half), Flame Body quiet | latent (`move.infiltrates`) | quiet A/B |
| Leaf Guard | FIRED on a loud Chlorophyll, UNEARNED | **FIRED**, Overgrow quiet (bearer Meganium) | LOUD `onSetStatus` returned false | receipt + quiet A/B |
| Long Reach | FIRED on a click swap, UNEARNED | **FIRED**, Overgrow quiet | latent (deletes `flags.contact`) | quiet A/B |
| Overgrow | FIRED on a click swap, UNEARNED | **FIRED**, Bulletproof quiet | LOUD `onModifyAtk` 1 → 1.5 | receipt + quiet A/B |
| Pickpocket | FIRED on a loud Tough Claws, UNEARNED | **FIRED**, Sniper quiet | LOUD `onAfterMoveSecondary`: items moved | receipt + quiet A/B |
| Poison Touch | FIRED on a loud Poison Point, UNEARNED | **FIRED**, Adaptability quiet | LOUD `onSourceDamagingHit`: status set | receipt + quiet A/B |
| Sticky Hold | FIRED on a loud Supersweet Syrup, UNEARNED | **FIRED**, Regenerator quiet | LOUD `onTakeItem` returned false | receipt + quiet A/B |

**Seven of the eleven carry a LOUD receipt from their own handler.** The other four are earned only by the A/B,
because the only control is one the watch measured as doing nothing:
- **Corrosion** has no handler at all. `data/abilities.ts:681-687` says "Implemented in sim/pokemon.js", and the sim
  core reads it at `sim/pokemon.ts:1715`. No handler watch can ever give it a receipt.
- **Infiltrator, Long Reach and Stench** only write a move property. Stench pushes a secondary, and the watch does not
  classify that as LOUD.

**On the 30 named ability rows whose plan moved:**
- FIRED on a live control: **18 → 1**. The one left is Blaze, a click swap that its state receipt earns.
- `fired_on_live_control_unearned`: **9 → 0**.
- Legacy fallbacks: **9 → 0**.
- DID-NOT-FIRE: **2 → 0**.

**Boards.**
- **One engine fix, narration only.** A Thief, Covet or Knock Off into Sticky Hold was refused silently here, while
  the authority writes `|-activate|…|ability: Sticky Hold`. The staged row read ANNOUNCEMENT-ONLY on the fix-less
  engine. It reads NO-DIVERGENCE on `c4a0740cbc52`. With the knob `MEDI_STICKYHOLD_SILENT=1` it reads
  ANNOUNCEMENT-ONLY again, which is the red demonstration.
- **No FIRED row parted a board.** There was no board defect to fix.

**Census.** 968 live / 968 probed / 0 missing, unchanged after part 1. `tests/test-mechanics.js` was re-run on the
fixed engine and its only change was the timestamp. I restored HEAD's bytes so the file does not churn.

**Part 2 (§4b, release `a851fe9377de`): one BOARD fix.** When a removal move faints a Sticky Hold holder, the item
now goes, as it does in the authority. Before, this engine kept it.
- The class: Knock Off, Thief, Covet, Bug Bite and Pluck.
- A new census row: **968 → 969 live / 0 missing**. It reads MISSING under `MEDI_STICKYHOLD_REFUSES_AT_ZERO=1`.
- The two-engine KOs show no divergence on the fixed engine. They diverge under the knob and on `c4a0740cbc52`.
- Sticky Hold is the format's only item-refusing ability, so no other ability carries this faint exception.

## 1. THE AUTHORITY, READ BEFORE STAGING

**No Champions override.** None of the eleven has a key in `data/mods/champions/abilities.ts`. I checked by name with
a block reader over both files. Mainline is the authority for all of them.

| ability | handler (file:line) | what it needs on the board |
|---|---|---|
| Flash Fire | `onTryHit`, `data/abilities.ts:1332-1340` | a Fire move that LANDS on the holder (a Fire status move counts; a field move does not) |
| Stench | `onModifyMove`, `:4595-4608` | the holder's damaging hit, which gains a 10% flinch secondary; the target must not have moved yet |
| Corrosion | none (`:681-687`); read at `sim/pokemon.ts:1715` | the holder's `tox`/`psn` onto a body the type chart makes immune |
| Damp | `onAnyTryMove`, `:802-808` (plus `onAnyDamage` for Aftermath) | a foe clicking one of `explosion`, `mindblown`, `mistyexplosion`, `selfdestruct` |
| Infiltrator | `onModifyMove`, `:2122-2124` | a screen or a Substitute on the target. Reflect's gate is `!…crit && !move.infiltrates` (`data/moves.ts:14857`) |
| Leaf Guard | `onSetStatus`, `:2282-2289` | a status that arrives under sun. `-immune` is written only when `effect.status` is set, which means a status move |
| Long Reach | `onModifyMove`, `:2419-2421` | the holder's contact move into a contact punisher |
| Overgrow | `onModifyAtk`/`onModifySpA`, `:3115-3128` | a Grass hit while `hp <= maxhp / 3` |
| Pickpocket | `onAfterMoveSecondary`, `:3230-3246` | contact FROM a body holding an item, onto an empty-handed holder |
| Poison Touch | `onSourceDamagingHit`, `:3361-3369` | the holder's own contact hit (30%, which lands at the bottom corner) |
| Sticky Hold | `onTakeItem`, `:4615-4622` | a foe removing or taking the holder's item. The holder must be alive (`!pokemon.hp` returns early) |

**Scope check. No trigger was out of reach.**
- Damp's list over the Reg M-B learnsets, filtered with `exists && !isNonstandard && tier !== 'Illegal'`:
  - Explosion: 11 sheet learners;
  - Self-Destruct: 24;
  - Misty Explosion: 18;
  - **Mind Blown: `isNonstandard: 'Past'`, 0 learners.** It is dropped by the filter and never named on a board.
- Every other trigger has legal users. None of the eleven is a scope result.

## 2. WHAT THE PLANNER NOW DERIVES (`engine/stage_planner.js`, "earned-fire")

**Every shape matches on a handler's text and never on a name.** I printed each shape's membership over the legal
abilities and items before wiring it (LESSONS §4):

| shape | membership printed | wired to |
|---|---|---|
| a flinch-secondary writer (`onModifyMove` pushing `volatileStatus: "flinch"`) | stench, **kingsrock (item)** | abilities only. The holder hits, a slower receiver hits back (`carrier-faster`) |
| a move-id list on an `onAny*`/`onFoe*` handler | damp | the receiver clicks a legal listed id at the holder (`need.kind = moveid`) |
| `onSourceDamagingHit` + `checkMoveMakesContact` | poisontouch | the holder's own contact hit (actor need) |
| `onAfterMoveSecondary` calling `source.takeItem(` | pickpocket | R holds the quietest removable item (`hitter-holds-item`) |
| `onTakeItem` returning false | stickyhold | C holds the quietest removable item; R clicks a `removesItem`/`takesTargetItem` move at C |
| `onSetStatus` returning false with no status literal | comatose, leafguard, purifyingsalt, shieldsdown | **narrowed by a weather gate to leafguard only.** The status is a status move on the trigger turn, after the sky is set |
| the core guard `hasAbility("<id>") && [..].includes(status.id)` in front of `runStatusImmunity` | corrosion @ `sim/pokemon.ts:1715` (tox, psn) | R is immune by the type chart; C clicks the status move (`status-past-immunity`) |
| a contact punisher gated on the faint (`!target.hp &&`) | aftermath | **excluded** as a punisher. Long Reach used to draw Garbodor/Aftermath |
| a move that halves HP (`damageCallback … getUndynamaxedHP() / 2`) | superfang | the hp-threshold path: R clicks it k times so that (1/2)^k ≤ 1/f. The old two-real-hits path stays as the fallback |
| a screen reader that also reads `.crit` | auroraveil, lightscreen, reflect | Infiltrator's screen half runs at the top corner, where no crit lands |
| `onModifySpe` + a weather gate (for `loudOnBoard`) | chlorophyll, sandrush, slushrush, swiftswim | a static loudness judgement when that weather is clicked on the board |
| `onModifyAccuracy` returning `chainModify < 1` (no PRE accuracy-roll) | sandveil, snowcloak (tangledfeet already had one) | board `accuracy-roll`: the top corner and a 100-accuracy move the multiplier pulls under |
| `onResidual` reading the holder's `.status` | hydration, shedskin | the holder's status is a STABLE one (its condition never calls `cureStatus`) |

**Four control and chooser changes:**
- **Flash Fire: a status click aimed at the holder must land on a body** (`LANDS_ON_FOE`). Before this, the need test
  was `target !== 'self'`, so Sunny Day (type Fire, target `all`) "met" Flash Fire's Fire need. That is why the row
  read DID-NOT-FIRE.
- **`reactsTo` asks who makes the click.** A `by: receiver` need is met only by a click another body aims at C, and a
  `by: actor` need only by C's own click. It also skips a need whose handler is gated on an HP threshold the board
  never reaches. This is what refused Bulletproof, for the carrier's own Seed Bomb, and Overgrow, for a Grass click
  it never reads.
- **A bearer with a quiet control beats a bearer with a loud one.** This applies only when the replacement is itself
  an ability swap judged quiet. The replaced bearer is stamped on the fixture (`replacedLoudControl`), and the knob
  `STAGE_PLANNER_KEEP_LOUD_BEARER=1` restores the old choice.
- **Fixtures for the eleven**, each with its receiver, click and control:

| row | fixture |
|---|---|
| Corrosion | Glimmora Toxic → Aegislash (Steel/Ghost) |
| Damp | Alcremie Misty Explosion → Bellibolt |
| Flash Fire | Absol Flamethrower → Arcanine |
| Infiltrator (screens half, top corner) | Aegislash Reflect, then Chandelure Lash Out |
| Leaf Guard | Sunny Day, then Absol Thunder Wave → Meganium |
| Long Reach | Decidueye Grassy Glide → Garchomp (Rough Skin) |
| Overgrow | Dedenne Super Fang ×2 → Chesnaught, then Seed Bomb |
| Pickpocket | Feraligatr @ Damp Rock Dragon Claw → Barbaracle |
| Poison Touch | Dragalge Aqua Tail → Feraligatr |
| Stench | Garbodor Seed Bomb → Abomasnow (spe 80 < 95), which hits back |
| Sticky Hold | Feraligatr Thief → Hydrapple @ Damp Rock |

`tests/test-stage-planner.js` is **GREEN**: 17.2 s, every red demonstration included.

## 3. THE DRIFT: EVERY ROW WHOSE PLAN MOVED WAS RUN BY NAME

I diffed the whole-population plan of HEAD against the new planner, by bodies, turns, control and triggers.
**32 mechanics moved.** Eleven are mine. The other 21 are these:
- the halving path: berserk, blaze, swarm, torrent, oranberry, sitrusberry;
- the by-aware `reactsTo`: cudchew, hugepower and waterabsorb (reason text only), plus poisonpoint, stall,
  toughclaws and waterbubble;
- the modifyspe loudness: snowcloak;
- the quiet-bearer preference: hydration, insomnia, magmaarmor, plus, shellarmor;
- the two follow-up shapes: sandveil, shedskin.

I ran all 32 twice. The **before** run used the HEAD planner and instrument on `54d02066fd71`, through two temporary
copies (`engine/_tmp_sp_head_earned.js` and `engine/_tmp_amf_head_earned.js`), which I made and then deleted. The
**after** run used the new planner on `c4a0740cbc52`.

**Every one of the 32 reads FIRED after. No board parted, no control arm parted and no row diverged.**
- After: `script_miss` 0, `fallback` 0, `variant_split` 0.
- Before: `fallback` was 9, and berserk had a `script_miss`.
- The instrument's 33 red plants are caught on both runs (`red_ok: true`).
- Games played / threw: abilities 221/0 before and 189/0 after; items 53/0 before and 53/0 after.

**Two regressions appeared in the first after-run. Both were fixture faults, and both are closed.**
- **Hydration went FIRED → DID-NOT-FIRE on its new bearer, Vaporeon.**
  - The fixture froze the holder with Ice Beam.
  - At the bottom corner every thaw die succeeds, and Vaporeon (85) is slower than the freezer (98), so the freeze
    thawed on its own move before the residual.
  - Goodra's old FIRED held only because Goodra outsped the freezer.
  - Fix: a status read at the residual is now a stable one. Hydration now gets Body Slam's paralysis and reads
    **FIRED** against a quiet Water Absorb.
- **Snow Cloak went FIRED → DID-NOT-FIRE once its control was quiet (Swift Swim instead of Slush Rush).**
  - Its old FIRED had moved no board leaf (`moved=[]`). The credit was Slush Rush's turn order.
  - At the bottom corner every move hits, so a ×0.8 accuracy multiplier can never show.
  - Fix: the new accuracy shape. The row now plays at the top corner and reads **FIRED** against a quiet Swift Swim.
    Sand Veil gets the same fixture and reads FIRED against a quiet Hyper Cutter; before, it had been a legacy row on
    a loud Rough Skin.

The before and after table, per row (verdict, stage, control, control watch, subject receipt, board):

```
berserk      BEFORE FIRED legacy-fallback Sap Sipper ctl:quiet subj:LOUD board:NO-DIVERGENCE
             AFTER  FIRED planner Cloud Nine ctl:quiet subj:LOUD board:NO-DIVERGENCE
blaze        BEFORE FIRED planner C.click@3 (Temper Flare->Assurance) subj:LOUD click-swap/earned
             AFTER  FIRED planner C.click@3 (same) subj:LOUD click-swap/earned
corrosion    BEFORE FIRED legacy-fallback Toxic Debris ctl:LOUD subj:quiet ability-loud/UNEARNED
             AFTER  FIRED planner Toxic Debris ctl:quiet subj:quiet
cudchew      BEFORE/AFTER FIRED planner Armor Tail ctl:quiet subj:LOUD
damp         BEFORE FIRED planner Electromorphosis ctl:LOUD subj:quiet ability-loud/UNEARNED
             AFTER  FIRED planner Static ctl:quiet subj:LOUD
flashfire    BEFORE DID-NOT-FIRE legacy-fallback Justified ctl:quiet subj:quiet
             AFTER  FIRED planner Justified ctl:quiet subj:LOUD
hugepower    BEFORE/AFTER FIRED planner Thick Fat ctl:quiet subj:LOUD
hydration    BEFORE FIRED planner Gooey ctl:LOUD subj:LOUD ability-loud/earned
             AFTER  FIRED planner Water Absorb ctl:quiet subj:LOUD
infiltrator  BEFORE FIRED planner Flame Body ctl:LOUD subj:latent ability-loud/UNEARNED
             AFTER  FIRED planner Flame Body ctl:quiet subj:latent
insomnia     BEFORE FIRED planner Sniper ctl:LOUD subj:LOUD ability-loud/earned
             AFTER  FIRED planner Frisk ctl:quiet subj:LOUD
leafguard    BEFORE FIRED legacy-fallback Chlorophyll ctl:LOUD subj:quiet ability-loud/UNEARNED
             AFTER  FIRED planner Overgrow ctl:quiet subj:LOUD
longreach    BEFORE FIRED planner C.click@1 subj:latent click-swap/UNEARNED
             AFTER  FIRED planner Overgrow ctl:quiet subj:latent
magmaarmor   BEFORE FIRED planner Anger Point ctl:LOUD subj:LOUD ability-loud/earned
             AFTER  FIRED planner Solid Rock ctl:quiet subj:LOUD
overgrow     BEFORE FIRED planner C.click@3 subj:quiet click-swap/UNEARNED
             AFTER  FIRED planner Bulletproof ctl:quiet subj:LOUD
pickpocket   BEFORE FIRED legacy-fallback Tough Claws ctl:LOUD subj:quiet ability-loud/UNEARNED
             AFTER  FIRED planner Sniper ctl:quiet subj:LOUD
plus         BEFORE FIRED planner Static ctl:LOUD subj:LOUD ability-loud/earned
             AFTER  FIRED planner Cheek Pouch ctl:quiet subj:LOUD
poisonpoint  BEFORE FIRED planner Poison Touch ctl:quiet subj:LOUD
             AFTER  FIRED planner Adaptability ctl:quiet subj:LOUD
poisontouch  BEFORE FIRED planner Poison Point ctl:LOUD subj:quiet ability-loud/UNEARNED
             AFTER  FIRED planner Adaptability ctl:quiet subj:LOUD
sandveil     BEFORE FIRED legacy-fallback Rough Skin ctl:LOUD subj:LOUD ability-loud/earned
             AFTER  FIRED planner Hyper Cutter ctl:quiet subj:LOUD
shedskin     BEFORE/AFTER FIRED planner Unnerve ctl:quiet subj:LOUD
shellarmor   BEFORE FIRED planner Gooey ctl:LOUD subj:LOUD ability-loud/earned
             AFTER  FIRED planner Torrent ctl:quiet subj:LOUD
snowcloak    BEFORE FIRED planner Slush Rush ctl:LOUD subj:LOUD ability-loud/earned
             AFTER  FIRED planner Swift Swim ctl:quiet subj:LOUD
stall        BEFORE FIRED planner Keen Eye -> AFTER FIRED planner Prankster, both ctl:quiet subj:LOUD
stench       BEFORE DID-NOT-FIRE legacy-fallback Aftermath -> AFTER FIRED planner Aftermath ctl:quiet subj:quiet
stickyhold   BEFORE FIRED legacy-fallback Supersweet Syrup ctl:LOUD subj:quiet ability-loud/UNEARNED
             AFTER  FIRED planner Regenerator ctl:quiet subj:LOUD
swarm        BEFORE/AFTER FIRED planner Insomnia ctl:quiet subj:LOUD
torrent      BEFORE FIRED legacy-fallback Rain Dish -> AFTER FIRED planner Rain Dish, both ctl:quiet subj:LOUD
toughclaws   BEFORE FIRED planner Sniper ctl:LOUD ability-loud/earned -> AFTER FIRED planner Pickpocket ctl:quiet subj:LOUD
waterabsorb  BEFORE/AFTER FIRED planner Water Bubble ctl:quiet subj:LOUD
waterbubble  BEFORE/AFTER FIRED planner Water Absorb ctl:quiet subj:LOUD
oranberry    BEFORE/AFTER FIRED planner C.item (after: R halves the holder with Super Fang)
sitrusberry  BEFORE/AFTER FIRED planner C.item (after: R halves the holder with Super Fang)
every row: board NO-DIVERGENCE, no control-arm parting, not diverged
```

## 4. THE ENGINE FIX: STICKY HOLD'S `-activate`

**What the authority does.**
- Thief's `onAfterHit` calls `target.takeItem(source)` (`data/moves.ts:19305-19309`).
- `Pokemon#takeItem` runs `runEvent('TakeItem')`, and Sticky Hold's handler writes
  `this.add('-activate', pokemon, 'ability: Sticky Hold')` and returns false (`data/abilities.ts:4618-4620`).
- Knock Off reaches the same handler through its `activeMove.id === 'knockoff'` arm.

**What this engine did.** The steal step in `engine/medicham2-browser.js` refused the strip through
`abilityRefusesItemLoss` inside one `else if` condition, and wrote nothing.

**The fix.**
- The refusal is now its own branch. It writes `TR.act(tg, 'ability: ' + abilityLabel(tg.ability))`, the same
  `-activate` form every other ability announcement here uses.
- It announces only for a live holder, matching the handler's `!pokemon.hp` guard.
- The item branch below it is unchanged, and `abilityRefusesItemLoss` is still called once, so its counter keeps its
  meaning.
- Counter: `MEDSEEN.itemLossRefusalAnnounced`. Knob: `MEDI_STICKYHOLD_SILENT=1`.

**The probe is the staged row.**

| engine | board | diverged | first divergence |
|---|---|---|---|
| `54d02066fd71` (HEAD engine) | ANNOUNCEMENT-ONLY | true | `\|-activate\|p1a: Hydrapple\|ability: Sticky Hold` against `\|move\|p1a: Hydrapple\|sleeptalk\|\|[still]`, "event missing from medicham2" |
| `c4a0740cbc52` | NO-DIVERGENCE | false | none |
| `c4a0740cbc52` + `MEDI_STICKYHOLD_SILENT=1` | ANNOUNCEMENT-ONLY | true | the same line again (red) |

**Two neighbouring checks:**
- `tests/probe_moldbreaker_refusals.js --release c4a0740cbc52` reads **ALL PASS**. A Mold Breaker Knock Off still
  takes the item, and every knob child goes red on its own case.
- `tests/test-mechanics.js` on the fixed engine reads **968 live, 0 missing, 968 probed**.

## 4b. PART 2 — A REMOVAL MOVE THAT FAINTS A STICKY HOLD HOLDER (coordinator's follow-up; release **`a851fe9377de`**)

**What the authority does.** Champions changes none of it: `data/mods/champions/{moves,abilities,scripts,items,conditions}.ts`
mention none of these five moves or Sticky Hold.
- Sticky Hold's handler opens `if (!pokemon.hp || pokemon.item === 'stickybarb') return;`
  (`data/abilities.ts:4617`), so it refuses only for a holder that still has HP.
- Each removal reaches that handler from the same hit that may have just faint the holder:
  - Knock Off, Thief and Covet use `onAfterHit` (`data/moves.ts:9978-9983`, `:19305-19320`, and Covet's block at
    `:3099`). It runs over `damagedTargets` at `sim/battle-actions.ts:1123-1126`.
  - Bug Bite and Pluck use `onHit`, which runs at step 3 (`:1086`).
  - Both points come before `faintMessages()` (`:976`). A holder at 0 HP is therefore still the target, the
    refusal does not fire, and `Pokemon#takeItem` (`sim/pokemon.ts:1856-1870`) removes the item.
- **Measured in the authority** (scratch `auth_stickyfaint.js`: Weavile against a Hydrapple, Showdown only):

| move | live holder | holder the hit faints |
|---|---|---|
| Knock Off | keeps Damp Rock, `-activate … Sticky Hold` | loses it, `-enditem … [from] move: Knock Off` |
| Thief | keeps it, `-activate` | Weavile takes it (`-enditem [silent]` + `-item`) |
| Covet | keeps it, `-activate` | Weavile takes it (`-item`) |
| Bug Bite | keeps Lum Berry, `-activate` | eaten, `-enditem … [from] stealeat` |
| Pluck | keeps Lum Berry, `-activate` | eaten, `-enditem … [from] stealeat` |

**The class.**
- I walked every legal `onTakeItem` in the format.
- **Sticky Hold is the only ability that refuses an item loss.** Unburden has an `onTakeItem`, but it reacts to the
  loss rather than refusing it.
- **The 75 mega stones refuse with no HP gate at all.** Their handlers are `return !item.megaStone?.[…]` (73 stones)
  and the Floettite/Meowsticite form (2). A fainting mega holder keeps its stone in both engines, so
  `itemRefusesTake` is correct and I did not touch it.
- **No other ability has the faint exception.**

**The fix.**
- It sits in the shared check that every strip passes through: `abilityRefusesItemLoss` in
  `engine/medicham2-browser.js`.
- A holder with `curHP <= 0` now refuses nothing (counter `itemLossRefusalSkippedAtZero`).
- `MEDI_STICKYHOLD_REFUSES_AT_ZERO=1` restores the old refusal.

**The probes.**

| probe | what it runs | fixed engine | red (`MEDI_STICKYHOLD_REFUSES_AT_ZERO=1`) |
|---|---|---|---|
| **census row** (new): `refusesItemLoss`, "Sticky Hold does not hold an item for a holder the same hit faints (Knock Off, Thief, Bug Bite)" in `tests/test-mechanics.js` | a live control and a fainting arm per move | **LIVE**. Census **968 → 969 live, 0 missing** | **MISSING**, 968 live / 1 missing |
| **two-engine** (scratch `twoeng_stickyfaint.js`) | Dedenne's Super Fang ×4 takes Hydrapple to 1/16 on the real pool (a fraction, no damage number), then Weavile's Knock Off or Thief KOs it; bottom corner | Knock Off and Thief faint arms **no divergence**, and both engines write the authority's `-enditem`/`-item` lines | both faint arms **diverge**, "event missing from medicham2 :: -enditem" |

- The pre-fix release `c4a0740cbc52` diverges the same way as the knob run.
- The two live-holder control arms show no divergence on every release and under the knob.
- **The staged row is unchanged.** I re-ran the eleven on `a851fe9377de` (101 games, 0 threw). All eleven read FIRED
  against a quiet control. Sticky Hold reads board NO-DIVERGENCE, not diverged, and `unearned` is 0.
- `data/mechanics-census.json` is regenerated and kept this time, because it carries the new row. The only other
  change is a sampled percentage in the Iron Head detail text.

## 5. FILES CHANGED

- `engine/stage_planner.js`: the shapes and chooser changes in §2 and §3. Every block is marked "earned-fire".
  - New knob: `STAGE_PLANNER_KEEP_LOUD_BEARER`.
- `engine/medicham2-browser.js`:
  - the Sticky Hold announcement, with knob `MEDI_STICKYHOLD_SILENT` and counter `itemLossRefusalAnnounced`;
  - part 2: the 0-HP exception in `abilityRefusesItemLoss`, with knob `MEDI_STICKYHOLD_REFUSES_AT_ZERO` and counter
    `itemLossRefusalSkippedAtZero`. This one IS a board change: the fainted holder's item, and the thief's.
- `tests/test-mechanics.js`: one census row, part 2.
- `data/mechanics-census.json`: regenerated with that row, 969 live / 0 missing.
- `docs/ENGINE.md`: a new section and the hand list, outside the GENERATED block.
- This report.

**Not touched:**
- `engine/all_mechanics_fire.js` (the instrument), the tags, `board.js`, `magnemite.js`, `engine-data.js`;
- CHANGELOG, RUNNING-NOTES, `quarantine.js`, and every data file.
- In part 1, `data/mechanics-census.json` was regenerated and then restored to HEAD's bytes, because only the
  timestamp had changed. Part 2 keeps it.
- The two tracked files of release `54d02066fd71` were restored to HEAD.

Every process I started ended on its own; none was killed.

**Debris seen and left alone:**
- `tests/probe_moldbreaker_refusals.js` prints "5 illegal — 5 NOT baselined". These are Focus Energy fixtures built
  at `tests/roster.js:1474-1475`; I did not touch that file.
- The untracked `docs/_reports/2026-09-11-*.md` files and the modified deck, technical-docs, MODELS and SUMMARY are
  in the main tree, not this worktree.

## PROPOSED NOTES ROW

```
### <<VER>> — 2026-09-19 — Eleven ability rows staged on their own triggers against measured-quiet controls; Sticky Hold announces a refused strip and lets a fainting holder's item go

**What changed.** `engine/stage_planner.js` derives, off each handler's text (membership printed before wiring), the trigger
the eleven 6.67.0 rows never staged: a Fire click that LANDS on the holder (Flash Fire), a flinch writer (Stench), a move-id
list on an Any handler (Damp: Explosion / Misty Explosion / Self-Destruct; Mind Blown is Past), the core status-immunity
guard at sim/pokemon.ts:1715 (Corrosion), a screen half staged at the top corner (Infiltrator), a status move under the sun
(Leaf Guard), a non-faint-gated contact punisher (Long Reach), a Super Fang halving path to the HP threshold (Overgrow),
an item on the hitter (Pickpocket), the holder's own contact hit (Poison Touch), a foe removing the holder's item (Sticky
Hold). Controls: `reactsTo` reads who makes the click and an unreached HP gate; a bearer with a quiet ability-swap control
replaces one with a loud control (knob STAGE_PLANNER_KEEP_LOUD_BEARER=1); a weather-gated Speed modifier is judged loud;
residual status readers get a stable status; a sub-1 accuracy multiplier plays at the top corner. Engine: a Thief / Covet /
Knock Off strip refused by Sticky Hold now writes the authority's `-activate` (knob MEDI_STICKYHOLD_SILENT=1); and Sticky
Hold no longer refuses for a holder the same hit brought to 0 HP (`data/abilities.ts:4617` `!pokemon.hp`; the strip runs
before faintMessages, sim/battle-actions.ts:1123-1126 / :1086), so Knock Off, Thief, Covet, Bug Bite and Pluck take a
fainting holder's item (knob MEDI_STICKYHOLD_REFUSES_AT_ZERO=1). Sticky Hold is the format's only item-refusing ability;
the 75 mega stones have no HP gate and are unchanged.
**Figures.** Worktree release a851fe9377de (part 1 measured on c4a0740cbc52; before: 54d02066fd71), light mode, 32 named rows (30 abilities, 2 items) whose
plan moved, before and after, 0 games threw. All 11 target rows FIRED on the planner against a watch-quiet control; 7 carry
a LOUD subject receipt, Corrosion (no handler), Infiltrator, Long Reach and Stench (move-property writers) rest on the quiet
A/B. Over the 30 ability rows: fired_on_live_control 18 → 1 (Blaze, earned), unearned 9 → 0, legacy fallbacks 9 → 0,
DID-NOT-FIRE 2 → 0; no board and no control arm parted. Sticky Hold staged row ANNOUNCEMENT-ONLY → NO-DIVERGENCE (knob
restores it). Fainting holder: new census row `refusesItemLoss` ("...a holder the same hit faints") LIVE, MISSING under the
knob; census 968 → 969 live / 0 missing; two-engine Knock Off and Thief KOs no divergence on a851fe9377de, "event missing
from medicham2 :: -enditem" on c4a0740cbc52 and under the knob; the eleven rows re-run on a851fe9377de all FIRED,
unearned 0. tests/test-stage-planner.js GREEN.
**Supersedes.** 6.67.0's "9 FIRED rows on a live control have no subject receipt" and Flash Fire's and Stench's DID-NOT-FIRE
(named-row readings, not published figures; the staged-game battery has not been re-run).
**Basis.** unchanged
**Owes.** docs/ABRA-technical-docs.md (the earned-fire trigger shapes and the quiet-bearer preference) at the next major.
```

## OWED, NOT RUN

1. **The full staged-game battery on `a851fe9377de`, pinned.** Only the 32 rows whose plan moved were run. A full run
   is the only thing that confirms no other row's control or verdict moved. The whole-population plan diff says
   nothing else moved, but a plan diff is not a game.
2. **The lattices and `quarantine.js`.** They were not run, per the brief. The engine change is narration only, so
   no board-material figure is expected to move. The part 2 fix is a board change, but only on a removal move that
   faints a Sticky Hold holder. Both are expectations, not measurements.
3. **CLOSED in part 2 (§4b):** Sticky Hold on a fainting holder. What stays owed is the staged-game battery's view of
   it. The planner has no fixture that faints the holder; the two-engine check is a scratch script, not a registered
   instrument.
4. **King's Rock** matches the flinch-writer shape. The clause is wired for abilities only, and the King's Rock item
   row was not re-staged.
5. **Purifying Salt's status refusal** is not staged. Its refusal shape was narrowed to the weather-gated case.
6. **Infiltrator's `main` fixture** still stages nothing and reads DID-NOT-FIRE. The row is carried by its screens
   half. A tag with named halves arguably needs no trigger-less main fixture.
7. **`tests/test-stage-planner.js` has no clause for the new shapes.** The red demonstrations exist only as runs (the
   HEAD column in §3), and the same was already owed for `foe-redirects`.
8. **The coordinator owns these:** CHANGELOG, RUNNING-NOTES, `node engine/status.js --write`, and a commit. The
   release `c4a0740cbc52` exists only under this worktree's ignored `data/releases/`.
