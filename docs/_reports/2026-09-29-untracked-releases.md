# The first Reg M-C provenance ratchet: two releases tracked, one self-reference fixed

2026-09-29, MEASURE. abra/regmc 1.25.3. Plays no games. No gate, differential or roster was run.

## Verdict

- `ABRA_REGULATION=regmc node engine/provenance.js` now **exits 0**. RULE 5 prints: *every release cited by an artifact a
  published document names is in the repository.*
- Two release snapshots are force-tracked: `data/releases/eaa5becc54eb/` (the release the Reg M-C gate opened on, 1.0.0)
  and `data/releases/4067de46a0ee/` (the current tree release that the gate artifacts were re-run on). Both **verify and
  open from a checkout of the index bytes** (details below).
- `78fb4a85b1a0` is **not** tracked. Only two division-ledger citations name it (see §4).
- A second defect was found and fixed. The first Reg M-C stamp could not list itself, so **the second run always failed
  the ratchet**. The fix is in `engine/provenance.js`, and it was shown red before the fix and green after.
- `data/provenance-stamp-regmc.json` is committed.

## 1. Reproduced before any change

The run was in a worktree at `d8515ccf`, through `tools\lownode.cmd` (BELOWNORMAL) with `NODE_OPTIONS=--max-old-space-size=4096`.
It exited 1. There were 12 artifacts on the hard arm, the same set as in the main-checkout run in the brief:

- 8 Reg M-C gate artifacts point to `4067de46a0ee`. `whole-game-baseline-regmc.json` points to `eaa5becc54eb`. They are
  cited by ABRA-technical-docs, ABRA-whitepaper, MODELS, SUMMARY, REGMC and REGULATION-ROTATION.
- `engine-diff.json`, `game-differential.json` and `roster.items.json` also point to `4067de46a0ee`. They are cited by
  ADR-002, DAMAGE-STAGES, GAME-DIFFERENTIAL-DESIGN and REGULATION-ROTATION.

## 2. Why the Reg M-B-named files point at a Reg M-C release: the checker's labelling, not the files

The files on disk are not mislabelled. Their own stamps say `engine_release: fb8073869b72`, and
`roster.items.json` says `regulation: gen9championsvgc2026regmb`. The string `4067de46a0ee` does not occur in any of the
three files.

What happens is this. Under `ABRA_REGULATION=regmc`, the artifact seam in `engine/regulation.js` (`ARTIFACT_TAG`, the fs
redirect) serves every per-regulation read of `data/<name>.json` from `data/<name>-regmc.json`. The run prints this
itself: *"Reg M-B's unsuffixed files are never read or written"*. `provenance.js` keys `PUBLISHED_BY` on the name a
document cites, which is the unsuffixed Reg M-B name. It then reads that name and gets the Reg M-C file's content.

So a Reg M-C run reports Reg M-B documents as citing Reg M-C releases. The same aliasing produces the ledger-arm rows
`all-mechanics-fire.json`, `roster.abilities.json`, `roster.moves.json` and `whole-game-baseline.json`.

**Consequence: a clean Reg M-C RULE 5 says nothing about Reg M-B's chain.** The Reg M-B files really cite
`fb8073869b72`, which is not tracked either. Reg M-B is retired, so this is recorded and was not fixed here. See OWED.
Ideally, under a regulation, the checker would attribute a document's citation only to the file the document names.

## 3. The two releases: size, the 100 MB wall, line endings, fresh-checkout verification

| | eaa5becc54eb | 4067de46a0ee |
|---|---|---|
| files | 35 (33 in the manifest + `release.json` + `cuts.jsonl`) | 35 |
| largest file | `engine/medicham2-browser.js` 4,268,873 B | `engine/medicham2-browser.js` 4,280,561 B |

- **On disk:** 18,964,210 bytes for the two together (`du -cb`), about 9.5 MB each. The "~6.8 MB" in the tool's message
  is older than these releases.
- **Growth budget:** 70 paths, 38 distinct blobs. 27 of those blobs are already in HEAD, from earlier tracked releases
  and the live tree. **11 blobs are new: 9,768,583 B raw and 3,709,788 B zlib-compressed as loose objects.** The pack
  cost is at most about 3.7 MB, and less after delta compression against the earlier `medicham2-browser.js` blobs. The
  largest single file is 4.3 MB, about 4% of the 100 MB wall. History is permanent, so this is paid once.
- **Line endings:** `.gitattributes` already carries `data/releases/** -text` (MEASURE, 2026-09-09, after
  `b730e44f3314` stopped opening). `git ls-files --eol` on the 70 staged paths gives 26 `i/crlf w/crlf`, 38 `i/lf w/lf`
  and 6 `i/none`. Every path is `attr/-text`, so the index holds the raw bytes, CRLF included.
- **Fresh-checkout proof:** `git checkout-index --prefix=<scratch>/fresh/` wrote the staged bytes as a checkout would.
  After that:
  - `engine_release.verify(id, {store: <scratch>/fresh/data})` returned `ok` for both, 33 of 33 manifest digests.
  - `engine_release.open(id, {store})` then `.require('engine/medicham2-browser.js')` loaded for both (107 exports).
  - The stamp matched the id.
  - The live copies in the worktree also verified: `engine_release.js verify <id>` → `intact`.
