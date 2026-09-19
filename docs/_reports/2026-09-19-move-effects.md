# 2026-09-19 — Four single-game move-effect leads (ENGINE, light mode)

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-ae5e9ebe302b4f935`, based on HEAD
`33663935` (6.50.0). Cards from release `482e8f5ca701` (`data/game-differential.g1350.json` /
`.g1950.json` in the main tree, read with `git`-free `require`, mtimes 22:18 / 22:30 on 2026-09-18).

## VERDICT

All four leads were real engine defects. All four are fixed at one shared place, matching tags or
shapes and not names. Each has a knob that brings the defect back. A fifth defect in the same mechanism
as lead 4 was found while staging it, and it is also fixed.

| lead | premise | real cause | fixed | knob |
|---|---|---|---|---|
| 1 Grav Apple 39 vs 16 (g1350) | TRUE: power boost under Gravity | `conditionalPower` bare tag. Stale note: "no state for Gravity" | yes | `MEDI_GRAV_APPLE_IGNORES_GRAVITY` |
| 2 Heal Pulse / Mega Launcher (g1950) | TRUE, but Blastoise is the RECIPIENT. The USER is a Mega Launcher Clawitzer | `healDescriptor` read only the else-arm | yes | `MEDI_HEAL_PULSE_IGNORES_LAUNCHER` |
| 3 Decorate skips Contrary (g1950) | TRUE | `boostally` branch wrote the boost table raw | yes, class-wide (4 moves) | `MEDI_TARGET_BOOST_RAW` |
| 4 Alluring Voice without condition (g1950) | FALSE as stated: the condition IS modelled. Its BASELINE was stale across a switch | `_boostSnap` survived the bench | yes | `MEDI_BOOST_SNAP_SURVIVES_SWITCH` |
| 4b (new) lead-entry raise on turn 1 | found while staging lead 4 | turn-1 baseline taken after lead entry | yes | `MEDI_TURN1_SNAP_AFTER_ENTRY` |

**Census before: 900 of 900 live, 0 missing** (`data/mechanics-census.json`, generated
2026-09-19T03:44:20Z). **After: 905 of 905 live, 0 missing, 0 threw, 0 hollow, run_ok true.**
`node engine/status.js` prints `905/905 probed mechanics live, 0 missing`. There are five new census rows.
Each row was shown MISSING under its own knob before it was shown LIVE.

**Two-engine proof:** `tests/probe_move_effect_leads.js --release 145431fddf1e` reports **all 28 arms
clear**. 14 are red arms. On each of them the authority separates the red arm from its control, both engines
agree on the board, and the knob parts the board. 14 are controls, and no knob moves a control. Every lead
was run RED first on the unfixed tree.

## 1. GRAV APPLE

- **Card.** Seed `…-2654508003 vs …-2654613453`, `--games 1350`, turn 4: Torkoal `16/145` on the authority
  and `39/145` here. The game was replayed on `482e8f5ca701` with `engine/replay_one.js` (UNCHECKED, because
  no stored dump was in the worktree). The replay reached the same split at index 66. Sableye clicked Gravity
  on turn 1, so Gravity was still up on turn 4. Torkoal went 85 → 16 (69) on the authority and 85 → 39 (46)
  here. 69 / 46 = 1.5.
- **Authority.** `data/moves.ts` `gravapple.onBasePower`: `if (this.field.getPseudoWeather('gravity')) return
  this.chainModify(1.5)`. `data/mods/champions/moves.ts:449` is `gravapple: { inherit: true, basePower: 90 }`,
  so the handler is inherited.
- **Cause.** `tag_dex` gave Grav Apple a bare `{conditional:true}`. Its own comment said Gravity "has no
  state" in this engine, which stopped being true when `field.gravity` landed.
- **Fix.** `engine/tag_dex.js:1856` derives `{when:'pseudoWeather', pseudoWeather:<id from the handler>,
  mult}`. `engine/medicham2-browser.js:14007` reads it in the damage path through `RESIDUAL_FOLLOWER_FIELD`,
  which is the existing map from a pseudo-weather id to a field clock. An unknown id is counted in
  `MEDFAILS.variablePowerUnknown`.
- **Class.** A walk over every legal move whose `onBasePower` or `basePowerCallback` reads `getPseudoWeather`
  finds **1: gravapple**. A no-store `tag_dex` run changed exactly one entity.
- **Probe.** Arms `gravity@{top-tie-first,middle}`: Sableye (Prankster) sets Gravity and Flapple Grav Apples
  an Enduring Snorlax. Snorlax is left at 63 on both engines, and 120 under the knob. Control
  `ctl-no-gravity`: Sableye Protects, and both engines read 120. Census row: `conditionalPower` "Grav Apple is
  1.5x while Gravity is up, and nothing else is". The result is 82 → 124. The Dragon Rush control is 93 both
  ways.

## 2. HEAL PULSE AND MEGA LAUNCHER

- **Card.** Seed `…-2656570989 vs …-2656519068`, `pair-redirect-priority`, turn 12. Clawitzer Heal Pulses a
  Blastoise at 55/154. The authority heals it to `154/154`. This engine heals it to `132/154`, which is
  55 + 77, the plain half.
- **Authority.** `healpulse.onHit`: `if (source.hasAbility("megalauncher")) success =
  !!this.heal(this.modify(target.baseMaxhp, 0.75)); else … Math.ceil(target.baseMaxhp * 0.5)`. Champions does
  not override `healpulse` or `megalauncher`. The probe checks this at run time.
- **Cause.** `healDescriptor` matched only the `Math.ceil(... * 0.5)` arm.
- **Fix.** `engine/tag_dex.js:4816` adds `amountIfAbility {whose:'user', ability:'megalauncher', amount:
  {fraction:0.75, of:'recipient', round:'modify'}}`. The role comes from the handler's own parameter
  list. `healSize` (`engine/medicham2-browser.js:8790`) reads it and sizes `modify` through `sdModify`,
  which is `Battle#modify`.
