# The driver's two declared gaps are closed, the premise they were closed under was wrong, and completion did not move

2026-09-05. MEASURE. Release **`a5c736283129`**, pool `0d103fb9fa87`, census pin
`census-pin-9446a684709d.json`, pins digest `bcb38e47d94f`, 961 games PLAYED of a 1200-PAIR budget.

| | file |
|---|---|
| the derived human distributions | `data/joint-click-census.json` (new) |
| the instrument that derives them | `engine/joint_click_census.js` (new) |
| the prediction, written before the first joint game | `data/verification/2026-09-05-joint-driver-prediction.json` |
| the CONTROL arm (`empirical-click/v1`, current bytes) | `data/verification/driver-control-empirical.json` |
| the JOINT arm (`joint-empirical-click/v1`) | `data/verification/game-differential.joint.json` |

`data/game-differential.json` was **not** touched. The published slot still holds the 46 on release
`0dec37ff5ad9` and the gate still reads what it read.

---

## 0. HEADLINE

**Completion did not move.** Both engines ended the battle in **485 of 961** games under the
empirical arm and **481 of 961** under the joint arm. Median turns **11 → 11**. The joint model is
better-founded in every component and it did not fix the thing it was commissioned to fix.

**What did move is disagreement.** Board-material **35 → 110**, protocol first-divergence
**120 → 191**, end-state DIFFERENT **17 → 81**, and `ENDED-APART` — the two engines disagreeing about
whether the battle is over — **0 → 18**, a state the previous arm never once reached.

**And the brief's premise was refuted before the run rather than after it.** The empirical driver was
not double-targeting at ~50%. It was double-targeting at **100%**.

---

## 1. THE PREMISE, REFUTED FROM THE DRIVER'S OWN SOURCE

The brief's diagnosis was *"the driver samples `P(move | species)` per slot, independently"*, and
therefore double-targets at ~50% against a human 23.4%. The move draw is per-slot and independent.
**The target draw was never a draw at all.** `engine/game_differential.js` `chooseAction` resolved
every `normal` / `any` / `adjacentFoe` click with

```js
const j = foes.findIndex(q => q && !q.fainted);   // the LOWEST LIVE INDEX
```

Both slots evaluate that against the same board inside the same request, so both name the same foe,
every turn, all game. **100% double-targeting, not 50%** — and 100% focus fire is the *strongest*
damage-concentration policy available, not a weak one.

It also has a structural consequence that is worse than the statistical one: the foe standing in
slot **b** is never named by a single-target move at all until slot a is permanently empty. Three of
a four-body bring are removed through one lane and the fourth arrives at full HP as the last body of
the game.

**So the honest pre-run call was that a realistic target model would make games LONGER, not shorter**,
and that is what was written down. It is in the prediction file, §`the_premise_in_the_brief_is_refuted_before_the_run`.

---

## 2. THE DERIVED DISTRIBUTIONS

`engine/joint_click_census.js` reads the raw protocol of both human stores —
`games.ladder.raw-logs.jsonl` and `games.bo3.raw-logs.jsonl` — and admits a game on the same rule
`engine/rollout_switch_census.js` uses. **101,995 finished Champions games** (76,551 ladder / 25,444
bo3). Not quarantined: the store is upstream of the simulator and nothing here passes through
medicham2, board.js or a leaf.

### (A) The joint target draw

Conditioned on: both active bodies clicked a single-foe-targeted move (dex target in
`{normal, any, adjacentFoe}`), **both foes alive at TURN START** because the two choices are
simultaneous, no redirect volatile up on the defending side, no `[from]`, no `[spread]`.

| | |
|---|---|
| clean pairs | **159,951** |
| named the SAME foe | **62,154** |
| split | 97,797 |
| **P(same foe)** | **38.858%** |
| ambiguous (a defending body fainted between the two clicks, so Showdown re-aimed the second move and the choice is unobservable) | 53,309 |
| **bounds carrying every ambiguous pair** | **29.145% – 54.142%** |
| excluded: a redirect volatile was up | 7,167 |
| excluded: a foe was already dead at turn start | 20,714 |
| marginal target slot a / b | 561,427 / 551,910 — **no slot bias** |

