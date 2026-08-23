# The seven roster reds — 2026-08-23, ENGINE

Historical findings record. Not maintained, not current state. Superseded by the register rows it
feeds and by `node engine/status.js`.

---

## Verdict

Seven `FIRED-AND-BOARDS-DIFFER` rows, briefed as three mechanisms. They are **four**, and **none of
the seven was the instrument** — the instruction was to suspect the instrument first, and this is one
of the times it was not the answer. Two of the three groups regrouped.

| brief's group | what it actually is |
|---|---|
| GROUP 1 "the focus-energy volatile", 4 rows, one cause | **TWO causes.** Fake Out is the Prankster side clause (ROADMAP #9) and has nothing to do with Focus Energy or with Fake Out. Dragon Cheer, Psych Up and Transform are the crit-stage volatile family. |
| GROUP 2 "drain healing rounds wrong", 2 rows | **TWO defects on one line.** Matcha Gotcha is the per-target rounding (ROADMAP #339). Big Root's row is a SINGLE-target Bitter Blade, so the per-target loop cannot explain it — it is the order of operations. |
| GROUP 3 "Protean does not fire on a mega forme", 1 row | **MIS-SCOPED.** Protean never fired on a status move on ANY body. The mega is incidental. |

The shared `vol.focusenergy` leaf in group 1 is real and is not a ruler bug: the roster's control
click IS Focus Energy (ROADMAP #316), so every scenario in `data/roster.moves.json` has a body
carrying that volatile, and any defect touching it surfaces under whatever move was staged beside it.

---

## Will's three domain inputs — all three CONFIRMED, all three derived rather than taken on trust

### 1. Dragon Cheer: two stages on a Dragon — CONFIRMED, with one correction of emphasis

`data/moves.ts:4067-4085` (mainline; Champions overrides no move named here):

```
4079    this.effectState.hasDragonType = target.hasType("Dragon");
4081    onModifyCritRatio(critRatio, source) {
4082      return critRatio + (this.effectState.hasDragonType ? 2 : 1);
4085    target: "adjacentAlly",
```

`target` is `adjacentAlly`, so it is the **ALLY WHO RECEIVES** the cheer that must be a Dragon, not
the user. The value is frozen at `onStart`, deliberately — the authority's own comment cites the
Smogon mechanics-research thread and says a later Tera into Dragon does not change it.

**The roster's own scenario note is wrong and should be corrected**: it reads *"dragoncheer on the
user; Torterra beside it must not gain it"*. The move targets the ally, so Torterra is exactly who
gains it. `tests/roster.js` is ENGINE's file; the note is prose in the scenario and is not fixed in
this pass (it changes no verdict).

### 2. The competing "magnitude" explanation — REFUTED

The suggestion was that `focusenergy` carries a crit-stage count a boolean comparator was coercing,
which would explain both diff directions with one mechanism. It does not:

- `data/moves.ts:5993-5995` — focusenergy's condition is a flat `return critRatio + 2;`. No state.
- Only `dragoncheer` carries state (`hasDragonType`), and `engine/board_state.js` compares
  `vol.focusenergy` only — `vol.dragoncheer` is not a compared leaf on either side.

The both-directions pattern was **two independent defects pointing opposite ways**.

### 3. Matcha Gotcha heals per target — CONFIRMED

`sim/battle.ts:2167-2170`, and the load-bearing fact is the INDENTATION — this sits inside
`spreadDamage`'s `for (const [i, target] of targetArray.entries())` loop:

```
2167  if (this.gen > 4 && effect.drain && source) {
2168    const amount = Math.round(targetDamage * effect.drain[0] / effect.drain[1]);
2169    this.heal(amount, source, target, 'drain');
2170  }
```

Champions does not override `matchagotcha` (no match in `data/mods/champions/moves.ts`).

### 4. Protean is once per switch-in — CONFIRMED, and that half was ALREADY correct here

`data/abilities.ts:3487-3502`. Champions overrides neither `protean` nor `libero` — **0 matches** for
either in `data/mods/champions/abilities.ts`.

```
3488  onPrepareHit(source, target, move) {
3489    if (this.effectState.protean) return;
3490    if (move.hasBounced || move.flags['futuremove'] || move.sourceEffect === 'snatch' || move.callsMove) return;
3491    const type = move.type;
3492    if (type && type !== '???' && source.getTypes().join() !== type) {
3493      if (!source.setType(type)) return;
3494      this.effectState.protean = true;
```

**Where the state lives, which decides what a switch does to it:** it is `this.effectState` on the
ABILITY — `pokemon.abilityState` — not a volatile and not on the Pokémon. It is rebuilt in three
places: `sim/battle-actions.ts:142` (`switchIn`), `sim/pokemon.ts:1930` (`setAbility`) and
`sim/battle.ts:1334-1335` (Skill Swap). So a switch-out clears it; **and so does a mega evolution
mid-game**, which means a body that megas after converting gets a second conversion in the authority.
This engine's tag already carried `oncePerSwitchIn: true` and `switchOut` already cleared
`_proteanUsed`; the mega re-arm is **not** modelled and is now counted at
`MEDFAILS.proteanGuardsUnmodelled` together with the three guards at :3490.

**Family check, by tag shape rather than by name:** `typeBecomesMoveType` has exactly ONE member over
the whole ability table — `protean`, 571 uses. Libero carries the identical shape upstream
(`data/abilities.ts:2308-2323`) and is not in this regulation, so the fix is written against the tag
and would pick it up without an edit.

---

## What landed — four batches, each RED first with its control cleared

Census `data/mechanics-census.json`: **634 probed / 634 live** before → **641 / 641** after.
0 missing, 0 hollow, 0 threw, `directCall` unchanged at 1, `unarmed` 0.

### Batch 1 — ROADMAP #9, the Prankster refusal becomes a FOE clause

`sim/battle-actions.ts:676-677`:

```
} else if (this.battle.gen >= 7 && move.pranksterBoosted && pokemon.hasAbility('prankster') &&
    !targets[i].isAlly(pokemon) && !this.dex.getImmunity('prankster', target)) {
```

`Pokemon#isAlly(p)` is `this.side === p.side || this.side.allySide === p.side` — true of the body
itself. `pranksterBlocked(attacker, target, moveId)` asked only "is the target Dark", at **thirteen**
call sites; exactly one (`tryHitRefusal`) carried the side clause AT THE CALL as
`m._sf && t._sf !== m._sf && pranksterBlocked(...)`. The clause moved into the function.

Reproduction before the fix, staged board, Sableye (Dark/Ghost, Prankster) clicking its own Focus
Energy:

```
|turn|1
|move|p1a: sableye|focusenergy|p1a: sableye
|-immune|p1a: sableye
|upkeep
_vol {}
```

Probe `ability/priorityMod — the Prankster refusal is a FOE clause`. Three arms plus a cleared
control: `Prankster self 0 ally 0 foe 0` before, `1 / 1 / 0` after; `no Prankster 1 / 1 / 1` both
times. Knob `MEDI_PRANKSTER_SIDE_BLIND=1`.

**Roster, run before light mode was called:** `--stage moves --only fakeout --release 89fb8a6190f5`
→ `FIRED-AND-BOARDS-MATCH 1`, `FIRED-AND-BOARDS-DIFFER 0`.

### Batch 2 — the crit-stage volatile family

New derived tag in `engine/tag_dex.js`: `critStageVolatile` matches a legal move whose applied
volatile's condition declares `onModifyCritRatio`. Membership printed before wiring:

```
dragoncheer  {"volatile":"dragoncheer","exclusiveWith":["focusenergy"],"from":"DERIVED:condition.onModifyCritRatio + condition.onStart"}  uses 32
focusenergy  {"volatile":"focusenergy","exclusiveWith":["dragoncheer"],"from":"DERIVED:condition.onModifyCritRatio + condition.onStart"}  uses 12
members: 2
```

Laser Focus is a member by ratio (`data/moves.ts:10039-10041`, a flat `return 5`) and is
`isNonstandard: 'Past'`; Gmax Chi Strike does not exist here. **The exclusion is read per condition,
not assumed across the family** — Laser Focus's `onStart` refuses nothing, so a family-wide rule would
agree with the authority today and be wrong the moment the regulation changed.

`statChangeInCode.op` also gains `copiesVolatiles`, derived from psychup's own handler array literal,
gated on the handler containing both `removeVolatile(` and `addVolatile(`. Membership: one member.

```
psychup {"kind":"copy","stats":"all","from":"target","to":"user","copiesVolatiles":["dragoncheer","focusenergy","gmaxchistrike","laserfocus"]}
```

Three probes, all red under `MEDI_CRIT_VOLATILE_BLIND=1`:

| probe | before | after |
|---|---|---|
| `move/critStageVolatile` | cheer-then-focus **3** (BOTH), focus-then-cheer **3** | **2** and **1** |
| `move/statChangeInCode` (Psych Up) | target-only 0, user-only 1 | **1** and **0** |
| `move/transformsIntoTarget` | target-only 0, user-only 1 | **1** and **0** |

Controls cleared in every arm (focus alone 1, cheer alone 2; neither-side 0, both-sides 1).

Nothing is announced on either side, and that is read rather than assumed: both conditions'
`onStart` take the `['costar','imposter','psychup','transform'].includes(effect.id)` branch and write
`[silent]`, and neither declares an `onEnd`.

### Batch 3 — ROADMAP #339's arithmetic half, and Big Root's order of operations

The line that stood in `_stepSelfPay` was `Math.round(dealt * fraction * mult)`. The authority is four
steps:

```
sim/battle.ts:2168   amount = Math.round(targetDamage * drain[0] / drain[1])    per target
sim/battle.ts:2265   if (damage && damage <= 1) damage = 1
sim/battle.ts:2266   damage = this.trunc(damage)
sim/battle.ts:2268   runEvent('TryHeal')  ->  this.modify at battle.ts:932
                     modify(v, m) = tr((tr(v * tr(m*4096)) + 2047) / 4096)   [battle.ts:2329-2340]
data/items.ts:488-494  bigroot onTryHeal -> chainModify([5324, 4096]) for
                       ['drain','leechseed','ingrain','aquaring','strengthsap']
```

Staged boards, damage measured off the board rather than assumed:

| staging | ours before | authority | ours after |
|---|---|---|---|
| Bitter Blade, 53 damage, no item | 27 | 27 | 27 |
| Bitter Blade, 53 damage, Big Root | **34** | **35** | 35 |
| Matcha Gotcha, 15 + 15 | **15** | **16** | 16 |
| Matcha Gotcha, 14 + 18 (both even) | 16 | 16 | 16 |

The last row is the vacuous case and the probe asserts against it: the spread probe declares itself
NOT STAGED if both damages come out even, rather than passing for the wrong reason.

`md4096` is this engine's existing `modify` (WIRE 4) and is called, not re-written. The probes write
Showdown's `modify` out separately on purpose — importing the engine's own arithmetic would make the
assertion circular.

Knob `MEDI_DRAIN_LUMP_ROUND=1`. `drainBoard(` declared in `REALTURN`, with its reason, because the
direct-call ratchet caught both probes on their first run.

**#339's NARRATION half is NOT closed**: the authority emits one `|-heal|...|[from] drain|[of] TARGET`
per body, interleaved with each `-damage`; this engine still writes one lumped line with no `[of]`.
That was left deliberately — it changes the whole-game protocol comparison and light mode cannot size
that.

### Batch 4 — ROADMAP #356, rescoped: Protean on status moves

`proteanConvert()` extracted from the `kind === 'attack'` branch and called from a second site at the
`PrepareHit` position above the kind dispatch, gated on the move having reached a body
(`statusMoveTargets`) or being one of the four side/field target classes the simulator's own
`getMoveTargets` switch names (`all`, `foeSide`, `allySide`, `allyTeam`).

| click | before | after |
|---|---|---|
| Water Shuriken (Water, damaging) | `Water/Dark -> Water` | unchanged |
| Focus Energy (Normal, status) | `Water/Dark -> Water/Dark` | `-> Normal` |
| Protect (Normal, status) | `Water/Dark -> Water/Dark` | `-> Normal` |
| Taunt (Dark, status) | `Water/Dark -> Water/Dark` | `-> Dark` |
| control: Torrent, all three | unchanged | unchanged |
| once-per-switch-in: Focus Energy then Taunt | — | `Normal` then `Normal` |

The `Protect` row matches the differential card that filed #356 —
`|-start|p1b|typechange|normal|[from]protean` before a `|-singleturn|p1b|protect`. Knob
`MEDI_PROTEAN_ATTACK_ONLY=1`.

---

## The probe was wrong before the engine was, again

Extracting `proteanConvert` I passed `moveFx(mvId)` where `effMoveType` reads `mv.t` off the
`data/engine-data.js` move row (`{t, c, bp}`) — `moveFx` is the secondary-effects table and carries no
type. Every conversion silently became a no-op, including the damaging one that had worked for months.

**It was caught only because the probe carried the OLD, ALREADY-WORKING arm.** The staged board that
read `Water/Dark -> Water` read `Water/Dark -> Water/Dark` the instant the block became a call. A probe
containing only the new status arms would have gone red → red and looked exactly like the fix not
working yet.

---

## Proposed register row text — for the coordinator to land; `docs/ROADMAP.md` NOT edited

**#9** (`harden pranksterBlocked to check the move's target`) — **CLOSED 2026-08-23.**
`sim/battle-actions.ts:676-677` gates the Prankster type immunity on `!targets[i].isAlly(pokemon)`, and
`Pokemon#isAlly` is true of the body itself. `pranksterBlocked` was asked at THIRTEEN sites in
`medicham2-browser.js` and exactly one — `tryHitRefusal` — carried the clause AT THE CALL, so the other
twelve refused a Prankster user's own self- and ally-aimed status moves. Measured before the fix:
Sableye clicking its own Focus Energy produced `|-immune|p1a: sableye` and no volatile. **Found through
Fake Out**, whose roster row differed on `vol.focusenergy` — the roster's control click is Focus Energy
and the derived user is Sableye, so a defect with nothing to do with Fake Out was filed under it. Clause
moved into the function; an unreadable side is counted at `MEDFAILS.pranksterSideUnknown`. Census probe
`ability/priorityMod`, red under `MEDI_PRANKSTER_SIDE_BLIND=1`, three arms plus a no-Prankster control
that lands all three. Roster `--only fakeout` on release `89fb8a6190f5`: FIRED-AND-BOARDS-MATCH.

**#339** (`a spread drain heals once over the summed damage`) — **ARITHMETIC HALF CLOSED 2026-08-23,
NARRATION HALF STILL OPEN, and the row was TWO defects rather than one.** The per-target rounding is
`sim/battle.ts:2167-2170`, inside `spreadDamage`'s own loop; Matcha Gotcha into two bodies for 15 and 15
healed 15 against the authority's 16. **The row did not know about the second half**: Big Root's roster
row is a SINGLE-target Bitter Blade, so the loop cannot explain it — this engine folded the x1.2998
inside the `Math.round` where the authority applies it to the ALREADY-ROUNDED amount in fixed point
(`battle.ts:2265-2268` then `modify` at `:932`; `data/items.ts:492`). 53 damage healed 34 against 35.
Both halves were on one line and landed together. **Still open:** one `|-heal|...|[from] drain|[of]
TARGET` per body, interleaved with each `-damage` — this engine writes one lumped line with no `[of]`.
Probes `move/drain` and `item/healMultBySource`, both red under `MEDI_DRAIN_LUMP_ROUND=1`; the spread
probe declares itself NOT STAGED if both damages are even rather than passing vacuously.

**#356** — **THE ROW IS MIS-SCOPED AND SHOULD BE RETITLED, THEN CLOSED.** Proposed title:
**PROTEAN NEVER FIRED ON A STATUS MOVE, ON ANY BODY — THE MEGA WAS INCIDENTAL. CLOSED 2026-08-23.**
`data/abilities.ts:3487-3502` hangs Protean on `onPrepareHit`, which `sim/battle-actions.ts:590-592`
fires inside `trySpreadMoveHit` ABOVE the whole step list for every move that reached a target, status
or not. This engine's conversion sat inside the `kind === 'attack'` branch — a gap its own comment
beside the Curse branch had already named — so no status click converted on any body. Measured on a
plain Greninja before the fix: Water Shuriken `Water/Dark -> Water`; Focus Energy, Protect and Taunt
all `Water/Dark -> Water/Dark`. The roster caught it on `greninjite` because that scenario clicks the
control move (Focus Energy, Normal, Status) and Greninja-Mega is this format's only Protean carrier
that is a mega; `typeBecomesMoveType` has exactly one member over the whole ability table. **Two of the
row's own claims stand and one does not**: the board-material consequence is right (the body's types
are wrong for every damage calculation after the click) and the second-instrument corroboration is
right, but "on a mega forme" names the wrong population by a factor of every Protean body in the game.
**Once per switch-in was already correct here** — `effectState.protean` at :3489, `abilityState`
rebuilt at `sim/battle-actions.ts:142` — and the probe asserts it. **NOT modelled, counted at
`MEDFAILS.proteanGuardsUnmodelled`:** the three guards at :3490 and the re-arm a mid-game mega gets
through `setAbility` (`sim/pokemon.ts:1930`). Probe `ability/typeBecomesMoveType`, red under
`MEDI_PROTEAN_ATTACK_ONLY=1`.

**NEW ROW — the crit-stage volatile family had none of its three rules. CLOSED 2026-08-23.** Showdown
carries the family as a hand-written array in two files (`data/moves.ts:14229`, `sim/pokemon.ts:1339`);
`data/tags.json` now derives it as `critStageVolatile` from `condition.onModifyCritRatio`, membership
printed before wiring — exactly two, `focusenergy` (12 uses) and `dragoncheer` (32). Three rules over
that set, each cited: the mutual refusal (`data/moves.ts:5984` / `:4069`, read PER CONDITION because
Laser Focus is a member that refuses nothing), Psych Up's copy (`:14232-14239`) and Transform's
(`sim/pokemon.ts:1340-1347`), both through one shared function. Before: a body could carry BOTH
volatiles, which the authority never allows, and neither copier moved either. Three census probes, all
red under `MEDI_CRIT_VOLATILE_BLIND=1`.

**#176 / #183 — `tests/test-effective-identity.js` IS RED and it is not from this pass.** Raw-read
ratchet 1596 against a baseline of 1198. The per-file delta names **none** of the three files changed
here; it is 20 other files, `tests/roster.js` alone moving 247 → 275. Reported so that it is not
carried as a known failure.

---

## OWED, NOT RUN

Light mode was called mid-pass. **The seven reds are not claimed cleared** — one of them (Fake Out) was
re-run and is green; the other six were not re-measured after their fixes.

```
node engine/engine_release.js cut "ENGINE 5.90.0 - prankster side clause, crit-stage volatiles, drain rounding, protean on status"
SHOWDOWN_PATH=... node tests/roster.js --stage moves     --release <that fresh id> --write
SHOWDOWN_PATH=... node tests/roster.js --stage items     --release <that fresh id> --write
SHOWDOWN_PATH=... node tests/roster.js --stage abilities --release <that fresh id> --write
SHOWDOWN_PATH=... node engine/game_differential.js --release <that fresh id> --census data/gate-census.pin.json --team-store data/team-pool-frozen --state
node tests/run-all.js
tools\lownode.cmd engine\quarantine.js
node engine/status.js
node engine/status.js --write
```

`--release <a FRESH id>` and `--write` are both required. A roster run without `--write` exits 0 having
changed no artifact.

**Which scoreboard each fix should move, stated before the run rather than after.** Usage figures read
from `data/tags.json`.

| fix | pool (`data/team-pool-frozen`, real ladder games) | lab (roster + census) |
|---|---|---|
| Prankster side clause | **should move** — `prankster` 12,520 uses, and Dark-typed Prankster carriers refusing their own Protect and their own setup is a live-game event | moves |
| drain per-target rounding | **should move** — `matchagotcha` 8,668 uses | moves |
| Big Root order of operations | should NOT move — 63 uses | moves |
| Dragon Cheer / Psych Up / Transform | should NOT move — 32 / 94 / 119 uses | moves |
| Protean on status moves | **unpredicted** — 571 uses and every status click was wrong, but a Protean body's status clicks are a minority of its clicks | moves |

A flat pool reading on Big Root, Dragon Cheer, Psych Up and Transform is the **expected** result and
should be read as the pinned-pool ranking working, not as the fixes failing.

## Not touched, reported instead

- `engine/status.js` prints a FEATURE SEMANTICS CHECK failure on `data/policy-weights.json` (fixture
  identity 10 → 12 scenarios; damage table 318 → 322 species). Pre-existing, MEASURE's.
- `data/_pair-pilot.json` was untracked in the working tree at the start of this session and was left
  exactly where it was.
- `tests/roster.js`'s Dragon Cheer scenario note says *"dragoncheer on the user; Torterra beside it
  must not gain it"*. The move is `adjacentAlly`, so the ally IS who gains it. The note changes no
  verdict and was not edited in this pass.