- **Class.** Every legal move whose `onHit` heals a target, derived: Heal Pulse, Pollen Puff and Strength
  Sap. Only Heal Pulse branches on an ability. A no-store `tag_dex` run changed exactly one entity.
- **Probe.** The only legal Mega Launcher carriers are Clawitzer and Blastoise-Mega, both derived, and
  Blastoise does not learn Heal Pulse, also derived. So the varied input is the USER: Clawitzer against
  Slowbro/Oblivious. The heal is sized off the recipient in both arms. Two Night Shades hit Sylveon. In the
  capped arm, Clawitzer's heal reaches 170 on both engines and 155 under the knob, and the control reads 155.
  In the DEEP arm, a third Night Shade lands first. The result is **147 = 20 + modify(170, 0.75) = 127**. A
  ceil would give 128, and the knob gives 105. The control reads 105. Census row `healDescriptor`: 137 on a
  183-HP Garchomp, where a ceil would give 138.

## 3. DECORATE ONTO CONTRARY, AND THE CLASS

- **Card.** Seed `…-2656419834 vs …-2656731493`, `pair-protect-bust`, turn 16. Alcremie Decorates a Contrary
  Malamar across the field. The authority writes `|-unboost|p2b: Malamar|atk|2`, and this engine wrote
  `|-boost|`. On the same boundary the board also parts on Alcremie's HP (58 against 120). That is the same
  turn's cascade, because Malamar attacked with the wrong stages.
- **Authority.** `decorate` has `boosts: {atk:2, spa:2}` and no handler. The boosts are applied by
  `runMoveEffects` → `Battle#boost`. The order inside that is `ChangeBoost` (Contrary x-1, Simple x2), then
  `TryBoost`, then per stat `AfterEachBoost` (Defiant, Competitive). Champions does not override `decorate`
  or `contrary`.
- **Cause.** The engine's `boostally` branch serves the `boostsTarget` members without `statusInflict`:
  **Decorate, Coaching, Aromatic Mist and Howl**. It wrote `clamp(stage + table)` straight into the stages.
  Flatter and Swagger go through `affect`, and `affect`'s `statChange.target` loop already applied `invSign`,
  `statDropRefusal` with its source, `TR.bst` and `retaliateWhenLowered`.
- **Fix.** That loop was lifted verbatim into `boostTableOnto` (`engine/medicham2-browser.js:20787`). Both
  `affect` (`:32170`) and `boostally` (`:33422`) now call it, so there is one road. This also brings Simple
  (x2), the drop refusals and Defiant/Competitive to the four `boostally` moves wherever the change comes out
  negative.
- **The class, audited: every raw `boosts[...] = clamp(...)` write in the engine.**
  - Move-granted boosts onto a body:
    - `boostally`: FIXED.
    - `chargeTurn` boosts (Electro Shot, Meteor Beam): these are a self-raise, but **no legal Contrary
      carrier learns either move** (derived). Only Staraptor-Mega, Serperior, Malamar and Malamar-Mega carry
      Contrary. Not changed.
    - `boostsAlliesWithAbility` (Magnetic Flux): the recipient must carry Plus or Minus, so it cannot be
      Contrary. Not changed.
  - Ability-granted self-boosts (Speed Boost, Moxie class, Stamina, Berserk, the absorb gifts, Opportunist):
    the body's one ability cannot also be Contrary. They cannot be reached.
  - **Item boosts: NOT FIXED, DECLARED.** A Contrary holder of a stat-raising item is not inverted. See OWED.
