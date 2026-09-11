# The docs-quarantine red, and three more hook checks that judge the commit — 2026-09-11

MEASURE. Historical findings record; not maintained. Nothing committed or pushed. No games played.

## Verdict

1. **`tests/test-docs-quarantine.js` is red because of a committed provenance misattribution.** ENGINE's
   working-tree state is not the cause. `bf2d594f` (08:17) added `tests/probe_divergence_rank_side.js`.
   That probe writes a fixture to `path.join(dir, 'data', 'game-differential.json')` in a temp tree.
   `engine/provenance.js` credited it as the writer of `data/game-differential.json`, which is the gate's
   own input, in place of `engine/game_differential.js`. `engine/quarantine.js` derives its instruments
   from the writers of the gate's inputs. So `game_differential.js` and `derive_protocol_events.js` stopped
   being instruments, and 23 of their artifacts were withheld. That gives 44 of the 46 new hits.
   **Fixed in `engine/provenance.js`.** 1 of 304 graph rows moves. The withheld set returns to 62. The test
   stays red on the **2 genuine republications**, which need the living-document edit below.
2. **Three hook checks now read the staged tree**, through `engine/docs_scan.js`'s index reader:
   `build/build_archive_index.js --check --staged` (clause 3c), `engine/artifact_audit.js --staged` and
   `tests/test-roadmap-register.js --staged`. The hook passes the flag to each. Each was shown in both
   directions on a scratch index. An unstaged working-tree change no longer blocks, and a staged bad change
   still blocks. A staged-only bad change used to pass the old hook, and now blocks.

The quarantine gate is **still CLOSED** (2 of 9 gating clauses: mechanics, open known defect). Nothing
here touches a clause.

## 1. The docs-quarantine red

### What the test reads
`node tests/test-docs-quarantine.js` takes no flags. It reads the working tree: the documents through
`DS.liveDocs()` / `readDoc`, and the withheld set through `engine/quarantine.js` `state()`, which reads live
`data/*.json` and spawns `engine/provenance.js --graph --json`. To judge the committed state, HEAD was
exported to a scratch lab (`git archive`, code, docs and the top level of `data/`), and the test was run
there.

