# Dead counters — read-only audit (MEASURE, 2026-09-04)

Scope: `node engine/sweep.js` §4's claim that 784 of 1,048 counter fields are incremented and never
read. Derived independently; nothing here is relayed from sweep's output. No repository file was
written except this one. No game was played, no fit run, no process killed.

**Read discipline.** `engine/medicham2-browser.js`, `engine/game_differential.js` and
`engine/side_selection_census.js` were being written by a live ENGINE agent throughout (mtimes
15:39–15:49 against a 16:00 clock). The primary corpus is therefore a materialised snapshot of
`HEAD` = `3072a919201c0e34c52bcec78a5705abf0cade93` (504 tracked `.js` files under
`engine/ tests/ build/ tools/ web/ app/`), taken once. Every `file:line` below is a HEAD line. The
live tree was scanned once, separately, only to measure drift.

---

## 1. Do I agree with 784?

**Yes — the count is right and it is a moving target.**

Sweep's §4 rule was re-implemented line for line (`scratchpad/sweepemu.js`) and run against three
corpora, then the same question was asked again with a completely different comment/string stripper
(a single-pass lexer that handles regex literals and preserves `${}` interpolations, rather than two
sequential regexes):

| corpus | method | unread / total | objects |
|---|---|---|---|
| sweep's own published run, earlier today | sweep | **784 / 1,048** | 16 of 46 |
| HEAD `3072a919` | sweep's rule, re-implemented | **774 / 1,068** | 17 of 47 |
| live tree, 2026-09-04 ~16:05 | sweep's rule, re-implemented | **770 / 1,075** | 17 of 47 |
| live tree, same instant | my lexer | **768 / 1,077** | 17 of 47 |

Two independent strippers differ by **2 fields out of ~1,075**. Sweep's method is sound. The
784 → 770 movement is the ENGINE agent editing `medicham2-browser.js` under the instrument, not a
method error: §4 scans the live tree and pins nothing, so its headline changes hourly. *Anything
that publishes this number must pin the tree.*

The two fields the strippers disagree on are the known limit: sweep's `stripStrings` blanks template
literals whole, so a counter read only inside `` `${c.drainedIntoSwitch || 0}` `` looks unread.
`engine/rollout_switch_probe.js:243` is exactly that.

### The shape, printed before anything was asked of it

Sweep counts *fields it saw incremented*. The declared shape is larger:

| object | declared fields | source lines | `++`/`+=` | assign-only | never written |
|---|---|---|---|---|---|
| `MEDSEEN` | **685** | `medicham2-browser.js:90–2389` | 654 | 24 | 7 |
| `MEDFAILS` | **494** | `medicham2-browser.js:2390–3796` | 241 | 246 | 7 |

1,179 declared fields; sweep's 1,075 is the increment-visible subset. No duplicate keys in either
literal. `MEDFAILS` is half **assignment-only** — 246 of its fields are `*First` example strings and
`*Restored` knob stamps, not tallies. Sweep's rule cannot see them and should not: they are
diagnostics attached to a counter, not counters.

**Two of my own probes were wrong first, in the direction the brief warned about.** The first inert
scan called `MEDSEEN.volatileSwitchNames` and `MEDFAILS.unmodelledClickBy` dead; both are non-scalar
counters written by `.push()` and `[id]=(…||0)+1`, and both are read by tests. A later probe returned
**zero occurrences for all fourteen candidates** — perfectly uniform, and perfectly wrong: `strip()`
was defined inside an `eval` in strict mode and every call threw `ReferenceError` into a bare
`catch (e) {}`. The all-clear was produced by the failure. Both are recorded here because the
corrected numbers below depend on the corrections.

---

## 2. The split by purpose

`MEDSEEN` and `MEDFAILS` are **739 of the 770**. Everything else is 31 fields in 15 objects — and
those 31 are the consequential ones.

### `MEDSEEN.*` — what HAPPENED (the capability-proof class)

685 fields. What proves each one today:

| class | count |
|---|---|
| **PROVEN BY NAME** — a test or probe reads it (`test-mechanics.js`, `test-switch-carry.js`, 14 others) | 33 |
| **PROVEN BY RUN** — moved in a `million-run*.json` artifact; no named reader | 134 |
| **NEVER PROVEN** — existed 2026-08-11, did **not move once in 150,000 games**, no reader | **124** |
| **UNMEASURED** — added after the last million-run; never been through one | 363 |
| assignment-only (`*First` strings, max-trackers) | 24 |
| declared, never written by any shape | 7 |

### `MEDFAILS.*` — what WENT WRONG

