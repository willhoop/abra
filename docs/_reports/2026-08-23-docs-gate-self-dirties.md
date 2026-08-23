# The docs-currency gate dirtied the tree on exactly the commits it fired on

2026-08-23, MEASURE. Historical record, not current state. Superseded by whatever register row and
`node engine/status.js` say later.

---

## 1. VERDICT

The premise was right about the symptom and wrong about the frequency, and the difference is the fix.

`tests/test-docs-current.js` does **not** rewrite its baseline on every run — the write was already
guarded, and `generated` was already excluded from the comparison. It rewrote the file when any
*other* key differed, and the only key that ever differed was **`changelog_top_at_baseline`**.

That key tracks the CHANGELOG top version. The living-docs rule **requires** a CHANGELOG bump on
exactly the commits that trip this hook. So the gate rewrote itself on precisely the class of commit
it fires on, every time, forever. Not a coincidence three times — a loop.

**Fraction of the rewrites that carried real information: 0 of 3.** All three diffs are two lines.

| commit | `generated` | `changelog_top_at_baseline` | any ratchet movement |
|---|---|---|---|
| `086dd25` | 05:52:54Z → 06:21:17Z | 5.88.0 → 5.89.0 | none |
| `4383241` | 08:16:04Z → 08:25:42Z | 5.91.0 → 5.91.1 | none |
| `483f529` | 08:25:42Z → 08:27:53Z | 5.91.1 → 5.91.2 | none |

No list gained or lost an entry, no count moved, no figure set changed, in any of the three.
Verified with `git show <sha> -- data/docs-currency-baseline.json`; each is `2 insertions(+),
2 deletions(-)` and each commit contains that file and nothing else.

**So the restamp is INCIDENTAL**, and the brief's first branch applies — with one qualification that
decided the design: the same write path *does* sometimes carry real ratchet movement (the
2026-08-22 living-docs audit records a retired citation mismatch, 66 → 65). A blanket "never write
during a check" would have stopped the ratchet tightening itself, and a ratchet that only tightens
when somebody remembers a flag is looser than one that tightens on its own. That is catching less,
which the brief forbids.

## 2. THE MECHANISM, MEASURED RATHER THAN INFERRED

The write block already stripped `generated` before comparing, by regex on the JSON *text*:

```js
const strip = s => s.replace(/"generated":\s*"[^"]*",?\n/, '');
if (strip(before) !== strip(after)) { fs.writeFileSync(BASELINE, after); }
```

Any key not named in that one regex was a write trigger. `changelog_top_at_baseline` was added later
and nobody classified it.

**Proof of the causal link, without touching `CHANGELOG.md`** (owned by the ENGINE agent tonight):
set the baseline's `changelog_top_at_baseline` to `5.90.0` — the state a CHANGELOG bump produces —
and run the gate. It wrote, and the diff it produced was:

```
-  "generated": "2026-08-23T08:27:53.154Z",
+  "generated": "2026-08-23T09:00:06.982Z",
-  "changelog_top_at_baseline": "5.90.0",
+  "changelog_top_at_baseline": "5.91.2",
```

Byte-for-byte the shape of all three commits. The file was restored to `2f88106` afterwards.

A baseline run first confirmed the gate is **not** unconditional: on an unchanged tree,
`node tests/test-docs-current.js` exited 0 and left the file at hash `2f88106…`, unchanged.

## 3. WHAT CHANGED

### 3.1 `tests/test-docs-current.js` — keys are classified, and only content triggers a write

Two sets, and a clause that fails if a key is in neither:

```js
const PROVENANCE   = { generated: …, changelog_top_at_baseline: … };   // stamps the RUN
const RATCHET_KEYS = ['by','rule','version_pins','unversioned_exempt',
                      'archive_grandfathered','known'];                 // is the CONTENT
```

- The comparison is now over **parsed content with the PROVENANCE keys dropped**, not over the JSON
  text with one key deleted by regex. It writes iff a measured value changed. Re-indentation and key
  reordering are no longer write triggers either.
- **New clause 4** fails by name on any key that is in neither set. This is the part that stops the
  defect recurring: `changelog_top_at_baseline` became a write trigger because nobody had to say what
  kind of key it was. Now they do.
