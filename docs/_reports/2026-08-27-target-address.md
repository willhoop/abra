# The random-target die had no shared address, and six lookahead draws sat in front of it

**2026-08-27, ENGINE. LANDED.** Release `a4b2832e0a0f`. ROADMAP `#478` closed, `#506` and `#507`
filed. CHANGELOG 5.186.0. Probe: `tests/probe_random_target_die.js` (new).

---

## VERDICT

**BOARD-MATERIAL 2 -> 0 OF 961, predicted before the run.** `state.games_board_never_diverged` is
**961 of 961** and `state.first_board_divergences` is **empty**, read out of the written artifact.
The deliberate roster is clean at **139 / 129 / 475** with zero `FIRED-AND-BOARDS-DIFFER` and zero
`DID-NOT-FIRE`.

**Will's stated bar — board-material zero AND the roster clean — is met, as measured. The computed
gate has NOT opened and is still 2 of 8.** It scores the WHOLE-GAME rate (6 of 961, every one
narration) and the mechanics tail (5 of 12, the obscure tail he deprioritised on 2026-08-23). It has
no board-material clause at all. Re-cutting it to read board-material is his 2026-08-22 ruling, not
yet implemented in the instrument, and it moves a published number — so it is named here and left to
MEASURE. **Do not read "board-material zero" as "quarantine lifted".**

| quantity | before (`git show HEAD:data/game-differential.json`) | after (`data/game-differential.json`) |
|---|---|---|
| board-material (`games − games_board_never_diverged`) | **2** (961 − 959) | **0** (961 − 961) |
| whole-game (raw diverged − declared) | **6** (11 − 5) | **6** (11 − 5) |
| census live / probed / missing | 765 / 765 / 0 | 765 / 765 / 0 |
| damage differential, all sixteen corners | 0/6000 | 0/6000 |
| roster items / abilities / moves tested | 139 / 129 / 475, 0 and 0 | 139 / 129 / 475, 0 and 0 |
| `PIN_DIGEST` | `48e1007ac14a` (v4) | **`ccb365985023` (v5)** — moved on purpose |

Pins for the run: `--games 1200 --arm middle --turns 12 --team-store data/team-pool-frozen
--census data/verification/census-pin-9446a684709d.json --state --end-state --release a4b2832e0a0f`.

---

## 1. THE PREDICTION, MADE BEFORE ANY RUN

> board-material 2 -> 0. Whole-game 6 -> 5 (one of the two games parts its protocol and one does not),
> **with a real chance of a rise** — the `any` bucket loses ~177 lookahead draws per 30 target draws,
> so every remaining `any` `nth` re-shifts. Census unmoved at 765/765/0. Damage unmoved.
> `PIN_DIGEST` moves by design.

**Board-material was right. Whole-game was wrong and stayed at 6.** §5 says exactly why, and it is
not a wash: no game closed, none newly parted, and one row changed its cause.

---

## 2. THE DEFECT, IN TWO HALVES

`Battle#getTarget` gates its named-target branch OFF for `randomNormal` (`sim/battle.ts:2461`) and
falls through to `getRandomTarget` (`:2487`) -> `Side#randomFoe` (`sim/side.ts:367`) ->
`Battle#sample` -> `PRNG#sample` -> `random(len)`. **Which foe an Outrage hits in a double is a die.**
Both engines roll it; they did not roll the same one.

**(a) The address could not match.** `BattleActions#runMove` calls `getTarget` on
`sim/battle-actions.ts:223` and `setActiveMove` only on `:245`. At draw time `battle.activeMove` and
`battle.activeTarget` are both null, so `game_differential.js`'s `midDraw` wrote
`<seed>|<turn>|any|-|-|<nth>`. medicham2 writes `MID_MOVE`/`MID_TGT` at the top of the action
(`medicham2-browser.js`, the `actionMoveId(it.a)` block) and drew ~165 lines below, at WIRE 144, so
its address read `<seed>|<turn>|any|outrage|<TARGET slot>|<nth>`.

**(b) `nth` could not match either, and this is what kills the previously-proposed remedy.** Every
authority draw in that bucket on one staged Outrage board, attributed by REAL STACK (the instrument
was wrapped so a stack is recorded only when an address is actually consumed — the first attempt
misaligned because range-form draws are pinned and take none):

