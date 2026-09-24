# MEDICHAM's move menu is the authority's legal set: Fake Out after a Parting Shot, Imprison, Heal Block

**Date.** 2026-09-24. **Division.** ENGINE. **Line.** abra/regmc 0.88.0, 0.89.0, 0.90.0 (the coordinator renumbers
these at merge). **Status.** A findings record. It is historical and is never cited as current state.

**Branch.** `worktree-agent-a958af2dc6a0cb4b2`. It is based on `main` (`cf59f23a`) and carries a cherry-pick of the
solver-API commit `76691522` (as `8ae6561a`). It adds one commit per mechanic. Nothing is merged or pushed.

## Verdict

- **All three menu defects are fixed, in both regulations.** Each has a constructed probe that went red and then green,
  a knob that brings the defect back, and a census row.
- **The API legality probe is green.** `tests/probe_medicham_api_differential.js --part legal` found 26 disagreeing
  slots of 5,552. The count went 26, then 6 after Fake Out, then 2 after Imprison, then 0 after Heal Block. Its red
  arms still fail as they must.
- **No board moved in any run we did.** The compared sets are below. By construction the whole-game differential
  takes every click from the authority's own request, so it never consults MEDICHAM's menu. The Fake Out fix changes a
  counter that the execution-time Fake Out refusal also reads, so it *could* move a board. It moved none in these
  samples.
- **One related defect is left open, on the execution path rather than the menu (§3).** A caller can hand MEDICHAM a
  click on a body whose whole menu is sealed. The authority's `Side#chooseMove` rewrites such a click to Struggle.
  MEDICHAM plays the click and writes `cant`.
- **One claim in the brief is refuted (§2).** Imprison's hidden disable is NOT "selectable for the last active and
  refused at execution". The authority refuses the CHOICE from either slot; only the REQUEST differs.

## 1. Fake Out after a Parting Shot that stays in (0.88.0)

