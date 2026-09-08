# The census is not in the release, and `--only` is not a filter — 2026-09-08 (MEASURE)

**Status: COMPLETE.** Written as the work happened, per the standing instruction that eleven
agents have lost their account to a stall.

Two instruments, both filed by other divisions, both of the shape this project is named after: a
capability is absent and the run reports success.

- **JOB 1** — `engine/rollout_leaf.js census()` reads `data/rollout-switch-census.json` against its
  own `__dirname`. That file is not in `engine/engine_release.js SOURCES`, so a copy loaded out of
  `data/releases/<id>/engine/` gets ENOENT, takes the documented fallback (`switchRate: 0` — the
  playout cannot switch — and `maxTurns: 0`, which makes `miltank.js` fall back to a horizon of 60
  instead of the store-measured 14), prints one stderr line, and plays a different player while
  reporting success. Filed by SEARCH in `docs/_reports/2026-09-08-decision-profile.md` DEFECT 1.
- **JOB 2** — `engine/register_reality.js --only <id>` does not filter. Passed `--only 273` it ran
  73 instruments and rewrote `data/register-reality.json` from 112 rows to 123, beside live writing
  agents.

Tree at `e7df4962`, clean at the start of this pass. Nothing here is committed; Will publishes.

---

## JOB 1 — BLAST RADIUS FIRST

### The question, stated before the answer

Which artifacts on disk were produced by a run that loaded `engine/rollout_leaf.js` out of a release
snapshot? Those, and only those, could be switchless playouts at the wrong horizon.

### RED FIRST — the defect reproduces, and the control proves the probe can see it

`scratchpad/probe_census_release.js`, two arms over the pointer release `f0f10cd06861`:

```
  release opened: f0f10cd06861
  rollout_leaf: data/rollout-switch-census.json unavailable (ENOENT ... data\releases\f0f10cd06861\data\rollout-switch-census.json)
      — THE PLAYOUT CANNOT SWITCH and the horizon falls back to the caller's.

  ARM A  snapshot rollout_leaf.census() : {"switchRate":0,"maxTurns":0,"generated":null,"ok":false}
  ARM B  live     rollout_leaf.census() : {"switchRate":0.0998,"maxTurns":14,"generated":"2026-08-11T01:29:29.102Z","ok":true}

  KNOB REACHED THE RULE: YES — the two arms differ, so a difference is observable here
  RED: the snapshot arm returned a SUCCESS-SHAPED object with switchRate=0 and maxTurns=0.
```

The control arm is the live tree, and it is what makes the probe an instrument rather than an
assertion: if both arms had printed `{switchRate:0.0998, maxTurns:14}` the probe would be asking
nothing (`memory/a-green-test-can-be-asking-nothing.md`).

### THE STORE-WIDE COUNT — derived over all 600 release directories

| | |
|---|---:|
| release directories on disk | **600** |
| with no `engine/rollout_leaf.js` body (pruned) | 4 |
| snapshots whose frozen `rollout_leaf.js` READS `data/rollout-switch-census.json` | **485** |
| snapshots that CARRY `data/rollout-switch-census.json` | **0** |
| **AFFECTED — reads it, cannot find it** | **485** |

The 111 that do not read it were cut before the census landed, and for them there is nothing to
find: `grep -c switchRate` over their frozen `rollout_leaf.js` returns **0**. The capability did not
exist.

### WHO CAN REACH IT — four callers, derived not typed

`grep -rln "REL.require('engine/rollout_leaf" engine tests build tools`:

| caller | what it does about the census | verdict |
|---|---|---|
| `engine/bench_speed.js` | reads the census from the LIVE tree at line 98–118, digests it, and passes `switchRate` EXPLICITLY into every `rolloutWinProb`/`runPlayout` call. Its header already documents this exact defect. | **SAFE by construction** |
| `engine/rollout_r1.js` | passes `maxTurns` explicitly, never `switchRate` | exposed *in principle* |
| `engine/leaf_engine_contrast.js` | passes `maxTurns`/`foePolicy`, never `switchRate` | exposed *in principle* |
| `engine/leaf_position_contrast.js` | passes `maxTurns`, never `switchRate` | exposed *in principle* |

Two more paths were checked and are NOT exposed:

- `engine/backtest_winrate.js` requires `./rollout_leaf.js` from the **live tree** (line 52). It
  stamps release digests into its artifact but does not load the leaf out of a snapshot.
