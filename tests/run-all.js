/* run-all.js — run every check in the repository. The list is DERIVED, never typed.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/run-all.js
 *   node tests/run-all.js --list          show what would run, and what would be skipped
 *
 * WHY THIS EXISTS
 * ---------------
 * The CI job list in `.github/workflows/tests.yml` was typed by hand, one `- name:` step per test.
 * On 2026-07-27 it named 6 of the 18 test files in this repository. The twelve it omitted included
 * `tests/test-quality.js`, `tests/test-docs-current.js`, `tests/test-site-sync.js` — and
 * `engine/selftest.js`, the file whose own header calls it "the checks that catch silent wrongness".
 *
 * That check was failing at the time nobody was running it: 17 files read the raw ladder store with
 * no clean filter and no declaration, which is the GARBODOR rule, the single defect this project has
 * recorded catching itself on more than any other.
 *
 * This is S13 (if a fact can be derived from an artifact, no human types it) applied to the test
 * list itself. A hand-kept list of tests is a promise to remember to add the next one, and this repo
 * has now demonstrated twice — here and in the PDF build list — that the promise is not kept.
 *
 * SKIPS ARE LOUD. A check that needs the Showdown simulator cannot run without SHOWDOWN_PATH. It is
 * reported as SKIPPED with its reason and counted in the summary. A silent skip is indistinguishable
 * from a pass, which is the failure mode this whole file is about.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
/* Stamped once, before any child runs, and handed down so a check can tell an artifact THIS SUITE
 * rewrote from one that was already stale when it started. See the env note further down. */
const SUITE_STARTED_AT = Date.now();
const LIST_ONLY = process.argv.includes('--list');
/* --coverage computes the COVERAGE VERDICT ALONE and runs no child at all. It exists so the
 * assertion below can be demonstrated red on a deliberate break without spending a suite run — and
 * so it can be armed at all during another division's pass, when running the engine would be
 * measuring a moving target. It exits on the coverage verdict only; it is not a substitute for the
 * suite and says so on the tin. */
const COVERAGE_ONLY = process.argv.includes('--coverage');

/* ---- discovery ------------------------------------------------------------------------------- */

/* Every path in this file is written with FORWARD SLASHES, including on Windows, because these
 * strings are compared against each other (GATES vs the exemption lists vs discovery) as well as
 * handed to D(). path.join() yields a backslash on win32, so a `tests\x.js` from discovery would
 * never equal a `tests/x.js` in a list — an exemption that silently fails to match is exactly the
 * class of defect this file is about. D() accepts either. */
const testFiles = fs.readdirSync(D('tests'))
  .filter(f => /^test-.*\.(js|py)$/.test(f))
  .sort()
  .map(f => 'tests/' + f);

/* The engine-side gates. These live in engine/ because other tooling imports them, so they cannot be
 * found by globbing tests/. The coverage assertion below is what stops this short list from becoming
 * the same hand-maintained lie as the CI file it replaces. */
/* validate_selfplay.js is included even though the corpus it gates is gitignored: it exits 2 when the
 * store is absent, and exit 2 is treated as SKIP below. That keeps it visible in every run instead of
 * being a gate nobody remembers, which is what it was. */
/* artifact_audit.js is a gate rather than a report because the hole it found was invisible for as
 * long as nobody ran it: data/engine-data.js carried `ab: null`, `mv: []` and `item: null` on every
 * mega forme — 26.0% of this format's usage — while data/mega-dex-official.json held all of it and a
 * builder existed to apply it. Nothing compared the derived artifact to its source, so a build step
 * that had been silently undone stayed undone. Running it every time is the whole point (Will:
 * "arent we making sure all fixes get applied to every applicaiton? how was this not caught?"). */
/* validate_damage.js is the GOLDEN MASTER against @smogon/calc — the guard on the number every other
 * result depends on. It was NOT in this list, and the coverage assertion below did not notice,
 * because that assertion detects a check by its OUTPUT FORMAT and this file reports an aggregate
 * table plus `process.exit(1)` rather than "N passed, N failed". So the meta-check written to stop
 * unrun checks was itself fooled, by the most important check in the repository.
 *
 * Proven during the 2026-07-31 engineering review by mutation: neutering Sword of Ruin (0.75 -> 1.00)
 * dropped within-5% agreement to 94% (needs >=95) with a worst case of 25% (needs <=8), and
 * validate_damage caught it while the full suite stayed green. It exits 2 when @smogon/calc is
 * absent, which this runner treats as SKIP, so listing it is safe on a machine without the dep. */
/* provenance.js runs with --strict, which exits 1 when any artifact is UNSAFE TO QUOTE. Both the
 * 2026-07-31 systems audit and the engineering review found the same thing independently: the tool
 * was correct, complete, and wired to nothing, so 31 artifacts computed under superseded filter rules
 * sat unflagged while the roadmap called them "the blocker on everything in section 3".
 *
 * Two independent reviews finding the same unwired gate is the signal. It is wired now. If this is
 * red, the fix is to REGENERATE the artifacts it names — not to remove it from this list. */
