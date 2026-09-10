# 2026-09-10 — MEASURE: the pre-commit hook on a fresh clone (ROADMAP #554, review finding 4)

Historical findings record; not maintained, superseded by the register rows it feeds. Nothing committed,
no game played, `status.js`, `run-all`, the differential and the roster were not run (another agent held
the heavy chain). Every red and green below was produced in a clean sibling worktree of `origin/main`
at `48b26d01` (`C:/Users/willj/Projects/Pokemon/ABRA-wt-hook`, detached, `core.autocrlf=true` as on this
machine), removed afterwards; no branch was created. The sibling path let `engine/showdown_path.js`
resolve `../pokemon-showdown` — check D of the bundle gate opened the format dex there.

**Verdict.** The hook is green on a fresh clone of the patched tree **once one data-only commit lands**:
24 of the 27 tracked releases have never been committed as their manifests say (LF-normalised blobs),
and the new clause that sees it is red on the laptop too, by design. Command and cost in §1.

## Files changed (four, all owned)

| file | change |
|---|---|
| `tests/test-artifact-rerunnable.js` | asks git what it carries once; splits ABSENT-ON-THIS-MACHINE from STRANDED; new clause hashes the COMMITTED blobs of every tracked release against its manifest; `--stamp` refuses while anything is absent |
| `engine/artifact_audit.js` | check C's mtime comparison removed; prints that content is judged by B and G |
| `.githooks/pre-commit` | bundle-gate comment records why the mtime clause is gone (comment only) |
| `build/build_archive_index.js` | strips CR on every read and on the `--check` comparison, via `engine/docs_scan.js`'s `stripCR` |

Not touched: `tests/test-docs-current.js` (its archive-index clause shells to the builder and passes once
the builder is right), `engine/showdown_path.js`, everything on the do-not-touch list. Silent-catch gate on
the three `.js` files: `no new silent catch blocks in 3 file(s)`.

## 1. `tests/test-artifact-rerunnable.js` — ABSENT is not STRANDED

**Red, clean checkout, HEAD bytes** (exit 1):
`99 stamped artifact(s) over 38 release(s): 9 re-runnable, 0 retired, 2 unknown-producer, 88 STRANDED and
undeclared` — 78 of them `ENOENT ... data/releases/<id>/release.json` (release directory not on the clone,
`data/releases/` is gitignored) and **10 of them `release <id> has been MODIFIED since it was cut` on five
TRACKED releases** (`d3d04b669e18`, `6e43710396db`, `3932186b59ef`, `6b0e4117d964`, `4c73f9cafa4b`). The
ratchet clause failed with 88 NEW names.

**The second cause was not in the brief and is the one that matters.** The five tracked releases were
force-added in August under `core.autocrlf=true`, before `data/releases/** -text` existed in
`.gitattributes` (landed `71771f0b`, 2026-09-09). Git normalised their blobs to LF; the manifests digest the
CRLF bytes `cut` copied from the working tree. On the laptop:

```
git ls-files --eol -- data/releases        27 i/crlf w/crlf | 207 i/lf w/crlf | 389 i/lf w/lf | 53 i/none
git ls-files -s  -- data/releases/6e43710396db/engine/medicham2-browser.js   -> b10908e5...  (index blob, LF)
git hash-object --no-filters data/releases/6e43710396db/engine/medicham2-browser.js -> b763c060...  (disk, CRLF)
git status --short -- data/releases/6e43710396db                              -> (clean — stat cache)
```

So `verify()` passes here, `git status` says nothing, and **no check that reads the working tree can see it
from this machine.** Hashing the committed blobs can. Of 27 tracked releases with a tracked `release.json`
(29 directories; two are pruned by decision — `55c7a0f19c86`, `5fc1f711a0e3` — and are counted, not
accused), **24 do not hash to their manifests in git**; the 3 that do (`7d66b526659e`, `b730e44f3314`,
`b0f5c159c46e`) were committed after `-text` landed.

**The change.**
- `gitTracked()`: one `git ls-files -s -z -- data/releases data/*.json` → tracked release ids, blob id per
  tracked release file, tracked artifact set. If git cannot be asked, the split is NOT made (old,
  over-accusing verdict) and the reason is printed.