- `engine/argmax_paired.js` compiles `rollout_leaf.js` from **git bytes under its LIVE filename**
  (`m.filename = D('engine', f)`), so `__dirname` is the live `engine/` and `census()` resolves
  correctly. That is the technique that works, and SEARCH's decision-profile driver adopted it after
  hitting the defect — `data/search-decision-profile.json` records `"turns":14`, the census-derived
  cap, not the 60 fallback.
- `engine/game_differential.js`, `engine/feature_engine_contrast.js` and `engine/feature_shift.js`
  do not load `rollout_leaf.js` at all. **Nothing in `data/verification/` is touched by this** — that
  directory is ENGINE's differential prediction material.

### THE BLAST RADIUS IS EMPTY. NO PUBLISHED FIGURE IS WITHDRAWN.

The three exposed callers wrote four artifacts. Every one of them was produced **before the switch
capability existed**, so the fallback it would have taken is the only behaviour those bytes had:

| artifact | generated | release it names | frozen `rollout_leaf.js` reads the census? | occurrences of `switchRate` in those frozen bytes |
|---|---|---|---|---:|
| `data/rollout-r1.json` | 2026-08-04T08:42Z | (no release stamp) | — | — |
| `data/rollout-r1-explore-sweep.json` | 2026-08-05T02:27Z | `3932186b59ef` | **no** | **0** |
| `data/leaf-position-contrast.json` | 2026-08-05T05:55Z | `6b0e4117d964` | **no** | **0** |
| `data/leaf-engine-contrast.json` | 2026-08-07T20:17Z | `cf6a68fa412c` / `dc3c43336539` | **no** | **0** |

The census reader entered `engine/rollout_leaf.js` at commit **`f8f2c67f`, 2026-08-10** (`git log -S`
on the filename). Every artifact above predates it by three to six days, and none of those snapshots
contains the string `switchRate` anywhere. A switchless playout was not a degradation there; it was
the player.

**So: nothing is withdrawn, and this is not a basis change.** What the defect actually cost is
FUTURE work — see below.

### WHY IT IS STILL FIRST

The plan at `6.0.0` is to re-run the quarantined set — leaf calibration, R1–R4, the rollout figures —
and three of the four callers above are exactly those re-runs. Every one of them runs through a
frozen release. Had they been re-run against a post-2026-08-10 release with this in place, each
would have been a **switchless playout at horizon 60 against a shipped player that switches 9.98% of
the time on a live bench and stops at 14 turns**, announcing success while doing it. The cost is
counted forward, not backward.

## JOB 1 — DOES ADDING A DATA FILE TO SOURCES STRAND EXISTING RELEASES?

**No.** Measured, not assumed, over a six-release probe store built in the scratchpad (oldest two,
median, newest three) and driven through `ER.census({ store })`:

| | sources_now | releases | verifiable | runnable | counts |
|---|---:|---:|---:|---:|---|
| before | 26 | 6 | 6 | **4** | `{pruned:1, serviceable:4, unloadable:1}` |
| after adding `data/rollout-switch-census.json` to SOURCES **and nothing else** | 27 | 6 | 6 | **4** | `{pruned:1, serviceable:4, unloadable:1}` — row for row identical |

The mechanism, read out of `engine_release.js` rather than guessed: a release's `runnable` verdict is
computed from `union`, which `callerNeeds()` builds by scanning live `REL.require('<path>', {need})`
sites. **No caller `REL.require`s the census**, so it never enters the union. `row.missing_sources`
grows by one entry on all 600 rows — and that field is documented in the file as *"a FACT on every
row and never the verdict"*, precisely because adding `engine/pp.js` once made 112 of 117 releases
"predate a source" and buried the cause that mattered.

**One accompanying change was needed and the existing test named it.** `tests/test-engine-release.js`
asserts that every frozen source whose working-tree bytes are LF is pinned `eol=lf` in
`.gitattributes` — the CRLF-stranding guard, whose own header says *"a 27th source added LF with no
attribute fails it by name"*. The census is LF, so `.gitattributes` gains one line. Without it every
future checkout would rewrite the file and move every release id with no code change.

## JOB 1 — THE FIX, AND WHY IT IS IN THREE PLACES

**Adding the census to SOURCES fixes the NEXT release and not the 485 already on disk.** Their frozen
`rollout_leaf.js` bytes still hold the degrading `census()`, and frozen bytes cannot be edited — that
is the whole point of them. So:

1. **`engine/engine_release.js` SOURCES += `data/rollout-switch-census.json`.** It meets the list's
   own stated criterion — its CONTENT changes a number, and switch rate and horizon are two of the
   largest parameters the leaf has. It is DERIVED (`node engine/rollout_switch_census.js`), so
   freezing it freezes WHICH derivation the run used: the identical argument
   `data/residual-order.json` and `data/switchin-order.json` are on the list under.
2. **`engine/engine_release.js` `open().require()` now REFUSES a `.js` source whose snapshot does not
   also carry the data files those bytes open with `fs`.** This is the retroactive half: it lives in
   live, unfrozen code, so it applies to every release ever cut. The dependency set is **derived from
   the snapshot's own bytes** (comments stripped, `.json` literals, intersected with today's
   SOURCES), not typed — `engine/rollout_leaf.js` has a SECOND read of the same shape,
   `data/move-priors.json`, whose absence downgrades every playout to a uniform move draw and
   announces it on one stderr line. This is a class, not an instance.
   - The intersection with SOURCES is a **deliberate under-count and the code says so**: it drops
     `data/store-validation.json` (a real gap — read by `engine/quality.js`) and
     `data/smogon-priors-bo3.json` (a false positive — a WRITER literal in `engine/smogon_priors.js`,
     never read at run time).
   - It guards `require()` and **not** `path()`, because `engine/argmax_paired.js` deliberately takes
     `REL.path()` and aliases the module onto its LIVE filename, where every `fs` read resolves
     correctly. Refusing there would be a false alarm on the one technique that works.
   - `{ dataMissingOk: [...] }` is the explicit opt-out, the same contract shape as `need`/`want`.
     **`engine/bench_speed.js` is the one caller that declares it**, because it does the work: it
     reads the census from the live tree itself, digests it into its artifact, and passes
     `switchRate` explicitly into every call.
3. **`engine/rollout_leaf.js` COUNTS the fallback as well as announcing it.** The stderr line was
   already there and was already correct; SEARCH's run printed it and reported success anyway,
   because nothing downstream could see it. `SWITCH_COUNTERS.censusFallback` increments, and
   `engine/miltank.js` stamps it into every decision row beside `switchesOffered`/`switchesExecuted`.
   That makes `switchRate: 0` arrived at by DEGRADATION distinguishable from `switchRate: 0` chosen
   deliberately, which is a documented setting.

`engine_release.js census()` also gained a cause, because for one run it said `serviceable` about a
release that `REL.require` was throwing at — two answers to one question, which is the failure this
file exists to stop. `surface()` loads a snapshot file directly and never passes through `open()`.
The new cause is `data-not-frozen`: *loads, exports everything, and would run a DIFFERENT player.*
A caller's `dataMissingOk` is deliberately NOT honoured there, because that census asks the hardest
question any live caller asks — which is already why `union` is a union.

### WHAT THIS DOES TO THE RUNNABLE COUNT, SAID PLAINLY

On the six-release probe store, `runnable` goes **4 to 0** once the new cause is applied. That is not
a regression and it is not new damage: those releases were never able to repeat the shipped leaf, and
the count was reporting them as if they were. The remedy is one command — cut a new release, which is
what every quarantined re-run has to do anyway.

### SHOWN RED, WITH THE KNOB CLEARED — `tests/test-engine-release.js` section 11

Three arms, in-band, so the green is the guard working rather than the query answering the same for
everything:

```
  -- the data a frozen source opens with fs (the census that was not in the frame)
  ok   the census is one of the frozen sources
  ok   RED — release f0f10cd06861 (cut 2026-09-08T05:41:16.014Z) refuses the leaf it froze
  ok   and the refusal NAMES the data file, not just the module
  ok   and says what the fallback would have DONE, because a silent fallback is the defect
  ok   and it is not a bare resolver error — the read would have succeeded and degraded
  ok   CONTROL — the same release with dataMissingOk declared loads, so the refusal is the data check
  ok   GREEN — a release cut now freezes the census with the leaf
  ok   and the bytes are in the snapshot, not merely the digest in the manifest
  ok   and the leaf requires out of it with nothing declared

ENGINE RELEASE TESTS: 80 passed, 0 failed          (was 71 passed, 0 failed)
```

The RED arm derives its release rather than naming one, so when every release on disk carries the
census the arm retires itself and says so instead of failing.

**And the counter, with a silent control** (`scratchpad/probe_census_counter.js`, two child processes
because `census()` memoises per process; `fs.readFileSync` stubbed for that one path only):