```
  [0] 20260813|1|any|-|-|0   Side.randomFoe <- getRandomTarget <- BattleQueue.resolveAction <- addChoice
  [1] 20260813|1|any|-|-|1   ... <- Battle.getTarget <- Battle.getActionSpeed <- BattleQueue.resolveAction
  [2] 20260813|1|any|-|-|2   ... <- Battle.getTarget <- Battle.getActionSpeed <- Battle.runAction
  [3] 20260813|1|any|-|-|3   ... the same, again
  [4] 20260813|1|any|-|-|4   ... the same, again
  [5] 20260813|1|any|-|-|5   ... the same, again
  [6] 20260813|1|any|-|-|6   ... <- Battle.getTarget <- BattleActions.runMove      <- THE REAL ONE

  medicham2  20260813|1|any|outrage|p20|0                                          <- THE REAL ONE
```

Six of seven are a lookahead family medicham2 does not make at all — one `BattleQueue#resolveAction`
filling in a missing `targetLoc` for a move the request never asked a target for, and five
`Battle#getActionSpeed` resolving a target purely to hand `ModifyPriority` one (`sim/battle.ts:2641`)
and then discarding it.

**So blanking our fields shares a BASE and not an ADDRESS**, which is what `#478`'s own measurement
already said, and under the `fmix32` finaliser that landed the same morning its published 99.3%
projects to **64.2% against a 65.0% coin floor**. That option is dead and is recorded as dead so it is
not re-proposed.

---

## 3. THE FIX

**`engine/game_differential.js`**

- `midWrapBattle(Battle)` wraps `Battle#getRandomTarget` and takes the address from **the method's own
  arguments** — the move id and `pokemon.side.id + pokemon.position`. Those are in scope at the call
  and do not care when `setActiveMove` runs, which is the property that makes this fixable at all. It
  throws if the method has moved, on the same policy as `midWrapShowdown`.
- `BattleActions#runMove` is wrapped to set `MIDW.inRunMove`, **restored rather than cleared**, because
  Dancer and Instruct nest a `runMove` inside a `runMove` and the inner one is still deciding a real
  target.
- `midAddrCat()` is the single place that reads it: inside `runMove` the draw is **`tgt`** and is
  SHARED with medicham2; outside it is **`tgtla`**, a bucket medicham2 never draws in. `tgtla` keeps a
  real address-keyed value rather than being pinned, so the authority's own behaviour is unchanged —
  what changes is only that it stops shifting everything else's `nth`.
- `midDraw` builds the `tgt`/`tgtla` address from `MIDW.tgtMove`/`MIDW.tgtAtt`. **The attacker goes in
  the address and the target does not**: a draw cannot be addressed by the thing it chooses.

**`engine/medicham2-browser.js`**

- `RNG_STREAMS` gains `tgt`. Safe by construction — each stream's seed is the master mixed with the
  stream's own NAME, which `rngStreams`' header states is why the set is stable under addition.
- `midTargetDraw(_R, rng, mvId, attSlot, liveCount)` is the one address builder, save/restore around
  `MID_MOVE`/`MID_TGT`, and its three callers are the three the authority has:
  WIRE 144's re-roll (`runMove`'s own `getTarget`), the Encore override
  (`battle-actions.ts:233`, addressed with the **ENCORED** move id because that is the `baseMove` the
  authority passes) and the called-move aim (`useMoveInner:418`, the **CALLED** move id).

**Three deliberate non-silences.** `mediRng` THROWS, naming the release, if a frozen engine returns no
`d.tgt` — the existing `d[cat] || d.any` fallback would have aliased the target draw straight back to
`any` and re-opened this exact defect under a clean receipt. `MEDFAILS.tgtStreamMissing` counts the
same thing at the engine end. And the three SCALAR arms get `tgt: scalar` named explicitly beside
`tie: scalar`, so the new LCG cannot leak into corners that have never had a live target die — which is
why the digest moves for the middle arm and the two corners stay bit-identical.

---

## 4. THE PROBE — RED FIRST, UNPIPED, THEN GREEN, AND THE SAME RED UNDER THE KNOB

`tests/probe_random_target_die.js`. Every legal `target: 'randomNormal'` move except Struggle
(`outrage`, `petaldance`, `ragingfury`, `thrash`, `uproar`), with a carrier derived from each learnset,
swept over **the attacker slot (p1a / p1b) and the turn** — the two fields that actually move the
address. The moves lock, so turns 2 and 3 re-roll from a fresh address.

**The control this file could most easily have got wrong**, stated in its own header: sweeping the ALLY
or the FOE PAIR would not vary the address at all, so every such cell draws the same value and agreeing
is free. That is precisely the "identical results across a varied knob" trap, arriving as a
false GREEN instead of a false RED.

```
  before   11 of 24 cells agree     13 sent the move at DIFFERENT bodies     exit 1
  after    30 of 30 cells agree                                              exit 0
  knob     11 of 24 cells agree     the SAME 13 cells, by name               exit 0 (child asserts the defect)
```

