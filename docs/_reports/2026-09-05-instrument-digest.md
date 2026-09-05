# The instrument digest — finishing the fix for the six identical-pin runs that disagreed

2026-09-05, MEASURE. Continues commit `6f81649b`, which left the work half-done on disk (since
committed, so it was read out of HEAD rather than out of a dirty tree).

## The verdict, in four lines

1. **DERIVED, not listed.** `steering.driverCode()` calls `engine_release.requireClosure()` on the
   entry file. Verified by running it: 16 reachable local `.js` files from
   `engine/game_differential.js`, 11 after the release SOURCES are excluded. No typed list anywhere.
2. **`arms_comparable` now refuses the real pair.** On HEAD it answered `COMPARABLE`, exit 0, on the
   actual 138-vs-167 artifacts. It now answers `UNKNOWN`, exit 1.
3. **Every artifact that predates the field reads UNKNOWN, and that is 74 of 78** differential
   artifacts in `data/verification/` plus `data/game-differential.json` itself. They are not
   grandfathered.
4. **The control holds.** A pair differing only in the change under test is still `COMPARABLE`.

---

## 1. Is the stamp derived or listed?

`engine/steering.js` `driverCode(opts)`:

    const clo = ER.requireClosure([entry], ROOT);

Run live against `engine/game_differential.js` on the current tree:

    derived_from: engine/steering.js driverCode -> engine_release.requireClosure(engine/game_differential.js)
    16 files: board_state, champions_sim, diff_swarm, divergence_shape, effect_kind,
              empirical_driver, end_state_severity, engine_release, game_differential, names,
              quality, run_stamp, set_priors, showdown_path, smogon_priors, steering

The four artifacts on disk that carry the stamp record **11** of those: the five that are engine
release SOURCES (`champions_sim`, `quality`, `set_priors`, `showdown_path`, `smogon_priors`) are
excluded, because a run reads their SNAPSHOT bytes through `REL.require` and digesting the live copy
would fire on a change the run never saw. That exclusion is correct and it is also derived — the
frozen set is `Object.keys(REL.manifest.files)`, passed in from the caller that holds the release
handle.

Four unresolved edges are **reported, not swallowed** (`unresolved` in the block). Three are prose
inside block comments (`./x.js`, `./literal`, a line-wrapped path in a comment). None is a real
require.

`driverCode` **throws** on an undigestable file rather than omitting it. There is no `catch {}`.

Verdict: **derived.** Nothing to fix on item 1.

## 2. Does `arms_comparable` refuse a pair whose instrument digests differ?

Yes, and it did already on HEAD for the *differing-digest* and *one-side-missing* cases. What HEAD
still did was answer **COMPARABLE** when **neither** side carried the field — which is every artifact
that existed before 07:00Z this morning, including the fixture. That was the remaining hole and it is
now closed.

`engine/steering.js` gains a three-word verdict:

    const VERDICT = { OK: 'COMPARABLE', NO: 'NOT COMPARABLE', UNKNOWN: 'UNKNOWN' };

- **NOT COMPARABLE** — something was *shown to differ*. An arm can be re-run.
- **UNKNOWN** — something *could not be shown the same*. No work done today recovers it; the runs are
  already on disk.
- Both set `ok: false`, both exit 1, both print the same `DO NOT PUBLISH THIS AS A BEFORE/AFTER`
  line. UNKNOWN is **not** a softer refusal, and the output says so, because a verdict that reads
  softer is how a caption becomes a quarantine.

`compare()` returns `{ ok, verdict, reasons, proven, unknowns, limits }`. `reasons` still carries both
lists concatenated so that `engine/coverage.js` (`r.reasons.join('; ')`) and
`game_differential.js`'s `baselineGuard` keep printing every line. The split is additive.

`baselineGuard` now prints the verdict word, and adds a line for the UNKNOWN case saying that
re-running *this* arm cannot fix it — the baseline is already on disk.

The limits block is computed from the pair, not typed: it now distinguishes zero / one / two stamped
arms and, where the driver is unstamped, says the fact is **reported above as UNKNOWN rather than
waved through**.

## 3. RED FIRST, on the real artifacts