- **Why these two and not a re-run or a de-citation:**
  - Re-running the gate artifacts is heavy and was ruled out for tonight, because a SOLVER agent is playing games.
  - The gate artifacts carry the 1.0.0 headline, which is the Reg M-C gate result, so they cannot stop being cited.
  - `eaa5becc54eb` is also the pin for every SOLVER arena figure (CHOMP v1's gates run on it). Tracking it closes that
    chain too.
- Note: `cuts.jsonl` is appended on every re-cut of identical bytes. A later re-cut in main will therefore show these two
  as modified tracked files. This is expected, and it does not affect `verify`, which reads only the manifest's files.

## 4. `78fb4a85b1a0` was not tracked

With main's untracked roster `.prev` files present, the run names it only on the DIVISION-LEDGER arm:

- `data/roster.abilities.prev.json` → `78fb4a85b1a0`, cited by `docs/ENGINE.md`
- `data/roster.moves.prev.json` → `78fb4a85b1a0`, cited by `docs/ENGINE.md` and `docs/MEASURE.md`

Both are the same regmc aliasing: they are served from `roster.*.prev-regmc.json`, which are untracked "previous run"
files. No living document needs this release, so it is not tracked. The rows are reported and not enforced.

## 5. The second defect: the first stamp of a regulation cannot name itself

This is how the self-reference makes the second run fail:

- `provenance-stamp.json` is in the artifact graph (`graph_files`) and carries no `source_digests`. Once it exists, it
  therefore rests on mtime alone.
- On the run that first writes a regulation's stamp, the file does not exist yet, so it is absent from
  `mtime_only_files`.
- The next run sees an in-graph artifact that is newly mtime-only and prints `RATCHET BROKEN: provenance-stamp.json`.
  The exit code is 1, and the stamp is not rewritten, so **every later run fails too.**

Reg M-B's stamp already lists itself.

- **Red, before the fix:** run 1 exited 1 (RULE 5, before the releases were tracked) and wrote the stamp. Run 2, with the
  releases tracked, **exited 1 and named only `provenance-stamp.json`.**
- **Fix:** `writeStampFile` in `engine/provenance.js` adds `provenance-stamp.json` to the list when no stamp existed at
  the start of the run (`!prev`) and the file is in the graph. It changes nothing for Reg M-B (the stamp there exists and
  already lists itself) and nothing on any run after the first.
- **Green, after the fix:** the stamp was moved aside to scratch and the command run twice more. Both runs exited 0.

## 6. What the committed stamp describes

The worktree has no store (`data/games.ladder.jsonl` is absent, so the CLEAN count is null in the printed table). Those
figures are not in the stamp. The stamp holds lists.

A stamp taken on a bare clone would omit files that exist only in main, as untracked files. The ratchet would then fail
on main's next run: `engine-release.json`, which is `data/engine-release-regmc.json` under the seam, would become newly
mtime-only. To avoid that, main's untracked graph files were **copied** (not committed) into the worktree before the final
two runs:

- `engine-release-regmc.json`
- `roster-regmc.json`
- `roster.{abilities,items,moves}.prev-regmc.json`
- `diff-team-pool{,-regmc}.json`

Compared with the stamp main wrote at 08:00Z, the committed stamp differs in exactly two ways:

- It adds `provenance-stamp.json` (the fix).
- It omits `_scratch-bench-smoke.json`. That file is untracked debris in main, dated 2026-08-28. It was **left in
  place**. On main's next run it reads as COVERAGE GREW, which exits 0.

The final run printed: 77 UNSAFE, 2 VOID (declared), 93 possibly stale, 106 ok, 11 missing. The UNSAFE count is the
existing table and is not part of this change.

## 7. Left alone, reported

- The main checkout's untracked `data/provenance-stamp-regmc.json` (08:00Z) was not touched. After main pulls, git will
  refuse to overwrite an untracked file of the same path. Whoever pulls in main should move that file aside first. It is
  superseded by the committed one.
- `data/_scratch-bench-smoke.json` and `_scratch-scovillain-dump.json` in main look like debris. They were not deleted.
- `data/engine-release-regmc.json` (the Reg M-C pointer) is untracked in main, while Reg M-B's `engine-release.json` is
  tracked. This was not changed. Whether to track it is a separate decision.

## OWED, NOT RUN

In the MAIN checkout, after pulling this commit. Move the untracked stamp aside first:

```
move data\provenance-stamp-regmc.json %TEMP%\provenance-stamp-regmc.main-0800Z.json
git pull --ff-only
set ABRA_REGULATION=regmc
set NODE_OPTIONS=--max-old-space-size=4096
tools\lownode.cmd engine/provenance.js
```

The expected result is exit 0, RULE 5 clean, and COVERAGE GREW naming `_scratch-bench-smoke.json` only.

The Reg M-B chain, which is **retired** and should run only if Will wants the Reg M-B figures kept re-openable:

```
node --max-old-space-size=4096 engine/provenance.js
```

This rewrites the tracked `data/provenance-stamp.json`. Expect RULE 5 to name `fb8073869b72`, the stamp of
`engine-diff.json`, `game-differential.json` and `roster.items.json`. The fix would be `git add -f
data/releases/fb8073869b72`, if that release is still on disk in main.
