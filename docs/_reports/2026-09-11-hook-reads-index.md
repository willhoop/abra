# The pre-commit docs gate judges the commit being made, not the working tree — 2026-09-11

MEASURE. Historical findings record; not maintained. Nothing committed or pushed.

## Verdict

`.githooks/pre-commit` now runs `tests/test-docs-current.js --staged`. Every document, artifact, the
CHANGELOG and the gate's own baseline are read **as the commit will contain them** — the index version
where staged, HEAD's where not — through one reader in `engine/docs_scan.js`. A working-tree-only
regeneration by another agent can no longer block an unrelated commit. A staged document edit with a mismatched figure still blocks. So does a staged artifact that breaks a committed document's figure. Partial staging of either is now caught, which the old gate missed. A hand run without the flag reads the working tree exactly as before. On HEAD's bytes, old and new code produce identical output.

The staged opt-plan commit passes the new hook end to end (exit 0, twice, against copies of the real
index). The real index was never written: same staged name set and same `git diff --cached` content
hash before and after.

## What changed (three files, uncommitted)

| file | change |
|---|---|
| `engine/docs_scan.js` | One reader — `rawText` / `exists` / `listFiles` — behind every read the module makes. `useIndex()` switches it to the staged tree. Every direct `fs` read site was routed through it: after the change, every `fs.` call in the file sits inside the reader block (grep, 2026-09-11). `lineCommitInstant` blames the staged text (`git blame --contents -`) in index mode. New exports: `useIndex, source, rawText, exists, listFiles, writeThrough, readerReport`. CLI accepts `--staged`. |
| `tests/test-docs-current.js` | `--staged` flag. Its own reads (slowking artifact, notes page, living-doc existence, the baseline) go through the reader. The baseline write goes through `writeThrough`. The run prints which tree it read and every path the index answered for. Clause 3c prints that it still reads the working tree. |
| `.githooks/pre-commit` | Passes `--staged` to the docs gate only. Prints the reader line on every run, green or red. |

### The reader's semantics

- **In the commit** = a stage-0 regular file in the index (`git ls-files -s -z`, which honours
  `GIT_INDEX_FILE`, so `git commit -a` / `git commit <paths>` are judged on the tree git will write —
  by construction; not demonstrated with a real `commit -a`). Untracked and ignored files are absent.
- **The disk is a cache, verified by content.** A file is read from disk and hashed as a git blob
  (as-is, then with CRLF folded, for the `core.autocrlf` checkout). If the id equals the index's, those
  are the staged bytes; otherwise `git cat-file blob`. No mtime, no `git diff` snapshot: a file
  rewritten mid-run stops matching and git answers, so it cannot be read torn.
- **Blame** uses the staged text, so a staged-but-uncommitted line is "Not Committed Yet" and is judged,
  never excused by `regeneratedAfter`.
- **The baseline write** happens only when the working-tree copy is byte-for-byte the staged blob.
  The hook's existing named `git add` then stages it. If another agent has an unstaged edit there, it
  is left alone and the write is skipped. That is safe because the write is a monotone tightening that the next
  green run re-derives.

## Evidence

All plant runs were done in a lab under the session scratchpad. The lab's working tree is HEAD's bytes
for the docs, the top-level `data/` artifacts, the CHANGELOG and the three code files. The real `.git`
is the object store and the index is a scratch one (`read-tree HEAD` plus `update-index --cacheinfo`).
The real working tree and index were not named by any plant.

