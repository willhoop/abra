# The broken checks — what is wrong with the instrument, and what would make it able to fail

MEASURE, 2026-08-26. Companion to `docs/_reports/2026-08-26-red-triage.md`, which classified the
suite's reds. This pass looks only at the ones where **the check itself is the defect**.

Read-only session. Nothing was run that plays a game, nothing wrote outside this file, no git
command was run. Artifacts were read with `git show HEAD:<file>`; release sources were read out of
`data/releases/<id>/`, which is immutable.

---

## 0. THE SET MOVED UNDER THE TRIAGE, AND THAT IS THE FIRST FINDING

The triage's six category-4 entries were read out of a suite log from **2026-08-25 21:57**.
**Three of the six were fixed at 01:31 this morning** in commit `5bb13e3b` — *"Every red row in
three checks was a Pokemon this format does not have"*:

| triage entry | state at HEAD |
|---|---|
| `engine/validate_damage.js` | **FIXED.** `data/damage-validation.json` at HEAD reads `within_2pct: 100, worst_pct: 0, compared 36/36`. |
| `tests/test-rollout-effects.js` | **REWRITTEN to derive** — sections 1-4 now sweep every playable move (`PF.playable('move', …)`) instead of 30 typed names. Not re-run here. |
| `tests/test-fragility.js` | **REWRITTEN to derive** — its absorbers come from `PF.playable('ability', …)`. Not re-run here. |

The durable half of that commit is `engine/fixture_preflight.js` gaining `carriers()` and
`playable(kind, name)` — the filter `isNonstandard` cannot do, because Tinted Lens, Storm Drain,
Full Metal Body and Guard Dog are all *legal* and have **zero legal carriers**. Six files call it
now (`tests/roster.js`, `test-fragility`, `test-mechanics`, `test-rollout-effects`,
`engine/all_mechanics_fire.js`, `engine/million_run.js`, `engine/validate_damage.js`).

**That fix catches the class only for files that opt in.** Nothing forces a new fixture to ask.
`tests/test-fixture-legality.js` validates `set` declarations — a body with an item and moves — and
does not see an ability id handed to `dmgRange`, or a move id asserted against a table. So the
fourth occurrence of this bug is not currently prevented, it is merely absent. Named as a gap, not
proposed as a new gate.

**So the genuinely-broken set at HEAD is five, and it is not the triage's five.** The two the triage
put elsewhere — `probe_red_demo` (PENDING_WIRE) and the mutation harness's gate (filed as a real
defect) — are instrument failures and belong here.

---

## 1. `tests/test-workflow-paths.js` — **A CARRIAGE RETURN. PROVEN, AND IT IS NEW.**

**Mechanism, plainly.** The check reads every `.github/workflows/*.yml`, finds each `git add`, and
asserts the path it names is committable. It splits the file on `\n` and matches
`/git\s+add\s+(.+)$/`. On this machine `core.autocrlf=true`, so every line in the working tree ends
`\r\n` and each split line keeps a trailing `\r`. In a JavaScript regex `.` does not match `\r`, and
`$` without the `m` flag matches only at end-of-string or before a final `\n` — **never before a
`\r`**. So the pattern fails on every line of a CRLF file, and the check sees **no `git add`
anywhere**.

Measured, not argued:

```
line 83 of .github/workflows/smogon-stats.yml, exactly as read from disk:
  "          git add data/smogon-stats data/smogon-priors.json data/smogon-priors-bo3.json data/mew.js\r"
  match with CR   : false
  match without CR: true
```

The committed blob has **zero** `\r` — this is the Windows checkout, so the check works on the CI
runner and is blind on the machine where the suite is actually run.

**Can it go red?** It is red, and honestly so: `if (!staged) bad('no git add path was found in any
workflow — this test asserted nothing, which is worse than failing')`. That clause is good design
and it fired. **But its diagnosis is wrong** — the staging did not move out of the workflow files,
it is sitting at `smogon-stats.yml:83` — and the triage already drew the wrong conclusion from it
once ("re-aim the staging clause at wherever staging lives now").

**The part that matters: it cannot catch the bug it was written for.** Its own header says *"SHOWN
RED BEFORE BEING TRUSTED: put `data/games.ladder.jsonl` back into ingest.yml's `git add` and this
reports FAIL … which .gitignore excludes."* I re-planted exactly that, in memory, in CRLF form:

```
  dynamic, skipped: "$f"
  static paths seen by the check: 0
```

The 24-day dead collector — 570 failed runs, an estimated 2,500-3,000 ladder games aged out — would
land today and this check would not name it. The "shown red" claim in the header is **false on this
machine right now**.

**Fix, and does it catch the class?** `(.+?)\s*$` in place of `(.+)$` closes this instance
(verified: it matches). The class fix is one level up — **normalise line endings once when the
workflow text is read** (`.replace(/\r\n/g, '\n')`), the way `tests/probe_red_demo.js:94` already
does for the engine source, with its own comment explaining why. That covers every future regex in
this file rather than the one anchor that happened to break. It does not, and cannot, cover other
files that parse text on a CRLF checkout — that is a repo-wide shape worth a one-line grep, not a
gate.

**Downstream.** Nothing consumes its verdict; it is a suite check only. Its second arm (the tracked
`.gz` stores are older than the plain stores) is a **real** OPS defect and is unaffected.

---

## 2. `tests/test-wiring.js` — **IT READS A CORPSE AND REPORTS ON THE BODY**

**Mechanism, plainly.** The suite runs every child with `ABRA_STRICT_SEMANTICS=1`
(`tests/run-all.js:487`). That flag turns `engine/magnemite.js:101`'s standing REFIT-OWED warning
into a `throw`. `test-wiring` spawns `engine/mew.js` with `env: process.env`, mew dies inside
`loadWeights` before it prints anything, and `runCapture` returns
`String(r.stderr) + String(r.stdout)` **without ever looking at `r.status`, `r.signal` or
`r.error`**. Every capability counter is therefore absent, and each absence is reported as
`"no <label> line in the run report at all — the capability does not even report"`, closing with
***"10 capability/ies are NOT WIRED. The code exists, the run succeeded, and the bot cannot do the
thing."*** The run did not succeed. Nothing in this file can tell those two states apart — which is
precisely the distinction the file exists to make.

**Can it go red?** Yes, and it errs loud rather than silent, so it is the least dangerous of the
five. Two narrower holes worth recording while it is open: `counter()` matches its label anywhere in
the concatenated stdout+stderr, so a stack trace or a usage banner containing the label would score
as a live capability; and `spawnSync(… { timeout: 600000 })` killing a hung child is indistinguishable
from the same corpse.

**Fix, and does it catch the class?** `if (r.status !== 0 || r.error) { print the child's exit code
and stderr; fail; }` before parsing. That is the instance. The class is **"a check that parses a
child's output must first assert the child ran"**, and this repo has the same shape in
`engine/register_reality.js` (§4 below) — where it is handled correctly, by a tri-state `green` in
which `null` is not green. Copying that shape here, rather than a boolean, is the fix that
generalises.

**Downstream.** No artifact. But the sentence *"10 capabilities are NOT WIRED"* is the loudest false
alarm on the board and it is quotable, which in this repo is a downstream consumer.

**The check stays red after the fix**, because the refit really is owed and it is gated behind
MEDICHAM, not behind compute. Fixing the status check converts a false statement into a true one; it
does not turn the light green, and it must not be sold as if it did.

---

## 3. `tests/mutation_harness.js` — **THE PLANTED-STUB GATE CATCHES 0 OF 2, AND THE MISS DIRECTION IS UNKNOWN**

First, the distinction the triage did not draw: **`tests/test-mutation-coverage.js` is working
correctly.** It is red because it asked its instrument to prove itself and the instrument could not.
The broken thing is `mutation_harness.runGate()`.

**Mechanism, plainly.** Before any sweep, the harness plants two known-bad stubs into the engine
source in memory and requires that it detect both: one that reads the Choice Scarf speed parameter
and then writes a literal `1.5` (the WIRE 71 shape), one that replaces the tag-derived `SPREAD` set
with a hard-coded legacy list. Each stub must score `READ-AND-IGNORED` while the shipped engine
scores `LIVE` on the same operator. Measured output:

```
MISSED  param-level stub    item:choicescarf:speedMult.mult:=11.5   shipped LIVE / stubbed LIVE
MISSED  set-building stub   move:rockslide:spreadFoes:REMOVE-TAG    shipped LIVE / stubbed LIVE
```