- `judge()`: on an open failure, `!onDisk && !tracked` → `ABSENT-ON-THIS-MACHINE` (own band, own count,
  grouped by release, not in `bad`, not in the ratchet). Anything else → `STRANDED` with a suffix naming
  where it stands: `[TRACKED in git — broken on every clone]` / `[on this disk, untracked]`.
- New check 5b: manifests and blobs of every tracked release streamed through one `git cat-file --batch`
  (measured 2.7 s for 676 files, 94 MB; 0.24 s to sha256 them), compared 12-hex to the manifest. Pruned
  manifests skipped and counted. Fails by name with the fix command.
- Printed every run: `git tracks N release(s) ... M TRACKED artifact(s) name a release that is NOT tracked
  (re-runnable here, absent on every other clone)` — #554's option 1 as a number: **85** on the laptop.
- `--stamp` refuses while any artifact is ABSENT (a floor written on a clone would read as a regression
  where the releases are); the "ratchet TIGHTENED, re-stamp" note is suppressed for the same reason.

**After, clean checkout, patched test, HEAD data** (exit 1 — both reds are about the repository, not the
machine): `9 re-runnable, 0 retired, 2 unknown-producer, 10 STRANDED and undeclared, 78 absent on this
machine` over 30 absent releases; `FAIL the COMMITTED bytes ... 24 of 27 tracked release(s) BROKEN IN GIT`;
`FAIL no artifact became unre-runnable ... NEW: exploit-step-probe.json ... [TRACKED in git — broken on
every clone]` (10 names, all on the five releases).

**After, with the fix simulated in the worktree** (the laptop's CRLF copies of the 24 releases copied in
and `git add -f`-ed into the worktree's own index — 207 files; those blobs are exactly the ones the real fix
writes) — exit 0:

```
99 stamped artifact(s) over 38 release(s):  13 re-runnable, 0 retired, 8 unknown-producer, 0 STRANDED and undeclared, 78 absent on this machine.
ok    the COMMITTED bytes of every tracked release hash to its manifest (what a clone will get)   (27 tracked release(s), 622 committed file(s) hashed against their manifests, 2 pruned (manifest only, by decision))
ok    no artifact became unre-runnable since the baseline   (0 known, was 1)
ALL GREEN — 6 checks.
```

**Laptop, patched test, current index** (exit 1, as intended): 5 of 6 ok, `1 STRANDED` (nature-arms.json,
the grandfathered one, `1 known, was 1`), `0 absent`, and `FAIL ... 24 of 27 tracked release(s) BROKEN IN
GIT`. **The hook is red on this machine until the fix below is committed.** That is the check doing its job
on the only machine that can fix it.

**THE FIX (coordinator, data-only commit, run here where the working copies verify):**

```
git add --renormalize -- data/releases/032b4a2979dd data/releases/0771dc47b5f6 data/releases/09acd3b404ef data/releases/0aa54cb1a9de data/releases/128a1ca28d34 data/releases/1e29ff6c431b data/releases/1fc6e384fa6e data/releases/26f96c7894d7 data/releases/28e66a7c9ab8 data/releases/3932186b59ef data/releases/3fd06d865427 data/releases/41e28311e591 data/releases/45485dee6a43 data/releases/46014cb0067d data/releases/4c73f9cafa4b data/releases/6b0e4117d964 data/releases/6b6f898f136f data/releases/6e43710396db data/releases/86048ca3a422 data/releases/9491abe09f54 data/releases/cf6a68fa412c data/releases/d3d04b669e18 data/releases/dc3c43336539 data/releases/dd3da7c69cb0
```

Dry-run here lists 586 paths (everything under the 24 dirs); 207 blobs actually change (`i/lf w/crlf`).
Cost: `tar | gzip -6` of the 24 directories is **16.3 MB**; git's delta compression across 24 near-identical
`medicham2-browser.js` copies should land well under that. The alternative — untracking the 21 uncited
ones — is a decision, not this division's; the 5 cited ones must be renormalised either way or 10 tracked
artifacts stay un-re-runnable everywhere but here. The test prints the command on every red.