- Nothing else moved. Every existing clause runs unchanged, `--update` is still monotone, the write
  is still green-only and still fail-closed.

**A semantic change that is written down rather than left to be inferred:**
`changelog_top_at_baseline` now means *the CHANGELOG top when the ratchet content was last measured*,
not *when the gate was last invoked*. That is the more useful reading — it dates the measurement —
but it is a different sentence, so it is stated in the file's own comment. **Nothing reads this key**
(`grep` across `*.js`, `*.py`, `*.md`, `*.json`: the only hits are the file itself and the line that
writes it), and `engine/docs_scan.js` explicitly excludes the baseline from the artifact set
(`NOT_AN_ARTIFACT`), so no staleness check is affected.

### 3.2 `.githooks/pre-commit` — the residual real case is staged, never abandoned

When the ratchet *genuinely* moves, the file is a finding and belongs in the commit. The hook now
snapshots the gate's artifact by `git hash-object` before the gate loop, and if it changed on a
**green** run, `git add`s it and says so on stdout.

Two deliberate constraints:

- **Only on green.** A red run does not write; adopting a red run's output would be the "a run that
  found a regression must not record the regression as normal" failure.
- **The list is NAMED, not swept.** Diffing the whole tree before and after would be self-maintaining
  and would also stage whatever another agent wrote during the two seconds the gates ran — and
  several agents run against this repository at once. A hook that edits the index may only touch
  files it can name.

Staging rather than blocking is the call because the write is **green-only and monotone** — lists may
only shrink, counts may only fall — so it cannot smuggle a regression into a commit, and blocking
would punish the person who just fixed a document. The failure branch (`git add` refuses) prints the
`git add … && git commit --amend --no-edit` instruction rather than passing silently.

## 4. SHOWN RED ON A DELIBERATE BREAK

Four demonstrations. The hook ones ran in a throwaway git repo in the scratchpad, **not** against the
shared index, because two other agents are live and `git add` touches state they can see.

| # | break | expected | observed |
|---|---|---|---|
| A | set `changelog_top_at_baseline` to `5.90.0` — tonight's exact trigger | no write | **not rewritten**; hash identical before and after. Under the old code this wrote. |
| B | plant a stale entry in `unversioned_exempt` — real ratchet movement | write | **rewritten**, `ratchet tightened: 1 entry retired`. Tightening is not lost. |
| C | add an unclassified key (`scanned_at_hostname`) to `next` | clause 4 red | `FAIL … UNCLASSIFIED: scanned_at_hostname`, **exit 1**, and the baseline was **not** written during the red run (fail-closed preserved). |
| D | delete the staging block from the hook, commit a `docs/` change while the gate rewrites its baseline | file left dirty | commit contained `docs/A.md` only; `git status` afterwards showed `M data/docs-currency-baseline.json`. **The observed defect, reproduced on demand.** With the block present, the same scenario produced a commit containing both files and a clean tree. |

Preserved behaviour, re-demonstrated in the same scratch repo: a **data-only** commit still
short-circuits before the gate loop (no `living-docs gate` line printed), and a **mid-rebase** commit
still prints `rebase in progress — skipping`. Both guards sit above the new code.

The real tree after three consecutive gate runs: `git diff --stat -- data/docs-currency-baseline.json`
is empty. The file is byte-identical to `483f529` (`2f88106d632aa4d2a2bfca75fdf3c3f9ad855270`).
`tests/test-docs-current.js` now reports **23 passed, 0 failed** (was 22 — clause 4 is the new one).

## 5. CLASS, NOT INSTANCE — WHAT WAS CHECKED

### 5.1 The three gates in `.githooks/pre-commit` — MEASURED, not read

| gate | writes during a check? | evidence |
|---|---|---|
| `tests/test-docs-current.js` | **yes — this defect** | fixed above |
| `tests/test-roadmap-register.js` | no | contains no `writeFileSync`/`appendFileSync` at all |
| `tests/test-artifact-rerunnable.js` | no | writes only under `--stamp`; ran it and `data/artifact-rerunnable-baseline.json` hashed identical before and after (`3960e2e…`) |

### 5.2 Every `tests/test-*.js` (the set `tests/run-all.js` discovers), scanned for writes into `data/`

