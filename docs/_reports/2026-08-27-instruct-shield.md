# Instruct meets a shield — the authority announces the shield and gives no second action

2026-08-27, ENGINE. **DIAGNOSIS ONLY — nothing under `engine/` was touched and no release was cut.**
Everything below is measured against **release `345f4193d440`** (cut 2026-08-28T00:11:47Z), which was
byte-identical to the live simulator when this session started and **is not any more**: the live
`engine/medicham2-browser.js` moved 94 lines under a scan taken forty minutes into the session, so a
pinned read was the only honest one available.

---

## LEAD — WHAT THE AUTHORITY DOES, CITED AND STAGED

**A shield REFUSES Instruct outright. It writes `|-activate|<TARGET>|move: Protect`, no `-fail`
anywhere, and NO SECOND ACTION. There is no ally exception.**

The line, from `gen9championsvgc2026regmb`, seed `[1,2,3,4]`, staged this session:

```
|move|p2a: Oranguru|Instruct|p1a: Alakazam
|-activate|p1a: Alakazam|move: Protect          <- a FOE's shield

|move|p2a: Oranguru|Instruct|p2b: Garchomp
|-activate|p2b: Garchomp|move: Protect          <- an ALLY's shield, identically
```

against what it looks like when it works (same board, ally not shielded):

```
|move|p2a: Oranguru|Instruct|p2b: Garchomp
|-singleturn|p2b: Garchomp|move: Instruct|[of] p2a: Oranguru
|move|p2b: Garchomp|Rock Slide|p1b: Clefable|[spread] p1b
```

Why, read rather than recalled:

- `data/moves.ts:9644-9677` — `instruct: { category: "Status", target: "normal",
  flags: { protect: 1, bypasssub: 1, allyanim: 1, failinstruct: 1 }, onHit(target, source) {…} }`.
  **The second action is queued inside `onHit`** (`this.queue.prioritizeAction(this.queue.resolveAction({choice:'move', pokemon:target, moveid:target.lastMove.id, targetLoc:target.lastMoveTargetLoc}))`, `:9666`).
- `sim/battle.ts:1300-1302` — `checkMoveBypassesProtect(move, attacker, defender, blockStatus = true)`
  returns **false** when `(move.category !== 'Status' || blockStatus) && move.flags['protect'] && runEvent('HitProtect', …)`.
  `blockStatus` is at its default `true` here, and Instruct carries `flags.protect`, so it does not bypass.
- `data/moves.ts:13987-14000` — `protect.condition.onTryHit` therefore does **not** return early:
  it writes `this.add('-activate', target, 'move: Protect')` and returns `this.NOT_FAIL`.
- `sim/battle-actions.ts:643-652` — `hitStepTryHitEvent` is **step 1**. Instruct's `onHit` is six steps
  below it, so the target is filtered out of `trySpreadMoveHit` before `lastMove` is ever read, and no
  `-fail` is written (`NOT_FAIL` is `''`, and the second loop is what stops `''` becoming `false`).
- **Champions overrides Instruct NOWHERE.** The only occurrence in `data/mods/champions/` is
  `learnsets.ts:12384`, `instruct: ["9M"]`. `protect` is overridden at `moves.ts:755` with
  `{ inherit: true, pp: 5 }` — the PP and nothing else.

**THERE IS NO ALLY EXCEPTION and it was measured, not inferred** — `checkMoveBypassesProtect` never
looks at sides. The ally arm above is the proof. The same staging shows a **Worry Seed aimed at a
Protecting ALLY** is refused identically (`|-activate|p2b: Garchomp|move: Protect`), which matters
below.

---

## WHAT THIS ENGINE DOES — AND THE BRIEF'S PREMISE IS HALF RIGHT

`if(a.kind==='instruct')` (release `345f4193d440`, line **24603**) asks Good as Gold, Instruct's own
`refuses` list, `_charging` and `_recharge`, and calls `shieldRefuses` **nowhere**. It splices a
second action into the turn at `:24647`.

Probe `tests/probe_instruct_shield.js`, **5 arms, 3 failing, exit 1**:

```
RED — PARTS   instruct-foe-protect          reduced line 12
   showdown  |-activate|p1a: Alakazam|move: Protect
   medicham  |-singleturn|p1a: Alakazam|move: Instruct|[of] p2a: Oranguru
   medicham next  ["|move|p1a: Alakazam|protect|…","|-singleturn|p1a: Alakazam|Protect","|upkeep"]
   MEDSEEN.instructRepeat = 1

RED — PARTS   instruct-foe-spikyshield      same shape, Chesnaught
RED — PARTS   instruct-foe-banefulbunker    same shape, Toxapex
CONTROL HELD  instruct-foe-kingsshield      instructRepeat = 0
CONTROL HELD  instruct-foe-noshield         instructRepeat = 1   (the mechanic is alive)
```

**THE BRIEF SAID "AN EXTRA ACTION THROUGH A PROTECT" AND THAT IS TRUE. IT IS NOT AN EXTRA ATTACK, AND
THAT DIFFERENCE IS THE WHOLE SIZE OF THE THING.** The only way a body can be holding the `protect`
volatile is to have clicked a shield **this turn** at priority +4, so its last move IS the shield —
in the authority by construction, and in this engine because the shield pre-pass writes both fields
on one line (`it.mon.protect=_stallRoll(it); it.mon._lastMove=it.a.mv||'protect'`, `:21153-21154`,
and that is the **only** writer of `protect = true` in the file; `grep '\.protect='` returns one
write-true, two write-false and one reset). **So the extra action is always a repeat of the shield
click, never a repeat of an attack.** A fixture built to show an extra Rock Slide through a Protect
cannot exist.

---

## IS IT BOARD-MATERIAL? YES — MEASURED, ONE LEAF

Run under `--state`, the differential's own board comparator:

```
instruct-foe-protect      BOARD PARTED at turn 1 — 1 leaf:
    p1.pp[0].protect      medi=2   sd=1
CONTROL noshield          BOARD IDENTICAL
```

`board_state.js` maps PP as *what has been spent*, so the target spends **two Protect PP where the
authority spends one**. `r.stateDiv !== null` is exactly the `board_parted` predicate the gate counts,
so this is board-material by the instrument rather than by argument. Nothing else moved: the stall
counter, HP, boosts and statuses all agreed, and the spliced action resolves at `TURN_ORDER.next`
before every remaining move, so it cannot reorder anything either.

**Honest size, stated up front: one PP and three protocol lines per occurrence, on a board that a
961-game pool sample does not contain.**

---

## THE 277 — IT IS NOT IN ANY ARTIFACT, AND THE NUMBER THAT IS MEANS SOMETHING ELSE

`grep` finds no `277` for Instruct anywhere. What exists:

| artifact | value | what it actually counts |
|---|---|---|
| `data/tags.json`, `data/abra-tags.js` → `moves.instruct.uses` | **283** | **SHEET SLOTS.** `tag_dex.js:usage()` walks `loadCorpus({scope:'all'}).games` and increments per `g.sheets[side]` entry that lists the move. A declaration, not a click. |
| release `345f4193d440`'s pinned `tags.json` | 283 | same, one store-append older |
| `data/regulation-usage.json` → `raw.moves.instruct` / `clean.moves.instruct` | **2559 / 800** | a THREE-SOURCE union (declared sheets + inferred sets + clicked `m.mv` off the turn stream), so a declaration and a click both land in it |
| `data/team-pool-frozen` (derived this session) | **287 sheet slots** in 17,381 games; **286 games** hold an Instruct sheet AND some shield | still declarations |

**The nearest thing to a 277 in the repo is `tests/regulation_usage.js`'s own header table, where
`moves 277` is the SIZE OF THE 99%-OF-USAGE MOVE PREFIX on the raw corpus** — a count of distinct
moves, nothing to do with Instruct. I would treat the 277 as a mis-carried figure.

**None of these counts the thing that matters**, which is *how often an Instruct resolves into a
standing shield*. That number is measurable and is effectively zero in the pinned sample — see the
prediction.

---

## IS ANY OTHER CALLER STILL MISSING? DERIVED, NOT GUESSED — AND TWO MORE ARE

