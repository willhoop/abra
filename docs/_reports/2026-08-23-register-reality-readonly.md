# ROADMAP #369 — `register_reality.js --list` wrote the verdict artifact. Fixed by a split, shown red first.

MEASURE, 2026-08-23. Historical record, not maintained. Ran nothing that plays a game; no fit, no
rollout, no roster, no differential. Two files changed: `engine/register_reality.js` and the new
`tests/test-register-reality-readonly.js`. Nothing committed.

---

## 1. THE DEFECT, MEASURED ON THE PRE-FIX BYTES

`--list` advertised *"coverage only; runs nothing"*. True of the INSTRUMENTS, false of the ARTIFACT:
both modes ran one body that differed by a ternary and fell through together into
`fs.writeFileSync(data/register-reality.json)` at the bottom of the file.

| | `data/register-reality.json` |
|---|---|
| before `--list` | sha256 `96741db9a380d5c7…`, 15,508 bytes, mtime `2026-08-22 21:54:26.140483 -0400`, `generated: 2026-08-22T01:55:12.569Z` |
| after ONE `--list` | sha256 `5d8007aa180dab73…`, 22,747 bytes, mtime `2026-08-22 22:40:24.396 -0400`, `generated: 2026-08-23T02:40:24.395Z` |
| `git diff --numstat` | **306 insertions, 144 deletions** |
| restored | `git`-tracked; bytes and mtime put back exactly, `git diff --quiet` clean |

Counts destroyed, measured rather than described:

```
settled:  premature_closes: 2   unrunnable: 1   distinct_commands_run: 22   marked: 31
after:    premature_closes: 0   unrunnable: 0   distinct_commands_run:  0   marked: 35 (all NOT RUN)
```

**A SECOND DEFECT WAS SITTING IN THE SAME FALL-THROUGH AND IS NOT IN THE REGISTER ROW.** Having
written the wipe, the pre-fix `--list` continued to the summary line and printed

```
  wrote data/register-reality.json
REGISTER REALITY: every marked row agrees with its instrument.
```

— a verdict sentence about 22 instruments, not one of which had been started (`distinct_commands_run:
0`, printed three lines above it, on the same screen). This is the worse half. The wipe leaves a trace
in git; the sentence leaves none, and a sentence is what gets quoted.

**THE BLAST RADIUS IS A GATE.** `openDefectClause` (`engine/quarantine.js:1568-1577`) sorts each open
row by the `green` tri-state it finds here: `false` → `withRed`, `true` → `staleRows`, anything else →
`unrunnable`, and `ok` is `withRed.length === 0`. The settled artifact carries `green:false` on **five**
rows — **#218, #224, #241, #258, #273**, of which #218/#241/#258 are CONFIRMED open defects. A wiped
artifact makes every row `green:null`, so all five stop holding the clause shut and it reports OK for
exactly the reason that should make it loudest.

## 2. THE SPLIT

Not a flag check bolted to the write site — `if (!has('--list')) write(...)` is one edit away from
being wandered around and leaves both behaviours sharing a body. Three functions, and the listing path
does not reach the third:

| | |
|---|---|
| `enumerate(lines)` | PURE. Parses the register, computes coverage. Starts no instrument, opens no artifact. All `--list` gets to call. `readRegister()` is the one-line file read on top of it. |
| `measure(en)` | The ONLY place an instrument is started, and the ONLY producer of a MEASUREMENT — an object carrying a module-private `Symbol`. |
| `publish(m, art)` | THROWS unless handed a real measurement, and THROWS on any row whose verdict is outside the six-verdict `VERDICTS` set. |

Two further properties, because the structure alone is a claim about today's code:

- **`NOT RUN` is gone from the verdict vocabulary.** There is no longer a value the artifact could
  carry meaning "never checked", because there is no longer a path that builds a row without checking
  it. `publish` re-asserts that at the write site.
- **The guard is on the DATA, not the MODE.** `publish` never reads `has('--list')`. A future caller
  cannot publish by re-deriving the flag wrongly; it has to be holding something `measure()` minted.

`--list` now prints `NO INSTRUMENT WAS RUN AND NOTHING WAS WRITTEN`, ends with `THIS IS NOT A VERDICT`,
exits 0, and prints no agreement sentence. `--list --json` returns a coverage object with
`"wrote": null` and writes nothing.