- **Probe.** The varied input is Malamar's ability, Contrary against Suction Cups. There are two arms: `foe`,
  aimed across the field, and `ally`, aimed at the partner. Those are two different target paths in the
  branch. Both engines read -2/-2 on the red arms, and the knob reads +2/+2. The controls read +2/+2
  everywhere. Census row: `boostsTarget` "Decorate onto a Contrary body lands inverted, at a foe and at the
  partner".
- **Regression.** `tests/probe_simple_beam.js`, `tests/probe_partingshot_mirrorarmor.js` and
  `tests/probe_gooey_boost_road.js` were run on `145431fddf1e`, and all passed. `tests/test-engine-consistency.js`
  passed. `tests/walk_tags.js` passed with 0 throws. Its artifact was restored to HEAD because only its stamp
  moved.

## 4. ALLURING VOICE: THE CONDITION WAS MODELLED, THE BASELINE WAS NOT

- **Card.** Seed `…-2635665638 vs …-2635612029`, baseline, `--games 1950`, turn 2. Only this engine prints
  `|-start|p2a: Swampert|confusion`.
- **Replay** on `482e8f5ca701` (`engine/replay_one.js`, UNCHECKED) reached the same split at index 32.
  Swampert led and took Scrafty's Intimidate (-1 Atk). It was replaced on turn 1 and came back on turn 2.
  Clefable then used Alluring Voice.
- **Authority.** `alluringvoice.secondary.onHit`: `if (target?.statsRaisedThisTurn)
  target.addVolatile('confusion')`. Burning Jealousy is the same with `trySetStatus('brn')`. The flag is set
  in `Battle#boost` (`sim/battle.ts:2082`). It is cleared ON SWITCH-OUT (`sim/battle-actions.ts:123`) and at
  `nextTurn` (`sim/battle.ts:1672`).
- **Cause.** `statsRoseThisTurn` compares the stages against `_boostSnap`. The turn top took that snapshot
  for ACTIVE bodies only. So the returning Swampert still held its turn-1 snapshot `{at:-1}`, and its reset
  0 read as a rise.
- **Fix.** `bringIn` sets the baseline on arrival (`engine/medicham2-browser.js:25091`). It does this after
  Baton Pass state, which copies stages without raising them, and before hazards and entry abilities, whose
  raises do count.
- **Probe.** Red arm: Scizor is Intimidated at lead, holds -1 into turn 2's snapshot, pivots out on turn 2,
  comes back on turn 3 and takes the Alluring Voice. No confusion on either engine, and confusion under the
  knob. Control: the rule's positive arm, where Scizor stays in and Swords Dances ahead of the Clefable.
  Both engines confuse.
  - The first fixture was Garchomp. At the `middle` pin a Fairy hit KO'd it, and the harness refused that arm
    as `FIXTURE BLIND` rather than passing it. It was swapped to Fairy-resisting Scizor.
  - The fixture needs three turns because of 4b. With 4b fixed, a turn-1 pivot leaves a 0 snapshot, and the
    knob could not show the defect.
- Census row: `punishesBoostedTarget` "a body back from the bench has raised nothing this turn, whatever it
  held before".

### 4b. NEW: A RAISE AT LEAD ENTRY COUNTS ON TURN 1

- **Authority.** `nextTurn` runs `this.turn++` (`sim/battle.ts:1621`) and then
  `if (this.turn !== 1) { … statsRaisedThisTurn = false … }` (`:1672`). So raises made while the leads
  enter survive into turn 1.
- **Staged.** A Defiant Kingambit leads into an Intimidate (-1, then +2). A turn-1 Alluring Voice confuses
  it on the authority and did not confuse it here. The Pressure control is confused on neither engine.
- **Fix.** `battleInit` sets the leads' baseline before the entry pass (`:26900`). The turn-1 top keeps it
  (`:28036`). A seeded board runs no entry pass, so it is unchanged.
- **Probe.** Lead `turn1raise`. Census row: "a raise at lead entry counts as raised on turn 1".
- **Not on any card.** This is a lab finding, and the pool may or may not hold a game where it matters.

## FILES CHANGED (worktree)

- `engine/medicham2-browser.js`:
  - the `conditionalPower` `pseudoWeather` arm
  - `healSize` reads `amountIfAbility` and rounds with `modify`
  - `boostTableOnto`, used by `affect` and `boostally`
  - the `bringIn` baseline
  - the `battleInit` lead baseline and the turn-1 keep
  - five knobs and five `MEDFAILS.*Restored` stamps