494 fields; 5 read by name outside the engine. 118 existed on 2026-08-11 and never fired in 150,000
games; 118 postdate that run entirely.

**The two are not interchangeable and the code mixes them.** `MEDFAILS.roostRiderNoPrimary` is
incremented at `medicham2-browser.js:29386`; the field `roostRiderNoPrimary: 0` is declared at
line 2232, which is inside the **`MEDSEEN`** literal. So `MEDSEEN.roostRiderNoPrimary` sits at 0
forever and `MEDFAILS.roostRiderNoPrimary` is `NaN` — the brief's "compares `undefined` to 0 and can
never go red", in the tree, today.

Also: 48 `MEDFAILS.*Restored` fields are written by assignment while undeclared. That is
**deliberate and correct** — `tests/probe_mega_trace_entry.js:371` uses
`hasOwnProperty(M.MEDFAILS,'megaTraceLate')`, so absent-when-clean is the signal. Not a defect;
listed so a future sweep does not accuse it.

### The 31 non-MEDSEEN fields — what they are

They are not capability counters at all. They are **failure counters inside the instruments**: the
gate, the pin guard, the leaf, the census, three probes. That is why they rank above the 739.

### The reader classes that matter

A field is not binary read/unread. Three states, and only the first can turn a run red:

- **ASSERTED** — something can fail on it.
- **PRINTED** — `console.log`. `docs/_reports` on the `1 of 2` line already records what a printed
  warning inside a long output is worth. `engine/game_differential.js:8055-8056` prints
  `STANDING_FAILS` with the words *"a UNKNOWN above is a FAILURE, not an absence"* and changes no
  exit code.
- **BLIND TO ZERO** — the generic reader exists and structurally cannot report the thing the
  founding rule asks for. See §3.

---

## 3. RANKED BY CONSEQUENCE

### TIER 1 — counters that are structurally incapable of proving anything (4 fields)

`undefined++` is `NaN`, and `NaN++` stays `NaN`. Four increments target a field their object does
not declare:

| counter | increment | state |
|---|---|---|
| `MEDSEEN.retaliateWhenLowered` | `medicham2-browser.js:16885` | **NaN, with a published receipt** |
| `MEDSEEN.retaliateSourceUnknown` | `:16873` | NaN if the branch is ever reached |
| `MEDFAILS.roostRiderNoPrimary` | `:29386` (declared at `:2232`, in `MEDSEEN`) | NaN |
| `MEDFAILS.volatileCuredByNonBerry` | `:17583` | NaN |

**This is not a hypothesis.** `data/million-run.json` and `data/million-run-150k.json` both carry

```
"retaliateWhenLowered": null
```

which is `JSON.stringify(NaN)`. The capability *did* fire — WIRE 138, the `boostsWhenLowered`
retaliation family, called from four sites (`:16877`, `:17007`, `:26353`, `:28591`, `:33873`) — and
its counter recorded nothing on either run. A `=== 0` zero-check passes on it forever.

`retaliateWhenLowered` is also the **only** non-finite value in either artifact, so this class is
exactly four fields and nothing is hiding behind it.

### TIER 2 — a failure counter in an INSTRUMENT with no reader of any kind (10 fields)

Verified occurrence by occurrence, comments and strings stripped. Every one of these has exactly two
appearances in the tree — its declaration and its increment.

| # | counter | site | why it ranks |
|---|---|---|---|
| 1 | **`PIN_COUNTERS.wrong_release`** | `engine/pin_guard.js:184` | see below |
| 2 | `STATS.speedFallbacks` | `engine/position_features.js:292,294` | the speed-estimate bare-catch fallback, in the position feature vector |
| 3 | `FALLEN_GUARD.noRecord` | `engine/rollout_leaf.js:466` | the leaf's fallen-count guard skips a board and says nothing |
| 4 | `SEED_COUNTERS.streakFromCaller` | `engine/rollout_leaf.js:380` | which side seeded the Protect streak |
| 5 | `SWITCH_COUNTERS.noBench` | `engine/rollout_leaf.js:859` | rollouts declined a switch because no bench existed |
| 6 | `VOL_DUR_COUNTERS.lookupThrew` | `engine/magnemite.js:198` | the volatile-duration table — CLAUDE.md's own opening example of this failure |
| 7 | `STATE_PLAN.receipts_failed` | `engine/all_mechanics_fire.js:2985` | the census's board-state plan |
| 8 | `STATE_PLAN.pairs_searched` | `engine/all_mechanics_fire.js:2906` | " |
| 9 | `MOVE_THEN_WHAT_SEEN.unstageable` | `engine/all_mechanics_fire.js:1158` | a staged scenario that could not be staged |
| 10 | `THEN_WHAT_SEEN.unstageable` | `engine/all_mechanics_fire.js:1986` | " |

