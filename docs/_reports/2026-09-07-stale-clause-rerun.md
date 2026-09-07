# 2026-09-07 — re-running the four stale gate clauses on current bytes

**Division:** MEASURE. **Author:** measure agent. **Do not cite as current state** — this is a dated
findings record. The gate is `node engine/status.js`.

## Why

Board-material reached ZERO on release `1be57a100d59`. Four clauses of the MEDICHAM gate were
answering on release `c28ad0815782` — an answer about other bytes, not a weaker answer. This pass
re-runs them on the current release so the true picture is visible. **Nothing was adjusted to make a
stage green.**

## Pins for every run in this document

| pin | value |
|---|---|
| engine release | `1be57a100d59` (from `data/engine-release.json`, `current`) |
| cut | 2026-09-07T20:44:46.729Z — "batch N: a split smartTarget volley is resolved one body at a time" |
| working tree at start | clean except `data/provenance-stamp.json`, rewritten by `status.js` itself |
| git HEAD | `0105db72` |
| `SHOWDOWN_PATH` | resolved by `engine/showdown_path.js` (sibling checkout); the `SHOWDOWN_PATH=...` prefix in the gate's printed commands is decoration |

## THE GATE BEFORE — verbatim from `node engine/status.js`, 2026-09-07 17:07 (local clock in header; UTC times inside)

Nine clauses. **3 PASS / 6 FAIL.**

```
    FAIL  game differential              MEASURED AGAINST A DIFFERENT ENGINE — data/engine-diff.json ran on release
                                         c28ad0815782 and the tree is 1be57a100d59. ... Re-run:
                                         SHOWDOWN_PATH=... node tests/test-engine-diff.js --n 6000 --seed 20260804
                                         READ FROM engine-diff.json, 1.7 h old
    FAIL  deliberate roster / items      MEASURED AGAINST A DIFFERENT ENGINE — data/roster.items.json ran on release
                                         c28ad0815782 and the tree is 1be57a100d59. ... Re-run:
                                         SHOWDOWN_PATH=... node tests/roster.js --stage items --write
                                         READ FROM roster.items.json, 1.8 h old
    FAIL  deliberate roster / abilities  MEASURED AGAINST A DIFFERENT ENGINE — data/roster.abilities.json ran on
                                         release c28ad0815782 and the tree is 1be57a100d59. ... Re-run:
                                         SHOWDOWN_PATH=... node tests/roster.js --stage abilities --write
                                         READ FROM roster.abilities.json, 1.8 h old
    FAIL  deliberate roster / moves      MEASURED AGAINST A DIFFERENT ENGINE — data/roster.moves.json ran on release
                                         c28ad0815782 and the tree is 1be57a100d59. ... Re-run:
                                         SHOWDOWN_PATH=... node tests/roster.js --stage moves --write
                                         READ FROM roster.moves.json, 1.8 h old
    PASS  coverage / every used mechanic is measured by something clean: all 412 moves above 25 clicks are measured by
                                                                  the roster or the census
    PASS  whole-game differential / BOARD-MATERIAL — games whose boards part BOARD-MATERIAL: 0 of 958 games.
    FAIL  whole-game differential / NARRATION — protocol divergence with no board effect NARRATION-ONLY: 71 of 961 =
                                                                                         7.4% of games ...
    FAIL  mechanics / each one staged and compared against showdown MEASURED AGAINST A DIFFERENT ENGINE —
                                                                    data/all-mechanics-fire.json ran on release
                                                                    c28ad0815782 ... Re-run: SHOWDOWN_PATH=... node
                                                                    engine/all_mechanics_fire.js --kind all --write
    PASS  no open, known engine defect   clean: no open row names an instrument that is RED
```

In every one of the four stale rows the reason is the same and is named: *"WHY THE DIGEST MOVED: 1 of
1 moved source(s) really changed — engine/medicham2-browser.js."*

The NARRATION clause is red on its own merits (71 of 961) and was **not** touched by this pass.

## Runs — appended as each finishes

### 1. Game differential — `data/engine-diff.json` — **CLEAN**

**Sample line, verbatim:**

```
cmd //c "tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804"
```

`--n 6000` and `--seed 20260804` are part of the sample definition, taken from the gate's own printed
re-run command. `test-engine-diff.js` does not take `--release`: it stamps
`engine_release.liveStamp()`, computed off the tree it actually read.

| | |
|---|---|
| started / finished (UTC) | 2026-09-07T21:11:05Z → 21:13:03Z (118 s) |
| exit | 0 |
| artifact `engine_release` | `1be57a100d59` (was `c28ad0815782`) |
| artifact `generated` | 2026-09-07T21:13:02.875Z |

