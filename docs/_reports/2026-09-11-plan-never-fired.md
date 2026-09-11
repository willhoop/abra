# Plan — the 67 staged mechanics that never fire

2026-09-11 · ENGINE · planning only. Nothing was run, edited or played.

**Sources.** Every artifact was read at `git show HEAD:` because an ENGINE agent was live. The fire artifact is release `5973a4e3c768`, generated 2026-09-11T03:18Z, 1,313 games, arm `bottom-tie-first`, Showdown `20ad99f`. The harness was read at `git show HEAD:engine/all_mechanics_fire.js`, and line numbers below are HEAD's. Legality comes from `Dex.forFormat('gen9championsvgc2026regmb')` filtered `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`. Handlers were read in `data/mods/champions/` first. Of these 58 abilities and 9 items, only **Healer** is overridden (`mods/champions/abilities.ts:46`). Every other handler cited is mainline.

## Verdict

- **None of the 67 lacks a legal Reg M-B carrier**, and each carrier the harness used is itself legal. So none is out of scope on the carrier test.
- **61 are fixture work.** They fall into **six batches**, one per missing fixture capability.
- **6 are not fixture work.**
  - Three are closeted by Will: Anticipation, Pickup and Stall.
  - Frisk is declared board-unobservable.
  - Cute Charm needs gender, and medicham2 has none. That is engine work.
  - Gluttony has no legal berry that reads it. All 10 readers are illegal pinch berries.
- **Predicted:** at most 663 → **724 of 760**. That is an upper bound. A row that comes back `SHOWDOWN-ONLY` is an engine defect found, not a +1.
- **Scoreboard (Will, 2026-08-23):** this moves the LAB (`all-mechanics-fire` → census). The pinned pool should sit still, except where a common row (Prankster, Hospitality, Flower Veil, Lightning Rod, Unburden, Light Clay) exposes an engine defect that then gets fixed.

**The top causes, all in the fixture, none yet shown to be the engine:**
1. Ability rows never get the `board-state` rung that item rows get.
2. The receiver is fixed to Feraligatr, whose legal pool has no Electric, Fire, powder, Toxic, Taunt or sleep move.
3. The ally pads click Protect every turn, and `allyIsLive: false` is hard-coded.
4. The arm pins the accuracy and crit dice to constants.
5. The weather rocks and Light Clay are never paired with anyone clicking the setter.

## Where the 67 come from

`engine/coverage.js` (HEAD L617-621) computes `staged and never fired` = `summary.abilities.did_not_fire` (58) + `summary.items.did_not_fire` (9).

The gap in `663 of 760` is 97, so 30 misses fall outside this brief. They are listed so nobody double-counts them:
- **5 moves:** `powershift`, `softboiled`, `spore` and `struggle` have no legal carrier but still sit in the move denominator, because `coverage.js` subtracts nothing for moves. The fifth is `attract`, which reads `-immune`.
- **8 abilities** are `SHOWDOWN-ONLY`, which is an engine question.
- **14 abilities** are `NO CONTROL`.
- **2 abilities** are Ditto carriers that could not be built.
- **1 ability** is Battle Bond, which is closeted.

## Cross-cutting findings

These are defects in the fixture or the probe, read from code and not yet run. Per LESSONS §5, three of them (6, 7 and 8) are hypotheses to confirm with `--dumplog` before building on them.

1. **Abilities have no board-state rung.** `runAbilities` calls `abLadder(...)` with no `extra` (L2446). `runItems` builds a `board-state` rung from `boardPlanFor` (L3076-3098). `PRE.boardNeeds` already accepts an ability (`fixture_preflight.js` L910). The planner stages `ko-hit, status-present, own-stat-dropped, volatile-present, heal-effect, trapped, pp-exhausted` (L2862). It does not stage `item-consumed`, `hp-threshold` or `ally-only`.
2. **The ability receiver is Feraligatr, always.** `bodyOf(RECEIVER.species…)` is at L2236, and `pickForNeed` searches only `POOL.get(RECEIVER.species)` (L2284). The item arm already searches receivers (`holderFor` L2592, `stateReceivers` L2871). Derived: Feraligatr learns no Electric, Fire, powder, Toxic, Taunt or Hypnosis move.
3. **The carrier is chosen alphabetically, never by need.** L2212 takes `carriers.find(first with a control)`. Two rows cannot fire on that pick:
   - **Steadfast** is refused by the flinch-speed guard (L2305) because Gallade (80) outspeeds Feraligatr (78). Machamp (55) would take the flinch.
   - **Light Metal** is on Metagross, which is 550 kg. The Low Kick table (`data/moves.ts:10445`) gives ≥2000 hg → 120, so 5500 hg and 2750 hg both give 120. **No weight move can cross on Metagross.** Scizor is 118 kg: 1180 hg gives 100 and 590 hg gives 80, so it crosses.