### Timeline, measured
| tree | gate | withheld | test |
|---|---|---|---|
| `9f5e4869` (HEAD at session start), exported | OPEN | 62 (computed, not applied) | **green**, 7/7, via the gate-open branch |
| live tree before 08:17 (ENGINE's uncommitted `all-mechanics-fire.json` + engine edits) | CLOSED | 87 | red, 46 new keys |
| `bf2d594f` (HEAD now), exported | CLOSED | 85 | **red**, 46 new keys: **committed** |
| `bf2d594f` + the `provenance.js` fix (lab) | CLOSED | 62 | red, **2** new keys |
| live tree + the fix | CLOSED | 64 | red, the same 2 |
| `bf2d594f` + the fix + the 3 edits below (lab) | CLOSED | 62 | **green**, all checks passed, 48 seeded offenders stand |

The brief cites `docs/_reports/2026-09-11-instrument-reds.md`. That file does not exist. The green record is
in `2026-09-10-instrument-reds.md` (6/6), `2026-09-11-ratchet-925.md` and
`2026-09-11-traceability-ratchet.md` ("the quarantine gate is open today"). It was green then because the
gate was open. `bf2d594f` closed it on purpose ("Nothing was narrowed to reopen it"), and from that point
every figure published during the open window was checked again.

### The 23 artifacts that joined the withheld set at `bf2d594f`
The reason for each is quarantine.js's own: "its generator engine/game_differential.js is in the play
layer". 22 are written by `engine/game_differential.js`: `game-differential-endstate*.json` (5 files),
`nature-arms.json`, `divergence-turns.json`, `game-differential-PRE.json`, `_r220-*` (4),
`_turncap-cap{12,16,30}.json`, `_void-*` (5), `_dmg-inverted.json`, `_pair-pilot.json`. The 23rd is
`protocol-events.json`, written by `engine/derive_protocol_events.js`. No artifact left the set.

By artifact, the 46 new keys were:
- `nature-arms.json` 24
- `game-differential-endstate.json` 5
- `divergence-turns.json` 4
- `game-differential-endstate-v2.json` 3
- `_r220-gd-pre.json` 3
- `game-differential-endstate-turn40.json` 2
- one each: `-turn19`, `_r220-void-pair-PRE`, `protocol-events`, `leaf-position-contrast`, `rollout-r1-explore-sweep`

### Root cause, from `provenance.js --graph --json`
| | `data/game-differential.json` → `by` | `from` |
|---|---|---|
| `9f5e4869` | `engine/game_differential.js` | engine-data, joint-click-census, meta-usage, **protocol-events**, rollout-switch-census, tags … |
| `bf2d594f` | **`tests/probe_divergence_rank_side.js`** (via "write line") | `tags.json` |

`quarantine.js` `instrumentsOfTheGate` walks the gate's inputs back through `from` and exempts the
writers it finds. It uses the first `by` for each input. With the probe as `by`, the walk no longer reached
`game_differential.js`. It also no longer reached `protocol-events.json`, which is why
`derive_protocol_events.js` fell out as well. Derived instruments went from 4 (game_differential,
derive_protocol_events, tag_dex, all_mechanics_fire) to 2.

`provenance.js`'s data-root window (line ~180) exists for exactly this class: "a TEST … writes the same
filename into a temporary directory". It keys on the word `data` in the 64 characters before the name.
The probe's scratch tree has its own `data/`, so the window saw the word and passed the write. That line
scored 4, and `game_differential.js` scores 3 ("path variable").

### The fix (`engine/provenance.js`, `scratchJoin`)
The fix is derived per source, like `dataRoots`. An identifier whose own definition calls `mkdtemp`,
`mkdtempSync` or `tmpdir` roots a scratch tree. A `path.join` / `path.resolve` whose first argument is such
an identifier, and which contains `data`, is therefore not rooted in `data/`. The rule is narrow on purpose:
`renameSync(tmp, D('data', …))` (the atomic write) still lands in `data/`.

- The whole graph was diffed at `bf2d594f`, HEAD code against the fix: **1 of 304 rows moves**, and it is
  `data/game-differential.json`, back to `engine/game_differential.js` "via path variable".
- `tests/test-provenance-discovery.js`: "304 rows … all clear" before and after.
- `tests/probe_mutation_provenance_params.js` exits 2 (CANNOT ANSWER, its release is not in a lab) in
  both labs. It was not run on the real tree.
- Silent-catch gate: 0 new blocks.
- The live-tree edit is byte-identical, CR-folded, to the lab edit that was measured.
- When the edit was made, no `register_reality.js` process was running. That script reaches
  `provenance.js` through `quarantine.js`.

### The two genuine hits: the living-document edit (for the coordinator, not made)
Both artifacts were already in the withheld set at `9f5e4869`. They fire now only because the gate
closed. The ratchet key is `doc|figure|artifact`, so **every** occurrence must go. `55.92%` appears twice
in `docs/MEASURE.md`.

| # | file:line | replace (exact, occurs once) | with |
|---|---|---|---|
| E1 | `docs/MEASURE.md:6484` | `\| 55.92% [54.0, 57.8] \|` | `\| withheld \|` |
| E2 | `docs/MEASURE.md:6558` | `Arm A ranks at 55.92% against a 52.4% majority — its interval's lower bound is 54.0, clear of both` | `Arm A ranks above a 52.4% majority — its interval's lower bound clears both` |
| E3 | `docs/SEARCH.md:3688` | `` `data/rollout-r1-explore-sweep-h60-09acd3b404ef.txt`, 4,586 positions at `MAXTURNS=60` `` | `` `data/rollout-r1-explore-sweep-h60-09acd3b404ef.txt`, at `MAXTURNS=60` `` |

E1 to E3 were applied to lab copies only (exact-string, one match each). The test then passed all
checks, and the lab copies were restored.

**This edit clears the minimum the test charges, not the whole measurement.** The rest of the
`docs/MEASURE.md` arms table (B–E) and the `docs/SEARCH.md` sweep paragraph report the same measurements.
They are leaf calibration and R1, which CLAUDE.md names as quarantined. The test charges only figures it
can attribute uniquely, plus the 48 seeded offenders. Whether to withhold the whole table now that the
gate has closed again is a judgement for the coordinator. It is not a clean bill.

The test also prints two seeded lines that no longer fire and may be deleted (the ratchet only shrinks):
`docs/MODELS.md|2.92%|data/policy-weights.json` and `docs/MODELS.md|23.4%|data/policy-weights.json`.

`tests/test-docs-quarantine.js` is in neither `tests/run-all.js` nor `data/test-waivers.json`. It ran red
this afternoon with nothing to catch it.

## 2. The hook's working-tree readers

### What changed (uncommitted)
| file | change |
|---|---|
| `engine/docs_scan.js` | `rawBytes(rel)`: the reader without the decode. `rawText` is now a wrapper round it, and worktree mode is unchanged. `materialize(rels, dest)`: copies files byte-exact through the reader. Both exported. The header names the three new callers. |
| `build/build_archive_index.js` | `--check --staged` lists and reads `docs/archive/` from the index. `--staged` without `--check` exits 2. PDFs are now matched to their document **without case, against the listing** (see below). Prints a `(--staged: …)` reader line. |
| `tests/test-docs-current.js` | Clause 3c passes `--staged` to the generator under `--staged`. |
| `tests/test-roadmap-register.js` | `--staged` reads `docs/ROADMAP.md` and the five ledgers from the index. The commit-message clause still reads `git log`. Prints a reader line. |
| `engine/artifact_audit.js` | `--staged` copies the staged tree to an OS-temp directory (`engine/`, `build/`, and `data/` minus its `.jsonl`/`.gz` stores) and runs the audit **and every builder's `--check`** there. Siblings resolved by `'..','..','<name>'` are found by scanning the copied code, and are copied from disk without links, `.git` or `node_modules` (today only `CHOMP`). Showdown is reached via `SHOWDOWN_PATH`, and `node_modules` via `NODE_PATH`. The process deletes only its own temp directory, in `finally`. |
| `.githooks/pre-commit` | The bundle gate runs `artifact_audit.js --staged` and echoes its reader line. The loop passes `--staged` to `test-roadmap-register.js` too. Comments updated. |

### Plants
Method: a scratch lab (a `git archive` of `bf2d594f`), the real `.git` as the object store, and scratch
indexes (`read-tree bf2d594f`, plus `update-index --cacheinfo`). OLD = HEAD's code with no flag, which is
what the hook ran. NEW = this code with `--staged`. D = the plant is on disk only. I = the plant is in the
index only. B = the plant is in both.

| plant | clean | D (unstaged) | I (staged only) | B |
|---|---|---|---|---|
| A: archive header edited (`CODE-REVIEW-2026-07-27.md` Claimed line) | 0 / 0 | **OLD 1 blocks / NEW 0** | OLD 0 missed / **NEW 1** | 1 / 1 |
| B: `data/abra-tags.js` drifted from `tags.json` | 0 / 0 | **OLD 1 / NEW 0** | OLD 0 / **NEW 1** (GAP abra-tags.js) | 1 / 1 |
| C: ledger cites unregistered `#998` (`docs/ENGINE.md`) | 0 / 0 | **OLD 1 / NEW 0** | OLD 0 / **NEW 1** | 1 / 1 |
| hook level, plant B (data-only commit) | 0 / 0 | **OLD hook blocks / NEW green** | OLD hook passes / **NEW hook BLOCKED** | — |

The full hook loop (`test-docs-current`, `test-roadmap-register`, `test-artifact-rerunnable`) was not run
end to end in the lab: `test-artifact-rerunnable.js` needs `data/releases/` (3.3 GB). Plants A and C were
run as the exact commands the hook and clause 3c issue.

### Two defects the plants surfaced, both fixed
- **The archive index depended on the filesystem.** `docs/archive/ABRA-Simulator-WhitePaper.pdf` sits
  beside `ABRA-simulator-whitepaper.md`. `fs.existsSync` on this case-insensitive disk said "pdf yes",
  and INDEX.md records that. The index is case-sensitive and said "no", so the first `--check --staged`
  failed HEAD's own INDEX.md. A Linux clone would fail the same way: the #554 fresh-clone class. PDFs
  are now matched against the listing without case, in both modes. Result: current in both modes in
  the lab, current on the real tree, and no committed byte moves.
- **The first materialize filter was an extension allow-list (`.js|.json`).** It dropped
  `data/engine-data.template.txt`, `build_engine_data.js --check` refused to run, and the hook went red
  on clean bytes. The filter now excludes the `.jsonl`/`.gz` stores instead. It was re-planted after
  the fix (the table above).

### Cost and regression
- `artifact_audit.js`: 1.56 s plain, 2.81 s `--staged`. 600 files / 75.2 MB materialized plus `CHOMP`.
  0 temp directories left behind.
- `tests/test-docs-current.js` in the lab on the HEAD+code index: 37/37 `--staged`, 37/37 worktree.
  Clause 3c reads the archive from the index.
- Silent-catch gate: 0 new blocks in all 7 files. Register selftest: 4/4.

### Still reading the working tree
`tests/test-artifact-rerunnable.js`, the fourth gate in the hook loop, reads `data/*.json` and
`data/releases/` from disk. It is not switched.

## Safety
- The real index was never written. Fingerprint `b0fe8108c8911d4b`, nothing staged, from start to end.
- `git hash-object -w` left unreachable loose objects (the plant blobs and code blobs) in `.git/objects`.
  `git gc` prunes them.
- `data/provenance-stamp.json` changed at 08:21:30. That was not caused by this work: `--graph --json`
  exits before the stamp write, and no command run then invoked `provenance.js`.
- The `build_pdfs.js` document pass was running while this work ran. No document was edited here.
- Labs, scratch indexes and scripts are in the session scratchpad.

## OWED, NOT RUN

The living-document edit (E1 to E3 above), then confirm:

```bash
node tests/test-docs-quarantine.js          # expect: all checks passed, 48 seeded offenders stand
```

Record and commit. The notes row and CHANGELOG line are the coordinator's. The hook itself runs the new
gates:

```bash
git add engine/provenance.js engine/docs_scan.js engine/artifact_audit.js build/build_archive_index.js \
        tests/test-roadmap-register.js tests/test-docs-current.js .githooks/pre-commit \
        docs/_reports/2026-09-11-quarantine-and-hook.md docs/RUNNING-NOTES.md CHANGELOG.md \
        docs/MEASURE.md docs/SEARCH.md
git commit
```

Run end to end on the real tree against a copy of the real index. This is not run here because the
loop's `test-docs-current.js --staged` may write `data/docs-currency-baseline.json` into the working tree
if its ratchet moved:

```bash
IDX=$(mktemp) && cp .git/index "$IDX" && GIT_INDEX_FILE="$IDX" sh .githooks/pre-commit
```

Restamp the ledgers. This writes the generated blocks in `docs/ENGINE.md`, and ENGINE is editing it:

```bash
node engine/status.js --write
```

Shrink the ratchet by the two lines the test prints, and give the test an owner. It is in neither
run-all nor the waivers:

```bash
node tests/test-docs-quarantine.js | grep -A3 'DELETE these lines'
```

The fourth working-tree reader in the hook, not switched:

```bash
node tests/test-artifact-rerunnable.js      # reads data/*.json and data/releases/ from disk
```

`git commit -a` (git's temporary index) is honoured by construction and was not demonstrated. Do it in a
throwaway clone, never in the shared tree:

```bash
git clone --no-local . "$(mktemp -d)/hookdemo"   # then copy the 7 changed files in and `git commit -a`
```
