# The promote step — the scheduler stops redefining the engine

MEASURE, 2026-08-22. Implementing the fix Will approved after being asked directly: the promote step,
not freezing the ladder store, and not leaving it. Establishing report:
`docs/_reports/2026-08-22-ingest-invalidates-releases.md`.

**Nothing was committed or pushed. `engine/engine_release.js` was not opened for edit and `SOURCES` is
byte-identical. `data/move-priors.json` — the engine's copy — was not modified.** An ENGINE agent was
working the simulator throughout; nothing in `engine/medicham2-browser.js`, the drag/bench path or
their tests was touched.

---

## Verdict

The scheduler now writes `data/move-priors.observed.json`. The engine's copy moves only under
`node engine/policy.js --promote`, which prints, in the units the readers consume, what landing it
would do to the engine — and refuses five ways when the observed table would damage it. `SOURCES` is
untouched, so no release changes meaning and no existing snapshot loses a file.

The dangerous half of this change was never the engine. It was the workflow: a `git add` naming a
path that matches nothing exits 1 under `bash -e`, and that is exactly how this ingest died for 24
days. That is not argued here, it is **run** — the test extracts the staging block out of the
workflow text and executes it in a throwaway git repo.

---

## 1. What changed

| file | change |
|---|---|
| `engine/policy.js` | derivation default output is now `data/move-priors.observed.json`; new `--promote` (with `--dry-run`, `--force`, `--from`, `--to`) that validates, prints the delta, and lands the bytes |
| `.github/workflows/ingest.yml` | both `policy.js` calls (the derive step and the reconcile-loop repeat) write the observed table; the two `git add` lists became one `add_artifacts` function that walks the list and warns on a missing path instead of aborting |
| `tests/test-policy-promote.js` | new, 17 arms, shown RED on four separate deliberate breaks |
| `data/move-priors.observed.json` | new, seeded byte-identical to the engine's copy (`e667fe8ab457`) |
| `CHANGELOG.md`, `docs/MEDICHAM-SPRINT-NOTES.md` | 5.70.0 entry and the sprint row the pre-commit hook requires |

Not changed, deliberately: `engine/engine_release.js`, `engine/provenance.js`, `engine/quarantine.js`,
`engine/status.js`, and `data/move-priors.json` itself.

### The promote contract

```
node engine/policy.js                      derive        -> data/move-priors.observed.json
node engine/policy.js --promote --dry-run  say what would happen, write nothing
node engine/policy.js --promote            land it, print what it did
node engine/policy.js --promote --from A --to B [--force]
```

Exit codes: `0` promoted or no-change, `2` malformed/blank/missing, `3` shrink band (overridable by
`--force`, which prints `FORCED PAST A REFUSAL`).

---

## 2. The delta print, on today's data

Reproducing the exact transition §1 of the establishing report measured — frozen `32f9ef1687d7`
(release `e12ef20e7910`) against the live `e667fe8ab457` — as a **dry run that wrote nothing**:

```
WHAT LANDS ON THE ENGINE   move-priors.json -> move-priors.json
  species                       345 observed / 345 in the engine now
  species changed               259 of 345 in both
  move cells changed           1477 of 2712
  POOL membership changed        36 cells over 18 species   <- set_priors.fillSet draws from this
  MODAL move flipped              3                         <- sampleMoves / pickByPrior
  lead modal flipped              4
  protectOdds moved             196 species   max chimechomega 0 -> 0.06   <- board.js kill probability
  mean |delta| over changed  0.00397   max 0.066  (lycanrocmidnight stoneedge 0.195 -> 0.261)
  clicks behind it           435700 observed / 427682 in the engine now

POOL MEMBERSHIP (18 species) — a move here can now be drawn, or can no longer be:
  simisear      -protect -helpinghand +flareblitz +rockslide
  garchomp      -scaleshot +ironhead
  gengar        -taunt +willowisp
  mimikyu       -phantomforce +curse
  … 14 more, all named in the output

MODAL MOVE FLIPS (3)      jolteon electroweb -> thunderbolt
                          lycanrocmidnight rockslide -> stoneedge
                          gourgeistsuper poltergeist -> trickroom
LEAD MODAL FLIPS (4)      sinistchamasterpiece ragepowder -> matchagotcha
                          drampamega calmmind -> protect
                          taurospaldeablaze ragingbull -> closecombat
                          stunfisk yawn -> fissure
```

Every figure matches the establishing report — 259/345, 1477/2712, 36, 196, max 0.066 on the same
species and move — and **`meanAbsDelta` agrees to five decimal places (0.00397)**, which is the check
that the instrument is measuring the same quantity rather than a similar-looking one. It only agrees
because a pool add/remove is scored as a **full-size** delta (`movePriorOdds` returns 0 for a move
that is not in the row, so an entry appearing at p=0.12 moved that cell by 0.12); scoring membership
as an unmeasured event understated the mean to 0.00316 on the first attempt.