4. **Four stage verbs are silent no-ops on ability and item rows.** `asleep`, `countsPP`, `koTheHolder` and `alliesFaint` are in `KNOWN_STAGE_VERBS` (L2167), so they are never counted as unknown. `gauntletScript` (L1983-2160) executes none of them. `asleep` only runs on the move arm (L1465). This hits Early Bird (`nameImplementedBySim: {asleep}`) and Receiver (`inheritsAllyAbility: {alliesFaint}`). It is a silent default that looks exactly like a feature.
5. **The duration-extension clause gives the wrong reason for all five rows.**
   - What it says: `fixture_preflight.js` clause 7 compares the turns played (7) with the **extended** clock (8).
   - Why that is wrong: the two arms part when the **short** clock runs out (`raindance: duration: 5`, `durationCallback` → 8 only if `source?.hasItem('damprock')`, `data/conditions.ts:479-484`). Seven turns would be enough.
   - The real cause: nobody clicks the setter. Rocks have no handler, so there are no needs, so the holder is Corviknight with Facade/Endure/Rest/Substitute (L3031-3036).
   - The authority requires the **setter** to hold the rock (`source?.hasItem`).
6. **`pickHit` ignores category for the "special" slot (L2052-2057).** A `faces` list headed by Low Kick is picked for both beat turns, so **Magma Armor's Ice Beam never lands**. Derived: `D.getImmunity('frz',['Fire'])` is `false` in this sim, so Camerupt can be frozen and the row is real work.
7. **The receiver's setup-turn filler is Agility** (`inert`, L2058; it also idles in `statePlanScript`, L2968). That doubles the receiver's Speed, and the `speed-order` clause reasons from base Speeds. **Slush Rush:** Beartic 50 → 100 in snow, against Feraligatr 78 → 156 after Agility, so there is no crossing. **Swift Swim** needs the same recomputation.
8. **`itemsOnBoth` puts the item on the thief.** Magician's own guard returns when `source.item` is set (`data/abilities.ts:2467`), so the consequence stage makes the mechanic impossible. Symbiosis's item also lands on actor and receiver, while its need is on the **partner**.
9. **The "ally-only" clause is wrong for Aroma Veil and Sweet Veil.** `onAlly*` handlers run over `target.alliesAndSelf()` (`sim/battle.ts:1056`), so a foe Taunt or sleep on the holder itself triggers them. Flower Veil still needs a Grass partner (`target.hasType('Grass')`, `abilities.ts:1409`), because Floette-Eternal is Fairy.
10. **Overcoat was tested on Forretress (Bug/Steel) in sandstorm.** That body is immune for two reasons, which proves nothing. Only the powder half is testable on Forretress.
11. **Toxic Orb and Flame Orb are illegal here (derived).** Every poison or burn must come from an adversary.

## The 67

Usage is the sheet `teams` count from `data/sheet-usage.json` (26,232 teams, generated 2026-08-11). `data/regulation-usage.json` clean counts (2026-09-10) rank the same way at the top. **The Blaze filter has not been applied per carrier.** Check whether Prankster (Sableye) and Lightning Rod (Manectric) carriers mega-evolve turn one before ranking on them; see `data/mega-usage.json`.