**Result: `compared 6000, agreed 6000, disagreed 0`.** Both corner arms 0 (top, bottom) and all
fourteen interior roll indices 0 — *"the interior is clean across all 14 indices"*. `rows dropped by
an exception: 0`. Three conformance sections also clean: accuracy `disagree: 0`, accuracy-modifier
`disagree: 0` with `accModUntabled: 0`, substitute-bypass `missing from it: 0; in it and not
bypasssub: 0`.

**Declared scope, unchanged from the previous run:** `skipped_multihit 134`, `skipped_ability_multihit
17` (Parental Bond), `pool.dropped 9`, `skipped_non_finite 0`.

**IS THE ZERO EMPTY? NO — BOTH RED DEMONSTRATIONS FIRE.** The instrument was shown it can see a
planted defect before the zero was believed. Neither plant touches `data/engine-diff.json`; each
writes `data/engine-diff-PLANTED-<kind>.json`.

```
cmd //c "tools\lownode.cmd tests\test-engine-diff.js --n 600 --seed 20260804 --plant spread"
cmd //c "tools\lownode.cmd tests\test-engine-diff.js --n 600 --seed 20260804 --plant band"
```

| plant | what it should move | what it moved |
|---|---|---|
| `spread` (halfwidth 12) | the two CORNER arms only | top 0 → **388** disagreements of 600, bottom 0 → **428**. Interior stayed 0 by construction, as the run's own note says. |
| `band` (halfwidth 12) | the fourteen INTERIOR indices only | idx01 → **394** ... idx14 → **427**, `INTERIOR TOTAL 5757`. Both corners and the midpoint stayed 0 by construction. |

Every arm the clean run reads as zero has been demonstrated live by one plant or the other. The
midpoint total (`disagreed 0`) is unmoved by either plant **by construction** — that is the documented
reason the corner and index arms exist, not a quiet arm.

### 2. Deliberate roster / items — `data/roster.items.json` — **ENGINE CLEAN, ONE PLANT UNAPPLIED**

**Sample line, verbatim:**

```
cmd //c "tools\lownode.cmd tests\roster.js --stage items --reds --write --release 1be57a100d59"
```

`--reds` is **not** in the command the gate prints, and it is not optional for an artifact that is
going to be trusted: `tests/roster.js:28` — *"`--reds` IS NOT DEFAULT AND `--write` WITHOUT IT
SILENTLY STAMPS `reds: []`."* The artifact this replaced (`data/roster.items.prev.json`, release
`c28ad0815782`, generated 19:20:32.637Z) carried **`reds` of length 0** — it had never been asked.
`--release 1be57a100d59` is passed explicitly because `game_differential.js` CUTS a release when
none is named. `tools/lownode.cmd` derives `--max-old-space-size=6144` from the file's own
`ABRA-HEAP: 6144` line.

| | |
|---|---|
| started / finished (UTC) | 2026-09-07T21:14:0xZ → 21:15:54Z |
| exit | **1** — and the reason is the plant, not the engine (see below) |
| artifact `engine_release` | `1be57a100d59` (was `c28ad0815782`) |

**SUMMARY items — identical to the pre-fix run, on new bytes:**

```
     0  FIRED-AND-BOARDS-DIFFER
     0  DID-NOT-FIRE
     0  DEFERRED-BY-OWNER
   140  FIRED-AND-BOARDS-MATCH
     0  CONTROL-NOT-QUIET
     8  COULD-NOT-STAGE
   148  total
```

Denominator: 140 TESTED of 148 IN SCOPE of 148 total; 0 out of scope; 8 in scope and not stageable;
0 unattributable. Arm that reached the driver: `314 top-tie-first`.

**THE `--reds` PLANTS: 17 of 18 CAUGHT, 1 NOT CAUGHT.**

```
NOT CAUGHT: item/status-cure :: the anchor matched 2 time(s), not exactly once — an unapplied plant
reads exactly like a comparator that found nothing.
Anchor: const _cs=TAGS.param('item',m.item,'curesStatus');
```

**This is the whole reason exit is 1.** `tests/roster.js:9795` — `bad = FIRED-AND-BOARDS-DIFFER +
DID-NOT-FIRE + redRows.filter(r => !r.ok).length`, and the first two are zero. So: **the engine
answered clean on current bytes, and one rule's green rows are not yet backed by a demonstration that
the rule can go red.** `item/status-cure` is the rule; its plant anchor is now ambiguous in
`tests/roster.js` (matches twice), which is an INSTRUMENT defect, not an engine one. Reported, not
chased — routing is the coordinator's.

