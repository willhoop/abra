# Are the three RED-instrument rows genuinely red today? — MEASURE, 2026-08-25

Scope: `engine/status.js`'s third failing gate clause, `no open, known engine defect`, which reads
*"3 OPEN roadmap row(s) name an instrument that is RED: #218 (94,313 uses), #241, #273."*
Question asked of each row: is the instrument red TODAY, or is the row prose that outlived what it
described?

Session was under a NO-PLAY clause (an ENGINE agent held the play layer). Nothing here loaded the
simulator or the store into a game loop.

---

## 0. How the clause decides, and what its evidence actually is

`openDefectClause()` in `engine/quarantine.js:1622` does NOT run anything. It reads
`docs/ROADMAP.md`, keeps rows that are open (`roadmapRowIsClosed`, the one exported detector) AND
assert breakage (`roadmapRowSaysBroken`), then looks each row up in `data/register-reality.json`
and holds the gate shut only on `green === false`.

Driven directly through the shipping export (no restatement):

```
node -e "const c=require('./engine/quarantine.js').openDefectClause(); ..."
  ok            false
  withRed       #218, #241, #273
  debt          60 rows (assert breakage, name no instrument — do not hold the clause shut)
  staleRows     (none)
  unrunnable    #318, #319
  excused       8 rows carrying NOT A DEFECT in their status cell
  verdicts_read 39     generated 2026-08-23T11:48:06.048Z
  open count    65
```

**THE CLAUSE'S ONLY EVIDENCE IS AN ARTIFACT THAT IS 2 DAYS AND 5 HOURS OLD.**
`data/register-reality.json` is stamped `2026-08-23T11:48:06Z`, mtime `2026-08-23 07:48:06 -0400`.
Since it was written, `engine/medicham2-browser.js` has been committed **six** times
(`65782219` 2026-08-24 22:55 through `da34ee4a` 2026-08-25 16:21) and
`data/game-differential.json` has been regenerated at least twice
(`2026-08-25T08:02:36Z` release `c592445fe011`, and `2026-08-25T20:08:48Z` release `9cfe6b3b97a8`).
Two of the three verdicts the clause is quoting were taken against bytes that no longer exist.

**Hazard checks performed before anything was read or run:**

- **NOT A DEFECT override** (`quarantine.js:1040`, `/NOT A DEFECT/i` against the status cell): none
  of #218, #241, #273 is in the `excused` list. The eight excused rows are #252, #336, #344, #381,
  #386, #387, #395, #396. #273's BODY contains the sentence *"THE RESIDUE IS DECLARED AND IT IS NOT
  A DEFECT, SO IT MAY NOT HOLD A GATE"*, but the clause reads the STATUS CELL, and #273's cell reads
  `open — instrument DEFECT (12 stale reversals)`. The override did not fire on any of the three.
- **One closed-detector**: the exported `roadmapRowIsClosed` was used, via `openDefectClause()`
  itself. No second copy was written.
- **Torn read**: `Get-CimInstance Win32_Process` showed **no** ABRA node process running at 17:17
  (only two MCP `server-pdf` processes). `data/game-differential.json` mtime was
  `16:23:40.738` before the run, after the run, and at 17:23 — unchanged across the whole session.
  `git show HEAD:data/game-differential.json` is byte-identical in every field checked to the
  working-tree copy (same `generated`, `release`, `games`, `diverged`, same class/cause lists), so
  the read is stable and matches committed bytes.
- **`register_reality.js` was NOT run**, in either form. It writes, including under `--list`.
- Nothing in `engine/`, `tests/` or `data/` was edited. `git status` at the end shows the same two
  untracked files it showed at the start plus `data/open-work.json` and `data/provenance-stamp.json`
  modified by another agent, not by me.

---

## 1. #218 — the whole-game differential — **STILL RED**

**Row's instrument (`VERIFIED BY`):** `node engine/quarantine.js --whole-game`.
**What I did:** RAN it (it reads an artifact, runs no games and loads no simulator — the CLI branch
at `quarantine.js:2427` says so and calls `wholeGameClause` rather than restating it), via
`tools\lownode.cmd`.

```
FAIL  whole-game differential / the same game on both engines
  19 of 961 = 2.0% DIVERGE — the two engines disagree about 19 games
  (24 raw, less 5 declared and 0 cleared on decision impact).
  exit 1   [0 the two engines agree on every game, 1 they do not, 2 cannot answer]
```