The before-run's authority answered **p2b on turn 1 for every one of the five moves**, and p2a on turns
2 and 3 — the fingerprint of an address that carries no move name. After the fix it varies per
(move, slot, turn) and medicham2 follows.

**`MEDI_TGT_ADDR_LEGACY=1` restores BOTH halves at once.** medicham2 goes back to the generic stream
under the action's own address, and `game_differential.js` installs neither wrapper. Restoring one half
only would be a THIRD behaviour, not the red — so the child asserts `tgtEnters === 0` on the authority
side and `MEDFAILS.tgtAddrLegacyRestored === 1` on ours, and fails if either is out of step.

**Refusals and receipts, all asserted rather than printed:**

- living foes are counted PER MOVE LINE off both protocol streams (`|switch|p2*` in, `|faint|p2*` out)
  and any cell under two is REFUSED — with one legal target there is no choice to get wrong;
- the AUTHORITY's answers and OURS must each VARY across the sweep, or the file reports it never
  reached a die;
- an ordinary `normal`-target move NAMED at p2b is the over-fire control on every cell, and must land
  on p2b in both engines, clean and under the knob;
- authority receipts: `getRandomTarget` calls **807**, draws inside `runMove` **30**, lookahead draws
  **177**. Zero in either draw column FAILS;
- medicham2 receipts: `randomTargetDrawn` **30**, `randomTargetAmbiguous` **30** (equal, so every cell
  had more than one living candidate), `MEDFAILS.tgtStreamMissing` **0**.

---

## 5. THE TWO BOARD-MATERIAL GAMES — DIFFERENT MECHANISMS, DIFFERENT HALVES

The narrow fix would have closed one of them.

| game | what parted | closed by |
|---|---|---|
| `…2635122796 vs …2634861011` t2 | `p2.staraptor.hp` 81/160 and `p2.incineroar.hp` 170/107 — one Outrage, two different bodies | the **`tgt` category** |
| `…2655780718 vs …2655961808` t7 | `p2.gardevoir.ability` medicham `goodasgold` / showdown `innerfocus`, `protocol_diverged_at_turn: null` | the **`tgtla` evacuation** — Trace's own `sample` sat in the shared `any` bucket behind two `getRandomTarget` lookaheads on that turn, so the authority took `nth 2` and we took `nth 0` |

That second row is the one that justifies the wide scope. It is `#478`'s own recorded second game and
it is not a random-target draw at all — it is a Trace draw whose address was polluted by random-target
lookaheads. A patch that only realigned the `runMove` target draw would have left it standing.

---

## 6. WHOLE-GAME DID NOT MOVE, AND 5 WAS PREDICTED

The seed sets before and after are **identical** — computed set-difference both ways, both empty. No
game closed and none newly parted. Exactly one row changed its cause:

```
  2635122796   before   -damage: a different body :: |-damage|p2b|H/H <> |-damage|p2a|H/H
               after    -start field 4 :: |-start|p1b|confusion|[fatigue] <> |-start|p1b|confusion
```

The Outrage now lands on the same body in both engines; the game runs on and parts a turn later
because medicham2 omits the `[fatigue]` tag when the lock's own expiry confuses its user. **Narration,
with no board leaf** — the same run reports `games_board_never_diverged` 961 of 961. Filed as ROADMAP
`#506` and deliberately not bundled: fixing it in this commit would have destroyed the attribution of
the 2 -> 0 delta, and it is Will's separate narration gate.

The other ten rows are byte-identical, five of them the declared `fallenundefined` family.

---

## 7. A PRE-EXISTING RED, FOUND AND REPAIRED, ATTRIBUTED APART

`tests/probe_mid_cat_reload.js` was **RED at `a888a663`, on all six arms including the first load**,
before any byte of this change. Established by `git stash push -- engine/game_differential.js
engine/medicham2-browser.js`, re-running (exit 1, same six rows), and `git stash pop` — not inferred.

Its two-turn board rested on *"the foes' second Protect fails and the damage only lands on turn 2"*.
Under the `fmix32` hash that landed earlier the same day the Protect that fails on turn 2 is
**Chimecho's**, and Chimecho is immune to Earthquake:

```
  |move|p2a: Chimecho|Protect||[still]   |-fail|p2a: Chimecho     <- its Protect DID fail
  |-activate|p1b: Clefable|move: Protect                          <- both other guards held
  |-activate|p2b: Snorlax|move: Protect
  |-immune|p2a: Chimecho|[from] ability: Levitate                 <- so NOTHING was hit
```

