# Counter fixes — the four NaN fields, `wrong_release`, and clause (a) (ENGINE, 2026-09-04)

Acts on `docs/_reports/2026-09-04-dead-counters-audit.md` OWED #1, #2 and #3. Nothing was committed,
no game was played, no fit or self-play was run, no process was killed, no file was deleted.

Every claim below was produced by running something on this tree. Where a number is quoted from the
audit rather than re-derived, it says so.

---

## 1. TIER 1 — the four `NaN` counters are declared, and they now record a number

`undefined++` is `NaN` and `NaN++` stays `NaN`, so an increment aimed at a field its object never
declared is a counter that can never be zero and can never be non-zero. Four existed. All four are in
`engine/medicham2-browser.js`.

| counter | was | now |
|---|---|---|
| `MEDSEEN.retaliateWhenLowered` | incremented at `:16885`, never declared | declared beside `reflectSourceUnknown` |
| `MEDSEEN.retaliateSourceUnknown` | incremented at `:16873`, never declared | declared on the same line |
| `MEDFAILS.volatileCuredByNonBerry` | incremented at `:17583`, never declared | declared in the `MEDFAILS` literal |
| `MEDFAILS.roostRiderNoPrimary` | incremented at `:29386`, **declared inside the `MEDSEEN` literal** | declaration MOVED into `MEDFAILS`, with a comment left where it was |

No `|| 0` was added at any increment site. The audit's point was ownership, and a guard at the call
site hides which object owns the counter.

`roostRiderNoPrimary` was the two-broken-counters case: `MEDSEEN.roostRiderNoPrimary` read `0` forever
whatever the engine did, and `MEDFAILS.roostRiderNoPrimary` was `NaN`. Each looked like the other's
proof. `MEDSEEN` counts what HAPPENED; `MEDFAILS` counts what WENT WRONG, and "the step-4 gate had
nothing to read" is the second thing.

### The receipt, measured rather than argued

WIRE 138 staged on a real body through `applyIntimidate`, with the ability as the knob:

```
CONTROL (ability=none): boosts.at=-1  delta=0  counter=0
ARM     (defiant)     : boosts.at=+1  delta=1  counter=1
as published: {"retaliateWhenLowered":1,"retaliateSourceUnknown":1}
```

And the knob cleared explicitly — the declaration deleted at run time, same arm:

```
DECLARATION REMOVED: boosts.at=1  counter=NaN  as published={"retaliateWhenLowered":null}
```

`null` is exactly what `data/million-run.json` and `data/million-run-150k.json` both carry. The
mechanic fired in both cases; only the counter differs. That is the whole defect, reproduced and
closed.

`grep` on today's tree confirms the shape, comments and strings blanked: `retaliateWhenLowered` 8 code
occurrences, `retaliateSourceUnknown` 2, `volatileCuredByNonBerry` 2, `roostRiderNoPrimary` 2 (now
both on `MEDFAILS`).

**Two documentation lines in `docs/ENGINE.md` (`:2050`, `:19483`) describe these two counters as
working. They were `NaN` when those lines were written. They are true now; the lines were not edited —
another agent is writing that file (mtime 11 minutes before this run).**

---

## 2. `PIN_COUNTERS.wrong_release` is now asserted

`engine/quarantine.js`'s §5b is a self-test whose own comment quotes the founding rule — *"a
capability that cannot prove it ran is assumed broken … the counters are asserted to have MOVED on
each distinct branch"* — and it named five of `PIN_COUNTERS`' six refusal branches. The omitted one
was `wrong_release`, the branch that fires when an artifact was measured against a DIFFERENT ENGINE
RELEASE.

Two changes:

- **A new §3b** hands `mechanicsClause` a fully-stamped artifact whose `cur` id differs by one field
  from the `mOk` arm directly above it, asserts the refusal names both ids, and asserts
  `wrong_release` moved by **exactly one on that call** — so the counter §5b reads is attributable.
- **§5b's list is now DERIVED from `Object.keys(PIN_COUNTERS)`** rather than typed. A hand-typed list
  is how the sixth branch came to be omitted; typing a sixth name would leave a seventh exactly as
  exposed. `unreadable` is added lazily by `readJson` and only ever appears already non-zero, so it
  cannot go red by existing.

**Correction to the audit, stated because I wrote the looser version into the code first and then
measured it.** The audit says this was "the one refusal path no test proves can fire". The BRANCH was
already driven in-process: `quarantine.js:4010` hands the differential clause an artifact stamped
`__not-this-tree__` and asserts the refusal. What did not exist was any **reader of the counter**, so
nothing could tell "this branch fired" from "this branch is unreachable". The comment in the file now
says that, not the stronger thing.