const GATES = ['engine/selftest.js', 'engine/conformance.js', 'engine/artifact_audit.js',
  'engine/validate_damage.js', 'engine/validate_damage_sim.js', 'engine/provenance.js',
  'engine/validate_selfplay.js',
  /* engine/sanity_check.py — 96 assertions, called MANDATORY in the handoff docs, and it was in no
   * suite. The runner has always been able to execute .py (it resolves an interpreter and skips
   * cleanly when none exists); this list simply never named it, so the cross-consistency checks that
   * tie the docs to the artifacts ran only when somebody typed the command by hand. That is how a
   * published PORY log-loss of 0.567 survived while the artifact said 0.6321. Whole-repo review,
   * 2026-07-31. */
  'engine/sanity_check.py',
  /* engine/em_validation.js — the Stage C estimator gate, docs/CLICK-CENSORING-FIX.md. It is run
   * with --check, which VERIFIES the recorded verdict and re-hashes every source the measurement
   * depended on, rather than re-running tens of minutes of conditional-logit fits inside the suite.
   * Editing engine/click_class.js or engine/fit_policy.js therefore turns this red until the
   * measurement is re-run, which is the hash-not-mtime rule engine/status.js already applies to the
   * leaf. Listing it without --check would put a 25-minute fit in the suite; not listing it at all
   * would leave a gate that nothing runs, which the assertion below exists to forbid. */
  'engine/em_validation.js',
  /* engine/status.js --selftest — the refit edge's own verdict logic, on synthetic artifacts.
   * status.js is a REPORTER and is not otherwise gated, which is exactly how it printed
   * `refit edge: CLEAN` for two days over a corpus contrast that had measured three feature columns
   * MOVING. The muzzle case and the never-run case both returned a bare null, so the caller could not
   * tell "the second instrument disagrees with this tree" from "the second instrument has never been
   * run" and reported the fixture's answer as the whole answer. Six cases, no filesystem, no dex —
   * it costs milliseconds, and it is red on the pre-fix behaviour with 4 of 6 failing. */
  'engine/status.js',
  /* engine/rerun_list.js --selftest — ROADMAP #57's verdict logic. It reports which published numbers
   * were measured on an engine we now know was wrong, and the distinction it must never lose is
   * UNSTAMPED vs STALE: a stale number can be re-run and compared, an unstamped one cannot be compared
   * to anything. Eight cases, synthetic input, no filesystem. The DECLARED N/A case is in there because
   * the first version read dusk-size-gate.json's prose explanation as a release id. */
  'engine/rerun_list.js',
  /* engine/validate_store.js --selftest — legality comes from Showdown's own TeamValidator, which is
   * the authority the SERVER uses. It replaced a count-based heuristic (a rejected species that is
   * RARE means the game is anomalous, COMMON means our dex is stale). Will killed that on sight and
   * he was right: "legal = common is the worst possible logic i could think of". In a format that
   * hands out mega evolutions, a Pokemon with no mega is rare BECAUSE it is outclassed, not because
   * it is illegal — so the heuristic's whole discriminator is confounded, and a real check existed
   * the entire time. The selftest pins the error CLASSIFIER, which is the only hard part: a
   * closed-sheet replay yields a partial team, and incompleteness must not read as illegality. */
  'engine/validate_store.js',
  /* engine/diff_swarm.js --selftest — team selection for the whole-game differential (ROADMAP #68 §3).
   * The case that matters is the one it caught on its own first real run: a config whose feature set
   * derives EMPTY accepts every team, reports 100% of the pool, and does no work at all. Two of the
   * nine were wrong that way (`lowersOnEntry` for `onSwitchInDrop`, `setsWeather` for `weatherSetter`)
   * and both looked like the best-covered configs in the swarm. The selftest asserts no config accepts
   * everything; the derivation asserts no feature set is empty. Synthetic input, milliseconds. */
  'engine/diff_swarm.js',
  /* engine/names.js --selftest — A NAME MUST BE DERIVED. Seven lookups were typed instead of derived
   * in one evening: Excadrill's stone is EXCADRITE not Excadrillite; Floette-Eternal's mega is
   * `floettemega` not base+'mega' (WIRE 132's assumption, made again a day later in a measurement);
   * Intimidate's tag is `onSwitchInDrop` not lowersOnEntry; weather abilities are `weatherSetter` not
   * setsWeather. Every one matched NOTHING, returned empty, and read as a measurement of zero.
   * A LOOKUP THAT MATCHES NOTHING IS AN ERROR, NOT AN EMPTY SET. Its own selftest caught a typed
   * assumption too — it asserted Garchomp has no mega, and Garchomp megas here.
   *
   * It is names.js and NOT lookup.js because lookup.js already existed, for the adjacent job of making
   * a MISS declare itself. Writing this one over it deleted resolve(), which mc_key.js calls, and took
   * down self-play. lookup.js = what to do when an answer is ABSENT; names.js = how to ask correctly. */
  'engine/names.js',
  /* engine/quarantine.js --check — EVERYTHING DOWNSTREAM OF MEDICHAM IS WITHHELD UNTIL MEDICHAM IS
   * CORRECT (CLAUDE.md; Will, 2026-08-08). It runs engine/status.js and fails if a quarantined
   * artifact's own verdict sentence is on that screen.
   *
   * It is a gate rather than a report for the reason the whole rule exists: status.js ALREADY printed
   * `PRE-CHANGE — measured against a different build of: ...` beside these numbers, and they went on
   * being quoted for days by the sessions that printed the caption. A caption is not a quarantine, and
   * a check nobody runs is not a check — the identical pair of lessons that produced
   * engine/artifact_audit.js. Shown RED before it was registered: the leaf-calibration withhold was
   * removed by hand and --check exited 1 naming data/winrate-backtest.json and the leaked sentence.
   *
   * It does NOT fail on docs/ or web/ citations. Those belong to other divisions and MEASURE cannot
   * satisfy a gate it may not edit, which is how a red check becomes "one of the known failures". Those
   * are listed every run and RATCHETED in data/quarantine-stamp.json instead: the list may shrink and
   * may never grow while the gate is closed. */
  'engine/quarantine.js',

  /* ================ WIRED IN 2026-08-23, WHEN THE COVERAGE ASSERTION WAS ARMED ==================
   * Five files the assertion below had been naming as unrun for as long as it has existed, buried in
   * a 27-name WARNING that could not fail the build. Each was run individually first and its exit
   * code recorded — none of them plays a game (no medicham2-browser.js, no game_differential.js) and
   * none of them writes an artifact, so their verdicts do not depend on a simulator that another
   * division was editing at the time. That is why these five and not the other nineteen. */

  /* engine/gate_fail_and_silent.js — ROADMAP #241(3)'s own `INSTRUMENT OWED`: the authority announces
   * a failure and this engine says nothing. Measured 2026-08-23: exit 2, CANNOT ANSWER — the artifact
   * ran on release 59bb68aa89a9 and the tree is 7da11c1d4d10, so the count is WITHHELD rather than
   * printed with a caveat. Exit 2 is SKIP here, which is the validate_selfplay precedent: a gate that
   * cannot answer stays VISIBLE every run instead of being one nobody remembers. It turns 0 or 3 the
   * moment its artifact is re-measured, which is the point of listing it. */
  'engine/gate_fail_and_silent.js',
  /* engine/gate_offfield_target.js — ROADMAP #224's re-taking gate: the `??:` slot placeholder
   * reaching the protocol stream. Measured 2026-08-23: exit 2, NO CURRENT ARTIFACT (both artifacts it
   * reads were measured against other bytes). Same reasoning as above — it is listed so that the
   * re-run it is asking for is asked for on every run. */
  'engine/gate_offfield_target.js',
  /* engine/gate_seed_source_audit.js — ROADMAP #287's `INSTRUMENT OWED`: data/seed-source-audit.json
   * named a class by substring-matching a hand-typed list of fifteen field names. Measured
   * 2026-08-23: exit 0, CLEAN (4 derived, 4 claimed). */
  'engine/gate_seed_source_audit.js',
  /* engine/gate_weather_guard.js — ROADMAP #286's FUNCTIONAL arm: `weatherSetupHelpsPartner` guarded
   * itself on a field nothing ever writes. Measured 2026-08-23: exit 0, CLEAN. */
  'engine/gate_weather_guard.js',
  /* engine/divergence_shape.js --selftest-by-default — the shared "same event, different slot means
   * ORDERING" classifier, extracted out of divergence_report.js the moment game_differential.js
   * became a second reader, precisely so there would not be two implementations of one fact. A shared
   * fact with no standing check is how the two copies drift back apart. Measured 2026-08-23: exit 0.
   * It loads no simulator and writes nothing. */
  'engine/divergence_shape.js',
  /* engine/identity_audit.js — WHO ANSWERS "which roster body is this". Registered on the day the
   * FIFTH instance of the species-key class landed (ROADMAP #465, the party keyed on the displayed
   * species). It is here rather than in NOT_A_CHECK for the reason engine/mc_key.js's header gives:
   * every previous fix in this class was a list of known-bad spellings, and the next instance used a
   * spelling that was not on the list. This one derives its membership from the resolver's own source
   * at run time, so a field the door starts consulting tomorrow is audited with no edit. It costs
   * about a second, it names its own hole in its header, and `--break` proves it can go red. */
  'engine/identity_audit.js',
  /* THE THREE BELOW WERE UNACCOUNTED FOR UNTIL 2026-08-27 AND EACH WAS MEASURED ALONE BEFORE BEING
   * LISTED. None of them plays a game, which is why they could be certified during an ENGINE pass
   * when the fourteen probes below could not: nothing they read was moving.
   *
   * engine/generated_audit.js --no-rebuild — every generated file in the repo against the source it
   * was built from. data/abra-tags.js has drifted from data/tags.json FOUR times, the fourth 38
   * minutes after the third was fixed, and both files carry an IDENTICAL `generated` stamp, so no
   * staleness heuristic can ever see it. THE ARGUMENT IS LOAD-BEARING AND IS THE WHOLE REASON THIS
   * LIST CANNOT BE DERIVED: bare, this file RE-RUNS EVERY BUILDER, which has the suite rewrite
   * artifacts its own children are reading. `--no-rebuild` keeps membership and declarations and
   * gives up rebuild-agreement, and that is a REAL WEAKENING rather than a free win — the run says
   * so itself, printing an UNPROVABLE count and the line "a generated file nothing can compare is
   * not a file that agrees with its source". Measured 2026-08-27: exit 0, 16s, GREEN on what it can
   * prove. Wire the rebuild half the day something can give it a scratch tree to build into. */
  'engine/generated_audit.js',
  /* engine/move_result_state.js --selftest — `mvFail(mon)` is ONE call that writes a protocol line
   * AND the `_mvRes` state field, and until this file only the line had an instrument, which is why
   * every deferral of the announce-failure class cited the same missing half. THE ARGUMENT IS AGAIN
   * LOAD-BEARING, and in the direction this brief warns about: bare, this file is a LIBRARY, does
   * nothing and exits 0 — a registered gate that silently no-ops, which is worse than an
   * unregistered one. Measured 2026-08-27 with --selftest: 18 passed, 0 failed, exit 0,
   * milliseconds, no filesystem, no dex, no game. Its RED cases are real ones (each of the four
   * values of moveThisTurnResult must be distinguishable from the other three). */
  'engine/move_result_state.js'];

