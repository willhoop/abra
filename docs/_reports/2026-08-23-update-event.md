# The in-move Update pass: one insertion, one relocation, six of six cleared — and the sixth was never the Update event

**ENGINE, 2026-08-23.** Historical record, per `docs/_reports/` convention. Not current state;
superseded by the register rows it feeds. Every figure is read out of a run whose command is printed
beside it, or cited to a line in the pinned Showdown checkout
(`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`).

---

## 0. VERDICT

**ONE INSERTION AND ONE RELOCATION. NOT A STRUCTURAL PIECE.** This engine already had an Update pass
— `_updateAll`, ROADMAP #81 WIRE 7 — and it ran at ONE of the authority's THREE positions per action.
What was missing was the position, not the machinery. Landing it cost:

1. a **split** of `_updateAll` into `_updateEvent` (the event) and `_updateAll = _updateEvent +
   restoreStatsAll` (the schedule), because the White Herb rides on a different event that merely
   shares the schedule; and
2. a **step** in the existing per-move step list, one position above `_stepFaint`.

**The sixth of the six divergences the brief named was never this event.** Stone Axe's
`|-sidestart|p2:|stealthrock <> |faint|p2a` is `onAfterHit` inside `spreadMoveHit`
(`battle-actions.ts:1120`), and the two field families that hang off it — the hazard-laying pair and
the hazard-sweeping pair — sat **400 lines below the step list**. That is stage 2, and it is a
relocation of two blocks into one step.

**Six of six cleared. Nothing regressed. Narration fell and did not rise.**

---

## 1. THE NUMBERS, WITH ARM AND PINS NAMED, AS A RE-BASELINE

```
cmd /c tools\lownode.cmd engine\game_differential.js --games 1200 --release <id>
       --team-store data\team-pool-frozen
       --census data\verification\census-pin-9446a684709d.json --end-state --write
```

| quantity (arm `middle`) | baseline `3929459bb195` | stage 1 `c9a5c5a5826d` | stage 2 `c30534af567b` |
|---|---|---|---|
| `diverged`, protocol parted (RAW) | 57 | 54 | **53** |
| `mid_void.void_games` | 2 | 2 | **2** |
| **`undeclared` (`diverged − declared`), the gate clause's own headline** | **52 of 961 = 5.4%** | 49 of 961 = 5.1% | **48 of 961 = 5.0%** |
| `declared` (5 Supreme Overlord `fallenundefined`, never counted) | 5 | 5 | 5 |
| `mid_void.diverged_among_usable` (`diverged − void`), a DIFFERENT quantity | 55 of 959 = 5.74% | 52 = 5.42% | **51 of 959 = 5.32%** |
| board-material causes / games | 23 / 24 | 23 / 24 | **23 / 24 — did not move** |
| narration-only causes / games | 29 / 33 | 25 / 30 | **24 / 29 — fell, did not rise** |
| DIFFERENT-END-STATE, all games | 18 | 18 | **18** |
| DIFFERENT-END-STATE among parted games | 17 | 17 | **17** |
| census probed / live / missing | 660 / 660 / 0 | 661 / 661 / 0 | **662 / 662 / 0** |
| damage differential, `--n 6000 --seed 20260804` | 0 of 6000 | 0 of 6000 | **0 of 6000, all 16 corners** |
| roster items / abilities / moves | 0 DIFFER, 0 DID-NOT-FIRE | — | **identical, on the FINAL release** |
| `all_mechanics_fire --kind all`, `diverged` | moves 20 / abilities 9 / items 1 | — | **identical** |

**THERE ARE THREE QUANTITIES HERE AND THEY ARE NOT INTERCHANGEABLE — THE BRIEF WARNED ABOUT EXACTLY
THIS, AND THE FIRST DRAFT OF THIS TABLE GOT IT WRONG.** The `game-differential.json` artifact carries
two of them and `engine/status.js` computes the third:

| name | definition | baseline | final |
|---|---|---|---|
| `diverged` (raw) | games whose protocol parted, arm `middle` | 57 | 53 |
| **`undeclared`** | `diverged − declared`, where `declared` is the 5 Supreme Overlord `fallenundefined` games the authority itself gets wrong. **This is the gate clause's headline and the brief's number.** | 52 of 961 = 5.4% | **48 of 961 = 5.0%** |
| `mid_void.diverged_among_usable` | `diverged − void_games`, where the 2 VOID games are an instrument desync | 55 of 959 = 5.74% | 51 of 959 = 5.32% |

The `declared` count is 5 on both artifacts — verified by counting `fallenundefined` in
`first_divergences`, not assumed — so the whole 4-game move is real and none of it is a declaration
changing under the measurement.

### 1a. Per-game attribution

Joining the baseline and the final `first_divergences` lists on the game seed:

```
  games that GAINED a first divergence        0
  games that STOPPED diverging entirely       4
        ordering :: |-sidestart|p2:|stealthrock       <> |faint|p2a
        ordering :: |-enditem|p2b|ironball|[from]fling <> |faint|p1a
        ordering :: |-enditem|p2a|sitrusberry|[eat]   <> |-damage|p1b|H/H|[from]recoil
        ordering :: |-enditem|p2a|sitrusberry|[eat]   <> |-damage|p1a|H/H|[from]lifeorb
  games whose first divergence MOVED LATER    2
        was  ordering :: |-enditem|p1a|sitrusberry|[eat] <> |-damage|p2a|H/H|[from]recoil   idx 42
        now  event missing from medicham2 :: |-heal|p2a|H/H|[from]drain <> |-damage|p1b|H/H idx 76
        was  ordering :: |-enditem|p2b|sitrusberry|[eat] <> |faint|p2a                      idx 116
        now  ordering :: |-miss|p1b|p2b <> |-activate|p2a|protect                           idx 130
```

The two "moved" rows are the honest half: those games still diverge, on causes that were already
there and were simply hidden behind an earlier mismatch. Both new causes already existed in the
baseline table on other games.

---

## 2. WHAT `Update` ACTUALLY SETTLES — DERIVED, NOT LISTED

```js
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;
D[kind].all().filter(legal).filter(x => x.onUpdate || (x.condition && x.condition.onUpdate))
```

**15 abilities, 11 items, 3 move conditions.**

| kind | members |
|---|---|
| ability | Disguise, Commander, Ice Face, Trace, and eleven status-refusers: Immunity, Insomnia, Limber, Magma Armor, Oblivious, Own Tempo, Pastel Veil, Thermal Exchange, Vital Spirit, Water Bubble, Water Veil |
| item | Aspear, Cheri, Chesto, Leppa, Lum, Mental Herb, Oran, Pecha, Persim, Rawst, **Sitrus** |
| move condition | Fling (the spend), Attract, Syrup Bomb |

**Champions overrides none of them.** `grep -n onUpdate data/mods/champions/{abilities,moves,items,conditions}.ts`
returns nothing, so the mainline handlers are the ones that run. `sitrusberry.onUpdate` is
`data/items.ts:5748-5752`; Oran's is `:4401-4405`; Fling's condition is on the move.

So the pass settles: **items eaten at an HP threshold, status cured by a berry or by an ability that
should never have allowed it, PP restored, a Mental Herb spent, a forme reverted (Disguise, Ice Face),
Commander, a Trace still seeking, a Fling's item leaving the hand, and a per-turn-boost volatile whose
source has left the field.** That is state, not commentary — which is why the state instrument was run
on every stage.

---

## 3. WHERE IT BELONGS, AND WHY INSIDE THE LOOP DIFFERS FROM AFTER IT

