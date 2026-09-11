# The rest of the quarantined leaf-calibration measurement is withdrawn, and the last hook gate judges the commit — 2026-09-11

MEASURE. Historical findings record; not maintained. Nothing committed or pushed. No games played.

## Verdict

1. **`tests/test-artifact-rerunnable.js --staged` exists, and `.githooks/pre-commit` passes it.** No gate in
   the hook's loop reads the working tree now. On a scratch index, every plant came out as required: an
   unstaged change no longer blocks, and a staged-only change, which the old hook passed, now blocks.
   This holds for an artifact plant and for a `need`-list plant. On identical bytes, a hand run's output
   is byte-identical to HEAD's code.
2. **187 numeric tokens withdrawn from `docs/MEASURE.md`:** 122 in §15 (the two-leaf-artifact
   reconciliation), 36 in §1 (leaf calibration), 29 in §3 (R1). A handful are fragments or labels rather
   than figures: `1e-4` splits into two tokens, and `95%` is the label in `95% CI`. Every one was read
   from an artifact that `engine/quarantine.js` withholds. The sentences keep what was measured and
   which way it came out, without the numbers.
3. **Tests.**
   - `node tests/test-docs-quarantine.js`: all checks passed; 64 withheld; 48 seeded offenders stand.
   - `node tests/test-docs-current.js` on the live tree: 37/37 after the withdrawal. It went 35/37 at
     09:14 because ENGINE regenerated `data/protocol-events.json` on disk, unstaged: `emittedCount` went
     from 44 to 45, and four living documents state 44. It is **not this change**: judged as the commit
     (HEAD plus this change's three files, on a scratch index), it is **37/37**.

## 1. The hook's last working-tree reader

### What changed

| file | change |
|---|---|
| `tests/test-artifact-rerunnable.js` | `--staged` calls `DS.useIndex()`. The `data/*.json` scan (`DS.listFiles` / `DS.rawText`) reads the staged tree. So does the ratchet baseline. The callers' `need` lists come from a copy of the staged top level of `engine/` and `tests/`: `DS.materialize` writes it to an OS-temp directory, and `ER.callerNeeds(dir)` reads it there, so there is no second parser. The recorder check compiles the staged `engine/medicham2-browser.js` at its real path and parses the same source. A `(--staged: …)` reader line is printed, green or red. `--stamp --staged` refuses with exit 2, because the floor is written to the working tree. Without the flag, every read is the `fs` call it replaced. |
| `.githooks/pre-commit` | The loop's `case` adds `tests/test-artifact-rerunnable.js` to the `--staged` set, so the hook echoes its reader line. The comment that said it "is NOT switched" is replaced. |

**Still read from disk, deliberately:** `data/releases/`. `ER.open()` checks every file against the
manifest digests before it serves a byte. A disk copy that is not the release therefore reads MODIFIED:
it can be over-accused and never passed. Section 5b already hashes the committed blobs of every
tracked release. `git ls-files` (tracked releases and artifacts) always honoured `GIT_INDEX_FILE`.
A modified or deleted release that exists only in the working tree could therefore still block. Releases
are immutable, so this was left as it is.

### Plants

The lab was HEAD's `engine/`, `tests/` and top-level `data/` from `git archive`, placed under the session
scratchpad. `data/releases/` was hard-linked read-only (661 releases). The real `.git` was the object
store, with `GIT_OBJECT_DIRECTORY` pointed at a scratch directory and the real objects as a read-only
alternate, so **nothing was written to the real `.git`**. The index was scratch: `read-tree HEAD` plus
`update-index --cacheinfo`. "OLD" means HEAD's test with no flag, which is what the hook ran. "NEW" means
this code with `--staged`.

- **Artifact plant:** `data/rollout-r1-greedy-rows-3932186b59ef.meta.json` (RE-RUNNABLE in HEAD), with
  `"rerun": false` and no reason.
- **Need-list plant:** `engine/game_differential.js`'s `REL.require('engine/medicham2-browser.js', {need})`
  with an extra symbol, `plantNoSuchSymbol`.

| plant | OLD | NEW `--staged` | required |
|---|---|---|---|
| clean, index = HEAD | green 6/6 | green 6/6 | — |
| artifact, disk only | **blocks** (NEW: … declares "rerun": false with NO reason) | **green** — reader: `data/rollout-r1-greedy-rows-…meta.json` read from the index | must not block ✔ |
| artifact, index only | **green — missed** | **blocks**, same line | must block ✔ |
| artifact, disk + index | blocks | blocks | — |
| need list, disk only | **blocks** (game-differential-endstate-v2.json … lacks `::plantNoSuchSymbol`, and others) | **green** — reader: `engine/game_differential.js` read from the index | must not block ✔ |
| need list, index only | **green — missed** | **blocks**, same artifacts | must block ✔ |
| `--staged --stamp` | — | exit 2, refuses | — |

**Equivalence.**
- Clean lab, identical bytes: OLD and NEW without the flag print byte-identical output (`diff` empty).
- NEW with `--staged` adds one line, the reader line: `4005 files in the index; 908 read from disk after
  their hash matched the staged blob; 1 read from the index` (the lab's own copy of the test), and a
  staged copy of 624 `engine/`/`tests/` files.
- On the live tree, the only diff between the old and new code without the flag was the release ids on
  artifacts that another agent rewrote between the two runs.

**The real tree, copy of the real index:** green 6/6. The index read 27 paths because the working tree
differs from it: ENGINE's in-flight `data/*.json`, which is exactly what should not decide an unrelated
commit. The real index hash did not change. No `abra-rerunnable-staged-*` directory was left in the OS temp
directory (0, checked). Silent-catch gate: no new blocks. `sh -n .githooks/pre-commit`: OK.

## 2. The withdrawal in `docs/MEASURE.md`

`engine/quarantine.js` today: gate CLOSED, 64 artifacts withheld. That includes
`data/winrate-backtest.json`, `data/leaf-position-contrast.json`, `data/rollout-r1.json`,
`data/rollout-r1-explore-sweep.json` and `data/rollout-r1-explore1.json`.

### The rule applied

- **Withheld:** every accuracy, Brier, ECE, MCE, slope, interval, lift, decomposition term, split-half
  floor, bin rate, majority-class rate and scored-sample count read from those artifacts. Also PORY2's
  quoted "worth N points over counting": PORYGON2 is on CLAUDE.md's quarantine list.
- **Kept:**
  - configuration (explore, rollout budget, horizon, the subset predicate, the number of random cuts);
  - identifiers (release ids, file:line references);
  - **store-composition facts**: the bo3 share of the corpus, the rating medians, the store's date
    inversions. The store is upstream of the simulator (CLAUDE.md, NOT quarantined), and none of these
    moves when MEDICHAM does.
- **Not touched:** anything that measures MEDICHAM (census, differentials, roster).

### Where

| section | removed | what |
|---|---|---|
| §15 "THE TWO LEAF ARTIFACTS DO NOT CONTRADICT EACH OTHER" | 122 | the whole arms table (A–E, every numeric cell); the telescoping sum; the decomposition table; the √-cluster factor; the turn-0 sheet term and alternate path; arm E vs published backtest; the h=60 re-run; the n=237 subset and its spread; bullet (a)'s Brier, slope, lift, extreme-bin and top-bin figures; (b)'s lift; (c)'s corpus term; arm A's floor and MCE; the PORYZ bar; the "4.75 points" in the filed-not-fixed bullet |
| §1 "LEAF CALIBRATION — MEASURED 2026-08-04" | 36 | the calibration table; the extreme-bucket share; discrimination, p-values and decisive-call count; the legacy leaf's log-loss and discrimination; the side-symmetry mean |
| §3 "R1 has an artifact" | 29 | the published 68.18/65.26/+2.91 and the recomputed 65.72/+0.46/CI; the split-half range; "four points apart"; the three "cite 68.18%" references; the blockquote's playout counts, wipeout and cap-hit rates, mean turns and ECEs |

`157daae7` had already withdrawn two §15 figures, and they stay withdrawn. A dated ledger entry at the top
of `docs/MEASURE.md`, directly under the GENERATED block, records this pass without figures. No GENERATED
block was edited.

### Why the test did not see them

`tests/test-docs-quarantine.js` charges only a figure that it can attribute **uniquely** to a withheld
artifact, or one cited beside it and present in it. These figures were published from earlier runs, so
most no longer match a current artifact value. Green was never a clean bill here, and it is not one for
the rest of the ledger either (below).

### Still printed, withheld, outside this pass

| where | figure | artifact (withheld) |
|---|---|---|
| `docs/MEASURE.md` §2 "R4 has an artifact" (~line 5088) | MILTANK 55.5% of 535 decisive pairs, LLR 3.00 / 2.94, decided after 522 | `data/rollout-r4.json` |
| `docs/MEASURE.md` §14 Stage D (~6413, 6427) | `‖new − old‖₂ = 0.8030`, 9 of 58 weights > 2 SE, the three-row weight table, 8,856 / 8,942 games | `data/policy-weights.json` |
| `docs/SEARCH.md` ~3688 | the explore-sweep paragraph that `157daae7` trimmed by one figure | `data/rollout-r1-explore-sweep.json` (SEARCH's file) |

The seeded census also still holds 13 `docs/MEASURE.md` keys (policy weights, feature-engine contrast,
censoring value, leaf-engine contrast, winrate-backtest `6,890`). Two `docs/MODELS.md` seeds no longer fire:
the test prints them.

## Residual caveats

- The staged recorder check compiles the commit's `medicham2-browser.js`, but its own `require`s resolve
  from disk, which is a mixed tree. The check is about that module's export list, which its dependencies do
  not decide.
- A staged `--stamp` is refused, not supported.

## Scratch and safety

- The real index was never written. The real `.git` was never written: plant blobs went to a scratch
  object directory.
- The lab's release hard links were removed afterwards. The originals were verified intact: link count back
  to 1, 661 releases, `engine_release.js verify` says intact.
- The lab code, the scratch indexes and the scratch object store remain in the session scratchpad.
- `data/docs-currency-baseline.json` did not move in any run (`fd035d53…` throughout).

## OWED, NOT RUN

Record and commit. The notes row and CHANGELOG text are in the verdict returned to the coordinator.
`docs/RUNNING-NOTES.md` and `CHANGELOG.md` were not edited, on instruction:

```bash
git add tests/test-artifact-rerunnable.js .githooks/pre-commit docs/MEASURE.md \
        docs/_reports/2026-09-11-leaf-withhold-and-hook.md docs/RUNNING-NOTES.md CHANGELOG.md
git commit      # the hook now runs tests/test-artifact-rerunnable.js --staged itself
```

Restamp the ledgers. Not run: it rewrites generated blocks in `docs/ENGINE.md`, which ENGINE owns tonight:

```bash
node engine/status.js --write
```

The live-tree docs gate is red on ENGINE's unstaged `data/protocol-events.json` (`emittedCount` 44 → 45)
against four documents that state 44. That belongs to whoever commits that regeneration:

```bash
node tests/test-docs-current.js     # FAIL at docs/MODELS.md:1314, docs/ABRA-whitepaper.md:1802, docs/ABRA-technical-docs.md:1888, docs/SUMMARY.md:1387
```

The same withdrawal for the withheld figures still printed outside leaf calibration:

```bash
grep -nE '55\.5% of 535|LLR 3\.00|0\.8030|9 of 58 weights|8,856 games' docs/MEASURE.md   # R4 verdict, Stage D refit
grep -n 'rollout-r1-explore-sweep' docs/SEARCH.md                                         # SEARCH's sweep paragraph
```

Shrink the quarantine ratchet by the two seeds that no longer fire:

```bash
node tests/test-docs-quarantine.js | grep -A3 'DELETE these lines'
```

The leaf-calibration figures return only when the gate opens and the artifacts are re-run:

```bash
node engine/quarantine.js                                    # gate must read OPEN first
RECUT=data/leaf-position-contrast-rows-6b0e4117d964.jsonl node engine/leaf_position_contrast.js
node engine/backtest_winrate.js
node engine/rollout_explore_sweep.js
```
