# Clearing three of the four failing gate clauses — two stale re-runs and ROADMAP #376

MEASURE, 2026-09-08. Full account. The verdict is at the top; everything under it is the evidence,
the sample lines and the caveats.

---

## VERDICT

- **The gate went from 4 of 9 failing to 1 of 9.** The only failing clause is now
  `whole-game differential / NARRATION` at **52 of 961**, exactly as predicted before the run.
- **Both stale clauses reproduced their expected readings.** `data/engine-diff.json` re-ran
  **6000 compared / 6000 agreed / 0 disagreed**, clean at all 16 arms; `data/all-mechanics-fire.json`
  reproduced its pre-cut artifact **field for field** with only the release stamps, the wall-clock
  seconds and the roster cross-reference moving. Neither was a surprise, so neither is a finding.
- **ROADMAP #376 is CLOSED, on evidence taken on the current release.** The discriminator the row
  itself specified reads **100.0%, 112 of 112**, with a ramped-tie control at **2 of 112** that
  reproduces the row's exact cause shape — so the instrument could have seen a difference.
- **BOARD-MATERIAL is untouched at 0 of 958.** `data/game-differential.json` was not re-run and not
  rewritten in this pass (mtime unchanged at 2026-09-08T22:34Z).
- **One thing is stale and is reported rather than fixed:** `data/register-reality.json` was
  generated 2026-09-08T16:34Z, before the mid-turn re-sort fix. The `no open, known engine defect`
  clause is clean because #376 is closed in the register, **not** because those 123 verdicts were
  re-taken on the current bytes.

---

## 1. What the gate read before

```
MEDICHAM is not correct — 4 of 9 gate clauses fail (game differential; whole-game differential /
NARRATION — protocol divergence with no board effect; mechanics / each one staged and compared
against showdown; no open, known engine defect)
```

Two of those four were stale because the mid-turn re-sort fix cut a new release: both artifacts had
run on `7f012a9afe01` and the tree was `f6f44b329132`. The release id was read from
`data/engine-release.json` (`current: f6f44b329132`, cut 2026-09-08T21:44:45Z, latest cut
22:30:20Z), which agrees with the newest directory under `data/releases/`. `engine_release.js list`
was not parsed.

## 2. JOB 1a — the damage differential

**Expected before the run:** 0 of 6000, and the artifact otherwise identical.

**Sample line, verbatim, flags included:**

```
cmd.exe /c "tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804"
```

`SHOWDOWN_PATH` was not set explicitly: `engine/showdown_path.js` resolves the sibling checkout
`C:/Users/willj/Projects/Pokemon/pokemon-showdown` and sets the variable for the process. This
harness takes no `--release` — it reads the LIVE tree on purpose, because it is the instrument that
says whether the engine is right, and it stamps `engine_release.liveStamp()` at the END of the run.
`--out` was not passed, so the run published to `data/engine-diff.json` through
`engine/publish_guard.js`; at `--n 6000` against a published 6000 there is no shrink to refuse.

**Reading:**

| | value |
|---|---|
| compared / agreed / disagreed | **6000 / 6000 / 0** |
| arms | top, bottom and idx01–idx14 — **0 of 6000 each**, 16 arms |
| `band_missing` | 0 |
| accuracy conformance | 500 compared, 0 disagree, 0 unknown |
| accuracy-modifier conformance | 13 handlers against 14 rows, 0 disagree |
| substitute-bypass conformance | 51 carried, 0 missing, 0 extra |
| release | `7f012a9afe01` → **`f6f44b329132`** |

Diffed field-for-field against the pre-run copy, ignoring `generated`, the three release stamps and
`source_digests`: **IDENTICAL**. The one moved source digest is
`engine/medicham2-browser.js  fbbd41673b32 → f4bf09c1b934`, which is the re-sort fix and is why the
re-measurement was owed.

## 3. JOB 1b — every mechanic staged against Showdown

**Expected before the run:** the previous artifact reproduced field for field with only the release
stamp moving.

**Sample line, verbatim, flags included:**

```
cmd.exe /c "tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release f6f44b329132"
```

`--release` is required for this to be a measurement rather than a smoke run — the file says so on
every run, and the flag pins BOTH the driver's frozen engine and this file's. `--state` is forced
onto argv by the script itself and is announced. The arm is not a flag: `all_mechanics_fire.js`
looks up `bottom-tie-first` in `game_differential.js` and exits 2 if it is gone. No `--limit`, no
`--only`, no `--trailing` (so `trailing_turns_forced: 0`, the same sample as the pre-cut run), no
`--out`, no `--red`.

**Reading:**

| | pre-cut | this run |
|---|---|---|
| moves exist / resolved / diverged / resolution disagreements | 500 / 495 / 4 / 11 | **500 / 495 / 4 / 11** |
| abilities exist / fired / diverged | 316 / 104 / 1 | **316 / 104 / 1** |
| items exist / fired / diverged | 148 / 64 / 0 | **148 / 64 / 0** |
| games played / threw / sheets unassembled | 1313 / 0 / 0 | **1313 / 0 / 0** |
| release | `7f012a9afe01` | **`f6f44b329132`** |

