# Pre-6.0.0 ENGINE review — a ranked list with receipts, no fixes

Read-only review of `engine/medicham2-browser.js` against the authority, written 2026-09-09 12:00-13:00
EDT. Historical by construction; every figure below is read from an artifact stamped 11:44-11:59 today
(all on release `b730e44f3314`, Showdown checkout `20ad99f` 2026-07-22) or from a cited source line.
Nothing under `engine/`, `tests/` or `data/` was edited. No heavy chain was run; two read-only probes
(`tests/probe_uncompared_leaves.js`, `tests/test-tag-consumed.js`) were run through `tools/lownode.cmd`.

**Champions overrides:** every authority line below was checked against `data/mods/champions/` first.
Where the mod is silent the mainline line is cited and said to be mainline.

## The verdict in one paragraph

The whole-game bar is genuinely at **BOARD-MATERIAL 0 of 958**, every one of those 958 games ended with
both engines agreeing the battle was over, and none hit the 50-turn cap. But **the three games the void
rule removed to make the denominator 958 are exactly the three games whose boards parted**, two of them
ending with a body alive here and fainted there, and one of them is a heavily-used charge move striking a
different body than it announced. Those three need a per-game attribution (instrument or engine) before
"0 of 958" can be quoted as "correct against Showdown". Below that: one tag whose name supplied coverage
its probe never had (Infiltrator through screens), one narration family with a written plan and a
board-risky edit (substitute), two false engine comments still standing, and a set of register rows the
brief named that are already closed on the tree.

**Severity buckets:** BLOCKS 6.0.0 — **2**. SHOULD FIX BEFORE — **9**. DEFER WITH REASON — **8**.
Premise corrections to the brief — **11**.

---

## 0. Premise corrections (the brief said X; the tree says Y)

| brief | tree | receipt |
|---|---|---|
| "12 of 961 games, 13 causes" | 13 narration games / 13 causes among **958 usable**; 16 protocol-parted of 961; the other 3 are VOID and all 3 parted their boards | `game-differential.json` `end_state[0].summary.by_cause_totals` = `{causes:16, BOARD_MATERIAL:3, NARRATION_ONLY:13}`; `mid_void.void_game_tags[*].board_parted_at_turn` = 4, 6, 3 |
| Reflect / Light Screen / Aurora Veil / Safeguard / **Mist** | **Mist is not in this format** — four screens, not five | `data/mods/champions/moves.ts:644-647` `mist: { inherit: true, isNonstandard: "Past" }`; `Dex.forFormat(...).moves.get('mist').isNonstandard === 'Past'` |
| abilities "44 + 14 + 63 unaccounted" | 63 = 44 + 14 + 5 (deferred). Not a fourth bucket | `roster.abilities.json.scope`: in_scope 202 = tested 139 + deferred 5 + unattributable 14 + could_not_stage 44 |
| #362 double wipe open | **closed by WIRE 160** | engine `:1650-1653` counter `doubleWipeDecidedByLastFaint`; `:9403-9406` cites `checkWin` (sim/battle.ts:2603) |
| #403 Sucker Punch open | row text says *"closed 2026-08-23 by engine"*; `roadmapRowIsClosed(full)` returns **true**; it stays open only because its status cell says `open` | `engine/quarantine.js:1191-1230` (cell outranks prose); engine `:374`, `:7940` read the remaining queue |
| #315 fainted mega regresses | **refuted for Champions**: the mod's `formeChange` sets `formeRegression` in the Tera branch only, so a Champions mega does NOT revert on fainting; the row cites mainline `sim/battle.ts:2555-2571`, which is guarded by that flag | `data/mods/champions/scripts.ts:75-78`; engine `:21324` already says so |
| #393 damage differential never runs ModifyMove | **closed** — CONTROL FIX 14 runs `ModifyMove` and sets the active move | `tests/test-engine-diff.js:502-506` |
| #528 "43 uncompared leaves" | **20**, and all 20 are duration-1 or self-removing, so none can stand at a boundary | `tests/probe_uncompared_leaves.js` run today: LEAVES 80, COMPARED 54, DECLARED 6, NEITHER 20; "The other 0 have no declared clock" |
| #175 "23 tags with no consumer" | **11** DEAD, all at the accepted ratchet floor, all classification tags (`inflictsBurn`, `lowersTarget`, ...) whose effect flows through the move's own secondary data | `tests/test-tag-consumed.js` run today: STAGED 90 / UNREACHED 27 / DEAD 11, 7 passed 0 failed |
| #319 "157 of 500 moves part by 1-4 HP" | **0 DIFFER** on today's move stage | `roster.moves.json.counts` FIRED-AND-BOARDS-DIFFER 0, MATCH 487 |
| #318 "331 learnset refusals on one carrier" | **10** COULD-NOT-STAGE moves remain, none of them a learnset refusal | `roster.moves.json.scope.could_not_stage_in_scope` 10; reasons are fixture shape (bracket unobservable, control click, forme-keyed type) |
| `PROC_WHAT` hand list in the simulator | it is in **`engine/million_targets.js:445`** (a MEASURE instrument), not in `medicham2-browser.js` (0 hits) | `grep -rn PROC_WHAT engine tests` |