/* COVERAGE ASSERTION. Any file in tests/ or engine/ that reports its own pass/fail verdict is a
 * check, and a check that nothing runs is worse than no check — it reads as coverage in a review. If
 * one turns up that is neither a listed gate, nor discovered in tests/, nor named below with a
 * reason, this runner FAILS rather than quietly ignoring it.
 *
 * THAT SENTENCE WAS FALSE FOR AS LONG AS IT HAD BEEN WRITTEN, AND IT WAS THIS FILE'S OWN COMMENT.
 * `unrun` was printed as a WARNING block and the exit expression read `process.exit(fail.length ? 1
 * : 0)` — `unrun.length` was not in it. So the meta-check built to stop unrun checks was itself a
 * warning nobody ever had to act on, carrying 27 names of which roughly eighteen were not checks at
 * all, with the six genuine unrun gates buried in the noise. A comment claiming the opposite of its
 * code is the same defect as a caption used as a quarantine: the words are read, the behaviour is
 * not. Armed 2026-08-23; the exemption lists below came FIRST, because arming it against 27 unsorted
 * names would have shipped a red runner, which is how a gate gets ignored. */
/* WIDENED 2026-07-31. This detected a check purely by its reporting idiom, so a file that gates by
 * exit code without printing "N passed, N failed" was invisible — which is exactly how
 * validate_damage.js, the damage golden master, sat outside the suite unnoticed. A check is now also
 * anything that calls process.exit with a non-zero literal, which is what a gate DOES rather than
 * what it PRINTS. Behaviour is the honest signal; formatting is not. */
/* AND THAT WIDENING WAS SILENTLY HALF-DEAD. Its announce clause read
 * `/REGRESSION|FAIL:|<0x08>FAIL<0x08>/` — two RAW BACKSPACE BYTES where `\bFAIL\b` was written, the
 * escapes flattened by some tool between the keyboard and the disk. A raw 0x08 outside a character
 * class matches a literal backspace, so the third alternative could never fire and the clause was
 * really `/REGRESSION|FAIL:/`. A regex that READS correctly and does not RUN is this repository's
 * signature failure, and this one had been sitting inside the meta-check itself.
 *
 * FIXED 2026-08-23 AS `/REGRESSION|FAIL/`, DELIBERATELY NOT AS THE `\bFAIL\b` THAT WAS WRITTEN.
 * Restoring the literal intent would have NARROWED the detector, and that was measured rather than
 * argued: on this tree `\bFAIL\b` flags 28 engine files where the plain substring flags 45, because
 * the boundary rejects FAILED, FAILURE and `\nFAIL` — the last being how engine/validate_damage_sim.js
 * announces itself. Three of the files the boundary drops are genuine checks, one of them
 * engine/feature_fixture.js, THE REFIT GATE. Dropping a real gate to honour an escape sequence is
 * fixing a red by narrowing the detector, which is the single move this section forbids. The noise
 * the boundary was guarding against is answered BY NAME below instead, which is the sanctioned
 * mechanism. Every variant was counted on this tree before this paragraph was written. */
/* WIDENED AGAIN 2026-08-23, and the previous widening had a hole of exactly the shape it was written
 * to close. A gate that ends `process.exit(bad ? 1 : 0)` matched neither clause: not the reporting
 * idiom, and not `process.exit(1)` as a bare literal. `tests/staged_board.js` ends that way and was
 * invisible; so do all four ROADMAP `gate_*.js` files. A COMPUTED non-zero exit is a VERDICT by
 * construction — a file does not compute a status code out of its own findings by accident — which is
 * why this clause, unlike the bare-literal one, does NOT also require the file to print the word
 * FAIL. The bare `process.exit(1)` clause keeps its announce requirement because 36 engine files
 * exit(1) on ordinary error handling; the two clauses have different false-positive profiles and are
 * argued separately rather than merged.
 *
 * The body is `[^;\n]*` and not `[^)]*` deliberately: `tests/staged_status_counters.js` ends
 * `process.exit(main() ? 1 : 0)`, and a predicate that cannot contain a call would miss it.
 *
 * SHOWN RED FIRST, on this tree, before being trusted — the tests/test-lownode.js discipline. The old
 * predicate does NOT flag tests/staged_board.js; this one does. */
/* WIDENED A THIRD TIME, 2026-08-27, AND THE STALE-EXEMPTION CLAUSE IS WHAT FOUND THE HOLE. The
 * assertion reported `tests/probe_red_demo.js — the file still exists but no longer trips the
 * detector`, and the tempting read is that a stale name should simply be deleted. It was not stale.
 * The file had changed its EXIT IDIOM: it now computes a status into a variable and ends
 * `process.exit(CODE)` (line 4725), having declared `ABRA-EXIT <n>` on stderr first. That matches
 * neither the bare literal nor the ternary, so a gate this runner had been watching for days went
 * invisible by being IMPROVED. Deleting the exemption would have recorded the disappearance as
 * housekeeping — the exact laundering the by-name lists exist to stop.
 *
 * A COMPUTED EXIT HELD IN A VARIABLE IS THE SAME VERDICT AS A COMPUTED EXIT WRITTEN INLINE. The
 * announce requirement is kept, for the reason the bare-literal clause keeps it: `process.exit(rc)`
 * on its own would sweep in ordinary error plumbing. MEASURED ON THIS TREE BEFORE BEING WRITTEN,
 * over both directories: this clause adds exactly TWO files and no others —
 * `tests/probe_red_demo.js`, whose exemption stops being stale, and `engine/derive_protocol_events.js`,
 * a real two-gate conformance check (`process.exit(bad)`, line 390) that NOTHING has ever run and
 * that no list here has ever named. That second one is the whole return on the widening. */