**NOT MADE IDEMPOTENT, DELIBERATELY.** Rewriting with identical content still moves the mtime and the
provenance, and this artifact's job is to say WHEN a verdict was measured. `--json` still writes, and
that is not an inconsistency: `--json` runs every instrument, so its timestamp is honest.

## 3. THE BEFORE/AFTER PROOF

Fixed `--list`, same artifact, same command:

```
BEFORE: 96741db9a380d5c70712  mtime=2026-08-22 21:54:26.140483000 -0400
EXIT=0
AFTER : 96741db9a380d5c70712  mtime=2026-08-22 21:54:26.140483000 -0400
git diff --stat -- data/register-reality.json   (no output)
```

Bytes identical, **mtime identical to the nanosecond**, exit 0, coverage still printed (289 rows, 47
open asserting breakage, 35 marked, 12 owed).

## 4. WHERE THE ASSERTION RUNS, AND ITS RED

**`tests/test-register-reality-readonly.js`** — discovered automatically by `tests/run-all.js`, which
globs `tests/test-*.js`; no runner edit, so it cannot collide with the pass that fixed the runner
tonight. Verified visible: `node tests/run-all.js --list` shows
`RUN   tests/test-register-reality-readonly.js`, and `--coverage` still reports `0 unaccounted for`,
exit 0.

It starts the REAL process with the REAL flag and compares the artifact's bytes AND mtime across it,
then runs `engine/register_reality.js --selftest` as a child — so the in-file selftest is wired into
the suite even while the full 22-instrument measurement stays out of it. It restores the bytes and the
mtime BEFORE asserting, so a red does not leave the damage in place; if the artifact were ABSENT and a
listing CREATED it, it reports and **leaves the file**, per the standing no-deletion rule.

**RED FIRST, on the pre-fix bytes** (`git show HEAD:engine/register_reality.js` put back in place):

```
REGISTER-REALITY READ-ONLY: 3 passed, 7 failed        exit 1
  FAIL byte-identical after --list      before 96741db9a380d5c7  after eb0b8390a0be5f0c
  FAIL and its MTIME did not move
  FAIL --list does not print the agreement verdict
  FAIL --list does not report a write it did not make
  FAIL --list says nothing was run and nothing was written
  FAIL the selftest carries the #369 cases
  FAIL this test left the artifact as it found it
```

Green on the fixed file: **10 passed, 0 failed**, artifact unchanged vs HEAD.

The in-file `--selftest` went 25 → **29 assertions, 0 failed**, the four new ones being: `verdict()`
cannot return `NOT RUN` for any (closed × cmd × tri-state) combination; `buildArtifact` refuses a
non-measurement; `publish` refuses a non-measurement and refuses an unmeasured verdict from a real one;
and **the whole listing path runs, both renderers, with `fs.writeFileSync` booby-trapped to throw, and
never touches it.**

One deliberate tolerance, argued rather than relaxed for convenience: the final "left it as we found
it" line compares bytes exactly and mtime to the **millisecond**, because `fs.statSync` reports
sub-millisecond (`…140.483`) while `fs.utimesSync` accepts only a `Date`. An exact restore is not
expressible; demanding one made that line red on a run that had repaired the damage perfectly (it
failed by 0.483 ms during the red demo). The #369 assertion itself stays EXACT, because nothing has
restored anything there.

## 5. OWED, NOT DONE

- `tests/run-all.js` `PENDING_WIRE['engine/register_reality.js']` still reads *"it WRITES its artifact
  unconditionally"*. **That blocker is now false**; the other one (the pass could not touch
  `docs/ROADMAP.md`, which it reads) still stands, and the full run is 22 instruments, so it stays out
  of the suite. Belongs to whoever owns the runner — MEASURE did not edit that file this pass.
- ROADMAP #369's row, `docs/MEASURE.md`, `CHANGELOG.md` and `node engine/status.js --write`: all owed,
  all out of scope for this pass by instruction (`status.js` was forbidden while a pinned gate chain
  was writing `data/roster.*`, `data/game-differential.json`, `data/all-mechanics-fire.json`).
- The row's own `WHAT WOULD DECIDE THE FIX` proposes that `--json` write nothing either. **Not done, on
  purpose**: `--json` runs every instrument, so it IS the measurement and its timestamp is honest.
  Silencing it would leave the file with no way to publish in machine-readable form.