A recursive diff of the whole artifact finds **five** differing leaves and no others:

```
summary.moves.seconds                       45   -> 5.3
summary.abilities.seconds                   12   -> 9.6
summary.items.seconds                       5.6  -> 4.6
overlap.items.exemption.roster_release      7f012a9afe01 -> f6f44b329132
overlap.items.exemption.roster_generated    2026-09-08T20:20:37Z -> 2026-09-08T22:38:15Z
```

Three wall-clock timings and one cross-reference to `data/roster.items.json`, which was itself re-cut
on the new release at 22:38Z. **Every measured field is byte-identical.** That is the strongest
reading available here: a release cut whose engine change does not touch these mechanics should
reproduce the measurement exactly, and it did.

## 4. JOB 2 — ROADMAP #376, disposition: CLOSED

### 4.1 The instrument, verified rather than taken on report

```
cmd.exe /c "tools\lownode.cmd engine\quarantine.js --order-probe"     ->  exit 0

PASS  turn order / no unequal-speed pair at identical priority (ROADMAP #290)
  clean by absence: 961 games produced NO move-vs-move ordering pair to probe. That is a fact
  about the pool, not a demonstration that the turn order is right.
```

It passed `PIN.guard`, so the artifact it read — `data/game-differential.json`, generated
2026-09-08T22:34:13Z — is on release `f6f44b329132`, this tree. **The green is by ABSENCE, and that
is not what closes the row.** The pool no longer stages a move-vs-move ordering pair at all, which is
a fact about the pool.

### 4.2 The three causes are gone from the sample — walked, not read off a headline

`data/game-differential.json`, release `f6f44b329132`, `state.games` 958, generated
2026-09-08T22:34:13Z. Walking `classes[].causes[]`: **54 causes, 13 of them in the `ordering`
class.** Not one of the 13 is a `|move|`-vs-`|move|` Protect or Detect pair. The five causes anywhere
in the artifact that mention Protect are one `-activate|protect` vs a `|move|`, three
`-activate|protect` vs `-immune`, and one `quickclaw` vs `|move|protect` — none of them this row's
shape, all of them `n=1`.

### 4.3 The row's OWN discriminator, re-run on the current release

The row wrote its own settling test: *"stage two bodies at identical `getActionSpeed()` both clicking
Protect across N seeds and count agreement — about 50% is the tie device, 0% is an inverted
alignment, 100% means these three are something else."* ENGINE built it as
`tests/probe_protect_tie_order.js` and ran it on `1415f271058e`. **MEASURE re-ran it on the current
release** so the closure does not rest on superseded bytes:

```
cmd.exe /c "tools\lownode.cmd tests\probe_protect_tie_order.js --n 400 --release f6f44b329132"

  release f6f44b329132, arm middle, showdown shuffle = no-op, arrangements 112
  census 886d47cf7fef, 830 rows — identical to the live census

  112 AGREE, 0 DISAGREE on turn order, out of 112 scored
  0 fixture, 0 threw, 0 diverged for a DIFFERENT reason
  AGREEMENT = 100.0%   (112/112)

  CONTROL — the same arrangements with medicham2's `tie` stream on a RAMP:
    2 AGREE, 110 DISAGREE out of 112 scored
    THE KNOB REACHED THE RULE
```

The control is the load-bearing half. Under the ramp the disagreements are **exactly this row's cause
shape** — `ordering :: |move|<slot>|protect <> |move|<slot>|protect`, including the same-side pair —
so the probe can manufacture #376's three causes on demand, and with the shipped tie rule it
manufactures none. Every tie is verified off the authority's own `getActionSpeed()` before a choice
is made; an arrangement whose two bodies do not come back EQUAL is filed as FIXTURE and excluded, and
it read **0 fixtures**.

### 4.4 The Garchomp `[still]` caveat

The row cautions that at most 2 of the 3 causes are tie-only, because the second pair's authority
line shows a Protect that FAILED. That individual game is in no current sample and **cannot be
re-measured**; it is neither confirmed nor refuted here, and this closure does not claim otherwise.
What is measured is the mechanism the caveat names: **112 of 112 arrangements produced a FAILED
Protect, all of them on turn 2**, where the consecutive-use `StallMove` counter is the only thing
that can refuse one — and all 112 agree.

### 4.5 What the closure does NOT rest on

**The retracted reading is not restored.** This row is not closed on *"a tie is a coin flip, so no
engine edit can make a coin land twice"*, which was withdrawn on 2026-08-24 as true of the GAME and
false of THIS HARNESS. The closure runs the opposite way: `pinShuffle` is a no-op in every shipped
arm and the middle arm hands medicham2 `o.tie = () => 0`, so **both devices are pinned and a tie MUST
resolve identically** — and measured on the current bytes it does, 112 times out of 112.

