# The red-run-writes class — verification, four fixes, and a general gate

2026-08-23, MEASURE. Historical findings record; not current state, not maintained.
Companion to `docs/_reports/2026-08-23-red-run-writes.md`, which covers `test-unmodelled-clicks.js`.

## Verdict

Four of the five held up. **The enumeration I was handed was itself incomplete in the direction that
matters** — it named `tests/test-mechanics.js` as the milder class, and it is the WORST instance in
the tree: a full self-baselining ratchet on `data/mechanics-census.json`. A second unlisted file
(`engine/em_validation.js`) also reads what it writes, and was cleared by reading.

The general gate exists: `tests/test-red-run-writes.js`, green in 0.9s, auto-registered by
`run-all.js` (it matches `^test-.*\.js$`; no list edit was needed). It was shown RED on a planted new
offender before being trusted.

## 1. The five, verified one at a time

| file | claim | verdict |
|---|---|---|
| `tests/test-tag-consumed.js` | self-baselining, *partial* laundering | **CONFIRMED, exactly as described** — fixed |
| `tests/test-game-diff.js` | publishes after its comparator fails its own proof | **CONFIRMED, and worse than stated** — fixed |
| `tests/test-forme-assert.js` | writes then exits 1 | **CONFIRMED**, two different reds were being conflated — fixed |
| `tests/test-switch-back-renamed.js` | writes then exits 1 | **CONFIRMED** — fixed |
| `tests/test-mechanics.js` | "same defect", milder class, ENGINE's | **CONFIRMED AND MISCLASSIFIED — it is the severe class.** Not touched |

### `test-tag-consumed.js` — partial laundering, confirmed by execution

Not by reading alone. ENGINE was editing `engine/medicham2-browser.js` at the time and the file
`require`s it, so running the real sweep would have been a torn read. Instead the ratchet block —
`label`, `regressed`, `floor`, `status` — was copied **verbatim** into a harness and driven with a
synthetic universe in which one tag (`zzz`) was `LIVE` at the baseline and measures `DEAD` now.

```
=== OLD — write unconditionally ===
  run 1: exit 1   diagnosis: zzz -> REGRESSED (was LIVE)
          FAIL no tag lost a consumer it had at the baseline
          FAIL no tag is DEAD outside the ratchet floor      artifact REWRITTEN
  run 2: exit 1   diagnosis: zzz -> STILL DEAD
          ok   no tag lost a consumer it had at the baseline
          FAIL no tag is DEAD outside the ratchet floor      artifact REWRITTEN

=== NEW — write green-only ===
  run 1: exit 1   diagnosis: zzz -> REGRESSED (was LIVE)     artifact untouched
  run 2: exit 1   diagnosis: zzz -> REGRESSED (was LIVE)     artifact untouched
```

Two failures become one, and `REGRESSED (was LIVE)` becomes `STILL DEAD`. The file stays red, so
nobody would call it green — but ROADMAP #184's whole point is that REGRESSED (somebody deleted a
read) and ARRIVED/STILL DEAD (nobody ever wrote one) are different jobs for different people, and the
re-run destroys which one it was.

**Fixed:** write is green-only *and* only when the census moved; `--accept` re-baselines deliberately,
prints the tags it is accepting with their previous status, and still exits 1. The file's own header
claimed "the stamp is now written on EVERY run, which is itself a fix" — that sentence was correct
about the bug it replaced (a write gate that froze the baseline forever) and wrong about the
replacement. Both are recorded there now: neither "never refresh" nor "always refresh" is right; the
gate is the run's own verdict.

### `test-game-diff.js` — the instrument certifying itself after failing its own proof

First, the identity question, because two differentials exist and confusing them costs an hour:

- `tests/test-engine-diff.js` — DAMAGE, one hit through `moveHit`, owns `data/engine-diff.json`.
- `engine/game_differential.js` — WHOLE-GAME against the team pool, owns `data/game-differential.json`.
- **`tests/test-game-diff.js` — a THIRD instrument.** Scripted multi-turn games and generated
  tag x tag pairs against the pinned Showdown engine, owns `data/game-diff.json`.

Its artifact was **not** dirty (mtime 2026-08-22 01:07) and no live agent held it, so it was safe to
edit. `data/engine-diff.json` *was* dirty throughout and was not touched.