**Diagnosis.** The engine counts `_mvActs` (the authority's `activeMoveActions`) in the action loop. The test there
was `it.a.kind !== 'switch' && it.a.kind !== 'pass'`. `playerAction` builds Parting Shot, Chilly Reception and (Reg
M-C only) Revival Blessing as `{kind:'switch', mv}`. Those are MOVES. `sdChoiceOf` in the same file says so: *"a PIVOT
(`a.mv` present) is a MOVE that happens to switch its user out afterwards"*. So a Parting Shot that did not switch its
user out left the count at 0.

That happens when Parting Shot is blocked by a Protect, or when it lands no stat drop:
`if (!success && !target.hasAbility('mirrorarmor')) delete move.selfSwitch` in `data/moves.ts` partingshot.onHit.
The Champions `fakeout.onDisableMove` disables Fake Out on `pokemon.activeMoveActions` (`data/mods/champions/moves.ts`
fakeout). Reproduced before any fix with the API: an Incineroar's first action is Parting Shot into Protect, and
afterwards `_mvActs` is 0 and the menu still holds Fake Out. When Fake Out came first, the count was right.

**Fix.** An action counts when it carries a move (`actionMoveId(it.a)`), whatever its `kind`. A bare
`{kind:'pass'}` with no `mv` is a caller's "this body does nothing" (every `PASS2` in `tests/test-mechanics.js`), and
it still does not count. The membership is printed on every probe run:

| shape | Reg M-B | Reg M-C |
|---|---|---|
| `{kind:'switch', mv}` | chillyreception, partingshot | chillyreception, partingshot, revivalblessing |
| `{kind:'pass', mv}` | none | none |

The 2026-08 comment near the freeze gate listed `pass`-shaped moves (fairylock, healbell, roleplay, spite, teatime).
With a foe body and an empty field, `playerAction` builds none of them as `pass` today. Knob:
`MEDI_PIVOT_MOVE_NOT_COUNTED=1`, stamped `MEDFAILS.pivotMoveNotCountedRestored`.

## 2. Imprison's menu half (0.89.0)

**The authority, read in full.** `data/moves.ts` imprison.condition has no Champions row:

```
onFoeDisableMove(pokemon) {
  for (const moveSlot of this.effectState.source.moveSlots) {
    if (moveSlot.id === 'struggle') continue;
    pokemon.disableMove(moveSlot.id, true);
  }
  pokemon.maybeDisabled = true;
},
```

`onFoe*` handlers are gathered from `target.foes()` (sim/battle.ts:1060), which returns the living active bodies of
the other side (sim/side.ts:397). `disableMove(id, true)` writes `disabled = 'hidden'` (sim/pokemon.ts:1625-1637).

**The exact rule for a hidden disable. This refutes the coordinator's reading.**

- The request is built by `getMoves(lockedMove, isLastActive)` (sim/pokemon.ts:1093-1095). There, `'hidden'` becomes
  `!restrictData`. So a body with a live ally on its right is SHOWN the move disabled. The last active body is shown it
  enabled, plus `maybeDisabled`.
- **But `Side#chooseMove` validates with `pokemon.getMoves()`, with NO `restrictData` (sim/side.ts:627, 730-745).** So
  `'hidden'` becomes `true` there, and the choice is REJECTED from either slot.
- The probe demonstrates this on a copy of the authority's own battle (`State.deserializeBattle(serializeBattle)`). The
  last active Aegislash is shown `irondefense,protect` with `maybeDisabled`. `chooseMove('protect')` returns false with
  *"Can't move: Aegislash's Protect is disabled"*.
- So the LEGAL set loses the move in both slots, and MEDICHAM's menu now does the same. A body whose every slot is
  sealed has an empty `getMoves()`, which means Struggle (sim/pokemon.ts:1041; side.ts:699). `mustStruggle` answers
  the same way.

**Fix.** `moveDisabledBy` asks `imprisonSealedBy` of the body's living foes. That is the reader the execution refusal
already uses. It reaches the foes through `me._sf._S`, the back-reference `battleInit` writes and `abilityStarted`
already reads. So none of the five callers the old declared-gap comment named had to change. Knob:
`MEDI_IMPRISON_MENU_OPEN=1`.

## 3. OWED: a caller-supplied click on a fully sealed body (not fixed)

The imprison probe's STRUGGLE arm puts a victim whose two moves are both the imprisoner's in the last-active slot.
The authority's menu and MEDICHAM's menu agree: only Struggle. The game still parts. The harness hands MEDICHAM the
scripted click (`protect`). The authority's `Side#chooseMove` silently rewrites that click to Struggle at choice time
(side.ts:699-709: `else if (!moves.length) { ... moveid: 'struggle' }`). MEDICHAM plays the click and refuses it at
execution:

```
sd  |move|p2a: Alakazam|Calm Mind|p2a: Alakazam   (then Absol Struggles)
me  |cant|p1b: Absol|move: Imprison|protect
```

This is board-material wherever it happens: Struggle deals damage and costs recoil. It can reach the whole-game
differential, because an empirical driver picking from a last-active request can pick the shown-but-refused move.
It needs a choice-time rewrite in the engine: if `mustStruggle(body)` holds when the action is taken in, replace the
click with Struggle. That runs into the deliberate "a caller-supplied click is trusted" rule behind the `|cant|nopp`
path. So it is a separate decision and is not taken here. It is rare: every slot must be one the imprisoner carries.

## 4. Heal Block's menu half (0.90.0)

`data/moves.ts` healblock.condition has no Champions row (and none for psychicnoise). It has
`onDisableMove(pokemon) { for (const moveSlot of pokemon.moveSlots) { if (this.dex.moves.get(moveSlot.id).flags['heal'])
pokemon.disableMove(moveSlot.id); } }`. That is a VISIBLE disable, so the request and the legal set agree.
`moveDisabledBy` now asks `healBlockRefusesClick`, the one reader the execution refusal uses. The comment on that
function named the menu half as its intended second caller. The probe checks every boundary, so the end of Psychic
Noise's two-turn block (`durationCallback` returns 2) is also compared: the move comes back on the same turn in both
engines. Knob: `MEDI_HEALBLOCK_MENU_OPEN=1`.

## 5. Measurements

**The constructed probe** is `tests/probe_move_menu_legality.js`. It derives its fixtures from `Dex.forFormat` of the
selected regulation, filtered for legality. At every boundary it compares `getMoves()`-legal with `selectableMoves`
for every active body.

| part | red, unfixed engine | green, after the fix | knob arm |
|---|---|---|---|
| fakeout | RED in Reg M-B and Reg M-C (Grimmsnarl: authority `partingshot,protect`, medicham `fakeout,partingshot,protect`) | GREEN in both | defect back, stamped |
| imprison | RED in both (both foes kept Protect; the all-sealed body was not Struggling) | GREEN in both | defect back, stamped |
| healblock | RED in both (Aromatisse kept Draining Kiss) | GREEN in both | defect back, stamped |

**The API legality probe.** Pins: Reg M-C, pool `data/team-pool-frozen-regmc` (main's copy, which is untracked),
census pin `data/verification/census-pin-regmc-f3b70bc0c47c.json`, `--games 45`, `--steering empirical --arm middle`,
state mode, 38 games, 1,388 turns, 5,552 slots.

| release | tree | disagreeing slots | base arm (vs `9cfd07674cc9`) |
|---|---|---|---|
| `9cfd07674cc9` | base (API cherry-pick) | 26 (20 Fake Out, 4 Imprison, 2 Heal Block) | n/a |
| `536641af26ee` | + Fake Out | 6 | byte-identical, 38 games |
| `d0b771be7727` | + Imprison | 2 | byte-identical, 38 games |
| `f9c11b7b9b3c` | + Heal Block | **0**, and red arms: clone-drop 31/1,336, mega-always 4,888 | byte-identical, 38 games |

Every run's `stepInPlace` arm and clone-shadow arm also stayed byte-identical (1,442 shadow turns).

**Larger differential, Reg M-C.** Same pins, `--games 1200`, `--steering empirical --arm middle --end-state`, base
`9cfd07674cc9` against final `f9c11b7b9b3c`. **955 games, 0 differ per game** (`MEDI_SAMPLE_DUMP` fingerprints). The
two dumps differ only in `generated` and `engine_release`. Board-material is 0 of 954 on both (the bar: `state.games`
less `state.games_board_never_diverged`). The artifacts are under the gitignored `data/_scratch-a958/`.

**Reg M-B.** Census pin `data/verification/census-pin-c3affea174af.json`, pool `data/team-pool-frozen` (main's
copy), `--games 45`, 43 games. The final engine against the same engine with all three knobs set (the pre-fix
behaviour): the per-game fingerprint is identical and board-material is 0 of 43. A true Reg M-B base release would
need the tracked `data/engine-release.json` pointer rewritten in this worktree. So the knobs, each of which restores
the old code path exactly, stand in for it.

**Census** (`tests/test-mechanics.js`, both regulations, verification only). The committed census files were stale
before this work: Reg M-B at 1,004 live against 1,006 rows already in the suite, and Reg M-C at 1,006 against 1,010.
With the three new rows, Reg M-B runs 1,009 of 1,009 live and Reg M-C 1,013 of 1,013. Nothing is missing, hollow or
threw. The direct-call floor holds at 1 (the three helpers are declared in `REALTURN` with their reason). **The census
files are not committed.** They are re-measured in main by the lab pass. The Reg M-B census also backs published 7.0.0
figures (`docs/SUMMARY.md`, the deck, the technical docs), and `tests/test-docs-current.js` refuses a commit that moves
it.

**Also green on the final tree:**
- `tests/test-medicham-api.js` (Reg M-C pool), with its three red arms.
- `tests/probe_imprison_seal.js` and `tests/probe_healblock_refuses_heal_move.js` (the execution halves) in both
  regulations.

## 6. Not done here, and why

- `node engine/status.js --write` was NOT run: from a worktree it writes missing untracked files as fact. This is owed
  to the coordinator, in main, after merge.
- No REGULATION-ROTATION row. Nothing here is a rotation trap. The one regulation-dependent fact is Revival Blessing
  joining the pivot shape, and the fix picks that up by shape with no edit.
- The releases `536641af26ee`, `d0b771be7727` and `f9c11b7b9b3c` sit under this worktree's untracked `data/releases/`.
  A measurement in main must re-cut.

## 7. Commands

```
SHOWDOWN_PATH=<pokemon-showdown-mc> node tests/probe_move_menu_legality.js --regulation regmc [--part fakeout|imprison|healblock]
SHOWDOWN_PATH=<pokemon-showdown>    node tests/probe_move_menu_legality.js --regulation regmb
SHOWDOWN_PATH=<pokemon-showdown-mc> cmd.exe /c tools\lownode.cmd tests\probe_medicham_api_differential.js --regulation regmc \
  --release <id> --baseline-release 9cfd07674cc9 --part all --games 45 \
  --census data/verification/census-pin-regmc-f3b70bc0c47c.json --team-store <main>/data/team-pool-frozen-regmc
```
