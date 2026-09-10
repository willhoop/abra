# Narration close — the last three undeclared causes

**Historical by construction. Every figure here is derived; re-derive rather than quoting this file.**
`node engine/status.js` prints what is true now.

**One line.** The three undeclared narration causes are closed, each with a probe shown RED on the
pre-fix bytes and a `MEDI_*` knob that restores the defect; the whole-game differential on release
`8ac9c4d888f1` at `--games 1200` reads **BOARD-MATERIAL 0 of 961** and **NARRATION 0 of 961** —
1 raw, 1 declared — and `node engine/quarantine.js` prints **GATE: OPEN — MEDICHAM passes both
conditions; nothing is withheld**, 9 of 9 clauses PASS.

---

## 1. The clause, named, with the flags

**The clause read is `whole-game differential / NARRATION — protocol divergence with no board effect`.**
Its quantity is `state.protocol_diverged_board_never_did` less the declared rows, and the artifact's
own sentence for it is:

> NARRATION-ONLY: ZERO undeclared across 961 games — every protocol divergence in this run either
> parts a board (and is the other clause's) or is declared (1 narration-only raw, 1 declared, 0
> cleared on decision impact).

`state.games` is **961**; the one remaining raw row is the perish-drain cause Will closeted on
2026-08-28 (ROADMAP #440), so the clause's undeclared count is **0**.

The board clause is unmoved and is named separately: `state.games` (961) less
`state.games_board_never_diverged` (961) = **0 of 961**, 10,705 of 10,705 turn boundaries identical.
`by_cause_totals.games_board_material` is a different field and is not the operand.

| pin / flag | value |
|---|---|
| release | `8ac9c4d888f1` (27 files frozen), handed explicitly to the roster, `all_mechanics_fire` and the whole-game differential |
| census | `data/mechanics-census.json`, sha256[0:16] `1da84d77888ebc90`, steering digest `1da84d77888e`. `git diff HEAD` on it is EMPTY — the committed bytes, **not regenerated** |
| team store | `data/team-pool-frozen` |
| `--games` | **1200** requested, **961** played |
| arm | `middle` |
| turns | `--turns 50` |
| steering | `empirical` |
| Showdown | commit `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` |

`node engine/arms_comparable.js <HEAD artifact> data/game-differential.json` answers **COMPARABLE** —
same steering digest `1da84d77888e`, same 961 games, releases `5a7bd8a8178a` → `8ac9c4d888f1`. So the
difference between the two numbers is the change under test and nothing else.

Field by field, before → after:

```
games                             961  ->  961     same
games_board_never_diverged        961  ->  961     same   (BOARD-MATERIAL 0 -> 0)
protocol_diverged_games             4  ->    1     MOVED
protocol_diverged_board_never_did   4  ->    1     MOVED
turn_boundaries_compared        10705  -> 10705    same
coverage.exercised                732  ->  732     same
threw                               1  ->    1     same
declared_gaps.choices_refused       2  ->    2     same
games_cut_off_by_the_turn_cap       0  ->    0     same
games_void_excluded                 0  ->    0     same
```

---

## 2. Cause by cause

Every one of the three was a LOCATION on the card and a different mechanism underneath it. None was a
tie: each has one correct answer and the authority states it.

### 2a. `-fail field 3 :: |-fail|p1a|shedtail|[weak] <> |-fail|p1a`

**Authority.** `data/moves.ts:16166-16179`, `shedtail.onTryHit`; Champions does not override it
(asserted on every probe run). Three refusals, three different lines:

```
16167  if (!this.canSwitch(source.side) || source.volatiles['commanded']) {
16168    this.add('-fail', source);                                   <- BARE, two fields
16171  if (source.volatiles['substitute']) {
16172    this.add('-fail', source, 'move: Shed Tail');                <- named, no flag
16175  if (source.hp <= Math.ceil(source.maxhp / 2)) {
16176    this.add('-fail', source, 'move: Shed Tail', '[weak]');      <- named + [weak]
```

**What the card claimed vs the mechanism.** The card names a missing field. It is not a missing field:
`mvFailNamed` and `costsUserHP.announcesFailBelow` have existed since NARRATION BATCH S, and the tag
already carried `{label: 'Shed Tail', flag: '[weak]'}` — DERIVED from the handler, not typed. What was
wrong is that **Shed Tail never reaches the generic `costsUserHP` block that consumes them.** That
block excludes `a.kind==='passstate'` deliberately, because THE ORDER OF THE THREE CHECKS IS PART OF
THE MOVE (an empty-bench Shed Tail must cost nothing), and the `passstate` branch that owns the order
wrote a bare `mvFail` on all three roads. One family, two implementations, and only one of them had
ever been handed the label.

**Fix.** `engine/medicham2-browser.js`, the `a.kind==='passstate'` branch: the doll-already-up refusal
and the below-threshold refusal both route through `mvFailNamed` — the same one function the generic
block calls, so the two sites cannot drift again and the existing knob covers both. The bench refusal
stays bare.

**Probe.** `tests/probe_shedtail_refusal_line.js`. **Shown RED first** (2 of 2 target arms) with both
controls green:

```
SHED-REPEAT   showdown |-fail|p2a orthworm|move shed tail          medicham |-fail|p2a orthworm   RED
SHED-WEAK     showdown |-fail|p2a orthworm|move shed tail|[weak]   medicham |-fail|p2a orthworm   RED
SHED-NOBENCH  showdown |-fail|p2a orthworm                         medicham |-fail|p2a orthworm   green (control)
```

After the fix all three agree. Knob `MEDI_BARE_FAIL_LABELS=1` (batch S's, reused because the fix
routes through `mvFailNamed`) puts both lines back bare and turns the two arms RED again with the
control still green.

**A staging note worth keeping.** The first SHED-WEAK arm burned the user down with a Flamethrower and
the arm reported NOT STAGED: on this cast a single Flamethrower takes Orthworm from `145/145` to
`0 fnt`. Picking an attack that lands inside a window is the shape of staging that reads as a fix when
it is really a miss, so the arm now walks the body down with **its own Substitute cost**,
`floor(maxhp/4)` three times (145 → 109 → 73 → 37), with the doll broken between each. No damage
estimate anywhere.

**CLOSED.**

### 2b. `ordering :: |-activate|p1a|lightningrod <> |-prepare|p1b|electroshot`

**Authority.** `sim/battle-actions.ts:466` builds the target list; `sim/pokemon.ts:829-835` is where
the draw lives, and it carries a guard this engine did not have:

```
829  if (this.battle.activePerHalf > 1 && !move.tracksTarget) {
830    const isCharging = move.flags['charge'] && !this.volatiles['twoturnmove'] &&
831      !(move.id.startsWith('solarb') && ['sunnyday','desolateland'].includes(this.effectiveWeather(move))) &&
832      !(move.id === 'electroshot' && ['raindance','primordialsea'].includes(this.effectiveWeather(move))) &&
833      !(this.hasItem('powerherb') && move.id !== 'skydrop');
834    if (!isCharging) target = this.battle.priorityEvent('RedirectTarget', this, this, move, target);
835  }
```

`sim/battle-actions.ts:591` then raises `PrepareHit`, which is where `electroshot.onTryMove` writes
`|-prepare|`. Champions overrides neither `electroshot`, nor `lightningrod`, nor `getMoveTargets`.

**What the card claimed vs the mechanism.** The card reads as "the redirect announcement is late". It
is not late in general, and the naive reading is dangerous: **on a real charge turn the authority
writes no redirect line at all**, and this engine already wrote none — correctly, but by accident of
position, because its charge branch spent the turn and `continue`d ABOVE the draw. The whole
divergence lives on the other road: the charge that is SKIPPED (Electro Shot in rain, Solar Beam in
sun, a Power Herb), where the handler writes `|-prepare|` and the move then hits in the same turn.
There the authority has already drawn the target and this engine had not.

**Fix.** The `const mv` / terrain-widening block and the whole aim → targets → redirect segment were
hoisted to the top of the attack path, above the charge branch — the authority's own position, since
`getMoveTargets` (466) is above `runEvent('TryMove')` (486), above `singleEvent('Try')` (590) and above
`PrepareHit` (591). The draw is gated on the authority's own `isCharging`, computed ONCE and read by
the charge branch too, so "is this charge spending the turn" has one implementation.

**Probe.** `tests/probe_redirect_above_prepare.js`. **Shown RED first** on ROD-RAIN with both controls
green:

```
ROD-RAIN     showdown  -activate lightningrod, then -prepare   medicham  -prepare only        RED
NO-ROD-RAIN  showdown  -prepare only                           medicham  -prepare only        green (control)
ROD-NORAIN   showdown  -prepare (t1), -activate (t2 release)   medicham  same                 green (control)
```

**ROD-NORAIN is the arm that earns its keep**: it is a REAL charge turn, so the authority skips the
draw outright. Hoisting the segment without the `isCharging` guard invents a rod line there and
nowhere else. Knob `MEDI_REDIRECT_BELOW_CHARGE=1` runs the same closure at the old call site and turns
ROD-RAIN RED again with both controls green.

**A probe error worth recording, caught before the engine was touched.** The first run compared
`ability: Lightning Rod` against `lightningrod` and reported all three arms RED. The authority writes
display names and this engine writes ids; the whole-game differ normalises exactly that away. The
comparison now flattens spaces and colons on both sides — otherwise the probe would have been red on
a difference the gate does not count, and one of its two controls would have looked like a defect.

**CLOSED.**

### 2c. `unrelated event mismatch :: |-fail|p2b <> |-activate|p1a|psychicterrain`

**Authority.** Three steps of `useMoveInner`, in this order:

```
sim/battle-actions.ts:486   runEvent('TryMove')        <- onFoeTryMove: Armor Tail, Queenly Majesty, Dazzling
sim/battle-actions.ts:590   singleEvent('Try')         <- suckerpunch.onTry, data/moves.ts:18399
sim/battle-actions.ts:592     if (!hitResult) { add('-fail', pokemon); attrLastMove('[still]'); return; }
sim/battle-actions.ts:559/:644  hitStepTryHitEvent -> runEvent('TryHit')
                                                       <- psychicterrain.condition.onTryHit, data/moves.ts:14117-14131
```

`moveSteps` is DECLARED above the `Try` gate and RUN below it — the one thing about that function that
reads backwards — so a `false` from `onTry` returns before the step loop and the terrain never speaks.
Champions overrides neither move and does not override `trySpreadMoveHit`.

**What the card claimed vs the mechanism.** The card's class, `unrelated event mismatch`, is wrong:
the two lines are the SAME event refused by two different sources. This engine folds both sources of
the priority bar into one `priorityRefusedAbove` call placed at the `TryMove` position — right for the
ability half, whose handlers really are `onFoeTryMove`, and **two steps too early for the terrain
half**. So a Sucker Punch the game refuses for its own reason was refused by the floor instead.

**Fix.** `priorityRefusedAbove` gained an `only` selector naming which source is being asked (a caller
passing nothing still gets both, so `board.js`'s and `position_features.js`'s reads are untouched). The
attack path now asks the ABILITY half at the old position and the TERRAIN half at a new gate placed
below the move's own `Try` family. The pre-dispatch gate keeps the whole bar for every non-attack kind,
because no status kind in this format carries a `Try` refusal for the terrain to jump over.

**Probe.** `tests/probe_sucker_try_above_terrain.js`. **Shown RED first** on SUCKER-IDLE-TARGET with
both controls green:

```
SUCKER-IDLE-TARGET  showdown |-fail|p2a mawile        medicham |-activate|p1a meowstic|move psychicterrain  RED
SUCKER-ATTACKING    showdown |-activate|...terrain    medicham |-activate|...terrain                        green (control)
SUCKER-NO-TERRAIN   showdown |-fail|p2a mawile        medicham |-fail|p2a mawile                            green (control)
```

**SUCKER-ATTACKING is the arm that stops the bar being moved out of the way entirely** — same terrain,
same bodies, but the aimed body has an attack queued, so `onTry` passes and the terrain IS what refuses.
Knob `MEDI_TERRAIN_BAR_AT_TRYMOVE=1` puts the terrain back in the number at `TryMove` and turns the
target arm RED again with both controls green.

The probe also asserts, from the format rather than from memory, that this regulation has **ZERO
Psychic Surge carriers**, which is why the terrain has to be staged from the move and the arm spends a
turn on it.

**CLOSED.**

### 2d. The fourth card — `event missing from medicham2 :: |upkeep <> |faint|p1a`

**Not touched, and it is the DECLARED row.** It is the perish drain sitting above `|upkeep|` where the
authority puts it below, closeted by Will on 2026-08-28 (ROADMAP #440). It is the one remaining raw
narration row and it does not vote. It is a real defect we have chosen not to fix, not an absence of
one.

The declaration carries its own `EVIDENCE NOT RE-CHECKED` marker: its no-board-effect claim was
measured on release `5f3f7141227c` and this artifact is `8ac9c4d888f1`. The ruling stands; the
measurement under it has not been repeated against these bytes. That is stated, not resolved here.

---

## 3. A regression this pass caused and fixed — the plant anchor

**The abilities roster clause went PASS → FAIL on the first chain run and it was my change.** Not a
divergence: `ability/blocks-priority`'s red demonstration plants a break by string-matching

```
function priorityRefusedAbove(defenders, field, aimedAt, why){
```

and 2c added a fifth parameter, so the plant matched **0 times** and the artifact recorded
`anchor_dead: true` — *"every row this rule produced is asserting nothing until it is re-aimed."* The
counts were identical either side of it (139 / 0 DIFFER / 0 DID-NOT-FIRE), which is exactly why the
count is not the check.

`tests/roster.js:7105` is re-aimed and its comment now records that this is the SECOND time the same
anchor has been outrun by the same function's signature (it was re-aimed on 2026-09-04 when `why` was
added). The abilities stage re-ran: `reds not ok: (none)`, and all three roster artifacts report 18 /
36 / 44 red demonstrations with zero not-ok.

---

## 4. The chain, in full, with every flag

Every leg through `cmd /c tools\lownode.cmd` (BelowNormal) with
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`. **Every leg judged on the artifact's
own `generated` stamp and the size of its output, never on the exit code** — the abilities stage exits
1 by design on `CONTROL-NOT-QUIET` rows and its clause still passes.

| leg | result | artifact `generated` | release in artifact |
|---|---|---|---|
| `tests/test-engine-diff.js --n 6000 --seed 20260804 --write` | 6000 compared, **0 disagreed** | 2026-09-10T05:43:47.858Z | `8ac9c4d888f1` |
| `tests/roster.js --stage items --reds --write` | 142 of 148 tested, **0 DIFFER, 0 DID-NOT-FIRE** | 2026-09-10T05:44:03.905Z | `8ac9c4d888f1` |
| `tests/roster.js --stage abilities --reds --write` | 139 of 201 tested, **0 DIFFER, 0 DID-NOT-FIRE**, 0 dead anchors | 2026-09-10T06:07:06.183Z | `8ac9c4d888f1` |
| `tests/roster.js --stage moves --reds --write` | 487 of 500, **0 DIFFER, 0 DID-NOT-FIRE** | 2026-09-10T05:45:28.080Z | `8ac9c4d888f1` |
| `engine/all_mechanics_fire.js --kind all --write` | **1313 games played, 0 threw**; moves diverged 4, abilities 1, items 0 | 2026-09-10T05:45:34.816Z | `8ac9c4d888f1` |
| `engine/game_differential.js` (flags in §1) | 618 lines; 961 games | 2026-09-10T05:50:33.574Z | `8ac9c4d888f1` |
| `engine/quarantine.js` | **GATE: OPEN**, 9 of 9 clauses PASS | — | reads the six above |
| `engine/status.js` | prints no QUARANTINE block at all — nothing is withheld | — | — |

Beside the chain, and all green after the three edits: `tests/test-resolution-order.js` **26 arms, 0
failing**; `tests/probe_red_demo.js` **200 demonstrations, 0 HOLLOW, 0 COULD NOT BE APPLIED**;
`tests/probe_fail_names_the_move.js`, `tests/probe_substitute_family.js` and
`tests/probe_selfswitch_update_pass.js` green.

## 5. What the gate says

```
GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
  PASS  game differential
  PASS  deliberate roster / items         142 of 148 tested
  PASS  deliberate roster / abilities     139 of 201 tested
  PASS  deliberate roster / moves         487 of 498 tested
  PASS  coverage / every used mechanic is measured by something
  PASS  whole-game differential / BOARD-MATERIAL      0 of 961
  PASS  whole-game differential / NARRATION           ZERO undeclared across 961
  PASS  mechanics / each one staged and compared against showdown
  PASS  no open, known engine defect
```

**This is the printed clause, not a judgement.** `gates` on the narration clause is the board clause's
own verdict, so it would flip back the moment a board parted again.

## 6. Files touched

```
engine/medicham2-browser.js              three fixes, two new knobs, two new MEDFAILS counters
tests/roster.js                          the blocks-priority plant anchor, re-aimed
tests/probe_shedtail_refusal_line.js     NEW
tests/probe_redirect_above_prepare.js    NEW
tests/probe_sucker_try_above_terrain.js  NEW
```

Artifacts rewritten: `data/engine-diff.json`, `data/roster.{items,abilities,moves}.json` (+ `.prev`),
`data/roster.{all,}.json` convenience copies, `data/all-mechanics-fire.json`,
`data/game-differential.json`, `data/releases/8ac9c4d888f1/`, and the files `status.js` restamps.
**`data/mechanics-census.json` was not touched.**

## 7. A RED TEST THIS PASS DID NOT CAUSE, AND THE MEASUREMENT THAT SAYS SO

`node tests/test-docs-current.js` exits 1: **34 passed, 1 failed** —
*"no living document gained untraceable figures (57 across 6 documents): docs/MODELS.md: 30
untraceable figures, was 29"*, naming exactly one figure,
`docs/MODELS.md|7,381`.

**It is inherited from HEAD (`6e460b1f`), not from this pass.** Proved rather than assumed: the
census traces a figure through `allArtifactNumbers()` over `data/` and through `changelogHas()` over
the whole CHANGELOG. `docs/MODELS.md` is not modified by this pass; a CHANGELOG addition can only make
MORE figures traceable, never fewer. And rebuilding the artifact number set with **HEAD's copies of
all thirteen data files this pass rewrote** answers the same way:

```
7381   now: false     with HEAD artifacts: false
```

So the count was already 30 at HEAD and the clause was already red there. `data/docs-currency-baseline.json`
was stamped 2026-09-10T02:25:45.983Z at CHANGELOG top 5.277.0, and commit `6e460b1f` republished the
gate artifacts after it without re-stamping.

**Why it is not fixed here.** The figure is a historical `n_games` from commit `44e0fb0`, quoted inside
a retraction paragraph in `docs/MODELS.md`. `data/pory-eval.json` reads `n_games 5883` today, so a
citation pointing at it would be FALSE, and writing 7,381 into the CHANGELOG to buy the
`changelogHas()` exemption would be laundering a number rather than tracing one. The census's own
sentence is the remedy: *"a figure here is generated, cites an artifact, or is deleted."* That is a
judgement about a PORY figure in the model ledger, which is not ENGINE's to make.

**It is reported, not filed.** It is stated here and in the verdict rather than left to be found.

---

## OWED, NOT RUN

```bash
# 1. THE CENSUS STILL STANDS ON 489bea0577bc AND IS NOW TWO ENGINE CHANGES OLD. It was pinned on this
#    chain rather than regenerated, deliberately, so the fixes could be attributed. Re-run it FIRST in
#    the next session, then re-pin, and note that every differential taken after it answers a slightly
#    different question.
cmd /c tools\lownode.cmd tests\test-mechanics.js
node engine/status.js

# 2. THE GATE IS OPEN, SO THE QUARANTINED SET IS RE-RUNNABLE, NOT TRUE. ROADMAP #57 is the list. A
#    quarantined number does not become true when MEDICHAM becomes correct; it becomes re-runnable.
#    9 figures are still WITHHELD on provenance (UNSAFE inputs), which is a separate condition from
#    the gate and does not lift with it.
node engine/provenance.js

# 3. THE PERISH DECLARATION'S EVIDENCE IS OLDER THAN THE ENGINE. Its no-board-effect claim was measured
#    on release 5f3f7141227c (2026-08-28) and the current artifact is 8ac9c4d888f1. The clause prints
#    EVIDENCE NOT RE-CHECKED on every run. Re-measure it against these bytes or restate the ruling.
node -e "const j=require('./data/game-differential.json');console.log(j.state.protocol_diverged_board_never_did, j.state.games_board_never_diverged, j.state.games)"

# 4. THE SUPREME OVERLORD DECLARATION MATCHED NOTHING IN THIS RUN — the narration clause prints
#    '[AUTHORITY-WRONG] Supreme Overlord `fallenundefined` MATCHED NOTHING IN THIS RUN — a declaration
#    that covers no cause is a claim that has quietly become false. Withdraw it or show the cause it
#    excuses.' It is still matched by the MECHANICS clause, so check both before withdrawing.
node -e "const j=require('./data/all-mechanics-fire.json');console.log(JSON.stringify(j.summary&&j.summary.moves&&j.summary.moves.diverged))"

# 5. TWO REFINEMENTS NAMED IN THE 2c FIX AND NOT CLAIMED BY IT, because no probe fails on them today:
#    the authority hands psychicterrain.onTryHit the POST-REDIRECT body and exempts an ALLY outright
#    (data/moves.ts:14122, `if (target.isSemiInvulnerable() || target.isAlly(source)) return;`). This
#    engine's terrain gate still uses the pre-redirect aim and has no ally clause. Write the probe first.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/probe_sucker_try_above_terrain.js

# 6. THE SIDE GUARDS ARE STILL AT `TryMove`. Quick Guard and Wide Guard are `condition.onTryHit`, the
#    same step as the terrain, and `sideGuardRefuses` is still asked at the pre-dispatch gate above the
#    move's own `Try`. Same shape as 2c, no failing probe on it yet.

# 7. THE LIGHTNING ROD BOOST LINE IS A SECOND SHAPE, seen while staging 2b and NOT this card:
#      showdown  |-ability|p1a: Raichu|Lightning Rod|boost   then   |-boost|p1a: Raichu|spa|1
#      medicham                                                     |-boost|p1a: Raichu|spa|1|[from] ability: lightningrod
#    The differ normalises it away today; it is one `-ability` line this engine does not write.

# 8. CARRIED, UNTOUCHED BY THIS CHAIN:
node tests/test-fixture-legality.js
cmd /c tools\lownode.cmd tests\test-mutation-coverage.js --write
node tests/test-board-browser.js
# 9. THE DOCS-CURRENCY RED, INHERITED FROM HEAD AND PROVED NOT TO BE THIS PASS'S (see section 7).
#    One figure: docs/MODELS.md|7,381, a historical PORY n_games inside a retraction paragraph.
#    data/pory-eval.json reads n_games 5883 today, so a citation would be false and a CHANGELOG entry
#    would be laundering. It needs a PORY judgement in the model ledger, not an engine fix.
node tests/test-docs-current.js
node -e "console.log(require('./data/pory-eval.json').n_games)"
```
