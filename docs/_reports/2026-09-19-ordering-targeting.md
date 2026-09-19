# Ordering and targeting leads — 2026-09-19, ENGINE, LIGHT MODE

Four single-game leads from the whole-game differential on release `482e8f5ca701`. Each card came from
`data/game-differential.g1350.json` / `.g1950.json` (main tree) and was joined to its `--dump-games` card
in the session scratchpad (`mr/dump1350.json`, `mr/dump1950.json`). Staged boards and single probes only:
no game differential, no roster stage, no `quarantine.js`, no `all_mechanics_fire`.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a50e2e4f81c74ca3a`.
Every probe below ran on the live worktree tree through `tests/_live_release.js` (a throwaway release store
under the OS temp directory). No release was cut into `data/releases` on purpose. A few older probes that
ignore `_live_release` wrote there during the regression pass. `data/engine-release.json` and
`data/provenance-stamp.json` were restored to HEAD before hand-back.

## 0. VERDICT

| lead | premise | fixed | probe | knob |
|---|---|---|---|---|
| 1 Helping Hand at an ally that has already moved | TRUE | yes | `tests/probe_helpinghand_moved_ally.js` (2 red, 2 control) | `MEDI_HELPINGHAND_MOVED_ALLY=1` |
| 2 Round not promoted | TRUE | yes | `tests/probe_round_promotion.js` (4 red, 1 control) | `MEDI_ROUND_UNPROMOTED=1` |
| 3 Trace picks a different foe | NOT REPRODUCED | no | `tests/probe_mega_trace_die.js` (90 plays, all agree) | — |
| 4 Magic Bounce does not reflect Yawn | TRUE, and a CLASS of 11 moves / 5 kinds | yes | `tests/probe_bounce_reflectable_class.js` (60 moves) | `MEDI_BOUNCE_KIND_BLIND=1` |

Census `data/mechanics-census.json`: **900 → 903 live, 0 missing** (903 probed). HEAD's census read
900/900/0, generated 2026-09-19T03:44:20Z. The new one was generated 2026-09-19T05:06:53Z. Each of the three new rows
was shown MISSING under its own knob before the clean run, and the census refused to write under each
knob (`DELIBERATE_BREAK`).

None of the four is an exact speed tie. Speeds were read from the format:
- Card 1: Whimsicott base 116 with Prankster, Farigiraf base 60. Both are in the +5 bracket, so speed
  decides the order.
- Card 2: a queue promotion, not a speed comparison. The Sylveon (60) → Staraptor (100) → Dragapult (142)
  order on this engine reads as a Trick Room turn, which the promotion overrides on the authority.
- Card 4 has no ordering in it.
- Card 3: the mega phase order agreed on every staged play.

## 1. HELPING HAND

**Card.** Two g1350 games had the same first split: `|-fail|p2a: Farigiraf` on the authority against this
engine's `|-singleturn|p2b: Whimsicott|Helping Hand`. The Prankster Whimsicott Protects in the +5 bracket and
moves first, and the Farigiraf's Helping Hand then aims at a body that has already acted.

**Authority.** `data/moves.ts:8586-8588` (no Champions row):
`onTryHit(target) { if (!target.newlySwitched && !this.queue.willMove(target)) return false; }`.
It is raised by `singleEvent('TryHit', moveData, …)` in the Champions `spreadMoveHit`
(`data/mods/champions/scripts.ts:333-338`). That is after the step-1 `runEvent('TryHit')`, and its `false`
writes `-fail` on the user with `[still]`. `newlySwitched` is set on switch-in (`sim/pokemon.ts:1557`,
Champions `scripts.ts:167`) and cleared at `nextTurn` (`sim/battle.ts:1670`). That is the same lifecycle
as this engine's `_newlySwitched` (WIRE 135).

**Class.** Every legal move's handlers were scanned for `willMove`. The negated
`!this.queue.willMove(target)` with a `return false` in `onTryHit` matches exactly **helpinghand** and
**electrify**. After You and Quash are `onHit` and reorder rather than refuse. Sucker Punch and Upper
Hand are the existing positive-sign `failsIfTargetNotAttacking`.

**Fix.**
- New tag `failsIfTargetAlreadyMoved`, derived in `engine/tag_dex.js`. Its params are
  `exemptIfNewlySwitched` (Helping Hand) and `exemptIfNoActiveTurns` (Electrify).
- One reader, `targetAlreadyMovedRefuses(t, mv, willMove)`, fed the existing `queueWillMove`. It is
  called in the Helping Hand branch after `tryHitRefusal`, which is the authority's order.
- Electrify has no branch in this engine, and its `activeTurns` clause is counted
  (`MEDFAILS.alreadyMovedClauseUnread`) rather than answered with the wrong exemption.

**Probe.** `tests/probe_helpinghand_moved_ally.js`. The species are derived: Dragapult/Torkoal are the
fastest and slowest Helping Hand + Protect learners with a quiet ability, and Whimsicott is the fastest
Prankster.
- `mutual` (red): both partners Helping Hand each other.
- `prankster-first` (red): the card's shape.
- `ally-still-queued` (control): the target has not moved yet.
- `ally-newly-switched` (control): Helping Hand lands on an entrant. The probe asserts that the engine
  reached the exemption (`MEDSEEN.alreadyMovedExemptNewlySwitched` = 1).

Before the fix, both red arms read authority `marks 1 fails 1` / `marks 0 fails 1` against the engine's
`marks 2 fails 0` / `marks 1 fails 0`. After the fix all four arms agree with a null protocol divergence,
and the knob parts exactly `[mutual, prankster-first]`.

**Census row:** `failsIfTargetAlreadyMoved`, "Helping Hand fails at a partner that has already moved
this turn". It was MISSING under the knob.

**What it does not prove.** The card's board divergence was at turn 15 (Scolipede HP 85 vs 135). The
protocol divergence was at turn 2. Whether the turn-15 part is this defect cascading through
`_mvRes`/turn state, or something else, needs the game replayed with warm-up (see OWED).

## 2. ROUND

**Card.** g1350, turn 7. The authority wrote `|move|p1b: Dragapult|Round|p2b: Staraptor|[from] move: Round`
straight after the Sylveon's Round, at 120 BP. This engine let the Staraptor's Brave Bird go first and priced
the second Round at 60. Staraptor HP was 95 on the authority and 103 here.

**Authority.** `data/moves.ts:15493-15517` (no Champions row).
- `onTry` walks `this.queue.list` for the first action whose move is `round`. There is **no side test and
  no fainted test**. It calls `prioritizeAction(action, move)`, which stamps `sourceEffect` and
  `order = 3` (`sim/battle-queue.ts:277-286`).
- `basePowerCallback` doubles when `move.sourceEffect === 'round'`.
- `Try` runs in `trySpreadMoveHit` (`sim/battle-actions.ts:590`): only with a target, above PrepareHit
  and every hit step.
- The promoted move line carries `[from]` (`sim/battle-actions.ts:452`).

**Class.** The only legal move calling `prioritizeAction(action, move)` from `onTry` is Round. After You
and Instruct call it from `onHit` without the move.

**Fix.**
- New tag `promotesSameMoveInQueue` → `{moveId:'round', promotedBy:'round', mult:2}`.
- `promoteQueuedSameMove` sits at the attack branch's `Try` position (just under `_hadTargets`). It sets
  `_order = TURN_ORDER.next` and `_promotedBy` on the first unresolved matching action.
- The doubling rides `ACTION_PROMOTED`. It is set at the top of each action iteration and nulled at
  `battleTurn` entry and after the action loop, so a between-turns `dmgRange` (board.js, rollouts) can
  never see it.
- The move line gets `[from] move: round`. This is fidelity only, because the differ truncates `|move|`
  lines.

**Probe.** `tests/probe_round_promotion.js`. The species are derived: Weavile fast, Torkoal slow, Avalugg
second-slow, Heracross mid foe, Appletun target, Aggron as the control partner.

| arm | kind | what it stages |
|---|---|---|
| `partner` | red | the card's shape |
| `foe-round` | red | the promoted Round is the other side's |
| `chain` | red | three Rounds |
| `into-protect` | red | the first Round is aimed into a Protect |
| `no-second` | control | no second Round |

All five agree on move order, damage and board. Under the knob, the four red arms part on order, damage
and board, and the control holds.

**Census row:** `promotesSameMoveInQueue`. Under the knob, Torkoal's Round behind Weavile's added 31 where
it must add about 2×31. It was MISSING under the knob and is live clean.

## 3. TRACE — NOT REPRODUCED

**Card.** g1950 `pair-protect-bust`, `…2657391947 vs …2657358877`. The board parted at turn 2 on
`p2.party.alakazam.ability medicham toughclaws / showdown competitive`, and the protocol at turn 4. The foes
were Charizard (Mega X: Tough Claws) and Milotic (Competitive).

**Authority.** Trace samples a die over the eligible foes: `data/abilities.ts:5110`, no Champions row,
`this.sample(possibleTargets)`. A different pick is either a different LIST or a different DIE ADDRESS.

**Probe.** `tests/probe_mega_trace_die.js`. The Trace mega and the foe megas are derived: Alakazam +
Alakazite, Aggron + Aggronite (slower foe), Aerodactyl + Aerodactylite (faster foe), Absol partner. There
are five arms: the foe megas slower, the foe megas faster, the foe has no stone, and two turn-2 arms where
the foe is already mega. Each arm ran under both pinned corners and 16 middle-arm seeds, 90 plays in
total.
- **Every copied ability agreed.**
- The mega order agreed on every play.
- The authority's `-ability … [from] ability: Trace|[of] …` line named the same foe the engine copied.

So on every shape staged, it is neither the candidate set (membership and order) nor the die.

**Replay attempt.** `engine/replay_one.js --no-warmup` in the card's config played a different game:
Alakazam in p2b, and both engines copied Competitive. It is NOT the artifact's game and is not reported as
one. Reproducing the card needs the warm-up schedule, which plays the lattice up to that pair. That is a
lattice-scale run and is out of LIGHT MODE.

**Status.** Carried forward, not closed. The probe stands as the regression guard for the mega-door die.

## 4. MAGIC BOUNCE — A CLASS OF ELEVEN

**Card.** g1950 `omit-intimidate`, turn 8. The authority wrote
`|move|p2a: Hatterene|Yawn|p1b: Umbreon|[from] ability: Magic Bounce` and the Umbreon slept a turn later.
This engine drowsed the Hatterene.

**Authority.** `magicbounce.onTryHit` / `onAllyTryHitSide` (`data/abilities.ts:2427-2447`, no Champions
row) reflect any move with the `reflectable` flag.
- **Only one side test.** `onTryHit` has none beyond `target === source`. `onAllyTryHitSide` refuses a
  source on the holder's own side.
- **The reflection is a new move.** It is a fresh `useMove` with the BOUNCER as source.
- **Order against Protect.** `onTryHitPriority: 1` runs under Protect's `3` (`data/moves.ts:13986`;
  sort at `sim/battle.ts:421-426`). A shielded bouncer therefore blocks rather than reflects.

**Class.** `tests/probe_bounce_reflectable_class.js` stages every legal `reflectable` move (60, derived) at
a Magic Bounce Espeon, against the same Espeon under Synchronize. Before the fix, **eleven differed**, and
they are exactly the members of five dispatch kinds whose branch never called `bounceOff`:

| kind | moves |
|---|---|
| yawn | Yawn |
| phaze | Roar, Whirlwind |
| abilitywrite | Entrainment, Worry Seed, Simple Beam |
| healdesc | Heal Pulse |
| hazard | Spikes, Stealth Rock, Sticky Web, Toxic Spikes |

The other kinds (affect, status, typechange, trapmove, pploss, switch, trickitem, sharehp, typesplit)
already reflect and agreed.

**Fix.** There is one shared step-1 helper, `bounceAtTryHit(m, t, mv)`.
- It asks `shieldRefuses` first, then `bounceOff`.
- It returns `{src, t, bounced}`, so a branch cannot take the new target without the new source.
- It re-aims `MID_TGT` at the clicker, which is the same address fix the status branch already makes.
  That fixed the Roar/Whirlwind drag pick, which parted on the first attempt without it.

`bounceSideAtTryHit` is the `foeSide` half for the hazards, and the layer lands on the clicker's side with
the bouncer as setter. The five branches now call the helper and read the source role from `src`:
- **abilitywrite:** Entrainment hands over the bouncer's ability.
- **healdesc:** the heal is priced off `src` (Mega Launcher).
- **phaze:** `tryHitRefusal`, `suppressedAbility` and `moveClassBlocked` read `src`.
- **yawn:** the refusal gates read `src`.

**Probe results.**
- Clean: **58 of 60 AGREE-BOUNCED.** 2 have no staged learner (Magic Powder, Spore); both are the
  `status` kind, which already reflects.
- `MEDI_BOUNCE_KIND_BLIND=1` parts exactly the ten learnable members, and Simple Beam separately (11).
  The control arm agrees in every row.

**Census row:** `reflectsStatusMoves`, "Magic Bounce reflects Yawn, Roar, Entrainment, Heal Pulse and
Spikes back onto the clicker". Control [1,0] on every kind and test [0,1]. Under the knob the test read
[1,0] and the row was MISSING.

**Stated limits, not modelled:**
- a semi-invulnerable bouncer (`isSemiInvulnerable`);
- `pranksterBoosted = false` on the reflected move;
- the bounced move's own `-fail` STATE on the bouncer in the yawn, phaze and healdesc branches. Their
  mvFail still writes to the clicker. abilitywrite writes the bouncer's line without state.

## 5. REGRESSIONS

The related probes were re-run on the final tree. Green:
- `probe_announce_failure`, `probe_bounce_accuracy_address`, `probe_pivot_magic_bounce`
- `probe_shield_before_ability`, `probe_trace_choice`, `probe_yawn_safeguard_refusal`
- `probe_yawn_substitute`, `probe_hazard_lay_order`, `probe_hazard_sweep_order`, `probe_hazard_recap_fail`
- `probe_phaze_empty_bench`, `probe_drag_body`, `probe_drag_exposure`, `probe_charge_release_chosen_slot`
- `probe_corner_mechanisms`, `probe_encore_bracket`, `probe_misty_terrain_status`, `probe_shield_rearm`

Two were already red or unable to answer:
- **`probe_default_target_side.js` — RED on all 12 arms, and NOT this pass.** The engines agree line
  for line in every arm. The failing clause is the `near-side draws counted` counter, for example clean 3
  against an expected 0. It fails identically with all three of this pass's knobs set, which restores the
  pre-fix paths. The cause is the counter's own expectation, not these changes.
- **`probe_perish_faint_upkeep.js` — CANNOT ANSWER.** It pins the old release `2b5a6585d8cf`, whose
  claimed protocol events (44) disagree with `data/protocol-events.json` (45, `-block`). This comes from
  the harness and is independent of this pass.

`probe_moldbreaker_refusals.js` needs `--release` and was not run.

## 6. NEW LEAD FOUND ON THE WAY

**Clear Smog does not clear the target's boosts.** The Round probe's first control used Clear Smog. The
authority wrote `-clearboost` and zeroed a +2 SpD, and this engine left it at +2
(`boosts.spd medicham 2 showdown 0`). `clearsBoosts` is read only by the status-move classifier
(`kind:'haze'`). The comment there says Clear Smog "is caught by the attack branch above", and the attack
branch never reads it. There are 45 sheet uses. It is not fixed here. The control was changed to a plain
attack so it measures Round alone.

## 7. FILES CHANGED

- `engine/medicham2-browser.js`:
  - three knobs;
  - `targetAlreadyMovedRefuses`, `promoteQueuedSameMove` + `ACTION_PROMOTED`, `bounceAtTryHit` /
    `bounceSideAtTryHit`;
  - wiring in the helpinghand, attack (`Try` position and move line), yawn, phaze, hazard, abilitywrite
    and healdesc branches;
  - the new MEDSEEN/MEDFAILS counters.
- `engine/tag_dex.js`: tags `failsIfTargetAlreadyMoved` and `promotesSameMoveInQueue`.
- `data/tags.json`: the two tags were **spliced, not regenerated**. This worktree has no store, so
  `tag_dex` writes zero usage. Only the three entity rows and two catalogue rows were carried onto HEAD's
  file, with uses recomputed from HEAD's per-entity uses. The splice asserted that nothing else differed
  on those rows.
- `data/abra-tags.js`: rebuilt by `build/build_tags_js.js`.
- `tests/test-mechanics.js`: three census rows, and three `DELIBERATE_BREAK` stamps.
- `data/mechanics-census.json`: regenerated, 903/903/0.
- New probes: `tests/probe_helpinghand_moved_ally.js`, `tests/probe_round_promotion.js`,
  `tests/probe_bounce_reflectable_class.js`, `tests/probe_mega_trace_die.js`.
- `docs/ENGINE.md`: a new section, the hand list, and the four probes added to the Owns list (outside
  the GENERATED block).

## PROPOSED NOTES ROW

```
| 2026-09-19 | ENGINE — Helping Hand refuses a partner that already moved (`failsIfTargetAlreadyMoved`, knob `MEDI_HELPINGHAND_MOVED_ALLY`); Round promotes and doubles the next queued Round on either side (`promotesSameMoveInQueue`, knob `MEDI_ROUND_UNPROMOTED`); Magic Bounce now reflects the five dispatch kinds that never asked — Yawn, Roar/Whirlwind, Entrainment/Worry Seed/Simple Beam, Heal Pulse and the four hazards, eleven moves (knob `MEDI_BOUNCE_KIND_BLIND`; `tests/probe_bounce_reflectable_class.js` 58 of 60 agree, 2 unstaged). Trace on Alakazam NOT reproduced on 90 staged plays (`tests/probe_mega_trace_die.js`). Census **900 → 903 live / 0 missing** (`data/mechanics-census.json`). New lead: Clear Smog does not clear boosts. Engine bytes changed — no release cut; the three lattices are owed. Report `docs/_reports/2026-09-19-ordering-targeting.md`. | **Supersedes.** Nothing. **Basis.** unchanged | ENGINE.md (done); white paper / technical docs at the next major |
```

## OWED, NOT RUN

- **A release cut on the merged tree, then the three lattices** (`--games 1200 / 1350 / 1950`, pinned census
  and `data/team-pool-frozen`). This predicts that the Round and Magic Bounce games leave g1350/g1950. Card 1's
  board part (Scolipede at turn 15) is not predicted either way until it is replayed. The roster stages and
  `quarantine.js` also need re-running on the new bytes.
- **A warmed `engine/replay_one.js`** of the Trace card (`pair-protect-bust`, `…2657391947 vs …2657358877`,
  `--games 1950`) and of the Helping Hand card (`…2636045527 vs …2634678601`, `--games 1350`). The first is
  needed to find the Trace cause; the second to confirm the turn-15 board part is a cascade of the turn-2
  Helping Hand.
- **`engine/tag_dex.js` on the main tree** (with the store) to confirm that the splice is the only change to
  `data/tags.json`.
- **`tests/test-engine-diff.js`** (the 6,000-row damage differential). This pass does not expect it to move,
  because `ACTION_PROMOTED` is null outside a promoted action, but it was not run.
- **Clear Smog's `clearsBoosts`** in the attack branch (new lead, 45 uses).
- **Electrify's `activeTurns` clause** (`failsIfTargetAlreadyMoved.exemptIfNoActiveTurns`). It is counted
  unread; there is no Electrify branch and there is 1 legal learner.
- **Pre-existing reds not caused by this pass:** `tests/probe_default_target_side.js` (counter
  expectation) and `tests/probe_perish_faint_upkeep.js` (pinned old release against the current
  protocol-events).
- The CHANGELOG entry, the RUNNING-NOTES row and `node engine/status.js --write` belong to the coordinator,
  per the brief.