The file's own header has always said `--all` and the default run "REFUSE to report a clean result"
if `injectedDivergenceProof()` fails. **It did not.** It ran every game, printed every row, wrote
`data/game-diff.json` with a fresh timestamp, and only then set `process.exitCode = 1` — while its own
console line said *"every result below is worthless"*. Nothing downstream reads
`injected_divergence_proof`: `provenance.js` sweeps `data/*.json` on freshness and
`web/quarantine-data.js` lists the file by name.

**Fixed:** `process.exit(1)` at the proof, before a game is played and before the artifact is touched.
The aspirational header sentence now carries a dated correction rather than being quietly edited.
A DIVERGENCE still publishes green — that is what the artifact is for, and it is unchanged.

### `test-forme-assert.js` — two reds that are not the same event

It exits 1 on `failed || redsMissed`, and only one of those is a finding.

- `failed` — a forme disagrees with the authority. The instrument worked; the rows ARE the
  measurement. **Suppressing this write would delete the finding**, so it still publishes — now with
  `run_ok: false` and a `write_policy` field, because the artifact previously carried nothing at all
  that said the run had failed.
- `redsMissed` — a plant aimed at an assertion was not caught by it (`--reds`). That is the
  `test-game-diff.js` shape: the instrument failed the test of its own trustworthiness. **It now
  refuses to write and leaves the artifact on disk alone.**

### `test-switch-back-renamed.js` — status added, write kept

Same reasoning, no instrument-proof arm to separate out. A `DIFFERS` arm is the measurement; `arms` is
the only record of which one. Write kept, `run_ok` and `write_policy` added.

### `test-mechanics.js` — CONFIRMED SEVERE, and it is ENGINE's

Read only. The relayed classification was "writes the census then exits 1 for HOLLOW", i.e. the milder
class. It is not:

```
try { armBase = JSON.parse(fs.readFileSync(D('data','mechanics-census.json'),'utf8')).unarmed; }
...
if (armBase != null && unarmed > armBase) { console.log('FAILED: unarmed probes ...'); process.exitCode = 1; }
...
fs.writeFileSync(D('data','mechanics-census.json'), JSON.stringify({ ... unarmed, ... directCall, ... }))
```

Read the baseline, fail if this run is worse, then write this run as the baseline. `directCall`/`dcBase`
is the identical shape. **A run that grew the unarmed count fails once and is green on the re-run** —
the `test-unmodelled-clicks.js` defect, on the artifact that steers `all_mechanics_fire.js` and holds a
MEDICHAM gate clause. ENGINE owned and was actively editing the file (mtime 05:01 while this was
written). Not touched. Named in the gate's floor with tier `LAUNDERS`.

## 2. The gate — `tests/test-red-run-writes.js`

**The detector is a property, the floor is the accepted set, and those are different things.** The
property: *a module-level (column-0) write to a repo `data/` path, with a failure signal at a later
source line*. Column 0 is what makes it sound rather than suggestive — a write at column 0 is inside
no `if`, so nothing stands between the run's failure and the publish. Both fixes above dropped out of
the candidate set automatically, because a guarded write is an indented one.

Candidates are then classified `READS-WHAT-IT-WRITES` (the evidence-destroying class) or
`publishes-on-red`, and each must either be fixed, DECLARE `WRITE-POLICY: findings|crash-only` in its
own source *and* stamp `run_ok`/`write_policy` into its payload, or sit in `ACCEPTED` — a named,
owner-attributed floor that may shrink and may never grow.

**`ACCEPTED` is a source constant, not an artifact.** An artifact-backed floor for this particular
gate would itself be a self-baselining ratchet.

### Shown RED before being trusted

The scan roots are a parameter with a default — the `engine/publish_guard.js` idiom — so
`--scan <dir>` points the shipped gate at planted offenders instead of a re-implementation of it.
A brand-new file, in no list anywhere:

```
    READS-WHAT-IT-WRITES  .../break/new-offender.js  brand-new-ratchet.json
  FAIL no NEW check publishes on red — the accepted set is 7 file(s)
         ...new-offender.js  [READS WHAT IT WRITES — fix this one first]  writes at line 6, fails at line 7
  RED-RUN WRITES: 12 passed, 1 failed      (exit 1)
```

