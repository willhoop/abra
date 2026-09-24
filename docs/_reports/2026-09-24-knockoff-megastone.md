# Knock Off removing a mega stone — the stone's `onTakeItem` under Magic Room, and every other item mover

2026-09-24, ENGINE. Branch: this worktree's branch. Version `abra/regmc 0.87.0` (the coordinator renumbers at merge).

## 1. Verdict

The Reg M-B pool game `gen9championsvgc2026regmbbo3-2659015200 vs …2659155127` (`omit-spread`, turn 3) is **Magic
Room**, not Knock Off in general: Meowstic set Magic Room on turn 2, and on turn 3 Ariados' Knock Off hit a Mega
Alakazam holding its own Alakazite. The ordinary stone-on-own-species rule was already modelled and its probe
(`tests/probe_knockoff_megastone.js`) was green. What was wrong is that `itemRefusesTake` read the item SLOT, and this
engine implements Magic Room / Klutz by parking the item out of the slot (`_roomItem`), so under a room the stone was
invisible to the refusal. Fixed, together with three neighbouring holes found by walking every item mover.

## 2. The authority, derived (Reg M-B checkout `20ad99f`, Reg M-C checkout `f10d679`)

- **Which items refuse `takeItem`.** Walked `Dex.forFormat(...).items.all()` filtered to legal: Reg M-B 148 legal items,
  75 declare `onTakeItem`, all 75 are mega stones; Reg M-C 166 / 81 / 81. The Champions mod's `items.ts` sets only
  `isNonstandard` on them; the handlers are mainline's. Two handler bodies exist:
  `return !item.megaStone?.[source.baseSpecies.baseSpecies]` (most) and a stronger one reading
  `source.baseSpecies.name` against the megaStone map's keys AND values (the stones whose base has more than one forme). The second argument is the HOLDER (`runEvent('TakeItem', this,
  source, null, item)`, `sim/pokemon.ts:1856-1871`). No other legal item refuses.
- **Magic Room / Klutz / Embargo do not silence it.** `sim/battle.ts:607` (singleEvent) and `:874` (runEvent) skip item
  handlers under `ignoringItem()` for every event EXCEPT `Start`, `SwitchIn`, `TakeItem`.
- **The legal item movers** (moves/abilities whose handlers call `takeItem` / `setItem` / `eatItem`, walked over the
  legal set, identical in both regulations): moves `corrosivegas, stuffcheeks, bugbite, covet, fling, knockoff, pluck,
  recycle, switcheroo, teatime, thief, trick`; abilities `harvest, magician, pickpocket, pickup, symbiosis`. Incinerate is
  `Past` in both. None is overridden in `data/mods/champions/`.
- What each asks (bodies read whole off the Dex):
  - Knock Off: `onBasePower` asks `singleEvent('TakeItem', item, …, target, target)` (no x1.5 when refused);
    `onAfterHit` `target.takeItem()`.
  - Trick / Switcheroo: both `takeItem`s, then `singleEvent('TakeItem')` for each item with the RECEIVER as holder.
  - Thief / Covet: `target.takeItem(source)`, then `singleEvent('TakeItem', yourItem, …, source, …)` — the THIEF as
    holder; refused → `target.item = yourItem.id; return;` silently.
  - Corrosive Gas: `const item = target.takeItem(source); if (item) … else this.add('-fail', target, 'move: Corrosive Gas')`.
  - Symbiosis: `source.takeItem()` then `singleEvent('TakeItem', myItem, …, pokemon, …)` — the receiving ally.
  - Magician, Pickpocket: `takeItem` only, no receiver ask.
  - Fling: `singleEvent('TakeItem', item, …, source, source)` — the thrower's own stone; and `ignoringItem(true)` fails
    it first under a room. Bug Bite / Pluck / Stuff Cheeks / Teatime: berries only, no stone can reach them.

## 3. What was wrong in MEDICHAM

| site | defect | arm |
|---|---|---|
| `itemRefusesTake` (every caller: Knock Off strip, Trick, Pickpocket, Magician, Symbiosis, Fling price) | read `m.item`, the slot the room / Klutz park empties | knockoff-room, knockoff-room-mega, knockoff-klutz, trick-room |
| Corrosive Gas (`trickitem` `removes` branch) | never asked the stone | corrosivegas |
| Thief / Covet (`removesItem.steals`) | never asked the stone with the THIEF as holder | thief-receiver, covet-receiver |
| Symbiosis (`passItemFromAlly`) | never asked the stone with the RECEIVER as holder | symbiosis-receiver |

Knock Off's x1.5 was already right (it reads `targetItemOf`, the hold) — the pool game's damage matched (38/130 both).

Fix: `itemRefusesTake` reads `itemOn(m)`; Corrosive Gas refuses on `itemRefusesTake(t)` and so writes its existing
`-fail`; a new branch in the steal step refuses silently on `stoneRefusesBody(itemOn(tg), m)` for `steals` rows;
`passItemFromAlly` refuses on `stoneRefusesBody(itemOn(giver), spender)`. One knob, `MEDI_STONE_TAKE_UNGUARDED=1`,
restores all four old reads (`MEDFAILS.stoneTakeUnguardedRestored`). Counters: `corrosiveGasRefusedByStone`,
`stealRefusedByReceiverStone`, `symbiosisRefusedByReceiverStone`.

**Not modelled, declared:** when Thief's receiver ask refuses, `takeItem` has already run in the authority, so an
Unburden victim's `onTakeItem` has fired on an item it keeps. No legal fixture found in the pool; not staged.

## 4. The probe — `tests/probe_megastone_take_guard.js`

Eight red arms, two controls, legality from each regulation's `TeamValidator`, the authority's handler shapes asserted
first (CANNOT ANSWER if they move), and the authority's own outcome asserted off its stream (the stone kept, or on a
control, gone) so an arm that stages nothing cannot pass as agreement. The mega arm asserts the `|-mega|` happened.

| run | Reg M-B | Reg M-C |
|---|---|---|
| base bytes (HEAD `68d934be`) | FAIL — all 8 red arms part (releases `7822a83cc49b`, `628259ab78da`) | FAIL — all 8 |
| fix | PASS 10/10 (`e2e3ff4950f9`) | PASS 10/10 (`019abc63aaaf`) |
| fix + knob | every red arm parts, stamp 1; controls 0 | same |

Neighbours green in both regulations on the fix: `probe_knockoff_megastone`, `probe_trick_refusal`,
`probe_room_target_item`, `probe_room_unburden`, `probe_pickpocket_event_position`, `probe_pickpocket_on_a_corpse`,
`probe_regmc_magician_speed_order`, `probe_stealeat_before_reactors`, `probe_knockoff_berry_consumers` (Reg M-B exit 0;
Reg M-C every row MATCH, then exit 1 on its artifact write, which `engine/regulation.js` refuses under regmc — the probe
is not regulation-aware; unrelated to this change). `probe_unburden_acquired` is CANNOT ANSWER in both (it pins release
`2b5a6585d8cf`, cut for another damage table) — pre-existing, unrelated.

## 5. The pinned differential

Flags (the sample definition): `--steering empirical --arm middle --end-state --games 300 --write --out <scratch>`,
through `tools\lownode.cmd`. Reg M-B: `--census data/verification/census-pin-833a997d7e42.json --team-store
data/team-pool-frozen` (main's copy). Reg M-C: `--regulation regmc --census
data/verification/census-pin-regmc-0d03e83f0e65.json --team-store data/team-pool-frozen-regmc`.

| regulation | release | what | games | diverged | board-material |
|---|---|---|---|---|---|
| Reg M-B | `7822a83cc49b` | base | 260 | 2 | 1 (`…2659015200`, `p1.party.alakazam.item`) |
| Reg M-B | `e2e3ff4950f9` | fix | 260 | 1 | 0 |
| Reg M-C | `628259ab78da` | base | 259 | 0 | 0 |
| Reg M-C | `019abc63aaaf` | fix | 259 | 0 | 0 |

The Reg M-B base run reproduces the finding agent's sample exactly (260 / 2 / 1, same game, same leaf). On the fix the
Alakazite game is gone and the one remaining divergence is the declared Supreme Overlord `fallenundefined` row; no new
game appears. Reg M-C parts nothing either side (its 300 lattice holds no stone-in-a-room game), so it shows no
regression and nothing more; the fix there is proven by the probe. The releases were cut in this worktree and are not committed; the ids are receipts for this report.

The single game was also replayed with `--only-game 2659015200` at base to read the turn-by-turn trace (Magic Room on
turn 2, Knock Off on turn 3, `-enditem` here and nothing there).

## 6. Owed / not done here

- `node engine/status.js --write` NOT run (from a worktree it writes missing untracked files as fact). Coordinator at merge.
- The census was not regenerated: no tag changed; the fix is on already-live mechanics.
- `data/engine-release.json` (modified by the cuts), `data/engine-release-regmc.json` (created by the regmc cut) and
  `data/verification/probe-knockoff-berry-consumers.json` (rewritten by the Reg M-B neighbour run) are left out of the
  commit. Scratch created this session: `.gd-scratch/` (differential outputs and logs).
- No REGULATION-ROTATION row: the mechanic and every handler involved are byte-identical across the two checkouts
  (the probe asserts the shapes per regulation), so nothing here is a rotation trap.