| id | teams | clause today | real cause | batch |
|---|---:|---|---|---|
| prankster | 9313 | unexplained | actor never clicks a Status move while slower (Grimmsnarl 60 < 78) | 5 |
| hospitality | 6740 | unexplained | needs a damaged ally, then carrier re-entry (`onStart`, abilities.ts:1864) | 6 |
| flowerveil | 4109 | board-state/ally | Grass partner + foe stat drop aimed at it | 6 |
| lightningrod | 3326 | trigger-move | receiver has no Electric move | 2 |
| unburden | 3026 | board-state/item | item never consumed; order must cross | 1 |
| lightclay | 2798 | duration-ext | nobody clicks Reflect/Light Screen (finding 5) | 4 |
| innerfocus | 1351 | unexplained | needs an Intimidate adversary (undetermined cue) or a flinch from a faster foe | 2 |
| friendguard | 1056 | unexplained | ally never hit (Protect pad) | 6 |
| widelens | 1005 | arm-constant-roll | accuracy pinned | 3 |
| technician | 826 | unexplained | actor never clicks ≤60 BP (Facade is 70) | 5 |
| compoundeyes | 764 | arm-constant-roll | accuracy pinned | 3 |
| oblivious | 749 | board-state/volatile | Intimidate or Taunt adversary | 2 |
| scrappy | 733 | adversary-unstaged | Intimidate adversary | 2 |
| overgrow | 697 | board-state/hp | HP never ≤ 1/3 | 1 |
| overcoat | 507 | trigger-move | no powder thrower; sand-on-Steel control (finding 10) | 2 |
| magician | 388 | unexplained | item on the thief (finding 8) | 5 |
| unaware | 385 | unexplained | receiver never boosts **then** hits | 5 |
| swiftswim | 342 | speed-order | tie/Agility arithmetic (finding 7) | 5 |
| brightpowder | 263 | arm-constant-roll | accuracy pinned | 3 |
| scopelens | 246 | arm-constant-roll | crit pinned | 3 |
| damprock | 245 | duration-ext | nobody clicks Rain Dance | 4 |
| synchronize | 176 | adversary-unstaged | `faces` asks for Will-O-Wisp/Thunder Wave/Toxic only; Feraligatr's Body Slam paralyses | 2 |
| magmaarmor | 159 | status-present | Ice Beam shadowed by Low Kick (finding 6) | 1 |
| frisk | 134 | announces-only | **not fixture work** | — |
| cutecharm | 122 | gender (blocking) | **not fixture work — medicham2 has no gender** | — |
| magicguard | 122 | unexplained | no indirect damage on the board | 5 |
| voltabsorb | 110 | trigger-move | receiver has no Electric move | 2 |
| screencleaner | 108 | unexplained | screen raised, but carrier never re-enters | 6 |
| heatproof | 27 | trigger-move | receiver has no Fire move or burn | 2 |
| insomnia | 95 | status-present | nobody attempts sleep | 1 |
| aromaveil | 90 | board-state/ally | Taunt the holder (finding 9) | 2 |
| noguard | 75 | unexplained | accuracy pinned (or no semi-invulnerable target) | 3 |
| owntempo | 71 | board-state/volatile | Feraligatr's Flatter confuses; never clicked | 2 |
| swarm | 70 | board-state/hp | HP never ≤ 1/3 | 1 |
| steadfast | 59 | trigger-move | carrier too fast to be flinched (finding 3) | 2 |
| healer | 54 | status-present | ally never statused | 6 |
| marvelscale | 54 | status-present | never statused | 1 |
| gluttony | 52 | unexplained | **not fixture work — no legal reader** | — |
| symbiosis | 49 | board-state/ally | partner never consumes | 6 |
| sweetveil | 42 | board-state/ally | sleep the holder (finding 9) | 2 |
| guts | 33 | status-present | never statused | 1 |
| harvest | 32 | unexplained | no berry ever eaten (sun is up) | 1 |
| earlybird | 29 | read-elsewhere | `asleep` verb unexecuted (finding 4) | 1 |
| cudchew | 21 | board-state/item | no berry eaten | 1 |
| merciless | 20 | status+roll | crit pinned; target never poisoned | 3 |
| vitalspirit | 16 | status-present | nobody attempts sleep | 1 |
| tangledfeet | 14 | arm-constant-roll | accuracy pinned; never confused | 3 |
| cheekpouch | 10 | board-state/item | no berry eaten | 1 |
| poisonheal | 7 | unexplained | never poisoned (Toxic Orb illegal) | 1 |
| anticipation | 7 | announces-only | **closeted by Will** | — |
| lightmetal | 6 | unexplained | Metagross weight cannot cross (finding 3) | 5 |
| immunity | 5 | status-present | nobody attempts poison | 1 |
| quickfeet | 4 | status+speed | never statused | 1 |
| hydration | 3 | status-present | never statused (rain is up) | 1 |
| curiousmedicine | 3 | unexplained | needs a boosted ally, then re-entry | 6 |
| pickup | 3 | deferred | **closeted by Will** | — |
| receiver | 3 | board-state/ally | ally must faint (finding 4) | 6 |
| longreach | 2 | unexplained | foe has no contact punisher | 2 |
| ripen | 0 | board-state/item | no berry eaten | 1 |
| stall | 0 | read-by-nobody | **closeted by Will** | — |
| suctioncups | 0 | unexplained | receiver never phazes (Feraligatr learns Roar and Dragon Tail) | 2 |
| smoothrock | 39 | duration-ext | nobody clicks Sandstorm | 4 |
| zoomlens | 51 | arm-constant-roll | accuracy pinned | 3 |
| heatrock | 99 | duration-ext | nobody clicks Sunny Day | 4 |
| icyrock | 24 | duration-ext | nobody clicks Snowscape | 4 |
| slushrush | 28 | unexplained | Agility filler (finding 7) | 5 |

