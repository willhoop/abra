# Repairing the probe that produced a false defect and got it published

Date: 2026-09-04. Division: MEASURE. File owned and changed: `tests/probe_leaf_widening.js` (only).
Nothing committed. `engine/medicham2-browser.js` was READ and never written.

## What was measured, and on what

| pin | value |
|---|---|
| engine release | `0815fb96237f`, cut 2026-09-04T09:40:01.171Z |
| medicham2 digest inside that release | `374bd2621990` |
| showdown commit | `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` |

The release id and the medicham2 digest were read before the baseline run and again after the final
run and were **identical**. The driver plays the snapshot, not the working tree, so the ENGINE agent's
live edits to `engine/medicham2-browser.js` did not move under either run. The census digest DID move
(`a7420a15ca55` -> `75650a32c2b7`) between the two runs; it steers nothing in this probe, whose four
fixtures are directed, but it is recorded because a census that moves under a measurement is exactly
the thing this repository has been burned by.

## The claim that was published, and why the probe produced it

The retired row reported that Unburden's speed doubling applies to every body that loses an item.
That went into `CHANGELOG.md` 5.245.0, a commit message, seven living documents, and a report to the
owner. It is false.

The engine gates the multiplier on the ability tag:

```js
if(m._hadItem&&!m.item&&(ROOM_ITEM_IS_LOST||m._roomItem==null)){
  if(m._roomItem!=null)MEDFAILS.roomItemIsLostRestored=1;
  const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)_mods.push(+_ub.speedMult);}
```

`data/tags.json`'s `speedOnItemLoss` row carries `n: 1`, `examples: ["Unburden"]`, `consumedBy:
"unburden"`. The `if (...)` on the first line is an ENTRY GUARD. The gate is the line inside it.

The probe's `stand` predicate recomputed the ENTRY GUARD — `m._hadItem && !m.item` — and compared it
against the authority's `unburden` volatile. It never called `effSpeed`. Its `[1,1]` therefore only
ever said *both of these bodies have lost an item*, which is true of any body that lost one. The
`ours:` label named the entry guard as though it were the doubling, which is how a reading of the
guard passed for a reading of the mechanic every time somebody looked at it.

**A probe must assert on what the engine computed, never on a value it recomputes alongside.**

## What the row does now

It asks each engine for its own number, twice per body, and subtracts.

- medicham2: `MEDI.effSpeed(m, S.field, 'A')` against `effSpeed` on a delegating clone
  (`Object.create(m)`) with the item-loss input cleared. `effSpeed` is in medicham2's
  `module.exports` and is taken out of the SAME frozen release the game is played on, via
  `G.REL.require('engine/medicham2-browser.js', { need: ['effSpeed'] })` — so an aged-out snapshot
  refuses by name at load instead of throwing inside a boundary callback.
- Showdown: `p.getStat('spe', false, false)` against `p.getStat('spe', false, true)` — modified
  against unmodified, which is where Unburden's condition `onModifySpe` lives
  (`pokemon-showdown/data/abilities.ts:5238-5244`).

Neither reading restates a condition. The clone mutates nothing the rest of the game is played from.

## The two arms, both required, both present in one fixture

Slot 0 carries the ability; slot 1 does not; both lose an item to a Knock Off in the same turn.

```
the RETIRED predicate — `_hadItem && !m.item`, the ENTRY GUARD — reads [1,1] on these same two
  bodies: it calls the PLAIN body a match too. That is the reading that was published.
