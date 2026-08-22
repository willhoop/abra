# The runner's blind spot — blast radius measured, widening NOT landed — 2026-08-22

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

READ-ONLY. **Nothing was edited, nothing was committed, nothing was pushed.** `tests/run-all.js`
is unchanged on disk. `tests/roster.js`, `engine/quarantine.js`, `engine/game_differential.js`
(as a run) and `engine/status.js --write` were not run. Scanner scripts live in the session
scratchpad (`scan_unrun.js`, `scan2.js`, `scan3.js`, `scan4.js`) and write nothing into the repo.

---

## VERDICT

**STOPPED at the stop condition. The widening was not landed.**

**15 unrun checks exist under `tests/`.** The current detector sees **3** of them; the widened
detector (`process.exit(<expr> ? 1 : 0)`) sees all 15.

**4 of the 15 are RED as they stand**, and a 5th (`tests/roster.js`) could not be measured because
running it is out of scope for this pass. `tests/run-all.js` is **already red** on
`tests/test-end-state-severity.js`, which it does discover. So wiring the widened set in tonight
would take the suite from 1 red to **5–6 reds**, none of which MEASURE can fix: two belong to
`engine/game_differential.js`, one to a stranded release, one to a stale-patch backlog, and at
least one to an ENGINE edit that is *in the working tree right now*.

That is well past "a couple of files". Landing it would manufacture exactly the normalisation
CLAUDE.md has already paid for twice, so it was not landed.

**And there is a FOURTH miss the brief did not name — the one that matters most.**
`run-all.js:152` says of its coverage assertion: *"this runner fails rather than quietly ignoring
it."* **It does not fail.** `unrun` is printed as a WARNING block at L284-288 and the exit
expression at L303 is `process.exit(fail.length ? 1 : 0)` — `unrun` is not in it. The meta-check
built to stop unrun checks is itself a warning nobody has to act on, and it is currently carrying
**27 names from `engine/`**. Of those 27, about eighteen are not checks at all (`ditto.js`,
`mew.js`, `ladder.js`, `mag_bot.js`, `showdown_bot.js`, `fit_policy.js`, `million_run.js`,
`rollout_r1.js`, `rollout_r3.js`, `sheet_usage.js`, `surprise.js`, `game_differential.js`, …) —
models, bots and measurement drivers that happen to print `FAIL` and exit 1. The genuine gates in
there (`gate_fail_and_silent.js`, `gate_offfield_target.js`, `gate_seed_source_audit.js`,
`gate_weather_guard.js`, `feature_fixture.js`, `register_reality.js`) are buried in the noise.
**An over-firing warning that cannot fail the build is #148 in its purest form.** That is the
defect to fix first, and it is a bigger lever than adding `tests/` to the same warning.

---

## 0. THE MEASUREMENT CONDITIONS — READ THIS BEFORE BELIEVING ANY RED BELOW

An ENGINE agent was live in `engine/medicham2-browser.js` throughout. At the time of the runs the
working tree was **dirty**:

```
 M engine/medicham2-browser.js      (+144 lines — the Life Orb toll is being rewritten)
 M tests/test-mechanics.js
 M data/mechanics-census.json, data/engine-release.json,
   data/provenance-stamp.json, data/docs-currency-baseline.json
?? tests/probe_lifeorb_toll.js      (UNTRACKED — the ENGINE agent's new probe. Left in place.)
```

`git diff engine/medicham2-browser.js` shows the removed line
`if(m.item==='lifeorb'&&a.move.d.max>0&&_reached>0){` and a new block referencing
`tests/probe_lifeorb_toll.js`. **Three of the reds below land on those exact bytes** and are
therefore *not* attributable to the runner, the arm, or a standing defect until they are
re-measured on a settled tree:

- `tests/mutation_harness.js` — the one WRONG calibration row is `damageMultAll / lifeorb`;
- `tests/probe_red_demo.js` — two of its ten failures are WIRE 4, *"Life Orb is
  `chainModify([5324,4096])`"* and the spread `x0.75` rounding;
- `tests/test-end-state-severity.js` — dies on `ORB_STALE_RANGE is not defined`, a symbol that
  exists only in the uncommitted edit.

`tests/test-state-differential.js`, reported red earlier this evening in
`docs/_reports/2026-08-22-wrong-arm-callers.md`, is **GREEN now (exit 0)**. Same tree, same
evening, different answer. That is the tree moving, and it is the strongest single argument for not
wiring anything in during an ENGINE pass.

---

## 1. THE DETECTOR, AND THE THREE MISSES CONFIRMED

`run-all.js:41` discovers `/^test-.*\.(js|py)$/` only. `run-all.js:167` applies `looksLikeACheck`
to `fs.readdirSync(D('engine'))` — `tests/` is never scanned. And `looksLikeACheck`'s gate clause
requires a bare `process.exit(1)`, which `process.exit(bad ? 1 : 0)` does not match.