**#1 is the finding of this audit, and it is MEASURE's own file.**

`engine/quarantine.js:4137-4142` is a self-test whose comment states the founding rule verbatim —
*"a capability that cannot prove it ran is assumed broken … the counters are asserted to have MOVED
on each distinct branch"* — and then asserts on five branches:

```js
PIN.PIN_COUNTERS.checked > 0 && PIN.PIN_COUNTERS.no_release > 0
&& PIN.PIN_COUNTERS.no_digests > 0 && PIN.PIN_COUNTERS.population > 0
&& PIN.PIN_COUNTERS.no_receipt > 0
```

`PIN_COUNTERS` has **six** refusal counters. The omitted one is `wrong_release`
(`pin_guard.js:184`), which fires on `cur && p.id !== cur` — *the artifact was measured against a
different engine release*. That is the branch behind the `PRE-CHANGE` problem, behind LESSONS §12's
168-of-200 stranded releases, and behind the whole reason `pin_guard.js` exists. It is the one
refusal path no test proves can fire, and nothing anywhere reads its counter.

Not accused: `SWITCH_COUNTERS.drainedIntoSwitch` (read at `rollout_switch_probe.js:243`),
`VOL_DUR_COUNTERS.callbackThrew` (read at `seed_source_audit.js:262`), `STANDING_FAILS.*` (each
increment is followed by a `console.error` at the site and the object is printed at
`game_differential.js:8055`), `SKIPPED` in `probe_multihit_update.js` (goes **RED** at `:269-273` if
every candidate skips). Sweep flags all of these; on inspection they are printed or asserted. Three
of them were flagged because a **same-named local variable** elsewhere is what sweep's global-name
`READ` set is testing against — `noBench` in `tests/test-mechanics.js:3404` clears
`SWITCH_COUNTERS.noBench` without touching it.

### TIER 3 — the 124 MEDSEEN capabilities nothing has ever seen fire

124 fields existed on 2026-08-11, went through **150,000 games** in
`data/million-run-150k.json`, moved **zero times**, and have no named reader. Among them:
`transformReverted` (CLAUDE.md's 2026-08-08 list names "a transform never reverts" as a known
defect), `attractApplied` and its four refusal siblings, `perishTicked` / `perishKO` /
`perishClearedOnSwitch`, `shedShellEscapedTrap`, `forcedSwitchRefused`, `hpShared`,
`allySwitchSwapped` / `allySwitchStalled`, `friendGuardChain`, `uproarWokeSleeper`.

**Stated honestly: this is not proof they are broken.** `engine/million_run.js` runs `--team 4` — one
fixed team — so a zero there means *not exercised by that team*. The correct claim is the founding
rule's own: nothing in this repository has ever established that these fire. And the reason nobody
noticed is structural, not human —

### The generic reader exists and is BLIND TO ZERO by construction

`engine/million_run.js:1241-1242`:

```js
const seenDelta = {};
for (const k of Object.keys(M.MEDSEEN)) if (M.MEDSEEN[k] !== (seen0[k] || 0)) seenDelta[k] = M.MEDSEEN[k] - (seen0[k] || 0);
```

Every key is walked, and **only the keys that MOVED are kept.** A counter that stayed at zero is
silently omitted. The one output the founding rule asks for — *the run prints it and a zero is
called out* — is the one output this cannot produce. `instrumentChecks()` at `:1269` then reads
exactly **two** names by hard-coded literal (`counters.flinch`, `counters.secondaryVolatileApplied`)
and its predicate is `ok: !(counter > 0 && n === 0)` — a zero counter can never make it red.

And the artifact it writes is already declared dead by the repo itself.
`data/artifact-accessors.json` → `deliberately_undeclared` →
`million-run.json:engine_counters`: **"DEAD TABLE — nothing reads it."** That declaration is
correct, dated 2026-09-04, and is unexecuted knowledge in exactly sweep.js's sense.

### Where the founding rule IS enforced, so the gap can be sized

`tests/test-wiring.js` — the file CLAUDE.md names — plays real games and asserts non-zero on
**seven** capabilities, by scraping labels out of `mew.js`'s stderr: `policy=score`, `aiming`,
`open team sheets`, `mega evolution`, `team preview`, `joint layer`, plus a mega *rate* floor. It
reads no `MEDSEEN` field. **Seven enforced instances against 1,179 declared engine counter fields.**
The 784 is a symptom of that ratio, not the disease.