sceptile   effSpeed 344<-172 x2   getStat spe 344<-172 x2   ability="unburden"   AGREE
venusaur   effSpeed 122<-122 x1   getStat spe 122<-122 x1   ability="overgrow"   AGREE
```

- **WITHOUT Unburden, item lost** (Venusaur, Overgrow): old predicate `1` = a match; the repaired
  reading is `x1` on both sides. It does not register. This is the arm the false claim rested on.
- **WITH Unburden, item lost** (Sceptile): `x2` on both sides. It still registers.

Both engines also produce the same absolute numbers (344/172 and 122/122), which is a free
cross-check the old row could not have produced.

The retired predicate's reading is printed every run, alongside the engine's, so the repair keeps
proving itself rather than resting on this document.

## The row cannot go green by not looking — shown red twice

Both breaks were applied, run, and reverted. `node --check` and a `grep` for the break strings
confirm neither survives in the file.

1. **The published claim, injected.** Forcing the medicham2 reading to `doubled: 1` for every body —
   literally "every item-loser doubles" — produced `venusaur ... DISAGREE`,
   `MEASURED — the two engines DISAGREE on 1 of 2 bodies`, and `FAIL — 1 arm(s) did not hold.`
   The repaired probe would have caught the claim it published.
2. **The reading refused.** Forcing `effSpeed` to throw produced `medi="[?,?]"`,
   `COULD-NOT-MEASURE on 2 of 2 bodies — this row makes NO claim`,
   `speed reads that threw (effSpeed / getStat): 9  first: effSpeed: DELIBERATE BREAK`, and FAIL.
   A reading that could not be taken is a refusal to answer, not an answer.

The row also refuses if the fixture stops staging its own arms: if either Knock Off fails to empty a
hand, it prints `COULD-NOT-MEASURE ... A claim about the FIXTURE, never about the mechanic` and
fails, because an `x1` that means "still holding" is not the same fact as an `x1` that means "not a
carrier".

`observeOnly` now means only that no comparator PLANT is possible on a leaf the comparator does not
carry. The mechanic itself is measured, and a disagreement fails the run.

## The three wired leaves are untouched — before and after

| leaf | before | after |
|---|---|---|
| `volatile:throatchop` | CONTROL PASS / RED PASS | CONTROL PASS / RED PASS |
| `volatile:mustrecharge` | CONTROL PASS / RED PASS | CONTROL PASS / RED PASS |
| `volatile:flashfire` | CONTROL PASS / RED PASS | CONTROL PASS / RED PASS |

Both runs end `PASS — every arm held.`, `learnset lookups that threw: 0`. The after run adds
`speed reads that threw (effSpeed / getStat): 0` — printed unconditionally, so the zero is evidence
rather than an absence.

The Unburden row's display line changed from `medi="[1,1]" sd="[1,0]"` to
`medi="[x2,x1]" sd="[x2,x1]"`.

`node tests/test-no-silent-failure.js --only tests/probe_leaf_widening.js` reports
`no new silent catch blocks in 1 file(s).` It reported 2 on the first attempt; the fix went into the
code (the caught reason now travels visibly out of the catch body as `e.message`) rather than into
the detector.

## What this does NOT establish

- **Agreement in one staged fixture is not a licence to stop comparing.** `volatile:unburden` is
  still absent from `BS.SD_VOLATILE_KEYS`, so a real divergence on this leaf anywhere else reaches
  the board and nothing looks. The row prints `STILL NOT COMPARED` every run. Widening the
  comparator is a `board_state.js` change and was deliberately not made here — that file is not
  MEASURE's to move mid-session, and widening it would move the whole-game differential under the
  ENGINE agent.
- **The engine and the authority are not the same shape.** medicham2 recomputes; Showdown holds a
  volatile granted at the moment of loss. They coincide in this fixture. That is the narrower defect
  below.

# OWED

**ROADMAP #535 — engine half now MEASURED, authority half still INSTRUMENT OWED. The marker was not
touched.**

The repaired probe decides the ENGINE half and prints it every run. Taking Venusaur — which has
already lost its item and never carried the ability — and re-asking `effSpeed` with slot 0's own live
ability spelling on a clone gives `244<-122 x2`. The doubling follows the body's CURRENT ability, not
a grant made when the item went.

The AUTHORITY half is not measured and no citation was invented for it. Deciding it needs a body that
GAINS the ability after its hand is empty — Skill Swap — which this fixture does not stage, and
mutating a live Showdown battle mid-game (`setAbility`) would corrupt the control arm this probe
depends on. `#535`'s `INSTRUMENT OWED` marker is therefore left exactly as it stands;
`engine/register_reality.js` execFileSyncs every marker it finds, and there is nothing yet for it to
run.

**Also owed, and outside MEASURE's hands this session:**

- `volatile:unburden` is not in the board comparator. Until it is, the leaf is invisible to the
  whole-game differential regardless of what this probe reports.
- The false claim is still standing in `CHANGELOG.md` 5.245.0, in the commit message, and in the
  seven living documents it was propagated to. This pass repaired the INSTRUMENT. It did not retract
  the publication — `docs/` was settled by another agent while this ran and was not edited beyond
  this report.
- `data/_diag77-cards.json`, `data/_diag77-sample.json` and six untracked `tests/probe_*.js` files
  are in the tree and are not mine. Reported, left alone.