Artifact behind it: `data/game-differential.json`, generated `2026-08-25T20:08:48Z`, release
`9cfe6b3b97a8`, which **equals** `data/engine-release.json`'s `current` — so this is exit 1, a real
verdict, not the #298 exit-2 "measured against other bytes" branch.

**Verdict: STILL RED.** The row's TITLE is stale prose — 39.6% was 480 of 1,213 on release
`5a557b07821c` on 2026-08-12 and describes another release, another pin, another census and another
pool. But the row is not closed by its title; it is closed by its instrument reaching zero, and the
instrument reads **19 undeclared of 961** and exits 1. **NO DELTA IS CLAIMED** between 39.6% and
2.0%: `baseline_comparable` is false and the clause withholds direction of travel itself (the
baseline was stamped under `A/top-tie-first/pins:ef342837b791`, this run is
`A/middle/pins:6a6b87eafc6a`).

The live divergences, by mechanic, read out of this artifact's own `classes[].causes[]` (these are
CAUSE rows with their game counts, not the clause's by-shape game tally, which reads
`rule 10, emission 9, ordering 5`):

| class | cause (authority `<>` medicham2) | n |
|---|---|---|
| ordering | `\|-sideend\|p2:\|tailwind <> \|-sideend\|p1:\|tailwind` — Tailwind ends on the wrong side | 2 |
| ordering | `\|upkeep <> \|faint\|p1b` | 1 |
| ordering | `\|switch\|p1b\|whimsicott <> \|switch\|p1a\|alakazam` | 1 |
| ordering | `\|-miss\|p1b\|p2b <> \|-activate\|p2a\|protect` | 1 |
| ordering | `\|switch\|p1a\|staraptor <> \|switch\|p2a\|incineroar` | 1 |
| unrelated event mismatch | `\|-immune\|p1a <> \|-damage\|p1a\|H/H psn` | 1 |
| unrelated event mismatch | `\|move\|p2a\|psychicfangs <> \|cant\|p2a\|flinch` | 1 |
| unrelated event mismatch | `\|-activate\|p2a\|telepathy <> \|-immune\|p2a\|[from]telepathy` | 1 |
| unrelated event mismatch | `\|-singleturn\|p2a\|protect <> \|-fail\|p2a` | 1 |
| unrelated event mismatch | `\|-supereffective\|p1a\|1 <> \|move\|p1a\|gravity` | 1 |
| unrelated event mismatch | `\|-fail\|p2b <> \|-start\|p1a\|disable\|protect` | 1 |
| unrelated event mismatch | `\|-immune\|p1a <> \|-miss\|p2b\|p1a` | 1 |
| event missing from medicham2 | `\|-end\|p1a\|throatchop <> \|upkeep` | 1 |
| event missing from medicham2 | `\|switch\|p2a\|crabominable <> \|cant\|p1b\|recharge` | 1 |
| event missing from medicham2 | `\|-immune\|p1b <> \|cant\|p2a\|flinch` | 1 |
| event missing from medicham2 | `\|switch\|p1a\|krookodile <> \|detailschange\|p1b\|charizardmegay` | 1 |
| event missing from medicham2 | `\|-end\|pXb\|fallenundefined <> \|switch\|…` (x5) | 5 — **DECLARED** |
| -damage: a different body | `\|-damage\|p2a\|H/H <> \|-damage\|p2b\|H/H` | 1 |
| extra event emitted by medicham2 | `\|faint\|p2b <> \|-status\|p2a\|brn` | 1 |

The five `fallenundefined` rows are the clause's one DECLARED cause (Supreme Overlord — the
authority emits a literal `fallenundefined` on a `[silent]` line; reproducing a typo is not
correctness). They are subtracted, which is why 24 raw becomes 19.

**Board-material figure, labelled as an artifact FIELD and not as this clause's verdict** (Will's
2026-08-22 bar): middle arm `DIFFERENT-END-STATE 12 of 961` — 7 of them among the 24 whose protocol
parted, 5 in games whose protocol never parted at all; by shape RULE 3, EMISSION 3, ORDERING 1
(that by-shape block covers the parted games). The row's last entry quoted 18 of 961 on release
`3929459bb195`; that is a different release and a different pin digest, so it is a reading, not a
before/after.

**What the closing line would have to say (it cannot be written today):** it cannot be closed. To
close, `node engine/quarantine.js --whole-game` must exit 0 on the current release.