```
hitStepMoveHitLoop (sim/battle-actions.ts:857; Champions' copy at data/mods/champions/scripts.ts:429)

  for (hit ...) {
    [moveDamageThisHit, targetsCopy] = this.spreadMoveHit(...)             :947
    if (!moveDamage.some(val => val !== false)) break;                     :955   <- THE GATE
    ... damage accounting ...                                              :961-966
    this.battle.eachEvent('Update');                                       :967   <- (A)
    if (!pokemon.hp && targets.length === 1) { hit++; break; }             :968
  }
  this.battle.faintMessages(false, false, !pokemon.hp);                    :976
  if (move.multihit ...) this.battle.add('-hitcount', ...)                 :978
  if (move.totalDamage) this.applyRecoilDamage(...)                        :982
  ... gotAttacked / timesAttacked ...                                      :988
  this.battle.eachEvent('Update');                                        :1003   <- (B)
  this.afterMoveSecondaryEvent(...)                                       :1005   <- Life Orb pays here

runAction (sim/battle.ts)
  this.faintMessages();                                                   :2831
  this.eachEvent('Update');                                               :2842   <- (C), the only one
                                                                                     this engine had
```

**(A) is above the faint, above `-hitcount` and above the recoil. (C) is below all three plus the
whole rest of the action.** That is the entire defect: every `onUpdate` handler settled one action
late. On the pinned pool it surfaced as five games where a `-enditem|…|sitrusberry|[eat]`, or a
fling's `-enditem`, landed under a recoil line, a Life Orb line or a `|faint|`.

**Why it differs for a MULTI-HIT move**, which the brief asked for explicitly: (A) is INSIDE the loop,
so the authority settles between hits. A Sitrus holder taken below half by hit 2 of a Rock Blast is fed
before hit 3 is priced. **This engine wraps the step list once per MOVE, so it gets ONE pass and not
n** — the same limitation `tests/test-resolution-order.js` already carries as a declared KNOWN-OPEN
arm. It is stated here rather than quietly inherited.

---

## 4. THE SPLIT, AND WHY IT WAS NOT OPTIONAL

`_updateAll` was `eachEvent('Update')` **plus** `restoreStatsAll` — the White Herb sweep. The herb's
triggers are `onAnySwitchIn`, `onAnyAfterMega`, `onAnyAfterMove` and `onResidual`. `AfterMove` is
raised in `useMove`, a level ABOVE `useMoveInner`, so it has **no counterpart inside the hit loop**.

Calling the whole of `_updateAll` from inside a move would therefore spend a White Herb mid-move: a
new wrong answer bought with a right one, and one that moves Speed (Unburden) rather than just a line.
The function's own comment had said the two were different events since WIRE 11; they were still one
callable. They are now:

```js
const _updateEvent = () => { /* fling spend, perTurnBoost source-left, the three berry onUpdates */ };
const _updateAll   = () => { _updateEvent(); restoreStatsAll(actA, actB); };
```

**The gate on the in-move call is the authority's own.** `:955` breaks out of the loop above (A) when
every target was refused. `_reached > 0` is the same population — a miss, a Protect and a type
immunity all leave it at zero — and the skip is counted
(`MEDSEEN.inMoveUpdateSkippedNoTarget`), never silent.

---

## 5. THE AUTHORITY WAS ASKED, NOT RECALLED

Every expectation below was OBSERVED by staging the board in the official simulator
(`new Battle({formatid: 'gen9championsvgc2026regmb', seed: [1,2,3,4]})`, HP set directly) and printing
`battle.log`.

**Stage 1, arm 1 — the target's berry is fed above the recoil.** Talonflame Brave Birds a Snorlax
holding a Sitrus at 129/235:

```
|-damage|p2a: Snorlax|44/235
|-enditem|p2a: Snorlax|Sitrus Berry|[eat]
|-heal|p2a: Snorlax|102/235|[from] item: Sitrus Berry
|-damage|p1a: Talonflame|125/153|[from] Recoil
```

**Stage 1's over-fire control — the ATTACKER's own berry, spent by its OWN recoil.** The same click
with the Sitrus on Talonflame at 84/153:

```
|-damage|p1a: Talonflame|56/153|[from] Recoil
|-enditem|p1a: Talonflame|Sitrus Berry|[eat]
|-heal|p1a: Talonflame|94/153|[from] item: Sitrus Berry
```

The `-enditem` is BELOW the recoil, because that body was still above half when (A) ran; only (B) can
see it. **An engine that settled the Update at the top of the move, or that moved the recoil instead
of the berry, satisfies the first stream and breaks this one.** It read `eat 2 / recoil 1` before AND
after the change.

**Stage 1, arm 2 — the partner's berry is fed above the corpse.** Garchomp Earthquakes a 1 HP Snorlax
beside a Clefable holding a Sitrus at 93/170:

```
|-damage|p2a: Snorlax|0 fnt
|-damage|p2b: Clefable|14/170
|-enditem|p2b: Clefable|Sitrus Berry|[eat]
|-heal|p2b: Clefable|56/170|[from] item: Sitrus Berry
|faint|p2a: Snorlax
```

**Stage 1, the fling — same pass, a different handler family.** Gengar flings an Iron Ball into a 1 HP
Snorlax:

```
|-damage|p2a: Snorlax|0 fnt
|-enditem|p1a: Gengar|Iron Ball|[from] move: Fling
|faint|p2a: Snorlax
```

**Stage 2 — Stone Axe's rock is laid above the corpse.** Kleavor's Stone Axe into a 1 HP Snorlax:

```
|-damage|p2a: Snorlax|0 fnt
|-sidestart|p2: B|move: Stealth Rock
|faint|p2a: Snorlax
```

**Stage 2's separator arm — Rapid Spin, whose secondary was ALREADY above the faint.** Corviknight's
Rapid Spin into the same body, with Stealth Rock on its OWN side:

```
|-damage|p2a: Snorlax|0 fnt
|-boost|p1a: Corviknight|spe|1
|-sideend|p1: A|Stealth Rock|[from] move: Rapid Spin|[of] p1a: Corviknight
|faint|p2a: Snorlax
```

The `-boost` is the move's own secondary and this engine already wrote it above the faint. **So an
engine that had moved the whole move rather than this family reads identically on the Stone Axe arm
and differently here.** That is why both are staged.

---

## 6. THE PROBES, EACH SHOWN RED UNDER ITS OWN KNOB

Both read the protocol stream out of `battleInit({trace})` and assert a POSITION. A board comparison
cannot see any of it — heal and damage commute, so every one of these turns ends on the same HP
either way, which is exactly why the differential files the family as `ordering`.

| probe | RED (under the knob) | GREEN |
|---|---|---|
| `item`/`healsAtThreshold` — *"a hit that drops a body below half feeds it BEFORE the recoil line and BEFORE the faint"* | eat 2 / recoil 1; partner eat 4 / faint 3 | eat 1 / recoil 3; partner eat 3 / faint 5 |
| `move`/`hazardOnHit` — *"a hazard laid or swept by a hit is announced ABOVE the `\|faint\|` of the body that hit killed"* | `["\|faint\|","\|-sidestart\|"]` on both members | `["\|-sidestart\|","\|faint\|"]` |

**Each knob turns EXACTLY its own probe red and nothing else** — verified by running the full census
under each: `MEDI_NO_INMOVE_UPDATE=1` gives 661/662 with the healsAtThreshold row missing,
`MEDI_HAZARD_BELOW_FAINT=1` gives 661/662 with the hazardOnHit row missing, and clean gives 662/662.

**`MEDI_HAZARD_BELOW_FAINT` RELOCATES, IT DOES NOT SKIP.** The step no-ops and the old site calls the
same function, because a knob that merely skipped the step would produce an engine with no Stone Axe
at all — a demonstration of the wrong thing.

Each probe also clears its control explicitly: the recoil arm is repeated with NO item (the eat index
must be `-1`), and the hazard arms are repeated with X-Scissor off the same Kleavor onto the same body
(no side line at all).