## The batches, ordered by summed sheet usage

Every batch is **verified by a game-playing run** of `engine/all_mechanics_fire.js`. That run is single-process and cheap: the HEAD artifact took about 20 s across all three kinds.

Every batch also needs a **red demonstration**:
- a `--break-<batch>` switch, modelled on the existing `--break-triggers` (L206), that removes only that batch's staging;
- every row the batch turned `FIRED` must fall back to `DID-NOT-FIRE`, and the run must exit non-zero;
- plant #2 in `red` (a mechanic swapped for itself must read `DID-NOT-FIRE`) must still be caught.

A row that comes back `SHOWDOWN-ONLY` is **not** a +1. It is the instrument now able to see an engine gap, and it becomes a register row.

**Before wiring any new need kind, print what it matches** (`--print-move-needs`, L1032). `refusesStatusMoves` and `speedOnItemLoss` both over-matched on first print.

### Batch 6 — a live ally · 9 rows · 12,360 teams

**Rows:** hospitality, flowerveil, friendguard, telepathy, screencleaner, healer, symbiosis, curiousmedicine, receiver.

**Fixture:**
- Add a `live-ally` extra rung. Build the ally through `stageBodies`' existing `allyOverride` (L1204), and give it a non-guard filler instead of Protect.
- Let the receiver target the ally slot. `statePlanScript` already carries `rT` (L2973); confirm the index that names p1b.
- Add a `reenter` step: the carrier goes to the bench and comes back. Hospitality, Curious Medicine and Screen Cleaner all fire `onStart`.
- Declare `allyIsLive` from receipts, replacing the hard-coded `false` at L2378.
- Put Symbiosis's consumable on the **partner**.
- Execute `alliesFaint` for Receiver, last, on the real pool. The harness's own HP_BOOST note warns that a faint can manufacture a divergence.

**Per row:**
- **Hospitality:** T1 hit the ally, T2 carrier out, T3 carrier back in.
- **Flower Veil:** a Grass pad with Protect (derived: venusaur, vileplume, victreebel…) plus a receiver Screech or Scary Face aimed at it.
- **Friend Guard:** a spread hit (Surf or Rock Slide, derived) or an aimed hit on the ally.
- **Telepathy:** the ally clicks Earthquake (derived pads: venusaur, charizard, blastoise…).
- **Healer:** the ally is statused. The Champions override's `randomChance(1,2)` is `random(2)=0 < 1` under the bottom corner, so it always cures.
- **Symbiosis:** the partner holds a Lum Berry and is statused.
- **Screen Cleaner:** Mr. Rime (who learns Reflect, derived) raises Reflect, leaves and returns.
- **Curious Medicine:** the ally clicks Swords Dance, then re-entry.

