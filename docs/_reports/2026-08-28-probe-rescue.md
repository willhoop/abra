# Probe rescue — two untracked files landed, neither green — 2026-08-28

**Both probes are committed and pushed.** `59ce501c`, on `main`, 0 ahead / 0 behind.

| probe | exit | measured how |
|---|---|---|
| `tests/probe_instruct_shield.js --release aea838766e7f` | **1 — RED** | unpiped, redirected to a file |
| `tests/probe_berserk_switcheroo.js` | **1 — RED** | unpiped, redirected to a file |

**Exit codes were taken from a redirect, never a pipe.** `node x.js \| tail` returns TAIL's code, which
is how a red probe read as 0 earlier the same night. The silent-catch gate was verified the same way:
its first run in this session appeared to exit 0 through a `\| head` and was actually exiting 1.

**Neither is registered as a passing gate, and neither can be.** `tests/run-all.js` discovers only
`tests/test-*.js` (its `testFiles` glob); a `probe_*.js` file is never picked up. Landing these added
two rows to the `--coverage` unaccounted list — which is the correct place for a probe whose subject
is still open — and changed the count not at all, because the scanner reads the filesystem and the
files were already on disk.

---

## THE FOUR SILENT CATCHES — FIXED, NOT ACCEPTED BY HASH

All four were in `tests/probe_berserk_switcheroo.js`, and all four were the identical shape:

    try { ... } catch (e) { continue; }

two in the Focus Sash retry loop and two in the Endure retry loop, each wrapping a `buildPair` or a
`playGame` inside a `for (const hb of [1, 2])`.

**WHY THEY WERE WORTH FIXING RATHER THAN ACCEPTING.** Both loops end at the same sentence when nothing
staged:

> `COULD NOT STAGE -- a claim about the fixture.`

A swallowed throw and a fixture that genuinely does not qualify were **indistinguishable** at that
line. So a broken harness would have been laundered into a fact about the format — and a
COULD-NOT-STAGE verdict is a claim about the fixture, never about the mechanic. That is not a
hypothetical failure mode in this repository; it is one of the named ones.

**The fix.** Every skip now records a reason and prints it, and the verdict line changes when a reason
was a throw:

    if (endSkips.length) { console.log('      skipped hpBoost values, with reasons:');
      for (const s of endSkips) console.log('          ' + s); }
    if (!done) console.log('      COULD NOT STAGE -- ' + (endSkips.some(s => /THREW/.test(s))
      ? 'AND THE HARNESS THREW (see above). This is NOT a claim about the fixture.'
      : 'a claim about the fixture.'));

Four reason kinds are distinguished: `buildPair THREW`, `playGame THREW`, `buildPair returned null`,
`the game reported err`. **No acceptance-by-hash was recorded.** On the run below nothing threw, both
arms staged, and the skip list printed empty — so the fix is not load-bearing today and is there for
the day it is.

`node tests/test-no-silent-failure.js --only <both files>` → **exit 0, "no new silent catch blocks in
2 file(s)"**. The pre-commit hook ran it again on the staged pair and printed
`pre-commit: silent-catch gate on 2 staged .js file(s)` then `pre-commit: green`. **`--no-verify` was
not passed.**

*Scope note: two of the four catches sit inside the probe's pre-existing Endure section. Only the catch
blocks were touched — no board was staged and no probe was written for the Endure volley collapse,
which belongs to another agent.*

---

## WHAT THE INSTRUCT PROBE FOUND — its subject is unfixed and it still reads