---

## 1. The narration clause — 13 causes grouped by MECHANISM

Source: `end_state[0].summary.by_cause` (13 rows with `materiality: NARRATION-ONLY`, one game each).
Scoreboard for every row: pinned pool (that is where they were measured). Pool usage is move-slots in
`data/team-pool-frozen` (bo3 + ots), counted today.

### 1a. The substitute family — 4 causes, ONE mechanism, a written plan
`|-end|p2a|substitute <> |-resisted|p1b|1`, `|-end|p1b|substitute <> |-resisted|p1a|1`,
`|-end|p1b|substitute <> |-damage|p1a|0fnt`, `|-activate|p2b|substitute|[damage] <> |-damage|p2a|H/H`.
A spread move into a doll and a body: the authority absorbs the doll at `spreadMoveHit` step 0
(`tryPrimaryHitEvent`, mod `scripts.ts:351-354`), this engine at `_stepApply` (step index of `_stepDamage`
+1 in `_STEPS`, `:40829-40832`), so the other row's `-resisted`/`-damage` (written in `_stepDamage`) lands
first. **Diagnosis: written (batches T, U, V, X). Plan: written (commit `b2508865`). Not edited.**
Narration today; the same site produced a real board defect (volley-through-doll, `probe_multihit_through_doll.js`,
Substitute 2,746 pool slots). See §3 for the plan review. **SHOULD FIX BEFORE.**

### 1b. The residual trio — 3 causes, UNEXPLAINED
`|-damage|p2b|H/Hbrn|[from]brn <> |-damage|p1b|...`, `psn <> psn`, `|-heal|p1b|H/H|[from]leftovers <> |-heal|p2a|...`.
Two residual chips/heals in the opposite order. Six batches, two fixtures, Speed reads 70/70, 60/60, 65/75 —
two ties and one not, so not one mechanism. **No diagnosis. No plan.** Named honestly by the session-close
as the residual trio. Narration on every measured game; the corner it could bite is a mutual residual KO,
where the faint order decides the winner under WIRE 160 (`:9403`). **DEFER WITH REASON** (3 games, no new
idea, and the corner is unmeasured rather than measured-clean — say so in 6.0.0).

### 1c. Spicy Spray — 1 cause, UNBLOCKED, two false comments beside it
`|-boost|p1a|def|1 <> |-status|p2b|brn|[from]spicyspray`. Deferred for four batches on "the DamagingHit
order is a die"; batch X read the authority: `sim/battle.ts:789-790` sorts `DamagingHit` handlers by
`compareLeftToRightOrder` (order, priority, target index — deterministic). **Diagnosis written, fix
unblocked, not edited.** The engine's own comment at `:40323` still says the handlers are *"`speedSort`ed
together"*, and `:40250` still places electromorphosis in `_stepDamagingHit` when it is paid in
`_stepBuffOnHit` (`:40397`; authority `data/abilities.ts:1179` `onDamagingHitOrder: 1`). **SHOULD FIX
BEFORE** — cheap, and the comments are the §9 finding.

### 1d. Perish `|upkeep|` drain — 1 cause, derivation left
`event missing from medicham2 :: |upkeep <> |faint|p1a`. The authority fainted a body at residual where
this engine wrote `|upkeep|`. Session-close: *"a miss inside an existing model, next step named"*.
Perish Song is **4,259 pool slots** — the most-brought entity in this whole tail. Narration on the
measured game; a faint whose line moves is a board difference the moment it straddles a boundary.
**SHOULD FIX BEFORE.**

### 1e. Trick's `-fail` — 1 cause, mechanism read today
`event missing from medicham2 :: |-fail|p2a <> |move|p2b|rockslide`. Engine `:31377` refuses a Trick when
**either** body holds any `megaStone` item; the authority refuses only a stone belonging to its holder's
own base species (`data/items.ts:793-794` `onTakeItem(item, source) { return
!item.megaStone?.[source.baseSpecies.baseSpecies]; }`, no mod override — 0 `onTakeItem` in
`data/mods/champions/items.ts`). **This engine already holds the fine rule** as `itemRefusesTake` (`:9909-9916`)
on the Knock Off road (`:8376`). Two implementations of one fact — the CLAUDE.md FACTS-ARE-GLOBAL shape.
Trick 1,226 pool slots; the divergence needs a stone on a non-owner, which is rare. Board-material when
it fires (an item swap). **SHOULD FIX BEFORE** (one call-site change).

### 1f. Post-KO switch-in order — 1 cause, derivation left
`ordering :: |switch|p2a|archaludon <> |switch|p1a|gholdengo`. Authority sort key is the FAINTED body's
Speed, not the arriving one's (batch X). Narration; entry effects on two simultaneous replacements can
interact. **SHOULD FIX BEFORE** (derivation exists).