- green: `QUARANTINE SELFTEST: 218 passed, 0 failed` (was 216 before the two new arms)
- red, knob cleared: setting §3b's `cur` back to `rel-fixture` gives `216 passed, 2 failed`

**Live confirmation this branch matters:** `node engine/status.js` right now withholds the game
differential, all three roster stages and the mechanics clause, every one of them through
`wrong_release` — *"ran on release 8ad06030e129 and the tree is 252025cfcddc"*.

---

## 3. Clause (a) — `tests/test-counter-init.js`, shown RED on all four before the fix

The rule, and it is a PROPERTY with no registry and no by-name list:

> For every capitalised object declared in a file as a non-empty object literal, every `OBJ.field++`,
> `+=`, `--` and `-=` in that file must name a field the literal declares.

The `(x || 0) + 1` idiom is an assignment, not an increment, so it is structurally safe and needs no
exemption. It is discovered by `run-all.js`'s `tests/test-*.js` glob, so it is in the suite without a
registration line.

**Measured before it was wired** (LESSONS §4 — every derivation over-matches on the first try):
507 files, 602 capitalised object literals, 3,604 declared keys, and **exactly four violations, all
four the ones the audit names**. Zero false positives, so nothing is exempted by name. Two independent
cross-checks with the audit fell out of the same scan: 6 computed-key increments tree-wide, and
`MEDSEEN[…]` at the `GUARD_PRED` site.

RED, before any engine edit:

```
  FAIL every increment on a declared counter object names a field that object declares — 4 do not
       engine/medicham2-browser.js:16873  MEDSEEN.retaliateSourceUnknown++  is NaN — MEDSEEN's literal (:68, 690 keys) has no 'retaliateSourceUnknown'
       engine/medicham2-browser.js:16885  MEDSEEN.retaliateWhenLowered++    is NaN
       engine/medicham2-browser.js:17583  MEDFAILS.volatileCuredByNonBerry++ is NaN — MEDFAILS's literal (:2405, 501 keys) has no 'volatileCuredByNonBerry'
       engine/medicham2-browser.js:29386  MEDFAILS.roostRiderNoPrimary++     is NaN
COUNTER INIT TESTS: 3 passed, 1 failed          (exit 1)
```

GREEN after: `COUNTER INIT TESTS: 4 passed, 0 failed`, 3,607 declared keys (+4 declared, −1 moved off
`MEDSEEN`).

Three things it does on every run so silence is never read as "checked and fine":

- **PART 1 runs the detector on a synthetic source** carrying one undeclared increment beside four
  things that look like one (a declared increment, an empty-literal object, a `|| 0` guarded
  assignment, the same name in a comment and in a string). It fails if they are not separated, and it
  asserts the reported LINE NUMBER — the stripper preserves newlines, so every line it prints is real.
  A detector that cannot go red is the thing this file guards against.
- **It asserts the scan reached real source.** No hand-typed floor; zero is the only value that means
  the instrument is dead.
- **It names what is outside its reach** rather than dropping it: 6 computed-key increments (the key
  is a value; undecidable by any scan) and 0 nested ones.

**Its stated limit:** a cross-file increment (`M.MEDSEEN.field++` in a test against the engine's
export) resolves its declaration in another file and is not checked. That is clause (a)'s boundary,
not an oversight.

`tests/test-no-silent-failure.js` was NOT touched. It asks a different question and has been corrected
four times for exactly this over-reach.

---

## 4. TIER 2 — decided one at a time, not mass-wired

Three wired, each shown red on a deliberate break. Five are audit corrections: the counter DOES reach
a published artifact, by a route a name grep cannot see. Two are declared unread in the source, with
the reason, because the honest value is not known to be zero.