Run against release **`aea838766e7f`** (the newest in the store, "four state fixes, settled tree after
the silent-catch gate"). **5 arms staged, 3 failing.**

The three shield arms part at the same reduced line. Showdown refuses the move; this engine announces
the repeat and then **runs a second click**:

    showdown  |-activate|<target>|move: Protect
    medicham  |-singleturn|<target>|move: Instruct|[of] <mover>
    MEDSEEN.instructRepeat = 1

on all three of Protect, Spiky Shield and Baneful Bunker. The `instruct` branch calls `shieldRefuses`
nowhere — a missing caller, not a misplaced announcement.

**BOTH CONTROLS HELD, WHICH IS WHAT MAKES THE THREE REDS MEAN ANYTHING:**

- the **King's Shield** arm — the one member of the family with `shieldsUser.blocksStatus = false`,
  and the only shield carrying `failinstruct` — HELD, with `instructRepeat = 0`. A patch that
  announced a refusal whenever the target had a shield up would break this arm.
- the **cleared-shield** arm HELD with `instructRepeat = 1`. A patch that fixed the shield by refusing
  every Instruct would fail this arm.

`blocksStatus` was read off the release's own `data/tags.json` at run time, not recalled.

**Legality was checked, not assumed.** The probe validates every fixture against
`Dex.forFormat('gen9championsvgc2026regmb')` — species legality, item legality, the ability actually
belonging to the species, move legality and learnset — and exits 2 on any failure. It staged 5 arms,
so every entity it names is legal in this regulation. It also derives and prints the population:
**Oranguru is the only legal Instruct user in this format.**

---

## WHAT THE BERSERK PROBE FOUND — it is red because its defect is GONE

Its exit 1 comes from exactly one branch:

> `THE DRIVER RECORDED NO DIVERGENCE — nothing to attribute.`

That branch sets `RC = 1` because the probe was written to ATTRIBUTE an ordering divergence, and there
is no longer one to attribute. **Both engines now print the same order** —
`|-hitcount|` then `|-ability|berserk|boost` then `|-boost|spa|1` — which is the ordering the
`ability/berserk` row in `data/all-mechanics-fire.json` was opened against.

**The comparability plant PASSED, and that is the load-bearing half.** The probe deliberately corrupts
the carrier's live `boosts.sa` by +3 at the boundary and fails if `board_state.js` does not notice.
It noticed, on two paths:

    p1.party.<carrier>.boosts.spa   us 4  sd 1
    p1.active[0].boosts.spa         us 4  sd 1

So this is a leaf that is genuinely compared, not a leaf that reads agreement because nothing looks at
it — which is the only basis on which an `ANNOUNCEMENT-ONLY` verdict on that row means anything.

**ATTRIBUTED AFTER THE FACT, AND THE ATTRIBUTION IS THE POINT OF THE CAVEAT BELOW.** The ordering
defect is gone because ENGINE fixed it, in `d31e736d` *"Berserk announced its boost seven steps
early; the authority writes it below the hit count"* (CHANGELOG 5.197.0, census 773 -> 774,
diverging abilities 2 -> 1). That commit landed AFTER my probe run — the fix was sitting
uncommitted in `engine/medicham2-browser.js`, which `git status` showed dirty at the time. So the
probe measured a fix that was not yet in any commit, which is exactly the hazard the caveat below
describes, arriving in its benign form: the answer happens to be right and the run still cannot be
cited. **This is a coincidence of timing, not a confirmation of `d31e736d`** — that fix has its own
measurement in its own commit, and this run is not a second one.

**The exit code was left alone.** Rewriting it to 0 would be authoring a verdict inside a rescue. The
honest state is: landed red, red for a reason that is good news, and not registered anywhere as a
passing gate.

**A CAVEAT THAT TRAVELS WITH THAT RUN.** The probe takes no `--release` and cuts one at require time,
so it was run bare and `tests/_live_release.js` redirected the cut to the OS temp store —
`data/releases/` and `data/engine-release.json` were untouched. It therefore froze the **live working
tree**, which held another agent's in-flight `engine/medicham2-browser.js`. Its release id exists only
in a temp directory and can never be reopened. **It is a diagnostic. No figure from that run may be
published**, including the "no divergence" above, which should be re-taken against a named release
before anyone acts on it.

The switcheroo half of the same file still parts, on two separate things, and both are the file's own
subject rather than mine to fix: the `-activate` line names the clicked move where the authority names
Trick for both members of the family, and the `[silent]` `-enditem` for the side that handed over
nothing is missing on our side.

---

## WHAT WAS COMMITTED

`59ce501c` — three files, staged by name, no `git add -A`:

- `tests/probe_berserk_switcheroo.js` (new, + the four catch fixes)
- `tests/probe_instruct_shield.js` (new, unmodified)
- `docs/MEDICHAM-SPRINT-NOTES.md` (the sprint-clause row)

Both gates fired and both were satisfied honestly: the silent-catch gate on the two staged `.js`
files, and the sprint-notes clause which refuses any commit touching `tests/` without a row in
`docs/MEDICHAM-SPRINT-NOTES.md`.

**Nothing else was staged.** `engine/medicham2-browser.js`, `engine/quarantine.js` and
`tests/test-mechanics.js` were dirty with other agents' in-flight work and were left alone, as were
`data/engine-release.json` and `data/mechanics-census.json`, which moved during the session because
another agent cut a release.

**DEBRIS REPORTED, NOT REMOVED.** The repository root holds ~20 untracked `.scratch_*` files and
directories, plus `data/_scratch-scovillain-dump.json` and the untracked
`tests/probe_volley_collapse.js` (another agent's live work). None were created by me and none were
touched. `.scratch_eng_diffrun.cmd` in particular pins a different simulator and was not executed.

---

## OWED, NOT RUN

- **The berserk "no divergence" result is not a measurement** and must be re-taken against a named
  release before it is used to close anything. It was produced against a temp-store freeze of a tree
  another agent was editing.
- **The 32 other unaccounted probes were not run** — see
  `docs/_reports/2026-08-28-coverage-unaccounted.md`. Their exit codes are unknown and must not be
  inferred from this file.
- **`tests/probe_berserk_switcheroo.js` has no `--release` flag.** Every other probe of its generation
  that plays a game has grown one; this one still cuts at require time, which is why it needed the
  `_live_release.js` workaround. Giving it the flag is owed and was deliberately not done here, since
  it changes what the file measures.
- **Neither probe declares `ABRA-EXIT`**, so its exit 2 (fixture could not be staged / SHOWDOWN_PATH
  absent) is not distinguishable from a verdict by `engine/register_reality.js`. That is the same
  cross-cutting gap the coverage report ranks third, and it applies to these two as much as to the
  other 32.
- **Neither probe carries a `VERIFIED BY` marker**, so nothing runs either of them. That is the
  correct state today — a red probe should not be wired into a runner — and it becomes owed the moment
  the Instruct shield defect is fixed.