### 1g. Two singletons with derivations only
`ordering :: |-activate|p1a|lightningrod <> |-prepare|p1b|electroshot` (redirect vs `-prepare` on a charge
move; Electro Shot 9,600 pool slots but the line is narration) and `unrelated event mismatch :: |-fail|p2b
<> |-activate|p1a|psychicterrain` (the `kind === 'boostally'` silent shield named in the session-close,
`:31161`). **DEFER WITH REASON** — narration, single games, derivation written.

---

## 1x. THE THREE VOID GAMES ARE THE THREE BOARD-PARTED GAMES — the finding the brief did not ask for

`mid_void`: 3 games voided as `low-identity`; `by_reason_detail['low-identity'].diverged = 3`;
`void_game_tags[*].board_parted_at_turn` = 4, 6, 3. `end_reasons` carries two of them as *"the boards
parted — medicham2's placement cannot be expressed to showdown (p2: slot 1 holds typhlosion / mudsdale,
which showdown has FAINTED)"* and `end_state` gives two `DIFFERENT-END-STATE` verdicts. The void reason is
`target differs` on 15 of 16 unshared addresses (`unshared_address_field_rollup`), i.e. the two engines
drew the same category for the same move against **different bodies**. Their first divergent lines
(`first_divergences`, all three present in the capped list of 16):

1. **`omit-spread ...2658645239`, turn 3.** Both engines wrote `|move|p1a: Annihilape|Phantom Force|p2a:
   Mudsdale|[from] lockedmove`. The authority then wrote `|-damage|p2a: Mudsdale|0 fnt`; this engine wrote
   `|-resisted|p2b: Liepard|1`. **A charge move announced one body and struck the other.** Mudsdale was
   alive at 78/175. The release picks its body at `:26055-26063` from `_ttmTgtSlot`, an index into `foes`;
   the announce came from somewhere else. Phantom Force is **1,701 pool slots**; the same release path
   serves Solar Beam (15,867) and Electro Shot (9,600). A KO here versus a resisted hit there is a
   winner-shaped difference. **BLOCKS 6.0.0** until a probe stages a two-foe release and says which read is
   wrong.
2. **`omit-spread ...2657358877`, turn 5.** `|-end|p2a: Morpeko|move: Future Sight` (authority) versus
   `|-sideend|p1: |move: reflect` (here): the residual walk ordered a slot-condition end against a
   side-condition end differently, and the board parted at turn 6 with `crit futuresight [me only]` /
   `dmg futuresight [me only]` — this engine drew Future Sight's damage at an address the authority never
   drew. Future Sight 56 pool slots. **Board-material, ENGINE-shaped.**
3. **`omit-protect ...2662758209`, turn 4.** Klefki switched in at the top of the turn, took Scorching
   Sands, and this engine burned it (`|-status|p1a: Klefki|brn`) where the authority did not — every
   Scorching Sands address reads `target differs`. This is the shape the session-close attributes to the
   INSTRUMENT (`freshBodies` dropping `_switchKey`, proven with a control on Morpeko). Probably MEASURE's,
   but "probably" is not an attribution.

**Why this matters for the claim:** `void_games_counted_against_the_engine: false` is a rule, not a
measurement. The rule removes a game when its dice addresses disagree — and a game whose boards part will
have disagreeing addresses from that turn on, so the rule is structurally biased toward removing exactly
the games the bar exists to count. It is MEASURE's instrument; the three attributions are ENGINE's work.
**BLOCKS 6.0.0** as a set: state "0 of 958 usable, 3 voided, of which N were the engine" — with N derived.

---

## 2. `ignoresScreensAndSubs` — the screens half has no probe. Confirmed. And it is the only such tag.

- **Census:** exactly **one** of 830 rows carries the tag: `ability/ignoresscreensandsubs — "infiltrator
  hits the body behind a substitute"`. Of the 22 rows mentioning a screen, none pairs it with the ability.
  (`data/mechanics-census.json.results`, filtered today.)
- **Tag:** `tags.json` `ignoresScreensAndSubs` — `param: "screens, Safeguard and Substitute do not apply
  to its moves"`, 221 uses, sole carrier Infiltrator, `consumedBy: infiltrates`. Named for **three**
  halves; probed on one.
- **Engine:** the screens half IS implemented — `:13785` `if(_sf&&!_critHere&&!TAGS.has('ability',attAb,
  'ignoresScreensAndSubs'))` skips `DOUBLES_SCREEN`; Safeguard's half is the batch-T
  `MEDI_SIDEBUFF_IGNORES_INFILTRATOR` site (`:15911`). Authority (mainline, no mod override): Reflect
  `data/moves.ts:857`, Light Screen `:10338`, Aurora Veil `:14857` — all `!move.infiltrates`; Safeguard
  `:15592,15603`. **Mist is banned** (see §0), so the list is four.