**Files:** `engine/all_mechanics_fire.js` (the rung, `reenter`, `alliesFaint`, the `allyIsLive` receipt) and `engine/faces.js` (the Symbiosis partner item).

**Predicted:** +9 at most. Receiver is the least likely.

**Failure demo:** `--break-live-ally` restores the Protect pad, and all nine must return to `DID-NOT-FIRE`.

### Batch 5 — the subject's own click or body · 8 rows · 11,410 teams

**Rows, with the fix for each:**
- **Prankster:** the actor clicks a Status move while slower. Grimmsnarl can learn Substitute (derived), and `onModifyPriority` fires on `category === 'Status'` (abilities.ts:3415).
- **Technician:** the actor clicks a ≤60 BP move. Maushold's legal non-secondary set is `aerialace, feint, thief` (derived).
- **Light Metal:** use Scizor as the carrier and have the receiver click Low Kick (learnable, derived).
- **Unaware:** the receiver clicks Swords Dance, then a physical hit. Today `pickHit` counts a Status move as reachable (L2051), so it can boost and never hit.
- **Magician:** put the item on the receiver only.
- **Magic Guard:** Life Orb (legal, derived) on both arms. `onDamage` refuses non-Move damage (abilities.ts:2455).
- **Slush Rush and Swift Swim:** a non-speed filler on the setup turn, or a carrier whose doubled Speed crosses what the receiver actually reaches.

**Files:**
- `engine/faces.js`: actor-side asks for Prankster, Technician and Unaware.
- `engine/fixture_preflight.js`: `moveNeeds` kinds for `onModifyPriority` (category) and `onBasePower` (≤ threshold); the `speed-order` clause must read the receiver's setup click.
- `engine/all_mechanics_fire.js`: carrier choice by need, and item placement for Magician.

**Predicted:** +8.

**Failure demo:** `--break-actor-asks`. Also, Light Metal on Metagross must still read `DID-NOT-FIRE`, because the arithmetic says it cannot cross.

### Batch 2 — the adversary must be able to throw the trigger · 14 rows · 7,243 teams

**Rows:** lightningrod, innerfocus, oblivious, scrappy, overcoat, synchronize, voltabsorb, aromaveil, owntempo, steadfast, sweetveil, heatproof, longreach, suctioncups.

**Fixture:**
- Point `pickForNeed` at `stateReceivers()` for ability rows, as `runItems`/`holderFor` already do.
- Add need kinds:
  - `adversary-ability: Intimidate`, for the undetermined cue on Inner Focus, Oblivious, Own Tempo and Scrappy (their `onTryBoost` at abilities.ts:2143/2998/3134/4069);
  - `forceSwitch` from `onDragOut` (Suction Cups, abilities.ts:4684);
  - `contact punisher` (Long Reach deletes `contact`, abilities.ts:2418);
  - status or volatile on self, for `onAlly*` (finding 9).
- Widen Synchronize's `faces` entry to any move `PRE.statusOf` says inflicts par, brn or psn. Its handler `onAfterSetStatus` passes back par, brn and psn (abilities.ts:4849).
- Drop sand on the Steel Overcoat carrier.
- For Steadfast, choose the carrier the flinch can reach.

**Derived receivers that are legal and fit the RECEIVER immunity rule** (L366-377). These are illustrative; the search picks them, not a list:
- Qwilfish: Intimidate, Toxic, Taunt.
- Arcanine: Intimidate/Flash Fire/Justified, Thunder Fang, Flamethrower, Will-O-Wisp.
- Gallade: Hypnosis, Taunt.

Feraligatr alone already covers Own Tempo (Flatter), Synchronize (Body Slam) and Suction Cups (Roar and Dragon Tail).

**Files:** `engine/all_mechanics_fire.js` (the receiver search and carrier-by-need), `engine/fixture_preflight.js` (the new need kinds) and `engine/faces.js` (Synchronize).

**Predicted:** +14.

**Failure demo:** `--break-triggers` already exists and must now also zero these rows. Print the new kinds' matches first.

### Batch 1 — an ability board-state rung · 17 rows · 4,261 teams

**Rows:** unburden, overgrow, magmaarmor, insomnia, swarm, marvelscale, guts, harvest, earlybird, cudchew, vitalspirit, cheekpouch, poisonheal, immunity, quickfeet, hydration, ripen.

