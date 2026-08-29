# CARD F2 — THE `stall` COUNTER WAS ALREADY RIGHT. THE GATE IN FRONT OF IT WAS ARMED ONCE PER TURN, AND THREE SITES REPLACE THE MOVE AFTER THAT.

**2026-08-29. Batch of one. ENGINE.**

Release `cc7dca43e395` -> **`03e049dc7299`**. Census **795 -> 796 live / 796 probed / 0 missing**.
Empirical arm, identical pins: board-parted **97 -> 94** of 961, `active[].stall` **13 leaves / 13
games -> 11 / 11**, protocol diverged **214 -> 213**, `order_probe` unmoved at **2**.

---

## 1. THE VERDICT IN FIVE LINES

- **What the counter does wrong: nothing.** Staged nine ways against the authority before a byte moved
  — consecutive Protect, the `duration: 2` gap, Detect, Endure, Baneful Bunker, a Wide Guard feeding a
  Protect, a Quick Guard on the far side, both slots shielding, and a six-Protect ramp — and every one
  agreed at every turn boundary, counter for counter. The `onHit`-not-`onBlock` rule, the lapse, the
  switch-out wipe and the lost-roll delete are all already correct.
- **What is wrong is the GATE.** `protect.onPrepareHit` runs inside `useMoveInner`, per action at
  execution, so the authority asks it about the move being USED. This engine armed
  `_shieldPending` / `_guardPending` / `_stallPending` **once per turn** in the pre-pass, off the move
  the player CLICKED. Three sites replace that move afterwards and none re-asked.
- **Instruct is the SAME defect, not a second one** — measured by arm, not argued. One trigger closes
  the Encore family and the Instruct family and both mirrors; the knob parts all four identically.
- **The 13-game family moved: 13 -> 11, and board-parted 97 -> 94.** Both scoreboards were predicted
  to move and both did.
- **It did not go to zero, and the remainder is a DIFFERENT defect.** The four surviving
  `-singleturn ... protect <> -fail` games all meet counter 3, so the outcome is the 1/3 roll — and
  one of the four now goes OUR way. An opposite-sign pair on the same denominator is the die, not the
  gate. Filed, not fixed.

---

## 2. HOW THE COUNTER WAS CLEARED, BEFORE THE ENGINE WAS SUSPECTED

The brief asked when the counter increments, what resets it, and whether a switch-out wipes it. All
three were answered by staging rather than by reading, on both engines under the differential's own
`middle` pin, printing `stallBoardCounter(tookProtectTurns)` against `volatiles.stall.counter` at every
turn boundary. **Every arm agreed at every boundary:**

| arm | boundaries (medicham/showdown) |
|---|---|
| `P,P,P,P` | `0/0  3/3  0/0  3/3  0/0` |
| `P,C,P` (the `duration: 2` gap) | `0/0  3/3  0/0  3/3` |
| `P,C,C,P` | `0/0  0/0  3/3  0/0  0/0  3/3` |
| `P,D,P` (Protect then Detect) | `0/0  3/3  0/0  3/3` |
| `E,E,E` (Endure) | `0/0  3/3  0/0  3/3` |
| `WG,P,P,P` (a Wide Guard feeding the counter) | `0/0  3/3  9/9  0/0  3/3` |
| `BB,BB,BB,BB` (Baneful Bunker) | `0/0  3/3  0/0  3/3  0/0` |
| both slots shielding | `0/0  3/3  0/0  3/3` |
| `P x6` | `0/0  3/3  0/0  3/3  0/0  3/3  9/9` |

`clearVolatile` on switch-out is already mirrored at `medicham2-browser.js:19351`
(`out.protect=false; out.tookProtectTurns=0`), and the `duration: 2` lapse at the residual is
`_stallExpire`. **Nothing here needed changing, and the sweep is what made that certain instead of
assumed.**

---

## 3. WHERE IT ACTUALLY BREAKS

`data/mods/champions/moves.ts` overrides `protect` with `{ inherit: true, pp: 5 }` and nothing else,
so the handler is mainline's:

```js
onPrepareHit(pokemon) { return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
onHit(pokemon)        { pokemon.addVolatile('stall'); }
```

`onPrepareHit` lives inside `useMoveInner` — per action, at execution — so it is raised on the move
being USED and cannot see when the action was chosen. This engine decided once per turn:

```js
for (let i = 0; i < acts.length; i++) {          // the turn pre-pass
  if (it.a.kind === 'protect' && …)              it._shieldPending = true;
  else if (it.a.kind === 'wideguard' && …)       it._guardPending  = true;
  else if (TAGS.has('move', actionMoveId(it.a), 'stallCounterChecks') && …)
                                                 it._stallPending  = true;
}
```

Three sites replace `it.a`'s move after that loop has run:

| site | what it does | reached the gate? |
|---|---|---|
| WIRE 143, Encore's execution-time override (`:22417`) | rewrites `it.a` in place, seventy lines below the pre-pass | **no** |
| Instruct (`:25901`) | `acts.splice(actIdx+1, 0, _entry)` — an entry the pre-pass never walked | **no** |
| a called move, Copycat / Sleep Talk (`:24755`) | the identical splice | **no** |

So a substituted shield reached no queue scan, no `StallMove` roll and no counter, and the
`kind:'protect'` branch then announced it off whatever `mon.protect` ALREADY held:

- the body had **no** shield this turn -> `|move|X|protect||[still]` + `|-fail|X`;
- the body **had** one -> a free UNROLLED `|-singleturn|X|Protect`.

**Both signs, one cause**, which is why the pool shows the family in one direction and the staged
Instruct board showed it in the other.

---

## 4. THE POOL, AND WHAT THE 13 WERE

Baseline `data/verification/game-differential.stallbase.json` (release `cc7dca43e395`, pool
`0d103fb9fa87`, census `9446a684709d`, 961 games, cap 12, arm `middle`, empirical steering) reproduces
the brief's figures exactly: 961 games, 2 threw, 214 diverged, **board-parted 97**, `order_probe` 2
rows, `active[].stall` **13 leaves in 13 games**.

Every `stall` leaf in `first_board_divergences` reads the same way round:

```
  p2.active[0].stall   medicham 0   showdown 9
  p1.active[0].stall   medicham 0   showdown 3
  p1.active[1].stall   medicham 0   showdown 3
  p1.active[0].stall   medicham 0   showdown 3
  p1.active[0].stall   medicham 0   showdown 3
```

**We hold no counter where the authority holds one** — exactly what a shield that never reached its
gate leaves behind. **Two of the five part on the BOARD ALONE with `protocol_diverged_at_turn: null`**,
so no line comparison could have found them; the brief's warning that "a block-rate drift leaves every
`-singleturn` byte-identical" is the same point one step earlier.

Seven of the pool's first protocol divergences carry a shield outcome, and the card's F2 count of 2 was
an undercount by shape as well as by number. **Six** read `|-singleturn|pXa|protect <> |-fail|pXa`:

| game | substituted by |
|---|---|
| `…2656709541` t4 | Encore (`-start … move: encore` then `\|move\|p2a: Venusaur\|protect`) |
| `…2634271519` t4 | Encore |
| `…2662294385` t5 | Encore |
| `…2656731680` t7 | Encore |
| `…2634941404` t10 | Instruct (`-singleturn … move: Instruct` then the repeat) |
| `…2657079796` t3 | Instruct |

`…2656731680` is the sharpest: Floette's own Protect on turn 6 FAILED on both engines (so the counter
is provably 0), and on turn 7 the Encore-substituted Protect succeeds on the authority and fails here.
That rules the counter out on its own.

---

## 5. THE FIX — THREE EDITS

`engine/medicham2-browser.js`.

1. **`_armShieldGate(it, idx)`** — the pre-pass's own three branches lifted into a function, MOVED and
   not rewritten: the same order, the same `volatileForbidsMove` question, the same `_preWillAct`
   record, the same `STALL_EAGER_CLEAR` restore. It **clears the three pendings before it sets them**
   and records `it._armMv`, the move id the arming was decided against.

2. **The re-ask at the gate's own call site**, below the `BeforeMove` refusals and above the `|move|`
   line, gated on `it._armMv !== (actionMoveId(it.a) || '')`. That covers all three substituting sites
   **without naming any of them** — the move id is what the arming is a function of, so a fourth
   substituting site cannot arrive silently. An ordinary action costs one string compare and takes the
   identical path. The position is the authority's: `OverrideAction` is raised above the `BeforeMove`
   gates (inside `runMove`) and `onPrepareHit` below them (inside `useMoveInner`), so an Encored body
   that is asleep is refused by sleep and never asks the shield question.