"OLD hook" = HEAD's code, no flag, which is what the hook ran before. "NEW hook" = this code, with
`--staged`, which is what it runs now. The planted figure is `docs/ABRA-whitepaper.md:1696`'s `487
tested`, the incident in the brief. The artifact plant is HEAD's `data/roster.moves.json` with its
three `487` leaves changed to a value that the rule's own `artifactHas` does not match. The `generated`
stamp was kept, so only the figure moved. The document plant changes the sentence's 487 to a value the
HEAD roster does not hold.

| plant | OLD hook | NEW hook | required |
|---|---|---|---|
| clean lab, index = HEAD | green 37/37 | green 37/37 | — |
| **(1)** artifact changed in the working tree only | **BLOCKS** — `docs/ABRA-whitepaper.md:1696 487 not in … data/roster.moves.json` | **green** — reader: 1 path read from the index: `data/roster.moves.json` | must not block ✔ |
| **(2)** document edit staged (disk and index) | blocks (new citation mismatch) | **blocks**, same line | must block ✔ |
| (2b) document edit staged in the index only | **green — missed** | **blocks** | — |
| **(3)** artifact change staged (disk and index) | blocks | **blocks**, same line | must block ✔ |
| (3b) artifact change staged in the index only | **green — missed** | **blocks** | — |
| (1) with new code and **no** flag (hand run) | — | blocks, identical to OLD | worktree mode unchanged ✔ |

**Equivalence.**
- On the clean lab, OLD and NEW code in working-tree mode print identical output, apart from the wall-clock stamp lines.
- `--staged` differs from working-tree mode in one line only: the CRLF count, 84 documents CRLF on disk against 0 in the staged blobs. That is expected, because the reader returns blob bytes.
- `regeneratedAfter`'s predates count (217), the grandfather counts (2249 across 24 documents; 1334 paragraph-bound, 3817 entry-bound) and the dormant count (1) are identical in all three modes.
- The ignored `data/diff-team-pool.json`, cited by four documents, is absent from the staged tree, and that changed no verdict.

**Blame probe.** Run in index mode against a copy of the real index:
- `docs/RUNNING-NOTES.md`'s staged `[6.12.2]` heading comes back NOT COMMITTED (judged).
- The committed rows below it get the same committer instants as a working-tree blame of the same text: `[6.12.1]` 10:56:10Z, `[6.10.2]` 09:27:35Z.

**The real tree, real hook, copy of the real index** (`GIT_INDEX_FILE`, run twice, 113 s and 103 s):
`pre-commit: green`. The reader line from the second run:

> `(--staged: 3907 files in the index; 392 read from disk after their hash matched the staged blob; 21 read from the index because the working tree differs: CHANGELOG.md, data/abra-tags.js, data/all-mechanics-fire.json, data/engine-diff.json, data/engine-release.json, data/forme-assert.json, data/game-differential.json, data/mechanics-census.json, data/provenance-stamp.json, data/published-samples.json, data/roster.abilities.json, data/roster.abilities.prev.json, … +9)`

Those 21 are exactly the working-tree bytes that could previously have decided this commit.
`data/abra-tags.js` was the first of tonight's three incidents. A lab `--staged` run against the same
index copy reported "no ratchet movement", which was checked before the real hook was allowed to run,
so the gate wrote nothing. `node engine/docs_scan.js --staged --owed` reads CHANGELOG top 6.12.2 (the
staged entry). Without the flag it reads 6.14.1, from other agents' unstaged edits.

**Side effects.** `git hash-object -w` wrote the plant blobs into `.git/objects` as unreachable loose
objects. They are harmless, and `git gc` prunes them. The scratch lab and indexes are in the session
scratchpad.

## Not changed by this, and still reading the working tree

- **Clause 3c** (`build/build_archive_index.js --check`) reads `docs/archive/` from disk. Printed on
  every `--staged` run.
- **The generated-bundle gate** (`engine/artifact_audit.js`) reads the working tree. A mid-rebuild
  `data/abra-tags.js` can still block a commit through that gate, even though the docs gate now reads
  the staged copy.
- **`tests/test-roadmap-register.js`** reads `docs/ROADMAP.md` from disk. ENGINE is editing it tonight.
- **`tests/test-docs-quarantine.js` is RED on the live tree and is not in `tests/run-all.js` or the
  waivers.** It is not caused by this change: HEAD's `docs_scan.js`, compiled in memory at the real
  module path, gives byte-identical output (exit 1 both). It names committed lines such as
  `docs/ABRA-whitepaper.md:1225` as well as ENGINE's live edits.

## OWED, NOT RUN

Record this change. The row text is in the verdict returned to the coordinator. `docs/RUNNING-NOTES.md`
and `CHANGELOG.md` were not edited, on instruction.

```bash
# after adding the notes row and CHANGELOG line, commit the three files; the commit itself runs the new hook
git add .githooks/pre-commit engine/docs_scan.js tests/test-docs-current.js docs/_reports/2026-09-11-hook-reads-index.md docs/RUNNING-NOTES.md CHANGELOG.md
git commit
```

The ledger and status restamp were not run. `status.js --write` rewrites generated blocks in
`docs/ENGINE.md`, which ENGINE is editing.

```bash
node engine/status.js --write
```

Give the same switch to the other working-tree readers in the hook. Each belongs to its own owner:

```bash
node build/build_archive_index.js --check     # clause 3c: reads docs/archive/ from disk
node engine/artifact_audit.js                 # generated-bundle gate: reads data/*.js from disk
node tests/test-roadmap-register.js           # reads docs/ROADMAP.md from disk
```

The unregistered red, which needs a register row and an owner:

```bash
node tests/test-docs-quarantine.js
```

`git commit -a` / `git commit <paths>` (git's temporary index) is honoured by construction and was
**not** demonstrated. Do NOT demonstrate it in this shared tree: `-a` would sweep other agents'
in-flight files into the commit. Demonstrate it in a throwaway clone:

```bash
git clone --no-local . /tmp/hookdemo && cd /tmp/hookdemo && git config core.hooksPath .githooks
cp /c/Users/willj/Projects/Pokemon/ABRA/.githooks/pre-commit .githooks/pre-commit
cp /c/Users/willj/Projects/Pokemon/ABRA/engine/docs_scan.js engine/docs_scan.js
cp /c/Users/willj/Projects/Pokemon/ABRA/tests/test-docs-current.js tests/test-docs-current.js
echo " " >> docs/_reports/2026-09-11-hook-reads-index.md 2>/dev/null || echo " " >> README.md
git commit -a -m demo    # the "(--staged: …)" line should name no path that -a is committing
```
