# The gate runner's coverage assertion, armed — 2026-08-23

Historical findings record. Not maintained, not current state, never cite as such.
Superseded by the register rows it feeds.

Follows `docs/_reports/2026-08-22-runner-blind-spot.md`, which measured the blast radius and stopped
short of landing anything.

**Files changed: `tests/run-all.js` and this report. Nothing else.** No commit, no push. Nothing
under `engine/` was edited, no other test file was edited, `docs/ROADMAP.md` was not touched.
`tests/roster.js`, `engine/quarantine.js`, `engine/game_differential.js`, `engine/status.js --write`
and the full `run-all` suite were not run.

---

## VERDICT

The coverage assertion now **asserts**. `unrun` is in the exit expression, the detector scans
`tests/` as well as `engine/`, and it recognises a computed non-zero exit. **42 by-name entries**
carry the accounting: 23 NOT A CHECK, 19 PENDING-WIRE, **0 unaccounted for**, 0 stale.
**Five checks were wired in.** `node tests/run-all.js --coverage` exits 0.

**Nothing was wired in that is red, and nothing red was relabelled.** The nineteen PENDING-WIRE
entries each name their blocker and, where it belongs to somebody, their owner.

**A fourth defect was found in the same predicate and is the most alarming thing here** — see §2.
The announce clause contained two raw `0x08` bytes and had been half-dead for as long as it existed.

---

## 0. MEASUREMENT CONDITIONS

An ENGINE agent was live throughout, and the tree moved *during* this pass:

```
 M engine/medicham2-browser.js   (+112)     <- another agent
 M engine/game_differential.js   (+13)      <- another agent, and it owns a red below
 M docs/ROADMAP.md                          <- another agent
 M data/docs-currency-baseline.json         <- another agent
 M tests/run-all.js                         <- mine, the only one
```

That is not background colour, it is the reason for the central judgement in §4: **every one of the
sixteen unwired `tests/` checks plays a game**, and a green taken from a game played against a
simulator being rewritten is a photograph of a moving subject. None was certified.

---

## 1. THE THREE NAMED MISSES — ALL THREE LANDED

**(1) Discovery scope.** `looksLikeACheck` was applied to `fs.readdirSync(D('engine'))` and nothing
else. The detector whose entire purpose is finding a check nobody runs never looked in the directory
called `tests/`. It now scans both, via one `scanDir()` that excludes the listed gates, the
discovered `test-*.js` set and the runner itself.

**(2) The exit clause.** Widened to recognise a computed non-zero exit:

```js
const COMPUTED_EXIT = /process\.exit\(\s*[^;\n]*\?\s*1\s*:\s*0\s*\)/;
```

The body is `[^;\n]*` and not `[^)]*` on purpose — `tests/staged_status_counters.js` ends
`process.exit(main() ? 1 : 0)`, and a predicate that cannot contain a call misses it.

Unlike the bare-literal clause, this one does **not** additionally require the file to print `FAIL`.
A computed status code is a verdict by construction; a file does not derive an exit code from its own
findings by accident. The bare `process.exit(1)` clause keeps its announce requirement, because 36
engine files exit(1) on ordinary error handling. Different false-positive profiles, argued separately
rather than merged. This also picks up the three probes the previous report left undecided
(`probe_mega_damage_abilities`, `probe_trace_choice`, `probe_turn_order`).

**SHOWN RED FIRST, on this tree, before being trusted:**

```
RED-FIRST CLAIM — tests/staged_board.js
  current predicate flags it : false   (must be false)
  widened predicate flags it : true    (must be true)
  its exit line: process.exit(2) | process.exit(2) | process.exit(2) | process.exit(bad ? 1 : 0)
```

**(3) The assertion did not assert.** `run-all.js` said in writing that if such a file turned up
*"this runner fails rather than quietly ignoring it"*, and then printed a WARNING and exited on
`fail.length` alone. It now reads:

```js
process.exit(fail.length || coverageFailures ? 1 : 0);
```

where `coverageFailures = unrun.length + staleExemption.length`.

---

## 2. THE FOURTH DEFECT, FOUND WHILE EDITING: A REGEX WITH TWO RAW BACKSPACE BYTES IN IT

The announce clause on disk was not what it appeared to be. Byte-level dump:

```
CODES: 82 69 71 82 69 83 83 73 79 78 124 70 65 73 76 58 124 8 70 65 73 76 8 47
                                                              ^^            ^^
```

Those `8`s are literal `0x08`. The source read `/REGRESSION|FAIL:|<BS>FAIL<BS>/` — the `\b` escapes
of an intended `\bFAIL\b` flattened to actual backspace characters somewhere between the keyboard and
the disk. A raw `0x08` outside a character class matches a literal backspace, so the third
alternative **could never fire**, and the effective predicate was `/REGRESSION|FAIL:/`.

It renders in an editor as `\bFAIL\b` under most fonts. It reads correctly. It did not run. That is
this repository's signature failure, and it was inside the meta-check.

**It was NOT fixed by restoring the literal intent, and that was measured rather than argued:**