**What I established from source, and what I did not.**

- Both plants **do apply**. Against release `d684a2f1f183` and against `d38d117e68e9`, the param
  anchor occurs exactly once and the `SPREAD` regex matches. `plant()` throws when an anchor is
  missing, and no throw occurred, so this is not a stale-patch failure.
- **The gate was passing on 2026-08-22.** `data/mutation-coverage.json` is stamped
  `2026-08-22T05:54:51Z` against release `6fb9ebd3b704`, and the harness refuses to sweep or write
  when the gate fails. So the gate broke somewhere across the **~35 engine commits since**, and
  nothing noticed because the harness is only run by hand.
- For `spreadFoes` there is a **second consumer the stub does not neutralise** —
  `TAGS.param('move', mvId, 'spreadFoes')` at line 13594 of the release engine, beside the
  module-load `SPREAD` set the stub replaces. A tag-level removal still moves that one. But that
  line landed on **2026-08-19** (`9379873b`), before the last passing gate, so it is at most half the
  story.
- For `speedMult` I could not reproduce the failure from source, and I am saying so rather than
  guessing. The quoted literal `'speedMult'` appears **exactly once** in the whole engine — the line
  the stub patches. With the stub in, the mutated value has no route into the engine at all, and the
  comparison still reports a difference. **That points at the comparator, not at the tag**: something
  is making base-vs-mutant digests differ for a reason that has nothing to do with the fact being
  mutated.

**Can it go red?** It is red. The danger is the opposite one: if the cause is a **false-LIVE
generator**, then the sweep's `565 LIVE` are also suspect, and LIVE is the *reassuring* verdict. A
dead safety net looks exactly like a working one; a comparator biased toward LIVE looks exactly like
a clean engine.

**Fix, and does it catch the class?** Do not re-aim the stubs until the direction is known. The
diagnostic is in OWED: run the gate alone, then sweep `speedMult` alone with the operator's
per-arm differences printed. If the difference appears only under the streaming rngs it is the
`stream-shift-suspect` path the file already names; if it appears under `k05`/`k50`/`k95` — which
cannot realign a stream — the comparator is at fault. **The class fix, whatever the cause turns out
to be, is that a stub must neutralise EVERY consumer of the tag it stubs**: `mutation_harness`
already computes `sourceConsumers()`, so the gate can assert *"this stub covers all N consumers of
this tag"* and go red when a new consumer appears, instead of silently becoming a stub of one route
out of two. That catches the next one; re-aiming two patches by hand catches only these.

**Design note worth landing at the same time:** the gate opens the **current** release
(`REL.open(null)`) while the artifact it guards is pinned to an older one. The instrument's subject
moves with every ENGINE cut. That is why it can rot between sweeps with nobody's fault attached.

**Downstream.** `data/mutation-coverage.json` carries **1,563 operator verdicts**, the ratcheted
class-A ceiling of 148, and the `0 regressions` line. It is read by `web/quarantine-data.js` and
rendered on `web/stadium.html` — **the site publishes numbers whose licence is this gate**. And
because the harness refuses to sweep while the gate fails, the artifact **cannot currently be
regenerated at all**. It is frozen at 2026-08-22 bytes and unlicensed.

---

## 4. `tests/probe_red_demo.js` — **THE FILE THAT CERTIFIES EVERY OTHER PROBE, AND IT CANNOT SAY WHICH KIND OF RED IT IS**

**Mechanism, plainly.** This is the standing "no check is committed until it has been shown failing
on a known-bad input" evidence for the whole probe suite — ~75 artifact demonstrations
(`demo`, tag stripped from the in-memory DB) and ~100 source-reversal demonstrations (`demoSource`,
the engine textually reverted to what it said before the wire). Three distinct outcomes lead to the
**one** `process.exit(1)` at line 4576:

1. a genuine HOLLOW probe — both arms hold, so the probe does not watch its knob;
2. a **STALE** reversal — the patch text no longer matches the engine, so the demonstration has not
   run at all;
3. a reversal that applies and produces an engine that throws.

