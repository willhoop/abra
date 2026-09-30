# data/tags-regmc.json and the stale plain store (abra/regmc 1.38.0), 2026-09-30

## Verdict

**The simulator changes, in one place.** The rows, the tags and the params of `data/tags-regmc.json` are
byte-identical before and after the regeneration. Only usage moved. One usage count is a simulator input: the
engine chooser's one-turn-guard click rate. Quick Guard's rate goes **0.0271 → 0.0390**. The tag file is frozen
into every engine release, so a release cut from this tree needs the Reg M-C gate re-run. It was not run here,
because the game-playing slot belongs to another agent.

## 1. Which fields are usage-weighted

In `engine/tag_dex.js`, `usage()` counts sheet entries (item, ability, every move) over the regulation's own two
stores, through `fit_policy.loadCorpus({files})` → `quality.readStore` → `storePath()`. Usage reaches the artifact
in four places:

1. `moves|items|abilities[id].uses`, and the tag index `uses` and `examples` (`collect()`).
2. **Row admission for an UNTAGGED entity.** A legal entity with no tag gets a row only if it has uses, or if it is
   a mega ability reachable from a stone on a real sheet (`REACHABLE`, which is built from the same corpus).
3. `linkage[key].carrierMoves` and `reactorMoves`. These admit a move only if its uses > 0.
4. `sheet_entries` and `usage_from`.

## 2. Which of these the simulator reads

- `engine/tags.js` exposes `tagsFor`, `param`, `has`, `withTag` and `reactorsTo`.
- `param`, `has` and `withTag` read only `tags` and `params`.
- `reactorsTo` (the linkage) is defined in `medicham2-browser.js` and is never called there. `board.js` does not call
  it either.
- A grep of every frozen engine source for `uses` finds **one** read:
  - `engine/medicham2-browser.js:9523`, `sideGuardClickRate`. The rate is
    `0.35 × uses(id) / max uses over the oneTurnGuard family`.
  - `_chooseAction` (line 21464) rolls against that rate before it raises a Wide Guard or Quick Guard.
  - `_chooseAction` runs whenever a turn has no forced action (line 33349 `_a=forced||chooseAction(...)`). That
    covers the engine's own play and the solver's playouts through `engine/medicham_api.js`.
- `tagsFor(...).name` is also read, for narration. So row admission (item 2) could reach narration. It did not move:
  see §3.

## 3. The regeneration and the diff

Command: `ABRA_REGULATION=regmc NODE_OPTIONS=--max-old-space-size=3072 node engine/tag_dex.js`, exit 0. The file
mtime moved to 2026-09-30 00:59. It printed:
`regmc usage weighted by its own stores: data/games.gen9championsvgc2026regmc.jsonl.gz, data/games.gen9championsvgc2026regmcbo3.jsonl.gz -> 27108 clean open-sheet games`.
Only the `.gz` files exist in this worktree.

| | old (2026-09-24) | new |
|---|---|---|
| `usage_from` | plain `.jsonl` paths (the paths requested) | `.jsonl.gz` paths (the files opened) |
| `sheet_entries` | 205,836 | 325,296 |
| rows (moves / items / abilities) | 515 / 166 / 216 | 515 / 166 / 216, no row added or removed |
| `tags` lists that differ | | 0 |
| `params` objects that differ | | 0 |
| tag index `(tag, kind, consumedBy, used)` | 336 | identical |
| `uses` that differ | | 448 moves, 158 items, 180 abilities |
| `linkage` membership that differs | | contact, bite, statusMove, physicalMove, specialMove (not read by the simulator) |
| oneTurnGuard | Quick Guard 380, Wide Guard 4,907 | Quick Guard 811, Wide Guard 7,285 |
| click rate | Quick Guard 0.0271, Wide Guard 0.35 | Quick Guard **0.0390**, Wide Guard 0.35 |

The old file was 914,795 bytes and the new one is 870,887 bytes, with the same row set. The old copy has no CR
characters, so this is not a line-ending difference. The size change is in the usage-dependent fields (examples
and linkage lists) and in the numbers.

Because the tag set, params and rows did not move, **code drift in `tag_dex.js` since 2026-09-24 had no effect on
this artifact**. Usage is the only cause.

## 4. The receipt fix

`usage()` now sets `out.from = OWN.map(p => relative(Q.storePath(p)))`. This is the same resolver `readStore` uses,
so the receipt and the read cannot disagree. `storePath()` prints its choice to stderr once per path when both
files exist.

No Reg M-C browser tag bundle exists (only `data/abra-tags.js`, which is Reg M-B), so `build/build_tags_js.js` was
not run.

## 5. What this does not claim

- It does not claim a strength or accuracy change. The rate change alters which action the heuristic chooser picks
  in a rare situation: an rng draw in [0.0271, 0.0390), on a body that holds Quick Guard and faces a
  priority-move threat.
- It does not claim that a gate figure moved. The gate's lattices use `--steering empirical` (store-driven clicks),
  so the chooser may not be reached on many turns. Whether it is reached is a question for the re-run, not for this
  report.
- The gate verdict belongs to release `eaa5becc54eb`, which froze the old tag file. It still stands for that release.

## OWED, NOT RUN

The game-playing slot was taken, so none of this was run. Run it in order, one at a time, with `ABRA_REGULATION=regmc`
and `SHOWDOWN_PATH` unset, each through `cmd.exe /c tools\lownode.cmd` (this follows
`docs/_reports/2026-09-24-regmc-gate-final.md` §2):

```
node engine/engine_release.js cut "tags-regmc re-weighted from the .gz store (abra/regmc 1.38.0)"   # -> <REL>
node tests/test-mechanics.js                          # census; pin it as data/verification/census-pin-regmc-<id>.json
node engine/game_differential.js --steering empirical --arm middle --end-state --release <REL> --census <PIN> --team-store data/team-pool-frozen-regmc --games 1200 --write --out <gate path 1200>
node engine/game_differential.js ... --games 1600 ... --out <gate path 1600>
node engine/game_differential.js ... --games 1900 ... --out <gate path 1900>
node tests/test-engine-diff.js --n 6000 --seed 20260804
node tests/roster.js --stage items --reds --write --release <REL>
node tests/roster.js --stage abilities --reds --write --release <REL>
node tests/roster.js --stage moves --reds --write --release <REL>
node engine/all_mechanics_fire.js --release <REL> --write
node engine/register_reality.js                       # then restore the census to the pin
node engine/quarantine.js --regulation regmc
```

Take the gate output paths from `engine/quarantine.js`, the same way the 2026-09-24 run did. Also, for SOLVER: any
playout figure measured on `eaa5becc54eb` stays on that release. A figure re-measured on the new release is a new
measurement.