const COMPUTED_EXIT = /process\.exit\(\s*[^;\n]*\?\s*1\s*:\s*0\s*\)/;
const IDENT_EXIT = /process\.exit\(\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\)/;
const looksLikeACheck = src => /\d+ passed, \$\{?F?\}? ?failed|passed, .*failed/.test(src) ||
  /console\.log\('  ok   '/.test(src) ||
  /* A GATE, detected by what it DOES rather than how it prints: it exits non-zero AND announces a
   * regression. `process.exit(1)` alone is far too broad -- 36 engine files exit(1) on ordinary
   * error handling, and widening to that made this assertion cry wolf, which is the same defect it
   * exists to prevent. Both clauses are required. */
  (/process\.exit\(\s*1\s*\)/.test(src) && /REGRESSION|FAIL/.test(src)) ||
  COMPUTED_EXIT.test(src) ||
  (IDENT_EXIT.test(src) && /REGRESSION|FAIL/.test(src));

/* ===================== THE TWO BY-NAME LISTS ====================================================
 *
 * THE RULE THAT GOVERNS BOTH: DO NOT FIX A RED BY NARROWING THE DETECTOR. If a file trips
 * looksLikeACheck and genuinely is not a check, it is named HERE with its reason. The predicate is
 * never loosened until the noise stops — an over-firing gate is the one people learn to ignore
 * (ROADMAP #148), and a quietly narrowed one is worse, because it looks like coverage.
 *
 * A reason is not decoration. Every entry below was classified by READING that file's own header in
 * the pass that added it, never from memory, and every claim of the form "already exercised by X" was
 * checked by grepping for a real `require(` edge — a filename mentioned in a comment is not coverage,
 * and tests/test-mechanics.js mentions almost everything.
 *
 * NOT_A_CHECK — a model, a bot, a fit, a generator, a rebuild tool or a measurement driver. It
 * reports a NUMBER or produces an ARTIFACT; it asserts no contract, so there is nothing for a suite
 * to be green or red about. These are settled, not owed. */
const NOT_A_CHECK = {
  'engine/argmax_paired.js':          'MEASUREMENT — a paired A/B of what MILTANK actually clicks. Reports a difference; asserts no contract.',
  'engine/conditional_audit.js':      'MEASUREMENT — how often a move whose payoff depends on the opponent\'s simultaneous choice whiffs, per decision rule. A rate.',
  'engine/ditto.js':                  'MODEL — DITTO, the double-oracle team optimiser. It produces teams.',
  'engine/fit_policy.js':             'FIT — writes data/policy-weights.json and needs --max-old-space-size=4096. A fit is not a gate; what it fits is guarded by engine/feature_fixture.js, which is in PENDING_WIRE below.',
  'engine/game_differential.js':      'INSTRUMENT / DRIVER — the two-engine comparison driver. Its verdict is already gated by engine/quarantine.js --check and by tests/test-game-diff.js, both listed. Running it here would put a multi-hundred-game run inside the suite AND rewrite data/game-differential.json, which other readers hold.',
  'engine/ladder.js':                 'TRAINING LOOP — improves the policy by winning, against an opponent that improves with it. It produces weights.',
  'engine/leaf_position_contrast.js': 'MEASUREMENT — reconciles two leaf measurements that disagree. Downstream of MEDICHAM and QUARANTINED.',
  'engine/lookahead_cost.js':         'MEASUREMENT — GATE 2 of docs/LOOKAHEAD-design.md: an affordability budget answered once, not a standing contract.',
  'engine/mag_bot.js':                'BOT — puts MAG on a running Showdown server so a human can challenge it. It cannot run unattended.',
  'engine/medicham_coverage.js':      'MEASUREMENT — what fraction of real clicks MEDICHAM can represent. Its contract is gated by tests/test-medicham-coverage.js, which IS discovered.',
  'engine/mew.js':                    'DATA ENGINE — MEW, the self-play generator. It produces games.',
  'engine/million_run.js':            'RATE RUNNER — plays MEDICHAM at volume against data/million-targets.json. Hours. The PROVENANCE of every target it checks is gated by tests/test-target-provenance.js, which IS discovered.',
  'engine/opponent_calibration.js':   'MEASUREMENT — is MAG a usable sampler of the opponent. Writes data/opponent-calibration.json.',
  'engine/rebuild_records.js':        'REBUILD TOOL — regenerates store records from the raw protocol logs. It WRITES the store.',
  'engine/redirect_audit.js':         'MEASUREMENT — how much of the joint fit\'s drop rate is redirection. Writes data/redirect-audit.json.',
  'engine/replay_differential.js':    'MEASUREMENT DRIVER — replays real stored games through the engine and counts divergences against what actually happened.',
  'engine/reprocess.js':              'REBUILD TOOL — rebuilds a game store from the raw logs. It WRITES the store, and declares RAW-STORE-OK for reading dirty records.',
  'engine/rollout_r1.js':             'MEASUREMENT — gate R1 of docs/ROLLOUT-design.md, a design question answered once. Its figure is QUARANTINED downstream of MEDICHAM.',
  'engine/rollout_r3.js':             'MEASUREMENT — gate R3 of docs/ROLLOUT-design.md, likewise. QUARANTINED.',
  'engine/sheet_usage.js':            'COUNT — ability and item usage tallied from declared open sheets. A report.',
  'engine/showdown_bot.js':           'BOT — plays MAG in the real Showdown client. Needs a live server.',
  'engine/surprise.js':               'REPORT — ranks where MAG\'s expectations disagreed with what the game did.',
  'engine/tag_dex.js':                'GENERATOR — writes data/tags.json. Its OUTPUT is gated by the discovered test-tag-*.js family (consumed, params-derived, signature, wire). Having the suite regenerate the tags would have the suite rewrite its own input.',
};

/* PENDING_WIRE — this IS a check, it is NOT wired in, and this is exactly what has to happen before
 * it can be. This list is the honest half, and it is NOT a quieter word for "known failure":
 * CLAUDE.md allows a red exactly two states, fixed in the session that saw it or waived by Will by
 * name, and nothing here is being carried as a red. Each is carried as NOT YET IN, with the blocker
 * named and, where it is somebody's, the owner named.
 *
 * It may shrink by wiring a file in. Growing it means editing this file and writing down a reason —
 * a person deciding once, in writing, which is the standard an artifact meets when it declares
 * `"rerun": false`. A silence does not meet it.
 *
 * EVERY tests/ ENTRY BELOW SHARES ONE CONDITION, AND IT IS NOT A JUDGEMENT ABOUT THEM. Every one
 * loads engine/medicham2-browser.js, engine/champions_sim.js or engine/game_differential.js — every
 * one PLAYS A GAME. The pass that armed this assertion ran beside an ENGINE agent landing simulator
 * fixes, so a green taken from any of them would have been a photograph of a moving subject
 * (CLAUDE.md: nothing in frame may move). Nine were measured green on 2026-08-22; that is recorded
 * below as EVIDENCE, not as a certificate.
 *
 * (THIS SENTENCE READ "THE SIXTEEN tests/ ENTRIES" UNTIL 2026-08-27, when fourteen more were
 * classified into it. The count was cosmetic and it is still not typed here, for the reason the
 * whole file exists: a number in prose beside a list is a promise to remember to change it, and
 * this repository has a fourteen-handoff record of not keeping that promise.)
 *
 * AND A SECOND CONDITION SPLITS THEM, WHICH THE LIST DID NOT PREVIOUSLY RECORD. Some of these are
 * cited in a `VERIFIED BY:` marker in docs/ROADMAP.md, which engine/register_reality.js EXECUTES
 * with execFileSync on every pass — the probe_red_demo.js arrangement. Those have a runner and do
 * not want a second one. The rest have no runner anywhere. The distinction is stated per entry
 * rather than assumed, because it is the difference between "covered elsewhere" and "covered
 * nowhere", and reading the first where the second is true is how a check goes missing. Note the
 * sting in the tail: engine/register_reality.js is ITSELF in this list, so a probe whose only
 * runner is the register is covered by something the suite does not run either. */
const PENDING_WIRE = {
  'tests/interaction_matrix.js': 'LIBRARY + self-audit. Its module contract is exercised by tests/test-interaction-matrix.js (a real require, discovered). Its require.main block audits the generated cross-product and measured exit 0 on 2026-08-22. Not certified since: it loads medicham2-browser.js at module scope.',
  'tests/mutation_harness.js': 'RED, and not MEASURE\'s. Triage calibration ran 3 MATCH / 1 WRONG on damageMultAll/lifeorb (docs/_reports/2026-08-22-runner-blind-spot.md) — measured on the exact bytes an ENGINE agent was rewriting, so it may already have cleared. A full sweep also WRITES data/mutation-coverage.json, so it would have to be wired as --gate-only --no-write. Re-measure on a settled tree first. Consumed by tests/test-mutation-coverage.js.',
  'tests/probe_ability_volatile_line.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK with NO RUNNER ANYWHERE. The mechanism: when an ABILITY rather than a move applies a volatile, the authority\'s `-start` line names the ability and the ability writes no line of its own, so an engine that announces both says the same thing twice. Four of the 57 volatiles a legal move can apply here branch on the source effect — Attract under Cute Charm, Charge under Electromorphosis or Wind Power, confusion under any ability, Disable — and the membership was printed over the format\'s whole move table before anything was wired. Blocker: it loads champions_sim.js and game_differential.js, so it plays a game and could not be certified beside a live ENGINE agent. It carries no VERIFIED BY marker in docs/ROADMAP.md, so engine/register_reality.js does not reach it either. Landed 2026-08-23 in 21f44515 and has been run by nobody but its author.',
  'tests/probe_announce_failure.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK with NO RUNNER, and the one whose absence has cost the most. The mechanism: `mvFail(mon)` is ONE call that writes a protocol line AND the `_mvRes` state field that Stomping Tantrum\'s doubler reads NEXT turn, so adding the line silently changes state that nothing measured — which is, in its own words, why every deferral of the announce-failure class stalled. Each arm reports THREE verdicts that are never merged: BOARD at the turn boundary, RESULT via engine/move_result_state.js, and the protocol stream. NOTE THE ASYMMETRY THIS PASS CREATED AND DID NOT HIDE: move_result_state.js, the instrument this probe was built alongside, is now a listed gate on its --selftest, so the LIBRARY is checked while the probe that uses it against real games still is not. Blocker: plays a game. Named in a ROADMAP row in PROSE but NOT in a `VERIFIED BY:` marker, so the register cannot execute it — the exact distinction register_reality.js\'s header says the marker syntax exists to make impossible by accident.',
  'tests/probe_bracket_counters.js': 'Measured exit 0 on 2026-08-22 (bracketRederived 1988, moved 6). Plays medicham2-browser.js; not re-certified against a moving simulator.',
  'tests/probe_drag_body.js': 'REFUSES to run without --release <id> (exit 2), because requiring the driver bare would cut a junk release. That is correct behaviour. Wiring it needs a RELEASE PIN in the EXTRA table, and choosing that pin belongs to whoever owns the baseline, not to the runner.',
  'tests/probe_fail_and_silent.js': 'Measured exit 0 on 2026-08-22 (6 staged, 0 parted). Plays the game_differential driver; not re-certified.',
  'tests/probe_hazard_recap_fail.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK, and it HAS a runner. The mechanism: a hazard laid at its own cap (a third layer of Spikes, a second of Toxic Spikes) FAILS, and the authority announces that failure rather than silently absorbing the click. Blocker for wiring HERE: it plays a game, and it wants the `-r ./tests/_live_release.js` preload or a `--release <id>` pin, which is a baseline choice this runner may not make. NOT UNRUN, though: docs/ROADMAP.md carries `VERIFIED BY: node -r ./tests/_live_release.js tests/probe_hazard_recap_fail.js`, and engine/register_reality.js execFileSyncs every marker it finds. CORRECTED 2026-08-28: THAT SENTENCE WAS FALSE WHEN IT WAS WRITTEN AND THIS ENTRY WAS THE PROOF. `SAFE` required the marker to begin `node <script>` and permitted flags only, so the `-r ./tests/_live_release.js` preload made it NOT_STARTED — an unaccounted check is RED and this one read GREEN, inside the table built to prevent exactly that. `SAFE` now admits the preload (ROADMAP #521) and the claim is true. MEASURED THE SAME DAY: exit 0, 5 arms, A and D part under MEDI_HAZARD_RECAP_SILENT=1. With the caveat written at the head of this list, that register_reality.js is itself unwired here.',
  'tests/probe_lifeorb_toll.js': 'Same --release refusal as probe_drag_body.js. It landed with the Life Orb work in 186cb65 and has never been run by anything except its author.',
  'tests/probe_mega_damage_abilities.js': 'Measured exit 0 on 2026-08-22 (11 arms played, 0 RED). Plays medicham2-browser.js; not re-certified.',
  'tests/probe_mega_priority.js': 'Measured exit 0 on 2026-08-22 ("all arms clear"). Plays the game_differential driver; not re-certified.',
  'tests/probe_mental_herb_order.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK, and it HAS a runner. The mechanism: Mental Herb is SPENT BEFORE the volatile it frees is cleared, not after, so an engine that clears first and consumes second produces the same end state by a different route and parts from the authority on the stream. Blocker for wiring here: plays a game, wants the live-release preload. `VERIFIED BY: node tests/probe_mental_herb_order.js` is in the register, so register_reality.js runs it.',
  'tests/probe_mid_cat_reload.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK about the INSTRUMENTS, and it HAS a runner. The mechanism: the middle arm\'s category wrapper outlives the module that owns its state, so every instrument that swaps the simulator source underneath it has been measuring without the wrapper and did not know. That is a ruler defect, not an engine one, which is this project\'s most expensive class (162 of 169 accusations were once the ruler). Blocker for wiring here: it spawns children and loads tests/staged_board.js, which plays games. `VERIFIED BY: node tests/probe_mid_cat_reload.js` is in the register.',
  'tests/probe_pair.js': 'LIBRARY — the two-engine body builder that REFUSES an illegal pairing, consumed by tests/test-pinch-family.js (a real require, discovered). Its require.main selftest builds bodies in BOTH engines and measured exit 0 on 2026-08-22. Not re-certified.',
  'tests/probe_party_key_collision.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK with NO RUNNER, measuring a defect that is already reading NON-ZERO on every pinned run. The mechanism: engine/board_state.js keys the party BY THE DISPLAYED SPECIES, and while Species Clause makes that unique of the bodies a side BROUGHT, it is not unique of the bodies a side is HOLDING — seven abilities in this format rewrite a displayed name mid-game (Disguise, Forecast, Hunger Switch, Illusion, Imposter, Stance Change, Zero to Hero). The second row then OVERWRITES the first, so one body is compared against the other engine\'s OTHER body and the survivor is decided by list order. `duplicate_species_in_party` HAS READ 20 ON EVERY PINNED 961-GAME RUN AND NOTHING ACTED ON IT. Blocker: plays a game. Named in a ROADMAP row in prose, NOT in a `VERIFIED BY:` marker, so nothing executes it. Landed 2026-08-26 in 0b752a7b.',
  'tests/probe_phaze_empty_bench.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK with NO RUNNER. The mechanism: Roar and Whirlwind (status) and Dragon Tail and Circle Throw (damaging) are ONE tag here and TWO doors in the authority, and the empty-bench test is NOT at the DragOut site — it is `canSwitch(target.side)`, asked in both places, with the result that only the STATUS half can reach the `-fail`. An engine that treats the family as uniform gets the damaging half wrong in exactly the case a bench runs out. Blocker: plays a game, wants the live-release preload. No VERIFIED BY marker; landed 2026-08-23 in da53059b and has been run by nobody but its author.',
  'tests/probe_poltergeist_item_line.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK, and it HAS a runner. The mechanism: a move that READS the target\'s item announces what it found BEFORE it does anything with it, so the announcement is evidence the read happened and cannot be reconstructed from the outcome (ROADMAP #359). Blocker for wiring here: plays a game, wants the preload. `VERIFIED BY: node tests/probe_poltergeist_item_line.js` is in the register.',
  'tests/probe_protect_stage_order.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK, and it HAS a runner. The mechanism: the shield is step 1 and semi-invulnerability is step 0, so a body that is underground or in the air is missed BEFORE Protect is ever consulted — get the order backwards and a Protect is spent that should still be up, which changes the next turn rather than this one. Blocker for wiring here: plays a game, wants the preload or a `--release` pin. `VERIFIED BY: node -r ./tests/_live_release.js tests/probe_protect_stage_order.js` is in the register — and until 2026-08-28 `SAFE` refused that preload, so this entry claimed a runner that never started (ROADMAP #521). MEASURED once it did: exit 0, 4 arms, A parts under MEDI_INVULN_BELOW_SHIELD=1.',
  'tests/probe_punish_announce.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK with NO RUNNER. The mechanism: an ability that punishes its attacker announces itself, and the announcement is GATED ON THE PUNISHMENT ACTUALLY HAPPENING — so an engine that announces unconditionally claims a mechanic that did not fire. The membership was derived over the whole ability table rather than guessed: of the twelve `punishesAttacker` rows this format actually carries, exactly TWO announce (Gooey on Goodra, Toxic Debris on Glimmora) and ten are silent, and neither is overridden in the champions mod, checked rather than assumed. Blocker: plays a game. No VERIFIED BY marker; landed 2026-08-23 in 21f44515.',
  'tests/probe_red_demo.js': 'GREEN as of 2026-08-26 (ROADMAP #449/#273): 200 demonstrations, 0 HOLLOW, 0 COULD NOT BE APPLIED, exit 0, and it now DECLARES its exit code (ABRA-EXIT 0/1/2), so a refusal can no longer be read as a measured engine defect. NOT WIRED HERE, and the reason is that it already HAS a runner: engine/register_reality.js executes it on every pass as the VERIFIED BY of #273 and #449 — a closed row is checked as hard as an open one — so wiring it a second time buys a second 25-second run of the same command and a second place for its verdict to be decided. If register_reality ever stops running it, wire it here that day.',
  'tests/probe_regenerator_line.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK, and it HAS a runner. The mechanism, and it is the mod-versus-mainline trap this project has a written rule about: CHAMPIONS ANNOUNCES REGENERATOR\'S HEAL AND MAINLINE DOES NOT, and this engine\'s own comment cited MAINLINE. Reading /data/abilities.ts where /data/mods/champions/abilities.ts overrides it is the same error as the paralysis-25% family. Blocker for wiring here: plays a game, wants the preload. `VERIFIED BY: node tests/probe_regenerator_line.js` is in the register.',
  'tests/probe_selfdestruct_winner.js': 'NEW — landed today in 186cb65 and has never been measured by anyone but its author. It is the file that proves this assertion was needed: under the old predicate a brand-new check could land in tests/ and nothing anywhere would say so.',
  'tests/probe_sound_lock_restart.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK, and it HAS a runner. The mechanism: a SECOND Throat Chop into an already-silenced body — does the lock RESTART its counter, extend it, or do nothing? The three answers differ only on a later turn, which is why an end-of-turn board comparison cannot see it. Blocker for wiring here: plays a game, wants the preload or a `--release` pin. `VERIFIED BY: node -r ./tests/_live_release.js tests/probe_sound_lock_restart.js` is in the register — and until 2026-08-28 `SAFE` refused that preload, so this entry claimed a runner that never started (ROADMAP #521). MEASURED once it did: exit 0, 5 arms, A parts under MEDI_SOUND_LOCK_RESTARTS=1.',
  'tests/probe_spread_secondary_address.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK, and it HAS a runner. The mechanism: when a spread move rolls its SECONDARY, do the two engines ask the same question — one roll addressed to all targets, or one per target? Two engines that draw a different NUMBER of dice from a shared stream part on everything afterwards, so this is upstream of any divergence count taken on a spread move. Blocker for wiring here: it loads medicham2-browser.js and plays. `VERIFIED BY: node tests/probe_spread_secondary_address.js` is in the register.',
  'tests/probe_trace_choice.js': 'Measured exit 0 on 2026-08-22 (12 staged, 0 not matching). Plays the game_differential driver; not re-certified.',
  'tests/probe_turn_order.js': 'Measured exit 0 on 2026-08-22 (12 staged, 0 not matching). Plays the game_differential driver; not re-certified.',
  'tests/probe_volatile_start_field.js': 'CLASSIFIED 2026-08-27 — a REAL CHECK with NO RUNNER. The mechanism: a volatile\'s `-start` line can carry a value the condition computes AT RUN TIME in field 4, and the table this engine announces from has no way to express that — it claims a condition only when the whole onStart is one unconditional add. Scanned over the 57 volatiles a legal move can apply here, exactly TWO write a computed field: Disable always (the sealed move\'s name, whatever applied it, so it can be tabled) and Charge on one branch of two (only when an ability applied it, so it is not). The narrowness is the point rather than an oversight — Taunt is why it exists. Blocker: plays a game, wants the preload. No VERIFIED BY marker; landed 2026-08-23 in 21f44515.',
  'tests/roster.js': 'THE DELIBERATE ROSTER. Consumed by tests/test-closet-scope.js and engine/all_mechanics_fire.js, and its ARTIFACTS are already gated by engine/quarantine.js --check, which is listed and which FAILS when a roster artifact is missing or stage-mismatched. Standalone it is a named heavy run taking --stage, minutes per stage, and the pass that armed this assertion was forbidden to run it — so its exit code is genuinely UNKNOWN and is not being guessed at.',
  'tests/staged_board.js': 'RED on ONE of 25 scenarios, and it is NOT the defect this entry used to name. 2026-08-25: the species-NAME-keyed mirror in engine/game_differential.js is fixed and gated by tests/test-roster-identity.js (discovered, runs), which takes 24 of 25 scenarios clean — imposter-copies-the-body-opposite and hungerswitch-flips-every-turn now play their full scripts. roar-drags-whoever-is-standing-there was filed with those two and MEASURING IT SAID OTHERWISE: its refusal message is byte-identical before and after the fix ("slot 1 holds corviknight, which showdown HAS but cannot switch in"), never "does not have under that name". Nothing in it is ever renamed. It is a TEMPORAL defect in the same mirror — medicham2 resolves a whole turn at once while Showdown PAUSES mid-turn at U-turn\'s switch request, so the mirror is handed the end-of-turn occupant (Corviknight, put back by the Roar that runs later) instead of the body medicham2 sent in at the request (Snorlax). ENGINE owns it; it needs its own batch and its own probe, because the fix is a switch-in JOURNAL and the naive source (medicham2\'s own |switch| lines) is display state again under Illusion.',
  'tests/staged_status_counters.js': 'RED for a reason no engine fix can reach. Its BEFORE arm is release 6155acc0fb26, which is STRANDED: the snapshot will not load ("M.midEventDice is not a function") on all 11 scenarios, so every scenario reads "release THREW / live IDENTICAL => FIXED" while its own two controls print "SO THE RED ABOVE IS NOT EVIDENCE". LESSONS §12 — a stranded baseline is a figure to WITHHOLD and re-measure, never to resurrect. It needs re-pinning to a release that `engine_release.js compat` says can still serve it, and its plant anchor re-aimed (it reports the anchor matched 0 times).',

  'engine/derive_protocol_events.js': 'A REAL CHECK, ALREADY RUN, AND ITS PREVIOUS REASON HERE WAS FALSE — corrected 2026-08-27 in the pass that finally ran it. It said "NOTHING HAS EVER RUN IT" and that claim was a day old and refutable by grep: tests/test-protocol-trace.js PART 7 has spawned this file since 2026-08-06 (commit 38c0e2b9) and calls fail() on any non-zero exit, and test-protocol-trace.js is DISCOVERED by the tests/test-*.js glob. Its own PART 7 header explains the arrangement — "spawned from here instead of hand-registered, so it cannot fall off a list" — which is the thing the entry claimed had never happened. MEASURED 2026-08-27 on a settled tree, with engine/medicham2-browser.js verified byte-identical to HEAD before AND after the run: 91 distinct Showdown events, 44 emitted, 50 declared with a reason, 10 partial shapes, BOTH GATES PASS, exit 0, and no file written (it is read-only without --write). data/protocol-events.json agrees exactly (91/44/50/10, both gate arrays empty). BOTH GATES WERE SHOWN RED FIRST, in memory and with no file touched: pushing a phantom name onto TRACE_EVENTS trips INVENTED (exit 1), and splicing out an emitted one trips UNDECLARED (exit 1) — so this is not a check that passes by asking nothing. NOT WIRED HERE, and the reason is probe_red_demo.js\'s exactly: it already has a runner, so a GATES entry buys a second execution of the same command and a second place for one verdict to be decided. If PART 7 is ever removed, wire it here that day.',
  'engine/feature_fixture.js': 'THE REFIT GATE — it compares a weight file\'s feature hashes against the code, which is the one thing standing between a moved damage table and a silently invalid MAG. It is RED TODAY BY DESIGN: docs/MEASURE.md records `feature_fixture --check` FAILING on fixture identity AND on the damage table, i.e. REFIT OWED, and the refit is gated behind MEDICHAM rather than behind compute. Wiring it now ships a red. Wire it in the same pass the refit lands — and heed the file\'s own warning that a RESTAMP answers the fixture gate while SILENCING the table gate, so the table verdict has to be settled first or the evidence is written over.',
  'engine/format_audit.js': 'A REAL CONFORMANCE CHECK — does every constant in our generated move tables equal the format\'s? Two blockers. It WRITES data/format-audit.json on every run, so wiring it makes the suite rewrite an artifact its own children may be reading; and its verdict was not measured when it was found, because a MEASURE agent may not write into data/ beside a live ENGINE agent. Settle the write question, measure it on a settled tree, then wire.',
  'engine/orient.js': 'CLASSIFIED 2026-08-27 — A REAL CHECK THAT ALREADY HAS A RUNNER, and it was nearly given a second one in this very pass. The mechanism: every section of the orientation map is DERIVED at run time, so a section that cannot derive is a renamed file or a moved heading, and the file\'s own words are "a map that quietly drops a section reads as though the section does not exist" — the stale-handoff failure arriving inside the tool built to end it. Measured 2026-08-27: 8/8 sections derived, exit 0, 1s. IT WAS ADDED TO GATES AND THEN TAKEN BACK OUT: tests/test-orient.js is DISCOVERED by the glob and already execFileSyncs engine/orient.js against the real repo as its first arm, and it asks strictly more than a bare run does — every section present BY NAME, every ORIENT_BREAK knob going red and naming its section, no findings leaking into the IN FLIGHT block, and the enumeration summing. A GATES entry would have bought a second execution and a weaker question. This is the trap this file has already sprung once, recorded here so the next pass does not spring it a third time: CHECK FOR AN EXISTING RUNNER BEFORE ADDING A NAME.',
  'engine/preflight.js': 'CLASSIFIED 2026-08-27 — A REAL CHECK THAT IS CORRECTLY STANDALONE, AND THE ONE ENTRY HERE WHOSE BLOCKER IS STRUCTURAL RATHER THAN TEMPORAL. The mechanism: run twenty self-play games instead of twenty thousand and assert the gradient is NON-ZERO on the block you are about to spend an hour training, because a zero gradient is proof the feature never varied in any choice set — the lever is off, the flag is missing, or the path is dead. It exists because two 1.5-hour runs of 144,000 games each finished before anyone noticed the switch weights were bit-identical to the behaviour clone: train_policy.js spawns workers without --switching and mew.js makes switching opt-in. WHY IT MUST NOT BECOME A SUITE GATE, in its own words: "Any flag it does not recognise is passed straight through to mew_farm, so this is checked under EXACTLY the configuration the real run will use. Checking a different configuration is the bug." Its subject is THE CONFIGURATION OF A RUN ABOUT TO BE LAUNCHED, not the state of the tree, and a suite has no such run — so a default-flag green here would be the reassuring null the file was built to prevent. It also spawns mew_farm self-play. NOTE FOR WHOEVER TOUCHES THIS FILE NEXT: neither table fits it. NOT_A_CHECK is defined as asserting no contract, and this asserts one; PENDING_WIRE promises "this is exactly what has to happen before it can be", and for this file the honest answer is NEVER, deliberately. It is parked here rather than in a third table invented on the way past — argued in docs/_reports/2026-08-27-never-run.md, not acted on.',
  'engine/register_reality.js': 'A REAL CHECK — the register is an artifact and this is the only thing that compares it to reality. Same two blockers: it WRITES its artifact unconditionally, and the pass that found it was instructed not to touch docs/ROADMAP.md, which it reads. Unmeasured, deliberately.',
};

/* ---- the coverage scan, over BOTH directories ------------------------------------------------ */

/* SCOPE FIX 2026-08-23. This scanned engine/ ONLY. The detector whose entire purpose is catching a
 * check that nothing runs never looked in the directory named tests/ — where sixteen of them were
 * sitting, including a staged-scenario driver that seven discovered tests already depend on and a
 * probe that had landed the same day. */
const scanDir = dir => fs.readdirSync(D(dir))
  .filter(f => f.endsWith('.js'))
  .map(f => dir + '/' + f)
  .filter(rel => rel !== 'tests/run-all.js')          /* the runner is not one of its own children */
  .filter(rel => !GATES.includes(rel))
  .filter(rel => !testFiles.includes(rel))
  .filter(rel => {
    let src = ''; try { src = fs.readFileSync(D(rel), 'utf8'); } catch (e) { return false; }
    return looksLikeACheck(src);
  });
const discovered = [...scanDir('tests'), ...scanDir('engine')].sort();

/* A check that is neither run nor named. THIS IS THE FATAL ONE. */
const unrun = discovered.filter(rel => !NOT_A_CHECK[rel] && !PENDING_WIRE[rel]);
const pending = discovered.filter(rel => PENDING_WIRE[rel]);

/* AND THE LISTS MUST AUDIT THEMSELVES, or they become the hand-maintained ban list of four. An
 * exemption naming a file that no longer exists, or that no longer trips the detector, is a stale
 * claim sitting in the tree looking exactly as authoritative as a live one — the fourteen handoffs
 * again. It fails BY NAME, so it is removed in the pass that made it stale instead of accumulating. */
const staleExemption = [...Object.keys(NOT_A_CHECK), ...Object.keys(PENDING_WIRE)]
  .filter(rel => !discovered.includes(rel))
  .map(rel => [rel, fs.existsSync(D(rel)) ? 'the file still exists but no longer trips the detector'
                                          : 'the file is gone']);

const all = [...testFiles, ...GATES];

/* ---- the coverage verdict, computed once and printed the same way everywhere ------------------ */

function reportCoverage() {
  console.log(`\n  COVERAGE — ${discovered.length} file(s) outside the run list report their own verdict.`);
  console.log(`    ${Object.keys(NOT_A_CHECK).length} named NOT A CHECK, ${pending.length} named ` +
              `PENDING-WIRE, ${unrun.length} unaccounted for.`);
  if (pending.length) {
    console.log(`\n  PENDING-WIRE — a real check, not wired in, blocker named. Not a "known failure":`);
    for (const rel of pending) console.log(`    ${rel}\n        ${PENDING_WIRE[rel]}`);
  }
  if (unrun.length) {
    console.log(`\n  FAIL — UNACCOUNTED-FOR CHECK. ${unrun.length} file(s) report a pass/fail verdict but`);
    console.log(`  are neither a listed gate, nor discovered in tests/ as test-*.js, nor named in`);
    console.log(`  NOT_A_CHECK / PENDING_WIRE in tests/run-all.js. A check nothing runs reads as`);
    console.log(`  coverage in a review. Wire it in, or name it with its reason — never widen past it:`);
    for (const rel of unrun) console.log(`    ${rel}`);
  }
  if (staleExemption.length) {
    console.log(`\n  FAIL — STALE EXEMPTION. ${staleExemption.length} name(s) in NOT_A_CHECK /`);
    console.log(`  PENDING_WIRE no longer describe anything. Remove them:`);
    for (const [rel, why] of staleExemption) console.log(`    ${rel}  — ${why}`);
  }
  return unrun.length + staleExemption.length;
}

/* --coverage answers the coverage question ALONE and runs no child at all. It exists so this
 * assertion can be shown RED on a deliberate break without spending a suite run, and so it can be
 * checked at all during another division's pass, when running the engine would be photographing a
 * moving subject. It is not a substitute for the suite and says so on the tin. */
if (COVERAGE_ONLY) {
  console.log('RUN-ALL --coverage — the coverage assertion ONLY. No check was run; this is NOT a suite result.');
  process.exit(reportCoverage() ? 1 : 0);
}

/* ---- how to run each one --------------------------------------------------------------------- */

/* python3 is a Microsoft Store stub on this machine and exits with an install prompt, so the
 * interpreter is probed rather than assumed. publish.sh already does the same thing. */
function python() {
  for (const c of ['python3', 'python']) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /^Python 3/.test((r.stdout || '') + (r.stderr || ''))) return c;
  }
  return null;
}
const PY = python();
const HAS_SIM = !!process.env.SHOWDOWN_PATH;