The file is scrupulous internally: it counts and names the stale rows separately and prints them.
But `grep -c "ABRA-EXIT" tests/probe_red_demo.js` returns **0**, so `classifyExit` in
`engine/register_reality.js:254` reads an undeclared exit 1 as `VERDICT-RED`. **A wire that was
never demonstrated is recorded as a wire that failed.**

**Can it go red?** Yes — and that is the problem. It can only go red. There is no exit code by which
it can say *"I could not answer for eight of these."* Its own careful three-way distinction is
flattened to one bit at the boundary.

**A second, separate defect on the same file: the suite does not run it.** It is a `PENDING_WIRE`
entry (`tests/run-all.js:321`), so the suite prints a **hand-typed sentence** about it —
*"10 of 200 demonstrations failed and EIGHT are stale reversals"* — beside checks that actually ran.
That figure is prose in a source file. It is the fourteen-stale-handoffs shape, sitting inside the
runner that exists to replace typed status. **I did not verify the 10/8 split and it is in OWED.**

**Fix, and does it catch the class?** One line per refusal path — `ABRA-EXIT 2 CANNOT-ANSWER` on the
stale/threw path, keeping exit 1 for a genuine hollow row — makes the register able to tell them
apart, because `classifyExit` already has `CANNOT-ANSWER` as a first-class tri-state and
`quarantine.js` already treats `green === null` as "not evidence in either direction". **That is the
class fix and it already exists in this repo**: the machinery is built, this file simply does not
use it. The stale patches then get re-aimed as ordinary work, visible as debt instead of as failure.

**Downstream — the deepest consumer of any check in this report.** `data/register-reality.json` row
`#273` records `green:false / VERDICT-RED / CONFIRMED / why: "exit 1"`. `quarantine.js` reads that
artifact for its `no open, known engine defect` clause, and that clause is **one of the three MEDICHAM
gate clauses currently failing** (`docs/MEASURE.md`'s generated block: *"3 of 8 gate clauses fail …
no open, known engine defect"*). The quarantine is what withholds leaf calibration, the click-censoring
census, the leaf-engine contrast and the weights. So an undeclared exit code on a probe file is
carrying weight inside the gate that governs everything this division may publish.

Row #273 happens to be *about* the staleness, so its `CONFIRMED` is right by luck. That is not a
defence; it is the reason nobody has looked.

---

## 5. `tests/test-engine-diff.js` — **IT CANNOT PASS, AND THE GUARD IS THE RIGHT ONE**

**Mechanism, plainly.** Every clause inside the file reads zero disagreements today. It exits **3**
because `engine/publish_guard.js:196` refuses to republish a measurement at a smaller sample: the
runner invokes it with no arguments, `const N = argInt('--n', 150)`, and `data/engine-diff.json`
holds `compared: 6000, agreed: 6000, disagreed: 0` (regenerated 2026-08-25 21:58). The guard writes
the small run to `data/verification/engine-diff.n150.json`, leaves the published artifact untouched,
and sets a non-zero exit so a refused run cannot read as a pass. **All of that is correct.** The
defect is the question the runner asks.

**Can it go red?** It is *permanently* red, which is a different failure from being unfalsifiable and
is the one CLAUDE.md names by hand: a check that is red every single run is a check people learn to
read past, and this one guards the damage number every rollout, leaf and board depends on. A real
disagreement would move it from exit 3 to exit 1 — a distinction no one reading a fail/pass column
will ever see.

**Fix, and does it catch the class?** Give the runner either `--n 6000` (minutes, and it republishes
honestly) or a *verify-only* mode that runs every conformance clause and does not attempt to publish.
The second is better and it generalises: **any check that both asserts and publishes needs a way to
assert without publishing**, or the suite is forced to choose between a stale artifact and a
permanent red. `publish_guard` is used by more than this one caller, so the mode belongs beside the
guard, not in this file.

**Downstream.** `data/engine-diff.json` is read by `engine/quarantine.js` and `engine/status.js` —
it is a MEDICHAM gate input. **The guard's refusal is what has been protecting it**: had the suite
been allowed to publish, the 6,000-comparison figure the gate reads would have been silently replaced
by a 150-comparison one on every run.

---

## 6. RANKING — WHICH ONE FIRST

**1. `tests/probe_red_demo.js`.** It is the only one whose verdict leaves the file: an undeclared
exit 1 becomes `VERDICT-RED` in `data/register-reality.json`, which is the evidence
`quarantine.js`'s open-defect clause has, which is one of the three failing MEDICHAM gate clauses,
which is what withholds every figure MEASURE owns. And it is the meta-check: **it is the standing
proof that ~175 probes across this repo were shown red before being trusted**, so every stale row is
a certificate that has quietly expired. One `ABRA-EXIT 2 CANNOT-ANSWER` line makes all of that
legible, and the tri-state that consumes it is already built and already tested.

**2. `tests/mutation_harness.js`'s gate.** Most verdicts at stake (1,563, plus a ratchet and a
published site panel), the artifact cannot be regenerated while it fails, and the miss direction is
unknown — if the comparator is generating false LIVE, the reassuring half of the sweep is the wrong
half. Diagnose before re-aiming.