So: humans **38.9%**, the previous driver **100%**, and `engine/board.js:377`'s **23.4%** is a third
number measured under a condition this census does not reproduce. All three are quoted with their
condition attached and none is used to correct another.

### (B) The switch rate is not one number

`data/rollout-switch-census.json` gives one pooled conditional rate, **9.98%**, and the driver used
it as a constant. The same walk conditioned on context, over **1,777,374** decisions taken with a
live bench:

| axis | | |
|---|---|---|
| pooled | **10.355%** | (vs the 9.98% in use — that artifact is dated **2026-08-11** and was measured on 58,639 games; the store now holds 101,995) |
| HP at turn start | full **8.81%** · 67-99 **10.31%** · 34-66 **12.09%** · 1-33 **15.19%** | |
| tenure (decisions already made on the field) | 0 **6.62%** · 1 **13.25%** · 2+ **12.40%** | |
| bench size | 1 **8.32%** · 2 **11.48%** | |
| status | clean 10.33% · statused 10.99% — **negligible, and reported as such** | |

The 30-cell lookup the driver actually reads spans **3.337%** (full HP, first decision, one body on
the bench — 147,471 decisions) to **18.904%** (under a third HP, second decision, two on the bench —
36,293 decisions). **A factor of 5.7 that a single constant cannot express in either direction.**

### (C) Which body — measured, and deliberately nearly nothing

Restricted to sides where the count of distinct bodies seen equals `|teamsize|`, so the bench roster
is a fact. **169,170 resolved** voluntary switch-ins, 14,804 unresolved and counted as such.

On a bench holding **both** a debutant and a returning body — the only cell that carries information —
humans send the debutant **52.822%** of the time against the **50.016%** a uniform draw gives.
**2.8 points.** It is wired because it is one derived number and closes the declared gap rather than
halving it, and the margin is printed beside it on every run so it cannot be read as a behaviour
claim it does not support.

### Two probe bugs found and fixed before they could lie

- **The redirect filter read a field that does not exist and printed a clean zero.** The first draft
  watched for `|-activate|slot|move: Follow Me` and reported `excluded_redirect: 0` over 600 games.
  Showdown announces the volatile with `this.add('-singleturn', target, 'move: Follow Me')`
  (`data/moves.ts:6059`) and the redirect **itself** is `this.debug(...)` — never in the log at all.
  Corrected, the exclusion fires 7,167 times and moves the focus rate 38.3% → 37.2% on the 600-game
  probe. The member list is now **derived from `data/tags.json`'s `redirects` / `redirectsType` tags**,
  not typed, and an empty set is a refusal.
- **The which-body measurement asked a question that could only have one answer.** It printed
  `pct_mixed_bench_chose_new: 100` over 18,936 events — uniformity across rows, the tell. It gated on
  *"every body of this bring has already been on the field"*, and that gate can only open on the turn
  a fourth body debuts, because the incoming body is what completes the set. The chosen body was new
  by construction and every alternative old by construction. It now records the observable state at
  the event and scores it after the last line of the game, when the bring is a fact.
- **And a third, in the tenure definition, caught before it reached a driver.** Tenure must equal
  Showdown's own `pokemon.activeTurns - 1`, because that is the only handle the driver has. A first
  draft gave leads a bucket of their own (so a turn-9 lead shared a cell with a turn-1 lead); a second
  used `turn - enteredTurn`, right for a lead and one too many for a mid-game switch-in. Off by one
  and every draw would have read a neighbouring cell — 3.3% looked up as 10.4% — and nothing would
  have looked wrong.

---

## 3. WHAT WAS BUILT

**A THIRD steering policy, `joint-empirical-click/v1`, not a widening of the second.** Every
whole-game figure ever published carries `steering.policy`; changing what `empirical-click/v1` does
would make all of them ambiguous, and `steering.comparable` would go on pairing arms taken either
side of the change because their policy strings still matched.