---

## 2. #241 part (3) — a `-fail` the authority emits and this engine is silent about — **CLOSEABLE, with one scope caveat**

**Row's instrument (`VERIFIED BY`):** `node engine/gate_fail_and_silent.js`.
**What I did:** RAN it (it requires only `fs`, `path` and `./divergence_shape.js` — it reads
`data/game-differential.json` and plays nothing), via `tools\lownode.cmd`.

```
ROADMAP #241(3) — a `-fail` the authority emits and this engine does not
  artifact  data/game-differential.json   generated 2026-08-25T20:08:48.156Z   release 9cfe6b3b97a8
  pin       30
  sample    pinned:   census 2e3953f1f882 / pool 631d4ea60a80 / 995 games
            this run: census 9446a684709d / pool 0d103fb9fa87 / 961 games  -> A DIFFERENT SAMPLE
  CLEAN   CLEAN — the authority emits no bare `-fail` that this engine is silent about.
  exit 0   [0 clean, 1 live at or under the pin, 2 cannot answer, 3 REGRESSION]
ABRA-EXIT 0 VERDICT-GREEN
```

**This is a real clean, not a clean-by-absence.** The class the gate counts inside
(`event missing from medicham2`) is PRESENT in this artifact with **9 causes**; none of them has
`-fail` on the authority half. The gate returns `causes === 0` because the predicate found no
member, not because the class row was missing (`count()` returns `null`, exit 2, in that case, and
it did not).

**The register's `green:false` for this row is stale evidence.** `data/register-reality.json` was
generated 2026-08-23T11:48Z. The last hand-reading in the row is 2026-08-24 on release
`3929459bb195`: 2 causes / 2 games (a bare `-fail` against a Role Play click and one against a
Curse click). Today's two differential runs both read **zero**:

| run | generated | release | census / pool / games | `-fail` in the counted class |
|---|---|---|---|---|
| prev commit `665d497d` | 2026-08-25T08:02:36Z | `c592445fe011` | 9446a684709d / 0d103fb9fa87 / 961 | 0 |
| current `HEAD` | 2026-08-25T20:08:48Z | `9cfe6b3b97a8` | 9446a684709d / 0d103fb9fa87 / 961 | 0 |

Census, pool and game count are identical to the 2026-08-24 run that read 2. **I still do not claim
2 → 0 as a trend**: the pin digest moved between runs (`pins:1fd77b835ee2` → `pins:6a6b87eafc6a`),
and the gate's own sample stamp is what decides comparability, not mine. What is claimed is only
what the gate says: **the instrument is GREEN on the current tree.** Masking is the one alternative
explanation worth naming (the differential records the FIRST divergence per game, so an earlier
divergence could hide a later `-fail`) — and it runs the wrong way here: total divergences FELL
(57 on 08-24 → 28 at 08:02 → 24 now), so there is less masking, not more.

**Verdict: CLOSEABLE.** It stops holding this clause shut the moment `register-reality.json` is
regenerated: `green` flips to `true` and `openDefectClause` reclassifies it from `withRed` to
`staleRows`, which does not fail the clause.

Suggested closing line for the row, to be written by whoever runs the re-verification:

> **PART (3) CLOSED 2026-08-25 (MEASURE) ON THE INSTRUMENT'S OWN EXIT CODE.**
> `node engine/gate_fail_and_silent.js` exits **0 — CLEAN, `ABRA-EXIT 0 VERDICT-GREEN`** against
> `data/game-differential.json` generated 2026-08-25T20:08:48Z on release `9cfe6b3b97a8`, 961 games,
> census `9446a684709d`, pool `0d103fb9fa87`. Zero causes of the shape. The counted class
> (`event missing from medicham2`) is present with 9 causes, so this is a clean and not an empty
> class. **NO DELTA IS CLAIMED against the 2 / 2 of 2026-08-24 or the 30 / 51 pin** — different
> release, different pin digest; the gate withholds a REGRESSION verdict on sample grounds and this
> close does not borrow the comparison it refuses. VERIFIED BY: `node engine/gate_fail_and_silent.js`

**THE SCOPE CAVEAT, WHICH MUST GO IN THE ROW AND NOT BE SWALLOWED BY THE CLOSE.** The gate matches
one SHAPE inside ONE class: `isFailAndSilent` requires the cause to sit in
`cls === 'event missing from medicham2'` and to have `-fail` as the authority half. This artifact
contains **two `-fail` causes that walk past that filter**, both in `unrelated event mismatch`:

- `|-fail|p2b <> |-start|p1a|disable|protect` — the authority announces a failure and this engine
  announces a Disable instead. Under the row's *title* ("and this engine says nothing") that is out
  of scope; under the row's own **INSTRUMENT OWED** sentence (*"a gate that FAILS on a `-fail` the
  authority emits and this engine does not"*) it is arguably in scope.
- `|-singleturn|p2a|protect <> |-fail|p2a` — the MIRROR shape (our `-fail`, their Protect). The
  gate's selftest deliberately excludes this one by name, so it is correctly out of scope here — but
  it is a live divergence and it is inside #218's 19.

Neither makes #241 red. Both mean "#241(3) closed" must not be read as "no `-fail` disagreement
remains". They are counted by #218, which is red anyway.

---

## 3. #273 — `tests/probe_red_demo.js` stale reversals — **STILL RED (inferred; the instrument was not run this session)**

**Row's instrument (`VERIFIED BY`):** `node tests/probe_red_demo.js`.
**What I did:** did NOT run it, and read the source and the git history instead. The file
`require`s `engine/medicham2-browser.js` and its demonstrations drive the engine through turns —
the row itself records a reverted arm that *"cannot play a turn (`_mvMissed is not defined`)"* — so
it is inside this session's no-play clause. The verdict command is in OWED below.

**What can be established without running it, and it is close to decisive:**

1. A "stale reversal" is a purely textual condition. `revertedEngine()` (`probe_red_demo.js:96`)
   does `src = fs.readFileSync(MEDI_PATH)…; if (!src.includes(find)) throw`. `MEDI_PATH` is
   `engine/medicham2-browser.js`. The `find` strings live in `tests/probe_red_demo.js`.
2. **A stale anchor is repaired only by editing `tests/probe_red_demo.js`.** That file has not been
   touched since `2784ffab`, **2026-08-23 22:44** — before the last measured reading.
3. The last measured reading is the row's own, **2026-08-24**, release `3929459bb195`, engine quiet:
   **200 demonstrations, 13 failed — 12 stale reversals plus one HOLLOW row** (the WIRE 4 damage
   pair was re-scoped and withdrawn as harness, not engine).
4. Since that reading, `engine/medicham2-browser.js` has been committed **six** times
   (`65782219`, `382e9989`, `65a9c5c4`, `3ab94955`, `665d497d`, `da34ee4a`). Engine movement can
   only ADD staleness to a literal-source-string anchor; it cannot subtract it, short of a commit
   restoring the exact pre-wire text, which none of the six claims.