**3. `tests/test-wiring.js`.** One line, and it stops the loudest false sentence on the board. It
will still be red afterwards; say so when it lands.

**4. `tests/test-workflow-paths.js`.** Cheap, proven, and it restores a check that currently cannot
catch a failure that once cost ~2,500 unrecoverable ladder games. Ranked below the others only
because the workflow it watches is not changing this week.

**5. `tests/test-engine-diff.js`.** Costs a design decision (verify mode) or minutes of compute, and
nothing is being hidden meanwhile — the guard is doing its job.

**How many are genuinely unfalsifiable:** **one and a half.** `test-workflow-paths`'s staging clause
cannot fail for the reason it was written (proven by re-planting the defect), and `probe_red_demo`
cannot express a refusal, so half of its verdict space is unreachable. The other three are red and
honest about being red; what is broken in them is the *attribution* of the red, not the ability to
produce one. That distinction is worth keeping: **red is a state; broken is a claim about the
instrument**, and only two of these five earn the second word outright.

---

## OWED, NOT RUN

```bash
# 1. THE MUTATION GATE — is it a false-LIVE comparator, or a stub that misses a consumer?
#    Plays scripted 5-turn battles in medicham2. Reads the CURRENT release. --gate-only writes nothing.
node tests/mutation_harness.js --gate-only
#    Then the one tag, with the operator table printed, to see WHICH arm saw the difference.
#    A difference under k05/k50/k95 (constant rngs, which cannot realign a stream) indicts the
#    comparator; one seen only under lcg-* is the stream-shift path the file already names.
node tests/mutation_harness.js --tags=speedMult --no-write
node tests/mutation_harness.js --tags=spreadFoes --no-write
#    And pin the subject rather than letting it move: measure the release the artifact measured.
node tests/mutation_harness.js --gate-only --release=6fb9ebd3b704

# 2. probe_red_demo — the 10-failed / 8-stale split is TYPED in tests/run-all.js:321, not measured.
#    PROBE_VERBOSE=1 prints the full missing pattern for each stale row, which is what re-aiming needs.
node tests/probe_red_demo.js
PROBE_VERBOSE=1 node tests/probe_red_demo.js

# 3. THE TWO CHECKS 5bb13e3b REWROTE, NOT RE-RUN HERE. validate_damage's artifact says it is green;
#    these two have no artifact and their state at HEAD is a claim in a commit message.
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-rollout-effects.js
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-fragility.js

# 4. test-workflow-paths — no run needed to establish the CR defect (proven above), but this is the
#    before/after pair when the fix lands. Arm 2 will still be red until the .gz stores are rebuilt.
node tests/test-workflow-paths.js

# 5. test-engine-diff at the published sample, once the tree is settled and nobody else is measuring.
#    Minutes. It republishes data/engine-diff.json, which quarantine.js and status.js read.
SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-engine-diff.js --n 6000

# 6. test-wiring — after the r.status check lands, to confirm the message changes from
#    "10 capabilities are NOT WIRED" to a named child-process failure. Plays self-play games.
SHOWDOWN_PATH=/path/to/pokemon-showdown ABRA_STRICT_SEMANTICS=1 node tests/test-wiring.js

# 7. NOT RUN AND NOT TO BE RUN BY MEASURE while the ENGINE agent holds engine/medicham2-browser.js
#    and engine/game_differential.js: the full suite, and anything that writes into data/.
```
