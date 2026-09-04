# run-all triage — 2026-09-04

Diagnosis only. Nothing in `engine/`, `tests/`, `build/` or `data/` was edited by this pass.

## Method, and what it can and cannot prove

The decisive control was a **detached git worktree at `0b9479db`** — the last commit before this
session's three engine commits (`75e96de3` medicham2, `b885a3b6` feature_fixture, `a347d6d0`
quarantine + game_differential + the artifact swap). The live tree was never touched: **no `git stash`
was used at any point**, `git status --porcelain` held 33 entries before and 33 after, and
`git worktree list` is back to one entry. The worktree's `data/releases` was a plain checkout, not a
junction — `fsutil reparsepoint query` confirmed it before removal, so nothing recursed into real data.

Two things the worktree cannot control, stated rather than glossed:

- It has no **untracked** stores (`data/games.ladder.jsonl`, `data/games.selfplay.jsonl`,
  `data/team-pool-frozen` content). Checks that read those got a *different* failure at base, not a
  comparable one, and are attributed by mechanism instead.
- Its file **mtimes** are checkout-time, so every freshness check (`test-site-data-fresh`) is
  meaningless there.

`tests/run-all.js:633` sets **`ABRA_STRICT_SEMANTICS: '1'`** on every child. Two checks pass standalone
and fail only under the suite because of it. Every control below was re-run with that env exported.

**The settled file holds 28 top-level `FAIL` lines plus one `FAIL — UNACCOUNTED-FOR CHECK` inside
run-all's own coverage block: 29 red assertions.** run-all's own summary line reads
`143 passed, 28 failed, 0 skipped`. I could not find a thirtieth; if the brief's count of 30 came from
a different tally, say which and I will re-derive.

---

## (A) CAUSED BY THIS SESSION — exactly one

### `tests/test-divergence-composition.js` — 9 assertions, controlled

| arm | exit |
|---|---|
| `0b9479db` (pre-session) | **0** |
| HEAD | **1** |

This is the only check in the 29 whose verdict moved across the session boundary.

**Mechanism, not plausibility.** `a347d6d0` added an early refusal to `wholeGameClause`
(`engine/quarantine.js:2100`):

```js
const pol = (j.steering && j.steering.policy) ? String(j.steering.policy) : null;
// -> verdict `MEASURED ON THE WRONG POPULATION`, clauseExit 2, before any composition is built
```

`tests/test-divergence-composition.js` feeds the clause **two synthetic artifacts** (`ARM_A`, `ARM_B`,
built by `art(games, causes)` at line ~51). The string `steering` appears **zero times** in that file.
So both arms take the refusal branch, `why` carries the refusal sentence instead of the
`[EMISSION 40, ORDERING 1, ...]` block, and `readBack(why)` returns `null`. Every downstream assertion
then fails on a null:

```
FAIL  the clause prints a composition at all                     null
FAIL  ARM A composition == the shape module applied to ARM A     printed null, derived {"ORDERING":7,"EMISSION":3,"RULE":2}
FAIL  ARM B composition == the shape module applied to ARM B     printed null, derived {"ORDERING":1,"EMISSION":40,"UNPARSED":5}
FAIL  CONTROL — the two arms DIFFER                              A null   B null
```

Note the CONTROL clause is among the casualties, which is why this reads worse than it is: the test's
own knob-clearing check cannot fire when both arms are refused for the same reason.

**The same commit already fixed the other consumer and missed this one.** `engine/quarantine.js`'s own
selftest fixtures at lines 3788, 3820 and 3902 were updated in `a347d6d0` to carry
`steering: { policy: POLICY_EMPIRICAL }`. `tests/test-divergence-composition.js` was not.

