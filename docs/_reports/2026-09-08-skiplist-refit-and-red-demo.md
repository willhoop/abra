# The skip list is now in a digest set, and `probe_red_demo.js` is being re-aimed

2026-09-08, MEDICHAM-correctness sprint, MEASURE. Two pieces of instrument debt that undermine the
gate itself. Nothing here is typed from memory; every count is derived by a command recorded beside
it. **No commit** — Will publishes.

**Live-agent hazard, recorded because it moved under this pass.** An ENGINE agent held
`engine/medicham2-browser.js` throughout. It moved **twice while this ran**:
`1337ff095e92` (the artifact's stamp, 2026-08-26) -> `5a86b1d52bd5` (release `cf8567c4db78`, 05:03Z)
-> `9a54ee6881cf` (release `f0f10cd06861`, 05:41Z). That is not an aside — it is the measurement that
decided the shape of the guard in section 1.3.

---

## 1. JOB 1 — `data/protocol-events.json`

### 1.1 The refit was RUN, and the skip list did not move

```
cp data/protocol-events.json <scratch>/protocol-events.BEFORE.json
node engine/derive_protocol_events.js            # read-only first
node engine/derive_protocol_events.js --write
```

Read-only first: `91 distinct events from 17 files / medicham2 emits 44 / declared, with a reason 50 /
partial shapes 10 / BOTH GATES PASS`, exit 0 — identical to the artifact's own published counts.

Then the whole object diffed, `generated`, `source_digests` and `derivedFrom` excluded:

| field | before (2026-08-26) | after (2026-09-08) |
|---|---|---|
| `emitted` / `emittedCount` | 44 | **44, byte-identical** |
| `notEmitted` / `notEmittedCount` | 50 | **50, byte-identical** |
| `partial` / `partialCount` | 10 | **10, byte-identical** |
| `events` (91 rows, incl. each row's `medicham` standing) | — | **byte-identical** |
| `gates` | `invented: [], undeclared: []` | **unchanged** |
| `showdown_pinned_commit` | `20ad99ff...` | unchanged |
| `source_digests['engine/derive_protocol_events.js']` | `477e53d8315b` | unchanged |
| `source_digests['engine/medicham2-browser.js']` | `1337ff095e92` | **`5a86b1d52bd5`** |
| `generated` | `2026-08-26 22:47:00` | `2026-09-08 05:36:17` |

`git diff --stat data/protocol-events.json` -> **1 file changed, 3 insertions, 3 deletions** — the
timestamp, the medicham2 digest, and `derivedFrom.showdown` (a machine path whose slash style differs
because the run resolved it through `showdown_path.js` instead of a hand-set env var).

**SO: NARRATION DOES NOT MOVE.** No count in `data/game-differential.json` changes, because the bytes
that decide what is deleted before alignment are the same bytes. This is a published-figure question
and the answer is that no published figure moved.

**And the reason it did not rot is measurable rather than lucky.** The artifact's only dependence on
the simulator is `medicham2.TRACE_EVENTS`, and that list is **unchanged between 2026-08-26 and now** —
zero events added, zero removed, 44 both times:

```
require('./data/engine-data.js');
const M = require('./engine/medicham2-browser.js');
// added since 08-26: []   removed since 08-26: []
```

The three names that appear in **both** `emitted` and `notEmitted` — `upkeep`, `-fieldstart`,
`-fieldactivate` — are deliberate and their declared reasons say so ("EMITTED — see emitted[]").
`sdStream()` tests `CLAIMED.has(k)` **before** the skip list, so a claimed event is kept whatever the
list says.

### 1.2 What the hazard actually was, stated accurately

The triage (`docs/_reports/2026-09-06-comparability-backfill-triage.md` section 5) said the file is
"in no digest set at all". Two corrections, both derived:

- **Provenance already carried the edge.** `node engine/provenance.js --graph --json` lists
  `protocol-events.json` in `game-differential.json`'s `from` set — its `readFileSync` scan finds it.
  What was missing was a **content digest in the artifact**, which is the axis `arms_comparable.js`
  reads, not the mtime axis provenance reads.
- **The rot direction the triage feared is already closed by `sdStream`'s ordering**, per 1.1. The
  direction that is genuinely open is the reverse: an event medicham2 **stops** claiming, a change to
  the typed `NOT_EMITTED` table inside `derive_protocol_events.js`, or a Showdown checkout that moves
  the event universe. Those are what 1.3 refuses on.

The real, unarguable gap is the one the triage names first: **editing the file changed what the
differential sampled while `driver_code_stable` still read `true`.** A pin that does not pin.

### 1.3 The wiring, and why the guard asks about the FUNCTION and not the stamp

Landed exactly where the triage derived — `steering.resolve()` beside `driver_inputs`, compared
**unconditionally** in `comparable()` (not inside `TABLE_DRIVEN`, which would skip the 34 coverage
arms), absence reading **`unknown`** rather than being added to `vouches()`.

| file | change |
|---|---|
| `engine/game_differential.js` | `--protocol-events <path>` pin; `PROTO_INPUT` (digest, rows, `generated`, `derived_from_medicham2`, `medicham2_played`); three refusal clauses; `alignmentInputs: [PROTO_INPUT]` into `resolve()` |
| `engine/steering.js` | `alignment_inputs` in `resolve()` (REFUSES on absence); unconditional `ALIGNMENT RULE` clause in `comparable()`, absence -> `unknown` |
| `engine/arms_comparable.js` | the limits line is **computed from the two blocks in front of it** instead of reading "Not stamped." forever |
| `tests/test-empirical-driver.js` | fixture carries `alignment_inputs`; three new checks (differs -> NO, both-absent -> UNKNOWN, absent-at-resolve -> refusal) |

**THE ONE PLACE THIS DEPARTS FROM THE TRIAGE, AND IT WAS DECIDED BY A MEASUREMENT.** The triage's diff
throws when `PROTO.source_digests['engine/medicham2-browser.js']` differs from the release's digest for
the same file. That is a guard on a **stamp**. During this pass the engine moved twice with
`TRACE_EVENTS` byte-identical — so that guard would have refused two runs whose alignment rule had not
moved at all, on the same day it was written. An over-firing gate is the one people learn to ignore
(#148), and this repository's own restamp rule is that a restamp is valid exactly when the feature
FUNCTION is unchanged. Here the function is checkable, so it is checked:

1. **the CLAIM moved** — `PROTO.emitted` vs the played release's `M.TRACE_EVENTS`, and the error names
   the events added and removed. This is precisely the direction the triage was worried about.
2. **the DERIVATION RULE moved** — `source_digests['engine/derive_protocol_events.js']`, because every
   declared reason is typed inside that script.
3. **the AUTHORITY moved** — `showdown_pinned_commit`, because the skip list is a complement of the
   event universe that checkout defines.

The stamp is still **recorded** in `alignment_inputs` (`derived_from_medicham2` and `medicham2_played`
side by side), so a divergence between them can never be silent — it just does not stop a run whose
ruler has not changed.

### 1.4 RED FIRST, with a silent control

`node engine/game_differential.js --games 1 --turns 1 --team-store data/team-pool-frozen
--protocol-events <file>`:

| file handed to the run | exit | what fired |
|---|---|---|
| **CONTROL** — byte-identical copy at a different path | **0** | nothing (so it is not refusing on the path) |
| one event removed from `emitted` | **1** | *"...recorded 43 emitted events (from ...5a86b1d52bd5) and this run plays 44 (9a54ee6881cf). NOW CLAIMED, and the list may still be deleting them from the Showdown side: -boost"* |
| `derive_protocol_events.js` digest zeroed | **1** | *"...produced by engine/derive_protocol_events.js 000000000000 and that file is now 477e53d8315b."* |
| `showdown_pinned_commit` replaced | **1** | *"...derived from Showdown deadbeef... and this run plays against 20ad99ff..."* |

**The knob reached the rule**: the control and each break differ in one field of one JSON file and the
verdict moves 0 -> 1.

`node engine/arms_comparable.js`, on a real artifact written by the run above:

| pair | exit | verdict |
|---|---|---|
| identical `alignment_inputs` | 0 | COMPARABLE, limits line reads *"is CHECKED for this pair (steering.alignment_inputs, both arms)"* |
| digest changed on one arm | 1 | **NOT COMPARABLE — shown to differ**, `the ALIGNMENT RULE differs: ...@7c9de3868d6f vs ...@000000000000` |
| one arm has no `alignment_inputs` | 1 | **UNKNOWN**, limits line flips to *"REPORTED ABOVE as UNKNOWN for this pair"* |

`node tests/test-empirical-driver.js` — **GREEN, 26 of 26** (was 24; the intermediate state where the
section-5 fixture carried no `alignment_inputs` was the new clause firing correctly).

A tiny end-to-end run wrote the field into a real artifact:

```
"alignment_inputs": [{ "file": "data/protocol-events.json", "read_from": "data/protocol-events.json",
  "digest": "7c9de3868d6f", "generated": "2026-09-08 05:36:17", "rows": 50,
  "derived_from_medicham2": "5a86b1d52bd5", "medicham2_played": "9a54ee6881cf" }]
```

### 1.5 What this costs, said out loud

Every artifact on disk now reads **UNKNOWN** on the alignment axis when paired with a new one, because
none of them carries the field. That is the honest verdict and it is deliberately not a refusal: the
field was not asked for when they were taken, and "nothing recorded it" is no more evidence that two
runs differed than that they matched. It is the same call `driver_code` got on 2026-09-05.

`steering.resolve()` now throws without `alignmentInputs`. The only production caller is
`engine/game_differential.js` and it passes them; the two direct call sites in
`tests/test-empirical-driver.js` were updated in the same pass.

---

## 2. JOB 2 — `tests/probe_red_demo.js`

### 2.1 What it read at HEAD, and what the two numbers actually were

`node tests/probe_red_demo.js` -> `ABRA-EXIT 1 VERDICT-RED`:

```
200 demonstrations: 2 HOLLOW, 15 COULD NOT BE APPLIED, 2 not in this format
```

**ONE OF THE TWO "HOLLOW" ROWS WAS NOT HOLLOW — IT WAS A STALE ROW COUNTED TWICE, AND THAT IS ITS OWN
DEFECT.** Only ONE `FAIL` line was printed (`WIRE 120 Parting Shot does not jump the queue`). The
second `failures` came from `ROADMAP #81 WIRE 10 the single-target CONTROL`, which does
`ran++; failures++; stale.push(...)` — so it sat in the HOLLOW count AND in the COULD-NOT-BE-APPLIED
list at once. `demoSource`, the canonical path, pushes to `stale` and does **not** touch `failures`.

That distinction is not cosmetic. The file's own exit-code header records why it exists: a stale
reversal counted as a failure exits 1, `engine/register_reality.js` reads exit 1 as VERDICT-RED, and
ROADMAP #273 was published as a live broken simulator when eighteen certificates had merely expired.
Four sites outside `demoSource` still did it — the strip-cannot-apply path and the three bare
`revertedEngine` controls (WIRE 10, WIRE 11, ROADMAP #103). All four now match `demoSource`.

### 2.2 The 15 re-aims, one at a time

Every one is an ANCHOR move. In no case was a claim changed, an assertion relaxed, or a control
dropped. The recurring cause is the one this file already names: **an anchor that is a literal source
string goes stale on the next wire**, and every re-aim below therefore also NARROWS the anchor to the
smallest span that still expresses the defect, so the next inserted statement cannot strand it.

| certificate | why the anchor died | what it is aimed at now |
|---|---|---|
| WIRE 117 Psychic Terrain / priority | ROADMAP #126 rewrote `if(blocked) out=Math.min(out,0)` into `if(blocked&&0<out){...}` so an ability bar at 0 keeps the narration | the defender LOOP only; the assignment is left to whoever owns the ordering |
| WIRE 121 Volt Switch / absorbed hit | the battle-end guard broke the condition across lines, taking the `){` off the end | the tag lookup; the reversal deletes `dealt>0&&`, which is the whole wire |
| WIRE 129 Wide Lens / Bright Powder | every `ACCMOD` row grew `,mod:[num,den]` for the 4096ths arithmetic | the KEY only — renaming it removes the row from every lookup |
| WIRE 2 Protect holds the last action | the branch body grew the `STALL_EAGER_CLEAR` knob and split in two | the CONDITION `if(!_will){it.mon.protect=false;` |
| WIRE 7 mega stone / Knock Off | `tg.item` became `itemOn(tg)` behind an accessor | the single conjunct `!itemRefusesTake(tg)&&`; the sibling refusal is still carried across |
| WIRE 7 Sitrus between attackers | ROADMAP #322's mega/charge phase landed BETWEEN the Update pass and the opportunist snapshot | the call alone at its own indentation — **plus a FOURTH edit, see 2.3** |
| WIRE 7 Follow Me / Lightning Rod | `_aimRedirected=true;` was inserted between the retarget and the announcement | the ANNOUNCEMENT alone |
| WIRE 8 Electro Shot keeps its +1 | `_ttmTgtSlot` (2026-09-05) and the `_ttmWrap` wrapper landed between `_charging`, `_invuln` and `_lastMove` | the branch's LAST two statements (`_lastMove` then `continue;`) — the position that means "only when the turn is spent" |
| WIRE 8 skipped charge writes -prepare | as above (shares `W8_CHARGE`) | as above |
| WIRE 9 spread click with no target | ROADMAP #338 widened the CONDITION to `SPREAD.has(id)||terrainWidensToSpread(...)`; the reversal quoted all nine lines | `false&&` in front of the condition — and the anchor deliberately carries `(SPREAD.has(id)` because the shorter form matches TWICE and `split(find).join(replace)` would have reverted WIRE 144 too |
| ROADMAP #84 recharge is null not false | the four statements became one `spendRecharge(m)` (FACTS ARE GLOBAL) | the single assignment inside that function — a third caller now inherits the reversal free |
| WIRE 10 x4 (three demos + the CONTROL) | ROADMAP #476 lifted the loop into a `_walk(steps)` helper: `_STEPS` became the parameter `steps`, indentation +2 | the same loop body, the same inversion |

**THE WIRE 10 GROUP HAD BEEN DECLINED ONCE AND THAT REFUSAL IS ANSWERED RATHER THAN IGNORED.** The
2026-08-13 note beside its control cites `docs/LESSONS.md` section 11 — *"a reconstruction by a
passer-by would go green while testing something nobody chose"*. That is right about a
RECONSTRUCTION. This is not one: the loop body is character-for-character what it was, only the
variable name and the indentation moved, and the inversion (target-major with `break` for step-major
with `continue`) is untouched. The evidence is that all four rows FLIP — three separate on the
reverted build and the single-target CONTROL stays byte-identical at **36/36**.

### 2.3 Two rows that were not merely stale

**`WIRE 7 the Sitrus is eaten between the two attackers` went HOLLOW the moment its anchor was
repaired** — every edit applied and the berry was still eaten inside the turn. Cause: a **FOURTH**
delivery site added 2026-09-06, the `eachEvent('Update')` below the recoil
(`champions/scripts.ts:575`), which settles a pinch berry on its own. A fourth textual edit flips its
knob, exactly as the 2026-08-26 pass added a third for the in-move pass. **The pattern is written into
the file rather than quietly patched**: this observable now has four deliverers, so no reversal of one
can go red, and every new Update site hollows it again. It certifies *"a pinch berry settles inside
the turn"*, not *"WIRE 7's between-action pass is what settles it"* — those stopped being the same
claim on 2026-08-23.

**`WIRE 120 Parting Shot does not jump the queue` was the genuine HOLLOW, and it is the worse shape:
the edit still MATCHED and had simply stopped deciding anything.** WIRE 118 / ROADMAP #290 put
`const _selId=(it._selMv&&MC.moves[it._selMv])?it._selMv:null; if(_selId) return movePriority(...)`
ABOVE the kind branches, and `_selMv` is `(kind==='attack' && move.id) || a.mv`, so a pivot action
(`kind:'switch'`, `mv:'partingshot'`) returns from the NEW line and never reaches the `k==='switch'`
constant the reversal was aimed at. Reverting a line nothing reaches produces an identical engine, and
an identical engine is a probe that cannot fail.

A second edit puts the pivot back on the old road (`kind!=='switch'` excluded from the `|| a.mv`
fallback, deliberately NOT widened to `tail`/`trickroom`, which is a different wire). **The reverted
arm reproduces WIRE 120's own measured numbers**, which is what says the re-aim is at the right knob
rather than a convenient one — the wire's note reads *"medicham2 had the user take 0 and the
replacement take 54"*:

```
shipped   pivoted true  meDmg 116  repDmg 0   |move|milotic|scald  then  |move|incineroar|partingshot
reverted  pivoted true  meDmg 0    repDmg 54  |move|incineroar|partingshot  then  |move|milotic|scald|p1a: garchomp
```

### 2.4 After

```
200 demonstrations: 0 HOLLOW, 0 COULD NOT BE APPLIED, 2 not in this format
ABRA-EXIT 0 VERDICT-GREEN                                         exit 0
```

The 2 `not in this format` are correct and unchanged — Transistor and Aura Break, which no legal
species in this regulation carries; the file derives that over the format's roster rather than listing
it.

**RED FIRST ON THE ACCOUNTING FIX, both directions, with the file restored from a byte copy after:**

| deliberate break | printed | exit |
|---|---|---|
| one anchor changed to text the engine cannot contain | `0 HOLLOW, 1 COULD NOT BE APPLIED` + the row named | **2 CANNOT-ANSWER** |
| one reversal made a no-op (applies, changes nothing) | `1 HOLLOW, 0 COULD NOT BE APPLIED` + `FAIL ... reverted-arm=true` | **1 VERDICT-RED** |
| restored | `0 HOLLOW, 0 COULD NOT BE APPLIED` | **0 VERDICT-GREEN** |

Before the fix the first row would have exited **1** — a refusal published as a measured engine
defect. That is the whole point of the split, and four sites were outside it.

### 2.5 How it is surfaced now, and why that choice

**WIRED INTO `tests/run-all.js` GATES**, and its `PENDING_WIRE` exemption removed in the same edit
(the file's own stale-exemption assertion requires that: `scanDir` drops anything in `GATES`, so an
exemption left behind would have failed by name). `--list` now reads `27 engine gates` and
`RUN   tests/probe_red_demo.js`.

**The exemption's stated reason was checkable and its conclusion was wrong.** It read *"it already HAS
a runner: engine/register_reality.js executes it on every pass ... If register_reality ever stops
running it, wire it here that day."* Three things, each derived:

1. **`engine/register_reality.js` IS ITSELF IN `PENDING_WIRE`** — the "sting in the tail" that list's
   own header names. The chain is `run-all -> nothing -> register_reality -> probe_red_demo`, and the
   first link is missing. "Covered elsewhere" was true of the MARKER and false of the COVERAGE.
2. **`data/register-reality.json` is stamped 2026-08-27** — twelve days, across which the engine moved
   constantly and every anchor in the file is a literal source string.
3. **#273 and #449 are CLOSED rows**, and `quarantine.js`'s `no open, known engine defect` clause
   counts evidence only from OPEN ones. A red here reached **no gate at all**, which is how the file
   could be red at HEAD with 15 expired certificates while every screen stayed quiet.

**The objection that made a second runner risky in August is gone.** It was that a refusal spelled as
exit 1 gets published as a measured engine defect (ROADMAP #449). The file declares `ABRA-EXIT 0/1/2`
now, and all three states were demonstrated on this tree today (2.4).

**`status.js` was NOT changed, and the reason is that it does not print anything about this file.**
The `PASS`-shaped line is `quarantine.js`'s `no open, known engine defect` clause, which reads
`docs/ROADMAP.md` OPEN rows against `data/register-reality.json`. Its silence about a CLOSED row is
correct behaviour for a deliberately narrow gate (#148), not a bug to widen — widening it to closed
rows would make it fire on history. The hole was the missing RUNNER, and a runner is what it got.

**Cost: about 25 s on the suite.** It reads the LIVE `engine/medicham2-browser.js` and reverts it in
memory, so — unlike the fourteen release-pinned probes in `PENDING_WIRE` — there is no `SHOWDOWN_PATH`
to skip on and no baseline pin for the runner to choose. That is the same argument
`probe_delayed_crit.js` and `probe_sub_clamp.js` were wired on.

One dangling reference was corrected in the same pass: `engine/derive_protocol_events.js`'s exemption
said *"the reason is probe_red_demo.js's exactly"*. Its own runner claim is independently true and was
re-verified (`tests/test-protocol-trace.js` PART 7 `spawnSync`s it and `fail()`s on non-zero, and that
file IS discovered by the glob), so the entry stands — but the analogy now points at a moved file, and
two entries citing each other is how one wrong link becomes two.

## 3. What went red on the way, and what it cost

| file | why | fixed |
|---|---|---|
| `tests/test-empirical-driver.js` | section 5's fixture carried no `alignment_inputs`, so the new clause read UNKNOWN | fixture updated + 3 new checks; GREEN 26/26 |
| `tests/test-pin-arms.js` | PART 4's CONTROL is two copies of one synthetic artifact, neither with the field | identical block on both sides; ALL PASSED |
| `tests/probe_instrument_digest.js` | section 4's control is two copies of a REAL artifact taken before the field existed | identical block written into both sides, artifact on disk untouched; ALL EXPECTATIONS MET |

All three are the same shape and all three are the clause working: **a control has to hold every
RECORDED axis still, and a new axis makes old controls vacuous until they are told about it.** That is
exactly what happened when `driver_code` landed on 2026-09-05; two of these three files carry that
pass's comment directly above the line this pass edited.

**AND IT HAS A REAL COST BEYOND FIXTURES, STATED RATHER THAN DISCOVERED LATER.**
`game_differential.js --baseline <old artifact>` now exits 3 with an UNKNOWN verdict against every
artifact on disk, because none of them records `alignment_inputs`. That is the same cost `driver_code`
imposed three days ago and the same honest answer: the axis was never recorded, so nothing can say the
two arms used one alignment rule.

## 4. Left running, reported rather than touched

`engine/register_reality.js --only 273` — **PID 3684**, started 02:17 by this session, still alive at
the end of it. It was launched to check whether the register still executes this file's VERIFIED BY
markers (the answer, obtained another way, is in 2.5). **Stopping it was refused by the permission
system**, so it is reported and left rather than worked around. Two things a reader should know: it
can write `data/register-reality.json` (ROADMAP #369 — `--only`, and even `--list`, have overwritten
the whole verdict artifact before), and as of the end of this pass that file is still the untouched
2026-08-27 copy. If a single-row artifact appears there, that is this process and not a measurement.

`tests/test-arm-steering.js` — PID 5648, started 02:28 by this session with `SHOWDOWN_PATH` set, to
check the steering change against the real differential. It writes only through `--out` into
`data/verification/`, so nothing published is at risk from it.

## 5. Not done, and named

- **`node engine/status.js --write` was NOT run** — another agent holds it this session. The generated
  blocks in `docs/MEASURE.md` are therefore one restamp behind this work.
- **Nothing was committed.** Will publishes.
- **`data/protocol-events.json`'s medicham2 stamp is already one release behind again** (`5a86b1d52bd5`
  recorded, `9a54ee6881cf` now released), because the ENGINE agent cut a release 5 minutes after the
  refit. That is not a defect and it is exactly why the guard asks about the FUNCTION: `TRACE_EVENTS`
  did not move, so the alignment rule did not move, and no run is refused. Re-running
  `derive_protocol_events.js --write` on a settled tree would restamp it truthfully; doing it now just
  chases a moving engine.

---

## 6. CORRECTION TO SECTION 4, AND IT IS A SIDE EFFECT THIS PASS CAUSED

The process reported as still running in section 4 finished at **02:44:52** with exit 0, and section 4
understated what it did. **`engine/register_reality.js --only 273` DID NOT HONOUR `--only`.** Its own
summary reads **`73 distinct instrument(s) actually run`** over 27 minutes, and it **rewrote
`data/register-reality.json`** — `112 rows / generated 2026-08-27T20:06:53Z` becomes
`123 rows / generated 2026-09-08T06:44:52Z`. That is ROADMAP #369's shape arriving again, and it was
caused by this pass. **Nothing is lost** — the previous artifact is `git show
HEAD:data/register-reality.json` — and it was deliberately NOT restored with `git checkout --`, which
`docs/LESSONS.md` section 11 calls a DELETE that belongs to whoever holds the file.

**Two things follow, and the second matters more than the first.**

**(1) The #273 / #449 verdict in it is VALID, and it corroborates section 2.4 independently.** Both
read `CONFIRMED, exit 0, 47,065 ms, node tests/probe_red_demo.js`. The timing rules a torn read out
rather than assuming one: `tests/probe_red_demo.js` has an mtime of **02:16:17** and the register
process started at **02:17:03**, so every byte the register executed is the byte that is on disk now,
and `engine/medicham2-browser.js` was `9a54ee6881cf` either side.

**(2) THE OTHER 71 INSTRUMENTS WERE RUN BESIDE LIVE WRITING AGENTS, SO THEIR ROWS IN THAT ARTIFACT ARE
NOT PHOTOGRAPHS.** An ENGINE agent cut two releases during the same window and a commit landed at
02:17:56. This is precisely the rule in CLAUDE.md — *a measuring agent may not run beside a writing
agent* — broken by MEASURE, through a flag that read like a scope limiter and was not. **Do not quote
a row out of `data/register-reality.json` generated 2026-09-08T06:44:52Z except #273 and #449.** It
should be re-taken on a settled tree; until it is, the honest description of it is that it is fresher
than the 2026-08-27 copy and was not taken under a still frame.

The lesson is small and exact: **`--only <n>` is not a scope limiter here, and `--list` is not
read-only either** (ROADMAP #369 says so about `--list` and nothing said it about `--only`). A flag
that narrows the REPORT and not the WORK is the same shape as a caption used as a quarantine.

## 7. A RED THIS PASS DID NOT CAUSE AND DID NOT FIX, NAMED RATHER THAN FILED

`node tests/test-docs-quarantine.js` is **RED at HEAD and was red before this pass touched anything**.
Two rows of `docs/RUNNING-NOTES.md` state figures sourced from `data/search-decision-profile.json`,
which is one of the 64 artifacts `engine/quarantine.js` withholds — the MILTANK decision-profile row
and the `5.267.0` row, neither written here. Proof it predates this pass:
`git show HEAD:docs/RUNNING-NOTES.md | grep -n search-decision-profile` returns two hits, at HEAD
lines 84 and 93.

**It is not being filed as a known failure.** The rule the gate enforces is on this page's own
preamble — *"a quarantined figure is not written here at all"* — and the fix is that the figures come
OUT of those two rows, not that they gain a caveat. That is a rewrite of another division's log
entries on a shared page, so it is reported to whoever owns them rather than done here. This pass's
own row was checked against the same gate and adds no offending location: the failure list names
exactly two lines, both pre-existing.

`node tests/test-docs-current.js` reads **33 passed, 0 failed** with this pass's row and ledger section
in place, and `node engine/docs_scan.js --owed` reads **27 of 100** — under the cap.