```
  ARM A (broken)   census={"switchRate":0,"maxTurns":0,"ok":false}  SWITCH_COUNTERS.censusFallback=1
  ARM B (control)  census={"switchRate":0.0998,"maxTurns":14,"ok":true}  SWITCH_COUNTERS.censusFallback=0
```

### ONE GAP LEFT OPEN ON PURPOSE, REPORTED RATHER THAN BUILT

`tests/test-artifact-rerunnable.js judge()` asks a per-CALLER question and answers it through
`open()` + `surface()`, so it does not apply the new data-dependency rule. It is not wrong today:
the twelve artifacts that would change band are all `engine/bench_speed.js`'s, and bench_speed
declares `dataMissingOk`, so the honest answer for them is RE-RUNNABLE either way. It would become
wrong the day a NEW caller requires the leaf out of an old release and stamps an artifact. Closing it
needs `callerNeeds()` to parse `dataMissingOk` as well as `need`. **Filed, not done** — the ratchet
reads `1 known, was 1` and is green.

### A DOCUMENTATION FIGURE THAT STOPPED BEING TRUE, NAMED HERE AND NOT REWRITTEN IN PLACE

`docs/ABRA-technical-docs.md:791` reads *"The release identifier is the hash of the bytes of 26
frozen sources"* and line 812 *"17 of the 26 frozen sources have this setting. The other 9 have CRLF
bytes on the disk today."* Both sit inside a dated fault narrative about 2026-08-26/28, which this
project does not rewrite in place. The live figures are **27 sources, 18 LF, 9 CRLF** — read from
`REL.SOURCES`, which `tests/test-engine-release.js` prints on every run. The count has now gone stale
five times and CLAUDE.md already says to read it from `SOURCES` and never from a sentence.

---

## JOB 2 — `--only` WAS NOT A BROKEN FLAG. IT WAS NOT A FLAG.

### RED FIRST — and the finding is worse than the filing

```
$ grep -c -- "--only" engine/register_reality.js
0
```

The string does not appear in the file. `has()` is asked about the flags the file knows and
**nothing looks at the rest of argv**, so `--only` and `273` were two inert tokens. Behaviourally,
with the read-only path so nothing is disturbed:

```
$ node engine/register_reality.js --list          > a.txt
$ node engine/register_reality.js --list --only 273 > b.txt
$ diff a.txt b.txt
IDENTICAL — --only changed nothing
```

`--onyl`, `--dry-run`, `--row 273` and `-n` all behaved the same way: full run of 73 instruments,
full republication of `data/register-reality.json`. **The defect is not the missing filter. It is
that an argument this file could not name did something OTHER than what its author asked for,
silently** — the CLAUDE.md failure shape reached through argv.

### THE FIX — both halves, plus the write

1. **`--only <ids>` is a real filter**, applied inside `measure()`, which is the one place an
   instrument is started. `--only 273,449` is accepted; `#273` is accepted.
2. **An argument this file cannot name is REFUSED, exit 2**, rather than ignored.
3. **`--only` publishes NOTHING.** A filtered measurement carries `partial`, and `publish()` refuses
   on that — on the DATA, not on the flag, which is the same shape ROADMAP #369's refusal already
   uses and for the same stated reason: *"a `has('--list')` check here would be a restatement of the
   mode, which is what failed."*
4. **`buildArtifact()` now stamps `tree_state`** — `git rev-parse HEAD` plus
   `git status --porcelain` taken at the START and again at the END of the run, with
   `moved_during_the_run` and `settled` derived from them. `dirty: null` means *git could not be
   asked*, which is deliberately not the same value as the empty array meaning *clean*. **An
   artifact with no `tree_state` key predates this and cannot answer the question at all** — which
   is the state of the one on disk.

### MEASURED, after

```
$ node engine/register_reality.js --onyl 273
register_reality: unrecognised argument "--onyl".
  It was IGNORED before 2026-09-08, which is how `--only 273` came to run all 73 instruments
  and republish data/register-reality.json. This file now refuses what it cannot name.
  Known: --list --json --selftest --only <ids>
exit=2

$ node engine/register_reality.js --only            -> exit 2, "needs a value"
$ node engine/register_reality.js --only banana     -> exit 2, "takes register row ids"

$ node engine/register_reality.js --only 273,449
REGISTER REALITY --only 273,449 — 2 instrument(s) run. NOTHING WAS WRITTEN.
  CONFIRMED             #273  exit 0
  CONFIRMED             #449  exit 0 (cached)

artifact digest before=9e805490d1785e094741d8799405b545 after=9e805490d1785e094741d8799405b545
mtime before=1788850329 after=1788850329
UNTOUCHED — not one byte and not the mtime
```