`engine/steering.js` now carries an arm TABLE (`MODES`) and derives `TABLE_DRIVEN` from it, so
`resolve`, `vouches` and `comparable` all ask one question in one place. Three inline
`=== 'empirical'` checks became one derived set.

**What the gate will do with a third policy, checked and stated BEFORE the run.**
`engine/quarantine.js`'s whole-game clause calls `PIN.guard({ ..., policy: POLICY_EMPIRICAL })`
against `data/game-differential.json`, and `steering.vouches()` **refuses** a block declaring any
other policy — *"different populations, not a stronger and a weaker one."* So a joint artifact in the
published slot would turn a **measured-and-red** clause into an **unmeasured** one, silently. That is
worse, not better. `game_differential.js` now **refuses at second zero** to publish a joint arm into
that slot and prints why. Whether the gate should ever become answerable by this arm is a decision
somebody makes in writing.

`data/joint-click-census.json` is read **live** and is not an engine SOURCE, for exactly the reason
`data/rollout-switch-census.json` is not: it is a fact about human play, upstream of MEDICHAM. It is
digested into `steering.driver_inputs` so two arms can be shown to have been handed the same bytes.

**`MEDFAILS.damagingClickWithoutTarget` is untouched.** The change decides WHICH live foe is named,
never WHETHER one is. The `tt === null` branch (a locked move, where Showdown omits `target`
entirely) is byte-identical, and a click with no live foe still drops the candidate.

**The joint draw is stateless on purpose.** Both slots hash the same address for the anchor; only the
partner draws again to decide whether to join it. A per-turn memo would be STATE, and
`driverSnap`/`driverRestore`'s header records what state in this driver costs — the planted-comparator
proofs silently become a different game from their clean arm. It uses `midValue` directly rather than
`drv`, because `drv` folds an `nth` counter in so two askers get *different* variates; here the
sharing is the entire point. `driver_address_repeats` reads **0**.

---

## 4. THE CONTROL: THE EXISTING ARMS DID NOT MOVE

`data/verification/driver-control-empirical.json` was run on the current bytes, same pins, and
reproduces `data/verification/fix-batch-8.json` **exactly**: 961 games, median 11, protocol 120,
threw 1, board-material 35, VOID 4, and a byte-identical `end_reasons` map. The only non-JOINT-gated
change in `game_differential.js` is hoisting the foe-target resolution out of the per-move loop,
where `foes` does not change and `findIndex` returned the same number every iteration.

**And the two arms provably played the same engine**, which mattered because `engine/engine_release.js`
was edited by another agent at 23:52:22, inside the joint run's window:

```
source_digests IDENTICAL: true   (all 26 files)
engine_release  a5c736283129 / a5c736283129      cut 2026-09-05T02:36:20.607Z both
showdown_commit 20ad99f...  identical
pins bcb38e47d94f · pool 0d103fb9fa87 · census 9446a684709d · move-priors e667fe8ab457 — all identical
teams picked 1968 / 1968 of 8778 distinct
```

One thing differs between the two artifacts: `steering.policy`.

---

## 5. THE MEASUREMENT

| | empirical-click/v1 | joint-empirical-click/v1 |
|---|---|---|
| games PLAYED (of a 1200-PAIR budget) | 961 | 961 |
| **median turns** | **11** | **11** |
| **both engines ended the battle** | **485** | **481** |
| the turn cap (12) | 473 | **426** |
| games stopped early — boards parted, placement unmirrorable | 2 | **47** |
| only ONE engine ended the battle | 0 | **14** |
| **BOARD-MATERIAL** | **35** | **110** |
| protocol first-divergence | 120 | **191** |
| end state DIFFERENT | 17 | **81** |
| end state ENDED-APART | 0 | **18** |
| VOID (`mid_void.void_games`) | 4 | **38** |
| THREW | 1 | 0 |
| turn-boundary agreement | 0.9896 | 0.9662 |
| game agreement | 0.9636 | 0.8855 |
| realised switch rate (% of decisions with a live bench) | 9.686 | 10.583 |
| realised focus rate | 100 (by construction) | **39.023** |

