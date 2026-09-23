# Reg M-C engine pass 7: the Armarouge tie, then the lab on the finished engine

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.61.0 onward. **Status.** Findings record, historical by
construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a505d96099bbf5e8c`, branch `worktree-agent-a505d96099bbf5e8c`, base `5ad93b33` (0.61.0) |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` (commit `f10d679`), selected by the regulation |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, argv form, from a node launcher in the session scratchpad |

Pins, every Reg M-C lattice: `--regulation regmc --steering empirical --arm middle --end-state --census
data/verification/census-pin-regmc-f3b70bc0c47c.json --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc
--games <1200|1350|1950> --release <id> --write --out <scratch>`. Reg M-B: `--steering empirical --arm middle --end-state
--census <HEAD's data/mechanics-census.json, copied> --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen`,
`SHOWDOWN_PATH` the M-B checkout. State bar = `state.games - state.games_board_never_diverged`.

---

## 1. The Armarouge card: the die was Encore's `insertChoice`, not the turn's sort (abra/regmc 0.62.0)

### The card, replayed
Release `be192e23eb5b` (cut again from the 0.61.0 tree in this worktree; the same id as pass 6). It was replayed alone with
`--only-game "pair-redirect-priority gen9championsvgc2026regmcbo3-2678207112"` and took 4 m 29 s. Turn 5, as both engines
write it:

```
sd |move|p1a: Whimsicott|Encore|p2b: Armarouge        me |move|p1a: Whimsicott|encore|p2b: Armarouge
sd |-start|p2b: Armarouge|Encore                      me |-start|p2b: Armarouge|move: encore
sd |move|p2b: Armarouge|Expanding Force|p1b: Armarouge me |move|p1b: Armarouge|expandingforce|p2b: Armarouge
```

### Which call decided it, from the authority's source
Three sources were read whole: `sim/battle.ts` `speedSort` :429-460, `runAction`'s gen >= 8 re-sort :2915-2926 and
`commitChoices` :2999-3018; `sim/battle-queue.ts` `changeAction` :301, `insertChoice` :372-404 and `sort` :418-421; and
`data/mods/champions/moves.ts` `encore` :307-341.

- **The turn's `speedSort` (commitChoices, then the re-sort after the Encore action) did not decide it.** The middle arm
  replaces `prng.shuffle` with a no-op (`pinShuffle`, `engine/game_differential.js`). The engine sets its tie key to the
  constant `() => 0`, and the key is drawn per action and stored, so a stable group sort keeps order. Both engines
  therefore keep a tied group in the order that the selection sort leaves it. The queue for this turn is Whimsicott
  (Prankster +1), then the two priority-0 Armarouge. The sort makes no swaps, so p1b is ahead of p2b in both engines.
  That is the order turn 4 played.
- **Encore's `changeAction` decided it.** p2b had clicked something other than its turn-4 Expanding Force. Champions'
  `onStart` saw `action.moveid !== move.id` and called `changeAction`, which is `cancelAction` and then `insertChoice`.
  `insertChoice` walks the remaining queue `[p1b EF, residual]`: `comparePriority(p2b, p1b) = 0`, so `firstIndex = 0`,
  and against the residual the result is `< 0`, so `lastIndex = 1`. It inserts at `battle.random(0, 2)`. The middle arm
  pins a two-argument `random` in the `any` category to `m` (see game_differential.js, "THE QUEUE INSERTION INDEX").
  That gives index 0, so **p2b goes ahead of p1b**. The re-sort after the Encore action keeps that order, because the
  shuffle is identity.
- **This engine drew nothing at that call.** `encoreRelocateQueued` wrote `_selMv` and left the action in its slot. The
  following `_resortTail` keeps a tie group stable when the keys are constant, so p1b stayed first. The two engines did
  not consume the same die at the same call: the authority rolled a die here that this engine never rolled.

