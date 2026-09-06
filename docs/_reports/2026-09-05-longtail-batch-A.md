# Long-tail batch A — Big Root beyond `drain`, and Leech Seed's residual

**Board-material 59 → 56 of 961. Protocol 161 → 158. Census level unchanged at 829/829/0.**

Two mechanics landed, each with its own knob, its own probe shown RED first, and its own paired
measurement on its own frozen release. Nothing is committed.

---

## 0. THE BASELINE REPRODUCES

Before anything moved, the handoff figure was re-measured on the release it was taken on.

```
tools\lownode.cmd engine\game_differential.js --release 63cbcc2ef605 --arm middle --end-state \
  --census data/verification/census-pin-9446a684709d.json --games 1200 \
  --team-store data/team-pool-frozen --steering empirical --write \
  --out data/verification/longtail-A-baseline.json
```

| figure | handoff (`fix-batch-9.json`) | my re-run (`longtail-A-baseline.json`) |
|---|---|---|
| games | 961 | 961 |
| board-material (961 − boards-never-diverged) | 59 | **59** |
| protocol first divergence | 161 | **161** |
| boards never diverged | 902 | **902** |
| threw | 1 | 1 |
| end state SAME/DIFF/APART/NOCMP/THREW | 924/33/3/0/1 | 924/33/3/0/1 |
| driver code digest | `e87506b2d737` | `e87506b2d737` |

Identical on every published count. The 59 is real and is the number both fixes are measured against.

## 0b. HOW THE 59 WAS BUCKETED

`state.first_board_divergences` is **capped at 40 of the 59**, and `first_divergences` at 60 of the
161, so joining the two artifacts attributed only 16. A second run with `--dump-games 170`
(`data/verification/longtail-A-dump.json`, no `--write`, no artifact overwritten) carries the protocol
context — the raw lines either side of the split — for 156 of the 161 diverging games. **55 of the 59
board-material games have a protocol divergence too**, so the dump reaches almost all of them; the
other 4 diverge on the board with the protocol identical all game (the `stall` and Castform rows).

The joined list is what every choice below rests on. What it showed, by shape:

| bucket | games (of the 40 sampled) | status |
|---|---|---|
| Fairy Aura on Moonblast / Floette-Mega — a ~1.30x damage factor | 4 | **another agent owns it** (ROADMAP #542a) |
| Beat Up ally order | 1 | **another agent owns it** (ROADMAP #544) |
| unattributed damage | ~4 | open |
| `active[].stall` 0/3 with the protocol identical all game | 3 of 5 | open, see §4 |
| Sitrus / Roseli / Mental Herb not consumed | ~5 | open |
| Poison Touch, Cursed Body, Flame Body — 30% post-hit ability procs | ~6 | see §4, **suspect the instrument** |
| freeze thaw | ~5 | open |
| **Big Root on Ingrain** | 1 | **FIXED, §1** |
| **Leech Seed residual** | 2 | **FIXED, §2** |
| singletons (Castform forme on the bench, mega, Quick Claw, zero-magnitude boosts, Struggle) | rest | open, §5 |

---

## 1. BIG ROOT DECLARES FIVE HEAL SOURCES AND THIS ENGINE READ ONE

### The authority, read

```
data/items.ts  bigroot
  onTryHealPriority: 1,
  onTryHeal(damage, target, source, effect) {
    const heals = ['drain', 'leechseed', 'ingrain', 'aquaring', 'strengthsap'];
    if (heals.includes(effect.id)) return this.chainModify([5324, 4096]);
  }
```

Champions overrides neither the item nor any of the five handlers — `data/mods/champions/items.ts`
carries no `bigroot`. The ORDER of operations is the other half and comes off `Battle#heal`
(`sim/battle.ts:2258`):

```
if (damage && damage <= 1) damage = 1;
damage = this.trunc(damage);                                        <- the base is truncated FIRST
damage = this.runEvent('TryHeal', target, source, effect, damage);  <- then Big Root
```

so a 155 HP Ingrain is `trunc(155/16) = 9`, then `modify(9, 5324, 4096) = 12`. Folding the multiplier
into the fraction gives 12 by luck; truncating after a float multiply gives 11.

### What this engine did

`healMultBySource` had exactly two readers, both on the drain road (`_payDrainRow` and the
`MEDI_DRAIN_LUMP_ROUND` restore), and both filtered `from.includes('drain')`. The other four members
of the item's own list had no reader at all:

| source | site | what it paid |
|---|---|---|
| `ingrain` / `aquaring` | the `volHeal` residual step | `Math.max(1, trunc(maxhp / per))` |
| `leechseed` | the seeder's return | `_s.curHP += _d` |
| `strengthsap` | `_sapHeal` | `m.curHP += _sapHeal` |

Found in the pool, not in the lab: `|-heal|p1a: Meganium|71/155|[from] Ingrain` against this engine's
`68/155`, the first board divergence of `pair-protect-bust | ...-2660789599 vs ...-2660873574`.

### Red first

`tests/probe_bigroot_family.js`, knob `MEDI_BIGROOT_DRAIN_ONLY=1`. **Eight arms, five red, three
controls, all clear.** Before the fix, on the Ingrain arm:

```
showdown  -damage|meganium|82/155 -> -start|ingrain -> -heal|94/155 -> -heal|106/155 -> -heal|118/155
medicham  -damage|meganium|82/155 -> -start|ingrain -> -heal|91/155 -> -heal|100/155 -> -heal|109/155
board     b0:ok b1:PART b2:PART b3:PART
```

After: identical on all four boundaries, and the knob puts them apart again on every red arm.

- The five reds are `ingrain`, `ingrain` **mirrored side-for-side**, `aquaring` (the second member of
  the same residual branch, so the fix cannot be on one volatile name), `leechseed` (the seeder's
  return, a different road) and `strengthsap` (the move road, not the residual at all).
- The three controls are **the identical board with no item**, one per road. None moves under the knob.
- **The instrument's own control**: each item-less arm is asserted to produce DIFFERENT SHOWDOWN LINES
  from the Big Root arm it clears — YES on all three — so "the two engines agree" can never be read
  off a board where the item could not have mattered.
- The membership is re-derived every run out of `data/tags.json`'s own `healMultBySource.from`, and the
  file **refuses to run** (exit 2) if any non-`drain` member has no arm.

Two fixture faults were found and fixed by the probe itself before any verdict was trusted: the first
Strength Sap staging had the sap clamp at full HP in both engines (an arm where both write `150/150`
cannot tell 1.30x from 1.00x), and the second had the sap target's Attack so high that the same clamp
returned. The arm now stages Gardevoir — low Attack, high Special Attack — behind two Aura Spheres.

### The census row was asking one fifth of its own tag, and has been re-aimed

`probe('item','healMultBySource')` in `tests/test-mechanics.js` staged Bitter Blade and nothing else,
so an engine reading `drain` alone was green on it. It now stages the residual road too, through a real
`board(...)` + `battleTurn`, with the expectation built from `sdTrunc`/`sdModify` written out from
`Battle#heal` rather than imported from the engine. It also prints which members of `from` it still does
not stage (`leechseed aquaring strengthsap`) and names the probe that carries them.

**Shown both ways:** LIVE on the fixed engine, **MISSING** under `MEDI_BIGROOT_DRAIN_ONLY=1`
(`Ingrain with Big Root healed 77 (must be 100)`).

### The measurement

Release `1436eda2325f`, same census pin, same pool, same arm, same driver digest.
**The scoreboard was called in writing first**, to `data/verification/_prediction-longtail-A-bigroot.json`.

| figure | before | predicted | after |
|---|---|---|---|
| board-material | 59 | **58** | **58** |
| protocol | 161 | **160** | **160** |
| boards never diverged | 902 | **903** | **903** |
| threw | 1 | 1 | 1 |
| end state | 924/33/3/0/1 | unchanged | 924/33/3/0/1 |
| census level | 829 | 829 | 829 |

**Every figure landed at its point estimate.** Attribution, joined on `config|seed`: the ONLY class that
moved is `-heal field 3`, **1 → 0**; every other class is identical in count. The named game closed —
`pair-protect-bust | ...-2660789599 vs ...-2660873574`, `p1.party.meganium.hp medicham 68 / showdown 71`,
is gone from `first_board_divergences`. (One row appears to have "opened": that is the 41st row sliding
into a list capped at 40, and the TOTAL fell by exactly one.)

---

## 2. LEECH SEED'S RESIDUAL — THREE HALVES OF ONE HANDLER

The Big Root probe's leechseed arm printed the authority's lines beside ours, and two further defects
were visible in them that no board leaf had reported.

### The authority, read

```
data/moves.ts  leechseed.condition.onResidual(pokemon) {
  const target = this.getAtSlot(pokemon.volatiles['leechseed'].sourceSlot);
  if (!target || target.fainted || target.hp <= 0) { this.debug('Nothing to leech into'); return; }
  const damage = this.damage(pokemon.baseMaxhp / 8, pokemon, target);
  if (damage) this.heal(damage, target, pokemon);
}
```

and the two lines it produces are narrated by **two different branches**:

```
sim/battle.ts:2148  spreadDamage default:  ... else if (source && source !== target)
                      this.add('-damage', target, health, `[from] ${name}`, `[of] ${source}`);
sim/battle.ts:2276  heal              case 'leechseed': case 'rest':
                      this.add('-heal', target, target.getHealth, '[silent]');
```

### What this engine did

1. **It chipped a victim whose sower was gone.** The slot lookup gated only the HEAL — ROADMAP #175's
   note reads *"a refused seed pays the seeder nothing"* — so a seed whose sower had fainted went on
   taking `maxhp/8` a turn off a body the real game stops touching. **That is a board leaf.**
2. **The victim's chip carried no `[of]`.** It wrote the two-field form the authority takes only when
   there is no source, and after the guard there always is one.
3. **The sower's heal carried `[from] Leech Seed|[of] <victim>`** — the `default:` branch's shape on a
   line the authority routes past it.

### Red first

`tests/probe_leechseed_silent.js`, knobs `MEDI_LEECHSEED_CHIP_WITHOUT_SEEDER=1` (the board half) and
`MEDI_LEECHSEED_HEAL_ATTRIBUTED=1` (the two narration fields). **Four arms, three red, one control, all
clear.** The board arm, before and after:

```
showdown  ... -damage|meganium|0fnt -> -damage|lucario|127/145|[from]leechseed|[of]clefable
                                    -> -damage|lucario|109/145|[from]leechseed|[of]clefable
medicham (knob) ... -damage|meganium|0fnt -> -damage|lucario|127/145|[from]leechseed
                                          -> -damage|lucario|109/145|[from]leechseed|[of]clefable
                                          -> -damage|lucario|91/145|[from]leechseed|[of]clefable
```

— **three chips against the authority's two**, the extra one taken on the residual of the turn the
sower died. The fixed engine writes two, with the `[of]` on both.

- The control is **Ingrain on the same body**, and it is the arm a blanket *"make residual heals
  silent"* fix would fail: Ingrain falls through to `default:` and the authority DOES write
  `[from] Ingrain`. It does not move under either knob, and the authority is asserted to narrate the two
  differently.
- The board arm's fixture is checked before its verdict: the authority must have written fewer chips
  than there were turns of standing seed, and the knob load must have written MORE than the authority —
  otherwise the sower never died and the guard was never reached.
- `Battle#heal`'s `case 'leechseed'` is **re-derived from the loaded checkout** on every run; the file
  exits 2 rather than pass if the format stops carrying it.

**One probe fault was caught by its own control first.** The reader normalised `p1a: Meganium` by
splitting on `:`, which also mangled `[from] move: ingrain` into something Showdown's `[from] Ingrain`
could never equal — so the file accused the *Ingrain control* rather than the mechanic. The normaliser
now mirrors `game_differential.js`'s own (strip `move:`/`ability:`/`item:`, strip `pXy:`, keep `[from]`
and `[of]`), with the reason written beside it: a probe stricter than the measurement it defends
reports defects the measurement cannot see.

### The census row `residualStatusOrder` went MISSING and it was the LOCATOR, not the claim

It found the Leech Seed line with `/\[from\]leechseed$/` — anchored at the end, which the new `[of]`
field broke. The row reported the residual bracket index as `-1`, i.e. a locator failing and reading as
an order defect. The anchor came off; the ORDER claim is untouched, and the two attribution facts are
carried by the probe. **Census back to 829 live / 829 probed / 0 missing.**

### The measurement

Release `576bcbadb681`, same pins. Prediction in
`data/verification/_prediction-longtail-B-leechseed.json`.

| figure | before | predicted | after |
|---|---|---|---|
| board-material | 58 | 58 | **56** |
| protocol | 160 | 157 | **158** |
| boards never diverged | 903 | 903 | **905** |
| `-heal field 4` class | 3 | **0** | **0** |
| end state | 924/33/3/0/1 | unchanged | **925/32/3/0/1** |
| census level | 829 | 829 | 829 |

**TWO OF THE FIVE PREDICTED FIGURES MISSED, AND BOTH MISSES ARE THE SAME MISTAKE.** I predicted the
board-material figure FLAT on the reasoning that no Leech Seed chip appears anywhere in the 40 sampled
first board divergences — but the sample is 40 of 59, and the sowerless chip was in the other 19. It
moved 2. I then predicted protocol 157 by assuming all three `-heal field 4` games would close outright;
two did, and the third has a second, unrelated divergence behind it and re-classified into
`event missing from medicham2` (67 → 68). Net 160 − 3 + 1 = 158.

The direction is good and the attribution is clean — `-heal field 4` is the only class that fell, and
`event missing from medicham2` is the only one that rose, by exactly the one game that moved into it —
but **the point estimates were wrong and the reason was reasoning from a capped sample as if it were
the population.**

The two board rows that closed:
- `omit-spread | ...-2662099996 vs ...-2662094820`, turn 5, `p1.party.politoed.hp medicham 95 /
  showdown 115` — a Scovillain Leech Seed on Politoed, a 20-point gap on a body of that size.
- `pair-protect-bust | ...-2661484949 vs ...-2661592656`, turn 10, the Garchomp game whose first
  protocol divergence was the `-heal field 4` line itself.

---

## 3. WHAT DID NOT MOVE, AND IS NOT CLAIMED

- **`data/game-differential.json` was NOT rewritten.** Both runs used `--out`. `node engine/status.js`
  still prints the older whole-game figure and its two clauses remain the gate's failures.
- **The four clauses this pass staled were re-run** — damage differential and the three roster stages —
  because the engine source moved and leaving them stale would make the gate say
  "MEASURED AGAINST A DIFFERENT ENGINE" for a reason I caused. Their figures are in the verdict.
- **No fit, no self-play, no `status.js --write`, no commit.**
- `board.js`, `magnemite.js`, `engine-data.js`, `game_differential.js`, `board_state.js`, `steering.js`,
  `empirical_driver.js`, `move-priors.json` and `policy-weights.json` were **not touched**.

---

## 4. TWO BUCKETS WHERE I SUSPECT THE INSTRUMENT AND DID NOT "FIX" THE ENGINE

### 4a. The 30% post-hit ability procs — Poison Touch, Cursed Body, Flame Body (~6 games)

Poison Touch fires in one game and not another **in both directions**, which is the signature of an
unshared die rather than a missing rule. The engine's draw is `rng()` — the `any` stream — and Showdown's
`randomChance(3, 10)` inside `onSourceDamagingHit` is also `any`, because `runEvent('DamagingHit')`
(`data/mods/champions/scripts.ts:410`) sits inside `spreadMoveHit`, which is not one of the four methods
`midWrapShowdown` wraps.

**`engine/game_differential.js` explicitly declares the `any` bucket unshared.** `midGameVoid` computes
its identity over `OUT = {acc, crit, sec, dmg, stall}` ONLY, with the reason written beside it: *"the
`any` bucket ... was measured at 95.2% on one sample and 37.0% on another FROM THE SAME ENGINE and was
explicitly refused a floor."*

So these games are **an instrument question in a bucket the instrument has already declared it cannot
read**, and moving the engine's draw to another stream would make it worse rather than better —
Showdown's is `any`. **Filed, not fixed.** Deciding it needs `game_differential.js`, which is not mine
tonight.

### 4b. `active[].stall` 0/3 with the protocol identical all game (5 games)

These games emit byte-identical protocols and part only on the Protect counter. The engine's own header
at `_stallExpire` already declares the one case it cannot express — *"a turn that ends inside its own
residual"* — and the ROADMAP #175 fix of 2026-08-26 closed the single game that pointed this way. There
are now five, and **none of them is reachable through the dump**: a game with no protocol divergence is
not in `--dump-games`, whose pool is `r.div`. I could not see one, so I did not guess at one.
**Filed with the reason it could not be staged, not fixed.**

---

## 5. OWED AND NAMED, NOT FIXED HERE

- **Struggle's `-activate` line — the single biggest protocol bucket at 17 games.**
  `struggle.onModifyMove` is `move.type = '???'; this.add('-activate', pokemon, 'move: Struggle');`
  (`data/moves.ts:18218-18221`), emitted BEFORE the `|move|` line, and this engine emits nothing. The
  right shape is an `announce` param derived onto `setsOwnTypeAlways` — the tag already derived from the
  *other* statement of the same handler — which means regenerating `data/tags.json`. **Not done
  deliberately:** `tags.json` is a frozen release SOURCE, two other agents are measuring tonight, and
  `docs/_reports/2026-09-05-abra-tags-drift.md` says the regeneration is not currently a no-op.
  Narration only; no board leaf.
- **Poltergeist announces at use time and the authority announces at `onTryHit`** (7 games,
  narration only). `data/moves.ts:13610` — `onTryHit`, so the line comes AFTER invulnerability, after
  the type immunity, after accuracy and after Protect's own `onTryHit` (priority 3). Measured in the
  pool as `|-miss|` / `|-immune|` / `|-activate|...|move: Protect` on Showdown's side against our
  `-activate poltergeist`. Our emission sits at the `onTry` position instead.
- **`mustrecharge` is `onBeforeMovePriority: 11` and outranks sleep and freeze at 10**
  (`data/conditions.ts:367`); this engine asks recharge LAST, below paralysis. So a frozen or sleeping
  body that must recharge spends a status tick the authority does not. Derived from the source; **not
  probed and not measured**, and expected to be very rare.
- **Fairy Aura (4 games) and Beat Up (1 game)** are another agent's tonight and were left alone.
- The unattributed damage games, the berry-not-eaten games, the freeze-thaw games and the singletons in
  §0b are open.

---

## 6. FILES

Written:

- `engine/medicham2-browser.js` — `healSourceMult` / `healWithSourceMult`, the three non-drain call
  sites, the Leech Seed residual, four counters, three knobs.
- `tests/probe_bigroot_family.js` (new, 8 arms), `tests/probe_leechseed_silent.js` (new, 4 arms).
- `tests/test-mechanics.js` — `healMultBySource` re-aimed, `residualStatusOrder` locator un-anchored.
- `data/verification/longtail-A-baseline.json`, `longtail-A-dump.json`, `longtail-A-bigroot.json`,
  `longtail-B-leechseed.json`, and the two `_prediction-*.json` called before their runs.
- `data/engine-release.json` + `data/releases/1436eda2325f`, `data/releases/576bcbadb681`.
- `data/mechanics-census.json` regenerated (829/829/0, unchanged level).
