# The five register rows holding the "no open, known engine defect" clause shut

MEASURE, 2026-08-23 evening / 2026-08-24 UTC. Historical record — not current state, not a living
document, never cite it as one. The rows themselves are the record; this is the working.

Constraint under which this was taken: an ENGINE agent was live restructuring faint announcements
and owned `engine/`, `tests/`, `docs/ENGINE.md`, `CHANGELOG.md` and the release cuts. This pass
owned `docs/ROADMAP.md` and this file, wrote no CHANGELOG entry, committed nothing, and did not run
`game_differential.js`, `tests/roster.js`, `all_mechanics_fire.js`, `tests/test-engine-diff.js`,
`tests/test-mechanics.js`, `quarantine.js` as a command, `status.js --write`, or
`register_reality.js --list`.

---

## 0. The trap first: the verdict artifact is older than the tree, and all five verdicts are in it

`data/register-reality.json` is stamped `generated: 2026-08-23T11:48:06.048Z` — 07:48 local. Every
input the five rows depend on moved AFTER that:

| file | local mtime | which rows it decides |
|---|---|---|
| `engine/medicham2-browser.js` | 2026-08-23 20:33 | all five, transitively |
| `tests/test-no-silent-failure.js` | 2026-08-23 19:59 | the silent-catch row's own instrument |
| `data/silent-catch-baseline.json` | 2026-08-23 20:00 | the silent-catch row's floor |
| `engine/gate_fail_and_silent.js` | 2026-08-23 19:10 | the silent-`-fail` row's own instrument |
| `data/game-differential.json` | 2026-08-23 20:54 | whole-game, off-field body, silent-`-fail` |
| `data/engine-release.json` | 2026-08-23 20:57 | the #298 "other bytes" refusal on two gates |

So **all five verdicts in the artifact rest on a stale reading, not on evidence about today's tree.**
Two of the five were materially wrong when re-taken; two survived re-measurement; one could not be
taken at all this session.

That distinction is the finding the brief asked about, and it holds — but it does not mean the clause
is being held shut by bookkeeping alone. Three of the five are red on evidence taken tonight.

**One of the five verdicts is worse than stale — it is hollow.** The artifact records the red-demo
harness at `ms: 4980, exit 1, kind: VERDICT-RED`. A complete run of that instrument on the current
tree takes ~25 s and prints 200 demonstrations, and `register_reality.js` sets a ten-minute child
timeout, so 4.98 s is an instrument that stopped early. It exits 1 on a throw exactly as it exits 1
on a failure, and the file declares no `ABRA-EXIT` line, so `classifyExit` cannot tell them apart —
which is the refusal-spelled-as-a-red the row's own last paragraph said it could not rule out.

---

## 1. The whole-game differential — LEAVE OPEN, measurement OWED

**Instrument:** `node engine/quarantine.js --whole-game`. **NOT RUN** — banned this session.
No verdict was taken and none is published.

Read out of the artifact WITHOUT the clause, and labelled as an artifact field rather than as the
gate's answer:

- `data/game-differential.json`, generated **2026-08-24T00:54:34Z**, release **`3929459bb195`**,
  **961 games**, team store pinned to `data/team-pool-frozen` digest `0d103fb9fa87`, census pinned at
  digest **`9446a684709d`** / 643 rows (`matches_live: false`; the census SELECTS the sample by the
  artifact's own `steering.rule`).
- Top-level `diverged` = **57 of 961 RAW** on the primary `middle` arm. Other arms: top-tie-first 52,
  bottom-tie-first 58.
- The **undeclared** rate is NOT in the artifact. The declared subtraction lives inside
  `wholeGameClause`; nothing on disk carries it. No undeclared figure is stated here rather than a
  second implementation of the clause being written to produce one.

**The 39.6% in the row's title is 480 of 1,213 RAW on release `5a557b07821c`, 2026-08-12.** Raw
against raw is the same quantity; it is still not a trend — different release, different pin corner,
different census, different pool, and two runs on different censuses do not play the same games.
**No delta is claimed.**

The figure the brief carried in (undeclared 53/961 = 5.5% on release `3e00ea2575a9`) had already been
superseded when this pass started: a newer differential landed at 20:54 local on release
`3929459bb195`. That is not a correction of the brief; it is how fast this artifact moves.

**A genuinely new fact, and it makes one sentence in the row stale.** The row says *"this run measured
protocol only — `state_mode` is `false` and `end_state` is `null`, so no count in it supports a claim
about board-materiality."* The current artifact carries `state_mode: true` and `end_state_mode: true`
and publishes the board-material quantity Will's 2026-08-22 call named:

```
middle arm      SAME-END-STATE 943   DIFFERENT-END-STATE 18   ENDED-APART 0   THREW 0
                protocol parted 57   protocol never parted 904
of the 57 parted   SAME 40   DIFFERENT 17
of the 904 never-parted   SAME 903   DIFFERENT 1
by shape (parted)  EMISSION 27 games / 7 different, ORDERING 12 / 2, RULE 10 / 3, FIELD 8 / 5
```

Those are the artifact's own fields. **18 of 961 = 1.9% board-material** is what an end-state
comparison on this run says; it is NOT the gate's verdict, because the gate was not run.

---

## 2. A moved effect naming a body that is not on the field — LEAVE OPEN, red on evidence

**Instrument:** `node engine/gate_offfield_target.js`. **RUN. Exit 1 — LIVE.**

On 2026-08-22 this gate was deliberately NOT run, because the artifact was release `13ba05093aa3`
while the release pointer had moved on, so the gate would have refused the artifact under its own
#298 rule rather than answering. Tonight the engine was quiet, `data/engine-release.json` read
`3929459bb195`, and the differential is stamped with that same release — so the refusal does not
apply and the gate COUNTS.

```
tree release  3929459bb195
COUNTED   data/game-differential.json   release 3929459bb195   generated 2026-08-24T00:54:34.629Z
          `??:` occurrences 7   traceBodyOffField 10
NOT COUNTED (other bytes)   data/divergence-turns.json   release 6a05dd9ad60d
exit 1
```

Both arms fire: 7 literal `??:` in the artifact text, and the engine's own counter at the emitting
site at 10 — the stronger arm, because it fires whether or not a protocol line survived to be written
down. The 2026-08-22 figures (4 and one `??:`) are another sample, not a before. **The claim is true
and it rests on evidence taken tonight.**

---

## 3. A `-fail` the authority emits and this engine does not — LEAVE OPEN, red on evidence

**Instrument:** `node engine/gate_fail_and_silent.js`. **RUN. Exit 1 — LIVE.**

```
artifact  data/game-differential.json   2026-08-24T00:54:34.629Z   release 3929459bb195
pin       30   [census 2e3953f1f882 / pool 631d4ea60a80 / 995 games]
this run  census 9446a684709d / pool 0d103fb9fa87 / 961 games  -> A DIFFERENT SAMPLE
LIVE   2 cause(s) over 2 game(s)
  1  event missing from medicham2 :: |-fail|p1a <> |move|p2b|roleplay
  1  event missing from medicham2 :: |-fail|p2b <> |move|p1a|curse
```

The clause is green only at zero, so two holds it red. **30 causes / 51 games → 2 / 2 is NOT a
before/after** — the gate itself withholds a REGRESSION verdict because the census and pool digests
differ from the pin, which is the instrument doing exactly what it was rebuilt on 2026-08-18 to do.
What the run establishes is that the class survives on today's engine, and that both survivors now
name a CLICK (Role Play, Curse) rather than an upkeep.

---

## 4. Silent catch blocks — CLOSE, proven by the row's own instrument

**Instrument:** `node tests/test-no-silent-failure.js`. **RUN. Exit 0.**

```
files scanned            393
catch blocks             885
silent (say nothing)     257   of 885  (29%)
  of those, MANUFACTURE  82
  merely skip/continue   175
baselined                201   <- the ratchet floor, set 2026-08-18
accepted after review    62    <- under 58 body keys, each with a written reason
FIXED since the baseline 6
NEW since the baseline   0
6 baselined block(s) now speak.
```

**How it went green is stated rather than left to be inferred**, because this row exists about a gate
that sat red for a week while three correct reports called it pre-existing. 18 blocks were REPAIRED
(80 → 62); the remaining 62 were each read in source context and signed off one at a time — 38
already report the failure, 14 cannot fail, 10 are correct silence — through `--accept`, the gate's
own reviewed door, which refuses to run without a file and a written reason.

**Nothing was laundered.** The floor was not lowered, `--update` was not run, and the acceptances are
keyed by a hash of the catch body, so editing any accepted block re-fails the gate by name.

**Declared residue, which is not a defect and may not hold a gate:** 6 baselined blocks now speak, so
the floor is 6 higher than it needs to be. That is a free ratchet gain for whoever next owns those
files, not this row, and `--update` was deliberately left un-run because those files belong to ENGINE.

**Scope of the close:** this is a verdict on the tree at ~2026-08-24T01:05Z. The scan reads `engine/`,
`build/` and `tests/`, and ENGINE was live in two of the three. A silent block landing after that
moment arrives as NEW and re-reds the gate — which is the gate working, not this close failing.

`quarantine.roadmapRowIsClosed` was used to confirm the edited status cell reads CLOSED. No second
detector was written.

---

## 5. The red-demo harness — LEAVE OPEN, re-scoped, and it is TWO defects

**Instrument:** `node tests/probe_red_demo.js`. **RUN on release `3929459bb195`, engine byte-unchanged
across the run (mtime bracketed before and after). Exit 1.**

```
200 demonstrations, 14 failed
12 of those are STALE REVERSALS
```

**The 12 are the instrument defect this row owns**, and they are the row's own predicted residue
arriving on schedule — an anchor that is a literal source string goes stale on the next wire:

- Tailwind speeding the partner up inside the same turn (dynamic speed)
- the SLOWER entry weather setter owning the field across both sides
- the attack-site roll knowing who it is aimed at
- a sound move and an Infiltrator going through the doll
- a second Substitute costing nothing
- the turn re-sorting around the new Speed the mega brought
- a blocked High Jump Kick still paying its crash
- a FAILED Protect resetting the counter
- Protean giving the move it converts into its STAB
- a MISS naming its targets and an impossible move still writing `-fail`
- the Life Orb toll refused by a move that MISSED
- a frozen body clicking a PIVOT move being refused

**One of the twelve is a different and worse shape.** The MISS row's patch APPLIED and produced an
engine that cannot play a turn — `_mvMissed is not defined`. That reversal is not merely un-aimed;
the code around its anchor has moved out from under it.

**The other 2 failures are NOT instrument defects.** Both read `shipped-arm=false (must be true)` — so
the SHIPPED engine fails the assertion — and both reverted arms read false too, so the knob is not
being watched either:

```
FAIL  ROADMAP #81 WIRE 4  a spread move takes x0.75 rounded half up on 4096ths, not a truncation
FAIL  ROADMAP #81 WIRE 4  Life Orb is chainModify([5324,4096]), not Math.floor(d * 1.3)
```

Both are in the DAMAGE pipeline. **No mechanism is claimed here** — whether the engine regressed or
those two fixtures went stale in a way that reports FAIL rather than STALE was not diagnosed. Life Orb
was one of four ENGINE landings on 2026-08-23, which is a lead and not a diagnosis. These want an
ENGINE row of their own; an instrument row is the wrong home for a live damage defect, and MEASURE
does not edit engine files.

Two rows read `N/A` (`aurabreak`, `transistor` — no legal carrier in the regulation). That is the
oracle answering, not a demonstration skipped.

---

## 6. Can the clause open? No.

Three of the five are red on evidence taken tonight against the current tree — the off-field body,
the silent `-fail`, and the red-demo harness. One (silent catch blocks) is closed on its own green
instrument. One (whole-game) was not measured at all.

**What the clause waits on:**

1. the off-field placeholder actually going to zero on both arms (counter 10, `??:` 7 today);
2. the silent-`-fail` class going to zero (2 causes / 2 games today);
3. the red-demo harness going green — which now needs BOTH the 12 anchors re-aimed AND the two WIRE 4
   damage failures resolved;
4. a whole-game verdict from a session allowed to run `quarantine.js --whole-game`.

Nothing here was closed in order to make the clause pass. The one row that closed did so on a green
exit code from the instrument the row itself names.

## 7. OWED, NOT RUN

| owed | why it was not done |
|---|---|
| `node engine/quarantine.js --whole-game` | banned this session; the whole-game headline is therefore unmeasured, not measured-and-withheld |
| `node engine/register_reality.js` (a full run — **never `--list`**) | every one of its 39 verdicts is older than the engine; it plays boards, so it needs a session allowed to |
| re-run of `tests/test-no-silent-failure.js` after ENGINE's current batch lands | the close is a verdict on the tree at 01:05Z and ENGINE was live |
| diagnosis of the two WIRE 4 damage failures (spread 0.75 rounding, Life Orb chainModify) | ENGINE's files; engine-regression vs stale-fixture is undetermined and wants its own register row |
| re-aiming the 12 stale reversals in `tests/probe_red_demo.js` | ENGINE-held file while ENGINE was live in it |
| lowering the silent-catch floor by the 6 blocks that now speak (`--update`) | those blocks are in ENGINE-held files; a free ratchet gain, deliberately left |
| `node engine/status.js` full gate recomputation | it calls the banned clause internally |

## 8. What was touched

- `docs/ROADMAP.md` — the five rows, each given a dated re-verdict paragraph and a corrected status
  cell. Verified with `quarantine.roadmapRowIsClosed` (imported, not re-implemented);
  `tests/test-roadmap-register.js` 3 passed / 0 failed and `tests/test-docs-current.js` 23 passed /
  0 failed after the edit.
- this file.
- Nothing else. No commit, no CHANGELOG entry, no generated block rewritten.