**2 instruments, not 73.** Both rows come back CONFIRMED, which agrees with the two that were checked
by hand.

### SHOWN RED IN-BAND, WITH THE KNOB CLEARED — `--selftest`

```
  ok   RED — publish() REFUSES a PARTIAL measurement. A filtered run cannot replace a whole-register
             artifact the MEDICHAM gate reads row by row
  ok   RED — an argument this file cannot name is REFUSED, not ignored. `--only 273` was two inert
             tokens and ran all 73 instruments
  ok   and a value-less or non-numeric --only is refused by name rather than defaulting to everything
  ok   CONTROL — the same parser accepts the flags it knows and reads the ids it was given
  ok   the fixture has two marked rows, so a filter has something to remove
  ok   --only 12 runs ONE of the two marked rows, and it is #12
  ok   and the measurement carries `partial`, which is what publish() refuses on
  ok   CONTROL — no filter runs both, so the filter is doing the removing and not the fixture
  ok   --only naming a row that is not marked says so instead of reporting a clean sheet

REGISTER-REALITY SELFTEST: 82 passed, 0 failed      (was 73 passed, 0 failed)
REGISTER-REALITY READ-ONLY: 10 passed, 0 failed     (unchanged)
```

The CONTROL arms matter: a parser that refused everything would satisfy both refusal assertions while
breaking the tool, and a fixture with one marked row would make the filter look like it worked when
it had removed nothing.

### THE ARTIFACT ON DISK — WHAT IT ACTUALLY IS, AND WHY I DID NOT REGENERATE

`data/register-reality.json` is committed and clean in the working tree. Compared with its
predecessor (`git show f8716264:data/register-reality.json`):

| | |
|---|---|
| previous artifact `generated` | **2026-08-27T20:06:53Z** — twelve days stale |
| current artifact `generated` | 2026-09-08T06:44:52Z, 123 rows, `distinct_commands_run: 73` |
| rows added / removed | 13 / 2 |
| **verdicts that CHANGED on rows present in both** | **37** |
| `tree_state` on either | **absent from both** |

**Neither artifact is quotable, and they are unquotable for different reasons.** The old one is
twelve days stale. The new one is a full, fresh run whose 73 exit codes were all reads of a tree that
another division was editing — `engine/medicham2-browser.js` was modified in the working tree at the
time. 37 verdicts moved, many of them `INSTRUMENT UNRUNNABLE -> CONFIRMED`, which is exactly what
twelve days of real repair work would also look like. **Nothing in either file can separate the two
explanations**, which is the whole point of the `tree_state` stamp added above.

**I did not regenerate, and the reason is measured rather than cautious.** Another agent is writing to
this tree right now:

```
tests/roster.js                  mtime 2026-09-08 09:33:22 -0400   (17 seconds before this line)
tests/probe_control_self_name.js mtime 2026-09-08 09:17:13 -0400   (untracked, not mine)
data/verification/_prediction-2026-09-08-control-not-quiet.json    (untracked, not mine)
```

`node tests/roster.js --stage moves` **is one of the 73 instruments**, so a regeneration started now
is guaranteed torn on at least that row — it would manufacture a second torn artifact by the same
mechanism, wearing a fresh timestamp. Those three files are ENGINE's; **reported, not touched.**

**I also did not hand-edit the artifact to mark the rows.** `publish()` is the only write site and it
refuses anything that is not a measurement; going round it with an editor is the manufactured-receipt
shape this repo has already hit three times.

**So the artifact's 123 rows are NOT QUOTABLE and nothing in this report quotes them.** The repair is
one command, over a settled tree, and it takes about 28 minutes (summed from the artifact's own
per-instrument `ms`):

```
git status --porcelain          # must be empty of tracked modifications FIRST
cmd.exe /c "tools\lownode.cmd engine\register_reality.js"
```

The result will carry `tree_state.settled: true` if the tree held still, and will say so if it did
not.

### AND YES — THE TOOL SHOULD REFUSE TO WRITE WHEN GIVEN `--only`. IT NOW DOES.