**THE FALL IN CAP-HITS IS NOT GAMES FINISHING.** 473 → 426 looks like completion improving and is
not: 47 games were stopped early because the boards parted so far that medicham2's placement could
not be expressed to Showdown, up from 2. Read the `both engines ended` row, which is flat.

**The model realised what it was pointed at.** Focus **39.023%** against the measured **38.858%**;
the body draw **52.152%** against **52.822%**; **43,427** switch draws read a context cell and
**zero** fell back to the pooled rate for a thin or absent cell.

**BOARD-MATERIAL 110 CARRIES A BOUND, NOT A POINT.** The instrument declares 38 of the 961 VOID, so
between **72 and 110** of the parted boards sit on games whose dice identity held (baseline: 31–35 of
35). The rise is at minimum a doubling and at most a tripling. It is the finding and it must not be
tuned away — the coverage→empirical swap did the same thing, 0 → 135.

**AND THE 110 CANNOT BE DIAGNOSED FROM THIS ARTIFACT.** `state.first_board_divergences` is
`.slice(0, 40)`. The baseline's 35 fitted under that cap and the joint arm's 110 does not, so only 40
are named and no per-mechanism split of the 110 is available. OWED 2.

### The prediction, scored

Written before the first joint game, in `data/verification/2026-09-05-joint-driver-prediction.json`.
**5 of 8 inside their bands, 3 outside — and the point calls on the three that mattered were wrong in
an instructive direction.**

| quantity | called | band | read | |
|---|---|---|---|---|
| realised focus rate | 38.9 | 37.5–40.3 | **39.023** | HIT |
| median turns | 12 | 11–12 | **11** | in band |
| both engines ended | 420 | 360–490 | **481** | in band, point call far off |
| turn cap | 538 | 468–598 | **426** | **MISS (low)** |
| board-material | 52 | 40–70 | **110** | **MISS (high)** |
| protocol first-divergence | 142 | 120–175 | **191** | **MISS (high)** |
| realised switch rate | 11.0 | 8.5–13.5 | **10.583** | HIT |
| cell fallbacks | 0 | 0–400 | **0** | HIT |

Three things were not predicted at all and are the most interesting numbers in the run: VOID 4 → 38,
`ENDED-APART` 0 → 18, and unmirrorable stops 2 → 47.

---

## 6. THE JOINT ARM IS A FIXTURE FOR A DEFECT THAT HAD NO FIXTURE

`mid_void.unshared_address_shapes` — the addresses one engine drew and the other did not — is
dominated by **two-turn charge moves**, and the baseline arm contains **none of them**:

```
JOINT                              CONTROL (empirical)
 23  crit phantomforce [sd only]     7  sec populationbomb [sd only]
 22  crit phantomforce [me only]     5  acc partingshot    [sd only]
 18  crit electroshot  [sd only]     3  crit populationbomb[me only]
 14  crit electroshot  [me only]     1  acc moonblast      [sd only]
  5  crit solarbeam    [sd only]     1  acc scorchingsands [sd only]
  4  crit solarbeam    [me only]     ... no charge move anywhere
```

`[sd only]` **and** `[me only]` for the same move means both engines drew for it at **different
addresses** — they released the charge on a different turn or against a different body.

`docs/_reports/2026-09-05-fix-batch-8.md` §6 records `vol.charging` as **REAL and UNSTAGEABLE**:
*"no staged scenario in this repository has ever played a two-turn release turn"*, because
`scripted()` supplies a target for a locked move and `Side#chooseMove` refuses the whole choice. The
joint arm plays them, unscripted, 46 shape-instances across 38 games.

**Two candidate mechanisms, neither claimed.** Either it is the `vol.charging` defect fix-batch-8
confirmed — the wrapper surviving a BeforeMove refusal in one engine and not the other — or it is a
target-memory divergence that the old driver hid **by construction**: the release turn is LOCKED and
names no target, so each engine re-derives one, and while every click pointed at foe a a re-aim to
"the hardest-hit foe" was a no-op. Aiming at foe b makes it observable. Distinguishing them is
ENGINE's, and the joint arm is now the fixture for it. OWED 1.

---