- **Board-material** (a bypassed screen is a doubled damage roll). Expect the lab to move and the pool to
  sit still (Infiltrator 221 uses). **BLOCKS 6.0.0** on the cheap-and-named grounds the session-close gave it:
  it is the exact "name supplied the coverage" shape, and four probes close it.
- **Other N-halves tags, derived from `tags.json`:** 309 tags; names joining halves with And/Or/Both/Either
  = **1** (`ignoresScreensAndSubs`; `survivesAnyHit` matches the regex on "Any", which is not a half). No
  tag's params enumerate N named things with fewer than N census rows. **The related gap is 16 tags with
  ZERO census rows**, four of them carried in the pool: `isBerry` (52,172 uses, 28 carriers — a classifier
  whose behaviour is probed through the berry rows), `refusesCopy` (1,989 uses, 10 carriers), `refusesSecondaries`
  (Shield Dust, 15), `scalesOwnStatusDamage` (Heatproof, 56). DEFER — classifiers and low-use; listed so the
  count is printed, not typed.

---

## 3. The substitute plan — sound in principle, high risk in execution

**The authority's structure** (the mod overrides the loop — `data/mods/champions/scripts.ts:428`
`hitStepMoveHitLoop`, `:315` `spreadMoveHit`; cited by `tests/probe_multihit_through_doll.js:19-27`):
the ARRIVAL loop is outer (`for (hit = 1; hit <= targetHits; hit++)`, mainline `battle-actions.ts:890`),
`targetsCopy = targets.slice(0)` is remade per hit, `spreadMoveHit` runs steps 0-5 per target inside,
`eachEvent('Update')` runs per hit (`:967`), `faintMessages` and `-hitcount` sit below the loop (`:976-978`).

**This engine's structure** (`:40829-40850`, `:40913-40935`): one `_STEPS` list walked step-outside /
target-inside; the multi-hit arrival loop lives INSIDE `_stepApply` (`:37005` onward — `R.pk` packets,
`_dollVolley` `:37145`, per-arrival re-price closure `:14360`, per-hit Update inside the loop with the LAST
hit's pass delegated to `_stepUpdate` — `:37862`, `:37879-37883`, knob `MEDI_MULTIHIT_UPDATE_ONCE` `:15095`).
The `smartTarget` row-major segment (`:40932` `_i0=_STEPS.indexOf(_stepDamage), _i1=_STEPS.indexOf(_stepAfterHitField)`)
already proves the driver can walk a sub-segment per row, with `_stepUpdate` deliberately left outside it
(`:40900-40905` says why).

**Is the plan sound?** Yes: making arrivals the outer loop over `_stepDamage..._stepAfterHitField` is the
authority's actual shape, and the segment lookup is already dynamic. A step-0 doll slot above `_stepDamage`
closes arrival 1 on its own (all four §1a cards are single-arrival spread moves, so it likely closes all
four).

**How risky?** The most dangerous edit available, for four concrete reasons:
1. `_stepDamage` prices the whole volley once and SPLITS it (`:37528`); per-arrival pricing exists only as a
   closure handed into `_stepApply`. An outer loop must move that pricing up, or run `_stepDamage` per hit.
2. `_stepEffects`, `_stepDamagingHit`, `_stepBuffOnHit` are once-per-move here and per-hit in the authority.
   That is #500 (crit-per-hit collapsed to one boolean, `:36524-36532`) and #511 (`-hitcount` dropped on a
   packet collapse, `:37312`). Wrapping them is the fix for both AND changes how many secondary/`sec` draws
   the middle arm takes per address — the void rule keys on `nth`, so the void count can move.
3. **`_stepUpdate` is the named trap and it is real:** the in-loop per-hit Update already exists, with the
   last hit delegated to `_stepUpdate`. Wrapping the segment per arrival either double-fires the last hit's
   Update or skips the intermediate ones, depending on which of the two you keep.
4. `_reached`, `connected`, `_selfPaid`, `_landed`, `_smartRows` are cross-row state read by the flush block
   below the driver (`:40940-41005`); their meaning changes when the walk nests.

**Recommendation:** two stages behind knobs, the bar checked after each, exactly as batch X said. Stage 1
the step-0 doll slot (arrival 1, no dice). Stage 2 the outer loop, landed together with #500/#511/#361 since
they are the same loop. Receipt: `tests/test-resolution-order.js`'s declared KNOWN-OPEN arm closes.

---

## 4. Roster scope gaps — which ones a real ladder game exercises

Counts read from `data/roster.{items,abilities,moves}.json` today; usage is bodies/move-slots in the
frozen pool (408,591 body records) and `tags.json.uses`.

**Items, 6 COULD-NOT-STAGE — all fixture:** Scope Lens (515 pool bodies), Quick Claw (346), King's Rock
(309), Focus Band (34) are chance items unobservable on the roster's pinned corner (`top-tie-first`, every
sub-100 roll fails in both engines); Aspear/Rawst (6 / 4) need a status no 100-accuracy move inflicts.
Census covers Quick Claw (3 rows) and King's Rock; **Scope Lens has 0 census rows** while the engine does
read `critRatioUp` on items (`:10368-10370`). Lab hole on a 515-body item; the pool exercises it under real
dice. DEFER — lab, with the hole named.