| # | counter | disposition | evidence |
|---|---|---|---|
| 1 | `PIN_COUNTERS.wrong_release` | **WIRED** | §2 above |
| 2 | `STATS.speedFallbacks` (`position_features.js`) | **WIRED** | below |
| 6 | `VOL_DUR_COUNTERS.lookupThrew` (`magnemite.js`) | **WIRED in the test only** | below |
| 5 | `SWITCH_COUNTERS.noBench` | **already read — artifact** | `data/rollout-switch-probe.json` carries `noBench: 4381` on the `switch_only` arm, via `counters_cumulative` |
| 7 | `STATE_PLAN.receipts_failed` | **already read — artifact** | `data/all-mechanics-fire.json` → `summary.board_state.receipts_failed = 1` |
| 8 | `STATE_PLAN.pairs_searched` | **already read — artifact** | same block, `= 1393` |
| 9 | `MOVE_THEN_WHAT_SEEN.unstageable` | **already read — artifact** | `summary.moves.leaf_effect.unstageable = 0` |
| 10 | `THEN_WHAT_SEEN.unstageable` | **already read — artifact** | `summary.then_what.unstageable = 10` |
| 3 | `FALLEN_GUARD.noRecord` | **DECLARED unread, with a reason, in the source** | below |
| 4 | `SEED_COUNTERS.streakFromCaller` | **DECLARED unread, with a reason, in the source** | below |

### The five corrections, and why the audit missed them

`Object.assign({}, OBJ)` carries every field into an artifact **without naming any of them**. That is
the same blind spot as the computed-key increments the audit itself flags: the audit's test was "this
name appears exactly twice in the tree", which is true of all five and does not mean what it looks
like. `receipts_failed: 1` is a real recorded failure sitting in a published artifact that no printed
line surfaces — that is worth someone's attention, but it is an unread-by-a-HUMAN problem, not an
unread-by-anything one.

### `STATS.speedFallbacks` — a stated check the code could not perform

`position_features.js:271` says *"Read it, do not just trust it"* and *"Exported as STATS so a caller
or a test can assert it stayed at zero"*. Nothing did: three appearances in the whole tree, the
declaration and two increments. Same shape as `MEDFAILS.ripenBerryBoostUnmodelled`. What it guards is
real — the catch substitutes RAW `st.sp`, dropping Choice Scarf, Tailwind, paralysis and the weather
Speed abilities, which is precisely the bug §1 of `test-engine-consistency.js` proves is fixed.

**Wiring the obvious `speedFallbacks === 0` assertion would have been worse than nothing** — it is
green whether the guarded path ran or not. So `STATS` gained one declared field, `movesFirstCalls`,
and `tests/test-engine-consistency.js` §6 asserts the PAIR. Measured: `positionFeatures` is called 6
times by that file and reaches `movesFirst` **12** times, so the zero is evidence.

- green: `movesFirstCalls 12`, `speedFallbacks 0`, all checks passed
- red: `effSpeed` made to throw only while `position_features` is running → `speedFallbacks 22`,
  `2 FAILED`, exit 1

### `VOL_DUR_COUNTERS.lookupThrew` — CLAUDE.md's own opening example, inside the guard against it

`magnemite.js:198`'s own comment: *"a registry lookup that starts throwing would empty this table one
key at a time and every duration would quietly become the fallback 3 — the exact shape of the
2026-07-31 defect."* Its four siblings are asserted in `tests/test-seed-clock.js:956` and
`callbackThrew` in `engine/seed_source_audit.js`; this one had no reader anywhere.

**`engine/magnemite.js` was NOT edited** — it is on ENGINE's may-not list. The reader is one arm in
`tests/test-seed-clock.js`, which is the file that already asserts the other four. It is not blind to
zero: `legalMoves === LEGAL_N` two arms above proves the walk ran, and `durOf` runs once per condition
on that walk.

- green: `0 of 56 keys`, `135 passed, 0 failed`
- red: `conditions.get` made to throw only for calls originating in `magnemite.js` → `2344 threw —
  first: appleacid`, `128 passed, 7 failed`

### The two declared unread

`FALLEN_GUARD.noRecord` counts the pairs the guard SKIPPED because the board kept no graveyard for
that side — the size of the hole in `checked`, which `checked > 0` cannot see.
`SEED_COUNTERS.streakFromCaller` is a legitimate fallback path (the caller typed a streak the board
had no record of). **Neither was given a `=== 0` arm**, because a board with no graveyard and a
caller-supplied streak are both legitimate shapes and nobody has measured what the honest value is. An
arm on a guessed number is the over-firing gate ROADMAP #148 is about. Both now carry a comment at
their declaration saying they are unread, why, and what a rise would be evidence for.

---

## 5. What was NOT done, deliberately

- **The 8 dead fields are still there.** Re-verified on today's tree with the same lexer: each of
  `statusReaimedToSlot`, `magicGuardChip`, `symbiosisLineShort`, `sealFailAnnounced`,
  `groundedByVolatile`, `drainNoPerTargetRows`, `ripenBerryBoostUnmodelled` has **exactly one code
  occurrence** — its declaration. Deletion is a separate, deliberate act. The ninth candidate,
  `MEDSEEN.roostRiderNoPrimary`, is resolved: it was misfiled, not dead.