Also printed and carried in the artifact: **2 differences attributable to no entity** — Kangaskhan
`status_counter` and `party.status_counter` read 2 on Showdown and 1 here, seen while staging Chesto
Berry, and present in the CONTROL arm too, so they are a property of the staging.

### 3. Deliberate roster / abilities — `data/roster.abilities.json` — **CLEAN, ALL PLANTS FIRE**

**Sample line, verbatim:**

```
cmd //c "tools\lownode.cmd tests\roster.js --stage abilities --reds --write --release 1be57a100d59"
```

| | |
|---|---|
| started / finished (UTC) | 2026-09-07T21:18:16Z → 21:18:33Z |
| exit | 0 |
| artifact `engine_release` | `1be57a100d59` (was `c28ad0815782`, generated 19:20:41.055Z, `reds: []`) |

```
     0  FIRED-AND-BOARDS-DIFFER
     0  DID-NOT-FIRE
     1  DEFERRED-BY-OWNER
   129  FIRED-AND-BOARDS-MATCH
    45  CONTROL-NOT-QUIET
   141  COULD-NOT-STAGE
   316  total
```

129 TESTED of 202 IN SCOPE of 316 total; 114 out of scope (no legal carrier); 27 in scope and not
stageable; 45 unattributable. Arms: 550 `top-tie-first`, 24 `bottom-tie-first`. Every count is
identical to the run on `c28ad0815782` — the three simulator fixes moved this stage not at all.

**`--reds`: 29 of 29 CAUGHT, 0 NOT CAUGHT.** This stage's greens are backed.

### 4. Deliberate roster / moves — `data/roster.moves.json` — **ENGINE CLEAN, THREE PLANTS UNAPPLIED, AND THEY COVER 198 OF THE 475 GREENS**

**Sample line, verbatim:**

```
cmd //c "tools\lownode.cmd tests\roster.js --stage moves --reds --write --release 1be57a100d59"
```

| | |
|---|---|
| started / finished (UTC) | 2026-09-07T21:19:08Z → 21:19:31Z |
| exit | **1** — the three unapplied plants, nothing else |
| artifact `engine_release` | `1be57a100d59` (was `c28ad0815782`, generated 19:20:55.294Z, `reds: []`) |

```
     0  FIRED-AND-BOARDS-DIFFER
     0  DID-NOT-FIRE
     3  DEFERRED-BY-OWNER
   475  FIRED-AND-BOARDS-MATCH
     0  CONTROL-NOT-QUIET
    22  COULD-NOT-STAGE
   500  total
```

475 TESTED of 500 IN SCOPE of 500 total. Arms: 821 `top-tie-first`, 262 `bottom-tie-first`. Counts
identical to the run on `c28ad0815782`.

**`--reds`: 32 of 35 CAUGHT, THREE NOT CAUGHT — and all three share one anchor.**

```
NOT CAUGHT: move/plain-attack   :: the anchor matched 0 time(s), not exactly once
NOT CAUGHT: move/variable-power :: the anchor matched 0 time(s), not exactly once
NOT CAUGHT: move/recharge       :: the anchor matched 0 time(s), not exactly once
Anchor (all three): return {min:roll(85),max:roll(100),eff};
```

**HOW MUCH THIS COVERS.** Counted off `data/roster.moves.json:results`:

| rule | FIRED-AND-BOARDS-MATCH | other |
|---|---|---|
| `move/plain-attack` | 166 | 1 DEFERRED-BY-OWNER |
| `move/variable-power` | 26 | — |
| `move/recharge` | 6 | — |
| **total** | **198 of 475 = 41.7% of this stage's greens** | |

**IT IS NOT A REGRESSION FROM TONIGHT'S BATCH, AND IT IS NOT NEW TONIGHT EITHER — IT IS FROM EARLIER
TODAY.** Measured, not argued:

- The live line is `return {min:roll(85),max:roll(100),eff,type:mvT};` — `engine/medicham2-browser.js:13524`.
- `git log -S 'eff,type:mvT}' -- engine/medicham2-browser.js` returns exactly one commit: **`1b5fd9f1`,
  2026-09-07 12:52:23 -0400**, *"A thaw ordered against its own secondary, and a resist berry that
  asked the move's base type instead of the one it actually was."* The resist-berry fix appended
  `type:mvT` to the return and the three anchors stopped matching.
- The anchor matches 0 times on release `1be57a100d59` **and** on the stale release `c28ad0815782`,
  and on `09fde54aa1df`, `a31d271995e3`, `830350135192`. **575 of 590 frozen releases still carry the
  old line**, so the break is confined to today's fifteen.