**Abilities, 44 COULD-NOT-STAGE:** 32 are `THE STAGING IS INERT` (the authority's own board is identical
with and without the ability on that fixture — a fixture claim), 6 are no-legal-carrier-with-control
(Aerilate, Dragonize, Filter, Fur Coat, Guard Dog, Mega Launcher — all 0-133 pool bodies), 6 are specific
(Cute Charm genderless driver, Gale Wings no faster foe, Ripen, Zero to Hero suppress-tier, ...). By pool
usage the ones a real game exercises: **Gale Wings 3,086** (census: 3 `priorityMod` rows — covered),
**Compound Eyes 1,671** (census **0 rows**, roster inert — an accuracy multiplier with NO lab coverage;
tag `accuracyMod`, consumer `:11700-11720` family), Unaware 1,135 (census 1), Zero to Hero 770 (2),
Magician 722 (1), Cloud Nine 639 (2), Synchronize 398 (4), Frisk 395 (1). **SHOULD FIX BEFORE: a Compound
Eyes probe** (a 1,671-body accuracy fact with no instrument on it). The rest DEFER.

**Abilities, 14 CONTROL-NOT-QUIET:** Damp (1,673 pool; census `blocksExplosion` 1 row, and CLAUDE.md
records the exact-zero probe), Magma Armor 360, Moxie 291, Keen Eye 181, Rivalry 159, Justified 146,
Stalwart 136, Anger Point 66, Slush Rush 60, Super Luck 44, Aftermath 2, Battle Bond / Sticky Hold 0. The
control arm is itself a live ability, so the delta cannot be charged. Lab debt; DEFER except Damp is
already probed elsewhere.

**Abilities, 5 DEFERRED-BY-OWNER:** Anticipation, Forewarn (message-only), Illusion (858 pool — shelved on
the carrier), Pickup (14), Stall (0). Illusion is the one with usage; the AMF instrument shows its
`switch: a different body` shape on Bitter Malice (484 slots) and Night Daze as ANNOUNCEMENT-ONLY. DEFER.

**Moves, 10 COULD-NOT-STAGE:** Extreme Speed (5,822 pool), Ice Shard (2,510), Jet Punch (763) — "a bracket
is only observable if ORDER decides the board" on this fixture; census covers them (`move/priority`,
`failsIfTargetMoveNotPriority`). Imprison (1,046) and Memento (146) THREW on `pass, move 1` — a **harness
defect** (the subject arm never ran). Upper Hand (292) inert. Aura Wheel / Raging Bull forme-keyed type,
Struggle disabled, Focus Energy is the control click. **SHOULD FIX BEFORE: the Imprison/Memento THREW** (a
staged row that throws is a fixture bug hiding a 1,046-slot move). **3 DEFERRED:** Axe Kick (2 clicks),
Electrify (18), Copycat (wired and green; the row fails on `addVolatile` refusal — fixture).

---

## 5. The damage differential has never applied a multi-hit move — covered elsewhere