**Fixture:**
- Give `runAbilities` the item arm's `boardPlanFor` → `statePlanScript` rung (finding 1).
- Add two stagers to `STATE_ORDER`/`stageStateNeed`:
  - **`item-consumed`:** a legal berry chosen to be eaten by the planned receiver's move. Examples:
    - Lum + Body Slam paralysis for Cheek Pouch on Diggersby (not Dedenne, which is Electric and so paralysis-immune by `D.getImmunity('par',['Electric'])`) and for Cud Chew;
    - Lum + an Ice Beam freeze for Harvest on Trevenant (a Ghost, so Body Slam cannot reach it);
    - Yache + Ice Beam for Ripen on Appletun (the berry-weaken list is at abilities.ts:3832);
    - for Unburden on Hawlucha, the receiver's Agility (78 → 156) sits between 118 and 236, so the order crosses.
  - **`hp-threshold`:** self-spend where learnable (Chesnaught learns Belly Drum and Substitute, derived), otherwise the real pool with more beats.
- Execute `asleep` for Early Bird. Rest after damage is fixed-length (`statusState.time`, conditions.ts:66-72, where Early Bird decrements twice).
- Use Rest after damage for Insomnia and Vital Spirit (`onSetStatus`, abilities.ts:2158/5307).
- Poison and burn come from the searched receiver (finding 11).
- For Quick Feet, Body Slam paralysis gives control 65 and Quick Feet 195 around Feraligatr's 78. Under the bottom corner, Champions paralysis `randomChance(1,8)` (mods/champions/conditions.ts, `par`) always fully paralyses, so the crossing shows as the order of the `cant` line.

**Files:** `engine/all_mechanics_fire.js` (the rung, the two stagers, the `asleep` verb and the Low-Kick/Ice-Beam pick) and `engine/fixture_preflight.js` (declare `itemConsumed`/`hpBelow` from receipts for ability rows, as items do at L3118-3134).

**Predicted:** +17.

**Failure demo:** `--break-state-rung`. Also, for Magma Armor, the freeze receipt must be present in the control arm before the row counts.

### Batch 4 — someone must click the setter · 5 rows · 3,205 teams

**Rows:** lightclay, damprock, heatrock, smoothrock, icyrock.

**Fixture:**
- Add a `field-set` plan for rows whose clause is `duration-extension`. The holder is a legal learner of the setter, and its own ability must set no weather.
  - Corviknight learns Rain Dance, Sunny Day, Reflect and Light Screen (derived).
  - Sandstorm and Snowscape need another derived learner.
- T1: the holder sets it. Then play at least short-clock + 1 turns.
- **Fix the clause** (finding 5) to compare against the short clock and to require the setter in `stagedMoves`.

**Files:** `engine/all_mechanics_fire.js` (`runItems`) and `engine/fixture_preflight.js` (clause 7).

**Predicted:** +5.

**Failure demo:** remove the setter click, and all five must read `DID-NOT-FIRE` with the clause now saying *"the setter was never clicked"*, not *"7 < 8"*.

### Batch 3 — an arm that rolls the die · 8 rows · 2,438 teams

**Rows:** widelens, compoundeyes, brightpowder, scopelens, noguard, zoomlens, merciless, tangledfeet.

**Fixture:**
- Change `playScenario` from `arm: ARM` (L1276) to `arm: spec.arm || ARM`.
- Append a `top-corner` rung (`GD.ARM_BY_ID.get('top-tie-first')`) only for rows whose preflight returned `arm-constant-roll`.
- Compute `ARM_FORCES` per rung into `scOf` (L2371) and the item `sc` (L3132).

