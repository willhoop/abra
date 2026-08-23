# Silent catch blocks: the ratchet is wired to the commit — 2026-08-23 (MEASURE)

Will: *"i dont know im not comp sci guy just fix it so it stops being a problme."*
And: *"i dont want unncessary bloat or you adding gates or tests on gates or tests that fail, just
simple bulletproof fixes."*

No new test and no new gate was created. An existing instrument was connected to something that can
say no.

---

## The problem

`tests/test-no-silent-failure.js` finds new silent catch blocks in 0.68s, is a proper ratchet (keyed
by a hash of each catch **body**, so moving code does not fool it), and was **connected to nothing** —
not to `.githooks/pre-commit`, and (measured) **not to `tests/run-all.js` either**. It printed into
the void, so writing a silent catch carried no consequence at the moment it was written, which is the
only moment that matters. The count went **67 -> 95 in four days**.

## What changed — two files

| File | Change |
|---|---|
| `tests/test-no-silent-failure.js` | one new flag, `--only <file>...` |
| `.githooks/pre-commit` | runs it over the `.js` files of the commit being made |

**`--only` narrows the VERDICT, not the DETECTION.** The scan is unchanged and still repo-wide; the
flag filters its output to the named files and judges those against the same baseline, by the same
per-file catch-body-hash counts. There is exactly one detector — `catches()`, `isSilent()`, `hash()` —
and the flag calls it. No second implementation, which is the standing failure mode here.

No re-baseline. `data/silent-catch-baseline.json` is **not written** by any of this. The whole-repo
run still reports every one of the 80 (verified before and after: `201 baselined / 80 NEW / 28 of
them manufacturing`, identical).

### The correction that made it usable — pre-existing means HEAD, not the baseline

The first version compared only against `data/silent-catch-baseline.json`. Measured against the live
tree, it **refused the next commit**: 9 blocks in `engine/medicham2-browser.js` and `engine/tag_dex.js`
that the author never touched. They are pre-existing in the file but not in the baseline, because the
baseline was set 2026-08-18 and 80 have landed since with nothing enforcing it.

A gate that blocks unrelated work is a gate people route around with `--no-verify`, and then nothing
is enforced at all. So a block counts as pre-existing if **the baseline covers it OR HEAD's copy of
the file already had it**. HEAD's copy is measured with the same detector (not by diffing patch text,
which would read a moved block as an addition and a reindent as a rewrite).

This launders nothing. The 80 stay on the books in the whole-repo run and in `--in`. The gate asks
one question only: *did this commit make it worse.*

## The five demonstrations

Run in throwaway git repos under the session scratchpad (`.../scratchpad/hookdemo`, `hookdemo2`),
never against the shared index — another agent is live in the tree. Each repo held a copy of the
hook, the test, the real baseline, and `engine/board.js`, which carries **14 baselined** silent
catches plus **1 deliberately committed unbaselined one** standing in for the 80.

| # | Situation | Required | Observed |
|---|---|---|---|
| 1 | commit ADDS a new silent catch | refuse | **exit 1**, named `engine/board.js:4511 HANDS BACK A MADE-UP VALUE return null;` — and it did *not* name the unbaselined block two lines above it |
| 2 | same file, planted block removed, a real edit staged | pass | **exit 0**, `pre-commit: green` |
| 3 | unrelated edit to a file holding a **non-baselined** pre-existing silent catch, inserted at the TOP so every catch line number shifts | pass | **exit 0** — while `--in` still lists that block as `NEW` in the repo-wide ledger. This is the one that matters, and it is the one the first design failed |
| 4a | data-only commit (`data/*.json`) | skip | **exit 0**, gate did not run |
| 4b | `rebase-merge` present, new silent catch staged | skip | **exit 0**, `pre-commit: rebase in progress — skipping`. **Control:** the identical change with no rebase in progress -> **exit 1** |
| 5 | brand-new file whose only content is a silent catch | refuse | **exit 1**, `(no copy in HEAD, so every block in it counts as new)` |

Demonstration 4b's control matters: without it, "the rebase skip works" is indistinguishable from
"the gate never fires on that file".

## Speed

| Staged files | Time |
|---|---|
| 2 files | 0.74s (738 / 744 / 757 ms) |
| 4 files, including the two largest in the repo | 0.89s |

The whole hook was ~2s; it is now ~2.7-2.9s on a code commit and **unchanged (0s added) on a
data-only commit**, because the gate does not run at all there.

## What a developer sees when it refuses

The exact file and line, whether the block hands back a made-up value or merely skips, and then plain
words: what a silent catch means, the two real cases it caused in this project (every status duration
becoming the fallback 3; a failed 1.59 GB read reported as "no records read"), and three concrete
fixes — rethrow, `console.error`, or `MEDFAILS.somethingFailed++`, named as the counter the simulator
already uses. It also states that only the files in this commit are checked, so pre-existing blocks
are not the author's problem. No `--no-verify` escape hatch is offered or advertised.

The gate also **announces itself when it runs** (`pre-commit: silent-catch gate on N staged .js
file(s)`), because a gate that passes in silence is indistinguishable from one that skipped.

## What this CANNOT catch — plainly

- **It reads the WORKING TREE, not the staged blob.** If you stage a clean version of a file but the
  file on disk still holds a new silent catch, the commit is refused (conservative, fine). The hole is
  the reverse: stage a bad version, then fix it on disk without staging, and the gate passes.
- **A rename looks like a new file.** `git show HEAD:<newpath>` finds nothing, so every silent block
  in a renamed file counts as new and must be `--accept`ed or fixed. Rare, and it fails strict.
- **Only the top level of `engine/`, `build/` and `tests/`** is checked, because that is exactly what
  the scanner walks. Anything under `web/`, `tools/` or a subdirectory is not covered by the scanner
  and therefore not by this gate.
- **A rebase replay is not checked at all** — deliberately, and the same is true of the other three
  gates in the hook.
- **It cannot judge whether a silence is CORRECT.** It only asks whether the block says something.
  A `console.error('')` would satisfy it. It is a ratchet against a habit, not a proof of handling.
- **The 80 pre-existing offenders are not fixed by any of this.** They remain, they remain reported,
  and they are still real defects. This only stops the number climbing.
- **If `node` or `git` is unavailable the commit is refused**, not waved through. That is the right
  failure direction, but it is a failure mode worth knowing about.

## Not done, deliberately

- **`tests/run-all.js` registration was NOT added.** The whole-repo run exits 1 on the 80 pre-existing
  blocks, so registering it would put a red test in the suite — exactly what Will ruled out.
- **`node engine/status.js --write` was NOT run.** An ENGINE agent is live and owns `docs/ENGINE.md`,
  `CHANGELOG.md` and the sprint notes; restamping generated blocks underneath a live writer is the
  hazard CLAUDE.md names. The coordinator should run it after ENGINE lands.
- **No CHANGELOG entry** (the coordinator's, by the brief), and **nothing was committed.**

## One thing the coordinator must know before committing

The hook's SPRINT clause is unchanged and still fires: a commit touching `engine/` or `tests/` must
also touch `docs/MEDICHAM-SPRINT-NOTES.md`. This change touches `tests/`, so that commit needs the
sprint-notes row — ENGINE owns that file.
