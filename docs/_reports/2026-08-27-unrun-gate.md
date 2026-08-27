# The unrun gate was already run, and the crash was the real unrun thing — 2026-08-27 (MEASURE)

Historical record, per `docs/_reports/`'s standing terms: never maintained, never cited as current
state, superseded by the register rows it feeds. Every figure below was measured on 2026-08-27 unless
it is explicitly attributed to another pass, and the attributed ones are named as such.

---

## VERDICT

1. **`tests/test-fixture-legality.js` WAS ALREADY REGISTERED. The brief's first premise is false.**
   `tests/run-all.js` DERIVES the tests/ half of its run list by globbing `^test-.*\.(js|py)$`, so the
   file was registered the instant it landed (commit `d448912a`, 2026-08-27 00:29) and its red has
   propagated ever since. `--list` prints `RUN tests/test-fixture-legality.js`; standalone it exits 1
   with `FIXTURE LEGALITY: 2 FAILED`. Nothing needed wiring, and nothing was wired.
2. **`tests/test-resolution-order.js` IS NOW WIRED FOR HEAP, and by declaration rather than by list.**
   It declares `ABRA-HEAP: 6144` in its own header; `plan()` derives it and passes
   `--max-old-space-size=6144` **before** the script path. An OOM still FAILS — annotated
   `OUT OF HEAP`, never downgraded to a SKIP.
3. **The registration list is HALF hand-maintained, and the audit on that half is red.** Derived: the
   144 tests/ entries. Hand-typed: the 21 engine-side `GATES`, plus `NOT_A_CHECK` (23) and
   `PENDING_WIRE` (20). The coverage assertion over them is **red at 18 unaccounted-for checks** —
   4 in `engine/`, 14 probes in `tests/`, three of those created by ENGINE during this pass.
4. **One real gate was found that nothing has ever run**: `engine/derive_protocol_events.js`.
5. **Predicted suite red count: 30 → 29, or 30 → 30.** Prediction, not measurement. See below.

---

## 1. THE PREMISE THAT WAS WRONG, AND WHY IT IS WORTH A SECTION

The brief said: *"`tests/test-fixture-legality.js` IS NOT REGISTERED IN `tests/run-all.js`, so its red
does not propagate"*, and asked for it to be registered even though the suite would get redder.

It is registered. `tests/run-all.js` line 51:

```js
const testFiles = fs.readdirSync(D('tests'))
  .filter(f => /^test-.*\.(js|py)$/.test(f))
```

That is the whole registration mechanism for the tests/ directory, and it is the point of the file —
its header is about the CI job list that named 6 of 18 tests by hand. A file called
`test-fixture-legality.js` cannot fail to be registered without somebody adding an exclusion, and
there is no exclusion list.

Evidence, both taken today:

- `node tests/run-all.js --list` prints `RUN   tests/test-fixture-legality.js` (not SKIP, not absent).
- `node tests/test-fixture-legality.js` exits **1**, reporting `FIXTURE LEGALITY: 2 FAILED` —
  15 NEW illegal sets and 15 NEW illegal declarations, against 15 baselined verdicts all still
  produced, 1 UNREACHABLE declared, and the closed origin set intact at 41.

So its red already propagates: `run-all` spawns it, gets a non-zero non-2 status, and pushes it onto
`fail`, which is in the exit expression.

**Why this is recorded rather than waved off.** Two of this project's most expensive habits are a
typed list of what is open and a state that is remembered rather than printed. A brief that asserts a
gate is unwired is a typed list of one. Had the instruction been followed literally, the fix would
have been to add `tests/test-fixture-legality.js` to the `GATES` array — where it would have run
**twice per suite**, once from discovery and once from the hand list, and the second registration
would have looked like the thing that made it work. That is how a hand-maintained list grows a
duplicate that nobody can later argue away.

One caveat that is real and is not the brief's claim: `plan()` marks it `needsSim` (its source matches
`champions_sim|SHOWDOWN_PATH`), so on a machine with no `SHOWDOWN_PATH` — including CI, deliberately —
it is reported **SKIPPED with its reason** rather than run. On this machine `engine/showdown_path.js`
resolves the sibling checkout, so it runs. That is the existing loud-skip design, not a hole.

**It plays no game**, checked rather than assumed: it requires only `engine/fixture_legality.js`,
which requires only `engine/champions_sim.js` and calls `TeamValidator#validateTeam`. That is why it
was safe for MEASURE to run it standalone during an ENGINE pass.

---

## 2. THE HEAP WIRING (ROADMAP #446, THE RUNNER HALF)

### The defect, in the runner's own terms

