# Mechanics by reach — 2026-08-24 (ENGINE, overnight)

Six diverging mechanics closed, ranked by the corpus usage they cover. Every one was written as a
failing census probe first, with a control that was already green, and every one is confirmed gone
from `data/all-mechanics-fire.json` by a re-run.

**Uncleared diverging mechanics: 31 → 25.** Measured with the same script both times —
`engine/all_mechanics_fire.js --kind all`, closet ids excluded. Before is the artifact published at
HEAD (release `a7839b20e7d5`, generated 2026-08-24T03:11Z); after is release `264f6d13d1e4`, arm
`bottom-tie-first`, written this pass. The six removed are exactly the six below, and **nothing was
added**.

**Census: 668 → 674 probed, 674 live, 0 missing, 0 threw.** Six new probes, all armed, all spending a
real turn.

---

## Which scoreboard each one should have moved, said before the run

Per CLAUDE.md's ranking rule. All six are **LAB** mechanics: the pinned pool
(`data/team-pool-frozen`, 961 real ladder pairs, 12 turns of bot-chosen clicks) contains **no click
of Clangorous Soul, no Belly Drum, no Anger Point crit, no absorbed Grass move and no bounced
reflectable status move**. So the lab was expected to move and the pool to sit still.

It did exactly that. Whole-game, arm `middle`, release `264f6d13d1e4`, `--games 1200`,
`--team-store data/team-pool-frozen`, census pinned to `census-pin-9446a684709d.json`, 961 pairs:

| | before (release `8b083baf2890`) | after (release `264f6d13d1e4`) |
|---|---|---|
| raw parted | 46 | **46** |
| BOARD-MATERIAL | 23 causes / 24 games | **23 causes / 24 games** |
| NARRATION-ONLY | 20 causes / 22 games | **20 causes / 22 games** |

Byte-identical. **Board-material did not rise.** A re-baseline, not a delta.

---

## 1. Clangorous Soul pays AFTER it boosts — 513 corpus uses, the largest single diverging row

`[ordering] showdown |-boost|p1a: Kommo-o|atk|1  <>  medicham |-damage|p1a: Kommo-o|603/900`.

**The authority splits the move across two handlers and the split IS the order** (dist/data/moves.js
`clangoroussoul`): `onTryHit` runs `this.boost(move.boosts)` and `onHit` runs
`this.directDamage(maxhp * 33/100)`. `onTryHit` is above `onHit`, so the five stages are on the board
before the HP comes off. This engine paid in the generic `costsUserHP` block, which sits ABOVE the
kind dispatch, so the `|-damage|` came first on every click.

**Not a blanket reorder, and the control is the authority's own other answer.** Belly Drum does both
halves inside ONE `onHit` — `directDamage` then `boost({atk:12})` — so its HP still comes off first.
The engine defers the payment only when the move carries a DECLARED boost table (`boostsUser`, read
off `m.self.boosts`), which is the table the authority hands to `onTryHit`; Belly Drum carries
`statChangeInCode` instead, because its boost is procedural. One member in this format, stated rather
than dressed up. The deferral is taken only when the dispatch is going to reach the `setup` branch —
the one place it is picked up again — and any other landing site pays at the old position and
increments `MEDFAILS.hpCostBoostFirstUnrouted` (0 today).

Probe: `move/costsUserHP`, *"the stages Clangorous Soul buys land BEFORE the HP it pays — and Belly
Drum pays first"*. Red: `["damage","boost"]` on both arms. Green: `["boost","damage"]` /
`["damage","boost"]`.

## 2. `-setboost` — Belly Drum 124 uses and Anger Point 20, one rule

Two artifact rows, one fact, and it lives in the authority's own boost emitter:

```
switch (effect?.id) {
  case "bellydrum":
  case "angerpoint":
    this.add("-setboost", target, "atk", target.boosts["atk"], "[from] " + effect.fullname);
                                                          dist/sim/battle.js:1674-1679
```

Three things differ from a `|-boost|` and this engine had all three wrong: the event name, field 4
(the stage the body NOW SITS ON, not the step it took) and a `[from]` naming the effect. Confirmed in
a real authority log: `|-setboost|p1a: Azumarill|atk|6|[from] move: Belly Drum`.

**The predicate is derived and was PRINTED before it was wired.** The engine asks whether the
requested boost is BEYOND THE CAP — `{atk: 12}`, the game's own spelling of "set to max". Swept over
every `boosts` table under every tag of every move, ability and item in `data/abra-tags.js`, exactly
two rows carry a magnitude above 6: `moves.bellydrum.statChangeInCode` and
`abilities.angerpoint.buffsHolderOnHit`. That is the authority's list, derived rather than typed.

One function (`announcesSetBoost`), two call sites, so they cannot come to disagree.