**Deliberate break** (worktree, after the simulated fix): appended `/* deliberate break */` to
`data/releases/7d66b526659e/engine/board.js` and staged it. Exit 1:
`7 STRANDED [TRACKED in git — broken on every clone]` (all-mechanics-fire, engine-diff, game-differential,
roster.{,abilities,items,moves}.json); `FAIL the COMMITTED bytes ... 1 of 27 ... 7d66b526659e: engine/board.js
committed e37aed706481, manifest c85a3b756c98`; `FAIL no artifact became unre-runnable ... NEW: engine-diff.json
...`. Restored with `git checkout HEAD -- <file>`; `verify('7d66b526659e').ok === true`.

## 2. The bundle gate's mtime clause — dropped, not replaced

**Red, clean checkout** (`node engine/artifact_audit.js`, exit 1): `GAP data/engine-data.js is older than
source mega-dex-official.json and builder engine/merge_mega_into_engine.js` — on bytes identical to a commit
that passed the same gate; every other clause ok, including G: `data/engine-data.js is what
build/build_engine_data.js would write from CHOMP/engine/champ-model.js`.

**Why dropped rather than replaced with content.** The content comparisons for this exact pair already run
in the same file: check B holds every value `mega-dex-official.json` carries against the artifact field by
field (that IS the staleness question asked of the bytes), and check G runs the builder the artifact declares
in its own header with `--check`. `engine/merge_mega_into_engine.js` has no `--check` and is not re-run by
anything; B is the content clause for what it writes. A third comparison of one fact is the
two-implementations failure. `provenance.js` took the same step in August. Check C now prints one line per
source naming B and G and keeps the old NOTE, extended: older is not proof of stale either.

**Green:** exit 0 in the clean checkout and in the main tree, same bytes. **Deliberate break** (worktree):
one byte appended to `data/engine-data.js` → `GAP data/engine-data.js is NOT what build/build_engine_data.js
would write`, exit 1 — the content gate that guards this pair fires; restored.

## 3. The archive-index clause — CRLF, and a WRONG index, not a line-ending diff

**Red, clean checkout:** `build/build_archive_index.js --check` → `docs/archive/INDEX.md is STALE`;
`tests/test-docs-current.js` 34/1 on that one clause. Main tree, identical tracked bytes: current, 35/0.

**Cause.** `core.autocrlf=true`: a fresh checkout of `docs/archive/*.md` is CRLF (`file` confirms); the
laptop's copies are LF. In JavaScript `.` does not match `\r`, so the header pattern
`^\s*-\s*\*\*([^:*]+):\*\*\s*(.*)$` cannot reach its `$` on a CRLF line and **every header field is
lost**. Rebuilding in the clone gave `24 documents, 0 declared, 24 undeclared, 0 carrying a retracted
figure` against `16 declared, 8 undeclared, 6 retracted` here — the retraction section became `None.`
That is the failure this repo already met in `docs_scan.js` (the owed counter stuck at 0 for a day).

**The change.** Every read of an archived file and of the existing `INDEX.md` goes through
`engine/docs_scan.js`'s `stripCR` (one implementation of "a CR is not content"; the module is
side-effect-free on require, 4 ms); the comparison is on stripped text; the write stays LF and git
normalises on commit as before. **`INDEX.md` does not change** in the main tree — `--check` is current and
`git diff` is empty — so nothing to commit there.

**Green:** clean checkout `--check` → `docs/archive/INDEX.md is current (24 documents, 8 undeclared)`;
`tests/test-docs-current.js` **35 passed, 0 failed** in the clean checkout. **Deliberate break:** one
archived `Claimed:` field edited in the worktree → `STALE`, exit 1; restored → current.

## 4. The whole hook, clean checkout, staged change

Staged: the four files above (test, audit, hook, builder) + a RUNNING-NOTES row (worktree copy only) + the
207 renormalised release files. `sh .githooks/pre-commit`, 9.6 s wall:

```
pre-commit: silent-catch gate on 3 staged .js file(s) (~0.7s)
pre-commit: generated-bundle gate (~1.6s) -- every data/*.js against the source it declares
pre-commit: running-notes gate -- every change records a row in docs/RUNNING-NOTES.md
pre-commit: living-docs gate (~2s)
pre-commit: green
```

