# The Reg M-C write guard and the `tests/` writers (ENGINE, abra/regmc 1.30.1)

*(Run 2026-09-29, evening. The file name carries the date the brief gave it.)*

## Verdict

Fixed, for six files. `ABRA_REGULATION=regmc node tests/test-game-diff.js` played all five scripted games and then
exited 1 on the artifact seam's write guard. It now exits 0 and writes `data/game-diff-regmc.json`. The plain run
still exits 0 and writes `data/game-diff.json`. The same decision moved five more `tests/` files. The six are
`game-diff`, `forme-assert`, `switch-back-renamed`, `tag-walk`, `tag-consumption` and `unmodelled-clicks`.

The decision came from what each file is built from, not from the refusal's "declare it". All six stage bodies from
the regulation's table, read the regulation's tags, or play against the regulation's Showdown checkout. So all six
are per regulation.

Three things the sweep found that the brief did not name:

1. **Two ratchets passed quietly under Reg M-C against Reg M-B's baseline.** `test-tag-consumed.js` checked 320 Reg
   M-C tags against Reg M-B's floor and printed `ok ... no tag lost a consumer it had at the baseline`. After that it
   died on the guard. `test-unmodelled-clicks.js` compared against Reg M-B's list, found `0 -> 0`, did not write, and
   **exited 0**. This is the same hazard as `provenance-stamp.json` in 1.25.1.
2. **A bare `fs.readFileSync` of an engine source file is NOT redirected.** `require('data/tags.json')` follows the
   regulation because the module resolver maps it. `fs.readFileSync('data/tags.json')` returns Reg M-B's bytes under
   Reg M-C. This was checked directly: fs read == `tags-regmc.json` is **false**, and require == `tags-regmc.json` is
   **true**. `test-game-diff.js --pairs` and `test-unmodelled-clicks.js` read the tags that way. Both are fixed here.
   **38 other call sites in `tests/` and `engine/` are not fixed** (two of them read Reg M-B on purpose). See *OWED*.
3. **A test that never loads `engine/regulation.js` is not guarded at all.** `tests/mechanics_rank.js` and
   `tests/mechanics_surface.js` wrote their Reg M-B files under `ABRA_REGULATION=regmc` and exited 0. That is harmless
   here only because their output is byte-identical to a plain run once `generated` is dropped (shown below).

## What `game-diff.json` is built from

| input | regulation? | evidence |
|---|---|---|
| the Showdown checkout (`engine/champions_sim.js`) | **per regulation** | `CS.PINNED_COMMIT` is `f10d6798…` under regmc and `20ad99ff…` under regmb. The artifact stamps it as `showdown_commit`. |
| the damage table (`require('data/engine-data.js')`) | **per regulation** | the resolver maps it to `data/engine-data-regmc.js` |
| the tags (`fs.readFileSync('data/tags.json')`, used by `--pairs`) | **per regulation**, but was read as Reg M-B's | fs reads are not redirected. It now reads `REG.fileFor('data/tags.json')`. |
| the scripts (`GAMES`) | shared | code |

So the artifact is per regulation. Readers of `data/game-diff.json`: `app/quarantine-data.js` and
`web/quarantine-data.js` (a static list of names) and `engine/provenance.js` (sweeps `data/*.json`). None is a gate
input.

## The change

- `engine/regulation.js` `PER_REGULATION_ARTIFACTS` gains `game-diff.json`, `forme-assert.json`,
  `switch-back-renamed.json`, `tag-walk.json`, `tag-consumption.json` and `unmodelled-clicks.json`.
- Each of the six test files names its output through `REG.artifactFor`, so the printed path is the written path.
  `test-game-diff.js` also stamps `regulation` and `format` in the artifact.
- `test-game-diff.js` and `test-unmodelled-clicks.js` read the tags through `REG.fileFor('data/tags.json')`.
- `test-tag-consumed.js`: an absent baseline now prints `NO BASELINE — … the two ratchet checks … DID NOT RUN`.
  Before, it skipped both checks without a word. That did not matter while the file always existed. It matters now,
  because the first run under a new regulation has no sibling. `test-unmodelled-clicks.js` already said
  `no baseline on disk`.
- `tests/test-regulation-artifacts.js` part 2 maps the six names. They move under regmc and stay the same under regmb.

## Proof (all plain `node`, serial; this harness refuses `cmd /c tools\lownode.cmd`)