---

## 7. THE BUG THIS PASS CAUSED, AND THE PROBE THAT CAUGHT IT

This is the part worth keeping.

Moving the two hazard blocks into `_STEPS` turned an EXISTING census row from LIVE to MISSING:
`move`/`hazardOnHit` — *"Ceaseless Edge lays Spikes only when it connects — through a Sub, not through
a Protect"* — read **`throughSub` 0 layers where it must read 1**.

The driver is

```js
for (const _step of _STEPS) for (const R of _rows) { if (R.out) continue; MID_TGT = …; _step(R); }
```

so **a step whose scope is the whole MOVE never runs at all when EVERY row is `out`**, and a
Substitute that eats the hit sets exactly that (`medicham2-browser.js:22528`). The blocks used to sit
below the driver, where no row liveness could reach them. Nothing about the move's effect had changed;
only who was allowed to run it.

**`out` AND `_reached > 0` together mean a Substitute, and the authority runs both passes there.**
`tryPrimaryHitEvent` returns `HIT_SUBSTITUTE`; `spreadMoveHit` sets `damage[i] = true` and
`targets[i] = null` (`battle-actions.ts:1063-1066`), so `moveDamage.some(val => val !== false)` at
:955 is TRUE and the loop does **not** break above the Update. A miss, a Protect and a type immunity
all leave `_reached` at zero and are refused by each step's own gate.

So both once-per-move steps get an **idempotent backstop** immediately below the driver, and it is
**counted** — `MEDSEEN.afterHitFieldFlushed`, `MEDSEEN.inMoveUpdateFlushed` — so that "the step is in
the list" and "the step ever runs" stay different claims. `tests/probe_red_demo.js` patches the driver
line by literal text; it is untouched and its four WIRE 10 arms read OK.

**The lesson is the repository's own and it landed again: a silent default looks exactly like a
working feature.** The step was in the list, the code was verbatim, the new probe was green, the
differential improved — and a mechanic had stopped firing. Only a probe somebody wrote months ago for
a different reason said so.

---

## 8. A CLAIM IN THE PREVIOUS PASS'S LEDGER, WITHDRAWN AS FALSE

`docs/ENGINE.md`'s hand list said:

> **`_stepSelfPay` is step 3 of 9 and holds two things the authority puts below `faintMessages`.**
> Recoil is `battle-actions.ts:982` and Life Orb's `onAfterMoveSecondarySelf` is reached at :1005…

**`_stepSelfPay` holds none of that.** It holds the drain, `selfDrops` and the recharge arming — all
three of which the authority pays inside `spreadMoveHit`, i.e. exactly where they are. Recoil and the
Life Orb toll are **already below the whole step list**, which is below `_stepFaint`. Measured on a
staged board rather than argued:

```
bravebird KO             |-damage|p2a|0fnt   |faint|p2a   |-damage|p1a|[from]recoil
bravebird KO + Life Orb  |-damage|p2a|0fnt   |faint|p2a   |-damage|p1a|[from]recoil
                                                          |-damage|p1a|[from]item:lifeorb
xscissor  KO + Life Orb  |-damage|p2a|0fnt   |faint|p2a   |-damage|p1a|[from]item:lifeorb
```

which is the authority's order in all three. The paragraph was reasoning from the file's LAYOUT, and
the layout had already been fixed. Both the hand-list row and the proposed register row are struck
with the measurement beside them.

---

## 9. WHAT IS NOT CLAIMED

- **The SECOND in-move pass, `battle-actions.ts:1003`, is NOT added.** It sits below the recoil and
  above `afterMoveSecondaryEvent`. It costs nothing on the pinned pool today, and the reason is
  arithmetic rather than luck: the only handler between :1003 and the end of the action that this
  engine defers is the Life Orb toll, and **a body cannot hold Life Orb AND a berry**. It is named as a
  register row rather than smuggled in behind the first.