`-setboost` joined `TRACE_EVENTS`, and the stale reason in `engine/derive_protocol_events.js` was
**deleted rather than reworded** — it read *"…is emitted as `-boost`, which is what Showdown's gen-9
bellydrum does too"*, and the last clause was FALSE and had been all along. A declared not-emitted
reason that asserts something about the authority is as dangerous as a stale handoff.
`tests/test-protocol-trace.js` PART 1 requires every claimed event to FIRE, and no scenario in that
file reached one (scenario 1's Azumarill carries Belly Drum and sits on the BENCH for all seven
turns), so the event got a small board of its own. Belly Drum and not Anger Point, deliberately:
Anger Point needs a crit, and a scenario whose event depends on a roll is one seed from being a
coverage gap wearing a pass's clothes.

Probes: `move/statChangeInCode` (control **Tidy Up**, the other on-user `statChangeInCode` boost) and
`ability/buffsHolderOnHit` (control **Stamina**, the other `buffsHolderOnHit` boost, taking the
identical two Storm Throws). The Anger Point arm is two turns because the cap is where the two
answers separate hardest — at +6 the authority's `boostBy` is 0 and it writes nothing, so one line
against Stamina's two.

## 3. An absorber says `-immune` only when the gift had nowhere to land — Sap Sipper 76 uses

`[extra event emitted by medicham2] showdown |-boost|p1a: Azumarill|atk|1  <>  medicham
|-immune|p1a: Azumarill|[from] ability: sapsipper`. This engine announced BOTH, on every absorb.

**The authority is the same shape eight times**, read member by member out of `data/abilities.ts`
(no Champions override on any of them):

```
sapsipper     if (!this.boost({atk: 1}))          this.add('-immune', target, '[from] ability: Sap Sipper');
lightningrod  if (!this.boost({spa: 1}))          ... Lightning Rod
motordrive    if (!this.boost({spe: 1}))          ... Motor Drive
voltabsorb    if (!this.heal(baseMaxhp / 4))      ... Volt Absorb
waterabsorb   if (!this.heal(baseMaxhp / 4))      ... Water Absorb
dryskin       if (!this.heal(baseMaxhp / 4))      ... Dry Skin
eartheater    if (!this.heal(baseMaxhp / 4))      ... Earth Eater
flashfire     if (!target.addVolatile('flashfire')) ... Flash Fire
```

`boost` returns false when no stage moved, `heal` false at full HP, `addVolatile` false when it is
already up. The `-immune` is the gift's ELSE, never its companion — it means *absorbed, and there was
nothing in it for me*.

Nothing is named in the engine: the gift comes off the tag's own `gain`, so one rule covers all eight
and a ninth arrives working. Two counters, both non-zero, so the branch is provably a branch:
`MEDSEEN.absorbGiftLanded` / `MEDSEEN.absorbImmuneAnnounced`.

**STATED, NOT FIXED:** Flash Fire's gift is a VOLATILE this engine does not grant (the WIRE 11 header
has said so since it was written), so with nothing for the else to test it keeps announcing `-immune`
on every Fire hit where the authority announces it only on the second.
`MEDFAILS.absorbGiftUnmodelled` counts it. Unchanged behaviour, now loud.

Probe: `ability/typeImmunity`. **The control is the authority's own other branch**: the same ability,
the same click, with only the gift's headroom varied — a capped Sap Sipper and a full-HP Volt Absorb
must STILL write the bare `-immune`, so a fix that simply deleted the line fails there. Two members,
one of each gift shape.

The whole family re-measured clean afterwards: `sapsipper, voltabsorb, waterabsorb, dryskin,
eartheater, lightningrod, motordrive, flashfire, levitate` — **0 diverged**.

## 4. A bounced move is USED by the bouncer, and says so — Magic Bounce 286 uses

`[event missing from medicham2] showdown |move|p1a: Espeon|Block|p2a: Feraligatr|[from] ability:
Magic Bounce  <>  medicham |-activate|p2a: Feraligatr|trapped`.

**The state was already right and the account of it was missing.** `bounceOff` retargets, and
ROADMAP #241 had already fixed WHO ends up trapped. What this engine never said is that a second move
happened: `magicbounce.onTryHit` builds a fresh active move and calls
`this.actions.useMove(newMove, target, {target: source})`, and a use writes a `|move|` line like any
other.

`announce` is an EXPLICIT parameter defaulting to SILENT. `bounceOff` is asked six times and one
caller is not a resolution at all — `statusMoveTargets` is consulted by the Protean pre-check above
the kind dispatch purely to ask *does this click reach anybody*. A bounce announced there would put a
second `|move|` line into the stream of every Protean body that throws a reflectable status move at a
bouncer. So the four dispatch sites and the two real `statusMoveTargets` callers opt in; the
pre-check does not.

Probe: `ability/reflectsStatusMoves`. **The control is Espeon's other legal ability** —
`Dex.forFormat(...).species.get('espeon').abilities` is `{0: Synchronize, H: Magic Bounce}` — so the
same body, same click, same board with one ability swapped, and it must emit ONE move line and trap
the Espeon.