## 7. SO WHY ARE THE GAMES STILL LONG

Said plainly because the brief asked for it: **the joint model does not move completion materially,
and that is a real result.** Median turns 11 against real VGC's 7 (6 including forfeits, `p50` of
`length_no_forfeit` over 35,083 ladder games), and 44.3% of games still stop at the cap.

The target model was never going to fix it — the previous rule was maximal focus fire, so making it
realistic spreads damage rather than concentrating it. The remaining candidates, none measured here:

- **the move draw is a MARGINAL and is not conditioned on the board.** A body clicks Protect at the
  population rate for that species regardless of whether anything is aimed at it, and setup at the
  population rate regardless of whether it is about to faint. Real frequencies at random moments waste
  far more turns than real frequencies at chosen moments.
- **nothing finishes a body.** There is no notion of "this foe is at 12% and one click removes it".
- **the sheets carry no spread** (`evs: null` on 100% of stored sheets, permanent), so no set hits as
  hard as the one its owner actually built.

The first is the one worth measuring next, and it is a change to the DRAW, not to the target.

---

## 8. HOUSEKEEPING, REPORTED NOT TIDIED

- **`tests/test-pin-arms.js` is RED**: `FAIL middle: a move at accuracy 1, 2, 3, 4, 5 does NOT hit`.
  It is **not** attributable to this change and it is **not being filed as known** — it is reported
  here for the coordinator to route to ENGINE. Evidence: the assertion is about the `middle` arm's
  accuracy dice inside `ARM_BY_ID`/medicham2, my diff touches no line near either, and the empirical
  control run reproduced fix-batch-8 exactly on six headline figures and the whole `end_reasons` map,
  which a dice change could not survive. `engine/medicham2-browser.js` carries +213 lines of another
  agent's uncommitted work in this same tree.
- `tests/test-arm-steering.js` exits **2 (SKIP)** — it asks for `SHOWDOWN_PATH` in the environment and
  this shell does not export it. A skip is not a pass; it was not run and is not claimed green.
- `tests/test-empirical-driver.js` GREEN (20 checks), `tests/test-divergence-composition.js` GREEN.
- **`data/rollout-switch-census.json` is stale**: generated 2026-08-11 over 58,639 games; both raw
  stores now hold 101,995. Its pooled conditional rate is 9.98% and the current corpus says 10.355%.
  The empirical arm still reads it. Reported, not regenerated — that artifact is not mine to move
  under another division's live runs.
- Nothing was committed. Nothing was deleted.

---

## OWED

1. **The charge-move void is ENGINE's and it now has a fixture.** 38 VOID games concentrated on
   `phantomforce` / `electroshot` / `solarbeam`, zero in the control arm. Two candidate mechanisms are
   named in §6 and neither is claimed. The distinguishing run is a joint arm with the target model on
   and the switch model off, against one with both off.
2. **`state.first_board_divergences` is `.slice(0, 40)` and the joint arm has 110.** No per-mechanism
   diagnosis of the 110 exists. Raising the cap is a change to `game_differential.js`'s artifact shape
   and was not made inside a run that publishes a rate.
3. **This run changes the target model and the switch model TOGETHER and cannot attribute.** Two
   knob-cleared control arms — target-only and switch-only — are owed before any sentence assigns
   either result to either half. Predicted and stated in the prediction file before the run.
4. **The `data/rollout-switch-census.json` regeneration.** 25 days stale, measured on 57% of the
   current corpus, and it is what `empirical-click/v1` still reads.
5. **Leaf calibration — this division's one number — was not touched and stays WITHHELD.**
   `data/winrate-backtest.json` is downstream of MEDICHAM, the gate has not opened, and this run makes
   the case for withholding it stronger rather than weaker: on the arm that plays games the way people
   play them, 110 of 961 boards part.
6. **The MAG refit stays OWED and is a REFIT, not a restamp.** Nothing here fitted anything.
7. **`node engine/status.js --write` and the living-docs pass are NOT done by this report.** No
   `<!-- GENERATED -->` block was hand-edited and `docs/ROADMAP.md` was not touched, as instructed.