Section 1 additionally re-proves the detector on **every** run: two plants that must be caught and
three controls that must not be — a guarded write, a write to an `os.tmpdir()` path, and a non-zero
exit inside a crash handler. The controls are not decoration. The first draft flagged
`tests/test-arm-steering.js`, which writes a perturbed census into `os.tmpdir()` and never touches
`data/`; the crash-handler control caught that `process.on('uncaughtException', ...)` was being read as
a verdict. Both were real false positives, found by the controls rather than by inspection.

### What it can and cannot catch

**Can:** a file nobody has ever looked at, including one added tomorrow, that writes a `data/` artifact
at module level and can fail afterwards. It is not keyed to any name.

**Cannot** — stated with specifics because a check whose limits are vague reads as coverage:

1. A write reached through a helper (`publish(x)`) or from inside a callback.
2. A failure signalled by a callee setting `process.exitCode` inside a function.
3. A write guarded on something other than the run's verdict. An indented write is **not decided
   either way** — this run reports **98 such sites** across 387 files, so the blind spot is a number
   rather than a shrug (`--explain` breaks it down by file).
4. A target path assembled at run time from a variable it cannot resolve statically.
5. It cannot tell a laundering read from a verifying one. `engine/em_validation.js` reads its own
   artifact in `--check` mode, but that mode re-derives every verdict from the artifact's content and
   re-hashes every source digest — no "was this accepted before" comparison, so it cannot launder.
   `test-mechanics.js` compares against the stored number, so it can. **Both were read by a human and
   the answers are in the floor rows**; the gate itself does not claim to know.

Limits 1 and 2 mean this is not a proof. It is sound for the shape all seven known instances actually
had, which is the common shape because it is the one people write.

### Current reading (green, exit 0, 0.9s)

```
scanned 387 files; 9 candidates; 98 indented write site(s) NOT DECIDED either way
  declared findings:  tests/test-forme-assert.js, tests/test-switch-back-renamed.js
  ACCEPTED — red, named, NOT a pass:
    LAUNDERS                    ENGINE   tests/test-mechanics.js
    publishes-on-red            ENGINE   engine/all_mechanics_fire.js
    publishes-on-red            ENGINE   engine/conformance.js
    self-read, does NOT launder MEASURE  engine/em_validation.js
    publishes-on-red            ENGINE   engine/format_audit.js
    publishes-on-red            ENGINE   engine/million_run.js
    publishes-on-red            ENGINE   engine/tag_dex.js
```

Only `test-mechanics.js` and `em_validation.js` were read end to end. The other five are claimed to be
KNOWN, not safe, and their rows say so.

## 3. Proposed ROADMAP rows (not written — ROADMAP.md is held by another agent)

> **A CHECK MAY NOT PUBLISH ON A PATH WHERE IT ALREADY FAILED — GATE LANDED 2026-08-23.**
> `tests/test-unmodelled-clicks.js` rewrote its own ratchet baseline on a red run, so **re-running a
> failing test made it pass**. Six more instances found. Fixed: `test-tag-consumed.js` (green-only +
> `--accept`, laundering demonstrated on the verbatim ratchet logic: `REGRESSED (was LIVE)` -> `STILL
> DEAD` on the second run), `test-game-diff.js` (exits at the planted-divergence proof, before a game
> is played — its header had claimed this for months and it was false), `test-forme-assert.js` and
> `test-switch-back-renamed.js` (`run_ok` + `write_policy` stamped; forme-assert additionally refuses
> to publish when a `--reds` plant goes uncaught). New gate `tests/test-red-run-writes.js` enforces the
> PROPERTY — a column-0 `data/` write with a later failure signal — over 387 files, proves its own
> detector against 2 plants and 3 controls every run, and was shown RED on a planted new offender.
> **VERIFIED BY: `node tests/test-red-run-writes.js`** | closed — measure |

> **`tests/test-mechanics.js` LAUNDERS THE CENSUS RATCHET — ENGINE, OPEN.** It reads `unarmed` and
> `directCall` out of `data/mechanics-census.json`, sets `process.exitCode = 1` when this run's number
> is larger, and then writes this run's number into that file. **A run that grew the unarmed count
> fails once and is green on the re-run.** Identical to the `test-unmodelled-clicks.js` defect, on the
> artifact that steers `engine/all_mechanics_fire.js` and holds a MEDICHAM gate clause. The file
> already refuses to write under the `residualCollapsed` deliberate break and its own comment says
> "any future switch of the same kind belongs here" — the right instinct, scoped to deliberate breaks
> rather than to failure generally. Fix shape: green-only write plus `--accept` that still exits 1
> (`tests/test-unmodelled-clicks.js` and `tests/test-tag-consumed.js` are the worked examples). It is
> named in `tests/test-red-run-writes.js`'s floor with tier `LAUNDERS`; removing it from that floor is
> what closes this | open — engine |