Every legal body-aimed move in the format was routed through **this release's own
`playerAction`**, then each `if(a.kind==='…')` block was brace-matched in the release source and
asked whether it consults `shieldRefuses`, a bare `.protect`, or nothing:

```
kind          gate            protect-flagged (sheet slots)   members
attack        (own path)      322 (529,725)                   appleacid, beakblast, bonerush, …
affect        shieldRefuses    33 ( 18,356)                    encore, electrify, attract, …
switch        shieldRefuses     1 ( 13,601)                    partingshot
status        RAW .protect     11 (  9,957)                    glare, hypnosis, leechseed, sing, …
yawn          shieldRefuses     1 (  2,124)                    yawn
trickitem     shieldRefuses     3 (    542)                    trick, switcheroo, corrosivegas
instruct      NONE              1 (    283)                    instruct           <-- THE TARGET
reorder       shieldRefuses     1 (    262)                    quash
abilitywrite  shieldRefuses     3 (    250)                    worryseed, entrainment, simplebeam
typechange    shieldRefuses     4 (    226)                    soak, trickortreat, magicpowder, forestscurse
abilityswap   shieldRefuses     1 (    200)                    skillswap
healdesc      shieldRefuses     1 (    169)                    healpulse
sharehp       shieldRefuses     1 (     72)                    painsplit
statrewire    shieldRefuses     3 (     23)                    speedswap, powersplit, guardsplit
pploss        shieldRefuses     1 (      9)                    spite
pass          NONE              1 (      4)                    reflecttype
lockon        NONE              1 (      0)                    lockon
```

Four findings, each checked rather than read off the table:

1. **`attack` is NOT a hole.** It never calls `shieldRefuses` and does not need to: the damage path
   keeps its own `tg.protect && !_thruProtect && !_pierceP`, a declared exception with a written
   reason. Its two no-flag members are **Feint (979) and Phantom Force (727)**, and both carry
   `ignoresProtect`, so `_thruProtect` already exempts them. Verified by listing them, not assumed.

2. **`status` ASKS THE WRONG QUESTION AND IT IS A LIVE, BOARD-MATERIAL DEFECT.** It reads a bare
   `t.protect` (`:26010` region, `if(t.protect){if(TR)TR.act(t,'move: Protect');continue;}`), which is
   blind to `shieldsUser.blocksStatus`. **King's Shield is the one member with `blocksStatus: false`.**
   Staged this session, Thunder Wave into a King's Shield:

   ```
   showdown  |-status|p1a: Aegislash|par
   medicham  |-activate|p1a: Aegislash|move: Protect
   ```

   with **two controls holding** — the same board under `protect` (blocksStatus true) is IDENTICAL,
   and the same board with no shield at all is IDENTICAL. So the fixture has one reason and it is the
   `blocksStatus` read. **This is a paralysis that lands in the authority and does not land here.**
   351 sheet slots for King's Shield; Aegislash is its only legal carrier. NOT MINE TO FIX — filed here.

3. **`lockon` is a genuine second missing caller, single-reason, zero usage.** Staged with Dragapult
   (the only legal Lock-On user): shielded → parts (`|-activate|p1a|move: Protect` vs
   `|-activate|p2a: Dragapult|move: lockon|[of] p1a: Alakazam`, and the guarantee is APPLIED here);
   **shield cleared → IDENTICAL**. Board identical, so narration plus an uncompared volatile. `uses` 0.

4. **`pass`/Reflect Type is NOT evidence of a shield defect and must not be counted as one.** Its
   shielded arm parts — and so does its **cleared** arm (`|-start|…|typechange|[from] move: Reflect
   Type` vs nothing, board `p2.active[0].types medi="psychic/water" sd="psychic"`). Reflect Type is
   simply unimplemented. **A fixture that qualifies for two reasons proves nothing**, so this is
   reported as an unimplemented move (4 sheet slots), not as a shield hole.

### AND A FIFTH THING, WHICH IS A SUSPICION WITH A MEASURED AUTHORITY HALF