`data/engine-diff.json`: `scope: "damage only"`, `compared 6000 / disagreed 0`, `skipped_multihit 134`
across 11 moves (`dualwingbeat 48, rockblast 25, pinmissile 13, tripleaxel 13, bulletseed 11, ...`),
`skipped_ability_multihit 17` (Parental Bond), `pool.dropped 9` (species with no `MC.mons` row — the
dropped list includes species that are not legal in this format, which is the priors file's contamination,
not the engine's). `skipped_ability_multihit_why` says it plainly: `dmgRange` prices the whole click and
`moveHit` is one packet.

**Covered:** all 11 skipped moves read `FIRED-AND-BOARDS-MATCH` on the roster's move stage with the
pinned count stated per row ("THE PIN LANDS ON 2/3/5/10 HIT(S)"); Parental Bond `FIRED-AND-BOARDS-MATCH`
on a Kangaskhan mega carrier; census carries `move/multiHit`, `ability/hitsTwice` (4 rows),
`reactionPerArrival`, `reactorPerHit`; `probe_multihit_through_doll.js` covers the doll case. **What is NOT
covered:** a per-hit packet against `moveHit` at every roll index — the roster stages ONE count per move on
ONE corner. That is a declared band gap (`band_why` in the artifact), not a blind spot. DEFER WITH REASON;
6.0.0 states it.

---

## 6. The named register rows — still true on the current tree?

| row | mechanism | still true? | board? |
|---|---|---|---|
| #535 Unburden | `:17207` "`_hadItem && !m.item` is this engine's stand-in for the authority's `unburden` VOLATILE" — reads the slot, not a volatile granted at loss | **YES** | yes (Speed) — 5,036 uses. **SHOULD FIX BEFORE** |
| #529 `takesTargetItem` Bug Bite/Pluck | `tag_dex.js` `eats` regex single-quoted vs compiled dist double-quoted; blocked on a usage refresh | YES (not re-checked in tag_dex today) | yes, 105 uses. DEFER |
| #500 reaction per hit | `:36524-36532` — `_stepEffects` wrapped once per move | **YES** | narration until a per-hit crit reaction (Anger Point) differs. Fold into §3 stage 2 |
| #511 `-hitcount` on collapse | `:37312` `hitCountDroppedOnCollapse` | **YES** | narration. Fold into §3 |
| #541 swapped ability announce | `:5032-5041` Skill Swap announce shape; row filed by MEASURE with the board half unattributed | YES (narration confirmed by the row) | narration. DEFER |
| #542 Fairy Aura family | fence row, "at least four mechanisms"; `MEGA_ABIL` keys Floette wrong (`:8256`) | YES as a fence | board when it fires (x1.33). DEFER, read before touching M2 |
| #549 no switch action in staging | `tests/roster.js:1918` `switch_probe`, `:5548-5556` `switchVerdict` reused from the move stage — the roster now asks a body to LEAVE and compares refusals | **largely closed** — verify and close the row | n/a |
| #315 fainted mega forme | refuted for Champions (§0) | **NO** — close the row | — |
| #362 double wipe | WIRE 160 (§0) | **NO** — close the row | — |
| #403 Sucker Punch | closed in prose 2026-08-23; cell says open | **NO** — flip the cell | — |
| #412 `position_features.js:249` | not `medicham2-browser.js`; a features file downstream of ENGINE | out of this review's file | — |
| #393 ModifyMove | CONTROL FIX 14 (§0) | **NO** — close | — |
| #175 23 unconsumed tags | 11, all at the floor (§0) | mostly NO — retitle to 11 | — |
| #528 43 leaves | 20, all unreachable at a boundary (§7) | **NO** in substance — close with the probe's line | — |
| #319 157 moves 1-4 HP | roster 0 DIFFER (§0) | **NO** — close | — |
| #318 331 learnset refusals | 10 could-not-stage, none learnset (§0) | **NO** — close | — |
| #334 confusion self-hit index | `:2968-2972` — the knob `MEDI_CONFUSION_DMG_ADDR_LEGACY` and the differential's `getConfusionDamage` wrapper exist; row says root cause unprobed | UNKNOWN — the counters exist, the row was never re-measured | board (self-hit damage). DEFER pending one probe |
| #361 multi-hit count | reproduces per the corrected headline; the count draw is the `any` bucket (`range_form_seen_by_cat`, `sec|hurricane|2..5` etc.) | YES | board when the count differs; fold into §3 |

Seven of the eighteen rows the brief named are closed on the tree and still open in the register. That is
the "rows here have asserted defects fixed days earlier" shape, seen seven times in one list.

---

## 7. Uncompared leaves — run today, read-only

`tests/probe_uncompared_leaves.js` (loads only `board_state.js` and `champions_sim.js`): **80 leaves a
legal mechanic can write; COMPARED 54; DECLARED 6 (attract, curse, healblock, powershift, unburden, yawn);
NEITHER 20** — 18 with an authority duration of 1 ended in the residual (`sim/battle.ts:1097-1115`), 2
self-removing (`volatile:fling`, `volatile:sparklingaria`), **0 with a clock of 2+**. "0 dead leaves." So
"board-material 0" is a claim about 54 compared + 6 declared, and the 20 outside cannot be standing when a
board is read. The DECLARED six are the ones a reader should know: **Unburden's volatile is declared
uncompared, which is why #535 cannot show up on the bar.**

---

## 8. The turn cap and completion — confirmed

`turns_cap 50`, `games_cut_off_by_the_turn_cap 0`, `ladder_truncated_by_the_cap null`. `end_reasons`:
**958 "both engines ended the battle"**, 2 "the boards parted — placement cannot be expressed", 1 THREW.
"Ended" is `battle.ended && M.battleOver(S)` (`game_differential.js:4486`) — both engines have a winner or
a tie. Longest game 36 turns (`agreement_by_turn`), median 9 (`by_reason_detail`). Driver `--steering
empirical` (`empirical-click/v1`, P(move | species) from `data/move-priors.json`). **Every game in the 958
ends with a winner in both engines; board-material 0 is a statement about games that end.** No issue.

---

## 9. Engine comments asserting derivations — the sweep

232 lines match "the authority does / Showdown sorts / speedSort / sorts by / compareLeftToRightOrder"
(`grep`, saved to the session scratchpad). Eleven cited-line claims spot-checked against checkout `20ad99f`:

| engine line | claim | authority | verdict |
|---|---|---|---|
| `:6538` | `singleEvent('AfterMove')` in `useMove`, `battle-actions.ts:311` | `:311` is that line, in `useMove` | true |
| `:9377`, `:9381` | `speedSort` at `battle.ts:429-459`; `speedSort(handlers)` ONCE at `:505` | `:429` yes; the call is at **`:507`** | off by two, harmless |
| `:15537` | duration decrement before the handler, `battle.ts:515-523` | `:515-523` exactly | true |
| `:17130` | no x1.5 on Speed; `chainModify` in 4096ths | (known; `Battle#modify`) | true |
| `:21318` | mega at order 104, switch 103, `battle-queue.ts:184` | `:183-184` | true |
| `:24993` | ability `onStart` runs AS `onSwitchIn`, `battle.ts:1018` | `getCallback` comment `:1019-1020` | true |
| `:25560` | `getRandomTarget` draw at `battle-actions.ts:223` | `:223` is `getTarget(...)`, which reaches it | true (one hop) |
| `:16518` | `deductPP` below BeforeMove, `:280-284` | `:282` | true |
| `:8471` | weather chip `speedSort(actives, (a,b)=>b.speed-a.speed)` | `battle.ts:468` | true |
| `:24950` | `fieldEvent` speed-sorts handlers, `battle.ts:794` | `:794` (and `:790` for the left-to-right events) | true |
| **`:40323`** | `onDamagingHit` and `onSourceDamagingHit` "`speedSort`ed together" | `battle.ts:789-790`: `DamagingHit` uses `compareLeftToRightOrder` | **FALSE** (the batch-X one, still standing) |
| **`:40250`** | electromorphosis "lives" in `_stepDamagingHit` | it is paid in `_stepBuffOnHit` `:40397` (order-1 in `abilities.ts:1179`) | **FALSE** (still standing) |

Ten of twelve hold. The two false ones are the two the session found and are the ones that deferred a fix
for days. **SHOULD FIX BEFORE** (with §1c).

---

## 10. Anything else that would embarrass "correct against Showdown"

- **Two empty `catch(e){}` around tag reads** — `:5500` (`priorityBlockAbilities`: Dazzling / Queenly
  Majesty / Armor Tail) and `:6275` (`pressureScopeOf`). If `TAGS.withTag` ever throws, priority blocking
  silently becomes an empty map and Pressure scope becomes null, with no counter. `:11717` and `:17804` are
  the loud/browser kind and are fine. **SHOULD FIX BEFORE** — make them count.
- **`MEGA_ABIL` (`:8192-8206`) is a HAND-TYPED map of 76 mega abilities "(Serebii megaabilities.shtml)"**,
  still consulted by `megaAbility()` (`:8223`) for the base-row-plus-stone construction path, and its own
  comment at `:8256` records a wrong key. CLAUDE.md: no Pokemon value typed from memory. The format
  derives every one (`Dex.forFormat` filtered). **SHOULD FIX BEFORE** (derive; the artifact path exists).
- **Two implementations of the mega-stone take rule** (§1e): `itemRefusesTake` `:9909` (fine) vs `:31377`
  (coarse). Same class as the Unburden slot stand-in.
- **`POWDER` (`:17940`) and `AIRBORNE_ABIL` (`:6804`) are name sets** where the authority has `flags.powder`
  and an ability tag. `POWDER` is conformance-checked (`tests/mutation_harness.js:846`, 8 names vs 7
  carriers); `SUBPASS` (`:11436`) is checked by `engine-diff`'s `substitute_bypass_conformance` (51 in set,
  0 missing, 0 extra). `AIRBORNE_ABIL` has no check found. DEFER — low risk, say it.