**Shown red first, as required.** A scratch harness (`scan3.js`) ran the *current* predicate and a
*widened* one over the tree:

```js
const COMPUTED = /process\.exit\([^;\n]*\?\s*1\s*:\s*0\s*\)/;   // the widening
const WIDE = src => looksLikeACheck(src) || (COMPUTED.test(src) && /REGRESSION|FAIL:|FAIL/.test(src));
```

- current detector, applied to `tests/`: flags **3** — `interaction_matrix.js`,
  `mutation_harness.js`, `probe_red_demo.js`. **It does NOT flag `staged_board.js`.**
- widened detector: flags **12**, `staged_board.js` among them. Demonstrated on the current tree
  before being trusted, exactly as `tests/test-lownode.js` was.
- widened *with the announce clause dropped*: flags **15**, adding
  `probe_mega_damage_abilities.js`, `probe_trace_choice.js`, `probe_turn_order.js` — three files
  that end `process.exit(bad ? 1 : 0)` but never print the word FAIL. A trailing computed-nonzero
  exit *is* a verdict, not ordinary error handling, so the announce clause is arguably wrong for
  this clause. **Recorded, not decided.** The regex must also tolerate a call in the predicate
  (`process.exit(main() ? 1 : 0)` in `staged_status_counters.js`), which a `[^)]*` body misses.

**Blast radius of the widening on `engine/` too** — the same function is shared, so widening moves
the existing warning from 27 to **29** names (`divergence_shape.js`, `format_audit.js`), or 31 if
the announce clause is dropped (`rebuild_records.js`, `reprocess.js`). All warning-only today.

---

## 2. THE LIST — every unrun check under `tests/`, RUN AS IT STANDS

`SHOWDOWN_PATH` resolved to `C:\Users\willj\Projects\Pokemon\pokemon-showdown` via
`engine/showdown_path.js`, i.e. what `run-all.js` itself would hand a child. Every run went through
`tools\lownode.cmd`. Exit 2 is SKIP under the runner's own rule.

