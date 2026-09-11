# 2026-09-10 — conformance and the unaccounted-for check (MEASURE)

Historical findings record. Not maintained, not current state — `node engine/status.js` is.
No game was played. Nothing was committed. The conformance baseline was NOT rewritten.

## Verdict

| instrument | before | after | what is left |
|---|---|---|---|
| `engine/conformance.js` ratchet regressions | **107** | **21** | 12 S12 names (ENGINE's), 4 S12 literals in files ENGINE touched tonight, 5 S13 |
| `tests/run-all.js --coverage` unaccounted | **172** | **25** | 24 probes + `engine/docs_scan.js` |

Both instruments are still RED, and they should be. The conformance baseline is not rewritten while
any regression exists (`conformance.js` rule 3), so it was not forced.

Pins: live tree, 2026-09-10 20:34–21:10 EDT, with an ENGINE agent live. The unaccounted count rose
from the brief's 170 to 172 before I touched anything: ENGINE landed `probe_accuracy_roads.js` and
`probe_disguise_crit.js`, then `probe_encore_pp_end.js` (20:55) during the pass.

## 1. Conformance — 107 → 21

### S12 format literal — 57 → 4

- **46 files rewritten.** Each `Dex.forFormat('<id>')` in code became `CS.FORMAT` where a
  `const CS = require(...champions_sim...)` is declared EARLIER in the file (`probe_upkeep_lines.js`),
  and `require('../engine/champions_sim.js').FORMAT` otherwise. Using the inline form means no
  const is ever read in its temporal dead zone (`probe_trap_timing.js` declares `CS` 22 lines after
  its dex). The script rewrote 45 call sites, and four prose/const sites were edited by hand:
  - `probe_innards_out.js:105`
  - `probe_screens_infiltrator.js:84`
  - `test-residual-order-observed.js:34`
  - `test-unmodelled-clicks.js:180`, the artifact's `what` text

  Five COMMENT lines that quote the old call as dated prose were left as written (afterfaint:41,
  direclaw:43, innards:24, mega_trace:70, multiaccuracy:7).
- **Also `tests/test-mod-conformance.js:47`.** It carried the same literal as a byte-identical
  DISCOVERY (not one of the 57). Fixed, and it runs green.
- **8 were not probe defects — the brief's diagnosis was wrong about them.**
  - Affected files: `probe_accuracy_modifier_chain`, `confusion_selfhit_chance`,
    `mental_herb_update`, `pressure_terrain_target`, `residual_stop_body`, `stall_uncaused`,
    `status_clock_dice`, `weather_forme_faint`.
  - Every one already derives its dex through `CS.FORMAT`. The literal was a **replay id**:
    `tag: 'gen9championsvgc2026regmbbo3-2661122292 vs …'`. That is a store key naming one historical
    game.
  - Rewriting it through FORMAT would make it name a game that never happened once the regulation
    rotates. So the CHECKER was fixed instead:
    - `checkHardcodes` removes a battle-id token (a configured format id, an optional suffix, `-`,
      six or more digits) before searching.
    - `Dex.forFormat('<id>')`, `const FORMAT = '<id>'` and a bare id inside a string are all still
      caught. Proof on the same run: `probe_accuracy_roads.js` and `probe_disguise_crit.js` are still
      flagged for exactly that call.
  - This is a change to S12's rule, and it is stated in the checker.
- **Skipped because ENGINE touched them tonight. Still flagged:**
  - `tests/probe_accuracy_roads.js` (untracked, 20:32)
  - `tests/probe_disguise_crit.js` (untracked, 20:26)
  - `tests/probe_encore_pp_end.js` (untracked, 20:55; landed mid-pass)
  - `tests/test-stadium-roster.js` (ENGINE commit `4e56f637`, 20:23; the literal is in a reason
    string at :202)

### S13 — 38 → 5

- **Scratch (23 cleared).** `checkGeneratedFiles` skips a `_`-prefixed data file ONLY WHILE NO CODE
  NAMES IT. Comments are stripped over the same sources the scan reads. The moment a script reads a
  scratch dump it is judged like any other file.
  - Nothing was deleted. `docs/ENGINE.md` cites `_fire-*` and `_r220-dump-pre.json` as evidence.
  - `_diag77-cards.json` is named in `engine/medicham2-browser.js:16493` only inside a comment, so it
    is skipped. The skipped set (31 files) is printed on every run.
  - The 8 beyond the 23 are `_bench-*` / `_scratch-bench-smoke`, which carried no finding before
    either. The FIXED and DISCOVERY key sets are byte-identical before and after (diffed), so nothing
    left the ratchet unseen.
- **Declared sources (9 cleared).** The hardcoded `quality-filter|regulations` regex was used twice
  and is now a `DECLARED_SOURCES` table with one reason per file. Each reason was read from the file's
  own header or its reader, not recalled:
  - `test-waivers`, `scenarios-from-will`, `side-selection-declarations` (self-declared
    "HAND-WRITTEN")
  - `mc-declared-rows`, `mc-priors` (self-declared "HAND-AUTHORED")
  - `fixture-learnset-baseline`, `fixture-legality-baseline`
  - `effective-identity-baseline` (self-declared "RETIRED")
  - `artifact-accessors`
  - plus the two configs

  Every entry read `unknown` in `provenance.js --graph --json` on this date. **Declarations are
  checked, not trusted**: if the graph ever finds a writer for one, or the file disappears, the
  declaration itself becomes a finding.
- **The two "orphans" are NOT orphans. They are generated files whose writer the graph cannot see**,
  so declaring them sources would have been false:
  - `data/divergence-middle.json` is written by `engine/game_differential.js:9893` (the `DUMP_OUT`
    write; its `what` string is at :9894).
  - `data/all-mechanics-fire.boardstate.json` came from `engine/all_mechanics_fire.js --out`, added
    in `1c42ec80`.
  - `data/smogon-priors.observed.json` is in the same class: a `cp` in
    `.github/workflows/smogon-stats.yml`, a directory the graph does not scan.
  - All three stay flagged. The canonical fix is already in `provenance.js`: its "DECLARED BY THE
    ARTIFACT" arm resolves a `by` field. So the fix is owed by their writers.
  - Every one of those writers is in frame of ENGINE's live measurement, and `smogon_priors.js` is a
    release SOURCE, so none was touched.
- **Generated but unheadered (3 writers fixed, 1 cleared).** `publish_guard.js` now writes
  `generated_by` first, with `artifacts` last. `bench-medicham.js` and
  `test-artifact-rerunnable.js --stamp` now write `generated_by` first.
  - `published-samples.json` cleared because **ENGINE's engine-diff run at 21:03:15 rewrote it
    through my edited `publish_guard.js`**. Only the key order and the new key changed, and
    `test-publish-guard.js` passes 29/29 in its sandbox. But it IS a file I moved inside a live
    measurement's frame, and it is stated here plainly.
  - The other two clear on their writer's next deliberate run. I did not regenerate them: one is a
    ratchet restamp, the other a benchmark that plays games.

### Left as owed (12 × S12 Pokemon names in engine code)

`engine/all_mechanics_fire.js`, `argmax_paired.js`, `divergence_shape.js`, `empirical_driver.js`,
`faces.js`, `immunity_sweep.js`, `million_run.js`, `million_targets.js`, `orient.js`,
`quarantine.js`, `replay_differential.js`, `rollout_switch_probe.js`.

## 2. UNACCOUNTED-FOR — 172 → 25

**The rule, derived at run time in `tests/run-all.js`.** A `tests/probe_*.js` is derived
PENDING-WIRE, with the blocker "plays a game", when both of these hold:
- its source contains a `require(` whose argument names `champions_sim`, `game_differential`,
  `staged_board`, `medicham2-browser`, `_live_release`, `engine_release` or `probe_pair`;
- its basename appears inside an inline backtick span of `docs/ENGINE.md` (fenced blocks add 0,
  measured).

A hand `NOT_A_CHECK` / `PENDING_WIRE` entry wins. An unreadable ledger derives NOTHING and prints
why. The stale-exemption check still covers only the hand tables. A derived entry cannot go stale by
construction.

**Re-derived counts.** 148 classified, not the brief's 150. Matching `require\(` tightly against a
quoted literal finds only 58, because most probes build the path with
`require(D('engine','champions_sim.js'))`. So the looser `require\([^)]*<name>` is the correct form.

**It still prints what it hid, on every run:** "34 carry a `VERIFIED BY:` marker in docs/ROADMAP.md
(executed by engine/register_reality.js, which is itself unwired here), **114 have NO RUNNER
ANYWHERE**", followed by all 114 names.

**Shown RED first.** I planted `tests/probe_zz_measure_red_plant.js`, which requires
`champions_sim` and has no ENGINE.md row:
- unaccounted went 25 → 26, the plant was listed by name, and the derived count stayed at 148;
- the plant was then deleted. I created it; its absence was confirmed with `ls`.

The opposite direction is covered by three real files that ARE named in ENGINE.md and load no game
module; they stay unaccounted: `probe_control_self_name`, `probe_corner_arm_measures`,
`probe_state_void_exclusion`.

**The 25 it leaves, by name:**
- `engine/docs_scan.js`
- plays a game, no ENGINE.md row: `probe_accuracy_modifier_chain`, `probe_accuracy_roads`*,
  `probe_ally_safeguard`, `probe_berserk_switcheroo`, `probe_disguise_crit`*, `probe_encore_pp_end`*,
  `probe_format_id_derivation`, `probe_instrument_digest`, `probe_mental_herb_update`,
  `probe_metronome_game`, `probe_pivot_magic_bounce`, `probe_release_drift_diagnosis`,
  `probe_resist_berry_resolved_type`, `probe_spread_target_die`, `probe_stat_pick`,
  `probe_status_blocksstatus`, `probe_thaw_after_secondary`, `probe_weather_forme_faint`
  (* = ENGINE's, landed tonight)
- named in ENGINE.md, loads no game module: `probe_control_self_name`, `probe_corner_arm_measures`,
  `probe_state_void_exclusion`
- neither: `probe_protect_amplification`, `probe_rotated_ladder`, `probe_usage_regulation_pool`

## 3. Exit 2 — yes, a bare exit 2 is SKIP (ROADMAP #380, reported, not fixed)

- `tests/run-all.js:812`: `else if (r.status === 2)` pushes to `skip`, with no `ABRA-EXIT`
  declaration required. The exit code is `fail.length || coverageFailures` (`:870`), so a skip never
  reds the suite.
- `engine/register_reality.js:498` DOES require `ABRA-EXIT <n> <VERDICT-GREEN|VERDICT-RED|CANNOT-ANSWER>`.
  **The two runners disagree on what exit 2 means.**
- Measured with `grep -l 'process\.exit(\s*2\s*)\|exitCode\s*=\s*2'`:
  - **198 probes** have an exit-2 path and **5** print `ABRA-EXIT` (the brief's 146/1 used a
    narrower pattern);
  - **44 `tests/test-*.js`** have one and **0** print it.
- Those 44 are in the suite TODAY, so a test whose fixture fails to stage and exits 2 reads as a
  SKIP beside a green exit. The laundering is live for tests. For probes it is latent until they are
  wired.

## Verification done (no games)

- `node --check` passes on all 52 edited `.js` files.
- `FORMAT` resolves to the active format with no fallback line on stderr.
- `tests/test-ohko-accuracy.js`: ALL GREEN, 11 checks. It loads the live simulator ENGINE is
  editing, so this is a smoke run, not a certificate.
- `tests/test-mod-conformance.js`: passed.
- `tests/test-publish-guard.js`: 29 passed, 0 failed (sandbox ratchet only; checked before running).

## Notes-row text (for ENGINE to apply; my recommendation is PATCH, because no published figure moves)

```
## [<next>] — 2026-09-10 — conformance stops failing on correct code and unaccounted probes are classified by a derived rule
- **What changed.** `engine/conformance.js`: S12 no longer reads a replay id as a format hardcode; S13 skips a `_`-prefixed scratch dump only while no code names it, and the hardcoded `quality-filter|regulations` regex became a checked `DECLARED_SOURCES` table. 46 tests/probes derive `FORMAT` from `engine/champions_sim.js` instead of typing it. `engine/publish_guard.js`, `tests/bench-medicham.js`, `tests/test-artifact-rerunnable.js` write `generated_by` first. `tests/run-all.js` derives PENDING-WIRE for a probe that loads a game-playing module and is named in `docs/ENGINE.md`, and prints the 114 of them with no runner by name.
- **Measured.** Conformance regressions 107 -> 21 (`data/conformance.json`, live tree); run-all unaccounted 172 -> 25 (148 derived, 34 with a VERIFIED BY marker). Both still red; the conformance baseline was not rewritten. Detail: `docs/_reports/2026-09-10-conformance-and-unaccounted.md`.
- **Basis.** unchanged.
- **Supersedes.** Nothing.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` (the S12/S13 checker rules and the derived PENDING-WIRE rule).
```

## OWED, NOT RUN

ENGINE, when its probes settle: replace the four remaining literals, then clear the 12 S12 names.

```bash
grep -n "gen9championsvgc2026regmb" tests/probe_accuracy_roads.js tests/probe_disguise_crit.js tests/probe_encore_pp_end.js tests/test-stadium-roster.js
node engine/conformance.js    # the baseline is written only by the first run with 0 regressions
```

Writers owed a `by` field (canonical arm: `engine/provenance.js` `declaredWriter`). Not touched,
because each is in frame of a live measurement:

```bash
grep -n "fs.writeFileSync(D(DUMP_OUT)" engine/game_differential.js       # add by: 'engine/game_differential.js'
grep -n "fs.writeFileSync(f, JSON.stringify(report" engine/all_mechanics_fire.js   # add by: 'engine/all_mechanics_fire.js'
grep -n "smogon-priors.observed.json" .github/workflows/smogon-stats.yml   # engine/smogon_priors.js is a release SOURCE — OPS/ENGINE decision
```

The two headered artifacts clear on their writer's next deliberate run. Each is an owner's call: the
first restamps a ratchet, the second plays games and needs a quiet machine.

```bash
node tests/test-artifact-rerunnable.js --stamp
node tests/bench-medicham.js --record
```

The 114 derived probes with no runner anywhere, on a settled tree (they play games):

```bash
node tests/run-all.js --coverage | sed -n '/have NO RUNNER ANYWHERE/,/FAIL — UNACCOUNTED/p'
```

The 25 still unaccounted: write the ENGINE.md row, or give a hand `NOT_A_CHECK` / `PENDING_WIRE` reason.

```bash
node tests/run-all.js --coverage | sed -n '/FAIL — UNACCOUNTED/,$p'
```

Exit 2 as SKIP (ROADMAP #380): make `run-all.js:812` honour the `ABRA-EXIT` declaration the way
`register_reality.js:498` does.

```bash
grep -ln 'process\.exit(\s*2\s*)\|exitCode\s*=\s*2' tests/test-*.js | xargs grep -L 'ABRA-EXIT'
```
