# The two WIRE 4 damage failures are BOTH the harness. Neither is an engine defect.

ENGINE, 2026-08-23 late / 2026-08-24 UTC. Historical record — not current state, not a living
document, never cite it as one.

Brief: `tests/probe_red_demo.js` read *"200 demonstrations, 14 failed"*, twelve of them the known
stale-reversal row, and **two** of them believed to be the engine:

```
FAIL  ROADMAP #81 WIRE 4  a spread move takes x0.75 rounded half up on 4096ths, not a truncation
FAIL  ROADMAP #81 WIRE 4  Life Orb is chainModify([5324,4096]), not Math.floor(d * 1.3)
```

The brief's own instruction was followed: *"Re-derive both from the harness rather than trusting my
two-line summary… If either turns out to be the harness after all, say so and stop on that one."*

**Both turn out to be the harness.** The engine's spread multiplier and its Life Orb multiplier are
correct at every one of the sixteen damage indices, checked against the official simulator on the
demonstrations' own bodies.

---

## 1. What the two rows actually asserted, and what the engine actually gave

Each row played ONE turn with the single scalar `rng5 = () => 0.5` answering every question the
engine asks, and compared the HP lost against one typed constant.

| row | fixture expected | shipped engine gave |
|---|---|---|
| Flamethrower, single target (the spread row's CONTROL) | 64 | **64** — passes |
| Heat Wave, spread | 51 | **52** |
| Close Combat, no item (the Life Orb row's CONTROL) | 80 | **79** |
| Close Combat, Life Orb | 104 | **103** |

## 2. The cause: all four constants are the PRE-#304 SPAN DRAW

ROADMAP #304 replaced medicham2's damage die. It used to draw a POSITION in the integer span:

```
min + floor(u * (max - min + 1))
```

It now selects an INDEX into sixteen, `damageRollIndex(u) = 15 - floor(u*16)`, so `u = 0.5` names
**index 7** rather than the middle of a span. Run the old expression at `u = 0.5` over each
fixture's own band — the bands are written in the rows' own comments:

| fixture | band in the row's comment | `min + floor(0.5*(max-min+1))` | the row's constant |
|---|---|---|---|
| Flamethrower | 58..70 | 58 + floor(0.5·13) = **64** | 64 |
| Heat Wave | 46..56 | 46 + floor(0.5·11) = **51** | 51 |
| Close Combat | 73..86 | 73 + floor(0.5·14) = **80** | 80 |
| Close Combat + Life Orb | 95..112 | 95 + floor(0.5·18) = **104** | 104 |

**Four of four, exactly.** That is not a coincidence available to an engine defect: a rounding bug in
the spread multiplier cannot also move a single-target Close Combat with no item on it, and a Life Orb
bug cannot move the no-item control at all.

Flamethrower coincides at 64 under both conventions, which is **why the cause stayed hidden** — the
control half of the spread row went on passing, so the row looked like a clean red on the subject.

## 3. The engine is right, proven against the authority at every index

Two independent checks, both taken tonight on the tree at release `c30534af567b`.

### 3a. The demonstrations' own bodies, staged in the official simulator

medicham2's own stat lines pushed into a real Champions battle through `engine/champions_sim.js`,
driven with `battle.random = n => (n === 16 ? i : 0)` over `battle.actions.moveHit` — the exact
staging `tests/test-damage-roll-support.js` uses. Then the same four hits played through medicham2's
battle loop with the die ISOLATED BY STREAM (`acc` pinned to hit, `crit`/`sec` pinned off), so the
band is readable at every index:

```
                          index 0 .......................................... 15
 Flamethrower  authority   70 68 68 66 66 66 64 64 64 62 62 62 60 60 60 58
               medicham2   70 68 68 66 66 66 64 64 64 62 62 62 60 60 60 58   IDENTICAL
 Heat Wave     authority   56 54 54 54 52 52 52 52 50 50 50 48 48 48 48 46
               medicham2   56 54 54 54 52 52 52 52 50 50 50 48 48 48 48 46   IDENTICAL
 CC no item    authority   86 85 84 83 82 81 80 79 79 78 77 76 75 74 73 73
               medicham2   86 85 84 83 82 81 80 79 79 78 77 76 75 74 73 73   IDENTICAL
 CC Life Orb   authority  112 110 109 108 107 105 104 103 103 101 100 99 97 96 95 95
               medicham2  112 110 109 108 107 105 104 103 103 101 100 99 97 96 95 95   IDENTICAL
```

And each REVERTED build parts from the authority, which is the knob being watched:

```
 Heat Wave     reverted    54 52 52 52 50 50 50 50 48 48 48 48 46 46 46 44   parts at 14 of 16
 CC Life Orb   reverted   111 110 109 107 106 105 104 102 102 101 100 98 97 96 94 94   parts at 9 of 16
 Flamethrower  reverted    70 68 68 66 66 66 64 64 64 62 62 62 60 60 60 58   UNMOVED (control)
 CC no item    reverted    86 85 84 83 82 81 80 79 79 78 77 76 75 74 73 73   UNMOVED (control)
```

**The two controls are the cases the brief asked to be named and they do not move** — a single-target
version of the same staging for the spread row, and a non-Orb holder for the other. Both are equal
across the shipped and reverted arms AND equal to the authority.

### 3b. The instrument that already owned this question was green

`node tests/test-damage-roll-support.js` — nine staged hits, `§1 SUPPORT` and `§2 PAIRED` at all 16
indices, its own `§B` broken arm shown red — **PASS**. Its fixture already carries both subjects:

- `physical, 100 BP, SPREAD  Earthquake` — 16/16 agree
- `physical, 75 BP, SPREAD   Rock Slide` — 16/16 agree
- `special, 80 BP, SE + ITEM Flash Cannon with Life Orb (ModifyDamage, after the die)` — 16/16 agree

So the claim does not rest on one staging.

## 4. The authority's own lines, read rather than recalled

| what | file:line | what it says |
|---|---|---|
| spread x0.75 | `pokemon-showdown/data/mods/champions/scripts.ts:204-208` | `baseDamage = this.battle.modify(baseDamage, spreadModifier)` with `spreadModifier = 0.75` — `modify`'s 4096ths rounding, **not** a truncation |
| Life Orb | `pokemon-showdown/data/items.ts:3400-3416` | `onModifyDamage(damage, source, target, move) { return this.chainModify([5324, 4096]); }` |
| Life Orb, override check | `pokemon-showdown/data/mods/champions/items.ts` | **no `lifeorb` key** — Champions does not override it |
| the die | `pokemon-showdown/sim/battle.ts:2388-2390` | `randomizer(baseDamage)`, `100 - this.random(16)` |

medicham2 spells the first as `md4096(base, 0.75)` (`engine/medicham2-browser.js:8228`) and the second
as `ch4096(mod, lo)` spent through `mdChain` — both correct.

## 5. Was either an existing open row?

**No, and neither should be filed as a duplicate of one.**

- **ROADMAP #339** — *a spread DRAIN heals once over the summed damage where the authority heals and
  rounds per target* — is a different mechanism at a different site. The brief asked explicitly. #339
  is about `dealt` accumulating across targets before the drain fraction is applied
  (`sim/battle.ts:2167-2170`, the per-target loop inside `spreadDamage`); this was about the spread
  DAMAGE multiplier `modify(baseDamage, 0.75)` inside `modifyDamage`. **#339 is untouched, still open,
  and this pass makes no claim about it.**
- **ROADMAP #338 / `MEDI_ORB_STALE_RANGE`** — the Life Orb TOLL (the recoil) gated on
  `a.move.d.max > 0`. Different half of the item: that is the 10% self-damage, this was the damage
  MULTIPLIER. Unrelated, and the toll row is closed with its own restore knob and census probe.

**No new register row is owed for an engine defect, because there is no engine defect.** A re-scope of
the harness row is proposed in §8.

## 6. What was changed

`tests/probe_red_demo.js` only. **No engine byte moved.** The two rows were re-aimed so they cannot go
stale on a die convention again:

- the die is **isolated by stream** instead of one scalar. The old `rng5` also answered accuracy, crit
  and secondaries, so 90-accuracy Heat Wave **MISSED at indices 0 and 1 and CRIT at 15** — two thirds
  of its band was unreadable and the row could not have been re-aimed as it stood;
- the expectation is the **whole sixteen-index band** against the authority's band, not one number
  from one die position;
- both **controls print on every arm**, so the single-target band standing still while the spread band
  moves is visible in the run output rather than buried inside a boolean.

Result, on the current tree:

```
      [WIRE 4 spread]  control Flamethrower(single) MATCHES the authority   HeatWave(spread) MATCHES
      [WIRE 4 spread]  control Flamethrower(single) MATCHES the authority   HeatWave(spread) PARTS: 54,52,...
  OK  ROADMAP #81 WIRE 4  a spread move takes x0.75 ...   shipped-arm=true  reverted-arm=false
      [WIRE 4 lifeorb] control CloseCombat(no item) MATCHES the authority   CloseCombat(Life Orb) MATCHES
      [WIRE 4 lifeorb] control CloseCombat(no item) MATCHES the authority   CloseCombat(Life Orb) PARTS: 111,110,...
  OK  ROADMAP #81 WIRE 4  Life Orb is chainModify([5324,4096]) ...   shipped-arm=true  reverted-arm=false
```

## 7. The numbers that must not move, and a count that was already wrong

| quantity | required | measured after |
|---|---|---|
| census probed / live / missing | 662 / 662 / 0 | **662 / 662 / 0** — unchanged, and it could not have moved: no engine byte was touched |
| damage differential `--n 6000 --seed 20260804` | 0 of 6000, all 16 corners | **0 of 6000, all 16 corners, exit 0** |

**The differential did NOT move, and that is the expected result here rather than a relief** — it was
never blind to these two multipliers. `test-damage-roll-support.js` already exercised both and was
green. What the differential is blind to is the demonstration harness, which is a different instrument
asking a different question, and the harness's fixture had gone stale.

**AND THE `14 failed` IN THE BRIEF WAS ALREADY 15 ON THIS TREE.** Run tonight against `HEAD`'s own copy
of `probe_red_demo.js`, before any edit: **`200 demonstrations, 15 failed`**. The extra one is

```
FAIL  ROADMAP #81 WIRE 7  the Sitrus is eaten between the two attackers, not at the residual
      shipped-arm=true (must be true)  reverted-arm=true (must be false)
```

— a **HOLLOW** row, not a stale one: the reversal applies, the engine plays, and the reverted build
still satisfies the assertion, so the demonstration cannot fail for the reason it claims. It appeared
between the 01:05Z reading and this one, i.e. under the ENGINE work of 2026-08-23. **It is reported and
NOT fixed here** — it is a different shape from the two this brief owns and it wants its own pass.

After the edit: **200 demonstrations, 13 failed** — the 12 stale reversals plus that one hollow row.

## 8. Proposed register text (ROADMAP is MEASURE's to edit; nothing was written to it here)

**Re-scope of the red-demo harness row:**

> **THE TWO WIRE 4 DAMAGE FAILURES WERE THE HARNESS, NOT THE ENGINE — RE-DERIVED 2026-08-23 BY ENGINE,
> AND BOTH ARE NOW GREEN.** All four typed constants (Flamethrower 64, Heat Wave 51, Close Combat 80,
> Close Combat+Life Orb 104) are exactly the PRE-#304 span draw `min + floor(0.5*(max-min+1))` over the
> rows' own bands; #304 made `rng5 = () => 0.5` name index 7 instead, moving the values to 64/52/79/103.
> The engine matches the AUTHORITY at all sixteen indices on the demonstrations' own bodies, and
> `tests/test-damage-roll-support.js` (Earthquake, Rock Slide, Flash Cannon+Life Orb) is green on the
> same subjects. Both rows now sweep the full band with a printed control that must not move.
> **Neither is ROADMAP #339 (the spread DRAIN's per-target heal, untouched) nor ROADMAP #338 (the Life
> Orb TOLL).** The harness row's remaining scope is the **12 stale reversals plus one HOLLOW row** —
> `WIRE 7 the Sitrus is eaten between the two attackers`, `reverted-arm=true`, which appeared on this
> tree after the 2026-08-23 engine work and has no row of its own.

**New row proposed (ENGINE, unfixed):**

> **A RED-DEMO ROW WENT HOLLOW: `WIRE 7 the Sitrus is eaten between the two attackers, not at the
> residual` READS `reverted-arm=true`.** The reversal applies and the reverted engine plays, and it
> still satisfies the assertion — so the demonstration cannot fail for the reason it claims and the
> WIRE it defends is unwatched. Observed 2026-08-23 by ENGINE while re-deriving the two WIRE 4 rows;
> the same file read 14 failures at 01:05Z and 15 at 02:40Z with only engine bytes between them.
> **WHAT WOULD DECIDE IT:** whether a later wire made the berry timing correct by a second route (in
> which case the reversal needs widening) or the assertion stopped reading the timing at all.

## 9. OWED, NOT RUN

| owed | why it was not done |
|---|---|
| `node engine/quarantine.js --whole-game` and the 1200-game `--end-state` re-baseline | no engine byte moved, so the whole-game rate cannot have changed; running it would burn ~40 minutes to reproduce `c30534af567b` |
| diagnosis and fix of the HOLLOW `WIRE 7` Sitrus row | out of this brief's scope, and it is a different shape from the two rows owned here — filed above |
| re-aiming the 12 stale reversals | the standing open row; untouched |
| `node engine/register_reality.js` | it plays boards and this pass was not dispatched to |
| the ROADMAP edits in §8 | `docs/ROADMAP.md` is not ENGINE's to edit; the text is proposed, not written |