**Six of the seven sites landed tonight gate their shield term on `_isFoe`** —
`if(_isFoe&&shieldRefuses(t,a.mv))` at `statrewire`, `abilitywrite`, `abilityswap`, `typechange`,
`pploss` and `reorder`. Every one of those moves is `target: "normal"` and can be aimed at an ally,
and **the authority refuses an ally-aimed Worry Seed at a Protecting ally** (staged above). So the
`_isFoe` conjunct looks like an over-narrowing on ~970 sheet slots.

**I could not measure our side of it**, and the reason is the instrument: the driver resolves a
`normal` move to `foes[t]` on both engines (`engine/game_differential.js:4281` and `:5521`), so an
ally-aimed `normal` move is **inexpressible in a scripted scenario**. Filed as a suspicion with the
authority half proven and our half unmeasured. **The patch below deliberately carries no `_isFoe`
gate**, so it does not inherit the suspect shape.

---

## PREDICTION — AND THE ANSWER TO "WOULD THIS MOVE BOARD-MATERIAL OFF ZERO"

**NO. It cannot, and the reason is not a hope.**

| figure | now | after the patch | why |
|---|---|---|---|
| whole-game | 1 of 961 | **1 of 961** | unchanged |
| board-material | 0 of 961 | **0 of 961** | unchanged — see below |
| census | 765/765/0 | **765/765/0** | the probe is not registered in `tests/test-mechanics.js`; no mechanic row is added |
| roster moves | 0 FIRED-AND-BOARDS-DIFFER / 0 DID-NOT-FIRE | **unchanged** | the roster's `instruct` row is `FIRED-AND-BOARDS-MATCH` under `move/generic-status`, "clicked ONCE on turn 2 by the aggressor at Goodra-Hisui" — **no shield is staged in it**, so the roster is structurally blind here |
| mechanics clause | 5 of 12 | **5 of 12** | nothing it counts moves |
| damage differential | 0/6000 | **unchanged** | the change never enters the damage function |

**Board-material stays at zero, and the proof is that it is zero TODAY.** `data/game-differential.json`
at HEAD (release `345f4193d440`, 961 games) reads `turn1_boards_identical: 961` and every
`identical_at_end_of_turn` entry at `961/961`. The defect IS board-material — it moves
`p1.pp[0].protect` — so **if the sample contained an Instruct resolving into a standing shield, the
board-material count would already be non-zero.** It is zero, therefore the sample contains none, and
removing the divergence cannot change a count of zero.

**This is a LAB fix, and it should be announced as one before it runs, per the pinned-pool rule.**
The frozen pool holds 287 Instruct sheet slots across 17,381 games (1.6%), a 961-game draw sees ~16
of them, and only a fraction of those ever click Instruct into a shield that is up. Expect the pool to
sit still and the probe to go green; anything else is a surprise worth reading twice.

The one remaining whole-game divergence in the committed artifact is unrelated and untouched —
`baseline`, seed `…2654016071 vs …2654363031`, turn 11, `event missing from medicham2 :: |upkeep <> |faint|p2b`
around a perish count.

---

## THE PATCH, NOT APPLIED

One file, `engine/medicham2-browser.js`, inside `if(a.kind==='instruct')`. Located by anchor because
the live line numbers moved during this session; in release `345f4193d440` this is **between line
24626 (the closing `}` of the Good-as-Gold block) and line 24627 (`const _mid=t&&t._lastMove;`)**.