No body hit means no accuracy roll, no crit and no damage roll for the wrapper to categorise, so the
file's own *"every load's showdown draws carry acc/crit/dmg"* clause went red. **That is the assertion
working**: it refused to score a wrapper claim on a board where the wrapper had nothing to do. A
fixture that decayed under a die, not an engine that broke.

A third scripted turn restores it — Showdown's stall counter triples the denominator per consecutive
success, so a guard that has held twice holds a third time one time in nine — and the refusal clause is
untouched, so the next die that strands this board reports itself instead of going quiet. Green, 6 of 6,
categories now `{acc,any,crit,dmg,tgt,tgtla}`.

---

## 8. EVERYTHING ELSE THAT WAS RE-RUN

All green unless noted, all unpiped, all under a `--require` preload that drops the process to
BELOWNORMAL and **exits 96 if `os.getPriority` does not confirm it** (`tools/lownode.cmd` could not be
reached from this shell).

```
tests/test-engine-diff.js --n 6000      0/6000 at midpoint, both corners and all 14 interior indices
tests/test-mechanics.js                 765 live / 765 probed / 0 missing, run_ok true
tests/roster.js --stage {items,abilities,moves}   139/129/475, 0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE
engine/all_mechanics_fire.js --kind all --write   summary byte-identical to HEAD but for release + timings
tests/test-middle-identity.js           GREEN — every claim held
tests/test-middle-draw-scope.js         all clauses green; the broken arm still breaks
tests/test-middle-stall-address.js      GREEN
tests/test-middle-damage-roll.js        all clauses green; the broken arm still breaks
tests/probe_trace_target.js             all clauses green (its red arm still reproduces)
tests/probe_target_swap.js              ALL 19 CLAUSES PASS
tests/probe_mid_cat_reload.js           RED at HEAD -> GREEN, 6 of 6 (see §7)
tests/test-game-diff.js                 exit 0
tests/test-end-state.js                 exit 0
tests/test-speed-tie.js                 exit 0
tests/test-engine-consistency.js        exit 0
tests/test-roster-arm-pin.js            exit 0
tests/test-damage-roll-support.js       exit 0
tests/test-wiring.js                    exit 0
tests/test-mc-key.js / test-mc-seal.js  exit 0
tests/test-tag-params-derived.js        exit 0
tests/test-immunity-gate.js             exit 0
tests/test-volatile-duration.js         exit 0
tests/test-nature-differential.js       exit 0
tests/test-coverage-stop.js             exit 0
tests/test-resolution-order.js          26 arms, 1 KNOWN-OPEN declared, 0 failing  (--max-old-space-size=6144)
tests/test-docs-current.js              23 passed, 0 failed
tests/staged_board.js                   24 of 25 — UNCHANGED from the brief's stated baseline, not mine
engine/open_work.js                     #478 gone from the open list; #506 and #507 present
```

---

## OWED, NOT RUN

- **ROADMAP #506** — the `[fatigue]` tag on a lock's expiry confusion. It is the only non-declared
  whole-game row left of the six. No probe yet; one of `probe_random_target_die.js`'s shape would find
  it. **Not bundled on purpose.**
- **ROADMAP #507** — Healer and Shed Skin drawing unconditionally where the authority checks status
  first. Same class as this fix. Its only evidence is a handler reading in
  `docs/_reports/2026-08-27-stat-pick.md`; nobody has replayed a pooled game to confirm the direction,
  and no board-material game names it.
- **`tgt` is NOT in the void check's `OUT` set.** The overlap floor is computed over
  `{acc,crit,sec,dmg,stall}`. `tgt` is arguably an outcome category now, but adding it changes which
  games void and therefore the headline, and the new bucket's identity rate at pool scale was not
  measured. Left alone deliberately; the measurement is owed before anyone argues either way.
- **The whole-game baseline is stamped two pin generations old** (`2efbc9ed1946` against this run's
  `ccb365985023`), so `quarantine.js` withholds direction of travel and is right to.
  `node engine/quarantine.js --stamp-whole-game` is a decision about which pin is meant to be held and
  was NOT taken here.
- **`chooseAction`'s Encore branch and `lockedAction`'s status-lock aim** still draw from the generic
  stream at COLLECTION time, where the authority has no counterpart draw at all. Neither fired on this
  pool; nothing is claimed about them, but they are the two remaining target draws not on `tgt`.
- **The gate itself.** Board-material is zero and the gate does not read board-material. Re-cutting it
  is MEASURE's, on Will's 2026-08-22 ruling.
- **Debris left in place, reported not deleted:** ~24 untracked `.scratch_*` files and directories at
  the repo root from earlier sessions, plus `data/_scratch-scovillain-dump.json`, `data/_pair-pilot.json`
  and `data/medicham-represented-clicks.json`. None were touched.