| file | seen by | exit | secs | what happened |
|---|---|---|---|---|
| `tests/interaction_matrix.js` | current | **0** | 1 | GREEN. It is a **generator** ("runs no engine"); its runner is `test-game-diff.js --matrix`. Its exit(1) is a self-audit of the derivation. |
| `tests/mutation_harness.js` | current | **1** | 1 | **RED.** Triage calibration: 3 MATCH, 1 WRONG — `damageMultAll / lifeorb`, expected C got B, hand-read against release `032b4a2979dd`. **On the bytes being edited now.** Run as `--gate-only --no-write`; the full sweep writes `data/mutation-coverage.json` and was deliberately not run beside a live agent. |
| `tests/probe_red_demo.js` | current | **1** | 5 | **RED.** 200 demonstrations, 10 failed. **8 are STALE REVERSALS** — the patch text no longer matches the engine, so the demonstration has not run (WIRE 118/123/129/130, ROADMAP #31, #81 WIRE 9, #81 WIRE 12, #259); one of those eight produces an engine that throws (`_mvMissed is not defined`). The other **2 are real FAILs**, both WIRE 4 (spread `x0.75` on 4096ths; Life Orb `chainModify`), both `shipped-arm=false (must be true)` — **on the bytes being edited now.** |
| `tests/probe_bracket_counters.js` | widened | **0** | 1 | GREEN. `bracketRederived 1988`, `bracketRederiveMoved 6`. |
| `tests/probe_drag_body.js` | widened | **2** | 0 | SKIP — *"REFUSING TO RUN — pass `--release <id>`"*, because requiring the driver bare cuts a junk release. Correct behaviour; it would show as a loud SKIP. |
| `tests/probe_fail_and_silent.js` | widened | **0** | 2 | GREEN. 6 staged, 0 parted. |
| `tests/probe_lifeorb_toll.js` | widened | **2** | 0 | SKIP, same `--release` refusal. **This file is UNTRACKED** — it is the live ENGINE agent's new work and is not committed. Wiring an uncommitted file into the suite is not a thing to do. Reported, left alone. |
| `tests/probe_mega_priority.js` | widened | **0** | 1 | GREEN. "all arms clear". |
| `tests/probe_pair.js` | widened | **0** | 1 | GREEN. A **library** with a `require.main` selftest — "all green — the instrument may be trusted". |
| `tests/roster.js` | widened | **not run** | — | **UNKNOWN.** Out of scope by instruction. 9,312 lines, takes a `--stage` argument, and is one of the named heavy runs. It is the single biggest unknown in this accounting. |
| `tests/staged_board.js` | widened | **1** | 1 | **RED — the three known ones**, and the current detector cannot see this file at all. `imposter-copies-the-body-opposite`, `hungerswitch-flips-every-turn`, `roar-drags-whoever-is-standing-there`; 22 of 25 clean. ONE instrument defect (species-name-keyed mirror in `engine/game_differential.js`), not the arm. Not touched. |
| `tests/staged_status_counters.js` | widened | **1** | 5 | **RED, and for a reason nobody can fix by fixing an engine.** Its BEFORE arm is release `6155acc0fb26`, which is **STRANDED**: *"the simulator source would not load: `M.midEventDice is not a function`"*, on all 11 scenarios. Every scenario then reads `release THREW / live IDENTICAL => FIXED`. Two controls print *"SO THE RED ABOVE IS NOT EVIDENCE"*. It also reports `PLANT NOT APPLIED: the anchor matched 0 time(s)`. This is LESSONS §12 — an aged-out baseline is a figure to WITHHOLD and re-measure, never to resurrect. |
| `tests/probe_mega_damage_abilities.js` | widened, no-announce | **0** | 1 | GREEN. "11 arm(s) played, 0 RED". |
| `tests/probe_trace_choice.js` | widened, no-announce | **0** | 1 | GREEN. 12 staged, 0 not matching. |
| `tests/probe_turn_order.js` | widened, no-announce | **0** | 1 | GREEN. 12 staged, 0 not matching. |

**Cost is not the blocker.** The thirteen files that ran took **~20 seconds in total**. The blocker
is redness, and every red is owned by somebody other than MEASURE.

### 2b. Flagged by neither detector, and correctly so

`probe_bench_leaves.js`, `probe_bench_plants.js`, `probe_drag_exposure.js`,
`probe_endstate_by_cause.js`, `probe_mega_direct.js`, `probe_volatile_leaves.js` exit only 0 or 2 —
they are REPORTS with no verdict, so they are not checks. `mechanics_rank.js`,
`mechanics_surface.js`, `regulation_usage.js`, `shrink_guard.js`, `walk_tags.js`, `probe.js`,
`_live_release.js` never exit non-zero.

One borderline case, recorded rather than acted on: **`tests/bench-medicham.js`** ends
`if (d > 10) { … process.exit(1); }` on a >10% slowdown. Neither detector catches it (no
`FAIL`/`REGRESSION` token). Its own text says *"Say so; do not file it"* on a quiet machine — a
wall-clock threshold on a 16-core box with twelve Claude processes resident is not a suite gate.
Leaving it out is the right call; it is noted so the next person does not rediscover it as a gap.

---

## 3. WHAT WOULD HAVE TO BE FIXED BEFORE THIS CAN BE WIRED IN

In dependency order. None of these belong to MEASURE.

1. **Settle the tree.** Three reds (`mutation_harness`, 2 of `probe_red_demo`'s 10,
   `test-end-state-severity`) sit on an uncommitted Life Orb rewrite. Re-measure after the ENGINE
   pass lands; they may all clear. `test-state-differential` already flipped red to green in one
   evening.
2. **`engine/game_differential.js`: the Showdown mirror keyed by species NAME.** Closes the three
   `staged_board.js` scenarios, and with them the four `test-*.js` files that ride
   `SB.runOne` — the single highest-leverage fix in the accounting. ENGINE owns it.
3. **`tests/staged_status_counters.js` needs a live baseline.** Release `6155acc0fb26` is stranded
   (`M.midEventDice`). Either re-pin to a release that `engine_release.js compat` says can still
   serve it, or the file cannot be a gate. Its plant anchor also needs re-aiming.
4. **`tests/probe_red_demo.js`'s 8 stale reversals.** Each patch must be re-aimed at what the
   engine says today. Until then those eight have not run — a "shown red" claim that is currently
   false for eight wires.
5. **`tests/roster.js` must actually be measured** before anyone claims this list is complete.
6. **Then, and only then:** widen `looksLikeACheck`'s exit clause, scan `tests/` as well as
   `engine/`, and decide the announce-clause question for the three no-announce probes.
7. **Independently, and first if anything is done at all: make the coverage assertion assert.**
   It cannot be armed as it stands — 27 warning names, roughly 18 of them not checks — so it needs
   a by-name exemption list with a recorded reason per entry (`ditto.js` is a model, `mag_bot.js`
   is a bot, `game_differential.js` is a measurement driver) and *then* `unrun.length` added to the
   exit expression. **Not by narrowing the predicate until the noise goes away.**

---

## 4. WHAT WAS NOT DONE, EXPLICITLY

- `tests/run-all.js` was **not edited**. No commit, no push.
- `tests/roster.js`, `engine/quarantine.js`, `engine/game_differential.js`, `status.js --write`
  were **not run**.
- `data/mutation-coverage.json` was **not written** (`--no-write`).
- `tests/probe_lifeorb_toll.js` is untracked and was **left in place**.
- Nothing under `engine/` was touched.