3. **A refused shield no longer takes down one that is already standing.** `mon.protect` is cleared at
   the top of every turn and one body has one action, so until (2) this flag was always false on the
   way into `_shieldGate` and the write was a write. It is not any more. `_shieldRaised` records what
   THIS action did (and is what the `|-singleturn|` / `|-fail|` line reads); `mon.protect` records what
   is standing. On every path that existed before, `_stood` is false and the two are equal.

Counters: `MEDSEEN.shieldGateRearmed` / `shieldGateRearmedArmed` / `shieldGateRearmedDisarmed` /
`shieldStoodThroughRefusal`. `MEDI_SHIELD_NO_REARM=1` restores the pre-pass-only arming and stamps
`MEDFAILS.shieldNoRearmRestored` at module load.

---

## 6. WHICH SCOREBOARD, SAID BEFORE THE RUN

**Said before the run:** Encore and Instruct are not rare in this pool — seven of the first divergences
carry a shield outcome and six of those are substituted shields — and the defect writes a board leaf by
construction, so **both** scoreboards should move: the lab by one row, and the pool on board-parted and
on the `stall` leaf family.

| | before (`cc7dca43e395`) | after (`03e049dc7299`) |
|---|---|---|
| census | 795 live / 795 probed / 0 missing | **796 / 796 / 0** |
| games / threw | 961 / 2 | 961 / 2 |
| protocol diverged | 214 | **213** |
| board-parted | 97 | **94** |
| `active[].stall` family | 13 leaves / 13 games | **11 / 11** |
| `order_probe` rows | 2 | 2 |
| `-singleturn … protect <> -fail` causes | 7 | **4** |

Cause-table diff, the only three rows that moved:

```
  -3   unrelated event mismatch :: |-singleturn|p1a|protect <> |-fail|p1a        5 -> 2
  +1   unrelated event mismatch :: |-fail|p1a <> |-singleturn|p1a|protect        0 -> 1
  +1   extra event emitted by medicham2 :: |-activate|p1a|protect <> |-singleturn|p1a|instruct   1 -> 2
```

The `+1` on the Instruct row is the fix WORKING: our shield now goes up where it used to fail, so the
separate open defect underneath it (Instruct is not refused by a standing shield —
`tests/probe_instruct_shield.js`, 3 of 5 arms, red before and after) becomes visible in one more game.

---

## 7. WHAT IS LEFT OF THE FAMILY, AND WHY IT IS NOT THIS DEFECT

The four remaining `-singleturn … protect <> -fail` games are one shape, read out of
`data/verification/divergence-turns.shieldrearm.json`: in every one the victim's PREVIOUS turn held a
**successful** Protect, so the substituted shield meets counter 3 and the outcome is the 1/3 roll.

Three go the authority's way. **One goes ours** — `…2656940771` t2:

```
  |move|p2b: Sableye|encore|p1a: Aurorus
  |-start|p1a: Aurorus|move: encore
  |move|p1a: Aurorus|protect|p1a: Aurorus
  SHOWDOWN : |-fail|p1a: Aurorus
  MEDICHAM : |-singleturn|p1a: Aurorus|Protect
```

**An opposite-sign pair on the same denominator is a DIE defect, not a gate defect.** The `middle` arm
shares a `stall` stream by category and none of these games is VOID, so the two engines drew the same
NUMBER of stall dice and got different values — which points at the address rather than at the stream.
Not staged, not probed, its own batch.

---

## 8. THE PROBE — `tests/probe_shield_rearm.js`, SHOWN RED FIRST

Eleven arms, five red and six controls, every arm played on both engines under the differential's own
`middle` pin with the identical script. **No expectation is typed anywhere.** The assertions are that
the two engines agree on the shield lines AND on the stall counter, that the knob parts the reds and
moves no control, that the branch counters hit an EXACT per-arm value, and that the authority actually
raised a shield on every red arm (or the arm proves nothing).

**RED FIRST, ON THE ENGINE AS IT STOOD BEFORE THIS BATCH.** `--release cc7dca43e395`:

```
  encore-into-free-protect             stall leaf  b0:0/0  b1:0/0  b2:0/3
    showdown  … -start|p2a|encore -> move|p2a|protect -> -singleturn|p2a|protect
    medicham  … -start|p2a|encore -> move|p2a|protect|still -> -fail|p2a
  encore-into-free-protect-mirror      b2:0/3      instruct-repeat-free-protect      b2:0/3
  instruct-repeat-free-protect-mirror  b2:0/3      encore-into-endure                b2:0/3
```

and the knob does not exist on that release, which the probe reports as `KNOB DID NOT BIND` rather than
absorbing.

| arm | what it clears | clean | knob |
|---|---|---|---|
| `encore-into-free-protect` | red — the pool's own shape | agree | PART |
| `encore-into-free-protect-mirror` | red — the sides exchanged whole | agree | PART |
| `instruct-repeat-free-protect` | red — the OTHER producer, card 6's board | agree | PART |
| `instruct-repeat-free-protect-mirror` | red — and its mirror | agree | PART |
| `encore-into-endure` | red — the `_stallPending` branch, so a `kind === 'protect'` fix stays red. **Its protocol lines are IDENTICAL under the knob and only the STALL LEAF parts** | agree | PART |
| `no-encore` | the knob cleared explicitly, Charm in the Encore's place | agree | agree |
| `plain-protect-chain` | the ordinary path — arming decided once, `_armMv` unchanged | agree | agree |
| `encore-into-nonshield` | the re-ask fires (1) and arms nothing (0) | agree | agree |
| `instruct-repeat-nonshield` | the same on a SPLICED entry | agree | agree |
| `wideguard-plain` | the `_guardPending` path, untouched | agree | agree |
| `endure-plain` | the `_stallPending` path, untouched | agree | agree |

**THE ARMS ARE FREE OF THE DIE BY CONSTRUCTION.** Turn 1 all four bodies click Protect; Toxapex (base
35) is the slowest, holds the LAST action, and the authority refuses its shield at
`!!this.queue.willAct()` — **before** `StallMove` — so it adds no `stall` and draws no roll. Its
`lastMove` is still Protect, so the turn-2 substitution copies a shield and meets counter 0, which the
authority cannot refuse.

**TWO EARLIER FIXTURES WERE DISCARDED FOR EXACTLY THE FAILURE THE BRIEF NAMES.** A staged Encore or
Instruct at counter 3 draws the `middle` arm's 1/3 — which loses on BOTH engines at that address — so
the arm AGREES while testing nothing. Twenty-four different game tags produced byte-identical results,
which is the signature of an unwired knob and was here the PROBE's knob, not the engine's.

**AND TWO FIXTURE FAULTS WERE CAUGHT BY THE INSTRUMENT BEFORE ANY CONCLUSION WAS DRAWN.** `Recover` at
full HP fails and the two engines narrate that failure differently (`|move|X|Recover||[still]` against
`|move|X|recover|X`), so the first draft carried a second unrelated divergence — replaced with Haze.
And `encore-into-nonshield` first staged an Encore onto the move the victim had already clicked, so
`actionMoveId` never changed and the re-arm counter read 0: the exact-count assertion said so rather
than the arm passing quietly.

**THE STALL LEAF IS COMPARED THROUGH THE ENGINE'S OWN MAP.** `M.stallBoardCounter` is the function
`engine/board_state.js` calls, and its three constants come off `stallCounterChecks` and therefore off
`data/conditions.ts`'s `stall`. Calling it rather than copying it is what stops the probe disagreeing
with the board leaf it is about.

**THE CENSUS ROW** is `move / stallCounterChecks — a shield SUBSTITUTED mid-turn still passes the
shield gate and arms the stall counter`, in `tests/test-mechanics.js`, staged through `battleInit` +
two real `battleTurn`s with the same board and the Encore click replaced by a Charm in the control.
`encoreShield(` is declared in the REALTURN list with its reason, so the direct-call ratchet still
reads 1 (the pre-existing `alwaysCrit`).

---

## 9. REGRESSION SWEEP