**The arithmetic**, all cited:
- The hit check is `randomChance(accuracy, 100)` (`sim/battle-actions.ts:738`).
- A pinned `chance(n,d)` is `random(d) < n` with `random(d) = d−1` at the top corner (game_differential L1786-1791, L1852).
- So a hit needs a **modified accuracy ≥ 100**. Choose the move per row from each handler's own constant. My grep did not reach the constants for Wide Lens, Zoom Lens, Bright Powder, Compound Eyes or Tangled Feet, so **read them before choosing the move**.
- Crit uses `critMult = [0,24,8,2,1]` clamped to 0..4 (L1629-1633), and `randomChance(1, critMult[ratio])` (L1641). At the top corner, ratio 4 → `0 < 1`, a crit; ratio ≤3, no crit.
- **Merciless** returns 5 against a poisoned target (abilities.ts:2562), which clamps to 4, so it crits while the control does not. Toxapex clicks Toxic first.
- **Scope Lens** needs a stack that reaches 4 with the lens and 3 without, using Focus Energy (Corviknight learns it, derived). Read Focus Energy's increment before relying on it.
- **Tangled Feet** needs Flatter first and a 100%-accuracy receiver hit (Facade).
- **No Guard** returns `true` from `onAnyAccuracy` (abilities.ts:2960). It can alternatively be done deterministically on the current arm, with the receiver in Dig or Dive (learnable, derived) and `onAnyInvulnerability → 0`.

**Files:** `engine/all_mechanics_fire.js` only. Setup clicks can go through `faces.js`.

**Predicted:** +8.

**Failure demo:** the **same rung under `bottom-tie-first` must read `DID-NOT-FIRE`**, since the arm is the variable. If both arms fire, the arm did not do it.

## Not fixture work (6) — report, do not build

- **Anticipation, Pickup, Stall:** closeted by Will (`tests/roster.js` DEFERRED; the artifact's own `closet.ids`).
- **Frisk:** declared unobservable (`faces.js` `announcesOnEntry`). Will has **not** closeted it. That is his call, the same shape as Anticipation and Forewarn.
- **Cute Charm:** blocked by the gender clause. The harness writes `N` on every body because medicham2 has no gender. A gendered fixture needs engine work first. File it; do not stage around it.
- **Gluttony:** the 10 items that read `abilityState.gluttony` are aguav, apicot, custap, figy, ganlon, iapapa, lansat, liechi, mago and micle (`data/items.ts:169…4078`). **None is legal in Reg M-B** (derived legal-berry list), so no legal board can show it. It should leave the denominator the way `unreachable` does. That scope change is the owner's call; it would make 760 → 759.

## Risks to carry

- The live agent is rewriting `data/all-mechanics-fire.json`. **Re-enumerate the 67 from HEAD after it lands** before starting. Row fields may have moved.
- Findings 6, 7 and 8 were derived by reading code. Confirm each with `--dumplog` first. This repo's probes have been wrong about fifteen times, always toward the comfortable answer.
- A new receiver or ally body is a new place for an immunity or a live ability to hide. Record the pair on the row, and never reuse a body that is immune for two reasons.

## OWED, NOT RUN

```bash
# 0. After the live ENGINE agent has committed. Never mid-write. Re-enumerate; do not trust this report's list.
git show HEAD:data/all-mechanics-fire.json | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const r of [...j.rows.abilities,...j.rows.items].filter(r=>r.verdict==='DID-NOT-FIRE'))console.log(r.kind,r.id,r.carrier,r.cannot_fire_clause||'-')"
node engine/coverage.js
```

```bash
# 1. Confirm the three code-read hypotheses (no --write).
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
node engine/engine_release.js cut "never-fired plan: confirm fixture hypotheses"
node engine/all_mechanics_fire.js --kind abilities --only slushrush   --dumplog --release <id>
node engine/all_mechanics_fire.js --kind abilities --only magmaarmor  --dumplog --release <id>
node engine/all_mechanics_fire.js --kind items     --only lightclay   --dumplog --release <id>
```

```bash
# 2. Before wiring any new need kind: print what it matches.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/all_mechanics_fire.js --print-move-needs
```

```bash
# 3. Per batch: one row, then the batch's red switch (to be added), then the existing red plants.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/all_mechanics_fire.js --kind abilities --only hospitality --verbose --release <id>
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/all_mechanics_fire.js --kind all --break-triggers --release <id>
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/all_mechanics_fire.js --kind all --red --release <id>
```

```bash
# 4. Regenerate, then the census, then the status — in that order.
cmd.exe /c "tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release <id>"
node tests/test-mechanics.js
node engine/coverage.js
node engine/status.js
```