`tests/probe_instrument_digest.js`. It plays no games; every case reads artifacts already on disk.
It loads the **pre-fix modules out of commit `6f81649b`** (git, two local require paths rewritten to
absolute) rather than describing what they used to say.

    === 1. THE REAL FIXTURE — 138 vs 167, one set of pins, different driver code ===
      before  leaf-widening-all16-joint.json         diverged=138  release=688e696f00c8
              census=9446a684709d  pool=0d103fb9fa87  cap=12
      after   leaf-widening-all16-joint-BEFORE.json  diverged=167  release=688e696f00c8
              census=9446a684709d  pool=0d103fb9fa87  cap=12
      driver_code: before=ABSENT  after=ABSENT

      PRE-FIX (commit 6f81649b, the bytes on disk this morning):
        verdict: COMPARABLE          <- the hole
      NOW:
        verdict: UNKNOWN   ok: false

That is the demonstration the brief asked for, on the two real artifacts, unedited. The artifacts do
predate the digest field — so the RED is that the check **certified them**, not that it read two
different digests.

Two further cases exercise the differing-digest clause itself:

- **2a, fully real and confounded.** `_repro-smoke.json` @ `0606dbf777dc` vs `cap20-control-12.json`
  @ `4a48f9981b77`. NOT COMPARABLE; the instrument clause fires and names
  `engine/game_differential.js` as the file that moved. These two also differ in policy, pool and
  games, so it shows the clause fires on measured digests — not that it is the only reason.
- **2b, constructed, and said so.** `cap20-control-12.json` on both sides, with the after-arm's
  `steering.driver_code` replaced by the block measured in `_repro-smoke.json`. Both digests are real
  measured values from real runs six hours apart; nothing else is changed. Result: NOT COMPARABLE
  with **exactly one** reason, the instrument.

  This case is constructed because **no real pair on disk differs only in driver code.** The field is
  six hours old and the four artifacts carrying it were taken in two sittings that also moved the cap
  or the pool. Isolating it required constructing it; claiming a real isolated pair would have been a
  demonstration I could not make.

## 4. The control — the check has not been made to refuse everything

- **Case 3, fully real.** `cap20-control-12.json` vs `cap20-empirical.json`: same driver code
  `4a48f9981b77`, cap 12 vs 20. Verdict NOT COMPARABLE **on the cap only** — zero instrument
  reasons. The clause does not over-fire on real artifacts.
- **Case 4, the control.** `cap20-control-12.json` against itself with `engine_release` changed to
  `a5c736283129` — the engine moved, nothing else did. Verdict **COMPARABLE**, `ok: true`, no
  reasons. Constructed for the same reason as 2b: no two stamped artifacts on disk carry two
  different releases.
- **`tests/test-pin-arms.js` PART 4 control** (same pin set ⇒ comparable) and
  **`tests/test-empirical-driver.js` §5 control** (identical tables ⇒ comparable) both still pass.
  Both fixtures were synthetic and unstamped, so both would have gone RED on the new rule; each now
  carries a `driver_code` with the **same** digest on both sides, which holds the instrument axis
  still and leaves each test's actual subject as the only variable. The reason is written into both
  fixtures.

## 5. Is every existing artifact now uncomparable? — YES, on this axis, and it is not quiet

Measured, not assumed (probe case 0):

| | count |
|---|---|
| differential artifacts in `data/verification/` carrying `steering.driver_code` | **4** |
| differential artifacts that do not | **74** |
| `data/game-differential.json` (the published gate figure, 46 board-material) | **UNSTAMPED** |

The four stamped ones are `_repro-smoke.json` and `_repro-guard-red.json` (@ `0606dbf777dc`, 06:56
and 07:00Z) and `cap20-empirical.json` and `cap20-control-12.json` (@ `4a48f9981b77`, 18:37 and
18:39Z). Everything else predates the field.