| announce clause | tests/ flagged | engine/ flagged |
|---|---|---|
| `<BS>FAIL<BS>` (as shipped, dead) | 108 | 25 |
| `\bFAIL\b` (as written) | 133 | 28 |
| `\bFAIL` (start boundary) | 136 | 44 |
| `FAIL` (plain substring) | 136 | 45 |

Restoring `\bFAIL\b` would have been a **narrowing** against the widest reading: the boundary rejects
`FAILED`, `FAILURE`, and `\nFAIL` — the last being how `engine/validate_damage_sim.js` announces
itself. Three of the files the boundary drops are genuine checks, one of them
`engine/feature_fixture.js`, **the refit gate**. Dropping a real gate to honour an escape sequence is
fixing a red by narrowing the detector. Shipped as `/REGRESSION|FAIL/`; the noise the boundary was
guarding against is answered by name instead. (The only file separating the last two rows is
`validate_damage_sim.js`, which is already a listed gate, so the two widest variants give an
identical accounting.)

---

## 3. THE EXEMPTIONS CAME FIRST — 42 NAMES, EACH WITH ITS REASON IN THE FILE

Order mattered: naming, then arming. Arming against 27 unsorted names would have shipped a red
runner, which is how a gate gets ignored.

**`NOT_A_CHECK` — 23 names, all `engine/`.** A model, a bot, a fit, a generator, a rebuild tool or a
measurement driver: it reports a NUMBER or produces an ARTIFACT and asserts no contract, so there is
nothing to be green or red about. Settled, not owed.

`argmax_paired`, `conditional_audit`, `ditto`, `fit_policy`, `game_differential`, `ladder`,
`leaf_position_contrast`, `lookahead_cost`, `mag_bot`, `medicham_coverage`, `mew`, `million_run`,
`opponent_calibration`, `rebuild_records`, `redirect_audit`, `replay_differential`, `reprocess`,
`rollout_r1`, `rollout_r3`, `sheet_usage`, `showdown_bot`, `surprise`, `tag_dex`.

Every one was classified by **reading that file's own header this pass**, not from memory. Where an
entry claims "already exercised by X", that claim was checked by grepping for a real `require(` edge
— `tests/test-mechanics.js` mentions almost every file in the repo in comments, and a filename in a
comment is not coverage. That check changed answers: of sixteen candidates, only five have a real
require edge from a discovered test.

**Nothing was exempted to make a red go away.** The rule held in the direction that costs something:
the predicate was widened twice during this pass and the lists grew to match.

**The lists audit themselves.** A name that no longer exists, or that no longer trips the detector,
fails BY NAME as a `STALE EXEMPTION`. Otherwise this becomes the hand-maintained ban list of four.
It fired for real during the pass — the `\bFAIL\b` experiment produced 17 stale names in one run and
said so, which is how the narrowing was caught before it shipped.

---

## 4. WIRED IN: 5. PENDING-WIRE: 19.

### Wired in (measured individually, twice, and stable across the ENGINE edit)

**None of the five plays a game** (no `medicham2-browser.js`, no `game_differential.js`) and **none
writes an artifact**, so their verdicts do not depend on the simulator another division was editing.
That is the criterion by which these five and not the others were wired.

| file | exit | reading |
|---|---|---|
| `engine/gate_seed_source_audit.js` | **0** | CLEAN — 4 derived, 4 claimed |
| `engine/gate_weather_guard.js` | **0** | CLEAN |
| `engine/divergence_shape.js` | **0** | selftest green |
| `engine/gate_fail_and_silent.js` | **2 = SKIP** | CANNOT ANSWER — artifact on release `59bb68aa89a9`, tree is `7da11c1d4d10` |
| `engine/gate_offfield_target.js` | **2 = SKIP** | CANNOT ANSWER — no current artifact |