```js
        /* 2026-08-27 — THE SHIELD, WHICH THIS BRANCH ASKED NOWHERE. Instruct carries `flags.protect`
         * (data/moves.ts:9652), so `checkMoveBypassesProtect` (sim/battle.ts:1300) refuses it at
         * `hitStepTryHitEvent` — step 1 — and Instruct's own `onHit`, where the second action is
         * queued, is six steps BELOW that. Champions overrides Instruct nowhere.
         *
         * IT SITS ABOVE THE `refuses` LIST AND THAT ORDER IS THE MECHANIC. King's Shield is the ONE
         * member of the family with `shieldsUser.blocksStatus === false` AND the one shield carrying
         * `failinstruct`, so the authority lets Instruct PAST the shield and then fails it on its own
         * terms with `|-fail|<the mover>`. `shieldRefuses` reads both facts off the artifact; a bare
         * `t.protect` reads neither, which is the defect still standing in the `status` branch.
         *
         * NO `_isFoe` GATE. `checkMoveBypassesProtect` never looks at sides and an ALLY's Protect
         * refuses an Instruct in the authority — staged, `|-activate|p2b: Garchomp|move: Protect`.
         *
         * NO `mvFail`. The authority ends a shielded move with `moveThisTurnResult` at `null`
         * (ROADMAP #509); `false` is what #508 took OUT of the other sites, and `true` is what the ten
         * already-correct shield sites carry. This joins them rather than opening a fourteenth answer. */
        if(t&&shieldRefuses(t,a.mv)&&!SHIELD_REFUSAL_UNANNOUNCED){
          shieldRefusalAnnounce(t);
          continue;
        }
```

Notes for whoever lands it:

- **`MEDI_SHIELD_REFUSAL_UNANNOUNCED=1` restores this site in ITS OWN old shape**, which for a missing
  caller is *no call at all* — hence the knob is in the condition rather than around the announcement.
  That keeps the knob's stated contract from #508 and gives `probe_instruct_shield.js` a revert control
  it does not have today; the probe should then gain the same `shieldRefusalAnnounced clean=1 knob=0`
  and `MEDFAILS.shieldRefusalUnannouncedRestored` assertions the other shield probe carries.
- **`t` is already null-checked above** (`a.target && !a.target.fainted && a.target.curHP>0`), and
  `shieldRefuses` returns false on a null target anyway, so the `t&&` is belt-and-braces.
- `shieldRefusalAnnounce` bumps `MEDSEEN.shieldRefusalAnnounced`, so this site is countable like the
  other thirteen.
- Expected probe result after the patch: **5 arms staged, 0 failing**, `instructRepeat` 0 on all three
  red arms and still 1 on `instruct-foe-noshield`.

---

## OWED, NOT RUN

```bash
# THE ALLY HALF, WHICH IS THE COMMONER BOARD AND WAS NOT MEASURED ON OUR SIDE AT ALL.
# The authority's half IS measured (|-activate| on a Protecting ALLY, both for Instruct and for
# Worry Seed). Ours cannot be staged: game_differential.js:4281 and :5521 both resolve a `normal`
# move to foes[t]. Either the script format grows a negative `t`, or this stays unmeasured.

# NOT RUN, and deliberately — another agent holds the simulator and the game slot:
node engine/game_differential.js --games 1200 --arm middle --release <new> --state --end-state --write
node tests/roster.js --stage moves --release <new> --write
node engine/all_mechanics_fire.js --kind all --release <new> --write
node tests/test-mechanics.js
node engine/status.js
node engine/quarantine.js
node tests/test-engine-diff.js --n 6000 --seed 20260804

# NOT MINE, FILED HERE, EACH WITH A STAGED PROOF ABOVE:
#   `status` branch reads a bare `t.protect` -> Thunder Wave refused by a King's Shield that does not
#     block status. |-status|par vs |-activate|. TWO controls hold. BOARD-MATERIAL.
#   `lockon` branch never asks the shield. Single-reason, cleared control IDENTICAL. 0 corpus uses.
#   Reflect Type (kind `pass`) is UNIMPLEMENTED — its cleared arm parts too, so it is NOT a shield row.
#   `_isFoe &&` on six shield sites landed tonight: the authority refuses an ally-aimed Worry Seed at
#     a Protecting ally. Our half unmeasurable with the current script format.

# DEBRIS REPORTED, NOT DELETED (untracked, not created by this session):
#   data/_pair-pilot.json   data/medicham-represented-clicks.json
#   .scratch_eng_diffrun.cmd (pins a DIFFERENT simulator — nothing here executed it)
# Nothing in this session ran an unpinned command: every run passed --release 345f4193d440 explicitly.
```

**RUN, with the results above:**

```bash
SHOWDOWN_PATH=... node tests/probe_instruct_shield.js --release 345f4193d440   # 5 arms, 3 failing, exit 1
```