### Correction to the record

CHANGELOG 5.69.0 Notes and the establishing report both say **"4 modal-move flips"** while the
evidence block beneath lists three. Split by the instrument, it is **3 modal (`moves[0]`, what
`sampleMoves` and `pickByPrior` read) and 4 lead (`lead[0]`, the turn-1 distribution)**. Two different
distributions; the prose merged them.

### `protectOdds` is DERIVED here, not typed

The promote needs the Protect family to compute `protectOdds`. It reads the `stalling` tag out of
`data/tags.json`, which `engine/tag_dex.js` derives from `m.stallingMove` — **the same field
`engine/board.js`'s `STALL` set is built from** (`board.js:1871`). One fact, one derivation. If
`data/tags.json` cannot be read the print says the line is unavailable rather than guessing a list.

---

## 3. Proving the ingest still commits its artifacts

This is the part that could have stopped the collection silently, and it is the part that was run
rather than reasoned about. `tests/test-policy-promote.js` extracts the `add_artifacts` block **out of
the workflow file** and executes it under `bash` in a fresh throwaway git repo, three ways:

| case | what it models | result |
|---|---|---|
| all nine artifacts present | an ordinary run | **9 of 9 staged**, observed table included |
| the new path absent and untracked | the first run after this lands, if the file were not committed | exit 0, `::warning::`, **the other 8 still stage** |
| the new path tracked, then missing | a later run whose derivation step failed | exit 0, warning, and **the deletion is NOT staged** |

With the tolerant form removed and a plain `git add "$f"` restored, the same test reports:

```
FAIL  AN UNPRODUCED ARTIFACT ABORTS THE COMMIT STEP — this is the 24-day failure again:
      fatal: pathspec 'data/move-priors.observed.json' did not match any files
FAIL  A FAILED DERIVATION WOULD COMMIT THE DELETION of data/move-priors.observed.json
```

So the naive version of this rename — swap the filename on the `git add` line and ship — **would have
stopped the ingest on its first run**, in exactly the shape that hid this problem for 24 days. Two
further guards against that:

- `data/move-priors.observed.json` is **created and must be committed with this change**, so the path
  always exists in a fresh checkout;
- a static arm asserts both `policy.js` invocations in the workflow write the observed table and that
  none of them names `data/move-priors.json`. That arm was observed **RED before the workflow was
  edited** (`THE SCHEDULER WRITES THE FROZEN ENGINE SOURCE AGAIN: node engine/policy.js
  data/games.ladder.jsonl data/move-priors.json`).

Everything else in the workflow is unchanged: the `.gz` restore, both shrink guards, the dedupe, the
reconcile loop, the three-attempt push and its loud failure.

---

## 4. Shown RED first, four times, one guard at a time

A promote that cannot fail is the cron with a longer command line.

| break applied to `engine/policy.js` / the workflow | test result |
|---|---|
| every explicit validity refusal deleted (promote made unconditional) | 15 passed, 1 failed |
| the blank-species guard deleted | `a blank table was refused, but not by the blank guard` |
| the zero-cell guard deleted | `zero move cells refused, but not by the zero-cell guard` |
| the shrink band deleted | `A TABLE MISSING 90% OF THE LADDER WAS PROMOTED` + `--force overrode silently` |
| the tolerant staging replaced by plain `git add` | the two workflow failures quoted in §3 |

**The finding that made the test worth writing.** The first version of each arm asserted only a
non-zero exit code, and **the arms passed with their own guard deleted** — because the guards overlap:
with everything else removed, the shrink band alone still refused the blank, the unparsable and the
zero-cell fixtures. Then the tightened assertions had the same fault one level down: the zero-cell
message contains the substring `0 species`, so matching on digits let the blank guard be deleted and
stay green. Each arm now matches a **phrase unique to its own refusal**. Defence in depth is real here
(a blank file is caught three separate ways) and it is exactly what makes an exit-code assertion
worthless.

Final state: **17 passed, 0 failed.** The file is auto-discovered by `tests/run-all.js` (everything in
`tests/` is), needs no simulator, and skips its bash arm with a printed SKIP if no `bash` exists.

---

## 5. Two things measured on the way that are worth keeping

