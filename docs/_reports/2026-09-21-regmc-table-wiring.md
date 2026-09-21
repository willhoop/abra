# The Reg M-C damage table is wired in, and a frozen release carries it

**Date.** 2026-09-21. **Division.** MEASURE. **Status.** Findings record — historical by construction,
never cited as current state (CLAUDE.md, `docs/_reports/` rule).

**No Reg M-C figure is published here.** §4 is a SMOKE reading: unpinned census, no named release, a
100-game request. Its counts say *what parts, by kind* — the start of the M-C work list — and nothing
else.

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-aad33f4e9b73e22c8`, base `fd488ecc` |
| M-B authority, PINNED, untouched | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` `20ad99ff` (both M-B arms, `SHOWDOWN_PATH` explicit) |
| M-C authority, untouched | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d6798f2ba` (selected by the regulation; `SHOWDOWN_PATH` unset) |
| M-B pool, both lattice arms | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` — team pool `0d103fb9fa87` |
| M-C pool, smoke | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc` — team pool `2f34f5830841` |
| launcher | a BELOWNORMAL node launcher in the session scratchpad (this agent's shell refuses `cmd /c`); exit code shown to propagate (`process.exit(3)` → 3) before use |

---

## 0. The verdict

| | |
|---|---|
| **mechanism** | `engine/regulation.js` wraps Node's `Module._resolveFilename` **only when the selected regulation names its own table** (`runtime.regmc.engineData = "data/engine-data-regmc.js"` in `data/regulations.json`). A request that resolves to `<dir>/data/engine-data.js` returns the sibling `<dir>/data/engine-data-regmc.js` — in the live tree and inside a frozen release alike. Missing sibling → REFUSES by name. With M-B (or nothing) selected nothing is installed. |
| **callers** | **135** files load the table (`engine/ tests/ build/`, comments stripped). **70 follow with no edit.** **61 got one line** — `require('./regulation.js')` placed before their table load. 1 test (`test-engine-data-regmc.js`) needed its M-B *control* to bypass the resolver on purpose. 3 load no table before exiting (`mc_key.js` without `--bases`; `ditto.js` needs CHOMP, unreachable from a worktree; `speed_vs_pokeenv.js` exits 2 on its own precondition). `board.js` is lazy and loads the resolver transitively first — no edit. |
| **the door** | `engine/mc_key.js` requires `regulation.js`. Every table-loading file must load `mc_key` (`tests/test-mc-key.js` clause 4) and every body build reaches it, so a process that loaded M-B's table before the resolver under M-C is **refused**, never carried on with. |
| **release decision** | **The M-C table is frozen only when M-C is selected.** M-B cuts freeze exactly `SOURCES` (28), M-C cuts freeze 29. Same tree → two ids (`8ec558219a03` M-B, `ad61a902ebc5` M-C). `open()` refuses a release cut for the other regulation's table. Per-regulation pointer: `data/engine-release-regmc.json` (gitignored); `data/engine-release.json` stays M-B's. |
| **Reg M-B unmoved** | damage differential: **byte-identical** (149 of 149 lines; only the launcher's pid line differs). 1200-game lattice: **0 of 961** before and after; every counter identical; the only differing lines are the release id, the pool-cache miss of the first run, and the wall clock. |
| **M-C plays** | **87 of 87 games played, 0 threw**, against the M-C authority, M-C teams, the M-C table and an M-C release. Exit 0. |
| **what parts** | 75 of 87 protocol-parted; 10 VOID (low identity); **65 of 77 usable board-material**. By first board-material cause: **53 Grassy/Psychic Surge terrain on entry**, ~9 M-C megas that never evolve, 3 damage/faint, 2 Inner Focus stat name, 2 apostrophe species names, 1 Libero, 1 Air Balloon, 2 other. |
| **new test** | `tests/test-regulation-table.js`, 18 clauses, **red at 13/18 on a deliberate break** (resolver install commented out) before being trusted. |

## 1. Why a resolver and not ~130 edits

Every caller loads the table **for its side effect**: the IIFE writes `globalThis.MC` and `mcEff`, and
every consumer reads the global. So the readers were never the work; the PATH was — the same shape as
`CS.FORMAT`'s 490 readings. Node already resolves every `require` through one function. Wrapping it
means the ~130 call sites, `REL.require`, `require(REL.path(...))` and board.js's lazy load all follow
without being touched, and so will a caller written tomorrow.

**The sibling rule is what makes one mechanism serve both trees.** A release copies
`data/engine-data.js` to `data/releases/<id>/data/engine-data.js`. Resolving to the sibling in the same
`data/` directory finds `data/releases/<id>/data/engine-data-regmc.js` when the release froze it, and
nothing when it did not — and nothing refuses.

**Why the 61 still needed a line.** The wrapper only redirects a require that happens *after*
`regulation.js` loads. The 61 load the table before anything that pulls it in. Measured, not guessed:
each of the 135 was run under `ABRA_REGULATION=regmc` with a preload that stops the process at its
FIRST table load and reports what resolved and whether `regulation.js` was already loaded
(scratchpad `order_scan.js` / `order_preload.js`). Before the edit: 70 REDIRECTED, 61 M-B-FIRST, 4
no-load. After: **131 REDIRECTED**, 1 M-B-FIRST (the deliberate control below), 3 no-load.

**What the refusal buys.** Without it, a 62nd file written tomorrow that loads the table first would run
M-C teams on M-B's table and exit 0. With it, the first body build under M-C throws:
`regulation: REFUSING — this run selected regmc (table data/engine-data-regmc.js), and Reg M-B's table
was ALREADY LOADED before the regulation resolver was`. Swapping the globals after the fact was
considered and rejected: a caller that captured `require(...).MC`, and the seal `mc_key` puts on
`MC.mons`, would keep the M-B object with nothing to say so.

**The one deliberate bypass.** `tests/test-engine-data-regmc.js` loads M-B's table inside its M-C child
as a CONTROL. Under the resolver that `require` would load the M-C table a second time and the control
would measure the arm it contrasts. It now compiles M-B's file directly and says why. Still 15 of 15.

## 2. The release decision, and why

**Frozen only when selected.** `engine/engine_release.js` gains `sourcesNow()` = `SOURCES` plus the
selected regulation's table; `treeDigest`, `cut`'s copy loop, the closure scan and the same-id
disagreement check use it. The manifest carries `regulation` and `engine_data` only on such a release.

1. **An M-B release is unchanged by construction.** With M-B selected the list is empty: same file set,
   same digest-of-digests. Always freezing the M-C table would move every M-B id and put a file into
   every M-B `source_digests` that the M-B run never read — ROADMAP #547's shape in reverse — and
   `provenance.js` would then call every M-B artifact COMPUTED FROM DIFFERENT CONTENT each time the M-C
   table is rebuilt, which during M-C work is daily.
2. **No collision.** Same tree, different source sets, different ids (`8ec558219a03` vs
   `ad61a902ebc5` in the test and in the runs). "Identical tree → identical id" becomes "identical tree
   and regulation → identical id".
3. **A release serves the regulation it was cut for.** `open()` compares the manifest's table to the
   selected one before loading a byte: an M-B release under M-C, and an M-C release under M-B, are both
   refused by name. Each opens under its own (control).
4. **One pointer per regulation.** An M-C `cut()` repointing `data/engine-release.json` would make every
   M-B `open()` with no id land on an M-C release — the one-shared-`active`-key hazard the runtime pass
   removed. M-C writes `data/engine-release-regmc.json`, added to `.gitignore` (it names a release under
   the ignored `data/releases/`).

`tests/test-engine-release.js`: **80 of 80**.

## 3. Reg M-B unmoved — the proof

No `--regulation` on either arm, `SHOWDOWN_PATH` explicit on the pinned M-B checkout.

| instrument | before (tree `fd488ecc`) | after |
|---|---|---|
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | exit 0, 149 lines | exit 0, 149 lines — `diff` differs ONLY on the launcher's `child pid` line |
| `game_differential.js --games 1200 --team-store <M-B pool> --steering empirical --arm middle --end-state` | release `f50775b614bb`, pool `0d103fb9fa87`, **0 of 961** diverged, 961/961 never diverged, 202.8 s | release `8ec558219a03`, pool `0d103fb9fa87`, **0 of 961**, 961/961, 201.6 s |

The lattice outputs (621 and 619 lines) differ in: the pid line; the release id (4 lines); the
before arm's two `pool cache MISS … written` lines (first run in this worktree); and the wall clock.
**The comparator can see a difference** — the release-id and pid lines are exactly the lines it
flagged — and both arms are captured stdout, never an artifact that `--write` might not have written.

**Why the release id moved.** Four frozen sources changed: `engine/regulation.js` (the resolver),
`engine/mc_key.js` (the door), `data/regulations.json` (`engineData`), and `engine/rollout_leaf.js` (one
of the 61 one-line edits). The engine that plays is byte-for-byte the same, which is what the two
instruments above establish. Note for whoever reads provenance next: at base `fd488ecc` the live tree
was already `f50775b614bb` while the tracked current-artifact release is `2e9db8bb11fd`, so the M-B
artifacts were already off the live id before this pass; this pass moves the live id once more.

## 4. Reg M-C plays — the SMOKE reading

```
node engine/game_differential.js --regulation regmc --games 100 \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --protocol-events <scratch>/protocol-events-regmc.json \
  --steering empirical --arm middle --end-state