Worktree removed (`git worktree remove --force`, `prune`); no branch existed. Side effect stated: the
`git add` in the worktree wrote ~207 loose blobs into the shared object store (`count-objects`: 460 loose,
139 MB, not all mine). They are byte-identical to what the renormalise commit writes, so they become
reachable when it lands; otherwise `git gc` reaps them after the grace period. Nothing was deleted.

## Observed, not acted on

- **Local `main` is 1 commit behind `origin/main`** at the time of writing (`rev-list --left-right --count
  main...origin/main` → `0 1`). Pull before committing.
- `git add -- data/releases/<tracked-dir>` stages the tracked files AND exits 1 with the ignored-path hint;
  the test's printed fix uses `--renormalize` on directories, which behaves the same — add `-f` if a script
  reads the exit code.
- `engine/showdown_path.js` under `.claude/worktrees/<name>/` resolves `../pokemon-showdown` to
  `.claude/worktrees/pokemon-showdown`, which does not exist, and falls back to `/tmp/ps`. Not touched. A
  third candidate derived from `git rev-parse --git-common-dir` would fix it; owed, not this pass.
- 85 tracked artifacts name an untracked release (printed every run now). #554's option 1 — track them or
  re-run them on a tracked release — is a decision; the count is the instrument for it.
- The re-runnable band moved 9 → 13 and unknown-producer 2 → 8 in the clean checkout once the five
  releases opened; nothing about those artifacts changed, the release did.

## Proposed texts (not written — coordinator commits)

**RUNNING-NOTES row** (exactly as staged in the worktree; goes under `[Unreleased]`):