**Flag-gated, i.e. already following the convention** — `test-artifact-rerunnable` (`--stamp`),
`test-board-browser` (`--update`), `test-click-match` (`--update`), `test-degradation-budgets`
(`--ratchet`), `test-effective-identity` (`--update`), `test-mc-key` (`--update`),
`test-medicham-coverage` (`--stamp`), `test-no-silent-failure` (`--update` / `--accept`),
`test-rulebook-collision` (`--update`), `test-site-data-fresh` (`--update`). Ten of them. The
convention was already the majority practice, which is why this fix follows it rather than inventing
one.

**Sandbox only — writes to `os.tmpdir()`, or writes a live file and restores it** —
`test-arm-steering`, `test-publish-guard`, `test-policy-promote`, `test-engine-release`,
`test-miltank-release`, `test-register-reality-readonly` (this last one is the precedent: an existing
test whose whole purpose is asserting a tool does not write when merely looked at).

**Writes into the repo's `data/` with no flag** — six, of which five are defensible:

| file | artifact | judgement |
|---|---|---|
| `test-mechanics.js` | `data/mechanics-census.json` | GENERATOR. Producing the census is the point; it even refuses to write under a deliberate engine break. |
| `test-forme-assert.js` | `data/forme-assert.json` | GENERATOR. |
| `test-game-diff.js` | `data/game-diff.json` | GENERATOR. |
| `test-interaction-matrix.js` | `data/interaction-matrix.json` | GENERATOR, and it already refuses to write when the run would shrink the artifact undeclared. |
| `test-json-nan-guard.js` | `data/json-nan-guard-baseline.json` | RATCHET, but writes **only when the count falls** — i.e. only on real movement. Correct by the standard this report argues for. |
| **`test-unmodelled-clicks.js`** | `data/unmodelled-clicks.json` | **SAME DEFECT, AND WORSE.** Line 103 is an unconditional `writeFileSync` carrying `generated: new Date().toISOString()`, outside every conditional — so it rewrites on every run whether or not anything moved, **and on a red run too**. |

**So the answer to "is this a pattern?" is: nearly an instance.** One other file has it
(`test-unmodelled-clicks.js`), it is not in the pre-commit hook, and it has never produced a solo
commit — 12 commits touch its artifact and every one of them carries other work, because it only runs
during real sessions. It is real and it is lower grade. **It was not fixed here**: it is not in this
brief's ownership list, and a red run writing its own artifact is a different and more interesting
defect than a timestamp — it deserves its own pass, not a drive-by.

This claim is **static**, from reading the write site. It was not confirmed by execution, because
confirming it means dirtying a tracked artifact to prove that it dirties a tracked artifact.

## 6. OWED, NOT RUN

- **`node engine/status.js --write`** — forbidden by the brief (another agent's territory tonight).
  The generated blocks are not restamped.
- **A CHANGELOG entry and a version bump.** Explicitly the coordinator's, so the agents do not collide
  on that file. **This work is therefore incomplete under the living-docs rule until that lands.**
- **`docs/MEASURE.md`** — the division ledger has no row for this. Not in the ownership list I was
  given and possibly open in another session; not touched.
- **A roadmap register row** for `test-unmodelled-clicks.js` writing unconditionally, including on red
  runs. Not filed — `docs/ROADMAP.md` is not mine tonight.
- **`tests/run-all.js` was not run.** The three hook gates were run individually and are green; the
  full suite was not, and several of its members are on this brief's forbidden list.
- **Nothing was committed.** Two files are modified: `tests/test-docs-current.js` and
  `.githooks/pre-commit`.
- **The hook change is demonstrated in a scratch repo, never against this one.** It has not yet run
  in anger here. The first real commit that trips it is the true test.

## 7. NOT DELETED, REPORTED

- `data/_pair-pilot.json` — untracked, not mine, left in place.
- `/scratchpad/hookdemo/` — a throwaway git repo I created this session for demonstration D. Mine, in
  the scratchpad, left in place.
- Modified by other agents while I worked, untouched by me: `engine/medicham2-browser.js`,
  `tests/test-mechanics.js`, `data/mechanics-census.json`.