---

## 4. How many are simply DEAD? — eight

Verified: name appears exactly once in the whole tree (its declaration), no computed-key path can
reach it, no `.push`, no sub-key assign.

| field | note |
|---|---|
| `MEDSEEN.statusReaimedToSlot` | `:29571` says *"subsumed by `MEDSEEN.reaimedToSlot`"* — a duplicate, superseded in writing |
| `MEDFAILS.magicGuardChip` | `:410` says *"It replaces `MEDFAILS.magicGuardChip`"* — superseded |
| `MEDFAILS.symbiosisLineShort` | `:9749` describes it in the past tense; the emitter no longer stops short |
| `MEDSEEN.sealFailAnnounced` | declaration only |
| `MEDSEEN.groundedByVolatile` | documented at `:2191`, never wired |
| `MEDFAILS.drainNoPerTargetRows` + `…First` | declaration only |
| `MEDFAILS.ripenBerryBoostUnmodelled` | `:10111` says it *"must now read 0 in a run with a Ripen holder in it"* — it is not written anywhere, so it reads 0 unconditionally. A stated check the code cannot perform |

**Eight of 1,179. Mass deletion is not on the table** — that is 0.7%, and deleting them buys
tidiness, not truth. `MEDSEEN.sideGuardChosenVsPriority` and `…VsSpread` look identical to these and
are alive: they are reached through `MEDSEEN[_row.chosen]++` at `:14898`, where `chosen` is a string
literal in `GUARD_PRED` (`:5966`). Six such computed-key increments exist tree-wide and **neither
sweep nor a name grep can see any of them.**

A ninth candidate is not dead but misfiled: `MEDSEEN.roostRiderNoPrimary` (Tier 1) — the declaration
belongs in `MEDFAILS`.

---

## 5. The proposed mechanism — one, and it is small

**Not 784 readers.** The affordable unit is the **object** (47 of them), not the field (1,077), in
the exact shape `data/artifact-accessors.json` + `tests/test-artifact-keys.js` already ship. Three
clauses, in decreasing strength:

**(a) INITIALISED-OR-GUARDED — no judgement, no registry, catches Tier 1.**
Every `OBJ.field++` / `+=` where `OBJ` is a literal-declared capitalised object must have `field` in
that literal, or use the `(x || 0) + 1` guard `test-no-silent-failure.js` already recognises.
Violations today: **4**, all named above. Purely structural: it catches a second instance spelled
differently, in any file, including one written on a different object by mistake — which is exactly
how `roostRiderNoPrimary` arrived. Fully derived, nothing typed, no exemption list. ~40 lines.

**(b) EVERY COUNTER OBJECT DECLARES ITS READER.**
`data/counter-readers.json`, keyed `<file>:<OBJ>`, each entry naming one of:
`named:<file>:<line>` · `generic:<file>:<line>` · `artifact:<data/x.json>:<key>` ·
`disposition` + `why` (the `deliberately_undeclared` shape, which already exists and already carries
the honest "DEAD TABLE" answer for `engine_counters`). A **new** counter object fails until somebody
answers the question — the property that makes `test-artifact-keys.js` worth having. 47 entries; the
30 clean ones are one line each.

**(c) A GENERIC READER MUST SAY WHETHER A ZERO IS VISIBLE.**
`zero_visible: true|false` on any `generic:` or `artifact:` entry. `false` means the object may not
be cited as capability proof. `million_run.js`'s `seenDelta` is `false` and would say so. This clause
is a **declaration, not a derivation**, and is only as good as the person writing it — the same
weakness `artifact-accessors.json` already states on its own head. It is here because the alternative
is deriving "does this reader filter to non-zero", which is not decidable by grep.

**Would it catch a second instance through another door?** (a) yes, unconditionally. (b) yes for a
new object, no for a new *field* on an old object — that is the stated limit, and the reason (a) is
first. (c) no; it records a judgement.

**Cost.** `test-artifact-keys.js` walks every `data/*.json` in 733 ms; a source scan of 506 files ran
in ~3 s here including the 2.9 MB engine. Registry: minutes for 30 objects, real judgement for the 17
with dead fields. **~1 session, no run, no refit.**

### And the cheap thing that should come first

