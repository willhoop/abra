# Session cleanup — three precise fixes, 2026-09-04 (ENGINE)

Historical findings record. Not maintained, not current state, not a source for any figure once the
register rows it feeds exist. Every number below was measured on this tree on 2026-09-04.

---

## FIX 1 — `tests/test-divergence-composition.js`: the one real regression from today

### Before

```
node tests/test-divergence-composition.js
  FAIL  the clause prints a composition at all                  null
  FAIL  ARM A composition == the shape module applied to ARM A  printed null, derived {"ORDERING":7,"EMISSION":3,"RULE":2}
  FAIL  ARM B composition == the shape module applied to ARM B  printed null, derived {"ORDERING":1,"EMISSION":40,"UNPARSED":5}
  FAIL  CONTROL — the two arms DIFFER ...                       A null   B null
  FAIL  ARM A — the composition sums to the headline's own diverged count
  FAIL  ARM B — the composition sums to the headline's own diverged count
  FAIL  a run under the BASELINE OWN mode still reports a direction of travel
  FAIL  CONTROL — a run under a DIFFERENT pin has its trend WITHHELD, not annotated
  FAIL  UNPARSED is annotated with the class that produced it, not printed bare
  9 CHECK(S) FAILED
```

### Cause

Commit `a347d6d0` added a refusal to `wholeGameClause` (`engine/quarantine.js` ~line 2102): an
artifact whose `steering.policy` is not `empirical-click/v1` is refused outright, verdict
`MEASURED ON THE WRONG POPULATION`. The same commit updated quarantine's own selftest fixtures at
lines 3788 / 3820 / 3902 and missed this consumer. The word `steering` appeared **zero times** in
`tests/test-divergence-composition.js`, so both synthetic arms were refused before the clause ever
composed a shape, and `readBack(why)` returned null for every arm — nine failures, none of them
about the thing the file tests.

### The fix

`art()` gains `steering: { policy: STEERING.POLICY_EMPIRICAL }`, with the constant **required from
`engine/steering.js`** rather than typed, so a rename there breaks loudly here instead of silently
turning every arm back into a refusal.

### AND A THIRD ARM, BECAUSE THE REPAIR ALONE DELETES THE COVERAGE

Repairing the fixture on its own would have made the file green **by no longer exercising the branch
that broke it** — this repo's signature failure. `ARM_NO_STEERING` is byte-identical to `ARM_A`
except that the one key is deleted, and it asserts four things:

| clause | asserts |
|---|---|
| CONTROL — REFUSED, not answered | `ok=false, cannot_answer=true, withheld=true` |
| the refusal names its driver | `wanted_steering_policy === POLICY_EMPIRICAL`, `steering_policy == null` |
| figures WITHHELD | `readBack(why) === null` AND `headline(r) === null` |
| CONTROL — the guard is the difference | the same artifact WITH the block composes; without it, null |

It is a control, not a grep: the knob is varied and the two outcomes DIFFER (composition vs
refusal). A test that only checked the refusal would pass against a clause that refused everything.

### After

```
node tests/test-divergence-composition.js     ->  14 clauses, all checks passed
```

### THE NEW ARM SHOWN RED, WITHOUT WRITING TO `engine/quarantine.js`

The brief forbids touching `engine/quarantine.js`, so the deliberate break was applied **in memory
only**: a scratch driver reads the file, replaces `if (pol !== STEERING.POLICY_EMPIRICAL) {` with
`if (false) {`, compiles it under the real resolved path (so its relative `require`s still resolve),
seeds it into `require.cache`, then runs the test. `git status` confirms `engine/quarantine.js` is
unmodified.

With the refusal removed, exactly the four new clauses fail and the six original ones still pass:

```
  FAIL  CONTROL — an artifact with NO steering block is REFUSED, not answered
          ok=false cannot_answer=undefined withheld=undefined
  FAIL  the refusal names the driver it wanted and reports the artifact declared none
          wanted undefined, artifact undefined
  FAIL  the figures are WITHHELD — no composition and no headline are printed beside the refusal
          composition {"ORDERING":7,"EMISSION":3,"RULE":2}, headline [12,1000]
  FAIL  CONTROL — the SAME artifact with the steering block composes, so the guard is the difference
          with steering {"ORDERING":7,"EMISSION":3,"RULE":2}, without {"ORDERING":7,"EMISSION":3,"RULE":2}
  4 CHECK(S) FAILED
```

The driver is at
`C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\72879879-cc78-43c3-bf5d-01280add6e63\scratchpad\break_steering_guard.js`
— scratchpad, not the repo.

---

## FIX 2 — three checks that could not run at all

Each died at node's default old space with a `Reached heap limit Allocation failed` stack and no
`ABRA-HEAP` declared. A SIGABRT and a red check are the same exit code, so all three read as
verdicts.

### Before (bare, `SHOWDOWN_PATH` set)