function plan(rel) {
  const src = fs.readFileSync(D(rel), 'utf8');
  const needsSim = /champions_sim|SHOWDOWN_PATH/.test(src);
  if (needsSim && !HAS_SIM) return { skip: 'needs the Showdown simulator; SHOWDOWN_PATH is not set' };
  if (rel.endsWith('.py') && !PY) return { skip: 'no working python 3 interpreter found' };
  /* Per-check extra arguments. provenance.js reports by default and only GATES with --strict, so the
   * runner must ask for the strict behaviour or it would list unsafe artifacts and exit 0 — a gate
   * that reads as a pass, which is the failure this file exists to prevent. */
  /* conformance.js is the same shape and was the worse case: it was registered as a gate here and
   * run WITHOUT --strict, so its exit(1) could never fire. It printed findings on every run and
   * exited 0. Two near-identical comment blocks sat at this exact spot documenting that defect, and
   * it was acted on zero times — the write-up became the substitute for the fix.
   *
   * It is switched on now, and it is a RATCHET rather than a switch, because flipping --strict as
   * it stood turned the suite red on ~a hundred findings that are mostly legitimate. A red board
   * gets normalised: tests/test-docs-current.js sat red for two days across ~40 commits as a "known
   * failure", the phrase CLAUDE.md bans. So what already existed is recorded in
   * data/conformance-baseline.json — the count lives in that artifact and is deliberately not typed
   * here — and the gate fails only on a finding that is NOT in there. The baseline may shrink and
   * may never grow. PRIORITIES #46b, closed 2026-08-04. */
  const EXTRA = { 'engine/provenance.js': ['--strict'], 'engine/conformance.js': ['--strict'],
                  'engine/em_validation.js': ['--check'], 'engine/status.js': ['--selftest'],
                  'engine/rerun_list.js': ['--selftest'], 'engine/validate_store.js': ['--selftest'],
                  'engine/diff_swarm.js': ['--selftest'], 'engine/names.js': ['--selftest'],
                  /* --check, not --selftest: the selftest proves the classifier and the withholder on
                   * synthetic input (and is run by --check's own first act), while --check is the part
                   * that reads the real tree and can catch a real leak. Both directions matter, so the
                   * gate runs the selftest itself rather than this list naming the file twice. */
                  'engine/quarantine.js': ['--check'],
                  /* Both added 2026-08-27, and both are the argument-is-the-question case rather
                   * than a convenience. Without --no-rebuild, generated_audit spawns every builder
                   * and the suite rewrites artifacts its own children read. Without --selftest,
                   * move_result_state is a library that runs nothing and exits 0 — the silent
                   * no-op that reads as coverage. Neither could be derived from the filename. */
                  'engine/generated_audit.js': ['--no-rebuild'],
                  'engine/move_result_state.js': ['--selftest'] };
  /* THE HEAP IS DECLARED BY THE CHECK, NOT LISTED BY THE RUNNER. ROADMAP #446.
   *
   * tests/test-resolution-order.js dies at node's default heap — exit 134, `Reached heap limit
   * Allocation failed`. It opens ONE FROZEN RELEASE PER ARM and there are 26 of them, so the
   * snapshots accumulate in one process; that is a property of the check, not a defect in it. What
   * the runner did with that was the defect: SIGABRT is a non-zero status, so the loop below filed a
   * memory ceiling as `FAIL tests/test-resolution-order.js (exit 134)` — a red that reads exactly
   * like a broken resolution order and is not one. A crash recorded as a verdict is the same class
   * as a skip recorded as a pass, and this file's opening comment is about that class.
   *
   * IT IS DERIVED FROM THE CHILD'S OWN SOURCE and deliberately not a second hand-kept table beside
   * EXTRA. `EXTRA` carries an argument that changes what a check ASKS (--strict, --check); a heap is
   * a fact about what the check COSTS TO RUN, which only the check knows and which changes when the
   * check changes. A table here would go stale the way the CI job list did — and the staleness would
   * surface as exit 134 on a machine nobody was watching. A new check that needs headroom writes
   * `ABRA-HEAP: <MB>` in its own header and this runner honours it with no edit.
   *
   * Node requires the flag BEFORE the script path; after it, it is passed to the script as argv and
   * silently does nothing — one more entry in the list of ways a command reports success having
   * changed nothing. --list prints the honoured value so the derivation can be seen to have fired
   * rather than assumed. */
  const heap = rel.endsWith('.py') ? null : (src.match(/ABRA-HEAP:\s*(\d+)/) || [])[1];
  const node = heap ? ['--max-old-space-size=' + heap] : [];
  return { cmd: rel.endsWith('.py') ? PY : process.execPath,
           args: [...node, D(rel), ...(EXTRA[rel] || [])], heap: heap ? Number(heap) : null };
}