**A SEPARATE DEFECT SURFACED CLEANLY AND IS NOT FIXED HERE** (it was already recorded in the
published artifact, `verdict: STATE`, so it is not a regression): the same scenario parts on the
BOARD at turn 4 — `p2a feraligatr vol.trapped  showdown 0  we 1`. The trap outlives the authority's
by at least a turn. It has no register row that I can find. **Proposed row: *"a move trap survives on
our board after the authority has released it — Magic Bounce scenario, `vol.trapped` showdown 0 / us
1 at turn 4, with both protocol streams in agreement."***

## 5. A charge re-banked is a charge re-announced — Electromorphosis 127 uses

`[event missing from medicham2] showdown |-start|p1a: Bellibolt|Charge|Hydro Pump|[from] ability:
Electromorphosis  <>  medicham |upkeep`. The FIRST bank was already right; the SECOND was silent.

The authority's `charge` condition carries `onStart` AND `onRestart`, and the two are the same six
lines (`data/moves.ts`). **The engine's own comment at the bank site already said "`onRestart`
re-announces and does NOT stack" and the line under it read `if (TR && !_had)`** — the comment was
right and the code disagreed with it. `_had` is now counted (`MEDSEEN.chargeReBanked`) instead of
being used to suppress.

Probe: `ability/buffsHolderOnHit`. The two hits use DIFFERENT moves on purpose: field 4 is
`this.activeMove.name`, so a genuine re-announcement names the SECOND move, and an engine that merely
duplicated the first line would print `heavyslam` twice.

---

## The numbers, and what pinned them

- **Damage differential 0 of 6000** at `--n 6000 --seed 20260804`, **all 16 corners** (midpoint, top,
  bottom, idx01–idx14). Run twice — once mid-pass and once on the final tree.
- **Census 668 → 674 probed / 674 live / 0 missing / 0 threw.** 0 hollow, 0 unarmed, 1 direct-call
  (unchanged — `move/alwaysCrit`, which predates this pass).
- **Mechanics artifact:** `--kind all --release 264f6d13d1e4 --write`, arm `bottom-tie-first`, all
  three populations present. 20 moves + 4 abilities + 1 item uncleared, down from 22 + 8 + 1.
- **Whole game:** table above. Arm `middle`, release `264f6d13d1e4`, 961 pairs, pool
  `data/team-pool-frozen`, census pin `census-pin-9446a684709d.json`.
- **Deliberate roster, all three stages RE-RUN** at release `264f6d13d1e4`, because the engine moved
  and the previous artifacts were then measuring other bytes (`status.js` withheld them, correctly):
  items `0 DIFFER / 0 DID-NOT-FIRE`, 139 of 148 tested; abilities `0 / 0`, 130 of 202; moves `0 / 0`,
  475 of 500.
- **Gate:** 5 of 8 clauses PASS, the same three fail as before — whole-game (33 of 961), mechanics
  (16 of 23 above the reach anchor), and the four open register rows naming a red instrument.

Green after the pass: `test-protocol-trace`, `test-resolution-order` (26 arms, 1 declared KNOWN-OPEN,
0 failing), `test-volatile-duration`, `test-immunity-gate`, `test-bracket-regain`,
`test-encore-fail-silent`, `test-tag-params-derived`, `test-game-diff`, `test-engine-consistency`,
`test-wiring`, `test-charge`, `test-end-state`, `test-mc-seal`, `test-medicham-coverage`,
`test-roster-arm-pin`, `test-damage-roll-support`, `test-middle-identity`.

## OBSERVED, NOT CAUSED

Both were checked against HEAD's engine bytes and fail identically there.

- **`tests/test-mutation-coverage.js` — 1 of 6 clauses RED**: *"the planted-stub gate catches both
  stubs (0/2 caught)"*. Pre-existing; `tests/run-all.js` already carries `mutation_harness.js` as
  declared RED and not MEASURE's.
- **`tests/staged_board.js` — 3 of 25 scenarios part**: `imposter-copies-the-body-opposite`,
  `hungerswitch-flips-every-turn`, `roar-drags-whoever-is-standing-there`. Byte-identical field lists
  on HEAD's engine.

## OWED, NOT RUN

- `tests/interaction_matrix.js`, last run 2026-08-11 — the engine has moved many times since.
- `tests/mutation_harness.js` — the coverage artifact measured release `6fb9ebd3b704` and the tree is
  `264f6d13d1e4`; the harness also writes, so it needs `--gate-only --no-write` wiring first.
- The **19 remaining uncleared diverging mechanics with a usage figure**, ranked: `scaleshot` (258)
  and `berserk` (47) share ONE mechanism — the self-effect must land after the whole volley's
  `-hitcount` — and that is the multi-hit LOOP granularity `tests/test-resolution-order.js` already
  stages as a declared KNOWN-OPEN arm. It is a restructure, not an ordering fix, and was deliberately
  not started overnight.
- The `-damage field 3` trio (`hustle` 29, `sandforce` 25, `shellsidearm` 17) — a damage-magnitude
  question inside a game, which the 0/6000 hit differential structurally cannot see.
- The **four judgement cards** in `docs/_reports/2026-08-24-ordering-cards.md`, which are Will's, and
  the mega-phase and residual sorts they cover. Untouched.