**Two lines in `million_run.js`.** Alongside `engine_counters: seenDelta`, write
`engine_counters_zero: Object.keys(M.MEDSEEN).filter(k => !seenDelta[k])`. That converts Tier 3 from
539 unknowns into a *measured list of capabilities that did not fire*, at the cost of one run of an
instrument that already exists and already walks every key. It also fixes the blind-to-zero defect at
its source rather than downstream. Without it, clause (b)'s judgements for `MEDSEEN` cannot be made
honestly — there is no evidence to judge on. It is `engine/million_run.js`, so it is not MEASURE's
file to edit.

---

## 6. `tests/test-no-silent-failure.js` accepting `++` — leave it

**It should not change, and changing it would break a working ratchet to ask the wrong question.**

That file asks *"does this catch block discard the reason?"* An increment on a named, exported
failure counter genuinely is the reason being recorded — it is not silent. The file has been
corrected **four separate times** for firing on code that did what it asked (`fail(`,
`process.stderr.write`, `.message`, `(x||0)+1`), each correction carrying the same sentence: *a
ratchet that flags code for doing what it asked is how a ratchet gets ignored*. Withdrawing `++`
would reverse all four at once.

What would break, concretely: the baseline is a monotone ratchet keyed by a hash of the catch body,
and `--update` writes `min(baseline, current)`. Widening the detector cannot be absorbed by
`--update` — every newly-"silent" block would have to go through `--accept` one at a time with a
written reason, which is the 62-block exercise of 2026-08-23 repeated for a question the file was
never asking. Meanwhile the gate sits red, and "pre-existing" starts doing the work "known failure"
used to.

The missing question — *does anything READ the counter* — is a different question about a different
object at a different scope, and it belongs in clause (b) above. Conflating them costs a working
gate and answers neither well.

One narrow tightening **is** in its spirit and is offered rather than assumed: an increment counts as
recording only if the target field is initialised. That is clause (a), and putting it in (a) rather
than here keeps it out of the ratchet's baseline.

---

## 7. Not found, stated so it is not re-derived

- **No test reads a counter that nothing writes.** All 35 externally-read `MEDSEEN` fields and all
  11 `MEDFAILS` fields have a writer of some shape. The "green test asking nothing" hazard is not
  present in this class.
- **No duplicate keys** in either object literal.
- **`engine/all_mechanics_fire.js` does not read `MEDSEEN` or `MEDFAILS` at all.** The census proves
  a mechanic fired from the PROTOCOL; it is a genuinely independent instrument and cannot substitute
  for a counter, in either direction.
- **Debris, reported and left** (per the standing rule — nothing was deleted): 46 `data/_*.json`
  scratch artifacts dated 2026-08-18 to 2026-09-04 (`_diag77-*`, `_fire-*`, `_r220-*`, `_void-*`,
  `_turncap-*`, `_bench-*`, `_pair-pilot`, `_scratch-*`). Untracked and not mine to judge.

---

# OWED

1. **Declare `MEDSEEN.retaliateWhenLowered`, `MEDSEEN.retaliateSourceUnknown` and
   `MEDFAILS.volatileCuredByNonBerry`; move `roostRiderNoPrimary`'s declaration from the `MEDSEEN`
   literal to `MEDFAILS`.** Four lines in `engine/medicham2-browser.js` — **ENGINE**, not MEASURE.
   Every WIRE 138 count published to date is `null`.
2. **Add `wrong_release` to the pin-guard branch assertion at `engine/quarantine.js:4141`, and give
   that branch a red proof.** MEASURE owns `pin_guard.js`; this is the highest-consequence single
   line in the audit and it is ours.
3. **Clause (a), `tests/test-counter-init.js`** — increments must target a declared or `||0`-guarded
   field. Red on the four above before it is trusted. MEASURE. ~40 lines.
4. **`engine_counters_zero` in `engine/million_run.js`** (two lines, ENGINE/OPS call) plus one run,
   so Tier 3's 539 unknowns become a measured list. Nothing else makes clause (b) honest for
   `MEDSEEN`.
5. **`data/counter-readers.json` + clause (b)/(c)** once #4 has produced evidence. 47 entries.
   MEASURE.
6. **Delete the eight dead fields in §4.** ENGINE's file; a fix, not a cleanup — three of them are
   superseded duplicates whose comments already say so, and `ripenBerryBoostUnmodelled` currently
   documents a check the code cannot perform.
7. **Pin sweep §4's tree.** The headline moved 784 → 774 → 770 inside one afternoon because the
   section scans a live tree during an ENGINE session. It should read a release or record the HEAD
   it scanned. MEASURE.
8. **Not owed, and stated so it is not re-opened:** `tests/test-no-silent-failure.js`'s `++` rule
   stays as it is (§6).