if (LIST_ONLY) {
  console.log(`DISCOVERED ${all.length} checks (${testFiles.length} in tests/, ${GATES.length} engine gates)\n`);
  for (const rel of all) {
    const p = plan(rel);
    /* THE EXTRA ARGUMENT IS PRINTED FOR THE REASON THE HEAP IS PRINTED: so the binding can be SEEN
     * to have fired rather than assumed. An EXTRA key that silently fails to match its file is the
     * same class of defect as the backslash-vs-forward-slash exemption this file already guards
     * against, and it fails in the worst available direction — `node engine/move_result_state.js`
     * without --selftest exits 0 having printed NOTHING AT ALL (measured 2026-08-27), so a gate that
     * lost its argument would report a clean pass while asking no question. That is the registered
     * no-op this file rates worse than an unregistered check. */
    const extra = p.args.slice(p.args.indexOf(D(rel)) + 1);
    console.log(`  ${p.skip ? 'SKIP' : 'RUN '}  ${rel}${p.skip ? '   — ' + p.skip : ''}` +
      (extra.length ? `   ${extra.join(' ')}` : '') +
      (p.heap ? `   [ABRA-HEAP ${p.heap} MB — --max-old-space-size=${p.heap}]` : ''));
  }
  reportCoverage();
  process.exit(0);   /* --list is an inventory, not a verdict. --coverage is the verdict. */
}