> **FIVE `engine/*.js` GENERATORS PUBLISH ON RED, NOT READ — ENGINE, LOW.** `all_mechanics_fire.js`,
> `conformance.js`, `format_audit.js`, `million_run.js`, `tag_dex.js`. None is self-baselining. Each
> needs one decision: is its non-zero exit a FINDING (then declare `WRITE-POLICY: findings` and stamp
> `run_ok`) or a failed run (then move the write behind the verdict)? `format_audit.js` exits
> `rows.length ? 1 : 0` and is probably the first. Named in `tests/test-red-run-writes.js`'s floor |
> open — engine |

## 4. Proposed `docs/MEASURE.md` row (not written — the file was dirty under another agent)

> **A CHECK THAT ERASES THE EVIDENCE OF ITS OWN FAILURE — 2026-08-23.** Seven instruments wrote their
> artifact on a failing path; two of them wrote their OWN ratchet baseline, so a second run went green.
> Four fixed, one gate landed (`tests/test-red-run-writes.js`), two owed to ENGINE. The gate enforces a
> property over 387 files rather than a list of names, proves its own detector against plants and
> controls on every run, and prints the 98 sites it deliberately does not decide.

## 5. Skipped, to avoid racing a live agent

- **`data/engine-diff.json` and `data/published-samples.json` were dirty the whole session** (ENGINE
  running the damage differential through `engine/publish_guard.js`). `engine/publish_guard.js` is the
  canonical publish choke point and adding a red-run clause to it was the tempting "reuse the
  canonical path" move — **not done**, because it is live under another agent's run.
- **Nothing that loads the simulator was RUN.** `engine/medicham2-browser.js` was rewritten at 05:00
  and `tests/test-mechanics.js` at 05:01, so `test-tag-consumed.js`, `test-forme-assert.js`,
  `test-switch-back-renamed.js` and `test-game-diff.js` were **edited but not executed** — a torn read
  of a 1.9 MB file mid-write produces a plausible wrong answer, which is the failure mode this whole
  report is about. All four pass `node --check`; the tag-consumed logic was proven on an extracted
  harness; the other three fixes are structural (an early exit, two added payload fields).
- `tests/test-mechanics.js`, `docs/ROADMAP.md`, `CHANGELOG.md`, `docs/MEASURE.md` — held by others.

## OWED, NOT RUN

- **`tests/test-mechanics.js` — the LAUNDERS row. ENGINE's, not fixed.** The highest-value item here.
- Five `engine/*.js` generators, undecided findings-vs-failure. ENGINE's.
- `engine/em_validation.js` — a failed measurement still overwrites the last good one (ROADMAP #257's
  shape, not a laundering). MEASURE's, lowest priority.
- **The four edited tests have not been executed against a settled tree.** Run them when ENGINE is off
  the simulator: `node tests/test-tag-consumed.js`, `node tests/test-forme-assert.js`,
  `node tests/test-switch-back-renamed.js`, `SHOWDOWN_PATH=... node tests/test-game-diff.js`.
- No CHANGELOG entry, no ROADMAP row, no `status.js --write`, no commit — all reserved by the
  dispatching agent.
- Not run, per the brief: `roster.js`, `game_differential.js`, `test-engine-diff.js`,
  `all_mechanics_fire.js`, `test-mechanics.js`, `quarantine.js`, `status.js --write`. **No games played.**

## Debris left in place, reported not deleted

- `data/_pair-pilot.json` — untracked, not mine, not touched.
- Fixture directories from this session's demonstrations, all under `os.tmpdir()`:
  `abra-redrun-P8JFFY`, `abra-redrun-PFv0Ff` and one per gate run. The gate creates one every run by
  design and prints its path ("left on disk on purpose — they are the evidence"), matching
  `tests/test-arm-steering.js`. Nothing under the repository was created or removed.