**Shape of the fix: the TEST fixture, not the engine.** The refusal is doing what it was written to do.
`art()` needs a `steering` block. One assertion is worth keeping honest while doing it — the test's
whole stated purpose (its header, ROADMAP #292) is that the composition is read from the artifact rather
than a fixed file, so whoever fixes it should give ARM_A and ARM_B the empirical policy and leave a
third arm *without* one, asserting the refusal. Otherwise the fixture change silently deletes coverage
of the new branch.

One assertion in that file still PASSES and is worth reading before touching it:
`the VERDICT does not depend on the pin comparison — correctness decides it (same-mode ok=false,
different-mode ok=false)`.

---

## (C) THE TEST IS ASSERTING A STALE FACT — 5

None of these was made stale by this session; all are (C)-shaped fixes (restamp / rebuild), and all
were red at `0b9479db` with the identical text where the control was valid.

| check | the stale assertion | evidence |
|---|---|---|
| `tests/test-web-status.js` (12 FAILs) | the status board pins `engine.live = 423`, `ops.games = 52089`, `matrix_part = 19`. Live artifacts say 829, 83,774, 0. | the board's own timestamp is **2026-08-11T01:32:44.466Z** — 24 days old. Base worktree: identical 12 FAILs. Rebuild: `node web/build-status.js` |
| `tests/test-quality.js` | `cfg.provenance.funnel` records a 28.0% clean share; live is 31.2%, drift 3.2 vs tolerance 3 | store grew 67,384 → 76,431. `data/games.ladder.jsonl` mtime **19:05**, `.gz` **19:22** — both before the earliest session commit (19:32). Growth is the hourly OPS ingest (`580c05bf`, `bbcc4dbe`, `dc57c4a7`, `69e295b0`), not this session. |
| `engine/artifact_audit.js` (1 GAP) | `data/abra-tags.js` is not what `build/build_tags_js.js` would write from `data/tags.json` | base worktree reports **3** GAPs, live reports **1** — this check got BETTER across the session |
| `tests/test-site-data-fresh.js` | 11 bundles older than the newest game data (28.2d for `abra-meta.js`, `mag.js`, `mew.js`, `status.js`, `guru.js`, `roles.js`, `scoreboard.js`; 5.6d `abra-tags.js`; 3.8d `engine-data.js`) | no session file writes any of them; the reference point moves every ingest |
| `tests/test-site-sync.js` (5 FAILs) | `web/*.html` and `app/*.html` are identical | red at base, identical byte counts. WEB is paused until MEDICHAM is done; this one is red on purpose. |

**The `5 bundle(s) have a builder and NO --check — reported, not failed` line is NOT one of the 29**,
but it bears directly on the row above it: four of those five (`abra-meta.js`, `mag.js`, `mew.js`,
`status.js`) are exactly the bundles `test-site-data-fresh` reports at 28.2 days. Their AGE is checked
and their CONTENT is not, so a rebuild would silence the freshness red without anything verifying it
produced the right bytes.

---

## (D) THE TEST ITSELF IS BROKEN — 3, all heap

Confirmed, not inferred: none of the three declares `ABRA-HEAP` (`grep -c` returns 0 on each), and
re-running at `--max-old-space-size=6144` changes the verdict.

| check | at default heap | at 6144 MB |
|---|---|---|
| `tests/test-engine-release.js` | exit 134 | **71 passed, 0 failed — exit 0** |
| `tests/test-set-realism.js` | exit 134 | **6 passed, 0 failed — exit 0** |
| `engine/validate_selfplay.js` | exit 134 | exit 1, `16 passed, 1 failed, 1 inconclusive` |

The first two are memory ceilings read as verdicts — the exact class `tools/lownode.cmd`'s own header
documents. **They are not engine defects and must not be counted as such.**

`engine/validate_selfplay.js` is BOTH: the 134 is a missing heap declaration, and underneath it there
is a real red — `FAIL no duplicate ids (89)` against `data/games.selfplay.jsonl`, whose mtime is
**2026-08-19 19:51**, sixteen days old. The duplicate ids are pre-existing.

`engine/medicham2-browser.js` grew 2,836,949 → 2,848,661 bytes across the session (+0.4%). That is not
a plausible cause of a heap ceiling and is recorded so nobody hypothesises it later.

---

## (B) PRE-EXISTING — 20

Each was run at `0b9479db` (with `ABRA_STRICT_SEMANTICS=1`) and produced the **same failing
assertion text**, unless the note says otherwise.

| check | note |
|---|---|
| `tests/test-board-browser.js` | identical FAIL (`tgtMayProtect, koTarget, stallIntoEncore`). `data/board-browser-baseline.json` is `known: {}` dated 2026-08-02, `data/board-data.js` built 2026-08-02, `engine/board.js` last edited **2026-08-28** — the bundle has been behind its source for 6 days |
| `tests/test-forced-switch.js` | **passes standalone, fails only under run-all.** `run-all.js:633` sets `ABRA_STRICT_SEMANTICS=1`, which turns `magnemite.js:101 checkSemantics` from a warning into a throw. With that env, it fails at base too, with byte-identical `GATES THAT FIRED: fixture identity, damage table`. NOT caused by `b885a3b6`'s `tableDigest` change — both gates were already firing (`docs/MEASURE.md`, MODELS.md 5.241.0) |
| `tests/test-team-preview-race.js` | same mechanism, same control result |
| `tests/test-game-differential.js` | the two PART 3b endpoint FAILs (`showdown 108..174 / medicham 108..127`, `66..104 / 66..78`) are present verbatim at base. The base run showed 5 FAILs not 4; the three extra are worktree artifacts (missing team pool, unpinned dice), not comparable |
| `tests/test-model-map.js` | identical (`THE PER-TURN PIPELINE` has no box) |
| `tests/test-mutation-coverage.js` | identical (`0/2 planted stubs caught`) — see the name-collision answer below |
| `tests/test-pin-arms.js` | identical (`middle: a move at accuracy 1,2,3,4,5 does NOT hit`). The medicham2 crit-draw change was the obvious hypothesis for a shifted dice stream and the control **refutes** it |
| `tests/test-pinch-family.js` | identical (`all five 0-use members are still in the ungated set; ungated set is: firemane`) |
| `tests/test-prng.js` | identical. The three offenders (`tests/bench-medicham.js`, `tests/test-mechanics.js`, `tests/test-protocol-trace.js`) all got their LCG in commits `6f5bef4f` / `3b8f47c7` / `38c0e2b9` — none is a session commit, even though `test-mechanics.js` was edited today |
| `tests/test-fixture-legality.js` | identical 3 FAILs (25 illegal sets, 20 illegal declarations, 1 dead string literal) |
| `tests/test-stadium-roster.js` | identical 2 FAILs. `engine/quarantine.js` was already named twice in `docs/MODELS.md` at `0b9479db`, so the NOT_A_MODEL contradiction is not new |
| `tests/test-wiring.js` | identical 10 unwired capabilities, including `mega 0.00 per game` and the three "the capability does not even report" lines |
| `tests/test-web-quarantine-loaders.js` | identical 2 FAILs — this one is an "owed check" red: it fails because the `loaders(S)` probe does not exist yet |
| `engine/selftest.js` | identical 14-file list. `engine/durable-ingest.js` (modified uncommitted this session) was **already** in that list at base, so the uncommitted edit did not put it there |
| `engine/conformance.js` | red at base (70 S13 findings) and now (71). All four named regression subjects have mtimes 2026-08-11 … 2026-09-01. `data/conformance.json`'s `findings` array is byte-identical to HEAD — only `generated` and `files` (558 → 564) moved. **One extra S13 finding appeared and I did not isolate which; worth a look, not the cause of the red** |
| `engine/provenance.js` | not re-run (131 s). Attributed by a stronger check: `data/provenance-stamp.json` is **byte-identical between `0b9479db` and HEAD** once the `generated` line is stripped, so the finding set did not move across the session |
| `engine/em_validation.js` | identical (`GATE INCONCLUSIVE — the amplified regime did not produce a censoring bias larger than its own noise floor`) |
| `engine/sanity_check.py` | `store shape: the winner is always one of the two players (2 bad)`. The store it reads was last written at 19:05, before every session commit; no session file writes it |
| `engine/gate_fail_and_silent.js` | red at base too, **but with a different reason**: base exits **2 CANNOT ANSWER** (artifact measured on release `e129bca605e3`, tree `53e3e90dce8d`); live exits **1 VERDICT-RED**, 10 `-fail` events missing from medicham2, self-declared "live at or under the pin", i.e. NOT a regression. The session made this check *answerable*; the underlying narration defect is old |
| run-all's `FAIL — UNACCOUNTED-FOR CHECK` (59 files) | red at base at **57**. Exactly two of the 59 are new this session — `tests/probe_delayed_crit.js` and `tests/probe_sub_clamp.js`, both from `75e96de3`. Pre-existing red, **+2 owed by this session** |

---

## Is `test-mutation-coverage.js` the Stryker pilot?

**No. Pure name collision, and it would mislead badly.**

- `tests/test-mutation-coverage.js` is ABRA's own **COVERAGE LAYER 2** gate over
  `tests/mutation_harness.js` and `data/mutation-coverage.json` — the tag-operator sweep
  (`1563 operators over 292 tags: 565 LIVE, 998 READ-AND-IGNORED`). It was added in commit `3be3f3b9`
  ("3.47.0 + 3.48.0 + 3.49.0"), long before today.
- It contains **no reference to Stryker**. `grep -l 'stryker\|Stryker'` matches only the two new
  session files, `tools/mutate-gates.js` and `stryker.gates.conf.json`.
- Its red is the planted-stub gate: `item:choicescarf:speedMult.mult:=11.5` and
  `move:rockslide:spreadFoes:REMOVE-TAG` both read `LIVE` shipped **and** `LIVE` stubbed, i.e. the
  harness cannot see its own planted stub. Identical at `0b9479db`.
- `@stryker-mutator/core` is declared in `package.json` and **not installed**, so nothing Stryker-shaped
  ran in this suite at all.

---

## Instrument caveats

- `tests/test-board-browser.js` `require`s `engine/feature_fixture.js`, which another agent had
  modified in the working tree while I ran it. Its result matched base exactly so the conclusion holds,
  but that one read was not taken on a settled tree.
- I did not run `tests/test-artifact-keys.js` or touch `engine/feature_fixture.js`, per the brief.
- `engine/provenance.js`, `engine/conformance.js` and `tests/test-quality.js` are the three
  attributions made by mechanism rather than by a re-run. They are marked as such above.