- **No `data/counter-readers.json`.** It needs `engine_counters_zero` measured first, or its entries
  are guesses.
- **No change to `tests/test-no-silent-failure.js`.**
- **`data/mechanics-census.json` was NOT regenerated** and `node engine/status.js --write` was NOT
  run. The census reads **live 829, probed 829, missing 0, hollow 0** and is untouched by this work:
  every engine edit adds a declared key to an object literal or a comment, and cannot alter behaviour.
  `--write` was skipped because `docs/ENGINE.md` and `docs/MEASURE.md` were modified 10 and 11 minutes
  before this run by other agents, and `--write` rewrites the generated block in all five ledgers.
- **`docs/ENGINE.md` was not edited**, same reason. No mechanic was landed, so no hand-list item is
  owed removal.

## 6. Debris, reported and left

The working tree carries in-flight changes from the previous ENGINE session that are **not mine and
were not touched**: `engine/game_differential.js`, the confusion-self-hit and Defog-sweep work inside
`engine/medicham2-browser.js`, `tests/probe_confusion_selfhit_address.js`,
`tests/probe_defog_target_side.js`, `docs/_reports/2026-09-04-unverifiable-breakage-triage.md`,
`data/game-diff.json`, `data/open-work.json`.

`node engine/status.js` also prints a **FEATURE SEMANTICS CHECK FAILED** banner before its report:
the fixture changed (scenarios 10 → 12) and the damage table was regenerated (318 → 322 species). That
is MEASURE's refit call, untouched here and reported so it is not mistaken for something this pass
caused.

---

## Files changed

| file | change |
|---|---|
| `engine/medicham2-browser.js` | 4 declarations (2 added to `MEDSEEN`, 2 to `MEDFAILS`, 1 removed from `MEDSEEN`) + comments |
| `engine/quarantine.js` | §3b (2 new arms) + §5b's branch list derived instead of typed |
| `engine/position_features.js` | `STATS.movesFirstCalls` declared and incremented |
| `engine/rollout_leaf.js` | 2 comments declaring `noRecord` and `streakFromCaller` unread, with reasons |
| `tests/test-counter-init.js` | NEW — clause (a) |
| `tests/test-engine-consistency.js` | §6, 2 arms on `position_features.STATS` |
| `tests/test-seed-clock.js` | 1 arm on `VOL_DUR_COUNTERS.lookupThrew` |

Green on this tree: `test-counter-init` 4/0 · `quarantine --selftest` 218/0 · `test-engine-consistency`
all passed · `test-seed-clock` 135/0 · `test-rollout-fallen` 43/0 · `test-no-silent-failure` no new
silent failures.

---

# OWED

1. **Regenerate the census and run `node engine/status.js --write`** once the other `docs/` agents are
   done. Not run here: two ledgers were being written during this session and `--write` restamps all
   five. Census is `live 829` and this work cannot have moved it.
2. **`engine_counters_zero` in `engine/million_run.js`** (audit OWED #4), plus one run. Until it
   exists, Tier 3's 124-plus never-proven `MEDSEEN` capabilities stay unknowns rather than a measured
   list, and clause (b) cannot be answered honestly for `MEDSEEN`.
3. **`FALLEN_GUARD.noRecord` and `SEED_COUNTERS.streakFromCaller` need a MEASURED expectation**, not a
   guessed one. Both are declared unread in the source with that reason. Whoever measures a rollout
   run should read them once and then either assert or delete.
4. **`STATE_PLAN.receipts_failed = 1` is a recorded failure nothing prints.** The census artifact
   carries it; `all_mechanics_fire.js:3862`'s BOARD-STATE line prints `rows`, `planned`, `unplanned`
   and `capped` and omits it. One term on an existing `console.log`. ENGINE, next pass.
5. **`data/counter-readers.json` + clauses (b)/(c)** (audit OWED #5), after #2.
6. **Delete the 8 dead fields** (audit OWED #6). Re-verified as still exactly one occurrence each.
7. **Pin `sweep.js` §4's tree** (audit OWED #7). Its headline still moves hourly during an ENGINE
   session.
8. **The two `docs/ENGINE.md` lines at `:2050` and `:19483`** describe `volatileCuredByNonBerry` and
   `roostRiderNoPrimary` as working counters. They are true as of this pass; the file was left alone
   because another agent held it.