- `engine/tag_dex.js`: `conditionalPower {when:'pseudoWeather'}`, `healDescriptor.amountIfAbility`, and the
  stale Grav Apple note corrected.
- `data/tags.json`: **SPLICED, NOT REGENERATED.** The worktree has no store. A no-store `tag_dex` run was
  diffed per entity against HEAD. Exactly `moves.gravapple` and `moves.healpulse` changed shape, and only
  their `tags` and `params` were carried in. `data/abra-tags.js` was rebuilt, and `--check` agrees.
- `data/mechanics-census.json`: regenerated at 905 of 905.
- `tests/test-mechanics.js`: five census probes, plus `healRun` gains `userAbility`.
- `tests/probe_move_effect_leads.js` (NEW): the two-engine probe, with 5 leads and 28 arms.
- `docs/ENGINE.md`: a ledger section and the hand list, and the new probe added to "Owns". The GENERATED
  block was not touched.
- Not handed back: `data/engine-release.json` and `data/provenance-stamp.json` were restored byte-for-byte.
  `data/tag-walk.json` was restored because only its stamp moved. `data/releases/` in the worktree
  (ignored) holds a copy of `482e8f5ca701`, used for the replays, and the probe's cuts, including
  `145431fddf1e`.

## PROPOSED NOTES ROW

**2026-09-19. ENGINE: four single-game lattice leads fixed, and a fifth defect found while staging them.**

- The fixes:
  - Grav Apple is x1.5 under Gravity (`conditionalPower {when:'pseudoWeather'}`).
  - Heal Pulse from a Mega Launcher user heals `modify(max, 0.75)` (`healDescriptor.amountIfAbility`).
  - The `boostsTarget` table (Decorate, Coaching, Aromatic Mist, Howl) now runs through `boostTableOnto`, the
    road `affect` already used. So Contrary, Simple, the drop refusals and Defiant/Competitive now apply to it.
  - "Raised a stat this turn" is re-baselined when a body arrives from the bench (Alluring Voice / Burning
    Jealousy).
  - New: a raise at lead entry counts on turn 1, as `nextTurn`'s `turn !== 1` clear requires.
- Five knobs: `MEDI_GRAV_APPLE_IGNORES_GRAVITY`, `MEDI_HEAL_PULSE_IGNORES_LAUNCHER`, `MEDI_TARGET_BOOST_RAW`,
  `MEDI_BOOST_SNAP_SURVIVES_SWITCH`, `MEDI_TURN1_SNAP_AFTER_ENTRY`.
- Proof: `tests/probe_move_effect_leads.js` has 28 arms, and all of them are clear on the worktree release
  `145431fddf1e`.
- Census: 900 → 905 live, 0 missing (`data/mechanics-census.json`).
- `data/tags.json` was spliced (gravapple, healpulse), not regenerated. Re-run `tag_dex` on the main tree.
- These mechanisms account for 4 of the 27 board-material games on `482e8f5ca701`. The lattices on the new
  release are OWED.
- **Supersedes.** Nothing published; no lattice figure was re-measured.
- **Basis.** unchanged.
- Owes the fold-in to: `docs/ABRA-technical-docs.md` (engine mechanics), at the next major.

## OWED, NOT RUN

- **The three lattices (`--games 1200/1350/1950`) on a release cut from the merged tree.** Light mode
  forbade them. The prediction is that the 4 lead games leave (the Grav Apple game at 1350; Heal Pulse,
  Decorate and Alluring Voice at 1950) and none join. Lead 4b and the Decorate class could move other games.
  That prediction is unmeasured.
- **`tests/test-engine-diff.js --n 6000`, the roster stages and `all_mechanics_fire.js` on the new release.**
  `status.js` already marks `engine-diff.json` as measured against a different engine.
- **`tag_dex` on the main tree, which has the store,** to confirm that only `gravapple` and `healpulse` move.
- **Item-granted boosts write raw** (Weakness Policy, Room Service, the terrain seeds, the pinch berries,
  Absorb Bulb/Cell Battery/Luminous Moss/Snowball, Adrenaline Orb). A Contrary holder of any of them is not
  inverted, and Simple does not double them. There are 4 legal Contrary carriers. No probe was written.
  Declared remainder.
- **A Mold Breaker source** should suppress the target's Contrary (a breakable ability) on both boost roads.
  Not modelled before, and not modelled now.
- **`statsLoweredThisTurn` (Lash Out)** is still unmodelled and still counted in
  `MEDFAILS.variablePowerUnknown`. The 4b and bench-baseline rules will apply to it when it is built.
- **Seeded boards** (`battleInit(..., {seeded:true})`) still take the turn-1 baseline at the turn top. They
  run no entry pass, so this is correct for them. A caller that seeds and then fakes an entry is not covered.
