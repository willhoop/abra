# A gate that could not answer was published as a gate that found a defect

MEASURE, 2026-08-23. Light mode: file edits and sub-second probes only. No differential, no roster,
no census, no `quarantine.js`, no `status.js`, and **`data/register-reality.json` was NOT
regenerated** — it is byte-identical to HEAD at the end of this pass, and `git status` confirms it.

---

## 1. The defect, confirmed at the line

`engine/register_reality.js`, `runUncached()`, pre-fix:

```js
} catch (e) {
  if (e && (e.code === 'ENOENT' || e.killed))
    return { green: null, why: 'the instrument could not be run: ' + ... };
  return { green: false, why: 'exit ' + (e && e.status), ms: ... };
}
```

Any non-zero exit became `green: false`. `green: false` is not "the instrument had something to
say" — in this file it is a **measured RED**, and three consumers act on it:

| consumer | what `green: false` does |
|---|---|
| `verdict()` — open row | `CONFIRMED`, whose documented meaning is *"the row and the world agree"* |
| `verdict()` — closed row | `PREMATURE CLOSE`, an accusation against whoever closed it |
| `openDefectClause()` in `engine/quarantine.js` (line ~1574) | `withRed`, and `ok = withRed.length === 0` holds the MEDICHAM gate clause shut |

**Measured today on the pre-fix bytes**, both instruments run directly:

```
node engine/gate_offfield_target.js   -> exit 2   CANNOT ANSWER   NO CURRENT ARTIFACT
node engine/gate_fail_and_silent.js   -> exit 2   CANNOT ANSWER   MEASURED AGAINST A DIFFERENT ENGINE
```

- **#224** (`gate_offfield_target.js`): both artifacts it reads were measured against other bytes —
  `data/game-differential.json` at `c66976713feb`, `data/divergence-turns.json` at `6a05dd9ad60d`,
  against a tree of `33d871e6db92`.
- **#241** (`gate_fail_and_silent.js`): its artifact ran on release `c66976713feb`; the count is
  WITHHELD rather than printed with a caveat, and the sample differs too (census `80e648f34d56` /
  pool `0d103fb9fa87` / 961 games against the pinned `2e3953f1f882` / `631d4ea60a80` / 995).