Will's card-2 ruling is untouched: the harness spread ladder stays as it is, so the
harness-manufactured ties remain in the sample and the `ordering` class keeps its weight. They simply
agree now.

### 4.6 The red the instrument carried before was a different pair

On `1415f271058e` the probe was red on `ordering :: |move|p2a|closecombat <> |move|p2b|tailwind`,
speed gap **286**, same priority — an UNEQUAL-speed disagreement, which is #290's clause and not
#376's. It closed with the mid-turn re-sort fix (commit `064db221`) and is absent from
`f6f44b329132`.

### 4.7 Why CLOSED and not RE-SCOPED

Re-scoping is the right call when part of the row is still open. Nothing in it is:

- the tie-device explanation is measured false, on the current release, with a working control;
- the three causes are absent from the current pinned run;
- the instrument the row names exits 0 on that release;
- the one decision the row said was owed from Will — card 2, priority — **was ruled on 2026-08-24**;
- the `[still]` caveat is unmeasurable in principle (the game is gone) and its mechanism is measured
  agreeing, so it is recorded in the closure rather than carried as an open scope.

The row keeps its `VERIFIED BY: node engine/quarantine.js --order-probe` line, so
`engine/register_reality.js` still runs the instrument against it and will report a **PREMATURE
CLOSE** if it ever goes red again.

## 5. JOB 3 — what the gate reads now, verbatim

```
MEDICHAM is not correct — 1 of 9 gate clauses fail (whole-game differential / NARRATION — protocol
divergence with no board effect)
```

Clause by clause:

```
PASS  game differential              clean at BOTH corners of the damage roll: midpoint 0 of 6000,
                                     top 0/6000, bottom 0/6000, idx01..idx14 0/6000 (seed 20260804)
PASS  deliberate roster / items      clean: 142 of 148 tested
PASS  deliberate roster / abilities  clean: 139 of 202 tested
PASS  deliberate roster / moves      clean: 487 of 500 tested
PASS  coverage / every used mechanic is measured by something
PASS  whole-game differential / BOARD-MATERIAL   0 of 958 games
FAIL  whole-game differential / NARRATION        52 of 961 = 5.4%, across 51 cause(s)
PASS  mechanics / each one staged and compared against showdown   5 diverge, 1 declared,
                                     4 below the reach shelf, 0 cleared on decision impact, leaving 0
PASS  no open, known engine defect   clean: no open row names an instrument that is RED
                                     (123 verdict(s) read)
```

`provenance` moved **35 possibly stale / 34 ok → 33 possibly stale / 36 ok**; 184 unsafe and 2 void
(declared) are unchanged.

## 6. Known reds, confirmed and deliberately not touched

Each was re-run this pass to check the claim still stands. None was fixed.

| check | reading | exit |
|---|---|---|
| `tests/test-docs-quarantine.js` | 1 check failed — a captioned `51.0%` | 1 |
| `tests/test-pinch-family.js` | 1 of 61 failed | 1 |
| `tests/test-quality.js` | 1 of 31 — *clean share is stable: 31.3% now vs 28.0% recorded (drift 3.3 pts, tolerance 3). Store has grown 67384 → 76833* | 1 |
| `status.js` FEATURE SEMANTICS on `data/policy-weights.json` | fixture identity + damage table gates fired; MAG's refit edge | printed, not a gate |

## 7. Owed, and stated rather than filed

- **`data/register-reality.json` is 6.5 h old** (generated 2026-09-08T16:34:05Z, HEAD
  `97d7b3894ab6`) and predates the mid-turn re-sort fix. The `no open, known engine defect` clause is
  clean because #376 is closed in the register; the other 122 verdicts in that artifact were taken on
  older bytes. Refreshing it means `node engine/register_reality.js`, which runs 73 distinct
  commands and rewrites the artifact — not run here, and it was not in the brief.
- **`data/provenance-stamp.json` was already modified** in the working tree when this pass began
  (`verified: 3 → 7`, generated 22:36Z → 23:03Z), by a provenance run from an earlier session. Left
  as found.
- **`data/published-samples.json`** moved as a side effect of the engine-diff publish guard.
- **Two untracked files** sit in the tree and are not mine: `tests/probe_midturn_herb_resort.js` and
  `data/verification/_prediction-2026-09-08-gap-286-ordering.json`. Reported, left alone.

## 8. What this pass did not measure

- **No whole-game differential run was taken.** `data/game-differential.json` is unchanged at
  2026-09-08T22:34Z and BOARD-MATERIAL stays 0 of 958 on the artifact that produced it. The NARRATION
  figure of 52 of 961 is read from that same artifact and is not this pass's measurement.
- **The census was not regenerated.** `data/mechanics-census.json` is unchanged (830 rows, digest
  `886d47cf7fef`, identical to the live census as reported by the tie probe), so the mechanics re-run
  is steered by the same rows as the pre-cut run — which is what makes it a before/after at all.
- **No engine file was edited.** `engine/medicham2-browser.js` and `data/policy-weights.json` were
  not touched.