The brief asks whether a run that rewrites a shared artifact while other agents write is itself a
hazard. It is, and the narrower answer is that a **partial** run may never write a **whole-register**
artifact at all, independently of who else is running: `engine/quarantine.js openDefectClause` reads
that file row by row, so a filtered run that published would replace 122 measured verdicts with
nothing and the gate would report OK for exactly the reason that should make it loudest. That is
ROADMAP #369 verbatim. It is refused on the measurement's `partial` field, at the write site.

The broader hazard — a FULL run beside live writing agents — is not refused, deliberately. Refusing
on a dirty tree would block the legitimate case where the dirt is unrelated, and this project's own
record is that an over-firing gate is the one people learn to ignore (#148). It is now **recorded**
instead, in `tree_state`, where a reader and a later instrument can both see it.

---

## WHAT THIS PASS DID NOT MOVE, CHECKED RATHER THAN ASSUMED

**Board-material is untouched because nothing the differential reads was edited.**
`engine/game_differential.js` contains exactly one occurrence of the string `rollout_leaf`, at line
8866, inside a comment; it does not load the leaf. The files it DOES take out of a release still
load, verified against the pointer release:

```
pointer release f0f10cd06861
  OK   REL.require(engine/medicham2-browser.js)
  OK   REL.require(engine/board.js)
  OK   REL.require(engine/mc_key.js)
  OK   REL.require(engine/champions_sim.js)
  OK   REL.require(data/engine-data.js)
  REFUSED engine/rollout_leaf.js: release f0f10cd06861 froze engine/rollout_leaf.js
          but NOT the data it opens: data/rollout-switch-census.json
```

The one refusal is the new guard doing its job on the one file this pass is about. **The differential
was NOT re-run**, and that is deliberate: `engine/medicham2-browser.js` is being edited by another
division right now (it is in `git status` and in `drift`), so any number taken from it tonight would
be a torn read of the kind this report is about. The bar to check when the tree settles is
`state.games` less `state.games_board_never_diverged` — **not**
`by_cause_totals.games_board_material`, which is the by-cause attribution and a different number.

**`engine/rollout_leaf.js` is a frozen SOURCE, so the live tree has drifted from every release.**
`ER.drift(f0f10cd06861)` now names `engine/medicham2-browser.js` (the other division) and
`engine/rollout_leaf.js` (this pass). **A new release must be cut before any quarantined re-run**, and
it must be cut over a settled tree — which is also what makes those re-runs carry the census.

**Gates run, all green:**

| gate | result |
|---|---|
| `tests/test-engine-release.js` | **80 passed, 0 failed** (was 71) |
| `engine/register_reality.js --selftest` | **82 passed, 0 failed** (was 73) |
| `tests/test-register-reality-readonly.js` | 10 passed, 0 failed (unchanged) |
| `tests/test-artifact-rerunnable.js` | ALL GREEN, ratchet `1 known, was 1` |
| `tests/test-docs-current.js` | 33 passed, 0 failed; backlog **29 of 100** |

`node engine/status.js` was **not** run and `--write` was **not** run. It is a 126-second read of the
whole tree and the tree is moving; it would report a state nobody could reproduce.

## FILES TOUCHED

| file | why |
|---|---|
| `engine/engine_release.js` | census in SOURCES; `dataDepsOf`; `dataRefusal`; the guard in `open().require()`; the `data-not-frozen` census cause |
| `engine/rollout_leaf.js` | `SWITCH_COUNTERS.censusFallback` incremented in the census catch |
| `engine/miltank.js` | stamps `censusFallback` into every decision row |
| `engine/bench_speed.js` | declares `dataMissingOk` for the census it reads live |
| `engine/register_reality.js` | `readArgv`; `--only`; the partial-publish refusal; `tree_state`; nine selftest arms |
| `tests/test-engine-release.js` | §11, the three-arm data-dependency demonstration |
| `.gitattributes` | `data/rollout-switch-census.json text eol=lf` |
| `docs/RUNNING-NOTES.md` | the row |

**Not committed. Not versioned. `CHANGELOG.md` untouched.** Will publishes.

**Reported and NOT touched** — another division's live work, found in `git status` during this pass:
`tests/roster.js` (modified), `tests/probe_control_self_name.js` (untracked),
`data/verification/_prediction-2026-09-08-control-not-quiet.json` (untracked),
`docs/_reports/2026-09-08-speed-curve.txt` (untracked).

**Scratchpad, not committed:** `probe_census_release.js` (the two-arm RED probe),
`probe_census_counter.js` (the counter probe with its silent control), `census6.js` and
`relstore/` (the six-release probe store), `frag1.md`, `frag2.md`, `frag3.md`, `row.md`.