**WHY NOBODY SAW IT.** Every roster artifact on disk carried `reds: []`. The stale artifacts this pass
replaced were written by a run that did not pass `--reds`, so the safety net had not been asked. The
three plants have been unapplied since 12:52 today and nothing could have reported it.

**Same class, items stage:** `item/status-cure`'s anchor
`const _cs=TAGS.param('item',m.item,'curesStatus');` matches **2** times, not once — on the live tree
and on `c28ad0815782` alike, so also not tonight's doing. It covers 5 green rows and 2 COULD-NOT-STAGE
(aspearberry, cheriberry, chestoberry, lumberry, pechaberry, persimberry, rawstberry).

**Nothing was adjusted.** The anchors are `tests/roster.js`'s, an instrument file, and this pass does
not touch instrument files.

### 5. Mechanics census — `data/all-mechanics-fire.json` — **CLEAN, AND ITS OWN RED DEMONSTRATION FIRES 24 TIMES**

**Sample line, verbatim:**

```
cmd //c "tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release 1be57a100d59"
```

| | |
|---|---|
| started / finished (UTC) | 2026-09-07T21:24:05Z → 21:24:26Z |
| exit | 0 |
| artifact `engine_release` | `1be57a100d59` (was `c28ad0815782`, generated 19:24:38.881Z) |
| arm | `bottom-tie-first` |
| census pin | `efdfde78903b`, 830 rows, generated 2026-09-07T20:56:57.154Z, "identical to the live census"; it steers 759 entity sets, 71 rows steer nothing |
| games | `1313 games played, 0 threw, 0 sheets could not be assembled` |

**Every count is identical to the stale run.** Read side by side out of the artifact and out of
`git show HEAD:data/all-mechanics-fire.json`:

```
OLD c28ad0815782  moves resolved 495  diverged 4 (6 incl. shelved)  abilities fired 104  diverged 1  showdown_only 8  items fired 64  diverged 0
NEW 1be57a100d59  moves resolved 495  diverged 4 (6 incl. shelved)  abilities fired 104  diverged 1  showdown_only 8  items fired 64  diverged 0
```

**AND THAT PAIR IS NOT A BEFORE/AFTER, BECAUSE THE CENSUS MOVED BETWEEN THEM.**
`data/mechanics-census.json` went `dec15a5ed2e9` (generated 19:17:10.502Z, the blob at `HEAD~1`) →
`efdfde78903b` (20:56:57.154Z, the blob at `HEAD`), and the old run is at 19:24 while the new one is
at 21:24. CLAUDE.md: *"A mechanics count taken either side of a census regeneration is not a
before/after."* The agreement on every field is evidence; it is not a controlled comparison, and it
is not reported as one.

**A GAP WORTH NAMING:** `data/all-mechanics-fire.json` carries `engine_release`,
`engine_release_cut`, `showdown_commit`, `source_digests`, `arm` — and **no census digest**. The
census SELECTS THE SAMPLE (`covWant` reads it at every decision) and the artifact records no pin for
it; the digest exists only in the run's stdout. Reported, not fixed — the instrument is not this
pass's to change.

**IS THE PASS EMPTY? NO — the run prints its own red demonstration before any green counts**, and the
artifact carries `red_ok: true`. **24 CAUGHT lines**, including the type-immunity plant and its
control, a mechanic swapped for itself reading DID-NOT-FIRE, a corrupted damage line, the preflight
refusing a genderless board for Rivalry and clearing it once genders are declared, the same A/B asked
twice giving the same verdict, and **thirteen STATE plants** — HP on an active body, a boost stage, a
side clock, HP on a BENCHED body, Fairy Lock, trapping, Uproar, a banked charge, a bench Substitute,
Destiny Bond active and benched, and a stall counter active and benched — each a board difference
with no line difference at all.

**WHAT IT FOUND (unchanged, and reported because it is the lab's answer, not the pool's):** 5 played
divergences — moves `corrosivegas` (ordering), `gastroacid` (extra event), `healbell` (event
missing), `reflecttype` (event missing), ability `supremeoverlord`. 4 move rows PART A BOARD in this
lab even though the pinned pool is at board-material zero: `axekick` (`vol.confusion` 2 vs 1),
`clearsmog` (`boosts.spe` 0 vs 2), `healbell` (`party.status` "" vs "slp"), `reflecttype` (`types`
water vs ghost/poison) — two of them with the two streams in agreement, which the protocol arm
structurally cannot see. Also 8 `SHOWDOWN-ONLY` abilities, 6 of them flagged `CONTROL NOT QUIET —
attribution ambiguous`.