### The fix
`encoreInsertChoice` is called from `encoreRelocateQueued` after the bracket rewrite. It splices the action out, then
compares it with each remaining action. The comparison uses `turnOrderKey` with the tie field zeroed and `pri`
re-derived off `_selMv`, as `resolveAction` → `getActionSpeed` rebuilds it. The walk mirrors `insertChoice`: the first
`<= 0` result gives `first` and the first `< 0` result gives `last`. When they differ, the action is inserted at
`first + floor(tie() * (last + 1 - first))`, which draws the shared `tie` stream only where the authority draws.
`ENCORE_Q` now carries `field` and the turn's `_tieRng`. Counters: `MEDSEEN.encoreInsertTieDrawn`, `encoreInsertMoved`;
`MEDFAILS.encoreInsertNoDie` (must read 0). Knob `MEDI_ENCORE_INSERT_KEEPS_PLACE=1` restores the pre-fix behaviour and
stamps `MEDFAILS.encoreInsertKeepsPlaceRestored` at load.

Under real dice the stored `_tie` keys still order the group at the next re-sort. The authority reshuffles at that
re-sort, so the two orders have the same distribution for the group. The insert draw is spent in the same place as the
authority's.

### The probe: `tests/probe_encore_insert_tie.js`
Board: Sylveon in slot 1 on both sides. The driver's spread is set per slot, so the two are an exact tie. Whimsicott
(Prankster) Encores and Meowstic is faster at priority 0. Every entity was checked against the selected format and the
learnset before play, and 0 were illegal in either regulation.

| arm | kind | authority T2 | this engine, clean | knob | release `be192e23eb5b` |
|---|---|---|---|---|---|
| tie-front | red | Whim, Meow, **p2b**, p1b | same | p1b, p2b (parts) | p1b, p2b — DEFECT |
| tie-no-encore | control | Whim, Meow, p1b, p2b | same | same | same |
| tie-same-move | control | Whim, Meow, p1b, p2b | same | same | same |
| tie-mirror | control | Whim, Meow, p1b, p2b | same | same | same |

Instrument control: the authority orders `tie-no-encore` differently from `tie-front` (YES). Results:

- Reg M-C clean, release `aa7b45c6b8d2`: 4/4, exit 0.
- Reg M-B clean, release `3f877319ebf0`: 4/4, exit 0.
- Prior release `be192e23eb5b`: `tie-front` reads DEFECT, exit 1. The knob check also fails there, which is expected
  because that tree has no knob.
- `tests/probe_encore_bracket.js`: 11/11 on both regulations.

### Lattices after
| | 1200 | 1350 | 1950 |
|---|---|---|---|
| Reg M-C, release `aa7b45c6b8d2` | **0 / 954** (void 1, protocol-only 64) | **0 / 1075** (72) | **0 / 1537** (96; was 1 / 97) |
| Reg M-B, release `3f877319ebf0` | **0 / 961** (0) | **0 / 1069** (1) | **0 / 1497** (2) |

All six artifacts are stamped between 2026-09-23T01:41Z and 02:01Z and carry the release ids above.
`data/tags.json`, `data/protocol-events.json` and `data/move-effects.js` are byte-identical to HEAD (`git diff --quiet`).
Commit `92e29f4c`.

---

## 2. The lab on the finished engine (abra/regmc 0.63.0)

Engine release **`aa7b45c6b8d2`** is used for all of it. A re-cut after the 0.62.0 commit returned the same id. The
census reads the live tree, which is those bytes.

### Census
| | before (`generated`) | now (`generated`) |
|---|---|---|
| Reg M-C `data/mechanics-census-regmc.json` | 1006 / 1006 live (2026-09-22T03:01:39Z) | **1006 / 1006 live**, run_ok, 0 missing / threw / hollow (2026-09-23T02:09:44Z) |
| Reg M-B `data/mechanics-census.json` | 1004 / 1004 live (2026-09-21T11:12:24Z) | **1004 / 1004 live**, run_ok, 0 missing / threw / hollow (2026-09-23T02:09:44Z) |

Both runs exited 0. The diffs are sampled-detail text only (the formatSecondaryChance rate, and a species-id spelling in
the Screen Cleaner detail). No row changed status.

### Reg M-C roster, `--reds --write --release aa7b45c6b8d2`
| stage | in scope | MATCH | DIFFER | DID-NOT-FIRE | COULD-NOT-STAGE | other | exit |
|---|---|---|---|---|---|---|---|
| items (gen 02:11:07Z) | 166 | 154 | **0** | **0** | 12 | — | 0 |
| abilities (gen 02:11:33Z) | 214 | 201 | **0** | **0** (was 2) | 9 | ANNOUNCEMENT-ONLY 3, DEFERRED-BY-OWNER 1 | 0 |
| moves (gen 02:12:08Z) | 511 | 507 | **0** | **0** | 1 | BELOW-USAGE-SHELF 2 (was 3), DEFERRED-BY-OWNER 1 | **1** |