```

- Release `ad61a902ebc5`, cut with M-C selected: 29 files including `data/engine-data-regmc.js`,
  manifest `regulation: regmc`. Showdown `f10d6798f2ba`. Team pool `2f34f5830841` (179 teams of 11,608).
- **87 games, 0 threw, median 7 turns, exit 0.** Run twice; identical apart from pid, cache and clock.
- 75 of 87 protocol-parted. **10 VOID** (low-identity dice streams — the instrument, not a divergence).
  **65 of 77 usable games are board-material**; 12 never parted a board. End state of the 75: 11 same
  end, 49 different, 15 ended apart.

**What parts, by the FIRST board-material cause (73 games):**

| games | kind | where it lives |
|---|---|---|
| **53** | a terrain set on entry by `grassysurge` / `psychicsurge` is not emitted by MEDICHAM | neither ability is in Reg M-B's `data/tags.json` (checked) |
| ~9 | an M-C mega forme never evolves (`lucariomegaz`, `garchompmegaz`, `golisopodmega`) | the six untagged M-C stones — `absolitez`, `baxcalibrite`, `garchompitez`, `golisopite`, `lucarionitez`, `salamencite` |
| 3 | a damage value or a faint differs | not diagnosed |
| 2 | Inner Focus `-fail` names the stat `atk` vs `attack` | narration field that the comparator counts board-material |
| 2 | species with an apostrophe in the name spelled two ways on `switch` | key spelling of a new species |
| 1 | Libero typechange missing | not in M-B's tags (checked) |
| 1 | Air Balloon announce missing | not in M-B's tags (checked) |
| 2 | other (`-fail` ordering) | not diagnosed |

**The first item is the M-C work list's head: an M-C `data/tags.json`.** 53 of 73 parted games part on
one missing tag family, and the megas are the same artifact. None of it is a table defect.

**The run needed an M-C alignment rule.** `data/protocol-events.json` is derived from the M-B checkout
and `game_differential.js` refuses to align an M-C run against it (correctly). `engine/derive_protocol_events.js`
gains `--out <path>`, and the M-C derivation was written to the scratchpad (91 events, 46 emitted, 48
declared, 10 partial, both gates pass). **An M-C `protocol-events` artifact is owed** before any M-C
figure.

**Adding `--out` moved the deriver's digest, and every M-B differential then refused** —
`data/protocol-events.json` stamps the deriver it came from, and `game_differential.js` rejects a list
whose deriver has changed. Caught by the suite (every steering test failed at the child), not by
reasoning. `data/protocol-events.json` was re-derived against the pinned M-B checkout: **3 lines differ —
`generated`, and the two `source_digests`**; the event lists are identical. (Its `medicham2-browser.js`
digest was already stale at base, `50bc0ebd5e12` → `1e35c4df04aa`, which the driver does not check.)
The M-B lattice AFTER arm in §3 ran before this edit, on the original artifact.

## 5. Findings on the way, not fixed here

1. **A frozen `regulation.js` announces a false `OVERRIDDEN`.** Loaded out of `data/releases/<id>/`,
   its `checkoutCandidates()` resolve relative to the release directory, so the M-C checkout the live
   copy already put in `SHOWDOWN_PATH` does not match any candidate, and the second banner line reads
   `OVERRIDDEN by SHOWDOWN_PATH=…pokemon-showdown-mc`. The checkout that runs is the right one; the
   sentence is wrong.
2. **`--dump-out` does not accept an absolute path** — `game_differential.js` joins it onto the repo
   root and throws ENOENT after the games are played (exit 1).
3. **`tests/test-mc-key.js` was red at base** (`fd488ecc`): `build/build_engine_data_regmc.js` and
   `tests/test-engine-data-regmc.js` (both from 0.13.0) index a mons table outside the door. Both are
   the M-C twins of existing holders; added with reasons, and the holder ceiling raised 10 → 12 in the
   same visible diff. 21 of 21.
4. **Six M-C stones carry no mega tag** — carried from 0.13.0; confirmed here as ~9 parted games.

## 5b. The suite — nothing new is red, and two things the suite caught

Full `tests/run-all.js` in the worktree, then the failing set re-run at base `fd488ecc` (checked out
into the same worktree) and at this change, and the FAIL lines diffed: **identical, 20 of 21 red at
both** — every one environmental to a worktree (no CHOMP checkout beside it, no `data/games.ladder.jsonl`,
and until it was hard-linked in, no frozen-pool stores). `test-provenance-discovery.js` is green at
both. **No test is red because of this change.** The main tree's suite is the coordinator's to run.

Two regressions the suite caught, both fixed before this report:
1. **Adding `--out` to the protocol-events deriver stalled every M-B differential** — §4.
2. **`engine/provenance.js` lost the writer of `data/engine-release.json`.** It attributes the pointer
   to `engine/engine_release.js` through the exact property spelling `pointer: POINTER`, and rewriting
   `store()` as a conditional expression removed it. Restored verbatim, with a comment saying why.

## 6. Reproduction

```bash
node tests/test-regulation-table.js                       # 18 clauses, each regulation in its own child
node tests/test-engine-release.js                         # 80 of 80
node tests/test-engine-data-regmc.js                      # 15 of 15
node tests/test-mc-key.js                                 # 21 of 21
ABRA_REGULATION=regmc node -e "require('./engine/regulation.js'); require('./data/engine-data.js'); console.log(Object.keys(MC.mons).length)"   # 382
node -e "require('./data/engine-data.js'); console.log(Object.keys(MC.mons).length)"                                                       # 322
```