- **The pass is per HIT in the authority; this engine gets one per move.** §3.
- **STATUS moves never reach this step list**, so their Update still waits for the between-action pass.
  That lands at the same point in the stream — nothing is emitted between :967 and the end of the
  action for a move that dealt no damage — but it is stated rather than assumed, and it is where a
  future divergence in this family would come from.
- **No claim about strength.** Not measurable from here.

---

## 10. OWED, NOT RUN

```
node tests/test-mechanics.js                          RUN — 662/662 live, 0 missing, 0 hollow, 0 threw
                                                            and once under EACH knob, red on exactly one row
tests/test-engine-diff.js --n 6000 --seed 20260804    RUN — twice (stage 1, stage 2), exit 0, 0 disagreed,
                                                            all 16 corners, interior clean
engine/game_differential.js (the pinned run)          RUN — twice: stage 1 and stage 2, against the
                                                            baseline artifact read from git HEAD
node engine/move_result_state.js --selftest           RUN — 18 passed, 0 failed
node tests/probe_announce_failure.js                  RUN — 8 arms, BOARD + RESULT + NARRATION all ok
node tests/test-resolution-order.js                   RUN — exit 0
node tests/test-end-state.js                          RUN — exit 0
node tests/test-protocol-trace.js                     RUN — exit 0
node tests/test-volatile-duration.js                  RUN — exit 0
node tests/test-engine-consistency.js                 RUN — exit 0
node tests/test-encore-fail-silent.js                 RUN — exit 0
node tests/test-game-diff.js                          RUN — exit 0
node tests/probe_punish_announce.js                   RUN — exit 0
node tests/probe_lifeorb_toll.js --release …          RUN — every clause held
node tests/probe_drag_body.js --release …             RUN — every clause held
node tests/probe_mental_herb_order.js                 RUN — exit 0
node tests/probe_selfdestruct_winner.js               RUN — exit 0
node tests/probe_fail_and_silent.js                   RUN — exit 0
node tests/probe_volatile_leaves.js                   RUN — exit 0
node tests/probe_red_demo.js                          RUN — exit 1, PRE-EXISTING AND DECLARED
                                                            (tests/run-all.js:321). WIRE 10's four arms OK
node tests/roster.js --stage {items,abilities,moves}  RUN — on the FINAL release, 0 FIRED-AND-BOARDS-DIFFER
                                                            and 0 DID-NOT-FIRE on all three
node engine/all_mechanics_fire.js --kind all --write  RUN — on the FINAL release, diverged moves 20 /
                                                            abilities 9 / items 1, identical
node engine/status.js --write                         RUN at the end of this pass
node engine/quarantine.js                             NOT RUN — the differential clause was run directly
                                                            at the pins
tests/interaction_matrix.js                           NOT RUN
node tests/run-all.js                                 NOT RUN
node engine/replay_one.js                             NOT RUN
```

- **No fit, no self-play, no `mew.js`.** `board.js`, `magnemite.js` and `engine-data.js` untouched.
  `docs/ROADMAP.md` untouched.
- **Two untracked files left alone as instructed:** `data/_pair-pilot.json` and
  `data/medicham-represented-clicks.json`.
- **Stages 1 and 2 landed in ONE commit.** The brief encouraged one commit per stage; the two changes
  are interleaved inside one file, and splitting them would have meant reverting and re-applying live
  bytes rather than recording history. The attribution the brief asked for is carried by the **two
  frozen releases and the two pinned differential runs**, which is where it can be re-read.
- **A pre-existing red in the instrument, reported and NOT fixed here:** the whole-game differential
  still prints *"THE STATE COMPARATOR FAILED ITS OWN PROOF"* with `planted_state_proof_ok: false`,
  because six of its plants read `NOT APPLIED` (all want a BENCHED body the fixture does not carry).
  True of the baseline artifact as well. **MEASURE's.**
