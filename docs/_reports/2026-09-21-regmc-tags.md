# Reg M-C gets its own tag file and protocol-events file; terrain on entry is closed

**Date.** 2026-09-21. **Division.** ENGINE. **Status.** Findings record. It is historical by
construction and is never cited as current state (CLAUDE.md, `docs/_reports/` rule).

**No Reg M-C figure is published here.** Every Reg M-C count below is a SMOKE reading: the census is
unpinned, no release is named, and the request is 100 games. The counts say what parts, by kind. They
say nothing else.

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a9c9c1a543bc21290`, base `b0fd6661` (abra/regmc 0.14.0) |
| M-B authority, pinned, untouched | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| M-C authority, untouched | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d6798f2ba` (selected by the regulation, `SHOWDOWN_PATH` unset) |
| M-C pool, smoke | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`, read in place |
| launcher | `tools\lownode.cmd`, called through `cmd.exe /c` from a node argv launcher in the session scratchpad. It was shown to propagate exit code 3 before use. |

---

## 0. The verdict

| | |
|---|---|
| **files** | `data/tags-regmc.json` (215 abilities, 166 items, 515 moves; 212,856 sheet entries) and `data/protocol-events-regmc.json` (91 events, 46 emitted, 48 declared, 10 partial, both gates pass). |
| **selection** | `runtime.regmc.tags` and `runtime.regmc.protocolEvents` in `data/regulations.json`. They use the same sibling rule as `engineData`. `engine/regulation.js` now keeps ONE map (`FILES`, `fileFor(rel)`) for all three files. |
| **reads** | The engine reads its tags through `require` (`engine/tags.js`), so the existing resolver redirects it with no reader edit. Two `fs` readers were edited: `game_differential.js` (the tag file and the protocol-events default) and `names.js` (see §4). A release cut under M-C freezes `data/tags-regmc.json`. `REL.path` and `REL.read` of `data/tags.json` serve the frozen M-C copy. |
| **writes** | While a regulation that maps a file is selected, any write, append, rename or copy onto the live tree's `data/tags.json`, `data/protocol-events.json` or `data/engine-data.js` is REFUSED by name. This was shown on the real deriver: `derive_protocol_events.js --regulation regmc --write` with no `--out` refused, and M-B's file stayed `829e525dfb52`. |
| **Reg M-B unmoved** | `data/tags.json` `c34d6465c3b6`, `data/protocol-events.json` `829e525dfb52` and `data/abra-tags.js` `43bf7eb1bcc1` are byte-identical to base. On the damage differential (`--n 6000 --seed 20260804`), base against change is 150 lines each and differs ONLY on the launcher's pid line. The control (seed `20260805`) differs on 128 lines, so the comparator can see a difference. |
| **six stones** | All six now carry `megaStone` with the forme they become. The "mega forme did not evolve" first cause went from **8 games to 0**. |
| **terrain** | Of the **45** dumped games whose first divergence was surge-terrain-on-entry, after the change: **19 no longer diverge**, **17–18 part on the terrain SEEDS**, 6 part on Rocky Helmet, 1 parts on the order of Grassy Terrain end-of-turn healing, and 1–2 are other. |
| **new test clauses** | `tests/test-regulation-table.js` went from 18 to **24 of 24**. It was shown red at **4 of 24** on a deliberate break (the `tags` row removed from the map). |

## 1. The file names and how they are selected

This follows `data/engine-data-regmc.js` exactly. `data/regulations.json` → `runtime.regmc`:

```
"engineData":     "data/engine-data-regmc.js",
"tags":           "data/tags-regmc.json",
"protocolEvents": "data/protocol-events-regmc.json",
```

`engine/regulation.js` generalises `tableFor` from one basename to a map. Any regulation key that is
absent means the M-B file. Each value must be a `data/<file>` with the same extension as the file it
replaces, so the one rule finds it in the live tree and in `data/releases/<id>/data/`. Reg M-B maps
nothing and installs nothing. Its code path is unchanged.

- **tag_dex.** It writes `REGN.TAGS_FILE`. The Reg M-B literal is kept on the write line, because
  `engine/provenance.js` attributes the artifact by the path spelled at the write. Its usage corpus
  under M-C is M-C's own stores: `games.<showdownFormat>.jsonl` and `games.<bo3Format>.jsonl`, which is
  the naming `engine/next_regulation_ingest.js:73` uses. They are read through `Q.readStore`, so the
  tracked `.gz` serves in a worktree. It **refuses to write a regulation's own file with zero sheet
  entries**. The M-B path keeps its old behaviour.
- **fit_policy.loadCorpus** gains `opts.files`. The behavioural-bot set is computed over those games,
  not over M-B's ladder store. With no `opts.files`, nothing changes.
- **engine_release** adds the tag file to `REGULATION_SOURCES`, so an M-C cut freezes 30 files, up from
  29. The protocol-events file is deliberately NOT frozen: it is an alignment input
  (`game_differential.js` PROTO_PATH header), for M-C as for M-B.
- **game_differential**: `TAGS_LIVE` and the default `PROTO_PATH` follow the regulation. An explicit
  `--protocol-events` still wins.

## 2. The hazards the brief named, checked

| hazard | result |
|---|---|
| usage zeroes when the store is absent | Not hit. **212,856 sheet entries from 17,738 clean open-sheet games**, read from the tracked `.gz` snapshots of the two M-C stores. No hard link was needed. The zero-refusal is in place anyway. |
| `shortDesc` read on a description-free checkout | **Holds.** Reflect `halvesDamage` reads Physical, Light Screen Special and Aurora Veil both. Brick Break and Psychic Fangs carry `clearsScreens`. Every one matches its M-B row. |
| the validator-readmitted ability | **Reaches the file.** `legal_scope: RE-ADMITTED: ability:auraguard <- Lucario @ Lucarionite Z`. `auraguard` carries `breakable` and `damageReduce {0.5, onlyWhen: contact}`. |
| one tag matched nothing under M-C | `typeSplitMove` (Curse). The M-C checkout has no `nonGhostTarget` field, because upstream dropped it and the Champions mod rewrote Curse (`pokemon-showdown-mc/data/mods/champions/moves.ts:165-194`). The predicate now reads the split off `onModifyMove` when the field is absent. **Membership was printed before wiring**: M-B `{field:[curse], handler:[]}`, M-C `{field:[], handler:[curse]}`. It cannot over-match and it cannot move M-B's reading. |

## 3. The smoke — before and after on the SAME sample

The command is the one in `docs/_reports/2026-09-21-regmc-table-wiring.md` §4, plus `--dump-games 200`.
The BEFORE arm is the same tree with the `tags` key removed from `data/regulations.json`, so the engine
reads M-B's `data/tags.json` under M-C, as at base. It reproduced the prior report exactly: 75 of 87
diverged, 10 VOID, **65 of 77 board-material**. Both arms pick teams with the same membership (see §4),
and team pool `2f34f5830841` is the same in both.

| | before (release `040dc5282469`) | after (release `fa247a603716`) |
|---|---|---|
| games played / threw | 87 / 0 | 87 / 1 |
| protocol-diverged | 75 | 52 |
| VOID | 10 | 2 |
| **board-material** (`state.games` − never-diverged) | **65 / 77** | **45 / 85** |

First protocol divergence of the dumped (non-void) games, bucketed by `scratchpad/join.js`:

| cause | before | after |
|---|---|---|
| terrain set on entry (Grassy/Psychic Surge) | **45** | **0** |
| mega forme did not evolve | 8 | **0** |
| Libero typechange | 1 | 0 |
| terrain seed not consumed (`-enditem … grassyseed/psychicseed`) | 1 | **25** |
| Rocky Helmet chip missing | 0 | 7 |
| damage value / faint | 3 | 5 |
| Air Balloon | 2 | 3 |
| Red Card / Eject Button | 0 | 2 |
| Emergency Exit | 1 | 2 |
| Inner Focus stat name (`atk` vs `attack`) | 2 | 2 |
| apostrophe species spelling | 1 | 1 |
| Grassy Terrain heal order | 0 | 1 |
| other | 1 | 2 |

**Where the 45 terrain games went.** 19 no longer diverge. 18 part on the seeds, 6 on Rocky Helmet, 1 on
the Grassy Terrain heal order, and 1 on a `-fail` against a switch. **Terrain on entry is closed. What
it unmasked is the terrain's consumers.** Rocky Helmet is not terrain: it was banned in M-B and is
legal in M-C, so the engine has never had to model it.

## 4. A second reader that ignored the regulation: `engine/names.js`

A trace preload was run on a 10-game M-C run. It logged every `fs.readFileSync` of a live-tree file
with a Reg M-B name, and found two:

- `engine_release.js` `sha12` digesting `data/tags.json`. This is correct: M-B's file is in `SOURCES`.
- **`engine/names.js` `tags()`, which feeds `byTag`.** `engine/diff_swarm.js` builds its config
  feature sets through it (`protect`, `weatherAb`, `intimidate`, …). So under M-C the swarm picked
  teams by **Reg M-B membership**. That was one more silent default, and it is fixed.

The fix changes the M-C sample, so it is reported separately and is not netted into §3. Re-run with the
fix: picked-team digest `e1d4b0f81d40`, 87 played, 50 diverged, 1 VOID, **43 / 86 board-material**,
release `d7a16cbb5817`. First causes: seeds 30, Rocky Helmet 7, Air Balloon 3, damage 2, Inner Focus 2,
Emergency Exit 1, Red Card/Eject Button 1, Grassy heal 1, other 2. **Terrain on entry is still 0 and
mega is still 0.**

## 5. What real engine work the terrain needs — the next pass, not started

Each item is a missing TAG derivation (the M-C tag rows carry `flingable` only) AND a missing engine
consumer:

1. **Grassy Seed / Psychic Seed** (and the Electric and Misty seeds, both carried at low usage). The
   holder consumes the seed when its terrain starts and takes a stat boost, and Showdown narrates
   `-enditem`. This is **the largest remaining M-C cause: 25–30 of ~50 dumped games.** Usage in the M-C
   tag file: grassyseed 9,862, psychicseed 7,056.
2. **Grassy Terrain end-of-turn heal ORDER.** One game heals the bodies in a different order. This is a
   residual-order question for the terrain that now exists, not a tag question.
3. Rocky Helmet (4,161), Eject Button (1,208) and Red Card (58) are items that are legal in M-C and
   banned or absent in M-B, and none carries a mechanic tag. Air Balloon (178) has no ground-immunity
   tag and no announce. Emergency Exit (4,956; tag_dex reports it UNTAGGED at 2.33% usage) is the same.
   None of these is terrain; they are next in line after it.

Not done, and stated so: the Curse row under M-C also gains `statChangeInCode {on: 'target'}` and
`lowersTarget`. That reads the new `this.boost({…}, source, source)` handler as a boost on the target,
which is wrong. It is 70 uses and needs its own look. The Inner Focus stat name and the apostrophe
species names are carried from 0.14.0.

## 5b. Fixed on the way because it blocked every commit: the hook copied directory trees into %TEMP%

The first commit of this pass hung inside `engine/artifact_audit.js --staged` for 20 minutes with no
output. The cause: the audit finds "sibling checkouts" by matching `'..', '..', '<name>'` in engine and
build sources, and `engine/regulation.js:261` spells `path.join(ROOT, '..', '..', '..', '..', c)`, so
`..` was taken for a sibling name. `fs.cpSync(<grandparent>, <tmp>/..)` then copied:

- from the main tree, **`C:/Users/willj/Projects` into `%TEMP%`**. `%TEMP%/Pokemon` has an `ABRA`,
  `CHOMP`, `HoopaDex`, `pokemon-showdown`, `pokemon-showdown-mc` and more, created at **13:41**. That is
  consistent with the 0.14.0 commit on main.
- from this worktree, `ABRA/.claude` (`%TEMP%/agents`, `%TEMP%/worktrees`, created at 14:30).

This agent killed its own hook's audit (pid 8908) by pid. **The coordinator's own commit (git pid 16744,
audit pid 15488, started 14:32:46) was still running this copy when last checked, and was NOT touched.**
The fix is one line in `engine/artifact_audit.js`: names made only of dots are skipped. **The copies in
`%TEMP%` were not deleted.** This agent did not create `%TEMP%/Pokemon`, and the others may be shared. The
coordinator should review and remove them.

## 6. Findings on the way, not fixed here

1. **`data/engine-release-regmc.json` is not in `.gitignore`** in this tree, although 0.14.0's report
   says it was added. It appears as untracked and was not added to this commit.
2. **`data/diff-team-pool.json` is one file for both regulations.** An M-C run overwrites the M-B pool
   cache. The size+mtime key makes the next M-B run MISS and rebuild, so nothing is wrong, but the two
   regulations take turns invalidating each other's cache.
3. `data/abra-tags.js` (the browser copy) has no M-C twin. Node never reads it, so the smoke does not
   need it. The web is paused.
4. `tests/test-degradation-budgets.js` is red in this worktree with `ENOENT data/games.ladder.jsonl`.
   This is environmental: the M-B store is untracked and absent from worktrees, and the read comes
   before any code this pass touched.
5. **My own test briefly emptied Reg M-B's `data/tags.json` in this worktree.** The first version of
   clause 6 wrote `'{}'` to prove the guard, and on the deliberate break the guard was off. The file was
   restored from git (`c34d6465c3b6` confirmed) before anything else ran. The clause now writes the
   file's own bytes back, so a broken guard costs an mtime and never the file. Shown red again on the
   break with the file intact.

## 7. Reproduction

```bash
node engine/tag_dex.js --regulation regmc                                  # -> data/tags-regmc.json
node engine/derive_protocol_events.js --regulation regmc --write --out data/protocol-events-regmc.json
node tests/test-regulation-table.js                                        # 24 of 24
node tests/test-mc-key.js; node tests/test-engine-data-regmc.js            # 21/21, 15/15
SHOWDOWN_PATH=<M-B checkout> node tests/test-engine-release.js             # 80 of 80
SHOWDOWN_PATH=<M-B checkout> node tests/test-regulation-runtime.js         # 35 of 35
SHOWDOWN_PATH=<M-B checkout> node tests/test-protocol-trace.js             # ALL PASSED
node engine/game_differential.js --regulation regmc --games 100 \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --steering empirical --arm middle --end-state
```