---

# PART TWO — `tests/staged_status_counters.js`: TWO CAUSES, NOT ONE. ANALYSIS ONLY, NOTHING RE-PINNED.

## The stranded BEFORE arm

The pin is `6155acc0fb26` (cut 2026-08-12T19:54:49Z), chosen as the oldest release exporting both
`rngStreams` and `spreadL50`. It has aged out again on a THIRD export.

```
node engine/engine_release.js compat engine/medicham2-browser.js rngStreams spreadL50 midEventDice
  2026-08-12T19:54:49.023Z  6155acc0fb26  LACKS midEventDice
  124 of 342 releases can serve it.  4 pruned, 0 predate the file, 213 predate an export, 1 broken.
```

Re-run over the caller's fuller demand set (`+ midEventLog natureL50 battleInit battleTurn battleOver
battleResult playerAction buildMon dmgRange effSpeed`, derived by grepping `M.<sym>` out of
`staged_status_counters.js`, `staged_board.js` and `game_differential.js` and intersecting with the
engine's export list) gives the **same 124**, and the pin then reads `LACKS midEventDice,midEventLog`.
The binding constraint is that one pair — ROADMAP #262's event-addressed dice.

**WHAT RE-PINNING WOULD COST.** The oldest release that can serve the caller is **`2d709fd6b7f0`, cut
2026-08-13T21:22:29.871Z** — 25 h 28 min later than the current pin. `engine/tags.js` is byte-identical
to the tree in **all 124** providers, so the file's tags-identity `NOT RUN` guard would not block any of
them. The cost is entirely the window: **14 commits to `engine/medicham2-browser.js`** land inside it
and would move from the AFTER side to the BEFORE side, i.e. this file could no longer demonstrate that
it catches what they fixed —

```
691a816 Real spreads in: the divergence rate FELL …          13e94cb Effects bind a slot now, not a mon
9bce436 Five verified fixes moved the number by nothing      cb1ee85 A rewritten type survived the bench
56f5673 The OHKO moves took every accuracy modifier          44c7094 The end-of-turn walk is effect-major now
dde3f34 The hand-written list of what a switch clears        c3458d4 The shield is decided at its own action
49beaa4 The from-attribution family: 112 → 89                061c46a Kings Shield passes blockStatus false
35bf134 A mid-turn Speed change reorders moves not switches  222d12e The fallen count was wrong at both ends
c3de681 The row named one gate; the sweep found nine         87b2fd3 Evasion already worked
```

That is a real loss and it is the same loss the file's own header already records for the earlier
window — it should be written down at the pin, not discovered later. It is also **the fourth stranding
of this baseline** (`rngStreams`, then `spreadL50`, now `midEventDice`/`midEventLog`), which is the
LESSONS §12 pattern rather than an accident: the reader keeps moving and each guard is silent about the
next. A re-pin should be verified by actually opening the candidate, not by `compat` alone — `compat`
answers only for the symbols you name.

**Until it is re-pinned, every "release THREW / live IDENTICAL ⇒ FIXED" line it prints is a figure to
WITHHOLD, not a green.** The file's own controls already say so on screen.

## The plant anchor is a SECOND cause, independent of the release

`plantedSource()` patches **`LIVE_SRC`** (line 638), not the snapshot, so the release being stranded
cannot be why the anchor matches 0 times. The anchor is a literal:

```
if(st==='slp')t.slpTurns=0;if(st==='frz')t.frzTurns=0;
```

Occurrences in today's `engine/medicham2-browser.js`: **0.** The status-clearing code has been
restructured — the live tree has `out.status='';out.frzTurns=0;out.slpTurns=0;` with several distinct
receivers (`nx.`, `out.`, `_t.`, `_b.`) and the two assignments in the opposite order. So the plant has
never been applied on the current engine, and `plantedSource` correctly refuses ("*an unapplied plant
reads exactly like a comparator that found nothing*").

This is the `tests/probe_red_demo.js` stale-reversal shape, not an engine defect. Re-aiming it needs a
new anchor that matches **exactly once** across those multiple receivers, so it is a small piece of
real work rather than a search-and-replace. **A re-pin does not fix it, and fixing the pin without
fixing the anchor would produce a file whose BEFORE arm loads and whose only positive control still
never runs.**