**The local plain store is five ingest-hours behind the tracked `.gz`.** `data/games.ladder.jsonl`
has mtime 02:34Z; `data/move-priors.json` came from ingest commit `1fe3ab3` at 18:53Z, derived on the
runner from the `.gz`-restored store. So a local `node engine/policy.js` reproduces the **06:22Z**
table, digest `4ae4509da65f` — **bit-for-bit identical to the frozen copy in release `603d9a69d5a3`**.
That is a clean determinism check on the derivation (same store in, same bytes out, against a copy
frozen twelve hours earlier) and a trap: deriving locally and calling the result current would silently
walk the engine BACKWARD. It is why `data/move-priors.observed.json` was seeded from the canonical
bytes rather than from the local run — the promotion debt at landing is **zero**, and
`--promote --dry-run` reports `NO CHANGE`.

**Provenance could not see the new artifact at first, and the reason matters.** With the derivation
written as `const OUT = POS[1] || OBSERVED`, `engine/provenance.js` could find no writer for
`move-priors.observed.json` and filed it under *"Nothing in this repository can be shown to generate
it"* — the bucket that is **exempt from every corpus check in that file**, which is the failure its own
comments were written about. The binding now carries the literal (`POS[1] ||
path.join(__dirname,'../data/move-priors.observed.json')`, the idiom provenance documents as the arm it
added for this very script) with a runtime assertion that the two spellings have not drifted apart.
After the fix: `move-priors.observed.json  ok`, attributed to `engine/policy.js`, and the run recorded
the coverage growth in `data/provenance-stamp.json` under `discoveries`.

`engine/provenance.js --strict` remains red at **26 unsafe, unchanged before and after** — a
pre-existing condition on unrelated artifacts, not something this change created or fixed.

---

## 6. What I refused to change, and why

- **`SOURCES` in `engine/engine_release.js`.** Out of scope by instruction and correct on the merits:
  §1 of the establishing report measures that this table changes a board. Not even a comment was added
  inside the array — the ENGINE agent is live in that neighbourhood.
- **`data/move-priors.json`.** Promoting it locally would move the engine BACKWARD (the local store is
  behind the runner's) and would mint a new release id under a live measurement chain. The promote step
  exists so that is a decision; the decision today is not to.
- **`engine/provenance.js`.** The establishing report recommends it carry `data/move-priors.json` as
  stale against the observed table. It already will, by derivation, once new games land — provenance
  reads the graph from source and now attributes both files correctly. Adding a hand-written rule
  would be a second implementation of something that already exists.
- **The rest of `.github/workflows/ingest.yml`.** The `.gz` restore, the two shrink guards, the dedupe
  and the push retry are untouched. The only structural edit is the staging list, and it was made
  BECAUSE the rename would otherwise put the run at risk, not for tidiness.
- **`tests/run-all.js` was not run.** The ENGINE agent has `engine/medicham2-browser.js`,
  `data/mechanics-census.json` and `tests/test-mechanics.js` open and modified; a full suite would
  report their in-progress state as failures of this change and would take every core while they work.
  The three pre-commit gates were run instead and are green
  (`test-docs-current` 21/21, `test-roadmap-register` 3/3, `test-artifact-rerunnable` 5/5), plus
  `test-policy-promote` 17/17 and `engine/provenance.js`.

## 7. Debris found and LEFT IN PLACE

Reported, not touched, per the standing rule:

- `engine/policy.js`'s human-peek block at the end prints a fixed list of four species, one of which
  (`amoonguss`) **is not legal in this regulation** — and the current store profiles it with 4,000+
  clicks, so the line renders real numbers for an illegal species. The list predates this change and
  the lookup is guarded, so removing it is a behaviour change to the derivation half of a file the
  live ingest depends on; it is flagged rather than edited. It is a symptom of the known
  custom-rule-game contamination in the corpus, which is OPS/ENGINE territory.
- `build/archive-regulation.js` archives `move-priors.json` and does not know about the observed
  table. Harmless today (the engine's copy is the one worth archiving); noted so it is not a surprise
  later.
- Running `engine/provenance.js` and `tests/test-docs-current.js` rewrites their own ratchet files
  (`data/provenance-stamp.json`, `data/docs-currency-baseline.json`). Both were already modified in the
  tree by the concurrent ENGINE work; my runs rewrote them from the current tree state. Flagged because
  two agents sharing a ratchet file is a collision the coordinator should look at before committing.

## Commands used

```
node engine/policy.js --promote --dry-run --from data/move-priors.json \
     --to data/releases/e12ef20e7910/data/move-priors.json      # the delta in §2, wrote nothing
tools\lownode.cmd engine\policy.js                              # the derivation, 14s
node tests/test-policy-promote.js                               # 17/17
node engine/provenance.js                                       # before and after: 26 unsafe
node tests/test-docs-current.js  tests/test-roadmap-register.js  tests/test-artifact-rerunnable.js
```
