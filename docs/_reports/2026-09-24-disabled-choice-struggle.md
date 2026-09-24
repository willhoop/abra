# A caller's move click on an emptied menu is Struggle; Torment's menu half

**Date.** 2026-09-24. **Division.** ENGINE. **Line.** abra/regmc 0.91.0 (the coordinator renumbers at merge).
**Status.** A findings record. It is historical and is never cited as current state.

**Branch.** `disabled-choice-struggle`, based on `worktree-agent-a958af2dc6a0cb4b2` (`946f6f5e`, the move-menu fixes).
One commit. Nothing is merged or pushed.

## Verdict

- **Fixed, both regulations.** A caller-supplied move click on a body whose enabled menu is empty now executes Struggle,
  as `Side#chooseMove` does. One site covers every source that empties the menu. This closes the item the move-menu
  report left open (its §3, Imprison's STRUGGLE arm).
- **The same conversion applies to every source in the brief.** Only the DOOR differs (§1). Before the fix the engine
  answered each one differently and none of them correctly (§2).
- **A second defect, found by the probe: Torment had no menu half at all.** A tormented body repeated its move freely.
  Wired; it is the only half Torment has.
- **No board moved.** Pinned differential at `--games 45`: base and final byte-identical per game in both regulations.
- **Three existing census rows were asserting an impossible board** (a body's only move at 0 PP answered by
  `|cant|nopp`). The authority takes that turn as Struggle. They now assert the Struggle (§4).

## 1. The authority's rule, read whole

`sim/side.ts` and `sim/pokemon.ts` differ between the Reg M-B and Reg M-C checkouts only in lines that do not touch this
path (a `targetLoc` detail line, team-preview parsing, `RedirectTarget` for charge moves, Curse's non-Ghost target,
a status guard, a gem line). The rule is identical in both.

`Side#chooseMove`, in order:

1. **Parse against the request.** `request = pokemon.getMoveRequestData()`. A named move must be in `request.moves`, or
   the choice is refused: *"Can't move: Your X doesn't have a move matching Y"*. `getMoveRequestData` calls
   `getMoves(lockedMove, isLastActive)`; if that is empty it replaces the list with
   `[{ move: 'Struggle', id: 'struggle' }]`.
2. **A hard lock wins first.** `getLockedMove() || getSemiLockedMove()` (a charge, a rampage, a recharge) pushes the
   locked move and returns.
3. **Then `const moves = pokemon.getMoves()`, with no `restrictData`.** `else if (!moves.length)` pushes
   `moveid: 'struggle'` whatever was named, and `return true` — above the mega block, so a mega asked alongside is
   dropped.

`getMoves` marks a slot disabled when `moveSlot.disabled` is set (any `onDisableMove` source) or `moveSlot.pp <= 0`, and
turns `'hidden'` into `!restrictData`. The only hidden disable in either checkout's `data/moves.ts` is Imprison
(`disableMove(id, true)`; the probe counts it on every run).

So every source that empties `getMoves()` ends the same way: **the only move the body can make is Struggle.** The door:

| source | what a named real move gets | the only accepted move |
|---|---|---|
| a visible disable (Disable, Taunt, Torment, Encore, Heal Block, Gigaton Hammer's repeat lock, a Choice lock, 0 PP) | REFUSED at step 1 — the request reads `[Struggle]` | Struggle (`move 1`) |
| Imprison, last active body | ACCEPTED at step 1 (the request shows the moves enabled), REWRITTEN at step 3 | Struggle |
| Imprison, a body with a live ally to its right | REFUSED at step 1 (the request shows them disabled) | Struggle |

The first two rows are demonstrated on a copy of the authority's own battle (`State.deserializeBattle`) by this probe;
the third by `tests/probe_move_menu_legality.js --part imprison`.

Blood Moon is `isNonstandard: 'Past'` in both regulations, so Gigaton Hammer is the only `cantUseTwice` member.

## 2. What the engine did, per source (base engine, the probe's CLAIM arms)

The handed click was the body's real move; the column is what MEDICHAM executed.

| source | victim (derived) | MEDICHAM before | after |
|---|---|---|---|
| Imprison, last active | Absol (calmmind, protect) | `cant move: Imprison`; the streams part | Struggle; the streams agree |
| Taunt | Aegislash (swordsdance, protect) | `cant move: taunt` | Struggle |
| Disable | Aegislash (swordsdance) | `cant Disable` | Struggle |
| Torment | Aegislash (swordsdance) | **played Swords Dance again**; the menu still offered it | Struggle |
| Encore + Disable | Aegislash (swordsdance, protect) | rewritten to the encored move, then `cant Disable` | Struggle |
| Choice Scarf + Taunt | Aegislash (swordsdance, protect) | rewritten to the locked move, then `cant move: taunt` | Struggle |
| Heal Block (Psychic Noise) | Aegislash (rest) | `cant move: Heal Block` | Struggle |
| Gigaton Hammer | Tinkaton (gigatonhammer) | **the Hammer landed a second time**; no line at all | Struggle |
| 0 PP | Altaria (cottonguard, maxpp 12 read off the authority) | `cant nopp` | Struggle |

Every CONTROL arm (the same scenario at boundary 0, before any source lands) plays the handed move as itself in both
engines, before and after, so the rewrite does not over-fire.

## 3. The fix

**One site, not one clause per source.** `battleTurn`'s action collection (`mk()`), after the lock read (`_lkNow`) and
before the Choice/Encore rewrite:

- only a CALLER's action (`_a === forced`); the chooser already reached `mustStruggle` itself;
- not while charging, recharging or under a rampage lock (step 2 of the authority wins first; `mustStruggle` already
  answers false under `_mtLock`);
- the menu is asked only when the handed move is itself off it — disabled (`moveDisabledBy`) or overridden by a lock
  pointing elsewhere. A selectable handed move means the menu is not empty, so the gate is exact. It exists because the
  menu readers bump their refusal counters, and asking on every action would bump them on bodies nobody refused;
- then `mustStruggle`, and `struggleAction(..., 'choice')` builds the Struggle (the file's one builder). `_selMv` is
  re-read, because Struggle is what the authority records as SELECTED (priority 0), unlike a lock's override. The lock
  rewrite below declines on it through `_declineStruggle`.

Counters `MEDSEEN.struggleFromHandedClick` and `...First` (body:click:source). Knob `MEDI_DISABLED_CLICK_PLAYED`, stamped
`MEDFAILS.disabledClickPlayedRestored`.

**Torment's menu half.** `torment.condition.onDisableMove` (no Champions row, identical in both checkouts):
`if (pokemon.lastMove && pokemon.lastMove.id !== 'struggle') pokemon.disableMove(pokemon.lastMove.id);`. Torment has no
`onBeforeMove`, so the menu is its whole effect. `moveDisabledBy` refuses `_lastMove` while `_vol.torment` stands.
Counter `tormentRefusedAtSelection`, knob `MEDI_TORMENT_MENU_OPEN`.

**`ppPeek`.** The menu's PP read was `ppLeft`, which writes a full-PP row into `_pp` on first touch. So asking the menu
wrote a row for every slot. That broke two census rows that read `_pp` to say a slot was never touched (Sleep Talk's
called move, Focus Punch losing focus) as soon as the rewrite started asking the menu. `ppPeek` answers the same
question without the write. `ppSpentMap` reads an absent row as unspent, so no board leaf moves.

## 4. Census rows changed, and why

`move/pp` "an 8-PP move runs out: the ninth click FAILS", `move/pp` "a move built under a non-attack action kind still
spends PP" and `item/restoresPP` "Leppa Berry puts a spent move back on the menu" each hand a body its ONLY move nine
times and asserted the ninth answered `|cant|nopp`. The authority cannot produce that: with the one slot at 0 PP the
request reads `[Struggle]`, and the turn is Struggle. `|cant|nopp` is the authority's answer only for PP drained after the
choice (Spite, Eerie Spell). The rows now count the Struggle apart from the move's own clicks (`struggled`) and assert
it. Their PP accounting assertions (8 clicks, the slot at 0, Leppa's refill, Pressure's double charge) are unchanged.
With the knob set, all three go MISSING again.

## 5. Measurements

**Constructed probe** `tests/probe_disabled_choice_struggle.js` (fixtures derived from `Dex.forFormat`, legality-filtered;
the chooseMove rule is read off the checkout and the run refuses if it is not there):

| | Reg M-B | Reg M-C |
|---|---|---|
| base engine (`HEAD` of the base branch) | RED, 14 assertions (release `3b44eed9b0d1`) | RED, 14 assertions (release `d8187ca9aa4b`) |
| final engine | GREEN, 65 checks (release `8725574ebeaa`; committed tree `ecaa79e28f15`) | GREEN, 65 checks (release `628a2abca48f`; committed tree `4c0296817626`) |
| knob arms on the final engine | both knobs bring their defects back, 8 of 8 sources, both stamps | same |

The releases live in the throwaway store (`tests/_live_release.js`) and cannot be reopened elsewhere. The differentials
below ran on `8725574ebeaa` / `628a2abca48f`. One comment was added to the engine after them (the #152 list of absent
menu sources); the committed tree is `ecaa79e28f15` / `4c0296817626`, re-run green on the probe, and differs by that
comment only.

**Census** (`tests/test-mechanics.js`, verification only; the census files are NOT committed, as in the move-menu pass):

| | base branch (its report) | final | with both knobs |
|---|---|---|---|
| Reg M-B | 1,009 / 1,009 | **1,012 / 1,012** | 1,006 / 1,012 |
| Reg M-C | 1,013 / 1,013 | **1,016 / 1,016** | — |

Direct-call floor held at 1; hollow 0; threw 0.

**Pinned differential** (`--games 45 --steering empirical --arm middle --state`, `MEDI_SAMPLE_DUMP` fingerprints):

| | pins | games | per-game difference, base vs final | board-parted, base / final |
|---|---|---|---|---|
| Reg M-B | census `c3affea174af`, pool `data/team-pool-frozen` (main's copy) | 43 | **0** | 0 / 0 |
| Reg M-C | census `regmc-f3b70bc0c47c`, pool `data/team-pool-frozen-regmc` (main's copy) | 38 | **0** | 0 / 0 |

The two dumps differ only in `generated` and `engine_release`. Expected: the differential takes every click from the
authority's own request, so a visible source hands it `struggle` already, and the Imprison-hidden door is rare.

**API legality probe** (`tests/probe_medicham_api_differential.js --part all`, Reg M-C, same pins, `--games 45`, final
`628a2abca48f` against base `d8187ca9aa4b`): `legalActions` agrees with the authority on **5,552 of 5,552** slots
(1,388 turns; it saw 1 Struggle slot and 4 hidden-disabled slots). Base against final: per-game fingerprint
byte-identical over 38 games, and the same through `stepInPlace` and the clone shadow (1,442 of 1,442 shadow turns
agree). Red arms still red (clone-drop 31 of 1,336, mega-always 4,888).

**Also green on the final tree:** `probe_move_menu_legality` (both), `test-medicham-api` (Reg M-C pool, red arms red),
`probe_imprison_seal`, `probe_healblock_refuses_heal_move`, `probe_disable_pp`, `probe_called_move_last_move`,
`probe_instruct_lastmove_pp`, `probe_bounce_reflectable_class`, `probe_mental_herb_order`, `probe_volatile_leaves`,
`test-pp-fact` (each in both regulations unless noted).

**Red, and not this change:** `tests/test-tag-wire.js --regulation regmc` exits 1 with *"regulation: REFUSING — Reg
M-B's file(s) were ALREADY LOADED"* on the base engine too (a load-order defect in the test).
`tests/test-rulebook-collision.js` and `tests/probe_mental_herb_update.js` cannot run in a worktree (they need CHOMP's
data beside the checkout and the untracked frozen pool at a fixed path).

## 6. Open, and handed on

- **The menu halves of Gravity, Belch and Stuff Cheeks** — all three legal in both regulations (22/18/4 legal learners in
  Reg M-C, 20/15/3 in Reg M-B). Until each is wired, a body emptied by one of them cannot reach `mustStruggle`, so the
  rewrite cannot fire for it. Gorilla Tactics has no legal carrier in either regulation.
- **A handed click of a disabled move while other slots stay open.** The authority REFUSES that choice; there is no
  board. The engine has no way to refuse a choice, so it still answers with the source's `|cant|`. Any caller that
  builds clicks from `medicham_api.legalActions` never sends one. This is a caller contract, not a mechanic.
- **A mega asked alongside a click that becomes Struggle is dropped**, as the authority drops it. Not separately probed:
  no fixture here can mega and be emptied in the same turn.

## 7. Not done here, and why

- `node engine/status.js --write` was NOT run: from a worktree it writes missing untracked files as fact. Owed to the
  coordinator, in main, after merge.
- No REGULATION-ROTATION row. Nothing here is regulation-specific: the rule is identical in both checkouts, and the probe
  reads it off whichever checkout is selected, so a future change is caught there. The version header moved.
- Heavy runs could not use `tools\lownode.cmd`: the isolated worktree refuses `cmd.exe`. The differentials were spawned
  from a node wrapper that set BELOW_NORMAL priority on the child by pid, which is the same policy.
- `data/engine-release-regmc.json` in this worktree is an untracked pointer written by one of the verification probes.
  It is left in place.

## 8. Commands

```
node tests/probe_disabled_choice_struggle.js --regulation regmb   [--part imprison|sources]
node tests/probe_disabled_choice_struggle.js --regulation regmc
node -r ./tests/_live_release.js engine/game_differential.js --regulation <reg> --release <id> --games 45 \
  --steering empirical --arm middle --state --census <pin> --team-store <main>/data/team-pool-frozen[-regmc]
```