> ## [Unreleased] — 2026-09-10 — the pre-commit hook passes on a fresh clone: ABSENT is not STRANDED, the bundle gate reads content not mtime, the archive index parses CRLF, and 24 tracked releases are committed as their manifests say
> - **What changed.** `tests/test-artifact-rerunnable.js` asks git what it carries and splits an unopenable release into ABSENT-ON-THIS-MACHINE (not on disk, not tracked — counted, not failed, not in the ratchet; `--stamp` refuses while any exist) and STRANDED (tracked or on disk and will not open — red, as before); a new clause hashes the COMMITTED blobs of every tracked release against its manifest through one `git cat-file --batch`. `engine/artifact_audit.js` check C no longer compares mtimes (B and G already judge the same pair by content); `.githooks/pre-commit` says why. `build/build_archive_index.js` strips CR on every read and compares stripped text (`engine/docs_scan.js`'s `stripCR`). Account: `docs/_reports/2026-09-10-fresh-clone-hook.md`.
> - **Measured.** Clean worktree of `origin/main` (`48b26d01`): before, `test-artifact-rerunnable.js` 88 STRANDED of 99 (ENOENT), `artifact_audit.js` 1 GAP (mtime), `build_archive_index.js --check` STALE with the CRLF checkout parsing 0 of 16 declared headers; after, 78 absent / 0 stranded / 6 of 6 green once the 24 releases are renormalised, 0 GAP, index current, `test-docs-current.js` 35/0. Laptop: `git ls-files --eol -- data/releases` 207 files `i/lf w/crlf` — 24 of 27 tracked releases (2 pruned) have never hashed to their manifests in git. NO FIGURE about the game.
> - **Basis.** unchanged.
> - **Supersedes.** Nothing.
> - **Owed to the next major.** `docs/ABRA-technical-docs.md` (the release-store section: what a tracked release guarantees, and the ABSENT band).

**CHANGELOG bullets** (PATCH by the repo's own rule — no published figure moves):

> ### Fixed
> - The pre-commit hook passes on a fresh clone (#554). `tests/test-artifact-rerunnable.js` reports a release that is neither on disk nor tracked as ABSENT-ON-THIS-MACHINE — a fact about the clone, counted and not failed — and keeps STRANDED for a release git carries and cannot serve; a new clause hashes the COMMITTED bytes of every tracked release against its manifest and found 24 of 27 normalised to LF in August, before `data/releases/** -text` existed. `engine/artifact_audit.js` check C no longer compares mtimes (a clone gives every file the checkout time; B and G already compare content). `build/build_archive_index.js` strips CR, so a CRLF checkout no longer rebuilds the index with every header field lost.
> ### Changed
> - The 24 tracked releases are re-added with their real bytes (`git add --renormalize`), 207 files; a clone can now open them.

**ROADMAP #554 closure text:**

> **CLOSED 2026-09-10 BY MEASURE.** All three clauses shown red in a clean sibling worktree of `origin/main` (`48b26d01`), green after, and red again on a deliberate break each: (1) `tests/test-artifact-rerunnable.js` splits ABSENT-ON-THIS-MACHINE (78 artifacts over 30 untracked releases on the clone — counted, not failed, not ratcheted; `--stamp` refuses while any exist) from STRANDED (10 artifacts on 5 TRACKED releases that read MODIFIED on the clone — red, kept). **The five were the visible edge of a wider defect this row did not predict:** 24 of the 27 tracked releases were force-added under `core.autocrlf` before `data/releases/** -text` (`71771f0b`) and their committed blobs are LF while their manifests digest CRLF — `git ls-files --eol` 207 files `i/lf w/crlf`, stat-clean on the laptop so `git status` and `verify()` say nothing. A new clause hashes the COMMITTED blobs via `git cat-file --batch` (~3 s) and is red BY NAME here until `git add --renormalize` over the 24 lands (data-only; ≤16.3 MB gzipped, less with deltas). (2) `engine/artifact_audit.js` check C's mtime clause is dropped: B and G already judge the pair by content, and `.githooks/pre-commit` records why. (3) `build/build_archive_index.js` strips CR on every read — the CRLF checkout had rebuilt the index as 0 declared / 24 undeclared / 0 retracted against 16 / 8 / 6, a wrong index rather than a line-ending diff. Whole hook green in the clean worktree in 9.6 s. Left open, printed every run: 85 tracked artifacts name an untracked release (option 1). `engine/showdown_path.js` under `.claude/worktrees/` still falls back to `/tmp/ps` — owed. Account: `docs/_reports/2026-09-10-fresh-clone-hook.md`. VERIFIED BY: `tests.yml` on the commit that carries the renormalise — the first receipt from a machine that is not this one.

**MEASURE.md ledger paragraph** (outside the GENERATED block; one paragraph):

> ## THE HOOK COULD NOT PASS ON A FRESH CLONE, AND THE PART THE BRIEF NAMED WAS THE SMALLER HALF — 24 OF 27 TRACKED RELEASES HAVE NEVER BEEN COMMITTED AS THEIR MANIFESTS SAY. 2026-09-10, ROADMAP #554
> Clean worktree of `origin/main`: 88 of 99 artifacts STRANDED (78 on releases absent from the clone, 10 on five TRACKED releases reading MODIFIED), the bundle gate's mtime clause red on identical bytes, the archive index rebuilt with every header field lost by CRLF. `tests/test-artifact-rerunnable.js` now asks git what it carries and counts ABSENT apart from STRANDED, and hashes the COMMITTED blobs of every tracked release: 24 of 27 were LF-normalised on force-add before `-text` existed and hash to nothing their manifests say — invisible from this machine because the working copies are CRLF and stat-clean. Red here by name until `git add --renormalize` over the 24 lands. Check C of `artifact_audit.js` compares nothing by mtime any more; `build_archive_index.js` strips CR. Whole hook green in the clean worktree, 9.6 s. Account: `docs/_reports/2026-09-10-fresh-clone-hook.md`.

## OWED, NOT RUN

- **The renormalise commit** (§1) — coordinator, data-only, on this machine. Until it lands the patched
  hook is RED here on the committed-bytes clause, by design.
- `node engine/status.js --write` — forbidden this pass; the MEASURE block is stamped to an earlier pass.
- `tests.yml` on the commit that carries the renormalise — the first receipt from a second machine.
- `engine/showdown_path.js` third candidate for `.claude/worktrees/` (derive from `git rev-parse
  --git-common-dir`); the fallback message is unchanged.
- #554 option 1: 85 tracked artifacts naming an untracked release — track or re-run; the count is printed.
- `tests/run-all.js`, the differential, the roster, `quarantine.js` — not run, not asked for.
- Timing of the full `test-artifact-rerunnable.js` run on the laptop with the new clause (the clause alone
  measured ~3 s; the whole file was not timed against a before).