`tests/test-resolution-order.js` opens **one frozen release per arm** and there are 26 arms. A release
is a COPY of twenty-five engine files, not a checksum, so the snapshots are resident simultaneously by
design. At node's default ceiling the process dies: exit **134**, `FATAL ERROR: Reached heap limit
Allocation failed`. Every gate in this repository is read as an exit code, so the run loop filed that
as `FAIL tests/test-resolution-order.js (exit 134)` — indistinguishable, at the exit code, from the
resolution order actually being wrong. ROADMAP #446 says exactly this and calls it *"this project's
signature failure wearing the other hat"*.

### The fix, and why it is not a table

```js
const heap = rel.endsWith('.py') ? null : (src.match(/ABRA-HEAP:\s*(\d+)/) || [])[1];
const node = heap ? ['--max-old-space-size=' + heap] : [];
return { cmd: ..., args: [...node, D(rel), ...(EXTRA[rel] || [])], heap: heap ? Number(heap) : null };
```

The obvious alternative was a `HEAP` map beside the existing `EXTRA` map. It was rejected and the
reason is written into the file: `EXTRA` carries an argument that changes what a check **asks**
(`--strict`, `--check`, `--selftest`); a heap is a fact about what a check **costs**, which only the
check knows and which moves when the check gains an arm. A cost table in the runner is the CI job list
again, and its staleness would surface as exit 134 on a machine nobody is watching. A new check that
needs headroom writes `ABRA-HEAP: <MB>` in its own header and this runner honours it with no edit
here.

### And an OOM still fails

```
FAIL  tests/test-parse.js  (exit 134, 0.0s)  — OUT OF HEAP, and no ABRA-HEAP is declared
FAIL  tests/test-resolution-order.js  (exit 134, 0.0s)  — OUT OF HEAP even at the declared 6144 MB
```

It is annotated, never downgraded. Turning an OOM into a SKIP would have been the tidier-looking
change and it is the same laundering in the other direction: a check that never ran, filed as "did not
run" and therefore not anybody's problem. The undeclared case additionally gets a line in the failure
tail naming the fix, because a diagnosis nobody can act on is a caption.

### How it was verified WITHOUT playing a game

The brief forbids playing a game and `test-resolution-order.js` plays 26 arms against the live tree,
which ENGINE held modified all pass. So the wiring was verified three ways, none of which runs it:

1. **`--list` prints the honoured value**, so the derivation can be seen to have fired rather than
   assumed: `RUN   tests/test-resolution-order.js   [ABRA-HEAP 6144 MB — --max-old-space-size=6144]`.
2. **The REAL argv of every child was captured** by stubbing `child_process.spawnSync` and requiring
   `tests/run-all.js` unmodified. Result: **165 children planned, exactly 1 carrying a heap flag**, and
   it is `--max-old-space-size=6144 ...\tests\test-resolution-order.js` — flag first, path second. No
   child ran.
3. **The flag was measured to do something, in that position and only in that position:**

   | invocation | `heap_size_limit` |
   |---|---|
   | `node script.js` | 2,240 MB |
   | `node --max-old-space-size=6144 script.js` | **6,336 MB** |
   | `node script.js --max-old-space-size=6144` | 2,240 MB |

   The third row is the point. After the script path the flag is argv, is silently ignored, and the
   command exits 0 having changed nothing — the tenth entry in the list the brief opened with.

The failure branch was also exercised directly, by stubbing two children to return 134 with a heap
message: both annotations fire, the suite still reports them as failures, and the summary line reads
`163 passed, 2 failed, 0 skipped`.

**Not verified by me:** that the file passes at 6144 with 26 arms / 1 known-open / 0 failing. That is
ENGINE's measurement of 2026-08-26, recorded in #446, and it is quoted as theirs.

---

## 3. IS ANYTHING ELSE UNREGISTERED? YES — AND THE LIST IS HALF HAND-MAINTAINED

**Derived half:** the 144 `tests/test-*.{js,py}` entries. Nothing can go missing from it.

**Hand-typed half:** the `GATES` array (21 engine-side checks), plus the two by-name exemption tables
`NOT_A_CHECK` (23) and `PENDING_WIRE` (20 after this pass).

`run-all.js` already audits that half — `looksLikeACheck` scans both directories for a file that
reports its own verdict and fails the suite if one is neither run nor named. **It is red today.**
Before this pass: 59 discovered, 23 NOT_A_CHECK, 18 PENDING_WIRE, **18 unaccounted for**, plus **1
stale exemption**. `node tests/run-all.js --coverage` exits 1.

The 18 unaccounted for:

| in `engine/` | in `tests/` |
|---|---|
| `generated_audit.js` | `probe_ability_volatile_line.js`, `probe_announce_failure.js`, `probe_hazard_recap_fail.js`*, `probe_mental_herb_order.js` |
| `move_result_state.js` | `probe_mid_cat_reload.js`, `probe_party_key_collision.js`, `probe_phaze_empty_bench.js`, `probe_poltergeist_item_line.js` |
| `orient.js` | `probe_protect_stage_order.js`*, `probe_punish_announce.js`, `probe_regenerator_line.js`, `probe_sound_lock_restart.js`* |
| `preflight.js` | `probe_spread_secondary_address.js`, `probe_volatile_start_field.js` |

\* untracked in git at the time of writing — created by the ENGINE agent **during this pass**, and
named in the CHANGELOG 5.156.0 entry that landed alongside it.

**They were deliberately NOT classified, and that is a decision rather than an omission.** An entry in
`NOT_A_CHECK` or `PENDING_WIRE` is a written judgement about a file, and the file's own rule is that
every entry is *"classified by READING that file's own header in the pass that added it, never from
memory"*. Three of these were being written while this pass ran and eleven more landed in the last
day, all owned by ENGINE. A classification written by MEASURE about a probe ENGINE is still shaping
would be a guess wearing a reason, and a wrong reason in that table is worse than the red — it is
permanent-looking. The correct owner writes them, in the pass that settles each probe.

**The red is therefore left standing and is reported, not filed.** It is not being carried as a
"known failure": it is one gate, printing 18 names, with an owner.

### A derived registration for that half was NOT built, and the argument against it

The brief asked whether a derived registration is the durable fix, on the `engine/generated_audit.js`
and `engine/read_text.js` model, and said not to build one speculatively. It was not built, because
the two halves fail differently. A missing tests/ entry is invisible — hence the glob. A missing
engine/ entry is **already visible**, by name, on every run, via the assertion above. What the
engine-side list needs is not derivation; a `GATES` entry carries an argument (`--strict`, `--check`,
`--selftest`) that changes what the gate ASKS, and deriving that would mean guessing it. What it needs
is somebody acting on the 18 names it is already printing.

---

## 4. THE GATE THAT WENT INVISIBLE BY BEING IMPROVED

The coverage assertion also reported one **STALE EXEMPTION**:

```
tests/probe_red_demo.js  — the file still exists but no longer trips the detector
```

The clause invites you to delete the name. That would have been wrong. The file had not stopped being
a check; it had changed its **exit idiom**. It computes a status into a variable, announces
`ABRA-EXIT <n>` on stderr, and ends `process.exit(CODE)` (line 4725) — which matches neither the bare
`process.exit(1)` clause nor the `process.exit(x ? 1 : 0)` clause. A gate this runner had been
watching for days went invisible **by being improved**, and deleting the exemption would have recorded
that disappearance as housekeeping.

So the detector was WIDENED, never narrowed — the rule the file states twice:

```js
const IDENT_EXIT = /process\.exit\(\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\)/;
... || (IDENT_EXIT.test(src) && /REGRESSION|FAIL/.test(src));
```

The announce requirement is kept, for the same reason the bare-literal clause keeps it.

**Measured over both directories before the clause was written**, so the widening is not a guess: it
adds **exactly two files and no others**.

- `tests/probe_red_demo.js` — its existing `PENDING_WIRE` entry stops being stale, unedited.
- `engine/derive_protocol_events.js` — **the return on the widening. A real check that nothing has
  ever run and no list has ever named.** It is two gates by its own header: *INVENTED* (a name in
  medicham2's `TRACE_EVENTS` that Showdown never emits — a false agreement the differ would align on)
  and *UNDECLARED* (an event Showdown emits that medicham2 neither emits nor gives a reason for). It
  ends `process.exit(bad)` at line 390.

It was entered in `PENDING_WIRE`, not in `GATES`, with today's blocker named: it plays no game and is
read-only without `--write`, so the artifact objection that blocks `engine/format_audit.js` does not
apply — but its verdict is a function of `engine/medicham2-browser.js`'s `TRACE_EVENTS`, which an
ENGINE agent held modified for the whole pass. Measuring it here would have photographed a moving
subject, and reading those bytes at all is the hazard CLAUDE.md names. It exits 2 without
`SHOWDOWN_PATH`, which the runner treats as SKIP, so wiring it will be safe on a bare checkout.

Coverage after this pass: 61 discovered, 23 NOT_A_CHECK, 20 PENDING_WIRE, **18 unaccounted for, 0
stale exemptions**. `coverageFailures` 19 → 18; still red, still exits 1.

---

## 5. PREDICTIONS — LABELLED AS PREDICTIONS

**The suite was not run. Every number in this section is a prediction and none of it is a
measurement.**

- **Child count: 165 before, 165 after.** This one is measured, twice, via `--list` and via the argv
  capture. No check was added or removed.
- **Red count: 30 → 29, or 30 → 30, and I cannot tell which without a full run.** The brief gives 30
  at the last full run. `test-resolution-order.js` should leave the failure list (it was there as exit
  134, and it passes at 6144 per ENGINE's 2026-08-26 measurement) → 29. But if that last full run
  predates `tests/test-fixture-legality.js` — which was committed at 2026-08-27 00:29 and is red at 2
  — then its red is a *new* entry in the list and the two cancel → 30. No record of the date of that
  30 was found in `docs/_reports/`; the most recent totals recorded there are 33 and 29 against a
  suite of ~161, so they are older trees and cannot settle it.
- **Coverage: red before, red after, 19 failures → 18.** Measured via `--coverage`, which runs no
  child. The suite's exit code is 1 either way.
- **No game number moves, and none was measured.** Nothing under `engine/` or `data/` was edited.
  Predicted and true by construction: whole-game clause, census, board-material worklist, roster and
  differential are all untouched.

---

## 6. WHAT WAS CHANGED

| file | change |
|---|---|
| `tests/run-all.js` | `plan()` derives `ABRA-HEAP` and prepends `--max-old-space-size`; `--list` prints it; run loop annotates `OUT OF HEAP` without downgrading; `looksLikeACheck` gains the computed-identifier clause; `PENDING_WIRE` gains `engine/derive_protocol_events.js` |
| `tests/test-resolution-order.js` | header declares `ABRA-HEAP: 6144`, with the reason and ROADMAP #446 |
| `docs/ROADMAP.md` | #446 amended — runner half closed, per-arm snapshot leak explicitly still open; row stays OPEN |
| `CHANGELOG.md` | 5.157.0 |
| `docs/MEDICHAM-SPRINT-NOTES.md` | one section |

Nothing in `engine/`, nothing in `data/`, no `status.js --write`, no `register_reality.js`.

Gates run after the edits: `tests/test-roadmap-register.js` **3 passed, 0 failed**;
`tests/test-docs-current.js` **23 passed, 0 failed**; `node --check` clean on both edited JS files.

---

## OWED, NOT RUN

1. **THE FULL SUITE. I DID NOT RUN IT AND THE SUITE TOTAL IN THIS REPORT IS UNVERIFIED BY ME.** It
   plays games and ENGINE held `engine/medicham2-browser.js` modified throughout, so any total taken
   here would be a photograph of a moving subject. Run it on a settled tree:

   ```
   node tests/run-all.js
   ```

   Expect the red count to be 29 or 30 (§5), coverage red at 18, and overall exit 1.

2. **`tests/test-resolution-order.js` ITSELF, THROUGH THE RUNNER.** The wiring is verified; the
   check's own verdict at 6144 is ENGINE's from 2026-08-26 and was not re-taken.

   ```
   SHOWDOWN_PATH=<checkout> node --max-old-space-size=6144 tests/test-resolution-order.js
   ```

   Expect 26 arms, 1 declared KNOWN-OPEN, 0 failing.

3. **THE PER-ARM SNAPSHOT LEAK — ROADMAP #446 STAYS OPEN ON IT.** Nothing was done to the 26 resident
   release copies. #446's own acceptance test is unchanged: open one release for the whole file, or
   release each snapshot after its arm, then pass at the default heap and delete the `ABRA-HEAP` line.

4. **`engine/derive_protocol_events.js` — MEASURE ITS VERDICT ON A SETTLED TREE, THEN MOVE IT INTO
   `GATES`.** It has never been run by anything.

   ```
   SHOWDOWN_PATH=<checkout> node engine/derive_protocol_events.js      # no --write
   ```

   Exit 0 = both gates pass; exit 1 = INVENTED and/or UNDECLARED names printed; exit 2 = no
   `SHOWDOWN_PATH`.

5. **THE 18 UNACCOUNTED-FOR CHECKS.** Fourteen probes and four `engine/` files, owned by ENGINE. Each
   needs its own header read and one written line in `NOT_A_CHECK` or `PENDING_WIRE`, by the division
   that owns it, in the pass that settles it. Until then `node tests/run-all.js --coverage` exits 1
   and prints all eighteen by name.

6. **THE `21 GATES` HALF OF THE RUN LIST IS STILL HAND-TYPED.** No derived replacement was built, on
   purpose (§3). If the 18 above are cleared and a nineteenth appears within the week, that argument
   should be revisited.
