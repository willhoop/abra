# The quarantine classifier: three routes fixed by rule, the ratchet cleaned, SEARCH's figures withdrawn — 2026-09-11

MEASURE. A historical findings record; it is not maintained. Nothing was committed or pushed, and no game was played.
ENGINE was live in the game slot throughout, on `engine/medicham2-browser.js`, `engine/stage_planner.js`, `tests/roster.js`
and the files it names. None of those was touched.

## Verdict

1. **The classifier was wrong in both directions, and it is fixed by three derived rules. No name was added and no
   gate clause changed.** The withheld set is **64 of 256 before and 69 of 258 after**: 13 artifacts are newly held
   and 8 are released. Every route was shown RED on the old classifier first: `--selftest` gave 246 passed and 5
   failed before the fix, and 251 passed and 0 failed after.
2. **The ratchet baseline dropped the 17 keys that no longer fire, derived by running the test. It also gained 4
   keys, and that is the one judgement call in this pass** (see item 2). The brief's premise that nothing ran this
   test is refuted: `tests/run-all.js` already discovers it with its `tests/test-*.js` glob.
3. **SEARCH's R8, R12 and R20 figures are withdrawn, and so is the seed-source audit's own class size.** The #283
   use counts are not from that audit and stay. R9 and R10 still print figures from an artifact that stays withheld.
   That is owed to SEARCH.