- **`indexOf` returning -1:** 152 sites; the unguarded ones feed `tgtSlot:-1` / `allySlot:-1` as an
  explicit sentinel (`:26237-26240`, `:27798`, `:31747`) and are by design. No silent -1-as-zero read found.
- **The AMF instrument carries two `STATE` partings the gate subtracts below the usage shelf**
  (`data/all-mechanics-fire.json.rows.moves`): **Reflect Type** — `p1.party.gengar.types us=ghost/poison
  sd=water`, an honest unmodelled pass counted at `:44761` `typeWriterCopyUnmodelled` (33 pool slots); **Heal
  Bell** — `p1.party.venusaur.status us=slp sd=""`, a benched body's sleep uncured (4 pool slots; dispatched
  as `pass`, `:28629`). The roster's own Heal Bell row is `FIRED-AND-BOARDS-MATCH` on a fixture with no
  statused body ("clicked ONCE on turn 2 ... both sides chipped") — **vacuous by construction**. Board-material
  both; obscure tail; **DEFER WITH REASON** (Will's 2026-08-23 ranking), but the Heal Bell fixture is a
  roster defect and belongs on the lab list.
- **Deliberate, declared, and worth restating in 6.0.0:** `end_state_not_compared` — ability trapping, item
  disposition, yawn/attract/curse/heal block, Unburden, Power Shift, rampage count, Future Sight / Wish
  countdowns, trapper mark, magnet rise / syrup bomb durations, and **which move a charge is committed to**
  (the exact field §1x item 1 turns on).

---

## The ranked list

### BLOCKS 6.0.0 (2)
1. **The three void games** (§1x) — a charge-move release striking a different body than it announced
   (Phantom Force, 1,701 pool slots; same road as Solar Beam 15,867 and Electro Shot 9,600), a Future Sight
   / Reflect residual-end order that parts a board, and a post-switch secondary that may be the instrument.
   Board-material, pinned pool. Owed: one probe per game and an attribution; then the 6.0.0 sentence is
   "0 of 958 usable, 3 voided, N engine".
2. **Infiltrator through screens** (§2) — implemented at `:13785`, never probed; four screens (Mist banned).
   Board-material, lab. Owed: four census probes.

### SHOULD FIX BEFORE (9)
3. Substitute family — step-0 doll slot first, outer arrival loop second, with #500/#511/#361 (§1a, §3).
4. Spicy Spray order + the two false comments at `:40250`, `:40323` (§1c, §9).
5. Perish `|upkeep|` drain — Perish Song 4,259 pool slots (§1d).
6. Trick's coarse stone guard — call `itemRefusesTake` at `:31377` (§1e).
7. Unburden as a volatile, not a slot read (`:17207`; #535).
8. Post-KO switch-in order — fainted body's Speed (§1f).
9. Compound Eyes probe — 1,671 pool bodies, 0 lab rows (§4).
10. Imprison / Memento THREW on the roster — a harness defect hiding a 1,046-slot move (§4).
11. Empty catches at `:5500` / `:6275`, and derive `MEGA_ABIL` (§10).

### DEFER WITH REASON (8)
12. Residual trio — unexplained; 3 games; the mutual-KO corner is unmeasured, say so (§1b).
13. Lightning Rod vs `-prepare`; `boostally` silent shield — narration singletons (§1g).
14. Reflect Type unmodelled (33 slots) and Heal Bell bench cure (4 slots) — below shelf; fix the vacuous
    Heal Bell roster fixture when the lab list is next worked (§10).
15. Roster tail: 32 inert stagings, 6 no-carrier, 14 control-not-quiet, 5 owner-deferred, chance items on
    the pinned corner (§4).
16. Damage-differential multi-hit band — declared, covered by roster + probe + census (§5).
17. #529 Bug Bite/Pluck (105 uses, blocked on a usage refresh); #541; #542 fence; #334 pending one probe.
18. 16 zero-census-row tags, led by `refusesCopy` (1,989 uses) (§2).
19. `AIRBORNE_ABIL` name set with no conformance check (§10).

### Register hygiene (not engine work, but the brief asked)
Close or re-cell: #315 (refuted), #362, #393, #403, #319, #318, #528 (20, unreachable), #175 (11), #549 (verify).

---

## OWED, NOT RUN

```bash
# 1. THE THREE VOID GAMES — one probe each, then attribute. These are the only board-parted games in the run.
#    (a) a charge move's release must strike the body it announces, with two live foes and a reordered foe side
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/probe_charge_release_target.js      # to be written; stage Phantom Force turn 2 vs p2a/p2b, assert announce === strike in BOTH engines
#    (b) the residual order of a slot-condition end (Future Sight) against a side-condition end (Reflect)
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/probe_futuresight_vs_sideend_order.js  # to be written; read sim/battle.ts:484-523 for the handler keys first
#    (c) the post-switch secondary addressing — decide instrument vs engine with the Morpeko control
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/game_differential.js --release b730e44f3314 --steering empirical --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --dump-games "omit-protect ...2662758209"

# 2. INFILTRATOR THROUGH SCREENS — four census probes (Reflect, Light Screen, Aurora Veil, Safeguard; Mist is banned), then:
node tests/test-mechanics.js
tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release b730e44f3314

# 3. THE SUBSTITUTE FAMILY, STAGED — bar checked after each stage, never only at the end
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/test-resolution-order.js           # the KNOWN-OPEN arm is the receipt
tools\lownode.cmd engine\game_differential.js --release <new id> --steering empirical --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --write

# 4. THE TWO FALSE COMMENTS — correct :40250 and :40323 in the Spicy Spray pass; no run, a diff somebody can read

# 5. TRICK'S STONE GUARD — replace the two TAGS.has(...,'megaStone') clauses at :31377 with itemRefusesTake(); then
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/probe_trick_mega_stone_owner.js     # to be written; a stone on its owner refuses, a stone on a non-owner swaps, in both engines

# 6. COMPOUND EYES — a census probe on a sub-100 move with the pin lifted, then node tests/test-mechanics.js

# 7. IMPRISON / MEMENTO THREW — fix the fixture's `pass, move 1` script, then
tools\lownode.cmd tests\roster.js --stage moves --write

# 8. REGISTER HYGIENE — flip the cells on #315 #362 #393 #403 #319 #318 #528 #175, verify #549, then
node engine/open_work.js

# 9. THE RELEASE RE-CUT the session-close owes (tags.json / abra-tags.js agreement) before any 6.0.0 measurement
tools\lownode.cmd engine\engine_release.js cut "tags.json and abra-tags.js back in agreement"
```