The two exit-2 gates are listed deliberately. Exit 2 is SKIP under this runner's own rule, and the
`validate_selfplay.js` precedent is explicit: a gate that cannot answer stays **visible every run**
rather than being a gate nobody remembers. Both turn 0 or 3 the moment their artifact is re-measured,
so listing them is how that re-run keeps getting asked for. Four of the five are ROADMAP rows' own
`INSTRUMENT OWED` (#241(3), #224, #287, #286) — built, and until today run by nothing.

### PENDING-WIRE: 19, each with its blocker

**Three `engine/`:**

- `feature_fixture.js` — **the refit gate.** RED today by design: `docs/MEASURE.md` records
  `--check` failing on fixture identity AND the damage table, i.e. REFIT OWED, gated behind MEDICHAM
  rather than behind compute. Wire it in the pass the refit lands — and note the file's own warning
  that a RESTAMP answers the fixture gate while SILENCING the table gate.
- `format_audit.js` — a real conformance check. Blocked twice: it WRITES `data/format-audit.json`
  every run, and it was not measured because a MEASURE agent may not write into `data/` beside a live
  ENGINE agent.
- `register_reality.js` — a real check. Same write blocker, plus this pass was told not to touch
  `docs/ROADMAP.md`, which it reads. Unmeasured, deliberately.

**Sixteen `tests/`, and they share one blocker.** Every single one loads
`engine/medicham2-browser.js`, `engine/champions_sim.js` or `engine/game_differential.js` — **every
one plays a game.** Nine measured exit 0 on 2026-08-22; that is recorded in the file as evidence, not
as a certificate, and none was re-certified. On top of that shared condition:

| file | its own blocker |
|---|---|
| `staged_board.js` | RED. Three scenarios, **ONE** defect: a species-NAME-keyed Showdown mirror in `engine/game_differential.js` (22 of 25 clean). ENGINE owns it, and is editing that file right now. Highest leverage in the list — `SB.runOne` is required by seven discovered tests. |
| `staged_status_counters.js` | RED, unreachable by any engine fix. BEFORE arm is release `6155acc0fb26`, **STRANDED** (`M.midEventDice is not a function`) on all 11 scenarios; its own controls print *"SO THE RED ABOVE IS NOT EVIDENCE"*. LESSONS §12 — withhold and re-pin, never resurrect. Plant anchor also matched 0 times. |
| `probe_red_demo.js` | RED, a stale-patch backlog: 8 of its 10 failures are reversals whose patch text no longer matches the engine, so those eight **have not run at all** — a "shown red" claim currently false for eight wires. |
| `mutation_harness.js` | RED on `damageMultAll / lifeorb`, measured on the exact bytes ENGINE was rewriting, so it may already have cleared. Full sweep also writes `data/mutation-coverage.json`; would need `--gate-only --no-write`. |
| `roster.js` | Exit code genuinely **UNKNOWN** — a named heavy run, out of scope, not guessed at. Its artifacts are already gated by `quarantine.js --check`. |
| `probe_drag_body.js`, `probe_lifeorb_toll.js` | Refuse to run without `--release <id>`. Correct behaviour. Needs a release pin in `EXTRA`, and choosing it belongs to the baseline's owner. |
| `probe_selfdestruct_winner.js` | Landed **today** in `186cb65`; never measured by anyone but its author. It is the file that proves the assertion was needed — under the old predicate a brand-new check could land in `tests/` and nothing would say so. |
| `interaction_matrix.js`, `probe_pair.js` | Libraries whose module contract IS exercised by a discovered test (`test-interaction-matrix.js`, `test-pinch-family.js`); only the standalone selftest is unrun. |
| `probe_bracket_counters.js`, `probe_fail_and_silent.js`, `probe_mega_priority.js`, `probe_mega_damage_abilities.js`, `probe_trace_choice.js`, `probe_turn_order.js` | Green on 2026-08-22, not re-certified. These are the ones most likely to wire in unchanged once the tree settles. |

`PENDING_WIRE` may shrink by wiring a file in. Growing it means editing `run-all.js` and writing a
reason — a person deciding once, in writing, the same standard as an artifact declaring
`"rerun": false`. A silence does not meet it.

---

## 5. SHOWN RED ON A DELIBERATE BREAK, INCLUDING THE ORIGINAL DEFECT

Run on a copy of the runner outside the repo with `ROOT` pinned, so the tree was never edited:

```
CONTROL — unmodified                                      exit 0   AS EXPECTED
BREAK 1 — an accounted-for check loses its name           exit 1   AS EXPECTED  (1 unaccounted for)
BREAK 2 — a stale name describing nothing                 exit 1   AS EXPECTED  (STALE EXEMPTION)
BREAK 3 — a new unaccounted check appears                 exit 1   AS EXPECTED  (1 unaccounted for)
BREAK 4 — coverage term removed from the exit expression  exit 0   AS EXPECTED  (1 unaccounted, printed, exit 0)
```

**BREAK 4 is the proof that matters.** It reproduces the defect exactly as it stood: the runner
prints an unaccounted-for check and exits 0. That is what the sentence at the top of the file had
been describing as a failure for as long as it had been written.

A `--coverage` flag was added for this. It computes the coverage verdict alone and **runs no child at
all**, which is the only way to demonstrate the gate red during another division's pass without
photographing a moving subject.

---

## 6. WHAT THE NEXT PERSON SHOULD KNOW

1. **The runner will now go RED when a new check lands unnamed.** That is the ratchet and it is the
   point; the failure message says exactly what to do (wire it in, or name it with a reason). It is
   worth expecting during an active ENGINE pass — `probe_selfdestruct_winner.js` landed the same day
   this was written.
2. **`tests/bench-medicham.js` is still outside every detector** and deliberately so: it exits 1 on a
   >10% wall-clock slowdown, and a wall-clock threshold on a 16-core box with a dozen Claude
   processes resident is not a suite gate. Its own text says *"Say so; do not file it."* Recorded so
   nobody rediscovers it as a gap.
3. **The single highest-leverage fix in the whole accounting is unchanged**: the species-name-keyed
   Showdown mirror in `engine/game_differential.js`. It closes `staged_board.js`'s three scenarios,
   and `SB.runOne` is required by seven discovered tests.
4. **Path strings in this file are forward-slash everywhere, including on Windows,** because they are
   compared against each other as well as passed to `D()`. `path.join()` yields a backslash on win32,
   so a `tests\x.js` from discovery would never match a `tests/x.js` in a list — an exemption that
   silently fails to match is precisely the class of defect this file exists to catch.
