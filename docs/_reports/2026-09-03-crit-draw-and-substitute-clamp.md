# 2026-09-03 — ROADMAP #419 (the delayed hit's crit draw) and #416 (a broken Substitute's clamp)

ENGINE. Two filed damage-path defects, taken one at a time. Both premises **held** — neither was a
row the engine had already closed. Both are now census probes and both roadmap rows are closed.

**Census: 827 -> 828 (#419) -> 829 (#416) live / 829 probed / 0 missing / 0 hollow / 0 threw /
0 unarmed.** Nothing else went down; the two ratcheted columns (`arms {control,test}` and `spends a
REAL TURN`) are unmoved at 829 of 829 and 828 of 829.

**No pool figure is claimed.** Light mode; `engine/game_differential.js` is a banned command. The
prediction was written before the work and is in `docs/ENGINE.md`; the exact invocation is in the
OWED block at the foot of this file.

---

## 1. #419 — THE DELAYED HIT TAKES NO CRIT DRAW AT ALL

### 1.1 The authority line, cited

Champions overrides **nothing** on this path, and that is derived rather than assumed —
`grep futuremove data/mods/champions/*.ts` returns nothing, and `grep -n "getDamage\|getSpreadDamage"
data/mods/champions/scripts.ts` finds only a comment on `:360`.

```
data/conditions.ts:379-422   condition:futuremove
data/conditions.ts:415         this.actions.trySpreadMoveHit([target], data.source, hitMove, true)
sim/battle-actions.ts:1156       const curDamage = this.getDamage(source, target, moveData)
sim/battle-actions.ts:1636         const moveHit = target.getMoveHitData(move)
sim/battle-actions.ts:1637         moveHit.crit = move.willCrit || false
sim/battle-actions.ts:1638-42      if (move.willCrit === undefined)
                                     if (critRatio) moveHit.crit = randomChance(1, critMult[critRatio])
sim/battle-actions.ts:1633         critMult = [0, 24, 8, 2, 1]              (the gen 9 branch)
sim/dex-moves.ts:486               this.critRatio = Number(data.critRatio) || 1     -> 1/24
data/mods/champions/scripts.ts:220 const isCrit = target.getMoveHitData(move).crit
data/mods/champions/scripts.ts:222   baseDamage = tr(baseDamage * (move.critModifier || 1.5))
data/mods/champions/scripts.ts:285 if (isCrit && !suppressMessages) this.battle.add('-crit', target)
```

The whole `futuremove` block was read (`:379` to `:422`), not a truncated head. `onEnd` is what pays
out; `trySpreadMoveHit`'s fourth argument is `notActive`, **not** `isSecondary`, so `suppressMessages`
is falsy and the `-crit` line at `:285` is written for a delayed payout exactly as for a direct click.

### 1.2 The defect, confirmed live

`engine/medicham2-browser.js`'s residual payout drew `_R.dmg()` and nothing else. Its own comment at
the `-damage` site said so:

> *"NO CRIT LINE, AND THAT IS STATED RATHER THAN MISSED: this payout takes no crit draw at all, so
> emitting `-crit` would require inventing one. It is a separate gap."*

**The measurement is the unwired-knob signature, not a missing line.** Handed a crit-CERTAIN die and
then a crit-IMPOSSIBLE one, on the same board:

| | authority | ours (before) |
|---|---|---|
| crit-certain die | 72 damage, `\|-crit\|` present | 69 damage, no line |
| crit-impossible die | 48 damage, no line | 69 damage, no line |
| crit-die draws for the payout | 1 / 1 | **0 / 0** |

The direct-click control on the same attacker (`Stored Power`, derived) answered 39/27 with the line
present/absent on the authority and 54/36 likewise on ours — **the harness can see a crit either
way**, so the delayed row is not immune for a second reason.

### 1.3 The fix

`engine/medicham2-browser.js` only, at the `futureHit` residual block:

- one `_R.crit()` draw, taken **unconditionally** (WIRE 35's rule — a Shell Armor arm and a bare one
  must spend the same stream), addressed like the `dmg` draw beside it and sharing that draw's
  `MID_MOVE` / `MID_ATT` / `MID_TGT` save-restore rather than writing a second copy of the address
  convention (ROADMAP #262);
- `critChance(_rF.mv, _src, suppressedAbility(_src, m), m)` — the same one owner the main path calls,
  so Shell Armor, Battle Armor, a Scope Lens and a raised stage all reach it without another reader;
- the crit is **re-priced** with `dmgRange(..., isCrit=true, ...)` into a **fresh** context, because
  `dmgRangeOneHit` PUSHES onto `rolls` rather than replacing it. Not multiplied: the authority's 1.5
  lands at `scripts.ts:222`, above the randomizer, STAB, the type chart and burn. A rate of exactly 1
  is skipped, because `dmgRange` has already folded that 1.5 in — re-pricing would charge 2.25x;
- `TR.crit(m)` between the effectiveness line and the damage, which is `scripts.ts:270-284` then
  `:285`, the same three-line order the direct path already keeps.

Counters: `MEDSEEN.delayedHitCritDrawn` (one per landed payout — a shortfall against
`delayedHitLanded` means a payout reached the board without spending the die) and
`MEDSEEN.delayedHitCrit`.

### 1.4 The probe, red first

`tests/probe_delayed_crit.js`. Both engines, three real turns, the fixture derived this run (the move
off the `delayedHit` tag, the attacker off the learnset, the target off the type chart, the filler
move off the format). It asserts, per engine: a `-crit` on the crit arm and none on the plain arm,
the damage MOVING between the arms, and a non-zero draw count; plus that the two engines agree on the
line.

- **RED before the fix**: 4 failing clauses, all on the delayed row; both control rows green.
- **GREEN after**: all clauses; ours 104 vs 69 with the line, authority 72 vs 48 with the line.
- **RED again under `MEDI_DELAYED_HIT_NO_CRIT=1`**: the identical four clauses, controls still green.

The first draft of the probe was wrong before the engine was, and it is recorded: it matched the
authority's `-end` line on the raw id `futuresight`, which does not appear in `|-end|p2a: Slowking|
move: Future Sight`. `findIndex` returned `-1`, the block read `found: false`, and the row printed as
*"the authority never paid out"*. The match now folds case and punctuation.

### 1.5 A census row that went red for a FIXTURE reason, and was not quietly repaired

The existing `move | delayedHit` band row (*"the delayed hit SELECTS out of the sixteen-roll band"*)
handed **one plain function to all seven streams** — `rngStreams` aliases them — so the moment the
payout started drawing a crit, bucket 0's `u = 0.03125` fell under Future Sight's 1/24 and the row
read **177** against its own band's **118**.

That is the fixture, not the engine. Its `rng` is now a split struct pinning `crit` to no-crit and
leaving the other six streams on `u`; the other fifteen buckets are byte-identical, verified.
Recorded here because *a row that starts failing when a NEW die reaches it* is exactly the shape that
gets misread as a regression.

---

## 2. #416 — A BROKEN SUBSTITUTE'S `lastDamage` IS THE UNCLAMPED HIT

### 2.1 The authority line, cited

`grep substitute data/mods/champions/moves.ts` returns **0**, so mainline is authoritative here and
that is derived, not remembered. The whole `substitute` block was read (`data/moves.ts:18298-18371`).

```
data/moves.ts:18336  onTryPrimaryHit(target, source, move) {
data/moves.ts:18340    let damage = this.actions.getDamage(source, target, move);
data/moves.ts:18341-43 if (damage > target.volatiles['substitute'].hp) {
                         damage = target.volatiles['substitute'].hp;
                       }
data/moves.ts:18344    target.volatiles['substitute'].hp -= damage;
data/moves.ts:18345    source.lastDamage = damage;
data/moves.ts:18352-54 if (damage) this.actions.applyRecoilDamage(damage, move, source);
data/moves.ts:18355-57 if (move.drain) this.heal(Math.ceil(damage * drain[0] / drain[1]), ...)
sim/battle-actions.ts:1384  recoilDamage = clampIntRange(Math.round(dealt * recoil[0]/recoil[1]), 1)
```

**Nothing double-pays it**, and that was checked rather than assumed: `spreadMoveHit` turns a
`HIT_SUBSTITUTE` result into `damage[i] = true` (`data/mods/champions/scripts.ts:351-353`), which
`hitStepMoveHitLoop` folds to `0` before `move.totalDamage += damage[i]`
(`sim/battle-actions.ts:961-965`), so the outer `applyRecoilDamage(move.totalDamage, ...)` at `:982`
sees nothing from a doll.

### 2.2 The defect, confirmed live

This engine books `dealt += Math.min(dmg, tg.curHP)` about sixty lines **above** the substitute
branch, and the branch returns early with that number standing. The ceiling was the BODY's HP; it was
never the DOLL's. Both readers — the recoil block and `_payDrainRow` — then read it.

| | authority | ours (before) |
|---|---|---|
| Double-Edge into a 35-HP doll | **-12** recoil (`round(35 x 33/100)`) | **-25** |
| Bitter Blade into a 41-HP doll | **+21** heal (`ceil(41/2)`) | **+62** |
| wide-doll control (max HP x12) | -25 and +75 | -25 and +75 |

The control arms agreed number for number **before** the fix, which is what says the defect is the
clamp and not the damage, the spread, the speed order or the harness.

### 2.3 The fix

`engine/medicham2-browser.js` only:

- `_reDealt(nd, cap)` takes an explicit ceiling. The default is `tg.curHP`, so the two existing
  callers (the survival-clamp re-read at the damage site, ROADMAP #358's fix) are byte-identical;
- the substitute branch calls `_reDealt(dmg, _s0)` where `_s0` is the doll's HP read **one line above**
  the subtraction — the same value the authority compares against;
- **one helper, three callers.** Two implementations of "how much did this actually deal" is the
  facts-are-global breach this file has a rule about;
- `MEDSEEN.subDealtCapped` counts the overkills, kept apart from `dealtReReadAfterClamp` because the
  two ceilings are different facts about different bodies.

### 2.4 The probe, red first

`tests/probe_sub_clamp.js`. Both engines, one real turn (the target is given Speed 999 and the
attacker Speed 1, so the doll is up when the hit lands and no residual sits between them). The
fixture is derived: the recoil and drain families off the format, a Substitute learner that is not
immune to either move, bodies built identically on **both** sides so the control arm can be compared
number for number. The attacker starts at half HP so a drain heal is visible.

- **RED before the fix**: exactly the two overkill arms (-12 vs -25, +21 vs +62); both wide-doll
  controls already green.
- **GREEN after**: all four arms, all engines.
- **RED again under `MEDI_SUB_DEALT_UNCLAMPED=1`**: the identical two.
- `tests/probe_recoil_after_clamp.js` — the sibling clamp on the BODY — is still green
  (*"the knob CHANGES the toll: default 53 vs control 54"*).

The knob is deliberately **not** shared with `MEDI_DEALT_BEFORE_CLAMP`: two defects on one switch
cannot be attributed separately.

### 2.5 Declared remainder, not fixed here

**A broken Substitute's drain is `Math.round` where the authority is `Math.ceil`.**
`data/moves.ts:18356` uses `Math.ceil`; `_payDrainRow` uses `Math.round`, which is the ORDINARY
road's rule (`sim/battle.ts:2168`). They coincide for every 1/2-fraction drain move in this format
(`round(x.5) === ceil(x.5)`) and part on a 3/4 one — **Draining Kiss**, 3/4, is the member that would
show it.

This is a different line, it was already on the 2026-08-23 hand list in `docs/ENGINE.md`, and folding
it in would have destroyed this pass's attribution. **The drain arm of the probe therefore agrees
partly by the luck of the fraction, and that is said rather than left to be found.**

---

## 3. WHICH SCOREBOARD, STATED BEFORE ANYTHING WAS CHECKED

Both are rare-mechanic rows under Will's 2026-08-23 ranking, so the prediction is *the lab moves and
the pool sits still*:

| | expected lab | expected pinned pool |
|---|---|---|
| #419 | census +1 | board-parted **unmoved**, possible -1. Future Sight is 20 sheets and the crit is 1/24; the conjunction is rare but not zero, because this engine could not crit a payout the authority could |
| #416 | census +1 | board-parted **unmoved**, possible -1 or -2. Substitute is common; an overkill into a doll with a recoil or drain move is not |

The lab half is **measured**: 827 -> 828 -> 829, 0 missing, 0 hollow, 0 threw. The pool half is
**not run** and is not claimed.

---

## 4. FILES TOUCHED

| file | what |
|---|---|
| `engine/medicham2-browser.js` | the two fixes, two knobs, three counters |
| `tests/test-mechanics.js` | two new census rows; the band row's `rng` cleared to a split struct |
| `tests/probe_delayed_crit.js` | new |
| `tests/probe_sub_clamp.js` | new |
| `data/mechanics-census.json` | regenerated twice (once per row) |
| `docs/ROADMAP.md` | #419 and #416 status cells only — the descriptions are HEAD's bytes verbatim |
| `docs/ENGINE.md` | a new section below the generated block, with its own hand list |

Not touched: `engine/board.js`, `engine/magnemite.js`, `data/engine-data.js`. No fit and no self-play
was run. Nothing was deleted.

---

## 5. OWED — EXACT COMMANDS LIGHT MODE STOPPED ME RUNNING

Everything below is a multi-minute all-core job that this session was forbidden. Run from
`C:\Users\willj\Projects\Pokemon\ABRA` with `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`
set, through `tools\lownode.cmd`.

**Cut a release first, so the pool run has something to pin:**

```
node engine/engine_release.js cut "ROADMAP #419 delayed-hit crit draw + #416 substitute dealt clamp"
node engine/engine_release.js list
```

**The pinned pool, the figure this pass predicts but does not claim.** Pin all three — the release,
the census and the team store — per CLAUDE.md, and prove the samples are identical field by field
(same game count, same census steering digest, same team pool digest, same pin digest) before
quoting any delta:

```
tools\lownode.cmd engine\game_differential.js --whole-game --release <NEW_ID> --team-store data/team-pool-frozen
```

**The before-arm on the SAME release, which is what makes the delta attributable.** Both knobs
restore the exact expressions the fixes turn on:

```
set MEDI_DELAYED_HIT_NO_CRIT=1 && tools\lownode.cmd engine\game_differential.js --whole-game --release <NEW_ID> --team-store data/team-pool-frozen
set MEDI_SUB_DEALT_UNCLAMPED=1 && tools\lownode.cmd engine\game_differential.js --whole-game --release <NEW_ID> --team-store data/team-pool-frozen
```

**The three roster stages, which the quarantine condition reads and which were already stale:**

```
tools\lownode.cmd tests\roster.js --stage items --reds
tools\lownode.cmd tests\roster.js --stage abilities --reds
tools\lownode.cmd tests\roster.js --stage moves --reds
```

`--reds` is not optional — every artifact written without it carries `reds: []` and the gate clause
that reads it is dormant (ROADMAP #513).

**The steered mechanics fire, which the new census rows change the steering of:**

```
tools\lownode.cmd engine\all_mechanics_fire.js --kind moves
tools\lownode.cmd engine\all_mechanics_fire.js --kind abilities
tools\lownode.cmd engine\all_mechanics_fire.js --kind items
```

**The gate and the handoff restamp — the handoff numbers in the ledgers are NOT restamped by this
session and are one pass stale until this runs:**

```
tools\lownode.cmd engine\quarantine.js
tools\lownode.cmd engine\status.js
tools\lownode.cmd engine\status.js --write
```

**The full battery, including the corner damage differential this pass did not re-run:**

```
tools\lownode.cmd tests\run-all.js
tools\lownode.cmd tests\test-engine-diff.js
tools\lownode.cmd engine\register_reality.js
```

`register_reality.js` executes each row's `VERIFIED BY:` command; both new rows name a plain
`node tests/probe_*.js`, which it can run, but **both need `SHOWDOWN_PATH` in the environment or they
exit 2 (NOT RUN, which is not a pass)**.

**Two probes worth running as-is, cheap, that this session did run and that a later one should
re-run after any engine change:**

```
node tests/probe_delayed_crit.js
MEDI_DELAYED_HIT_NO_CRIT=1 node tests/probe_delayed_crit.js
node tests/probe_sub_clamp.js
MEDI_SUB_DEALT_UNCLAMPED=1 node tests/probe_sub_clamp.js
```

**Not owed, deliberately:** the CHANGELOG entry and the version bump, the whitepaper/deck/technical-docs
pass, and the commit. This session does not publish.