So the 12 named stale reversals (WIRE 118, 123, 129, 130 x2, ROADMAP #31, ROADMAP #81, WIRE 2,
WIRE 7, WIRE 9, WIRE 12, ROADMAP #259) cannot have self-repaired, and the count is very likely ≥ 12.
**The exact count is OWED.**

**The register's entry for this row is separately worthless and the row already says so.**
`data/register-reality.json` records this instrument at `exit 1 after ms: 4980`. A complete run takes
~25 s and prints 200 demonstrations, and the row documents this: that entry is an instrument that
STOPPED EARLY, classified `VERDICT-RED` only because `probe_red_demo.js` declares no `ABRA-EXIT`
line. The clause is therefore currently holding the MEDICHAM gate shut on **a refusal spelled as a
red**, even though the row happens to be genuinely red for a different, hand-measured reason.

**Verdict: STILL RED** — the mechanic is not a game mechanic at all: it is the demonstration
harness, whose known-bad reversals are anchored on literal source strings that go stale every time a
wire rewrites the lines they patch. **Not closeable.** Two things whoever picks it up should know:

- **This is an INSTRUMENT defect, not an engine defect**, and its own status cell says so
  (`open — instrument DEFECT (12 stale reversals)`). It is nonetheless counted by a clause named
  *"no open, known engine defect"* and is one of the three things holding MEDICHAM's quarantine
  shut. That is a scope question about the clause, not a licence to close the row; it is flagged
  here and NOT acted on. If it is wanted, it needs its own row.
- The fix the row itself prescribes is not "re-aim the 12 anchors" — an anchor that is a literal
  source string goes stale on the next wire. It wants a reversal expressed against something that
  moves with the code.

---

## 4. Net effect on the clause

If `data/register-reality.json` is regenerated on the current tree, the clause's verdict line should
become **2 OPEN roadmap row(s) name an instrument that is RED: #218, #273** — #241 moves to
`staleRows` (instrument GREEN) and stops holding it shut. The clause still FAILS, and MEDICHAM's
quarantine still does not lift on this clause. Nothing here lifts a quarantine.

The gate's `(94,313 uses)` beside #218 is the Protect click count parsed out of the row's prose by
`openDefectClause`'s `/([\d,]{3,})\s*(uses|clicks)/`. It is a corpus-usage figure from the 2026-08-12
cause analysis and it is NOT a count of anything in today's artifact.

---

## 5. FOLLOW-UP PASS, same day — the close landed, and the tree moved under it

Second pass, still under the no-play clause, still with ENGINE holding the play layer. Four things
were asked for: land the close on #241, put the scope caveat in the row AND in the gate header,
correct #273’s register entry or owe it, and do the CHANGELOG. All four are done. **Nothing that
writes an artifact was run** — `engine/register_reality.js` was not invoked in any form, and
`node engine/status.js --write` was not run.

### 5.1 What was edited

| file | change |
|---|---|
| `docs/ROADMAP.md` #241 | part (3) CLOSED on its instrument; status cell now begins `closed 2026-08-25`; the scope caveat is IN the close, not under it |
| `docs/ROADMAP.md` #273 | dated note: instrument not run, why the 12 cannot have self-repaired, and that the register entry backing it is still the wrong one. **Row left OPEN and still asserting breakage** (both asserted through the shipped detectors) |
| `engine/gate_fail_and_silent.js` | new header section `WHAT THIS GATE DOES NOT MATCH: ONE SHAPE IN ONE CLASS`. Comment only — no code path touched |
| `CHANGELOG.md` | `[5.131.1] — 2026-08-25` |

Every edit was applied by a script that asserted its anchor matched **exactly once** and then
re-checked the result through the SHIPPED detectors (`roadmapRowIsClosed`, `roadmapRowSaysBroken`,
`roadmapRowStatusCell`) rather than through a second copy of the rules. No `|` was introduced into
either status cell — `roadmapRowStatusCell` reads `/\|\s*([^|]*)\|\s*$/`, so a pipe in the cell
would silently truncate it.

### 5.2 The clause, recomputed through the canonical export

```
before:  ok false   withRed #218, #241, #273   open 65   debt 60   excused 8
after:   ok false   withRed #218, #273         open 64   debt 60   excused 8
```

`#241` leaves the clause because its ROW is now closed, **not** because anything was written to
`data/register-reality.json`. That artifact is untouched and still says `green:false` for #241; the
closed-row filter runs before the verdict lookup, so the clause is correct either way and the
coordinator’s later `register_reality.js` run will simply agree with it. The clause still FAILS.
**No quarantine lifts here.**

### 5.3 THE TREE MOVED 24 MINUTES AFTER THE MEASUREMENT, AND THE ROW SAYS SO

Between the exit-0 reading (~17:22 local, tree release `9cfe6b3b97a8`) and the verification re-run
(~17:50), ENGINE cut release **`2ecd3bdc274b`** (`data/engine-release.json` mtime 17:49:25, first cut
21:46:00Z). `data/game-differential.json` has NOT been re-run — still 16:23:40, still stamped
`9cfe6b3b97a8`. So the same command now returns:

```
CANNOT ANSWER   MEASURED AGAINST A DIFFERENT ENGINE — the artifact ran on release 9cfe6b3b97a8
                and the tree is 2ecd3bdc274b. The count is WITHHELD rather than printed with a caveat.
  exit 2        ABRA-EXIT 2 CANNOT-ANSWER
```

**The close stands and it is stamped.** It is true of `9cfe6b3b97a8` and of no other bytes — the same
standard #218’s figures are held to. The row now carries that in full, because the alternative is
the next agent running the `VERIFIED BY`, reading exit 2, and filing a PREMATURE CLOSE. That is
precisely what happened to #273, from a refusal spelled as a red.

### 5.4 The caveat, in the gate’s own header

`engine/gate_fail_and_silent.js` now states, above `WHAT IT REFUSES TO ANSWER`: the two conditions
`isFailAndSilent` requires; that an authority `-fail` filed under a different class is invisible to
it; the live 2026-08-25 instance (`unrelated event mismatch` — the authority announces a bare `-fail`
on p2b, this engine announces a Disable start on p1a); that widening it would make it a weaker second
implementation of the whole-game differential; that the rows walking past are **counted by #218**; and
the sentence that matters — **a green here means that class is empty, it does not mean no `-fail`
disagreement remains.**

`node engine/gate_fail_and_silent.js --selftest` → **23 passed, 0 failed** after the edit.

### 5.5 #273’s register entry was NOT hand-edited, and why

`data/register-reality.json` is a GENERATED artifact and the clause is computed from it. Hand-flipping
a `green` there is the erase-the-evidence hazard the brief opened with, one row at a time, and I could
not produce an honest replacement value without running the probe — which this session may not do. So
the correction landed in the REGISTER, where prose belongs: #273 now records that the entry says `exit
1 after 4,980 ms` against a ~25 s / 200-demonstration run, that this is an instrument which STOPPED
EARLY published as `VERDICT-RED`, and that as of 2026-08-25 it is still the entry `openDefectClause`
reads.

**The structural cause is named rather than the symptom patched.** `tests/probe_red_demo.js` declares
no `ABRA-EXIT` line, so `classifyExit` in `register_reality.js` cannot tell its refusal from its red —
exactly the problem `declareExit` already solves in `gate_fail_and_silent.js`. Giving
`probe_red_demo.js` the same treatment would stop a crashed run being published as a defect. **Not done
here**: it is a test that drives the play layer, ENGINE holds that layer, and it is owed below.

### 5.6 Gates run after the edits

| gate | result |
|---|---|
| `tests/test-docs-current.js` | 23 passed, 0 failed (also run BEFORE the CHANGELOG bump, green both sides) |
| `tests/test-roadmap-register.js` | 3 passed, 0 failed |
| `engine/gate_fail_and_silent.js --selftest` | 23 passed, 0 failed |

No document carries a `5.131.0` version header (grep: CHANGELOG only), so the patch bump to `5.131.1`
moved no pinned document. Checked by running the docs-currency gate on both sides of the bump rather
than by reasoning about it.

---
## OWED, NOT RUN

```bash
# 1. The differential artifact is stamped 9cfe6b3b97a8 and the tree is now 2ecd3bdc274b, so BOTH
#    artifact-only gates below currently answer "exit 2 CANNOT ANSWER". Re-run the differential on
#    the current release first; it plays games, so it belongs to whoever holds the play layer.
#    ALREADY IN FLIGHT AS OF 17:51 LOCAL: pid 5760 is running exactly this on 2ecd3bdc274b
#      node engine/game_differential.js --games 1200 --arm middle --release 2ecd3bdc274b ...
#    so this is a WAIT, not a launch. Do not read data/game-differential.json until it settles -
#    a torn read is a plausible, well-formed, completely fictitious answer.
# node engine/game_differential.js --release <current> --team-store data/team-pool-frozen

# 2. Then the two artifact-only gates. #241 is closed and this RE-CONFIRMS the close on new bytes;
#    #218 is red and stays red until it reaches zero.
cmd.exe /c "tools\lownode.cmd engine\gate_fail_and_silent.js"
cmd.exe /c "tools\lownode.cmd engine\quarantine.js --whole-game"

# 3. #273's verdict, still owed. ~25-60 s, loads the simulator and plays turns. Engine must be quiet:
#    assert engine/medicham2-browser.js is byte-unchanged across the run. Report the exact stale count
#    and the failing row names.
node tests/probe_red_demo.js
PROBE_VERBOSE=1 node tests/probe_red_demo.js     # the full missing pattern for each stale row

# 4. Regenerate the verdict artifact the open-defect clause reads. STILL NOT RUN HERE, by instruction.
#    It WRITES. Run it only with no other agent measuring, and check `git diff` afterwards — a wipe
#    drops the green:false rows and flips the clause to OK on erased evidence.
node engine/register_reality.js

# 5. The structural fix for #273's bad entry: give tests/probe_red_demo.js an ABRA-EXIT declaration
#    like engine/gate_fail_and_silent.js's declareExit, so a refusal cannot be published as a red.
#    Owner: whoever holds the play layer. No command — it is an edit.

# 6. Restamp the generated blocks. NOT run here, by instruction.
node engine/status.js --write
```