/* ---- run ------------------------------------------------------------------------------------- */

console.log(`RUN-ALL — ${all.length} checks discovered ` +
  `(${testFiles.length} in tests/, ${GATES.length} engine gates)`);
console.log(`  simulator: ${HAS_SIM ? process.env.SHOWDOWN_PATH : 'NOT SET — simulator checks will be skipped'}`);
console.log(`  python:    ${PY || 'NOT FOUND — python checks will be skipped'}\n`);

const pass = [], fail = [], skip = [];
for (const rel of all) {
  const p = plan(rel);
  if (p.skip) { skip.push([rel, p.skip]); console.log(`  SKIP  ${rel}  — ${p.skip}`); continue; }
  const started = Date.now();
  /* ABRA_STRICT_SEMANTICS MAKES A STALE-WEIGHTS WARNING FATAL, AND UNTIL 2026-08-02 NOTHING SET IT.
   *
   * engine/magnemite.js implements the flag, and its own comment says it "is what tests/run-all.js
   * and any fit should use" — but no file in this repository ever set it. So the semantics guard was
   * a warning everywhere, permanently. Verified by making the fixture genuinely change: it printed
   * 22 features whose meaning had moved, and then LOADED THE WEIGHTS ANYWAY. A capability that
   * exists, runs clean and does nothing is this project's single most repeated defect.
   *
   * The default stays a warning for LIVE PLAY, and that trade-off is argued where it is made: a
   * routine re-ingest is a legitimate cause of a mismatch, and a guard that halts a battle for a data
   * refresh is one that gets switched off within a week. The suite is where it has to bite. */
  const r = spawnSync(p.cmd, p.args, {
    cwd: ROOT, encoding: 'utf8',
    /* ABRA_SUITE_STARTED_AT lets a child tell "this artifact was stale when the suite began" from
     * "this suite wrote it thirty seconds ago". tests/test-web-status.js could not be green at the
     * end of a run that regenerates the very artifacts its board is built from — the harness was
     * measuring its own side effect and calling it a defect in the site. Only that distinction is
     * exported; the check itself still fails on a board somebody genuinely forgot to rebuild. */
    env: Object.assign({}, process.env, { ABRA_STRICT_SEMANTICS: '1', ABRA_SUITE_STARTED_AT: String(SUITE_STARTED_AT) }),
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (r.status === 0) { pass.push(rel); console.log(`  ok    ${rel}  (${secs}s)`); }
  /* EXIT 2 MEANS "I COULD NOT RUN", NOT "I FAILED". A gate whose input is gitignored must be able to
   * say that without turning every clean checkout red — and must still be listed, so the distinction
   * between "passed" and "never ran" stays visible. */
  else if (r.status === 2) {
    const why = ((r.stderr || '') + (r.stdout || '')).trim().split('\n')[0] || 'exit 2';
    skip.push([rel, why]);
    console.log(`  SKIP  ${rel}  — ${why}`);
  }
  else {
    const out = (r.stdout || '') + (r.stderr || '');
    /* AN OUT-OF-MEMORY DEATH IS A RESOURCE VERDICT, NOT A CHECK VERDICT, AND IT STILL FAILS. It is
     * annotated rather than downgraded: turning it into a SKIP would hide a check that never ran,
     * which is the thing this file exists to make impossible. What the annotation buys is that the
     * next reader is not sent hunting for a mechanics defect that the exit code never claimed —
     * ROADMAP #446 was exactly that, `exit 134` filed as a red resolution order. The fix is named
     * in the line, because a diagnosis nobody can act on is a caption. */
    const oom = /Reached heap limit|JavaScript heap out of memory|FATAL ERROR:.*Allocation failed/.test(out);
    const tail = out.trim().split('\n').slice(-14);
    if (oom && !p.heap) tail.push('    ^ RAN OUT OF HEAP. This is a memory ceiling, not a verdict about the game. ' +
      'Declare `ABRA-HEAP: <MB>` in this file\'s header and run-all will honour it.');
    fail.push([rel, r.status, tail]);
    console.log(`  FAIL  ${rel}  (exit ${r.status}, ${secs}s)` +
      (oom ? `  — OUT OF HEAP${p.heap ? ` even at the declared ${p.heap} MB` : ', and no ABRA-HEAP is declared'}` : ''));
  }
}

console.log(`\n${'-'.repeat(78)}`);
console.log(`  ${pass.length} passed, ${fail.length} failed, ${skip.length} skipped`);

const coverageFailures = reportCoverage();

if (skip.length) {
  console.log(`\n  SKIPPED (not passed — a skip is not a result):`);
  for (const [rel, why] of skip) console.log(`    ${rel}  — ${why}`);
}

if (fail.length) {
  console.log(`\n  FAILURES`);
  for (const [rel, status, tailLines] of fail) {
    console.log(`\n    ${rel}  (exit ${status})`);
    for (const l of tailLines) console.log(`      ${l}`);
  }
}

/* THE COVERAGE ASSERTION IS IN THE EXIT EXPRESSION. It was not, for as long as the comment two
 * hundred lines up claimed it was — `unrun` printed a warning and the runner exited on `fail.length`
 * alone, so the meta-check written to stop unrun checks could not stop anything. An unaccounted-for
 * check, or a stale name in either exemption list, is a FAILURE of this suite, exactly like a red
 * child. Anything else makes the sentence a caption, and CLAUDE.md has already paid twice for the
 * difference between a caption and a gate. */
process.exit(fail.length || coverageFailures ? 1 : 0);