| run | exit | wrote |
|---|---|---|
| `ABRA_REGULATION=regmc node tests/test-game-diff.js`, before | **1** | nothing. It played 5 of 5 games (all AGREE), then `REFUSING to write …\data\game-diff.json` |
| same, after | 0 | `data/game-diff-regmc.json`: `regulation: regmc`, `showdown_commit: f10d6798…`, 5 games, all agree |
| `node tests/test-game-diff.js`, after | 0 | `data/game-diff.json`: `regulation: regmb`, `showdown_commit: 20ad99ff…`. Equal to HEAD's once `generated`/`regulation`/`format` are dropped |
| `-r ./tests/_live_release.js tests/test-forme-assert.js` regmc, before / after / plain | 1 (REFUSING) / 0 / 0 | `forme-assert-regmc.json` (6 of 6 rows agree) / `forme-assert.json` |
| `-r ./tests/_live_release.js tests/test-switch-back-renamed.js` regmc, before / after / plain | 1 (REFUSING) / 0 / 0 | `switch-back-renamed-regmc.json` (4 of 4 arms) / `switch-back-renamed.json` |
| `tests/walk_tags.js` regmc, before / after / plain | 1 (REFUSING) / 0 / 0 | `tag-walk-regmc.json` / `tag-walk.json` |
| `tests/test-tag-consumed.js` regmc, before / after (no sibling) / after (sibling) / plain | 1 (REFUSING, after passing against M-B's floor) / 0, prints NO BASELINE / 0, `ok … no tag is DEAD outside the ratchet floor (3 accepted)`, not rewritten / 0 | `tag-consumption-regmc.json`: 320 tags, 187 live, 3 dead. Reg M-B: 308 / 178 / 3 |
| `tests/test-unmodelled-clicks.js` regmc, before / after / second / plain | **0, compared against Reg M-B's list** / 0, `no baseline on disk — this run writes the first one` / 0, `0 -> 0` against its own sibling / 0 | `unmodelled-clicks-regmc.json` (0 moves) |
| `tests/test-regulation-artifacts.js` | 0 | 31 passed, 0 failed |
| `test-regulation-runtime.js`, `-table.js`, `-steering.js`, `test-red-run-writes.js`, `test-no-silent-failure.js` | 0 each | |
| `tests/test-docs-current.js` | see the commit | run after the docs moved |

The plain proof runs rewrote the Reg M-B files. Those were restored with `git checkout --`, so Reg M-B's record is
not republished. The six `-regmc` siblings are committed as the first Reg M-C readings. They are live-tree readings
(HEAD `e8733316` plus this change), not frozen-release readings.

**Is the regulation actually reaching these tests?** Three of the six gave byte-identical content under both
regulations (`forme-assert`, `switch-back-renamed`, `tag-walk`). Identical output across a varied input is the
unwired-knob signature, so this was checked. Each run prints the checkout it loaded: `pokemon-showdown-mc` under
regmc, and `SHOWDOWN_PATH` overridden to that checkout by `_live_release.js`. `game-diff` goes through the same
`champions_sim` door and stamps the other commit. The identical rows are therefore agreement on the same six formes,
four arms and 40 tags in both checkouts. They are not a knob that failed to move. `tag-walk` still walks Reg M-B's
hand tag list (`data/abra-tags.js`, which is not per regulation). That caveat is noted below.

## The sweep: every `tests/` script that writes a fixed `data/` path

Method: every `writeFileSync` / `appendFileSync` / `createWriteStream` / `renameSync` / `copyFileSync` /
`writeThrough` in `tests/*.js` (58 files), with each target resolved to its definition. Where the run was light,
it was run under regmc to see what happened, not predicted.

### Fixed (per regulation, declared)

| script | file | why per regulation |
|---|---|---|
| `test-game-diff.js` | `game-diff.json` | checkout + table + tags |
| `test-forme-assert.js` | `forme-assert.json` | checkout + table + tags (`require`) |
| `test-switch-back-renamed.js` | `switch-back-renamed.json` | checkout + table; reads `divergence-turns.json` (already declared) |
| `walk_tags.js` | `tag-walk.json` | checkout + table |
| `test-tag-consumed.js` | `tag-consumption.json` | the regulation's tags and table; a ratchet |
| `test-unmodelled-clicks.js` | `unmodelled-clicks.json` | the regulation's table and tags; a ratchet |

### Already per regulation (declared before this change)

`roster.js` (`roster*.json`), `test-mechanics.js` (`mechanics-census.json`), `test-engine-diff.js`
(`engine-diff.json`), `test-interaction-matrix.js` (`interaction-matrix.json`), `test-register-reality-readonly.js`
(`register-reality.json`, which it restores byte for byte).

### Left alone, with the reason

| script | file | why left |
|---|---|---|
| `mechanics_rank.js`, `mechanics_surface.js` | `mechanics-rank.json`, `mechanics-surface.json` | **neutral, measured.** They read `data/abra-tags.js` and the engine source, and never load `regulation.js`. The regmc output equals the plain output once `generated` is dropped. Run them plain. (The regmc run overwrote the tracked files, which were restored.) |
| `test-rulebook-collision.js` | `rulebook-collision.json` | NOT RUN: it needs `../CHOMP/data/move-effects.json`, which is not beside a worktree. Its second rulebook is CHOMP's file, not the regulation's `data/move-effects-regmc.js`. Declaring it would publish a Reg M-C comparison against a file the Reg M-C engine does not read. It needs a redesign (compare against `fileFor('data/move-effects.js')`), not a declaration. Owed. |
| `test-knob-control-arm.js` | `probe-knob-arms.json` | **unguarded.** It loads no `regulation.js`, so under regmc it would overwrite Reg M-B's file silently, while its child probes run under regmc. Its inputs are per regulation. Not fixed, because proving it means running every self-spawning knob probe in both arms, which is not light. Owed. |
| `test-medicham-coverage.js` (+ `regulation_usage.js`) | `medicham-coverage.json` (`--stamp` only), `regulation-usage.json` (cache; the refusal is caught and printed as a NOTE) | the denominator reads `data/games.ladder.jsonl` and `fs.readFileSync('data/tags.json')`, so under regmc it is Reg M-B's usage and tags. That is a store-routing question, larger than a declaration. Heavy (a 4096 MB heap). Owed. |
| `mutation_harness.js` | `mutation-coverage.json` | per regulation in truth, heavy. Owed. |
| `bench-medicham.js` | `medicham-bench.json` | written on `--record` only; a speed baseline on a fixed machine. Run it plain. |
| `test-degradation-budgets.js` | `degradation-budgets.json` | `--ratchet` only; reads the self-play and bo3 stores (MEASURE/SOLVER). Not ENGINE's. |
| `test-docs-current.js` | `docs-currency-baseline.json` | a docs gate; run it plain (1.25.1 precedent). |
| `test-artifact-rerunnable.js`, `test-json-nan-guard.js`, `test-no-silent-failure.js`, `test-site-data-fresh.js`, `test-board-browser.js` / `test-click-match.js` / `test-mc-key.js` (`--update`) | their baselines | static code or release checks; regulation-neutral. |
| `test-engine-release.js` | edits and restores `data/move-priors.json` | a release-mechanics test. Under regmc `guardWrites` refuses the Reg M-B engine file, which is correct. Run it plain. |
| `test-miltank-release.js` | `data/.miltank-release-probe-<pid>.jsonl` | a new file each run; the guard allows new files. |
| `test-regulation-*.js`, `test-red-run-writes.js`, `test-publish-guard.js`, `test-arm-steering.js`, `test-sprt-arm-sign.js`, `test-release-pin-no-cut.js`, `test-policy-promote.js`, `probe_rotated_ladder.js`, `probe_usage_regulation_pool.js`, `probe_release_drift_diagnosis.js`, `probe_instrument_digest.js`, `probe_priority_bar_effective_ability.js`, `probe_divergence_*`, `regmc_probe_kit.js`, `medicham_api_diffhook.js`, `probe_lownode_argv.js`, `probe_roster_fixture_legality.js` | temp dirs, env-named or flag-named paths, or deliberate guard probes | none write a fixed live `data/` file. |
| `probe_item_disposition.js`, `probe_knockoff_berry_consumers.js`, `probe_prankster_target.js`, `probe_bench_plants.js`, `probe_endstate_by_cause.js` | `data/verification/*.json` | one-off, dated Reg M-B evidence. The seam redirects `data/<name>` only, not a subdirectory, so under regmc these are refused, which protects the record. If one is re-asked for Reg M-C, follow `probe_prankster_dark_result.js`, which already suffixes `-regmc` by hand. |

Not a finding of this change: `test-forme-assert.js` and `test-switch-back-renamed.js` print `FIXTURE ILLEGAL …
can't learn Focus Energy` (13 and 8 sets). They print the same counts under **both** regulations, so the defect
predates Reg M-C.

## OWED, NOT RUN

```bash
# 1. The fs-read class: 38 call sites take an engine source by fs.readFileSync and get Reg M-B's bytes under Reg M-C
#    (tags.json, move-priors.json; list via this grep). Includes tests/interaction_matrix.js:71 and
#    tests/test-interaction-matrix.js:56 (the Reg M-C matrix's pair generator reads its carrier bags and usage this way), test-engine-diff.js:129
#    (move-priors), engine/policy.js, engine/joint_click_census.js, engine/scenario_catalogue.js, engine/format_audit.js.
#    Decide per reader. A blanket seam redirect would break tests/probe_regmc_move_effects.js, which reads the owner
#    table by fs ON PURPOSE.
grep -nE "readFileSync\([^)]*'(tags\.json|move-priors\.json|protocol-events\.json|engine-data\.js|move-effects\.js)'" tests/*.js engine/*.js
# 2. test-knob-control-arm.js: load engine/regulation.js, declare probe-knob-arms.json, then prove it (spawns every knob probe twice)
ABRA_REGULATION=regmc node tests/test-knob-control-arm.js
# 3. test-rulebook-collision.js: compare against REG.fileFor('data/move-effects.js'), not CHOMP's file; main checkout only
# 4. test-medicham-coverage.js / regulation_usage.js: route the denominator to the regulation's store and tags (heavy, 4096 MB)
# 5. tag-walk under Reg M-C still walks Reg M-B's hand tag list (data/abra-tags.js); a Reg M-C list is a design question
```