Neither gate had a finding. Both were being published as red evidence of a live engine defect.
That is a gate reporting something untrue in the direction that gets gates ignored (#148), arriving
through the **ruler** rather than the engine.

---

## 2. THE RIPPLE — what actually reads this tri-state

I was given one consumer and asked to find the rest. The full set, derived by grepping every
`.green`, every reader of `data/register-reality.json`, and every branch on a verdict string:

| site | reads | verdict |
|---|---|---|
| `engine/quarantine.js:1574-1576` `openDefectClause` | `v.green === false` -> `withRed`; `=== true` -> `staleRows`; anything else -> `unrunnable` | **strict tri-state, no collapse.** This is the load-bearing consumer |
| `engine/quarantine.js:1422` `registerRealityRows` | `hasOwnProperty(greenKey) ? value : null` | correct — a missing key is `null`, not `false` |
| `engine/register_reality.js:145` `if (row.closed && !green)` | **a real `!green`**, which WOULD collapse null into false | **unreachable**: the `green === null` branch two lines above returns first. It is a latent trap, not a live one, and the fix does not remove it — see §7 |
| `engine/status.js:1145-1160` | prints `clause.why` **in full**, wrapping rather than truncating | a null row IS printed by name. Not silent, not clean |
| `engine/where.js:198` | reads the artifact for coverage (*"naming a gate is not having a verdict"*) | does not branch on `green` at all |
| `web/quarantine-data.js` | a generated snapshot; carries the artifact's PATH in a provenance block | no branch on `green` |
| `tests/run-all.js`, `tests/test-stadium-roster.js` | catalogue entries describing the script | no branch |

**Nothing else does `!green`.** Nothing else branches on a verdict STRING (`STALE ROW`,
`PREMATURE CLOSE`, `INSTRUMENT UNRUNNABLE` appear only in prose and in this file).

### 2a. THE PREMISE HELD: `null` is DEBT, not PASS

The brief was explicit that this could invalidate the fix. It does not:

- `openDefectClause` puts a null row in `unrunnable`, prints it **by number** on its own line —
  *"open row(s) name an instrument that WOULD NOT RUN — that is not agreement and it is not evidence
  either"* — and `status.js` prints that sentence in full.
- `register_reality.js` keeps it in `BAD`, so the tool still **exits 1** on it.

So a row moving RED -> NOT-EVIDENCE stays named, stays counted, and the tool stays red. That is the
same treatment `debt` gets, which is what the clause's own header says debt is for.

### 2b. AND ONE THING THAT DOES CHANGE, STATED PLAINLY

`unrunnable` does **not** set `ok = false`. So a row moving from `withRed` to `unrunnable` stops
holding the MEDICHAM open-defect clause shut. That is a genuine relaxation and it is the honest
consequence of the fix, not a side effect to be buried.

**The clause does not open today, and that is measured rather than assumed.** `#258` is OPEN and its
instrument was run today:

```
node tests/test-no-silent-failure.js   -> exit 1        (a real RED verdict; source scan, no simulator)
```

so `withRed` is non-empty and the clause still FAILS. `#218`'s instrument is
`node engine/quarantine.js --whole-game`, which light mode forbids — **its exit code today is
unknown and is not being guessed at**; the artifact's record of exit 1 for it is 26 hours old.

**#224 has been REOPENED (2026-08-22).** The stale artifact still files it as `PREMATURE CLOSE`
(closed + red). On the next real run it would have been open + red = `CONFIRMED`, i.e. it would have
started holding the gate shut. Post-fix it is `EXIT CODE UNDECLARED` instead.

---

## 3. THE CLASS, NOT THE INSTANCE

`status === 2` is the instance. The question is *which exit codes are verdicts and which are
refusals*, and the answer had to survive an instrument that refuses in a way nobody here anticipated.

**The burden is inverted and put on the instrument.**

```
exit 0                    VERDICT-GREEN.  The universal convention.
exit 1                    VERDICT-RED.    Also the universal convention, and what node itself
                                          exits on an uncaught throw.
any other non-zero code    NOT A VERDICT unless the instrument says so -> green: null.
```

An instrument that wants a code outside `{0,1}` to carry meaning declares it on the way out:

```
ABRA-EXIT 2 CANNOT-ANSWER
ABRA-EXIT 3 VERDICT-RED
```

Matched at the **start of a line**, uppercase and hyphenated, for the same reason `VERIFIED BY:` is:
ordinary prose must not be able to produce it. That is not decoration —
`engine/gate_offfield_target.js` prints the legend
`exit 2   [0 clean, 1 the placeholder is back, 2 cannot answer]` **on every run including its green
ones**, so a tolerant search for the words "cannot answer" would have classified every clean run as
a refusal. Only the declaration naming the code the process actually exited with is read, last one
wins, and there is a selftest assertion carrying that exact legend string.

### Why this and not the alternatives

| option | why not |
|---|---|
| **hard-code `status === 2`** | the instance. Cannot see a refusal spelled 5 |
| **a registry of refusal codes in this file** | the ban-list-of-four shape: a hand-kept list of known-bad forms, which this project has been bitten by three times |
| **parse the legend the gates already print** (`[0 clean, 1 …, 2 cannot answer]`) | free-text vocabulary matching. That is how a metaphor got into a gate (#148). It also prints on green runs |
| **a second process spawn asking the instrument for its code table** | doubles the cost of every instrument and still needs the instrument to opt in — the same opt-in, more expensively |
| **declared refusal, undeclared codes refused** (chosen) | opt-in for MEANING, but the DEFAULT is safe: an undeclared code outside `{0,1}` is not read as a verdict at all |

### The proof that it is class-safe, not instance-safe

**Neither gate had to be edited for the fix to work on it.** `gate_offfield_target.js` is untouched:
it exits 2, declares nothing, and post-fix classifies as `EXIT CODE UNDECLARED` -> `green: null`.
That is a new refusal shape being caught without being enumerated.

### What it CANNOT catch, stated in the gate's own header

- **A refusal spelled as exit 1 with no declaration.** Irreducible: exit 1 is the universal "I
  failed", and an instrument that refuses without saying so is indistinguishable from one that found
  the defect. The only defence is the instrument declaring itself, which is why
  `exit_codes_undeclared` is counted and printed on every run — a coverage figure meant to be driven
  down, not a claim that it is already zero.
- **A lying declaration.** `ABRA-EXIT 1 VERDICT-GREEN` on a real failure would be honoured. The one
  contradiction that IS detectable — a declaration attached to exit 0 that does not say
  `VERDICT-GREEN` — is refused rather than guessed at.

Both are written into `classifyExit`'s header, not into this report only.

---

## 4. THE SAME FACT IS DECIDED IN TWO FILES, AND THEY DISAGREED

`tests/run-all.js`, in its runner loop:

```js
/* EXIT 2 MEANS "I COULD NOT RUN", NOT "I FAILED". ... */
else if (r.status === 2) { skip.push([rel, why]); ... }
```

It has treated exit 2 as a refusal for **every** script it runs, generically, and says so in those
words. `engine/register_reality.js` treated the same code as a red verdict. Two files deciding one
fact, disagreeing, both continuing to work — CLAUDE.md's named failure mode, and this pass found the
one that was wrong.

**The unification is NOT done here and that is deliberate.** It would mean either editing
`tests/run-all.js` (this pass was forbidden to touch `tests/`, and an ENGINE agent is live on that
branch) or making `engine/register_reality.js` requirable, which today runs its driver at module
scope and would **write the artifact on require**. Doing it blind is how a runner starts skipping
real failures. Filed as a row; see §8.

Note the interaction if anyone does it: `run-all.js` currently FAILs on exit 3, and
`gate_fail_and_silent.js` uses exit 3 for REGRESSION. Under the shared classifier that stays red
**only because that gate now declares `ABRA-EXIT 3 VERDICT-RED`.**

---

## 5. WHAT LANDED

**`engine/register_reality.js`**
- `classifyExit(status, text)` — the new decision, with the whole argument above in its header.
- `KIND` / `DECLARATION` — the declaration grammar, line-anchored.
- `runUncached(cmd, exec)` — now **reads the failed child's stdio** instead of discarding it, and
  classifies off it. `exec` is injectable **only** so the selftest can drive this exact function
  rather than a restatement of it. A signal kill / ENOENT / `status === null` still reads
  `NOT-STARTED`, which is a different fact from a refusal.
- `verdict(row, green, kind)` — the null case splits three ways:
  `INSTRUMENT UNRUNNABLE` (never started), `INSTRUMENT CANNOT ANSWER` (ran, declared a refusal),
  `EXIT CODE UNDECLARED` (exited outside `{0,1}`, explained nothing). One label for all three would
  be a sentence that is false for two of them.
- Both new labels are in `VERDICTS` (so `publish()` accepts them) **and** in `BAD` (so the tool still
  exits 1). There is a selftest that walks every tri-state x every kind x open/closed x marked/unmarked
  and asserts no producible verdict is one `publish()` would refuse — a new label that aborted the
  write site would take down the whole run.
- `counts.cannot_answer` and `counts.exit_codes_undeclared` in the artifact, printed on the
  measuring path only (`--list` renders a coverage block that has no such keys, and a figure rendered
  as `undefined` is worse than one not rendered).
- **`RR_CANNOT_ANSWER_AS_RED=1`** restores the pre-fix defect exactly, in the `MEDI_*` / `ROSTER_*`
  style.

**`engine/gate_fail_and_silent.js`**
- `declareExit(v)`, **derived from the `tag` the verdict table already sets** rather than restated as
  a second table, printed to **stderr** so it cannot land inside the `--json` document on stdout, and
  called on both exit paths.
- Four selftest assertions driving the shipping `declareExit`. The load-bearing one is exit 3: without
  the declaration the undeclared-code rule would soften a real REGRESSION into not-evidence.

**Not touched:** `engine/quarantine.js`, `tests/**`, `engine/medicham2-browser.js`, `data/tags.json`,
`data/register-reality.json`, `docs/ROADMAP.md`.

---

## 6. SHOWN RED FIRST

The knob is not a description of the old behaviour, it is the old behaviour:

```
$ RR_CANNOT_ANSWER_AS_RED=1 node engine/register_reality.js --selftest
  FAIL RED — an UNDECLARED exit outside {0,1} is NOT a verdict. This is #224 and #241 exactly...
       got {"green":false,"kind":"LEGACY-ANY-NONZERO-IS-RED","why":"exit 2 ..."}
  FAIL RED — a DECLARED refusal is not a verdict either...
  FAIL RED — a declaration is read off stderr as well as stdout...
  FAIL RED — a declaration naming a DIFFERENT exit code does not apply to this one
  FAIL RED — runUncached READS the failed child stdio and classifies off it...
  ... 11 failed
REGISTER-REALITY SELFTEST: 40 passed, 11 failed        exit 1
```

```
$ node engine/register_reality.js --selftest
REGISTER-REALITY SELFTEST: 51 passed, 0 failed         exit 0

$ node engine/gate_fail_and_silent.js --selftest
FAIL-AND-SILENT GATE SELFTEST: 23 passed, 0 failed     exit 0

$ node tests/test-register-reality-readonly.js
REGISTER-REALITY READ-ONLY: 10 passed, 0 failed        exit 0
  ok  this test itself left data/register-reality.json as it found it (bytes exactly; mtime to the ms)
```

One assertion in the new block is a measurement of **Node**, not of this repo, because everything
else rests on it: `execFileSync` attaches the child's stdout to the error object on a non-zero exit.
It is asserted against a real 40 ms child rather than assumed.

`git status` at the end of this pass shows `engine/register_reality.js` and
`engine/gate_fail_and_silent.js` modified and **nothing else of mine**;
`data/register-reality.json` is not in the list.

---

## 7. RESIDUALS I AM NOT FIXING, NAMED RATHER THAN LEFT

1. **`openDefectClause`'s sentence is now inaccurate for these rows.** It prints *"name an
   instrument that WOULD NOT RUN"*. `gate_fail_and_silent.js` ran perfectly well and declined to
   answer. The bucket is right; the sentence is false. Fixing it means editing `engine/quarantine.js`,
   which light mode forbids me from RUNNING — and landing an unverified edit in the file that
   computes the MEDICHAM gate is worse than the wording.
2. **Should an OPEN row whose instrument REFUSED make the clause `ok: false`?** `orderProbeClause`
   in the same file already does exactly that (`ok: false, cannot_answer: true`) on the same
   reasoning — *a clause that cannot be computed FAILS*. I believe that is the right end state: the
   gate stays shut, but for the honest reason instead of on a fictitious red. Same blocker as (1).
3. **`register_reality.js:145`'s `!green`** is still there, still shadowed by the `null` branch above
   it. Rewriting it to `green === false` is a one-character-class change I did not make, because it
   is currently unreachable and I would rather it be named in a row than silently altered in a pass
   about something else.
4. **`data/register-reality.json` remains stale** (`generated 2026-08-22T01:55:12.569Z`, ~26 h older
   than the engine) and was deliberately not refreshed. It must run only after the differential and
   the roster stages, and running it now would republish stale verdicts under a new timestamp and
   destroy the evidence for this very finding.

## 7a. The provenance of the verdict artifact — asked, and answered NO

`data/register-reality.json` carries `generated, by, what, why, weaker_than_it_looks, counts,
instrument_owed, results, unverifiable_open_defects`. **No `engine_release`. No `source_digests`.**
`engine/provenance.js` can therefore only judge it on MTIME, and `data/provenance-stamp.json` lists
it in `mtime_only_files` — one of **172**.

**It does not deserve its own row.** It is already a member of a DERIVED, ratcheted class that is
printed on every provenance run; a new row would be a hand-typed duplicate of a computed list, which
is the exact thing the register-reality work exists to stop.

**What it does deserve is a position in that queue, and it should be at the front**, for a reason
none of the other 171 share: this is the only mtime-only artifact that is read as a **gate input** and
whose job is to adjudicate the provenance of other rows. An artifact with weaker provenance than the
artifacts it judges is the ruler problem one level up. Say that inside whichever row owns the
mtime-only ratchet rather than opening a new one.

---

## 8. PROPOSED REGISTER ROWS (not landed — the coordinator lands these)

**Row A — the defect, fixed this pass.**

```
| #NNN | **A GATE THAT COULD NOT ANSWER WAS PUBLISHED AS A GATE THAT FOUND A DEFECT — FOUND AND FIXED
2026-08-23 BY MEASURE.** `engine/register_reality.js`'s `runUncached()` read ANY non-zero exit as
`green: false`, and in this file `green: false` is a MEASURED RED: `verdict()` turns it into
CONFIRMED — *"the row and the world agree"* — on an open row and into PREMATURE CLOSE, an accusation
against whoever closed it, on a closed one, and `openDefectClause` in `engine/quarantine.js` turns it
into `withRed`, which is what holds the MEDICHAM gate clause shut. **MEASURED ON THE PRE-FIX BYTES:
`engine/gate_offfield_target.js` (#224) and `engine/gate_fail_and_silent.js` (#241) BOTH exit 2
today**, both printing `CANNOT ANSWER` — #224 because every artifact it reads was measured against
other bytes, #241 because its artifact ran on release `c66976713feb` against a tree of `33d871e6db92`
and its sample moved as well. **Neither gate had a finding. Both were being published as red evidence
of a live engine defect**, which is a gate reporting something untrue in the direction that gets
gates ignored (#148), arriving through the RULER rather than the engine. **THE FIX IS A CLASS, NOT
`status === 2`.** Exit 0 is GREEN and exit 1 is RED — the universal conventions — and **any other
non-zero code is NOT a verdict unless the instrument declares it**, on the way out, in one
line-anchored machine-readable line (`ABRA-EXIT 2 CANNOT-ANSWER`, `ABRA-EXIT 3 VERDICT-RED`).
Uppercase and hyphenated for the reason `VERIFIED BY:` is: `gate_offfield_target.js` prints the
legend `[0 clean, 1 the placeholder is back, 2 cannot answer]` on EVERY run including its green ones,
so a tolerant search for those words would have called every clean run a refusal — #148's own
prescription. **THE CLASS-SAFETY IS DEMONSTRATED, NOT CLAIMED: `gate_offfield_target.js` WAS NOT
EDITED** and stops being published as red anyway, via the undeclared-code rule. What it CANNOT catch
is a refusal spelled as exit 1 with no declaration — irreducible, stated in the gate's own header,
and counted as `exit_codes_undeclared` so the coverage can be driven down rather than assumed zero.
`verdict()`'s null case now splits three ways (INSTRUMENT UNRUNNABLE / INSTRUMENT CANNOT ANSWER /
EXIT CODE UNDECLARED), all three BAD so the tool still exits 1. **SHOWN RED FIRST**:
`RR_CANNOT_ANSWER_AS_RED=1` restores the pre-fix behaviour exactly and fails 11 assertions by name;
clean it is 51/51. **CONSEQUENCE STATED PLAINLY: #241 leaves `withRed`.** The clause does not open —
#258 is OPEN and its instrument was measured at exit 1 today — but a refusal no longer holds the gate
shut, which is the point. `data/register-reality.json` was NOT regenerated (see #NNN+1).
VERIFIED BY: `node engine/register_reality.js --selftest` | CLOSED 2026-08-23 — MEASURE |
```

**Row B — the ripple, owed.**

```
| #NNN | **"WHAT DOES THIS EXIT CODE MEAN" IS DECIDED IN TWO FILES, AND THE OPEN-DEFECT CLAUSE NOW
SAYS SOMETHING FALSE ABOUT THE ROWS IT BUCKETS — MEASURED 2026-08-23 BY MEASURE, NOT FIXED.**
`tests/run-all.js` has always treated exit 2 as *"I COULD NOT RUN, NOT I FAILED"* for every script it
runs, generically and in those words; `engine/register_reality.js` treated the same code as a red
verdict until 2026-08-23. Two files deciding one fact, disagreeing, both continuing to work — and
they still each own a copy. **THREE THINGS ARE OWED AND NONE WAS DONE, EACH FOR A STATED REASON.**
(1) `openDefectClause` prints *"open row(s) name an instrument that WOULD NOT RUN"* over a bucket
that now also holds instruments which RAN and declared CANNOT-ANSWER. The bucket is right and the
sentence is false. (2) **An OPEN row whose instrument REFUSED probably ought to make the clause
`ok: false, cannot_answer: true`**, exactly as `orderProbeClause` already does in the same file on
the same reasoning — *a clause that cannot be computed FAILS* — so the gate stays shut for the honest
reason rather than on a fictitious red. As it stands, such a row moves to `unrunnable` and stops
holding the clause shut at all. (3) The classifier should be ONE implementation both callers use.
**WHY NOT NOW**: (1) and (2) are edits to `engine/quarantine.js`, which the pass that found this was
forbidden to RUN, and an unverified edit to the file that computes the MEDICHAM gate is worse than
the wording; (3) needs either an edit to `tests/run-all.js` (forbidden that pass; ENGINE was live in
`tests/`) or making `engine/register_reality.js` requirable, which today would WRITE its artifact on
require. Note for whoever takes (3): `run-all.js` FAILs on exit 3 and `gate_fail_and_silent.js` uses
exit 3 for REGRESSION — that stays red only because the gate now declares `ABRA-EXIT 3 VERDICT-RED`.
Also unreached and left alone: `register_reality.js`'s `if (row.closed && !green)` is a real `!green`
collapse, currently shadowed by the `green === null` branch above it. Account:
`docs/_reports/2026-08-23-cannot-answer-vs-red.md`
| open — instrument DEFECT (MEASURE) |
```

---

## 9. OWED, NOT RUN — the exact commands

None of these were run in this pass, and none of their numbers are quoted anywhere above.

```bash
# 1. The verdict artifact is 26 h stale and MUST NOT be refreshed until the differential and the
#    roster stages have settled. This is the run that publishes the fix's effect on #224 and #241.
node engine/register_reality.js

# 2. The clause this changes. Read AFTER (1), never before — before, it reads the old verdicts.
node engine/quarantine.js
node engine/status.js
node engine/status.js --write

# 3. #218's instrument: its exit code TODAY is unknown and is not guessed at anywhere above.
node engine/quarantine.js --whole-game

# 4. The suite, once ENGINE is off tests/ and medicham2-browser.js.
node tests/run-all.js
node tests/run-all.js --coverage

# 5. Only if someone unifies the classifier (Row B item 3) — this is the pair that must agree.
node tests/run-all.js          # exit 2 -> SKIP
node engine/register_reality.js
```

Everything in §1, §2 and §6 above was measured on 2026-08-23 with the commands shown beside it.