| file | exit | output |
|---|---|---|
| `tests/test-engine-release.js` | **134** | 7,576 bytes, ending in a V8 heap-limit stack |
| `tests/test-set-realism.js` | **134** | 2,270 bytes, same |
| `engine/validate_selfplay.js` | **134** | 3,839 bytes, same |

### The fix

Each file's own header now declares `ABRA-HEAP: 6144`, in the exact form
`tests/test-resolution-order.js` (6144) and `tests/probe_endturn_clock_order.js` (4096) already use:
a ` * ABRA-HEAP: <MB>` line inside the leading block comment. The declaration lives in the file
because only the check knows what it costs; a table in the runner goes stale and the staleness
surfaces as exit 134 on a machine nobody is watching.

### After

| file | exit | verdict |
|---|---|---|
| `tests/test-engine-release.js` | 0 | `ENGINE RELEASE TESTS: 71 passed, 0 failed` |
| `tests/test-set-realism.js` | 0 | `SET REALISM TESTS: 6 passed, 0 failed` |
| `engine/validate_selfplay.js` | 1 | `SELF-PLAY VALIDATION: 16 passed, 1 failed, 1 inconclusive` |

Both consumers honour the declaration. `tests/run-all.js --list`:

```
  RUN   tests/test-engine-release.js   [ABRA-HEAP 6144 MB — --max-old-space-size=6144]
  RUN   tests/test-resolution-order.js [ABRA-HEAP 6144 MB — --max-old-space-size=6144]
  RUN   tests/test-set-realism.js      [ABRA-HEAP 6144 MB — --max-old-space-size=6144]
  RUN   engine/validate_selfplay.js    [ABRA-HEAP 6144 MB — --max-old-space-size=6144]
```

and `tools/lownode.cmd`'s own derivation step — `findstr /r /c:"ABRA-HEAP: *[0-9][0-9]*"` against
the backslash-normalised path — returns ` * ABRA-HEAP: 6144` for all four files.

**A note on running `tools/lownode.cmd` from the Bash tool.** `cmd.exe /c "tools\lownode.cmd
tests\test-engine-release.js"` invoked through git-bash did not return in ten minutes; the same
script under `node --max-old-space-size=6144` finished and reported 71/0. Nothing was left running
(`Win32_Process` afterwards showed only the two MCP pdf-server node processes, neither mine, and
nothing was killed). This looks like `start "" /B /BELOWNORMAL /WAIT` not handing control back under
that shell rather than anything about the check — **unverified, reported, not acted on.**

### THE DUPLICATE-ID FINDING — GENUINE, NOT FIXED, NOT SUPPRESSED

The heap declaration lets `engine/validate_selfplay.js` reach a verdict. That verdict is RED:

```
== 2. store shape (S7), same invariants as the ladder store ==
  ok   3,090 self-play games present
  FAIL no duplicate ids (89)
```

Characterised (read-only, no write):

- `data/games.selfplay.jsonl`, 31,915,009 bytes, **mtime 2026-08-19 19:51**.
- 3,090 lines, **3,001 unique ids, 89 ids appearing exactly twice**.
- The collisions are contiguous in the `selfplay-<batch>-<i>` namespace —
  `selfplay-1-0`, `selfplay-1-1`, `selfplay-1-2`, `selfplay-1-3`, `selfplay-1-4`, … — i.e. two
  batches wrote the same id sequence, not scattered duplication.

Everything else in that run is green or explicitly inconclusive: mirror 53.7% CI [48.0, 59.2],
side balance 49.16% CI [47.40, 50.92], mega 98.1% vs ladder 98.4%, Tackle 0.00% of move events.
The one `----` line is the mirror side-balance sub-check declaring 2 games too few to judge, which
it correctly calls neither a pass nor a failure.

**This belongs to whoever owns MEW / the self-play store, not to ENGINE.** It is a store defect on a
store dated 2026-08-19, not a simulator defect, and nothing was changed to hide it.

---

## FIX 3 — the two unregistered probes

Commit `75e96de3` landed `tests/probe_delayed_crit.js` and `tests/probe_sub_clamp.js` with no
runner. Both were run alone, green arm and red arm, before being listed.

| probe | green arm | restore knob | red arm |
|---|---|---|---|
| `tests/probe_delayed_crit.js` | exit 0, `ALL CLAUSES PASS` | `MEDI_DELAYED_HIT_NO_CRIT=1` | 4 failing clauses, incl. *"the crit die was never drawn at all"* and *"the damage did NOT move across the crit die — the knob is unwired"* |
| `tests/probe_sub_clamp.js` | exit 0, `ALL CLAUSES PASS` | `MEDI_SUB_DEALT_UNCLAMPED=1` | 2 failing clauses: RECOIL `authority -12, ours -25`; DRAIN `authority 21, ours 62` |