That is exactly the ranking Will set on 2026-08-23: **the pinned pool is clean and the lab carries the
obscure tail.** The gate's mechanics clause subtracts these correctly — see below.

---

## THE GATE AFTER — `node engine/status.js`, 2026-09-07 17:26

**6 PASS / 3 FAIL** (was 3 PASS / 6 FAIL). Verbatim verdict lines:

```
    PASS  game differential              clean at BOTH corners of the damage roll: midpoint 0 of 6000, top 0/6000,
                                         bottom 0/6000, idx01 0/6000 ... idx14 0/6000 (seed 20260804)
    FAIL  deliberate roster / items      0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE — 140 of 148 tested, 1 red
                                         demonstration(s) did not behave as their rule predicted
    PASS  deliberate roster / abilities  clean: 129 of 202 tested. 45 row(s) count in NEITHER column — the control arm
                                         is itself a live ability: ...
    FAIL  deliberate roster / moves      0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE — 475 of 500 tested, 3 red
                                         demonstration(s) did not behave as their rule predicted
    PASS  coverage / every used mechanic is measured by something clean: all 412 moves above 25 clicks are measured by
                                                                  the roster or the census
    PASS  whole-game differential / BOARD-MATERIAL — games whose boards part BOARD-MATERIAL: 0 of 958 games.
    FAIL  whole-game differential / NARRATION — protocol divergence with no board effect NARRATION-ONLY: 71 of 961 =
                                                                                         7.4% of games ...
    PASS  mechanics / each one staged and compared against showdown every mechanic anybody plays agrees with the
                                                                    authority: 5 diverge, 1 are declared, 4 are below
                                                                    the reach shelf and 0 were cleared on decision
                                                                    impact, leaving 0.
    PASS  no open, known engine defect   clean: no open row names an instrument that is RED
```

And the quarantine line, on every withheld figure:

```
    MEDICHAM is not correct — 3 of 9 gate clauses fail (deliberate roster / items; deliberate roster / moves;
    whole-game differential / NARRATION — protocol divergence with no board effect)
```

**THE TWO ROSTER FAILURES ARE THE INSTRUMENT, NOT THE ENGINE, AND THE GATE SAYS SO IN ITS OWN WORDS.**
Both read `0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE` and fail on *"N red demonstration(s) did not
behave as their rule predicted."* The engine's counts are clean on all three stages.

**The mechanics clause passes on a subtraction worth reading:** 5 diverge → 1 DECLARED
(`ability:supremeoverlord` — the authority emits the literal `fallenundefined` on a `[silent]` line;
reproducing a typo is not correctness) → 4 below the REACH shelf (`move:gastroacid` 11 clicks,
`move:reflecttype` 11, `move:corrosivegas` 1, `move:healbell` 0, out of 64,846 stored games; the shelf
is 25+ clicks) → 0. Plus 3 shelved by the owner (`bittermalice`, `nightdaze`, `forewarn`), still
staged and played, not voting. `DECISION IMPACT — NO DECISION-IMPACT RUN — data/decision-impact.json
is absent, so nothing is excused on decision impact.`

## What is now owed

1. **`item/status-cure`, `move/plain-attack`, `move/variable-power`, `move/recharge` need their plant
   anchors repaired in `tests/roster.js`.** Three of them broke at `1b5fd9f1` today. Until then, 198
   of 475 move greens and 5 of 140 item greens are not backed by a demonstration that the rule can go
   red. **This is the entire remaining distance on those two clauses.**
2. **NARRATION at 71 of 961** — red on its own merits, its own piece of work, deliberately not
   attempted here.
3. **`data/all-mechanics-fire.json` should stamp the census digest it was steered by.** Right now the
   pin is stdout-only.

## Files this pass wrote

Modified, all by the instruments themselves: `data/engine-diff.json`,
`data/roster.{items,abilities,moves}.json` and their `.prev.json` bytes, `data/roster.json` (the
convenience copy of the last stage = moves), `data/all-mechanics-fire.json`,
`data/published-samples.json`, `data/provenance-stamp.json` (rewritten by `status.js` itself), and
`data/engine-diff-PLANTED-{spread,band}.json` (both already tracked; the plants write there by design
and never to `data/engine-diff.json`). Added: this report and one row in `docs/RUNNING-NOTES.md`.

**Nothing was committed** — Will publishes. `engine/status.js --write` was NOT run. No instrument
file, no `engine/medicham2-browser.js`, no `data/policy-weights.json` was touched. No version bump,
no `CHANGELOG.md` edit. No file was deleted. Every process was a foreground child of this session and
none was killed.