The rows below are named in full and are **not fixed in this pass**:

- **FIRED-AND-BOARDS-DIFFER:** none in any stage.
- **DID-NOT-FIRE:** none. Seed Sower and Steely Spirit, which read DID-NOT-FIRE on `fa68d953e73f`, now match.
- **COULD-NOT-STAGE (22):**
  - items: Air Balloon, Binding Band, Eject Button, Electric Seed, Grassy Seed, Leek, Misty Seed, Normal Gem, Psychic
    Seed, Red Card, Rocky Helmet, Terrain Extender
  - abilities: Emergency Exit, Grass Pelt, Harvest, Libero, Liquid Ooze, Punk Rock, Rattled, Run Away, Stakeout
  - moves: Milk Drink
  - This is the same set as on `fa68d953e73f`.
- **BELOW-USAGE-SHELF, underlying FIRED-AND-BOARDS-DIFFER:** Bounce (2 clicks), Jaw Lock (0 clicks). Mirror Coat has left
  the shelf and now matches.
- **DEFERRED-BY-OWNER:** Illusion (Will's declared exclusion), Copycat. **ANNOUNCEMENT-ONLY:** Anticipation, Forewarn,
  Frisk.
- **The moves stage is red on its instrument, not on a mechanic.** Plant anchor `move/needs-the-terrain-it-names`
  (`field.terrain=_t;field.terrainT=5;if(TR)TR.terrainStart(_t,null,m);`) matches 0 times in the engine, so the rule's
  3 rows are UNPROVEN and the stage cannot report clean. It was already dead on `fa68d953e73f`.
- **Held red demonstrations:** Belch, Bug Bite, Pluck and Recycle are held on pre-#318 bodies, and their rule's red
  demonstration went NOT CAUGHT. The log's `UNRESOLVED … goodrahisui refuses <move>` confirms that these fixtures are
  illegal. This is unchanged from before.
- **Fixture legality, report-only:** 17 items, 82 abilities and 47 moves fixtures are illegal and not baselined. This is
  identical to `fa68d953e73f`.

---

## 3. Where the line stands

- The pinned Reg M-C whole-game clause reads **0 at 1200, 1350 and 1950** on `aa7b45c6b8d2`.
- Reg M-B reads **0 / 0 / 0**.
- Census: Reg M-C 1006/1006, Reg M-B 1004/1004.
- The Reg M-C roster has no DIFFER and no DID-NOT-FIRE. What remains is 22 COULD-NOT-STAGE rows, a dead plant anchor on
  the moves stage, and two shelf rows with an underlying DIFFER.
- Left untracked in the worktree: `data/engine-release-regmc.json`, which was there before this pass.
- Also left untracked, and written by this pass's roster runs: `data/roster.{items,abilities,moves}.prev-regmc.json` and
  `data/roster-regmc.json`. These are the roster's own backup and convenience copies. They were not committed.
- Scratch is under `data/_scratch-eng-p7/` (git-ignored).
- The tracked M-B pointer `data/engine-release.json` was moved by the M-B cut and restored from HEAD before the commit.

---

## OWED, NOT RUN

Run from the MAIN checkout after the merge. None of these was run in this worktree, and `status.js --write` must not run
from a worktree:

```
node engine/status.js --write
node engine/quarantine.js --regulation regmc
```

The Reg M-B held-out draw is owed on top of pass 6's, because 0.62.0 changes a path Reg M-B runs (the Encore re-insert):

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/engine_release.js cut "abra/regmc 0.63.0, Reg M-B held-out"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown tools\lownode.cmd engine/game_differential.js --steering empirical --arm middle --end-state --census <copy of data/mechanics-census.json> --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen --release <id> --games 12000 --write --out <scratch>
```

The next pass takes the reds from §2. The re-aim of the dead anchor is checked with:

```
node tests/roster.js --regulation regmc --rule move/needs-the-terrain-it-names --stage moves --reds --release <id>
```