Both got a **`GATES` entry**, not a `PENDING_WIRE` reason — there is no blocker. Precedent followed:
`tests/probe_entity_kind.js` is already a `tests/`-path GATES entry. Neither probe needs an `EXTRA`
argument, neither opens a frozen release (both read the LIVE `engine/medicham2-browser.js`, which is
what a runner working on the live tree wants), and both are handled correctly when the simulator is
absent — `plan()` skips them on the `SHOWDOWN_PATH` clause, and their own guard exits 2, which this
runner treats as a visible SKIP.

### Coverage, before and after

```
before:  COVERAGE — 119 file(s) outside the run list report their own verdict.
           23 named NOT A CHECK, 36 named PENDING-WIRE, 60 unaccounted for.

after:   COVERAGE — 117 file(s) outside the run list report their own verdict.
           23 named NOT A CHECK, 36 named PENDING-WIRE, 58 unaccounted for.
```

**Down by exactly 2, and no `STALE EXEMPTION` line appears.** Note the starting figure was **60**,
not the 59 in the brief; the brief's 57 -> 59 was measured earlier in the day. The delta is what was
asked for and the delta is exact; the absolute base is stated rather than reconciled, because I did
not measure it at the earlier point.

---

## What was NOT touched, and what is observed but unacted

- `engine/quarantine.js`, `engine/feature_fixture.js`, `engine/medicham2-browser.js`,
  `engine/durable-ingest.js`, `data/policy-weights.json`, `engine/board.js`, `engine/magnemite.js`,
  `data/engine-data.js` — all unmodified by me. (`durable-ingest.js` and `feature_fixture.js` show
  as `M` in `git status`; they were already modified before this task began.)
- No file was deleted. No process was killed.
- Nothing was committed.
- The census did not move — no mechanic was landed, so `data/mechanics-census.json` is untouched and
  no number in `engine/status.js` went down.

### Two reds observed that are NOT mine

Both were run because they mention `tests/run-all.js`; in both cases the reference is a **comment
mention only** — neither file has a runtime edge to `run-all.js`, so neither can have been affected
by the `GATES` edit.

| file | verdict | what it says |
|---|---|---|
| `tests/test-model-map.js` | 1 failure (32 ledger models, 19 on the map, 12 declared out) | an ALAKAZAM heading missing from `docs/MODELS.md`. The file's own text says this is MEASURE's ledger and is reported rather than fixed there. |
| `tests/test-mutation-coverage.js` | 5 passed, 1 failed | `the planted-stub gate catches both stubs (0/2 caught)` — the harness misses a param-level stub (`item:choicescarf:speedMult.mult:=11.5`) and a set-building stub (`move:rockslide:spreadFoes:REMOVE-TAG`); both read LIVE shipped and LIVE stubbed. Its artifact measured release `6fb9ebd3b704`; the tree is `8ad06030e129`. |

### One observation on line endings, deliberately not acted on

The five files I edited are LF in the worktree and LF in the index (`git ls-files --eol` reports
`i/lf w/lf` for all five). I could not establish from git whether they were CRLF in the worktree
before my edits, because `core.autocrlf=true` normalises on the index side and hides a worktree-only
CRLF->LF change from `git diff`. **It is inconsequential for the index** — the committed blobs are LF
either way, so no byte and no release id moves — and 271 of the tracked `.js` files under `tests/`
and `engine/` are already `w/lf` without anyone touching them, so LF is the majority state here. None
of the five is in the frozen SOURCES set or in the `eol=lf` list in `.gitattributes`. Reported, not
churned: rewriting five files' bytes on a guess would itself be the unintended change.

---

## OWED

- **The 89 duplicate ids in `data/games.selfplay.jsonl` (3,090 lines, 3,001 unique, store dated
  2026-08-19).** Contiguous `selfplay-1-*` collisions — two batches sharing an id sequence. Now
  visible on every run because `engine/validate_selfplay.js` can reach a verdict. Route to whoever
  owns MEW / the self-play store; it is a store defect, not an engine one.
- **`tests/test-mutation-coverage.js` — the planted-stub gate catches 0 of 2.** A mutation harness
  that cannot see a stub it planted itself cannot certify anything it did not plant. Not this pass's
  work and not diagnosed here.
- **`tests/test-model-map.js` — no ALAKAZAM heading in `docs/MODELS.md`.** MEASURE's ledger.
- **The unaccounted-check count is still 58 and `node tests/run-all.js --coverage` is still RED.**
  Two came off today; the remaining 58 are mostly `tests/probe_*.js`.
- **`tools/lownode.cmd` invoked via `cmd.exe /c` from the Bash tool did not return in ten minutes.**
  Unverified as a defect; the same script ran fine under bare `node` with the flag. Nothing was left
  running.
- **`engine/status.js --write` was NOT run and nothing was committed**, per the brief. The
  coordinator publishes.