**So the honest verdict for any pre-2026-09-05 before/after is UNKNOWN.** Probe case 6 prices that
rather than asserting it: `fix-batch-7.json` (release `316669459d67`, 122) vs `fix-batch-8.json`
(release `a5c736283129`, 120) is a textbook controlled pair — same census pin, same pool, same cap,
same policy, two different releases — and it now reads UNKNOWN. So does probe case 5, the strongest
pair on disk: `leaf-widening-all16-empirical.json` (121) vs `cap20-control-12.json` (147), identical
on release, census, pool, policy, games, cap, pin set and `driver_inputs`, differing only in that one
of them carries the stamp.

**How tonight's before/afters may be quoted.** They are not withdrawn — no fact about them changed —
but a pair of unstamped artifacts may only be quoted with the instrument axis named as unchecked. The
tool now prints that sentence itself, so it does not depend on anyone remembering. Where a difference
matters, the fix is to re-take **both** arms under the stamp; there is no retroactive repair.

Note what the mid-run guard already caught, and that it is real rather than theoretical:
`_repro-guard-red.json` carries `void: true`, `driver_code_stable: false`, a `driver_code_moved` list
and blanked `diverged`/`mid_void`/`state`. The instrument was rewritten while that run was playing and
the artifact says so instead of publishing a number.

## 6. What was NOT touched

- `data/policy-weights.json` — untouched (MAG paused).
- `data/game-differential.json` — untouched; it still holds 46.
- `engine/medicham2-browser.js`, `docs/ROADMAP.md` — untouched (ENGINE owns them).
- `engine/coverage.js` — untouched. It reads `r.ok` and `r.reasons` and keeps working; an UNKNOWN pair
  now renders through its "REFUSES the pair: …" branch with the UNKNOWN text attached. Teaching it
  the third word is listed as owed below.
- Nothing was committed. Nothing was deleted.

## 7. A LIVE HAZARD, reported and not acted on

`data/diff-team-pool.json` was written at **15:44:52** local and a release was cut at **15:45:22**
("scratch explore gigaton hammer"). My edit to `engine/steering.js` landed at **15:45:21** and to
`engine/game_differential.js` at **15:46:29**. Both files are inside the instrument closure.

If a differential run was loading modules in that window, `driverCodeGuard()` will fire when it
writes and mark its artifact `void: true` with its counts blanked. That is the guard working exactly
as designed, and it is loud rather than silent — but it costs a run.

I did not revert to try to avoid it: the `steering.js` write is already inside the window, so
reverting could just as easily *cause* the mismatch it would be trying to prevent. I have made no
further writes to any file in the closure. **ENGINE should be asked whether a run was in flight at
15:45.** No process was killed and none was inspected beyond `ps`.

---

# OWED

- **`node engine/status.js --write` was NOT run.** It rewrites the GENERATED blocks in
  `docs/{ENGINE,MEASURE,OPS,SEARCH,WEB}.md` and an ENGINE agent is live in `docs/`; last write wins
  and the collision is silent. Owed once ENGINE is done.
- **The living-docs pass is owed**: `docs/MEASURE.md`, `CHANGELOG.md` and a version bump for the
  three-word verdict. Not done because the brief said do not commit.
- **`engine/coverage.js` should read `verdict`, not `ok`.** Its refusal line currently renders an
  UNKNOWN pair as "REFUSES the pair", which overstates. One ternary; owned by whoever owns
  `coverage.js`.
- **`tests/test-arm-steering.js` was not executed** — it plays real games. Its two touch points were
  read: step 4 asserts `/NOT COMPARABLE/` in stdout, which `baselineGuard` still prints for a census
  mismatch, and step 5 asserts `!ok` on an absent steering block, which is unchanged. Not the same as
  running it.
- **`tests/test-pin-arms.js` was not executed** — PARTS 1-3 stage games. PART 4 is pure and was
  reproduced verbatim in isolation: control COMPARABLE, both reds still red.
- **Three axes are still unstamped and the tool says so on every run**: `data/protocol-events.json`
  (the declared skip list, which decides which protocol lines are removed before alignment), the
  Showdown checkout beyond its commit hash, and any computed or dynamic require inside the driver.
- **`tests/probe_instrument_digest.js` pins commit `6f81649b`** for its pre-fix comparison. That is
  deliberate — a fixed revision cannot go stale — but it means the probe depends on that commit
  remaining reachable.