4. **The deck and MODELS carry the dated update `GATE: CLOSED — 1 of 9`** (open-defect clause; #318, #511), as
   read at 15:03Z. Later in the pass the gate read `7 of 8`, but only because ENGINE's edit was live in the tree.
5. **Both named tests are green on the final bytes.** Two defects of my own were found and fixed during
   verification (see the section on self-inflicted defects).

## Item 1 — the classifier (`engine/quarantine.js`)

### Each suspected artifact, checked against its generator chain

| artifact | the ledger pass suspected | generator chain, measured | verdict |
|---|---|---|---|
| `data/replay-differential*.json` (6) | an instrument, wrongly withheld | `engine/replay_differential.js` REL.requires the simulator, requires `champions_sim.js`, reaches **no** `board.js`. It replays stored human games and compares the board to the record | **released** — an instrument |
| `data/exploit-step-probe*.json` (2) | an instrument, wrongly withheld | requires `exploit.js`, which reaches `board.js`; and it **reads `data/policy-weights.json`** (MAG's vector, for the coordinate scales `x0`) | **stays withheld**, on two independent routes. Refuted. |
| `data/policy-weights-pre-censoring.json` | a MAG vector, not withheld | no discoverable writer (provenance: "named in the CODE of engine/censoring_value.js but never beside a write"); exactly the 16 top-level keys of `data/policy-weights.json`; `corpus.decisions` 231,722, the 3.40.0 fit | **now withheld** |
| PORYGON2 gate file and its family | named in CLAUDE.md, not withheld | `engine/porygon2.py` trains on `data/games.selfplay.porygon2.raw-logs.jsonl`, which `engine/mew.js` wrote by playing MEDICHAM. A Python generator was never read by the dump route | **now withheld** (7 files) |

### The three rules — none of them adds a name

1. **Both engines side by side, and no model** (`sideBySideInstruments`). A play-layer module that requires the
   official engine (`engine/champions_sim.js`) in its OWN source and reaches no `engine/board.js` is an instrument.
   Measured on the tree: 80 play-layer modules, 68 reach `board.js`, and 8 of the other 12 require the official
   engine directly. All 8 compare MEDICHAM against an authority. Four of them this file already exempted by other
   routes, without being told this rule. The file's own claim that the differential and the backtest share a graph
   signature is refuted: `backtest_winrate.js` reaches `board.js` and `game_differential.js` does not.
   - **DITTO is why the rule needs both halves.** `engine/ditto.js` reaches MEDICHAM (`winProb2`) without `board.js`
     and is a consumer, so "reaches no model" alone would clear a DITTO artifact.
   - `engine/million_run.js` is now derived and leaves the declared list. `engine/medicham_coverage.js` reaches
     `board.js` and stays declared.
   - The rule transitive through the official engine is dead: every module that reaches MEDICHAM reaches
     `champions_sim.js`, through `tags.js` and `mc_key.js`.
2. **Python generators are read for their dumps** (`foreignSource`). Docstrings and `#` comments are stripped.
   `tests/*.js` is deliberately left out, because `tests/` is outside `sources()` by design.
3. **An artifact with no writer is judged by what it says about itself, and only in the withholding direction**
   (`describedBySelf`). Two forms count: an exact top-level key set shared with a held artifact (5 keys or more), or
   a field whose whole value names a held artifact other than itself. A twin of a clean artifact stays unclassified.
   Such rows keep `by: null` and stay in `unclassified`, so `tests/test-provenance-discovery.js` still finds the two
   tools naming the same unknown set.

### Red first

Eleven selftest arms were written before the fix and run against the old classifier. The five RED arms failed:
side-by-side, Python dump, key twin, declared input, and the `node null` re-run. The six CONTROLS passed: DITTO's
shape stays held; both engines plus `board.js` stays held; a Python human-store reader stays clean; a docstring
mention stays clean; a twin of a clean artifact stays unknown; a self-naming field is not an input. After the fix
all eleven pass.

### Before and after, from `node engine/quarantine.js --graph` on the real tree

| newly HELD (13) | released (8) |
|---|---|
| `exploitability-holdout.json` (declared input) | `replay-differential.json`, `-bo3`, `-sheets`, `-freezes`, `-bo3-freezes`, `-sheets-freezes` |
| `policy-weights-pre-censoring.json` (key twin) | `immunity-sweep.json` |
| `porygon2.json`, `-curve`, `-open`, `-species`, `-separation-gate`, `porygon2c.json`, `porygon2c-dist.json` | `speed-vs-pokeenv.json` |
| `pory-nn.json`, `lookahead-bound.json`, `lookahead-clock-control.json`, `rollout-r1-withdrawn-join.json` | |

**`pory-nn.json` is held and its receipt cannot clear it.** The artifact's `sources` says ladder only. But
`engine/pory_nn.py`'s `--transfer` arm trains on self-play and writes `sources` from `paths`, which `--transfer` never
updates. The receipt would therefore say "ladder" after a self-play training run. This is the #547 shape, and it is
filed below.

## Item 2 — `tests/test-docs-quarantine.js`

- **17 keys removed**, exactly the list the test printed under "DELETE these lines": 11 in MEASURE, 2 in MODELS and
  4 in SEARCH. Fifteen were cleared by the earlier ledger passes, and 2 (R20's `1.576%` and `51,399`) by this pass.
- **4 keys added.** After the fix the test found `231,722` and `46,162` from the pre-censoring vector standing in
  `docs/ABRA-whitepaper.md` (twice), `docs/ABRA-technical-docs.md` and `docs/ENGINE-COVERAGE-PLAN.md`. These
  figures were already published. The classifier had never seen them before; no document gained a figure in this
  pass.
  - The brief does not let me edit those documents. The file's rule is "may only shrink", and its own history grew
    the list once for this exact reason (the 2026-09-06 "PLUS 40 THAT NOTHING COULD SEE UNTIL TODAY").
  - So the keys are in a separate, commented block that says the figures are owed out of those documents. **If the
    coordinator prefers, withdraw the four figures instead and delete the block.**
- Result: 37 keys stand, 0 are dead, and all checks pass.
- **Registration:** `node tests/run-all.js --list` prints `RUN tests/test-docs-quarantine.js`, because discovery is
  `/^test-.*\.(js|py)$/`. `tests/run-all.js` was not edited. `--only tests/test-docs-quarantine.js` gives `ok (17.4s)`,
  1 passed.
  - The runner still exits 1 on its separate coverage clause: 25 unaccounted-for checks (`engine/docs_scan.js`,
    `engine/exit_codes.js` and 23 `tests/probe_*.js`). All of them are committed files this pass did not touch.

## Item 3 — SEARCH's figures, confirmed against the derived set

| section | artifact | held after item 1? | what came out |
|---|---|---|---|
| R8 | `exploitability.json`, `exploitability-holdout.json` | yes (the holdout by the new rule) | the mirror control's value, interval and sample, and the conclusion drawn from it; the old headline and its interval, everywhere it was named; the struck search-best and held-out values; the round-0 mirrors; the accepted-step counts and final step scales; the worst evaluation; the late-round cluster. Configuration (features, games per evaluation, rounds, seed), timings, pool counts and the planned re-run's budget stay. |
| R12 | `pp-board-probe.json` | yes | the before/after table's cells, and the pre-fix `\|cant\|nopp` and Struggle counts. The spent counts (configuration) and `maxpp` (from `data/tags.json`) stay. |
| R20 | `feature-shift.json` | yes | the verdict's counts and shares; every table cell; the purity count. The population definitions (384 candidates, +9 turns, 300 games) are configuration and stay. |
| #283 seed-source audit | `seed-source-audit.json` | yes (it requires `board.js`) | only the audit's own class size ("six"). **The 9,163 uses and the per-move counts are not in that artifact**: `tests/test-board-clock-power.js` prints them from `board.unmodelledBasePower` and the store, so they stay. The ledger pass's attribution was wrong for them. |
| #276 | none found | — | `32.2%` and `2.95` are in no withheld artifact. Left as they are. |

**Owed, and not done because the brief did not list them:** R9 and R10 print `data/exploit-step-probe*.json`
figures, and that artifact stays withheld. The sections are about 340 lines. This does not change the ratchet: key
`docs/SEARCH.md|960,000|data/exploit-step-probe.json` still stands.

### Also withdrawn, because this pass is what made them withheld

- **MEASURE:** the PORY-NN retrain figures (the §5d addendum); the PORY-NN `val_logloss` and `auc` (§5e); its
  declared count (§5f); every result in §18, the PORYGON2 separation gate, including the verdict, the controls'
  results, the smoke run's R, the `alive_diff` weight and the any-turn R.
  - The drift percentages in §5c, §5e and §5f stay. They are MEASURE's staleness instrument, not the model's output.
- **MODELS:** the 3.40.0 fit corpus (8,856 games / 231,722 / 185,560 / 46,162); the reach counter's share; the
  sheet-channel floor; the PORYGON2 corpus and its table.
  - The table became a sentence, because a table of withheld cells re-keyed a configuration label (`k=200`) as a
    new unbound figure in `tests/test-docs-current.js` clause 3b(d).
- **Released and now quotable:** the replay-differential figures in MEASURE's "ROADMAP #68". They were left in
  place by the last pass, correctly as it turns out.

## Item 4 — gate-count wording

- **Readings of `node engine/quarantine.js` during this pass:**
  - **2026-09-11T15:03:14Z, HEAD `b8f7d999`:** `GATE: CLOSED — 1 of 9 GATING clauses fail`. The only FAIL is
    `no open, known engine defect`, on #318 and #511.
  - **15:15:56Z and 15:32:30Z:** `GATE: CLOSED — 7 of 8`. Every artifact clause printed "ran on release
    `e368827481f5` and the tree is `b42b81899631`", because ENGINE's edit to `engine/medicham2-browser.js` (and
    later `engine/stage_planner.js`) was live.
  - `engine/quarantine.js` is not among the release's 27 frozen sources, so this pass did not cause the change. The
    dated lines cite the 15:03Z reading, with its HEAD and time.
- **Where the update was added:**
  - `docs/ABRA-deck-plain-english.md`, after the correction paragraph that ends "fails on two of its nine tests". It
    is in plain words; the only item named is Focus Sash, which the format allows.
  - `docs/MODELS.md`, after the head correction and after the "MECHANICS STATE, CORRECTED 2026-09-11" paragraph.
    Both carried "2 of 9" in the present tense.

## Item 5 — verification (final bytes)

| check | result |
|---|---|
| `node engine/quarantine.js --selftest` | 251 passed, 0 failed |
| `node tests/test-docs-quarantine.js` | all checks passed; 37 stand, 0 dead |
| `node tests/test-docs-current.js --staged` | **37 passed, 0 failed** — judged on a scratch index: HEAD plus the six changed files, plus the proposed notes row and CHANGELOG entry spliced into HEAD's copies. It used a scratch object directory with the real objects as a read-only alternate. |
| `node tests/test-provenance-discovery.js` | all clear; quarantine and provenance name the same unknown set |
| `node tests/test-no-silent-failure.js --in engine/quarantine.js` and `--in tests/test-docs-quarantine.js` | 0 and 0 |
| `node build/build_pdfs.js` | 5 built, 0 failed: the deck and MODELS (changed here) plus the white paper, the technical docs and SUMMARY, which were already stale beforehand. The white paper's tracked name is `docs/ABRA-WhitePaper.pdf`. |

## Self-inflicted defects, found in verification and fixed

- **Three NUL bytes in `engine/quarantine.js`.** The schema-twin key was `k.join('<NUL>')` with a literal NUL.
  - Git's autocrlf treats any NUL as binary and skips conversion. The diff therefore read 13,306 changed lines for
    a +271/−31 change.
  - It is replaced with `JSON.stringify(k)`. Afterwards: NUL 0, and numstat 271/31. Selftest, graph and the ratchet
    were all re-run on the fixed bytes.
- **`data/docs-currency-baseline.json` was rewritten by `test-docs-current --staged`.**
  - A passing run tightens that file on disk, and it stamped `changelog_top_at_baseline: "6.20.0"`, read from the
    scratch index. That version exists nowhere else, and the file would have misled the next gate that read it.
  - The file was clean before the runs. The run's output was identified by that stamp and restored to HEAD after
    each passing run; it is clean now.
  - The real commit's gate will tighten it legitimately.

## Findings for the register (text in the verdict)

- SEARCH R9 and R10 print withheld `exploit-step-probe` figures.
- Four pre-censoring figures stand in the white paper, the technical docs and the engine coverage plan.
- `engine/pory_nn.py`'s `--transfer` receipt defect.
- The `tests/` residual: `tests/test-degradation-budgets.js` reads `data/games.selfplay.jsonl`, and the classifier
  never reads `tests/`.
- `engine/seed_source_audit.js` claims in its header and artifact (`notQuarantined`) that it is not downstream;
  the classifier holds it because it requires `board.js`.
- Six `policy-weights-*.json` variants have 15 keys and no exact twin, so they stay unclassified, not withheld.

## OWED, NOT RUN

Record and commit. Not done, on instruction. The notes row and the CHANGELOG entry are in the verdict returned to
the coordinator. The version `6.20.0` is provisional, because ENGINE may take it first.

```bash
git add engine/quarantine.js tests/test-docs-quarantine.js \
        docs/SEARCH.md docs/MEASURE.md docs/MODELS.md docs/ABRA-deck-plain-english.md \
        docs/ABRA-deck-plain-english.pdf docs/MODELS.pdf docs/ABRA-WhitePaper.pdf docs/ABRA-technical-docs.pdf docs/SUMMARY.pdf \
        docs/_reports/2026-09-11-quarantine-classifier.md docs/RUNNING-NOTES.md CHANGELOG.md
git commit          # the pre-commit gate will tighten data/docs-currency-baseline.json itself; add it if it does
```

Once ENGINE's tree settles, restamp. Neither was run: `--check` writes `data/quarantine-stamp.json`, and `--write`
rewrites generated blocks in `docs/ENGINE.md`.

```bash
node engine/quarantine.js --check      # the stamp's withheld list moves 64 -> 69
node engine/status.js --write
node tests/run-all.js                  # the --only run is not the suite
```

The figures owed out of documents this pass could not edit. Delete each baseline key the day its figure goes.

```bash
grep -nE '231,722|46,162' docs/ABRA-whitepaper.md docs/ABRA-technical-docs.md docs/ENGINE-COVERAGE-PLAN.md
grep -nE '0\.21 points|4\.77 pt|0\.45 pt|960,000|49\.9 ± 2\.2|63\.9 ± 2\.4' docs/SEARCH.md      # R9, R10 — SEARCH's
grep -nE '63\.59%|0\.612|73,368' docs/ABRA-whitepaper.md docs/SUMMARY.md docs/ABRA-technical-docs.md   # PORYGON2 / PORY-NN elsewhere
```

The withheld figures return only when the gate opens and each artifact is re-run. The refit is expensive: **ask Will
before starting it.**

```bash
node engine/quarantine.js              # must read OPEN first
python engine/porygon2.py && python engine/porygon2_separation_gate.py --run
python engine/pory_nn.py
node engine/exploit_step_probe.js && node engine/exploit_step_probe.js --reparam
node engine/feature_shift.js && node engine/pp_board_probe.js && node engine/seed_source_audit.js
```