Green, run after the change: `probe_shield_rearm` (11/11), `test-mechanics` (796/796/0, both ratchets
held), `probe_encore_bracket` (11/11), `probe_protect_stall`, `probe_protect_stage_order`,
`test-middle-stall-address`, `test-middle-identity`, `probe_sound_lock_restart`,
`test-bracket-regain`, `test-encore-fail-silent`, `test-choice-lock`, `test-volatile-duration`,
`test-engine-consistency`, `test-protocol-trace`, `test-wiring`, `test-immunity-gate`,
`test-rollout-effects` (38/0), `test-docs-current` (23/0).

**PRE-EXISTING REDS, UNCHANGED — AND ONE MORE THAN THE BRIEF NAMED:**

- `tests/probe_shield_refusal_line.js` — `13 arms staged, 1 failing`. **In this batch's territory.**
  A/B verified: identical on `cc7dca43e395` and on `03e049dc7299`. **This work does not move it.**
- `tests/probe_random_target_address.js` — `LENGTH MISMATCH sd=61 sites=62`, rc 2. Identical.
- `tests/test-resolution-order.js` — `Reached heap limit`, rc 134. Not runnable; not made runnable and
  not made worse.
- `tests/test-engine-diff.js` — rc 3 with `disagreed 0`. The non-zero is the pool advisory for 9
  undrawable species. `data/verification/engine-diff.n150.json`: 150 compared, 150 agreed, 0 disagreed.
- **`tests/probe_instruct_shield.js` — `5 arms staged, 3 failing`. A FIFTH pre-existing red the brief
  did not name, A/B verified byte-for-byte on `cc7dca43e395`.** It is the Instruct-vs-standing-shield
  refusal and is the reason `shieldStoodThroughRefusal` is reachable today at all.

---

## OWED, NOT RUN

```bash
# the empirical arm, exactly as run here
SHOWDOWN_PATH=... cmd /c tools\lownode.cmd engine\game_differential.js --games 1200 --turns 12 \
  --release 03e049dc7299 --census data/verification/census-pin-9446a684709d.json \
  --team-store data/team-pool-frozen --steering empirical --arm middle --state --end-state \
  --write --out data/verification/game-differential.shieldrearm.json

# the three roster stages and the fire sweep, stale against 03e049dc7299
SHOWDOWN_PATH=... cmd /c tools\lownode.cmd tests\roster.js --items --abilities --moves --write
SHOWDOWN_PATH=... cmd /c tools\lownode.cmd engine\all_mechanics_fire.js --write
node engine/quarantine.js
node engine/coverage.js
```

- **THE SHIELD'S OWN DIE.** Four games, one shape, one of them the opposite sign. The draw COUNTS
  agree (the games are not VOID), so it is the address and not the stream. Its own batch.
- **INSTRUCT IS STILL NOT REFUSED BY A STANDING SHIELD.** Pre-existing, A/B verified, and made one
  game more visible by this fix. Reported rather than filed away.
- **HELPING HAND DOES NOT FAIL WHEN THE ALLY HAS ALREADY MOVED.** Found in a staging run and not in
  the pool: the authority writes `|move|p1b: Furfrou|Helping Hand||[still]` + `-fail` where this
  engine raises the `-singleturn`. Not this batch's, not touched.
- **COPYCAT AND SLEEP TALK ARE COVERED BY CONSTRUCTION AND HAVE NO ARM.** They reach the identical
  splice and the identical move-id trigger, but no arm plays one. Protect carries `failcopycat` and no
  `metronome` flag, so the population may be empty in this format; that was NOT derived and is not
  claimed.
- **`shieldStoodThroughRefusal` READS 0 IN THE POOL** and is expected to become unreachable once a
  standing shield refuses the Instruct. The guard stays because the write it prevents became possible
  in this batch and a silent wipe of a standing shield is exactly the failure this repo is built
  around.
- **`_armShieldGate`'s `idx` IS NOT ENFORCED.** Both call sites pass the live cursor; a caller passing
  a stale index would ask `_anyActionAfter` the wrong question and no counter would say so.
- **`data/game-differential.json` WAS NOT WRITTEN** (mtime still 2026-08-28 23:14). Every write from
  this pass went to `data/verification/`. `data/engine-diff.json` is untouched at 02:49.
- **TWO OPS ARTIFACTS MOVED UNDER THIS SESSION AND I DID NOT WRITE THEM.** `data/kad-replays.js` and
  `data/live.js` are replay/store artifacts and are OPS's. Named so the churn in `git status` is not
  read as this batch's. Not reverted, not committed.
